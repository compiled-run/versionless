/**
 * A `new Promise(…)` written with no type argument, whose executor settles it
 * with nothing.
 *
 * `TS2794: Expected 1 arguments, but got 0. Did you forget to include 'void' in
 * your type argument to 'Promise'?` is the only diagnostic in the TypeScript
 * catalogue that names its own successor, and this capability is written to that
 * fact. Before TypeScript 4.1 the promise executor's resolve parameter was
 * declared `(value?: T | PromiseLike<T>) => void`, so `resolve()` type-checked at
 * every `T`; from 4.1 the parameter is optional only when `T` admits `undefined`.
 * An un-parameterised `new Promise(…)` infers `T = unknown`, `unknown` does not
 * admit an absent argument, and a line the application never touched becomes an
 * error. Writing `void` where the compiler names it says what the executor
 * already does: this promise settles with nothing.
 *
 * The claim is narrow and the refusals keep it there, because `void` is a
 * statement about the promise's *whole* settled type and the evidence for it is
 * local. Every reference to the resolve parameter has to be the callee of a call
 * — a resolve handed to `.then`, stored, or returned escapes the executor and
 * what it will eventually be called with cannot be read here — and every one of
 * those calls has to pass no argument. One `resolve(value)` anywhere in the body
 * and the promise settles with something, `void` is the wrong type argument, and
 * the whole executor is left as it is. `Promise` itself has to be free in the
 * module's root scope, or the constructor is not the one the diagnostic is about.
 *
 * The rewrite is an insertion of six characters and touches nothing else: not the
 * executor, not the call, not the parameter list. A capability that answered this
 * by writing `resolve(undefined)` would change the same number of characters and
 * leave the promise typed `Promise<unknown>`, which is the era's accident rather
 * than the application's intent.
 */

import { compareStrings } from './angular-target-cell.ts';
import {
	applySourceEdits,
	forEachNode,
	isFreeRootName,
	lineOf,
	parseModule,
	type AstNode,
	type SourceEdit,
} from './semantic-module.ts';

const CAPABILITY = 'Promise executor void parameter';

export type VoidExecutorChange = Readonly<{
	kind: 'promise-executor-void-parameter';
	line: number;
	/** The name the executor gave its first parameter, for the record. */
	parameter: string;
	/** How many zero-argument calls of that parameter the executor body makes. */
	callSites: number;
}>;

export type VoidExecutorMigration = Readonly<{
	path: string;
	source: string;
	changed: boolean;
	changes: readonly VoidExecutorChange[];
	unhandled: readonly string[];
}>;

/** Every identifier node in a module that resolves to `local`. */
function referencesTo(module: ReturnType<typeof parseModule>, local: unknown): readonly AstNode[] {
	const found: AstNode[] = [];
	forEachNode(module.ast, (node) => {
		if (node.type !== 'Identifier') return;
		if (module.symbolOf(node) !== local) return;
		found.push(node);
	});
	return Object.freeze(found);
}

/**
 * Write `void` as the type argument of every un-parameterised `new Promise`
 * whose executor is proven to settle it with nothing.
 */
export function parameteriseVoidPromiseExecutors(
	path: string,
	source: string,
): VoidExecutorMigration {
	const module = parseModule(CAPABILITY, path, source);
	const edits: SourceEdit[] = [];
	const changes: VoidExecutorChange[] = [];
	const unhandled: string[] = [];
	const promiseIsFree = isFreeRootName(module, 'Promise');

	forEachNode(module.ast, (node) => {
		if (node.type !== 'NewExpression') return;
		const callee: AstNode | null = node.callee;
		if (callee === null || callee.type !== 'Identifier' || callee.name !== 'Promise') return;
		// An explicit type argument is the application's own decision; there is
		// nothing here to infer and nothing to answer.
		if (node.typeArguments !== null && node.typeArguments !== undefined) return;
		const args: readonly AstNode[] = node.arguments;
		if (args.length !== 1) return;
		const executor = args[0];
		// Only an inline executor can be read: a function named elsewhere would
		// have its resolve calls diagnosed at its own declaration, not here.
		if (executor === undefined) return;
		if (executor.type !== 'ArrowFunctionExpression' && executor.type !== 'FunctionExpression')
			return;
		const resolve: AstNode | undefined = executor.params[0];
		if (resolve === undefined || resolve.type !== 'Identifier') return;
		const symbol = module.symbolOf(resolve);
		if (symbol === null || symbol === undefined) return;

		const uses = referencesTo(module, symbol).filter((use) => use !== resolve);
		const zeroArgumentCalls = uses.filter((use) => {
			const parent = module.parentOf(use);
			return (
				parent !== null &&
				parent.type === 'CallExpression' &&
				parent.callee === use &&
				parent.arguments.length === 0
			);
		});
		// No zero-argument settle means no TS2794 to answer, whatever else the
		// executor does. Silence here is the capability not having business.
		if (zeroArgumentCalls.length === 0) return;

		const line = lineOf(source, node.start);
		const at = `${path} line ${String(line)}`;
		const name = typeof resolve.name === 'string' ? resolve.name : 'the first parameter';
		if (!promiseIsFree) {
			unhandled.push(
				`${at}: this module's root scope binds the name Promise, so \`new Promise\` does not ` +
					'name the global constructor the diagnostic is written about',
			);
			return;
		}
		let refusal: string | null = null;
		for (const use of uses) {
			const parent = module.parentOf(use);
			if (parent === null || parent.type !== 'CallExpression' || parent.callee !== use) {
				refusal =
					`${name} is referenced at line ${String(lineOf(source, use.start))} other than as the ` +
					'callee of a call, so it escapes this executor and what the promise eventually ' +
					'settles with cannot be read here';
				break;
			}
			if (parent.arguments.length !== 0) {
				refusal =
					`${name} is called at line ${String(lineOf(source, use.start))} with ` +
					`${String(parent.arguments.length)} argument(s), so this promise settles with a value ` +
					'and void is the wrong type argument for it';
				break;
			}
		}
		if (refusal !== null) {
			unhandled.push(`${at}: ${refusal}. The executor was left exactly as it is.`);
			return;
		}
		edits.push({ start: callee.end, end: callee.end, text: '<void>' });
		changes.push({
			kind: 'promise-executor-void-parameter',
			line,
			parameter: name,
			callSites: zeroArgumentCalls.length,
		});
	});

	const migrated = applySourceEdits(source, edits);
	return Object.freeze({
		path,
		source: migrated,
		changed: migrated !== source,
		changes: Object.freeze([...changes].sort((left, right) => left.line - right.line)),
		unhandled: Object.freeze([...new Set(unhandled)].sort(compareStrings)),
	});
}
