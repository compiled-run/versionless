import { createHash } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { planExcalidrawV011Migration } from '../src/react-excalidraw-v011-migration.ts';

function identity(bytes: Buffer): { gitSha: string; size: number } {
	return {
		gitSha: createHash('sha1')
			.update(Buffer.from(`blob ${bytes.length}\0`))
			.update(bytes)
			.digest('hex'),
		size: bytes.length,
	};
}

describe('historical Excalidraw Vite 8 adapter plan', () => {
	test('accepts a tree-bound React 17 package without application source changes', () => {
		const bytes = Buffer.from(
			JSON.stringify({ dependencies: { react: '17.0.2' }, scripts: { build: 'original' } }),
		);
		const result = planExcalidrawV011Migration({
			packageBytes: bytes,
			packageIdentity: identity(bytes),
			adapterSource: "import { defineConfig } from 'vite';",
		});
		expect(result.applicationSourceChanges).toBe(0);
		expect(result.packageJson).toContain('"vite": "8.0.16"');
	});

	test('refuses identity drift and forbidden fallback adapters', () => {
		const bytes = Buffer.from('{}');
		expect(() =>
			planExcalidrawV011Migration({
				packageBytes: bytes,
				packageIdentity: { gitSha: 'drift', size: bytes.length },
				adapterSource: "import { defineConfig } from 'vite';",
			}),
		).toThrow('tree-derived package identity differs');
		const react = Buffer.from(
			JSON.stringify({ dependencies: { react: '17.0.2' }, scripts: { build: 'x' } }),
		);
		expect(() =>
			planExcalidrawV011Migration({
				packageBytes: react,
				packageIdentity: identity(react),
				adapterSource: "import { defineConfig } from 'vite'; webpack",
			}),
		).toThrow('bounded Vite 8 migration differs');
	});
});
