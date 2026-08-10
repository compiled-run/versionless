import { afterEach, describe, expect, it } from 'vitest';
import {
	OPENMF_CONSENT,
	parseOpenMfLauncher,
	parseOpenMfStableVersion,
	selectOpenMfCandidate,
} from '../src/fixture/angular-openmf-web-app-ingest.ts';

const originalMode = process.env.VERSIONLESS_NETWORK_MODE;
const originalConsent = process.env.VERSIONLESS_CONSENT_ID;

afterEach(() => {
	if (originalMode === undefined) delete process.env.VERSIONLESS_NETWORK_MODE;
	else process.env.VERSIONLESS_NETWORK_MODE = originalMode;
	if (originalConsent === undefined) delete process.env.VERSIONLESS_CONSENT_ID;
	else process.env.VERSIONLESS_CONSENT_ID = originalConsent;
});

describe('openMF web-app T673 immutable ingestion', () => {
	it('accepts only stable SemVer names with an optional v prefix', () => {
		expect(parseOpenMfStableVersion('refs/tags/v1.2.3')).toEqual([1, 2, 3]);
		expect(parseOpenMfStableVersion('refs/tags/2.0.0')).toEqual([2, 0, 0]);
		expect(parseOpenMfStableVersion('refs/tags/v2.0.0-rc.1')).toBeNull();
		expect(parseOpenMfStableVersion('refs/tags/release-2.0.0')).toBeNull();
	});

	it('selects greatest SemVer then the bytewise-smallest exact ref', () => {
		const shared = {
			commit: 'a'.repeat(40),
			tree: 'b'.repeat(40),
			commitDate: '2021-01-01T00:00:00Z',
		};
		expect(
			selectOpenMfCandidate([
				{ ...shared, ref: 'refs/tags/v1.5.0', version: [1, 5, 0] },
				{ ...shared, ref: 'refs/tags/1.6.0', version: [1, 6, 0] },
				{ ...shared, ref: 'refs/tags/v1.6.0', version: [1, 6, 0] },
			]).ref,
		).toBe('refs/tags/1.6.0');
	});

	it('requires the literal consent and t673 namespace', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = OPENMF_CONSENT;
		expect(
			parseOpenMfLauncher(['--consent-id', OPENMF_CONSENT, '--namespace', 't673']),
		).toEqual({ mode: 'acquire', namespace: 't673' });
		expect(() =>
			parseOpenMfLauncher(['--consent-id', OPENMF_CONSENT, '--namespace', 't670']),
		).toThrow('namespace');
	});

	it('allows offline replay only without the consent environment', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'offline';
		delete process.env.VERSIONLESS_CONSENT_ID;
		expect(parseOpenMfLauncher(['--verify-offline', '--namespace', 't673'])).toEqual({
			mode: 'verify',
			namespace: 't673',
		});
	});
});
