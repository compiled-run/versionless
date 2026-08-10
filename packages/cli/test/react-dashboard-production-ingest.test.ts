import { afterEach, describe, expect, test } from 'vitest';
import {
	REACT_DASHBOARD_CONSENT,
	assertReactDashboardRegistryUrl,
	buildReactDashboardAllowlist,
	classifyDashboardResponse,
	dashboardRequestInit,
	parseReactDashboardLauncher,
	projectDashboardFailure,
	smokeReactDashboardLauncher,
} from '../src/fixture/react-dashboard-production-ingest.ts';

const originalMode = process.env.VERSIONLESS_NETWORK_MODE;
const originalConsent = process.env.VERSIONLESS_CONSENT_ID;
const originalOffline = process.env.NPM_CONFIG_OFFLINE;

afterEach(() => {
	if (originalMode === undefined) delete process.env.VERSIONLESS_NETWORK_MODE;
	else process.env.VERSIONLESS_NETWORK_MODE = originalMode;
	if (originalConsent === undefined) delete process.env.VERSIONLESS_CONSENT_ID;
	else process.env.VERSIONLESS_CONSENT_ID = originalConsent;
	if (originalOffline === undefined) delete process.env.NPM_CONFIG_OFFLINE;
	else process.env.NPM_CONFIG_OFFLINE = originalOffline;
});

describe('React Dashboard T614 production acquisition', () => {
	test('accepts only the exact one-shot consent or exact offline controls', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = REACT_DASHBOARD_CONSENT;
		expect(
			parseReactDashboardLauncher(['--acquire', '--consent-id', REACT_DASHBOARD_CONSENT]),
		).toBe('acquire');
		process.env.VERSIONLESS_NETWORK_MODE = 'offline';
		process.env.NPM_CONFIG_OFFLINE = 'true';
		delete process.env.VERSIONLESS_CONSENT_ID;
		expect(
			parseReactDashboardLauncher([
				'--launcher-smoke',
				'--consent-id',
				REACT_DASHBOARD_CONSENT,
			]),
		).toBe('launcher-smoke');
		expect(
			parseReactDashboardLauncher(['--verify', '--consent-id', REACT_DASHBOARD_CONSENT]),
		).toBe('verify');
		for (const args of [['--acquire'], ['--acquire', '--consent-id', 'wrong'], ['--verify']])
			expect(() => parseReactDashboardLauncher(args)).toThrow();
	});

	test('permits only credential-free immutable registry tarballs', () => {
		expect(() =>
			assertReactDashboardRegistryUrl('https://registry.npmjs.org/react/-/react-18.3.1.tgz'),
		).not.toThrow();
		for (const url of [
			'http://registry.npmjs.org/react/-/react-18.3.1.tgz',
			'https://user:secret@registry.npmjs.org/react/-/react-18.3.1.tgz',
			'https://registry.npmjs.org/react/-/react-18.3.1.tgz?mutable=true',
			'https://example.test/react/-/react-18.3.1.tgz',
		])
			expect(() => assertReactDashboardRegistryUrl(url)).toThrow(
				'exact registry tarball scope',
			);
	});

	test('uses GET, manual redirect, identity encoding, and no credentials', () => {
		const init = dashboardRequestInit();
		expect(init).toMatchObject({ method: 'GET', redirect: 'manual', credentials: 'omit' });
		expect(init.headers).toEqual({
			accept: 'application/octet-stream',
			'accept-encoding': 'identity',
			'user-agent': 'versionless-t614',
		});
		for (const secret of ['authorization', 'cookie', 'proxy-authorization'])
			expect(Object.keys(init.headers as Record<string, string>)).not.toContain(secret);
	});

	test('rejects redirects, non-200 responses, and transformed bodies', () => {
		expect(() => classifyDashboardResponse(new Response('ok', { status: 200 }))).not.toThrow();
		expect(() =>
			classifyDashboardResponse(
				new Response('', { status: 302, headers: { location: 'https://example.test' } }),
			),
		).toThrow('response-status-not-200');
		expect(() =>
			classifyDashboardResponse(
				new Response('', { status: 200, headers: { location: 'https://example.test' } }),
			),
		).toThrow('response-redirect-forbidden');
		expect(() =>
			classifyDashboardResponse(
				new Response('', { status: 200, headers: { 'content-encoding': 'gzip' } }),
			),
		).toThrow('response-encoding-not-identity');
	});

	test('freezes the exact 962 plus 3 request allowlist', async () => {
		const first = await buildReactDashboardAllowlist();
		const second = await buildReactDashboardAllowlist();
		expect(first).toEqual(second);
		expect(first.cached).toBe(146);
		expect(first.items).toHaveLength(965);
		expect(first.items.filter((item) => item.kind === 'lock-missing')).toHaveLength(962);
		expect(first.items.filter((item) => item.kind === 'target-delta')).toHaveLength(3);
	});

	test('offline launcher smoke is deterministic and reports zero attempts', async () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'offline';
		process.env.NPM_CONFIG_OFFLINE = 'true';
		delete process.env.VERSIONLESS_CONSENT_ID;
		const first = await smokeReactDashboardLauncher();
		const second = await smokeReactDashboardLauncher();
		expect(first).toEqual(second);
		expect(first).toMatchObject({
			result: 'ready',
			networkAttempts: 0,
			pairs: 1108,
			cached: 146,
			missing: 962,
			targetDelta: 3,
			requests: 965,
		});
	});

	test('sanitizes failures to fixed codes and numeric counters', () => {
		const projected = projectDashboardFailure(
			new Error('token=secret host=/Users/alice'),
			2,
			7,
		);
		expect(projected).toMatchObject({
			code: 'publication-failed',
			attempts: 2,
			acceptedBytes: 7,
		});
		expect(JSON.stringify(projected)).not.toContain('secret');
		expect(JSON.stringify(projected)).not.toContain('/Users');
	});
});
