import { char, createRegExp, exactly, maybe } from 'magic-regexp';
import { MagicRegExpTransformPlugin } from 'magic-regexp/transform';
import { join } from 'pathe';
import { defineConfig } from 'vite-plus';
import type { PackUserConfig } from 'vite-plus/pack';

const rootDir = import.meta.dirname;
const external = (name: string) =>
	createRegExp(
		exactly(name)
			.at.lineStart()
			.and(maybe(exactly('/'), char.times.any()))
			.at.lineEnd(),
	);
const nodeBuiltin = createRegExp(
	exactly('node:').at.lineStart().and(char.times.any()).at.lineEnd(),
);

const pack = (
	packagePath: string,
	name: string,
	dependencies: readonly string[] = [],
	options: Partial<PackUserConfig> = {},
): PackUserConfig => ({
	name,
	cwd: join(rootDir, packagePath),
	entry: { index: './src/index.ts' },
	format: ['esm'],
	outDir: './dist',
	platform: 'node',
	fixedExtension: false,
	dts: false,
	clean: true,
	deps: { neverBundle: [nodeBuiltin, ...dependencies.map(external)], onlyBundle: false },
	...options,
});

export default defineConfig({
	plugins: [MagicRegExpTransformPlugin.vite()],
	staged: { '*': 'vp check --fix' },
	pack: [
		pack('packages/core', '@versionless/core', ['yuku-analyzer']),
		pack('packages/trust', '@versionless/trust', ['@versionless/core']),
		pack('packages/frameworks/react', '@versionless/react', ['yuku-analyzer']),
		pack('packages/frameworks/nextjs', '@versionless/nextjs'),
		pack('packages/frameworks/angular', '@versionless/angular', [
			'@angular/compiler',
			'yuku-analyzer',
		]),
		pack('packages/frameworks/angularjs', '@versionless/angularjs', ['yuku-analyzer']),
		pack(
			'packages/cli',
			'versionless',
			['@angular/compiler', '@async/witness', 'playwright', 'yuku-analyzer'],
			{
				entry: { index: './src/index.ts', cli: './src/cli.ts' },
			},
		),
		pack('packages/experiments', '@versionless/experiments', [
			'@angular/compiler',
			'yuku-analyzer',
			'yuku-parser',
		]),
		pack('packages/node-guard', '@versionless/node-guard', [], {
			format: ['cjs'],
			fixedExtension: true,
		}),
	],
	test: {
		// One project per package so every test is badged by component in the
		// vitest UI/reporters. Selected together via --project 'node-*'.
		projects: [
			{
				test: {
					name: 'node-core',
					environment: 'node',
					testTimeout: 120_000,
					hookTimeout: 120_000,
					include: ['packages/core/test/**/*.test.ts'],
				},
			},
			{
				test: {
					name: 'node-trust',
					environment: 'node',
					testTimeout: 120_000,
					hookTimeout: 120_000,
					include: ['packages/trust/test/**/*.test.ts'],
				},
			},
			{
				test: {
					name: 'node-cli',
					environment: 'node',
					testTimeout: 120_000,
					hookTimeout: 120_000,
					include: ['packages/cli/test/**/*.test.ts'],
				},
			},
			{
				test: {
					name: 'node-guard',
					environment: 'node',
					testTimeout: 120_000,
					hookTimeout: 120_000,
					include: ['packages/node-guard/test/**/*.test.ts'],
				},
			},
			{
				test: {
					name: 'node-angular',
					environment: 'node',
					testTimeout: 120_000,
					hookTimeout: 120_000,
					include: ['packages/frameworks/angular/test/**/*.test.ts'],
				},
			},
			{
				test: {
					name: 'node-angularjs',
					environment: 'node',
					testTimeout: 120_000,
					hookTimeout: 120_000,
					include: ['packages/frameworks/angularjs/test/**/*.test.ts'],
				},
			},
			{
				test: {
					name: 'node-react',
					environment: 'node',
					testTimeout: 120_000,
					hookTimeout: 120_000,
					include: ['packages/frameworks/react/test/**/*.test.ts'],
				},
			},
			{
				test: {
					name: 'node-nextjs',
					environment: 'node',
					testTimeout: 120_000,
					hookTimeout: 120_000,
					include: ['packages/frameworks/nextjs/test/**/*.test.ts'],
				},
			},
		],
	},
	lint: {
		ignorePatterns: [
			'node_modules/**',
			'**/dist/**',
			'.versionless/**',
			'docs/**',
			'evidence/**',
		],
	},
	fmt: {
		useTabs: true,
		tabWidth: 4,
		printWidth: 100,
		endOfLine: 'lf',
		singleQuote: true,
		ignorePatterns: [
			'node_modules/**',
			'**/dist/**',
			'.versionless/**',
			'docs/**',
			'evidence/**',
			'pnpm-lock.yaml',
			'fixtures/**',
		],
	},
});
