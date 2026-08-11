import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createContext, runInContext } from 'node:vm';
import * as path from 'pathe';
import { build } from 'vite';
import { describe, expect, test } from 'vitest';
import {
	craApplicationModuleResolver,
	craEntryDocument,
	craGlobalIdentifierDefines,
	craNodeCoreModuleName,
	craNodeCoreShimPackage,
	craNodeGlobalsBootstrapSource,
	craNodeGlobalsModuleId,
	craProcessEnvironmentDefines,
	craPublicAssetPaths,
	craWebpackNodeCoreShimSpecifiers,
	craWebpackNodeInjectedGlobals,
	createCraGlobalIdentifierPlugin,
	createCraNodeCoreModulePlugin,
	createCraPublicDirectoryPlugin,
	createCraTildeCssImportPlugin,
	createCraViteAdapter,
	resolveCraNodeCoreModule,
	rewriteWebpackTildeCssImports,
	substituteCraTemplatePlaceholders,
} from '../src/react-cra-vite-adapter.ts';

const template = [
	'<!DOCTYPE html>',
	'<html lang="en">',
	'  <head>',
	'    <link rel="icon" href="%PUBLIC_URL%/logo.svg" />',
	'    <script src="https://example.invalid/tag?id=%REACT_APP_ANALYTICS_ID%"></script>',
	'  </head>',
	'  <body>',
	'    <div id="root"></div>',
	'  </body>',
	'</html>',
	'',
].join('\n');

describe('create-react-app template placeholders', () => {
	test('substitutes provided keys and preserves unknown placeholders', () => {
		const result = substituteCraTemplatePlaceholders(template, { PUBLIC_URL: '' });
		expect(result).toContain('href="/logo.svg"');
		expect(result).toContain('id=%REACT_APP_ANALYTICS_ID%');
	});
	test('honours a non-root public url for every occurrence', () => {
		const result = substituteCraTemplatePlaceholders(
			'%PUBLIC_URL%/a %PUBLIC_URL%/b',
			{ PUBLIC_URL: '/console' },
		);
		expect(result).toBe('/console/a /console/b');
	});
	test('injects the entry module before the closing body tag', () => {
		const document = craEntryDocument({
			template,
			entryModule: '/src/index.tsx',
			environment: { PUBLIC_URL: '' },
		});
		const script = '<script type="module" src="/src/index.tsx"></script>';
		expect(document).toContain(script);
		expect(document.indexOf(script)).toBeLessThan(document.indexOf('</body>'));
		expect(document.indexOf('<div id="root">')).toBeLessThan(document.indexOf(script));
		expect(craEntryDocument({ template, entryModule: '/src/index.tsx' })).toContain(
			'%PUBLIC_URL%/logo.svg',
		);
	});
	test('appends the entry module when no body tag is present', () => {
		const document = craEntryDocument({ template: '<div id="root"></div>', entryModule: '/main.js' });
		expect(document).toBe('<div id="root"></div>\n<script type="module" src="/main.js"></script>\n');
	});
});

describe('create-react-app process environment defines', () => {
	test('inlines each key and the whole environment in sorted order', () => {
		const defines = craProcessEnvironmentDefines({
			PUBLIC_URL: '',
			NODE_ENV: 'production',
			REACT_APP_API: 'https://example.invalid',
		});
		expect(defines['process.env.NODE_ENV']).toBe('"production"');
		expect(defines['process.env.PUBLIC_URL']).toBe('""');
		expect(defines['process.env.REACT_APP_API']).toBe('"https://example.invalid"');
		expect(defines['process.env']).toBe(
			'{"NODE_ENV":"production","PUBLIC_URL":"","REACT_APP_API":"https://example.invalid"}',
		);
		expect(craProcessEnvironmentDefines({})).toEqual({ 'process.env': '{}' });
	});
});

/**
 * webpack 4 — the bundler create-react-app 3 and 4 pin — declares `global` in
 * its own runtime for browser targets, so every dependency written against
 * Node's `global` keeps evaluating inside a webpack bundle. Vite declares
 * nothing of the sort, so those same dependencies reach the browser with a free
 * `global` reference and throw `ReferenceError: global is not defined` before
 * the application can mount. The control build below is that failure, observed
 * rather than asserted from memory; the adapted build is the fix.
 */
describe('the ambient webpack global identifier', () => {
	const dependencySource = [
		// The shape era dependencies use: an unguarded feature probe on `global`.
		'export const scheduler =',
		"	typeof global.queueMicrotask === 'function'",
		"		? 'queueMicrotask'",
		"		: typeof global.MutationObserver === 'function'",
		"			? 'mutation-observer'",
		"			: 'timeout';",
		'export const sameRealm = global === globalThis;',
		'export const untouched = { global: 1 };',
		'export const shadowed = ((global) => global)("local");',
		'',
	].join('\n');

	async function buildProbe(withAdapter: boolean): Promise<string> {
		const root = await mkdtemp(path.join(tmpdir(), 'versionless-cra-global-'));
		try {
			await writeFile(path.join(root, 'dependency.js'), dependencySource);
			await writeFile(
				path.join(root, 'entry.js'),
				[
					"import { sameRealm, scheduler, shadowed, untouched } from './dependency.js';",
					'export const probe = { sameRealm, scheduler, shadowed, untouched };',
					'',
				].join('\n'),
			);
			const outDir = path.join(root, 'dist');
			await build({
				root,
				logLevel: 'silent',
				plugins: withAdapter ? [createCraGlobalIdentifierPlugin()] : [],
				build: {
					outDir,
					minify: false,
					lib: {
						entry: path.join(root, 'entry.js'),
						formats: ['iife'],
						name: 'probe',
						fileName: () => 'probe.js',
					},
				},
			});
			return await readFile(path.join(outDir, 'probe.js'), 'utf8');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	}

	function evaluateInBrowserLikeRealm(code: string): Record<string, unknown> {
		// A realm with no `global` binding, exactly like a browser window.
		const context = createContext({ queueMicrotask: (task: () => void) => task() });
		runInContext(code, context);
		return (context as { probe?: { probe?: Record<string, unknown> } }).probe
			?.probe as Record<string, unknown>;
	}

	test('an unadapted build throws the webpack-provided identifier away', async () => {
		const code = await buildProbe(false);
		expect(code).toContain('global.queueMicrotask');
		expect(() => evaluateInBrowserLikeRealm(code)).toThrow('global is not defined');
	});

	test('the adapted build evaluates and resolves global to globalThis', async () => {
		const code = await buildProbe(true);
		expect(code).not.toContain('global.queueMicrotask');
		expect(code).toContain('globalThis.queueMicrotask');
		const probe = evaluateInBrowserLikeRealm(code);
		expect(probe.scheduler).toBe('queueMicrotask');
		expect(probe.sameRealm).toBe(true);
		// Only the free identifier moves: property keys and local bindings stay.
		expect(probe.untouched).toEqual({ global: 1 });
		expect(probe.shadowed).toBe('local');
	});

	test('the define map is one frozen entry and rides the plugin configuration', () => {
		const defines = craGlobalIdentifierDefines();
		expect(defines).toEqual({ global: 'globalThis' });
		expect(Object.isFrozen(defines)).toBe(true);
		const plugin = createCraGlobalIdentifierPlugin();
		expect(plugin.name).toBe('versionless-cra-global-identifier');
		expect(plugin.config()).toEqual({ define: { global: 'globalThis' } });
	});
});

/**
 * webpack 4 resolved Node core modules to browser shim packages drawn from the
 * application's own dependency closure. Vite treats every builtin as external
 * and emits a `__vite-browser-external` stub, so `require('stream')` yields
 * undefined and the first dependency that reads a property off it dies at load.
 * The control build below is that failure, observed rather than recalled; the
 * adapted build is the fix.
 */
describe('webpack automatic Node core module polyfills', () => {
	async function writeShimClosure(root: string): Promise<void> {
		const modules = path.join(root, 'node_modules');
		await mkdir(path.join(modules, 'util'), { recursive: true });
		await mkdir(path.join(modules, 'stream-browserify'), { recursive: true });
		await writeFile(
			path.join(root, 'package.json'),
			`${JSON.stringify({ name: 'closure-under-test', version: '0.0.0' })}\n`,
		);
		await writeFile(
			path.join(modules, 'util/package.json'),
			`${JSON.stringify({ name: 'util', version: '0.12.0', main: 'util.js' })}\n`,
		);
		await writeFile(
			path.join(modules, 'util/util.js'),
			[
				'exports.inherits = function inherits(ctor, superCtor) {',
				'	ctor.super_ = superCtor;',
				'	ctor.prototype = Object.create(superCtor.prototype, {',
				'		constructor: { value: ctor, enumerable: false, writable: true },',
				'	});',
				'};',
				'',
			].join('\n'),
		);
		await writeFile(
			path.join(modules, 'stream-browserify/package.json'),
			`${JSON.stringify({ name: 'stream-browserify', version: '2.0.2', main: 'index.js' })}\n`,
		);
		await writeFile(
			path.join(modules, 'stream-browserify/index.js'),
			[
				'function Stream() {}',
				"Stream.prototype.pipe = function pipe() { return 'piped'; };",
				'module.exports = Stream;',
				'',
			].join('\n'),
		);
	}

	// The era shape: a CommonJS dependency that inherits from the core `stream`
	// prototype through `util.inherits`, which is what readable-stream 1.x does.
	const dependencySource = [
		"var Stream = require('stream');",
		"var util = require('util');",
		'function Readable() {}',
		'util.inherits(Readable, Stream);',
		'module.exports = {',
		'	inherited: new Readable().pipe(),',
		'	prototypeChain: Object.getPrototypeOf(Readable.prototype) === Stream.prototype,',
		'};',
		'',
	].join('\n');

	async function buildProbe(withAdapter: boolean): Promise<string> {
		const root = await mkdtemp(path.join(tmpdir(), 'versionless-cra-node-core-'));
		try {
			await writeShimClosure(root);
			await writeFile(path.join(root, 'dependency.cjs'), dependencySource);
			await writeFile(
				path.join(root, 'entry.js'),
				["import dependency from './dependency.cjs';", 'export const probe = dependency;', ''].join(
					'\n',
				),
			);
			const outDir = path.join(root, 'dist');
			await build({
				root,
				logLevel: 'silent',
				plugins: withAdapter ? [createCraNodeCoreModulePlugin({ applicationRoot: root })] : [],
				build: {
					outDir,
					minify: false,
					lib: {
						entry: path.join(root, 'entry.js'),
						formats: ['iife'],
						name: 'probe',
						fileName: () => 'probe.js',
					},
				},
			});
			return await readFile(path.join(outDir, 'probe.js'), 'utf8');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	}

	function evaluateInBrowserLikeRealm(code: string): Record<string, unknown> {
		// A realm with no Node builtins at all, exactly like a browser window.
		const context = createContext({});
		runInContext(code, context);
		return (context as { probe?: { probe?: Record<string, unknown> } }).probe?.probe as Record<
			string,
			unknown
		>;
	}

	test('an unadapted build stubs the core modules out and dies at load', async () => {
		const code = await buildProbe(false);
		expect(code).toContain('__vite-browser-external');
		expect(() => evaluateInBrowserLikeRealm(code)).toThrow();
	});

	test('the adapted build resolves the shims and evaluates', async () => {
		const code = await buildProbe(true);
		expect(code).not.toContain('__vite-browser-external');
		expect(code).toContain('Stream.prototype.pipe');
		const probe = evaluateInBrowserLikeRealm(code);
		expect(probe.inherited).toBe('piped');
		expect(probe.prototypeChain).toBe(true);
	});

	test('the resolution table is webpack 4 node-libs-browser, keyed by core module', () => {
		expect(craWebpackNodeCoreShimSpecifiers.stream).toBe('stream-browserify');
		expect(craWebpackNodeCoreShimSpecifiers.util).toBe('util/util.js');
		expect(craWebpackNodeCoreShimSpecifiers.crypto).toBe('crypto-browserify');
		expect(craWebpackNodeCoreShimSpecifiers.process).toBe('process/browser.js');
		expect(craWebpackNodeCoreShimSpecifiers._stream_readable).toBe('readable-stream/readable.js');
		expect(Object.isFrozen(craWebpackNodeCoreShimSpecifiers)).toBe(true);
		// Entries node-libs-browser maps to null stay Vite's business.
		expect(craWebpackNodeCoreShimSpecifiers.fs).toBeUndefined();
		expect(craWebpackNodeCoreShimSpecifiers.child_process).toBeUndefined();
	});

	test('both the bare and node-prefixed specifier name the same core module', () => {
		expect(craNodeCoreModuleName('stream')).toBe('stream');
		expect(craNodeCoreModuleName('node:stream')).toBe('stream');
		expect(craNodeCoreModuleName('react-dom')).toBeNull();
		expect(craNodeCoreModuleName('stream/promises')).toBeNull();
		expect(craNodeCoreShimPackage('os-browserify/browser.js')).toBe('os-browserify');
		expect(craNodeCoreShimPackage('assert/')).toBe('assert');
		expect(craNodeCoreShimPackage('@scope/shim/entry.js')).toBe('@scope/shim');
	});

	test('a shim absent from the closure fails loudly and names the module', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'versionless-cra-node-core-empty-'));
		try {
			await writeShimClosure(root);
			const resolver = craApplicationModuleResolver(root);
			expect(resolveCraNodeCoreModule('stream', resolver, root)).toContain('stream-browserify');
			expect(() => resolveCraNodeCoreModule('crypto', resolver, root)).toThrow(
				'Node core module "crypto"',
			);
			expect(() => resolveCraNodeCoreModule('crypto', resolver, root)).toThrow(
				'crypto-browserify',
			);
			const plugin = createCraNodeCoreModulePlugin({ applicationRoot: root });
			expect(plugin.enforce).toBe('pre');
			expect(plugin.resolveId('react')).toBeNull();
			expect(plugin.resolveId('node:util')).toContain('util.js');
			expect(() => plugin.resolveId('zlib')).toThrow('Node core module "zlib"');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test('the injected-globals bootstrap sources every webpack-provided binding', () => {
		expect(craWebpackNodeInjectedGlobals).toEqual({
			Buffer: 'buffer',
			clearImmediate: 'timers',
			process: 'process',
			setImmediate: 'timers',
		});
		const source = craNodeGlobalsBootstrapSource({
			process: '/closure/process/browser.js',
			buffer: '/closure/buffer/index.js',
			timers: '/closure/timers-browserify/main.js',
		});
		expect(source).toContain('import craProcess from "/closure/process/browser.js";');
		expect(source).toContain('globalThis.process ??= craProcess;');
		expect(source).toContain('globalThis.Buffer ??= craBuffer.Buffer;');
		expect(source).toContain('globalThis.setImmediate ??= craTimers.setImmediate;');
		expect(source).toContain('globalThis.clearImmediate ??= craTimers.clearImmediate;');
	});

	test('the bootstrap module is only served under its own virtual id', () => {
		const plugin = createCraNodeCoreModulePlugin({ applicationRoot: tmpdir() });
		expect(plugin.resolveId(craNodeGlobalsModuleId)).toBe(`\0${craNodeGlobalsModuleId}`);
		expect(plugin.load('/some/app/src/index.tsx')).toBeNull();
	});

	test('the entry document evaluates bootstrap modules before the application', () => {
		const document = craEntryDocument({
			template,
			entryModule: '/src/index.tsx',
			bootstrapModules: [craNodeGlobalsModuleId],
		});
		const bootstrap = `<script type="module">import "${craNodeGlobalsModuleId}";</script>`;
		expect(document).toContain(bootstrap);
		expect(document.indexOf(bootstrap)).toBeLessThan(
			document.indexOf('<script type="module" src="/src/index.tsx">'),
		);
		// Omitting the option leaves the document exactly as it was before.
		expect(craEntryDocument({ template, entryModule: '/src/index.tsx' })).toBe(
			craEntryDocument({ template, entryModule: '/src/index.tsx', bootstrapModules: [] }),
		);
	});
});

describe('webpack tilde specifiers in CSS', () => {
	test('rewrites quoted and url() imports without touching relative ones', () => {
		const code = [
			"@import '~antd/dist/antd.css';",
			'@import "~normalize.css";',
			'@import url("~a-package/b.css");',
			"@import './local.css';",
		].join('\n');
		expect(rewriteWebpackTildeCssImports(code)).toBe(
			[
				"@import 'antd/dist/antd.css';",
				'@import "normalize.css";',
				'@import url("a-package/b.css");',
				"@import './local.css';",
			].join('\n'),
		);
	});
	test('the plugin transforms only CSS ids and returns null when unchanged', () => {
		const plugin = createCraTildeCssImportPlugin();
		expect(plugin.enforce).toBe('pre');
		expect(plugin.transform("@import '~antd/dist/antd.css';", '/app/src/App.css?used')).toEqual({
			code: "@import 'antd/dist/antd.css';",
			map: null,
		});
		expect(plugin.transform("@import '~antd/dist/antd.css';", '/app/src/App.tsx')).toBeNull();
		expect(plugin.transform("@import './local.css';", '/app/src/App.css')).toBeNull();
	});
});

describe('create-react-app public directory', () => {
	test('copies every public file except the template into the build output', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'versionless-cra-public-'));
		const publicDirectory = path.join(root, 'public');
		const outDir = path.join(root, 'build');
		await mkdir(path.join(publicDirectory, 'nested'), { recursive: true });
		await mkdir(outDir, { recursive: true });
		await writeFile(path.join(publicDirectory, 'index.html'), 'template');
		await writeFile(path.join(publicDirectory, 'robots.txt'), 'User-agent: *\n');
		await writeFile(path.join(publicDirectory, 'nested/widget.js'), 'export {};\n');

		expect(await craPublicAssetPaths(publicDirectory, ['index.html'])).toEqual([
			'nested/widget.js',
			'robots.txt',
		]);

		const plugin = createCraPublicDirectoryPlugin({
			directory: publicDirectory,
			exclude: ['index.html'],
		});
		plugin.configResolved({ build: { outDir } });
		await plugin.closeBundle.handler();
		expect(await readFile(path.join(outDir, 'robots.txt'), 'utf8')).toBe('User-agent: *\n');
		expect(await readFile(path.join(outDir, 'nested/widget.js'), 'utf8')).toBe('export {};\n');
		await expect(readFile(path.join(outDir, 'index.html'), 'utf8')).rejects.toThrow();
	});
	test('refuses to copy before the build output directory is resolved', async () => {
		const plugin = createCraPublicDirectoryPlugin({ directory: tmpdir() });
		await expect(plugin.closeBundle.handler()).rejects.toThrow('outDir is unresolved');
	});
	test('the composed adapter excludes the template by default', () => {
		const [transform, nodeCore, define, output] = createCraViteAdapter({
			publicDirectory: tmpdir(),
		});
		expect(transform.name).toBe('versionless-cra-tilde-css-import');
		expect(nodeCore.name).toBe('versionless-cra-node-core-modules');
		expect(define.name).toBe('versionless-cra-global-identifier');
		expect(define.config()).toEqual({ define: { global: 'globalThis' } });
		expect(output.name).toBe('versionless-cra-public-directory');
		expect(output.closeBundle.order).toBe('post');
	});
});
