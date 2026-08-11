import { readFileSync, writeFileSync } from 'node:fs';
import * as path from 'pathe';
import { defineConfig } from 'vite';
import type { ViteClientApiRecord } from '../../packages/frameworks/react/src/index.ts';
import {
	createViteOriginAdapter,
	planViteOriginConfigSource,
} from '../../packages/frameworks/react/src/index.ts';

/**
 * The migrated configuration for the Vite-2-origin cell: the era
 * `vite.config.ts` lifted onto the Vite 8 target.
 *
 * The lift is not performed by hand here. The era configuration is read and
 * planned by the reusable Vite-origin adapter first, so the build cannot start
 * unless every option the era file declares and every plugin it imports has a
 * stated current-Vite reading. Only the paths and the era file's location are
 * application knowledge, and they live here.
 */

const target = process.cwd();
const eraConfig = path.join(target, 'vite.config.ts');

/**
 * The plan for the era configuration, computed before anything is built. A
 * refusal here means no build is attempted, which is the point: an option
 * nobody has a reading for must not reach a bundler that would happily proceed
 * without one.
 */
const plan = planViteOriginConfigSource(readFileSync(eraConfig, 'utf8'), 'vite.config.ts');

/**
 * The era plugin list is translated, not carried. `@vitejs/plugin-react` 1.x
 * owned the JSX transform on the Vite 2 line; the Vite 8 bundler performs that
 * transform itself, reading `jsx: "react-jsx"` out of this workspace's own
 * tsconfig. The plugin's remaining half is React Fast Refresh, which is a
 * dev-server capability that a production build lane never reaches. It is
 * therefore omitted from this build deliberately, and the omission is recorded
 * in the plan's coverage note rather than left to be inferred from a green
 * build.
 */
const clientApis: ViteClientApiRecord[] = [];
const translationReport = path.join(target, 'config-translation.json');

const compareUtf16CodeUnits = (left: string, right: string): number =>
	left === right ? 0 : left < right ? -1 : 1;

export default defineConfig({
	root: target,
	plugins: [
		...createViteOriginAdapter({ observeClientApis: (record) => clientApis.push(record) }),
		{
			name: 'versionless-fixture-config-translation-report',
			closeBundle: {
				order: 'post',
				sequential: true,
				handler() {
					writeFileSync(
						translationReport,
						`${JSON.stringify(
							{
								plan,
								clientApiRewrites: clientApis
									.map((record) => ({
										module: path
											.relative(target, record.id)
											.split(path.sep)
											.join('/'),
										apis: [...record.apis],
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
	/**
	 * The era configuration's dev-server block, carried verbatim as the plan
	 * says it may be. A production build reads none of it; it is present so the
	 * migrated configuration is the whole era configuration and not a subset of
	 * it that happens to build.
	 */
	server: {
		cors: true,
		proxy: {
			'/api': { target: 'http://localhost:8080/', changeOrigin: true },
			'/h/': { target: 'http://localhost:8080/', changeOrigin: true },
		},
	},
	build: { emptyOutDir: true },
});
