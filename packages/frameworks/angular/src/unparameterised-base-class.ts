/**
 * A generic base class extended with no type argument, parameterised from the
 * installed declaration rather than from a remembered spelling.
 *
 * A library that adds a type parameter to a base class its users extend leaves
 * every subclass in the application uncompilable at the `extends` clause, and
 * every member the subclass inherited unresolvable behind it. TypeScript reports
 * the clause once — `TS2314: Generic type 'FieldType<F>' requires 1 type
 * argument(s)` — and then reports the whole inherited surface missing from the
 * subclass, so two type-position characters stand in front of a diagnostic
 * census many times their size.
 *
 * The argument to write is the question. A migration that answers it from memory
 * is writing a name the installed package may not publish, on a parameter whose
 * constraint it has not read. So this capability answers it from the declaration
 * the application is actually compiling against, and the reading it demands has
 * four parts, each of which is a refusal when it fails:
 *
 * - the base class really is generic in exactly the parameters the compiler
 *   named, and the parameter it is asked to fill declares no default — a
 *   parameter with a default is not the one TS2314 is about;
 * - that parameter carries a constraint, because an unconstrained parameter
 *   admits every type and so proves nothing about any of them;
 * - the installed tree publishes a companion type for the base class — the
 *   interface named for the class it configures — and that companion extends the
 *   parameter's own constraint, so substituting it satisfies the parameter by
 *   the declaration's own arithmetic rather than by resemblance; and
 * - the companion narrows the constraint by declaring members of its own, which
 *   is what makes it the argument the subclass wants rather than the constraint
 *   restated.
 *
 * The rewrite is then a binding-resolved type-position insertion. The identifier
 * at the compiler's position has to resolve to an imported binding, and the
 * companion has to be imported from the package that publishes it — extending an
 * existing declaration when the module already names that package, and only when
 * the companion's name is free in the module's root scope, because an import
 * that shadowed an existing declaration would change what the module's other
 * references mean.
 *
 * Nothing here knows what a formly field is. What it knows is that a class named
 * `X` whose type parameter is constrained to `C`, in a tree that publishes an
 * `XConfig extends C`, has one argument its own publisher wrote down.
 */

import { charNotIn, createRegExp, digit, exactly, oneOrMore } from 'magic-regexp';
import { compareStrings } from './angular-target-cell.ts';
import {
	applySourceEdits,
	forEachNode,
	importDeclarationOf,
	isFreeRootName,
	lineOf,
	namedSpecifiersOf,
	offsetOfPosition,
	parseModule,
	type AstNode,
	type SemanticModule,
	type SourceEdit,
} from './semantic-module.ts';

const CAPABILITY = 'Unparameterised base class';

/**
 * One `TS2314`, decomposed. `line` and `column` are the compiler's own 1-based
 * pair, pointing at the type reference that was written bare; `base` is the
 * generic type's name and `parameters` are the parameter names the compiler
 * printed with it, in order.
 */
export type UnparameterisedBaseClassDiagnostic = Readonly<{
	line: number;
	column: number;
	base: string;
	parameters: readonly string[];
	/** How many arguments the compiler says the type requires. */
	required: number;
}>;

/** One type parameter of an installed generic declaration, as the tree declares it. */
export type BaseTypeParameterReading = Readonly<{
	name: string;
	/** The head of the parameter's constraint — `FormlyFieldConfig` of `FormlyFieldConfig<P>`. */
	constraint: string | null;
	hasDefault: boolean;
}>;

/**
 * The companion type an installed tree publishes for a generic base class: the
 * interface named for the class, which the class's own parameter is meant to be
 * filled with. `specifier` is the package the application has to import it from,
 * which is not always the package the base class came from.
 */
export type CompanionTypeReading = Readonly<{
	name: string;
	specifier: string;
	/** The head of the type the companion extends. */
	extendsConstraint: string | null;
	/** Every member the companion declares of its own. */
	members: readonly string[];
}>;

/**
 * One generic base class an application extends, read from the closure: the
 * declaration's parameters and the companion type published beside it.
 * `declaration` is where the reading was taken, for the record.
 */
export type GenericBaseClassReading = Readonly<{
	/** The name the application imports and extends. */
	name: string;
	/** The specifier the application imports it from. */
	specifier: string;
	declaration: string;
	parameters: readonly BaseTypeParameterReading[];
	companion: CompanionTypeReading | null;
}>;

export type BaseClassParameterisationChange = Readonly<{
	kind: 'unparameterised-base-class';
	line: number;
	base: string;
	/** The type argument written into the `extends` clause. */
	argument: string;
	/** Where the argument was imported from. */
	specifier: string;
	/** Whether an import declaration was added, rather than an existing one extended. */
	importAdded: boolean;
}>;

export type BaseClassParameterisationMigration = Readonly<{
	path: string;
	source: string;
	changed: boolean;
	changes: readonly BaseClassParameterisationChange[];
	unhandled: readonly string[];
}>;

/** The identifier node that starts exactly at `offset`, if the module has one. */
function identifierAt(module: SemanticModule, offset: number): AstNode | null {
	let found: AstNode | null = null;
	forEachNode(module.ast, (node) => {
		if (found !== null) return;
		if (node.type !== 'Identifier') return;
		if (node.start === offset) found = node;
	});
	return found;
}

/**
 * Where the companion's name has to be inserted so the module imports it, and
 * whether that means a new declaration.
 *
 * A module that already names the package gets the name added to that
 * declaration's braces, because two import declarations for one specifier is a
 * shape the application did not write. A module that does not gets a new
 * declaration on the line after the one that brought in the base class, so the
 * insertion is next to the thing it parameterises rather than at the top of a
 * file whose import order is the application's business.
 */
function importInsertion(
	module: SemanticModule,
	source: string,
	specifier: string,
	name: string,
	after: AstNode,
): Readonly<{ edit: SourceEdit; added: boolean }> {
	for (const node of module.ast.body) {
		if (node.type !== 'ImportDeclaration') continue;
		if (node.source.value !== specifier) continue;
		const specifiers = namedSpecifiersOf(node);
		const last = specifiers.at(-1);
		if (last === undefined) continue;
		return Object.freeze({
			edit: { start: last.end, end: last.end, text: `, ${name}` },
			added: false,
		});
	}
	const text = source.slice(after.start, after.end);
	const spaced = text.includes('{ ');
	const braced = spaced ? `{ ${name} }` : `{${name}}`;
	const quote = text.includes('"') ? '"' : "'";
	const semicolon = text.endsWith(';') ? ';' : '';
	return Object.freeze({
		edit: {
			start: after.end,
			end: after.end,
			text: `\nimport ${braced} from ${quote}${specifier}${quote}${semicolon}`,
		},
		added: true,
	});
}

/**
 * Fill the type arguments the compiler said were missing, in one module.
 *
 * Every diagnostic is answered or refused on its own: a base class whose reading
 * does not prove an argument leaves that `extends` clause exactly as it is and
 * does not stop the next one, because two base classes are two facts about two
 * declarations.
 */
export function parameteriseBaseClasses(
	path: string,
	source: string,
	diagnostics: readonly UnparameterisedBaseClassDiagnostic[],
	readings: readonly GenericBaseClassReading[],
): BaseClassParameterisationMigration {
	const module = parseModule(CAPABILITY, path, source);
	const byName = new Map(readings.map((reading) => [reading.name, reading]));
	const edits: SourceEdit[] = [];
	const changes: BaseClassParameterisationChange[] = [];
	const unhandled: string[] = [];
	const imported = new Set<string>();
	const refuse = (line: number, reason: string): void => {
		unhandled.push(`${path} line ${String(line)}: ${reason}`);
	};
	for (const diagnostic of diagnostics) {
		const { line, column, base, parameters, required } = diagnostic;
		const offset = offsetOfPosition(source, line, column);
		if (offset === null) {
			refuse(line, `column ${String(column)} is not a position in this file`);
			continue;
		}
		if (source.slice(offset, offset + base.length) !== base) {
			refuse(line, `column ${String(column)} is not where '${base}' is written`);
			continue;
		}
		const reference = identifierAt(module, offset);
		if (reference === null) {
			refuse(line, `column ${String(column)} is not the start of an identifier`);
			continue;
		}
		const binding = module.symbolOf(reference);
		if (binding === null) {
			refuse(line, `'${base}' at this position does not resolve to a binding`);
			continue;
		}
		const record = module.imports.find((entry) => entry.local !== null && entry.local === binding);
		if (record === undefined) {
			refuse(
				line,
				`'${base}' resolves to a binding this module declares rather than one it imports, so ` +
					'the closure reading does not describe it',
			);
			continue;
		}
		if (record.name !== base) {
			refuse(
				line,
				`'${base}' is a local alias of '${String(record.name)}', and the declaration reading was ` +
					'taken of the exported name',
			);
			continue;
		}
		const declaration = importDeclarationOf(module, record.node);
		const specifier: unknown =
			declaration !== null && declaration.type === 'ImportDeclaration'
				? declaration.source.value
				: undefined;
		if (declaration === null || typeof specifier !== 'string') {
			refuse(line, `the import of '${base}' has no literal module specifier`);
			continue;
		}
		const reading = byName.get(base);
		if (reading === undefined) {
			refuse(line, `no declaration reading was taken for '${base}'`);
			continue;
		}
		if (reading.specifier !== specifier) {
			refuse(
				line,
				`'${base}' was read from '${reading.specifier}' and this module imports it from ` +
					`'${specifier}'`,
			);
			continue;
		}
		if (reading.parameters.length !== required) {
			refuse(
				line,
				`the compiler says '${base}' requires ${String(required)} type argument(s) and ` +
					`${reading.declaration} declares ${String(reading.parameters.length)}`,
			);
			continue;
		}
		if (required !== 1) {
			refuse(
				line,
				`'${base}' requires ${String(required)} type arguments, and a reading that proves one ` +
					'argument proves nothing about the others',
			);
			continue;
		}
		const parameter = reading.parameters[0];
		if (parameter === undefined || parameter.name !== parameters[0]) {
			refuse(
				line,
				`the compiler named the parameter '${String(parameters[0])}' and ${reading.declaration} ` +
					`declares '${String(parameter?.name)}'`,
			);
			continue;
		}
		if (parameter.hasDefault) {
			refuse(
				line,
				`${reading.declaration} gives '${parameter.name}' a default, so TS2314 does not ` +
					'describe this declaration and the reading is of the wrong tree',
			);
			continue;
		}
		if (parameter.constraint === null) {
			refuse(
				line,
				`'${parameter.name}' is unconstrained in ${reading.declaration}, so no published type ` +
					'is proved to be the argument it wants',
			);
			continue;
		}
		const companion = reading.companion;
		if (companion === null) {
			refuse(
				line,
				`the closure publishes no companion type for '${base}', so the argument for ` +
					`'${parameter.name}' would be a name this reading did not find`,
			);
			continue;
		}
		if (companion.extendsConstraint !== parameter.constraint) {
			refuse(
				line,
				`'${companion.name}' extends '${String(companion.extendsConstraint)}' and ` +
					`'${parameter.name}' is constrained to '${parameter.constraint}', so substituting it ` +
					'is not proved by the declaration',
			);
			continue;
		}
		if (companion.members.length === 0) {
			refuse(
				line,
				`'${companion.name}' declares no members of its own, so it restates ` +
					`'${parameter.constraint}' rather than narrowing it`,
			);
			continue;
		}
		if (source[offset + base.length] === '<') {
			refuse(line, `'${base}' already carries a type argument list at this position`);
			continue;
		}
		const needsImport = !imported.has(companion.name);
		if (needsImport && !isFreeRootName(module, companion.name)) {
			refuse(
				line,
				`'${companion.name}' is already declared in this module, so importing it would change ` +
					'which symbol its uses mean',
			);
			continue;
		}
		let importAdded = false;
		if (needsImport) {
			const insertion = importInsertion(
				module,
				source,
				companion.specifier,
				companion.name,
				declaration,
			);
			edits.push(insertion.edit);
			importAdded = insertion.added;
			imported.add(companion.name);
		}
		edits.push({
			start: offset + base.length,
			end: offset + base.length,
			text: `<${companion.name}>`,
		});
		changes.push({
			kind: 'unparameterised-base-class',
			line: lineOf(source, offset),
			base,
			argument: companion.name,
			specifier: companion.specifier,
			importAdded,
		});
	}
	const migrated = applySourceEdits(source, edits);
	return Object.freeze({
		path,
		source: migrated,
		changed: migrated !== source,
		changes: Object.freeze(changes),
		unhandled: Object.freeze([...new Set(unhandled)].sort(compareStrings)),
	});
}

/**
 * The `TS2314` lines of a build log, decomposed into diagnostics by file.
 *
 * The message carries the generic type with its parameter list printed out —
 * `Generic type 'FieldType<F>' requires 1 type argument(s).` — which is the
 * compiler's own reading of the declaration this capability then measures
 * independently. A line whose parameter list cannot be read is not a diagnostic
 * this capability can check anything against, and is left out.
 */
export function readUnparameterisedBaseClasses(
	log: string,
): ReadonlyMap<string, readonly UnparameterisedBaseClassDiagnostic[]> {
	const found = new Map<string, UnparameterisedBaseClassDiagnostic[]>();
	for (const line of log.split('\n')) {
		const head = DIAGNOSTIC_HEAD.exec(line.trim())?.groups;
		const message = GENERIC_TYPE.exec(line)?.groups;
		if (head === undefined || message === undefined) continue;
		const printed = message['type'] as string;
		const open = printed.indexOf('<');
		if (open === -1 || !printed.endsWith('>')) continue;
		const parameters = printed
			.slice(open + 1, -1)
			.split(',')
			.map((entry) => entry.trim())
			.filter((entry) => entry !== '');
		if (parameters.length === 0) continue;
		const entry: UnparameterisedBaseClassDiagnostic = Object.freeze({
			line: Number(head['line']),
			column: Number(head['column']),
			base: printed.slice(0, open),
			parameters: Object.freeze(parameters),
			required: Number(message['required']),
		});
		const list = found.get(head['file'] as string);
		if (list === undefined) found.set(head['file'] as string, [entry]);
		else list.push(entry);
	}
	return new Map([...found].map(([file, list]) => [file, Object.freeze(list)]));
}

/** The position and code the builder prints in front of a diagnostic's message. */
const DIAGNOSTIC_HEAD = createRegExp(
	oneOrMore(charNotIn(' \t\n:'))
		.as('file')
		.and(exactly(':'))
		.and(oneOrMore(digit).as('line'))
		.and(exactly(':'))
		.and(oneOrMore(digit).as('column'))
		.and(exactly(' - error TS2314: ')),
);

/** The message body, which prints the generic type with its parameter list. */
const GENERIC_TYPE = createRegExp(
	exactly("Generic type '")
		.and(oneOrMore(charNotIn("'")).as('type'))
		.and(exactly("' requires "))
		.and(oneOrMore(digit).as('required'))
		.and(exactly(' type argument(s).')),
);
