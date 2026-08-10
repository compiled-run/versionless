import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'pathe';
import { describe, expect, test } from 'vitest';
import {
	craEntryDocument,
	craProcessEnvironmentDefines,
	craPublicAssetPaths,
	createCraPublicDirectoryPlugin,
	createCraTildeCssImportPlugin,
	createCraViteAdapter,
	rewriteWebpackTildeCssImports,
	substituteCraTemplatePlaceholders,
} from '../src/react-cra-vite-adapter.ts';

const template = [
	'<!DOCTYPE html>',
	'<html lang="en">',
	'  <head>',
	'    <link rel="icon" href="%PUBLIC_URL%/logo.svg" />',
	'    <script src="https://example.invalid/tag?id=%REACT_APP_ANALYTICS_ID%"></script>',
	'  </head>',
	'  <body>',
	'    <div id="root"></div>',
	'  </body>',
	'</html>',
	'',
].join('\n');

describe('create-react-app template placeholders', () => {
	test('substitutes provided keys and preserves unknown placeholders', () => {
		const result = substituteCraTemplatePlaceholders(template, { PUBLIC_URL: '' });
		expect(result).toContain('href="/logo.svg"');
		expect(result).toContain('id=%REACT_APP_ANALYTICS_ID%');
	});
	test('honours a non-root public url for every occurrence', () => {
		const result = substituteCraTemplatePlaceholders(
			'%PUBLIC_URL%/a %PUBLIC_URL%/b',
			{ PUBLIC_URL: '/console' },
		);
		expect(result).toBe('/console/a /console/b');
	});
	test('injects the entry module before the closing body tag', () => {
		const document = craEntryDocument({
			template,
			entryModule: '/src/index.tsx',
			environment: { PUBLIC_URL: '' },
		});
		const script = '<script type="module" src="/src/index.tsx"></script>';
		expect(document).toContain(script);
		expect(document.indexOf(script)).toBeLessThan(document.indexOf('</body>'));
		expect(document.indexOf('<div id="root">')).toBeLessThan(document.indexOf(script));
		expect(craEntryDocument({ template, entryModule: '/src/index.tsx' })).toContain(
			'%PUBLIC_URL%/logo.svg',
		);
	});
	test('appends the entry module when no body tag is present', () => {
		const document = craEntryDocument({ template: '<div id="root"></div>', entryModule: '/main.js' });
		expect(document).toBe('<div id="root"></div>\n<script type="module" src="/main.js"></script>\n');
	});
});

describe('create-react-app process environment defines', () => {
	test('inlines each key and the whole environment in sorted order', () => {
		const defines = craProcessEnvironmentDefines({
			PUBLIC_URL: '',
			NODE_ENV: 'production',
			REACT_APP_API: 'https://example.invalid',
		});
		expect(defines['process.env.NODE_ENV']).toBe('"production"');
		expect(defines['process.env.PUBLIC_URL']).toBe('""');
		expect(defines['process.env.REACT_APP_API']).toBe('"https://example.invalid"');
		expect(defines['process.env']).toBe(
			'{"NODE_ENV":"production","PUBLIC_URL":"","REACT_APP_API":"https://example.invalid"}',
		);
		expect(craProcessEnvironmentDefines({})).toEqual({ 'process.env': '{}' });
	});
});

describe('webpack tilde specifiers in CSS', () => {
	test('rewrites quoted and url() imports without touching relative ones', () => {
		const code = [
			"@import '~antd/dist/antd.css';",
			'@import "~normalize.css";',
			'@import url("~a-package/b.css");',
			"@import './local.css';",
		].join('\n');
		expect(rewriteWebpackTildeCssImports(code)).toBe(
			[
				"@import 'antd/dist/antd.css';",
				'@import "normalize.css";',
				'@import url("a-package/b.css");',
				"@import './local.css';",
			].join('\n'),
		);
	});
	test('the plugin transforms only CSS ids and returns null when unchanged', () => {
		const plugin = createCraTildeCssImportPlugin();
		expect(plugin.enforce).toBe('pre');
		expect(plugin.transform("@import '~antd/dist/antd.css';", '/app/src/App.css?used')).toEqual({
			code: "@import 'antd/dist/antd.css';",
			map: null,
		});
		expect(plugin.transform("@import '~antd/dist/antd.css';", '/app/src/App.tsx')).toBeNull();
		expect(plugin.transform("@import './local.css';", '/app/src/App.css')).toBeNull();
	});
});

describe('create-react-app public directory', () => {
	test('copies every public file except the template into the build output', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'versionless-cra-public-'));
		const publicDirectory = path.join(root, 'public');
		const outDir = path.join(root, 'build');
		await mkdir(path.join(publicDirectory, 'nested'), { recursive: true });
		await mkdir(outDir, { recursive: true });
		await writeFile(path.join(publicDirectory, 'index.html'), 'template');
		await writeFile(path.join(publicDirectory, 'robots.txt'), 'User-agent: *\n');
		await writeFile(path.join(publicDirectory, 'nested/widget.js'), 'export {};\n');

		expect(await craPublicAssetPaths(publicDirectory, ['index.html'])).toEqual([
			'nested/widget.js',
			'robots.txt',
		]);

		const plugin = createCraPublicDirectoryPlugin({
			directory: publicDirectory,
			exclude: ['index.html'],
		});
		plugin.configResolved({ build: { outDir } });
		await plugin.closeBundle.handler();
		expect(await readFile(path.join(outDir, 'robots.txt'), 'utf8')).toBe('User-agent: *\n');
		expect(await readFile(path.join(outDir, 'nested/widget.js'), 'utf8')).toBe('export {};\n');
		await expect(readFile(path.join(outDir, 'index.html'), 'utf8')).rejects.toThrow();
	});
	test('refuses to copy before the build output directory is resolved', async () => {
		const plugin = createCraPublicDirectoryPlugin({ directory: tmpdir() });
		await expect(plugin.closeBundle.handler()).rejects.toThrow('outDir is unresolved');
	});
	test('the composed adapter excludes the template by default', () => {
		const [transform, output] = createCraViteAdapter({ publicDirectory: tmpdir() });
		expect(transform.name).toBe('versionless-cra-tilde-css-import');
		expect(output.name).toBe('versionless-cra-public-directory');
		expect(output.closeBundle.order).toBe('post');
	});
});
