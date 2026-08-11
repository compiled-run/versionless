/**
 * `ModuleWithProviders` written without its type argument.
 *
 * Angular 10 removed the default from `ModuleWithProviders<T>`. Every era
 * annotation written as the bare name — the shape the Angular 4 docs taught for
 * a `forRoot` static — is a hard `TS2314` from that release on, and the type
 * argument it now needs is the NgModule the value configures.
 *
 * The argument is not guessable, so this capability never guesses it. It reads
 * it from the only two places the source states it:
 *
 * - an annotated variable whose initialiser is a static call on a class,
 *   `const routing: ModuleWithProviders = RouterModule.forRoot(...)`. The
 *   `ModuleWithProviders` a static factory returns is the module the static is
 *   declared on, so the receiver of the call *is* the argument.
 * - a static method's own return annotation inside a class,
 *   `static forRoot(): ModuleWithProviders`. The enclosing class is the module.
 *
 * Both readings resolve the name they emit as a binding: the receiver has to be
 * an identifier the module has a symbol for, so a call on a namespace member, a
 * computed member or an unbound name is refused rather than spelled out. Any
 * other position — a parameter, a field, an interface member, a call with no
 * receiver — is refused by name, because nothing in the source says what the
 * module is and an invented argument compiles into a lie.
 *
 * An annotation that already carries a type argument is not a site: the
 * capability reports nothing for an application written after Angular 10, which
 * is the check that it is not keyed to one.
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

const CAPABILITY = 'ModuleWithProviders type argument';

/** The package that publishes the type, and the type that became generic. */
export const MODULE_WITH_PROVIDERS_PACKAGE = '@angular/core';
export const MODULE_WITH_PROVIDERS = 'ModuleWithProviders';

export type ModuleWithProvidersChange = Readonly<{
	kind: 'module-with-providers-type-argument';
	line: number;
	argument: string;
	/** How the argument was read: from the initialiser, or from the enclosing class. */
	readFrom: 'static-call-receiver' | 'enclosing-class';
}>;

export type ModuleWithProvidersMigration = Readonly<{
	path: string;
	source: string;
	changed: boolean;
	changes: readonly ModuleWithProvidersChange[];
	unhandled: readonly string[];
}>;

type Reading = Readonly<{ argument: string; readFrom: ModuleWithProvidersChange['readFrom'] }>;

/** The class a static call is made on, when the receiver is a bound identifier. */
function receiverModule(module: SemanticModule, initialiser: AstNode | null): string | null {
	if (initialiser === null || initialiser.type !== 'CallExpression') return null;
	const callee = initialiser.callee;
	if (callee.type !== 'MemberExpression' || callee.computed || callee.optional) return null;
	const receiver = callee.object;
	if (receiver.type !== 'Identifier') return null;
	if (module.symbolOf(receiver) === null) return null;
	return receiver.name;
}

/**
 * Where the module this annotation configures is stated, walking out from the
 * annotation to the declaration that owns it.
 */
function readArgument(module: SemanticModule, typeReference: AstNode): Reading | null {
	const annotation = module.parentOf(typeReference);
	if (annotation === null || annotation.type !== 'TSTypeAnnotation') return null;
	const annotated = module.parentOf(annotation);
	if (annotated === null) return null;
	if (annotated.type === 'Identifier') {
		const declarator = module.parentOf(annotated);
		if (declarator === null || declarator.type !== 'VariableDeclarator') return null;
		if (declarator.id !== annotated) return null;
		const argument = receiverModule(module, declarator.init ?? null);
		return argument === null ? null : { argument, readFrom: 'static-call-receiver' };
	}
	const method = module.parentOf(annotated);
	if (method === null || method.type !== 'MethodDefinition' || !method.static) return null;
	const body = module.parentOf(method);
	if (body === null || body.type !== 'ClassBody') return null;
	const declaration = module.parentOf(body);
	if (declaration === null) return null;
	if (declaration.type !== 'ClassDeclaration' && declaration.type !== 'ClassExpression') return null;
	const id = declaration.id;
	if (id === null || id === undefined || id.type !== 'Identifier') return null;
	return { argument: id.name, readFrom: 'enclosing-class' };
}

/** Give every bare `ModuleWithProviders` annotation the argument the source states. */
export function addModuleWithProvidersTypeArgument(
	path: string,
	source: string,
): ModuleWithProvidersMigration {
	const module = parseModule(CAPABILITY, path, source);
	const core = readModuleImports(module, MODULE_WITH_PROVIDERS_PACKAGE);
	const binding = core.named.get(MODULE_WITH_PROVIDERS);
	const edits: SourceEdit[] = [];
	const changes: ModuleWithProvidersChange[] = [];
	const unhandled: string[] = [];
	if (binding === undefined)
		return Object.freeze({
			path,
			source,
			changed: false,
			changes: Object.freeze([]),
			unhandled: Object.freeze([]),
		});
	forEachNode(module.ast, (node) => {
		if (node.type !== 'TSTypeReference') return;
		const name = node.typeName;
		if (name.type !== 'Identifier' || module.symbolOf(name) !== binding) return;
		const supplied = node.typeArguments;
		if (supplied !== null && supplied !== undefined) return;
		const line = lineOf(source, node.start);
		const reading = readArgument(module, node);
		if (reading === null) {
			unhandled.push(
				`${path} line ${String(line)}: ${MODULE_WITH_PROVIDERS} needs the module it configures as ` +
					'its type argument, and this annotation is on neither a variable initialised by a ' +
					'static call on a class nor a static method of one. Nothing in the source says which ' +
					'module it is, so the annotation was left exactly as it is.',
			);
			return;
		}
		edits.push({ start: node.end, end: node.end, text: `<${reading.argument}>` });
		changes.push({
			kind: 'module-with-providers-type-argument',
			line,
			argument: reading.argument,
			readFrom: reading.readFrom,
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
