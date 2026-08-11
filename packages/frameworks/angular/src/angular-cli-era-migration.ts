/**
 * The composed Angular CLI era migration: workspace configuration, TypeScript
 * configuration, package manifest and application source, lifted onto one
 * declared target cell and reported as a single itemised changeset.
 *
 * The changeset is the product. It records, per file, the bytes before and
 * after as digests and the individual changes that produced them, and it
 * separates application files from workspace files so that a count of changed
 * application files means what it says: source the application owns, changed by
 * a transform, not a version number edited in a manifest.
 */

import { createHash } from 'node:crypto';
import {
	alignAngularPackageManifest,
	compareStrings,
	type AngularTargetCell,
	type DependencyChange,
} from './angular-target-cell.ts';
import { migrateAngularSourceModule, type SourceChange } from './angular-source-migration.ts';
import {
	migrateModalContentParams,
	type ModalContentParamsChange,
	type ModuleResolution,
} from './modal-content-params-migration.ts';
import { migrateNgrxEffectDecorators, type NgrxEffectChange } from './ngrx-effects-migration.ts';
import {
	migratePackageStyleImports,
	type PackageExportsReading,
	type StyleImportChange,
} from './package-exports-style-imports.ts';
import { migrateSentryV8Tracing, type SentryV8Change } from './sentry-v8-migration.ts';
import {
	declareUndeclaredRuntimeDependencies,
	undeclaredRuntimeDependencies,
	type InstalledPackage,
} from './undeclared-runtime-dependency.ts';
import {
	migrateAngularTsConfig,
	migrateAngularWorkspace,
	normalizeFragmentPath,
	type ConfigChange,
} from './angular-workspace-migration.ts';
import { tslintConfigRemovals } from './tslint-toolchain-removal.ts';

export type WorkspaceFile = Readonly<{ path: string; source: string }>;

export type AngularMigrationInput = Readonly<{
	packageManifest: WorkspaceFile;
	workspaceConfig: WorkspaceFile;
	tsConfig: WorkspaceFile;
	/** Application source modules, as read from the workspace. */
	sourceModules: readonly WorkspaceFile[];
	/**
	 * Webpack fragments a wrapper builder reads, keyed by the path the workspace
	 * writes for them. A fragment a target references but that is not supplied
	 * here is reported unread and its wrapper builder is left in place.
	 */
	webpackFragments?: readonly WorkspaceFile[];
	/**
	 * Every workspace-relative path the tree carries, for capabilities that
	 * decide a file should no longer exist. Only paths are needed: a file removed
	 * because the toolchain that read it is gone does not have to be parsed. A
	 * tree that supplies no list has no files removed.
	 */
	workspaceFiles?: readonly string[];
	/**
	 * Stylesheets the application owns, kept apart from {@link sourceModules}
	 * because they are not modules: no source transform parses them, and the only
	 * capability that reads them resolves package subpaths against an exports map.
	 */
	styleSheets?: readonly WorkspaceFile[];
	/**
	 * The published surface of packages whose stylesheet subpaths the application
	 * imports, as read from the installed closure. A package not read here has its
	 * style imports left exactly as they are.
	 */
	packageExports?: readonly PackageExportsReading[];
	/**
	 * The installed dependency closure, reduced to declarations and shipped
	 * imports. Supplying it is what lets undeclared runtime dependencies be
	 * detected; a tree that supplies none has none detected, which is a different
	 * thing from having none.
	 */
	installedPackages?: readonly InstalledPackage[];
	/** How the workspace resolves module specifiers written in its own source. */
	moduleResolution?: ModuleResolution;
}>;

export type MigratedFile = Readonly<{
	path: string;
	kind: 'application' | 'workspace';
	changed: boolean;
	sha256Before: string;
	sha256After: string;
	source: string;
	changes: readonly string[];
}>;

export type AngularMigration = Readonly<{
	cell: string;
	files: readonly MigratedFile[];
	applicationFilesChanged: number;
	workspaceFilesChanged: number;
	applicationFilesScanned: number;
	unhandled: readonly string[];
	/**
	 * Capabilities the migrated workspace deliberately no longer has, one line
	 * per removal — a dropped lint target, a dropped configuration file, a
	 * package the cell read and found no successor for. A reader is owed these by
	 * name: they are the difference between the era workspace and this one that a
	 * clean changeset would otherwise hide.
	 */
	declaredDifferences: readonly string[];
	/** Files the migration decided the tree should no longer carry. */
	removedFiles: readonly string[];
}>;

function sha256(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

function describeConfigChange(change: ConfigChange): string {
	if (change.to === null) return `removed ${change.path} (was ${change.from ?? 'absent'})`;
	if (change.from === null) return `added ${change.path} = ${change.to}`;
	return `${change.path}: ${change.from} -> ${change.to}`;
}

function describeDependencyChange(change: DependencyChange): string {
	const target = `${change.field}.${change.name}`;
	return change.to === null
		? `removed ${target} (was ${change.from}) — ${change.reason}`
		: `${target}: ${change.from} -> ${change.to} — ${change.reason}`;
}

function describeSourceChange(
	change:
		| SourceChange
		| NgrxEffectChange
		| SentryV8Change
		| ModalContentParamsChange
		| StyleImportChange,
): string {
	return `line ${change.line}: ${change.kind} ${change.from} -> ${change.to}`;
}

function file(
	input: WorkspaceFile,
	source: string,
	kind: MigratedFile['kind'],
	changes: readonly string[],
): MigratedFile {
	return Object.freeze({
		path: input.path,
		kind,
		changed: source !== input.source,
		sha256Before: sha256(input.source),
		sha256After: sha256(source),
		source,
		changes: Object.freeze([...changes]),
	});
}

/**
 * Apply every capability of the adapter to one workspace.
 *
 * Order matters in exactly one place: the workspace migration decides which
 * builder targets cannot be carried, and the packages those targets released
 * are what the manifest alignment then removes. Nothing else is ordered, and no
 * capability reads a file it was not handed.
 */
export function migrateAngularCliEraWorkspace(
	input: AngularMigrationInput,
	cell: AngularTargetCell,
): AngularMigration {
	const unhandled: string[] = [];
	const declaredDifferences: string[] = [];
	const fragments: Record<string, string> = {};
	for (const fragment of input.webpackFragments ?? [])
		fragments[normalizeFragmentPath(fragment.path)] = fragment.source;
	const workspace = migrateAngularWorkspace(input.workspaceConfig.source, cell, fragments);
	unhandled.push(...workspace.unhandled);
	declaredDifferences.push(...workspace.declaredDifferences);
	const configRemovals = tslintConfigRemovals(input.workspaceFiles ?? [], cell);
	declaredDifferences.push(...configRemovals.map((removal) => removal.reason));
	for (const absorbed of workspace.absorbedFragments)
		unhandled.push(
			`${absorbed.path} was absorbed into the official builder and is no longer referenced by any ` +
				`target; it was left in the tree rather than deleted. Absorbed capabilities: ` +
				absorbed.capabilities.map((entry) => `${entry.kind} ${entry.detail}`).join(', '),
		);
	const manifest: unknown = JSON.parse(input.packageManifest.source);
	if (typeof manifest !== 'object' || manifest === null || Array.isArray(manifest))
		throw new Error('Angular migration: the package manifest is not a JSON object');
	const aligned = alignAngularPackageManifest(
		manifest as Readonly<Record<string, unknown>>,
		cell,
		workspace.removedPackages,
	);
	unhandled.push(...aligned.unhandled);
	declaredDifferences.push(...aligned.declaredDifferences);
	/**
	 * Holes the closure carries are closed after the cell alignment, not before:
	 * the cell decides which lines the workspace runs, and an undeclared edge is
	 * declared at the line the cell read for it.
	 */
	const holes = undeclaredRuntimeDependencies(input.installedPackages ?? []);
	const declared = declareUndeclaredRuntimeDependencies(aligned.manifest, holes, cell);
	unhandled.push(...declared.unhandled);
	declaredDifferences.push(...declared.declaredDifferences);
	const tsConfig = migrateAngularTsConfig(input.tsConfig.source, cell);
	unhandled.push(...tsConfig.unhandled);
	const files: MigratedFile[] = [
		file(
			input.packageManifest,
			`${JSON.stringify(declared.manifest, null, 2)}\n`,
			'workspace',
			[
				...aligned.changes.map(describeDependencyChange),
				...declared.declarations.map(
					(entry) =>
						`added ${entry.field}.${entry.name} = ${entry.range} — ${entry.reason}`,
				),
			],
		),
		file(
			input.workspaceConfig,
			workspace.config,
			'workspace',
			workspace.changes.map(describeConfigChange),
		),
		file(
			input.tsConfig,
			tsConfig.config,
			'workspace',
			tsConfig.changes.map(describeConfigChange),
		),
	];
	/**
	 * Source capabilities run in sequence over each module, each one handed what
	 * the last produced. They are independent — one rewrites module specifiers,
	 * the next replaces a removed NgRx decorator — and a module is counted as
	 * changed if any of them changed a byte of it.
	 */
	/**
	 * One capability is not per-module and cannot be: rewriting a modal call site
	 * without rewriting the content component it supplied is the silent failure
	 * that capability exists to refuse. It runs over the whole tree first, and
	 * what it produced is what the per-module capabilities then see.
	 */
	const modal = migrateModalContentParams(input.sourceModules, input.moduleResolution ?? {});
	unhandled.push(...modal.unhandled);
	const modalByPath = new Map(modal.files.map((entry) => [entry.path, entry]));
	for (const module of [...input.sourceModules].sort((left, right) =>
		compareStrings(left.path, right.path),
	)) {
		const modalFile = modalByPath.get(module.path);
		const entrySource = modalFile?.source ?? module.source;
		const migrated = migrateAngularSourceModule(module.path, entrySource);
		const effects = migrateNgrxEffectDecorators(module.path, migrated.source);
		const sentry = migrateSentryV8Tracing(module.path, effects.source);
		unhandled.push(...migrated.unhandled, ...effects.unhandled, ...sentry.unhandled);
		files.push(
			file(module, sentry.source, 'application', [
				...(modalFile?.changes ?? []).map(describeSourceChange),
				...migrated.changes.map(describeSourceChange),
				...effects.changes.map(describeSourceChange),
				...sentry.changes.map(describeSourceChange),
			]),
		);
	}
	/**
	 * Stylesheets are application files too, and a blocked package subpath is an
	 * application file that no longer builds. Each is offered to every package
	 * reading the caller supplied; a stylesheet no reading touches is carried
	 * through unchanged and still counted, so the scanned total means what it says.
	 */
	for (const sheet of [...(input.styleSheets ?? [])].sort((left, right) =>
		compareStrings(left.path, right.path),
	)) {
		let source = sheet.source;
		const changes: string[] = [];
		for (const reading of input.packageExports ?? []) {
			const styles = migratePackageStyleImports(sheet.path, source, reading);
			unhandled.push(...styles.unhandled);
			declaredDifferences.push(...styles.declaredDifferences);
			changes.push(...styles.changes.map(describeSourceChange));
			source = styles.source;
		}
		files.push(file(sheet, source, 'application', changes));
	}
	const applicationFiles = files.filter((entry) => entry.kind === 'application');
	return Object.freeze({
		cell: cell.id,
		files: Object.freeze(files),
		applicationFilesChanged: applicationFiles.filter((entry) => entry.changed).length,
		workspaceFilesChanged: files.filter((entry) => entry.kind === 'workspace' && entry.changed)
			.length,
		applicationFilesScanned: applicationFiles.length,
		unhandled: Object.freeze([...new Set(unhandled)]),
		declaredDifferences: Object.freeze([...new Set(declaredDifferences)]),
		removedFiles: Object.freeze(configRemovals.map((removal) => removal.at)),
	});
}
