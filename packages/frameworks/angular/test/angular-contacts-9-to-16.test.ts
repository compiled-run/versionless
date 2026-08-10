import { describe, expect, test } from 'vitest';
import {
	ANGULAR_CONTACTS_REDUCER_SEAM,
	applyAngularContactsCompatibilityOverlay,
	migrateAngularContactsMajor,
	mutateAngularContactsDeletion,
} from '../src/angular-contacts-9-to-16.ts';

const files = {
	'package.json': JSON.stringify({
		dependencies: {
			'@angular/core': '9.0.0',
			'@angular/pwa': '^0.900.1',
			'@angular/service-worker': '9.0.0',
			'@ngrx/store': '^8.6.0',
			'zone.js': '^0.10.2',
		},
		devDependencies: {
			'@angular/cli': '^9.0.1',
			'@angular-devkit/build-angular': '~0.900.1',
			typescript: '3.7.5',
		},
	}),
	'angular.json': JSON.stringify({
		projects: {
			'angular-contacts': {
				architect: {
					build: {
						builder: '@angular-devkit/build-angular:browser',
						options: { assets: ['src/favicon.ico'] },
						configurations: {
							local: { serviceWorker: false },
							production: {
								serviceWorker: true,
								ngswConfigPath: 'src/ngsw-config.json',
							},
						},
					},
				},
			},
		},
	}),
	'src/main.ts':
		"bootstrap().then(() => {\n  if ('serviceWorker' in navigator && environment.production) {\n    navigator.serviceWorker.register('/ngsw-worker.js');\n  }\n}).catch(err => console.log(err));",
	'src/app/app.module.ts':
		"import {ServiceWorkerModule } from '@angular/service-worker';\nconst imports = [A,\n    ServiceWorkerModule.register('ngsw-worker.js', { enabled: environment.production })];",
	'src/index.html':
		'<head>\n  <link rel="icon" type="image/x-icon" href="favicon.ico">\n  <link rel="manifest" href="manifest.json">\n  <meta name="theme-color" content="#1976d2">\n\n  <script src="https://code.jquery.com/jquery-3.3.1.slim.min.js" integrity="sha384-q8i/X+965DzO0rT7abK41JStQIAqVgRVzpbzo5smXKp4YfRvH+8abtTE1Pi6jizo" crossorigin="anonymous"></script>\n  <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/js/bootstrap.min.js" integrity="sha384-JjSmVgyd0p3pXB1rRibZUAYoIIy6OrQ6VrjIEaFf/nJGzIxFDsf4x0xIM+B07jRM" crossorigin="anonymous"></script>\n</head>',
	'src/environments/environment.ts':
		"baseUrl: 'http://localhost:3000'; url: 'http://localhost:3000'",
	'src/environments/environment.local.ts':
		"baseUrl: 'http://localhost:3000'; url: 'http://localhost:3000'",
	'src/environments/environment.dev.ts':
		"baseUrl: 'http://dev.contacts.com:3000'; url: 'http://dev.contacts.com:3000'",
	'src/environments/environment.prod.ts':
		"baseUrl: 'https://contacts-api.vatsaev.com'; url: 'https://contacts-api.vatsaev.com'",
	'src/app/views/contacts/services/contacts.service.ts': 'export class ContactsService {}',
	'src/app/views/contacts/services/contacts-socket.service.ts':
		'export class ContactsSocketService {}',
	'src/app/views/contacts/store/contacts-reducer.ts': `const next = ${ANGULAR_CONTACTS_REDUCER_SEAM};`,
};

describe('Angular Contacts 9 to 16 adapter', () => {
	test('creates the narrow local SW/PWA/remote-free compatibility overlay', () => {
		const result = applyAngularContactsCompatibilityOverlay(files);
		expect(result).toMatchObject({ from: 9, to: 9, yukuDiagnostics: 0 });
		const joined = Object.values(result.files).join('\n');
		for (const forbidden of [
			'ServiceWorkerModule',
			'ngsw-worker',
			'https://',
			'manifest.json',
			'favicon.ico',
			'localhost:3000',
		])
			expect(joined).not.toContain(forbidden);
		expect(joined).toContain('127.0.0.1:3000');
	});

	test('freezes every sequential major and ends at browser-esbuild', () => {
		let current = applyAngularContactsCompatibilityOverlay(files).files;
		for (let major = 10 as const; major <= 16; major += 1)
			current = migrateAngularContactsMajor(current, (major - 1) as 9, major as 10).files;
		const manifest = JSON.parse(current['package.json']!);
		expect(manifest.dependencies['@angular/core']).toBe('16.2.12');
		expect(manifest.devDependencies['@angular/cli']).toBe('16.2.16');
		expect(manifest.devDependencies.typescript).toBe('5.1.6');
		expect(current['angular.json']).toContain('browser-esbuild');
	});

	test('has an exact reversible reducer mutation seam', () => {
		const source = files['src/app/views/contacts/store/contacts-reducer.ts'];
		const mutated = mutateAngularContactsDeletion(source);
		expect(mutated.replace('state', ANGULAR_CONTACTS_REDUCER_SEAM)).toBe(source);
		expect(() => mutateAngularContactsDeletion('no seam')).toThrow('absent or ambiguous');
	});
});
