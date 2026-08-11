import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { chromium } from 'playwright';
import { joinURL, parseHost, parseURL } from 'ufo';
import {
	craEntryDocument,
	craNodeGlobalsModuleId,
} from '../../../frameworks/react/src/react-cra-vite-adapter.ts';

/**
 * Fixture-scoped orchestration for the HospitalRun create-react-app to Vite 8
 * lane: it regenerates the entry document, builds the target lane twice, and
 * proves the built lane boots in a browser. Every capability it exercises is
 * generic and lives in @versionless/react; only the paths and the environment
 * are application knowledge and they live here.
 */

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');
const targetRoot = path.join(repositoryRoot, '.versionless/work/react-hospitalrun/target');
const viteConfig = path.join(repositoryRoot, 'fixtures/react-hospitalrun/vite.config.ts');
const viteBinary = path.join(repositoryRoot, 'node_modules/.bin/vite');

const craEnvironment = { NODE_ENV: 'production', PUBLIC_URL: '' } as const;

const sha256 = (value: Buffer | string): string =>
	createHash('sha256').update(value).digest('hex');

export function canonical(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
	if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
	const record = value as Record<string, unknown>;
	return `{${Object.keys(record)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
		.join(',')}}`;
}

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

async function run(command: string, args: readonly string[], cwd: string): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const child = spawn(command, [...args], {
			cwd,
			stdio: ['ignore', 'pipe', 'pipe'],
			env: { ...process.env, npm_config_offline: 'true', VERSIONLESS_NETWORK_MODE: 'offline' },
		});
		const errors: string[] = [];
		child.stderr.on('data', (chunk: Buffer) => errors.push(chunk.toString('utf8')));
		child.stdout.on('data', () => undefined);
		child.on('error', reject);
		child.on('close', (code) =>
			code === 0 ? resolve() : reject(new Error(`${command} exited ${code}: ${errors.join('')}`)),
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
 * recompute the digest from the record alone.
 */
export async function laneInventory(directory: string): Promise<LaneInventory> {
	const files: LaneFile[] = [];
	for (const file of await filesBelow(directory))
		files.push({
			path: path.relative(directory, file).split(path.sep).join('/'),
			sha256: sha256(await readFile(file)),
		});
	files.sort((left, right) => (left.path === right.path ? 0 : left.path < right.path ? -1 : 1));
	return { digest: sha256(canonical(files)), files };
}

/** Build the target lane once into its own output directory. */
export async function buildTargetLane(outDirectory: string, root = targetRoot): Promise<LaneInventory> {
	const absolute = path.join(root, outDirectory);
	await rm(absolute, { recursive: true, force: true });
	await run(viteBinary, ['build', '--config', viteConfig, '--outDir', absolute], root);
	return laneInventory(absolute);
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
			if (!loopback.includes(host) && response.ok()) successfulNonLoopback.push(response.url());
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

export type TargetLaneRun = Readonly<{
	entryDocumentSha256: string;
	first: LaneInventory;
	second: LaneInventory;
	equal: boolean;
	boot: BootObservation;
}>;

/** Regenerate the entry document, build the target lane twice, then boot it. */
export async function runHospitalRunTargetLane(root = targetRoot): Promise<TargetLaneRun> {
	const document = await writeHospitalRunEntryDocument(root);
	const first = await buildTargetLane('build-vite-run1', root);
	const second = await buildTargetLane('build-vite-run2', root);
	const boot = await observeBoot(path.join(root, 'build-vite-run1'));
	return {
		entryDocumentSha256: sha256(document),
		first,
		second,
		equal: first.digest === second.digest,
		boot,
	};
}

/** Inventory an already-built lane, for the baseline built by its own toolchain. */
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
