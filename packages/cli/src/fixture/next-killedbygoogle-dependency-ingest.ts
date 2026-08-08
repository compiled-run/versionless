import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	access,
	mkdir,
	readFile,
	readdir,
	readlink,
	rename,
	rm,
	writeFile,
} from 'node:fs/promises';
import * as path from 'pathe';
import { parseURL } from 'ufo';
import {
	canonicalize,
	inspectNpmPackageTarball,
	sha256,
	type NpmLockIdentity,
	type PackageMetadata,
} from '../../../core/src/index.ts';
import { findArchiveFile, indexTarGzip } from '../../../core/src/corpus/tier-f-provenance.ts';

export const KILLEDBYGOOGLE_CONSENT_ID = 'T236-next-killedbygoogle-yarn-v1-closure';
export const KILLEDBYGOOGLE_ARCHIVE_SHA256 =
	'c28878d0f65b56aa595763c852477fb0c1e3533e5c7f7ea9daa2be16f102368d';
export const KILLEDBYGOOGLE_LOCK_SHA256 =
	'a676ee932cef5e54d469dc6d1e040e50f42f9cc88beb16ae5c72c13e26ebc48a';
export const KILLEDBYGOOGLE_URL_LIST_SHA256 =
	'10e711890314a79d1edbfb2f5121e72b4037ae39c56747a72c29a9b7505a1c36';
export const KILLEDBYGOOGLE_REQUESTS = 710;
const responseLimit = 128 * 1024 * 1024;
const aggregateLimit = 1024 * 1024 * 1024;
const commit = '56809c31592e6ca1edce8af9bfe842fbcdf71f4d';
const root = path.resolve(import.meta.dirname, '../../../..');
const archive = path.join(
	root,
	`.versionless/cache/tier-f/next-killedbygoogle/${KILLEDBYGOOGLE_ARCHIVE_SHA256}/source.tar.gz`,
);
const cacheRoot = path.join(root, '.versionless/cache/next-killedbygoogle-dependencies');
const stage = path.join(cacheRoot, '.staging-t236');
const published = path.join(cacheRoot, KILLEDBYGOOGLE_LOCK_SHA256);
const terminal = path.join(cacheRoot, 't236-terminal.json');
const evidence = path.join(
	root,
	'evidence/dependencies/next-killedbygoogle/dependency-receipt.json',
);
const work = path.join(root, '.versionless/work/next-killedbygoogle/dependency-verification');
const yarnRoot = path.join(
	process.env.COREPACK_HOME ?? path.join(process.env.HOME ?? '', '.cache/node/corepack'),
	'v1/yarn/1.22.22',
);
const yarn = path.join(yarnRoot, 'bin/yarn.js');
const node16 = path.join(root, '.versionless/cache/angular-phonecat/node16/bin/node');

export type YarnRequest = Readonly<{
	sequence: number;
	resolved: string;
	url: string;
	fragmentSha1: string;
	integrity: string;
	identity: NpmLockIdentity;
}>;

type Artifact = Readonly<{
	sequence: number;
	resolved: string;
	url: string;
	integrity: string;
	upstreamIntegrity: 'sha512' | 'legacy-sha1';
	sha256: string;
	byteLength: number;
	metadata: PackageMetadata;
}>;

type DependencyReceipt = Readonly<{
	schemaVersion: 'versionless.next-killedbygoogle-dependency-closure.v1';
	fixture: 'next-killedbygoogle';
	closure: Readonly<{ path: string; digest: string; state: string }>;
	histories: readonly Readonly<Record<string, string | number>>[];
	installVerification: Readonly<Record<string, unknown>>;
	nonclaims: readonly string[];
}>;

type ClosureReceipt = Readonly<{
	schemaVersion: 'versionless.next-killedbygoogle-audited-closure.v1';
	fixture: 'next-killedbygoogle';
	state: 'audited-closure-published';
	source: Readonly<Record<string, string>>;
	consent: Readonly<Record<string, string | number | readonly string[]>>;
	histories: readonly Readonly<Record<string, string | number>>[];
	integritySummary: Readonly<Record<string, string | number>>;
	artifacts: readonly Artifact[];
	ledger: readonly Readonly<Record<string, unknown>>[];
	downstream: Readonly<Record<string, 'not-run'>>;
	nonclaims: readonly string[];
	integrity: Readonly<{ algorithm: 'sha256'; canonicalDigest: string }>;
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

function compare(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function exactHex(value: string, length: number): boolean {
	return (
		value.length === length &&
		[...value].every(
			(character) =>
				(character >= '0' && character <= '9') || (character >= 'a' && character <= 'f'),
		)
	);
}

function quoted(line: string, prefix: string): string {
	if (!line.startsWith(prefix) || !line.endsWith('"'))
		throw new Error(`KilledByGoogle yarn.lock ${prefix.trim()} field is malformed`);
	const result = line.slice(prefix.length, -1);
	if (!result) throw new Error(`KilledByGoogle yarn.lock ${prefix.trim()} field is empty`);
	return result;
}

function sriAlgorithm(integrity: string): 'sha1' | 'sha512' {
	const dash = integrity.indexOf('-');
	const algorithm = integrity.slice(0, dash);
	const encoded = integrity.slice(dash + 1);
	if (algorithm !== 'sha1' && algorithm !== 'sha512')
		throw new Error('KilledByGoogle lock integrity algorithm is unsupported');
	const digest = Buffer.from(encoded, 'base64');
	if (
		digest.byteLength !== (algorithm === 'sha1' ? 20 : 64) ||
		digest.toString('base64') !== encoded
	)
		throw new Error('KilledByGoogle lock integrity encoding is invalid');
	return algorithm;
}

function parseResolved(resolved: string): Readonly<{
	url: string;
	fragmentSha1: string;
}> {
	const parsed = parseURL(resolved);
	const fragmentSha1 = parsed.hash.slice(1);
	if (
		parsed.protocol !== 'https:' ||
		parsed.host !== 'registry.yarnpkg.com' ||
		Boolean(parsed.auth) ||
		Boolean(parsed.search) ||
		!parsed.pathname.endsWith('.tgz') ||
		!parsed.pathname.includes('/-/') ||
		!exactHex(fragmentSha1, 40)
	)
		throw new Error('KilledByGoogle resolved URL is outside the exact consent scope');
	return { url: resolved.slice(0, resolved.indexOf('#')), fragmentSha1 };
}

function identity(url: string, version: string): NpmLockIdentity {
	const parts = parseURL(url).pathname.split('/').filter(Boolean);
	const marker = parts.indexOf('-');
	if (marker < 1) throw new Error('KilledByGoogle package identity is not derivable');
	let name: string;
	try {
		name = decodeURIComponent(parts.slice(0, marker).join('/'));
	} catch {
		throw new Error('KilledByGoogle package identity encoding is invalid');
	}
	if (!name || (name.startsWith('@') && !name.includes('/')))
		throw new Error('KilledByGoogle package identity is malformed');
	return { name, version };
}

export function parseKilledByGoogleYarnLock(lock: Buffer): readonly YarnRequest[] {
	if (sha256(lock) !== KILLEDBYGOOGLE_LOCK_SHA256)
		throw new Error('KilledByGoogle yarn.lock SHA-256 mismatch');
	const rows: Array<Omit<YarnRequest, 'sequence'>> = [];
	let version: string | undefined;
	let resolved: string | undefined;
	let integrity: string | undefined;
	const flush = (): void => {
		if (version === undefined && resolved === undefined && integrity === undefined) return;
		if (!version || !resolved || !integrity)
			throw new Error('KilledByGoogle yarn.lock stanza lacks immutable fields');
		sriAlgorithm(integrity);
		const url = parseResolved(resolved);
		rows.push({ resolved, ...url, integrity, identity: identity(url.url, version) });
		version = undefined;
		resolved = undefined;
		integrity = undefined;
	};
	for (const line of lock.toString('utf8').split('\n')) {
		if (line && !line.startsWith(' ') && line.endsWith(':')) flush();
		else if (line.startsWith('  version "')) version = quoted(line, '  version "');
		else if (line.startsWith('  resolved "')) resolved = quoted(line, '  resolved "');
		else if (line.startsWith('  integrity ')) integrity = line.slice('  integrity '.length);
	}
	flush();
	const unique = new Map<string, Omit<YarnRequest, 'sequence'>>();
	for (const row of rows) {
		const prior = unique.get(row.resolved);
		if (prior && canonicalize(prior) !== canonicalize(row))
			throw new Error('KilledByGoogle lock repeats a URL with different immutable fields');
		unique.set(row.resolved, row);
	}
	const ordered = [...unique.values()].sort((left, right) => compare(left.url, right.url));
	if (ordered.length !== KILLEDBYGOOGLE_REQUESTS)
		throw new Error(`KilledByGoogle lock URL count differs: ${ordered.length}`);
	const algorithms = ordered.map((row) => sriAlgorithm(row.integrity));
	if (
		algorithms.filter((value) => value === 'sha512').length !== 657 ||
		algorithms.filter((value) => value === 'sha1').length !== 53
	)
		throw new Error('KilledByGoogle lock integrity split differs');
	if (sha256(ordered.map((row) => row.url).join('\n')) !== KILLEDBYGOOGLE_URL_LIST_SHA256)
		throw new Error('KilledByGoogle ordered URL-list SHA-256 differs');
	return ordered.map((row, index) => Object.freeze({ ...row, sequence: index + 1 }));
}

async function retained(): Promise<
	Readonly<{
		lock: Buffer;
		packageJson: Buffer;
		plan: readonly YarnRequest[];
	}>
> {
	const bytes = await readFile(archive);
	if (bytes.byteLength !== 370006 || sha256(bytes) !== KILLEDBYGOOGLE_ARCHIVE_SHA256)
		throw new Error('KilledByGoogle retained archive identity differs');
	const index = indexTarGzip(
		{ bytes, byteLength: bytes.byteLength, sha256: KILLEDBYGOOGLE_ARCHIVE_SHA256 },
		commit,
	);
	const hashes = [
		['LICENSE', '10547fb81e311e470cdcda5a273bac2a76f50ded6b33ce4362bcb05e1176d5e0'],
		['package.json', '5042dd8b31a7e1b37c2e0ed529cf3db50388660c9616c08e6445664ab59481c4'],
		['yarn.lock', KILLEDBYGOOGLE_LOCK_SHA256],
		['.babelrc', 'c686109195bab2cb07ea4abca4125023f82f1720efb2a488dbee5116f5438977'],
		['tsconfig.json', 'b647b89b66fd54ed7f4b83d2b2354575e1e6df4736cc8a8baf03043545f1adf7'],
		['next-env.d.ts', '9269d492817e359123ac64c8205e5d05dab63d71a3a7a229e68b5d9a0e8150bf'],
		['next.config.js', 'f4c7d09451907d1e288c7ddd5d41372ca2f1cc6bc1760f2c09a98ac0291d39bb'],
		['pages/index.tsx', '1b4971c9e4c935f331518ae40a2387412e7031ad2959e98c9e01133095cf4309'],
		['components/App.tsx', 'b3a48d2095754c46f64594c7d0cd49c2c65cc45a3baeaf992d6525617d27fe25'],
		[
			'components/Search/index.tsx',
			'697678ea2415166f15335d6a092b9513b7e57d4db5e12e224d33e735a3bcabf6',
		],
		['graveyard.json', '626bdcc020bf7c7952c9c92569de4431e05c22ab893f5253014140a7b1932df7'],
		[
			'playwright.config.ts',
			'2db284eb793a6e754686d8cd729e3b9e023c0b8937874030ab5c1fb7e2ac52bc',
		],
		[
			'.github/workflows/playwright.yml',
			'79ef3bfab380d28c818d67198275da9d54d7633721a1b507e04beaf81181f0f7',
		],
	] as const;
	for (const [file, digest] of hashes)
		if (sha256(findArchiveFile(index, file).bytes) !== digest)
			throw new Error(`KilledByGoogle retained ${file} SHA-256 differs`);
	const lock = findArchiveFile(index, 'yarn.lock').bytes;
	return {
		lock,
		packageJson: findArchiveFile(index, 'package.json').bytes,
		plan: parseKilledByGoogleYarnLock(lock),
	};
}

export async function verifyRetainedKilledByGoogleTwice(): Promise<void> {
	const first = await retained();
	const second = await retained();
	if (canonicalize(first.plan) !== canonicalize(second.plan))
		throw new Error('KilledByGoogle retained preflight replay differs');
}

function assertConsent(value: string | undefined): void {
	if (
		value !== KILLEDBYGOOGLE_CONSENT_ID ||
		process.env.VERSIONLESS_NETWORK_MODE !== 'consented' ||
		process.env.VERSIONLESS_CONSENT_ID !== KILLEDBYGOOGLE_CONSENT_ID
	)
		throw new Error('T236 requires exact acquisition-only consent in argument and environment');
}

function verifyBytes(bytes: Buffer, request: YarnRequest): void {
	if (createHash('sha1').update(bytes).digest('hex') !== request.fragmentSha1)
		throw new Error('KilledByGoogle repeated resolved SHA-1 bytes differ');
	const algorithm = sriAlgorithm(request.integrity);
	const expected = request.integrity.slice(request.integrity.indexOf('-') + 1);
	if (createHash(algorithm).update(bytes).digest('base64') !== expected)
		throw new Error('KilledByGoogle lock integrity bytes differ');
}

function validateRedirect(url: string): void {
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
		throw new Error('KilledByGoogle redirect is outside the exact permitted shape');
}

async function body(response: Response): Promise<Buffer> {
	const declared = response.headers.get('content-length');
	const encoding = response.headers.get('content-encoding');
	if (encoding && encoding !== 'identity')
		throw new Error('KilledByGoogle response was transport encoded');
	if (
		declared !== null &&
		(!Number.isSafeInteger(Number(declared)) || Number(declared) > responseLimit)
	)
		throw new Error('KilledByGoogle response exceeds the byte limit');
	const reader = response.body?.getReader();
	if (!reader) throw new Error('KilledByGoogle response body is absent');
	const chunks: Buffer[] = [];
	let size = 0;
	while (true) {
		const next = await reader.read();
		if (next.done) break;
		size += next.value.byteLength;
		if (size > responseLimit) {
			await reader.cancel();
			throw new Error('KilledByGoogle response exceeds the byte limit');
		}
		chunks.push(Buffer.from(next.value));
	}
	if (declared !== null && Number(declared) !== size)
		throw new Error('KilledByGoogle response byte count differs');
	return Buffer.concat(chunks);
}

async function acquire(request: YarnRequest, fetcher: typeof fetch) {
	const options: RequestInit = {
		method: 'GET',
		redirect: 'manual',
		credentials: 'omit',
		headers: { accept: 'application/octet-stream', 'accept-encoding': 'identity' },
	};
	let requests = 1;
	let response = await fetcher(request.url, options);
	let redirect: string | null = null;
	if ([301, 302, 307, 308].includes(response.status)) {
		redirect = response.headers.get('location');
		if (!redirect) throw new Error('KilledByGoogle redirect location is absent');
		validateRedirect(redirect);
		requests += 1;
		response = await fetcher(redirect, options);
	}
	if (response.status !== 200 || response.redirected || response.headers.has('location'))
		throw new Error(`KilledByGoogle terminal response ${response.status} is not accepted`);
	const bytes = await body(response);
	verifyBytes(bytes, request);
	return { bytes, requests, redirect };
}

function audit(metadata: PackageMetadata): void {
	if (metadata.license.state === 'empty' || metadata.license.state === 'ambiguous')
		throw new Error(`KilledByGoogle dependency ${metadata.name} lacks license evidence`);
	if (metadata.license.declarations.some((value) => value.toUpperCase() === 'UNLICENSED'))
		throw new Error(`KilledByGoogle dependency ${metadata.name} is non-redistributable`);
	if (metadata.lifecycleScripts.some((script) => script.state === 'ambiguous'))
		throw new Error(
			`KilledByGoogle dependency ${metadata.name} has ambiguous lifecycle metadata`,
		);
	if (metadata.nativeIndicators.gypfile === 'ambiguous')
		throw new Error(`KilledByGoogle dependency ${metadata.name} has ambiguous native metadata`);
	if (metadata.os.state === 'ambiguous' || metadata.cpu.state === 'ambiguous')
		throw new Error(
			`KilledByGoogle dependency ${metadata.name} has ambiguous platform metadata`,
		);
}

async function execute(command: string, args: readonly string[], cwd = root, env = process.env) {
	return await new Promise<string>((resolve, reject) => {
		const child = spawn(command, [...args], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
		const output: Buffer[] = [];
		const errors: Buffer[] = [];
		child.stdout.on('data', (value: Buffer) => output.push(value));
		child.stderr.on('data', (value: Buffer) => errors.push(value));
		child.once('error', reject);
		child.once('exit', (code) =>
			code === 0
				? resolve(Buffer.concat(output).toString('utf8'))
				: reject(
						new Error(
							`${path.basename(command)} exited ${code}: ${Buffer.concat(errors)}`,
						),
					),
		);
	});
}

async function treeDigest(directory: string): Promise<string> {
	const rows: string[] = [];
	const visit = async (current: string): Promise<void> => {
		for (const entry of (await readdir(current, { withFileTypes: true })).sort((a, b) =>
			compare(a.name, b.name),
		)) {
			const absolute = path.join(current, entry.name);
			const relative = path.relative(directory, absolute);
			if (entry.isDirectory()) await visit(absolute);
			else if (entry.isSymbolicLink()) {
				const target = await readlink(absolute);
				const resolved = path.resolve(path.dirname(absolute), target);
				if (resolved !== directory && !resolved.startsWith(`${directory}/`))
					throw new Error('KilledByGoogle install produced an escaping symlink');
				rows.push(`L ${relative} ${target}`);
			} else if (entry.isFile())
				rows.push(`F ${relative} ${sha256(await readFile(absolute))}`);
			else throw new Error('KilledByGoogle install produced a special entry');
		}
	};
	await visit(directory);
	return sha256(`${rows.join('\n')}\n`);
}

export function killedbygoogleMirrorName(request: YarnRequest): string {
	const result = parseURL(request.url).pathname.split('/').at(-1);
	if (!result?.endsWith('.tgz')) throw new Error('KilledByGoogle mirror filename is invalid');
	if (!request.identity.name.startsWith('@')) return result;
	const separator = request.identity.name.indexOf('/');
	if (separator < 2) throw new Error('KilledByGoogle scoped mirror identity is invalid');
	return `${request.identity.name.slice(0, separator)}-${result}`;
}

export function assertKilledByGoogleMirrorCollision(
	existingSha256: string,
	candidateSha256: string,
): void {
	if (existingSha256 !== candidateSha256)
		throw new Error('KilledByGoogle mirror filename collision differs');
}

async function installTwice(lock: Buffer, packageJson: Buffer, mirror: string): Promise<string[]> {
	await mkdir(work, { recursive: true });
	const digests: string[] = [];
	try {
		for (let attempt = 1; attempt <= 2; attempt += 1) {
			const directory = path.join(work, `install-${attempt}`);
			await mkdir(directory);
			await writeFile(path.join(directory, 'package.json'), packageJson);
			await writeFile(path.join(directory, 'yarn.lock'), lock);
			await writeFile(
				path.join(directory, '.yarnrc'),
				`yarn-offline-mirror "${mirror}"\nyarn-offline-mirror-pruning false\n`,
			);
			await execute(
				node16,
				[
					yarn,
					'install',
					'--frozen-lockfile',
					'--offline',
					'--ignore-scripts',
					'--non-interactive',
					'--cache-folder',
					path.join(directory, '.yarn-cache'),
				],
				directory,
				{
					PATH: `${path.dirname(node16)}:/usr/bin:/bin`,
					VERSIONLESS_NETWORK_MODE: 'offline',
					NPM_CONFIG_OFFLINE: 'true',
					YARN_ENABLE_NETWORK: '0',
					SKIP_YARN_COREPACK_CHECK: '1',
				},
			);
			if (
				sha256(await readFile(path.join(directory, 'yarn.lock'))) !==
				KILLEDBYGOOGLE_LOCK_SHA256
			)
				throw new Error('KilledByGoogle install changed yarn.lock');
			const swc = (await readdir(path.join(directory, 'node_modules/@next')))
				.filter((name) => name.startsWith('swc-'))
				.sort(compare);
			if (canonicalize(swc) !== canonicalize(['swc-darwin-arm64']))
				throw new Error('KilledByGoogle installed SWC platform set differs');
			digests.push(await treeDigest(path.join(directory, 'node_modules')));
		}
		if (digests[0] !== digests[1])
			throw new Error('KilledByGoogle independent offline install closures differ');
		return digests;
	} finally {
		await rm(work, { recursive: true, force: true });
	}
}

function histories(): readonly Readonly<Record<string, string | number>>[] {
	return [];
}

function closureDigest(receipt: ClosureReceipt): string {
	const { integrity: _integrity, ...body } = receipt;
	return sha256(canonicalize(body));
}

async function verifyClosureAt(directory: string): Promise<ClosureReceipt> {
	const receipt = JSON.parse(
		await readFile(path.join(directory, 'closure.json'), 'utf8'),
	) as ClosureReceipt;
	const ledger = JSON.parse(
		await readFile(path.join(directory, 'ledger.json'), 'utf8'),
	) as unknown;
	const { plan } = await retained();
	if (
		receipt.schemaVersion !== 'versionless.next-killedbygoogle-audited-closure.v1' ||
		receipt.state !== 'audited-closure-published' ||
		receipt.artifacts.length !== KILLEDBYGOOGLE_REQUESTS ||
		receipt.ledger.length !== KILLEDBYGOOGLE_REQUESTS ||
		canonicalize(ledger) !== canonicalize(receipt.ledger) ||
		closureDigest(receipt) !== receipt.integrity.canonicalDigest ||
		canonicalize(receipt.histories) !== canonicalize(histories()) ||
		Object.values(receipt.downstream).some((state) => state !== 'not-run')
	)
		throw new Error('KilledByGoogle audited closure shape or digest differs');
	for (const request of plan) {
		const artifact = receipt.artifacts[request.sequence - 1];
		if (!artifact || artifact.resolved !== request.resolved)
			throw new Error('KilledByGoogle audited closure order differs');
		const content = await readFile(path.join(directory, `tarballs/${artifact.sha256}.tgz`));
		const mirror = await readFile(
			path.join(directory, 'mirror', killedbygoogleMirrorName(request)),
		);
		if (
			content.byteLength !== artifact.byteLength ||
			sha256(content) !== artifact.sha256 ||
			sha256(mirror) !== artifact.sha256
		)
			throw new Error('KilledByGoogle audited closure content differs');
		verifyBytes(content, request);
		const metadata = inspectNpmPackageTarball(content, [request.identity]);
		audit(metadata);
		if (canonicalize(metadata) !== canonicalize(artifact.metadata))
			throw new Error('KilledByGoogle audited closure metadata differs');
	}
	return receipt;
}

export async function acquireAndPublishKilledByGoogleClosure(
	consentId: string | undefined,
	fetcher: typeof fetch = fetch,
): Promise<ClosureReceipt> {
	for (const target of [stage, published, terminal, evidence, `${evidence}.tmp`, work])
		if (await exists(target))
			throw new Error(`T236 preflight residue exists: ${path.relative(root, target)}`);
	await verifyRetainedKilledByGoogleTwice();
	const { plan } = await retained();
	if (new Set(plan.map(killedbygoogleMirrorName)).size !== KILLEDBYGOOGLE_REQUESTS)
		throw new Error('KilledByGoogle corrected mirror names are not unique');
	assertConsent(consentId);
	await mkdir(cacheRoot, { recursive: true });
	await writeFile(terminal, canonical({ task: 'T236', consentId, state: 'terminal-consumed' }), {
		flag: 'wx',
	});
	const artifacts: Artifact[] = [];
	const ledger: Array<Record<string, unknown>> = [];
	let aggregateBytes = 0;
	let transportRequests = 0;
	let renamed = false;
	try {
		await mkdir(path.join(stage, 'tarballs'), { recursive: true });
		await mkdir(path.join(stage, 'mirror'), { recursive: true });
		for (const request of plan) {
			const accepted = await acquire(request, fetcher);
			transportRequests += accepted.requests;
			aggregateBytes += accepted.bytes.byteLength;
			if (transportRequests > 1420 || aggregateBytes > aggregateLimit)
				throw new Error('KilledByGoogle acquisition ceiling exceeded');
			const metadata = inspectNpmPackageTarball(accepted.bytes, [request.identity]);
			audit(metadata);
			const digest = sha256(accepted.bytes);
			const artifact: Artifact = {
				sequence: request.sequence,
				resolved: request.resolved,
				url: request.url,
				integrity: request.integrity,
				upstreamIntegrity: request.integrity.startsWith('sha512-')
					? 'sha512'
					: 'legacy-sha1',
				sha256: digest,
				byteLength: accepted.bytes.byteLength,
				metadata,
			};
			const contentFile = path.join(stage, `tarballs/${digest}.tgz`);
			if (!(await exists(contentFile)))
				await writeFile(contentFile, accepted.bytes, { flag: 'wx' });
			else assertKilledByGoogleMirrorCollision(sha256(await readFile(contentFile)), digest);
			const mirrorFile = path.join(stage, 'mirror', killedbygoogleMirrorName(request));
			if (!(await exists(mirrorFile)))
				await writeFile(mirrorFile, accepted.bytes, { flag: 'wx' });
			else assertKilledByGoogleMirrorCollision(sha256(await readFile(mirrorFile)), digest);
			artifacts.push(artifact);
			ledger.push({
				sequence: request.sequence,
				method: 'GET',
				url: request.url,
				redirectUrl: accepted.redirect,
				transportRequests: accepted.requests,
				status: 200,
				bytes: accepted.bytes.byteLength,
				sha256: digest,
				result: 'accepted',
			});
			if (request.sequence % 100 === 0)
				process.stderr.write(
					`T236 acquired ${request.sequence}/${KILLEDBYGOOGLE_REQUESTS}\n`,
				);
		}
		const body = {
			schemaVersion: 'versionless.next-killedbygoogle-audited-closure.v1' as const,
			fixture: 'next-killedbygoogle' as const,
			state: 'audited-closure-published' as const,
			source: {
				repository: 'codyogden/killedbygoogle',
				commit,
				tree: 'b8ac7b4fc3a1e12240f1848f6e8d98c1c7d80763',
				archiveSha256: KILLEDBYGOOGLE_ARCHIVE_SHA256,
				lockSha256: KILLEDBYGOOGLE_LOCK_SHA256,
				urlListSha256: KILLEDBYGOOGLE_URL_LIST_SHA256,
			},
			consent: {
				id: KILLEDBYGOOGLE_CONSENT_ID,
				status: 'closed',
				methods: ['GET'],
				artifacts: KILLEDBYGOOGLE_REQUESTS,
				transportRequests,
				acceptedBytes: aggregateBytes,
			},
			histories: histories(),
			integritySummary: { sha512: 657, legacySha1: 53, sha1Claim: 'weak-upstream-only' },
			artifacts,
			ledger,
			downstream: {
				offlineInstall: 'not-run' as const,
				legacyBuild: 'not-run' as const,
				targetBuild: 'not-run' as const,
				browserParity: 'not-run' as const,
				mutation: 'not-run' as const,
				aggregate: 'not-run' as const,
				corpus: 'not-run' as const,
				trust: 'not-run' as const,
			},
			nonclaims: [
				'Publication proves only immutable audited dependency availability.',
				'SHA-1 is weak upstream evidence only.',
				'No installability, buildability, runtime behavior, browser parity, support, compliance, certification, authenticity, signer identity, or locality claim.',
			],
		};
		const receipt: ClosureReceipt = {
			...body,
			integrity: { algorithm: 'sha256', canonicalDigest: sha256(canonicalize(body)) },
		};
		await writeFile(path.join(stage, 'ledger.json'), canonical(ledger));
		await writeFile(path.join(stage, 'closure.json'), canonical(receipt));
		await verifyClosureAt(stage);
		await verifyClosureAt(stage);
		await rename(stage, published);
		renamed = true;
		return await verifyClosureAt(published);
	} catch (error) {
		await mkdir(path.join(cacheRoot, 'failures'), { recursive: true });
		await writeFile(
			path.join(cacheRoot, `failures/t236-${Date.now()}.json`),
			canonical({
				task: 'T236',
				consentId,
				result: 'failed',
				transportRequests,
				aggregateBytes,
				ledger,
				reason: error instanceof Error ? error.message : String(error),
			}),
			{ flag: 'wx' },
		).catch(() => undefined);
		if (!renamed) await rm(stage, { recursive: true, force: true });
		throw error;
	}
}

export async function verifyPublishedKilledByGoogleClosure(): Promise<ClosureReceipt> {
	if (process.env.VERSIONLESS_NETWORK_MODE !== 'offline')
		throw new Error('T236 closure verification requires offline mode');
	return await verifyClosureAt(published);
}

export async function installFromPublishedKilledByGoogleClosure(): Promise<DependencyReceipt> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true' ||
		process.env.VERSIONLESS_CONSENT_ID
	)
		throw new Error('T236 installation requires consent-free offline mode');
	if (await exists(evidence)) throw new Error('T236 dependency evidence already exists');
	const first = await verifyClosureAt(published);
	const second = await verifyClosureAt(published);
	if (first.integrity.canonicalDigest !== second.integrity.canonicalDigest)
		throw new Error('T236 closure replay digest differs');
	const { lock, packageJson } = await retained();
	try {
		if ((await execute(node16, ['--version'])).trim() !== 'v16.20.2')
			throw new Error('KilledByGoogle Node 16 identity differs');
		if ((await execute(node16, [yarn, '--version'])).trim() !== '1.22.22')
			throw new Error('KilledByGoogle Yarn identity differs');
		const digests = await installTwice(lock, packageJson, path.join(published, 'mirror'));
		const receipt: DependencyReceipt = {
			schemaVersion: 'versionless.next-killedbygoogle-dependency-closure.v1',
			fixture: 'next-killedbygoogle',
			closure: {
				path: `.versionless/cache/next-killedbygoogle-dependencies/${KILLEDBYGOOGLE_LOCK_SHA256}`,
				digest: first.integrity.canonicalDigest,
				state: first.state,
			},
			histories: histories(),
			installVerification: {
				runs: 2,
				networkAttempts: 0,
				ignoreScripts: true,
				ignoreOptional: false,
				digests,
				lockUnchanged: true,
				swcDarwinArm64: 'present',
				residue: 'none',
			},
			nonclaims: [
				'Offline installation verification is not a build, browser, support, compliance, certification, authenticity, signer, or OS-wide-locality claim.',
			],
		};
		await mkdir(path.dirname(evidence), { recursive: true });
		await writeFile(`${evidence}.tmp`, canonical(receipt), { flag: 'wx' });
		await rename(`${evidence}.tmp`, evidence);
		return receipt;
	} catch (error) {
		await mkdir(path.join(cacheRoot, 'offline-failures'), { recursive: true });
		await writeFile(
			path.join(cacheRoot, `offline-failures/t236-${Date.now()}.json`),
			canonical({
				task: 'T236',
				phase: 'offline-install',
				reason: error instanceof Error ? error.message : String(error),
			}),
			{ flag: 'wx' },
		).catch(() => undefined);
		await rm(`${evidence}.tmp`, { force: true });
		await rm(evidence, { force: true });
		throw error;
	}
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	if (args[args.indexOf('--fixture') + 1] !== 'next-killedbygoogle')
		throw new Error('T236 requires literal --fixture next-killedbygoogle');
	if (args.includes('--verify-closure')) {
		const closure = await verifyPublishedKilledByGoogleClosure();
		process.stdout.write(
			canonical({ result: 'closure-verified', networkAttempts: 0, closure }),
		);
		return;
	}
	if (args.includes('--install-from-published-closure')) {
		const receipt = await installFromPublishedKilledByGoogleClosure();
		process.stdout.write(
			canonical({ result: 'install-verified', networkAttempts: 0, receipt }),
		);
		return;
	}
	if (!args.includes('--acquire-and-publish-closure'))
		throw new Error('T236 requires an explicit phase flag');
	const index = args.indexOf('--consent-id');
	const closure = await acquireAndPublishKilledByGoogleClosure(
		index < 0 ? undefined : args[index + 1],
	);
	process.stdout.write(
		canonical({ result: 'closure-published', requests: KILLEDBYGOOGLE_REQUESTS, closure }),
	);
}

if (process.argv[1]?.endsWith('next-killedbygoogle-dependency-ingest.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
