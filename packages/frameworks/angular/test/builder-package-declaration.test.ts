import { describe, expect, it } from 'vitest';
import {
	builderPackageName,
	declareBuilderPackages,
	workspaceBuilderPackages,
} from '../src/builder-package-declaration.ts';
import { ANGULAR_16_BROWSER_CELL } from '../src/angular-target-cell.ts';

const workspace = JSON.stringify({
	version: 1,
	projects: {
		anything: {
			architect: {
				build: { builder: '@angular-devkit/build-angular:browser', options: {} },
				test: { builder: '@angular-devkit/build-angular:karma', options: {} },
			},
		},
	},
});

describe('builder package declaration', () => {
	it('reads the package half of a builder string', () => {
		expect(builderPackageName('@angular-devkit/build-angular:browser')).toBe(
			'@angular-devkit/build-angular',
		);
		expect(builderPackageName('@nrwl/webpack:webpack')).toBe('@nrwl/webpack');
		expect(builderPackageName('no-colon-here')).toBe(null);
		expect(builderPackageName(':browser')).toBe(null);
		expect(builderPackageName('trailing:')).toBe(null);
	});

	it('collects every builder a workspace names, keyed by package', () => {
		expect(workspaceBuilderPackages(workspace)).toEqual({
			'@angular-devkit/build-angular': [
				'@angular-devkit/build-angular:browser',
				'@angular-devkit/build-angular:karma',
			],
		});
	});

	it('declares the builder package a lifted workspace names and the manifest lacks', () => {
		const declaration = declareBuilderPackages(
			{
				dependencies: { '@angular/core': '^16.2.0' },
				devDependencies: { '@angular/cli': '^16.2.0' },
			},
			workspace,
			ANGULAR_16_BROWSER_CELL,
		);
		expect(declaration.declarations).toHaveLength(1);
		expect(declaration.declarations[0]?.name).toBe('@angular-devkit/build-angular');
		expect(declaration.declarations[0]?.range).toBe('^16.2.0');
		expect(declaration.declarations[0]?.builders).toEqual([
			'@angular-devkit/build-angular:browser',
			'@angular-devkit/build-angular:karma',
		]);
		expect(
			(declaration.manifest['devDependencies'] as Record<string, string>)[
				'@angular-devkit/build-angular'
			],
		).toBe('^16.2.0');
		expect(declaration.unhandled).toEqual([]);
	});

	it('leaves a builder package the manifest already declares exactly as it is', () => {
		const manifest = {
			devDependencies: { '@angular-devkit/build-angular': '~0.900.0' },
		};
		const declaration = declareBuilderPackages(manifest, workspace, ANGULAR_16_BROWSER_CELL);
		expect(declaration.declarations).toEqual([]);
		expect(declaration.manifest).toBe(manifest);
	});

	it('reports a builder package the cell has no range for rather than guessing a version', () => {
		const declaration = declareBuilderPackages(
			{},
			JSON.stringify({
				projects: { anything: { architect: { build: { builder: '@acme/builders:web' } } } },
			}),
			ANGULAR_16_BROWSER_CELL,
		);
		expect(declaration.declarations).toEqual([]);
		expect(declaration.unhandled).toHaveLength(1);
		expect(declaration.unhandled[0]).toContain('@acme/builders');
		expect(declaration.unhandled[0]).toContain('guessed');
	});

	it('names no application and no fixture in anything it reports', () => {
		const declaration = declareBuilderPackages({}, workspace, ANGULAR_16_BROWSER_CELL);
		const text = JSON.stringify(declaration);
		for (const word of ['tiny-translator', 'translator', 'jira', 'realworld', 'anything'])
			expect(text.toLowerCase()).not.toContain(word);
	});

	it('contributes nothing from a document it cannot read, rather than inventing a hole', () => {
		expect(workspaceBuilderPackages('not json at all')).toEqual({});
		expect(workspaceBuilderPackages('{"projects": 3}')).toEqual({});
		expect(
			declareBuilderPackages({}, 'not json', ANGULAR_16_BROWSER_CELL).declarations,
		).toEqual([]);
	});
});
