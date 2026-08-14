import { describe, expect, it } from 'vitest';
import { ANGULAR_16_BROWSER_CELL } from '../src/angular-target-cell.ts';
import {
	declaredConfigurationNames,
	optionFlagSpelling,
	removedBuilderOptionFlags,
	retargetWorkspaceScripts,
} from '../src/workspace-script-flags.ts';

const workspaceConfig = JSON.stringify({
	projects: {
		WebSPA: {
			architect: {
				build: { configurations: { production: {} } },
			},
		},
	},
});

const removedExtractCss = [
	{
		path: 'projects.WebSPA.architect.build.configurations.production.extractCss',
		from: 'true',
		to: null,
	},
];

describe('workspace script flags', () => {
	it('drops a flag whose builder option this workspace migration removed', () => {
		const result = retargetWorkspaceScripts(
			{ scripts: { 'build:prod': 'ng build --prod --aot --extract-css' } },
			removedExtractCss,
			ANGULAR_16_BROWSER_CELL,
			workspaceConfig,
		);
		const scripts = result.manifest['scripts'] as Record<string, string>;
		expect(scripts['build:prod']).toBe('ng build --configuration production --aot');
		expect(result.changes.map((change) => [change.kind, change.from, change.to])).toEqual([
			['retargeted-cli-flag', '--prod', '--configuration production'],
			['removed-builder-flag', '--extract-css', null],
		]);
		expect(result.unhandled).toEqual([]);
	});

	it('leaves a flag alone when this workspace never declared the option', () => {
		const result = retargetWorkspaceScripts(
			{ scripts: { 'build:prod': 'ng build --extract-css' } },
			[],
			ANGULAR_16_BROWSER_CELL,
			workspaceConfig,
		);
		expect((result.manifest['scripts'] as Record<string, string>)['build:prod']).toBe(
			'ng build --extract-css',
		);
		expect(result.changes).toEqual([]);
	});

	it('edits no command that does not invoke the workspace CLI binary', () => {
		const scripts = {
			'lint:ts': 'tslint -c tslint.json Client/**/*.ts --prod',
			postinstall: 'node tools/prod --extract-css',
		};
		const result = retargetWorkspaceScripts(
			{ scripts },
			removedExtractCss,
			ANGULAR_16_BROWSER_CELL,
			workspaceConfig,
		);
		expect(result.manifest['scripts']).toEqual(scripts);
		expect(result.changes).toEqual([]);
	});

	it('edits only the segment that invokes the CLI in a compound command', () => {
		const result = retargetWorkspaceScripts(
			{ scripts: { watch: 'npm run build:dev && ng build --prod --watch' } },
			[],
			ANGULAR_16_BROWSER_CELL,
			workspaceConfig,
		);
		expect((result.manifest['scripts'] as Record<string, string>)['watch']).toBe(
			'npm run build:dev && ng build --configuration production --watch',
		);
	});

	it('stands down on a cell whose CLI line still parses the flag', () => {
		const angularEleven = { ...ANGULAR_16_BROWSER_CELL, angularLine: '11.2' };
		const result = retargetWorkspaceScripts(
			{ scripts: { 'build:prod': 'ng build --prod' } },
			[],
			angularEleven,
			workspaceConfig,
		);
		expect((result.manifest['scripts'] as Record<string, string>)['build:prod']).toBe(
			'ng build --prod',
		);
		expect(result.changes).toEqual([]);
	});

	it('refuses --prod where the migrated workspace declares no production configuration', () => {
		const result = retargetWorkspaceScripts(
			{ scripts: { 'build:prod': 'ng build --prod' } },
			[],
			ANGULAR_16_BROWSER_CELL,
			JSON.stringify({ projects: { WebSPA: { architect: { build: {} } } } }),
		);
		expect((result.manifest['scripts'] as Record<string, string>)['build:prod']).toBe(
			'ng build --prod',
		);
		expect(result.unhandled.join(' ')).toContain('does not declare');
	});

	it('refuses a flag that may be carrying a value rather than half-rewriting the command', () => {
		const result = retargetWorkspaceScripts(
			{ scripts: { 'build:prod': 'ng build --extract-css true' } },
			removedExtractCss,
			ANGULAR_16_BROWSER_CELL,
			workspaceConfig,
		);
		expect((result.manifest['scripts'] as Record<string, string>)['build:prod']).toBe(
			'ng build --extract-css true',
		);
		expect(result.unhandled.join(' ')).toContain('written with a value');
	});

	it('reports a quoted command it declines to take apart', () => {
		const command = 'ng build --prod && echo "done --prod"';
		const result = retargetWorkspaceScripts(
			{ scripts: { 'build:prod': command } },
			[],
			ANGULAR_16_BROWSER_CELL,
			workspaceConfig,
		);
		expect((result.manifest['scripts'] as Record<string, string>)['build:prod']).toBe(command);
		expect(result.unhandled.join(' ')).toContain('quoted command');
	});

	it('stands down entirely on a manifest with no scripts', () => {
		const manifest = { dependencies: {} };
		const result = retargetWorkspaceScripts(
			manifest,
			removedExtractCss,
			ANGULAR_16_BROWSER_CELL,
			workspaceConfig,
		);
		expect(result.manifest).toBe(manifest);
		expect(result.changes).toEqual([]);
	});

	it('derives the dropped flags from this migration\'s own removals and not from a flag list', () => {
		expect(optionFlagSpelling('extractCss')).toBe('--extract-css');
		expect(optionFlagSpelling('showCircularDependencies')).toBe('--show-circular-dependencies');
		expect(
			removedBuilderOptionFlags([
				...removedExtractCss,
				{ path: 'defaultProject', from: '"WebSPA"', to: null },
				{ path: 'projects.WebSPA.architect.build.options.polyfills', from: '"a"', to: '["a"]' },
			]),
		).toEqual({
			'--extract-css': 'projects.WebSPA.architect.build.configurations.production.extractCss',
		});
	});

	it('reads the configuration names out of the migrated workspace', () => {
		expect(declaredConfigurationNames(workspaceConfig)).toEqual(['production']);
		expect(declaredConfigurationNames('not json')).toEqual([]);
	});
});
