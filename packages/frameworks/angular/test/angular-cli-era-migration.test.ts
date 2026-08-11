import { readFile, readdir } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import { ANGULAR_16_BROWSER_CELL } from '../src/angular-target-cell.ts';
import { migrateAngularCliEraWorkspace } from '../src/angular-cli-era-migration.ts';
import { readInstalledPackage } from '../src/undeclared-runtime-dependency.ts';

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

	it('runs the Sentry v8 capability over application source as part of the composition', () => {
		const migration = migrateAngularCliEraWorkspace(
			{
				...input,
				sourceModules: [
					...input.sourceModules,
					{
						path: 'src/main.ts',
						source:
							"import * as Sentry from '@sentry/angular';\n" +
							"import { Integrations } from '@sentry/tracing';\n\n" +
							"Sentry.init({\n  dsn: 'x',\n  integrations: [\n" +
							"    new Integrations.BrowserTracing({ tracingOrigins: ['localhost'] })\n" +
							'  ]\n});\n',
					},
				],
			},
			ANGULAR_16_BROWSER_CELL,
		);
		const main = migration.files.find((file) => file.path === 'src/main.ts');
		expect(main?.changed).toBe(true);
		expect(main?.source).not.toContain('@sentry/tracing');
		expect(main?.source).toContain('Sentry.browserTracingIntegration()');
		expect(main?.source).toContain("tracePropagationTargets: ['localhost']");
		expect(main?.changes).toContain(
			'line 7: sentry-browser-tracing-integration new Integrations.BrowserTracing(…) -> Sentry.browserTracingIntegration()',
		);
	});

	it('closes an undeclared runtime dependency the supplied closure carries', () => {
		const migration = migrateAngularCliEraWorkspace(
			{
				...input,
				installedPackages: [
					readInstalledPackage(
						JSON.stringify({
							name: 'themed-widgets',
							version: '16.2.2',
							peerDependencies: { '@angular/core': '^16.0.0' },
						}),
						[
							{
								path: 'node_modules/themed-widgets/fesm2022/color.mjs',
								source: "import { TinyColor } from '@ctrl/tinycolor';\nexport { TinyColor };\n",
							},
						],
					),
				],
			},
			ANGULAR_16_BROWSER_CELL,
		);
		const manifest = migration.files.find((file) => file.path === 'package.json');
		expect(manifest?.source).toContain('"@ctrl/tinycolor": "^4.2.0"');
		expect(manifest?.changes.join('\n')).toContain('added dependencies.@ctrl/tinycolor = ^4.2.0');
		expect(migration.declaredDifferences.join('\n')).toContain(
			'dependencies.@ctrl/tinycolor was added',
		);
	});

	it('counts a migrated stylesheet as a changed application file and declares its payload change', () => {
		const migration = migrateAngularCliEraWorkspace(
			{
				...input,
				styleSheets: [
					{
						path: 'src/styles.scss',
						source:
							"@import 'themed-widgets/style/index.min.css';\n" +
							"@import 'themed-widgets/modal/style/index.min.css';\n",
					},
				],
				packageExports: [
					{
						name: 'themed-widgets',
						version: '16.2.2',
						exports: {
							'./themed-widgets.min.css': { style: './themed-widgets.min.css' },
							'./modal/style/*': { style: './modal/style/index.min.css' },
						},
					},
				],
			},
			ANGULAR_16_BROWSER_CELL,
		);
		expect(migration.applicationFilesScanned).toBe(3);
		const sheet = migration.files.find((file) => file.path === 'src/styles.scss');
		expect(sheet?.kind).toBe('application');
		expect(sheet?.source).toBe("@import 'themed-widgets/themed-widgets.min.css';\n");
		expect(migration.declaredDifferences.join('\n')).toContain(
			'stylesheet import(s) were replaced by the single exported aggregate',
		);
	});

	it('runs the cross-module modal capability before the per-module ones', () => {
		const migration = migrateAngularCliEraWorkspace(
			{
				...input,
				sourceModules: [
					...input.sourceModules,
					{
						path: 'src/app/card.component.ts',
						source:
							"import { NzModalService } from 'ng-zorro-antd/modal';\n" +
							"import { ContentComponent } from './content.component';\n\n" +
							'export class CardComponent {\n' +
							'  constructor(private _modal: NzModalService) {}\n' +
							'  open() {\n' +
							'    this._modal.create({ nzContent: ContentComponent, ' +
							'nzComponentParams: { id: this.id } });\n' +
							'  }\n}\n',
					},
					{
						path: 'src/app/content.component.ts',
						source:
							"import { Component, Input } from '@angular/core';\n\n" +
							'export class ContentComponent {\n  @Input() id: string;\n}\n',
					},
				],
			},
			ANGULAR_16_BROWSER_CELL,
		);
		const content = migration.files.find((file) => file.path === 'src/app/content.component.ts');
		expect(content?.changed).toBe(true);
		expect(content?.source).toContain('id: string = inject(NZ_MODAL_DATA).id;');
		const card = migration.files.find((file) => file.path === 'src/app/card.component.ts');
		expect(card?.source).toContain('nzData: { id: this.id }');
		expect(card?.changes).toContain(
			'line 7: modal-content-params-option nzComponentParams: { id } -> nzData: { id }',
		);
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
