import { readFileSync, writeFileSync } from 'node:fs';
import * as path from 'pathe';
import { defineConfig } from 'vite';
import type { NextStaticLiftRecord } from '../../packages/frameworks/react/src/index.ts';
import {
	createCraPublicDirectoryPlugin,
	createNextStaticAdapter,
	nextProcessEnvironmentDefines,
	planNextBabelPresetSource,
} from '../../packages/frameworks/react/src/index.ts';

/**
 * The migrated configuration for the LEGACY-NEXT static-export cell: a Next 12
 * pages/ application whose whole route set is one statically exported document,
 * built by the workspace's own Vite 8 instead of by the framework.
 *
 * Nothing framework-shaped is decided here. The framework surface is lifted by
 * the reusable Next static adapter, the JSX contract is read out of the
 * application's own `.babelrc` by that adapter's translation rather than
 * asserted, and the public directory is replicated by the same generic
 * capability the create-react-app cell uses — the two bundlers copy that
 * directory identically, so a second implementation of it would be duplication,
 * not a claim. Only paths and the era environment are application knowledge and
 * they live here.
 */

const target = process.cwd();
const publicDirectory = path.join(target, 'public');

/**
 * The JSX contract, translated from the application's own Babel configuration.
 *
 * This is the load-bearing line of the whole configuration. The application
 * disables the framework's Rust compiler by committing a `.babelrc`, and that
 * file points the automatic JSX runtime at a CSS-in-JS library's import source.
 * Every element in the application therefore compiles through that library's
 * JSX factory, which is what makes its `css` prop mean anything. A migrated
 * build that inherited the default React runtime would compile cleanly, render
 * an unstyled page, and report nothing — so the value is read from the file the
 * legacy build read it from, and an unreadable file refuses the build.
 */
const babel = planNextBabelPresetSource(readFileSync(path.join(target, '.babelrc'), 'utf8'), '.babelrc');

/**
 * The compile-time environment the legacy build inlined.
 *
 * `NODE_ENV` is what the framework substitutes into every module. `mode` is the
 * one key this application's `next.config.js` declares under `env`, and the
 * framework defines those exactly as it defines `NODE_ENV`. Both are stated
 * rather than inherited, because a production lane that silently built with a
 * development `NODE_ENV` would take a different branch in the application's own
 * source.
 */
const environment = { NODE_ENV: 'production', mode: 'production' };

const lifts: NextStaticLiftRecord[] = [];
const liftReport = path.join(target, 'framework-lift.json');

const compareUtf16CodeUnits = (left: string, right: string): number =>
	left === right ? 0 : left < right ? -1 : 1;

export default defineConfig({
	root: target,
	/**
	 * The public directory is copied by the adapter capability below rather than
	 * by Vite's own `publicDir`, because this application imports one of its
	 * public files as a module as well (`pages/_app` imports `public/global.css`)
	 * and Vite reserves `publicDir` for files that are only ever copied. The
	 * legacy export did both: it emitted the bundled stylesheet and copied the
	 * source file. Both lanes therefore carry both.
	 */
	publicDir: false,
	define: nextProcessEnvironmentDefines(environment),
	oxc: {
		jsx: {
			runtime: babel.jsx.runtime,
			...(babel.jsx.importSource === null ? {} : { importSource: babel.jsx.importSource }),
		},
	},
	plugins: [
		...createNextStaticAdapter({ observe: (record) => lifts.push(record) }),
		createCraPublicDirectoryPlugin({ directory: publicDirectory }),
		{
			name: 'versionless-fixture-framework-lift-report',
			closeBundle: {
				order: 'post',
				sequential: true,
				handler() {
					writeFileSync(
						liftReport,
						`${JSON.stringify(
							{
								babel,
								modules: lifts
									.map((record) => ({
										module: path
											.relative(target, record.id)
											.split(path.sep)
											.join('/'),
										imports: record.imports.map((entry) => ({
											specifier: entry.specifier,
											kind: entry.kind,
											bindings: [...entry.bindings],
										})),
										dataFetchingExports: [...record.dataFetchingExports],
									}))
									.sort((left, right) =>
										compareUtf16CodeUnits(left.module, right.module),
									),
							},
							null,
							'\t',
						)}\n`,
					);
				},
			},
		},
	],
	build: { emptyOutDir: true },
});
