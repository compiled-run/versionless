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
	migrateNgrxEffectDecorators,
	type NgrxEffectChange,
} from './ngrx-effects-migration.ts';
import {
	migrateAngularTsConfig,
	migrateAngularWorkspace,
	type ConfigChange,
} from './angular-workspace-migration.ts';

export type WorkspaceFile = Readonly<{ path: string; source: string }>;

export type AngularMigrationInput = Readonly<{
	packageManifest: WorkspaceFile;
	workspaceConfig: WorkspaceFile;
	tsConfig: WorkspaceFile;
	/** Application source modules, as read from the workspace. */
	sourceModules: readonly WorkspaceFile[];
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

function describeSourceChange(change: SourceChange | NgrxEffectChange): string {
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
	const workspace = migrateAngularWorkspace(input.workspaceConfig.source, cell);
	unhandled.push(...workspace.unhandled);
	const manifest: unknown = JSON.parse(input.packageManifest.source);
	if (typeof manifest !== 'object' || manifest === null || Array.isArray(manifest))
		throw new Error('Angular migration: the package manifest is not a JSON object');
	const aligned = alignAngularPackageManifest(
		manifest as Readonly<Record<string, unknown>>,
		cell,
		workspace.removedPackages,
	);
	unhandled.push(...aligned.unhandled);
	const tsConfig = migrateAngularTsConfig(input.tsConfig.source, cell);
	unhandled.push(...tsConfig.unhandled);
	const files: MigratedFile[] = [
		file(
			input.packageManifest,
			`${JSON.stringify(aligned.manifest, null, 2)}\n`,
			'workspace',
			aligned.changes.map(describeDependencyChange),
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
	for (const module of [...input.sourceModules].sort((left, right) =>
		compareStrings(left.path, right.path),
	)) {
		const migrated = migrateAngularSourceModule(module.path, module.source);
		const effects = migrateNgrxEffectDecorators(module.path, migrated.source);
		unhandled.push(...migrated.unhandled, ...effects.unhandled);
		files.push(
			file(module, effects.source, 'application', [
				...migrated.changes.map(describeSourceChange),
				...effects.changes.map(describeSourceChange),
			]),
		);
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
	});
}
