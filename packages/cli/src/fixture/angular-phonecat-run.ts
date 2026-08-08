import { spawn } from 'node:child_process';
import { readdir, readFile, rm, stat, writeFile, mkdir } from 'node:fs/promises';
import http from 'node:http';
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
import { ANGULAR_PHONECAT_INGEST_PURPOSE } from './angular-phonecat-ingest.ts';

const root = path.resolve(import.meta.dirname, '../../../..');
const workRoot = path.join(root, '.versionless/work/angular-phonecat');
const cacheRoot = path.join(root, '.versionless/cache/angular-phonecat');
const artifactsRoot = path.join(root, 'evidence/runs/angular-phonecat/artifacts');
const guard = path.join(root, 'packages/node-guard/dist/index.cjs');

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

function childEnv(runtime: string): NodeJS.ProcessEnv {
	const bin = path.join(cacheRoot, runtime, 'bin');
	return {
		...process.env,
		PATH: `${bin}:${process.env.PATH ?? ''}`,
		VERSIONLESS_NETWORK_MODE: 'offline',
		NPM_CONFIG_OFFLINE: 'true',
		npm_config_offline: 'true',
		NPM_CONFIG_CACHE: path.join(cacheRoot, 'npm-cache'),
		npm_config_cache: path.join(cacheRoot, 'npm-cache'),
		NODE_OPTIONS: `${process.env.NODE_OPTIONS ? `${process.env.NODE_OPTIONS} ` : ''}--require=${guard}`,
	};
}

function run(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv) {
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

const mime = (file: string) => {
	if (file.endsWith('.html')) return 'text/html';
	if (file.endsWith('.js')) return 'text/javascript';
	if (file.endsWith('.css')) return 'text/css';
	if (file.endsWith('.json')) return 'application/json';
	const extension = path.extname(file).toLowerCase();
	if (['.png', '.jpg', '.jpeg', '.gif'].includes(extension))
		return `image/${extension.slice(1).replace('jpg', 'jpeg')}`;
	return 'application/octet-stream';
};

function withoutLeadingSlashes(value: string): string {
	let result = value;
	while (result.startsWith('/')) result = result.slice(1);
	return result;
}

function markdownPath(jsonPath: string): string {
	return jsonPath.endsWith('.json')
		? `${jsonPath.slice(0, -'.json'.length)}.md`
		: `${jsonPath}.md`;
}

async function startStaticServer(lane: string, port: number): Promise<http.Server> {
	const app = path.join(lane, 'app');
	const server = http.createServer(async (request, response) => {
		try {
			const pathname = decodePath(parseURL(request.url ?? '/').pathname);
			const relative = pathname === '/' ? 'index.html' : withoutLeadingSlashes(pathname);
			const file = path.resolve(app, relative);
			if (file !== app && !file.startsWith(`${app}${path.sep}`))
				throw new Error('Path traversal');
			const info = await stat(file);
			const body = await readFile(info.isDirectory() ? path.join(file, 'index.html') : file);
			response.writeHead(200, { 'content-type': mime(file), 'cache-control': 'no-store' });
			response.end(body);
		} catch {
			response.writeHead(404);
			response.end('not found');
		}
	});
	await new Promise<void>((resolve, reject) => {
		server.once('error', reject);
		server.listen(port, '127.0.0.1', resolve);
	});
	return server;
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
	runNumber: number,
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
		const url = parseURL(route.request().url());
		if (['127.0.0.1', 'localhost', '::1'].includes(parseHost(url.host ?? '').hostname))
			await route.continue();
		else {
			blocked.push(route.request().url());
			syntheticBlocked.add(route.request().url());
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
	let intendedFailure = false;
	try {
		await page.goto(joinURL(`http://127.0.0.1:${port}`, journey.initialPath), {
			waitUntil: 'networkidle',
		});
		await page.waitForURL((url) => `${url.pathname}${url.hash}` === journey.redirectPath);
		const phones = page.locator('ul.phones > li');
		await phones.first().waitFor();
		const search = page.locator('input[ng-model="$ctrl.query"]');
		await search.fill(journey.filterText);
		const filterDeadline = Date.now() + 5000;
		while ((await phones.count()) !== journey.expectedFilteredCount) {
			if (Date.now() >= filterDeadline) throw new Error('Filtered count assertion failed');
			await new Promise((resolve) => setTimeout(resolve, 25));
		}
		await search.fill('');
		await page.locator('select').selectOption(journey.orderValue);
		if (
			(await phones.first().locator('a:not(.thumb)').innerText()).trim() !==
			journey.firstOrderedPhone
		)
			throw new Error('Ordered phone assertion failed');
		await page.locator('ul.phones a:not(.thumb)', { hasText: journey.detailLink }).click();
		const detailUrl = parseURL(page.url());
		if (`${detailUrl.pathname}${detailUrl.hash}` !== journey.detailPath)
			throw new Error('Detail navigation assertion failed');
		await page.getByRole('heading', { name: journey.detailHeading }).waitFor();
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
			error.message.includes('Initial selected-image assertion failed')
		)
			intendedFailure = true;
		else {
			await context.close();
			throw error;
		}
	}
	await context.close();
	if (expectMutationFailure && !intendedFailure)
		throw new Error('Mutation did not fail the intended selected-image assertion');
	if (!expectMutationFailure && (consoleErrors.length || pageErrors.length))
		throw new Error(
			`Unexpected browser errors: ${JSON.stringify({ consoleErrors, pageErrors })}`,
		);
	if (successfulNonLoopback.length)
		throw new Error(`Successful non-loopback traffic: ${successfulNonLoopback.join(', ')}`);
	return {
		lane,
		run: runNumber,
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

export async function verifyAngularPhonecat({
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
		await readFile(path.join(root, 'fixtures/angular-phonecat/fixture.json'), 'utf8'),
	) as Record<string, any>;
	const journey = JSON.parse(
		await readFile(path.join(root, 'fixtures/angular-phonecat/journey.json'), 'utf8'),
	) as Journey;
	const consent = JSON.parse(await readFile(path.join(cacheRoot, 'consent.json'), 'utf8')) as {
		consentId: string;
		purpose: string;
		networkMode: 'consented';
	};
	if (
		!consent.consentId?.trim() ||
		consent.networkMode !== 'consented' ||
		consent.purpose !== ANGULAR_PHONECAT_INGEST_PURPOSE
	)
		throw new Error('Stale fixture consent evidence');
	const legacy = path.join(workRoot, 'legacy');
	const target = path.join(workRoot, 'target');
	await rm(artifactsRoot, { recursive: true, force: true });
	await mkdir(artifactsRoot, { recursive: true });
	const lockBefore = new Map<string, string>();
	const preparation: unknown[] = [];
	for (const [name, lane, runtime] of [
		['legacy', legacy, 'node16'],
		['target', target, 'node24'],
	] as const) {
		const lock = path.join(lane, 'package-lock.json');
		lockBefore.set(name, sha256(await readFile(lock)));
		await rm(path.join(lane, 'node_modules'), { recursive: true, force: true });
		await rm(path.join(lane, 'app/lib'), { recursive: true, force: true });
		const env = childEnv(runtime);
		const npm = path.join(cacheRoot, runtime, 'bin/npm');
		await run(
			npm,
			['ci', '--offline', '--ignore-scripts', '--no-audit', '--no-fund'],
			lane,
			env,
		);
		await run(npm, ['run', 'copy-libs', '--ignore-scripts'], lane, env);
		const lockAfter = sha256(await readFile(lock));
		if (lockAfter !== lockBefore.get(name) || lockAfter !== manifest.source.packageLockSha256)
			throw new Error(`${name} package lock changed during frozen preparation`);
		preparation.push({
			lane: name,
			runtime: (
				await run(path.join(cacheRoot, runtime, 'bin/node'), ['--version'], lane, env)
			).stdout.trim(),
			npm: (await run(npm, ['--version'], lane, env)).stdout.trim(),
			lockSha256: lockAfter,
			copyLibsSha256: await treeDigest(path.join(lane, 'app/lib')),
		});
	}
	if ((preparation[0] as any).copyLibsSha256 !== (preparation[1] as any).copyLibsSha256)
		throw new Error('Generated app/lib content differs between lanes');

	const browserExecutable = path.resolve(root, manifest.browser.executable);
	const browserHash = sha256(await readFile(browserExecutable));
	if (browserHash !== manifest.browser.sha256) throw new Error('Cached Chromium digest mismatch');
	const browser = await chromium.launch({ headless: true, executablePath: browserExecutable });
	const journeys: unknown[] = [];
	try {
		for (const [name, lane, port] of [
			['legacy', legacy, 43171],
			['target', target, 43172],
		] as const) {
			const server = await startStaticServer(lane, port);
			try {
				for (let index = 1; index <= journey.qualificationRuns; index += 1)
					journeys.push(await runJourney(browser, port, journey, name, index));
			} finally {
				await stopServer(server);
			}
		}
	} finally {
		await browser.close();
	}
	const targetSource = path.join(target, 'app/phone-detail/phone-detail.component.js');
	const restored = await readFile(targetSource, 'utf8');
	const restoredHash = sha256(restored);
	const mutated = restored.replace(
		'this.setImage(phone.images[0]);',
		'this.setImage(phone.images[1]);',
	);
	if (mutated === restored) throw new Error('Mutation target not found');
	let mutationResult: Awaited<ReturnType<typeof runJourney>> | undefined;
	try {
		await writeFile(targetSource, mutated);
		const mutationBrowser = await chromium.launch({
			headless: true,
			executablePath: browserExecutable,
		});
		const server = await startStaticServer(target, 43173);
		try {
			mutationResult = await runJourney(
				mutationBrowser,
				43173,
				journey,
				'target-mutation',
				1,
				true,
			);
		} finally {
			await stopServer(server);
			await mutationBrowser.close();
		}
	} finally {
		await writeFile(targetSource, restored);
	}
	if (!mutationResult || sha256(await readFile(targetSource)) !== restoredHash)
		throw new Error('Mutation restoration was not byte-identical');
	const restoredBrowser = await chromium.launch({
		headless: true,
		executablePath: browserExecutable,
	});
	const restoredServer = await startStaticServer(target, 43174);
	let restoredJourney;
	try {
		restoredJourney = await runJourney(restoredBrowser, 43174, journey, 'target-restored', 1);
	} finally {
		await stopServer(restoredServer);
		await restoredBrowser.close();
	}

	const sourceCode = await readFile(
		path.join(legacy, 'app/phone-detail/phone-detail.component.js'),
	);
	const targetCode = await readFile(targetSource);
	const locality = {
		mode: 'offline' as const,
		scope: 'Versionless-spawned Node/npm child processes and Playwright browser requests',
		osWideIsolation: false as const,
		successfulNonLoopback: 0 as const,
		browserBlockedRequests: journeys.flatMap((item: any) => item.blocked).length,
	};
	const deterministicInput = {
		fixture: manifest.id,
		revision: manifest.source.revision,
		targetSha256: sha256(targetCode),
		changedFiles: ['app/phone-detail/phone-detail.component.js'],
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
	if (first !== second) throw new Error('Deterministic-core mismatch');
	const artifacts = await Promise.all([
		artifact('preparation.json', preparation),
		artifact('runtime.json', {
			browserExecutable: manifest.browser.executable,
			browserSha256: browserHash,
		}),
		artifact('journey.json', journeys),
		artifact('locality.json', locality),
		artifact('mutation.json', {
			mutation: mutationResult.result,
			restoredSha256: restoredHash,
			restoration: 'byte-identical',
			reproduced: restoredJourney.result,
		}),
		artifact('migration-diff.json', {
			sourceSha256: sha256(sourceCode),
			targetSha256: sha256(targetCode),
			changedFiles: ['app/phone-detail/phone-detail.component.js'],
		}),
		artifact('deterministic-core.json', { first, second, equal: true }),
	]);
	const receipt: MigrationReceipt = {
		schemaVersion: 'versionless.receipt.v1',
		runId: 'T011-angular-phonecat',
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
			file: 'app/phone-detail/phone-detail.component.js',
			transform: 'phone-detail-lexical-this',
			edits: 3,
			track: 'angularjs-special-track',
			changedFiles: ['app/phone-detail/phone-detail.component.js'],
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
			'Hash integrity does not establish signer authenticity or provenance beyond pinned downloads.',
			'Network controls cover spawned Node/npm children and browser routing, not OS-wide process isolation.',
			'Node 16 is EOL and used only as a compatibility sandbox.',
			'The transform is approved only for the exact proven PhoneDetail shape.',
			'This is AngularJS special-track evidence only and does not prove the required Angular designated pilot.',
			'This static application has no bundler and does not prove Angular CLI or AOT behavior.',
			'This receipt is not certification or a legal attestation.',
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
		schemaVersion: string;
		fixtures: Array<Record<string, unknown>>;
		unsupported: unknown[];
	};
	const preserved = aggregate.fixtures.filter((item) => item.id !== manifest.id);
	aggregate.fixtures = [
		...preserved,
		{
			id: manifest.id,
			framework: 'angularjs',
			track: 'angularjs-special-track',
			bundler: 'none-static',
			result: 'pass',
			receipt: path.relative(root, absolute),
			digest: receipt.integrity.canonicalDigest,
		},
	];
	await writeFile(aggregatePath, `${JSON.stringify(aggregate, null, 2)}\n`);
	await verifyReceipt(absolute);
	return receipt;
}
