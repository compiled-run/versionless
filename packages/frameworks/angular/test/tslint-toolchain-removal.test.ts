import { describe, expect, it } from 'vitest';
import { ANGULAR_16_BROWSER_CELL, type AngularTargetCell } from '../src/angular-target-cell.ts';
import { migrateAngularCliEraWorkspace } from '../src/angular-cli-era-migration.ts';
import { migrateAngularWorkspace } from '../src/angular-workspace-migration.ts';
import {
	isTslintBuilder,
	isTslintConfigPath,
	targetLineDropsTslint,
	tslintConfigRemovals,
} from '../src/tslint-toolchain-removal.ts';

/** A cell that still carries a TSLint line, to prove the drop is conditional. */
const CELL_WITH_TSLINT: AngularTargetCell = Object.freeze({
	...ANGULAR_16_BROWSER_CELL,
	id: 'a-line-that-still-has-tslint',
	ecosystemPackages: Object.freeze({
		tslint: Object.freeze({
			kind: 'aligned' as const,
			range: '~6.1.0',
			fact: 'a hypothetical line on which TSLint is still published, used to prove that the removal is driven by the cell and not hard-coded',
		}),
	}),
});

const WORKSPACE = JSON.stringify(
	{
		version: 1,
		projects: {
			'any-app': {
				architect: {
					build: { builder: '@angular-devkit/build-angular:browser', options: {} },
					lint: {
						builder: '@angular-devkit/build-angular:tslint',
						options: {
							tsConfig: ['tsconfig.app.json'],
							exclude: ['**/node_modules/**'],
						},
					},
				},
			},
			'a-second-app': {
				architect: {
					lint: { builder: 'some-community-builder:tslint', options: {} },
				},
			},
		},
	},
	null,
	2,
);

describe('TSLint toolchain removal', () => {
	it('identifies a TSLint builder by what it runs, not by who published it', () => {
		expect(isTslintBuilder('@angular-devkit/build-angular:tslint')).toBe(true);
		expect(isTslintBuilder('some-community-builder:tslint')).toBe(true);
		expect(isTslintBuilder('@angular-eslint/builder:lint')).toBe(false);
		expect(isTslintBuilder('@angular-devkit/build-angular:browser')).toBe(false);
	});

	it('identifies a TSLint configuration file at any depth', () => {
		expect(isTslintConfigPath('tslint.json')).toBe(true);
		expect(isTslintConfigPath('projects/any-app/tslint.json')).toBe(true);
		expect(isTslintConfigPath('tslint.yaml')).toBe(true);
		expect(isTslintConfigPath('tsconfig.json')).toBe(false);
		expect(isTslintConfigPath('src/app/tslint.service.ts')).toBe(false);
	});

	it('reads the drop off the cell rather than assuming it', () => {
		expect(targetLineDropsTslint(ANGULAR_16_BROWSER_CELL)).toBe(true);
		expect(targetLineDropsTslint(CELL_WITH_TSLINT)).toBe(false);
	});

	it('removes every TSLint target and records each removal by name', () => {
		const migration = migrateAngularWorkspace(WORKSPACE, ANGULAR_16_BROWSER_CELL);
		const workspace: unknown = JSON.parse(migration.config);
		const projects = (workspace as Record<string, Record<string, Record<string, unknown>>>)[
			'projects'
		];
		expect(Object.keys((projects?.['any-app']?.['architect'] as object) ?? {})).toEqual([
			'build',
		]);
		expect(Object.keys((projects?.['a-second-app']?.['architect'] as object) ?? {})).toEqual(
			[],
		);
		const tslintDifferences = migration.declaredDifferences.filter((line) =>
			line.includes('TSLint'),
		);
		expect(tslintDifferences).toHaveLength(2);
		expect(tslintDifferences[0]).toContain('projects.any-app.architect.lint');
		expect(tslintDifferences[0]).toContain('carries no TSLint line');
		expect(tslintDifferences[1]).toContain('projects.a-second-app.architect.lint');
		/**
		 * The browser target is also corrected for build-time font inlining, so
		 * the total is the two TSLint removals plus that one. Pinned rather than
		 * left open, so a third unrelated difference appearing here is a failure.
		 */
		expect(migration.declaredDifferences).toHaveLength(3);
		expect(
			migration.declaredDifferences.filter((line) => line.includes('font inlining disabled')),
		).toHaveLength(1);
	});

	it('leaves a TSLint target alone on a cell that still carries the line', () => {
		const migration = migrateAngularWorkspace(WORKSPACE, CELL_WITH_TSLINT);
		expect(migration.declaredDifferences.filter((line) => line.includes('TSLint'))).toEqual([]);
		/**
		 * The one difference this cell does declare is the font-inlining one on
		 * the browser target, which is a fact about the modern builder and not
		 * about the lint line. Asserted by name so the empty TSLint list above
		 * cannot be satisfied by a list that is empty for the wrong reason.
		 */
		expect(migration.declaredDifferences).toHaveLength(1);
		expect(migration.declaredDifferences[0]).toContain('font inlining disabled');
		expect(migration.config).toContain('some-community-builder:tslint');
		/**
		 * The devkit's own `:tslint` target still goes, on this cell as on any
		 * other: the modern devkit does not ship that builder, which is a fact
		 * about the devkit and not about whether TSLint exists. It leaves through
		 * the removed-builder table, and so is reported unhandled rather than
		 * declared.
		 */
		expect(migration.config).not.toContain('@angular-devkit/build-angular:tslint');
		expect(migration.unhandled.join(' ')).toContain('projects.any-app.architect.lint used');
	});

	it('removes TSLint configuration files, and only those it was handed', () => {
		const removals = tslintConfigRemovals(
			['tslint.json', 'projects/any-app/tslint.json', 'tsconfig.json', 'src/main.ts'],
			ANGULAR_16_BROWSER_CELL,
		);
		expect(removals.map((removal) => removal.at)).toEqual([
			'tslint.json',
			'projects/any-app/tslint.json',
		]);
		expect(removals.every((removal) => removal.kind === 'config')).toBe(true);
		expect(tslintConfigRemovals([], ANGULAR_16_BROWSER_CELL)).toEqual([]);
		expect(tslintConfigRemovals(['tslint.json'], CELL_WITH_TSLINT)).toEqual([]);
	});

	it('reports the drop through the composed changeset, packages and files together', () => {
		const migration = migrateAngularCliEraWorkspace(
			{
				packageManifest: {
					path: 'package.json',
					source: JSON.stringify({
						devDependencies: {
							tslint: '~6.1.0',
							codelyzer: '^6.0.0',
							eslint: '^8.2.0',
						},
					}),
				},
				workspaceConfig: { path: 'angular.json', source: WORKSPACE },
				tsConfig: {
					path: 'tsconfig.json',
					source: JSON.stringify({ compilerOptions: {} }),
				},
				sourceModules: [],
				workspaceFiles: ['angular.json', 'package.json', 'tslint.json'],
			},
			ANGULAR_16_BROWSER_CELL,
		);
		expect(migration.removedFiles).toEqual(['tslint.json']);
		const manifest: unknown = JSON.parse(
			migration.files.find((entry) => entry.path === 'package.json')?.source ?? '{}',
		);
		/**
		 * The TSLint packages are gone and `eslint` is untouched. The builder
		 * package is present because the migrated workspace still runs a build
		 * target and the manifest handed in declared nothing that provides it —
		 * a different capability's doing, asserted here so that the drop this
		 * test is about is read against the whole manifest rather than a slice.
		 */
		expect((manifest as Record<string, unknown>)['devDependencies']).toEqual({
			'@angular-devkit/build-angular': '^16.2.0',
			eslint: '^8.2.0',
		});
		expect(
			migration.declaredDifferences.filter((line) => line.includes('tslint.json')),
		).toHaveLength(1);
		expect(
			migration.declaredDifferences.some((line) =>
				line.includes('devDependencies.codelyzer'),
			),
		).toBe(true);
		expect(
			migration.declaredDifferences.some((line) =>
				line.includes('devDependencies.tslint was'),
			),
		).toBe(true);
	});

	it('removes no file when the tree supplies no file list', () => {
		const migration = migrateAngularCliEraWorkspace(
			{
				packageManifest: { path: 'package.json', source: '{}' },
				workspaceConfig: { path: 'angular.json', source: WORKSPACE },
				tsConfig: {
					path: 'tsconfig.json',
					source: JSON.stringify({ compilerOptions: {} }),
				},
				sourceModules: [],
			},
			ANGULAR_16_BROWSER_CELL,
		);
		expect(migration.removedFiles).toEqual([]);
	});
});
