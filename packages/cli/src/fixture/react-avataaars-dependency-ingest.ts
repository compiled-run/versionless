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

export const AVATAAARS_CONSENT_ID = 'T230-react-avataaars-audited-closure-publication';
export const AVATAAARS_CONSUMED_CONSENT_IDS = [
	'T224-react-avataaars-yarn-closure',
	'T228-react-avataaars-yarn-closure-scoped-mirror',
] as const;
export const AVATAAARS_ARCHIVE_SHA256 =
	'4863a1304b659f1105f69d8ae0c715428c41d2d64b43edfd701148ddfca900da';
export const AVATAAARS_LOCK_SHA256 =
	'd53edb62306b30bc2888ebb06c028f4b1452df9e39819c4d98f00857655f5156';
export const AVATAAARS_URL_LIST_SHA256 =
	'3ef9c859b1c1d4ecbd93fe2015dba84929e217552006cfdd87e85d8a11f9ef0a';
export const AVATAAARS_REQUESTS = 1222;
const responseLimit = 128 * 1024 * 1024;
const aggregateLimit = 2 * 1024 * 1024 * 1024;
const commit = 'c191c6c2d27f41245e803912d43c7213436a34d3';
const root = path.resolve(import.meta.dirname, '../../../..');
const archive = path.join(
	root,
	`.versionless/cache/tier-f/react-avataaars/${AVATAAARS_ARCHIVE_SHA256}/source.tar.gz`,
);
const cacheRoot = path.join(root, '.versionless/cache/react-avataaars-dependencies');
const stage = path.join(cacheRoot, '.staging-t230');
const published = path.join(cacheRoot, AVATAAARS_LOCK_SHA256);
const terminal = path.join(cacheRoot, 't230-terminal.json');
const t226Terminal = path.join(cacheRoot, 't226-terminal.json');
const t226Failure = path.join(cacheRoot, 'failures/t226-1786113259539.json');
const t228Terminal = path.join(cacheRoot, 't228-terminal.json');
const t228Failure = path.join(cacheRoot, 'failures/t228-1786114135665.json');
const evidence = path.join(root, 'evidence/dependencies/react-avataaars/dependency-receipt.json');
const work = path.join(root, '.versionless/work/react-avataaars/dependency-verification');
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
	schemaVersion: 'versionless.react-avataaars-dependency-closure.v1';
	fixture: 'react-avataaars';
	closure: Readonly<{ path: string; digest: string; state: string }>;
	histories: readonly Readonly<Record<string, string | number>>[];
	installVerification: Readonly<Record<string, unknown>>;
	nonclaims: readonly string[];
}>;

type ClosureReceipt = Readonly<{
	schemaVersion: 'versionless.react-avataaars-audited-closure.v1';
	fixture: 'react-avataaars';
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
		throw new Error(`Avataaars yarn.lock ${prefix.trim()} field is malformed`);
	const result = line.slice(prefix.length, -1);
	if (!result) throw new Error(`Avataaars yarn.lock ${prefix.trim()} field is empty`);
	return result;
}

function sriAlgorithm(integrity: string): 'sha1' | 'sha512' {
	const dash = integrity.indexOf('-');
	const algorithm = integrity.slice(0, dash);
	const encoded = integrity.slice(dash + 1);
	if (algorithm !== 'sha1' && algorithm !== 'sha512')
		throw new Error('Avataaars lock integrity algorithm is unsupported');
	const digest = Buffer.from(encoded, 'base64');
	if (
		digest.byteLength !== (algorithm === 'sha1' ? 20 : 64) ||
		digest.toString('base64') !== encoded
	)
		throw new Error('Avataaars lock integrity encoding is invalid');
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
		throw new Error('Avataaars resolved URL is outside the exact consent scope');
	return { url: resolved.slice(0, resolved.indexOf('#')), fragmentSha1 };
}

function identity(url: string, version: string): NpmLockIdentity {
	const parts = parseURL(url).pathname.split('/').filter(Boolean);
	const marker = parts.indexOf('-');
	if (marker < 1) throw new Error('Avataaars package identity is not derivable');
	let name: string;
	try {
		name = decodeURIComponent(parts.slice(0, marker).join('/'));
	} catch {
		throw new Error('Avataaars package identity encoding is invalid');
	}
	if (!name || (name.startsWith('@') && !name.includes('/')))
		throw new Error('Avataaars package identity is malformed');
	return { name, version };
}

export function parseAvataaarsYarnLock(lock: Buffer): readonly YarnRequest[] {
	if (sha256(lock) !== AVATAAARS_LOCK_SHA256)
		throw new Error('Avataaars yarn.lock SHA-256 mismatch');
	const rows: Array<Omit<YarnRequest, 'sequence'>> = [];
	let version: string | undefined;
	let resolved: string | undefined;
	let integrity: string | undefined;
	const flush = (): void => {
		if (version === undefined && resolved === undefined && integrity === undefined) return;
		if (!version || !resolved || !integrity)
			throw new Error('Avataaars yarn.lock stanza lacks immutable fields');
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
			throw new Error('Avataaars lock repeats a URL with different immutable fields');
		unique.set(row.resolved, row);
	}
	const ordered = [...unique.values()].sort((left, right) =>
		compare(left.resolved, right.resolved),
	);
	if (ordered.length !== AVATAAARS_REQUESTS)
		throw new Error(`Avataaars lock URL count differs: ${ordered.length}`);
	const algorithms = ordered.map((row) => sriAlgorithm(row.integrity));
	if (
		algorithms.filter((value) => value === 'sha512').length !== 606 ||
		algorithms.filter((value) => value === 'sha1').length !== 616
	)
		throw new Error('Avataaars lock integrity split differs');
	if (sha256(ordered.map((row) => row.resolved).join('\n')) !== AVATAAARS_URL_LIST_SHA256)
		throw new Error('Avataaars ordered URL-list SHA-256 differs');
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
	if (bytes.byteLength !== 166934 || sha256(bytes) !== AVATAAARS_ARCHIVE_SHA256)
		throw new Error('Avataaars retained archive identity differs');
	const index = indexTarGzip(
		{ bytes, byteLength: bytes.byteLength, sha256: AVATAAARS_ARCHIVE_SHA256 },
		commit,
	);
	const hashes = [
		['LICENSE', '479dc70764e2e2213229618168810342d8b2fe362cfeb8353fede23630d22e48'],
		['package.json', 'ab38720b2b8fe9529a49040d6d20fe23627d0cdf2699195bf9f2eaf58b5d0b18'],
		['yarn.lock', AVATAAARS_LOCK_SHA256],
		[
			'src/components/App.tsx',
			'78f34e49e318159358d450fc631f3ab07138498bd1e3f63e668720f4c90bfd74',
		],
		[
			'src/components/AvatarForm.tsx',
			'8e8b528cd024b021b856dc799377784c69529e8033490705650aba044246904a',
		],
		[
			'src/components/Main.tsx',
			'4a780cfd92fd6f62625d9c425872940e38ed7f23388d2dfba8182a169edd16fb',
		],
		['src/index.tsx', 'd685c7683cf2a5037dceab162e2cb6d1f0a872821f758c54c5c5629c11acff79'],
		['public/index.html', 'cf2457f8884552cb1aee5ce77056b8bddf697747a4a02b27593d82f2e1ebc499'],
	] as const;
	for (const [file, digest] of hashes)
		if (sha256(findArchiveFile(index, file).bytes) !== digest)
			throw new Error(`Avataaars retained ${file} SHA-256 differs`);
	const lock = findArchiveFile(index, 'yarn.lock').bytes;
	return {
		lock,
		packageJson: findArchiveFile(index, 'package.json').bytes,
		plan: parseAvataaarsYarnLock(lock),
	};
}

export async function verifyRetainedAvataaarsTwice(): Promise<void> {
	const first = await retained();
	const second = await retained();
	if (canonicalize(first.plan) !== canonicalize(second.plan))
		throw new Error('Avataaars retained preflight replay differs');
}

async function verifyStoppedHistory(): Promise<void> {
	const terminalBytes = await readFile(t226Terminal);
	const failureBytes = await readFile(t226Failure);
	if (
		sha256(terminalBytes) !== '557d7aeba34ad9550a5cf8b30ee7b8d8ce6d13eec3729575742cf72271c06be6'
	)
		throw new Error('T226 terminal history SHA-256 differs');
	if (sha256(failureBytes) !== '405eb58eab324150c5860ddf6de5be9110d16ddaaac232833acc4c2ba37b8e3f')
		throw new Error('T226 failure history SHA-256 differs');
	const terminalRecord = JSON.parse(terminalBytes.toString('utf8')) as Record<string, unknown>;
	const failure = JSON.parse(failureBytes.toString('utf8')) as {
		transportRequests?: unknown;
		aggregateBytes?: unknown;
		ledger?: Array<{ bytes?: unknown }>;
	};
	if (
		terminalRecord.consentId !== AVATAAARS_CONSUMED_CONSENT_IDS[0] ||
		terminalRecord.state !== 'terminal-consumed' ||
		failure.transportRequests !== 928 ||
		failure.aggregateBytes !== 19_479_861 ||
		failure.ledger?.length !== 927 ||
		failure.ledger.reduce(
			(total, row) => total + (typeof row.bytes === 'number' ? row.bytes : 0),
			0,
		) !== 19_431_623
	)
		throw new Error('T226 stopped-attempt accounting differs');
	const t228TerminalBytes = await readFile(t228Terminal);
	const t228FailureBytes = await readFile(t228Failure);
	if (
		sha256(t228TerminalBytes) !==
		'8d3fb8ed54d6d590750ca906dd7fe1ef2a8f0093b20484b577ef47c121a3ad49'
	)
		throw new Error('T228 terminal history SHA-256 differs');
	if (
		sha256(t228FailureBytes) !==
		'a2a16dd7e7acdfc74a63426a7b9eaaf7883fd22ad763ff04fe2cc101532ae34a'
	)
		throw new Error('T228 failure history SHA-256 differs');
	const t228TerminalRecord = JSON.parse(t228TerminalBytes.toString('utf8')) as Record<
		string,
		unknown
	>;
	const t228 = JSON.parse(t228FailureBytes.toString('utf8')) as {
		transportRequests?: unknown;
		aggregateBytes?: unknown;
		ledger?: Array<{ bytes?: unknown }>;
	};
	if (
		t228TerminalRecord.consentId !== AVATAAARS_CONSUMED_CONSENT_IDS[1] ||
		t228TerminalRecord.state !== 'terminal-consumed' ||
		t228.transportRequests !== 1222 ||
		t228.aggregateBytes !== 35_505_932 ||
		t228.ledger?.length !== 1222 ||
		t228.ledger.reduce(
			(total, row) => total + (typeof row.bytes === 'number' ? row.bytes : 0),
			0,
		) !== 35_505_932
	)
		throw new Error('T228 stopped-attempt accounting differs');
}

function assertConsent(value: string | undefined): void {
	if (
		value !== AVATAAARS_CONSENT_ID ||
		process.env.VERSIONLESS_NETWORK_MODE !== 'consented' ||
		process.env.VERSIONLESS_CONSENT_ID !== AVATAAARS_CONSENT_ID
	)
		throw new Error('T230 requires fresh acquisition-only consent in argument and environment');
}

function verifyBytes(bytes: Buffer, request: YarnRequest): void {
	if (createHash('sha1').update(bytes).digest('hex') !== request.fragmentSha1)
		throw new Error('Avataaars repeated resolved SHA-1 bytes differ');
	const algorithm = sriAlgorithm(request.integrity);
	const expected = request.integrity.slice(request.integrity.indexOf('-') + 1);
	if (createHash(algorithm).update(bytes).digest('base64') !== expected)
		throw new Error('Avataaars lock integrity bytes differ');
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
		throw new Error('Avataaars redirect is outside the exact permitted shape');
}

async function body(response: Response): Promise<Buffer> {
	const declared = response.headers.get('content-length');
	const encoding = response.headers.get('content-encoding');
	if (encoding && encoding !== 'identity')
		throw new Error('Avataaars response was transport encoded');
	if (
		declared !== null &&
		(!Number.isSafeInteger(Number(declared)) || Number(declared) > responseLimit)
	)
		throw new Error('Avataaars response exceeds the byte limit');
	const reader = response.body?.getReader();
	if (!reader) throw new Error('Avataaars response body is absent');
	const chunks: Buffer[] = [];
	let size = 0;
	while (true) {
		const next = await reader.read();
		if (next.done) break;
		size += next.value.byteLength;
		if (size > responseLimit) {
			await reader.cancel();
			throw new Error('Avataaars response exceeds the byte limit');
		}
		chunks.push(Buffer.from(next.value));
	}
	if (declared !== null && Number(declared) !== size)
		throw new Error('Avataaars response byte count differs');
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
		if (!redirect) throw new Error('Avataaars redirect location is absent');
		validateRedirect(redirect);
		requests += 1;
		response = await fetcher(redirect, options);
	}
	if (response.status !== 200 || response.redirected || response.headers.has('location'))
		throw new Error(`Avataaars terminal response ${response.status} is not accepted`);
	const bytes = await body(response);
	verifyBytes(bytes, request);
	return { bytes, requests, redirect };
}

function audit(metadata: PackageMetadata): void {
	if (metadata.license.state === 'empty' || metadata.license.state === 'ambiguous')
		throw new Error(`Avataaars dependency ${metadata.name} lacks license evidence`);
	if (metadata.license.declarations.some((value) => value.toUpperCase() === 'UNLICENSED'))
		throw new Error(`Avataaars dependency ${metadata.name} is non-redistributable`);
	if (metadata.lifecycleScripts.some((script) => script.state === 'ambiguous'))
		throw new Error(`Avataaars dependency ${metadata.name} has ambiguous lifecycle metadata`);
	if (
		metadata.name !== 'fsevents' &&
		(metadata.nativeIndicators.bindingGyp ||
			metadata.nativeIndicators.gypfile === 'true' ||
			metadata.nativeIndicators.gypfile === 'ambiguous' ||
			metadata.nativeIndicators.nodeGypDependency ||
			metadata.nativeIndicators.lifecycleMentionsNodeGyp)
	)
		throw new Error(`Avataaars dependency ${metadata.name} requires native execution`);
	if (metadata.os.state === 'ambiguous' || metadata.cpu.state === 'ambiguous')
		throw new Error(`Avataaars dependency ${metadata.name} has ambiguous platform metadata`);
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
					throw new Error('Avataaars install produced an escaping symlink');
				rows.push(`L ${relative} ${target}`);
			} else if (entry.isFile())
				rows.push(`F ${relative} ${sha256(await readFile(absolute))}`);
			else throw new Error('Avataaars install produced a special entry');
		}
	};
	await visit(directory);
	return sha256(`${rows.join('\n')}\n`);
}

export function avataaarsMirrorName(request: YarnRequest): string {
	const result = parseURL(request.url).pathname.split('/').at(-1);
	if (!result?.endsWith('.tgz')) throw new Error('Avataaars mirror filename is invalid');
	if (!request.identity.name.startsWith('@')) return result;
	const separator = request.identity.name.indexOf('/');
	if (separator < 2) throw new Error('Avataaars scoped mirror identity is invalid');
	return `${request.identity.name.slice(0, separator)}-${result}`;
}

export function assertAvataaarsMirrorCollision(
	existingSha256: string,
	candidateSha256: string,
): void {
	if (existingSha256 !== candidateSha256)
		throw new Error('Avataaars mirror filename collision differs');
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
					'--ignore-optional',
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
			if (sha256(await readFile(path.join(directory, 'yarn.lock'))) !== AVATAAARS_LOCK_SHA256)
				throw new Error('Avataaars install changed yarn.lock');
			if (await exists(path.join(directory, 'node_modules/fsevents')))
				throw new Error('Avataaars optional fsevents was installed');
			digests.push(await treeDigest(path.join(directory, 'node_modules')));
		}
		if (digests[0] !== digests[1])
			throw new Error('Avataaars independent offline install closures differ');
		return digests;
	} finally {
		await rm(work, { recursive: true, force: true });
	}
}

function histories(): readonly Readonly<Record<string, string | number>>[] {
	return [
		{
			task: 'T226',
			consentId: AVATAAARS_CONSUMED_CONSENT_IDS[0],
			terminalSha256: '557d7aeba34ad9550a5cf8b30ee7b8d8ce6d13eec3729575742cf72271c06be6',
			failureSha256: '405eb58eab324150c5860ddf6de5be9110d16ddaaac232833acc4c2ba37b8e3f',
			transportRequests: 928,
			acceptedBytes: 19_479_861,
		},
		{
			task: 'T228',
			consentId: AVATAAARS_CONSUMED_CONSENT_IDS[1],
			terminalSha256: '8d3fb8ed54d6d590750ca906dd7fe1ef2a8f0093b20484b577ef47c121a3ad49',
			failureSha256: 'a2a16dd7e7acdfc74a63426a7b9eaaf7883fd22ad763ff04fe2cc101532ae34a',
			transportRequests: 1222,
			acceptedBytes: 35_505_932,
		},
	];
}

function closureDigest(receipt: ClosureReceipt): string {
	const { integrity: _integrity, ...body } = receipt;
	return sha256(canonicalize(body));
}

async function verifyClosureAt(directory: string): Promise<ClosureReceipt> {
	await verifyStoppedHistory();
	const receipt = JSON.parse(
		await readFile(path.join(directory, 'closure.json'), 'utf8'),
	) as ClosureReceipt;
	const ledger = JSON.parse(
		await readFile(path.join(directory, 'ledger.json'), 'utf8'),
	) as unknown;
	const { plan } = await retained();
	if (
		receipt.schemaVersion !== 'versionless.react-avataaars-audited-closure.v1' ||
		receipt.state !== 'audited-closure-published' ||
		receipt.artifacts.length !== 1222 ||
		receipt.ledger.length !== 1222 ||
		canonicalize(ledger) !== canonicalize(receipt.ledger) ||
		closureDigest(receipt) !== receipt.integrity.canonicalDigest ||
		canonicalize(receipt.histories) !== canonicalize(histories()) ||
		Object.values(receipt.downstream).some((state) => state !== 'not-run')
	)
		throw new Error('Avataaars audited closure shape or digest differs');
	for (const request of plan) {
		const artifact = receipt.artifacts[request.sequence - 1];
		if (!artifact || artifact.resolved !== request.resolved)
			throw new Error('Avataaars audited closure order differs');
		const content = await readFile(path.join(directory, `tarballs/${artifact.sha256}.tgz`));
		const mirror = await readFile(path.join(directory, 'mirror', avataaarsMirrorName(request)));
		if (
			content.byteLength !== artifact.byteLength ||
			sha256(content) !== artifact.sha256 ||
			sha256(mirror) !== artifact.sha256
		)
			throw new Error('Avataaars audited closure content differs');
		verifyBytes(content, request);
		const metadata = inspectNpmPackageTarball(content, [request.identity]);
		audit(metadata);
		if (canonicalize(metadata) !== canonicalize(artifact.metadata))
			throw new Error('Avataaars audited closure metadata differs');
	}
	return receipt;
}

export async function acquireAndPublishAvataaarsClosure(
	consentId: string | undefined,
	fetcher: typeof fetch = fetch,
): Promise<ClosureReceipt> {
	for (const target of [stage, published, terminal, evidence, `${evidence}.tmp`, work])
		if (await exists(target))
			throw new Error(`T230 preflight residue exists: ${path.relative(root, target)}`);
	await verifyStoppedHistory();
	await verifyRetainedAvataaarsTwice();
	const { plan } = await retained();
	if (new Set(plan.map(avataaarsMirrorName)).size !== 1222)
		throw new Error('Avataaars corrected mirror names are not unique');
	assertConsent(consentId);
	await mkdir(cacheRoot, { recursive: true });
	await writeFile(terminal, canonical({ task: 'T230', consentId, state: 'terminal-consumed' }), {
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
			if (transportRequests > 2444 || aggregateBytes > aggregateLimit)
				throw new Error('Avataaars acquisition ceiling exceeded');
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
			else assertAvataaarsMirrorCollision(sha256(await readFile(contentFile)), digest);
			const mirrorFile = path.join(stage, 'mirror', avataaarsMirrorName(request));
			if (!(await exists(mirrorFile)))
				await writeFile(mirrorFile, accepted.bytes, { flag: 'wx' });
			else assertAvataaarsMirrorCollision(sha256(await readFile(mirrorFile)), digest);
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
				process.stderr.write(`T230 acquired ${request.sequence}/${AVATAAARS_REQUESTS}\n`);
		}
		const body = {
			schemaVersion: 'versionless.react-avataaars-audited-closure.v1' as const,
			fixture: 'react-avataaars' as const,
			state: 'audited-closure-published' as const,
			source: {
				repository: 'fangpenlin/avataaars-generator',
				commit,
				tree: '94a3d1a024682b3f21ad30b9de8d4e1541a376d3',
				archiveSha256: AVATAAARS_ARCHIVE_SHA256,
				lockSha256: AVATAAARS_LOCK_SHA256,
				urlListSha256: AVATAAARS_URL_LIST_SHA256,
			},
			consent: {
				id: AVATAAARS_CONSENT_ID,
				status: 'closed',
				methods: ['GET'],
				artifacts: 1222,
				transportRequests,
				acceptedBytes: aggregateBytes,
			},
			histories: histories(),
			integritySummary: { sha512: 606, legacySha1: 616, sha1Claim: 'weak-upstream-only' },
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
			path.join(cacheRoot, `failures/t230-${Date.now()}.json`),
			canonical({
				task: 'T230',
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

export async function verifyPublishedAvataaarsClosure(): Promise<ClosureReceipt> {
	if (process.env.VERSIONLESS_NETWORK_MODE !== 'offline')
		throw new Error('T230 closure verification requires offline mode');
	return await verifyClosureAt(published);
}

export async function installFromPublishedAvataaarsClosure(): Promise<DependencyReceipt> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true' ||
		process.env.VERSIONLESS_CONSENT_ID
	)
		throw new Error('T230 installation requires consent-free offline mode');
	if (await exists(evidence)) throw new Error('T230 dependency evidence already exists');
	const first = await verifyClosureAt(published);
	const second = await verifyClosureAt(published);
	if (first.integrity.canonicalDigest !== second.integrity.canonicalDigest)
		throw new Error('T230 closure replay digest differs');
	const { lock, packageJson } = await retained();
	try {
		if ((await execute(node16, ['--version'])).trim() !== 'v16.20.2')
			throw new Error('Avataaars Node 16 identity differs');
		if ((await execute(node16, [yarn, '--version'])).trim() !== '1.22.22')
			throw new Error('Avataaars Yarn identity differs');
		const digests = await installTwice(lock, packageJson, path.join(published, 'mirror'));
		const receipt: DependencyReceipt = {
			schemaVersion: 'versionless.react-avataaars-dependency-closure.v1',
			fixture: 'react-avataaars',
			closure: {
				path: `.versionless/cache/react-avataaars-dependencies/${AVATAAARS_LOCK_SHA256}`,
				digest: first.integrity.canonicalDigest,
				state: first.state,
			},
			histories: histories(),
			installVerification: {
				runs: 2,
				networkAttempts: 0,
				ignoreScripts: true,
				ignoreOptional: true,
				digests,
				lockUnchanged: true,
				optionalFsevents: 'excluded',
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
			path.join(cacheRoot, `offline-failures/t230-${Date.now()}.json`),
			canonical({
				task: 'T230',
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
	if (args[args.indexOf('--fixture') + 1] !== 'react-avataaars')
		throw new Error('T230 requires literal --fixture react-avataaars');
	if (args.includes('--verify-closure')) {
		const closure = await verifyPublishedAvataaarsClosure();
		process.stdout.write(
			canonical({ result: 'closure-verified', networkAttempts: 0, closure }),
		);
		return;
	}
	if (args.includes('--install-from-published-closure')) {
		const receipt = await installFromPublishedAvataaarsClosure();
		process.stdout.write(
			canonical({ result: 'install-verified', networkAttempts: 0, receipt }),
		);
		return;
	}
	if (!args.includes('--acquire-and-publish-closure'))
		throw new Error('T230 requires an explicit phase flag');
	const index = args.indexOf('--consent-id');
	const closure = await acquireAndPublishAvataaarsClosure(
		index < 0 ? undefined : args[index + 1],
	);
	process.stdout.write(canonical({ result: 'closure-published', requests: 1222, closure }));
}

if (process.argv[1]?.endsWith('react-avataaars-dependency-ingest.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
