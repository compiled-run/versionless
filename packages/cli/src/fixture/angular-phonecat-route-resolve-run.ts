import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
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
import { transformPhoneRouteResolve } from '../../../frameworks/angularjs/src/phone-route-resolve.ts';
import { ANGULAR_PHONECAT_INGEST_PURPOSE } from './angular-phonecat-ingest.ts';

const root = path.resolve(import.meta.dirname, '../../../..');
const fixtureFile = path.join(root, 'fixtures/angular-phonecat-route-resolve/fixture.json');
const journeyFile = path.join(root, 'fixtures/angular-phonecat/journey.json');
const cacheRoot = path.join(root, '.versionless/cache/angular-phonecat');
const sourceRoot = path.join(cacheRoot, 'source');
const workRoot = path.join(root, '.versionless/work/angular-phonecat-route-resolve');
const artifactsRoot = path.join(root, 'evidence/runs/angular-phonecat-route-resolve/artifacts');
const guard = path.join(root, 'packages/node-guard/dist/index.cjs');
const routeFiles = {
	appConfig: 'app/app.config.js',
	phoneList: 'app/phone-list/phone-list.component.js',
	phoneDetail: 'app/phone-detail/phone-detail.component.js',
} as const;
const intendedDetailFailure = createRegExp(
	anyOf(
		exactly('Detail heading assertion failed'),
		exactly('Initial selected-image assertion failed'),
	),
);

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

function childEnvironment(runtime: string): NodeJS.ProcessEnv {
	return {
		...process.env,
		PATH: `${path.join(cacheRoot, runtime, 'bin')}:${process.env.PATH ?? ''}`,
		VERSIONLESS_NETWORK_MODE: 'offline',
		NPM_CONFIG_OFFLINE: 'true',
		npm_config_offline: 'true',
		NPM_CONFIG_CACHE: path.join(cacheRoot, 'npm-cache'),
		npm_config_cache: path.join(cacheRoot, 'npm-cache'),
		NODE_OPTIONS: `--require=${guard}`,
	};
}

function execute(command: string, args: string[], cwd: string, environment: NodeJS.ProcessEnv) {
	return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
		const child = spawn(command, args, { cwd, env: environment });
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

async function treeDigest(directory: string): Promise<string> {
	const rows: string[] = [];
	const visit = async (current: string): Promise<void> => {
		for (const entry of await readdir(current, { withFileTypes: true })) {
			const absolute = path.join(current, entry.name);
			if (entry.isDirectory()) await visit(absolute);
			else if (entry.isFile())
				rows.push(
					`${path.relative(directory, absolute)}:${sha256(await readFile(absolute))}`,
				);
		}
	};
	await visit(directory);
	return sha256(rows.sort().join('\n'));
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
		case '.jpeg':
			return 'image/jpeg';
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

async function startServer(lane: string): Promise<{ server: http.Server; port: number }> {
	const app = path.join(lane, 'app');
	const server = http.createServer(async (request, response) => {
		try {
			const pathname = decodePath(parseURL(request.url ?? '/').pathname);
			const relative =
				pathname === '/' ? 'index.html' : pathname.replaceAll('/', path.sep).slice(1);
			const file = path.resolve(app, relative);
			if (file !== app && !file.startsWith(`${app}${path.sep}`))
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

async function runJourney(
	browser: Browser,
	port: number,
	journey: Journey,
	lane: string,
	run: number,
	expectMutationFailure = false,
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
	await context.route('**/*', async (route) => {
		const requestUrl = route.request().url();
		const parsed = parseURL(requestUrl);
		if (['127.0.0.1', 'localhost', '::1'].includes(parseHost(parsed.host ?? '').hostname))
			await route.continue();
		else {
			blocked.push(requestUrl);
			syntheticBlocked.add(requestUrl);
			await route.fulfill({ status: 204, body: '' });
		}
	});
	const page = await context.newPage();
	page.on('response', (response) => {
		const parsed = parseURL(response.url());
		if (
			!['127.0.0.1', 'localhost', '::1'].includes(parseHost(parsed.host ?? '').hostname) &&
			!syntheticBlocked.has(response.url()) &&
			response.ok()
		)
			successfulNonLoopback.push(response.url());
	});
	page.on('console', (message) => {
		if (message.type() === 'error') consoleErrors.push(message.text());
	});
	page.on('pageerror', (error) => pageErrors.push(error.message));
	let intendedFailure = false;
	try {
		await page.goto(joinURL(`http://127.0.0.1:${port}`, journey.initialPath), {
			waitUntil: 'networkidle',
		});
		await page.waitForURL((url) => `${url.pathname}${url.hash}` === journey.redirectPath);
		const phones = page.locator('ul.phones > li');
		await phones.first().waitFor();
		await page.locator('input[ng-model="$ctrl.query"]').fill(journey.filterText);
		const deadline = Date.now() + 5_000;
		while ((await phones.count()) !== journey.expectedFilteredCount) {
			if (Date.now() >= deadline) throw new Error('Filtered count assertion failed');
			await new Promise((resolve) => setTimeout(resolve, 25));
		}
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
			throw new Error('Detail heading assertion failed');
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
		if (
			expectMutationFailure &&
			error instanceof Error &&
			intendedDetailFailure.test(error.message)
		)
			intendedFailure = true;
		else throw error;
	}
	await context.close();
	if (expectMutationFailure && !intendedFailure)
		throw new Error('Mutation did not fail the intended detail assertion');
	if (!expectMutationFailure && (consoleErrors.length || pageErrors.length))
		throw new Error(
			`Unexpected browser errors: ${JSON.stringify({ consoleErrors, pageErrors })}`,
		);
	if (successfulNonLoopback.length)
		throw new Error(`Successful non-loopback traffic: ${successfulNonLoopback.join(', ')}`);
	return {
		lane,
		run,
		result: expectMutationFailure ? 'intended-failure' : 'pass',
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

async function artifact(name: string, value: unknown): Promise<Artifact> {
	const file = path.join(artifactsRoot, name);
	const content = typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`;
	await writeFile(file, content);
	return { path: path.relative(root, file), sha256: sha256(content) };
}

function markdownPath(jsonPath: string): string {
	return jsonPath.endsWith('.json')
		? `${jsonPath.slice(0, -'.json'.length)}.md`
		: `${jsonPath}.md`;
}

export async function verifyAngularPhonecatRouteResolve({
	receiptPath,
}: {
	receiptPath: string;
}): Promise<MigrationReceipt> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('fixture:verify requires explicit offline mode');
	const manifest = JSON.parse(await readFile(fixtureFile, 'utf8')) as Record<string, any>;
	const journey = JSON.parse(await readFile(journeyFile, 'utf8')) as Journey;
	const consent = JSON.parse(await readFile(path.join(cacheRoot, 'consent.json'), 'utf8')) as {
		consentId: string;
		purpose: string;
		networkMode: 'consented';
	};
	if (
		!consent.consentId?.trim() ||
		consent.purpose !== ANGULAR_PHONECAT_INGEST_PURPOSE ||
		consent.networkMode !== 'consented'
	)
		throw new Error('Pinned T014 consent mismatch');
	const sourceHashes = {
		archive: sha256(await readFile(path.join(cacheRoot, 'source.tar.gz'))),
		license: sha256(await readFile(path.join(sourceRoot, 'LICENSE'))),
		package: sha256(await readFile(path.join(sourceRoot, 'package.json'))),
		lock: sha256(await readFile(path.join(sourceRoot, 'package-lock.json'))),
		appConfig: sha256(await readFile(path.join(sourceRoot, routeFiles.appConfig))),
		phoneList: sha256(await readFile(path.join(sourceRoot, routeFiles.phoneList))),
		phoneDetail: sha256(await readFile(path.join(sourceRoot, routeFiles.phoneDetail))),
		node16: sha256(await readFile(path.join(cacheRoot, 'node-v16.20.2-darwin-arm64.tar.gz'))),
		node24: sha256(await readFile(path.join(cacheRoot, 'node-v24.15.0-darwin-arm64.tar.gz'))),
		browser: sha256(await readFile(path.resolve(root, manifest.browser.executable))),
	};
	if (
		sourceHashes.archive !== manifest.source.archiveSha256 ||
		sourceHashes.license !== manifest.source.licenseSha256 ||
		sourceHashes.package !== manifest.source.packageSha256 ||
		sourceHashes.lock !== manifest.source.packageLockSha256 ||
		sourceHashes.appConfig !== manifest.source.appConfigSha256 ||
		sourceHashes.phoneList !== manifest.source.phoneListSha256 ||
		sourceHashes.phoneDetail !== manifest.source.phoneDetailSha256 ||
		sourceHashes.node16 !== manifest.runtimes.legacy.sha256 ||
		sourceHashes.node24 !== manifest.runtimes.target.sha256 ||
		sourceHashes.browser !== manifest.browser.sha256
	)
		throw new Error('Pinned PhoneCat route-resolve input mismatch');
	await verifyReceipt(path.join(root, 'evidence/runs/angular-phonecat/t014-run.json'));

	await rm(workRoot, { recursive: true, force: true });
	const legacy = path.join(workRoot, 'legacy');
	const target = path.join(workRoot, 'target');
	await mkdir(workRoot, { recursive: true });
	await Promise.all([
		cp(sourceRoot, legacy, { recursive: true }),
		cp(sourceRoot, target, { recursive: true }),
	]);
	const sourceSlice = {
		appConfig: await readFile(path.join(sourceRoot, routeFiles.appConfig), 'utf8'),
		phoneList: await readFile(path.join(sourceRoot, routeFiles.phoneList), 'utf8'),
		phoneDetail: await readFile(path.join(sourceRoot, routeFiles.phoneDetail), 'utf8'),
	};
	const transformed = transformPhoneRouteResolve(sourceSlice);
	for (const file of transformed.files) await writeFile(path.join(target, file.path), file.code);
	if (!transformPhoneRouteResolve(transformed.code).idempotent)
		throw new Error('Route-resolve transform is not idempotent');

	await rm(artifactsRoot, { recursive: true, force: true });
	await mkdir(artifactsRoot, { recursive: true });
	const preparation = [];
	for (const [name, lane, runtime] of [
		['legacy', legacy, 'node16'],
		['target', target, 'node24'],
	] as const) {
		const before = sha256(await readFile(path.join(lane, 'package-lock.json')));
		const environment = childEnvironment(runtime);
		const npm = path.join(cacheRoot, runtime, 'bin/npm');
		await execute(
			npm,
			['ci', '--offline', '--ignore-scripts', '--no-audit', '--no-fund'],
			lane,
			environment,
		);
		await execute(npm, ['run', 'copy-libs', '--ignore-scripts'], lane, environment);
		const after = sha256(await readFile(path.join(lane, 'package-lock.json')));
		if (before !== after || after !== manifest.source.packageLockSha256)
			throw new Error(`${name} lock changed during offline preparation`);
		preparation.push({
			lane: name,
			runtime: (
				await execute(
					path.join(cacheRoot, runtime, 'bin/node'),
					['--version'],
					lane,
					environment,
				)
			).stdout.trim(),
			npm: (await execute(npm, ['--version'], lane, environment)).stdout.trim(),
			lockSha256: after,
			copyLibsSha256: await treeDigest(path.join(lane, 'app/lib')),
		});
	}
	if (preparation[0]?.copyLibsSha256 !== preparation[1]?.copyLibsSha256)
		throw new Error('Legacy/target copied dependency trees differ');

	const browserExecutable = path.resolve(root, manifest.browser.executable);
	const browser = await chromium.launch({ headless: true, executablePath: browserExecutable });
	const journeys = [];
	try {
		for (const [name, lane] of [
			['legacy', legacy],
			['target', target],
		] as const) {
			const { server, port } = await startServer(lane);
			try {
				for (let index = 1; index <= journey.qualificationRuns; index++)
					journeys.push(await runJourney(browser, port, journey, name, index));
			} finally {
				await stopServer(server);
			}
		}
	} finally {
		await browser.close();
	}
	const targetDetail = path.join(target, routeFiles.phoneDetail);
	const restored = await readFile(targetDetail, 'utf8');
	const restoredHash = sha256(restored);
	const mutated = restored.replace("phone: '<'", "phone: '@'");
	if (mutated === restored) throw new Error('Exact detail-binding mutation target absent');
	let mutation;
	try {
		await writeFile(targetDetail, mutated);
		const mutationBrowser = await chromium.launch({
			headless: true,
			executablePath: browserExecutable,
		});
		const { server, port } = await startServer(target);
		try {
			mutation = await runJourney(mutationBrowser, port, journey, 'target-mutation', 1, true);
		} finally {
			await stopServer(server);
			await mutationBrowser.close();
		}
	} finally {
		await writeFile(targetDetail, restored);
	}
	if (!mutation || sha256(await readFile(targetDetail)) !== restoredHash)
		throw new Error('Detail-binding restoration was not byte-identical');
	const restoredBrowser = await chromium.launch({
		headless: true,
		executablePath: browserExecutable,
	});
	const { server: restoredServer, port: restoredPort } = await startServer(target);
	let restoredJourney;
	try {
		restoredJourney = await runJourney(
			restoredBrowser,
			restoredPort,
			journey,
			'target-restored',
			1,
		);
	} finally {
		await stopServer(restoredServer);
		await restoredBrowser.close();
	}

	const locality = {
		mode: 'offline' as const,
		scope: 'Versionless-spawned Node/npm child processes and Playwright browser requests',
		osWideIsolation: false as const,
		successfulNonLoopback: 0 as const,
		browserBlockedRequests: journeys.flatMap((item) => item.blocked).length,
	};
	const changedFiles = transformed.files.map((file) => file.path);
	const deterministicInput = {
		fixture: manifest.id,
		revision: manifest.source.revision,
		changedFiles,
		targets: Object.fromEntries(
			transformed.files.map((file) => [file.path, file.targetSha256]),
		),
		journey: {
			filterText: journey.filterText,
			orderValue: journey.orderValue,
			detail: journey.detailLink,
			initialImage: journey.initialImageSuffix,
			thumbnailSwaps: journey.thumbnailSwapSuffixes,
		},
	};
	const first = sha256(canonicalize(deterministicInput));
	const second = sha256(canonicalize(JSON.parse(JSON.stringify(deterministicInput))));
	const artifacts = await Promise.all([
		artifact('preparation.json', preparation),
		artifact('runtime.json', {
			browserExecutable: manifest.browser.executable,
			browserSha256: sourceHashes.browser,
		}),
		artifact('journey.json', journeys),
		artifact('locality.json', locality),
		artifact('mutation.json', {
			mutation: mutation.result,
			mutationKind: 'detail-one-way-binding-to-string',
			restoredSha256: restoredHash,
			restoration: 'byte-identical',
			reproduced: restoredJourney.result,
		}),
		artifact('migration-diff.json', {
			changedFiles,
			files: transformed.files.map((file) => ({
				path: file.path,
				sourceSha256: file.sourceSha256,
				targetSha256: file.targetSha256,
				edits: file.edits.length,
			})),
		}),
		artifact('transform.json', {
			semanticEngine: transformed.semanticEngine,
			preconditions: transformed.preconditions,
			idempotent: transformPhoneRouteResolve(transformed.code).idempotent,
			dataSource: 'frozen local phones/*.json through existing Phone resource',
			bindings: 'one-way',
			lifecycle: '$onInit',
		}),
		artifact('deterministic-core.json', { first, second, equal: true }),
	]);
	const compositeFile = changedFiles.join(' + ');
	const receipt: MigrationReceipt = {
		schemaVersion: 'versionless.receipt.v1',
		runId: 'T032-angular-phonecat-route-resolve',
		fixture: manifest.id,
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
			yukuParser: '0.7.0',
			yukuAnalyzer: '0.7.0',
			playwright: '1.58.2',
			chromium: '145.0.7632.6',
			application: 'AngularJS 1.8 static application without a bundler',
		},
		consent: [{ id: consent.consentId, purpose: consent.purpose, mode: consent.networkMode }],
		migration: {
			file: compositeFile,
			transform: 'phone-route-resolve-component-binding',
			edits: 4,
			track: 'angularjs-special-track',
			changedFiles: [compositeFile],
			outerController: 'constructable-function',
			injectionAnnotation: 'unchanged',
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
			'Hash integrity does not establish signer authenticity or Git provenance.',
			'Network controls cover spawned children and browser routing, not OS-wide isolation.',
			'Node 16 is EOL and used only as a compatibility sandbox.',
			'This is AngularJS special-track static evidence, not Angular 2+, Angular CLI/AOT, or adjacent-major proof.',
			'This does not prove a designated Angular pilot or new bundler support.',
			'Certification, signing identity, and authenticity are not claimed.',
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
		framework: 'angularjs',
		track: 'angularjs-special-track',
		bundler: 'none-static',
		result: 'pass',
		receipt: path.relative(root, absolute),
		digest: receipt.integrity.canonicalDigest,
	});
	await writeFile(aggregatePath, `${JSON.stringify({ ...aggregate, fixtures }, null, 2)}\n`);
	await verifyReceipt(absolute);
	return receipt;
}
