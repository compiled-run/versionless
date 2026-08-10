import { PassThrough, Readable } from 'node:stream';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, test } from 'vitest';
import {
	AVATAAARS_REACT1831_CONSENT,
	AvataaarsResponseBoundaryError,
	avataaarsRequestHeaders,
	avataaarsResponseLimits,
	assertAvataaarsReact1831Consent,
	assertAvataaarsReact1831Url,
	classifyAvataaarsResponse,
	collectAvataaarsResponse,
	parseAvataaarsReact1831Metadata,
	parseAvataaarsReact1831Launcher,
	projectAvataaarsFailure,
	verifyAvataaarsProtectedNegativeEvidence,
	verifyT568ProtectedEvidence,
} from '../src/fixture/react-avataaars-compatibility-ingest.ts';

const originalMode = process.env.VERSIONLESS_NETWORK_MODE;
const originalConsent = process.env.VERSIONLESS_CONSENT_ID;
const originalNpmOffline = process.env.NPM_CONFIG_OFFLINE;

afterEach(() => {
	if (originalMode === undefined) delete process.env.VERSIONLESS_NETWORK_MODE;
	else process.env.VERSIONLESS_NETWORK_MODE = originalMode;
	if (originalConsent === undefined) delete process.env.VERSIONLESS_CONSENT_ID;
	else process.env.VERSIONLESS_CONSENT_ID = originalConsent;
	if (originalNpmOffline === undefined) delete process.env.NPM_CONFIG_OFFLINE;
	else process.env.NPM_CONFIG_OFFLINE = originalNpmOffline;
});

describe('Avataaars React 18.3.1 closure boundaries', () => {
	test('requires exact one-shot consent', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = AVATAAARS_REACT1831_CONSENT;
		expect(() =>
			assertAvataaarsReact1831Consent([
				'--acquire',
				'--consent-id',
				AVATAAARS_REACT1831_CONSENT,
			]),
		).not.toThrow();
		for (const args of [
			['--acquire'],
			['--acquire', '--consent-id', 'wrong'],
			['--verify', '--consent-id', AVATAAARS_REACT1831_CONSENT],
		])
			expect(() => assertAvataaarsReact1831Consent(args)).toThrow('exact one-shot consent');
	});

	test('shares an exact strip-safe production parser for offline smoke and acquisition', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'offline';
		process.env.NPM_CONFIG_OFFLINE = 'true';
		delete process.env.VERSIONLESS_CONSENT_ID;
		expect(
			parseAvataaarsReact1831Launcher([
				'--launcher-smoke',
				'--consent-id',
				AVATAAARS_REACT1831_CONSENT,
			]),
		).toBe('launcher-smoke');
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = AVATAAARS_REACT1831_CONSENT;
		expect(
			parseAvataaarsReact1831Launcher([
				'--acquire',
				'--consent-id',
				AVATAAARS_REACT1831_CONSENT,
			]),
		).toBe('acquire');
		process.env.VERSIONLESS_NETWORK_MODE = 'offline';
		expect(() =>
			parseAvataaarsReact1831Launcher([
				'--acquire',
				'--consent-id',
				AVATAAARS_REACT1831_CONSENT,
			]),
		).toThrow('exact one-shot consent');
	});

	test('preserves the complete T568 negative evidence byte-exact', async () => {
		await expect(verifyT568ProtectedEvidence()).resolves.toBeUndefined();
		await expect(verifyAvataaarsProtectedNegativeEvidence()).resolves.toBeUndefined();
	});

	test('classifies only absent, identity, and gzip while discarding cookies by presence', () => {
		expect(classifyAvataaarsResponse(200, {})).toEqual({
			encoding: 'absent',
			responseCookiePresent: false,
		});
		expect(
			classifyAvataaarsResponse(200, {
				'content-encoding': ' GZip ',
				'set-cookie': ['secret=value'],
			}),
		).toEqual({ encoding: 'gzip', responseCookiePresent: true });
		expect(
			JSON.stringify(classifyAvataaarsResponse(200, { 'set-cookie': ['secret=value'] })),
		).not.toContain('secret');
		for (const encoding of ['', '   ', 'br', 'deflate', 'gzip, br'])
			expect(() => classifyAvataaarsResponse(200, { 'content-encoding': encoding })).toThrow(
				'response-encoding-unsupported',
			);
		expect(() =>
			classifyAvataaarsResponse(200, {
				'content-encoding': ['gzip', 'identity'] as never,
			}),
		).toThrow('response-encoding-unsupported');
		expect(() => classifyAvataaarsResponse(404, {})).toThrow('response-status-not-200');
		expect(() => classifyAvataaarsResponse(200, { location: '/elsewhere' })).toThrow(
			'response-redirect-forbidden',
		);
	});

	test('uses an exact outbound header allowlist with no credentials', () => {
		expect(avataaarsRequestHeaders('metadata')).toEqual({
			accept: 'application/json',
			'accept-encoding': 'identity, gzip',
			'user-agent': 'versionless-t608',
		});
		const keys = Object.keys(avataaarsRequestHeaders('tarball'));
		for (const forbidden of ['cookie', 'cookie2', 'authorization', 'proxy-authorization'])
			expect(keys).not.toContain(forbidden);
	});

	test('decodes absent, identity, and fragmented gzip to identical bytes', async () => {
		const payload = Buffer.from('exact decoded package metadata');
		const compressed = gzipSync(payload);
		const fragmented = Array.from({ length: compressed.length }, (_, index) =>
			compressed.subarray(index, index + 1),
		);
		const absent = await collectAvataaarsResponse(Readable.from([payload]), {
			encoding: 'absent',
			wireLimit: 1024,
			decodedLimit: 1024,
		});
		const identity = await collectAvataaarsResponse(Readable.from([payload]), {
			encoding: 'identity',
			wireLimit: 1024,
			decodedLimit: 1024,
		});
		const gzip = await collectAvataaarsResponse(Readable.from(fragmented), {
			encoding: 'gzip',
			wireLimit: 1024,
			decodedLimit: 1024,
		});
		expect(absent.decoded).toEqual(payload);
		expect(identity.decodedSha256).toBe(absent.decodedSha256);
		expect(gzip.decodedSha256).toBe(absent.decodedSha256);
		expect(gzip.wireByteLength).toBe(compressed.length);
	});

	test('rejects corrupt, truncated, expanding, and over-wire gzip independently', async () => {
		const payload = Buffer.alloc(4096, 1);
		const compressed = gzipSync(payload);
		await expect(
			collectAvataaarsResponse(Readable.from([Buffer.from('not-gzip')]), {
				encoding: 'gzip',
				wireLimit: 1024,
				decodedLimit: 8192,
			}),
		).rejects.toThrow('response-gzip-decode-failed');
		await expect(
			collectAvataaarsResponse(Readable.from([compressed.subarray(0, -4)]), {
				encoding: 'gzip',
				wireLimit: 1024,
				decodedLimit: 8192,
			}),
		).rejects.toThrow('response-gzip-decode-failed');
		await expect(
			collectAvataaarsResponse(Readable.from([compressed]), {
				encoding: 'gzip',
				wireLimit: 1024,
				decodedLimit: payload.length - 1,
			}),
		).rejects.toThrow('response-decoded-cap-exceeded');
		await expect(
			collectAvataaarsResponse(Readable.from([compressed]), {
				encoding: 'gzip',
				wireLimit: compressed.length - 1,
				decodedLimit: 8192,
			}),
		).rejects.toThrow('response-wire-cap-exceeded');
	});

	test('bounds aggregate wire and decoded budgets independently', () => {
		const thirtyMiB = 30 * 1024 * 1024;
		expect(avataaarsResponseLimits(thirtyMiB - 7, thirtyMiB - 11)).toEqual({
			wireLimit: 7,
			decodedLimit: 11,
		});
		expect(() => avataaarsResponseLimits(-1, 0)).toThrow('counters are invalid');
	});

	test('settles once and projects only sanitized boundary codes and counts', async () => {
		const stream = new PassThrough();
		stream.on('error', () => undefined);
		const pending = collectAvataaarsResponse(stream, {
			encoding: 'identity',
			wireLimit: 1024,
			decodedLimit: 1024,
		});
		stream.emit('error', new Error('sensitive transport detail'));
		stream.emit('error', new Error('second sensitive detail'));
		stream.end(Buffer.from('late'));
		await expect(pending).rejects.toThrow('response-stream-error');
		for (const code of ['request-timeout', 'network-error'] as const) {
			const projected = projectAvataaarsFailure(
				new AvataaarsResponseBoundaryError(code),
				{ ordinal: 2, media: 'tarball' },
				[],
			);
			expect(projected).toMatchObject({ code, ordinal: 2, media: 'tarball' });
			expect(JSON.stringify(projected)).not.toContain('sensitive');
		}
	});

	test('permits only exact credential-free registry URLs', () => {
		const exact = 'https://registry.npmjs.org/react/18.3.1';
		const allowed = new Set([exact]);
		expect(() => assertAvataaarsReact1831Url(exact, allowed)).not.toThrow();
		for (const url of [
			'http://registry.npmjs.org/react/18.3.1',
			'https://user@registry.npmjs.org/react/18.3.1',
			`${exact}?latest=true`,
			`${exact}#fragment`,
			'https://registry.npmjs.org/react/18.3.0',
		])
			expect(() => assertAvataaarsReact1831Url(url, allowed)).toThrow(
				'outside exact consent',
			);
	});

	test('requires exact identity, MIT, strong SRI, URL, and dependency edges', () => {
		const target = {
			name: 'react-dom',
			version: '18.3.1',
			metadataUrl: 'https://registry.npmjs.org/react-dom/18.3.1',
		};
		const valid = {
			name: 'react-dom',
			version: '18.3.1',
			license: 'MIT',
			dist: {
				tarball: 'https://registry.npmjs.org/react-dom/-/react-dom-18.3.1.tgz',
				integrity: `sha512-${Buffer.alloc(64).toString('base64')}`,
				shasum: 'a'.repeat(40),
			},
			dependencies: { scheduler: '^0.23.2', 'loose-envify': '^1.1.0' },
		};
		expect(parseAvataaarsReact1831Metadata(valid, target)).toMatchObject({
			name: 'react-dom',
			version: '18.3.1',
		});
		for (const changed of [
			{ ...valid, license: 'ISC' },
			{ ...valid, version: '18.3.0' },
			{ ...valid, dependencies: { scheduler: '^0.23.1', 'loose-envify': '^1.1.0' } },
			{ ...valid, dist: { ...valid.dist, tarball: 'https://example.com/react-dom.tgz' } },
		])
			expect(() => parseAvataaarsReact1831Metadata(changed, target)).toThrow();
	});
});
