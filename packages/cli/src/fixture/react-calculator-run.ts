import { spawn } from 'node:child_process';
import { access, cp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import {
	box,
	runBoxes,
	type BrowserConsoleMessage,
	type BrowserNetworkConditions,
	type BrowserNetworkRequest,
	type BrowserPageError,
	type BrowserRequestFailure,
	type WitnessBrowser,
	type WitnessBrowserPage,
} from '@async/witness';
import { chromium, type Page, type Request } from 'playwright';
import { basename, join, relative, resolve } from 'pathe';
import { parseHost, parseURL } from 'ufo';
import {
	REACT_CALCULATOR_SCHEMA,
	analyzeCorpusConformance,
	canonicalize,
	parseReactCalculatorReceipt,
	reactCalculatorAggregateMember,
	sha256,
	verifyReactCalculatorEvidence,
} from '../../../core/src/index.ts';
import {
	planReactCalculatorTargetPackage,
	transformReactCalculatorBootstrap,
} from '../../../frameworks/react/src/index.ts';
import { generateTrustPackage, verifyTrustPackage } from '../../../trust/src/index.ts';
import { witnessNodeFileSystem } from '../witness/node-filesystem.ts';
import { startStaticServer } from '../witness/real-app-run.ts';
import { verifyLinkedWitnessProvenance } from '../witness/provenance.ts';

const root = resolve(import.meta.dirname, '../../../..');
const cacheRoot = join(root, '.versionless/cache/react-calculator/t574');
const workRoot = join(root, '.versionless/work/react-calculator/t574');
const outputRoot = join(root, 'evidence/runs/react-calculator-react16-to-vite8');
const outputStage = `${outputRoot}.stage`;
const aggregatePath = join(root, 'evidence/runs/aggregate.json');
const trustCurrent = join(root, 'evidence/trust/current');
const trustReplay = join(root, '.versionless/cache/trust/replay/react-calculator');
const publicationStage = join(root, '.versionless/stage/react-calculator/t574/publication');
const node16 = join(root, '.versionless/cache/react-boilerplate-v4/node16/bin/node');
const vite = join(root, 'node_modules/vite/bin/vite.js');
const viteConfig = join(root, 'packages/cli/src/fixture/react-calculator-vite.config.ts');
const chromiumExecutable = join(
	root,
	'.versionless/cache/react-boilerplate-v4/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell',
);
const calculatorOperateGitSha = '0274e3a744e7eacc06bdf21acc5b73a2df4eedf4' as const;

type ClosureArtifact = {
	name: string;
	version: string;
	placements: string[];
	mirror: string;
	sha256: string;
	integrity: string;
	lifecycleScripts: string[];
	native: boolean;
};
type TargetArtifact = Omit<ClosureArtifact, 'placements'>;
type IngestReceipt = {
	source: {
		revision: string;
		tree: string;
		archiveSha256: string;
		manifestDigest: string;
		manifest: Array<{ path: string; sha256: string; gitSha: string; bytes: number }>;
	};
	closure: { digest: string; artifacts: ClosureArtifact[] };
	targetClosure: { digest: string; artifacts: TargetArtifact[] };
	license: {
		expression: string;
		assets: Array<{ path: string; sha256: string; license: string }>;
	};
	integrity: { canonicalDigest: string };
};
type BrowserEvidence = {
	serviceWorker: { registrations: number; controller: string | null; cacheNames: string[] };
	attemptedNonLoopback: string[];
	successfulNonLoopback: number;
	pageErrors: string[];
	consoleErrors: string[];
};

const compareText = (left: string, right: string): number =>
	left < right ? -1 : left > right ? 1 : 0;
const exists = (path: string): Promise<boolean> =>
	access(path).then(
		() => true,
		() => false,
	);

export async function runReactCalculatorAtomicPublication<Snapshot>(steps: {
	snapshot: () => Promise<Snapshot>;
	publish: () => Promise<void>;
	verify: () => Promise<void>;
	commit: () => Promise<void>;
	restore: (snapshot: Snapshot) => Promise<void>;
}): Promise<void> {
	const snapshot = await steps.snapshot();
	try {
		await steps.publish();
		await steps.verify();
		await steps.commit();
	} catch (error) {
		await steps.restore(snapshot);
		throw error;
	}
}

async function execute(
	command: string,
	args: readonly string[],
	cwd = root,
	env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
	return await new Promise((resolvePromise, reject) => {
		const child = spawn(command, [...args], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
		child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
		child.once('error', reject);
		child.once('exit', (code) =>
			code === 0
				? resolvePromise(Buffer.concat(stdout).toString('utf8'))
				: reject(
						new Error(
							`${basename(command)} exited ${code ?? -1}: ${Buffer.concat(stderr).toString('utf8')}`,
						),
					),
		);
	});
}

async function filesBelow(directory: string): Promise<string[]> {
	const result: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const absolute = join(directory, entry.name);
		if (entry.isDirectory()) result.push(...(await filesBelow(absolute)));
		else if (entry.isFile()) result.push(absolute);
		else if (!entry.isSymbolicLink())
			throw new Error('React Calculator output contains a special filesystem entry');
	}
	return result.sort(compareText);
}

async function treeDigest(directory: string): Promise<string> {
	return sha256(
		canonicalize(
			await Promise.all(
				(await filesBelow(directory)).map(async (file) => ({
					path: relative(directory, file),
					sha256: sha256(await readFile(file)),
				})),
			),
		),
	);
}

export function calculatorPlacementPath(lane: string, placement: string): string {
	const segments = placement.split('>');
	if (
		segments.length === 0 ||
		segments.some(
			(segment) =>
				!segment ||
				segment === '.' ||
				segment === '..' ||
				segment.startsWith('/') ||
				segment.includes('\\'),
		)
	)
		throw new Error('React Calculator lock placement is unsafe');
	let destination = lane;
	for (const segment of segments) destination = join(destination, 'node_modules', segment);
	if (relative(lane, destination).startsWith('..'))
		throw new Error('React Calculator lock placement escapes');
	return destination;
}

async function extractPackage(tarball: string, destination: string): Promise<void> {
	await mkdir(destination, { recursive: true });
	await execute('/usr/bin/tar', ['-xzf', tarball, '-C', destination, '--strip-components', '1']);
}

async function installClosure(lane: string, ingest: IngestReceipt, target: boolean): Promise<void> {
	for (const artifact of ingest.closure.artifacts) {
		const tarball = join(cacheRoot, 'mirror', artifact.mirror);
		if (sha256(await readFile(tarball)) !== artifact.sha256)
			throw new Error('React Calculator offline legacy closure differs');
		for (const placement of artifact.placements)
			await extractPackage(tarball, calculatorPlacementPath(lane, placement));
	}
	if (target)
		for (const artifact of ingest.targetClosure.artifacts) {
			const tarball = join(cacheRoot, 'mirror', artifact.mirror);
			if (sha256(await readFile(tarball)) !== artifact.sha256)
				throw new Error('React Calculator offline target closure differs');
			await rm(calculatorPlacementPath(lane, artifact.name), {
				recursive: true,
				force: true,
			});
			await extractPackage(tarball, calculatorPlacementPath(lane, artifact.name));
		}
}

function manifestRow(ingest: IngestReceipt, path: string) {
	const rows = ingest.source.manifest.filter((row) => row.path === path);
	if (rows.length !== 1)
		throw new Error(`React Calculator source manifest path differs: ${path}`);
	return rows[0]!;
}

async function prepareLane(name: string, ingest: IngestReceipt, target: boolean): Promise<string> {
	const lane = join(workRoot, name);
	await cp(join(cacheRoot, 'source'), lane, { recursive: true, force: false });
	await installClosure(lane, ingest, target);
	if (target) {
		const indexPath = join(lane, 'src/index.js');
		const packagePath = join(lane, 'package.json');
		const transformed = transformReactCalculatorBootstrap({
			sourceBytes: await readFile(indexPath),
			expectedGitSha: manifestRow(ingest, 'src/index.js').gitSha,
		});
		const packagePlan = planReactCalculatorTargetPackage({
			packageBytes: await readFile(packagePath),
			expectedGitSha: manifestRow(ingest, 'package.json').gitSha,
		});
		await writeFile(indexPath, transformed.code);
		await writeFile(packagePath, packagePlan.packageJson);
		const publicHtml = await readFile(join(lane, 'public/index.html'), 'utf8');
		await writeFile(join(lane, 'index.html'), publicHtml.split('%PUBLIC_URL%').join(''));
	}
	return lane;
}

async function buildLane(lane: string, target: boolean): Promise<string> {
	if (target)
		await execute(process.execPath, [vite, 'build', '--config', viteConfig], root, {
			...process.env,
			VERSIONLESS_NETWORK_MODE: 'offline',
			NPM_CONFIG_OFFLINE: 'true',
			VERSIONLESS_CALCULATOR_ROOT: lane,
		});
	else
		await execute(
			node16,
			[join(lane, 'node_modules/react-scripts/bin/react-scripts.js'), 'build'],
			lane,
			{
				...process.env,
				VERSIONLESS_NETWORK_MODE: 'offline',
				NPM_CONFIG_OFFLINE: 'true',
				CI: 'true',
				GENERATE_SOURCEMAP: 'false',
			},
		);
	return await treeDigest(join(lane, 'build'));
}

const buttonSelectors = Object.freeze({
	AC: '.component-button-panel > div:nth-child(1) > div:nth-child(1) button',
	sign: '.component-button-panel > div:nth-child(1) > div:nth-child(2) button',
	percent: '.component-button-panel > div:nth-child(1) > div:nth-child(3) button',
	divide: '.component-button-panel > div:nth-child(1) > div:nth-child(4) button',
	seven: '.component-button-panel > div:nth-child(2) > div:nth-child(1) button',
	eight: '.component-button-panel > div:nth-child(2) > div:nth-child(2) button',
	nine: '.component-button-panel > div:nth-child(2) > div:nth-child(3) button',
	multiply: '.component-button-panel > div:nth-child(2) > div:nth-child(4) button',
	four: '.component-button-panel > div:nth-child(3) > div:nth-child(1) button',
	five: '.component-button-panel > div:nth-child(3) > div:nth-child(2) button',
	six: '.component-button-panel > div:nth-child(3) > div:nth-child(3) button',
	minus: '.component-button-panel > div:nth-child(3) > div:nth-child(4) button',
	one: '.component-button-panel > div:nth-child(4) > div:nth-child(1) button',
	two: '.component-button-panel > div:nth-child(4) > div:nth-child(2) button',
	three: '.component-button-panel > div:nth-child(4) > div:nth-child(3) button',
	plus: '.component-button-panel > div:nth-child(4) > div:nth-child(4) button',
	zero: '.component-button-panel > div:nth-child(5) > div:nth-child(1) button',
	decimal: '.component-button-panel > div:nth-child(5) > div:nth-child(2) button',
	equals: '.component-button-panel > div:nth-child(5) > div:nth-child(3) button',
});

function loopback(url: string): boolean {
	const hostname = parseHost(parseURL(url).host ?? '').hostname;
	return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
}

async function requestRecord(request: Request, startedAt: number): Promise<BrowserNetworkRequest> {
	const response = await request.response();
	return {
		url: request.url(),
		method: request.method(),
		resourceType: request.resourceType(),
		startTimeMs: startedAt,
		responseTimeMs: response === null ? null : Date.now(),
		endTimeMs: Date.now(),
		durationMs: Date.now() - startedAt,
		status: response?.status() ?? null,
		mimeType: response?.headers()['content-type'] ?? null,
		encodedDataLength: null,
		failedReason: request.failure()?.errorText ?? null,
		initiatorType: null,
	};
}

function adaptPage(page: Page, evidence: BrowserEvidence): WitnessBrowserPage {
	const consoles: Array<(message: BrowserConsoleMessage) => void> = [];
	const errors: Array<(error: BrowserPageError) => void> = [];
	const failures: Array<(failure: BrowserRequestFailure) => void> = [];
	const requests: Array<(request: BrowserNetworkRequest) => void> = [];
	const navigations: Array<(url: string) => void> = [];
	const starts = new WeakMap<Request, number>();
	page.on('console', (message) => {
		if (message.type() === 'error') evidence.consoleErrors.push(message.text());
		consoles.forEach((listener) => listener({ level: message.type(), text: message.text() }));
	});
	page.on('pageerror', (error) => {
		evidence.pageErrors.push(error.message);
		errors.forEach((listener) => listener({ message: error.message }));
	});
	page.on('request', (request) => starts.set(request, Date.now()));
	page.on('requestfailed', (request) => {
		failures.forEach((listener) =>
			listener({
				url: request.url(),
				method: request.method(),
				reason: request.failure()?.errorText ?? null,
			}),
		);
		void requestRecord(request, starts.get(request) ?? Date.now()).then((record) =>
			requests.forEach((listener) => listener(record)),
		);
	});
	page.on(
		'requestfinished',
		(request) =>
			void requestRecord(request, starts.get(request) ?? Date.now()).then((record) =>
				requests.forEach((listener) => listener(record)),
			),
	);
	page.on('framenavigated', (frame) => {
		if (frame === page.mainFrame()) navigations.forEach((listener) => listener(frame.url()));
	});
	return {
		goto: async (url) => void (await page.goto(url, { waitUntil: 'domcontentloaded' })),
		reload: async () => void (await page.reload({ waitUntil: 'domcontentloaded' })),
		content: async () => await page.content(),
		screenshot: async (file) => void (await page.screenshot({ path: file })),
		evaluate: (expression) => page.evaluate(expression),
		waitForExpression: async (expression, timeout) =>
			void (await page.waitForFunction(expression, undefined, { timeout })),
		click: async (selector, timeout) => void (await page.locator(selector).click({ timeout })),
		type: async (selector, text, options, timeout) => {
			if (options.clear || !options.keyEvents)
				throw new Error('React Calculator Witness rejects fill-backed typing');
			const locator = page.locator(selector);
			for (const character of text) await locator.press(character, { timeout });
			return { passwordField: (await locator.getAttribute('type')) === 'password' };
		},
		hover: async (selector, _modifiers, timeout) =>
			void (await page.locator(selector).hover({ timeout })),
		press: async (selector, key, _modifiers, timeout) =>
			void (await page.locator(selector).press(key, { timeout })),
		drag: async () => {
			throw new Error('drag is not-tested because Calculator exposes no drag surface');
		},
		scroll: async (_target, deltaX, deltaY) => void (await page.mouse.wheel(deltaX, deltaY)),
		onConsoleMessage: (listener) => void consoles.push(listener),
		onPageError: (listener) => void errors.push(listener),
		onRequestFailed: (listener) => void failures.push(listener),
		onNetworkRequest: (listener) => void requests.push(listener),
		emulateNetwork: async (conditions: BrowserNetworkConditions) =>
			void (await page.context().setOffline(conditions.offline === true)),
		clearNetworkEmulation: async () => void (await page.context().setOffline(false)),
		onNavigated: (listener) => void navigations.push(listener),
		close: async () => {
			evidence.serviceWorker = await page.evaluate(async () => ({
				registrations: (await navigator.serviceWorker.getRegistrations()).length,
				controller: navigator.serviceWorker.controller?.state ?? null,
				cacheNames: (await caches.keys()).sort(),
			}));
			await page.close();
		},
	};
}

function blockedBrowser(evidence: BrowserEvidence): WitnessBrowser {
	return {
		name: 'playwright-chromium-service-workers-blocked',
		launch: async ({ headless }) => {
			const browser = await chromium.launch({ executablePath: chromiumExecutable, headless });
			const context = await browser.newContext({ serviceWorkers: 'block' });
			await context.route('**/*', async (route) => {
				if (loopback(route.request().url())) await route.continue();
				else {
					evidence.attemptedNonLoopback.push(route.request().url());
					await route.abort('blockedbyclient');
				}
			});
			context.on('response', (response) => {
				if (!loopback(response.url()) && response.ok()) evidence.successfulNonLoopback += 1;
			});
			return {
				newPage: async () => adaptPage(await context.newPage(), evidence),
				close: async () => {
					await context.close();
					await browser.close();
				},
			};
		},
	};
}

async function witnessJourney(
	directory: string,
	lane: 'baseline' | 'target',
	pass: 1 | 2 | 3,
): Promise<Record<string, unknown>> {
	const server = await startStaticServer(directory);
	const evidence: BrowserEvidence = {
		serviceWorker: { registrations: -1, controller: null, cacheNames: [] },
		attemptedNonLoopback: [],
		successfulNonLoopback: 0,
		pageErrors: [],
		consoleErrors: [],
	};
	const interactions: Array<{ kind: 'click'; selector: string }> = [];
	const click = async (
		page: Awaited<ReturnType<Parameters<Parameters<typeof box>[1]>[0]['browser']['visit']>>,
		key: keyof typeof buttonSelectors,
	): Promise<void> => {
		const selector = buttonSelectors[key];
		await page.click(selector);
		interactions.push({ kind: 'click', selector });
	};
	const definition = box(`react-calculator-${lane}-${pass}`, async (context) => {
		const page = await context.browser.visit(server.origin);
		await page.trackEvents('click');
		for (const key of [
			'AC',
			'one',
			'two',
			'decimal',
			'five',
			'multiply',
			'three',
			'equals',
		] as const)
			await click(page, key);
		await context.expect.page.text(page, '.component-display > div', '37.5');
		await click(page, 'percent');
		await context.expect.page.text(page, '.component-display > div', '0.375');
		await click(page, 'AC');
		await context.expect.page.text(page, '.component-display > div', '0');
		for (const key of ['eight', 'divide', 'two', 'divide', 'two', 'equals'] as const)
			await click(page, key);
		await context.expect.page.text(page, '.component-display > div', '2');
		for (const key of ['AC', 'six', 'multiply', 'seven', 'equals'] as const)
			await click(page, key);
		await context.expect.page.text(page, '.component-display > div', '42');
		for (const key of ['AC', 'five', 'sign'] as const) await click(page, key);
		await context.expect.page.text(page, '.component-display > div', '-5');
		for (const key of [
			'AC',
			'zero',
			'decimal',
			'one',
			'plus',
			'zero',
			'decimal',
			'two',
			'equals',
		] as const)
			await click(page, key);
		await context.expect.page.text(page, '.component-display > div', '0.3');
		for (const key of ['AC', 'one', 'plus', 'two', 'multiply', 'three', 'equals'] as const)
			await click(page, key);
		await context.expect.page.text(page, '.component-display > div', '9');
		await context.expect.page.outcome(page, { events: { click: { atLeast: 38 } } });
		await context.receipt.capture('calculator-arithmetic-state');
	});
	let result: Awaited<ReturnType<typeof runBoxes>>;
	try {
		result = await runBoxes({
			root: directory,
			boxes: [
				{
					file: join(directory, 'versionless-calculator.box.ts'),
					relativeFile: 'versionless-calculator.box.ts',
					exportName: 'default',
					box: definition,
				},
			],
			receiptDir: join(workRoot, 'witness-receipts', lane, `pass-${pass}`),
			assertionTimeoutMs: 10_000,
			fileSystem: witnessNodeFileSystem,
			browser: blockedBrowser(evidence),
			headless: true,
		});
	} finally {
		await server.close();
	}
	server.assertClean();
	if (result.status !== 'passed') {
		const failure = result.boxes[0]?.error?.message ?? 'unknown';
		throw new Error(
			isReactCalculatorMultiplicationRed(failure)
				? 'calculator-multiplication-42-red'
				: `React Calculator Witness journey failed: ${failure}`,
		);
	}
	if (
		evidence.successfulNonLoopback !== 0 ||
		evidence.serviceWorker.registrations !== 0 ||
		evidence.serviceWorker.controller !== null ||
		evidence.serviceWorker.cacheNames.length !== 0 ||
		evidence.pageErrors.length !== 0 ||
		evidence.consoleErrors.length !== 0
	)
		throw new Error('React Calculator browser locality or error evidence differs');
	return {
		lane,
		pass,
		result: 'pass',
		witnessReceiptSha256: sha256(await readFile(result.receiptPath)),
		journeyA: { multiply: '37.5', percent: '0.375', clear: '0' },
		journeyB: {
			division: '2',
			multiplication: '42',
			signToggle: '-5',
			precision: '0.3',
			chained: '9',
		},
		interactions,
		serviceWorker: evidence.serviceWorker,
		attemptedNonLoopback: evidence.attemptedNonLoopback,
		successfulNonLoopback: evidence.successfulNonLoopback,
		pageErrors: evidence.pageErrors,
		consoleErrors: evidence.consoleErrors,
	};
}

export function isReactCalculatorMultiplicationRed(message: string): boolean {
	return (
		message.startsWith(`expected '.component-display > div' to have text "42", but it was `) &&
		!message.includes('but no element matched')
	);
}

export function mutateReactCalculatorOperate(source: string): string {
	const branch = 'if (operation === "x") {';
	const span = 'return one.times(two).toString();';
	if (
		source.indexOf(branch) < 0 ||
		source.indexOf(branch) !== source.lastIndexOf(branch) ||
		source.indexOf(span) < 0 ||
		source.indexOf(span) !== source.lastIndexOf(span)
	)
		throw new Error('React Calculator multiplication mutation branch differs');
	return source.replace(span, 'return one.div(two).toString();');
}

async function publishEvidence(
	ingest: IngestReceipt,
	build: unknown,
	witness: unknown,
	mutation: unknown,
): Promise<string> {
	await mkdir(outputStage, { recursive: true });
	const linked = await verifyLinkedWitnessProvenance();
	const provenance = {
		source: {
			revision: ingest.source.revision,
			tree: ingest.source.tree,
			license: 'MIT',
			archiveSha256: ingest.source.archiveSha256,
		},
		closure: { digest: ingest.closure.digest, offlineReplays: 2 },
		targetClosure: { digest: ingest.targetClosure.digest, offlineReplays: 2 },
		license: ingest.license,
		privacy: {
			backendDependency: false,
			persistenceDependency: false,
			credentials: false,
			customerData: false,
			paymentData: false,
		},
	};
	const witnessValue = { ...(witness as Record<string, unknown>), linkedWitness: linked };
	const human = `# React Calculator production candidate\n\nThe candidate remains uncounted pending fresh Judge acceptance. Evidence establishes local reproducibility and hash integrity; it is not certification, not signer authenticity, and not OS-wide isolation.\n`;
	const documents = [
		['provenance.json', `${canonicalize(provenance)}\n`],
		['build.json', `${canonicalize(build)}\n`],
		['witness.json', `${canonicalize(witnessValue)}\n`],
		['mutation.json', `${canonicalize(mutation)}\n`],
		['receipt.md', human],
	] as const;
	for (const [name, body] of documents) await writeFile(join(outputStage, name), body);
	const receipt = {
		schemaVersion: REACT_CALCULATOR_SCHEMA,
		result: 'pass',
		counted: false,
		artifacts: documents.map(([name, body]) => ({
			path: `evidence/runs/react-calculator-react16-to-vite8/${name}`,
			sha256: sha256(body),
		})),
		integrity: { algorithm: 'sha256', authenticity: 'not-established', canonicalDigest: '' },
	};
	receipt.integrity.canonicalDigest = sha256(canonicalize(receipt));
	parseReactCalculatorReceipt(receipt);
	await writeFile(join(outputStage, 'receipt.json'), `${canonicalize(receipt)}\n`);
	return receipt.integrity.canonicalDigest;
}

async function executeReactCalculatorRun(): Promise<void> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('React Calculator run requires exact offline environment');
	await mkdir(workRoot, { recursive: true });
	const ingest = JSON.parse(
		await readFile(join(cacheRoot, 'receipt.json'), 'utf8'),
	) as IngestReceipt;
	const baseline1 = await prepareLane('baseline-1', ingest, false);
	const baseline2 = await prepareLane('baseline-2', ingest, false);
	const target1 = await prepareLane('target-1', ingest, true);
	const target2 = await prepareLane('target-2', ingest, true);
	const baselineDigests = [await buildLane(baseline1, false), await buildLane(baseline2, false)];
	const targetDigests = [await buildLane(target1, true), await buildLane(target2, true)];
	if (baselineDigests[0] !== baselineDigests[1] || targetDigests[0] !== targetDigests[1])
		throw new Error('React Calculator build output is unstable');
	const runs = [
		await witnessJourney(join(baseline1, 'build'), 'baseline', 1),
		await witnessJourney(join(baseline2, 'build'), 'baseline', 2),
		await witnessJourney(join(target1, 'build'), 'target', 1),
		await witnessJourney(join(target2, 'build'), 'target', 2),
	];
	const operatePath = join(target2, 'src/logic/operate.js');
	if (manifestRow(ingest, 'src/logic/operate.js').gitSha !== calculatorOperateGitSha)
		throw new Error('React Calculator operate Git identity differs');
	const originalOperate = await readFile(operatePath, 'utf8');
	const originalSourceSha256 = sha256(originalOperate);
	let red = false;
	let redReason = '';
	let mutatedBuildDigest = '';
	let restoredBuildDigest = '';
	try {
		await writeFile(operatePath, mutateReactCalculatorOperate(originalOperate));
		mutatedBuildDigest = await buildLane(target2, true);
		await witnessJourney(join(target2, 'build'), 'target', 3).catch((error: unknown) => {
			if (error instanceof Error && error.message === 'calculator-multiplication-42-red') {
				red = true;
				redReason = error.message;
				return;
			}
			throw error;
		});
	} finally {
		await writeFile(operatePath, originalOperate);
		restoredBuildDigest = await buildLane(target2, true);
	}
	if (!red || restoredBuildDigest !== targetDigests[1])
		throw new Error('React Calculator mutation did not prove intended red/restoration');
	const restoredRun = await witnessJourney(join(target2, 'build'), 'target', 3);
	const build = {
		baseline: { runtime: '16.20.2', bundler: 'react-scripts-3.0.1', digests: baselineDigests },
		target: {
			runtime: '24.15.0',
			bundler: 'vite-8.0.16',
			digests: targetDigests,
			dependencies: { react: '18.3.1', 'react-dom': '18.3.1', scheduler: '0.23.2' },
		},
	};
	const witness = {
		directLinkedWitness: true,
		runs,
		successfulNonLoopback: 0,
		serviceWorkerRegistrations: 0,
		serviceWorkerControllers: 0,
		serviceWorkerCaches: 0,
	};
	const mutation = {
		branch: 'operate x/toString repeated multiplication branch',
		intendedFailure: 'Journey B multiplication expected 42',
		red,
		redReason,
		green: true,
		mutatedBuildDigest,
		restoredRun,
		originalSourceSha256,
		restoredSourceSha256: sha256(await readFile(operatePath)),
		originalBuildDigest: targetDigests[1],
		restoredBuildDigest,
	};
	const digest = await publishEvidence(ingest, build, witness, mutation);
	const aggregateBackup = await readFile(aggregatePath);
	const aggregate = JSON.parse(aggregateBackup.toString('utf8')) as {
		fixtures?: Array<Record<string, unknown>>;
	};
	const member = reactCalculatorAggregateMember(digest);
	aggregate.fixtures = [
		...(aggregate.fixtures ?? []).filter((value) => value.id !== member.id),
		member,
	];
	const stagedAggregate = `${canonicalize(aggregate)}\n`;
	const trustBackup = join(workRoot, 'trust-current-backup');
	const trustReplayBackup = join(workRoot, 'trust-replay-backup');
	const stagedTrustCurrent = join(publicationStage, 'trust-current');
	const stagedTrustReplay = join(publicationStage, 'trust-replay');
	const observedAt = new Date().toISOString();
	await runReactCalculatorAtomicPublication({
		snapshot: async () => {
			const trustPresent = await exists(trustCurrent);
			const trustReplayPresent = await exists(trustReplay);
			if (trustPresent) await cp(trustCurrent, trustBackup, { recursive: true });
			if (trustReplayPresent) await cp(trustReplay, trustReplayBackup, { recursive: true });
			return { aggregateBackup, trustPresent, trustReplayPresent };
		},
		publish: async () => {
			await mkdir(publicationStage, { recursive: true });
			await rename(outputStage, outputRoot);
			await writeFile(aggregatePath, stagedAggregate);
			await analyzeCorpusConformance({ rootDir: root });
			for (const outputDir of [stagedTrustCurrent, stagedTrustReplay])
				await generateTrustPackage({
					rootDir: root,
					policyPath: 'trust/policy.json',
					outputDir,
					offline: true,
					environment: { ...process.env, VERSIONLESS_NETWORK_MODE: 'offline' },
					observedAt,
				});
			await verifyTrustPackage({
				rootDir: root,
				outputDir: stagedTrustReplay,
				compareDir: stagedTrustCurrent,
				environment: { ...process.env, VERSIONLESS_NETWORK_MODE: 'offline' },
				now: observedAt,
			});
		},
		verify: async () => {
			await verifyReactCalculatorEvidence(root);
			await analyzeCorpusConformance({ rootDir: root });
		},
		commit: async () => {
			await rm(trustCurrent, { recursive: true, force: true });
			await rename(stagedTrustCurrent, trustCurrent);
			await rm(trustReplay, { recursive: true, force: true });
			await rename(stagedTrustReplay, trustReplay);
			await verifyTrustPackage({
				rootDir: root,
				outputDir: trustReplay,
				compareDir: trustCurrent,
				environment: { ...process.env, VERSIONLESS_NETWORK_MODE: 'offline' },
				now: observedAt,
			});
			await rm(publicationStage, { recursive: true, force: true });
		},
		restore: async (snapshot) => {
			await rm(outputRoot, { recursive: true, force: true });
			await rm(outputStage, { recursive: true, force: true });
			await writeFile(aggregatePath, snapshot.aggregateBackup);
			await rm(trustCurrent, { recursive: true, force: true });
			if (snapshot.trustPresent) await cp(trustBackup, trustCurrent, { recursive: true });
			await rm(trustReplay, { recursive: true, force: true });
			if (snapshot.trustReplayPresent)
				await cp(trustReplayBackup, trustReplay, { recursive: true });
			await rm(publicationStage, { recursive: true, force: true });
		},
	});
}

export async function runReactCalculator(): Promise<void> {
	for (const target of [workRoot, outputRoot, outputStage, publicationStage])
		if (await exists(target)) throw new Error('React Calculator run requires fresh roots');
	try {
		await executeReactCalculatorRun();
	} catch (error) {
		await rm(outputStage, { recursive: true, force: true });
		await rm(publicationStage, { recursive: true, force: true });
		await rm(outputRoot, { recursive: true, force: true });
		await mkdir(outputRoot, { recursive: true });
		const terminal = {
			schemaVersion: 'versionless.react-calculator-terminal-exclusion.v1',
			result: 'terminal-exclusion',
			counted: false,
			retry: false,
			reason:
				error instanceof Error && error.message.includes('Witness')
					? 'browser-or-mutation-gate-failed'
					: 'production-vertical-gate-failed',
			integrity: { algorithm: 'sha256', canonicalDigest: '' },
		};
		terminal.integrity.canonicalDigest = sha256(canonicalize(terminal));
		await writeFile(join(outputRoot, 'terminal-exclusion.json'), `${canonicalize(terminal)}\n`);
		throw error;
	} finally {
		await rm(workRoot, { recursive: true, force: true });
	}
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	if (args.length !== 1 || args[0] !== '--run')
		throw new Error('React Calculator run requires exact --run argument');
	await runReactCalculator();
	process.stdout.write(`${canonicalize({ result: 'pass', counted: false })}\n`);
}

if (basename(process.argv[1] ?? '') === 'react-calculator-run.ts')
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
