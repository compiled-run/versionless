/**
 * A member a library renamed on a type it publishes, applied where the compiler
 * itself resolved the receiver.
 *
 * `TS2339: Property 'addAll' does not exist on type 'EntityAdapter<…>'` is the
 * shape a renamed method leaves behind, and it is a harder shape to answer than
 * a renamed export. TypeScript offers no successor for it — there is no "did you
 * mean", because the checker's own spelling heuristic does not connect `addAll`
 * to `setAll` — so the successor cannot come from the diagnostic the way
 * {@link applySuggestedExportRenames} takes it. It has to come from somewhere,
 * and the only honest options are a name a person wrote down or a name invented
 * at rewrite time. This capability takes the first and refuses to take the
 * second.
 *
 * What the diagnostic does supply is the part a table cannot: the receiver. The
 * message names the *declared type* of the expression the member was reached
 * through, which is the compiler's own binding resolution against the installed
 * closure — not a guess about which `adapter` in the module is an entity
 * adapter, and not a textual match on a method name that any object might carry.
 * A rename is written only at a position where the compiler has already said
 * "the thing on the left of this dot is that type".
 *
 * The written-down half is then checked against the installed tree before
 * anything is written, and the check is two-sided: the type has to publish the
 * successor and it has to not publish the name being replaced. A tree that still
 * has `addAll` is a tree where this diagnostic means something else, and a tree
 * without `setAll` is one where the rename would move the failure rather than
 * answer it. Either way the rename is refused by name and the site is left for a
 * reading nobody has taken yet.
 */

import { charNotIn, createRegExp, digit, exactly, oneOrMore } from 'magic-regexp';
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

const CAPABILITY = 'Declared type member rename';

/**
 * One `TS2339`, decomposed: the member the expression reached for, and the head
 * of the declared type the compiler resolved its receiver to. `line` and
 * `column` are the compiler's own 1-based pair, pointing at the member name.
 */
export type MissingMemberDiagnostic = Readonly<{
	line: number;
	column: number;
	member: string;
	/** `EntityAdapter` of `EntityAdapter<Readonly<ProjectCopy>>`. */
	declaredType: string;
}>;

/**
 * One member rename a library documented, as a claim to be checked. `package`
 * and `type` say which declaration the claim is about; nothing is written on the
 * strength of this record alone.
 */
export type DocumentedMemberRename = Readonly<{
	package: string;
	type: string;
	from: string;
	to: string;
	/** The release that made the rename, for the record and the refusal messages. */
	since: string;
}>;

/**
 * Every member one installed type declares, following the interfaces it extends.
 * `complete` is the reading's own statement about itself: a member list that
 * could not follow an extends clause proves no name absent, and a rename that
 * turned on such a list would be turning on ignorance.
 */
export type TypeMemberSurfaceReading = Readonly<{
	package: string;
	version: string;
	type: string;
	members: readonly string[];
	complete: boolean;
}>;

export type MemberRenameChange = Readonly<{
	kind: 'declared-type-member-rename';
	line: number;
	declaredType: string;
	from: string;
	to: string;
}>;

export type MemberRenameMigration = Readonly<{
	path: string;
	source: string;
	changed: boolean;
	changes: readonly MemberRenameChange[];
	unhandled: readonly string[];
}>;

/**
 * The renames this adapter has been told about.
 *
 * Every entry is inert until a surface reading proves it describes the installed
 * tree. The list is short on purpose: it holds renames of members on types an
 * application reaches through a library's own factory, where the receiver is
 * resolvable by the compiler and the successor is not.
 */
export const DOCUMENTED_MEMBER_RENAMES: readonly DocumentedMemberRename[] = Object.freeze([
	Object.freeze({
		package: '@ngrx/entity',
		type: 'EntityAdapter',
		from: 'addAll',
		to: 'setAll',
		since: '@ngrx/entity 10',
	}),
]);

/** The head of a printed type: `EntityAdapter` of `EntityAdapter<Readonly<X>>`. */
export function typeHead(printed: string): string {
	const open = printed.indexOf('<');
	return open === -1 ? printed : printed.slice(0, open);
}

/** The property identifier of a member expression that starts exactly at `offset`. */
function propertyAt(module: SemanticModule, offset: number): AstNode | null {
	let found: AstNode | null = null;
	forEachNode(module.ast, (node) => {
		if (found !== null) return;
		if (node.type !== 'MemberExpression') return;
		const property = node.property;
		if (node.computed) return;
		if (property.type !== 'Identifier') return;
		if (property.start === offset) found = property;
	});
	return found;
}

/**
 * Apply the documented renames to one module, where the compiler resolved the
 * receiver and the closure proves the rename.
 */
export function renameDeclaredTypeMembers(
	path: string,
	source: string,
	diagnostics: readonly MissingMemberDiagnostic[],
	renames: readonly DocumentedMemberRename[],
	surfaces: readonly TypeMemberSurfaceReading[],
): MemberRenameMigration {
	const module = parseModule(CAPABILITY, path, source);
	const edits: SourceEdit[] = [];
	const changes: MemberRenameChange[] = [];
	const unhandled: string[] = [];
	const refuse = (line: number, reason: string): void => {
		unhandled.push(`${path} line ${String(line)}: ${reason}`);
	};
	for (const diagnostic of diagnostics) {
		const { line, column, member, declaredType } = diagnostic;
		const candidates = renames.filter(
			(entry) => entry.type === declaredType && entry.from === member,
		);
		if (candidates.length === 0) continue;
		if (candidates.length > 1) {
			refuse(
				line,
				`${String(candidates.length)} renames claim '${declaredType}.${member}', so which one ` +
					'describes this tree is not established',
			);
			continue;
		}
		const rename = candidates[0] as DocumentedMemberRename;
		const surface = surfaces.find(
			(entry) => entry.package === rename.package && entry.type === rename.type,
		);
		if (surface === undefined) {
			refuse(line, `no member surface was read for '${rename.package}' ${rename.type}`);
			continue;
		}
		if (!surface.complete) {
			refuse(
				line,
				`the member surface of ${rename.type} in '${rename.package}'@${surface.version} is ` +
					`incomplete, so it cannot establish that ${rename.to} is declared or that ` +
					`${rename.from} is not`,
			);
			continue;
		}
		if (!surface.members.includes(rename.to)) {
			refuse(
				line,
				`${rename.since} is said to have renamed ${rename.from} to ${rename.to}, and ` +
					`${rename.type} in '${rename.package}'@${surface.version} does not declare ${rename.to}`,
			);
			continue;
		}
		if (surface.members.includes(rename.from)) {
			refuse(
				line,
				`${rename.type} in '${rename.package}'@${surface.version} still declares ${rename.from}, ` +
					'so the diagnostic does not describe this closure and the rename would be a rewrite ' +
					'of working code',
			);
			continue;
		}
		const offset = offsetOfPosition(source, line, column);
		if (offset === null) {
			refuse(line, `column ${String(column)} is not a position in this file`);
			continue;
		}
		if (source.slice(offset, offset + member.length) !== member) {
			refuse(line, `column ${String(column)} is not where '${member}' is written`);
			continue;
		}
		const property = propertyAt(module, offset);
		if (property === null) {
			refuse(
				line,
				`column ${String(column)} is not the property of a static member expression, so the ` +
					`${member} the compiler named cannot be placed`,
			);
			continue;
		}
		edits.push({ start: property.start, end: property.end, text: rename.to });
		changes.push({
			kind: 'declared-type-member-rename',
			line: lineOf(source, property.start),
			declaredType,
			from: rename.from,
			to: rename.to,
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
 * The `TS2339` lines of a build log, decomposed into diagnostics by file.
 *
 * Only the lines whose message carries a declared type are read. A TS2339 that
 * names no type — the ones a component's own template raises against the
 * component class — resolves no receiver, and a capability that treated the two
 * alike would be renaming members on whatever object happened to be there.
 */
export function readMissingMembers(
	log: string,
): ReadonlyMap<string, readonly MissingMemberDiagnostic[]> {
	const found = new Map<string, MissingMemberDiagnostic[]>();
	for (const line of log.split('\n')) {
		const head = DIAGNOSTIC_HEAD.exec(line.trim())?.groups;
		const message = MISSING_PROPERTY.exec(line)?.groups;
		if (head === undefined || message === undefined) continue;
		const entry: MissingMemberDiagnostic = Object.freeze({
			line: Number(head['line']),
			column: Number(head['column']),
			member: message['member'] as string,
			declaredType: typeHead(message['type'] as string),
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
		.and(exactly(' - error TS2339: ')),
);

/** The message body, which names the member and the type its receiver resolved to. */
const MISSING_PROPERTY = createRegExp(
	exactly("Property '")
		.and(oneOrMore(charNotIn("'")).as('member'))
		.and(exactly("' does not exist on type '"))
		.and(oneOrMore(charNotIn("'")).as('type'))
		.and(exactly("'.")),
);
