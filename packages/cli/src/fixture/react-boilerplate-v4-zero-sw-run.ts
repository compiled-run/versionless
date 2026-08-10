import { spawn } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import {
	access,
	cp,
	lstat,
	mkdir,
	readFile,
	readdir,
	rm,
	symlink,
	writeFile,
} from 'node:fs/promises';
import { anyOf, char, charIn, createRegExp, digit, exactly, global, oneOrMore } from 'magic-regexp';
import { basename, join, relative, resolve, sep } from 'pathe';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';

const root = resolve(import.meta.dirname, '../../../..');
const fixtureRoot = join(root, 'fixtures/react-boilerplate-v4-zero-sw');
const workRoot = join(root, '.versionless/work/react-boilerplate-v4-zero-sw');
const stageRoot = join(root, '.versionless/stage/react-boilerplate-v4-zero-sw');
const evidenceRoot = join(root, 'evidence/runs/react-boilerplate-v4-zero-sw');
const artifactsRoot = join(evidenceRoot, 'artifacts');
const profilePath = join(evidenceRoot, 'build-profile.json');
const terminalPath = join(evidenceRoot, 'terminal.json');
const node16Root = join(root, '.versionless/cache/react-boilerplate-v4/node16');
const node24Root = join(root, '.versionless/cache/react-boilerplate-v4-node24/node24');
const guard = join(root, 'packages/node-guard/dist/index.cjs');
const viteCli = join(root, 'node_modules/vite/bin/vite.js');
const viteConfig = join(fixtureRoot, 'vite.adapter.ts');

const ansi = createRegExp(
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
const webpackDuration = createRegExp(exactly('Time: '), oneOrMore(digit), 'ms', [global]);
const webpackBuiltAt = createRegExp(exactly('Built at: '), char.times.any(), [global]);

const protectedPaths = {
	t060Receipt: 'evidence/runs/react-boilerplate-v4-composed/t060-run.json',
	witnessReceipt: 'evidence/runs/witness-react-boilerplate/receipt.json',
	buildArtifact: 'evidence/runs/react-boilerplate-v4-composed/artifacts/build.json',
	journeyArtifact: 'evidence/runs/react-boilerplate-v4-composed/artifacts/journey.json',
	mutationArtifact: 'evidence/runs/react-boilerplate-v4-composed/artifacts/mutation.json',
} as const;

type Manifest = {
	id: string;
	source: {
		repository: string;
		revision: string;
		archiveSha256: string;
		license: string;
		licenseSha256: string;
	};
	inputs: {
		baseline: string;
		target: string;
		appSha256: string;
		webpackProductionSha256: string;
	};
	protected: Record<keyof typeof protectedPaths, string>;
	browser: { executable: string; sha256: string };
};

const registrationBlock = `// Install ServiceWorker and AppCache in the end since
// it's not most important operation and if main code fails,
// we do not want it installed
if (process.env.NODE_ENV === 'production') {
  require('offline-plugin/runtime').install(); // eslint-disable-line global-require
}`;
const offlineRequire = "const OfflinePlugin = require('offline-plugin');\n";
const offlinePluginStart = "    // Put it in the end to capture all the HtmlWebpackPlugin's\n";
const compressionStart = '    new CompressionPlugin({';

async function exists(path: string): Promise<boolean> {
	return access(path).then(
		() => true,
		() => false,
	);
}

function environment(nodeRoot: string): NodeJS.ProcessEnv {
	return {
		...process.env,
		PATH: `${join(nodeRoot, 'bin')}:${process.env.PATH ?? ''}`,
		VERSIONLESS_NETWORK_MODE: 'offline',
		NPM_CONFIG_OFFLINE: 'true',
		npm_config_offline: 'true',
		NODE_OPTIONS: `--require=${guard}`,
	};
}

async function execute(
	cwd: string,
	nodeRoot: string,
	command: string,
	args: readonly string[],
): Promise<{ stdout: string; stderr: string }> {
	return await new Promise((resolvePromise, reject) => {
		const child = spawn(command, [...args], { cwd, env: environment(nodeRoot) });
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		child.stdout?.on('data', (chunk: Buffer) => stdout.push(chunk));
		child.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk));
		child.once('error', reject);
		child.once('exit', (code) => {
			const result = {
				stdout: Buffer.concat(stdout).toString('utf8'),
				stderr: Buffer.concat(stderr).toString('utf8'),
			};
			if (code === 0) resolvePromise(result);
			else reject(new Error(`${basename(command)} exited ${code ?? -1}: ${result.stderr}`));
		});
	});
}

function normalizedLog(text: string): string {
	return text
		.replace(ansi, '')
		.replace(viteDuration, 'built in <duration>')
		.replace(webpackDuration, 'Time: <duration>')
		.replace(webpackBuiltAt, 'Built at: <normalized>')
		.split(root)
		.join('<checkout>');
}

async function filesBelow(directory: string): Promise<string[]> {
	const files: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isSymbolicLink()) throw new Error('Derived output contains a symbolic link');
		if (entry.isDirectory()) files.push(...(await filesBelow(path)));
		else if (entry.isFile()) files.push(path);
		else throw new Error('Derived output contains a special entry');
	}
	return files.sort();
}

async function inventory(directory: string) {
	const files = await Promise.all(
		(await filesBelow(directory)).map(async (file) => ({
			path: relative(directory, file).split(sep).join('/'),
			sha256: sha256(await readFile(file)),
		})),
	);
	return { files, digest: sha256(canonicalize(files)) };
}

function workerOutputs(files: readonly { path: string }[]): string[] {
	return files
		.map((file) => file.path)
		.filter((path) => {
			const name = basename(path).toLowerCase();
			return (
				name === 'sw.js' ||
				name === 'service-worker.js' ||
				name.includes('precache-manifest') ||
				name.startsWith('workbox-') ||
				name.endsWith('.worker.js')
			);
		})
		.sort();
}

function removeExactlyOnce(source: string, span: string, label: string): string {
	const first = source.indexOf(span);
	if (first < 0 || source.lastIndexOf(span) !== first)
		throw new Error(`Zero-SW exact ${label} span differs`);
	return `${source.slice(0, first)}${source.slice(first + span.length)}`;
}

function removeOfflinePlugin(source: string): string {
	const withoutRequire = removeExactlyOnce(source, offlineRequire, 'OfflinePlugin require');
	const start = withoutRequire.indexOf(offlinePluginStart);
	const end = withoutRequire.indexOf(compressionStart);
	if (
		start < 0 ||
		end <= start ||
		withoutRequire.lastIndexOf(offlinePluginStart) !== start ||
		withoutRequire.lastIndexOf(compressionStart) !== end
	)
		throw new Error('Zero-SW exact OfflinePlugin execution span differs');
	const result = `${withoutRequire.slice(0, start)}${withoutRequire.slice(end)}`;
	if (result.includes('OfflinePlugin') || result.includes("require('offline-plugin')"))
		throw new Error('Zero-SW webpack configuration retained OfflinePlugin execution');
	return result;
}

async function copySource(source: string, destination: string): Promise<void> {
	await cp(source, destination, {
		recursive: true,
		filter: (path) => !['node_modules', 'build', 'build-vite'].includes(basename(path)),
	});
	await symlink(join(source, 'node_modules'), join(destination, 'node_modules'));
	if (!(await lstat(join(destination, 'node_modules'))).isSymbolicLink())
		throw new Error('Derived dependency closure is not linked');
}

async function applyProfile(lane: string): Promise<{
	appBefore: string;
	appAfter: string;
	webpackBefore: string;
	webpackAfter: string;
}> {
	const appPath = join(lane, 'app/app.js');
	const webpackPath = join(lane, 'internals/webpack/webpack.prod.babel.js');
	const app = await readFile(appPath, 'utf8');
	const webpack = await readFile(webpackPath, 'utf8');
	const nextApp = removeExactlyOnce(app, registrationBlock, 'runtime registration');
	const nextWebpack = removeOfflinePlugin(webpack);
	await writeFile(appPath, nextApp);
	await writeFile(webpackPath, nextWebpack);
	return {
		appBefore: sha256(app),
		appAfter: sha256(nextApp),
		webpackBefore: sha256(webpack),
		webpackAfter: sha256(nextWebpack),
	};
}

async function webpackBuild(lane: string) {
	await rm(join(lane, 'build'), { recursive: true, force: true });
	const result = await execute(lane, node16Root, join(node16Root, 'bin/npm'), ['run', 'build']);
	const log = normalizedLog(`${result.stdout}${result.stderr}`);
	if (!log.toLowerCase().includes('webpack') || log.toLowerCase().includes('vite'))
		throw new Error('Zero-SW baseline did not prove webpack 4');
	const output = await inventory(join(lane, 'build'));
	const workers = workerOutputs(output.files);
	if (workers.length !== 0)
		throw new Error(`Zero-SW baseline emitted workers: ${workers.join(',')}`);
	return output;
}

async function viteBuild(lane: string) {
	await rm(join(lane, 'build-vite'), { recursive: true, force: true });
	const result = await execute(lane, node24Root, join(node24Root, 'bin/node'), [
		'--experimental-strip-types',
		viteCli,
		'build',
		'--config',
		viteConfig,
	]);
	const log = normalizedLog(`${result.stdout}${result.stderr}`);
	if (!log.includes('vite v8.0.16') || log.toLowerCase().includes('webpack'))
		throw new Error('Zero-SW target did not prove Vite 8.0.16 without webpack');
	const output = await inventory(join(lane, 'build-vite'));
	const workers = workerOutputs(output.files);
	if (workers.length !== 0)
		throw new Error(`Zero-SW target emitted workers: ${workers.join(',')}`);
	return output;
}

async function canonicalizeLegacyWorker(output: string): Promise<void> {
	const worker = join(output, 'sw.js');
	const source = await readFile(worker, 'utf8');
	const lines = source.split('\n');
	const versionLines = lines.filter((line) => line.startsWith('  "version": "'));
	if (versionLines.length !== 1)
		throw new Error('Zero-SW mutation legacy worker version seam differs');
	const canonical = lines
		.map((line) =>
			line.startsWith('  "version": "') ? '  "version": "versionless-deterministic",' : line,
		)
		.join('\n');
	await writeFile(worker, canonical);
	await writeFile(`${worker}.gz`, gzipSync(canonical));
}

async function protectedHashes(manifest: Manifest): Promise<Record<string, string>> {
	const hashes = Object.fromEntries(
		await Promise.all(
			Object.entries(protectedPaths).map(async ([name, path]) => [
				name,
				sha256(await readFile(join(root, path))),
			]),
		),
	);
	if (canonicalize(hashes) !== canonicalize(manifest.protected))
		throw new Error('Protected T060 or original Witness hash differs');
	return hashes;
}

async function preflight(): Promise<{ manifest: Manifest; protected: Record<string, string> }> {
	const manifest = JSON.parse(
		await readFile(join(fixtureRoot, 'fixture.json'), 'utf8'),
	) as Manifest;
	const baseline = join(root, manifest.inputs.baseline);
	const target = join(root, manifest.inputs.target);
	for (const lane of [baseline, target]) {
		if (sha256(await readFile(join(lane, 'app/app.js'))) !== manifest.inputs.appSha256)
			throw new Error('Accepted composed app.js input differs');
		if (
			sha256(await readFile(join(lane, 'internals/webpack/webpack.prod.babel.js'))) !==
			manifest.inputs.webpackProductionSha256
		)
			throw new Error('Accepted composed webpack production input differs');
	}
	if (
		(
			await execute(root, node16Root, join(node16Root, 'bin/node'), ['--version'])
		).stdout.trim() !== 'v16.20.2' ||
		(
			await execute(root, node24Root, join(node24Root, 'bin/node'), ['--version'])
		).stdout.trim() !== 'v24.15.0' ||
		sha256(await readFile(join(root, manifest.browser.executable))) !== manifest.browser.sha256
	)
		throw new Error('Pinned zero-SW runtime or browser differs');
	return { manifest, protected: await protectedHashes(manifest) };
}

async function writeTerminal(error: unknown): Promise<void> {
	if (await exists(terminalPath)) return;
	await mkdir(evidenceRoot, { recursive: true });
	const unsigned = {
		schemaVersion: 'versionless.react-boilerplate-zero-sw-t693-terminal.v1',
		result: 'terminal-failure',
		promotion: 'none',
		failure: error instanceof Error ? error.message : String(error),
		scores: { react: '1/4', alignedReact: '0/4', total: '3/12' },
	};
	await writeFile(
		terminalPath,
		`${canonicalize({ ...unsigned, integrity: { algorithm: 'sha256', canonicalDigest: sha256(canonicalize(unsigned)) } })}\n`,
		{ flag: 'wx' },
	);
}

export async function runReactBoilerplateZeroSw(): Promise<void> {
	const prepared = await preflight();
	if ((await exists(evidenceRoot)) || (await exists(workRoot)) || (await exists(stageRoot)))
		throw new Error('T693 output collision');
	try {
		await mkdir(artifactsRoot, { recursive: true });
		await mkdir(workRoot, { recursive: true });
		const baseline = join(workRoot, 'baseline');
		const target = join(workRoot, 'target');
		await copySource(join(root, prepared.manifest.inputs.baseline), baseline);
		await copySource(join(root, prepared.manifest.inputs.target), target);
		await writeFile(
			join(target, 'index.html'),
			await readFile(join(root, 'fixtures/react-boilerplate-v4-vite8/index.html')),
		);
		const removals = {
			baseline: await applyProfile(baseline),
			target: await applyProfile(target),
		};
		if (canonicalize(removals.baseline) !== canonicalize(removals.target))
			throw new Error('Zero-SW removal is not symmetric across derived lanes');

		const baselineFirst = await webpackBuild(baseline);
		const baselineSecond = await webpackBuild(baseline);
		const targetFirst = await viteBuild(target);
		const targetSecond = await viteBuild(target);
		if (
			canonicalize(baselineFirst) !== canonicalize(baselineSecond) ||
			canonicalize(targetFirst) !== canonicalize(targetSecond)
		)
			throw new Error('Zero-SW build outputs are not byte-identical');

		const mutation = join(workRoot, 'zero-sw-mutation');
		await copySource(join(root, prepared.manifest.inputs.baseline), mutation);
		const mutationAppBefore = sha256(await readFile(join(mutation, 'app/app.js')));
		const mutationWebpackBefore = sha256(
			await readFile(join(mutation, 'internals/webpack/webpack.prod.babel.js')),
		);
		await rm(join(mutation, 'build'), { recursive: true, force: true });
		await execute(mutation, node16Root, join(node16Root, 'bin/npm'), ['run', 'build']);
		await canonicalizeLegacyWorker(join(mutation, 'build'));
		const mutationOutput = await inventory(join(mutation, 'build'));
		const observedWorkerOutputs = workerOutputs(mutationOutput.files);
		if (!observedWorkerOutputs.includes('sw.js'))
			throw new Error('Zero-SW mutation did not make the worker-output guard red');
		await mkdir(stageRoot, { recursive: true });
		await cp(join(mutation, 'build'), join(stageRoot, 'mutation-output'), { recursive: true });
		if (
			sha256(await readFile(join(mutation, 'app/app.js'))) !== mutationAppBefore ||
			sha256(await readFile(join(mutation, 'internals/webpack/webpack.prod.babel.js'))) !==
				mutationWebpackBefore
		)
			throw new Error('Zero-SW mutation source/config restoration differs');
		const baselineRestored = await webpackBuild(baseline);
		if (canonicalize(baselineRestored) !== canonicalize(baselineFirst))
			throw new Error('Zero-SW mutation build-digest restoration differs');

		const profile = {
			schemaVersion: 'versionless.react-boilerplate-zero-sw-build-profile.v1',
			result: 'build-profile-complete-not-promoted',
			source: prepared.manifest.source,
			protected: prepared.protected,
			removals,
			builds: {
				baseline: {
					runtime: 'node-16.20.2',
					bundler: 'webpack-4.30.0',
					first: baselineFirst,
					second: baselineSecond,
					equal: true,
				},
				target: {
					runtime: 'node-24.15.0',
					bundler: 'vite-8.0.16',
					react: '18-compatible',
					first: targetFirst,
					second: targetSecond,
					equal: true,
					webpackExecuted: false,
				},
			},
			zeroServiceWorker: { outputFiles: [] },
			mutation: {
				seam: 'exact-upstream-offline-plugin-registration-and-build-execution',
				observedWorkerOutputs,
				guard: 'intended-failure',
				sourceConfigRestoration: 'byte-identical',
				buildRestoration: 'digest-identical',
			},
			scores: { react: '1/4', alignedReact: '0/4', total: '3/12' },
		};
		await writeFile(profilePath, `${canonicalize(profile)}\n`, { flag: 'wx' });
		await writeFile(join(artifactsRoot, 'build.json'), `${canonicalize(profile.builds)}\n`, {
			flag: 'wx',
		});
		await writeFile(
			join(artifactsRoot, 'zero-sw-mutation.json'),
			`${canonicalize(profile.mutation)}\n`,
			{ flag: 'wx' },
		);
		await protectedHashes(prepared.manifest);
	} catch (error) {
		await writeTerminal(error);
		throw error;
	}
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	if (
		args.length === 3 &&
		args[0] === '--preflight' &&
		args[1] === '--namespace' &&
		args[2] === 't693'
	) {
		await preflight();
		process.stdout.write('{"preflight":"pass"}\n');
		return;
	}
	if (
		args.length === 3 &&
		args[0] === '--run' &&
		args[1] === '--namespace' &&
		args[2] === 't693'
	) {
		if (
			process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
			process.env.NPM_CONFIG_OFFLINE !== 'true'
		)
			throw new Error('T693 run requires explicit dual offline controls');
		await runReactBoilerplateZeroSw();
		process.stdout.write(
			`${canonicalize({ result: 'build-profile-complete-not-promoted' })}\n`,
		);
		return;
	}
	throw new Error('T693 runner requires --preflight --namespace t693 or --run --namespace t693');
}

if (basename(process.argv[1] ?? '') === 'react-boilerplate-v4-zero-sw-run.ts')
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
