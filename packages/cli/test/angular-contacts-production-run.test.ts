import { describe, expect, test } from 'vitest';
import {
	angularContactsProductionRunPlan,
	verifyAngularContactsRunPreconditions,
} from '../src/fixture/angular-contacts-production-run.ts';

describe('Angular Contacts production run', () => {
	test('pins the honest compatibility baseline, sequential AOT, browser-esbuild and Witness matrix', () => {
		const plan = angularContactsProductionRunPlan();
		expect(plan.baseline).toMatchObject({
			node: '16.20.2',
			architecture: 'darwin-arm64',
			angular: '9.0.0',
			builder: 'webpack',
			aotBuilds: 2,
			compatibilityLabel: 'native-arm64-node16-not-original-node12-reproduction',
		});
		expect(plan.migration.sequentialMajors).toEqual([9, 10, 11, 12, 13, 14, 15, 16]);
		expect(plan.target).toMatchObject({
			node: '18.20.8',
			angular: '16.2.12',
			builder: 'browser-esbuild',
			aotBuilds: 2,
		});
		expect(plan.journeys).toMatchObject({
			directWitnessModule: 'link:../witness',
			runsPerLane: 2,
			observations: 8,
		});
	});
	test('requires dual offline controls before reading an accepted closure', async () => {
		await expect(
			verifyAngularContactsRunPreconditions({
				VERSIONLESS_NETWORK_MODE: undefined,
				NPM_CONFIG_OFFLINE: undefined,
			}),
		).rejects.toThrow('dual offline');
	});
});
