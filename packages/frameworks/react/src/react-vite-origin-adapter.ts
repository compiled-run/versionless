import { createRequire } from 'node:module';
import * as path from 'pathe';
import { analyze, langFromPath, sourceTypeFromPath } from 'yuku-analyzer';

/**
 * Reusable capabilities for lifting a Vite-2-era workspace onto a current Vite
 * target.
 *
 * This is a different migration from the create-react-app one beside it. There
 * the origin bundler is webpack and the work is restoring bindings webpack
 * supplied that Vite does not. Here the origin bundler is Vite itself, several
 * majors back, and the work is the opposite shape: the configuration file is
 * already a Vite configuration, so nothing has to be invented — but the meaning
 * of what it says has moved underneath it. A key that was a default in Vite 2
 * may be a different default now, a plugin that was required then may have been
 * absorbed into the core since, and a client API the source calls may have been
 * removed outright.
 *
 * The danger particular to a Vite-to-Vite lift is that the old configuration
 * usually still *runs*. An unchanged Vite 2 config fed to a current Vite will
 * very often produce a bundle, which makes it tempting to declare the migration
 * done. That bundle is not the same bundle: its syntax floor has moved, and the
 * era plugin still sitting in its plugin list is being interpreted by a plugin
 * container it was never written against. Every capability here exists to make
 * one of those silent movements explicit.
 *
 * Every export is application agnostic. The shapes handled are the ones Vite
 * itself defines — its default option values, its own plugin packages, and its
 * own `import.meta` client API — and no capability branches on an application
 * name, revision, or source string.
 */

/**
 * The browser list Vite 2's `build.target: 'modules'` default expanded to.
 * Reproduced from the Vite 2.9 line, which is the origin era this capability
 * addresses.
 *
 * This is the single most consequential silent movement in a Vite-to-Vite lift.
 * `'modules'` was never a stable value: Vite 2 read it as the list below, and
 * current Vite reads its own default as a rolling baseline that advances with
 * the browser market. A configuration that named no target at all therefore
 * emits a *different* syntax level after the lift than it did before, with no
 * diagnostic anywhere, and the browsers the era build supported quietly stop
 * being supported. Pinning the era list keeps the migrated bundle's syntax floor
 * exactly where the origin build put it, so a parity comparison between the two
 * lanes is comparing bundles built to the same contract.
 */
export const viteTwoModulesBuildTarget: readonly string[] = Object.freeze([
	'es2020',
	'edge88',
	'firefox78',
	'chrome87',
	'safari14',
]);

/** The era build target, as a fresh array a Vite config can own. */
export function viteOriginBuildTarget(): readonly string[] {
	return [...viteTwoModulesBuildTarget];
}

/** Local to this module: the CRA adapter exports the same ordering under its own name. */
function compareUtf16CodeUnits(left: string, right: string): number {
	if (left === right) return 0;
	return left < right ? -1 : 1;
}

/**
 * What a current Vite does with an option a Vite 2 configuration declares.
 *
 * - `carried`: the option means the same thing and is copied across unchanged.
 * - `translated`: the option still exists but its default, its shape, or its
 *   reading has moved, so the lift must state a value rather than inherit one.
 * - `unsupported`: this capability makes no claim about the option. It is never
 *   dropped silently; a plan that meets one refuses.
 */
export type ViteOptionDisposition = 'carried' | 'translated' | 'unsupported';

export type ViteOptionRule = Readonly<{
	disposition: ViteOptionDisposition;
	note: string;
}>;

/**
 * The top-level Vite configuration options this capability can account for, and
 * what happens to each across the Vite 2 to current-Vite boundary.
 *
 * The list is deliberately short. An option absent from it is reported as
 * unsupported rather than assumed harmless, because the failure mode being
 * guarded against is precisely an option that looks inert and is not.
 */
export const viteOriginOptionRules: Readonly<Record<string, ViteOptionRule>> = Object.freeze({
	base: Object.freeze({
		disposition: 'carried',
		note: 'The public base path is read the same way; the value is copied verbatim.',
	}),
	build: Object.freeze({
		disposition: 'translated',
		note:
			"The `build.target` default moved from Vite 2's fixed `'modules'` browser list to a " +
			'rolling baseline, so the migrated build states the era target explicitly instead of ' +
			'inheriting a newer one.',
	}),
	css: Object.freeze({
		disposition: 'carried',
		note: 'Preprocessor options are passed through to the same preprocessors; resolvability of each preprocessor package is checked separately.',
	}),
	define: Object.freeze({
		disposition: 'carried',
		note: 'Compile-time replacements are still literal source substitutions.',
	}),
	plugins: Object.freeze({
		disposition: 'translated',
		note: 'Each era plugin is translated individually; an untranslatable plugin refuses the plan.',
	}),
	publicDir: Object.freeze({
		disposition: 'carried',
		note: 'The copied public directory behaves the same way.',
	}),
	resolve: Object.freeze({
		disposition: 'carried',
		note: 'Alias entries are matched by the same rules; the entries are copied verbatim.',
	}),
	root: Object.freeze({
		disposition: 'carried',
		note: 'The project root is read the same way.',
	}),
	server: Object.freeze({
		disposition: 'carried',
		note:
			'Dev-server options — proxy, cors, port — keep their shape. A production build lane ' +
			'never reads them, so this capability carries them across without claiming to have ' +
			'exercised them.',
	}),
});

export type ViteOriginPluginTranslation = Readonly<{
	/** The package the current Vite idiom uses, or null when the core absorbed it. */
	target: string | null;
	role: string;
	/** What the translation does not establish. Never empty. */
	coverage: string;
}>;

/**
 * The era Vite plugin packages this capability can translate, and what each one
 * becomes.
 *
 * The React plugin is the one that matters for a React workspace and it is the
 * clearest illustration of why a Vite-to-Vite lift needs translation at all. On
 * the Vite 2 line the plugin owned the JSX transform outright: it ran the source
 * through Babel with the automatic runtime and, in serve mode, injected React
 * Fast Refresh. Current Vite performs the JSX transform itself, in its own
 * bundler, reading the JSX mode out of the workspace's `tsconfig.json` — so a
 * production build no longer depends on the plugin for the thing the plugin was
 * originally there to do.
 *
 * That leaves the era plugin instance in a genuinely ambiguous position: it will
 * usually load, it will usually not error, and it will usually not be needed.
 * Leaving it in place is the failure this table exists to prevent, because a
 * plugin written against a plugin container three majors old that happens not to
 * crash is not a migrated plugin — it is an unmeasured one.
 */
export const viteOriginPluginTranslations: Readonly<Record<string, ViteOriginPluginTranslation>> =
	Object.freeze({
		'@vitejs/plugin-react': Object.freeze({
			target: '@vitejs/plugin-react',
			role:
				'On the Vite 2 line this plugin performed the JSX transform through Babel and ' +
				'installed React Fast Refresh in serve mode. Current Vite performs the JSX ' +
				'transform in its own bundler, driven by the workspace tsconfig, so the plugin is ' +
				'no longer what makes JSX compile.',
			coverage:
				'A production build lane exercises neither Fast Refresh nor the dev-only half of ' +
				'this plugin, so a green build establishes nothing about them. When the target ' +
				'lane omits the plugin, that omission is a claim about the build only.',
		}),
		'@vitejs/plugin-react-refresh': Object.freeze({
			target: null,
			role:
				'The Vite 1 and early Vite 2 standalone Fast Refresh plugin. It was superseded by ' +
				'@vitejs/plugin-react and has no current equivalent of its own.',
			coverage:
				'Fast Refresh is a dev-server capability. Nothing about it is established by a ' +
				'build, and this translation does not restore it.',
		}),
	});

/**
 * The current-Vite disposition of one era plugin package, or `null` when this
 * capability has never been taught that package. A `null` is a refusal signal,
 * not an assurance.
 */
export function translateViteOriginPlugin(specifier: string): ViteOriginPluginTranslation | null {
	return Object.hasOwn(viteOriginPluginTranslations, specifier)
		? (viteOriginPluginTranslations[specifier] as ViteOriginPluginTranslation)
		: null;
}

export type ViteOriginConfigFacts = Readonly<{
	/** Top-level option keys the era config's exported object declares, sorted. */
	optionKeys: readonly string[];
	/** Bare package specifiers the era config imports, sorted. */
	importedPackages: readonly string[];
	/** Option keys whose value could not be read as a static key. */
	dynamicOptionKeys: number;
	diagnostics: readonly string[];
}>;

type EstreeNode = Readonly<Record<string, unknown>>;

function nodeType(value: unknown): string {
	return typeof value === 'object' &&
		value !== null &&
		typeof (value as EstreeNode)['type'] === 'string'
		? ((value as EstreeNode)['type'] as string)
		: '';
}

function staticKeyName(property: EstreeNode): string | null {
	if (property['computed'] === true) return null;
	const key = property['key'];
	const kind = nodeType(key);
	if (kind === 'Identifier') {
		const name = (key as EstreeNode)['name'];
		return typeof name === 'string' ? name : null;
	}
	if (kind === 'Literal') {
		const value = (key as EstreeNode)['value'];
		return typeof value === 'string' ? value : null;
	}
	return null;
}

/**
 * Read an era Vite configuration module for the facts a lift has to account
 * for: which top-level options it declares and which packages it pulls in.
 *
 * The read rides a real parse rather than a text scan, because a configuration
 * file is ordinary TypeScript and the option object may be nested inside a
 * `defineConfig(...)` call, spread from a variable, or built conditionally. The
 * object taken is the largest object literal appearing at the top level of the
 * module's default export position — in practice the argument to `defineConfig`
 * or the exported literal itself. A key that cannot be read statically is
 * counted rather than guessed at, so a caller can see that the file withheld
 * something.
 */
export function analyzeViteOriginConfig(
	code: string,
	id = 'vite.config.ts',
): ViteOriginConfigFacts {
	const module = analyze(code, { path: id, lang: 'ts', sourceType: 'module' });
	const errors = module.diagnostics.filter((entry) => entry.severity === 'error');
	if (errors.length > 0)
		return Object.freeze({
			optionKeys: [],
			importedPackages: [],
			dynamicOptionKeys: 0,
			diagnostics: errors.map((entry) => entry.message),
		});
	const packages = new Set<string>();
	const keys = new Set<string>();
	let dynamic = 0;
	let widest = -1;
	module.walk({
		ImportDeclaration(node) {
			const source = (node as unknown as EstreeNode)['source'];
			const value =
				typeof source === 'object' && source !== null
					? (source as EstreeNode)['value']
					: null;
			if (typeof value === 'string' && !value.startsWith('.') && !path.isAbsolute(value))
				packages.add(value);
		},
		ObjectExpression(node) {
			const properties = (node as unknown as EstreeNode)['properties'];
			if (!Array.isArray(properties)) return;
			const named: string[] = [];
			let unread = 0;
			for (const property of properties) {
				if (nodeType(property) !== 'Property') continue;
				const name = staticKeyName(property as EstreeNode);
				if (name === null) unread += 1;
				else named.push(name);
			}
			const known = named.filter((name) => Object.hasOwn(viteOriginOptionRules, name)).length;
			// The configuration object is the object literal declaring the most
			// recognisable Vite options. Nested literals — a proxy table, a build
			// block — declare none, so they never win.
			if (known === 0 || known <= widest) return;
			widest = known;
			keys.clear();
			for (const name of named) keys.add(name);
			dynamic = unread;
		},
	});
	return Object.freeze({
		optionKeys: [...keys].sort(compareUtf16CodeUnits),
		importedPackages: [...packages].sort(compareUtf16CodeUnits),
		dynamicOptionKeys: dynamic,
		diagnostics: [],
	});
}

export type ViteOriginOptionPlan = Readonly<{
	option: string;
	disposition: ViteOptionDisposition;
	note: string;
}>;

export type ViteOriginPluginPlan = Readonly<{
	package: string;
	target: string | null;
	role: string;
	coverage: string;
}>;

export type ViteOriginConfigPlan = Readonly<{
	options: readonly ViteOriginOptionPlan[];
	plugins: readonly ViteOriginPluginPlan[];
	buildTarget: readonly string[];
	dynamicOptionKeys: number;
}>;

/** Packages an era Vite config imports that are the config machinery itself. */
const viteConfigMachinery: ReadonlySet<string> = new Set(['vite']);

/**
 * The translation plan for one era Vite configuration: what happens to each
 * option it declares and to each plugin it imports.
 *
 * The plan refuses rather than half-translates. An option this capability has
 * no rule for, a plugin it has never been taught, or a key it could not read
 * statically each stop the plan with an error naming the thing and saying what
 * would have gone unmeasured — because the whole hazard of a Vite-to-Vite lift
 * is that the unaccounted-for part still builds.
 */
export function planViteOriginConfig(facts: ViteOriginConfigFacts): ViteOriginConfigPlan {
	if (facts.diagnostics.length > 0)
		throw new Error(
			`Vite origin migration: the era configuration could not be parsed, so nothing about ` +
				`it can be translated and lifting it would carry unread options into the target ` +
				`build. Parser diagnostics: ${facts.diagnostics.join('; ')}`,
		);
	if (facts.dynamicOptionKeys > 0)
		throw new Error(
			`Vite origin migration: the era configuration declares ${facts.dynamicOptionKeys} ` +
				`option key(s) that are computed rather than written literally, so this capability ` +
				`cannot say what they configure. Rewrite them as literal keys or translate the ` +
				`configuration by hand.`,
		);
	const unsupported = facts.optionKeys.filter(
		(key) => !Object.hasOwn(viteOriginOptionRules, key),
	);
	if (unsupported.length > 0)
		throw new Error(
			`Vite origin migration: the era configuration declares the option(s) ` +
				`${unsupported.join(', ')}, which this capability has no translation rule for. ` +
				`Carrying them across unexamined would mean claiming a migrated configuration while ` +
				`their current-Vite reading is unknown. Add a rule for each, or translate the ` +
				`configuration by hand.`,
		);
	const plugins: ViteOriginPluginPlan[] = [];
	for (const specifier of facts.importedPackages) {
		if (viteConfigMachinery.has(specifier)) continue;
		const translation = translateViteOriginPlugin(specifier);
		if (translation === null)
			throw new Error(
				`Vite origin migration: the era configuration imports "${specifier}", which this ` +
					`capability has no translation for. A Vite 2 plugin usually loads without error ` +
					`under a current Vite plugin container it was never written against, so leaving ` +
					`it in place would produce a build nobody has established anything about. Add a ` +
					`translation for it, or remove it from the configuration deliberately.`,
			);
		plugins.push({
			package: specifier,
			target: translation.target,
			role: translation.role,
			coverage: translation.coverage,
		});
	}
	return Object.freeze({
		options: facts.optionKeys.map((option) => {
			const rule = viteOriginOptionRules[option] as ViteOptionRule;
			return { option, disposition: rule.disposition, note: rule.note };
		}),
		plugins,
		buildTarget: viteOriginBuildTarget(),
		dynamicOptionKeys: 0,
	});
}

/** Plan the lift of an era Vite configuration straight from its source. */
export function planViteOriginConfigSource(
	code: string,
	id = 'vite.config.ts',
): ViteOriginConfigPlan {
	return planViteOriginConfig(analyzeViteOriginConfig(code, id));
}

/**
 * The CSS preprocessors a Vite build resolves out of the workspace's own
 * dependency closure, keyed by the file extension that asks for them.
 *
 * Vite never bundled these: both Vite 2 and current Vite require the
 * preprocessor package to be installed beside the application. What changed is
 * the failure: an era workspace that carries `less` keeps working, but a lift
 * that rebuilds the closure against current ranges can quietly lose it, and the
 * first stylesheet import then fails deep inside the CSS pipeline. Resolving it
 * up front turns that into one diagnosable refusal.
 */
export const vitePreprocessorPackages: Readonly<Record<string, string>> = Object.freeze({
	'.less': 'less',
	'.sass': 'sass',
	'.scss': 'sass',
	'.styl': 'stylus',
	'.stylus': 'stylus',
});

export type ViteModuleResolver = (specifier: string) => string;

/** A resolver that searches the application's own dependency closure. */
export function viteApplicationModuleResolver(applicationRoot: string): ViteModuleResolver {
	const applicationRequire = createRequire(
		path.join(path.resolve(applicationRoot), 'package.json'),
	);
	return (specifier) => applicationRequire.resolve(specifier);
}

/**
 * Resolve the preprocessor one stylesheet extension needs, or fail naming the
 * extension, the package, and where it was searched.
 */
export function resolveVitePreprocessor(
	extension: string,
	resolver: ViteModuleResolver,
	origin: string,
): string {
	const specifier = vitePreprocessorPackages[extension];
	if (specifier === undefined)
		throw new Error(`Vite origin migration: "${extension}" needs no CSS preprocessor package`);
	try {
		return resolver(specifier);
	} catch {
		throw new Error(
			`Vite origin migration: this build imports "${extension}" stylesheets, which Vite ` +
				`compiles with the "${specifier}" package resolved from the application's own ` +
				`dependency closure. It is absent from that closure at ${origin}, so every ` +
				`"${extension}" import would fail inside the CSS pipeline. Install it into that ` +
				`closure or drop the stylesheets.`,
		);
	}
}

/**
 * Vite client APIs that existed on the Vite 2 line and have been removed since,
 * with the current spelling of the same request.
 *
 * `import.meta.globEager(p)` was the eager form of the glob import. It was
 * deprecated on the Vite 4 line and removed on the Vite 5 line, so a Vite 2
 * source that calls it does not fail to compile after a lift — it compiles into
 * a call to a member of `import.meta` that no longer exists, and throws at
 * runtime, in the browser, on the first evaluation of whichever module used it.
 * That is the worst possible failure mode for a migration: green build, dead
 * page. Rewriting the call at build time is the only way the build itself can
 * surface it.
 */
export const removedViteClientApis: Readonly<Record<string, string>> = Object.freeze({
	globEager: 'import.meta.glob(..., { eager: true })',
});

export type ViteClientApiRewrite = Readonly<{
	/** Byte offset of the start of the rewritten range. */
	start: number;
	end: number;
	replacement: string;
	api: string;
}>;

export type ViteClientApiScan = Readonly<{
	rewrites: readonly ViteClientApiRewrite[];
	diagnostics: readonly string[];
}>;

function isImportMetaGlobEager(callee: EstreeNode): boolean {
	if (nodeType(callee) !== 'MemberExpression') return false;
	if (callee['computed'] === true) return false;
	const property = callee['property'];
	const name =
		typeof property === 'object' && property !== null ? (property as EstreeNode)['name'] : null;
	if (name !== 'globEager') return false;
	const object = callee['object'];
	return nodeType(object) === 'MetaProperty';
}

function span(node: EstreeNode): Readonly<{ start: number; end: number }> | null {
	const start = node['start'];
	const end = node['end'];
	if (typeof start === 'number' && typeof end === 'number') return { start, end };
	const range = node['range'];
	if (Array.isArray(range) && typeof range[0] === 'number' && typeof range[1] === 'number')
		return { start: range[0], end: range[1] };
	return null;
}

/**
 * Find every removed Vite client API call in a module and the edit that
 * restores it, or report why an occurrence cannot be rewritten.
 *
 * The scan rides a parse, so a `globEager` that is a property name, a string, or
 * a method on something other than `import.meta` is never touched. An occurrence
 * whose arguments this capability cannot reproduce faithfully is reported as a
 * diagnostic rather than rewritten approximately.
 */
export function scanRemovedViteClientApis(code: string, id = 'module.ts'): ViteClientApiScan {
	// The language and module kind come from the analyzer's own resolution of the
	// file name. Guessing them here is how a `.tsx` module gets parsed as plain
	// JavaScript and its first type assertion is reported as a syntax error — a
	// refusal that names the wrong problem, which is worse than no refusal.
	const module = analyze(code, {
		path: id,
		lang: langFromPath(id),
		sourceType: sourceTypeFromPath(id),
	});
	const errors = module.diagnostics.filter((entry) => entry.severity === 'error');
	if (errors.length > 0)
		return Object.freeze({ rewrites: [], diagnostics: errors.map((entry) => entry.message) });
	const rewrites: ViteClientApiRewrite[] = [];
	const diagnostics: string[] = [];
	module.walk({
		CallExpression(node) {
			const call = node as unknown as EstreeNode;
			const callee = call['callee'];
			if (typeof callee !== 'object' || callee === null) return;
			if (!isImportMetaGlobEager(callee as EstreeNode)) return;
			const args = call['arguments'];
			const calleeSpan = span(callee as EstreeNode);
			const callSpan = span(call);
			if (
				!Array.isArray(args) ||
				args.length !== 1 ||
				calleeSpan === null ||
				callSpan === null
			) {
				diagnostics.push(
					`import.meta.globEager at offset ${callSpan?.start ?? -1} does not have the single-argument shape this capability rewrites`,
				);
				return;
			}
			const argument = args[0] as EstreeNode;
			const argumentSpan = span(argument);
			if (argumentSpan === null) {
				diagnostics.push('import.meta.globEager argument has no readable span');
				return;
			}
			rewrites.push({
				start: calleeSpan.start,
				end: callSpan.end,
				replacement: `import.meta.glob(${code.slice(argumentSpan.start, argumentSpan.end)}, { eager: true })`,
				api: 'globEager',
			});
		},
	});
	return Object.freeze({ rewrites, diagnostics });
}

/**
 * The module source with every removed Vite client API call rewritten to its
 * current spelling. A module that calls none is returned byte-identical.
 */
export function rewriteRemovedViteClientApis(code: string, id = 'module.ts'): string {
	const scan = scanRemovedViteClientApis(code, id);
	if (scan.diagnostics.length > 0)
		throw new Error(
			`Vite origin migration: ${id} calls a removed Vite client API in a shape this ` +
				`capability cannot rewrite faithfully. Left alone the call would survive the build ` +
				`and throw in the browser, so it is refused rather than approximated. ` +
				`Diagnostics: ${scan.diagnostics.join('; ')}`,
		);
	if (scan.rewrites.length === 0) return code;
	const ordered = [...scan.rewrites].sort((left, right) => right.start - left.start);
	let output = code;
	for (const rewrite of ordered)
		output = `${output.slice(0, rewrite.start)}${rewrite.replacement}${output.slice(rewrite.end)}`;
	return output;
}

export type ViteOriginTransformResult = Readonly<{ code: string; map: null }>;
export type ViteOriginTransformPlugin = Readonly<{
	name: string;
	enforce: 'pre';
	transform(code: string, id: string): ViteOriginTransformResult | null;
}>;

const rewritableModuleExtensions: ReadonlySet<string> = new Set([
	'.js',
	'.jsx',
	'.mjs',
	'.ts',
	'.tsx',
]);

const dependencyDirectorySegment = 'node_modules';

function pathWithoutQuery(id: string): string {
	const index = id.indexOf('?');
	return index === -1 ? id : id.slice(0, index);
}

export type ViteClientApiRecord = Readonly<{ id: string; apis: readonly string[] }>;

export type ViteClientApiOptions = Readonly<{
	observe?: (record: ViteClientApiRecord) => void;
}>;

/**
 * Restore the removed Vite client APIs an era source still calls.
 *
 * The scope is the application's own source: `node_modules` is excluded because
 * a dependency published against Vite 2 is a frozen artifact whose own build
 * output is not this migration's to edit, and because the era client API is a
 * source-level convention rather than something a published package normally
 * ships. A module that calls nothing removed is returned untouched, so a
 * workspace that never used the API emits byte-identical output.
 */
export function createViteOriginClientApiPlugin(
	options: ViteClientApiOptions = {},
): ViteOriginTransformPlugin {
	return {
		name: 'versionless-vite-origin-client-api',
		enforce: 'pre',
		transform(code, id) {
			const file = pathWithoutQuery(id);
			if (file.startsWith('\0')) return null;
			if (path.normalize(file).split('/').includes(dependencyDirectorySegment)) return null;
			if (!rewritableModuleExtensions.has(path.extname(file))) return null;
			const scan = scanRemovedViteClientApis(code, file);
			if (scan.diagnostics.length === 0 && scan.rewrites.length === 0) return null;
			const rewritten = rewriteRemovedViteClientApis(code, file);
			options.observe?.({
				id: file,
				apis: [...new Set(scan.rewrites.map((rewrite) => rewrite.api))].sort(
					compareUtf16CodeUnits,
				),
			});
			return { code: rewritten, map: null };
		},
	};
}

export type ViteOriginBuildConfig = Readonly<{ build: Readonly<{ target: readonly string[] }> }>;
export type ViteOriginBuildTargetPlugin = Readonly<{
	name: string;
	config(): ViteOriginBuildConfig;
}>;

/**
 * Contribute the era build target through the plugin's own configuration, so a
 * build that adopts this adapter cannot forget to state it and silently inherit
 * a newer syntax floor. A configuration that names its own `build.target`
 * overrides this, which is the correct precedence: an explicit decision beats an
 * inherited era default.
 */
export function createViteOriginBuildTargetPlugin(): ViteOriginBuildTargetPlugin {
	return {
		name: 'versionless-vite-origin-build-target',
		config() {
			return { build: { target: viteOriginBuildTarget() } };
		},
	};
}

export type ViteOriginAdapterOptions = Readonly<{
	observeClientApis?: (record: ViteClientApiRecord) => void;
}>;

export type ViteOriginAdapterPlugins = readonly [
	ViteOriginTransformPlugin,
	ViteOriginBuildTargetPlugin,
];

/**
 * The Vite-origin compatibility plugin set: removed client API restoration plus
 * the era build target.
 *
 * The configuration translation is deliberately *not* a plugin. A plugin runs
 * inside a build that has already been configured, which is far too late to
 * refuse an option nobody has a reading for — by then the build is underway and
 * the refusal would arrive as a crash rather than as a decision. The plan is
 * computed before the build instead, so the honest outcome of an untranslatable
 * configuration is that no build is attempted at all.
 */
export function createViteOriginAdapter(
	options: ViteOriginAdapterOptions = {},
): ViteOriginAdapterPlugins {
	return [
		createViteOriginClientApiPlugin(
			options.observeClientApis === undefined ? {} : { observe: options.observeClientApis },
		),
		createViteOriginBuildTargetPlugin(),
	];
}
