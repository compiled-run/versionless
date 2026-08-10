import { spawn, type ChildProcess } from 'node:child_process';
import { access, cp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import {
	box,
	runBoxes,
	type BrowserConsoleMessage,
	type BrowserNetworkConditions,
	type BrowserNetworkRequest,
	type BrowserPageError,
	type BrowserRequestFailure,
	type PageRecord,
	type WitnessBrowser,
	type WitnessBrowserPage,
} from '@async/witness';
import { chromium, type Page, type Request } from 'playwright';
import { basename, dirname, join, relative, resolve } from 'pathe';
import { encodeParam, joinURL, parseHost, parseURL } from 'ufo';
import {
	REACT_GRAPHIQL_013_SCHEMA,
	analyzeCorpusConformance,
	canonicalize,
	parseReactGraphiQL013Receipt,
	reactGraphiQL013AggregateMember,
	sha256,
	verifyReactGraphiQL013Evidence,
} from '../../../core/src/index.ts';
import {
	mutateGraphiQLIsTest,
	planGraphiQLTargetExamplePackage,
	planGraphiQLTargetPackage,
	transformGraphiQLExample,
} from '../../../frameworks/react/src/index.ts';
import { generateTrustPackage, verifyTrustPackage } from '../../../trust/src/index.ts';
import { witnessNodeFileSystem } from '../witness/node-filesystem.ts';
import { verifyLinkedWitnessProvenance } from '../witness/provenance.ts';
import { verifyGraphiQLIngest } from './react-graphiql-013-ingest.ts';

const root = resolve(import.meta.dirname, '../../../..');
const cacheRoot = join(root, '.versionless/cache/react-graphiql-013/t577');
const workRoot = join(root, '.versionless/work/react-graphiql-013/t577');
const outputRoot = join(root, 'evidence/runs/react-graphiql-react15-to-vite8');
const outputStage = `${outputRoot}.stage`;
const aggregatePath = join(root, 'evidence/runs/aggregate.json');
const publicationStage = join(root, '.versionless/stage/react-graphiql-013/t577-publication');
const trustCurrent = join(root, 'evidence/trust/current');
const trustReplay = join(root, '.versionless/cache/trust/replay/react-graphiql-013');
const node16 = join(root, '.versionless/cache/angular-phonecat/node16/bin/node');
const node24 = process.execPath;
const vite = join(root, 'node_modules/vite/bin/vite.js');
const viteConfig = join(root, 'packages/cli/src/fixture/react-graphiql-013-vite.config.ts');
const chromiumExecutable = join(
	root,
	'.versionless/cache/react-boilerplate-v4/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell',
);
const yarnRoot = join(
	process.env.COREPACK_HOME ?? join(process.env.HOME ?? '', '.cache/node/corepack'),
	'v1/yarn/1.22.22',
);
const yarn = join(yarnRoot, 'bin/yarn.js');
const query = 'query Inspect($flag:Boolean){ id isTest hasArgs(boolean:$flag) }';
const variables = '{"flag":true}';

type BrowserEvidence = {
	serviceWorker: { registrations: number; controller: string | null; cacheNames: string[] };
	attemptedNonLoopback: string[];
	successfulNonLoopback: number;
	pageErrors: string[];
	consoleErrors: string[];
	failedRequests: Array<{ url: string; method: string; reason: string | null }>;
	completedRequests: Array<{ path: string; status: number | null }>;
	graphqlPosts: Array<{
		url: string;
		method: string;
		body: string | null;
		headers: Record<string, string>;
		status: number | null;
	}>;
	inspect: <Value>(callback: () => Value | Promise<Value>) => Promise<Value>;
	waitForExpression: (expression: string) => Promise<void>;
	pendingResponses: Array<Promise<void>>;
};
type IngestReceipt = Record<string, unknown> & {
	supplemental: Array<{
		name: string;
		version: string;
		tarballSha256: string;
		requiredFiles: Array<{ path: string; sha256: string }>;
	}>;
};

const compare = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);
const npmPurl = (name: string, version: string): string => {
	const encode = (value: string) => encodeParam(value).replaceAll('@', '%40');
	const pieces = name.startsWith('@') ? name.slice(1).split('/') : [name];
	const encodedName = name.startsWith('@')
		? joinURL(`%40${encode(pieces[0] ?? '')}`, encode(pieces[1] ?? ''))
		: encode(name);
	return `pkg:npm/${encodedName}@${encode(version)}`;
};
const exists = (path: string): Promise<boolean> =>
	access(path).then(
		() => true,
		() => false,
	);

export function assertGraphiQLYarnTool(input: {
	bin: Uint8Array;
	cli: Uint8Array;
	manifest: Uint8Array;
}): void {
	if (
		sha256(input.bin) !== '148e19db309ec9eaf7720b28df811337906eea8a1758deaa54afee60a6305e04' ||
		sha256(input.cli) !== '443ed69e76443b89afddccfc9faec1ff16eb5e500979cc079c696dec4c3d94ee' ||
		sha256(input.manifest) !==
			'9533b84eaaeea708ab99bcf92772bc81c7389f90a04f8b0188c163f9b3b621c3'
	)
		throw new Error('GraphiQL Yarn 1.22.22 tool identity differs');
}

export function assertGraphiQLViteTool(input: {
	bin: Uint8Array;
	manifest: Uint8Array;
	lock: Uint8Array;
}): void {
	const manifest = JSON.parse(Buffer.from(input.manifest).toString('utf8')) as {
		version?: unknown;
	};
	if (
		manifest.version !== '8.0.16' ||
		sha256(input.bin) !== 'fa03478846d229651a3c6aa64833ba2c6cbf580a798b92bd8f47c7480bafb5d8' ||
		sha256(input.manifest) !==
			'a2b943431b51bfcc2e9386eecf8b4b3f6e4bf443e56d17b1f4c8495a61b4050c' ||
		sha256(input.lock) !== 'ae8c76d3483d5dcd72428ba3a0b9eb0b1731724c14f6f0893ac20972cea5e66a'
	)
		throw new Error('GraphiQL Versionless Vite 8.0.16 adapter identity differs');
}

export function assertGraphiQLRuntimeTools(input: {
	node16: Uint8Array;
	node24: Uint8Array;
	chromium: Uint8Array;
}): void {
	if (
		sha256(input.node16) !==
			'83325958463d59cb0b16433eefab0a03fd1ce7d565a27e0274f507b1f3839a6e' ||
		sha256(input.node24) !==
			'3200fbd9f7fd4410426dd541e10d1ab829d3472f270d743c7fabd1696c03fe32' ||
		sha256(input.chromium) !==
			'a46b3b1e63163fa2d2437fb6ae967cb5a73b50050bca32f1964e6129b6228244'
	)
		throw new Error('GraphiQL runtime tool identity differs');
}

export function isGraphiQLIsTestRed(message: string): boolean {
	return message === 'expected GraphiQL result isTest true, but it was false';
}

export function graphIQLWitnessBehaviorCore(run: Record<string, unknown>): string {
	const witness = run.witness as Record<string, unknown>;
	return canonicalize({
		result: run.result,
		journey1: run.journey1,
		journey2: run.journey2,
		interactions: run.interactions,
		graphqlPosts: run.graphqlPosts,
		serviceWorker: run.serviceWorker,
		attemptedNonLoopback: run.attemptedNonLoopback,
		successfulNonLoopback: run.successfulNonLoopback,
		pageErrors: run.pageErrors,
		consoleErrors: run.consoleErrors,
		witness: {
			outcome: witness.outcome,
			assertions: witness.assertions,
			interactions: witness.interactions,
			eventCounts: witness.eventCounts,
			navigations: witness.navigations,
			network: witness.network,
			failedRequests: witness.failedRequests,
			pageErrors: witness.pageErrors,
			consoleErrors: witness.consoleErrors,
		},
	});
}

export async function runGraphiQLAtomicPublication<Snapshot>(steps: {
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
		child.stdout.on('data', (value: Buffer) => stdout.push(value));
		child.stderr.on('data', (value: Buffer) => stderr.push(value));
		child.once('error', reject);
		child.once('exit', (code) =>
			code === 0
				? resolvePromise(Buffer.concat(stdout).toString('utf8'))
				: reject(
						new Error(
							`${basename(command)} exited ${code ?? -1}: ${Buffer.concat(stderr)}`,
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
		else throw new Error('GraphiQL output contains symbolic link or special entry');
	}
	return result.sort(compare);
}

type BuildInventory = { digest: string; files: Array<{ path: string; sha256: string }> };

async function treeDigest(directory: string): Promise<BuildInventory> {
	const files = await Promise.all(
		(await filesBelow(directory)).map(async (file) => ({
			path: relative(directory, file),
			sha256: sha256(await readFile(file)),
		})),
	);
	return { digest: sha256(canonicalize(files)), files };
}

async function bindTools(): Promise<void> {
	assertGraphiQLYarnTool({
		bin: await readFile(yarn),
		cli: await readFile(join(yarnRoot, 'lib/cli.js')),
		manifest: await readFile(join(yarnRoot, 'package.json')),
	});
	assertGraphiQLViteTool({
		bin: await readFile(vite),
		manifest: await readFile(join(root, 'node_modules/vite/package.json')),
		lock: await readFile(join(root, 'pnpm-lock.yaml')),
	});
	assertGraphiQLRuntimeTools({
		node16: await readFile(node16),
		node24: await readFile(node24),
		chromium: await readFile(chromiumExecutable),
	});
	if ((await execute(node16, ['--version'])).trim() !== 'v16.20.2')
		throw new Error('GraphiQL baseline Node identity differs');
	if ((await execute(node24, ['--version'])).trim() !== 'v24.15.0')
		throw new Error('GraphiQL target Node identity differs');
}

async function installLane(lane: string): Promise<void> {
	const lockBefore = sha256(await readFile(join(lane, 'yarn.lock')));
	await writeFile(
		join(lane, '.yarnrc'),
		`yarn-offline-mirror "${join(cacheRoot, 'mirror')}"\nyarn-offline-mirror-pruning false\n`,
	);
	await execute(
		node16,
		[
			yarn,
			'install',
			'--frozen-lockfile',
			'--offline',
			'--ignore-scripts',
			'--ignore-optional',
			'--non-interactive',
			'--cache-folder',
			join(lane, '.yarn-cache'),
		],
		lane,
		{
			PATH: `${dirname(node16)}:/usr/bin:/bin`,
			VERSIONLESS_NETWORK_MODE: 'offline',
			NPM_CONFIG_OFFLINE: 'true',
			YARN_ENABLE_NETWORK: '0',
			SKIP_YARN_COREPACK_CHECK: '1',
			CI: '1',
		},
	);
	if (sha256(await readFile(join(lane, 'yarn.lock'))) !== lockBefore)
		throw new Error('GraphiQL frozen Yarn install changed the lock');
	await rm(join(lane, '.yarn-cache'), { recursive: true, force: true });
}

async function extractSupplemental(
	lane: string,
	name: string,
	version: string,
	ingest: IngestReceipt,
): Promise<void> {
	const evidence = ingest.supplemental.find(
		(row) => row.name === name && row.version === version,
	);
	const tarballPath = join(cacheRoot, 'supplemental', `${name}-${version}.tgz`);
	if (!evidence || sha256(await readFile(tarballPath)) !== evidence.tarballSha256)
		throw new Error('GraphiQL target supplemental receipt binding differs');
	const destination = join(lane, 'node_modules', name);
	await rm(destination, { recursive: true, force: true });
	await mkdir(destination, { recursive: true });
	await execute('/usr/bin/tar', ['-xzf', tarballPath, '--strip-components=1', '-C', destination]);
	const manifest = JSON.parse(await readFile(join(destination, 'package.json'), 'utf8')) as {
		name?: unknown;
		version?: unknown;
	};
	if (manifest.name !== name || manifest.version !== version)
		throw new Error('GraphiQL extracted target package identity differs');
	for (const required of evidence.requiredFiles)
		if (sha256(await readFile(join(destination, required.path))) !== required.sha256)
			throw new Error('GraphiQL extracted target UMD identity differs');
	for (const path of await filesBelow(destination)) {
		if (relative(destination, path).startsWith('..'))
			throw new Error('GraphiQL extracted target package escapes its root');
	}
}

async function prepareLane(name: string, target: boolean, ingest: IngestReceipt): Promise<string> {
	const lane = join(workRoot, name);
	await cp(join(cacheRoot, 'source'), lane, { recursive: true });
	await installLane(lane);
	const example = join(lane, 'packages/graphiql/example');
	const vendor = join(example, 'vendor');
	await mkdir(vendor, { recursive: true });
	for (const asset of await readdir(join(cacheRoot, 'assets')))
		await cp(join(cacheRoot, 'assets', asset), join(vendor, asset));
	const htmlPath = join(example, 'index.html');
	const htmlBytes = await readFile(htmlPath);
	const transformed = transformGraphiQLExample({
		htmlBytes,
		lane: target ? 'target' : 'baseline',
	});
	await writeFile(htmlPath, transformed.html);
	if (target) {
		const packagePath = join(lane, 'packages/graphiql/package.json');
		const planned = planGraphiQLTargetPackage({ packageBytes: await readFile(packagePath) });
		await writeFile(packagePath, planned.packageJson);
		const examplePackagePath = join(example, 'package.json');
		const examplePlan = planGraphiQLTargetExamplePackage({
			packageBytes: await readFile(examplePackagePath),
		});
		await writeFile(examplePackagePath, examplePlan.packageJson);
		for (const [packageName, version] of [
			['react', '18.3.1'],
			['react-dom', '18.3.1'],
			['scheduler', '0.23.2'],
			['loose-envify', '1.4.0'],
			['js-tokens', '4.0.0'],
		] as const)
			await extractSupplemental(lane, packageName, version, ingest);
		await cp(
			join(lane, 'node_modules/react/umd/react.production.min.js'),
			join(vendor, 'react-18.3.1.js'),
		);
		await cp(
			join(lane, 'node_modules/react-dom/umd/react-dom.production.min.js'),
			join(vendor, 'react-dom-18.3.1.js'),
		);
	}
	return lane;
}

async function buildBaseline(lane: string): Promise<BuildInventory> {
	const packageRoot = join(lane, 'packages/graphiql');
	await execute('/bin/bash', ['./resources/build.sh'], packageRoot, {
		...process.env,
		PATH: `${dirname(node16)}:${join(lane, 'node_modules/.bin')}:/usr/bin:/bin`,
		VERSIONLESS_NETWORK_MODE: 'offline',
		NPM_CONFIG_OFFLINE: 'true',
	});
	await cp(join(packageRoot, 'graphiql.js'), join(packageRoot, 'example/graphiql.js'));
	await cp(join(packageRoot, 'graphiql.css'), join(packageRoot, 'example/graphiql.css'));
	return await treeDigest(join(packageRoot, 'example'));
}

async function buildTarget(lane: string): Promise<BuildInventory> {
	const packageRoot = join(lane, 'packages/graphiql');
	await rm(join(packageRoot, 'dist'), { recursive: true, force: true });
	await execute(
		node24,
		[
			join(lane, 'node_modules/@babel/cli/bin/babel.js'),
			join(packageRoot, 'src'),
			'--root-mode',
			'upward',
			'--ignore',
			'__tests__',
			'--out-dir',
			join(packageRoot, 'dist'),
		],
		lane,
		{ ...process.env, VERSIONLESS_NETWORK_MODE: 'offline', NPM_CONFIG_OFFLINE: 'true' },
	);
	const cssFiles = (await readdir(join(packageRoot, 'css')))
		.filter((name) => name.endsWith('.css'))
		.sort(compare)
		.map((name) => join(packageRoot, 'css', name));
	await execute(
		join(lane, 'node_modules/.bin/postcss'),
		['--no-map', '--use', 'autoprefixer', '-d', join(packageRoot, 'dist'), ...cssFiles],
		packageRoot,
		{ ...process.env, PATH: `${dirname(node24)}:/usr/bin:/bin` },
	);
	const builtCss = (await readdir(join(packageRoot, 'dist')))
		.filter((name) => name.endsWith('.css'))
		.sort(compare);
	await writeFile(
		join(packageRoot, 'example/graphiql.css'),
		Buffer.concat(
			await Promise.all(builtCss.map((name) => readFile(join(packageRoot, 'dist', name)))),
		),
	);
	await execute(node24, [vite, 'build', '--config', viteConfig], root, {
		...process.env,
		VERSIONLESS_NETWORK_MODE: 'offline',
		NPM_CONFIG_OFFLINE: 'true',
		VERSIONLESS_GRAPHIQL_APPLICATION_ROOT: lane,
	});
	await cp(
		join(packageRoot, 'example/vite-output/graphiql-vite.js'),
		join(packageRoot, 'example/graphiql-vite.js'),
	);
	return await treeDigest(join(packageRoot, 'example'));
}

function loopback(url: string): boolean {
	const parsed = parseURL(url);
	const host = parseHost(parsed.host ?? '').hostname;
	return parsed.protocol === 'http:' && (host === '127.0.0.1' || host === 'localhost');
}

async function normalizeGraphiQLWitnessReceipt(
	receiptPath: string,
	logicalRun: string,
	outcome: 'pass' | 'expected-red',
): Promise<Record<string, unknown>> {
	const receiptBytes = await readFile(receiptPath);
	const raw = JSON.parse(receiptBytes.toString('utf8')) as Record<string, unknown>;
	const summary = raw.summary as Record<string, unknown> | undefined;
	const boxes = raw.boxes;
	if (
		raw.asyncWitnessReceipt !== 1 ||
		!summary ||
		!Array.isArray(boxes) ||
		boxes.length !== 1 ||
		!boxes[0] ||
		typeof boxes[0] !== 'object'
	)
		throw new Error('GraphiQL Witness receipt envelope differs');
	const boxReceipt = boxes[0] as Record<string, unknown>;
	const boxSummary = boxReceipt.summary as Record<string, unknown> | undefined;
	const assertionSummary = boxSummary?.assertions as Record<string, unknown> | undefined;
	const pages = boxReceipt.pages;
	const expectedStatus = outcome === 'pass' ? 'passed' : 'failed';
	const expectedError = 'expected GraphiQL result isTest true, but it was false';
	const error = boxReceipt.error as Record<string, unknown> | null | undefined;
	if (
		summary.status !== expectedStatus ||
		boxSummary?.status !== expectedStatus ||
		!assertionSummary ||
		typeof assertionSummary.passed !== 'number' ||
		typeof assertionSummary.failed !== 'number' ||
		(outcome === 'pass' && (assertionSummary.failed !== 0 || error !== null)) ||
		(outcome === 'expected-red' && error?.message !== expectedError) ||
		!Array.isArray(pages) ||
		pages.length !== 1
	)
		throw new Error('GraphiQL Witness phase status or assertions differ');
	const page = pages[0] as PageRecord;
	const captureRoot = join(outputStage, 'captures', logicalRun);
	await mkdir(captureRoot, { recursive: true });
	const captures: Array<{ kind: 'html' | 'png'; path: string; sha256: string }> = [];
	for (const [index, snapshot] of page.snapshots.entries()) {
		for (const [kind, source] of [
			['html', snapshot.html],
			['png', snapshot.screenshot],
		] as const) {
			if (source === null) throw new Error('GraphiQL Witness screenshot capture is missing');
			const bytes = await readFile(join(dirname(receiptPath), source));
			if (
				kind === 'html' &&
				(bytes.toString('utf8').includes(root) ||
					bytes.toString('utf8').includes('/Users/'))
			)
				throw new Error('GraphiQL Witness HTML contains a host absolute path');
			const name = `${String(index + 1).padStart(2, '0')}.${kind}`;
			await writeFile(join(captureRoot, name), bytes, { flag: 'wx' });
			captures.push({
				kind,
				path: `evidence/runs/react-graphiql-react15-to-vite8/captures/${logicalRun}/${name}`,
				sha256: sha256(bytes),
			});
		}
	}
	const eventCounts = Object.fromEntries(
		Object.keys(page.trackedEvents)
			.sort(compare)
			.map((type) => [type, page.trackedEvents[type]?.length ?? 0]),
	);
	return {
		logicalRun,
		outcome,
		assertions: assertionSummary,
		intendedFailures: outcome === 'expected-red' ? 1 : 0,
		...(outcome === 'expected-red' ? { exactError: expectedError } : {}),
		interactions: page.interactions.map((interaction) => ({
			kind: interaction.kind,
			selector: interaction.selector,
		})),
		eventCounts,
		navigations: page.navigations.map((navigation) => parseURL(navigation.url).pathname),
		network: page.networkRequests.map((requestValue) => ({
			method: requestValue.method,
			path: parseURL(requestValue.url).pathname,
			status: requestValue.status,
		})),
		failedRequests: page.failedRequests.length,
		pageErrors: page.pageErrors.length,
		consoleErrors: page.consoleMessages.filter((message) => message.level === 'error').length,
		captures,
	};
}

async function requestRecord(
	requestValue: Request,
	startedAt: number,
): Promise<BrowserNetworkRequest> {
	const response = await requestValue.response().catch(() => null);
	return {
		url: requestValue.url(),
		method: requestValue.method(),
		resourceType: requestValue.resourceType(),
		startTimeMs: startedAt,
		endTimeMs: Date.now(),
		durationMs: Date.now() - startedAt,
		status: response?.status() ?? null,
		responseTimeMs: null,
		mimeType: response?.headers()['content-type'] ?? null,
		encodedDataLength: null,
		failedReason: requestValue.failure()?.errorText ?? null,
		initiatorType: null,
	};
}

function adaptPage(page: Page, evidence: BrowserEvidence): WitnessBrowserPage {
	evidence.inspect = async <Value>(callback: () => Value | Promise<Value>) =>
		await page.evaluate(callback);
	evidence.waitForExpression = async (expression) =>
		void (await page.waitForFunction(expression, undefined, { timeout: 10_000 }));
	const consoles: Array<(message: BrowserConsoleMessage) => void> = [];
	const errors: Array<(error: BrowserPageError) => void> = [];
	const failures: Array<(failure: BrowserRequestFailure) => void> = [];
	const requests: Array<(requestValue: BrowserNetworkRequest) => void> = [];
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
	page.on('request', (requestValue) => {
		starts.set(requestValue, Date.now());
		if (requestValue.method() === 'POST' && requestValue.url().endsWith('/graphql'))
			evidence.graphqlPosts.push({
				url: requestValue.url(),
				method: requestValue.method(),
				body: requestValue.postData(),
				headers: requestValue.headers(),
				status: null,
			});
	});
	page.on('requestfailed', (requestValue) => {
		evidence.failedRequests.push({
			url: requestValue.url(),
			method: requestValue.method(),
			reason: requestValue.failure()?.errorText ?? null,
		});
		failures.forEach((listener) =>
			listener({
				url: requestValue.url(),
				method: requestValue.method(),
				reason: requestValue.failure()?.errorText ?? null,
			}),
		);
	});
	page.on('requestfinished', (requestValue) => {
		evidence.pendingResponses.push(
			requestValue.response().then((response) => {
				evidence.completedRequests.push({
					path: parseURL(requestValue.url()).pathname,
					status: response?.status() ?? null,
				});
			}),
		);
		if (requestValue.method() === 'POST' && requestValue.url().endsWith('/graphql')) {
			const row = [...evidence.graphqlPosts]
				.reverse()
				.find(
					(value) =>
						value.url === requestValue.url() && value.body === requestValue.postData(),
				);
			evidence.pendingResponses.push(
				requestValue.response().then((response) => {
					if (row) row.status = response?.status() ?? null;
				}),
			);
		}
		void requestRecord(requestValue, starts.get(requestValue) ?? Date.now()).then((row) =>
			requests.forEach((listener) => listener(row)),
		);
	});
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
				throw new Error('GraphiQL Witness rejects fill-backed typing');
			const locator = page.locator(selector);
			for (const character of text) await locator.press(character, { timeout });
			return { passwordField: (await locator.getAttribute('type')) === 'password' };
		},
		hover: async (selector, _modifiers, timeout) =>
			void (await page.locator(selector).hover({ timeout })),
		press: async (selector, key, _modifiers, timeout) =>
			void (await page.locator(selector).press(key, { timeout })),
		drag: async (source, target, _steps, timeout) => {
			const sourceBox = await page.locator(source).boundingBox({ timeout });
			const targetBox =
				typeof target === 'string'
					? await page.locator(target).boundingBox({ timeout })
					: { x: target.x, y: target.y, width: 0, height: 0 };
			if (!sourceBox || !targetBox) throw new Error('GraphiQL drag boundary differs');
			await page.mouse.move(
				sourceBox.x + sourceBox.width / 2,
				sourceBox.y + sourceBox.height / 2,
			);
			await page.mouse.down();
			await page.mouse.move(
				targetBox.x + targetBox.width / 2,
				targetBox.y + targetBox.height / 2,
				{ steps: 12 },
			);
			await page.mouse.up();
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

async function startGraphQLServer(
	lane: string,
	runtime: string,
): Promise<{
	origin: string;
	close: () => Promise<void>;
}> {
	const serverRoot = join(lane, 'packages/graphiql/example');
	return await new Promise((resolvePromise, reject) => {
		const child: ChildProcess = spawn(runtime, ['server.js'], {
			cwd: serverRoot,
			env: {
				...process.env,
				VERSIONLESS_NETWORK_MODE: 'offline',
				NPM_CONFIG_OFFLINE: 'true',
			},
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		let stderr = '';
		let started = false;
		const startupTimer = setTimeout(() => {
			child.kill('SIGTERM');
			reject(new Error('GraphiQL server startup timeout'));
		}, 10_000);
		child.stderr?.on('data', (value: Buffer) => (stderr += value.toString('utf8')));
		child.once('error', (error) => {
			clearTimeout(startupTimer);
			reject(error);
		});
		child.stdout?.on('data', (value: Buffer) => {
			const line = value.toString('utf8').trim();
			const prefix = 'Started on http://localhost:';
			if (!line.startsWith(prefix) || !line.endsWith('/')) return;
			const port = Number(line.slice(prefix.length, -1));
			if (!Number.isSafeInteger(port) || port < 1) {
				clearTimeout(startupTimer);
				reject(new Error('GraphiQL server port differs'));
				return;
			}
			started = true;
			clearTimeout(startupTimer);
			resolvePromise({
				origin: `http://127.0.0.1:${port}/`,
				close: async () => {
					await new Promise<void>((done, closeReject) => {
						const timer = setTimeout(() => {
							child.kill('SIGKILL');
							closeReject(new Error('GraphiQL server shutdown timeout'));
						}, 5_000);
						child.once('exit', () => {
							clearTimeout(timer);
							done();
						});
						child.kill('SIGTERM');
					});
				},
			});
		});
		child.once('exit', (code) => {
			clearTimeout(startupTimer);
			if (!started && code !== null && code !== 0)
				reject(new Error(`GraphiQL server exited ${code}: ${stderr}`));
		});
	});
}

async function witnessJourney(
	laneRoot: string,
	lane: 'baseline' | 'target',
	pass: 1 | 2 | 3,
	phase: 'green' | 'mutation-red' | 'restored' = 'green',
): Promise<Record<string, unknown>> {
	const server = await startGraphQLServer(laneRoot, lane === 'baseline' ? node16 : node24);
	const evidence: BrowserEvidence = {
		serviceWorker: { registrations: -1, controller: null, cacheNames: [] },
		attemptedNonLoopback: [],
		successfulNonLoopback: 0,
		pageErrors: [],
		consoleErrors: [],
		failedRequests: [],
		completedRequests: [],
		graphqlPosts: [],
		inspect: async () => {
			throw new Error('GraphiQL browser inspection is unavailable before page creation');
		},
		waitForExpression: async () => {
			throw new Error('GraphiQL browser wait is unavailable before page creation');
		},
		pendingResponses: [],
	};
	const interactions: Array<{ kind: string; selector: string }> = [];
	const definition = box(`react-graphiql-${lane}-${pass}`, async (context) => {
		const page = await context.browser.visit(server.origin);
		await page.trackEvents('click', 'input', 'keydown', 'mousedown', 'mousemove', 'mouseup');
		const queryEditor = '.query-editor .CodeMirror textarea';
		const variableEditor = '.variable-editor .CodeMirror textarea';
		await page.click(queryEditor);
		await page.press(queryEditor, 'Meta+A');
		await page.type(queryEditor, query, { keyEvents: true });
		await page.click(variableEditor);
		await page.press(variableEditor, 'Meta+A');
		await page.type(variableEditor, variables, { keyEvents: true });
		await page.press(queryEditor, 'Control+Enter');
		interactions.push(
			{ kind: 'type', selector: queryEditor },
			{ kind: 'type', selector: variableEditor },
			{ kind: 'keyboard-execute', selector: queryEditor },
		);
		await evidence.waitForExpression(
			`(() => { try { const value = document.querySelector('.result-window .CodeMirror')?.CodeMirror?.getValue() ?? ''; const parsed = JSON.parse(value); return parsed?.data?.id === 'abc123' && typeof parsed?.data?.isTest === 'boolean'; } catch { return false; } })()`,
		);
		const resultValue = await evidence.inspect(() => {
			const editor = document.querySelector('.result-window .CodeMirror') as
				| (Element & { CodeMirror?: { getValue(): string } })
				| null;
			return editor?.CodeMirror?.getValue() ?? '';
		});
		const result = JSON.parse(resultValue) as {
			data?: { id?: unknown; isTest?: unknown; hasArgs?: unknown };
		};
		if (result.data?.isTest === false) {
			await context.receipt.capture('graphiql-isTest-mutation-red');
			throw new Error('expected GraphiQL result isTest true, but it was false');
		}
		if (
			result.data?.id !== 'abc123' ||
			result.data.isTest !== true ||
			typeof result.data.hasArgs !== 'string' ||
			(JSON.parse(result.data.hasArgs) as { boolean?: unknown }).boolean !== true
		)
			throw new Error('GraphiQL Journey 1 result differs');
		const currentUrl = await evidence.inspect(() => window.location.href);
		if (!currentUrl.includes('query=') || !currentUrl.includes('variables='))
			throw new Error('GraphiQL Journey 1 encoded URL differs');
		await page.reload();
		await context.expect.page.exists(page, '.query-editor .CodeMirror');
		const reloadedEditors = await evidence.inspect(() => {
			const editors = [...document.querySelectorAll('.CodeMirror')] as Array<
				Element & { CodeMirror?: { getValue(): string } }
			>;
			return editors.map((editor) => editor.CodeMirror?.getValue() ?? '');
		});
		const reloadedVariables = reloadedEditors.find((value) => value.includes('flag'));
		if (
			!reloadedEditors.some((value) => value.includes('Inspect')) ||
			!reloadedVariables ||
			canonicalize(JSON.parse(reloadedVariables)) !== canonicalize({ flag: true })
		)
			throw new Error('GraphiQL Journey 1 reload query differs');
		await page.press(queryEditor, 'Control+Enter');
		await evidence.waitForExpression(
			`(() => { try { return JSON.parse(document.querySelector('.result-window .CodeMirror')?.CodeMirror?.getValue() ?? '')?.data?.id === 'abc123'; } catch { return false; } })()`,
		);
		await page.press(queryEditor, 'Meta+A');
		await page.type(queryEditor, '{ id }', { keyEvents: true });
		await page.press(queryEditor, 'Control+Enter');
		await evidence.waitForExpression(
			`(() => { try { const data = JSON.parse(document.querySelector('.result-window .CodeMirror')?.CodeMirror?.getValue() ?? '')?.data; return data?.id === 'abc123' && Object.keys(data).length === 1; } catch { return false; } })()`,
		);
		await page.click('.toolbar-button[title="Show History"]');
		await page.click('.history-contents .history-query:last-child');
		const historyQuery = await evidence.inspect(() => {
			const editor = document.querySelector('.query-editor .CodeMirror') as
				| (Element & { CodeMirror?: { getValue(): string } })
				| null;
			return editor?.CodeMirror?.getValue() ?? '';
		});
		if (!historyQuery.includes('Inspect'))
			throw new Error('GraphiQL Journey 2 history restoration differs');
		await page.click('.docExplorerShow');
		await context.expect.page.exists(page, '.doc-explorer');
		await page.click('.doc-category-item:first-child');
		const docsText = await evidence.inspect(
			() => document.querySelector('.doc-explorer')?.textContent ?? '',
		);
		if (
			!docsText.includes('id field from Test type.') ||
			!docsText.includes('Is this a test schema? Sure it is.')
		)
			throw new Error('GraphiQL Journey 2 Test documentation differs');
		const dimensions = async () =>
			await evidence.inspect(() => ({
				variableHeight:
					document.querySelector('.variable-editor')?.getBoundingClientRect().height ??
					-1,
				docsWidth:
					document.querySelector('.docExplorerWrap')?.getBoundingClientRect().width ?? -1,
				variableOpen:
					getComputedStyle(document.querySelector('.variable-editor') as Element)
						.display !== 'none',
				docsOpen:
					getComputedStyle(document.querySelector('.docExplorerWrap') as Element)
						.display !== 'none',
				historyOpen:
					getComputedStyle(document.querySelector('.historyPaneWrap') as Element)
						.display !== 'none',
			}));
		const beforeDimensions = await dimensions();
		await page.drag('.variable-editor-title', '.resultWrap');
		await page.drag('.docExplorerResizer', '.queryWrap');
		interactions.push(
			{ kind: 'click', selector: '.toolbar-button[title="Show History"]' },
			{ kind: 'click', selector: '.history-contents .history-query:last-child' },
			{ kind: 'click', selector: '.docExplorerShow' },
			{ kind: 'click', selector: '.doc-category-item:first-child' },
			{ kind: 'drag', selector: '.variable-editor-title->.resultWrap' },
			{ kind: 'drag', selector: '.docExplorerResizer->.queryWrap' },
		);
		const afterDimensions = await dimensions();
		if (
			afterDimensions.variableHeight === beforeDimensions.variableHeight ||
			afterDimensions.docsWidth === beforeDimensions.docsWidth ||
			!afterDimensions.variableOpen ||
			!afterDimensions.docsOpen ||
			!afterDimensions.historyOpen
		)
			throw new Error('GraphiQL Journey 2 drag dimensions differ');
		await page.reload();
		const reloadedDimensions = await dimensions();
		if (
			reloadedDimensions.variableHeight !== afterDimensions.variableHeight ||
			reloadedDimensions.docsWidth !== afterDimensions.docsWidth ||
			!reloadedDimensions.variableOpen ||
			!reloadedDimensions.docsOpen ||
			!reloadedDimensions.historyOpen
		)
			throw new Error('GraphiQL Journey 2 persisted dimensions differ');
		await context.expect.page.outcome(page, {
			events: {
				click: { atLeast: 6 },
				keydown: { atLeast: 20 },
				mousedown: { atLeast: 2 },
				mousemove: { atLeast: 2 },
				mouseup: { atLeast: 2 },
			},
		});
		await context.receipt.capture('graphiql-query-history-docs-drag-state');
	});
	let result: Awaited<ReturnType<typeof runBoxes>>;
	try {
		result = await runBoxes({
			root: laneRoot,
			boxes: [
				{
					file: join(laneRoot, 'versionless-graphiql.box.ts'),
					relativeFile: 'versionless-graphiql.box.ts',
					exportName: 'default',
					box: definition,
				},
			],
			receiptDir: join(workRoot, 'witness-receipts', lane, `${phase}-pass-${pass}`),
			assertionTimeoutMs: 10_000,
			fileSystem: witnessNodeFileSystem,
			browser: blockedBrowser(evidence),
			headless: true,
		});
	} finally {
		await server.close();
	}
	if (result.status !== 'passed') {
		const failure = result.boxes[0]?.error?.message ?? 'unknown';
		await Promise.all(evidence.pendingResponses);
		if (
			!isGraphiQLIsTestRed(failure) ||
			evidence.attemptedNonLoopback.length !== 0 ||
			evidence.successfulNonLoopback !== 0 ||
			evidence.failedRequests.length !== 0 ||
			evidence.serviceWorker.registrations !== 0 ||
			evidence.serviceWorker.controller !== null ||
			evidence.serviceWorker.cacheNames.length !== 0 ||
			evidence.pageErrors.length !== 0 ||
			evidence.consoleErrors.length !== 0
		)
			throw new Error('GraphiQL mutation-red locality or causal evidence differs');
		const error = new Error(
			isGraphiQLIsTestRed(failure) ? failure : `GraphiQL Witness journey failed: ${failure}`,
		) as Error & { witnessReceipt?: unknown };
		const redProjection = await normalizeGraphiQLWitnessReceipt(
			result.receiptPath,
			`${lane}-${phase}-${pass}`,
			'expected-red',
		);
		error.witnessReceipt = {
			...redProjection,
			applicationPosts: evidence.graphqlPosts
				.filter((post) => !post.body?.includes('IntrospectionQuery'))
				.map((post) => ({
					path: parseURL(post.url).pathname,
					method: post.method,
					body: post.body,
					status: post.status,
				})),
			locality: {
				attemptedNonLoopback: evidence.attemptedNonLoopback.length,
				successfulNonLoopback: evidence.successfulNonLoopback,
				failedRequests: evidence.failedRequests.length,
				serviceWorkerRegistrations: evidence.serviceWorker.registrations,
				controllers: evidence.serviceWorker.controller === null ? 0 : 1,
				caches: evidence.serviceWorker.cacheNames.length,
				pageErrors: evidence.pageErrors.length,
				consoleErrors: evidence.consoleErrors.length,
			},
		};
		throw error;
	}
	await Promise.all(evidence.pendingResponses);
	const applicationPosts = evidence.graphqlPosts.filter(
		(post) => !post.body?.includes('IntrospectionQuery'),
	);
	const expectedResponsePaths = [
		'/',
		'/graphiql.css',
		lane === 'baseline' ? '/graphiql.js' : '/graphiql-vite.js',
		'/vendor/es6-promise.auto.min.js',
		'/vendor/fetch.min.js',
		lane === 'baseline' ? '/vendor/react.min.js' : '/vendor/react-18.3.1.js',
		lane === 'baseline' ? '/vendor/react-dom.min.js' : '/vendor/react-dom-18.3.1.js',
		'/graphql',
	];
	if (
		applicationPosts.length !== 3 ||
		evidence.graphqlPosts.some((post) => {
			const body = post.body
				? (JSON.parse(post.body) as { query?: unknown; variables?: unknown })
				: null;
			return (
				parseURL(post.url).pathname !== '/graphql' ||
				!loopback(post.url) ||
				post.method !== 'POST' ||
				post.status !== 200 ||
				post.headers.cookie !== undefined ||
				post.headers.authorization !== undefined ||
				!body ||
				typeof body.query !== 'string' ||
				(!body.query.includes('IntrospectionQuery') &&
					body.query !== query &&
					body.query !== '{ id }') ||
				(body.query === query &&
					canonicalize(body.variables) !== canonicalize({ flag: true }))
			);
		}) ||
		evidence.successfulNonLoopback !== 0 ||
		evidence.attemptedNonLoopback.length !== 0 ||
		evidence.failedRequests.length !== 0 ||
		evidence.serviceWorker.registrations !== 0 ||
		evidence.serviceWorker.controller !== null ||
		evidence.serviceWorker.cacheNames.length !== 0 ||
		evidence.pageErrors.length !== 0 ||
		evidence.consoleErrors.length !== 0 ||
		evidence.completedRequests.some((requestValue) => requestValue.status !== 200) ||
		expectedResponsePaths.some(
			(path) =>
				!evidence.completedRequests.some(
					(requestValue) => requestValue.path === path && requestValue.status === 200,
				),
		)
	)
		throw new Error('GraphiQL browser locality, POST or error evidence differs');
	return {
		lane,
		pass: pass === 3 ? 2 : pass,
		result: 'pass',
		journey1: {
			query,
			variables,
			id: 'abc123',
			isTest: true,
			serializedBoolean: '{"boolean":true}',
			post: '/graphql',
			urlReload: true,
		},
		journey2: {
			historyRestore: true,
			docsQueryFields: true,
			realVariableDrag: true,
			realDocsDrag: true,
			reloadPersistence: true,
		},
		interactions,
		graphqlPosts: evidence.graphqlPosts.map((post) => ({
			path: parseURL(post.url).pathname,
			method: post.method,
			body: post.body,
			status: post.status,
		})),
		serviceWorker: evidence.serviceWorker,
		attemptedNonLoopback: evidence.attemptedNonLoopback,
		successfulNonLoopback: evidence.successfulNonLoopback,
		pageErrors: evidence.pageErrors,
		consoleErrors: evidence.consoleErrors,
		completedRequests: evidence.completedRequests,
		witness: await normalizeGraphiQLWitnessReceipt(
			result.receiptPath,
			`${lane}-${phase}-${pass}`,
			'pass',
		),
	};
}

async function publishEvidence(input: {
	ingest: Record<string, unknown>;
	build: Record<string, unknown>;
	witness: Record<string, unknown>;
	mutation: Record<string, unknown>;
}): Promise<string> {
	await mkdir(outputStage, { recursive: true });
	const linkedWitness = await verifyLinkedWitnessProvenance();
	const ingestIntegrity = input.ingest.integrity as Record<string, unknown>;
	const ingestReceiptDigest = String(ingestIntegrity.canonicalDigest);
	const witnessRuns = input.witness.runs as Array<Record<string, unknown>>;
	const mutationRestored = input.mutation.restoredRun as Record<string, unknown>;
	const supplemental = input.ingest.supplemental as Array<Record<string, unknown>>;
	const assets = input.ingest.assets as Array<Record<string, unknown>>;
	const dependencies = input.ingest.dependencies as Array<Record<string, unknown>>;
	const componentRows = new Map<string, Record<string, unknown>>();
	for (const row of [...dependencies, ...supplemental]) {
		const name = String(row.name);
		const version = String(row.version);
		const inspection = (row.inspection ?? row.metadata) as Record<string, unknown>;
		const license = inspection.license as Record<string, unknown> | undefined;
		const digest = String(row.sha256 ?? row.tarballSha256 ?? '');
		const ref = npmPurl(name, version);
		componentRows.set(`${name}@${version}`, {
			type: 'library',
			'bom-ref': ref,
			name,
			version,
			purl: ref,
			hashes: [{ alg: 'SHA-256', content: digest }],
			properties: [
				{ name: 'versionless:license-state', value: String(license?.state ?? 'unknown') },
				{
					name: 'versionless:license-declarations',
					value: canonicalize(license?.declarations ?? []),
				},
			],
		});
	}
	const components = [...componentRows.values()].sort((left, right) =>
		compare(String(left['bom-ref']), String(right['bom-ref'])),
	);
	const ingestProvenance = input.ingest.provenance as Record<string, unknown>;
	const applicationRef = 'pkg:npm/graphiql@0.13.0';
	const applicationComponent = {
		type: 'application',
		'bom-ref': applicationRef,
		name: 'graphiql',
		version: '0.13.0',
		purl: applicationRef,
		properties: [
			{ name: 'versionless:source-revision', value: String(ingestProvenance.revision) },
			{ name: 'versionless:source-tree', value: String(ingestProvenance.tree) },
			{
				name: 'versionless:source-archive-sha256',
				value: String(ingestProvenance.archiveSha256),
			},
		],
	};
	const sbom = {
		bomFormat: 'CycloneDX',
		specVersion: '1.7',
		version: 1,
		metadata: {
			component: applicationComponent,
			properties: [
				{ name: 'versionless:validation', value: 'local-profile' },
				{ name: 'versionless:topology', value: 'exact-transitive-topology-not-proven' },
			],
		},
		components,
		dependencies: [
			{ ref: applicationRef, dependsOn: components.map((component) => component['bom-ref']) },
			...components.map((component) => ({ ref: component['bom-ref'] })),
		],
	};
	const sourceLicense = {
		path: 'source/LICENSE',
		gitBlob: 'cd2262e3a31be829b623167928cce428ffe32733',
		sha256: '64b1e722d46dbbd0fd63deba6005774a5695b5255b28db067b758306854680eb',
	};
	const cdnLicenseLinks = assets.map((asset) => {
		const coordinate = `${String(asset.package)}@${String(asset.version)}`;
		const packageRow = supplemental.find(
			(row) => `${String(row.name)}@${String(row.version)}` === coordinate,
		);
		if (!packageRow) throw new Error('GraphiQL CDN license package join differs');
		const inspection = packageRow.inspection as Record<string, unknown>;
		return {
			coordinate,
			asset: { url: asset.url, sha256: asset.sha256 },
			package: {
				tarballSha256: packageRow.tarballSha256,
				license: inspection.license,
			},
		};
	});
	if (new Set(cdnLicenseLinks.map((row) => row.coordinate)).size !== 4)
		throw new Error('GraphiQL CDN license joins are duplicated');
	const documents: Array<readonly [string, string]> = [
		[
			'provenance.json',
			`${canonicalize({ source: input.ingest.provenance, linkedWitness, ingestReceiptDigest })}\n`,
		],
		[
			'dependencies.json',
			`${canonicalize({ ingestReceiptDigest, closure: input.ingest.closure, dependencies: input.ingest.dependencies })}\n`,
		],
		[
			'assets.json',
			`${canonicalize({ assets: input.ingest.assets, supplemental: input.ingest.supplemental })}\n`,
		],
		['sbom.json', `${canonicalize(sbom)}\n`],
		['licenses.json', `${canonicalize({ sourceLicense, cdnLicenseLinks })}\n`],
		[
			'policy.json',
			`${canonicalize({ lifecycleExecuted: false, nativeExecuted: false, react15TestStack: 'incompatible-not-tested', credentialMode: 'include', observedCookieHeaders: 0, observedAuthorizationHeaders: 0 })}\n`,
		],
		['build.json', `${canonicalize(input.build)}\n`],
		['witness.json', `${canonicalize(input.witness)}\n`],
		[
			'locality.json',
			`${canonicalize({ attemptedNonLoopback: 0, successfulNonLoopback: 0, failedRequests: 0, serviceWorkerRegistrations: 0, controllers: 0, caches: 0, pageErrors: 0, consoleErrors: 0 })}\n`,
		],
		[
			'privacy.json',
			`${canonicalize({ credentialMode: 'include', observedCookieHeaders: 0, observedAuthorizationHeaders: 0, customerData: false, paymentData: false, endpoint: 'synthetic loopback /graphql only', persistence: 'local synthetic IDE state only' })}\n`,
		],
		['mutation.json', `${canonicalize(input.mutation)}\n`],
		[
			'receipt.md',
			'# GraphiQL 0.13 migration candidate\n\nUncounted pending fresh Judge acceptance. This reproducibility evidence is not certification, signer authenticity, OS-wide isolation, or a legal/compliance opinion. No SLSA level is claimed.\n',
		],
	];
	for (const [index, run] of witnessRuns.entries())
		documents.push([
			`witness-${String(index + 1).padStart(2, '0')}.json`,
			`${canonicalize(run.witness)}\n`,
		]);
	documents.push(
		['witness-mutation-red.json', `${canonicalize(input.mutation.redWitnessReceipt)}\n`],
		['witness-restored.json', `${canonicalize(mutationRestored.witness)}\n`],
	);
	for (const [name, body] of documents) await writeFile(join(outputStage, name), body);
	const artifactFiles = await filesBelow(outputStage);
	const receipt = {
		schemaVersion: REACT_GRAPHIQL_013_SCHEMA,
		result: 'pass' as const,
		counted: false as const,
		artifacts: await Promise.all(
			artifactFiles.map(async (file) => ({
				path: `evidence/runs/react-graphiql-react15-to-vite8/${relative(outputStage, file)}`,
				sha256: sha256(await readFile(file)),
			})),
		),
		build: input.build,
		witness: input.witness,
		mutation: input.mutation,
		nonclaims: [
			'not certification',
			'not signer authenticity',
			'not OS-wide isolation',
			'uncounted pending Judge',
			'not legal or compliance opinion',
			'no SLSA level claimed',
			'React15-only enzyme-adapter-react-15 and react-test-renderer test stack is retained but incompatible/not-tested on the React18 browser target',
		],
		integrity: {
			algorithm: 'sha256' as const,
			authenticity: 'not-established' as const,
			canonicalDigest: '',
		},
	};
	receipt.integrity.canonicalDigest = sha256(canonicalize(receipt));
	parseReactGraphiQL013Receipt(receipt);
	await writeFile(join(outputStage, 'receipt.json'), `${canonicalize(receipt)}\n`);
	return receipt.integrity.canonicalDigest;
}

async function executeRun(): Promise<void> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('GraphiQL run requires strict offline mode');
	await verifyGraphiQLIngest();
	await verifyGraphiQLIngest();
	await bindTools();
	await mkdir(workRoot, { recursive: true });
	const ingest = JSON.parse(
		await readFile(join(cacheRoot, 'receipt.json'), 'utf8'),
	) as IngestReceipt;
	const baseline1 = await prepareLane('baseline-1', false, ingest);
	const baseline2 = await prepareLane('baseline-2', false, ingest);
	const target1 = await prepareLane('target-1', true, ingest);
	const target2 = await prepareLane('target-2', true, ingest);
	const baselineBuilds: [BuildInventory, BuildInventory] = [
		await buildBaseline(baseline1),
		await buildBaseline(baseline2),
	];
	const targetBuilds: [BuildInventory, BuildInventory] = [
		await buildTarget(target1),
		await buildTarget(target2),
	];
	if (
		canonicalize(baselineBuilds[0]) !== canonicalize(baselineBuilds[1]) ||
		canonicalize(targetBuilds[0]) !== canonicalize(targetBuilds[1])
	)
		throw new Error('GraphiQL build inventories are unstable');
	const buildOutputRoot = join(outputStage, 'build-output');
	await mkdir(buildOutputRoot, { recursive: true });
	for (const [name, source] of [
		['baseline-graphiql.js', join(baseline1, 'packages/graphiql/example/graphiql.js')],
		['baseline-graphiql.css', join(baseline1, 'packages/graphiql/example/graphiql.css')],
		['target-graphiql-vite.js', join(target1, 'packages/graphiql/example/graphiql-vite.js')],
		['target-graphiql.css', join(target1, 'packages/graphiql/example/graphiql.css')],
	] as const)
		await cp(source, join(buildOutputRoot, name));
	const runs = [
		await witnessJourney(baseline1, 'baseline', 1),
		await witnessJourney(baseline2, 'baseline', 2),
		await witnessJourney(target1, 'target', 1),
		await witnessJourney(target2, 'target', 2),
	];
	if (
		graphIQLWitnessBehaviorCore(runs[0]!) !== graphIQLWitnessBehaviorCore(runs[1]!) ||
		graphIQLWitnessBehaviorCore(runs[2]!) !== graphIQLWitnessBehaviorCore(runs[3]!)
	)
		throw new Error('GraphiQL normalized repeated Witness behavior differs');
	const schemaPath = join(target2, 'packages/graphiql/example/schema.js');
	const original = await readFile(schemaPath);
	const mutationPlan = mutateGraphiQLIsTest({ schemaBytes: original });
	let red = false;
	let mutatedBuildDigest = '';
	let restoredBuildDigest = '';
	let restoredRun: Record<string, unknown> | null = null;
	let redWitnessReceipt: unknown = null;
	try {
		await writeFile(schemaPath, mutationPlan.code);
		mutatedBuildDigest = (await buildTarget(target2)).digest;
		await witnessJourney(target2, 'target', 3, 'mutation-red').catch((error: unknown) => {
			if (error instanceof Error && isGraphiQLIsTestRed(error.message)) {
				red = true;
				redWitnessReceipt =
					(error as Error & { witnessReceipt?: unknown }).witnessReceipt ?? null;
				return;
			}
			throw error;
		});
	} finally {
		await writeFile(schemaPath, original);
		restoredBuildDigest = (await buildTarget(target2)).digest;
	}
	if (
		!red ||
		!redWitnessReceipt ||
		mutatedBuildDigest === targetBuilds[1].digest ||
		restoredBuildDigest !== targetBuilds[1].digest
	)
		throw new Error('GraphiQL mutation red or byte/build restoration differs');
	restoredRun = await witnessJourney(target2, 'target', 3, 'restored');
	const build = {
		baseline: {
			runtime: '16.20.2' as const,
			bundler: 'browserify-16.2.3' as const,
			digests: [baselineBuilds[0].digest, baselineBuilds[1].digest] as [string, string],
			inventories: [baselineBuilds[0].files, baselineBuilds[1].files],
		},
		target: {
			runtime: '24.15.0' as const,
			bundler: 'vite-8.0.16' as const,
			digests: [targetBuilds[0].digest, targetBuilds[1].digest] as [string, string],
			inventories: [targetBuilds[0].files, targetBuilds[1].files],
		},
		tools: {
			yarnBin: '148e19db309ec9eaf7720b28df811337906eea8a1758deaa54afee60a6305e04',
			yarnCli: '443ed69e76443b89afddccfc9faec1ff16eb5e500979cc079c696dec4c3d94ee',
			yarnManifest: '9533b84eaaeea708ab99bcf92772bc81c7389f90a04f8b0188c163f9b3b621c3',
			viteBin: 'fa03478846d229651a3c6aa64833ba2c6cbf580a798b92bd8f47c7480bafb5d8',
			viteManifest: 'a2b943431b51bfcc2e9386eecf8b4b3f6e4bf443e56d17b1f4c8495a61b4050c',
			pnpmLock: 'ae8c76d3483d5dcd72428ba3a0b9eb0b1731724c14f6f0893ac20972cea5e66a',
			node16: '83325958463d59cb0b16433eefab0a03fd1ce7d565a27e0274f507b1f3839a6e',
			node24: '3200fbd9f7fd4410426dd541e10d1ab829d3472f270d743c7fabd1696c03fe32',
			chromium: 'a46b3b1e63163fa2d2437fb6ae967cb5a73b50050bca32f1964e6129b6228244',
		},
	};
	const witness = {
		directLinkedWitness: true as const,
		runs,
		successfulNonLoopback: 0 as const,
		serviceWorkerRegistrations: 0 as const,
		serviceWorkerControllers: 0,
		serviceWorkerCaches: 0,
		pageErrors: [],
		consoleErrors: [],
	};
	const mutation = {
		red: true as const,
		redReason: 'graphiql-isTest-true-red' as const,
		exactFailure: 'expected GraphiQL result isTest true, but it was false',
		green: true as const,
		mutatedBuildDigest,
		redWitnessReceipt,
		restoredRun,
		originalSourceSha256: mutationPlan.sourceSha256,
		restoredSourceSha256: sha256(await readFile(schemaPath)),
		originalBuildDigest: targetBuilds[1].digest,
		restoredBuildDigest,
	};
	const digest = await publishEvidence({ ingest, build, witness, mutation });
	const aggregateBackup = await readFile(aggregatePath);
	const aggregate = JSON.parse(aggregateBackup.toString('utf8')) as {
		fixtures?: Array<Record<string, unknown>>;
	};
	const member = reactGraphiQL013AggregateMember(digest);
	aggregate.fixtures = [
		...(aggregate.fixtures ?? []).filter((value) => value.id !== member.id),
		member,
	];
	const trustBackup = join(workRoot, 'trust-current-backup');
	const replayBackup = join(workRoot, 'trust-replay-backup');
	const stagedCurrent = join(publicationStage, 'trust-current');
	const stagedReplay = join(publicationStage, 'trust-replay');
	const observedAt = new Date().toISOString();
	await runGraphiQLAtomicPublication({
		snapshot: async () => {
			const current = await exists(trustCurrent);
			const replay = await exists(trustReplay);
			if (current) await cp(trustCurrent, trustBackup, { recursive: true });
			if (replay) await cp(trustReplay, replayBackup, { recursive: true });
			return { current, replay };
		},
		publish: async () => {
			await mkdir(publicationStage, { recursive: true });
			await rename(outputStage, outputRoot);
			await writeFile(aggregatePath, `${canonicalize(aggregate)}\n`);
			await analyzeCorpusConformance({ rootDir: root });
			for (const outputDir of [stagedCurrent, stagedReplay])
				await generateTrustPackage({
					rootDir: root,
					policyPath: 'trust/policy.json',
					outputDir,
					offline: true,
					environment: { ...process.env, VERSIONLESS_NETWORK_MODE: 'offline' },
					observedAt,
				});
		},
		verify: async () => {
			await verifyReactGraphiQL013Evidence(root);
			await analyzeCorpusConformance({ rootDir: root });
			await verifyTrustPackage({
				rootDir: root,
				outputDir: stagedReplay,
				compareDir: stagedCurrent,
				environment: { ...process.env, VERSIONLESS_NETWORK_MODE: 'offline' },
				now: observedAt,
			});
		},
		commit: async () => {
			await rm(trustCurrent, { recursive: true, force: true });
			await rename(stagedCurrent, trustCurrent);
			await rm(trustReplay, { recursive: true, force: true });
			await rename(stagedReplay, trustReplay);
			await rm(publicationStage, { recursive: true, force: true });
		},
		restore: async (snapshot) => {
			await rm(outputRoot, { recursive: true, force: true });
			await rm(outputStage, { recursive: true, force: true });
			await writeFile(aggregatePath, aggregateBackup);
			await rm(trustCurrent, { recursive: true, force: true });
			if (snapshot.current) await cp(trustBackup, trustCurrent, { recursive: true });
			await rm(trustReplay, { recursive: true, force: true });
			if (snapshot.replay) await cp(replayBackup, trustReplay, { recursive: true });
			await rm(publicationStage, { recursive: true, force: true });
		},
	});
}

export async function runReactGraphiQL013(): Promise<void> {
	for (const path of [workRoot, outputRoot, outputStage, publicationStage])
		if (await exists(path)) throw new Error('GraphiQL run requires fresh roots');
	try {
		await executeRun();
	} catch (error) {
		const terminalStage = join(workRoot, 'terminal-evidence');
		await rm(terminalStage, { recursive: true, force: true });
		await mkdir(terminalStage, { recursive: true });
		const captureSource = (await exists(join(outputStage, 'captures')))
			? join(outputStage, 'captures')
			: (await exists(join(outputRoot, 'captures')))
				? join(outputRoot, 'captures')
				: null;
		if (captureSource)
			await cp(captureSource, join(terminalStage, 'captures'), { recursive: true });
		await rm(outputRoot, { recursive: true, force: true });
		await rm(publicationStage, { recursive: true, force: true });
		await mkdir(outputRoot, { recursive: true });
		if (await exists(join(terminalStage, 'captures')))
			await rename(join(terminalStage, 'captures'), join(outputRoot, 'captures'));
		const captureArtifacts = (await exists(join(outputRoot, 'captures')))
			? await Promise.all(
					(await filesBelow(join(outputRoot, 'captures'))).map(async (file) => ({
						path: `evidence/runs/react-graphiql-react15-to-vite8/${relative(outputRoot, file)}`,
						sha256: sha256(await readFile(file)),
					})),
				)
			: [];
		const terminal = {
			schemaVersion: 'versionless.react-graphiql-013-run-terminal.v1',
			result: 'terminal-exclusion',
			counted: false,
			retry: false,
			failure:
				error instanceof Error && error.message.includes('Witness')
					? 'browser-boundary-failed'
					: 'production-vertical-boundary-failed',
			artifacts: captureArtifacts,
			integrity: { algorithm: 'sha256', canonicalDigest: '' },
		};
		terminal.integrity.canonicalDigest = sha256(canonicalize(terminal));
		await writeFile(join(outputRoot, 'terminal-exclusion.json'), `${canonicalize(terminal)}\n`);
		await rm(outputStage, { recursive: true, force: true });
		throw error;
	}
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	if (args.length !== 1 || args[0] !== '--run')
		throw new Error('GraphiQL run requires exact --run argument');
	await runReactGraphiQL013();
	process.stdout.write(`${canonicalize({ result: 'pass', counted: false })}\n`);
}

if (basename(process.argv[1] ?? '') === 'react-graphiql-013-run.ts')
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
