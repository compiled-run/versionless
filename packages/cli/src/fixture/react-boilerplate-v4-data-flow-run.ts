import { spawn } from 'node:child_process';
import {
	cp,
	lstat,
	mkdir,
	readFile,
	readdir,
	realpath,
	rm,
	stat,
	writeFile,
} from 'node:fs/promises';
import http, { type Server } from 'node:http';
import { anyOf, charIn, createRegExp, digit, exactly, global, oneOrMore } from 'magic-regexp';
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
	transformHomePageConnectToHooks,
	transformRepoListItemConnectToHooks,
} from '../../../frameworks/react/src/react-data-flow-connect-to-hooks.ts';

const root = path.resolve(import.meta.dirname, '../../../..');
const fixtureRoot = path.join(root, 'fixtures/react-boilerplate-v4-data-flow');
const workRoot = path.join(root, '.versionless/work/react-boilerplate-v4-data-flow');
const artifactsRoot = path.join(root, 'evidence/runs/react-boilerplate-v4-data-flow/artifacts');
const runtimeCache = path.join(root, '.versionless/cache/react-boilerplate-v4-node24');
const guard = path.join(root, 'packages/node-guard/dist/index.cjs');
const viteCli = path.join(root, 'node_modules/vite/bin/vite.js');
const vitePackage = path.join(root, 'node_modules/vite/package.json');
const ansiColorSequence = createRegExp(
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
const intendedJourneyFailure = createRegExp(
	anyOf('synthetic request count assertion failed', 'owned repository name assertion failed'),
);

export function isExpectedReactDataFlowMutationFailure(
	seam:
		| 'home-load-repos-dispatch'
		| 'home-reducer-injection'
		| 'repo-current-user-selector'
		| 'service-worker-registration',
	message: string,
): boolean {
	return seam === 'home-reducer-injection' && message === 'Username input-state assertion failed';
}

interface FixtureManifest {
	id: string;
	source: {
		repository: string;
		revision: string;
		archiveSha256: string;
		license: string;
		licenseSha256: string;
	};
	baseline: {
		receipt: string;
		receiptDigest: string;
		worktree: string;
		homePageSha256: string;
		repoListItemSha256: string;
		packageSha256: string;
		packageLockSha256: string;
	};
	runtime: { version: string; archive: string; archiveSha256: string };
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

function markdownPath(jsonPath: string): string {
	return jsonPath.endsWith('.json')
		? `${jsonPath.slice(0, -'.json'.length)}.md`
		: `${jsonPath}.md`;
}

function environment(): NodeJS.ProcessEnv {
	return {
		...process.env,
		PATH: `${path.join(runtimeCache, 'node24/bin')}:${process.env.PATH ?? ''}`,
		VERSIONLESS_NETWORK_MODE: 'offline',
		NPM_CONFIG_OFFLINE: 'true',
		npm_config_offline: 'true',
		NODE_OPTIONS: `--require=${guard}`,
	};
}

function execute(cwd: string, command: string, args: string[]) {
	return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
		const child = spawn(command, args, { cwd, env: environment() });
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
		.replace(ansiColorSequence, '')
		.replace(viteDuration, 'built in <duration>')
		.split(`file://${root}`)
		.join('<checkout>')
		.split(root)
		.join('<checkout>');
}

async function artifact(name: string, value: unknown): Promise<Artifact> {
	const file = path.join(artifactsRoot, name);
	const content = typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`;
	await writeFile(file, content);
	return { path: path.relative(root, file), sha256: sha256(content) };
}

async function filesBelow(directory: string): Promise<string[]> {
	const output: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const item = path.join(directory, entry.name);
		if (entry.isDirectory()) output.push(...(await filesBelow(item)));
		else if (entry.isFile()) output.push(item);
	}
	return output.sort();
}

async function outputDigest(directory: string): Promise<{
	digest: string;
	files: Array<{ path: string; sha256: string }>;
}> {
	const files = await Promise.all(
		(await filesBelow(directory)).map(async (file) => ({
			path: path.relative(directory, file).split(path.sep).join('/'),
			sha256: sha256(await readFile(file)),
		})),
	);
	return { digest: sha256(canonicalize(files)), files };
}

async function verifyInputs(manifest: FixtureManifest): Promise<Record<string, unknown>> {
	const baseline = path.join(root, manifest.baseline.worktree);
	const home = path.join(baseline, 'app/containers/HomePage/index.js');
	const repo = path.join(baseline, 'app/containers/RepoListItem/index.js');
	const pins = {
		baselineReceipt: (await verifyReceipt(path.join(root, manifest.baseline.receipt))).digest,
		homePage: sha256(await readFile(home)),
		repoListItem: sha256(await readFile(repo)),
		package: sha256(await readFile(path.join(baseline, 'package.json'))),
		packageLock: sha256(await readFile(path.join(baseline, 'package-lock.json'))),
		runtimeArchive: sha256(await readFile(path.join(root, manifest.runtime.archive))),
		vitePackage: sha256(await readFile(vitePackage)),
		adapterConfig: sha256(await readFile(path.join(root, manifest.vite.config))),
		adapterHtml: sha256(await readFile(path.join(root, manifest.vite.html))),
		browser: sha256(await readFile(path.join(root, manifest.browser.executable))),
	};
	if (
		pins.baselineReceipt !== manifest.baseline.receiptDigest ||
		pins.homePage !== manifest.baseline.homePageSha256 ||
		pins.repoListItem !== manifest.baseline.repoListItemSha256 ||
		pins.package !== manifest.baseline.packageSha256 ||
		pins.packageLock !== manifest.baseline.packageLockSha256 ||
		pins.runtimeArchive !== manifest.runtime.archiveSha256 ||
		pins.vitePackage !== manifest.vite.packageSha256 ||
		pins.adapterConfig !== manifest.vite.configSha256 ||
		pins.adapterHtml !== manifest.vite.htmlSha256 ||
		pins.browser !== manifest.browser.sha256
	)
		throw new Error('Pinned React data-flow input mismatch');
	const node = path.join(runtimeCache, 'node24/bin/node');
	if ((await execute(root, node, ['--version'])).stdout.trim() !== 'v24.15.0')
		throw new Error('Pinned Node runtime changed');
	const vite = JSON.parse(await readFile(vitePackage, 'utf8')) as { version?: string };
	if (vite.version !== '8.0.16') throw new Error('Pinned Vite version changed');
	return {
		schemaVersion: 'versionless.react-data-flow-preparation.v1',
		pins,
		sourceRevision: manifest.source.revision,
		runtime: 'Node 24.15.0 darwin-arm64',
		bundler: 'fixture-specific Vite 8.0.16',
		networkUsed: false,
	};
}

async function prepareLanes(manifest: FixtureManifest) {
	const baseline = path.join(root, manifest.baseline.worktree);
	await rm(workRoot, { recursive: true, force: true });
	await mkdir(workRoot, { recursive: true });
	const legacy = path.join(workRoot, 'legacy');
	const target = path.join(workRoot, 'target');
	await cp(baseline, legacy, { recursive: true });
	await cp(baseline, target, { recursive: true });
	for (const lane of [legacy, target]) {
		if (
			sha256(await readFile(path.join(lane, 'package.json'))) !==
				manifest.baseline.packageSha256 ||
			sha256(await readFile(path.join(lane, 'package-lock.json'))) !==
				manifest.baseline.packageLockSha256 ||
			!(await lstat(path.join(lane, 'node_modules'))).isSymbolicLink()
		)
			throw new Error('Prepared lane dependency tree differs from pinned baseline');
	}
	if (
		(await realpath(path.join(legacy, 'node_modules'))) !==
		(await realpath(path.join(target, 'node_modules')))
	)
		throw new Error('Legacy and target dependency trees differ');
	const homeFile = path.join(target, 'app/containers/HomePage/index.js');
	const repoFile = path.join(target, 'app/containers/RepoListItem/index.js');
	const home = transformHomePageConnectToHooks(await readFile(homeFile, 'utf8'));
	const repo = transformRepoListItemConnectToHooks(await readFile(repoFile, 'utf8'));
	await writeFile(homeFile, home.code);
	await writeFile(repoFile, repo.code);
	return { legacy, target, home, repo };
}

async function viteBuild(lane: string) {
	const result = await execute(lane, path.join(runtimeCache, 'node24/bin/node'), [
		'--experimental-strip-types',
		viteCli,
		'build',
		'--config',
		path.join(root, 'fixtures/react-boilerplate-v4-vite8/vite.adapter.ts'),
	]);
	const log = normalized(`${result.stdout}${result.stderr}`);
	if (!log.includes('vite v8.0.16') || log.toLowerCase().includes('webpack'))
		throw new Error('Build did not prove the pinned Vite-only path');
	return { log, ...(await outputDigest(path.join(lane, 'build-vite'))) };
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

function ephemeralPort(server: Server): number {
	const address = server.address();
	if (address === null || typeof address === 'string')
		throw new Error('Loopback server did not report an ephemeral port');
	return address.port;
}

async function startServer(lane: string): Promise<{ server: Server; port: number }> {
	const output = path.join(lane, 'build-vite');
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
		server.listen(0, '127.0.0.1', resolve);
	});
	return { server, port: ephemeralPort(server) };
}

async function startSwitchableServer(lane: string, port: number) {
	let currentLane = lane;
	const server = http.createServer(async (request, response) => {
		try {
			const output = path.join(currentLane, 'build-vite');
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
	return { server, select: (nextLane: string) => (currentLane = nextLane) };
}

async function serviceWorkerUpgradeProof(options: {
	manifest: FixtureManifest;
	journey: Journey;
	legacy: string;
	target: string;
	builds: Array<{
		lane: 'legacy' | 'target';
		serviceWorker: Awaited<ReturnType<typeof serviceWorkerBuildEvidence>>;
	}>;
}) {
	const browser = await chromium.launch({
		headless: true,
		executablePath: path.join(root, options.manifest.browser.executable),
	});
	const results = [];
	const port = 43440;
	try {
		for (const order of [
			['base-to-data-flow', ['legacy', 'target']],
			['data-flow-to-base', ['target', 'legacy']],
		] as const) {
			const context = await browser.newContext({
				locale: options.journey.locale,
				timezoneId: options.journey.timezoneId,
				viewport: options.journey.viewport,
			});
			const lanes = { legacy: options.legacy, target: options.target };
			const selected = await startSwitchableServer(lanes[order[1][0]], port);
			const page = await context.newPage();
			const phases = [];
			try {
				for (const laneName of order[1]) {
					selected.select(lanes[laneName]);
					await context.setOffline(false);
					await page.goto(
						joinURL(`http://127.0.0.1:${port}`, options.journey.initialPath),
						{
							waitUntil: 'networkidle',
						},
					);
					await page
						.getByRole('heading', { name: options.journey.initialHeading })
						.waitFor();
					const build = options.builds.find((value) => value.lane === laneName);
					if (!build) throw new Error(`Missing ${laneName} upgrade build evidence`);
					const cacheName = `versionless-react-vite8-${build.serviceWorker.manifestSha256}`;
					await page.evaluate(async (expected) => {
						const registration = await navigator.serviceWorker.ready;
						if ((await caches.keys()).includes(expected)) return;
						const controllerChanged = new Promise<void>((resolve) =>
							navigator.serviceWorker.addEventListener(
								'controllerchange',
								() => resolve(),
								{
									once: true,
								},
							),
						);
						await registration.update();
						await controllerChanged;
					}, cacheName);
					await page.waitForFunction(
						(expected) =>
							Promise.all([caches.keys(), navigator.serviceWorker.ready]).then(
								([names]) =>
									names.length === 1 &&
									names[0] === expected &&
									navigator.serviceWorker.controller?.state === 'activated',
							),
						cacheName,
					);
					await page.reload({ waitUntil: 'networkidle' });
					const observed = await page.evaluate(async (expected) => {
						const registration = await navigator.serviceWorker.ready;
						const names = (await caches.keys()).sort();
						const cache = await caches.open(expected);
						return {
							cacheNames: names,
							inventory: (await cache.keys())
								.map((request) => new URL(request.url).pathname)
								.sort(),
							scope: new URL(registration.scope).pathname,
							controller: navigator.serviceWorker.controller?.state ?? 'missing',
						};
					}, cacheName);
					const expectedInventory = build.serviceWorker.entries
						.map((entry) => entry.url)
						.sort();
					if (
						canonicalize(observed.cacheNames) !== canonicalize([cacheName]) ||
						canonicalize(observed.inventory) !== canonicalize(expectedInventory) ||
						observed.scope !== '/' ||
						observed.controller !== 'activated'
					)
						throw new Error(
							`${order[0]} ${laneName} cache activation mismatch: ${JSON.stringify({ observed, expectedInventory })}`,
						);
					await context.setOffline(true);
					await page.reload({ waitUntil: 'networkidle' });
					await page
						.getByRole('heading', { name: options.journey.initialHeading })
						.waitFor();
					phases.push({
						lane: laneName,
						origin: `http://127.0.0.1:${port}`,
						cacheName,
						...observed,
						offlineReload: 'pass',
					});
				}
				results.push({ order: order[0], phases });
			} finally {
				await context.close();
				await new Promise<void>((resolve, reject) =>
					selected.server.close((error) => (error ? reject(error) : resolve())),
				);
			}
		}
	} finally {
		await browser.close();
	}
	return results;
}

async function browserJourney(options: {
	browser: Browser;
	lane: string;
	laneName: 'legacy' | 'target';
	journey: Journey;
	payload: unknown;
	port: number;
	run: number;
	expectedFailure?:
		| 'home-load-repos-dispatch'
		| 'home-reducer-injection'
		| 'repo-current-user-selector'
		| 'service-worker-registration';
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
	await context.route('**/*', async (route) => {
		const request = route.request();
		const requestUrl = request.url();
		if (requestUrl === options.journey.requestUrl) {
			synthetic.add(requestUrl);
			syntheticRequests.push({
				method: request.method(),
				url: requestUrl,
				kind: 'synthetic-interception',
			});
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(options.payload),
			});
			return;
		}
		const url = parseURL(requestUrl);
		if (['127.0.0.1', 'localhost', '::1'].includes(parseHost(url.host ?? '').hostname))
			await route.continue();
		else {
			blocked.push(requestUrl);
			await route.fulfill({ status: 204, body: '' });
		}
	});
	const page = await context.newPage();
	page.on('response', (response) => {
		const url = parseURL(response.url());
		if (
			!['127.0.0.1', 'localhost', '::1'].includes(parseHost(url.host ?? '').hostname) &&
			!synthetic.has(response.url()) &&
			response.ok()
		)
			successfulNonLoopback.push(response.url());
	});
	page.on('console', (message) => {
		if (message.type() === 'error') consoleErrors.push(message.text());
	});
	page.on('pageerror', (error) => pageErrors.push(error.message));
	let intendedFailure = false;
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
				intendedFailure = true;
			}
			if (!intendedFailure) throw new Error('service worker offline assertion did not fail');
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
		await page
			.locator(options.journey.localeControl)
			.selectOption(options.journey.targetLocale);
		await page.getByRole('heading', { name: options.journey.translatedHeading }).waitFor();
		const input = page.locator('#username');
		await input.fill(options.journey.username);
		if ((await input.inputValue()) !== options.journey.username)
			throw new Error('Username input-state assertion failed');
		await input.press('Enter');
		try {
			await page
				.getByRole('link', { name: 'owned-repo', exact: true })
				.waitFor({ timeout: 3_000 });
		} catch {
			if (syntheticRequests.length !== 1)
				throw new Error('synthetic request count assertion failed');
			throw new Error('owned repository name assertion failed');
		}
		if (
			syntheticRequests.length !== 1 ||
			syntheticRequests[0]?.method !== 'GET' ||
			syntheticRequests[0]?.url !== options.journey.requestUrl
		)
			throw new Error('synthetic request count assertion failed');
		await page.getByRole('link', { name: 'fork-owner/forked-repo', exact: true }).waitFor();
		await page.getByText('3', { exact: true }).waitFor();
		await page.getByText('7', { exact: true }).waitFor();
		const owned = page.getByRole('link', { name: 'owned-repo', exact: true });
		const fork = page.getByRole('link', { name: 'fork-owner/forked-repo', exact: true });
		if (
			(await owned.getAttribute('href')) !== 'https://github.example/octocat/owned-repo' ||
			(await fork.getAttribute('href')) !== 'https://github.example/fork-owner/forked-repo'
		)
			throw new Error('Repository link destination assertion failed');
	} catch (error) {
		if (
			options.expectedFailure === 'service-worker-registration' &&
			error instanceof Error &&
			error.message === 'service worker offline assertion failed'
		)
			intendedFailure = true;
		else if (
			options.expectedFailure &&
			error instanceof Error &&
			(intendedJourneyFailure.test(error.message) ||
				isExpectedReactDataFlowMutationFailure(options.expectedFailure, error.message))
		)
			intendedFailure = true;
		else throw error;
	} finally {
		await context.close();
	}
	if (options.expectedFailure && !intendedFailure)
		throw new Error('Mutation did not fail its intended journey assertion');
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
		navigationPath: options.journey.navigationPath,
		selectedLocale: options.journey.targetLocale,
		translatedHeading: options.journey.translatedHeading,
		username: options.journey.username,
		syntheticRequests,
		repositories: ['owned-repo', 'fork-owner/forked-repo'],
		issueCounts: [3, 7],
		linkDestinations: [
			'https://github.example/octocat/owned-repo',
			'https://github.example/fork-owner/forked-repo',
		],
		loading: 'complete',
		blocked: [...new Set(blocked)].sort(),
		successfulNonLoopback,
		consoleErrors,
		pageErrors,
		serviceWorker,
		offlineReload:
			options.expectedFailure === 'service-worker-registration' ? 'intended-failure' : 'pass',
	};
}

async function withBrowserJourney(
	manifest: FixtureManifest,
	options: Omit<Parameters<typeof browserJourney>[0], 'browser' | 'port'>,
) {
	const browser = await chromium.launch({
		headless: true,
		executablePath: path.join(root, manifest.browser.executable),
	});
	const { server, port } = await startServer(options.lane);
	try {
		return await browserJourney({ ...options, browser, port });
	} finally {
		await new Promise<void>((resolve, reject) =>
			server.close((error) => (error ? reject(error) : resolve())),
		);
		await browser.close();
	}
}

export async function verifyReactBoilerplateDataFlow({
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
	) as FixtureManifest;
	const journey = JSON.parse(
		await readFile(path.join(root, manifest.journey), 'utf8'),
	) as Journey;
	const payload = JSON.parse(
		await readFile(path.join(root, manifest.payload), 'utf8'),
	) as unknown;
	await rm(artifactsRoot, { recursive: true, force: true });
	await mkdir(artifactsRoot, { recursive: true });
	const artifacts: Artifact[] = [
		await artifact('preparation.json', await verifyInputs(manifest)),
	];
	const prepared = await prepareLanes(manifest);
	artifacts.push(
		await artifact('transform.json', {
			schemaVersion: 'versionless.react-data-flow-transform.v1',
			sourceHashes: {
				homePage: prepared.home.sourceSha256,
				repoListItem: prepared.repo.sourceSha256,
			},
			targetHashes: {
				homePage: prepared.home.targetSha256,
				repoListItem: prepared.repo.targetSha256,
			},
			edits: { homePage: prepared.home.edits, repoListItem: prepared.repo.edits },
			semanticEngine: prepared.home.semanticEngine,
			namedPropDrivenExports: ['HomePage', 'RepoListItem'],
		}),
	);
	const builds = [];
	for (const [laneName, lane] of [
		['legacy', prepared.legacy],
		['target', prepared.target],
	] as const) {
		const first = await viteBuild(lane);
		const firstServiceWorker = await serviceWorkerBuildEvidence(lane);
		const second = await viteBuild(lane);
		const secondServiceWorker = await serviceWorkerBuildEvidence(lane);
		if (
			first.digest !== second.digest ||
			canonicalize(first.files) !== canonicalize(second.files) ||
			canonicalize(firstServiceWorker) !== canonicalize(secondServiceWorker)
		)
			throw new Error(`${laneName} clean Vite outputs are not byte-identical`);
		builds.push({
			lane: laneName,
			first,
			second,
			serviceWorker: firstServiceWorker,
			equal: true,
			bundler: 'vite-8.0.16',
		});
	}
	artifacts.push(await artifact('build.json', builds));
	const upgrades = await serviceWorkerUpgradeProof({
		manifest,
		journey,
		legacy: prepared.legacy,
		target: prepared.target,
		builds,
	});
	artifacts.push(await artifact('upgrade.json', upgrades));
	const browserRuns = [];
	for (const [laneName, lane] of [
		['legacy', prepared.legacy],
		['target', prepared.target],
	] as const)
		for (let run = 1; run <= journey.qualificationRuns; run++)
			browserRuns.push(
				await withBrowserJourney(manifest, {
					lane,
					laneName,
					journey,
					payload,
					run,
				}),
			);
	for (const laneName of ['legacy', 'target']) {
		const rows = browserRuns.filter((row) => row.lane === laneName);
		if (canonicalize(rows[0]) !== canonicalize({ ...rows[1], run: 1 }))
			throw new Error(`${laneName} qualification journeys differ`);
	}
	artifacts.push(await artifact('journey.json', browserRuns));

	const mutations = [];
	const mutationCases = [
		{
			seam: 'home-reducer-injection' as const,
			file: path.join(prepared.target, 'app/containers/HomePage/index.js'),
			before: 'const withReducer = injectReducer({ key, reducer });',
			after: 'const withReducer = injectReducer({ key, reducer: (state = reducer(undefined, {})) => state });',
		},
		{
			seam: 'home-load-repos-dispatch' as const,
			file: path.join(prepared.target, 'app/containers/HomePage/index.js'),
			before: '    dispatch(loadRepos());',
			after: '    void loadRepos;',
		},
		{
			seam: 'repo-current-user-selector' as const,
			file: path.join(prepared.target, 'app/containers/RepoListItem/index.js'),
			before: 'useSelector(selectCurrentUser)',
			after: "useSelector(() => 'wrong-user')",
		},
		{
			seam: 'service-worker-registration' as const,
			file: path.join(prepared.target, 'app/app.js'),
			before: "require('offline-plugin/runtime').install(); // eslint-disable-line global-require",
			after: '// Versionless mutation: service-worker registration disabled.',
		},
	];
	for (const mutation of mutationCases) {
		const restored = await readFile(mutation.file, 'utf8');
		const restoredSha256 = sha256(restored);
		const changed = restored.replace(mutation.before, mutation.after);
		if (changed === restored || changed.indexOf(mutation.before) >= 0)
			throw new Error(`Exact mutation seam is missing or ambiguous: ${mutation.seam}`);
		let failed;
		try {
			await writeFile(mutation.file, changed);
			await viteBuild(prepared.target);
			failed = await withBrowserJourney(manifest, {
				lane: prepared.target,
				laneName: 'target',
				journey,
				payload,
				run: 1,
				expectedFailure: mutation.seam,
			});
		} finally {
			await writeFile(mutation.file, restored);
		}
		if (sha256(await readFile(mutation.file)) !== restoredSha256)
			throw new Error(`Mutation restoration differs: ${mutation.seam}`);
		await viteBuild(prepared.target);
		const restoredServiceWorker = await serviceWorkerBuildEvidence(prepared.target);
		const targetBuild = builds.find((build) => build.lane === 'target');
		if (
			!targetBuild ||
			canonicalize(restoredServiceWorker) !== canonicalize(targetBuild.serviceWorker)
		)
			throw new Error(`Service-worker restoration output differs: ${mutation.seam}`);
		const reproduced = await withBrowserJourney(manifest, {
			lane: prepared.target,
			laneName: 'target',
			journey,
			payload,
			run: 1,
		});
		mutations.push({
			seam: mutation.seam,
			result: failed.result,
			restoration: 'byte-identical',
			restoredSha256,
			reproduced: reproduced.result,
			syntheticRequests: failed.syntheticRequests,
		});
	}
	artifacts.push(await artifact('mutation.json', { mutations, isolated: true }));
	artifacts.push(
		await artifact('migration-diff.json', {
			changedFiles: [
				'app/containers/HomePage/index.js',
				'app/containers/RepoListItem/index.js',
			],
			packageSha256: manifest.baseline.packageSha256,
			packageLockSha256: manifest.baseline.packageLockSha256,
			dependencyTreesEqual: true,
			adapter: 'fixture-specific-existing-pinned-vite8',
		}),
	);
	const locality = {
		mode: 'offline' as const,
		scope: 'Versionless-spawned Node/Vite build and Playwright browser requests',
		osWideIsolation: false as const,
		successfulNonLoopback: 0 as const,
		browserBlockedRequests: browserRuns.flatMap((row) => row.blocked).length,
		syntheticInterceptions: browserRuns.flatMap((row) => row.syntheticRequests).length,
	};
	artifacts.push(await artifact('locality.json', locality));
	artifacts.push(
		await artifact('runtime.json', {
			node: '24.15.0-darwin-arm64',
			vite: '8.0.16',
			react: '16.8.6',
			reactRedux: '7.1.3',
			webpackUsed: false,
		}),
	);
	const core = {
		fixture: manifest.id,
		revision: manifest.source.revision,
		builds: builds.map((build) => ({ lane: build.lane, digest: build.first.digest })),
		journeys: browserRuns,
		upgrades,
		targetHashes: {
			homePage: prepared.home.targetSha256,
			repoListItem: prepared.repo.targetSha256,
		},
		mutations: mutations.map((mutation) => ({
			seam: mutation.seam,
			result: mutation.result,
			restoration: mutation.restoration,
			reproduced: mutation.reproduced,
		})),
	};
	const first = sha256(canonicalize(core));
	const second = sha256(canonicalize(JSON.parse(JSON.stringify(core))));
	if (first !== second) throw new Error('Deterministic core mismatch');
	artifacts.push(await artifact('deterministic-core.json', { first, second, equal: true }));

	const changedFiles: [string, string] = [
		'app/containers/HomePage/index.js',
		'app/containers/RepoListItem/index.js',
	];
	const receipt: MigrationReceipt = {
		schemaVersion: 'versionless.receipt.v1',
		runId: 'T054-react-boilerplate-v4-data-flow',
		fixture: manifest.id,
		source: manifest.source,
		tooling: {
			node: '24.15.0-darwin-arm64 maintained runtime',
			vite: '8.0.16 root installation',
			adapter: 'fixture-specific existing pinned adapter',
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
				purpose: 'reuse pinned Node 24 runtime and verified local dependency installation',
				mode: 'consented',
			},
		],
		migration: {
			file: changedFiles.join(' + '),
			transform: 'react-data-flow-connect-to-hooks',
			edits: prepared.home.edits.length + prepared.repo.edits.length,
			changedFiles,
			sourceHashes: {
				homePage: prepared.home.sourceSha256,
				repoListItem: prepared.repo.sourceSha256,
			},
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
				manifestSha256: builds[1]!.serviceWorker.manifestSha256,
				cacheName: `versionless-react-vite8-${builds[1]!.serviceWorker.manifestSha256}`,
				currentCacheOnly: true,
				inventoryMatchesManifest: true,
				exactCurrentCacheFetch: true,
				upgradeOrders: ['base-to-data-flow', 'data-flow-to-base'],
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
			'This is a deeper vertical on the existing React Boilerplate source, not a third application or designated pilot.',
			'The Vite adapter remains fixture-specific; generic, unplugin, and old-Vite portability are not-tested.',
			'GitHub behavior uses a pinned synthetic interception and proves no live API access.',
			'Hash integrity does not establish authenticity, signer identity, certification, or Git provenance.',
			'Network controls are process-scoped and do not establish OS-wide isolation.',
			'Payment-page applicability is not established; dynamic script insertion is not-tested; PCI compliance is not claimed.',
			'Service-worker parity covers only the exact qualified offline journey, not global offline or PWA correctness.',
		],
	};
	receipt.integrity.canonicalDigest = receiptDigest(receipt);
	parseMigrationReceipt(receipt);
	const absolute = path.resolve(receiptPath);
	await mkdir(path.dirname(absolute), { recursive: true });
	await writeFile(absolute, `${JSON.stringify(receipt, null, 2)}\n`);
	await writeFile(markdownPath(absolute), renderReceipt(receipt));
	const aggregatePath = path.join(root, 'evidence/runs/aggregate.json');
	const aggregate = JSON.parse(await readFile(aggregatePath, 'utf8')) as {
		fixtures: Array<Record<string, unknown>>;
		unsupported: unknown[];
	};
	const fixtures = aggregate.fixtures.filter((item) => item.id !== manifest.id);
	fixtures.push({
		id: manifest.id,
		framework: 'react',
		bundler: 'vite-8',
		runtime: 'node-24.15.0',
		result: 'pass',
		receipt: path.relative(root, absolute),
		digest: receipt.integrity.canonicalDigest,
	});
	await writeFile(aggregatePath, `${JSON.stringify({ ...aggregate, fixtures }, null, 2)}\n`);
	await verifyReceipt(absolute);
	return receipt;
}
