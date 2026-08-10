import { access, mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { parseURL } from 'ufo';
import {
	auditNpmContentCaches,
	canonicalize,
	findArchiveFile,
	indexTarGzip,
	inspectNpmPackageTarball,
	npmLockRowSetDigest,
	parseNpmLockPlan,
	sha256,
	verifyNpmSri,
	type NpmLockIdentity,
} from '../../../core/src/index.ts';

export const REACT_DASHBOARD_CONSENT =
	'T614-react-dashboard-vite4-to-vite8-production-closure' as const;
export const REACT_DASHBOARD_ROW_SET_SHA256 =
	'08a95c31516ea6ac280d8c58626fb518bdb2c8fef952be575ed7999981ae6bf9' as const;
const archiveSha256 = '84a3a8a5e3e39803a25cc7d35e862f99f22aa3fd4e0c39e413a7a2d0e68901e0';
const lockSha256 = '75c9591e3d4aa2d3f383b8ca41fd5599c018862b6ebc175759fb6b9d381afccc';
const commit = '4b8be9f7e0080d680598c74d7e6cfbe080566059';
const sourceDirectory = import.meta.dirname;
const root =
	path.basename(sourceDirectory) === 'dist'
		? path.resolve(sourceDirectory, '../../..')
		: path.resolve(sourceDirectory, '../../../..');
const evidenceDirectory = path.join(root, 'evidence/dependencies/react-dashboard/t614');
const cacheBase = path.join(root, '.versionless/cache/react-dashboard/t614');
const stage = path.join(root, '.versionless/stage/react-dashboard/t614/acquisition');
const archivePath = path.join(
	root,
	`.versionless/cache/tier-f/react-dashboard/${archiveSha256}/source.tar.gz`,
);
const cacheRoots = [
	{
		label: 'react-boilerplate-v4-node24',
		path: path.join(root, '.versionless/cache/react-boilerplate-v4-node24/npm-cache'),
	},
	{
		label: 'angular-phonecat',
		path: path.join(root, '.versionless/cache/angular-phonecat/npm-cache'),
	},
	{
		label: 'react-boilerplate-v4',
		path: path.join(root, '.versionless/cache/react-boilerplate-v4/npm-cache'),
	},
] as const;
const responseLimit = 32 * 1024 * 1024;
const aggregateLimit = 1024 * 1024 * 1024;
const requestLimit = 1_111;

export type DashboardLauncherMode = 'launcher-smoke' | 'verify' | 'acquire';
export type DashboardAllowlistItem = Readonly<{
	ordinal: number;
	kind: 'lock-missing' | 'target-delta';
	url: string;
	integrity: string;
	identities: readonly NpmLockIdentity[];
}>;

const targetDelta = [
	{
		url: 'https://registry.npmjs.org/react/-/react-18.3.1.tgz',
		integrity:
			'sha512-wS+hAgJShR0KhEvPJArfuPVN1+Hz1t0Y6n5jLrGQbkb4urgPE/0Rve+1kMB1v/oWgHgm4WIcV+i7F2pTVj+2iQ==',
		identities: [{ name: 'react', version: '18.3.1' }],
	},
	{
		url: 'https://registry.npmjs.org/react-dom/-/react-dom-18.3.1.tgz',
		integrity:
			'sha512-5m4nQKp+rZRb09LNH59GM4BxTh9251/ylbKIbpe7TpGxfJ+9kv6BLkLBXIjjspbgbnIBNqlI23tRnTWT0snUIw==',
		identities: [{ name: 'react-dom', version: '18.3.1' }],
	},
	{
		url: 'https://registry.npmjs.org/scheduler/-/scheduler-0.23.2.tgz',
		integrity:
			'sha512-UOShsPwz7NrMUqhR6t0hWjFduvOzbtv7toDH1/hIrfRNIDBnnBWd0CwJTGvTpngVlmwGCdP9/Zl/tVrDqcuYzQ==',
		identities: [{ name: 'scheduler', version: '0.23.2' }],
	},
] as const;

function canonical(value: unknown): string {
	return `${canonicalize(value)}\n`;
}
function exists(file: string): Promise<boolean> {
	return access(file).then(
		() => true,
		() => false,
	);
}

export function assertReactDashboardRegistryUrl(url: string): void {
	const parsed = parseURL(url);
	if (
		parsed.protocol !== 'https:' ||
		parsed.host !== 'registry.npmjs.org' ||
		Boolean(parsed.auth) ||
		Boolean(parsed.search) ||
		Boolean(parsed.hash) ||
		!parsed.pathname.endsWith('.tgz') ||
		!parsed.pathname.includes('/-/')
	)
		throw new Error('Dashboard URL is outside the exact registry tarball scope');
}

function exactArgs(args: readonly string[], flag: string): boolean {
	return (
		args.length === 3 &&
		args[0] === flag &&
		args[1] === '--consent-id' &&
		args[2] === REACT_DASHBOARD_CONSENT
	);
}

export function parseReactDashboardLauncher(args: readonly string[]): DashboardLauncherMode {
	if (exactArgs(args, '--acquire')) {
		if (
			process.env.VERSIONLESS_NETWORK_MODE !== 'consented' ||
			process.env.VERSIONLESS_CONSENT_ID !== REACT_DASHBOARD_CONSENT
		)
			throw new Error('Dashboard acquisition requires exact one-shot consent');
		return 'acquire';
	}
	const mode = exactArgs(args, '--launcher-smoke')
		? 'launcher-smoke'
		: exactArgs(args, '--verify')
			? 'verify'
			: undefined;
	if (
		!mode ||
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true' ||
		process.env.VERSIONLESS_CONSENT_ID !== undefined
	)
		throw new Error('Dashboard offline launcher requires exact dual offline controls');
	return mode;
}

export function dashboardRequestInit(): RequestInit {
	return {
		method: 'GET',
		redirect: 'manual',
		credentials: 'omit',
		cache: 'no-store',
		headers: {
			accept: 'application/octet-stream',
			'accept-encoding': 'identity',
			'user-agent': 'versionless-t614',
		},
	};
}

export function classifyDashboardResponse(response: Pick<Response, 'status' | 'headers'>): void {
	if (response.status !== 200) throw new Error('response-status-not-200');
	if (response.headers.has('location')) throw new Error('response-redirect-forbidden');
	const encoding = response.headers.get('content-encoding');
	if (encoding !== null && encoding.trim().toLowerCase() !== 'identity')
		throw new Error('response-encoding-not-identity');
}

export function projectDashboardFailure(
	error: unknown,
	attempts: number,
	acceptedBytes: number,
): Readonly<Record<string, unknown>> {
	const message = error instanceof Error ? error.message : 'unknown-error';
	const allowed = [
		'response-status-not-200',
		'response-redirect-forbidden',
		'response-encoding-not-identity',
		'response-cap-exceeded',
		'aggregate-cap-exceeded',
		'network-error',
		'integrity-failed',
		'identity-failed',
		'publication-failed',
	];
	return {
		schemaVersion: 'versionless.react-dashboard-t614-failure.v1',
		result: 'failed',
		code: allowed.includes(message) ? message : 'publication-failed',
		attempts,
		acceptedBytes,
	};
}

async function sourcePlan() {
	const bytes = await readFile(archivePath);
	if (sha256(bytes) !== archiveSha256)
		throw new Error('Dashboard immutable archive SHA-256 differs');
	const archive = indexTarGzip(
		{ bytes, byteLength: bytes.byteLength, sha256: archiveSha256 },
		commit,
	);
	const lock = findArchiveFile(archive, 'app/package-lock.json').bytes;
	if (sha256(lock) !== lockSha256) throw new Error('Dashboard immutable lock SHA-256 differs');
	const plan = parseNpmLockPlan(lock);
	if (
		plan.lockfileVersion !== 3 ||
		plan.pairs.length !== 1_108 ||
		npmLockRowSetDigest(plan.pairs) !== REACT_DASHBOARD_ROW_SET_SHA256 ||
		plan.pairs.some((pair) => !pair.integrity.startsWith('sha512-'))
	)
		throw new Error('Dashboard exact SHA-512 lock closure differs');
	return plan;
}

export async function buildReactDashboardAllowlist(): Promise<
	Readonly<{ items: readonly DashboardAllowlistItem[]; cached: number; digest: string }>
> {
	const plan = await sourcePlan();
	const audit = await auditNpmContentCaches(plan.pairs, cacheRoots);
	if (audit.cached.length !== 146 || audit.missing.length !== 962)
		throw new Error('Dashboard content-hash cache split differs');
	const byUrl = new Map(plan.pairs.map((pair) => [pair.url, pair]));
	const missing = audit.missing.map((item) => {
		const pair = byUrl.get(item.url);
		if (!pair || item.integrities.length !== 1 || item.integrities[0] !== pair.integrity)
			throw new Error('Dashboard missing allowlist binding differs');
		return {
			kind: 'lock-missing' as const,
			url: pair.url,
			integrity: pair.integrity,
			identities: pair.identities,
		};
	});
	const delta = targetDelta.map((item) => ({ kind: 'target-delta' as const, ...item }));
	const items = [...missing, ...delta].map((item, index) => ({ ordinal: index + 1, ...item }));
	if (items.length !== 965) throw new Error('Dashboard acquisition request count differs');
	for (const item of items) assertReactDashboardRegistryUrl(item.url);
	return { items, cached: audit.cached.length, digest: sha256(canonicalize(items)) };
}

async function collect(response: Response, remaining: number): Promise<Buffer> {
	classifyDashboardResponse(response);
	if (!response.body) throw new Error('network-error');
	const reader = response.body.getReader();
	const chunks: Buffer[] = [];
	let bytes = 0;
	while (true) {
		const part = await reader.read();
		if (part.done) break;
		bytes += part.value.byteLength;
		if (bytes > responseLimit) throw new Error('response-cap-exceeded');
		if (bytes > remaining) throw new Error('aggregate-cap-exceeded');
		chunks.push(Buffer.from(part.value));
	}
	return Buffer.concat(chunks);
}

export async function acquireReactDashboard(
	fetchImplementation: typeof fetch = fetch,
): Promise<Readonly<Record<string, unknown>>> {
	const allowlist = await buildReactDashboardAllowlist();
	if (allowlist.items.length > requestLimit) throw new Error('Dashboard request limit exceeded');
	if (
		(await exists(stage)) ||
		(await exists(path.join(evidenceDirectory, 'dependency-receipt.json')))
	)
		throw new Error('Dashboard acquisition target already exists');
	await mkdir(evidenceDirectory, { recursive: true });
	await writeFile(
		path.join(evidenceDirectory, 'allowlist.json'),
		canonical({
			schemaVersion: 'versionless.react-dashboard-t614-allowlist.v1',
			digest: allowlist.digest,
			items: allowlist.items,
		}),
		{ flag: 'wx' },
	);
	let attempts = 0;
	let acceptedBytes = 0;
	try {
		await mkdir(path.join(stage, 'tarballs'), { recursive: true });
		const artifacts: Array<Record<string, unknown>> = [];
		for (const item of allowlist.items) {
			attempts += 1;
			let response: Response;
			try {
				response = await fetchImplementation(item.url, dashboardRequestInit());
			} catch {
				throw new Error('network-error');
			}
			const bytes = await collect(response, aggregateLimit - acceptedBytes);
			acceptedBytes += bytes.byteLength;
			try {
				verifyNpmSri(bytes, item.integrity);
			} catch {
				throw new Error('integrity-failed');
			}
			let inspection;
			try {
				inspection = inspectNpmPackageTarball(bytes, item.identities);
			} catch {
				throw new Error('identity-failed');
			}
			const digest = sha256(bytes);
			await writeFile(path.join(stage, `tarballs/${digest}.tgz`), bytes, {
				flag: 'wx',
			}).catch(async (error: unknown) => {
				if (!(await exists(path.join(stage, `tarballs/${digest}.tgz`)))) throw error;
			});
			artifacts.push({ ...item, sha256: digest, byteLength: bytes.byteLength, inspection });
		}
		const closure = {
			schemaVersion: 'versionless.react-dashboard-t614-closure.v1',
			fixture: 'react-dashboard',
			source: {
				commit,
				archiveSha256,
				lockSha256,
				rowSetSha256: REACT_DASHBOARD_ROW_SET_SHA256,
			},
			consent: {
				id: REACT_DASHBOARD_CONSENT,
				requests: attempts,
				acceptedBytes,
				limits: {
					requests: requestLimit,
					responseBytes: responseLimit,
					aggregateBytes: aggregateLimit,
				},
			},
			cache: { inheritedContentHashVerified: allowlist.cached, acquired: artifacts.length },
			artifacts,
			nonclaims: [
				'A reproducible immutable dependency closure; no certification, signer-authenticity, OS-wide isolation, or generic migration claim.',
			],
		};
		const digest = sha256(canonicalize(closure));
		await writeFile(path.join(stage, 'closure.json'), canonical(closure), { flag: 'wx' });
		await mkdir(cacheBase, { recursive: true });
		const publication = path.join(cacheBase, digest);
		await rename(stage, publication);
		const receipt = {
			schemaVersion: 'versionless.react-dashboard-t614-dependency-receipt.v1',
			fixture: 'react-dashboard',
			consentId: REACT_DASHBOARD_CONSENT,
			closure: {
				path: path.relative(root, publication),
				digest,
				fileSha256: sha256(await readFile(path.join(publication, 'closure.json'))),
			},
			counted: false,
		};
		const handle = await open(path.join(evidenceDirectory, 'dependency-receipt.json'), 'wx');
		try {
			await handle.writeFile(canonical(receipt));
		} finally {
			await handle.close();
		}
		return receipt;
	} catch (error) {
		await rm(stage, { recursive: true, force: true });
		await writeFile(
			path.join(evidenceDirectory, 'consumed-failed.json'),
			canonical(projectDashboardFailure(error, attempts, acceptedBytes)),
			{ flag: 'wx' },
		).catch(() => undefined);
		throw error;
	}
}

export async function smokeReactDashboardLauncher(): Promise<Readonly<Record<string, unknown>>> {
	const allowlist = await buildReactDashboardAllowlist();
	return {
		schemaVersion: 'versionless.react-dashboard-t614-launcher-smoke.v1',
		result: 'ready',
		networkAttempts: 0,
		pairs: 1_108,
		cached: allowlist.cached,
		missing: 962,
		targetDelta: 3,
		requests: allowlist.items.length,
		allowlistSha256: allowlist.digest,
	};
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const mode = parseReactDashboardLauncher(args);
	process.stdout.write(
		canonical(
			mode === 'acquire'
				? await acquireReactDashboard()
				: await smokeReactDashboardLauncher(),
		),
	);
}

if (process.argv[1]?.endsWith('react-dashboard-production-ingest.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
