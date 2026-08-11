import { describe, expect, it } from 'vitest';
import {
	readEntryPointSurface,
	resolveBarrelSymbol,
	splitBarrelImports,
	type PackageSurfaceReading,
} from '../src/barrel-entry-point-split.ts';

/**
 * A component library after the split every one of them made: the root entry
 * point still exists and exports one build marker, and each component's symbols
 * live one directory deeper. The declaration text is what the capability reads;
 * nothing here hands it a list of names.
 */
const declaration = (names: readonly string[]): string =>
	names.map((name) => `export declare class ${name} {}\n`).join('');

const library: PackageSurfaceReading = Object.freeze({
	name: '@scope/widgets',
	version: '16.2.14',
	entryPoints: Object.freeze([
		readEntryPointSurface('@scope/widgets', '.', 'export declare const ɵmarker: unknown;\n'),
		readEntryPointSurface(
			'@scope/widgets',
			'./button',
			declaration(['WidgetButton', 'WidgetButtonModule']),
		),
		readEntryPointSurface(
			'@scope/widgets',
			'./dialog',
			`${declaration(['WidgetDialog', 'WidgetDialogModule'])}export declare const WIDGET_DIALOG_DATA: unknown;\n`,
		),
		readEntryPointSurface(
			'@scope/widgets',
			'./dialog/testing',
			declaration(['WidgetDialogHarness']),
		),
		readEntryPointSurface('@scope/widgets', './legacy-dialog', declaration(['WidgetLegacyDialog'])),
	]),
});

describe('readEntryPointSurface', () => {
	it('reads the names a declaration file exports, in every spelling', () => {
		const surface = readEntryPointSurface(
			'@scope/widgets',
			'./menu',
			[
				"import { Thing } from '@scope/other';",
				'export declare class WidgetMenu {}',
				'declare const inner: unknown;',
				'export { inner as WidgetMenuToken };',
				'export type WidgetMenuKind = string;',
				'export declare function widgetMenuFactory(): void;',
			].join('\n'),
		);
		expect(surface.specifier).toBe('@scope/widgets/menu');
		expect(surface.exports).toEqual([
			'WidgetMenu',
			'WidgetMenuKind',
			'WidgetMenuToken',
			'widgetMenuFactory',
		]);
		expect(surface.opaque).toBe(false);
		expect(surface.exports).not.toContain('Thing');
		expect(surface.exports).not.toContain('inner');
	});

	it('marks an entry point that re-exports a whole module as not enumerable', () => {
		const surface = readEntryPointSurface(
			'@scope/widgets',
			'./all',
			"export * from './button';\nexport declare class WidgetAll {}\n",
		);
		expect(surface.opaque).toBe(true);
	});

	it('fails naming the entry point when its declaration does not parse', () => {
		expect(() => readEntryPointSurface('@scope/widgets', './broken', 'export declare class {')).toThrow(
			/@scope\/widgets\/broken/u,
		);
	});
});

describe('resolveBarrelSymbol', () => {
	it('maps a symbol to the shallowest entry point that exports it', () => {
		expect(resolveBarrelSymbol(library, 'WidgetDialog')).toEqual({
			kind: 'entry-point',
			specifier: '@scope/widgets/dialog',
		});
	});

	it('keeps a symbol the root still exports at the root', () => {
		expect(resolveBarrelSymbol(library, 'ɵmarker').kind).toBe('root');
	});

	it('refuses a symbol the installed surface does not carry, by name', () => {
		const resolution = resolveBarrelSymbol(library, 'WidgetChipList');
		expect(resolution.kind).toBe('unmapped');
		expect(resolution.kind === 'unmapped' && resolution.reason).toContain('WidgetChipList');
	});

	it('refuses a symbol two entry points of the same depth both export', () => {
		const ambiguous: PackageSurfaceReading = Object.freeze({
			...library,
			entryPoints: Object.freeze([
				...library.entryPoints,
				readEntryPointSurface('@scope/widgets', './sheet', declaration(['WidgetDialog'])),
			]),
		});
		const resolution = resolveBarrelSymbol(ambiguous, 'WidgetDialog');
		expect(resolution.kind).toBe('ambiguous');
	});

	it('never resolves into an entry point whose surface is not enumerable', () => {
		const opaque: PackageSurfaceReading = Object.freeze({
			name: '@scope/widgets',
			version: '16.2.14',
			entryPoints: Object.freeze([
				readEntryPointSurface('@scope/widgets', './all', "export * from './button';\n"),
			]),
		});
		expect(resolveBarrelSymbol(opaque, 'WidgetButton').kind).toBe('unmapped');
	});
});

describe('splitBarrelImports', () => {
	it('splits one barrel import into the entry points that own its symbols', () => {
		const source = [
			"import {Component} from '@angular/core';",
			'import {',
			'  WidgetButtonModule,',
			'  WidgetDialogModule,',
			'  WIDGET_DIALOG_DATA,',
			"} from '@scope/widgets';",
			'',
			'export class Thing {}',
		].join('\n');
		const migration = splitBarrelImports('src/app/thing.ts', source, library);
		expect(migration.changed).toBe(true);
		expect(migration.source).toContain(
			"import {WidgetButtonModule} from '@scope/widgets/button';",
		);
		expect(migration.source).toContain(
			"import {WidgetDialogModule, WIDGET_DIALOG_DATA} from '@scope/widgets/dialog';",
		);
		expect(migration.source).not.toContain("from '@scope/widgets';");
		expect(migration.source).toContain("import {Component} from '@angular/core';");
		expect(migration.changes[0]?.symbols).toEqual([
			'WIDGET_DIALOG_DATA',
			'WidgetButtonModule',
			'WidgetDialogModule',
		]);
	});

	it('keeps an alias exactly as the module wrote it', () => {
		const migration = splitBarrelImports(
			'src/app/thing.ts',
			"import {WidgetDialog as Dialog} from '@scope/widgets';",
			library,
		);
		expect(migration.source).toBe(
			"import {WidgetDialog as Dialog} from '@scope/widgets/dialog';",
		);
	});

	it('leaves a declaration whose every symbol is unmapped exactly as it is', () => {
		const source = "import {WidgetChipList} from '@scope/widgets';";
		const migration = splitBarrelImports('src/app/thing.ts', source, library);
		expect(migration.changed).toBe(false);
		expect(migration.source).toBe(source);
		expect(migration.unhandled.join(' ')).toContain('WidgetChipList');
	});

	it('refuses the whole declaration when one of its symbols does not map', () => {
		const source = "import {WidgetButton, WidgetChipList} from '@scope/widgets';";
		const migration = splitBarrelImports('src/app/thing.ts', source, library);
		expect(migration.changed).toBe(false);
		expect(migration.source).toBe(source);
		expect(migration.unhandled.join(' ')).toContain('would delete the one that does not');
	});

	it('refuses a namespace import of the barrel', () => {
		const source = "import * as widgets from '@scope/widgets';";
		const migration = splitBarrelImports('src/app/thing.ts', source, library);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('namespace binding');
	});

	it('leaves a module that never imports the barrel byte-identical', () => {
		const source = "import {Component} from '@angular/core';\n";
		expect(splitBarrelImports('src/app/thing.ts', source, library).source).toBe(source);
	});
});
