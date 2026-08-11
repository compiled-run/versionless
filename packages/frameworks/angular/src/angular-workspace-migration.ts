/**
 * Angular CLI workspace and TypeScript configuration migration.
 *
 * The shapes handled here are the ones the Angular CLI itself defines and the
 * ones the modern `@angular-devkit/build-angular` schema no longer accepts. No
 * capability branches on a project name, an application name or a source
 * string: every project in `angular.json` is walked, whatever it is called.
 *
 * Both entry points parse strict JSON. A configuration carrying comments
 * (JSONC, which the CLI also accepts) is refused with a diagnosable error
 * rather than silently reserialized, because rewriting it would delete the
 * comments without saying so.
 */

import { REMOVED_BUILDER_PACKAGES, compareStrings } from './angular-target-cell.ts';
import type { AngularTargetCell } from './angular-target-cell.ts';

export type ConfigChange = Readonly<{ path: string; from: string | null; to: string | null }>;

export type WorkspaceMigration = Readonly<{
	config: string;
	changes: readonly ConfigChange[];
	removedPackages: readonly string[];
	unhandled: readonly string[];
}>;

type JsonObject = Record<string, unknown>;

/**
 * Builder options the modern devkit schema no longer accepts. A build fails
 * outright on an unknown option, so leaving one in place is not a cosmetic
 * defect.
 *
 * `extractCss` was removed once CSS extraction became unconditional in
 * production; `es5BrowserSupport` and `showCircularDependencies` went with the
 * differential-loading and webpack-plugin surfaces they configured;
 * `experimentalRollupPass` and `lazyModules` were experimental options the
 * devkit dropped.
 */
export const REMOVED_BUILDER_OPTIONS: readonly string[] = Object.freeze([
	'es5BrowserSupport',
	'experimentalRollupPass',
	'extractCss',
	'lazyModules',
	'showCircularDependencies',
]);

/**
 * Builders the modern devkit no longer ships at all. The target that uses one
 * cannot be carried across the hop: it is removed, and the packages it existed
 * to run are reported so the manifest alignment can drop them too. Replacing
 * the capability the target provided (a linter, an end-to-end runner) is a
 * decision about the project, not a mechanical rewrite, so this capability
 * makes no attempt at one and says so.
 */
export const REMOVED_BUILDERS: readonly string[] = Object.freeze(
	Object.keys(REMOVED_BUILDER_PACKAGES).sort(compareStrings),
);

/** Builders this capability recognises as still present on a modern line. */
export const CARRIED_BUILDERS: readonly string[] = Object.freeze([
	'@angular-devkit/build-angular:browser',
	'@angular-devkit/build-angular:dev-server',
	'@angular-devkit/build-angular:extract-i18n',
	'@angular-devkit/build-angular:karma',
	'@angular-devkit/build-angular:ng-packagr',
	'@angular-devkit/build-angular:server',
]);

/**
 * True when the document carries a `//` or `/* … *\/` comment outside a string
 * literal. String contents are skipped, because a JSON string legitimately
 * holds both sequences — a glob such as `**\/node_modules/**` and a URL both
 * do — and treating those as comments would refuse a strict JSON document.
 */
export function carriesJsonComment(source: string): boolean {
	let inString = false;
	for (let index = 0; index < source.length; index += 1) {
		const character = source[index];
		if (inString) {
			if (character === '\\') index += 1;
			else if (character === '"') inString = false;
			continue;
		}
		if (character === '"') {
			inString = true;
			continue;
		}
		if (character !== '/') continue;
		const next = source[index + 1];
		if (next === '/' || next === '*') return true;
	}
	return false;
}

function parseStrictJson(source: string, kind: string): JsonObject {
	if (carriesJsonComment(source))
		throw new Error(
			`Angular ${kind} migration: the configuration appears to carry comments. ` +
				'This capability rewrites strict JSON only; a JSONC configuration would lose ' +
				'its comments silently, so it is refused instead.',
		);
	const parsed: unknown = JSON.parse(source);
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
		throw new Error(`Angular ${kind} migration: the configuration is not a JSON object`);
	return parsed as JsonObject;
}

function serialize(value: unknown): string {
	return `${JSON.stringify(value, null, 2)}\n`;
}

function objectAt(value: unknown): JsonObject | null {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as JsonObject)
		: null;
}

function migrateBuilderOptions(
	options: JsonObject,
	prefix: string,
	changes: ConfigChange[],
): JsonObject {
	const next: JsonObject = {};
	for (const [key, value] of Object.entries(options)) {
		if (REMOVED_BUILDER_OPTIONS.includes(key)) {
			changes.push({ path: `${prefix}.${key}`, from: JSON.stringify(value), to: null });
			continue;
		}
		if (key === 'polyfills' && typeof value === 'string') {
			next[key] = [value];
			changes.push({
				path: `${prefix}.polyfills`,
				from: JSON.stringify(value),
				to: JSON.stringify([value]),
			});
			continue;
		}
		next[key] = value;
	}
	return next;
}

/**
 * Migrate an `angular.json` workspace onto the declared cell.
 *
 * Three mechanical changes, each one a shape the modern schema rejects: the
 * workspace-level `defaultProject` key, builder options the devkit removed
 * (in a target's `options` and in every named configuration), and the
 * `polyfills` option's string form, which became an array of entry points.
 * Targets whose builder no longer exists are removed and reported.
 */
export function migrateAngularWorkspace(
	source: string,
	cell: AngularTargetCell,
): WorkspaceMigration {
	const workspace = parseStrictJson(source, 'workspace');
	const changes: ConfigChange[] = [];
	const removedPackages = new Set<string>();
	const unhandled: string[] = [];
	const next: JsonObject = {};
	for (const [key, value] of Object.entries(workspace)) {
		if (key === 'defaultProject') {
			changes.push({ path: 'defaultProject', from: JSON.stringify(value), to: null });
			continue;
		}
		next[key] = value;
	}
	const projects = objectAt(next['projects']);
	if (projects !== null) {
		const migratedProjects: JsonObject = {};
		for (const [projectName, projectValue] of Object.entries(projects)) {
			const project = objectAt(projectValue);
			if (project === null) {
				migratedProjects[projectName] = projectValue;
				continue;
			}
			const architect = objectAt(project['architect']) ?? objectAt(project['targets']);
			if (architect === null) {
				migratedProjects[projectName] = project;
				continue;
			}
			const architectKey = objectAt(project['architect']) === null ? 'targets' : 'architect';
			const migratedTargets: JsonObject = {};
			for (const [targetName, targetValue] of Object.entries(architect)) {
				const target = objectAt(targetValue);
				const builder = target === null ? null : target['builder'];
				const targetPath = `projects.${projectName}.${architectKey}.${targetName}`;
				if (typeof builder === 'string' && REMOVED_BUILDERS.includes(builder)) {
					changes.push({ path: targetPath, from: builder, to: null });
					for (const name of REMOVED_BUILDER_PACKAGES[builder] ?? [])
						removedPackages.add(name);
					unhandled.push(
						`${targetPath} used ${builder}, which the ${cell.angularLine} devkit does not ship; ` +
							'the target was removed and no replacement capability was chosen for it',
					);
					continue;
				}
				if (typeof builder === 'string' && !CARRIED_BUILDERS.includes(builder)) {
					unhandled.push(
						`${targetPath} uses ${builder}, which this capability does not recognise; ` +
							'its options were left untouched',
					);
					migratedTargets[targetName] = targetValue;
					continue;
				}
				if (target === null) {
					migratedTargets[targetName] = targetValue;
					continue;
				}
				const migratedTarget: JsonObject = { ...target };
				const options = objectAt(target['options']);
				if (options !== null)
					migratedTarget['options'] = migrateBuilderOptions(
						options,
						`${targetPath}.options`,
						changes,
					);
				const configurations = objectAt(target['configurations']);
				if (configurations !== null) {
					const migratedConfigurations: JsonObject = {};
					for (const [name, value] of Object.entries(configurations)) {
						const configuration = objectAt(value);
						migratedConfigurations[name] =
							configuration === null
								? value
								: migrateBuilderOptions(
										configuration,
										`${targetPath}.configurations.${name}`,
										changes,
									);
					}
					migratedTarget['configurations'] = migratedConfigurations;
				}
				migratedTargets[targetName] = migratedTarget;
			}
			migratedProjects[projectName] = { ...project, [architectKey]: migratedTargets };
		}
		next['projects'] = migratedProjects;
	}
	return Object.freeze({
		config: serialize(next),
		changes: Object.freeze(changes),
		removedPackages: Object.freeze([...removedPackages].sort(compareStrings)),
		unhandled: Object.freeze(unhandled),
	});
}

export type TsConfigMigration = Readonly<{
	config: string;
	changes: readonly ConfigChange[];
	unhandled: readonly string[];
}>;

/**
 * Migrate a workspace `tsconfig.json` onto the declared cell.
 *
 * The Angular compiler on a modern line emits ES2022 output and requires
 * `useDefineForClassFields: false` at that target, because TypeScript's
 * standards-compliant class-field semantics would otherwise overwrite the
 * fields Angular's decorators initialise. `enableIvy` is removed: Ivy is the
 * only compiler left, and the option is no longer read.
 */
export function migrateAngularTsConfig(source: string, cell: AngularTargetCell): TsConfigMigration {
	const config = parseStrictJson(source, 'tsconfig');
	const changes: ConfigChange[] = [];
	const unhandled: string[] = [];
	const next: JsonObject = { ...config };
	const compilerOptions = objectAt(config['compilerOptions']);
	if (compilerOptions === null) {
		unhandled.push('the tsconfig declares no compilerOptions; nothing was aligned');
		return Object.freeze({
			config: serialize(next),
			changes: Object.freeze(changes),
			unhandled: Object.freeze(unhandled),
		});
	}
	const migrated: JsonObject = { ...compilerOptions };
	for (const key of ['target', 'module'] as const) {
		const from = compilerOptions[key];
		if (from === 'ES2022') continue;
		migrated[key] = 'ES2022';
		changes.push({
			path: `compilerOptions.${key}`,
			from: from === undefined ? null : JSON.stringify(from),
			to: '"ES2022"',
		});
	}
	if (compilerOptions['useDefineForClassFields'] !== false) {
		migrated['useDefineForClassFields'] = false;
		changes.push({
			path: 'compilerOptions.useDefineForClassFields',
			from:
				compilerOptions['useDefineForClassFields'] === undefined
					? null
					: JSON.stringify(compilerOptions['useDefineForClassFields']),
			to: 'false',
		});
	}
	next['compilerOptions'] = migrated;
	const angularCompilerOptions = objectAt(config['angularCompilerOptions']);
	if (angularCompilerOptions !== null && 'enableIvy' in angularCompilerOptions) {
		const { enableIvy, ...rest } = angularCompilerOptions;
		next['angularCompilerOptions'] = rest;
		changes.push({
			path: 'angularCompilerOptions.enableIvy',
			from: JSON.stringify(enableIvy),
			to: null,
		});
	}
	unhandled.push(
		`compilerOptions.lib was left as declared; the ${cell.angularLine} line does not require a specific lib set ` +
			'and narrowing one could remove a type surface the application relies on',
	);
	return Object.freeze({
		config: serialize(next),
		changes: Object.freeze(changes),
		unhandled: Object.freeze(unhandled),
	});
}
