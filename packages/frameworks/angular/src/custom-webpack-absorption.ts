/**
 * Absorption of third-party *wrapper* builders back into the official one.
 *
 * An era Angular workspace often does not run `@angular-devkit/build-angular`
 * directly. It runs a wrapper — `@angular-builders/custom-webpack:browser` is
 * the common one — whose whole job is to merge a user-supplied webpack fragment
 * into the configuration the official builder would have produced. The wrapper
 * package pins a peer range on the devkit major it wrapped, so it cannot cross a
 * framework hop, and the target it configures cannot simply be deleted: it is
 * the application's build.
 *
 * What this module decides is narrow and mechanical: *is every capability the
 * webpack fragment adds already provided natively by the official builder on the
 * target line?* When the answer is yes the wrapper is absorbed — the target goes
 * back to the official builder, the fragment stops being referenced, and the
 * wrapper package is released. When the answer is no, or when the fragment
 * cannot be read statically, nothing is absorbed and the reason is reported.
 * Guessing would silently drop a build step.
 *
 * Nothing here knows an application. The tables describe two things only: which
 * wrapper builder identities map onto which official ones, and what the official
 * builder's own style pipeline already does on a given target line.
 */

import { analyze } from 'yuku-analyzer';
import { compareStrings } from './angular-target-cell.ts';

/**
 * Wrapper builder identities and the official builder each one wraps.
 *
 * The mapping is the wrapper's own documented contract: every
 * `@angular-builders/custom-webpack:<target>` builder runs the devkit builder of
 * the same name and merges a webpack fragment into it. Only the identities that
 * still exist on a modern devkit line are listed; a wrapper around a builder the
 * devkit itself dropped is not absorbable, because there is nothing left to
 * absorb it into.
 */
export const WRAPPER_BUILDER_REPLACEMENTS: Readonly<Record<string, string>> = Object.freeze({
	'@angular-builders/custom-webpack:browser': '@angular-devkit/build-angular:browser',
	'@angular-builders/custom-webpack:dev-server': '@angular-devkit/build-angular:dev-server',
	'@angular-builders/custom-webpack:extract-i18n': '@angular-devkit/build-angular:extract-i18n',
	'@angular-builders/custom-webpack:karma': '@angular-devkit/build-angular:karma',
	'@angular-builders/custom-webpack:server': '@angular-devkit/build-angular:server',
});

/**
 * Builder options that exist only to feed the wrapper. They are meaningless to
 * the official builder and its schema rejects unknown options outright, so they
 * are removed with the wrapper rather than carried.
 */
export const WRAPPER_ONLY_OPTIONS: readonly string[] = Object.freeze([
	'customWebpackConfig',
	'indexTransform',
]);

/** The npm package that publishes a builder, read off the builder identity. */
export function builderPackageOf(builder: string): string | null {
	const separator = builder.lastIndexOf(':');
	if (separator <= 0) return null;
	const name = builder.slice(0, separator);
	return name.length === 0 ? null : name;
}

/**
 * One thing a webpack fragment does, as read out of the fragment itself.
 *
 * `kind` is what the fragment declares; `provided` is whether the official
 * builder on the target line already does it. A capability is never assumed to
 * be provided: the absence of an entry in the native table means not provided.
 */
export type WebpackCapability = Readonly<{
	kind: string;
	detail: string;
	provided: boolean;
	why: string;
}>;

export type WebpackFragmentAnalysis = Readonly<{
	path: string;
	/** Every capability the fragment declares, in source order. */
	capabilities: readonly WebpackCapability[];
	/** True only when the fragment was fully read and every capability is native. */
	absorbable: boolean;
	/** Why absorption was refused, empty when it was not. */
	blockers: readonly string[];
}>;

/**
 * What an official builder's own style pipeline already does, per builder
 * identity.
 *
 * Each entry is a statement about the builder, with the reason it is true. The
 * reasons matter more than the list: they are what a reader checks when deciding
 * whether an absorption was honest.
 */
type NativeStylePipeline = Readonly<{
	postcssPlugins: Readonly<Record<string, string>>;
	postcssSyntaxes: Readonly<Record<string, string>>;
}>;

export const NATIVE_STYLE_PIPELINES: Readonly<Record<string, NativeStylePipeline>> = Object.freeze({
	'@angular-devkit/build-angular:browser': Object.freeze({
		postcssPlugins: Object.freeze({
			tailwindcss:
				'the browser builder searches the workspace root for a Tailwind configuration file and, when it finds one, adds the tailwindcss plugin to its own postcss chain — the capability the fragment was written to add before the builder had it',
			autoprefixer:
				'the browser builder always runs autoprefixer over its postcss output, driven by the project browserslist; it is not optional and cannot be switched off',
			'postcss-import':
				'`@import` resolution is performed before postcss sees the file: sass resolves it in a `.scss` source and css-loader resolves it in a `.css` source, so the plugin has nothing left to do on either path',
		}),
		postcssSyntaxes: Object.freeze({
			'postcss-scss':
				'the builder runs postcss after sass rather than over the sass source, so the CSS it parses is ordinary CSS and no scss-aware parser is needed',
		}),
	}),
});

type JsonLike = string | number | boolean | null | readonly JsonLike[] | { [key: string]: JsonLike };

type Node = Readonly<Record<string, unknown>>;

function node(value: unknown): Node | null {
	return typeof value === 'object' && value !== null ? (value as Node) : null;
}

function nodeType(value: unknown): string | null {
	const candidate = node(value);
	const type = candidate?.['type'];
	return typeof type === 'string' ? type : null;
}

function propertyKey(property: Node): string | null {
	const key = node(property['key']);
	if (key === null) return null;
	if (property['computed'] === true) return null;
	const name = key['name'];
	if (typeof name === 'string') return name;
	const value = key['value'];
	return typeof value === 'string' ? value : null;
}

/**
 * Statically evaluate a literal expression, or return `undefined` when it is not
 * one. `undefined` is the whole point: a fragment that computes any part of
 * itself cannot be read without running it, and running an application's build
 * configuration to decide whether to delete it is not something this capability
 * will do.
 */
export function staticValueOf(expression: unknown): JsonLike | undefined {
	const type = nodeType(expression);
	const candidate = node(expression);
	if (candidate === null || type === null) return undefined;
	if (type === 'Literal') {
		/**
		 * A regular-expression literal is read as its own source text. Webpack uses
		 * one only to say which files a rule applies to; the absorption decision is
		 * about what the rule *does*, so the pattern is recorded rather than
		 * interpreted, and an unreadable pattern never silently becomes `undefined`.
		 */
		const regex = node(candidate['regex']);
		if (regex !== null) {
			const raw = candidate['raw'];
			if (typeof raw === 'string') return raw;
			const pattern = regex['pattern'];
			const flags = regex['flags'];
			return typeof pattern === 'string' && typeof flags === 'string'
				? `/${pattern}/${flags}`
				: undefined;
		}
		const value = candidate['value'];
		if (
			typeof value === 'string' ||
			typeof value === 'number' ||
			typeof value === 'boolean' ||
			value === null
		)
			return value;
		return undefined;
	}
	if (type === 'TemplateLiteral') {
		const expressions = candidate['expressions'];
		const quasis = candidate['quasis'];
		if (!Array.isArray(expressions) || expressions.length > 0 || !Array.isArray(quasis))
			return undefined;
		const [only] = quasis as readonly unknown[];
		const cooked = node(node(only)?.['value'])?.['cooked'];
		return typeof cooked === 'string' ? cooked : undefined;
	}
	if (type === 'ArrayExpression') {
		const elements = candidate['elements'];
		if (!Array.isArray(elements)) return undefined;
		const values: JsonLike[] = [];
		for (const element of elements as readonly unknown[]) {
			const value = staticValueOf(element);
			if (value === undefined) return undefined;
			values.push(value);
		}
		return values;
	}
	if (type === 'ObjectExpression') {
		const properties = candidate['properties'];
		if (!Array.isArray(properties)) return undefined;
		const object: Record<string, JsonLike> = {};
		for (const entry of properties as readonly unknown[]) {
			const property = node(entry);
			if (property === null || nodeType(property) !== 'Property') return undefined;
			const key = propertyKey(property);
			if (key === null) return undefined;
			const value = staticValueOf(property['value']);
			if (value === undefined) return undefined;
			object[key] = value;
		}
		return object;
	}
	return undefined;
}

function isPlainObject(value: JsonLike | undefined): value is { [key: string]: JsonLike } {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The exported value of a CommonJS or ES module fragment, as an expression node.
 * Both spellings are accepted because the Angular CLI loads either.
 */
function exportedExpression(body: readonly unknown[]): unknown {
	for (const statement of body) {
		const type = nodeType(statement);
		const candidate = node(statement);
		if (candidate === null) continue;
		if (type === 'ExportDefaultDeclaration') return candidate['declaration'];
		if (type !== 'ExpressionStatement') continue;
		const expression = node(candidate['expression']);
		if (expression === null || nodeType(expression) !== 'AssignmentExpression') continue;
		const left = node(expression['left']);
		if (left === null || nodeType(left) !== 'MemberExpression') continue;
		const object = node(left['object']);
		const property = node(left['property']);
		if (object?.['name'] !== 'module' || property?.['name'] !== 'exports') continue;
		return expression['right'];
	}
	return undefined;
}

/** The loader package a webpack rule entry names, in either spelling. */
function ruleLoaders(rule: { [key: string]: JsonLike }): readonly string[] | null {
	const single = rule['loader'];
	if (typeof single === 'string') return [single];
	const use = rule['use'];
	if (typeof use === 'string') return [use];
	if (Array.isArray(use)) {
		const names: string[] = [];
		for (const entry of use) {
			if (typeof entry === 'string') names.push(entry);
			else if (isPlainObject(entry) && typeof entry['loader'] === 'string')
				names.push(entry['loader']);
			else return null;
		}
		return names;
	}
	return null;
}

const RULE_SHAPE_KEYS: readonly string[] = Object.freeze(['test', 'include', 'exclude']);

function classifyPostcssRule(
	rule: { [key: string]: JsonLike },
	pipeline: NativeStylePipeline,
): WebpackCapability[] {
	const options = rule['options'];
	const postcssOptions = isPlainObject(options) ? options['postcssOptions'] : undefined;
	if (!isPlainObject(postcssOptions))
		return [
			{
				kind: 'postcss-loader',
				detail: 'postcss-loader rule whose options this capability could not read',
				provided: false,
				why: 'the rule carries no statically readable `postcssOptions`, so what it adds is unknown',
			},
		];
	const capabilities: WebpackCapability[] = [];
	for (const [key, value] of Object.entries(postcssOptions)) {
		if (key === 'ident') {
			capabilities.push({
				kind: 'postcss-ident',
				detail: `ident: ${JSON.stringify(value)}`,
				provided: true,
				why: 'an ident is a webpack-internal cache key for the loader instance and configures nothing about the output',
			});
			continue;
		}
		if (key === 'syntax' && typeof value === 'string') {
			const why = pipeline.postcssSyntaxes[value];
			capabilities.push({
				kind: 'postcss-syntax',
				detail: value,
				provided: why !== undefined,
				why: why ?? `the target builder does not state that it handles the ${value} syntax natively`,
			});
			continue;
		}
		if (key === 'plugins' && Array.isArray(value)) {
			for (const plugin of value) {
				const name =
					typeof plugin === 'string'
						? plugin
						: Array.isArray(plugin) && typeof plugin[0] === 'string'
							? plugin[0]
							: null;
				if (name === null) {
					capabilities.push({
						kind: 'postcss-plugin',
						detail: JSON.stringify(plugin),
						provided: false,
						why: 'the plugin entry is not a package name this capability can recognise',
					});
					continue;
				}
				const why = pipeline.postcssPlugins[name];
				capabilities.push({
					kind: 'postcss-plugin',
					detail: name,
					provided: why !== undefined,
					why: why ?? `the target builder does not run ${name} natively`,
				});
			}
			continue;
		}
		capabilities.push({
			kind: 'postcss-option',
			detail: key,
			provided: false,
			why: `postcssOptions.${key} is not an option this capability knows the target builder to provide`,
		});
	}
	return capabilities;
}

/**
 * Read a custom webpack fragment and say, capability by capability, whether the
 * official builder on the target line already does the same thing.
 *
 * Everything the fragment declares is classified. A key this capability does not
 * recognise is a blocker, never a shrug: the fragment is the application's build
 * configuration, and an unread key is a build step that would vanish.
 */
export function analyzeCustomWebpackFragment(
	path: string,
	source: string,
	officialBuilder: string,
): WebpackFragmentAnalysis {
	const blockers: string[] = [];
	const pipeline = NATIVE_STYLE_PIPELINES[officialBuilder];
	if (pipeline === undefined)
		return Object.freeze({
			path,
			capabilities: Object.freeze([]),
			absorbable: false,
			blockers: Object.freeze([
				`no native pipeline is recorded for ${officialBuilder}, so nothing can be judged already provided`,
			]),
		});
	const analyzed = analyze(source, { path, lang: path.endsWith('.ts') ? 'ts' : 'js' });
	const errors = analyzed.diagnostics.filter((entry) => entry.severity === 'error');
	if (errors.length > 0)
		return Object.freeze({
			path,
			capabilities: Object.freeze([]),
			absorbable: false,
			blockers: Object.freeze([
				`${path} does not parse: ${errors.map((entry) => entry.message).join('; ')}`,
			]),
		});
	const exported = exportedExpression(analyzed.ast.body as readonly unknown[]);
	if (exported === undefined)
		return Object.freeze({
			path,
			capabilities: Object.freeze([]),
			absorbable: false,
			blockers: Object.freeze([
				`${path} does not export a single object literal this capability can read`,
			]),
		});
	const value = staticValueOf(exported);
	if (!isPlainObject(value))
		return Object.freeze({
			path,
			capabilities: Object.freeze([]),
			absorbable: false,
			blockers: Object.freeze([
				`${path} exports something other than a statically readable object — a function or a computed value cannot be read without running it, and this capability does not run build configuration`,
			]),
		});
	const capabilities: WebpackCapability[] = [];
	for (const [key, entry] of Object.entries(value)) {
		if (key !== 'module') {
			capabilities.push({
				kind: 'webpack-option',
				detail: key,
				provided: false,
				why: `the fragment configures webpack's \`${key}\`, which this capability cannot judge against the official builder`,
			});
			continue;
		}
		if (!isPlainObject(entry)) {
			capabilities.push({
				kind: 'webpack-option',
				detail: 'module',
				provided: false,
				why: 'the fragment’s `module` is not a readable object',
			});
			continue;
		}
		for (const [moduleKey, moduleValue] of Object.entries(entry)) {
			if (moduleKey !== 'rules' || !Array.isArray(moduleValue)) {
				capabilities.push({
					kind: 'webpack-option',
					detail: `module.${moduleKey}`,
					provided: false,
					why: `the fragment configures \`module.${moduleKey}\`, which this capability cannot judge against the official builder`,
				});
				continue;
			}
			for (const ruleValue of moduleValue) {
				if (!isPlainObject(ruleValue)) {
					capabilities.push({
						kind: 'webpack-rule',
						detail: JSON.stringify(ruleValue),
						provided: false,
						why: 'the rule is not a readable object',
					});
					continue;
				}
				const loaders = ruleLoaders(ruleValue);
				if (loaders === null || loaders.length !== 1 || loaders[0] !== 'postcss-loader') {
					capabilities.push({
						kind: 'webpack-rule',
						detail: loaders === null ? 'unreadable loader' : loaders.join(' + '),
						provided: false,
						why: 'only a rule that is exactly one postcss-loader can be judged against the builder’s own style pipeline',
					});
					continue;
				}
				const unknownKeys = Object.keys(ruleValue).filter(
					(name) => ![...RULE_SHAPE_KEYS, 'loader', 'use', 'options'].includes(name),
				);
				for (const name of unknownKeys)
					capabilities.push({
						kind: 'webpack-rule-option',
						detail: name,
						provided: false,
						why: `the rule sets \`${name}\`, which this capability cannot judge`,
					});
				const scope = ruleValue['test'];
					capabilities.push({
						kind: 'webpack-rule-scope',
						detail: typeof scope === 'string' ? scope : JSON.stringify(scope ?? null),
						provided: true,
						why: 'the scope only says which files the rule applied to; the builder’s own style pipeline covers every style file it compiles, so a narrower scope cannot add a capability',
					});
					capabilities.push(...classifyPostcssRule(ruleValue, pipeline));
			}
		}
	}
	if (capabilities.length === 0)
		blockers.push(
			`${path} declares nothing this capability recognised; absorbing it would be a guess that it does nothing`,
		);
	for (const capability of capabilities)
		if (!capability.provided)
			blockers.push(`${capability.kind} ${capability.detail}: ${capability.why}`);
	return Object.freeze({
		path,
		capabilities: Object.freeze(capabilities),
		absorbable: blockers.length === 0,
		blockers: Object.freeze([...new Set(blockers)].sort(compareStrings)),
	});
}
