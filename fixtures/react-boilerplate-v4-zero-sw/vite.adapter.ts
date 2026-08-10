import { char, createRegExp, exactly } from 'magic-regexp';
import { join, sep } from 'pathe';
import { joinURL } from 'ufo';
import { defineConfig, transformWithOxc, type Plugin } from 'vite';

const applicationJavaScript = createRegExp(
	exactly(sep, 'app', sep).and(char.times.any(), '.js').at.lineEnd(),
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
const fileLoaderImports = [
	"import '!file-loader?name=[name].[ext]!./images/favicon.ico';",
	"import 'file-loader?name=.htaccess!./.htaccess'; // eslint-disable-line import/extensions",
].join('\n');

function zeroServiceWorkerAdapter(): Plugin {
	return {
		name: 'versionless-react-boilerplate-v4-zero-sw-adapter',
		enforce: 'pre',
		async transform(source, id) {
			if (!applicationJavaScript.test(id)) return null;
			if (
				source.includes("require('offline-plugin/runtime')") ||
				source.includes('navigator.serviceWorker.register')
			)
				throw new Error('Zero-SW target retained a service-worker registration seam');
			const adapted = source
				.replace(commonJsI18n, moduleI18n)
				.replace(fileLoaderImports, "import './images/favicon.ico';");
			return transformWithOxc(adapted, id, {
				lang: 'jsx',
				jsx: { runtime: 'classic' },
			});
		},
	};
}

const target = process.cwd();
const application = join(target, 'app');

export default defineConfig({
	root: target,
	base: joinURL('/', ''),
	plugins: [zeroServiceWorkerAdapter()],
	define: {
		'module.hot': 'false',
		'process.env.NODE_ENV': JSON.stringify('production'),
	},
	resolve: {
		alias: {
			components: join(application, 'components'),
			containers: join(application, 'containers'),
			images: join(application, 'images'),
			utils: join(application, 'utils'),
		},
	},
	build: {
		outDir: join(target, 'build-vite'),
		emptyOutDir: true,
	},
});
