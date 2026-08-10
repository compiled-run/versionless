import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { request } from 'node:https';
import type { Readable } from 'node:stream';
import { createGunzip } from 'node:zlib';
import { charIn, createRegExp } from 'magic-regexp';
import { basename, extname, join, relative, resolve } from 'pathe';
import { joinURL, parseURL } from 'ufo';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';
import { inspectNpmPackageTarball } from '../../../core/src/receipts/npm-lock-acquisition-preflight.ts';

export const REACT_CALCULATOR_CONSENT =
	'T574-official-source-andrewagain-calculator-react16-production-corrected' as const;
export const REACT_CALCULATOR_REVISION = '37b56077e78b82bf2088ec993d55becb47538de9' as const;
export const REACT_CALCULATOR_TREE = 'd173cbae55964a2553c308ebbb7ed6e2d14f9a8a' as const;
export const REACT_CALCULATOR_TARGET_PACKAGES = Object.freeze([
	Object.freeze({ name: 'react', version: '18.3.1' }),
	Object.freeze({ name: 'react-dom', version: '18.3.1' }),
	Object.freeze({ name: 'scheduler', version: '0.23.2' }),
]);

const root = resolve(import.meta.dirname, '../../../..');
const fixturePath = join(root, 'fixtures/react-calculator/fixture.json');
const cacheRoot = join(root, '.versionless/cache/react-calculator/t574');
const stageRoot = join(root, '.versionless/stage/react-calculator/t574');
const workRoot = join(root, '.versionless/work/react-calculator/t574');
const runRoot = join(root, 'evidence/runs/react-calculator-react16-to-vite8');
const ingestEvidenceRoot = join(root, 'evidence/ingests/react-calculator');
const dependencyEvidenceRoot = join(root, 'evidence/dependencies/react-calculator');
const attemptPath = join(ingestEvidenceRoot, 't574/attempt.json');
const failurePath = join(ingestEvidenceRoot, 't574/consumed-failed.json');
const maximumResponses = 5_100;
const maximumArtifacts = 2_500;
const maximumGitHubResponseBytes = 25 * 1024 * 1024;
const maximumRegistryResponseBytes = 10 * 1024 * 1024;
const maximumDecodedBytes = 750 * 1024 * 1024;
const requestTimeoutMilliseconds = 20_000;
const hexadecimal40 = createRegExp(
	charIn('0123456789').from('a', 'f').times(40).at.lineStart().at.lineEnd(),
);

type Fixture = {
	schemaVersion: string;
	repository: string;
	historicalAlias: string;
	revision: typeof REACT_CALCULATOR_REVISION;
	tree: typeof REACT_CALCULATOR_TREE;
	commitUrl: string;
	treeUrl: string;
	archiveUrl: string;
	baseline: {
		manifest: { react: string; reactDom: string; reactScripts: string; bigJs: string };
		locked: { react: string; reactDom: string; reactScripts: string; bigJs: string };
		packageManager: string;
	};
	target: { node: string; react: string; reactDom: string; vite: string };
};
type GitTreeRow = { path: string; mode: string; type: string; sha: string; size?: number };
type LockNode = {
	version?: unknown;
	resolved?: unknown;
	integrity?: unknown;
	dependencies?: unknown;
	optional?: unknown;
};
export type CalculatorLockArtifact = {
	name: string;
	version: string;
	resolved: string;
	integrity: string;
	placements: string[];
	metadataUrl: string;
	mirror: string;
};
export type CalculatorTargetArtifact = {
	name: string;
	version: string;
	metadataUrl: string;
	resolved: string;
	integrity: string;
	shasum: string;
	dependencies: Record<string, string>;
	mirror: string;
	sha256: string;
	sha512: string;
	bytes: number;
	license: string | 'unknown';
	lifecycleScripts: string[];
	native: boolean;
};
type LedgerRow = {
	ordinal: number;
	url: string;
	media: 'json' | 'binary';
	bytes: number;
	sha256: string;
	wireBytes: number;
	wireSha256: string;
	encoding: 'absent' | 'identity' | 'gzip';
	responseCookiePresent: boolean;
};
export type CalculatorNetworkState = {
	requests: number;
	responses: number;
	wireBytes: number;
	decodedBytes: number;
	cookieResponses: number;
	ledger: LedgerRow[];
};
export type CalculatorResponseEncoding = 'absent' | 'identity' | 'gzip';
export type CalculatorResponseFailureCode =
	| 'response-wire-cap-exceeded'
	| 'response-decoded-cap-exceeded'
	| 'response-gzip-decode-failed'
	| 'response-stream-error';

export class CalculatorResponseError extends Error {
	readonly code: CalculatorResponseFailureCode;

	constructor(code: CalculatorResponseFailureCode) {
		super(code);
		this.name = 'CalculatorResponseError';
		this.code = code;
	}
}
type LauncherMode = 'launcher-smoke' | 'acquire';

const exists = (path: string): Promise<boolean> =>
	access(path).then(
		() => true,
		() => false,
	);
const compareText = (left: string, right: string): number =>
	left < right ? -1 : left > right ? 1 : 0;

function gitBlobSha(bytes: Uint8Array): string {
	return createHash('sha1')
		.update(Buffer.from(`blob ${bytes.length}\0`))
		.update(bytes)
		.digest('hex');
}

function integrityMatches(bytes: Uint8Array, integrity: string): boolean {
	const separator = integrity.indexOf('-');
	if (separator < 1 || integrity.indexOf(' ', separator) >= 0) return false;
	const algorithm = integrity.slice(0, separator);
	if (algorithm !== 'sha1' && algorithm !== 'sha512') return false;
	return createHash(algorithm).update(bytes).digest('base64') === integrity.slice(separator + 1);
}

function exactTargetDependencies(name: string): Record<string, string> {
	if (name === 'react') return { 'loose-envify': '^1.1.0' };
	if (name === 'react-dom') return { 'loose-envify': '^1.1.0', scheduler: '^0.23.2' };
	if (name === 'scheduler') return { 'loose-envify': '^1.1.0' };
	throw new Error('React Calculator target package is outside exact scope');
}

export function parseReactCalculatorTargetMetadata(
	value: unknown,
	target: { name: string; version: string },
): Omit<
	CalculatorTargetArtifact,
	'mirror' | 'sha256' | 'sha512' | 'bytes' | 'license' | 'lifecycleScripts' | 'native'
> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error('React Calculator target metadata differs');
	const row = value as {
		name?: unknown;
		version?: unknown;
		dist?: { tarball?: unknown; integrity?: unknown; shasum?: unknown };
		dependencies?: unknown;
	};
	if (
		!row.dependencies ||
		typeof row.dependencies !== 'object' ||
		Array.isArray(row.dependencies)
	)
		throw new Error('React Calculator target dependency edges differ');
	const dependencies = Object.fromEntries(
		Object.entries(row.dependencies as Record<string, unknown>)
			.map(([name, version]) => {
				if (typeof version !== 'string')
					throw new Error('React Calculator target dependency edges differ');
				return [name, version];
			})
			.sort(([left], [right]) => compareText(left, right)),
	) as Record<string, string>;
	const metadataUrl = joinURL(
		'https://registry.npmjs.org',
		encodeURIComponent(target.name),
		encodeURIComponent(target.version),
	);
	const resolved = joinURL(
		'https://registry.npmjs.org',
		encodeURIComponent(target.name),
		'-',
		`${target.name}-${target.version}.tgz`,
	);
	if (
		row.name !== target.name ||
		row.version !== target.version ||
		row.dist?.tarball !== resolved ||
		typeof row.dist.integrity !== 'string' ||
		!row.dist.integrity.startsWith('sha512-') ||
		typeof row.dist.shasum !== 'string' ||
		!hexadecimal40.test(row.dist.shasum) ||
		canonicalize(dependencies) !== canonicalize(exactTargetDependencies(target.name))
	)
		throw new Error('React Calculator target metadata identity differs');
	return {
		name: target.name,
		version: target.version,
		metadataUrl,
		resolved,
		integrity: row.dist.integrity,
		shasum: row.dist.shasum,
		dependencies,
	};
}

export function parseReactCalculatorLauncher(args: string[]): LauncherMode {
	if (
		args.length !== 3 ||
		args[1] !== '--consent-id' ||
		args[2] !== REACT_CALCULATOR_CONSENT ||
		(args[0] !== '--launcher-smoke' && args[0] !== '--acquire')
	)
		throw new Error('React Calculator launcher arguments differ');
	if (args[0] === '--launcher-smoke') {
		if (
			process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
			process.env.NPM_CONFIG_OFFLINE !== 'true' ||
			process.env.VERSIONLESS_CONSENT_ID !== undefined
		)
			throw new Error('React Calculator launcher smoke requires exact offline environment');
		return 'launcher-smoke';
	}
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'consented' ||
		process.env.VERSIONLESS_CONSENT_ID !== REACT_CALCULATOR_CONSENT
	)
		throw new Error('React Calculator acquisition requires exact one-shot consent');
	return 'acquire';
}

export function assertReactCalculatorUrl(url: string, allowed: ReadonlySet<string>): void {
	const parsed = parseURL(url);
	if (
		parsed.protocol !== 'https:' ||
		parsed.auth ||
		parsed.hash ||
		!allowed.has(url) ||
		!['api.github.com', 'codeload.github.com', 'registry.npmjs.org'].includes(parsed.host ?? '')
	)
		throw new Error('React Calculator URL is outside exact consent');
}

export function assertReactCalculatorCommitDocument(value: unknown): void {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error('React Calculator immutable commit-to-tree binding differs');
	const row = value as { sha?: unknown; tree?: { sha?: unknown } };
	if (row.sha !== REACT_CALCULATOR_REVISION || row.tree?.sha !== REACT_CALCULATOR_TREE)
		throw new Error('React Calculator immutable commit-to-tree binding differs');
}

function addLockNode(
	name: string,
	value: unknown,
	placement: string,
	byUrl: Map<string, CalculatorLockArtifact>,
): void {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`React Calculator lock node differs: ${placement}`);
	const row = value as LockNode;
	if (
		typeof row.version !== 'string' ||
		typeof row.resolved !== 'string' ||
		typeof row.integrity !== 'string' ||
		(!integrityMatches(Buffer.alloc(0), row.integrity) &&
			!row.integrity.startsWith('sha1-') &&
			!row.integrity.startsWith('sha512-'))
	)
		throw new Error(`React Calculator lock identity differs: ${placement}`);
	const parsed = parseURL(row.resolved);
	if (
		parsed.protocol !== 'https:' ||
		parsed.host !== 'registry.npmjs.org' ||
		parsed.auth ||
		parsed.search ||
		parsed.hash
	)
		throw new Error(`React Calculator lock origin differs: ${placement}`);
	const prior = byUrl.get(row.resolved);
	if (prior) {
		if (
			prior.name !== name ||
			prior.version !== row.version ||
			prior.integrity !== row.integrity
		)
			throw new Error('React Calculator duplicate artifact identity conflicts');
		prior.placements.push(placement);
	} else {
		byUrl.set(row.resolved, {
			name,
			version: row.version,
			resolved: row.resolved,
			integrity: row.integrity,
			placements: [placement],
			metadataUrl: joinURL(
				'https://registry.npmjs.org',
				encodeURIComponent(name),
				encodeURIComponent(row.version),
			),
			mirror: `${sha256(row.resolved)}.tgz`,
		});
	}
	if (row.dependencies !== undefined) {
		if (
			!row.dependencies ||
			typeof row.dependencies !== 'object' ||
			Array.isArray(row.dependencies)
		)
			throw new Error(`React Calculator nested lock dependencies differ: ${placement}`);
		for (const [childName, child] of Object.entries(
			row.dependencies as Record<string, unknown>,
		))
			addLockNode(childName, child, `${placement}>${childName}`, byUrl);
	}
}

export function analyzeReactCalculatorLock(value: unknown): {
	artifacts: CalculatorLockArtifact[];
	placements: number;
	digest: string;
} {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error('React Calculator npm lock must be an object');
	const lock = value as { lockfileVersion?: unknown; dependencies?: unknown };
	if (
		lock.lockfileVersion !== 1 ||
		!lock.dependencies ||
		typeof lock.dependencies !== 'object' ||
		Array.isArray(lock.dependencies)
	)
		throw new Error('React Calculator requires the committed npm lock v1');
	const byUrl = new Map<string, CalculatorLockArtifact>();
	for (const [name, row] of Object.entries(lock.dependencies as Record<string, unknown>))
		addLockNode(name, row, name, byUrl);
	const artifacts = [...byUrl.values()]
		.map((artifact) => ({
			...artifact,
			placements: artifact.placements.sort(compareText),
		}))
		.sort((left, right) => compareText(left.resolved, right.resolved));
	const placements = artifacts.reduce((count, artifact) => count + artifact.placements.length, 0);
	if (
		artifacts.length < 100 ||
		artifacts.length > maximumArtifacts ||
		placements < artifacts.length
	)
		throw new Error('React Calculator lock closure cardinality differs');
	return { artifacts, placements, digest: sha256(canonicalize(artifacts)) };
}

export function assertReactCalculatorBaselineLock(
	artifacts: CalculatorLockArtifact[],
	expected: Fixture['baseline']['locked'],
): void {
	for (const [name, version] of [
		['react', expected.react],
		['react-dom', expected.reactDom],
		['react-scripts', expected.reactScripts],
		['big.js', expected.bigJs],
	] as const) {
		const exact = artifacts.filter(
			(artifact) => artifact.name === name && artifact.placements.includes(name),
		);
		if (exact.length !== 1 || exact[0]?.version !== version)
			throw new Error(`React Calculator locked baseline identity differs: ${name}`);
	}
}

export function assertReactCalculatorArchiveEntries(entries: string[]): void {
	if (entries.length < 20) throw new Error('React Calculator archive is unexpectedly small');
	let prefix: string | undefined;
	for (const entry of entries) {
		const parts = entry.split('/');
		if (
			!entry ||
			entry.startsWith('/') ||
			entry.includes('\\') ||
			parts.includes('..') ||
			!parts[0]
		)
			throw new Error('React Calculator archive path is unsafe');
		prefix ??= parts[0];
		if (parts[0] !== prefix) throw new Error('React Calculator archive root differs');
	}
}

export function assertReactCalculatorPackageEntries(entries: string[]): void {
	if (entries.length === 0 || entries.length > 100_000)
		throw new Error('React Calculator package archive entry count differs');
	const normalized = new Set<string>();
	for (const raw of entries) {
		const path = raw.endsWith('/') ? raw.slice(0, -1) : raw;
		const parts = path.split('/');
		if (
			!path ||
			path.startsWith('/') ||
			path.includes('\\') ||
			parts[0] !== 'package' ||
			parts.length < 2 ||
			parts.some((part) => !part || part === '.' || part === '..') ||
			normalized.has(path)
		)
			throw new Error('React Calculator package archive path differs');
		normalized.add(path);
	}
	if (!normalized.has('package/package.json'))
		throw new Error('React Calculator package archive manifest is absent');
}

async function verifyPackageArchive(
	tarball: Buffer,
	tarballPath: string,
	identity: { name: string; version: string },
): Promise<void> {
	inspectNpmPackageTarball(tarball, [identity]);
	const entries = (await execute('/usr/bin/tar', ['-tzf', tarballPath]))
		.split('\n')
		.filter(Boolean);
	assertReactCalculatorPackageEntries(entries);
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
				: reject(new Error(`${command} exited ${code ?? -1}: ${Buffer.concat(stderr)}`)),
		);
	});
}

async function filesBelow(directory: string): Promise<string[]> {
	const result: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const absolute = join(directory, entry.name);
		if (entry.isDirectory()) result.push(...(await filesBelow(absolute)));
		else if (entry.isFile()) result.push(absolute);
		else throw new Error('React Calculator source contains a special filesystem entry');
	}
	return result.sort(compareText);
}

export function reactCalculatorResponseLimits(
	state: Pick<CalculatorNetworkState, 'wireBytes' | 'decodedBytes'>,
	responseLimit: number,
): { wireLimit: number; decodedLimit: number } {
	if (
		!Number.isSafeInteger(state.wireBytes) ||
		!Number.isSafeInteger(state.decodedBytes) ||
		state.wireBytes < 0 ||
		state.decodedBytes < 0 ||
		!Number.isSafeInteger(responseLimit) ||
		responseLimit < 0
	)
		throw new Error('React Calculator response counters differ');
	return {
		wireLimit: Math.max(0, Math.min(responseLimit, maximumDecodedBytes - state.wireBytes)),
		decodedLimit: Math.max(
			0,
			Math.min(responseLimit, maximumDecodedBytes - state.decodedBytes),
		),
	};
}

async function getExact(
	url: string,
	media: LedgerRow['media'],
	allowed: ReadonlySet<string>,
	state: CalculatorNetworkState,
): Promise<Buffer> {
	assertReactCalculatorUrl(url, allowed);
	if (state.requests >= maximumResponses)
		throw new Error('React Calculator response cap exceeded');
	state.requests += 1;
	const ordinal = state.requests;
	return await new Promise((resolvePromise, reject) => {
		let settled = false;
		const finish = (error: Error | null, value?: Buffer): void => {
			if (settled) return;
			settled = true;
			if (error) reject(error);
			else resolvePromise(value ?? Buffer.alloc(0));
		};
		const call = request(
			url,
			{
				method: 'GET',
				headers: {
					accept:
						media === 'json' && parseURL(url).host === 'api.github.com'
							? 'application/vnd.github+json'
							: media === 'json'
								? 'application/json'
								: 'application/octet-stream',
					'accept-encoding': 'identity, gzip',
					'user-agent': 'versionless-t574',
				},
			},
			async (response) => {
				const rawEncoding = response.headers['content-encoding'];
				const normalizedEncoding =
					rawEncoding === undefined ? 'absent' : rawEncoding.trim().toLowerCase();
				if (
					response.statusCode !== 200 ||
					response.headers.location !== undefined ||
					Array.isArray(rawEncoding) ||
					(normalizedEncoding !== 'absent' &&
						normalizedEncoding !== 'identity' &&
						normalizedEncoding !== 'gzip') ||
					normalizedEncoding.includes(',')
				) {
					response.destroy();
					finish(new Error('React Calculator response boundary differs'));
					return;
				}
				const responseLimit =
					parseURL(url).host === 'registry.npmjs.org'
						? maximumRegistryResponseBytes
						: maximumGitHubResponseBytes;
				try {
					const result = await collectReactCalculatorResponse(response, {
						encoding: normalizedEncoding,
						...reactCalculatorResponseLimits(state, responseLimit),
					});
					if (settled) return;
					const responseCookiePresent = response.headers['set-cookie'] !== undefined;
					state.responses += 1;
					state.wireBytes += result.wireByteLength;
					state.decodedBytes += result.decodedByteLength;
					if (responseCookiePresent) state.cookieResponses += 1;
					state.ledger.push({
						ordinal,
						url,
						media,
						bytes: result.decodedByteLength,
						sha256: result.decodedSha256,
						wireBytes: result.wireByteLength,
						wireSha256: result.wireSha256,
						encoding: normalizedEncoding,
						responseCookiePresent,
					});
					finish(null, result.decoded);
				} catch (error) {
					response.destroy();
					finish(error instanceof Error ? error : new Error(String(error)));
				}
			},
		);
		call.setTimeout(requestTimeoutMilliseconds, () =>
			call.destroy(new Error('React Calculator request timeout')),
		);
		call.once('error', (error) => finish(error));
		call.end();
	});
}

export async function collectReactCalculatorResponse(
	stream: Readable,
	options: {
		encoding: CalculatorResponseEncoding;
		wireLimit: number;
		decodedLimit: number;
	},
): Promise<{
	decoded: Buffer;
	wireByteLength: number;
	decodedByteLength: number;
	wireSha256: string;
	decodedSha256: string;
}> {
	return await new Promise((resolvePromise, reject) => {
		let settled = false;
		let sourceEnded = false;
		let decoderEnded = options.encoding !== 'gzip';
		let wireByteLength = 0;
		let decodedByteLength = 0;
		const wireHash = createHash('sha256');
		const decodedHash = createHash('sha256');
		const decodedChunks: Buffer[] = [];
		const decoder = options.encoding === 'gzip' ? createGunzip() : undefined;
		const cleanup = (): void => {
			stream.off('data', onWire);
			stream.off('end', onSourceEnd);
			stream.off('error', onSourceError);
			stream.off('aborted', onSourceAborted);
			stream.off('close', onSourceClose);
			decoder?.off('data', onDecoded);
			decoder?.off('end', onDecoderEnd);
			decoder?.off('error', onDecoderError);
			decoder?.off('drain', onDecoderDrain);
		};
		const fail = (code: CalculatorResponseFailureCode): void => {
			if (settled) return;
			settled = true;
			cleanup();
			stream.destroy();
			decoder?.destroy();
			reject(new CalculatorResponseError(code));
		};
		const finish = (): void => {
			if (settled || !sourceEnded || !decoderEnded) return;
			settled = true;
			cleanup();
			resolvePromise({
				decoded: Buffer.concat(decodedChunks, decodedByteLength),
				wireByteLength,
				decodedByteLength,
				wireSha256: wireHash.digest('hex'),
				decodedSha256: decodedHash.digest('hex'),
			});
		};
		function onDecoded(chunk: Buffer): void {
			if (settled) return;
			decodedByteLength += chunk.byteLength;
			if (decodedByteLength > options.decodedLimit) {
				fail('response-decoded-cap-exceeded');
				return;
			}
			decodedHash.update(chunk);
			decodedChunks.push(Buffer.from(chunk));
		}
		function onWire(chunk: Buffer): void {
			if (settled) return;
			wireByteLength += chunk.byteLength;
			if (wireByteLength > options.wireLimit) {
				fail('response-wire-cap-exceeded');
				return;
			}
			wireHash.update(chunk);
			if (decoder) {
				if (!decoder.write(chunk)) stream.pause();
			} else onDecoded(chunk);
		}
		function onSourceEnd(): void {
			if (settled) return;
			sourceEnded = true;
			if (decoder) decoder.end();
			finish();
		}
		function onSourceError(): void {
			fail('response-stream-error');
		}
		function onSourceAborted(): void {
			fail('response-stream-error');
		}
		function onSourceClose(): void {
			if (!sourceEnded) fail('response-stream-error');
		}
		function onDecoderEnd(): void {
			decoderEnded = true;
			finish();
		}
		function onDecoderError(): void {
			fail('response-gzip-decode-failed');
		}
		function onDecoderDrain(): void {
			if (!settled) stream.resume();
		}
		stream.on('data', onWire);
		stream.once('end', onSourceEnd);
		stream.once('error', onSourceError);
		stream.once('aborted', onSourceAborted);
		stream.once('close', onSourceClose);
		decoder?.on('data', onDecoded);
		decoder?.once('end', onDecoderEnd);
		decoder?.once('error', onDecoderError);
		decoder?.on('drain', onDecoderDrain);
	});
}

type PublicationOperations = {
	mkdir: typeof mkdir;
	rename: typeof rename;
	rm: typeof rm;
};

export async function publishReactCalculatorTransaction(
	input: {
		cacheStage: string;
		ingestReceiptStage: string;
		dependencyReceiptStage: string;
		cacheTarget: string;
		ingestReceiptTarget: string;
		dependencyReceiptTarget: string;
	},
	operations: PublicationOperations = { mkdir, rename, rm },
): Promise<void> {
	const targets = [input.cacheTarget, input.ingestReceiptTarget, input.dependencyReceiptTarget];
	try {
		await operations.mkdir(join(input.cacheTarget, '..'), { recursive: true });
		await operations.mkdir(join(input.ingestReceiptTarget, '..'), { recursive: true });
		await operations.mkdir(join(input.dependencyReceiptTarget, '..'), { recursive: true });
		await operations.rename(input.cacheStage, input.cacheTarget);
		await operations.rename(input.ingestReceiptStage, input.ingestReceiptTarget);
		await operations.rename(input.dependencyReceiptStage, input.dependencyReceiptTarget);
	} catch (error) {
		for (const target of targets)
			await operations.rm(target, { recursive: true, force: true }).catch(() => undefined);
		throw error;
	}
}

async function verifySourceTree(
	source: string,
	rows: GitTreeRow[],
): Promise<Array<{ path: string; bytes: number; sha256: string; gitSha: string }>> {
	const blobs = new Map(
		rows.filter((row) => row.type === 'blob').map((row) => [row.path, row] as const),
	);
	const manifest = await Promise.all(
		(await filesBelow(source)).map(async (file) => {
			const bytes = await readFile(file);
			const path = relative(source, file);
			const row = blobs.get(path);
			if (!row || row.size !== bytes.length || row.sha !== gitBlobSha(bytes))
				throw new Error(`React Calculator Git tree identity differs: ${path}`);
			blobs.delete(path);
			return { path, bytes: bytes.length, sha256: sha256(bytes), gitSha: row.sha };
		}),
	);
	if (blobs.size !== 0) throw new Error('React Calculator archive omits relied Git blobs');
	return manifest.sort((left, right) => compareText(left.path, right.path));
}

export function verifyReactCalculatorPackageIdentity(
	value: unknown,
	expected: Fixture['baseline']['manifest'],
): void {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error('React Calculator package manifest differs');
	const packageValue = value as {
		dependencies?: Record<string, unknown>;
		devDependencies?: Record<string, unknown>;
		scripts?: Record<string, unknown>;
	};
	if (
		packageValue.dependencies?.react !== expected.react ||
		packageValue.dependencies?.['react-dom'] !== expected.reactDom ||
		packageValue.dependencies?.['big.js'] !== expected.bigJs ||
		packageValue.dependencies?.['react-scripts'] !== undefined ||
		packageValue.devDependencies?.['react-scripts'] !== expected.reactScripts ||
		packageValue.scripts?.build !== 'react-scripts build'
	)
		throw new Error('React Calculator legacy package identity differs');
}

async function sealFailure(message: string): Promise<void> {
	if (await exists(failurePath)) return;
	const receipt = {
		schemaVersion: 'versionless.react-calculator-consumed-failed.v1',
		result: 'consumed-failed',
		consentId: REACT_CALCULATOR_CONSENT,
		reusable: false,
		retry: false,
		reason: message.includes('boundary')
			? 'response-boundary-differed'
			: message.includes('identity') || message.includes('differs')
				? 'immutable-identity-differed'
				: 'acquisition-failed',
		counted: false,
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	receipt.integrity.canonicalDigest = sha256(canonicalize(receipt));
	await writeFile(failurePath, `${canonicalize(receipt)}\n`, { flag: 'wx' });
}

export async function verifyReactCalculatorIngest(): Promise<{ valid: true; digest: string }> {
	const receipt = JSON.parse(
		await readFile(join(ingestEvidenceRoot, 'receipt.json'), 'utf8'),
	) as {
		integrity?: { canonicalDigest?: string };
		source?: { manifestDigest?: string };
		closure?: { artifacts?: CalculatorLockArtifact[]; digest?: string };
		targetClosure?: { artifacts?: CalculatorTargetArtifact[]; digest?: string };
	};
	const expected = receipt.integrity?.canonicalDigest;
	const copy = structuredClone(receipt);
	if (!copy.integrity || typeof expected !== 'string')
		throw new Error('React Calculator ingest receipt integrity differs');
	copy.integrity.canonicalDigest = '';
	if (sha256(canonicalize(copy)) !== expected)
		throw new Error('React Calculator ingest receipt digest differs');
	const source = join(cacheRoot, 'source');
	const manifest = await Promise.all(
		(await filesBelow(source)).map(async (file) => {
			const bytes = await readFile(file);
			return {
				path: relative(source, file),
				bytes: bytes.length,
				sha256: sha256(bytes),
				gitSha: gitBlobSha(bytes),
			};
		}),
	);
	if (
		sha256(canonicalize(manifest.sort((left, right) => compareText(left.path, right.path)))) !==
		receipt.source?.manifestDigest
	)
		throw new Error('React Calculator cached source differs');
	for (const artifact of receipt.closure?.artifacts ?? []) {
		const bytes = await readFile(join(cacheRoot, 'mirror', artifact.mirror));
		if (!integrityMatches(bytes, artifact.integrity))
			throw new Error('React Calculator cached artifact integrity differs');
	}
	if (sha256(canonicalize(receipt.closure?.artifacts)) !== receipt.closure?.digest)
		throw new Error('React Calculator cached closure digest differs');
	for (const artifact of receipt.targetClosure?.artifacts ?? []) {
		const bytes = await readFile(join(cacheRoot, 'mirror', artifact.mirror));
		if (
			!integrityMatches(bytes, artifact.integrity) ||
			sha256(bytes) !== artifact.sha256 ||
			createHash('sha512').update(bytes).digest('hex') !== artifact.sha512
		)
			throw new Error('React Calculator cached target artifact integrity differs');
	}
	if (sha256(canonicalize(receipt.targetClosure?.artifacts)) !== receipt.targetClosure?.digest)
		throw new Error('React Calculator cached target closure digest differs');
	return { valid: true, digest: expected };
}

export async function acquireReactCalculator(): Promise<void> {
	const ingestReceiptPath = join(ingestEvidenceRoot, 'receipt.json');
	const dependencyReceiptPath = join(dependencyEvidenceRoot, 'receipt.json');
	for (const target of [
		cacheRoot,
		stageRoot,
		workRoot,
		runRoot,
		attemptPath,
		failurePath,
		ingestReceiptPath,
		dependencyReceiptPath,
	])
		if (await exists(target))
			throw new Error('React Calculator acquisition requires fresh roots');
	await mkdir(ingestEvidenceRoot, { recursive: true });
	await writeFile(
		attemptPath,
		`${canonicalize({ schemaVersion: 'versionless.react-calculator-attempt.v1', consentId: REACT_CALCULATOR_CONSENT, invoked: true })}\n`,
		{ flag: 'wx' },
	);
	const fixture = JSON.parse(await readFile(fixturePath, 'utf8')) as Fixture;
	if (
		fixture.schemaVersion !== 'versionless.react-calculator-fixture.v1' ||
		fixture.revision !== REACT_CALCULATOR_REVISION ||
		fixture.tree !== REACT_CALCULATOR_TREE
	)
		throw new Error('React Calculator fixture identity differs');
	const acquisition = join(stageRoot, 'acquisition');
	const source = join(acquisition, 'source');
	const mirror = join(acquisition, 'mirror');
	await mkdir(source, { recursive: true });
	await mkdir(mirror, { recursive: true });
	const allowed = new Set([fixture.commitUrl, fixture.treeUrl, fixture.archiveUrl]);
	const state: CalculatorNetworkState = {
		requests: 0,
		responses: 0,
		wireBytes: 0,
		decodedBytes: 0,
		cookieResponses: 0,
		ledger: [],
	};
	const commitBytes = await getExact(fixture.commitUrl, 'json', allowed, state);
	assertReactCalculatorCommitDocument(JSON.parse(commitBytes.toString('utf8')));
	const treeBytes = await getExact(fixture.treeUrl, 'json', allowed, state);
	const treeDocument = JSON.parse(treeBytes.toString('utf8')) as {
		sha?: unknown;
		truncated?: unknown;
		tree?: unknown;
	};
	if (
		treeDocument.sha !== fixture.tree ||
		treeDocument.truncated !== false ||
		!Array.isArray(treeDocument.tree)
	)
		throw new Error('React Calculator immutable Git tree differs');
	const rows = treeDocument.tree as GitTreeRow[];
	for (const row of rows)
		if (
			typeof row.path !== 'string' ||
			typeof row.mode !== 'string' ||
			typeof row.type !== 'string' ||
			typeof row.sha !== 'string' ||
			!hexadecimal40.test(row.sha) ||
			(row.type === 'blob' && (!Number.isSafeInteger(row.size) || (row.size ?? -1) < 0))
		)
			throw new Error('React Calculator Git tree row differs');
	const archive = await getExact(fixture.archiveUrl, 'binary', allowed, state);
	const archivePath = join(acquisition, 'source.tar.gz');
	await writeFile(archivePath, archive, { flag: 'wx' });
	const entries = (await execute('/usr/bin/tar', ['-tzf', archivePath]))
		.split('\n')
		.filter(Boolean);
	assertReactCalculatorArchiveEntries(entries);
	await execute('/usr/bin/tar', ['-xzf', archivePath, '-C', source, '--strip-components', '1']);
	const manifest = await verifySourceTree(source, rows);
	const packageBytes = await readFile(join(source, 'package.json'));
	const lockBytes = await readFile(join(source, 'package-lock.json'));
	const licenseBytes = await readFile(join(source, 'LICENSE'));
	verifyReactCalculatorPackageIdentity(
		JSON.parse(packageBytes.toString('utf8')),
		fixture.baseline.manifest,
	);
	const licenseText = licenseBytes.toString('utf8');
	if (
		!licenseText.includes('MIT License') ||
		!licenseText.includes('Permission is hereby granted')
	)
		throw new Error('React Calculator standard MIT license differs');
	const closure = analyzeReactCalculatorLock(JSON.parse(lockBytes.toString('utf8')));
	assertReactCalculatorBaselineLock(closure.artifacts, fixture.baseline.locked);
	for (const artifact of closure.artifacts) {
		allowed.add(artifact.metadataUrl);
		allowed.add(artifact.resolved);
	}
	for (const target of REACT_CALCULATOR_TARGET_PACKAGES) {
		allowed.add(
			joinURL(
				'https://registry.npmjs.org',
				encodeURIComponent(target.name),
				encodeURIComponent(target.version),
			),
		);
		allowed.add(
			joinURL(
				'https://registry.npmjs.org',
				encodeURIComponent(target.name),
				'-',
				`${target.name}-${target.version}.tgz`,
			),
		);
	}
	const closureRows: Array<
		CalculatorLockArtifact & {
			sha256: string;
			sha512: string;
			bytes: number;
			license: string | 'unknown';
			lifecycleScripts: string[];
			native: boolean;
		}
	> = [];
	for (const artifact of closure.artifacts) {
		const metadataBytes = await getExact(artifact.metadataUrl, 'json', allowed, state);
		const metadata = JSON.parse(metadataBytes.toString('utf8')) as {
			name?: unknown;
			version?: unknown;
			license?: unknown;
			dist?: { tarball?: unknown; integrity?: unknown };
		};
		if (
			metadata.name !== artifact.name ||
			metadata.version !== artifact.version ||
			metadata.dist?.tarball !== artifact.resolved ||
			(metadata.dist.integrity !== undefined &&
				metadata.dist.integrity !== artifact.integrity)
		)
			throw new Error('React Calculator registry metadata identity differs');
		const tarball = await getExact(artifact.resolved, 'binary', allowed, state);
		if (!integrityMatches(tarball, artifact.integrity))
			throw new Error('React Calculator historical checksum differs');
		const tarballPath = join(mirror, artifact.mirror);
		await writeFile(tarballPath, tarball, { flag: 'wx' });
		await verifyPackageArchive(tarball, tarballPath, artifact);
		const packageText = await execute('/usr/bin/tar', [
			'-xOf',
			tarballPath,
			'package/package.json',
		]);
		const packageDocument = JSON.parse(packageText) as {
			name?: unknown;
			version?: unknown;
			license?: unknown;
			scripts?: unknown;
			gypfile?: unknown;
			dependencies?: Record<string, unknown>;
		};
		if (packageDocument.name !== artifact.name || packageDocument.version !== artifact.version)
			throw new Error('React Calculator package tarball identity differs');
		const scripts =
			packageDocument.scripts &&
			typeof packageDocument.scripts === 'object' &&
			!Array.isArray(packageDocument.scripts)
				? Object.keys(packageDocument.scripts as Record<string, unknown>)
						.filter((name) => ['preinstall', 'install', 'postinstall'].includes(name))
						.sort(compareText)
				: [];
		closureRows.push({
			...artifact,
			sha256: sha256(tarball),
			sha512: createHash('sha512').update(tarball).digest('hex'),
			bytes: tarball.length,
			license:
				typeof packageDocument.license === 'string' ? packageDocument.license : 'unknown',
			lifecycleScripts: scripts,
			native:
				packageDocument.gypfile === true ||
				packageDocument.dependencies?.['node-gyp'] !== undefined,
		});
	}
	const targetClosure: CalculatorTargetArtifact[] = [];
	for (const target of REACT_CALCULATOR_TARGET_PACKAGES) {
		const metadataUrl = joinURL(
			'https://registry.npmjs.org',
			encodeURIComponent(target.name),
			encodeURIComponent(target.version),
		);
		const parsed = parseReactCalculatorTargetMetadata(
			JSON.parse((await getExact(metadataUrl, 'json', allowed, state)).toString('utf8')),
			target,
		);
		const tarball = await getExact(parsed.resolved, 'binary', allowed, state);
		if (
			!integrityMatches(tarball, parsed.integrity) ||
			createHash('sha1').update(tarball).digest('hex') !== parsed.shasum
		)
			throw new Error('React Calculator target checksum differs');
		const mirrorName = `target-${sha256(parsed.resolved)}.tgz`;
		const tarballPath = join(mirror, mirrorName);
		await writeFile(tarballPath, tarball, { flag: 'wx' });
		await verifyPackageArchive(tarball, tarballPath, parsed);
		const packageDocument = JSON.parse(
			await execute('/usr/bin/tar', ['-xOf', tarballPath, 'package/package.json']),
		) as {
			name?: unknown;
			version?: unknown;
			license?: unknown;
			scripts?: unknown;
			gypfile?: unknown;
			dependencies?: Record<string, unknown>;
		};
		if (packageDocument.name !== parsed.name || packageDocument.version !== parsed.version)
			throw new Error('React Calculator target tarball identity differs');
		const lifecycleScripts =
			packageDocument.scripts &&
			typeof packageDocument.scripts === 'object' &&
			!Array.isArray(packageDocument.scripts)
				? Object.keys(packageDocument.scripts as Record<string, unknown>)
						.filter((name) => ['preinstall', 'install', 'postinstall'].includes(name))
						.sort(compareText)
				: [];
		targetClosure.push({
			...parsed,
			mirror: mirrorName,
			sha256: sha256(tarball),
			sha512: createHash('sha512').update(tarball).digest('hex'),
			bytes: tarball.length,
			license:
				typeof packageDocument.license === 'string' ? packageDocument.license : 'unknown',
			lifecycleScripts,
			native:
				packageDocument.gypfile === true ||
				packageDocument.dependencies?.['node-gyp'] !== undefined,
		});
	}
	const assets = manifest
		.filter((row) =>
			new Set(['.gif', '.ico', '.jpeg', '.jpg', '.png', '.svg', '.webp']).has(
				extname(row.path).toLowerCase(),
			),
		)
		.map((row) => ({ path: row.path, sha256: row.sha256, license: 'MIT-root-license' }));
	const receipt = {
		schemaVersion: 'versionless.react-calculator-ingest.v1',
		result: 'pass',
		counted: false,
		consentId: REACT_CALCULATOR_CONSENT,
		source: {
			repository: fixture.repository,
			historicalAlias: fixture.historicalAlias,
			revision: fixture.revision,
			tree: fixture.tree,
			archiveSha256: sha256(archive),
			manifestDigest: sha256(canonicalize(manifest)),
			files: manifest.length,
			manifest,
			packageSha256: sha256(packageBytes),
			lockSha256: sha256(lockBytes),
			licenseSha256: sha256(licenseBytes),
		},
		closure: {
			selectedLock: 'package-lock.json',
			format: fixture.baseline.packageManager,
			placements: closure.placements,
			artifacts: closureRows,
			digest: sha256(canonicalize(closureRows)),
			replaysRequired: 2,
		},
		targetClosure: {
			artifacts: targetClosure,
			digest: sha256(canonicalize(targetClosure)),
			replaysRequired: 2,
		},
		license: { expression: 'MIT', assets, authorship: 'unknown', certification: false },
		access: {
			...state,
			method: 'GET',
			redirects: 0,
			retries: 0,
			credentials: false,
			cookiesStored: false,
			cookiesReplayed: false,
		},
		privacy: { sensitiveData: false, hostPaths: false, paymentData: false },
		nonclaims: ['not certification', 'not signer authenticity', 'not OS-wide isolation'],
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	receipt.integrity.canonicalDigest = sha256(canonicalize(receipt));
	const publishStage = join(stageRoot, 'publish');
	await mkdir(publishStage, { recursive: true });
	await writeFile(join(acquisition, 'receipt.json'), `${canonicalize(receipt)}\n`, {
		flag: 'wx',
	});
	await writeFile(join(publishStage, 'ingest-receipt.json'), `${canonicalize(receipt)}\n`, {
		flag: 'wx',
	});
	await writeFile(join(publishStage, 'dependency-receipt.json'), `${canonicalize(receipt)}\n`, {
		flag: 'wx',
	});
	await publishReactCalculatorTransaction({
		cacheStage: acquisition,
		ingestReceiptStage: join(publishStage, 'ingest-receipt.json'),
		dependencyReceiptStage: join(publishStage, 'dependency-receipt.json'),
		cacheTarget: cacheRoot,
		ingestReceiptTarget: ingestReceiptPath,
		dependencyReceiptTarget: dependencyReceiptPath,
	});
	await rm(stageRoot, { recursive: true, force: true });
	await verifyReactCalculatorIngest();
	await verifyReactCalculatorIngest();
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const mode = parseReactCalculatorLauncher(args);
	if (mode === 'launcher-smoke') {
		process.stdout.write(
			`${canonicalize({ result: 'pass', mode, consentId: REACT_CALCULATOR_CONSENT, requestAttempts: 0 })}\n`,
		);
		return;
	}
	try {
		await acquireReactCalculator();
		process.stdout.write(
			`${canonicalize({ result: 'pass', consentId: REACT_CALCULATOR_CONSENT })}\n`,
		);
	} catch (error) {
		await rm(stageRoot, { recursive: true, force: true });
		await rm(cacheRoot, { recursive: true, force: true });
		await rm(workRoot, { recursive: true, force: true });
		await rm(runRoot, { recursive: true, force: true });
		await rm(join(ingestEvidenceRoot, 'receipt.json'), { force: true });
		await rm(join(dependencyEvidenceRoot, 'receipt.json'), { force: true });
		if (await exists(attemptPath))
			await sealFailure(error instanceof Error ? error.message : String(error));
		throw error;
	}
}

if (basename(process.argv[1] ?? '') === 'react-calculator-ingest.ts')
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
