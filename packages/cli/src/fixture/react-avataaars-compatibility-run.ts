import { spawn } from 'node:child_process';
import {
	access,
	cp,
	mkdir,
	readFile,
	readdir,
	readlink,
	rename,
	rm,
	stat,
	writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:http';
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
import { basename, dirname, extname, join, relative, resolve } from 'pathe';
import { parseHost, parseURL } from 'ufo';
import {
	canonicalize,
	analyzeCorpusConformance,
	parseReactAvataaarsCompatibilityReceipt,
	reactAvataaarsCompatibilityAggregateMember,
	sha256,
	verifyReactAvataaarsCompatibilityEvidence,
} from '../../../core/src/index.ts';
import { generateTrustPackage, verifyTrustPackage } from '../../../trust/src/index.ts';
import { transformAvataaarsReact18 } from '../../../frameworks/react/src/index.ts';
import { witnessNodeFileSystem } from '../witness/node-filesystem.ts';
import { verifyLinkedWitnessProvenance } from '../witness/provenance.ts';
import {
	verifyAvataaarsReact1831Acquisition,
	verifyAvataaarsReact1831Tarball,
	verifyAvataaarsProtectedNegativeEvidence,
} from './react-avataaars-compatibility-ingest.ts';
import { verifyPublishedAvataaarsClosure } from './react-avataaars-dependency-ingest.ts';

const root = resolve(import.meta.dirname, '../../../..');
const archive = join(
	root,
	'.versionless/cache/tier-f/react-avataaars/4863a1304b659f1105f69d8ae0c715428c41d2d64b43edfd701148ddfca900da/source.tar.gz',
);
const sourceManifest = join(
	root,
	'.versionless/cache/tier-f/react-avataaars/4863a1304b659f1105f69d8ae0c715428c41d2d64b43edfd701148ddfca900da/manifest.json',
);
const legacyClosureRoot = join(
	root,
	'.versionless/cache/react-avataaars-dependencies/d53edb62306b30bc2888ebb06c028f4b1452df9e39819c4d98f00857655f5156',
);
const targetReceiptPath = join(
	root,
	'evidence/dependencies/react-avataaars-react1831/t608/dependency-receipt.json',
);
const workRoot = join(root, '.versionless/work/react-avataaars-compatibility/t608');
const outputRoot = join(root, 'evidence/runs/react-avataaars-compatibility-to-vite8/t608');
const outputStage = `${outputRoot}.stage`;
const aggregatePath = join(root, 'evidence/runs/aggregate.json');
const trustReplayRoot = join(root, '.versionless/cache/trust/replay/t608');
const trustCurrent = join(root, 'evidence/trust/current');
const node16 = join(root, '.versionless/cache/react-boilerplate-v4/node16/bin/node');
const yarn = join(
	process.env.COREPACK_HOME ?? join(process.env.HOME ?? '', '.cache/node/corepack'),
	'v1/yarn/1.22.22/bin/yarn.js',
);
const vite = join(root, 'node_modules/vite/bin/vite.js');
const viteConfig = join(
	root,
	'packages/cli/src/fixture/react-avataaars-compatibility-vite.config.ts',
);
const chromiumExecutable = join(
	root,
	'.versionless/cache/react-boilerplate-v4/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell',
);
const toolTarball = join(
	legacyClosureRoot,
	'tarballs/ad87c3d275846a8a56ea0eb42d84634ebeb685bb25b8992ae47624aef9a7de9d.tgz',
);

type TargetArtifact = {
	name: string;
	version: string;
	url: string;
	integrity: string;
	shasum: string;
	sha256: string;
	byteLength: number;
	dependencies: Record<string, string>;
};
type TargetClosure = {
	schemaVersion: string;
	artifacts: TargetArtifact[];
	consent: Record<string, unknown>;
	nonclaims: string[];
	integrity: { canonicalDigest: string };
};
type ServiceWorkerEvidence = {
	registrations: number;
	controller: string | null;
	cacheNames: string[];
};
type BrowserEvidence = {
	serviceWorkers: ServiceWorkerEvidence[];
	attemptedNonLoopback: string[];
	successfulNonLoopback: number;
	downloads: Array<{ filename: string; sha256: string; byteLength: number }>;
	readbacks: Array<{
		svgOuterHtml: string | null;
		textareaValue: string | null;
		topTypeValue: string | null;
		url: string;
	}>;
};
type AvataaarsJourney = 'selection-history' | 'customization-renderer';

export const AVATAAARS_SHOW_REACT_SELECTOR = 'form button:nth-of-type(3)' as const;
export const AVATAAARS_TRANSPARENT_WRAPPING_LABEL_SELECTOR =
	'label > input#avatar-style-transparent:checked' as const;

export function assertAvataaarsShowReactSelector(
	selector: string,
	buttonLabels: readonly string[],
): void {
	if (
		selector !== AVATAAARS_SHOW_REACT_SELECTOR ||
		buttonLabels.filter((label) => label === 'Show React').length !== 1
	)
		throw new Error('Avataaars Show React selector is absent, generic, or ambiguous');
}

export function assertAvataaarsTransparentWrappingLabelSelector(
	selector: string,
	inputs: readonly {
		relation: 'wrapped' | 'for-based' | 'unwrapped';
		id: string;
		checked: boolean;
	}[],
): void {
	if (
		selector !== AVATAAARS_TRANSPARENT_WRAPPING_LABEL_SELECTOR ||
		inputs.filter(
			(input) =>
				input.relation === 'wrapped' &&
				input.id === 'avatar-style-transparent' &&
				input.checked,
		).length !== 1
	)
		throw new Error('Avataaars transparent wrapping-label selector differs');
}
type ImmutableEvidence = {
	archiveSha256: string;
	tree: string;
	closureCanonicalDigest: string;
	closureFileSha256: string;
	dependencyReceiptSha256: string;
	templateSha256: string;
	legacyServiceWorker: string;
};

const canonical = (value: unknown): string => `${canonicalize(value)}\n`;
const compare = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);
const exists = (file: string): Promise<boolean> =>
	access(file).then(
		() => true,
		() => false,
	);

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
							`${basename(command)} exited ${code ?? -1}: ${Buffer.concat(stdout)}${Buffer.concat(stderr)}`,
						),
					),
		);
	});
}

async function tarFile(source: string, file: string): Promise<Buffer> {
	return Buffer.from(await execute('/usr/bin/tar', ['-xOf', source, file]), 'utf8');
}

async function fileTree(directory: string): Promise<Array<{ path: string; sha256: string }>> {
	const rows: Array<{ path: string; sha256: string }> = [];
	const visit = async (current: string): Promise<void> => {
		for (const entry of await readdir(current, { withFileTypes: true })) {
			const absolute = join(current, entry.name);
			if (entry.isDirectory()) await visit(absolute);
			else if (entry.isFile())
				rows.push({
					path: relative(directory, absolute),
					sha256: sha256(await readFile(absolute)),
				});
			else if (entry.isSymbolicLink()) {
				const target = resolve(dirname(absolute), await readlink(absolute));
				if (!target.startsWith(`${directory}/`))
					throw new Error('Avataaars lane symlink escapes');
			} else throw new Error('Avataaars lane contains a special filesystem entry');
		}
	};
	await visit(directory);
	return rows.sort((left, right) => compare(left.path, right.path));
}

async function extractLane(name: string): Promise<string> {
	const lane = join(workRoot, name);
	await mkdir(lane, { recursive: true });
	await execute('/usr/bin/tar', ['-xzf', archive, '-C', lane, '--strip-components', '1']);
	return lane;
}

async function verifyImmutableInputs(): Promise<ImmutableEvidence> {
	if (
		sha256(await readFile(archive)) !==
			'4863a1304b659f1105f69d8ae0c715428c41d2d64b43edfd701148ddfca900da' ||
		sha256(await readFile(join(legacyClosureRoot, 'closure.json'))) !==
			'8dc039b5fc650594545a954d16f67d6d5df793340b535ccf6ade19f3f86a8f7b' ||
		sha256(
			await readFile(
				join(root, 'evidence/dependencies/react-avataaars/dependency-receipt.json'),
			),
		) !== '3bd40314e1085edcf8cdba530c112645e361b7b6a93e0d17fcedf59c3ee6e6a9' ||
		sha256(await readFile(toolTarball)) !==
			'ad87c3d275846a8a56ea0eb42d84634ebeb685bb25b8992ae47624aef9a7de9d' ||
		sha256(await readFile(node16)) !==
			'83325958463d59cb0b16433eefab0a03fd1ce7d565a27e0274f507b1f3839a6e' ||
		sha256(await readFile(chromiumExecutable)) !==
			'a46b3b1e63163fa2d2437fb6ae967cb5a73b50050bca32f1964e6129b6228244'
	)
		throw new Error('Avataaars immutable source, closure, tool, runtime, or browser differs');
	const template = await tarFile(toolTarball, 'package/template/tsconfig.prod.json');
	if (sha256(template) !== 'ec5f058d32e5234028d56467b0c9368cedf45d5e8dbe79f43e290a9e3d4487b8')
		throw new Error('Avataaars compatibility template differs');
	const manifest = JSON.parse(await readFile(sourceManifest, 'utf8')) as {
		files: Array<{ path: string; sha256: string }>;
	};
	if (!manifest.files.some((row) => row.path === 'src/registerServiceWorker.ts'))
		throw new Error('Avataaars immutable legacy service-worker source is absent');
	return {
		archiveSha256: sha256(await readFile(archive)),
		tree: '94a3d1a024682b3f21ad30b9de8d4e1541a376d3',
		closureCanonicalDigest: 'dec1c47a6016b0c7f8d196f31c5014a78a55953b621a52ffc6bbd7a794cfa506',
		closureFileSha256: '8dc039b5fc650594545a954d16f67d6d5df793340b535ccf6ade19f3f86a8f7b',
		dependencyReceiptSha256: '3bd40314e1085edcf8cdba530c112645e361b7b6a93e0d17fcedf59c3ee6e6a9',
		templateSha256: sha256(template),
		legacyServiceWorker: 'observed-source-import-call',
	};
}

async function loadTargetClosure(): Promise<{
	closure: TargetClosure;
	root: string;
	receiptSha256: string;
}> {
	const receiptBytes = await readFile(targetReceiptPath);
	const receipt = JSON.parse(receiptBytes.toString('utf8')) as {
		closure: { path: string; digest: string; fileSha256: string };
	};
	const closureRoot = resolve(root, receipt.closure.path);
	if (
		!closureRoot.startsWith(
			`${join(root, '.versionless/cache/react-avataaars-react1831/t608')}/`,
		)
	)
		throw new Error('Avataaars target closure path differs');
	const closureBytes = await readFile(join(closureRoot, 'closure.json'));
	if (sha256(closureBytes) !== receipt.closure.fileSha256)
		throw new Error('Avataaars target closure file differs');
	const closure = JSON.parse(closureBytes.toString('utf8')) as TargetClosure;
	const { integrity, ...body } = closure;
	if (
		closure.schemaVersion !== 'versionless.react-avataaars-react1831-closure.v1' ||
		sha256(canonicalize(body)) !== integrity.canonicalDigest ||
		integrity.canonicalDigest !== receipt.closure.digest ||
		closure.artifacts.length !== 3
	)
		throw new Error('Avataaars target closure canonical identity differs');
	for (const artifact of closure.artifacts) {
		const bytes = await readFile(join(closureRoot, 'tarballs', `${artifact.sha256}.tgz`));
		if (bytes.byteLength !== artifact.byteLength || sha256(bytes) !== artifact.sha256)
			throw new Error('Avataaars target artifact content address differs');
		verifyAvataaarsReact1831Tarball(bytes, { ...artifact, tarball: artifact.url });
	}
	return { closure, root: closureRoot, receiptSha256: sha256(receiptBytes) };
}

function exactReplace(source: string, before: string, after: string, label: string): string {
	if (source.indexOf(before) < 0 || source.indexOf(before) !== source.lastIndexOf(before))
		throw new Error(`Avataaars ${label} span is absent or ambiguous`);
	return source.replace(before, after);
}

function exactRemoveRange(
	source: string,
	startMarker: string,
	endMarker: string,
	label: string,
): string {
	const start = source.indexOf(startMarker);
	if (start < 0 || start !== source.lastIndexOf(startMarker))
		throw new Error(`Avataaars ${label} start is absent or ambiguous`);
	const end = source.indexOf(endMarker, start + startMarker.length);
	if (end < 0) throw new Error(`Avataaars ${label} end is absent`);
	return `${source.slice(0, start)}${source.slice(end)}`;
}

async function applyInteractiveLocalOverlay(lane: string): Promise<string[]> {
	const avatarForm = join(lane, 'src/components/AvatarForm.tsx');
	const componentImg = join(lane, 'src/components/ComponentImg.tsx');
	let formSource = await readFile(avatarForm, 'utf8');
	formSource = exactRemoveRange(
		formSource,
		'// ref: https://stackoverflow.com/a/1714899/25077\n',
		'class OptionSelect extends React.Component<SelectProps> {\n',
		'remote Twitter query serializer',
	);
	await writeFile(
		avatarForm,
		exactRemoveRange(
			formSource,
			"            <div style={{ marginTop: '10px' }}>",
			'          </Col>\n',
			'remote Twitter iframe',
		),
	);
	await writeFile(
		componentImg,
		exactReplace(
			await readFile(componentImg, 'utf8'),
			"const code = `<img src='https://avataaars.io/?avatarStyle=${avatarStyle}&${propsStr}'",
			"const code = `<img src='/?__render__=1&avatarStyle=${avatarStyle}&${propsStr}'",
			'local renderer URL',
		),
	);
	return ['src/components/AvatarForm.tsx', 'src/components/ComponentImg.tsx'];
}

export function createAvataaarsReact1831LockDelta(
	lock: string,
	artifacts: readonly TargetArtifact[],
): string {
	const byName = new Map(artifacts.map((artifact) => [artifact.name, artifact]));
	const entry = (name: 'react' | 'react-dom' | 'scheduler', selector: string): string => {
		const artifact = byName.get(name);
		if (!artifact) throw new Error(`Avataaars target artifact ${name} is absent`);
		const dependencies = Object.entries(artifact.dependencies)
			.sort(([left], [right]) => compare(left, right))
			.map(([dependency, range]) => `    ${dependency} "${range}"`)
			.join('\n');
		return `${name}@${selector}:\n  version "${artifact.version}"\n  resolved "${artifact.url}#${artifact.shasum}"\n  integrity ${artifact.integrity}\n  dependencies:\n${dependencies}`;
	};
	const react17 = `react@^17.0.0:\n  version "17.0.2"\n  resolved "https://registry.yarnpkg.com/react/-/react-17.0.2.tgz#d0b5cc516d29eb3eee383f75b62864cfb6800037"\n  integrity sha512-gnhPt75i/dq/z3/6q/0asP78D0u592D5L1pd7M8P+dck6Fu/jJeL6iVVK23fptSUZj8Vjf++7wXA8UNclGQcbA==\n  dependencies:\n    loose-envify "^1.1.0"\n    object-assign "^4.1.1"`;
	const reactDom17 = `react-dom@^17.0.0:\n  version "17.0.2"\n  resolved "https://registry.yarnpkg.com/react-dom/-/react-dom-17.0.2.tgz#ecffb6845e3ad8dbfcdc498f0d0a939736502c23"\n  integrity sha512-s4h96KtLDUQlsENhMn1ar8t2bEa+q/YAtj8pPPdIjPDGBDIVNsrD9aXNWqspUe6AzKCIG0C1HZZLqLV7qpOBGA==\n  dependencies:\n    loose-envify "^1.1.0"\n    object-assign "^4.1.1"\n    scheduler "^0.20.2"`;
	const scheduler17 = `scheduler@^0.20.2:\n  version "0.20.2"\n  resolved "https://registry.yarnpkg.com/scheduler/-/scheduler-0.20.2.tgz#4baee39436e34aa93b4874bddcbf0fe8b8b50e91"\n  integrity sha512-2eWfGgAqqWFGqtdMmcL5zCMK1U8KlXv8SQFGglL3CEtd0aDVDWgeF/YoCmvln55m5zSk3J/20hTaSBeSObsQDQ==\n  dependencies:\n    loose-envify "^1.1.0"\n    object-assign "^4.1.1"`;
	let target = exactReplace(lock, react17, entry('react', '18.3.1'), 'React lock');
	target = exactReplace(target, reactDom17, entry('react-dom', '18.3.1'), 'ReactDOM lock');
	target = exactReplace(
		target,
		scheduler17,
		`${scheduler17}\n\n${entry('scheduler', '^0.23.2')}`,
		'Scheduler lock',
	);
	return target;
}

async function prepareMirror(
	target: Awaited<ReturnType<typeof loadTargetClosure>>,
): Promise<string> {
	const mirror = join(workRoot, 'target-mirror');
	await mkdir(mirror, { recursive: true });
	const legacyNames = (await readdir(join(legacyClosureRoot, 'mirror'))).sort(compare);
	if (legacyNames.length !== 1222)
		throw new Error('Avataaars accepted legacy mirror inventory differs');
	for (const name of legacyNames)
		await cp(join(legacyClosureRoot, 'mirror', name), join(mirror, name));
	for (const artifact of target.closure.artifacts)
		await cp(
			join(target.root, 'tarballs', `${artifact.sha256}.tgz`),
			join(mirror, `${artifact.name}-${artifact.version}.tgz`),
		);
	const expectedAdded = target.closure.artifacts
		.map((artifact) => `${artifact.name}-${artifact.version}.tgz`)
		.sort(compare);
	const mirrorNames = (await readdir(mirror)).sort(compare);
	if (
		mirrorNames.length !== 1225 ||
		canonicalize(mirrorNames.filter((name) => !legacyNames.includes(name))) !==
			canonicalize(expectedAdded)
	)
		throw new Error(
			'Avataaars target mirror is not legacy closure plus exactly three tarballs',
		);
	return mirror;
}

async function installLane(lane: string, mirror: string, runtime: string): Promise<void> {
	const lockBefore = sha256(await readFile(join(lane, 'yarn.lock')));
	await writeFile(
		join(lane, '.yarnrc'),
		`yarn-offline-mirror "${mirror}"\nyarn-offline-mirror-pruning false\n`,
	);
	await execute(
		runtime,
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
			PATH: `${dirname(runtime)}:/usr/bin:/bin`,
			VERSIONLESS_NETWORK_MODE: 'offline',
			NPM_CONFIG_OFFLINE: 'true',
			YARN_ENABLE_NETWORK: '0',
			SKIP_YARN_COREPACK_CHECK: '1',
			CI: '1',
		},
	);
	if (sha256(await readFile(join(lane, 'yarn.lock'))) !== lockBefore)
		throw new Error('Avataaars frozen install changed yarn.lock');
	await rm(join(lane, '.yarn-cache'), { recursive: true, force: true });
}

async function prepareCompatibility(name: string): Promise<{
	lane: string;
	delta: Record<string, unknown>;
}> {
	const lane = await extractLane(name);
	const before = await fileTree(lane);
	const template = await tarFile(toolTarball, 'package/template/tsconfig.prod.json');
	if (await exists(join(lane, 'tsconfig.prod.json')))
		throw new Error('Avataaars immutable source unexpectedly contains tsconfig.prod.json');
	await writeFile(join(lane, 'tsconfig.prod.json'), template);
	const indexFile = join(lane, 'src/index.tsx');
	let indexSource = await readFile(indexFile, 'utf8');
	indexSource = exactReplace(
		indexSource,
		"import registerServiceWorker from './registerServiceWorker'\n",
		'',
		'compatibility service-worker import',
	);
	indexSource = exactReplace(
		indexSource,
		'  registerServiceWorker()\n',
		'',
		'compatibility service-worker call',
	);
	await writeFile(indexFile, indexSource);
	const publicIndexFile = join(lane, 'public/index.html');
	let publicIndex = await readFile(publicIndexFile, 'utf8');
	publicIndex = exactReplace(
		publicIndex,
		'    <link rel="manifest" href="%PUBLIC_URL%/manifest.json">\n',
		'',
		'compatibility manifest link',
	);
	publicIndex = exactReplace(
		publicIndex,
		'    <link href="%PUBLIC_URL%/favicon.png" rel="icon" sizes="32x32" type="image/png">\n',
		'',
		'compatibility favicon link',
	);
	publicIndex = exactRemoveRange(
		publicIndex,
		'    <link rel="stylesheet"\n',
		'    <script src="https://use.fontawesome.com/6c3a90ea1a.js"></script>\n',
		'compatibility remote stylesheet',
	);
	publicIndex = exactReplace(
		publicIndex,
		'    <script src="https://use.fontawesome.com/6c3a90ea1a.js"></script>\n',
		'',
		'compatibility remote script',
	);
	await writeFile(publicIndexFile, publicIndex);
	await rm(join(lane, 'public/manifest.json'));
	await rm(join(lane, 'public/favicon.png'));
	await applyInteractiveLocalOverlay(lane);
	const after = await fileTree(lane);
	const beforeByPath = new Map(before.map((row) => [row.path, row.sha256]));
	const afterByPath = new Map(after.map((row) => [row.path, row.sha256]));
	const changedPaths = [...new Set([...beforeByPath.keys(), ...afterByPath.keys()])]
		.filter((path) => beforeByPath.get(path) !== afterByPath.get(path))
		.sort(compare);
	const expectedPaths = [
		'public/favicon.png',
		'public/index.html',
		'public/manifest.json',
		'src/components/AvatarForm.tsx',
		'src/components/ComponentImg.tsx',
		'src/index.tsx',
		'tsconfig.prod.json',
	].sort(compare);
	if (
		canonicalize(changedPaths) !== canonicalize(expectedPaths) ||
		afterByPath.get('tsconfig.prod.json') !==
			'ec5f058d32e5234028d56467b0c9368cedf45d5e8dbe79f43e290a9e3d4487b8'
	)
		throw new Error('Avataaars compatibility local-only source overlay differs');
	return {
		lane,
		delta: {
			missingSourcePath: 'tsconfig.prod.json',
			generatedPath: 'tsconfig.prod.json',
			templateSha256: afterByPath.get('tsconfig.prod.json'),
			toolTarballSha256: 'ad87c3d275846a8a56ea0eb42d84634ebeb685bb25b8992ae47624aef9a7de9d',
			changedFiles: changedPaths,
			removedFiles: ['public/favicon.png', 'public/manifest.json'],
			serviceWorkerRegistration: 'removed',
			remoteRuntimeSurfaces: 'removed-or-localized',
		},
	};
}

async function buildCompatibility(
	lane: string,
): Promise<{ digest: string; toolOverlay: { beforeSha256: string; afterSha256: string } }> {
	const webpackConfig = join(lane, 'node_modules/react-scripts-ts/config/webpack.config.prod.js');
	const webpackBefore = await readFile(webpackConfig, 'utf8');
	let webpackAfter = exactReplace(
		webpackBefore,
		"const SWPrecacheWebpackPlugin = require('sw-precache-webpack-plugin');\n",
		'',
		'compatibility SWPrecache import',
	);
	webpackAfter = exactRemoveRange(
		webpackAfter,
		'    // Generate a service worker script that will precache, and keep up to date,\n',
		'    // Moment.js is an extremely popular library that bundles large locale files\n',
		'compatibility SWPrecache plugin',
	);
	await writeFile(webpackConfig, webpackAfter);
	await execute(node16, [join(lane, 'node_modules/react-scripts-ts/scripts/build.js')], lane, {
		PATH: `${dirname(node16)}:/usr/bin:/bin`,
		VERSIONLESS_NETWORK_MODE: 'offline',
		NPM_CONFIG_OFFLINE: 'true',
		CI: '1',
		GENERATE_SOURCEMAP: 'false',
		REACT_APP_IMG_RENDERER_URL: '',
	});
	const output = await fileTree(join(lane, 'build'));
	const indexHtml = await readFile(join(lane, 'build/index.html'), 'utf8');
	if (
		output.some((row) => basename(row.path) === 'service-worker.js') ||
		[
			'maxcdn.bootstrapcdn.com',
			'use.fontawesome.com',
			'platform.twitter.com/widgets',
			'manifest.json',
			'favicon.png',
		].some((surface) => indexHtml.includes(surface))
	)
		throw new Error('Avataaars compatibility build is not SW-free and local-only');
	return {
		digest: sha256(canonicalize(output)),
		toolOverlay: {
			beforeSha256: sha256(webpackBefore),
			afterSha256: sha256(webpackAfter),
		},
	};
}

async function prepareTarget(
	name: string,
	target: Awaited<ReturnType<typeof loadTargetClosure>>,
): Promise<{
	lane: string;
	transform: ReturnType<typeof transformAvataaarsReact18>;
	delta: string[];
}> {
	const lane = await extractLane(name);
	const packageFile = join(lane, 'package.json');
	const lockFile = join(lane, 'yarn.lock');
	let packageText = await readFile(packageFile, 'utf8');
	packageText = exactReplace(
		packageText,
		'"react": "^17.0.0"',
		'"react": "18.3.1"',
		'package React',
	);
	packageText = exactReplace(
		packageText,
		'"react-dom": "^17.0.0"',
		'"react-dom": "18.3.1"',
		'package ReactDOM',
	);
	await writeFile(packageFile, packageText);
	await writeFile(
		lockFile,
		createAvataaarsReact1831LockDelta(
			await readFile(lockFile, 'utf8'),
			target.closure.artifacts,
		),
	);
	const indexFile = join(lane, 'src/index.tsx');
	const appFile = join(lane, 'src/components/App.tsx');
	const transform = transformAvataaarsReact18({
		index: await readFile(indexFile, 'utf8'),
		app: await readFile(appFile, 'utf8'),
	});
	if (
		!transform.changed ||
		transform.index.edits.length !== 3 ||
		transform.app.edits.length !== 1
	)
		throw new Error('Avataaars target transform differs');
	await writeFile(indexFile, transform.index.code);
	await writeFile(appFile, transform.app.code);
	const localOverlay = await applyInteractiveLocalOverlay(lane);
	await writeFile(
		join(lane, 'index.html'),
		"<!doctype html><html><head><meta charset='UTF-8'><title>Avataaars Generator</title></head><body><div id='root'></div><script type='module' src='/src/index.tsx'></script></body></html>\n",
	);
	return {
		lane,
		transform,
		delta: [
			'index.html',
			'package.json',
			...localOverlay,
			'src/components/App.tsx',
			'src/index.tsx',
			'yarn.lock',
		],
	};
}

async function buildTarget(lane: string): Promise<string> {
	for (const [name, version] of [
		['react', '18.3.1'],
		['react-dom', '18.3.1'],
		['scheduler', '0.23.2'],
	] as const) {
		const manifest = JSON.parse(
			await readFile(join(lane, 'node_modules', name, 'package.json'), 'utf8'),
		) as {
			version?: string;
		};
		if (manifest.version !== version)
			throw new Error(`Avataaars target resolved ${name} differs`);
	}
	await execute(process.execPath, [vite, 'build', '--config', viteConfig], root, {
		...process.env,
		VERSIONLESS_NETWORK_MODE: 'offline',
		NPM_CONFIG_OFFLINE: 'true',
		VERSIONLESS_AVATAAARS_COMPATIBILITY_ROOT: lane,
	});
	const output = await fileTree(join(lane, 'dist-target'));
	if (output.some((row) => basename(row.path) === 'service-worker.js'))
		throw new Error('Avataaars target unexpectedly emitted a service worker');
	return sha256(canonicalize(output));
}

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

function adaptBlockedPage(page: Page, evidence: BrowserEvidence): WitnessBrowserPage {
	const consoles: Array<(message: BrowserConsoleMessage) => void> = [];
	const errors: Array<(error: BrowserPageError) => void> = [];
	const failures: Array<(failure: BrowserRequestFailure) => void> = [];
	const requests: Array<(request: BrowserNetworkRequest) => void> = [];
	const navigations: Array<(url: string) => void> = [];
	const starts = new WeakMap<Request, number>();
	page.on('console', (message) =>
		consoles.forEach((listener) => listener({ level: message.type(), text: message.text() })),
	);
	page.on('pageerror', (error) =>
		errors.forEach((listener) => listener({ message: error.message })),
	);
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
	page.on('requestfinished', (request) => {
		void requestRecord(request, starts.get(request) ?? Date.now()).then((record) =>
			requests.forEach((listener) => listener(record)),
		);
	});
	page.on('framenavigated', (frame) => {
		if (frame === page.mainFrame()) navigations.forEach((listener) => listener(frame.url()));
	});
	return {
		goto: async (url) => void (await page.goto(url, { waitUntil: 'domcontentloaded' })),
		reload: async () => void (await page.reload({ waitUntil: 'domcontentloaded' })),
		content: async () => {
			const readback = (await page.evaluate(() => {
				const textarea = document.querySelector('textarea');
				const topType = document.querySelector("select[id='topType']");
				return {
					svgOuterHtml: document.querySelector('main svg')?.outerHTML ?? null,
					textareaValue: textarea instanceof HTMLTextAreaElement ? textarea.value : null,
					topTypeValue: topType instanceof HTMLSelectElement ? topType.value : null,
					url: location.href,
				};
			})) as BrowserEvidence['readbacks'][number];
			evidence.readbacks.push(readback);
			return await page.content();
		},
		screenshot: async (file) => void (await page.screenshot({ path: file })),
		evaluate: (expression) => page.evaluate(expression),
		waitForExpression: async (expression, timeout) =>
			void (await page.waitForFunction(expression, undefined, { timeout })),
		click: async (selector, timeout) => {
			const locator = page.locator(selector).first();
			if (selector === 'button:has-text("SVG")') {
				const [download] = await Promise.all([
					page.waitForEvent('download', { timeout }),
					locator.click({ timeout }),
				]);
				const stream = await download.createReadStream();
				const chunks: Buffer[] = [];
				for await (const chunk of stream) chunks.push(Buffer.from(chunk));
				const bytes = Buffer.concat(chunks);
				evidence.downloads.push({
					filename: download.suggestedFilename(),
					sha256: sha256(bytes),
					byteLength: bytes.byteLength,
				});
				return;
			}
			await locator.click({ timeout });
		},
		type: async (selector, text, options, timeout) => {
			if (options.clear || !options.keyEvents)
				throw new Error('Avataaars Witness requires key-backed typing');
			const locator = page.locator(selector).first();
			for (const character of text) await locator.press(character, { timeout });
			return { passwordField: (await locator.getAttribute('type')) === 'password' };
		},
		hover: async (selector, _modifiers, timeout) =>
			void (await page.locator(selector).first().hover({ timeout })),
		press: async (selector, key, modifiers, timeout) => {
			const chord = [
				...(modifiers & 1 ? ['Alt'] : []),
				...(modifiers & 2 ? ['Control'] : []),
				...(modifiers & 4 ? ['Meta'] : []),
				...(modifiers & 8 ? ['Shift'] : []),
				key,
			].join('+');
			await page.locator(selector).first().press(chord, { timeout });
		},
		drag: async () => {
			throw new Error('drag is not-tested because Avataaars exposes no genuine drag surface');
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
			const telemetry = (await page.evaluate(async () => ({
				registrations: (await navigator.serviceWorker.getRegistrations()).length,
				controller: navigator.serviceWorker.controller?.state ?? null,
				cacheNames: (await caches.keys()).sort(),
			}))) as ServiceWorkerEvidence;
			evidence.serviceWorkers.push(telemetry);
			await page.close();
		},
	};
}

function blockedWitnessBrowser(evidence: BrowserEvidence): WitnessBrowser {
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
				newPage: async () => adaptBlockedPage(await context.newPage(), evidence),
				close: async () => {
					await context.close();
					await browser.close();
				},
			};
		},
	};
}

function mime(file: string): string {
	if (extname(file) === '.html') return 'text/html; charset=utf-8';
	if (extname(file) === '.js') return 'text/javascript; charset=utf-8';
	if (extname(file) === '.css') return 'text/css; charset=utf-8';
	if (extname(file) === '.json') return 'application/json';
	return 'application/octet-stream';
}

async function serve(directory: string) {
	const requests: Array<{ path: string; status: number }> = [];
	const server = createServer(async (request, response) => {
		try {
			const pathname = parseURL(request.url ?? '/').pathname;
			const candidate = pathname === '/' ? 'index.html' : pathname.slice(1);
			const absolute = resolve(directory, candidate);
			if (!absolute.startsWith(`${directory}/`)) throw new Error('unsafe path');
			const present = (await stat(absolute).catch(() => undefined))?.isFile() === true;
			const file = present ? absolute : join(directory, 'index.html');
			const status = present || pathname === '/' ? 200 : 404;
			requests.push({ path: pathname, status });
			response.writeHead(status, { 'content-type': mime(file) });
			response.end(await readFile(file));
		} catch {
			response.writeHead(404);
			response.end('not found');
		}
	});
	await new Promise<void>((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise));
	const address = server.address();
	if (!address || typeof address === 'string')
		throw new Error('Avataaars server address differs');
	return {
		url: `http://127.0.0.1:${address.port}`,
		requests,
		close: async () =>
			await new Promise<void>((resolvePromise, reject) =>
				server.close((error) => (error ? reject(error) : resolvePromise())),
			),
	};
}

function receiptPages(value: unknown): PageRecord[] {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
	const object = value as Record<string, unknown>;
	if (Array.isArray(object.pages)) return object.pages as PageRecord[];
	for (const nested of Object.values(object)) {
		if (Array.isArray(nested)) {
			for (const item of nested) {
				const pages = receiptPages(item);
				if (pages.length) return pages;
			}
		} else {
			const pages = receiptPages(nested);
			if (pages.length) return pages;
		}
	}
	return [];
}

export function assertAvataaarsServiceWorkerEvidence(
	evidence: BrowserEvidence,
	serverRequests: Array<{ path: string; status: number }>,
	expectedPages = 1,
): void {
	if (
		evidence.serviceWorkers.length !== expectedPages ||
		evidence.serviceWorkers.some(
			(row) =>
				row.registrations !== 0 || row.controller !== null || row.cacheNames.length !== 0,
		) ||
		evidence.successfulNonLoopback !== 0
	)
		throw new Error('Avataaars service-worker or locality boundary differs');
	const attempts = serverRequests.filter((row) => row.path === '/service-worker.js');
	if (attempts.length !== 0) throw new Error('Avataaars service-worker request evidence differs');
}

async function witnessJourney(
	directory: string,
	lane: 'compatibility' | 'migrated',
	pass: number,
	journey: AvataaarsJourney,
): Promise<Record<string, unknown>> {
	const server = await serve(directory);
	const browserEvidence: BrowserEvidence = {
		serviceWorkers: [],
		attemptedNonLoopback: [],
		successfulNonLoopback: 0,
		downloads: [],
		readbacks: [],
	};
	let beforeSvg = '';
	let afterSvg = '';
	let generatedCode = '';
	let rendererSvg = '';
	const definition = box(`react-avataaars-${lane}-${journey}-${pass}`, async (context) => {
		const page = await context.browser.visit(
			journey === 'selection-history'
				? server.url
				: `${server.url}/?avatarStyle=Transparent&topType=Eyepatch`,
		);
		await page.trackEvents('click', 'change', 'keydown');
		await context.expect.page.count(page, 'main svg', 1);
		await page.content();
		beforeSvg = browserEvidence.readbacks.at(-1)?.svgOuterHtml ?? '';
		if (journey === 'customization-renderer') {
			await context.expect.page.exists(page, '#avatar-style-transparent:checked');
			await context.expect.page.exists(
				page,
				"select[id='topType'] option[value='Eyepatch']:checked",
			);
			await page.click('button:has-text("SVG")');
			if (
				browserEvidence.downloads.length !== 1 ||
				browserEvidence.downloads[0]?.filename !== 'avataaars.svg' ||
				(browserEvidence.downloads[0]?.byteLength ?? 0) < 100
			)
				throw new Error('Avataaars SVG download evidence differs');
			const renderer = await context.browser.visit(
				`${server.url}/?__render__=1&avatarStyle=Transparent&topType=Eyepatch`,
			);
			await context.expect.page.count(renderer, 'main svg', 1);
			await context.expect.page.count(renderer, 'form', 0);
			await renderer.content();
			rendererSvg = browserEvidence.readbacks.at(-1)?.svgOuterHtml ?? '';
			if (!rendererSvg) throw new Error('Avataaars __render__ SVG evidence differs');
			await context.receipt.capture('customization-svg-download-renderer');
			return;
		}
		await page.click('#avatar-style-transparent');
		await page.click("select[id='topType']");
		await page.press("select[id='topType']", 'e');
		await page.press("select[id='topType']", 'Enter');
		await context.expect.page.exists(
			page,
			"select[id='topType'] option[value='Eyepatch']:checked",
		);
		await page.content();
		afterSvg = browserEvidence.readbacks.at(-1)?.svgOuterHtml ?? '';
		assertAvataaarsShowReactSelector(AVATAAARS_SHOW_REACT_SELECTOR, ['Show React']);
		await context.expect.page.count(page, AVATAAARS_SHOW_REACT_SELECTOR, 1);
		await page.click(AVATAAARS_SHOW_REACT_SELECTOR);
		await context.expect.page.exists(page, 'textarea');
		await page.content();
		generatedCode = browserEvidence.readbacks.at(-1)?.textareaValue ?? '';
		if (
			!generatedCode.includes("avatarStyle='Transparent'") ||
			!generatedCode.includes("topType='Eyepatch'")
		)
			throw new Error('Avataaars direct-Witness generated React code differs');
		assertAvataaarsTransparentWrappingLabelSelector(
			AVATAAARS_TRANSPARENT_WRAPPING_LABEL_SELECTOR,
			[{ relation: 'wrapped', id: 'avatar-style-transparent', checked: true }],
		);
		await context.expect.page.count(page, AVATAAARS_TRANSPARENT_WRAPPING_LABEL_SELECTOR, 1);
		await page.press('body', 'ArrowLeft', { modifiers: ['Alt'] });
		await page.content();
		const back = browserEvidence.readbacks.at(-1);
		if (!back || back.url.includes('topType=Eyepatch') || back.topTypeValue === 'Eyepatch')
			throw new Error('Avataaars history back state differs');
		await page.reload();
		await context.expect.page.exists(page, '#avatar-style-transparent:checked');
		await page.content();
		const reloaded = browserEvidence.readbacks.at(-1);
		if (
			!reloaded ||
			reloaded.url.includes('topType=Eyepatch') ||
			reloaded.topTypeValue === 'Eyepatch'
		)
			throw new Error('Avataaars history back reload state differs');
		await context.expect.page.outcome(page, {
			events: { click: { atLeast: 3 }, change: { atLeast: 2 }, keydown: { atLeast: 1 } },
		});
		await context.receipt.capture('transparent-eyepatch-history-back-reload');
	});
	let result: Awaited<ReturnType<typeof runBoxes>>;
	try {
		await verifyAvataaarsProtectedNegativeEvidence();
		result = await runBoxes({
			root: directory,
			boxes: [
				{
					file: join(directory, `versionless-avataaars-${journey}.box.ts`),
					relativeFile: `versionless-avataaars-${journey}.box.ts`,
					exportName: 'default',
					box: definition,
				},
			],
			receiptDir: join(workRoot, 'witness-receipts', lane, `pass-${pass}`, journey),
			assertionTimeoutMs: 10_000,
			fileSystem: witnessNodeFileSystem,
			browser: blockedWitnessBrowser(browserEvidence),
			headless: true,
		});
	} finally {
		await server.close();
	}
	if (result.status !== 'passed')
		throw new Error(
			`Avataaars Witness journey failed: ${result.boxes[0]?.error?.message ?? 'unknown'}`,
		);
	assertAvataaarsServiceWorkerEvidence(
		browserEvidence,
		server.requests,
		journey === 'customization-renderer' ? 2 : 1,
	);
	if (
		!beforeSvg ||
		(journey === 'selection-history' && (!afterSvg || sha256(beforeSvg) === sha256(afterSvg)))
	)
		throw new Error('Avataaars exact rendered SVG did not change');
	if (
		journey === 'selection-history' &&
		(!generatedCode.includes("avatarStyle='Transparent'") ||
			!generatedCode.includes("topType='Eyepatch'"))
	)
		throw new Error('Avataaars exact generated React code differs');
	const raw = JSON.parse(await readFile(result.receiptPath, 'utf8')) as unknown;
	const pages = receiptPages(raw);
	if (
		pages.length !== (journey === 'customization-renderer' ? 2 : 1) ||
		!browserEvidence.readbacks.some((readback) => {
			const query = parseURL(readback.url).search;
			return query.includes('avatarStyle=Transparent') && query.includes('topType=Eyepatch');
		})
	)
		throw new Error('Avataaars Witness URL query persistence evidence differs');
	if (pages.some((page) => page.pageErrors.length !== 0))
		throw new Error('Avataaars Witness page errors differ');
	const failedRequests = pages.flatMap((page) => page.failedRequests);
	const failedPaths = failedRequests
		.map((request) => {
			const parsed = parseURL(request.url);
			return `${parsed.host ?? ''}${parsed.pathname}`;
		})
		.sort(compare);
	if (failedPaths.length !== 0)
		throw new Error('Avataaars Witness failed-request inventory differs');
	const consoleMessages = pages.flatMap((page) => page.consoleMessages);
	if (consoleMessages.some((message) => message.level === 'error'))
		throw new Error('Avataaars Witness console-error inventory differs');
	const interactions = pages.flatMap((page) => page.interactions);
	return {
		lane,
		pass,
		journey,
		result: 'pass',
		receiptSha256: sha256(await readFile(result.receiptPath)),
		beforeSvgSha256: sha256(beforeSvg),
		...(journey === 'selection-history'
			? {
					afterSvgSha256: sha256(afterSvg),
					generatedCodeSha256: sha256(generatedCode),
					generatedCode: {
						avatarStyle: 'Transparent',
						topType: 'Eyepatch',
						visible: true,
					},
					renderedSvgChanged: true,
					historyBack: true,
					reloadPersistence: true,
				}
			: {
					rendererSvgSha256: sha256(rendererSvg),
					download: browserEvidence.downloads[0],
					customizationQuery: true,
					rendererMode: '__render__=1',
				}),
		interactions,
		queryNavigation: browserEvidence.readbacks.map((row) => parseURL(row.url).search),
		consoleMessages,
		pageErrors: pages.flatMap((page) => page.pageErrors),
		failedRequests: failedRequests.map((request) => {
			const parsed = parseURL(request.url);
			return {
				method: request.method,
				host: parsed.host ?? '',
				path: parsed.pathname,
				reason: request.reason,
			};
		}),
		serviceWorkers: browserEvidence.serviceWorkers,
		legacyServiceWorkerRequest: false,
		accessibilityLabels: true,
		successfulNonLoopback: 0,
		blockedNonLoopback: browserEvidence.attemptedNonLoopback.map(
			(url) => parseURL(url).pathname,
		),
		drag: 'not-tested-no-genuine-surface',
		twitterRoute: 'not-tested-deliberately-not-exercised',
	};
}

async function artifact(name: string, value: unknown): Promise<{ path: string; sha256: string }> {
	const file = join(outputStage, 'artifacts', name);
	await writeFile(file, canonical(value));
	return {
		path: `evidence/runs/react-avataaars-compatibility-to-vite8/t608/artifacts/${name}`,
		sha256: sha256(await readFile(file)),
	};
}

type AvataaarsPublicationOptions = {
	aggregateFile: string;
	positiveOutput: string;
	trustReplayDirectory: string;
	trustCurrentDirectory: string;
	analyze: () => Promise<unknown>;
	generate: (outputDir: string, observedAt: string) => Promise<unknown>;
	verify: (outputDir: string, compareDir: string, observedAt: string) => Promise<unknown>;
	now: () => string;
};

export async function publishAvataaarsAggregateAndTrust(
	receiptDigest: string,
	options: AvataaarsPublicationOptions = {
		aggregateFile: aggregatePath,
		positiveOutput: outputRoot,
		trustReplayDirectory: trustReplayRoot,
		trustCurrentDirectory: trustCurrent,
		analyze: async () => await analyzeCorpusConformance({ rootDir: root }),
		generate: async (outputDir, observedAt) =>
			await generateTrustPackage({
				rootDir: root,
				policyPath: 'trust/policy.json',
				outputDir,
				offline: true,
				environment: { ...process.env, VERSIONLESS_NETWORK_MODE: 'offline' },
				observedAt,
			}),
		verify: async (outputDir, compareDir, observedAt) =>
			await verifyTrustPackage({
				rootDir: root,
				outputDir,
				compareDir,
				environment: { ...process.env, VERSIONLESS_NETWORK_MODE: 'offline' },
				now: observedAt,
			}),
		now: () => new Date().toISOString(),
	},
): Promise<void> {
	const aggregateBytes = await readFile(options.aggregateFile);
	const aggregate = JSON.parse(aggregateBytes.toString('utf8')) as {
		schemaVersion: string;
		fixtures: Array<Record<string, unknown>>;
		unsupported: unknown[];
	};
	if (
		aggregate.schemaVersion !== 'versionless.aggregate.v1' ||
		!Array.isArray(aggregate.fixtures) ||
		aggregate.fixtures.some(
			(item) =>
				item.receipt ===
				'evidence/runs/react-avataaars-compatibility-to-vite8/t608/receipt.json',
		)
	)
		throw new Error('Avataaars aggregate prepublication state differs');
	const updated = {
		...aggregate,
		fixtures: [
			...aggregate.fixtures,
			reactAvataaarsCompatibilityAggregateMember(receiptDigest),
		],
	};
	const stage = join(options.trustReplayDirectory, 'stage');
	const replay = join(options.trustReplayDirectory, 'replay');
	const backup = join(options.trustReplayDirectory, 'current-backup');
	await rm(options.trustReplayDirectory, { recursive: true, force: true });
	await mkdir(options.trustReplayDirectory, { recursive: true });
	const aggregateStage = join(options.trustReplayDirectory, 'aggregate.json');
	await writeFile(aggregateStage, `${JSON.stringify(updated, null, 2)}\n`);
	await rename(aggregateStage, options.aggregateFile);
	try {
		await options.analyze();
		const observedAt = options.now();
		for (const outputDir of [stage, replay]) await options.generate(outputDir, observedAt);
		await options.verify(stage, replay, observedAt);
		await rename(options.trustCurrentDirectory, backup);
		try {
			await rename(stage, options.trustCurrentDirectory);
		} catch (error) {
			await rename(backup, options.trustCurrentDirectory);
			throw error;
		}
		await rm(backup, { recursive: true, force: true });
		await rm(options.trustReplayDirectory, { recursive: true, force: true });
	} catch (error) {
		if (await exists(backup)) {
			await rm(options.trustCurrentDirectory, { recursive: true, force: true });
			await rename(backup, options.trustCurrentDirectory);
		}
		await writeFile(options.aggregateFile, aggregateBytes);
		await rm(options.positiveOutput, { recursive: true, force: true });
		await rm(options.trustReplayDirectory, { recursive: true, force: true });
		throw error;
	}
}

export async function runReactAvataaarsCompatibility(): Promise<Record<string, unknown>> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true' ||
		process.env.CI !== '1' ||
		process.env.VERSIONLESS_CONSENT_ID
	)
		throw new Error('T608 execution requires consent-free offline CI mode');
	for (const target of [workRoot, outputStage, outputRoot])
		if (await exists(target)) throw new Error(`T608 residue exists: ${relative(root, target)}`);
	await mkdir(workRoot, { recursive: true });
	await mkdir(join(outputStage, 'artifacts'), { recursive: true });
	try {
		const acquisitionFirst = await verifyAvataaarsReact1831Acquisition();
		const acquisitionSecond = await verifyAvataaarsReact1831Acquisition();
		if (canonicalize(acquisitionFirst) !== canonicalize(acquisitionSecond))
			throw new Error('Avataaars T608 acquisition verification differs');
		const publishedLegacyFirst = await verifyPublishedAvataaarsClosure();
		const publishedLegacySecond = await verifyPublishedAvataaarsClosure();
		if (
			publishedLegacyFirst.integrity.canonicalDigest !==
				publishedLegacySecond.integrity.canonicalDigest ||
			canonicalize(publishedLegacyFirst) !== canonicalize(publishedLegacySecond)
		)
			throw new Error('Avataaars published 1,222-artifact closure replay differs');
		const immutableFirst = {
			...(await verifyImmutableInputs()),
			publishedLegacyClosureDigest: publishedLegacyFirst.integrity.canonicalDigest,
			publishedLegacyArtifacts: publishedLegacyFirst.artifacts.length,
		};
		const immutableSecond = {
			...(await verifyImmutableInputs()),
			publishedLegacyClosureDigest: publishedLegacySecond.integrity.canonicalDigest,
			publishedLegacyArtifacts: publishedLegacySecond.artifacts.length,
		};
		if (canonicalize(immutableFirst) !== canonicalize(immutableSecond))
			throw new Error('Avataaars immutable verification passes differ');
		const targetFirst = await loadTargetClosure();
		const targetSecond = await loadTargetClosure();
		if (canonicalize(targetFirst.closure) !== canonicalize(targetSecond.closure))
			throw new Error('Avataaars target closure replay differs');
		const mirror = await prepareMirror(targetFirst);
		const compatibility1 = await prepareCompatibility('compatibility-1');
		const compatibility2 = await prepareCompatibility('compatibility-2');
		await installLane(compatibility1.lane, join(legacyClosureRoot, 'mirror'), node16);
		await installLane(compatibility2.lane, join(legacyClosureRoot, 'mirror'), node16);
		const compatibilityBuild1 = await buildCompatibility(compatibility1.lane);
		const compatibilityBuild2 = await buildCompatibility(compatibility2.lane);
		if (canonicalize(compatibilityBuild1) !== canonicalize(compatibilityBuild2))
			throw new Error('Avataaars compatibility production builds differ');
		const target1 = await prepareTarget('migrated-1', targetFirst);
		const target2 = await prepareTarget('migrated-2', targetFirst);
		await installLane(target1.lane, mirror, process.execPath);
		await installLane(target2.lane, mirror, process.execPath);
		const targetDigest1 = await buildTarget(target1.lane);
		const targetDigest2 = await buildTarget(target2.lane);
		if (targetDigest1 !== targetDigest2) throw new Error('Avataaars target Vite builds differ');
		const witness = [
			await witnessJourney(
				join(compatibility1.lane, 'build'),
				'compatibility',
				1,
				'selection-history',
			),
			await witnessJourney(
				join(compatibility1.lane, 'build'),
				'compatibility',
				1,
				'customization-renderer',
			),
			await witnessJourney(
				join(compatibility2.lane, 'build'),
				'compatibility',
				2,
				'selection-history',
			),
			await witnessJourney(
				join(compatibility2.lane, 'build'),
				'compatibility',
				2,
				'customization-renderer',
			),
			await witnessJourney(
				join(target1.lane, 'dist-target'),
				'migrated',
				1,
				'selection-history',
			),
			await witnessJourney(
				join(target1.lane, 'dist-target'),
				'migrated',
				1,
				'customization-renderer',
			),
			await witnessJourney(
				join(target2.lane, 'dist-target'),
				'migrated',
				2,
				'selection-history',
			),
			await witnessJourney(
				join(target2.lane, 'dist-target'),
				'migrated',
				2,
				'customization-renderer',
			),
		];
		const targetApp = join(target2.lane, 'src/components/App.tsx');
		const restored = await readFile(targetApp);
		const mutation = exactReplace(
			restored.toString('utf8'),
			'history.listen(() => forceUpdate())',
			'history.listen(() => undefined)',
			'mutation listener',
		);
		let mutationRed = false;
		try {
			await writeFile(targetApp, mutation);
			await buildTarget(target2.lane);
			await witnessJourney(
				join(target2.lane, 'dist-target'),
				'migrated',
				3,
				'selection-history',
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (
				!message.includes('generated React code differs') &&
				!message.includes('exact rendered SVG did not change') &&
				!message.includes('URL query persistence evidence differs') &&
				!message.includes('history back state differs')
			)
				throw error;
			mutationRed = true;
		} finally {
			await writeFile(targetApp, restored);
		}
		if (!mutationRed || sha256(await readFile(targetApp)) !== sha256(restored))
			throw new Error('Avataaars mutation did not become red and restore byte-exactly');
		const restoredDigest = await buildTarget(target2.lane);
		if (restoredDigest !== targetDigest2)
			throw new Error('Avataaars restored target build digest differs');
		const restoredWitness = [
			await witnessJourney(
				join(target2.lane, 'dist-target'),
				'migrated',
				4,
				'selection-history',
			),
			await witnessJourney(
				join(target2.lane, 'dist-target'),
				'migrated',
				4,
				'customization-renderer',
			),
		];
		const provenance = await verifyLinkedWitnessProvenance(root);
		const supports = [
			await artifact('provenance.json', {
				source: immutableFirst,
				acquisition: acquisitionFirst,
				targetClosure: {
					digest: targetFirst.closure.integrity.canonicalDigest,
					receiptSha256: targetFirst.receiptSha256,
					artifacts: targetFirst.closure.artifacts,
					consent: targetFirst.closure.consent,
					nonclaims: targetFirst.closure.nonclaims,
				},
				linkedWitness: provenance,
				authorship: 'unknown',
				certification: false,
				signerAuthenticity: false,
			}),
			await artifact('compatibility-baseline.json', {
				classification: 'unsupported-source-commit',
				sourceCommitExecution: 'not-executed',
				compatibilityExecution: 'generated-config-plus-local-only-overlay',
				deltas: [compatibility1.delta, compatibility2.delta],
				runtime: '16.20.2',
				bundler: 'react-scripts-ts-3.1.0-webpack',
				digests: [compatibilityBuild1.digest, compatibilityBuild2.digest],
				toolOverlays: [compatibilityBuild1.toolOverlay, compatibilityBuild2.toolOverlay],
				deterministic: true,
				legacyServiceWorkerCall: 'removed-by-local-only-overlay',
				serviceWorkerOutput: 'absent',
			}),
			await artifact('migrated-target.json', {
				runtime: process.version.slice(1),
				bundler: 'vite-8.0.16',
				dependencies: { react: '18.3.1', 'react-dom': '18.3.1', scheduler: '0.23.2' },
				digests: [targetDigest1, targetDigest2],
				deterministic: true,
				transforms: [target1.transform, target2.transform],
				delta: target1.delta,
				serviceWorkerRemoval: 'exact-import-and-call-removal',
			}),
			await artifact('witness.json', {
				runs: witness,
				restored: restoredWitness,
				contexts: 8,
				journeys: ['selection-history', 'customization-renderer'],
				directLinkedWitness: true,
				serviceWorkers: 'blocked-and-absent',
				registrations: 0,
				controllers: 0,
				caches: 0,
				successfulNonLoopback: 0,
			}),
			await artifact('mutation-restoration.json', {
				mutation: 'history/query listener replaced by no-op',
				red: true,
				failure: 'witness-query-persistence-red',
				originalSourceSha256: sha256(restored),
				originalBuildDigest: targetDigest2,
				restoredSourceSha256: sha256(restored),
				restoredBuildDigest: restoredDigest,
				restoredWitness,
				green: true,
			}),
		];
		const human = join(outputStage, 'artifacts/receipt.md');
		await writeFile(
			human,
			'# React Avataaars compatibility baseline to Vite 8\n\nThe immutable commit remains unsupported and not executed as-authored because `tsconfig.prod.json` is absent. Two disposable compatibility worktrees generated only the exact audited react-scripts-ts template and ran the authentic legacy production build. Two migrated worktrees used exact React 18.3.1, ReactDOM 18.3.1, Scheduler 0.23.2 and Vite 8 bytes. Direct linked Witness exercised Transparent and Eyepatch selection, query persistence, SVG/code rendering, reload, locality, service-worker blocking, and mutation/restoration. This is reproducibility evidence, not certification, compliance, authorship, signer authenticity, or OS-wide isolation.\n',
		);
		supports.push({
			path: 'evidence/runs/react-avataaars-compatibility-to-vite8/t608/artifacts/receipt.md',
			sha256: sha256(await readFile(human)),
		});
		const body = {
			schemaVersion: 'versionless.react-avataaars-compatibility-to-vite8.v1',
			runId: 'T608-react-avataaars-compatibility-to-vite8',
			fixture: 'react-avataaars-compatibility',
			result: 'pass',
			counted: false,
			source: {
				repository: 'fangpenlin/avataaars-generator',
				revision: 'c191c6c2d27f41245e803912d43c7213436a34d3',
				tree: '94a3d1a024682b3f21ad30b9de8d4e1541a376d3',
				archiveSha256: immutableFirst.archiveSha256,
			},
			qualification: {
				compatibilityBuilds: 2,
				migratedBuilds: 2,
				compatibilityWitnessRuns: 4,
				migratedWitnessRuns: 4,
				mutationRestoration: 'pass',
				successfulNonLoopback: 0,
			},
			artifacts: supports,
			limitations: [
				'Immutable source commit remains unsupported-source-commit/not-executed.',
				'Compatibility baseline is limited to one provenance-bound generated config file.',
				'Authorship is unknown; certification and signer authenticity are false.',
				'Locality evidence is process/browser scoped and is not OS-wide isolation.',
			],
		};
		const receipt = {
			...body,
			integrity: {
				algorithm: 'sha256',
				canonicalDigest: sha256(canonicalize(body)),
				authenticity: 'not-established',
			},
		};
		await writeFile(join(outputStage, 'receipt.json'), canonical(receipt));
		parseReactAvataaarsCompatibilityReceipt(receipt);
		const immutableFinal = {
			...(await verifyImmutableInputs()),
			publishedLegacyClosureDigest: publishedLegacyFirst.integrity.canonicalDigest,
			publishedLegacyArtifacts: publishedLegacyFirst.artifacts.length,
		};
		if (canonicalize(immutableFinal) !== canonicalize(immutableFirst))
			throw new Error('Avataaars immutable inputs changed during execution');
		await rename(outputStage, outputRoot);
		const verified = await verifyReactAvataaarsCompatibilityEvidence(root);
		await publishAvataaarsAggregateAndTrust(verified.digest);
		return receipt;
	} catch (error) {
		await rm(outputStage, { recursive: true, force: true });
		await rm(outputRoot, { recursive: true, force: true });
		throw error;
	} finally {
		await rm(workRoot, { recursive: true, force: true });
	}
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	if (args.length !== 1 || args[0] !== '--run') throw new Error('T608 requires exact --run mode');
	const receipt = await runReactAvataaarsCompatibility();
	process.stdout.write(canonical({ result: receipt.result, integrity: receipt.integrity }));
}

if (process.argv[1] && basename(process.argv[1]) === 'react-avataaars-compatibility-run.ts')
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
