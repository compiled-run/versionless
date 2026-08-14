/**
 * A DOM property the era's `lib.dom.d.ts` declared and a later one does not.
 *
 * TypeScript ships the DOM as a declaration file, and that file is regenerated
 * from the web platform's own specifications. Properties that never became
 * standard — the vendor-prefixed surface browsers shipped ahead of, or instead
 * of, a specification — were removed from it as the generator's sources dropped
 * them. `msOverflowStyle` is one: TypeScript 3.4's `CSSStyleDeclaration`
 * declared it, TypeScript 5.1's does not.
 *
 * What moved is the declaration, not the platform. The property still exists in
 * the engines that implemented it, the assignment still does what it did, and
 * the application's own comment usually says which platform it is for. So this
 * is a *type-level* discontinuity and the accommodation is type-level: the
 * receiver is widened, at that one member access, to the index signature every
 * CSS style declaration has anyway, and the emitted JavaScript is byte for byte
 * what it was.
 *
 * ## The boundary, and why it is drawn here
 *
 * A cast is a claim, and a capability that wrote one wherever the compiler said
 * a property was missing would be silencing the compiler rather than answering
 * it. Two conditions have to hold together, and both are read rather than
 * assumed:
 *
 * - The compiler resolved the receiver to {@link STYLE_DECLARATION_TYPE}. That
 *   is a DOM type whose entire published surface is string-valued CSS
 *   properties, and whose declaration already carries `[index: number]: string`
 *   and `getPropertyValue(): string` — so widening it to a string-keyed record
 *   states nothing about it that the platform does not.
 * - The member is **vendor-prefixed**: `ms`, `webkit`, `moz` or `o` followed by
 *   an uppercase letter, which is the CSSOM's own spelling for a
 *   vendor-prefixed CSS property. That is the shape of the surface that
 *   departed. A member that is not spelled that way is a member the current
 *   declaration was never expected to carry, and this capability leaves it for
 *   whoever knows why it is being reached for.
 *
 * Nothing here carries a list of departed properties, and there is deliberately
 * no place to put one: the property is the compiler's word, and the rule above
 * decides what to do about it.
 *
 * Everything else is refused by name. A read of the compiler's own position that
 * does not find the member written there — because a capability earlier in the
 * sequence moved it — refuses rather than editing at a stale offset, which is
 * also what makes a second application of the same diagnostics a no-op.
 */

import { charIn, createRegExp, exactly } from 'magic-regexp';
import { compareStrings } from './angular-target-cell.ts';
import { type MissingMemberDiagnostic } from './declared-type-member-rename.ts';
import {
	applySourceEdits,
	forEachNode,
	lineOf,
	offsetOfPosition,
	parseModule,
	type AstNode,
	type SourceEdit,
} from './semantic-module.ts';

const CAPABILITY = 'Departed DOM lib member';

/** The declared type whose members this capability will widen. */
export const STYLE_DECLARATION_TYPE = 'CSSStyleDeclaration';

/**
 * The type written into the cast: the declared type the compiler resolved,
 * intersected with the string-keyed record the CSSOM already is. The declared
 * type is kept in the intersection so every member that *is* declared keeps its
 * own type and its own completions.
 */
export const WIDENED_STYLE_TYPE = `${STYLE_DECLARATION_TYPE} & Record<string, string>`;

/**
 * The CSSOM spelling of a vendor-prefixed CSS property: a vendor token followed
 * by a capitalised property name.
 */
const VENDOR_PREFIXED_MEMBER = createRegExp(
	exactly('ms')
		.or(exactly('webkit'))
		.or(exactly('moz'))
		.or(exactly('o'))
		.at.lineStart()
		.and(charIn('ABCDEFGHIJKLMNOPQRSTUVWXYZ')),
);

/** Whether a member name is spelled as a vendor-prefixed CSS property. */
export function isVendorPrefixedStyleMember(name: string): boolean {
	return VENDOR_PREFIXED_MEMBER.test(name);
}

export type DepartedDomMemberChange = Readonly<{
	kind: 'departed-dom-lib-member';
	line: number;
	/** The member the current declaration no longer carries. */
	member: string;
	/** The type the compiler resolved the receiver to. */
	declaredType: string;
	/** The receiver expression, exactly as the application wrote it. */
	receiver: string;
	/** The type the receiver was widened to at this one access. */
	widenedTo: string;
}>;

export type DepartedDomMemberMigration = Readonly<{
	path: string;
	source: string;
	changed: boolean;
	changes: readonly DepartedDomMemberChange[];
	unhandled: readonly string[];
}>;

type MemberAccess = Extract<AstNode, { type: 'MemberExpression' }>;

/** The non-computed member access whose property name starts at `offset`. */
function memberAccessAt(root: AstNode, offset: number): MemberAccess | null {
	let found: MemberAccess | null = null;
	forEachNode(root, (node) => {
		if (found !== null) return;
		if (node.type !== 'MemberExpression' || node.computed) return;
		if (node.property.start === offset) found = node satisfies MemberAccess;
	});
	return found;
}

/**
 * Widen the receiver at every member access a departed DOM declaration made
 * unreachable, in one module.
 *
 * Each diagnostic is answered or refused on its own; a refusal does not stop the
 * next one, because two diagnostics are two facts about two positions.
 */
export function accommodateDepartedDomMembers(
	path: string,
	source: string,
	diagnostics: readonly MissingMemberDiagnostic[],
): DepartedDomMemberMigration {
	if (diagnostics.length === 0)
		return Object.freeze({
			path,
			source,
			changed: false,
			changes: Object.freeze([]),
			unhandled: Object.freeze([]),
		});
	const module = parseModule(CAPABILITY, path, source);
	const edits: SourceEdit[] = [];
	const changes: DepartedDomMemberChange[] = [];
	const unhandled: string[] = [];
	const refuse = (line: number, reason: string): void => {
		unhandled.push(`${path} line ${String(line)}: ${reason}`);
	};
	for (const diagnostic of diagnostics) {
		const { line, column, member, declaredType } = diagnostic;
		if (declaredType !== STYLE_DECLARATION_TYPE) continue;
		if (!isVendorPrefixedStyleMember(member)) {
			refuse(
				line,
				`'${member}' is missing from the declared ${declaredType}, but it is not spelled as a ` +
					'vendor-prefixed CSS property, so it is not a member this capability can say the ' +
					'platform still carries; it was left exactly as it is',
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
		const access = memberAccessAt(module.ast, offset);
		if (access === null) {
			refuse(
				line,
				`column ${String(column)} is not the property of a static member access, so the ` +
					'receiver this capability would widen cannot be read',
			);
			continue;
		}
		const receiver = source.slice(access.object.start, access.object.end);
		edits.push({
			start: access.object.start,
			end: access.object.end,
			text: `(${receiver} as ${WIDENED_STYLE_TYPE})`,
		});
		changes.push(
			Object.freeze({
				kind: 'departed-dom-lib-member' as const,
				line: lineOf(source, access.start),
				member,
				declaredType,
				receiver,
				widenedTo: WIDENED_STYLE_TYPE,
			}),
		);
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
