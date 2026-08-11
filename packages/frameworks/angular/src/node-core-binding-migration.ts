/**
 * Node core-module bindings reached from browser code.
 *
 * A bundler that shimmed Node's core modules for the browser made
 * `import { isNullOrUndefined } from 'util'` work in an application that never
 * runs on Node. A bundler that does not shim them reports the specifier as
 * unresolvable, and the honest answer is not to put the shim back: the bindings
 * this family of imports actually reaches are language-level questions with
 * exact ECMAScript spellings, and an application asking `x == null` should say
 * so rather than pull a Node polyfill into a browser bundle to ask it.
 *
 * So this capability moves the call sites and deletes the import. Two rules keep
 * it honest:
 *
 * - **Every expansion evaluates its argument exactly once.** Each expansion is a
 *   template that mentions each argument one time, so no rewrite can turn one
 *   evaluation of `this.current()` into two. An expansion that would need its
 *   argument twice is not in the table, whatever its Node semantics are.
 * - **All-or-nothing per module.** A module whose every reference to every
 *   binding it imports from the core module is a direct call this table expands
 *   is rewritten and loses the import. A module with one reference the table
 *   cannot expand — a binding passed as a value, called with the wrong arity,
 *   called with a spread — keeps the import and every call site, and the reason
 *   is reported by name. Half of this rewrite is worse than none of it.
 *
 * `util.format` is the one binding with no operator spelling, and it is handled
 * as a directive expansion rather than dropped: a literal format string whose
 * directives are all `%s`, with exactly as many arguments as directives, becomes
 * a template literal. Every other directive is refused. The one divergence that
 * survives — Node inspects an object argument that has no user-defined
 * `toString` where `String()` calls the built-in one — is declared per call site
 * rather than buried, because no reading of the source can rule it out.
 */

import { compareStrings } from './angular-target-cell.ts';
import {
	applySourceEdits,
	lineOf,
	parseModule,
	readModuleImports,
	type AstNode,
	type SemanticModule,
	type SourceEdit,
} from './semantic-module.ts';

const CAPABILITY = 'Node core binding migration';

/**
 * The expansion of one core-module binding: an expression template whose `$0`
 * is replaced by the call's single argument, exactly once.
 *
 * Every entry is Node's own documented definition of the function written in the
 * language: `util.isString(x)` *is* `typeof x === 'string'`, and the rewrite
 * claims nothing beyond that identity. Node's legacy type checks that need their
 * argument twice — `isObject`, which is `typeof x === 'object' && x !== null` —
 * are deliberately absent.
 */
export type BindingExpansion = Readonly<{ arity: number; template: string }>;

export const NODE_CORE_BINDING_EXPANSIONS: Readonly<
	Record<string, Readonly<Record<string, BindingExpansion>>>
> = Object.freeze({
	util: Object.freeze({
		isArray: Object.freeze({ arity: 1, template: 'Array.isArray($0)' }),
		isBoolean: Object.freeze({ arity: 1, template: "(typeof $0 === 'boolean')" }),
		isFunction: Object.freeze({ arity: 1, template: "(typeof $0 === 'function')" }),
		isNull: Object.freeze({ arity: 1, template: '($0 === null)' }),
		isNullOrUndefined: Object.freeze({ arity: 1, template: '($0 == null)' }),
		isNumber: Object.freeze({ arity: 1, template: "(typeof $0 === 'number')" }),
		isString: Object.freeze({ arity: 1, template: "(typeof $0 === 'string')" }),
		isSymbol: Object.freeze({ arity: 1, template: "(typeof $0 === 'symbol')" }),
		isUndefined: Object.freeze({ arity: 1, template: '($0 === undefined)' }),
	}),
});

/** Bindings expanded by a directive reading rather than by a template. */
export const NODE_CORE_FORMAT_BINDINGS: Readonly<Record<string, string>> = Object.freeze({
	util: 'format',
});

export type CoreBindingChange = Readonly<{
	kind: 'core-binding-call' | 'core-binding-import';
	line: number;
	from: string;
	to: string;
}>;

export type CoreBindingMigration = Readonly<{
	path: string;
	source: string;
	changed: boolean;
	changes: readonly CoreBindingChange[];
	declaredDifferences: readonly string[];
	unhandled: readonly string[];
}>;

/**
 * Argument text, parenthesised unless the argument is already a single
 * expression no operator can split. `typeof x => x === 'string'` is what a
 * naive substitution produces, and it does not parse.
 */
const SELF_CONTAINED: readonly string[] = Object.freeze([
	'ArrayExpression',
	'CallExpression',
	'Identifier',
	'Literal',
	'MemberExpression',
	'NewExpression',
	'ObjectExpression',
	'ParenthesizedExpression',
	'TemplateLiteral',
	'ThisExpression',
]);

function argumentText(source: string, node: AstNode): string {
	const text = source.slice(node.start, node.end);
	return SELF_CONTAINED.includes(node.type) ? text : `(${text})`;
}

/** The `%s`-only reading of a format string, or null when a directive is not one. */
export function readFormatDirectives(literal: string): readonly string[] | null {
	const pieces: string[] = [];
	let current = '';
	let index = 0;
	while (index < literal.length) {
		const character = literal[index] as string;
		if (character !== '%') {
			current += character;
			index += 1;
			continue;
		}
		const next = literal[index + 1];
		if (next === '%') {
			current += '%';
			index += 2;
			continue;
		}
		if (next === 's') {
			pieces.push(current);
			current = '';
			index += 2;
			continue;
		}
		if (next === undefined) {
			current += '%';
			index += 1;
			continue;
		}
		return null;
	}
	pieces.push(current);
	return Object.freeze(pieces);
}

/** A literal chunk written back as template-literal text. */
function templateChunk(text: string): string {
	let out = '';
	for (const character of text) {
		if (character === '\\') out += '\\\\';
		else if (character === '`') out += '\\`';
		else if (character === '$') out += '\\$';
		else if (character === '\n') out += '\\n';
		else if (character === '\r') out += '\\r';
		else if (character === '\t') out += '\\t';
		else out += character;
	}
	return out;
}

type CallSite = Readonly<{ call: AstNode; binding: string }>;

function callSiteOf(module: SemanticModule, node: AstNode): AstNode | null {
	const parent = module.parentOf(node);
	if (parent === null || parent.type !== 'CallExpression') return null;
	return parent.callee === node ? parent : null;
}

function refuse(
	path: string,
	source: string,
	unhandled: readonly string[],
): CoreBindingMigration {
	return Object.freeze({
		path,
		source,
		changed: false,
		changes: Object.freeze([]),
		declaredDifferences: Object.freeze([]),
		unhandled: Object.freeze([...new Set(unhandled)].sort(compareStrings)),
	});
}

/**
 * Move one module's calls of a Node core module's bindings onto the language and
 * remove the import, or refuse the module and say why.
 */
export function migrateNodeCoreBindings(
	path: string,
	source: string,
	specifier: string,
): CoreBindingMigration {
	const expansions = NODE_CORE_BINDING_EXPANSIONS[specifier] ?? {};
	const formatBinding = NODE_CORE_FORMAT_BINDINGS[specifier] ?? null;
	const module = parseModule(CAPABILITY, path, source);
	const imports = readModuleImports(module, specifier);
	if (!imports.present) return refuse(path, source, []);
	if (imports.wide)
		return refuse(path, source, [
			`${path}: the import of '${specifier}' carries a default or namespace binding, whose ` +
				'members are reached through a value rather than by name, so no call site of it can be ' +
				'resolved and the module was left exactly as it is',
		]);
	const sites: CallSite[] = [];
	const refusals: string[] = [];
	for (const [name, local] of imports.named) {
		const known = expansions[name] !== undefined || name === formatBinding;
		if (!known) {
			refusals.push(
				`${path}: '${specifier}' export ${name} has no expression spelling this capability ` +
					'carries, so the module keeps the import and every call site of it',
			);
			continue;
		}
		for (const reference of local.references) {
			const node = reference.node as AstNode;
			const call = callSiteOf(module, node);
			if (call === null) {
				refusals.push(
					`${path} line ${String(lineOf(source, node.start))}: ${name} is used as a value rather ` +
						'than called directly, and a value has no call site to expand',
				);
				continue;
			}
			sites.push({ call, binding: name });
		}
	}
	if (refusals.length > 0) return refuse(path, source, refusals);
	const edits: SourceEdit[] = [];
	const changes: CoreBindingChange[] = [];
	const declaredDifferences: string[] = [];
	for (const site of sites) {
		const call = site.call;
		if (call.type !== 'CallExpression') continue;
		const line = lineOf(source, call.start);
		const args = call.arguments as readonly AstNode[];
		if (args.some((argument) => argument.type === 'SpreadElement')) {
			refusals.push(
				`${path} line ${String(line)}: ${site.binding} is called with a spread argument, whose ` +
					'arity is not known before it runs',
			);
			continue;
		}
		const expansion = expansions[site.binding];
		if (expansion !== undefined) {
			if (args.length !== expansion.arity) {
				refusals.push(
					`${path} line ${String(line)}: ${site.binding} is called with ${String(args.length)} ` +
						`arguments where its expansion takes ${String(expansion.arity)}`,
				);
				continue;
			}
			const argument = args[0] as AstNode;
			const text = expansion.template.split('$0').join(argumentText(source, argument));
			edits.push({ start: call.start, end: call.end, text });
			changes.push({
				kind: 'core-binding-call',
				line,
				from: source.slice(call.start, call.end),
				to: text,
			});
			continue;
		}
		const first = args[0];
		if (first === undefined || first.type !== 'Literal' || typeof first.value !== 'string') {
			refusals.push(
				`${path} line ${String(line)}: ${site.binding} is called with a format string this ` +
					'capability cannot read at rest, so the directives it carries are unknown',
			);
			continue;
		}
		const pieces = readFormatDirectives(first.value);
		if (pieces === null) {
			refusals.push(
				`${path} line ${String(line)}: the format string carries a directive other than %s, ` +
					'whose formatting is not a template-literal interpolation',
			);
			continue;
		}
		const rest = args.slice(1);
		if (rest.length !== pieces.length - 1) {
			refusals.push(
				`${path} line ${String(line)}: the format string carries ` +
					`${String(pieces.length - 1)} %s directives and the call passes ` +
					`${String(rest.length)} arguments; Node's own handling of the mismatch is not a ` +
					'template literal',
			);
			continue;
		}
		let text = '`';
		for (const [index, piece] of pieces.entries()) {
			text += templateChunk(piece);
			const argument = rest[index];
			if (argument !== undefined) text += `\${String(${source.slice(argument.start, argument.end)})}`;
		}
		text += '`';
		edits.push({ start: call.start, end: call.end, text });
		changes.push({
			kind: 'core-binding-call',
			line,
			from: source.slice(call.start, call.end),
			to: text,
		});
		if (rest.length > 0)
			declaredDifferences.push(
				`${path} line ${String(line)}: ${String(rest.length)} %s directive(s) became ` +
					'`${String(…)}`. That is what Node formats for every primitive and for every object ' +
					'with a `toString` of its own; an argument that is a plain object or an array at ' +
					'runtime was inspected before and is stringified now. Nothing in this module says ' +
					'which of those it is, so the difference is declared rather than claimed away.',
			);
	}
	if (refusals.length > 0) return refuse(path, source, refusals);
	for (const declaration of imports.declarations) {
		let end = declaration.end;
		if (source[end] === ';') end += 1;
		if (source[end] === '\r') end += 1;
		if (source[end] === '\n') end += 1;
		edits.push({ start: declaration.start, end, text: '' });
		changes.push({
			kind: 'core-binding-import',
			line: lineOf(source, declaration.start),
			from: source.slice(declaration.start, declaration.end),
			to: '',
		});
	}
	const migrated = applySourceEdits(source, edits);
	return Object.freeze({
		path,
		source: migrated,
		changed: migrated !== source,
		changes: Object.freeze(changes),
		declaredDifferences: Object.freeze(declaredDifferences),
		unhandled: Object.freeze([]),
	});
}
