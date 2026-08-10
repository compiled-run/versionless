import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { anyOf, createRegExp, exactly } from 'magic-regexp';
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
import { transformPhoneDetailLexicalThis } from '../../../frameworks/angularjs/src/phone-detail-lexical-this.ts';
import { transformPhoneRouteResolve } from '../../../frameworks/angularjs/src/phone-route-resolve.ts';
import { ANGULAR_PHONECAT_INGEST_PURPOSE } from './angular-phonecat-ingest.ts';

const sourceDirectory = import.meta.dirname;
const root =
	path.basename(sourceDirectory) === 'dist'
		? path.resolve(sourceDirectory, '../../..')
		: path.resolve(sourceDirectory, '../../../..');
const fixtureRoot = path.join(root, 'fixtures/angular-phonecat-vite8');
const fixtureFile = path.join(fixtureRoot, 'fixture.json');
const journeyFile = path.join(root, 'fixtures/angular-phonecat/journey.json');
const sourceCache = path.join(root, '.versionless/cache/angular-phonecat');
const sourceRoot = path.join(sourceCache, 'source');
const taskCache = path.join(root, '.versionless/cache/angular-phonecat-vite8');
const verifiedLibraryTreeSha256 =
	'811fb0f3190dc4f07398c326dfd47b501d677b8c4662621ccaefe472bf0a717b';
const libraryInputRoot = path.join(taskCache, 'library-trees', verifiedLibraryTreeSha256);
const libraryInput = path.join(libraryInputRoot, 'app/lib');
const libraryManifestFile = path.join(libraryInputRoot, 'manifest.json');
const libraryProvenanceFile = path.join(libraryInputRoot, 'provenance.json');
const defaultWorkRoot = path.join(root, '.versionless/work/angular-phonecat-vite8');
const defaultArtifactsRoot = path.join(root, 'evidence/runs/angular-phonecat-vite8/artifacts');
const viteCli = path.join(root, 'node_modules/vite/bin/vite.js');
const vitePackage = path.join(root, 'node_modules/vite/package.json');
const guard = path.join(root, 'packages/node-guard/dist/index.cjs');
const defaultAdapter = path.join(fixtureRoot, 'vite.adapter.ts');
let workRoot = defaultWorkRoot;
let artifactsRoot = defaultArtifactsRoot;
let adapter = defaultAdapter;
const applicationFiles = {
	appConfig: 'app/app.config.js',
	phoneList: 'app/phone-list/phone-list.component.js',
	phoneDetail: 'app/phone-detail/phone-detail.component.js',
} as const;
const changedFiles = [
	applicationFiles.appConfig,
	applicationFiles.phoneList,
	applicationFiles.phoneDetail,
] as const;
const intendedFailure = createRegExp(
	anyOf(exactly('Detail heading assertion failed'), exactly('Detail template request failed')),
);

interface FixtureManifest {
	id: 'angular-phonecat-vite8';
	track: 'angularjs-special-track';
	source: {
		repository: string;
		revision: string;
		archiveSha256: string;
		license: string;
		licenseSha256: string;
		packageSha256: string;
		packageLockSha256: string;
		appConfigSha256: string;
		phoneListSha256: string;
		phoneDetailSha256: string;
	};
	runtimes: {
		legacy: { version: string; npm: string; sha256: string };
		target: { version: string; sha256: string };
	};
	vite: { version: string; packageSha256: string; adapter: string };
	libraryCache: {
		treeSha256: string;
		manifestSha256: string;
		provenanceSha256: string;
	};
	browser: { executable: string; sha256: string };
	journey: string;
}

interface Journey {
	qualificationRuns: number;
	initialPath: string;
	redirectPath: string;
	filterText: string;
	expectedFilteredCount: number;
	orderValue: string;
	firstOrderedPhone: string;
	detailLink: string;
	detailPath: string;
	detailHeading: string;
	initialImageSuffix: string;
	thumbnailSwapSuffixes: string[];
	locale: string;
	timezoneId: string;
	viewport: { width: number; height: number };
}

interface ServerProbe {
	index: { url: string; status: number; contentType: string };
	assets: Array<{ url: string; status: number; contentType: string }>;
	ready: true;
}

export type AngularPhonecatInternalReceiptIdentity = 'react-first' | 'phonecat-first';

const internalReceiptFixture = 'angular-phonecat-vite8-shared-adapter-internal';
const internalReceiptIdentities = {
	'react-first': {
		runId: 'vite8-shared-adapter-cohort-react-first-phonecat-internal',
		fixture: internalReceiptFixture,
	},
	'phonecat-first': {
		runId: 'vite8-shared-adapter-cohort-phonecat-first-phonecat-internal',
		fixture: internalReceiptFixture,
	},
} as const;

export function resolveAngularPhonecatReceiptIdentity(
	identity: AngularPhonecatInternalReceiptIdentity | undefined,
	publishAggregate: boolean,
): { runId: string; fixture: string } {
	if (identity === undefined)
		return { runId: 'T069-angular-phonecat-vite8', fixture: 'angular-phonecat-vite8' };
	if (!(identity in internalReceiptIdentities))
		throw new Error('Unknown Angular PhoneCat internal receipt identity');
	if (publishAggregate)
		throw new Error('Angular PhoneCat internal receipt identity cannot be aggregated');
	return internalReceiptIdentities[identity];
}

export function parseAngularPhonecatReceiptWithDiagnostic(
	receipt: MigrationReceipt,
): MigrationReceipt {
	try {
		return parseMigrationReceipt(receipt);
	} catch (error) {
		const diagnostic = {
			schemaVersion: 'versionless.angular-phonecat-receipt-validation-diagnostic.v1',
			cause: error instanceof Error ? error.message : String(error),
			runId: receipt.runId,
			fixture: receipt.fixture,
			artifactPaths: receipt.artifacts.map((artifact) => artifact.path),
			receipt,
		};
		throw new Error(`Angular PhoneCat receipt validation failed: ${canonicalize(diagnostic)}`, {
			cause: error,
		});
	}
}

function environment(
	runtime: 'node16' | 'node24',
	parentEnvironment: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
	return {
		...parentEnvironment,
		PATH: `${path.join(sourceCache, runtime, 'bin')}:${parentEnvironment.PATH ?? ''}`,
		VERSIONLESS_NETWORK_MODE: 'offline',
		NPM_CONFIG_OFFLINE: 'true',
		npm_config_offline: 'true',
		NPM_CONFIG_CACHE: path.join(taskCache, 'npm-cache'),
		npm_config_cache: path.join(taskCache, 'npm-cache'),
		NODE_OPTIONS: `--require=${guard}`,
	};
}

export function angularPhonecatViteBuildEnvironment(
	parentEnvironment: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
	return { ...environment('node24', parentEnvironment), NODE_ENV: 'production' };
}

function execute(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv) {
	return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
		const child = spawn(command, args, { cwd, env });
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		child.stdout?.on('data', (value: Buffer) => stdout.push(value));
		child.stderr?.on('data', (value: Buffer) => stderr.push(value));
		child.once('error', reject);
		child.once('exit', (code) => {
			const result = {
				stdout: Buffer.concat(stdout).toString(),
				stderr: Buffer.concat(stderr).toString(),
			};
			if (code === 0) resolve(result);
			else reject(new Error(`${command} exited ${code}: ${result.stderr}`));
		});
	});
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

async function tree(directory: string) {
	return Promise.all(
		(await filesBelow(directory)).map(async (file) => ({
			path: path.relative(directory, file).split(path.sep).join('/'),
			sha256: sha256(await readFile(file)),
		})),
	);
}

async function treeDigest(directory: string): Promise<string> {
	return sha256(canonicalize(await tree(directory)));
}

async function validateLibraryInput(manifest: FixtureManifest) {
	const manifestBody = await readFile(libraryManifestFile);
	const provenanceBody = await readFile(libraryProvenanceFile);
	const inventory = JSON.parse(manifestBody.toString('utf8')) as {
		schemaVersion: string;
		treeSha256: string;
		entries: Array<{ path: string; sha256: string }>;
	};
	const provenance = JSON.parse(provenanceBody.toString('utf8')) as Record<string, unknown>;
	const entries = await tree(libraryInput);
	const expectedProvenance = {
		schemaVersion: 'versionless.angular-phonecat-vite8-library-provenance.v1',
		packageLockSha256: manifest.source.packageLockSha256,
		verifiedLibraryTreeSha256,
		preparationArtifact: {
			path: 'evidence/runs/angular-phonecat-composed/artifacts/preparation.json',
			sha256: 'a12c35d28973404e6d2a5f2eebbe661cbe0790626d1401e805367ab684d6aeaf',
		},
		sourceReceipt: {
			path: 'evidence/runs/angular-phonecat-composed/t048-run.json',
			sha256: 'a7e8a9dc864085d77338f1615e3434a8a842fa5f4156a13bd2f5560bd2f8dc12',
		},
	};
	if (
		manifest.libraryCache.treeSha256 !== verifiedLibraryTreeSha256 ||
		sha256(manifestBody) !== manifest.libraryCache.manifestSha256 ||
		sha256(provenanceBody) !== manifest.libraryCache.provenanceSha256 ||
		inventory.schemaVersion !== 'versionless.angular-phonecat-vite8-library-manifest.v1' ||
		inventory.treeSha256 !== verifiedLibraryTreeSha256 ||
		canonicalize(inventory.entries) !== canonicalize(entries) ||
		(await treeDigest(libraryInput)) !== verifiedLibraryTreeSha256 ||
		canonicalize(provenance) !== canonicalize(expectedProvenance) ||
		sha256(
			await readFile(
				path.join(
					root,
					'evidence/runs/angular-phonecat-composed/artifacts/preparation.json',
				),
			),
		) !== expectedProvenance.preparationArtifact.sha256
	)
		throw new Error('Content-addressed PhoneCat library input mismatch');
	return {
		treeSha256: verifiedLibraryTreeSha256,
		manifestSha256: manifest.libraryCache.manifestSha256,
		provenanceSha256: manifest.libraryCache.provenanceSha256,
		entries: entries.length,
	};
}

async function sourceSlice(directory: string) {
	return {
		appConfig: await readFile(path.join(directory, applicationFiles.appConfig), 'utf8'),
		phoneList: await readFile(path.join(directory, applicationFiles.phoneList), 'utf8'),
		phoneDetail: await readFile(path.join(directory, applicationFiles.phoneDetail), 'utf8'),
	};
}

async function writeSources(
	directory: string,
	sources: Awaited<ReturnType<typeof sourceSlice>>,
): Promise<void> {
	for (const key of Object.keys(applicationFiles) as Array<keyof typeof applicationFiles>)
		await writeFile(path.join(directory, applicationFiles[key]), sources[key]);
}

function sourceDigest(sources: Awaited<ReturnType<typeof sourceSlice>>): string {
	return sha256(
		canonicalize(
			Object.fromEntries(
				(Object.keys(applicationFiles) as Array<keyof typeof applicationFiles>).map(
					(key) => [applicationFiles[key], sha256(sources[key])],
				),
			),
		),
	);
}

async function prepare(directory: string, runtime: 'node16' | 'node24') {
	const env = environment(runtime);
	const npm = path.join(sourceCache, runtime, 'bin/npm');
	const before = sha256(await readFile(path.join(directory, 'package-lock.json')));
	const libraries = path.join(directory, 'app/lib');
	await rm(libraries, { recursive: true, force: true });
	await cp(libraryInput, libraries, { recursive: true });
	const after = sha256(await readFile(path.join(directory, 'package-lock.json')));
	if (before !== after) throw new Error('PhoneCat lock changed during offline preparation');
	return {
		runtime: (
			await execute(
				path.join(sourceCache, runtime, 'bin/node'),
				['--version'],
				directory,
				env,
			)
		).stdout.trim(),
		npm: (await execute(npm, ['--version'], directory, env)).stdout.trim(),
		lockSha256: after,
		copyLibsSha256: await treeDigest(path.join(directory, 'app/lib')),
	};
}

async function viteBuild(directory: string) {
	const env = angularPhonecatViteBuildEnvironment();
	const result = await execute(
		path.join(sourceCache, 'node24/bin/node'),
		['--experimental-strip-types', viteCli, 'build', '--config', adapter],
		directory,
		env,
	);
	if (!`${result.stdout}${result.stderr}`.includes('vite v8.0.16'))
		throw new Error('Target did not execute root Vite 8.0.16');
	return validateBuild(directory);
}

async function validateBuild(directory: string) {
	const output = path.join(directory, 'build-vite');
	const inventoryFile = path.join(output, 'runtime-inventory.json');
	const inventory = JSON.parse(await readFile(inventoryFile, 'utf8')) as {
		schemaVersion: string;
		entries: Array<{ path: string; url: string; sha256: string }>;
	};
	const expected = await Promise.all(
		(await filesBelow(output))
			.map((file) => path.relative(output, file).split(path.sep).join('/'))
			.filter((file) => file !== 'runtime-inventory.json')
			.sort()
			.map(async (file) => ({
				path: file,
				url: joinURL('/', file),
				sha256: sha256(await readFile(path.join(output, file))),
			})),
	);
	if (
		inventory.schemaVersion !== 'versionless.angular-phonecat-vite8-inventory.v1' ||
		canonicalize(inventory.entries) !== canonicalize(expected) ||
		expected.some((entry) => parseURL(entry.url).host) ||
		expected.some((entry) => entry.path === 'sw.js') ||
		!expected.some((entry) => entry.path === 'phone-detail/phone-detail.template.html')
	)
		throw new Error('Vite runtime inventory is incomplete or non-canonical');
	return {
		digest: await treeDigest(output),
		inventorySha256: sha256(await readFile(inventoryFile)),
		entries: expected,
	};
}

function mime(file: string): string {
	switch (path.extname(file).toLowerCase()) {
		case '.html':
			return 'text/html';
		case '.js':
			return 'text/javascript';
		case '.css':
			return 'text/css';
		case '.json':
			return 'application/json';
		case '.png':
			return 'image/png';
		case '.jpg':
			return 'image/jpeg';
		case '.woff':
		case '.woff2':
			return 'font/woff';
		default:
			return 'application/octet-stream';
	}
}

function ephemeralPort(server: http.Server): number {
	const address = server.address();
	if (address === null || typeof address === 'string')
		throw new Error('Loopback server did not report an ephemeral port');
	return address.port;
}

async function startServer(directory: string): Promise<{ server: http.Server; port: number }> {
	const server = http.createServer(async (request, response) => {
		try {
			const pathname = decodePath(parseURL(request.url ?? '/').pathname);
			const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
			const file = path.resolve(directory, relative);
			if (file !== directory && !file.startsWith(`${directory}${path.sep}`))
				throw new Error('Parent traversal refused');
			const information = await stat(file);
			const selected = information.isDirectory() ? path.join(file, 'index.html') : file;
			response.writeHead(200, {
				'content-type': mime(selected),
				'cache-control': 'no-store',
			});
			response.end(await readFile(selected));
		} catch {
			response.writeHead(404);
			response.end('not found');
		}
	});
	await new Promise<void>((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', resolve);
	});
	return { server, port: ephemeralPort(server) };
}

async function stopServer(server: http.Server): Promise<void> {
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
	throw new Error(`PhoneCat Vite built-entry readiness failed: ${lastFailure}`);
}

async function runJourney(
	browser: Browser,
	served: string,
	port: number,
	journey: Journey,
	lane: string,
	run: number,
	probe: ServerProbe,
	expectFailure = false,
) {
	const context = await browser.newContext({
		locale: journey.locale,
		timezoneId: journey.timezoneId,
		viewport: journey.viewport,
	});
	const blocked: string[] = [];
	const successfulNonLoopback: string[] = [];
	const consoleErrors: string[] = [];
	const pageErrors: string[] = [];
	const failedRequests: Array<{ url: string; errorText: string }> = [];
	await context.route('**/*', async (route) => {
		const requestUrl = route.request().url();
		const parsed = parseURL(requestUrl);
		if (['127.0.0.1', 'localhost', '::1'].includes(parseHost(parsed.host ?? '').hostname))
			await route.continue();
		else {
			blocked.push(requestUrl);
			await route.fulfill({ status: 204, body: '' });
		}
	});
	const page = await context.newPage();
	page.on('response', (response) => {
		const parsed = parseURL(response.url());
		if (
			!['127.0.0.1', 'localhost', '::1'].includes(parseHost(parsed.host ?? '').hostname) &&
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
	let failedAsIntended = false;
	let mainDocument: { status: number; contentType: string } | null = null;
	try {
		const response = await page.goto(joinURL(`http://127.0.0.1:${port}`, journey.initialPath), {
			waitUntil: 'networkidle',
		});
		mainDocument = response
			? { status: response.status(), contentType: response.headers()['content-type'] ?? '' }
			: null;
		await page.waitForURL((url) => `${url.pathname}${url.hash}` === journey.redirectPath);
		const phones = page.locator('ul.phones > li');
		await phones.first().waitFor();
		await page.locator('input[ng-model="$ctrl.query"]').fill(journey.filterText);
		await page.waitForFunction(
			(count) => document.querySelectorAll('ul.phones > li').length === count,
			journey.expectedFilteredCount,
		);
		await page.locator('input[ng-model="$ctrl.query"]').fill('');
		await page.locator('select').selectOption(journey.orderValue);
		if (
			(await phones.first().locator('a:not(.thumb)').innerText()).trim() !==
			journey.firstOrderedPhone
		)
			throw new Error('Ordered phone assertion failed');
		await page.locator('ul.phones a:not(.thumb)', { hasText: journey.detailLink }).click();
		const detail = parseURL(page.url());
		if (`${detail.pathname}${detail.hash}` !== journey.detailPath)
			throw new Error('Detail navigation assertion failed');
		try {
			await page
				.getByRole('heading', { name: journey.detailHeading })
				.waitFor({ timeout: 5_000 });
		} catch {
			if (!expectFailure) throw new Error('Detail heading assertion failed');
			throw new Error(
				(await stat(path.join(served, 'phone-detail/phone-detail.template.html')).catch(
					() => null,
				))
					? 'Detail heading assertion failed'
					: 'Detail template request failed',
			);
		}
		const main = page.locator('img.phone.selected');
		if (!(await main.getAttribute('src'))?.endsWith(journey.initialImageSuffix))
			throw new Error('Initial selected-image assertion failed');
		for (const suffix of journey.thumbnailSwapSuffixes) {
			await page.locator(`ul.phone-thumbs img[src$="${suffix}"]`).click();
			if (!(await main.getAttribute('src'))?.endsWith(suffix))
				throw new Error('Thumbnail selected-image assertion failed');
		}
	} catch (error) {
		if (expectFailure && error instanceof Error && intendedFailure.test(error.message))
			failedAsIntended = true;
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
	} finally {
		await context.close();
	}
	if (expectFailure && !failedAsIntended) throw new Error('Mutation did not fail intended seam');
	if (!expectFailure && (consoleErrors.length || pageErrors.length))
		throw new Error(
			`Unexpected browser errors: ${JSON.stringify({ consoleErrors, pageErrors })}`,
		);
	if (successfulNonLoopback.length)
		throw new Error(`Successful non-loopback traffic: ${successfulNonLoopback.join(', ')}`);
	return {
		lane,
		run,
		result: expectFailure ? 'intended-failure' : 'pass',
		redirectPath: journey.redirectPath,
		filterText: journey.filterText,
		orderValue: journey.orderValue,
		detail: journey.detailLink,
		initialImage: journey.initialImageSuffix,
		thumbnailSwaps: journey.thumbnailSwapSuffixes,
		blocked,
		successfulNonLoopback,
		consoleErrors,
		pageErrors,
	};
}

async function journeyOnce(
	browserExecutable: string,
	served: string,
	journey: Journey,
	lane: string,
	run: number,
	expectFailure = false,
) {
	const browser = await chromium.launch({ headless: true, executablePath: browserExecutable });
	const { server, port } = await startServer(served);
	try {
		const probe = await probeBuiltEntry(port);
		return await runJourney(browser, served, port, journey, lane, run, probe, expectFailure);
	} finally {
		await stopServer(server);
		await browser.close();
	}
}

async function artifact(name: string, value: unknown): Promise<Artifact> {
	const file = path.join(artifactsRoot, name);
	const content = typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`;
	await writeFile(file, content);
	return { path: path.relative(root, file), sha256: sha256(content) };
}

export async function verifyAngularPhonecatVite8({
	receiptPath,
	workPath,
	artifactsPath,
	adapterConfigPath,
	publishAggregate = true,
	internalReceiptIdentity,
}: {
	receiptPath: string;
	workPath?: string;
	artifactsPath?: string;
	adapterConfigPath?: string;
	publishAggregate?: boolean;
	internalReceiptIdentity?: AngularPhonecatInternalReceiptIdentity;
}): Promise<MigrationReceipt> {
	workRoot = workPath ?? defaultWorkRoot;
	artifactsRoot = artifactsPath ?? defaultArtifactsRoot;
	adapter = adapterConfigPath ?? defaultAdapter;
	const receiptIdentity = resolveAngularPhonecatReceiptIdentity(
		internalReceiptIdentity,
		publishAggregate,
	);
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('fixture:verify requires explicit offline mode');
	const manifest = JSON.parse(await readFile(fixtureFile, 'utf8')) as FixtureManifest;
	const journey = JSON.parse(await readFile(journeyFile, 'utf8')) as Journey;
	const consent = JSON.parse(await readFile(path.join(sourceCache, 'consent.json'), 'utf8')) as {
		consentId: string;
		purpose: string;
		networkMode: 'consented';
	};
	const pins = {
		archive: sha256(await readFile(path.join(sourceCache, 'source.tar.gz'))),
		license: sha256(await readFile(path.join(sourceRoot, 'LICENSE'))),
		package: sha256(await readFile(path.join(sourceRoot, 'package.json'))),
		lock: sha256(await readFile(path.join(sourceRoot, 'package-lock.json'))),
		appConfig: sha256(await readFile(path.join(sourceRoot, applicationFiles.appConfig))),
		phoneList: sha256(await readFile(path.join(sourceRoot, applicationFiles.phoneList))),
		phoneDetail: sha256(await readFile(path.join(sourceRoot, applicationFiles.phoneDetail))),
		node16: sha256(await readFile(path.join(sourceCache, 'node-v16.20.2-darwin-arm64.tar.gz'))),
		node24: sha256(await readFile(path.join(sourceCache, 'node-v24.15.0-darwin-arm64.tar.gz'))),
		vite: sha256(await readFile(vitePackage)),
		browser: sha256(await readFile(path.join(root, manifest.browser.executable))),
	};
	if (
		consent.purpose !== ANGULAR_PHONECAT_INGEST_PURPOSE ||
		consent.networkMode !== 'consented' ||
		pins.archive !== manifest.source.archiveSha256 ||
		pins.license !== manifest.source.licenseSha256 ||
		pins.package !== manifest.source.packageSha256 ||
		pins.lock !== manifest.source.packageLockSha256 ||
		pins.appConfig !== manifest.source.appConfigSha256 ||
		pins.phoneList !== manifest.source.phoneListSha256 ||
		pins.phoneDetail !== manifest.source.phoneDetailSha256 ||
		pins.node16 !== manifest.runtimes.legacy.sha256 ||
		pins.node24 !== manifest.runtimes.target.sha256 ||
		pins.vite !== manifest.vite.packageSha256 ||
		pins.browser !== manifest.browser.sha256
	)
		throw new Error('Pinned PhoneCat Vite input mismatch');
	for (const receipt of [
		'evidence/runs/angular-phonecat/t014-run.json',
		'evidence/runs/angular-phonecat-route-resolve/t032-run.json',
		'evidence/runs/angular-phonecat-composed/t048-run.json',
	])
		await verifyReceipt(path.join(root, receipt));
	const verifiedLibraryInput = await validateLibraryInput(manifest);

	await rm(workRoot, { recursive: true, force: true });
	await mkdir(workRoot, { recursive: true });
	const legacy = path.join(workRoot, 'legacy');
	const stage = path.join(workRoot, 'target.stage');
	const reverse = path.join(workRoot, 'reverse');
	const target = path.join(workRoot, 'target');
	await Promise.all(
		[legacy, stage, reverse].map((directory) => cp(sourceRoot, directory, { recursive: true })),
	);
	const pristine = await sourceSlice(sourceRoot);
	const lexical = transformPhoneDetailLexicalThis(pristine.phoneDetail);
	const lexicalRoute = transformPhoneRouteResolve({ ...pristine, phoneDetail: lexical.code });
	const route = transformPhoneRouteResolve(pristine);
	const routeLexical = transformPhoneDetailLexicalThis(route.code.phoneDetail);
	const reverseOutput = { ...route.code, phoneDetail: routeLexical.code };
	await Promise.all([
		writeSources(stage, lexicalRoute.code),
		writeSources(reverse, reverseOutput),
	]);
	const firstOutput = sourceDigest(await sourceSlice(stage));
	const secondOutput = sourceDigest(await sourceSlice(reverse));
	if (
		firstOutput !== secondOutput ||
		canonicalize(lexicalRoute.code) !== canonicalize(reverseOutput)
	)
		throw new Error('AngularJS transform orders did not produce identical exact outputs');
	await rm(reverse, { recursive: true, force: true });

	const legacyPreparation = await prepare(legacy, 'node16');
	const targetPreparation = await prepare(stage, 'node24');
	if (
		legacyPreparation.lockSha256 !== manifest.source.packageLockSha256 ||
		targetPreparation.lockSha256 !== manifest.source.packageLockSha256 ||
		legacyPreparation.copyLibsSha256 !== targetPreparation.copyLibsSha256
	)
		throw new Error('PhoneCat lane preparation diverged');
	const firstBuild = await viteBuild(stage);
	const secondBuild = await viteBuild(stage);
	if (canonicalize(firstBuild) !== canonicalize(secondBuild))
		throw new Error('PhoneCat Vite output was not byte-identical');
	await rename(stage, target);
	const publishedDigest = await treeDigest(target);
	const failedStage = path.join(workRoot, 'failed.stage');
	await cp(target, failedStage, { recursive: true });
	await rm(path.join(failedStage, 'build-vite/phone-detail/phone-detail.template.html'));
	let injectedFailure = false;
	try {
		await validateBuild(failedStage);
	} catch {
		injectedFailure = true;
	} finally {
		await rm(failedStage, { recursive: true, force: true });
	}
	if (!injectedFailure || (await treeDigest(target)) !== publishedDigest)
		throw new Error('Injected staged-output failure was not failure-atomic');

	const browserExecutable = path.join(root, manifest.browser.executable);
	const journeys = [];
	for (const [lane, served] of [
		['legacy', path.join(legacy, 'app')],
		['target', path.join(target, 'build-vite')],
	] as const)
		for (let run = 1; run <= journey.qualificationRuns; run++)
			journeys.push(await journeyOnce(browserExecutable, served, journey, lane, run));

	const mutations = [];
	const bindingFile = path.join(target, applicationFiles.appConfig);
	const bindingBody = await readFile(bindingFile, 'utf8');
	const bindingHash = sha256(bindingBody);
	const bindingBefore = `template: '<phone-detail phone="$resolve.phone"></phone-detail>',`;
	const bindingAfter = `template: '<phone-detail phone="{}"></phone-detail>',`;
	if (!bindingBody.includes(bindingBefore))
		throw new Error('Composed binding mutation seam missing');
	try {
		await writeFile(bindingFile, bindingBody.replace(bindingBefore, bindingAfter));
		await viteBuild(target);
		const failure = await journeyOnce(
			browserExecutable,
			path.join(target, 'build-vite'),
			journey,
			'binding-mutation',
			1,
			true,
		);
		mutations.push({
			seam: 'composed-one-way-detail-binding',
			result: failure.result,
			restoration: 'byte-identical',
			restoredSha256: bindingHash,
			reproduced: 'pass',
		});
	} finally {
		await writeFile(bindingFile, bindingBody);
	}
	if (sha256(await readFile(bindingFile)) !== bindingHash)
		throw new Error('Binding mutation did not restore byte-identically');
	await viteBuild(target);
	await journeyOnce(
		browserExecutable,
		path.join(target, 'build-vite'),
		journey,
		'binding-restored',
		1,
	);

	const templateFile = path.join(target, 'build-vite/phone-detail/phone-detail.template.html');
	const templateBody = await readFile(templateFile);
	const templateHash = sha256(templateBody);
	await rm(templateFile);
	const templateFailure = await journeyOnce(
		browserExecutable,
		path.join(target, 'build-vite'),
		journey,
		'template-mutation',
		1,
		true,
	);
	await writeFile(templateFile, templateBody);
	if (sha256(await readFile(templateFile)) !== templateHash)
		throw new Error('Template mutation did not restore byte-identically');
	await viteBuild(target);
	await journeyOnce(
		browserExecutable,
		path.join(target, 'build-vite'),
		journey,
		'template-restored',
		1,
	);
	mutations.push({
		seam: 'emitted-detail-template',
		result: templateFailure.result,
		restoration: 'byte-identical',
		restoredSha256: templateHash,
		reproduced: 'pass',
	});
	const restoredBuild = await validateBuild(target);
	if (canonicalize(restoredBuild) !== canonicalize(firstBuild))
		throw new Error('Restored target build differs from published Vite output');

	await rm(artifactsRoot, { recursive: true, force: true });
	await mkdir(artifactsRoot, { recursive: true });
	const transformOrder = {
		orders: [
			{
				order: ['phone-detail-lexical-this', 'phone-route-resolve-component-binding'],
				trace: ['phone-detail', 'app-config', 'phone-list'],
				outputSha256: firstOutput,
			},
			{
				order: ['phone-route-resolve-component-binding', 'phone-detail-lexical-this'],
				trace: ['app-config', 'phone-list', 'phone-detail'],
				outputSha256: secondOutput,
			},
		],
		orderIndependent: true,
		changedFiles: [...changedFiles],
	};
	const locality = {
		mode: 'offline' as const,
		scope: 'Versionless-spawned Node/npm/Vite children and Playwright browser requests',
		osWideIsolation: false as const,
		successfulNonLoopback: 0 as const,
		browserBlockedRequests: journeys.flatMap((item) => item.blocked).length,
	};
	const deterministicInput = {
		fixture: manifest.id,
		revision: manifest.source.revision,
		libraryInput: verifiedLibraryInput,
		transformOrder,
		build: restoredBuild,
		journeys,
		mutations,
	};
	const first = sha256(canonicalize(deterministicInput));
	const second = sha256(canonicalize(JSON.parse(JSON.stringify(deterministicInput))));
	const artifacts = [
		await artifact('preparation.json', {
			pins,
			libraryInput: verifiedLibraryInput,
			legacy: legacyPreparation,
			target: targetPreparation,
		}),
		await artifact('transform-order.json', transformOrder),
		await artifact('migration-diff.json', {
			changedFiles,
			sourceHashes: Object.fromEntries(
				(Object.keys(applicationFiles) as Array<keyof typeof applicationFiles>).map(
					(key) => [applicationFiles[key], sha256(pristine[key])],
				),
			),
			targetHashes: Object.fromEntries(
				(Object.keys(applicationFiles) as Array<keyof typeof applicationFiles>).map(
					(key) => [applicationFiles[key], sha256(lexicalRoute.code[key])],
				),
			),
		}),
		await artifact('vite-build.json', {
			first: firstBuild,
			second: secondBuild,
			equal: true,
			serviceWorker: 'out-of-scope-not-emitted',
		}),
		await artifact('publication.json', {
			method: 'same-filesystem-staged-directory-rename',
			validatedBeforePublish: true,
			injectedFailure: 'refused',
			publishedTarget: 'unchanged',
			failedStageCleanup: true,
		}),
		await artifact('journey.json', journeys),
		await artifact('locality.json', locality),
		await artifact('mutation.json', { mutations }),
		await artifact('runtime.json', {
			legacyNode: '16.20.2',
			targetNode: '24.15.0',
			vite: '8.0.16',
			browser: manifest.browser.executable,
		}),
		await artifact('deterministic-core.json', { first, second, equal: true }),
	];
	const receipt: MigrationReceipt = {
		schemaVersion: 'versionless.receipt.v1',
		runId: receiptIdentity.runId,
		fixture: receiptIdentity.fixture,
		source: {
			repository: manifest.source.repository,
			revision: manifest.source.revision,
			archiveSha256: manifest.source.archiveSha256,
			license: manifest.source.license,
			licenseSha256: manifest.source.licenseSha256,
		},
		tooling: {
			legacyNode: '16.20.2 with npm 8.19.4 EOL compatibility sandbox',
			targetNode: '24.15.0 maintained target tooling lane',
			vite: '8.0.16 fixture-specific adapter',
			yukuParser: '0.7.0',
			yukuAnalyzer: '0.7.0',
			playwright: '1.58.2',
			chromium: '145.0.7632.6',
		},
		consent: [{ id: consent.consentId, purpose: consent.purpose, mode: consent.networkMode }],
		migration: {
			file: changedFiles.join(' + '),
			transform: 'phone-detail-lexical-this+phone-route-resolve-component-binding',
			edits: 7,
			track: 'angularjs-special-track',
			changedFiles: [...changedFiles],
			outerController: 'constructable-function',
			injectionAnnotation: 'unchanged',
			orders: ['lexical-first', 'route-first'],
			executionTraces: [transformOrder.orders[0]!.trace, transformOrder.orders[1]!.trace],
			actualOrdersExecuted: true,
			atomic: true,
			publication: 'same-filesystem-staged-directory-rename',
			viteOutput: 'self-contained-rehashable',
			serviceWorker: 'out-of-scope-not-emitted',
		},
		verification: {
			result: 'pass',
			builds: 'pass',
			journeys: 'pass',
			mutation: 'pass',
			locality,
			deterministicCore: { first, second, equal: true },
		},
		artifacts,
		integrity: { algorithm: 'sha256', canonicalDigest: '', authenticity: 'not-established' },
		limitations: [
			'AngularJS special-track evidence; this is not Angular 2+ or Angular CLI/AOT proof.',
			'The Vite adapter is fixture-specific; unplugin and generic adapter support are not-tested.',
			'Old-Vite support is not-tested and no designated pilot is established.',
			'Service-worker behavior is out of scope and PWA behavior is out of scope; no worker is emitted.',
			'Hash integrity does not establish certification, signer authenticity, or Git provenance.',
			'Network controls are process-scoped and do not establish OS-wide isolation.',
		],
	};
	receipt.integrity.canonicalDigest = receiptDigest(receipt);
	parseAngularPhonecatReceiptWithDiagnostic(receipt);
	const absolute = path.resolve(receiptPath);
	await mkdir(path.dirname(absolute), { recursive: true });
	await writeFile(absolute, `${JSON.stringify(receipt, null, 2)}\n`);
	await writeFile(
		absolute.endsWith('.json') ? `${absolute.slice(0, -5)}.md` : `${absolute}.md`,
		renderReceipt(receipt),
	);
	if (publishAggregate) {
		const aggregatePath = path.join(root, 'evidence/runs/aggregate.json');
		const aggregate = JSON.parse(await readFile(aggregatePath, 'utf8')) as {
			fixtures: Array<Record<string, unknown>>;
			unsupported: unknown[];
		};
		const fixtures = aggregate.fixtures.filter((item) => item.id !== manifest.id);
		fixtures.push({
			id: manifest.id,
			framework: 'angularjs',
			track: 'angularjs-special-track',
			bundler: 'none-static-to-vite-8',
			runtime: 'node-16-to-node-24.15.0',
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
