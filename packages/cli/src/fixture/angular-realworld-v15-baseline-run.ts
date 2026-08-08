import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { access, cp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { chromium } from 'playwright';
import { parseURL } from 'ufo';
import { canonicalize, sha256 } from '../../../core/src/index.ts';
import {
	CHROMIUM_SHA256,
	NODE_ARCHIVE_SHA256,
	verifyAcquisitionReceipt,
} from './angular-realworld-v15-ingest.ts';

const root = path.resolve(import.meta.dirname, '../../../..');
const acquisitionEvidence = path.join(root, 'evidence/ingests/angular-realworld-v15/receipt.json');
const work = path.join(root, '.versionless/work/angular-realworld-v15');
const evidenceDirectory = path.join(root, 'evidence/runs/angular-realworld-v15-baseline');
const receiptPath = path.join(evidenceDirectory, 'receipt.json');
export const T214_BASELINE_FAILURE_HASHES = {
	receipt: '3a947238d952e6e8879fb2aafb62e1f2e6e72c79648d4f342822543726060400',
	install: 'cc19d1229a3bbeb03a73783ad47819438fedddb5a080b96cd2745650b5026fe8',
	build: '48d017ddf7c72ef3d2eab00ec63a5d6655eff4f082fea192dffc928df2c77b26',
} as const;
const historicalEvidence = [
	[
		{
			current: 'receipt.json',
			archived: 't210-baseline-failed-receipt.json',
			sha256: 'd73e0d3b03c01610e0037719903971d2061d4f769986f33e591f640fa86479e4',
		},
		{
			current: 'install.log',
			archived: 't210-baseline-failed-install.log',
			sha256: 'cc19d1229a3bbeb03a73783ad47819438fedddb5a080b96cd2745650b5026fe8',
		},
		{
			current: 'build.log',
			archived: 't210-baseline-failed-build.log',
			sha256: '4e53e50de48195613c826e17fc3171e169be7fdc42bb50c4e55a0fadb144752d',
		},
	],
	[
		{
			current: 'receipt.json',
			archived: 't212-node18-ts-loader-failed-receipt.json',
			sha256: 'e9d405d68e2c7b92179ab99feaf41ced81067fc837b60325c603edee04636bd2',
		},
		{
			current: 'install.log',
			archived: 't212-node18-ts-loader-failed-install.log',
			sha256: 'cc19d1229a3bbeb03a73783ad47819438fedddb5a080b96cd2745650b5026fe8',
		},
		{
			current: 'build.log',
			archived: 't212-node18-ts-loader-failed-build.log',
			sha256: 'beab230c931924effb468d7ee69d254de9608d6501e25530e6d9c4961888bfa4',
		},
	],
	[
		{
			current: 'receipt.json',
			archived: 't214-loopback-bind-eperm-receipt.json',
			sha256: T214_BASELINE_FAILURE_HASHES.receipt,
		},
		{
			current: 'install.log',
			archived: 't214-loopback-bind-eperm-install.log',
			sha256: T214_BASELINE_FAILURE_HASHES.install,
		},
		{
			current: 'build.log',
			archived: 't214-loopback-bind-eperm-build.log',
			sha256: T214_BASELINE_FAILURE_HASHES.build,
		},
	],
] as const;
const chromiumPath = path.join(
	root,
	'.versionless/cache/react-boilerplate-v4/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell',
);

type CommandResult = Readonly<{
	command: string;
	exitCode: number;
	stdout: string;
	stderr: string;
}>;

export const ANGULAR_REALWORLD_BUILD_OPTIMIZATION = {
	scripts: true,
	styles: { minify: true, inlineCritical: true },
	fonts: { inline: false },
} as const;

export const ANGULAR_REALWORLD_LAUNCHER_OPTIONS = {
	pretty: false,
	strict: true,
	noEmitOnError: true,
	target: 'es2020',
	module: 'commonjs',
	moduleResolution: 'node',
	lib: ['es2020'],
	types: ['node'],
	typeRoots: 'source/node_modules/@types',
	rootDir: 'launcher',
	outDir: 'launcher-dist',
	newLine: 'lf',
	forceConsistentCasingInFileNames: true,
} as const;
export const ANGULAR_REALWORLD_LAUNCHER_COMPILE_COMMAND =
	'node source/node_modules/typescript/bin/tsc --pretty false --strict --noEmitOnError --target es2020 --module commonjs --moduleResolution node --lib es2020 --types node --typeRoots source/node_modules/@types --rootDir launcher --outDir launcher-dist --newLine lf --forceConsistentCasingInFileNames launcher/architect-launcher.cts';
export const ANGULAR_REALWORLD_LAUNCHER_EXECUTION_COMMAND =
	'NODE_PATH=source/node_modules node launcher-dist/architect-launcher.cjs source';

export type LauncherEvidence = Readonly<{
	compiler: 'typescript';
	compilerVersion: 'Version 4.8.4';
	typesNodeVersion: '18.15.11';
	nodeVersion: 'v18.20.8';
	compileCommand: string;
	executionCommand: string;
	options: typeof ANGULAR_REALWORLD_LAUNCHER_OPTIONS;
	sourcePath: 'launcher/architect-launcher.cts';
	outputPath: 'launcher-dist/architect-launcher.cjs';
	sourceSha256: string;
	outputSha256: string;
}>;

export type BaselineReceipt = Readonly<{
	schemaVersion: 'versionless.angular-realworld-v15-baseline.v1';
	result: 'pass' | 'baseline-failed' | 'smoke-failed';
	closureManifestSha256: string;
	runtime: Readonly<{
		node: 'v18.20.8';
		archiveSha256: typeof NODE_ARCHIVE_SHA256;
		npm: string;
	}>;
	install: Readonly<{
		exitCode: number;
		offline: true;
		ignoreScripts: true;
		lockUnchanged: boolean;
		logSha256: string;
	}>;
	build: Readonly<{
		attempted: boolean;
		exitCode: number | null;
		configuration: 'production';
		aot: true;
		mechanism: 'architect-target-override';
		optimization: typeof ANGULAR_REALWORLD_BUILD_OPTIMIZATION;
		launcher: LauncherEvidence | null;
		logSha256: string | null;
		distTreeSha256: string | null;
	}>;
	smoke: Readonly<{
		attempted: boolean;
		result: 'pass' | 'failed' | 'not-run';
		browserSha256: typeof CHROMIUM_SHA256;
		requests: readonly Readonly<{
			url: string;
			action: 'loopback' | 'fulfilled-api' | 'fulfilled-stylesheet' | 'rejected';
		}>[];
		tagsRequests: number;
		articlesRequests: number;
		externalStylesheets: number;
		pageErrors: readonly string[];
		storageInitiallyEmpty: boolean;
	}>;
	nonclaims: readonly string[];
	integrity: Readonly<{ algorithm: 'sha256'; canonicalDigest: string }>;
}>;

function exists(file: string): Promise<boolean> {
	return access(file).then(
		() => true,
		() => false,
	);
}

function canonical(value: unknown): string {
	return `${canonicalize(value)}\n`;
}

async function preserveHistoricalBaselineFailures(): Promise<void> {
	for (const evidenceGroup of historicalEvidence) {
		const archivedStates = await Promise.all(
			evidenceGroup.map((entry) => exists(path.join(evidenceDirectory, entry.archived))),
		);
		if (archivedStates.every(Boolean)) {
			for (const entry of evidenceGroup)
				if (
					sha256(await readFile(path.join(evidenceDirectory, entry.archived))) !==
					entry.sha256
				)
					throw new Error('Angular RealWorld archived baseline evidence hash differs');
			continue;
		}
		if (archivedStates.some(Boolean))
			throw new Error('Angular RealWorld archived baseline evidence is partial');
		for (const entry of evidenceGroup) {
			const current = path.join(evidenceDirectory, entry.current);
			if (!(await exists(current)) || sha256(await readFile(current)) !== entry.sha256)
				throw new Error('Angular RealWorld current baseline evidence hash differs');
		}
		for (const entry of evidenceGroup)
			await rename(
				path.join(evidenceDirectory, entry.current),
				path.join(evidenceDirectory, entry.archived),
			);
	}
}

export function finalizeBaseline(value: Omit<BaselineReceipt, 'integrity'>): BaselineReceipt {
	const receipt = { ...value, integrity: { algorithm: 'sha256' as const, canonicalDigest: '' } };
	return {
		...receipt,
		integrity: { algorithm: 'sha256', canonicalDigest: sha256(canonicalize(receipt)) },
	};
}

export function verifyBaselineReceipt(value: unknown): BaselineReceipt {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error('Angular RealWorld baseline receipt must be an object');
	const receipt = value as BaselineReceipt;
	const copy = structuredClone(receipt);
	(copy.integrity as { canonicalDigest: string }).canonicalDigest = '';
	if (
		receipt.schemaVersion !== 'versionless.angular-realworld-v15-baseline.v1' ||
		!['pass', 'baseline-failed', 'smoke-failed'].includes(receipt.result) ||
		receipt.install.offline !== true ||
		receipt.install.ignoreScripts !== true ||
		receipt.runtime.archiveSha256 !== NODE_ARCHIVE_SHA256 ||
		receipt.smoke.browserSha256 !== CHROMIUM_SHA256 ||
		sha256(canonicalize(copy)) !== receipt.integrity.canonicalDigest
	)
		throw new Error('Angular RealWorld baseline receipt differs');
	if (
		receipt.result === 'pass' &&
		(receipt.build.exitCode !== 0 || receipt.smoke.result !== 'pass')
	)
		throw new Error('Angular RealWorld passing baseline lacks build or smoke proof');
	if (
		receipt.result === 'pass' &&
		(receipt.build.mechanism !== 'architect-target-override' ||
			canonicalize(receipt.build.optimization) !==
				canonicalize(ANGULAR_REALWORLD_BUILD_OPTIMIZATION) ||
			!receipt.build.launcher ||
			receipt.build.launcher.compiler !== 'typescript' ||
			receipt.build.launcher.compilerVersion !== 'Version 4.8.4' ||
			receipt.build.launcher.typesNodeVersion !== '18.15.11' ||
			receipt.build.launcher.nodeVersion !== 'v18.20.8' ||
			receipt.build.launcher.compileCommand !== ANGULAR_REALWORLD_LAUNCHER_COMPILE_COMMAND ||
			receipt.build.launcher.executionCommand !==
				ANGULAR_REALWORLD_LAUNCHER_EXECUTION_COMMAND ||
			canonicalize(receipt.build.launcher.options) !==
				canonicalize(ANGULAR_REALWORLD_LAUNCHER_OPTIONS) ||
			receipt.build.launcher.sourcePath !== 'launcher/architect-launcher.cts' ||
			receipt.build.launcher.outputPath !== 'launcher-dist/architect-launcher.cjs' ||
			receipt.build.launcher.sourceSha256.length !== 64 ||
			receipt.build.launcher.outputSha256.length !== 64 ||
			!receipt.build.distTreeSha256 ||
			receipt.build.distTreeSha256.length !== 64 ||
			receipt.smoke.tagsRequests !== 1 ||
			receipt.smoke.articlesRequests !== 1 ||
			receipt.smoke.externalStylesheets !== 3 ||
			receipt.smoke.storageInitiallyEmpty !== true ||
			receipt.smoke.pageErrors.length !== 0 ||
			receipt.smoke.requests.some((request) => request.action === 'rejected'))
	)
		throw new Error('Angular RealWorld passing baseline facts differ');
	return receipt;
}

async function run(
	command: string,
	args: readonly string[],
	cwd: string,
	environment: NodeJS.ProcessEnv,
): Promise<CommandResult> {
	return await new Promise((resolve, reject) => {
		const child = spawn(command, [...args], {
			cwd,
			env: environment,
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		child.stdout.on('data', (value: Buffer) => stdout.push(value));
		child.stderr.on('data', (value: Buffer) => stderr.push(value));
		child.once('error', reject);
		child.once('exit', (code) =>
			resolve({
				command: `${path.basename(command)} ${args.join(' ')}`,
				exitCode: code ?? -1,
				stdout: Buffer.concat(stdout).toString('utf8'),
				stderr: Buffer.concat(stderr).toString('utf8'),
			}),
		);
	});
}

async function filesBelow(directory: string): Promise<string[]> {
	const files: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const item = path.join(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await filesBelow(item)));
		else if (entry.isFile()) files.push(item);
		else throw new Error('Angular RealWorld build emitted a special filesystem entry');
	}
	return files.sort();
}

async function treeDigest(directory: string): Promise<string> {
	const rows = await Promise.all(
		(await filesBelow(directory)).map(
			async (file) => `${path.relative(directory, file)}\0${sha256(await readFile(file))}`,
		),
	);
	return sha256(rows.join('\n'));
}

async function writeReceipt(receipt: BaselineReceipt): Promise<void> {
	await mkdir(evidenceDirectory, { recursive: true });
	await writeFile(receiptPath, canonical(receipt), { flag: 'wx' });
}

async function removeNonLauncherScratch(): Promise<void> {
	for (const name of ['runtime', 'source', 'npm-cache'])
		await rm(path.join(work, name), { recursive: true, force: true });
}

async function smoke(dist: string): Promise<BaselineReceipt['smoke']> {
	const index = await readFile(path.join(dist, 'index.html'));
	const server = createServer(async (request, response) => {
		const parsed = parseURL(request.url ?? '/');
		let requested = decodeURIComponent(parsed.pathname || '/').slice(1);
		if (!requested) requested = 'index.html';
		let file = path.join(dist, requested);
		if (!file.startsWith(`${dist}/`) || !(await exists(file)))
			file = path.join(dist, 'index.html');
		const body = file.endsWith('index.html') ? index : await readFile(file);
		response.statusCode = 200;
		response.setHeader(
			'content-type',
			file.endsWith('.js')
				? 'text/javascript'
				: file.endsWith('.css')
					? 'text/css'
					: 'text/html',
		);
		response.end(body);
	});
	await new Promise<void>((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => resolve());
	});
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('Loopback server address differs');
	const requests: Array<{
		url: string;
		action: 'loopback' | 'fulfilled-api' | 'fulfilled-stylesheet' | 'rejected';
	}> = [];
	const pageErrors: string[] = [];
	let tagsRequests = 0;
	let articlesRequests = 0;
	let externalStylesheets = 0;
	let browser;
	try {
		browser = await chromium.launch({ headless: true, executablePath: chromiumPath });
		const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
		const page = await context.newPage();
		page.on('pageerror', (error) => pageErrors.push(error.message));
		await page.route('**/*', async (route) => {
			const url = route.request().url();
			const parsed = parseURL(url);
			if (parsed.host === `127.0.0.1:${address.port}`) {
				requests.push({ url, action: 'loopback' });
				await route.continue();
				return;
			}
			if (url === 'https://api.realworld.io/api/tags') {
				tagsRequests += 1;
				requests.push({ url, action: 'fulfilled-api' });
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ tags: ['migration', 'angular'] }),
				});
				return;
			}
			if (url === 'https://api.realworld.io/api/articles?limit=10&offset=0') {
				articlesRequests += 1;
				requests.push({ url, action: 'fulfilled-api' });
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						articles: [
							{
								slug: 'versionless-angular-baseline',
								title: 'Versionless Angular baseline',
								description:
									'Synthetic local evidence for the immutable Angular baseline.',
								body: 'Synthetic body.',
								tagList: ['migration'],
								createdAt: '2026-08-07T00:00:00.000Z',
								updatedAt: '2026-08-07T00:00:00.000Z',
								favorited: false,
								favoritesCount: 0,
								author: {
									username: 'versionless',
									bio: 'Synthetic local author.',
									image: '',
									following: false,
								},
							},
						],
						articlesCount: 1,
					}),
				});
				return;
			}
			if (route.request().resourceType() === 'stylesheet') {
				externalStylesheets += 1;
				requests.push({ url, action: 'fulfilled-stylesheet' });
				await route.fulfill({ status: 200, contentType: 'text/css', body: '' });
				return;
			}
			requests.push({ url, action: 'rejected' });
			await route.abort('blockedbyclient');
		});
		const initialStorage = await context.storageState();
		await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'networkidle' });
		for (const text of [
			'conduit',
			'A place to share your Angular knowledge.',
			'Global Feed',
			'Popular Tags',
			'migration',
			'Versionless Angular baseline',
			'Synthetic local evidence for the immutable Angular baseline.',
		])
			if ((await page.getByText(text, { exact: true }).count()) < 1)
				throw new Error(`Angular RealWorld smoke text is absent: ${text}`);
		if (
			tagsRequests !== 1 ||
			articlesRequests !== 1 ||
			externalStylesheets !== 3 ||
			pageErrors.length !== 0 ||
			requests.some((request) => request.action === 'rejected') ||
			initialStorage.cookies.length !== 0 ||
			initialStorage.origins.length !== 0
		)
			throw new Error('Angular RealWorld smoke request, error, or storage facts differ');
		await context.close();
		return {
			attempted: true,
			result: 'pass',
			browserSha256: CHROMIUM_SHA256,
			requests,
			tagsRequests,
			articlesRequests,
			externalStylesheets,
			pageErrors,
			storageInitiallyEmpty: true,
		};
	} finally {
		await browser?.close();
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
}

export async function runAngularRealWorldBaseline(): Promise<BaselineReceipt> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('Angular RealWorld baseline requires dual offline controls');
	await preserveHistoricalBaselineFailures();
	if (await exists(receiptPath))
		return verifyBaselineReceipt(JSON.parse(await readFile(receiptPath, 'utf8')));
	const acquisition = verifyAcquisitionReceipt(
		JSON.parse(await readFile(acquisitionEvidence, 'utf8')),
	);
	const publication = path.join(root, acquisition.publication);
	const manifest = JSON.parse(
		await readFile(path.join(publication, 'manifest.json'), 'utf8'),
	) as {
		source: { lockSha256: string };
	};
	if (sha256(await readFile(chromiumPath)) !== CHROMIUM_SHA256)
		throw new Error('Angular RealWorld cached Chromium SHA-256 differs');
	await rm(work, { recursive: true, force: true });
	await mkdir(work, { recursive: true });
	const runtimeExtract = path.join(work, 'runtime');
	await mkdir(runtimeExtract);
	const systemTar = await run(
		'tar',
		['-xzf', path.join(publication, 'node-runtime.tar.gz'), '-C', runtimeExtract],
		root,
		process.env,
	);
	if (systemTar.exitCode !== 0) throw new Error(`Node extraction failed: ${systemTar.stderr}`);
	const runtimeEntries = await readdir(runtimeExtract, { withFileTypes: true });
	if (runtimeEntries.length !== 1 || !runtimeEntries[0]?.isDirectory())
		throw new Error('Angular RealWorld runtime extraction root differs');
	const runtime = path.join(runtimeExtract, runtimeEntries[0].name);
	const node = path.join(runtime, 'bin/node');
	const npm = path.join(runtime, 'bin/npm');
	const nodeVersion = (await run(node, ['--version'], root, process.env)).stdout.trim();
	const npmVersion = (await run(npm, ['--version'], root, process.env)).stdout.trim();
	if (nodeVersion !== 'v18.20.8')
		throw new Error('Angular RealWorld pinned Node identity differs');
	const source = path.join(work, 'source');
	await cp(path.join(publication, 'source'), source, { recursive: true });
	const npmCache = path.join(work, 'npm-cache');
	await cp(path.join(publication, 'npm-cache'), npmCache, { recursive: true });
	const environment = {
		...process.env,
		PATH: `${path.join(runtime, 'bin')}:${process.env.PATH ?? ''}`,
		VERSIONLESS_NETWORK_MODE: 'offline',
		NPM_CONFIG_OFFLINE: 'true',
		npm_config_offline: 'true',
		NPM_CONFIG_CACHE: npmCache,
		npm_config_cache: npmCache,
		npm_config_ignore_scripts: 'true',
		npm_config_audit: 'false',
		npm_config_fund: 'false',
		npm_config_update_notifier: 'false',
		CI: '1',
	};
	const install = await run(
		npm,
		['ci', '--offline', '--ignore-scripts', '--no-audit', '--no-fund'],
		source,
		environment,
	);
	await mkdir(evidenceDirectory, { recursive: true });
	const installLog = `${install.stdout}${install.stderr}`;
	await writeFile(path.join(evidenceDirectory, 'install.log'), installLog);
	const lockUnchanged =
		sha256(await readFile(path.join(source, 'package-lock.json'))) ===
		manifest.source.lockSha256;
	const base = {
		schemaVersion: 'versionless.angular-realworld-v15-baseline.v1' as const,
		closureManifestSha256: acquisition.manifestSha256,
		runtime: {
			node: 'v18.20.8' as const,
			archiveSha256: NODE_ARCHIVE_SHA256,
			npm: npmVersion,
		},
		install: {
			exitCode: install.exitCode,
			offline: true as const,
			ignoreScripts: true as const,
			lockUnchanged,
			logSha256: sha256(installLog),
		},
		nonclaims: [
			'One immutable local baseline does not establish migration support, general Angular support, pilot status, production readiness, compliance, certification, signer authenticity, or OS-wide isolation.',
		],
	} as const;
	const emptySmoke: BaselineReceipt['smoke'] = {
		attempted: false,
		result: 'not-run',
		browserSha256: CHROMIUM_SHA256,
		requests: [],
		tagsRequests: 0,
		articlesRequests: 0,
		externalStylesheets: 0,
		pageErrors: [],
		storageInitiallyEmpty: false,
	};
	if (install.exitCode !== 0 || !lockUnchanged) {
		const receipt = finalizeBaseline({
			...base,
			result: 'baseline-failed',
			build: {
				attempted: false,
				exitCode: null,
				configuration: 'production',
				aot: true,
				mechanism: 'architect-target-override',
				optimization: ANGULAR_REALWORLD_BUILD_OPTIMIZATION,
				launcher: null,
				logSha256: null,
				distTreeSha256: null,
			},
			smoke: emptySmoke,
		});
		await writeReceipt(receipt);
		await removeNonLauncherScratch();
		return receipt;
	}
	const esbuildBinary = path.join(source, 'node_modules/@esbuild/darwin-arm64/bin/esbuild');
	if (!(await exists(esbuildBinary)))
		throw new Error('Locked Darwin arm64 esbuild binary is absent after offline npm ci');
	const esbuild = await run(esbuildBinary, ['--version'], source, environment);
	if (esbuild.exitCode !== 0) throw new Error('Locked Darwin arm64 esbuild binary is unusable');
	const launcherDirectory = path.join(work, 'launcher');
	const launcherOutputDirectory = path.join(work, 'launcher-dist');
	await mkdir(launcherDirectory);
	await mkdir(launcherOutputDirectory);
	const launcher = path.join(launcherDirectory, 'architect-launcher.cts');
	await writeFile(
		launcher,
		`const source: string | undefined = process.argv[2];
if (!source) throw new Error('Angular RealWorld Architect source argument is absent');
const { Architect } = require('@angular-devkit/architect');
const { WorkspaceNodeModulesArchitectHost } = require('@angular-devkit/architect/node');
const { logging, workspaces } = require('@angular-devkit/core');
const { NodeJsSyncHost } = require('@angular-devkit/core/node');
async function main(): Promise<void> {
  const workspaceHost = workspaces.createWorkspaceHost(new NodeJsSyncHost());
  const { workspace } = await workspaces.readWorkspace(source, workspaceHost);
  const architectHost = new WorkspaceNodeModulesArchitectHost(workspace, source);
  const architect = new Architect(architectHost);
  const logger = new logging.Logger('versionless-t214');
  logger.subscribe((entry: { message: unknown }) => process.stdout.write(String(entry.message) + '\\n'));
  const scheduled = await architect.scheduleTarget(
    { project: 'angular-conduit', target: 'build', configuration: 'production' },
    ${JSON.stringify({ aot: true, optimization: ANGULAR_REALWORLD_BUILD_OPTIMIZATION })},
    { logger },
  );
  try {
    const result = await scheduled.result;
    if (!result.success) process.exitCode = 1;
  } finally {
    await scheduled.stop();
  }
}
main().catch((error: unknown) => {
  process.stderr.write((error instanceof Error ? error.message : String(error)) + '\\n');
  process.exitCode = 1;
});
`,
		{ flag: 'wx' },
	);
	const compiler = path.join(source, 'node_modules/typescript/bin/tsc');
	const compilerVersionResult = await run(node, [compiler, '--version'], source, environment);
	const compilerVersion = compilerVersionResult.stdout.trim();
	const typesNode = JSON.parse(
		await readFile(path.join(source, 'node_modules/@types/node/package.json'), 'utf8'),
	) as { version?: unknown };
	if (
		compilerVersionResult.exitCode !== 0 ||
		compilerVersion !== 'Version 4.8.4' ||
		typesNode.version !== '18.15.11'
	)
		throw new Error('Angular RealWorld locked launcher compiler identity differs');
	const compileArguments = [
		compiler,
		'--pretty',
		'false',
		'--strict',
		'--noEmitOnError',
		'--target',
		'es2020',
		'--module',
		'commonjs',
		'--moduleResolution',
		'node',
		'--lib',
		'es2020',
		'--types',
		'node',
		'--typeRoots',
		path.join(source, 'node_modules/@types'),
		'--rootDir',
		launcherDirectory,
		'--outDir',
		launcherOutputDirectory,
		'--newLine',
		'lf',
		'--forceConsistentCasingInFileNames',
		launcher,
	] as const;
	const compilation = await run(node, compileArguments, source, environment);
	const compiledEntries = await readdir(launcherOutputDirectory, { withFileTypes: true });
	const compiledLauncher = path.join(launcherOutputDirectory, 'architect-launcher.cjs');
	if (
		compilation.exitCode !== 0 ||
		compiledEntries.length !== 1 ||
		compiledEntries[0]?.name !== 'architect-launcher.cjs' ||
		!compiledEntries[0].isFile()
	)
		throw new Error(
			`Angular RealWorld strict launcher compilation failed: ${compilation.stdout}${compilation.stderr}`,
		);
	const launcherEvidence: LauncherEvidence = {
		compiler: 'typescript',
		compilerVersion: 'Version 4.8.4',
		typesNodeVersion: '18.15.11',
		nodeVersion: 'v18.20.8',
		compileCommand: ANGULAR_REALWORLD_LAUNCHER_COMPILE_COMMAND,
		executionCommand: ANGULAR_REALWORLD_LAUNCHER_EXECUTION_COMMAND,
		options: ANGULAR_REALWORLD_LAUNCHER_OPTIONS,
		sourcePath: 'launcher/architect-launcher.cts',
		outputPath: 'launcher-dist/architect-launcher.cjs',
		sourceSha256: sha256(await readFile(launcher)),
		outputSha256: sha256(await readFile(compiledLauncher)),
	};
	const launcherEnvironment = {
		...environment,
		NODE_PATH: path.join(source, 'node_modules'),
	};
	const build = await run(node, [compiledLauncher, source], source, launcherEnvironment);
	const buildLog = `${compilation.stdout}${compilation.stderr}${build.stdout}${build.stderr}`;
	await writeFile(path.join(evidenceDirectory, 'build.log'), buildLog);
	const distRoot = path.join(source, 'dist');
	const indexFiles =
		build.exitCode === 0
			? (await filesBelow(distRoot)).filter((file) => path.basename(file) === 'index.html')
			: [];
	if (build.exitCode !== 0 || indexFiles.length !== 1) {
		const receipt = finalizeBaseline({
			...base,
			result: 'baseline-failed',
			build: {
				attempted: true,
				exitCode: build.exitCode,
				configuration: 'production',
				aot: true,
				mechanism: 'architect-target-override',
				optimization: ANGULAR_REALWORLD_BUILD_OPTIMIZATION,
				launcher: launcherEvidence,
				logSha256: sha256(buildLog),
				distTreeSha256: null,
			},
			smoke: emptySmoke,
		});
		await writeReceipt(receipt);
		await rm(work, { recursive: true, force: true });
		return receipt;
	}
	const dist = path.dirname(indexFiles[0]!);
	const distTreeSha256 = await treeDigest(dist);
	try {
		const smokeResult = await smoke(dist);
		const receipt = finalizeBaseline({
			...base,
			result: 'pass',
			build: {
				attempted: true,
				exitCode: 0,
				configuration: 'production',
				aot: true,
				mechanism: 'architect-target-override',
				optimization: ANGULAR_REALWORLD_BUILD_OPTIMIZATION,
				launcher: launcherEvidence,
				logSha256: sha256(buildLog),
				distTreeSha256,
			},
			smoke: smokeResult,
		});
		await writeReceipt(receipt);
		await removeNonLauncherScratch();
		return receipt;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const receipt = finalizeBaseline({
			...base,
			result: 'smoke-failed',
			build: {
				attempted: true,
				exitCode: 0,
				configuration: 'production',
				aot: true,
				mechanism: 'architect-target-override',
				optimization: ANGULAR_REALWORLD_BUILD_OPTIMIZATION,
				launcher: launcherEvidence,
				logSha256: sha256(buildLog),
				distTreeSha256,
			},
			smoke: {
				...emptySmoke,
				attempted: true,
				result: 'failed',
				pageErrors: [message],
			},
		});
		await writeReceipt(receipt);
		await removeNonLauncherScratch();
		return receipt;
	}
}

export async function main(): Promise<void> {
	const receipt = await runAngularRealWorldBaseline();
	process.stdout.write(canonical(receipt));
}

if (process.argv[1]?.endsWith('angular-realworld-v15-baseline-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
