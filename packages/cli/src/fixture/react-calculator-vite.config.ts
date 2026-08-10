import { transformWithEsbuild, type Plugin } from 'vite';
import { defineConfig } from 'vite';
import { relative, resolve } from 'pathe';

const root = resolve(process.env.VERSIONLESS_CALCULATOR_ROOT ?? '.');

const calculatorJsx = (): Plugin => ({
	name: 'versionless-react-calculator-jsx',
	enforce: 'pre',
	async transform(code, id) {
		const local = relative(root, id);
		if (!local.startsWith('src/') || !local.endsWith('.js')) return null;
		return await transformWithEsbuild(code, id, {
			loader: 'jsx',
			jsx: 'automatic',
			target: 'es2022',
		});
	},
});

export default defineConfig({
	root,
	plugins: [calculatorJsx()],
	build: { outDir: 'build', emptyOutDir: true },
});
