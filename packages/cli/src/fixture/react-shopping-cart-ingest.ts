import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { request } from 'node:https';
import { charIn, createRegExp } from 'magic-regexp';
import { basename, extname, join, relative, resolve } from 'pathe';
import { joinURL, parseURL, stringifyParsedURL, withQuery } from 'ufo';
import { canonicalize, inspectNpmPackageTarball, sha256 } from '../../../core/src/index.ts';
import { assertExcalidrawArchiveEntries } from './react-excalidraw-v011-ingest.ts';

export const SHOPPING_CART_CONSENT =
	'T566-official-source-react-shopping-cart-legacy-lock-production-pilot' as const;
export const REJECTED_SHOPPING_CART_CONSENT =
	'T565-official-source-react-shopping-cart-production-pilot' as const;
const hex40 = createRegExp(
	charIn('0123456789').from('a', 'f').times(40).at.lineStart().at.lineEnd(),
);
const root = resolve(import.meta.dirname, '../../../..');
const fixturePath = join(root, 'fixtures/react-shopping-cart/fixture.json');
const cacheRoot = join(root, '.versionless/cache/react-shopping-cart');
const stageRoot = join(root, '.versionless/stage/react-shopping-cart');
const workRoot = join(root, '.versionless/work/react-shopping-cart');
const runRoot = join(root, 'evidence/runs/react-shopping-cart');
const evidenceRoot = join(root, 'evidence/ingests/react-shopping-cart');
const dependenciesRoot = join(root, 'evidence/dependencies/react-shopping-cart');
const attemptPath = join(evidenceRoot, 'attempt-t566.json');
const failurePath = join(evidenceRoot, 'consumed-failed-t566.json');
const maxResponses = 2_500;
const maxBytes = 1_073_741_824;

type Fixture = {
	repository: string;
	repositoryUrl: string;
	candidateUrl: string;
	yarnMetadataUrl: string;
	yarnVersion: string;
	baselineRuntime: { version: string; sha256: string };
	targetRuntime: { version: string; sha256: string };
	targetVite: string;
};
type TreeRow = { path: string; mode: string; type: string; sha: string; size?: number };
type State = {
	responses: number;
	bytes: number;
	ledger: Array<{
		ordinal: number;
		url: string;
		media: 'json' | 'binary';
		bytes: number;
		sha256: string;
	}>;
};
type Candidate = {
	commit: string;
	tree: string;
	rows: TreeRow[];
	packageBytes: Buffer;
	lockBytes: Buffer;
	reactVersion: string;
	retainedNotices: Array<{ path: string; sha256: string; expression: string }>;
};
export type ShoppingCartArtifact = {
	url: string;
	placements: string[];
	identity: { name: string; version: string };
	sha1: string | null;
	sri: string | null;
	classification:
		| 'strong-modern'
		| 'historical-sha1-only'
		| 'missing-integrity-but-immutable-registry';
	mirror: string;
};
const qualificationReasons: Array<{ ordinal: number; commit: string; reasons: string[] }> = [];

const exists = (file: string): Promise<boolean> =>
	access(file).then(
		() => true,
		() => false,
	);
const compareText = (left: string, right: string): number =>
	left < right ? -1 : left > right ? 1 : 0;

export function assertShoppingCartConsent(args: string[]): void {
	if (
		args.length !== 3 ||
		args[0] !== '--acquire' ||
		args[1] !== '--consent-id' ||
		args[2] !== SHOPPING_CART_CONSENT ||
		process.env.VERSIONLESS_NETWORK_MODE !== 'consented' ||
		process.env.VERSIONLESS_CONSENT_ID !== SHOPPING_CART_CONSENT
	)
		throw new Error('Shopping Cart acquisition requires exact one-shot consent');
}

export function assertShoppingCartUrl(url: string, allowed: ReadonlySet<string>): void {
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
		throw new Error('Shopping Cart URL is outside exact consent');
}

function quoted(line: string, prefix: string): string {
	if (!line.startsWith(prefix) || !line.endsWith('"'))
		throw new Error('Shopping Cart Yarn lock field is malformed');
	return line.slice(prefix.length, -1);
}

function normalizeSelector(selector: string): string {
	return selector.startsWith('"') && selector.endsWith('"') ? selector.slice(1, -1) : selector;
}

export function analyzeLegacyShoppingCartYarnLock(bytes: Buffer): {
	artifacts: ShoppingCartArtifact[];
	placements: number;
	weaknessCounts: Record<ShoppingCartArtifact['classification'], number>;
	digest: string;
} {
	const text = bytes.toString('utf8');
	if (!text.includes('# yarn lockfile v1'))
		throw new Error('Shopping Cart requires Yarn lock v1');
	const artifacts = new Map<string, ShoppingCartArtifact>();
	let selectors: string[] = [];
	let version: string | undefined;
	let resolved: string | undefined;
	let integrity: string | undefined;
	let placements = 0;
	const flush = (): void => {
		if (
			!selectors.length &&
			version === undefined &&
			resolved === undefined &&
			integrity === undefined
		)
			return;
		if (!selectors.length || !version || !resolved)
			throw new Error('Shopping Cart Yarn lock immutable fields differ');
		const parsed = parseURL(resolved);
		const sha1 = parsed.hash ? parsed.hash.slice(1) : null;
		parsed.hash = '';
		const url = stringifyParsedURL(parsed);
		const parts = parsed.pathname.split('/').filter(Boolean);
		const marker = parts.indexOf('-');
		const name = decodeURIComponent(parts.slice(0, marker).join('/'));
		const validSri =
			integrity?.startsWith('sha512-') === true &&
			Buffer.from(integrity.slice('sha512-'.length), 'base64').length === 64;
		if (
			parsed.protocol !== 'https:' ||
			!['registry.npmjs.org', 'registry.yarnpkg.com'].includes(parsed.host ?? '') ||
			parsed.auth ||
			parsed.search ||
			!parsed.pathname.endsWith('.tgz') ||
			!basename(parsed.pathname).endsWith(`-${version}.tgz`) ||
			marker < 1 ||
			!name ||
			(sha1 !== null && !hex40.test(sha1)) ||
			(integrity !== undefined && !validSri) ||
			(sha1 === null && !validSri) ||
			!selectors.some((selector) => normalizeSelector(selector).startsWith(`${name}@`))
		)
			throw new Error('Shopping Cart Yarn lock origin/package/version/checksum is ambiguous');
		const classification: ShoppingCartArtifact['classification'] = validSri
			? 'strong-modern'
			: sha1
				? 'historical-sha1-only'
				: 'missing-integrity-but-immutable-registry';
		placements += selectors.length;
		const artifact: ShoppingCartArtifact = {
			url,
			placements: [...selectors],
			identity: { name, version },
			sha1,
			sri: validSri ? integrity! : null,
			classification,
			mirror: `${sha256(url)}.tgz`,
		};
		const prior = artifacts.get(url);
		if (
			prior &&
			canonicalize({ ...prior, placements: [] }) !==
				canonicalize({ ...artifact, placements: [] })
		)
			throw new Error('Shopping Cart Yarn lock duplicate conflict');
		if (prior) prior.placements.push(...selectors);
		else artifacts.set(url, artifact);
		selectors = [];
		version = undefined;
		resolved = undefined;
		integrity = undefined;
	};
	for (const line of text.split('\n')) {
		if (line && !line.startsWith(' ') && line.endsWith(':')) {
			flush();
			selectors = line.slice(0, -1).split(', ');
		} else if (line.startsWith('  version "')) version = quoted(line, '  version "');
		else if (line.startsWith('  resolved "')) resolved = quoted(line, '  resolved "');
		else if (line.startsWith('  integrity ')) integrity = line.slice('  integrity '.length);
	}
	flush();
	const ordered = [...artifacts.values()].sort((left, right) => compareText(left.url, right.url));
	if (ordered.length < 100 || ordered.length > maxResponses - 20)
		throw new Error('Shopping Cart Yarn closure cardinality differs');
	const weaknessCounts = {
		'strong-modern': ordered.filter((row) => row.classification === 'strong-modern').length,
		'historical-sha1-only': ordered.filter(
			(row) => row.classification === 'historical-sha1-only',
		).length,
		'missing-integrity-but-immutable-registry': ordered.filter(
			(row) => row.classification === 'missing-integrity-but-immutable-registry',
		).length,
	};
	return {
		artifacts: ordered,
		placements,
		weaknessCounts,
		digest: sha256(canonicalize(ordered)),
	};
}

export function decodeShoppingCartBlob(
	value: unknown,
	expected: { sha: string; size: number },
): Buffer {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error('Shopping Cart Git blob response differs');
	const row = value as { sha?: unknown; size?: unknown; encoding?: unknown; content?: unknown };
	if (
		row.sha !== expected.sha ||
		row.size !== expected.size ||
		row.encoding !== 'base64' ||
		typeof row.content !== 'string'
	)
		throw new Error('Shopping Cart Git blob identity differs');
	const bytes = Buffer.from(row.content, 'base64');
	if (bytes.length !== expected.size || gitBlobSha(bytes) !== expected.sha)
		throw new Error('Shopping Cart reconstructed Git blob differs');
	return bytes;
}

function gitBlobSha(bytes: Buffer): string {
	return createHash('sha1')
		.update(Buffer.from(`blob ${bytes.length}\0`))
		.update(bytes)
		.digest('hex');
}
function verifySri(bytes: Buffer, integrity: string): void {
	if (createHash('sha512').update(bytes).digest('base64') !== integrity.slice('sha512-'.length))
		throw new Error('Shopping Cart artifact integrity differs');
}
function verifyLegacyArtifact(bytes: Buffer, artifact: ShoppingCartArtifact): void {
	if (artifact.sha1 && createHash('sha1').update(bytes).digest('hex') !== artifact.sha1)
		throw new Error('Shopping Cart historical SHA-1 differs');
	if (artifact.sri) verifySri(bytes, artifact.sri);
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
		else throw new Error('Shopping Cart source contains a special filesystem entry');
	}
	return result.sort(compareText);
}
async function getExact(
	url: string,
	media: 'json' | 'binary',
	allowed: ReadonlySet<string>,
	state: State,
): Promise<Buffer> {
	assertShoppingCartUrl(url, allowed);
	if (state.responses >= maxResponses) throw new Error('Shopping Cart response cap exceeded');
	const ordinal = state.responses + 1;
	state.responses += 1;
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
					'user-agent': 'versionless-t565',
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
					reject(new Error('Shopping Cart response boundary differs'));
					return;
				}
				const chunks: Buffer[] = [];
				let bytes = 0;
				response.on('data', (chunk: Buffer) => {
					bytes += chunk.length;
					if (state.bytes + bytes > maxBytes)
						call.destroy(new Error('Shopping Cart byte cap exceeded'));
					else chunks.push(chunk);
				});
				response.once('end', () => {
					const body = Buffer.concat(chunks);
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
async function getBlob(
	row: TreeRow,
	apiRoot: string,
	allowed: Set<string>,
	state: State,
): Promise<Buffer> {
	if (row.type !== 'blob' || row.size === undefined || !hex40.test(row.sha))
		throw new Error('Shopping Cart tree blob identity differs');
	const url = joinURL(apiRoot, 'blobs', row.sha);
	allowed.add(url);
	return decodeShoppingCartBlob(
		JSON.parse((await getExact(url, 'json', allowed, state)).toString('utf8')),
		{ sha: row.sha, size: row.size },
	);
}

async function qualify(
	ordinal: number,
	commitSha: string,
	apiRoot: string,
	allowed: Set<string>,
	state: State,
): Promise<Candidate | null> {
	const commitUrl = joinURL(apiRoot, 'commits', commitSha);
	allowed.add(commitUrl);
	const commit = JSON.parse(
		(await getExact(commitUrl, 'json', allowed, state)).toString('utf8'),
	) as { sha?: string; tree?: { sha?: string } };
	if (commit.sha !== commitSha || !hex40.test(commit.tree?.sha ?? ''))
		throw new Error('Shopping Cart commit identity differs');
	const treeUrl = withQuery(joinURL(apiRoot, 'trees', commit.tree!.sha!), { recursive: '1' });
	allowed.add(treeUrl);
	const tree = JSON.parse((await getExact(treeUrl, 'json', allowed, state)).toString('utf8')) as {
		sha?: string;
		truncated?: boolean;
		tree?: TreeRow[];
	};
	if (tree.sha !== commit.tree!.sha || tree.truncated !== false || !Array.isArray(tree.tree))
		throw new Error('Shopping Cart tree identity differs');
	const byPath = new Map(tree.tree.map((row) => [row.path, row]));
	const packageRow = byPath.get('package.json');
	const licenseRow = byPath.get('LICENSE') ?? byPath.get('LICENSE.md');
	const lockRow = byPath.get('yarn.lock');
	if (!packageRow || !licenseRow || !lockRow) {
		qualificationReasons.push({
			ordinal,
			commit: commitSha,
			reasons: ['required-source-or-lock-absent'],
		});
		return null;
	}
	const [packageBytes, licenseBytes, lockBytes] = await Promise.all([
		getBlob(packageRow, apiRoot, allowed, state),
		getBlob(licenseRow, apiRoot, allowed, state),
		getBlob(lockRow, apiRoot, allowed, state),
	]);
	const packageDocument = JSON.parse(packageBytes.toString('utf8')) as {
		dependencies?: Record<string, string>;
		devDependencies?: Record<string, string>;
		scripts?: Record<string, string>;
	};
	const reactVersion =
		packageDocument.dependencies?.react ?? packageDocument.devDependencies?.react;
	if (
		(!reactVersion?.includes('16.') && !reactVersion?.includes('17.')) ||
		!packageDocument.scripts?.build ||
		!packageDocument.scripts.start ||
		!licenseBytes.toString('utf8').includes('MIT License')
	) {
		qualificationReasons.push({
			ordinal,
			commit: commitSha,
			reasons: ['react-license-or-build-gate-failed'],
		});
		return null;
	}
	try {
		analyzeLegacyShoppingCartYarnLock(lockBytes);
	} catch (error) {
		qualificationReasons.push({
			ordinal,
			commit: commitSha,
			reasons: [error instanceof Error ? error.message : 'legacy-lock-gate-failed'],
		});
		return null;
	}
	const noticeRows = tree.tree.filter((row) => {
		const name = basename(row.path).toLowerCase();
		return (
			row.path !== licenseRow.path &&
			row.type === 'blob' &&
			(name.includes('license') || name.includes('notice') || name.includes('copying'))
		);
	});
	const retainedNotices = await Promise.all(
		noticeRows.map(async (row) => {
			const bytes = await getBlob(row, apiRoot, allowed, state);
			const text = bytes.toString('utf8');
			const expression = text.includes('MIT License')
				? 'MIT'
				: text.includes('SIL OPEN FONT LICENSE')
					? 'OFL-1.1'
					: text.includes('Apache License')
						? 'Apache-2.0'
						: 'unknown';
			return { path: row.path, sha256: sha256(bytes), expression };
		}),
	);
	if (retainedNotices.some((row) => row.expression === 'unknown')) {
		qualificationReasons.push({
			ordinal,
			commit: commitSha,
			reasons: ['retained-asset-license-unknown'],
		});
		return null;
	}
	return {
		commit: commitSha,
		tree: tree.sha!,
		rows: tree.tree,
		packageBytes,
		lockBytes,
		reactVersion,
		retainedNotices,
	};
}

async function sealFailure(message: string): Promise<void> {
	if (await exists(failurePath)) return;
	const receipt = {
		schemaVersion: 'versionless.react-shopping-cart-consumed-failed.v1',
		result: 'consumed-failed',
		consentId: SHOPPING_CART_CONSENT,
		retry: false,
		reusable: false,
		reason: message.includes('qualifying')
			? 'candidate-qualification-failed'
			: 'immutable-or-acquisition-gate-failed',
		counted: false,
		qualificationReasons,
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	receipt.integrity.canonicalDigest = sha256(canonicalize(receipt));
	await writeFile(failurePath, `${canonicalize(receipt)}\n`, { flag: 'wx' });
}

export async function verifyShoppingCartIngest(): Promise<{ valid: true; digest: string }> {
	const receipt = JSON.parse(await readFile(join(evidenceRoot, 'receipt.json'), 'utf8')) as {
		integrity?: { canonicalDigest?: string };
		source?: { manifestDigest?: string };
		closure?: {
			artifacts?: ShoppingCartArtifact[];
			digest?: string;
			strongManifest?: Array<{ url: string; sha256: string; sha512: string; bytes: number }>;
			strongManifestDigest?: string;
		};
	};
	const copy = structuredClone(receipt);
	copy.integrity!.canonicalDigest = '';
	if (sha256(canonicalize(copy)) !== receipt.integrity?.canonicalDigest)
		throw new Error('Shopping Cart receipt digest differs');
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
		throw new Error('Shopping Cart source replay differs');
	const strongByUrl = new Map(
		(receipt.closure?.strongManifest ?? []).map((row) => [row.url, row]),
	);
	for (const artifact of receipt.closure?.artifacts ?? []) {
		const bytes = await readFile(join(cacheRoot, 'mirror', artifact.mirror));
		verifyLegacyArtifact(bytes, artifact);
		inspectNpmPackageTarball(bytes, [artifact.identity]);
		const strong = strongByUrl.get(artifact.url);
		if (
			!strong ||
			strong.bytes !== bytes.length ||
			strong.sha256 !== sha256(bytes) ||
			strong.sha512 !== createHash('sha512').update(bytes).digest('hex')
		)
			throw new Error('Shopping Cart strong target manifest differs');
	}
	if (sha256(canonicalize(receipt.closure?.artifacts)) !== receipt.closure?.digest)
		throw new Error('Shopping Cart closure replay differs');
	if (
		sha256(canonicalize(receipt.closure?.strongManifest)) !==
		receipt.closure?.strongManifestDigest
	)
		throw new Error('Shopping Cart strong target manifest digest differs');
	return { valid: true, digest: receipt.integrity!.canonicalDigest! };
}

export async function acquireShoppingCart(): Promise<void> {
	for (const target of [
		cacheRoot,
		stageRoot,
		workRoot,
		runRoot,
		dependenciesRoot,
		attemptPath,
		failurePath,
	])
		if (await exists(target)) throw new Error('Shopping Cart acquisition requires fresh roots');
	await mkdir(evidenceRoot, { recursive: true });
	await writeFile(
		attemptPath,
		`${canonicalize({ schemaVersion: 'versionless.react-shopping-cart-attempt.v1', consentId: SHOPPING_CART_CONSENT, invoked: true })}\n`,
		{ flag: 'wx' },
	);
	const fixture = JSON.parse(await readFile(fixturePath, 'utf8')) as Fixture;
	const acquisition = join(stageRoot, 'acquisition');
	const source = join(acquisition, 'source');
	const mirror = join(acquisition, 'mirror');
	await mkdir(source, { recursive: true });
	await mkdir(mirror, { recursive: true });
	const allowed = new Set([fixture.repositoryUrl, fixture.candidateUrl, fixture.yarnMetadataUrl]);
	const state: State = { responses: 0, bytes: 0, ledger: [] };
	const repository = JSON.parse(
		(await getExact(fixture.repositoryUrl, 'json', allowed, state)).toString('utf8'),
	) as { id?: number; full_name?: string; html_url?: string };
	if (
		!Number.isSafeInteger(repository.id) ||
		repository.full_name !== 'jeffersonRibeiro/react-shopping-cart' ||
		repository.html_url !== fixture.repository
	)
		throw new Error('Shopping Cart canonical repository identity differs');
	const candidates = JSON.parse(
		(await getExact(fixture.candidateUrl, 'json', allowed, state)).toString('utf8'),
	) as Array<{ sha?: string }>;
	if (
		!Array.isArray(candidates) ||
		candidates.length !== 2 ||
		candidates.some((row) => !hex40.test(row.sha ?? ''))
	)
		throw new Error('Shopping Cart candidate revision boundary differs');
	const apiRoot = joinURL(
		'https://api.github.com',
		'repos',
		'jeffersonRibeiro',
		'react-shopping-cart',
		'git',
	);
	let selected: Candidate | null = null;
	for (let index = 0; index < candidates.length; index += 1) {
		const row = candidates[index]!;
		selected = await qualify(index + 1, row.sha!, apiRoot, allowed, state);
		if (selected) break;
	}
	if (!selected)
		throw new Error(
			'No qualifying Shopping Cart revision exists within two official revisions',
		);
	const archiveUrl = joinURL(
		'https://codeload.github.com',
		'jeffersonRibeiro',
		'react-shopping-cart',
		'tar.gz',
		selected.commit,
	);
	allowed.add(archiveUrl);
	const archive = await getExact(archiveUrl, 'binary', allowed, state);
	const archivePath = join(acquisition, 'source.tar.gz');
	await writeFile(archivePath, archive, { flag: 'wx' });
	assertExcalidrawArchiveEntries(
		(await execute('/usr/bin/tar', ['-tzf', archivePath])).split('\n').filter(Boolean),
	);
	await execute('/usr/bin/tar', ['-xzf', archivePath, '-C', source, '--strip-components=1']);
	const treeByPath = new Map(
		selected.rows.filter((row) => row.type === 'blob').map((row) => [row.path, row]),
	);
	const manifest = await Promise.all(
		(await filesBelow(source)).map(async (file) => {
			const bytes = await readFile(file);
			const path = relative(source, file);
			const expected = treeByPath.get(path);
			if (!expected || expected.size !== bytes.length || expected.sha !== gitBlobSha(bytes))
				throw new Error(`Shopping Cart archive/tree differs: ${path}`);
			return { path, bytes: bytes.length, sha256: sha256(bytes), gitSha: expected.sha };
		}),
	);
	if (
		manifest.length !== treeByPath.size ||
		!(await readFile(join(source, 'package.json'))).equals(selected.packageBytes) ||
		!(await readFile(join(source, 'yarn.lock'))).equals(selected.lockBytes)
	)
		throw new Error('Shopping Cart archive/blob equality differs');
	const legacyClosure = analyzeLegacyShoppingCartYarnLock(selected.lockBytes);
	if (legacyClosure.artifacts.length > maxResponses - state.responses - 2)
		throw new Error('Shopping Cart response cap cannot contain closure');
	for (const artifact of legacyClosure.artifacts) allowed.add(artifact.url);
	const strongManifest: Array<{ url: string; sha256: string; sha512: string; bytes: number }> =
		[];
	for (let offset = 0; offset < legacyClosure.artifacts.length; offset += 8) {
		const batch = legacyClosure.artifacts.slice(offset, offset + 8);
		const bodies = await Promise.all(
			batch.map((artifact) => getExact(artifact.url, 'binary', allowed, state)),
		);
		for (let index = 0; index < batch.length; index += 1) {
			const artifact = batch[index]!;
			const body = bodies[index]!;
			verifyLegacyArtifact(body, artifact);
			inspectNpmPackageTarball(body, [artifact.identity]);
			await writeFile(join(mirror, artifact.mirror), body, { flag: 'wx' });
			strongManifest.push({
				url: artifact.url,
				sha256: sha256(body),
				sha512: createHash('sha512').update(body).digest('hex'),
				bytes: body.length,
			});
		}
	}
	strongManifest.sort((left, right) => compareText(left.url, right.url));
	const closure = {
		...legacyClosure,
		strongManifest,
		strongManifestDigest: sha256(canonicalize(strongManifest)),
	};
	const yarnMetadata = JSON.parse(
		(await getExact(fixture.yarnMetadataUrl, 'json', allowed, state)).toString('utf8'),
	) as { version?: string; dist?: { tarball?: string; integrity?: string } };
	if (
		yarnMetadata.version !== fixture.yarnVersion ||
		!yarnMetadata.dist?.tarball ||
		!yarnMetadata.dist.integrity?.startsWith('sha512-')
	)
		throw new Error('Shopping Cart Yarn identity differs');
	allowed.add(yarnMetadata.dist.tarball);
	const yarnTarball = await getExact(yarnMetadata.dist.tarball, 'binary', allowed, state);
	verifySri(yarnTarball, yarnMetadata.dist.integrity);
	await writeFile(join(acquisition, 'yarn-1.22.22.tgz'), yarnTarball, { flag: 'wx' });
	const node18 = await readFile(
		join(
			root,
			'.versionless/cache/angular-realworld-v15/closures/d3576ef3443079903aa0fa2c2337fbf8fcab88fdfeea3ff5b8de03e99587b8f9/node-runtime.tar.gz',
		),
	);
	const node24 = await readFile(
		join(
			root,
			'.versionless/cache/react-boilerplate-v4-node24/node-v24.15.0-darwin-arm64.tar.gz',
		),
	);
	if (
		sha256(node18) !== fixture.baselineRuntime.sha256 ||
		sha256(node24) !== fixture.targetRuntime.sha256
	)
		throw new Error('Shopping Cart established runtime identity differs');
	await writeFile(join(acquisition, 'node18.tar.gz'), node18, { flag: 'wx' });
	await writeFile(join(acquisition, 'node24.tar.gz'), node24, { flag: 'wx' });
	const metadata = [];
	for (const artifact of legacyClosure.artifacts)
		metadata.push(
			inspectNpmPackageTarball(await readFile(join(mirror, artifact.mirror)), [
				artifact.identity,
			]),
		);
	const audit = {
		lifecycle: metadata.flatMap((row) =>
			row.lifecycleScripts.map((script) => ({
				package: row.name,
				script: script.name,
				state: script.state,
			})),
		),
		nativeDependencies: metadata
			.filter(
				(row) =>
					row.nativeIndicators.bindingGyp ||
					row.nativeIndicators.gypfile === 'true' ||
					row.nativeIndicators.nodeGypDependency ||
					row.nativeIndicators.lifecycleMentionsNodeGyp,
			)
			.map((row) => row.name),
		assets: manifest.filter((row) =>
			new Set([
				'.gif',
				'.ico',
				'.jpeg',
				'.jpg',
				'.png',
				'.svg',
				'.woff',
				'.woff2',
				'.map',
			]).has(extname(row.path).toLowerCase()),
		),
		serviceWorkerAllowed: false,
	};
	const receipt = {
		schemaVersion: 'versionless.react-shopping-cart-ingest.v1',
		result: 'pass',
		consentId: SHOPPING_CART_CONSENT,
		repository: { id: repository.id, fullName: repository.full_name, url: fixture.repository },
		source: {
			commit: selected.commit,
			tree: selected.tree,
			archiveSha256: sha256(archive),
			manifestDigest: sha256(canonicalize(manifest)),
			files: manifest.length,
			reactVersion: selected.reactVersion,
			candidateLimit: 2,
		},
		closure,
		license: {
			expression: 'MIT',
			retainedNotices: selected.retainedNotices,
			authorship: 'unknown',
			certification: false,
		},
		qualificationReasons,
		audit,
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
			'historical runtime not executed',
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
	await mkdir(dependenciesRoot, { recursive: true });
	await writeFile(
		join(dependenciesRoot, 'receipt.json'),
		`${canonicalize({ schemaVersion: 'versionless.react-shopping-cart-dependencies.v1', closure, audit, sourceReceipt: receipt.integrity.canonicalDigest })}\n`,
		{ flag: 'wx' },
	);
	const first = await verifyShoppingCartIngest();
	const second = await verifyShoppingCartIngest();
	if (first.digest !== second.digest) throw new Error('Shopping Cart offline replay differs');
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	assertShoppingCartConsent(args);
	try {
		await acquireShoppingCart();
		process.stdout.write(
			`${canonicalize({ result: 'pass', consentId: SHOPPING_CART_CONSENT })}\n`,
		);
	} catch (error) {
		await rm(stageRoot, { recursive: true, force: true });
		await rm(cacheRoot, { recursive: true, force: true });
		await rm(workRoot, { recursive: true, force: true });
		await rm(runRoot, { recursive: true, force: true });
		await rm(dependenciesRoot, { recursive: true, force: true });
		await rm(join(evidenceRoot, 'receipt.json'), { force: true });
		if (await exists(attemptPath))
			await sealFailure(error instanceof Error ? error.message : String(error));
		throw error;
	}
}

if (process.argv[1]?.endsWith('react-shopping-cart-ingest.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
