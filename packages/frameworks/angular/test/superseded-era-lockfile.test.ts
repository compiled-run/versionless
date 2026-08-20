import { describe, expect, it } from 'vitest';
import {
	declaredRangeMajor,
	isNpmLockfilePath,
	lockfileContradictions,
	readNpmLockfileResolutions,
	supersedeEraLockfiles,
} from '../src/superseded-era-lockfile.ts';

const eraLockV1 = JSON.stringify({
	name: 'workspace',
	lockfileVersion: 1,
	dependencies: {
		'@angular/core': { version: '6.1.4' },
		'@angular-devkit/build-angular': { version: '0.7.5' },
		rxjs: { version: '6.2.2' },
		'left-pad': { version: '1.3.0' },
	},
});

const migratedManifest = {
	dependencies: { '@angular/core': '^16.2.0', rxjs: '~7.8.0' },
	devDependencies: { '@angular-devkit/build-angular': '^16.2.0' },
};

describe('superseded era lockfile', () => {
	it('reads the top level of a lockfileVersion 1 document', () => {
		const resolutions = readNpmLockfileResolutions(eraLockV1);
		expect(resolutions?.map((entry) => entry.name)).toEqual([
			'@angular-devkit/build-angular',
			'@angular/core',
			'left-pad',
			'rxjs',
		]);
	});

	it('reads the direct entries of a lockfileVersion 3 document and no nested one', () => {
		const source = JSON.stringify({
			lockfileVersion: 3,
			packages: {
				'': { name: 'workspace' },
				'node_modules/@angular/core': { version: '6.1.4' },
				'node_modules/webpack/node_modules/glob': { version: '7.2.3' },
			},
		});
		expect(readNpmLockfileResolutions(source)).toEqual([
			{ name: '@angular/core', version: '6.1.4' },
		]);
	});

	it('refuses a document that is not an npm lockfile rather than reading nothing from it', () => {
		expect(readNpmLockfileResolutions('{"name":"workspace"}')).toBeNull();
		expect(readNpmLockfileResolutions('not json at all')).toBeNull();
		expect(readNpmLockfileResolutions('{"lockfileVersion":3}')).toEqual([]);
	});

	it('names the disagreements between the lockfile and the migrated manifest', () => {
		const resolutions = readNpmLockfileResolutions(eraLockV1) ?? [];
		expect(lockfileContradictions(resolutions, migratedManifest)).toEqual([
			{ name: '@angular-devkit/build-angular', locked: '0.7.5', declared: '^16.2.0' },
			{ name: '@angular/core', locked: '6.1.4', declared: '^16.2.0' },
			{ name: 'rxjs', locked: '6.2.2', declared: '~7.8.0' },
		]);
	});

	it('removes the era lockfile and states the contradictions as a declared difference', () => {
		const result = supersedeEraLockfiles(
			[{ path: 'package-lock.json', source: eraLockV1 }],
			migratedManifest,
		);
		expect(result.superseded.map((entry) => entry.at)).toEqual(['package-lock.json']);
		expect(result.superseded[0]?.reason).toContain('@angular/core is locked at 6.1.4');
		expect(result.superseded[0]?.reason).toContain('installed lock-free');
		expect(result.unhandled).toEqual([]);
	});

	it("retains a lockfile that still agrees with the manifest, because it is that manifest's own resolution", () => {
		const agreeing = JSON.stringify({
			lockfileVersion: 1,
			dependencies: { '@angular/core': { version: '16.2.12' }, rxjs: { version: '7.8.1' } },
		});
		const result = supersedeEraLockfiles(
			[{ path: 'package-lock.json', source: agreeing }],
			migratedManifest,
		);
		expect(result.superseded).toEqual([]);
		expect(result.unhandled).toEqual([]);
	});

	it('reports rather than removes a lockfile it cannot read', () => {
		const result = supersedeEraLockfiles(
			[
				{ path: 'yarn.lock', source: '# yarn lockfile v1\n' },
				{ path: 'package-lock.json', source: 'not json' },
			],
			migratedManifest,
		);
		expect(result.superseded).toEqual([]);
		expect(result.unhandled.join(' ')).toContain(
			'yarn.lock is a lockfile this migration does not read',
		);
		expect(result.unhandled.join(' ')).toContain('could not be read as an npm lockfile');
	});

	it('removes nothing when the caller supplies no lockfile', () => {
		expect(supersedeEraLockfiles([], migratedManifest).superseded).toEqual([]);
	});

	it('compares at the major and refuses to read a range that names none', () => {
		expect(declaredRangeMajor('^16.2.0')).toBe(16);
		expect(declaredRangeMajor('~0.13.0')).toBe(0);
		expect(declaredRangeMajor('>=18.10.0')).toBe(18);
		expect(declaredRangeMajor('*')).toBeNull();
		expect(declaredRangeMajor('git+https://example.invalid/pkg.git')).toBeNull();
	});

	it('knows an npm lockfile by name at any depth', () => {
		expect(isNpmLockfilePath('package-lock.json')).toBe(true);
		expect(isNpmLockfilePath('src/Web/WebSPA/npm-shrinkwrap.json')).toBe(true);
		expect(isNpmLockfilePath('pnpm-lock.yaml')).toBe(false);
	});
});
