import { describe, expect, it } from 'vitest';
import {
	accommodateDepartedDomMembers,
	isVendorPrefixedStyleMember,
	WIDENED_STYLE_TYPE,
} from '../src/departed-dom-lib-member.ts';
import { readMissingMembers } from '../src/declared-type-member-rename.ts';

const source = `export class OverlayService {
  getScrollbarWidth(): number {
    const outer = document.createElement('div');
    outer.style.visibility = 'hidden';
    outer.style.msOverflowStyle = 'scrollbar'; // needed for WinJS apps
    return outer.offsetWidth;
  }
}
`;

const diagnostic = Object.freeze({
	line: 5,
	column: 17,
	member: 'msOverflowStyle',
	declaredType: 'CSSStyleDeclaration',
});

describe('departed DOM lib member', () => {
	it('widens the receiver at the one access the compiler named', () => {
		const migrated = accommodateDepartedDomMembers('overlay.service.ts', source, [diagnostic]);
		expect(migrated.changed).toBe(true);
		expect(migrated.source).toContain(
			`(outer.style as ${WIDENED_STYLE_TYPE}).msOverflowStyle = 'scrollbar';`,
		);
		expect(migrated.source).toContain("outer.style.visibility = 'hidden';");
		expect(migrated.changes[0]?.receiver).toBe('outer.style');
		expect(migrated.unhandled).toHaveLength(0);
	});

	it('is idempotent: the position it already answered is no longer where the member is written', () => {
		const once = accommodateDepartedDomMembers('overlay.service.ts', source, [diagnostic]);
		const twice = accommodateDepartedDomMembers('overlay.service.ts', once.source, [
			diagnostic,
		]);
		expect(twice.changed).toBe(false);
		expect(twice.source).toBe(once.source);
		expect(twice.unhandled.join(' ')).toContain("is not where 'msOverflowStyle' is written");
	});

	it('refuses a member that is not spelled as a vendor-prefixed CSS property', () => {
		const migrated = accommodateDepartedDomMembers('overlay.service.ts', source, [
			{ ...diagnostic, member: 'visibility', line: 4, column: 17 },
		]);
		expect(migrated.changed).toBe(false);
		expect(migrated.unhandled.join(' ')).toContain(
			'not spelled as a vendor-prefixed CSS property',
		);
	});

	it('passes over a diagnostic whose receiver is not a style declaration', () => {
		const migrated = accommodateDepartedDomMembers('overlay.service.ts', source, [
			{ ...diagnostic, declaredType: 'HTMLDivElement' },
		]);
		expect(migrated.changed).toBe(false);
		expect(migrated.unhandled).toHaveLength(0);
	});

	it('refuses a position that does not carry the member', () => {
		const migrated = accommodateDepartedDomMembers('overlay.service.ts', source, [
			{ ...diagnostic, column: 3 },
		]);
		expect(migrated.changed).toBe(false);
		expect(migrated.unhandled).toHaveLength(1);
	});

	it('reads its diagnostics out of a build log', () => {
		const log = [
			'Error: frontend/app/ui/gallery/overlay.service.ts:27:19 - error TS2339: ' +
				"Property 'msOverflowStyle' does not exist on type 'CSSStyleDeclaration'.",
			'',
		].join('\n');
		const read = readMissingMembers(log);
		expect(read.get('frontend/app/ui/gallery/overlay.service.ts')).toEqual([
			{
				line: 27,
				column: 19,
				member: 'msOverflowStyle',
				declaredType: 'CSSStyleDeclaration',
			},
		]);
	});

	it('spells the vendor prefixes the CSSOM spells', () => {
		expect(isVendorPrefixedStyleMember('msOverflowStyle')).toBe(true);
		expect(isVendorPrefixedStyleMember('webkitLineClamp')).toBe(true);
		expect(isVendorPrefixedStyleMember('overflow')).toBe(false);
		expect(isVendorPrefixedStyleMember('msoverflowstyle')).toBe(false);
	});
});
