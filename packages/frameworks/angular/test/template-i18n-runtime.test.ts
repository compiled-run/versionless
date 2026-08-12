import { describe, expect, it } from 'vitest';
import { ANGULAR_16_BROWSER_CELL, type AngularTargetCell } from '../src/angular-target-cell.ts';
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
		expect(declaration.unhandled).toHaveLength(1);
		expect(declaration.unhandled[0]).toContain('polyfill nothing in the bundle asks for');
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
