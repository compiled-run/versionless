/**
 * The coverage report: one derivation, one guard, one intervention rule.
 *
 * What is checked here is not that the numbers are pleasant. It is that they
 * are the *same* numbers the support matrix already publishes, that the human
 * rendering cannot restate a bounded outcome as a general one, and that the
 * intervention rule reaches exactly the rows it is supposed to reach — the ones
 * whose status came from a run record — and none of the sealed cells the Judge
 * counted before any intervention counter existed.
 */

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import { buildCapabilityCoverage } from '../../core/src/receipts/capability-coverage.ts';
import { HOLDOUT_ANGULAR_ESHOP_WEBSPA_OUTCOME } from '../../core/src/receipts/holdout-angular-eshop-webspa.ts';
import { ANGULAR_PRE_IVY_BOUNDARY_PREVALENCE } from '../../core/src/receipts/angular-pre-ivy-boundary-amendment.ts';
import {
	applyInterventionRule,
	buildCoverageReport,
	COVERAGE_REPORT_JSON,
	COVERAGE_REPORT_MARKDOWN,
	COVERAGE_REPORT_SCHEMA,
	coverageReportDigest,
	deriveCoverageSurfaces,
	INTERVENTION_COUNT_NOT_ASSERTED,
	INTERVENTION_COUNT_NOT_ZERO,
	STAGES_NOT_ALL_RAN,
	readInterventionCount,
	readRunRecords,
	renderCoverageReport,
	type CoverageReport,
	type CoverageRunRecord,
	type CoverageStatus,
} from '../src/coverage-report.ts';
import { assertEnterpriseSurfaceHonesty, type EnterpriseSupportMatrix } from '../src/enterprise.ts';

const root = path.resolve(process.cwd());
const published = path.join(root, 'evidence/trust/current');

async function publishedMatrix(): Promise<EnterpriseSupportMatrix> {
	const report = JSON.parse(
		await readFile(path.join(published, 'enterprise-report.json'), 'utf8'),
	) as { results: { supportMatrix: EnterpriseSupportMatrix } };
	return report.results.supportMatrix;
}

async function derived(): Promise<{ report: CoverageReport; markdown: string }> {
	return deriveCoverageSurfaces({
		root,
		output: published,
		matrix: await publishedMatrix(),
		capabilityCoverage: buildCapabilityCoverage(),
	});
}

/** Nine stages, every one of them run: the shape a proven run has to have. */
const allNineRan: readonly { readonly name: string; readonly status: string }[] = Object.freeze(
	[
		'analyze',
		'ingest',
		'license-at-pin',
		'era-cell',
		'plan',
		'apply',
		'install',
		'build',
		'witness',
	].map((name) => Object.freeze({ name, status: 'ran' })),
);

const LICENCE_SHA256 = 'fbfe10674aef1e0bf084850644879fa4114d8a98debc5fb8e680f295af169d43';
const PINNED_REVISION = '069b6690d9fa7a24a6e7727386ab85148c89b90e';

/**
 * The two stage records a run has to carry for its row to state a source.
 *
 * A proven run with a zero count still yields no application unless its ingest
 * stage pinned a repository, ref and revision and its licence-at-pin stage read
 * an identifier off a licence file it hashed. These are the payloads the two
 * stages write, in the shape the reader walks them in, so a fixture that admits
 * an application is a fixture that could have come off disk.
 */
const sourcedStageRecords: Readonly<Record<string, Record<string, unknown>>> = Object.freeze({
	ingest: {
		pin: { repository: 'acme/some-application', ref: 'refs/tags/v1.0.0', commitSha: PINNED_REVISION },
	},
	'license-at-pin': {
		identifier: 'MIT',
		artifacts: [{ role: 'repository-root-licence', sha256: LICENCE_SHA256 }],
	},
});

/** `allNineRan`, with those two stages carrying the records they write. */
const allNineRanSourced = Object.freeze(
	allNineRan.map((stage) =>
		sourcedStageRecords[stage.name] === undefined
			? { ...stage }
			: { ...stage, record: sourcedStageRecords[stage.name] },
	),
);

const runRecord = (overrides: Partial<CoverageRunRecord> = {}): CoverageRunRecord => ({
	id: 'run-some-application',
	application: 'some-application',
	framework: 'react',
	outcome: 'proceeded',
	stages: allNineRan,
	pin: { repository: 'acme/some-application', ref: 'refs/tags/v1.0.0', commitSha: PINNED_REVISION },
	licence: { identifier: 'MIT', artifactSha256: LICENCE_SHA256 },
	...overrides,
});

describe('coverage report — the sealed baseline, read once', () => {
	it('carries the schema and a canonical digest that recomputes', async () => {
		const { report } = await derived();
		expect(report.schemaVersion).toBe(COVERAGE_REPORT_SCHEMA);
		expect(report.integrity.algorithm).toBe('sha256');
		expect(report.integrity.authenticity).toBe('not-established');
		expect(coverageReportDigest(report)).toBe(report.integrity.canonicalDigest);
	});

	it('reads the counted cells and capability figures off the support matrix verbatim', async () => {
		const { report } = await derived();
		const matrix = await publishedMatrix();
		expect(report.sealedBaseline.counted).toEqual({
			react: { ready: 6, total: 6 },
			angular: { ready: 4, total: 4 },
		});
		expect(report.sealedBaseline.capabilities.crossProven).toBe(8);
		expect(report.sealedBaseline.capabilities.total).toBe(58);
		expect(report.sealedBaseline.capabilities.experimental).toBe(50);
		expect(report.derivation).toBe(matrix.derivation);
		expect(report.sealedBaseline.demoted).toEqual(matrix.demoted);
		expect(report.sealedBaseline.boundaryPrevalence.published).toBe(
			ANGULAR_PRE_IVY_BOUNDARY_PREVALENCE.published,
		);
	});

	it('rows every counted cell, holdout and demotion, and provenance is sealed receipts', async () => {
		const { report } = await derived();
		const sealed = report.applications.filter(
			(row) => row.provenanceOfStatus === 'sealed-receipts',
		);
		const runRecordRows = report.applications.filter(
			(row) => row.provenanceOfStatus === 'run-record',
		);
		const countOf = (status: CoverageStatus): number =>
			sealed.filter((row) => row.status === status).length;
		// The sealed baseline is a pin, not a floor: these are the cells the Judge
		// counted before any run record existed, and they may not drift.
		expect({
			applications: sealed.length,
			proven: countOf('proven'),
			bounded: countOf('bounded'),
			refused: countOf('refused'),
			'not-admitted': countOf('not-admitted'),
		}).toEqual({
			applications: 13,
			proven: 10,
			bounded: 2,
			refused: 0,
			'not-admitted': 1,
		});
		for (const row of sealed) expect(row.provenanceOfStatus).toBe('sealed-receipts');
		// Run-record rows are the intervention rule's territory: a run record may only
		// reach `proven` by asserting zero interventions.
		for (const row of runRecordRows) {
			expect(row.provenanceOfStatus).toBe('run-record');
			if (row.status === 'proven') {
				expect(row.interventionCount).toBe(0);
				expect(row.refusalCode).toBeUndefined();
			}
		}
		// Totals stay derived from the rows, never restated by hand.
		expect(report.totals.applications).toBe(sealed.length + runRecordRows.length);
		const eshop = report.applications.find((row) => row.id === 'holdout-angular-eshop-webspa');
		expect(eshop?.status).toBe('bounded');
		expect(eshop?.boundedOutcome).toBe(HOLDOUT_ANGULAR_ESHOP_WEBSPA_OUTCOME);
	});

	it('publishes the pair that is on disk, byte for byte', async () => {
		const { report, markdown } = await derived();
		const publishedJson = JSON.parse(
			await readFile(path.join(published, COVERAGE_REPORT_JSON), 'utf8'),
		) as CoverageReport;
		expect(publishedJson).toEqual(report);
		expect(await readFile(path.join(published, COVERAGE_REPORT_MARKDOWN), 'utf8')).toBe(
			markdown,
		);
	});
});

describe('coverage report — the honesty guard', () => {
	it('passes the enterprise surface guard as emitted', async () => {
		const { markdown } = await derived();
		expect(() => {
			assertEnterpriseSurfaceHonesty(markdown, COVERAGE_REPORT_MARKDOWN);
		}).not.toThrow();
		expect(markdown).toContain(HOLDOUT_ANGULAR_ESHOP_WEBSPA_OUTCOME);
		expect(markdown).toContain('counted in no lineage numerator');
		expect(markdown).toContain('not certification');
		expect(markdown).not.toContain(ANGULAR_PRE_IVY_BOUNDARY_PREVALENCE.neverPublishedAs);
	});

	it('refuses to render a bounded holdout restated as a generic pass', async () => {
		const matrix = await publishedMatrix();
		const restated = {
			...matrix,
			holdouts: matrix.holdouts.map((holdout) =>
				holdout.id === 'holdout-angular-eshop-webspa'
					? { ...holdout, outcome: 'passed' }
					: holdout,
			),
		} as EnterpriseSupportMatrix;
		const report = buildCoverageReport({
			matrix: restated,
			capabilityCoverage: buildCapabilityCoverage(),
			refusalCensus: JSON.parse(
				await readFile(
					path.join(root, 'evidence/runs/operator-flows/refusal-census.json'),
					'utf8',
				),
			) as Record<string, unknown>,
			runRecords: [],
		});
		expect(() => renderCoverageReport(report)).toThrow(/eShop holdout/);
	});
});

describe('coverage report — the intervention rule', () => {
	it('records a run-record application proven only against an asserted zero', () => {
		const proven = applyInterventionRule(runRecord({ interventions: { count: 0 } }));
		expect(proven.status).toBe('proven');
		expect(proven.provenanceOfStatus).toBe('run-record');
		expect(proven.interventionCount).toBe(0);
	});

	it('refuses to record a run-record application proven when interventions were counted', () => {
		const helped = applyInterventionRule(runRecord({ interventions: { count: 1 } }));
		expect(helped.status).toBe('not-admitted');
		expect(helped.statusReason).toBe(INTERVENTION_COUNT_NOT_ZERO);
		expect(helped.interventionCount).toBe(1);
	});

	it('refuses to record a run-record application proven when no count was asserted', () => {
		const unmeasured = applyInterventionRule(runRecord());
		expect(unmeasured.status).toBe('not-admitted');
		expect(unmeasured.statusReason).toBe(INTERVENTION_COUNT_NOT_ASSERTED);
		expect(unmeasured.interventionCount).toBe('not-asserted');
	});

	it('takes the count from the out-of-band harness record filed beside the run', async () => {
		const checkout = await mkdtemp(path.join(tmpdir(), 'versionless-coverage-'));
		try {
			const directory = path.join(checkout, 'evidence/runs/run-unseen-application');
			await mkdir(directory, { recursive: true });
			await writeFile(
				path.join(directory, 'run-record.json'),
				`${JSON.stringify({
					schema: 'versionless.run.v1',
					application: 'unseen-application',
					lineage: 'react',
					outcome: 'proceeded',
					stages: allNineRanSourced,
				})}\n`,
			);
			/** The run states no count of its own; the harness beside it does. */
			const withoutHarness = await readRunRecords(checkout);
			expect(withoutHarness).toHaveLength(1);
			expect(withoutHarness[0]?.interventions).toBeUndefined();
			expect(applyInterventionRule(withoutHarness[0] as CoverageRunRecord).statusReason).toBe(
				INTERVENTION_COUNT_NOT_ASSERTED,
			);
			await writeFile(
				path.join(directory, 'run-record.json.interventions.json'),
				`${JSON.stringify({
					schemaVersion: 'versionless.intervention-count.v1',
					interventionCount: 0,
					invocations: 1,
					terminalClassification: 'proven',
				})}\n`,
			);
			const withHarness = await readRunRecords(checkout);
			expect(withHarness[0]?.interventions?.count).toBe(0);
			expect(applyInterventionRule(withHarness[0] as CoverageRunRecord).status).toBe(
				'proven',
			);
			expect(await readInterventionCount(directory)).toBe(0);
		} finally {
			await rm(checkout, { recursive: true, force: true });
		}
	});

	it('reads a harness record carrying a count above zero as one, and admits nothing', async () => {
		const checkout = await mkdtemp(path.join(tmpdir(), 'versionless-coverage-'));
		try {
			const directory = path.join(checkout, 'evidence/runs/run-hand-helped');
			await mkdir(directory, { recursive: true });
			await writeFile(
				path.join(directory, 'run-record.json'),
				`${JSON.stringify({
					schema: 'versionless.run.v1',
					application: 'hand-helped',
					lineage: 'react',
					outcome: 'proceeded',
					/** A count the run states about itself is not the one read. */
					interventions: { count: 0 },
				})}\n`,
			);
			await writeFile(
				path.join(directory, 'intervention-count.json'),
				`${JSON.stringify({
					schemaVersion: 'versionless.intervention-count.v1',
					interventionCount: 1,
				})}\n`,
			);
			const records = await readRunRecords(checkout);
			expect(records[0]?.interventions?.count).toBe(1);
			const row = applyInterventionRule(records[0] as CoverageRunRecord);
			expect(row.status).toBe('not-admitted');
			expect(row.statusReason).toBe(INTERVENTION_COUNT_NOT_ZERO);
		} finally {
			await rm(checkout, { recursive: true, force: true });
		}
	});

	it('refuses to record a run proven when a stage in it did not run', () => {
		/**
		 * The laundering shape, synthesised: a run that proceeded, a harness
		 * count of zero, and a stage table that says the install never ran. The
		 * harness itself calls this `defect:stages-not-all-run` and the corpus
		 * admission path refuses it; this reader used to count it proven.
		 */
		const partial = applyInterventionRule(
			runRecord({
				interventions: { count: 0 },
				stages: Object.freeze([
					...allNineRan.slice(0, 6),
					Object.freeze({ name: 'install', status: 'not-run' }),
					Object.freeze({ name: 'build', status: 'not-run' }),
					Object.freeze({ name: 'witness', status: 'not-run' }),
				]),
			}),
		);
		expect(partial.status).toBe('not-admitted');
		expect(partial.statusReason).toBe(STAGES_NOT_ALL_RAN);
		expect(partial.interventionCount).toBe(0);
	});

	it('refuses to record a run proven when it states no stages at all', () => {
		const silent = applyInterventionRule(
			runRecord({ interventions: { count: 0 }, stages: undefined }),
		);
		expect(silent.status).toBe('not-admitted');
		expect(silent.statusReason).toBe(STAGES_NOT_ALL_RAN);
	});

	it('carries a refusing run by its own code rather than by the rule', () => {
		const refused = applyInterventionRule(
			runRecord({
				outcome: 'refused',
				refusal: { code: 'install.policy-not-declared' },
			}),
		);
		expect(refused.status).toBe('refused');
		expect(refused.refusalCode).toBe('install.policy-not-declared');
	});

	it('leaves the sealed cells proven when an unmeasured run record is added', async () => {
		const matrix = await publishedMatrix();
		const census = JSON.parse(
			await readFile(
				path.join(root, 'evidence/runs/operator-flows/refusal-census.json'),
				'utf8',
			),
		) as Record<string, unknown>;
		const report = buildCoverageReport({
			matrix,
			capabilityCoverage: buildCapabilityCoverage(),
			refusalCensus: census,
			runRecords: [runRecord()],
		});
		const sealedProven = report.applications.filter(
			(row) => row.provenanceOfStatus === 'sealed-receipts' && row.status === 'proven',
		);
		expect(sealedProven).toHaveLength(10);
		expect(report.totals.proven).toBe(10);
		expect(
			report.applications.filter((row) => row.provenanceOfStatus === 'run-record'),
		).toEqual([
			expect.objectContaining({
				status: 'not-admitted',
				statusReason: INTERVENTION_COUNT_NOT_ASSERTED,
			}),
		]);
		expect(report.interventionRule.applied).toBe(true);
		expect(() => renderCoverageReport(report)).not.toThrow();
	});
});
