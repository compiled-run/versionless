import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { char, createRegExp, exactly } from 'magic-regexp';
import * as path from 'pathe';
import { joinURL } from 'ufo';
import { defineConfig, transformWithOxc, type Plugin } from 'vite';

const applicationJavaScript = createRegExp(
	exactly(path.sep, 'app', path.sep).and(char.times.any(), '.js').at.lineEnd(),
);

const commonJsI18n = [
	"const addLocaleData = require('react-intl').addLocaleData; //eslint-disable-line",
	"const enLocaleData = require('react-intl/locale-data/en');",
	"const deLocaleData = require('react-intl/locale-data/de');",
	"const enTranslationMessages = require('./translations/en.json');",
	"const deTranslationMessages = require('./translations/de.json');",
].join('\n');
const moduleI18n = [
	"import { addLocaleData } from 'react-intl';",
	"import enLocaleData from 'react-intl/locale-data/en';",
	"import deLocaleData from 'react-intl/locale-data/de';",
	"import enTranslationMessages from './translations/en.json';",
	"import deTranslationMessages from './translations/de.json';",
].join('\n');

const serviceWorkerRegistration = [
	"if ('serviceWorker' in navigator) {",
	"  window.addEventListener('load', () => {",
	"    void navigator.serviceWorker.register('/sw.js', { scope: '/' });",
	'  });',
	'}',
].join('\n');

const sha256 = (value: string | Uint8Array): string =>
	createHash('sha256').update(value).digest('hex');

async function filesBelow(directory: string): Promise<string[]> {
	const files: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const item = path.join(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await filesBelow(item)));
		else if (entry.isFile()) files.push(item);
	}
	return files.sort();
}

function deterministicServiceWorker(): Plugin {
	return {
		name: 'versionless-react-boilerplate-v4-service-worker',
		async closeBundle() {
			const output = path.join(target, 'build-vite');
			const excluded = new Set(['precache-manifest.json', 'sw.js']);
			const entries = await Promise.all(
				(await filesBelow(output))
					.map((file) => path.relative(output, file).split(path.sep).join('/'))
					.filter((file) => !excluded.has(file))
					.sort()
					.map(async (file) => ({ url: joinURL('/', file), sha256: sha256(await readFile(path.join(output, file))) })),
			);
			const manifest = {
				schemaVersion: 'versionless.react-vite8-precache.v1',
				scope: '/',
				entries,
			};
			const manifestBody = `${JSON.stringify(manifest, null, 2)}\n`;
			const cacheName = `versionless-react-vite8-${sha256(manifestBody)}`;
			await writeFile(path.join(output, 'precache-manifest.json'), manifestBody);
			const urls = entries.map((entry) => entry.url);
			const worker = [
				`const CACHE_NAME = '${cacheName}';`,
				`const PRECACHE_URLS = ${JSON.stringify(urls)};`,
				"self.addEventListener('install', event => {",
				'  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()));',
				'});',
				"self.addEventListener('activate', event => {",
				"  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('versionless-react-vite8-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));",
				'});',
				"self.addEventListener('fetch', event => {",
				"  if (event.request.method !== 'GET') return;",
				'  const url = new URL(event.request.url);',
				'  if (url.origin !== self.location.origin) return;',
				"  const cacheKey = event.request.mode === 'navigate' ? '/index.html' : url.pathname;",
				'  event.respondWith(caches.open(CACHE_NAME).then(cache => cache.match(cacheKey)).then(cached => cached || fetch(event.request)));',
				'});',
				'',
			].join('\n');
			await writeFile(path.join(output, 'sw.js'), worker);
		},
	};
}

function legacyReactAdapter(): Plugin {
	return {
		name: 'versionless-react-boilerplate-v4-vite8-adapter',
		enforce: 'pre',
		async transform(source, id) {
			if (!applicationJavaScript.test(id)) return null;
			const adapted = source
				.replace(commonJsI18n, moduleI18n)
				.replace(
					"import '!file-loader?name=[name].[ext]!./images/favicon.ico';\nimport 'file-loader?name=.htaccess!./.htaccess'; // eslint-disable-line import/extensions",
					"import './images/favicon.ico';",
				)
				.replace(
					"require('offline-plugin/runtime').install(); // eslint-disable-line global-require",
					serviceWorkerRegistration,
				);
			return transformWithOxc(adapted, id, { lang: 'jsx', jsx: { runtime: 'classic' } });
		},
	};
}

const target = process.cwd();
const application = path.join(target, 'app');

export default defineConfig({
	root: target,
	base: joinURL('/', ''),
	plugins: [legacyReactAdapter(), deterministicServiceWorker()],
	define: {
		'module.hot': 'false',
		'process.env.NODE_ENV': JSON.stringify('production'),
	},
	resolve: {
		alias: {
			components: path.join(application, 'components'),
			containers: path.join(application, 'containers'),
			images: path.join(application, 'images'),
			utils: path.join(application, 'utils'),
		},
	},
	build: {
		outDir: path.join(target, 'build-vite'),
		emptyOutDir: true,
	},
});
