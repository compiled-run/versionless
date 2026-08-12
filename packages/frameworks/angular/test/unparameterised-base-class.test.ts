import { describe, expect, it } from 'vitest';
import {
	parameteriseBaseClasses,
	readUnparameterisedBaseClasses,
	type GenericBaseClassReading,
} from '../src/unparameterised-base-class.ts';

const formly: GenericBaseClassReading = Object.freeze({
	name: 'FieldType',
	specifier: '@ngx-formly/material',
	declaration: '@ngx-formly/material/form-field/field.type.d.ts',
	parameters: Object.freeze([
		Object.freeze({ name: 'F', constraint: 'FormlyFieldConfig', hasDefault: false }),
	]),
	companion: Object.freeze({
		name: 'FieldTypeConfig',
		specifier: '@ngx-formly/core',
		extendsConstraint: 'FormlyFieldConfig',
		members: Object.freeze(['formControl', 'props']),
	}),
});

const at = (source: string, needle: string): Readonly<{ line: number; column: number }> => {
	const lines = source.split('\n');
	const line = lines.findIndex((entry) => entry.includes(needle));
	return Object.freeze({ line: line + 1, column: (lines[line]?.indexOf(needle) ?? 0) + 1 });
};

const extendsAt = (source: string): Readonly<{ line: number; column: number }> => {
	const found = at(source, 'extends FieldType');
	return Object.freeze({ line: found.line, column: found.column + 'extends '.length });
};

const component = (extendsClause: string, extra: readonly string[] = []): string =>
	[
		"import {Component} from '@angular/core';",
		"import {FieldType} from '@ngx-formly/material';",
		...extra,
		'',
		"@Component({selector: 'x', template: ''})",
		`export class XComponent extends ${extendsClause} {`,
		'  get type() { return this.props.type; }',
		'}',
		'',
	].join('\n');

describe('readUnparameterisedBaseClasses', () => {
	it('decomposes the compiler position, the type and its printed parameters', () => {
		const log = [
			'Error: src/app/x.component.ts:6:33 - error TS2314: ' +
				"Generic type 'FieldType<F>' requires 1 type argument(s).",
			'Error: src/app/y.component.ts:2:10 - error TS2305: ' +
				"Module '\"ng2-charts\"' has no exported member 'Label'.",
		].join('\n');
		const byFile = readUnparameterisedBaseClasses(log);
		expect([...byFile.keys()]).toEqual(['src/app/x.component.ts']);
		expect(byFile.get('src/app/x.component.ts')).toEqual([
			{ line: 6, column: 33, base: 'FieldType', parameters: ['F'], required: 1 },
		]);
	});

	it('keeps every parameter of a multi-parameter type in order', () => {
		const log =
			'Error: a.ts:1:1 - error TS2314: ' +
			"Generic type 'Store<S, A>' requires 2 type argument(s).";
		expect(readUnparameterisedBaseClasses(log).get('a.ts')).toEqual([
			{ line: 1, column: 1, base: 'Store', parameters: ['S', 'A'], required: 2 },
		]);
	});

	it('reads nothing from a line whose type prints no parameter list', () => {
		const log = "Error: a.ts:1:1 - error TS2314: Generic type 'Store' requires 1 type argument(s).";
		expect(readUnparameterisedBaseClasses(log).size).toBe(0);
	});
});

const bare = component('FieldType');
const bareAt = extendsAt(bare);
const bareDiagnostic = Object.freeze({
	...bareAt,
	base: 'FieldType',
	parameters: Object.freeze(['F']),
	required: 1,
});

describe('parameteriseBaseClasses', () => {
	it('writes the companion into the extends clause and imports it', () => {
		const source = bare;
		const result = parameteriseBaseClasses(
			'x.component.ts',
			source,
			[bareDiagnostic],
			[formly],
		);
		expect(result.unhandled).toEqual([]);
		expect(result.changed).toBe(true);
		expect(result.source).toContain('extends FieldType<FieldTypeConfig> {');
		expect(result.source).toContain("import {FieldTypeConfig} from '@ngx-formly/core';");
		expect(result.changes).toEqual([
			{
				kind: 'unparameterised-base-class',
				line: bareAt.line,
				base: 'FieldType',
				argument: 'FieldTypeConfig',
				specifier: '@ngx-formly/core',
				importAdded: true,
			},
		]);
	});

	it('adds the name to a declaration the module already has for that package', () => {
		const source = component('FieldType', [
			"import {FormlyFieldConfig} from '@ngx-formly/core';",
		]);
		const result = parameteriseBaseClasses(
			'x.component.ts',
			source,
			[{ ...extendsAt(source), base: 'FieldType', parameters: ['F'], required: 1 }],
			[formly],
		);
		expect(result.unhandled).toEqual([]);
		expect(result.source).toContain(
			"import {FormlyFieldConfig, FieldTypeConfig} from '@ngx-formly/core';",
		);
		expect(result.source).not.toContain("import {FieldTypeConfig} from");
		expect(result.changes[0]?.importAdded).toBe(false);
	});

	it('refuses a parameter the installed declaration gives a default', () => {
		const defaulted: GenericBaseClassReading = Object.freeze({
			...formly,
			parameters: Object.freeze([
				Object.freeze({ name: 'F', constraint: 'FormlyFieldConfig', hasDefault: true }),
			]),
		});
		const result = parameteriseBaseClasses(
			'x.component.ts',
			bare,
			[bareDiagnostic],
			[defaulted],
		);
		expect(result.changed).toBe(false);
		expect(result.unhandled).toEqual([
			`x.component.ts line ${String(bareAt.line)}: ` +
				'@ngx-formly/material/form-field/field.type.d.ts gives ' +
				"'F' a default, so TS2314 does not describe this declaration and the reading is of the " +
				'wrong tree',
		]);
	});

	it('refuses a companion that does not extend the parameter constraint', () => {
		const unrelated: GenericBaseClassReading = Object.freeze({
			...formly,
			companion: Object.freeze({
				name: 'FieldTypeConfig',
				specifier: '@ngx-formly/core',
				extendsConstraint: 'SomethingElse',
				members: Object.freeze(['props']),
			}),
		});
		const result = parameteriseBaseClasses(
			'x.component.ts',
			bare,
			[bareDiagnostic],
			[unrelated],
		);
		expect(result.changed).toBe(false);
		expect(result.unhandled[0]).toContain("extends 'SomethingElse'");
	});

	it('refuses a companion the closure did not find', () => {
		const none: GenericBaseClassReading = Object.freeze({ ...formly, companion: null });
		const result = parameteriseBaseClasses(
			'x.component.ts',
			bare,
			[bareDiagnostic],
			[none],
		);
		expect(result.changed).toBe(false);
		expect(result.unhandled[0]).toContain('publishes no companion type');
	});

	it('refuses a companion that narrows nothing', () => {
		const empty: GenericBaseClassReading = Object.freeze({
			...formly,
			companion: Object.freeze({
				name: 'FieldTypeConfig',
				specifier: '@ngx-formly/core',
				extendsConstraint: 'FormlyFieldConfig',
				members: Object.freeze([]),
			}),
		});
		const result = parameteriseBaseClasses(
			'x.component.ts',
			bare,
			[bareDiagnostic],
			[empty],
		);
		expect(result.changed).toBe(false);
		expect(result.unhandled[0]).toContain('declares no members of its own');
	});

	it('refuses a type that requires more than one argument', () => {
		const two: GenericBaseClassReading = Object.freeze({
			...formly,
			parameters: Object.freeze([
				Object.freeze({ name: 'F', constraint: 'FormlyFieldConfig', hasDefault: false }),
				Object.freeze({ name: 'G', constraint: 'FormlyFieldConfig', hasDefault: false }),
			]),
		});
		const result = parameteriseBaseClasses(
			'x.component.ts',
			bare,
			[{ ...bareAt, base: 'FieldType', parameters: ['F', 'G'], required: 2 }],
			[two],
		);
		expect(result.changed).toBe(false);
		expect(result.unhandled[0]).toContain('requires 2 type arguments');
	});

	it('refuses a base class the module declares rather than imports', () => {
		const source = [
			'abstract class FieldType<F> { field: F; }',
			'export class XComponent extends FieldType {}',
			'',
		].join('\n');
		const result = parameteriseBaseClasses(
			'x.component.ts',
			source,
			[{ line: 2, column: 33, base: 'FieldType', parameters: ['F'], required: 1 }],
			[formly],
		);
		expect(result.changed).toBe(false);
		expect(result.unhandled[0]).toContain('rather than one it imports');
	});

	it('refuses a module whose import comes from another package', () => {
		const source = [
			"import {FieldType} from '@ngx-formly/core';",
			'export class XComponent extends FieldType {}',
			'',
		].join('\n');
		const result = parameteriseBaseClasses(
			'x.component.ts',
			source,
			[{ line: 2, column: 33, base: 'FieldType', parameters: ['F'], required: 1 }],
			[formly],
		);
		expect(result.changed).toBe(false);
		expect(result.unhandled[0]).toContain("this module imports it from '@ngx-formly/core'");
	});

	it('refuses when the companion name is already declared in the module', () => {
		const source = [
			"import {FieldType} from '@ngx-formly/material';",
			'interface FieldTypeConfig { own: true }',
			'export class XComponent extends FieldType {}',
			'',
		].join('\n');
		const result = parameteriseBaseClasses(
			'x.component.ts',
			source,
			[{ line: 3, column: 33, base: 'FieldType', parameters: ['F'], required: 1 }],
			[formly],
		);
		expect(result.changed).toBe(false);
		expect(result.unhandled[0]).toContain('is already declared in this module');
	});

	it('refuses a position that is not where the compiler said the type is', () => {
		const result = parameteriseBaseClasses(
			'x.component.ts',
			bare,
			[{ line: bareAt.line, column: 1, base: 'FieldType', parameters: ['F'], required: 1 }],
			[formly],
		);
		expect(result.changed).toBe(false);
		expect(result.unhandled[0]).toContain("is not where 'FieldType' is written");
	});

	it('leaves a clause that already carries a type argument alone', () => {
		const source = component('FieldType<FieldTypeConfig>', [
			"import {FieldTypeConfig} from '@ngx-formly/core';",
		]);
		const result = parameteriseBaseClasses(
			'x.component.ts',
			source,
			[{ ...extendsAt(source), base: 'FieldType', parameters: ['F'], required: 1 }],
			[formly],
		);
		expect(result.changed).toBe(false);
		expect(result.unhandled[0]).toContain('already carries a type argument list');
	});
});
