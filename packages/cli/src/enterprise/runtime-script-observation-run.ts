import { createServer, type Server } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { charIn, createRegExp, oneOrMore } from 'magic-regexp';
import * as path from 'pathe';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { decodePath, joinURL, normalizeURL, parseHost, parseURL } from 'ufo';
import {
	bindRuntimeObservationConfig,
	normalizeObservedUrl,
	parseRuntimeObservationConfig,
	renderRuntimeObservation,
	RUNTIME_SCRIPT_OBSERVATION_SCHEMA,
	verifyRuntimeObservationInputs,
	verifyRuntimeScriptObservationEvidence,
	type JourneyProfile,
	type ObservedScript,
	type RuntimeObservationRun,
	type RuntimeScriptObservation,
} from '../../../core/src/enterprise/runtime-script-observation.ts';
import { verifyScriptSurface } from '../../../core/src/enterprise/script-surface.ts';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';

const root = path.resolve(import.meta.dirname, '../../../..');
const requestPathPattern = createRegExp(
	oneOrMore(charIn('/-_.').from('0', '9').from('A', 'Z').from('a', 'z')).at.lineStart(),
);

interface RunOptions {
	configPath: string;
	outputDir: string;
	offline: boolean;
	rootDir?: string;
	environment?: NodeJS.ProcessEnv;
}

type Journey = Record<string, unknown>;

function string(value: unknown, label: string): string {
	if (typeof value !== 'string' || !value) throw new Error(`${label} is missing`);
	return value;
}

function number(value: unknown, label: string): number {
	if (typeof value !== 'number') throw new Error(`${label} is missing`);
	return value;
}

function unique(values: string[]): string[] {
	return [...new Set(values)].sort();
}

function isLoopback(value: string): boolean {
	const parsed = parseURL(value);
	return ['127.0.0.1', 'localhost', '::1'].includes(parseHost(parsed.host ?? '').hostname);
}

function contentType(file: string): string {
	const extension = path.extname(file);
	if (extension === '.html') return 'text/html; charset=utf-8';
	if (extension === '.js') return 'text/javascript; charset=utf-8';
	if (extension === '.css') return 'text/css; charset=utf-8';
	if (extension === '.json') return 'application/json; charset=utf-8';
	if (extension === '.svg') return 'image/svg+xml';
	if (extension === '.png') return 'image/png';
	if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
	return 'application/octet-stream';
}

async function startServer(deploymentRoot: string): Promise<{ server: Server; port: number }> {
	const server = createServer(async (request, response) => {
		try {
			const pathname = decodePath(parseURL(request.url ?? '/').pathname || '/');
			if (!requestPathPattern.test(pathname)) throw new Error('Malformed request path');
			const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
			let file = path.resolve(deploymentRoot, relative);
			if (!file.startsWith(`${deploymentRoot}${path.sep}`) && file !== deploymentRoot)
				throw new Error('Request escaped deployment root');
			try {
				if (!(await stat(file)).isFile()) file = path.join(deploymentRoot, 'index.html');
			} catch {
				file = path.join(deploymentRoot, 'index.html');
			}
			response.writeHead(200, { 'content-type': contentType(file) });
			response.end(await readFile(file));
		} catch (error) {
			response.writeHead(500, { 'content-type': 'text/plain' });
			response.end(String(error));
		}
	});
	await new Promise<void>((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => resolve());
	});
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('Loopback server port missing');
	return { server, port: address.port };
}

async function closeServer(server: Server): Promise<void> {
	await new Promise<void>((resolve, reject) =>
		server.close((error) => (error ? reject(error) : resolve())),
	);
}

async function installDetector(context: BrowserContext): Promise<void> {
	await context.addInitScript(() => {
		const state = { created: [] as string[], removed: [] as string[] };
		(
			globalThis as typeof globalThis & {
				__versionlessScriptDetector?: typeof state;
			}
		).__versionlessScriptDetector = state;
		const source = (node: Node): string | null => {
			if (!(node instanceof HTMLScriptElement)) return null;
			return node.src || '<inline>';
		};
		new MutationObserver((records) => {
			for (const record of records) {
				for (const node of record.addedNodes) {
					const direct = source(node);
					if (direct) state.created.push(direct);
					if (node instanceof Element)
						for (const script of node.querySelectorAll('script'))
							state.created.push(script.src || '<inline>');
				}
				for (const node of record.removedNodes) {
					const direct = source(node);
					if (direct) state.removed.push(direct);
					if (node instanceof Element)
						for (const script of node.querySelectorAll('script'))
							state.removed.push(script.src || '<inline>');
				}
			}
		}).observe(document, { childList: true, subtree: true });
	});
}

async function reactLocaleJourney(page: Page, journey: Journey): Promise<Record<string, unknown>> {
	await page
		.getByRole('heading', { name: string(journey.initialHeading, 'initial heading') })
		.waitFor();
	await page.getByRole('link', { name: string(journey.navigationName, 'navigation') }).click();
	if (parseURL(page.url()).pathname !== string(journey.navigationPath, 'navigation path'))
		throw new Error('React navigation assertion failed');
	await page.getByRole('link', { name: string(journey.returnName, 'return link') }).click();
	const control = page.locator(string(journey.localeControl, 'locale control'));
	await control.selectOption(string(journey.targetLocale, 'target locale'));
	await page
		.getByRole('heading', { name: string(journey.translatedHeading, 'translated heading') })
		.waitFor();
	return {
		navigationPath: string(journey.navigationPath, 'navigation path').slice(1),
		selectedLocale: journey.targetLocale,
		translatedHeading: journey.translatedHeading,
	};
}

async function dataFlowJourney(page: Page, journey: Journey): Promise<Record<string, unknown>> {
	const projection = await reactLocaleJourney(page, journey);
	const input = page.locator('#username');
	await input.fill(string(journey.username, 'username'));
	await input.press('Enter');
	await page.getByRole('link', { name: 'owned-repo', exact: true }).waitFor();
	await page.getByRole('link', { name: 'fork-owner/forked-repo', exact: true }).waitFor();
	await page.getByText('3', { exact: true }).waitFor();
	await page.getByText('7', { exact: true }).waitFor();
	return { ...projection, username: journey.username, repositories: 2 };
}

async function phonecatJourney(page: Page, journey: Journey): Promise<Record<string, unknown>> {
	await page.waitForURL(
		(url) => `${url.pathname}${url.hash}` === string(journey.redirectPath, 'redirect path'),
	);
	const phones = page.locator('ul.phones > li');
	await phones.first().waitFor();
	const search = page.locator('input[ng-model="$ctrl.query"]');
	await search.fill(string(journey.filterText, 'filter text'));
	const deadline = Date.now() + 5_000;
	while ((await phones.count()) !== number(journey.expectedFilteredCount, 'filtered count')) {
		if (Date.now() >= deadline) throw new Error('PhoneCat filtered count assertion failed');
		await new Promise((resolve) => setTimeout(resolve, 25));
	}
	await search.fill('');
	await page.locator('select').selectOption(string(journey.orderValue, 'order value'));
	if (
		(await phones.first().locator('a:not(.thumb)').innerText()).trim() !==
		string(journey.firstOrderedPhone, 'first ordered phone')
	)
		throw new Error('PhoneCat ordering assertion failed');
	await page
		.locator('ul.phones a:not(.thumb)', { hasText: string(journey.detailLink, 'detail link') })
		.click();
	await page
		.getByRole('heading', { name: string(journey.detailHeading, 'detail heading') })
		.waitFor();
	const image = page.locator('img.phone.selected');
	if (!(await image.getAttribute('src'))?.endsWith(string(journey.initialImageSuffix, 'image')))
		throw new Error('PhoneCat initial-image assertion failed');
	for (const suffix of journey.thumbnailSwapSuffixes as string[]) {
		await page.locator(`ul.phone-thumbs img[src$="${suffix}"]`).click();
		if (!(await image.getAttribute('src'))?.endsWith(suffix))
			throw new Error('PhoneCat image-swap assertion failed');
	}
	return {
		redirectPath: string(journey.redirectPath, 'redirect path').slice(1),
		detailPath: string(journey.detailPath, 'detail path').slice(1),
		images: 3,
	};
}

async function hashScripts(
	requests: string[],
	localOrigin: string,
	deploymentRoot: string,
): Promise<ObservedScript[]> {
	const output: ObservedScript[] = [];
	for (const source of unique(requests)) {
		if (!isLoopback(source)) {
			output.push({
				source: normalizeURL(source),
				kind: 'external',
				resolvedPath: null,
				sha256: null,
			});
			continue;
		}
		const pathname = decodePath(parseURL(source).pathname || '/').slice(1);
		const file = path.resolve(deploymentRoot, pathname);
		if (!file.startsWith(`${deploymentRoot}${path.sep}`))
			throw new Error('Observed script escaped deployment root');
		const body = await readFile(file);
		output.push({
			source: normalizeObservedUrl(source, localOrigin),
			kind: 'local',
			resolvedPath: pathname,
			sha256: sha256(body),
		});
	}
	return output.sort((left, right) => left.source.localeCompare(right.source));
}

async function qualificationRun(options: {
	browser: Browser;
	profile: JourneyProfile;
	journey: Journey;
	payload: unknown;
	deploymentRoot: string;
	port: number;
	run: number;
}): Promise<RuntimeObservationRun> {
	const context = await options.browser.newContext({
		locale: string(options.journey.locale, 'journey locale'),
		timezoneId: string(options.journey.timezoneId, 'journey timezone'),
		viewport: options.journey.viewport as { width: number; height: number },
	});
	await installDetector(context);
	const blocked: string[] = [];
	const blockedSet = new Set<string>();
	const synthetic: string[] = [];
	const syntheticSet = new Set<string>();
	const successfulNonLoopback: string[] = [];
	const consoleErrors: string[] = [];
	const pageErrors: string[] = [];
	const scriptRequests: string[] = [];
	await context.route('**/*', async (route) => {
		const request = route.request();
		if (options.profile === 'react-data-flow' && request.url() === options.journey.requestUrl) {
			synthetic.push(request.url());
			syntheticSet.add(request.url());
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(options.payload),
			});
			return;
		}
		if (isLoopback(request.url())) await route.continue();
		else {
			blocked.push(request.url());
			blockedSet.add(request.url());
			await route.fulfill({ status: 204, body: '' });
		}
	});
	const page = await context.newPage();
	page.on('request', (request) => {
		if (request.resourceType() === 'script') scriptRequests.push(request.url());
	});
	page.on('response', (response) => {
		if (
			!isLoopback(response.url()) &&
			!syntheticSet.has(response.url()) &&
			!blockedSet.has(response.url()) &&
			response.ok()
		)
			successfulNonLoopback.push(response.url());
	});
	page.on('console', (message) => {
		if (message.type() === 'error') consoleErrors.push(message.text());
	});
	page.on('pageerror', (error) => pageErrors.push(error.message));
	const origin = `http://127.0.0.1:${options.port}`;
	await page.goto(joinURL(origin, string(options.journey.initialPath, 'initial path')), {
		waitUntil: 'networkidle',
	});
	const journeyProjection =
		options.profile === 'angular-phonecat'
			? await phonecatJourney(page, options.journey)
			: options.profile === 'react-data-flow'
				? await dataFlowJourney(page, options.journey)
				: await reactLocaleJourney(page, options.journey);
	const detector = await page.evaluate(() => {
		const state = (
			globalThis as typeof globalThis & {
				__versionlessScriptDetector?: { created: string[]; removed: string[] };
			}
		).__versionlessScriptDetector;
		return {
			created: state?.created ?? [],
			removed: state?.removed ?? [],
			final: [...document.scripts].map((script) => script.src || '<inline>'),
		};
	});
	await context.close();
	if (consoleErrors.length || pageErrors.length || successfulNonLoopback.length)
		throw new Error(
			`Qualified runtime observation contains browser errors or live egress: ${JSON.stringify({ consoleErrors, pageErrors, successfulNonLoopback })}`,
		);
	const normalized = (values: string[]) =>
		unique(
			values.map((value) =>
				value === '<inline>' ? value : normalizeObservedUrl(value, origin),
			),
		);
	return {
		run: options.run,
		result: 'pass',
		createdScripts: normalized(detector.created),
		removedScripts: normalized(detector.removed),
		scriptRequests: normalized(scriptRequests),
		finalScriptElements: normalized(detector.final),
		scripts: await hashScripts(scriptRequests, origin, options.deploymentRoot),
		blockedExternalResources: unique(blocked.map((value) => normalizeURL(value))),
		syntheticInterceptions: unique(synthetic.map((value) => normalizeURL(value))),
		consoleErrors,
		pageErrors,
		successfulNonLoopback,
		journeyProjection,
	};
}

async function detectorMutation(options: {
	browser: Browser;
	deploymentRoot: string;
	entrypointSha256: string;
	port: number;
}): Promise<RuntimeScriptObservation['detectorMutation']> {
	const entrypoint = path.join(options.deploymentRoot, 'index.html');
	if (sha256(await readFile(entrypoint)) !== options.entrypointSha256)
		throw new Error('Detector mutation entrypoint binding changed');
	const context = await options.browser.newContext();
	await installDetector(context);
	let refused = false;
	await context.route('**/*', async (route) => {
		if (route.request().url() === 'https://synthetic.invalid/runtime-detector.js') {
			refused = true;
			await route.abort('blockedbyclient');
		} else if (isLoopback(route.request().url())) await route.continue();
		else await route.fulfill({ status: 204, body: '' });
	});
	const page = await context.newPage();
	await page.goto(`http://127.0.0.1:${options.port}/`, { waitUntil: 'networkidle' });
	await page.evaluate(() => {
		const script = document.createElement('script');
		script.src = 'https://synthetic.invalid/runtime-detector.js';
		document.body.append(script);
	});
	await page.waitForTimeout(50);
	const observed = await page.evaluate(() =>
		Boolean(
			(
				globalThis as typeof globalThis & {
					__versionlessScriptDetector?: { created: string[] };
				}
			).__versionlessScriptDetector?.created.includes(
				'https://synthetic.invalid/runtime-detector.js',
			),
		),
	);
	await context.close();
	if (!refused || !observed || sha256(await readFile(entrypoint)) !== options.entrypointSha256)
		throw new Error('Runtime script detector mutation was not isolated and refused');
	return {
		source: 'https://synthetic.invalid/runtime-detector.js',
		observed: true,
		result: 'intended-refusal',
		restoration: 'no-worktree-write',
	};
}

export async function verifyRuntimeScriptObservation(
	options: RunOptions,
): Promise<RuntimeScriptObservation> {
	const environment = options.environment ?? process.env;
	if (!options.offline || environment.VERSIONLESS_NETWORK_MODE !== 'offline')
		throw new Error('Runtime script observation requires explicit offline mode');
	const checkout = path.resolve(options.rootDir ?? root);
	const config = parseRuntimeObservationConfig(
		JSON.parse(await readFile(path.resolve(checkout, options.configPath), 'utf8')),
	);
	const surface = await verifyScriptSurface({ rootDir: checkout, environment });
	bindRuntimeObservationConfig(config, surface);
	await verifyRuntimeObservationInputs(config, checkout);
	const browserFile = path.join(checkout, config.browser.executable);
	if (sha256(await readFile(browserFile)) !== config.browser.sha256)
		throw new Error('Pinned Chromium digest changed');
	const profileData = new Map<JourneyProfile, { journey: Journey; payload: unknown }>();
	for (const [profile, binding] of Object.entries(config.profiles) as Array<
		[
			JourneyProfile,
			{
				journey: string;
				journeySha256: string;
				payload?: string;
				payloadSha256?: string;
			},
		]
	>)
		profileData.set(profile, {
			journey: JSON.parse(await readFile(path.join(checkout, binding.journey), 'utf8')),
			payload: binding.payload
				? JSON.parse(await readFile(path.join(checkout, binding.payload), 'utf8'))
				: null,
		});
	const browser = await chromium.launch({ headless: true, executablePath: browserFile });
	const verticals: RuntimeScriptObservation['verticals'] = [];
	let mutation: RuntimeScriptObservation['detectorMutation'] | null = null;
	try {
		for (const configured of config.verticals) {
			const source = surface.verticals.find((item) => item.id === configured.id);
			const data = profileData.get(configured.profile);
			if (!source || !data)
				throw new Error(`Runtime observation binding missing: ${configured.id}`);
			const lanes: RuntimeScriptObservation['verticals'][number]['lanes'] = [];
			for (const lane of source.lanes) {
				const deploymentRoot = path.dirname(path.join(checkout, lane.entrypoint.path));
				const { server, port } = await startServer(deploymentRoot);
				try {
					const runs = [1, 2].map(async (run) =>
						qualificationRun({
							browser,
							profile: configured.profile,
							journey: data.journey,
							payload: data.payload,
							deploymentRoot,
							port,
							run,
						}),
					);
					const observed = await Promise.all(runs);
					const normalized = observed.map((run) => ({ ...run, run: 0 }));
					if (canonicalize(normalized[0]) !== canonicalize(normalized[1]))
						throw new Error(
							`Runtime observation is nondeterministic: ${source.id}/${lane.lane}`,
						);
					lanes.push({
						lane: lane.lane,
						entrypoint: lane.entrypoint,
						receipt: lane.receipt,
						deterministic: true,
						runs: observed,
					});
					if (!mutation) {
						mutation = await detectorMutation({
							browser,
							deploymentRoot,
							entrypointSha256: lane.entrypoint.sha256,
							port,
						});
					}
				} finally {
					await closeServer(server);
				}
			}
			const legacyExternal = new Set(
				lanes[0]?.runs.flatMap((run) =>
					run.scripts
						.filter((item) => item.kind === 'external')
						.map((item) => item.source),
				),
			);
			if (
				lanes[1]?.runs.some((run) =>
					run.scripts.some(
						(item) => item.kind === 'external' && !legacyExternal.has(item.source),
					),
				)
			)
				throw new Error(`Target introduced an external runtime script: ${source.id}`);
			verticals.push({
				id: source.id,
				sourceApplication: source.sourceApplication,
				profile: configured.profile,
				lanes,
			});
		}
	} finally {
		await browser.close();
	}
	if (!mutation) throw new Error('Runtime detector mutation was not executed');
	const result: RuntimeScriptObservation = {
		schemaVersion: RUNTIME_SCRIPT_OBSERVATION_SCHEMA,
		summary: {
			verticals: 9,
			sourceApplications: 2,
			lanes: 18,
			runs: 36,
			externalScriptsIntroduced: 0,
		},
		boundaries: {
			scope: 'exact-qualified-journeys',
			globalDynamicInsertionCoverage: 'not-established',
			paymentPageApplicability: 'not-established',
			pciCompliance: 'not-claimed',
			certification: 'not-claimed',
			authenticity: 'not-established',
			locality: 'process-scoped-not-os-wide',
		},
		inputs: { browser: config.browser, profiles: config.profiles },
		verticals,
		detectorMutation: mutation,
	};
	await verifyRuntimeScriptObservationEvidence(result, {
		rootDir: checkout,
		config,
		surface,
	});
	const output = path.resolve(checkout, options.outputDir);
	await mkdir(output, { recursive: true });
	await writeFile(
		path.join(output, 'runtime-script-observation.json'),
		`${JSON.stringify(result, null, 2)}\n`,
	);
	await writeFile(path.join(output, 'report.md'), renderRuntimeObservation(result));
	return result;
}
