import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import { classifyNextjsDescriptor } from '../src/classify.ts';

const fixtureDir = path.join(import.meta.dirname, 'fixtures');

async function fixture(name: string): Promise<Record<string, unknown>> {
	return JSON.parse(await readFile(path.join(fixtureDir, name), 'utf8')) as Record<
		string,
		unknown
	>;
}

describe('Next.js first-class classification', () => {
	it('classifies explicit Pages, mixed transition, and App Router descriptors', async () => {
		const pages = classifyNextjsDescriptor(await fixture('next12-pages.json')).inventory;
		const mixed = classifyNextjsDescriptor(await fixture('next13-app.json')).inventory;
		const app = classifyNextjsDescriptor(await fixture('next14-app.json')).inventory;
		expect(pages.routing).toMatchObject({ mode: 'pages', app: [] });
		expect(mixed.routing).toMatchObject({ mode: 'mixed' });
		expect(mixed.boundaries).toMatchObject({
			apiRoutes: ['app/api/search/route.ts'],
			middleware: ['middleware.ts'],
		});
		expect(app.routing).toMatchObject({ mode: 'app', pages: [] });
		expect(app.localityBoundaries.database).toEqual({
			state: 'present',
			details: ['synthetic database boundary'],
		});
		for (const result of [pages, mixed, app]) {
			expect(result.framework).toBe('nextjs');
			expect(result.productionStack).toMatchObject({
				owner: 'nextjs',
				preserved: true,
				viteReplacement: false,
				unpluginReplacement: false,
			});
		}
	});

	it('preserves unknown rendering, compiler, runtime, and locality facts', async () => {
		const result = classifyNextjsDescriptor(await fixture('next12-pages.json')).inventory;
		expect(result.rendering.isr).toEqual({ state: 'unknown', evidence: [] });
		expect(result.productionStack.compiler).toBe('unknown');
		expect(result.runtime.node).toEqual({ state: 'unknown', value: null });
		expect(result.localityBoundaries.payment).toEqual({ state: 'unknown', details: [] });
	});

	it('refuses inferred, contradictory, duplicate, nonportable, and hidden facts', async () => {
		const original = await fixture('next13-app.json');
		const cases: Array<[string, (value: Record<string, any>) => void]> = [
			['generic React uplift', (value) => (value.framework = 'react')],
			['version-only rendering inference', (value) => delete value.rendering.rsc],
			['contradictory router mode', (value) => (value.routing.mode = 'app')],
			['duplicate route', (value) => value.routing.app.push(value.routing.app[0])],
			['nonportable route', (value) => (value.routing.app[0] = '../app/page.tsx')],
			['hidden auth boundary', (value) => delete value.localityBoundaries.auth],
			['hidden egress origins', (value) => delete value.localityBoundaries.egress.origins],
			['Vite replacement', (value) => (value.productionStack.viteReplacement = true)],
			['unplugin replacement', (value) => (value.productionStack.unpluginReplacement = true)],
			['execution request', (value) => (value.executionRequested = true)],
			['support claim', (value) => (value.supportClaim = true)],
		];
		for (const [label, mutate] of cases) {
			const value = structuredClone(original);
			mutate(value);
			expect(() => classifyNextjsDescriptor(value), label).toThrow();
		}
	});

	it('does not infer SWC, webpack, Turbopack, or features from the Next version', async () => {
		const value = await fixture('next14-app.json');
		const productionStack = value.productionStack as Record<string, unknown>;
		productionStack.compiler = 'unknown';
		productionStack.bundler = 'unknown';
		const rendering = value.rendering as Record<string, Record<string, unknown>>;
		rendering.ssr = { state: 'unknown', evidence: [] };
		rendering.isr = { state: 'unknown', evidence: [] };
		const result = classifyNextjsDescriptor(value).inventory;
		expect(result.productionStack.compiler).toBe('unknown');
		expect(result.productionStack.bundler).toBe('unknown');
		expect(result.rendering.ssr.state).toBe('unknown');
		expect(result.rendering.isr.state).toBe('unknown');
	});
});
