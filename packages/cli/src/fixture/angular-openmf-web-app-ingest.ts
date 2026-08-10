import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	access,
	lstat,
	mkdir,
	readFile,
	readdir,
	readlink,
	rename,
	writeFile,
} from 'node:fs/promises';
import { request } from 'node:https';
import { charIn, createRegExp, digit, maybe, oneOrMore } from 'magic-regexp';
import { basename, join, relative, resolve } from 'pathe';
import { joinURL, parseURL, withQuery } from 'ufo';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';

export const OPENMF_CONSENT = 'T673-openmf-web-app-source-acquisition' as const;
export const OPENMF_NAMESPACE = 't673' as const;

const repositoryRoot = resolve(import.meta.dirname, '../../../..');
const evidenceRoot = join(repositoryRoot, 'evidence/ingests/angular-openmf-web-app/t673');
const attemptPath = join(evidenceRoot, 'attempt.json');
const terminalPath = join(evidenceRoot, 'terminal.json');
const receiptPath = join(evidenceRoot, 'receipt.json');
const stageRoot = join(repositoryRoot, '.versionless/cache/angular-openmf-web-app-stage-t673');
const cacheRoot = join(repositoryRoot, '.versionless/cache/angular-openmf-web-app-source-t673');
const lowerHex40 = createRegExp(
	charIn('0123456789').from('a', 'f').times(40).at.lineStart().at.lineEnd(),
);
const stableSemver = createRegExp(
	maybe('v'),
	oneOrMore(digit),
	'.',
	oneOrMore(digit),
	'.',
	oneOrMore(digit).at.lineEnd(),
);
const maximumAcceptedResponses = 7_000;
const maximumApiBytes = 16 * 1024 * 1024;
const maximumArtifactBytes = 64 * 1024 * 1024;
const maximumArchiveBytes = 256 * 1024 * 1024;
const maximumAggregateBytes = 3 * 1024 * 1024 * 1024;
const requestTimeoutMilliseconds = 60_000;

type RefRow = Readonly<{
	ref: string;
	object: Readonly<{ type: 'commit' | 'tag'; sha: string }>;
}>;
type TreeRow = Readonly<{
	path: string;
	mode: string;
	type: string;
	sha: string;
	size?: number;
}>;
type Candidate = Readonly<{
	ref: string;
	version: readonly [number, number, number];
	commit: string;
	tree: string;
	commitDate: string;
}>;
type LedgerRow = Readonly<{
	ordinal: number;
	url: string;
	status: 200;
	bytes: number;
	sha256: string;
	sha512: string;
	zeroResponseAttempts: number;
}>;
type NetworkState = {
	acceptedResponses: number;
	aggregateBytes: number;
	ledger: LedgerRow[];
	transportAttempts: Array<{
		url: string;
		attempt: number;
		outcome: 'zero-response' | 'accepted';
	}>;
};

const compareText = (left: string, right: string): number =>
	left < right ? -1 : left > right ? 1 : 0;
const exists = (file: string): Promise<boolean> =>
	access(file).then(
		() => true,
		() => false,
	);

export function parseOpenMfLauncher(args: readonly string[]): {
	mode: 'acquire' | 'verify';
	namespace: typeof OPENMF_NAMESPACE;
} {
	if (args.at(-2) !== '--namespace' || args.at(-1) !== OPENMF_NAMESPACE)
		throw new Error('openMF namespace differs');
	const leading = args.slice(0, -2);
	if (
		leading.length === 2 &&
		leading[0] === '--consent-id' &&
		leading[1] === OPENMF_CONSENT &&
		process.env.VERSIONLESS_NETWORK_MODE === 'consented' &&
		process.env.VERSIONLESS_CONSENT_ID === OPENMF_CONSENT
	)
		return { mode: 'acquire', namespace: OPENMF_NAMESPACE };
	if (
		leading.length === 1 &&
		leading[0] === '--verify-offline' &&
		process.env.VERSIONLESS_NETWORK_MODE === 'offline' &&
		process.env.VERSIONLESS_CONSENT_ID === undefined
	)
		return { mode: 'verify', namespace: OPENMF_NAMESPACE };
	throw new Error('openMF launcher boundary differs');
}

export function parseOpenMfStableVersion(ref: string): readonly [number, number, number] | null {
	const prefix = 'refs/tags/';
	if (!ref.startsWith(prefix)) return null;
	const name = ref.slice(prefix.length);
	if (!stableSemver.test(name)) return null;
	const numeric = name.startsWith('v') ? name.slice(1) : name;
	const parts = numeric.split('.');
	if (parts.length !== 3 || parts.some((part) => part.length > 9)) return null;
	const version = parts.map(Number) as [number, number, number];
	if (version.some((part) => !Number.isSafeInteger(part))) return null;
	return version;
}

export function selectOpenMfCandidate(candidates: readonly Candidate[]): Candidate {
	const selected = [...candidates].sort(
		(left, right) =>
			right.version[0] - left.version[0] ||
			right.version[1] - left.version[1] ||
			right.version[2] - left.version[2] ||
			compareText(left.ref, right.ref),
	)[0];
	if (!selected) throw new Error('openMF stable 2019-2021 revision is absent');
	return selected;
}

function assertRequestUrl(url: string, kind: 'api' | 'archive' | 'artifact'): void {
	const parsed = parseURL(url);
	const expectedHost =
		kind === 'api'
			? 'api.github.com'
			: kind === 'archive'
				? 'codeload.github.com'
				: 'registry.npmjs.org';
	if (
		parsed.protocol !== 'https:' ||
		parsed.host !== expectedHost ||
		parsed.auth ||
		parsed.hash ||
		(kind !== 'api' && parsed.search)
	)
		throw new Error('openMF request is outside literal consent');
}

async function getExact(
	url: string,
	kind: 'api' | 'archive' | 'artifact',
	state: NetworkState,
): Promise<Buffer> {
	assertRequestUrl(url, kind);
	const cap =
		kind === 'api'
			? maximumApiBytes
			: kind === 'archive'
				? maximumArchiveBytes
				: maximumArtifactBytes;
	if (state.acceptedResponses >= maximumAcceptedResponses)
		throw new Error('openMF accepted-response cap exceeded');
	for (let attempt = 1; attempt <= 3; attempt += 1) {
		try {
			return await new Promise<Buffer>((resolvePromise, reject) => {
				let responseObserved = false;
				const call = request(
					url,
					{
						method: 'GET',
						headers: {
							accept:
								kind === 'api'
									? 'application/vnd.github+json'
									: 'application/octet-stream',
							'accept-encoding': 'identity',
							'user-agent': 'versionless-t673',
							'x-github-api-version': kind === 'api' ? '2022-11-28' : '',
							'x-versionless-consent-id': OPENMF_CONSENT,
						},
					},
					(response) => {
						responseObserved = true;
						state.transportAttempts.push({ url, attempt, outcome: 'accepted' });
						if (
							response.statusCode !== 200 ||
							response.headers.location !== undefined ||
							response.headers['set-cookie'] !== undefined ||
							(response.headers['content-encoding'] ?? 'identity') !== 'identity'
						) {
							response.destroy();
							reject(new Error(`openMF accepted response boundary differs: ${url}`));
							return;
						}
						const chunks: Buffer[] = [];
						let bytes = 0;
						response.on('data', (chunk: Buffer) => {
							bytes += chunk.byteLength;
							if (bytes > cap || state.aggregateBytes + bytes > maximumAggregateBytes)
								response.destroy(new Error('openMF acquisition byte cap exceeded'));
							else chunks.push(Buffer.from(chunk));
						});
						response.once('error', reject);
						response.once('end', () => {
							const body = Buffer.concat(chunks, bytes);
							state.acceptedResponses += 1;
							state.aggregateBytes += bytes;
							state.ledger.push({
								ordinal: state.acceptedResponses,
								url,
								status: 200,
								bytes,
								sha256: sha256(body),
								sha512: createHash('sha512').update(body).digest('hex'),
								zeroResponseAttempts: attempt - 1,
							});
							resolvePromise(body);
						});
					},
				);
				call.setTimeout(requestTimeoutMilliseconds, () =>
					call.destroy(new Error('openMF zero-response request timeout')),
				);
				call.once('error', (error) => {
					if (!responseObserved) {
						state.transportAttempts.push({ url, attempt, outcome: 'zero-response' });
						const wrapped = new Error(error.message);
						Object.assign(wrapped, { zeroResponse: true });
						reject(wrapped);
					} else reject(error);
				});
				call.end();
			});
		} catch (error) {
			if (!(error instanceof Error) || !('zeroResponse' in error) || attempt === 3)
				throw error;
		}
	}
	throw new Error('openMF transport attempts exhausted');
}

async function execute(
	command: string,
	args: readonly string[],
	cwd = repositoryRoot,
): Promise<string> {
	return await new Promise<string>((resolvePromise, reject) => {
		const child = spawn(command, [...args], {
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
				: reject(
						new Error(
							`${basename(command)} exited ${code ?? -1}: ${Buffer.concat(stderr)}`,
						),
					),
		);
	});
}

function gitBlobSha(bytes: Buffer): string {
	return createHash('sha1')
		.update(Buffer.from(`blob ${bytes.length}\0`))
		.update(bytes)
		.digest('hex');
}

async function sourceManifest(source: string): Promise<
	Array<{
		path: string;
		kind: 'file' | 'symlink';
		mode: string;
		bytes: number;
		sha256: string;
		gitSha: string;
	}>
> {
	const rows: Array<{
		path: string;
		kind: 'file' | 'symlink';
		mode: string;
		bytes: number;
		sha256: string;
		gitSha: string;
	}> = [];
	const visit = async (directory: string): Promise<void> => {
		for (const entry of (await readdir(directory, { withFileTypes: true })).sort(
			(left, right) => compareText(left.name, right.name),
		)) {
			const absolute = join(directory, entry.name);
			const status = await lstat(absolute);
			if (status.isDirectory()) await visit(absolute);
			else if (status.isFile() || status.isSymbolicLink()) {
				const kind = status.isSymbolicLink() ? 'symlink' : 'file';
				const bytes =
					kind === 'symlink'
						? Buffer.from(await readlink(absolute), 'utf8')
						: await readFile(absolute);
				rows.push({
					path: relative(source, absolute),
					kind,
					mode: kind === 'symlink' ? '120000' : status.mode & 0o111 ? '100755' : '100644',
					bytes: bytes.byteLength,
					sha256: sha256(bytes),
					gitSha: gitBlobSha(bytes),
				});
			} else throw new Error('openMF archive contains a special filesystem entry');
		}
	};
	await visit(source);
	return rows.sort((left, right) => compareText(left.path, right.path));
}

function validateRefs(value: unknown): RefRow[] {
	if (!Array.isArray(value) || value.length === 0 || value.length > 256)
		throw new Error('openMF tag enumeration cardinality differs');
	return value.map((item) => {
		if (!item || typeof item !== 'object' || Array.isArray(item))
			throw new Error('openMF tag ref row differs');
		const row = item as { ref?: unknown; object?: { type?: unknown; sha?: unknown } };
		if (
			typeof row.ref !== 'string' ||
			(row.object?.type !== 'commit' && row.object?.type !== 'tag') ||
			typeof row.object.sha !== 'string' ||
			!lowerHex40.test(row.object.sha)
		)
			throw new Error('openMF tag ref identity differs');
		return { ref: row.ref, object: { type: row.object.type, sha: row.object.sha } };
	});
}

async function peelRef(ref: RefRow, apiRoot: string, state: NetworkState): Promise<string> {
	let type: 'commit' | 'tag' = ref.object.type;
	let sha = ref.object.sha;
	for (let depth = 0; type === 'tag' && depth < 4; depth += 1) {
		const bytes = await getExact(joinURL(apiRoot, 'git', 'tags', sha), 'api', state);
		const tag = JSON.parse(bytes.toString('utf8')) as {
			sha?: unknown;
			object?: { type?: unknown; sha?: unknown };
		};
		if (
			tag.sha !== sha ||
			(tag.object?.type !== 'tag' && tag.object?.type !== 'commit') ||
			typeof tag.object.sha !== 'string' ||
			!lowerHex40.test(tag.object.sha)
		)
			throw new Error('openMF annotated tag lineage differs');
		type = tag.object.type;
		sha = tag.object.sha;
	}
	if (type !== 'commit') throw new Error('openMF annotated tag peel depth exceeded');
	return sha;
}

async function writeTerminal(error: string, state: NetworkState): Promise<void> {
	if (await exists(terminalPath)) return;
	await mkdir(evidenceRoot, { recursive: true });
	const unsigned = {
		schemaVersion: 'versionless.angular-openmf-web-app-t673-terminal.v1',
		result: 'terminal-failure',
		consentId: OPENMF_CONSENT,
		namespace: OPENMF_NAMESPACE,
		promotion: 'none',
		error,
		access: state,
		claims: {
			feasibility: 'not-assessed',
			angularLineageScore: '1/4',
			angularPilot: '0/1',
		},
	};
	await writeFile(
		terminalPath,
		`${canonicalize({
			...unsigned,
			integrity: { algorithm: 'sha256', canonicalDigest: sha256(canonicalize(unsigned)) },
		})}\n`,
		{ flag: 'wx' },
	);
}

export async function acquireOpenMf(): Promise<void> {
	for (const target of [cacheRoot, stageRoot, attemptPath, terminalPath, receiptPath])
		if (await exists(target)) throw new Error('openMF T673 output collision');
	await mkdir(evidenceRoot, { recursive: true });
	await writeFile(
		attemptPath,
		`${canonicalize({
			schemaVersion: 'versionless.angular-openmf-web-app-t673-attempt.v1',
			consentId: OPENMF_CONSENT,
			namespace: OPENMF_NAMESPACE,
			limits: {
				acceptedResponses: maximumAcceptedResponses,
				apiBytes: maximumApiBytes,
				artifactBytes: maximumArtifactBytes,
				archiveBytes: maximumArchiveBytes,
				aggregateBytes: maximumAggregateBytes,
			},
		})}\n`,
		{ flag: 'wx' },
	);
	const state: NetworkState = {
		acceptedResponses: 0,
		aggregateBytes: 0,
		ledger: [],
		transportAttempts: [],
	};
	try {
		const acquisition = join(stageRoot, 'acquisition');
		const source = join(acquisition, 'source');
		await mkdir(source, { recursive: true });
		const apiRoot = joinURL('https://api.github.com', 'repos', 'openMF', 'web-app');
		const repositoryBytes = await getExact(apiRoot, 'api', state);
		const repository = JSON.parse(repositoryBytes.toString('utf8')) as {
			full_name?: unknown;
			owner?: { login?: unknown; type?: unknown };
			license?: { spdx_id?: unknown };
			archived?: unknown;
		};
		if (
			repository.full_name !== 'openMF/web-app' ||
			repository.owner?.login !== 'openMF' ||
			repository.owner.type !== 'Organization' ||
			repository.license?.spdx_id !== 'Apache-2.0' ||
			repository.archived !== false
		)
			throw new Error('openMF official repository identity or rights differs');
		const refs = validateRefs(
			JSON.parse(
				(
					await getExact(joinURL(apiRoot, 'git', 'matching-refs', 'tags'), 'api', state)
				).toString('utf8'),
			),
		);
		const candidates: Candidate[] = [];
		for (const ref of refs) {
			const version = parseOpenMfStableVersion(ref.ref);
			if (!version) continue;
			const commitSha = await peelRef(ref, apiRoot, state);
			const commitBytes = await getExact(
				joinURL(apiRoot, 'git', 'commits', commitSha),
				'api',
				state,
			);
			const commit = JSON.parse(commitBytes.toString('utf8')) as {
				sha?: unknown;
				tree?: { sha?: unknown };
				committer?: { date?: unknown };
			};
			if (
				commit.sha !== commitSha ||
				typeof commit.tree?.sha !== 'string' ||
				!lowerHex40.test(commit.tree.sha) ||
				typeof commit.committer?.date !== 'string'
			)
				throw new Error('openMF ref/commit/tree lineage differs');
			if (
				commit.committer.date >= '2019-01-01T00:00:00Z' &&
				commit.committer.date <= '2021-12-31T23:59:59Z'
			)
				candidates.push({
					ref: ref.ref,
					version,
					commit: commitSha,
					tree: commit.tree.sha,
					commitDate: commit.committer.date,
				});
		}
		const selected = selectOpenMfCandidate(candidates);
		const treeBytes = await getExact(
			withQuery(joinURL(apiRoot, 'git', 'trees', selected.tree), { recursive: '1' }),
			'api',
			state,
		);
		const tree = JSON.parse(treeBytes.toString('utf8')) as {
			sha?: unknown;
			truncated?: unknown;
			tree?: TreeRow[];
		};
		if (tree.sha !== selected.tree || tree.truncated !== false || !Array.isArray(tree.tree))
			throw new Error('openMF recursive tree differs');
		const archiveUrl = joinURL(
			'https://codeload.github.com',
			'openMF',
			'web-app',
			'tar.gz',
			selected.commit,
		);
		const archiveOne = await getExact(archiveUrl, 'archive', state);
		const archiveTwo = await getExact(archiveUrl, 'archive', state);
		if (!archiveOne.equals(archiveTwo)) throw new Error('openMF two commit archives differ');
		const archivePath = join(acquisition, 'source.tar.gz');
		await writeFile(archivePath, archiveOne, { flag: 'wx' });
		const listing = (await execute('/usr/bin/tar', ['-tzf', archivePath]))
			.split('\n')
			.filter(Boolean);
		let archiveRoot: string | undefined;
		for (const entry of listing) {
			const segments = entry.split('/');
			if (!entry || entry.startsWith('/') || entry.includes('\\') || segments.includes('..'))
				throw new Error('openMF archive path is unsafe');
			archiveRoot ??= segments[0];
			if (segments[0] !== archiveRoot) throw new Error('openMF archive root differs');
		}
		if (!archiveRoot || listing.length < 100)
			throw new Error('openMF archive inventory differs');
		await execute('/usr/bin/tar', [
			'-xzf',
			archivePath,
			'-C',
			source,
			'--strip-components',
			'1',
		]);
		const manifest = await sourceManifest(source);
		const blobs = new Map(
			tree.tree.filter((row) => row.type === 'blob').map((row) => [row.path, row]),
		);
		if (manifest.length !== blobs.size)
			throw new Error('openMF archive/tree cardinality differs');
		for (const row of manifest) {
			const expected = blobs.get(row.path);
			if (
				!expected ||
				expected.sha !== row.gitSha ||
				expected.size !== row.bytes ||
				expected.mode !== row.mode
			)
				throw new Error(`openMF archive/tree parity differs: ${row.path}`);
		}
		const licensePath = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'].find((name) =>
			blobs.has(name),
		);
		if (!licensePath) throw new Error('openMF root Apache license source is absent');
		const license = await readFile(join(source, licensePath), 'utf8');
		if (
			!license.includes('Apache License') ||
			!license.includes('Version 2.0, January 2004') ||
			!license.includes('http://www.apache.org/licenses/')
		)
			throw new Error('openMF root Apache-2.0 license text differs');
		const packageDocument = JSON.parse(
			await readFile(join(source, 'package.json'), 'utf8'),
		) as {
			name?: unknown;
			version?: unknown;
			dependencies?: Record<string, unknown>;
			devDependencies?: Record<string, unknown>;
			scripts?: Record<string, unknown>;
		};
		const angularVersion = packageDocument.dependencies?.['@angular/core'];
		const cliVersion = packageDocument.devDependencies?.['@angular/cli'];
		const lockNames = ['package-lock.json', 'yarn.lock'].filter((name) => blobs.has(name));
		if (
			typeof packageDocument.name !== 'string' ||
			!packageDocument.name.toLowerCase().includes('web-app') ||
			typeof packageDocument.version !== 'string' ||
			typeof angularVersion !== 'string' ||
			typeof cliVersion !== 'string' ||
			typeof packageDocument.scripts?.build !== 'string' ||
			lockNames.length !== 1
		)
			throw new Error('openMF authentic Angular product/toolchain/lock gate differs');
		const angularConfiguration = JSON.parse(
			await readFile(join(source, 'angular.json'), 'utf8'),
		) as {
			projects?: Record<string, { architect?: { build?: { builder?: unknown } } }>;
		};
		const builders = Object.values(angularConfiguration.projects ?? {}).map(
			(project) => project.architect?.build?.builder,
		);
		if (!builders.some((builder) => builder === '@angular-devkit/build-angular:browser'))
			throw new Error('openMF authentic historical Angular browser builder differs');
		let officeContract = false;
		let configurableApi = false;
		const serviceWorkerPaths: string[] = [];
		for (const row of manifest) {
			if (!row.path.startsWith('src/') || !row.path.endsWith('.ts')) continue;
			const text = await readFile(join(source, row.path), 'utf8');
			if (text.includes('office') && (text.includes('/offices') || text.includes('offices?')))
				officeContract = true;
			if (
				text.includes('baseApiUrl') ||
				text.includes('baseUrl') ||
				text.includes('apiUrl') ||
				text.includes('API_URL')
			)
				configurableApi = true;
			if (
				text.includes('ServiceWorkerModule.register') ||
				text.includes('navigator.serviceWorker') ||
				text.includes('serviceWorker.register')
			)
				serviceWorkerPaths.push(row.path);
		}
		if (!officeContract || !configurableApi)
			throw new Error('openMF loopback office source contract is absent');
		if (serviceWorkerPaths.length)
			throw new Error(
				`openMF source service-worker registration exists: ${serviceWorkerPaths.join(',')}`,
			);
		const unsigned = {
			schemaVersion: 'versionless.angular-openmf-web-app-ingest.v1',
			result: 'source-qualified',
			consentId: OPENMF_CONSENT,
			namespace: OPENMF_NAMESPACE,
			source: {
				...selected,
				archiveSha256: sha256(archiveOne),
				manifestDigest: sha256(canonicalize(manifest)),
				files: manifest.length,
			},
			product: {
				name: packageDocument.name,
				version: packageDocument.version,
				angular: angularVersion,
				cli: cliVersion,
				lock: lockNames[0],
				historicalBuilder: '@angular-devkit/build-angular:browser',
				officeContract: true,
				configurableApi: true,
				serviceWorkerSourceMatches: 0,
			},
			license: {
				rootExpression: 'Apache-2.0',
				thirdPartyAssetState: 'unknown',
				legalReviewRequired: true,
				redistributionAuthorized: false,
			},
			access: { ...state, redirects: 0, credentials: false, cookies: false },
			privacy: { sensitiveData: false, hostPaths: false },
		};
		const receipt = {
			...unsigned,
			integrity: { algorithm: 'sha256', canonicalDigest: sha256(canonicalize(unsigned)) },
		};
		await writeFile(join(acquisition, 'receipt.json'), `${canonicalize(receipt)}\n`, {
			flag: 'wx',
		});
		await rename(stageRoot, cacheRoot);
		await writeFile(receiptPath, `${canonicalize(receipt)}\n`, { flag: 'wx' });
	} catch (error) {
		await writeTerminal(error instanceof Error ? error.message : String(error), state);
		throw error;
	}
}

export async function verifyOpenMfIngest(): Promise<{
	valid: true;
	digest: string;
	files: number;
}> {
	const published = JSON.parse(await readFile(receiptPath, 'utf8')) as {
		source: { manifestDigest: string; files: number };
		integrity: { canonicalDigest: string };
		[key: string]: unknown;
	};
	const cached = JSON.parse(
		await readFile(join(cacheRoot, 'acquisition/receipt.json'), 'utf8'),
	) as typeof published;
	if (canonicalize(published) !== canonicalize(cached))
		throw new Error('openMF receipt publication differs');
	const { integrity, ...unsigned } = published;
	if (integrity.canonicalDigest !== sha256(canonicalize(unsigned)))
		throw new Error('openMF receipt integrity differs');
	const manifest = await sourceManifest(join(cacheRoot, 'acquisition/source'));
	if (
		manifest.length !== published.source.files ||
		sha256(canonicalize(manifest)) !== published.source.manifestDigest
	)
		throw new Error('openMF source offline replay differs');
	return { valid: true, digest: integrity.canonicalDigest, files: manifest.length };
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const launcher = parseOpenMfLauncher(args);
	if (launcher.mode === 'acquire') await acquireOpenMf();
	process.stdout.write(`${canonicalize(await verifyOpenMfIngest())}\n`);
}

if (basename(process.argv[1] ?? '') === 'angular-openmf-web-app-ingest.ts')
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
