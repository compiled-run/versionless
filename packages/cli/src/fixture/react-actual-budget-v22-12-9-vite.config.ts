import { extname, relative, resolve } from 'pathe';
import { defineConfig, transformWithEsbuild, type Plugin, type UserConfig } from 'vite';

export type ActualBudgetViteConfigInput = {
	sourceRoot: string;
	webRoot: string;
	outDir: string;
};

function actualBudgetJsxPlugin(sourceRoot: string): Plugin {
	const normalizedSource = resolve(sourceRoot);
	return {
		name: 'versionless-actual-budget-jsx',
		enforce: 'pre',
		async transform(code, id) {
			const normalizedId = resolve(id);
			if (
				!relative(normalizedSource, normalizedId).startsWith('..') &&
				extname(normalizedId) === '.js'
			)
				return await transformWithEsbuild(code, id, { loader: 'jsx', jsx: 'automatic' });
			return undefined;
		},
	};
}

export function createActualBudgetViteConfig(input: ActualBudgetViteConfigInput): UserConfig {
	const sourceRoot = resolve(input.sourceRoot);
	const webRoot = resolve(input.webRoot);
	const outDir = resolve(input.outDir);
	if (relative(sourceRoot, webRoot).startsWith('..'))
		throw new Error('Actual Budget Vite web root escapes source');
	return defineConfig({
		root: webRoot,
		base: './',
		plugins: [actualBudgetJsxPlugin(sourceRoot)],
		resolve: {
			preserveSymlinks: true,
		},
		worker: {
			format: 'es',
		},
		build: {
			outDir,
			emptyOutDir: false,
			target: 'es2022',
			assetsInlineLimit: 0,
			cssCodeSplit: true,
			sourcemap: false,
			manifest: true,
			rollupOptions: {
				output: {
					entryFileNames: 'assets/[name]-[hash].js',
					chunkFileNames: 'assets/[name]-[hash].js',
					assetFileNames: 'assets/[name]-[hash][extname]',
				},
			},
		},
	});
}

export default createActualBudgetViteConfig({
	sourceRoot: process.env.VERSIONLESS_ACTUAL_BUDGET_SOURCE ?? '.',
	webRoot: process.env.VERSIONLESS_ACTUAL_BUDGET_WEB ?? '.',
	outDir: process.env.VERSIONLESS_ACTUAL_BUDGET_OUT ?? 'dist-vite',
});
