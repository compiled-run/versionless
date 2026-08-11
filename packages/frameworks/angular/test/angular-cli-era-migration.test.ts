import { readFile, readdir } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import { ANGULAR_16_BROWSER_CELL } from '../src/angular-target-cell.ts';
import { migrateAngularCliEraWorkspace } from '../src/angular-cli-era-migration.ts';

const workspaceConfig = JSON.stringify(
	{
		defaultProject: 'any-project',
		projects: {
			'any-project': {
				architect: {
					build: {
						builder: '@angular-devkit/build-angular:browser',
						options: { polyfills: 'src/polyfills.ts' },
					},
					lint: { builder: '@angular-devkit/build-angular:tslint' },
				},
			},
		},
	},
	null,
	2,
);

const input = {
	packageManifest: {
		path: 'package.json',
		source: JSON.stringify(
			{
				name: 'any-workspace',
				dependencies: { '@angular/core': '~10.1.5' },
				devDependencies: { tslint: '^6.1.3' },
			},
			null,
			2,
		),
	},
	workspaceConfig: { path: 'angular.json', source: workspaceConfig },
	tsConfig: {
		path: 'tsconfig.json',
		source: JSON.stringify({ compilerOptions: { target: 'es2015' } }, null, 2),
	},
	sourceModules: [
		{ path: 'src/polyfills.ts', source: "import 'zone.js/dist/zone';\n" },
		{ path: 'src/app/app.component.ts', source: 'export class AppComponent {}\n' },
	],
};

describe('Angular CLI era composed migration', () => {
	it('counts changed application files separately from workspace files', () => {
		const migration = migrateAngularCliEraWorkspace(input, ANGULAR_16_BROWSER_CELL);
		expect(migration.applicationFilesScanned).toBe(2);
		expect(migration.applicationFilesChanged).toBe(1);
		expect(migration.workspaceFilesChanged).toBe(3);
		const unchanged = migration.files.find((file) => file.path === 'src/app/app.component.ts');
		expect(unchanged?.changed).toBe(false);
		expect(unchanged?.sha256Before).toBe(unchanged?.sha256After);
	});

	it('carries the packages a removed builder target released into the manifest', () => {
		const migration = migrateAngularCliEraWorkspace(input, ANGULAR_16_BROWSER_CELL);
		const manifest = migration.files.find((file) => file.path === 'package.json');
		expect(manifest?.changes).toContain(
			'removed devDependencies.tslint (was ^6.1.3) — released by a builder target the workspace migration removed',
		);
	});

	it('is idempotent: migrating the migrated workspace changes nothing further', () => {
		const first = migrateAngularCliEraWorkspace(input, ANGULAR_16_BROWSER_CELL);
		const byPath = new Map(first.files.map((file) => [file.path, file.source]));
		const second = migrateAngularCliEraWorkspace(
			{
				packageManifest: {
					path: 'package.json',
					source: byPath.get('package.json') as string,
				},
				workspaceConfig: {
					path: 'angular.json',
					source: byPath.get('angular.json') as string,
				},
				tsConfig: { path: 'tsconfig.json', source: byPath.get('tsconfig.json') as string },
				sourceModules: input.sourceModules.map((module) => ({
					path: module.path,
					source: byPath.get(module.path) as string,
				})),
			},
			ANGULAR_16_BROWSER_CELL,
		);
		expect(second.applicationFilesChanged).toBe(0);
		expect(second.workspaceFilesChanged).toBe(0);
	});
});

/**
 * The overfitting guard: the product surface must not know which application it
 * is migrating. Any corpus application identifier appearing in the adapter's
 * source is a capability that was fitted to one tree instead of to a shape the
 * framework defines.
 */
describe('Angular adapter overfitting guard', () => {
	it('names no corpus application anywhere in the product surface', async () => {
		const directory = path.join(import.meta.dirname, '../src');
		const forbidden = [
			'factoriolab',
			'factorio-lab',
			'jira-clone',
			'realworld',
			'phonecat',
			'fuxa',
			'hospitalrun',
			'kubernetes-dashboard',
			'5f54abbd',
		];
		const offenders: string[] = [];
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			if (!entry.isFile()) continue;
			const source = (await readFile(path.join(directory, entry.name), 'utf8')).toLowerCase();
			for (const name of forbidden)
				if (source.includes(name)) offenders.push(`${entry.name}: ${name}`);
		}
		expect(offenders).toEqual([]);
	});
});
