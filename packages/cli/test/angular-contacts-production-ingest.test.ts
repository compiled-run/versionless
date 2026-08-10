import { afterEach, describe, expect, test } from 'vitest';
import {
	ANGULAR_CONTACTS_AGGREGATE_LIMIT,
	ANGULAR_CONTACTS_ATTEMPT_LIMIT,
	ANGULAR_CONTACTS_CONSENT,
	ANGULAR_CONTACTS_LOCK_FLAGS,
	ANGULAR_CONTACTS_REQUEST_LIMIT,
	ANGULAR_CONTACTS_RESPONSE_LIMIT,
	angularContactsMetadataUrl,
	angularContactsRequestInit,
	assertAngularContactsConsent,
	frozenAngularContactsLanes,
	normalizeAngularContactsRequirement,
	probeAngularContactsTransport,
	readAngularContactsBoundedResponse,
	resolveAngularContactsMetadata,
	smokeAngularContactsIngest,
} from '../src/fixture/angular-contacts-production-ingest.ts';

afterEach(() => {
	delete process.env.VERSIONLESS_NETWORK_MODE;
	delete process.env.VERSIONLESS_CONSENT_ID;
	delete process.env.NPM_CONFIG_OFFLINE;
});

describe('Angular Contacts T625 production ingest', () => {
	test('requires the exact fresh one-shot consent', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = ANGULAR_CONTACTS_CONSENT;
		expect(() =>
			assertAngularContactsConsent(['--consent-id', ANGULAR_CONTACTS_CONSENT]),
		).not.toThrow();
		for (const args of [
			[],
			['--consent-id'],
			['--consent-id', 'T603-angular-contacts-angular9-to16-production-acquisition'],
		])
			expect(() => assertAngularContactsConsent(args)).toThrow('exact one-shot');
	});

	test('keeps credential-free identity GET and exact network bounds', () => {
		expect(angularContactsRequestInit('tarball')).toMatchObject({
			method: 'GET',
			redirect: 'manual',
			credentials: 'omit',
			cache: 'no-store',
			headers: {
				accept: 'application/octet-stream',
				'accept-encoding': 'identity',
				'user-agent': 'versionless-t625',
			},
		});
		expect([
			ANGULAR_CONTACTS_REQUEST_LIMIT,
			ANGULAR_CONTACTS_ATTEMPT_LIMIT,
			ANGULAR_CONTACTS_RESPONSE_LIMIT,
			ANGULAR_CONTACTS_AGGREGATE_LIMIT,
		]).toEqual([6_500, 9_000, 32 * 1024 * 1024, 4 * 1024 * 1024 * 1024]);
		for (const forbidden of ['--force', '--legacy-peer-deps', '--ignore-peer-deps'])
			expect(ANGULAR_CONTACTS_LOCK_FLAGS).not.toContain(forbidden);
	});

	test('allows only exact npm metadata names and normalizes npm aliases before semver', () => {
		expect(angularContactsMetadataUrl('@angular/core')).toBe(
			'https://registry.npmjs.org/@angular%2Fcore',
		);
		for (const name of ['', '../core', 'core?token=x'])
			expect(() => angularContactsMetadataUrl(name)).toThrow();
		expect(
			normalizeAngularContactsRequirement('wrap-ansi-cjs', 'npm:wrap-ansi@^7.0.0'),
		).toEqual({ name: 'wrap-ansi', range: '^7.0.0' });
	});

	test('selects strict metadata including dependencies, optional dependencies, and peers', () => {
		const selected = resolveAngularContactsMetadata(
			{
				name: 'p',
				'dist-tags': { latest: '2.0.0' },
				versions: {
					'1.0.0': { name: 'p', version: '1.0.0' },
					'2.0.0': {
						name: 'p',
						version: '2.0.0',
						dependencies: { a: '^1' },
						optionalDependencies: { b: '^2' },
						peerDependencies: { alias: 'npm:c@^3' },
					},
				},
			},
			'p',
			'latest',
		);
		expect(selected).toEqual({
			version: '2.0.0',
			requirements: [
				{ name: 'a', range: '^1' },
				{ name: 'b', range: '^2' },
				{ name: 'c', range: '^3' },
			],
		});
	});

	test('enforces streamed length, truncation, and response limits', async () => {
		const bytes = await readAngularContactsBoundedResponse(
			new Response(
				new ReadableStream({
					start(controller) {
						controller.enqueue(new Uint8Array([1]));
						controller.enqueue(new Uint8Array([2]));
						controller.close();
					},
				}),
				{ headers: { 'content-length': '2' } },
			),
			0,
		);
		expect([...bytes]).toEqual([1, 2]);
		await expect(
			readAngularContactsBoundedResponse(
				new Response(Buffer.from([1]), { headers: { 'content-length': '2' } }),
				0,
			),
		).rejects.toThrow('truncated');
		await expect(
			readAngularContactsBoundedResponse(
				new Response(Buffer.from([1]), {
					headers: { 'content-length': String(ANGULAR_CONTACTS_RESPONSE_LIMIT + 1) },
				}),
				0,
			),
		).rejects.toThrow('byte-boundary');
	});

	test('retries only zero-response transport and rejects redirect, compression, and post-header failure', async () => {
		let calls = 0;
		const retried = await probeAngularContactsTransport(
			'https://registry.npmjs.org/p',
			'metadata',
			(async () => {
				calls += 1;
				if (calls === 1) throw new TypeError('zero response');
				return new Response(Buffer.from('{}'), { headers: { 'content-length': '2' } });
			}) as typeof fetch,
		);
		expect(retried).toMatchObject({ attempts: 2, accepted: 1, responseBytes: 2 });
		await expect(
			probeAngularContactsTransport(
				'https://registry.npmjs.org/p',
				'metadata',
				(async () =>
					new Response(null, {
						status: 302,
						headers: { location: 'https://registry.npmjs.org/q' },
					})) as typeof fetch,
			),
		).rejects.toThrow('response-boundary');
		await expect(
			probeAngularContactsTransport(
				'https://registry.npmjs.org/p',
				'metadata',
				(async () =>
					new Response(Buffer.from('{}'), {
						headers: { 'content-encoding': 'gzip' },
					})) as typeof fetch,
			),
		).rejects.toThrow('response-boundary');
		calls = 0;
		await expect(
			probeAngularContactsTransport('https://registry.npmjs.org/p', 'metadata', (async () => {
				calls += 1;
				return new Response(
					new ReadableStream({
						start(controller) {
							controller.error(new Error('after headers'));
						},
					}),
				);
			}) as typeof fetch),
		).rejects.toThrow('after headers');
		expect(calls).toBe(1);
	});

	test('freezes all eight lanes and replays launcher twice without network', async () => {
		const lanes = await frozenAngularContactsLanes();
		expect(lanes.map((lane) => lane.major)).toEqual([9, 10, 11, 12, 13, 14, 15, 16]);
		process.env.VERSIONLESS_NETWORK_MODE = 'offline';
		process.env.NPM_CONFIG_OFFLINE = 'true';
		const first = await smokeAngularContactsIngest();
		const second = await smokeAngularContactsIngest();
		expect(first).toEqual(second);
		expect(first).toMatchObject({
			result: 'ready',
			networkAttempts: 0,
			baseline: {
				node: '16.20.2',
				architecture: 'darwin-arm64',
				label: 'native-arm64-node16-not-original-node12-reproduction',
			},
		});
	});
});
