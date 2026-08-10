import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	access,
	lstat,
	mkdir,
	readFile,
	readdir,
	readlink,
	rename,
	writeFile,
} from 'node:fs/promises';
import { request } from 'node:https';
import { charIn, createRegExp } from 'magic-regexp';
import { basename, join, relative, resolve } from 'pathe';
import { joinURL, parseURL, withQuery } from 'ufo';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';

export const JAEGER_UI_CONSENT = 'T680-jaeger-ui-production-acquisition' as const;
export const JAEGER_UI_NAMESPACE = 't680' as const;

const root = resolve(import.meta.dirname, '../../../..');
const evidenceRoot = join(root, 'evidence/ingests/react-jaeger-ui/t680');
const attemptPath = join(evidenceRoot, 'attempt.json');
const terminalPath = join(evidenceRoot, 'terminal.json');
const receiptPath = join(evidenceRoot, 'receipt.json');
const stageRoot = join(root, '.versionless/cache/react-jaeger-ui-stage-t680');
const cacheRoot = join(root, '.versionless/cache/react-jaeger-ui-source-t680');
const hex40 = createRegExp(
	charIn('0123456789').from('a', 'f').times(40).at.lineStart().at.lineEnd(),
);
const apiCap = 16 * 1024 * 1024;
const archiveCap = 256 * 1024 * 1024;
const aggregateCap = 1024 * 1024 * 1024;

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
type State = {
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

export function parseJaegerUiLauncher(args: readonly string[]): 'acquire' | 'verify' {
	if (args.at(-2) !== '--namespace' || args.at(-1) !== JAEGER_UI_NAMESPACE)
		throw new Error('Jaeger UI namespace differs');
	const leading = args.slice(0, -2);
	if (
		leading.length === 2 &&
		leading[0] === '--consent-id' &&
		leading[1] === JAEGER_UI_CONSENT &&
		process.env.VERSIONLESS_NETWORK_MODE === 'consented' &&
		process.env.VERSIONLESS_CONSENT_ID === JAEGER_UI_CONSENT
	)
		return 'acquire';
	if (
		leading.length === 1 &&
		leading[0] === '--verify-offline' &&
		process.env.VERSIONLESS_NETWORK_MODE === 'offline' &&
		process.env.VERSIONLESS_CONSENT_ID === undefined
	)
		return 'verify';
	throw new Error('Jaeger UI launcher boundary differs');
}

export function parseJaegerUiStableVersion(ref: string): readonly [number, number, number] | null {
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

export function selectJaegerUiCandidate(candidates: readonly Candidate[]): Candidate {
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
			'Jaeger UI stable historical candidate is absent',
		);
	return selected;
}

const assertUrl = (url: string, kind: 'api' | 'archive'): void => {
	const parsed = parseURL(url);
	const expectedHost = kind === 'api' ? 'api.github.com' : 'codeload.github.com';
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
			'Jaeger UI request escaped literal consent',
		);
};

async function getExact(url: string, kind: 'api' | 'archive', state: State): Promise<Buffer> {
	assertUrl(url, kind);
	const cap = kind === 'api' ? apiCap : archiveCap;
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
							'user-agent': 'versionless-t680',
							'x-github-api-version': kind === 'api' ? '2022-11-28' : '',
							'x-versionless-consent-id': JAEGER_UI_CONSENT,
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
									'Jaeger UI response status differs',
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
									'Jaeger UI content encoding differs',
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
										'Jaeger UI response cap exceeded',
									),
								);
							else chunks.push(Buffer.from(chunk));
						});
						response.once('error', reject);
						response.once('end', () => {
							const body = Buffer.concat(chunks, bytes);
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
						});
					},
				);
				call.setTimeout(60_000, () =>
					call.destroy(new Error('Jaeger UI zero-observation timeout')),
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
	throw new Error('Jaeger UI transport exhausted');
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
					'Jaeger UI archive special entry',
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

async function writeTerminal(error: unknown, state: State): Promise<void> {
	if (await exists(terminalPath)) return;
	const failure =
		error instanceof AdmissionFailure
			? error
			: new AdmissionFailure(
					'publication',
					'unexpected-error',
					'successful publication',
					error instanceof Error ? error.message : String(error),
					'Jaeger UI unexpected acquisition failure',
				);
	const unsigned = {
		schemaVersion: 'versionless.react-jaeger-ui-t680-terminal.v1',
		result: 'terminal-failure',
		consentId: JAEGER_UI_CONSENT,
		namespace: JAEGER_UI_NAMESPACE,
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

export async function acquireJaegerUi(): Promise<void> {
	for (const target of [attemptPath, terminalPath, receiptPath, stageRoot, cacheRoot])
		if (await exists(target)) throw new Error('Jaeger UI T680 output collision');
	await mkdir(evidenceRoot, { recursive: true });
	await writeFile(
		attemptPath,
		`${canonicalize({ schemaVersion: 'versionless.react-jaeger-ui-t680-attempt.v1', consentId: JAEGER_UI_CONSENT, namespace: JAEGER_UI_NAMESPACE, limits: { refsPerPrefix: 256, apiBytes: apiCap, archiveBytes: archiveCap, aggregateBytes: aggregateCap } })}\n`,
		{ flag: 'wx' },
	);
	const state: State = { acceptedResponses: 0, aggregateBytes: 0, observations: [], ledger: [] };
	try {
		const acquisition = join(stageRoot, 'acquisition');
		const source = join(acquisition, 'source');
		await mkdir(source, { recursive: true });
		const apiRoot = joinURL('https://api.github.com', 'repos', 'jaegertracing', 'jaeger-ui');
		const repository = JSON.parse((await getExact(apiRoot, 'api', state)).toString('utf8')) as {
			full_name?: unknown;
			owner?: { login?: unknown; type?: unknown };
			archived?: unknown;
			default_branch?: unknown;
			license?: { spdx_id?: unknown };
		};
		if (
			typeof repository.full_name !== 'string' ||
			repository.full_name.toLowerCase() !== 'jaegertracing/jaeger-ui'
		)
			fail(
				'repository-identity',
				'case-normalized-full-name',
				'jaegertracing/jaeger-ui',
				repository.full_name ?? null,
				'Jaeger UI repository identity differs',
			);
		const refs: RefRow[] = [];
		for (const prefix of ['tags/v1.', 'tags/1.']) {
			const value = JSON.parse(
				(
					await getExact(joinURL(apiRoot, 'git', 'matching-refs', prefix), 'api', state)
				).toString('utf8'),
			) as unknown;
			if (!Array.isArray(value) || value.length > 256)
				fail(
					'ref-enumeration',
					`cardinality-${prefix}`,
					'<=256',
					Array.isArray(value) ? value.length : 'non-array',
					'Jaeger UI ref cardinality differs',
				);
			for (const item of value as unknown[]) {
				const row = item as { ref?: unknown; object?: { type?: unknown; sha?: unknown } };
				if (
					typeof row.ref !== 'string' ||
					(row.object?.type !== 'commit' && row.object?.type !== 'tag') ||
					typeof row.object.sha !== 'string' ||
					!hex40.test(row.object.sha)
				)
					fail(
						'ref-enumeration',
						`shape-${prefix}`,
						'valid Git ref',
						'invalid row',
						'Jaeger UI ref shape differs',
					);
				const refName = row.ref as string;
				const objectType = row.object?.type as 'commit' | 'tag';
				const objectSha = row.object?.sha as string;
				refs.push({ ref: refName, object: { type: objectType, sha: objectSha } });
			}
		}
		const ordered = refs
			.map((ref) => ({ ref, version: parseJaegerUiStableVersion(ref.ref) }))
			.filter(
				(row): row is { ref: RefRow; version: readonly [number, number, number] } =>
					row.version !== null,
			)
			.sort(
				(left, right) =>
					right.version[1] - left.version[1] ||
					right.version[2] - left.version[2] ||
					compareText(left.ref.ref, right.ref.ref),
			);
		const candidates: Candidate[] = [];
		for (const { ref, version } of ordered) {
			let type = ref.object.type;
			let commitSha = ref.object.sha;
			for (let depth = 0; type === 'tag' && depth < 4; depth += 1) {
				const tag = JSON.parse(
					(
						await getExact(joinURL(apiRoot, 'git', 'tags', commitSha), 'api', state)
					).toString('utf8'),
				) as { sha?: unknown; object?: { type?: unknown; sha?: unknown } };
				if (
					tag.sha !== commitSha ||
					(tag.object?.type !== 'tag' && tag.object?.type !== 'commit') ||
					typeof tag.object.sha !== 'string' ||
					!hex40.test(tag.object.sha)
				)
					fail(
						'immutable-lineage',
						'annotated-tag-peel',
						commitSha,
						tag.sha ?? null,
						'Jaeger UI annotated tag differs',
					);
				type = tag.object?.type as 'commit' | 'tag';
				commitSha = tag.object?.sha as string;
			}
			if (type !== 'commit')
				fail(
					'immutable-lineage',
					'tag-peel-depth',
					'<=4',
					'>4',
					'Jaeger UI tag peel exceeded',
				);
			const commit = JSON.parse(
				(
					await getExact(joinURL(apiRoot, 'git', 'commits', commitSha), 'api', state)
				).toString('utf8'),
			) as { sha?: unknown; tree?: { sha?: unknown }; committer?: { date?: unknown } };
			if (
				commit.sha !== commitSha ||
				typeof commit.tree?.sha !== 'string' ||
				!hex40.test(commit.tree.sha) ||
				typeof commit.committer?.date !== 'string'
			)
				fail(
					'immutable-lineage',
					'ref-commit-tree',
					commitSha,
					commit.sha ?? null,
					'Jaeger UI commit lineage differs',
				);
			const treeSha = commit.tree?.sha as string;
			const commitDate = commit.committer?.date as string;
			if (commitDate >= '2020-01-01T00:00:00Z' && commitDate <= '2021-12-31T23:59:59Z') {
				candidates.push({
					ref: ref.ref,
					version,
					commit: commitSha,
					tree: treeSha,
					commitDate,
				});
				break;
			}
		}
		const selected = selectJaegerUiCandidate(candidates);
		const tree = JSON.parse(
			(
				await getExact(
					withQuery(joinURL(apiRoot, 'git', 'trees', selected.tree), { recursive: '1' }),
					'api',
					state,
				)
			).toString('utf8'),
		) as {
			sha?: unknown;
			truncated?: unknown;
			tree?: Array<{ path: string; mode: string; type: string; sha: string; size?: number }>;
		};
		if (tree.sha !== selected.tree || tree.truncated !== false || !Array.isArray(tree.tree))
			fail(
				'immutable-lineage',
				'untruncated-tree',
				selected.tree,
				tree.sha ?? null,
				'Jaeger UI tree differs',
			);
		const archiveUrl = joinURL(
			'https://codeload.github.com',
			'jaegertracing',
			'jaeger-ui',
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
				'Jaeger UI archives differ',
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
					'Jaeger UI archive path unsafe',
				);
			archiveRoot ??= segments[0];
			if (segments[0] !== archiveRoot)
				fail(
					'archive-integrity',
					'single-root',
					archiveRoot,
					segments[0],
					'Jaeger UI archive root differs',
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
		const treeRows = tree.tree as Array<{
			path: string;
			mode: string;
			type: string;
			sha: string;
			size?: number;
		}>;
		const rows = await manifest(source);
		const blobs = new Map(
			treeRows.filter((row) => row.type === 'blob').map((row) => [row.path, row]),
		);
		if (rows.length !== blobs.size)
			fail(
				'archive-integrity',
				'tree-cardinality',
				blobs.size,
				rows.length,
				'Jaeger UI archive cardinality differs',
			);
		for (const row of rows) {
			const expected = blobs.get(row.path);
			if (
				!expected ||
				expected.sha !== row.gitSha ||
				expected.size !== row.bytes ||
				expected.mode !== row.mode
			)
				fail(
					'archive-integrity',
					'git-parity',
					row.path,
					expected?.path ?? null,
					'Jaeger UI Git parity differs',
				);
		}
		const licenseName = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'].find((name) =>
			blobs.has(name),
		);
		if (!licenseName)
			fail(
				'rights',
				'root-license',
				'Apache-2.0 root license',
				'absent',
				'Jaeger UI root license absent',
			);
		const license = await readFile(join(source, licenseName as string), 'utf8');
		if (!license.includes('Apache License') || !license.includes('Version 2.0, January 2004'))
			fail(
				'rights',
				'root-apache-2-text',
				'Apache-2.0',
				'different text',
				'Jaeger UI license differs',
			);
		const packageDocument = JSON.parse(
			await readFile(join(source, 'package.json'), 'utf8'),
		) as {
			name?: unknown;
			version?: unknown;
			dependencies?: Record<string, unknown>;
			devDependencies?: Record<string, unknown>;
			scripts?: Record<string, unknown>;
		};
		const reactMajor = major(packageDocument.dependencies?.react);
		const webpackMajor = major(
			packageDocument.devDependencies?.webpack ?? packageDocument.dependencies?.webpack,
		);
		const locks = ['yarn.lock', 'package-lock.json'].filter((name) => blobs.has(name));
		const ownedWebpackConfigs = [...blobs.keys()].filter(
			(path) =>
				basename(path).toLowerCase().includes('webpack') &&
				['.js', '.ts'].some((extension) => path.endsWith(extension)),
		);
		const sourceTexts: string[] = [];
		for (const row of rows)
			if (['.js', '.jsx', '.ts', '.tsx'].some((extension) => row.path.endsWith(extension)))
				sourceTexts.push((await readFile(join(source, row.path), 'utf8')).toLowerCase());
		const corpus = sourceTexts.join('\n');
		const properties = [
			{
				property: 'application-identity',
				expected: 'Jaeger UI application',
				observed: packageDocument.name,
				pass:
					typeof packageDocument.name === 'string' &&
					packageDocument.name.toLowerCase().includes('jaeger') &&
					typeof packageDocument.scripts?.build === 'string',
			},
			{
				property: 'react-major-family',
				expected: '16 or 17',
				observed: reactMajor,
				pass: reactMajor === 16 || reactMajor === 17,
			},
			{
				property: 'webpack-major-family',
				expected: '4 or 5 with owned config',
				observed: { major: webpackMajor, configs: ownedWebpackConfigs.length },
				pass: (webpackMajor === 4 || webpackMajor === 5) && ownedWebpackConfigs.length > 0,
			},
			{
				property: 'authoritative-lock',
				expected: 'exactly one committed lock',
				observed: locks,
				pass: locks.length === 1,
			},
			{
				property: 'search-route-concept',
				expected: 'search route/state',
				observed: corpus.includes('search'),
				pass:
					corpus.includes('search') &&
					(corpus.includes('route') || corpus.includes('path')),
			},
			{
				property: 'trace-detail-route-concept',
				expected: 'trace detail route/state',
				observed: corpus.includes('trace'),
				pass:
					corpus.includes('trace') &&
					(corpus.includes('detail') || corpus.includes('span')),
			},
			{
				property: 'services-capability',
				expected: 'services capability',
				observed: corpus.includes('services'),
				pass: corpus.includes('services'),
			},
			{
				property: 'operations-capability',
				expected: 'operations capability',
				observed: corpus.includes('operations'),
				pass: corpus.includes('operations'),
			},
			{
				property: 'trace-id-capability',
				expected: 'trace identifier capability',
				observed: corpus.includes('traceid') || corpus.includes('trace id'),
				pass: corpus.includes('traceid') || corpus.includes('trace id'),
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
					`Jaeger UI semantic property failed: ${property.property}`,
				);
		const unsigned = {
			schemaVersion: 'versionless.react-jaeger-ui-ingest.v1',
			result: 'source-qualified',
			consentId: JAEGER_UI_CONSENT,
			namespace: JAEGER_UI_NAMESPACE,
			source: {
				...selected,
				archiveSha256: sha256(archiveOne),
				manifestDigest: sha256(canonicalize(rows)),
				files: rows.length,
			},
			product: {
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
			repositoryAudit: {
				ownerLogin: repository.owner?.login ?? null,
				ownerType: repository.owner?.type ?? null,
				archived: repository.archived ?? null,
				defaultBranch: repository.default_branch ?? null,
				apiLicense: repository.license?.spdx_id ?? null,
				authority: 'audit-only',
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

export async function verifyJaegerUiIngest(): Promise<{
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
		throw new Error('Jaeger UI receipt publication differs');
	const { integrity, ...unsigned } = receipt;
	if (integrity.canonicalDigest !== sha256(canonicalize(unsigned)))
		throw new Error('Jaeger UI receipt integrity differs');
	const rows = await manifest(join(cacheRoot, 'acquisition/source'));
	if (
		rows.length !== receipt.source.files ||
		sha256(canonicalize(rows)) !== receipt.source.manifestDigest
	)
		throw new Error('Jaeger UI offline source replay differs');
	return { valid: true, digest: integrity.canonicalDigest, files: rows.length };
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const mode = parseJaegerUiLauncher(args);
	if (mode === 'acquire') await acquireJaegerUi();
	process.stdout.write(`${canonicalize(await verifyJaegerUiIngest())}\n`);
}
if (basename(process.argv[1] ?? '') === 'react-jaeger-ui-ingest.ts')
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
