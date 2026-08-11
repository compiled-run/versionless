import { writeFileSync } from 'node:fs';
import * as path from 'pathe';
import { joinURL } from 'ufo';
import { defineConfig } from 'vite';
import type {
	CraDecodedModuleRecord,
	CraImplicitGlobalRecord,
} from '../../packages/frameworks/react/src/index.ts';
import {
	craProcessEnvironmentDefines,
	createCraViteAdapter,
} from '../../packages/frameworks/react/src/index.ts';

/**
 * The migrated lane for this create-react-app 5 / webpack 5 application.
 *
 * Everything compatibility-shaped here comes from the generic create-react-app
 * adapter in @versionless/react; this file carries only the application's own
 * paths and the environment create-react-app would have inlined. The adapter
 * composition is applied unchanged from the create-react-app 3 and 4 cells that
 * preceded this one — what differs is the era it is being asked to cover, and
 * every capability's actual contribution is measured rather than assumed.
 */

const target = process.cwd();

/**
 * The environment `react-scripts build` inlines. `PUBLIC_URL` is empty because
 * package.json declares an absolute `homepage` whose pathname is `/`, which is
 * what create-react-app resolves that field to.
 */
const environment = { NODE_ENV: 'production', PUBLIC_URL: '' } as const;

const implicitGlobals: CraImplicitGlobalRecord[] = [];
const decodedModules: CraDecodedModuleRecord[] = [];
const capabilityReport = path.join(target, 'capability-report.json');

const compareUtf16CodeUnits = (left: string, right: string): number =>
	left === right ? 0 : left < right ? -1 : 1;

const relative = (id: string): string => path.relative(target, id).split(path.sep).join('/');

export default defineConfig({
	root: target,
	base: joinURL('/', ''),
	publicDir: false,
	plugins: [
		...createCraViteAdapter({
			publicDirectory: path.join(target, 'public'),
			templateFile: 'index.html',
			observeImplicitGlobals: (record) => implicitGlobals.push(record),
			observeDecodedModules: (record) => decodedModules.push(record),
		}),
		{
			name: 'versionless-fixture-capability-report',
			closeBundle: {
				order: 'post',
				sequential: true,
				handler() {
					const report = {
						sloppyCommonJsImplicitGlobals: implicitGlobals
							.map((record) => ({
								module: relative(record.id),
								names: [...record.names],
							}))
							.sort((left, right) =>
								compareUtf16CodeUnits(left.module, right.module),
							),
						nonUtf8DecodedModules: decodedModules
							.map((record) => ({
								module: relative(record.id),
								encoding: record.encoding,
								invalidByteOffsets: record.invalidByteOffsets.length,
							}))
							.sort((left, right) =>
								compareUtf16CodeUnits(left.module, right.module),
							),
					};
					writeFileSync(capabilityReport, `${JSON.stringify(report, null, '\t')}\n`);
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
