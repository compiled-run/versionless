import { afterEach, describe, expect, it } from 'vitest';
import {
	APISIX_DASHBOARD_CONSENT,
	discoverApisixDashboardApplicationPackage,
	parseApisixDashboardJsonc,
	parseApisixDashboardLauncher,
	parseApisixDashboardStableVersion,
	selectApisixDashboardCandidate,
} from '../src/fixture/react-apisix-dashboard-ingest.ts';

const originalMode = process.env.VERSIONLESS_NETWORK_MODE;
const originalConsent = process.env.VERSIONLESS_CONSENT_ID;
afterEach(() => {
	if (originalMode === undefined) delete process.env.VERSIONLESS_NETWORK_MODE;
	else process.env.VERSIONLESS_NETWORK_MODE = originalMode;
	if (originalConsent === undefined) delete process.env.VERSIONLESS_CONSENT_ID;
	else process.env.VERSIONLESS_CONSENT_ID = originalConsent;
});

describe('ApisixDashboard T684 immutable ingest', () => {
	it('accepts BOM, comments, and trailing commas without weakening JSON', () => {
		expect(
			parseApisixDashboardJsonc(
				'\uFEFF{/*x*/"name":"ui",// y\n"items":[1,],}',
				'ui/package.json',
			),
		).toEqual({ name: 'ui', items: [1] });
	});
	it('rejects duplicate keys and invalid JSONC with a relative path class', () => {
		expect(() => parseApisixDashboardJsonc('{"name":1,"name":2}', 'ui/package.json')).toThrow(
			'ui/package.json',
		);
		expect(() => parseApisixDashboardJsonc('{"name":Infinity}', 'ui/package.json')).toThrow(
			'invalid-jsonc',
		);
	});
	it('accepts only stable v4 refs', () => {
		expect(parseApisixDashboardStableVersion('refs/tags/v4.12.0')).toEqual([4, 12, 0]);
		expect(parseApisixDashboardStableVersion('refs/tags/4.9.2')).toEqual([4, 9, 2]);
		expect(parseApisixDashboardStableVersion('refs/tags/v5.0.0')).toBeNull();
		expect(parseApisixDashboardStableVersion('refs/tags/v4.12.0-rc.1')).toBeNull();
	});
	it('selects greatest SemVer and bytewise ref', () => {
		const common = {
			commit: 'a'.repeat(40),
			tree: 'b'.repeat(40),
			commitDate: '2021-01-01T00:00:00Z',
		};
		expect(
			selectApisixDashboardCandidate([
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
			discoverApisixDashboardApplicationPackage([
				{
					path: 'package.json',
					name: 'apisix-dashboard',
					reactMajor: null,
					webpackMajor: null,
					...shared,
				},
				{
					path: 'packages/ui/package.json',
					name: '@apisix-dashboard/ui',
					reactMajor: 16,
					webpackMajor: 4,
					...shared,
				},
			]).path,
		).toBe('packages/ui/package.json');
	});
	it('rejects equally qualified nested applications', () => {
		const shared = {
			name: '@apisix-dashboard/ui',
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
			discoverApisixDashboardApplicationPackage([
				{ path: 'a/package.json', ...shared },
				{ path: 'b/package.json', ...shared },
			]),
		).toThrow('ambiguous');
	});
	it('requires fresh literal consent', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = APISIX_DASHBOARD_CONSENT;
		expect(
			parseApisixDashboardLauncher([
				'--consent-id',
				APISIX_DASHBOARD_CONSENT,
				'--namespace',
				't684',
			]),
		).toBe('acquire');
	});
	it('allows strict offline replay', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'offline';
		delete process.env.VERSIONLESS_CONSENT_ID;
		expect(parseApisixDashboardLauncher(['--verify-offline', '--namespace', 't684'])).toBe(
			'verify',
		);
	});
});
