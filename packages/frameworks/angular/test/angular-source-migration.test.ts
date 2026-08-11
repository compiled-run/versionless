import { describe, expect, it } from 'vitest';
import { migrateAngularSourceModule } from '../src/angular-source-migration.ts';

describe('Angular source migration', () => {
	it('rewrites zone.js dist specifiers to package entry points', () => {
		const migration = migrateAngularSourceModule(
			'src/polyfills.ts',
			"import 'zone.js/dist/zone';\nimport 'zone.js/dist/zone-testing';\n",
		);
		expect(migration.source).toBe("import 'zone.js';\nimport 'zone.js/testing';\n");
		expect(migration.changed).toBe(true);
		expect(migration.changes).toEqual([
			{ kind: 'module-specifier', line: 1, from: 'zone.js/dist/zone', to: 'zone.js' },
			{
				kind: 'module-specifier',
				line: 2,
				from: 'zone.js/dist/zone-testing',
				to: 'zone.js/testing',
			},
		]);
	});

	it('leaves a commented-out era import exactly where it is', () => {
		const source =
			"// import 'zone.js/dist/zone-error';  // Included with Angular CLI.\nexport const environment = { production: false };\n";
		const migration = migrateAngularSourceModule('src/environments/environment.ts', source);
		expect(migration.source).toBe(source);
		expect(migration.changed).toBe(false);
		expect(migration.changes).toEqual([]);
	});

	it('leaves an era specifier inside an ordinary string untouched', () => {
		const source = "export const label = 'zone.js/dist/zone';\n";
		expect(migrateAngularSourceModule('src/app/label.ts', source).source).toBe(source);
	});

	it('requests the renamed export while preserving the local binding name', () => {
		const migration = migrateAngularSourceModule(
			'src/app/a.spec.ts',
			"import { async, TestBed } from '@angular/core/testing';\nasync(() => TestBed);\n",
		);
		expect(migration.source).toBe(
			"import { waitForAsync as async, TestBed } from '@angular/core/testing';\nasync(() => TestBed);\n",
		);
		expect(migration.changes).toEqual([
			{
				kind: 'renamed-export',
				line: 1,
				from: 'async as async',
				to: 'waitForAsync as async',
			},
		]);
	});

	it('preserves an existing alias on a renamed export', () => {
		const migration = migrateAngularSourceModule(
			'src/app/b.spec.ts',
			"import { async as legacyAsync } from '@angular/core/testing';\n",
		);
		expect(migration.source).toBe(
			"import { waitForAsync as legacyAsync } from '@angular/core/testing';\n",
		);
	});

	it('rewrites a re-export specifier as well as an import', () => {
		const migration = migrateAngularSourceModule(
			'src/app/c.ts',
			"export * from 'zone.js/dist/zone';\n",
		);
		expect(migration.source).toBe("export * from 'zone.js';\n");
	});

	it('fails loudly on a module it cannot parse rather than counting it unchanged', () => {
		expect(() => migrateAngularSourceModule('src/app/broken.ts', 'const = ;')).toThrow(
			'does not parse',
		);
	});
});
