import { afterEach, describe, expect, it } from 'vitest';
import {
	KUBERNETES_DASHBOARD_CONSENT,
	parseKubernetesDashboardLauncher,
	parseKubernetesDashboardStableVersion,
	selectKubernetesDashboardCandidate,
} from '../src/fixture/angular-kubernetes-dashboard-ingest.ts';

const originalMode = process.env.VERSIONLESS_NETWORK_MODE;
const originalConsent = process.env.VERSIONLESS_CONSENT_ID;

afterEach(() => {
	if (originalMode === undefined) delete process.env.VERSIONLESS_NETWORK_MODE;
	else process.env.VERSIONLESS_NETWORK_MODE = originalMode;
	if (originalConsent === undefined) delete process.env.VERSIONLESS_CONSENT_ID;
	else process.env.VERSIONLESS_CONSENT_ID = originalConsent;
});

describe('Kubernetes Dashboard T678 immutable ingestion', () => {
	it('accepts only stable 2.x SemVer tag refs', () => {
		expect(parseKubernetesDashboardStableVersion('refs/tags/v2.7.0')).toEqual([2, 7, 0]);
		expect(parseKubernetesDashboardStableVersion('refs/tags/2.6.1')).toEqual([2, 6, 1]);
		expect(parseKubernetesDashboardStableVersion('refs/tags/v3.0.0')).toBeNull();
		expect(parseKubernetesDashboardStableVersion('refs/tags/v2.0.0-rc.1')).toBeNull();
		expect(parseKubernetesDashboardStableVersion('refs/tags/release-2.0.0')).toBeNull();
	});

	it('selects greatest stable SemVer then bytewise-smallest ref', () => {
		const shared = {
			commit: 'a'.repeat(40),
			tree: 'b'.repeat(40),
			commitDate: '2021-01-01T00:00:00Z',
		};
		expect(
			selectKubernetesDashboardCandidate([
				{ ...shared, ref: 'refs/tags/v2.5.0', version: [2, 5, 0] },
				{ ...shared, ref: 'refs/tags/2.6.0', version: [2, 6, 0] },
				{ ...shared, ref: 'refs/tags/v2.6.0', version: [2, 6, 0] },
			]).ref,
		).toBe('refs/tags/2.6.0');
	});

	it('requires literal T678 consent and namespace', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = KUBERNETES_DASHBOARD_CONSENT;
		expect(
			parseKubernetesDashboardLauncher([
				'--consent-id',
				KUBERNETES_DASHBOARD_CONSENT,
				'--namespace',
				't678',
			]),
		).toEqual({ mode: 'acquire', namespace: 't678' });
	});

	it('allows offline replay only without consent environment', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'offline';
		delete process.env.VERSIONLESS_CONSENT_ID;
		expect(
			parseKubernetesDashboardLauncher(['--verify-offline', '--namespace', 't678']),
		).toEqual({ mode: 'verify', namespace: 't678' });
	});
});
