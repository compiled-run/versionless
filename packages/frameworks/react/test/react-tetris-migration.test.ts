import { createHash } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { planReactTetrisTarget } from '../src/react-tetris-migration.ts';

const identity = (bytes: Buffer): { gitSha: string; size: number } => ({
	gitSha: createHash('sha1')
		.update(Buffer.from(`blob ${bytes.length}\0`))
		.update(bytes)
		.digest('hex'),
	size: bytes.length,
});

describe('React Tetris target plan', () => {
	test('pins React18 and Vite8 without application source changes', () => {
		const bytes = Buffer.from(
			JSON.stringify({
				dependencies: { react: '^15.6.1', 'react-dom': '^15.6.1' },
				scripts: { build: 'webpack -p' },
			}),
		);
		const result = planReactTetrisTarget({
			packageBytes: bytes,
			packageIdentity: identity(bytes),
			adapterSource: "import { defineConfig } from 'vite';",
		});
		expect(result.packageJson).toContain('"react": "18.3.1"');
		expect(result.applicationSourceChanges).toBe(0);
		expect(result.bootstrapCompatibilityRequired).toBe(true);
	});

	test('refuses identity drift', () => {
		const bytes = Buffer.from('{}');
		expect(() =>
			planReactTetrisTarget({
				packageBytes: bytes,
				packageIdentity: { gitSha: 'drift', size: bytes.length },
				adapterSource: "import { defineConfig } from 'vite';",
			}),
		).toThrow('tree-derived package identity differs');
	});
});
