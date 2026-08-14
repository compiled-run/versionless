import { describe, expect, it } from 'vitest';
import {
	ANGULAR_16_BROWSER_CELL,
	alignAngularPackageManifest,
	alignedVersionRange,
	buildStampContradictions,
	cellAcceptsBuildStamp,
	ecosystemDispositionOf,
	familyPrefixOf,
	familyPrefixedEcosystemReadings,
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
			{
				dependencies: { 'ngx-clipboard': '^12.2.0', lodash: '4.17.21', 'ng-zorro-antd': '^13.1.0' },
			},
			ANGULAR_16_BROWSER_CELL,
		);
		expect(alignment.manifest['dependencies']).toEqual({
			'ngx-clipboard': '^12.2.0',
			lodash: '4.17.21',
			'ng-zorro-antd': '^16.2.2',
		});
		expect(alignment.changes.map((change) => change.name)).toEqual(['ng-zorro-antd']);
		expect(alignedVersionRange('ngx-clipboard', ANGULAR_16_BROWSER_CELL)).toBeNull();
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

	it('carries the ngx-toastr correction as a stamp reading, not a peer reading', () => {
		const toastr = ANGULAR_16_BROWSER_CELL.ecosystemPackages['ngx-toastr'];
		expect(toastr?.kind).toBe('aligned');
		if (toastr?.kind !== 'aligned') return;
		expect(toastr.range).toBe('^17.0.2');
		expect(toastr.buildStamp?.compiledWith).toBe('16.0.1');
		expect(toastr.excludedByBuildStamp?.map((stamp) => stamp.libraryVersion)).toEqual([
			'19.1.0',
			'19.0.0',
			'18.0.0',
		]);
		/**
		 * The excluded lines are excluded by the stamp and not by the peers: all
		 * four declare the same `>=16.0.0-0`, which is what made the refinement
		 * necessary here, so each excluded stamp has to be one this cell refuses.
		 */
		for (const excluded of toastr.excludedByBuildStamp ?? [])
			expect(cellAcceptsBuildStamp(ANGULAR_16_BROWSER_CELL.angularLine, excluded)).toBe(false);
		expect(toastr.fact).toContain('>=16.0.0-0');
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

/**
 * A family prefix is a naming convention, not a release train.
 *
 * The rule the assertions below hold to is one sentence: a package the cell has
 * *read* is never given a range by its name. Everything else in this block is
 * that sentence applied — to a package whose family kept publishing it, to two
 * packages whose family left them behind, and to the set of overrides as a set,
 * so that a later edit to either table has to keep them agreeing.
 */
describe('the family prefix and the per-package reading that overrides it', () => {
	it('keeps writing the family range for a package its family still publishes', () => {
		expect(alignedVersionRange('@angular-devkit/build-angular', ANGULAR_16_BROWSER_CELL)).toBe(
			'^16.2.0',
		);
		expect(alignedVersionRange('@angular-devkit/core', ANGULAR_16_BROWSER_CELL)).toBe('^16.2.0');
		expect(familyPrefixOf('@angular-devkit/build-optimizer', ANGULAR_16_BROWSER_CELL)).toBe(
			'@angular-devkit/',
		);
		expect(familyPrefixOf('lodash', ANGULAR_16_BROWSER_CELL)).toBeNull();
	});

	it('stands down for a package that left the version train, rather than naming a version nobody published', () => {
		for (const departed of ['@angular-devkit/build-optimizer', '@angular/http']) {
			expect(ecosystemDispositionOf(departed, ANGULAR_16_BROWSER_CELL)?.kind).toBe('no-successor');
			expect(alignedVersionRange(departed, ANGULAR_16_BROWSER_CELL)).toBeNull();
		}
	});

	it('drops a folded-in build package as a declared difference naming what carries it now', () => {
		const alignment = alignAngularPackageManifest(
			{
				devDependencies: {
					'@angular-devkit/build-angular': '0.801.2',
					'@angular-devkit/build-optimizer': '0.801.2',
				},
			},
			ANGULAR_16_BROWSER_CELL,
		);
		expect(alignment.manifest['devDependencies']).toEqual({
			'@angular-devkit/build-angular': '^16.2.0',
		});
		const removal = alignment.changes.find(
			(change) => change.name === '@angular-devkit/build-optimizer',
		);
		expect(removal?.to).toBeNull();
		expect(removal?.reason).toContain('no successor line for angular-16-browser-builder');
		expect(alignment.declaredDifferences).toHaveLength(1);
		expect(alignment.declaredDifferences[0]).toContain(
			'devDependencies.@angular-devkit/build-optimizer was removed',
		);
		expect(alignment.declaredDifferences[0]).toContain('@angular-devkit/build-angular');
		expect(alignment.unhandled).toEqual([]);
	});

	it('lists every override the ecosystem table makes over a family range, and writes each one', () => {
		const overrides = familyPrefixedEcosystemReadings(ANGULAR_16_BROWSER_CELL);
		expect(overrides.map((override) => override.name)).toContain(
			'@angular-devkit/build-optimizer',
		);
		expect(overrides.map((override) => override.name)).toContain('@angular/http');
		for (const override of overrides) {
			expect(override.writes).not.toBe(override.familyRange);
			expect(alignedVersionRange(override.name, ANGULAR_16_BROWSER_CELL)).toBe(override.writes);
			expect(override.name.startsWith(override.prefix)).toBe(true);
		}
	});

	it('counts an entry that agrees with its family range as no override at all', () => {
		const agreeing: AngularTargetCell = Object.freeze({
			...ANGULAR_16_BROWSER_CELL,
			ecosystemPackages: Object.freeze({
				'@angular/agrees': Object.freeze({
					kind: 'aligned',
					range: '^16.2.0',
					fact: 'the same range the family rule would have written, read per package',
				}),
			}),
		});
		expect(familyPrefixedEcosystemReadings(agreeing)).toEqual([]);
	});
});

/**
 * The three community readings the Angular holdout demanded, stated against an
 * arbitrary manifest. Nothing here mentions the application that demanded them:
 * each is a fact about a package, applied to whatever manifest declares it.
 */
describe('the community readings behind a resolvable Angular 16 closure', () => {
	it('drops a package whose newest published line still peers a pre-Ivy Angular', () => {
		const disposition = ecosystemDispositionOf('ng2-slim-loading-bar', ANGULAR_16_BROWSER_CELL);
		expect(disposition?.kind).toBe('no-successor');
		/**
		 * The peer alone would only say the resolver refuses it. The reading that
		 * decides against relaxing the resolver instead is that Angular 16 no longer
		 * runs ngcc, so a ViewEngine library has no consumer here either way.
		 */
		expect(disposition?.fact).toContain('ngcc');
		expect(disposition?.fact).toContain('4.0.0');
		const alignment = alignAngularPackageManifest(
			{ devDependencies: { 'ng2-slim-loading-bar': '4.0.0', '@angular/core': '8.1.2' } },
			ANGULAR_16_BROWSER_CELL,
		);
		expect(alignment.manifest['devDependencies']).toEqual({ '@angular/core': '^16.2.0' });
		expect(alignment.declaredDifferences[0]).toContain(
			'devDependencies.ng2-slim-loading-bar was removed',
		);
	});

	it('moves a package whose maintained line does admit the cell, and says which line and why', () => {
		const alignment = alignAngularPackageManifest(
			{ devDependencies: { 'ngx-toastr': '10.0.4' } },
			ANGULAR_16_BROWSER_CELL,
		);
		expect(alignment.manifest['devDependencies']).toEqual({ 'ngx-toastr': '^17.0.2' });
		const change = alignment.changes.find((entry) => entry.name === 'ngx-toastr');
		expect(change?.from).toBe('10.0.4');
		expect(change?.to).toBe('^17.0.2');
		expect(change?.reason).toContain('aligned to the community layer angular-16-browser-builder');
		expect(alignment.declaredDifferences).toEqual([]);
	});

	it('reaches all three readings from one era-shaped manifest without an era pin surviving', () => {
		const alignment = alignAngularPackageManifest(
			{
				devDependencies: {
					'@angular-devkit/build-angular': '0.801.2',
					'@angular-devkit/build-optimizer': '0.801.2',
					'@angular/core': '8.1.2',
					'ng2-slim-loading-bar': '4.0.0',
					'ngx-toastr': '10.0.4',
					rxjs: '6.5.2',
				},
			},
			ANGULAR_16_BROWSER_CELL,
		);
		expect(alignment.manifest['devDependencies']).toEqual({
			'@angular-devkit/build-angular': '^16.2.0',
			'@angular/core': '^16.2.0',
			'ngx-toastr': '^17.0.2',
			rxjs: '~7.8.0',
		});
		expect(alignment.declaredDifferences).toHaveLength(2);
		expect(alignment.unhandled).toEqual([]);
	});
});
