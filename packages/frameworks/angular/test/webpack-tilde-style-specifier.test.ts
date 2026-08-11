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

	it('touches nothing in a sheet with no tilde, including a relative import of the same name', () => {
		const source = "@import './theming';\n@import '@scope/ui/theming';\n";
		const migration = dropWebpackTildeSpecifiers('src/styles.scss', source, closure);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled).toEqual([]);
	});
});
