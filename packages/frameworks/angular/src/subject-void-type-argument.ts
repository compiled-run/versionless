/**
 * A `new Subject()` written with no type argument, every one of whose `next`
 * calls passes nothing.
 *
 * This is the same movement the promise executor capability answers, one library
 * over. RxJS 6 declared `Subject#next` as `next(value?: T): void`, so `next()`
 * type-checked at every `T` and an un-parameterised `new Subject()` — inferring
 * `T = unknown` — was a perfectly ordinary way to write a signal that carries no
 * value. RxJS 7 removed the optionality: `next(value: T): void`, and `unknown`
 * does not admit an absent argument, so `TS2554: Expected 1 arguments, but got 0`
 * lands on a line the application never touched. The successor is the type
 * argument the subject's own use already proves: this subject carries nothing,
 * so it is a `Subject<void>`.
 *
 * `void` is a statement about every value the subject will ever carry, so the
 * evidence has to cover every use of it, and the refusals are where that is
 * enforced:
 *
 * - The constructor has to be the `Subject` imported from `rxjs`, resolved by
 *   binding. A locally declared class of the same name is a different thing.
 * - The subject has to be *private to the module*: a private class property, or
 *   a module-local declaration that is not exported. A subject reachable from
 *   outside cannot have all of its `next` calls read from here, and a capability
 *   that narrowed one would be claiming something it cannot see.
 * - Every `.next` on the binding has to be called, and called with no argument.
 *   One `next(value)` and the subject carries something; `void` is then simply
 *   the wrong answer and the declaration is left as it is.
 * - At least one such call has to exist, or there is no TS2554 here to answer and
 *   the capability has no business rewriting the line.
 *
 * Other uses of the binding — subscribing to it, merging it into another
 * observable, handing it out as an `Observable` — are passed over rather than
 * refused: they read the subject, and a `Subject<void>` is an `Observable<void>`
 * whose subscribers receive exactly what they received before, which is nothing.
 * What they cannot do is put a value in, because that is a `next` call and every
 * one of those has been read.
 *
 * The rewrite inserts six characters after the constructor name. It touches
 * neither the declaration's own type annotation, if it carries one, nor any call.
 */

import { compareStrings } from './angular-target-cell.ts';
import {
	applySourceEdits,
	forEachNode,
	lineOf,
	parseModule,
	readModuleImports,
	type AstNode,
	type SemanticModule,
	type SourceEdit,
} from './semantic-module.ts';

const CAPABILITY = 'Subject void type argument';

export type VoidSubjectChange = Readonly<{
	kind: 'subject-void-type-argument';
	line: number;
	/** The name the module gave the subject, for the record. */
	binding: string;
	/** How many zero-argument `next` calls the module makes on it. */
	callSites: number;
}>;

export type VoidSubjectMigration = Readonly<{
	path: string;
	source: string;
	changed: boolean;
	changes: readonly VoidSubjectChange[];
	unhandled: readonly string[];
}>;

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
 * The declaration a `new Subject()` initialises, and whether that declaration
 * keeps the subject inside this module.
 *
 * Two shapes are read, because they are the two ways a module owns a subject: a
 * class property declared `private` (or `#`-private), and a module-local
 * `const`/`let` that no export names. Everything else — a public property, an
 * exported binding, a subject constructed inline as an argument — is left to the
 * caller to refuse, because the calls that would prove `void` are not all here.
 */
function ownedDeclaration(
	module: SemanticModule,
	construction: AstNode,
): Readonly<{
	name: AstNode;
	text: string;
	scope: 'private-property' | 'module-local';
}> | null {
	const parent = module.parentOf(construction);
	if (parent === null) return null;
	if (parent.type === 'PropertyDefinition' && parent.value === construction) {
		if (parent.computed === true || parent.static === true) return null;
		const key: AstNode | null = parent.key;
		if (key === null) return null;
		if (key.type !== 'Identifier' && key.type !== 'PrivateIdentifier') return null;
		const isPrivate = parent.accessibility === 'private' || key.type === 'PrivateIdentifier';
		if (!isPrivate) return null;
		if (typeof key.name !== 'string') return null;
		return Object.freeze({ name: key, text: key.name, scope: 'private-property' as const });
	}
	if (parent.type === 'VariableDeclarator' && parent.init === construction) {
		const id: AstNode | null = parent.id;
		if (id === null || id.type !== 'Identifier') return null;
		const declaration = module.parentOf(parent);
		if (declaration === null) return null;
		const statement = module.parentOf(declaration);
		// `export const x = new Subject()` hands the subject to every importer,
		// and their `next` calls are not in this file.
		if (statement !== null && statement.type === 'ExportNamedDeclaration') return null;
		if (typeof id.name !== 'string') return null;
		return Object.freeze({ name: id, text: id.name, scope: 'module-local' as const });
	}
	return null;
}

/** The class body a class property's key sits in. */
function enclosingClassBody(module: SemanticModule, key: AstNode): AstNode | null {
	let node: AstNode | null = module.parentOf(key);
	while (node !== null) {
		if (node.type === 'ClassBody') return node;
		node = module.parentOf(node);
	}
	return null;
}

/** Whether a class body declares another class anywhere inside it. */
function containsNestedClass(body: AstNode): boolean {
	let found = false;
	forEachNode(body, (node) => {
		if (node === body) return;
		if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') found = true;
	});
	return found;
}

/** Every `this.<name>` member expression in a class body. */
function thisPropertyUses(body: AstNode, name: string): readonly AstNode[] {
	const found: AstNode[] = [];
	forEachNode(body, (node) => {
		if (node.type !== 'MemberExpression') return;
		if (node.computed === true) return;
		const object: AstNode | null = node.object;
		const property: AstNode | null = node.property;
		if (object === null || object.type !== 'ThisExpression') return;
		if (property === null) return;
		if (property.type !== 'Identifier' && property.type !== 'PrivateIdentifier') return;
		if (property.name !== name) return;
		found.push(node);
	});
	return Object.freeze(found);
}

/** Whether `use` is the object of a `.next(…)` member call, and with how many arguments. */
function nextCallOf(module: SemanticModule, use: AstNode): number | null {
	const member = module.parentOf(use);
	if (member === null || member.type !== 'MemberExpression') return null;
	if (member.object !== use || member.computed === true) return null;
	const property: AstNode | null = member.property;
	if (property === null || property.type !== 'Identifier' || property.name !== 'next')
		return null;
	const call = module.parentOf(member);
	if (call === null || call.type !== 'CallExpression' || call.callee !== member) return null;
	return (call.arguments as readonly AstNode[]).length;
}

/**
 * Write `void` as the type argument of every un-parameterised `new Subject()`
 * the module proves carries nothing.
 */
export function parameteriseVoidSubjects(path: string, source: string): VoidSubjectMigration {
	const module = parseModule(CAPABILITY, path, source);
	const rxjs = readModuleImports(module, 'rxjs');
	const subject = rxjs.named.get('Subject') ?? null;
	const edits: SourceEdit[] = [];
	const changes: VoidSubjectChange[] = [];
	const unhandled: string[] = [];

	forEachNode(module.ast, (node) => {
		if (node.type !== 'NewExpression') return;
		const callee: AstNode | null = node.callee;
		if (callee === null || callee.type !== 'Identifier' || callee.name !== 'Subject') return;
		const line = lineOf(source, node.start);
		const at = `${path} line ${String(line)}`;
		// An explicit type argument, or a constructor argument, is the
		// application's own decision about what this subject carries.
		if (node.typeArguments !== null && node.typeArguments !== undefined) return;
		if ((node.arguments as readonly AstNode[]).length !== 0) return;
		if (subject === null || module.symbolOf(callee) !== subject) {
			unhandled.push(
				`${at}: the name Subject here does not resolve to the rxjs import, so this is not the ` +
					'declaration TS2554 is written about',
			);
			return;
		}

		const owned = ownedDeclaration(module, node);
		if (owned === null) {
			unhandled.push(
				`${at}: this subject is not private to the module — a public or exported subject can be ` +
					'given a value from a file this capability cannot read, so void cannot be proven here',
			);
			return;
		}
		const name = owned.text;
		let uses: readonly AstNode[];
		if (owned.scope === 'module-local') {
			const symbol = module.symbolOf(owned.name);
			if (symbol === null || symbol === undefined) {
				unhandled.push(
					`${at}: the declaration this subject initialises resolves to no binding`,
				);
				return;
			}
			uses = referencesTo(module, symbol).filter((use) => use !== owned.name);
		} else {
			// A class property is not a binding the scope analysis carries, so its
			// uses are read off `this`. That is only sound while there is exactly
			// one `this` in the class body, so a class that nests another class is
			// refused rather than guessed at.
			const owner = enclosingClassBody(module, owned.name);
			if (owner === null) {
				unhandled.push(`${at}: this property has no class body to read its uses from`);
				return;
			}
			if (containsNestedClass(owner)) {
				unhandled.push(
					`${at}: the class that owns ${name} declares another class inside it, so a ` +
						'`this` inside it may not be this class and the uses cannot be read here',
				);
				return;
			}
			uses = thisPropertyUses(owner, name);
		}
		let zeroArgument = 0;
		let refusal: string | null = null;
		for (const use of uses) {
			const args = nextCallOf(module, use);
			if (args === null) continue;
			if (args === 0) {
				zeroArgument += 1;
				continue;
			}
			refusal ??=
				`${name}.next is called at line ${String(lineOf(source, use.start))} with ` +
				`${String(args)} argument(s), so this subject carries a value and void is the wrong ` +
				'type argument for it';
		}
		// No zero-argument next means no TS2554 to answer, whatever else the module
		// does with the subject. Silence here is the capability not having business
		// rather than refusing, and it is read before the refusal so that an
		// ordinary valued subject is passed over in silence too.
		if (zeroArgument === 0) return;
		if (refusal !== null) {
			unhandled.push(`${at}: ${refusal}. The declaration was left exactly as it is.`);
			return;
		}

		edits.push({ start: callee.end, end: callee.end, text: '<void>' });
		changes.push({
			kind: 'subject-void-type-argument',
			line,
			binding: name,
			callSites: zeroArgument,
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
