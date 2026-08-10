import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { request } from 'node:https';
import { charIn, createRegExp } from 'magic-regexp';
import { basename, join, relative, resolve } from 'pathe';
import { joinURL, parseURL, withQuery } from 'ufo';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';
import { analyzeSqlpadLocks, type SqlpadClosureArtifact } from './react-sqlpad-v5-5-0-ingest.ts';

export const SALEOR_CONSENT = 'T670-saleor-dashboard-production-acquisition' as const;
export const SALEOR_NAMESPACE = 't670' as const;
export const SALEOR_TARGET_PACKAGES = Object.freeze([
	Object.freeze({
		name: 'react',
		version: '18.3.1',
		url: 'https://registry.npmjs.org/react/-/react-18.3.1.tgz',
		integrity:
			'sha512-wS+hAgJShR0KhEvPJArfuPVN1+Hz1t0Y6n5jLrGQbkb4urgPE/0Rve+1kMB1v/oWgHgm4WIcV+i7F2pTVj+2iQ==',
	}),
	Object.freeze({
		name: 'react-dom',
		version: '18.3.1',
		url: 'https://registry.npmjs.org/react-dom/-/react-dom-18.3.1.tgz',
		integrity:
			'sha512-5m4nQKp+rZRb09LNH59GM4BxTh9251/ylbKIbpe7TpGxfJ+9kv6BLkLBXIjjspbgbnIBNqlI23tRnTWT0snUIw==',
	}),
	Object.freeze({
		name: 'scheduler',
		version: '0.23.2',
		url: 'https://registry.npmjs.org/scheduler/-/scheduler-0.23.2.tgz',
		integrity:
			'sha512-UOShsPwz7NrMUqhR6t0hWjFduvOzbtv7toDH1/hIrfRNIDBnnBWd0CwJTGvTpngVlmwGCdP9/Zl/tVrDqcuYzQ==',
	}),
]);

const hex40 = createRegExp(
	charIn('0123456789').from('a', 'f').times(40).at.lineStart().at.lineEnd(),
);
const root = resolve(import.meta.dirname, '../../../..');
const evidenceRoot = join(root, 'evidence/ingests/react-saleor-dashboard/t670');
const attemptPath = join(evidenceRoot, 'attempt.json');
const terminalPath = join(evidenceRoot, 'terminal.json');
const receiptPath = join(evidenceRoot, 'receipt.json');
const cacheRoot = join(root, '.versionless/cache/react-saleor-dashboard-t670-source');
const stageRoot = join(root, '.versionless/cache/react-saleor-dashboard-t670-stage');
const responseCap = 6_500;
const apiByteCap = 16 * 1024 * 1024;
const tarballByteCap = 64 * 1024 * 1024;
const archiveByteCap = 256 * 1024 * 1024;
const aggregateByteCap = 3 * 1024 * 1024 * 1024;
const requestTimeoutMilliseconds = 60_000;

type TreeRow = { path: string; mode: string; type: string; sha: string; size?: number };
type LedgerRow = {
	ordinal: number;
	url: string;
	status: 200;
	bytes: number;
	sha256: string;
	sha512: string;
	zeroResponseAttempts: number;
};
type NetworkState = {
	acceptedResponses: number;
	aggregateBytes: number;
	ledger: LedgerRow[];
	transportAttempts: Array<{
		url: string;
		attempt: number;
		outcome: 'zero-response' | 'accepted';
	}>;
};
export type SaleorArtifact = SqlpadClosureArtifact & {
	sha256?: string;
	sha512?: string;
	bytes?: number;
};
export type SaleorIngestReceipt = {
	schemaVersion: 'versionless.react-saleor-dashboard-ingest.v1';
	result: 'pass';
	consentId: typeof SALEOR_CONSENT;
	namespace: typeof SALEOR_NAMESPACE;
	source: {
		ref: string;
		commit: string;
		tree: string;
		commitDate: string;
		archiveSha256: string;
		manifestDigest: string;
		files: number;
	};
	product: {
		name: 'saleor-dashboard';
		version: string;
		react: string;
		reactDom: string;
		bundler: 'webpack-4';
		apiBinding: 'API_URI';
		serviceWorkerSourceMatches: 0;
	};
	license: {
		rootExpression: 'BSD-3-Clause';
		thirdPartyAssetState: 'unknown';
		legalReviewRequired: true;
		redistributionAuthorized: false;
	};
	closure: {
		artifacts: SaleorArtifact[];
		targetArtifacts: SaleorArtifact[];
		placements: number;
		lockDigest: string;
		installScriptsExecuted: false;
	};
	access: NetworkState & { redirects: 0; credentials: false; cookies: false };
	privacy: { sensitiveData: false; hostPaths: false };
	integrity: { algorithm: 'sha256'; canonicalDigest: string };
};

const compareText = (left: string, right: string): number =>
	left < right ? -1 : left > right ? 1 : 0;
const exists = (path: string): Promise<boolean> =>
	access(path).then(
		() => true,
		() => false,
	);

export function parseSaleorLauncher(args: string[]): {
	mode: 'acquire' | 'verify';
	namespace: typeof SALEOR_NAMESPACE;
} {
	if (args.at(-2) !== '--namespace' || args.at(-1) !== SALEOR_NAMESPACE)
		throw new Error('Saleor namespace differs');
	const leading = args.slice(0, -2);
	if (leading.length === 3 && leading[0] === '--consent-id' && leading[1] === SALEOR_CONSENT)
		throw new Error('Saleor consent arguments differ');
	if (
		leading.length === 2 &&
		leading[0] === '--consent-id' &&
		leading[1] === SALEOR_CONSENT &&
		process.env.VERSIONLESS_NETWORK_MODE === 'consented' &&
		process.env.VERSIONLESS_CONSENT_ID === SALEOR_CONSENT
	)
		return { mode: 'acquire', namespace: SALEOR_NAMESPACE };
	if (
		leading.length === 1 &&
		leading[0] === '--verify-offline' &&
		process.env.VERSIONLESS_NETWORK_MODE === 'offline' &&
		process.env.VERSIONLESS_CONSENT_ID === undefined
	)
		return { mode: 'verify', namespace: SALEOR_NAMESPACE };
	throw new Error('Saleor launcher boundary differs');
}

export function selectSaleorStableRef(value: unknown): {
	ref: string;
	objectType: 'commit' | 'tag';
	objectSha: string;
} {
	if (!Array.isArray(value) || value.length === 0 || value.length > 256)
		throw new Error('Saleor tag enumeration cardinality differs');
	const candidates: Array<{
		ref: string;
		objectType: 'commit' | 'tag';
		objectSha: string;
		version: [number, number, number];
	}> = [];
	for (const item of value) {
		if (!item || typeof item !== 'object' || Array.isArray(item))
			throw new Error('Saleor tag row differs');
		const row = item as { ref?: unknown; object?: { type?: unknown; sha?: unknown } };
		if (
			typeof row.ref !== 'string' ||
			!row.ref.startsWith('refs/tags/2.') ||
			(row.object?.type !== 'commit' && row.object?.type !== 'tag') ||
			typeof row.object.sha !== 'string' ||
			!hex40.test(row.object.sha)
		)
			throw new Error('Saleor tag identity differs');
		const versionText = row.ref.slice('refs/tags/'.length);
		const parts = versionText.split('.');
		if (
			parts.length !== 3 ||
			parts.some((part) => !part || ![...part].every((c) => c >= '0' && c <= '9'))
		)
			continue;
		const version = parts.map(Number) as [number, number, number];
		if (version[0] !== 2 || version.some((part) => !Number.isSafeInteger(part))) continue;
		candidates.push({
			ref: row.ref,
			objectType: row.object.type,
			objectSha: row.object.sha,
			version,
		});
	}
	const selected = candidates.sort(
		(left, right) =>
			right.version[0] - left.version[0] ||
			right.version[1] - left.version[1] ||
			right.version[2] - left.version[2] ||
			compareText(left.ref, right.ref),
	)[0];
	if (!selected) throw new Error('Saleor stable 2.x ref is absent');
	return { ref: selected.ref, objectType: selected.objectType, objectSha: selected.objectSha };
}

function assertUrl(url: string, kind: 'api' | 'archive' | 'tarball'): void {
	const parsed = parseURL(url);
	const expectedHost =
		kind === 'api'
			? 'api.github.com'
			: kind === 'archive'
				? 'codeload.github.com'
				: 'registry.npmjs.org';
	if (
		parsed.protocol !== 'https:' ||
		parsed.host !== expectedHost ||
		parsed.auth ||
		parsed.hash ||
		(kind !== 'api' && parsed.search)
	)
		throw new Error('Saleor request URL is outside literal consent');
}

async function getExact(
	url: string,
	kind: 'api' | 'archive' | 'tarball',
	state: NetworkState,
): Promise<Buffer> {
	assertUrl(url, kind);
	const byteCap =
		kind === 'api' ? apiByteCap : kind === 'archive' ? archiveByteCap : tarballByteCap;
	if (state.acceptedResponses >= responseCap)
		throw new Error('Saleor accepted-response cap exceeded');
	for (let attempt = 1; attempt <= 3; attempt += 1) {
		try {
			return await new Promise((resolvePromise, reject) => {
				let observedResponse = false;
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
							'user-agent': 'versionless-t670',
							'x-github-api-version': kind === 'api' ? '2022-11-28' : '',
							'x-versionless-consent-id': SALEOR_CONSENT,
						},
					},
					(response) => {
						observedResponse = true;
						state.transportAttempts.push({ url, attempt, outcome: 'accepted' });
						if (
							response.statusCode !== 200 ||
							response.headers.location !== undefined ||
							response.headers['set-cookie'] !== undefined ||
							(response.headers['content-encoding'] ?? 'identity') !== 'identity'
						) {
							response.destroy();
							reject(new Error(`Saleor accepted response boundary differs: ${url}`));
							return;
						}
						const chunks: Buffer[] = [];
						let bytes = 0;
						response.on('data', (chunk: Buffer) => {
							bytes += chunk.byteLength;
							if (bytes > byteCap || state.aggregateBytes + bytes > aggregateByteCap)
								response.destroy(new Error('Saleor acquisition byte cap exceeded'));
							else chunks.push(Buffer.from(chunk));
						});
						response.once('error', reject);
						response.once('end', () => {
							const body = Buffer.concat(chunks, bytes);
							state.acceptedResponses += 1;
							state.aggregateBytes += bytes;
							state.ledger.push({
								ordinal: state.acceptedResponses,
								url,
								status: 200,
								bytes,
								sha256: sha256(body),
								sha512: createHash('sha512').update(body).digest('hex'),
								zeroResponseAttempts: attempt - 1,
							});
							resolvePromise(body);
						});
					},
				);
				call.setTimeout(requestTimeoutMilliseconds, () =>
					call.destroy(new Error('Saleor zero-response request timeout')),
				);
				call.once('error', (error) => {
					if (!observedResponse) {
						state.transportAttempts.push({ url, attempt, outcome: 'zero-response' });
						const wrapped = new Error(error.message);
						Object.assign(wrapped, { zeroResponse: true });
						reject(wrapped);
					} else reject(error);
				});
				call.end();
			});
		} catch (error) {
			if (!(error instanceof Error) || !('zeroResponse' in error) || attempt === 3)
				throw error;
		}
	}
	throw new Error('Saleor transport attempts exhausted');
}

function gitBlobSha(bytes: Buffer): string {
	return createHash('sha1')
		.update(Buffer.from(`blob ${bytes.length}\0`))
		.update(bytes)
		.digest('hex');
}

async function execute(command: string, args: string[], cwd = root): Promise<string> {
	return await new Promise((resolvePromise, reject) => {
		const child = spawn(command, args, {
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

async function filesBelow(directory: string): Promise<string[]> {
	const result: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const absolute = join(directory, entry.name);
		if (entry.isDirectory()) result.push(...(await filesBelow(absolute)));
		else if (entry.isFile()) result.push(absolute);
		else throw new Error('Saleor source contains a special entry');
	}
	return result.sort(compareText);
}

function integrityMatches(bytes: Uint8Array, integrity: string): boolean {
	const separator = integrity.indexOf('-');
	if (separator < 1) return false;
	const algorithm = integrity.slice(0, separator);
	if (algorithm !== 'sha1' && algorithm !== 'sha512') return false;
	return createHash(algorithm).update(bytes).digest('base64') === integrity.slice(separator + 1);
}

function targetArtifacts(): SaleorArtifact[] {
	return SALEOR_TARGET_PACKAGES.map((artifact) => ({
		...artifact,
		placements: [`root:${artifact.name}`],
		bundled: [],
		mirror: `${sha256(artifact.url)}.tgz`,
	}));
}

async function writeTerminal(message: string, state: NetworkState): Promise<void> {
	if (await exists(terminalPath)) return;
	await mkdir(evidenceRoot, { recursive: true });
	const unsigned = {
		schemaVersion: 'versionless.react-saleor-dashboard-t670-terminal.v1',
		result: 'terminal-failure',
		consentId: SALEOR_CONSENT,
		namespace: SALEOR_NAMESPACE,
		promotion: 'none',
		error: message,
		access: state,
		claims: { feasibility: 'not-assessed', reactScore: '1/4', reactPilot: '0/1' },
	};
	await writeFile(
		terminalPath,
		`${canonicalize({ ...unsigned, integrity: { algorithm: 'sha256', canonicalDigest: sha256(canonicalize(unsigned)) } })}\n`,
		{ flag: 'wx' },
	);
}

export async function acquireSaleor(): Promise<void> {
	for (const target of [cacheRoot, stageRoot, receiptPath, attemptPath, terminalPath])
		if (await exists(target)) throw new Error('Saleor T670 output collision');
	await mkdir(evidenceRoot, { recursive: true });
	await writeFile(
		attemptPath,
		`${canonicalize({ schemaVersion: 'versionless.react-saleor-dashboard-t670-attempt.v1', consentId: SALEOR_CONSENT, namespace: SALEOR_NAMESPACE })}\n`,
		{ flag: 'wx' },
	);
	const state: NetworkState = {
		acceptedResponses: 0,
		aggregateBytes: 0,
		ledger: [],
		transportAttempts: [],
	};
	try {
		const acquisition = join(stageRoot, 'acquisition');
		const source = join(acquisition, 'source');
		const mirror = join(acquisition, 'mirror');
		await mkdir(source, { recursive: true });
		await mkdir(mirror, { recursive: true });
		const apiRoot = joinURL('https://api.github.com', 'repos', 'saleor', 'saleor-dashboard');
		const refsUrl = joinURL(apiRoot, 'git', 'matching-refs', 'tags', '2.');
		const refsBytes = await getExact(refsUrl, 'api', state);
		const selected = selectSaleorStableRef(JSON.parse(refsBytes.toString('utf8')));
		let commitSha = selected.objectSha;
		if (selected.objectType === 'tag') {
			const tagBytes = await getExact(
				joinURL(apiRoot, 'git', 'tags', selected.objectSha),
				'api',
				state,
			);
			const tag = JSON.parse(tagBytes.toString('utf8')) as {
				sha?: unknown;
				object?: { type?: unknown; sha?: unknown };
			};
			if (
				tag.sha !== selected.objectSha ||
				tag.object?.type !== 'commit' ||
				typeof tag.object.sha !== 'string' ||
				!hex40.test(tag.object.sha)
			)
				throw new Error('Saleor annotated ref peel differs');
			commitSha = tag.object.sha;
		}
		const commitBytes = await getExact(
			joinURL(apiRoot, 'git', 'commits', commitSha),
			'api',
			state,
		);
		const commit = JSON.parse(commitBytes.toString('utf8')) as {
			sha?: unknown;
			tree?: { sha?: unknown };
			committer?: { date?: unknown };
		};
		if (
			commit.sha !== commitSha ||
			typeof commit.tree?.sha !== 'string' ||
			!hex40.test(commit.tree.sha) ||
			typeof commit.committer?.date !== 'string' ||
			commit.committer.date < '2020-01-01T00:00:00Z' ||
			commit.committer.date > '2021-12-31T23:59:59Z'
		)
			throw new Error('Saleor fresh ref/commit/tree lineage differs');
		const boundTreeSha = commit.tree.sha;
		const treeUrl = withQuery(joinURL(apiRoot, 'git', 'trees', boundTreeSha), {
			recursive: '1',
		});
		const treeBytes = await getExact(treeUrl, 'api', state);
		const tree = JSON.parse(treeBytes.toString('utf8')) as {
			sha?: unknown;
			truncated?: unknown;
			tree?: TreeRow[];
		};
		if (tree.sha !== boundTreeSha || tree.truncated !== false || !Array.isArray(tree.tree))
			throw new Error('Saleor recursive tree differs');
		const repositoryBytes = await getExact(apiRoot, 'api', state);
		const repository = JSON.parse(repositoryBytes.toString('utf8')) as {
			id?: unknown;
			full_name?: unknown;
			license?: { spdx_id?: unknown };
		};
		if (
			repository.id !== 192721247 ||
			repository.full_name !== 'saleor/saleor-dashboard' ||
			repository.license?.spdx_id !== 'BSD-3-Clause'
		)
			throw new Error('Saleor repository rights identity differs');
		const archiveUrl = joinURL(
			'https://codeload.github.com',
			'saleor',
			'saleor-dashboard',
			'tar.gz',
			commitSha,
		);
		const archive1 = await getExact(archiveUrl, 'archive', state);
		const archive2 = await getExact(archiveUrl, 'archive', state);
		if (!archive1.equals(archive2)) throw new Error('Saleor two archives differ');
		const archivePath = join(acquisition, 'source.tar.gz');
		await writeFile(archivePath, archive1, { flag: 'wx' });
		const listing = (await execute('/usr/bin/tar', ['-tzf', archivePath]))
			.split('\n')
			.filter(Boolean);
		if (listing.length < 100) throw new Error('Saleor archive is unexpectedly small');
		let prefix: string | undefined;
		for (const entry of listing) {
			const segments = entry.split('/');
			if (!entry || entry.startsWith('/') || entry.includes('\\') || segments.includes('..'))
				throw new Error('Saleor archive path is unsafe');
			prefix ??= segments[0];
			if (segments[0] !== prefix) throw new Error('Saleor archive root differs');
		}
		await execute('/usr/bin/tar', [
			'-xzf',
			archivePath,
			'-C',
			source,
			'--strip-components',
			'1',
		]);
		const blobs = new Map(
			tree.tree.filter((row) => row.type === 'blob').map((row) => [row.path, row]),
		);
		const manifest = await Promise.all(
			(await filesBelow(source)).map(async (file) => {
				const bytes = await readFile(file);
				const path = relative(source, file);
				const expected = blobs.get(path);
				if (
					!expected ||
					expected.size !== bytes.byteLength ||
					expected.sha !== gitBlobSha(bytes)
				)
					throw new Error(`Saleor archive/tree parity differs: ${path}`);
				return {
					path,
					bytes: bytes.byteLength,
					sha256: sha256(bytes),
					gitSha: expected.sha,
				};
			}),
		);
		if (manifest.length !== blobs.size)
			throw new Error('Saleor archive manifest cardinality differs');
		const rootLicense = await readFile(join(source, 'LICENSE'), 'utf8');
		if (!rootLicense.includes('Redistribution and use in source and binary forms'))
			throw new Error('Saleor BSD root license differs');
		const packageDocument = JSON.parse(
			await readFile(join(source, 'package.json'), 'utf8'),
		) as {
			name?: unknown;
			version?: unknown;
			dependencies?: Record<string, unknown>;
			devDependencies?: Record<string, unknown>;
			scripts?: Record<string, unknown>;
		};
		const react = packageDocument.dependencies?.react;
		const reactDom = packageDocument.dependencies?.['react-dom'];
		if (
			packageDocument.name !== 'saleor-dashboard' ||
			typeof packageDocument.version !== 'string' ||
			typeof react !== 'string' ||
			(!react.includes('16.') && !react.includes('17.')) ||
			typeof reactDom !== 'string' ||
			packageDocument.scripts?.build !== 'webpack -p' ||
			packageDocument.devDependencies?.webpack !== '^4.41.1'
		)
			throw new Error('Saleor standalone React16/17 webpack4 product gate differs');
		const webpack = await readFile(join(source, 'webpack.config.js'), 'utf8');
		if (
			!webpack.includes('API_URI') ||
			!webpack.includes('Environment variable API_URI not set')
		)
			throw new Error('Saleor configurable loopback API gate differs');
		const serviceWorkerNeedles = [
			'navigator.serviceWorker',
			'serviceWorker.register',
			'registerServiceWorker',
			'registerSW(',
		];
		for (const row of manifest) {
			if (!row.path.startsWith('src/') && !row.path.endsWith('.html')) continue;
			const text = await readFile(join(source, row.path), 'utf8');
			if (serviceWorkerNeedles.some((needle) => text.includes(needle)))
				throw new Error(`Saleor source service-worker registration differs: ${row.path}`);
		}
		const lock = JSON.parse(
			await readFile(join(source, 'package-lock.json'), 'utf8'),
		) as unknown;
		const closure = analyzeSqlpadLocks([{ scope: 'root', value: lock }]);
		const artifacts = closure.artifacts as SaleorArtifact[];
		const targets = targetArtifacts();
		if (artifacts.length + targets.length + state.acceptedResponses > responseCap)
			throw new Error('Saleor closure exceeds accepted-response cap');
		for (let offset = 0; offset < artifacts.length + targets.length; offset += 8) {
			const batch = [...artifacts, ...targets].slice(offset, offset + 8);
			const bodies = await Promise.all(
				batch.map((artifact) => getExact(artifact.url, 'tarball', state)),
			);
			for (let index = 0; index < batch.length; index += 1) {
				const artifact = batch[index]!;
				const body = bodies[index]!;
				if (!integrityMatches(body, artifact.integrity))
					throw new Error(`Saleor lock integrity differs: ${artifact.url}`);
				artifact.sha256 = sha256(body);
				artifact.sha512 = createHash('sha512').update(body).digest('hex');
				artifact.bytes = body.byteLength;
				await writeFile(join(mirror, artifact.mirror), body, { flag: 'wx' });
			}
		}
		const unsigned = {
			schemaVersion: 'versionless.react-saleor-dashboard-ingest.v1' as const,
			result: 'pass' as const,
			consentId: SALEOR_CONSENT,
			namespace: SALEOR_NAMESPACE,
			source: {
				ref: selected.ref,
				commit: commitSha,
				tree: boundTreeSha,
				commitDate: commit.committer.date,
				archiveSha256: sha256(archive1),
				manifestDigest: sha256(canonicalize(manifest)),
				files: manifest.length,
			},
			product: {
				name: 'saleor-dashboard' as const,
				version: packageDocument.version,
				react,
				reactDom,
				bundler: 'webpack-4' as const,
				apiBinding: 'API_URI' as const,
				serviceWorkerSourceMatches: 0 as const,
			},
			license: {
				rootExpression: 'BSD-3-Clause' as const,
				thirdPartyAssetState: 'unknown' as const,
				legalReviewRequired: true as const,
				redistributionAuthorized: false as const,
			},
			closure: {
				artifacts,
				targetArtifacts: targets,
				placements: closure.placements,
				lockDigest: closure.digest,
				installScriptsExecuted: false as const,
			},
			access: {
				...state,
				redirects: 0 as const,
				credentials: false as const,
				cookies: false as const,
			},
			privacy: { sensitiveData: false as const, hostPaths: false as const },
		};
		const receipt: SaleorIngestReceipt = {
			...unsigned,
			integrity: { algorithm: 'sha256', canonicalDigest: sha256(canonicalize(unsigned)) },
		};
		await writeFile(join(acquisition, 'receipt.json'), `${canonicalize(receipt)}\n`, {
			flag: 'wx',
		});
		await rename(stageRoot, cacheRoot);
		await writeFile(receiptPath, `${canonicalize(receipt)}\n`, { flag: 'wx' });
	} catch (error) {
		await writeTerminal(error instanceof Error ? error.message : String(error), state);
		throw error;
	}
}

export async function verifySaleorIngest(): Promise<{
	valid: true;
	digest: string;
	artifacts: number;
}> {
	const published = JSON.parse(await readFile(receiptPath, 'utf8')) as SaleorIngestReceipt;
	const cached = JSON.parse(
		await readFile(join(cacheRoot, 'acquisition/receipt.json'), 'utf8'),
	) as SaleorIngestReceipt;
	if (canonicalize(published) !== canonicalize(cached))
		throw new Error('Saleor receipt publication differs');
	const { integrity, ...unsigned } = published;
	if (
		published.schemaVersion !== 'versionless.react-saleor-dashboard-ingest.v1' ||
		published.consentId !== SALEOR_CONSENT ||
		published.namespace !== SALEOR_NAMESPACE ||
		integrity.canonicalDigest !== sha256(canonicalize(unsigned))
	)
		throw new Error('Saleor receipt integrity differs');
	const source = join(cacheRoot, 'acquisition/source');
	const manifest = await Promise.all(
		(await filesBelow(source)).map(async (file) => {
			const bytes = await readFile(file);
			return {
				path: relative(source, file),
				bytes: bytes.byteLength,
				sha256: sha256(bytes),
				gitSha: gitBlobSha(bytes),
			};
		}),
	);
	if (sha256(canonicalize(manifest)) !== published.source.manifestDigest)
		throw new Error('Saleor source offline replay differs');
	for (const artifact of [...published.closure.artifacts, ...published.closure.targetArtifacts]) {
		const bytes = await readFile(join(cacheRoot, 'acquisition/mirror', artifact.mirror));
		if (
			bytes.byteLength !== artifact.bytes ||
			sha256(bytes) !== artifact.sha256 ||
			createHash('sha512').update(bytes).digest('hex') !== artifact.sha512 ||
			!integrityMatches(bytes, artifact.integrity)
		)
			throw new Error(`Saleor offline closure differs: ${artifact.name}@${artifact.version}`);
	}
	const mirrorEntries = await readdir(join(cacheRoot, 'acquisition/mirror'));
	if (
		mirrorEntries.length !==
		published.closure.artifacts.length + published.closure.targetArtifacts.length
	)
		throw new Error('Saleor offline mirror cardinality differs');
	return {
		valid: true,
		digest: integrity.canonicalDigest,
		artifacts: mirrorEntries.length,
	};
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const launcher = parseSaleorLauncher(args);
	if (launcher.mode === 'acquire') await acquireSaleor();
	process.stdout.write(`${canonicalize(await verifySaleorIngest())}\n`);
}

if (basename(process.argv[1] ?? '') === 'react-saleor-dashboard-ingest.ts')
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
