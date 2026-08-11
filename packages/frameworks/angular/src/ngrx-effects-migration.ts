/**
 * The `@Effect()` decorator migration for `@ngrx/effects`.
 *
 * NgRx deprecated the `@Effect()` property decorator in version 11 and removed
 * the export in version 15, in favour of the `createEffect()` factory. A
 * workspace lifted across that boundary does not merely warn: the import fails
 * to resolve and the build stops, so a decorated effect is a hard blocker for
 * any Angular line whose NgRx peer is 15 or newer.
 *
 * The rewrite is defined by NgRx, not by any application:
 *
 * ```ts
 * ⁠@Effect()                        name$ = createEffect(() => SOURCE);
 * name$ = SOURCE;              ->
 *
 * ⁠@Effect({ dispatch: false })      name$ = createEffect(() => SOURCE, { dispatch: false });
 * name$ = SOURCE;              ->
 * ```
 *
 * The decorator's configuration object, when it has one, is carried through
 * verbatim as `createEffect`'s second argument — the two take the same shape,
 * so no option is reinterpreted here.
 *
 * Everything rides the parsed module. The decorator is located by resolving the
 * local binding that `@ngrx/effects` exported as `Effect`, so a module that
 * imports some other `Effect` is untouched, and a module that aliases NgRx's
 * (`import { Effect as NgRxEffect }`) is still rewritten. A property this
 * capability cannot rewrite safely is left exactly as it is and reported; it is
 * never partially edited, because a half-rewritten effect would compile into
 * silently dead behaviour rather than failing loudly.
 */

import { analyze } from 'yuku-analyzer';
import { compareStrings } from './angular-target-cell.ts';

/** The module whose `Effect` export this capability replaces. */
export const NGRX_EFFECTS_MODULE = '@ngrx/effects';

/** The removed decorator, and the factory that replaced it. */
export const REMOVED_EFFECT_DECORATOR = 'Effect';
export const EFFECT_FACTORY = 'createEffect';

export type NgrxEffectChange = Readonly<{
	kind: 'ngrx-effect-decorator';
	line: number;
	from: string;
	to: string;
}>;

export type NgrxEffectsMigration = Readonly<{
	path: string;
	source: string;
	changed: boolean;
	changes: readonly NgrxEffectChange[];
	unhandled: readonly string[];
}>;

type Span = readonly [number, number];

type Edit = Readonly<{ start: number; end: number; text: string }>;

function spanOf(node: unknown): Span | null {
	if (typeof node !== 'object' || node === null) return null;
	const candidate = node as { start?: unknown; end?: unknown; range?: unknown };
	if (typeof candidate.start === 'number' && typeof candidate.end === 'number')
		return [candidate.start, candidate.end];
	const range = candidate.range;
	if (!Array.isArray(range) || range.length < 2) return null;
	const [start, end] = range as readonly unknown[];
	return typeof start === 'number' && typeof end === 'number' ? [start, end] : null;
}

function objectNode(value: unknown): Readonly<Record<string, unknown>> | null {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as Readonly<Record<string, unknown>>)
		: null;
}

function nodeType(value: unknown): string | null {
	const node = objectNode(value);
	const type = node?.['type'];
	return typeof type === 'string' ? type : null;
}

function identifierName(value: unknown): string | null {
	const node = objectNode(value);
	if (node === null || node['type'] !== 'Identifier') return null;
	const name = node['name'];
	return typeof name === 'string' ? name : null;
}

function lineOf(source: string, offset: number): number {
	return source.slice(0, offset).split('\n').length;
}

/**
 * The import declaration's bindings for the module, as a map from the exported
 * name to the local binding name. A namespace or default import contributes
 * nothing here and is reported by the caller, because a rewrite through one
 * would have to guess at member access.
 */
type ModuleBindings = Readonly<{
	/** Exported name -> local name, for named imports only. */
	named: ReadonlyMap<string, string>;
	/** Local names bound by a namespace or default import. */
	wide: readonly string[];
}>;

function readModuleBindings(body: readonly unknown[], module: string): ModuleBindings {
	const named = new Map<string, string>();
	const wide: string[] = [];
	for (const statement of body) {
		if (nodeType(statement) !== 'ImportDeclaration') continue;
		const node = objectNode(statement);
		const source = objectNode(node?.['source']);
		if (source?.['value'] !== module) continue;
		const specifiers = node?.['specifiers'];
		if (!Array.isArray(specifiers)) continue;
		for (const specifier of specifiers as readonly unknown[]) {
			const type = nodeType(specifier);
			const entry = objectNode(specifier);
			if (entry === null) continue;
			const local = identifierName(entry['local']);
			if (local === null) continue;
			if (type !== 'ImportSpecifier') {
				wide.push(local);
				continue;
			}
			const imported = identifierName(entry['imported']) ?? local;
			named.set(imported, local);
		}
	}
	return Object.freeze({ named, wide: Object.freeze(wide) });
}

/** Every identifier name bound at the top level of the module. */
function topLevelBindings(body: readonly unknown[]): ReadonlySet<string> {
	const names = new Set<string>();
	const collect = (pattern: unknown): void => {
		const name = identifierName(pattern);
		if (name !== null) names.add(name);
	};
	for (const statement of body) {
		const node = objectNode(statement);
		if (node === null) continue;
		const declaration =
			node['type'] === 'ExportNamedDeclaration' || node['type'] === 'ExportDefaultDeclaration'
				? objectNode(node['declaration'])
				: node;
		if (declaration === null) continue;
		if (declaration['type'] === 'ImportDeclaration') {
			for (const specifier of (declaration['specifiers'] as readonly unknown[]) ?? [])
				collect(objectNode(specifier)?.['local']);
			continue;
		}
		if (declaration['type'] === 'VariableDeclaration') {
			for (const entry of (declaration['declarations'] as readonly unknown[]) ?? [])
				collect(objectNode(entry)?.['id']);
			continue;
		}
		collect(declaration['id']);
	}
	return names;
}

type DecoratedProperty = Readonly<{
	decoratorSpan: Span;
	keyStart: number;
	valueSpan: Span;
	optionsSpan: Span | null;
	name: string;
}>;

/**
 * Find every class property decorated with `local`, walking every class in the
 * module — declared, exported, or assigned to a variable.
 */
function decoratedProperties(
	body: readonly unknown[],
	local: string,
	unhandled: string[],
	path: string,
): DecoratedProperty[] {
	const found: DecoratedProperty[] = [];
	const visit = (value: unknown): void => {
		const node = objectNode(value);
		if (node === null) return;
		if (node['type'] === 'ClassDeclaration' || node['type'] === 'ClassExpression') {
			const classBody = objectNode(node['body']);
			for (const member of (classBody?.['body'] as readonly unknown[]) ?? [])
				readMember(member);
			return;
		}
		for (const child of Object.values(node)) {
			if (Array.isArray(child)) for (const item of child) visit(item);
			else if (typeof child === 'object' && child !== null) visit(child);
		}
	};
	const readMember = (member: unknown): void => {
		const node = objectNode(member);
		if (node === null || node['type'] !== 'PropertyDefinition') return;
		const decorators = (node['decorators'] as readonly unknown[]) ?? [];
		for (const decorator of decorators) {
			const expression = objectNode(objectNode(decorator)?.['expression']);
			if (expression === null) continue;
			const isCall = expression['type'] === 'CallExpression';
			const callee = isCall ? expression['callee'] : expression;
			if (identifierName(callee) !== local) continue;
			const name = identifierName(node['key']) ?? '(computed)';
			const decoratorSpan = spanOf(decorator);
			const keySpan = spanOf(node['key']);
			const valueSpan = spanOf(node['value']);
			if (decoratorSpan === null || keySpan === null || valueSpan === null) {
				unhandled.push(
					`${path}: the property decorated with ${local} could not be located precisely ` +
						'in the source and was left decorated',
				);
				continue;
			}
			const args = isCall ? ((expression['arguments'] as readonly unknown[]) ?? []) : [];
			if (args.length > 1) {
				unhandled.push(
					`${path}: ${name} is decorated with more than one ${local} argument, which ` +
						`${EFFECT_FACTORY} does not take; it was left decorated`,
				);
				continue;
			}
			const optionsSpan = args.length === 1 ? spanOf(args[0]) : null;
			if (args.length === 1 && optionsSpan === null) {
				unhandled.push(
					`${path}: ${name}'s ${local} argument could not be located in the source; it ` +
						'was left decorated',
				);
				continue;
			}
			found.push({
				decoratorSpan,
				keyStart: keySpan[0],
				valueSpan,
				optionsSpan,
				name,
			});
		}
	};
	for (const statement of body) visit(statement);
	return found;
}

/**
 * Replace `@Effect()`-decorated properties in one module with
 * `createEffect(...)` initialisers, and rewrite the import to match.
 *
 * A module that imports nothing from `@ngrx/effects`, or imports it without the
 * removed decorator, is returned byte-identical. A module that does not parse
 * is a hard failure naming the file, never a silent skip.
 */
export function migrateNgrxEffectDecorators(path: string, source: string): NgrxEffectsMigration {
	const unchanged = (unhandled: readonly string[] = []): NgrxEffectsMigration =>
		Object.freeze({
			path,
			source,
			changed: false,
			changes: Object.freeze([]),
			unhandled: Object.freeze([...new Set(unhandled)].sort(compareStrings)),
		});
	if (!source.includes(NGRX_EFFECTS_MODULE)) return unchanged();
	const analyzed = analyze(source, { path, lang: path.endsWith('.ts') ? 'ts' : 'js' });
	const errors = analyzed.diagnostics.filter((entry) => entry.severity === 'error');
	if (errors.length > 0)
		throw new Error(
			`NgRx effects migration: ${path} does not parse, so its removed ${REMOVED_EFFECT_DECORATOR} ` +
				'decorators cannot be rewritten and it cannot be honestly counted as unchanged. ' +
				`Diagnostics: ${errors.map((entry) => entry.message).join('; ')}`,
		);
	const body = analyzed.ast.body as readonly unknown[];
	const bindings = readModuleBindings(body, NGRX_EFFECTS_MODULE);
	const unhandled: string[] = [];
	if (bindings.wide.length > 0)
		unhandled.push(
			`${path} imports ${NGRX_EFFECTS_MODULE} as a namespace or default binding; a ` +
				`${REMOVED_EFFECT_DECORATOR} reached through one is not rewritten`,
		);
	const local = bindings.named.get(REMOVED_EFFECT_DECORATOR);
	if (local === undefined) return unchanged(unhandled);
	const properties = decoratedProperties(body, local, unhandled, path);
	if (properties.length === 0) return unchanged(unhandled);
	const factoryLocal = bindings.named.get(EFFECT_FACTORY);
	const declared = topLevelBindings(body);
	if (factoryLocal === undefined && declared.has(EFFECT_FACTORY)) {
		unhandled.push(
			`${path} already binds the name ${EFFECT_FACTORY} to something other than ` +
				`${NGRX_EFFECTS_MODULE}'s factory, so its ${REMOVED_EFFECT_DECORATOR} decorators ` +
				'were left in place rather than shadowed',
		);
		return unchanged(unhandled);
	}
	const factory = factoryLocal ?? EFFECT_FACTORY;
	const edits: Edit[] = [];
	const changes: NgrxEffectChange[] = [];
	for (const property of properties) {
		const options =
			property.optionsSpan === null
				? ''
				: `, ${source.slice(property.optionsSpan[0], property.optionsSpan[1])}`;
		edits.push({ start: property.decoratorSpan[0], end: property.keyStart, text: '' });
		edits.push({
			start: property.valueSpan[0],
			end: property.valueSpan[0],
			text: `${factory}(() => `,
		});
		edits.push({ start: property.valueSpan[1], end: property.valueSpan[1], text: `${options})` });
		const decorator = source.slice(property.decoratorSpan[0], property.decoratorSpan[1]);
		changes.push({
			kind: 'ngrx-effect-decorator',
			line: lineOf(source, property.decoratorSpan[0]),
			from: `${decorator} ${property.name}`,
			to: `${property.name} = ${factory}(() => …${options})`,
		});
	}
	/**
	 * Rewrite the named-specifier list as a whole rather than surgically
	 * deleting one entry and appending another. Editing the entries in place has
	 * to reason about which comma belongs to which neighbour, and the case where
	 * the removed decorator is the list's only entry produces a dangling comma
	 * that does not parse. Replacing the span from the first named specifier to
	 * the last is exact in every arrangement, including a default import
	 * standing outside the braces, whose span is deliberately left alone.
	 */
	const namedSpecifiers: { span: Span; text: string; local: string | null }[] = [];
	for (const statement of body) {
		if (nodeType(statement) !== 'ImportDeclaration') continue;
		const node = objectNode(statement);
		if (objectNode(node?.['source'])?.['value'] !== NGRX_EFFECTS_MODULE) continue;
		for (const specifier of (node?.['specifiers'] as readonly unknown[]) ?? []) {
			if (nodeType(specifier) !== 'ImportSpecifier') continue;
			const span = spanOf(specifier);
			if (span === null) continue;
			namedSpecifiers.push({
				span,
				text: source.slice(span[0], span[1]),
				local: identifierName(objectNode(specifier)?.['local']),
			});
		}
	}
	if (namedSpecifiers.length === 0) {
		unhandled.push(
			`${path} imports ${REMOVED_EFFECT_DECORATOR} in a form this capability cannot rewrite ` +
				`into ${EFFECT_FACTORY}; its decorators were left in place`,
		);
		return unchanged(unhandled);
	}
	const kept = namedSpecifiers.filter((entry) => entry.local !== local).map((entry) => entry.text);
	if (factoryLocal === undefined) kept.push(EFFECT_FACTORY);
	const first = namedSpecifiers[0] as (typeof namedSpecifiers)[number];
	const last = namedSpecifiers[namedSpecifiers.length - 1] as (typeof namedSpecifiers)[number];
	edits.push({ start: first.span[0], end: last.span[1], text: kept.join(', ') });
	const ordered = [...edits].sort((left, right) => right.start - left.start || right.end - left.end);
	let migrated = source;
	for (const edit of ordered)
		migrated = `${migrated.slice(0, edit.start)}${edit.text}${migrated.slice(edit.end)}`;
	return Object.freeze({
		path,
		source: migrated,
		changed: migrated !== source,
		changes: Object.freeze(changes),
		unhandled: Object.freeze([...new Set(unhandled)].sort(compareStrings)),
	});
}
