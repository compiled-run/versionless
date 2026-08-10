import { afterEach, describe, expect, it } from 'vitest';
import {
	VERDACCIO_CONSENT,
	discoverVerdaccioApplicationPackage,
	parseVerdaccioLauncher,
	parseVerdaccioStableVersion,
	selectVerdaccioCandidate,
} from '../src/fixture/react-verdaccio-ingest.ts';

const originalMode = process.env.VERSIONLESS_NETWORK_MODE;
const originalConsent = process.env.VERSIONLESS_CONSENT_ID;
afterEach(() => {
	if (originalMode === undefined) delete process.env.VERSIONLESS_NETWORK_MODE;
	else process.env.VERSIONLESS_NETWORK_MODE = originalMode;
	if (originalConsent === undefined) delete process.env.VERSIONLESS_CONSENT_ID;
	else process.env.VERSIONLESS_CONSENT_ID = originalConsent;
});

describe('Verdaccio T682 immutable ingest', () => {
	it('accepts only stable v4 refs', () => {
		expect(parseVerdaccioStableVersion('refs/tags/v4.12.0')).toEqual([4, 12, 0]);
		expect(parseVerdaccioStableVersion('refs/tags/4.9.2')).toEqual([4, 9, 2]);
		expect(parseVerdaccioStableVersion('refs/tags/v5.0.0')).toBeNull();
		expect(parseVerdaccioStableVersion('refs/tags/v4.12.0-rc.1')).toBeNull();
	});
	it('selects greatest SemVer and bytewise ref', () => {
		const common = {
			commit: 'a'.repeat(40),
			tree: 'b'.repeat(40),
			commitDate: '2021-01-01T00:00:00Z',
		};
		expect(
			selectVerdaccioCandidate([
				{ ...common, ref: 'refs/tags/v4.12.0', version: [4, 12, 0] },
				{ ...common, ref: 'refs/tags/4.13.0', version: [4, 13, 0] },
				{ ...common, ref: 'refs/tags/v4.13.0', version: [4, 13, 0] },
			]).ref,
		).toBe('refs/tags/4.13.0');
	});
	it('selects a nested authentic UI when the workspace root has no React', () => {
		const shared = {
			ownedWebpackConfigs: 1,
			browserEntry: true,
			search: true,
			detail: true,
			auth: true,
			registryApi: true,
		};
		expect(
			discoverVerdaccioApplicationPackage([
				{
					path: 'package.json',
					name: 'verdaccio',
					reactMajor: null,
					webpackMajor: null,
					...shared,
				},
				{
					path: 'packages/ui/package.json',
					name: '@verdaccio/ui',
					reactMajor: 16,
					webpackMajor: 4,
					...shared,
				},
			]).path,
		).toBe('packages/ui/package.json');
	});
	it('rejects equally qualified nested applications', () => {
		const shared = {
			name: '@verdaccio/ui',
			reactMajor: 16,
			webpackMajor: 4,
			ownedWebpackConfigs: 1,
			browserEntry: true,
			search: true,
			detail: true,
			auth: true,
			registryApi: true,
		};
		expect(() =>
			discoverVerdaccioApplicationPackage([
				{ path: 'a/package.json', ...shared },
				{ path: 'b/package.json', ...shared },
			]),
		).toThrow('ambiguous');
	});
	it('requires fresh literal consent', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = VERDACCIO_CONSENT;
		expect(
			parseVerdaccioLauncher(['--consent-id', VERDACCIO_CONSENT, '--namespace', 't682']),
		).toBe('acquire');
	});
	it('allows strict offline replay', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'offline';
		delete process.env.VERSIONLESS_CONSENT_ID;
		expect(parseVerdaccioLauncher(['--verify-offline', '--namespace', 't682'])).toBe('verify');
	});
});
