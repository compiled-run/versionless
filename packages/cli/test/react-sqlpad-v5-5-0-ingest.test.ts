import { afterEach, describe, expect, test } from 'vitest';
import {
	SQLPAD_CONSENT,
	analyzeSqlpadLocks,
	assertSqlpadRegistryUrl,
	parseSqlpadIngestLauncher,
} from '../src/fixture/react-sqlpad-v5-5-0-ingest.ts';

const originalNetworkMode = process.env.VERSIONLESS_NETWORK_MODE;
const originalConsent = process.env.VERSIONLESS_CONSENT_ID;
const originalOffline = process.env.NPM_CONFIG_OFFLINE;

afterEach(() => {
	if (originalNetworkMode === undefined) delete process.env.VERSIONLESS_NETWORK_MODE;
	else process.env.VERSIONLESS_NETWORK_MODE = originalNetworkMode;
	if (originalConsent === undefined) delete process.env.VERSIONLESS_CONSENT_ID;
	else process.env.VERSIONLESS_CONSENT_ID = originalConsent;
	if (originalOffline === undefined) delete process.env.NPM_CONFIG_OFFLINE;
	else process.env.NPM_CONFIG_OFFLINE = originalOffline;
});

function lock(prefix: string, count: number): unknown {
	return {
		lockfileVersion: 1,
		dependencies: Object.fromEntries(
			Array.from({ length: count }, (_, index) => [
				`${prefix}-${index}`,
				{
					version: '1.0.0',
					resolved: `https://registry.npmjs.org/${prefix}-${index}/-/${prefix}-${index}-1.0.0.tgz`,
					integrity: `sha512-${Buffer.alloc(64, index).toString('base64')}`,
				},
			]),
		),
	};
}

describe('SQLPad v5.5.0 closure ingest', () => {
	test('accepts only exact credential-free registry HTTPS URLs', () => {
		expect(() =>
			assertSqlpadRegistryUrl('https://registry.npmjs.org/react/-/react-16.13.1.tgz'),
		).not.toThrow();
		for (const url of [
			'http://registry.npmjs.org/react/-/react-16.13.1.tgz',
			'https://user@registry.npmjs.org/react/-/react-16.13.1.tgz',
			'https://example.com/react.tgz',
			'https://registry.npmjs.org/react/-/react.tgz?moving=true',
		])
			expect(() => assertSqlpadRegistryUrl(url)).toThrow('outside literal consent');
	});

	test('requires all three integrity-bearing npm v1 closures', () => {
		const closure = analyzeSqlpadLocks([
			{ scope: 'root', value: lock('root', 100) },
			{ scope: 'client', value: lock('client', 1_300) },
			{ scope: 'server', value: lock('server', 1_100) },
		]);
		expect(closure.artifacts).toHaveLength(2_500);
		expect(closure.placements).toBe(2_500);
		expect(closure.digest).toHaveLength(64);
		expect(() =>
			analyzeSqlpadLocks([
				{ scope: 'client', value: { lockfileVersion: 2, dependencies: {} } },
			]),
		).toThrow('npm lock v1');
	});

	test('canonically binds bundled packages to the immutable parent without a request', () => {
		const value = lock('ordinary', 2_499) as {
			lockfileVersion: number;
			dependencies: Record<string, unknown>;
		};
		value.dependencies.fsevents = {
			version: '1.2.12',
			resolved: 'https://registry.npmjs.org/fsevents/-/fsevents-1.2.12.tgz',
			integrity: `sha512-${Buffer.alloc(64, 7).toString('base64')}`,
			dependencies: {
				abbrev: { version: '1.1.1', bundled: true, optional: true },
			},
		};
		const closure = analyzeSqlpadLocks([{ scope: 'client', value }]);
		const parent = closure.artifacts.find((artifact) => artifact.name === 'fsevents');
		expect(parent?.bundled).toEqual([
			{
				scope: 'client',
				path: 'fsevents>abbrev',
				name: 'abbrev',
				version: '1.1.1',
				parent: {
					name: 'fsevents',
					version: '1.2.12',
					url: 'https://registry.npmjs.org/fsevents/-/fsevents-1.2.12.tgz',
					integrity: `sha512-${Buffer.alloc(64, 7).toString('base64')}`,
					placement: 'client:fsevents',
				},
			},
		]);
		expect(closure.artifacts.some((artifact) => artifact.name === 'abbrev')).toBe(false);
	});

	test('rejects root, unbound, conflicting, and tampered bundled identities', () => {
		const parent = {
			version: '1.2.12',
			resolved: 'https://registry.npmjs.org/fsevents/-/fsevents-1.2.12.tgz',
			integrity: `sha512-${Buffer.alloc(64, 9).toString('base64')}`,
		};
		for (const bundled of [
			{
				version: '1.1.1',
				bundled: true,
				resolved: 'https://registry.npmjs.org/abbrev/-/abbrev-1.1.1.tgz',
			},
			{
				version: '1.1.1',
				bundled: true,
				integrity: `sha512-${Buffer.alloc(64).toString('base64')}`,
			},
			{ version: '', bundled: true },
		]) {
			const value = lock('ordinary', 2_499) as {
				lockfileVersion: number;
				dependencies: Record<string, unknown>;
			};
			value.dependencies.fsevents = { ...parent, dependencies: { abbrev: bundled } };
			expect(() => analyzeSqlpadLocks([{ scope: 'client', value }])).toThrow(
				'bundled lock identity differs',
			);
		}
		const root = lock('ordinary', 2_499) as {
			lockfileVersion: number;
			dependencies: Record<string, unknown>;
		};
		root.dependencies.abbrev = { version: '1.1.1', bundled: true };
		expect(() => analyzeSqlpadLocks([{ scope: 'client', value: root }])).toThrow(
			'bundled lock identity differs',
		);
	});

	test('separates one-shot consent from strict offline verification', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = SQLPAD_CONSENT;
		expect(parseSqlpadIngestLauncher(['--acquire', '--consent-id', SQLPAD_CONSENT])).toBe(
			'acquire',
		);
		process.env.VERSIONLESS_NETWORK_MODE = 'offline';
		process.env.NPM_CONFIG_OFFLINE = 'true';
		delete process.env.VERSIONLESS_CONSENT_ID;
		expect(parseSqlpadIngestLauncher(['--verify', '--consent-id', SQLPAD_CONSENT])).toBe(
			'verify',
		);
	});
});
