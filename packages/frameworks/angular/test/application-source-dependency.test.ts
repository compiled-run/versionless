import { describe, expect, it } from 'vitest';
import {
	declareApplicationSourceDependencies,
	inlineLoaderPackages,
	readApplicationPackageUses,
	typesCompanionOf,
} from '../src/application-source-dependency.ts';
import { ANGULAR_16_BROWSER_CELL } from '../src/angular-target-cell.ts';

const modules = Object.freeze([
	Object.freeze({
		path: 'frontend/app/app.module.ts',
		source: `import {NgModule} from '@angular/core';
declare const require: (path: string) => string;

export function translationsFactory(locale: string) {
  return require(\`raw-loader!../translate/messages.\${locale}.xlf\`);
}
`,
	}),
	Object.freeze({
		path: 'frontend/app/map.component.ts',
		source: `import {LatLng, Point} from 'leaflet';
import {MapComponent} from '@yaga/leaflet-ng2';
import {Utils} from '../../common/Utils';
import {readFileSync} from 'node:fs';

export const use = [LatLng, Point, MapComponent, Utils, readFileSync];
`,
	}),
]);

/** The migrated manifest: the era wrapper is gone, dropped by the cell's disposition. */
const manifest = Object.freeze({
	name: 'pigallery2',
	dependencies: Object.freeze({ '@angular/core': '^16.2.0' }),
	devDependencies: Object.freeze({ typescript: '~5.1.3' }),
});

describe('application source dependency', () => {
	it('reads every package the application source names, from both shapes', () => {
		const uses = readApplicationPackageUses(modules);
		const names = uses.map((use) => `${use.package}:${use.kind}`);
		expect(names).toContain('raw-loader:inline-loader-chain');
		expect(names).toContain('leaflet:module-import');
		expect(names).toContain('@yaga/leaflet-ng2:module-import');
		expect(names).toContain('@angular/core:module-import');
		expect(names.join(' ')).not.toContain('node:fs');
	});

	it('declares the loader as a build edge and the direct import as a runtime edge', () => {
		const declared = declareApplicationSourceDependencies(
			manifest,
			readApplicationPackageUses(modules),
			ANGULAR_16_BROWSER_CELL,
			['@types/leaflet'],
		);
		const byName = new Map(declared.declarations.map((entry) => [entry.name, entry]));
		expect(byName.get('raw-loader')?.field).toBe('devDependencies');
		expect(byName.get('leaflet')?.field).toBe('dependencies');
		expect(byName.get('@types/leaflet')?.field).toBe('devDependencies');
		expect(byName.get('@angular/core')).toBeUndefined();
		const dependencies = declared.manifest['dependencies'] as Record<string, string>;
		expect(dependencies['leaflet']).toBe('^1.9.4');
	});

	it('reports, and does not declare, a package the cell found no successor for', () => {
		const declared = declareApplicationSourceDependencies(
			manifest,
			readApplicationPackageUses(modules),
			ANGULAR_16_BROWSER_CELL,
			[],
		);
		expect(
			declared.declarations.some((entry) => entry.name === '@yaga/leaflet-ng2'),
		).toBe(false);
		expect(declared.unhandled.join(' ')).toContain('@yaga/leaflet-ng2');
		expect(declared.unhandled.join(' ')).toContain('found no line of it to declare');
	});

	it('declares no type companion the era closure did not carry', () => {
		const declared = declareApplicationSourceDependencies(
			manifest,
			readApplicationPackageUses(modules),
			ANGULAR_16_BROWSER_CELL,
			[],
		);
		expect(declared.declarations.some((entry) => entry.name === '@types/leaflet')).toBe(false);
	});

	it('is idempotent: a manifest it already closed carries no second declaration', () => {
		const uses = readApplicationPackageUses(modules);
		const once = declareApplicationSourceDependencies(
			manifest,
			uses,
			ANGULAR_16_BROWSER_CELL,
			['@types/leaflet'],
		);
		const twice = declareApplicationSourceDependencies(
			once.manifest,
			uses,
			ANGULAR_16_BROWSER_CELL,
			['@types/leaflet'],
		);
		expect(twice.declarations).toHaveLength(0);
		expect(twice.manifest).toEqual(once.manifest);
	});

	it('reads webpack inline loader syntax rather than loader names', () => {
		expect(inlineLoaderPackages('raw-loader!./a.xlf')).toEqual(['raw-loader']);
		expect(inlineLoaderPackages('!!style-loader!css-loader?modules!./a.css')).toEqual([
			'style-loader',
			'css-loader',
		]);
		expect(inlineLoaderPackages('-!file-loader!./a.png')).toEqual(['file-loader']);
		expect(inlineLoaderPackages('./local-loader!./a.txt')).toEqual([]);
		expect(inlineLoaderPackages('./a.xlf')).toEqual([]);
	});

	it('spells a scoped package’s type companion the way DefinitelyTyped publishes it', () => {
		expect(typesCompanionOf('leaflet')).toBe('@types/leaflet');
		expect(typesCompanionOf('@yaga/leaflet-ng2')).toBe('@types/yaga__leaflet-ng2');
	});
});
