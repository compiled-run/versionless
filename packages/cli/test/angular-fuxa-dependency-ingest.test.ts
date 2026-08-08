import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	acquireDependency,
	assertDependencyUrl,
	assertT151Consent,
	createAcquireState,
	T151_AGGREGATE_LIMIT,
	T151_CONSENT_ID,
	T151_RESPONSE_LIMIT,
} from '../src/fixture/angular-fuxa-dependency-ingest.ts';

function octal(value: number, width: number): Buffer {
	const output = Buffer.alloc(width, 0);
	output.write(`${value.toString(8).padStart(width - 1, '0')}\0`, 'ascii');
	return output;
}

function tarFile(name: string, body: Buffer): Buffer {
	const header = Buffer.alloc(512, 0);
	header.write(name, 0, 100, 'utf8');
	octal(420, 8).copy(header, 100);
	octal(0, 8).copy(header, 108);
	octal(0, 8).copy(header, 116);
	octal(body.byteLength, 12).copy(header, 124);
	octal(0, 12).copy(header, 136);
	header.fill(32, 148, 156);
	header.write('0', 156, 1, 'ascii');
	header.write('ustar\0', 257, 6, 'ascii');
	header.write('00', 263, 2, 'ascii');
	octal(
		[...header].reduce((sum, byte) => sum + byte, 0),
		8,
	).copy(header, 148);
	return Buffer.concat([header, body, Buffer.alloc((512 - (body.byteLength % 512)) % 512)]);
}

function tarball(): Buffer {
	return gzipSync(
		Buffer.concat([
			tarFile(
				'package/package.json',
				Buffer.from('{"name":"example","version":"1.0.0","license":"MIT"}'),
			),
			tarFile('package/LICENSE', Buffer.from('MIT\n')),
			Buffer.alloc(1024),
		]),
	);
}

function responseBody(bytes: Buffer): ArrayBuffer {
	return Uint8Array.from(bytes).buffer;
}

function request(bytes: Buffer) {
	return {
		sequence: 1,
		url: 'https://registry.npmjs.org/example/-/example-1.0.0.tgz',
		integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
		identities: [{ name: 'example', version: '1.0.0' }],
	} as const;
}

afterEach(() => {
	delete process.env.VERSIONLESS_NETWORK_MODE;
	delete process.env.VERSIONLESS_CONSENT_ID;
});

describe('T151 dependency ingest boundaries', () => {
	it('requires fresh literal consent and refuses expired or partial consent', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = T151_CONSENT_ID;
		expect(() =>
			assertT151Consent(T151_CONSENT_ID, new Date('2026-08-08T12:00:00Z')),
		).not.toThrow();
		expect(() => assertT151Consent('other', new Date('2026-08-08T12:00:00Z'))).toThrow(
			'exact purpose-bound',
		);
		expect(() => assertT151Consent(T151_CONSENT_ID, new Date('2026-08-09T00:00:00Z'))).toThrow(
			'expired',
		);
	});

	it('permits only exact HTTPS registry tarball URLs', () => {
		expect(() =>
			assertDependencyUrl('https://registry.npmjs.org/p/-/p-1.0.0.tgz'),
		).not.toThrow();
		for (const url of [
			'http://registry.npmjs.org/p/-/p-1.0.0.tgz',
			'https://evil.example/p/-/p-1.0.0.tgz',
			'https://user:pass@registry.npmjs.org/p/-/p-1.0.0.tgz',
			'https://registry.npmjs.org/p/-/p-1.0.0.tgz?x=1',
			'https://registry.npmjs.org/p',
		])
			expect(() => assertDependencyUrl(url)).toThrow('outside');
	});

	it('uses one GET with identity encoding, no credentials, and records accepted bytes', async () => {
		const bytes = tarball();
		const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
			expect(init).toMatchObject({ method: 'GET', redirect: 'manual', credentials: 'omit' });
			expect(new Headers(init?.headers).get('accept-encoding')).toBe('identity');
			return new Response(responseBody(bytes), {
				status: 200,
				headers: {
					'content-length': String(bytes.byteLength),
					'content-encoding': 'identity',
				},
			});
		}) as unknown as typeof fetch;
		const state = createAcquireState();
		const result = await acquireDependency(request(bytes), state, fetcher);
		expect(result.artifact).toMatchObject({
			sequence: 1,
			name: 'example',
			version: '1.0.0',
			license: 'MIT',
		});
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(state).toMatchObject({ attempts: 1, aggregateBytes: bytes.byteLength });
		expect(state.ledger).toHaveLength(1);
		expect(state.ledger[0]?.result).toBe('accepted');
	});

	it('fail-closes redirects, compression, size, aggregate, SRI, and identity with one ledger row', async () => {
		const bytes = tarball();
		const cases: Response[] = [
			new Response(null, {
				status: 302,
				headers: { location: 'https://registry.npmjs.org/other.tgz' },
			}),
			new Response(responseBody(bytes), {
				status: 200,
				headers: { 'content-encoding': 'gzip' },
			}),
			new Response(responseBody(bytes), {
				status: 200,
				headers: { 'content-length': String(T151_RESPONSE_LIMIT + 1) },
			}),
		];
		for (const response of cases) {
			const state = createAcquireState();
			await expect(
				acquireDependency(request(bytes), state, (async () => response) as typeof fetch),
			).rejects.toThrow();
			expect(state.attempts).toBe(1);
			expect(state.ledger).toHaveLength(1);
			expect(state.ledger[0]?.result).toBe('rejected');
		}
		const aggregate = createAcquireState();
		aggregate.aggregateBytes = T151_AGGREGATE_LIMIT;
		await expect(
			acquireDependency(
				request(bytes),
				aggregate,
				(async () => new Response(responseBody(bytes))) as typeof fetch,
			),
		).rejects.toThrow('aggregate');
		const wrongSri = {
			...request(bytes),
			integrity: `sha512-${Buffer.alloc(64).toString('base64')}`,
		};
		await expect(
			acquireDependency(
				wrongSri,
				createAcquireState(),
				(async () => new Response(responseBody(bytes))) as typeof fetch,
			),
		).rejects.toThrow('SRI');
		const wrongIdentity = {
			...request(bytes),
			identities: [{ name: 'other', version: '1.0.0' }],
		};
		await expect(
			acquireDependency(
				wrongIdentity,
				createAcquireState(),
				(async () => new Response(responseBody(bytes))) as typeof fetch,
			),
		).rejects.toThrow('identity');
	});
});
