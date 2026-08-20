import { describe, expect, it } from 'vitest';
import { ANGULAR_16_BROWSER_CELL } from '../src/angular-target-cell.ts';
import {
	NATIVE_STYLE_PIPELINES,
	WRAPPER_BUILDER_REPLACEMENTS,
	analyzeCustomWebpackFragment,
	builderPackageOf,
	staticValueOf,
} from '../src/custom-webpack-absorption.ts';
import { migrateAngularWorkspace } from '../src/angular-workspace-migration.ts';

const OFFICIAL = '@angular-devkit/build-angular:browser';

/**
 * The fragment shape this capability exists for: a postcss-loader rule that
 * wires Tailwind into style compilation, written before the official builder
 * did it natively. Byte-for-byte the shape jira-clone commits, but the test
 * names no application and the capability reads no name.
 */
const TAILWIND_FRAGMENT = `
module.exports = {
  module: {
    rules: [
      {
        test: /\\.scss$/,
        loader: 'postcss-loader',
        options: {
          postcssOptions: {
            ident: 'postcss',
            syntax: 'postcss-scss',
            plugins: ['postcss-import', 'tailwindcss', 'autoprefixer'],
          },
        },
      },
    ],
  },
}
`;

function workspaceWith(builder: string, options: Record<string, unknown>): string {
	return JSON.stringify(
		{
			version: 1,
			projects: {
				'any-project': {
					architect: {
						build: { builder, options },
						serve: {
							builder: '@angular-builders/custom-webpack:dev-server',
							options: { browserTarget: 'any-project:build' },
						},
					},
				},
			},
		},
		null,
		2,
	);
}

describe('static reading of a webpack fragment', () => {
	it('reads object, array, string and regular-expression literals', () => {
		const analysis = analyzeCustomWebpackFragment('w.js', TAILWIND_FRAGMENT, OFFICIAL);
		expect(analysis.absorbable).toBe(true);
		expect(analysis.capabilities.map((entry) => entry.detail)).toContain('/\\.scss$/');
		expect(analysis.blockers).toEqual([]);
	});

	it('refuses a fragment that computes any part of itself', () => {
		const analysis = analyzeCustomWebpackFragment(
			'w.js',
			'module.exports = { module: { rules: buildRules() } }',
			OFFICIAL,
		);
		expect(analysis.absorbable).toBe(false);
		expect(analysis.blockers.join(' ')).toContain('statically readable');
	});

	it('refuses a fragment exported as a function', () => {
		const analysis = analyzeCustomWebpackFragment(
			'w.js',
			'module.exports = (config) => config',
			OFFICIAL,
		);
		expect(analysis.absorbable).toBe(false);
	});

	it('reads an ES module default export the same way', () => {
		const analysis = analyzeCustomWebpackFragment(
			'w.mjs',
			TAILWIND_FRAGMENT.replace('module.exports =', 'export default'),
			OFFICIAL,
		);
		expect(analysis.absorbable).toBe(true);
	});

	it('returns undefined rather than guessing for an unreadable expression', () => {
		expect(staticValueOf({ type: 'Identifier', name: 'x' })).toBeUndefined();
	});
});

describe('judging a fragment against the official builder', () => {
	it('refuses a plugin the target builder does not run natively', () => {
		const analysis = analyzeCustomWebpackFragment(
			'w.js',
			TAILWIND_FRAGMENT.replace("'autoprefixer'", "'postcss-nested'"),
			OFFICIAL,
		);
		expect(analysis.absorbable).toBe(false);
		expect(analysis.blockers.join(' ')).toContain('postcss-nested');
	});

	it('refuses a rule that is not a lone postcss-loader', () => {
		const analysis = analyzeCustomWebpackFragment(
			'w.js',
			"module.exports = { module: { rules: [{ test: /\\.ts$/, loader: 'babel-loader' }] } }",
			OFFICIAL,
		);
		expect(analysis.absorbable).toBe(false);
	});

	it('refuses a fragment that configures anything outside module.rules', () => {
		const analysis = analyzeCustomWebpackFragment(
			'w.js',
			"module.exports = { resolve: { alias: { a: 'b' } } }",
			OFFICIAL,
		);
		expect(analysis.absorbable).toBe(false);
		expect(analysis.blockers.join(' ')).toContain('resolve');
	});

	it('refuses when no native pipeline is recorded for the official builder', () => {
		const analysis = analyzeCustomWebpackFragment('w.js', TAILWIND_FRAGMENT, '@x/y:z');
		expect(analysis.absorbable).toBe(false);
	});

	it('refuses an empty fragment rather than calling it absorbable', () => {
		const analysis = analyzeCustomWebpackFragment('w.js', 'module.exports = {}', OFFICIAL);
		expect(analysis.absorbable).toBe(false);
	});

	it('records a reason for every plugin it calls native', () => {
		const pipeline = NATIVE_STYLE_PIPELINES[OFFICIAL];
		expect(pipeline).toBeDefined();
		for (const why of Object.values(pipeline?.postcssPlugins ?? {}))
			expect(why.length).toBeGreaterThan(40);
	});
});

describe('builder identity', () => {
	it('reads the publishing package off a builder identity', () => {
		expect(builderPackageOf('@angular-builders/custom-webpack:browser')).toBe(
			'@angular-builders/custom-webpack',
		);
		expect(builderPackageOf('not-a-builder')).toBeNull();
	});

	it('maps every wrapper onto a devkit builder of the same target name', () => {
		for (const [wrapper, official] of Object.entries(WRAPPER_BUILDER_REPLACEMENTS))
			expect(official.slice(official.lastIndexOf(':'))).toBe(
				wrapper.slice(wrapper.lastIndexOf(':')),
			);
	});
});

describe('absorption through the workspace migration', () => {
	const options = {
		customWebpackConfig: { path: './webpack.config.js' },
		main: 'src/main.ts',
	};

	it('restores the official builder and releases the wrapper package', () => {
		const migration = migrateAngularWorkspace(
			workspaceWith('@angular-builders/custom-webpack:browser', options),
			ANGULAR_16_BROWSER_CELL,
			{ 'webpack.config.js': TAILWIND_FRAGMENT },
		);
		const config: {
			projects: Record<
				string,
				{ architect: Record<string, { builder: string; options?: object }> }
			>;
		} = JSON.parse(migration.config);
		const build = config.projects['any-project']?.architect['build'];
		expect(build?.builder).toBe(OFFICIAL);
		expect(build?.options).not.toHaveProperty('customWebpackConfig');
		expect(config.projects['any-project']?.architect['serve']?.builder).toBe(
			'@angular-devkit/build-angular:dev-server',
		);
		expect(migration.removedPackages).toContain('@angular-builders/custom-webpack');
		expect(migration.absorbedFragments.map((entry) => entry.path)).toEqual([
			'webpack.config.js',
		]);
	});

	it('leaves the wrapper in place when the fragment was not supplied', () => {
		const migration = migrateAngularWorkspace(
			workspaceWith('@angular-builders/custom-webpack:browser', options),
			ANGULAR_16_BROWSER_CELL,
		);
		expect(migration.config).toContain('@angular-builders/custom-webpack:browser');
		expect(migration.removedPackages).not.toContain('@angular-builders/custom-webpack');
		expect(migration.absorbedFragments).toEqual([]);
		expect(migration.unhandled.join(' ')).toContain('contents were not supplied');
	});

	it('absorbs nothing at all when one fragment is unreadable', () => {
		const migration = migrateAngularWorkspace(
			workspaceWith('@angular-builders/custom-webpack:browser', options),
			ANGULAR_16_BROWSER_CELL,
			{ 'webpack.config.js': 'module.exports = (config) => config' },
		);
		expect(migration.config).toContain('@angular-builders/custom-webpack:dev-server');
		expect(migration.removedPackages).not.toContain('@angular-builders/custom-webpack');
	});

	it('keeps the wrapper-only options when nothing was absorbed', () => {
		const migration = migrateAngularWorkspace(
			workspaceWith('@angular-builders/custom-webpack:browser', options),
			ANGULAR_16_BROWSER_CELL,
			{ 'webpack.config.js': "module.exports = { resolve: { alias: { a: 'b' } } }" },
		);
		expect(migration.config).toContain('customWebpackConfig');
	});
});

describe('workspace keys the CLI renamed', () => {
	it('rewrites cli.defaultCollection to cli.schematicCollections', () => {
		const migration = migrateAngularWorkspace(
			JSON.stringify({
				version: 1,
				projects: {},
				cli: { analytics: false, defaultCollection: '@x/y' },
			}),
			ANGULAR_16_BROWSER_CELL,
		);
		const config: { cli: Record<string, unknown> } = JSON.parse(migration.config);
		expect(config.cli['schematicCollections']).toEqual(['@x/y']);
		expect(config.cli).not.toHaveProperty('defaultCollection');
		expect(config.cli['analytics']).toBe(false);
	});

	it('leaves a workspace that already uses the modern key alone', () => {
		const migration = migrateAngularWorkspace(
			JSON.stringify({ version: 1, projects: {}, cli: { schematicCollections: ['@x/y'] } }),
			ANGULAR_16_BROWSER_CELL,
		);
		expect(migration.changes.filter((change) => change.path.startsWith('cli.'))).toEqual([]);
	});
});
