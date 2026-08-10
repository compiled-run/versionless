import { canonicalize, sha256 } from '../../../core/src/index.ts';

export const REACT_DASHBOARD_SOURCE_COMMIT = '4b8be9f7e0080d680598c74d7e6cfbe080566059' as const;

export type ReactDashboardLane = 'vite4-react18.2' | 'vite8-react18.3';

export type ReactDashboardMigration = Readonly<{
	files: Readonly<Record<string, string>>;
	changedFiles: readonly ['package.json', 'vite.config.js', 'vite.config.ts'];
	digest: string;
}>;

const viteConfig = `import { resolve } from "pathe";
import dotenv from "dotenv";
import { defineConfig, type ConfigEnv } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import tsconfigPaths from "vite-tsconfig-paths";

function loadEnvFiles(mode: string): void {
  for (const file of [\`.env.\${mode}.local\`, \`.env.\${mode}\`, ".env.local", ".env"])
    dotenv.config({ path: file });
}

export default ({ mode }: ConfigEnv) => {
  loadEnvFiles(mode);
  return defineConfig({
    server: { port: 42007 },
    resolve: { alias: [{ find: "~@darekkay/styles", replacement: resolve(import.meta.dirname, "node_modules/@darekkay/styles") }] },
    define: {
      "process.env.NODE_ENV": JSON.stringify(mode),
      "process.env.APP_VERSION": JSON.stringify(process.env.npm_package_version),
      "process.env.DASHBOARD_API_BASE_URL": JSON.stringify(process.env.DASHBOARD_API_BASE_URL),
      "process.env.DASHBOARD_IS_STORAGE_PAUSED": JSON.stringify(process.env.DASHBOARD_IS_STORAGE_PAUSED),
    },
    build: { outDir: "build" },
    plugins: [react({ exclude: (id) => id.includes(".stories.") }), svgr(), tsconfigPaths()],
  });
};
`;

function object(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`React Dashboard ${label} must be an object`);
	return value as Record<string, unknown>;
}

export function transformReactDashboardVite8(
	files: Readonly<Record<string, string>>,
): ReactDashboardMigration {
	if (!files['package.json'] || !files['vite.config.js'])
		throw new Error('React Dashboard migration requires exact package and Vite config inputs');
	const manifest = object(JSON.parse(files['package.json']), 'package manifest');
	const dependencies = object(manifest.dependencies, 'dependencies');
	const devDependencies = object(manifest.devDependencies, 'devDependencies');
	if (
		dependencies.react !== '18.2.0' ||
		dependencies['react-dom'] !== '18.2.0' ||
		devDependencies.vite !== '4.0.4'
	)
		throw new Error('React Dashboard pinned baseline dependency identities differ');
	dependencies.react = '18.3.1';
	dependencies['react-dom'] = '18.3.1';
	devDependencies.vite = '8.0.0';
	const next: Record<string, string> = {
		...files,
		'package.json': `${JSON.stringify(manifest, null, 2)}\n`,
		'vite.config.ts': viteConfig,
	};
	delete next['vite.config.js'];
	const changedFiles = ['package.json', 'vite.config.js', 'vite.config.ts'] as const;
	return {
		files: next,
		changedFiles,
		digest: sha256(canonicalize(changedFiles.map((file) => [file, next[file] ?? null]))),
	};
}

export const reactDashboardJourney = Object.freeze({
	witness: 'direct-browser' as const,
	steps: [
		{ action: 'click', role: 'button', accessibleName: 'Add widget' },
		{ action: 'click', role: 'button', accessibleName: 'Notes' },
		{
			action: 'fill',
			role: 'textbox',
			accessibleName: 'Notes',
			value: 'Versionless persistence witness',
		},
		{ action: 'drag', source: '.grid-draggable', target: '.react-grid-layout' },
		{
			action: 'reload-and-read',
			storage: 'persist:root',
			expectedText: 'Versionless persistence witness',
		},
		{ action: 'click', role: 'menuitem', accessibleName: 'Settings' },
		{ action: 'click', selector: '[data-theme="dark"]' },
		{ action: 'select', role: 'combobox', accessibleName: 'Language', value: 'de' },
		{
			action: 'reload-and-read',
			storage: 'persist:root',
			bodyDataset: { theme: 'dark' },
			language: 'de',
		},
	] as const,
});
