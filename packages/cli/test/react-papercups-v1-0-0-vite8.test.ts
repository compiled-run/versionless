import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import {
	applicationNamedProductSymbols,
	readPapercupsBuildProfile,
	verifyPapercupsBuildProfile,
} from '../src/fixture/react-papercups-v1-0-0-vite8.ts';

describe('papercups create-react-app to Vite 8 build profile', () => {
	test('verifies deterministic baseline and target builds', async () => {
		const result = await verifyPapercupsBuildProfile();
		expect(result.result).toBe('pass');
		expect(result.baselineDeterministic).toBe(true);
		expect(result.targetDeterministic).toBe(true);
		expect(result.applicationNamedProductSymbols).toEqual([]);
	});
	test('records the consented acquisition and keeps browser gates unproven', async () => {
		const profile = (await readPapercupsBuildProfile()) as unknown as {
			dependencyAcquisition: {
				consentId: string;
				mode: string;
				registryHosts: readonly string[];
				lockfile: { matchesFixture: boolean; lockfileVersion: number };
				lifecycleScripts: string;
			};
			builds: { baseline: { bundler: string }; target: { bundler: string; webpackExecuted: boolean } };
			parity: { runtimeEquivalence: string };
		};
		expect(profile.dependencyAcquisition.consentId).toBe('VL-LEGACY-CORPUS-2026-08-10');
		expect(profile.dependencyAcquisition.mode).toBe('consented');
		expect(profile.dependencyAcquisition.registryHosts).toContain('registry.npmjs.org');
		expect(profile.dependencyAcquisition.lockfile.matchesFixture).toBe(true);
		expect(profile.dependencyAcquisition.lockfile.lockfileVersion).toBe(1);
		expect(profile.dependencyAcquisition.lifecycleScripts).toBe('disabled');
		expect(profile.builds.baseline.bundler).toContain('webpack-4.42.0');
		expect(profile.builds.target.bundler).toBe('vite-8.0.16');
		expect(profile.builds.target.webpackExecuted).toBe(false);
		expect(profile.parity.runtimeEquivalence).toBe('unknown');
	});
	test('the run receipt keeps every browser gate unproven', async () => {
		const receipt = JSON.parse(
			await readFile('evidence/runs/react-papercups-v1-0-0/t004-run.json', 'utf8'),
		) as { verification: Record<string, unknown>; migration: { applicationNamedProductBranches: number } };
		expect(receipt.verification.journeys).toBe('not-run');
		expect(receipt.verification.mutation).toBe('not-run');
		expect(receipt.verification.locality).toBe('not-run');
		expect(receipt.verification.serviceWorker).toBe('not-tested');
		expect(receipt.migration.applicationNamedProductBranches).toBe(0);
	});
	test('detects an application name leaking into the reusable React surface', async () => {
		expect(await applicationNamedProductSymbols('createCraViteAdapter')).toContain(
			'react-cra-vite-adapter.ts',
		);
	});
});
