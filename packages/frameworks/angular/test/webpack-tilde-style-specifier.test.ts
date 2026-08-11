import { describe, expect, it } from 'vitest';
import {
	dropWebpackTildeSpecifiers,
	resolveInClosure,
	sassCandidates,
	type ClosureFileReading,
} from '../src/webpack-tilde-style-specifier.ts';

/** A closure carrying exactly the files a real one would for these specifiers. */
const carried: readonly string[] = Object.freeze([
	'@scope/ui/_theming.scss',
	'@scope/ui/prebuilt/indigo.css',
	'@scope/ui/tokens/index.scss',
	'icons/css/icons.min.css',
]);

const closure: ClosureFileReading = Object.freeze({
	carries: (relativePath: string): boolean => carried.includes(relativePath),
});

describe('webpack tilde style specifier', () => {
	it('tries sass’s own resolution order, partial and index included', () => {
		expect(sassCandidates('@scope/ui/theming')).toContain('@scope/ui/_theming.scss');
		expect(sassCandidates('@scope/ui/tokens')).toContain('@scope/ui/tokens/index.scss');
		expect(sassCandidates('icons/css/icons.min.css')).toEqual([
			'icons/css/icons.min.css',
			'icons/css/_icons.min.css',
		]);
		expect(resolveInClosure('@scope/ui/theming', closure)).toBe('@scope/ui/_theming.scss');
		expect(resolveInClosure('@scope/ui/missing', closure)).toBeNull();
	});

	it('drops the prefix from an @import the closure answers', () => {
		const migration = dropWebpackTildeSpecifiers(
			'src/styles.scss',
			"@import '~@scope/ui/theming';\n",
			closure,
		);
		expect(migration.changed).toBe(true);
		expect(migration.source).toBe("@import '@scope/ui/theming';\n");
		expect(migration.changes[0]?.resolved).toBe('@scope/ui/_theming.scss');
		expect(migration.unhandled).toEqual([]);
	});

	it('handles @use and @forward, and several rules in one sheet', () => {
		const migration = dropWebpackTildeSpecifiers(
			'src/styles.scss',
			[
				"@use '~@scope/ui/tokens';",
				"@forward '~@scope/ui/theming';",
				"@import '~icons/css/icons.min.css';",
				'',
			].join('\n'),
			closure,
		);
		expect(migration.source).toBe(
			["@use '@scope/ui/tokens';", "@forward '@scope/ui/theming';", "@import 'icons/css/icons.min.css';", ''].join(
				'\n',
			),
		);
		expect(migration.changes).toHaveLength(3);
	});

	it('refuses a tilde specifier the closure cannot answer, rather than moving the failure', () => {
		const migration = dropWebpackTildeSpecifiers(
			'src/styles.scss',
			"@import '~@scope/ui/gone';\n",
			closure,
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled[0]).toContain('@scope/ui/gone');
	});

	it('carries a package rename through the prefix drop, resolved under the new name', () => {
		const migration = dropWebpackTildeSpecifiers(
			'src/styles.scss',
			"@import '~old-ui/css/icons.min.css';\n",
			{ carries: (relativePath) => relativePath === 'icons/css/icons.min.css' },
			{ 'old-ui': 'icons' },
		);
		expect(migration.source).toBe("@import 'icons/css/icons.min.css';\n");
		expect(migration.changes[0]?.resolved).toBe('icons/css/icons.min.css');
	});

	it('refuses a renamed specifier the closure does not answer under the new name', () => {
		const migration = dropWebpackTildeSpecifiers(
			'src/styles.scss',
			"@import '~old-ui/css/icons.min.css';\n",
			closure,
			{ 'old-ui': 'somewhere-else' },
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled[0]).toContain('somewhere-else/css/icons.min.css');
	});

	it('renames on the whole package name, never on a prefix of one', () => {
		const migration = dropWebpackTildeSpecifiers(
			'src/styles.scss',
			"@import '~icons-extra/css/icons.min.css';\n",
			{ carries: (relativePath) => relativePath === 'icons-extra/css/icons.min.css' },
			{ icons: 'renamed' },
		);
		expect(migration.source).toBe("@import 'icons-extra/css/icons.min.css';\n");
	});

	it('touches nothing in a sheet with no tilde, including a relative import of the same name', () => {
		const source = "@import './theming';\n@import '@scope/ui/theming';\n";
		const migration = dropWebpackTildeSpecifiers('src/styles.scss', source, closure);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled).toEqual([]);
	});

	it('un-prefixes a subpath the installed package answers only through its exports map', () => {
		const map: Readonly<Record<string, string>> = Object.freeze({
			'angular-material-css-vars/public-util':
				'angular-material-css-vars/src/lib/_public-util.scss',
			'angular-material-css-vars/main': 'angular-material-css-vars/src/lib/_main.scss',
		});
		const migration = dropWebpackTildeSpecifiers(
			'src/styles/themes.scss',
			"@import '~angular-material-css-vars/public-util';\n@import '~angular-material-css-vars/main';\n",
			{ carries: () => false, entryPoint: (specifier) => map[specifier] ?? null },
		);
		expect(migration.changed).toBe(true);
		expect(migration.unhandled).toEqual([]);
		expect(migration.source).toBe(
			"@import 'angular-material-css-vars/public-util';\n@import 'angular-material-css-vars/main';\n",
		);
		expect(migration.changes.map((change) => change.resolved)).toEqual([
			'angular-material-css-vars/src/lib/_public-util.scss',
			'angular-material-css-vars/src/lib/_main.scss',
		]);
	});

	it('refuses a subpath the exports map does not answer, even beside one it does', () => {
		const migration = dropWebpackTildeSpecifiers(
			'src/styles/themes.scss',
			"@import '~mapped/known';\n@import '~mapped/unknown';\n",
			{
				carries: () => false,
				entryPoint: (specifier) => (specifier === 'mapped/known' ? 'mapped/_known.scss' : null),
			},
		);
		expect(migration.source).toBe("@import 'mapped/known';\n@import '~mapped/unknown';\n");
		expect(migration.unhandled).toHaveLength(1);
		expect(migration.unhandled[0]).toContain('mapped/unknown');
	});

	it('prefers the exports map over a path the closure happens to carry', () => {
		const migration = dropWebpackTildeSpecifiers(
			'src/styles.scss',
			"@import '~mapped/util';\n",
			{
				carries: (relativePath) => relativePath === 'mapped/util.scss',
				entryPoint: () => 'mapped/dist/_util.scss',
			},
		);
		expect(migration.changes[0]?.resolved).toBe('mapped/dist/_util.scss');
	});

	it('asks only the file question of a reading that supplies no exports map', () => {
		const migration = dropWebpackTildeSpecifiers(
			'src/styles.scss',
			"@import '~icons/css/icons.min.css';\n",
			{ carries: (relativePath) => relativePath === 'icons/css/icons.min.css' },
		);
		expect(migration.source).toBe("@import 'icons/css/icons.min.css';\n");
	});
});
