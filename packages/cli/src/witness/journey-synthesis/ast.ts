/**
 * The parsing the two spec readers share.
 *
 * Both readers face the same problem: a spec file is a program, not a data
 * file, and the parts of it a journey can replay are call chains buried inside
 * nested callbacks. So both parse the real syntax rather than matching text —
 * a regular expression over `cy.visit` finds the one inside a comment and
 * misses the one inside a `.then()` — and both need the same four things from
 * the tree: the chain a call belongs to, the static string an argument is (or
 * is not), the line a node sits on, and the block structure the suite is
 * written in.
 *
 * Nothing in this module knows about Cypress or Playwright. It answers
 * syntactic questions; the readers decide what the answers mean.
 */

import { analyze } from 'yuku-analyzer';

export type Node = Record<string, unknown> & { type: string; start: number; end: number };

export function isNode(value: unknown): value is Node {
	return (
		value !== null &&
		typeof value === 'object' &&
		typeof (value as { type?: unknown }).type === 'string'
	);
}

/** Parse a spec. A file the parser refuses is the caller's problem to record. */
export function parseSpec(source: string, path: string): Node {
	return analyze(source, { path }).ast as unknown as Node;
}

/** Collapse every whitespace run to one space, so a construct reads on one line. */
export function collapseWhitespace(value: string): string {
	const parts: string[] = [];
	let current = '';
	for (const character of value) {
		const white =
			character === ' ' ||
			character === '\t' ||
			character === '\n' ||
			character === '\r' ||
			character === '\f' ||
			character === '\v';
		if (white) {
			if (current !== '') parts.push(current);
			current = '';
			continue;
		}
		current += character;
	}
	if (current !== '') parts.push(current);
	return parts.join(' ');
}

export function lineOf(source: string, offset: number): number {
	let line = 1;
	for (let index = 0; index < offset && index < source.length; index += 1)
		if (source[index] === '\n') line += 1;
	return line;
}

/** The source form of a node, on one line and bounded, for an unhandled note. */
export function sourceForm(node: Node | undefined, source: string, limit = 160): string {
	if (node === undefined) return '';
	const text = collapseWhitespace(source.slice(node.start, node.end));
	return text.length <= limit ? text : `${text.slice(0, limit)}…`;
}

/**
 * The string a node IS, or `null` when it is a string the program computes.
 *
 * A template literal with no expressions is a static string and is read as one.
 * A template literal with an expression is not, and returning `null` for it is
 * what makes an interpolated route a recorded unhandled construct instead of a
 * guess.
 */
export function staticString(node: Node | undefined, mustBeString = true): string | null {
	if (node === undefined) return null;
	if (node.type === 'Literal') {
		const value = node.value;
		if (typeof value === 'string') return value;
		return mustBeString ? null : String(value);
	}
	if (node.type === 'TemplateLiteral') {
		const expressions = (node.expressions ?? []) as Node[];
		if (expressions.length > 0) return null;
		const quasis = (node.quasis ?? []) as Node[];
		return quasis
			.map((quasi) => (quasi.value as { cooked?: string } | undefined)?.cooked ?? '')
			.join('');
	}
	return null;
}

export type ChainLink = Readonly<{
	name: string;
	args: readonly Node[];
	node: Node;
}>;

export type CallChain = Readonly<{
	/** The identifier the chain hangs off (`cy`, `page`), when there is one. */
	rootIdentifier: string | null;
	links: readonly ChainLink[];
	node: Node;
}>;

/**
 * Decompose a call expression into the chain it terminates.
 *
 * `cy.get('[data-test=x]').should('be.visible').click()` is one chain rooted at
 * `cy` with three links, and reading it as three unrelated calls loses the fact
 * that the click and the selector are the same gesture.
 */
export function callChain(node: Node): CallChain | null {
	if (node.type !== 'CallExpression') return null;
	const links: ChainLink[] = [];
	let current: Node | undefined = node;
	let rootIdentifier: string | null = null;
	while (current !== undefined && current.type === 'CallExpression') {
		const callee = current.callee as Node | undefined;
		const args = ((current.arguments ?? []) as Node[]).filter(isNode);
		if (callee === undefined) return null;
		if (callee.type === 'Identifier') {
			links.unshift({ name: callee.name as string, args, node: current });
			current = undefined;
			break;
		}
		if (callee.type === 'MemberExpression' && callee.computed !== true) {
			const property = callee.property as Node | undefined;
			if (property === undefined || property.type !== 'Identifier') return null;
			links.unshift({ name: property.name as string, args, node: current });
			current = callee.object as Node | undefined;
			continue;
		}
		return null;
	}
	if (current !== undefined) {
		if (current.type !== 'Identifier') return null;
		rootIdentifier = current.name as string;
	}
	if (links.length === 0) return null;
	return Object.freeze({ rootIdentifier, links: Object.freeze(links), node });
}

/**
 * Every outermost call chain below a node, in source order.
 *
 * "Outermost" is what keeps `cy.get(...).click()` from also being read as the
 * inner `cy.get(...)`: an inner link is skipped, while a call inside an
 * ARGUMENT — the body of a `.then()` — is visited, because that is where the
 * rest of a Cypress spec lives.
 */
export function callChainsBelow(root: Node): readonly CallChain[] {
	const chains: CallChain[] = [];
	const walk = (node: Node, parent: Node | null): void => {
		const innerLink =
			parent !== null && parent.type === 'MemberExpression' && parent.object === node;
		if (node.type === 'CallExpression' && !innerLink) {
			const chain = callChain(node);
			if (chain !== null) chains.push(chain);
		}
		for (const key of Object.keys(node)) {
			if (key === 'type' || key === 'start' || key === 'end') continue;
			const value = node[key];
			if (Array.isArray(value)) {
				for (const item of value) if (isNode(item)) walk(item, node);
				continue;
			}
			if (isNode(value)) walk(value, node);
		}
	};
	walk(root, null);
	return Object.freeze(chains.sort((left, right) => left.node.start - right.node.start));
}

/** The function a suite call was handed, or `undefined` when it was handed none. */
export function callbackOf(args: readonly Node[]): Node | undefined {
	for (let index = args.length - 1; index >= 0; index -= 1) {
		const arg = args[index] as Node;
		if (arg.type === 'FunctionExpression' || arg.type === 'ArrowFunctionExpression') return arg;
	}
	return undefined;
}

/** The statements a function body holds. An expression-bodied arrow has one. */
export function bodyStatements(fn: Node | undefined): readonly Node[] {
	if (fn === undefined) return [];
	const body = fn.body as Node | undefined;
	if (body === undefined) return [];
	if (body.type !== 'BlockStatement') return [body];
	return ((body.body ?? []) as Node[]).filter(isNode);
}

/** The top-level statements of a parsed module. */
export function moduleStatements(root: Node): readonly Node[] {
	const program = (root.program as Node | undefined) ?? root;
	return ((program.body ?? []) as Node[]).filter(isNode);
}

/**
 * The call an expression statement is, seeing through `await`.
 *
 * Playwright specs are written with `await` on every gesture and Cypress specs
 * are not; both reach the same call node through here.
 */
export function statementCall(statement: Node): Node | null {
	if (statement.type !== 'ExpressionStatement') return null;
	let expression = statement.expression as Node | undefined;
	while (expression !== undefined && expression.type === 'AwaitExpression')
		expression = expression.argument as Node | undefined;
	if (expression === undefined || expression.type !== 'CallExpression') return null;
	return expression;
}

/**
 * The dotted name a call's callee spells, for the suite-structure keywords —
 * `describe`, `it`, `test.describe`, `test.skip`, `it.only`.
 *
 * Modifier suffixes are not stripped here; a reader decides for itself whether
 * a skipped block is a journey.
 */
export function calleeName(node: Node): string | null {
	if (node.type !== 'CallExpression') return null;
	const parts: string[] = [];
	let current = node.callee as Node | undefined;
	while (current !== undefined) {
		if (current.type === 'Identifier') {
			parts.unshift(current.name as string);
			return parts.join('.');
		}
		if (current.type !== 'MemberExpression' || current.computed === true) return null;
		const property = current.property as Node | undefined;
		if (property === undefined || property.type !== 'Identifier') return null;
		parts.unshift(property.name as string);
		current = current.object as Node | undefined;
	}
	return null;
}
