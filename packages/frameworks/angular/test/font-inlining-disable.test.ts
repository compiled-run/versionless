import { describe, expect, it } from 'vitest';
import { ANGULAR_16_BROWSER_CELL } from '../src/angular-target-cell.ts';
import {
	FONT_INLINING_BUILDERS,
	FONTS_NOT_INLINED,
	builderInlinesFonts,
	fontInliningDifference,
	fontInliningDisabled,
} from '../src/font-inlining-disable.ts';
import { migrateAngularWorkspace } from '../src/angular-workspace-migration.ts';

const workspaceWith = (build: Record<string, unknown>): string =>
	JSON.stringify({ version: 1, projects: { app: { architect: { build } } } }, null, 2);

const buildTargetOf = (config: string): Record<string, unknown> =>
	((
		(JSON.parse(config) as Record<string, Record<string, Record<string, unknown>>>)[
			'projects'
		]?.['app']?.['architect'] as Record<string, Record<string, unknown>>
	)?.['build'] ?? {}) as Record<string, unknown>;

describe('the builders that carry a fonts option', () => {
	it('names the browser-family builders and no others', () => {
		expect(builderInlinesFonts('@angular-devkit/build-angular:browser')).toBe(true);
		expect(builderInlinesFonts('@angular-devkit/build-angular:browser-esbuild')).toBe(true);
		expect(builderInlinesFonts('@angular-devkit/build-angular:application')).toBe(true);
		/**
		 * `:server` declares `optimization` with no `fonts` member and
		 * `additionalProperties: false`, so writing the key there fails schema
		 * validation before the compiler runs. The rest declare no `optimization`
		 * option at all.
		 */
		expect(builderInlinesFonts('@angular-devkit/build-angular:server')).toBe(false);
		expect(builderInlinesFonts('@angular-devkit/build-angular:dev-server')).toBe(false);
		expect(builderInlinesFonts('@angular-devkit/build-angular:karma')).toBe(false);
		expect(builderInlinesFonts('@angular-devkit/build-angular:extract-i18n')).toBe(false);
		expect(builderInlinesFonts('@angular-devkit/build-angular:ng-packagr')).toBe(false);
		expect(builderInlinesFonts('@some/community:builder')).toBe(false);
		expect([...FONT_INLINING_BUILDERS].sort()).toEqual([...FONT_INLINING_BUILDERS]);
	});
});

describe('the optimization value the migrated workspace should carry', () => {
	it('leaves a declared false alone rather than switching optimisation on', () => {
		expect(fontInliningDisabled(false)).toBeNull();
	});

	it('writes an absent option out, because absent means the schema default of true', () => {
		expect(fontInliningDisabled(undefined)).toEqual({
			scripts: true,
			styles: true,
			fonts: { inline: false },
		});
	});

	it('expands a declared true into the same defaults minus the font fetch', () => {
		expect(fontInliningDisabled(true)).toEqual({
			scripts: true,
			styles: true,
			fonts: { inline: false },
		});
	});

	it('keeps every member a declared object already carries', () => {
		expect(
			fontInliningDisabled({
				scripts: false,
				styles: { minify: true, inlineCritical: false },
			}),
		).toEqual({
			scripts: false,
			styles: { minify: true, inlineCritical: false },
			fonts: { inline: false },
		});
	});

	it('replaces a fonts member that leaves inlining on', () => {
		expect(fontInliningDisabled({ fonts: true })).toEqual({ fonts: { inline: false } });
		expect(fontInliningDisabled({ fonts: { inline: true } })).toEqual({
			fonts: { inline: false },
		});
	});

	it('reports nothing to do when inlining is already off, in either spelling', () => {
		expect(fontInliningDisabled({ fonts: false })).toBeNull();
		expect(fontInliningDisabled({ scripts: true, fonts: { inline: false } })).toBeNull();
	});

	it('does not guess at a shape the schema does not admit', () => {
		expect(fontInliningDisabled('yes')).toBeNull();
		expect(fontInliningDisabled(null)).toBeNull();
		expect(fontInliningDisabled([true])).toBeNull();
	});

	it('writes the object spelling so a later devkit option is not disabled by accident', () => {
		expect(FONTS_NOT_INLINED).toEqual({ inline: false });
	});
});

describe('the workspace migration applies it generically', () => {
	it('writes the option into a browser target that declares none', () => {
		const migration = migrateAngularWorkspace(
			workspaceWith({
				builder: '@angular-devkit/build-angular:browser',
				options: { main: 'src/main.ts' },
			}),
			ANGULAR_16_BROWSER_CELL,
		);
		expect(buildTargetOf(migration.config)['options'] as Record<string, unknown>).toEqual({
			main: 'src/main.ts',
			optimization: { scripts: true, styles: true, fonts: { inline: false } },
		});
		expect(migration.declaredDifferences).toHaveLength(1);
		expect(migration.declaredDifferences[0]).toContain(
			'projects.app.architect.build.options.optimization',
		);
		expect(migration.changes).toContainEqual({
			path: 'projects.app.architect.build.options.optimization',
			from: null,
			to: JSON.stringify({ scripts: true, styles: true, fonts: { inline: false } }),
		});
	});

	it('corrects a configuration that declares the option, and leaves one that declares false', () => {
		const migration = migrateAngularWorkspace(
			workspaceWith({
				builder: '@angular-devkit/build-angular:browser',
				options: { main: 'src/main.ts', optimization: false },
				configurations: {
					production: { optimization: true },
					development: { optimization: false },
					staging: { sourceMap: true },
				},
			}),
			ANGULAR_16_BROWSER_CELL,
		);
		const target = buildTargetOf(migration.config);
		/** The base declared false and stays false: the optimiser was asked off. */
		expect((target['options'] as Record<string, unknown>)['optimization']).toBe(false);
		const configurations = target['configurations'] as Record<string, Record<string, unknown>>;
		expect(configurations['production']?.['optimization']).toEqual({
			scripts: true,
			styles: true,
			fonts: { inline: false },
		});
		expect(configurations['development']?.['optimization']).toBe(false);
		/**
		 * `staging` declares no optimization of its own, so it inherits the base.
		 * Writing one here would override the `false` the workspace declared and
		 * switch optimisation on for a configuration that asked for it off.
		 */
		expect(configurations['staging']).toEqual({ sourceMap: true });
		expect(migration.declaredDifferences).toHaveLength(1);
		expect(migration.declaredDifferences[0]).toContain(
			'configurations.production.optimization',
		);
	});

	it('leaves a builder with no fonts option untouched', () => {
		const migration = migrateAngularWorkspace(
			JSON.stringify({
				version: 1,
				projects: {
					app: {
						architect: {
							test: {
								builder: '@angular-devkit/build-angular:karma',
								options: { main: 'src/test.ts' },
							},
							serve: {
								builder: '@angular-devkit/build-angular:dev-server',
								options: { browserTarget: 'app:build' },
							},
							server: {
								builder: '@angular-devkit/build-angular:server',
								options: { main: 'src/main.server.ts', optimization: true },
							},
						},
					},
				},
			}),
			ANGULAR_16_BROWSER_CELL,
		);
		const architect = (
			JSON.parse(migration.config) as Record<string, Record<string, Record<string, unknown>>>
		)['projects']?.['app']?.['architect'] as Record<
			string,
			Record<string, Record<string, unknown>>
		>;
		expect(architect['test']?.['options']).toEqual({ main: 'src/test.ts' });
		expect(architect['serve']?.['options']).toEqual({ browserTarget: 'app:build' });
		expect(architect['server']?.['options']).toEqual({
			main: 'src/main.server.ts',
			optimization: true,
		});
		expect(migration.declaredDifferences).toEqual([]);
	});

	it('records nothing twice when the option is already correct', () => {
		const migration = migrateAngularWorkspace(
			workspaceWith({
				builder: '@angular-devkit/build-angular:browser',
				options: { main: 'src/main.ts', optimization: { fonts: { inline: false } } },
			}),
			ANGULAR_16_BROWSER_CELL,
		);
		expect(buildTargetOf(migration.config)['options'] as Record<string, unknown>).toEqual({
			main: 'src/main.ts',
			optimization: { fonts: { inline: false } },
		});
		expect(migration.declaredDifferences).toEqual([]);
	});
});

describe('the declared difference', () => {
	it('names the site, the cell line and why the era behaviour is the faithful one', () => {
		const line = fontInliningDifference(
			'projects.app.architect.build.options.optimization',
			ANGULAR_16_BROWSER_CELL,
		);
		expect(line).toContain('projects.app.architect.build.options.optimization');
		expect(line).toContain(ANGULAR_16_BROWSER_CELL.angularLine);
		expect(line).toContain('optimization.fonts.inline: false');
		expect(line).toContain('fetched the stylesheet at runtime');
		expect(line).toContain('still points at the font host');
	});
});
