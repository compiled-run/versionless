import { describe, expect, it } from 'vitest';
import {
	ANGULAR_16_BROWSER_CELL,
	alignAngularPackageManifest,
	alignedVersionRange,
} from '../src/angular-target-cell.ts';

describe('Angular target cell', () => {
	it('resolves a range by exact name before family prefix', () => {
		expect(alignedVersionRange('typescript', ANGULAR_16_BROWSER_CELL)).toBe('~5.1.3');
		expect(alignedVersionRange('@angular/core', ANGULAR_16_BROWSER_CELL)).toBe('^16.2.0');
		expect(alignedVersionRange('@ngrx/effects', ANGULAR_16_BROWSER_CELL)).toBe('^16.3.0');
		expect(alignedVersionRange('pako', ANGULAR_16_BROWSER_CELL)).toBeNull();
	});

	it('aligns the ecosystem, drops released packages and leaves everything else alone', () => {
		const alignment = alignAngularPackageManifest(
			{
				name: 'any-workspace',
				dependencies: { '@angular/core': '~10.1.5', pako: '^1.0.11', rxjs: '~6.6.3' },
				devDependencies: {
					tslint: '^6.1.3',
					karma: '~5.0.0',
					'karma-junit-reporter': '^2.0.1',
				},
			},
			ANGULAR_16_BROWSER_CELL,
			['tslint'],
		);
		expect(alignment.manifest['dependencies']).toEqual({
			'@angular/core': '^16.2.0',
			pako: '^1.0.11',
			rxjs: '~7.8.0',
		});
		expect(alignment.manifest['devDependencies']).toEqual({
			karma: '~6.4.0',
			'karma-junit-reporter': '^2.0.1',
		});
		expect(alignment.changes.filter((change) => change.to === null)).toEqual([
			{
				field: 'devDependencies',
				name: 'tslint',
				from: '^6.1.3',
				to: null,
				reason: 'released by a builder target the workspace migration removed',
			},
		]);
		expect(alignment.unhandled).toEqual([
			'devDependencies.karma-junit-reporter is coupled to the Angular test cell but is not ' +
				'part of the toolchain angular-16-browser-builder generates, so it was left at its ' +
				'era range',
		]);
		expect(
			alignment.changes.find((change) => change.name === 'karma')?.reason,
		).toBe('aligned to the test toolchain angular-16-browser-builder generates');
	});

	it('aligns the test toolchain the line generates, because an era one cannot resolve', () => {
		expect(alignedVersionRange('jasmine-core', ANGULAR_16_BROWSER_CELL)).toBe('~4.6.0');
		expect(alignedVersionRange('karma-jasmine-html-reporter', ANGULAR_16_BROWSER_CELL)).toBe(
			'~2.1.0',
		);
		expect(alignedVersionRange('karma-coverage-istanbul-reporter', ANGULAR_16_BROWSER_CELL)).toBe(
			null,
		);
	});

	it('leaves a manifest already on the cell byte-equal and reports no change', () => {
		const manifest = { dependencies: { '@angular/core': '^16.2.0' } };
		const alignment = alignAngularPackageManifest(manifest, ANGULAR_16_BROWSER_CELL);
		expect(alignment.changes).toEqual([]);
		expect(alignment.manifest['dependencies']).toEqual(manifest.dependencies);
	});

	it('refuses a manifest whose dependency field is not an object of strings', () => {
		expect(() =>
			alignAngularPackageManifest(
				{ dependencies: { '@angular/core': 16 } },
				ANGULAR_16_BROWSER_CELL,
			),
		).toThrow('is not a string');
	});
});
