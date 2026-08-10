import * as path from 'pathe';
import { joinURL } from 'ufo';
import { defineConfig } from 'vite';
import {
	craProcessEnvironmentDefines,
	createCraViteAdapter,
} from '../../packages/frameworks/react/src/index.ts';

const target = process.cwd();
const environment = { NODE_ENV: 'production', PUBLIC_URL: '' } as const;

export default defineConfig({
	root: target,
	base: joinURL('/', ''),
	publicDir: false,
	plugins: [
		...createCraViteAdapter({
			publicDirectory: path.join(target, 'public'),
			templateFile: 'index.html',
		}),
	],
	define: craProcessEnvironmentDefines(environment),
	build: {
		outDir: path.join(target, 'build-vite'),
		emptyOutDir: true,
		sourcemap: true,
	},
});
