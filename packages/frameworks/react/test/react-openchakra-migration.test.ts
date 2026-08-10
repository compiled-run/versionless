import { createHash } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { planOpenChakraVite8Migration } from '../src/react-openchakra-migration.ts';

function identity(bytes: Buffer): { gitSha: string; size: number } {
	return {
		gitSha: createHash('sha1')
			.update(Buffer.from(`blob ${bytes.length}\0`))
			.update(bytes)
			.digest('hex'),
		size: bytes.length,
	};
}

describe('OpenChakra bounded Vite 8 migration', () => {
	test('plans no application source changes for a tree-bound React 16 package', () => {
		const bytes = Buffer.from(
			JSON.stringify({
				dependencies: { react: '^16.13.1' },
				scripts: { build: 'react-scripts build' },
			}),
		);
		const result = planOpenChakraVite8Migration({
			packageBytes: bytes,
			packageIdentity: identity(bytes),
			adapterSource: "import { defineConfig } from 'vite';",
		});
		expect(result.applicationSourceChanges).toBe(0);
		expect(result.packageJson).toContain('"vite": "8.0.16"');
	});

	test('refuses identity drift and webpack fallback', () => {
		const bytes = Buffer.from('{}');
		expect(() =>
			planOpenChakraVite8Migration({
				packageBytes: bytes,
				packageIdentity: { gitSha: 'drift', size: bytes.length },
				adapterSource: "import { defineConfig } from 'vite';",
			}),
		).toThrow('tree-derived package identity differs');
	});
});
