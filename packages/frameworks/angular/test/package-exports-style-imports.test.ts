import { describe, expect, it } from 'vitest';
import {
	migratePackageStyleImports,
	republishedSubpath,
	resolvePackageExport,
	rootAggregateStylesheet,
	type PackageExportsReading,
} from '../src/package-exports-style-imports.ts';

/**
 * The published surface of a component library that names every component's
 * stylesheet subpath and no root one — the shape that blocks exactly one import
 * of an application that took the root entry and leaves its neighbours working.
 */
const componentStyle = (name: string): Readonly<Record<string, string>> =>
	Object.freeze({ less: `./${name}/style/*.less`, style: `./${name}/style/index.min.css` });

const COMPONENTS: readonly string[] = ['tooltip', 'spin', 'modal', 'dropdown', 'select'];

const library: PackageExportsReading = Object.freeze({
	name: 'ng-zorro-antd',
	version: '16.2.2',
	exports: Object.freeze({
		'.': { types: './index.d.ts', default: './fesm2022/ng-zorro-antd.mjs' },
		'./ng-zorro-antd.min.css': { style: './ng-zorro-antd.min.css' },
		'./ng-zorro-antd.css': { style: './ng-zorro-antd.css' },
		'./ng-zorro-antd.dark.min.css': { style: './ng-zorro-antd.dark.min.css' },
		'./ng-zorro-antd.compact.min.css': { style: './ng-zorro-antd.compact.min.css' },
		'./*.less': { less: './*.less' },
		...Object.fromEntries(
			COMPONENTS.map((name) => [`./${name}/style/*`, componentStyle(name)] as const),
		),
	}),
	fileSizes: Object.freeze({
		'style/index.min.css': 23_255,
		'tooltip/style/index.min.css': 1_024,
		'spin/style/index.min.css': 2_048,
		'modal/style/index.min.css': 4_096,
		'dropdown/style/index.min.css': 8_192,
		'select/style/index.min.css': 16_384,
		'ng-zorro-antd.min.css': 563_200,
	}),
});

const eraStyleSheet = `@import 'ng-zorro-antd/style/index.min.css';
@import 'ng-zorro-antd/tooltip/style/index.min.css';
@import 'ng-zorro-antd/spin/style/index.min.css';
@import 'ng-zorro-antd/modal/style/index.min.css';
@import 'ng-zorro-antd/dropdown/style/index.min.css';
@import 'ng-zorro-antd/select/style/index.min.css';

@tailwind base;
.board {
  display: flex;
}
`;

/**
 * The other shape an `exports` map blocks a stylesheet with, and the one the
 * eShopOnContainers WebSPA holdout met: the file the application named is
 * published, under an extensionless key. Nothing is missing here — the spelling
 * is.
 */
const toastr: PackageExportsReading = Object.freeze({
	name: 'ngx-toastr',
	version: '17.0.2',
	exports: Object.freeze({
		'./toastr': { default: './toastr.css' },
		'./toastr-old': { default: './toastr-old.css' },
		'./toastr-bs4-alert': { default: './toastr-bs4-alert.scss' },
		'./toastr-bs5-alert': { default: './toastr-bs5-alert.scss' },
		'./package.json': { default: './package.json' },
		'.': { types: './index.d.ts', default: './fesm2022/ngx-toastr.mjs' },
	}),
});

const eraGlobals = `/* You can add global styles to this file */
@import "bootstrap/scss/bootstrap";
@import "ngx-toastr/toastr-bs4-alert.scss";

.alert {
  padding-left: 0;
}
`;

describe('package exports resolution', () => {
	it('resolves an exact subpath, a pattern subpath and the package root', () => {
		expect(resolvePackageExport(library.exports, './tooltip/style/index.min.css')).toBe(
			'./tooltip/style/index.min.css',
		);
		expect(resolvePackageExport(library.exports, './ng-zorro-antd.min.css')).toBe(
			'./ng-zorro-antd.min.css',
		);
		expect(resolvePackageExport(library.exports, '.')).toBe('./fesm2022/ng-zorro-antd.mjs');
	});

	it('resolves nothing for a subpath the map does not expose', () => {
		expect(resolvePackageExport(library.exports, './style/index.min.css')).toBeNull();
		expect(resolvePackageExport(library.exports, './tooltip/style/index.min.css', ['less'])).toBe(
			'./tooltip/style/index.min.css.less',
		);
	});

	it('takes the aggregate carrying the blocked import’s own extension chain, never a variant', () => {
		expect(rootAggregateStylesheet(library, './style/index.min.css')).toEqual({
			subpath: './ng-zorro-antd.min.css',
			file: './ng-zorro-antd.min.css',
		});
		expect(rootAggregateStylesheet(library, './style/index.css')).toEqual({
			subpath: './ng-zorro-antd.css',
			file: './ng-zorro-antd.css',
		});
	});
});

describe('exports-map-blocked style imports', () => {
	it('substitutes the exported aggregate and removes the imports it now contains', () => {
		const migration = migratePackageStyleImports('src/styles.scss', eraStyleSheet, library);
		expect(migration.changed).toBe(true);
		expect(migration.source).toBe(`@import 'ng-zorro-antd/ng-zorro-antd.min.css';

@tailwind base;
.board {
  display: flex;
}
`);
		expect(migration.changes).toEqual([
			{
				kind: 'style-import-aggregate',
				line: 1,
				from: 'ng-zorro-antd/style/index.min.css',
				to: 'ng-zorro-antd/ng-zorro-antd.min.css',
			},
			...COMPONENTS.map((name, index) => ({
				kind: 'style-import-redundant' as const,
				line: index + 2,
				from: `ng-zorro-antd/${name}/style/index.min.css`,
				to: 'ng-zorro-antd/ng-zorro-antd.min.css',
			})),
		]);
		expect(migration.unhandled).toEqual([]);
	});

	it('names the payload change in bytes when the closure was measured', () => {
		const migration = migratePackageStyleImports('src/styles.scss', eraStyleSheet, library);
		const [payload, ...removals] = migration.declaredDifferences;
		expect(payload).toContain('6 ng-zorro-antd stylesheet import(s) were replaced');
		expect(payload).toContain('ships 563200 bytes of stylesheet where it previously shipped 54999');
		expect(payload).toContain('a witness arbitrates that');
		expect(removals).toHaveLength(COMPONENTS.length);
		expect(removals[0]).toContain(
			'the granular import ng-zorro-antd/tooltip/style/index.min.css was removed',
		);
	});

	it('states the payload change in words when the closure was not measured', () => {
		const migration = migratePackageStyleImports('src/styles.scss', eraStyleSheet, {
			name: library.name,
			version: library.version,
			exports: library.exports,
		});
		expect(migration.declaredDifferences[0]).toContain('the closure was not measured');
	});

	it('leaves a stylesheet whose every import the exports map still resolves untouched', () => {
		const resolvable = `@import 'ng-zorro-antd/tooltip/style/index.min.css';
@import 'ng-zorro-antd/modal/style/index.min.css';
`;
		const migration = migratePackageStyleImports('src/styles.scss', resolvable, library);
		expect(migration.changed).toBe(false);
		expect(migration.source).toBe(resolvable);
		expect(migration.changes).toEqual([]);
		expect(migration.declaredDifferences).toEqual([]);
		expect(migration.unhandled).toEqual([]);
	});

	it('leaves imports of packages this reading is not about untouched', () => {
		const other = "@import 'some-other-library/style/index.min.css';\n";
		const migration = migratePackageStyleImports('src/styles.scss', other, library);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled).toEqual([]);
	});

	it('refuses a blocked import the map neither republishes nor aggregates, by line', () => {
		const neither: PackageExportsReading = {
			name: toastr.name,
			version: toastr.version,
			exports: { './toastr': { default: './toastr.css' } },
		};
		const migration = migratePackageStyleImports(
			'Client/globals.scss',
			eraGlobals,
			neither,
		);
		expect(migration.changed).toBe(false);
		expect(migration.source).toBe(eraGlobals);
		expect(migration.unhandled).toEqual([
			'Client/globals.scss line 3: ngx-toastr@17.0.2 does not expose ./toastr-bs4-alert.scss ' +
				'through its exports map and publishes no root aggregate stylesheet to put in its ' +
				'place, so the import was left exactly as it is',
		]);
	});

	it('refuses when the package exports no aggregate stylesheet to put in place', () => {
		const withoutAggregate: PackageExportsReading = {
			name: library.name,
			version: library.version,
			exports: Object.fromEntries(
				COMPONENTS.map((name) => [`./${name}/style/*`, componentStyle(name)] as const),
			),
		};
		const migration = migratePackageStyleImports(
			'src/styles.scss',
			eraStyleSheet,
			withoutAggregate,
		);
		expect(migration.changed).toBe(false);
		expect(migration.source).toBe(eraStyleSheet);
		expect(migration.changes).toEqual([]);
		expect(migration.declaredDifferences).toEqual([]);
		expect(migration.unhandled).toEqual([
			'src/styles.scss line 1: ng-zorro-antd@16.2.2 does not expose ./style/index.min.css ' +
				'through its exports map and publishes no root aggregate stylesheet to put in its ' +
				'place, so the import was left exactly as it is',
		]);
	});

	it('takes the republished key over the aggregate, because it is the same bytes', () => {
		const alsoRepublished: PackageExportsReading = {
			...library,
			exports: { ...(library.exports as object), './style/index': { style: './style/index.min.css' } },
		};
		const migration = migratePackageStyleImports(
			'src/styles.scss',
			"@import 'ng-zorro-antd/style/index.min.css';\n",
			alsoRepublished,
		);
		expect(migration.changes).toEqual([
			{
				kind: 'style-import-republished',
				line: 1,
				from: 'ng-zorro-antd/style/index.min.css',
				to: 'ng-zorro-antd/style/index',
			},
		]);
		expect(migration.declaredDifferences).toEqual([]);
	});

	it('refuses when the only root aggregate is a themed variant rather than the library’s own', () => {
		const themedOnly: PackageExportsReading = {
			name: library.name,
			version: library.version,
			exports: {
				'./ng-zorro-antd.dark.min.css': { style: './ng-zorro-antd.dark.min.css' },
				...Object.fromEntries(
					COMPONENTS.map((name) => [`./${name}/style/*`, componentStyle(name)] as const),
				),
			},
		};
		const migration = migratePackageStyleImports('src/styles.scss', eraStyleSheet, themedOnly);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled).toHaveLength(1);
	});
});

describe('the republished subpath — a blocked import whose file is exported one key away', () => {
	it('finds the literal key that resolves to exactly the blocked file', () => {
		expect(republishedSubpath(toastr, './toastr-bs4-alert.scss')).toBe('./toastr-bs4-alert');
		expect(republishedSubpath(toastr, './toastr.css')).toBe('./toastr');
	});

	it('finds none for a file the map does not publish under any key', () => {
		expect(republishedSubpath(toastr, './toastr-bs3-alert.scss')).toBeNull();
		expect(republishedSubpath(library, './style/index.min.css')).toBeNull();
	});

	it('never answers with a pattern key, because a pattern would not have blocked the import', () => {
		const patterned: PackageExportsReading = {
			name: 'pkg',
			version: '1.0.0',
			exports: { './*': { style: './*' } },
		};
		expect(republishedSubpath(patterned, './theme.scss')).toBeNull();
	});

	it('takes the first key in sort order when several name the one file', () => {
		const twice: PackageExportsReading = {
			name: 'pkg',
			version: '1.0.0',
			exports: {
				'./zeta': { style: './theme.scss' },
				'./alpha': { style: './theme.scss' },
			},
		};
		expect(republishedSubpath(twice, './theme.scss')).toBe('./alpha');
	});

	it('rewrites the era import onto the published spelling and declares nothing', () => {
		const migration = migratePackageStyleImports('Client/globals.scss', eraGlobals, toastr);
		expect(migration.changed).toBe(true);
		expect(migration.source).toBe(
			eraGlobals.replace(
				'"ngx-toastr/toastr-bs4-alert.scss"',
				'"ngx-toastr/toastr-bs4-alert"',
			),
		);
		expect(migration.changes).toEqual([
			{
				kind: 'style-import-republished',
				line: 3,
				from: 'ngx-toastr/toastr-bs4-alert.scss',
				to: 'ngx-toastr/toastr-bs4-alert',
			},
		]);
		expect(migration.declaredDifferences).toEqual([]);
		expect(migration.unhandled).toEqual([]);
	});

	it('resolves the specifier it wrote, which is the whole of the repair', () => {
		const migration = migratePackageStyleImports('Client/globals.scss', eraGlobals, toastr);
		const written = migration.changes[0]?.to.slice('ngx-toastr'.length + 1);
		expect(resolvePackageExport(toastr.exports, `./${String(written)}`)).toBe(
			'./toastr-bs4-alert.scss',
		);
	});

	it('carries a webpack tilde import onto the published spelling too', () => {
		const migration = migratePackageStyleImports(
			'Client/globals.scss',
			'@import "~ngx-toastr/toastr-bs4-alert.scss";\n',
			toastr,
		);
		expect(migration.source).toBe('@import "ngx-toastr/toastr-bs4-alert";\n');
	});

	it('repairs every blocked import of the package or none of them', () => {
		const both = `@import "ngx-toastr/toastr-bs4-alert.scss";
@import "ngx-toastr/toastr-bs9-alert.scss";
`;
		const migration = migratePackageStyleImports('Client/globals.scss', both, toastr);
		expect(migration.changed).toBe(false);
		expect(migration.source).toBe(both);
		expect(migration.changes).toEqual([]);
		expect(migration.unhandled).toHaveLength(2);
		expect(migration.unhandled[0]).toContain('./toastr-bs4-alert.scss');
	});

	it('repairs several blocked imports at once when the map republishes each', () => {
		const two = `@import "ngx-toastr/toastr-bs4-alert.scss";
@import "ngx-toastr/toastr.css";
`;
		const migration = migratePackageStyleImports('Client/globals.scss', two, toastr);
		expect(migration.source).toBe(`@import "ngx-toastr/toastr-bs4-alert";
@import "ngx-toastr/toastr";
`);
		expect(migration.changes.map((change) => change.kind)).toEqual([
			'style-import-republished',
			'style-import-republished',
		]);
	});

	it('leaves an import the map already resolves exactly as it is', () => {
		const resolvable = '@import "ngx-toastr/toastr-bs4-alert";\n';
		const migration = migratePackageStyleImports('Client/globals.scss', resolvable, toastr);
		expect(migration.changed).toBe(false);
		expect(migration.source).toBe(resolvable);
		expect(migration.unhandled).toEqual([]);
	});
});
