import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import type { IncomingHttpHeaders } from 'node:http';
import { request } from 'node:https';
import type { Readable } from 'node:stream';
import { createGunzip } from 'node:zlib';
import { basename, join, relative, resolve } from 'pathe';
import { parseURL } from 'ufo';
import {
	canonicalize,
	inspectNpmPackageTarball,
	sha256,
	type PackageMetadata,
} from '../../../core/src/index.ts';

export const AVATAAARS_REACT1831_CONSENT =
	'T608-react-avataaars-react1831-target-closure-production' as const;
export const AVATAAARS_REACT1831_PACKAGES = Object.freeze([
	Object.freeze({ name: 'react', version: '18.3.1' }),
	Object.freeze({ name: 'react-dom', version: '18.3.1' }),
	Object.freeze({ name: 'scheduler', version: '0.23.2' }),
]);

const root = resolve(import.meta.dirname, '../../../..');
const fixturePath = join(root, 'fixtures/react-avataaars-compatibility/fixture.json');
const cacheParent = join(root, '.versionless/cache/react-avataaars-react1831/t608');
const stageRoot = join(root, '.versionless/stage/react-avataaars-react1831/t608');
const evidenceRoot = join(root, 'evidence/dependencies/react-avataaars-react1831');
const t608EvidenceRoot = join(evidenceRoot, 't608');
const attemptPath = join(t608EvidenceRoot, 'attempt.json');
const receiptPath = join(t608EvidenceRoot, 'dependency-receipt.json');
const failurePath = join(t608EvidenceRoot, 'consumed-failed.json');
const responseLimit = 10 * 1024 * 1024;
const aggregateLimit = 30 * 1024 * 1024;
const requestTimeoutMs = 15_000;

type Target = { name: string; version: string; metadataUrl: string };
type Fixture = {
	schemaVersion: string;
	fixture: string;
	consentId: string;
	packages: Target[];
};
type NpmVersionMetadata = {
	name?: unknown;
	version?: unknown;
	license?: unknown;
	dist?: { tarball?: unknown; integrity?: unknown; shasum?: unknown };
	dependencies?: unknown;
};
type LedgerRow = {
	ordinal: number;
	media: 'metadata' | 'tarball';
	url: string;
	encoding: ResponseEncoding;
	responseCookiePresent: boolean;
	wireByteLength: number;
	decodedByteLength: number;
	wireSha256: string;
	decodedSha256: string;
	responseCookieObservation: 'response-cookie-discarded' | 'absent';
};
type ParsedMetadata = {
	name: string;
	version: string;
	tarball: string;
	integrity: string;
	shasum: string;
	dependencies: Record<string, string>;
};

export type ResponseEncoding = 'absent' | 'identity' | 'gzip';
export type AvataaarsBoundaryCode =
	| 'response-status-not-200'
	| 'response-redirect-forbidden'
	| 'response-encoding-unsupported'
	| 'response-wire-cap-exceeded'
	| 'response-decoded-cap-exceeded'
	| 'response-gzip-decode-failed'
	| 'response-stream-error'
	| 'request-timeout'
	| 'network-error';

export class AvataaarsResponseBoundaryError extends Error {
	readonly code: AvataaarsBoundaryCode;

	constructor(code: AvataaarsBoundaryCode) {
		super(code);
		this.name = 'AvataaarsResponseBoundaryError';
		this.code = code;
	}
}

type AvataaarsLauncherMode = 'launcher-smoke' | 'verify' | 'acquire';

const t608ClosureDigest =
	'050ee1051469f2d7e236546d7feecc6d3f1f632bafb1206d2904a4baebd5385b' as const;
const t608ClosureFileSha256 =
	'245b1ec5b769d6a54edf92c12af0ab80eb6ceb039c1fe9ea4219ddc5a24afe00' as const;

const exists = (file: string): Promise<boolean> =>
	access(file).then(
		() => true,
		() => false,
	);
const canonical = (value: unknown): string => `${canonicalize(value)}\n`;
const compare = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

function exactDependencies(target: Target): Record<string, string> {
	if (target.name === 'react') return { 'loose-envify': '^1.1.0' };
	if (target.name === 'react-dom') return { 'loose-envify': '^1.1.0', scheduler: '^0.23.2' };
	if (target.name === 'scheduler') return { 'loose-envify': '^1.1.0' };
	throw new Error('Avataaars target package is outside the transaction');
}

export function parseAvataaarsReact1831Launcher(args: string[]): AvataaarsLauncherMode {
	if (
		args.length !== 3 ||
		args[1] !== '--consent-id' ||
		args[2] !== AVATAAARS_REACT1831_CONSENT ||
		!['--launcher-smoke', '--verify', '--acquire'].includes(args[0] ?? '')
	)
		throw new Error('Avataaars React 18.3.1 launcher arguments differ');
	if (args[0] === '--launcher-smoke' || args[0] === '--verify') {
		if (
			process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
			process.env.NPM_CONFIG_OFFLINE !== 'true' ||
			process.env.VERSIONLESS_CONSENT_ID !== undefined
		)
			throw new Error('Avataaars React 18.3.1 offline launcher requires strict offline mode');
		return args[0] === '--verify' ? 'verify' : 'launcher-smoke';
	}
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'consented' ||
		process.env.VERSIONLESS_CONSENT_ID !== AVATAAARS_REACT1831_CONSENT
	)
		throw new Error('Avataaars React 18.3.1 acquisition requires exact one-shot consent');
	return 'acquire';
}

export function assertAvataaarsReact1831Consent(args: string[]): void {
	if (
		args.length !== 3 ||
		args[0] !== '--acquire' ||
		args[1] !== '--consent-id' ||
		args[2] !== AVATAAARS_REACT1831_CONSENT ||
		process.env.VERSIONLESS_NETWORK_MODE !== 'consented' ||
		process.env.VERSIONLESS_CONSENT_ID !== AVATAAARS_REACT1831_CONSENT
	)
		throw new Error('Avataaars React 18.3.1 acquisition requires exact one-shot consent');
}

export function assertAvataaarsReact1831Url(url: string, allowed: ReadonlySet<string>): void {
	const parsed = parseURL(url);
	if (
		parsed.protocol !== 'https:' ||
		parsed.host !== 'registry.npmjs.org' ||
		parsed.auth ||
		parsed.search ||
		parsed.hash ||
		!allowed.has(url)
	)
		throw new Error('Avataaars React 18.3.1 URL is outside exact consent');
}

function stringMap(value: unknown): Record<string, string> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error('Avataaars target dependencies are absent or ambiguous');
	const rows = Object.entries(value as Record<string, unknown>);
	if (rows.some(([, item]) => typeof item !== 'string'))
		throw new Error('Avataaars target dependencies are malformed');
	return Object.fromEntries(rows.sort(([left], [right]) => compare(left, right))) as Record<
		string,
		string
	>;
}

export function parseAvataaarsReact1831Metadata(value: unknown, target: Target): ParsedMetadata {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error('Avataaars target metadata is malformed');
	const row = value as NpmVersionMetadata;
	const dependencies = stringMap(row.dependencies);
	if (
		row.name !== target.name ||
		row.version !== target.version ||
		row.license !== 'MIT' ||
		typeof row.dist?.tarball !== 'string' ||
		typeof row.dist.integrity !== 'string' ||
		!row.dist.integrity.startsWith('sha512-') ||
		Buffer.from(row.dist.integrity.slice('sha512-'.length), 'base64').byteLength !== 64 ||
		typeof row.dist.shasum !== 'string' ||
		row.dist.shasum.length !== 40 ||
		canonicalize(dependencies) !== canonicalize(exactDependencies(target))
	)
		throw new Error('Avataaars target metadata identity or dependency edge differs');
	const expectedTarball = `https://registry.npmjs.org/${target.name}/-/${target.name}-${target.version}.tgz`;
	if (row.dist.tarball !== expectedTarball)
		throw new Error('Avataaars target metadata tarball URL differs');
	return {
		name: target.name,
		version: target.version,
		tarball: row.dist.tarball,
		integrity: row.dist.integrity,
		shasum: row.dist.shasum,
		dependencies,
	};
}

export function verifyAvataaarsReact1831Tarball(
	bytes: Buffer,
	metadata: ParsedMetadata,
): PackageMetadata {
	if (
		createHash('sha512').update(bytes).digest('base64') !==
			metadata.integrity.slice('sha512-'.length) ||
		createHash('sha1').update(bytes).digest('hex') !== metadata.shasum
	)
		throw new Error('Avataaars target tarball integrity differs');
	const inspected = inspectNpmPackageTarball(bytes, [
		{ name: metadata.name, version: metadata.version },
	]);
	if (
		inspected.license.state !== 'declared' ||
		!inspected.license.declarations.includes('MIT') ||
		inspected.lifecycleScripts.length !== 0 ||
		inspected.nativeIndicators.bindingGyp ||
		inspected.nativeIndicators.nodeGypDependency ||
		inspected.nativeIndicators.lifecycleMentionsNodeGyp ||
		inspected.nativeIndicators.gypfile === 'true' ||
		inspected.nativeIndicators.gypfile === 'ambiguous' ||
		inspected.optionalDependencies.state === 'ambiguous' ||
		inspected.optionalDependencies.names.length !== 0 ||
		inspected.os.state === 'ambiguous' ||
		inspected.cpu.state === 'ambiguous' ||
		inspected.engines.state === 'ambiguous'
	)
		throw new Error('Avataaars target package policy metadata differs');
	return inspected;
}

export function classifyAvataaarsResponse(
	statusCode: number | undefined,
	headers: IncomingHttpHeaders,
): { encoding: ResponseEncoding; responseCookiePresent: boolean } {
	if (statusCode !== 200) throw new AvataaarsResponseBoundaryError('response-status-not-200');
	if (headers.location !== undefined)
		throw new AvataaarsResponseBoundaryError('response-redirect-forbidden');
	const rawEncoding = headers['content-encoding'];
	if (Array.isArray(rawEncoding))
		throw new AvataaarsResponseBoundaryError('response-encoding-unsupported');
	if (rawEncoding === undefined)
		return {
			encoding: 'absent',
			responseCookiePresent: headers['set-cookie'] !== undefined,
		};
	const normalized = rawEncoding.trim().toLowerCase();
	if (normalized !== 'identity' && normalized !== 'gzip')
		throw new AvataaarsResponseBoundaryError('response-encoding-unsupported');
	if (normalized?.includes(','))
		throw new AvataaarsResponseBoundaryError('response-encoding-unsupported');
	return {
		encoding: normalized,
		responseCookiePresent: headers['set-cookie'] !== undefined,
	};
}

export function avataaarsRequestHeaders(
	media: LedgerRow['media'],
): Readonly<Record<string, string>> {
	const headers = Object.freeze({
		accept: media === 'metadata' ? 'application/json' : 'application/octet-stream',
		'accept-encoding': 'identity, gzip',
		'user-agent': 'versionless-t608',
	});
	for (const forbidden of ['cookie', 'cookie2', 'authorization', 'proxy-authorization'])
		if (Object.hasOwn(headers, forbidden))
			throw new Error('Avataaars request contains a forbidden credential header');
	return headers;
}

export function avataaarsResponseLimits(
	acceptedWireBytes: number,
	acceptedDecodedBytes: number,
): { wireLimit: number; decodedLimit: number } {
	if (
		!Number.isSafeInteger(acceptedWireBytes) ||
		!Number.isSafeInteger(acceptedDecodedBytes) ||
		acceptedWireBytes < 0 ||
		acceptedDecodedBytes < 0
	)
		throw new Error('Avataaars accepted-byte counters are invalid');
	return {
		wireLimit: Math.max(0, Math.min(responseLimit, aggregateLimit - acceptedWireBytes)),
		decodedLimit: Math.max(0, Math.min(responseLimit, aggregateLimit - acceptedDecodedBytes)),
	};
}

export async function collectAvataaarsResponse(
	stream: Readable,
	options: { encoding: ResponseEncoding; wireLimit: number; decodedLimit: number },
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
		const fail = (code: AvataaarsBoundaryCode): void => {
			if (settled) return;
			settled = true;
			cleanup();
			stream.destroy();
			decoder?.destroy();
			reject(new AvataaarsResponseBoundaryError(code));
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

export async function verifyAvataaarsProtectedNegativeEvidence(): Promise<void> {
	const protectedFiles = [
		[
			join(evidenceRoot, 'attempt.json'),
			'ce9bc6d95aff7713c7a5dce5e46b5ac0a535dc8ca89e267a726f5bc8a5d2bfb5',
		],
		[
			join(evidenceRoot, 'consumed-failed.json'),
			'38a0769ae62a3abc16e34efb2454c2ace4979c0a00fe0e53a6ae4ebfcb0bd7d4',
		],
		[
			join(
				root,
				'evidence/runs/react-avataaars-compatibility-to-vite8/terminal-exclusion.json',
			),
			'16ff63e05ae215ec994dd8db6c8d538292dca3c457d065c8bdeb0922af33f09e',
		],
		[
			join(evidenceRoot, 't570/attempt.json'),
			'710f9fb91a91b2867f5d44e6b1a49ca6a0fb8e843f0fe9cd5f072d938623acb9',
		],
		[
			join(evidenceRoot, 't570/consumed-failed.json'),
			'7eaacf817683951ad03b3ade464c2aac994b2afa8730943403ca46c588af516a',
		],
		[
			join(
				root,
				'evidence/runs/react-avataaars-compatibility-to-vite8/t570/terminal-exclusion.json',
			),
			'3d671e92a7505fba0219faf534930744b1bab48f4bbba36bfcc7fad573ee8711',
		],
	] as const;
	for (const [file, expected] of protectedFiles)
		if (sha256(await readFile(file)) !== expected)
			throw new Error('T568/T570 protected negative evidence differs');
	const terminal = JSON.parse(await readFile(protectedFiles[2][0], 'utf8')) as {
		integrity: { canonicalDigest: string };
	};
	const { integrity, ...body } = terminal;
	if (
		integrity.canonicalDigest !==
			'c0084e0cf42b58599984b5dc954aa9efc598fa116629d4306b1a4500d88a41ce' ||
		sha256(canonicalize(body)) !== integrity.canonicalDigest
	)
		throw new Error('T568 protected terminal canonical digest differs');
	const t570Terminal = JSON.parse(await readFile(protectedFiles[5][0], 'utf8')) as {
		integrity: { canonicalDigest: string };
	};
	const { integrity: t570Integrity, ...t570Body } = t570Terminal;
	if (
		t570Integrity.canonicalDigest !==
			'cc9be35af763a6d8736f8385306d21f26e724fe3f8dc029025e2778ec74ac636' ||
		sha256(canonicalize(t570Body)) !== t570Integrity.canonicalDigest
	)
		throw new Error('T570 protected terminal canonical digest differs');
}

export async function verifyT568ProtectedEvidence(): Promise<void> {
	await verifyAvataaarsProtectedNegativeEvidence();
}

export function projectAvataaarsFailure(
	error: unknown,
	current: { ordinal: number; media: LedgerRow['media'] } | null,
	ledger: readonly LedgerRow[],
): Record<string, unknown> {
	return {
		code:
			error instanceof AvataaarsResponseBoundaryError
				? error.code
				: 'transaction-validation-failed',
		ordinal: current?.ordinal ?? ledger.length + 1,
		media: current?.media ?? 'metadata',
		acceptedResponses: ledger.length,
		acceptedWireBytes: ledger.reduce((sum, row) => sum + row.wireByteLength, 0),
		acceptedDecodedBytes: ledger.reduce((sum, row) => sum + row.decodedByteLength, 0),
	};
}

async function getExact(
	url: string,
	media: LedgerRow['media'],
	allowed: ReadonlySet<string>,
	ledger: LedgerRow[],
): Promise<Buffer> {
	assertAvataaarsReact1831Url(url, allowed);
	if (ledger.length >= 6) throw new Error('Avataaars target response cap exceeded');
	return await new Promise((resolvePromise, reject) => {
		let settled = false;
		const acceptedWire = ledger.reduce((sum, row) => sum + row.wireByteLength, 0);
		const acceptedDecoded = ledger.reduce((sum, row) => sum + row.decodedByteLength, 0);
		const call = request(
			url,
			{
				method: 'GET',
				headers: avataaarsRequestHeaders(media),
			},
			async (response) => {
				try {
					const classification = classifyAvataaarsResponse(
						response.statusCode,
						response.headers,
					);
					const limits = avataaarsResponseLimits(acceptedWire, acceptedDecoded);
					const result = await collectAvataaarsResponse(response, {
						encoding: classification.encoding,
						...limits,
					});
					if (settled) return;
					settled = true;
					ledger.push({
						ordinal: ledger.length + 1,
						media,
						url,
						encoding: classification.encoding,
						responseCookiePresent: classification.responseCookiePresent,
						wireByteLength: result.wireByteLength,
						decodedByteLength: result.decodedByteLength,
						wireSha256: result.wireSha256,
						decodedSha256: result.decodedSha256,
						responseCookieObservation: classification.responseCookiePresent
							? 'response-cookie-discarded'
							: 'absent',
					});
					resolvePromise(result.decoded);
				} catch (error) {
					if (settled) return;
					settled = true;
					response.destroy();
					reject(error);
				}
			},
		);
		call.setTimeout(requestTimeoutMs, () => {
			if (settled) return;
			settled = true;
			call.destroy();
			reject(new AvataaarsResponseBoundaryError('request-timeout'));
		});
		call.once('error', () => {
			if (settled) return;
			settled = true;
			reject(new AvataaarsResponseBoundaryError('network-error'));
		});
		call.end();
	});
}

async function loadFixture(): Promise<Fixture> {
	const fixture = JSON.parse(await readFile(fixturePath, 'utf8')) as Fixture;
	if (
		fixture.schemaVersion !== 'versionless.react-avataaars-compatibility-fixture.v1' ||
		fixture.fixture !== 'react-avataaars-compatibility' ||
		fixture.consentId !== AVATAAARS_REACT1831_CONSENT ||
		canonicalize(fixture.packages.map(({ name, version }) => ({ name, version }))) !==
			canonicalize(AVATAAARS_REACT1831_PACKAGES)
	)
		throw new Error('Avataaars React 18.3.1 fixture differs');
	return fixture;
}

export async function verifyAvataaarsReact1831Acquisition(): Promise<Record<string, unknown>> {
	await verifyAvataaarsProtectedNegativeEvidence();
	const fixture = await loadFixture();
	if ((await exists(stageRoot)) || (await exists(failurePath)))
		throw new Error('Avataaars T608 acquisition residue differs');
	const cacheEntries = (await readdir(cacheParent)).sort(compare);
	if (canonicalize(cacheEntries) !== canonicalize([t608ClosureDigest]))
		throw new Error('Avataaars T608 cache publication differs');
	const receiptBytes = await readFile(receiptPath);
	const receipt = JSON.parse(receiptBytes.toString('utf8')) as {
		schemaVersion?: unknown;
		fixture?: unknown;
		closure?: { path?: unknown; digest?: unknown; fileSha256?: unknown };
		consentId?: unknown;
		counted?: unknown;
	};
	const published = join(cacheParent, t608ClosureDigest);
	if (
		receipt.schemaVersion !== 'versionless.react-avataaars-react1831-dependency-receipt.v1' ||
		receipt.fixture !== fixture.fixture ||
		receipt.consentId !== AVATAAARS_REACT1831_CONSENT ||
		receipt.counted !== false ||
		receipt.closure?.path !== relative(root, published) ||
		receipt.closure.digest !== t608ClosureDigest ||
		receipt.closure.fileSha256 !== t608ClosureFileSha256
	)
		throw new Error('Avataaars T608 dependency receipt differs');
	const closureBytes = await readFile(join(published, 'closure.json'));
	if (sha256(closureBytes) !== t608ClosureFileSha256)
		throw new Error('Avataaars T608 closure file differs');
	const closure = JSON.parse(closureBytes.toString('utf8')) as {
		schemaVersion?: unknown;
		fixture?: unknown;
		consent?: Record<string, unknown>;
		artifacts?: Array<ParsedMetadata & { url: string; sha256: string; byteLength: number }>;
		ledger?: LedgerRow[];
		nonclaims?: unknown[];
		integrity?: { algorithm?: unknown; canonicalDigest?: unknown };
	};
	const { integrity, ...body } = closure;
	if (
		closure.schemaVersion !== 'versionless.react-avataaars-react1831-closure.v1' ||
		closure.fixture !== fixture.fixture ||
		integrity?.algorithm !== 'sha256' ||
		integrity.canonicalDigest !== t608ClosureDigest ||
		sha256(canonicalize(body)) !== t608ClosureDigest ||
		closure.consent?.id !== AVATAAARS_REACT1831_CONSENT ||
		closure.consent.method !== 'GET' ||
		closure.consent.host !== 'registry.npmjs.org' ||
		closure.consent.responses !== 6 ||
		closure.artifacts?.length !== 3 ||
		closure.ledger?.length !== 6 ||
		closure.nonclaims?.length !== 2
	)
		throw new Error('Avataaars T608 closure semantics differ');
	const artifacts = closure.artifacts;
	const ledger = closure.ledger;
	if (!artifacts || !ledger) throw new Error('Avataaars T608 closure inventory differs');
	const expectedTargets = fixture.packages.map(({ name, version }) => ({ name, version }));
	if (
		canonicalize(artifacts.map(({ name, version }) => ({ name, version }))) !==
		canonicalize(expectedTargets)
	)
		throw new Error('Avataaars T608 artifact identities differ');
	if (
		ledger.some(
			(row, index) =>
				row.ordinal !== index + 1 ||
				row.media !== (index < 3 ? 'metadata' : 'tarball') ||
				row.responseCookieObservation !==
					(row.responseCookiePresent ? 'response-cookie-discarded' : 'absent') ||
				!['absent', 'identity', 'gzip'].includes(row.encoding) ||
				row.wireByteLength < 1 ||
				row.decodedByteLength < 1,
		)
	)
		throw new Error('Avataaars T608 response ledger differs');
	const expectedUrls = [
		...fixture.packages.map((target) => target.metadataUrl),
		...artifacts.map((artifact) => artifact.url),
	];
	if (canonicalize(ledger.map((row) => row.url)) !== canonicalize(expectedUrls))
		throw new Error('Avataaars T608 response URLs differ');
	const tarballDirectory = join(published, 'tarballs');
	const expectedTarballs = artifacts.map((artifact) => `${artifact.sha256}.tgz`).sort(compare);
	if (
		canonicalize((await readdir(tarballDirectory)).sort(compare)) !==
		canonicalize(expectedTarballs)
	)
		throw new Error('Avataaars T608 tarball inventory differs');
	for (const artifact of artifacts) {
		const bytes = await readFile(join(tarballDirectory, `${artifact.sha256}.tgz`));
		if (bytes.byteLength !== artifact.byteLength || sha256(bytes) !== artifact.sha256)
			throw new Error('Avataaars T608 tarball content address differs');
		verifyAvataaarsReact1831Tarball(bytes, { ...artifact, tarball: artifact.url });
	}
	return {
		result: 'verified',
		consentId: AVATAAARS_REACT1831_CONSENT,
		closureDigest: t608ClosureDigest,
		closureFileSha256: t608ClosureFileSha256,
		receiptSha256: sha256(receiptBytes),
		artifacts: artifacts.length,
		responses: ledger.length,
		networkAttempts: 0,
	};
}

export async function acquireAvataaarsReact1831(): Promise<Record<string, unknown>> {
	await verifyAvataaarsProtectedNegativeEvidence();
	const fixture = await loadFixture();
	if (
		(await exists(stageRoot)) ||
		(await exists(cacheParent)) ||
		(await exists(receiptPath)) ||
		(await exists(failurePath)) ||
		(await exists(attemptPath))
	)
		throw new Error('Avataaars React 18.3.1 transaction residue exists');
	await mkdir(t608EvidenceRoot, { recursive: true });
	await writeFile(
		attemptPath,
		canonical({
			schemaVersion: 'versionless.react-avataaars-react1831-t608-attempt.v1',
			consentId: AVATAAARS_REACT1831_CONSENT,
			invoked: true,
			networkRequests: 0,
		}),
	);
	await mkdir(join(stageRoot, 'tarballs'), { recursive: true });
	const ledger: LedgerRow[] = [];
	let current: { ordinal: number; media: LedgerRow['media'] } | null = null;
	try {
		const allowed = new Set(fixture.packages.map((target) => target.metadataUrl));
		const metadata = [];
		for (const target of fixture.packages) {
			current = { ordinal: ledger.length + 1, media: 'metadata' };
			const bytes = await getExact(target.metadataUrl, 'metadata', allowed, ledger);
			const parsed = parseAvataaarsReact1831Metadata(
				JSON.parse(bytes.toString('utf8')),
				target,
			);
			allowed.add(parsed.tarball);
			metadata.push(parsed);
		}
		const artifacts = [];
		for (const item of metadata) {
			current = { ordinal: ledger.length + 1, media: 'tarball' };
			const bytes = await getExact(item.tarball, 'tarball', allowed, ledger);
			const inspection = verifyAvataaarsReact1831Tarball(bytes, item);
			const artifact = {
				name: item.name,
				version: item.version,
				url: item.tarball,
				integrity: item.integrity,
				shasum: item.shasum,
				sha256: sha256(bytes),
				byteLength: bytes.byteLength,
				dependencies: item.dependencies,
				inspection,
			};
			await writeFile(join(stageRoot, 'tarballs', `${artifact.sha256}.tgz`), bytes);
			artifacts.push(artifact);
		}
		if (ledger.length !== 6 || artifacts.length !== 3)
			throw new Error('Avataaars target transaction response cardinality differs');
		const body = {
			schemaVersion: 'versionless.react-avataaars-react1831-closure.v1',
			fixture: fixture.fixture,
			consent: {
				id: AVATAAARS_REACT1831_CONSENT,
				method: 'GET',
				host: 'registry.npmjs.org',
				responses: 6,
				wireResponseLimit: responseLimit,
				decodedResponseLimit: responseLimit,
				aggregateWireLimit: aggregateLimit,
				aggregateDecodedLimit: aggregateLimit,
			},
			artifacts,
			ledger,
			nonclaims: [
				'Authorship is unknown; certification and signer authenticity are not established.',
				'This closure proves only exact package-byte availability and metadata inspection.',
			],
		};
		const closureDigest = sha256(canonicalize(body));
		const closure = {
			...body,
			integrity: { algorithm: 'sha256', canonicalDigest: closureDigest },
		};
		await writeFile(join(stageRoot, 'closure.json'), canonical(closure));
		const published = join(cacheParent, closureDigest);
		await mkdir(cacheParent, { recursive: true });
		await rename(stageRoot, published);
		const receipt = {
			schemaVersion: 'versionless.react-avataaars-react1831-dependency-receipt.v1',
			fixture: fixture.fixture,
			closure: {
				path: relative(root, published),
				digest: closureDigest,
				fileSha256: sha256(await readFile(join(published, 'closure.json'))),
			},
			consentId: AVATAAARS_REACT1831_CONSENT,
			counted: false,
		};
		await writeFile(receiptPath, canonical(receipt));
		return receipt;
	} catch (error) {
		await rm(stageRoot, { recursive: true, force: true });
		await rm(cacheParent, { recursive: true, force: true });
		await writeFile(
			failurePath,
			canonical({
				schemaVersion: 'versionless.react-avataaars-react1831-t608-consumed-failed.v1',
				consentId: AVATAAARS_REACT1831_CONSENT,
				result: 'consumed-failed',
				retry: false,
				networkRequests: ledger.length,
				...projectAvataaarsFailure(error, current, ledger),
			}),
		);
		throw error;
	}
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const mode = parseAvataaarsReact1831Launcher(args);
	if (mode === 'launcher-smoke') {
		await verifyAvataaarsProtectedNegativeEvidence();
		await loadFixture();
		process.stdout.write(
			canonical({
				result: 'pass',
				mode,
				consentId: AVATAAARS_REACT1831_CONSENT,
				requestAttempts: 0,
			}),
		);
		return;
	}
	if (mode === 'verify') {
		process.stdout.write(canonical(await verifyAvataaarsReact1831Acquisition()));
		return;
	}
	const receipt = await acquireAvataaarsReact1831();
	process.stdout.write(canonical(receipt));
}

if (process.argv[1] && basename(process.argv[1]) === 'react-avataaars-compatibility-ingest.ts')
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
