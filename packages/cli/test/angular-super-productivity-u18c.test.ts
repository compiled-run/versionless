import { describe, expect, it } from 'vitest';
import {
	buildRecord,
	DIAGNOSTIC_COUNTS,
	REMAINING_DEMANDS,
	UNIT,
} from '../src/fixture/angular-super-productivity-u18c-record.ts';
import { DIAGNOSTIC_COUNTS as BEFORE } from '../src/fixture/angular-super-productivity-migrated-lane-run.ts';
import { verifySealedRecord } from '../src/fixture/angular-factoriolab-build-lanes-run.ts';

describe('super-productivity u18c capability round', () => {
	it('seals a record that verifies, under this unit', () => {
		const record = verifySealedRecord(buildRecord());
		expect(record['unit']).toBe(UNIT);
		expect(record['result']).toBe('capabilities-fired-build-red-itemised');
	});

	it('records a red build and claims no artifact', () => {
		const build = buildRecord()['build'] as Readonly<Record<string, unknown>>;
		expect(build['exitStatus']).toBe(1);
		expect(build['artifactsEmitted']).toBe(0);
	});

	it('reports the census after against the census the previous lane recorded', () => {
		const total = (counts: Readonly<Record<string, number>>): number =>
			Object.values(counts).reduce((sum, count) => sum + count, 0);
		const build = buildRecord()['build'] as Readonly<Record<string, unknown>>;
		expect(build['diagnosticCountsBefore']).toBe(BEFORE);
		expect(build['diagnosticTotalBefore']).toBe(total(BEFORE));
		expect(build['diagnosticTotal']).toBe(total(DIAGNOSTIC_COUNTS));
		expect(total(DIAGNOSTIC_COUNTS)).toBeLessThan(total(BEFORE));
	});

	it('states every remaining demand as a transform rather than a fix', () => {
		expect(REMAINING_DEMANDS.length).toBeGreaterThan(0);
		for (const demand of REMAINING_DEMANDS) {
			expect(demand.file).not.toBe('');
			expect(demand.observed.length).toBeGreaterThan(20);
			expect(demand.neededTransform.length).toBeGreaterThan(60);
		}
	});

	it('does not claim a family cleared that the census still counts', () => {
		const build = buildRecord()['build'] as Readonly<Record<string, unknown>>;
		const cleared = build['cleared'] as Readonly<Record<string, string>>;
		for (const [code, movement] of Object.entries(cleared)) {
			const after = movement.split('→')[1]?.trim().split(' ')[0] ?? '';
			expect(Number.parseInt(after, 10), code).toBe(DIAGNOSTIC_COUNTS[code] ?? 0);
		}
	});
});
