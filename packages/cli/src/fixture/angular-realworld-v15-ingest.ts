import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import {
	access,
	cp,
	mkdir,
	open,
	readFile,
	readdir,
	rename,
	rm,
	writeFile,
} from 'node:fs/promises';
import * as path from 'pathe';
import { parseURL } from 'ufo';
import {
	canonicalize,
	findArchiveFile,
	indexTarGzip,
	inspectNpmPackageTarball,
	parseNpmLockPlan,
	sha256,
	verifyNpmSri,
	type NpmLockPair,
	type PackageMetadata,
} from '../../../core/src/index.ts';

export const ANGULAR_REALWORLD_CONSENT = 'T204-angular-realworld-e28c8969-acquisition';
export const ANGULAR_REALWORLD_COMMIT = 'e28c8969aab9a27ece9873118b1ab7251f9ccb0c';
export const NODE_ARCHIVE_SHA256 =
	'bae4965d29d29bd32f96364eefbe3bca576a03e917ddbb70b9330d75f2cacd76';
export const CHROMIUM_SHA256 = 'a46b3b1e63163fa2d2437fb6ae967cb5a73b50050bca32f1964e6129b6228244';
export const SOURCE_ARCHIVE_SHA256 =
	'030b4dcdd5b2ed1c83365fea957722aa4c86f9a666b1fe790ae098077185b772';
export const EMBEDDED_LOCK_SHA256 =
	'8e54e1a5eefbe8efa120b67900c6e8b2e46f9eaf99896347ee16990c594dc33d';
export const MAXIMUM_REQUESTS = 3_000;
export const MAXIMUM_RESPONSE_BYTES = 128 * 1_024 * 1_024;
export const MAXIMUM_AGGREGATE_BYTES = 2 * 1_024 * 1_024 * 1_024;

const root = path.resolve(import.meta.dirname, '../../../..');
const fixturePath = path.join(root, 'fixtures/angular-realworld-v15/fixture.json');
const cacheRoot = path.join(root, '.versionless/cache/angular-realworld-v15');
const staging = path.join(cacheRoot, '.staging-t205');
const closures = path.join(cacheRoot, 'closures');
const evidenceDirectory = path.join(root, 'evidence/ingests/angular-realworld-v15');
const evidencePath = path.join(evidenceDirectory, 'receipt.json');
const resumeFailurePath = path.join(evidenceDirectory, 't210-failed.json');
const chromiumPath = path.join(
	root,
	'.versionless/cache/react-boilerplate-v4/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell',
);

type LedgerRecord = Readonly<{
	sequence: number;
	method: 'GET';
	url: string;
	status: number;
	byteLength: number;
	sha256: string;
	contentEncoding: 'identity';
}>;

export type AcquisitionState = {
	attempts: number;
	aggregateBytes: number;
	priorAttempts: number;
	priorAggregateBytes: number;
	ledger: LedgerRecord[];
};

type DependencyRecord = Readonly<{
	url: string;
	integrity: string;
	sha256: string;
	byteLength: number;
	identities: NpmLockPair['identities'];
	metadata: PackageMetadata;
}>;

type ClosureManifest = Readonly<{
	schemaVersion: 'versionless.angular-realworld-v15-closure.v1';
	fixture: 'angular-realworld-v15';
	revision: typeof ANGULAR_REALWORLD_COMMIT;
	source: Readonly<{
		url: string;
		archiveSha256: string;
		archiveBytes: number;
		treeSha256: string;
		files: number;
		packageSha256: string;
		lockSha256: string;
		angularSha256: string;
		licenseSha256: string;
		license: 'MIT';
		attribution: 'Copyright (c) 2023 Thinkster';
	}>;
	runtime: Readonly<{
		version: 'v18.20.8';
		platform: 'darwin-arm64';
		archiveUrl: string;
		archiveSha256: typeof NODE_ARCHIVE_SHA256;
		archiveBytes: number;
		checksumUrl: string;
		checksumSha256: string;
	}>;
	dependencies: Readonly<{
		lockfileVersion: 3;
		entries: 994;
		uniqueTarballs: 865;
		uniqueUrlSriPairs: 865;
		repeatedUrlGroups: 38;
		collapsedPlacements: 129;
		sameUrlDifferentSriConflicts: 0;
		artifacts: readonly DependencyRecord[];
		licenseStates: Readonly<Record<string, number>>;
		lifecycleDeclared: number;
		nativeIndicators: number;
		enginesDeclared: number;
		osDeclared: number;
		cpuDeclared: number;
		weakOrMissingLicenseMetadata: number;
	}>;
	browser: Readonly<{ executable: string; sha256: typeof CHROMIUM_SHA256 }>;
	acquisition: Readonly<{
		consentId: typeof ANGULAR_REALWORLD_CONSENT;
		status: 'consumed-closed';
		methods: readonly ['GET'];
		requests: number;
		acceptedBytes: number;
		cumulativeRequests: number;
		cumulativeAcceptedBytes: number;
		limits: Readonly<{
			requests: typeof MAXIMUM_REQUESTS;
			responseBytes: typeof MAXIMUM_RESPONSE_BYTES;
			aggregateBytes: typeof MAXIMUM_AGGREGATE_BYTES;
		}>;
	}>;
	nonclaims: readonly string[];
}>;

export type AcquisitionReceipt = Readonly<{
	schemaVersion: 'versionless.angular-realworld-v15-acquisition.v1';
	result: 'published';
	manifestSha256: string;
	publication: string;
	requests: number;
	acceptedBytes: number;
	cumulativeRequests: number;
	cumulativeAcceptedBytes: number;
	networkAttemptsDuringVerification: 0;
	integrity: Readonly<{ algorithm: 'sha256'; canonicalDigest: string }>;
}>;

type CacheApi = {
	put(
		cache: string,
		key: string,
		bytes: Buffer,
		options: Record<string, unknown>,
	): Promise<unknown>;
};

function exists(file: string): Promise<boolean> {
	return access(file).then(
		() => true,
		() => false,
	);
}

function errorCode(error: unknown): string | undefined {
	return error && typeof error === 'object' && 'code' in error
		? String((error as { code?: unknown }).code)
		: undefined;
}

async function writeContentAddressed(file: string, bytes: Buffer): Promise<void> {
	try {
		await writeFile(file, bytes, { flag: 'wx' });
	} catch (error) {
		if (errorCode(error) !== 'EEXIST' || !bytes.equals(await readFile(file))) throw error;
	}
}

function canonical(value: unknown): string {
	return `${canonicalize(value)}\n`;
}

export function finalizeAcquisitionReceipt(
	value: Omit<AcquisitionReceipt, 'integrity'>,
): AcquisitionReceipt {
	const receipt = { ...value, integrity: { algorithm: 'sha256' as const, canonicalDigest: '' } };
	return {
		...receipt,
		integrity: { algorithm: 'sha256', canonicalDigest: sha256(canonicalize(receipt)) },
	};
}

export function verifyAcquisitionReceipt(value: unknown): AcquisitionReceipt {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error('Angular RealWorld acquisition receipt must be an object');
	const receipt = value as AcquisitionReceipt;
	const copy = structuredClone(receipt);
	(copy.integrity as { canonicalDigest: string }).canonicalDigest = '';
	if (
		receipt.schemaVersion !== 'versionless.angular-realworld-v15-acquisition.v1' ||
		receipt.result !== 'published' ||
		receipt.networkAttemptsDuringVerification !== 0 ||
		receipt.integrity.algorithm !== 'sha256' ||
		sha256(canonicalize(copy)) !== receipt.integrity.canonicalDigest
	)
		throw new Error('Angular RealWorld acquisition receipt differs');
	return receipt;
}

export function assertAcquisitionConsent(consent: string | undefined): void {
	if (
		consent !== ANGULAR_REALWORLD_CONSENT ||
		process.env.VERSIONLESS_NETWORK_MODE !== 'consented'
	)
		throw new Error('Angular RealWorld acquisition requires exact purpose-bound consent');
}

export function assertAcquisitionUrl(url: string, exactRegistryUrls?: ReadonlySet<string>): void {
	const parsed = parseURL(url);
	const exactStatic = new Set([
		`https://codeload.github.com/realworld-apps/angular-realworld-example-app/tar.gz/${ANGULAR_REALWORLD_COMMIT}`,
		'https://nodejs.org/dist/v18.20.8/node-v18.20.8-darwin-arm64.tar.gz',
		'https://nodejs.org/dist/v18.20.8/SHASUMS256.txt',
	]);
	if (
		parsed.protocol !== 'https:' ||
		Boolean(parsed.auth) ||
		Boolean(parsed.search) ||
		Boolean(parsed.hash) ||
		(!exactStatic.has(url) && (!exactRegistryUrls || !exactRegistryUrls.has(url)))
	)
		throw new Error('Angular RealWorld request is outside the exact acquisition scope');
}

export function createAcquisitionState(
	priorAttempts = 0,
	priorAggregateBytes = 0,
): AcquisitionState {
	return { attempts: 0, aggregateBytes: 0, priorAttempts, priorAggregateBytes, ledger: [] };
}

async function boundedResponse(response: Response): Promise<Buffer> {
	if (response.status !== 200 || response.redirected || response.headers.has('location'))
		throw new Error(`Angular RealWorld response status ${response.status} is not accepted`);
	const encoding = response.headers.get('content-encoding');
	if (encoding !== null && encoding !== 'identity')
		throw new Error('Angular RealWorld response content encoding is not identity');
	const declared = response.headers.get('content-length');
	if (
		declared !== null &&
		(!Number.isSafeInteger(Number(declared)) || Number(declared) > MAXIMUM_RESPONSE_BYTES)
	)
		throw new Error('Angular RealWorld response exceeds the per-response limit');
	const reader = response.body?.getReader();
	if (!reader) throw new Error('Angular RealWorld response body is absent');
	const chunks: Buffer[] = [];
	let size = 0;
	while (true) {
		const next = await reader.read();
		if (next.done) break;
		size += next.value.byteLength;
		if (size > MAXIMUM_RESPONSE_BYTES) {
			await reader.cancel();
			throw new Error('Angular RealWorld response exceeds the per-response limit');
		}
		chunks.push(Buffer.from(next.value));
	}
	if (declared !== null && Number(declared) !== size)
		throw new Error('Angular RealWorld response is incomplete');
	return Buffer.concat(chunks);
}

async function acquire(
	url: string,
	state: AcquisitionState,
	exactRegistryUrls: ReadonlySet<string> | undefined,
	fetchImplementation: typeof fetch,
): Promise<Buffer> {
	assertAcquisitionUrl(url, exactRegistryUrls);
	if (state.priorAttempts + state.attempts >= MAXIMUM_REQUESTS)
		throw new Error('Angular RealWorld request limit exceeded');
	const sequence = state.attempts + 1;
	state.attempts = sequence;
	const response = await fetchImplementation(url, {
		method: 'GET',
		redirect: 'manual',
		credentials: 'omit',
		headers: { accept: 'application/octet-stream', 'accept-encoding': 'identity' },
	});
	const bytes = await boundedResponse(response);
	if (
		state.priorAggregateBytes + state.aggregateBytes + bytes.byteLength >
		MAXIMUM_AGGREGATE_BYTES
	)
		throw new Error('Angular RealWorld aggregate response limit exceeded');
	state.aggregateBytes += bytes.byteLength;
	state.ledger.push({
		sequence,
		method: 'GET',
		url,
		status: response.status,
		byteLength: bytes.byteLength,
		sha256: sha256(bytes),
		contentEncoding: 'identity',
	});
	return bytes;
}

async function run(
	command: string,
	args: readonly string[],
	cwd = root,
	environment: NodeJS.ProcessEnv = process.env,
): Promise<{ stdout: string; stderr: string }> {
	return await new Promise((resolve, reject) => {
		const child = spawn(command, [...args], {
			cwd,
			env: environment,
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		child.stdout.on('data', (value: Buffer) => stdout.push(value));
		child.stderr.on('data', (value: Buffer) => stderr.push(value));
		child.once('error', reject);
		child.once('exit', (code) => {
			const result = {
				stdout: Buffer.concat(stdout).toString('utf8'),
				stderr: Buffer.concat(stderr).toString('utf8'),
			};
			if (code === 0) resolve(result);
			else reject(new Error(`${path.basename(command)} exited ${code}: ${result.stderr}`));
		});
	});
}

async function materializeSource(archiveBytes: Buffer): Promise<ReturnType<typeof indexTarGzip>> {
	const index = indexTarGzip(
		{ bytes: archiveBytes, byteLength: archiveBytes.byteLength, sha256: sha256(archiveBytes) },
		ANGULAR_REALWORLD_COMMIT,
	);
	for (const file of index.files) {
		const output = path.join(staging, 'source', file.path);
		await mkdir(path.dirname(output), { recursive: true });
		await writeFile(output, file.bytes, { flag: 'wx' });
	}
	return index;
}

export function analyzeDependencyClosure(
	lockBytes: Buffer,
	requirePinnedHash = true,
): {
	plan: readonly NpmLockPair[];
	entries: 994;
	uniqueUrls: 865;
	uniqueUrlSriPairs: 865;
	repeatedUrlGroups: 38;
	collapsedPlacements: 129;
	rootNullInclusiveValues: 866;
	conflicts: 0;
} {
	if (requirePinnedHash && sha256(lockBytes) !== EMBEDDED_LOCK_SHA256)
		throw new Error('Angular RealWorld embedded package-lock SHA-256 differs');
	const lock = JSON.parse(lockBytes.toString('utf8')) as Record<string, unknown>;
	if (lock.lockfileVersion !== 3 || !lock.packages || typeof lock.packages !== 'object')
		throw new Error('Angular RealWorld lock must be exact lockfileVersion 3');
	const packageRecords = Object.entries(lock.packages as Record<string, unknown>);
	const rootNullInclusiveValues = new Set(
		packageRecords.map(([, raw]) =>
			raw && typeof raw === 'object' && !Array.isArray(raw)
				? ((raw as Record<string, unknown>).resolved ?? null)
				: null,
		),
	).size;
	const entries = packageRecords.filter(([, raw]) => {
		if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
		const entry = raw as Record<string, unknown>;
		return entry.resolved !== undefined || entry.integrity !== undefined;
	});
	if (entries.length !== 994)
		throw new Error(
			`Angular RealWorld lock must contain exactly 994 artifacts, found ${entries.length}`,
		);
	const rawByUrl = new Map<string, number>();
	for (const [name, raw] of entries) {
		const entry = raw as Record<string, unknown>;
		if (
			typeof entry.resolved !== 'string' ||
			typeof entry.integrity !== 'string' ||
			!entry.integrity.startsWith('sha512-')
		)
			throw new Error(`Angular RealWorld lock entry ${name} is incomplete or not SHA-512`);
		rawByUrl.set(entry.resolved, (rawByUrl.get(entry.resolved) ?? 0) + 1);
	}
	const parsed = parseNpmLockPlan(lockBytes);
	const urls = new Set(parsed.pairs.map((pair) => pair.url));
	const repeatedUrlGroups = [...rawByUrl.values()].filter((count) => count > 1).length;
	const collapsedPlacements = [...rawByUrl.values()].reduce(
		(total, count) => total + Math.max(0, count - 1),
		0,
	);
	const pairsByUrl = new Map<string, NpmLockPair[]>();
	for (const pair of parsed.pairs)
		pairsByUrl.set(pair.url, [...(pairsByUrl.get(pair.url) ?? []), pair]);
	const conflicts = [...pairsByUrl.entries()].filter(
		([, pairs]) => new Set(pairs.map((pair) => pair.integrity)).size > 1,
	);
	if (conflicts.length) {
		const details = conflicts.map(([url, pairs]) => ({
			url,
			integrities: pairs.map((pair) => pair.integrity).sort(),
			identities: pairs
				.flatMap((pair) =>
					pair.identities.map((identity) => `${identity.name}@${identity.version}`),
				)
				.sort(),
		}));
		throw new Error(
			`Angular RealWorld same-URL/different-SRI conflict: ${canonicalize(details)}`,
		);
	}
	if (
		parsed.pairs.length !== 865 ||
		urls.size !== 865 ||
		repeatedUrlGroups !== 38 ||
		collapsedPlacements !== 129 ||
		rootNullInclusiveValues !== 866
	)
		throw new Error(
			`Angular RealWorld lock cardinalities differ: ${canonicalize({
				pairs: parsed.pairs.length,
				urls: urls.size,
				repeatedUrlGroups,
				collapsedPlacements,
				rootNullInclusiveValues,
			})}`,
		);
	return {
		plan: parsed.pairs,
		entries: 994,
		uniqueUrls: 865,
		uniqueUrlSriPairs: 865,
		repeatedUrlGroups: 38,
		collapsedPlacements: 129,
		rootNullInclusiveValues: 866,
		conflicts: 0,
	};
}

async function extractRuntime(archiveFile: string): Promise<string> {
	const listing = (await run('tar', ['-tzf', archiveFile])).stdout.split('\n').filter(Boolean);
	if (
		!listing.length ||
		listing.some(
			(file) =>
				file.startsWith('/') ||
				file.includes('\\') ||
				file.split('/').some((segment) => segment === '..'),
		) ||
		new Set(listing.map((file) => file.split('/')[0])).size !== 1
	)
		throw new Error('Node runtime archive paths are unsafe or not single-root');
	const output = path.join(staging, 'runtime-extract');
	await mkdir(output, { recursive: true });
	await run('tar', ['-xzf', archiveFile, '-C', output]);
	const roots = await readdir(output, { withFileTypes: true });
	if (roots.length !== 1 || !roots[0]?.isDirectory())
		throw new Error('Node runtime extraction root differs');
	const runtime = path.join(output, roots[0].name);
	if ((await run(path.join(runtime, 'bin/node'), ['--version'])).stdout.trim() !== 'v18.20.8')
		throw new Error('Node runtime executable identity differs');
	return runtime;
}

function cacheApi(runtime: string): CacheApi {
	const require = createRequire(import.meta.url);
	return require(path.join(runtime, 'lib/node_modules/npm/node_modules/cacache')) as CacheApi;
}

async function cacheTarball(
	runtime: string,
	cache: string,
	pair: NpmLockPair,
	bytes: Buffer,
): Promise<void> {
	await cacheApi(runtime).put(
		path.join(cache, '_cacache'),
		`make-fetch-happen:request-cache:${pair.url}`,
		bytes,
		{
			integrity: pair.integrity,
			metadata: {
				url: pair.url,
				time: 0,
				reqHeaders: {},
				resHeaders: {
					'content-type': 'application/octet-stream',
					'content-length': String(bytes.byteLength),
				},
				options: { compress: false },
			},
		},
	);
}

function metadataSummary(artifacts: readonly DependencyRecord[]) {
	const states: Record<string, number> = { declared: 0, 'file-only': 0, empty: 0, ambiguous: 0 };
	for (const artifact of artifacts) states[artifact.metadata.license.state] += 1;
	return {
		licenseStates: states,
		lifecycleDeclared: artifacts.filter((artifact) =>
			artifact.metadata.lifecycleScripts.some((script) => script.state === 'declared'),
		).length,
		nativeIndicators: artifacts.filter((artifact) => {
			const native = artifact.metadata.nativeIndicators;
			return (
				native.bindingGyp ||
				native.gypfile === 'true' ||
				native.gypfile === 'ambiguous' ||
				native.nodeGypDependency ||
				native.lifecycleMentionsNodeGyp
			);
		}).length,
		enginesDeclared: artifacts.filter(
			(artifact) => artifact.metadata.engines.state === 'declared',
		).length,
		osDeclared: artifacts.filter((artifact) => artifact.metadata.os.state === 'declared')
			.length,
		cpuDeclared: artifacts.filter((artifact) => artifact.metadata.cpu.state === 'declared')
			.length,
		weakOrMissingLicenseMetadata: artifacts.filter((artifact) =>
			['empty', 'ambiguous'].includes(artifact.metadata.license.state),
		).length,
	};
}

async function verifyManifest(
	publication: string,
	expectedDigest: string,
): Promise<ClosureManifest> {
	const manifestBytes = await readFile(path.join(publication, 'manifest.json'));
	const manifest = JSON.parse(manifestBytes.toString('utf8')) as ClosureManifest;
	if (sha256(canonicalize(manifest)) !== expectedDigest)
		throw new Error('Angular RealWorld closure manifest digest differs');
	if (
		manifest.revision !== ANGULAR_REALWORLD_COMMIT ||
		manifest.dependencies.entries !== 994 ||
		manifest.source.archiveSha256 !== SOURCE_ARCHIVE_SHA256 ||
		manifest.source.lockSha256 !== EMBEDDED_LOCK_SHA256 ||
		manifest.dependencies.uniqueTarballs !== 865 ||
		manifest.dependencies.uniqueUrlSriPairs !== 865 ||
		manifest.dependencies.repeatedUrlGroups !== 38 ||
		manifest.dependencies.collapsedPlacements !== 129 ||
		manifest.dependencies.sameUrlDifferentSriConflicts !== 0 ||
		manifest.dependencies.artifacts.length !== 865 ||
		manifest.runtime.archiveSha256 !== NODE_ARCHIVE_SHA256 ||
		manifest.browser.sha256 !== CHROMIUM_SHA256 ||
		manifest.acquisition.requests > MAXIMUM_REQUESTS ||
		manifest.acquisition.cumulativeRequests > MAXIMUM_REQUESTS ||
		manifest.acquisition.cumulativeAcceptedBytes > MAXIMUM_AGGREGATE_BYTES
	)
		throw new Error('Angular RealWorld closure manifest facts differ');
	const sourceArchive = await readFile(path.join(publication, 'source.tar.gz'));
	if (
		sha256(sourceArchive) !== manifest.source.archiveSha256 ||
		sourceArchive.byteLength !== manifest.source.archiveBytes
	)
		throw new Error('Angular RealWorld published source archive differs');
	const sourceIndex = indexTarGzip(
		{
			bytes: sourceArchive,
			byteLength: sourceArchive.byteLength,
			sha256: manifest.source.archiveSha256,
		},
		ANGULAR_REALWORLD_COMMIT,
	);
	if (sourceIndex.manifestSha256 !== manifest.source.treeSha256)
		throw new Error('Angular RealWorld published source tree differs');
	const lock = findArchiveFile(sourceIndex, 'package-lock.json').bytes;
	const closure = analyzeDependencyClosure(lock);
	for (let index = 0; index < closure.plan.length; index += 1) {
		const pair = closure.plan[index]!;
		const artifact = manifest.dependencies.artifacts[index]!;
		if (artifact.url !== pair.url || artifact.integrity !== pair.integrity)
			throw new Error('Angular RealWorld dependency manifest order differs');
		const bytes = await readFile(path.join(publication, `tarballs/${artifact.sha256}.tgz`));
		if (bytes.byteLength !== artifact.byteLength || sha256(bytes) !== artifact.sha256)
			throw new Error('Angular RealWorld dependency publication bytes differ');
		verifyNpmSri(bytes, pair.integrity);
		if (
			canonicalize(inspectNpmPackageTarball(bytes, pair.identities)) !==
			canonicalize(artifact.metadata)
		)
			throw new Error('Angular RealWorld dependency metadata differs');
	}
	if (
		sha256(await readFile(path.join(publication, 'node-runtime.tar.gz'))) !==
		NODE_ARCHIVE_SHA256
	)
		throw new Error('Angular RealWorld published Node archive differs');
	if (sha256(await readFile(chromiumPath)) !== CHROMIUM_SHA256)
		throw new Error('Angular RealWorld cached Chromium differs');
	return manifest;
}

export async function verifyAngularRealWorldAcquisition(): Promise<AcquisitionReceipt> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('Angular RealWorld verify-only requires dual offline controls');
	const receipt = verifyAcquisitionReceipt(JSON.parse(await readFile(evidencePath, 'utf8')));
	const publication = path.join(root, receipt.publication);
	await verifyManifest(publication, receipt.manifestSha256);
	if (await exists(staging))
		throw new Error('Angular RealWorld acquisition staging residue remains');
	return receipt;
}

export async function ingestAngularRealWorld(
	consent: string | undefined,
	fetchImplementation: typeof fetch = fetch,
): Promise<AcquisitionReceipt> {
	assertAcquisitionConsent(consent);
	for (const target of [staging, evidencePath, resumeFailurePath])
		if (await exists(target))
			throw new Error(`Angular RealWorld acquisition target exists: ${target}`);
	const fixture = JSON.parse(await readFile(fixturePath, 'utf8')) as Record<string, unknown>;
	const sourceUrl = String(fixture.archiveUrl);
	const runtime = fixture.runtime as Record<string, unknown>;
	const runtimeUrl = String(runtime.archiveUrl);
	const checksumUrl = String(runtime.checksumUrl);
	const priorEvidence = await Promise.all(
		[
			'acquisition-failed.json',
			'sandbox-network-blocked.json',
			'resume-sandbox-network-blocked.json',
			'resume-publication-cleanup-race.json',
			'resume-failed.json',
		].map(async (name) => {
			const value = JSON.parse(
				await readFile(path.join(evidenceDirectory, name), 'utf8'),
			) as {
				attempts: number;
				aggregateBytes: number | null;
				aggregateBytesUpperBound?: number;
			};
			const aggregateBytes = value.aggregateBytes ?? value.aggregateBytesUpperBound;
			if (aggregateBytes === undefined)
				throw new Error('Angular RealWorld prior accepted-byte accounting is incomplete');
			return { attempts: value.attempts, aggregateBytes };
		}),
	);
	const priorAttempts = priorEvidence.reduce((total, value) => total + value.attempts, 0);
	const priorAggregateBytes = priorEvidence.reduce(
		(total, value) => total + value.aggregateBytes,
		0,
	);
	if (priorAttempts !== 209 || priorAggregateBytes !== 1_212_337_032)
		throw new Error('Angular RealWorld T210 cumulative starting state differs');
	const state = createAcquisitionState(priorAttempts, priorAggregateBytes);
	let publication: string | undefined;
	let publicationCreated = false;
	try {
		await mkdir(path.join(staging, 'tarballs'), { recursive: true });
		await mkdir(path.join(staging, 'npm-cache'), { recursive: true });
		const sourceArchive = await acquire(sourceUrl, state, undefined, fetchImplementation);
		if (sha256(sourceArchive) !== SOURCE_ARCHIVE_SHA256)
			throw new Error('Angular RealWorld source archive SHA-256 differs');
		const sourceIndex = await materializeSource(sourceArchive);
		const packageFile = findArchiveFile(sourceIndex, 'package.json');
		const lockFile = findArchiveFile(sourceIndex, 'package-lock.json');
		const angularFile = findArchiveFile(sourceIndex, 'angular.json');
		const licenseFile = findArchiveFile(sourceIndex, 'LICENSE');
		const license = licenseFile.bytes.toString('utf8');
		if (!license.includes('MIT License') || !license.includes('Copyright (c) 2023 Thinkster'))
			throw new Error('Angular RealWorld committed Thinkster MIT license differs');
		const closure = analyzeDependencyClosure(lockFile.bytes);
		const registryUrls = new Set(closure.plan.map((pair) => pair.url));
		const checksumBytes = await acquire(checksumUrl, state, undefined, fetchImplementation);
		if (
			!checksumBytes
				.toString('utf8')
				.split('\n')
				.includes(`${NODE_ARCHIVE_SHA256}  node-v18.20.8-darwin-arm64.tar.gz`)
		)
			throw new Error('Official Node checksum document does not pin the expected archive');
		const runtimeArchive = await acquire(runtimeUrl, state, undefined, fetchImplementation);
		if (sha256(runtimeArchive) !== NODE_ARCHIVE_SHA256)
			throw new Error('Node v18.20.8 Darwin arm64 archive SHA-256 differs');
		await writeFile(path.join(staging, 'node-runtime.tar.gz'), runtimeArchive, { flag: 'wx' });
		await writeFile(path.join(staging, 'node-SHASUMS256.txt'), checksumBytes, { flag: 'wx' });
		const runtimeRoot = await extractRuntime(path.join(staging, 'node-runtime.tar.gz'));
		const artifacts: DependencyRecord[] = [];
		for (let offset = 0; offset < closure.plan.length; offset += 8) {
			const batch = closure.plan.slice(offset, offset + 8);
			const settled = await Promise.allSettled(
				batch.map(async (pair) => {
					const bytes = await acquire(pair.url, state, registryUrls, fetchImplementation);
					verifyNpmSri(bytes, pair.integrity);
					const metadata = inspectNpmPackageTarball(bytes, pair.identities);
					const digest = sha256(bytes);
					await writeContentAddressed(
						path.join(staging, `tarballs/${digest}.tgz`),
						bytes,
					);
					await cacheTarball(runtimeRoot, path.join(staging, 'npm-cache'), pair, bytes);
					return {
						url: pair.url,
						integrity: pair.integrity,
						sha256: digest,
						byteLength: bytes.byteLength,
						identities: pair.identities,
						metadata,
					} satisfies DependencyRecord;
				}),
			);
			const failed = settled.find(
				(result): result is PromiseRejectedResult => result.status === 'rejected',
			);
			if (failed) throw failed.reason;
			const acquired = settled.map(
				(result) => (result as PromiseFulfilledResult<DependencyRecord>).value,
			);
			artifacts.push(...acquired);
		}
		if (artifacts.length !== 865 || state.attempts !== 868 || state.ledger.length !== 868)
			throw new Error('Angular RealWorld acquisition ledger or artifact count differs');
		await writeFile(path.join(staging, 'source.tar.gz'), sourceArchive, { flag: 'wx' });
		await writeFile(path.join(staging, 'ledger.json'), canonical(state.ledger), { flag: 'wx' });
		const summary = metadataSummary(artifacts);
		const manifest: ClosureManifest = {
			schemaVersion: 'versionless.angular-realworld-v15-closure.v1',
			fixture: 'angular-realworld-v15',
			revision: ANGULAR_REALWORLD_COMMIT,
			source: {
				url: sourceUrl,
				archiveSha256: sha256(sourceArchive),
				archiveBytes: sourceArchive.byteLength,
				treeSha256: sourceIndex.manifestSha256,
				files: sourceIndex.files.length,
				packageSha256: packageFile.sha256,
				lockSha256: lockFile.sha256,
				angularSha256: angularFile.sha256,
				licenseSha256: licenseFile.sha256,
				license: 'MIT',
				attribution: 'Copyright (c) 2023 Thinkster',
			},
			runtime: {
				version: 'v18.20.8',
				platform: 'darwin-arm64',
				archiveUrl: runtimeUrl,
				archiveSha256: NODE_ARCHIVE_SHA256,
				archiveBytes: runtimeArchive.byteLength,
				checksumUrl,
				checksumSha256: sha256(checksumBytes),
			},
			dependencies: {
				lockfileVersion: 3,
				entries: 994,
				uniqueTarballs: 865,
				uniqueUrlSriPairs: closure.uniqueUrlSriPairs,
				repeatedUrlGroups: closure.repeatedUrlGroups,
				collapsedPlacements: closure.collapsedPlacements,
				sameUrlDifferentSriConflicts: closure.conflicts,
				artifacts,
				...summary,
			},
			browser: { executable: path.relative(root, chromiumPath), sha256: CHROMIUM_SHA256 },
			acquisition: {
				consentId: ANGULAR_REALWORLD_CONSENT,
				status: 'consumed-closed',
				methods: ['GET'],
				requests: state.attempts,
				acceptedBytes: state.aggregateBytes,
				cumulativeRequests: state.priorAttempts + state.attempts,
				cumulativeAcceptedBytes: state.priorAggregateBytes + state.aggregateBytes,
				limits: {
					requests: MAXIMUM_REQUESTS,
					responseBytes: MAXIMUM_RESPONSE_BYTES,
					aggregateBytes: MAXIMUM_AGGREGATE_BYTES,
				},
			},
			nonclaims: [
				'Acquisition establishes exact local bytes and metadata only; it does not establish migration, support, pilot status, compliance, certification, signer authenticity, or OS-wide isolation.',
			],
		};
		const manifestDigest = sha256(canonicalize(manifest));
		await writeFile(path.join(staging, 'manifest.json'), canonical(manifest), { flag: 'wx' });
		await rm(path.join(staging, 'runtime-extract'), { recursive: true, force: true });
		publication = path.join(closures, manifestDigest);
		if (await exists(publication))
			throw new Error('Angular RealWorld content-addressed publication already exists');
		await mkdir(closures, { recursive: true });
		await rename(staging, publication);
		publicationCreated = true;
		const receipt = finalizeAcquisitionReceipt({
			schemaVersion: 'versionless.angular-realworld-v15-acquisition.v1',
			result: 'published',
			manifestSha256: manifestDigest,
			publication: path.relative(root, publication),
			requests: state.attempts,
			acceptedBytes: state.aggregateBytes,
			cumulativeRequests: state.priorAttempts + state.attempts,
			cumulativeAcceptedBytes: state.priorAggregateBytes + state.aggregateBytes,
			networkAttemptsDuringVerification: 0,
		});
		await mkdir(evidenceDirectory, { recursive: true });
		const handle = await open(evidencePath, 'wx');
		try {
			await handle.writeFile(canonical(receipt));
		} finally {
			await handle.close();
		}
		return receipt;
	} catch (error) {
		await rm(staging, { recursive: true, force: true });
		if (publication && publicationCreated)
			await rm(publication, { recursive: true, force: true });
		await mkdir(evidenceDirectory, { recursive: true });
		await writeFile(
			resumeFailurePath,
			canonical({
				schemaVersion: 'versionless.angular-realworld-v15-acquisition-failure.v1',
				result: 'failed',
				consent: ANGULAR_REALWORLD_CONSENT,
				attempts: state.attempts,
				aggregateBytes: state.aggregateBytes,
				priorAttempts: state.priorAttempts,
				priorAggregateBytes: state.priorAggregateBytes,
				ledger: state.ledger,
				reason: error instanceof Error ? error.message : String(error),
			}),
			{ flag: 'wx' },
		).catch(() => undefined);
		throw error;
	}
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	if (args.includes('--verify-only')) {
		const receipt = await verifyAngularRealWorldAcquisition();
		process.stdout.write(canonical({ ...receipt, verification: 'verified' }));
		return;
	}
	const index = args.indexOf('--consent');
	const receipt = await ingestAngularRealWorld(index < 0 ? undefined : args[index + 1]);
	process.stdout.write(canonical(receipt));
}

if (process.argv[1]?.endsWith('angular-realworld-v15-ingest.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
