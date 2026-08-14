/**
 * The composition itself is a capability, and this file tests it as one.
 *
 * A transform that is written, exported and tested but reached by nothing is
 * indistinguishable, from an application's point of view, from a transform that
 * does not exist. The Angular holdout found that twice — `entry-components-removal`
 * before it, and `module-with-providers-type-argument` and
 * `unparameterised-base-class` after — so what these tests assert is not that the
 * capabilities work, which their own files already establish, but that
 * `migrateAngularCliEraWorkspace` *reaches* them: one precondition-positive case
 * per composed capability, one precondition-negative case proving it stands down
 * rather than rewriting, and idempotence over the composed result.
 */

import { describe, expect, it } from 'vitest';
import { ANGULAR_16_BROWSER_CELL } from '../src/angular-target-cell.ts';
import {
	migrateAngularCliEraWorkspace,
	type AngularMigrationInput,
	type WorkspaceFile,
} from '../src/angular-cli-era-migration.ts';
import type { GenericBaseClassReading } from '../src/unparameterised-base-class.ts';

const workspaceConfig = JSON.stringify(
	{
		projects: {
			'any-project': {
				architect: {
					build: {
						builder: '@angular-devkit/build-angular:browser',
						options: { polyfills: 'src/polyfills.ts' },
					},
				},
			},
		},
	},
	null,
	2,
);

const base = Object.freeze({
	packageManifest: {
		path: 'package.json',
		source: JSON.stringify({ name: 'any-workspace', dependencies: {} }, null, 2),
	},
	workspaceConfig: { path: 'angular.json', source: workspaceConfig },
	tsConfig: {
		path: 'tsconfig.json',
		source: JSON.stringify({ compilerOptions: { target: 'es2015' } }, null, 2),
	},
});

/** Compose one application module, and hand back the file the composition made of it. */
function migrateOne(
	module: WorkspaceFile,
	extra: Partial<AngularMigrationInput> = {},
): Readonly<{ source: string; changed: boolean; changes: readonly string[] }> {
	const migration = migrateAngularCliEraWorkspace(
		{ ...base, sourceModules: [module], ...extra },
		ANGULAR_16_BROWSER_CELL,
	);
	const entry = migration.files.find((file) => file.path === module.path);
	if (entry === undefined) throw new Error(`the composition dropped ${module.path}`);
	return Object.freeze({ source: entry.source, changed: entry.changed, changes: entry.changes });
}

/** Compose, then compose again over what the first composition produced. */
function migrateTwice(
	module: WorkspaceFile,
	extra: Partial<AngularMigrationInput> = {},
): Readonly<{ once: string; twice: string; secondChanged: number }> {
	const once = migrateOne(module, extra);
	const migration = migrateAngularCliEraWorkspace(
		{ ...base, sourceModules: [{ path: module.path, source: once.source }], ...extra },
		ANGULAR_16_BROWSER_CELL,
	);
	const entry = migration.files.find((file) => file.path === module.path);
	return Object.freeze({
		once: once.source,
		twice: entry?.source ?? '',
		secondChanged: migration.applicationFilesChanged,
	});
}

describe('the era composition reaches module-with-providers-type-argument', () => {
	const routing = (annotation: string): WorkspaceFile => ({
		path: 'src/app/app.routing.ts',
		source: [
			"import {ModuleWithProviders} from '@angular/core';",
			"import {RouterModule} from '@angular/router';",
			'',
			'const ROUTES = [];',
			`export const appRoutes: ${annotation} = RouterModule.forRoot(ROUTES);`,
			'',
		].join('\n'),
	});

	it('writes the argument the source states, through the composition', () => {
		const migrated = migrateOne(routing('ModuleWithProviders'));
		expect(migrated.changed).toBe(true);
		expect(migrated.source).toContain('ModuleWithProviders<RouterModule>');
		expect(migrated.changes).toContain(
			'line 5: module-with-providers-type-argument <RouterModule> read from static-call-receiver',
		);
	});

	it('stands down on an annotation that already carries its argument', () => {
		const migrated = migrateOne(routing('ModuleWithProviders<RouterModule>'));
		expect(migrated.changed).toBe(false);
		expect(migrated.changes).toEqual([]);
	});

	it('is idempotent through the composition', () => {
		const composed = migrateTwice(routing('ModuleWithProviders'));
		expect(composed.twice).toBe(composed.once);
		expect(composed.secondChanged).toBe(0);
	});
});

describe('the era composition reaches subject-void-type-argument', () => {
	const signal = (next: string): WorkspaceFile => ({
		path: 'src/app/signal.service.ts',
		source: [
			"import {Subject} from 'rxjs';",
			'',
			'export class SignalService {',
			'  private readonly done = new Subject();',
			`  finish() { this.done.next(${next}); }`,
			'}',
			'',
		].join('\n'),
	});

	it('writes void where every settlement carries nothing', () => {
		const migrated = migrateOne(signal(''));
		expect(migrated.changed).toBe(true);
		expect(migrated.source).toContain('new Subject<void>()');
		expect(migrated.changes).toContain(
			'line 4: subject-void-type-argument <void> on done, proved by 1 zero-argument next call(s)',
		);
	});

	it('stands down where one settlement carries something', () => {
		const migrated = migrateOne(signal('1'));
		expect(migrated.changed).toBe(false);
		expect(migrated.source).toContain('new Subject()');
	});

	it('is idempotent through the composition', () => {
		const composed = migrateTwice(signal(''));
		expect(composed.twice).toBe(composed.once);
		expect(composed.secondChanged).toBe(0);
	});
});

describe('the era composition reaches promise-executor-void-parameter', () => {
	const settle = (resolve: string): WorkspaceFile => ({
		path: 'src/app/ready.service.ts',
		source: [
			'export class ReadyService {',
			'  ready() {',
			'    return new Promise((resolve) => {',
			`      resolve(${resolve});`,
			'    });',
			'  }',
			'}',
			'',
		].join('\n'),
	});

	it('writes void where the executor settles with nothing', () => {
		const migrated = migrateOne(settle(''));
		expect(migrated.changed).toBe(true);
		expect(migrated.source).toContain('new Promise<void>(');
		expect(migrated.changes).toContain(
			'line 3: promise-executor-void-parameter <void>, proved by 1 zero-argument resolve call(s)',
		);
	});

	it('stands down where the executor settles with a value', () => {
		const migrated = migrateOne(settle('42'));
		expect(migrated.changed).toBe(false);
		expect(migrated.source).toContain('new Promise((resolve)');
	});

	it('is idempotent through the composition', () => {
		const composed = migrateTwice(settle(''));
		expect(composed.twice).toBe(composed.once);
		expect(composed.secondChanged).toBe(0);
	});
});

describe('the era composition reaches unparameterised-base-class', () => {
	const reading: GenericBaseClassReading = Object.freeze({
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

	const field: WorkspaceFile = {
		path: 'src/app/x.component.ts',
		source: [
			"import {Component} from '@angular/core';",
			"import {FieldType} from '@ngx-formly/material';",
			'',
			"@Component({selector: 'x', template: ''})",
			'export class XComponent extends FieldType {',
			'  get type() { return this.props.type; }',
			'}',
			'',
		].join('\n'),
	};

	/** The compiler's own 1-based position of `FieldType` in the `extends` clause. */
	const diagnostics = Object.freeze([
		Object.freeze({
			path: field.path,
			diagnostics: Object.freeze([
				Object.freeze({
					line: 5,
					column: field.source.split('\n')[4]!.indexOf('FieldType') + 1,
					base: 'FieldType',
					parameters: Object.freeze(['F']),
					required: 1,
				}),
			]),
		}),
	]);

	it('fills the clause the compiler named, through the composition', () => {
		const migrated = migrateOne(field, {
			baseClassDiagnostics: diagnostics,
			genericBaseClasses: [reading],
		});
		expect(migrated.changed).toBe(true);
		expect(migrated.source).toContain('extends FieldType<FieldTypeConfig>');
		expect(migrated.source).toContain("import {FieldTypeConfig} from '@ngx-formly/core'");
		expect(migrated.changes).toContain(
			'line 5: unparameterised-base-class FieldType<FieldTypeConfig> from @ngx-formly/core ' +
				'(import added)',
		);
	});

	it('stands down on a tree that supplies no diagnostics, rather than guessing one', () => {
		const migrated = migrateOne(field, { genericBaseClasses: [reading] });
		expect(migrated.changed).toBe(false);
		expect(migrated.source).toContain('extends FieldType {');
	});

	it('refuses by name when a diagnostic is supplied with no declaration reading', () => {
		const migration = migrateAngularCliEraWorkspace(
			{ ...base, sourceModules: [field], baseClassDiagnostics: diagnostics },
			ANGULAR_16_BROWSER_CELL,
		);
		const entry = migration.files.find((file) => file.path === field.path);
		expect(entry?.changed).toBe(false);
		expect(migration.unhandled).toContain(
			`${field.path} line 5: no declaration reading was taken for 'FieldType'`,
		);
	});

	it('is idempotent through the composition: the second pass has no clause to fill', () => {
		const composed = migrateTwice(field, {
			baseClassDiagnostics: diagnostics,
			genericBaseClasses: [reading],
		});
		expect(composed.twice).toBe(composed.once);
		expect(composed.secondChanged).toBe(0);
	});
});

describe('the composed capabilities are reachable from the composition, not only the barrel', () => {
	it('an application carrying every construct has every one of them answered', () => {
		const module: WorkspaceFile = {
			path: 'src/app/all.ts',
			source: [
				"import {ModuleWithProviders} from '@angular/core';",
				"import {RouterModule} from '@angular/router';",
				"import {Subject} from 'rxjs';",
				'',
				'export const appRoutes: ModuleWithProviders = RouterModule.forRoot([]);',
				'',
				'export class AllService {',
				'  private readonly done = new Subject();',
				'  finish() { this.done.next(); }',
				'  ready() { return new Promise((resolve) => { resolve(); }); }',
				'}',
				'',
			].join('\n'),
		};
		const migrated = migrateOne(module);
		expect(migrated.source).toContain('ModuleWithProviders<RouterModule>');
		expect(migrated.source).toContain('new Subject<void>()');
		expect(migrated.source).toContain('new Promise<void>(');
		expect(migrated.changes.map((change) => change.split(': ')[1]?.split(' ')[0])).toEqual(
			expect.arrayContaining([
				'module-with-providers-type-argument',
				'subject-void-type-argument',
				'promise-executor-void-parameter',
			]),
		);
	});
});
