import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import { assertEnterpriseSurfaceHonesty } from '../../trust/src/enterprise.ts';
import {
	EVIDENCE_DIRECTORY,
	FLEET,
	PRUNE_SAFETY_FILE,
	PRUNE_SAFETY_SCHEMA,
	README_FILE,
	REPETITIONS,
	SUMMARY_FILE,
	SUMMARY_SCHEMA,
	UNIT,
	type AppMeasurement,
	type FleetSummary,
	type PruneSafetyRecord,
} from '../src/fixture/fleet-batch-spike-run.ts';

const readJson = async <T>(file: string): Promise<T> =>
	JSON.parse(await readFile(path.join(EVIDENCE_DIRECTORY, file), 'utf8')) as T;

describe('fleet batch dry run — the emitted fleet summary', () => {
	it('measures at least six already-ingested applications across both lineages', async () => {
		const summary = await readJson<FleetSummary>(SUMMARY_FILE);
		expect(summary.schemaVersion).toBe(SUMMARY_SCHEMA);
		expect(summary.unit).toBe(UNIT);
		expect(summary.apps.length).toBeGreaterThanOrEqual(6);
		expect(summary.apps.length).toBe(FLEET.length);
		expect(summary.apps.filter((app) => app.lineage === 'react').length).toBeGreaterThan(0);
		expect(summary.apps.filter((app) => app.lineage === 'angular').length).toBeGreaterThan(0);
		/** Every measured root is one the fleet declares; nothing was measured off-list. */
		const declared = new Set(FLEET.map((application) => application.appRoot));
		for (const app of summary.apps) expect(declared.has(app.appRoot)).toBe(true);
	});

	it('times every stage on its own and never sums a nested stage into a pipeline cost', async () => {
		const summary = await readJson<FleetSummary>(SUMMARY_FILE);
		for (const app of summary.apps) {
			expect(app.stages.map((stage) => stage.stage)).toEqual(['analyze', 'plan', 'migrate']);
			const analyze = app.stages[0] as AppMeasurement['stages'][number];
			expect(analyze.runs.length).toBe(REPETITIONS);
			for (const stage of app.stages) {
				for (const run of stage.runs) expect(run).toBeGreaterThan(0);
				/** A refused stage carries the refusal string rather than a silent zero. */
				if (stage.outcome === 'refused') expect(stage.refusal).not.toBeNull();
				if (stage.runs.length > 0) expect(stage.bestMs).toBeLessThanOrEqual(stage.medianMs);
			}
			const deepest = app.stages.find((stage) => stage.stage === app.pipelineBasis);
			expect(deepest?.medianMs).toBe(app.pipelineMedianMs);
		}
	});

	it('projects to the fleet size from the measured per-application cost', async () => {
		const summary = await readJson<FleetSummary>(SUMMARY_FILE);
		expect(summary.extrapolation.fleetSize).toBe(300);
		expect(summary.extrapolation.rows.length).toBeGreaterThan(0);
		for (const row of summary.extrapolation.rows)
			expect(row.serialSecondsAt300).toBeCloseTo((row.perApplicationMeanMs * 300) / 1000, 2);
		/** The witness stage may never be published as parallelizable. */
		const witness = summary.parallelism.find((entry) => entry.stage.includes('witness'));
		expect(witness?.classification).toContain('witness-serialized');
		expect(summary.notEstablished.length).toBeGreaterThan(0);
	});
});

describe('fleet batch dry run — the prune-safety proof', () => {
	it('records a verdict taken from three verifications and a restored directory', async () => {
		const prune = await readJson<PruneSafetyRecord>(PRUNE_SAFETY_FILE);
		expect(prune.schemaVersion).toBe(PRUNE_SAFETY_SCHEMA);
		expect(prune.restored).toBe(true);
		expect(prune.workDirectoryEntriesAfterRestore).toEqual(prune.workDirectoryEntriesBefore);
		expect(['yes', 'no']).toContain(prune.verdict);
		const verifications = prune.verifications as Record<string, Record<string, unknown>>;
		for (const key of ['before', 'withWorkDirectorySetAside', 'afterRestore'])
			expect(verifications[key]).toBeDefined();
		if (prune.verdict === 'yes') {
			expect(verifications.withWorkDirectorySetAside?.state).toBe('pass');
			expect(verifications.withWorkDirectorySetAside?.workDirectoryAbsentDuringVerification).toBe(
				true,
			);
			expect(verifications.withWorkDirectorySetAside?.digest).toBe(
				verifications.before?.digest,
			);
		}
	});

	it('is the verdict the fleet summary quotes', async () => {
		const summary = await readJson<FleetSummary>(SUMMARY_FILE);
		const prune = await readJson<PruneSafetyRecord>(PRUNE_SAFETY_FILE);
		expect(summary.pruneSafety.verdict).toBe(prune.verdict);
		expect(summary.pruneSafety.statement).toBe(prune.verdictStatement);
	});
});

describe('fleet batch dry run — the human rendering', () => {
	it('passes the enterprise surface honesty guard as written to disk', async () => {
		const rendered = await readFile(path.join(EVIDENCE_DIRECTORY, README_FILE), 'utf8');
		expect(() => {
			assertEnterpriseSurfaceHonesty(rendered, 'evidence/spikes/fleet-batch-dryrun/README.md');
		}).not.toThrow();
	});

	it('quotes every refusal string the record carries', async () => {
		const summary = await readJson<FleetSummary>(SUMMARY_FILE);
		const rendered = await readFile(path.join(EVIDENCE_DIRECTORY, README_FILE), 'utf8');
		for (const refusal of summary.totals.refusalStrings) expect(rendered).toContain(refusal);
		expect(rendered).toContain(summary.extrapolation.readingRule);
		for (const entry of summary.notEstablished) expect(rendered).toContain(entry);
	});
});
