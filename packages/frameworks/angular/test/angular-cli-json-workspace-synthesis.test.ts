import { describe, expect, it } from 'vitest';
import { ANGULAR_16_BROWSER_CELL } from '../src/angular-target-cell.ts';
import {
	isAngularCliOneWorkspace,
	joinWorkspacePath,
	synthesizeAngularWorkspace,
} from '../src/angular-cli-json-workspace-synthesis.ts';
import { migrateAngularCliEraWorkspace } from '../src/angular-cli-era-migration.ts';

/**
 * A workspace in the pre-`angular.json` Angular CLI 1.x format, written with
 * names no corpus application uses. Every field below is one the era schema
 * published; the shapes, not the names, are what the capability reads.
 */
const eraWorkspace = JSON.stringify(
	{
		$schema: './node_modules/@angular/cli/lib/config/schema.json',
		project: { name: 'any-project' },
		apps: [
			{
				root: 'src',
				outDir: 'dist',
				assets: [
					'assets',
					'favicon.ico',
					{ glob: '**/*', input: 'extra', output: '/extra' },
				],
				index: 'index.html',
				main: 'main.ts',
				polyfills: 'polyfills.ts',
				test: 'test.ts',
				tsconfig: 'tsconfig.app.json',
				testTsconfig: 'tsconfig.spec.json',
				prefix: 'app',
				styles: ['styles.scss'],
				scripts: [{ input: 'vendor.js', lazy: true }],
				environmentSource: 'environments/environment.ts',
				environments: {
					dev: 'environments/environment.ts',
					prod: 'environments/environment.prod.ts',
					staging: 'environments/environment.staging.ts',
				},
			},
		],
		e2e: { protractor: { config: './protractor.conf.js' } },
		lint: [
			{ project: 'src/tsconfig.app.json', exclude: '**/node_modules/**' },
			{ project: 'src/tsconfig.spec.json', exclude: '**/node_modules/**' },
		],
		test: { karma: { config: './karma.conf.js' } },
		defaults: { styleExt: 'scss', component: {} },
	},
	null,
	2,
);

type JsonObject = Record<string, unknown>;

function projectOf(config: string, name: string): JsonObject {
	const parsed = JSON.parse(config) as JsonObject;
	const projects = parsed['projects'] as JsonObject;
	return projects[name] as JsonObject;
}

describe('Angular CLI 1.x workspace synthesis', () => {
	it('reads the format off the document shape rather than off a filename', () => {
		expect(isAngularCliOneWorkspace(JSON.parse(eraWorkspace))).toBe(true);
		expect(isAngularCliOneWorkspace({ version: 1, projects: {} })).toBe(false);
		expect(isAngularCliOneWorkspace({ apps: [], projects: {} })).toBe(false);
		expect(isAngularCliOneWorkspace('not an object')).toBe(false);
	});

	it('joins app-root-relative schema paths without touching the disk', () => {
		expect(joinWorkspacePath('src', 'main.ts')).toBe('src/main.ts');
		expect(joinWorkspacePath('./src/', './main.ts')).toBe('src/main.ts');
		expect(joinWorkspacePath('', 'karma.conf.js')).toBe('karma.conf.js');
		expect(joinWorkspacePath('.', 'karma.conf.js')).toBe('karma.conf.js');
	});

	it('turns the single apps[] entry into a project with a browser build target', () => {
		const synthesis = synthesizeAngularWorkspace(eraWorkspace, ANGULAR_16_BROWSER_CELL);
		const project = projectOf(synthesis.config, 'any-project');
		expect(project['projectType']).toBe('application');
		expect(project['root']).toBe('');
		expect(project['sourceRoot']).toBe('src');
		expect(project['prefix']).toBe('app');
		const architect = project['architect'] as JsonObject;
		const build = architect['build'] as JsonObject;
		expect(build['builder']).toBe('@angular-devkit/build-angular:browser');
		expect(build['options']).toMatchObject({
			outputPath: 'dist',
			index: 'src/index.html',
			main: 'src/main.ts',
			polyfills: 'src/polyfills.ts',
			tsConfig: 'src/tsconfig.app.json',
			styles: ['src/styles.scss'],
		});
	});

	it('rewrites assets, styles and scripts relative to the workspace root', () => {
		const synthesis = synthesizeAngularWorkspace(eraWorkspace, ANGULAR_16_BROWSER_CELL);
		const build = (projectOf(synthesis.config, 'any-project')['architect'] as JsonObject)[
			'build'
		] as JsonObject;
		const options = build['options'] as JsonObject;
		expect(options['assets']).toEqual([
			'src/assets',
			'src/favicon.ico',
			{ glob: '**/*', input: 'src/extra', output: '/extra' },
		]);
		expect(options['scripts']).toEqual([{ input: 'src/vendor.js', inject: false }]);
	});

	it('turns the environments map into fileReplacements configurations', () => {
		const synthesis = synthesizeAngularWorkspace(eraWorkspace, ANGULAR_16_BROWSER_CELL);
		const build = (projectOf(synthesis.config, 'any-project')['architect'] as JsonObject)[
			'build'
		] as JsonObject;
		const configurations = build['configurations'] as JsonObject;
		expect(Object.keys(configurations).sort()).toEqual(['production', 'staging']);
		expect((configurations['production'] as JsonObject)['fileReplacements']).toEqual([
			{
				replace: 'src/environments/environment.ts',
				with: 'src/environments/environment.prod.ts',
			},
		]);
		expect(configurations['production']).toMatchObject({
			/**
			 * The era `--prod` flag was a boolean. It is written as the object form
			 * here because the boolean would also switch on the modern line's
			 * build-time font inliner, which fetches from a font host during the
			 * build; every other optimisation stays at the schema's own default.
			 */
			optimization: { scripts: true, styles: true, fonts: { inline: false } },
			outputHashing: 'all',
			sourceMap: false,
			vendorChunk: false,
			buildOptimizer: true,
			aot: true,
		});
		expect(build['defaultConfiguration']).toBe('production');
	});

	it('disables the build-time font fetch on the base options as well as production', () => {
		const synthesis = synthesizeAngularWorkspace(eraWorkspace, ANGULAR_16_BROWSER_CELL);
		const build = (projectOf(synthesis.config, 'any-project')['architect'] as JsonObject)[
			'build'
		] as JsonObject;
		/**
		 * The browser builder's `optimization` defaults to on, so a target that
		 * declares nothing still inlines fonts. The base options carry the
		 * explicit equivalent of that default with only the fetch turned off, so
		 * an unconfigured `ng build` is corrected too and not just `--configuration
		 * production`.
		 */
		expect((build['options'] as JsonObject)['optimization']).toEqual({
			scripts: true,
			styles: true,
			fonts: { inline: false },
		});
		expect(synthesis.declaredDifferences.join('\n')).toContain('font inlining disabled');
		expect(synthesis.changes).toContainEqual({
			path: 'projects.any-project.architect.build.options.optimization',
			from: null,
			to: JSON.stringify({ scripts: true, styles: true, fonts: { inline: false } }),
		});
		/** The karma target has no `optimization` option at all and must not gain one. */
		const test = (projectOf(synthesis.config, 'any-project')['architect'] as JsonObject)[
			'test'
		] as JsonObject | undefined;
		expect((test?.['options'] as JsonObject | undefined)?.['optimization']).toBeUndefined();
	});

	it('drops the identity environment as a declared difference rather than a configuration', () => {
		const synthesis = synthesizeAngularWorkspace(eraWorkspace, ANGULAR_16_BROWSER_CELL);
		const build = (projectOf(synthesis.config, 'any-project')['architect'] as JsonObject)[
			'build'
		] as JsonObject;
		expect(Object.keys(build['configurations'] as JsonObject)).not.toContain('dev');
		expect(synthesis.declaredDifferences.join('\n')).toContain('identity swap');
	});

	it('synthesizes the karma, tslint and protractor targets the era blocks described', () => {
		const synthesis = synthesizeAngularWorkspace(eraWorkspace, ANGULAR_16_BROWSER_CELL);
		const architect = projectOf(synthesis.config, 'any-project')['architect'] as JsonObject;
		expect((architect['test'] as JsonObject)['builder']).toBe(
			'@angular-devkit/build-angular:karma',
		);
		expect((architect['test'] as JsonObject)['options']).toMatchObject({
			main: 'src/test.ts',
			tsConfig: 'src/tsconfig.spec.json',
			karmaConfig: 'karma.conf.js',
		});
		expect((architect['lint'] as JsonObject)['builder']).toBe(
			'@angular-devkit/build-angular:tslint',
		);
		expect((architect['lint'] as JsonObject)['options']).toEqual({
			tsConfig: ['src/tsconfig.app.json', 'src/tsconfig.spec.json'],
			exclude: ['**/node_modules/**'],
		});
		expect((architect['e2e'] as JsonObject)['options']).toEqual({
			protractorConfig: 'protractor.conf.js',
		});
	});

	it('carries defaults.styleExt as the component schematic style', () => {
		const synthesis = synthesizeAngularWorkspace(eraWorkspace, ANGULAR_16_BROWSER_CELL);
		expect(projectOf(synthesis.config, 'any-project')['schematics']).toEqual({
			'@schematics/angular:component': { style: 'scss' },
		});
	});

	it('refuses unknown fields by name instead of carrying or dropping them silently', () => {
		const withUnknowns = JSON.stringify({
			project: { name: 'any-project' },
			apps: [{ root: 'src', main: 'main.ts', platform: 'server', appShell: {} }],
			someFutureBlock: {},
			defaults: { serviceWorker: true },
		});
		const synthesis = synthesizeAngularWorkspace(withUnknowns, ANGULAR_16_BROWSER_CELL);
		const reported = synthesis.unhandled.join('\n');
		expect(reported).toContain('someFutureBlock');
		expect(reported).toContain('apps[0].platform');
		expect(reported).toContain('apps[0].appShell');
		expect(reported).toContain('defaults.serviceWorker');
		expect(synthesis.config).not.toContain('platform');
		expect(synthesis.config).not.toContain('appShell');
	});

	it('refuses a multi-app workspace whose apps cannot be told apart by name', () => {
		const twoApps = JSON.stringify({
			project: { name: 'any-project' },
			apps: [
				{ root: 'src', main: 'main.ts' },
				{ root: 'other', main: 'main.ts' },
			],
		});
		const synthesis = synthesizeAngularWorkspace(twoApps, ANGULAR_16_BROWSER_CELL);
		expect(synthesis.unhandled.join('\n')).toContain('more than one app would claim it');
		expect(
			Object.keys((JSON.parse(synthesis.config) as JsonObject)['projects'] as JsonObject),
		).toEqual([]);
	});

	it('names each app of a multi-app workspace by its own name field', () => {
		const twoApps = JSON.stringify({
			project: { name: 'any-project' },
			apps: [
				{ name: 'first', root: 'src', main: 'main.ts' },
				{ name: 'second', root: 'other', main: 'main.ts' },
			],
		});
		const synthesis = synthesizeAngularWorkspace(twoApps, ANGULAR_16_BROWSER_CELL);
		const projects = (JSON.parse(synthesis.config) as JsonObject)['projects'] as JsonObject;
		expect(Object.keys(projects).sort()).toEqual(['first', 'second']);
		expect((projects['second'] as JsonObject)['sourceRoot']).toBe('other');
	});

	it('refuses a document that is not in the pre-angular.json format', () => {
		expect(() =>
			synthesizeAngularWorkspace(
				JSON.stringify({ version: 1, projects: {} }),
				ANGULAR_16_BROWSER_CELL,
			),
		).toThrow(/carries no apps\[\] array/);
	});
});

describe('the composed era migration on a CLI 1.x workspace', () => {
	const manifest = JSON.stringify({
		name: 'any-project',
		version: '0.0.0',
		dependencies: { '@angular/core': '^5.0.3' },
		devDependencies: { '@angular/cli': '^1.5.4', typescript: '2.4', tslint: '^5.7.0' },
	});
	const tsConfig = JSON.stringify({ compilerOptions: { target: 'es5', module: 'es2015' } });

	it('synthesizes angular.json, removes the era workspace and runs the spine on it', () => {
		const migration = migrateAngularCliEraWorkspace(
			{
				packageManifest: { path: 'package.json', source: manifest },
				workspaceConfig: { path: '.angular-cli.json', source: eraWorkspace },
				tsConfig: { path: 'tsconfig.json', source: tsConfig },
				sourceModules: [],
				workspaceFiles: ['tslint.json'],
			},
			ANGULAR_16_BROWSER_CELL,
		);
		const workspaceFile = migration.files.find((entry) => entry.path === 'angular.json');
		expect(workspaceFile).toBeDefined();
		expect(workspaceFile?.changed).toBe(true);
		expect(workspaceFile?.changes[0]).toContain(
			'synthesized angular.json from .angular-cli.json',
		);
		expect(migration.removedFiles).toContain('.angular-cli.json');
		expect(migration.removedFiles).toContain('tslint.json');
		const parsed = JSON.parse(workspaceFile?.source ?? '{}') as JsonObject;
		const architect = ((parsed['projects'] as JsonObject)['any-project'] as JsonObject)[
			'architect'
		] as JsonObject;
		expect(Object.keys(architect).sort()).toEqual(['build', 'test']);
		expect(migration.declaredDifferences.join('\n')).toContain('carries no TSLint line');
	});

	it('counts no application file as changed when only the workspace was synthesized', () => {
		const migration = migrateAngularCliEraWorkspace(
			{
				packageManifest: { path: 'package.json', source: manifest },
				workspaceConfig: { path: '.angular-cli.json', source: eraWorkspace },
				tsConfig: { path: 'tsconfig.json', source: tsConfig },
				sourceModules: [],
			},
			ANGULAR_16_BROWSER_CELL,
		);
		expect(migration.applicationFilesChanged).toBe(0);
		expect(migration.workspaceFilesChanged).toBe(3);
	});
});
