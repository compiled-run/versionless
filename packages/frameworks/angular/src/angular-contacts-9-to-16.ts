import { analyze } from 'yuku-analyzer';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';

export const ANGULAR_CONTACTS_REDUCER_SEAM = 'contactsAdapter.removeOne(id, state)' as const;

type Files = Readonly<Record<string, string>>;
export type AngularContactsMajor = 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16;
export type AngularContactsStep = Readonly<{
	from: AngularContactsMajor;
	to: AngularContactsMajor;
	files: Files;
	spans: readonly Readonly<{ path: string; before: string; after: string }>[];
	digest: string;
	yukuDiagnostics: 0;
}>;

const versions = {
	10: {
		angular: '10.2.5',
		cli: '10.2.4',
		build: '0.1002.4',
		ngrx: '10.1.2',
		typescript: '3.9.10',
		zone: '0.10.3',
	},
	11: {
		angular: '11.2.14',
		cli: '11.2.19',
		build: '0.1102.19',
		ngrx: '11.1.1',
		typescript: '4.1.6',
		zone: '0.11.4',
	},
	12: {
		angular: '12.2.17',
		cli: '12.2.18',
		build: '12.2.18',
		ngrx: '12.5.1',
		typescript: '4.3.5',
		zone: '0.11.4',
	},
	13: {
		angular: '13.3.12',
		cli: '13.3.11',
		build: '13.3.11',
		ngrx: '13.2.0',
		typescript: '4.6.4',
		zone: '0.11.8',
	},
	14: {
		angular: '14.2.12',
		cli: '14.2.10',
		build: '14.2.10',
		ngrx: '14.3.3',
		typescript: '4.8.4',
		zone: '0.11.8',
	},
	15: {
		angular: '15.2.10',
		cli: '15.2.10',
		build: '15.2.10',
		ngrx: '15.4.0',
		typescript: '4.9.5',
		zone: '0.12.0',
	},
	16: {
		angular: '16.2.12',
		cli: '16.2.16',
		build: '16.2.16',
		ngrx: '16.3.0',
		typescript: '5.1.6',
		zone: '0.13.3',
	},
} as const;

function object(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`Angular Contacts ${label} must be an object`);
	return value as Record<string, unknown>;
}

function replaceExact(source: string, before: string, after: string, label: string): string {
	if (!source.includes(before) || source.indexOf(before) !== source.lastIndexOf(before))
		throw new Error(`Angular Contacts ${label} seam is absent or ambiguous`);
	return source.replace(before, after);
}

function replaceEvery(
	source: string,
	before: string,
	after: string,
	count: number,
	label: string,
): string {
	if (source.split(before).length - 1 !== count)
		throw new Error(`Angular Contacts ${label} seam count differs`);
	return source.replaceAll(before, after);
}

function yukuGuard(files: Files): void {
	for (const path of [
		'src/app/views/contacts/services/contacts.service.ts',
		'src/app/views/contacts/services/contacts-socket.service.ts',
		'src/app/views/contacts/store/contacts-reducer.ts',
	]) {
		const source = files[path];
		if (!source || analyze(source, { lang: 'ts' }).diagnostics.length)
			throw new Error(`Angular Contacts Yuku guard differs: ${path}`);
	}
}

export function applyAngularContactsCompatibilityOverlay(files: Files): AngularContactsStep {
	yukuGuard(files);
	const next = { ...files };
	const spans: Array<{ path: string; before: string; after: string }> = [];
	const change = (path: string, before: string, after: string, label: string): void => {
		next[path] = replaceExact(next[path] ?? '', before, after, label);
		spans.push({ path, before, after });
	};
	const manifest = object(JSON.parse(next['package.json'] ?? ''), 'manifest');
	const dependencies = object(manifest.dependencies, 'dependencies');
	for (const name of ['@angular/pwa', '@angular/service-worker']) {
		if (typeof dependencies[name] !== 'string')
			throw new Error(`Angular Contacts ${name} seam differs`);
		spans.push({
			path: 'package.json',
			before: `${name}:${String(dependencies[name])}`,
			after: `${name}:removed`,
		});
		delete dependencies[name];
	}
	next['package.json'] = `${JSON.stringify(manifest, null, 2)}\n`;
	change(
		'src/main.ts',
		".then(() => {\n  if ('serviceWorker' in navigator && environment.production) {\n    navigator.serviceWorker.register('/ngsw-worker.js');\n  }\n})",
		'',
		'manual service worker',
	);
	change(
		'src/app/app.module.ts',
		"import {ServiceWorkerModule } from '@angular/service-worker';\n",
		'',
		'service worker import',
	);
	change(
		'src/app/app.module.ts',
		",\n    ServiceWorkerModule.register('ngsw-worker.js', { enabled: environment.production })",
		'',
		'service worker module',
	);
	for (const path of [
		'src/environments/environment.ts',
		'src/environments/environment.local.ts',
	]) {
		next[path] = replaceEvery(
			next[path] ?? '',
			'http://localhost:3000',
			'http://127.0.0.1:3000',
			2,
			`${path} loopback`,
		);
		spans.push({ path, before: 'http://localhost:3000', after: 'http://127.0.0.1:3000' });
	}
	for (const [path, before] of [
		['src/environments/environment.dev.ts', 'http://dev.contacts.com:3000'],
		['src/environments/environment.prod.ts', 'https://contacts-api.vatsaev.com'],
	] as const) {
		next[path] = replaceEvery(
			next[path] ?? '',
			before,
			'http://127.0.0.1:3000',
			2,
			`${path} hosted API`,
		);
		spans.push({ path, before, after: 'http://127.0.0.1:3000' });
	}
	const angular = object(JSON.parse(next['angular.json'] ?? ''), 'workspace');
	const projects = object(angular.projects, 'projects');
	const project = object(projects['angular-contacts'], 'project');
	const architect = object(project.architect, 'architect');
	const build = object(architect.build, 'build');
	const options = object(build.options, 'build options');
	options.assets = [];
	const configurations = object(build.configurations, 'configurations');
	for (const configuration of Object.values(configurations)) {
		const value = object(configuration, 'configuration');
		value.serviceWorker = false;
		delete value.ngswConfigPath;
	}
	next['angular.json'] = `${JSON.stringify(angular, null, 2)}\n`;
	spans.push({
		path: 'angular.json',
		before: 'PWA assets/serviceWorker seams',
		after: 'assets:[]/serviceWorker:false',
	});
	let index = next['src/index.html'] ?? '';
	for (const before of [
		'  <link rel="icon" type="image/x-icon" href="favicon.ico">\n',
		'  <link rel="manifest" href="manifest.json">\n',
		'  <meta name="theme-color" content="#1976d2">\n',
		'\n  <script src="https://code.jquery.com/jquery-3.3.1.slim.min.js" integrity="sha384-q8i/X+965DzO0rT7abK41JStQIAqVgRVzpbzo5smXKp4YfRvH+8abtTE1Pi6jizo" crossorigin="anonymous"></script>',
		'\n  <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/js/bootstrap.min.js" integrity="sha384-JjSmVgyd0p3pXB1rRibZUAYoIIy6OrQ6VrjIEaFf/nJGzIxFDsf4x0xIM+B07jRM" crossorigin="anonymous"></script>',
	])
		index = replaceExact(index, before, '', 'index remote/PWA');
	next['src/index.html'] = index;
	spans.push({ path: 'src/index.html', before: 'remote/PWA elements', after: 'removed' });
	for (const path of Object.keys(next)) {
		if (
			path === 'src/favicon.ico' ||
			path === 'src/manifest.json' ||
			path === 'src/ngsw-config.json' ||
			path.startsWith('src/assets/icons/')
		)
			delete next[path];
	}
	return {
		from: 9,
		to: 9,
		files: next,
		spans,
		digest: sha256(canonicalize(spans)),
		yukuDiagnostics: 0,
	};
}

export function migrateAngularContactsMajor(
	files: Files,
	from: AngularContactsMajor,
	to: AngularContactsMajor,
): AngularContactsStep {
	if (to !== from + 1 || to === 9)
		throw new Error('Angular Contacts major migration must be sequential');
	yukuGuard(files);
	const target = versions[to as keyof typeof versions];
	const manifest = object(JSON.parse(files['package.json'] ?? ''), 'manifest');
	const spans: Array<{ path: string; before: string; after: string }> = [];
	for (const field of ['dependencies', 'devDependencies']) {
		const dependencies = object(manifest[field], field);
		for (const name of Object.keys(dependencies)) {
			const before = String(dependencies[name]);
			let after = before;
			if (name.startsWith('@angular/')) after = target.angular;
			if (name === '@angular/cli') after = target.cli;
			if (name === '@angular-devkit/build-angular') after = target.build;
			if (name.startsWith('@ngrx/')) after = target.ngrx;
			if (name === 'typescript') after = target.typescript;
			if (name === 'zone.js') after = target.zone;
			if (after !== before) {
				dependencies[name] = after;
				spans.push({
					path: 'package.json',
					before: `${name}:${before}`,
					after: `${name}:${after}`,
				});
			}
		}
	}
	const next: Record<string, string> = {
		...files,
		'package.json': `${JSON.stringify(manifest, null, 2)}\n`,
	};
	if (to === 16) {
		const before = '@angular-devkit/build-angular:browser';
		next['angular.json'] = replaceExact(
			files['angular.json'] ?? '',
			before,
			'@angular-devkit/build-angular:browser-esbuild',
			'browser-esbuild',
		);
		spans.push({
			path: 'angular.json',
			before,
			after: '@angular-devkit/build-angular:browser-esbuild',
		});
	}
	if (new Set(spans.map((span) => span.path)).size > 64 || spans.length > 256)
		throw new Error('Angular Contacts migration exceeds bounded adapter budget');
	return {
		from,
		to,
		files: next,
		spans,
		digest: sha256(canonicalize(spans)),
		yukuDiagnostics: 0,
	};
}

export function mutateAngularContactsDeletion(source: string): string {
	return replaceExact(source, ANGULAR_CONTACTS_REDUCER_SEAM, 'state', 'reducer mutation');
}
