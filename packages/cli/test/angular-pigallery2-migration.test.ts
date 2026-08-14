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
	COMPILE_STAGE_DEPENDENCY_CLOSURE,
	INSTALL_STAGE_CLOSURE,
	PROBE,
	PROBE_DIAGNOSTIC_COUNTS,
	U4_CAPABILITIES,
	U4_WALL,
	buildMigrationBlock,
	buildMigrationRecord,
} from '../src/fixture/angular-pigallery2-migration-record.ts';
import {
	ANGULAR_16_BROWSER_CELL,
	ANGULAR_16_ECOSYSTEM_PACKAGES,
	alignedVersionRange,
	cellAcceptsBuildStamp,
	cellNodeEngineRange,
	ecosystemDispositionOf,
	nodeRangeReading,
} from '../../frameworks/angular/src/index.ts';

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
		/**
		 * G4 is the dependency half of the compile stage and is closed by the unit
		 * that read the three libraries; G5, G6 and G7 are the source demands, closed
		 * by the unit that composed and wrote the four app-source capabilities. Each
		 * answer names its unit and none of them rewrites the demand it answers: the
		 * `observed` diagnostic of every closed gap is still the red one.
		 */
		const g4 = GAPS.find((gap) => gap.id === 'G4');
		expect(g4?.stage).toBe('compile');
		expect(g4?.closedBy).toContain('lrapr-t021/u3');
		expect(g4?.observed).toContain('TS2314');
		for (const id of ['G5', 'G6', 'G7']) {
			const gap = GAPS.find((entry) => entry.id === id);
			expect(gap?.stage).toBe('compile');
			expect(gap?.closedBy).toContain('lrapr-t021/u4');
			expect((gap?.closedBy ?? '').length).toBeGreaterThan(200);
		}
		expect(GAPS.find((gap) => gap.id === 'G5')?.observed).toContain('NG2007');
		expect(GAPS.find((gap) => gap.id === 'G6')?.observed).toContain("Can't resolve 'raw-loader'");
		expect(GAPS.find((gap) => gap.id === 'G7')?.observed).toContain('TS2339');
	});

	/**
	 * The wall is the point of the holdout, so it is held to being *stated* rather
	 * than counted: every library it names is one the cell read and refused, and
	 * every way out of it is recorded as a decision somebody has to take rather
	 * than as something this lane did.
	 */
	it('states the remaining wall as the three no-successor libraries, with the options open', () => {
		expect(U4_WALL.diagnostics).toBeLessThan(U4_WALL.before);
		expect(U4_WALL.wall.length).toBeGreaterThan(3);
		for (const name of ['@yaga/leaflet-ng2', 'ng2-slim-loading-bar', 'jw-bootstrap-switch-ng2']) {
			expect(U4_WALL.wall.some((entry) => entry.includes(name))).toBe(true);
			expect(ecosystemDispositionOf(name, ANGULAR_16_BROWSER_CELL)?.kind).toBe('no-successor');
		}
		expect(U4_WALL.options).toHaveLength(3);
		expect(U4_WALL.notEstablished.join(' ')).toContain('No stub, shim, module declaration');
		expect(U4_CAPABILITIES).toHaveLength(4);
		for (const entry of U4_CAPABILITIES) expect(entry.gate.length).toBeGreaterThan(120);
	});

	it('names the four compile-stage dependency readings, and holds each to the cell', () => {
		const readings = COMPILE_STAGE_DEPENDENCY_CLOSURE.readings;
		expect(Object.keys(readings).sort()).toEqual([
			'@yaga/leaflet-ng2',
			'jw-bootstrap-switch-ng2',
			'ngx-bootstrap',
			'xlf-google-translate',
		]);
		/** Every package the record names is a package the cell actually reads. */
		for (const name of Object.keys(readings))
			expect(Object.keys(ANGULAR_16_ECOSYSTEM_PACKAGES)).toContain(name);
		/** And the verdict the record states is the verdict the cell carries. */
		expect(alignedVersionRange('ngx-bootstrap', ANGULAR_16_BROWSER_CELL)).toBe('^11.0.2');
		expect(alignedVersionRange('xlf-google-translate', ANGULAR_16_BROWSER_CELL)).toBe('^1.0.4');
		for (const dropped of ['@yaga/leaflet-ng2', 'jw-bootstrap-switch-ng2']) {
			expect(ecosystemDispositionOf(dropped, ANGULAR_16_BROWSER_CELL)?.kind).toBe('no-successor');
			expect(alignedVersionRange(dropped, ANGULAR_16_BROWSER_CELL)).toBeNull();
		}
		const bootstrap = ecosystemDispositionOf('ngx-bootstrap', ANGULAR_16_BROWSER_CELL);
		expect(bootstrap?.kind).toBe('aligned');
		if (bootstrap?.kind !== 'aligned' || bootstrap.buildStamp === undefined) return;
		expect(bootstrap.buildStamp.compiledWith).toBe('16.1.4');
		expect(cellAcceptsBuildStamp(ANGULAR_16_BROWSER_CELL.angularLine, bootstrap.buildStamp)).toBe(
			true,
		);
	});

	it('records the engines retarget as the capability the era declaration demanded', () => {
		const capability = COMPILE_STAGE_DEPENDENCY_CLOSURE.engineRetargetCapability;
		expect(capability.module).toBe(
			'packages/frameworks/angular/src/workspace-engines-retarget.ts',
		);
		/** The era declaration excluded the cell; the cell's own range admits it. */
		expect(nodeRangeReading('>= 6.9 <11.0', ANGULAR_16_BROWSER_CELL.nodeLine)).toBe('excludes');
		const written = cellNodeEngineRange(ANGULAR_16_BROWSER_CELL);
		expect(written).toBe('^16.20.2');
		expect(nodeRangeReading(written, ANGULAR_16_BROWSER_CELL.nodeLine)).toBe('admits');
		expect(capability.observedEffect).toContain('EBADENGINE');
		expect(capability.observedEffect).toContain('^16.20.2');
		/** A retarget is a declaration, and the record refuses to read it as more. */
		expect(capability.notEstablished).toContain('not a runtime claim');
	});

	it('states the second migrated build honestly: two classes closed, five differences speaking', () => {
		const build = COMPILE_STAGE_DEPENDENCY_CLOSURE.laneBuild;
		expect(build.exitStatus).toBe(1);
		expect(build.artifactsEmitted).toBe(0);
		expect(build.runs).toBe(1);
		/** The two classes G4 was measured by are gone. */
		expect(build.diagnosticCounts.TS2314).toBe(0);
		expect(build.diagnosticCounts.TS2416).toBe(0);
		/** The classes the drops produced grew, and are not hidden by the total. */
		expect(build.diagnosticCounts.TS2307).toBeGreaterThan(
			INSTALL_STAGE_CLOSURE.laneBuild.diagnosticCounts.TS2307,
		);
		/** The gaps this unit did not touch did not move. */
		expect(build.diagnosticCounts.NG2007).toBe(
			INSTALL_STAGE_CLOSURE.laneBuild.diagnosticCounts.NG2007,
		);
		expect(build.diagnosticCounts.TS2339).toBe(
			INSTALL_STAGE_CLOSURE.laneBuild.diagnosticCounts.TS2339,
		);
		for (const code of ['NG8001', 'NG8002', 'NG8003', 'NG8004'] as const)
			expect(build.diagnosticCounts[code]).toBe(
				INSTALL_STAGE_CLOSURE.laneBuild.diagnosticCounts[code],
			);
		/** New findings are named rather than folded into a count. */
		expect(build.newFindingsThisUnitProduced.length).toBeGreaterThanOrEqual(4);
		expect(build.newFindingsThisUnitProduced.some((entry) => entry.includes('leaflet'))).toBe(true);
		expect(
			build.newFindingsThisUnitProduced.some((entry) => entry.includes('undeclared-runtime-dependency')),
		).toBe(true);
	});

	it('installs the authored manifest with nothing narrowed away', () => {
		const install = COMPILE_STAGE_DEPENDENCY_CLOSURE.laneInstall;
		expect(install.attempt.exitStatus).toBe(0);
		expect(install.attempt.noNarrowing).toContain('No package was removed');
		expect(install.installedVersions['ngx-bootstrap']).toBe('11.0.2');
		expect(install.installedVersions['xlf-google-translate']).toBe('1.0.4');
		/** The two dropped packages are absent from the closure, not held back. */
		for (const dropped of ['@yaga/leaflet-ng2', 'jw-bootstrap-switch-ng2'])
			expect(install.absentFromTheClosure.some((entry) => entry.startsWith(dropped))).toBe(true);
		/** The lockfile attempts that measured nothing are recorded as measuring nothing. */
		expect(install.attemptsBeforeTheLockfileWasMovedOut.reading).toContain(
			'not counted as one',
		);
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
