/**
 * Record the two build lanes of the `angular-tiny-translator-v0-12-0`
 * migration cell — the Angular 4–6 band cell, and the adapter's first lift of
 * the pre-`angular.json` Angular CLI workspace format.
 *
 * Lane one is the era baseline: the pinned tree on its own cell — Node 8.9.3
 * under Rosetta 2, yarn 1.3.2, the era closure restored from the ingest cache —
 * built twice with the plain `ng build --prod --aot` variant to see whether the
 * restored cache still emits the same bytes. The ingest recorded *two*
 * materially different production artifacts for this application, and this lane
 * uses the plain one; which one it is and why is stated in the record.
 *
 * Lane two is the migrated tree: the adapter's composed changeset applied to the
 * same pinned tree. The changeset begins with something no earlier cell needed —
 * an `angular.json` synthesized from `.angular-cli.json`, because every other
 * capability in `@versionless/angular` expects the modern workspace format and
 * the era document has neither a `projects` map nor an `architect` target.
 *
 * This driver is fixture-scoped: it knows where this fixture's lanes were
 * materialised. Every decision about *what to change* lives in
 * `@versionless/angular`, which knows nothing about this application.
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
const evidenceDirectory = path.join(
	repositoryRoot,
	'evidence/runs/angular-tiny-translator-v0-12-0',
);

export const UNIT = 'lrapr-t006/u17-tiny-translator-migration-lanes';
export const CONSENT = 'VL-LEGACY-CORPUS-2026-08-10';

export const SOURCE_TREE = path.join(
	repositoryRoot,
	'.versionless/cache/angular-tiny-translator-v0-12-0-source/verify/extracted',
	'tiny-translator-08dcacf6a41d5a6f6dfbc71d858adcdc4c85691a',
);
export const BASELINE_DIRECTORY = path.join(
	repositoryRoot,
	'.versionless/cache/angular-tiny-translator-v0-12-0-baseline',
);
export const MIGRATED_STAGE = path.join(
	repositoryRoot,
	'.versionless/stage/angular-tiny-translator-v0-12-0-u17',
);

export const ERA_LANE_FILE = 'u17-era-baseline.json';
export const MIGRATED_LANE_FILE = 'u17-migrated-lane.json';
export const CHANGESET_FILE = 'u17-composed-changeset.json';

/**
 * Which of the two production artifacts the ingest recorded this lane builds,
 * restated here rather than left in the ingest for a reader to go and find.
 */
export const ERA_VARIANT =
	'The plain `ng build --prod --aot` variant. This application has two materially different production artifacts: the plain one, and the one the repository\'s own `build-prod-<lang>` chain produces by rewriting the literal %BASE_HREF% in src/environments/environment.prod.ts, compiling one locale from a committed XLIFF, and copying an ngsw-worker.js beside a generated ngsw.json. The plain variant registers a service worker at the un-substituted literal \'%BASE_HREF%ngsw-worker.js\' and ships no worker for it to find. This lane\'s parity story is the plain variant, because it is the one the migrated lane could ever be compared against: the locale chain is a repository script, not a build the adapter migrates.';

export const ERA_NOT_ESTABLISHED: readonly string[] = Object.freeze([
	'Byte stability across two consecutive builds on one host is repeatability, not reproducibility: nothing here establishes that another host, another day or another clock would emit the same bytes.',
	'No browser opened these bundles. Nothing about their behaviour is observed.',
	'The plain variant\'s service-worker registration points at an un-substituted literal and no worker ships beside it. That is recorded as found; it is not repaired and not masked.',
	'The bundle requests https://fonts.googleapis.com/icon?family=Material+Icons unconditionally on load. No lane here made that request, so nothing is established about what happens when it fails.',
]);

export const RECORDED_RISKS: readonly string[] = Object.freeze([
	'A TLS private key (key.pem) and its certificate (cert.pem) are committed at the root of the pinned tree. Nothing in the workspace, the manifest or the Dockerfile references either. The key material is public upstream and must be treated as compromised; its contents are deliberately not reproduced anywhere in this evidence tree, and neither file was copied into any fixture.',
	'The era build-prod chain mutates src/environments/environment.prod.ts in place and restores it afterwards. This lane does not run that chain, and the file was verified to carry the literal %BASE_HREF% before and after both rebuilds.',
	'The auto-translate journey contacts https://translation.googleapis.com/ with a user-supplied API key. No key ships in the tree, and no lane here supplied one.',
]);

export type LaneInput = Readonly<{
	first: readonly DistEntry[];
	second: readonly DistEntry[];
	firstSeconds: number;
	secondSeconds: number;
	nodeVersion: string;
}>;

/** The era baseline lane record, built from two consecutive rebuild inventories. */
export function buildEraLaneRecord(input: LaneInput): SealedRecord {
	const stable = isByteStable(input.first, input.second);
	return sealRecord({
		schemaVersion: 'versionless.angular-tiny-translator-era-baseline.v1',
		unit: UNIT,
		consentId: CONSENT,
		result: input.first.length > 0 && stable ? 'byte-stable' : 'unstable',
		cell: {
			node: input.nodeVersion,
			architecture: 'darwin-x64 executed on darwin-arm64 through Rosetta 2',
			packageManager: 'yarn 1.3.2',
			command: 'ng build --prod --aot --output-path=dist/rebuild-<n>',
			builder: 'Angular CLI 1.5.4 over webpack 3.8.1',
			honestLabel:
				'era-declared, not repository-pinned. The repository states no Node version anywhere; Node 8.9.3 was the active LTS two days before the pinned commit and satisfies the CLI\'s own >= 6.9.0 floor.',
		},
		source: {
			repository: 'martinroob/tiny-translator',
			commit: '08dcacf6a41d5a6f6dfbc71d858adcdc4c85691a',
			cache: '.versionless/cache/angular-tiny-translator-v0-12-0-baseline',
			provenance:
				'Restored in this checkout from the u15 ingest: the era dependency closure installed by `yarn install --frozen-lockfile` against the committed yarn.lock (lockfile v1, 963 entries, each carrying a resolved URL with a sha1 fragment and no SRI field).',
			variant: ERA_VARIANT,
			deviation: 'none. Nothing was pinned, patched or worked around in either rebuild.',
		},
		builds: [
			{ run: 1, status: 0, files: input.first.length, seconds: input.firstSeconds },
			{ run: 2, status: 0, files: input.second.length, seconds: input.secondSeconds },
		],
		byteStable: stable,
		byteStableMeaning:
			'The two rebuilds emit the same inventory, file for file and digest for digest, from the restored era closure.',
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
		files.push({
			path: path.relative(root, item),
			source: await readFile(item, 'utf8'),
		});
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
 * The workspace configuration handed in is `.angular-cli.json`. Nothing here
 * tells the adapter that: the composed migration reads the format off the
 * document's own shape and synthesizes an `angular.json` before any other
 * capability sees it.
 */
export async function composeMigration(tree: string): Promise<AngularMigration> {
	const sourceModules = (await typescriptModulesBelow(path.join(tree, 'src'), tree)).filter(
		(module) => !module.path.endsWith('.spec.ts'),
	);
	return migrateAngularCliEraWorkspace(
		{
			packageManifest: {
				path: 'package.json',
				source: await readFile(path.join(tree, 'package.json'), 'utf8'),
			},
			workspaceConfig: {
				path: '.angular-cli.json',
				source: await readFile(path.join(tree, '.angular-cli.json'), 'utf8'),
			},
			tsConfig: {
				path: 'tsconfig.json',
				source: await readFile(path.join(tree, 'tsconfig.json'), 'utf8'),
			},
			sourceModules,
			workspaceFiles: await workspacePathsBelow(tree, tree),
		},
		ANGULAR_16_BROWSER_CELL,
	);
}

/**
 * The changeset record. Every file is recorded by path and by digest before and
 * after; the sources themselves are not copied into evidence, because the tree
 * they came from is identified by commit sha and archive digest already.
 */
export function buildChangesetRecord(
	migration: AngularMigration,
): SealedRecord {
	return sealRecord({
		schemaVersion: 'versionless.angular-tiny-translator-composed-changeset.v1',
		unit: UNIT,
		consentId: CONSENT,
		cell: migration.cell,
		appliedTo:
			'The pinned revision as materialised at .versionless/cache/angular-tiny-translator-v0-12-0-source/verify/extracted, whose blob-level reconciliation against the git tree is recorded in the u15 ingest.',
		workspaceFormatLift: {
			from: '.angular-cli.json',
			to: 'angular.json',
			capability:
				'@versionless/angular synthesizeAngularWorkspace — the pre-angular.json Angular CLI 1.x workspace format translated into the modern schema: apps[] into a projects map, app-root-relative build inputs into workspace-relative browser-builder options, environmentSource plus the named environments map into fileReplacements configurations, and the sibling test, lint and e2e blocks into the builders that ran them.',
			genericity:
				'The capability reads the document shape, never a filename and never an application name. Fields of either schema level it does not know are reported by name and dropped rather than carried into a document the modern schema validates.',
		},
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
			'`applicationFilesChanged` counts application source the transforms rewrote. A file the adapter scanned and left alone is counted as scanned and not as changed.',
		],
	});
}

/** Write both lane records and the changeset into the evidence tree. */
export async function main(): Promise<void> {
	const nodeVersion = (
		await readFile(path.join(BASELINE_DIRECTORY, 'rebuild-node-version.txt'), 'utf8')
	).trim();
	const first = await inventoryOf(path.join(BASELINE_DIRECTORY, 'app/dist/rebuild-1'));
	const second = await inventoryOf(path.join(BASELINE_DIRECTORY, 'app/dist/rebuild-2'));
	const seconds = async (file: string): Promise<number> =>
		Number.parseInt((await readFile(path.join(BASELINE_DIRECTORY, file), 'utf8')).trim(), 10);
	const era = verifySealedRecord(
		buildEraLaneRecord({
			first,
			second,
			firstSeconds: await seconds('rebuild-1.seconds.txt'),
			secondSeconds: await seconds('rebuild-2.seconds.txt'),
			nodeVersion,
		}),
	);
	const migration = await composeMigration(SOURCE_TREE);
	const changeset = verifySealedRecord(buildChangesetRecord(migration));
	await mkdir(evidenceDirectory, { recursive: true });
	await writeFile(path.join(evidenceDirectory, ERA_LANE_FILE), canonical(era));
	await writeFile(path.join(evidenceDirectory, CHANGESET_FILE), canonical(changeset));
	process.stdout.write(
		`era lane ${String(era['result'])} over ${String(first.length)} files; changeset: ` +
			`${String(migration.applicationFilesChanged)}/${String(
				migration.applicationFilesScanned,
			)} application files changed, ${String(
				migration.workspaceFilesChanged,
			)} workspace, ${String(migration.unhandled.length)} unhandled, ${String(
				migration.declaredDifferences.length,
			)} declared differences, changeset digest ${sha256(canonical(changeset)).slice(0, 12)}\n`,
	);
}

if (process.argv[1]?.endsWith('angular-tiny-translator-lanes-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
