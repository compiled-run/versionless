import { createVite8AdapterKernel } from '../../packages/core/src/index.ts';
import { defineConfig } from 'vite';
import adapter from './vite.adapter.ts';

export default defineConfig({
	...adapter,
	plugins: [adapter.plugins ?? [], createVite8AdapterKernel({ profile: 'react-boilerplate-v4' })],
});
