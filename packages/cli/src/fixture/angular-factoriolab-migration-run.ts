/**
 * Drive the reusable Angular CLI era adapter over the materialised
 * `angular-factoriolab` tree and record what it changed.
 *
 * The driver is fixture-scoped: it knows where this fixture's tree lives and
 * which pinned revision it must be. Every decision about *what* to change lives
 * in `@versionless/angular`, which knows nothing about this application.
 *
 * The record this writes is a source-level migration record. It states which
 * files the adapter changed and to which bytes; it does not state that the
 * result installs, builds, or behaves like the era baseline, and the record
 * carries those as explicit non-claims rather than leaving them to be assumed.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import {
	ANGULAR_16_BROWSER_CELL,
	migrateAngularCliEraWorkspace,
	type AngularMigration,
	type WorkspaceFile,
} from '../../../frameworks/angular/src/index.ts';

export const FACTORIOLAB_COMMIT = '5f54abbdcac518d8ebf7e136c4348384d9b1a2bb';
export const FACTORIOLAB_ARCHIVE_URL =
	'https://codeload.github.com/factoriolab/factoriolab/tar.gz/5f54abbdcac518d8ebf7e136c4348384d9b1a2bb';
export const FACTORIOLAB_ARCHIVE_SHA256 =
	'11f2ce939f4be04b11e77b7f12e13d7449bf944b9bfefbeca237c46dea12f7ed';
export const FACTORIOLAB_ARCHIVE_BYTES = 267218;

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');
const evidenceDirectory = path.join(repositoryRoot, 'evidence/runs/angular-factoriolab');

/** The single current source-migration record. See {@link SUPERSEDES}. */
export const MIGRATION_RECORD_FILE = 'm2-source-migration.json';

export const MIGRATION_UNIT = 'lrapr-t005/m2-factoriolab-build-lanes';
export const CONSENT_ID = 'VL-LEGACY-CORPUS-2026-08-10';

export function sha256(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

export function canonical(value: unknown): string {
	return `${JSON.stringify(value, null, 2)}\n`;
}

async function typescriptModulesBelow(directory: string, root: string): Promise<WorkspaceFile[]> {
	const files: WorkspaceFile[] = [];
	for (const entry of (await readdir(directory, { withFileTypes: true })).sort((left, right) =>
		left.name < right.name ? -1 : 1,
	)) {
		const item = path.join(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await typescriptModulesBelow(item, root)));
		else if (entry.isFile() && path.extname(entry.name) === '.ts')
			files.push({
				path: path.relative(root, item).split(path.sep).join('/'),
				source: await readFile(item, 'utf8'),
			});
	}
	return files;
}

/** Read the four inputs the adapter migrates out of a materialised tree. */
export async function readWorkspace(tree: string): Promise<{
	packageManifest: WorkspaceFile;
	workspaceConfig: WorkspaceFile;
	tsConfig: WorkspaceFile;
	sourceModules: readonly WorkspaceFile[];
}> {
	const read = async (relative: string): Promise<WorkspaceFile> => ({
		path: relative,
		source: await readFile(path.join(tree, relative), 'utf8'),
	});
	return {
		packageManifest: await read('package.json'),
		workspaceConfig: await read('angular.json'),
		tsConfig: await read('tsconfig.json'),
		sourceModules: await typescriptModulesBelow(path.join(tree, 'src'), tree),
	};
}

export type MigrationRecord = Readonly<{
	schemaVersion: 'versionless.angular-factoriolab-source-migration.v1';
	unit: string;
	consentId: string;
	result: 'source-migration-recorded';
	supersedes: readonly string[];
	source: Readonly<{ commit: string; archiveUrl: string; archiveSha256: string; bytes: number }>;
	cell: Readonly<{
		id: string;
		angularLine: string;
		builder: string;
		nodeLine: string;
		typescriptRange: string;
		rationale: readonly string[];
	}>;
	migration: Readonly<{
		applicationFilesScanned: number;
		applicationFilesChanged: number;
		workspaceFilesChanged: number;
		files: readonly Readonly<{
			path: string;
			kind: 'application' | 'workspace';
			sha256Before: string;
			sha256After: string;
			changes: readonly string[];
		}>[];
	}>;
	unhandled: readonly string[];
	notEstablished: readonly string[];
	nonclaims: readonly string[];
	digest: string;
}>;

const NOT_ESTABLISHED: readonly string[] = Object.freeze([
	'This record states what the adapter changed. Whether the changed tree installs and builds is recorded separately, in the build-lane records beside it, and neither is implied here.',
	'No test-cell outcome is established: the karma/jasmine toolchain was aligned so the dependency closure could resolve, and no test run was attempted.',
	'No browser behaviour, runtime parity or user-visible equivalence was observed.',
]);

const NONCLAIMS: readonly string[] = Object.freeze([
	'This record states which bytes a set of reusable transforms changed in one pinned tree. It establishes no migration feasibility, no production readiness, no certification and no support claim for Angular applications generally.',
]);

/**
 * The record this replaces, and why the count moved.
 *
 * The m1 unit recorded two changed application files, measured without ever
 * building. Building is what found the third: NgRx removed the `@Effect()`
 * decorator export, so the module carrying it does not compile on the target
 * line. The earlier record is not kept beside this one, because it was produced
 * by an adapter that no longer exists and would not reproduce from this tree.
 */
const SUPERSEDES: readonly string[] = Object.freeze([
	'evidence/runs/angular-factoriolab/m1-source-migration.json, which recorded applicationFilesChanged: 2 from the adapter as it stood before either build lane ran.',
	'The count grew to 3 because the target-cell build rejected @ngrx/effects’ removed Effect decorator, a shape no source-level inspection had flagged.',
]);

export function buildMigrationRecord(
	migration: AngularMigration,
	unit: string,
	consentId: string,
): MigrationRecord {
	const body = {
		schemaVersion: 'versionless.angular-factoriolab-source-migration.v1',
		unit,
		consentId,
		result: 'source-migration-recorded',
		supersedes: SUPERSEDES,
		source: {
			commit: FACTORIOLAB_COMMIT,
			archiveUrl: FACTORIOLAB_ARCHIVE_URL,
			archiveSha256: FACTORIOLAB_ARCHIVE_SHA256,
			bytes: FACTORIOLAB_ARCHIVE_BYTES,
		},
		cell: {
			id: ANGULAR_16_BROWSER_CELL.id,
			angularLine: ANGULAR_16_BROWSER_CELL.angularLine,
			builder: ANGULAR_16_BROWSER_CELL.builder,
			nodeLine: ANGULAR_16_BROWSER_CELL.nodeLine,
			typescriptRange: ANGULAR_16_BROWSER_CELL.typescriptRange,
			rationale: ANGULAR_16_BROWSER_CELL.rationale,
		},
		migration: {
			applicationFilesScanned: migration.applicationFilesScanned,
			applicationFilesChanged: migration.applicationFilesChanged,
			workspaceFilesChanged: migration.workspaceFilesChanged,
			files: migration.files
				.filter((entry) => entry.changed)
				.map((entry) => ({
					path: entry.path,
					kind: entry.kind,
					sha256Before: entry.sha256Before,
					sha256After: entry.sha256After,
					changes: entry.changes,
				})),
		},
		unhandled: migration.unhandled,
		notEstablished: NOT_ESTABLISHED,
		nonclaims: NONCLAIMS,
	} as const;
	return Object.freeze({ ...body, digest: sha256(canonical(body)) });
}

/** Recompute the record's digest; a record that does not seal is rejected. */
export function verifyMigrationRecord(record: MigrationRecord): MigrationRecord {
	const { digest, ...body } = record;
	const recomputed = sha256(canonical(body));
	if (recomputed !== digest)
		throw new Error(
			`Angular factoriolab migration record digest differs: recorded ${digest}, recomputed ${recomputed}`,
		);
	return record;
}

export async function main(): Promise<void> {
	const index = process.argv.indexOf('--tree');
	const tree = index === -1 ? undefined : process.argv[index + 1];
	if (tree === undefined)
		throw new Error('Angular factoriolab migration requires --tree <materialised-tree>');
	const workspace = await readWorkspace(tree);
	const migration = migrateAngularCliEraWorkspace(workspace, ANGULAR_16_BROWSER_CELL);
	const record = verifyMigrationRecord(
		buildMigrationRecord(migration, MIGRATION_UNIT, CONSENT_ID),
	);
	const migratedTree = path.join(tree, '..', 'migrated');
	for (const entry of migration.files) {
		if (!entry.changed) continue;
		const destination = path.join(migratedTree, entry.path);
		await mkdir(path.dirname(destination), { recursive: true });
		await writeFile(destination, entry.source);
	}
	await mkdir(evidenceDirectory, { recursive: true });
	await writeFile(path.join(evidenceDirectory, MIGRATION_RECORD_FILE), canonical(record));
	process.stdout.write(canonical(record));
}

if (process.argv[1]?.endsWith('angular-factoriolab-migration-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
