import { afterEach, describe, expect, test } from 'vitest';
import {
	FUXA_PRODUCTION_AGGREGATE_LIMIT,
	FUXA_PRODUCTION_REQUEST_LIMIT,
	FUXA_PRODUCTION_REQUESTS,
	FUXA_PRODUCTION_RESPONSE_LIMIT,
	FUXA_TECHNICAL_CONSENT,
	assertFuxaTechnicalConsent,
	assertFuxaTechnicalUrl,
	fuxaTechnicalRequestInit,
	smokeFuxaProductionIngest,
	verifyAngularFuxaProductionClosure,
} from '../src/fixture/angular-fuxa-production-ingest.ts';

afterEach(() => {
	delete process.env.VERSIONLESS_NETWORK_MODE;
	delete process.env.VERSIONLESS_CONSENT_ID;
	delete process.env.NPM_CONFIG_OFFLINE;
});

describe('FUXA T621 technical-evaluation ingest', () => {
	test('requires the exact one-shot consent in argument and environment', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = FUXA_TECHNICAL_CONSENT;
		expect(() =>
			assertFuxaTechnicalConsent(['--consent', FUXA_TECHNICAL_CONSENT]),
		).not.toThrow();
		for (const args of [
			['--consent'],
			['--consent', 'wrong'],
			['--verify', FUXA_TECHNICAL_CONSENT],
		])
			expect(() => assertFuxaTechnicalConsent(args)).toThrow('exact purpose-bound');
	});

	test('allows only exact credential-free HTTPS registry tarballs', () => {
		expect(() =>
			assertFuxaTechnicalUrl('https://registry.npmjs.org/p/-/p-1.0.0.tgz'),
		).not.toThrow();
		for (const url of [
			'http://registry.npmjs.org/p/-/p-1.0.0.tgz',
			'https://user:secret@registry.npmjs.org/p/-/p-1.0.0.tgz',
			'https://registry.npmjs.org/p/-/p-1.0.0.tgz?x=1',
			'https://example.test/p/-/p-1.0.0.tgz',
		])
			expect(() => assertFuxaTechnicalUrl(url)).toThrow('exact registry scope');
	});

	test('uses only credential-free GET with manual redirects and identity bodies', () => {
		const init = fuxaTechnicalRequestInit();
		expect(init).toMatchObject({
			method: 'GET',
			redirect: 'manual',
			credentials: 'omit',
			cache: 'no-store',
		});
		expect(init.headers).toEqual({
			accept: 'application/octet-stream',
			'accept-encoding': 'identity',
			'user-agent': 'versionless-t621',
		});
		for (const header of ['authorization', 'cookie', 'proxy-authorization'])
			expect(Object.keys(init.headers as Record<string, string>)).not.toContain(header);
	});

	test('keeps the exact bounded request and byte budgets', () => {
		expect(FUXA_PRODUCTION_REQUESTS).toBe(1222);
		expect(FUXA_PRODUCTION_REQUEST_LIMIT).toBe(4000);
		expect(FUXA_PRODUCTION_RESPONSE_LIMIT).toBe(128 * 1024 * 1024);
		expect(FUXA_PRODUCTION_AGGREGATE_LIMIT).toBe(3 * 1024 * 1024 * 1024);
	});

	test('recomputes the immutable closure offline without consuming consent', async () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'offline';
		process.env.NPM_CONFIG_OFFLINE = 'true';
		const first = await smokeFuxaProductionIngest();
		const second = await smokeFuxaProductionIngest();
		expect(first).toEqual(second);
		expect(first).toMatchObject({ result: 'ready', networkAttempts: 0, requests: 1222 });
		expect(first.boundary).toMatchObject({
			unresolvedLicenses: 'unknown',
			legalReviewRequired: true,
			redistributionAuthorized: false,
			complianceStatus: 'not-assessed',
			certificationClaim: false,
			enterpriseAdoptionApproval: false,
		});
		await expect(verifyAngularFuxaProductionClosure()).resolves.toMatchObject({
			result: 'pass',
			networkAttempts: 0,
			artifacts: 1222,
		});
	});
});
