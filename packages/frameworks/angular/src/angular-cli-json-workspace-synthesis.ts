/**
 * Synthesis of a modern `angular.json` workspace from the pre-`angular.json`
 * Angular CLI 1.x format, `.angular-cli.json`.
 *
 * The Angular CLI shipped two workspace formats. Up to CLI 1.7 the workspace was
 * `.angular-cli.json`: a single `apps[]` array whose one entry carried the build
 * inputs as paths relative to the app's own `root`, an `environmentSource` plus a
 * named `environments` map that the CLI turned into a compile-time file swap, and
 * sibling `e2e`, `lint`, `test` and `defaults` blocks. From CLI 6 onward the
 * workspace is `angular.json`: a `projects` map whose entries carry `architect`
 * targets, each naming a builder and holding workspace-relative options, and
 * whose environment swap is expressed as the browser builder's `fileReplacements`.
 *
 * Every other capability in this adapter expects the second format. This one is
 * what gets a CLI 1.x workspace there. It is a translation between two published
 * schemas and reads nothing else: no application name is matched, no path is
 * special-cased, and the only inputs are the document's own fields.
 *
 * What it refuses rather than guesses: any field of either schema level it does
 * not know. An unknown field is reported by name and its value is dropped from
 * the synthesized workspace, because carrying a CLI 1.x key into a document the
 * modern schema validates would fail the build with a less legible error than
 * the one reported here. Silence about a dropped field is the failure mode this
 * capability exists to avoid, so nothing is dropped quietly.
 */

import type { AngularTargetCell } from './angular-target-cell.ts';
import { compareStrings } from './angular-target-cell.ts';
import type { ConfigChange } from './angular-workspace-migration.ts';
import { fontInliningDifference, fontInliningDisabled } from './font-inlining-disable.ts';

type JsonObject = Record<string, unknown>;

/** The filename the CLI 1.x format is published under. */
export const ANGULAR_CLI_ONE_WORKSPACE_FILENAME = '.angular-cli.json';

/** The filename the modern schema is published under. */
export const ANGULAR_JSON_WORKSPACE_FILENAME = 'angular.json';

/**
 * Top-level keys of the CLI 1.x schema this capability knows.
 *
 * `project` names the workspace, `apps` is the whole build description, `e2e`,
 * `lint` and `test` are the sibling toolchain blocks, `defaults` holds the
 * schematic defaults, and `$schema` points at the CLI's own bundled schema — a
 * path under `node_modules` that means nothing once the CLI is replaced.
 */
export const KNOWN_WORKSPACE_KEYS: readonly string[] = Object.freeze([
	'$schema',
	'apps',
	'defaults',
	'e2e',
	'lint',
	'project',
	'test',
]);

/**
 * Keys of one `apps[]` entry this capability knows, each with the modern option
 * it becomes. A key mapped to null is read but has no modern option: it is
 * consumed to build something else, or the modern schema expresses it elsewhere.
 */
export const KNOWN_APP_KEYS: readonly string[] = Object.freeze([
	'assets',
	'baseHref',
	'deployUrl',
	'environmentSource',
	'environments',
	'index',
	'main',
	'name',
	'outDir',
	'polyfills',
	'prefix',
	'root',
	'scripts',
	'serviceWorker',
	'styles',
	'stylePreprocessorOptions',
	'test',
	'testTsconfig',
	'tsconfig',
]);

/**
 * The CLI 1.x environment name that the CLI's own `--prod` flag selected, and
 * the modern configuration name that plays the same part.
 *
 * This is a fact about the two schemas, not about any application: `ng build
 * --prod` in CLI 1.x was defined as `--environment=prod` plus the optimisation
 * flags, and on a modern line `ng build` runs the `production` configuration.
 * An environment under any other name keeps its name.
 */
export const ERA_PRODUCTION_ENVIRONMENT = 'prod';
export const MODERN_PRODUCTION_CONFIGURATION = 'production';

/**
 * The build options `ng build --prod` set in the CLI 1.x era, expressed as the
 * modern browser builder's options.
 *
 * Each entry is one era flag. `--prod` in CLI 1.5 turned on ahead-of-time
 * compilation, the build optimiser, full output hashing and CSS extraction, and
 * turned off source maps, named chunks and the separate vendor chunk. CSS
 * extraction is unconditional on a modern production build and has no option
 * left, so it is not restated here; the rest map one for one.
 *
 * `optimization` is the one entry that is not the bare era flag. The era flag
 * was a boolean and the modern option is a boolean *or* an object; written as
 * the boolean it would also switch on the modern line's build-time font
 * inliner, which the era CLI did not have and which fetches from a font host
 * during the build. It is written as the object form that keeps every other
 * optimisation at the schema's own default and disables only that fetch — see
 * `font-inlining-disable.ts` for why the cell decided that.
 */
export const ERA_PRODUCTION_BUILD_OPTIONS: Readonly<Record<string, unknown>> = Object.freeze({
	optimization: fontInliningDisabled(true),
	outputHashing: 'all',
	sourceMap: false,
	namedChunks: false,
	extractLicenses: true,
	vendorChunk: false,
	buildOptimizer: true,
	aot: true,
});

export type SynthesizedWorkspace = Readonly<{
	/** The path the synthesized workspace should be written to. */
	path: string;
	/** The `angular.json` document, serialized. */
	config: string;
	/** The path the era workspace occupied, which no longer describes anything. */
	replacedPath: string;
	/** Every field translation, itemised the way a config change is elsewhere. */
	changes: readonly ConfigChange[];
	/** Fields of either schema level that were read but not understood. */
	unhandled: readonly string[];
	/** Capabilities the synthesized workspace deliberately does not have. */
	declaredDifferences: readonly string[];
}>;

function objectAt(value: unknown): JsonObject | null {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as JsonObject)
		: null;
}

function arrayAt(value: unknown): readonly unknown[] | null {
	return Array.isArray(value) ? value : null;
}

/**
 * Join a workspace-relative directory with a path written relative to it.
 *
 * These are schema paths, not filesystem paths: they are always POSIX, always
 * relative to the workspace root once joined, and never touch the disk. A
 * leading `./` on either side names the same file as its absence, and an empty
 * root leaves the path exactly as written.
 */
export function joinWorkspacePath(root: string, relative: string): string {
	const base = trimTrailingSlashes(stripLeadingDot(root));
	const tail = stripLeadingDot(relative);
	return base === '' ? tail : `${base}/${tail}`;
}

function stripLeadingDot(value: string): string {
	let index = 0;
	while (value.startsWith('./', index)) index += 2;
	while (value.startsWith('/', index)) index += 1;
	return value.slice(index);
}

function trimTrailingSlashes(value: string): string {
	let end = value.length;
	while (end > 0 && value[end - 1] === '/') end -= 1;
	return value.slice(0, end) === '.' ? '' : value.slice(0, end);
}

/**
 * True for a document in the CLI 1.x workspace format.
 *
 * Read off the document's own shape rather than off its filename: an `apps`
 * array with no `projects` map is the CLI 1.x format and nothing else is. A
 * workspace renamed on disk is still the format its contents say it is.
 */
export function isAngularCliOneWorkspace(document: unknown): boolean {
	const workspace = objectAt(document);
	if (workspace === null) return false;
	return Array.isArray(workspace['apps']) && objectAt(workspace['projects']) === null;
}

/**
 * Translate one CLI 1.x asset, style or script entry.
 *
 * Strings are paths relative to the app root and become workspace-relative
 * strings. The object forms differ between the schemas: an asset object's
 * `input` is app-root-relative and its `glob`/`output` carry across unchanged,
 * and a style or script object's `lazy: true` became `inject: false`.
 */
function translateAsset(root: string, entry: unknown, index: number, path: string): {
	value: unknown;
	unhandled: string | null;
} {
	if (typeof entry === 'string') return { value: joinWorkspacePath(root, entry), unhandled: null };
	const object = objectAt(entry);
	if (object === null)
		return {
			value: null,
			unhandled: `${path}[${index}] is neither a string nor an object, so it names nothing this capability can translate`,
		};
	const next: JsonObject = {};
	for (const [key, value] of Object.entries(object)) {
		if (key === 'input' && typeof value === 'string') {
			next['input'] = joinWorkspacePath(root, value);
			continue;
		}
		if (key === 'glob' || key === 'output') {
			next[key] = value;
			continue;
		}
		if (key === 'lazy') {
			next['inject'] = value !== true;
			continue;
		}
		if (key === 'bundleName') {
			next['bundleName'] = value;
			continue;
		}
		return {
			value: null,
			unhandled: `${path}[${index}].${key} is not a field this capability knows in the CLI 1.x asset, style or script form; the entry was dropped rather than guessed at`,
		};
	}
	return { value: next, unhandled: null };
}

function translateAssetList(
	root: string,
	value: unknown,
	path: string,
	unhandled: string[],
): readonly unknown[] {
	const list = arrayAt(value);
	if (list === null) {
		unhandled.push(`${path} is not an array, so nothing was translated from it`);
		return [];
	}
	const translated: unknown[] = [];
	for (const [index, entry] of list.entries()) {
		const result = translateAsset(root, entry, index, path);
		if (result.unhandled !== null) {
			unhandled.push(result.unhandled);
			continue;
		}
		translated.push(result.value);
	}
	return translated;
}

/**
 * The file replacements one CLI 1.x environment becomes.
 *
 * The era CLI swapped `environmentSource` for the named environment file at
 * compile time; the modern builder expresses the same swap as a
 * `fileReplacements` pair. An environment naming the same file as the source is
 * the identity swap the era CLI performed for its default environment, and it
 * produces no replacement at all.
 */
function fileReplacementsFor(
	root: string,
	environmentSource: string,
	environmentFile: string,
): readonly JsonObject[] {
	const replace = joinWorkspacePath(root, environmentSource);
	const withFile = joinWorkspacePath(root, environmentFile);
	return replace === withFile ? [] : [{ replace, with: withFile }];
}

function serialize(value: unknown): string {
	return `${JSON.stringify(value, null, 2)}\n`;
}

/**
 * Synthesize an `angular.json` workspace from a `.angular-cli.json` document.
 *
 * The `apps[]` array becomes the `projects` map, one project per app. Each app's
 * build inputs, which the era schema wrote relative to the app's own `root`,
 * become workspace-relative options on a `@angular-devkit/build-angular:browser`
 * target; the named `environments` map becomes that target's configurations, each
 * carrying the `fileReplacements` pair the era CLI performed as a compile-time
 * swap. The `test`, `lint` and `e2e` blocks become the targets that ran them —
 * including the two builders a modern devkit no longer ships, which are emitted
 * as they were so that the workspace migration that runs next removes them by
 * its own rule and reports the loss, rather than this capability deciding a
 * toolchain question the cell already decided.
 *
 * The cell is read for one thing only: its name, in the reasons recorded here.
 * No option below is chosen by the cell, because every one of them is a
 * translation of a field the era document already carried.
 */
export function synthesizeAngularWorkspace(
	source: string,
	cell: AngularTargetCell,
	sourcePath: string = ANGULAR_CLI_ONE_WORKSPACE_FILENAME,
): SynthesizedWorkspace {
	const parsed: unknown = JSON.parse(source);
	const workspace = objectAt(parsed);
	if (workspace === null)
		throw new Error('Angular CLI 1.x workspace synthesis: the configuration is not a JSON object');
	if (!isAngularCliOneWorkspace(workspace))
		throw new Error(
			'Angular CLI 1.x workspace synthesis: the configuration carries no apps[] array, ' +
				'so it is not in the pre-angular.json format this capability translates',
		);
	const changes: ConfigChange[] = [];
	const unhandled: string[] = [];
	const declaredDifferences: string[] = [];

	for (const key of Object.keys(workspace))
		if (!KNOWN_WORKSPACE_KEYS.includes(key))
			unhandled.push(
				`${sourcePath} carries the top-level field ${key}, which this capability does not know in ` +
					'the Angular CLI 1.x workspace schema; it was dropped from the synthesized workspace ' +
					'rather than carried into a document the modern schema validates',
			);

	const project = objectAt(workspace['project']);
	const workspaceName = typeof project?.['name'] === 'string' ? project['name'] : null;
	const apps = arrayAt(workspace['apps']) ?? [];
	if (apps.length === 0)
		unhandled.push(`${sourcePath} declares an empty apps[] array, so no project was synthesized`);
	if (apps.length > 1 && workspaceName !== null)
		declaredDifferences.push(
			`${sourcePath} declares ${apps.length} apps under the single workspace name ${workspaceName}; ` +
				'each app was synthesized as its own project, named by its own `name` field where it has one',
		);

	const karmaConfig = objectAt(objectAt(workspace['test'])?.['karma'] ?? null)?.['config'];
	const protractorConfig = objectAt(objectAt(workspace['e2e'])?.['protractor'] ?? null)?.['config'];
	const lintEntries = arrayAt(workspace['lint']) ?? [];
	const styleExt = objectAt(workspace['defaults'])?.['styleExt'];

	const projects: JsonObject = {};
	for (const [appIndex, appValue] of apps.entries()) {
		const app = objectAt(appValue);
		if (app === null) {
			unhandled.push(`${sourcePath} apps[${appIndex}] is not an object; it was skipped`);
			continue;
		}
		for (const key of Object.keys(app))
			if (!KNOWN_APP_KEYS.includes(key))
				unhandled.push(
					`${sourcePath} apps[${appIndex}].${key} is not a field this capability knows in the ` +
						'Angular CLI 1.x app schema; it was dropped from the synthesized workspace rather ' +
						'than guessed at',
				);
		const appName =
			typeof app['name'] === 'string'
				? app['name']
				: apps.length === 1 && workspaceName !== null
					? workspaceName
					: null;
		if (appName === null) {
			unhandled.push(
				`${sourcePath} apps[${appIndex}] carries no \`name\` and the workspace \`project.name\` ` +
					'cannot stand in for it, because more than one app would claim it; the app was not ' +
					'synthesized into a project',
			);
			continue;
		}
		const root = typeof app['root'] === 'string' ? app['root'] : '';
		if (typeof app['root'] !== 'string')
			unhandled.push(
				`${sourcePath} apps[${appIndex}] declares no string \`root\`; its paths were read as ` +
					'workspace-relative, which is what an absent root meant to the era CLI',
			);
		const at = (value: unknown): string | null =>
			typeof value === 'string' ? joinWorkspacePath(root, value) : null;

		const buildOptions: JsonObject = {};
		const outDir = typeof app['outDir'] === 'string' ? app['outDir'] : null;
		if (outDir !== null) buildOptions['outputPath'] = outDir;
		const index = at(app['index']);
		if (index !== null) buildOptions['index'] = index;
		const main = at(app['main']);
		if (main !== null) buildOptions['main'] = main;
		const polyfills = at(app['polyfills']);
		if (polyfills !== null) buildOptions['polyfills'] = polyfills;
		const tsConfig = at(app['tsconfig']);
		if (tsConfig !== null) buildOptions['tsConfig'] = tsConfig;
		if ('assets' in app)
			buildOptions['assets'] = translateAssetList(
				root,
				app['assets'],
				`apps[${appIndex}].assets`,
				unhandled,
			);
		if ('styles' in app)
			buildOptions['styles'] = translateAssetList(
				root,
				app['styles'],
				`apps[${appIndex}].styles`,
				unhandled,
			);
		if ('scripts' in app)
			buildOptions['scripts'] = translateAssetList(
				root,
				app['scripts'],
				`apps[${appIndex}].scripts`,
				unhandled,
			);
		if (typeof app['baseHref'] === 'string') buildOptions['baseHref'] = app['baseHref'];
		if (typeof app['deployUrl'] === 'string') buildOptions['deployUrl'] = app['deployUrl'];
		const preprocessor = objectAt(app['stylePreprocessorOptions']);
		if (preprocessor !== null) {
			const includePaths = arrayAt(preprocessor['includePaths']);
			buildOptions['stylePreprocessorOptions'] =
				includePaths === null
					? preprocessor
					: {
							...preprocessor,
							includePaths: includePaths.map((entry) =>
								typeof entry === 'string' ? joinWorkspacePath(root, entry) : entry,
							),
						};
		}
		if (app['serviceWorker'] === true) {
			buildOptions['serviceWorker'] = true;
			buildOptions['ngswConfigPath'] = joinWorkspacePath(root, 'ngsw-config.json');
			changes.push({
				path: `projects.${appName}.architect.build.options.ngswConfigPath`,
				from: null,
				to: JSON.stringify(buildOptions['ngswConfigPath']),
			});
		}
		for (const [key, value] of Object.entries(buildOptions))
			changes.push({
				path: `projects.${appName}.architect.build.options.${key}`,
				from: null,
				to: JSON.stringify(value),
			});

		const environmentSource =
			typeof app['environmentSource'] === 'string' ? app['environmentSource'] : null;
		const environments = objectAt(app['environments']) ?? {};
		const configurations: JsonObject = {};
		if (environmentSource === null && Object.keys(environments).length > 0)
			unhandled.push(
				`${sourcePath} apps[${appIndex}] declares environments but no environmentSource, so there ` +
					'is no file for the modern builder to replace and no configuration was synthesized',
			);
		if (environmentSource !== null)
			for (const name of Object.keys(environments).sort(compareStrings)) {
				const environmentFile = environments[name];
				if (typeof environmentFile !== 'string') {
					unhandled.push(
						`${sourcePath} apps[${appIndex}].environments.${name} is not a string path; no ` +
							'file replacement was synthesized for it',
					);
					continue;
				}
				const replacements = fileReplacementsFor(root, environmentSource, environmentFile);
				const configurationName =
					name === ERA_PRODUCTION_ENVIRONMENT ? MODERN_PRODUCTION_CONFIGURATION : name;
				if (replacements.length === 0) {
					declaredDifferences.push(
						`${sourcePath} apps[${appIndex}].environments.${name} names the same file as ` +
							'environmentSource, which is the identity swap the era CLI performed for its ' +
							'default environment; it needs no fileReplacements and was synthesized as the ' +
							"target's unconfigured default rather than as a named configuration",
					);
					continue;
				}
				const configuration: JsonObject = { fileReplacements: replacements };
				if (configurationName === MODERN_PRODUCTION_CONFIGURATION) {
					Object.assign(configuration, ERA_PRODUCTION_BUILD_OPTIONS);
					changes.push({
						path: `projects.${appName}.architect.build.configurations.${configurationName}`,
						from: `environments.${name}`,
						to: JSON.stringify(configuration),
					});
					declaredDifferences.push(
						`the era \`ng build --prod\` flag set ahead-of-time compilation, the build optimiser, ` +
							`full output hashing and CSS extraction and turned off source maps, named chunks and ` +
							`the vendor chunk. Those flags were written into the ${MODERN_PRODUCTION_CONFIGURATION} ` +
							`configuration, because on a ${cell.angularLine} line they are configuration rather ` +
							'than command-line flags. CSS extraction is unconditional there and has no option left, ' +
							'so it is not restated',
					);
					declaredDifferences.push(
						fontInliningDifference(
							`projects.${appName}.architect.build.configurations.${configurationName}.optimization`,
							cell,
						),
					);
				} else
					changes.push({
						path: `projects.${appName}.architect.build.configurations.${configurationName}`,
						from: `environments.${name}`,
						to: JSON.stringify(configuration),
					});
				configurations[configurationName] = configuration;
			}

		// The browser builder's `optimization` option defaults to on, and with it
		// the build-time font inliner, so a target that declares nothing still
		// fetches from a font host during `ng build`. The base options carry the
		// explicit equivalent of that default with only the fetch turned off, so
		// the unconfigured build is corrected as well as the production one.
		const baseOptimization = fontInliningDisabled(undefined);
		buildOptions['optimization'] = baseOptimization;
		changes.push({
			path: `projects.${appName}.architect.build.options.optimization`,
			from: null,
			to: JSON.stringify(baseOptimization),
		});
		declaredDifferences.push(
			fontInliningDifference(`projects.${appName}.architect.build.options.optimization`, cell),
		);
		const build: JsonObject = {
			builder: '@angular-devkit/build-angular:browser',
			options: buildOptions,
		};
		if (Object.keys(configurations).length > 0) {
			build['configurations'] = configurations;
			if (MODERN_PRODUCTION_CONFIGURATION in configurations)
				build['defaultConfiguration'] = MODERN_PRODUCTION_CONFIGURATION;
		}
		const architect: JsonObject = { build };

		const testMain = at(app['test']);
		const testTsConfig = at(app['testTsconfig']);
		if (testMain !== null || testTsConfig !== null || typeof karmaConfig === 'string') {
			const testOptions: JsonObject = {};
			if (testMain !== null) testOptions['main'] = testMain;
			if (polyfills !== null) testOptions['polyfills'] = polyfills;
			if (testTsConfig !== null) testOptions['tsConfig'] = testTsConfig;
			if (typeof karmaConfig === 'string')
				testOptions['karmaConfig'] = joinWorkspacePath('', karmaConfig);
			if (buildOptions['assets'] !== undefined) testOptions['assets'] = buildOptions['assets'];
			if (buildOptions['styles'] !== undefined) testOptions['styles'] = buildOptions['styles'];
			if (buildOptions['scripts'] !== undefined)
				testOptions['scripts'] = buildOptions['scripts'];
			architect['test'] = {
				builder: '@angular-devkit/build-angular:karma',
				options: testOptions,
			};
			changes.push({
				path: `projects.${appName}.architect.test.builder`,
				from: 'test.karma.config',
				to: '@angular-devkit/build-angular:karma',
			});
		}

		/**
		 * The lint and e2e targets are synthesized in the shape the era workspace
		 * described, with the builders the devkit published for them, even though
		 * a modern devkit ships neither. Deciding here that a workspace loses its
		 * linter or its end-to-end runner would take a toolchain decision the cell
		 * already takes: emitting the targets hands that decision to the workspace
		 * migration, which removes them by its own rule and records the loss.
		 */
		if (appIndex === 0 && lintEntries.length > 0) {
			const lintOptions: JsonObject = {
				tsConfig: lintEntries
					.map((entry) => objectAt(entry)?.['project'])
					.filter((value): value is string => typeof value === 'string'),
			};
			const excludes = lintEntries
				.map((entry) => objectAt(entry)?.['exclude'])
				.filter((value): value is string => typeof value === 'string');
			if (excludes.length > 0) lintOptions['exclude'] = [...new Set(excludes)];
			architect['lint'] = {
				builder: '@angular-devkit/build-angular:tslint',
				options: lintOptions,
			};
			changes.push({
				path: `projects.${appName}.architect.lint.builder`,
				from: 'lint[]',
				to: '@angular-devkit/build-angular:tslint',
			});
		}
		if (appIndex === 0 && typeof protractorConfig === 'string') {
			architect['e2e'] = {
				builder: '@angular-devkit/build-angular:protractor',
				options: { protractorConfig: joinWorkspacePath('', protractorConfig) },
			};
			changes.push({
				path: `projects.${appName}.architect.e2e.builder`,
				from: 'e2e.protractor.config',
				to: '@angular-devkit/build-angular:protractor',
			});
		}

		const synthesizedProject: JsonObject = {
			projectType: 'application',
			root: '',
			sourceRoot: root,
			architect,
		};
		if (typeof app['prefix'] === 'string') synthesizedProject['prefix'] = app['prefix'];
		if (typeof styleExt === 'string')
			synthesizedProject['schematics'] = {
				'@schematics/angular:component': { style: styleExt },
			};
		projects[appName] = synthesizedProject;
		changes.push({
			path: `projects.${appName}`,
			from: `apps[${appIndex}]`,
			to: 'projectType application',
		});
	}

	const defaults = objectAt(workspace['defaults']);
	if (defaults !== null)
		for (const key of Object.keys(defaults))
			if (key !== 'styleExt' && key !== 'component')
				unhandled.push(
					`${sourcePath} defaults.${key} is not a schematic default this capability knows; it ` +
						'was dropped from the synthesized workspace rather than guessed at',
				);

	const synthesized: JsonObject = { version: 1, newProjectRoot: 'projects', projects };
	changes.push({ path: 'version', from: null, to: '1' });
	declaredDifferences.push(
		`${sourcePath} was replaced by ${ANGULAR_JSON_WORKSPACE_FILENAME}: the Angular CLI 1.x workspace ` +
			`format is not read by any ${cell.angularLine} toolchain, so leaving it in the tree would leave ` +
			'a file that describes the build and is never consulted',
	);

	return Object.freeze({
		path: ANGULAR_JSON_WORKSPACE_FILENAME,
		config: serialize(synthesized),
		replacedPath: sourcePath,
		changes: Object.freeze(changes),
		unhandled: Object.freeze([...new Set(unhandled)]),
		declaredDifferences: Object.freeze([...new Set(declaredDifferences)]),
	});
}
