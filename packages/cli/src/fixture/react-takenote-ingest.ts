import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { request } from 'node:https';
import { extname, join, relative, resolve } from 'pathe';
import { parseURL } from 'ufo';
import { canonicalize, sha256 } from '../../../core/src/index.ts';

export const TAKENOTE_CONSENT =
	'T561-official-source-takenote-react16-corrected-production-pilot' as const;
export const REJECTED_TAKENOTE_CONSENT =
	'T560-official-source-takenote-react16-production-pilot' as const;
export const TAKENOTE_REVISION = 'e0eddbb9a21ae4cf4c4c7c183f29cfd666e08331' as const;
export const TAKENOTE_TREE = '4d5a0f472a4609d7b8086dcd73827a394b21f343' as const;

const root = resolve(import.meta.dirname, '../../../..');
const fixturePath = join(root, 'fixtures/react-takenote/fixture.json');
const cacheRoot = join(root, '.versionless/cache/react-takenote');
const stageRoot = join(root, '.versionless/stage/react-takenote');
const workRoot = join(root, '.versionless/work/react-takenote');
const runRoot = join(root, 'evidence/runs/react-takenote');
const evidenceRoot = join(root, 'evidence/ingests/react-takenote');
const attemptPath = join(evidenceRoot, 'attempt-t561.json');
const failurePath = join(evidenceRoot, 'consumed-failed-t561.json');
const maxResponses = 2_500;
const maxBytes = 1_073_741_824;

type Fixture = {
	repository: string;
	revision: typeof TAKENOTE_REVISION;
	tree: typeof TAKENOTE_TREE;
	treeUrl: string;
	treeResponseSha256: string;
	archiveUrl: string;
	historicalFailedRawPackageResponseSha256: string;
	knownFiles: Record<string, string>;
	compatibility: {
		runtime: string;
		runtimeSha256: string;
		sass: string;
		sassMetadataUrl: string;
	};
	target: { runtime: string; runtimeSha256: string; vite: string };
};
type TreeRow = { path: string; mode: string; type: string; sha: string; size?: number };
export type TakeNoteArtifact = {
	url: string;
	integrity: string;
	placements: string[];
	mirror: string;
};
type LedgerRow = {
	ordinal: number;
	url: string;
	media: 'json' | 'binary';
	status: 200;
	bytes: number;
	sha256: string;
};

const exists = (file: string): Promise<boolean> =>
	access(file).then(
		() => true,
		() => false,
	);
const compareText = (left: string, right: string): number =>
	left < right ? -1 : left > right ? 1 : 0;

export function assertTakeNoteConsent(args: string[]): void {
	if (
		args.length !== 3 ||
		args[0] !== '--acquire' ||
		args[1] !== '--consent-id' ||
		args[2] !== TAKENOTE_CONSENT ||
		process.env.VERSIONLESS_NETWORK_MODE !== 'consented' ||
		process.env.VERSIONLESS_CONSENT_ID !== TAKENOTE_CONSENT
	)
		throw new Error('TakeNote acquisition requires exact one-shot consent');
}

export function verifyTakeNoteGitBlob(input: {
	api: unknown;
	expectedSha: string;
	expectedSize: number;
}): Buffer {
	if (!input.api || typeof input.api !== 'object' || Array.isArray(input.api))
		throw new Error('TakeNote package blob response differs');
	const value = input.api as {
		sha?: unknown;
		size?: unknown;
		encoding?: unknown;
		content?: unknown;
	};
	if (
		value.sha !== input.expectedSha ||
		value.size !== input.expectedSize ||
		value.encoding !== 'base64' ||
		typeof value.content !== 'string'
	)
		throw new Error('TakeNote package blob identity differs');
	const bytes = Buffer.from(value.content, 'base64');
	if (bytes.length !== input.expectedSize || gitBlobSha(bytes) !== input.expectedSha)
		throw new Error('TakeNote reconstructed package blob identity differs');
	return bytes;
}

export function assertTakeNoteUrl(url: string, allowed: ReadonlySet<string>): void {
	const parsed = parseURL(url);
	if (
		parsed.protocol !== 'https:' ||
		parsed.auth ||
		parsed.hash ||
		!allowed.has(url) ||
		!['api.github.com', 'codeload.github.com', 'registry.npmjs.org'].includes(parsed.host ?? '')
	)
		throw new Error('TakeNote URL is outside exact consent');
}

export function analyzeTakeNoteLock(value: unknown): {
	placements: number;
	artifacts: TakeNoteArtifact[];
	digest: string;
} {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error('TakeNote npm lock must be an object');
	const lock = value as { lockfileVersion?: unknown; packages?: unknown };
	if (
		lock.lockfileVersion !== 2 ||
		!lock.packages ||
		typeof lock.packages !== 'object' ||
		Array.isArray(lock.packages)
	)
		throw new Error('TakeNote requires committed npm lock v2');
	const byUrl = new Map<string, TakeNoteArtifact>();
	let placements = 0;
	for (const [placement, raw] of Object.entries(lock.packages as Record<string, unknown>)) {
		if (placement === '') continue;
		if (!raw || typeof raw !== 'object' || Array.isArray(raw))
			throw new Error(`TakeNote lock placement differs: ${placement}`);
		const row = raw as { resolved?: unknown; integrity?: unknown; link?: unknown };
		if (row.link === true) continue;
		placements += 1;
		if (
			typeof row.resolved !== 'string' ||
			typeof row.integrity !== 'string' ||
			!row.integrity.startsWith('sha512-')
		)
			throw new Error(`TakeNote lock strong integrity differs: ${placement}`);
		const parsed = parseURL(row.resolved);
		if (
			parsed.protocol !== 'https:' ||
			parsed.host !== 'registry.npmjs.org' ||
			parsed.auth ||
			parsed.search ||
			parsed.hash
		)
			throw new Error(`TakeNote lock origin differs: ${placement}`);
		const prior = byUrl.get(row.resolved);
		if (prior && prior.integrity !== row.integrity)
			throw new Error('TakeNote lock same-URL integrity conflict');
		if (prior) prior.placements.push(placement);
		else
			byUrl.set(row.resolved, {
				url: row.resolved,
				integrity: row.integrity,
				placements: [placement],
				mirror: `${sha256(row.resolved)}.tgz`,
			});
	}
	const artifacts = [...byUrl.values()].sort((left, right) => compareText(left.url, right.url));
	if (artifacts.length < 100 || artifacts.length > maxResponses - 5)
		throw new Error('TakeNote lock closure cardinality differs');
	return { placements, artifacts, digest: sha256(canonicalize(artifacts)) };
}

export function assertTakeNoteArchiveEntries(entries: string[]): void {
	if (entries.length < 50) throw new Error('TakeNote archive is unexpectedly small');
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
			throw new Error('TakeNote archive path is unsafe');
		prefix ??= parts[0];
		if (parts[0] !== prefix) throw new Error('TakeNote archive root differs');
	}
}

function verifySri(bytes: Buffer, integrity: string): void {
	if (createHash('sha512').update(bytes).digest('base64') !== integrity.slice('sha512-'.length))
		throw new Error('TakeNote artifact integrity differs');
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
		child.stdout.on('data', (bytes: Buffer) => stdout.push(bytes));
		child.stderr.on('data', (bytes: Buffer) => stderr.push(bytes));
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
		else throw new Error('TakeNote source contains a special filesystem entry');
	}
	return result.sort(compareText);
}

type NetworkState = { responses: number; bytes: number; ledger: LedgerRow[] };
async function getExact(
	url: string,
	media: 'json' | 'binary',
	allowed: ReadonlySet<string>,
	state: NetworkState,
): Promise<Buffer> {
	assertTakeNoteUrl(url, allowed);
	if (state.responses >= maxResponses) throw new Error('TakeNote response cap exceeded');
	const ordinal = state.responses + 1;
	return await new Promise((resolvePromise, reject) => {
		const call = request(
			url,
			{
				method: 'GET',
				headers: {
					accept:
						media === 'json'
							? 'application/vnd.github+json'
							: 'application/octet-stream',
					'accept-encoding': 'identity',
					'user-agent': 'versionless-t561',
				},
			},
			(response) => {
				if (
					response.statusCode !== 200 ||
					response.headers.location ||
					response.headers['set-cookie'] ||
					response.headers['content-encoding']
				) {
					response.resume();
					reject(new Error('TakeNote response boundary differs'));
					return;
				}
				const chunks: Buffer[] = [];
				let bytes = 0;
				response.on('data', (chunk: Buffer) => {
					bytes += chunk.length;
					if (state.bytes + bytes > maxBytes)
						call.destroy(new Error('TakeNote byte cap exceeded'));
					else chunks.push(chunk);
				});
				response.once('end', () => {
					const body = Buffer.concat(chunks);
					state.responses += 1;
					state.bytes += body.length;
					state.ledger.push({
						ordinal,
						url,
						media,
						status: 200,
						bytes: body.length,
						sha256: sha256(body),
					});
					resolvePromise(body);
				});
			},
		);
		call.once('error', reject);
		call.end();
	});
}

async function sealFailure(message: string): Promise<void> {
	if (await exists(failurePath)) return;
	const reason = message.includes('response boundary')
		? 'response-boundary-differed'
		: message.includes('identity') || message.includes('differs')
			? 'immutable-gate-differed'
			: 'acquisition-failed';
	const receipt = {
		schemaVersion: 'versionless.react-takenote-consumed-failed.v1',
		result: 'consumed-failed',
		consentId: TAKENOTE_CONSENT,
		retry: false,
		reusable: false,
		reason,
		counted: false,
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	receipt.integrity.canonicalDigest = sha256(canonicalize(receipt));
	await writeFile(failurePath, `${canonicalize(receipt)}\n`, { flag: 'wx' });
}

export async function verifyTakeNoteIngest(): Promise<{ valid: true; digest: string }> {
	const receipt = JSON.parse(await readFile(join(evidenceRoot, 'receipt.json'), 'utf8')) as {
		schemaVersion?: string;
		result?: string;
		integrity?: { canonicalDigest?: string };
		source?: { manifestDigest?: string };
		closure?: { artifacts?: TakeNoteArtifact[]; digest?: string };
	};
	if (
		receipt.schemaVersion !== 'versionless.react-takenote-ingest.v1' ||
		receipt.result !== 'pass'
	)
		throw new Error('TakeNote ingest receipt identity differs');
	const copy = structuredClone(receipt);
	copy.integrity!.canonicalDigest = '';
	if (sha256(canonicalize(copy)) !== receipt.integrity?.canonicalDigest)
		throw new Error('TakeNote ingest receipt digest differs');
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
	if (sha256(canonicalize(manifest)) !== receipt.source?.manifestDigest)
		throw new Error('TakeNote cached source differs');
	for (const artifact of receipt.closure?.artifacts ?? [])
		verifySri(await readFile(join(cacheRoot, 'mirror', artifact.mirror)), artifact.integrity);
	if (sha256(canonicalize(receipt.closure?.artifacts)) !== receipt.closure?.digest)
		throw new Error('TakeNote cached closure differs');
	return { valid: true, digest: receipt.integrity!.canonicalDigest! };
}

export async function acquireTakeNote(): Promise<void> {
	for (const target of [cacheRoot, stageRoot, workRoot, runRoot, attemptPath, failurePath])
		if (await exists(target)) throw new Error('TakeNote acquisition requires fresh roots');
	await mkdir(evidenceRoot, { recursive: true });
	await writeFile(
		attemptPath,
		`${canonicalize({ schemaVersion: 'versionless.react-takenote-attempt.v1', consentId: TAKENOTE_CONSENT, invoked: true })}\n`,
		{ flag: 'wx' },
	);
	const fixture = JSON.parse(await readFile(fixturePath, 'utf8')) as Fixture;
	const acquisition = join(stageRoot, 'acquisition');
	const source = join(acquisition, 'source');
	const mirror = join(acquisition, 'mirror');
	await mkdir(source, { recursive: true });
	await mkdir(mirror, { recursive: true });
	const allowed = new Set([
		fixture.treeUrl,
		fixture.archiveUrl,
		fixture.compatibility.sassMetadataUrl,
	]);
	const state: NetworkState = { responses: 0, bytes: 0, ledger: [] };
	const treeResponse = await getExact(fixture.treeUrl, 'json', allowed, state);
	if (sha256(treeResponse) !== fixture.treeResponseSha256)
		throw new Error('TakeNote tree response identity differs');
	const tree = JSON.parse(treeResponse.toString('utf8')) as {
		sha?: string;
		truncated?: boolean;
		tree?: TreeRow[];
	};
	if (tree.sha !== fixture.tree || tree.truncated !== false || !Array.isArray(tree.tree))
		throw new Error('TakeNote tree facts differ');
	const packageTreeRow = tree.tree.find((row) => row.path === 'package.json');
	if (!packageTreeRow || packageTreeRow.type !== 'blob' || packageTreeRow.size === undefined)
		throw new Error('TakeNote package tree path differs');
	const packageBlobUrl = `https://api.github.com/repos/taniarascia/takenote/git/blobs/${packageTreeRow.sha}`;
	allowed.add(packageBlobUrl);
	const packageBlobResponse = await getExact(packageBlobUrl, 'json', allowed, state);
	const expectedPackageBytes = verifyTakeNoteGitBlob({
		api: JSON.parse(packageBlobResponse.toString('utf8')),
		expectedSha: packageTreeRow.sha,
		expectedSize: packageTreeRow.size,
	});
	const archive = await getExact(fixture.archiveUrl, 'binary', allowed, state);
	const archivePath = join(acquisition, 'source.tar.gz');
	await writeFile(archivePath, archive, { flag: 'wx' });
	const listing = await execute('/usr/bin/tar', ['-tzf', archivePath]);
	assertTakeNoteArchiveEntries(listing.split('\n').filter(Boolean));
	await execute('/usr/bin/tar', ['-xzf', archivePath, '-C', source, '--strip-components=1']);
	const byPath = new Map(
		tree.tree.filter((row) => row.type === 'blob').map((row) => [row.path, row]),
	);
	const manifest = await Promise.all(
		(await filesBelow(source)).map(async (file) => {
			const bytes = await readFile(file);
			const path = relative(source, file);
			const expected = byPath.get(path);
			if (!expected || expected.sha !== gitBlobSha(bytes) || expected.size !== bytes.length)
				throw new Error(`TakeNote archive/tree differs: ${path}`);
			return { path, bytes: bytes.length, sha256: sha256(bytes), gitSha: expected.sha };
		}),
	);
	const archivePackageBytes = await readFile(join(source, 'package.json'));
	if (!archivePackageBytes.equals(expectedPackageBytes))
		throw new Error('TakeNote archive package/blob identity differs');
	for (const [path, expected] of Object.entries(fixture.knownFiles))
		if (sha256(await readFile(join(source, path))) !== expected)
			throw new Error(`TakeNote known identity differs: ${path}`);
	const license = await readFile(join(source, 'LICENSE'), 'utf8');
	if (!license.includes('MIT License')) throw new Error('TakeNote MIT license differs');
	const lockBytes = await readFile(join(source, 'package-lock.json'));
	const closure = analyzeTakeNoteLock(JSON.parse(lockBytes.toString('utf8')));
	for (const artifact of closure.artifacts) allowed.add(artifact.url);
	for (let offset = 0; offset < closure.artifacts.length; offset += 8) {
		const batch = closure.artifacts.slice(offset, offset + 8);
		const bodies = await Promise.all(
			batch.map((artifact) => getExact(artifact.url, 'binary', allowed, state)),
		);
		for (let index = 0; index < batch.length; index += 1) {
			const artifact = batch[index]!;
			const body = bodies[index]!;
			verifySri(body, artifact.integrity);
			await writeFile(join(mirror, artifact.mirror), body, { flag: 'wx' });
		}
	}
	const sassMetadataBytes = await getExact(
		fixture.compatibility.sassMetadataUrl,
		'json',
		allowed,
		state,
	);
	const sassMetadata = JSON.parse(sassMetadataBytes.toString('utf8')) as {
		version?: string;
		dist?: { tarball?: string; integrity?: string };
	};
	if (
		sassMetadata.version !== fixture.compatibility.sass ||
		!sassMetadata.dist?.tarball ||
		!sassMetadata.dist.integrity?.startsWith('sha512-')
	)
		throw new Error('TakeNote pure-JS Sass metadata differs');
	allowed.add(sassMetadata.dist.tarball);
	const sassTarball = await getExact(sassMetadata.dist.tarball, 'binary', allowed, state);
	verifySri(sassTarball, sassMetadata.dist.integrity);
	await writeFile(join(acquisition, 'sass-1.32.13.tgz'), sassTarball, { flag: 'wx' });
	const node18Source = join(
		root,
		'.versionless/cache/angular-realworld-v15/closures/d3576ef3443079903aa0fa2c2337fbf8fcab88fdfeea3ff5b8de03e99587b8f9/node-runtime.tar.gz',
	);
	const node24Source = join(
		root,
		'.versionless/cache/react-boilerplate-v4-node24/node-v24.15.0-darwin-arm64.tar.gz',
	);
	const node18 = await readFile(node18Source);
	const node24 = await readFile(node24Source);
	if (
		sha256(node18) !== fixture.compatibility.runtimeSha256 ||
		sha256(node24) !== fixture.target.runtimeSha256
	)
		throw new Error('TakeNote established runtime identity differs');
	await writeFile(join(acquisition, 'node18.tar.gz'), node18, { flag: 'wx' });
	await writeFile(join(acquisition, 'node24.tar.gz'), node24, { flag: 'wx' });
	const assets = manifest.filter((row) =>
		new Set(['.gif', '.ico', '.jpeg', '.jpg', '.png', '.svg', '.webp', '.woff', '.woff2']).has(
			extname(row.path).toLowerCase(),
		),
	);
	const receipt = {
		schemaVersion: 'versionless.react-takenote-ingest.v1',
		result: 'pass',
		consentId: TAKENOTE_CONSENT,
		source: {
			repository: fixture.repository,
			revision: fixture.revision,
			tree: fixture.tree,
			archiveSha256: sha256(archive),
			manifestDigest: sha256(canonicalize(manifest)),
			files: manifest.length,
			package: {
				path: 'package.json',
				gitSha: packageTreeRow.sha,
				size: packageTreeRow.size,
				decodedSha256: sha256(expectedPackageBytes),
				historicalFailedRawResponseSha256: fixture.historicalFailedRawPackageResponseSha256,
			},
		},
		closure,
		license: { expression: 'MIT', authorship: 'unknown', certification: false, assets },
		compatibility: {
			originalNode12Executed: false,
			originalNodeSassExecuted: false,
			node18: {
				version: fixture.compatibility.runtime,
				sha256: fixture.compatibility.runtimeSha256,
			},
			sass: {
				version: fixture.compatibility.sass,
				sha256: sha256(sassTarball),
				integrity: sassMetadata.dist.integrity,
			},
		},
		target: { node24: fixture.target },
		access: { ...state, redirects: 0, cookies: false, credentials: false },
		privacy: { sensitiveData: false, hostPaths: false },
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	receipt.integrity.canonicalDigest = sha256(canonicalize(receipt));
	await writeFile(join(acquisition, 'receipt.json'), `${canonicalize(receipt)}\n`, {
		flag: 'wx',
	});
	await mkdir(join(root, '.versionless/cache'), { recursive: true });
	await rename(acquisition, cacheRoot);
	await rm(stageRoot, { recursive: true, force: true });
	await writeFile(join(evidenceRoot, 'receipt.json'), `${canonicalize(receipt)}\n`, {
		flag: 'wx',
	});
	await verifyTakeNoteIngest();
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	assertTakeNoteConsent(args);
	try {
		await acquireTakeNote();
		process.stdout.write(`${canonicalize({ result: 'pass', consentId: TAKENOTE_CONSENT })}\n`);
	} catch (error) {
		await rm(stageRoot, { recursive: true, force: true });
		await rm(cacheRoot, { recursive: true, force: true });
		await rm(workRoot, { recursive: true, force: true });
		await rm(runRoot, { recursive: true, force: true });
		if (await exists(attemptPath))
			await sealFailure(error instanceof Error ? error.message : String(error));
		throw error;
	}
}

if (process.argv[1]?.endsWith('react-takenote-ingest.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
