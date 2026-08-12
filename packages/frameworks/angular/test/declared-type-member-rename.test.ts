import { describe, expect, it } from 'vitest';
import {
	readMissingMembers,
	renameDeclaredTypeMembers,
	typeHead,
	DOCUMENTED_MEMBER_RENAMES,
	type DocumentedMemberRename,
	type TypeMemberSurfaceReading,
} from '../src/declared-type-member-rename.ts';

const entity: TypeMemberSurfaceReading = Object.freeze({
	package: '@ngrx/entity',
	version: '16.3.0',
	type: 'EntityAdapter',
	members: Object.freeze(['addMany', 'addOne', 'removeAll', 'setAll', 'setOne']),
	complete: true,
});

const reducer = [
	"import {createEntityAdapter} from '@ngrx/entity';",
	'const projectAdapter = createEntityAdapter<Project>();',
	'export function reducer(state, action) {',
	'  return projectAdapter.addAll(action.payload.projects, state);',
	'}',
	'',
].join('\n');

const at = (source: string, needle: string): Readonly<{ line: number; column: number }> => {
	const lines = source.split('\n');
	const line = lines.findIndex((entry) => entry.includes(needle));
	return Object.freeze({ line: line + 1, column: (lines[line]?.indexOf(needle) ?? 0) + 1 });
};

describe('typeHead', () => {
	it('drops the arguments of a printed type reference', () => {
		expect(typeHead('EntityAdapter<Readonly<ProjectCopy>>')).toBe('EntityAdapter');
		expect(typeHead('KeyboardInputComponent')).toBe('KeyboardInputComponent');
	});
});

describe('readMissingMembers', () => {
	it('decomposes the member and the type its receiver resolved to', () => {
		const log = [
			'Error: src/app/p.reducer.ts:248:29 - error TS2339: ' +
				"Property 'addAll' does not exist on type 'EntityAdapter<Readonly<ProjectCopy>>'.",
			'Error: src/app/x.component.html:6:23 - error TS2339: ' +
				"Property 'to' does not exist on type 'XComponent'.",
		].join('\n');
		const byFile = readMissingMembers(log);
		expect(byFile.get('src/app/p.reducer.ts')).toEqual([
			{ line: 248, column: 29, member: 'addAll', declaredType: 'EntityAdapter' },
		]);
		expect(byFile.get('src/app/x.component.html')).toEqual([
			{ line: 6, column: 23, member: 'to', declaredType: 'XComponent' },
		]);
	});
});

describe('DOCUMENTED_MEMBER_RENAMES', () => {
	it('names the package and type each claim is about', () => {
		for (const rename of DOCUMENTED_MEMBER_RENAMES) {
			expect(rename.package).not.toBe('');
			expect(rename.type).not.toBe('');
			expect(rename.from).not.toBe(rename.to);
		}
	});
});

describe('renameDeclaredTypeMembers', () => {
	const position = at(reducer, 'addAll');

	it('renames the member the surface proves was renamed', () => {
		const result = renameDeclaredTypeMembers(
			'p.reducer.ts',
			reducer,
			[{ ...position, member: 'addAll', declaredType: 'EntityAdapter' }],
			DOCUMENTED_MEMBER_RENAMES,
			[entity],
		);
		expect(result.unhandled).toEqual([]);
		expect(result.changed).toBe(true);
		expect(result.source).toContain('projectAdapter.setAll(action.payload.projects, state)');
		expect(result.changes).toEqual([
			{
				kind: 'declared-type-member-rename',
				line: position.line,
				declaredType: 'EntityAdapter',
				from: 'addAll',
				to: 'setAll',
			},
		]);
	});

	it('leaves a diagnostic no rename claims alone, without refusing it', () => {
		const result = renameDeclaredTypeMembers(
			'x.component.ts',
			reducer,
			[{ line: 4, column: 25, member: 'to', declaredType: 'XComponent' }],
			DOCUMENTED_MEMBER_RENAMES,
			[entity],
		);
		expect(result.changed).toBe(false);
		expect(result.unhandled).toEqual([]);
	});

	it('refuses when the installed type still declares the old member', () => {
		const old: TypeMemberSurfaceReading = Object.freeze({
			...entity,
			version: '8.6.0',
			members: Object.freeze(['addAll', 'addMany', 'addOne', 'setAll']),
		});
		const result = renameDeclaredTypeMembers(
			'p.reducer.ts',
			reducer,
			[{ ...position, member: 'addAll', declaredType: 'EntityAdapter' }],
			DOCUMENTED_MEMBER_RENAMES,
			[old],
		);
		expect(result.changed).toBe(false);
		expect(result.unhandled[0]).toContain('still declares addAll');
	});

	it('refuses when the installed type does not declare the successor', () => {
		const without: TypeMemberSurfaceReading = Object.freeze({
			...entity,
			members: Object.freeze(['addMany', 'addOne']),
		});
		const result = renameDeclaredTypeMembers(
			'p.reducer.ts',
			reducer,
			[{ ...position, member: 'addAll', declaredType: 'EntityAdapter' }],
			DOCUMENTED_MEMBER_RENAMES,
			[without],
		);
		expect(result.changed).toBe(false);
		expect(result.unhandled[0]).toContain('does not declare setAll');
	});

	it('refuses an incomplete surface, which proves no name absent', () => {
		const partial: TypeMemberSurfaceReading = Object.freeze({ ...entity, complete: false });
		const result = renameDeclaredTypeMembers(
			'p.reducer.ts',
			reducer,
			[{ ...position, member: 'addAll', declaredType: 'EntityAdapter' }],
			DOCUMENTED_MEMBER_RENAMES,
			[partial],
		);
		expect(result.changed).toBe(false);
		expect(result.unhandled[0]).toContain('is incomplete');
	});

	it('refuses when no surface was read for the type', () => {
		const result = renameDeclaredTypeMembers(
			'p.reducer.ts',
			reducer,
			[{ ...position, member: 'addAll', declaredType: 'EntityAdapter' }],
			DOCUMENTED_MEMBER_RENAMES,
			[],
		);
		expect(result.changed).toBe(false);
		expect(result.unhandled[0]).toContain('no member surface was read');
	});

	it('refuses a position that is not where the member is written', () => {
		const result = renameDeclaredTypeMembers(
			'p.reducer.ts',
			reducer,
			[{ line: position.line, column: 1, member: 'addAll', declaredType: 'EntityAdapter' }],
			DOCUMENTED_MEMBER_RENAMES,
			[entity],
		);
		expect(result.changed).toBe(false);
		expect(result.unhandled[0]).toContain("is not where 'addAll' is written");
	});

	it('refuses two claims about one member, which establish neither', () => {
		const twice: readonly DocumentedMemberRename[] = Object.freeze([
			Object.freeze({
				package: '@ngrx/entity',
				type: 'EntityAdapter',
				from: 'addAll',
				to: 'setAll',
				since: '@ngrx/entity 10',
			}),
			Object.freeze({
				package: '@ngrx/entity',
				type: 'EntityAdapter',
				from: 'addAll',
				to: 'setMany',
				since: 'somewhere else',
			}),
		]);
		const result = renameDeclaredTypeMembers(
			'p.reducer.ts',
			reducer,
			[{ ...position, member: 'addAll', declaredType: 'EntityAdapter' }],
			twice,
			[entity],
		);
		expect(result.changed).toBe(false);
		expect(result.unhandled[0]).toContain('2 renames claim');
	});

	it('refuses a position that is not a static member expression', () => {
		const computed = [
			'const adapter = {} as any;',
			"const key = 'addAll';",
			'export const x = adapter[key];',
			'',
		].join('\n');
		const where = at(computed, 'addAll');
		const result = renameDeclaredTypeMembers(
			'p.reducer.ts',
			computed,
			[{ ...where, member: 'addAll', declaredType: 'EntityAdapter' }],
			DOCUMENTED_MEMBER_RENAMES,
			[entity],
		);
		expect(result.changed).toBe(false);
		expect(result.unhandled[0]).toContain('is not the property of a static member expression');
	});
});
