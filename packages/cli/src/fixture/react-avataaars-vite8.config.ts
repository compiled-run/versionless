import * as path from 'pathe';
import { defineConfig } from 'vite';

const applicationRoot = process.env.VERSIONLESS_AVATAAARS_APPLICATION_ROOT;
if (!applicationRoot) throw new Error('Avataaars Vite 8 application root is required');

export default defineConfig({
	root: applicationRoot,
	publicDir: false,
	define: {
		'process.env.REACT_APP_IMG_RENDERER_URL': JSON.stringify(''),
		'process.env.NODE_ENV': JSON.stringify('production'),
	},
	build: {
		outDir: path.join(applicationRoot, 'dist-target'),
		emptyOutDir: true,
	},
});
