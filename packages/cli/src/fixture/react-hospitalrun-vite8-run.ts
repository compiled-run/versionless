import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { chromium } from 'playwright';
import { joinURL, parseHost, parseURL } from 'ufo';
import { canonicalize } from '../../../core/src/receipts/canonicalize.ts';
import {
	craEntryDocument,
	craNodeGlobalsModuleId,
} from '../../../frameworks/react/src/react-cra-vite-adapter.ts';

/**
 * Fixture-scoped orchestration for the HospitalRun create-react-app to Vite 8
 * lanes: it regenerates the entry document, builds the era-pinned webpack
 * baseline twice in its own runtime cell, builds the Vite target twice on the
 * maintained runtime, and proves each built lane boots in a browser. Every
 * capability it exercises is generic and lives in @versionless/react; only the
 * paths, the runtime cell and the environment are application knowledge and
 * they live here.
 */

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');
const targetRoot = path.join(repositoryRoot, '.versionless/work/react-hospitalrun/target');
const baselineRoot = path.join(repositoryRoot, '.versionless/work/react-hospitalrun/baseline');
const viteConfig = path.join(repositoryRoot, 'fixtures/react-hospitalrun/vite.config.ts');
const viteBinary = path.join(repositoryRoot, 'node_modules/.bin/vite');

/**
 * The era runtime cell: the Node 12.14.1 darwin-x64 build the ingest already
 * acquired and digest-verified, run under Rosetta 2. It is the runtime the
 * baseline's own toolchain needs, and it is never used for the target lane.
 */
const eraRuntimeRoot = path.join(
	repositoryRoot,
	'.versionless/cache/react-mycrypto-runtime/node-v12.14.1-darwin-x64',
);
const eraNodeBinary = path.join(eraRuntimeRoot, 'bin/node');
const eraNpmCli = path.join(eraRuntimeRoot, 'lib/node_modules/npm/bin/npm-cli.js');

/** The report the fixture's Vite config writes for the implicit-global capability. */
const implicitGlobalsReport = path.join(targetRoot, 'implicit-globals.json');

const craEnvironment = { NODE_ENV: 'production', PUBLIC_URL: '' } as const;

const sha256 = (value: Buffer | string): string => createHash('sha256').update(value).digest('hex');

/**
 * The digest scheme every lane inventory in this fixture uses, stated so a
 * reader can recompute it from the recorded file list alone.
 */
export const laneDigestScheme = 'sha256(canonicalize(files))';

/**
 * Regenerate the Vite entry document from the immutable create-react-app
 * template. The bootstrap module carries webpack's injected `process`, `Buffer`
 * and `setImmediate` bindings and is evaluated before the application entry.
 */
export async function writeHospitalRunEntryDocument(root = targetRoot): Promise<string> {
	const template = await readFile(path.join(root, 'public/index.html'), 'utf8');
	const document = craEntryDocument({
		template,
		entryModule: '/src/index.tsx',
		environment: craEnvironment,
		bootstrapModules: [craNodeGlobalsModuleId],
	});
	await writeFile(path.join(root, 'index.html'), document);
	return document;
}

async function run(
	command: string,
	args: readonly string[],
	cwd: string,
	environment: Readonly<Record<string, string>> = {},
): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const child = spawn(command, [...args], {
			cwd,
			stdio: ['ignore', 'pipe', 'pipe'],
			env: {
				...process.env,
				npm_config_offline: 'true',
				VERSIONLESS_NETWORK_MODE: 'offline',
				...environment,
			},
		});
		const errors: string[] = [];
		child.stderr.on('data', (chunk: Buffer) => errors.push(chunk.toString('utf8')));
		child.stdout.on('data', () => undefined);
		child.on('error', reject);
		child.on('close', (code) =>
			code === 0
				? resolve()
				: reject(new Error(`${command} exited ${code}: ${errors.join('')}`)),
		);
	});
}

export type LaneFile = Readonly<{ path: string; sha256: string }>;
export type LaneInventory = Readonly<{ digest: string; files: readonly LaneFile[] }>;

async function filesBelow(directory: string): Promise<string[]> {
	const found: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const item = path.join(directory, entry.name);
		if (entry.isDirectory()) found.push(...(await filesBelow(item)));
		else if (entry.isFile()) found.push(item);
	}
	return found;
}

/**
 * The lane inventory and its digest, under the reproducible scheme this corpus
 * uses elsewhere: sha256 over the canonicalized file list, so any reader can
 * recompute the digest from the record alone. The canonicalizer is the one the
 * receipt layer signs with, imported rather than re-implemented.
 */
export async function laneInventory(directory: string): Promise<LaneInventory> {
	const files: LaneFile[] = [];
	for (const file of await filesBelow(directory))
		files.push({
			path: path.relative(directory, file).split(path.sep).join('/'),
			sha256: sha256(await readFile(file)),
		});
	files.sort((left, right) => (left.path === right.path ? 0 : left.path < right.path ? -1 : 1));
	return { digest: sha256(canonicalize(files)), files };
}

/** Build the target lane once into its own output directory. */
export async function buildTargetLane(
	outDirectory: string,
	root = targetRoot,
): Promise<LaneInventory> {
	const absolute = path.join(root, outDirectory);
	await rm(absolute, { recursive: true, force: true });
	await run(viteBinary, ['build', '--config', viteConfig, '--outDir', absolute], root);
	return laneInventory(absolute);
}

/**
 * Build the era-pinned baseline once with its own toolchain. `react-scripts
 * build` always writes to `build/`, so the output is moved into the run's own
 * directory afterwards. `CI` is forced empty rather than inherited, because
 * create-react-app 3 promotes warnings to errors when it is set and the lane
 * must not depend on the host's shell.
 */
export async function buildBaselineLane(
	outDirectory: string,
	root = baselineRoot,
): Promise<LaneInventory> {
	const staging = path.join(root, 'build');
	const absolute = path.join(root, outDirectory);
	await rm(staging, { recursive: true, force: true });
	await rm(absolute, { recursive: true, force: true });
	await run(eraNodeBinary, [eraNpmCli, 'run', 'build'], root, {
		CI: '',
		PATH: `${path.join(eraRuntimeRoot, 'bin')}:${process.env.PATH ?? ''}`,
	});
	await rename(staging, absolute);
	return laneInventory(absolute);
}

export type CraImplicitGlobalReportEntry = Readonly<{
	module: string;
	names: readonly string[];
}>;

/**
 * The dependency modules that needed webpack 4's sloppy-mode CommonJS wrapper,
 * as the Vite build observed them. Paths are relative to the work area, so the
 * record carries no host-specific absolute path.
 */
export async function readImplicitGlobalReport(): Promise<readonly CraImplicitGlobalReportEntry[]> {
	return JSON.parse(
		await readFile(implicitGlobalsReport, 'utf8'),
	) as CraImplicitGlobalReportEntry[];
}

const mimeTypes: Readonly<Record<string, string>> = Object.freeze({
	'.css': 'text/css',
	'.html': 'text/html',
	'.ico': 'image/x-icon',
	'.js': 'text/javascript',
	'.json': 'application/json',
	'.map': 'application/json',
	'.png': 'image/png',
	'.txt': 'text/plain',
});

export type BootObservation = Readonly<{
	result: 'boot' | 'no-boot';
	rootElementBytes: number;
	consoleErrors: readonly string[];
	pageErrors: readonly string[];
	failedRequests: readonly string[];
	successfulNonLoopback: readonly string[];
	documentTitle: string;
	headingText: string;
}>;

/**
 * Serve a built lane from loopback and observe whether it boots: `#root` must
 * render non-empty and the page must raise no console or page error. Every
 * non-loopback request is refused, so nothing observed here can depend on a
 * network the evidence does not record.
 */
export async function observeBoot(directory: string): Promise<BootObservation> {
	const server = createServer((request, response) => {
		void (async () => {
			const pathname = parseURL(request.url ?? '/').pathname || '/';
			let file = path.join(directory, pathname);
			let body: Buffer;
			try {
				body = await readFile(file);
			} catch {
				file = path.join(directory, 'index.html');
				body = await readFile(file);
			}
			response.writeHead(200, {
				'content-type': mimeTypes[path.extname(file)] ?? 'application/octet-stream',
			});
			response.end(body);
		})();
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	const port = typeof address === 'object' && address !== null ? address.port : 0;
	const origin = `http://127.0.0.1:${port}`;
	const browser = await chromium.launch();
	const consoleErrors: string[] = [];
	const pageErrors: string[] = [];
	const failedRequests: string[] = [];
	const successfulNonLoopback: string[] = [];
	const loopback = ['127.0.0.1', 'localhost', '::1'];
	try {
		const context = await browser.newContext();
		await context.route('**/*', async (route) => {
			const host = parseHost(parseURL(route.request().url()).host ?? '').hostname;
			if (loopback.includes(host)) await route.continue();
			else await route.fulfill({ status: 204, body: '' });
		});
		const page = await context.newPage();
		page.on('console', (message) => {
			if (message.type() === 'error') consoleErrors.push(message.text());
		});
		page.on('pageerror', (error) => pageErrors.push(error.message));
		page.on('requestfailed', (request) =>
			failedRequests.push(`${request.url()} :: ${request.failure()?.errorText ?? 'unknown'}`),
		);
		page.on('response', (response) => {
			const host = parseHost(parseURL(response.url()).host ?? '').hostname;
			if (!loopback.includes(host) && response.ok())
				successfulNonLoopback.push(response.url());
		});
		await page.goto(joinURL(origin, '/'), { waitUntil: 'networkidle' });
		await page.locator('#root *').first().waitFor({ timeout: 30_000 });
		const rootElementBytes = await page.evaluate(
			() => document.querySelector('#root')?.innerHTML.length ?? 0,
		);
		const documentTitle = await page.title();
		const headingText = (await page.locator('h1, h2, h3').first().textContent()) ?? '';
		await context.close();
		return {
			result: rootElementBytes > 0 ? 'boot' : 'no-boot',
			rootElementBytes,
			consoleErrors,
			pageErrors,
			failedRequests,
			successfulNonLoopback,
			documentTitle,
			headingText: headingText.trim(),
		};
	} finally {
		await browser.close();
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
}

/**
 * The console errors a booting lane of this application is allowed to raise,
 * keyed by the kind of break they are. The webpack baseline registers the
 * create-react-app service worker from `src/index.tsx`; that worker's own
 * script fails to evaluate under the offline loopback host, and the failure is
 * reported here rather than resolved. The Vite target emits no service worker
 * at all, so it raises none of these.
 */
export const knownConsoleErrorInventory: Readonly<Record<string, string>> = Object.freeze({
	'service-worker-registration': 'Error during service worker registration:',
});

export type ConsoleErrorClassification = Readonly<{
	known: Readonly<Record<string, number>>;
	unexpected: readonly string[];
}>;

/**
 * Sort observed console errors into the known inventory and everything else.
 * Only the kind and the count are kept for the known ones: their text carries
 * the loopback server's ephemeral port, which would make the evidence differ
 * between otherwise identical runs.
 */
export function classifyConsoleErrors(errors: readonly string[]): ConsoleErrorClassification {
	const known: Record<string, number> = {};
	const unexpected: string[] = [];
	for (const error of errors) {
		const kind = Object.keys(knownConsoleErrorInventory)
			.sort()
			.find((candidate) => error.includes(knownConsoleErrorInventory[candidate] as string));
		if (kind === undefined) unexpected.push(error);
		else known[kind] = (known[kind] ?? 0) + 1;
	}
	return { known, unexpected };
}

/**
 * A boot is only proven when the application actually rendered and the page
 * raised nothing beyond the known inventory: no page error, no unexpected
 * console error, no failed request, and no successful request off loopback.
 */
export function bootIsClean(observation: BootObservation): boolean {
	return (
		observation.result === 'boot' &&
		observation.pageErrors.length === 0 &&
		classifyConsoleErrors(observation.consoleErrors).unexpected.length === 0 &&
		observation.failedRequests.length === 0 &&
		observation.successfulNonLoopback.length === 0
	);
}

export type LaneRun = Readonly<{
	first: LaneInventory;
	second: LaneInventory;
	equal: boolean;
	boot: BootObservation;
	consoleErrors: ConsoleErrorClassification;
	booted: boolean;
}>;

export type TargetLaneRun = LaneRun &
	Readonly<{
		entryDocumentSha256: string;
		implicitGlobals: readonly CraImplicitGlobalReportEntry[];
	}>;

/** Regenerate the entry document, build the target lane twice, then boot it. */
export async function runHospitalRunTargetLane(root = targetRoot): Promise<TargetLaneRun> {
	const document = await writeHospitalRunEntryDocument(root);
	const first = await buildTargetLane('build-vite-run1', root);
	const second = await buildTargetLane('build-vite-run2', root);
	const boot = await observeBoot(path.join(root, 'build-vite-run1'));
	return {
		entryDocumentSha256: sha256(document),
		implicitGlobals: await readImplicitGlobalReport(),
		first,
		second,
		equal: first.digest === second.digest,
		boot,
		consoleErrors: classifyConsoleErrors(boot.consoleErrors),
		booted: bootIsClean(boot),
	};
}

/** Build the era-pinned baseline lane twice in its own runtime cell, then boot it. */
export async function runHospitalRunBaselineLane(root = baselineRoot): Promise<LaneRun> {
	const first = await buildBaselineLane('build-run1', root);
	const second = await buildBaselineLane('build-run2', root);
	const boot = await observeBoot(path.join(root, 'build-run1'));
	return {
		first,
		second,
		equal: first.digest === second.digest,
		boot,
		consoleErrors: classifyConsoleErrors(boot.consoleErrors),
		booted: bootIsClean(boot),
	};
}

export type HospitalRunLanes = Readonly<{ baseline: LaneRun; target: TargetLaneRun }>;

/** Both lanes, each built twice and each booted. */
export async function runHospitalRunLanes(): Promise<HospitalRunLanes> {
	return {
		baseline: await runHospitalRunBaselineLane(),
		target: await runHospitalRunTargetLane(),
	};
}

/** Inventory an already-built lane, for a lane built outside this orchestration. */
export async function readBuiltLane(directory: string): Promise<LaneInventory> {
	return laneInventory(directory);
}

/** Write an observation document into the run evidence directory. */
export async function writeRunObservation(name: string, value: unknown): Promise<string> {
	const directory = path.join(repositoryRoot, 'evidence/runs/react-hospitalrun');
	await mkdir(directory, { recursive: true });
	const file = path.join(directory, name);
	await writeFile(file, `${JSON.stringify(value, null, '\t')}\n`);
	return file;
}
