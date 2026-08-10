import { defineConfig } from 'vite';

export default defineConfig({
	build: { outDir: 'dist-vite8', emptyOutDir: true },
	define: {
		'process.env.NODE_ENV': JSON.stringify('production'),
		'process.env.REACT_APP_DISABLE_SENTRY': JSON.stringify('true'),
	},
	server: { host: '127.0.0.1', strictPort: true },
});
