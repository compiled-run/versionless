/**
 * RxJS 5 prototype patching, moved to `pipe`.
 *
 * RxJS 5 shipped `rxjs/add/operator/map` and its siblings: side-effect modules
 * that installed operators onto `Observable.prototype`, and `rxjs/add/observable/of`
 * and its siblings, which installed creation functions onto the class. RxJS 6
 * removed the modules and the patching together. Deleting the imports is a
 * specifier edit; the call sites they enabled are method calls, and moving those
 * is the whole of the work.
 *
 * The hard part is not the rewrite, it is knowing *which* `.map(` is an
 * observable's. `Object.keys(errors).map(key => …)` and
 * `this.canTranslate().map(value => !value)` are the same five characters, and
 * no reading of the syntax separates them. So this capability does not read the
 * syntax for that question: it takes the compiler's own diagnostics, each of
 * which names the file, the position, the property and the receiver's type, and
 * rewrites exactly the call sites the type checker says are the patched ones. A
 * position the diagnostics do not name is not touched, which is why an array's
 * `.map` survives untouched next to an observable's.
 *
 * Everything the rewrite emits is checked against the installed RxJS surface
 * before it is written. The operator an application called `.catch(…)` is named
 * `catchError` in the pipeable surface, and the four renames of that kind are
 * carried here — but the name that comes out of them is only used when the
 * installed package really exports it, and refused by name when it does not.
 *
 * Refusal is per module and total: a module with one diagnostic this capability
 * cannot place keeps every call site *and* its patch imports, because a module
 * that lost the patch import while keeping one patched call site would fail at
 * runtime instead of at build time.
 */

import { compareStrings } from './angular-target-cell.ts';
import {
	applySourceEdits,
	isFreeRootName,
	lineOf,
	parseModule,
	readModuleImports,
	type AstNode,
	type SemanticModule,
	type SourceEdit,
} from './semantic-module.ts';

const CAPABILITY = 'RxJS prototype patch migration';

/** The package root the patched class and the creation functions come from. */
export const RXJS_ROOT = 'rxjs';
/** The pipeable operator entry point RxJS 6 introduced and 7 still publishes. */
export const RXJS_OPERATORS = 'rxjs/operators';
/** The patch modules RxJS 6 removed, by specifier prefix. */
export const RXJS_PATCH_PREFIX = 'rxjs/add/';

/**
 * Instance operators whose pipeable name differs from the method name. Each of
 * the four was renamed because the method name is a reserved word or an
 * `Array.prototype` name that could not be exported as a free function; the
 * result is verified against the installed operator surface before it is used.
 */
export const OPERATOR_RENAMES: Readonly<Record<string, string>> = Object.freeze({
	catch: 'catchError',
	do: 'tap',
	finally: 'finalize',
	flatMap: 'mergeMap',
	switch: 'switchAll',
});

/** Creation methods whose free-function name differs from the static name. */
export const CREATION_RENAMES: Readonly<Record<string, string>> = Object.freeze({
	fromPromise: 'from',
	if: 'iif',
	throw: 'throwError',
});

/** The installed RxJS surface, read from the closure rather than remembered. */
export type RxjsSurfaceReading = Readonly<{
	version: string;
	/** Names the package root exports. */
	rootExports: readonly string[];
	/** Names the pipeable operator entry point exports. */
	operatorExports: readonly string[];
}>;

/**
 * One compiler diagnostic naming a patched call site: TypeScript's
 * `Property 'map' does not exist on type 'Observable<boolean>'`, decomposed.
 * `line` and `column` are the compiler's own 1-based pair, pointing at the
 * property name.
 */
export type PatchedCallDiagnostic = Readonly<{
	line: number;
	column: number;
	property: string;
	receiverType: string;
}>;

export type RxjsPipeChange = Readonly<{
	kind: 'pipe-operator' | 'creation-function' | 'patch-import';
	line: number;
	from: string;
	to: string;
}>;

export type RxjsPipeMigration = Readonly<{
	path: string;
	source: string;
	changed: boolean;
	changes: readonly RxjsPipeChange[];
	unhandled: readonly string[];
}>;

/** The 0-based offset of a compiler's 1-based line/column pair. */
export function offsetOf(source: string, line: number, column: number): number | null {
	const lines = source.split('\n');
	if (line < 1 || line > lines.length) return null;
	let offset = 0;
	for (let index = 0; index < line - 1; index += 1) offset += (lines[index] as string).length + 1;
	const text = lines[line - 1] as string;
	if (column < 1 || column > text.length + 1) return null;
	return offset + column - 1;
}

type Placement = Readonly<{
	member: AstNode;
	object: AstNode;
	call: AstNode;
	diagnostic: PatchedCallDiagnostic;
}>;

function placeDiagnostic(
	module: SemanticModule,
	source: string,
	diagnostic: PatchedCallDiagnostic,
): Placement | string {
	const offset = offsetOf(source, diagnostic.line, diagnostic.column);
	if (offset === null)
		return `line ${String(diagnostic.line)} column ${String(diagnostic.column)} is not a position in this file`;
	const members = module
		.findAll('MemberExpression')
		.filter((node) => node.property.start === offset);
	const member = members[0];
	if (member === undefined || members.length > 1)
		return (
			`line ${String(diagnostic.line)} column ${String(diagnostic.column)} is not the property of ` +
			`exactly one member expression, so the ${diagnostic.property} the compiler named cannot be placed`
		);
	if (member.computed || member.optional)
		return `line ${String(diagnostic.line)}: ${diagnostic.property} is reached through a computed or optional member access`;
	if (member.property.type !== 'Identifier' || member.property.name !== diagnostic.property)
		return `line ${String(diagnostic.line)}: the property at that position is not ${diagnostic.property}`;
	const call = module.parentOf(member);
	if (call === null || call.type !== 'CallExpression' || call.callee !== member)
		return `line ${String(diagnostic.line)}: ${diagnostic.property} is used as a value rather than called, and a value has no pipe to move into`;
	if (call.optional)
		return `line ${String(diagnostic.line)}: ${diagnostic.property} is called through optional chaining`;
	return Object.freeze({ member, object: member.object, call, diagnostic });
}

/** Whether the diagnostic's receiver is the class itself rather than an instance. */
function isStaticReceiver(receiverType: string): boolean {
	return receiverType.startsWith('typeof ');
}

type Insertion = Readonly<{ specifier: string; names: readonly string[] }>;

function importInsertion(
	source: string,
	module: SemanticModule,
	needed: ReadonlyMap<string, ReadonlySet<string>>,
): Readonly<{ edits: readonly SourceEdit[]; refusals: readonly string[] }> {
	const refusals: string[] = [];
	const insertions: Insertion[] = [];
	for (const [specifier, names] of needed) {
		const existing = readModuleImports(module, specifier);
		const missing: string[] = [];
		for (const name of [...names].sort(compareStrings)) {
			if (existing.named.has(name)) continue;
			if (!isFreeRootName(module, name)) {
				refusals.push(
					`the module already binds ${name} at its root scope, so importing the ${specifier} ` +
						'export of that name would shadow or collide with it',
				);
				continue;
			}
			missing.push(name);
		}
		if (missing.length > 0) insertions.push({ specifier, names: Object.freeze(missing) });
	}
	if (insertions.length === 0 || refusals.length > 0)
		return Object.freeze({ edits: Object.freeze([]), refusals: Object.freeze(refusals) });
	let anchor = 0;
	for (const statement of module.ast.body as readonly AstNode[])
		if (statement.type === 'ImportDeclaration') anchor = Math.max(anchor, statement.end);
	if (anchor > 0 && source[anchor] === ';') anchor += 1;
	const text = insertions
		.sort((left, right) => compareStrings(left.specifier, right.specifier))
		.map((entry) => `\nimport {${entry.names.join(', ')}} from '${entry.specifier}';`)
		.join('');
	return Object.freeze({
		edits: Object.freeze([{ start: anchor, end: anchor, text }]),
		refusals: Object.freeze([]),
	});
}

function refused(path: string, source: string, reasons: readonly string[]): RxjsPipeMigration {
	return Object.freeze({
		path,
		source,
		changed: false,
		changes: Object.freeze([]),
		unhandled: Object.freeze(
			[...new Set(reasons.map((reason) => `${path}: ${reason}`))].sort(compareStrings),
		),
	});
}

/**
 * Move one module's patched call sites to `pipe` and its patched creation calls
 * to free functions, and drop the `rxjs/add/**` imports once every call site the
 * compiler named in this module has moved.
 */
export function migrateRxjsPrototypePatches(
	path: string,
	source: string,
	diagnostics: readonly PatchedCallDiagnostic[],
	reading: RxjsSurfaceReading,
): RxjsPipeMigration {
	const module = parseModule(CAPABILITY, path, source);
	const rootImports = readModuleImports(module, RXJS_ROOT);
	const refusals: string[] = [];
	const edits: SourceEdit[] = [];
	const changes: RxjsPipeChange[] = [];
	const needed = new Map<string, Set<string>>();
	const require = (specifier: string, name: string): void => {
		const set = needed.get(specifier) ?? new Set<string>();
		set.add(name);
		needed.set(specifier, set);
	};
	for (const diagnostic of diagnostics) {
		const placement = placeDiagnostic(module, source, diagnostic);
		if (typeof placement === 'string') {
			refusals.push(placement);
			continue;
		}
		const { member, object, call } = placement;
		const line = lineOf(source, member.start);
		if (isStaticReceiver(diagnostic.receiverType)) {
			if (object.type !== 'Identifier') {
				refusals.push(
					`line ${String(line)}: the static ${diagnostic.property} is reached through an ` +
						'expression rather than a named import, so the class it patches is not resolved',
				);
				continue;
			}
			const symbol = module.symbolOf(object);
			const imported =
				symbol !== null &&
				[...rootImports.named.values()].some((candidate) => candidate === symbol);
			if (!imported) {
				refusals.push(
					`line ${String(line)}: ${object.name} is not a named import of '${RXJS_ROOT}', so ` +
						`${diagnostic.property} is not a creation function this capability can place`,
				);
				continue;
			}
			const name = CREATION_RENAMES[diagnostic.property] ?? diagnostic.property;
			if (!reading.rootExports.includes(name)) {
				refusals.push(
					`line ${String(line)}: rxjs@${reading.version} does not export ${name}, the free ` +
						`function the static ${diagnostic.property} would move to`,
				);
				continue;
			}
			edits.push({ start: member.start, end: member.end, text: name });
			changes.push({
				kind: 'creation-function',
				line,
				from: source.slice(member.start, member.end),
				to: name,
			});
			require(RXJS_ROOT, name);
			continue;
		}
		const name = OPERATOR_RENAMES[diagnostic.property] ?? diagnostic.property;
		if (!reading.operatorExports.includes(name)) {
			refusals.push(
				`line ${String(line)}: rxjs@${reading.version} does not export ${name} from ` +
					`'${RXJS_OPERATORS}', so the ${diagnostic.property} call site has nowhere to move to`,
			);
			continue;
		}
		const open = source.indexOf('(', member.end);
		if (open < 0 || open >= call.end || source[call.end - 1] !== ')') {
			refusals.push(
				`line ${String(line)}: the ${diagnostic.property} call's own parentheses were not found, ` +
					'so the pipe it moves into cannot be closed',
			);
			continue;
		}
		edits.push({ start: object.end, end: open + 1, text: `.pipe(${name}(` });
		edits.push({ start: call.end - 1, end: call.end - 1, text: ')' });
		changes.push({
			kind: 'pipe-operator',
			line,
			from: `.${diagnostic.property}(…)`,
			to: `.pipe(${name}(…))`,
		});
		require(RXJS_OPERATORS, name);
	}
	if (refusals.length > 0) return refused(path, source, refusals);
	for (const statement of module.ast.body as readonly AstNode[]) {
		if (statement.type !== 'ImportDeclaration') continue;
		if (statement.specifiers.length > 0) continue;
		const specifier = statement.source.value;
		if (typeof specifier !== 'string' || !specifier.startsWith(RXJS_PATCH_PREFIX)) continue;
		let end = statement.end;
		if (source[end] === ';') end += 1;
		if (source[end] === '\r') end += 1;
		if (source[end] === '\n') end += 1;
		edits.push({ start: statement.start, end, text: '' });
		changes.push({
			kind: 'patch-import',
			line: lineOf(source, statement.start),
			from: specifier,
			to: '',
		});
	}
	if (edits.length === 0)
		return Object.freeze({
			path,
			source,
			changed: false,
			changes: Object.freeze([]),
			unhandled: Object.freeze([]),
		});
	const inserted = importInsertion(source, module, needed);
	if (inserted.refusals.length > 0) return refused(path, source, inserted.refusals);
	const migrated = applySourceEdits(source, [...edits, ...inserted.edits]);
	return Object.freeze({
		path,
		source: migrated,
		changed: migrated !== source,
		changes: Object.freeze(changes),
		unhandled: Object.freeze([]),
	});
}
