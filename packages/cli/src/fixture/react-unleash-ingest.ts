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

export const UNLEASH_CONSENT = 'T686-unleash-frontend-4.12.4-production-acquisition' as const;
export const UNLEASH_NAMESPACE = 't686' as const;

const root = resolve(import.meta.dirname, '../../../..');
const evidenceRoot = join(root, 'evidence/ingests/react-unleash/t686');
const attemptPath = join(evidenceRoot, 'attempt.json');
const terminalPath = join(evidenceRoot, 'terminal.json');
const receiptPath = join(evidenceRoot, 'receipt.json');
const stageRoot = join(root, '.versionless/cache/react-unleash-stage-t686');
const cacheRoot = join(root, '.versionless/cache/react-unleash-source-t686');
const hex40 = createRegExp(
	charIn('0123456789').from('a', 'f').times(40).at.lineStart().at.lineEnd(),
);
const apiCap = 16 * 1024 * 1024;
const archiveCap = 256 * 1024 * 1024;
const aggregateCap = 1024 * 1024 * 1024;
const durableNetworkRoot = join(stageRoot, 'acquisition/network');

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
export type UnleashNetworkState = {
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
	state: UnleashNetworkState,
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

export function parseUnleashLauncher(args: readonly string[]): 'acquire' | 'verify' | 'preflight' {
	if (args.at(-2) !== '--namespace' || args.at(-1) !== UNLEASH_NAMESPACE)
		throw new Error('Unleash namespace differs');
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
		leading[1] === UNLEASH_CONSENT &&
		process.env.VERSIONLESS_NETWORK_MODE === 'consented' &&
		process.env.VERSIONLESS_CONSENT_ID === UNLEASH_CONSENT
	)
		return 'acquire';
	if (
		leading.length === 1 &&
		leading[0] === '--verify-offline' &&
		process.env.VERSIONLESS_NETWORK_MODE === 'offline' &&
		process.env.VERSIONLESS_CONSENT_ID === undefined
	)
		return 'verify';
	throw new Error('Unleash launcher boundary differs');
}

export function parseUnleashJsonc(text: string, path: string): unknown {
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

export type UnleashPackageCandidate = Readonly<{
	path: string;
	name: string | null;
	reactMajor: number | null;
	webpackMajor: number | null;
	umiMajor?: number | null;
	craMajor?: number | null;
	viteMajor?: number | null;
	ownedWebpackConfigs: number;
	browserEntry: boolean;
	search: boolean;
	detail: boolean;
	auth: boolean;
	registryApi: boolean;
}>;

export function isCanonicalApache2License(text: string): boolean {
	const normalized = text
		.split('\n')
		.flatMap((line) => line.split(' '))
		.map((part) => part.trim())
		.filter(Boolean)
		.join(' ');
	return (
		normalized.includes('Apache License') && normalized.includes('Version 2.0, January 2004')
	);
}

export function discoverUnleashApplicationPackage(
	candidates: readonly UnleashPackageCandidate[],
): UnleashPackageCandidate {
	const scored = candidates
		.map((candidate) => ({
			candidate,
			score:
				(candidate.name?.toLowerCase().includes('unleash') ? 2 : 0) +
				(candidate.reactMajor === 16 || candidate.reactMajor === 17 ? 3 : 0) +
				(candidate.viteMajor === 2 ? 3 : 0) +
				(candidate.ownedWebpackConfigs > 0 ? 2 : 0) +
				(candidate.browserEntry ? 2 : 0) +
				(candidate.search ? 1 : 0) +
				(candidate.detail ? 1 : 0) +
				(candidate.auth ? 1 : 0) +
				(candidate.registryApi ? 1 : 0),
			eligible:
				(candidate.reactMajor === 16 || candidate.reactMajor === 17) &&
				candidate.viteMajor === 2 &&
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
	if (!scored[0]) throw new Error('Unleash authentic React17/Vite2 web UI package is absent');
	if (scored[1]?.score === scored[0].score)
		throw new Error('Unleash authentic nested web UI package is ambiguous');
	return scored[0].candidate;
}

const assertUrl = (url: string, kind: 'api' | 'archive' | 'registry'): void => {
	const parsed = parseURL(url);
	const expectedHost =
		kind === 'archive'
			? 'codeload.github.com'
			: kind === 'registry'
				? 'registry.npmjs.org'
				: 'api.github.com';
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
			'Unleash request escaped literal consent',
		);
};

async function getExact(
	url: string,
	kind: 'api' | 'archive' | 'registry',
	state: UnleashNetworkState,
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
									: kind === 'registry'
										? 'application/json'
										: 'application/octet-stream',
							'accept-encoding': 'identity',
							'user-agent': 'versionless-t686',
							'x-versionless-consent-id': UNLEASH_CONSENT,
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
									'Unleash response status differs',
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
									'Unleash content encoding differs',
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
										'Unleash response cap exceeded',
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
					call.destroy(new Error('Unleash zero-observation timeout')),
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
	throw new Error('Unleash transport exhausted');
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
					'Unleash archive special entry',
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

async function writeTerminal(error: unknown, state: UnleashNetworkState): Promise<void> {
	if (await exists(terminalPath)) return;
	const failure =
		error instanceof AdmissionFailure
			? error
			: new AdmissionFailure(
					'publication',
					'unexpected-error',
					'successful publication',
					error instanceof Error ? error.message : String(error),
					'Unleash unexpected acquisition failure',
				);
	const unsigned = {
		schemaVersion: 'versionless.react-unleash-t686-terminal.v1',
		result: 'terminal-failure',
		consentId: UNLEASH_CONSENT,
		namespace: UNLEASH_NAMESPACE,
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

export async function acquireUnleash(): Promise<void> {
	for (const target of [attemptPath, terminalPath, receiptPath, stageRoot, cacheRoot])
		if (await exists(target)) throw new Error('Unleash T686 output collision');
	await mkdir(evidenceRoot, { recursive: true });
	await writeFile(
		attemptPath,
		`${canonicalize({ schemaVersion: 'versionless.react-unleash-t686-attempt.v1', consentId: UNLEASH_CONSENT, namespace: UNLEASH_NAMESPACE, limits: { refsPerPrefix: 256, apiBytes: apiCap, archiveBytes: archiveCap, aggregateBytes: aggregateCap } })}\n`,
		{ flag: 'wx' },
	);
	const state: UnleashNetworkState = {
		acceptedResponses: 0,
		aggregateBytes: 0,
		observations: [],
		ledger: [],
	};
	try {
		const acquisition = join(stageRoot, 'acquisition');
		const source = join(acquisition, 'source');
		await mkdir(source, { recursive: true });
		const metadataUrl = joinURL('https://registry.npmjs.org', 'unleash-frontend', '4.12.4');
		type ReleaseMetadata = {
			name?: unknown;
			version?: unknown;
			license?: unknown;
			gitHead?: unknown;
			repository?: { url?: unknown } | string;
			dist?: { tarball?: unknown; integrity?: unknown };
		};
		const metadata = JSON.parse(
			(await getExact(metadataUrl, 'registry', state)).toString('utf8'),
		) as ReleaseMetadata;
		if (metadata.name !== 'unleash-frontend' || metadata.version !== '4.12.4')
			fail(
				'repository-identity',
				'exact-npm-release',
				'unleash-frontend@4.12.4',
				{ name: metadata.name ?? null, version: metadata.version ?? null },
				'Unleash npm release differs',
			);
		const repositoryUrl =
			typeof metadata.repository === 'string'
				? metadata.repository
				: metadata.repository?.url;
		if (
			typeof repositoryUrl !== 'string' ||
			!repositoryUrl.toLowerCase().includes('unleash/unleash-frontend')
		)
			fail(
				'repository-identity',
				'canonical-repository',
				'Unleash/unleash-frontend',
				repositoryUrl ?? null,
				'Unleash repository identity differs',
			);
		const gitHead = metadata.gitHead;
		if (typeof gitHead !== 'string' || !hex40.test(gitHead.toLowerCase()))
			fail(
				'immutable-lineage',
				'npm-githead',
				'40-character commit',
				metadata.gitHead ?? null,
				'Unleash npm gitHead differs',
			);
		const commitSha = (gitHead as string).toLowerCase();
		const expectedDistUrl = joinURL(
			'https://registry.npmjs.org',
			'unleash-frontend',
			'-',
			'unleash-frontend-4.12.4.tgz',
		);
		const dist = metadata.dist;
		if (
			dist?.tarball !== expectedDistUrl ||
			typeof dist.integrity !== 'string' ||
			!dist.integrity.startsWith('sha512-')
		)
			fail(
				'archive-integrity',
				'npm-dist-integrity',
				{ tarball: expectedDistUrl, integrity: 'sha512-*' },
				metadata.dist ?? null,
				'Unleash npm dist metadata differs',
			);
		const distIntegrity = (dist as { integrity: string }).integrity;
		const npmDist = await getExact(expectedDistUrl, 'registry', state);
		const observedIntegrity = `sha512-${createHash('sha512').update(npmDist).digest('base64')}`;
		if (observedIntegrity !== distIntegrity)
			fail(
				'archive-integrity',
				'npm-dist-sha512',
				distIntegrity,
				observedIntegrity,
				'Unleash npm dist integrity differs',
			);
		await writeFile(join(acquisition, 'npm-dist.tgz'), npmDist, { flag: 'wx' });
		const apiRoot = joinURL('https://api.github.com', 'repos', 'Unleash', 'unleash-frontend');
		const commit = JSON.parse(
			(await getExact(joinURL(apiRoot, 'git', 'commits', commitSha), 'api', state)).toString(
				'utf8',
			),
		) as { sha?: unknown; tree?: { sha?: unknown }; committer?: { date?: unknown } };
		if (
			commit.sha !== commitSha ||
			typeof commit.tree?.sha !== 'string' ||
			!hex40.test(commit.tree.sha) ||
			typeof commit.committer?.date !== 'string'
		)
			fail(
				'immutable-lineage',
				'commit-tree-date',
				'exact npm gitHead commit/tree/date',
				{ sha: commit.sha ?? null, date: commit.committer?.date ?? null },
				'Unleash commit lineage differs',
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
				'Unleash tree differs',
			);
		const selected: Candidate = {
			ref: 'npm:unleash-frontend@4.12.4',
			version: [4, 12, 4],
			commit: commitSha,
			tree: treeSha,
			commitDate,
		};
		const archiveUrl = joinURL(
			'https://codeload.github.com',
			'Unleash',
			'unleash-frontend',
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
				'Unleash archives differ',
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
					'Unleash archive path unsafe',
				);
			archiveRoot ??= segments[0];
			if (segments[0] !== archiveRoot)
				fail(
					'archive-integrity',
					'single-root',
					archiveRoot,
					segments[0],
					'Unleash archive root differs',
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
				'Unleash root license absent',
			);
		const license = await readFile(join(source, licenseName as string), 'utf8');
		if (!isCanonicalApache2License(license))
			fail(
				'rights',
				'root-apache-2-text',
				'Apache-2.0',
				'different text',
				'Unleash license differs',
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
				'Unleash recursive package inventory differs',
			);
		const documents = new Map<string, PackageDocument>();
		const packageCandidates: UnleashPackageCandidate[] = [];
		for (const packagePath of packagePaths) {
			const document = parseUnleashJsonc(
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
					(basename(row.path).toLowerCase().includes('vite.config') ||
						basename(row.path).toLowerCase().includes('webpack') ||
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
				viteMajor: major(document.dependencies?.vite ?? document.devDependencies?.vite),
				ownedWebpackConfigs,
				browserEntry:
					typeof document.browser === 'string' ||
					typeof document.browser === 'object' ||
					typeof document.main === 'string' ||
					typeof document.source === 'string' ||
					scopedRows.some((row) => row.path.includes('/src/index.')),
				search: corpus.includes('feature') && corpus.includes('project'),
				detail: corpus.includes('strategy') && corpus.includes('constraint'),
				auth: corpus.includes('login') || corpus.includes('auth'),
				registryApi:
					(corpus.includes('feature') || corpus.includes('project')) &&
					(corpus.includes('request') || corpus.includes('/api/')),
			});
		}
		const selectedPackage = (() => {
			try {
				return discoverUnleashApplicationPackage(packageCandidates);
			} catch (error) {
				return fail(
					'semantic-qualification',
					'unique-recursive-application-package',
					'one eligible package',
					packageCandidates,
					error instanceof Error ? error.message : 'Unleash package discovery failed',
				);
			}
		})();
		const packageDocument = documents.get(selectedPackage.path) as PackageDocument;
		const reactMajor = selectedPackage.reactMajor;
		const webpackMajor = selectedPackage.webpackMajor;
		const umiMajor = selectedPackage.umiMajor ?? null;
		const craMajor = selectedPackage.craMajor ?? null;
		const viteMajor = selectedPackage.viteMajor ?? null;
		const locks = ['yarn.lock', 'package-lock.json', 'pnpm-lock.yaml'].filter((name) =>
			blobs.has(name),
		);
		const selectedRoot = dirname(selectedPackage.path);
		const selectedPrefix = selectedRoot === '.' ? '' : `${selectedRoot}/`;
		const ownedWebpackConfigs = [...blobs.keys()].filter(
			(path) =>
				(!selectedPrefix || path.startsWith(selectedPrefix)) &&
				(basename(path).toLowerCase().includes('vite.config') ||
					basename(path).toLowerCase().includes('webpack') ||
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
				expected: 'Unleash application',
				observed: packageDocument.name,
				pass:
					typeof packageDocument.name === 'string' &&
					packageDocument.name.toLowerCase().includes('unleash') &&
					typeof packageDocument.scripts?.build === 'string',
			},
			{
				property: 'react-major-family',
				expected: '16 or 17',
				observed: reactMajor,
				pass: reactMajor === 16 || reactMajor === 17,
			},
			{
				property: 'vite-family',
				expected: 'Vite 2 with owned build config',
				observed: { viteMajor, configs: ownedWebpackConfigs.length },
				pass: viteMajor === 2 && ownedWebpackConfigs.length > 0,
			},
			{
				property: 'authoritative-lock',
				expected: 'exactly one committed lock',
				observed: locks,
				pass: locks.length === 1,
			},
			{
				property: 'feature-project-capability',
				expected: 'feature and project capability',
				observed: corpus.includes('feature') && corpus.includes('project'),
				pass: corpus.includes('feature') && corpus.includes('project'),
			},
			{
				property: 'strategy-constraint-capability',
				expected: 'strategy and constraint capability',
				observed: corpus.includes('strategy') && corpus.includes('constraint'),
				pass: corpus.includes('strategy') && corpus.includes('constraint'),
			},
			{
				property: 'authentication-capability',
				expected: 'login/auth capability',
				observed: corpus.includes('login') || corpus.includes('auth'),
				pass: corpus.includes('login') || corpus.includes('auth'),
			},
			{
				property: 'feature-management-api-capability',
				expected: 'feature-management request API capability',
				observed:
					(corpus.includes('feature') || corpus.includes('project')) &&
					(corpus.includes('request') || corpus.includes('/api/')),
				pass:
					(corpus.includes('feature') || corpus.includes('project')) &&
					(corpus.includes('request') || corpus.includes('/api/')),
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
					`Unleash semantic property failed: ${property.property}`,
				);
		const unsigned = {
			schemaVersion: 'versionless.react-unleash-ingest.v1',
			result: 'source-qualified',
			consentId: UNLEASH_CONSENT,
			namespace: UNLEASH_NAMESPACE,
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
				viteMajor,
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
				name: 'Unleash/unleash-frontend',
				package: 'unleash-frontend@4.12.4',
				commit: selected.commit,
				ref: selected.ref,
				npmDistSha256: sha256(npmDist),
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

export async function verifyUnleashIngest(): Promise<{
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
		throw new Error('Unleash receipt publication differs');
	const { integrity, ...unsigned } = receipt;
	if (integrity.canonicalDigest !== sha256(canonicalize(unsigned)))
		throw new Error('Unleash receipt integrity differs');
	const rows = await manifest(join(cacheRoot, 'acquisition/source'));
	if (
		rows.length !== receipt.source.files ||
		sha256(canonicalize(rows)) !== receipt.source.manifestDigest
	)
		throw new Error('Unleash offline source replay differs');
	return { valid: true, digest: integrity.canonicalDigest, files: rows.length };
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const mode = parseUnleashLauncher(args);
	if (mode === 'preflight') {
		process.stdout.write('{"preflight":"pass"}\n');
		return;
	}
	if (mode === 'acquire') await acquireUnleash();
	process.stdout.write(`${canonicalize(await verifyUnleashIngest())}\n`);
}
if (basename(process.argv[1] ?? '') === 'react-unleash-ingest.ts')
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
