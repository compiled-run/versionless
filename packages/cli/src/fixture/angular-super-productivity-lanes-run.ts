/**
 * Record the two build lanes of the `angular-super-productivity-v2-13-15`
 * migration cell — the Angular 8 pre-Ivy ViewEngine cell, and the fourth
 * independent application driven over the Angular adapter spine.
 *
 * Lane one is the era baseline: the pinned tree on its own cell — Node 12.14.1
 * under Rosetta 2, yarn 1.21.1, the era closure restored frozen from the
 * committed 2019 `yarn.lock` — built twice with the repository's own
 * `ng build --aot --prod` and compared file for file. The ingest recorded a
 * green first build; what this lane measures is whether that build is *the same
 * build twice*, which is a different question and gets a different answer.
 *
 * Lane two is the migrated tree: the adapter's composed changeset for the
 * Angular 16.2 cell, computed over the same pinned tree. Nothing in this driver
 * decides what to change. Every such decision lives in `@versionless/angular`,
 * which knows nothing about this application.
 *
 * This driver is fixture-scoped: it knows where this fixture's lanes were
 * materialised, and nothing else.
 */

import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import {
	migrateAngularCliEraWorkspace,
	ANGULAR_16_BROWSER_CELL,
	type AngularMigration,
	type WorkspaceFile,
} from '../../../frameworks/angular/src/index.ts';
import { canonical, sha256 } from './angular-factoriolab-migration-run.ts';
import {
	inventoryOf,
	isByteStable,
	sealRecord,
	verifySealedRecord,
	type DistEntry,
	type SealedRecord,
} from './angular-factoriolab-build-lanes-run.ts';

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');

export const EVIDENCE_DIRECTORY = path.join(
	repositoryRoot,
	'evidence/runs/angular-super-productivity-v2-13-15',
);

export const UNIT = 'lrapr-t006/u18-super-productivity-migration-lanes';
export const CONSENT = 'VL-LEGACY-CORPUS-2026-08-10';

export const SOURCE_TREE = path.join(
	repositoryRoot,
	'.versionless/cache/angular-super-productivity-v2-13-15-source/verify/extracted',
	'super-productivity-2943c5c4f13c3ce4dece0abf4f9c39739dde4192',
);
export const BASELINE_DIRECTORY = path.join(
	repositoryRoot,
	'.versionless/cache/angular-super-productivity-v2-13-15-baseline',
);

export const ERA_LANE_FILE = 'u18-era-baseline.json';
export const CHANGESET_FILE = 'u18-composed-changeset.json';

/**
 * What the ingest's single green build did and did not settle, restated here so
 * a reader does not have to go and find it.
 */
export const ERA_VARIANT =
	"The repository's own `buildFrontend` command — `node --max_old_space_size=4096 ./node_modules/@angular/cli/bin/ng build --aot --prod` — with its `yarn preCheck` (lint plus unit tests) prefix omitted, so that this measures a build and not a test run. The Electron sidecar that the manifest names as its `main` entry point is out of build scope and was never invoked on either lane. The production configuration this command selects turns on `serviceWorker`, so ngsw-worker.js, safety-worker.js and a generated ngsw.json are part of the emitted inventory, and `webWorkerTsConfig` compiles the two application web workers (lz, reminder) as separate chunks.";

export const ERA_NOT_ESTABLISHED: readonly string[] = Object.freeze([
	'Two consecutive builds on one host measure repeatability, not reproducibility. Nothing here establishes what another host, another day or another clock would emit — and on this fixture the same host on the same day already disagreed with itself.',
	'No browser opened these bundles. Nothing about their behaviour, boot or runtime correctness is observed.',
	'The ingest recorded this application as installing frozen and building green on the first attempt with zero deviations. That remains true and is not contradicted here: a green build and a byte-stable build are different claims, and only the first one was ever made.',
	'The Electron sidecar was not built, not run and not analysed. Its dependencies are declared in the same manifest and are carried into no claim here.',
]);

export const RECORDED_RISKS: readonly string[] = Object.freeze([
	'The emitted service worker prefetches https://fonts.googleapis.com/** and https://fonts.gstatic.com/** at runtime, as ngsw-config.json declares. No lane here made that request, so nothing is established about what happens when it fails or is blocked.',
	'node-sass ^4.12.0 declares a postinstall that fetches or compiles a native binding. Both the ingest install and this lane ran with lifecycle scripts disabled; every .scss input still compiled and styles.css still emitted, so nothing in the build path required that binding. That is a reading of this build, not a general claim about node-sass.',
	'The manifest declares one git-protocol dependency, jira2md, with no version and no registry integrity hash. The era lane consumed it exactly as the committed lockfile resolved it; the migrated cell records a disposition for it rather than carrying an unpinned git specifier forward.',
]);

export type LaneInput = Readonly<{
	first: readonly DistEntry[];
	second: readonly DistEntry[];
	firstSeconds: number;
	nodeVersion: string;
	/**
	 * Paths whose digests differ between the two rebuilds, and what was found
	 * when each was chased. An empty list on a byte-stable lane is the only
	 * honest empty list here.
	 */
	instability: readonly InstabilityFinding[];
}>;

/** One file that two consecutive builds of the same tree did not agree on. */
export type InstabilityFinding = Readonly<{
	path: string;
	observed: string;
	cause: string;
	consequential: boolean;
}>;

/** Paths present in both inventories whose digests differ. */
export function differingPaths(
	first: readonly DistEntry[],
	second: readonly DistEntry[],
): readonly string[] {
	const right = new Map(second.map((entry) => [entry.path, entry.sha256]));
	const differing: string[] = [];
	for (const entry of first) {
		const other = right.get(entry.path);
		if (other === undefined || other !== entry.sha256) differing.push(entry.path);
	}
	for (const entry of second)
		if (!first.some((left) => left.path === entry.path)) differing.push(entry.path);
	return Object.freeze([...new Set(differing)].sort());
}

/** The era baseline lane record, built from two consecutive rebuild inventories. */
export function buildEraLaneRecord(input: LaneInput): SealedRecord {
	const stable = isByteStable(input.first, input.second);
	const differing = differingPaths(input.first, input.second);
	return sealRecord({
		schemaVersion: 'versionless.angular-super-productivity-era-baseline.v1',
		unit: UNIT,
		consentId: CONSENT,
		result: input.first.length > 0 && stable ? 'byte-stable' : 'rebuilt-green-not-byte-stable',
		cell: {
			node: input.nodeVersion,
			architecture: 'darwin-x64 executed on darwin-arm64 through Rosetta 2',
			packageManager: 'yarn 1.21.1',
			command:
				'node --max_old_space_size=4096 ./node_modules/@angular/cli/bin/ng build --aot --prod',
			builder: '@angular-devkit/build-angular:browser 0.803.4 over webpack 4',
			compiler:
				'pre-Ivy ViewEngine, AOT — enableIvy appears in none of the 967 blobs and Angular 8.2 defaults to ViewEngine',
			honestLabel:
				"repository-declared as to major. .travis.yml pins `node_js: '12'`, which is what this cell runs; the patch level 12.14.1 and yarn 1.21.1 are the ingest's era-consistent choices, because the repository declares neither. The yarn 1.22.11-and-later defect recorded by the ingest — newer yarn walks up the directory tree, finds the host monorepo's packageManager field and demands Corepack — is avoided by the same fix the ingest recorded, not re-discovered.",
		},
		source: {
			repository: 'super-productivity/super-productivity',
			commit: '2943c5c4f13c3ce4dece0abf4f9c39739dde4192',
			cache: '.versionless/cache/angular-super-productivity-v2-13-15-baseline',
			provenance:
				'Restored in this checkout from the u16 ingest: the era dependency closure installed by `yarn install --frozen-lockfile --ignore-scripts --non-interactive` against the committed 466,548-byte yarn.lock, 1061 top-level entries, lockfile unmutated.',
			variant: ERA_VARIANT,
			deviation:
				'none. Nothing was pinned, patched or worked around in either rebuild, and no source file was modified.',
		},
		builds: [
			{ run: 2, status: 0, files: input.first.length, seconds: input.firstSeconds },
			{
				run: 3,
				status: 0,
				files: input.second.length,
				seconds: null,
				secondsNote:
					'Rebuilds 1 and 2 were timed by the harness that ran them (95 s and 90 s). Rebuild 3 was added afterwards to isolate the divergence and its wall clock was not captured; a duration is left null rather than estimated.',
			},
		],
		rebuildComparison: REBUILD_COMPARISON,
		byteStable: stable,
		byteStableMeaning: stable
			? 'The two rebuilds emit the same inventory, file for file and digest for digest, from the restored era closure.'
			: "The two rebuilds do not emit the same inventory. Both exited zero and emitted the same file count, and the paths below carry different bytes between them. This is a property of the fixture and its era toolchain that the ingest's single build could not have detected; it is recorded, not repaired, and no deviation was introduced to make it go away.",
		differingPaths: differing,
		instability: input.instability,
		inventory: input.first,
		recordedRisks: RECORDED_RISKS,
		notEstablished: ERA_NOT_ESTABLISHED,
	});
}

/** Every `.ts` module below a directory, as workspace files. */
async function typescriptModulesBelow(directory: string, root: string): Promise<WorkspaceFile[]> {
	const files: WorkspaceFile[] = [];
	for (const entry of (await readdir(directory, { withFileTypes: true })).sort((left, right) =>
		left.name < right.name ? -1 : 1,
	)) {
		const item = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await typescriptModulesBelow(item, root)));
			continue;
		}
		if (!entry.isFile() || path.extname(entry.name) !== '.ts') continue;
		files.push({ path: path.relative(root, item), source: await readFile(item, 'utf8') });
	}
	return files;
}

/** Every stylesheet below a directory, as workspace files. */
async function styleSheetsBelow(directory: string, root: string): Promise<WorkspaceFile[]> {
	const files: WorkspaceFile[] = [];
	for (const entry of (await readdir(directory, { withFileTypes: true })).sort((left, right) =>
		left.name < right.name ? -1 : 1,
	)) {
		const item = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await styleSheetsBelow(item, root)));
			continue;
		}
		if (!entry.isFile() || path.extname(entry.name) !== '.scss') continue;
		files.push({ path: path.relative(root, item), source: await readFile(item, 'utf8') });
	}
	return files;
}

/** Every component template below a directory, as workspace files. */
async function templatesBelow(directory: string, root: string): Promise<WorkspaceFile[]> {
	const files: WorkspaceFile[] = [];
	for (const entry of (await readdir(directory, { withFileTypes: true })).sort((left, right) =>
		left.name < right.name ? -1 : 1,
	)) {
		const item = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await templatesBelow(item, root)));
			continue;
		}
		if (!entry.isFile() || path.extname(entry.name) !== '.html') continue;
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

/**
 * Compute the composed changeset for the pinned tree.
 *
 * The workspace configuration handed in is a modern `angular.json`, so no
 * format lift is needed and the synthesis capability stands down on its own —
 * it reads the document's shape, and nothing here tells it which format to
 * expect.
 */
export async function composeMigration(tree: string): Promise<AngularMigration> {
	const source = path.join(tree, 'src');
	const sourceModules = (await typescriptModulesBelow(source, tree)).filter(
		(module) => !module.path.endsWith('.spec.ts'),
	);
	return migrateAngularCliEraWorkspace(
		{
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
			templates: await templatesBelow(source, tree),
			styleSheets: await styleSheetsBelow(source, tree),
			workspaceFiles: await workspacePathsBelow(tree, tree),
		},
		ANGULAR_16_BROWSER_CELL,
	);
}

/**
 * Era facts of this fixture that the workspace migration has to carry across
 * the hop or declare it dropped. They are recorded by name because a changeset
 * that silently loses one of them would still look clean.
 */
export const ERA_WORKSPACE_FACTS: readonly string[] = Object.freeze([
	'ngsw-config.json plus the production `serviceWorker: true` option: the era build emits ngsw-worker.js, safety-worker.js and a generated ngsw.json, and the config file declares an external asset group that prefetches Google Fonts at runtime.',
	"tsconfig.worker.json wired through the browser builder's `webWorkerTsConfig` option: two application web workers (lz, reminder) compile and emit as their own chunks in the era build.",
	'`extractCss: true` on the production configuration — a valid key for the Angular 8 browser builder, and one the Angular 13 line removed.',
	'A second workspace project, sp2-e2e, whose only targets are the protractor e2e runner and a TSLint lint target.',
	'`cli.defaultCollection: "@ngrx/schematics"`, which names a schematics collection rather than a build input.',
	"A `jo` devDependency declared as `file:./tools/schematics` — a workspace-local schematics package built by the repository's own `buildSchema` script.",
]);

/**
 * The changeset record. Every file is recorded by path and by digest before and
 * after; the sources themselves are not copied into evidence, because the tree
 * they came from is identified by commit sha and archive digest already.
 */
export function buildChangesetRecord(migration: AngularMigration): SealedRecord {
	return sealRecord({
		schemaVersion: 'versionless.angular-super-productivity-composed-changeset.v1',
		unit: UNIT,
		consentId: CONSENT,
		cell: migration.cell,
		appliedTo:
			'The pinned revision as materialised at .versionless/cache/angular-super-productivity-v2-13-15-source/verify/extracted, whose blob-level reconciliation against the git tree — 967 blobs, zero mismatches — is recorded in the u16 ingest.',
		spinePosition:
			'The fourth independent application driven over the Angular adapter spine, and the first from the Angular 8 pre-Ivy ViewEngine era. No capability was written for this application; the changeset is what the existing inventory produced when it was pointed at a tree it had never seen.',
		eraWorkspaceFacts: ERA_WORKSPACE_FACTS,
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
			'A composed changeset is a set of edits, not a build. Nothing here establishes that the migrated tree installs, compiles or emits anything; no install was performed and no build was attempted by this unit.',
			'`applicationFilesChanged` counts application source the transforms rewrote. A file the adapter scanned and left alone is counted as scanned and not as changed.',
			'A cell disposition is a reading of a registry, not an installation. A range written here has not been resolved against a lockfile by this unit.',
		],
	});
}

export async function main(): Promise<void> {
	const nodeVersion = (
		await readFile(path.join(BASELINE_DIRECTORY, 'rebuild-node.txt'), 'utf8')
	).trim();
	const first = await inventoryOf(path.join(BASELINE_DIRECTORY, 'dist-run2'));
	const second = await inventoryOf(path.join(BASELINE_DIRECTORY, 'dist-run3'));
	const seconds = async (file: string): Promise<number> =>
		Number.parseInt((await readFile(path.join(BASELINE_DIRECTORY, file), 'utf8')).trim(), 10);
	const era = verifySealedRecord(
		buildEraLaneRecord({
			first,
			second,
			firstSeconds: await seconds('rebuild-2.seconds'),
			nodeVersion,
			instability: INSTABILITY,
		}),
	);
	const migration = await composeMigration(SOURCE_TREE);
	const changeset = verifySealedRecord(buildChangesetRecord(migration));
	await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
	await writeFile(path.join(EVIDENCE_DIRECTORY, ERA_LANE_FILE), canonical(era));
	await writeFile(path.join(EVIDENCE_DIRECTORY, CHANGESET_FILE), canonical(changeset));
	process.stdout.write(
		`era lane ${String(era['result'])} over ${String(first.length)} files; changeset: ` +
			`${String(migration.applicationFilesChanged)}/${String(
				migration.applicationFilesScanned,
			)} application files changed, ${String(migration.workspaceFilesChanged)} workspace, ` +
			`${String(migration.unhandled.length)} unhandled, ${String(
				migration.declaredDifferences.length,
			)} declared differences, changeset digest ${sha256(canonical(changeset)).slice(0, 12)}\n`,
	);
}

/**
 * What was found when each differing path was chased, as measured by a third
 * consecutive build of the same tree.
 */
export const INSTABILITY: readonly InstabilityFinding[] = Object.freeze([
	Object.freeze({
		path: './ngsw.json',
		observed: 'The generated service-worker manifest differs between every pair of builds.',
		cause: 'ngsw.json carries a `timestamp` field that the service-worker builder fills with the wall clock at generation time, and a `hashTable` keyed by the emitted filenames — so it moves both on its own and whenever a hashed filename moves.',
		consequential: false,
	}),
	Object.freeze({
		path: './index.html',
		observed:
			'The emitted entry document differs between builds that emit differing main chunks.',
		cause: 'index.html carries the content-hashed filename of the main chunk in its script tag. It is downstream of the main chunk and moves only because that moved.',
		consequential: false,
	}),
	Object.freeze({
		path: 'main.<contenthash>.js and its .map',
		observed:
			'The application chunk carries a different content hash and different bytes on every build, so no two builds even agree on the filename. Three consecutive rebuilds produced three distinct main chunks of three different byte lengths.',
		cause: "Chased to a single line rather than inferred. The first differing byte between two consecutive main chunks falls inside an inlined component stylesheet, in a `@keyframes bang` rule whose box-shadow list is generated by Sass `random()` — src/app/pages/daily-summary/daily-summary.component.scss line 184, `random($width)-$width / 2 + px random($height)-$height / 1.2 + px hsl(random(360), 100, 50)`. Sass `random()` is unseeded, so node-sass emits different literals on every compile, the component stylesheet is inlined into the application chunk, and the chunk's content hash moves with it. The workspace-level styles.css is byte-identical across all three builds, which is consistent: the confetti rule lives in a component stylesheet, not the global one.",
		consequential: true,
	}),
]);

/**
 * What the three consecutive rebuilds establish together, stated once so the
 * lane record does not have to be read as three separate comparisons.
 */
export const REBUILD_COMPARISON =
	'Three consecutive rebuilds of the unmodified pinned tree were run on the same host in the same session. All three exited zero and all three emitted the same 64-file inventory. No two of them agree: rebuild 1 emitted main.6871f8597c3fbcf77df6.js, rebuild 2 main.2b292dc79b76876e9ea9.js and rebuild 3 main.932307a6bf1518696bcc.js, each with its own map, its own index.html script tag and its own ngsw.json hash table. The comparison pair recorded in `inventory` and `differingPaths` is rebuilds 2 and 3, whose full dist trees are both retained; rebuild 1 is cited from its retained digest manifest. Adding a third build was not a repair attempt — it was how the cause was isolated, by giving the divergence a second independent sample instead of one.';

if (process.argv[1]?.endsWith('angular-super-productivity-lanes-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
