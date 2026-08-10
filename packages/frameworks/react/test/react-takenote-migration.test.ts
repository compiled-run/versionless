import { describe, expect, it } from 'vitest';
import {
	planTakeNoteSassCompatibility,
	planTakeNoteVite8Migration,
} from '../src/react-takenote-migration.ts';

describe('TakeNote compatibility and Vite migrations', () => {
	it('refuses any package other than the immutable React16/custom-webpack input', () => {
		expect(() =>
			planTakeNoteSassCompatibility(Buffer.from('{}'), { gitSha: 'not-the-blob', size: 2 }),
		).toThrow('immutable tree-derived package identity differs');
	});

	it('refuses webpack and service-worker fallback in the target adapter', () => {
		for (const forbidden of ['webpack', 'serviceWorker'])
			expect(() =>
				planTakeNoteVite8Migration({
					compatiblePackageJson: JSON.stringify({ devDependencies: { sass: '1.32.13' } }),
					adapterSource: `import { defineConfig } from 'vite'; 'process.env.DEMO'; ${forbidden}`,
				}),
			).toThrow('bounded Vite 8 migration differs');
	});
});
