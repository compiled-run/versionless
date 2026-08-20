import { describe, expect, it } from 'vitest';
import { ANGULAR_13_BROWSER_CELL, ANGULAR_16_BROWSER_CELL } from '../src/angular-target-cell.ts';
import {
	REMOVED_ANGULAR_CLI_FLAGS,
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

	it("derives the dropped flags from this migration's own removals and not from a flag list", () => {
		expect(optionFlagSpelling('extractCss')).toBe('--extract-css');
		expect(optionFlagSpelling('showCircularDependencies')).toBe('--show-circular-dependencies');
		expect(
			removedBuilderOptionFlags([
				...removedExtractCss,
				{ path: 'defaultProject', from: '"WebSPA"', to: null },
				{
					path: 'projects.WebSPA.architect.build.options.polyfills',
					from: '"a"',
					to: '["a"]',
				},
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

/**
 * The `--i18n-*` family, which is the first family where a removed flag carries
 * a value the removal has to take with it.
 */
describe('the removed ViewEngine i18n CLI flags', () => {
	const i18nRow = (flag: string) =>
		REMOVED_ANGULAR_CLI_FLAGS.find((entry) => entry.flag === flag);

	it('carries exactly the three flags the 13 CLI stopped parsing, each with no successor', () => {
		expect(
			REMOVED_ANGULAR_CLI_FLAGS.filter((entry) => entry.flag.startsWith('--i18n-')).map(
				(entry) => [
					entry.flag,
					entry.removedAfterMajor,
					entry.successor,
					entry.carriesValue,
				],
			),
		).toEqual([
			['--i18n-locale', 12, null, true],
			['--i18n-format', 12, null, true],
			['--i18n-file', 12, null, true],
		]);
		for (const flag of ['--i18n-locale', '--i18n-format', '--i18n-file']) {
			expect(i18nRow(flag)?.requiresConfiguration).toBeUndefined();
			expect(i18nRow(flag)?.fact).toContain('$localize');
		}
	});

	it('removes a value-carrying flag with its separated value, stranding no token', () => {
		const result = retargetWorkspaceScripts(
			{
				scripts: {
					'run-dev':
						'ng build --watch --i18n-locale en --i18n-file translate/messages.en.xlf',
				},
			},
			[],
			ANGULAR_16_BROWSER_CELL,
			workspaceConfig,
		);
		expect((result.manifest['scripts'] as Record<string, string>)['run-dev']).toBe(
			'ng build --watch',
		);
		expect(result.changes.map((change) => [change.kind, change.from, change.to])).toEqual([
			['retargeted-cli-flag', '--i18n-locale en', null],
			['retargeted-cli-flag', '--i18n-file translate/messages.en.xlf', null],
		]);
		expect(result.unhandled).toEqual([]);
	});

	it('removes the `=`-joined form as the single token it is', () => {
		const result = retargetWorkspaceScripts(
			{ scripts: { build: 'ng build --i18n-format=xlf --i18n-locale=en --watch' } },
			[],
			ANGULAR_16_BROWSER_CELL,
			workspaceConfig,
		);
		expect((result.manifest['scripts'] as Record<string, string>)['build']).toBe(
			'ng build --watch',
		);
		expect(result.changes.map((change) => change.from)).toEqual([
			'--i18n-format=xlf',
			'--i18n-locale=en',
		]);
		expect(result.unhandled).toEqual([]);
	});

	it('leaves --i18n-missing-translation alone: the 13 builder schema still declares it', () => {
		expect(i18nRow('--i18n-missing-translation')).toBeUndefined();
		const command = 'ng build --i18n-locale en --i18n-missing-translation warning';
		for (const cell of [ANGULAR_13_BROWSER_CELL, ANGULAR_16_BROWSER_CELL]) {
			const result = retargetWorkspaceScripts(
				{ scripts: { build: command } },
				[],
				cell,
				workspaceConfig,
			);
			expect((result.manifest['scripts'] as Record<string, string>)['build']).toBe(
				'ng build --i18n-missing-translation warning',
			);
			expect(result.changes.map((change) => change.from)).toEqual(['--i18n-locale en']);
		}
	});

	it('stands down on a 12 cell, which is the last CLI line that parsed the flags', () => {
		const angularTwelve = { ...ANGULAR_13_BROWSER_CELL, angularLine: '12.2' };
		const command = 'ng build --i18n-locale en --i18n-format=xlf';
		const result = retargetWorkspaceScripts(
			{ scripts: { build: command } },
			[],
			angularTwelve,
			workspaceConfig,
		);
		expect((result.manifest['scripts'] as Record<string, string>)['build']).toBe(command);
		expect(result.changes).toEqual([]);
	});

	/**
	 * pigallery2 1.7.0's own manifest, at its pinned corpus revision. Both `ng`
	 * scripts passed `--i18n-locale`/`--i18n-file`, so the migrated manifest that
	 * kept them shipped two commands that die on `Unknown option` before the
	 * builder runs. Pinned here on the real bytes so a regression is visible as
	 * the defect it would be, and not only as a moved digest somewhere else.
	 */
	const pigallery2Scripts = {
		install: 'tsc && gulp build-prod',
		'build-backend': 'tsc',
		test: 'ng test && mocha --recursive test/backend/unit',
		'run-dev':
			'ng build --aot --watch --output-path=./dist --i18n-locale en --i18n-file frontend/translate/messages.en.xlf --i18n-missing-translation warning',
		'build-stats':
			'ng build --aot --prod --stats-json --output-path=./dist --i18n-locale en --i18n-file frontend/translate/messages.en.xlf --i18n-missing-translation warning',
		'add-translation': 'gulp add-translation',
	};

	it('trims the pigallery2 scripts at the 16 cell and leaves every non-ng command alone', () => {
		const result = retargetWorkspaceScripts(
			{ scripts: pigallery2Scripts },
			[],
			ANGULAR_16_BROWSER_CELL,
			workspaceConfig,
		);
		expect(result.manifest['scripts']).toEqual({
			install: 'tsc && gulp build-prod',
			'build-backend': 'tsc',
			test: 'ng test && mocha --recursive test/backend/unit',
			'run-dev':
				'ng build --aot --watch --output-path=./dist --i18n-missing-translation warning',
			'build-stats':
				'ng build --aot --configuration production --stats-json --output-path=./dist --i18n-missing-translation warning',
			'add-translation': 'gulp add-translation',
		});
		expect(result.changes.map((change) => [change.script, change.from, change.to])).toEqual([
			['run-dev', '--i18n-locale en', null],
			['run-dev', '--i18n-file frontend/translate/messages.en.xlf', null],
			['build-stats', '--prod', '--configuration production'],
			['build-stats', '--i18n-locale en', null],
			['build-stats', '--i18n-file frontend/translate/messages.en.xlf', null],
		]);
		expect(result.unhandled).toEqual([]);
	});

	it('trims the same two scripts at the 13 cell, where the removal already applies', () => {
		const result = retargetWorkspaceScripts(
			{ scripts: pigallery2Scripts },
			[],
			ANGULAR_13_BROWSER_CELL,
			workspaceConfig,
		);
		const scripts = result.manifest['scripts'] as Record<string, string>;
		expect(scripts['run-dev']).toBe(
			'ng build --aot --watch --output-path=./dist --i18n-missing-translation warning',
		);
		expect(scripts['build-stats']).toBe(
			'ng build --aot --configuration production --stats-json --output-path=./dist --i18n-missing-translation warning',
		);
		expect(scripts['install']).toBe('tsc && gulp build-prod');
		expect(result.changes.filter((change) => change.from.startsWith('--i18n-'))).toHaveLength(
			4,
		);
	});
});
