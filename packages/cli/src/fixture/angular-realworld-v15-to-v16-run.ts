import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { access, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { chromium } from 'playwright';
import { parseURL } from 'ufo';
import { canonicalize, sha256 } from '../../../core/src/index.ts';
import {
	PARENT_COMMIT,
	TARGET_COMMIT,
	TARGET_PACKAGE_SHA256,
	verifyV16Acquisition,
} from './angular-realworld-v15-to-v16-ingest.ts';
import { CHROMIUM_SHA256, NODE_ARCHIVE_SHA256 } from './angular-realworld-v15-ingest.ts';

const root = path.resolve(import.meta.dirname, '../../../..');
const work = path.join(root, '.versionless/work/angular-realworld-v15-to-v16');
const evidenceDirectory = path.join(root, 'evidence/runs/angular-realworld-v15-to-v16');
const receiptPath = path.join(evidenceDirectory, 'receipt.json');
const failurePath = path.join(evidenceDirectory, 'terminal-failure.json');
const v15Publication = path.join(
	root,
	'.versionless/cache/angular-realworld-v15/closures/d3576ef3443079903aa0fa2c2337fbf8fcab88fdfeea3ff5b8de03e99587b8f9',
);
const v16Evidence = path.join(root, 'evidence/ingests/angular-realworld-v16/receipt.json');
const chromiumPath = path.join(
	root,
	'.versionless/cache/react-boilerplate-v4/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell',
);
const optimization = {
	scripts: true,
	styles: { minify: true, inlineCritical: true },
	fonts: { inline: false },
} as const;

type CommandResult = Readonly<{
	exitCode: number;
	stdout: string;
	stderr: string;
}>;
type Launcher = Readonly<{
	compilerVersion: 'Version 4.8.4' | 'Version 5.1.6';
	typesNodeVersion: '18.15.11';
	nodeVersion: 'v18.20.8';
	sourceSha256: string;
	outputSha256: string;
	output: string;
}>;
type BuildEvidence = Readonly<{
	exitCode: 0;
	aot: true;
	mechanism: 'architect-target-override';
	optimization: typeof optimization;
	distTreeSha256: string;
	launcher: Launcher;
}>;
type InstallEvidence = Readonly<{
	exitCode: 0;
	offline: true;
	ignoreScripts: true;
	lockUnchanged: true;
	logSha256: string;
	legacyPeerDeps: boolean;
	npmVersion: '10.8.2';
	compatibilityReason: 'not-required' | 'immutable-upstream-rx-angular-15-peer-metadata';
}>;
type Journey = Readonly<{
	lane: 'legacy' | 'target';
	pass: 1 | 2;
	result: 'pass';
	tagsRequests: 1;
	articlesRequests: 1;
	externalStylesheets: 3;
	storageInitiallyEmpty: true;
	pageErrors: readonly [];
	rejectedRequests: 0;
	successfulNonLoopback: 0;
	observations: readonly string[];
}>;

export type MigrationReceipt = Readonly<{
	schemaVersion: 'versionless.angular-realworld-v15-to-v16.v1';
	result: 'pass';
	status?: 'pass';
	source: Readonly<{
		parentCommit: typeof PARENT_COMMIT;
		targetCommit: typeof TARGET_COMMIT;
		parentVerified: true;
	}>;
	migration: Readonly<{
		changedFiles: readonly ['package-lock.json', 'package.json'];
		applicationFilesChanged: 0;
	}>;
	legacy: Readonly<{
		install: InstallEvidence;
		build: BuildEvidence;
		distDigest?: string;
	}>;
	target: Readonly<{
		install: InstallEvidence;
		build: BuildEvidence;
		distDigest?: string;
	}>;
	parity: Readonly<{ identical: true; journeys: readonly Journey[] }>;
	journeys?: readonly Journey[];
	mutation:
		| Readonly<{
				seam: 'target-api-origin';
				file: 'src/app/core/interceptors/api.interceptor.ts';
				originalHash: '5afdac9c0ed22ea38ebba4e957455563ba92d9704a3027b952b239793bbbf1f4';
				from: 'https://api.realworld.io/api';
				to: 'https://invalid.versionless.test/api';
				reason: 'unexpected-nonloopback-api-binding';
				rejectedUrls: readonly string[];
				successfulNonLoopback: 0;
				restoration: Readonly<{
					sourceHash: '5afdac9c0ed22ea38ebba4e957455563ba92d9704a3027b952b239793bbbf1f4';
					packageHash: typeof TARGET_PACKAGE_SHA256;
					distDigest: 'f1915039e70a1f5058343b5daa08c97b4cdce496fee571abfab20a686877c185';
					status: 'pass';
				}>;
		  }>
		| Readonly<{
				field: 'dependencies.@angular/core';
				from: '16.2.11';
				to: '15.2.3';
				result: 'intended-failure';
				restoration: 'byte-identical';
				restorationSha256: typeof TARGET_PACKAGE_SHA256;
				reproduced: 'pass';
				failureLogSha256: string;
		  }>;
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
		else throw new Error('Angular migration output contains special filesystem entry');
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

export function finalizeMigration(value: Omit<MigrationReceipt, 'integrity'>): MigrationReceipt {
	const receipt = { ...value, integrity: { algorithm: 'sha256' as const, canonicalDigest: '' } };
	return {
		...receipt,
		integrity: { algorithm: 'sha256', canonicalDigest: sha256(canonicalize(receipt)) },
	};
}

export function verifyMigration(value: unknown): MigrationReceipt {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error('Angular migration receipt must be an object');
	const receipt = value as MigrationReceipt;
	const copy = structuredClone(receipt);
	(copy.integrity as { canonicalDigest: string }).canonicalDigest = '';
	const expectedRejected = [
		'https://invalid.versionless.test/api/articles?limit=10&offset=0',
		'https://invalid.versionless.test/api/tags',
	];
	if (
		receipt.schemaVersion !== 'versionless.angular-realworld-v15-to-v16.v1' ||
		receipt.result !== 'pass' ||
		receipt.status !== 'pass' ||
		receipt.integrity.algorithm !== 'sha256' ||
		sha256(canonicalize(copy)) !== receipt.integrity.canonicalDigest ||
		receipt.source.parentCommit !== PARENT_COMMIT ||
		receipt.source.targetCommit !== TARGET_COMMIT ||
		receipt.legacy.distDigest !==
			'34bbecf0f342a65b6c813e6d93f07dd93397716915f0673ac9251a175ca77274' ||
		receipt.target.distDigest !==
			'f1915039e70a1f5058343b5daa08c97b4cdce496fee571abfab20a686877c185' ||
		receipt.target.install.legacyPeerDeps !== true ||
		receipt.target.install.npmVersion !== '10.8.2' ||
		receipt.target.install.compatibilityReason !==
			'immutable-upstream-rx-angular-15-peer-metadata' ||
		!receipt.journeys ||
		canonicalize(receipt.journeys) !== canonicalize(receipt.parity.journeys) ||
		receipt.parity.journeys.length !== 4 ||
		!('seam' in receipt.mutation) ||
		receipt.mutation.seam !== 'target-api-origin' ||
		receipt.mutation.file !== 'src/app/core/interceptors/api.interceptor.ts' ||
		receipt.mutation.originalHash !==
			'5afdac9c0ed22ea38ebba4e957455563ba92d9704a3027b952b239793bbbf1f4' ||
		receipt.mutation.from !== 'https://api.realworld.io/api' ||
		receipt.mutation.to !== 'https://invalid.versionless.test/api' ||
		receipt.mutation.reason !== 'unexpected-nonloopback-api-binding' ||
		canonicalize([...receipt.mutation.rejectedUrls].sort()) !==
			canonicalize(expectedRejected) ||
		receipt.mutation.successfulNonLoopback !== 0 ||
		receipt.mutation.restoration.sourceHash !==
			'5afdac9c0ed22ea38ebba4e957455563ba92d9704a3027b952b239793bbbf1f4' ||
		receipt.mutation.restoration.packageHash !== TARGET_PACKAGE_SHA256 ||
		receipt.mutation.restoration.distDigest !==
			'f1915039e70a1f5058343b5daa08c97b4cdce496fee571abfab20a686877c185' ||
		receipt.mutation.restoration.status !== 'pass' ||
		receipt.parity.journeys.some(
			(journey) =>
				journey.result !== 'pass' ||
				journey.tagsRequests !== 1 ||
				journey.articlesRequests !== 1 ||
				journey.externalStylesheets !== 3 ||
				!journey.storageInitiallyEmpty ||
				journey.pageErrors.length !== 0 ||
				journey.rejectedRequests !== 0 ||
				journey.successfulNonLoopback !== 0,
		)
	)
		throw new Error('Angular migration receipt differs');
	return receipt;
}

async function install(
	npm: string,
	source: string,
	lockSha256: string,
	environment: NodeJS.ProcessEnv,
	label: string,
	legacyPeerDeps = false,
): Promise<InstallEvidence> {
	const arguments_ = ['ci', '--offline', '--ignore-scripts', '--no-audit', '--no-fund'];
	if (legacyPeerDeps) arguments_.push('--legacy-peer-deps');
	const result = await run(npm, arguments_, source, environment);
	const log = `${result.stdout}${result.stderr}`;
	await writeFile(path.join(evidenceDirectory, `${label}-install.log`), log);
	if (
		result.exitCode !== 0 ||
		sha256(await readFile(path.join(source, 'package-lock.json'))) !== lockSha256
	)
		throw new Error(`Angular migration ${label} offline install failed`);
	return {
		exitCode: 0,
		offline: true,
		ignoreScripts: true,
		lockUnchanged: true,
		logSha256: sha256(log),
		legacyPeerDeps,
		npmVersion: '10.8.2',
		compatibilityReason: legacyPeerDeps
			? 'immutable-upstream-rx-angular-15-peer-metadata'
			: 'not-required',
	};
}

function launcherSource(): string {
	return `const source: string | undefined = process.argv[2];
if (!source) throw new Error('Angular migration Architect source argument is absent');
const { Architect } = require('@angular-devkit/architect');
const { WorkspaceNodeModulesArchitectHost } = require('@angular-devkit/architect/node');
const { logging, workspaces } = require('@angular-devkit/core');
const { NodeJsSyncHost } = require('@angular-devkit/core/node');
async function main(): Promise<void> {
  const host = workspaces.createWorkspaceHost(new NodeJsSyncHost());
  const { workspace } = await workspaces.readWorkspace(source, host);
  const architect = new Architect(new WorkspaceNodeModulesArchitectHost(workspace, source));
  const logger = new logging.Logger('versionless-t218');
  logger.subscribe((entry: { message: unknown }) => process.stdout.write(String(entry.message) + '\\n'));
  const scheduled = await architect.scheduleTarget(
    { project: 'angular-conduit', target: 'build', configuration: 'production' },
    ${JSON.stringify({ aot: true, optimization })},
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
`;
}

async function build(
	node: string,
	source: string,
	environment: NodeJS.ProcessEnv,
	lane: 'legacy' | 'target',
	label: string,
): Promise<{ evidence: BuildEvidence; dist: string }> {
	const launcherRoot = path.join(work, 'launchers', label);
	const launcherOutput = path.join(work, 'launcher-dist', label);
	await mkdir(launcherRoot, { recursive: true });
	await mkdir(launcherOutput, { recursive: true });
	const launcher = path.join(launcherRoot, 'architect-launcher.cts');
	await writeFile(launcher, launcherSource(), { flag: 'wx' });
	const compiler = path.join(source, 'node_modules/typescript/bin/tsc');
	const compilerVersionResult = await run(node, [compiler, '--version'], source, environment);
	const compilerVersion = compilerVersionResult.stdout.trim();
	const expectedCompiler = lane === 'legacy' ? 'Version 4.8.4' : 'Version 5.1.6';
	const typesNode = JSON.parse(
		await readFile(path.join(source, 'node_modules/@types/node/package.json'), 'utf8'),
	) as { version?: unknown };
	if (compilerVersion !== expectedCompiler || typesNode.version !== '18.15.11')
		throw new Error(`Angular migration ${lane} compiler identity differs`);
	const compilation = await run(
		node,
		[
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
			launcherRoot,
			'--outDir',
			launcherOutput,
			'--newLine',
			'lf',
			'--forceConsistentCasingInFileNames',
			launcher,
		],
		source,
		environment,
	);
	const outputEntries = await readdir(launcherOutput, { withFileTypes: true });
	const compiled = path.join(launcherOutput, 'architect-launcher.cjs');
	if (
		compilation.exitCode !== 0 ||
		outputEntries.length !== 1 ||
		outputEntries[0]?.name !== 'architect-launcher.cjs' ||
		!outputEntries[0].isFile()
	)
		throw new Error(`Angular migration ${lane} strict launcher compilation failed`);
	const execution = await run(node, [compiled, source], source, {
		...environment,
		NODE_PATH: path.join(source, 'node_modules'),
	});
	const log = `${compilation.stdout}${compilation.stderr}${execution.stdout}${execution.stderr}`;
	await writeFile(path.join(evidenceDirectory, `${label}-build.log`), log);
	if (execution.exitCode !== 0) throw new Error(`Angular migration ${lane} build failed`);
	const indexes = (await filesBelow(path.join(source, 'dist'))).filter(
		(file) => path.basename(file) === 'index.html',
	);
	if (indexes.length !== 1) throw new Error(`Angular migration ${lane} index output differs`);
	const dist = path.dirname(indexes[0]!);
	return {
		evidence: {
			exitCode: 0,
			aot: true,
			mechanism: 'architect-target-override',
			optimization,
			distTreeSha256: await treeDigest(dist),
			launcher: {
				compilerVersion: expectedCompiler,
				typesNodeVersion: '18.15.11',
				nodeVersion: 'v18.20.8',
				sourceSha256: sha256(await readFile(launcher)),
				outputSha256: sha256(await readFile(compiled)),
				output: path.relative(work, compiled),
			},
		},
		dist,
	};
}

async function journey(dist: string, lane: 'legacy' | 'target', pass: 1 | 2): Promise<Journey> {
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
	if (!address || typeof address === 'string')
		throw new Error('Angular migration loopback differs');
	let browser;
	let tagsRequests = 0;
	let articlesRequests = 0;
	let externalStylesheets = 0;
	let rejectedRequests = 0;
	const pageErrors: string[] = [];
	const observations = [
		'conduit',
		'A place to share your Angular knowledge.',
		'Global Feed',
		'Popular Tags',
		'migration',
		'Versionless Angular baseline',
		'Synthetic local evidence for the immutable Angular baseline.',
	];
	try {
		browser = await chromium.launch({ headless: true, executablePath: chromiumPath });
		const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
		const page = await context.newPage();
		page.on('pageerror', (error) => pageErrors.push(error.message));
		await page.route('**/*', async (route) => {
			const url = route.request().url();
			const parsed = parseURL(url);
			if (parsed.host === `127.0.0.1:${address.port}`) {
				await route.continue();
				return;
			}
			if (url === 'https://api.realworld.io/api/tags') {
				tagsRequests += 1;
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ tags: ['migration', 'angular'] }),
				});
				return;
			}
			if (url === 'https://api.realworld.io/api/articles?limit=10&offset=0') {
				articlesRequests += 1;
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
				await route.fulfill({ status: 200, contentType: 'text/css', body: '' });
				return;
			}
			rejectedRequests += 1;
			await route.abort('blockedbyclient');
		});
		const initial = await context.storageState();
		await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'networkidle' });
		for (const text of observations)
			if ((await page.getByText(text, { exact: true }).count()) < 1)
				throw new Error(`Angular migration journey text is absent: ${text}`);
		if (
			tagsRequests !== 1 ||
			articlesRequests !== 1 ||
			externalStylesheets !== 3 ||
			rejectedRequests !== 0 ||
			pageErrors.length !== 0 ||
			initial.cookies.length !== 0 ||
			initial.origins.length !== 0
		)
			throw new Error(`Angular migration ${lane} journey differs`);
		await context.close();
		return {
			lane,
			pass,
			result: 'pass',
			tagsRequests: 1,
			articlesRequests: 1,
			externalStylesheets: 3,
			storageInitiallyEmpty: true,
			pageErrors: [],
			rejectedRequests: 0,
			successfulNonLoopback: 0,
			observations,
		};
	} finally {
		await browser?.close();
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
}

async function mutationJourney(dist: string): Promise<readonly string[]> {
	const expected = [
		'https://invalid.versionless.test/api/articles?limit=10&offset=0',
		'https://invalid.versionless.test/api/tags',
	] as const;
	const rejected: string[] = [];
	const pageErrors: string[] = [];
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
	if (!address || typeof address === 'string')
		throw new Error('Angular migration mutation loopback differs');
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
				await route.continue();
				return;
			}
			if ((expected as readonly string[]).includes(url)) {
				rejected.push(url);
				await route.abort('blockedbyclient');
				return;
			}
			if (route.request().resourceType() === 'stylesheet') {
				await route.fulfill({ status: 200, contentType: 'text/css', body: '' });
				return;
			}
			throw new Error(`Angular migration mutation unexpected request: ${url}`);
		});
		const initial = await context.storageState();
		await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'networkidle' });
		const sorted = [...rejected].sort();
		if (
			canonicalize(sorted) !== canonicalize([...expected].sort()) ||
			initial.cookies.length !== 0 ||
			initial.origins.length !== 0 ||
			pageErrors.length !== 0
		)
			throw new Error('Angular migration mutation route rejection differs');
		await context.close();
		return sorted;
	} finally {
		await browser?.close();
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
}

export async function runMigration(): Promise<MigrationReceipt> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('Angular migration requires dual offline controls');
	if (await exists(receiptPath))
		return verifyMigration(JSON.parse(await readFile(receiptPath, 'utf8')));
	if (await exists(failurePath))
		throw new Error('Angular migration terminal evidence already exists');
	await rm(work, { recursive: true, force: true });
	await mkdir(evidenceDirectory, { recursive: true });
	await mkdir(work, { recursive: true });
	try {
		const targetAcquisition = verifyV16Acquisition(
			JSON.parse(await readFile(v16Evidence, 'utf8')),
		);
		const v16Publication = path.join(root, targetAcquisition.publication);
		const v15Manifest = JSON.parse(
			await readFile(path.join(v15Publication, 'manifest.json'), 'utf8'),
		) as { source: { lockSha256: string; packageSha256: string } };
		const v16Manifest = JSON.parse(
			await readFile(path.join(v16Publication, 'manifest.json'), 'utf8'),
		) as { source: { lockSha256: string; packageSha256: string } };
		if (sha256(await readFile(chromiumPath)) !== CHROMIUM_SHA256)
			throw new Error('Angular migration Chromium identity differs');
		const runtimeRoot = path.join(work, 'runtime');
		await mkdir(runtimeRoot);
		const extraction = await run(
			'tar',
			['-xzf', path.join(v15Publication, 'node-runtime.tar.gz'), '-C', runtimeRoot],
			root,
			process.env,
		);
		if (extraction.exitCode !== 0) throw new Error('Angular migration Node extraction failed');
		const runtimeEntries = await readdir(runtimeRoot, { withFileTypes: true });
		if (runtimeEntries.length !== 1 || !runtimeEntries[0]?.isDirectory())
			throw new Error('Angular migration Node extraction differs');
		const runtime = path.join(runtimeRoot, runtimeEntries[0].name);
		const node = path.join(runtime, 'bin/node');
		const npm = path.join(runtime, 'bin/npm');
		if ((await run(node, ['--version'], root, process.env)).stdout.trim() !== 'v18.20.8')
			throw new Error('Angular migration Node identity differs');
		const lanesRoot = path.join(work, 'lanes');
		const legacySource = path.join(lanesRoot, 'legacy');
		const targetSource = path.join(lanesRoot, 'target');
		await cp(path.join(v15Publication, 'source'), legacySource, { recursive: true });
		await cp(path.join(v15Publication, 'source'), targetSource, { recursive: true });
		await cp(
			path.join(v16Publication, 'source/package.json'),
			path.join(targetSource, 'package.json'),
		);
		await cp(
			path.join(v16Publication, 'source/package-lock.json'),
			path.join(targetSource, 'package-lock.json'),
		);
		if (
			sha256(await readFile(path.join(targetSource, 'package.json'))) !==
				v16Manifest.source.packageSha256 ||
			sha256(await readFile(path.join(targetSource, 'package-lock.json'))) !==
				v16Manifest.source.lockSha256
		)
			throw new Error('Angular migration two-file reproduction differs');
		const retained = path.join(work, 'dist');
		await mkdir(retained);
		const laneSetup = async (
			lane: 'legacy' | 'target',
			source: string,
			publication: string,
			lockSha256: string,
		) => {
			const cache = path.join(work, 'npm-cache', lane);
			await cp(path.join(publication, 'npm-cache'), cache, { recursive: true });
			const environment = {
				...process.env,
				PATH: `${path.join(runtime, 'bin')}:${process.env.PATH ?? ''}`,
				VERSIONLESS_NETWORK_MODE: 'offline',
				NPM_CONFIG_OFFLINE: 'true',
				npm_config_offline: 'true',
				NPM_CONFIG_CACHE: cache,
				npm_config_cache: cache,
				npm_config_ignore_scripts: 'true',
				npm_config_audit: 'false',
				npm_config_fund: 'false',
				CI: '1',
			};
			const installation = await install(
				npm,
				source,
				lockSha256,
				environment,
				lane,
				lane === 'target',
			);
			const built = await build(node, source, environment, lane, lane);
			return { installation, built, environment };
		};
		const legacy = await laneSetup(
			'legacy',
			legacySource,
			v15Publication,
			v15Manifest.source.lockSha256,
		);
		await cp(legacy.built.dist, path.join(retained, 'legacy'), { recursive: true });
		const journeys: Journey[] = [
			await journey(path.join(retained, 'legacy'), 'legacy', 1),
			await journey(path.join(retained, 'legacy'), 'legacy', 2),
		];
		const target = await laneSetup(
			'target',
			targetSource,
			v16Publication,
			v16Manifest.source.lockSha256,
		);
		await cp(target.built.dist, path.join(retained, 'target-initial'), { recursive: true });
		journeys.push(await journey(path.join(retained, 'target-initial'), 'target', 1));
		const packagePath = path.join(targetSource, 'package.json');
		const originalPackage = await readFile(packagePath);
		if (sha256(originalPackage) !== TARGET_PACKAGE_SHA256)
			throw new Error('Angular migration target package identity differs before mutation');
		const before = '"@angular/core": "16.2.11"';
		const after = '"@angular/core": "15.2.3"';
		const text = originalPackage.toString('utf8');
		if (!text.includes(before) || text.indexOf(before) !== text.lastIndexOf(before))
			throw new Error('Angular migration mutation field representation differs');
		const mutated = Buffer.from(text.replace(before, after));
		await writeFile(packagePath, mutated);
		const mutationInstall = await run(
			npm,
			[
				'ci',
				'--offline',
				'--ignore-scripts',
				'--no-audit',
				'--no-fund',
				'--legacy-peer-deps',
			],
			targetSource,
			target.environment,
		);
		const mutationLog = `${mutationInstall.stdout}${mutationInstall.stderr}`;
		await writeFile(path.join(evidenceDirectory, 'mutation-install.log'), mutationLog);
		if (
			mutationInstall.exitCode === 0 ||
			!mutationLog.includes('@angular/core') ||
			sha256(await readFile(path.join(targetSource, 'package-lock.json'))) !==
				v16Manifest.source.lockSha256
		)
			throw new Error(
				'Angular migration lock-mismatch mutation did not fail at intended seam',
			);
		await writeFile(packagePath, originalPackage);
		if (sha256(await readFile(packagePath)) !== TARGET_PACKAGE_SHA256)
			throw new Error('Angular migration package restoration differs');
		const restoredInstall = await install(
			npm,
			targetSource,
			v16Manifest.source.lockSha256,
			target.environment,
			'target-restored',
			true,
		);
		const restoredBuild = await build(
			node,
			targetSource,
			target.environment,
			'target',
			'target-restored',
		);
		if (restoredBuild.evidence.distTreeSha256 !== target.built.evidence.distTreeSha256)
			throw new Error('Angular migration restored target build digest differs');
		await cp(restoredBuild.dist, path.join(retained, 'target'), { recursive: true });
		journeys.push(await journey(path.join(retained, 'target'), 'target', 2));
		const comparable = journeys.map(({ lane: _lane, pass: _pass, ...value }) =>
			canonicalize(value),
		);
		if (new Set(comparable).size !== 1)
			throw new Error('Angular migration parity observations differ');
		const receipt = finalizeMigration({
			schemaVersion: 'versionless.angular-realworld-v15-to-v16.v1',
			result: 'pass',
			source: {
				parentCommit: PARENT_COMMIT,
				targetCommit: TARGET_COMMIT,
				parentVerified: true,
			},
			migration: {
				changedFiles: ['package-lock.json', 'package.json'],
				applicationFilesChanged: 0,
			},
			legacy: { install: legacy.installation, build: legacy.built.evidence },
			target: { install: restoredInstall, build: restoredBuild.evidence },
			parity: { identical: true, journeys },
			mutation: {
				field: 'dependencies.@angular/core',
				from: '16.2.11',
				to: '15.2.3',
				result: 'intended-failure',
				restoration: 'byte-identical',
				restorationSha256: TARGET_PACKAGE_SHA256,
				reproduced: 'pass',
				failureLogSha256: sha256(mutationLog),
			},
			nonclaims: [
				'One immutable adjacent-major experiment; no generic Angular support, pilot, production readiness, certification, authenticity, signed provenance, or OS-wide isolation claim.',
			],
		});
		await writeFile(receiptPath, canonical(receipt), { flag: 'wx' });
		return receipt;
	} catch (error) {
		await writeFile(
			failurePath,
			canonical({
				schemaVersion: 'versionless.angular-realworld-v15-to-v16-failure.v1',
				result: 'failed',
				reason: error instanceof Error ? error.message : String(error),
			}),
			{ flag: 'wx' },
		).catch(() => undefined);
		throw error;
	}
}

async function continueT218(): Promise<MigrationReceipt> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('Angular migration requires dual offline controls');
	if (await exists(receiptPath))
		return verifyMigration(JSON.parse(await readFile(receiptPath, 'utf8')));
	const continuationFailure = path.join(evidenceDirectory, 't220-terminal-failure.json');
	if (await exists(continuationFailure))
		throw new Error('Angular migration continuation terminal evidence already exists');
	try {
		const archivedHashes = {
			'attempt1-legacy-build.log':
				'659396969d0c5ce9a676f7d54b31e9603fe7f0a526d1ba233eb0cd06aba337ea',
			'attempt1-legacy-install.log':
				'cc19d1229a3bbeb03a73783ad47819438fedddb5a080b96cd2745650b5026fe8',
			'attempt1-target-install.log':
				'3c634b492720515950aebeef2931fca0c7817cc97d87232d48f66d52367b2508',
			'attempt1-target-peer-resolution-failure.json':
				'8bfdafebcdf7cf50ea88d8f8217666a3510fd862de1399b641b04a7879692be6',
			't218-legacy-build.log':
				'55722e21d3ff8c03d5f78373d754c1b0df076fad0e200a4c04b67eb4edf21764',
			't218-legacy-install.log':
				'cc19d1229a3bbeb03a73783ad47819438fedddb5a080b96cd2745650b5026fe8',
			't218-target-build.log':
				'52a893fafbc20f6462b6ff14590c27cb90b1eaef7ee32ae25712fd32e898978c',
			't218-target-install.log':
				'dab7e9a2c4b321880102e6a37e6a89ed618f7d8c3a446bb9850f5301c5e62cd9',
			't218-mutation-enotcached.log':
				'8a10a78a285aef7a67e15ffbd5cced908c239315e8a8045ae2b5e32a5b866b1e',
			't218-terminal-failure.json':
				'fec986ee2b9d97cd208f9e46670741bdbe2e645dc98e771063544a92c2753151',
		} as const;
		for (const [name, expected] of Object.entries(archivedHashes))
			if (sha256(await readFile(path.join(evidenceDirectory, name))) !== expected)
				throw new Error(`Angular migration archived T218 evidence differs: ${name}`);
		const terminalArchive = path.join(work, 't218-evidence');
		if (
			sha256(await readFile(path.join(terminalArchive, 'mutated-target-package.json'))) !==
				'3c7c60915b9ad202cdac4a0c6c086b5bbd92915ebbc67e835e34cf39edc23dd6' ||
			sha256(await readFile(path.join(terminalArchive, 'mutation-enotcached-debug.log'))) !==
				'fe9e0daf350d2c38899739cdc40fd61c77cf46238eb8be232c997ab117d34809'
		)
			throw new Error('Angular migration archived T218 terminal state differs');

		const targetAcquisition = verifyV16Acquisition(
			JSON.parse(await readFile(v16Evidence, 'utf8')),
		);
		const v16Publication = path.join(root, targetAcquisition.publication);
		const manifest = JSON.parse(
			await readFile(path.join(v16Publication, 'manifest.json'), 'utf8'),
		) as { source: { lockSha256: string; packageSha256: string } };
		const targetSource = path.join(work, 'lanes/target');
		const packageFile = path.join(targetSource, 'package.json');
		const lockFile = path.join(targetSource, 'package-lock.json');
		const interceptorFile = path.join(
			targetSource,
			'src/app/core/interceptors/api.interceptor.ts',
		);
		if (
			sha256(await readFile(packageFile)) !==
				'3c7c60915b9ad202cdac4a0c6c086b5bbd92915ebbc67e835e34cf39edc23dd6' ||
			sha256(await readFile(lockFile)) !==
				'030d8e0661fc5a0cfa54cffa3a7a33a488cdc6007e8671f7f52d87306f356016' ||
			sha256(await readFile(interceptorFile)) !==
				'5afdac9c0ed22ea38ebba4e957455563ba92d9704a3027b952b239793bbbf1f4'
		)
			throw new Error('Angular migration terminal target state differs');
		const retained = path.join(work, 'dist');
		const legacyDist = path.join(retained, 'legacy');
		const targetInitialDist = path.join(retained, 'target-initial');
		if (
			(await filesBelow(legacyDist)).length !== 15 ||
			(await treeDigest(legacyDist)) !==
				'34bbecf0f342a65b6c813e6d93f07dd93397716915f0673ac9251a175ca77274' ||
			(await filesBelow(targetInitialDist)).length !== 15 ||
			(await treeDigest(targetInitialDist)) !==
				'f1915039e70a1f5058343b5daa08c97b4cdce496fee571abfab20a686877c185'
		)
			throw new Error('Angular migration retained distribution differs');

		await cp(path.join(v16Publication, 'source/package.json'), packageFile);
		if (
			sha256(await readFile(packageFile)) !== TARGET_PACKAGE_SHA256 ||
			sha256(await readFile(lockFile)) !== manifest.source.lockSha256
		)
			throw new Error('Angular migration published package restoration differs');
		const runtimeRoot = path.join(work, 'runtime');
		const runtimeEntries = await readdir(runtimeRoot, { withFileTypes: true });
		if (runtimeEntries.length !== 1 || !runtimeEntries[0]?.isDirectory())
			throw new Error('Angular migration retained Node runtime differs');
		const runtime = path.join(runtimeRoot, runtimeEntries[0].name);
		const node = path.join(runtime, 'bin/node');
		const npm = path.join(runtime, 'bin/npm');
		if (
			(await run(node, ['--version'], root, process.env)).stdout.trim() !== 'v18.20.8' ||
			(await run(npm, ['--version'], root, process.env)).stdout.trim() !== '10.8.2' ||
			sha256(await readFile(chromiumPath)) !== CHROMIUM_SHA256
		)
			throw new Error('Angular migration retained runtime identity differs');
		const cache = path.join(work, 'npm-cache/target');
		const environment = {
			...process.env,
			PATH: `${path.join(runtime, 'bin')}:${process.env.PATH ?? ''}`,
			VERSIONLESS_NETWORK_MODE: 'offline',
			NPM_CONFIG_OFFLINE: 'true',
			npm_config_offline: 'true',
			NPM_CONFIG_CACHE: cache,
			npm_config_cache: cache,
			npm_config_ignore_scripts: 'true',
			npm_config_audit: 'false',
			npm_config_fund: 'false',
			CI: '1',
		};
		await install(
			npm,
			targetSource,
			manifest.source.lockSha256,
			environment,
			'target-policy-restored',
			true,
		);
		if (
			sha256(await readFile(packageFile)) !== TARGET_PACKAGE_SHA256 ||
			sha256(await readFile(lockFile)) !== manifest.source.lockSha256
		)
			throw new Error('Angular migration peer compatibility install changed source bytes');

		const originalInterceptor = await readFile(interceptorFile);
		const originalHash = sha256(originalInterceptor);
		if (originalHash !== '5afdac9c0ed22ea38ebba4e957455563ba92d9704a3027b952b239793bbbf1f4')
			throw new Error('Angular migration interceptor identity differs');
		const from = 'https://api.realworld.io/api';
		const to = 'https://invalid.versionless.test/api';
		const interceptorText = originalInterceptor.toString('utf8');
		if (
			!interceptorText.includes(from) ||
			interceptorText.indexOf(from) !== interceptorText.lastIndexOf(from)
		)
			throw new Error('Angular migration API origin representation differs');
		await writeFile(interceptorFile, interceptorText.replace(from, to));
		const mutatedBuild = await build(
			node,
			targetSource,
			environment,
			'target',
			'target-api-mutation',
		);
		const rejectedUrls = await mutationJourney(mutatedBuild.dist);
		await writeFile(
			path.join(evidenceDirectory, 'target-api-mutation.json'),
			canonical({
				schemaVersion: 'versionless.angular-realworld-v15-to-v16-mutation.v1',
				result: 'rejected',
				reason: 'unexpected-nonloopback-api-binding',
				rejectedUrls,
				successfulNonLoopback: 0,
			}),
			{ flag: 'wx' },
		);

		await writeFile(interceptorFile, originalInterceptor);
		await cp(path.join(v16Publication, 'source/package.json'), packageFile);
		if (
			sha256(await readFile(interceptorFile)) !== originalHash ||
			sha256(await readFile(packageFile)) !== TARGET_PACKAGE_SHA256 ||
			sha256(await readFile(lockFile)) !== manifest.source.lockSha256
		)
			throw new Error('Angular migration target source restoration differs');
		const restoredInstall = await install(
			npm,
			targetSource,
			manifest.source.lockSha256,
			environment,
			'target-restored',
			true,
		);
		const restoredBuild = await build(
			node,
			targetSource,
			environment,
			'target',
			'target-restored',
		);
		const targetDigest = 'f1915039e70a1f5058343b5daa08c97b4cdce496fee571abfab20a686877c185';
		if (
			restoredBuild.evidence.distTreeSha256 !== targetDigest ||
			(await treeDigest(targetInitialDist)) !== targetDigest
		)
			throw new Error('Angular migration restored target build digest differs');
		const targetDist = path.join(retained, 'target');
		await cp(restoredBuild.dist, targetDist, { recursive: true, errorOnExist: true });
		if (
			(await filesBelow(targetDist)).length !== 15 ||
			(await treeDigest(targetDist)) !== targetDigest
		)
			throw new Error('Angular migration retained restored target distribution differs');

		const journeys: Journey[] = [
			await journey(legacyDist, 'legacy', 1),
			await journey(legacyDist, 'legacy', 2),
			await journey(targetDist, 'target', 1),
			await journey(targetDist, 'target', 2),
		];
		const comparable = journeys.map(({ lane: _lane, pass: _pass, ...value }) =>
			canonicalize(value),
		);
		if (new Set(comparable).size !== 1)
			throw new Error('Angular migration parity observations differ');
		const legacyInstall: InstallEvidence = {
			exitCode: 0,
			offline: true,
			ignoreScripts: true,
			lockUnchanged: true,
			logSha256: archivedHashes['t218-legacy-install.log'],
			legacyPeerDeps: false,
			npmVersion: '10.8.2',
			compatibilityReason: 'not-required',
		};
		const legacyBuild: BuildEvidence = {
			exitCode: 0,
			aot: true,
			mechanism: 'architect-target-override',
			optimization,
			distTreeSha256: '34bbecf0f342a65b6c813e6d93f07dd93397716915f0673ac9251a175ca77274',
			launcher: {
				compilerVersion: 'Version 4.8.4',
				typesNodeVersion: '18.15.11',
				nodeVersion: 'v18.20.8',
				sourceSha256: '6f0cdd3e551f7bee2b66f1c0eb1601c6d122b0ba0fa43851866509a54d419d80',
				outputSha256: '332679b9279e8c7da30fd27cf00284fa6d17a6ea73a32ab335c504430cd9620e',
				output: 'launcher-dist/legacy/architect-launcher.cjs',
			},
		};
		const receipt = finalizeMigration({
			schemaVersion: 'versionless.angular-realworld-v15-to-v16.v1',
			result: 'pass',
			status: 'pass',
			source: {
				parentCommit: PARENT_COMMIT,
				targetCommit: TARGET_COMMIT,
				parentVerified: true,
			},
			migration: {
				changedFiles: ['package-lock.json', 'package.json'],
				applicationFilesChanged: 0,
			},
			legacy: {
				install: legacyInstall,
				build: legacyBuild,
				distDigest: legacyBuild.distTreeSha256,
			},
			target: {
				install: restoredInstall,
				build: restoredBuild.evidence,
				distDigest: targetDigest,
			},
			parity: { identical: true, journeys },
			journeys,
			mutation: {
				seam: 'target-api-origin',
				file: 'src/app/core/interceptors/api.interceptor.ts',
				originalHash,
				from,
				to,
				reason: 'unexpected-nonloopback-api-binding',
				rejectedUrls,
				successfulNonLoopback: 0,
				restoration: {
					sourceHash: originalHash,
					packageHash: TARGET_PACKAGE_SHA256,
					distDigest: targetDigest,
					status: 'pass',
				},
			},
			nonclaims: [
				'One immutable adjacent-major experiment; no generic Angular support, pilot, production readiness, certification, authenticity, signed provenance, or OS-wide isolation claim.',
			],
		});
		await writeFile(receiptPath, canonical(receipt), { flag: 'wx' });
		return receipt;
	} catch (error) {
		await writeFile(
			continuationFailure,
			canonical({
				schemaVersion: 'versionless.angular-realworld-v15-to-v16-t220-failure.v1',
				result: 'failed',
				reason: error instanceof Error ? error.message : String(error),
			}),
			{ flag: 'wx' },
		).catch(() => undefined);
		throw error;
	}
}

export async function main(): Promise<void> {
	if (!process.argv.slice(2).includes('--continue-t218'))
		throw new Error('Angular migration continuation requires --continue-t218');
	process.stdout.write(canonical(await continueT218()));
}

if (process.argv[1]?.endsWith('angular-realworld-v15-to-v16-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
