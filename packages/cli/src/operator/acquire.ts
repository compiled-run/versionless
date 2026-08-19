/**
 * The acquire stage: a consented, pinned, recorded fetch of an application
 * source into a baseline tree the generic `ingest` stage can read.
 *
 * Every other stage of `versionless run` is already generic. Acquiring an
 * application was not: it happened through a per-application fixture module and
 * a one-entry allowlist, so an application nobody had written a module for
 * could not enter the pipeline at all. This stage closes that: it takes an
 * `owner/name` and a ref, resolves the ref to a commit, fetches the archive at
 * that commit twice, reconciles what the archive carries against what the Git
 * tree says it should carry, and materializes the result.
 *
 * Four properties are structural rather than advisory.
 *
 * **One transport.** Every remote byte flows through
 * `packages/cli/src/acquisition/https-transaction.ts`, which stamps the
 * operator's consent id on each request and journals the exact bytes it
 * accepted. There is no second fetch path here and no unconsented one: absent a
 * consent id this stage refuses before the first socket is opened.
 *
 * **The pin is resolved, never assumed.** A ref is turned into a commit sha by
 * asking the repository, and the archive is fetched at that sha rather than at
 * the ref, so a tag that moves later does not silently change what was
 * acquired.
 *
 * **Parity is a gate, not a note.** The archive is reconciled against the Git
 * tree at the same commit — every regular blob hashed as Git would hash it. A
 * missing file, an extra file, or a mismatched blob refuses; it is not recorded
 * as a warning and carried forward.
 *
 * **Nothing is established about the application.** This stage acquires bytes.
 * It does not install, build, run, or admit anything. The licence check it does
 * make is a presence check at the pin, and it refuses rather than acquire an
 * application whose terms are not in the tree.
 */

import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { sha256 } from '../../../core/src/receipts/canonicalize.ts';
import type {
	AcquisitionState,
	ExactRequestDescriptor,
} from '../../../core/src/acquisition/transaction.ts';
import {
	acquireExactResponse,
	type AcquisitionTransaction,
} from '../acquisition/https-transaction.ts';
import {
	archiveMatchesGitTree,
	normalizedManifest,
	reconcileArchiveWithTree,
	summarizeTree,
	type ArchiveParity,
	type ExtractedFile,
	type TreeRow,
} from '../fixture/legacy-candidate-ingest.ts';
import { readLicenceAtPin, type LicenceArtifact } from './license.ts';
import { pipelineRefusalOf, refuse } from './refusals.ts';

/**
 * The record this stage publishes.
 *
 * It is deliberately the same schema the sealed per-application ingests
 * published — `versionless.official-source.v1` — because a record produced by
 * the generic path has to be readable by everything that already reads the
 * fifteen sealed ones. A different schema for the same fact would make the
 * generic path a second corpus rather than the same corpus acquired generically.
 */
export const ACQUIRE_RECORD_SCHEMA = 'versionless.official-source.v1';

/** The caps one acquisition is allowed, in bytes. */
export const ACQUIRE_CAPS = Object.freeze({
	metadata: 16_777_216,
	archive: 134_217_728,
	aggregate: 314_572_800,
});

/** The archive is fetched twice and the two streams must be byte-identical. */
export const ACQUIRE_ARCHIVE_STREAMS = 2;

export type AcquiredResponse = Readonly<{
	endpoint: string;
	status: 200;
	bytes: number;
	sha256: string;
	stream?: number;
}>;

export type AcquireLicenceReading = Readonly<{
	identifier: string | null;
	identifierSource: 'observed' | 'declared' | null;
	/** Why there is no identifier, when the licence text was not read. */
	identifierRefusal: string | null;
	copyrightNotice: string | null;
	filesAtRoot: readonly string[];
	artifacts: readonly LicenceArtifact[];
}>;

export type AcquireRecord = Readonly<{
	schemaVersion: typeof ACQUIRE_RECORD_SCHEMA;
	consentId: string;
	attemptSha256: string;
	result: 'source-bound';
	startedAt: string;
	completedAt: string;
	repository: Readonly<{
		id: number;
		fullName: string;
		private: boolean;
		archived: boolean;
		disabled: boolean;
		responseBytes: number;
		responseSha256: string;
	}>;
	revision: Readonly<{
		ref: string;
		tagObjectSha: string | null;
		tagKind: 'annotated' | 'lightweight' | 'commit-sha';
		tagDate: string | null;
		tagVerification: 'verified' | 'unsigned';
		commitSha: string;
		commitDate: string | null;
		commitVerification: 'verified' | 'unsigned';
		rootTreeSha: string;
		treeEntries: number;
		treeBlobs: number;
		treeDirectories: number;
		treeSymlinks: number;
		treeGitlinks: number;
		treeTruncated: boolean;
	}>;
	requests: readonly AcquiredResponse[];
	archiveParity: ArchiveParity;
	transaction: Readonly<{
		attemptedRequests: number;
		acceptedResponses: number;
		acceptedWireBytes: number;
		acceptedDecodedBytes: number;
		redirectsObserved: number;
		setCookiesUsed: number;
		retries: number;
		archivesByteIdentical: boolean;
		archiveMatchesGitTree: boolean;
		publishedSource: boolean;
		readinessCredit: false;
		implementationStarted: false;
	}>;
	cache: Readonly<{
		root: string;
		archive1: string;
		archive2: string;
		verifiedSource: string;
		rawMetadataPortable: false;
	}>;
	/** Where the generic `ingest` stage can read this acquisition from. */
	baseline: string;
	licence: AcquireLicenceReading;
	nonclaims: readonly string[];
}>;

const ACQUIRE_NOT_ESTABLISHED: readonly string[] = Object.freeze([
	'A lightweight or unsigned tag does not establish signer authenticity.',
	'This record states that the bytes at the recorded commit reconcile with the Git tree the repository publishes at that commit. It establishes no dependency closure, build, browser behavior, migration feasibility, pilot status, production readiness, certification, or legal approval.',
	'The licence reading is a reading of the file present at the pin. It is not a legal opinion and it evaluates no dependency’s terms.',
	'Acquiring a source is not admitting one. Whether this tree can be ingested, installed, built or migrated is not read here.',
]);

export type AcquireDeclarations = Readonly<{
	/** `owner/name`. */
	repository: string;
	/** A tag, a branch, or a 40-character commit sha. */
	ref: string | null;
	/** The corpus identifier the caches, the work tree and the record use. */
	id: string | null;
	/** The purpose-bound consent this fetch is made under. */
	consentId: string | null;
	/** The identifier an operator declares for a licence text nobody reads. */
	declaredLicence: string | null;
}>;

export const DEFAULT_ACQUIRE_DECLARATIONS: AcquireDeclarations = Object.freeze({
	repository: '',
	ref: null,
	id: null,
	consentId: null,
	declaredLicence: null,
});

const LOWER_HEX_40 = /^[0-9a-f]{40}$/;

const document = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

export const acquireCacheRoot = (id: string): string => `.versionless/cache/${id}-source`;
export const acquireBaselineRoot = (id: string): string => `.versionless/work/${id}/baseline`;
export const acquireEvidenceRoot = (id: string): string => `evidence/ingests/${id}`;

/**
 * The consent id this fetch is made under.
 *
 * A consent id is not a formality: it is the string the transport stamps on
 * every request and the string the record carries, so an auditor can tell which
 * grant a byte was fetched under. Absent one, this stage refuses before opening
 * a socket rather than fetch under an implied grant.
 */
export function resolveConsentId(declared: string | null, environment: NodeJS.ProcessEnv): string {
	const consentId = declared ?? environment.VERSIONLESS_CONSENT_ID ?? null;
	if (consentId === null || consentId === '')
		refuse({
			code: 'acquire.consent-not-declared',
			message:
				'Acquire: no consent id was declared, so this stage opened no socket. A fetch this repository makes is stamped with the purpose-bound consent it was made under and recorded against it; there is no unconsented fetch path. Declare it with --consent <id> or in VERSIONLESS_CONSENT_ID.',
			stage: 'acquire',
			origin: 'pipeline',
		});
	if (environment.VERSIONLESS_NETWORK_MODE !== 'consented')
		refuse({
			code: 'acquire.network-mode-not-consented',
			message:
				'Acquire: VERSIONLESS_NETWORK_MODE is not `consented`, so the host has not been told this process may reach the network. A consent id declares what a fetch is for; the network mode declares that a fetch may happen at all, and this stage requires both.',
			stage: 'acquire',
			origin: 'pipeline',
		});
	return consentId;
}

/** Split `owner/name`, or refuse. The repository is never guessed at. */
export function splitRepository(repository: string): { owner: string; name: string } {
	const parts = repository.split('/');
	const owner = parts[0] ?? '';
	const name = parts[1] ?? '';
	if (parts.length !== 2 || owner === '' || name === '')
		refuse({
			code: 'acquire.repository-not-owner-name',
			message: `Acquire: ${repository === '' ? '<empty>' : repository} is not an owner/name repository. This stage fetches a named repository at a named ref; it does not resolve a bare name, a URL, or a local path.`,
			stage: 'acquire',
			origin: 'pipeline',
		});
	return { owner, name };
}

/** The identifier the caches, the work tree and the record are keyed by. */
export function resolveIdentifier(declared: string | null): string {
	if (declared === null || declared === '')
		refuse({
			code: 'acquire.identifier-not-declared',
			message:
				'Acquire: no --id was declared. The identifier keys the cache, the work tree and the published record, and deriving one from a repository name would make two different pins of the same repository collide. Declare it with --id <identifier>.',
			stage: 'acquire',
			origin: 'pipeline',
		});
	return declared;
}

const api = (
	owner: string,
	name: string,
	tail: readonly string[],
	purpose: string,
	query?: Readonly<Record<string, string>>,
): ExactRequestDescriptor =>
	Object.freeze({
		host: 'api.github.com' as const,
		path: Object.freeze(['repos', owner, name, ...tail]),
		...(query === undefined ? {} : { query }),
		purpose,
		responseKind: 'json' as const,
	});

export function newAcquisitionState(): AcquisitionState {
	return { acceptedResponses: 0, aggregateBytes: 0, observations: [], ledger: [] };
}

/** The `requests` list the sealed records carry, read off the durable ledger. */
export function requestsOf(state: AcquisitionState): readonly AcquiredResponse[] {
	return Object.freeze(
		state.ledger.map((record) =>
			Object.freeze({
				endpoint: record.url,
				status: 200 as const,
				bytes: record.bodyBytes,
				sha256: record.sha256,
				...(record.intentionalDuplicateIndex === undefined
					? {}
					: { stream: record.intentionalDuplicateIndex }),
			}),
		),
	);
}

async function walkTree(
	directory: string,
	base: string,
): Promise<{ files: ExtractedFile[]; directories: number; specialEntries: number }> {
	const files: ExtractedFile[] = [];
	let directories = 0;
	let specialEntries = 0;
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const full = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			directories += 1;
			const nested = await walkTree(full, base);
			files.push(...nested.files);
			directories += nested.directories;
			specialEntries += nested.specialEntries;
		} else if (entry.isFile())
			files.push({ path: path.relative(base, full), bytes: await readFile(full) });
		else specialEntries += 1;
	}
	return { files, directories, specialEntries };
}

export type AcquireExtractor = (archive: string, destination: string) => void;

export const tarExtract: AcquireExtractor = (archive, destination) => {
	execFileSync('tar', ['-xzf', archive, '-C', destination]);
};

export type AcquireTransport = (
	transaction: AcquisitionTransaction,
	descriptor: ExactRequestDescriptor,
	state: AcquisitionState,
) => Promise<Buffer>;

/**
 * The licence reading this stage makes at the pin.
 *
 * Presence is a gate: a tree carrying no licence text is refused rather than
 * acquired, because the terms an application is offered under are not something
 * a later stage can recover from bytes that were never fetched. The
 * *identifier* is not a gate — a licence text this repository does not read
 * verbatim is recorded as unread, with the refusal that said so, and the
 * `license-at-pin` stage remains the place that settles it.
 */
export async function readLicenceForAcquisition(
	sourceRoot: string,
	declaredLicence: string | null,
): Promise<AcquireLicenceReading> {
	const manifest = path.join(sourceRoot, 'package.json');
	try {
		const record = await readLicenceAtPin(sourceRoot, manifest, {
			declaredIdentifier: declaredLicence,
		});
		return Object.freeze({
			identifier: record.identifier,
			identifierSource: record.identifierSource,
			identifierRefusal: null,
			copyrightNotice: record.copyrightNotice,
			filesAtRoot: record.licenceFilesAtRoot,
			artifacts: record.artifacts,
		});
	} catch (error) {
		const refusal = pipelineRefusalOf(error);
		if (refusal === null) throw error;
		if (refusal.code === 'license-at-pin.licence-file-absent')
			refuse({
				code: 'acquire.licence-absent-at-pin',
				message: `Acquire: the source root at the pinned commit carries no licence file, so the terms this application is offered under are not in the tree that was fetched. This stage does not acquire an application whose licence it never read. The license-at-pin stage said: ${refusal.message}`,
				stage: 'acquire',
				origin: 'pipeline',
			});
		return Object.freeze({
			identifier: null,
			identifierSource: null,
			identifierRefusal: refusal.code,
			copyrightNotice: null,
			filesAtRoot: Object.freeze([]),
			artifacts: Object.freeze([]),
		});
	}
}

/**
 * Acquire one application source under exact purpose-bound consent.
 *
 * The transport and the extractor are injected so the composition above is
 * exercisable without a network: the tests drive the same function with a
 * transport that serves recorded bytes.
 */
export async function acquireApplicationSource(
	declarations: AcquireDeclarations,
	options: {
		root?: string;
		environment?: NodeJS.ProcessEnv;
		transport?: AcquireTransport;
		extract?: AcquireExtractor;
	} = {},
): Promise<AcquireRecord> {
	const environment = options.environment ?? process.env;
	const consentId = resolveConsentId(declarations.consentId, environment);
	const { owner, name } = splitRepository(declarations.repository);
	const id = resolveIdentifier(declarations.id);
	const ref = declarations.ref;
	if (ref === null || ref === '')
		refuse({
			code: 'acquire.ref-not-declared',
			message:
				'Acquire: no --ref was declared. This stage fetches a repository at a pin an operator named — a tag, a branch, or a 40-character commit sha — and it does not fetch a default branch on the operator’s behalf.',
			stage: 'acquire',
			origin: 'pipeline',
		});

	const root = options.root ?? process.cwd();
	const cacheDirectory = path.join(root, acquireCacheRoot(id));
	const archiveDirectory = path.join(cacheDirectory, 'archive');
	const extractDirectory = path.join(cacheDirectory, 'verify/extracted');
	const evidenceDirectory = path.join(root, acquireEvidenceRoot(id));
	const baselineDirectory = path.join(root, acquireBaselineRoot(id));
	await mkdir(archiveDirectory, { recursive: true });
	await mkdir(evidenceDirectory, { recursive: true });

	const transaction: AcquisitionTransaction = Object.freeze({
		consentId,
		durableRoot: path.join(cacheDirectory, 'transaction'),
		metadataCap: ACQUIRE_CAPS.metadata,
		archiveCap: ACQUIRE_CAPS.archive,
		aggregateCap: ACQUIRE_CAPS.aggregate,
	});
	const fetchBytes = options.transport ?? acquireExactResponse;
	const extract = options.extract ?? tarExtract;
	const state = newAcquisitionState();
	const startedAt = new Date().toISOString();
	const readJson = async (descriptor: ExactRequestDescriptor): Promise<Record<string, unknown>> =>
		JSON.parse((await fetchBytes(transaction, descriptor, state)).toString('utf8')) as Record<
			string,
			unknown
		>;

	const repository = await readJson(api(owner, name, [], 'repository identity'));

	let tagObject: Record<string, unknown> | undefined;
	let commitSha: string;
	let tagKind: AcquireRecord['revision']['tagKind'];
	let recordedRef: string;
	if (LOWER_HEX_40.test(ref)) {
		commitSha = ref;
		tagKind = 'commit-sha';
		recordedRef = ref;
	} else {
		let reference: Record<string, unknown>;
		try {
			reference = await readJson(
				api(owner, name, ['git', 'ref', 'tags', ref], 'ref resolution'),
			);
		} catch {
			refuse({
				code: 'acquire.ref-not-resolvable',
				message: `Acquire: ${owner}/${name} did not resolve the ref ${ref} to an object. A pin this stage cannot resolve is refused rather than substituted with a branch head, a nearby tag, or the default branch.`,
				stage: 'acquire',
				origin: 'pipeline',
			});
		}
		const object = reference.object as { sha?: unknown; type?: unknown } | undefined;
		const objectSha = object?.sha;
		if (typeof objectSha !== 'string' || !LOWER_HEX_40.test(objectSha))
			refuse({
				code: 'acquire.ref-not-resolvable',
				message: `Acquire: the ref ${ref} in ${owner}/${name} resolved to no 40-character object sha, so there is no commit to pin to. A pin this stage cannot resolve is refused rather than substituted.`,
				stage: 'acquire',
				origin: 'pipeline',
			});
		recordedRef = `refs/tags/${ref}`;
		if (object?.type === 'tag') {
			tagObject = await readJson(
				api(owner, name, ['git', 'tags', objectSha], 'annotated tag object'),
			);
			commitSha = (tagObject.object as { sha: string }).sha;
			tagKind = 'annotated';
		} else {
			commitSha = objectSha;
			tagKind = 'lightweight';
		}
	}

	const commit = await readJson(api(owner, name, ['git', 'commits', commitSha], 'commit object'));
	const rootTreeSha = (commit.tree as { sha?: unknown } | undefined)?.sha;
	if (typeof rootTreeSha !== 'string')
		refuse({
			code: 'acquire.ref-not-resolvable',
			message: `Acquire: the commit ${commitSha} in ${owner}/${name} carries no root tree sha, so there is nothing to reconcile the archive against. A pin this stage cannot resolve is refused rather than substituted.`,
			stage: 'acquire',
			origin: 'pipeline',
		});
	const tree = await readJson(
		api(owner, name, ['git', 'trees', rootTreeSha], 'recursive root tree', { recursive: '1' }),
	);
	if (tree.truncated === true)
		refuse({
			code: 'acquire.git-tree-truncated',
			message: `Acquire: the recursive Git tree for ${rootTreeSha} came back truncated, so the archive cannot be reconciled against the whole tree. A partial reconciliation would report parity over the entries that happened to arrive, which is not a parity claim.`,
			stage: 'acquire',
			origin: 'pipeline',
		});
	const rows = tree.tree as TreeRow[];

	const archives: { file: string; sha256: string; bytes: number }[] = [];
	for (let stream = 1; stream <= ACQUIRE_ARCHIVE_STREAMS; stream += 1) {
		const body = await fetchBytes(
			transaction,
			Object.freeze({
				host: 'codeload.github.com' as const,
				path: Object.freeze([owner, name, 'tar.gz', commitSha]),
				purpose: 'source archive at the pinned commit',
				responseKind: 'archive' as const,
				intentionalDuplicateIndex: stream as 1 | 2,
			}),
			state,
		);
		const file = path.join(archiveDirectory, `archive-${String(stream)}.tar.gz`);
		await writeFile(file, body);
		archives.push({ file, sha256: sha256(body), bytes: body.byteLength });
	}
	const archivesByteIdentical = archives.every(
		(archive) => archive.sha256 === (archives[0]?.sha256 ?? ''),
	);
	if (!archivesByteIdentical)
		refuse({
			code: 'acquire.archive-streams-differ',
			message: `Acquire: the ${String(ACQUIRE_ARCHIVE_STREAMS)} archive streams fetched at ${commitSha} are not byte-identical, so what this host received is not reproducible from the same request. Publishing either one would record a source nobody can re-fetch.`,
			stage: 'acquire',
			origin: 'pipeline',
		});

	await rm(extractDirectory, { recursive: true, force: true });
	await mkdir(extractDirectory, { recursive: true });
	extract(archives[0]?.file ?? '', extractDirectory);
	const roots = await readdir(extractDirectory);
	const singleRoot = roots[0];
	if (roots.length !== 1 || singleRoot === undefined)
		refuse({
			code: 'acquire.archive-root-not-single',
			message: `Acquire: the archive at ${commitSha} extracted to ${String(roots.length)} roots rather than one, so which directory is the application source is not something this stage reads. It does not pick one.`,
			stage: 'acquire',
			origin: 'pipeline',
		});
	const sourceRoot = path.join(extractDirectory, singleRoot);
	const walked = await walkTree(sourceRoot, sourceRoot);
	const parity = reconcileArchiveWithTree({
		singleRoot,
		rows,
		files: walked.files,
		directories: walked.directories + 1,
		specialEntries: walked.specialEntries,
	});
	await writeFile(
		path.join(cacheDirectory, 'manifest.txt'),
		normalizedManifest(walked.files).text,
	);
	if (!archiveMatchesGitTree(parity))
		refuse({
			code: 'acquire.archive-parity-differs',
			message: `Acquire: the archive at ${commitSha} does not reconcile with the Git tree at the same commit — ${String(parity.missingFiles)} missing, ${String(parity.extraFiles)} extra, ${String(parity.mismatchedBlobs)} mismatched of ${String(parity.gitBlobs)} blobs. These bytes are not the bytes ${owner}/${name} publishes at that revision, so nothing is published from them.`,
			stage: 'acquire',
			origin: 'pipeline',
		});

	const licence = await readLicenceForAcquisition(sourceRoot, declarations.declaredLicence);

	await rm(baselineDirectory, { recursive: true, force: true });
	await mkdir(path.dirname(baselineDirectory), { recursive: true });
	await cp(sourceRoot, baselineDirectory, { recursive: true });

	const first = state.ledger[0];
	if (first === undefined)
		refuse({
			code: 'acquire.no-accepted-responses',
			message:
				'Acquire: the transaction accepted no responses, so there is no durable ledger to publish a record against. An acquisition record with no accepted response is a record of nothing.',
			stage: 'acquire',
			origin: 'pipeline',
		});
	const verification = (value: unknown): 'verified' | 'unsigned' =>
		(value as { verified?: boolean } | undefined)?.verified === true ? 'verified' : 'unsigned';
	const attempt = Object.freeze({
		schemaVersion: 'versionless.official-source-attempt.v1',
		candidate: { repository: `${owner}/${name}`, requestedTag: ref },
		consentId,
		result: 'started',
		network: {
			method: 'GET',
			credentials: 'none',
			requestEncoding: 'identity',
			redirectsAllowed: false,
			alternateHostsAllowed: false,
		},
		caps: ACQUIRE_CAPS,
		requiredArchiveStreams: ACQUIRE_ARCHIVE_STREAMS,
		publication: {
			evidenceRoot: acquireEvidenceRoot(id),
			cacheRoot: acquireCacheRoot(id),
			baseline: acquireBaselineRoot(id),
			transactional: true,
			readinessCredit: false,
		},
		nonclaims: ACQUIRE_NOT_ESTABLISHED,
	});
	const attemptBytes = Buffer.from(document(attempt), 'utf8');
	await writeFile(path.join(evidenceDirectory, 'attempt.json'), attemptBytes);

	const record: AcquireRecord = Object.freeze({
		schemaVersion: ACQUIRE_RECORD_SCHEMA,
		consentId,
		attemptSha256: sha256(attemptBytes),
		result: 'source-bound',
		startedAt,
		completedAt: new Date().toISOString(),
		repository: Object.freeze({
			id: repository.id as number,
			fullName: repository.full_name as string,
			private: repository.private === true,
			archived: repository.archived === true,
			disabled: repository.disabled === true,
			responseBytes: first.bodyBytes,
			responseSha256: first.sha256,
		}),
		revision: Object.freeze({
			ref: recordedRef,
			tagObjectSha: (tagObject?.sha as string | undefined) ?? null,
			tagKind,
			tagDate: ((tagObject?.tagger as { date?: string } | undefined)?.date ?? null) as
				| string
				| null,
			tagVerification: verification(tagObject?.verification),
			commitSha,
			commitDate: ((commit.committer as { date?: string } | undefined)?.date ?? null) as
				| string
				| null,
			commitVerification: verification(commit.verification),
			rootTreeSha,
			...summarizeTree(rows),
			treeTruncated: tree.truncated === true,
		}),
		requests: requestsOf(state),
		archiveParity: parity,
		transaction: Object.freeze({
			attemptedRequests: state.observations.length,
			acceptedResponses: state.acceptedResponses,
			acceptedWireBytes: state.aggregateBytes,
			acceptedDecodedBytes: state.aggregateBytes,
			redirectsObserved: state.observations.filter(
				(observation) =>
					observation.status !== null &&
					observation.status >= 300 &&
					observation.status < 400,
			).length,
			setCookiesUsed: 0,
			retries: Math.max(0, state.observations.length - state.acceptedResponses),
			archivesByteIdentical,
			archiveMatchesGitTree: archiveMatchesGitTree(parity),
			publishedSource: true,
			readinessCredit: false,
			implementationStarted: false,
		}),
		cache: Object.freeze({
			root: acquireCacheRoot(id),
			archive1: path.relative(root, archives[0]?.file ?? ''),
			archive2: path.relative(root, archives[1]?.file ?? ''),
			verifiedSource: path.relative(root, extractDirectory),
			rawMetadataPortable: false,
		}),
		baseline: acquireBaselineRoot(id),
		licence,
		nonclaims: ACQUIRE_NOT_ESTABLISHED,
	});
	await writeFile(path.join(evidenceDirectory, 'source.json'), document(record));
	return record;
}

/** The acquisition as an operator reads it. */
export function renderAcquire(record: AcquireRecord): string {
	return [
		`acquired: ${record.repository.fullName} at ${record.revision.ref}`,
		`commit: ${record.revision.commitSha}`,
		`consent: ${record.consentId}`,
		`archive parity: ${record.archiveParity.regularFiles} files against ${record.archiveParity.gitBlobs} git blobs, ${record.archiveParity.mismatchedBlobs} mismatched`,
		`manifest: ${record.archiveParity.normalizedManifestSha256}`,
		`licence: ${record.licence.identifier ?? 'not read'}${
			record.licence.artifacts[0] === undefined
				? ''
				: ` (${record.licence.artifacts[0].path} blob ${record.licence.artifacts[0].gitBlobSha})`
		}`,
		`baseline: ${record.baseline}`,
		`transaction: ${String(record.transaction.acceptedResponses)} accepted responses, ${String(record.transaction.acceptedWireBytes)} bytes`,
		'',
		...ACQUIRE_NOT_ESTABLISHED.map((line) => `not established: ${line}`),
		'',
	].join('\n');
}
