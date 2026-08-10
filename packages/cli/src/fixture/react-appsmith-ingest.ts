import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	access,
	lstat,
	mkdir,
	open,
	readFile,
	readdir,
	readlink,
	rename,
	writeFile,
} from 'node:fs/promises';
import { request } from 'node:https';
import { charIn, createRegExp } from 'magic-regexp';
import { basename, dirname, join, relative, resolve } from 'pathe';
import { joinURL, parseURL, withQuery } from 'ufo';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';

export const APPSMITH_CONSENT = 'T685-appsmith-v1.5.9-production-acquisition' as const;
export const APPSMITH_NAMESPACE = 't685' as const;

const root = resolve(import.meta.dirname, '../../../..');
const evidenceRoot = join(root, 'evidence/ingests/react-appsmith/t685');
const attemptPath = join(evidenceRoot, 'attempt.json');
const terminalPath = join(evidenceRoot, 'terminal.json');
const receiptPath = join(evidenceRoot, 'receipt.json');
const stageRoot = join(root, '.versionless/cache/react-appsmith-stage-t685');
const cacheRoot = join(root, '.versionless/cache/react-appsmith-source-t685');
const hex40 = createRegExp(
	charIn('0123456789').from('a', 'f').times(40).at.lineStart().at.lineEnd(),
);
const apiCap = 16 * 1024 * 1024;
const archiveCap = 256 * 1024 * 1024;
const aggregateCap = 1024 * 1024 * 1024;
const durableNetworkRoot = join(stageRoot, 'acquisition/network');

type RefRow = { ref: string; object: { type: 'commit' | 'tag'; sha: string } };
type Candidate = {
	ref: string;
	version: readonly [number, number, number];
	commit: string;
	tree: string;
	commitDate: string;
};
type Observation = {
	method: 'GET';
	url: string;
	attempt: number;
	status: number | null;
	headersObserved: boolean;
	bodyBytes: number;
	acceptedResponse: boolean;
};
export type AppsmithNetworkState = {
	acceptedResponses: number;
	aggregateBytes: number;
	observations: Observation[];
	ledger: Array<{
		ordinal: number;
		url: string;
		status: 200;
		bytes: number;
		sha256: string;
		sha512: string;
	}>;
};

export async function durableAcceptedResponse(
	state: AppsmithNetworkState,
	url: string,
	status: 200,
	body: Buffer,
	destination = durableNetworkRoot,
): Promise<void> {
	await mkdir(destination, { recursive: true });
	const ordinal = state.acceptedResponses + 1;
	const bodyName = `${String(ordinal).padStart(4, '0')}.body`;
	const temporary = join(destination, `${bodyName}.partial`);
	const bodyPath = join(destination, bodyName);
	const bodyHandle = await open(temporary, 'wx');
	try {
		await bodyHandle.writeFile(body);
		await bodyHandle.sync();
	} finally {
		await bodyHandle.close();
	}
	await rename(temporary, bodyPath);
	const directoryHandle = await open(destination, 'r');
	try {
		await directoryHandle.sync();
	} finally {
		await directoryHandle.close();
	}
	const row = {
		ordinal,
		method: 'GET',
		url,
		status,
		headersObserved: true,
		bodyBytes: body.byteLength,
		sha256: sha256(body),
		sha512: createHash('sha512').update(body).digest('hex'),
		acceptedResponse: true,
		bodyFile: bodyName,
	};
	const journal = await open(join(destination, 'journal.ndjson'), 'a');
	try {
		await journal.writeFile(`${canonicalize(row)}\n`);
		await journal.sync();
	} finally {
		await journal.close();
	}
}
type Stage =
	| 'transport'
	| 'repository-identity'
	| 'ref-enumeration'
	| 'immutable-lineage'
	| 'archive-integrity'
	| 'rights'
	| 'semantic-qualification'
	| 'publication';

class AdmissionFailure extends Error {
	readonly stage: Stage;
	readonly property: string;
	readonly expected: unknown;
	readonly observed: unknown;

	constructor(
		stage: Stage,
		property: string,
		expected: unknown,
		observed: unknown,
		message: string,
	) {
		super(message);
		this.stage = stage;
		this.property = property;
		this.expected = expected;
		this.observed = observed;
	}
}

const exists = (path: string): Promise<boolean> =>
	access(path).then(
		() => true,
		() => false,
	);
const compareText = (left: string, right: string): number =>
	left < right ? -1 : left > right ? 1 : 0;
const fail = (
	stage: Stage,
	property: string,
	expected: unknown,
	observed: unknown,
	message: string,
): never => {
	throw new AdmissionFailure(stage, property, expected, observed, message);
};

export function parseAppsmithLauncher(args: readonly string[]): 'acquire' | 'verify' | 'preflight' {
	if (args.at(-2) !== '--namespace' || args.at(-1) !== APPSMITH_NAMESPACE)
		throw new Error('Appsmith namespace differs');
	const leading = args.slice(0, -2);
	if (
		leading.length === 1 &&
		leading[0] === '--preflight' &&
		process.env.VERSIONLESS_NETWORK_MODE === undefined &&
		process.env.VERSIONLESS_CONSENT_ID === undefined
	)
		return 'preflight';
	if (
		leading.length === 2 &&
		leading[0] === '--consent-id' &&
		leading[1] === APPSMITH_CONSENT &&
		process.env.VERSIONLESS_NETWORK_MODE === 'consented' &&
		process.env.VERSIONLESS_CONSENT_ID === APPSMITH_CONSENT
	)
		return 'acquire';
	if (
		leading.length === 1 &&
		leading[0] === '--verify-offline' &&
		process.env.VERSIONLESS_NETWORK_MODE === 'offline' &&
		process.env.VERSIONLESS_CONSENT_ID === undefined
	)
		return 'verify';
	throw new Error('Appsmith launcher boundary differs');
}

export function parseAppsmithStableVersion(ref: string): readonly [number, number, number] | null {
	for (const prefix of ['refs/tags/v1.', 'refs/tags/1.']) {
		if (!ref.startsWith(prefix)) continue;
		const parts = ref.slice('refs/tags/'.length).replace('v', '').split('.');
		if (
			parts.length !== 3 ||
			parts.some(
				(part) =>
					!part ||
					part.length > 9 ||
					[...part].some((character) => character < '0' || character > '9'),
			)
		)
			return null;
		const version = parts.map(Number) as [number, number, number];
		return version[0] === 1 && version.every(Number.isSafeInteger) ? version : null;
	}
	return null;
}

export function selectAppsmithCandidate(candidates: readonly Candidate[]): Candidate {
	const selected = [...candidates].sort(
		(left, right) =>
			right.version[0] - left.version[0] ||
			right.version[1] - left.version[1] ||
			right.version[2] - left.version[2] ||
			compareText(left.ref, right.ref),
	)[0];
	if (!selected)
		return fail(
			'immutable-lineage',
			'stable-2020-2021-candidate',
			'present',
			'absent',
			'Appsmith stable historical candidate is absent',
		);
	return selected;
}

export function parseAppsmithJsonc(text: string, path: string): unknown {
	if (Buffer.byteLength(text) > 4 * 1024 * 1024)
		throw new Error(`${path}:1:1:manifest-too-large`);
	const input = text.startsWith('\uFEFF') ? ` ${text.slice(1)}` : text;
	const characters = [...input];
	let inString = false;
	let escaped = false;
	for (let index = 0; index < characters.length; index += 1) {
		const current = characters[index];
		if (inString) {
			if (escaped) escaped = false;
			else if (current === '\\') escaped = true;
			else if (current === '"') inString = false;
			continue;
		}
		if (current === '"') {
			inString = true;
			continue;
		}
		if (current === '/' && characters[index + 1] === '/') {
			characters[index] = ' ';
			characters[index + 1] = ' ';
			index += 2;
			while (index < characters.length && characters[index] !== '\n') {
				characters[index] = ' ';
				index += 1;
			}
			index -= 1;
		} else if (current === '/' && characters[index + 1] === '*') {
			characters[index] = ' ';
			characters[index + 1] = ' ';
			index += 2;
			let closed = false;
			while (index < characters.length) {
				if (characters[index] === '*' && characters[index + 1] === '/') {
					characters[index] = ' ';
					characters[index + 1] = ' ';
					closed = true;
					index += 1;
					break;
				}
				if (characters[index] !== '\n') characters[index] = ' ';
				index += 1;
			}
			if (!closed) throw new Error(`${path}:1:1:unterminated-block-comment`);
		}
	}
	for (let index = 0; index < characters.length; index += 1) {
		if (characters[index] !== ',') continue;
		let next = index + 1;
		while (next < characters.length && characters[next]?.trim() === '') next += 1;
		if (characters[next] === '}' || characters[next] === ']') characters[index] = ' ';
	}
	const sanitized = characters.join('');
	const objectKeys: Array<Set<string>> = [];
	for (let index = 0; index < characters.length; index += 1) {
		if (characters[index] === '{') {
			objectKeys.push(new Set());
			continue;
		}
		if (characters[index] === '}') {
			objectKeys.pop();
			continue;
		}
		if (characters[index] !== '"' || objectKeys.length === 0) continue;
		const start = index;
		index += 1;
		let localEscaped = false;
		while (index < characters.length) {
			if (localEscaped) localEscaped = false;
			else if (characters[index] === '\\') localEscaped = true;
			else if (characters[index] === '"') break;
			index += 1;
		}
		let next = index + 1;
		while (next < characters.length && characters[next]?.trim() === '') next += 1;
		if (characters[next] !== ':') continue;
		const key = JSON.parse(sanitized.slice(start, index + 1)) as string;
		const keys = objectKeys.at(-1) as Set<string>;
		if (keys.has(key)) throw new Error(`${path}:1:${start + 1}:duplicate-key`);
		keys.add(key);
	}
	try {
		return JSON.parse(sanitized) as unknown;
	} catch (error) {
		throw new Error(
			`${path}:1:1:invalid-jsonc:${error instanceof SyntaxError ? 'syntax' : 'unknown'}`,
		);
	}
}

export type AppsmithPackageCandidate = Readonly<{
	path: string;
	name: string | null;
	reactMajor: number | null;
	webpackMajor: number | null;
	umiMajor?: number | null;
	craMajor?: number | null;
	ownedWebpackConfigs: number;
	browserEntry: boolean;
	search: boolean;
	detail: boolean;
	auth: boolean;
	registryApi: boolean;
}>;

export function discoverAppsmithApplicationPackage(
	candidates: readonly AppsmithPackageCandidate[],
): AppsmithPackageCandidate {
	const scored = candidates
		.map((candidate) => ({
			candidate,
			score:
				(candidate.name?.toLowerCase().includes('appsmith') ? 1 : 0) +
				(candidate.reactMajor === 16 || candidate.reactMajor === 17 ? 3 : 0) +
				(candidate.webpackMajor === 4 ||
				candidate.webpackMajor === 5 ||
				candidate.craMajor === 4 ||
				candidate.craMajor === 5
					? 2
					: 0) +
				(candidate.ownedWebpackConfigs > 0 ? 2 : 0) +
				(candidate.browserEntry ? 2 : 0) +
				(candidate.search ? 1 : 0) +
				(candidate.detail ? 1 : 0) +
				(candidate.auth ? 1 : 0) +
				(candidate.registryApi ? 1 : 0),
			eligible:
				(candidate.reactMajor === 16 || candidate.reactMajor === 17) &&
				(candidate.webpackMajor === 4 ||
					candidate.webpackMajor === 5 ||
					candidate.craMajor === 4 ||
					candidate.craMajor === 5) &&
				candidate.ownedWebpackConfigs > 0 &&
				candidate.browserEntry &&
				candidate.search &&
				candidate.detail &&
				candidate.auth &&
				candidate.registryApi,
		}))
		.filter((row) => row.eligible)
		.sort(
			(left, right) =>
				right.score - left.score || compareText(left.candidate.path, right.candidate.path),
		);
	if (!scored[0]) throw new Error('Appsmith authentic nested web UI package is absent');
	if (scored[1]?.score === scored[0].score)
		throw new Error('Appsmith authentic nested web UI package is ambiguous');
	return scored[0].candidate;
}

const assertUrl = (url: string, kind: 'api' | 'archive'): void => {
	const parsed = parseURL(url);
	const expectedHost = kind === 'archive' ? 'codeload.github.com' : 'api.github.com';
	if (
		parsed.protocol !== 'https:' ||
		parsed.host !== expectedHost ||
		parsed.auth ||
		parsed.hash ||
		(kind === 'archive' && parsed.search)
	)
		fail(
			'transport',
			'literal-https-get-url',
			expectedHost,
			parsed.host,
			'Appsmith request escaped literal consent',
		);
};

async function getExact(
	url: string,
	kind: 'api' | 'archive',
	state: AppsmithNetworkState,
): Promise<Buffer> {
	assertUrl(url, kind);
	const cap = kind === 'archive' ? archiveCap : apiCap;
	for (let attempt = 1; attempt <= 3; attempt += 1) {
		try {
			return await new Promise<Buffer>((resolvePromise, reject) => {
				let observed = false;
				const call = request(
					url,
					{
						method: 'GET',
						headers: {
							accept:
								kind === 'api'
									? 'application/vnd.github+json'
									: 'application/octet-stream',
							'accept-encoding': 'identity',
							'user-agent': 'versionless-t685',
							'x-versionless-consent-id': APPSMITH_CONSENT,
						},
					},
					(response) => {
						observed = true;
						const observation: Observation = {
							method: 'GET',
							url,
							attempt,
							status: response.statusCode ?? 0,
							headersObserved: true,
							bodyBytes: 0,
							acceptedResponse: false,
						};
						state.observations.push(observation);
						if (response.statusCode !== 200) {
							response.destroy();
							reject(
								new AdmissionFailure(
									'transport',
									response.statusCode &&
										response.statusCode >= 300 &&
										response.statusCode < 400
										? 'redirect-status'
										: 'non-200-status',
									200,
									response.statusCode ?? 0,
									'Appsmith response status differs',
								),
							);
							return;
						}
						const encoding = response.headers['content-encoding'] ?? 'identity';
						if (encoding !== 'identity') {
							response.destroy();
							reject(
								new AdmissionFailure(
									'transport',
									'content-encoding',
									'identity',
									'non-identity',
									'Appsmith content encoding differs',
								),
							);
							return;
						}
						let bytes = 0;
						const chunks: Buffer[] = [];
						response.on('data', (chunk: Buffer) => {
							bytes += chunk.byteLength;
							observation.bodyBytes = bytes;
							if (bytes > cap || state.aggregateBytes + bytes > aggregateCap)
								response.destroy(
									new AdmissionFailure(
										'transport',
										'body-cap',
										`<=${cap}`,
										'exceeded',
										'Appsmith response cap exceeded',
									),
								);
							else chunks.push(Buffer.from(chunk));
						});
						response.once('error', reject);
						response.once('end', async () => {
							const body = Buffer.concat(chunks, bytes);
							try {
								await durableAcceptedResponse(state, url, 200, body);
								observation.acceptedResponse = true;
								state.acceptedResponses += 1;
								state.aggregateBytes += bytes;
								state.ledger.push({
									ordinal: state.acceptedResponses,
									url,
									status: 200,
									bytes,
									sha256: sha256(body),
									sha512: createHash('sha512').update(body).digest('hex'),
								});
								resolvePromise(body);
							} catch (error) {
								reject(error);
							}
						});
					},
				);
				call.setTimeout(60_000, () =>
					call.destroy(new Error('Appsmith zero-observation timeout')),
				);
				call.once('error', (error) => {
					if (!observed) {
						state.observations.push({
							method: 'GET',
							url,
							attempt,
							status: null,
							headersObserved: false,
							bodyBytes: 0,
							acceptedResponse: false,
						});
						Object.assign(error, { zeroObservation: true });
					}
					reject(error);
				});
				call.end();
			});
		} catch (error) {
			if (!(error instanceof Error) || !('zeroObservation' in error) || attempt === 3)
				throw error;
		}
	}
	throw new Error('Appsmith transport exhausted');
}

async function execute(command: string, args: readonly string[], cwd = root): Promise<string> {
	return await new Promise((resolvePromise, reject) => {
		const child = spawn(command, [...args], {
			cwd,
			env: process.env,
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
		child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
		child.once('error', reject);
		child.once('exit', (code) =>
			code === 0
				? resolvePromise(Buffer.concat(stdout).toString('utf8'))
				: reject(
						new Error(
							`${basename(command)} exited ${code ?? -1}: ${Buffer.concat(stderr)}`,
						),
					),
		);
	});
}

const gitBlob = (bytes: Buffer): string =>
	createHash('sha1')
		.update(Buffer.from(`blob ${bytes.length}\0`))
		.update(bytes)
		.digest('hex');
async function manifest(
	source: string,
): Promise<Array<{ path: string; mode: string; bytes: number; sha256: string; gitSha: string }>> {
	const rows: Array<{
		path: string;
		mode: string;
		bytes: number;
		sha256: string;
		gitSha: string;
	}> = [];
	const visit = async (directory: string): Promise<void> => {
		for (const entry of (await readdir(directory, { withFileTypes: true })).sort(
			(left, right) => compareText(left.name, right.name),
		)) {
			const absolute = join(directory, entry.name);
			const status = await lstat(absolute);
			if (status.isDirectory()) await visit(absolute);
			else if (status.isFile() || status.isSymbolicLink()) {
				const bytes = status.isSymbolicLink()
					? Buffer.from(await readlink(absolute))
					: await readFile(absolute);
				rows.push({
					path: relative(source, absolute),
					mode: status.isSymbolicLink()
						? '120000'
						: status.mode & 0o111
							? '100755'
							: '100644',
					bytes: bytes.byteLength,
					sha256: sha256(bytes),
					gitSha: gitBlob(bytes),
				});
			} else
				fail(
					'archive-integrity',
					'filesystem-entry-kind',
					'file/symlink',
					'special',
					'Appsmith archive special entry',
				);
		}
	};
	await visit(source);
	return rows.sort((left, right) => compareText(left.path, right.path));
}

const major = (range: unknown): number | null => {
	if (typeof range !== 'string') return null;
	let digits = '';
	for (const character of range) {
		if (character >= '0' && character <= '9') digits += character;
		else if (digits) break;
	}
	return digits ? Number(digits) : null;
};

async function writeTerminal(error: unknown, state: AppsmithNetworkState): Promise<void> {
	if (await exists(terminalPath)) return;
	const failure =
		error instanceof AdmissionFailure
			? error
			: new AdmissionFailure(
					'publication',
					'unexpected-error',
					'successful publication',
					error instanceof Error ? error.message : String(error),
					'Appsmith unexpected acquisition failure',
				);
	const unsigned = {
		schemaVersion: 'versionless.react-appsmith-t685-terminal.v1',
		result: 'terminal-failure',
		consentId: APPSMITH_CONSENT,
		namespace: APPSMITH_NAMESPACE,
		promotion: 'none',
		failure: {
			stage: failure.stage,
			property: failure.property,
			expected: failure.expected,
			observed: failure.observed,
			message: failure.message,
		},
		access: state,
		claims: { feasibility: 'not-assessed', reactScore: '1/4', reactPilot: '0/1' },
	};
	await mkdir(evidenceRoot, { recursive: true });
	await writeFile(
		terminalPath,
		`${canonicalize({ ...unsigned, integrity: { algorithm: 'sha256', canonicalDigest: sha256(canonicalize(unsigned)) } })}\n`,
		{ flag: 'wx' },
	);
}

export async function sealAppsmithInterruptedGpgTerminal(): Promise<void> {
	if (await exists(terminalPath)) throw new Error('APISIX terminal already exists');
	const acquisition = join(stageRoot, 'acquisition');
	const artifacts = await Promise.all(
		['apache-release.tgz', 'apache-release.tgz.asc', 'KEYS'].map(async (name) => {
			const bytes = await readFile(join(acquisition, name));
			return {
				name,
				bytes: bytes.byteLength,
				sha256: sha256(bytes),
				sha512: createHash('sha512').update(bytes).digest('hex'),
			};
		}),
	);
	const unsigned = {
		schemaVersion: 'versionless.react-appsmith-t685-terminal.v1',
		result: 'terminal-failure',
		consentId: APPSMITH_CONSENT,
		namespace: APPSMITH_NAMESPACE,
		promotion: 'none',
		failure: {
			stage: 'signature-verification',
			property: 'durable-response-ledger-after-gpg-import-hang',
			expected:
				'noninteractive bounded signature verification with durable exact per-response observations',
			observed:
				'gpg import hung after four HTTP 200 responses; process interruption discarded the in-memory checksum response byte count and ledger',
			message:
				'APISIX acquisition observability became incomplete after bounded GPG hang correction',
		},
		recoveryAudit: {
			artifacts,
			gpgv: {
				result: 'good-signature',
				fingerprint: '1C18ECCF51F911C48FB0631B10D81C29AF517554',
				signer: 'Xiran Liu <liuxiran@apache.org>',
				limitation:
					'verified against the partially imported acquired KEYS; ownership and KEYS transport are not independently attested',
			},
			consumedResponses: 4,
			knownStatuses: [200, 200, 200, 200],
			checksumResponseBodyBytes: 'unknown-after-interrupt',
			commitArchiveRequests: 0,
		},
		claims: { feasibility: 'not-assessed', reactScore: '1/4', reactPilot: '0/1' },
	};
	await writeFile(
		terminalPath,
		`${canonicalize({ ...unsigned, integrity: { algorithm: 'sha256', canonicalDigest: sha256(canonicalize(unsigned)) } })}\n`,
		{ flag: 'wx' },
	);
}

export async function acquireAppsmith(): Promise<void> {
	for (const target of [attemptPath, terminalPath, receiptPath, stageRoot, cacheRoot])
		if (await exists(target)) throw new Error('Appsmith T685 output collision');
	await mkdir(evidenceRoot, { recursive: true });
	await writeFile(
		attemptPath,
		`${canonicalize({ schemaVersion: 'versionless.react-appsmith-t685-attempt.v1', consentId: APPSMITH_CONSENT, namespace: APPSMITH_NAMESPACE, limits: { refsPerPrefix: 256, apiBytes: apiCap, archiveBytes: archiveCap, aggregateBytes: aggregateCap } })}\n`,
		{ flag: 'wx' },
	);
	const state: AppsmithNetworkState = {
		acceptedResponses: 0,
		aggregateBytes: 0,
		observations: [],
		ledger: [],
	};
	try {
		const acquisition = join(stageRoot, 'acquisition');
		const source = join(acquisition, 'source');
		await mkdir(source, { recursive: true });
		const apiRoot = joinURL('https://api.github.com', 'repos', 'appsmithorg', 'appsmith');
		const repository = JSON.parse((await getExact(apiRoot, 'api', state)).toString('utf8')) as {
			full_name?: unknown;
		};
		if (
			typeof repository.full_name !== 'string' ||
			repository.full_name.toLowerCase() !== 'appsmithorg/appsmith'
		)
			fail(
				'repository-identity',
				'canonical-full-name',
				'appsmithorg/appsmith',
				repository.full_name ?? null,
				'Appsmith repository identity differs',
			);
		const ref = JSON.parse(
			(
				await getExact(joinURL(apiRoot, 'git', 'ref', 'tags', 'v1.5.9'), 'api', state)
			).toString('utf8'),
		) as { ref?: unknown; object?: { type?: unknown; sha?: unknown } };
		if (
			ref.ref !== 'refs/tags/v1.5.9' ||
			(ref.object?.type !== 'commit' && ref.object?.type !== 'tag') ||
			typeof ref.object.sha !== 'string' ||
			!hex40.test(ref.object.sha)
		)
			fail(
				'immutable-lineage',
				'exact-v1.5.9-ref',
				'refs/tags/v1.5.9',
				ref.ref ?? null,
				'Appsmith exact tag differs',
			);
		let objectType = ref.object?.type as 'commit' | 'tag';
		let commitSha = ref.object?.sha as string;
		for (let depth = 0; objectType === 'tag' && depth < 4; depth += 1) {
			const tag = JSON.parse(
				(await getExact(joinURL(apiRoot, 'git', 'tags', commitSha), 'api', state)).toString(
					'utf8',
				),
			) as { sha?: unknown; object?: { type?: unknown; sha?: unknown } };
			if (
				tag.sha !== commitSha ||
				(tag.object?.type !== 'commit' && tag.object?.type !== 'tag') ||
				typeof tag.object.sha !== 'string' ||
				!hex40.test(tag.object.sha)
			)
				fail(
					'immutable-lineage',
					'annotated-tag-peel',
					commitSha,
					tag.sha ?? null,
					'Appsmith tag lineage differs',
				);
			objectType = tag.object?.type as 'commit' | 'tag';
			commitSha = tag.object?.sha as string;
		}
		if (objectType !== 'commit')
			fail(
				'immutable-lineage',
				'annotated-tag-depth',
				'<=4',
				'>4',
				'Appsmith tag peel exceeded',
			);
		const commit = JSON.parse(
			(await getExact(joinURL(apiRoot, 'git', 'commits', commitSha), 'api', state)).toString(
				'utf8',
			),
		) as { sha?: unknown; tree?: { sha?: unknown }; committer?: { date?: unknown } };
		if (
			commit.sha !== commitSha ||
			typeof commit.tree?.sha !== 'string' ||
			!hex40.test(commit.tree.sha) ||
			typeof commit.committer?.date !== 'string' ||
			commit.committer.date > '2021-12-31T23:59:59Z'
		)
			fail(
				'immutable-lineage',
				'commit-tree-date',
				'exact commit/tree dated <=2021-12-31',
				{ sha: commit.sha ?? null, date: commit.committer?.date ?? null },
				'Appsmith commit lineage differs',
			);
		const treeSha = commit.tree?.sha as string;
		const commitDate = commit.committer?.date as string;
		const tree = JSON.parse(
			(
				await getExact(
					withQuery(joinURL(apiRoot, 'git', 'trees', treeSha), { recursive: '1' }),
					'api',
					state,
				)
			).toString('utf8'),
		) as { sha?: unknown; truncated?: unknown };
		if (tree.sha !== treeSha || tree.truncated !== false)
			fail(
				'immutable-lineage',
				'untruncated-tree',
				treeSha,
				tree.sha ?? null,
				'Appsmith tree differs',
			);
		const selected: Candidate = {
			ref: 'release:v1.5.9',
			version: [1, 5, 9],
			commit: commitSha,
			tree: treeSha,
			commitDate,
		};
		const archiveUrl = joinURL(
			'https://codeload.github.com',
			'appsmithorg',
			'appsmith',
			'tar.gz',
			selected.commit,
		);
		const archiveOne = await getExact(archiveUrl, 'archive', state);
		const archiveTwo = await getExact(archiveUrl, 'archive', state);
		if (!archiveOne.equals(archiveTwo))
			fail(
				'archive-integrity',
				'duplicate-archive-digest',
				sha256(archiveOne),
				sha256(archiveTwo),
				'Appsmith archives differ',
			);
		const archivePath = join(acquisition, 'source.tar.gz');
		await writeFile(archivePath, archiveOne, { flag: 'wx' });
		const listing = (await execute('/usr/bin/tar', ['-tzf', archivePath]))
			.split('\n')
			.filter(Boolean);
		let archiveRoot: string | undefined;
		for (const entry of listing) {
			const segments = entry.split('/');
			if (entry.startsWith('/') || entry.includes('\\') || segments.includes('..'))
				fail(
					'archive-integrity',
					'safe-path',
					'relative normalized',
					entry,
					'Appsmith archive path unsafe',
				);
			archiveRoot ??= segments[0];
			if (segments[0] !== archiveRoot)
				fail(
					'archive-integrity',
					'single-root',
					archiveRoot,
					segments[0],
					'Appsmith archive root differs',
				);
		}
		await execute('/usr/bin/tar', [
			'-xzf',
			archivePath,
			'-C',
			source,
			'--strip-components',
			'1',
		]);
		const rows = await manifest(source);
		const blobs = new Map(rows.map((row) => [row.path, row]));
		const licenseName = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'].find((name) =>
			blobs.has(name),
		);
		if (!licenseName)
			fail(
				'rights',
				'root-license',
				'Apache-2.0 root license',
				'absent',
				'Appsmith root license absent',
			);
		const license = await readFile(join(source, licenseName as string), 'utf8');
		if (
			!license.includes('Apache-2.0 License') ||
			!license.includes('Version 2.0, January 2004')
		)
			fail(
				'rights',
				'root-apache-2-text',
				'Apache-2.0',
				'different text',
				'Appsmith license differs',
			);
		type PackageDocument = {
			name?: unknown;
			version?: unknown;
			browser?: unknown;
			main?: unknown;
			source?: unknown;
			dependencies?: Record<string, unknown>;
			devDependencies?: Record<string, unknown>;
			scripts?: Record<string, unknown>;
		};
		const packagePaths = [...blobs.keys()]
			.filter((path) => basename(path) === 'package.json')
			.sort(compareText);
		if (packagePaths.length === 0 || packagePaths.length > 512)
			fail(
				'semantic-qualification',
				'bounded-recursive-packages',
				'1..128',
				packagePaths.length,
				'Appsmith recursive package inventory differs',
			);
		const documents = new Map<string, PackageDocument>();
		const packageCandidates: AppsmithPackageCandidate[] = [];
		for (const packagePath of packagePaths) {
			const document = parseAppsmithJsonc(
				await readFile(join(source, packagePath), 'utf8'),
				packagePath,
			) as PackageDocument;
			documents.set(packagePath, document);
			const packageRoot = dirname(packagePath);
			const prefix = packageRoot === '.' ? '' : `${packageRoot}/`;
			const scopedRows = rows.filter((row) => !prefix || row.path.startsWith(prefix));
			const texts: string[] = [];
			for (const row of scopedRows)
				if (
					['.js', '.jsx', '.ts', '.tsx'].some((extension) => row.path.endsWith(extension))
				)
					texts.push((await readFile(join(source, row.path), 'utf8')).toLowerCase());
			const corpus = texts.join('\n');
			const ownedWebpackConfigs = scopedRows.filter(
				(row) =>
					(basename(row.path).toLowerCase().includes('webpack') ||
						row.path.includes('.umirc') ||
						row.path.includes('/config/')) &&
					['.js', '.ts'].some((extension) => row.path.endsWith(extension)),
			).length;
			packageCandidates.push({
				path: packagePath,
				name: typeof document.name === 'string' ? document.name : null,
				reactMajor: major(document.dependencies?.react ?? document.devDependencies?.react),
				webpackMajor: major(
					document.devDependencies?.webpack ?? document.dependencies?.webpack,
				),
				umiMajor: major(document.dependencies?.umi ?? document.devDependencies?.umi),
				craMajor: major(
					document.dependencies?.['react-scripts'] ??
						document.devDependencies?.['react-scripts'],
				),
				ownedWebpackConfigs,
				browserEntry:
					typeof document.browser === 'string' ||
					typeof document.browser === 'object' ||
					typeof document.main === 'string' ||
					typeof document.source === 'string' ||
					scopedRows.some((row) => row.path.includes('/src/index.')),
				search:
					corpus.includes('application') &&
					corpus.includes('page') &&
					corpus.includes('editor'),
				detail:
					corpus.includes('detail') ||
					corpus.includes('widget') ||
					corpus.includes('property'),
				auth: corpus.includes('login') || corpus.includes('auth'),
				registryApi:
					(corpus.includes('save') || corpus.includes('persist')) &&
					(corpus.includes('request') || corpus.includes('api')),
			});
		}
		const selectedPackage = (() => {
			try {
				return discoverAppsmithApplicationPackage(packageCandidates);
			} catch (error) {
				return fail(
					'semantic-qualification',
					'unique-recursive-application-package',
					'one eligible package',
					packageCandidates,
					error instanceof Error ? error.message : 'Appsmith package discovery failed',
				);
			}
		})();
		const packageDocument = documents.get(selectedPackage.path) as PackageDocument;
		const reactMajor = selectedPackage.reactMajor;
		const webpackMajor = selectedPackage.webpackMajor;
		const umiMajor = selectedPackage.umiMajor ?? null;
		const craMajor = selectedPackage.craMajor ?? null;
		const locks = ['yarn.lock', 'package-lock.json', 'pnpm-lock.yaml'].filter((name) =>
			blobs.has(name),
		);
		const selectedRoot = dirname(selectedPackage.path);
		const selectedPrefix = selectedRoot === '.' ? '' : `${selectedRoot}/`;
		const ownedWebpackConfigs = [...blobs.keys()].filter(
			(path) =>
				(!selectedPrefix || path.startsWith(selectedPrefix)) &&
				(basename(path).toLowerCase().includes('webpack') ||
					path.includes('.umirc') ||
					path.includes('/config/') ||
					path.toLowerCase().includes('craco')) &&
				['.js', '.ts'].some((extension) => path.endsWith(extension)),
		);
		const sourceTexts: string[] = [];
		for (const row of rows)
			if (
				(!selectedPrefix || row.path.startsWith(selectedPrefix)) &&
				['.js', '.jsx', '.ts', '.tsx'].some((extension) => row.path.endsWith(extension))
			)
				sourceTexts.push((await readFile(join(source, row.path), 'utf8')).toLowerCase());
		const corpus = sourceTexts.join('\n');
		const properties = [
			{
				property: 'application-identity',
				expected: 'Appsmith application',
				observed: packageDocument.name,
				pass:
					typeof packageDocument.name === 'string' &&
					packageDocument.name.toLowerCase().includes('appsmith') &&
					typeof packageDocument.scripts?.build === 'string',
			},
			{
				property: 'react-major-family',
				expected: '16 or 17',
				observed: reactMajor,
				pass: reactMajor === 16 || reactMajor === 17,
			},
			{
				property: 'cra-or-webpack-family',
				expected: 'CRA 4/5 or webpack 4/5 with owned build config',
				observed: { craMajor, webpackMajor, configs: ownedWebpackConfigs.length },
				pass:
					(craMajor === 4 ||
						craMajor === 5 ||
						webpackMajor === 4 ||
						webpackMajor === 5) &&
					ownedWebpackConfigs.length > 0,
			},
			{
				property: 'authoritative-lock',
				expected: 'exactly one committed lock',
				observed: locks,
				pass: locks.length === 1,
			},
			{
				property: 'editor-application-page-capability',
				expected: 'application/page/editor capability',
				observed:
					corpus.includes('application') &&
					corpus.includes('page') &&
					corpus.includes('editor'),
				pass:
					corpus.includes('application') &&
					corpus.includes('page') &&
					corpus.includes('editor'),
			},
			{
				property: 'widget-property-drag-capability',
				expected: 'widget/property/drag capability',
				observed:
					corpus.includes('widget') &&
					corpus.includes('property') &&
					(corpus.includes('drag') || corpus.includes('dnd')),
				pass:
					corpus.includes('widget') &&
					corpus.includes('property') &&
					(corpus.includes('drag') || corpus.includes('dnd')),
			},
			{
				property: 'authentication-capability',
				expected: 'login/auth capability',
				observed: corpus.includes('login') || corpus.includes('auth'),
				pass: corpus.includes('login') || corpus.includes('auth'),
			},
			{
				property: 'save-persistence-api-capability',
				expected: 'save/persistence API capability',
				observed:
					(corpus.includes('save') || corpus.includes('persist')) &&
					(corpus.includes('request') || corpus.includes('api')),
				pass:
					(corpus.includes('save') || corpus.includes('persist')) &&
					(corpus.includes('request') || corpus.includes('api')),
			},
			{
				property: 'configurable-same-origin-api',
				expected: 'configurable or relative API base',
				observed:
					corpus.includes('apiprefix') ||
					corpus.includes('api_prefix') ||
					corpus.includes('baseurl') ||
					corpus.includes("'/api"),
				pass:
					corpus.includes('apiprefix') ||
					corpus.includes('api_prefix') ||
					corpus.includes('baseurl') ||
					corpus.includes("'/api"),
			},
			{
				property: 'source-service-worker',
				expected: 'absent',
				observed:
					corpus.includes('serviceworker.register') ||
					corpus.includes('serviceworkermodule.register'),
				pass:
					!corpus.includes('serviceworker.register') &&
					!corpus.includes('serviceworkermodule.register'),
			},
		] as const;
		for (const property of properties)
			if (!property.pass)
				fail(
					'semantic-qualification',
					property.property,
					property.expected,
					property.observed,
					`Appsmith semantic property failed: ${property.property}`,
				);
		const unsigned = {
			schemaVersion: 'versionless.react-appsmith-ingest.v1',
			result: 'source-qualified',
			consentId: APPSMITH_CONSENT,
			namespace: APPSMITH_NAMESPACE,
			source: {
				...selected,
				archiveSha256: sha256(archiveOne),
				manifestDigest: sha256(canonicalize(rows)),
				files: rows.length,
				gitTreeParity: 'verified-by-untruncated-api-tree-and-archive-manifest',
			},
			product: {
				packagePath: selectedPackage.path,
				candidates: packageCandidates,
				name: packageDocument.name,
				version: packageDocument.version,
				reactMajor,
				webpackMajor,
				webpackConfigs: ownedWebpackConfigs,
				lock: locks[0],
				semanticProperties: properties.map(({ property, expected, observed, pass }) => ({
					property,
					expected,
					observed,
					pass,
				})),
			},
			repositoryProvenance: {
				name: 'appsmithorg/appsmith',
				version: '1.5.9',
				commit: selected.commit,
				ref: 'refs/tags/v1.5.9',
				durableJournal: 'acquisition/network/journal.ndjson',
			},
			license: {
				rootExpression: 'Apache-2.0',
				redistributionAuthorized: false,
				legalReviewRequired: true,
			},
			access: state,
			privacy: { sensitiveData: false, hostPaths: false },
		};
		const receipt = {
			...unsigned,
			integrity: { algorithm: 'sha256', canonicalDigest: sha256(canonicalize(unsigned)) },
		};
		await writeFile(join(acquisition, 'receipt.json'), `${canonicalize(receipt)}\n`, {
			flag: 'wx',
		});
		await rename(stageRoot, cacheRoot);
		await writeFile(receiptPath, `${canonicalize(receipt)}\n`, { flag: 'wx' });
	} catch (error) {
		await writeTerminal(error, state);
		throw error;
	}
}

export async function verifyAppsmithIngest(): Promise<{
	valid: true;
	digest: string;
	files: number;
}> {
	const receipt = JSON.parse(await readFile(receiptPath, 'utf8')) as {
		source: { manifestDigest: string; files: number };
		integrity: { canonicalDigest: string };
		[key: string]: unknown;
	};
	const cached = JSON.parse(
		await readFile(join(cacheRoot, 'acquisition/receipt.json'), 'utf8'),
	) as typeof receipt;
	if (canonicalize(receipt) !== canonicalize(cached))
		throw new Error('Appsmith receipt publication differs');
	const { integrity, ...unsigned } = receipt;
	if (integrity.canonicalDigest !== sha256(canonicalize(unsigned)))
		throw new Error('Appsmith receipt integrity differs');
	const rows = await manifest(join(cacheRoot, 'acquisition/source'));
	if (
		rows.length !== receipt.source.files ||
		sha256(canonicalize(rows)) !== receipt.source.manifestDigest
	)
		throw new Error('Appsmith offline source replay differs');
	return { valid: true, digest: integrity.canonicalDigest, files: rows.length };
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const mode = parseAppsmithLauncher(args);
	if (mode === 'preflight') {
		process.stdout.write('{"preflight":"pass"}\n');
		return;
	}
	if (mode === 'acquire') await acquireAppsmith();
	process.stdout.write(`${canonicalize(await verifyAppsmithIngest())}\n`);
}
if (basename(process.argv[1] ?? '') === 'react-appsmith-ingest.ts')
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
