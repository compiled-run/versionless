/**
 * The lane composition: the two files that turn a materialised changeset into a
 * tree this pipeline can install and build.
 *
 * Before this module the `migrate` flow emitted the frozen adapter's changeset
 * and nothing else, which on the admitted comparator meant "1 file written
 * (index.html), 167 copied, 0 removed, and the lane's package.json still
 * declares react-scripts ^3.4.1 with no Vite configuration"
 * (`evidence/spikes/thin-wrapper-cost/verdict.json`, finding C4). The Vite-era
 * configuration and the manifest rewrite lived in per-application fixture code
 * — 18 to 318 lines of it per application — which is per-application authoring
 * by construction.
 *
 * Two boundaries are deliberate.
 *
 * These files are **not** part of the frozen adapter's changeset. The adapter
 * composes what an application's own sources must become; this module composes
 * the build configuration the lane needs in order to be built at all. Folding
 * the second into the first would blur the line the byte-identity proof between
 * the operator flow and the fixture drivers stands on, so the lane files are
 * reported as their own stage with their own findings.
 *
 * Nothing the generic composition cannot cover is silently dropped. A per
 * application plugin, preprocessor, path alias or build override that the
 * 28-line generic shape does not carry is emitted as a named `unhandled`
 * finding. A lane that builds because a finding was quietly omitted would be
 * worse than a lane that does not build.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { parseURL } from 'ufo';
import type { CraEnvironment } from '../../../frameworks/react/src/index.ts';
import { directoryExists, fileExists, readJsonFile, UNKNOWN } from './analyze.ts';
import { craBuildEnvironment } from './plan.ts';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

/** The frozen React barrel the generated configuration composes, repo-relative. */
export const FROZEN_REACT_ADAPTER_SOURCE = 'packages/frameworks/react/src/index.ts';

/** The build output directory the generated configuration writes into. */
export const LANE_BUILD_DIRECTORY = 'build-vite';

/** This workspace's own root, so the generated lane can pin what it resolves. */
export const workspaceRoot = (): string => path.resolve(import.meta.dirname, '../../../..');

export type LaneFile = Readonly<{
	path: string;
	source: string;
	sha256: string;
	changes: readonly string[];
}>;

export type LaneComposition = Readonly<{
	/** The lineage this composer covers, or `null` when it covers none of it. */
	lineage: string;
	/** False when no lane file is composed; `reason` then says why. */
	composed: boolean;
	reason: string | null;
	files: readonly LaneFile[];
	unhandled: readonly string[];
	declaredDifferences: readonly string[];
	notEstablished: readonly string[];
}>;

const LANE_NOT_ESTABLISHED: readonly string[] = Object.freeze([
	'A composed build configuration is not a build. Nothing here establishes that the lane installs, compiles, or emits anything; the install and build stages report that separately.',
	'The generated configuration reproduces the generic create-react-app shape over the frozen adapter exports. Every per-application difference it does not carry is listed as an unhandled finding rather than left to be inferred from a failing build.',
	'The generated configuration resolves the frozen adapter from this workspace by relative path, exactly as the fixture configurations do. The lane is therefore buildable by this pipeline and is not a self-contained package; resolving a published @versionless/react is a separate packaging decision this flow does not take.',
]);

/** A JavaScript identifier that needs no quoting as an object key. */
function isPlainIdentifier(value: string): boolean {
	if (value.length === 0) return false;
	for (let index = 0; index < value.length; index += 1) {
		const code = value.charCodeAt(index);
		const alpha = (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95;
		const digit = code >= 48 && code <= 57;
		if (!(alpha || (digit && index > 0))) return false;
	}
	return true;
}

/** A single-quoted string literal, the form this repository's sources use. */
export function quote(value: string): string {
	let escaped = '';
	for (const character of value) {
		if (character === '\\' || character === "'") escaped += `\\${character}`;
		else if (character === '\n') escaped += '\\n';
		else if (character === '\r') escaped += '\\r';
		else escaped += character;
	}
	return `'${escaped}'`;
}

function objectLiteral(record: Readonly<Record<string, string>>): string {
	const keys = Object.keys(record).sort((left, right) => (left < right ? -1 : 1));
	if (keys.length === 0) return '{}';
	const entries = keys.map(
		(key) => `${isPlainIdentifier(key) ? key : quote(key)}: ${quote(record[key] ?? '')}`,
	);
	const single = `{ ${entries.join(', ')} }`;
	if (single.length <= 88) return single;
	return `{\n${entries.map((entry) => `\t${entry},`).join('\n')}\n}`;
}

export type LaneViteConfigOptions = Readonly<{
	/** The specifier the generated file imports the frozen adapter from. */
	adapterModule: string;
	/** The base URL create-react-app would have resolved from `homepage`. */
	base: string;
	/** The public directory the adapter replicates, lane-relative. */
	publicDirectory: string;
	/** The entry document the plan wrote into the lane. */
	templateFile: string;
	/** The environment a create-react-app production build inlines. */
	environment: CraEnvironment;
	/** The build output directory, lane-relative. */
	outDirectory: string;
	/** The application this configuration was generated for. */
	application: string;
}>;

/**
 * The generic create-react-app lane configuration.
 *
 * This is the 28-line shape `fixtures/react-papercups-v1-0-0/vite.config.ts`
 * carries, with every application-specific value supplied as a parameter rather
 * than typed by hand: the base, the public directory, the entry template, the
 * environment create-react-app inlines, and the output directory. The
 * compatibility behaviour itself is entirely the frozen adapter's —
 * `createCraViteAdapter` and `craProcessEnvironmentDefines` are composed
 * unchanged, and this generator adds no capability of its own.
 */
export function composeLaneViteConfig(options: LaneViteConfigOptions): string {
	return `${[
		'/**',
		` * The migrated build lane for ${options.application}.`,
		' *',
		' * Generated by `versionless migrate`. Everything compatibility-shaped here',
		' * comes from the frozen create-react-app adapter in @versionless/react; this',
		" * file carries only the application's own paths and the environment",
		' * create-react-app would have inlined. Any per-application plugin, stylesheet',
		' * preprocessor, path alias or build override this generic composition does not',
		' * carry is reported as a named unhandled finding by the flow that wrote this',
		' * file — it is never silently omitted here.',
		' */',
		'',
		"import * as path from 'pathe';",
		"import { joinURL } from 'ufo';",
		"import { defineConfig } from 'vite';",
		'import {',
		'\tcraProcessEnvironmentDefines,',
		'\tcreateCraViteAdapter,',
		`} from ${quote(options.adapterModule)};`,
		'',
		'const target = process.cwd();',
		`const environment = ${objectLiteral(options.environment)} as const;`,
		'',
		'export default defineConfig({',
		'\troot: target,',
		`\tbase: joinURL('/', ${quote(options.base)}),`,
		'\tpublicDir: false,',
		'\tplugins: [',
		'\t\t...createCraViteAdapter({',
		`\t\t\tpublicDirectory: path.join(target, ${quote(options.publicDirectory)}),`,
		`\t\t\ttemplateFile: ${quote(options.templateFile)},`,
		'\t\t}),',
		'\t],',
		'\tdefine: craProcessEnvironmentDefines(environment),',
		'\tbuild: {',
		`\t\toutDir: path.join(target, ${quote(options.outDirectory)}),`,
		'\t\temptyOutDir: true,',
		'\t\tsourcemap: true,',
		'\t},',
		'});',
	].join('\n')}\n`;
}

/** The indentation the manifest already uses, so the rewrite does not reflow it. */
export function manifestIndent(source: string): string {
	const line = source.split('\n')[1] ?? '';
	let indent = '';
	for (const character of line) {
		if (character !== ' ' && character !== '\t') break;
		indent += character;
	}
	return indent === '' ? '\t' : indent;
}

export type LaneManifestOptions = Readonly<{
	/** The build tool ranges this workspace itself resolves. */
	buildDependencies: Readonly<Record<string, string>>;
	buildScript: string;
	startScript: string;
}>;

export type LaneManifestRewrite = Readonly<{
	source: string;
	changes: readonly string[];
	unhandled: readonly string[];
}>;

const ORIGIN_TOOLCHAIN_PACKAGE = 'react-scripts';

/**
 * Rewrite the lane's manifest so it declares the toolchain the lane actually
 * builds with.
 *
 * The origin declaration is removed rather than left beside the new one: a lane
 * that declares `react-scripts` and a Vite configuration at once tells a reader,
 * a package manager and this repository's own detection three different stories.
 * A script that invoked the removed toolchain is reported as an unhandled
 * finding and dropped, because leaving a script that cannot run is the same
 * silent residue in a different file.
 */
export function composeLaneManifest(
	source: string,
	options: LaneManifestOptions,
): LaneManifestRewrite {
	const manifest = JSON.parse(source) as Record<string, unknown>;
	const changes: string[] = [];
	const unhandled: string[] = [];
	const indent = manifestIndent(source);
	for (const field of ['dependencies', 'devDependencies']) {
		const declared = manifest[field] as Record<string, string> | undefined;
		if (declared === undefined || !Object.hasOwn(declared, ORIGIN_TOOLCHAIN_PACKAGE)) continue;
		changes.push(
			`${field}.${ORIGIN_TOOLCHAIN_PACKAGE} ${declared[ORIGIN_TOOLCHAIN_PACKAGE] ?? UNKNOWN} removed: the lane is built by the frozen create-react-app Vite adapter composition and no longer runs that toolchain`,
		);
		const { [ORIGIN_TOOLCHAIN_PACKAGE]: _removed, ...rest } = declared;
		manifest[field] = rest;
	}
	const devDependencies = { ...((manifest.devDependencies ?? {}) as Record<string, string>) };
	for (const name of Object.keys(options.buildDependencies).sort()) {
		const range = options.buildDependencies[name] as string;
		if (devDependencies[name] === range) continue;
		changes.push(
			`devDependencies.${name} declared as ${range}: the generated lane configuration imports it, pinned to the range this workspace itself resolves`,
		);
		devDependencies[name] = range;
	}
	manifest.devDependencies = Object.fromEntries(
		Object.keys(devDependencies)
			.sort((left, right) => (left < right ? -1 : 1))
			.map((name) => [name, devDependencies[name] as string]),
	);
	const scripts = { ...((manifest.scripts ?? {}) as Record<string, string>) };
	const rewritten: Record<string, string> = {};
	for (const name of Object.keys(scripts)) {
		const command = scripts[name] as string;
		if (name === 'build') {
			rewritten[name] = options.buildScript;
			changes.push(`scripts.build rewritten from ${command} to ${options.buildScript}`);
			continue;
		}
		if (name === 'start' || name === 'dev') {
			rewritten[name] = options.startScript;
			changes.push(`scripts.${name} rewritten from ${command} to ${options.startScript}`);
			continue;
		}
		if (command.includes(ORIGIN_TOOLCHAIN_PACKAGE)) {
			unhandled.push(
				`scripts.${name} invoked the removed origin toolchain (${command}). The lane no longer declares ${ORIGIN_TOOLCHAIN_PACKAGE}, and this rewrite carries no successor for that script, so it is dropped rather than left as a command that cannot run.`,
			);
			changes.push(`scripts.${name} removed: ${command}`);
			continue;
		}
		rewritten[name] = command;
	}
	if (!Object.hasOwn(rewritten, 'build')) {
		rewritten.build = options.buildScript;
		changes.push(
			`scripts.build declared as ${options.buildScript}: the manifest declared none`,
		);
	}
	manifest.scripts = rewritten;
	const eslint = manifest.eslintConfig as Record<string, unknown> | undefined;
	if (eslint !== undefined && JSON.stringify(eslint).includes('react-app'))
		unhandled.push(
			`eslintConfig extends the create-react-app shareable configuration, which ${ORIGIN_TOOLCHAIN_PACKAGE} supplied. The lane no longer declares that package, so the field is preserved verbatim and the configuration it names is not resolvable in the lane.`,
		);
	if (typeof manifest.proxy === 'string')
		unhandled.push(
			`The manifest declares a development-server proxy (${manifest.proxy}). That is a create-react-app development-server field; the generated lane configuration is a production build composition and carries no proxy.`,
		);
	if (manifest.browserslist !== undefined)
		unhandled.push(
			'The manifest declares a browserslist. create-react-app fed it to Babel and Autoprefixer; the generated lane configuration declares no build target derived from it, so the lane emits whatever the workspace Vite default targets.',
		);
	return Object.freeze({
		source: `${JSON.stringify(manifest, null, indent)}\n`,
		changes: Object.freeze(changes),
		unhandled: Object.freeze(unhandled),
	});
}

/** The base create-react-app resolves from a `homepage` declaration. */
export function craBaseFromHomepage(homepage: unknown): {
	base: string;
	unhandled: readonly string[];
} {
	if (typeof homepage !== 'string' || homepage.trim() === '')
		return { base: '', unhandled: Object.freeze([]) };
	const value = homepage.trim();
	if (value === '.' || value === './')
		return {
			base: '',
			unhandled: Object.freeze([
				`The manifest declares homepage ${JSON.stringify(value)}, which create-react-app resolves to a relative base. The generated lane configuration writes an absolute base and does not carry the relative form.`,
			]),
		};
	if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('//'))
		return { base: parseURL(value).pathname, unhandled: Object.freeze([]) };
	return { base: value, unhandled: Object.freeze([]) };
}

/** The first file below `directory` carrying one of `extensions`, or null. */
async function findByExtension(
	directory: string,
	extensions: readonly string[],
): Promise<string | null> {
	if (!(await directoryExists(directory))) return null;
	for (const entry of (await readdir(directory, { withFileTypes: true })).sort((left, right) =>
		left.name < right.name ? -1 : 1,
	)) {
		if (entry.name === 'node_modules' || entry.name === '.git') continue;
		const item = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			const found = await findByExtension(item, extensions);
			if (found !== null) return found;
			continue;
		}
		if (entry.isFile() && extensions.includes(path.extname(entry.name))) return item;
	}
	return null;
}

/** Build overrides that replace create-react-app's own webpack configuration. */
const BUILD_OVERRIDE_FILES: readonly string[] = Object.freeze([
	'config-overrides.js',
	'config-overrides.ts',
	'craco.config.js',
	'craco.config.ts',
	'.rescriptsrc.js',
]);

const BUILD_OVERRIDE_PACKAGES: readonly string[] = Object.freeze([
	'react-app-rewired',
	'@craco/craco',
	'@rescripts/cli',
	'customize-cra',
]);

const PREPROCESSOR_EXTENSIONS: Readonly<Record<string, string>> = Object.freeze({
	'.scss': 'sass',
	'.sass': 'sass',
	'.less': 'less',
	'.styl': 'stylus',
});

/** Environment files create-react-app reads that this flow's reading does not. */
const UNREAD_ENVIRONMENT_FILES: readonly string[] = Object.freeze([
	'.env.production',
	'.env.production.local',
	'.env.local',
]);

export type ReactLaneOptions = Readonly<{
	appRoot: string;
	/** Where the lane will be written; the adapter import is relative to it. */
	laneDir: string;
	/** The entry document the plan composed, lane-relative. */
	templateFile?: string;
	/** Overrides the workspace ranges the lane declares, for tests. */
	buildDependencies?: Readonly<Record<string, string>>;
	/** Overrides the adapter specifier, for a deterministic test reading. */
	adapterModule?: string;
}>;

/** The build tool ranges this workspace resolves, read from its own manifest. */
export async function workspaceBuildDependencies(
	root: string = workspaceRoot(),
): Promise<Readonly<Record<string, string>>> {
	const manifest = await readJsonFile(path.join(root, 'package.json'));
	const declared = {
		...((manifest?.dependencies ?? {}) as Record<string, string>),
		...((manifest?.devDependencies ?? {}) as Record<string, string>),
	};
	const wanted = ['vite', 'pathe', 'ufo'];
	return Object.freeze(
		Object.fromEntries(
			wanted
				.map((name) => [name, declared[name] ?? UNKNOWN])
				.filter(([, range]) => range !== UNKNOWN),
		),
	);
}

/**
 * Compose the lane files for a create-react-app tree.
 *
 * Every value the configuration is parameterized by is one the `analyze` and
 * `plan` stages already read off the tree: the environment from the
 * application's own `.env` under create-react-app's prefix rule, the base from
 * its `homepage`, the entry template the plan composed, and the public
 * directory the adapter replicates.
 */
export async function composeReactLane(options: ReactLaneOptions): Promise<LaneComposition> {
	const tree = options.appRoot;
	const manifestPath = path.join(tree, 'package.json');
	const manifestSource = await readFile(manifestPath, 'utf8');
	const manifest = JSON.parse(manifestSource) as Record<string, unknown>;
	const unhandled: string[] = [];
	const declaredDifferences: string[] = [];

	const homepage = craBaseFromHomepage(manifest.homepage);
	unhandled.push(...homepage.unhandled);

	for (const file of BUILD_OVERRIDE_FILES)
		if (await fileExists(path.join(tree, file)))
			unhandled.push(
				`The application carries ${file}, a create-react-app build override. The generated lane configuration composes the frozen adapter only and carries nothing that file declares.`,
			);
	const declaredPackages = {
		...((manifest.dependencies ?? {}) as Record<string, string>),
		...((manifest.devDependencies ?? {}) as Record<string, string>),
	};
	for (const name of BUILD_OVERRIDE_PACKAGES)
		if (Object.hasOwn(declaredPackages, name))
			unhandled.push(
				`The application declares ${name} ${declaredPackages[name] ?? UNKNOWN}, which replaces create-react-app's own build configuration. The generated lane configuration carries no equivalent.`,
			);
	if (await fileExists(path.join(tree, 'src/setupProxy.js')))
		unhandled.push(
			'The application carries src/setupProxy.js, a create-react-app development-server proxy. The generated lane configuration is a production build composition and carries no proxy.',
		);
	const seenPreprocessors = new Set<string>();
	for (const extension of Object.keys(PREPROCESSOR_EXTENSIONS).sort()) {
		const found = await findByExtension(path.join(tree, 'src'), [extension]);
		if (found === null) continue;
		const preprocessor = PREPROCESSOR_EXTENSIONS[extension] as string;
		if (seenPreprocessors.has(preprocessor)) continue;
		seenPreprocessors.add(preprocessor);
		unhandled.push(
			`The application imports ${extension} stylesheets (first at ${path.relative(tree, found)}). create-react-app supplied the ${preprocessor} preprocessor; the generated lane configuration declares neither the preprocessor nor a pin for it.`,
		);
	}
	for (const name of ['tsconfig.json', 'jsconfig.json']) {
		const configuration = await readJsonFile(path.join(tree, name));
		const compilerOptions = configuration?.compilerOptions as
			| Record<string, unknown>
			| undefined;
		if (compilerOptions === undefined) continue;
		if (compilerOptions.baseUrl !== undefined || compilerOptions.paths !== undefined)
			unhandled.push(
				`${name} declares module resolution aliases (baseUrl or paths). create-react-app honoured them through its own webpack resolver; the generated lane configuration declares no matching resolve.alias.`,
			);
	}
	for (const name of UNREAD_ENVIRONMENT_FILES)
		if (await fileExists(path.join(tree, name)))
			unhandled.push(
				`The application carries ${name}. This flow reads .env only, under create-react-app's REACT_APP_ prefix rule, so whatever ${name} declares is not inlined into the generated configuration.`,
			);

	declaredDifferences.push(
		'The fixture configurations for the applications already completed additionally install observation plugins that write implicit-global, decoded-module and capability reports beside the build. Those are measurement instruments for those fixtures rather than application behaviour, and the generated configuration carries none of them.',
		`The generated configuration composes createCraViteAdapter and craProcessEnvironmentDefines from ${FROZEN_REACT_ADAPTER_SOURCE} and adds no capability of its own.`,
	);

	const environment = await craBuildEnvironment(tree);
	const adapterModule =
		options.adapterModule ??
		(await laneRelativeAdapterModule(
			options.laneDir,
			path.join(workspaceRoot(), FROZEN_REACT_ADAPTER_SOURCE),
		));
	const viteConfigSource = composeLaneViteConfig({
		adapterModule,
		base: homepage.base,
		publicDirectory: 'public',
		templateFile: options.templateFile ?? 'index.html',
		environment,
		outDirectory: LANE_BUILD_DIRECTORY,
		application: applicationName(tree),
	});
	const rewrite = composeLaneManifest(manifestSource, {
		buildDependencies: options.buildDependencies ?? (await workspaceBuildDependencies()),
		buildScript: 'vite build',
		startScript: 'vite',
	});
	unhandled.push(...rewrite.unhandled);
	return Object.freeze({
		lineage: 'react',
		composed: true,
		reason: null,
		files: Object.freeze([
			Object.freeze({
				path: 'vite.config.ts',
				source: viteConfigSource,
				sha256: sha256(viteConfigSource),
				changes: Object.freeze([
					`generated from the frozen create-react-app adapter composition with base ${JSON.stringify(homepage.base)}, template ${JSON.stringify(options.templateFile ?? 'index.html')}, output ${LANE_BUILD_DIRECTORY}`,
					`environment inlined for ${Object.keys(environment).sort().join(', ')}`,
				]),
			}),
			Object.freeze({
				path: 'package.json',
				source: rewrite.source,
				sha256: sha256(rewrite.source),
				changes: rewrite.changes,
			}),
		]),
		unhandled: Object.freeze(unhandled),
		declaredDifferences: Object.freeze(declaredDifferences),
		notEstablished: LANE_NOT_ESTABLISHED,
	});
}

/**
 * The application as the generated header names it: the last two path segments,
 * so a tree staged as `<app>/baseline` reads as the application rather than as
 * the word "baseline", and no host-specific prefix is written into the lane.
 */
export function applicationName(appRoot: string): string {
	const resolved = path.resolve(appRoot);
	const parent = path.basename(path.dirname(resolved));
	const own = path.basename(resolved);
	return parent === '' || parent === '/' ? own : `${parent}/${own}`;
}

/**
 * The specifier a file in the lane imports the workspace adapter source by.
 *
 * Both ends are resolved through the filesystem's own view first. A lane under
 * a symlinked temporary directory is loaded by the bundler at its real path, so
 * a relative specifier computed from the unresolved path points two segments
 * away from where the adapter actually is and the build fails on a module the
 * pipeline did write.
 */
export async function laneRelativeAdapterModule(
	laneDir: string,
	adapterSource: string,
): Promise<string> {
	const real = async (value: string): Promise<string> => {
		try {
			return await realpath(path.resolve(value));
		} catch {
			return path.resolve(value);
		}
	};
	const relative = path.relative(await real(laneDir), await real(adapterSource));
	return relative.startsWith('.') ? relative : `./${relative}`;
}

/** A lane composition for a tree this composer does not cover. */
export function laneNotComposed(lineage: string, reason: string): LaneComposition {
	return Object.freeze({
		lineage,
		composed: false,
		reason,
		files: Object.freeze([]),
		unhandled: Object.freeze([]),
		declaredDifferences: Object.freeze([]),
		notEstablished: LANE_NOT_ESTABLISHED,
	});
}

/** Write the composed lane files, and report what was written. */
export async function writeLaneFiles(
	laneDir: string,
	composition: LaneComposition,
): Promise<readonly LaneFile[]> {
	for (const file of composition.files) {
		const target = path.join(laneDir, file.path);
		await mkdir(path.dirname(target), { recursive: true });
		await writeFile(target, file.source);
	}
	return composition.files;
}
