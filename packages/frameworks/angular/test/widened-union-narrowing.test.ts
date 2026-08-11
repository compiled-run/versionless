import { describe, expect, it } from 'vitest';
import {
	narrowWidenedAssignments,
	unionMembers,
	type WidenedAssignmentDiagnostic,
} from '../src/widened-union-narrowing.ts';

/** The shape the compiler flags: a widened read, then two statements that use it. */
const service = [
	'export function read(reader: FileReader, sink: Sink): void {',
	'  reader.onloadend = () => {',
	'    const content = reader.result;',
	'    sink.next({content: content});',
	'    sink.complete();',
	'  };',
	'}',
	'',
].join('\n');

/** The position of `content` inside `{content: content}` — the key, where TypeScript points. */
const flagged: WidenedAssignmentDiagnostic = Object.freeze({
	line: 4,
	column: 16,
	sourceType: 'string | ArrayBuffer',
	targetType: 'string',
});

describe('widened union narrowing', () => {
	it('reads a plain union and refuses a printed type that is not one', () => {
		expect(unionMembers('string | ArrayBuffer')).toEqual(['string', 'ArrayBuffer']);
		expect(unionMembers('string')).toBeNull();
		expect(unionMembers('Array<string | number>')).toBeNull();
	});

	it('guards every statement after the declaration to the end of the block', () => {
		const migration = narrowWidenedAssignments('src/reader.ts', service, [flagged]);
		expect(migration.changed).toBe(true);
		expect(migration.source).toContain("if (typeof content === 'string') {");
		expect(migration.source).toContain('      sink.next({content: content});');
		expect(migration.source).toContain('      sink.complete();');
		expect(migration.changes[0]?.statementsGuarded).toBe(2);
		expect(migration.unhandled).toEqual([]);
	});

	it('states the behaviour the guard changes rather than hiding it', () => {
		const migration = narrowWidenedAssignments('src/reader.ts', service, [flagged]);
		expect(migration.declaredDifferences).toHaveLength(1);
		expect(migration.declaredDifferences[0]).toContain('no longer run');
	});

	it('is idempotent: the guarded module produces no second diagnostic to act on', () => {
		const once = narrowWidenedAssignments('src/reader.ts', service, [flagged]);
		const twice = narrowWidenedAssignments('src/reader.ts', once.source, []);
		expect(twice.changed).toBe(false);
	});

	it('refuses a binding that is not const, because a guard would not narrow its later uses', () => {
		const source = service.replace('const content', 'let content');
		const migration = narrowWidenedAssignments('src/reader.ts', source, [flagged]);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled[0]).toContain('const');
	});

	it('refuses when the binding is referenced outside the statements the guard would cover', () => {
		const source = [
			'export function read(reader: FileReader, sink: Sink): void {',
			'  const content = reader.result;',
			'  sink.next({content: content});',
			'  after(content);',
			'}',
			'function after(value: unknown): void {}',
			'',
		].join('\n');
		const migration = narrowWidenedAssignments('src/reader.ts', source, [
			{ line: 3, column: 14, sourceType: 'string | ArrayBuffer', targetType: 'string' },
		]);
		expect(migration.changed).toBe(true);
		expect(migration.source).toContain("if (typeof content === 'string') {");
		// A hoisted function declared before the `const` can read it from outside
		// the suffix a guard would cover, and that is exactly the case refused.
		const escaping = narrowWidenedAssignments(
			'src/reader.ts',
			[
				'export function read(reader: FileReader, sink: Sink): void {',
				'  function later() { return content; }',
				'  const content = reader.result;',
				'  sink.next({content: content});',
				'}',
				'',
			].join('\n'),
			[{ line: 4, column: 14, sourceType: 'string | ArrayBuffer', targetType: 'string' }],
		);
		expect(escaping.changed).toBe(false);
		expect(escaping.unhandled[0]).toContain('referenced outside');
	});

	it('refuses a wanted type typeof cannot test for', () => {
		const migration = narrowWidenedAssignments('src/reader.ts', service, [
			{ ...flagged, targetType: 'ArrayBuffer' },
		]);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled[0]).toContain('typeof');
	});

	it('refuses a target that is not a member of the union the compiler named', () => {
		const migration = narrowWidenedAssignments('src/reader.ts', service, [
			{ ...flagged, targetType: 'number' },
		]);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled[0]).toContain('conversion rather than a narrowing');
	});

	it('does nothing to a module the compiler flagged nothing in', () => {
		const migration = narrowWidenedAssignments('src/reader.ts', service, []);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled).toEqual([]);
	});
});
