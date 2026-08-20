import { describe, expect, it } from 'vitest';
import {
	ANGULAR_13_BROWSER_CELL,
	ANGULAR_16_BROWSER_CELL,
	type AngularTargetCell,
} from '../src/angular-target-cell.ts';
import {
	LOCALIZE_PACKAGE,
	LOCALIZE_POLYFILL_ENTRY_POINT,
	declareTemplateI18nRuntime,
	isI18nMarkerAttribute,
	readTemplateI18nMarkers,
} from '../src/template-i18n-runtime.ts';

/** The marked shape TinyTranslator's own home template carries. */
const MARKED_TEMPLATE = [
	'<mat-toolbar color="primary">',
	'  <span id="apptitle" i18n="@@apptitle">Tiny Translator</span>',
	'  <button mat-icon-button i18n-matTooltip matTooltip="Show help">',
	'    <mat-icon>help</mat-icon>',
	'  </button>',
	'</mat-toolbar>',
].join('\n');

const UNMARKED_TEMPLATE = ['<div class="page">', '  <h1>Dashboard</h1>', '</div>'].join('\n');

const MANIFEST = `${JSON.stringify(
	{
		name: 'tiny-translator',
		version: '0.12.0',
		dependencies: { '@angular/core': '^16.2.0', rxjs: '~7.8.0' },
		devDependencies: { typescript: '~5.1.3' },
	},
	null,
	2,
)}\n`;

const templatesOf = (source: string, path = 'src/app/home/home.component.html') => [
	{ path, source },
];

describe('readTemplateI18nMarkers', () => {
	it('reads element and attribute markers out of the parsed template', () => {
		const reading = readTemplateI18nMarkers(templatesOf(MARKED_TEMPLATE));
		expect(reading.markers.map((marker) => marker.attribute)).toEqual([
			'i18n',
			'i18n-matTooltip',
		]);
		expect(reading.markers[0]).toEqual({
			template: 'src/app/home/home.component.html',
			line: 2,
			element: 'span',
			attribute: 'i18n',
		});
		expect(reading.markedTemplates).toEqual(['src/app/home/home.component.html']);
		expect(reading.templatesRead).toBe(1);
	});

	it('does not read a marker out of text, a comment or an unrelated attribute name', () => {
		const reading = readTemplateI18nMarkers([
			{
				path: 'src/app/other.component.html',
				source: [
					'<!-- i18n is configured in xliffmerge.json -->',
					'<p data-i18nsupport="lib">the i18n workflow</p>',
				].join('\n'),
			},
		]);
		expect(reading.markers).toEqual([]);
		expect(reading.markedTemplates).toEqual([]);
		expect(reading.templatesRead).toBe(1);
	});

	it('names the marker attributes and nothing that merely starts like one', () => {
		expect(isI18nMarkerAttribute('i18n')).toBe(true);
		expect(isI18nMarkerAttribute('i18n-matTooltip')).toBe(true);
		expect(isI18nMarkerAttribute('i18nsupport')).toBe(false);
		expect(isI18nMarkerAttribute('data-i18n')).toBe(false);
	});
});

describe('declareTemplateI18nRuntime', () => {
	it('declares the package at the cell range and names the published entry point', () => {
		const declaration = declareTemplateI18nRuntime({
			manifest: MANIFEST,
			templates: templatesOf(MARKED_TEMPLATE),
			cell: ANGULAR_16_BROWSER_CELL,
		});
		expect(declaration.declared).toBe(true);
		expect(declaration.change).toEqual({
			field: 'dependencies',
			name: LOCALIZE_PACKAGE,
			from: null,
			to: '^16.2.0',
		});
		expect(declaration.entryPoint).toBe(LOCALIZE_POLYFILL_ENTRY_POINT);
		expect(declaration.unhandled).toEqual([]);
		const manifest = JSON.parse(declaration.manifest) as {
			dependencies: Record<string, string>;
			devDependencies: Record<string, string>;
		};
		expect(manifest.dependencies[LOCALIZE_PACKAGE]).toBe('^16.2.0');
		expect(Object.keys(manifest.dependencies)).toEqual([
			'@angular/core',
			'@angular/localize',
			'rxjs',
		]);
		expect(manifest.devDependencies).toEqual({ typescript: '~5.1.3' });
		expect(declaration.declaredDifferences).toHaveLength(1);
		expect(declaration.declaredDifferences[0]).toContain('$localize');
	});

	it('refuses an application whose templates carry no marker, and declares nothing', () => {
		const declaration = declareTemplateI18nRuntime({
			manifest: MANIFEST,
			templates: templatesOf(UNMARKED_TEMPLATE),
			cell: ANGULAR_16_BROWSER_CELL,
		});
		expect(declaration.declared).toBe(false);
		expect(declaration.manifest).toBe(MANIFEST);
		expect(declaration.change).toBeNull();
		expect(declaration.entryPoint).toBeNull();
		expect(declaration.closure).toBeNull();
		expect(declaration.unhandled).toHaveLength(1);
		expect(declaration.unhandled[0]).toContain('polyfill nothing in the bundle asks for');
		expect(declaration.unhandled[0]).toContain(
			"no reading of this application's emitted bundle was supplied",
		);
	});

	it('admits a zero-marker application on a supplied reading of its emitted bundle', () => {
		const closure = {
			occurrences: 215,
			readFrom: 'grep -c on the emitted main.*.js of the migrated browser build',
		};
		const declaration = declareTemplateI18nRuntime({
			manifest: MANIFEST,
			templates: templatesOf(UNMARKED_TEMPLATE),
			cell: ANGULAR_16_BROWSER_CELL,
			closure,
		});
		expect(declaration.declared).toBe(true);
		expect(declaration.reading.markers).toEqual([]);
		expect(declaration.closure).toEqual(closure);
		expect(declaration.entryPoint).toBe(LOCALIZE_POLYFILL_ENTRY_POINT);
		expect(declaration.change).toEqual({
			field: 'dependencies',
			name: LOCALIZE_PACKAGE,
			from: null,
			to: '^16.2.0',
		});
		const manifest = JSON.parse(declaration.manifest) as {
			dependencies: Record<string, string>;
		};
		expect(manifest.dependencies[LOCALIZE_PACKAGE]).toBe('^16.2.0');
		expect(declaration.declaredDifferences).toHaveLength(1);
		expect(declaration.declaredDifferences[0]).toContain(
			'215 `$localize` references were counted',
		);
		expect(declaration.declaredDifferences[0]).toContain(closure.readFrom);
		expect(declaration.unhandled).toEqual([]);
	});

	it('states both readings in the declared difference when both are present', () => {
		const declaration = declareTemplateI18nRuntime({
			manifest: MANIFEST,
			templates: templatesOf(MARKED_TEMPLATE),
			cell: ANGULAR_16_BROWSER_CELL,
			closure: { occurrences: 4, readFrom: 'the emitted bundle' },
		});
		expect(declaration.declared).toBe(true);
		expect(declaration.declaredDifferences[0]).toContain('2 i18n markers across');
		expect(declaration.declaredDifferences[0]).toContain(
			'4 `$localize` references were counted',
		);
	});

	it('refuses on a bundle somebody read and found empty, and says the bundle was read', () => {
		const declaration = declareTemplateI18nRuntime({
			manifest: MANIFEST,
			templates: templatesOf(UNMARKED_TEMPLATE),
			cell: ANGULAR_16_BROWSER_CELL,
			closure: { occurrences: 0, readFrom: 'a scan of the emitted browser bundle' },
		});
		expect(declaration.declared).toBe(false);
		expect(declaration.manifest).toBe(MANIFEST);
		expect(declaration.entryPoint).toBeNull();
		expect(declaration.closure).toEqual({
			occurrences: 0,
			readFrom: 'a scan of the emitted browser bundle',
		});
		expect(declaration.unhandled[0]).toContain('a scan of the emitted browser bundle');
		expect(declaration.unhandled[0]).toContain('counted no `$localize` reference');
		expect(declaration.unhandled[0]).toContain('polyfill nothing in the bundle asks for');
	});

	/**
	 * R5. An Ivy-era cell is the condition under which the tags would be emitted,
	 * never the evidence that this application emits any. A capability that read
	 * the cell instead of the bytes would declare the package on every plan on the
	 * line.
	 */
	it('declares nothing on an Angular 13 cell that is handed neither reading', () => {
		const declaration = declareTemplateI18nRuntime({
			manifest: MANIFEST,
			templates: templatesOf(UNMARKED_TEMPLATE),
			cell: ANGULAR_13_BROWSER_CELL,
		});
		expect(declaration.declared).toBe(false);
		expect(declaration.manifest).toBe(MANIFEST);
		expect(declaration.change).toBeNull();
		expect(declaration.entryPoint).toBeNull();
		expect(declaration.unhandled[0]).toContain('polyfill nothing in the bundle asks for');
	});

	it('declares nothing for an application that supplies no templates at all and no reading', () => {
		const declaration = declareTemplateI18nRuntime({
			manifest: MANIFEST,
			templates: [],
			cell: ANGULAR_13_BROWSER_CELL,
			closure: null,
		});
		expect(declaration.declared).toBe(false);
		expect(declaration.reading.templatesRead).toBe(0);
		expect(declaration.entryPoint).toBeNull();
	});

	it('refuses a pre-Ivy cell, whose compiler emits no tagged template to answer', () => {
		const preIvy: AngularTargetCell = { ...ANGULAR_16_BROWSER_CELL, angularLine: '8.2' };
		const declaration = declareTemplateI18nRuntime({
			manifest: MANIFEST,
			templates: templatesOf(MARKED_TEMPLATE),
			cell: preIvy,
		});
		expect(declaration.declared).toBe(false);
		expect(declaration.manifest).toBe(MANIFEST);
		expect(declaration.unhandled[0]).toContain('Angular 8.2');
	});

	it('refuses a cell that carries no range for the framework family', () => {
		const rangeless: AngularTargetCell = {
			...ANGULAR_16_BROWSER_CELL,
			families: Object.freeze({}),
		};
		const declaration = declareTemplateI18nRuntime({
			manifest: MANIFEST,
			templates: templatesOf(MARKED_TEMPLATE),
			cell: rangeless,
		});
		expect(declaration.declared).toBe(false);
		expect(declaration.unhandled[0]).toContain('carries no range for it');
	});

	it('is idempotent when the manifest already declares the cell range', () => {
		const first = declareTemplateI18nRuntime({
			manifest: MANIFEST,
			templates: templatesOf(MARKED_TEMPLATE),
			cell: ANGULAR_16_BROWSER_CELL,
		});
		const second = declareTemplateI18nRuntime({
			manifest: first.manifest,
			templates: templatesOf(MARKED_TEMPLATE),
			cell: ANGULAR_16_BROWSER_CELL,
		});
		expect(second.declared).toBe(true);
		expect(second.change).toBeNull();
		expect(second.manifest).toBe(first.manifest);
		expect(second.entryPoint).toBe(LOCALIZE_POLYFILL_ENTRY_POINT);
	});
});
