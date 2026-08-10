import { afterEach, describe, expect, test } from 'vitest';
import {
	fuxaProductionRunPlan,
	verifyFuxaProductionRunPreconditions,
} from '../src/fixture/angular-fuxa-production-run.ts';

afterEach(() => {
	delete process.env.VERSIONLESS_NETWORK_MODE;
	delete process.env.NPM_CONFIG_OFFLINE;
});

describe('FUXA production run plan', () => {
	test('pins authentic AOT/browser and browser-esbuild lanes with two direct journeys twice', () => {
		const plan = fuxaProductionRunPlan();
		expect(plan.lanes).toEqual([
			expect.objectContaining({
				name: 'angular14-node16',
				node: '16.20.2',
				angular: '14',
				builder: 'browser',
				configuration: 'demo',
				aot: true,
				journeyRuns: 2,
			}),
			expect.objectContaining({
				name: 'angular16-node18',
				node: '18.20.8',
				angular: '16',
				builder: 'browser-esbuild',
				configuration: 'demo',
				aot: true,
				journeyRuns: 2,
			}),
		]);
		expect(plan.migration.sequential).toEqual([14, 15, 16]);
		expect(plan.boundary).toMatchObject({
			unresolvedLicenses: 'unknown',
			legalReviewRequired: true,
			redistributionAuthorized: false,
		});
	});

	test('requires dual offline controls and binds the published dependency boundary', async () => {
		await expect(verifyFuxaProductionRunPreconditions()).rejects.toThrow('dual offline');
		process.env.VERSIONLESS_NETWORK_MODE = 'offline';
		process.env.NPM_CONFIG_OFFLINE = 'true';
		await expect(verifyFuxaProductionRunPreconditions()).resolves.toMatchObject({
			dependencyDigest: expect.any(String),
			planDigest: expect.any(String),
		});
	});
});
