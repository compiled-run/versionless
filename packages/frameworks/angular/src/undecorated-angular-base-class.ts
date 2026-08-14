/**
 * A class that uses Angular's features and carries no Angular decorator.
 *
 * Before Ivy this was legal and idiomatic. The ViewEngine compiler read a
 * decorated subclass and walked up its prototype chain collecting the metadata
 * its bases had declared — `@Input`, `@Output`, `@ViewChild` members and the
 * lifecycle hooks the base implemented — so an application could put shared
 * component behaviour in an undecorated base class and let every subclass
 * inherit it. From Angular 9 the compiler compiles each class from its own
 * decorator, and a class with no decorator has no compilation at all: its
 * members are never bound, its hooks are never called, and the compiler refuses
 * the program rather than emitting one that silently drops them. That is
 * `NG2007: Class is using Angular features but is not decorated`.
 *
 * The answer Angular shipped for its own users is the one taken here, and it is
 * a language feature rather than a workaround: `@Directive()` with no selector
 * marks a class as an *abstract directive* — a class the compiler compiles for
 * its metadata and that nothing can instantiate from a template, because it
 * matches no element. It is what Angular's own `undecorated-classes-with-di`
 * migration wrote into applications on this hop, and it changes no member, no
 * hook and no emitted behaviour: it restores the inheritance the era compiler
 * performed for free.
 *
 * ## What is read, and what is refused
 *
 * The precondition is the module's own resolved bindings, never a name:
 *
 * - A **feature decorator** on a member — one of {@link DIRECTIVE_FEATURE_DECORATORS}
 *   — that resolves to that export of `@angular/core`. A member decorated with
 *   some other `Input` is not one of these.
 * - A **lifecycle interface** in the class's `implements` clause that resolves
 *   to that export of `@angular/core`.
 *
 * Either is a use of Angular's features that only a compiled class can honour.
 * A class with neither is left exactly as it is even if it has a constructor
 * whose parameters look injectable: a class with constructor parameters is
 * ordinary TypeScript, the decorator it would need is `@Injectable()` rather
 * than `@Directive()` when it is a service base, and choosing between them from
 * the shape of a constructor would be a guess about what the application means.
 * That boundary is stated rather than crossed, and a class that needs it is
 * still reported by the compiler as `NG2007` for somebody to answer.
 *
 * A class that already carries any decorator is never touched — one that carries
 * an `@angular/core` class decorator needs nothing, and one that carries some
 * other decorator is a shape whose semantics this capability cannot read, so it
 * is reported by name instead of being given a second one.
 *
 * The capability also stands down entirely on a cell whose Angular line still
 * compiles with ViewEngine, because there the inheritance the base class relies
 * on is exactly what the compiler still performs.
 */

import { majorOf, type AngularTargetCell } from './angular-target-cell.ts';
import {
	applySourceEdits,
	lineOf,
	namedSpecifiersOf,
	parseModule,
	readModuleImports,
	denotesExport,
	type AstNode,
	type SemanticModule,
	type SourceEdit,
} from './semantic-module.ts';

const CAPABILITY = 'Undecorated Angular base class';

/** The package that publishes every symbol this capability resolves against. */
export const ANGULAR_CORE_SPECIFIER = '@angular/core';

/** The decorator synthesized for a base class, and the reason it is that one. */
export const ABSTRACT_DIRECTIVE_DECORATOR = '@Directive()';

/** The export the synthesized decorator names. */
export const ABSTRACT_DIRECTIVE_EXPORT = 'Directive';

/**
 * The first Angular line whose compiler requires a class using Angular features
 * to carry its own decorator. Before it, metadata was inherited at compile time.
 */
export const IVY_DECORATOR_REQUIRING_MAJOR = 9;

/**
 * Member decorators that only a compiled class honours. Each binds a class
 * member to something outside the class — a template input, an output event, a
 * queried node, a host binding — and every one of them is inert on a class the
 * compiler never compiled.
 */
export const DIRECTIVE_FEATURE_DECORATORS: readonly string[] = Object.freeze([
	'ContentChild',
	'ContentChildren',
	'HostBinding',
	'HostListener',
	'Input',
	'Output',
	'ViewChild',
	'ViewChildren',
]);

/**
 * The lifecycle interfaces `@angular/core` publishes. A class that declares one
 * is declaring that Angular will call the hook, which again only happens for a
 * class the compiler compiled.
 */
export const ANGULAR_LIFECYCLE_INTERFACES: readonly string[] = Object.freeze([
	'AfterContentChecked',
	'AfterContentInit',
	'AfterViewChecked',
	'AfterViewInit',
	'DoCheck',
	'OnChanges',
	'OnDestroy',
	'OnInit',
]);

/** The `@angular/core` class decorators that already answer `NG2007`. */
export const ANGULAR_CLASS_DECORATORS: readonly string[] = Object.freeze([
	'Component',
	'Directive',
	'Injectable',
	'NgModule',
	'Pipe',
]);

export type UndecoratedBaseClassChange = Readonly<{
	kind: 'undecorated-base-class';
	line: number;
	/** The class the decorator was written onto. */
	className: string;
	/** The decorator, as written. */
	decorator: typeof ABSTRACT_DIRECTIVE_DECORATOR;
	/** The Angular features the class uses, which is why it needs one. */
	features: readonly string[];
	/** Whether an import declaration was added rather than an existing one extended. */
	importAdded: boolean;
}>;

export type UndecoratedBaseClassMigration = Readonly<{
	path: string;
	source: string;
	changed: boolean;
	changes: readonly UndecoratedBaseClassChange[];
	unhandled: readonly string[];
}>;

type ClassDeclarationNode = Extract<AstNode, { type: 'ClassDeclaration' }>;
type DecoratorNode = Extract<AstNode, { type: 'Decorator' }>;

/** The class declaration a statement declares, with the statement that carries it. */
type ClassSite = Readonly<{ statement: AstNode; declaration: ClassDeclarationNode }>;

function classSites(module: SemanticModule): readonly ClassSite[] {
	const sites: ClassSite[] = [];
	for (const statement of module.ast.body) {
		if (statement.type === 'ClassDeclaration')
			sites.push(Object.freeze({ statement, declaration: statement }));
		if (statement.type !== 'ExportNamedDeclaration' && statement.type !== 'ExportDefaultDeclaration')
			continue;
		const declaration = statement.declaration;
		if (declaration !== null && declaration !== undefined && declaration.type === 'ClassDeclaration')
			sites.push(Object.freeze({ statement, declaration }));
	}
	return Object.freeze(sites);
}

/** The callee or identifier a decorator names, or null for a shape with neither. */
function decoratorReference(decorator: DecoratorNode): AstNode | null {
	const expression = decorator.expression;
	if (expression === null || expression === undefined) return null;
	if (expression.type === 'CallExpression') return expression.callee;
	if (expression.type === 'Identifier' || expression.type === 'MemberExpression') return expression;
	return null;
}

/**
 * Where `Directive` has to be written so the module imports it, and whether that
 * means a new declaration. An existing `@angular/core` declaration is extended,
 * because two declarations of one specifier is a shape the application did not
 * write.
 */
function importInsertion(
	module: SemanticModule,
	source: string,
): Readonly<{ edit: SourceEdit; added: boolean }> | null {
	let first: AstNode | null = null;
	for (const node of module.ast.body) {
		if (node.type !== 'ImportDeclaration') continue;
		first ??= node;
		if (node.source.value !== ANGULAR_CORE_SPECIFIER) continue;
		const last = namedSpecifiersOf(node).at(-1);
		if (last === undefined) continue;
		return Object.freeze({
			edit: { start: last.end, end: last.end, text: `, ${ABSTRACT_DIRECTIVE_EXPORT}` },
			added: false,
		});
	}
	if (first === null) return null;
	const text = source.slice(first.start, first.end);
	const braced = text.includes('{ ')
		? `{ ${ABSTRACT_DIRECTIVE_EXPORT} }`
		: `{${ABSTRACT_DIRECTIVE_EXPORT}}`;
	const quote = text.includes('"') ? '"' : "'";
	const semicolon = text.endsWith(';') ? ';' : '';
	return Object.freeze({
		edit: {
			start: first.start,
			end: first.start,
			text: `import ${braced} from ${quote}${ANGULAR_CORE_SPECIFIER}${quote}${semicolon}\n`,
		},
		added: true,
	});
}

/**
 * Decorate every class in one module that uses Angular's features and carries no
 * decorator of its own.
 *
 * Each class is decided on its own bindings; a class this capability refuses
 * does not stop the next one, because two classes are two facts about two
 * declarations.
 */
export function decorateUndecoratedBaseClasses(
	path: string,
	source: string,
	cell: AngularTargetCell,
): UndecoratedBaseClassMigration {
	const unchanged = (unhandled: readonly string[]): UndecoratedBaseClassMigration =>
		Object.freeze({
			path,
			source,
			changed: false,
			changes: Object.freeze([]),
			unhandled: Object.freeze([...unhandled]),
		});
	const major = majorOf(cell.angularLine);
	if (major === null || major < IVY_DECORATOR_REQUIRING_MAJOR) return unchanged([]);
	const module = parseModule(CAPABILITY, path, source);
	const core = readModuleImports(module, ANGULAR_CORE_SPECIFIER);
	if (!core.present) return unchanged([]);
	const edits: SourceEdit[] = [];
	const changes: UndecoratedBaseClassChange[] = [];
	const unhandled: string[] = [];
	for (const site of classSites(module)) {
		const { statement, declaration } = site;
		const className = declaration.id?.name ?? '<anonymous>';
		const line = lineOf(source, statement.start);
		const features: string[] = [];
		for (const clause of declaration.implements ?? [])
			for (const name of ANGULAR_LIFECYCLE_INTERFACES)
				if (denotesExport(module, clause.expression, core, name)) features.push(`implements ${name}`);
		for (const member of declaration.body.body) {
			if (member.type !== 'PropertyDefinition' && member.type !== 'MethodDefinition') continue;
			for (const decorator of member.decorators) {
				const reference = decoratorReference(decorator);
				if (reference === null) continue;
				const key = member.key;
				const named = key.type === 'Identifier' ? key.name : '<computed>';
				for (const name of DIRECTIVE_FEATURE_DECORATORS)
					if (denotesExport(module, reference, core, name))
						features.push(`@${name} on ${named}`);
			}
		}
		if (features.length === 0) continue;
		const decorators = declaration.decorators ?? [];
		if (decorators.length > 0) {
			const alreadyAngular = decorators.some((decorator) => {
				const reference = decoratorReference(decorator);
				return (
					reference !== null &&
					ANGULAR_CLASS_DECORATORS.some((name) => denotesExport(module, reference, core, name))
				);
			});
			if (alreadyAngular) continue;
			unhandled.push(
				`${path} line ${String(line)}: ${className} uses Angular features (${features.join(', ')}) ` +
					'and carries a decorator this capability cannot resolve to an `@angular/core` class ' +
					'decorator, so it was left exactly as it is rather than given a second one',
			);
			continue;
		}
		const insertion = importInsertion(module, source);
		if (insertion === null) {
			unhandled.push(
				`${path} line ${String(line)}: ${className} uses Angular features (${features.join(', ')}) ` +
					'but the module carries no import declaration to write `Directive` beside, so nothing ' +
					'was written',
			);
			continue;
		}
		if (changes.length === 0) edits.push(insertion.edit);
		const indent = source.slice(source.lastIndexOf('\n', statement.start) + 1, statement.start);
		edits.push({
			start: statement.start,
			end: statement.start,
			text: `${ABSTRACT_DIRECTIVE_DECORATOR}\n${indent}`,
		});
		changes.push(
			Object.freeze({
				kind: 'undecorated-base-class' as const,
				line,
				className,
				decorator: ABSTRACT_DIRECTIVE_DECORATOR,
				features: Object.freeze([...new Set(features)].sort()),
				importAdded: changes.length === 0 && insertion.added,
			}),
		);
	}
	const migrated = applySourceEdits(source, edits);
	return Object.freeze({
		path,
		source: migrated,
		changed: migrated !== source,
		changes: Object.freeze(changes),
		unhandled: Object.freeze([...new Set(unhandled)].sort()),
	});
}
