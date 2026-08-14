/**
 * The Angular holdout: compose the `@versionless/angular` changeset for the
 * pinned `angular-pigallery2-v1-7-0` tree and write it into a migrated lane, so
 * a closure can be installed into it and a production build attempted on the
 * bytes the frozen adapter produced.
 *
 * This application was never seen by the adapter while the adapter was being
 * designed. Nothing in `@versionless/angular` was written for it, and nothing in
 * `@versionless/angular` was changed for it: the adapter subtree is frozen at
 * tree oid ca3824d0595d1fa88d37feda6b1785dfd79e72c4 for the whole of this unit.
 * What this driver produces is therefore a measurement and not a demonstration.
 *
 * The driver is fixture-scoped. It knows three things about this application —
 * where its corpus was materialised, that its Angular `sourceRoot` is
 * `frontend/` rather than the conventional `src/`, and that the browser build's
 * compilation unit reaches into the sibling `common/` directory the backend also
 * compiles. Those are paths, read out of the application's own `angular.json`
 * and `tsconfig.app.json`. Every decision about *what to change* lives in the
 * frozen adapter, which knows nothing about this application.
 */

import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import {
	migrateAngularCliEraWorkspace,
	readMissingMembers,
	ANGULAR_16_BROWSER_CELL,
	type AngularMigration,
	type DeepImportReading,
	type MissingMemberDiagnosticReading,
	type WorkspaceFile,
} from '../../../frameworks/angular/src/index.ts';
import { readDeepImportReading } from './angular-tiny-translator-final-run.ts';
import { canonical, sha256 } from './angular-factoriolab-migration-run.ts';
import { sealRecord, verifySealedRecord, type SealedRecord } from './angular-factoriolab-build-lanes-run.ts';
import { applyMigration, type Application } from './angular-tiny-translator-apply-run.ts';

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');

export const UNIT = 'lrapr-t018/u3-frozen-adapter-migration';
export const CONSENT = 'VL-LEGACY-CORPUS-2026-08-10';
export const COMMIT = '6d44c22df13b8f9416715e86e160707d0c3f973a';

/** The immutable corpus the baseline lane was also cut from. */
export const SOURCE_TREE = path.join(
	repositoryRoot,
	'.versionless/cache/angular-pigallery2-v1-7-0-source/corpus',
	`pigallery2-${COMMIT}`,
);

/** The era lane: the pinned revision with the era closure installed into it. */
export const ERA_CLOSURE_TREE = path.join(
	repositoryRoot,
	'.versionless/work/angular-pigallery2/baseline',
);

/** The migrated lane, beside the baseline lane the previous unit built. */
export const STAGE_DIRECTORY = path.join(repositoryRoot, '.versionless/work/angular-pigallery2/target');
/** The pinned revision with the changeset written into it; the build tree. */
export const APPLIED_TREE = path.join(STAGE_DIRECTORY, 'app');

export const EVIDENCE_DIRECTORY = path.join(
	repositoryRoot,
	'evidence/ingests/angular-pigallery2-v1-7-0/migration',
);

export const CHANGESET_FILE = 'u3-composed-changeset.json';
export const MIGRATION_RECORD_FILE = 'u3-source-migration.json';

/**
 * The two directories the Angular browser build compiles, and why the second one
 * is not the conventional single `sourceRoot`.
 *
 * `angular.json` declares `sourceRoot: "frontend"`, and `frontend/tsconfig.app.json`
 * includes `./**\/*` relative to it. TypeScript then follows the relative imports
 * the frontend modules write into `../common/`, so `common/**\/*.ts` is inside the
 * browser build's compilation unit even though no configuration file names it.
 * A migration handed only `frontend/` would scan a strict subset of what the
 * compiler reads.
 */
export const APPLICATION_SOURCE_DIRECTORIES: readonly string[] = Object.freeze(['frontend', 'common']);

/**
 * The build log the previous migrated run wrote, and which this one reads.
 *
 * Two capabilities in the adapter are positioned by the compiler's own
 * coordinates rather than by a shape in the source, because what they answer is
 * not visible in the source: a member the target line's `lib.dom.d.ts` stopped
 * declaring reads exactly as it always did. A caller that has never compiled the
 * tree supplies no such reading and gets no such transform, which is the seam
 * `unparameterised-base-class` already had. This driver has compiled the tree —
 * the log is in this application's own evidence directory — so it reads it.
 */
export const PREVIOUS_BUILD_LOG = 't021-u3-lane-build-run1.log';

/** The package this application reaches past the published surface of. */
export const DEEP_IMPORT_PACKAGES: readonly string[] = Object.freeze(['ngx-bootstrap']);

/**
 * The `@types/` packages the era closure carried, by name.
 *
 * An era application can import a package directly and declare neither it nor
 * its type companion, because something else in the closure installed both. The
 * migrated closure has neither, and which companions the era one had is a fact
 * about that installation rather than about any package name — so it is read off
 * the era lane rather than inferred.
 */
export async function readEraClosureTypePackages(tree: string): Promise<readonly string[]> {
	const directory = path.join(tree, 'node_modules', '@types');
	try {
		const entries = await readdir(directory, { withFileTypes: true });
		return Object.freeze(
			entries
				.filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
				.map((entry) => `@types/${entry.name}`)
				.sort(),
		);
	} catch {
		return Object.freeze([]);
	}
}

/** The `TS2339` positions the previous migrated build reported, per module. */
export async function readMissingMemberDiagnostics(
	log: string,
): Promise<readonly MissingMemberDiagnosticReading[]> {
	const source = await readFile(path.join(EVIDENCE_DIRECTORY, log), 'utf8');
	return Object.freeze(
		[...readMissingMembers(source)]
			.map(([modulePath, diagnostics]) => Object.freeze({ path: modulePath, diagnostics }))
			.sort((left, right) => (left.path < right.path ? -1 : 1)),
	);
}

/** What the packages this application deep-imports actually publish. */
export async function readDeepImportReadings(tree: string): Promise<readonly DeepImportReading[]> {
	const readings: DeepImportReading[] = [];
	for (const name of DEEP_IMPORT_PACKAGES) readings.push(await readDeepImportReading(tree, name));
	return Object.freeze(readings);
}

async function filesBelow(
	directory: string,
	root: string,
	extension: string,
): Promise<WorkspaceFile[]> {
	const files: WorkspaceFile[] = [];
	for (const entry of (await readdir(directory, { withFileTypes: true })).sort((left, right) =>
		left.name < right.name ? -1 : 1,
	)) {
		const item = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await filesBelow(item, root, extension)));
			continue;
		}
		if (!entry.isFile() || path.extname(entry.name) !== extension) continue;
		files.push({ path: path.relative(root, item), source: await readFile(item, 'utf8') });
	}
	return files;
}

/** Every workspace-relative path the tree carries, excluding installed packages. */
async function workspacePathsBelow(directory: string, root: string): Promise<string[]> {
	const paths: string[] = [];
	for (const entry of (await readdir(directory, { withFileTypes: true })).sort((left, right) =>
		left.name < right.name ? -1 : 1,
	)) {
		if (entry.name === 'node_modules' || entry.name === '.git') continue;
		const item = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			paths.push(...(await workspacePathsBelow(item, root)));
			continue;
		}
		if (entry.isFile()) paths.push(path.relative(root, item));
	}
	return paths;
}

async function collect(
	tree: string,
	extension: string,
	directories: readonly string[],
): Promise<WorkspaceFile[]> {
	const files: WorkspaceFile[] = [];
	for (const directory of directories)
		files.push(...(await filesBelow(path.join(tree, directory), tree, extension)));
	return files;
}

/**
 * Compose the changeset for the pinned tree.
 *
 * The workspace configuration handed in is a modern `angular.json`, so the
 * CLI 1.x synthesis capability stands down on its own — it reads the document's
 * shape, and nothing here tells it which format to expect.
 */
export async function composeMigration(tree: string): Promise<AngularMigration> {
	const sourceModules = (await collect(tree, '.ts', APPLICATION_SOURCE_DIRECTORIES)).filter(
		(module) => !module.path.endsWith('.spec.ts'),
	);
	return migrateAngularCliEraWorkspace(
		{
			missingMemberDiagnostics: await readMissingMemberDiagnostics(PREVIOUS_BUILD_LOG),
			deepImportReadings: await readDeepImportReadings(APPLIED_TREE),
			eraClosureTypePackages: await readEraClosureTypePackages(ERA_CLOSURE_TREE),
			packageManifest: {
				path: 'package.json',
				source: await readFile(path.join(tree, 'package.json'), 'utf8'),
			},
			workspaceConfig: {
				path: 'angular.json',
				source: await readFile(path.join(tree, 'angular.json'), 'utf8'),
			},
			tsConfig: {
				path: 'tsconfig.json',
				source: await readFile(path.join(tree, 'tsconfig.json'), 'utf8'),
			},
			sourceModules,
			templates: await collect(tree, '.html', ['frontend']),
			styleSheets: await collect(tree, '.css', ['frontend']),
			workspaceFiles: await workspacePathsBelow(tree, tree),
		},
		ANGULAR_16_BROWSER_CELL,
	);
}

/**
 * Era workspace facts this application carries that the hop has to answer for or
 * declare dropped. They are named because a changeset that silently loses one of
 * them would still look clean.
 */
export const ERA_WORKSPACE_FACTS: readonly string[] = Object.freeze([
	'`sourceRoot: "frontend"` and an `outputPath` of `dist` at the workspace root — this workspace is not `src/`-rooted, and its build output directory is the same one the backend release pipeline writes into.',
	'`extractCss: true` on the production configuration — a valid key for the Angular 8 browser builder, and one the Angular 13 line removed.',
	"The build is driven by the repository's own gulp task rather than by `ng` directly, and that task passes `--i18n-locale en --i18n-format=xlf --i18n-file=frontend/translate/messages.en.xlf --i18n-missing-translation warning`. Those are ViewEngine i18n flags of the Angular 8 CLI; the workspace file itself declares no i18n at all.",
	'A second workspace project, pigallery2-e2e, whose only targets are the protractor e2e runner and a TSLint lint target.',
	'The pigallery2 lint target names `src/tsconfig.app.json` and `src/tsconfig.spec.json` — paths that do not exist in this tree, because the workspace was renamed to `frontend/` without updating them. The era lint target was already broken at the pin.',
	'`@angular/http@7.2.15` declared beside Angular 8.1.2 — a package Angular removed after the 7 line.',
	'`rxjs-compat@6.5.2`, the RxJS 5-compatibility shim, declared beside rxjs 6.5.2.',
]);

/** The changeset record: every file by path and by digest before and after. */
export function buildChangesetRecord(migration: AngularMigration): SealedRecord {
	return sealRecord({
		schemaVersion: 'versionless.angular-pigallery2-composed-changeset.v1',
		unit: UNIT,
		consentId: CONSENT,
		cell: migration.cell,
		appliedTo: `The pinned revision ${COMMIT} as materialised, read-only, at .versionless/cache/angular-pigallery2-v1-7-0-source/corpus — the same corpus the era baseline lane was cut from.`,
		holdoutPosition:
			'The Angular holdout. This application was never ingested, fixtured, adapted, witnessed or receipted in this repository before T018, and the adapter subtree was frozen before this unit began. No capability was written for it and none was changed for it; the changeset is what the existing inventory produced when it was pointed at a tree it had never seen.',
		eraWorkspaceFacts: ERA_WORKSPACE_FACTS,
		applicationSourceDirectories: APPLICATION_SOURCE_DIRECTORIES,
		applicationFilesScanned: migration.applicationFilesScanned,
		applicationFilesChanged: migration.applicationFilesChanged,
		workspaceFilesChanged: migration.workspaceFilesChanged,
		files: migration.files.map((entry) => ({
			path: entry.path,
			kind: entry.kind,
			changed: entry.changed,
			sha256Before: entry.sha256Before,
			sha256After: entry.sha256After,
			changes: entry.changes,
		})),
		removedFiles: migration.removedFiles,
		declaredDifferences: migration.declaredDifferences,
		unhandled: migration.unhandled,
		notEstablished: [
			'A composed changeset is a set of edits, not a build. Nothing here establishes that the migrated tree installs, compiles or emits anything.',
			'`applicationFilesChanged` counts application source a transform rewrote. A file the adapter scanned and left alone is counted as scanned and not as changed.',
			'A cell disposition is a reading of a registry, not an installation. A range written here has not been resolved against a lockfile by this record.',
		],
	});
}

/** The applied-changeset record: the same changeset, written into a named tree. */
export function buildApplicationRecord(
	migration: AngularMigration,
	applied: Application,
): SealedRecord {
	return sealRecord({
		schemaVersion: 'versionless.angular-pigallery2-source-migration.v1',
		unit: UNIT,
		consentId: CONSENT,
		cell: migration.cell,
		appliedTo: {
			tree: '.versionless/work/angular-pigallery2/target/app',
			from: `.versionless/cache/angular-pigallery2-v1-7-0-source/corpus/pigallery2-${COMMIT}`,
			commit: COMMIT,
			excludedFromStage: ['node_modules', '.git'],
			excludedReason:
				'The corpus carries neither: it is the extracted release tarball, verified blob for blob against the pinned git tree by the ingest unit.',
		},
		applicationFilesScanned: migration.applicationFilesScanned,
		applicationFilesChanged: migration.applicationFilesChanged,
		workspaceFilesChanged: migration.workspaceFilesChanged,
		filesWritten: applied.written,
		filesRemoved: applied.removed,
		declaredDifferences: migration.declaredDifferences,
		unhandled: migration.unhandled,
		notEstablished: [
			'Writing a changeset into a tree is not a build. Nothing here establishes that the applied tree installs, compiles or emits anything; the lane record beside this one states what happened when that was attempted.',
			'No application source was edited by hand in this lane. Every byte that differs from the corpus was written by a frozen adapter transform, and each is itemised in the changeset record by file and by change.',
		],
	});
}

export async function main(): Promise<void> {
	const migration = await composeMigration(SOURCE_TREE);
	const changeset = verifySealedRecord(buildChangesetRecord(migration));
	const applied = await applyMigration(migration, APPLIED_TREE);
	const record = verifySealedRecord(buildApplicationRecord(migration, applied));
	await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
	await writeFile(path.join(EVIDENCE_DIRECTORY, CHANGESET_FILE), canonical(changeset));
	await writeFile(path.join(EVIDENCE_DIRECTORY, MIGRATION_RECORD_FILE), canonical(record));
	process.stdout.write(
		`applied ${String(applied.written.length)} files (${String(
			migration.applicationFilesChanged,
		)}/${String(migration.applicationFilesScanned)} application, ${String(
			migration.workspaceFilesChanged,
		)} workspace), removed ${String(applied.removed.length)}, ` +
			`${String(migration.unhandled.length)} unhandled, ${String(
				migration.declaredDifferences.length,
			)} declared differences; changeset digest ${sha256(canonical(changeset)).slice(0, 12)}\n`,
	);
}

if (process.argv[1]?.endsWith('angular-pigallery2-migration-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
