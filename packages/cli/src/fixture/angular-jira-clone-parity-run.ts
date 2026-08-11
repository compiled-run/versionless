/**
 * Record both build lanes of the `angular-jira-clone` migration cell and the
 * build-level parity between them.
 *
 * mj1 recorded an era lane that was byte-stable and a migrated lane that was red
 * at the closure install. mj2 recorded a closure that resolved and a build that
 * was red with five itemised demands. mj3c applied the transforms those demands
 * asked for, and this driver records what the two lanes then emitted.
 *
 * Lane one is the era baseline: the pinned tree on Node 16.20.2 with the era
 * closure and the one recorded deviation, rebuilt once more to see whether the
 * state mj1 committed still reproduces.
 *
 * Lane two is the migrated tree: the composed changeset applied to the same
 * pinned revision, the Angular 16.2 closure the cell resolves to, and the
 * official `@angular-devkit/build-angular:browser` builder run twice.
 *
 * What this driver records is build-level only: which files each lane emitted,
 * their digests and sizes, and where the two inventories agree and differ. It
 * observes no browser and asserts no behavioural equivalence; a difference found
 * here is recorded as a difference, never as a defect and never as a pass. The
 * differences this cell's changeset deliberately introduced — a whole-library
 * stylesheet in place of nine granular imports, a dropped TSLint toolchain, a
 * Sentry SDK two majors newer — are named here as non-claims rather than
 * absorbed into a parity number.
 *
 * The driver is fixture-scoped: it knows where this fixture's lanes were
 * materialised. Every decision about *what to change* lives in
 * `@versionless/angular`, which knows nothing about this application.
 */

import { readFile, mkdir, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { canonical, sha256 } from './angular-factoriolab-migration-run.ts';
import {
	compareInventories,
	inventoryOf,
	isByteStable,
	sealRecord,
	verifySealedRecord,
	type DistEntry,
	type SealedRecord,
} from './angular-factoriolab-build-lanes-run.ts';
import {
	acquiredArtifacts,
	acquisitionHosts,
	CLOSURE_RECORD_FILE,
	type LockEntry,
} from './angular-jira-clone-closure-run.ts';
import {
	ERA_DEVIATION,
	ERA_LANE_FILE,
	ERA_NOT_ESTABLISHED,
	MIGRATED_LANE_FILE,
	RECORDED_RISKS,
} from './angular-jira-clone-build-lanes-run.ts';
import {
	APPLIED_TREE,
	MIGRATION_RECORD_FILE,
	STAGE_DIRECTORY,
} from './angular-jira-clone-apply-run.ts';
import { CONSENT_ID } from './angular-jira-clone-migration-run.ts';

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');
const evidenceDirectory = path.join(repositoryRoot, 'evidence/runs/angular-jira-clone');

export const ERA_CACHE = path.join(repositoryRoot, '.versionless/cache/angular-jira-clone-baseline');
/** The two builds mj1 recorded, and the one this unit added beside them. */
export const ERA_FIRST_DIST = path.join(ERA_CACHE, 'rebuild/dist-1');
export const ERA_SECOND_DIST = path.join(ERA_CACHE, 'rebuild/dist-2');
export const ERA_RERUN_DIST = path.join(ERA_CACHE, 'rebuild/dist-3');
export const ERA_INGEST_DIST = path.join(ERA_CACHE, 'app/dist');
export const MIGRATED_FIRST_DIST = path.join(STAGE_DIRECTORY, 'dist-a');
export const MIGRATED_SECOND_DIST = path.join(STAGE_DIRECTORY, 'dist-b');

export const UNIT = 'lrapr-t005/mj3c-apply-builds-parity';
export const ERA_RECORD_FILE = 'mj3c-era-baseline.json';
export const MIGRATED_RECORD_FILE = 'mj3c-migrated-build.json';
export const PARITY_RECORD_FILE = 'mj3c-build-parity.json';

export const ERA_SUPERSEDES = Object.freeze({
	record: ERA_LANE_FILE,
	unit: 'lrapr-t005/mj1-jira-clone-migration-lanes',
	why: 'mj1 recorded the era lane as byte-stable across two consecutive builds and as reproducing the a2 ingest build. This record reruns the same lane from the same restored cache a day later and states whether that committed state still reproduces. mj1 is superseded rather than corrected: it was true about the builds it made.',
});

export const MIGRATED_SUPERSEDES: readonly Readonly<{
	record: string;
	unit: string;
	why: string;
}>[] = Object.freeze([
	Object.freeze({
		record: MIGRATED_LANE_FILE,
		unit: 'lrapr-t005/mj1-jira-clone-migration-lanes',
		why: 'mj1 recorded the migrated lane as red at the closure install, with no build, no inventory and no parity. The closure resolves and the build is green, so the state that record describes no longer holds.',
	}),
	Object.freeze({
		record: CLOSURE_RECORD_FILE,
		unit: 'lrapr-t005/mj2-ecosystem-cell-closure',
		why: 'mj2 recorded the closure as resolved and the production build as red with five itemised demands. All five have been answered by capabilities in @versionless/angular, and this record replaces that build attempt with the build. mj2 is not corrected — its itemisation is what made this build possible — and its acquisition record is still the record of the closure this one extends.',
	}),
]);

/**
 * The acquisition this unit made, as a delta against the closure mj2 recorded.
 *
 * One package was added to the manifest by a capability — a peer hole the
 * closure had been supplying by accident — so one further install was needed.
 * Recording it as a delta rather than as a fresh 2,000-entry inventory is what
 * makes the difference legible: what the resolver did beyond fetching the one
 * package it was asked for is exactly the thing a summary would hide.
 */
export type AcquisitionDelta = Readonly<{
	added: readonly LockEntry[];
	changed: readonly Readonly<{ path: string; from: string; to: string; url: string }>[];
	removed: readonly string[];
	hosts: readonly string[];
	totalAfter: number;
	totalBefore: number;
}>;

export function acquisitionDelta(
	before: readonly LockEntry[],
	after: readonly LockEntry[],
): AcquisitionDelta {
	const previous = new Map(before.map((entry) => [entry.path, entry]));
	const current = new Map(after.map((entry) => [entry.path, entry]));
	const added: LockEntry[] = [];
	const changed: { path: string; from: string; to: string; url: string }[] = [];
	for (const entry of after) {
		const was = previous.get(entry.path);
		if (was === undefined) {
			added.push(entry);
			continue;
		}
		if (was.integrity !== entry.integrity)
			changed.push({ path: entry.path, from: was.url, to: entry.url, url: entry.url });
	}
	const removed = before
		.filter((entry) => !current.has(entry.path))
		.map((entry) => entry.path)
		.sort();
	return Object.freeze({
		added: Object.freeze(added),
		changed: Object.freeze(changed),
		removed: Object.freeze(removed),
		hosts: acquisitionHosts([...added, ...changed.map((entry) => ({ ...entry, integrity: '' }))]),
		totalAfter: after.length,
		totalBefore: before.length,
	});
}

/**
 * Differences observed between the two lanes' output, recorded as differences.
 *
 * None of these is a defect and none is a pass. Each is a thing that is true of
 * the emitted files. The first three are differences this cell's own changeset
 * asked for, and they are stated first because a reader who only reads the
 * identical-payload count would otherwise never meet them.
 */
export const KNOWN_DIFFERENCES: readonly string[] = Object.freeze([
	'The migrated stylesheet bundle is 577,453 bytes where the era one is 156,426. This is the declared difference the changeset records: ng-zorro-antd 16 publishes an exports map that does not expose the root `style/index.min.css` entry the era stylesheet imported, and publishes no narrower equivalent, so the nine granular imports were replaced by the single exported 550,342-byte aggregate. The migrated application therefore ships the whole library’s stylesheet where it previously shipped a chosen subset. No claim is made that it renders as it did; a witness arbitrates that, and none has run.',
	'The migrated workspace has no lint target and no TSLint toolchain. TSLint, codelyzer and nz-tslint-rules stop below this cell’s Angular line with no successor, so the pair was dropped as a declared difference rather than pinned to a version nobody read. The migrated tree is therefore not lint-gated by the gate the era tree had; the ESLint target the workspace also declares was left exactly as it was and was not run by either lane.',
	'The migrated bundles carry the Sentry v8 SDK where the era bundles carry v6 with a separate @sentry/tracing package. The tracing integration is constructed by a factory rather than a class, the routing instrumentation is performed by the integration rather than passed to it, and `tracingOrigins` has moved to `tracePropagationTargets` on the init options. The API surface the application initialises is a different one. Neither lane opened a browser, so nothing about what either SDK sends was observed.',
	'Both lanes emit exactly 24 files and both lanes emit three lazy chunks, but the two builders identify those chunks differently: the era lane names them 456, 887 and 971 while the migrated lane names them 785, 737 and `quill`. They therefore share no emission point and are reported as lane-only rather than paired. Pairing them by size would be an inference this record does not make.',
	'Every copied payload is byte-identical across the lanes: the thirteen files under assets/ and _redirects, fourteen emission points in all. The builder copies these rather than transforming them, so their agreement is the absence of a difference rather than the presence of parity.',
	'The migrated index.html is 6,629 bytes against the era’s 11,331. The modern builder inlines critical CSS into a <style> element, loads the stylesheet with media="print" onload behind a <noscript> fallback, and minifies the document; the era builder emitted a plain stylesheet link and passed the document through nearly verbatim.',
	'3rdpartylicenses.txt differs in both size and content, which follows from the dependency closure being a different one.',
	'The application’s own Sentry DSN and Google Analytics measurement id survive both lanes inside the emitted bundles. They are recorded as present and are deliberately not reproduced anywhere in this evidence tree; no lane loaded a browser and no request to sentry.io or to Google was made or observed.',
	'The migrated build emitted two warnings this record carries rather than hides: the project’s own browserslist names kaios 2.5 and op_mini all, which the Angular 16 line ignores because it emits no ES5 output, and ngx-quill reaches CommonJS `quill`, which the builder warns can cause optimisation bailouts. The era lane, on a builder that still emitted ES5 targets from the same browserslist, made neither warning.',
]);

export const PARITY_NONCLAIMS: readonly string[] = Object.freeze([
	'This is build-level parity only. Nothing here establishes runtime equivalence, visual equivalence, or that either build works in a browser; witnessing is a separate step that has not run.',
	'A byte-identical payload means the two builders emitted the same file. It does not mean the two applications load it the same way.',
	'The identical-payload count is a count of emission points, not a measure of similarity. Fourteen of the twenty-seven points here are copied assets, which no builder transforms; the count would be misread as a parity score.',
	'Nothing here is a production-readiness, pilot, certification or general Angular support claim.',
]);

export const MIGRATED_NOT_ESTABLISHED: readonly string[] = Object.freeze([
	'A green production build establishes that the migrated tree compiles and emits. It establishes nothing about whether the emitted application runs, renders, or behaves as the era build did.',
	'Two consecutive builds on one host is repeatability, not reproducibility: nothing here establishes that another host, another day or another clock would emit the same bytes.',
	'No test was run on either lane. The karma/jasmine toolchain was aligned so the closure could resolve, and nothing was executed with it.',
	'The stylesheet substitution the changeset declared is unverified by this lane. A build that emits a 577KB stylesheet has not established that the rules it contains are the rules the application needs, only that the bundler accepted them.',
	'The modal-data migration moved three components off a removed API onto injected data. That the build type-checks establishes the shape is right; it does not establish that the three modals still receive what they receive, which is a runtime fact a witness would have to observe.',
	'Nothing here is a production-readiness, pilot, certification or general Angular support claim.',
]);

export type LaneRecords = Readonly<{
	era: SealedRecord;
	migrated: SealedRecord;
	parity: SealedRecord;
}>;

export function buildRecords(input: {
	eraFirst: readonly DistEntry[];
	eraRerun: readonly DistEntry[];
	eraIngest: readonly DistEntry[];
	migratedFirst: readonly DistEntry[];
	migratedSecond: readonly DistEntry[];
	delta: AcquisitionDelta;
	lockfileSha256: string;
	manifestSha256: string;
	installExitStatus: number;
	buildExitStatuses: readonly number[];
}): LaneRecords {
	const eraReproduces = isByteStable(input.eraFirst, input.eraRerun);
	const era = sealRecord({
		schemaVersion: 'versionless.angular-jira-clone-era-baseline.v2',
		unit: UNIT,
		consentId: CONSENT_ID,
		result: eraReproduces ? 'reproduces-committed-state' : 'diverged-from-committed-state',
		meaning:
			'The era lane was rerun once from the same restored cache, against the two builds mj1 recorded and the build the a2 ingest recorded before them. This record states whether the committed byte-stable state still reproduces.',
		supersedes: ERA_SUPERSEDES,
		cell: {
			node: 'v16.20.2',
			architecture: 'darwin-arm64, native — no translation layer',
			npm: '8.19.4 (bundled with the runtime)',
			command: 'npx ng build --configuration production',
			builder:
				'@angular-builders/custom-webpack:browser over ./webpack.config.js (Angular CLI 13.2.5)',
		},
		source: {
			repository: 'trungvose/jira-clone-angular',
			commit: '059455b9933a236456524925065bce2c295e2d9a',
			cache: '.versionless/cache/angular-jira-clone-baseline',
			provenance:
				'Restored in this checkout from the a2 ingest: the era dependency closure installed by `npm ci` against the committed package-lock.json (lockfileVersion 2, every entry integrity-hashed, every resolution on registry.npmjs.org). No package was acquired for this rerun.',
			deviation: ERA_DEVIATION,
		},
		reruns: [{ run: 3, status: 0, files: input.eraRerun.length }],
		reproducesCommittedState: eraReproduces,
		reproducesCommittedStateMeaning:
			'The rerun emits the same inventory, file for file and digest for digest, as the first of the two builds mj1 committed as byte-stable.',
		reproducesIngestBuild: isByteStable(input.eraRerun, input.eraIngest),
		inventory: input.eraRerun,
		recordedRisks: RECORDED_RISKS,
		notEstablished: ERA_NOT_ESTABLISHED,
	});

	const migratedStable = isByteStable(input.migratedFirst, input.migratedSecond);
	const migrated = sealRecord({
		schemaVersion: 'versionless.angular-jira-clone-migrated-build.v1',
		unit: UNIT,
		consentId: CONSENT_ID,
		result:
			input.migratedFirst.length > 0 && migratedStable
				? 'green-byte-stable'
				: input.migratedFirst.length > 0
					? 'green-unstable'
					: 'red',
		meaning:
			'The composed changeset was applied to the pinned tree, one package was acquired to close a peer hole a capability found, and the production build ran twice through the official browser builder. All five demands mj2 itemised were answered by capabilities in @versionless/angular; none was answered by an edit to this application.',
		supersedes: MIGRATED_SUPERSEDES,
		changeset: MIGRATION_RECORD_FILE,
		cell: {
			node: 'v16.20.2',
			architecture: 'darwin-arm64, native — no translation layer',
			npm: '8.19.4 (bundled with the runtime)',
			command: 'npx ng build --configuration production',
			builder:
				'@angular-devkit/build-angular:browser (Angular 16.2), the builder the custom-webpack absorption restored',
			environment: { NG_CLI_ANALYTICS: 'false' },
		},
		acquisition: {
			purpose:
				'Install the one package the undeclared-runtime-dependency capability added to the manifest: @ctrl/tinycolor, which ng-zorro-antd 16.2.2 imports from two of its own bundles and declares in none of its dependency fields.',
			consentId: CONSENT_ID,
			networkMode: 'consented',
			method:
				'npm install --no-audit --no-fund, against the closure mj2 installed and the lockfile it wrote',
			outcome: input.installExitStatus === 0 ? 'succeeded' : 'failed',
			exitStatus: input.installExitStatus,
			migratedManifestSha256: input.manifestSha256,
			lockfileSha256: input.lockfileSha256,
			hosts: input.delta.hosts,
			packagesLockedBefore: input.delta.totalBefore,
			packagesLockedAfter: input.delta.totalAfter,
			added: input.delta.added,
			changed: input.delta.changed,
			removed: input.delta.removed,
			deltaMeaning:
				'Every lockfile entry this install added or moved, against the entries mj2 recorded, with the URL and the integrity digest the resolver committed to. The install was asked for one package and did more than that: adding a dependency made npm re-resolve the tree, and the hoisted `yaml` at the closure root moved to a newer major while the three packages that ask for the older one gained their own nested copies. That is recorded because it happened, not because it was wanted — a resolver rearrangement inside a build that then went green is exactly the kind of thing a summary would drop.',
			offlineAfter:
				'Both production builds ran with VERSIONLESS_NETWORK_MODE=offline and acquired nothing.',
		},
		builds: input.buildExitStatuses.map((status, index) => ({
			run: index + 1,
			status,
			files: (index === 0 ? input.migratedFirst : input.migratedSecond).length,
		})),
		byteStable: migratedStable,
		inventory: input.migratedFirst,
		recordedRisks: RECORDED_RISKS,
		notEstablished: MIGRATED_NOT_ESTABLISHED,
	});

	const parity = compareInventories(input.eraFirst, input.migratedFirst);
	const parityRecord = sealRecord({
		schemaVersion: 'versionless.angular-jira-clone-build-parity.v1',
		unit: UNIT,
		consentId: CONSENT_ID,
		result: 'build-level-parity-recorded',
		meaning:
			'Both lanes built. This record lines their emitted files up by emission point — the file name with the builder’s content hash removed — and states where the bytes agree, where they differ, and by how much.',
		eraLane: ERA_RECORD_FILE,
		migratedLane: MIGRATED_RECORD_FILE,
		changeset: MIGRATION_RECORD_FILE,
		eraFileCount: parity.eraFileCount,
		migratedFileCount: parity.migratedFileCount,
		identicalPayloads: parity.identicalPayloads,
		onlyInEra: parity.onlyInEra,
		onlyInMigrated: parity.onlyInMigrated,
		entries: parity.entries.map((entry) => ({
			emissionPoint: entry.emissionPoint,
			era: entry.era.map((item) => ({ path: item.path, bytes: item.bytes, sha256: item.sha256 })),
			migrated: entry.migrated.map((item) => ({
				path: item.path,
				bytes: item.bytes,
				sha256: item.sha256,
			})),
			bytesIdentical: entry.bytesIdentical,
			byteDelta: entry.byteDelta,
		})),
		knownDifferences: KNOWN_DIFFERENCES,
		recordedRisks: RECORDED_RISKS,
		nonclaims: PARITY_NONCLAIMS,
	});

	return Object.freeze({ era, migrated, parity: parityRecord });
}

async function readExitStatus(file: string): Promise<number> {
	const text = await readFile(file, 'utf8');
	const line = text.split('\n').find((entry) => entry.startsWith('EXIT='));
	if (line === undefined) throw new Error(`Angular jira-clone parity: no "EXIT=" line in ${file}`);
	const value = Number.parseInt(line.slice('EXIT='.length), 10);
	if (Number.isNaN(value))
		throw new Error(`Angular jira-clone parity: "${line}" in ${file} is not a status`);
	return value;
}

export async function main(): Promise<void> {
	const lockfile = await readFile(path.join(APPLIED_TREE, 'package-lock.json'), 'utf8');
	const manifest = await readFile(path.join(APPLIED_TREE, 'package.json'), 'utf8');
	const previous: unknown = JSON.parse(
		await readFile(path.join(evidenceDirectory, 'mj2-acquired-closure.json'), 'utf8'),
	);
	const before = (previous as { artifacts: readonly LockEntry[] }).artifacts;
	const records = buildRecords({
		eraFirst: await inventoryOf(ERA_FIRST_DIST),
		eraRerun: await inventoryOf(ERA_RERUN_DIST),
		eraIngest: await inventoryOf(ERA_INGEST_DIST),
		migratedFirst: await inventoryOf(MIGRATED_FIRST_DIST),
		migratedSecond: await inventoryOf(MIGRATED_SECOND_DIST),
		delta: acquisitionDelta(before, acquiredArtifacts(lockfile)),
		lockfileSha256: sha256(lockfile),
		manifestSha256: sha256(manifest),
		installExitStatus: await readExitStatus(path.join(STAGE_DIRECTORY, 'install-2.exit')),
		buildExitStatuses: [
			await readExitStatus(path.join(STAGE_DIRECTORY, 'build-a.exit')),
			await readExitStatus(path.join(STAGE_DIRECTORY, 'build-b.exit')),
		],
	});
	await mkdir(evidenceDirectory, { recursive: true });
	for (const [name, record] of [
		[ERA_RECORD_FILE, records.era],
		[MIGRATED_RECORD_FILE, records.migrated],
		[PARITY_RECORD_FILE, records.parity],
	] as const)
		await writeFile(path.join(evidenceDirectory, name), canonical(verifySealedRecord(record)));
	process.stdout.write(
		`era: ${String(records.era['result'])}; migrated: ${String(
			records.migrated['result'],
		)}; identical payloads ${String(
			(records.parity['identicalPayloads'] as readonly unknown[]).length,
		)} of ${String((records.parity['entries'] as readonly unknown[]).length)}\n`,
	);
}

if (process.argv[1]?.endsWith('angular-jira-clone-parity-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
