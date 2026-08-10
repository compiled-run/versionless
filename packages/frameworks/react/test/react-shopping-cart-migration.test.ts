import { createHash } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { planShoppingCartVite8Migration } from '../src/react-shopping-cart-migration.ts';

const identity = (bytes: Buffer): { gitSha: string; size: number } => ({
	gitSha: createHash('sha1')
		.update(Buffer.from(`blob ${bytes.length}\0`))
		.update(bytes)
		.digest('hex'),
	size: bytes.length,
});

describe('Shopping Cart bounded Vite 8 migration', () => {
	test('preserves application sources for exact React 16 package input', () => {
		const bytes = Buffer.from(
			JSON.stringify({
				dependencies: { react: '^16.13.1' },
				scripts: { build: 'react-scripts build' },
			}),
		);
		const result = planShoppingCartVite8Migration({
			packageBytes: bytes,
			packageIdentity: identity(bytes),
			adapterSource: "import { defineConfig } from 'vite';",
		});
		expect(result.applicationSourceChanges).toBe(0);
		expect(result.packageJson).toContain('"vite": "8.0.16"');
	});

	test('refuses tree identity drift', () => {
		const bytes = Buffer.from('{}');
		expect(() =>
			planShoppingCartVite8Migration({
				packageBytes: bytes,
				packageIdentity: { gitSha: 'drift', size: bytes.length },
				adapterSource: "import { defineConfig } from 'vite';",
			}),
		).toThrow('tree-derived package identity differs');
	});
});
