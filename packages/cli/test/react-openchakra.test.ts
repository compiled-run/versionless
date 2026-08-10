import { createHash } from 'node:crypto';
import { afterEach, describe, expect, test } from 'vitest';
import {
	OPENCHAKRA_CONSENT,
	assertOpenChakraConsent,
	assertOpenChakraUrl,
	decodeOpenChakraBlob,
} from '../src/fixture/react-openchakra-ingest.ts';

const originalMode = process.env.VERSIONLESS_NETWORK_MODE;
const originalConsent = process.env.VERSIONLESS_CONSENT_ID;

afterEach(() => {
	if (originalMode === undefined) delete process.env.VERSIONLESS_NETWORK_MODE;
	else process.env.VERSIONLESS_NETWORK_MODE = originalMode;
	if (originalConsent === undefined) delete process.env.VERSIONLESS_CONSENT_ID;
	else process.env.VERSIONLESS_CONSENT_ID = originalConsent;
});

describe('OpenChakra bounded qualification and ingest', () => {
	test('requires the exact one-shot consent', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = OPENCHAKRA_CONSENT;
		expect(() =>
			assertOpenChakraConsent(['--acquire', '--consent-id', OPENCHAKRA_CONSENT]),
		).not.toThrow();
		expect(() => assertOpenChakraConsent(['--acquire', '--consent-id', 'stale'])).toThrow();
	});

	test('accepts only exact allowlisted credential-free HTTPS URLs', () => {
		const exact = 'https://api.github.com/repos/premieroctet/openchakra';
		const allowed = new Set([exact]);
		expect(() => assertOpenChakraUrl(exact, allowed)).not.toThrow();
		for (const url of [
			'http://api.github.com/repos/premieroctet/openchakra',
			'https://user@api.github.com/repos/premieroctet/openchakra',
			`${exact}?moving=true`,
			`${exact}#fragment`,
			'https://example.com/openchakra',
		])
			expect(() => assertOpenChakraUrl(url, allowed)).toThrow('outside exact consent');
	});

	test('reconstructs exact Git blob bytes and rejects content drift', () => {
		const bytes = Buffer.from('{"name":"openchakra"}\n');
		const sha = createHash('sha1')
			.update(Buffer.from(`blob ${bytes.length}\0`))
			.update(bytes)
			.digest('hex');
		expect(
			decodeOpenChakraBlob(
				{ sha, size: bytes.length, encoding: 'base64', content: bytes.toString('base64') },
				{ sha, size: bytes.length },
			),
		).toEqual(bytes);
		expect(() =>
			decodeOpenChakraBlob(
				{ sha, size: bytes.length, encoding: 'base64', content: 'dGFtcGVyZWQ=' },
				{ sha, size: bytes.length },
			),
		).toThrow('reconstructed Git blob differs');
	});
});
