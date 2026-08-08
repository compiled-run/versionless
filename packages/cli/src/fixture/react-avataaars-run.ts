import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import {
	access,
	mkdir,
	readFile,
	readdir,
	readlink,
	rename,
	rm,
	stat,
	writeFile,
} from 'node:fs/promises';
import * as path from 'pathe';
import { chromium, type Browser, type Page } from 'playwright';
import { parseURL } from 'ufo';
import { canonicalize, sha256 } from '../../../core/src/index.ts';
import { transformReactClassLifecycleToHooks } from '../../../frameworks/react/src/index.ts';

const root = path.resolve(import.meta.dirname, '../../../..');
const archive = path.join(
	root,
	'.versionless/cache/tier-f/react-avataaars/4863a1304b659f1105f69d8ae0c715428c41d2d64b43edfd701148ddfca900da/source.tar.gz',
);
const closureRoot = path.join(
	root,
	'.versionless/cache/react-avataaars-dependencies/d53edb62306b30bc2888ebb06c028f4b1452df9e39819c4d98f00857655f5156',
);
const closureFile = path.join(closureRoot, 'closure.json');
const dependencyReceipt = path.join(
	root,
	'evidence/dependencies/react-avataaars/dependency-receipt.json',
);
const t230Failure = path.join(
	root,
	'.versionless/cache/react-avataaars-dependencies/offline-failures/t230-legacy-build.json',
);
const work = path.join(root, '.versionless/work/react-avataaars/vite8-target-only');
const output = path.join(root, 'evidence/runs/react-avataaars-vite8-target-only');
const stage = `${output}.stage`;
const node16 = path.join(root, '.versionless/cache/angular-phonecat/node16/bin/node');
const yarn = path.join(
	process.env.COREPACK_HOME ?? path.join(process.env.HOME ?? '', '.cache/node/corepack'),
	'v1/yarn/1.22.22/bin/yarn.js',
);
const vite = path.join(root, 'node_modules/vite/bin/vite.js');
const viteConfig = path.join(root, 'packages/cli/src/fixture/react-avataaars-vite8.config.ts');
const chromiumExecutable = path.join(
	root,
	'.versionless/cache/react-boilerplate-v4/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell',
);
const toolTarball = path.join(
	closureRoot,
	'tarballs/ad87c3d275846a8a56ea0eb42d84634ebeb685bb25b8992ae47624aef9a7de9d.tgz',
);

function canonical(value: unknown): string {
	return `${canonicalize(value)}\n`;
}

function exists(file: string): Promise<boolean> {
	return access(file).then(
		() => true,
		() => false,
	);
}

async function execute(
	command: string,
	args: readonly string[],
	cwd = root,
	env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
	return await new Promise((resolve, reject) => {
		const child = spawn(command, [...args], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		child.stdout.on('data', (value: Buffer) => stdout.push(value));
		child.stderr.on('data', (value: Buffer) => stderr.push(value));
		child.once('error', reject);
		child.once('exit', (code) =>
			code === 0
				? resolve(Buffer.concat(stdout).toString('utf8'))
				: reject(
						new Error(
							`${path.basename(command)} exited ${code}: ${Buffer.concat(stderr)}`,
						),
					),
		);
	});
}

async function tarFile(source: string, file: string): Promise<Buffer> {
	const output = await new Promise<Buffer>((resolve, reject) => {
		const child = spawn('/usr/bin/tar', ['-xOf', source, file], {
			cwd: root,
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		child.stdout.on('data', (value: Buffer) => stdout.push(value));
		child.stderr.on('data', (value: Buffer) => stderr.push(value));
		child.once('error', reject);
		child.once('exit', (code) =>
			code === 0
				? resolve(Buffer.concat(stdout))
				: reject(new Error(Buffer.concat(stderr).toString('utf8'))),
		);
	});
	return output;
}

async function immutableClassification() {
	const prefix = 'avataaars-generator-c191c6c2d27f41245e803912d43c7213436a34d3/';
	const packageBytes = await tarFile(archive, `${prefix}package.json`);
	const packageJson = JSON.parse(packageBytes.toString('utf8')) as {
		scripts?: { build?: unknown };
	};
	const raw = {
		packageJson: sha256(packageBytes),
		tsconfig: sha256(await tarFile(archive, `${prefix}tsconfig.json`)),
		tsconfigTest: sha256(await tarFile(archive, `${prefix}tsconfig.test.json`)),
		gitignore: sha256(await tarFile(archive, `${prefix}.gitignore`)),
	};
	if (
		raw.packageJson !== 'ab38720b2b8fe9529a49040d6d20fe23627d0cdf2699195bf9f2eaf58b5d0b18' ||
		raw.tsconfig !== '731f648ce3b5d6a9796f5899508939fa9e2c9086f6507168e9d537e7f76eb3ef' ||
		raw.tsconfigTest !== 'fdc5d9ffac1fa7c458b9d4a4bb777724cd1a442dbcf6b1cbf899128575c5042f' ||
		raw.gitignore !== 'f5fd985d5e5beb0079293a92d88701b6a78aac7d6290084ffc689dc06b06bb1a' ||
		packageJson.scripts?.build !== 'react-scripts-ts build'
	)
		throw new Error('Avataaars immutable legacy classification differs');
	const listing = await execute('/usr/bin/tar', ['-tzf', archive]);
	const tsconfigs = listing
		.split('\n')
		.filter((name) => name.startsWith(prefix) && path.basename(name).startsWith('tsconfig'));
	if (tsconfigs.length !== 2 || tsconfigs.some((name) => name.endsWith('tsconfig.prod.json')))
		throw new Error('Avataaars immutable tsconfig inventory differs');
	const toolFiles = {
		readme: await tarFile(toolTarball, 'package/README.md'),
		paths: await tarFile(toolTarball, 'package/config/paths.js'),
		webpack: await tarFile(toolTarball, 'package/config/webpack.config.prod.js'),
		template: await tarFile(toolTarball, 'package/template/tsconfig.prod.json'),
	};
	const hashes = {
		readme: sha256(toolFiles.readme),
		paths: sha256(toolFiles.paths),
		webpack: sha256(toolFiles.webpack),
		template: sha256(toolFiles.template),
	};
	if (
		hashes.readme !== '5d5f1435b9926e2e453dbe434133082ccdcb2d09c596fa9c6ccf394225f158bd' ||
		hashes.paths !== 'adc5d9df76b22edd591d537d9c8cc4d51eb038a8a8c41de9b513edbb8d552773' ||
		hashes.webpack !== 'eafd0cf4ed401071fcdc4cc2debc2b2131008c67215247aac5553ae9949ba557' ||
		hashes.template !== 'ec5f058d32e5234028d56467b0c9368cedf45d5e8dbe79f43e290a9e3d4487b8'
	)
		throw new Error('Avataaars pinned legacy tool evidence differs');
	const readme = toolFiles.readme.toString('utf8');
	const paths = toolFiles.paths.toString('utf8');
	const webpack = toolFiles.webpack.toString('utf8');
	if (
		!readme.includes('not smart enough to fall back') ||
		!readme.includes('create this file manually') ||
		!paths.includes('appTsProdConfig') ||
		webpack.split('appTsProdConfig').length - 1 !== 3
	)
		throw new Error('Avataaars pinned legacy tool semantics differ');
	return {
		classification: 'unsupported-source-commit',
		raw,
		pinnedToolTarballSha256: sha256(await readFile(toolTarball)),
		pinnedToolFiles: hashes,
		reason: 'required tracked tsconfig.prod.json is absent; no fallback exists',
	};
}

async function fileTree(directory: string): Promise<Array<{ path: string; sha256: string }>> {
	const result: Array<{ path: string; sha256: string }> = [];
	const visit = async (current: string): Promise<void> => {
		for (const entry of await readdir(current, { withFileTypes: true })) {
			const absolute = path.join(current, entry.name);
			if (entry.isDirectory()) await visit(absolute);
			else if (entry.isFile())
				result.push({
					path: path.relative(directory, absolute),
					sha256: sha256(await readFile(absolute)),
				});
			else if (entry.isSymbolicLink()) {
				const target = await readlink(absolute);
				const resolved = path.resolve(path.dirname(absolute), target);
				if (!resolved.startsWith(`${directory}/`))
					throw new Error('Avataaars escaping symlink');
			} else throw new Error('Avataaars special filesystem entry');
		}
	};
	await visit(directory);
	return result.sort((left, right) =>
		left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
	);
}

async function extractLane(name: string): Promise<string> {
	const extract = path.join(work, `${name}-extract`);
	const lane = path.join(work, name);
	await mkdir(extract, { recursive: true });
	await execute('/usr/bin/tar', ['-xzf', archive, '-C', extract]);
	const entries = await readdir(extract);
	if (entries.length !== 1) throw new Error('Avataaars archive root differs');
	await rename(path.join(extract, entries[0]!), lane);
	await rm(extract, { recursive: true, force: true });
	await writeFile(
		path.join(lane, 'index.html'),
		"<!doctype html><html><head><meta charset='UTF-8'><title>Avataaars target-only</title></head><body><div id='root'></div><script type='module' src='/src/index.tsx'></script></body></html>\n",
	);
	return lane;
}

async function installLane(lane: string): Promise<void> {
	const lockBefore = sha256(await readFile(path.join(lane, 'yarn.lock')));
	await writeFile(
		path.join(lane, '.yarnrc'),
		`yarn-offline-mirror "${path.join(closureRoot, 'mirror')}"\nyarn-offline-mirror-pruning false\n`,
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
			path.join(lane, '.yarn-cache'),
		],
		lane,
		{
			PATH: `${path.dirname(node16)}:/usr/bin:/bin`,
			VERSIONLESS_NETWORK_MODE: 'offline',
			NPM_CONFIG_OFFLINE: 'true',
			YARN_ENABLE_NETWORK: '0',
			SKIP_YARN_COREPACK_CHECK: '1',
		},
	);
	if (
		sha256(await readFile(path.join(lane, 'yarn.lock'))) !== lockBefore ||
		(await exists(path.join(lane, 'node_modules/fsevents')))
	)
		throw new Error('Avataaars offline lane install invariant differs');
	await rm(path.join(lane, '.yarn-cache'), { recursive: true, force: true });
}

async function typeCheck(lane: string): Promise<void> {
	await execute(
		process.execPath,
		[
			path.join(lane, 'node_modules/typescript/bin/tsc'),
			'--noEmit',
			'-p',
			path.join(lane, 'tsconfig.json'),
		],
		lane,
		{
			...process.env,
			VERSIONLESS_NETWORK_MODE: 'offline',
			NPM_CONFIG_OFFLINE: 'true',
		},
	);
}

async function build(lane: string): Promise<string> {
	await execute(process.execPath, [vite, 'build', '--config', viteConfig], root, {
		...process.env,
		VERSIONLESS_NETWORK_MODE: 'offline',
		NPM_CONFIG_OFFLINE: 'true',
		VERSIONLESS_AVATAAARS_APPLICATION_ROOT: lane,
	});
	const dist = path.join(lane, 'dist-target');
	const entries = await fileTree(dist);
	if (
		entries.some(
			(entry) =>
				entry.path.endsWith('favicon.png') ||
				entry.path.endsWith('logo.svg') ||
				entry.sha256 ===
					'7b5a703994fe45c5c180c9407b67e2d8aa3424714f6cb5aa7e03d956c12e2c57' ||
				entry.sha256 === 'ecc203fbd1d0b912e7653108ff7d6e4f98da8a17b94d9f7045d06eccfad93a85',
		)
	)
		throw new Error('Avataaars target emitted an excluded asset');
	return sha256(canonicalize(entries));
}

function mime(file: string): string {
	if (file.endsWith('.html')) return 'text/html; charset=utf-8';
	if (file.endsWith('.js')) return 'text/javascript; charset=utf-8';
	if (file.endsWith('.css')) return 'text/css; charset=utf-8';
	return 'application/octet-stream';
}

async function serve(directory: string) {
	const instance = createServer(async (request, response) => {
		try {
			const pathname = parseURL(request.url ?? '/').pathname;
			const candidate = pathname === '/' ? 'index.html' : pathname.slice(1);
			const absolute = path.resolve(directory, candidate);
			if (!absolute.startsWith(`${directory}/`)) throw new Error('unsafe path');
			const file = (await stat(absolute).catch(() => undefined))?.isFile()
				? absolute
				: path.join(directory, 'index.html');
			response.writeHead(200, { 'content-type': mime(file) });
			response.end(await readFile(file));
		} catch {
			response.writeHead(404);
			response.end('not found');
		}
	});
	await new Promise<void>((resolve) => instance.listen(0, '127.0.0.1', resolve));
	const address = instance.address();
	if (!address || typeof address === 'string')
		throw new Error('Avataaars local server address differs');
	return { instance, url: `http://127.0.0.1:${address.port}` };
}

async function journey(page: Page, url: string) {
	const blockedUrls: string[] = [];
	let successfulNonLoopback = 0;
	const pageErrors: string[] = [];
	page.on('pageerror', (error) => pageErrors.push(error.message));
	await page.route('**/*', async (route) => {
		const parsed = parseURL(route.request().url());
		if (parsed.host?.startsWith('127.0.0.1:')) await route.continue();
		else {
			blockedUrls.push(route.request().url());
			await route.abort('blockedbyclient');
		}
	});
	page.on('response', (response) => {
		if (!parseURL(response.url()).host?.startsWith('127.0.0.1:') && response.ok())
			successfulNonLoopback += 1;
	});
	await page.goto(url, { waitUntil: 'domcontentloaded' });
	await page.waitForSelector("select[id='topType']");
	const before = await page
		.locator('main svg')
		.first()
		.evaluate((node) => node.outerHTML);
	const choices = await page
		.locator("select[id='topType'] option")
		.evaluateAll((nodes) => nodes.map((node) => (node as HTMLOptionElement).value));
	await page.check('#avatar-style-transparent');
	await page.selectOption("select[id='topType']", choices[1]!);
	await page.waitForFunction(
		() =>
			location.search.includes('avatarStyle=Transparent') &&
			location.search.includes('topType='),
	);
	const after = await page
		.locator('main svg')
		.first()
		.evaluate((node) => node.outerHTML);
	if (sha256(before) === sha256(after)) throw new Error('Avataaars SVG did not change');
	await page.getByRole('button', { name: 'Show React' }).click();
	const code = await page.locator('textarea').inputValue();
	if (!code.includes("avatarStyle='Transparent'") || !code.includes(`topType='${choices[1]}'`))
		throw new Error('Avataaars generated code differs');
	const query = parseURL(page.url()).search;
	await page.reload({ waitUntil: 'domcontentloaded' });
	await page.waitForSelector("select[id='topType']");
	if (
		!(await page.isChecked('#avatar-style-transparent')) ||
		(await page.locator("select[id='topType']").inputValue()) !== choices[1] ||
		parseURL(page.url()).search !== query
	)
		throw new Error('Avataaars reload persistence differs');
	if (successfulNonLoopback || pageErrors.length)
		throw new Error('Avataaars target locality differs');
	return {
		query,
		topType: choices[1],
		beforeSvgSha256: sha256(before),
		afterSvgSha256: sha256(after),
		codeSha256: sha256(code),
		blockedUrls: blockedUrls.sort(),
		successfulNonLoopback,
		pageErrors,
	};
}

async function runJourneys(browser: Browser, directory: string) {
	const local = await serve(directory);
	try {
		const results = [];
		for (let pass = 1; pass <= 2; pass += 1) {
			const context = await browser.newContext({ serviceWorkers: 'block' });
			const page = await context.newPage();
			results.push({ pass, ...(await journey(page, local.url)) });
			await context.close();
		}
		return results;
	} finally {
		await new Promise<void>((resolve, reject) =>
			local.instance.close((error) => (error ? reject(error) : resolve())),
		);
	}
}

async function artifact(name: string, value: unknown): Promise<{ path: string; sha256: string }> {
	const file = path.join(stage, 'artifacts', name);
	await writeFile(file, canonical(value));
	return {
		path: `evidence/runs/react-avataaars-vite8-target-only/artifacts/${name}`,
		sha256: sha256(await readFile(file)),
	};
}

export async function runReactAvataaarsTargetOnly(): Promise<Record<string, unknown>> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true' ||
		process.env.CI !== '1' ||
		process.env.VERSIONLESS_CONSENT_ID
	)
		throw new Error('T232 requires consent-free offline CI mode');
	for (const target of [work, stage, output])
		if (await exists(target))
			throw new Error(`T232 residue exists: ${path.relative(root, target)}`);
	const immutable = [
		[closureFile, '8dc039b5fc650594545a954d16f67d6d5df793340b535ccf6ade19f3f86a8f7b'],
		[dependencyReceipt, '3bd40314e1085edcf8cdba530c112645e361b7b6a93e0d17fcedf59c3ee6e6a9'],
		[t230Failure, 'c1621a5af73107bcdf14140334160c9160128abf453e98b69b89b8ab59f6446f'],
		[
			path.join(root, '.versionless/cache/react-avataaars-dependencies/t230-terminal.json'),
			'bbb3be19084fe2aea037339a7c00598ec5b162af5d884695a807c6f68939332d',
		],
	] as const;
	for (const [file, digest] of immutable)
		if (sha256(await readFile(file)) !== digest)
			throw new Error(`T232 immutable input differs: ${path.basename(file)}`);
	if (
		sha256(await readFile(chromiumExecutable)) !==
		'a46b3b1e63163fa2d2437fb6ae967cb5a73b50050bca32f1964e6129b6228244'
	)
		throw new Error('T232 Chromium identity differs');
	await mkdir(work, { recursive: true });
	await mkdir(path.join(stage, 'artifacts'), { recursive: true });
	let browser: Browser | undefined;
	try {
		const classification = await immutableClassification();
		const baseline = await extractLane('baseline-target');
		const migrated = await extractLane('migrated-target');
		const baselineSource = await fileTree(path.join(baseline, 'src'));
		const migratedSourceBefore = await fileTree(path.join(migrated, 'src'));
		if (canonicalize(baselineSource) !== canonicalize(migratedSourceBefore))
			throw new Error('T232 initial lane sources differ');
		await installLane(baseline);
		await installLane(migrated);
		await typeCheck(baseline);
		await typeCheck(migrated);
		const baselineFirst = await build(baseline);
		await rm(path.join(baseline, 'dist-target'), { recursive: true, force: true });
		const baselineSecond = await build(baseline);
		if (baselineFirst !== baselineSecond) throw new Error('T232 baseline target builds differ');
		const appFile = path.join(migrated, 'src/components/App.tsx');
		const originalApp = await readFile(appFile);
		const transform = transformReactClassLifecycleToHooks(originalApp.toString('utf8'));
		if (
			!transform.changed ||
			transform.edits.length !== 1 ||
			transformReactClassLifecycleToHooks(transform.code).changed
		)
			throw new Error('T232 transform or idempotence differs');
		await writeFile(appFile, transform.code);
		const migratedSourceAfter = await fileTree(path.join(migrated, 'src'));
		const withoutApp = (rows: Array<{ path: string; sha256: string }>) =>
			rows.filter((row) => row.path !== 'components/App.tsx');
		if (
			canonicalize(withoutApp(baselineSource)) !==
			canonicalize(withoutApp(migratedSourceAfter))
		)
			throw new Error('T232 transform changed another source file');
		const migratedDigest = await build(migrated);
		browser = await chromium.launch({ executablePath: chromiumExecutable, headless: true });
		const baselineJourneys = await runJourneys(browser, path.join(baseline, 'dist-target'));
		const migratedJourneys = await runJourneys(browser, path.join(migrated, 'dist-target'));
		const normalize = (row: (typeof baselineJourneys)[number]) => {
			const { pass: _pass, blockedUrls: _blockedUrls, ...rest } = row;
			return rest;
		};
		if (
			canonicalize(baselineJourneys.map(normalize)) !==
			canonicalize(migratedJourneys.map(normalize))
		)
			throw new Error('T232 normalized target journeys differ');
		const restoredApp = await readFile(appFile);
		const restoredAppSha256 = sha256(restoredApp);
		const mutation = restoredApp
			.toString('utf8')
			.replace('history.listen(() => forceUpdate())', 'history.listen(() => undefined)');
		if (mutation === restoredApp.toString('utf8'))
			throw new Error('T232 mutation span is absent');
		await writeFile(appFile, mutation);
		await build(migrated);
		let mutationFailure = '';
		try {
			await runJourneys(browser, path.join(migrated, 'dist-target'));
		} catch (error) {
			mutationFailure = error instanceof Error ? error.message : String(error);
		}
		if (!mutationFailure) throw new Error('T232 mutation did not fail');
		await writeFile(appFile, restoredApp);
		if (sha256(await readFile(appFile)) !== restoredAppSha256)
			throw new Error('T232 App restoration differs');
		const restoredDigest = await build(migrated);
		if (restoredDigest !== migratedDigest)
			throw new Error('T232 migrated restoration build differs');
		const restoredJourney = (
			await runJourneys(browser, path.join(migrated, 'dist-target'))
		)[0]!;
		const blockedUrls = [...baselineJourneys, ...migratedJourneys].flatMap(
			(row) => row.blockedUrls,
		);
		const supports = [
			{
				path: 'evidence/dependencies/react-avataaars/dependency-receipt.json',
				sha256: immutable[1][1],
			},
			await artifact('preparation.json', {
				sourceArchiveSha256: sha256(await readFile(archive)),
				closureCanonicalDigest:
					'dec1c47a6016b0c7f8d196f31c5014a78a55953b621a52ffc6bbd7a794cfa506',
				closureJsonSha256: immutable[0][1],
				dependencyReceiptSha256: immutable[1][1],
				adapterOnlyChanges: ['index.html', 'external Vite config'],
				excludedAssets: {
					'public/favicon.png':
						'7b5a703994fe45c5c180c9407b67e2d8aa3424714f6cb5aa7e03d956c12e2c57',
					'src/assets/logo.svg':
						'ecc203fbd1d0b912e7653108ff7d6e4f98da8a17b94d9f7045d06eccfad93a85',
				},
			}),
			await artifact('legacy-classification.json', classification),
			await artifact('transform.json', { ...transform, preservedOtherSourceFiles: true }),
			await artifact('baseline-target-build.json', {
				runtime: process.version,
				bundler: 'vite-8.0.16',
				first: baselineFirst,
				second: baselineSecond,
				equal: true,
				typescriptNoEmit: 'pass',
				legacy: false,
			}),
			await artifact('migrated-target-build.json', {
				runtime: process.version,
				bundler: 'vite-8.0.16',
				initial: migratedDigest,
				restored: restoredDigest,
				equal: true,
				typescriptNoEmit: 'pass',
				legacy: false,
			}),
			await artifact('journey.json', {
				baselineTarget: baselineJourneys,
				migratedTarget: migratedJourneys,
				normalizedEquivalent: true,
				restored: restoredJourney,
			}),
			await artifact('locality.json', {
				mode: 'offline',
				scope: 'application browser and spawned processes only',
				successfulNonLoopback: 0,
				blockedUrls,
				remoteBootstrapConsumed: false,
				remoteFontAwesomeConsumed: false,
				remoteTwitterConsumed: false,
				serviceWorkers: 'blocked',
				osWideIsolation: false,
			}),
			await artifact('mutation-restoration.json', {
				mutation: 'history listener update replaced by no-op',
				result: 'intended-failure',
				reason: mutationFailure,
				restoredAppSha256,
				restoredDigest,
				restoration: 'byte-exact-green',
			}),
		];
		const receiptMd = path.join(stage, 'artifacts/receipt.md');
		await writeFile(
			receiptMd,
			'# React Avataaars Vite 8 target-only receipt\n\nTarget-only qualification; the immutable source commit’s declared production build is unsupported because required tracked configuration is absent. No legacy/Vite parity or migration pass is claimed.\n',
		);
		supports.push({
			path: 'evidence/runs/react-avataaars-vite8-target-only/artifacts/receipt.md',
			sha256: sha256(await readFile(receiptMd)),
		});
		if (supports.length !== 10) throw new Error('T232 support artifact count differs');
		const receiptBody = {
			schemaVersion: 'versionless.react-avataaars-vite8-target-only.v1',
			runId: 'T232-react-avataaars-vite8-target-only',
			fixture: 'react-avataaars-vite8-target-only',
			result: 'target-only-pass',
			source: {
				repository: 'fangpenlin/avataaars-generator',
				revision: 'c191c6c2d27f41245e803912d43c7213436a34d3',
				archiveSha256: '4863a1304b659f1105f69d8ae0c715428c41d2d64b43edfd701148ddfca900da',
			},
			classification: {
				declaredProductionBuild: 'unsupported-source-commit',
				reason: 'required tracked tsconfig.prod.json is absent',
				productionExecution: 'not-run',
			},
			qualification: {
				baselineTargetBuilds: 2,
				migratedTargetBuilds: 2,
				baselineJourneys: 2,
				migratedJourneys: 2,
				viteVersion: '8.0.16',
				nodeVersion: process.version.slice(1),
				deterministicTargetOutput: true,
				withinVitePrePostTransformEquivalent: true,
				successfulNonLoopback: 0,
				mutationRestoration: 'pass',
			},
			artifacts: supports,
			limitations: [
				'No react-scripts-ts production execution or legacy/Vite parity.',
				'No bundler migration pass, source-application corpus entry, aggregate member, framework support, pilot, or production readiness.',
				'No compliance, certification, authenticity, signer identity, or OS-wide isolation claim.',
			],
		};
		const receipt = {
			...receiptBody,
			integrity: {
				algorithm: 'sha256',
				canonicalDigest: sha256(canonicalize(receiptBody)),
				authenticity: 'not-established',
			},
		};
		await writeFile(path.join(stage, 'receipt.json'), canonical(receipt));
		for (const [file, digest] of immutable)
			if (sha256(await readFile(file)) !== digest)
				throw new Error(`T232 immutable input changed: ${path.basename(file)}`);
		await rename(stage, output);
		return receipt;
	} catch (error) {
		await rm(stage, { recursive: true, force: true });
		await rm(output, { recursive: true, force: true });
		throw error;
	} finally {
		await browser?.close();
		await rm(work, { recursive: true, force: true });
	}
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	if (args[args.indexOf('--mode') + 1] !== 'vite8-target-only')
		throw new Error('T232 requires --mode vite8-target-only');
	const receipt = await runReactAvataaarsTargetOnly();
	process.stdout.write(canonical({ result: receipt.result, integrity: receipt.integrity }));
}

if (process.argv[1]?.endsWith('react-avataaars-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
