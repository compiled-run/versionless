/**
 * A platform type that widened into a union under the application.
 *
 * Some era code stops compiling without any package changing. The DOM library
 * TypeScript ships is versioned with the compiler, and it has been corrected
 * repeatedly: `FileReader.result` was declared `any` in the 2.4 lib and is
 * `string | ArrayBuffer | null` in the 5.x lib, because that is what the API
 * always returned. Code written against the narrow declaration assigns the
 * value straight into a `string` and the compiler now refuses it.
 *
 * There is no version mapping to apply here — the source is correct about its
 * own program and wrong about nothing — so this capability does not rewrite the
 * read. It narrows it, and it narrows it with a runtime check rather than an
 * assertion, because an assertion would silence the compiler without ever
 * looking at the value.
 *
 * Nothing about the DOM is written into the capability. The site, the union and
 * the wanted member all come from the compiler's own `TS2322` diagnostic, the
 * same way the RxJS migration takes its sites from `TS2339`: the transform is
 * told "this value here is `string | ArrayBuffer` and this position needs
 * `string`" and it inserts exactly that test.
 *
 * The narrowing is a guard over a statement suffix, and it is only written when
 * the shape makes that an equivalence:
 *
 * - the flagged expression is a reference to a `const` local, so TypeScript's
 *   own control-flow analysis narrows every later use of it;
 * - the `const` is declared directly in a block, and the guard covers every
 *   statement after the declaration to the end of that block, so no statement
 *   is left half-guarded;
 * - every reference to the binding is inside that region, so nothing outside
 *   the guard can observe the un-narrowed value; and
 * - the wanted type is a primitive `typeof` can test, and it is one member of
 *   the union the compiler named.
 *
 * Anything else is refused by name. The declared difference the guard carries
 * is stated rather than hidden: where the value is *not* the wanted member, the
 * guarded statements do not run. The compiler says that case is possible; this
 * capability does not claim to know that it never happens.
 */

import { compareStrings } from './angular-target-cell.ts';
import {
	applySourceEdits,
	forEachNode,
	lineOf,
	offsetOfPosition,
	parseModule,
	type AstNode,
	type SemanticModule,
	type SourceEdit,
} from './semantic-module.ts';

const CAPABILITY = 'Widened union narrowing';

/** The primitives `typeof` names, and therefore the only members a guard can test for. */
export const TYPEOF_TESTABLE: readonly string[] = Object.freeze([
	'string',
	'number',
	'boolean',
	'bigint',
	'symbol',
]);

/**
 * One `TS2322` the compiler reported: a position, the union type the expression
 * has, and the type the position requires.
 */
export type WidenedAssignmentDiagnostic = Readonly<{
	line: number;
	column: number;
	sourceType: string;
	targetType: string;
}>;

export type WidenedNarrowingChange = Readonly<{
	kind: 'widened-union-narrowing';
	line: number;
	binding: string;
	sourceType: string;
	targetType: string;
	/** How many statements the guard now covers. */
	statementsGuarded: number;
}>;

export type WidenedNarrowingMigration = Readonly<{
	path: string;
	source: string;
	changed: boolean;
	changes: readonly WidenedNarrowingChange[];
	declaredDifferences: readonly string[];
	unhandled: readonly string[];
}>;

/** The members of a union type as the compiler printed it, or null when it is not plainly one. */
export function unionMembers(printed: string): readonly string[] | null {
	if (!printed.includes('|')) return null;
	if (/[<>(){}[\]]/u.test(printed)) return null;
	return Object.freeze(printed.split('|').map((member) => member.trim()));
}

/** The identifier that starts exactly at `offset`. */
function identifierAt(module: SemanticModule, offset: number): AstNode | null {
	let found: AstNode | null = null;
	forEachNode(module.ast, (node) => {
		if (found !== null) return;
		if (node.type === 'Identifier' && node.start === offset) found = node;
	});
	return found;
}

/**
 * The expression the diagnostic is about.
 *
 * TypeScript anchors an object-literal assignment failure at the property's
 * name rather than at its value — the error is about the property, and the
 * squiggle sits under the key. Following that one hop is a reading of where the
 * compiler points, not a guess: any other node at the position is used as it
 * stands.
 */
function flaggedExpression(module: SemanticModule, node: AstNode): AstNode {
	const parent = module.parentOf(node);
	if (parent === null || parent.type !== 'Property') return node;
	if (parent.computed || parent.shorthand || parent.key !== node) return node;
	return parent.value;
}

type Site = Readonly<{
	binding: string;
	region: readonly AstNode[];
	start: number;
	end: number;
}>;

/**
 * The statement suffix a guard on `reference`'s binding would cover, or a
 * refusal saying which of the shape's requirements the module does not meet.
 */
function readSite(
	module: SemanticModule,
	reference: AstNode,
): Readonly<{ site: Site }> | Readonly<{ refusal: string }> {
	if (reference.type !== 'Identifier')
		return { refusal: 'the flagged position is not an identifier' };
	const symbol = module.symbolOf(reference);
	if (symbol === null)
		return { refusal: `the flagged identifier ${reference.name} resolves to no binding` };
	let declarator: AstNode | null = null;
	let declared: AstNode | null = null;
	forEachNode(module.ast, (node) => {
		if (declarator !== null) return;
		if (node.type !== 'VariableDeclarator') return;
		if (node.id.type !== 'Identifier' || module.symbolOf(node.id) !== symbol) return;
		declarator = node;
		declared = node.id;
	});
	if (declarator === null)
		return {
			refusal:
				`${reference.name} is not a variable this module declares, so there is no declaration ` +
				'to guard after',
		};
	const declaration = module.parentOf(declarator);
	if (
		declaration === null ||
		declaration.type !== 'VariableDeclaration' ||
		declaration.kind !== 'const'
	)
		return {
			refusal:
				`${reference.name} is not declared \`const\`, so a guard on it would not narrow its ` +
				'later uses',
		};
	const block = module.parentOf(declaration);
	if (block === null || block.type !== 'BlockStatement')
		return {
			refusal:
				`${reference.name} is not declared directly in a block, so there is no statement ` +
				'suffix a guard could cover',
		};
	const index = block.body.indexOf(declaration);
	const region = index < 0 ? [] : block.body.slice(index + 1);
	const first = region[0];
	const last = region[region.length - 1];
	if (first === undefined || last === undefined)
		return {
			refusal: `${reference.name} is used by no statement after its declaration in the same block`,
		};
	const start = first.start;
	const end = last.end;
	let escapes = false;
	forEachNode(module.ast, (node) => {
		if (node.type !== 'Identifier' || module.symbolOf(node) !== symbol) return;
		if (node === declared) return;
		if (node.start >= start && node.end <= end) return;
		escapes = true;
	});
	if (escapes)
		return {
			refusal:
				`${reference.name} is referenced outside the statements that follow its declaration, ` +
				'so a guard over them would leave a use un-narrowed',
		};
	return {
		site: Object.freeze({
			binding: reference.name,
			region: Object.freeze(region),
			start,
			end,
		}),
	};
}

/** Insert a runtime narrowing guard at every site the compiler flagged and the module allows. */
export function narrowWidenedAssignments(
	path: string,
	source: string,
	diagnostics: readonly WidenedAssignmentDiagnostic[],
): WidenedNarrowingMigration {
	const module = parseModule(CAPABILITY, path, source);
	const edits: SourceEdit[] = [];
	const changes: WidenedNarrowingChange[] = [];
	const differences: string[] = [];
	const unhandled: string[] = [];
	const covered: { start: number; end: number }[] = [];
	for (const diagnostic of diagnostics) {
		const where = `${path} line ${String(diagnostic.line)}`;
		const members = unionMembers(diagnostic.sourceType);
		if (members === null) {
			unhandled.push(
				`${where}: the compiler printed the expression's type as '${diagnostic.sourceType}', ` +
					'which is not a plain union of names, so which member the position wants cannot be ' +
					'read off it and the site was left exactly as it is',
			);
			continue;
		}
		if (!members.includes(diagnostic.targetType)) {
			unhandled.push(
				`${where}: the position wants '${diagnostic.targetType}' and the expression is ` +
					`'${diagnostic.sourceType}', which does not include it. That is a conversion rather ` +
					'than a narrowing, and the site was left exactly as it is',
			);
			continue;
		}
		if (!TYPEOF_TESTABLE.includes(diagnostic.targetType)) {
			unhandled.push(
				`${where}: '${diagnostic.targetType}' is not a primitive \`typeof\` can test for, so no ` +
					'guard narrows to it and the site was left exactly as it is',
			);
			continue;
		}
		const offset = offsetOfPosition(source, diagnostic.line, diagnostic.column);
		const reference = offset === null ? null : identifierAt(module, offset);
		if (reference === null) {
			unhandled.push(
				`${where} column ${String(diagnostic.column)}: no identifier starts at the position the ` +
					'compiler named, so the site was left exactly as it is',
			);
			continue;
		}
		const reading = readSite(module, flaggedExpression(module, reference));
		if ('refusal' in reading) {
			unhandled.push(`${where}: ${reading.refusal}, so the site was left exactly as it is`);
			continue;
		}
		const { site } = reading;
		if (covered.some((span) => site.start < span.end && span.start < site.end)) {
			unhandled.push(
				`${where}: the statements a guard on ${site.binding} would cover overlap a guard this ` +
					'module already gained, and two nested rewrites of one region are not a shape this ' +
					'capability writes, so the site was left exactly as it is',
			);
			continue;
		}
		const lineStart = source.lastIndexOf('\n', site.start - 1) + 1;
		const indent = source.slice(lineStart, site.start);
		const start = /^[\t ]*$/u.test(indent) ? lineStart : site.start;
		const prefix = /^[\t ]*$/u.test(indent) ? indent : '';
		const unit = prefix.includes('\t') ? '\t' : '  ';
		const body = source
			.slice(start, site.end)
			.split('\n')
			.map((text) => (text.trim() === '' ? text : `${unit}${text}`))
			.join('\n');
		edits.push({
			start,
			end: site.end,
			text:
				`${prefix}if (typeof ${site.binding} === '${diagnostic.targetType}') {\n` +
				`${body}\n${prefix}}`,
		});
		covered.push({ start: site.start, end: site.end });
		changes.push({
			kind: 'widened-union-narrowing',
			line: lineOf(source, site.start),
			binding: site.binding,
			sourceType: diagnostic.sourceType,
			targetType: diagnostic.targetType,
			statementsGuarded: site.region.length,
		});
		differences.push(
			`${path} line ${String(lineOf(source, site.start))}: ${site.binding} is now read under ` +
				`\`typeof ${site.binding} === '${diagnostic.targetType}'\`. Where it is one of the other ` +
				`members of '${diagnostic.sourceType}', the ${String(site.region.length)} guarded ` +
				`statement${site.region.length === 1 ? '' : 's'} no longer run. The era code ran them ` +
				'unconditionally, and nothing here observes which member the value takes at run time.',
		);
	}
	const migrated = applySourceEdits(source, edits);
	return Object.freeze({
		path,
		source: migrated,
		changed: migrated !== source,
		changes: Object.freeze(changes),
		declaredDifferences: Object.freeze(differences),
		unhandled: Object.freeze([...new Set(unhandled)].sort(compareStrings)),
	});
}
