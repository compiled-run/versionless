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
import { analyze } from 'yuku-analyzer';

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

export type CraViteAdapterOptions = Readonly<{
	publicDirectory: string;
	templateFile?: string;
	applicationRoot?: string;
	observeImplicitGlobals?: (record: CraImplicitGlobalRecord) => void;
}>;

export type CraViteAdapterPlugins = readonly [
	CraTransformPlugin,
	CraTransformPlugin,
	CraNodeCoreModulePlugin,
	CraDefinePlugin,
	CraOutputPlugin,
];

/**
 * The create-react-app compatibility plugin set: tilde CSS specifier rewriting,
 * webpack's sloppy-mode CommonJS wrapper for dependency modules, webpack's
 * automatic Node core module polyfills, the ambient `global` identifier, plus
 * public directory replication.
 */
export function createCraViteAdapter(options: CraViteAdapterOptions): CraViteAdapterPlugins {
	return [
		createCraTildeCssImportPlugin(),
		createCraSloppyCommonJsGlobalsPlugin(
			options.observeImplicitGlobals === undefined
				? {}
				: { observe: options.observeImplicitGlobals },
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
	];
}
