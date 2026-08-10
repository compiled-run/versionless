import { createHash } from 'node:crypto';
import { afterEach, describe, expect, test } from 'vitest';
import {
	REACT_TETRIS_CONSENT,
	assertReactTetrisConsent,
	assertReactTetrisUrl,
	decodeReactTetrisBlob,
} from '../src/fixture/react-tetris-ingest.ts';

const originalMode = process.env.VERSIONLESS_NETWORK_MODE;
const originalConsent = process.env.VERSIONLESS_CONSENT_ID;

afterEach(() => {
	if (originalMode === undefined) delete process.env.VERSIONLESS_NETWORK_MODE;
	else process.env.VERSIONLESS_NETWORK_MODE = originalMode;
	if (originalConsent === undefined) delete process.env.VERSIONLESS_CONSENT_ID;
	else process.env.VERSIONLESS_CONSENT_ID = originalConsent;
});

describe('React Tetris bounded ingest', () => {
	test('requires exact one-shot consent', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = REACT_TETRIS_CONSENT;
		expect(() =>
			assertReactTetrisConsent(['--acquire', '--consent-id', REACT_TETRIS_CONSENT]),
		).not.toThrow();
		expect(() => assertReactTetrisConsent(['--acquire', '--consent-id', 'stale'])).toThrow();
	});

	test('restricts requests to exact credential-free official HTTPS URLs', () => {
		const exact = 'https://api.github.com/repos/chvin/react-tetris';
		const allowed = new Set([exact]);
		expect(() => assertReactTetrisUrl(exact, allowed)).not.toThrow();
		for (const url of [
			'http://api.github.com/repos/chvin/react-tetris',
			'https://user@api.github.com/repos/chvin/react-tetris',
			`${exact}?moving=true`,
			`${exact}#fragment`,
			'https://example.com/tetris',
		])
			expect(() => assertReactTetrisUrl(url, allowed)).toThrow('outside exact consent');
	});

	test('reconstructs exact Git blob content', () => {
		const bytes = Buffer.from('{"name":"react-tetris"}\n');
		const sha = createHash('sha1')
			.update(Buffer.from(`blob ${bytes.length}\0`))
			.update(bytes)
			.digest('hex');
		expect(
			decodeReactTetrisBlob(
				{ sha, size: bytes.length, encoding: 'base64', content: bytes.toString('base64') },
				{ sha, size: bytes.length },
			),
		).toEqual(bytes);
		expect(() =>
			decodeReactTetrisBlob(
				{ sha, size: bytes.length, encoding: 'base64', content: 'dGFtcGVyZWQ=' },
				{ sha, size: bytes.length },
			),
		).toThrow('reconstructed Git blob differs');
	});
});
