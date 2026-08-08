import { describe, expect, it } from 'vitest';
import type { ArchiveIndex } from '../../../core/src/corpus/tier-f-provenance.ts';
import { classifyNextjsProvenanceArchive } from '../src/provenance-classify.ts';

function archive(overrides: Record<string, string> = {}): ArchiveIndex {
	const sources: Record<string, string> = {
		'package.json': JSON.stringify({
			dependencies: { next: '^12.0.10', react: '^17.0.2' },
			scripts: { build: 'next build', dev: 'next dev' },
		}),
		'yarn.lock': '# yarn lockfile v1\n',
		'pages/index.tsx': 'export const getStaticProps = async () => ({ props: {} });',
		'playwright.config.ts': "import { defineConfig } from '@playwright/test';",
		'.github/workflows/playwright.yml': 'run: yarn playwright test',
		'next.config.js': "use: ['@svgr/webpack']",
		'components/Search/index.tsx': 'export const Search = () => null;',
		...overrides,
	};
	return {
		root: 'fixture',
		manifestSha256: 'manifest',
		globalMetadata: null,
		pathMetadata: [],
		files: Object.entries(sources).map(([path, source]) => {
			const bytes = Buffer.from(source);
			return { path, bytes, byteLength: bytes.byteLength, sha256: path };
		}),
	};
}

describe('Next.js provenance archive adapter', () => {
	it('independently derives only exact static Next12 source facts', () => {
		const facts = classifyNextjsProvenanceArchive(archive());
		expect(facts).toMatchObject({
			next: { declaration: '^12.0.10', major: 12 },
			react: { declaration: '^17.0.2' },
			packageManager: { name: 'yarn', lockfile: 'yarn.lock', format: 'v1' },
			routing: { mode: 'pages', evidence: ['pages/index.tsx'] },
			staticGeneration: { kind: 'getStaticProps' },
			playwright: { state: 'present-not-executed' },
			productionStack: {
				owner: 'candidate',
				framework: 'nextjs',
				bundler: 'webpack',
				customLoader: '@svgr/webpack',
				preserved: true,
				viteReplacement: false,
				unpluginReplacement: false,
				compatibility: 'not-tested',
			},
			searchPath: 'components/Search/index.tsx',
		});
		expect(facts.scripts).toEqual([
			{ name: 'build', command: 'next build' },
			{ name: 'dev', command: 'next dev' },
		]);
	});

	it('rejects altered or missing Next, React, Yarn, Pages, Playwright, webpack, Search, and script evidence', () => {
		const mutations: Array<Record<string, string>> = [
			{
				'package.json': JSON.stringify({
					dependencies: { next: '^13.0.0', react: '^17.0.2' },
					scripts: { build: 'next build' },
				}),
			},
			{
				'package.json': JSON.stringify({
					dependencies: { next: '^12.0.10' },
					scripts: { build: 'next build' },
				}),
			},
			{ 'yarn.lock': 'yarn metadata v2' },
			{ 'pages/index.tsx': 'export default function Page() {}' },
			{ 'playwright.config.ts': 'export default {}' },
			{ '.github/workflows/playwright.yml': 'run: yarn test' },
			{ 'next.config.js': 'module.exports = {}' },
			{ 'components/Search/index.tsx': '' },
			{
				'package.json': JSON.stringify({
					dependencies: { next: '^12.0.10', react: '^17.0.2' },
					scripts: {},
				}),
			},
		];
		for (const override of mutations)
			expect(() => classifyNextjsProvenanceArchive(archive(override))).toThrow();
	});
});
