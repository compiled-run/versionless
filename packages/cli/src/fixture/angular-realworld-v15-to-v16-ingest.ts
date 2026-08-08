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
} from '../../../core/src/index.ts';

export const V16_CONSENT = 'T218-angular-realworld-v16-acquisition';
export const PARENT_COMMIT = 'e28c8969aab9a27ece9873118b1ab7251f9ccb0c';
export const TARGET_COMMIT = '0d28f5c63b9cd678a3f1f724f68d6e41363bdd5a';
export const TARGET_TREE = '8ed918dfdf28dcf7ee4b76a206b3967a2cc65cf5';
export const TARGET_ARCHIVE_SHA256 =
	'b834410ded0baae07950ba680d2ee82a5d7b797ee01bd86d9a901d3e696544a2';
export const TARGET_PACKAGE_SHA256 =
	'48e23882a01326609a8c9b5fdf4b039a42ac013705a6d15b9104ddd3b28809ec';
export const TARGET_LOCK_SHA256 =
	'030d8e0661fc5a0cfa54cffa3a7a33a488cdc6007e8671f7f52d87306f356016';
export const ANGULAR_JSON_SHA256 =
	'ff32ac6bdf0edff962388c0fd4368c61e88438c3dac9c4cc378a22805639bf7e';
export const LICENSE_SHA256 = 'dd241fc76d00987f9a025558ec977a2df69875320ab0379bd8f5865ad1033c7b';
const MAX_REQUESTS = 1_500;
const MAX_RESPONSE_BYTES = 128 * 1_024 * 1_024;
const MAX_AGGREGATE_BYTES = 2 * 1_024 * 1_024 * 1_024;
const root = path.resolve(import.meta.dirname, '../../../..');
const fixturePath = path.join(root, 'fixtures/angular-realworld-v15-to-v16/fixture.json');
const cacheRoot = path.join(root, '.versionless/cache/angular-realworld-v16');
const staging = path.join(cacheRoot, '.staging-t218');
const closures = path.join(cacheRoot, 'closures');
const evidenceDirectory = path.join(root, 'evidence/ingests/angular-realworld-v16');
const receiptPath = path.join(evidenceDirectory, 'receipt.json');
const failurePath = path.join(evidenceDirectory, 'failure.json');
const v15Publication = path.join(
	root,
	'.versionless/cache/angular-realworld-v15/closures/d3576ef3443079903aa0fa2c2337fbf8fcab88fdfeea3ff5b8de03e99587b8f9',
);

type Ledger = Readonly<{
	sequence: number;
	method: 'GET';
	url: string;
	status: number;
	byteLength: number;
	sha256: string;
}>;
type State = { attempts: number; aggregateBytes: number; ledger: Ledger[] };
type Artifact = Readonly<{
	url: string;
	integrity: string;
	sha256: string;
	byteLength: number;
	identities: NpmLockPair['identities'];
}>;
type Manifest = Readonly<{
	schemaVersion: 'versionless.angular-realworld-v16-closure.v1';
	parentCommit: typeof PARENT_COMMIT;
	targetCommit: typeof TARGET_COMMIT;
	targetTree: typeof TARGET_TREE;
	source: Readonly<{
		archiveUrl: string;
		archiveSha256: typeof TARGET_ARCHIVE_SHA256;
		archiveBytes: number;
		treeSha256: string;
		files: number;
		packageSha256: typeof TARGET_PACKAGE_SHA256;
		lockSha256: typeof TARGET_LOCK_SHA256;
		angularSha256: typeof ANGULAR_JSON_SHA256;
		licenseSha256: typeof LICENSE_SHA256;
		changedFiles: readonly ['package-lock.json', 'package.json'];
		applicationFilesChanged: 0;
	}>;
	dependencies: Readonly<{
		lockfileVersion: 3;
		records: 1100;
		artifacts: 1099;
		uniqueUrls: 939;
		angularCore: '16.2.11';
		angularCompilerCli: '16.2.11';
		angularCli: '16.2.8';
		angularBuilder: '16.2.8';
		typescript: '5.1.6';
		typesNode: '18.15.11';
		zoneJs: '0.13.3';
		items: readonly Artifact[];
	}>;
	acquisition: Readonly<{
		consentId: typeof V16_CONSENT;
		requests: number;
		acceptedBytes: number;
		limits: Readonly<{
			requests: 1500;
			responseBytes: number;
			aggregateBytes: number;
		}>;
	}>;
	nonclaims: readonly string[];
}>;

export type V16AcquisitionReceipt = Readonly<{
	schemaVersion: 'versionless.angular-realworld-v16-acquisition.v1';
	result: 'published';
	manifestSha256: string;
	publication: string;
	requests: number;
	acceptedBytes: number;
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

function canonical(value: unknown): string {
	return `${canonicalize(value)}\n`;
}

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

export function finalizeV16Acquisition(
	receipt: Omit<V16AcquisitionReceipt, 'integrity'>,
): V16AcquisitionReceipt {
	const value = { ...receipt, integrity: { algorithm: 'sha256' as const, canonicalDigest: '' } };
	return {
		...value,
		integrity: { algorithm: 'sha256', canonicalDigest: sha256(canonicalize(value)) },
	};
}

export function verifyV16Acquisition(value: unknown): V16AcquisitionReceipt {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error('Angular RealWorld v16 acquisition receipt must be an object');
	const receipt = value as V16AcquisitionReceipt;
	const copy = structuredClone(receipt);
	(copy.integrity as { canonicalDigest: string }).canonicalDigest = '';
	if (
		receipt.schemaVersion !== 'versionless.angular-realworld-v16-acquisition.v1' ||
		receipt.result !== 'published' ||
		receipt.networkAttemptsDuringVerification !== 0 ||
		receipt.integrity.algorithm !== 'sha256' ||
		sha256(canonicalize(copy)) !== receipt.integrity.canonicalDigest
	)
		throw new Error('Angular RealWorld v16 acquisition receipt differs');
	return receipt;
}

export function assertV16Consent(consent: string | undefined): void {
	if (consent !== V16_CONSENT || process.env.VERSIONLESS_NETWORK_MODE !== 'consented')
		throw new Error('Angular RealWorld v16 acquisition requires exact consent');
}

export function assertV16Url(url: string, registry?: ReadonlySet<string>): void {
	const parsed = parseURL(url);
	const staticUrls = new Set([
		`https://api.github.com/repos/realworld-apps/angular-realworld-example-app/git/commits/${TARGET_COMMIT}`,
		`https://codeload.github.com/realworld-apps/angular-realworld-example-app/tar.gz/${TARGET_COMMIT}`,
	]);
	if (
		parsed.protocol !== 'https:' ||
		Boolean(parsed.auth) ||
		Boolean(parsed.search) ||
		Boolean(parsed.hash) ||
		(!staticUrls.has(url) && (!registry || !registry.has(url)))
	)
		throw new Error('Angular RealWorld v16 URL is outside exact acquisition scope');
}

async function boundedResponse(response: Response): Promise<Buffer> {
	if (response.status !== 200 || response.redirected || response.headers.has('location'))
		throw new Error(`Angular RealWorld v16 response status ${response.status} is not accepted`);
	const encoding = response.headers.get('content-encoding');
	if (encoding !== null && encoding !== 'identity')
		throw new Error('Angular RealWorld v16 response encoding differs');
	const declared = response.headers.get('content-length');
	if (declared !== null && Number(declared) > MAX_RESPONSE_BYTES)
		throw new Error('Angular RealWorld v16 response exceeds limit');
	const reader = response.body?.getReader();
	if (!reader) throw new Error('Angular RealWorld v16 response body is absent');
	const chunks: Buffer[] = [];
	let size = 0;
	while (true) {
		const next = await reader.read();
		if (next.done) break;
		size += next.value.byteLength;
		if (size > MAX_RESPONSE_BYTES)
			throw new Error('Angular RealWorld v16 response exceeds limit');
		chunks.push(Buffer.from(next.value));
	}
	if (declared !== null && Number(declared) !== size)
		throw new Error('Angular RealWorld v16 response is incomplete');
	return Buffer.concat(chunks);
}

async function acquire(
	url: string,
	state: State,
	registry: ReadonlySet<string> | undefined,
	fetchImplementation: typeof fetch,
): Promise<Buffer> {
	assertV16Url(url, registry);
	if (state.attempts >= MAX_REQUESTS)
		throw new Error('Angular RealWorld v16 request limit exceeded');
	const sequence = state.attempts + 1;
	state.attempts = sequence;
	const response = await fetchImplementation(url, {
		method: 'GET',
		redirect: 'manual',
		credentials: 'omit',
		headers: {
			accept: url.includes('/git/commits/')
				? 'application/vnd.github+json'
				: 'application/octet-stream',
			'accept-encoding': 'identity',
		},
	});
	const bytes = await boundedResponse(response);
	if (state.aggregateBytes + bytes.byteLength > MAX_AGGREGATE_BYTES)
		throw new Error('Angular RealWorld v16 aggregate limit exceeded');
	state.aggregateBytes += bytes.byteLength;
	state.ledger.push({
		sequence,
		method: 'GET',
		url,
		status: response.status,
		byteLength: bytes.byteLength,
		sha256: sha256(bytes),
	});
	return bytes;
}

async function run(command: string, args: readonly string[]): Promise<string> {
	return await new Promise((resolve, reject) => {
		const child = spawn(command, [...args], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
		const output: Buffer[] = [];
		const errors: Buffer[] = [];
		child.stdout.on('data', (value: Buffer) => output.push(value));
		child.stderr.on('data', (value: Buffer) => errors.push(value));
		child.once('error', reject);
		child.once('exit', (code) =>
			code === 0
				? resolve(Buffer.concat(output).toString('utf8'))
				: reject(new Error(`${path.basename(command)} failed: ${Buffer.concat(errors)}`)),
		);
	});
}

function cacheApi(runtime: string): CacheApi {
	return createRequire(import.meta.url)(
		path.join(runtime, 'lib/node_modules/npm/node_modules/cacache'),
	) as CacheApi;
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

function packageVersion(packages: Record<string, unknown>, name: string): string {
	const value = packages[`node_modules/${name}`];
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`Angular RealWorld v16 locked ${name} is absent`);
	const version = (value as Record<string, unknown>).version;
	if (typeof version !== 'string')
		throw new Error(`Angular RealWorld v16 locked ${name} differs`);
	return version;
}

function analyzeLock(bytes: Buffer): readonly NpmLockPair[] {
	if (sha256(bytes) !== TARGET_LOCK_SHA256)
		throw new Error('Angular RealWorld v16 lock hash differs');
	const lock = JSON.parse(bytes.toString('utf8')) as Record<string, unknown>;
	if (lock.lockfileVersion !== 3 || !lock.packages || typeof lock.packages !== 'object')
		throw new Error('Angular RealWorld v16 lock format differs');
	const packages = lock.packages as Record<string, unknown>;
	const records = Object.entries(packages);
	const artifacts = records.filter(([, value]) => {
		if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
		const record = value as Record<string, unknown>;
		return record.resolved !== undefined || record.integrity !== undefined;
	});
	if (records.length !== 1100 || artifacts.length !== 1099)
		throw new Error('Angular RealWorld v16 lock record counts differ');
	for (const [name, value] of artifacts) {
		const record = value as Record<string, unknown>;
		if (
			typeof record.resolved !== 'string' ||
			typeof record.integrity !== 'string' ||
			!record.integrity.startsWith('sha512-')
		)
			throw new Error(`Angular RealWorld v16 lock artifact ${name} is incomplete or weak`);
	}
	const plan = parseNpmLockPlan(bytes).pairs;
	if (plan.length !== 939 || new Set(plan.map((pair) => pair.url)).size !== 939)
		throw new Error('Angular RealWorld v16 lock URL cardinality or SRI conflicts differ');
	const expected = {
		'@angular/core': '16.2.11',
		'@angular/compiler-cli': '16.2.11',
		'@angular/cli': '16.2.8',
		'@angular-devkit/build-angular': '16.2.8',
		typescript: '5.1.6',
		'@types/node': '18.15.11',
		'zone.js': '0.13.3',
	};
	for (const [name, version] of Object.entries(expected))
		if (packageVersion(packages, name) !== version)
			throw new Error(`Angular RealWorld v16 locked ${name} identity differs`);
	return plan;
}

async function materializeSource(archive: Buffer) {
	const index = indexTarGzip(
		{ bytes: archive, byteLength: archive.byteLength, sha256: sha256(archive) },
		TARGET_COMMIT,
	);
	for (const file of index.files) {
		const output = path.join(staging, 'source', file.path);
		await mkdir(path.dirname(output), { recursive: true });
		await writeFile(output, file.bytes, { flag: 'wx' });
	}
	return index;
}

async function verifyOnlyManifest(publication: string, expectedDigest: string): Promise<Manifest> {
	const manifest = JSON.parse(
		await readFile(path.join(publication, 'manifest.json'), 'utf8'),
	) as Manifest;
	if (sha256(canonicalize(manifest)) !== expectedDigest)
		throw new Error('Angular RealWorld v16 manifest digest differs');
	if (
		manifest.parentCommit !== PARENT_COMMIT ||
		manifest.targetCommit !== TARGET_COMMIT ||
		manifest.targetTree !== TARGET_TREE ||
		manifest.source.archiveSha256 !== TARGET_ARCHIVE_SHA256 ||
		manifest.source.packageSha256 !== TARGET_PACKAGE_SHA256 ||
		manifest.source.lockSha256 !== TARGET_LOCK_SHA256 ||
		manifest.dependencies.records !== 1100 ||
		manifest.dependencies.artifacts !== 1099 ||
		manifest.dependencies.uniqueUrls !== 939 ||
		manifest.dependencies.items.length !== 939
	)
		throw new Error('Angular RealWorld v16 manifest facts differ');
	const archive = await readFile(path.join(publication, 'source.tar.gz'));
	if (sha256(archive) !== TARGET_ARCHIVE_SHA256)
		throw new Error('Angular RealWorld v16 source differs');
	const index = indexTarGzip(
		{ bytes: archive, byteLength: archive.byteLength, sha256: TARGET_ARCHIVE_SHA256 },
		TARGET_COMMIT,
	);
	const plan = analyzeLock(findArchiveFile(index, 'package-lock.json').bytes);
	for (let item = 0; item < plan.length; item += 1) {
		const pair = plan[item]!;
		const artifact = manifest.dependencies.items[item]!;
		if (artifact.url !== pair.url || artifact.integrity !== pair.integrity)
			throw new Error('Angular RealWorld v16 artifact order differs');
		const bytes = await readFile(path.join(publication, `tarballs/${artifact.sha256}.tgz`));
		if (bytes.byteLength !== artifact.byteLength || sha256(bytes) !== artifact.sha256)
			throw new Error('Angular RealWorld v16 artifact bytes differ');
		verifyNpmSri(bytes, pair.integrity);
		inspectNpmPackageTarball(bytes, pair.identities);
	}
	return manifest;
}

export async function verifyAngularRealWorldV16(): Promise<V16AcquisitionReceipt> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('Angular RealWorld v16 verification requires dual offline controls');
	const receipt = verifyV16Acquisition(JSON.parse(await readFile(receiptPath, 'utf8')));
	await verifyOnlyManifest(path.join(root, receipt.publication), receipt.manifestSha256);
	if (await exists(staging)) throw new Error('Angular RealWorld v16 staging residue remains');
	return receipt;
}

export async function ingestAngularRealWorldV16(
	consent: string | undefined,
	fetchImplementation: typeof fetch = fetch,
): Promise<V16AcquisitionReceipt> {
	assertV16Consent(consent);
	for (const target of [staging, receiptPath, failurePath])
		if (await exists(target)) throw new Error(`Angular RealWorld v16 target exists: ${target}`);
	const fixture = JSON.parse(await readFile(fixturePath, 'utf8')) as Record<string, string>;
	const priorFailure = JSON.parse(
		await readFile(path.join(evidenceDirectory, 'github-commit-accept-415.json'), 'utf8'),
	) as { attempts?: unknown; aggregateBytes?: unknown };
	if (priorFailure.attempts !== 1 || priorFailure.aggregateBytes !== 0)
		throw new Error('Angular RealWorld v16 prior acquisition accounting differs');
	const state: State = { attempts: 1, aggregateBytes: 0, ledger: [] };
	let publication: string | undefined;
	let publicationCreated = false;
	try {
		await mkdir(path.join(staging, 'source'), { recursive: true });
		await mkdir(path.join(staging, 'tarballs'), { recursive: true });
		await mkdir(path.join(staging, 'npm-cache'), { recursive: true });
		const commitBytes = await acquire(
			fixture.commitApiUrl!,
			state,
			undefined,
			fetchImplementation,
		);
		const commit = JSON.parse(commitBytes.toString('utf8')) as {
			sha?: unknown;
			tree?: { sha?: unknown };
			parents?: Array<{ sha?: unknown }>;
		};
		if (
			commit.sha !== TARGET_COMMIT ||
			commit.tree?.sha !== TARGET_TREE ||
			commit.parents?.length !== 1 ||
			commit.parents[0]?.sha !== PARENT_COMMIT
		)
			throw new Error('Angular RealWorld v16 commit metadata differs');
		const archive = await acquire(fixture.archiveUrl!, state, undefined, fetchImplementation);
		if (sha256(archive) !== TARGET_ARCHIVE_SHA256)
			throw new Error('Angular RealWorld v16 archive hash differs');
		const index = await materializeSource(archive);
		const packageFile = findArchiveFile(index, 'package.json');
		const lockFile = findArchiveFile(index, 'package-lock.json');
		const angularFile = findArchiveFile(index, 'angular.json');
		const licenseFile = findArchiveFile(index, 'LICENSE');
		if (
			packageFile.sha256 !== TARGET_PACKAGE_SHA256 ||
			angularFile.sha256 !== ANGULAR_JSON_SHA256 ||
			licenseFile.sha256 !== LICENSE_SHA256
		)
			throw new Error('Angular RealWorld v16 pinned source file differs');
		const plan = analyzeLock(lockFile.bytes);
		const parentFiles = await readdir(path.join(v15Publication, 'source'), { recursive: true });
		const ignored = new Set(['package-lock.json', 'package.json']);
		for (const relative of parentFiles) {
			if (typeof relative !== 'string' || ignored.has(relative)) continue;
			const parent = path.join(v15Publication, 'source', relative);
			const target = path.join(staging, 'source', relative);
			if ((await exists(parent)) && (await exists(target))) {
				const parentBytes = await readFile(parent).catch(() => undefined);
				const targetBytes = await readFile(target).catch(() => undefined);
				if (parentBytes && targetBytes && !parentBytes.equals(targetBytes))
					throw new Error(
						`Angular RealWorld v16 unexpected application change: ${relative}`,
					);
			}
		}
		const runtimeExtract = path.join(staging, 'runtime');
		await mkdir(runtimeExtract);
		await run('tar', [
			'-xzf',
			path.join(v15Publication, 'node-runtime.tar.gz'),
			'-C',
			runtimeExtract,
		]);
		const runtimeEntries = await readdir(runtimeExtract, { withFileTypes: true });
		if (runtimeEntries.length !== 1 || !runtimeEntries[0]?.isDirectory())
			throw new Error('Angular RealWorld v16 reused runtime extraction differs');
		const runtime = path.join(runtimeExtract, runtimeEntries[0].name);
		const registry = new Set(plan.map((pair) => pair.url));
		const items: Artifact[] = [];
		for (let offset = 0; offset < plan.length; offset += 8) {
			const settled = await Promise.allSettled(
				plan.slice(offset, offset + 8).map(async (pair) => {
					const bytes = await acquire(pair.url, state, registry, fetchImplementation);
					verifyNpmSri(bytes, pair.integrity);
					inspectNpmPackageTarball(bytes, pair.identities);
					const digest = sha256(bytes);
					await writeContentAddressed(
						path.join(staging, `tarballs/${digest}.tgz`),
						bytes,
					);
					await cacheTarball(runtime, path.join(staging, 'npm-cache'), pair, bytes);
					return {
						url: pair.url,
						integrity: pair.integrity,
						sha256: digest,
						byteLength: bytes.byteLength,
						identities: pair.identities,
					} satisfies Artifact;
				}),
			);
			const failed = settled.find(
				(result): result is PromiseRejectedResult => result.status === 'rejected',
			);
			if (failed) throw failed.reason;
			items.push(
				...settled.map((result) => (result as PromiseFulfilledResult<Artifact>).value),
			);
		}
		if (items.length !== 939 || state.attempts !== 942 || state.ledger.length !== 941)
			throw new Error('Angular RealWorld v16 acquisition counts differ');
		await writeFile(path.join(staging, 'source.tar.gz'), archive, { flag: 'wx' });
		await writeFile(path.join(staging, 'commit.json'), commitBytes, { flag: 'wx' });
		await writeFile(path.join(staging, 'ledger.json'), canonical(state.ledger), { flag: 'wx' });
		await rm(runtimeExtract, { recursive: true, force: true });
		const manifest: Manifest = {
			schemaVersion: 'versionless.angular-realworld-v16-closure.v1',
			parentCommit: PARENT_COMMIT,
			targetCommit: TARGET_COMMIT,
			targetTree: TARGET_TREE,
			source: {
				archiveUrl: fixture.archiveUrl!,
				archiveSha256: TARGET_ARCHIVE_SHA256,
				archiveBytes: archive.byteLength,
				treeSha256: index.manifestSha256,
				files: index.files.length,
				packageSha256: TARGET_PACKAGE_SHA256,
				lockSha256: TARGET_LOCK_SHA256,
				angularSha256: ANGULAR_JSON_SHA256,
				licenseSha256: LICENSE_SHA256,
				changedFiles: ['package-lock.json', 'package.json'],
				applicationFilesChanged: 0,
			},
			dependencies: {
				lockfileVersion: 3,
				records: 1100,
				artifacts: 1099,
				uniqueUrls: 939,
				angularCore: '16.2.11',
				angularCompilerCli: '16.2.11',
				angularCli: '16.2.8',
				angularBuilder: '16.2.8',
				typescript: '5.1.6',
				typesNode: '18.15.11',
				zoneJs: '0.13.3',
				items,
			},
			acquisition: {
				consentId: V16_CONSENT,
				requests: state.attempts,
				acceptedBytes: state.aggregateBytes,
				limits: {
					requests: 1500,
					responseBytes: MAX_RESPONSE_BYTES,
					aggregateBytes: MAX_AGGREGATE_BYTES,
				},
			},
			nonclaims: [
				'One immutable adjacent-major source and dependency closure; no generic support, pilot, production, certification, authenticity, signed provenance, or OS-wide isolation claim.',
			],
		};
		const digest = sha256(canonicalize(manifest));
		await writeFile(path.join(staging, 'manifest.json'), canonical(manifest), { flag: 'wx' });
		await mkdir(closures, { recursive: true });
		publication = path.join(closures, digest);
		if (await exists(publication))
			throw new Error('Angular RealWorld v16 publication already exists');
		await rename(staging, publication);
		publicationCreated = true;
		const receipt = finalizeV16Acquisition({
			schemaVersion: 'versionless.angular-realworld-v16-acquisition.v1',
			result: 'published',
			manifestSha256: digest,
			publication: path.relative(root, publication),
			requests: state.attempts,
			acceptedBytes: state.aggregateBytes,
			networkAttemptsDuringVerification: 0,
		});
		await mkdir(evidenceDirectory, { recursive: true });
		const handle = await open(receiptPath, 'wx');
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
			failurePath,
			canonical({
				schemaVersion: 'versionless.angular-realworld-v16-acquisition-failure.v1',
				result: 'failed',
				attempts: state.attempts,
				aggregateBytes: state.aggregateBytes,
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
		process.stdout.write(
			canonical({ ...(await verifyAngularRealWorldV16()), verification: 'verified' }),
		);
		return;
	}
	const consentIndex = args.indexOf('--consent');
	process.stdout.write(
		canonical(
			await ingestAngularRealWorldV16(consentIndex < 0 ? undefined : args[consentIndex + 1]),
		),
	);
}

if (process.argv[1]?.endsWith('angular-realworld-v15-to-v16-ingest.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
