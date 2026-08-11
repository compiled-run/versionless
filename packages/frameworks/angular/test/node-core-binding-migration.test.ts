import { describe, expect, it } from 'vitest';
import {
	migrateNodeCoreBindings,
	readFormatDirectives,
} from '../src/node-core-binding-migration.ts';

const migrate = (source: string) => migrateNodeCoreBindings('src/app/thing.ts', source, 'util');

describe('readFormatDirectives', () => {
	it('splits a %s-only format string into its literal pieces', () => {
		expect(readFormatDirectives('a %s b %s')).toEqual(['a ', ' b ', '']);
	});

	it('reads %% as a literal percent rather than a directive', () => {
		expect(readFormatDirectives('100%% of %s')).toEqual(['100% of ', '']);
	});

	it('refuses a format string carrying any other directive', () => {
		expect(readFormatDirectives('%d items')).toBeNull();
		expect(readFormatDirectives('%j')).toBeNull();
	});
});

describe('migrateNodeCoreBindings', () => {
	it('expands the legacy type checks onto the language and drops the import', () => {
		const migration = migrate(
			[
				"import {isNullOrUndefined, isString} from 'util';",
				'',
				'export function read(value: unknown, fallback: string): string {',
				'  if (isNullOrUndefined(value)) { return fallback; }',
				'  return isString(value) ? value : fallback;',
				'}',
			].join('\n'),
		);
		expect(migration.changed).toBe(true);
		expect(migration.source).not.toContain("from 'util'");
		expect(migration.source).toContain('if ((value == null))');
		expect(migration.source).toContain("(typeof value === 'string')");
	});

	it('evaluates a call-expression argument exactly once', () => {
		const migration = migrate(
			["import {isNullOrUndefined} from 'util';", 'export const x = isNullOrUndefined(load());'].join(
				'\n',
			),
		);
		expect(migration.source).toContain('export const x = (load() == null);');
		expect(migration.source.match(/load\(\)/gu)).toHaveLength(1);
	});

	it('parenthesises an argument an operator would otherwise split', () => {
		const migration = migrate(
			["import {isString} from 'util';", 'export const x = isString(a ? b : c);'].join('\n'),
		);
		expect(migration.source).toContain("(typeof (a ? b : c) === 'string')");
	});

	it('turns a %s format call into a template literal', () => {
		const migration = migrate(
			[
				"import {format} from 'util';",
				"export const line = format('total: %s\\nfailed: %s', this.total, this.failed);",
			].join('\n'),
		);
		expect(migration.source).toContain(
			'export const line = `total: ${String(this.total)}\\nfailed: ${String(this.failed)}`;',
		);
		expect(migration.declaredDifferences).toHaveLength(1);
		expect(migration.declaredDifferences[0]).toContain('inspected before and is stringified now');
	});

	it('escapes template syntax the era format string carried literally', () => {
		const migration = migrate(
			["import {format} from 'util';", "export const line = format('cost ${x} `q` %s', v);"].join(
				'\n',
			),
		);
		expect(migration.source).toContain('`cost \\${x} \\`q\\` ${String(v)}`');
	});

	it('declares no difference for a format call with no arguments to interpolate', () => {
		const migration = migrate(
			["import {format} from 'util';", "export const line = format('nothing to fill');"].join('\n'),
		);
		expect(migration.source).toContain('export const line = `nothing to fill`;');
		expect(migration.declaredDifferences).toEqual([]);
	});

	it('drops an import the module never calls', () => {
		const migration = migrate(
			["import {isNullOrUndefined} from 'util';", 'export const x = 1;'].join('\n'),
		);
		expect(migration.changed).toBe(true);
		expect(migration.source).not.toContain("from 'util'");
	});

	it('refuses the whole module when one binding has no expression spelling', () => {
		const source = [
			"import {isNullOrUndefined, promisify} from 'util';",
			'export const x = isNullOrUndefined(v);',
			'export const y = promisify(f);',
		].join('\n');
		const migration = migrate(source);
		expect(migration.changed).toBe(false);
		expect(migration.source).toBe(source);
		expect(migration.unhandled.join(' ')).toContain('promisify');
	});

	it('refuses a binding passed as a value rather than called', () => {
		const source = [
			"import {isNullOrUndefined} from 'util';",
			'export const found = list.filter(isNullOrUndefined);',
		].join('\n');
		const migration = migrate(source);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('used as a value');
	});

	it('refuses a format call whose format string is not a literal', () => {
		const source = ["import {format} from 'util';", 'export const line = format(template, v);'].join(
			'\n',
		);
		expect(migrate(source).changed).toBe(false);
		expect(migrate(source).unhandled.join(' ')).toContain('cannot read at rest');
	});

	it('refuses a format call whose directives and arguments do not match', () => {
		const source = [
			"import {format} from 'util';",
			"export const line = format('%s and %s', only);",
		].join('\n');
		const migration = migrate(source);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('%s directives');
	});

	it('refuses a namespace import of the core module', () => {
		const source = ["import * as util from 'util';", 'export const x = util.isString(v);'].join('\n');
		const migration = migrate(source);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('namespace binding');
	});

	it('leaves a module that never imports the core module byte-identical', () => {
		const source = "import {Component} from '@angular/core';\n";
		expect(migrate(source).source).toBe(source);
		expect(migrate(source).changed).toBe(false);
	});
});
