import { Buffer, isUtf8 } from 'node:buffer';
import { readFileSync, statSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import {
	charIn,
	createRegExp,
	exactly,
	global,
	maybe,
	oneOrMore,
	whitespace,
	wordChar,
} from 'magic-regexp';
import * as path from 'pathe';
import { analyze, type NodeOfType, type Reference } from 'yuku-analyzer';
import {
	createCraProcessGlobalPlugin,
	type CraProcessGlobalPlugin,
	type CraProcessGlobalRecord,
} from './react-cra-process-global.ts';

/**
 * Reusable create-react-app compatibility capabilities for a Vite build.
 *
 * Every export here is application agnostic: the shapes handled are the ones
 * create-react-app itself defines (HTML template placeholders, `process.env`
 * inlining, the ambient `global` identifier, webpack's automatic Node core
 * module polyfills, webpack's sloppy-mode CommonJS module wrapper, webpack
 * tilde specifiers, and the copied public directory). No capability branches on
 * an application name, revision, or source string.
 */

export type CraEnvironment = Readonly<Record<string, string>>;

const templatePlaceholder = createRegExp(
	exactly('%').and(oneOrMore(wordChar).groupedAs('key')).and('%'),
	[global],
);

const tildePrefixedCssImport = createRegExp(
	exactly('@import')
		.and(oneOrMore(whitespace))
		.and(maybe(exactly('url').and(maybe(whitespace)).and('(').and(maybe(whitespace))))
		.and(charIn(`'"`))
		.and('~'),
	[global],
);

const closingBodyTag = createRegExp(
	exactly('<').and(maybe(whitespace)).and('/').and(maybe(whitespace)).and('body'),
);

export function compareUtf16CodeUnits(left: string, right: string): number {
	if (left === right) return 0;
	return left < right ? -1 : 1;
}

/**
 * Replace `%KEY%` template placeholders the way create-react-app's
 * InterpolateHtmlPlugin does: only keys present in the environment are
 * substituted, and unknown placeholders are preserved verbatim.
 */
export function substituteCraTemplatePlaceholders(
	template: string,
	environment: CraEnvironment,
): string {
	return template.replace(templatePlaceholder, (match: string, key: string) =>
		Object.hasOwn(environment, key) ? (environment[key] as string) : match,
	);
}

export type CraEntryDocumentOptions = Readonly<{
	template: string;
	entryModule: string;
	environment?: CraEnvironment;
	bootstrapModules?: readonly string[];
}>;

/**
 * Turn a create-react-app `public/index.html` template into a Vite entry
 * document: placeholders are substituted and the application entry is injected
 * as a module script immediately before the closing body tag.
 *
 * `bootstrapModules` are imported by inline module scripts placed ahead of the
 * application entry. Module scripts evaluate in document order, so a bootstrap
 * listed here runs before the first application module — the position webpack
 * used for the bindings it injected into every module. Omitting the option
 * leaves the document byte-identical to one produced without it.
 */
export function craEntryDocument(options: CraEntryDocumentOptions): string {
	const substituted = substituteCraTemplatePlaceholders(
		options.template,
		options.environment ?? {},
	);
	const bootstrap = (options.bootstrapModules ?? [])
		.map((module) => `<script type="module">import ${JSON.stringify(module)};</script>\n  `)
		.join('');
	const script = `${bootstrap}<script type="module" src="${options.entryModule}"></script>`;
	const match = closingBodyTag.exec(substituted);
	if (!match) return `${substituted}${substituted.endsWith('\n') ? '' : '\n'}${script}\n`;
	return `${substituted.slice(0, match.index)}  ${script}\n  ${substituted.slice(match.index)}`;
}

/**
 * Build the `define` map create-react-app's DefinePlugin provides: one entry per
 * environment key plus the whole `process.env` object for dynamic access.
 */
export function craProcessEnvironmentDefines(
	environment: CraEnvironment,
): Readonly<Record<string, string>> {
	const keys = Object.keys(environment).sort(compareUtf16CodeUnits);
	const sorted = Object.fromEntries(keys.map((key) => [key, environment[key] as string]));
	return Object.freeze({
		...Object.fromEntries(
			keys.map((key) => [`process.env.${key}`, JSON.stringify(environment[key])]),
		),
		'process.env': JSON.stringify(sorted),
	});
}

/**
 * The ambient identifier webpack 4 provides to every module it bundles for the
 * browser. webpack's runtime declares `global` itself (its `node.global`
 * option defaults to `true` on the webpack 4 line create-react-app 3 and 4
 * pin), so a dependency written against Node's `global` keeps working inside a
 * webpack browser bundle. Vite emits no such declaration: the same dependency
 * reaches the browser with a free `global` reference and throws
 * `ReferenceError: global is not defined` on first evaluation. Mapping the
 * identifier onto `globalThis` restores exactly the binding webpack supplied
 * and nothing else — it is a compile-time substitution of one free identifier,
 * so member accesses, property keys and locally bound `global` names are left
 * alone, and modules that never mention it emit byte-identical output.
 */
export function craGlobalIdentifierDefines(): Readonly<Record<string, string>> {
	return Object.freeze({ global: 'globalThis' });
}

export type CraDefineConfig = Readonly<{ define: Readonly<Record<string, string>> }>;
export type CraDefinePlugin = Readonly<{ name: string; config(): CraDefineConfig }>;

/**
 * Contribute the webpack `global` binding as a Vite `define` entry. It is
 * contributed through the plugin's own configuration rather than asked of every
 * consumer, so any build that adopts the create-react-app adapter inherits the
 * ambient identifier its bundler used to provide.
 */
export function createCraGlobalIdentifierPlugin(): CraDefinePlugin {
	return {
		name: 'versionless-cra-global-identifier',
		config() {
			return { define: craGlobalIdentifierDefines() };
		},
	};
}

/**
 * webpack 4's automatic Node core module resolution table, reproduced verbatim
 * from the `node-libs-browser` package webpack 4 depends on.
 *
 * webpack 4 resolved a bare `require('stream')` in browser builds to a browser
 * shim package rather than to a Node builtin, so dependencies written against
 * Node's standard library kept working unchanged inside a create-react-app
 * bundle. Vite performs no such substitution: it treats every Node builtin as
 * an external and emits a `__vite-browser-external` stub, so the same
 * `require('stream')` yields `undefined` and the first dependency that reads a
 * property off it fails at load — `readable-stream` 1.x, for instance, throws
 * `TypeError: Object prototype may only be an Object or null: undefined` from
 * `inherits`.
 *
 * The entries `node-libs-browser` maps to `null` (`fs`, `net`, `child_process`,
 * `dns`, `dgram`, `tls`, `cluster`, `module`, `readline`, `repl`) are absent
 * here on purpose: webpack emitted an empty module for those and Vite's own
 * browser-external stub already occupies that role, so nothing is claimed about
 * them.
 */
export const craWebpackNodeCoreShimSpecifiers: Readonly<Record<string, string>> = Object.freeze({
	_stream_duplex: 'readable-stream/duplex.js',
	_stream_passthrough: 'readable-stream/passthrough.js',
	_stream_readable: 'readable-stream/readable.js',
	_stream_transform: 'readable-stream/transform.js',
	_stream_writable: 'readable-stream/writable.js',
	assert: 'assert/',
	buffer: 'buffer/',
	console: 'console-browserify',
	constants: 'constants-browserify',
	crypto: 'crypto-browserify',
	domain: 'domain-browser',
	events: 'events/',
	http: 'stream-http',
	https: 'https-browserify',
	os: 'os-browserify/browser.js',
	path: 'path-browserify',
	process: 'process/browser.js',
	punycode: 'punycode/',
	querystring: 'querystring-es3/',
	stream: 'stream-browserify',
	string_decoder: 'string_decoder/',
	sys: 'util/util.js',
	timers: 'timers-browserify',
	tty: 'tty-browserify',
	url: 'url/',
	util: 'util/util.js',
	vm: 'vm-browserify',
	zlib: 'browserify-zlib',
});

const nodeProtocolPrefix = 'node:';

/**
 * The core module name a bare import specifier asks for, or `null` when the
 * specifier is not one webpack 4 polyfilled. Both `stream` and `node:stream`
 * name the same module.
 */
export function craNodeCoreModuleName(source: string): string | null {
	const bare = source.startsWith(nodeProtocolPrefix)
		? source.slice(nodeProtocolPrefix.length)
		: source;
	return Object.hasOwn(craWebpackNodeCoreShimSpecifiers, bare) ? bare : null;
}

/** The package a shim specifier belongs to, for a diagnosable failure. */
export function craNodeCoreShimPackage(specifier: string): string {
	const segments = specifier.split('/').filter((segment) => segment.length > 0);
	const first = segments[0] ?? specifier;
	return first.startsWith('@') && segments.length > 1
		? `${first}/${segments[1] as string}`
		: first;
}

/** Resolve a bare specifier to a file, the way a require from a directory would. */
export type CraModuleResolver = (specifier: string) => string;

/**
 * A resolver that searches the application's own dependency closure, which is
 * what webpack 4 did: the shim packages arrive through react-scripts' transitive
 * closure and are resolved against the application being compiled, never against
 * the build tool's own installation.
 */
export function craApplicationModuleResolver(applicationRoot: string): CraModuleResolver {
	const applicationRequire = createRequire(
		path.join(path.resolve(applicationRoot), 'package.json'),
	);
	return (specifier) => applicationRequire.resolve(specifier);
}

/**
 * Resolve one Node core module to its webpack 4 browser shim. A shim missing
 * from the application's closure is a hard failure naming the module, the
 * package webpack would have used, and where it was searched — never a silent
 * stub, because a silent stub is the defect this capability exists to remove.
 */
export function resolveCraNodeCoreModule(
	module: string,
	resolver: CraModuleResolver,
	origin: string,
): string {
	const specifier = craWebpackNodeCoreShimSpecifiers[module];
	if (specifier === undefined)
		throw new Error(`Node core module "${module}" has no webpack 4 browser shim`);
	try {
		return resolver(specifier);
	} catch {
		throw new Error(
			`create-react-app compatibility: this build imports the Node core module "${module}", ` +
				`which webpack 4 resolved to the browser shim "${specifier}". The package ` +
				`"${craNodeCoreShimPackage(specifier)}" is absent from the application dependency ` +
				`closure at ${origin}, so "${module}" cannot be provided and would reach the browser ` +
				`as an undefined stub. Install it into that closure or drop the import.`,
		);
	}
}

/**
 * The identifiers webpack 4 injected into every module it bundled for the
 * browser, and the core module each one is sourced from. `node.process`,
 * `node.Buffer` and `node.setImmediate` all default to `true` on the webpack 4
 * line create-react-app pins, so a dependency that reads `process.nextTick`,
 * constructs a `Buffer`, or calls `setImmediate` keeps working with no import.
 * Vite injects nothing, so those same references reach the browser free and the
 * first one evaluated throws `ReferenceError: process is not defined`.
 *
 * The bootstrap module below installs exactly these bindings, sourced from the
 * same shim packages the resolution table names, and it is evaluated before the
 * application entry. `global` is not listed: it is already supplied as a
 * compile-time substitution by the global identifier capability.
 */
export const craWebpackNodeInjectedGlobals: Readonly<Record<string, string>> = Object.freeze({
	Buffer: 'buffer',
	clearImmediate: 'timers',
	process: 'process',
	setImmediate: 'timers',
});

/** The module id an entry document imports to install webpack's injected globals. */
export const craNodeGlobalsModuleId = 'virtual:versionless-cra-node-globals';

const resolvedNodeGlobalsModuleId = `\0${craNodeGlobalsModuleId}`;

/**
 * Source for the injected-globals bootstrap, built from files already resolved
 * out of the application's own closure. Assignment is conditional so a host that
 * genuinely provides one of these names keeps it.
 */
export function craNodeGlobalsBootstrapSource(
	files: Readonly<{ process: string; buffer: string; timers: string }>,
): string {
	return [
		`import craProcess from ${JSON.stringify(files.process)};`,
		`import craBuffer from ${JSON.stringify(files.buffer)};`,
		`import craTimers from ${JSON.stringify(files.timers)};`,
		'globalThis.process ??= craProcess;',
		'globalThis.Buffer ??= craBuffer.Buffer;',
		'globalThis.setImmediate ??= craTimers.setImmediate;',
		'globalThis.clearImmediate ??= craTimers.clearImmediate;',
		'',
	].join('\n');
}

export type CraResolvedRootConfig = Readonly<{ root: string }>;
export type CraNodeCoreModulePlugin = Readonly<{
	name: string;
	enforce: 'pre';
	configResolved(config: CraResolvedRootConfig): void;
	resolveId(source: string): string | null;
	load(id: string): string | null;
}>;

export type CraNodeCoreModuleOptions = Readonly<{ applicationRoot?: string }>;

/**
 * Provide webpack 4's Node core module polyfills to a Vite build. Resolution is
 * lazy — a core module is only resolved when the module graph actually asks for
 * it — so an application that imports nothing from the standard library pays
 * nothing and cannot be failed by a shim it never needed.
 */
export function createCraNodeCoreModulePlugin(
	options: CraNodeCoreModuleOptions = {},
): CraNodeCoreModulePlugin {
	let applicationRoot = options.applicationRoot ?? '';
	let resolver: CraModuleResolver | null = null;
	const resolve = (module: string): string => {
		if (!applicationRoot)
			throw new Error('CRA node core module resolution has no application root');
		resolver ??= craApplicationModuleResolver(applicationRoot);
		return resolveCraNodeCoreModule(module, resolver, applicationRoot);
	};
	return {
		name: 'versionless-cra-node-core-modules',
		enforce: 'pre',
		configResolved(config) {
			if (!options.applicationRoot) applicationRoot = config.root;
			resolver = null;
		},
		resolveId(source) {
			if (source === craNodeGlobalsModuleId) return resolvedNodeGlobalsModuleId;
			const module = craNodeCoreModuleName(source);
			return module === null ? null : resolve(module);
		},
		load(id) {
			if (id !== resolvedNodeGlobalsModuleId) return null;
			return craNodeGlobalsBootstrapSource({
				buffer: resolve('buffer'),
				process: resolve('process'),
				timers: resolve('timers'),
			});
		},
	};
}

/**
 * Rewrite webpack's tilde-prefixed bare specifiers in CSS `@import` rules to
 * plain bare specifiers, which Vite resolves through node resolution.
 */
export function rewriteWebpackTildeCssImports(code: string): string {
	return code.replace(tildePrefixedCssImport, (match: string) => match.slice(0, -1));
}

function pathWithoutQuery(id: string): string {
	const index = id.indexOf('?');
	return index === -1 ? id : id.slice(0, index);
}

export type CraTransformResult = Readonly<{ code: string; map: null }>;
export type CraTransformPlugin = Readonly<{
	name: string;
	enforce: 'pre';
	transform(code: string, id: string): CraTransformResult | null;
}>;

export function createCraTildeCssImportPlugin(): CraTransformPlugin {
	return {
		name: 'versionless-cra-tilde-css-import',
		enforce: 'pre',
		transform(code, id) {
			if (path.extname(pathWithoutQuery(id)) !== '.css') return null;
			const rewritten = rewriteWebpackTildeCssImports(code);
			return rewritten === code ? null : { code: rewritten, map: null };
		},
	};
}

/**
 * webpack 4 evaluated every non-harmony module inside a plain function wrapper
 * — `function (module, exports, __webpack_require__) { … }` — in the enclosing
 * bundle's mode. The bundles create-react-app 3 and 4 emit carry no `"use
 * strict"` prologue for those wrappers, so a CommonJS dependency ran in
 * sloppy mode: an assignment to an undeclared name silently created a property
 * on the global object, and every later reference to that name — in the same
 * module or in any other — read it back off the global object.
 *
 * Vite emits ECMAScript modules, and module code is always strict. The same
 * assignment is now a write to an unresolvable reference, which throws
 * `ReferenceError: <name> is not defined` the moment the module is evaluated,
 * long before the application can mount.
 *
 * The capability below restores webpack's tolerance without unpicking strict
 * mode anywhere. A dependency module that webpack would have wrapped in sloppy
 * mode is scanned for exactly the names it assigns without declaring; for each
 * one a prelude creates the property on `globalThis` if nothing already holds
 * it. Strict mode only rejects assignments to references it cannot resolve, and
 * a property of the global object is resolvable, so the original assignment
 * evaluates unchanged — and, because the binding lives on the global object
 * rather than in the module, cross-module reads of the same name find the same
 * value webpack's implicit global gave them.
 *
 * Three properties matter, and each is enforced rather than asserted:
 *
 * - Application source is untouched. Only modules under a dependency directory
 *   are scanned, so first-party code keeps every strict-mode diagnostic.
 * - Harmony modules are untouched. webpack made those strict too, so a module
 *   carrying `import`/`export` is left exactly as it is.
 * - A module that cannot be analysed is a hard failure naming the module and
 *   the diagnostic, never a silent skip.
 */

const dependencyDirectorySegment = 'node_modules';

/**
 * The extensions webpack 4 fed through its sloppy CommonJS wrapper. `.mjs` is
 * absent on purpose: webpack forced those to harmony, hence to strict mode.
 */
const sloppyCommonJsExtensions: ReadonlySet<string> = new Set(['.js', '.cjs', '']);

/** True when a module id lies inside a dependency directory. */
export function craIsDependencyModule(id: string): boolean {
	return path.normalize(id).split('/').includes(dependencyDirectorySegment);
}

export type CraSloppyModuleKind = 'sloppy-commonjs' | 'ecmascript-module' | 'unanalyzable';

export type CraImplicitGlobalScan = Readonly<{
	kind: CraSloppyModuleKind;
	names: readonly string[];
	diagnostics: readonly string[];
}>;

/**
 * Classify a module the way webpack 4 did and, when it is one of the sloppy
 * CommonJS modules, report the names it assigns without ever declaring them.
 *
 * The scan rides a real scope resolution: a name counts only when a write
 * reference resolves to no binding in any enclosing scope, so a local variable,
 * a parameter, a `catch` binding or a hoisted `var` of the same name elsewhere
 * in the module never produces a false report, and a shadowed inner name never
 * hides a genuine implicit global.
 */
export function scanCraImplicitGlobals(code: string, id = 'dependency.js'): CraImplicitGlobalScan {
	const script = analyze(code, { path: id, lang: 'js', sourceType: 'script' });
	const scriptErrors = script.diagnostics.filter((entry) => entry.severity === 'error');
	if (scriptErrors.length > 0) {
		// Harmony syntax is the ordinary reason a script parse fails, and webpack
		// ran those modules in strict mode as well. Anything that parses as
		// neither is a module this capability cannot reason about.
		const esm = analyze(code, { path: id, lang: 'js', sourceType: 'module' });
		const esmErrors = esm.diagnostics.filter((entry) => entry.severity === 'error');
		return esmErrors.length === 0
			? Object.freeze({ kind: 'ecmascript-module', names: [], diagnostics: [] })
			: Object.freeze({
					kind: 'unanalyzable',
					names: [],
					diagnostics: esmErrors.map((entry) => entry.message),
				});
	}
	if (script.imports.length > 0 || script.exports.length > 0)
		return Object.freeze({ kind: 'ecmascript-module', names: [], diagnostics: [] });
	const names = new Set<string>();
	for (const reference of script.unresolvedReferences)
		if (reference.isWrite) names.add(reference.name);
	return Object.freeze({
		kind: 'sloppy-commonjs',
		names: [...names].sort(compareUtf16CodeUnits),
		diagnostics: [],
	});
}

/**
 * The prelude that gives a sloppy-mode implicit global its binding. Creating
 * the property is conditional, so a name the host genuinely owns — or one an
 * earlier dependency already assigned — keeps the value it has; only the
 * binding webpack's global object would have carried is added.
 */
export function craImplicitGlobalPrelude(names: readonly string[]): string {
	if (names.length === 0) return '';
	const statements = names
		.map((name) => {
			const key = JSON.stringify(name);
			return `if (!(${key} in globalThis)) globalThis[${key}] = void 0;`;
		})
		.join(' ');
	return `/* webpack sloppy-mode implicit globals */ ${statements}`;
}

/**
 * The module source with its implicit-global prelude installed. The prelude
 * occupies no line of its own — it is appended to the first line — so every
 * line number in the original module, and therefore every source map that
 * refers to it, still points where it did. A hashbang keeps the first line.
 */
export function craSloppyCommonJsSource(code: string, names: readonly string[]): string {
	const prelude = craImplicitGlobalPrelude(names);
	if (prelude === '') return code;
	if (!code.startsWith('#!')) return `${prelude}${code}`;
	const firstLineEnd = code.indexOf('\n');
	if (firstLineEnd === -1) return `${code}\n${prelude}`;
	return `${code.slice(0, firstLineEnd + 1)}${prelude}${code.slice(firstLineEnd + 1)}`;
}

export type CraImplicitGlobalRecord = Readonly<{ id: string; names: readonly string[] }>;

export type CraSloppyCommonJsGlobalsOptions = Readonly<{
	observe?: (record: CraImplicitGlobalRecord) => void;
}>;

/**
 * Reproduce webpack 4's sloppy-mode CommonJS wrapper for dependency modules.
 * A module that declares everything it assigns is returned untouched, so a
 * dependency closure with no implicit globals emits byte-identical output.
 */
export function createCraSloppyCommonJsGlobalsPlugin(
	options: CraSloppyCommonJsGlobalsOptions = {},
): CraTransformPlugin {
	return {
		name: 'versionless-cra-sloppy-commonjs-globals',
		enforce: 'pre',
		transform(code, id) {
			const file = pathWithoutQuery(id);
			if (!craIsDependencyModule(file)) return null;
			if (!sloppyCommonJsExtensions.has(path.extname(file))) return null;
			const scan = scanCraImplicitGlobals(code, file);
			if (scan.kind === 'unanalyzable')
				throw new Error(
					`create-react-app compatibility: the dependency module ${file} parses as neither ` +
						`a script nor an ECMAScript module, so webpack 4's sloppy-mode CommonJS wrapper ` +
						`cannot be reproduced for it and an implicit global it may rely on would reach ` +
						`the browser as a ReferenceError. Parser diagnostics: ${scan.diagnostics.join('; ')}`,
				);
			if (scan.names.length === 0) return null;
			options.observe?.({ id: file, names: scan.names });
			return { code: craSloppyCommonJsSource(code, scan.names), map: null };
		},
	};
}

/**
 * webpack 4 turned a module's bytes into text before any loader saw them, and it
 * did so leniently. `loader-runner`, the reader webpack 4 delegates every module
 * read to, calls `buffer.toString("utf-8")` and then strips a leading byte order
 * mark; Node's UTF-8 decoder never fails, so a byte sequence that is not
 * well-formed UTF-8 becomes U+FFFD REPLACEMENT CHARACTER and the module keeps
 * loading. Rolldown, the bundler Vite 8 builds with, requires a module source to
 * be valid UTF-8 and refuses to load one that is not — `stream did not contain
 * valid UTF-8` — so a dependency stored in a legacy single-byte encoding stops
 * the build outright where webpack carried it.
 *
 * The semantics reproduced here were measured, not assumed. A webpack 4.44.2
 * create-react-app production build was read back byte by byte for a dependency
 * that ships one file in ISO-8859-1 and a sibling file carrying the same names
 * in valid UTF-8:
 *
 * - The ISO-8859-1 file's names reached the bundle with U+FFFD in place of each
 *   invalid byte — `"Esa�"`, not `"Esaù"`.
 * - The sibling UTF-8 file's identical names reached the same bundle intact, as
 *   `"Esaù"`.
 *
 * The second observation is the control: it rules out the tempting hypothesis
 * that webpack decoded the bytes as ISO-8859-1. It did not. It decoded them as
 * UTF-8 and substituted, losing the accents, and the application it was building
 * shipped that way. Reproducing webpack means reproducing the loss, because
 * parity with the bundler being replaced is the property under test — not a
 * better answer than the one production already had.
 *
 * A note on freeze order: this capability postdates the tranche-one adapter
 * freeze (composite fingerprint d9f75ef6…). It was written after that freeze was
 * superseded and before the freeze boundary that governs any later re-run, so no
 * measurement recorded under d9f75ef6 was taken with it in place.
 */

/**
 * The extensions this capability decodes. These are the JavaScript module
 * sources webpack 4 fed through `babel-loader`, all of which arrived as text
 * through the lenient reader above. Stylesheets, JSON, and binary assets are not
 * listed: they travel a different Vite pipeline whose loading this capability
 * does not intercept, and nothing is claimed about them.
 */
const decodableModuleExtensions: ReadonlySet<string> = new Set([
	'.cjs',
	'.js',
	'.jsx',
	'.mjs',
	'.ts',
	'.tsx',
]);

const byteOrderMarkCodeUnit = 0xfeff;

/**
 * What a module's leading bytes say about its encoding. Only `utf-8` and
 * `utf-8-with-invalid-bytes` are decodable here; the rest are named so a refusal
 * can say what it refused.
 */
export type CraModuleSourceEncoding =
	| 'utf-8'
	| 'utf-8-with-invalid-bytes'
	| 'utf-16le'
	| 'utf-16be'
	| 'utf-32le'
	| 'utf-32be';

function startsWithBytes(bytes: Uint8Array, prefix: readonly number[]): boolean {
	if (bytes.length < prefix.length) return false;
	return prefix.every((byte, index) => bytes[index] === byte);
}

/**
 * Classify a module source by its bytes alone. The byte order marks are checked
 * first because none of them is valid UTF-8, so a UTF-16 or UTF-32 file would
 * otherwise be indistinguishable from a legacy single-byte one. Everything else
 * is decided by a real UTF-8 validation of the whole buffer — never by a file
 * name, a path, or a package.
 */
export function craModuleSourceEncoding(bytes: Uint8Array): CraModuleSourceEncoding {
	if (startsWithBytes(bytes, [0xff, 0xfe, 0x00, 0x00])) return 'utf-32le';
	if (startsWithBytes(bytes, [0x00, 0x00, 0xfe, 0xff])) return 'utf-32be';
	if (startsWithBytes(bytes, [0xff, 0xfe])) return 'utf-16le';
	if (startsWithBytes(bytes, [0xfe, 0xff])) return 'utf-16be';
	return isUtf8(bytes) ? 'utf-8' : 'utf-8-with-invalid-bytes';
}

function utf8SequenceLength(lead: number): number {
	if (lead <= 0x7f) return 1;
	if (lead >= 0xc2 && lead <= 0xdf) return 2;
	if (lead >= 0xe0 && lead <= 0xef) return 3;
	if (lead >= 0xf0 && lead <= 0xf4) return 4;
	return 0;
}

/**
 * The offset of every byte that begins a sequence UTF-8 cannot represent —
 * exactly the positions Node's decoder substitutes a U+FFFD for. This is the
 * measured fact the capability is keyed on, and it is what a diagnostic reports.
 * Overlong forms, surrogate code points and out-of-range lead bytes are all
 * rejected, so the scan agrees with `isUtf8` on whether a buffer is well formed.
 */
export function craInvalidUtf8ByteOffsets(bytes: Uint8Array): readonly number[] {
	const offsets: number[] = [];
	let index = 0;
	while (index < bytes.length) {
		const lead = bytes[index] as number;
		const length = utf8SequenceLength(lead);
		if (length === 0) {
			offsets.push(index);
			index += 1;
			continue;
		}
		if (length === 1) {
			index += 1;
			continue;
		}
		const lowestSecond = lead === 0xe0 ? 0xa0 : lead === 0xf0 ? 0x90 : 0x80;
		const highestSecond = lead === 0xed ? 0x9f : lead === 0xf4 ? 0x8f : 0xbf;
		let wellFormed = index + length <= bytes.length;
		if (wellFormed) {
			const second = bytes[index + 1] as number;
			wellFormed = second >= lowestSecond && second <= highestSecond;
			for (let step = 2; wellFormed && step < length; step += 1) {
				const continuation = bytes[index + step] as number;
				wellFormed = continuation >= 0x80 && continuation <= 0xbf;
			}
		}
		if (!wellFormed) {
			offsets.push(index);
			index += 1;
			continue;
		}
		index += length;
	}
	return Object.freeze(offsets);
}

/**
 * webpack 4's `utf8BufferToString`, reproduced: decode the whole buffer as UTF-8
 * with substitution, then drop a leading byte order mark. `Buffer.prototype
 * .toString('utf8')` is the same call `loader-runner` makes, so this is the
 * decoder itself rather than a reimplementation of it.
 */
export function craWebpackDecodedSource(bytes: Uint8Array): string {
	const text = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('utf8');
	return text.charCodeAt(0) === byteOrderMarkCodeUnit ? text.slice(1) : text;
}

/**
 * The text webpack 4 would have handed its loaders for these bytes, or a hard
 * failure naming the encoding.
 *
 * The refusal is deliberately narrower than webpack. webpack decoded a UTF-16
 * file as UTF-8 too, and produced mojibake for it; that is not a capability
 * worth reproducing, and pretending to have decoded such a file would hide a
 * broken build behind a plausible-looking string. Naming the encoding and
 * stopping is the truthful outcome.
 */
export function craDecodedModuleSource(bytes: Uint8Array, origin: string): string {
	const encoding = craModuleSourceEncoding(bytes);
	if (encoding === 'utf-8' || encoding === 'utf-8-with-invalid-bytes')
		return craWebpackDecodedSource(bytes);
	throw new Error(
		`create-react-app compatibility: the dependency module ${origin} is stored in ${encoding}, ` +
			`which is not UTF-8 and is not an encoding this capability decodes. webpack 4 read every ` +
			`module as UTF-8 regardless of its encoding, so it would have turned this file into ` +
			`mojibake rather than reading it correctly, and reproducing that is not claimed here. ` +
			`Re-encode the file as UTF-8 or drop the import.`,
	);
}

export type CraDecodedModuleRecord = Readonly<{
	id: string;
	encoding: CraModuleSourceEncoding;
	invalidByteOffsets: readonly number[];
}>;

export type CraNonUtf8ModuleSourceOptions = Readonly<{
	observe?: (record: CraDecodedModuleRecord) => void;
}>;

export type CraLoadPlugin = Readonly<{
	name: string;
	enforce: 'pre';
	load(id: string): Promise<string | null>;
}>;

/**
 * Supply webpack 4's lenient module-source decoding to a Vite build.
 *
 * The hook reads the bytes and validates them. A module whose bytes are valid
 * UTF-8 is returned to Vite untouched — the hook yields `null`, Vite loads the
 * file exactly as it always did, and the build is byte-for-byte what it would
 * have been without this capability. Only a module that Vite's bundler would
 * refuse outright is decoded here, and only then.
 *
 * The scope is the dependency closure, for the same reason the sloppy-mode
 * wrapper is scoped there: an application's own source with invalid bytes in it
 * is a defect in the application, and silently substituting characters into
 * first-party code would hide it. Dependencies are different — they are frozen
 * artifacts the migration cannot edit, and webpack already shipped them decoded
 * this way.
 *
 * The cost is one extra file read per dependency JavaScript module: the bytes
 * are read to be validated, and read again by Vite when they are valid. That is
 * paid deliberately, because handing Vite a string for every dependency would
 * substitute this capability's loading for Vite's own on files that never needed
 * it, and the untouched claim above would stop being true.
 */
export function createCraNonUtf8ModuleSourcePlugin(
	options: CraNonUtf8ModuleSourceOptions = {},
): CraLoadPlugin {
	return {
		name: 'versionless-cra-non-utf8-module-source',
		enforce: 'pre',
		async load(id) {
			if (id.startsWith('\0')) return null;
			const file = pathWithoutQuery(id);
			if (!craIsDependencyModule(file)) return null;
			if (!decodableModuleExtensions.has(path.extname(file))) return null;
			let bytes: Uint8Array;
			try {
				bytes = await readFile(file);
			} catch {
				return null;
			}
			const encoding = craModuleSourceEncoding(bytes);
			if (encoding === 'utf-8') return null;
			const source = craDecodedModuleSource(bytes, file);
			options.observe?.({
				id: file,
				encoding,
				invalidByteOffsets: craInvalidUtf8ByteOffsets(bytes),
			});
			return source;
		},
	};
}

/**
 * create-react-app compiles every module of the application's own source through
 * `babel-preset-react-app`, and that preset always includes `@babel/preset-react`.
 * The consequence is a syntax fact rather than a transform fact: a `.js` file in
 * a create-react-app application may contain JSX, and every generation of the
 * tool has accepted it — `src/index.js` rendering `<React.StrictMode>` is the
 * shape the tool's own template ships.
 *
 * Vite decides a module's syntax from its extension: `.jsx` and `.tsx` are
 * parsed with JSX enabled and `.js` is not, so the same `src/index.js` stops the
 * build at parse time with `Unexpected JSX expression … JSX syntax is disabled`.
 * Nothing about that file is wrong; the parser was simply told a narrower
 * grammar than the bundler being replaced used.
 *
 * The capability below promotes an application-source JavaScript module to the
 * JSX module type, which is exactly the grammar babel parsed it with. Three
 * properties are worth stating:
 *
 * - It changes no code. Only the declared module type is raised, so a file
 *   containing no JSX bundles byte-identically either way — JSX parsing is a
 *   superset of the JavaScript grammar for the positions JSX can occupy.
 * - Dependencies are excluded, and that matches create-react-app: its
 *   `babel-loader` rule for `node_modules` uses `babel-preset-react-app/dependencies`,
 *   which does not include the React preset, so a dependency's `.js` was never
 *   parsed with JSX enabled and must not start being.
 * - The boundary used is the dependency-directory boundary the other
 *   capabilities here use, which is broader than create-react-app's own
 *   `src`-only include. The difference is inert: a first-party `.js` outside
 *   `src` that contains no JSX parses the same either way, and one that does
 *   contain JSX is a file create-react-app would have refused rather than a file
 *   this changes the meaning of.
 */
const jsxCapableApplicationExtensions: ReadonlySet<string> = new Set(['.js', '.mjs']);

/** The JSX-capable module type, named once so the plugin and its tests agree. */
export const craJsxModuleType = 'jsx';

/**
 * True when a module is application source that create-react-app would have
 * parsed with JSX enabled.
 */
export function craModuleIsJsxCapableApplicationSource(id: string): boolean {
	if (id.startsWith('\0')) return false;
	const file = pathWithoutQuery(id);
	if (craIsDependencyModule(file)) return false;
	return jsxCapableApplicationExtensions.has(path.extname(file));
}

export type CraModuleTypeResult = Readonly<{ code: string; map: null; moduleType: string }>;
export type CraModuleTypePlugin = Readonly<{
	name: string;
	enforce: 'pre';
	transform(code: string, id: string): CraModuleTypeResult | null;
}>;

/**
 * Parse application-source JavaScript with JSX enabled, the way
 * `babel-preset-react-app` did. A module that is not application source, or
 * whose extension create-react-app did not feed through the React preset, is
 * left entirely alone.
 */
export function createCraJavaScriptJsxPlugin(): CraModuleTypePlugin {
	return {
		name: 'versionless-cra-javascript-jsx',
		enforce: 'pre',
		transform(code, id) {
			if (!craModuleIsJsxCapableApplicationSource(id)) return null;
			return { code, map: null, moduleType: craJsxModuleType };
		},
	};
}

async function filesBelow(directory: string): Promise<string[]> {
	const files: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const item = path.join(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await filesBelow(item)));
		else if (entry.isFile()) files.push(item);
	}
	return files;
}

/**
 * The create-react-app public directory inventory: every file below the
 * directory except the excluded template, as sorted relative POSIX paths.
 */
export async function craPublicAssetPaths(
	directory: string,
	exclude: readonly string[] = [],
): Promise<readonly string[]> {
	const excluded = new Set(exclude);
	return (await filesBelow(directory))
		.map((file) => path.relative(directory, file).split(path.sep).join('/'))
		.filter((file) => !excluded.has(file))
		.sort(compareUtf16CodeUnits);
}

export type CraResolvedBuildConfig = Readonly<{ build: Readonly<{ outDir: string }> }>;
export type CraOutputPlugin = Readonly<{
	name: string;
	configResolved(config: CraResolvedBuildConfig): void;
	closeBundle: Readonly<{ order: 'post'; sequential: true; handler(): Promise<void> }>;
}>;

export type CraPublicDirectoryOptions = Readonly<{
	directory: string;
	exclude?: readonly string[];
}>;

/**
 * Copy the create-react-app public directory into the build output the way
 * `react-scripts build` does, excluding the HTML template that becomes the
 * bundled entry document.
 */
export function createCraPublicDirectoryPlugin(
	options: CraPublicDirectoryOptions,
): CraOutputPlugin {
	let outputDirectory = '';
	return {
		name: 'versionless-cra-public-directory',
		configResolved(config) {
			outputDirectory = path.resolve(config.build.outDir);
		},
		closeBundle: {
			order: 'post',
			sequential: true,
			async handler() {
				if (!outputDirectory) throw new Error('CRA public directory outDir is unresolved');
				for (const file of await craPublicAssetPaths(
					options.directory,
					options.exclude ?? [],
				)) {
					const destination = path.join(outputDirectory, file);
					await mkdir(path.dirname(destination), { recursive: true });
					await writeFile(
						destination,
						await readFile(path.join(options.directory, file)),
					);
				}
			},
		},
	};
}

/**
 * webpack 4 resolved an `import { x } from "m"` whose target module never
 * exported `x` to `undefined` rather than refusing the build. Its ESM linker
 * (`webpack/lib/dependencies/HarmonyImportSpecifierDependency`) emitted a
 * runtime access that produced `undefined` for an unknown export and, on the
 * webpack 4 line create-react-app 4 pins, only warned. Rolldown — the bundler
 * Vite 8 builds with — implements the specification's binding resolution
 * strictly: a named import of an export the target module does not provide is a
 * hard `MISSING_EXPORT` at the chunk-rendering stage, and the build stops.
 *
 * The shape this closes is a *self-inconsistent dependency ES module*: a
 * published `dist` build whose own files import a named binding that a sibling
 * module in the same package never exports. Codegen that emits import
 * statements ahead of the exports it assumes — `babel-plugin-flow-react-proptypes`
 * is one such generator — produces this routinely: it inserts
 * `import { <marker> } from "./sibling"` for a type whose module happens to
 * carry no runtime marker, so the binding dangles. webpack shipped those files
 * with the binding `undefined` and the application ran; rolldown will not link
 * them.
 *
 * The capability below reproduces webpack's resolution — the dangling binding
 * becomes `undefined` — but only where that is provably the same outcome
 * webpack shipped, and never as a blanket suppression of missing exports:
 *
 * - **Dependency modules only.** A dangling import in the application's own
 *   source is a real defect in first-party code, and webpack would have warned
 *   on it too; it is left to fail. Only modules under a dependency directory —
 *   the frozen `dist` artifacts the migration cannot edit — are considered.
 * - **Analyzer-proven absence.** The target module is resolved and its actual
 *   export surface read; the binding is neutralized only when the name is
 *   genuinely absent from it. A name the target does export (directly, by
 *   named re-export, or — conservatively — behind an unresolved `export *`) is
 *   left exactly as written, so a binding that really does link is untouched.
 * - **Provably safe under `undefined`.** The dangling binding is neutralized
 *   only when every reference to it is one the module's own evaluation does not
 *   dereference: a use nested inside a function body (deferred until the
 *   function is called), an `export {…}` / `export default` alias that forwards
 *   the binding by name, a type-only position, or no use at all. A binding read
 *   in a value position at module-evaluation scope would make `undefined`
 *   observable where webpack's `undefined` was too — that is the real-error
 *   case, and it is refused so rolldown still reports it.
 *
 * The rewrite keeps the target module in the graph: when every named specifier
 * of a declaration is neutralized, the declaration is rewritten to a
 * side-effect import (`import "m";`) so the module still evaluates in the same
 * order webpack evaluated it, and one `const <local> = void 0;` is emitted for
 * each neutralized binding. A module with no dangling import is returned
 * untouched, so a dependency closure that links cleanly emits byte-identical
 * output.
 */

/**
 * The export surface of a dependency module: every name it exports, and whether
 * it carries an `export *` this surface did not resolve (a nameless re-export,
 * whose contributed names are unknown). `hasStar` forces the conservative
 * outcome — a name is never treated as absent from a module that might supply
 * it through a star it did not follow.
 */
export type CraModuleExportSurface = Readonly<{ names: ReadonlySet<string>; hasStar: boolean }>;

/**
 * Read a module's export surface from its source. Returns `null` when the
 * source does not analyse as an ECMAScript module, because an unparseable
 * target proves nothing about what it exports.
 */
export function craModuleExportSurface(
	code: string,
	id = 'dependency.js',
): CraModuleExportSurface | null {
	const module = analyze(code, { path: id, lang: 'js', sourceType: 'module' });
	if (module.diagnostics.some((entry) => entry.severity === 'error')) return null;
	const names = new Set<string>();
	let hasStar = false;
	for (const record of module.exports) {
		if (record.name !== null) names.add(record.name);
		else hasStar = true;
	}
	return Object.freeze({ names, hasStar });
}

/** The extensions a relative dependency specifier resolves through, in order. */
const relativeModuleExtensions: readonly string[] = ['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx'];

function isExistingFile(candidate: string): boolean {
	try {
		return statSync(candidate).isFile();
	} catch {
		return false;
	}
}

/**
 * Resolve a relative specifier to a file the way a bundler's node resolution
 * would: the exact path, then each module extension, then an `index` file in a
 * directory of that name. A bare (non-relative) specifier returns `null` — it
 * names another package, not a sibling of a self-inconsistent module.
 */
export function craResolveRelativeModule(fromFile: string, specifier: string): string | null {
	if (!specifier.startsWith('.')) return null;
	const base = path.resolve(path.dirname(fromFile), specifier);
	const candidates = [
		base,
		...relativeModuleExtensions.map((extension) => `${base}${extension}`),
		...relativeModuleExtensions.map((extension) => path.join(base, `index${extension}`)),
	];
	for (const candidate of candidates) if (isExistingFile(candidate)) return candidate;
	return null;
}

/** Read a target module's export surface from disk, or `null` when unreadable. */
export function craReadModuleExportSurface(file: string): CraModuleExportSurface | null {
	let code: string;
	try {
		code = readFileSync(file, 'utf8');
	} catch {
		return null;
	}
	return craModuleExportSurface(code, file);
}

/**
 * True when the module's own evaluation never dereferences this reference, so
 * substituting `undefined` for the binding cannot throw at module-evaluation
 * time. A reference inside a function body is deferred until the function runs;
 * an `export`/`import` alias (space `"any"`) forwards the binding by name
 * without reading its value; a type-only position is erased. Anything else is a
 * value read at evaluation scope, where `undefined` would be observable.
 */
function craReferenceSafeUnderUndefined(reference: Reference): boolean {
	if (reference.inTypePosition) return true;
	if (reference.space === 'any') return true;
	for (const scope of reference.scope.ancestors())
		if (scope.kind === 'function' || scope.kind === 'functionBody') return true;
	return false;
}

type CraImportDeclarationNode = NodeOfType<'ImportDeclaration'>;
type CraImportDeclarationSpecifier = CraImportDeclarationNode['specifiers'][number];

/** The literal `undefined` value a neutralized dangling binding resolves to. */
const craDanglingBindingValue = 'void 0';

/** Reconstruct an import clause from the specifiers a declaration keeps. */
function craImportClause(specifiers: readonly CraImportDeclarationSpecifier[]): string {
	let defaultName: string | null = null;
	let namespaceName: string | null = null;
	const named: string[] = [];
	for (const specifier of specifiers) {
		if (specifier.type === 'ImportDefaultSpecifier') defaultName = specifier.local.name;
		else if (specifier.type === 'ImportNamespaceSpecifier')
			namespaceName = specifier.local.name;
		else {
			const imported =
				'name' in specifier.imported
					? specifier.imported.name
					: JSON.stringify(specifier.imported.value);
			named.push(
				imported === specifier.local.name
					? specifier.local.name
					: `${imported} as ${specifier.local.name}`,
			);
		}
	}
	const parts: string[] = [];
	if (defaultName !== null) parts.push(defaultName);
	if (namespaceName !== null) parts.push(`* as ${namespaceName}`);
	if (named.length > 0) parts.push(`{ ${named.join(', ')} }`);
	return parts.join(', ');
}

/** One dangling named import the capability neutralized. */
export type CraDanglingImportRecord = Readonly<{ id: string; specifier: string; name: string }>;

/** How to read the export surface a relative specifier resolves to. */
export type CraModuleExportSurfaceResolver = (specifier: string) => CraModuleExportSurface | null;

export type CraDanglingImportNeutralization = Readonly<{
	code: string;
	neutralized: readonly Readonly<{ specifier: string; name: string }>[];
}>;

/**
 * Neutralize the dangling named imports of a dependency ES module: the pure
 * core of the capability, given `resolve` to read each relative target's export
 * surface. Returns `null` when the module does not analyse as an ES module, has
 * no imports, or carries no dangling-and-safe import — in every one of those
 * cases the source is left exactly as it was.
 */
export function craNeutralizeDanglingImports(
	code: string,
	id: string,
	resolve: CraModuleExportSurfaceResolver,
): CraDanglingImportNeutralization | null {
	const module = analyze(code, { path: id, lang: 'js', sourceType: 'module' });
	if (module.diagnostics.some((entry) => entry.severity === 'error')) return null;
	if (module.imports.length === 0) return null;

	const surfaces = new Map<string, CraModuleExportSurface | null>();
	const declarations = new Map<CraImportDeclarationNode, CraImportDeclarationSpecifier[]>();
	const neutralized: { specifier: string; name: string }[] = [];

	for (const record of module.imports) {
		if (record.isNamespace || record.isSideEffect || record.typeOnly) continue;
		if (record.name === null || record.name === 'default') continue;
		if (record.local === null) continue;
		if (!record.specifier.startsWith('.')) continue;
		if (!surfaces.has(record.specifier)) surfaces.set(record.specifier, resolve(record.specifier));
		const surface = surfaces.get(record.specifier) ?? null;
		if (surface === null || surface.hasStar) continue;
		if (surface.names.has(record.name)) continue;
		if (!record.local.references.every(craReferenceSafeUnderUndefined)) continue;
		const declaration = module.parentOf(record.node);
		if (declaration === null || declaration.type !== 'ImportDeclaration') continue;
		const specifier = declaration.specifiers.find((entry) => entry === record.node);
		if (specifier === undefined) continue;
		const group = declarations.get(declaration) ?? [];
		group.push(specifier);
		declarations.set(declaration, group);
		neutralized.push({ specifier: record.specifier, name: record.name });
	}

	if (declarations.size === 0) return null;

	const edits: { start: number; end: number; text: string }[] = [];
	for (const [declaration, neutralizedSpecifiers] of declarations) {
		const dropped = new Set<CraImportDeclarationSpecifier>(neutralizedSpecifiers);
		const kept = declaration.specifiers.filter((specifier) => !dropped.has(specifier));
		const source = code.slice(declaration.source.start, declaration.source.end);
		const importText =
			kept.length > 0 ? `import ${craImportClause(kept)} from ${source};` : `import ${source};`;
		const bindings = neutralizedSpecifiers
			.map((specifier) => `const ${specifier.local.name} = ${craDanglingBindingValue};`)
			.join(' ');
		edits.push({ start: declaration.start, end: declaration.end, text: `${importText} ${bindings}` });
	}

	edits.sort((left, right) => right.start - left.start);
	let output = code;
	for (const edit of edits) output = `${output.slice(0, edit.start)}${edit.text}${output.slice(edit.end)}`;
	return Object.freeze({ code: output, neutralized });
}

export type CraMissingExportToleranceOptions = Readonly<{
	observe?: (record: CraDanglingImportRecord) => void;
}>;

/**
 * Reproduce webpack 4's `undefined` resolution of a dangling named import for a
 * self-inconsistent dependency ES module. The plugin scopes itself to
 * dependency modules, reads each dangling import's target export surface from
 * disk (cached, so a shared target is analysed once), and rewrites only the
 * imports it can prove are both genuinely absent and safe under `undefined`. A
 * module that links cleanly is returned untouched.
 */
export function createCraMissingExportTolerancePlugin(
	options: CraMissingExportToleranceOptions = {},
): CraTransformPlugin {
	const cache = new Map<string, CraModuleExportSurface | null>();
	const surfaceOf = (file: string): CraModuleExportSurface | null => {
		const cached = cache.get(file);
		if (cached !== undefined || cache.has(file)) return cached ?? null;
		const surface = craReadModuleExportSurface(file);
		cache.set(file, surface);
		return surface;
	};
	return {
		name: 'versionless-cra-missing-export-tolerance',
		enforce: 'pre',
		transform(code, id) {
			if (id.startsWith('\0')) return null;
			const file = pathWithoutQuery(id);
			if (!craIsDependencyModule(file)) return null;
			if (!decodableModuleExtensions.has(path.extname(file))) return null;
			if (!code.includes('import')) return null;
			const result = craNeutralizeDanglingImports(code, file, (specifier) => {
				const target = craResolveRelativeModule(file, specifier);
				return target === null ? null : surfaceOf(target);
			});
			if (result === null) return null;
			for (const record of result.neutralized)
				options.observe?.({ id: file, specifier: record.specifier, name: record.name });
			return { code: result.code, map: null };
		},
	};
}

export type CraViteAdapterOptions = Readonly<{
	publicDirectory: string;
	templateFile?: string;
	applicationRoot?: string;
	observeImplicitGlobals?: (record: CraImplicitGlobalRecord) => void;
	observeDecodedModules?: (record: CraDecodedModuleRecord) => void;
	observeDanglingImports?: (record: CraDanglingImportRecord) => void;
	observeProcessGlobal?: (record: CraProcessGlobalRecord) => void;
}>;

export type CraViteAdapterPlugins = readonly [
	CraLoadPlugin,
	CraModuleTypePlugin,
	CraTransformPlugin,
	CraTransformPlugin,
	CraTransformPlugin,
	CraNodeCoreModulePlugin,
	CraDefinePlugin,
	CraOutputPlugin,
	CraProcessGlobalPlugin,
];

/**
 * The create-react-app compatibility plugin set: webpack's lenient module-source
 * decoding, JSX in application-source JavaScript, tilde CSS specifier
 * rewriting, webpack's sloppy-mode CommonJS wrapper for dependency modules,
 * webpack's `undefined` resolution of a dangling named import in a
 * self-inconsistent dependency ES module, webpack's automatic Node core module
 * polyfills, the ambient `global` identifier, webpack 4's functional `process`
 * global, plus public directory replication.
 *
 * Decoding leads, because it is the only capability here that acts on bytes: a
 * module has to become text before any transform above can read it. The JSX
 * module type follows immediately, because a module has to be parseable before
 * any later transform's output is meaningful. The process global trails: it
 * reads the modules the earlier transforms produce and writes the entry
 * document only after the bundle is complete.
 */
export function createCraViteAdapter(options: CraViteAdapterOptions): CraViteAdapterPlugins {
	return [
		createCraNonUtf8ModuleSourcePlugin(
			options.observeDecodedModules === undefined
				? {}
				: { observe: options.observeDecodedModules },
		),
		createCraJavaScriptJsxPlugin(),
		createCraTildeCssImportPlugin(),
		createCraSloppyCommonJsGlobalsPlugin(
			options.observeImplicitGlobals === undefined
				? {}
				: { observe: options.observeImplicitGlobals },
		),
		createCraMissingExportTolerancePlugin(
			options.observeDanglingImports === undefined
				? {}
				: { observe: options.observeDanglingImports },
		),
		createCraNodeCoreModulePlugin(
			options.applicationRoot === undefined
				? {}
				: { applicationRoot: options.applicationRoot },
		),
		createCraGlobalIdentifierPlugin(),
		createCraPublicDirectoryPlugin({
			directory: options.publicDirectory,
			exclude: [options.templateFile ?? 'index.html'],
		}),
		createCraProcessGlobalPlugin(
			options.observeProcessGlobal === undefined
				? {}
				: { observe: options.observeProcessGlobal },
		),
	];
}
