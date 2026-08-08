import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../../..');

describe('React Boilerplate Vite 8 fixture', () => {
	it('pins the real corpus, maintained runtime, root Vite, and fixture adapter', async () => {
		const manifest = JSON.parse(
			await readFile(
				path.join(root, 'fixtures/react-boilerplate-v4-vite8/fixture.json'),
				'utf8',
			),
		) as Record<string, any>;
		expect(manifest.source.revision).toBe('d19099afeff64ecfb09133c06c1cb18c0d40887e');
		expect(manifest.source.license).toBe('MIT');
		expect(manifest.runtime).toMatchObject({ version: '24.15.0', platform: 'darwin-arm64' });
		expect(manifest.vite).toMatchObject({ version: '8.0.16' });
		expect(manifest.vite.config).toBe('fixtures/react-boilerplate-v4-vite8/vite.adapter.ts');
	});

	it('keeps the adapter strict TypeScript and records all required utilities', async () => {
		const adapter = await readFile(
			path.join(root, 'fixtures/react-boilerplate-v4-vite8/vite.adapter.ts'),
			'utf8',
		);
		for (const utility of ['magic-regexp', 'pathe', 'ufo']) expect(adapter).toContain(utility);
		expect(adapter).toContain('transformWithOxc');
		expect(adapter).toContain(
			'const cacheName = `versionless-react-vite8-${sha256(manifestBody)}`',
		);
		expect(adapter).toContain('caches.open(CACHE_NAME).then(cache => cache.match(cacheKey))');
		expect(adapter).not.toContain("const CACHE_NAME = 'versionless-react-vite8-v1'");
		expect(adapter).not.toContain('caches.match(cacheKey)');
	});

	it('derives the shared profile from the immutable fixture adapter and core kernel', async () => {
		const profile = await readFile(
			path.join(root, 'fixtures/react-boilerplate-v4-vite8/vite.shared-adapter.ts'),
			'utf8',
		);
		expect(profile).toContain("import adapter from './vite.adapter.ts'");
		expect(profile).toContain('createVite8AdapterKernel');
		expect(profile).toContain("profile: 'react-boilerplate-v4'");
	});
});
