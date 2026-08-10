import { afterEach, describe, expect, it } from 'vitest';
import {
	parseSaleorLauncher,
	SALEOR_CONSENT,
	selectSaleorStableRef,
} from '../src/fixture/react-saleor-dashboard-ingest.ts';

const originalMode = process.env.VERSIONLESS_NETWORK_MODE;
const originalConsent = process.env.VERSIONLESS_CONSENT_ID;

afterEach(() => {
	if (originalMode === undefined) delete process.env.VERSIONLESS_NETWORK_MODE;
	else process.env.VERSIONLESS_NETWORK_MODE = originalMode;
	if (originalConsent === undefined) delete process.env.VERSIONLESS_CONSENT_ID;
	else process.env.VERSIONLESS_CONSENT_ID = originalConsent;
});

describe('Saleor Dashboard T670 immutable ingestion', () => {
	it('selects the greatest stable 2.x ref without accepting prereleases', () => {
		expect(
			selectSaleorStableRef([
				{
					ref: 'refs/tags/2.11.0-rc.9',
					object: { type: 'commit', sha: 'a'.repeat(40) },
				},
				{
					ref: 'refs/tags/2.10.1',
					object: { type: 'commit', sha: 'b'.repeat(40) },
				},
				{
					ref: 'refs/tags/2.11.1',
					object: { type: 'commit', sha: 'c'.repeat(40) },
				},
			]),
		).toEqual({
			ref: 'refs/tags/2.11.1',
			objectType: 'commit',
			objectSha: 'c'.repeat(40),
		});
	});

	it('requires the exact fresh consent and append-only namespace', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = SALEOR_CONSENT;
		expect(
			parseSaleorLauncher(['--consent-id', SALEOR_CONSENT, '--namespace', 't670']),
		).toEqual({ mode: 'acquire', namespace: 't670' });
		expect(() =>
			parseSaleorLauncher(['--consent-id', SALEOR_CONSENT, '--namespace', 't668']),
		).toThrow('namespace');
	});

	it('permits offline verification only without a consent environment', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'offline';
		delete process.env.VERSIONLESS_CONSENT_ID;
		expect(parseSaleorLauncher(['--verify-offline', '--namespace', 't670'])).toEqual({
			mode: 'verify',
			namespace: 't670',
		});
	});
});
