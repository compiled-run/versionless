import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { request } from 'node:https';
import { charIn, createRegExp } from 'magic-regexp';
import { basename, extname, join, relative, resolve } from 'pathe';
import { joinURL, parseURL, withQuery } from 'ufo';
import { canonicalize, inspectNpmPackageTarball, sha256 } from '../../../core/src/index.ts';
import { assertExcalidrawArchiveEntries } from './react-excalidraw-v011-ingest.ts';
import {
	analyzeLegacyShoppingCartYarnLock,
	type ShoppingCartArtifact,
} from './react-shopping-cart-ingest.ts';

export const REACT_TETRIS_CONSENT = 'T567-official-source-react-tetris-production-pilot' as const;
const hex40 = createRegExp(
	charIn('0123456789').from('a', 'f').times(40).at.lineStart().at.lineEnd(),
);
const root = resolve(import.meta.dirname, '../../../..');
const fixturePath = join(root, 'fixtures/react-tetris/fixture.json');
const cacheRoot = join(root, '.versionless/cache/react-tetris');
const stageRoot = join(root, '.versionless/stage/react-tetris');
const workRoot = join(root, '.versionless/work/react-tetris');
const runRoot = join(root, 'evidence/runs/react-tetris');
const evidenceRoot = join(root, 'evidence/ingests/react-tetris');
const dependenciesRoot = join(root, 'evidence/dependencies/react-tetris');
const attemptPath = join(evidenceRoot, 'attempt.json');
const failurePath = join(evidenceRoot, 'consumed-failed.json');
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
	targetReact: string;
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
const qualificationReasons: Array<{ ordinal: number; commit: string; reasons: string[] }> = [];

const exists = (file: string): Promise<boolean> =>
	access(file).then(
		() => true,
		() => false,
	);
const compareText = (left: string, right: string): number =>
	left < right ? -1 : left > right ? 1 : 0;

export function assertReactTetrisConsent(args: string[]): void {
	if (
		args.length !== 3 ||
		args[0] !== '--acquire' ||
		args[1] !== '--consent-id' ||
		args[2] !== REACT_TETRIS_CONSENT ||
		process.env.VERSIONLESS_NETWORK_MODE !== 'consented' ||
		process.env.VERSIONLESS_CONSENT_ID !== REACT_TETRIS_CONSENT
	)
		throw new Error('React Tetris acquisition requires exact one-shot consent');
}
export function assertReactTetrisUrl(url: string, allowed: ReadonlySet<string>): void {
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
		throw new Error('React Tetris URL is outside exact consent');
}
export function decodeReactTetrisBlob(
	value: unknown,
	expected: { sha: string; size: number },
): Buffer {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error('React Tetris Git blob response differs');
	const row = value as { sha?: unknown; size?: unknown; encoding?: unknown; content?: unknown };
	if (
		row.sha !== expected.sha ||
		row.size !== expected.size ||
		row.encoding !== 'base64' ||
		typeof row.content !== 'string'
	)
		throw new Error('React Tetris Git blob identity differs');
	const bytes = Buffer.from(row.content, 'base64');
	if (bytes.length !== expected.size || gitBlobSha(bytes) !== expected.sha)
		throw new Error('React Tetris reconstructed Git blob differs');
	return bytes;
}
function gitBlobSha(bytes: Buffer): string {
	return createHash('sha1')
		.update(Buffer.from(`blob ${bytes.length}\0`))
		.update(bytes)
		.digest('hex');
}
function verifyArtifact(bytes: Buffer, artifact: ShoppingCartArtifact): void {
	if (artifact.sha1 && createHash('sha1').update(bytes).digest('hex') !== artifact.sha1)
		throw new Error('React Tetris historical SHA-1 differs');
	if (
		artifact.sri &&
		createHash('sha512').update(bytes).digest('base64') !== artifact.sri.slice('sha512-'.length)
	)
		throw new Error('React Tetris SRI differs');
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
		else throw new Error('React Tetris source contains a special filesystem entry');
	}
	return result.sort(compareText);
}
async function getExact(
	url: string,
	media: 'json' | 'binary',
	allowed: ReadonlySet<string>,
	state: State,
): Promise<Buffer> {
	assertReactTetrisUrl(url, allowed);
	if (state.responses >= maxResponses) throw new Error('React Tetris response cap exceeded');
	const ordinal = ++state.responses;
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
					'user-agent': 'versionless-t567',
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
					reject(new Error('React Tetris response boundary differs'));
					return;
				}
				const chunks: Buffer[] = [];
				let bytes = 0;
				response.on('data', (chunk: Buffer) => {
					bytes += chunk.length;
					if (state.bytes + bytes > maxBytes)
						call.destroy(new Error('React Tetris byte cap exceeded'));
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
		throw new Error('React Tetris tree blob identity differs');
	const url = joinURL(apiRoot, 'blobs', row.sha);
	allowed.add(url);
	return decodeReactTetrisBlob(
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
	const reject = (reason: string): null => {
		qualificationReasons.push({ ordinal, commit: commitSha, reasons: [reason] });
		return null;
	};
	const commitUrl = joinURL(apiRoot, 'commits', commitSha);
	allowed.add(commitUrl);
	const commit = JSON.parse(
		(await getExact(commitUrl, 'json', allowed, state)).toString('utf8'),
	) as { sha?: string; tree?: { sha?: string } };
	if (commit.sha !== commitSha || !hex40.test(commit.tree?.sha ?? ''))
		throw new Error('React Tetris commit identity differs');
	const treeUrl = withQuery(joinURL(apiRoot, 'trees', commit.tree!.sha!), { recursive: '1' });
	allowed.add(treeUrl);
	const tree = JSON.parse((await getExact(treeUrl, 'json', allowed, state)).toString('utf8')) as {
		sha?: string;
		truncated?: boolean;
		tree?: TreeRow[];
	};
	if (tree.sha !== commit.tree!.sha || tree.truncated !== false || !Array.isArray(tree.tree))
		throw new Error('React Tetris tree identity differs');
	const byPath = new Map(tree.tree.map((row) => [row.path, row]));
	const packageRow = byPath.get('package.json');
	const licenseRow = byPath.get('LICENSE') ?? byPath.get('LICENSE.md');
	const lockRow = byPath.get('yarn.lock');
	if (!packageRow || !licenseRow || !lockRow) return reject('required-source-or-lock-absent');
	const [packageBytes, licenseBytes, lockBytes] = await Promise.all([
		getBlob(packageRow, apiRoot, allowed, state),
		getBlob(licenseRow, apiRoot, allowed, state),
		getBlob(lockRow, apiRoot, allowed, state),
	]);
	const pkg = JSON.parse(packageBytes.toString('utf8')) as {
		dependencies?: Record<string, string>;
		devDependencies?: Record<string, string>;
		scripts?: Record<string, string>;
	};
	const reactVersion = pkg.dependencies?.react ?? pkg.devDependencies?.react;
	if (
		(!reactVersion?.includes('15.') &&
			!reactVersion?.includes('16.') &&
			!reactVersion?.includes('17.')) ||
		!pkg.scripts?.build ||
		!(pkg.scripts.start || pkg.scripts.dev) ||
		!licenseBytes.toString('utf8').includes('MIT License')
	)
		return reject('react-license-or-build-gate-failed');
	try {
		analyzeLegacyShoppingCartYarnLock(lockBytes);
	} catch (error) {
		return reject(error instanceof Error ? error.message : 'legacy-lock-gate-failed');
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
	if (retainedNotices.some((row) => row.expression === 'unknown'))
		return reject('retained-asset-license-unknown');
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
		schemaVersion: 'versionless.react-tetris-consumed-failed.v1',
		result: 'consumed-failed',
		consentId: REACT_TETRIS_CONSENT,
		retry: false,
		reusable: false,
		reason: message.includes('qualifying')
			? 'candidate-qualification-failed'
			: 'immutable-or-acquisition-gate-failed',
		qualificationReasons,
		counted: false,
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	receipt.integrity.canonicalDigest = sha256(canonicalize(receipt));
	await writeFile(failurePath, `${canonicalize(receipt)}\n`, { flag: 'wx' });
}
export async function verifyReactTetrisIngest(): Promise<{ valid: true; digest: string }> {
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
		throw new Error('React Tetris receipt digest differs');
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
		throw new Error('React Tetris source replay differs');
	const strong = new Map((receipt.closure?.strongManifest ?? []).map((row) => [row.url, row]));
	for (const artifact of receipt.closure?.artifacts ?? []) {
		const bytes = await readFile(join(cacheRoot, 'mirror', artifact.mirror));
		verifyArtifact(bytes, artifact);
		inspectNpmPackageTarball(bytes, [artifact.identity]);
		const row = strong.get(artifact.url);
		if (
			!row ||
			row.bytes !== bytes.length ||
			row.sha256 !== sha256(bytes) ||
			row.sha512 !== createHash('sha512').update(bytes).digest('hex')
		)
			throw new Error('React Tetris strong manifest differs');
	}
	if (
		sha256(canonicalize(receipt.closure?.artifacts)) !== receipt.closure?.digest ||
		sha256(canonicalize(receipt.closure?.strongManifest)) !==
			receipt.closure?.strongManifestDigest
	)
		throw new Error('React Tetris closure replay differs');
	return { valid: true, digest: receipt.integrity!.canonicalDigest! };
}

export async function acquireReactTetris(): Promise<void> {
	for (const target of [
		cacheRoot,
		stageRoot,
		workRoot,
		runRoot,
		dependenciesRoot,
		attemptPath,
		failurePath,
	])
		if (await exists(target)) throw new Error('React Tetris acquisition requires fresh roots');
	await mkdir(evidenceRoot, { recursive: true });
	await writeFile(
		attemptPath,
		`${canonicalize({ schemaVersion: 'versionless.react-tetris-attempt.v1', consentId: REACT_TETRIS_CONSENT, invoked: true })}\n`,
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
	const repo = JSON.parse(
		(await getExact(fixture.repositoryUrl, 'json', allowed, state)).toString('utf8'),
	) as { id?: number; full_name?: string; html_url?: string };
	if (
		!Number.isSafeInteger(repo.id) ||
		repo.full_name !== 'chvin/react-tetris' ||
		repo.html_url !== fixture.repository
	)
		throw new Error('React Tetris repository identity differs');
	const candidates = JSON.parse(
		(await getExact(fixture.candidateUrl, 'json', allowed, state)).toString('utf8'),
	) as Array<{ sha?: string }>;
	if (
		!Array.isArray(candidates) ||
		candidates.length !== 2 ||
		candidates.some((row) => !hex40.test(row.sha ?? ''))
	)
		throw new Error('React Tetris candidate boundary differs');
	const apiRoot = joinURL('https://api.github.com', 'repos', 'chvin', 'react-tetris', 'git');
	let selected: Candidate | null = null;
	for (let index = 0; index < candidates.length; index += 1) {
		selected = await qualify(index + 1, candidates[index]!.sha!, apiRoot, allowed, state);
		if (selected) break;
	}
	if (!selected)
		throw new Error('No qualifying React Tetris revision exists within two official revisions');
	const archiveUrl = joinURL(
		'https://codeload.github.com',
		'chvin',
		'react-tetris',
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
	const byPath = new Map(
		selected.rows.filter((row) => row.type === 'blob').map((row) => [row.path, row]),
	);
	const manifest = await Promise.all(
		(await filesBelow(source)).map(async (file) => {
			const bytes = await readFile(file);
			const path = relative(source, file);
			const expected = byPath.get(path);
			if (!expected || expected.size !== bytes.length || expected.sha !== gitBlobSha(bytes))
				throw new Error(`React Tetris archive/tree differs: ${path}`);
			return { path, bytes: bytes.length, sha256: sha256(bytes), gitSha: expected.sha };
		}),
	);
	if (
		manifest.length !== byPath.size ||
		!(await readFile(join(source, 'package.json'))).equals(selected.packageBytes) ||
		!(await readFile(join(source, 'yarn.lock'))).equals(selected.lockBytes)
	)
		throw new Error('React Tetris archive/blob equality differs');
	const legacy = analyzeLegacyShoppingCartYarnLock(selected.lockBytes);
	if (legacy.artifacts.length > maxResponses - state.responses - 2)
		throw new Error('React Tetris response cap cannot contain closure');
	for (const artifact of legacy.artifacts) allowed.add(artifact.url);
	const strongManifest: Array<{ url: string; sha256: string; sha512: string; bytes: number }> =
		[];
	for (let offset = 0; offset < legacy.artifacts.length; offset += 8) {
		const batch = legacy.artifacts.slice(offset, offset + 8);
		const bodies = await Promise.all(
			batch.map((artifact) => getExact(artifact.url, 'binary', allowed, state)),
		);
		for (let index = 0; index < batch.length; index += 1) {
			const artifact = batch[index]!;
			const bytes = bodies[index]!;
			verifyArtifact(bytes, artifact);
			inspectNpmPackageTarball(bytes, [artifact.identity]);
			await writeFile(join(mirror, artifact.mirror), bytes, { flag: 'wx' });
			strongManifest.push({
				url: artifact.url,
				sha256: sha256(bytes),
				sha512: createHash('sha512').update(bytes).digest('hex'),
				bytes: bytes.length,
			});
		}
	}
	strongManifest.sort((left, right) => compareText(left.url, right.url));
	const closure = {
		...legacy,
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
		throw new Error('React Tetris Yarn identity differs');
	allowed.add(yarnMetadata.dist.tarball);
	const yarnTarball = await getExact(yarnMetadata.dist.tarball, 'binary', allowed, state);
	if (
		createHash('sha512').update(yarnTarball).digest('base64') !==
		yarnMetadata.dist.integrity.slice('sha512-'.length)
	)
		throw new Error('React Tetris Yarn SRI differs');
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
		throw new Error('React Tetris runtime identity differs');
	await writeFile(join(acquisition, 'node18.tar.gz'), node18, { flag: 'wx' });
	await writeFile(join(acquisition, 'node24.tar.gz'), node24, { flag: 'wx' });
	const metadata = [];
	for (const artifact of legacy.artifacts)
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
				'.mp3',
				'.ogg',
				'.wav',
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
		schemaVersion: 'versionless.react-tetris-ingest.v1',
		result: 'pass',
		consentId: REACT_TETRIS_CONSENT,
		repository: { id: repo.id, fullName: repo.full_name, url: fixture.repository },
		source: {
			commit: selected.commit,
			tree: selected.tree,
			archiveSha256: sha256(archive),
			manifestDigest: sha256(canonicalize(manifest)),
			files: manifest.length,
			reactVersion: selected.reactVersion,
			candidateLimit: 2,
		},
		qualificationReasons,
		closure,
		license: {
			expression: 'MIT',
			retainedNotices: selected.retainedNotices,
			authorship: 'unknown',
			certification: false,
		},
		audit,
		tools: {
			yarn: { version: fixture.yarnVersion, sha256: sha256(yarnTarball) },
			baselineRuntime: fixture.baselineRuntime,
			targetRuntime: fixture.targetRuntime,
			react: fixture.targetReact,
			vite: fixture.targetVite,
		},
		access: { ...state, redirects: 0, cookies: false, credentials: false },
		privacy: { sensitiveData: false, hostPaths: false },
		deterministicSeam: {
			random: 'Witness pre-document override',
			time: 'Witness pre-document override',
			applicationSourceChanged: false,
		},
		nonclaims: [
			'not certification',
			'historical runtime not executed',
			'legacy lock not strong',
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
		`${canonicalize({ schemaVersion: 'versionless.react-tetris-dependencies.v1', closure, audit, sourceReceipt: receipt.integrity.canonicalDigest })}\n`,
		{ flag: 'wx' },
	);
	const first = await verifyReactTetrisIngest();
	const second = await verifyReactTetrisIngest();
	if (first.digest !== second.digest) throw new Error('React Tetris offline replay differs');
}
export async function main(args = process.argv.slice(2)): Promise<void> {
	assertReactTetrisConsent(args);
	try {
		await acquireReactTetris();
		process.stdout.write(
			`${canonicalize({ result: 'pass', consentId: REACT_TETRIS_CONSENT })}\n`,
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
if (process.argv[1]?.endsWith('react-tetris-ingest.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
