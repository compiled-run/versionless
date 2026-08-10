import { spawn } from 'node:child_process';
import {
	cp,
	mkdir,
	readFile,
	readdir,
	realpath,
	rm,
	stat,
	symlink,
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

const sourceDirectory = import.meta.dirname;
const root =
	path.basename(sourceDirectory) === 'dist'
		? path.resolve(sourceDirectory, '../../..')
		: path.resolve(sourceDirectory, '../../../..');
const fixtureRoot = path.join(root, 'fixtures/react-boilerplate-v4-vite8');
const source = path.join(root, '.versionless/cache/react-boilerplate-v4-node24/source');
const reusedTarget = path.join(root, '.versionless/work/react-boilerplate-v4-node24/target');
const runtimeCache = path.join(root, '.versionless/cache/react-boilerplate-v4-node24');
const defaultTarget = path.join(root, '.versionless/work/react-boilerplate-v4-vite8/target');
const defaultArtifactsRoot = path.join(root, 'evidence/runs/react-boilerplate-v4-vite8/artifacts');
const guard = path.join(root, 'packages/node-guard/dist/index.cjs');
const viteCli = path.join(root, 'node_modules/vite/bin/vite.js');
const vitePackage = path.join(root, 'node_modules/vite/package.json');
const defaultAdapterConfig = path.join(fixtureRoot, 'vite.adapter.ts');
let target = defaultTarget;
let artifactsRoot = defaultArtifactsRoot;
let adapterConfig = defaultAdapterConfig;
const adapterHtml = path.join(fixtureRoot, 'index.html');
const migratedLocale = path.join(reusedTarget, 'app/containers/LocaleToggle/index.js');
const originalLocale = path.join(source, 'app/containers/LocaleToggle/index.js');
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
	locale: string;
	timezoneId: string;
	viewport: { width: number; height: number };
}

interface ServerProbe {
	index: { url: string; status: number; contentType: string };
	assets: Array<{ url: string; status: number; contentType: string }>;
	ready: true;
}

function markdownPath(jsonPath: string): string {
	return jsonPath.endsWith('.json')
		? `${jsonPath.slice(0, -'.json'.length)}.md`
		: `${jsonPath}.md`;
}

function offlineEnvironment(parentEnvironment: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
	return {
		...parentEnvironment,
		PATH: `${path.join(runtimeCache, 'node24/bin')}:${parentEnvironment.PATH ?? ''}`,
		VERSIONLESS_NETWORK_MODE: 'offline',
		NPM_CONFIG_OFFLINE: 'true',
		npm_config_offline: 'true',
		NODE_OPTIONS: `--require=${guard}`,
	};
}

export function reactViteBuildEnvironment(
	parentEnvironment: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
	return { ...offlineEnvironment(parentEnvironment), NODE_ENV: 'production' };
}

function execute(
	command: string,
	args: string[],
	acceptFailure = false,
	env: NodeJS.ProcessEnv = offlineEnvironment(),
) {
	return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
		const child = spawn(command, args, { cwd: target, env });
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
			if (result.code === 0 || acceptFailure) resolve(result);
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

async function verifyInputs(manifest: Record<string, any>): Promise<Record<string, unknown>> {
	const values = {
		sourceArchive: sha256(await readFile(path.join(runtimeCache, 'source.tar.gz'))),
		license: sha256(await readFile(path.join(source, 'LICENSE.md'))),
		originalLocale: sha256(await readFile(originalLocale)),
		migratedLocale: sha256(await readFile(migratedLocale)),
		runtimeArchive: sha256(
			await readFile(path.join(runtimeCache, 'node-v24.15.0-darwin-arm64.tar.gz')),
		),
		vitePackage: sha256(await readFile(vitePackage)),
		reusedPackage: sha256(await readFile(path.join(reusedTarget, 'package.json'))),
		reusedLock: sha256(await readFile(path.join(reusedTarget, 'package-lock.json'))),
		browser: sha256(await readFile(path.resolve(root, manifest.browser.executable))),
	};
	if (
		values.sourceArchive !== manifest.source.archiveSha256 ||
		values.license !== manifest.source.licenseSha256 ||
		values.originalLocale !== manifest.source.localeToggleOriginalSha256 ||
		values.migratedLocale !== manifest.source.localeToggleMigratedSha256 ||
		values.runtimeArchive !== manifest.runtime.archiveSha256 ||
		values.vitePackage !== manifest.vite.packageSha256 ||
		values.reusedPackage !== manifest.reusedTarget.packageSha256 ||
		values.reusedLock !== manifest.reusedTarget.packageLockSha256 ||
		values.browser !== manifest.browser.sha256
	)
		throw new Error('Pinned Vite fixture input mismatch');
	const node = path.join(runtimeCache, 'node24/bin/node');
	if ((await execute(node, ['--version'])).stdout.trim() !== 'v24.15.0')
		throw new Error('Pinned maintained runtime changed');
	const viteMetadata = JSON.parse(await readFile(vitePackage, 'utf8')) as Record<string, unknown>;
	if (viteMetadata.version !== '8.0.16') throw new Error('Root Vite version changed');
	return {
		schemaVersion: 'versionless.vite8-preparation.v1',
		...values,
		revision: manifest.source.revision,
		node: '24.15.0-darwin-arm64',
		vite: '8.0.16-root-installation',
		adapterConfig: path.relative(root, adapterConfig),
		adapterConfigSha256: sha256(await readFile(adapterConfig)),
		adapterHtml: path.relative(root, adapterHtml),
		adapterHtmlSha256: sha256(await readFile(adapterHtml)),
		nodeModules: path.relative(root, await realpath(path.join(reusedTarget, 'node_modules'))),
		networkUsed: false,
		webpackUsed: false,
	};
}

async function prepareTarget(): Promise<void> {
	await rm(target, { recursive: true, force: true });
	await mkdir(path.dirname(target), { recursive: true });
	await cp(source, target, { recursive: true });
	await writeFile(
		path.join(target, 'app/containers/LocaleToggle/index.js'),
		await readFile(migratedLocale),
	);
	await writeFile(path.join(target, 'index.html'), await readFile(adapterHtml));
	await symlink(path.join(reusedTarget, 'node_modules'), path.join(target, 'node_modules'));
}

async function viteBuild() {
	const node = path.join(runtimeCache, 'node24/bin/node');
	const result = await execute(
		node,
		['--experimental-strip-types', viteCli, 'build', '--config', adapterConfig],
		false,
		reactViteBuildEnvironment(),
	);
	const output = `${result.stdout}${result.stderr}`;
	if (!output.includes('vite v8.0.16') || output.toLowerCase().includes('webpack'))
		throw new Error('Build did not prove the root Vite 8 bundler path');
	return output;
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

async function serviceWorkerBuildEvidence() {
	const output = path.join(target, 'build-vite');
	const manifest = JSON.parse(
		await readFile(path.join(output, 'precache-manifest.json'), 'utf8'),
	) as { schemaVersion: string; scope: string; entries: Array<{ url: string; sha256: string }> };
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
		worker: { path: 'sw.js', sha256: sha256(await readFile(path.join(output, 'sw.js'))) },
		manifest: {
			path: 'precache-manifest.json',
			sha256: sha256(await readFile(path.join(output, 'precache-manifest.json'))),
		},
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
		case '.jpg':
			return 'image/jpeg';
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

async function startServer(): Promise<{ server: Server; port: number }> {
	const output = path.join(target, 'build-vite');
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
		server.listen(0, '127.0.0.1', () => resolve());
	});
	return { server, port: ephemeralPort(server) };
}

async function stopServer(server: Server): Promise<void> {
	await new Promise<void>((resolve, reject) =>
		server.close((error) => (error ? reject(error) : resolve())),
	);
}

function referencedEntryAssets(index: string): string[] {
	const values = new Set<string>();
	for (const quote of ['"', "'"] as const) {
		for (const attribute of ['src', 'href'] as const) {
			const marker = `${attribute}=${quote}`;
			let offset = 0;
			while (offset < index.length) {
				const start = index.indexOf(marker, offset);
				if (start < 0) break;
				const valueStart = start + marker.length;
				const end = index.indexOf(quote, valueStart);
				if (end < 0) break;
				const value = index.slice(valueStart, end);
				const parsed = parseURL(value);
				if (!parsed.host && ['.css', '.js'].includes(path.extname(parsed.pathname)))
					values.add(parsed.pathname);
				offset = end + 1;
			}
		}
	}
	return [...values].sort();
}

async function probeBuiltEntry(port: number): Promise<ServerProbe> {
	const base = `http://127.0.0.1:${port}`;
	const indexUrl = joinURL(base, 'index.html');
	let lastFailure = 'not attempted';
	for (let attempt = 1; attempt <= 50; attempt++) {
		try {
			const indexResponse = await fetch(indexUrl);
			const indexBody = await indexResponse.text();
			const indexContentType = indexResponse.headers.get('content-type') ?? '';
			if (!indexResponse.ok || !indexContentType.startsWith('text/html'))
				throw new Error(`index ${indexResponse.status} ${indexContentType}`);
			const assets = [];
			for (const entry of referencedEntryAssets(indexBody)) {
				const url = joinURL(base, entry);
				const response = await fetch(url);
				const contentType = response.headers.get('content-type') ?? '';
				if (!response.ok)
					throw new Error(`asset ${entry} ${response.status} ${contentType}`);
				assets.push({ url, status: response.status, contentType });
			}
			if (!assets.length)
				throw new Error('index references no local JavaScript or CSS entry assets');
			return {
				index: {
					url: indexUrl,
					status: indexResponse.status,
					contentType: indexContentType,
				},
				assets,
				ready: true,
			};
		} catch (error) {
			lastFailure = error instanceof Error ? error.message : String(error);
			if (attempt < 50) await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}
	throw new Error(`React Vite built-entry readiness failed: ${lastFailure}`);
}

async function journeyRun(
	browser: Browser,
	journey: Journey,
	port: number,
	run: number,
	probe: ServerProbe,
	expectServiceWorkerFailure = false,
) {
	const context = await browser.newContext({
		locale: journey.locale,
		timezoneId: journey.timezoneId,
		viewport: journey.viewport,
	});
	const blocked: string[] = [];
	const syntheticBlocked = new Set<string>();
	const successfulNonLoopback: string[] = [];
	const consoleErrors: string[] = [];
	const pageErrors: string[] = [];
	const failedRequests: Array<{ url: string; errorText: string }> = [];
	await context.route('**/*', async (route) => {
		const requestUrl = route.request().url();
		const url = parseURL(requestUrl);
		if (['127.0.0.1', 'localhost', '::1'].includes(parseHost(url.host ?? '').hostname))
			await route.continue();
		else {
			blocked.push(requestUrl);
			syntheticBlocked.add(requestUrl);
			await route.fulfill({ status: 204, body: '' });
		}
	});
	const page = await context.newPage();
	page.on('response', (response) => {
		const url = parseURL(response.url());
		if (
			!['127.0.0.1', 'localhost', '::1'].includes(parseHost(url.host ?? '').hostname) &&
			!syntheticBlocked.has(response.url()) &&
			response.ok()
		)
			successfulNonLoopback.push(response.url());
	});
	page.on('console', (message) => {
		if (message.type() === 'error') consoleErrors.push(message.text());
	});
	page.on('pageerror', (error) => pageErrors.push(error.message));
	page.on('requestfailed', (request) =>
		failedRequests.push({
			url: request.url(),
			errorText: request.failure()?.errorText ?? 'unknown',
		}),
	);
	let intendedFailure = false;
	let serviceWorker: Record<string, unknown> | null = null;
	let mainDocument: { status: number; contentType: string } | null = null;
	try {
		const response = await page.goto(joinURL(`http://127.0.0.1:${port}`, journey.initialPath), {
			waitUntil: 'networkidle',
		});
		mainDocument = response
			? { status: response.status(), contentType: response.headers()['content-type'] ?? '' }
			: null;
		await page.getByRole('heading', { name: journey.initialHeading }).waitFor();
		if (expectServiceWorkerFailure) {
			await page.waitForTimeout(500);
			const registrations = await page.evaluate(
				async () => (await navigator.serviceWorker.getRegistrations()).length,
			);
			if (registrations !== 0)
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
					cacheNames.map(async (cacheName) => {
						const cache = await caches.open(cacheName);
						return Promise.all(
							(await cache.keys()).map((request) => new URL(request.url).pathname),
						);
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
		await page.getByRole('heading', { name: journey.initialHeading }).waitFor();
		await page.getByRole('link', { name: journey.navigationName }).click();
		if (parseURL(page.url()).pathname !== journey.navigationPath)
			throw new Error('Navigation assertion failed');
		await page.getByRole('link', { name: journey.returnName }).click();
		const control = page.locator(journey.localeControl);
		await control.selectOption(journey.targetLocale);
		try {
			await page
				.getByRole('heading', { name: journey.translatedHeading })
				.waitFor({ timeout: 5_000 });
		} catch {
			throw new Error('translated heading assertion failed');
		}
	} catch (error) {
		if (
			expectServiceWorkerFailure &&
			error instanceof Error &&
			error.message === 'service worker offline assertion failed'
		)
			intendedFailure = true;
		else {
			const diagnostics = {
				currentUrl: page.url(),
				mainDocument,
				consoleErrors,
				pageErrors,
				failedRequests,
				probe,
			};
			throw new Error(
				`${error instanceof Error ? error.message : String(error)}\nJourney diagnostics: ${JSON.stringify(diagnostics)}`,
				{ cause: error },
			);
		}
	}
	await context.close();
	if (expectServiceWorkerFailure && !intendedFailure)
		throw new Error('Mutation did not fail the intended service-worker assertion');
	if (!expectServiceWorkerFailure && (consoleErrors.length || pageErrors.length))
		throw new Error(
			`Unexpected browser errors: ${JSON.stringify({ consoleErrors, pageErrors })}`,
		);
	if (successfulNonLoopback.length)
		throw new Error(`Successful non-loopback traffic: ${successfulNonLoopback.join(', ')}`);
	return {
		run,
		result: expectServiceWorkerFailure ? 'intended-failure' : 'pass',
		bundler: 'vite-8.0.16',
		navigationPath: journey.navigationPath,
		selectedLocale: journey.targetLocale,
		translatedHeading: journey.translatedHeading,
		blocked: [...new Set(blocked)].sort(),
		successfulNonLoopback,
		consoleErrors,
		pageErrors,
		serviceWorker,
		offlineReload: expectServiceWorkerFailure ? 'intended-failure' : 'pass',
	};
}

async function browserRun(
	manifest: Record<string, any>,
	journey: Journey,
	run: number,
	expectServiceWorkerFailure = false,
) {
	const browser = await chromium.launch({
		headless: true,
		executablePath: path.resolve(root, manifest.browser.executable),
	});
	const { server, port } = await startServer();
	try {
		const probe = await probeBuiltEntry(port);
		return await journeyRun(browser, journey, port, run, probe, expectServiceWorkerFailure);
	} finally {
		await stopServer(server);
		await browser.close();
	}
}

export async function verifyReactBoilerplateVite8({
	receiptPath,
	targetPath,
	artifactsPath,
	adapterConfigPath,
	publishAggregate = true,
}: {
	receiptPath: string;
	targetPath?: string;
	artifactsPath?: string;
	adapterConfigPath?: string;
	publishAggregate?: boolean;
}): Promise<MigrationReceipt> {
	target = targetPath ?? defaultTarget;
	artifactsRoot = artifactsPath ?? defaultArtifactsRoot;
	adapterConfig = adapterConfigPath ?? defaultAdapterConfig;
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('fixture:verify requires explicit offline mode');
	const manifest = JSON.parse(
		await readFile(path.join(fixtureRoot, 'fixture.json'), 'utf8'),
	) as Record<string, any>;
	const journey = JSON.parse(
		await readFile(path.resolve(root, manifest.journey), 'utf8'),
	) as Journey;
	if (targetPath) await mkdir(target, { recursive: true });
	await rm(artifactsRoot, { recursive: true, force: true });
	await mkdir(artifactsRoot, { recursive: true });
	const preparation = await verifyInputs(manifest);
	await prepareTarget();
	const artifacts: Artifact[] = [await artifact('preparation.json', preparation)];
	const firstBuild = await viteBuild();
	const firstServiceWorker = await serviceWorkerBuildEvidence();
	const secondBuild = await viteBuild();
	const secondServiceWorker = await serviceWorkerBuildEvidence();
	if (canonicalize(firstServiceWorker) !== canonicalize(secondServiceWorker))
		throw new Error('Service-worker Vite builds are not byte-identical');
	artifacts.push(await artifact('build-target.log', normalized(`${firstBuild}\n${secondBuild}`)));
	artifacts.push(
		await artifact('service-worker.json', {
			schemaVersion: 'versionless.react-service-worker-evidence.v1',
			fixture: manifest.id,
			...firstServiceWorker,
			buildsEqual: true,
		}),
	);
	const journeys = [];
	for (let index = 1; index <= journey.qualificationRuns; index++)
		journeys.push(await browserRun(manifest, journey, index));
	if (canonicalize(journeys[0]) !== canonicalize({ ...journeys[1], run: 1 }))
		throw new Error('Vite qualification journeys differ');
	artifacts.push(await artifact('journey.json', journeys));

	const registrationFile = path.join(target, 'app/app.js');
	const restored = await readFile(registrationFile, 'utf8');
	const restoredHash = sha256(restored);
	const registrationSeam =
		"require('offline-plugin/runtime').install(); // eslint-disable-line global-require";
	const mutated = restored.replace(
		registrationSeam,
		'// Versionless mutation: service-worker registration disabled.',
	);
	if (mutated === restored || mutated.includes(registrationSeam))
		throw new Error('Exact service-worker registration mutation target absent');
	let mutationJourney;
	try {
		await writeFile(registrationFile, mutated);
		const mutationBuild = await viteBuild();
		artifacts.push(await artifact('build-mutation.log', normalized(mutationBuild)));
		mutationJourney = await browserRun(manifest, journey, 1, true);
	} finally {
		await writeFile(registrationFile, restored);
	}
	if (sha256(await readFile(registrationFile)) !== restoredHash)
		throw new Error('Service-worker registration restoration was not byte-identical');
	const restoredBuild = await viteBuild();
	const restoredServiceWorker = await serviceWorkerBuildEvidence();
	if (canonicalize(restoredServiceWorker) !== canonicalize(firstServiceWorker))
		throw new Error('Restored service-worker output differs');
	artifacts.push(await artifact('build-restored.log', normalized(restoredBuild)));
	const restoredJourney = await browserRun(manifest, journey, 1);
	artifacts.push(
		await artifact('mutation.json', {
			mutation: mutationJourney.result,
			mutationKind: 'service-worker-registration-disabled',
			expectedFailure: 'service worker offline assertion failed',
			restoration: 'byte-identical',
			restoredSha256: restoredHash,
			reproduced: restoredJourney.result,
		}),
	);
	artifacts.push(
		await artifact('migration-diff.json', {
			changedFiles: ['app/containers/LocaleToggle/index.js'],
			sourceSha256: manifest.source.localeToggleOriginalSha256,
			targetSha256: restoredHash,
			packageSha256: manifest.reusedTarget.packageSha256,
			packageLockSha256: manifest.reusedTarget.packageLockSha256,
			adapterFiles: [path.relative(root, adapterConfig), path.relative(root, adapterHtml)],
			webpackFallback: false,
		}),
	);
	const locality = {
		mode: 'offline' as const,
		scope: 'Versionless-spawned Node/Vite build and Playwright browser requests',
		osWideIsolation: false as const,
		successfulNonLoopback: 0 as const,
		browserBlockedRequests: journeys.flatMap((value) => value.blocked).length,
	};
	artifacts.push(await artifact('locality.json', locality));
	const core = {
		fixture: manifest.id,
		revision: manifest.source.revision,
		node: manifest.runtime.version,
		vite: manifest.vite.version,
		localeToggleSha256: restoredHash,
		adapterConfigSha256: sha256(await readFile(adapterConfig)),
		adapterHtmlSha256: sha256(await readFile(adapterHtml)),
		serviceWorker: firstServiceWorker,
		webpackFallback: false,
	};
	const first = sha256(canonicalize(core));
	const second = sha256(canonicalize(JSON.parse(JSON.stringify(core))));
	if (first !== second) throw new Error('Deterministic core mismatch');
	artifacts.push(await artifact('deterministic-core.json', { first, second, equal: true }));
	const receipt: MigrationReceipt = {
		schemaVersion: 'versionless.receipt.v1',
		runId: 'T028-react-boilerplate-v4-vite8',
		fixture: manifest.id,
		source: {
			repository: manifest.source.repository,
			revision: manifest.source.revision,
			archiveSha256: manifest.source.archiveSha256,
			license: manifest.source.license,
			licenseSha256: manifest.source.licenseSha256,
		},
		tooling: {
			node: '24.15.0-darwin-arm64 maintained runtime',
			vite: '8.0.16 root installation',
			adapter: 'fixture-specific strict TypeScript',
			playwright: '1.58.2',
			chromium: '145.0.7632.6',
			webpack: 'not-used',
		},
		consent: [
			{
				id: 'T008-fixture-ingest',
				purpose:
					'reuse of the immutable licensed d19099 source and locked dependency population',
				mode: 'consented',
			},
			{
				id: 'T022-react-node24-ingest',
				purpose:
					'reuse of the pinned Node 24 runtime and verified local dependency installation',
				mode: 'consented',
			},
		],
		migration: {
			file: 'app/containers/LocaleToggle/index.js',
			transform: 'react-connect-to-hooks + fixture-specific-vite8-adapter',
			edits: 5,
			dependency: { name: 'react-redux', from: '7.0.2', to: '7.1.3', license: 'MIT' },
			lockPatch: 'fixtures/react-boilerplate-v4-vite8/vite.adapter.ts',
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
				manifestSha256: firstServiceWorker.manifest.sha256,
				cacheName: `versionless-react-vite8-${firstServiceWorker.manifest.sha256}`,
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
			'Hash integrity does not establish signer authenticity or Git provenance.',
			'Network controls cover spawned Node/Vite and browser routing, not OS-wide isolation.',
			'This proves only root Vite 8.0.16 on the pinned React Boilerplate corpus.',
			'Service-worker parity covers only the exact qualified offline journey, not global offline or PWA correctness.',
			'Old Vite and generic or unplugin adapter portability remain not-tested.',
			'TakeNote and Angular2-HN designated pilots remain not-tested.',
			'Governance, signing identity, certification, and authenticity are not claimed.',
		],
	};
	receipt.integrity.canonicalDigest = receiptDigest(receipt);
	parseMigrationReceipt(receipt);
	const absolute = path.resolve(receiptPath);
	await mkdir(path.dirname(absolute), { recursive: true });
	await writeFile(absolute, `${JSON.stringify(receipt, null, 2)}\n`);
	await writeFile(markdownPath(absolute), renderReceipt(receipt));
	if (publishAggregate) {
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
	}
	await verifyReceipt(absolute, {
		repositoryRoot: root,
		receiptPathBase: 'repository',
		artifactPathBase: 'repository',
		requireAggregate: publishAggregate,
	});
	return receipt;
}
