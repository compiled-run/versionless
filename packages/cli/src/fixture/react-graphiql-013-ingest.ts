import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { request } from 'node:https';
import type { Readable } from 'node:stream';
import { charIn, createRegExp } from 'magic-regexp';
import { basename, dirname, isAbsolute, join, normalize, relative, resolve } from 'pathe';
import { parseURL, stringifyParsedURL } from 'ufo';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';
import { inspectNpmPackageTarball } from '../../../core/src/receipts/npm-lock-acquisition-preflight.ts';

export const REACT_GRAPHIQL_CONSENT =
	'T577-official-source-graphiql-013-react15-production' as const;
export const REACT_GRAPHIQL_REVISION = 'f997c204e4d4bb0be4d0e2e136471dc62b807ddd' as const;
export const REACT_GRAPHIQL_TREE = '7b4f52a518bfc6e4080589cc9ec0f2e731463147' as const;

const root = resolve(import.meta.dirname, '../../../..');
const fixturePath = join(root, 'fixtures/react-graphiql-013/fixture.json');
const cacheRoot = join(root, '.versionless/cache/react-graphiql-013/t577');
const cacheParent = dirname(cacheRoot);
const stageRoot = join(root, '.versionless/stage/react-graphiql-013/t577');
const stageParent = dirname(stageRoot);
const workRoot = join(root, '.versionless/work/react-graphiql-013/t577');
const workParent = dirname(workRoot);
const runRoot = join(root, 'evidence/runs/react-graphiql-react15-to-vite8');
const ingestRoot = join(root, 'evidence/ingests/react-graphiql-013/t577');
const dependencyRoot = join(root, 'evidence/dependencies/react-graphiql-013');
const attemptPath = join(ingestRoot, 'attempt.json');
const failurePath = join(ingestRoot, 'terminal-exclusion.json');
const ingestReceiptPath = join(root, 'evidence/ingests/react-graphiql-013/receipt.json');
const dependencyReceiptPath = join(dependencyRoot, 'receipt.json');
const lowerHex40 = createRegExp(
	charIn('0123456789').from('a', 'f').times(40).at.lineStart().at.lineEnd(),
);
const lowerHex64 = createRegExp(
	charIn('0123456789').from('a', 'f').times(64).at.lineStart().at.lineEnd(),
);

type SourceIdentity = { path: string; bytes?: number; gitSha: string; sha256: string };
type Fixture = {
	schemaVersion: string;
	repository: string;
	revision: typeof REACT_GRAPHIQL_REVISION;
	tree: typeof REACT_GRAPHIQL_TREE;
	commitUrl: string;
	treeUrl: string;
	archiveUrl: string;
	source: Record<string, SourceIdentity>;
	cdnAssets: Array<{ package: string; version: string; url: string }>;
	target: { node: string; react: string; reactDom: string; scheduler: string; vite: string };
};
type TreeRow = { path: string; mode: string; type: string; sha: string; size?: number };
export type GraphiQLYarnArtifact = {
	url: string;
	sha1: string;
	integrity: string | null;
	selectors: string[];
	name: string;
	version: string;
	mirror: string;
};
type LedgerRow = {
	ordinal: number;
	origin: 'github' | 'registry' | 'cdn';
	url: string;
	result: 'accepted' | 'failed';
	wireBytes: number;
	decodedBytes: number;
	sha256: string | null;
	sha512: string | null;
};
type NetworkState = {
	requests: number;
	responses: number;
	wire: Record<LedgerRow['origin'], number>;
	decoded: Record<LedgerRow['origin'], number>;
	ledger: LedgerRow[];
};

const exists = (path: string): Promise<boolean> =>
	access(path).then(
		() => true,
		() => false,
	);
const objectRecord = (value: unknown): Record<string, unknown> => {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error('GraphiQL semantic record differs');
	return value as Record<string, unknown>;
};

export function assertGraphiQLAccessReplay(input: {
	ledger: unknown[];
	expectedUrls: string[];
	wire: Record<string, unknown>;
	decoded: Record<string, unknown>;
}): void {
	if (
		canonicalize(input.ledger.map((value) => objectRecord(value).url)) !==
		canonicalize(input.expectedUrls)
	)
		throw new Error('GraphiQL exact access ledger URL graph differs');
	for (const [index, value] of input.ledger.entries()) {
		const row = objectRecord(value);
		if (
			row.ordinal !== index + 1 ||
			row.result !== 'accepted' ||
			row.origin !== originFor(String(row.url)) ||
			!lowerHex64.test(String(row.sha256 ?? '')) ||
			!lowerHex64.test(String(row.sha512 ?? '')) ||
			typeof row.wireBytes !== 'number' ||
			!Number.isSafeInteger(row.wireBytes) ||
			row.wireBytes < 1 ||
			typeof row.decodedBytes !== 'number' ||
			!Number.isSafeInteger(row.decodedBytes) ||
			row.decodedBytes !== row.wireBytes
		)
			throw new Error('GraphiQL ingest access ledger differs');
	}
	for (const origin of ['github', 'registry', 'cdn'] as const) {
		const rows = input.ledger.map(objectRecord).filter((row) => row.origin === origin);
		if (
			input.wire[origin] !== rows.reduce((sum, row) => sum + Number(row.wireBytes), 0) ||
			input.decoded[origin] !== rows.reduce((sum, row) => sum + Number(row.decodedBytes), 0)
		)
			throw new Error('GraphiQL ingest access byte totals differ');
	}
}
const compare = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);
const gitBlobSha = (bytes: Uint8Array): string =>
	createHash('sha1')
		.update(Buffer.from(`blob ${bytes.length}\0`))
		.update(bytes)
		.digest('hex');

export async function createGraphiQLAttemptParent(path = attemptPath): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
}

export function parseGraphiQLLauncher(args: string[]): 'launcher-smoke' | 'acquire' {
	if (
		args.length !== 3 ||
		args[1] !== '--consent-id' ||
		args[2] !== REACT_GRAPHIQL_CONSENT ||
		(args[0] !== '--launcher-smoke' && args[0] !== '--acquire')
	)
		throw new Error('GraphiQL launcher requires exact arguments');
	if (args[0] === '--launcher-smoke') {
		if (
			process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
			process.env.NPM_CONFIG_OFFLINE !== 'true' ||
			process.env.VERSIONLESS_CONSENT_ID !== undefined
		)
			throw new Error('GraphiQL launcher smoke requires strict offline mode');
		return 'launcher-smoke';
	}
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'consented' ||
		process.env.VERSIONLESS_CONSENT_ID !== REACT_GRAPHIQL_CONSENT
	)
		throw new Error('GraphiQL acquisition requires exact one-shot consent');
	return 'acquire';
}

export function assertGraphiQLUrl(url: string, allowed: ReadonlySet<string>): void {
	const parsed = parseURL(url);
	if (
		parsed.protocol !== 'https:' ||
		parsed.auth ||
		parsed.hash ||
		!allowed.has(url) ||
		![
			'api.github.com',
			'codeload.github.com',
			'registry.npmjs.org',
			'registry.yarnpkg.com',
			'cdn.jsdelivr.net',
		].includes(parsed.host ?? '')
	)
		throw new Error('GraphiQL URL is outside exact consent');
}

function yarnValue(line: string, prefix: string): string {
	if (!line.startsWith(prefix) || !line.endsWith('"'))
		throw new Error('GraphiQL Yarn lock field is malformed');
	return line.slice(prefix.length, -1);
}

export function analyzeGraphiQLYarnLock(bytes: Buffer): {
	artifacts: GraphiQLYarnArtifact[];
	placements: number;
	digest: string;
} {
	const text = bytes.toString('utf8');
	if (!text.includes('# yarn lockfile v1')) throw new Error('GraphiQL requires Yarn lock v1');
	const byUrl = new Map<string, GraphiQLYarnArtifact>();
	const mirrorUrls = new Map<string, string>();
	let selectors: string[] = [];
	let version: string | undefined;
	let resolved: string | undefined;
	let integrity: string | undefined;
	let placements = 0;
	const flush = (): void => {
		if (selectors.length === 0 && version === undefined && resolved === undefined) return;
		if (selectors.length === 0 || !version || !resolved)
			throw new Error('GraphiQL Yarn lock stanza lacks immutable fields');
		const parsed = parseURL(resolved);
		const sha1 = parsed.hash.slice(1);
		parsed.hash = '';
		const historicalHttp = parsed.protocol === 'http:' && parsed.host === 'registry.npmjs.org';
		if (historicalHttp) parsed.protocol = 'https:';
		const url = stringifyParsedURL(parsed);
		const parts = parsed.pathname.split('/').filter(Boolean);
		const marker = parts.indexOf('-');
		const name = decodeURIComponent(parts.slice(0, marker).join('/'));
		const lockIntegrity = integrity;
		if (
			(parsed.protocol !== 'https:' && !historicalHttp) ||
			!['registry.yarnpkg.com', 'registry.npmjs.org'].includes(parsed.host ?? '') ||
			parsed.auth ||
			parsed.search ||
			marker < 1 ||
			!name ||
			!lowerHex40.test(sha1) ||
			(lockIntegrity !== undefined &&
				!(
					[
						['sha512-', 64],
						['sha1-', 20],
					] as const
				).some(
					([prefix, length]) =>
						lockIntegrity.startsWith(prefix) &&
						Buffer.from(lockIntegrity.slice(prefix.length), 'base64').length === length,
				))
		)
			throw new Error('GraphiQL Yarn lock origin or checksum differs');
		const archiveName = basename(parsed.pathname);
		const mirror = name.startsWith('@')
			? `${name.slice(0, name.indexOf('/'))}-${archiveName}`
			: archiveName;
		const collision = mirrorUrls.get(mirror);
		if (collision && collision !== url)
			throw new Error('GraphiQL Yarn mirror basename collides');
		mirrorUrls.set(mirror, url);
		placements += selectors.length;
		const prior = byUrl.get(url);
		if (prior && (prior.sha1 !== sha1 || prior.integrity !== (integrity ?? null)))
			throw new Error('GraphiQL Yarn same-URL checksum conflicts');
		if (prior) prior.selectors.push(...selectors);
		else
			byUrl.set(url, {
				url,
				sha1,
				integrity: integrity ?? null,
				selectors: [...selectors],
				name,
				version,
				mirror,
			});
		selectors = [];
		version = undefined;
		resolved = undefined;
		integrity = undefined;
	};
	for (const line of text.split('\n')) {
		if (line && !line.startsWith(' ') && line.endsWith(':')) {
			flush();
			selectors = line.slice(0, -1).split(', ');
		} else if (line.startsWith('  version "')) version = yarnValue(line, '  version "');
		else if (line.startsWith('  resolved "')) resolved = yarnValue(line, '  resolved "');
		else if (line.startsWith('  integrity ')) integrity = line.slice('  integrity '.length);
	}
	flush();
	const artifacts = [...byUrl.values()].sort((left, right) => compare(left.url, right.url));
	if (artifacts.length < 300 || artifacts.length > 2_400)
		throw new Error('GraphiQL Yarn closure cardinality differs');
	return { artifacts, placements, digest: sha256(canonicalize(artifacts)) };
}

export function assertGraphiQLArchiveEntries(entries: string[]): void {
	if (entries.length < 285 || entries.length > 20_000)
		throw new Error('GraphiQL archive cardinality differs');
	let rootName: string | undefined;
	for (const entry of entries) {
		const parts = entry.split('/');
		if (
			!entry ||
			entry.startsWith('/') ||
			entry.includes('\\') ||
			parts.includes('..') ||
			!parts[0]
		)
			throw new Error('GraphiQL archive path is unsafe');
		rootName ??= parts[0];
		if (parts[0] !== rootName) throw new Error('GraphiQL archive root differs');
	}
}

export function assertGraphiQLTreeRows(rows: TreeRow[]): void {
	if (rows.length !== 285) throw new Error('GraphiQL tree cardinality differs');
	const paths = new Set<string>();
	for (const row of rows) {
		const parts = row.path.split('/');
		if (
			!row.path ||
			row.path.startsWith('/') ||
			row.path.includes('\\') ||
			parts.some((part) => !part || part === '.' || part === '..') ||
			paths.has(row.path) ||
			!lowerHex40.test(row.sha)
		)
			throw new Error('GraphiQL tree row identity differs');
		paths.add(row.path);
		if (row.type === 'blob') {
			if (
				!['100644', '100755'].includes(row.mode) ||
				!Number.isSafeInteger(row.size) ||
				(row.size ?? -1) < 0
			)
				throw new Error('GraphiQL tree blob mode or size differs');
		} else if (row.type === 'tree') {
			if (row.mode !== '040000' || row.size !== undefined)
				throw new Error('GraphiQL tree directory identity differs');
		} else throw new Error('GraphiQL tree contains symlink, submodule or special row');
	}
}

const packageEdges = Object.freeze({
	'es6-promise@4.0.5': {},
	'fetch@0.9.0': {},
	'react@15.4.2': { fbjs: '^0.8.4', 'loose-envify': '^1.1.0', 'object-assign': '^4.1.1' },
	'react-dom@15.4.2': {
		fbjs: '^0.8.4',
		'loose-envify': '^1.1.0',
		'object-assign': '^4.1.1',
	},
	'react@18.3.1': { 'loose-envify': '^1.1.0' },
	'react-dom@18.3.1': { 'loose-envify': '^1.1.0', scheduler: '^0.23.2' },
	'scheduler@0.23.2': { 'loose-envify': '^1.1.0' },
	'loose-envify@1.4.0': { 'js-tokens': '^3.0.0 || ^4.0.0' },
	'js-tokens@4.0.0': {},
} as const);

export function assertGraphiQLPackageEdges(
	name: string,
	version: string,
	dependencies: unknown,
): void {
	const expected = packageEdges[`${name}@${version}` as keyof typeof packageEdges];
	if (!expected || canonicalize(dependencies ?? {}) !== canonicalize(expected))
		throw new Error('GraphiQL supplemental package dependency edges differ');
}

async function execute(command: string, args: string[], cwd = root): Promise<string> {
	return await new Promise((resolvePromise, reject) => {
		const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		child.stdout.on('data', (value: Buffer) => stdout.push(value));
		child.stderr.on('data', (value: Buffer) => stderr.push(value));
		child.once('error', reject);
		child.once('exit', (code) =>
			code === 0
				? resolvePromise(Buffer.concat(stdout).toString('utf8'))
				: reject(
						new Error(`${basename(command)} exited ${code}: ${Buffer.concat(stderr)}`),
					),
		);
	});
}

function originFor(url: string): LedgerRow['origin'] {
	const host = parseURL(url).host;
	if (host === 'cdn.jsdelivr.net') return 'cdn';
	if (host === 'registry.npmjs.org' || host === 'registry.yarnpkg.com') return 'registry';
	return 'github';
}

export async function collectGraphiQLIdentityStream(
	stream: Readable,
	limit: number,
	onWire: (bytes: number) => void = () => undefined,
): Promise<Buffer> {
	return await new Promise((resolvePromise, reject) => {
		const chunks: Buffer[] = [];
		let size = 0;
		stream.on('data', (chunk: Buffer) => {
			size += chunk.length;
			onWire(chunk.length);
			if (size > limit) stream.destroy(new Error('GraphiQL response byte cap exceeded'));
			else chunks.push(chunk);
		});
		stream.once('end', () => resolvePromise(Buffer.concat(chunks)));
		stream.once('error', reject);
	});
}

export async function collectGraphiQLResponseBoundary(
	stream: Readable,
	limit: number,
	boundaryAccepted: boolean,
	onWire: (bytes: number) => void = () => undefined,
): Promise<Buffer> {
	const bytes = await collectGraphiQLIdentityStream(stream, limit, onWire);
	if (!boundaryAccepted) throw new Error('GraphiQL response boundary differs');
	return bytes;
}

function assertTransferTotals(state: NetworkState): void {
	if (
		state.wire.github > 50 * 1024 * 1024 ||
		state.decoded.github > 50 * 1024 * 1024 ||
		state.wire.registry > 750 * 1024 * 1024 ||
		state.decoded.registry > 750 * 1024 * 1024 ||
		state.wire.cdn > 20 * 1024 * 1024 ||
		state.decoded.cdn > 20 * 1024 * 1024
	)
		throw new Error('GraphiQL aggregate byte cap exceeded');
}

async function fetchExact(
	url: string,
	allowed: ReadonlySet<string>,
	state: NetworkState,
): Promise<Buffer> {
	assertGraphiQLUrl(url, allowed);
	state.requests += 1;
	if (state.requests > 2_500) throw new Error('GraphiQL response cap exceeded');
	const origin = originFor(url);
	const perResponse =
		origin === 'cdn'
			? 5 * 1024 * 1024
			: origin === 'registry'
				? 10 * 1024 * 1024
				: 25 * 1024 * 1024;
	let observedWire = 0;
	let bytes: Buffer;
	try {
		bytes = await new Promise<Buffer>((resolvePromise, reject) => {
			const outbound = request(
				url,
				{
					method: 'GET',
					headers: {
						accept: '*/*',
						'accept-encoding': 'identity',
						'user-agent': 'versionless-t577',
					},
				},
				(response) => {
					const boundaryAccepted = !(
						response.statusCode !== 200 ||
						response.headers.location ||
						response.headers['set-cookie'] ||
						(response.headers['content-encoding'] !== undefined &&
							response.headers['content-encoding'] !== 'identity')
					);
					collectGraphiQLResponseBoundary(
						response,
						perResponse,
						boundaryAccepted,
						(size) => {
							observedWire += size;
						},
					).then(resolvePromise, reject);
				},
			);
			outbound.setTimeout(20_000, () =>
				outbound.destroy(new Error('GraphiQL response timeout')),
			);
			outbound.once('error', reject);
		});
	} catch (error) {
		state.wire[origin] += observedWire;
		state.decoded[origin] += observedWire;
		let boundaryError: unknown = error;
		try {
			assertTransferTotals(state);
		} catch (aggregateError) {
			boundaryError = aggregateError;
		}
		state.ledger.push({
			ordinal: state.requests,
			origin,
			url,
			result: 'failed',
			wireBytes: observedWire,
			decodedBytes: observedWire,
			sha256: null,
			sha512: null,
		});
		throw boundaryError;
	}
	state.responses += 1;
	state.wire[origin] += observedWire;
	state.decoded[origin] += bytes.length;
	assertTransferTotals(state);
	if (observedWire !== bytes.length)
		throw new Error('GraphiQL identity transfer counters differ');
	state.ledger.push({
		ordinal: state.requests,
		origin,
		url,
		result: 'accepted',
		wireBytes: observedWire,
		decodedBytes: bytes.length,
		sha256: sha256(bytes),
		sha512: createHash('sha512').update(bytes).digest('hex'),
	});
	return bytes;
}

async function filesBelow(directory: string): Promise<string[]> {
	const result: string[] = [];
	const visit = async (current: string): Promise<void> => {
		for (const entry of await readdir(current, { withFileTypes: true })) {
			const absolute = join(current, entry.name);
			if (entry.isDirectory()) await visit(absolute);
			else if (entry.isFile()) result.push(absolute);
			else throw new Error('GraphiQL source contains a special filesystem entry');
		}
	};
	await visit(directory);
	return result.sort(compare);
}

async function verifySourceTree(source: string, rows: TreeRow[]): Promise<void> {
	const blobs = new Map(rows.filter((row) => row.type === 'blob').map((row) => [row.path, row]));
	for (const file of await filesBelow(source)) {
		const path = relative(source, file);
		const bytes = await readFile(file);
		const row = blobs.get(path);
		if (
			!row ||
			(row.mode !== '100644' && row.mode !== '100755') ||
			row.size !== bytes.length ||
			row.sha !== gitBlobSha(bytes)
		)
			throw new Error(`GraphiQL Git tree identity differs: ${path}`);
		blobs.delete(path);
	}
	if (blobs.size !== 0) throw new Error('GraphiQL archive omits Git blobs');
}

function verifyIdentity(bytes: Buffer, identity: SourceIdentity): void {
	if (
		(identity.bytes !== undefined && bytes.length !== identity.bytes) ||
		sha256(bytes) !== identity.sha256 ||
		gitBlobSha(bytes) !== identity.gitSha
	)
		throw new Error(`GraphiQL immutable source identity differs: ${identity.path}`);
}

async function sealFailure(message: string, state: NetworkState): Promise<void> {
	await createGraphiQLAttemptParent(failurePath);
	if (await exists(failurePath)) return;
	const receipt = {
		schemaVersion: 'versionless.react-graphiql-013-terminal-exclusion.v1',
		result: 'terminal-exclusion',
		consentId: REACT_GRAPHIQL_CONSENT,
		invoked: true,
		retry: false,
		reusable: false,
		counted: false,
		requestAttempts: state.requests,
		successfulResponses: state.responses,
		positiveResidue: false,
		failure:
			message.includes('response') || message.includes('URL')
				? 'network-boundary-failed'
				: message.includes('identity') ||
					  message.includes('checksum') ||
					  message.includes('integrity')
					? 'immutable-identity-failed'
					: message.includes('cap')
						? 'resource-cap-failed'
						: 'acquisition-boundary-failed',
		access: { ledger: state.ledger, wire: state.wire, decoded: state.decoded },
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	receipt.integrity.canonicalDigest = sha256(canonicalize(receipt));
	await writeFile(failurePath, `${canonicalize(receipt)}\n`, { flag: 'wx' });
}

export async function verifyGraphiQLIngest(): Promise<{ valid: true; digest: string }> {
	const fixture = JSON.parse(await readFile(fixturePath, 'utf8')) as Fixture;
	const receipt = JSON.parse(await readFile(join(cacheRoot, 'receipt.json'), 'utf8')) as {
		schemaVersion?: unknown;
		result?: unknown;
		counted?: unknown;
		consentId?: unknown;
		provenance?: Record<string, unknown>;
		closure?: Record<string, unknown>;
		assets?: Array<Record<string, unknown>>;
		supplemental?: Array<Record<string, unknown>>;
		dependencies?: Array<Record<string, unknown>>;
		access?: Record<string, unknown>;
		policy?: Record<string, unknown>;
		integrity?: { canonicalDigest?: string };
		files?: Array<{ path: string; sha256: string }>;
	};
	const expected = receipt.integrity?.canonicalDigest;
	if (
		receipt.schemaVersion !== 'versionless.react-graphiql-013-ingest.v1' ||
		receipt.result !== 'pass' ||
		receipt.counted !== false ||
		receipt.consentId !== REACT_GRAPHIQL_CONSENT ||
		!expected ||
		!lowerHex64.test(expected) ||
		sha256(
			canonicalize({ ...receipt, integrity: { algorithm: 'sha256', canonicalDigest: '' } }),
		) !== expected
	)
		throw new Error('GraphiQL ingest receipt integrity differs');
	if (
		canonicalize(receipt.provenance) !==
			canonicalize({
				repository: fixture.repository,
				revision: fixture.revision,
				tree: fixture.tree,
				archiveSha256: receipt.provenance?.archiveSha256,
			}) ||
		!lowerHex64.test(String(receipt.provenance?.archiveSha256 ?? ''))
	)
		throw new Error('GraphiQL ingest provenance linkage differs');
	if (!Array.isArray(receipt.files) || receipt.files.length === 0)
		throw new Error('GraphiQL ingest file inventory differs');
	const seenFiles = new Set<string>();
	for (const file of receipt.files) {
		if (
			!file.path ||
			isAbsolute(file.path) ||
			normalize(file.path) !== file.path ||
			file.path.startsWith('../') ||
			seenFiles.has(file.path) ||
			!lowerHex64.test(file.sha256)
		)
			throw new Error('GraphiQL ingest file inventory differs');
		seenFiles.add(file.path);
		if (sha256(await readFile(join(cacheRoot, file.path))) !== file.sha256)
			throw new Error(`GraphiQL cached file differs: ${file.path}`);
	}
	const actualFiles = (await filesBelow(cacheRoot))
		.map((path) => relative(cacheRoot, path))
		.filter((path) => path !== 'receipt.json');
	if (canonicalize(actualFiles) !== canonicalize([...seenFiles].sort(compare)))
		throw new Error('GraphiQL cache file set differs');
	for (const identity of Object.values(fixture.source)) {
		const bytes = await readFile(join(cacheRoot, 'source', identity.path));
		verifyIdentity(bytes, identity);
		if (!seenFiles.has(`source/${identity.path}`))
			throw new Error('GraphiQL critical source file is omitted from inventory');
	}
	if (
		canonicalize(receipt.policy) !==
		canonicalize({
			lifecycleExecuted: false,
			nativeExecuted: false,
			defaultNetwork: 'offline',
			certification: false,
		})
	)
		throw new Error('GraphiQL ingest policy differs');
	const access = receipt.access ?? {};
	const ledger = access.ledger;
	if (
		access.credentials !== false ||
		access.cookies !== false ||
		access.redirects !== 0 ||
		access.retries !== 0 ||
		!Array.isArray(ledger) ||
		access.requests !== ledger.length ||
		access.responses !== ledger.length
	)
		throw new Error('GraphiQL ingest access summary differs');
	const wire = access.wire as Record<string, unknown>;
	const decoded = access.decoded as Record<string, unknown>;
	for (const origin of ['github', 'registry', 'cdn'] as const) {
		const rows = ledger
			.filter((value) => objectRecord(value).origin === origin)
			.map(objectRecord);
		if (
			wire?.[origin] !== rows.reduce((sum, row) => sum + Number(row.wireBytes), 0) ||
			decoded?.[origin] !== rows.reduce((sum, row) => sum + Number(row.decodedBytes), 0)
		)
			throw new Error('GraphiQL ingest access byte totals differ');
	}
	for (const [index, value] of ledger.entries()) {
		const row = objectRecord(value);
		if (
			row.ordinal !== index + 1 ||
			row.result !== 'accepted' ||
			!['github', 'registry', 'cdn'].includes(String(row.origin)) ||
			typeof row.url !== 'string' ||
			!lowerHex64.test(String(row.sha256 ?? '')) ||
			!lowerHex64.test(String(row.sha512 ?? '')) ||
			typeof row.wireBytes !== 'number' ||
			!Number.isSafeInteger(row.wireBytes) ||
			row.wireBytes < 1 ||
			typeof row.decodedBytes !== 'number' ||
			!Number.isSafeInteger(row.decodedBytes) ||
			row.decodedBytes < 1 ||
			row.wireBytes !== row.decodedBytes
		)
			throw new Error('GraphiQL ingest access ledger differs');
	}
	const replayedClosure = analyzeGraphiQLYarnLock(
		await readFile(join(cacheRoot, 'source/yarn.lock')),
	);
	if (
		receipt.closure?.artifacts !== replayedClosure.artifacts.length ||
		receipt.closure.placements !== replayedClosure.placements ||
		receipt.closure.digest !== replayedClosure.digest
	)
		throw new Error('GraphiQL cached Yarn closure replay differs');
	if (
		Number(wire.github) > 50 * 1024 * 1024 ||
		Number(decoded.github) > 50 * 1024 * 1024 ||
		Number(wire.registry) > 750 * 1024 * 1024 ||
		Number(decoded.registry) > 750 * 1024 * 1024 ||
		Number(wire.cdn) > 20 * 1024 * 1024 ||
		Number(decoded.cdn) > 20 * 1024 * 1024 ||
		ledger.length > 2_500
	)
		throw new Error('GraphiQL ingest replay caps differ');
	const supplementalCoordinates = [
		...fixture.cdnAssets.map(({ package: name, version }) => ({ name, version })),
		{ name: 'react', version: '18.3.1' },
		{ name: 'react-dom', version: '18.3.1' },
		{ name: 'scheduler', version: '0.23.2' },
		{ name: 'loose-envify', version: '1.4.0' },
		{ name: 'js-tokens', version: '4.0.0' },
	];
	const expectedLedgerUrls = [
		fixture.commitUrl,
		fixture.treeUrl,
		fixture.archiveUrl,
		...replayedClosure.artifacts.map((artifact) => artifact.url),
		...fixture.cdnAssets.map((asset) => asset.url),
		...supplementalCoordinates.flatMap(({ name, version }) => [
			`https://registry.npmjs.org/${name}/${version}`,
			`https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`,
		]),
	];
	assertGraphiQLAccessReplay({ ledger, expectedUrls: expectedLedgerUrls, wire, decoded });
	if (
		canonicalize(ledger.map((value) => objectRecord(value).url)) !==
			canonicalize(expectedLedgerUrls) ||
		ledger.some((value) => {
			const row = objectRecord(value);
			return row.origin !== originFor(String(row.url));
		})
	)
		throw new Error('GraphiQL exact access ledger URL graph differs');
	const archiveLedger = ledger.find((value) => objectRecord(value).url === fixture.archiveUrl);
	if (!archiveLedger || objectRecord(archiveLedger).sha256 !== receipt.provenance?.archiveSha256)
		throw new Error('GraphiQL archive ledger provenance differs');
	const assets = receipt.assets ?? [];
	if (
		assets.length !== 4 ||
		new Set(assets.map((asset) => `${asset.package}@${asset.version}`)).size !== 4 ||
		canonicalize(
			assets.map((asset) => ({
				package: asset.package,
				version: asset.version,
				url: asset.url,
			})),
		) !== canonicalize(fixture.cdnAssets) ||
		assets.some(
			(asset) =>
				!lowerHex64.test(String(asset.sha256 ?? '')) ||
				!lowerHex64.test(String(asset.sha512 ?? '')) ||
				!seenFiles.has(`assets/${basename(parseURL(String(asset.url)).pathname)}`),
		)
	)
		throw new Error('GraphiQL CDN asset linkage differs');
	const expectedSupplemental = [
		...fixture.cdnAssets.map(({ package: name, version }) => `${name}@${version}`),
		'react@18.3.1',
		'react-dom@18.3.1',
		'scheduler@0.23.2',
		'loose-envify@1.4.0',
		'js-tokens@4.0.0',
	].sort(compare);
	const supplemental = receipt.supplemental ?? [];
	const actualSupplemental = supplemental
		.map((row) => `${String(row.name)}@${String(row.version)}`)
		.sort(compare);
	if (
		canonicalize(actualSupplemental) !== canonicalize(expectedSupplemental) ||
		new Set(actualSupplemental).size !== actualSupplemental.length ||
		supplemental.some((row) => {
			const key = `${String(row.name)}-${String(row.version)}`;
			return (
				!lowerHex64.test(String(row.metadataSha256 ?? '')) ||
				!lowerHex64.test(String(row.tarballSha256 ?? '')) ||
				!seenFiles.has(`supplemental/${key}.metadata.json`) ||
				!seenFiles.has(`supplemental/${key}.tgz`) ||
				!row.inspection ||
				typeof row.inspection !== 'object'
			);
		})
	)
		throw new Error('GraphiQL supplemental package linkage differs');
	if (
		!receipt.closure ||
		receipt.closure.artifacts !== receipt.dependencies?.length ||
		!lowerHex64.test(String(receipt.closure.digest ?? '')) ||
		(receipt.dependencies ?? []).some(
			(row) =>
				!lowerHex64.test(String(row.sha256 ?? '')) ||
				!lowerHex64.test(String(row.sha512 ?? '')) ||
				!seenFiles.has(`mirror/${String(row.mirror)}`),
		)
	)
		throw new Error('GraphiQL Yarn closure linkage differs');
	const dependencyRows = receipt.dependencies ?? [];
	if (dependencyRows.length !== replayedClosure.artifacts.length)
		throw new Error('GraphiQL dependency row count differs');
	for (const artifact of replayedClosure.artifacts) {
		const row = dependencyRows.find(
			(value) => value.url === artifact.url && value.mirror === artifact.mirror,
		);
		if (
			!row ||
			canonicalize({
				url: row.url,
				sha1: row.sha1,
				integrity: row.integrity,
				selectors: row.selectors,
				name: row.name,
				version: row.version,
				mirror: row.mirror,
			}) !== canonicalize(artifact)
		)
			throw new Error('GraphiQL dependency row identity differs');
		const bytes = await readFile(join(cacheRoot, 'mirror', artifact.mirror));
		const ledgerRow = ledger.find((value) => objectRecord(value).url === artifact.url);
		if (
			!ledgerRow ||
			objectRecord(ledgerRow).sha256 !== sha256(bytes) ||
			objectRecord(ledgerRow).sha512 !== createHash('sha512').update(bytes).digest('hex') ||
			objectRecord(ledgerRow).decodedBytes !== bytes.length ||
			sha256(bytes) !== row.sha256 ||
			createHash('sha512').update(bytes).digest('hex') !== row.sha512 ||
			createHash('sha1').update(bytes).digest('hex') !== artifact.sha1 ||
			canonicalize(
				inspectNpmPackageTarball(bytes, [
					{ name: artifact.name, version: artifact.version },
				]),
			) !== canonicalize(row.metadata)
		)
			throw new Error('GraphiQL dependency mirror replay differs');
	}
	for (const asset of assets) {
		const bytes = await readFile(
			join(cacheRoot, 'assets', basename(parseURL(String(asset.url)).pathname)),
		);
		const ledgerRow = ledger.find((value) => objectRecord(value).url === asset.url);
		if (
			!ledgerRow ||
			objectRecord(ledgerRow).sha256 !== sha256(bytes) ||
			objectRecord(ledgerRow).sha512 !== createHash('sha512').update(bytes).digest('hex') ||
			objectRecord(ledgerRow).decodedBytes !== bytes.length ||
			bytes.length !== asset.bytes ||
			sha256(bytes) !== asset.sha256 ||
			createHash('sha512').update(bytes).digest('hex') !== asset.sha512
		)
			throw new Error('GraphiQL CDN asset replay differs');
	}
	for (const row of supplemental) {
		const name = String(row.name);
		const version = String(row.version);
		const key = `${name}-${version}`;
		const metadataBytes = await readFile(
			join(cacheRoot, 'supplemental', `${key}.metadata.json`),
		);
		const tarballPath = join(cacheRoot, 'supplemental', `${key}.tgz`);
		const tarball = await readFile(tarballPath);
		const metadata = JSON.parse(metadataBytes.toString('utf8')) as Record<string, unknown>;
		const dist = objectRecord(metadata.dist);
		const metadataLedger = ledger.find((value) => objectRecord(value).url === row.metadataUrl);
		const tarballLedger = ledger.find((value) => objectRecord(value).url === row.tarballUrl);
		if (
			!metadataLedger ||
			!tarballLedger ||
			objectRecord(metadataLedger).sha256 !== sha256(metadataBytes) ||
			objectRecord(metadataLedger).sha512 !==
				createHash('sha512').update(metadataBytes).digest('hex') ||
			objectRecord(metadataLedger).decodedBytes !== metadataBytes.length ||
			objectRecord(tarballLedger).sha256 !== sha256(tarball) ||
			objectRecord(tarballLedger).sha512 !==
				createHash('sha512').update(tarball).digest('hex') ||
			objectRecord(tarballLedger).decodedBytes !== tarball.length ||
			metadata.name !== name ||
			metadata.version !== version ||
			metadata.license === undefined ||
			row.metadataUrl !== `https://registry.npmjs.org/${name}/${version}` ||
			row.tarballUrl !== `https://registry.npmjs.org/${name}/-/${name}-${version}.tgz` ||
			dist.tarball !== row.tarballUrl ||
			typeof dist.integrity !== 'string' ||
			sha256(metadataBytes) !== row.metadataSha256 ||
			sha256(tarball) !== row.tarballSha256 ||
			createHash('sha512').update(tarball).digest('base64') !==
				String(dist.integrity).slice('sha512-'.length) ||
			canonicalize(inspectNpmPackageTarball(tarball, [{ name, version }])) !==
				canonicalize(row.inspection)
		)
			throw new Error('GraphiQL supplemental package replay differs');
		assertGraphiQLPackageEdges(name, version, metadata.dependencies);
		const required = row.requiredFiles;
		if (!Array.isArray(required))
			throw new Error('GraphiQL supplemental required files differ');
		const expectedRequired =
			name === 'react' && version === '18.3.1'
				? ['umd/react.production.min.js']
				: name === 'react-dom' && version === '18.3.1'
					? ['umd/react-dom.production.min.js']
					: [];
		if (
			canonicalize(required.map((value) => objectRecord(value).path)) !==
			canonicalize(expectedRequired)
		)
			throw new Error('GraphiQL supplemental required file set differs');
		for (const value of required) {
			const requiredFile = objectRecord(value);
			if (
				typeof requiredFile.path !== 'string' ||
				!lowerHex64.test(String(requiredFile.sha256 ?? '')) ||
				sha256(
					await execute('/usr/bin/tar', [
						'-xOzf',
						tarballPath,
						`package/${requiredFile.path}`,
					]),
				) !== requiredFile.sha256
			)
				throw new Error('GraphiQL supplemental required file replay differs');
		}
	}
	const dependency = JSON.parse(await readFile(dependencyReceiptPath, 'utf8')) as {
		schemaVersion?: unknown;
		counted?: unknown;
		closure?: unknown;
		assets?: unknown;
		supplemental?: unknown;
		dependencies?: unknown;
		integrity?: { canonicalDigest?: string };
	};
	const dependencyDigest = dependency.integrity?.canonicalDigest;
	if (
		dependency.schemaVersion !== 'versionless.react-graphiql-013-dependencies.v1' ||
		dependency.counted !== false ||
		!dependencyDigest ||
		!lowerHex64.test(dependencyDigest) ||
		sha256(
			canonicalize({
				...dependency,
				integrity: { algorithm: 'sha256', canonicalDigest: '' },
			}),
		) !== dependencyDigest
	)
		throw new Error('GraphiQL dependency receipt integrity differs');
	if (
		canonicalize({
			closure: dependency.closure,
			assets: dependency.assets,
			supplemental: dependency.supplemental,
			dependencies: dependency.dependencies,
		}) !==
		canonicalize({
			closure: receipt.closure,
			assets: receipt.assets,
			supplemental: receipt.supplemental,
			dependencies: receipt.dependencies,
		})
	)
		throw new Error('GraphiQL dependency receipt semantic linkage differs');
	const publicReceipt = await readFile(ingestReceiptPath);
	if (!publicReceipt.equals(await readFile(join(cacheRoot, 'receipt.json'))))
		throw new Error('GraphiQL published ingest receipt differs');
	return { valid: true, digest: expected };
}

export async function acquireGraphiQL(): Promise<void> {
	const state: NetworkState = {
		requests: 0,
		responses: 0,
		wire: { github: 0, registry: 0, cdn: 0 },
		decoded: { github: 0, registry: 0, cdn: 0 },
		ledger: [],
	};
	for (const path of [
		cacheRoot,
		stageRoot,
		workRoot,
		runRoot,
		ingestRoot,
		ingestReceiptPath,
		dependencyReceiptPath,
	])
		if (await exists(path)) throw new Error('GraphiQL acquisition requires fresh roots');
	await createGraphiQLAttemptParent();
	await writeFile(
		attemptPath,
		`${canonicalize({ schemaVersion: 'versionless.react-graphiql-013-attempt.v1', consentId: REACT_GRAPHIQL_CONSENT, invoked: true })}\n`,
		{ flag: 'wx' },
	);
	try {
		const fixture = JSON.parse(await readFile(fixturePath, 'utf8')) as Fixture;
		if (
			fixture.schemaVersion !== 'versionless.react-graphiql-013-fixture.v1' ||
			fixture.revision !== REACT_GRAPHIQL_REVISION ||
			fixture.tree !== REACT_GRAPHIQL_TREE ||
			fixture.cdnAssets.length !== 4
		)
			throw new Error('GraphiQL fixture identity differs');
		const allowed = new Set([
			fixture.commitUrl,
			fixture.treeUrl,
			fixture.archiveUrl,
			...fixture.cdnAssets.map((asset) => asset.url),
		]);
		const packageObjects = [
			...fixture.cdnAssets.map(({ package: name, version }) => ({ name, version })),
			{ name: 'react', version: '18.3.1' },
			{ name: 'react-dom', version: '18.3.1' },
			{ name: 'scheduler', version: '0.23.2' },
			{ name: 'loose-envify', version: '1.4.0' },
			{ name: 'js-tokens', version: '4.0.0' },
		];
		for (const object of packageObjects) {
			allowed.add(`https://registry.npmjs.org/${object.name}/${object.version}`);
			allowed.add(
				`https://registry.npmjs.org/${object.name}/-/${object.name}-${object.version}.tgz`,
			);
		}
		await mkdir(stageRoot, { recursive: true });
		const commit = JSON.parse(
			(await fetchExact(fixture.commitUrl, allowed, state)).toString('utf8'),
		) as { sha?: unknown; tree?: { sha?: unknown } };
		if (commit.sha !== REACT_GRAPHIQL_REVISION || commit.tree?.sha !== REACT_GRAPHIQL_TREE)
			throw new Error('GraphiQL commit-to-tree identity differs');
		const treeDocument = JSON.parse(
			(await fetchExact(fixture.treeUrl, allowed, state)).toString('utf8'),
		) as { truncated?: unknown; tree?: TreeRow[] };
		if (
			treeDocument.truncated !== false ||
			!Array.isArray(treeDocument.tree) ||
			treeDocument.tree.length !== 285
		)
			throw new Error('GraphiQL tree identity differs');
		assertGraphiQLTreeRows(treeDocument.tree);
		const archive = await fetchExact(fixture.archiveUrl, allowed, state);
		const archivePath = join(stageRoot, 'source.tar.gz');
		await writeFile(archivePath, archive);
		const listed = (await execute('/usr/bin/tar', ['-tzf', archivePath])).trim().split('\n');
		assertGraphiQLArchiveEntries(listed);
		const extractRoot = join(stageRoot, 'extract');
		await mkdir(extractRoot, { recursive: true });
		await execute('/usr/bin/tar', ['-xzf', archivePath, '-C', extractRoot]);
		const roots = await readdir(extractRoot);
		if (roots.length !== 1) throw new Error('GraphiQL archive root differs');
		const source = join(extractRoot, roots[0]!);
		await verifySourceTree(source, treeDocument.tree);
		for (const identity of Object.values(fixture.source))
			verifyIdentity(await readFile(join(source, identity.path)), identity);
		const closure = analyzeGraphiQLYarnLock(await readFile(join(source, 'yarn.lock')));
		for (const artifact of closure.artifacts) allowed.add(artifact.url);
		const mirror = join(stageRoot, 'mirror');
		await mkdir(mirror, { recursive: true });
		const dependencyRows: Array<Record<string, unknown>> = [];
		for (const artifact of closure.artifacts) {
			const bytes = await fetchExact(artifact.url, allowed, state);
			if (
				createHash('sha1').update(bytes).digest('hex') !== artifact.sha1 ||
				(artifact.integrity &&
					createHash(artifact.integrity.startsWith('sha512-') ? 'sha512' : 'sha1')
						.update(bytes)
						.digest('base64') !==
						artifact.integrity.slice(artifact.integrity.indexOf('-') + 1))
			)
				throw new Error('GraphiQL Yarn artifact checksum differs');
			const metadata = inspectNpmPackageTarball(bytes, [
				{ name: artifact.name, version: artifact.version },
			]);
			await writeFile(join(mirror, artifact.mirror), bytes, { flag: 'wx' });
			dependencyRows.push({
				...artifact,
				sha256: sha256(bytes),
				sha512: createHash('sha512').update(bytes).digest('hex'),
				metadata,
			});
		}
		const assetsRoot = join(stageRoot, 'assets');
		await mkdir(assetsRoot, { recursive: true });
		const assetRows: Array<Record<string, unknown>> = [];
		for (const asset of fixture.cdnAssets) {
			const bytes = await fetchExact(asset.url, allowed, state);
			await writeFile(join(assetsRoot, basename(parseURL(asset.url).pathname)), bytes, {
				flag: 'wx',
			});
			assetRows.push({
				...asset,
				bytes: bytes.length,
				sha256: sha256(bytes),
				sha512: createHash('sha512').update(bytes).digest('hex'),
			});
		}
		const supplementalRoot = join(stageRoot, 'supplemental');
		await mkdir(supplementalRoot, { recursive: true });
		const supplementalRows: Array<Record<string, unknown>> = [];
		for (const object of packageObjects) {
			const metadataUrl = `https://registry.npmjs.org/${object.name}/${object.version}`;
			const tarballUrl = `https://registry.npmjs.org/${object.name}/-/${object.name}-${object.version}.tgz`;
			const metadataBytes = await fetchExact(metadataUrl, allowed, state);
			const metadata = JSON.parse(metadataBytes.toString('utf8')) as {
				name?: unknown;
				version?: unknown;
				license?: unknown;
				dependencies?: unknown;
				dist?: { tarball?: unknown; integrity?: unknown };
			};
			if (
				metadata.name !== object.name ||
				metadata.version !== object.version ||
				metadata.dist?.tarball !== tarballUrl ||
				typeof metadata.dist.integrity !== 'string' ||
				metadata.license === undefined
			)
				throw new Error('GraphiQL supplemental package identity differs');
			assertGraphiQLPackageEdges(object.name, object.version, metadata.dependencies);
			const tarball = await fetchExact(tarballUrl, allowed, state);
			if (
				createHash('sha512').update(tarball).digest('base64') !==
				metadata.dist.integrity.slice('sha512-'.length)
			)
				throw new Error('GraphiQL supplemental package integrity differs');
			const inspection = inspectNpmPackageTarball(tarball, [object]);
			if (inspection.license.state === 'empty' || inspection.license.state === 'ambiguous')
				throw new Error('GraphiQL supplemental package license differs');
			const key = `${object.name}-${object.version}`;
			const tarballPath = join(supplementalRoot, `${key}.tgz`);
			await writeFile(join(supplementalRoot, `${key}.metadata.json`), metadataBytes, {
				flag: 'wx',
			});
			await writeFile(tarballPath, tarball, { flag: 'wx' });
			const requiredPaths =
				object.name === 'react' && object.version === '18.3.1'
					? ['umd/react.production.min.js']
					: object.name === 'react-dom' && object.version === '18.3.1'
						? ['umd/react-dom.production.min.js']
						: [];
			const requiredFiles = await Promise.all(
				requiredPaths.map(async (path) => ({
					path,
					sha256: sha256(
						await execute('/usr/bin/tar', ['-xOzf', tarballPath, `package/${path}`]),
					),
				})),
			);
			supplementalRows.push({
				...object,
				metadataUrl,
				tarballUrl,
				dependencies: metadata.dependencies ?? {},
				metadataSha256: sha256(metadataBytes),
				tarballSha256: sha256(tarball),
				requiredFiles,
				inspection,
			});
		}
		const publishRoot = join(stageRoot, 'publish');
		await mkdir(publishRoot, { recursive: true });
		await rename(source, join(publishRoot, 'source'));
		await rename(mirror, join(publishRoot, 'mirror'));
		await rename(assetsRoot, join(publishRoot, 'assets'));
		await rename(supplementalRoot, join(publishRoot, 'supplemental'));
		const files = (await filesBelow(publishRoot)).map(async (path) => ({
			path: relative(publishRoot, path),
			sha256: sha256(await readFile(path)),
		}));
		const receipt = {
			schemaVersion: 'versionless.react-graphiql-013-ingest.v1',
			result: 'pass',
			counted: false,
			consentId: REACT_GRAPHIQL_CONSENT,
			provenance: {
				repository: fixture.repository,
				revision: fixture.revision,
				tree: fixture.tree,
				archiveSha256: sha256(archive),
			},
			closure: {
				artifacts: dependencyRows.length,
				placements: closure.placements,
				digest: closure.digest,
			},
			assets: assetRows,
			supplemental: supplementalRows,
			dependencies: dependencyRows,
			access: {
				requests: state.requests,
				responses: state.responses,
				credentials: false,
				cookies: false,
				redirects: 0,
				retries: 0,
				wire: state.wire,
				decoded: state.decoded,
				ledger: state.ledger,
			},
			files: await Promise.all(files),
			policy: {
				lifecycleExecuted: false,
				nativeExecuted: false,
				defaultNetwork: 'offline',
				certification: false,
			},
			integrity: { algorithm: 'sha256', canonicalDigest: '' },
		};
		receipt.integrity.canonicalDigest = sha256(canonicalize(receipt));
		await writeFile(join(publishRoot, 'receipt.json'), `${canonicalize(receipt)}\n`, {
			flag: 'wx',
		});
		const dependencyReceipt = {
			schemaVersion: 'versionless.react-graphiql-013-dependencies.v1',
			counted: false,
			closure: receipt.closure,
			assets: assetRows,
			supplemental: supplementalRows,
			dependencies: dependencyRows,
			integrity: { algorithm: 'sha256', canonicalDigest: '' },
		};
		dependencyReceipt.integrity.canonicalDigest = sha256(canonicalize(dependencyReceipt));
		const stagedDependencyReceipt = join(stageRoot, 'dependency-receipt.json');
		const stagedIngestReceipt = join(stageRoot, 'ingest-receipt.json');
		await writeFile(stagedDependencyReceipt, `${canonicalize(dependencyReceipt)}\n`, {
			flag: 'wx',
		});
		await writeFile(stagedIngestReceipt, `${canonicalize(receipt)}\n`, { flag: 'wx' });
		await mkdir(cacheParent, { recursive: true });
		await rename(publishRoot, cacheRoot);
		await mkdir(dependencyRoot, { recursive: true });
		await rename(stagedDependencyReceipt, dependencyReceiptPath);
		await mkdir(dirname(ingestReceiptPath), { recursive: true });
		await rename(stagedIngestReceipt, ingestReceiptPath);
		await rm(stageRoot, { recursive: true, force: true });
		await verifyGraphiQLIngest();
		await verifyGraphiQLIngest();
	} catch (error) {
		await rm(cacheParent, { recursive: true, force: true });
		await rm(stageParent, { recursive: true, force: true });
		await rm(workParent, { recursive: true, force: true });
		await rm(runRoot, { recursive: true, force: true });
		await rm(ingestReceiptPath, { force: true });
		await rm(dependencyRoot, { recursive: true, force: true });
		await sealFailure(error instanceof Error ? error.message : String(error), state);
		throw error;
	}
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const mode = parseGraphiQLLauncher(args);
	if (mode === 'launcher-smoke') {
		process.stdout.write(
			`${canonicalize({ result: 'pass', mode, consentId: REACT_GRAPHIQL_CONSENT, requestAttempts: 0 })}\n`,
		);
		return;
	}
	await acquireGraphiQL();
	process.stdout.write(
		`${canonicalize({ result: 'pass', consentId: REACT_GRAPHIQL_CONSENT })}\n`,
	);
}

if (basename(process.argv[1] ?? '') === 'react-graphiql-013-ingest.ts')
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
