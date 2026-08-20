/**
 * A symbol whose package went away, carried to a successor that is spelled
 * differently *and* used differently — read one use position at a time.
 *
 * {@link succeedRemovedEntryPointSymbols} answers the narrow shape it was
 * written for: a creation function, called at one arity, replaced by another
 * free function. `@angular/http` is the shape it cannot answer. The package is
 * gone from the registry after 7.2.16, its successor lives in a *different*
 * package at `@angular/common/http`, and the six names an era application
 * imports from it are used as five different kinds of thing: a type annotation,
 * a `new` target, a constructor parameter's type, a member of an NgModule
 * `imports` array, and a call.
 *
 * A rename is therefore not one claim but one claim per position, because a
 * successor that is right in one position is wrong in another and the wrongness
 * is silent. Three examples out of this one package, all of them load-bearing:
 *
 * - `Response` is not generic and `HttpResponse<T>` is. Writing the bare name
 *   into a type annotation moves `TS2307` to `TS2314`; writing a body type
 *   nobody read invents one. The rule carries the argument the *removed* type
 *   already stated — `Response.json()` returned `any` — so the substitution
 *   keeps exactly the checking strength the site had, no more and no less.
 * - `Headers` and `HttpHeaders` share a method name and not its meaning:
 *   `Headers.append` mutated the receiver, `HttpHeaders.append` returns a new
 *   instance and leaves the receiver alone. A rename compiles and silently stops
 *   sending the header. There is no rule for it, and the refusal says why.
 * - `Http` and `HttpClient` are both injected services and their call surfaces
 *   are not the same one: `HttpClient` hands the caller the parsed body where
 *   `Http` handed it a `Response` to call `.json()` on. A rename leaves every
 *   call site of the injected binding compiling against a shape it will not get.
 *
 * So the claims here are written per position, each one refusable, and the
 * refusal is per declaration and total: a declaration with one use this table
 * cannot place keeps every one of its bindings, because rewriting the names that
 * do resolve would leave the others pointing at a module the tree does not
 * answer.
 *
 * One symbol is neither renamed nor kept. `JsonpModule` has no successor by
 * rename — `HttpClientJsonpModule` requires `HttpClientModule` beside it and
 * changes how a JSONP request is written — so where an application names it as
 * an NgModule `imports` member and imports *nothing the module provided*
 * anywhere in its own source, the member is dropped and the loss is declared. A
 * module whose services the application does inject is refused instead: dropping
 * that one would be a rewrite of what the application does.
 */

import { compareStrings } from './angular-target-cell.ts';
import type { RootSurfaceReading } from './removed-entry-point-symbol-successor.ts';
import {
	applySourceEdits,
	forEachNode,
	isFreeRootName,
	lineOf,
	parseModule,
	plainProperties,
	readModuleImports,
	type AstNode,
	type SemanticModule,
	type SourceEdit,
} from './semantic-module.ts';

const CAPABILITY = 'Use position symbol successor';

/** The Angular decorator whose `imports` array a module member is read from. */
export const NG_MODULE_DECORATOR_NAME = 'NgModule';
/** The package that publishes it. */
export const NG_MODULE_DECORATOR_PACKAGE = '@angular/core';

/**
 * The kinds of use this capability separates.
 *
 * They are syntactic positions and nothing more: what a position *means* for a
 * given symbol is the claim's business, not the classifier's. A reference the
 * classifier cannot place is not a position — it is a refusal.
 */
export type UsePosition =
	| 'type-reference'
	| 'constructor-parameter-type'
	| 'new-target'
	| 'ng-module-imports-member'
	| 'call';

/**
 * What one claim says may be written at one position.
 *
 * `text` is the whole of the substitution, so a type argument the successor
 * requires is part of the claim rather than something assembled later. `arity`
 * is stated for `call` only, and is part of the claim for the same reason it is
 * in the sibling capability: a successor right for one call shape is not thereby
 * right for another.
 */
export type UsePositionRule = Readonly<{
	position: UsePosition;
	text: string;
	arity?: number;
	reason: string;
}>;

/**
 * What may be dropped instead of renamed, and on what evidence.
 *
 * `positions` are the only positions a drop is stated for, and `provides` are
 * the names the removed symbol supplied to an application that used it. The drop
 * is refused unless the application imports none of them from the removed
 * specifier anywhere the caller read — which is the difference between "this
 * module registered a service nothing asks for" and "this module registered the
 * service the application injects".
 */
export type DocumentedUseRemoval = Readonly<{
	positions: readonly UsePosition[];
	provides: readonly string[];
	reason: string;
}>;

/**
 * One removed symbol, its successor's spelling, and the positions the successor
 * is claimed for. `to` is null where the symbol has no successor by rename at
 * all, which is a claim in its own right and the only ground a {@link removal}
 * stands on.
 */
export type DocumentedUsePositionSuccessor = Readonly<{
	/** The specifier the successor is imported from; may be another package. */
	package: string;
	/** The specifier the application imports through, e.g. `@angular/http`. */
	specifier: string;
	from: string;
	to: string | null;
	since: string;
	rules: readonly UsePositionRule[];
	removal?: DocumentedUseRemoval;
	note: string;
}>;

/** Names one application module imports from a removed specifier. */
export type ApplicationImportReading = Readonly<{
	specifier: string;
	names: readonly string[];
}>;

export type UsePositionChange = Readonly<{
	kind: 'use-position-symbol-successor' | 'use-position-symbol-removal';
	line: number;
	specifier: string;
	successor: string | null;
	from: string;
	to: string | null;
	positions: readonly UsePosition[];
	useSites: number;
}>;

export type UsePositionMigration = Readonly<{
	path: string;
	source: string;
	changed: boolean;
	changes: readonly UsePositionChange[];
	declaredDifferences: readonly string[];
	unhandled: readonly string[];
}>;

/**
 * The `@angular/http` claims, written per position.
 *
 * Every `to` here is a name `@angular/common/http` publishes and every `from` is
 * one it does not, which is what the reading is asked to confirm before any of
 * this is written. The two entries with no rules at all are the measurement this
 * table exists to keep honest: they are not oversights, they are the positions
 * where a rename would compile and lie.
 */
export const ANGULAR_HTTP_USE_POSITION_SUCCESSORS: readonly DocumentedUsePositionSuccessor[] =
	Object.freeze([
		Object.freeze({
			package: '@angular/common/http',
			specifier: '@angular/http',
			from: 'HttpModule',
			to: 'HttpClientModule',
			since: 'Angular 8 (the package stops at 7.2.16)',
			rules: Object.freeze([
				Object.freeze({
					position: 'ng-module-imports-member' as const,
					text: 'HttpClientModule',
					reason:
						'`HttpClientModule` is the NgModule `HttpModule` was replaced by: both are imported ' +
						'into an NgModule and neither takes arguments, so the member is the whole of the ' +
						'substitution.',
				}),
			]),
			note: 'Named by Angular as the replacement module in the same release notes that deprecated the package.',
		}),
		Object.freeze({
			package: '@angular/common/http',
			specifier: '@angular/http',
			from: 'Response',
			to: 'HttpResponse',
			since: 'Angular 8 (the package stops at 7.2.16)',
			rules: Object.freeze([]),
			note:
				'`HttpResponse` is the class `Response` was replaced by, and it is not a substitution at ' +
				'the position era applications actually write `Response` in — a type annotation on what an ' +
				'HTTP observable emits. Two independent reasons, and the second is the one that decides it. ' +
				'`Response` is not generic and `HttpResponse<T>` is with no default, so the bare name is ' +
				'not a type at all and any argument written for it is one nobody read. And the value being ' +
				'annotated is no longer a response: `Http` emitted a `Response` to call `.json()` on, ' +
				"`HttpClient` emits the parsed body unless the caller asks for `observe: 'response'`, so " +
				'an annotation naming the successor class states something about the value that is false. ' +
				'This was measured rather than reasoned: writing `HttpResponse<any>` into the four ' +
				'type-position sites of the eShopOnContainers WebSPA holdout compiled the declaration and ' +
				'produced eighteen new `TS2322`/`TS2345` diagnostics where the annotation met the ' +
				'observable its own `DataService` declares (T024 u2, ' +
				'evidence/ingests/angular-eshop-webspa-netcore2-2/migration/u2a-t024-target-build.log). ' +
				'The type positions are therefore left for the same caller who has to answer the call ' +
				'surface, and the specifier stays unresolved rather than resolving onto a lie.',
		}),
		Object.freeze({
			package: '@angular/common/http',
			specifier: '@angular/http',
			from: 'Http',
			to: 'HttpClient',
			since: 'Angular 8 (the package stops at 7.2.16)',
			rules: Object.freeze([]),
			note:
				'`HttpClient` is the service `Http` was replaced by and it is not a rename at any position. ' +
				'`Http` handed its caller a `Response` to call `.json()` on and accepted a `body` on every ' +
				'request including `GET`; `HttpClient` hands over the parsed body and publishes no `body` ' +
				'option on `GET`. Substituting the type leaves every call site of the injected binding ' +
				'compiling against a shape the successor will not produce, so no position is claimed and ' +
				'the call sites are left for a caller to answer.',
		}),
		Object.freeze({
			package: '@angular/common/http',
			specifier: '@angular/http',
			from: 'Headers',
			to: 'HttpHeaders',
			since: 'Angular 8 (the package stops at 7.2.16)',
			rules: Object.freeze([]),
			note:
				'`HttpHeaders` is immutable where `Headers` was not: `Headers.append` mutated the receiver ' +
				'and `HttpHeaders.append` returns a new instance and leaves the receiver as it was. A ' +
				'renamed declaration and a renamed `new` target both compile and both silently stop ' +
				'sending whatever the application appended, so no position is claimed.',
		}),
		Object.freeze({
			package: '@angular/common/http',
			specifier: '@angular/http',
			from: 'JsonpModule',
			to: null,
			since: 'Angular 8 (the package stops at 7.2.16)',
			rules: Object.freeze([]),
			removal: Object.freeze({
				positions: Object.freeze(['ng-module-imports-member' as const]),
				provides: Object.freeze([
					'Jsonp',
					'JSONPBackend',
					'JSONPConnection',
					'BrowserJsonp',
				]),
				reason:
					"`JsonpModule` has no successor by rename. Angular's JSONP support moved to " +
					'`HttpClientJsonpModule`, which requires `HttpClientModule` beside it and changes how a ' +
					'JSONP request is written at the call site, so it is a different module and not a new ' +
					'spelling of this one. Where the only thing an application does with `JsonpModule` is ' +
					'name it in an NgModule `imports` array, and it imports none of the services the module ' +
					'registered, the member registers providers nothing can ask for: it is dropped and the ' +
					'loss of JSONP support is declared. An application that injects `Jsonp` is refused.',
			}),
			note: 'The refusal and the conditional drop are both the claim; neither is a rename.',
		}),
	]);

/** Every identifier node in a module that resolves to `local`. */
function referencesTo(module: SemanticModule, local: unknown): readonly AstNode[] {
	const found: AstNode[] = [];
	forEachNode(module.ast, (node) => {
		if (node.type !== 'Identifier') return;
		if (module.symbolOf(node) !== local) return;
		found.push(node);
	});
	return Object.freeze(found);
}

/**
 * Whether a type reference sits in a constructor's parameter list rather than
 * anywhere else a type may be written.
 *
 * The walk stops at the first function body it crosses, so an annotation inside
 * a constructor's own statements — a callback parameter, a local declaration —
 * is not a constructor parameter type.
 */
function inConstructorParameters(module: SemanticModule, node: AstNode): boolean {
	let previous: AstNode = node;
	let current = module.parentOf(node);
	while (current !== null) {
		if (current.type === 'BlockStatement') return false;
		if (current.type === 'MethodDefinition') return current.kind === 'constructor';
		if (current.type === 'FunctionExpression' && current.body === previous) return false;
		previous = current;
		current = module.parentOf(current);
	}
	return false;
}

/**
 * The array literal an element belongs to, when that array is the value of the
 * named property of an object literal the `NgModule` decorator was called with.
 *
 * Nothing else counts: an array of modules assembled in a variable and spread
 * into the decorator is not read here, because this capability edits the array
 * element and an element it did not read is an element it must not edit.
 */
function ngModuleArrayProperty(
	module: SemanticModule,
	element: AstNode,
	decorator: ReturnType<typeof readModuleImports>,
): string | null {
	const array = module.parentOf(element);
	if (array === null || array.type !== 'ArrayExpression') return null;
	const property = module.parentOf(array);
	if (property === null || property.type !== 'Property') return null;
	const object = module.parentOf(property);
	if (object === null || object.type !== 'ObjectExpression') return null;
	const call = module.parentOf(object);
	if (call === null || call.type !== 'CallExpression') return null;
	if (call.callee.type !== 'Identifier') return null;
	const expected = decorator.named.get(NG_MODULE_DECORATOR_NAME);
	if (expected === undefined || module.symbolOf(call.callee) !== expected) return null;
	const properties = plainProperties(object);
	if (properties === null) return null;
	const named = properties.find((entry) => entry.value === array);
	return named?.name ?? null;
}

type PlacedUse = Readonly<{ node: AstNode; position: UsePosition; arguments: number }>;

/**
 * Where one reference sits, or null when this capability does not read that
 * position. A null is a refusal and never a default.
 */
function placeUse(
	module: SemanticModule,
	node: AstNode,
	decorator: ReturnType<typeof readModuleImports>,
): PlacedUse | null {
	const parent = module.parentOf(node);
	if (parent === null) return null;
	if (parent.type === 'NewExpression' && parent.callee === node)
		return Object.freeze({ node, position: 'new-target', arguments: parent.arguments.length });
	if (parent.type === 'CallExpression' && parent.callee === node)
		return Object.freeze({ node, position: 'call', arguments: parent.arguments.length });
	if (parent.type === 'TSTypeReference' && parent.typeName === node)
		return Object.freeze({
			node,
			position: inConstructorParameters(module, parent)
				? 'constructor-parameter-type'
				: 'type-reference',
			arguments: 0,
		});
	if (
		parent.type === 'ArrayExpression' &&
		ngModuleArrayProperty(module, node, decorator) === 'imports'
	)
		return Object.freeze({ node, position: 'ng-module-imports-member', arguments: 0 });
	return null;
}

/** The rule a claim states for one placed use, or null when it states none. */
function ruleFor(claim: DocumentedUsePositionSuccessor, use: PlacedUse): UsePositionRule | null {
	for (const rule of claim.rules) {
		if (rule.position !== use.position) continue;
		if (rule.position === 'call' && rule.arity !== undefined && rule.arity !== use.arguments)
			continue;
		return rule;
	}
	return null;
}

/**
 * The span to delete so that one array element and exactly one of its
 * separating commas leave the array.
 */
function elementRemoval(
	array: Extract<AstNode, { type: 'ArrayExpression' }>,
	element: AstNode,
): SourceEdit {
	const elements = array.elements as readonly (AstNode | null)[];
	const index = elements.indexOf(element);
	const previous = index > 0 ? (elements[index - 1] ?? null) : null;
	if (previous !== null) return { start: previous.end, end: element.end, text: '' };
	const next = elements[index + 1] ?? null;
	if (next !== null) return { start: element.start, end: next.start, text: '' };
	return { start: element.start, end: element.end, text: '' };
}

/** Every name the application imports from `specifier`, across the readings. */
function importedAcrossApplication(
	readings: readonly ApplicationImportReading[],
	specifier: string,
): ReadonlySet<string> {
	const names = new Set<string>();
	for (const reading of readings)
		if (reading.specifier === specifier) for (const name of reading.names) names.add(name);
	return names;
}

/**
 * Read the names every supplied module imports from each specifier, so a
 * per-module capability can be told a fact about the whole application.
 */
export function readRemovedSpecifierImports(
	modules: readonly Readonly<{ path: string; source: string }>[],
	specifiers: readonly string[],
): readonly ApplicationImportReading[] {
	const names = new Map<string, Set<string>>();
	for (const module of modules) {
		if (!specifiers.some((specifier) => module.source.includes(specifier))) continue;
		const parsed = parseModule(CAPABILITY, module.path, module.source);
		for (const record of parsed.imports) {
			if (!specifiers.includes(record.specifier)) continue;
			if (record.name === null) continue;
			const set = names.get(record.specifier) ?? new Set<string>();
			set.add(record.name);
			names.set(record.specifier, set);
		}
	}
	return Object.freeze(
		[...names.entries()]
			.sort((left, right) => compareStrings(left[0], right[0]))
			.map((entry) =>
				Object.freeze({
					specifier: entry[0],
					names: Object.freeze([...entry[1]].sort(compareStrings)),
				}),
			),
	);
}

type Resolved = Readonly<{
	name: string;
	successor: string | null;
	claim: DocumentedUsePositionSuccessor;
	uses: readonly PlacedUse[];
	rules: readonly UsePositionRule[];
}>;

/**
 * Carry one module's imports of a removed specifier to their successors, one use
 * position at a time, where the installed closure proves each successor and the
 * claims state a rule for every position the module actually uses.
 */
export function succeedRemovedSymbolUses(
	path: string,
	source: string,
	claims: readonly DocumentedUsePositionSuccessor[],
	readings: readonly RootSurfaceReading[],
	applicationImports: readonly ApplicationImportReading[] = [],
): UsePositionMigration {
	const module = parseModule(CAPABILITY, path, source);
	const decorator = readModuleImports(module, NG_MODULE_DECORATOR_PACKAGE);
	const edits: SourceEdit[] = [];
	const changes: UsePositionChange[] = [];
	const declaredDifferences: string[] = [];
	const unhandled: string[] = [];
	for (const declaration of module.ast.body) {
		if (declaration.type !== 'ImportDeclaration') continue;
		const specifier: unknown = declaration.source.value;
		if (typeof specifier !== 'string') continue;
		const applicable = claims.filter((claim) => claim.specifier === specifier);
		if (applicable.length === 0) continue;
		const line = lineOf(source, declaration.start);
		const at = `${path} line ${String(line)}`;
		const refuse = (reason: string): void => {
			unhandled.push(`${at}: ${reason}`);
		};
		const successorSpecifiers = new Set(applicable.map((claim) => claim.package));
		if (successorSpecifiers.size !== 1) {
			refuse(
				`${specifier} is claimed for more than one successor specifier ` +
					`(${[...successorSpecifiers].sort(compareStrings).join(', ')}), and one declaration ` +
					'cannot be rewritten onto two',
			);
			continue;
		}
		const root = [...successorSpecifiers][0] as string;
		const reading = readings.find(
			(entry) => entry.package === root && entry.specifier === specifier,
		);
		if (reading === undefined) {
			refuse(
				`no successor surface was read for '${root}', so ${specifier} was left as it is`,
			);
			continue;
		}
		if (!reading.complete) {
			refuse(
				`the surface of '${root}'@${reading.version} is incomplete, so it establishes neither ` +
					'that a successor is published nor that the replaced name is not',
			);
			continue;
		}
		if (reading.specifierResolves) {
			refuse(
				`'${root}'@${reading.version} still answers ${specifier}, so the diagnostic does not ` +
					'describe this closure and the rewrite would be a rewrite of working code',
			);
			continue;
		}
		let wide = false;
		const named: { name: string; localName: string; local: unknown; node: AstNode }[] = [];
		for (const imported of declaration.specifiers) {
			if (
				imported.type !== 'ImportSpecifier' ||
				imported.imported.type !== 'Identifier' ||
				imported.local.type !== 'Identifier'
			) {
				wide = true;
				continue;
			}
			named.push({
				name: imported.imported.name,
				localName: imported.local.name,
				local: module.symbolOf(imported.local),
				node: imported.local,
			});
		}
		if (wide) {
			refuse(
				`${specifier} is unreachable and the declaration carries a default or namespace binding, ` +
					'whose members cannot be resolved to a successor by name',
			);
			continue;
		}
		if (named.length === 0) {
			refuse(
				`${specifier} is unreachable and the declaration names no symbol — it is imported for its ` +
					'side effect, and nothing about the published surface says which entry point runs the ' +
					'same one',
			);
			continue;
		}
		const resolved: Resolved[] = [];
		const refusals: string[] = [];
		for (const entry of named) {
			const claim = applicable.find((candidate) => candidate.from === entry.name);
			if (claim === undefined) {
				refusals.push(`no successor is written down for ${entry.name}`);
				continue;
			}
			if (entry.localName !== entry.name) {
				refusals.push(
					`${entry.name} is imported as ${entry.localName}, and a successor written through an ` +
						'alias would rename the binding as well as the import',
				);
				continue;
			}
			const uses: PlacedUse[] = [];
			let unplaced: string | null = null;
			for (const node of referencesTo(module, entry.local)) {
				if (node === entry.node) continue;
				const placed = placeUse(module, node, decorator);
				if (placed === null) {
					unplaced =
						`${entry.name} is used at line ${String(lineOf(source, node.start))} in a position ` +
						'this capability does not read — not a type reference, a `new` target, a ' +
						'constructor parameter type, an NgModule `imports` member or a call — so no ' +
						'substitution is stated for it';
					break;
				}
				uses.push(placed);
			}
			if (unplaced !== null) {
				refusals.push(unplaced);
				continue;
			}
			if (uses.length === 0) {
				refusals.push(
					`${entry.name} is imported and never used, and this capability rewrites uses; ` +
						"removing an unused binding is a different capability's decision",
				);
				continue;
			}
			if (claim.to === null) {
				const removal = claim.removal;
				if (removal === undefined) {
					refusals.push(
						`${claim.since} removed ${entry.name} and no successor is written down for it: ` +
							claim.note,
					);
					continue;
				}
				const misplaced = uses.find((use) => !removal.positions.includes(use.position));
				if (misplaced !== undefined) {
					refusals.push(
						`${entry.name} has no successor and is used at line ` +
							`${String(lineOf(source, misplaced.node.start))} as a ${misplaced.position}, ` +
							`which the removal is not stated for (${removal.positions.join(', ')} only)`,
					);
					continue;
				}
				const imported = importedAcrossApplication(applicationImports, specifier);
				const asked = removal.provides.filter((name) => imported.has(name));
				if (asked.length > 0) {
					refusals.push(
						`${entry.name} has no successor and the application imports ` +
							`${asked.sort(compareStrings).join(', ')} from ${specifier}, so dropping the ` +
							'member would drop providers the application asks for',
					);
					continue;
				}
				resolved.push({
					name: entry.name,
					successor: null,
					claim,
					uses: Object.freeze(uses),
					rules: Object.freeze([]),
				});
				continue;
			}
			if (!reading.rootExports.includes(claim.to)) {
				refusals.push(
					`${claim.since} is said to have replaced ${claim.from} with ${claim.to}, and ` +
						`'${root}'@${reading.version} does not publish ${claim.to}`,
				);
				continue;
			}
			if (reading.rootExports.includes(claim.from)) {
				refusals.push(
					`'${root}'@${reading.version} publishes ${claim.from}, so the name did not go away ` +
						'and the specifier is the only thing that did',
				);
				continue;
			}
			if (!isFreeRootName(module, claim.to)) {
				refusals.push(
					`${claim.to} is already bound in this module's root scope, so importing the successor ` +
						'under its own name would shadow or collide with it',
				);
				continue;
			}
			const rules: UsePositionRule[] = [];
			let unstated: string | null = null;
			for (const use of uses) {
				const rule = ruleFor(claim, use);
				if (rule === null) {
					unstated =
						`${entry.name} is used at line ${String(lineOf(source, use.node.start))} as a ` +
						`${use.position}, and ${claim.to} is not written down as its successor at that ` +
						`position: ${claim.note}`;
					break;
				}
				rules.push(rule);
			}
			if (unstated !== null) {
				refusals.push(unstated);
				continue;
			}
			resolved.push({
				name: entry.name,
				successor: claim.to,
				claim,
				uses: Object.freeze(uses),
				rules: Object.freeze(rules),
			});
		}
		if (refusals.length > 0) {
			for (const reason of refusals)
				refuse(
					`${specifier} is unreachable and ${reason}. The whole declaration was left as it is: ` +
						'rewriting the symbols that do resolve would leave the ones that do not pointing at ' +
						'a module this tree does not answer.',
				);
			continue;
		}
		const quote = source.slice(declaration.source.start, declaration.source.start + 1);
		const carried = resolved
			.filter((entry): entry is Resolved & { successor: string } => entry.successor !== null)
			.map((entry) => entry.successor)
			.sort(compareStrings);
		let end = declaration.end;
		if (source[end] === ';') end += 1;
		if (carried.length === 0) {
			if (source[end] === '\r') end += 1;
			if (source[end] === '\n') end += 1;
			edits.push({ start: declaration.start, end, text: '' });
		} else
			edits.push({
				start: declaration.start,
				end,
				text: `import { ${carried.join(', ')} } from ${quote}${root}${quote};`,
			});
		for (const entry of resolved) {
			if (entry.successor === null) {
				for (const use of entry.uses) {
					const array = module.parentOf(use.node);
					if (array === null || array.type !== 'ArrayExpression') continue;
					edits.push(elementRemoval(array, use.node));
				}
				declaredDifferences.push(
					`${path} line ${String(line)}: ${entry.name} was dropped from ${specifier} without a ` +
						`successor — ${entry.claim.removal?.reason ?? entry.claim.note}`,
				);
			} else
				for (let index = 0; index < entry.uses.length; index += 1) {
					const use = entry.uses[index] as PlacedUse;
					const rule = entry.rules[index] as UsePositionRule;
					edits.push({ start: use.node.start, end: use.node.end, text: rule.text });
				}
			changes.push({
				kind:
					entry.successor === null
						? 'use-position-symbol-removal'
						: 'use-position-symbol-successor',
				line,
				specifier,
				successor: entry.successor === null ? null : root,
				from: entry.name,
				to: entry.successor,
				positions: Object.freeze(
					[...new Set(entry.uses.map((use) => use.position))].sort(compareStrings),
				),
				useSites: entry.uses.length,
			});
		}
	}
	const migrated = applySourceEdits(source, edits);
	return Object.freeze({
		path,
		source: migrated,
		changed: migrated !== source,
		changes: Object.freeze(changes),
		declaredDifferences: Object.freeze([...new Set(declaredDifferences)].sort(compareStrings)),
		unhandled: Object.freeze([...new Set(unhandled)].sort(compareStrings)),
	});
}
