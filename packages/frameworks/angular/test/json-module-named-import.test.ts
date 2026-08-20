import { describe, expect, it } from 'vitest';
import {
	defaultLocalFor,
	isJsonSpecifier,
	readNamedBindings,
	rewriteJsonNamedImports,
	type JsonModuleReading,
} from '../src/json-module-named-import.ts';

const reading: JsonModuleReading = (specifier: string) =>
	specifier.endsWith('package.json')
		? Object.freeze({ name: 'superProductivity', version: '2.13.15' })
		: null;

describe('json module named import', () => {
	it('reads plain and aliased bindings, and refuses anything else', () => {
		expect(readNamedBindings('version')).toEqual([{ exported: 'version', local: 'version' }]);
		expect(readNamedBindings(' version as appVersion ')).toEqual([
			{ exported: 'version', local: 'appVersion' },
		]);
		expect(readNamedBindings('version, name')).toHaveLength(2);
		expect(readNamedBindings('')).toBeNull();
		expect(readNamedBindings('version as as as')).toBeNull();
	});

	it('names the default local off the module and avoids what the file already writes', () => {
		expect(isJsonSpecifier('../../package.json')).toBe(true);
		expect(isJsonSpecifier('../../package')).toBe(false);
		expect(defaultLocalFor('../../package.json', new Set())).toBe('packageJson');
		expect(defaultLocalFor('../../package.json', new Set(['packageJson']))).toBe(
			'packageJson2',
		);
		expect(defaultLocalFor('./i18n/en-GB.json', new Set())).toBe('enGBJson');
	});

	it('rewrites the named import into a default import and a destructuring', () => {
		const migration = rewriteJsonNamedImports(
			'src/environments/environment.ts',
			[
				"import {version} from '../../package.json';",
				'',
				'export const environment = {version};',
				'',
			].join('\n'),
			reading,
		);
		expect(migration.changed).toBe(true);
		expect(migration.source).toBe(
			[
				"import packageJson from '../../package.json';",
				'const { version } = packageJson;',
				'',
				'export const environment = {version};',
				'',
			].join('\n'),
		);
		expect(migration.changes[0]?.defaultLocal).toBe('packageJson');
		expect(migration.unhandled).toEqual([]);
	});

	it('keeps an alias by destructuring onto the same local', () => {
		const migration = rewriteJsonNamedImports(
			'src/environments/environment.ts',
			'import { version as appVersion } from "../../package.json";\n',
			reading,
		);
		expect(migration.source).toBe(
			'import packageJson from "../../package.json";\nconst { version: appVersion } = packageJson;\n',
		);
	});

	it('leaves an import of a non-JSON module alone', () => {
		const source = "import {Component} from '@angular/core';\n";
		const migration = rewriteJsonNamedImports('src/app/a.component.ts', source, reading);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled).toEqual([]);
	});

	it('refuses a key the resolved JSON does not declare', () => {
		const migration = rewriteJsonNamedImports(
			'src/environments/environment.ts',
			"import {buildStamp} from '../../package.json';\n",
			reading,
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled[0]).toContain("declares no top-level 'buildStamp'");
	});

	it('refuses when the reading cannot resolve or parse the module', () => {
		const migration = rewriteJsonNamedImports(
			'src/environments/environment.ts',
			"import {version} from '../../missing.json';\n",
			reading,
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled[0]).toContain('did not resolve to a JSON module');
	});

	it('refuses a type-only clause, which the module graph never sees', () => {
		const migration = rewriteJsonNamedImports(
			'src/environments/environment.ts',
			"import {type version} from '../../package.json';\n",
			reading,
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled[0]).toContain('type-only binding');
	});
});
