import { afterEach, describe, expect, it } from 'vitest';
import {
	JAEGER_UI_CONSENT,
	parseJaegerUiLauncher,
	parseJaegerUiStableVersion,
	selectJaegerUiCandidate,
} from '../src/fixture/react-jaeger-ui-ingest.ts';

const originalMode = process.env.VERSIONLESS_NETWORK_MODE;
const originalConsent = process.env.VERSIONLESS_CONSENT_ID;
afterEach(() => {
	if (originalMode === undefined) delete process.env.VERSIONLESS_NETWORK_MODE;
	else process.env.VERSIONLESS_NETWORK_MODE = originalMode;
	if (originalConsent === undefined) delete process.env.VERSIONLESS_CONSENT_ID;
	else process.env.VERSIONLESS_CONSENT_ID = originalConsent;
});

describe('Jaeger UI T680 immutable ingest', () => {
	it('accepts only stable v1 refs', () => {
		expect(parseJaegerUiStableVersion('refs/tags/v1.20.0')).toEqual([1, 20, 0]);
		expect(parseJaegerUiStableVersion('refs/tags/1.19.2')).toEqual([1, 19, 2]);
		expect(parseJaegerUiStableVersion('refs/tags/v2.0.0')).toBeNull();
		expect(parseJaegerUiStableVersion('refs/tags/v1.20.0-rc.1')).toBeNull();
	});
	it('selects greatest SemVer and bytewise ref', () => {
		const common = {
			commit: 'a'.repeat(40),
			tree: 'b'.repeat(40),
			commitDate: '2021-01-01T00:00:00Z',
		};
		expect(
			selectJaegerUiCandidate([
				{ ...common, ref: 'refs/tags/v1.20.0', version: [1, 20, 0] },
				{ ...common, ref: 'refs/tags/1.21.0', version: [1, 21, 0] },
				{ ...common, ref: 'refs/tags/v1.21.0', version: [1, 21, 0] },
			]).ref,
		).toBe('refs/tags/1.21.0');
	});
	it('requires fresh literal consent', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = JAEGER_UI_CONSENT;
		expect(
			parseJaegerUiLauncher(['--consent-id', JAEGER_UI_CONSENT, '--namespace', 't680']),
		).toBe('acquire');
	});
	it('allows strict offline replay', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'offline';
		delete process.env.VERSIONLESS_CONSENT_ID;
		expect(parseJaegerUiLauncher(['--verify-offline', '--namespace', 't680'])).toBe('verify');
	});
});
