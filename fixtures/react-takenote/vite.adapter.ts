import { defineConfig } from 'vite';

export default defineConfig({
	build: { outDir: 'dist-vite8', emptyOutDir: true },
	define: {
		'process.env.DEMO': JSON.stringify('true'),
		'process.env.NODE_ENV': JSON.stringify('production'),
	},
	server: { host: '127.0.0.1' },
});
