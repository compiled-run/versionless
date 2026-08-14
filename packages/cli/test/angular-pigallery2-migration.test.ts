import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import * as path from 'pathe';
import {
	APPLICATION_SOURCE_DIRECTORIES,
	ERA_WORKSPACE_FACTS,
	EVIDENCE_DIRECTORY,
	SOURCE_TREE,
	STAGE_DIRECTORY,
	composeMigration,
} from '../src/fixture/angular-pigallery2-migration-run.ts';
import {
	ATTEMPT_FILE,
	DOWNSTREAM_READING,
	ERA_FACTS_NOT_CARRIED,
	GAPS,
	INSTALL_STAGE_CLOSURE,
	PROBE,
	PROBE_DIAGNOSTIC_COUNTS,
	buildMigrationBlock,
	buildMigrationRecord,
} from '../src/fixture/angular-pigallery2-migration-record.ts';
import { ANGULAR_16_ECOSYSTEM_PACKAGES } from '../../frameworks/angular/src/index.ts';

async function readAttempt(): Promise<Record<string, unknown>> {
	return JSON.parse(await readFile(ATTEMPT_FILE, 'utf8')) as Record<string, unknown>;
}

describe('pigallery2 Angular holdout migration record', () => {
	it('records a red migration as red and claims no target build', () => {
		const block = buildMigrationBlock();
		expect(block['outcome']).toBe('red-migration-gaps-itemised');
		const target = block['targetBuild'] as Record<string, unknown>;
		expect(target['produced']).toBe(false);
		expect((block['laneInstall'] as Record<string, unknown>)['exitStatus']).toBe(1);
	});

	it('carries no parity, determinism or readiness claim, because no artifact was emitted', () => {
		const block = buildMigrationBlock();
		expect(block['parity']).toBeUndefined();
		expect(block['determinism']).toBeUndefined();
		expect(block['outputInventory']).toBeUndefined();
		expect(PROBE.build.artifactsEmitted).toBe(0);
	});

	it('states every gap as site, subject, library, quoted diagnostic, era reason and transform', () => {
		expect(GAPS.length).toBeGreaterThan(4);
		for (const gap of GAPS) {
			expect(gap.id).not.toBe('');
			expect(gap.site).not.toBe('');
			expect(gap.subject).not.toBe('');
			expect(gap.library).not.toBe('');
			expect(gap.observed.length).toBeGreaterThan(40);
			expect(gap.whyTheEraToolchainAccepted.length).toBeGreaterThan(80);
			expect(gap.whyTheEngineCannotCarryIt.length).toBeGreaterThan(120);
			expect(gap.neededTransform.length).toBeGreaterThan(120);
		}
	});

	it('gives every gap a distinct id and covers both refusal stages', () => {
		expect(new Set(GAPS.map((gap) => gap.id)).size).toBe(GAPS.length);
		expect(GAPS.some((gap) => gap.stage === 'install')).toBe(true);
		expect(GAPS.some((gap) => gap.stage === 'compile')).toBe(true);
	});

	it('names the three install gaps by package, and each is now a reading the cell carries', () => {
		const install = GAPS.filter((gap) => gap.stage === 'install');
		expect(install).toHaveLength(3);
		for (const name of ['@angular-devkit/build-optimizer', 'ng2-slim-loading-bar', 'ngx-toastr']) {
			expect(install.some((gap) => gap.site.includes(name))).toBe(true);
			expect(Object.keys(ANGULAR_16_ECOSYSTEM_PACKAGES)).toContain(name);
		}
	});

	it('keeps a closed gap stated as the demand it was, and says what answered it', () => {
		for (const gap of GAPS.filter((entry) => entry.stage === 'install')) {
			expect(gap.closedBy).toBeDefined();
			expect(gap.closedBy).toContain('lrapr-t021/u2');
			expect((gap.closedBy ?? '').length).toBeGreaterThan(200);
			/** The demand is not rewritten by the answer: the red diagnostic stays. */
			expect(gap.observed).toContain('npm ERR!');
		}
		/** A compile-stage gap is still open, and says nothing about being closed. */
		for (const gap of GAPS.filter((entry) => entry.stage === 'compile'))
			expect(gap.closedBy).toBeUndefined();
	});

	it('records the install the readings made possible, and the one refusal that is not a gap', () => {
		expect(INSTALL_STAGE_CLOSURE.laneInstall.firstAttempt.exitStatus).toBe(1);
		expect(INSTALL_STAGE_CLOSURE.laneInstall.firstAttempt.refusal).toContain('E404');
		expect(INSTALL_STAGE_CLOSURE.laneInstall.firstAttempt.reading).toContain('ETARGET');
		expect(INSTALL_STAGE_CLOSURE.laneInstall.secondAttempt.exitStatus).toBe(0);
		const digests = INSTALL_STAGE_CLOSURE.laneInstall.registryClosureBreak.manifestDigests;
		expect(digests.restoredSha256).toBe(digests.authoredSha256);
		expect(digests.installTimeSha256).not.toBe(digests.authoredSha256);
	});

	it('states the migrated build as attempted, refused and emitting nothing', () => {
		expect(INSTALL_STAGE_CLOSURE.laneBuild.exitStatus).toBe(1);
		expect(INSTALL_STAGE_CLOSURE.laneBuild.artifactsEmitted).toBe(0);
		expect(INSTALL_STAGE_CLOSURE.laneBuild.runs).toBe(1);
		const counts = INSTALL_STAGE_CLOSURE.laneBuild.diagnosticCounts;
		/**
		 * The three classes that moved, each for a reason the record names, and one
		 * that did not: the template mass is unchanged because nothing this unit did
		 * reaches it.
		 */
		expect(counts['TS2307']).toBe(2);
		expect(counts['TS2314']).toBe(7);
		expect(counts['NG2007']).toBe(PROBE_DIAGNOSTIC_COUNTS['NG2007']);
		expect(counts['NG8002']).toBe(PROBE_DIAGNOSTIC_COUNTS['NG8002']);
		expect(PROBE_DIAGNOSTIC_COUNTS['TS2307']).toBe(4);
		expect(INSTALL_STAGE_CLOSURE.laneBuild.moduleNotFound).toHaveLength(3);
		expect(
			INSTALL_STAGE_CLOSURE.laneBuild.moduleNotFound.some((entry) => entry.includes('toastr')),
		).toBe(false);
	});

	it('refuses the era-parity install policy on a reading rather than on taste', () => {
		expect(INSTALL_STAGE_CLOSURE.whyNotAnEraParityInstallPolicy).toContain('ngcc');
		expect(INSTALL_STAGE_CLOSURE.whyNotAnEraParityInstallPolicy.length).toBeGreaterThan(400);
		const block = buildMigrationBlock();
		expect(JSON.stringify(block)).not.toContain('--legacy-peer-deps');
		expect(JSON.stringify(block)).not.toContain('--force');
	});

	it('keeps the probe separate from the lane and says so', () => {
		expect(PROBE.tree).not.toBe(path.join(STAGE_DIRECTORY, 'app'));
		expect(PROBE.tree).toContain('target-probe');
		expect(PROBE.whatItIsNot.length).toBeGreaterThan(80);
		expect(PROBE.narrowingIsNotADisposition.length).toBeGreaterThan(80);
		expect(PROBE.narrowedFromLaneManifest).toHaveLength(4);
	});

	it('attributes the template diagnostic mass downstream rather than counting it as work', () => {
		const template =
			PROBE_DIAGNOSTIC_COUNTS['NG8001'] +
			PROBE_DIAGNOSTIC_COUNTS['NG8002'] +
			PROBE_DIAGNOSTIC_COUNTS['NG8003'] +
			PROBE_DIAGNOSTIC_COUNTS['NG8004'];
		expect(template).toBeGreaterThan(GAPS.length);
		expect(DOWNSTREAM_READING).toContain('app.module.ts');
		expect(DOWNSTREAM_READING.length).toBeGreaterThan(300);
	});

	it('names the era facts the migrated workspace does not carry', () => {
		expect(ERA_FACTS_NOT_CARRIED.length).toBeGreaterThan(3);
		for (const fact of ERA_FACTS_NOT_CARRIED) expect(fact.length).toBeGreaterThan(60);
		expect(ERA_WORKSPACE_FACTS.length).toBeGreaterThan(4);
	});

	it('records the freeze fingerprint it ran under, unchanged', () => {
		const freeze = buildMigrationBlock()['freeze'] as Record<string, unknown>;
		expect(freeze['compositeFingerprint']).toBe(
			'4df7bc961033fc5856b4d58e0bca9f11ad2aa9d43aaaee726956f34d209b37e7',
		);
		expect(freeze['angularSubtreeOid']).toBe('ca3824d0595d1fa88d37feda6b1785dfd79e72c4');
		expect(freeze['verifiedBeforeAndAfter']).toBe(true);
	});

	it('scans the whole browser compilation unit, not only the declared sourceRoot', () => {
		expect(APPLICATION_SOURCE_DIRECTORIES).toContain('frontend');
		expect(APPLICATION_SOURCE_DIRECTORIES).toContain('common');
	});

	it('seals the record and writes it into the ingest attempt', async () => {
		const record = buildMigrationRecord();
		expect(typeof record.digest).toBe('string');
		const attempt = await readAttempt();
		const migration = attempt['migration'] as Record<string, unknown>;
		expect(migration).toBeDefined();
		expect(migration['outcome']).toBe('red-migration-gaps-itemised');
		expect((migration['gaps'] as readonly unknown[]).length).toBe(GAPS.length);
	});

	it('composes the same changeset from the corpus the record describes', async () => {
		const migration = await composeMigration(SOURCE_TREE);
		expect(migration.cell).toContain('angular-16');
		expect(migration.applicationFilesChanged).toBeLessThan(migration.applicationFilesScanned);
		const block = buildMigrationBlock()['changeset'] as Record<string, unknown>;
		expect(block['applicationFilesScanned']).toBe(migration.applicationFilesScanned);
		expect(block['applicationFilesChanged']).toBe(migration.applicationFilesChanged);
		expect(block['workspaceFilesChanged']).toBe(migration.workspaceFilesChanged);
		const changeset = JSON.parse(
			await readFile(path.join(EVIDENCE_DIRECTORY, 'u3-composed-changeset.json'), 'utf8'),
		) as Record<string, unknown>;
		expect(changeset['applicationFilesScanned']).toBe(migration.applicationFilesScanned);
	});
});
