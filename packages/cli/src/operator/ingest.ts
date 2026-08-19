/**
 * The `ingest` stage: admit an application this pipeline has never seen.
 *
 * Today admission is a TypeScript module. `packages/cli/src/fixture/` holds 34
 * `*-ingest.ts` files, one per application, and a thirty-fifth application
 * cannot be admitted without a thirty-fifth file. `legacyCandidates`
 * (`packages/cli/src/fixture/legacy-candidate-ingest.ts`) carries one entry and
 * `isLegacyCandidateId` refuses everything else. Either way the first step of
 * migrating a new application is somebody editing source, which is a human
 * intervention inside a run that is supposed to have none.
 *
 * This stage is the generic path beside those modules. It takes an application
 * source that is already on disk, plus the handful of values the 34 modules
 * actually vary on, and produces the ingest record: the pin, the tree digest,
 * the licence at that pin, and the dependency closure the frontend manifest and
 * its lockfile describe. It consults no allowlist. There is nothing to add an
 * entry to.
 *
 * What the 34 modules vary on, and where each value comes from here:
 *
 * | Value | Source |
 * |---|---|
 * | application id | `--id`, else the frontend manifest's own `name` |
 * | frontend root | `--frontend-root`, else the one subdirectory carrying a manifest |
 * | pinned revision | `--revision`, else the checkout's own Git metadata |
 * | repository / ref | `--repository` / `--ref`, else the acquisition journal's, else absent |
 * | lockfile | `--lockfile`, else the npm lockfile the frontend root carries |
 * | licence | observed at the pin, else `--license` (see `license.ts`) |
 *
 * Every one of those has a refusing default. A value this stage cannot read and
 * was not given is a named `PipelineRefusal` carrying exit 2 — never a plausible
 * substitute, and never the directory name standing in for an identity.
 *
 * Two things this stage deliberately does not do. It opens no socket: the
 * network acquisition path stays in `legacy-candidate-ingest.ts` behind its
 * purpose-bound consent, and this stage reads a source that is already local.
 * And it provisions no era cell — choosing and obtaining a toolchain era is the
 * manual residue the spike named separately, and pretending to have covered it
 * here would be the quieter of the two failures.
 */

import { readFile, readdir } from 'node:fs/promises';
import * as path from 'pathe';
import {
	analyzeLegacyLockClosure,
	lowerHex40,
	normalizedManifest,
	type ExtractedFile,
	type LegacyClosureRecord,
} from '../fixture/legacy-candidate-ingest.ts';
import {
	analyzeApplication,
	declaredDependencies,
	directoryExists,
	fileExists,
	readJsonFile,
	workspacePathsBelow,
	type ApplicationAnalysis,
	type Lineage,
} from './analyze.ts';
import {
	DEFAULT_LICENCE_POLICY,
	readLicenceAtPin,
	type LicenceAtPinRecord,
	type LicencePolicy,
} from './license.ts';
import { refuse } from './refusals.ts';

export const INGEST_RECORD_SCHEMA = 'versionless.operator-ingest.v1';

/** The npm lockfiles this stage reads a closure out of, in preference order. */
export const CLOSURE_LOCKFILES: readonly string[] = Object.freeze([
	'package-lock.json',
	'npm-shrinkwrap.json',
]);

/** Lockfiles naming a package manager the closure reading does not cover. */
export const FOREIGN_CLOSURE_LOCKFILES: Readonly<Record<string, string>> = Object.freeze({
	'yarn.lock': 'yarn',
	'pnpm-lock.yaml': 'pnpm',
});

/**
 * The values an operator may declare, each replacing one reading this stage
 * would otherwise have to make. Every one of them is `null` by default, and a
 * `null` this stage cannot fill by reading the tree is a refusal.
 */
export type IngestDeclarations = Readonly<{
	id: string | null;
	frontendRoot: string | null;
	revision: string | null;
	repository: string | null;
	ref: string | null;
	lockfile: string | null;
	licence: LicencePolicy;
}>;

export const DEFAULT_INGEST_DECLARATIONS: IngestDeclarations = Object.freeze({
	id: null,
	frontendRoot: null,
	revision: null,
	repository: null,
	ref: null,
	lockfile: null,
	licence: DEFAULT_LICENCE_POLICY,
});

/** Where a recorded value came from: a declaration, or a reading of the tree. */
export type ValueSource = 'declared' | 'read';

export type IngestPin = Readonly<{
	/**
	 * `owner/name` as declared, or as read out of the acquisition journal past
	 * the same four gates the revision passes, or `null` when neither states one.
	 */
	repository: string | null;
	/** Which file the repository was read out of, when it was read. */
	repositoryReadFrom: string | null;
	/** The ref as declared, as read out of that same journal reading, or `null`. */
	ref: string | null;
	/** Which file the ref was read out of, when it was read. */
	refReadFrom: string | null;
	commitSha: string;
	commitShaSource: ValueSource;
	/** Which file the revision was read out of, when it was read. */
	commitShaReadFrom: string | null;
}>;

export type IngestTreeReading = Readonly<{
	files: number;
	bytes: number;
	/** The digest of the sorted `path sha256 bytes` manifest of the tree. */
	normalizedManifestSha256: string;
}>;

export type IngestRecord = Readonly<{
	stage: 'ingest';
	schemaVersion: string;
	ran: boolean;
	/** Why the stage did not run, when it did not. */
	reason: string | null;
	id: string | null;
	idSource: ValueSource | null;
	/** Which file the identifier was read out of, when it was read. */
	idReadFrom: string | null;
	/** The frontend root, relative to the source root. */
	frontendRoot: string | null;
	frontendRootSource: ValueSource | null;
	/** Every directory considered for the frontend root, and what each declared. */
	frontendRootBasis: string | null;
	/** The enclosing acquisition tree the journal was read against, when there is one. */
	acquisitionRoot: string | null;
	pin: IngestPin | null;
	tree: IngestTreeReading | null;
	detected: ApplicationAnalysis | null;
	licence: LicenceAtPinRecord | null;
	closure: LegacyClosureRecord | null;
	/** Why there is no closure record, when there is none. */
	closureReason: string | null;
	notEstablished: readonly string[];
}>;

const INGEST_NOT_ESTABLISHED: readonly string[] = Object.freeze([
	'An ingest record states what the source on disk says at the revision it was pinned to. It is not an acquisition: nothing here establishes that these bytes are the bytes the named repository publishes at that revision, and no archive was fetched, reconciled against a Git tree, or double-streamed by this stage.',
	'`normalizedManifestSha256` digests the files this stage walked. Installed packages and Git metadata are not walked, so the digest is comparable with another walk of the same shape and not with a digest taken over a whole archive.',
	'The closure reading is the dependency tree the lockfile itself carries. A lockfile that records its closure only in the `packages` map yields no placements here, and a count of zero placements is the absence of a reading rather than an empty closure.',
	'Nothing here installs, builds, or runs the application. An admitted application is one whose identity, pin, licence and declared closure were read — not one that was shown to work.',
	'No era cell was chosen or provisioned. Which Node and toolchain era this source needs is not read here and not established by admission.',
	'A value recorded with source `declared` was supplied by an operator. This stage did not read it and does not corroborate it.',
	'An identifier read from an acquisition journal is the identifier an operator declared when the source was fetched. The application itself declares none, and nothing here establishes that the two would agree.',
	'A frontend root read by lineage is the one directory among those considered whose manifest declares a framework this stage reads. The basis names every directory considered and what each of their manifests declared; nothing here establishes that the directory chosen is the one its authors would call the application.',
]);

/** The record for a stage the run did not ask for. */
export function ingestNotRequested(reason: string): IngestRecord {
	return Object.freeze({
		stage: 'ingest',
		schemaVersion: INGEST_RECORD_SCHEMA,
		ran: false,
		reason,
		id: null,
		idSource: null,
		idReadFrom: null,
		frontendRoot: null,
		frontendRootSource: null,
		frontendRootBasis: null,
		acquisitionRoot: null,
		pin: null,
		tree: null,
		detected: null,
		licence: null,
		closure: null,
		closureReason: null,
		notEstablished: INGEST_NOT_ESTABLISHED,
	});
}

/**
 * The commit a checkout is sitting on, read from its own Git metadata.
 *
 * Returns the sha and the file it came out of, or `null` when the tree carries
 * no readable Git metadata — which is a refusal upstream, not a default.
 */
export async function readGitRevision(
	sourceRoot: string,
): Promise<Readonly<{ commitSha: string; readFrom: string }> | null> {
	const gitDir = path.join(sourceRoot, '.git');
	if (!(await directoryExists(gitDir))) return null;
	const headFile = path.join(gitDir, 'HEAD');
	if (!(await fileExists(headFile))) return null;
	const head = (await readFile(headFile, 'utf8')).trim();
	if (!head.startsWith('ref: '))
		return lowerHex40.test(head) ? { commitSha: head, readFrom: '.git/HEAD' } : null;
	const reference = head.slice('ref: '.length).trim();
	const looseFile = path.join(gitDir, reference);
	if (await fileExists(looseFile)) {
		const sha = (await readFile(looseFile, 'utf8')).trim();
		if (lowerHex40.test(sha)) return { commitSha: sha, readFrom: `.git/${reference}` };
		return null;
	}
	const packedFile = path.join(gitDir, 'packed-refs');
	if (!(await fileExists(packedFile))) return null;
	for (const line of (await readFile(packedFile, 'utf8')).split('\n')) {
		if (line.startsWith('#') || line.startsWith('^')) continue;
		const [sha, name] = line.trim().split(' ');
		if (name === reference && sha !== undefined && lowerHex40.test(sha))
			return { commitSha: sha, readFrom: '.git/packed-refs' };
	}
	return null;
}

/**
 * The lane layout the acquire stage writes: `<root>/.versionless/work/<id>/baseline`
 * for the tree, `<root>/evidence/ingests/<id>/source.json` for the journal.
 *
 * Reading the layout is how this stage finds the journal that belongs to a tree
 * it was handed. The walk goes **up** from the given root to the nearest
 * enclosing baseline, because the unit of provenance and the unit of
 * composition are not the same directory: a monorepo whose frontend sits at
 * `<baseline>/client` was acquired as one tree and the journal is about that
 * tree. `subPath` records the relationship, and it is the caller's job to walk
 * the enclosing tree and match its digest against the journal — a path fact on
 * its own establishes nothing. A source root with no enclosing baseline yields
 * nothing here, which leaves the revision unread rather than guessed at.
 */
export function acquisitionLaneOf(sourceRoot: string): Readonly<{
	workspaceRoot: string;
	laneId: string;
	/** The enclosing `.versionless/work/<id>/baseline` directory, absolute. */
	acquisitionRoot: string;
	/** Where the given root sits inside it: `.` when they are the same directory. */
	subPath: string;
}> | null {
	const segments = path.resolve(sourceRoot).split('/');
	for (let end = segments.length; end >= 5; end -= 1) {
		const [marker, work, laneId, baseline] = segments.slice(end - 4, end) as [
			string,
			string,
			string,
			string,
		];
		if (marker !== '.versionless' || work !== 'work' || baseline !== 'baseline') continue;
		if (laneId === '') continue;
		const below = segments.slice(end);
		return Object.freeze({
			workspaceRoot: segments.slice(0, end - 4).join('/'),
			laneId,
			acquisitionRoot: segments.slice(0, end).join('/'),
			subPath: below.length === 0 ? '.' : below.join('/'),
		});
	}
	return null;
}

/**
 * The acquisition journal for a tree, read from the pipeline's own evidence.
 *
 * `acquire` resolves the revision through a consented transaction, reconciles
 * the archive against the Git tree the repository publishes, and journals both
 * to `evidence/ingests/<id>/source.json`. This reads that journal — nothing is
 * fetched and no socket is opened — and returns it unjudged; the gates below
 * decide whether it is a reading of *this* tree.
 */
async function readAcquisitionJournal(
	sourceRoot: string,
	ingestId: string,
): Promise<Readonly<{ file: string; document: Record<string, unknown> }> | null> {
	const lane = acquisitionLaneOf(sourceRoot);
	if (lane === null) return null;
	const seen = new Set<string>();
	for (const candidate of [lane.laneId, ingestId]) {
		if (candidate === '' || seen.has(candidate)) continue;
		seen.add(candidate);
		const relative = `evidence/ingests/${candidate}/source.json`;
		const file = path.join(lane.workspaceRoot, relative);
		if (!(await fileExists(file))) continue;
		const document = await readJsonFile(file);
		if (document === null) continue;
		return Object.freeze({ file: relative, document });
	}
	return null;
}

const stringAt = (document: Record<string, unknown>, ...keys: readonly string[]): string | null => {
	let current: unknown = document;
	for (const key of keys) {
		if (current === null || typeof current !== 'object') return null;
		current = (current as Record<string, unknown>)[key];
	}
	return typeof current === 'string' && current.trim() !== '' ? current.trim() : null;
};

/**
 * The pin the acquisition journal recorded, or a named refusal.
 *
 * Four gates, and every one of them refuses rather than degrades. A journal
 * whose transaction did not bind a source is not a pin; a journal carrying no
 * consent identifier is not a consented reading; a journal carrying no parity
 * basis — the archive reconciled against the published Git tree, byte-identical
 * across two streams — states no relationship between the bytes and the commit;
 * and a journal whose manifest digest is not this tree's digest is a reading of
 * some other bytes.
 *
 * The repository and the ref come out of the same reading, past the same four
 * gates, and are carried with the same basis string. That is not a fifth gate
 * and it is not a widening: the transaction that reconciled these bytes against
 * a published Git tree named the repository it read that tree from and the ref
 * it resolved the commit through, so a reading that already establishes the sha
 * establishes those two or it establishes nothing. Either may still be absent
 * from a journal, and an absent field is recorded as `null` rather than
 * invented — the pin then says the sha was read and the other two were not.
 */
function revisionOfAcquisitionJournal(
	file: string,
	document: Record<string, unknown>,
	tree: IngestTreeReading,
	walked: Readonly<{ acquisitionRoot: string; subPath: string }> | null,
): Readonly<{
	commitSha: string;
	repository: string | null;
	ref: string | null;
	readFrom: string;
}> {
	/**
	 * When the ingested root sits inside the acquired tree rather than being it,
	 * the record states that relationship rather than implying it: the digest
	 * gate below was applied to the enclosing tree, and the frontend is a
	 * subpath of it.
	 */
	const enclosing =
		walked === null
			? ''
			: `; the journalled manifest is the digest of the enclosing acquisition tree at ${walked.acquisitionRoot}, which this stage walked, and the ingested frontend ${walked.subPath} is a subpath of that tree`;
	const result = stringAt(document, 'result');
	if (result !== 'source-bound')
		refuse({
			code: 'ingest.acquisition-journal-not-source-bound',
			message: `Ingest: ${file} records the acquisition of this tree with result ${result ?? 'none'} rather than source-bound. Only a transaction that bound a source states a revision these bytes are pinned to, so this stage reads no pin out of it; declare the revision with --revision <commit-sha> if you know it by other means.`,
			stage: 'ingest',
			origin: 'pipeline',
		});
	const consentId = stringAt(document, 'consentId');
	if (consentId === null)
		refuse({
			code: 'ingest.acquisition-journal-carries-no-consent',
			message: `Ingest: ${file} names no consentId, so nothing in it says under whose consent the network was opened. A journal without consent is not a reading this stage adopts a pin from.`,
			stage: 'ingest',
			origin: 'pipeline',
		});
	const journalled = stringAt(document, 'archiveParity', 'normalizedManifestSha256');
	const transaction = document.transaction as Record<string, unknown> | undefined;
	const matchesGitTree = transaction?.archiveMatchesGitTree === true;
	const byteIdentical = transaction?.archivesByteIdentical === true;
	if (journalled === null || !matchesGitTree || !byteIdentical)
		refuse({
			code: 'ingest.acquisition-journal-carries-no-parity-basis',
			message: `Ingest: ${file} carries no parity basis — archiveMatchesGitTree ${String(matchesGitTree)}, archivesByteIdentical ${String(byteIdentical)}, archive manifest ${journalled ?? 'unrecorded'}. A journal that did not reconcile its archive against the Git tree the repository publishes establishes no relationship between these bytes and the commit it names, so this stage reads no pin out of it.`,
			stage: 'ingest',
			origin: 'pipeline',
		});
	const commitSha = stringAt(document, 'revision', 'commitSha');
	if (commitSha === null || !lowerHex40.test(commitSha))
		refuse({
			code: 'ingest.acquisition-journal-revision-unreadable',
			message: `Ingest: ${file} records the revision ${commitSha ?? 'none'}, which is not a 40-character lower-case hexadecimal commit sha. The pin is what the licence reading and every later record are relative to, so an abbreviated or symbolic revision is refused rather than resolved into one.`,
			stage: 'ingest',
			origin: 'pipeline',
		});
	if (journalled !== tree.normalizedManifestSha256)
		refuse({
			code: 'ingest.acquisition-journal-does-not-match-the-tree',
			message: `Ingest: ${file} journalled the manifest digest ${journalled} for the source it acquired, and the tree on disk walks to ${tree.normalizedManifestSha256}. These are not the same bytes, so the revision that journal names is not the revision this tree is sitting at; re-acquire the source, or declare the revision with --revision <commit-sha>.${walked === null ? '' : ` The tree walked was the enclosing acquisition tree at ${walked.acquisitionRoot}, which is what that journal is about.`}`,
			stage: 'ingest',
			origin: 'pipeline',
		});
	return Object.freeze({
		commitSha,
		repository: stringAt(document, 'repository', 'fullName'),
		ref: stringAt(document, 'revision', 'ref'),
		readFrom: `${file} (consent ${consentId}; result source-bound; archive reconciled against the published Git tree and byte-identical across two streams; journalled manifest ${journalled} is the digest this stage walked${enclosing})`,
	});
}

/**
 * The identifier an operator declared when this tree was acquired, or `null`.
 *
 * The five gates the revision passes are applied here silently: a journal that
 * did not bind a source, carries no consent, reconciled no archive, names no
 * readable revision, or is not about these bytes yields no identifier, and
 * `ingest.identifier-not-determined` stands. The identifier itself is the one
 * the journal is filed under — `acquire` refuses without `--id` and derives
 * `evidence/ingests/<id>/` and `.versionless/work/<id>/baseline` from it — and
 * the journal's own `baseline` field has to name the tree that was walked, so
 * this is a recorded operator declaration rather than a directory name.
 */
function identifierOfAcquisitionJournal(
	file: string,
	document: Record<string, unknown>,
	tree: IngestTreeReading,
	lane: Readonly<{ laneId: string; acquisitionRoot: string }>,
	frontendManifest: string,
): Readonly<{ id: string; readFrom: string }> | null {
	if (file !== `evidence/ingests/${lane.laneId}/source.json`) return null;
	if (stringAt(document, 'result') !== 'source-bound') return null;
	const consentId = stringAt(document, 'consentId');
	if (consentId === null) return null;
	const transaction = document.transaction as Record<string, unknown> | undefined;
	if (transaction?.archiveMatchesGitTree !== true || transaction.archivesByteIdentical !== true)
		return null;
	const journalled = stringAt(document, 'archiveParity', 'normalizedManifestSha256');
	if (journalled === null || journalled !== tree.normalizedManifestSha256) return null;
	const commitSha = stringAt(document, 'revision', 'commitSha');
	if (commitSha === null || !lowerHex40.test(commitSha)) return null;
	const baseline = stringAt(document, 'baseline');
	if (baseline === null || !lane.acquisitionRoot.endsWith(baseline)) return null;
	return Object.freeze({
		id: lane.laneId,
		readFrom: `${file} (consent ${consentId}), where it was declared by an operator with --id at acquire time and the journal records the baseline it wrote as ${baseline}. This stage read the journal, not the application: ${frontendManifest} declares no name and this stage read none.`,
	});
}

/**
 * The one immediate subdirectory carrying a manifest, or `null`.
 *
 * Zero and more than one are both refusals upstream. "Pick the first" is
 * exactly the kind of default this stage exists to not take.
 */
async function manifestBearingSubdirectories(sourceRoot: string): Promise<readonly string[]> {
	const found: string[] = [];
	let entries: string[];
	try {
		entries = (await readdir(sourceRoot, { withFileTypes: true }))
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name)
			.sort();
	} catch {
		return Object.freeze([]);
	}
	for (const name of entries) {
		if (name === 'node_modules' || name === '.git') continue;
		if (await fileExists(path.join(sourceRoot, name, 'package.json'))) found.push(name);
	}
	return Object.freeze(found);
}

/** The packages a lineage is declared by, in the order `analyze` reads them. */
const LINEAGE_PACKAGES: readonly (readonly [Lineage, string])[] = Object.freeze([
	Object.freeze(['angular', '@angular/core'] as const),
	Object.freeze(['nextjs', 'next'] as const),
	Object.freeze(['react', 'react'] as const),
]);

type FrontendCandidate = Readonly<{ directory: string; lineage: Lineage; reading: string }>;

/**
 * Every directory that could be the frontend, and what its manifest declares.
 *
 * The candidate set is the source root and its immediate subdirectories — the
 * shape an acquired monorepo has — and each candidate is read for a lineage the
 * `analyze` stage recognises rather than for the presence of a manifest. A
 * directory carrying a manifest is not a frontend; a directory whose manifest
 * declares react, next or angular is what this stage is looking for, and the
 * reading of every candidate is recorded whether it was chosen or not.
 */
async function readFrontendCandidates(sourceRoot: string): Promise<readonly FrontendCandidate[]> {
	const directories: string[] = [];
	if (await fileExists(path.join(sourceRoot, 'package.json'))) directories.push('.');
	directories.push(...(await manifestBearingSubdirectories(sourceRoot)));
	const candidates: FrontendCandidate[] = [];
	for (const directory of directories) {
		const manifest = await readJsonFile(path.join(sourceRoot, directory, 'package.json'));
		const dependencies = declaredDependencies(manifest);
		const declared = LINEAGE_PACKAGES.find(([, name]) => Object.hasOwn(dependencies, name));
		if (declared === undefined) {
			candidates.push(
				Object.freeze({
					directory,
					lineage: 'unknown' as Lineage,
					reading: `${directory} declares no framework this stage reads`,
				}),
			);
			continue;
		}
		const [lineage, name] = declared;
		const runtime =
			manifest !== null &&
			typeof manifest.dependencies === 'object' &&
			manifest.dependencies !== null &&
			Object.hasOwn(manifest.dependencies, name);
		candidates.push(
			Object.freeze({
				directory,
				lineage,
				reading: `${directory} declares ${lineage} ${dependencies[name] ?? ''} (${
					runtime ? 'dependencies' : 'devDependencies'
				}.${name})`,
			}),
		);
	}
	return Object.freeze(candidates);
}

export type FrontendRootReading = Readonly<{
	frontendRoot: string;
	frontendRootSource: ValueSource;
	frontendRootBasis: string;
}>;

/**
 * The frontend root, declared or read by lineage, or a named refusal.
 *
 * Position is never the answer. "The first subdirectory carrying a manifest" is
 * the default this stage exists to not take, and an acquired monorepo whose
 * repository root carries a server manifest is exactly the tree that default
 * gets wrong. Exactly one candidate declaring a framework is a reading with a
 * stated basis; zero and several are both refusals that name every directory
 * considered and what each of their manifests declared.
 *
 * This is exported because the reading is made once per run and used by every
 * stage that composes — `analyze`, `era-cell`, `plan` and `apply` all read the
 * frontend, and the acquisition root is only the unit of provenance.
 */
export async function readFrontendRoot(
	sourceRoot: string,
	declared: string | null,
): Promise<FrontendRootReading> {
	if (declared !== null) {
		if (!(await fileExists(path.join(sourceRoot, declared, 'package.json'))))
			refuse({
				code: 'ingest.declared-frontend-root-carries-no-manifest',
				message: `Ingest: --frontend-root ${declared} was declared and that directory carries no package.json. The frontend root is where the application's own manifest lives; this stage does not look elsewhere for it.`,
				stage: 'ingest',
				origin: 'pipeline',
			});
		return Object.freeze({
			frontendRoot: declared,
			frontendRootSource: 'declared' as const,
			frontendRootBasis: `--frontend-root ${declared} was declared. This stage read no lineage to choose it and considered no other directory.`,
		});
	}
	const candidates = await readFrontendCandidates(sourceRoot);
	const declaring = candidates.filter((candidate) => candidate.lineage !== 'unknown');
	const basis = candidates.map((candidate) => candidate.reading).join('; ');
	if (declaring.length === 1)
		return Object.freeze({
			frontendRoot: (declaring[0] as FrontendCandidate).directory,
			frontendRootSource: 'read' as const,
			frontendRootBasis: basis,
		});
	if (declaring.length > 1)
		refuse({
			code: 'ingest.frontend-root-lineage-ambiguous',
			message: `Ingest: ${String(declaring.length)} of the directories considered declare a framework this stage reads, so which one is the application is not something this stage reads: ${basis}. Declare it with --frontend-root <dir>.`,
			stage: 'ingest',
			origin: 'pipeline',
		});
	if (candidates.length === 0)
		refuse({
			code: 'ingest.frontend-root-not-found',
			message: `Ingest: neither ${sourceRoot} nor any of its immediate subdirectories carries a package.json, so this stage found no frontend to admit. Declare the directory with --frontend-root <dir> if the manifest sits deeper than one level.`,
			stage: 'ingest',
			origin: 'pipeline',
		});
	const subdirectories = candidates.filter((candidate) => candidate.directory !== '.');
	if (subdirectories.length > 1)
		refuse({
			code: 'ingest.frontend-root-ambiguous',
			message: `Ingest: ${String(subdirectories.length)} immediate subdirectories carry a package.json (${subdirectories
				.map((candidate) => candidate.directory)
				.join(', ')}), so which one is the application is not something this stage reads. Declare it with --frontend-root <dir>.`,
			stage: 'ingest',
			origin: 'pipeline',
		});
	refuse({
		code: 'ingest.frontend-root-declares-no-framework',
		message: `Ingest: none of the directories considered declares react, next or angular, so this stage read no frontend to admit: ${basis}. A directory carrying a manifest is not a frontend; declare the one that is with --frontend-root <dir>.`,
		stage: 'ingest',
		origin: 'pipeline',
	});
}

async function readTree(sourceRoot: string): Promise<IngestTreeReading> {
	const relatives = await workspacePathsBelow(sourceRoot, sourceRoot);
	const files: ExtractedFile[] = [];
	let bytes = 0;
	for (const relative of relatives) {
		const contents = await readFile(path.join(sourceRoot, relative));
		bytes += contents.byteLength;
		files.push({ path: relative, bytes: contents });
	}
	return Object.freeze({
		files: files.length,
		bytes,
		normalizedManifestSha256: normalizedManifest(files).sha256,
	});
}

/**
 * Admit an application source, or refuse by name.
 *
 * Nothing is written and nothing is fetched. What comes back is the record —
 * the same shape the per-application modules publish under `evidence/ingests/`,
 * derived rather than authored.
 */
export async function ingestApplicationSource(
	sourceRoot: string,
	declarations: IngestDeclarations = DEFAULT_INGEST_DECLARATIONS,
): Promise<IngestRecord> {
	if (!(await directoryExists(sourceRoot)))
		refuse({
			code: 'ingest.source-root-not-a-directory',
			message: `Ingest: the application source ${sourceRoot} is not a directory. This stage reads a source that is already on disk; it does not acquire one.`,
			stage: 'ingest',
			origin: 'pipeline',
		});

	const { frontendRoot, frontendRootSource, frontendRootBasis } = await readFrontendRoot(
		sourceRoot,
		declarations.frontendRoot,
	);
	const frontendDirectory = path.join(sourceRoot, frontendRoot);
	const manifestFile = path.join(frontendDirectory, 'package.json');

	const manifest = await readJsonFile(manifestFile);
	if (manifest === null)
		refuse({
			code: 'ingest.frontend-manifest-unreadable',
			message: `Ingest: ${path.join(frontendRoot, 'package.json')} is not readable as a JSON object, so nothing about this application's identity or its declared dependencies can be read from it.`,
			stage: 'ingest',
			origin: 'pipeline',
		});

	const frontendManifestPath = path.join(frontendRoot, 'package.json');
	const manifestName =
		typeof manifest.name === 'string' && manifest.name.trim() !== '' ? manifest.name.trim() : null;

	const tree = await readTree(sourceRoot);
	/**
	 * The journal is about the acquired tree, which is the enclosing baseline
	 * rather than the frontend when the two differ. The digest gate is applied
	 * to the tree the journal is about, and to no other.
	 */
	const lane = acquisitionLaneOf(sourceRoot);
	const walked =
		lane === null || lane.subPath === '.'
			? null
			: Object.freeze({ acquisitionRoot: lane.acquisitionRoot, subPath: lane.subPath });
	const acquisitionTree = walked === null ? tree : await readTree(walked.acquisitionRoot);
	const journal = await readAcquisitionJournal(sourceRoot, declarations.id ?? manifestName ?? '');

	let id: string;
	let idSource: ValueSource;
	let idReadFrom: string | null = null;
	if (declarations.id !== null) {
		id = declarations.id;
		idSource = 'declared';
	} else if (manifestName !== null) {
		id = manifestName;
		idSource = 'read';
		idReadFrom = `${frontendManifestPath}#name`;
	} else {
		const journalled =
			journal === null || lane === null
				? null
				: identifierOfAcquisitionJournal(
						journal.file,
						journal.document,
						acquisitionTree,
						lane,
						frontendManifestPath,
					);
		if (journalled === null)
			refuse({
				code: 'ingest.identifier-not-determined',
				message: `Ingest: ${frontendManifestPath} declares no name, so this application has no identity this stage read. The directory it happens to sit in is not an identity, and this flow does not use one as a substitute; declare it with --id <identifier>.`,
				stage: 'ingest',
				origin: 'pipeline',
			});
		id = journalled.id;
		idSource = 'read';
		idReadFrom = journalled.readFrom;
	}

	let commitSha: string;
	let commitShaSource: ValueSource;
	let commitShaReadFrom: string | null = null;
	/**
	 * The repository and the ref a journal reading adopted, when one happened.
	 * A declaration always wins over the reading below; these stay `null` when
	 * no journal was read, so the pin never carries a basis for a declared value.
	 */
	let journalledRepository: string | null = null;
	let journalledRef: string | null = null;
	let journalReadFrom: string | null = null;
	if (declarations.revision !== null) {
		commitSha = declarations.revision;
		commitShaSource = 'declared';
		if (!lowerHex40.test(commitSha))
			refuse({
				code: 'ingest.declared-revision-is-not-a-commit-sha',
				message: `Ingest: --revision ${commitSha} is not a 40-character lower-case hexadecimal commit sha. The pin is what the licence reading and every later record are relative to, so an abbreviated or symbolic revision is refused rather than resolved into one.`,
				stage: 'ingest',
				origin: 'pipeline',
			});
	} else {
		/**
		 * A checkout states its own revision. A tree the acquire stage fetched
		 * carries no Git metadata at all — the archive it reconciled has none —
		 * and the revision it was fetched at is in this pipeline's own journal,
		 * written under consent and gated on parity. Reading that journal is
		 * offline and it is a reading, not a declaration: without it every
		 * acquired application refuses here and an operator supplies the sha by
		 * hand, which is the manual step this flow exists to not have.
		 */
		let read: Readonly<{ commitSha: string; readFrom: string }> | null =
			await readGitRevision(sourceRoot);
		if (read === null && journal !== null) {
			const adopted = revisionOfAcquisitionJournal(
				journal.file,
				journal.document,
				acquisitionTree,
				walked,
			);
			read = adopted;
			journalledRepository = adopted.repository;
			journalledRef = adopted.ref;
			journalReadFrom = adopted.readFrom;
		}
		if (read === null)
			refuse({
				code: 'ingest.revision-not-determined',
				message: `Ingest: ${sourceRoot} carries no readable Git metadata and no acquisition journal of this pipeline's own names it, so the revision this source is pinned to is not something this stage read. An unpinned source has no revision for the licence reading or any later record to be relative to; declare it with --revision <commit-sha>.`,
				stage: 'ingest',
				origin: 'pipeline',
			});
		commitSha = read.commitSha;
		commitShaSource = 'read';
		commitShaReadFrom = read.readFrom;
	}

	const licence = await readLicenceAtPin(sourceRoot, manifestFile, declarations.licence);

	let lockfile: string | null = null;
	let closureReason: string | null = null;
	if (declarations.lockfile !== null) {
		lockfile = declarations.lockfile;
		if (!(await fileExists(path.join(frontendDirectory, lockfile))))
			refuse({
				code: 'ingest.declared-lockfile-absent',
				message: `Ingest: --lockfile ${lockfile} was declared and ${path.join(frontendRoot, lockfile)} does not exist. This stage reads the closure the declared lockfile pins; it does not fall back to another one.`,
				stage: 'ingest',
				origin: 'pipeline',
			});
	} else {
		for (const name of CLOSURE_LOCKFILES)
			if (lockfile === null && (await fileExists(path.join(frontendDirectory, name))))
				lockfile = name;
		if (lockfile === null) {
			const foreign: string[] = [];
			for (const name of Object.keys(FOREIGN_CLOSURE_LOCKFILES).sort())
				if (await fileExists(path.join(frontendDirectory, name))) foreign.push(name);
			closureReason =
				foreign.length > 0
					? `the frontend root carries ${foreign.join(', ')}, whose closure is pinned by ${foreign.map((name) => FOREIGN_CLOSURE_LOCKFILES[name] ?? 'another package manager').join(', ')}. This reading is of an npm lockfile and this flow does not translate it onto another package manager's format.`
					: `the frontend root carries none of ${CLOSURE_LOCKFILES.join(', ')}, so there is no recorded closure to read. The application's declared dependency ranges are in the detection above; what they resolve to is not established by this record.`;
		}
	}

	let closure: LegacyClosureRecord | null = null;
	if (lockfile !== null) {
		const packageBytes = await readFile(manifestFile);
		const lockBytes = await readFile(path.join(frontendDirectory, lockfile));
		try {
			closure = analyzeLegacyLockClosure(
				{ id, frontendRoot, lockFileName: lockfile },
				{ verifiedSourceRoot: frontendRoot, packageBytes, lockBytes },
			);
		} catch (error) {
			refuse({
				code: 'ingest.lockfile-closure-unreadable',
				message: `Ingest: ${path.join(frontendRoot, lockfile)} could not be read as a dependency closure — ${error instanceof Error ? error.message : String(error)}. A lockfile whose shape this reading does not recognise is refused rather than recorded as a closure it is not.`,
				stage: 'ingest',
				origin: 'pipeline',
			});
		}
	}

	return Object.freeze({
		stage: 'ingest',
		schemaVersion: INGEST_RECORD_SCHEMA,
		ran: true,
		reason: null,
		id,
		idSource,
		idReadFrom,
		frontendRoot,
		frontendRootSource,
		frontendRootBasis,
		acquisitionRoot: lane === null ? null : lane.acquisitionRoot,
		pin: Object.freeze({
			repository: declarations.repository ?? journalledRepository,
			repositoryReadFrom:
				declarations.repository === null && journalledRepository !== null
					? journalReadFrom
					: null,
			ref: declarations.ref ?? journalledRef,
			refReadFrom:
				declarations.ref === null && journalledRef !== null ? journalReadFrom : null,
			commitSha,
			commitShaSource,
			commitShaReadFrom,
		}),
		tree,
		detected: await analyzeApplication(frontendDirectory),
		licence,
		closure,
		closureReason,
		notEstablished: INGEST_NOT_ESTABLISHED,
	});
}

/** The ingest record as an operator reads it. */
export function renderIngest(record: IngestRecord): string {
	if (!record.ran) return `ingest: not run — ${record.reason ?? ''}\n`;
	const lines = [
		`application: ${record.id ?? ''} (${record.idSource ?? ''}${
			record.idReadFrom === null ? '' : ` from ${record.idReadFrom}`
		})`,
		`acquisition root: ${record.acquisitionRoot ?? 'not a lane baseline'}`,
		`frontend root: ${record.frontendRoot ?? ''} (${record.frontendRootSource ?? ''})`,
		`frontend root basis: ${record.frontendRootBasis ?? ''}`,
		`pinned revision: ${record.pin?.commitSha ?? ''} (${record.pin?.commitShaSource ?? ''}${
			record.pin?.commitShaReadFrom === null || record.pin?.commitShaReadFrom === undefined
				? ''
				: ` from ${record.pin.commitShaReadFrom}`
		})`,
		`repository: ${record.pin?.repository ?? 'not declared'}${
			record.pin?.repositoryReadFrom === null || record.pin?.repositoryReadFrom === undefined
				? ''
				: ` (read from ${record.pin.repositoryReadFrom})`
		}; ref: ${record.pin?.ref ?? 'not declared'}${
			record.pin?.refReadFrom === null || record.pin?.refReadFrom === undefined
				? ''
				: ` (read from ${record.pin.refReadFrom})`
		}`,
		`tree: ${String(record.tree?.files ?? 0)} file(s), ${String(record.tree?.bytes ?? 0)} byte(s), manifest ${(record.tree?.normalizedManifestSha256 ?? '').slice(0, 12)}`,
		`lineage: ${record.detected?.lineage ?? ''}; builder: ${record.detected?.builder ?? ''}; node era: ${record.detected?.nodeEra.declared ?? ''}`,
		`licence: ${record.licence?.identifier ?? ''} (${record.licence?.identifierSource ?? ''})`,
		record.closure === null
			? `closure: none — ${record.closureReason ?? ''}`
			: `closure: ${record.closure.lockState.file} — ${String(record.closure.counts.lockedPlacements)} placement(s), ${String(record.closure.counts.distinctNameVersionPairs)} distinct name@version`,
		'',
	];
	for (const line of [...record.notEstablished, ...(record.licence?.notEstablished ?? [])])
		lines.push(`not established: ${line}`);
	return `${lines.join('\n')}\n`;
}
