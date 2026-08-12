import { describe, expect, it } from 'vitest';
import {
	ANGULAR_16_BROWSER_CELL,
	alignAngularPackageManifest,
	alignedVersionRange,
	buildStampContradictions,
	cellAcceptsBuildStamp,
	ecosystemDispositionOf,
	majorOf,
	type AngularBuildStamp,
	type AngularTargetCell,
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

/**
 * The community-library layer. Every assertion here is about the table as a
 * table — that it applies to whatever manifest it is handed, that it touches
 * only what it names, and that it cannot drop a package without saying why.
 * None of them is about any one application.
 */
describe('Angular target cell ecosystem table', () => {
	it('applies its declared ranges to any manifest, whatever the era ranges were', () => {
		const alignment = alignAngularPackageManifest(
			{
				name: 'some-other-workspace',
				dependencies: {
					'ng-zorro-antd': '^11.0.0',
					'@ngneat/until-destroy': '8.0.3',
					'@datorama/akita': '*',
				},
				devDependencies: { '@storybook/angular': '^6.1.11' },
			},
			ANGULAR_16_BROWSER_CELL,
		);
		expect(alignment.manifest['dependencies']).toEqual({
			'ng-zorro-antd': '^16.2.2',
			'@ngneat/until-destroy': '^10.0.0',
			'@datorama/akita': '^7.1.1',
		});
		expect(alignment.manifest['devDependencies']).toEqual({ '@storybook/angular': '^7.6.24' });
		expect(alignment.changes.find((change) => change.name === 'ng-zorro-antd')?.reason).toContain(
			'aligned to the community layer angular-16-browser-builder declares',
		);
	});

	it('leaves a package the table does not name exactly as the manifest declared it', () => {
		const alignment = alignAngularPackageManifest(
			{ dependencies: { 'ngx-toastr': '^14.0.0', lodash: '4.17.21', 'ng-zorro-antd': '^13.1.0' } },
			ANGULAR_16_BROWSER_CELL,
		);
		expect(alignment.manifest['dependencies']).toEqual({
			'ngx-toastr': '^14.0.0',
			lodash: '4.17.21',
			'ng-zorro-antd': '^16.2.2',
		});
		expect(alignment.changes.map((change) => change.name)).toEqual(['ng-zorro-antd']);
		expect(alignedVersionRange('ngx-toastr', ANGULAR_16_BROWSER_CELL)).toBeNull();
	});

	it('drops a no-successor package and records the disposition that dropped it', () => {
		const alignment = alignAngularPackageManifest(
			{ devDependencies: { tslint: '~6.1.0', eslint: '^8.2.0' } },
			ANGULAR_16_BROWSER_CELL,
		);
		expect(alignment.manifest['devDependencies']).toEqual({ eslint: '^8.2.0' });
		const removal = alignment.changes.find((change) => change.name === 'tslint');
		expect(removal?.to).toBeNull();
		expect(removal?.reason).toContain('no successor line for angular-16-browser-builder');
		expect(alignment.declaredDifferences).toHaveLength(1);
		expect(alignment.declaredDifferences[0]).toContain('devDependencies.tslint was removed');
	});

	it('records no declared difference when nothing the table drops is present', () => {
		const alignment = alignAngularPackageManifest(
			{ dependencies: { rxjs: '~6.6.3' } },
			ANGULAR_16_BROWSER_CELL,
		);
		expect(alignment.declaredDifferences).toEqual([]);
	});

	it('carries a registry reading for every entry, so no version is a guess', () => {
		const unevidenced: string[] = [];
		for (const [name, entry] of Object.entries(ANGULAR_16_BROWSER_CELL.ecosystemPackages)) {
			if (entry.fact.trim().length < 40) unevidenced.push(name);
			if (entry.kind === 'aligned' && !entry.range.includes('.')) unevidenced.push(name);
		}
		expect(unevidenced).toEqual([]);
	});

	it('reads an entry only through the disposition, never as a bare range', () => {
		expect(ecosystemDispositionOf('ng-zorro-antd', ANGULAR_16_BROWSER_CELL)?.kind).toBe('aligned');
		expect(ecosystemDispositionOf('tslint', ANGULAR_16_BROWSER_CELL)?.kind).toBe('no-successor');
		expect(ecosystemDispositionOf('lodash', ANGULAR_16_BROWSER_CELL)).toBeNull();
		expect(alignedVersionRange('tslint', ANGULAR_16_BROWSER_CELL)).toBeNull();
	});
});

describe('the peer-strictness refinement', () => {
	it('accepts a stamp at or below the cell’s major and refuses one above it', () => {
		expect(majorOf('16.2')).toBe(16);
		expect(majorOf('')).toBeNull();
		const thirteen: AngularBuildStamp = Object.freeze({
			libraryVersion: '6.3.12',
			compiledWith: '13.3.12',
			readFrom: 'https://unpkg.com/@ngx-formly/core@6.3.12/fesm2020/ngx-formly-core.mjs',
		});
		const eighteen: AngularBuildStamp = Object.freeze({
			libraryVersion: '7.1.0',
			compiledWith: '18.2.13',
			readFrom: 'https://unpkg.com/@ngx-formly/core@7.1.0/fesm2022/ngx-formly-core.mjs',
		});
		expect(cellAcceptsBuildStamp('16.2', thirteen)).toBe(true);
		expect(cellAcceptsBuildStamp('16.2', eighteen)).toBe(false);
		expect(cellAcceptsBuildStamp('16.2', { ...thirteen, compiledWith: '16.2.12' })).toBe(true);
		expect(cellAcceptsBuildStamp('16.2', { ...thirteen, compiledWith: 'unknown' })).toBe(false);
	});

	it('finds no contradiction between the Angular 16 table’s stamps and its ranges', () => {
		expect(buildStampContradictions(ANGULAR_16_BROWSER_CELL)).toEqual([]);
	});

	it('reports an aligned line the cell’s linker would refuse', () => {
		const broken: AngularTargetCell = Object.freeze({
			...ANGULAR_16_BROWSER_CELL,
			ecosystemPackages: Object.freeze({
				'@example/lib': Object.freeze({
					kind: 'aligned',
					range: '^7.1.0',
					fact: 'peers do not discriminate',
					buildStamp: Object.freeze({
						libraryVersion: '7.1.0',
						compiledWith: '18.2.13',
						readFrom: 'https://unpkg.com/@example/lib@7.1.0/fesm2022/lib.mjs',
					}),
				}),
			}),
		});
		expect(buildStampContradictions(broken)).toEqual([
			'@example/lib: aligned to ^7.1.0, but 7.1.0 is stamped Angular 18.2.13, which Angular 16.2 does not link.',
		]);
	});

	it('carries the @ngx-formly correction as a reading, not an assertion', () => {
		const core = ANGULAR_16_BROWSER_CELL.ecosystemPackages['@ngx-formly/core'];
		const material = ANGULAR_16_BROWSER_CELL.ecosystemPackages['@ngx-formly/material'];
		expect(core?.kind).toBe('aligned');
		expect(material?.kind).toBe('aligned');
		if (core?.kind !== 'aligned' || material?.kind !== 'aligned') return;
		expect(core.range).toBe('^6.3.12');
		expect(material.range).toBe('^6.3.12');
		expect(core.buildStamp?.compiledWith).toBe('13.3.12');
		expect(core.excludedByBuildStamp?.map((stamp) => stamp.libraryVersion)).toEqual([
			'7.1.0',
			'7.0.1',
			'7.0.0',
		]);
	});
});
