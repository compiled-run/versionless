import { spawn } from 'node:child_process';
import {
	cp,
	lstat,
	mkdir,
	readFile,
	readdir,
	rename,
	rm,
	stat,
	symlink,
	writeFile,
} from 'node:fs/promises';
import http, { type Server } from 'node:http';
import { gzipSync } from 'node:zlib';
import { anyOf, char, charIn, createRegExp, digit, exactly, global, oneOrMore } from 'magic-regexp';
import * as path from 'pathe';
import { chromium, type Browser } from 'playwright';
import { decodePath, joinURL, parseHost, parseURL } from 'ufo';
import { canonicalize, receiptDigest, sha256 } from '../../../core/src/receipts/canonicalize.ts';
import { renderReceipt } from '../../../core/src/receipts/render.ts';
import {
	parseMigrationReceipt,
	type Artifact,
	type MigrationReceipt,
} from '../../../core/src/receipts/schema.ts';
import { verifyReceipt } from '../../../core/src/receipts/verify.ts';
import {
	planReactComposedMigration,
	REACT_COMPOSED_PATHS,
	REACT_COMPOSED_TARGET_HASHES,
	type ReactComposedInputs,
} from '../../../frameworks/react/src/react-composed-migration.ts';

const root = path.resolve(import.meta.dirname, '../../../..');
const fixtureRoot = path.join(root, 'fixtures/react-boilerplate-v4-composed');
const workRoot = path.join(root, '.versionless/work/react-boilerplate-v4-composed');
const artifactsRoot = path.join(root, 'evidence/runs/react-boilerplate-v4-composed/artifacts');
const node16Root = path.join(root, '.versionless/cache/react-boilerplate-v4/node16');
const node24Root = path.join(root, '.versionless/cache/react-boilerplate-v4-node24/node24');
const guard = path.join(root, 'packages/node-guard/dist/index.cjs');
const viteCli = path.join(root, 'node_modules/vite/bin/vite.js');
const vitePackage = path.join(root, 'node_modules/vite/package.json');
const ansi = createRegExp(
	exactly(String.fromCharCode(27), '['),
	charIn(';').from('0', '9').times.any(),
	'm',
	[global],
);
const viteDuration = createRegExp(
	anyOf(exactly('built in '), exactly('Build failed in ')),
	oneOrMore(digit),
	'ms',
	[global],
);
const webpackDuration = createRegExp(exactly('Time: '), oneOrMore(digit), 'ms', [global]);
const webpackBuiltAt = createRegExp(exactly('Built at: '), char.times.any(), [global]);

interface Manifest {
	id: string;
	source: {
		repository: string;
		revision: string;
		archiveSha256: string;
		license: string;
		licenseSha256: string;
	};
	originalWorktree: string;
	maintainedWorktree: string;
	targetHashes: {
		localeToggle: string;
		homePage: string;
		repoListItem: string;
		package: string;
		packageLock: string;
	};
	runtime: { legacy: string; target: string; node24Archive: string; node24ArchiveSha256: string };
	vite: {
		version: string;
		packageSha256: string;
		config: string;
		configSha256: string;
		html: string;
		htmlSha256: string;
	};
	browser: { executable: string; sha256: string };
	journey: string;
	payload: string;
}

interface Journey {
	qualificationRuns: number;
	initialPath: string;
	initialHeading: string;
	navigationName: string;
	navigationPath: string;
	returnName: string;
	localeControl: string;
	targetLocale: string;
	translatedHeading: string;
	username: string;
	requestUrl: string;
	locale: string;
	timezoneId: string;
	viewport: { width: number; height: number };
}

type LaneName = 'legacy' | 'target';
type MutationSeam =
	| 'locale-dispatch'
	| 'home-reducer-injection'
	| 'repository-load'
	| 'service-worker-registration';

export function isExpectedReactComposedMutationFailure(
	seam: MutationSeam,
	message: string,
): boolean {
	const expected = {
		'locale-dispatch': 'locale dispatch assertion failed',
		'home-reducer-injection': 'repository load assertion failed',
		'repository-load': 'repository load assertion failed',
		'service-worker-registration': 'service worker offline assertion failed',
	};
	return message === expected[seam];
}

function environment(nodeRoot: string): NodeJS.ProcessEnv {
	return {
		...process.env,
		PATH: `${path.join(nodeRoot, 'bin')}:${process.env.PATH ?? ''}`,
		VERSIONLESS_NETWORK_MODE: 'offline',
		NPM_CONFIG_OFFLINE: 'true',
		npm_config_offline: 'true',
		NODE_OPTIONS: `--require=${guard}`,
	};
}

function execute(cwd: string, nodeRoot: string, command: string, args: string[]) {
	return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
		const child = spawn(command, args, { cwd, env: environment(nodeRoot) });
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		child.stdout?.on('data', (value: Buffer) => stdout.push(value));
		child.stderr?.on('data', (value: Buffer) => stderr.push(value));
		child.once('error', reject);
		child.once('exit', (code) => {
			const result = {
				code: code ?? -1,
				stdout: Buffer.concat(stdout).toString(),
				stderr: Buffer.concat(stderr).toString(),
			};
			if (result.code === 0) resolve(result);
			else reject(new Error(`${command} exited ${result.code}: ${result.stderr}`));
		});
	});
}

function normalized(text: string): string {
	return text
		.replace(ansi, '')
		.replace(viteDuration, 'built in <duration>')
		.replace(webpackDuration, 'Time: <duration>')
		.replace(webpackBuiltAt, 'Built at: <normalized>')
		.split(`file://${root}`)
		.join('<checkout>')
		.split(root)
		.join('<checkout>');
}

async function filesBelow(directory: string): Promise<string[]> {
	const files: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const item = path.join(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await filesBelow(item)));
		else if (entry.isFile()) files.push(item);
	}
	return files.sort();
}

async function outputDigest(directory: string) {
	const files = await Promise.all(
		(await filesBelow(directory)).map(async (file) => ({
			path: path.relative(directory, file).split(path.sep).join('/'),
			sha256: sha256(await readFile(file)),
		})),
	);
	return { digest: sha256(canonicalize(files)), files };
}

async function artifact(name: string, value: unknown): Promise<Artifact> {
	const file = path.join(artifactsRoot, name);
	const content = typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`;
	await writeFile(file, content);
	return { path: path.relative(root, file), sha256: sha256(content) };
}

async function readInputs(directory: string): Promise<ReactComposedInputs> {
	return Object.fromEntries(
		await Promise.all(
			REACT_COMPOSED_PATHS.map(async (file) => [
				file,
				await readFile(path.join(directory, file), 'utf8'),
			]),
		),
	) as ReactComposedInputs;
}

async function preflight(manifest: Manifest) {
	const original = path.join(root, manifest.originalWorktree);
	const maintained = path.join(root, manifest.maintainedWorktree);
	const inputs = await readInputs(original);
	const maintainedPackage = await readFile(path.join(maintained, 'package.json'), 'utf8');
	const maintainedPackageLock = await readFile(
		path.join(maintained, 'package-lock.json'),
		'utf8',
	);
	const localeFirst = planReactComposedMigration({
		inputs,
		maintainedPackage,
		maintainedPackageLock,
		order: 'locale-first',
	});
	const dataFirst = planReactComposedMigration({
		inputs,
		maintainedPackage,
		maintainedPackageLock,
		order: 'data-flow-first',
	});
	const expectedManifestTargetHashes = {
		localeToggle: REACT_COMPOSED_TARGET_HASHES['app/containers/LocaleToggle/index.js'],
		homePage: REACT_COMPOSED_TARGET_HASHES['app/containers/HomePage/index.js'],
		repoListItem: REACT_COMPOSED_TARGET_HASHES['app/containers/RepoListItem/index.js'],
		package: REACT_COMPOSED_TARGET_HASHES['package.json'],
		packageLock: REACT_COMPOSED_TARGET_HASHES['package-lock.json'],
	};
	if (
		localeFirst.edits !== 13 ||
		dataFirst.edits !== 13 ||
		canonicalize(manifest.targetHashes) !== canonicalize(expectedManifestTargetHashes)
	)
		throw new Error('Refused: composed exact target binding or edit count changed');
	if (canonicalize(localeFirst.outputs) !== canonicalize(dataFirst.outputs))
		throw new Error('Composed transform orders differ');
	const pins = {
		node24Archive: sha256(await readFile(path.join(root, manifest.runtime.node24Archive))),
		vitePackage: sha256(await readFile(vitePackage)),
		viteConfig: sha256(await readFile(path.join(root, manifest.vite.config))),
		viteHtml: sha256(await readFile(path.join(root, manifest.vite.html))),
		browser: sha256(await readFile(path.join(root, manifest.browser.executable))),
	};
	if (
		pins.node24Archive !== manifest.runtime.node24ArchiveSha256 ||
		pins.vitePackage !== manifest.vite.packageSha256 ||
		pins.viteConfig !== manifest.vite.configSha256 ||
		pins.viteHtml !== manifest.vite.htmlSha256 ||
		pins.browser !== manifest.browser.sha256
	)
		throw new Error('Pinned composed runtime/build/browser input mismatch');
	if (
		(
			await execute(root, node16Root, path.join(node16Root, 'bin/node'), ['--version'])
		).stdout.trim() !== 'v16.20.2'
	)
		throw new Error('Pinned legacy Node changed');
	if (
		(
			await execute(root, node24Root, path.join(node24Root, 'bin/node'), ['--version'])
		).stdout.trim() !== 'v24.15.0'
	)
		throw new Error('Pinned target Node changed');
	return { original, maintained, inputs, localeFirst, dataFirst, pins };
}

async function copyLane(source: string, target: string): Promise<void> {
	await cp(source, target, {
		recursive: true,
		filter: (item) => !['node_modules', 'build', 'build-vite'].includes(path.basename(item)),
	});
}

async function exists(item: string): Promise<boolean> {
	try {
		await lstat(item);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
		throw error;
	}
}

async function stageTarget(source: string, maintained: string, stage: string): Promise<void> {
	await copyLane(source, stage);
	await symlink(path.join(maintained, 'node_modules'), path.join(stage, 'node_modules'));
	await writeFile(
		path.join(stage, 'index.html'),
		await readFile(path.join(root, 'fixtures/react-boilerplate-v4-vite8/index.html')),
	);
	if (!(await lstat(path.join(stage, 'node_modules'))).isSymbolicLink())
		throw new Error('Staged dependency closure link is not symbolic');
}

async function prepareLanes(prepared: Awaited<ReturnType<typeof preflight>>) {
	await rm(workRoot, { recursive: true, force: true });
	await mkdir(workRoot, { recursive: true });
	const legacy = path.join(workRoot, 'legacy');
	const target = path.join(workRoot, 'target');
	await copyLane(prepared.original, legacy);
	await symlink(path.join(prepared.original, 'node_modules'), path.join(legacy, 'node_modules'));
	if (!(await lstat(path.join(legacy, 'node_modules'))).isSymbolicLink())
		throw new Error('Prepared dependency closure links are not symbolic');
	if (await exists(target)) throw new Error('Atomic publication target must begin absent');
	const lateInputs = {
		...prepared.inputs,
		'app/containers/RepoListItem/index.js': `${prepared.inputs['app/containers/RepoListItem/index.js']}\n`,
	};
	let refused = false;
	try {
		planReactComposedMigration({
			inputs: lateInputs,
			maintainedPackage: prepared.localeFirst.outputs['package.json'],
			maintainedPackageLock: prepared.localeFirst.outputs['package-lock.json'],
			order: 'locale-first',
		});
	} catch {
		refused = true;
	}
	if (!refused || (await exists(target)))
		throw new Error('Late precondition failure did not leave published target absent');

	const failedStage = path.join(workRoot, 'target.stage-injected-failure');
	let injectedWriteFailure = false;
	let stagedWritesBeforeFailure = 0;
	try {
		await stageTarget(prepared.original, prepared.maintained, failedStage);
		const first = REACT_COMPOSED_PATHS[0];
		await writeFile(path.join(failedStage, first), prepared.localeFirst.outputs[first]);
		stagedWritesBeforeFailure++;
		throw new Error('Injected staged output write failure');
	} catch (error) {
		if (error instanceof Error && error.message === 'Injected staged output write failure')
			injectedWriteFailure = true;
		else throw error;
	} finally {
		await rm(failedStage, { recursive: true, force: true });
	}
	if (
		!injectedWriteFailure ||
		stagedWritesBeforeFailure < 1 ||
		(await exists(target)) ||
		(await exists(failedStage))
	)
		throw new Error('Injected staged-write failure violated publication rollback');

	const publishStage = path.join(workRoot, 'target.stage-publish');
	await stageTarget(prepared.original, prepared.maintained, publishStage);
	for (const file of REACT_COMPOSED_PATHS)
		await writeFile(path.join(publishStage, file), prepared.localeFirst.outputs[file]);
	const staged = await readInputs(publishStage);
	if (canonicalize(staged) !== canonicalize(prepared.localeFirst.outputs))
		throw new Error('Complete staged target differs from validated plan');
	if ((await stat(workRoot)).dev !== (await stat(publishStage)).dev)
		throw new Error('Refused: target stage and publication parent are not same-filesystem');
	if (await exists(target)) throw new Error('Refused: publication target already exists');
	await rename(publishStage, target);
	if ((await exists(publishStage)) || !(await exists(target)))
		throw new Error('Atomic staged-directory publication did not complete');
	const committed = await readInputs(target);
	if (canonicalize(committed) !== canonicalize(prepared.localeFirst.outputs))
		throw new Error('Atomic composed commit differs from complete plan');
	return {
		legacy,
		target,
		injectedWriteFailure,
		stagedWritesBeforeFailure,
		failedStageCleanup: true as const,
		publication: 'same-filesystem-staged-directory-rename' as const,
		rollback: 'published-target-unmodified' as const,
	};
}

async function webpackBuild(lane: string) {
	await rm(path.join(lane, 'build'), { recursive: true, force: true });
	const result = await execute(lane, node16Root, path.join(node16Root, 'bin/npm'), [
		'run',
		'build',
	]);
	const log = normalized(`${result.stdout}${result.stderr}`);
	if (!log.includes('webpack') || log.toLowerCase().includes('vite'))
		throw new Error('Legacy build did not prove webpack');
	const serviceWorker = path.join(lane, 'build/sw.js');
	const lines = (await readFile(serviceWorker, 'utf8')).split('\n');
	const versionLines = lines.filter((line) => line.startsWith('  "version": "'));
	if (versionLines.length !== 1)
		throw new Error('Generated webpack service-worker version seam changed');
	const canonicalServiceWorker = lines
		.map((line) =>
			line.startsWith('  "version": "') ? '  "version": "versionless-deterministic",' : line,
		)
		.join('\n');
	await writeFile(serviceWorker, canonicalServiceWorker);
	await writeFile(`${serviceWorker}.gz`, gzipSync(canonicalServiceWorker));
	return outputDigest(path.join(lane, 'build'));
}

async function viteBuild(lane: string) {
	await rm(path.join(lane, 'build-vite'), { recursive: true, force: true });
	const result = await execute(lane, node24Root, path.join(node24Root, 'bin/node'), [
		'--experimental-strip-types',
		viteCli,
		'build',
		'--config',
		path.join(root, 'fixtures/react-boilerplate-v4-vite8/vite.adapter.ts'),
	]);
	const log = normalized(`${result.stdout}${result.stderr}`);
	if (!log.includes('vite v8.0.16') || log.toLowerCase().includes('webpack'))
		throw new Error('Target build did not prove Vite 8.0.16');
	return outputDigest(path.join(lane, 'build-vite'));
}

async function serviceWorkerBuildEvidence(lane: string) {
	const output = path.join(lane, 'build-vite');
	const manifestBody = await readFile(path.join(output, 'precache-manifest.json'));
	const manifest = JSON.parse(manifestBody.toString('utf8')) as {
		schemaVersion: string;
		scope: string;
		entries: Array<{ url: string; sha256: string }>;
	};
	const expected = await Promise.all(
		(await filesBelow(output))
			.map((file) => path.relative(output, file).split(path.sep).join('/'))
			.filter((file) => !['precache-manifest.json', 'sw.js'].includes(file))
			.sort()
			.map(async (file) => ({
				url: joinURL('/', file),
				sha256: sha256(await readFile(path.join(output, file))),
			})),
	);
	if (
		manifest.schemaVersion !== 'versionless.react-vite8-precache.v1' ||
		manifest.scope !== '/' ||
		canonicalize(manifest.entries) !== canonicalize(expected) ||
		manifest.entries.some((entry) => parseURL(entry.url).host)
	)
		throw new Error('Service-worker precache manifest binding mismatch');
	return {
		workerSha256: sha256(await readFile(path.join(output, 'sw.js'))),
		manifestSha256: sha256(manifestBody),
		scope: '/',
		entries: expected,
	};
}

function contentType(file: string): string {
	switch (path.extname(file)) {
		case '.html':
			return 'text/html; charset=utf-8';
		case '.js':
			return 'text/javascript; charset=utf-8';
		case '.css':
			return 'text/css; charset=utf-8';
		case '.json':
			return 'application/json';
		case '.ico':
			return 'image/x-icon';
		default:
			return 'application/octet-stream';
	}
}

async function startServer(lane: string, laneName: LaneName, port: number): Promise<Server> {
	const output = path.join(lane, laneName === 'legacy' ? 'build' : 'build-vite');
	const server = http.createServer(async (request, response) => {
		try {
			const pathname = decodePath(parseURL(request.url ?? '/').pathname || '/');
			const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
			let file = path.resolve(output, relative);
			if (
				!file.startsWith(`${output}${path.sep}`) &&
				file !== path.join(output, 'index.html')
			)
				throw new Error('Parent traversal refused');
			try {
				if (!(await stat(file)).isFile()) file = path.join(output, 'index.html');
			} catch {
				file = path.join(output, 'index.html');
			}
			response.writeHead(200, { 'content-type': contentType(file) });
			response.end(await readFile(file));
		} catch (error) {
			response.writeHead(500);
			response.end(error instanceof Error ? error.message : String(error));
		}
	});
	await new Promise<void>((resolve, reject) => {
		server.once('error', reject);
		server.listen(port, '127.0.0.1', resolve);
	});
	return server;
}

async function journeyRun(options: {
	browser: Browser;
	lane: string;
	laneName: LaneName;
	journey: Journey;
	payload: unknown;
	port: number;
	run: number;
	expectedFailure?: MutationSeam;
}) {
	const context = await options.browser.newContext({
		locale: options.journey.locale,
		timezoneId: options.journey.timezoneId,
		viewport: options.journey.viewport,
	});
	const syntheticRequests: Array<{ method: string; url: string; kind: string }> = [];
	const blocked: string[] = [];
	const successfulNonLoopback: string[] = [];
	const consoleErrors: string[] = [];
	const pageErrors: string[] = [];
	const synthetic = new Set<string>();
	const syntheticBlockedResponses = new Set<string>();
	await context.route('**/*', async (route) => {
		const request = route.request();
		if (request.url() === options.journey.requestUrl) {
			synthetic.add(request.url());
			syntheticRequests.push({
				method: request.method(),
				url: request.url(),
				kind: 'synthetic-interception',
			});
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(options.payload),
			});
			return;
		}
		const url = parseURL(request.url());
		if (['127.0.0.1', 'localhost', '::1'].includes(parseHost(url.host ?? '').hostname))
			await route.continue();
		else {
			blocked.push(request.url());
			syntheticBlockedResponses.add(request.url());
			await route.fulfill({ status: 204, body: '' });
		}
	});
	const page = await context.newPage();
	page.on('response', (response) => {
		const url = parseURL(response.url());
		if (
			!['127.0.0.1', 'localhost', '::1'].includes(parseHost(url.host ?? '').hostname) &&
			!synthetic.has(response.url()) &&
			!syntheticBlockedResponses.has(response.url()) &&
			response.ok()
		)
			successfulNonLoopback.push(response.url());
	});
	page.on('console', (message) => {
		if (message.type() === 'error') consoleErrors.push(message.text());
	});
	page.on('pageerror', (error) => pageErrors.push(error.message));
	let failed = false;
	let serviceWorker: Record<string, unknown> | null = null;
	try {
		await page.goto(joinURL(`http://127.0.0.1:${options.port}`, options.journey.initialPath), {
			waitUntil: 'networkidle',
		});
		await page.getByRole('heading', { name: options.journey.initialHeading }).waitFor();
		if (options.expectedFailure === 'service-worker-registration') {
			await page.waitForTimeout(500);
			if (
				(await page.evaluate(
					async () => (await navigator.serviceWorker.getRegistrations()).length,
				)) !== 0
			)
				throw new Error('service worker mutation unexpectedly registered');
			await context.setOffline(true);
			try {
				await page.reload({ waitUntil: 'domcontentloaded', timeout: 2_000 });
			} catch {
				failed = true;
			}
			if (!failed) throw new Error('service worker offline assertion did not fail');
			throw new Error('service worker offline assertion failed');
		}
		await page.evaluate(async () => navigator.serviceWorker.ready);
		await page.reload({ waitUntil: 'networkidle' });
		serviceWorker = await page.evaluate(async () => {
			const registration = await navigator.serviceWorker.ready;
			const cacheNames = (await caches.keys()).sort();
			const inventory = (
				await Promise.all(
					cacheNames.map(async (name) => {
						const cache = await caches.open(name);
						return (await cache.keys()).map((request) => new URL(request.url).pathname);
					}),
				)
			)
				.flat()
				.sort();
			return {
				registration: 'active',
				scope: new URL(registration.scope).pathname,
				controller: navigator.serviceWorker.controller?.state ?? 'missing',
				cacheNames,
				inventory,
			};
		});
		if (serviceWorker.scope !== '/' || serviceWorker.controller !== 'activated')
			throw new Error('Service worker did not control the exact application scope');
		await context.setOffline(true);
		await page.reload({ waitUntil: 'networkidle' });
		await page.getByRole('heading', { name: options.journey.initialHeading }).waitFor();
		await page.getByRole('link', { name: options.journey.navigationName }).click();
		if (parseURL(page.url()).pathname !== options.journey.navigationPath)
			throw new Error('Navigation assertion failed');
		await page.getByRole('link', { name: options.journey.returnName }).click();
		const control = page.locator(options.journey.localeControl);
		await control.selectOption(options.journey.targetLocale);
		if ((await control.inputValue()) !== options.journey.targetLocale)
			throw new Error('locale dispatch assertion failed');
		try {
			await page
				.getByRole('heading', { name: options.journey.translatedHeading })
				.waitFor({ timeout: 3_000 });
		} catch {
			throw new Error('locale dispatch assertion failed');
		}
		const input = page.locator('#username');
		await input.fill(options.journey.username);
		await input.press('Enter');
		try {
			await page
				.getByRole('link', { name: 'owned-repo', exact: true })
				.waitFor({ timeout: 3_000 });
		} catch {
			throw new Error('repository load assertion failed');
		}
		if (syntheticRequests.length !== 1 || syntheticRequests[0]?.method !== 'GET')
			throw new Error('repository load assertion failed');
		await page.getByRole('link', { name: 'fork-owner/forked-repo', exact: true }).waitFor();
		await page.getByText('3', { exact: true }).waitFor();
		await page.getByText('7', { exact: true }).waitFor();
	} catch (error) {
		if (
			options.expectedFailure &&
			error instanceof Error &&
			isExpectedReactComposedMutationFailure(options.expectedFailure, error.message)
		)
			failed = true;
		else throw error;
	} finally {
		await context.close();
	}
	if (options.expectedFailure && !failed)
		throw new Error('Mutation did not fail intended assertion');
	if (!options.expectedFailure && (consoleErrors.length || pageErrors.length))
		throw new Error(
			`Unexpected browser errors: ${JSON.stringify({ consoleErrors, pageErrors })}`,
		);
	if (successfulNonLoopback.length)
		throw new Error(`Successful non-loopback traffic: ${successfulNonLoopback.join(', ')}`);
	return {
		lane: options.laneName,
		run: options.run,
		result: options.expectedFailure ? 'intended-failure' : 'pass',
		selectedLocale: options.journey.targetLocale,
		translatedHeading: options.journey.translatedHeading,
		username: options.journey.username,
		syntheticRequests,
		repositories: ['owned-repo', 'fork-owner/forked-repo'],
		issueCounts: [3, 7],
		blocked: [...new Set(blocked)].sort(),
		successfulNonLoopback,
		consoleErrors,
		pageErrors,
		serviceWorker,
		offlineReload:
			options.expectedFailure === 'service-worker-registration' ? 'intended-failure' : 'pass',
	};
}

async function withJourney(
	manifest: Manifest,
	options: Omit<Parameters<typeof journeyRun>[0], 'browser'>,
) {
	const browser = await chromium.launch({
		headless: true,
		executablePath: path.join(root, manifest.browser.executable),
	});
	const server = await startServer(options.lane, options.laneName, options.port);
	try {
		return await journeyRun({ ...options, browser });
	} finally {
		await new Promise<void>((resolve, reject) =>
			server.close((error) => (error ? reject(error) : resolve())),
		);
		await browser.close();
	}
}

export async function verifyReactBoilerplateComposed({
	receiptPath,
}: {
	receiptPath: string;
}): Promise<MigrationReceipt> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('fixture:verify requires explicit offline mode');
	const manifest = JSON.parse(
		await readFile(path.join(fixtureRoot, 'fixture.json'), 'utf8'),
	) as Manifest;
	const journey = JSON.parse(
		await readFile(path.join(root, manifest.journey), 'utf8'),
	) as Journey;
	const payload = JSON.parse(
		await readFile(path.join(root, manifest.payload), 'utf8'),
	) as unknown;
	// This is deliberately the first operation that can mutate the workspace.
	const preflighted = await preflight(manifest);
	await rm(artifactsRoot, { recursive: true, force: true });
	await mkdir(artifactsRoot, { recursive: true });
	const lanes = await prepareLanes(preflighted);
	const artifacts: Artifact[] = [
		await artifact('preparation.json', {
			schemaVersion: 'versionless.react-composed-preparation.v1',
			pins: preflighted.pins,
			sourceHashes: preflighted.localeFirst.sourceHashes,
			targetHashes: preflighted.localeFirst.targetHashes,
			allInputsPreflightedBeforeWrites: true,
			networkUsed: false,
		}),
	];
	artifacts.push(
		await artifact('composition.json', {
			schemaVersion: 'versionless.react-composed-plan.v1',
			requestedOrders: ['locale-first', 'data-flow-first'],
			executionTraces: [
				{
					order: preflighted.localeFirst.order,
					steps: preflighted.localeFirst.executionTrace,
				},
				{
					order: preflighted.dataFirst.order,
					steps: preflighted.dataFirst.executionTrace,
				},
			],
			actualOrdersExecuted: true,
			outputsEqual: true,
			latePreconditionFailure: 'refused',
			publish: lanes.publication,
			injectedWriteFailure: lanes.injectedWriteFailure ? 'refused' : 'not-tested',
			stagedWritesBeforeFailure: lanes.stagedWritesBeforeFailure,
			rollback: lanes.rollback,
			failedStageCleanup: lanes.failedStageCleanup,
		}),
	);
	artifacts.push(
		await artifact('transform.json', {
			semanticEngine: preflighted.localeFirst.semanticEngine,
			edits: preflighted.localeFirst.edits,
			changedFiles: REACT_COMPOSED_PATHS,
			sourceHashes: preflighted.localeFirst.sourceHashes,
			targetHashes: preflighted.localeFirst.targetHashes,
		}),
	);
	const legacyFirst = await webpackBuild(lanes.legacy);
	const legacySecond = await webpackBuild(lanes.legacy);
	const targetFirst = await viteBuild(lanes.target);
	const targetServiceWorkerFirst = await serviceWorkerBuildEvidence(lanes.target);
	const targetSecond = await viteBuild(lanes.target);
	const targetServiceWorkerSecond = await serviceWorkerBuildEvidence(lanes.target);
	if (
		legacyFirst.digest !== legacySecond.digest ||
		canonicalize(legacyFirst.files) !== canonicalize(legacySecond.files) ||
		targetFirst.digest !== targetSecond.digest ||
		canonicalize(targetFirst.files) !== canonicalize(targetSecond.files) ||
		canonicalize(targetServiceWorkerFirst) !== canonicalize(targetServiceWorkerSecond)
	)
		throw new Error('Clean build outputs are not byte-identical');
	const builds = [
		{
			lane: 'legacy',
			bundler: 'webpack-4.30.0',
			first: legacyFirst,
			second: legacySecond,
			equal: true,
		},
		{
			lane: 'target',
			bundler: 'vite-8.0.16',
			first: targetFirst,
			second: targetSecond,
			serviceWorker: targetServiceWorkerFirst,
			equal: true,
		},
	];
	artifacts.push(await artifact('build.json', builds));
	const runs = [];
	let port = 43420;
	for (const [laneName, lane] of [
		['legacy', lanes.legacy],
		['target', lanes.target],
	] as const)
		for (let run = 1; run <= journey.qualificationRuns; run++)
			runs.push(
				await withJourney(manifest, {
					lane,
					laneName,
					journey,
					payload,
					port: port++,
					run,
				}),
			);
	for (const laneName of ['legacy', 'target']) {
		const rows = runs.filter((row) => row.lane === laneName);
		if (canonicalize(rows[0]) !== canonicalize({ ...rows[1], run: 1 }))
			throw new Error(`${laneName} qualification journeys differ`);
	}
	artifacts.push(await artifact('journey.json', runs));
	const mutations = [];
	for (const mutation of [
		{
			seam: 'home-reducer-injection' as const,
			file: 'app/containers/HomePage/index.js',
			before: 'const withReducer = injectReducer({ key, reducer });',
			after: 'const withReducer = injectReducer({ key, reducer: (state = reducer(undefined, {})) => state });',
		},
		{
			seam: 'locale-dispatch' as const,
			file: 'app/containers/LocaleToggle/index.js',
			before: 'const onLocaleToggle = evt => dispatch(changeLocale(evt.target.value));',
			after: 'const onLocaleToggle = () => undefined;',
		},
		{
			seam: 'repository-load' as const,
			file: 'app/containers/HomePage/index.js',
			before: '    dispatch(loadRepos());',
			after: '    void loadRepos;',
		},
		{
			seam: 'service-worker-registration' as const,
			file: 'app/app.js',
			before: "require('offline-plugin/runtime').install(); // eslint-disable-line global-require",
			after: '// Versionless mutation: service-worker registration disabled.',
		},
	]) {
		const file = path.join(lanes.target, mutation.file);
		const restored = await readFile(file, 'utf8');
		const restoredSha256 = sha256(restored);
		const changed = restored.replace(mutation.before, mutation.after);
		if (changed === restored || changed.includes(mutation.before))
			throw new Error(`Mutation seam missing: ${mutation.seam}`);
		let failure;
		try {
			await writeFile(file, changed);
			await viteBuild(lanes.target);
			failure = await withJourney(manifest, {
				lane: lanes.target,
				laneName: 'target',
				journey,
				payload,
				port: port++,
				run: 1,
				expectedFailure: mutation.seam,
			});
		} finally {
			await writeFile(file, restored);
		}
		if (sha256(await readFile(file)) !== restoredSha256)
			throw new Error(`Mutation restoration differs: ${mutation.seam}`);
		await viteBuild(lanes.target);
		const restoredServiceWorker = await serviceWorkerBuildEvidence(lanes.target);
		if (canonicalize(restoredServiceWorker) !== canonicalize(targetServiceWorkerFirst))
			throw new Error(`Service-worker restoration output differs: ${mutation.seam}`);
		const reproduced = await withJourney(manifest, {
			lane: lanes.target,
			laneName: 'target',
			journey,
			payload,
			port: port++,
			run: 1,
		});
		mutations.push({
			seam: mutation.seam,
			result: failure.result,
			restoration: 'byte-identical',
			restoredSha256,
			reproduced: reproduced.result,
		});
	}
	if (
		canonicalize(mutations.map((mutation) => mutation.seam)) !==
		canonicalize([
			'home-reducer-injection',
			'locale-dispatch',
			'repository-load',
			'service-worker-registration',
		])
	)
		throw new Error('React composed mutation order or membership changed');
	artifacts.push(await artifact('mutation.json', { mutations, isolated: true }));
	artifacts.push(
		await artifact('migration-diff.json', {
			changedFiles: REACT_COMPOSED_PATHS,
			harnessOnlyAdapterExcluded: true,
			sourceHashes: preflighted.localeFirst.sourceHashes,
			targetHashes: preflighted.localeFirst.targetHashes,
		}),
	);
	const locality = {
		mode: 'offline' as const,
		scope: 'Versionless-spawned Node/npm/webpack/Vite child processes and Playwright browser requests',
		osWideIsolation: false as const,
		successfulNonLoopback: 0 as const,
		browserBlockedRequests: runs.flatMap((run) => run.blocked).length,
		syntheticInterceptions: runs.flatMap((run) => run.syntheticRequests).length,
	};
	artifacts.push(await artifact('locality.json', locality));
	artifacts.push(
		await artifact('runtime.json', {
			legacy: {
				node: '16.20.2-darwin-arm64 EOL compatibility sandbox',
				bundler: 'webpack-4.30.0',
			},
			target: {
				node: '24.15.0-darwin-arm64 maintained runtime',
				bundler: 'vite-8.0.16',
				reactRedux: '7.1.3',
			},
		}),
	);
	const core = {
		fixture: manifest.id,
		revision: manifest.source.revision,
		builds: builds.map((build) => ({ lane: build.lane, digest: build.first.digest })),
		journeys: runs,
		sourceHashes: preflighted.localeFirst.sourceHashes,
		targetHashes: preflighted.localeFirst.targetHashes,
		ordersEqual: true,
		executionTraces: [
			preflighted.localeFirst.executionTrace,
			preflighted.dataFirst.executionTrace,
		],
		publication: lanes.publication,
		lateFailureRollback: lanes.rollback,
		mutations: mutations.map(({ seam, result, restoration, reproduced }) => ({
			seam,
			result,
			restoration,
			reproduced,
		})),
	};
	const first = sha256(canonicalize(core));
	const second = sha256(canonicalize(JSON.parse(JSON.stringify(core))));
	if (first !== second) throw new Error('Deterministic core mismatch');
	artifacts.push(await artifact('deterministic-core.json', { first, second, equal: true }));
	const changedFiles = [...REACT_COMPOSED_PATHS] as [string, string, string, string, string];
	const receipt: MigrationReceipt = {
		schemaVersion: 'versionless.receipt.v1',
		runId: 'T060-react-boilerplate-v4-composed',
		fixture: manifest.id,
		source: manifest.source,
		tooling: {
			legacyNode: '16.20.2-darwin-arm64 EOL compatibility sandbox',
			targetNode: '24.15.0-darwin-arm64 maintained runtime',
			legacyBundler: 'webpack-4.30.0',
			targetBundler: 'Vite-8.0.16 fixture-specific adapter',
			playwright: '1.58.2',
			chromium: '145.0.7632.6',
			yuku: 'parser/analyzer 0.7.0',
		},
		consent: [
			{
				id: 'T008-fixture-ingest',
				purpose: 'reuse immutable licensed d19099 source and locked dependencies',
				mode: 'consented',
			},
			{
				id: 'T022-react-node24-ingest',
				purpose: 'reuse pinned Node 24 runtime and maintained dependency closure',
				mode: 'consented',
			},
		],
		migration: {
			file: changedFiles.join(' + '),
			transform: 'react-composed-connect-to-hooks',
			edits: preflighted.localeFirst.edits,
			changedFiles,
			orders: ['locale-first', 'data-flow-first'],
			executionTraces: [
				preflighted.localeFirst.executionTrace,
				preflighted.dataFirst.executionTrace,
			],
			actualOrdersExecuted: true,
			atomic: true,
			publication: lanes.publication,
			injectedWriteFailure: 'refused',
			lateFailureRollback: lanes.rollback,
			failedStageCleanup: lanes.failedStageCleanup,
			harnessOnlyAdapterExcluded: true,
			sourceHashes: preflighted.localeFirst.sourceHashes,
			targetHashes: preflighted.localeFirst.targetHashes,
		},
		verification: {
			result: 'pass',
			builds: 'pass',
			journeys: 'pass',
			mutation: 'pass',
			locality,
			deterministicCore: { first, second, equal: true },
			serviceWorker: {
				workerPath: 'sw.js',
				manifestPath: 'precache-manifest.json',
				scope: '/',
				manifestSha256: targetServiceWorkerFirst.manifestSha256,
				cacheName: `versionless-react-vite8-${targetServiceWorkerFirst.manifestSha256}`,
				currentCacheOnly: true,
				inventoryMatchesManifest: true,
				exactCurrentCacheFetch: true,
				buildsEqual: true,
				registration: 'active',
				controller: 'activated',
				offlineJourney: 'pass',
				mutation: 'intended-failure',
				restoration: 'byte-identical',
				coverage: 'exact-qualified-journey-only',
			},
		},
		artifacts,
		integrity: { algorithm: 'sha256', canonicalDigest: '', authenticity: 'not-established' },
		limitations: [
			'This cumulative vertical remains one React Boilerplate source application and is not a designated pilot or third application.',
			'The target Vite adapter is fixture-specific; no generic, unplugin, old-Vite, or additional bundler support is established.',
			'Synthetic GitHub interception proves no live API access.',
			'Payment-page applicability and global dynamic insertion are not established; PCI compliance and certification are not claimed.',
			'Hash integrity does not establish authenticity, signer identity, signed or Git provenance.',
			'Network controls are process-scoped and do not establish OS-wide isolation.',
			'Service-worker parity covers only the exact qualified offline journey, not global offline or PWA correctness.',
		],
	};
	receipt.integrity.canonicalDigest = receiptDigest(receipt);
	parseMigrationReceipt(receipt);
	const absolute = path.resolve(receiptPath);
	await mkdir(path.dirname(absolute), { recursive: true });
	await writeFile(absolute, `${JSON.stringify(receipt, null, 2)}\n`);
	await writeFile(
		absolute.endsWith('.json') ? `${absolute.slice(0, -5)}.md` : `${absolute}.md`,
		renderReceipt(receipt),
	);
	const aggregatePath = path.join(root, 'evidence/runs/aggregate.json');
	const aggregate = JSON.parse(await readFile(aggregatePath, 'utf8')) as {
		fixtures: Array<Record<string, unknown>>;
		unsupported: unknown[];
	};
	const fixtures = aggregate.fixtures.filter((item) => item.id !== manifest.id);
	fixtures.push({
		id: manifest.id,
		framework: 'react',
		bundler: 'webpack-4-to-vite-8',
		runtime: 'node-16.20.2-to-node-24.15.0',
		result: 'pass',
		receipt: path.relative(root, absolute),
		digest: receipt.integrity.canonicalDigest,
	});
	await writeFile(aggregatePath, `${JSON.stringify({ ...aggregate, fixtures }, null, 2)}\n`);
	await verifyReceipt(absolute);
	return receipt;
}
