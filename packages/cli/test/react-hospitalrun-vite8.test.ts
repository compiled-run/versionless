import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import {
	applicationNamedProductSymbols,
	eraPinViolations,
	readHospitalRunBuildProfile,
	verifyHospitalRunBuildProfile,
} from '../src/fixture/react-hospitalrun-vite8.ts';

describe('HospitalRun create-react-app to Vite 8 build profile', () => {
	test('verifies deterministic compatibility baseline and target builds', async () => {
		const result = await verifyHospitalRunBuildProfile();
		expect(result.result).toBe('pass');
		expect(result.baselineDeterministic).toBe(true);
		expect(result.targetDeterministic).toBe(true);
		expect(result.compatibilityPins).toBe(8);
		expect(result.applicationNamedProductSymbols).toEqual([]);
	});
	test('labels the baseline as a compatibility resolution rather than the upstream state', async () => {
		const profile = await readHospitalRunBuildProfile();
		const resolution = profile.dependencyAcquisition.compatibilityResolution;
		expect(profile.dependencyAcquisition.lockfile).toBe(null);
		expect(resolution.label).toContain('NOT the upstream-committed state');
		expect(resolution.cutoff).toBe('2020-11-07T10:12:53Z');
		expect(profile.gates.baselineAuthenticity).toBe('compatibility-labeled-not-authentic');
		for (const pin of resolution.pins) {
			expect(Date.parse(pin.published)).toBeLessThanOrEqual(Date.parse(resolution.cutoff));
			expect(pin.reason.length).toBeGreaterThan(0);
			expect(pin.tarballSha256).toMatch(/^[0-9a-f]{64}$/);
		}
	});
	test('rejects a pin published after the declared cutoff', () => {
		expect(
			eraPinViolations(
				[
					{
						name: '@types/example',
						version: '9.9.9',
						published: '2026-01-01T00:00:00.000Z',
						reason: 'drifted',
						tarball: 'https://registry.npmjs.org/example',
						tarballSha256: 'a'.repeat(64),
					},
				],
				'2020-11-07T10:12:53Z',
			),
		).toEqual(['@types/example@9.9.9']);
	});
	test('records the baseline-only service worker and the shared public assets', async () => {
		const profile = await readHospitalRunBuildProfile();
		expect(profile.builds.baseline.serviceWorkerOutputs).toContain('service-worker.js');
		expect(profile.builds.target.serviceWorkerOutputs).toEqual([]);
		expect(profile.parity.inventory.byteIdenticalSharedPaths).toContain('favicon.ico');
		expect(profile.parity.inventory.targetOnlyPaths.length).toBeGreaterThan(0);
		expect(profile.builds.target.bundler).toBe('vite-8.0.16');
		expect(profile.builds.baseline.bundler).toContain('webpack-4.42.0');
		expect(profile.parity.runtimeEquivalence).toBe('unknown');
	});
	test('the run receipt keeps every browser gate unproven and reports zero source edits', async () => {
		const receipt = JSON.parse(
			await readFile('evidence/runs/react-hospitalrun/t004-run.json', 'utf8'),
		) as {
			verification: Record<string, unknown>;
			migration: {
				applicationNamedProductBranches: number;
				applicationSourceEdits: number;
				reusableSurfaceChanged: boolean;
			};
			baseline: { authenticity: string };
		};
		expect(receipt.verification.journeys).toBe('not-run');
		expect(receipt.verification.mutation).toBe('not-run');
		expect(receipt.verification.locality).toBe('not-run');
		expect(receipt.verification.serviceWorker).toBe('not-tested');
		expect(receipt.migration.applicationNamedProductBranches).toBe(0);
		expect(receipt.migration.applicationSourceEdits).toBe(0);
		expect(receipt.migration.reusableSurfaceChanged).toBe(false);
		expect(receipt.baseline.authenticity).toBe('explicitly-labeled-compatibility-resolution');
	});
	test('detects an application name leaking into the reusable React surface', async () => {
		expect(await applicationNamedProductSymbols('createCraViteAdapter')).toContain(
			'react-cra-vite-adapter.ts',
		);
	});
});
