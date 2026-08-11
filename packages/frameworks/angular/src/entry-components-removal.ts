/**
 * `entryComponents` in an `@NgModule` literal.
 *
 * Before Ivy, a component created dynamically rather than named in a template
 * had to be listed in `entryComponents` or the View Engine compiler emitted no
 * factory for it. Ivy generates a definition for every declared component, the
 * concept became meaningless in Angular 9, and Angular 13 removed the property
 * from the `NgModule` type — so a literal that still carries it fails to
 * type-check against `NgModule`.
 *
 * The property has no successor. There is nowhere to move the list to, and the
 * only correct edit is to drop it. That makes the interesting question not
 * *how* to rewrite but *whether* the drop is safe, and this capability answers
 * it before it edits: every component the list names must be reachable from the
 * same module literal without it — declared in `declarations`, or bootstrapped
 * in `bootstrap`. Both are resolved as bindings, so a name that happens to
 * repeat in an unrelated array does not count and an aliased import does.
 *
 * A component named only by `entryComponents` is refused by name. Dropping the
 * property there would be the one case where the removal is not an equivalence:
 * the module would compile and the component would not be part of it. Refusal
 * is per module literal and total.
 *
 * Nothing here is application specific. A literal with no `entryComponents` is
 * reported unchanged, which is what every post-Ivy module produces.
 */

import { compareStrings } from './angular-target-cell.ts';
import {
	applySourceEdits,
	denotesExport,
	forEachNode,
	lineOf,
	parseModule,
	plainProperties,
	readModuleImports,
	type AstNode,
	type SemanticModule,
	type SourceEdit,
} from './semantic-module.ts';

const CAPABILITY = 'Entry components removal';

/** The package that publishes the decorator, and the property Angular removed. */
export const NG_MODULE_PACKAGE = '@angular/core';
export const NG_MODULE_DECORATOR = 'NgModule';
export const REMOVED_PROPERTY = 'entryComponents';

/** The properties whose members Angular reaches without an entry-component list. */
export const REACHING_PROPERTIES: readonly string[] = Object.freeze(['declarations', 'bootstrap']);

export type EntryComponentsChange = Readonly<{
	kind: 'entry-components-removal';
	line: number;
	symbols: readonly string[];
}>;

export type EntryComponentsMigration = Readonly<{
	path: string;
	source: string;
	changed: boolean;
	changes: readonly EntryComponentsChange[];
	unhandled: readonly string[];
}>;

/**
 * The bindings an array-literal property of the module names, or null when the
 * property is present but is not a plain array of resolvable identifiers.
 */
function bindingsOf(module: SemanticModule, value: AstNode): ReadonlySet<unknown> | null {
	if (value.type !== 'ArrayExpression') return null;
	const symbols = new Set<unknown>();
	for (const element of value.elements) {
		if (element === null) continue;
		if (element.type !== 'Identifier') return null;
		const symbol = module.symbolOf(element);
		if (symbol === null) return null;
		symbols.add(symbol);
	}
	return symbols;
}

/**
 * The span to delete for one property of an object literal, including the
 * separator that would otherwise be left dangling.
 *
 * A property that owns its line is removed with the line, so the literal keeps
 * the shape it had. A property sharing a line with others loses only itself and
 * one separator.
 */
function removalSpan(source: string, property: AstNode): SourceEdit {
	let start = property.start;
	while (start > 0) {
		const previous = source[start - 1];
		if (previous !== ' ' && previous !== '\t') break;
		start -= 1;
	}
	let end = property.end;
	while (end < source.length && (source[end] === ' ' || source[end] === '\t')) end += 1;
	let separated = false;
	if (source[end] === ',') {
		end += 1;
		separated = true;
	}
	if (!separated) {
		// Last property in the literal: the separator to absorb is the one before it.
		let back = start;
		while (back > 0 && /\s/u.test(source[back - 1] ?? '')) back -= 1;
		if (source[back - 1] === ',') start = back - 1;
		return Object.freeze({ start, end, text: '' });
	}
	let after = end;
	while (after < source.length && (source[after] === ' ' || source[after] === '\t')) after += 1;
	if (source[after] === '\n' && (start === 0 || source[start - 1] === '\n'))
		return Object.freeze({ start, end: after + 1, text: '' });
	return Object.freeze({ start, end, text: '' });
}

/**
 * Drop `entryComponents` from every `@NgModule` literal in the module whose
 * components the same literal already reaches.
 */
export function removeEntryComponents(path: string, source: string): EntryComponentsMigration {
	const module = parseModule(CAPABILITY, path, source);
	const core = readModuleImports(module, NG_MODULE_PACKAGE);
	const edits: SourceEdit[] = [];
	const changes: EntryComponentsChange[] = [];
	const unhandled: string[] = [];
	if (!core.present)
		return Object.freeze({
			path,
			source,
			changed: false,
			changes: Object.freeze([]),
			unhandled: Object.freeze([]),
		});
	forEachNode(module.ast, (node) => {
		if (node.type !== 'Decorator') return;
		const call = node.expression;
		if (call.type !== 'CallExpression') return;
		if (!denotesExport(module, call.callee, core, NG_MODULE_DECORATOR)) return;
		const literal = call.arguments[0];
		if (literal === undefined || literal.type !== 'ObjectExpression') return;
		const line = lineOf(source, node.start);
		const properties = plainProperties(literal);
		if (properties === null) {
			unhandled.push(
				`${path} line ${String(line)}: the @${NG_MODULE_DECORATOR} literal carries a spread, a ` +
					'computed key or an accessor, so what it does and does not declare cannot be read ' +
					'from it, and it was left exactly as it is',
			);
			return;
		}
		const removed = properties.find((property) => property.name === REMOVED_PROPERTY);
		if (removed === undefined) return;
		const listed = bindingsOf(module, removed.value);
		if (listed === null) {
			unhandled.push(
				`${path} line ${String(line)}: ${REMOVED_PROPERTY} is not a plain array of resolvable ` +
					'identifiers, so which components it names cannot be read, and the property was left ' +
					'exactly as it is',
			);
			return;
		}
		const reaching = new Set<unknown>();
		for (const name of REACHING_PROPERTIES) {
			const property = properties.find((candidate) => candidate.name === name);
			if (property === undefined) continue;
			const bindings = bindingsOf(module, property.value);
			if (bindings === null) {
				unhandled.push(
					`${path} line ${String(line)}: ${name} is not a plain array of resolvable identifiers, ` +
						`so it cannot be used to prove that a ${REMOVED_PROPERTY} entry stays reachable, and ` +
						'the property was left exactly as it is',
				);
				return;
			}
			for (const binding of bindings) reaching.add(binding);
		}
		const names: string[] = [];
		const stranded: string[] = [];
		if (removed.value.type === 'ArrayExpression')
			for (const element of removed.value.elements) {
				if (element === null || element.type !== 'Identifier') continue;
				names.push(element.name);
				if (!reaching.has(module.symbolOf(element))) stranded.push(element.name);
			}
		if (stranded.length > 0) {
			unhandled.push(
				`${path} line ${String(line)}: ${stranded.sort(compareStrings).join(', ')} ` +
					`${stranded.length === 1 ? 'is named' : 'are named'} by ${REMOVED_PROPERTY} and by ` +
					`neither ${REACHING_PROPERTIES.join(' nor ')} of the same module. Dropping the ` +
					'property would remove them from the module rather than leave them where Ivy ' +
					'already reaches them, so it was left exactly as it is.',
			);
			return;
		}
		edits.push(removalSpan(source, removed.node));
		changes.push({
			kind: 'entry-components-removal',
			line: lineOf(source, removed.node.start),
			symbols: Object.freeze([...names].sort(compareStrings)),
		});
	});
	const migrated = applySourceEdits(source, edits);
	return Object.freeze({
		path,
		source: migrated,
		changed: migrated !== source,
		changes: Object.freeze(changes),
		unhandled: Object.freeze([...new Set(unhandled)].sort(compareStrings)),
	});
}
