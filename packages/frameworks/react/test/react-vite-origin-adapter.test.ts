import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'pathe';
import { describe, expect, test } from 'vitest';
import {
	analyzeViteOriginConfig,
	createViteOriginAdapter,
	createViteOriginBuildTargetPlugin,
	createViteOriginClientApiPlugin,
	planViteOriginConfig,
	planViteOriginConfigSource,
	removedViteClientApis,
	resolveVitePreprocessor,
	rewriteRemovedViteClientApis,
	scanRemovedViteClientApis,
	translateViteOriginPlugin,
	viteApplicationModuleResolver,
	viteOriginBuildTarget,
	viteOriginOptionRules,
	viteOriginPluginTranslations,
	viteTwoModulesBuildTarget,
	vitePreprocessorPackages,
	type ViteClientApiRecord,
} from '../src/react-vite-origin-adapter.ts';

/** The era configuration shape this corpus's Vite-2-origin cell actually has. */
const eraConfig = [
	'import { defineConfig } from "vite";',
	'import react from "@vitejs/plugin-react";',
	'',
	'export default defineConfig({',
	'  plugins: [react()],',
	'  server: {',
	'    cors: true,',
	'    proxy: {',
	'      "/api": { target: "http://localhost:8080/", changeOrigin: true },',
	'    },',
	'  },',
	'});',
	'',
].join('\n');

describe('era build target', () => {
	test("expands Vite 2's `modules` default to its literal browser list", () => {
		expect(viteTwoModulesBuildTarget).toEqual([
			'es2020',
			'edge88',
			'firefox78',
			'chrome87',
			'safari14',
		]);
	});

	test('hands out a fresh array a config can own without mutating the constant', () => {
		const first = viteOriginBuildTarget();
		(first as string[]).push('ie11');
		expect(viteOriginBuildTarget()).toEqual([...viteTwoModulesBuildTarget]);
	});

	test('is contributed through the plugin config hook rather than asked of the consumer', () => {
		expect(createViteOriginBuildTargetPlugin().config()).toEqual({
			build: { target: [...viteTwoModulesBuildTarget] },
		});
	});
});

describe('era configuration analysis', () => {
	test('reads the option keys and the imported packages out of a real era config', () => {
		const facts = analyzeViteOriginConfig(eraConfig, 'vite.config.ts');
		expect(facts.optionKeys).toEqual(['plugins', 'server']);
		expect(facts.importedPackages).toEqual(['@vitejs/plugin-react', 'vite']);
		expect(facts.dynamicOptionKeys).toBe(0);
		expect(facts.diagnostics).toEqual([]);
	});

	test('takes the config object, not a nested literal that happens to be larger', () => {
		// The proxy table below has more properties than the config object. Only
		// the config object declares recognisable Vite options, which is what the
		// selection is keyed on.
		const facts = analyzeViteOriginConfig(eraConfig, 'vite.config.ts');
		expect(facts.optionKeys).not.toContain('/api');
		expect(facts.optionKeys).not.toContain('target');
	});

	test('ignores relative imports, which are never plugin packages', () => {
		const facts = analyzeViteOriginConfig(
			`import { defineConfig } from "vite";\nimport local from "./local.ts";\nexport default defineConfig({ root: ".", base: "/" });\n`,
		);
		expect(facts.importedPackages).toEqual(['vite']);
	});

	test('counts a computed option key rather than guessing what it configures', () => {
		const facts = analyzeViteOriginConfig(
			`const k = "base";\nexport default { root: ".", [k]: "/" };\n`,
		);
		expect(facts.dynamicOptionKeys).toBe(1);
	});

	test('reports parser diagnostics instead of returning empty facts as if the file were bare', () => {
		const facts = analyzeViteOriginConfig('export default {{{', 'vite.config.ts');
		expect(facts.diagnostics.length).toBeGreaterThan(0);
		expect(facts.optionKeys).toEqual([]);
	});
});

describe('era configuration plan', () => {
	test('plans every option the era config declares, with its disposition', () => {
		const plan = planViteOriginConfigSource(eraConfig, 'vite.config.ts');
		expect(plan.options.map((option) => option.option)).toEqual(['plugins', 'server']);
		expect(plan.options.map((option) => option.disposition)).toEqual(['translated', 'carried']);
		expect(plan.buildTarget).toEqual([...viteTwoModulesBuildTarget]);
	});

	test('translates the era React plugin and states what a build does not cover', () => {
		const plan = planViteOriginConfigSource(eraConfig, 'vite.config.ts');
		expect(plan.plugins).toHaveLength(1);
		const [react] = plan.plugins;
		expect(react?.package).toBe('@vitejs/plugin-react');
		expect(react?.coverage).toContain('Fast Refresh');
	});

	test('never counts `vite` itself as a plugin to translate', () => {
		const plan = planViteOriginConfigSource(eraConfig, 'vite.config.ts');
		expect(plan.plugins.map((plugin) => plugin.package)).not.toContain('vite');
	});

	test('refuses an option it has no reading for, naming it', () => {
		const facts = analyzeViteOriginConfig(
			'export default { root: ".", optimizeDeps: { include: [] } };',
		);
		expect(() => planViteOriginConfig(facts)).toThrow(/optimizeDeps/);
	});

	test('refuses a plugin it has never been taught, naming it', () => {
		expect(() =>
			planViteOriginConfigSource(
				`import { defineConfig } from "vite";\nimport legacy from "vite-plugin-something";\nexport default defineConfig({ root: ".", plugins: [legacy()] });\n`,
			),
		).toThrow(/vite-plugin-something/);
	});

	test('refuses a computed option key rather than planning around it', () => {
		expect(() =>
			planViteOriginConfigSource(`const k = "base";\nexport default { root: ".", [k]: "/" };\n`),
		).toThrow(/computed/);
	});

	test('refuses an unparseable configuration rather than planning an empty one', () => {
		expect(() => planViteOriginConfigSource('export default {{{')).toThrow(/could not be parsed/);
	});

	test('the superseded standalone refresh plugin translates to no target package', () => {
		expect(translateViteOriginPlugin('@vitejs/plugin-react-refresh')?.target).toBeNull();
		expect(translateViteOriginPlugin('@vitejs/plugin-legacy')).toBeNull();
	});

	test('every option rule and plugin translation states its own coverage', () => {
		for (const rule of Object.values(viteOriginOptionRules))
			expect(rule.note.length).toBeGreaterThan(0);
		for (const translation of Object.values(viteOriginPluginTranslations)) {
			expect(translation.role.length).toBeGreaterThan(0);
			expect(translation.coverage.length).toBeGreaterThan(0);
		}
	});
});

describe('removed Vite client APIs', () => {
	test('rewrites the eager glob import to its current spelling', () => {
		const source = `const pages = import.meta.globEager('./pages/*.tsx');\nexport default pages;\n`;
		expect(rewriteRemovedViteClientApis(source, 'entry.ts')).toBe(
			`const pages = import.meta.glob('./pages/*.tsx', { eager: true });\nexport default pages;\n`,
		);
	});

	test('preserves the argument verbatim, including a template literal', () => {
		const source = 'export const m = import.meta.globEager(`./a/*.js`);\n';
		expect(rewriteRemovedViteClientApis(source, 'entry.ts')).toContain(
			'import.meta.glob(`./a/*.js`, { eager: true })',
		);
	});

	test('rewrites every occurrence in a module', () => {
		const source =
			"const a = import.meta.globEager('./a/*.ts');\nconst b = import.meta.globEager('./b/*.ts');\nexport { a, b };\n";
		const output = rewriteRemovedViteClientApis(source, 'entry.ts');
		expect(output).not.toContain('globEager(');
		expect(output.match(/\{ eager: true \}/g)).toHaveLength(2);
	});

	test('never touches a `globEager` that is not a member of import.meta', () => {
		const source =
			"const shim = { globEager: (p) => p };\nexport const x = shim.globEager('./a/*.ts');\nexport const y = 'globEager';\n";
		expect(rewriteRemovedViteClientApis(source, 'entry.ts')).toBe(source);
	});

	test('returns a module that calls nothing removed byte-identically', () => {
		const source = "export const a = import.meta.glob('./a/*.ts', { eager: true });\n";
		expect(rewriteRemovedViteClientApis(source, 'entry.ts')).toBe(source);
	});

	test('parses TypeScript and TSX by file name, so a type assertion is not a syntax error', () => {
		// This is the defect the migrated lane's first build surfaced: a `.tsx`
		// module parsed as plain JavaScript reports its first `as` cast as a
		// syntax error, and the capability then refuses a build for a reason that
		// is not true. The language now comes from the file name.
		const tsx = 'const root = document.getElementById("root") as HTMLElement;\nexport default <div />;\n';
		expect(scanRemovedViteClientApis(tsx, 'main.tsx').diagnostics).toEqual([]);
		const ts = 'export const n = 1 as number;\n';
		expect(scanRemovedViteClientApis(ts, 'main.ts').diagnostics).toEqual([]);
	});

	test('names every removed API it knows how to restore', () => {
		expect(Object.keys(removedViteClientApis)).toEqual(['globEager']);
	});
});

describe('removed client API plugin', () => {
	const plugin = createViteOriginClientApiPlugin();

	test('leaves dependency modules alone', () => {
		const source = "export const a = import.meta.globEager('./a/*.ts');\n";
		expect(plugin.transform(source, '/app/node_modules/pkg/index.js')).toBeNull();
	});

	test('leaves non-module extensions alone', () => {
		expect(plugin.transform('.a { color: red }', '/app/src/a.css')).toBeNull();
	});

	test('yields null for a module with nothing to rewrite, so Vite loads it unchanged', () => {
		expect(plugin.transform('export const a = 1;\n', '/app/src/a.ts')).toBeNull();
	});

	test('rewrites an application module and reports what it rewrote', () => {
		const records: ViteClientApiRecord[] = [];
		const observing = createViteOriginClientApiPlugin({
			observe: (record) => records.push(record),
		});
		const result = observing.transform(
			"export const a = import.meta.globEager('./a/*.ts');\n",
			'/app/src/a.ts?used',
		);
		expect(result?.code).toContain('{ eager: true }');
		expect(records).toEqual([{ id: '/app/src/a.ts', apis: ['globEager'] }]);
	});

	test('runs before other plugins, because the rewrite must precede any reader', () => {
		expect(plugin.enforce).toBe('pre');
	});
});

describe('CSS preprocessor resolution', () => {
	test('names the package each stylesheet extension needs', () => {
		expect(vitePreprocessorPackages['.less']).toBe('less');
		expect(vitePreprocessorPackages['.scss']).toBe('sass');
	});

	test('resolves a preprocessor present in the application closure', () => {
		const resolver = (specifier: string): string => `/app/node_modules/${specifier}/index.js`;
		expect(resolveVitePreprocessor('.less', resolver, '/app')).toBe(
			'/app/node_modules/less/index.js',
		);
	});

	test('fails naming the extension, the package and where it was searched', () => {
		const resolver = (): string => {
			throw new Error('not found');
		};
		expect(() => resolveVitePreprocessor('.less', resolver, '/app')).toThrow(/"less"/);
		expect(() => resolveVitePreprocessor('.less', resolver, '/app')).toThrow(/\/app/);
	});

	test('an application resolver searches the application root', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'vite-origin-'));
		try {
			await writeFile(path.join(root, 'package.json'), '{"name":"a","version":"0.0.0"}\n');
			const resolver = viteApplicationModuleResolver(root);
			expect(() => resolver('less')).toThrow();
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});

describe('the adapter plugin set', () => {
	test('is the client API restoration followed by the era build target', () => {
		const plugins = createViteOriginAdapter();
		expect(plugins.map((plugin) => plugin.name)).toEqual([
			'versionless-vite-origin-client-api',
			'versionless-vite-origin-build-target',
		]);
	});

	test('carries an observer through to the client API plugin', () => {
		const records: ViteClientApiRecord[] = [];
		const [clientApi] = createViteOriginAdapter({
			observeClientApis: (record) => records.push(record),
		});
		clientApi.transform("export const a = import.meta.globEager('./a/*.ts');\n", '/app/src/a.ts');
		expect(records).toHaveLength(1);
	});

	test('the configuration plan is deliberately not a plugin', () => {
		// A plugin runs inside a build that is already configured, which is far
		// too late to refuse an option nobody has a reading for. The plan is
		// computed before the build so an untranslatable configuration means no
		// build is attempted at all.
		const plugins = createViteOriginAdapter();
		expect(plugins.map((plugin) => plugin.name)).not.toContain('versionless-vite-origin-config');
	});
});
