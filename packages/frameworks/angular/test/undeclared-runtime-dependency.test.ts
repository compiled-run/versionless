import { describe, expect, it } from 'vitest';
import { ANGULAR_16_BROWSER_CELL } from '../src/angular-target-cell.ts';
import {
	declareUndeclaredRuntimeDependencies,
	packageNameOfSpecifier,
	readInstalledPackage,
	undeclaredRuntimeDependencies,
	type InstalledPackage,
} from '../src/undeclared-runtime-dependency.ts';

/**
 * The shape a peer hole has in an installed closure: a published package whose
 * shipped bundles import a module its own manifest declares in neither
 * `dependencies` nor `peerDependencies`. The bundle bodies here are cut down to
 * the import surface, which is the only part of them the reading looks at.
 */
const holedManifest = JSON.stringify({
	name: 'themed-widgets',
	version: '16.2.2',
	dependencies: { '@angular/cdk': '^16.0.0', tslib: '^2.3.0', rxjs: '^7.8.0' },
	peerDependencies: { '@angular/core': '^16.0.0' },
});

const colorBundle = `import { rgbToHsv, rgbToHex } from '@ctrl/tinycolor';
import { Injectable } from '@angular/core';
export { rgbToHsv, rgbToHex, Injectable };
`;

const configBundle = `import { TinyColor } from '@ctrl/tinycolor';
import { of } from 'rxjs';
export * from '@ctrl/tinycolor/dist/interfaces';
export class C { constructor() { void TinyColor; void of; } }
`;

const closure = (): readonly InstalledPackage[] => [
	readInstalledPackage(holedManifest, [
		{ path: 'node_modules/themed-widgets/fesm2022/color.mjs', source: colorBundle },
		{ path: 'node_modules/themed-widgets/fesm2022/config.mjs', source: configBundle },
	]),
	readInstalledPackage(JSON.stringify({ name: 'rxjs', version: '7.8.1' }), []),
];

describe('undeclared runtime dependency detection', () => {
	it('reads the hole out of the closure’s own declarations and shipped imports', () => {
		const holes = undeclaredRuntimeDependencies(closure());
		expect(holes).toEqual([
			{
				importer: 'themed-widgets',
				importerVersion: '16.2.2',
				dependency: '@ctrl/tinycolor',
				specifiers: ['@ctrl/tinycolor', '@ctrl/tinycolor/dist/interfaces'],
				files: [
					'node_modules/themed-widgets/fesm2022/color.mjs',
					'node_modules/themed-widgets/fesm2022/config.mjs',
				],
				satisfiedByClosure: false,
			},
		]);
	});

	it('does not report a package the importer declares, in either runtime field', () => {
		const declaredEverywhere = readInstalledPackage(
			JSON.stringify({
				name: 'themed-widgets',
				version: '16.2.2',
				dependencies: { '@ctrl/tinycolor': '^3.6.0' },
				peerDependencies: { '@angular/core': '^16.0.0' },
			}),
			[{ path: 'fesm2022/color.mjs', source: colorBundle }],
		);
		const asPeer = readInstalledPackage(
			JSON.stringify({
				name: 'themed-widgets',
				version: '16.2.2',
				peerDependencies: { '@ctrl/tinycolor': '^3.6.0', '@angular/core': '^16.0.0' },
			}),
			[{ path: 'fesm2022/color.mjs', source: colorBundle }],
		);
		expect(undeclaredRuntimeDependencies([declaredEverywhere])).toEqual([]);
		expect(undeclaredRuntimeDependencies([asPeer])).toEqual([]);
	});

	it('reports a hole another installed package happens to satisfy, and says so', () => {
		const holes = undeclaredRuntimeDependencies([
			...closure(),
			readInstalledPackage(JSON.stringify({ name: '@ctrl/tinycolor', version: '3.6.1' }), []),
		]);
		expect(holes.map((hole) => hole.satisfiedByClosure)).toEqual([true]);
	});

	it('treats builtins, self-imports, relative paths and protocols as no hole at all', () => {
		const selfImporting = readInstalledPackage(
			JSON.stringify({ name: 'themed-widgets', version: '1.0.0' }),
			[
				{
					path: 'index.mjs',
					source: `import 'node:fs';
import { readFile } from 'fs';
import './local.mjs';
import 'themed-widgets/other';
import 'data:text/javascript,';
import '#internal';
`,
				},
			],
		);
		expect(undeclaredRuntimeDependencies([selfImporting])).toEqual([]);
	});

	it('names the package a bare specifier reaches for, and nothing else', () => {
		expect(packageNameOfSpecifier('@ctrl/tinycolor/dist/x.js')).toBe('@ctrl/tinycolor');
		expect(packageNameOfSpecifier('rxjs/operators')).toBe('rxjs');
		expect(packageNameOfSpecifier('./local')).toBeNull();
		expect(packageNameOfSpecifier('node:path')).toBeNull();
		expect(packageNameOfSpecifier('path')).toBeNull();
		expect(packageNameOfSpecifier('@scope')).toBeNull();
	});

	it('fails naming a bundle that does not parse rather than counting it importless', () => {
		expect(() =>
			readInstalledPackage(JSON.stringify({ name: 'x', version: '1.0.0' }), [
				{ path: 'fesm2022/broken.mjs', source: 'import { from ;' },
			]),
		).toThrow('fesm2022/broken.mjs does not parse');
	});
});

const applicationManifest = Object.freeze({
	name: 'app',
	dependencies: { '@angular/core': '^16.2.0', rxjs: '~7.8.0' },
	devDependencies: { typescript: '~5.1.3' },
});

describe('closing undeclared runtime dependencies in the application manifest', () => {
	it('declares the hole at the version the cell read, with the reading recorded', () => {
		const holes = undeclaredRuntimeDependencies(closure());
		const declared = declareUndeclaredRuntimeDependencies(
			applicationManifest,
			holes,
			ANGULAR_16_BROWSER_CELL,
		);
		expect(declared.declarations).toHaveLength(1);
		const [declaration] = declared.declarations;
		expect(declaration?.field).toBe('dependencies');
		expect(declaration?.name).toBe('@ctrl/tinycolor');
		expect(declaration?.range).toBe('^4.2.0');
		expect(declaration?.reason).toContain(
			'themed-widgets@16.2.2 imports it as @ctrl/tinycolor',
		);
		expect(declaration?.reason).toContain('engines.node ">=14"');
		expect(declaration?.reason).toContain('registry.npmjs.org');
		expect(declared.manifest['dependencies']).toEqual({
			'@angular/core': '^16.2.0',
			'@ctrl/tinycolor': '^4.2.0',
			rxjs: '~7.8.0',
		});
		expect(declared.declaredDifferences).toHaveLength(1);
		expect(declared.declaredDifferences[0]).toContain('dependencies.@ctrl/tinycolor was added');
		expect(declared.unhandled).toEqual([]);
	});

	it('leaves a hole the application already declares exactly as the application wrote it', () => {
		const holes = undeclaredRuntimeDependencies(closure());
		const declared = declareUndeclaredRuntimeDependencies(
			{ ...applicationManifest, dependencies: { '@ctrl/tinycolor': '^3.6.1' } },
			holes,
			ANGULAR_16_BROWSER_CELL,
		);
		expect(declared.declarations).toEqual([]);
		expect(declared.declaredDifferences).toEqual([]);
		expect(declared.manifest['dependencies']).toEqual({ '@ctrl/tinycolor': '^3.6.1' });
	});

	it('refuses to invent a version for a hole the cell has read no line for', () => {
		const unread = readInstalledPackage(
			JSON.stringify({ name: 'themed-widgets', version: '16.2.2' }),
			[{ path: 'fesm2022/x.mjs', source: "import 'unread-by-any-cell';\n" }],
		);
		const declared = declareUndeclaredRuntimeDependencies(
			applicationManifest,
			undeclaredRuntimeDependencies([unread]),
			ANGULAR_16_BROWSER_CELL,
		);
		expect(declared.declarations).toEqual([]);
		expect(declared.manifest).toBe(applicationManifest);
		expect(declared.unhandled).toEqual([
			expect.stringContaining('has read no line for it') as unknown as string,
		]);
	});

	it('refuses a hole the cell read and found no successor for', () => {
		const dropped = readInstalledPackage(
			JSON.stringify({ name: 'themed-widgets', version: '16.2.2' }),
			[{ path: 'fesm2022/x.mjs', source: "import '@sentry/tracing';\n" }],
		);
		const declared = declareUndeclaredRuntimeDependencies(
			applicationManifest,
			undeclaredRuntimeDependencies([dropped]),
			ANGULAR_16_BROWSER_CELL,
		);
		expect(declared.declarations).toEqual([]);
		expect(declared.unhandled).toEqual([
			expect.stringContaining('found no line of it to declare') as unknown as string,
		]);
	});

	it('changes nothing when the closure carries no hole', () => {
		const declared = declareUndeclaredRuntimeDependencies(
			applicationManifest,
			[],
			ANGULAR_16_BROWSER_CELL,
		);
		expect(declared.manifest).toBe(applicationManifest);
		expect(declared.declarations).toEqual([]);
		expect(declared.unhandled).toEqual([]);
	});
});
