import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { access, mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { parseURL } from 'ufo';
import {
	FUXA_LOCK_SHA256,
	FUXA_REPLAY_SHA256,
	TECHNICAL_EVALUATION_BOUNDARY,
	canonicalize,
	findArchiveFile,
	indexTarGzip,
	inspectNpmPackageTarball,
	parseFuxaDependencyPlan,
	sha256,
	verifyDependencySri,
	type DependencyRequest,
} from '../../../core/src/index.ts';

export const FUXA_TECHNICAL_CONSENT = 'T621-angular-fuxa-local-technical-evaluation' as const;
export const FUXA_PRODUCTION_REQUESTS = 1_222;
export const FUXA_PRODUCTION_RESPONSE_LIMIT = 128 * 1_024 * 1_024;
export const FUXA_PRODUCTION_AGGREGATE_LIMIT = 3 * 1_024 * 1_024 * 1_024;
export const FUXA_PRODUCTION_REQUEST_LIMIT = 4_000;
const commit = '8b323c177615c0d152a54e5ef0a6f98dae7b8ff0';
const tree = '6c9f146b3292a3795d5ae35c53c0f39f0fc0b490';
const archiveSha256 = '4913aabfec74fc990664a5d60760d8f3438ee067b682f833f5869cd2c9c3c372';
const root = path.resolve(import.meta.dirname, '../../../..');
const archivePath = path.join(
	root,
	`.versionless/cache/tier-f/angular-fuxa/${archiveSha256}/source.tar.gz`,
);
const stage = path.join(root, '.versionless/cache/angular-fuxa-production/.stage-t621');
const cacheRoot = path.join(root, '.versionless/cache/angular-fuxa-production');
const evidenceRoot = path.join(root, 'evidence/dependencies/angular-fuxa/t621');
const receiptPath = path.join(evidenceRoot, 'dependency-receipt.json');
const failurePath = path.join(evidenceRoot, 'consumed-failed.json');
const node16Root = path.join(root, '.versionless/cache/angular-phonecat/node16');

type Ledger = Readonly<{
	ordinal: number;
	method: 'GET';
	url: string;
	status: number;
	byteLength: number;
	sha256: string;
	result: 'accepted';
}>;

function canonical(value: unknown): string {
	return `${canonicalize(value)}\n`;
}
function exists(file: string): Promise<boolean> {
	return access(file).then(
		() => true,
		() => false,
	);
}

type CacheApi = Readonly<{
	put(
		cache: string,
		key: string,
		bytes: Buffer,
		options: Record<string, unknown>,
	): Promise<unknown>;
}>;

function cacheApi(): CacheApi {
	const require = createRequire(import.meta.url);
	return require(path.join(node16Root, 'lib/node_modules/npm/node_modules/cacache')) as CacheApi;
}

async function cacheTarball(request: DependencyRequest, bytes: Buffer): Promise<void> {
	await cacheApi().put(
		path.join(stage, 'npm-cache/_cacache'),
		`make-fetch-happen:request-cache:${request.url}`,
		bytes,
		{
			integrity: request.integrity,
			metadata: {
				time: Date.now(),
				url: request.url,
				reqHeaders: {},
				resHeaders: {
					'content-type': 'application/octet-stream',
					'content-length': String(bytes.byteLength),
				},
				options: { compress: true },
			},
		},
	);
}

export function assertFuxaTechnicalConsent(args: readonly string[]): void {
	if (
		args.length !== 2 ||
		args[0] !== '--consent' ||
		args[1] !== FUXA_TECHNICAL_CONSENT ||
		process.env.VERSIONLESS_NETWORK_MODE !== 'consented' ||
		process.env.VERSIONLESS_CONSENT_ID !== FUXA_TECHNICAL_CONSENT
	)
		throw new Error('FUXA production ingest requires exact purpose-bound consent');
}

export function assertFuxaTechnicalUrl(url: string): void {
	const parsed = parseURL(url);
	if (
		parsed.protocol !== 'https:' ||
		parsed.host !== 'registry.npmjs.org' ||
		parsed.auth ||
		parsed.search ||
		parsed.hash ||
		!parsed.pathname.endsWith('.tgz')
	)
		throw new Error('FUXA production URL is outside the exact registry scope');
}

export function fuxaTechnicalRequestInit(): RequestInit {
	return {
		method: 'GET',
		redirect: 'manual',
		credentials: 'omit',
		cache: 'no-store',
		headers: {
			accept: 'application/octet-stream',
			'accept-encoding': 'identity',
			'user-agent': 'versionless-t621',
		},
	};
}

async function closurePlan(): Promise<readonly DependencyRequest[]> {
	const bytes = await readFile(archivePath);
	if (sha256(bytes) !== archiveSha256) throw new Error('FUXA immutable archive differs');
	const archive = indexTarGzip(
		{ bytes, byteLength: bytes.byteLength, sha256: archiveSha256 },
		commit,
	);
	if (
		archive.manifestSha256 !==
		'f8580a18536ff8b34cf9b227f208cc6147e67323c844b234ced749962db04d30'
	)
		throw new Error('FUXA immutable manifest differs');
	const lock = findArchiveFile(archive, 'client/package-lock.json');
	if (lock.sha256 !== FUXA_LOCK_SHA256) throw new Error('FUXA immutable lock differs');
	const license = findArchiveFile(archive, 'LICENSE');
	if (!license.bytes.toString('utf8').includes('MIT License'))
		throw new Error('FUXA root MIT bytes differ');
	const plan = parseFuxaDependencyPlan(lock.bytes);
	if (plan.length !== FUXA_PRODUCTION_REQUESTS)
		throw new Error('FUXA baseline closure count differs');
	for (const item of plan) assertFuxaTechnicalUrl(item.url);
	return plan;
}

export async function smokeFuxaProductionIngest(): Promise<Readonly<Record<string, unknown>>> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true' ||
		process.env.VERSIONLESS_CONSENT_ID !== undefined
	)
		throw new Error('FUXA production smoke requires dual offline controls');
	const plan = await closurePlan();
	return {
		schemaVersion: 'versionless.angular-fuxa-t621-launcher-smoke.v1',
		result: 'ready',
		networkAttempts: 0,
		replaySha256: FUXA_REPLAY_SHA256,
		requests: plan.length,
		allowlistSha256: sha256(canonicalize(plan)),
		boundary: TECHNICAL_EVALUATION_BOUNDARY,
	};
}

async function bounded(response: Response): Promise<Buffer> {
	if (response.status !== 200 || response.headers.has('location'))
		throw new Error('response-boundary-failed');
	const encoding = response.headers.get('content-encoding');
	if (encoding !== null && encoding.trim().toLowerCase() !== 'identity')
		throw new Error('response-boundary-failed');
	const reader = response.body?.getReader();
	if (!reader) throw new Error('response-boundary-failed');
	const chunks: Buffer[] = [];
	let length = 0;
	while (true) {
		const chunk = await reader.read();
		if (chunk.done) break;
		length += chunk.value.byteLength;
		if (length > FUXA_PRODUCTION_RESPONSE_LIMIT) throw new Error('response-boundary-failed');
		chunks.push(Buffer.from(chunk.value));
	}
	return Buffer.concat(chunks);
}

async function recordedProxy<T>(
	plan: readonly DependencyRequest[],
	action: (origin: string) => Promise<T>,
	fetchImplementation: typeof fetch,
): Promise<T> {
	const byOrdinal = new Map(plan.map((item) => [String(item.sequence), item]));
	const server = createServer(async (request, response) => {
		try {
			if (request.method !== 'GET' || request.headers.authorization || request.headers.cookie)
				throw new Error('proxy-request-forbidden');
			const parsed = parseURL(request.url ?? '');
			const ordinal = parsed.pathname.slice(1);
			const item = byOrdinal.get(ordinal);
			if (!item || parsed.search || parsed.hash) throw new Error('proxy-request-forbidden');
			const upstream = await fetchImplementation(item.url, fuxaTechnicalRequestInit());
			const bytes = await bounded(upstream);
			response.writeHead(200, {
				'content-type': 'application/octet-stream',
				'content-length': String(bytes.byteLength),
				'content-encoding': 'identity',
			});
			response.end(bytes);
		} catch {
			response.writeHead(502, { 'content-type': 'text/plain' });
			response.end('recorded-proxy-rejected');
		}
	});
	await new Promise<void>((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', resolve);
	});
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('loopback proxy address failed');
	try {
		return await action(`http://127.0.0.1:${address.port}`);
	} finally {
		await new Promise<void>((resolve, reject) =>
			server.close((error) => (error ? reject(error) : resolve())),
		);
	}
}

export async function ingestAngularFuxaProduction(
	fetchImplementation: typeof fetch = fetch,
): Promise<Readonly<Record<string, unknown>>> {
	const plan = await closurePlan();
	if ((await exists(stage)) || (await exists(receiptPath)) || (await exists(failurePath)))
		throw new Error('FUXA T621 terminal or staging residue exists');
	await mkdir(path.join(stage, 'tarballs'), { recursive: true });
	await mkdir(path.join(stage, 'npm-cache'), { recursive: true });
	await mkdir(evidenceRoot, { recursive: true });
	let attempts = 0;
	let aggregateBytes = 0;
	const ledger: Ledger[] = [];
	try {
		const artifacts = await recordedProxy(
			plan,
			async (origin) => {
				const values: Array<Record<string, unknown>> = [];
				for (const item of plan) {
					if (attempts >= FUXA_PRODUCTION_REQUEST_LIMIT)
						throw new Error('request-boundary-failed');
					attempts += 1;
					const response = await fetchImplementation(`${origin}/${item.sequence}`, {
						method: 'GET',
						redirect: 'manual',
						credentials: 'omit',
					});
					const bytes = await bounded(response);
					aggregateBytes += bytes.byteLength;
					if (aggregateBytes > FUXA_PRODUCTION_AGGREGATE_LIMIT)
						throw new Error('aggregate-boundary-failed');
					verifyDependencySri(bytes, item.integrity);
					const inspection = inspectNpmPackageTarball(bytes, item.identities);
					const digest = sha256(bytes);
					await writeFile(path.join(stage, `tarballs/${digest}.tgz`), bytes, {
						flag: 'wx',
					}).catch(async (error: unknown) => {
						if (!(await exists(path.join(stage, `tarballs/${digest}.tgz`))))
							throw error;
					});
					await cacheTarball(item, bytes);
					ledger.push({
						ordinal: item.sequence,
						method: 'GET',
						url: item.url,
						status: 200,
						byteLength: bytes.byteLength,
						sha256: digest,
						result: 'accepted',
					});
					values.push({
						ordinal: item.sequence,
						url: item.url,
						integrity: item.integrity,
						sha256: digest,
						byteLength: bytes.byteLength,
						identities: item.identities,
						inspection,
					});
				}
				return values;
			},
			fetchImplementation,
		);
		const closure = {
			schemaVersion: 'versionless.angular-fuxa-t621-dependency-closure.v1',
			fixture: 'angular-fuxa',
			source: {
				commit,
				tree,
				archiveSha256,
				lockSha256: FUXA_LOCK_SHA256,
				rootLicense: 'MIT',
			},
			boundary: TECHNICAL_EVALUATION_BOUNDARY,
			consent: {
				id: FUXA_TECHNICAL_CONSENT,
				requests: attempts,
				aggregateBytes,
				limits: {
					requests: FUXA_PRODUCTION_REQUEST_LIMIT,
					responseBytes: FUXA_PRODUCTION_RESPONSE_LIMIT,
					aggregateBytes: FUXA_PRODUCTION_AGGREGATE_LIMIT,
				},
				recordedLoopbackProxy: true,
			},
			artifacts,
			ledger,
			nonclaims: [
				'Local technical evaluation only; unresolved dependency and asset licenses remain unknown and require legal review. No redistribution, compliance, certification, enterprise adoption, authenticity, or OS-wide isolation claim.',
			],
		};
		const digest = sha256(canonicalize(closure));
		await writeFile(path.join(stage, 'closure.json'), canonical(closure), { flag: 'wx' });
		const publication = path.join(cacheRoot, digest);
		await rename(stage, publication);
		const receipt = {
			schemaVersion: 'versionless.angular-fuxa-t621-dependency-receipt.v1',
			fixture: 'angular-fuxa',
			boundary: TECHNICAL_EVALUATION_BOUNDARY,
			closure: {
				path: path.relative(root, publication),
				digest,
				fileSha256: sha256(await readFile(path.join(publication, 'closure.json'))),
			},
			counted: false,
		};
		const handle = await open(receiptPath, 'wx');
		try {
			await handle.writeFile(canonical(receipt));
		} finally {
			await handle.close();
		}
		return receipt;
	} catch (error) {
		await rm(stage, { recursive: true, force: true });
		await writeFile(
			failurePath,
			canonical({
				schemaVersion: 'versionless.angular-fuxa-t621-failure.v1',
				result: 'failed',
				boundary: TECHNICAL_EVALUATION_BOUNDARY,
				attempts,
				aggregateBytes,
				code:
					error instanceof Error &&
					[
						'response-boundary-failed',
						'request-boundary-failed',
						'aggregate-boundary-failed',
						'lifecycle-or-native-boundary-failed',
					].includes(error.message)
						? error.message
						: 'artifact-validation-failed',
			}),
			{ flag: 'wx' },
		).catch(() => undefined);
		throw error;
	}
}

export async function verifyAngularFuxaProductionClosure(): Promise<
	Readonly<Record<string, unknown>>
> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true' ||
		process.env.VERSIONLESS_CONSENT_ID !== undefined
	)
		throw new Error('FUXA production closure verification requires dual offline controls');
	const receipt = JSON.parse(await readFile(receiptPath, 'utf8')) as {
		boundary?: unknown;
		closure?: { path?: unknown; digest?: unknown; fileSha256?: unknown };
	};
	if (
		canonicalize(receipt.boundary) !== canonicalize(TECHNICAL_EVALUATION_BOUNDARY) ||
		typeof receipt.closure?.path !== 'string' ||
		typeof receipt.closure.digest !== 'string' ||
		typeof receipt.closure.fileSha256 !== 'string'
	)
		throw new Error('FUXA production dependency receipt differs');
	const publication = path.join(root, receipt.closure.path);
	const closureBytes = await readFile(path.join(publication, 'closure.json'));
	if (sha256(closureBytes) !== receipt.closure.fileSha256)
		throw new Error('FUXA production closure file differs');
	const closure = JSON.parse(closureBytes.toString('utf8')) as {
		boundary?: unknown;
		artifacts?: Array<{
			ordinal: number;
			url: string;
			integrity: string;
			sha256: string;
			byteLength: number;
			identities: DependencyRequest['identities'];
			inspection: unknown;
		}>;
		ledger?: Ledger[];
	};
	if (
		sha256(canonicalize(closure)) !== receipt.closure.digest ||
		canonicalize(closure.boundary) !== canonicalize(TECHNICAL_EVALUATION_BOUNDARY) ||
		closure.artifacts?.length !== FUXA_PRODUCTION_REQUESTS ||
		closure.ledger?.length !== FUXA_PRODUCTION_REQUESTS
	)
		throw new Error('FUXA production closure cardinality, digest, or boundary differs');
	const plan = await closurePlan();
	for (const [index, item] of plan.entries()) {
		const artifact = closure.artifacts[index];
		const ledger = closure.ledger[index];
		if (
			!artifact ||
			!ledger ||
			artifact.ordinal !== item.sequence ||
			artifact.url !== item.url ||
			artifact.integrity !== item.integrity ||
			ledger.ordinal !== item.sequence ||
			ledger.url !== item.url ||
			ledger.result !== 'accepted'
		)
			throw new Error('FUXA production closure lock/ledger binding differs');
		const bytes = await readFile(path.join(publication, `tarballs/${artifact.sha256}.tgz`));
		if (bytes.byteLength !== artifact.byteLength || sha256(bytes) !== artifact.sha256)
			throw new Error('FUXA production retained tarball differs');
		verifyDependencySri(bytes, item.integrity);
		if (
			canonicalize(inspectNpmPackageTarball(bytes, item.identities)) !==
			canonicalize(artifact.inspection)
		)
			throw new Error('FUXA production retained tarball inspection differs');
	}
	if (await exists(stage)) throw new Error('FUXA production staging residue remains');
	return {
		schemaVersion: 'versionless.angular-fuxa-t621-offline-verification.v1',
		result: 'pass',
		networkAttempts: 0,
		closureDigest: receipt.closure.digest,
		artifacts: plan.length,
	};
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	if (args[0] === '--launcher-smoke')
		process.stdout.write(canonical(await smokeFuxaProductionIngest()));
	else if (args.length === 1 && args[0] === '--verify-only')
		process.stdout.write(canonical(await verifyAngularFuxaProductionClosure()));
	else {
		assertFuxaTechnicalConsent(args);
		process.stdout.write(canonical(await ingestAngularFuxaProduction()));
	}
}

if (process.argv[1]?.endsWith('angular-fuxa-production-ingest.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
