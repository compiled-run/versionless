/**
 * The Sentry JavaScript SDK v8 migration for an Angular application's tracing
 * setup.
 *
 * Version 8 of the SDK folded the separate `@sentry/tracing` package into the
 * framework SDKs and replaced the integration classes with factory functions.
 * Three shapes an Angular workspace written against version 6 or 7 carries stop
 * resolving, and each one is defined by the SDK rather than by any application:
 *
 * - `@sentry/tracing` no longer exists as a package, so the `Integrations`
 *   object (and the `BrowserTracing` class it carried) cannot be imported at
 *   all. `@sentry/angular` 8 exports its own Angular-flavoured
 *   `browserTracingIntegration`, and that factory is the successor.
 * - `routingInstrumentation` was removed from the SDK. The Angular browser
 *   tracing integration performs the routing instrumentation itself, so the
 *   option the era code passed has no counterpart and no replacement value: it
 *   is folded into the factory call by disappearing from it.
 * - `tracingOrigins` was removed from the integration and has no counterpart
 *   there either. Its successor, `tracePropagationTargets`, is a top-level
 *   `Sentry.init` option, so the value has to move up one level rather than be
 *   dropped — dropping it would silently stop propagating trace headers to the
 *   very origins the application named.
 *
 * ```ts
 * import * as Sentry from '@sentry/angular';
 * import { Integrations } from '@sentry/tracing';
 *
 * Sentry.init({                              Sentry.init({
 *   integrations: [                            integrations: [
 *     new Integrations.BrowserTracing({          Sentry.browserTracingIntegration()
 *       tracingOrigins: ORIGINS,        ->     ],
 *       routingInstrumentation:                tracesSampleRate: 1.0,
 *         Sentry.routingInstrumentation        tracePropagationTargets: ORIGINS
 *     })                                     });
 *   ],
 *   tracesSampleRate: 1.0
 * });
 * ```
 *
 * Everything rides the parsed module's resolved bindings. The construction is
 * found by following the local binding `@sentry/tracing` exported, so an
 * `Integrations` imported from anywhere else is untouched and an aliased import
 * is still rewritten; the `init` call the option relocates into, and the
 * `routingInstrumentation` value that is dropped, both have to resolve to the
 * same Sentry SDK module the factory is being taken from.
 *
 * A construction this capability cannot fully account for is left exactly as it
 * is and reported — never half-edited. That is the whole point of the
 * relocation refusals: a `tracingOrigins` this capability cannot place is a
 * `tracingOrigins` it must not remove, because the resulting file would compile
 * and quietly trace nothing.
 */

import { analyze } from 'yuku-analyzer';
import { compareStrings } from './angular-target-cell.ts';

/** The SDK the successor factory is taken from. */
export const SENTRY_ANGULAR_MODULE = '@sentry/angular';

/** The package v8 folded into the SDKs; it has no successor of its own. */
export const REMOVED_SENTRY_TRACING_MODULE = '@sentry/tracing';

/** The removed integration container, and the removed class it carried. */
export const REMOVED_INTEGRATIONS_OBJECT = 'Integrations';
export const REMOVED_BROWSER_TRACING_CLASS = 'BrowserTracing';

/** The v8 factory that replaced the class. */
export const BROWSER_TRACING_FACTORY = 'browserTracingIntegration';

/** The SDK entry point the relocated option belongs to. */
export const SENTRY_INIT = 'init';

/** The removed routing hook the v8 integration performs for itself. */
export const REMOVED_ROUTING_INSTRUMENTATION = 'routingInstrumentation';

/** The removed integration option, and the init option it moves to. */
export const REMOVED_TRACING_ORIGINS_OPTION = 'tracingOrigins';
export const TRACE_PROPAGATION_TARGETS_OPTION = 'tracePropagationTargets';

export type SentryV8Change = Readonly<{
	kind: 'sentry-browser-tracing-integration' | 'sentry-trace-propagation-targets';
	line: number;
	from: string;
	to: string;
}>;

export type SentryV8Migration = Readonly<{
	path: string;
	source: string;
	changed: boolean;
	changes: readonly SentryV8Change[];
	unhandled: readonly string[];
}>;

type SemanticModule = ReturnType<typeof analyze>;
type AstNode = NonNullable<ReturnType<SemanticModule['parentOf']>>;
type ImportRecord = SemanticModule['imports'][number];
type BindingSymbol = NonNullable<ImportRecord['local']>;

type Edit = Readonly<{ start: number; end: number; text: string }>;

function lineOf(source: string, offset: number): number {
	return source.slice(0, offset).split('\n').length;
}

/** The leading whitespace of the line `offset` sits on. */
function indentAt(source: string, offset: number): string {
	const lineStart = source.lastIndexOf('\n', offset - 1) + 1;
	let cursor = lineStart;
	while (cursor < offset) {
		const character = source[cursor];
		if (character !== ' ' && character !== '\t') break;
		cursor += 1;
	}
	return source.slice(lineStart, cursor);
}

/** Apply non-overlapping edits to a string, rightmost first. */
function applyEdits(text: string, edits: readonly Edit[]): string {
	let result = text;
	for (const edit of [...edits].sort((left, right) => right.start - left.start))
		result = `${result.slice(0, edit.start)}${edit.text}${result.slice(edit.end)}`;
	return result;
}

/**
 * One module's import surface for a single package: the namespace binding if it
 * has one, the named bindings by exported name, and the declarations they came
 * from. A default binding is recorded only as `wide`, because a member reached
 * through one cannot be resolved by name.
 */
type ModuleImports = Readonly<{
	present: boolean;
	namespace: BindingSymbol | null;
	named: ReadonlyMap<string, BindingSymbol>;
	declarations: readonly AstNode[];
	wide: boolean;
}>;

function readModuleImports(module: SemanticModule, specifier: string): ModuleImports {
	const named = new Map<string, BindingSymbol>();
	const declarations: AstNode[] = [];
	let namespace: BindingSymbol | null = null;
	let present = false;
	let wide = false;
	for (const record of module.imports) {
		if (record.specifier !== specifier) continue;
		present = true;
		const declaration = importDeclarationOf(module, record.node);
		if (declaration !== null && !declarations.includes(declaration))
			declarations.push(declaration);
		const local = record.local;
		if (local === null) continue;
		if (record.isNamespace) {
			namespace ??= local;
			wide = true;
			continue;
		}
		if (record.name === null || record.name === 'default') {
			wide = true;
			continue;
		}
		if (!named.has(record.name)) named.set(record.name, local);
	}
	return Object.freeze({
		present,
		namespace,
		named,
		declarations: Object.freeze(declarations),
		wide,
	});
}

function importDeclarationOf(module: SemanticModule, node: AstNode): AstNode | null {
	let current: AstNode | null = node;
	while (current !== null) {
		if (current.type === 'ImportDeclaration') return current;
		current = module.parentOf(current);
	}
	return null;
}

function namedSpecifiersOf(declaration: AstNode): readonly AstNode[] {
	if (declaration.type !== 'ImportDeclaration') return [];
	return declaration.specifiers.filter((specifier) => specifier.type === 'ImportSpecifier');
}

function hasWideSpecifier(declaration: AstNode): boolean {
	if (declaration.type !== 'ImportDeclaration') return false;
	return declaration.specifiers.some((specifier) => specifier.type !== 'ImportSpecifier');
}

/**
 * Whether `node` denotes `exportName` of the Sentry SDK: either the local of a
 * named import of it, or a static member of the SDK's namespace binding. Any
 * other expression — a member of some other object, a computed access, a
 * locally defined function of the same name — is not, and the caller refuses
 * rather than guesses.
 */
function isSdkExport(
	module: SemanticModule,
	node: AstNode,
	sdk: ModuleImports,
	exportName: string,
): boolean {
	if (node.type === 'Identifier') {
		const expected = sdk.named.get(exportName);
		return expected !== undefined && module.symbolOf(node) === expected;
	}
	if (node.type !== 'MemberExpression' || node.computed || node.optional) return false;
	const { object, property } = node;
	if (property.type !== 'Identifier' || property.name !== exportName) return false;
	if (object.type !== 'Identifier' || sdk.namespace === null) return false;
	return module.symbolOf(object) === sdk.namespace;
}

type PlainProperty = Readonly<{ node: AstNode; name: string; value: AstNode }>;

/**
 * The properties of an object literal, when every one of them is a plain,
 * statically named, non-computed data property. A literal carrying a spread, a
 * computed key, a method, or an accessor returns null: this capability decides
 * both what an options literal contains and what it does not contain, and
 * neither question can be answered over a shape like that.
 */
function plainProperties(object: AstNode): readonly PlainProperty[] | null {
	if (object.type !== 'ObjectExpression') return null;
	const properties: PlainProperty[] = [];
	for (const property of object.properties) {
		if (property.type !== 'Property') return null;
		if (property.kind !== 'init' || property.computed || property.method) return null;
		const key = property.key;
		const name =
			key.type === 'Identifier'
				? key.name
				: key.type === 'Literal' && typeof key.value === 'string'
					? key.value
					: null;
		if (name === null) return null;
		properties.push(Object.freeze({ node: property, name, value: property.value }));
	}
	return Object.freeze(properties);
}

/**
 * The options literal of the `Sentry.init` call that structurally encloses
 * `node`, or null when there is none the relocation can be trusted to. The walk
 * stops at the first enclosing init call: a construction nested inside one but
 * not inside its options literal is not a relocation target, it is a refusal.
 */
function enclosingInitOptions(
	module: SemanticModule,
	node: AstNode,
	sdk: ModuleImports,
): AstNode | null {
	let child = node;
	let parent = module.parentOf(child);
	while (parent !== null) {
		if (
			parent.type === 'CallExpression' &&
			isSdkExport(module, parent.callee, sdk, SENTRY_INIT)
		) {
			const first = parent.arguments[0];
			return first === child && child.type === 'ObjectExpression' ? child : null;
		}
		child = parent;
		parent = module.parentOf(child);
	}
	return null;
}

type Relocation = Readonly<{ target: AstNode; value: string; line: number }>;

type Construction = Readonly<{
	start: number;
	end: number;
	binding: BindingSymbol;
	calleeText: string;
	optionsText: string;
	relocation: Relocation | null;
	consumedRouting: boolean;
}>;

/**
 * Rewrite the options literal of a removed `BrowserTracing` construction into
 * the argument its v8 factory takes: the two removed options are cut out and
 * everything else is carried through as it was written. When nothing survives,
 * the factory is called with no argument at all, which is what an integration
 * with no configuration is in v8.
 */
function rewriteOptions(
	source: string,
	object: AstNode,
	properties: readonly PlainProperty[],
	removed: ReadonlySet<PlainProperty>,
): string {
	if (properties.every((property) => removed.has(property))) return '';
	/**
	 * Deletions are taken over maximal runs of adjacent removed properties, not
	 * one property at a time. Two neighbours cut separately would each claim the
	 * separator between them and the edits would overlap; a run claims it once.
	 */
	const deletions: Edit[] = [];
	let index = 0;
	while (index < properties.length) {
		const first = properties[index];
		if (first === undefined || !removed.has(first)) {
			index += 1;
			continue;
		}
		let lastIndex = index;
		for (;;) {
			const candidate = properties[lastIndex + 1];
			if (candidate === undefined || !removed.has(candidate)) break;
			lastIndex += 1;
		}
		const last = properties[lastIndex] ?? first;
		const following = properties[lastIndex + 1];
		const previous = properties[index - 1];
		if (following !== undefined)
			deletions.push({ start: first.node.start, end: following.node.start, text: '' });
		else if (previous !== undefined) {
			let end = last.node.end;
			while (source[end] === ' ' || source[end] === '\t') end += 1;
			if (source[end] === ',') end += 1;
			deletions.push({ start: previous.node.end, end, text: '' });
		}
		index = lastIndex + 1;
	}
	const rebased = deletions.map((edit) => ({
		start: edit.start - object.start,
		end: edit.end - object.start,
		text: edit.text,
	}));
	return applyEdits(source.slice(object.start, object.end), rebased);
}

/**
 * Migrate one module's Sentry tracing setup onto the v8 SDK.
 *
 * A module that never imports `@sentry/tracing` is returned byte-identical. A
 * module that does not parse is a hard failure naming the file, never a silent
 * skip: a skipped file would be counted as unchanged, and the whole value of a
 * changeset is that an unchanged file really was unchanged.
 */
export function migrateSentryV8Tracing(path: string, source: string): SentryV8Migration {
	const unchanged = (unhandled: readonly string[] = []): SentryV8Migration =>
		Object.freeze({
			path,
			source,
			changed: false,
			changes: Object.freeze([]),
			unhandled: Object.freeze([...new Set(unhandled)].sort(compareStrings)),
		});
	if (!source.includes(REMOVED_SENTRY_TRACING_MODULE)) return unchanged();
	const module = analyze(source, { path, lang: path.endsWith('.ts') ? 'ts' : 'js' });
	const errors = module.diagnostics.filter((entry) => entry.severity === 'error');
	if (errors.length > 0)
		throw new Error(
			`Sentry v8 migration: ${path} does not parse, so its removed ` +
				`${REMOVED_SENTRY_TRACING_MODULE} constructions cannot be rewritten and it cannot be ` +
				`honestly counted as unchanged. Diagnostics: ` +
				errors.map((entry) => entry.message).join('; '),
		);
	const tracing = readModuleImports(module, REMOVED_SENTRY_TRACING_MODULE);
	if (!tracing.present) return unchanged();
	const unhandled: string[] = [];
	if (tracing.wide)
		unhandled.push(
			`${path} imports ${REMOVED_SENTRY_TRACING_MODULE} as a namespace or default binding; a ` +
				`${REMOVED_BROWSER_TRACING_CLASS} reached through one is not rewritten`,
		);
	for (const name of tracing.named.keys())
		if (name !== REMOVED_INTEGRATIONS_OBJECT && name !== REMOVED_BROWSER_TRACING_CLASS)
			unhandled.push(
				`${path} imports ${name} from ${REMOVED_SENTRY_TRACING_MODULE}, a package v8 removed ` +
					'with no successor for that export; the import was left in place',
			);
	const sites = constructionSites(module, tracing, path, unhandled);
	if (sites.length === 0) return unchanged(unhandled);
	const sdk = readModuleImports(module, SENTRY_ANGULAR_MODULE);
	const factory = resolveFactoryReference(module, sdk);
	if (factory === null) {
		unhandled.push(
			`${path} constructs ${REMOVED_SENTRY_TRACING_MODULE}'s ${REMOVED_BROWSER_TRACING_CLASS} ` +
				`but no ${BROWSER_TRACING_FACTORY} could be established from ${SENTRY_ANGULAR_MODULE} ` +
				'in this module; every construction was left whole',
		);
		return unchanged(unhandled);
	}
	const constructions = readConstructions(module, source, sites, sdk, path, unhandled);
	const accepted = withoutContestedRelocations(constructions, path, unhandled);
	if (accepted.length === 0) return unchanged(unhandled);
	const edits: Edit[] = [];
	const changes: SentryV8Change[] = [];
	for (const construction of accepted) {
		edits.push({
			start: construction.start,
			end: construction.end,
			text: `${factory.reference}(${construction.optionsText})`,
		});
		changes.push({
			kind: 'sentry-browser-tracing-integration',
			line: lineOf(source, construction.start),
			from: `new ${construction.calleeText}(…)`,
			to: `${factory.reference}(${construction.optionsText === '' ? '' : '…'})`,
		});
		const relocation = construction.relocation;
		if (relocation === null) continue;
		const properties = plainProperties(relocation.target) ?? [];
		const last = properties[properties.length - 1];
		if (last === undefined) continue;
		edits.push({
			start: last.node.end,
			end: last.node.end,
			text: `,\n${indentAt(source, last.node.start)}${TRACE_PROPAGATION_TARGETS_OPTION}: ${relocation.value}`,
		});
		changes.push({
			kind: 'sentry-trace-propagation-targets',
			line: relocation.line,
			from: `${REMOVED_TRACING_ORIGINS_OPTION}: ${relocation.value}`,
			to: `${SENTRY_INIT} option ${TRACE_PROPAGATION_TARGETS_OPTION}: ${relocation.value}`,
		});
	}
	edits.push(...factory.imports);
	edits.push(...tracingImportEdits(module, source, tracing, accepted, path, unhandled));
	unhandled.push(...unconsumedRoutingReports(module, sdk, accepted, path));
	const migrated = applyEdits(source, edits);
	return Object.freeze({
		path,
		source: migrated,
		changed: migrated !== source,
		changes: Object.freeze(
			[...changes].sort(
				(left, right) => left.line - right.line || compareStrings(left.from, right.from),
			),
		),
		unhandled: Object.freeze([...new Set(unhandled)].sort(compareStrings)),
	});
}

type Site = Readonly<{ node: AstNode; binding: BindingSymbol; calleeText: string }>;

/**
 * Every `new BrowserTracing(...)` in the module, reached through a binding
 * `@sentry/tracing` exported. Both spellings the SDK offered are followed: the
 * class as a member of the `Integrations` object, and the class imported
 * directly. Any other use of either binding is reported rather than rewritten,
 * and its presence is what later keeps the import specifier in place.
 */
function constructionSites(
	module: SemanticModule,
	tracing: ModuleImports,
	path: string,
	unhandled: string[],
): readonly Site[] {
	const sites: Site[] = [];
	const integrations = tracing.named.get(REMOVED_INTEGRATIONS_OBJECT);
	if (integrations !== undefined)
		for (const reference of integrations.references) {
			const member = module.parentOf(reference.node);
			const isMember =
				member !== null &&
				member.type === 'MemberExpression' &&
				!member.computed &&
				member.object === reference.node &&
				member.property.type === 'Identifier' &&
				member.property.name === REMOVED_BROWSER_TRACING_CLASS;
			const construction = isMember ? module.parentOf(member) : null;
			if (
				construction === null ||
				construction.type !== 'NewExpression' ||
				construction.callee !== member
			) {
				unhandled.push(
					`${path}: ${integrations.name} from ${REMOVED_SENTRY_TRACING_MODULE} is used at ` +
						`line ${lineOf(module.source, reference.node.start)} in a form other than ` +
						`\`new ${integrations.name}.${REMOVED_BROWSER_TRACING_CLASS}(…)\`; it was left as it is`,
				);
				continue;
			}
			sites.push({
				node: construction,
				binding: integrations,
				calleeText: module.source.slice(member.start, member.end),
			});
		}
	const browserTracing = tracing.named.get(REMOVED_BROWSER_TRACING_CLASS);
	if (browserTracing !== undefined)
		for (const reference of browserTracing.references) {
			const construction = module.parentOf(reference.node);
			if (
				construction === null ||
				construction.type !== 'NewExpression' ||
				construction.callee !== reference.node
			) {
				unhandled.push(
					`${path}: ${browserTracing.name} from ${REMOVED_SENTRY_TRACING_MODULE} is used at ` +
						`line ${lineOf(module.source, reference.node.start)} in a form other than ` +
						`\`new ${browserTracing.name}(…)\`; it was left as it is`,
				);
				continue;
			}
			sites.push({
				node: construction,
				binding: browserTracing,
				calleeText: reference.node.name,
			});
		}
	return Object.freeze(sites);
}

type FactoryReference = Readonly<{
	reference: string;
	/** The import edits naming the factory costs this module, if any. */
	imports: readonly Edit[];
}>;

/**
 * How this module will name the v8 factory. The SDK's namespace binding is
 * preferred because that is how an Angular entry point conventionally holds the
 * SDK; a named import of the factory is reused when one is already there; and a
 * module that imports the SDK by name gains one more specifier. A module that
 * does not import the SDK at all, or that already binds the factory's name to
 * something else, yields null and the caller refuses every construction: the
 * flavour of `browserTracingIntegration` matters, and this capability will not
 * invent an import to decide it.
 */
function resolveFactoryReference(
	module: SemanticModule,
	sdk: ModuleImports,
): FactoryReference | null {
	const noEdits: readonly Edit[] = Object.freeze([]);
	if (sdk.namespace !== null)
		return Object.freeze({
			reference: `${sdk.namespace.name}.${BROWSER_TRACING_FACTORY}`,
			imports: noEdits,
		});
	const existing = sdk.named.get(BROWSER_TRACING_FACTORY);
	if (existing !== undefined)
		return Object.freeze({ reference: existing.name, imports: noEdits });
	if (module.rootScope.find(BROWSER_TRACING_FACTORY) !== null) return null;
	for (const declaration of sdk.declarations) {
		const specifiers = namedSpecifiersOf(declaration);
		const last = specifiers[specifiers.length - 1];
		if (last === undefined) continue;
		return Object.freeze({
			reference: BROWSER_TRACING_FACTORY,
			imports: Object.freeze([
				{ start: last.end, end: last.end, text: `, ${BROWSER_TRACING_FACTORY}` },
			]),
		});
	}
	return null;
}

function readConstructions(
	module: SemanticModule,
	source: string,
	sites: readonly Site[],
	sdk: ModuleImports,
	path: string,
	unhandled: string[],
): readonly Construction[] {
	const constructions: Construction[] = [];
	for (const site of sites) {
		const node = site.node;
		if (node.type !== 'NewExpression') continue;
		const line = lineOf(source, node.start);
		const refuse = (reason: string): void => {
			unhandled.push(
				`${path}: the ${REMOVED_BROWSER_TRACING_CLASS} construction at line ${line} ${reason}; ` +
					'it was left exactly as it is',
			);
		};
		if (node.arguments.length > 1) {
			refuse(`takes more arguments than ${BROWSER_TRACING_FACTORY} accepts`);
			continue;
		}
		const argument = node.arguments[0];
		if (argument === undefined) {
			constructions.push(
				Object.freeze({
					start: node.start,
					end: node.end,
					binding: site.binding,
					calleeText: site.calleeText,
					optionsText: '',
					relocation: null,
					consumedRouting: false,
				}),
			);
			continue;
		}
		const properties = plainProperties(argument);
		if (properties === null) {
			refuse(
				'is configured with something other than a plain object literal, so what it sets ' +
					'cannot be established',
			);
			continue;
		}
		const removed = new Set<PlainProperty>();
		let origins: PlainProperty | null = null;
		let consumedRouting = false;
		let refused = false;
		for (const property of properties) {
			if (property.name === REMOVED_TRACING_ORIGINS_OPTION) {
				origins = property;
				removed.add(property);
				continue;
			}
			if (property.name === REMOVED_ROUTING_INSTRUMENTATION) {
				if (!isSdkExport(module, property.value, sdk, REMOVED_ROUTING_INSTRUMENTATION)) {
					refuse(
						`passes a ${REMOVED_ROUTING_INSTRUMENTATION} this capability cannot resolve to ` +
							`${SENTRY_ANGULAR_MODULE}'s own, which is the only one v8's integration ` +
							'performs for itself',
					);
					refused = true;
					break;
				}
				consumedRouting = true;
				removed.add(property);
			}
		}
		if (refused) continue;
		let relocation: Relocation | null = null;
		if (origins !== null) {
			const target = enclosingInitOptions(module, node, sdk);
			if (target === null) {
				refuse(
					`sets ${REMOVED_TRACING_ORIGINS_OPTION}, whose v8 successor ` +
						`${TRACE_PROPAGATION_TARGETS_OPTION} is a ${SENTRY_INIT} option, but no ` +
						`${SENTRY_ANGULAR_MODULE} ${SENTRY_INIT} options literal encloses it`,
				);
				continue;
			}
			const targetProperties = plainProperties(target);
			if (targetProperties === null || targetProperties.length === 0) {
				refuse(
					`sets ${REMOVED_TRACING_ORIGINS_OPTION}, but the enclosing ${SENTRY_INIT} options ` +
						`literal is not a plain object literal, so ${TRACE_PROPAGATION_TARGETS_OPTION} ` +
						'cannot be established there',
				);
				continue;
			}
			if (targetProperties.some((entry) => entry.name === TRACE_PROPAGATION_TARGETS_OPTION)) {
				refuse(
					`sets ${REMOVED_TRACING_ORIGINS_OPTION}, but the enclosing ${SENTRY_INIT} call ` +
						`already declares ${TRACE_PROPAGATION_TARGETS_OPTION}, and this capability will ` +
						'not overwrite a value the application chose',
				);
				continue;
			}
			relocation = Object.freeze({
				target,
				value: source.slice(origins.value.start, origins.value.end),
				line: lineOf(source, origins.node.start),
			});
		}
		constructions.push(
			Object.freeze({
				start: node.start,
				end: node.end,
				binding: site.binding,
				calleeText: site.calleeText,
				optionsText: rewriteOptions(source, argument, properties, removed),
				relocation,
				consumedRouting,
			}),
		);
	}
	return Object.freeze(constructions);
}

/**
 * Two constructions relocating into one `init` call would each claim the single
 * `tracePropagationTargets` option. There is no honest merge of two different
 * origin lists, so both are refused and left whole.
 */
function withoutContestedRelocations(
	constructions: readonly Construction[],
	path: string,
	unhandled: string[],
): readonly Construction[] {
	const claims = new Map<AstNode, number>();
	for (const construction of constructions) {
		const target = construction.relocation?.target;
		if (target !== undefined) claims.set(target, (claims.get(target) ?? 0) + 1);
	}
	const kept: Construction[] = [];
	for (const construction of constructions) {
		const target = construction.relocation?.target;
		if (target !== undefined && (claims.get(target) ?? 0) > 1) {
			unhandled.push(
				`${path}: the ${REMOVED_BROWSER_TRACING_CLASS} construction at line ` +
					`${construction.relocation?.line ?? 0} shares its ${SENTRY_INIT} call with another ` +
					`construction that also sets ${REMOVED_TRACING_ORIGINS_OPTION}; one ` +
					`${TRACE_PROPAGATION_TARGETS_OPTION} cannot carry both, so both were left ` +
					'exactly as they are',
			);
			continue;
		}
		kept.push(construction);
	}
	return Object.freeze(kept);
}

/**
 * Drop the specifiers of `@sentry/tracing` whose every use this migration
 * rewrote, and the whole declaration when nothing of it is left. A declaration
 * that still binds something — a use this capability refused, an export it has
 * no successor for, a default binding — keeps its import, so the module names
 * what it still depends on instead of silently losing it.
 */
function tracingImportEdits(
	module: SemanticModule,
	source: string,
	tracing: ModuleImports,
	accepted: readonly Construction[],
	path: string,
	unhandled: string[],
): readonly Edit[] {
	const consumed = new Map<BindingSymbol, number>();
	for (const construction of accepted)
		consumed.set(construction.binding, (consumed.get(construction.binding) ?? 0) + 1);
	const retired = new Set<BindingSymbol>();
	for (const [binding, count] of consumed)
		if (count === binding.references.length) retired.add(binding);
	const edits: Edit[] = [];
	for (const declaration of tracing.declarations) {
		const specifiers = namedSpecifiersOf(declaration);
		if (specifiers.length === 0) continue;
		if (hasWideSpecifier(declaration)) {
			unhandled.push(
				`${path} imports ${REMOVED_SENTRY_TRACING_MODULE} with a default or namespace binding ` +
					'alongside named ones, so its import declaration was left as it is',
			);
			continue;
		}
		const kept = specifiers.filter((specifier) => {
			const local =
				specifier.type === 'ImportSpecifier' ? module.symbolOf(specifier.local) : null;
			return local === null || !retired.has(local as BindingSymbol);
		});
		if (kept.length === specifiers.length) continue;
		if (kept.length === 0) {
			let end = declaration.end;
			while (source[end] === ' ' || source[end] === '\t') end += 1;
			if (source[end] === '\n') end += 1;
			edits.push({ start: declaration.start, end, text: '' });
			continue;
		}
		const first = specifiers[0] as AstNode;
		const last = specifiers[specifiers.length - 1] as AstNode;
		edits.push({
			start: first.start,
			end: last.end,
			text: kept.map((specifier) => source.slice(specifier.start, specifier.end)).join(', '),
		});
	}
	return Object.freeze(edits);
}

/**
 * `routingInstrumentation` this migration did not consume. The export is gone
 * in v8 wherever it is reached from, so a reference left behind is a demand the
 * migrated module still makes and the reader is owed it by name.
 */
function unconsumedRoutingReports(
	module: SemanticModule,
	sdk: ModuleImports,
	accepted: readonly Construction[],
	path: string,
): readonly string[] {
	const consumed = accepted.filter((construction) => construction.consumedRouting).length;
	const references: number[] = [];
	const named = sdk.named.get(REMOVED_ROUTING_INSTRUMENTATION);
	if (named !== undefined)
		for (const reference of named.references) references.push(reference.node.start);
	if (sdk.namespace !== null)
		for (const reference of sdk.namespace.references) {
			const member = module.parentOf(reference.node);
			if (
				member !== null &&
				member.type === 'MemberExpression' &&
				!member.computed &&
				member.property.type === 'Identifier' &&
				member.property.name === REMOVED_ROUTING_INSTRUMENTATION
			)
				references.push(reference.node.start);
		}
	if (references.length <= consumed) return Object.freeze([]);
	return Object.freeze([
		`${path} still reaches ${SENTRY_ANGULAR_MODULE}'s ${REMOVED_ROUTING_INSTRUMENTATION}, which ` +
			`v8 removed, at ${references.length - consumed} of ${references.length} use sites; only ` +
			`the ones this migration folded into ${BROWSER_TRACING_FACTORY} were rewritten`,
	]);
}
