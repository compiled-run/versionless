import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import {
	access,
	cp,
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
	FUXA_LOCK_SHA256,
	FUXA_REPLAY_SHA256,
	FUXA_RUNTIME_SHA256,
	finalizeDependencyClosureReceipt,
	inspectDependencyTarball,
	parseFuxaDependencyPlan,
	sha256,
	verifyDependencyClosureReceipt,
	verifyDependencySri,
	type DependencyArtifact,
	type DependencyClosureReceipt,
	type DependencyRequest,
} from '../../../core/src/index.ts';
import {
	findArchiveFile,
	indexTarGzip,
	type CompleteBody,
} from '../../../core/src/corpus/tier-f-provenance.ts';

export const T151_CONSENT_ID =
	'T151-registry-angular-fuxa-8b323c177615c0d152a54e5ef0a6f98dae7b8ff0-node16-npm8-dependency-closure';
export const T151_CONSENT_EXPIRY = '2026-08-09T00:00:00Z';
export const T151_REQUESTS = 1222;
export const T151_RESPONSE_LIMIT = 64 * 1_024 * 1_024;
export const T151_AGGREGATE_LIMIT = 1_024 * 1_024 * 1_024;
const commit = '8b323c177615c0d152a54e5ef0a6f98dae7b8ff0';
const archiveSha = '4913aabfec74fc990664a5d60760d8f3438ee067b682f833f5869cd2c9c3c372';
const root = path.resolve(import.meta.dirname, '../../../..');
const cacheBase = path.join(root, '.versionless/cache/dependencies');
const staging = path.join(cacheBase, '.staging/t151-angular-fuxa');
const publication = path.join(cacheBase, 'angular-fuxa', FUXA_LOCK_SHA256);
const terminalMarker = path.join(cacheBase, 'angular-fuxa/t151-terminal.json');
const work = path.join(root, '.versionless/work/angular-fuxa-dependency-verify');
const evidence = path.join(root, 'evidence/dependencies/angular-fuxa/t151-dependency-closure.json');
const sourceArchive = path.join(
	root,
	`.versionless/cache/tier-f/angular-fuxa/${archiveSha}/source.tar.gz`,
);
const runtimeArchive = path.join(
	root,
	'.versionless/cache/angular-phonecat/node-v16.20.2-darwin-arm64.tar.gz',
);
const runtimeRoot = path.join(root, '.versionless/cache/angular-phonecat/node16');

type LedgerRecord = Readonly<{
	sequence: number;
	method: 'GET';
	url: string;
	status: number | null;
	responseBytes: number;
	sha256: string | null;
	result: 'accepted' | 'rejected';
	reason: string;
}>;

type CacheApi = {
	put(
		cache: string,
		key: string,
		bytes: Buffer,
		options: Record<string, unknown>,
	): Promise<unknown>;
};

export type AcquireState = { attempts: number; aggregateBytes: number; ledger: LedgerRecord[] };

function exists(file: string): Promise<boolean> {
	return access(file).then(
		() => true,
		() => false,
	);
}

function canonical(value: unknown): string {
	return `${JSON.stringify(value, null, 2)}\n`;
}

async function run(
	command: string,
	args: readonly string[],
	cwd = root,
	env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
	return await new Promise((resolve, reject) => {
		const child = spawn(command, [...args], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		child.stdout.on('data', (value: Buffer) => stdout.push(value));
		child.stderr.on('data', (value: Buffer) => stderr.push(value));
		child.once('error', reject);
		child.once('exit', (code) =>
			code === 0
				? resolve(Buffer.concat(stdout).toString('utf8'))
				: reject(
						new Error(
							`${path.basename(command)} exited ${code}: ${Buffer.concat(stderr).toString('utf8')}`,
						),
					),
		);
	});
}

export function assertT151Consent(argument: string | undefined, now = new Date()): void {
	if (
		argument !== T151_CONSENT_ID ||
		process.env.VERSIONLESS_NETWORK_MODE !== 'consented' ||
		process.env.VERSIONLESS_CONSENT_ID !== T151_CONSENT_ID
	)
		throw new Error(
			'T151 requires the exact purpose-bound consent in argument and environment',
		);
	if (now.getTime() >= Date.parse(T151_CONSENT_EXPIRY))
		throw new Error('T151 consent has expired');
}

export function assertDependencyUrl(url: string): void {
	const parsed = parseURL(url);
	if (
		parsed.protocol !== 'https:' ||
		parsed.host !== 'registry.npmjs.org' ||
		parsed.auth ||
		parsed.search ||
		parsed.hash ||
		!parsed.pathname.startsWith('/') ||
		!parsed.pathname.endsWith('.tgz')
	)
		throw new Error('Dependency URL is outside the exact registry tarball scope');
}

export function createAcquireState(): AcquireState {
	return { attempts: 0, aggregateBytes: 0, ledger: [] };
}

async function boundedBody(response: Response): Promise<Buffer> {
	const declared = response.headers.get('content-length');
	if (
		declared !== null &&
		(!Number.isSafeInteger(Number(declared)) || Number(declared) > T151_RESPONSE_LIMIT)
	)
		throw new Error('Dependency response exceeds the per-response limit');
	if (
		response.headers.get('content-encoding') &&
		response.headers.get('content-encoding') !== 'identity'
	)
		throw new Error('Dependency response used non-identity content encoding');
	const reader = response.body?.getReader();
	if (!reader) throw new Error('Dependency response body is absent');
	const chunks: Buffer[] = [];
	let total = 0;
	while (true) {
		const next = await reader.read();
		if (next.done) break;
		total += next.value.byteLength;
		if (total > T151_RESPONSE_LIMIT) {
			await reader.cancel();
			throw new Error('Dependency response exceeds the per-response limit');
		}
		chunks.push(Buffer.from(next.value));
	}
	if (declared !== null && Number(declared) !== total)
		throw new Error('Dependency response is incomplete');
	return Buffer.concat(chunks);
}

export async function acquireDependency(
	request: DependencyRequest,
	state: AcquireState,
	fetchImplementation: typeof fetch,
): Promise<{ bytes: Buffer; artifact: DependencyArtifact }> {
	assertDependencyUrl(request.url);
	if (request.sequence !== state.attempts + 1 || state.attempts >= T151_REQUESTS)
		throw new Error('Dependency request sequence or request cap is invalid');
	state.attempts += 1;
	let response: Response | undefined;
	let bytes: Buffer | undefined;
	try {
		response = await fetchImplementation(request.url, {
			method: 'GET',
			redirect: 'manual',
			credentials: 'omit',
			headers: { accept: 'application/octet-stream', 'accept-encoding': 'identity' },
		});
		if (response.status !== 200 || response.redirected || response.headers.has('location'))
			throw new Error(`Dependency response status ${response.status} is not accepted`);
		bytes = await boundedBody(response);
		if (state.aggregateBytes + bytes.byteLength > T151_AGGREGATE_LIMIT)
			throw new Error('Dependency aggregate response limit exceeded');
		state.aggregateBytes += bytes.byteLength;
		verifyDependencySri(bytes, request.integrity);
		const inspected = inspectDependencyTarball(bytes, request.identities);
		const artifact: DependencyArtifact = Object.freeze({
			sequence: request.sequence,
			url: request.url,
			integrity: request.integrity,
			sha256: sha256(bytes),
			byteLength: bytes.byteLength,
			...inspected,
		});
		state.ledger.push(
			Object.freeze({
				sequence: request.sequence,
				method: 'GET',
				url: request.url,
				status: response.status,
				responseBytes: bytes.byteLength,
				sha256: artifact.sha256,
				result: 'accepted',
				reason: 'exact URL, complete identity response, SRI, tar, identity, and license accepted',
			}),
		);
		return { bytes, artifact };
	} catch (error) {
		state.ledger.push(
			Object.freeze({
				sequence: request.sequence,
				method: 'GET',
				url: request.url,
				status: response?.status ?? null,
				responseBytes: bytes?.byteLength ?? 0,
				sha256: bytes ? sha256(bytes) : null,
				result: 'rejected',
				reason: error instanceof Error ? error.message : String(error),
			}),
		);
		throw error;
	}
}

async function loadClosure(): Promise<{
	lock: Buffer;
	packageJson: Buffer;
	plan: readonly DependencyRequest[];
}> {
	const archiveBytes = await readFile(sourceArchive);
	if (sha256(archiveBytes) !== archiveSha) throw new Error('T094 FUXA archive SHA-256 mismatch');
	const body: CompleteBody = {
		bytes: archiveBytes,
		byteLength: archiveBytes.byteLength,
		sha256: archiveSha,
	};
	const index = indexTarGzip(body, commit);
	const lock = findArchiveFile(index, 'client/package-lock.json').bytes;
	const packageJson = findArchiveFile(index, 'client/package.json').bytes;
	return { lock, packageJson, plan: parseFuxaDependencyPlan(lock) };
}

async function replayT094Twice(): Promise<void> {
	for (let index = 0; index < 2; index += 1) {
		const output = await run(
			process.execPath,
			[
				'--experimental-strip-types',
				'packages/cli/src/fixture/tier-f-ingest.ts',
				'--verify-only',
				'--fixture',
				'react-dashboard',
				'--fixture',
				'angular-fuxa',
			],
			root,
			{
				...process.env,
				VERSIONLESS_NETWORK_MODE: 'offline',
				NPM_CONFIG_OFFLINE: 'true',
				VERSIONLESS_CONSENT_ID: undefined,
			},
		);
		const parsed = JSON.parse(output) as {
			networkAttempts?: unknown;
			fixtures?: Array<{ fixture?: unknown; canonicalOutputSha256?: unknown }>;
		};
		const fuxa = parsed.fixtures?.find((fixture) => fixture.fixture === 'angular-fuxa');
		if (parsed.networkAttempts !== 0 || fuxa?.canonicalOutputSha256 !== FUXA_REPLAY_SHA256)
			throw new Error('T094 offline replay digest or network-attempt invariant differs');
	}
}

async function verifyRuntime(): Promise<void> {
	if (sha256(await readFile(runtimeArchive)) !== FUXA_RUNTIME_SHA256)
		throw new Error('Accepted Node runtime archive SHA-256 mismatch');
	if ((await run(path.join(runtimeRoot, 'bin/node'), ['--version'])).trim() !== 'v16.20.2')
		throw new Error('Accepted Node identity differs');
	if ((await run(path.join(runtimeRoot, 'bin/npm'), ['--version'])).trim() !== '8.19.4')
		throw new Error('Accepted npm identity differs');
}

async function requireCleanPreflight(): Promise<void> {
	for (const target of [staging, publication, terminalMarker, evidence, `${evidence}.tmp`, work])
		if (await exists(target))
			throw new Error(
				`T151 preflight residue or consumed terminal exists: ${path.relative(root, target)}`,
			);
}

async function writeTerminalMarker(): Promise<void> {
	await mkdir(path.dirname(terminalMarker), { recursive: true });
	const exclusive = await import('node:fs/promises');
	const handle = await exclusive.open(terminalMarker, 'wx');
	try {
		await handle.writeFile(
			canonical({ task: 'T151', consentId: T151_CONSENT_ID, state: 'terminal-consumed' }),
		);
	} finally {
		await handle.close();
	}
}

function cacheApi(): CacheApi {
	const require = createRequire(import.meta.url);
	return require(path.join(runtimeRoot, 'lib/node_modules/npm/node_modules/cacache')) as CacheApi;
}

async function cacheTarball(
	cache: string,
	request: DependencyRequest,
	bytes: Buffer,
): Promise<void> {
	await cacheApi().put(
		path.join(cache, '_cacache'),
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

async function writeContentAddressed(file: string, bytes: Buffer): Promise<void> {
	try {
		await writeFile(file, bytes, { flag: 'wx' });
	} catch (error) {
		if (!(await exists(file)) || sha256(await readFile(file)) !== sha256(bytes)) throw error;
	}
}

async function treeDigest(directory: string): Promise<string> {
	const rows: string[] = [];
	const visit = async (current: string): Promise<void> => {
		for (const entry of (await readdir(current, { withFileTypes: true })).sort((a, b) =>
			a.name.localeCompare(b.name),
		)) {
			const absolute = path.join(current, entry.name);
			const relative = path.relative(directory, absolute);
			if (entry.isDirectory()) await visit(absolute);
			else if (entry.isSymbolicLink()) {
				const target = await readlink(absolute);
				const resolved = path.resolve(path.dirname(absolute), target);
				if (resolved !== directory && !resolved.startsWith(`${directory}/`))
					throw new Error('Offline install produced an escaping symlink');
				rows.push(`L ${relative} ${target}`);
			} else if (entry.isFile())
				rows.push(`F ${relative} ${sha256(await readFile(absolute))}`);
			else throw new Error('Offline install produced a special filesystem entry');
		}
	};
	await visit(directory);
	return sha256(`${rows.join('\n')}\n`);
}

async function installTwice(
	lock: Buffer,
	packageJson: Buffer,
	npmCache: string,
): Promise<readonly [string, string]> {
	await mkdir(work, { recursive: true });
	const digests: string[] = [];
	try {
		for (let index = 1; index <= 2; index += 1) {
			const directory = path.join(work, `run-${index}`);
			await mkdir(directory);
			await writeFile(path.join(directory, 'package-lock.json'), lock);
			await writeFile(path.join(directory, 'package.json'), packageJson);
			await run(
				path.join(runtimeRoot, 'bin/npm'),
				[
					'ci',
					'--offline',
					'--ignore-scripts',
					'--no-audit',
					'--no-fund',
					'--cache',
					npmCache,
				],
				directory,
				{
					PATH: `${path.join(runtimeRoot, 'bin')}:${process.env.PATH ?? ''}`,
					VERSIONLESS_NETWORK_MODE: 'offline',
					npm_config_offline: 'true',
					npm_config_ignore_scripts: 'true',
					npm_config_audit: 'false',
					npm_config_fund: 'false',
					npm_config_update_notifier: 'false',
				},
			);
			if (
				sha256(await readFile(path.join(directory, 'package-lock.json'))) !==
				FUXA_LOCK_SHA256
			)
				throw new Error('Offline npm install changed the immutable lock');
			digests.push(await treeDigest(path.join(directory, 'node_modules')));
		}
		if (digests[0] !== digests[1])
			throw new Error('Independent offline install closures differ');
		return [digests[0]!, digests[1]!];
	} finally {
		await rm(work, { recursive: true, force: true });
	}
}

async function verifyPublished(runInstalls: boolean): Promise<DependencyClosureReceipt> {
	const receipt = verifyDependencyClosureReceipt(JSON.parse(await readFile(evidence, 'utf8')));
	const { lock, packageJson, plan } = await loadClosure();
	await verifyRuntime();
	for (const request of plan) {
		const artifact = receipt.artifacts[request.sequence - 1];
		if (!artifact || artifact.url !== request.url || artifact.integrity !== request.integrity)
			throw new Error('Published dependency ledger differs from lock plan');
		const bytes = await readFile(path.join(publication, `tarballs/${artifact.sha256}.tgz`));
		if (bytes.byteLength !== artifact.byteLength || sha256(bytes) !== artifact.sha256)
			throw new Error('Published dependency bytes differ');
		verifyDependencySri(bytes, request.integrity);
		inspectDependencyTarball(bytes, request.identities);
	}
	if (runInstalls) {
		const digests = await installTwice(lock, packageJson, path.join(publication, 'npm-cache'));
		if (digests[0] !== receipt.installVerification.firstDigest)
			throw new Error('Published offline install digest differs');
	}
	if ((await exists(staging)) || (await exists(work)))
		throw new Error('Dependency verification residue is present');
	return receipt;
}

export async function ingestAngularFuxaDependencies(
	consentId: string | undefined,
	fetchImplementation: typeof fetch = fetch,
): Promise<DependencyClosureReceipt> {
	await requireCleanPreflight();
	await replayT094Twice();
	const { lock, packageJson, plan } = await loadClosure();
	await verifyRuntime();
	assertT151Consent(consentId);
	await writeTerminalMarker();
	const state = createAcquireState();
	const artifacts: DependencyArtifact[] = [];
	try {
		await mkdir(path.join(staging, 'tarballs'), { recursive: true });
		await mkdir(path.join(staging, 'npm-cache'), { recursive: true });
		for (const request of plan) {
			const acquired = await acquireDependency(request, state, fetchImplementation);
			await writeContentAddressed(
				path.join(staging, `tarballs/${acquired.artifact.sha256}.tgz`),
				acquired.bytes,
			);
			await cacheTarball(path.join(staging, 'npm-cache'), request, acquired.bytes);
			artifacts.push(acquired.artifact);
		}
		if (state.attempts !== T151_REQUESTS || state.ledger.length !== T151_REQUESTS)
			throw new Error('Terminal request ledger is incomplete');
		await cp(runtimeArchive, path.join(staging, path.basename(runtimeArchive)));
		const installDigests = await installTwice(
			lock,
			packageJson,
			path.join(staging, 'npm-cache'),
		);
		const receipt = finalizeDependencyClosureReceipt({
			fixture: 'angular-fuxa',
			repository: 'frangoteam/FUXA',
			commit,
			lock: {
				path: 'client/package-lock.json',
				sha256: FUXA_LOCK_SHA256,
				lockfileVersion: 1,
				entries: 1468,
				uniqueTarballs: 1222,
				missingResolvedOrIntegrity: 0,
				hosts: ['registry.npmjs.org'],
			},
			runtime: {
				node: '16.20.2',
				npm: '8.19.4',
				archiveSha256: FUXA_RUNTIME_SHA256,
				state: 'eol-compatibility-sandbox-only',
			},
			consent: {
				id: T151_CONSENT_ID,
				status: 'closed',
				methods: ['GET'],
				requests: state.attempts,
				responseBytes: state.aggregateBytes,
				aggregateBytes: T151_AGGREGATE_LIMIT,
			},
			artifacts,
			installVerification: {
				runs: 2,
				networkAttempts: 0,
				ignoreScripts: true,
				firstDigest: installDigests[0],
				secondDigest: installDigests[1],
				lockUnchanged: true,
				residue: 'none',
			},
			nonclaims: [
				'No lifecycle/native script, candidate source, Angular CLI, build, server, browser, migration, asset, support, compliance, or certification claim.',
			],
		});
		await writeFile(path.join(staging, 'ledger.json'), canonical(state.ledger));
		await writeFile(path.join(staging, 'receipt.json'), canonical(receipt));
		verifyDependencyClosureReceipt(
			JSON.parse(await readFile(path.join(staging, 'receipt.json'), 'utf8')),
		);
		await mkdir(path.dirname(evidence), { recursive: true });
		await writeFile(`${evidence}.tmp`, canonical(receipt), { flag: 'wx' });
		await mkdir(path.dirname(publication), { recursive: true });
		await rename(staging, publication);
		await rename(`${evidence}.tmp`, evidence);
		return await verifyPublished(false);
	} catch (error) {
		await writeFile(
			path.join(cacheBase, 'angular-fuxa/t151-failure.json'),
			canonical({
				task: 'T151',
				consentId: T151_CONSENT_ID,
				result: 'failed',
				attempts: state.attempts,
				aggregateBytes: state.aggregateBytes,
				ledger: state.ledger,
				reason: error instanceof Error ? error.message : String(error),
			}),
			{ flag: 'wx' },
		).catch(() => undefined);
		await rm(staging, { recursive: true, force: true });
		await rm(`${evidence}.tmp`, { force: true });
		await rm(publication, { recursive: true, force: true });
		await rm(evidence, { force: true });
		throw error;
	}
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	if (args[args.indexOf('--fixture') + 1] !== 'angular-fuxa')
		throw new Error('T151 requires literal --fixture angular-fuxa');
	if (args.includes('--verify-only')) {
		if (process.env.VERSIONLESS_NETWORK_MODE !== 'offline')
			throw new Error('T151 verify-only requires offline mode');
		const receipt = await verifyPublished(true);
		process.stdout.write(
			canonical({
				result: 'pass',
				networkAttempts: 0,
				digest: receipt.integrity.canonicalDigest,
			}),
		);
		return;
	}
	const index = args.indexOf('--consent-id');
	const receipt = await ingestAngularFuxaDependencies(index < 0 ? undefined : args[index + 1]);
	process.stdout.write(
		canonical({
			result: 'published',
			requests: 1222,
			digest: receipt.integrity.canonicalDigest,
		}),
	);
}

if (process.argv[1]?.endsWith('angular-fuxa-dependency-ingest.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
