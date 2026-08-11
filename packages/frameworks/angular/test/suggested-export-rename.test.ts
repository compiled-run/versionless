import { describe, expect, it } from 'vitest';
import {
	applySuggestedExportRenames,
	isPackageRootSpecifier,
	packageOfSpecifier,
	readSuggestedExportRenames,
	type ExportSurfaceReading,
} from '../src/suggested-export-rename.ts';

const charts: ExportSurfaceReading = Object.freeze({
	name: 'ng2-charts',
	version: '5.0.4',
	exports: Object.freeze(['NgChartsModule', 'BaseChartDirective', 'ThemeService']),
	complete: true,
});

const chartjs: ExportSurfaceReading = Object.freeze({
	name: 'chart.js',
	version: '4.5.1',
	exports: Object.freeze(['ChartDataset', 'ChartOptions', 'ChartType']),
	complete: true,
});

describe('packageOfSpecifier', () => {
	it('reads the package a bare specifier names', () => {
		expect(packageOfSpecifier('ng2-charts')).toBe('ng2-charts');
		expect(packageOfSpecifier('chart.js')).toBe('chart.js');
	});

	it('keeps both segments of a scoped package', () => {
		expect(packageOfSpecifier('@angular/material')).toBe('@angular/material');
		expect(packageOfSpecifier('@angular/material/dialog')).toBe('@angular/material');
	});

	it('separates a package root from a subpath beneath it', () => {
		expect(isPackageRootSpecifier('@angular/material')).toBe(true);
		expect(isPackageRootSpecifier('@angular/material/dialog')).toBe(false);
		expect(isPackageRootSpecifier('rxjs/operators')).toBe(false);
		expect(isPackageRootSpecifier('./local')).toBe(false);
	});
});

describe('applySuggestedExportRenames', () => {
	it('renames the exported name and every reference to its binding', () => {
		const source = [
			"import {NgModule} from '@angular/core';",
			"import {ChartsModule} from 'ng2-charts';",
			'',
			'@NgModule({imports: [ChartsModule], exports: [ChartsModule]})',
			'export class MetricModule {}',
			'',
		].join('\n');
		const result = applySuggestedExportRenames(
			'metric.module.ts',
			source,
			[{ line: 2, column: 9, imported: 'ChartsModule', suggested: 'NgChartsModule' }],
			[charts],
		);
		expect(result.changed).toBe(true);
		expect(result.unhandled).toEqual([]);
		expect(result.source).toContain("import {NgChartsModule} from 'ng2-charts';");
		expect(result.source).toContain('imports: [NgChartsModule], exports: [NgChartsModule]');
		expect(result.source).not.toContain('ChartsModule,');
		expect(result.changes).toEqual([
			{
				kind: 'suggested-export-rename',
				line: 2,
				specifier: 'ng2-charts',
				from: 'ChartsModule',
				to: 'NgChartsModule',
				references: 2,
			},
		]);
	});

	it('renames a type-position binding beside its import', () => {
		const source = [
			"import {ChartDataSets} from 'chart.js';",
			'',
			'export interface LineChartData {',
			'  datasets: ChartDataSets[];',
			'}',
			'',
		].join('\n');
		const result = applySuggestedExportRenames(
			'metric.model.ts',
			source,
			[{ line: 1, column: 9, imported: 'ChartDataSets', suggested: 'ChartDataset' }],
			[chartjs],
		);
		expect(result.changed).toBe(true);
		expect(result.source).toContain("import {ChartDataset} from 'chart.js';");
		expect(result.source).toContain('datasets: ChartDataset[];');
	});

	it('replaces only the exported name when the import is aliased', () => {
		const source = [
			"import {ChartsModule as Charts} from 'ng2-charts';",
			'',
			'export const used = Charts;',
			'',
		].join('\n');
		const result = applySuggestedExportRenames(
			'aliased.ts',
			source,
			[{ line: 1, column: 9, imported: 'ChartsModule', suggested: 'NgChartsModule' }],
			[charts],
		);
		expect(result.source).toContain("import {NgChartsModule as Charts} from 'ng2-charts';");
		expect(result.source).toContain('export const used = Charts;');
		expect(result.changes[0]?.references).toBe(0);
	});

	it('refuses a suggestion the installed surface does not publish', () => {
		const source = "import {ChartsModule} from 'ng2-charts';\nexport const a = ChartsModule;\n";
		const result = applySuggestedExportRenames(
			'refused.ts',
			source,
			[{ line: 1, column: 9, imported: 'ChartsModule', suggested: 'ChartsModuleV5' }],
			[charts],
		);
		expect(result.changed).toBe(false);
		expect(result.unhandled).toEqual([
			"refused.ts line 1: the compiler suggested ChartsModuleV5, and 'ng2-charts'@5.0.4 does not export it",
		]);
	});

	it('refuses when the installed surface still exports the name the diagnostic calls missing', () => {
		const source = "import {ThemeService} from 'ng2-charts';\nexport const a = ThemeService;\n";
		const result = applySuggestedExportRenames(
			'stale.ts',
			source,
			[{ line: 1, column: 9, imported: 'ThemeService', suggested: 'NgChartsModule' }],
			[charts],
		);
		expect(result.changed).toBe(false);
		expect(result.unhandled[0]).toContain('exports ThemeService');
	});

	it('refuses against an incomplete surface reading', () => {
		const source = "import {ChartsModule} from 'ng2-charts';\nexport const a = ChartsModule;\n";
		const result = applySuggestedExportRenames(
			'incomplete.ts',
			source,
			[{ line: 1, column: 9, imported: 'ChartsModule', suggested: 'NgChartsModule' }],
			[{ ...charts, complete: false }],
		);
		expect(result.changed).toBe(false);
		expect(result.unhandled[0]).toContain('is incomplete');
	});

	it('refuses a subpath import, whose surface is a different reading', () => {
		const source = "import {ChartsModule} from 'ng2-charts/extra';\nexport const a = ChartsModule;\n";
		const result = applySuggestedExportRenames(
			'subpath.ts',
			source,
			[{ line: 1, column: 9, imported: 'ChartsModule', suggested: 'NgChartsModule' }],
			[charts],
		);
		expect(result.changed).toBe(false);
		expect(result.unhandled[0]).toContain('subpath rather than a package root');
	});

	it('refuses a rename whose successor name the module already declares', () => {
		const source = [
			"import {ChartsModule} from 'ng2-charts';",
			'const NgChartsModule = 1;',
			'export const a = [ChartsModule, NgChartsModule];',
			'',
		].join('\n');
		const result = applySuggestedExportRenames(
			'collision.ts',
			source,
			[{ line: 1, column: 9, imported: 'ChartsModule', suggested: 'NgChartsModule' }],
			[charts],
		);
		expect(result.changed).toBe(false);
		expect(result.unhandled[0]).toContain('already declared in this module');
	});

	it('refuses a position that is not an import specifier', () => {
		const source = "import {ChartsModule} from 'ng2-charts';\nexport const a = ChartsModule;\n";
		const result = applySuggestedExportRenames(
			'misplaced.ts',
			source,
			[{ line: 2, column: 1, imported: 'ChartsModule', suggested: 'NgChartsModule' }],
			[charts],
		);
		expect(result.changed).toBe(false);
		expect(result.unhandled[0]).toContain('is not the exported name of an import specifier');
	});

	it('refuses a package whose surface was not read, and answers the one that was', () => {
		const source = [
			"import {ChartsModule} from 'ng2-charts';",
			"import {ChartDataSets} from 'chart.js';",
			'export const a = [ChartsModule, ChartDataSets];',
			'',
		].join('\n');
		const result = applySuggestedExportRenames(
			'mixed.ts',
			source,
			[
				{ line: 1, column: 9, imported: 'ChartsModule', suggested: 'NgChartsModule' },
				{ line: 2, column: 9, imported: 'ChartDataSets', suggested: 'ChartDataset' },
			],
			[chartjs],
		);
		expect(result.source).toContain("import {ChartsModule} from 'ng2-charts';");
		expect(result.source).toContain("import {ChartDataset} from 'chart.js';");
		expect(result.unhandled).toEqual([
			"mixed.ts line 1: no export surface was read for 'ng2-charts'",
		]);
	});
});

describe('readSuggestedExportRenames', () => {
	it('reads the successor out of a TS2724 line and ignores TS2305', () => {
		const log = [
			'./src/app/app.module.ts:1:1 - warning something else',
			"src/app/features/metric/metric.module.ts:14:9 - error TS2724: '\"ng2-charts\"' has no exported member named 'ChartsModule'. Did you mean 'NgChartsModule'?",
			"src/app/features/metric/metric.model.ts:3:9 - error TS2724: '\"chart.js\"' has no exported member named 'ChartDataSets'. Did you mean 'ChartDataset'?",
			"src/app/features/metric/metric.model.ts:2:9 - error TS2305: Module '\"ng2-charts\"' has no exported member 'Label'.",
		].join('\n');
		const read = readSuggestedExportRenames(log);
		expect([...read.keys()].sort()).toEqual([
			'src/app/features/metric/metric.model.ts',
			'src/app/features/metric/metric.module.ts',
		]);
		expect(read.get('src/app/features/metric/metric.module.ts')).toEqual([
			{ line: 14, column: 9, imported: 'ChartsModule', suggested: 'NgChartsModule' },
		]);
		expect(read.get('src/app/features/metric/metric.model.ts')).toEqual([
			{ line: 3, column: 9, imported: 'ChartDataSets', suggested: 'ChartDataset' },
		]);
	});

	it('reads nothing out of a log with no suggestions', () => {
		expect(readSuggestedExportRenames('nothing here\n').size).toBe(0);
	});
});
