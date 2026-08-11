import { writeFileSync } from 'node:fs';
import * as path from 'pathe';
import { joinURL } from 'ufo';
import { defineConfig } from 'vite';
import type { CraImplicitGlobalRecord } from '../../packages/frameworks/react/src/index.ts';
import {
	craProcessEnvironmentDefines,
	createCraViteAdapter,
} from '../../packages/frameworks/react/src/index.ts';

const target = process.cwd();
const environment = { NODE_ENV: 'production', PUBLIC_URL: '' } as const;

/**
 * Every dependency module that needed webpack 4's sloppy-mode CommonJS wrapper,
 * written beside the work area rather than into the build output. The record is
 * a pure function of the module graph, so both determinism runs produce the same
 * file and neither build output is affected by it.
 */
const implicitGlobals: CraImplicitGlobalRecord[] = [];
const implicitGlobalsReport = path.join(target, 'implicit-globals.json');

const compareUtf16CodeUnits = (left: string, right: string): number =>
	left === right ? 0 : left < right ? -1 : 1;

export default defineConfig({
	root: target,
	base: joinURL('/', ''),
	publicDir: false,
	plugins: [
		...createCraViteAdapter({
			publicDirectory: path.join(target, 'public'),
			templateFile: 'index.html',
			observeImplicitGlobals: (record) => implicitGlobals.push(record),
		}),
		{
			name: 'versionless-fixture-implicit-global-report',
			closeBundle: {
				order: 'post',
				sequential: true,
				handler() {
					const records = implicitGlobals
						.map((record) => ({
							module: path.relative(target, record.id).split(path.sep).join('/'),
							names: [...record.names],
						}))
						.sort((left, right) => compareUtf16CodeUnits(left.module, right.module));
					writeFileSync(implicitGlobalsReport, `${JSON.stringify(records, null, '\t')}\n`);
				},
			},
		},
	],
	define: craProcessEnvironmentDefines(environment),
	build: {
		outDir: path.join(target, 'build-vite'),
		emptyOutDir: true,
		sourcemap: true,
	},
});
