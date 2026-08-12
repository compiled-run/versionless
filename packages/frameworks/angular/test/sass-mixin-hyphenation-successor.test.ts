import { describe, expect, it } from 'vitest';
import {
	acceptsArgumentCount,
	foldSassIdentifier,
	readSassMixinDeclarations,
	renameHyphenatedSassMixins,
	type SassMixinDeclaration,
} from '../src/sass-mixin-hyphenation-successor.ts';

/** The shape the installed surface really publishes, read the way the driver reads it. */
const SURFACE_SOURCE = [
	'@mixin init-css-vars($default-theme, $text) {',
	'  @include internal-helper.root($text);',
	'}',
	'',
	'@mixin init-material-css-vars(',
	'  $default-theme: variables.$default-light-theme,',
	'  $dark-theme-selector: variables.$dark-theme-selector,',
	'  $density: 0',
	') {',
	'  @include init-css-vars($default-theme, $default-theme-text);',
	'}',
	'',
	'@mixin mat-css-dark-theme {',
	'  .isDarkTheme & { @content; }',
	'}',
	'',
	'@mixin mat-css-color-and-contrast($hue) { color: $hue; }',
	'',
	'@mixin spread($first, $rest...) { margin: $first; }',
	'',
].join('\n');

const surface = readSassMixinDeclarations(SURFACE_SOURCE);

describe('sass mixin hyphenation successor', () => {
	it('folds hyphen, underscore and case boundary onto one identifier', () => {
		expect(foldSassIdentifier('initMaterialCssVars')).toBe('init-material-css-vars');
		expect(foldSassIdentifier('init_material_css_vars')).toBe('init-material-css-vars');
		expect(foldSassIdentifier('init-material-css-vars')).toBe('init-material-css-vars');
		// A run of capitals is an ambiguity the fold does not resolve.
		expect(foldSassIdentifier('initMaterialCSSVars')).toBe('init-material-c-s-s-vars');
	});

	it('reads declarations, their parameters and their defaults off the surface', () => {
		expect(surface.map((declaration) => declaration.name)).toEqual([
			'init-css-vars',
			'init-material-css-vars',
			'mat-css-dark-theme',
			'mat-css-color-and-contrast',
			'spread',
		]);
		const init = surface.find((declaration) => declaration.name === 'init-material-css-vars');
		expect(init?.parameters).toHaveLength(3);
		expect(init?.defaults).toBe(3);
		const dark = surface.find((declaration) => declaration.name === 'mat-css-dark-theme');
		expect(dark?.parameters).toEqual([]);
		const spread = surface.find((declaration) => declaration.name === 'spread');
		expect(spread?.restParameter).toBe(true);
	});

	it('accepts a call the declaration fits and refuses one it does not', () => {
		const init = surface.find((declaration) => declaration.name === 'init-material-css-vars');
		expect(init).toBeDefined();
		if (init === undefined) return;
		expect(acceptsArgumentCount(init, 0)).toBe(true);
		expect(acceptsArgumentCount(init, 3)).toBe(true);
		expect(acceptsArgumentCount(init, 4)).toBe(false);
		const plain: SassMixinDeclaration = Object.freeze({
			name: 'plain',
			parameters: Object.freeze(['$a']),
			defaults: 0,
			restParameter: false,
		});
		expect(acceptsArgumentCount(plain, 0)).toBe(false);
	});

	it('rewrites the camelCase include onto the declaration that folds to it', () => {
		const migration = renameHyphenatedSassMixins(
			'src/styles/themes.scss',
			'@include initMaterialCssVars();\n',
			surface,
		);
		expect(migration.changed).toBe(true);
		expect(migration.source).toBe('@include init-material-css-vars();\n');
		expect(migration.changes[0]?.to).toBe('init-material-css-vars');
		expect(migration.changes[0]?.arguments).toBe(0);
		expect(migration.unhandled).toEqual([]);
	});

	it('leaves an include the surface still declares exactly as written', () => {
		const source = '.bgc-primary {\n  @include mat-css-color-and-contrast(500);\n}\n';
		const migration = renameHyphenatedSassMixins('src/styles/themes.scss', source, surface);
		expect(migration.changed).toBe(false);
		expect(migration.source).toBe(source);
		expect(migration.unhandled).toEqual([]);
	});

	it('refuses a name the surface knows nothing that folds to', () => {
		const migration = renameHyphenatedSassMixins(
			'src/styles/themes.scss',
			'@include initSomethingElse();\n',
			surface,
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled).toHaveLength(1);
		expect(migration.unhandled[0]).toContain('no declaration in that surface folds to');
	});

	it('refuses when two declarations fold to the same identifier', () => {
		const ambiguous = readSassMixinDeclarations(
			['@mixin init-theme($a) { a: $a; }', '@mixin init_theme($a) { a: $a; }', ''].join('\n'),
		);
		const migration = renameHyphenatedSassMixins(
			'src/styles/themes.scss',
			'@include initTheme(1);\n',
			ambiguous,
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled[0]).toContain('2 mixins that fold to it');
	});

	it('refuses a rename whose arity the declaration would reject', () => {
		const migration = renameHyphenatedSassMixins(
			'src/styles/themes.scss',
			'@include matCssColorAndContrast();\n',
			surface,
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled[0]).toContain('passes 0 argument(s)');
	});

	it('passes over a namespaced include, which resolves through its own namespace', () => {
		const source = '@include mat.all-component-themes($theme);\n';
		const migration = renameHyphenatedSassMixins('src/styles/themes.scss', source, surface);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled).toEqual([]);
	});
});
