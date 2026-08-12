import { describe, expect, it } from 'vitest';
import { ANGULAR_16_BROWSER_CELL } from '../src/angular-target-cell.ts';
import {
	carriesJsonComment,
	migrateAngularTsConfig,
	migrateAngularWorkspace,
} from '../src/angular-workspace-migration.ts';

const workspace = JSON.stringify(
	{
		version: 1,
		defaultProject: 'any-project',
		projects: {
			'any-project': {
				architect: {
					build: {
						builder: '@angular-devkit/build-angular:browser',
						options: {
							polyfills: 'src/polyfills.ts',
							main: 'src/main.ts',
						},
						configurations: {
							production: { extractCss: true, optimization: true },
						},
					},
					lint: { builder: '@angular-devkit/build-angular:tslint', options: {} },
					custom: { builder: '@some/other:builder', options: { extractCss: true } },
				},
			},
		},
	},
	null,
	2,
);

describe('Angular workspace migration', () => {
	it('removes defaultProject, removed options and removed builder targets', () => {
		const migration = migrateAngularWorkspace(workspace, ANGULAR_16_BROWSER_CELL);
		const config = JSON.parse(migration.config) as Record<string, unknown>;
		expect(config['defaultProject']).toBeUndefined();
		const architect = (
			(config['projects'] as Record<string, Record<string, unknown>>)[
				'any-project'
			] as Record<string, Record<string, Record<string, Record<string, unknown>>>>
		)['architect'] as Record<string, Record<string, Record<string, unknown>>>;
		expect(architect['lint']).toBeUndefined();
		expect(architect['build']?.['options']).toEqual({
			polyfills: ['src/polyfills.ts'],
			main: 'src/main.ts',
			optimization: { scripts: true, styles: true, fonts: { inline: false } },
		});
		expect(architect['build']?.['configurations']).toEqual({
			production: { optimization: { scripts: true, styles: true, fonts: { inline: false } } },
		});
		expect(migration.removedPackages).toEqual(['codelyzer', 'tslint']);
	});

	it('reports an unrecognised builder instead of rewriting its options', () => {
		const migration = migrateAngularWorkspace(workspace, ANGULAR_16_BROWSER_CELL);
		const config = JSON.parse(migration.config) as Record<string, unknown>;
		const architect = (
			(config['projects'] as Record<string, Record<string, unknown>>)[
				'any-project'
			] as Record<string, Record<string, Record<string, Record<string, unknown>>>>
		)['architect'] as Record<string, Record<string, Record<string, unknown>>>;
		expect(architect['custom']?.['options']).toEqual({ extractCss: true });
		expect(migration.unhandled).toContain(
			'projects.any-project.architect.custom uses @some/other:builder, which this capability does not recognise; its options were left untouched',
		);
	});

	it('distinguishes a comment from a slash inside a JSON string', () => {
		expect(carriesJsonComment('{"exclude":["**/node_modules/**"]}')).toBe(false);
		expect(carriesJsonComment('{"url":"https://example.test"}')).toBe(false);
		expect(carriesJsonComment('{\n  // a comment\n  "a": 1\n}')).toBe(true);
		expect(carriesJsonComment('{ /* a comment */ "a": 1 }')).toBe(true);
		expect(carriesJsonComment('{"a":"quote \\" then /* not a comment */"}')).toBe(false);
	});

	it('refuses a commented configuration rather than dropping its comments', () => {
		expect(() =>
			migrateAngularWorkspace(
				'{\n  // keep me\n  "projects": {}\n}',
				ANGULAR_16_BROWSER_CELL,
			),
		).toThrow('carry comments');
	});

	it('lifts the compiler target and the class-field semantics, and drops enableIvy', () => {
		const migration = migrateAngularTsConfig(
			JSON.stringify({
				compilerOptions: { target: 'es2015', module: 'es2020', lib: ['es2018', 'dom'] },
				angularCompilerOptions: { enableIvy: true, strictInjectionParameters: true },
			}),
			ANGULAR_16_BROWSER_CELL,
		);
		const config = JSON.parse(migration.config) as Record<string, Record<string, unknown>>;
		expect(config['compilerOptions']).toEqual({
			target: 'ES2022',
			module: 'ES2022',
			lib: ['es2018', 'dom'],
			useDefineForClassFields: false,
		});
		expect(config['angularCompilerOptions']).toEqual({ strictInjectionParameters: true });
		expect(migration.changes.map((change) => change.path)).toEqual([
			'compilerOptions.target',
			'compilerOptions.module',
			'compilerOptions.useDefineForClassFields',
			'angularCompilerOptions.enableIvy',
		]);
	});

	it('reports a tsconfig with no compilerOptions instead of inventing one', () => {
		const migration = migrateAngularTsConfig('{"files":[]}', ANGULAR_16_BROWSER_CELL);
		expect(migration.changes).toEqual([]);
		expect(migration.unhandled[0]).toContain('declares no compilerOptions');
	});
});
