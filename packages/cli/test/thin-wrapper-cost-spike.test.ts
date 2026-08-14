import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';

/**
 * SPIKE C (`nts-t004/spike-c-thin-wrapper-cost`) measured the per-application
 * cost of taking a never-completed application through the frozen React
 * adapter. It stopped before the migrated build, and these assertions exist so
 * that the record cannot later be read as if it had not.
 */

const EVIDENCE_DIRECTORY = 'evidence/spikes/thin-wrapper-cost';
const VERDICT_FILE = 'verdict.json';
const README_FILE = 'README.md';
const VERDICT_SCHEMA = 'versionless.spike.thin-wrapper-cost.verdict.v1';

type StageRecord = {
	readonly stage: string;
	readonly application: string;
	readonly machineSeconds: number;
	readonly operatorSeconds: number;
	readonly outcome: string;
	readonly newTypeScriptLines: number;
};

type VerdictRecord = {
	readonly schemaVersion: string;
	readonly unit: string;
	readonly licensePreScreen: {
		readonly results: readonly {
			readonly application: string;
			readonly licenseSha256: string;
			readonly gate: string;
		}[];
	};
	readonly stageLedger: {
		readonly clockRule: string;
		readonly stages: readonly StageRecord[];
		readonly totals: {
			readonly machineSeconds: number;
			readonly operatorSeconds: number;
			readonly newTypeScriptLines: number;
			readonly buildsCompleted: number;
			readonly witnessPassesRun: number;
		};
	};
	readonly perAppReceiptsModule: { readonly required: string };
	readonly capabilityFirings: { readonly observed: readonly string[] };
	readonly findings: readonly { readonly id: string; readonly status: string }[];
	readonly verdict: {
		readonly threeUnitsCredible: boolean;
		readonly outcome: string;
		readonly statement: string;
		readonly whatRemainsManual: readonly string[];
	};
	readonly notEstablished: readonly string[];
};

const readVerdict = async (): Promise<VerdictRecord> =>
	JSON.parse(
		await readFile(path.join(EVIDENCE_DIRECTORY, VERDICT_FILE), 'utf8'),
	) as VerdictRecord;

describe('thin-wrapper cost spike — the emitted verdict', () => {
	it('carries a stage ledger that separates machine time from operator time', async () => {
		const verdict = await readVerdict();
		expect(verdict.schemaVersion).toBe(VERDICT_SCHEMA);
		expect(verdict.unit).toBe('nts-t004/spike-c-thin-wrapper-cost');
		expect(verdict.stageLedger.stages.length).toBeGreaterThanOrEqual(5);
		expect(verdict.stageLedger.clockRule).toContain('never folded into machine time');
		for (const stage of verdict.stageLedger.stages) {
			expect(stage.machineSeconds).toBeGreaterThanOrEqual(0);
			expect(stage.operatorSeconds).toBeGreaterThanOrEqual(0);
			expect(stage.outcome.length).toBeGreaterThan(0);
			expect(stage.newTypeScriptLines).toBeGreaterThanOrEqual(0);
		}
	});

	it('screens both candidates for license text at the pin before anything else', async () => {
		const verdict = await readVerdict();
		expect(verdict.licensePreScreen.results.length).toBe(2);
		for (const result of verdict.licensePreScreen.results) {
			expect(result.gate).toBe('pass');
			expect(result.licenseSha256).toHaveLength(64);
		}
	});

	it('does not report a witness pass, a build, or a capability it never ran', async () => {
		const verdict = await readVerdict();
		const totals = verdict.stageLedger.totals;
		expect(totals.buildsCompleted).toBe(0);
		expect(totals.witnessPassesRun).toBe(0);
		expect(totals.newTypeScriptLines).toBe(0);
		expect(verdict.capabilityFirings.observed).toEqual([]);
		expect(verdict.perAppReceiptsModule.required).toBe('not established');
	});

	it('states the ~3u reading as unreached rather than refuted, and names what stays manual', async () => {
		const verdict = await readVerdict();
		expect(verdict.verdict.threeUnitsCredible).toBe(false);
		expect(verdict.verdict.outcome.startsWith('bounded')).toBe(true);
		expect(verdict.verdict.statement).toContain('not established');
		expect(verdict.verdict.whatRemainsManual.length).toBeGreaterThanOrEqual(4);
		expect(verdict.notEstablished.length).toBeGreaterThanOrEqual(5);
	});

	it('records every wall it hit as a named gap rather than a repair', async () => {
		const verdict = await readVerdict();
		expect(verdict.findings.length).toBeGreaterThanOrEqual(3);
		for (const finding of verdict.findings) {
			expect(finding.id.length).toBeGreaterThan(0);
			expect(finding.status).toContain('named gap');
		}
	});
});

describe('thin-wrapper cost spike — the human rendering', () => {
	it('quotes the two refusal strings the machine record carries', async () => {
		const rendered = await readFile(path.join(EVIDENCE_DIRECTORY, README_FILE), 'utf8');
		expect(rendered).toContain(
			'this tree declares neither react-scripts nor a Vite configuration',
		);
		expect(rendered).toContain('OS X Unsupported architecture (arm64)');
		expect(rendered).toContain('0 builds, 0 witness passes, 0 new TypeScript lines');
	});
});
