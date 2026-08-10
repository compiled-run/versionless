import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import {
	UNLEASH_CONSENT,
	durableAcceptedResponse,
	discoverUnleashApplicationPackage,
	isCanonicalApache2License,
	parseUnleashJsonc,
	parseUnleashLauncher,
} from '../src/fixture/react-unleash-ingest.ts';

const originalMode = process.env.VERSIONLESS_NETWORK_MODE;
const originalConsent = process.env.VERSIONLESS_CONSENT_ID;
afterEach(() => {
	if (originalMode === undefined) delete process.env.VERSIONLESS_NETWORK_MODE;
	else process.env.VERSIONLESS_NETWORK_MODE = originalMode;
	if (originalConsent === undefined) delete process.env.VERSIONLESS_CONSENT_ID;
	else process.env.VERSIONLESS_CONSENT_ID = originalConsent;
});

describe('Unleash T686 immutable ingest', () => {
	it('durably persists a response body and sanitized journal row before returning', async () => {
		const destination = await mkdtemp(join(tmpdir(), 'versionless-unleash-ledger-'));
		const state = { acceptedResponses: 0, aggregateBytes: 0, observations: [], ledger: [] };
		await durableAcceptedResponse(
			state,
			'https://registry.npmjs.org/unleash-frontend/4.12.4',
			200,
			Buffer.from('source'),
			destination,
		);
		expect(await readFile(join(destination, '0001.body'), 'utf8')).toBe('source');
		const row = JSON.parse(await readFile(join(destination, 'journal.ndjson'), 'utf8')) as {
			url: string;
			bodyBytes: number;
			acceptedResponse: boolean;
		};
		expect(row).toMatchObject({
			url: 'https://registry.npmjs.org/unleash-frontend/4.12.4',
			bodyBytes: 6,
			acceptedResponse: true,
		});
	});
	it('accepts BOM, comments, and trailing commas without weakening JSON', () => {
		expect(
			parseUnleashJsonc('\uFEFF{/*x*/"name":"ui",// y\n"items":[1,],}', 'ui/package.json'),
		).toEqual({ name: 'ui', items: [1] });
	});
	it('rejects duplicate keys and invalid JSONC with a relative path class', () => {
		expect(() => parseUnleashJsonc('{"name":1,"name":2}', 'ui/package.json')).toThrow(
			'ui/package.json',
		);
		expect(() => parseUnleashJsonc('{"name":Infinity}', 'ui/package.json')).toThrow(
			'invalid-jsonc',
		);
	});
	it('accepts canonical Apache 2 text without brittle package spelling', () => {
		expect(isCanonicalApache2License('Apache License\nVersion 2.0, January 2004')).toBe(true);
		expect(isCanonicalApache2License('Apache-2.0')).toBe(false);
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
			discoverUnleashApplicationPackage([
				{
					path: 'package.json',
					name: 'unleash',
					reactMajor: null,
					webpackMajor: null,
					...shared,
				},
				{
					path: 'packages/ui/package.json',
					name: '@unleash/ui',
					reactMajor: 17,
					webpackMajor: null,
					viteMajor: 2,
					...shared,
				},
			]).path,
		).toBe('packages/ui/package.json');
	});
	it('rejects equally qualified nested applications', () => {
		const shared = {
			name: '@unleash/ui',
			reactMajor: 17,
			webpackMajor: null,
			viteMajor: 2,
			ownedWebpackConfigs: 1,
			browserEntry: true,
			search: true,
			detail: true,
			auth: true,
			registryApi: true,
		};
		expect(() =>
			discoverUnleashApplicationPackage([
				{ path: 'a/package.json', ...shared },
				{ path: 'b/package.json', ...shared },
			]),
		).toThrow('ambiguous');
	});
	it('requires fresh literal consent', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = UNLEASH_CONSENT;
		expect(parseUnleashLauncher(['--consent-id', UNLEASH_CONSENT, '--namespace', 't686'])).toBe(
			'acquire',
		);
	});
	it('allows strict offline replay', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'offline';
		delete process.env.VERSIONLESS_CONSENT_ID;
		expect(parseUnleashLauncher(['--verify-offline', '--namespace', 't686'])).toBe('verify');
	});
});
