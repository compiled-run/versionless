/**
 * Record the two build lanes of the `angular-jira-clone` migration cell.
 *
 * Lane one is the era baseline: the pinned tree on its own cell — native Node
 * 16.20.2, the era dependency closure restored from cache, the production
 * configuration with the one deviation the ingest recorded — rebuilt twice to
 * see whether the restored cache still produces the same bytes.
 *
 * Lane two is the migrated tree: the adapter's composed changeset applied to
 * the same pinned tree, and the declared Angular 16.2 closure install attempted
 * under the same consent. That lane is red, and this driver records the red
 * rather than the shape of a lane that did not happen. A build inventory it does
 * not have is absent from the record, not zero.
 *
 * The driver is fixture-scoped — it knows where this fixture's lanes were
 * materialised — while every decision about *what to change* lives in
 * `@versionless/angular`, which knows nothing about this application.
 */

import { readFile, mkdir, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { canonical, sha256 } from './angular-factoriolab-migration-run.ts';
import {
	inventoryOf,
	isByteStable,
	sealRecord,
	verifySealedRecord,
	type DistEntry,
} from './angular-factoriolab-build-lanes-run.ts';

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');
const evidenceDirectory = path.join(repositoryRoot, 'evidence/runs/angular-jira-clone');

export const ERA_REBUILD_DIRECTORY = path.join(
	repositoryRoot,
	'.versionless/cache/angular-jira-clone-baseline/rebuild',
);
export const ERA_INGEST_DIST = path.join(
	repositoryRoot,
	'.versionless/cache/angular-jira-clone-baseline/app/dist',
);
export const MIGRATED_STAGE_DIRECTORY = path.join(
	repositoryRoot,
	'.versionless/stage/angular-jira-clone-mj1',
);

export const UNIT = 'lrapr-t005/mj1-jira-clone-migration-lanes';
export const CONSENT = 'VL-LEGACY-CORPUS-2026-08-10';

export const ERA_LANE_FILE = 'mj1-era-baseline.json';
export const MIGRATED_LANE_FILE = 'mj1-migrated-lane.json';

/**
 * The one deviation this lane carries, restated where the lane is recorded
 * rather than left in the ingest for a reader to go and find.
 */
export const ERA_DEVIATION =
	'The committed production configuration is invalid against the Angular 13 builder the same revision pins: it sets `extractCss`, removed from the browser builder schema in v13, and `ng build --configuration production` fails schema validation in about a second. The ingest recorded that as an upstream defect at the pin and deleted the single key in the git-ignored baseline working tree; this lane builds that same deviated tree. Nothing else was changed — no source, no dependency, no other option.';

export const ERA_NOT_ESTABLISHED: readonly string[] = Object.freeze([
	'Byte stability across two consecutive builds on one host is repeatability, not reproducibility: nothing here establishes that another host, another day or another clock would emit the same bytes.',
	'No browser opened these bundles. Nothing about their behaviour is observed.',
	'This is the production configuration with one key deleted. It is not the configuration upstream committed, and the deleted key is recorded above rather than absorbed into a claim of an unmodified build.',
]);

/**
 * Risks read out of the application source and recorded without reproducing
 * what they carry. The values themselves are upstream's secrets to hold, not
 * this repository's to copy into evidence.
 */
export const RECORDED_RISKS: readonly string[] = Object.freeze([
	'The application initialises Sentry with a hard-coded DSN in src/main.ts. The DSN is present in every artifact both lanes emit. Its value is deliberately not reproduced anywhere in this evidence tree.',
	'The application initialises Google Analytics with a hard-coded measurement id in src/app/core/services/google-analytics.service.ts. The id is present in every artifact both lanes emit. Its value is deliberately not reproduced anywhere in this evidence tree.',
	'Neither lane opened a browser, so neither made nor observed a request to Sentry or to Google. Their presence in the bundles is recorded as presence, not as behaviour.',
]);

export type LaneRecords = Readonly<{
	era: Readonly<Record<string, unknown>>;
	migrated: Readonly<Record<string, unknown>>;
}>;

/** Build both lane records from inventories and the migrated lane's outcome. */
export function buildLaneRecords(input: {
	eraFirst: readonly DistEntry[];
	eraSecond: readonly DistEntry[];
	eraIngest: readonly DistEntry[];
	migratedInstallStderrTail: string;
	migratedManifestSha256: string;
}): LaneRecords {
	const era = sealRecord({
		schemaVersion: 'versionless.angular-jira-clone-era-baseline.v1',
		unit: UNIT,
		consentId: CONSENT,
		result:
			input.eraFirst.length > 0 && isByteStable(input.eraFirst, input.eraSecond)
				? 'byte-stable'
				: 'unstable',
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
				'Restored in this checkout from the a2 ingest: the era dependency closure installed by `npm ci` against the committed package-lock.json (lockfileVersion 2, 2747 entries, every entry integrity-hashed, every resolution on registry.npmjs.org).',
			deviation: ERA_DEVIATION,
		},
		builds: [
			{ run: 1, status: 0, files: input.eraFirst.length },
			{ run: 2, status: 0, files: input.eraSecond.length },
		],
		byteStable: isByteStable(input.eraFirst, input.eraSecond),
		reproducesIngestBuild: isByteStable(input.eraFirst, input.eraIngest),
		reproducesIngestBuildMeaning:
			'The two rebuilds in this unit emit the same inventory, file for file and digest for digest, as the deviation build the a2 ingest recorded weeks earlier from the same restored cache.',
		inventory: input.eraFirst,
		recordedRisks: RECORDED_RISKS,
		notEstablished: ERA_NOT_ESTABLISHED,
	});

	const migrated = sealRecord({
		schemaVersion: 'versionless.angular-jira-clone-migrated-lane.v1',
		unit: UNIT,
		consentId: CONSENT,
		result: 'red-at-closure-install',
		meaning:
			'The migrated tree exists and its changeset is recorded beside this file. The Angular 16.2 dependency closure it asks for does not resolve, so no migrated build ran, no migrated inventory exists, and no build-level parity is recorded. This file records that state; it does not record a lane that did not happen.',
		cell: {
			node: 'v16.20.2',
			architecture: 'darwin-arm64, native — no translation layer',
			npm: '8.19.4 (bundled with the runtime)',
			intendedCommand: 'ng build --configuration production (never reached)',
			builder:
				'@angular-devkit/build-angular:browser (Angular 16.2), the builder the absorption restored',
		},
		acquisition: {
			purpose:
				'Install the declared Angular 16.2 dependency closure the migrated manifest asks for.',
			consentId: CONSENT,
			networkMode: 'consented',
			method: 'npm install --no-audit --no-fund (no lockfile carried over: the era lockfileVersion 2 pins the Angular 13 closure)',
			outcome:
				'failed — npm ERESOLVE, no package was downloaded and no node_modules was written',
			migratedManifestSha256: input.migratedManifestSha256,
			urlsAcquired: [],
			urlsAcquiredNote:
				'None. The resolver refused before fetching any tarball, so there is no acquired URL or digest to record. Registry metadata reads made by the resolver are the only network traffic this step produced.',
			stderrTail: input.migratedInstallStderrTail,
		},
		blocker: {
			shape: 'Angular-major-coupled community libraries',
			firstConflict:
				'@ant-design/icons-angular@13.1.0 declares peer @angular/common@^13.0.1; the aligned root asks for @angular/common@^16.2.0.',
			why: 'This application draws on a community library layer the factoriolab application did not have. Those packages version in lockstep with the Angular major and each one declares a peer range on it, so an era copy of any of them refuses the target line. The adapter’s cell aligns the Angular packages, the devkit, @angular-eslint and the test toolchain; it says nothing about ng-zorro-antd, @ant-design/icons-angular, Akita, @ngneat/*, @sentry/angular, ngx-quill, Storybook, codelyzer or nz-tslint-rules, and inventing versions for them here would be a guess written into a manifest.',
			knownAtRisk: [
				'@ant-design/icons-angular ^13.1.0 — the conflict npm reported first',
				'ng-zorro-antd ^13.1.0 — peers @angular/core ^13',
				'@datorama/akita ^7.1.1 with @datorama/akita-ng-entity-service ^7.0.0, @datorama/akita-ng-router-store ^7.0.0, @datorama/akita-ngdevtools ^7.0.0',
				'@ngneat/content-loader ^6.0.0, @ngneat/until-destroy ^8.0.3, @ngneat/tailwind ^7.0.3',
				'@sentry/angular ^6.18.1',
				'ngx-quill ^16.1.2',
				'@storybook/angular ^6.1.11 and its four addons',
				'codelyzer ^6.0.0 and nz-tslint-rules ^0.901.2, both tied to a TSLint line that has no Angular 16 release at all',
			],
			knownAtRiskNote:
				'This list is read off the era manifest’s declared peer surface. Only the first entry was observed failing: npm stops at the first unresolvable peer, so the rest are candidates, not observations.',
		},
		whatDidWork: [
			'The custom-webpack absorption is generic and it fired: the fragment was read statically, every capability it declares was matched against the official builder’s own postcss pipeline, both wrapper targets went back to the devkit builder, and @angular-builders/custom-webpack was released.',
			'The upstream-invalid `extractCss` key was removed by the adapter’s existing generic removed-option table, with no application-specific patch — the same deletion the ingest had to make by hand.',
			'`cli.defaultCollection` was rewritten to `cli.schematicCollections`, the CLI’s own rename, as a generic workspace-key transform.',
		],
		notEstablished: [
			'No migrated build ran. Nothing here establishes that the migrated tree compiles, emits, or would emit anything at all.',
			'No build-level parity exists for this cell, because only one of the two lanes produced an inventory.',
			'The absorption fired, but no build has yet confirmed that the official builder’s native Tailwind wiring produces the same styles the fragment produced. That confirmation needs the migrated lane to go green.',
			'Nothing here is a production-readiness, pilot, certification or general Angular support claim.',
		],
		recordedRisks: RECORDED_RISKS,
	});

	return Object.freeze({ era, migrated });
}

export async function main(): Promise<void> {
	const eraFirst = await inventoryOf(path.join(ERA_REBUILD_DIRECTORY, 'dist-1'));
	const eraSecond = await inventoryOf(path.join(ERA_REBUILD_DIRECTORY, 'dist-2'));
	const eraIngest = await inventoryOf(ERA_INGEST_DIST);
	const stderr = await readFile(
		path.join(MIGRATED_STAGE_DIRECTORY, 'install-1.stderr.log'),
		'utf8',
	);
	const manifest = await readFile(
		path.join(MIGRATED_STAGE_DIRECTORY, 'migrated/package.json'),
		'utf8',
	);
	const records = buildLaneRecords({
		eraFirst,
		eraSecond,
		eraIngest,
		migratedInstallStderrTail: stderr
			.split('\n')
			.filter((line) => line.startsWith('npm ERR!'))
			.slice(0, 14)
			.join('\n'),
		migratedManifestSha256: sha256(manifest),
	});
	await mkdir(evidenceDirectory, { recursive: true });
	for (const [name, record] of [
		[ERA_LANE_FILE, records.era],
		[MIGRATED_LANE_FILE, records.migrated],
	] as const)
		await writeFile(
			path.join(evidenceDirectory, name),
			canonical(verifySealedRecord(record as never)),
		);
	process.stdout.write(
		`era byte-stable: ${String(records.era['byteStable'])}; era files ${String(
			eraFirst.length,
		)}; migrated lane: ${String(records.migrated['result'])}\n`,
	);
}

if (process.argv[1]?.endsWith('angular-jira-clone-build-lanes-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
