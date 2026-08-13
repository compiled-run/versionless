import { Buffer } from 'node:buffer';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createContext, runInContext } from 'node:vm';
import * as path from 'pathe';
import { build } from 'vite';
import { describe, expect, test } from 'vitest';
import {
	craApplicationModuleResolver,
	craDecodedModuleSource,
	craEntryDocument,
	craGlobalIdentifierDefines,
	craImplicitGlobalPrelude,
	craInvalidUtf8ByteOffsets,
	craIsDependencyModule,
	craModuleExportSurface,
	craModuleSourceEncoding,
	craNeutralizeDanglingImports,
	craReadModuleExportSurface,
	craResolveRelativeModule,
	craNodeCoreModuleName,
	craNodeCoreShimPackage,
	craNodeGlobalsBootstrapSource,
	craNodeGlobalsModuleId,
	craJsxModuleType,
	craModuleIsJsxCapableApplicationSource,
	craProcessEnvironmentDefines,
	craPublicAssetPaths,
	craWebpackDecodedSource,
	craWebpackNodeCoreShimSpecifiers,
	craWebpackNodeInjectedGlobals,
	createCraGlobalIdentifierPlugin,
	createCraJavaScriptJsxPlugin,
	createCraMissingExportTolerancePlugin,
	createCraNodeCoreModulePlugin,
	createCraNonUtf8ModuleSourcePlugin,
	createCraPublicDirectoryPlugin,
	createCraSloppyCommonJsGlobalsPlugin,
	createCraTildeCssImportPlugin,
	createCraViteAdapter,
	craSloppyCommonJsSource,
	resolveCraNodeCoreModule,
	rewriteWebpackTildeCssImports,
	scanCraImplicitGlobals,
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
		const result = substituteCraTemplatePlaceholders('%PUBLIC_URL%/a %PUBLIC_URL%/b', {
			PUBLIC_URL: '/console',
		});
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
		const document = craEntryDocument({
			template: '<div id="root"></div>',
			entryModule: '/main.js',
		});
		expect(document).toBe(
			'<div id="root"></div>\n<script type="module" src="/main.js"></script>\n',
		);
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
		return (context as { probe?: { probe?: Record<string, unknown> } }).probe?.probe as Record<
			string,
			unknown
		>;
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
				[
					"import dependency from './dependency.cjs';",
					'export const probe = dependency;',
					'',
				].join('\n'),
			);
			const outDir = path.join(root, 'dist');
			await build({
				root,
				logLevel: 'silent',
				plugins: withAdapter
					? [createCraNodeCoreModulePlugin({ applicationRoot: root })]
					: [],
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
		expect(craWebpackNodeCoreShimSpecifiers._stream_readable).toBe(
			'readable-stream/readable.js',
		);
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
			expect(resolveCraNodeCoreModule('stream', resolver, root)).toContain(
				'stream-browserify',
			);
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

/**
 * webpack 4 evaluated CommonJS dependency modules inside a plain function
 * wrapper in the bundle's own mode, and create-react-app's bundles are not
 * strict, so an assignment to an undeclared name quietly created a global. Vite
 * emits ECMAScript modules, which are always strict, so the same assignment is
 * a write to an unresolvable reference and throws at load. The control build
 * below is that failure, observed rather than recalled; the adapted build is the
 * fix, and it keeps the name a shared global rather than a module-local.
 */
describe("webpack's sloppy-mode CommonJS wrapper", () => {
	// The era shape: a hashing helper that seeds an accumulator it never declares.
	const writerSource = [
		'function digest(s) {',
		"	txt = '';",
		'	for (var i = 0; i < s.length; i++) txt += s.charAt(i).toUpperCase();',
		'	return txt;',
		'}',
		"module.exports = { digest: digest, first: digest('ab') };",
		'',
	].join('\n');

	// A second dependency that only ever reads the name the first one created.
	const readerSource = [
		"module.exports = { seen: typeof txt === 'string' ? txt : null };",
		'',
	].join('\n');

	async function writeDependency(root: string, name: string, source: string): Promise<void> {
		const directory = path.join(root, 'node_modules', name);
		await mkdir(directory, { recursive: true });
		await writeFile(
			path.join(directory, 'package.json'),
			`${JSON.stringify({ name, version: '1.0.0', main: 'index.js' })}\n`,
		);
		await writeFile(path.join(directory, 'index.js'), source);
	}

	async function buildProbe(
		withAdapter: boolean,
		entrySource = [
			"import writer from 'legacy-writer';",
			"import reader from 'legacy-reader';",
			'export const probe = { writer: writer, reader: reader };',
			'',
		].join('\n'),
	): Promise<string> {
		const root = await mkdtemp(path.join(tmpdir(), 'versionless-cra-sloppy-'));
		try {
			await writeFile(
				path.join(root, 'package.json'),
				`${JSON.stringify({ name: 'closure-under-test', version: '0.0.0' })}\n`,
			);
			await writeDependency(root, 'legacy-writer', writerSource);
			await writeDependency(root, 'legacy-reader', readerSource);
			await writeFile(path.join(root, 'entry.js'), entrySource);
			const outDir = path.join(root, 'dist');
			await build({
				root,
				logLevel: 'silent',
				plugins: withAdapter ? [createCraSloppyCommonJsGlobalsPlugin()] : [],
				build: {
					outDir,
					minify: false,
					// The strict prologue an ECMAScript module bundle gets for free in a
					// browser: without it the probe would not evaluate as the page does.
					rollupOptions: { output: { strict: true } },
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
		// A realm with nothing but the language, exactly like a fresh browser window.
		const context = createContext({});
		runInContext(code, context);
		return (context as { probe?: { probe?: Record<string, unknown> } }).probe?.probe as Record<
			string,
			unknown
		>;
	}

	test('an unadapted build throws where webpack tolerated the implicit global', async () => {
		const code = await buildProbe(false);
		expect(code).toContain('"use strict"');
		expect(code).not.toContain('globalThis["txt"]');
		expect(() => evaluateInBrowserLikeRealm(code)).toThrow('txt is not defined');
	});

	test('the adapted build evaluates and keeps the name a shared global', async () => {
		const code = await buildProbe(true);
		expect(code).toContain('"use strict"');
		expect(code).toContain('if (!("txt" in globalThis)) globalThis["txt"] = void 0;');
		const probe = evaluateInBrowserLikeRealm(code) as {
			writer: { digest(value: string): string; first: string };
			reader: { seen: string | null };
		};
		expect(probe.writer.first).toBe('AB');
		expect(probe.writer.digest('cd')).toBe('CD');
		// The era-faithful part: a second module reads the same implicit global.
		expect(probe.reader.seen).toBe('AB');
	});

	test('application source stays strict', async () => {
		// The same undeclared assignment in first-party code keeps failing: the
		// capability is scoped to the dependency closure webpack wrapped, and
		// nothing else.
		const entrySource = [
			"import writer from 'legacy-writer';",
			"applicationLocal = 'unset';",
			'export const probe = { writer: writer, applicationLocal: applicationLocal };',
			'',
		].join('\n');
		await expect(
			(async () => evaluateInBrowserLikeRealm(await buildProbe(true, entrySource)))(),
		).rejects.toThrow('applicationLocal is not defined');
	});

	test('the scan resolves scopes rather than matching names', () => {
		const source = [
			'function shadowedParam(txt) { txt = 1; return txt; }',
			'function localVar() { var seen; seen = 2; return seen; }',
			'function caught() { try { throw 1; } catch (err) { err = 3; return err; } }',
			'function hoisted() { later = 4; var later; return later; }',
			'function pastBlock() { { let scoped = 1; scoped = 2; } scoped = 5; }',
			'for (index = 0; index < 1; index += 1) {}',
			'[first] = [1];',
			'({ second } = { second: 2 });',
			'counter++;',
			'for (var key in {}) {}',
			'for (loose in {}) {}',
			'module.exports = { shadowedParam: shadowedParam };',
			'exports.named = 1;',
			'',
		].join('\n');
		const scan = scanCraImplicitGlobals(source, 'dependency.js');
		expect(scan.kind).toBe('sloppy-commonjs');
		// Bindings resolve: the parameter, the local, the catch binding and the
		// hoisted `var` are not implicit globals, and a `let` left behind in its
		// block does not shield the assignment that outlives it.
		expect(scan.names).toEqual(['counter', 'first', 'index', 'loose', 'scoped', 'second']);
		expect(scanCraImplicitGlobals('var declared = 1; declared = 2;').names).toEqual([]);
		// Reading a free name is not creating one; only writes are implicit globals.
		expect(scanCraImplicitGlobals('module.exports = someHostGlobal;').names).toEqual([]);
	});

	test('a harmony dependency module keeps webpack’s strict treatment', () => {
		const scan = scanCraImplicitGlobals('export const a = 1;\nb = 2;\n', 'dependency.js');
		expect(scan.kind).toBe('ecmascript-module');
		expect(scan.names).toEqual([]);
		const plugin = createCraSloppyCommonJsGlobalsPlugin();
		expect(
			plugin.transform('export const a = 1;\nb = 2;\n', '/app/node_modules/dep/index.js'),
		).toBeNull();
		expect(plugin.transform("txt = '';", '/app/node_modules/dep/index.mjs')).toBeNull();
	});

	test('a dependency module that cannot be analysed fails loudly', () => {
		expect(scanCraImplicitGlobals('var a = <div/>;', 'dependency.js').kind).toBe(
			'unanalyzable',
		);
		const plugin = createCraSloppyCommonJsGlobalsPlugin();
		expect(() => plugin.transform('var a = <div/>;', '/app/node_modules/dep/index.js')).toThrow(
			'/app/node_modules/dep/index.js',
		);
		expect(() => plugin.transform('var a = <div/>;', '/app/node_modules/dep/index.js')).toThrow(
			'sloppy-mode CommonJS wrapper',
		);
	});

	test('the plugin only touches dependency modules that need it', () => {
		const plugin = createCraSloppyCommonJsGlobalsPlugin();
		expect(plugin.enforce).toBe('pre');
		expect(craIsDependencyModule('/app/node_modules/dep/index.js')).toBe(true);
		expect(craIsDependencyModule('/app/src/index.js')).toBe(false);
		expect(craIsDependencyModule('\0virtual:something')).toBe(false);
		// First-party source, a dependency with nothing implicit, and a query
		// suffix on an id that does need the prelude.
		expect(plugin.transform("txt = '';", '/app/src/index.js')).toBeNull();
		expect(plugin.transform('var txt; txt = 1;', '/app/node_modules/dep/index.js')).toBeNull();
		expect(plugin.transform("txt = '';", '/app/node_modules/dep/index.js?used')).toEqual({
			code: `${craImplicitGlobalPrelude(['txt'])}txt = '';`,
			map: null,
		});
	});

	test('the observer reports every module the capability had to touch', () => {
		const records: Array<{ id: string; names: readonly string[] }> = [];
		const plugin = createCraSloppyCommonJsGlobalsPlugin({
			observe: (record) => records.push(record),
		});
		plugin.transform("txt = '';", '/app/node_modules/dep/index.js');
		plugin.transform('var txt; txt = 1;', '/app/node_modules/quiet/index.js');
		expect(records).toEqual([{ id: '/app/node_modules/dep/index.js', names: ['txt'] }]);
	});

	test('the prelude leaves a binding the host already owns alone', () => {
		expect(craImplicitGlobalPrelude([])).toBe('');
		const context = createContext({ name: 'host-owned' });
		runInContext(
			`${craImplicitGlobalPrelude(['fresh', 'name'])} probe = [typeof fresh, name];`,
			context,
		);
		expect((context as { probe?: unknown[] }).probe).toEqual(['undefined', 'host-owned']);
	});

	test('the prelude keeps every original line number, hashbang included', () => {
		const source = ['#!/usr/bin/env node', "txt = '';", 'module.exports = txt;', ''].join('\n');
		const transformed = craSloppyCommonJsSource(source, ['txt']);
		expect(transformed.split('\n')).toHaveLength(source.split('\n').length);
		expect(transformed.startsWith('#!/usr/bin/env node\n')).toBe(true);
		expect(transformed.split('\n')[1]).toContain("txt = '';");
		expect(craSloppyCommonJsSource("txt = '';", []).split('\n')).toHaveLength(1);
		expect(craSloppyCommonJsSource("txt = '';", [])).toBe("txt = '';");
	});
});

/**
 * webpack 4 resolved a named import of an export the target module never
 * provides to `undefined`; rolldown makes it a hard `MISSING_EXPORT`. The
 * capability reproduces webpack's resolution, but only for a dependency
 * module, only when the name is provably absent, and only when the binding is
 * safe under `undefined`. The build probe below is the shape a self-inconsistent
 * `dist` build takes: a module importing a marker a sibling never exports.
 */
describe('missing-export tolerance for a self-inconsistent dependency ES module', () => {
	const dangling = '/app/node_modules/dep/utils/onScroll.js';
	const present = (specifier: string): { names: Set<string>; hasStar: boolean } =>
		specifier === './present.js'
			? { names: new Set(['alive']), hasStar: false }
			: { names: new Set(['IS_TIMEOUT', 'default']), hasStar: false };

	test('a dead dangling import becomes undefined while a real import stays', () => {
		const code = [
			"import { alive } from './present.js';",
			'export function use() {',
			'	return alive();',
			'}',
			'import { marker_Widget } from "../Widget.js";',
			'',
		].join('\n');
		const result = craNeutralizeDanglingImports(code, dangling, present);
		expect(result).not.toBeNull();
		if (result === null) return;
		// The linking import is untouched; the dangling one keeps its module in the
		// graph as a side-effect import and binds the name to undefined.
		expect(result.code).toContain("import { alive } from './present.js';");
		expect(result.code).toContain('import "../Widget.js";');
		expect(result.code).toContain('const marker_Widget = void 0;');
		expect(result.code).not.toContain('{ marker_Widget }');
		expect(result.neutralized).toEqual([{ specifier: '../Widget.js', name: 'marker_Widget' }]);
	});

	test('a dangling marker read only inside a function body is tolerated', () => {
		const code = [
			'import { marker_Row } from "./present.js";',
			'function _propType() {',
			'	return typeof marker_Row === "function" ? marker_Row : shape(marker_Row);',
			'}',
			'export const propTypes = { row: _propType };',
			'',
		].join('\n');
		const result = craNeutralizeDanglingImports(code, dangling, (specifier) =>
			specifier === './present.js' ? { names: new Set(['other']), hasStar: false } : null,
		);
		expect(result).not.toBeNull();
		expect(result?.code).toContain('import "./present.js";');
		expect(result?.code).toContain('const marker_Row = void 0;');
	});

	test('one dangling specifier of a mixed import is split out, the rest kept', () => {
		const code = 'import def, { alive, marker_Widget } from "./present.js";\nexport function u(){return alive(def);}\n';
		const result = craNeutralizeDanglingImports(code, dangling, (specifier) =>
			specifier === './present.js' ? { names: new Set(['alive', 'default']), hasStar: false } : null,
		);
		expect(result).not.toBeNull();
		expect(result?.code).toContain('import def, { alive } from "./present.js";');
		expect(result?.code).toContain('const marker_Widget = void 0;');
	});

	test('a real missing export used in a value position at module scope is refused', () => {
		// `realThing` dangles, but it is dereferenced while the module evaluates, so
		// undefined would be observable — a real application-visible error, left for
		// the bundler to report rather than papered over.
		const code = 'import { realThing } from "./present.js";\nexport const size = realThing.length;\n';
		expect(
			craNeutralizeDanglingImports(code, dangling, (specifier) =>
				specifier === './present.js' ? { names: new Set(['alive']), hasStar: false } : null,
			),
		).toBeNull();
	});

	test('a present export is left exactly as written', () => {
		const code = 'import { alive } from "./present.js";\nexport function f(){ return alive(); }\n';
		expect(craNeutralizeDanglingImports(code, dangling, present)).toBeNull();
	});

	test('an unresolved export-star target forbids proving absence', () => {
		const code = 'import { maybe } from "./present.js";\nexport function f(){ return maybe; }\n';
		expect(
			craNeutralizeDanglingImports(code, dangling, () => ({ names: new Set(), hasStar: true })),
		).toBeNull();
	});

	test('an unresolvable or bare-package target is never rewritten', () => {
		const code = 'import { thing } from "some-package";\nexport function f(){ return thing; }\n';
		expect(craNeutralizeDanglingImports(code, dangling, () => null)).toBeNull();
	});

	test('the plugin only acts on dependency modules', () => {
		const plugin = createCraMissingExportTolerancePlugin();
		expect(plugin.enforce).toBe('pre');
		// First-party source with a dangling import is a real defect and is not
		// touched; the bundler still reports it.
		expect(
			plugin.transform('import { x } from "./m.js";\nexport function f(){return x;}', '/app/src/a.js'),
		).toBeNull();
		expect(plugin.transform('const noImports = 1;', '/app/node_modules/dep/a.js')).toBeNull();
	});

	test('the plugin reads the real target surface and reports what it neutralized', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'versionless-cra-missing-export-'));
		try {
			const dep = path.join(root, 'node_modules', 'rv');
			await mkdir(dep, { recursive: true });
			await writeFile(
				path.join(dep, 'Widget.js'),
				'export const IS_TIMEOUT = 150;\nexport default function Widget(){}\n',
			);
			const importer = path.join(dep, 'onScroll.js');
			const importerSource = [
				'export function register() { return 1; }',
				'import { marker_Widget } from "./Widget.js";',
				'',
			].join('\n');
			await writeFile(importer, importerSource);
			const records: Array<{ id: string; specifier: string; name: string }> = [];
			const plugin = createCraMissingExportTolerancePlugin({
				observe: (record) => records.push(record),
			});
			const transformed = plugin.transform(importerSource, importer);
			expect(transformed).not.toBeNull();
			expect(transformed?.code).toContain('import "./Widget.js";');
			expect(transformed?.code).toContain('const marker_Widget = void 0;');
			expect(records).toEqual([{ id: importer, specifier: './Widget.js', name: 'marker_Widget' }]);
			// A sibling that really exports the name is left alone.
			const clean = 'import { IS_TIMEOUT } from "./Widget.js";\nexport const x = IS_TIMEOUT;\n';
			expect(plugin.transform(clean, importer)).toBeNull();
			expect(craResolveRelativeModule(importer, './Widget.js')).toBe(path.join(dep, 'Widget.js'));
			expect(craReadModuleExportSurface(path.join(dep, 'Widget.js'))?.names.has('IS_TIMEOUT')).toBe(
				true,
			);
			expect(craModuleExportSurface('export const a = 1;')?.names.has('a')).toBe(true);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	async function buildDanglingProbe(withAdapter: boolean): Promise<string> {
		const root = await mkdtemp(path.join(tmpdir(), 'versionless-cra-dangling-'));
		const dep = path.join(root, 'node_modules', 'rv');
		await mkdir(dep, { recursive: true });
		await writeFile(
			path.join(dep, 'Widget.js'),
			'export const IS_TIMEOUT = 150;\nexport default function Widget(){}\n',
		);
		await writeFile(
			path.join(dep, 'onScroll.js'),
			[
				"export function register() { return 'ok'; }",
				'export function probeMarker() {',
				"	return typeof marker_Widget === 'undefined' ? 'undefined' : typeof marker_Widget;",
				'}',
				'import { marker_Widget } from "./Widget.js";',
				'',
			].join('\n'),
		);
		await writeFile(
			path.join(dep, 'index.js'),
			"export { register, probeMarker } from './onScroll.js';\n",
		);
		await writeFile(
			path.join(root, 'entry.js'),
			[
				"import { register, probeMarker } from './node_modules/rv/index.js';",
				'export const probe = { register: register(), marker: probeMarker() };',
				'',
			].join('\n'),
		);
		const outDir = path.join(root, 'dist');
		try {
			await build({
				root,
				logLevel: 'silent',
				plugins: withAdapter ? [createCraMissingExportTolerancePlugin()] : [],
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

	test('an unadapted build refuses the dangling import rolldown cannot link', async () => {
		await expect(buildDanglingProbe(false)).rejects.toThrow(/marker_Widget|not exported|MISSING_EXPORT/);
	});

	test('the adapted build links, and the dangling marker is undefined at runtime', async () => {
		const code = await buildDanglingProbe(true);
		const context = createContext({});
		runInContext(code, context);
		const probe = (context as { probe?: { probe?: Record<string, unknown> } }).probe?.probe;
		expect(probe).toEqual({ register: 'ok', marker: 'undefined' });
	});
});

describe("webpack's lenient module source decoding", () => {
	// The era shape, minimised: one dependency whose bytes are a legacy
	// single-byte encoding. The same text is available well formed, which is the
	// control the real-world measurement turned on.
	const dependencyText = "module.exports = { name: 'Giosuè' };\n";
	const latin1Bytes = Buffer.from(dependencyText, 'latin1');
	const utf8Bytes = Buffer.from(dependencyText, 'utf8');
	const decodedText = "module.exports = { name: 'Giosu�' };\n";

	async function writeByteDependency(
		root: string,
		name: string,
		bytes: Uint8Array,
	): Promise<void> {
		const directory = path.join(root, 'node_modules', name);
		await mkdir(directory, { recursive: true });
		await writeFile(
			path.join(directory, 'package.json'),
			`${JSON.stringify({ name, version: '1.0.0', main: 'index.js' })}\n`,
		);
		await writeFile(path.join(directory, 'index.js'), bytes);
	}

	async function buildProbe(options: {
		withAdapter: boolean;
		dependencyBytes: Uint8Array;
		entryBytes?: Uint8Array;
	}): Promise<string> {
		const root = await mkdtemp(path.join(tmpdir(), 'versionless-cra-decode-'));
		try {
			await writeFile(
				path.join(root, 'package.json'),
				`${JSON.stringify({ name: 'closure-under-test', version: '0.0.0' })}\n`,
			);
			await writeByteDependency(root, 'legacy-encoded', options.dependencyBytes);
			await writeFile(
				path.join(root, 'entry.js'),
				options.entryBytes ??
					Buffer.from(
						[
							"import legacy from 'legacy-encoded';",
							'export const probe = { legacy: legacy };',
							'',
						].join('\n'),
						'utf8',
					),
			);
			const outDir = path.join(root, 'dist');
			await build({
				root,
				logLevel: 'silent',
				plugins: options.withAdapter ? [createCraNonUtf8ModuleSourcePlugin()] : [],
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

	test('an unadapted build cannot load the dependency at all', async () => {
		// The holdout's red, reproduced at fixture scale: the bundler refuses the
		// bytes rather than decoding them, so nothing is emitted.
		await expect(
			buildProbe({ withAdapter: false, dependencyBytes: latin1Bytes }),
		).rejects.toThrow('did not contain valid UTF-8');
	});

	test('the adapted build loads it and carries webpack 4 decoded text', async () => {
		const code = await buildProbe({ withAdapter: true, dependencyBytes: latin1Bytes });
		// Exactly what webpack 4 emitted for these bytes, measured on a real
		// webpack 4.44.2 production build: the replacement character, not the
		// accent. Parity with the bundler being replaced is the property, and
		// recovering the accent would be a behaviour change.
		expect(code).toContain('Giosu�');
		expect(code).not.toContain('Giosuè');
	});

	test('a valid UTF-8 dependency is left byte-for-byte alone', async () => {
		const [unadapted, adapted] = await Promise.all([
			buildProbe({ withAdapter: false, dependencyBytes: utf8Bytes }),
			buildProbe({ withAdapter: true, dependencyBytes: utf8Bytes }),
		]);
		expect(adapted).toBe(unadapted);
		expect(adapted).toContain('Giosuè');
	});

	test('application source with invalid bytes stays a failure', async () => {
		// The capability is scoped to the dependency closure webpack shipped
		// pre-decoded. First-party bytes are the application's own defect and
		// substituting characters into them would hide it.
		const entryBytes = Buffer.from(`export const probe = { name: 'Giosuè' };\n`, 'latin1');
		await expect(
			buildProbe({ withAdapter: true, dependencyBytes: utf8Bytes, entryBytes }),
		).rejects.toThrow('did not contain valid UTF-8');
	});

	test('a UTF-16 dependency is refused by name rather than decoded', async () => {
		const utf16 = Buffer.concat([
			Buffer.from([0xff, 0xfe]),
			Buffer.from(dependencyText, 'utf16le'),
		]);
		await expect(buildProbe({ withAdapter: true, dependencyBytes: utf16 })).rejects.toThrow(
			'is stored in utf-16le',
		);
	});

	test('classifies an encoding from bytes, never from a name', () => {
		expect(craModuleSourceEncoding(utf8Bytes)).toBe('utf-8');
		expect(craModuleSourceEncoding(latin1Bytes)).toBe('utf-8-with-invalid-bytes');
		expect(craModuleSourceEncoding(new Uint8Array())).toBe('utf-8');
		expect(craModuleSourceEncoding(Buffer.from([0xff, 0xfe, 0x41, 0x00]))).toBe('utf-16le');
		expect(craModuleSourceEncoding(Buffer.from([0xfe, 0xff, 0x00, 0x41]))).toBe('utf-16be');
		expect(craModuleSourceEncoding(Buffer.from([0xff, 0xfe, 0x00, 0x00]))).toBe('utf-32le');
		expect(craModuleSourceEncoding(Buffer.from([0x00, 0x00, 0xfe, 0xff]))).toBe('utf-32be');
		// A UTF-8 byte order mark is valid UTF-8, so it is not this capability's.
		expect(craModuleSourceEncoding(Buffer.from([0xef, 0xbb, 0xbf, 0x41]))).toBe('utf-8');
	});

	test.each([
		['a bare continuation byte', [0x80]],
		['an unfinished two byte sequence', [0xc3]],
		['an overlong encoding of NUL', [0xc0, 0x80]],
		['a surrogate code point', [0xed, 0xa0, 0x80]],
		['a lead byte beyond the range', [0xf5, 0x80, 0x80, 0x80]],
		['an unfinished four byte sequence', [0xf0, 0x9f]],
	])('the scanner agrees with the platform validator on %s', (_label, bytes) => {
		const buffer = Buffer.from([0x41, ...bytes, 0x42]);
		expect(craInvalidUtf8ByteOffsets(buffer).length).toBeGreaterThan(0);
		expect(craModuleSourceEncoding(buffer)).toBe('utf-8-with-invalid-bytes');
	});

	test.each([
		['ascii', 'abc'],
		['two byte', 'è'],
		['three byte', '€'],
		['four byte', '\u{1f600}'],
	])('the scanner reports nothing for well formed %s text', (_label, text) => {
		const buffer = Buffer.from(text, 'utf8');
		expect(craInvalidUtf8ByteOffsets(buffer)).toEqual([]);
		expect(craModuleSourceEncoding(buffer)).toBe('utf-8');
	});

	test('reports the offset of each invalid byte', () => {
		expect(craInvalidUtf8ByteOffsets(latin1Bytes)).toEqual([dependencyText.indexOf('è')]);
	});

	test('decodes the way webpack 4 did, byte order mark and all', () => {
		expect(craWebpackDecodedSource(latin1Bytes)).toBe(decodedText);
		expect(craWebpackDecodedSource(utf8Bytes)).toBe(dependencyText);
		// loader-runner stripped a leading byte order mark after decoding.
		expect(craWebpackDecodedSource(Buffer.from([0xef, 0xbb, 0xbf, 0x41]))).toBe('A');
		expect(craWebpackDecodedSource(Buffer.from([0xef, 0xbb, 0xbf, 0x41, 0xe8]))).toBe('A�');
	});

	test('refuses an encoding it does not decode, and says why', () => {
		const utf16 = Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from([0x00, 0x41])]);
		expect(() => craDecodedModuleSource(utf16, 'node_modules/x/index.js')).toThrow(
			'is stored in utf-16be',
		);
		expect(() => craDecodedModuleSource(utf16, 'node_modules/x/index.js')).toThrow('mojibake');
	});

	test('the load hook declines everything outside its scope', async () => {
		const plugin = createCraNonUtf8ModuleSourcePlugin();
		const root = await mkdtemp(path.join(tmpdir(), 'versionless-cra-decode-scope-'));
		try {
			const appFile = path.join(root, 'app.js');
			await writeFile(appFile, latin1Bytes);
			const dependencyDirectory = path.join(root, 'node_modules', 'legacy-encoded');
			await mkdir(dependencyDirectory, { recursive: true });
			const stylesheet = path.join(dependencyDirectory, 'styles.css');
			await writeFile(stylesheet, latin1Bytes);
			const module = path.join(dependencyDirectory, 'index.js');
			await writeFile(module, latin1Bytes);
			// First-party source, a stylesheet, a virtual id and a file that is not
			// there: none of them is this capability's, and each declines rather
			// than guesses.
			expect(await plugin.load(appFile)).toBeNull();
			expect(await plugin.load(stylesheet)).toBeNull();
			expect(await plugin.load('\0virtual:something')).toBeNull();
			expect(await plugin.load(path.join(dependencyDirectory, 'absent.js'))).toBeNull();
			// The dependency module itself is decoded, query string and all.
			expect(await plugin.load(module)).toBe(decodedText);
			expect(await plugin.load(`${module}?v=1`)).toBe(decodedText);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test('observes the modules it decoded, with the bytes that made it act', async () => {
		const records: Array<{
			id: string;
			encoding: string;
			invalidByteOffsets: readonly number[];
		}> = [];
		const plugin = createCraNonUtf8ModuleSourcePlugin({
			observe: (record) => records.push({ ...record }),
		});
		const root = await mkdtemp(path.join(tmpdir(), 'versionless-cra-decode-observe-'));
		try {
			const directory = path.join(root, 'node_modules', 'legacy-encoded');
			await mkdir(directory, { recursive: true });
			const invalid = path.join(directory, 'index.js');
			const valid = path.join(directory, 'valid.js');
			await writeFile(invalid, latin1Bytes);
			await writeFile(valid, utf8Bytes);
			await plugin.load(invalid);
			await plugin.load(valid);
			expect(records).toEqual([
				{
					id: invalid,
					encoding: 'utf-8-with-invalid-bytes',
					invalidByteOffsets: [dependencyText.indexOf('è')],
				},
			]);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
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
		expect(plugin.transform("@import '~antd/dist/antd.css';", '/app/src/App.css?used')).toEqual(
			{
				code: "@import 'antd/dist/antd.css';",
				map: null,
			},
		);
		expect(plugin.transform("@import '~antd/dist/antd.css';", '/app/src/App.tsx')).toBeNull();
		expect(plugin.transform("@import './local.css';", '/app/src/App.css')).toBeNull();
	});
});

describe('JSX in application-source JavaScript', () => {
	test('claims application-source .js and .mjs, and nothing else', () => {
		for (const id of ['/app/src/index.js', '/app/src/Components/Home.js', '/app/src/entry.mjs'])
			expect(craModuleIsJsxCapableApplicationSource(id)).toBe(true);
		// A dependency's .js was compiled by babel-preset-react-app/dependencies,
		// which carries no React preset, so it was never parsed with JSX enabled.
		expect(
			craModuleIsJsxCapableApplicationSource('/app/node_modules/react-icons/index.js'),
		).toBe(false);
		// These already parse as JSX, are TypeScript, or are not modules at all.
		for (const id of [
			'/app/src/App.jsx',
			'/app/src/App.tsx',
			'/app/src/types.ts',
			'/app/src/index.css',
			'\0virtual:something.js',
		])
			expect(craModuleIsJsxCapableApplicationSource(id)).toBe(false);
	});

	test('a query suffix does not hide the extension', () => {
		expect(craModuleIsJsxCapableApplicationSource('/app/src/index.js?used')).toBe(true);
		expect(
			craModuleIsJsxCapableApplicationSource('/app/node_modules/x/index.js?used'),
		).toBe(false);
	});

	test('the plugin raises the module type and changes no code', () => {
		const plugin = createCraJavaScriptJsxPlugin();
		expect(plugin.enforce).toBe('pre');
		const code = 'export default function App() { return <div />; }';
		expect(plugin.transform(code, '/app/src/App.js')).toEqual({
			code,
			map: null,
			moduleType: craJsxModuleType,
		});
		expect(plugin.transform(code, '/app/node_modules/pkg/index.js')).toBeNull();
		expect(plugin.transform(code, '/app/src/App.tsx')).toBeNull();
	});

	test('a Vite build parses JSX in a .js application module and refuses without the plugin', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'versionless-cra-jsx-'));
		await mkdir(path.join(root, 'src'), { recursive: true });
		// No React import and no runtime: the assertion is about the parser
		// accepting the syntax, so the JSX factory is supplied locally.
		await writeFile(
			path.join(root, 'src/main.js'),
			[
				'const jsx = (tag, props) => ({ tag, props });',
				'export const element = jsx("div", null);',
				'export const markup = <div className="p-2" />;',
				'globalThis.__cra = markup;',
			].join('\n'),
		);
		const buildOnce = async (plugins: readonly unknown[]): Promise<void> => {
			await build({
				root,
				logLevel: 'silent',
				plugins: plugins as never,
				build: {
					outDir: path.join(root, 'out'),
					emptyOutDir: true,
					write: false,
					rolldownOptions: {
						input: path.join(root, 'src/main.js'),
						// The temporary root has no dependency closure. The JSX
						// runtime import the transform emits is externalized so the
						// assertion stays about the parser rather than resolution.
						external: ['react/jsx-runtime'],
					},
				},
			});
		};
		await expect(buildOnce([])).rejects.toThrow();
		await expect(buildOnce([createCraJavaScriptJsxPlugin()])).resolves.toBeUndefined();
		await rm(root, { recursive: true, force: true });
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
		const [decode, jsx, transform, sloppy, missingExport, nodeCore, define, output] =
			createCraViteAdapter({
				publicDirectory: tmpdir(),
			});
		expect(decode.name).toBe('versionless-cra-non-utf8-module-source');
		expect(decode.enforce).toBe('pre');
		// Decoding acts on bytes and leads; the module type is decided next,
		// because a module has to be parseable before any transform below it
		// means anything.
		expect(jsx.name).toBe('versionless-cra-javascript-jsx');
		expect(transform.name).toBe('versionless-cra-tilde-css-import');
		expect(sloppy.name).toBe('versionless-cra-sloppy-commonjs-globals');
		expect(missingExport.name).toBe('versionless-cra-missing-export-tolerance');
		expect(missingExport.enforce).toBe('pre');
		expect(nodeCore.name).toBe('versionless-cra-node-core-modules');
		expect(define.name).toBe('versionless-cra-global-identifier');
		expect(define.config()).toEqual({ define: { global: 'globalThis' } });
		expect(output.name).toBe('versionless-cra-public-directory');
		expect(output.closeBundle.order).toBe('post');
	});
});

/**
 * The overfitting guard: the product surface must not know which application it
 * is migrating. Any corpus application, package or fixture identifier appearing
 * in the adapter's source is a capability fitted to one tree instead of to a
 * shape webpack itself defines.
 *
 * The decoding capability is the reason this list carries `faker` and `cypress`:
 * it was named by a holdout that failed on one file inside one package, and the
 * cheapest wrong way to close it would have been to key on that name.
 */
describe('React adapter overfitting guard', () => {
	const surface = path.join(import.meta.dirname, '../src');
	/**
	 * One module is excluded, and it is named here rather than quietly skipped:
	 * `react-class-lifecycle-to-hooks.ts` is a deliberately application-pinned
	 * transform that refuses any source whose digest is not the one it was
	 * written against. Naming the application is its declared contract, not a
	 * leak. Every other file in this surface is a reusable capability and must
	 * name nothing. The exclusion is asserted, so it cannot silently grow.
	 */
	const applicationPinnedByDesign = new Set(['react-class-lifecycle-to-hooks.ts']);

	test('the excluded module is the pinned one, and is pinned by a digest', async () => {
		const source = await readFile(
			path.join(surface, 'react-class-lifecycle-to-hooks.ts'),
			'utf8',
		);
		expect(source).toContain('APP_SOURCE_SHA256');
		expect(applicationPinnedByDesign.size).toBe(1);
	});

	test('names no corpus application or dependency anywhere in the reusable surface', async () => {
		const forbidden = [
			'avataaars',
			'boilerplate',
			'cypress',
			'faker',
			'graveyard',
			'hospitalrun',
			'killedbygoogle',
			'linkfree',
			'memos',
			'papercups',
			'realworld',
			'sqlpad',
			'takenote',
			'first_name',
			'locales/it',
		];
		const offenders: string[] = [];
		for (const entry of await readdir(surface, { withFileTypes: true })) {
			if (!entry.isFile() || applicationPinnedByDesign.has(entry.name)) continue;
			const source = (await readFile(path.join(surface, entry.name), 'utf8')).toLowerCase();
			for (const name of forbidden)
				if (source.includes(name)) offenders.push(`${entry.name}: ${name}`);
		}
		expect(offenders).toEqual([]);
	});

	test('the decoding capability never decodes as a legacy single-byte encoding', async () => {
		// Prose may name ISO-8859-1, because that is the shape being described.
		// Code may not decode as it: the measurement refuted that reading, and a
		// `latin1` or `binary` decode would be the refuted answer smuggled back in.
		const source = await readFile(path.join(surface, 'react-cra-vite-adapter.ts'), 'utf8');
		for (const encoding of ["'latin1'", '"latin1"', "'binary'", '"binary'])
			expect(source).not.toContain(encoding);
		expect(source).toContain("toString('utf8')");
	});
});
