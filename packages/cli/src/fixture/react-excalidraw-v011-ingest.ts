import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { request } from 'node:https';
import { charIn, createRegExp } from 'magic-regexp';
import { basename, extname, join, relative, resolve } from 'pathe';
import { joinURL, parseURL, stringifyParsedURL, withQuery } from 'ufo';
import {
	canonicalize,
	inspectNpmPackageTarball,
	sha256,
	type NpmLockIdentity,
} from '../../../core/src/index.ts';

export const EXCALIDRAW_CONSENT =
	'T563-official-source-excalidraw-v011-react17-production-pilot' as const;
export const REJECTED_EXCALIDRAW_CONSENT =
	'T562-official-source-excalidraw-v011-react17-production-pilot' as const;
export const EXCALIDRAW_TAG = 'v0.11.0' as const;

const lowerHex40 = createRegExp(
	charIn('0123456789').from('a', 'f').times(40).at.lineStart().at.lineEnd(),
);
const root = resolve(import.meta.dirname, '../../../..');
const fixturePath = join(root, 'fixtures/react-excalidraw-v011/fixture.json');
const cacheRoot = join(root, '.versionless/cache/react-excalidraw-v011');
const stageRoot = join(root, '.versionless/stage/react-excalidraw-v011');
const workRoot = join(root, '.versionless/work/react-excalidraw-v011');
const runRoot = join(root, 'evidence/runs/react-excalidraw-v011');
const evidenceRoot = join(root, 'evidence/ingests/react-excalidraw-v011');
const dependencyEvidenceRoot = join(root, 'evidence/dependencies/react-excalidraw-v011');
const attemptPath = join(evidenceRoot, 'attempt-t563.json');
const failurePath = join(evidenceRoot, 'consumed-failed-t563.json');
const maxResponses = 2_500;
const maxBytes = 1_073_741_824;

type Fixture = {
	repository: string;
	tag: typeof EXCALIDRAW_TAG;
	tagRefUrl: string;
	yarnMetadataUrl: string;
	yarnVersion: string;
	baselineRuntime: { version: string; sha256: string };
	targetRuntime: { version: string; sha256: string };
	targetVite: string;
};
type TreeRow = { path: string; mode: string; type: string; sha: string; size?: number };
export type YarnArtifact = {
	url: string;
	integrity: string;
	placements: string[];
	mirror: string;
	identity: NpmLockIdentity;
};
type LedgerRow = {
	ordinal: number;
	url: string;
	media: 'json' | 'binary';
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

export function assertExcalidrawConsent(args: string[]): void {
	if (
		args.length !== 3 ||
		args[0] !== '--acquire' ||
		args[1] !== '--consent-id' ||
		args[2] !== EXCALIDRAW_CONSENT ||
		process.env.VERSIONLESS_NETWORK_MODE !== 'consented' ||
		process.env.VERSIONLESS_CONSENT_ID !== EXCALIDRAW_CONSENT
	)
		throw new Error('Excalidraw acquisition requires exact one-shot consent');
}

export function classifyExcalidrawTagRef(
	value: unknown,
):
	| { form: 'lightweight'; commitSha: string; tagObjectSha: null }
	| { form: 'annotated'; commitSha: null; tagObjectSha: string } {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error('Excalidraw tag ref identity differs');
	const ref = value as { ref?: unknown; object?: { type?: unknown; sha?: unknown } };
	if (
		ref.ref !== 'refs/tags/v0.11.0' ||
		typeof ref.object?.sha !== 'string' ||
		!lowerHex40.test(ref.object.sha)
	)
		throw new Error('Excalidraw tag ref identity differs');
	if (ref.object.type === 'commit')
		return { form: 'lightweight', commitSha: ref.object.sha, tagObjectSha: null };
	if (ref.object.type === 'tag')
		return { form: 'annotated', commitSha: null, tagObjectSha: ref.object.sha };
	throw new Error('Excalidraw tag ref type differs');
}

export function assertExcalidrawUrl(url: string, allowed: ReadonlySet<string>): void {
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
		].includes(parsed.host ?? '')
	)
		throw new Error('Excalidraw URL is outside exact consent');
}

function unquote(line: string, prefix: string): string {
	if (!line.startsWith(prefix) || !line.endsWith('"'))
		throw new Error('Excalidraw yarn lock field is malformed');
	return line.slice(prefix.length, -1);
}

export function analyzeExcalidrawYarnLock(bytes: Buffer): {
	artifacts: YarnArtifact[];
	placements: number;
	digest: string;
} {
	const text = bytes.toString('utf8');
	if (!text.includes('# yarn lockfile v1')) throw new Error('Excalidraw requires Yarn lock v1');
	const artifacts = new Map<string, YarnArtifact>();
	let selectors: string[] = [];
	let version: string | undefined;
	let resolved: string | undefined;
	let integrity: string | undefined;
	let placements = 0;
	const flush = (): void => {
		if (
			selectors.length === 0 &&
			version === undefined &&
			resolved === undefined &&
			integrity === undefined
		)
			return;
		if (selectors.length === 0 || !version || !resolved || !integrity?.startsWith('sha512-'))
			throw new Error('Excalidraw lock strong immutable fields differ');
		const parsed = parseURL(resolved);
		const fragment = parsed.hash.slice(1);
		parsed.hash = '';
		const url = stringifyParsedURL(parsed);
		const parts = parsed.pathname.split('/').filter(Boolean);
		const marker = parts.indexOf('-');
		const name = decodeURIComponent(parts.slice(0, marker).join('/'));
		if (
			parsed.protocol !== 'https:' ||
			!['registry.yarnpkg.com', 'registry.npmjs.org'].includes(parsed.host ?? '') ||
			parsed.auth ||
			parsed.search ||
			!parsed.pathname.endsWith('.tgz') ||
			marker < 1 ||
			!name ||
			!lowerHex40.test(fragment) ||
			Buffer.from(integrity.slice('sha512-'.length), 'base64').length !== 64
		)
			throw new Error('Excalidraw lock origin or integrity differs');
		placements += selectors.length;
		const prior = artifacts.get(url);
		if (prior && prior.integrity !== integrity)
			throw new Error('Excalidraw lock same-URL integrity conflict');
		if (prior) prior.placements.push(...selectors);
		else
			artifacts.set(url, {
				url,
				integrity,
				placements: [...selectors],
				mirror: `${sha256(url)}-${basename(parseURL(url).pathname)}`,
				identity: { name, version },
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
		} else if (line.startsWith('  version "')) version = unquote(line, '  version "');
		else if (line.startsWith('  resolved "')) resolved = unquote(line, '  resolved "');
		else if (line.startsWith('  integrity ')) integrity = line.slice('  integrity '.length);
	}
	flush();
	const ordered = [...artifacts.values()].sort((left, right) => compareText(left.url, right.url));
	if (ordered.length < 100 || ordered.length > maxResponses - 7)
		throw new Error('Excalidraw lock closure cardinality differs');
	return { artifacts: ordered, placements, digest: sha256(canonicalize(ordered)) };
}

export function assertExcalidrawArchiveEntries(entries: string[]): void {
	if (entries.length < 100) throw new Error('Excalidraw archive is unexpectedly small');
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
			throw new Error('Excalidraw archive path is unsafe');
		prefix ??= parts[0];
		if (parts[0] !== prefix) throw new Error('Excalidraw archive root differs');
	}
}

function gitBlobSha(bytes: Buffer): string {
	return createHash('sha1')
		.update(Buffer.from(`blob ${bytes.length}\0`))
		.update(bytes)
		.digest('hex');
}

function verifySri(bytes: Buffer, integrity: string): void {
	if (createHash('sha512').update(bytes).digest('base64') !== integrity.slice('sha512-'.length))
		throw new Error('Excalidraw artifact integrity differs');
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
		else throw new Error('Excalidraw source contains a special filesystem entry');
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
	assertExcalidrawUrl(url, allowed);
	if (state.responses >= maxResponses) throw new Error('Excalidraw response cap exceeded');
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
					'user-agent': 'versionless-t562',
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
					reject(new Error('Excalidraw response boundary differs'));
					return;
				}
				const chunks: Buffer[] = [];
				let bytes = 0;
				response.on('data', (chunk: Buffer) => {
					bytes += chunk.length;
					if (state.bytes + bytes > maxBytes)
						call.destroy(new Error('Excalidraw byte cap exceeded'));
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
	const receipt = {
		schemaVersion: 'versionless.react-excalidraw-v011-consumed-failed.v1',
		result: 'consumed-failed',
		consentId: EXCALIDRAW_CONSENT,
		retry: false,
		reusable: false,
		reason: message.includes('license')
			? 'license-gate-failed'
			: message.includes('lock')
				? 'lock-gate-failed'
				: message.includes('React')
					? 'framework-gate-failed'
					: 'immutable-or-acquisition-gate-failed',
		counted: false,
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	receipt.integrity.canonicalDigest = sha256(canonicalize(receipt));
	await writeFile(failurePath, `${canonicalize(receipt)}\n`, { flag: 'wx' });
}

export async function verifyExcalidrawIngest(): Promise<{ valid: true; digest: string }> {
	const receipt = JSON.parse(await readFile(join(evidenceRoot, 'receipt.json'), 'utf8')) as {
		integrity?: { canonicalDigest?: string };
		source?: { manifestDigest?: string };
		closure?: { artifacts?: YarnArtifact[]; digest?: string };
	};
	const copy = structuredClone(receipt);
	copy.integrity!.canonicalDigest = '';
	if (sha256(canonicalize(copy)) !== receipt.integrity?.canonicalDigest)
		throw new Error('Excalidraw ingest receipt digest differs');
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
		throw new Error('Excalidraw cached source differs');
	for (const artifact of receipt.closure?.artifacts ?? [])
		verifySri(await readFile(join(cacheRoot, 'mirror', artifact.mirror)), artifact.integrity);
	if (sha256(canonicalize(receipt.closure?.artifacts)) !== receipt.closure?.digest)
		throw new Error('Excalidraw cached closure differs');
	return { valid: true, digest: receipt.integrity!.canonicalDigest! };
}

export async function acquireExcalidraw(): Promise<void> {
	for (const target of [
		cacheRoot,
		stageRoot,
		workRoot,
		runRoot,
		dependencyEvidenceRoot,
		attemptPath,
		failurePath,
	])
		if (await exists(target)) throw new Error('Excalidraw acquisition requires fresh roots');
	await mkdir(evidenceRoot, { recursive: true });
	await writeFile(
		attemptPath,
		`${canonicalize({ schemaVersion: 'versionless.react-excalidraw-v011-attempt.v1', consentId: EXCALIDRAW_CONSENT, invoked: true })}\n`,
		{ flag: 'wx' },
	);
	const fixture = JSON.parse(await readFile(fixturePath, 'utf8')) as Fixture;
	const acquisition = join(stageRoot, 'acquisition');
	const source = join(acquisition, 'source');
	const mirror = join(acquisition, 'mirror');
	await mkdir(source, { recursive: true });
	await mkdir(mirror, { recursive: true });
	const allowed = new Set([fixture.tagRefUrl, fixture.yarnMetadataUrl]);
	const state: NetworkState = { responses: 0, bytes: 0, ledger: [] };
	const tagRefBytes = await getExact(fixture.tagRefUrl, 'json', allowed, state);
	const tagRef = classifyExcalidrawTagRef(JSON.parse(tagRefBytes.toString('utf8')));
	const apiRoot = joinURL('https://api.github.com', 'repos', 'excalidraw', 'excalidraw', 'git');
	let commitSha = tagRef.commitSha;
	if (tagRef.form === 'annotated') {
		const tagUrl = joinURL(apiRoot, 'tags', tagRef.tagObjectSha);
		allowed.add(tagUrl);
		const tagBytes = await getExact(tagUrl, 'json', allowed, state);
		const tag = JSON.parse(tagBytes.toString('utf8')) as {
			tag?: string;
			sha?: string;
			object?: { type?: string; sha?: string };
		};
		if (
			tag.tag !== fixture.tag ||
			tag.sha !== tagRef.tagObjectSha ||
			tag.object?.type !== 'commit' ||
			!lowerHex40.test(tag.object.sha ?? '')
		)
			throw new Error('Excalidraw annotated tag object differs');
		commitSha = tag.object.sha!;
	}
	const commitUrl = joinURL(apiRoot, 'commits', commitSha!);
	allowed.add(commitUrl);
	const commitBytes = await getExact(commitUrl, 'json', allowed, state);
	const commit = JSON.parse(commitBytes.toString('utf8')) as {
		sha?: string;
		tree?: { sha?: string };
	};
	if (commit.sha !== commitSha || !lowerHex40.test(commit.tree?.sha ?? ''))
		throw new Error('Excalidraw commit/tree identity differs');
	const treeUrl = withQuery(joinURL(apiRoot, 'trees', commit.tree!.sha!), { recursive: '1' });
	allowed.add(treeUrl);
	const treeBytes = await getExact(treeUrl, 'json', allowed, state);
	const tree = JSON.parse(treeBytes.toString('utf8')) as {
		sha?: string;
		truncated?: boolean;
		tree?: TreeRow[];
	};
	if (tree.sha !== commit.tree!.sha || tree.truncated !== false || !Array.isArray(tree.tree))
		throw new Error('Excalidraw tree response differs');
	const archiveUrl = joinURL(
		'https://codeload.github.com',
		'excalidraw',
		'excalidraw',
		'tar.gz',
		commitSha!,
	);
	allowed.add(archiveUrl);
	const archive = await getExact(archiveUrl, 'binary', allowed, state);
	const archivePath = join(acquisition, 'source.tar.gz');
	await writeFile(archivePath, archive, { flag: 'wx' });
	const listing = await execute('/usr/bin/tar', ['-tzf', archivePath]);
	assertExcalidrawArchiveEntries(listing.split('\n').filter(Boolean));
	await execute('/usr/bin/tar', ['-xzf', archivePath, '-C', source, '--strip-components=1']);
	const treeByPath = new Map(
		tree.tree.filter((row) => row.type === 'blob').map((row) => [row.path, row]),
	);
	const manifest = await Promise.all(
		(await filesBelow(source)).map(async (file) => {
			const bytes = await readFile(file);
			const path = relative(source, file);
			const expected = treeByPath.get(path);
			if (!expected || expected.size !== bytes.length || expected.sha !== gitBlobSha(bytes))
				throw new Error(`Excalidraw archive/tree identity differs: ${path}`);
			return { path, bytes: bytes.length, sha256: sha256(bytes), gitSha: expected.sha };
		}),
	);
	if (manifest.length !== treeByPath.size)
		throw new Error('Excalidraw complete source manifest differs');
	const packageDocument = JSON.parse(await readFile(join(source, 'package.json'), 'utf8')) as {
		dependencies?: Record<string, string>;
		devDependencies?: Record<string, string>;
		scripts?: Record<string, string>;
	};
	const reactVersion =
		packageDocument.dependencies?.react ?? packageDocument.devDependencies?.react;
	if (!reactVersion || (!reactVersion.includes('17.') && !reactVersion.includes('16.')))
		throw new Error('Excalidraw exact release is not React 16 or 17');
	if (!packageDocument.scripts?.build || !packageDocument.scripts.start)
		throw new Error('Excalidraw authentic local build/start path differs');
	const rootLicense = await readFile(join(source, 'LICENSE'), 'utf8');
	if (!rootLicense.includes('MIT License')) throw new Error('Excalidraw root license differs');
	const notices = manifest.filter((row) => {
		const name = basename(row.path).toLowerCase();
		return (
			row.path !== 'LICENSE' &&
			(name.includes('license') || name.includes('notice') || name.includes('copying'))
		);
	});
	const noticeAudits = await Promise.all(
		notices.map(async (notice) => {
			const text = await readFile(join(source, notice.path), 'utf8');
			const expression = text.includes('MIT License')
				? 'MIT'
				: text.includes('SIL OPEN FONT LICENSE')
					? 'OFL-1.1'
					: text.includes('Apache License')
						? 'Apache-2.0'
						: 'unknown';
			return { ...notice, expression };
		}),
	);
	if (noticeAudits.some((notice) => notice.expression === 'unknown'))
		throw new Error('Excalidraw contrary retained-asset license notice differs');
	const closure = analyzeExcalidrawYarnLock(await readFile(join(source, 'yarn.lock')));
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
	const yarnMetadataBytes = await getExact(fixture.yarnMetadataUrl, 'json', allowed, state);
	const yarnMetadata = JSON.parse(yarnMetadataBytes.toString('utf8')) as {
		version?: string;
		dist?: { tarball?: string; integrity?: string };
	};
	if (
		yarnMetadata.version !== fixture.yarnVersion ||
		!yarnMetadata.dist?.tarball ||
		!yarnMetadata.dist.integrity?.startsWith('sha512-')
	)
		throw new Error('Excalidraw Yarn tool identity differs');
	allowed.add(yarnMetadata.dist.tarball);
	const yarnTarball = await getExact(yarnMetadata.dist.tarball, 'binary', allowed, state);
	verifySri(yarnTarball, yarnMetadata.dist.integrity);
	await writeFile(join(acquisition, 'yarn-1.22.22.tgz'), yarnTarball, { flag: 'wx' });
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
		sha256(node18) !== fixture.baselineRuntime.sha256 ||
		sha256(node24) !== fixture.targetRuntime.sha256
	)
		throw new Error('Excalidraw established runtime identity differs');
	await writeFile(join(acquisition, 'node18.tar.gz'), node18, { flag: 'wx' });
	await writeFile(join(acquisition, 'node24.tar.gz'), node24, { flag: 'wx' });
	const lifecycle: Array<{ name: string; scripts: string[] }> = [];
	const nativeDependencies: string[] = [];
	for (const artifact of closure.artifacts) {
		const tarball = await readFile(join(mirror, artifact.mirror));
		const metadata = inspectNpmPackageTarball(tarball, [artifact.identity]);
		const scripts = metadata.lifecycleScripts.map((script) => script.name);
		if (scripts.length > 0) lifecycle.push({ name: metadata.name, scripts });
		if (
			metadata.nativeIndicators.bindingGyp ||
			metadata.nativeIndicators.gypfile === 'true' ||
			metadata.nativeIndicators.nodeGypDependency ||
			metadata.nativeIndicators.lifecycleMentionsNodeGyp
		)
			nativeDependencies.push(metadata.name);
	}
	const assets = manifest.filter((row) =>
		new Set([
			'.gif',
			'.ico',
			'.jpeg',
			'.jpg',
			'.png',
			'.svg',
			'.wasm',
			'.woff',
			'.woff2',
			'.map',
		]).has(extname(row.path).toLowerCase()),
	);
	const receipt = {
		schemaVersion: 'versionless.react-excalidraw-v011-ingest.v1',
		result: 'pass',
		consentId: EXCALIDRAW_CONSENT,
		source: {
			repository: fixture.repository,
			tag: fixture.tag,
			tagForm: tagRef.form,
			tagObject: tagRef.tagObjectSha,
			commit: commit.sha,
			tree: tree.sha,
			archiveSha256: sha256(archive),
			manifestDigest: sha256(canonicalize(manifest)),
			files: manifest.length,
			reactVersion,
		},
		closure,
		license: {
			expression: 'MIT',
			authorship: 'unknown',
			certification: false,
			retainedNotices: noticeAudits,
			contraryNotices: 0,
		},
		audit: { assets, lifecycle, nativeDependencies, serviceWorkerAllowed: false },
		tools: {
			yarn: { version: fixture.yarnVersion, sha256: sha256(yarnTarball) },
			baselineRuntime: fixture.baselineRuntime,
			targetRuntime: fixture.targetRuntime,
			vite: fixture.targetVite,
		},
		access: { ...state, redirects: 0, cookies: false, credentials: false },
		privacy: { sensitiveData: false, hostPaths: false },
		nonclaims: [
			'not certification',
			'signer authenticity not established',
			'OS-wide isolation not established',
		],
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
	await mkdir(dependencyEvidenceRoot, { recursive: true });
	await writeFile(
		join(dependencyEvidenceRoot, 'receipt.json'),
		`${canonicalize({ schemaVersion: 'versionless.react-excalidraw-v011-dependencies.v1', closure, audit: { lifecycle, nativeDependencies }, sourceReceipt: receipt.integrity.canonicalDigest })}\n`,
		{ flag: 'wx' },
	);
	const first = await verifyExcalidrawIngest();
	const second = await verifyExcalidrawIngest();
	if (first.digest !== second.digest) throw new Error('Excalidraw offline replay differs');
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	assertExcalidrawConsent(args);
	try {
		await acquireExcalidraw();
		process.stdout.write(
			`${canonicalize({ result: 'pass', consentId: EXCALIDRAW_CONSENT })}\n`,
		);
	} catch (error) {
		await rm(stageRoot, { recursive: true, force: true });
		await rm(cacheRoot, { recursive: true, force: true });
		await rm(workRoot, { recursive: true, force: true });
		await rm(runRoot, { recursive: true, force: true });
		await rm(dependencyEvidenceRoot, { recursive: true, force: true });
		await rm(join(evidenceRoot, 'receipt.json'), { force: true });
		if (await exists(attemptPath))
			await sealFailure(error instanceof Error ? error.message : String(error));
		throw error;
	}
}

if (process.argv[1]?.endsWith('react-excalidraw-v011-ingest.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
