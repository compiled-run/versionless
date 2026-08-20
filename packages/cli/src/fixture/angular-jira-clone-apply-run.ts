/**
 * Apply the composed `@versionless/angular` changeset to the pinned
 * `angular-jira-clone` tree, and record what it changed.
 *
 * mj2 recorded a resolved closure and a red build with five itemised demands.
 * Three capabilities were then written to answer them — an exports-map style
 * resolver, a cross-module modal-data migration, and a peer-hole reader — and
 * two more already existed for the Sentry v8 relocation and the TSLint drop.
 * This driver is the first application of all of them at once, on the same
 * pinned revision, with the changed bytes written into the tree the closure was
 * installed into so a build can be attempted on them.
 *
 * Three of those capabilities read the *installed closure* rather than the
 * application, and that is the interesting part of this driver: a peer hole is a
 * fact about what a published package's own bundles import, and an exports map
 * is a fact about what a published package will let a stylesheet reach. Both are
 * read here from the closure staged beside the tree, by mechanical rules stated
 * at each reading site, and neither rule names this application or any package
 * in it.
 *
 * The driver is fixture-scoped — it knows where this fixture's tree and closure
 * were materialised. Every decision about *what to change* lives in
 * `@versionless/angular`, which knows nothing about this application.
 */

import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import {
	ANGULAR_16_BROWSER_CELL,
	migrateAngularCliEraWorkspace,
	readInstalledPackage,
	type AngularMigration,
	type AngularMigrationInput,
	type InstalledFile,
	type InstalledPackage,
	type PackageExportsReading,
	type WorkspaceFile,
} from '../../../frameworks/angular/src/index.ts';
import { canonical, sha256 } from './angular-factoriolab-migration-run.ts';
import {
	CANDIDATE_WEBPACK_FRAGMENTS,
	CONSENT_ID,
	JIRA_CLONE_ARCHIVE_BYTES,
	JIRA_CLONE_ARCHIVE_SHA256,
	JIRA_CLONE_ARCHIVE_URL,
	JIRA_CLONE_COMMIT,
	MIGRATION_RECORD_FILE as MJ2_MIGRATION_RECORD_FILE,
} from './angular-jira-clone-migration-run.ts';

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');
const evidenceDirectory = path.join(repositoryRoot, 'evidence/runs/angular-jira-clone');

export const STAGE_DIRECTORY = path.join(
	repositoryRoot,
	'.versionless/stage/angular-jira-clone-mj2',
);
/** The pinned revision as materialised, untouched by any migration. */
export const PINNED_TREE = path.join(STAGE_DIRECTORY, 'tree');
/** The same revision with the mj2 closure installed into it; the build tree. */
export const APPLIED_TREE = path.join(STAGE_DIRECTORY, 'app');

export const UNIT = 'lrapr-t005/mj3c-apply-builds-parity';
export const MIGRATION_RECORD_FILE = 'mj3c-source-migration.json';

/**
 * What this record replaces.
 *
 * mj2's changeset is still true about what it did: it aligned a manifest and a
 * workspace onto the cell, and it changed no application file because no source
 * capability had yet been written for what this application asked for. It is
 * superseded because the same adapter now carries five more transforms and the
 * changeset it composes over the same pinned tree is a different, larger one.
 */
export const SUPERSEDES = Object.freeze({
	record: MJ2_MIGRATION_RECORD_FILE,
	unit: 'lrapr-t005/mj2-ecosystem-cell-closure',
	why: 'mj2 applied the cell before the adapter had a source transform for anything this application asked for, and recorded applicationFilesChanged 0 out of 116 truthfully. This record applies the same cell with five further capabilities composed into it — Sentry v8 tracing relocation, exports-map stylesheet resolution, cross-module modal-data migration, undeclared-runtime-dependency declaration and TSLint toolchain removal — over the same pinned revision. Every mj2 change is still in this changeset; the difference is additive.',
});

/**
 * The Angular Package Format directories a published package ships its
 * bundler-facing ES modules in, newest first.
 *
 * The reader parses what it is handed as a module and throws on bytes that are
 * not one. That is the right behaviour — a bundle it cannot read is a reading it
 * must not report as "no imports found" — and it makes *which files are handed
 * to it* a decision this driver has to make and state. It hands the flat ES
 * module bundles a package publishes for a bundler and nothing else: not UMD,
 * not CommonJS, not the per-entry-point mirrors, because those are the same
 * edges written twice in formats the reader does not parse.
 */
export const BUNDLE_DIRECTORIES: readonly string[] = Object.freeze([
	'fesm2022',
	'fesm2020',
	'fesm2015',
]);

export const BUNDLE_EXTENSION = '.mjs';

/** Directories no walk of an application tree descends into. */
const UNWALKED: readonly string[] = Object.freeze(['node_modules', 'dist', '.git', '.angular']);

async function walkFiles(
	directory: string,
	root: string,
	keep: (name: string) => boolean,
): Promise<WorkspaceFile[]> {
	const files: WorkspaceFile[] = [];
	for (const entry of (await readdir(directory, { withFileTypes: true })).sort((left, right) =>
		left.name < right.name ? -1 : 1,
	)) {
		if (UNWALKED.includes(entry.name)) continue;
		const item = path.join(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await walkFiles(item, root, keep)));
		else if (entry.isFile() && keep(entry.name))
			files.push({
				path: path.relative(root, item).split(path.sep).join('/'),
				source: await readFile(item, 'utf8'),
			});
	}
	return files;
}

async function walkPaths(directory: string, root: string): Promise<string[]> {
	return (await walkFiles(directory, root, () => true)).map((entry) => entry.path);
}

async function readIfPresent(file: string, relative: string): Promise<WorkspaceFile | null> {
	try {
		return { path: relative, source: await readFile(file, 'utf8') };
	} catch {
		return null;
	}
}

/** The byte size of every `.css` file a package publishes, package-relative. */
async function stylesheetSizes(directory: string): Promise<Record<string, number>> {
	const sizes: Record<string, number> = {};
	const walk = async (current: string): Promise<void> => {
		for (const entry of (await readdir(current, { withFileTypes: true })).sort((left, right) =>
			left.name < right.name ? -1 : 1,
		)) {
			if (entry.name === 'node_modules') continue;
			const item = path.join(current, entry.name);
			if (entry.isDirectory()) await walk(item);
			else if (entry.isFile() && entry.name.endsWith('.css'))
				sizes[path.relative(directory, item).split(path.sep).join('/')] = (
					await stat(item)
				).size;
		}
	};
	await walk(directory);
	return sizes;
}

export type ClosureReading = Readonly<{
	installedPackages: readonly InstalledPackage[];
	packageExports: readonly PackageExportsReading[];
	/** Names the closure root declares but that are not installed under it. */
	absentFromClosure: readonly string[];
	/** Per package, the bundle directory read and how many bundles it carried. */
	bundlesRead: readonly Readonly<{ name: string; directory: string | null; bundles: number }>[];
}>;

/**
 * Read the installed closure into the two kinds of published fact the adapter's
 * closure-reading capabilities consume.
 *
 * The set of packages read is mechanical and stated rather than listed: the
 * runtime dependencies the installed tree's own manifest declares. A build
 * resolves those and only those as its own direct edges, so they are the
 * packages whose published surface the application is exposed to. Development
 * dependencies are not read — a peer hole in a test runner is not a hole this
 * application's production build can fall into — and neither are transitive
 * packages, which are edges of each other rather than of this application.
 */
export async function readClosure(
	closureRoot: string,
	manifestSource: string,
): Promise<ClosureReading> {
	const parsed: unknown = JSON.parse(manifestSource);
	if (typeof parsed !== 'object' || parsed === null)
		throw new Error(
			'Angular jira-clone closure reading: the closure manifest is not an object',
		);
	const dependencies = (parsed as Record<string, unknown>)['dependencies'];
	const names =
		typeof dependencies === 'object' && dependencies !== null
			? Object.keys(dependencies as Record<string, unknown>).sort()
			: [];
	const installedPackages: InstalledPackage[] = [];
	const packageExports: PackageExportsReading[] = [];
	const absentFromClosure: string[] = [];
	const bundlesRead: { name: string; directory: string | null; bundles: number }[] = [];
	for (const name of names) {
		const directory = path.join(closureRoot, 'node_modules', name);
		const packageManifest = await readIfPresent(
			path.join(directory, 'package.json'),
			'package.json',
		);
		if (packageManifest === null) {
			absentFromClosure.push(name);
			continue;
		}
		let bundleDirectory: string | null = null;
		let bundles: InstalledFile[] = [];
		for (const candidate of BUNDLE_DIRECTORIES) {
			let entries: string[];
			try {
				entries = await readdir(path.join(directory, candidate));
			} catch {
				continue;
			}
			const modules = entries.filter((entry) => entry.endsWith(BUNDLE_EXTENSION)).sort();
			if (modules.length === 0) continue;
			bundleDirectory = candidate;
			bundles = await Promise.all(
				modules.map(async (entry) => ({
					path: `${candidate}/${entry}`,
					source: await readFile(path.join(directory, candidate, entry), 'utf8'),
				})),
			);
			break;
		}
		installedPackages.push(readInstalledPackage(packageManifest.source, bundles));
		bundlesRead.push({ name, directory: bundleDirectory, bundles: bundles.length });
		const published: unknown = JSON.parse(packageManifest.source);
		const surface = (published as Record<string, unknown>)['exports'];
		if (surface === undefined) continue;
		packageExports.push({
			name,
			version: String((published as Record<string, unknown>)['version'] ?? ''),
			exports: surface,
			fileSizes: await stylesheetSizes(directory),
		});
	}
	return Object.freeze({
		installedPackages: Object.freeze(installedPackages),
		packageExports: Object.freeze(packageExports),
		absentFromClosure: Object.freeze(absentFromClosure),
		bundlesRead: Object.freeze(bundlesRead.map((entry) => Object.freeze(entry))),
	});
}

/** The path aliases the workspace's own TypeScript configuration declares. */
export function moduleResolutionOf(tsConfigSource: string): Readonly<{
	baseUrl: string;
	paths: Readonly<Record<string, readonly string[]>>;
}> {
	const parsed: unknown = JSON.parse(
		tsConfigSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'),
	);
	const options =
		typeof parsed === 'object' && parsed !== null
			? (parsed as Record<string, unknown>)['compilerOptions']
			: undefined;
	const record =
		typeof options === 'object' && options !== null ? (options as Record<string, unknown>) : {};
	const baseUrl = record['baseUrl'];
	const aliases = record['paths'];
	const paths: Record<string, readonly string[]> = {};
	if (typeof aliases === 'object' && aliases !== null)
		for (const [pattern, targets] of Object.entries(aliases as Record<string, unknown>))
			if (Array.isArray(targets))
				paths[pattern] = Object.freeze(
					(targets as readonly unknown[]).filter(
						(target): target is string => typeof target === 'string',
					),
				);
	return Object.freeze({
		baseUrl: typeof baseUrl === 'string' ? baseUrl : '',
		paths: Object.freeze(paths),
	});
}

/** Read every input the composed migration consumes out of a materialised tree. */
export async function readMigrationInput(
	tree: string,
	closure: ClosureReading,
): Promise<AngularMigrationInput> {
	const read = async (relative: string): Promise<WorkspaceFile> => ({
		path: relative,
		source: await readFile(path.join(tree, relative), 'utf8'),
	});
	const fragments: WorkspaceFile[] = [];
	for (const candidate of CANDIDATE_WEBPACK_FRAGMENTS) {
		const found = await readIfPresent(path.join(tree, candidate), candidate);
		if (found !== null) fragments.push(found);
	}
	const tsConfig = await read('tsconfig.json');
	const source = path.join(tree, 'src');
	return {
		packageManifest: await read('package.json'),
		workspaceConfig: await read('angular.json'),
		tsConfig,
		sourceModules: await walkFiles(source, tree, (name) => name.endsWith('.ts')),
		webpackFragments: fragments,
		workspaceFiles: await walkPaths(tree, tree),
		styleSheets: await walkFiles(
			source,
			tree,
			(name) => name.endsWith('.scss') || name.endsWith('.css'),
		),
		packageExports: closure.packageExports,
		installedPackages: closure.installedPackages,
		moduleResolution: moduleResolutionOf(tsConfig.source),
	};
}

/**
 * Residue the changeset carries that a reader would otherwise find in the diff
 * and wonder about.
 *
 * Naming it is cheaper than the alternative: a hand-patch on top of a mechanical
 * changeset is a change no capability made and no record explains, and it is
 * exactly how a "generic" adapter quietly becomes an application-specific one.
 */
export const KNOWN_RESIDUE: readonly string[] = Object.freeze([
	"The modal-data migration replaces `@Input()` fields on a content component with injected `NZ_MODAL_DATA` fields but does not touch the module's import list, so `src/app/project/components/issues/issue-modal/issue-modal.component.ts` keeps importing `Input` from @angular/core with nothing left in the module that uses it. TypeScript does not error on an unused import specifier under this workspace's configuration and the emitted bundles do not carry it, so both lanes build. It is visible in the diff and is recorded here rather than hand-patched: removing it would be a change no capability made, and a hand-patch on top of a mechanical changeset is how a generic adapter quietly becomes an application-specific one. The other two content components did not declare their fields with `@Input()`, so neither of them carries the residue.",
]);

const CELL_REUSE: readonly string[] = Object.freeze([
	'The target cell angular-16-browser-builder is the same cell factoriolab was migrated onto. It was not re-derived for this application and nothing here re-establishes its rationale.',
	"The ecosystem table this application needed was added to the cell rather than to this fixture, because a community library's Angular-major line is a fact about the Angular ecosystem. It is keyed by package name and applies to any manifest; nothing in it names this application.",
	"Both lanes of this cell run on Node 16.20.2, which is what this application's own .nvmrc pins as a major and what the era baseline already used. The migrated lane therefore changes the framework without also changing the runtime.",
]);

const NOT_ESTABLISHED: readonly string[] = Object.freeze([
	'This record states what the adapter changed. Whether the changed tree installs, builds or behaves is recorded separately, in the build-lane and parity records beside it, and none of it is implied here.',
	'The closure this changeset was composed against is the one the mj2 manifest resolved to. A peer hole and an exports map are facts about the packages in *that* closure; a later resolution of the same ranges could publish different ones.',
	'No test-cell outcome is established: the karma/jasmine toolchain was aligned so the dependency closure could resolve, and no test run was attempted.',
	'No browser behaviour, runtime parity or user-visible equivalence was observed. No witness ran.',
	'Nothing here is a production-readiness, pilot, certification or general Angular support claim.',
]);

const NONCLAIMS: readonly string[] = Object.freeze([
	'This record states which bytes a set of reusable transforms changed in one pinned tree. It establishes no migration feasibility, no production readiness, no certification and no support claim for Angular applications generally.',
	'A second application on one adapter is a second application, not a general result. Nothing here says the adapter carries a third.',
]);

export type MigrationRecord = Readonly<Record<string, unknown>> & Readonly<{ digest: string }>;

export function buildAppliedMigrationRecord(input: {
	migration: AngularMigration;
	closure: ClosureReading;
	unit: string;
	consentId: string;
	appliedTo: string;
}): MigrationRecord {
	const { migration, closure } = input;
	const body = {
		schemaVersion: 'versionless.angular-jira-clone-source-migration.v3',
		unit: input.unit,
		consentId: input.consentId,
		result: 'changeset-applied',
		supersedes: SUPERSEDES,
		adapterApplication:
			'second — the same @versionless/angular adapter, a different application, now with every capability composed at once',
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
		closureReading: {
			meaning:
				'Two of the capabilities in this changeset read published packages rather than application source. This is what they were handed, and by which rule.',
			selectionRule:
				"The runtime dependencies the installed tree's own manifest declares — the direct edges a production build resolves — read from the closure staged beside the pinned tree. Development dependencies and transitive packages are not read.",
			bundleRule: `Per package, the newest of ${BUNDLE_DIRECTORIES.join(', ')} that carries at least one ${BUNDLE_EXTENSION} bundle, and every such bundle in it. The reader parses what it is handed and throws on bytes that are not a module, so the format it can read is chosen deliberately rather than discovered by failure.`,
			packagesRead: closure.installedPackages.length,
			packagesWithBundles: closure.bundlesRead.filter((entry) => entry.directory !== null)
				.length,
			bundlesParsed: closure.bundlesRead.reduce((total, entry) => total + entry.bundles, 0),
			packagesWithExportsMap: closure.packageExports.length,
			absentFromClosure: closure.absentFromClosure,
			bundlesRead: closure.bundlesRead,
		},
		appliedTo: input.appliedTo,
		migration: {
			applicationFilesScanned: migration.applicationFilesScanned,
			applicationFilesScannedNote:
				'The denominator moved between mj2 and this record, and it moved for a reason rather than by accident: mj2 scanned 116 TypeScript modules, because a module was the only kind of application file any capability read. A stylesheet whose package subpath no longer resolves is an application file that no longer builds, so the adapter now takes stylesheets too, and this tree carries 44 of them. Nothing was rescoped and no file stopped being counted; 44 more started being counted.',
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
			declaredDifferences: migration.declaredDifferences,
			removedFiles: migration.removedFiles,
		},
		knownResidue: KNOWN_RESIDUE,
		unhandled: migration.unhandled,
		notEstablished: NOT_ESTABLISHED,
		nonclaims: NONCLAIMS,
	} as const;
	return Object.freeze({ ...body, digest: sha256(canonical(body)) });
}

/** Recompute the record's digest; a record that does not seal is rejected. */
export function verifyAppliedMigrationRecord(record: MigrationRecord): MigrationRecord {
	const { digest, ...body } = record;
	const recomputed = sha256(canonical(body));
	if (recomputed !== digest)
		throw new Error(
			`Angular jira-clone applied migration record digest differs: recorded ${digest}, recomputed ${recomputed}`,
		);
	return record;
}

/** Write the changeset into a tree: every changed file, and every removed one. */
export async function applyMigration(migration: AngularMigration, tree: string): Promise<void> {
	for (const entry of migration.files) {
		if (!entry.changed) continue;
		const destination = path.join(tree, entry.path);
		await mkdir(path.dirname(destination), { recursive: true });
		await writeFile(destination, entry.source);
	}
	for (const removed of migration.removedFiles)
		await rm(path.join(tree, removed), { force: true });
}

export async function main(): Promise<void> {
	const apply = !process.argv.includes('--report-only');
	const closure = await readClosure(
		APPLIED_TREE,
		await readFile(path.join(APPLIED_TREE, 'package.json'), 'utf8'),
	);
	const migration = migrateAngularCliEraWorkspace(
		await readMigrationInput(PINNED_TREE, closure),
		ANGULAR_16_BROWSER_CELL,
	);
	if (apply) await applyMigration(migration, APPLIED_TREE);
	const record = verifyAppliedMigrationRecord(
		buildAppliedMigrationRecord({
			migration,
			closure,
			unit: UNIT,
			consentId: CONSENT_ID,
			appliedTo:
				'The pinned revision as materialised at .versionless/stage/angular-jira-clone-mj2/tree, with the changeset written into the sibling tree the migrated closure was installed into.',
		}),
	);
	await mkdir(evidenceDirectory, { recursive: true });
	await writeFile(path.join(evidenceDirectory, MIGRATION_RECORD_FILE), canonical(record));
	process.stdout.write(
		`applied: ${String(apply)}; application files ${String(
			migration.applicationFilesChanged,
		)}/${String(migration.applicationFilesScanned)} changed; workspace ${String(
			migration.workspaceFilesChanged,
		)}; declared differences ${String(migration.declaredDifferences.length)}; unhandled ${String(
			migration.unhandled.length,
		)}\n`,
	);
}

if (process.argv[1]?.endsWith('angular-jira-clone-apply-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
