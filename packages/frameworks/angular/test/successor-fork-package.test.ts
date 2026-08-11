import { describe, expect, it } from 'vitest';
import {
	alignAngularPackageManifest,
	repositoryIdentity,
	successorForkRenames,
	verifyForkLineage,
	type AngularTargetCell,
	type SuccessorForkPackage,
} from '../src/angular-target-cell.ts';
import {
	migrateSuccessorForkImports,
	type SuccessorSurfaceReading,
} from '../src/successor-fork-package.ts';

/** A fork pair invented for this test: two package names, one source tree. */
const fork: SuccessorForkPackage = Object.freeze({
	kind: 'successor-fork',
	successor: '@second/widget',
	range: '^4.0.0',
	fact: 'any-widget stops at 1.0.0; @second/widget 4.0.0 is the newest line whose declared peers this cell satisfies.',
	lineage: Object.freeze({
		eraRepository: 'git+https://forge.example/First/widget.git',
		successorRepository: 'https://forge.example/second/widget',
		forkedFrom: 'https://forge.example/first/widget',
		readFrom: 'https://api.forge.example/repos/second/widget',
		fact: 'The forge reports second/widget as a fork of first/widget.',
	}),
});

const cellWith = (dispositions: Readonly<Record<string, SuccessorForkPackage>>): AngularTargetCell =>
	Object.freeze({
		id: 'test-cell',
		angularLine: '16.2',
		builder: '@angular-devkit/build-angular:browser',
		nodeLine: '16.20.2',
		typescriptRange: '~5.1.3',
		packages: Object.freeze({}),
		families: Object.freeze({}),
		testPackages: Object.freeze({}),
		ecosystemPackages: Object.freeze({ ...dispositions }),
		rationale: Object.freeze([]),
		nonclaims: Object.freeze([]),
	});

const surface = (
	exports: readonly string[],
	overrides: Partial<SuccessorSurfaceReading> = {},
): SuccessorSurfaceReading =>
	Object.freeze({
		name: '@second/widget',
		version: '4.0.1',
		rootExports: Object.freeze([...exports]),
		complete: true,
		...overrides,
	});

const importing = (names: string): string =>
	`import {${names}} from 'any-widget';\n\nexport class Uses {}\n`;

describe('successor fork lineage', () => {
	it('identifies one repository written three ways as one repository', () => {
		expect(repositoryIdentity('git+https://github.com/Owner/Name.git')).toBe(
			'github.com/owner/name',
		);
		expect(repositoryIdentity('https://github.com/owner/name')).toBe('github.com/owner/name');
		expect(repositoryIdentity('git@github.com:owner/name.git')).toBe('github.com/owner/name');
	});

	it('verifies a fork whose forge parent is the repository the era package declares', () => {
		expect(verifyForkLineage('any-widget', fork)).toEqual({ verified: true });
		expect(successorForkRenames(cellWith({ 'any-widget': fork }))).toEqual({
			'any-widget': '@second/widget',
		});
	});

	it('refuses a successor the forge does not report as a fork at all', () => {
		const unforked: SuccessorForkPackage = {
			...fork,
			lineage: { ...fork.lineage, forkedFrom: null },
		};
		const verdict = verifyForkLineage('any-widget', unforked);
		expect(verdict.verified).toBe(false);
		expect(verdict.verified === false && verdict.reason).toContain('rather than a reading');
		expect(successorForkRenames(cellWith({ 'any-widget': unforked }))).toEqual({});
	});

	it('refuses a fork of some other repository than the one the era package declares', () => {
		const elsewhere: SuccessorForkPackage = {
			...fork,
			lineage: { ...fork.lineage, forkedFrom: 'https://forge.example/third/widget' },
		};
		const verdict = verifyForkLineage('any-widget', elsewhere);
		expect(verdict.verified).toBe(false);
		expect(verdict.verified === false && verdict.reason).toContain('a different source tree');
	});

	it('refuses a fork relation read from a repository other than the successor’s own', () => {
		const borrowed: SuccessorForkPackage = {
			...fork,
			lineage: { ...fork.lineage, readFrom: 'https://api.forge.example/repos/fourth/widget' },
		};
		const verdict = verifyForkLineage('any-widget', borrowed);
		expect(verdict.verified).toBe(false);
		expect(verdict.verified === false && verdict.reason).toContain(
			"which is not forge.example/second/widget's own repository",
		);
	});
});

describe('successor fork manifest alignment', () => {
	const manifest = Object.freeze({
		dependencies: Object.freeze({ 'any-widget': '^1.0.0', other: '^2.0.0' }),
	});

	it('removes the era package name and writes the successor at the range the cell read', () => {
		const aligned = alignAngularPackageManifest(manifest, cellWith({ 'any-widget': fork }));
		const dependencies = aligned.manifest['dependencies'] as Record<string, string>;
		expect(dependencies['any-widget']).toBeUndefined();
		expect(dependencies['@second/widget']).toBe('^4.0.0');
		expect(Object.keys(dependencies)).toEqual(['@second/widget', 'other']);
		expect(
			aligned.changes.find((change) => change.name === 'any-widget')?.to,
		).toBeNull();
		expect(aligned.declaredDifferences.join('\n')).toContain(
			'dependencies.any-widget was replaced by @second/widget ^4.0.0',
		);
	});

	it('leaves the package alone and reports it when the lineage does not verify', () => {
		const unforked: SuccessorForkPackage = {
			...fork,
			lineage: { ...fork.lineage, forkedFrom: null },
		};
		const aligned = alignAngularPackageManifest(manifest, cellWith({ 'any-widget': unforked }));
		const dependencies = aligned.manifest['dependencies'] as Record<string, string>;
		expect(dependencies['any-widget']).toBe('^1.0.0');
		expect(dependencies['@second/widget']).toBeUndefined();
		expect(aligned.changes).toEqual([]);
		expect(aligned.unhandled.join('\n')).toContain('carries a successor-fork disposition');
	});
});

describe('successor fork imports', () => {
	const reading = (
		disposition: SuccessorForkPackage,
		exports: readonly string[],
		overrides: Partial<SuccessorSurfaceReading> = {},
	) => ({ name: 'any-widget', disposition, surface: surface(exports, overrides) });

	it('renames the specifier when the successor exports every symbol the module names', () => {
		const migration = migrateSuccessorForkImports(
			'src/app/ui.module.ts',
			importing('WidgetModule, NativeWidgetModule'),
			reading(fork, ['NativeWidgetModule', 'WidgetAdapter', 'WidgetModule']),
		);
		expect(migration.changed).toBe(true);
		expect(migration.source).toBe(
			"import {WidgetModule, NativeWidgetModule} from '@second/widget';\n\nexport class Uses {}\n",
		);
		expect(migration.changes[0]?.symbols).toEqual(['NativeWidgetModule', 'WidgetModule']);
		expect(migration.unhandled).toEqual([]);
	});

	it('refuses the whole declaration when one named symbol is not on the successor surface', () => {
		const migration = migrateSuccessorForkImports(
			'src/app/ui.module.ts',
			importing('WidgetModule, RemovedThing'),
			reading(fork, ['WidgetModule']),
		);
		expect(migration.changed).toBe(false);
		expect(migration.source).toContain("from 'any-widget'");
		expect(migration.unhandled).toHaveLength(1);
		expect(migration.unhandled[0]).toContain('exports no RemovedThing from its root entry point');
	});

	it('refuses every import when the lineage does not verify', () => {
		const unforked: SuccessorForkPackage = {
			...fork,
			lineage: { ...fork.lineage, forkedFrom: null },
		};
		const migration = migrateSuccessorForkImports(
			'src/app/ui.module.ts',
			importing('WidgetModule'),
			reading(unforked, ['WidgetModule']),
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled[0]).toContain('the rename was refused');
	});

	it('refuses when the successor surface could not be read in full', () => {
		const migration = migrateSuccessorForkImports(
			'src/app/ui.module.ts',
			importing('WidgetModule'),
			reading(fork, [], { complete: false, incompleteReason: 'a star re-export was not followed' }),
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled[0]).toContain('could not be read in full');
	});

	it('refuses a namespace import, whose members cannot be measured by name', () => {
		const migration = migrateSuccessorForkImports(
			'src/app/ui.module.ts',
			"import * as widget from 'any-widget';\n",
			reading(fork, ['WidgetModule']),
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled[0]).toContain('namespace or star binding');
	});

	it('refuses a subpath import, which a root surface reading does not answer', () => {
		const migration = migrateSuccessorForkImports(
			'src/app/ui.module.ts',
			"import {Thing} from 'any-widget/deep';\n",
			reading(fork, ['Thing']),
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled[0]).toContain('names a subpath of any-widget');
	});

	it('leaves a module that never names the package byte-identical', () => {
		const source = "import {Other} from 'other';\n";
		const migration = migrateSuccessorForkImports(
			'src/app/other.ts',
			source,
			reading(fork, ['WidgetModule']),
		);
		expect(migration.changed).toBe(false);
		expect(migration.source).toBe(source);
	});
});
