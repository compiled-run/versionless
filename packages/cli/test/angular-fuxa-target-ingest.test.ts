import { afterEach, describe, expect, test } from 'vitest';
import {
	FUXA_TARGET_AGGREGATE_LIMIT,
	FUXA_TARGET_CONSENT,
	FUXA_TARGET_INSTALL_FLAGS,
	FUXA_TARGET_LOCK_FLAGS,
	FUXA_TARGET_REQUEST_LIMIT,
	FUXA_TARGET_RESPONSE_LIMIT,
	assertFuxaTargetAnchors,
	assertFuxaTargetConsent,
	frozenFuxaTargetManifests,
	fuxaMetadataUrl,
	fuxaTargetFailureCode,
	mergeFuxaTargetPairs,
	resolveMetadataVersion,
	smokeFuxaTargetIngest,
} from '../src/fixture/angular-fuxa-target-ingest.ts';

afterEach(() => {
	delete process.env.VERSIONLESS_NETWORK_MODE;
	delete process.env.VERSIONLESS_CONSENT_ID;
	delete process.env.NPM_CONFIG_OFFLINE;
});

describe('FUXA T623 target-only transaction', () => {
	test('requires the exact independent one-shot consent', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = FUXA_TARGET_CONSENT;
		expect(() => assertFuxaTargetConsent(['--consent', FUXA_TARGET_CONSENT])).not.toThrow();
		for (const args of [
			[],
			['--consent'],
			['--consent', 'T621-angular-fuxa-production-acquisition'],
		])
			expect(() => assertFuxaTargetConsent(args)).toThrow('exact one-shot');
	});

	test('freezes exact Angular15 and Angular16 manifests and anchors', async () => {
		const manifests = await frozenFuxaTargetManifests();
		expect(() => assertFuxaTargetAnchors(manifests.angular15, 15)).not.toThrow();
		expect(() => assertFuxaTargetAnchors(manifests.angular16, 16)).not.toThrow();
		expect(() =>
			assertFuxaTargetAnchors(
				manifests.angular15.replace(
					'"@angular/core": "15.2.3"',
					'"@angular/core": "15.2.4"',
				),
				15,
			),
		).toThrow('anchor differs');
	});

	test('permits only exact credential-free npm packument URLs and fixed bounds', () => {
		expect(fuxaMetadataUrl('@angular/core')).toBe('https://registry.npmjs.org/@angular%2Fcore');
		for (const name of ['', '../core', 'core?token=secret'])
			expect(() => fuxaMetadataUrl(name)).toThrow();
		expect([
			FUXA_TARGET_REQUEST_LIMIT,
			FUXA_TARGET_RESPONSE_LIMIT,
			FUXA_TARGET_AGGREGATE_LIMIT,
		]).toEqual([4_000, 128 * 1024 * 1024, 3 * 1024 * 1024 * 1024]);
	});

	test('selects a strict semver and exposes transitive, optional, and peer traversal', () => {
		const selected = resolveMetadataVersion(
			{
				name: 'example',
				versions: {
					'1.0.0': { name: 'example', version: '1.0.0' },
					'1.2.0': {
						name: 'example',
						version: '1.2.0',
						dependencies: { a: '^1' },
						optionalDependencies: { b: '^2' },
						peerDependencies: { c: '^3' },
					},
				},
			},
			'example',
			'^1.1.0',
		);
		expect(selected).toEqual({
			version: '1.2.0',
			requirements: [
				{ name: 'a', range: '^1' },
				{ name: 'b', range: '^2' },
				{ name: 'c', range: '^3' },
			],
		});
		expect(() =>
			resolveMetadataVersion({ name: 'example', versions: {} }, 'example', '^1'),
		).toThrow('no strict version');
	});

	test('deduplicates target pairs only on exact URL and SRI reuse identity', () => {
		const pair = {
			url: 'https://registry.npmjs.org/a/-/a-1.0.0.tgz',
			integrity: `sha512-${Buffer.alloc(64).toString('base64')}`,
			identities: [{ name: 'a', version: '1.0.0' }],
		};
		expect(
			mergeFuxaTargetPairs([
				{ lockfileVersion: 3, pairs: [pair] },
				{ lockfileVersion: 3, pairs: [pair] },
			]),
		).toEqual([pair]);
	});

	test('refuses non-strict npm lock/install flags and sanitizes terminal rollback codes', () => {
		expect(FUXA_TARGET_LOCK_FLAGS).toContain('--package-lock-only');
		expect(FUXA_TARGET_LOCK_FLAGS).toContain('--strict-peer-deps');
		expect(FUXA_TARGET_INSTALL_FLAGS).toContain('--strict-peer-deps');
		for (const forbidden of ['--force', '--legacy-peer-deps', '--ignore-peer-deps']) {
			expect(FUXA_TARGET_LOCK_FLAGS).not.toContain(forbidden);
			expect(FUXA_TARGET_INSTALL_FLAGS).not.toContain(forbidden);
		}
		expect(fuxaTargetFailureCode(new Error('strict-offline-npm-failed-deadbeef'))).toBe(
			'strict-offline-npm-failed',
		);
		expect(fuxaTargetFailureCode(new Error('/Users/example/private token'))).toBe(
			'target-validation-failed',
		);
	});

	test('replays the pre-consent launcher twice with zero network attempts', async () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'offline';
		process.env.NPM_CONFIG_OFFLINE = 'true';
		const first = await smokeFuxaTargetIngest();
		const second = await smokeFuxaTargetIngest();
		expect(first).toEqual(second);
		expect(first).toMatchObject({ result: 'ready', networkAttempts: 0 });
	});
});
