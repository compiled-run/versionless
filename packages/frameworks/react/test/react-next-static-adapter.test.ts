import { describe, expect, test } from 'vitest';
import {
	createNextStaticAdapter,
	createNextStaticLiftPlugin,
	createNextStaticVirtualModulePlugin,
	isNextFrameworkSpecifier,
	liftNextStaticModule,
	nextProcessEnvironmentDefines,
	nextStaticEntryDocument,
	nextStaticEntryModuleId,
	nextStaticEntryModuleSource,
	nextStaticFrameworkLift,
	nextStaticFrameworkLifts,
	nextStaticHeadModuleId,
	nextStaticHeadModuleSource,
	nextStaticLinkModuleId,
	nextStaticLinkModuleSource,
	nextStaticRootElementId,
	nextStaticUnsupportedDataFetchingExports,
	nextStaticUnsupportedSpecifiers,
	planNextBabelPreset,
	planNextBabelPresetSource,
	scanNextStaticSurface,
	type NextStaticLiftRecord,
} from '../src/index.ts';

/**
 * The framework surface table is a claim about what has been read, so the tests
 * below assert its shape rather than trusting it.
 */
describe('the Next static lift table', () => {
	test('lifts exactly the four framework specifiers it claims, and nothing else', () => {
		expect(Object.keys(nextStaticFrameworkLifts).sort()).toEqual([
			'next',
			'next/app',
			'next/head',
			'next/link',
		]);
		expect(nextStaticFrameworkLift('next/head')?.module).toBe(nextStaticHeadModuleId);
		expect(nextStaticFrameworkLift('next/link')?.module).toBe(nextStaticLinkModuleId);
		expect(nextStaticFrameworkLift('next')?.kind).toBe('type-only');
		expect(nextStaticFrameworkLift('next/app')?.kind).toBe('type-only');
	});

	test('a specifier in neither table is still refused, so the refusal is not a lookup', () => {
		expect(nextStaticFrameworkLift('next/future/image')).toBeNull();
		expect(Object.hasOwn(nextStaticUnsupportedSpecifiers, 'next/future/image')).toBe(false);
		expect(() =>
			liftNextStaticModule("import Image from 'next/future/image';\n", 'page.tsx'),
		).toThrow(/never been taught/);
	});

	test('recognises framework specifiers without matching application modules', () => {
		expect(isNextFrameworkSpecifier('next')).toBe(true);
		expect(isNextFrameworkSpecifier('next/head')).toBe(true);
		expect(isNextFrameworkSpecifier('nextcloud')).toBe(false);
		expect(isNextFrameworkSpecifier('./next')).toBe(false);
	});
});

describe('the analyzer-driven surface scan', () => {
	test('rewrites a component import to its lifted module and leaves the binding alone', () => {
		const lifted = liftNextStaticModule(
			[
				"import Head from 'next/head';",
				'export const a = <Head><title>x</title></Head>;',
				'',
			].join('\n'),
			'page.tsx',
		);
		expect(lifted).toContain(`import Head from "${nextStaticHeadModuleId}"`);
		expect(lifted).toContain('<Head><title>x</title></Head>');
	});

	test('erases a type-only import once every binding is proved dead at runtime', () => {
		const lifted = liftNextStaticModule(
			[
				"import type { AppProps } from 'next/app';",
				"import { GetStaticProps } from 'next';",
				'const app: AppProps | null = null;',
				'export const getStaticProps: GetStaticProps = async () => ({ props: {} });',
				'export default app;',
				'',
			].join('\n'),
			'page.tsx',
		);
		expect(lifted).not.toContain('next/app');
		expect(lifted).not.toContain("from 'next'");
		expect(lifted).toContain('export const getStaticProps');
	});

	test('refuses to erase a framework import whose binding is used as a value', () => {
		expect(() =>
			liftNextStaticModule(
				["import App from 'next/app';", 'export default class extends App {}', ''].join(
					'\n',
				),
				'app.tsx',
			),
		).toThrow(/referenced from a value position/);
	});

	test('sees a framework specifier only where the parse puts one', () => {
		const source = [
			"// import Head from 'next/head';",
			'export const note = "next/link is not imported here";',
			'',
		].join('\n');
		expect(liftNextStaticModule(source, 'note.ts')).toBe(source);
		expect(scanNextStaticSurface(source, 'note.ts').imports).toEqual([]);
	});

	test('names the refused framework module rather than failing generically', () => {
		for (const specifier of Object.keys(nextStaticUnsupportedSpecifiers))
			expect(() =>
				liftNextStaticModule(
					`import x from '${specifier}';\nexport default x;\n`,
					'page.tsx',
				),
			).toThrow(specifier);
	});

	test('refuses every data-fetching export outside the one it can lift', () => {
		for (const name of Object.keys(nextStaticUnsupportedDataFetchingExports))
			expect(() =>
				liftNextStaticModule(`export const ${name} = async () => ({});\n`, 'page.tsx'),
			).toThrow(name);
		expect(
			scanNextStaticSurface('export const getStaticProps = async () => ({});\n', 'page.tsx')
				.dataFetchingExports,
		).toEqual(['getStaticProps']);
	});

	test('refuses an asset module import the legacy loader configuration resolved', () => {
		expect(() =>
			liftNextStaticModule(
				"import Logo from './logo.svg';\nexport default Logo;\n",
				'page.tsx',
			),
		).toThrow(/SVG loader/);
	});

	test('a module with no framework surface is returned byte-identical', () => {
		const source = "import { useState } from 'react';\nexport default useState;\n";
		expect(liftNextStaticModule(source, 'thing.tsx')).toBe(source);
	});
});

describe('the lifted framework components', () => {
	test('the head lift applies its children to the live document head', () => {
		const source = nextStaticHeadModuleSource();
		expect(source).toContain("import { createPortal } from 'react-dom';");
		expect(source).toContain('createPortal(children, document.head)');
	});

	test('the link lift reproduces the legacy href-decoration rule and drops router props', () => {
		const source = nextStaticLinkModuleSource();
		expect(source).toContain(
			"const decorate = passHref === true || (child.type === 'a' && child.props.href === undefined);",
		);
		for (const dropped of ['replace', 'scroll', 'shallow', 'prefetch', 'locale'])
			expect(source).toContain(dropped);
		expect(source).toContain('string hrefs only');
	});
});

describe('entry and document synthesis', () => {
	test('composes the framework pages/_app contract and awaits the page data function', () => {
		const source = nextStaticEntryModuleSource({
			appModule: './pages/_app.tsx',
			pageModule: './pages/index.tsx',
			hasStaticProps: true,
		});
		expect(source).toContain("import { render } from 'react-dom';");
		expect(source).toContain('import App from "./pages/_app.tsx";');
		expect(source).toContain('import Page, { getStaticProps } from "./pages/index.tsx";');
		expect(source).toContain('createElement(App, { Component: Page, pageProps })');
		expect(source).toContain('notFound');
		expect(source).toContain('redirect');
	});

	test('mounts the page directly when the application declares no app shell', () => {
		const source = nextStaticEntryModuleSource({
			appModule: null,
			pageModule: './pages/index.tsx',
			hasStaticProps: false,
			mountApi: 'root',
		});
		expect(source).toContain("import { createRoot } from 'react-dom/client';");
		expect(source).toContain('createElement(Page, pageProps)');
		expect(source).toContain('mount({});');
		expect(source).not.toContain('getStaticProps');
	});

	test('the entry document carries the mount element the framework itself emits', () => {
		const document = nextStaticEntryDocument({ entryModule: '/entry.js' });
		expect(document).toContain(`<div id="${nextStaticRootElementId}"></div>`);
		expect(document).toContain('<script type="module" src="/entry.js"></script>');
		expect(document).toContain('<html>');
		expect(nextStaticEntryDocument({ entryModule: '/entry.js', lang: 'en' })).toContain(
			'<html lang="en">',
		);
	});
});

describe('the compile-time environment', () => {
	test('defines every key the framework inlines, plus the object itself', () => {
		expect(
			nextProcessEnvironmentDefines({ mode: 'production', NODE_ENV: 'production' }),
		).toEqual({
			'process.env.NODE_ENV': '"production"',
			'process.env.mode': '"production"',
			'process.env': '{"NODE_ENV":"production","mode":"production"}',
		});
	});
});

describe('the next/babel preset translation', () => {
	test('reads the JSX import source the legacy preset pointed the runtime at', () => {
		const plan = planNextBabelPresetSource(
			JSON.stringify({
				presets: [
					[
						'next/babel',
						{ 'preset-react': { runtime: 'automatic', importSource: '@x/react' } },
					],
				],
				plugins: ['@emotion/babel-plugin'],
			}),
		);
		expect(plan.jsx).toEqual({ runtime: 'automatic', importSource: '@x/react' });
		expect(plan.omittedPlugins).toEqual(['@emotion/babel-plugin']);
		expect(plan.notes[0]).toContain('generated class names');
	});

	test('falls back to the preset default when no react options are stated', () => {
		expect(planNextBabelPreset({ presets: ['next/babel'] }).jsx).toEqual({
			runtime: 'automatic',
			importSource: null,
		});
	});

	test('refuses a preset or plugin it has not read', () => {
		expect(() => planNextBabelPreset({ presets: ['next/babel', '@babel/preset-env'] })).toThrow(
			'@babel/preset-env',
		);
		expect(() =>
			planNextBabelPreset({
				presets: ['next/babel'],
				plugins: ['babel-plugin-styled-components'],
			}),
		).toThrow('babel-plugin-styled-components');
	});

	test('refuses a document it cannot read as a Babel configuration', () => {
		expect(() => planNextBabelPresetSource('{')).toThrow(/not readable as JSON/);
		expect(() => planNextBabelPreset(null)).toThrow(/not a Babel configuration/);
	});
});

describe('the adapter plugin set', () => {
	test('the lift plugin leaves the dependency closure alone', () => {
		const plugin = createNextStaticLiftPlugin();
		expect(
			plugin.transform("import Head from 'next/head';\n", '/app/node_modules/thing/index.js'),
		).toBeNull();
		expect(
			plugin.transform("import Head from 'next/head';\n", '/app/pages/index.tsx'),
		).not.toBeNull();
	});

	test('the lift plugin reports the surface it lifted', () => {
		const records: NextStaticLiftRecord[] = [];
		const plugin = createNextStaticLiftPlugin({ observe: (record) => records.push(record) });
		plugin.transform(
			"import Head from 'next/head';\nexport const getStaticProps = async () => ({});\n",
			'/app/pages/index.tsx',
		);
		expect(records).toHaveLength(1);
		expect(records[0]?.imports.map((entry) => entry.specifier)).toEqual(['next/head']);
		expect(records[0]?.dataFetchingExports).toEqual(['getStaticProps']);
	});

	test('the virtual plugin serves the lifted components, and the entry only when asked', () => {
		const bare = createNextStaticVirtualModulePlugin();
		expect(bare.resolveId(nextStaticHeadModuleId)).toBe(`\0${nextStaticHeadModuleId}`);
		expect(bare.resolveId(nextStaticEntryModuleId)).toBeNull();
		expect(bare.load(`\0${nextStaticLinkModuleId}`)).toContain('cloneElement');
		const withEntry = createNextStaticVirtualModulePlugin({
			entry: { appModule: null, pageModule: './page.tsx', hasStaticProps: false },
		});
		expect(withEntry.load(`\0${nextStaticEntryModuleId}`)).toContain(
			'import Page from "./page.tsx";',
		);
	});

	test('the adapter is the lift followed by the modules it rewrites to', () => {
		const plugins = createNextStaticAdapter();
		expect(plugins.map((plugin) => plugin.name)).toEqual([
			'versionless-next-static-lift',
			'versionless-next-static-virtual-modules',
		]);
		for (const plugin of plugins) expect(plugin.enforce).toBe('pre');
	});
});
