import { readFile } from 'node:fs/promises';
import { join, resolve } from 'pathe';
import { defineConfig, transformWithEsbuild, type Plugin } from 'vite';

function sqlpadJsx(): Plugin {
	return {
		name: 'versionless-sqlpad-jsx',
		enforce: 'pre',
		async transform(code, id) {
			if (!id.includes('/client/src/') || !id.endsWith('.js')) return undefined;
			return transformWithEsbuild(code, id, { loader: 'jsx', jsx: 'automatic' });
		},
		async transformIndexHtml(html) {
			if (html.includes('type="module"')) return html;
			return html.replace(
				'</body>',
				'  <script type="module" src="/src/index.js"></script>\n</body>',
			);
		},
	};
}

const clientRoot = process.env.VERSIONLESS_SQLPAD_CLIENT_ROOT;
if (!clientRoot) throw new Error('SQLPad Vite client root is required');
await readFile(join(clientRoot, 'src/index.js'));

export default defineConfig({
	root: resolve(clientRoot),
	plugins: [sqlpadJsx()],
	build: {
		outDir: 'dist',
		emptyOutDir: true,
		assetsDir: 'assets',
		cssCodeSplit: false,
		minify: false,
		sourcemap: false,
		rollupOptions: {
			output: {
				entryFileNames: 'assets/app.js',
				chunkFileNames: 'assets/[name].js',
				assetFileNames: 'assets/[name][extname]',
			},
		},
	},
});
