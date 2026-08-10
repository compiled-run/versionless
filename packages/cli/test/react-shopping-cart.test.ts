import { createHash } from 'node:crypto';
import { afterEach, describe, expect, test } from 'vitest';
import {
	SHOPPING_CART_CONSENT,
	REJECTED_SHOPPING_CART_CONSENT,
	analyzeLegacyShoppingCartYarnLock,
	assertShoppingCartConsent,
	assertShoppingCartUrl,
	decodeShoppingCartBlob,
} from '../src/fixture/react-shopping-cart-ingest.ts';

const originalMode = process.env.VERSIONLESS_NETWORK_MODE;
const originalConsent = process.env.VERSIONLESS_CONSENT_ID;

afterEach(() => {
	if (originalMode === undefined) delete process.env.VERSIONLESS_NETWORK_MODE;
	else process.env.VERSIONLESS_NETWORK_MODE = originalMode;
	if (originalConsent === undefined) delete process.env.VERSIONLESS_CONSENT_ID;
	else process.env.VERSIONLESS_CONSENT_ID = originalConsent;
});

describe('Shopping Cart bounded ingest', () => {
	test('requires exact one-shot consent', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = SHOPPING_CART_CONSENT;
		expect(() =>
			assertShoppingCartConsent(['--acquire', '--consent-id', SHOPPING_CART_CONSENT]),
		).not.toThrow();
		expect(() => assertShoppingCartConsent(['--acquire', '--consent-id', 'stale'])).toThrow();
		expect(() =>
			assertShoppingCartConsent([
				'--acquire',
				'--consent-id',
				REJECTED_SHOPPING_CART_CONSENT,
			]),
		).toThrow();
	});

	test('classifies historical SHA-1 and modern SHA-512 evidence honestly', () => {
		const rows = ['# yarn lockfile v1', ''];
		for (let index = 0; index < 100; index += 1)
			rows.push(
				`package-${index}@1.0.0:`,
				'  version "1.0.0"',
				`  resolved "https://registry.yarnpkg.com/package-${index}/-/package-${index}-1.0.0.tgz#${'a'.repeat(40)}"`,
				...(index === 0
					? [`  integrity sha512-${Buffer.alloc(64, 1).toString('base64')}`]
					: []),
				'',
			);
		const result = analyzeLegacyShoppingCartYarnLock(Buffer.from(rows.join('\n')));
		expect(result.artifacts).toHaveLength(100);
		expect(result.weaknessCounts).toEqual({
			'strong-modern': 1,
			'historical-sha1-only': 99,
			'missing-integrity-but-immutable-registry': 0,
		});
	});

	test('rejects mutable, ambiguous, or checksum-free Yarn entries', () => {
		const suffix = 'a'.repeat(40);
		const make = (resolved: string, selector = 'package@1.0.0'): Buffer => {
			const rows = ['# yarn lockfile v1', ''];
			for (let index = 0; index < 100; index += 1)
				rows.push(
					`${index === 0 ? selector : `safe-${index}@1.0.0`}:`,
					'  version "1.0.0"',
					`  resolved "${index === 0 ? resolved : `https://registry.yarnpkg.com/safe-${index}/-/safe-${index}-1.0.0.tgz#${suffix}`}"`,
					'',
				);
			return Buffer.from(rows.join('\n'));
		};
		for (const bytes of [
			make(`https://example.com/package.tgz#${suffix}`),
			make(`https://registry.yarnpkg.com/package/-/package-1.0.0.tgz?moving=true#${suffix}`),
			make(`https://user@registry.yarnpkg.com/package/-/package-1.0.0.tgz#${suffix}`),
			make('https://registry.yarnpkg.com/package/-/package-1.0.0.tgz'),
			make(
				`https://registry.yarnpkg.com/package/-/package-1.0.0.tgz#${suffix}`,
				'other@1.0.0',
			),
		])
			expect(() => analyzeLegacyShoppingCartYarnLock(bytes)).toThrow();
	});

	test('allows only an exact credential-free official HTTPS source', () => {
		const exact = 'https://api.github.com/repos/jeffersonRibeiro/react-shopping-cart';
		const allowed = new Set([exact]);
		expect(() => assertShoppingCartUrl(exact, allowed)).not.toThrow();
		for (const url of [
			'http://api.github.com/repos/jeffersonRibeiro/react-shopping-cart',
			'https://user@api.github.com/repos/jeffersonRibeiro/react-shopping-cart',
			`${exact}?moving=true`,
			`${exact}#fragment`,
			'https://example.com/cart',
		])
			expect(() => assertShoppingCartUrl(url, allowed)).toThrow('outside exact consent');
	});

	test('reconstructs exact tree-bound Git blob content', () => {
		const bytes = Buffer.from('{"name":"react-shopping-cart"}\n');
		const sha = createHash('sha1')
			.update(Buffer.from(`blob ${bytes.length}\0`))
			.update(bytes)
			.digest('hex');
		expect(
			decodeShoppingCartBlob(
				{ sha, size: bytes.length, encoding: 'base64', content: bytes.toString('base64') },
				{ sha, size: bytes.length },
			),
		).toEqual(bytes);
		expect(() =>
			decodeShoppingCartBlob(
				{ sha, size: bytes.length, encoding: 'base64', content: 'dGFtcGVyZWQ=' },
				{ sha, size: bytes.length },
			),
		).toThrow('reconstructed Git blob differs');
	});
});
