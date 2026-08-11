/**
 * Drive the reusable Angular CLI era adapter over the materialised
 * `angular-jira-clone` tree and record what it changed.
 *
 * This is the adapter's second independent application. The driver is
 * fixture-scoped — it knows where this fixture's tree lives and which pinned
 * revision it must be — while every decision about *what* to change lives in
 * `@versionless/angular`, which knows nothing about this application.
 *
 * The record this writes is a source-level migration record. It states which
 * files the adapter changed and to which bytes; it does not state that the
 * result installs, builds, or behaves like the era baseline, and the record
 * carries those as explicit non-claims rather than leaving them to be assumed.
 */

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import {
	ANGULAR_16_BROWSER_CELL,
	migrateAngularCliEraWorkspace,
	type AngularMigration,
	type WorkspaceFile,
} from '../../../frameworks/angular/src/index.ts';
import { canonical, sha256 } from './angular-factoriolab-migration-run.ts';

export const JIRA_CLONE_COMMIT = '059455b9933a236456524925065bce2c295e2d9a';
export const JIRA_CLONE_ARCHIVE_URL =
	'https://codeload.github.com/trungvose/jira-clone-angular/tar.gz/059455b9933a236456524925065bce2c295e2d9a';
export const JIRA_CLONE_ARCHIVE_SHA256 =
	'd913ad5d4686b6a236799166c7c781f624b3901a1826304e00c36eca82896bc5';
export const JIRA_CLONE_ARCHIVE_BYTES = 8048993;

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');
const evidenceDirectory = path.join(repositoryRoot, 'evidence/runs/angular-jira-clone');

export const MIGRATION_RECORD_FILE = 'mj1-source-migration.json';
export const MIGRATION_UNIT = 'lrapr-t005/mj1-jira-clone-migration-lanes';
export const CONSENT_ID = 'VL-LEGACY-CORPUS-2026-08-10';

/** Files the workspace may reference as a custom webpack fragment. */
export const CANDIDATE_WEBPACK_FRAGMENTS: readonly string[] = Object.freeze([
	'webpack.config.js',
	'extra-webpack.config.js',
]);

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

async function readIfPresent(file: string, relative: string): Promise<WorkspaceFile | null> {
	try {
		return { path: relative, source: await readFile(file, 'utf8') };
	} catch {
		return null;
	}
}

/** Read the inputs the adapter migrates out of a materialised tree. */
export async function readWorkspace(tree: string): Promise<{
	packageManifest: WorkspaceFile;
	workspaceConfig: WorkspaceFile;
	tsConfig: WorkspaceFile;
	sourceModules: readonly WorkspaceFile[];
	webpackFragments: readonly WorkspaceFile[];
}> {
	const read = async (relative: string): Promise<WorkspaceFile> => ({
		path: relative,
		source: await readFile(path.join(tree, relative), 'utf8'),
	});
	const fragments: WorkspaceFile[] = [];
	for (const candidate of CANDIDATE_WEBPACK_FRAGMENTS) {
		const found = await readIfPresent(path.join(tree, candidate), candidate);
		if (found !== null) fragments.push(found);
	}
	return {
		packageManifest: await read('package.json'),
		workspaceConfig: await read('angular.json'),
		tsConfig: await read('tsconfig.json'),
		sourceModules: await typescriptModulesBelow(path.join(tree, 'src'), tree),
		webpackFragments: fragments,
	};
}

export type MigrationRecord = Readonly<Record<string, unknown>> & Readonly<{ digest: string }>;

/**
 * What this cell reuses from the first Angular application, said plainly.
 *
 * The target cell is not a new one. `angular-16-browser-builder` was declared
 * for factoriolab and is adopted here unchanged, which is the point of a cell:
 * a second application either fits the declared cell or it does not. Reusing it
 * establishes nothing new about the cell itself.
 */
const CELL_REUSE: readonly string[] = Object.freeze([
	'The target cell angular-16-browser-builder is the same cell factoriolab was migrated onto. It was not re-derived for this application and nothing here re-establishes its rationale.',
	'Two facts about this application were added to the cell rather than to this fixture, because they are facts about the Angular ecosystem: the @angular-eslint family tracks the Angular major, and the official browser builder’s own postcss pipeline already runs tailwindcss, autoprefixer and `@import` resolution.',
	'Both lanes of this cell run on Node 16.20.2, which is what this application’s own .nvmrc pins as a major and what the era baseline already used. The migrated lane therefore changes the framework without also changing the runtime.',
]);

const NOT_ESTABLISHED: readonly string[] = Object.freeze([
	'This record states what the adapter changed. Whether the changed tree installs and builds is recorded separately, in the build-lane records beside it, and neither is implied here.',
	'No test-cell outcome is established: the karma/jasmine toolchain was aligned so the dependency closure could resolve, and no test run was attempted.',
	'No browser behaviour, runtime parity or user-visible equivalence was observed. No witness ran.',
]);

const NONCLAIMS: readonly string[] = Object.freeze([
	'This record states which bytes a set of reusable transforms changed in one pinned tree. It establishes no migration feasibility, no production readiness, no certification and no support claim for Angular applications generally.',
	'A second application on one adapter is a second application, not a general result. Nothing here says the adapter carries a third.',
]);

export function buildMigrationRecord(
	migration: AngularMigration,
	unit: string,
	consentId: string,
): MigrationRecord {
	const body = {
		schemaVersion: 'versionless.angular-jira-clone-source-migration.v1',
		unit,
		consentId,
		result: 'source-migration-recorded',
		adapterApplication: 'second — the same @versionless/angular adapter, a different application',
		source: {
			repository: 'trungvose/jira-clone-angular',
			commit: JIRA_CLONE_COMMIT,
			archiveUrl: JIRA_CLONE_ARCHIVE_URL,
			archiveSha256: JIRA_CLONE_ARCHIVE_SHA256,
			bytes: JIRA_CLONE_ARCHIVE_BYTES,
			era: 'Angular 13.2.4, CLI 13.2.5, @angular-builders/custom-webpack:browser over a root webpack.config.js, ng-zorro-antd 13, Akita 7, Tailwind 3, TypeScript 4.5.5',
		},
		cell: {
			id: ANGULAR_16_BROWSER_CELL.id,
			angularLine: ANGULAR_16_BROWSER_CELL.angularLine,
			builder: ANGULAR_16_BROWSER_CELL.builder,
			nodeLine: ANGULAR_16_BROWSER_CELL.nodeLine,
			typescriptRange: ANGULAR_16_BROWSER_CELL.typescriptRange,
			rationale: ANGULAR_16_BROWSER_CELL.rationale,
			reuse: CELL_REUSE,
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
			`Angular jira-clone migration record digest differs: recorded ${digest}, recomputed ${recomputed}`,
		);
	return record;
}

export async function main(): Promise<void> {
	const index = process.argv.indexOf('--tree');
	const tree = index === -1 ? undefined : process.argv[index + 1];
	if (tree === undefined)
		throw new Error('Angular jira-clone migration requires --tree <materialised-tree>');
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

if (process.argv[1]?.endsWith('angular-jira-clone-migration-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
