import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import * as path from 'pathe';
import {
	ANSWERED_BEFORE_BUILD,
	BUILD_DEMANDS,
	DIAGNOSTIC_COUNTS,
	FORK_PROVENANCE,
	MIGRATED_LANE_FILE,
	buildMigratedLaneRecord,
} from '../src/fixture/angular-super-productivity-migrated-lane-run.ts';
import { EVIDENCE_DIRECTORY } from '../src/fixture/angular-super-productivity-lanes-run.ts';
import {
	ANGULAR_16_ECOSYSTEM_PACKAGES,
	REMOVED_BUILDER_OPTIONS,
	alignAngularPackageManifest,
	ANGULAR_16_BROWSER_CELL,
} from '../../frameworks/angular/src/index.ts';

async function readRecord(file: string): Promise<Record<string, unknown>> {
	return JSON.parse(await readFile(path.join(EVIDENCE_DIRECTORY, file), 'utf8')) as Record<
		string,
		unknown
	>;
}

const input = {
	nodeVersion: 'v16.20.2',
	npmVersion: '8.19.4',
	installedPackages: 2242,
	manifestSha256: 'a'.repeat(64),
	lockfileSha256: 'b'.repeat(64),
	buildExitStatus: 1,
	diagnosticCounts: DIAGNOSTIC_COUNTS,
	artifactsEmitted: 0,
} as const;

describe('super-productivity migrated lane record', () => {
	it('records a red build as red and claims no artifact', () => {
		const record = buildMigratedLaneRecord(input);
		expect(record['result']).toBe('closure-resolved-build-red-itemised');
		const build = record['build'] as Record<string, unknown>;
		expect(build['exitStatus']).toBe(1);
		expect(build['artifactsEmitted']).toBe(0);
	});

	it('states every demand as file, symbol, library, quoted diagnostic and transform', () => {
		expect(BUILD_DEMANDS.length).toBeGreaterThan(4);
		for (const demand of [...BUILD_DEMANDS, ...ANSWERED_BEFORE_BUILD]) {
			expect(demand.file).not.toBe('');
			expect(demand.symbol).not.toBe('');
			expect(demand.library).not.toBe('');
			expect(demand.observed.length).toBeGreaterThan(40);
			expect(demand.neededTransform.length).toBeGreaterThan(120);
		}
	});

	it('carries no parity or determinism claim, because a red build emits nothing to compare', () => {
		const record = buildMigratedLaneRecord(input);
		expect(record['parity']).toBeUndefined();
		expect(record['byteStable']).toBeUndefined();
		const notEstablished = record['notEstablished'] as readonly string[];
		expect(notEstablished.some((line) => line.includes('random()'))).toBe(true);
		expect(notEstablished.some((line) => line.includes('parity'))).toBe(true);
	});

	it('verifies the fork lineage from both repositories rather than from the package name', () => {
		expect(FORK_PROVENANCE.eraRepository).toContain('DanielYKPan/date-time-picker');
		expect(FORK_PROVENANCE.lineage).toContain('fork: true');
		expect(FORK_PROVENANCE.lineage).toContain('DanielYKPan/date-time-picker');
		expect(FORK_PROVENANCE.surfaceMeasurement).toContain('OwlDateTimeModule');
		expect(FORK_PROVENANCE.notEstablished).toContain('behavioural equivalence');
	});

	it('was written from the record the driver emitted', async () => {
		const record = await readRecord(MIGRATED_LANE_FILE);
		expect(record['unit']).toBe('lrapr-t006/u18b-super-productivity-migrated-lane');
		expect(record['result']).toBe('closure-resolved-build-red-itemised');
		expect((record['demands'] as readonly unknown[]).length).toBe(BUILD_DEMANDS.length);
	});
});

describe('the cell dispositions this lane discovered', () => {
	it('reads jasmine-marbles and chart.js as community packages of the Angular 16 cell', () => {
		const marbles = ANGULAR_16_ECOSYSTEM_PACKAGES['jasmine-marbles'];
		const chart = ANGULAR_16_ECOSYSTEM_PACKAGES['chart.js'];
		expect(marbles?.kind).toBe('aligned');
		expect(chart?.kind).toBe('aligned');
		expect(marbles?.fact).toContain('rxjs');
		expect(chart?.fact).toContain('ng2-charts');
	});

	it('writes those ranges into any manifest that declares the era ones', () => {
		const aligned = alignAngularPackageManifest(
			{ devDependencies: { 'jasmine-marbles': '^0.5.0', 'chart.js': '^2.8.0' } },
			ANGULAR_16_BROWSER_CELL,
		);
		const devDependencies = aligned.manifest['devDependencies'] as Record<string, string>;
		expect(devDependencies['jasmine-marbles']).toBe('^0.9.2');
		expect(devDependencies['chart.js']).toBe('^4.5.1');
		expect(aligned.unhandled).toEqual([]);
	});

	it('rejects the era source-map booleans the 16.2 builder schema refuses', () => {
		expect(REMOVED_BUILDER_OPTIONS).toContain('evalSourceMap');
		expect(REMOVED_BUILDER_OPTIONS).toContain('vendorSourceMap');
	});
});
