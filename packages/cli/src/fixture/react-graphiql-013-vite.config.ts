import { defineConfig } from 'vite';
import { join, resolve } from 'pathe';

const applicationRoot = process.env.VERSIONLESS_GRAPHIQL_APPLICATION_ROOT;
if (!applicationRoot) throw new Error('GraphiQL Vite adapter requires application root');

export default defineConfig({
	root: resolve(applicationRoot),
	cacheDir: join(applicationRoot, '.vite-cache'),
	build: {
		outDir: join(applicationRoot, 'packages/graphiql/example/vite-output'),
		emptyOutDir: true,
		minify: false,
		lib: {
			entry: join(applicationRoot, 'packages/graphiql/dist/index.js'),
			name: 'GraphiQL',
			formats: ['iife'],
			fileName: () => 'graphiql-vite.js',
		},
		rollupOptions: {
			external: ['react', 'react-dom'],
			output: { globals: { react: 'React', 'react-dom': 'ReactDOM' } },
		},
	},
});
