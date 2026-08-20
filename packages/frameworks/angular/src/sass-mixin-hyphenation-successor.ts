/**
 * A stylesheet that includes a mixin by a spelling the installed Sass surface
 * no longer declares, where the surface declares the same identifier hyphenated.
 *
 * Sass folds hyphen and underscore together — `init_css_vars` and
 * `init-css-vars` are one identifier — but it does not fold case boundaries, so
 * a library that published `initMaterialCssVars` and then republished the same
 * mixin as `init-material-css-vars` broke every `@include` that named it. The
 * compiler's whole report is `Undefined mixin`; it offers no successor, because
 * from Sass's point of view the two are unrelated names.
 *
 * The successor is not guessed here and it is not written down in a table. It is
 * read off the surface the stylesheet actually imports: hyphenate the included
 * name at its case boundaries, fold the surface's own declarations the same way,
 * and keep the rewrite only when *exactly one* declaration in the surface folds
 * to the same identifier and its parameter list accepts the call as written. Two
 * candidates, none, an arity the declaration refuses, or a name the surface still
 * declares — and nothing is written, by name, with the reading that refused it.
 *
 * The surface is supplied by the caller as a list of declarations, so this stays
 * a pure function of the stylesheet and the reading and a test can answer it
 * without a `node_modules`.
 */

import { charIn, charNotIn, createRegExp, exactly, global, oneOrMore } from 'magic-regexp';
import { applySourceEdits, lineOf, type SourceEdit } from './semantic-module.ts';

/**
 * One `@mixin` the imported Sass surface declares, as the surface declares it.
 *
 * `parameters` is the declared list in source order. `restParameter` records
 * that the list ends in `$args...`, which accepts any number of trailing
 * arguments; `defaults` counts how many of the declared parameters carry a
 * default, because a call passing fewer arguments than the declaration requires
 * is not answered by a rename.
 */
export type SassMixinDeclaration = Readonly<{
	name: string;
	parameters: readonly string[];
	defaults: number;
	restParameter: boolean;
}>;

export type SassMixinRenameChange = Readonly<{
	kind: 'sass-mixin-hyphenation';
	line: number;
	from: string;
	to: string;
	/** The declaration in the surface that answered the call. */
	declaration: SassMixinDeclaration;
	/** How many arguments the call site passed. */
	arguments: number;
}>;

export type SassMixinRenameMigration = Readonly<{
	path: string;
	source: string;
	changed: boolean;
	changes: readonly SassMixinRenameChange[];
	unhandled: readonly string[];
}>;

/** The `@mixin` keyword itself; the name and parameter list are read after it. */
const MIXIN_KEYWORD = createRegExp(exactly('@mixin').and(oneOrMore(charIn(' \t'))), [global]);

/**
 * Sass's own identifier folding, extended to the case boundary the rename moved
 * across.
 *
 * Hyphen and underscore are the same character to Sass, so both fold to a
 * hyphen. A lower-to-upper boundary — the only boundary a camelCase spelling
 * carries — folds to a hyphen too, and the whole identifier lowercases. That
 * makes `initMaterialCssVars`, `init-material-css-vars` and `init_material_css_vars`
 * one key, and leaves `initMaterialCSSVars` folding to `init-material-c-s-s-vars`,
 * which is deliberate: a run of capitals is an ambiguity this capability refuses
 * rather than resolves.
 */
export function foldSassIdentifier(identifier: string): string {
	let folded = '';
	for (const character of identifier) {
		if (character === '_' || character === '-') {
			folded += '-';
			continue;
		}
		const lower = character.toLowerCase();
		if (lower !== character && folded !== '' && !folded.endsWith('-')) folded += '-';
		folded += lower;
	}
	return folded;
}

/** Split a Sass parameter list on top-level commas, respecting nesting and strings. */
function splitArguments(text: string): readonly string[] {
	const parts: string[] = [];
	let depth = 0;
	let quote: string | null = null;
	let current = '';
	for (const character of text) {
		if (quote !== null) {
			current += character;
			if (character === quote) quote = null;
			continue;
		}
		if (character === '"' || character === "'") {
			quote = character;
			current += character;
			continue;
		}
		if (character === '(' || character === '[') depth += 1;
		if (character === ')' || character === ']') depth -= 1;
		if (character === ',' && depth === 0) {
			parts.push(current);
			current = '';
			continue;
		}
		current += character;
	}
	parts.push(current);
	return Object.freeze(parts.map((part) => part.trim()).filter((part) => part !== ''));
}

/** The text between the parenthesis at `open` and its match, or null when unbalanced. */
function balanced(source: string, open: number): Readonly<{ text: string; end: number }> | null {
	let depth = 0;
	let quote: string | null = null;
	for (let index = open; index < source.length; index += 1) {
		const character = source[index] ?? '';
		if (quote !== null) {
			if (character === quote) quote = null;
			continue;
		}
		if (character === '"' || character === "'") {
			quote = character;
			continue;
		}
		if (character === '(') depth += 1;
		if (character === ')') {
			depth -= 1;
			if (depth === 0)
				return Object.freeze({ text: source.slice(open + 1, index), end: index + 1 });
		}
	}
	return null;
}

/**
 * Every `@mixin` a Sass source declares, read from the source itself.
 *
 * A declaration with no parameter list declares no parameters, which is a
 * different thing from a declaration whose list is empty; both accept a call
 * passing nothing, and neither accepts a call passing an argument.
 */
export function readSassMixinDeclarations(source: string): readonly SassMixinDeclaration[] {
	const declarations: SassMixinDeclaration[] = [];
	for (const match of source.matchAll(MIXIN_KEYWORD)) {
		const offset = match.index;
		if (offset === undefined) continue;
		const afterKeyword = offset + '@mixin'.length;
		let cursor = afterKeyword;
		while (cursor < source.length && (source[cursor] === ' ' || source[cursor] === '\t'))
			cursor += 1;
		let name = '';
		while (cursor < source.length && /[\w-]/u.test(source[cursor] ?? '')) {
			name += source[cursor];
			cursor += 1;
		}
		if (name === '') continue;
		while (cursor < source.length && /\s/u.test(source[cursor] ?? '')) cursor += 1;
		if (source[cursor] !== '(') {
			declarations.push(
				Object.freeze({
					name,
					parameters: Object.freeze([]),
					defaults: 0,
					restParameter: false,
				}),
			);
			continue;
		}
		const list = balanced(source, cursor);
		if (list === null) continue;
		const parameters = splitArguments(list.text);
		declarations.push(
			Object.freeze({
				name,
				parameters: Object.freeze([...parameters]),
				defaults: parameters.filter((parameter) => parameter.includes(':')).length,
				restParameter: parameters.some((parameter) => parameter.endsWith('...')),
			}),
		);
	}
	return Object.freeze(declarations);
}

/** Does `declaration` accept a call passing `count` positional arguments. */
export function acceptsArgumentCount(declaration: SassMixinDeclaration, count: number): boolean {
	const required = declaration.parameters.length - declaration.defaults;
	if (count < required) return false;
	if (declaration.restParameter) return true;
	return count <= declaration.parameters.length;
}

const INCLUDE_AT_RULE = createRegExp(
	exactly('@include')
		.and(oneOrMore(charIn(' \t')))
		.and(oneOrMore(charNotIn(' \t\n;({')).as('name')),
	[global],
);

/**
 * Rewrite every `@include` whose name the surface no longer declares onto the
 * one declaration that folds to the same identifier.
 *
 * `surface` is every mixin reachable from the stylesheet's own `@import`,
 * `@use` and `@forward` rules, read from the installed closure by the caller.
 * A name the surface still declares is left exactly as written — the include
 * resolves, and there is nothing here to answer.
 */
export function renameHyphenatedSassMixins(
	path: string,
	source: string,
	surface: readonly SassMixinDeclaration[],
): SassMixinRenameMigration {
	const declared = new Set(surface.map((declaration) => declaration.name));
	const byFold = new Map<string, SassMixinDeclaration[]>();
	for (const declaration of surface) {
		const key = foldSassIdentifier(declaration.name);
		byFold.set(key, [...(byFold.get(key) ?? []), declaration]);
	}
	const edits: SourceEdit[] = [];
	const changes: SassMixinRenameChange[] = [];
	const unhandled: string[] = [];
	for (const match of source.matchAll(INCLUDE_AT_RULE)) {
		const name = match.groups?.['name'];
		const offset = match.index;
		if (name === undefined || offset === undefined) continue;
		if (name.includes('.')) continue;
		if (declared.has(name)) continue;
		const line = lineOf(source, offset);
		const folded = foldSassIdentifier(name);
		const candidates = byFold.get(folded) ?? [];
		if (candidates.length === 0) {
			unhandled.push(
				`${path} line ${String(line)}: '@include ${name}' names a mixin the imported surface ` +
					`does not declare, and no declaration in that surface folds to '${folded}'. The ` +
					'surface knows no successor for this name, so nothing was written.',
			);
			continue;
		}
		if (candidates.length > 1) {
			unhandled.push(
				`${path} line ${String(line)}: '@include ${name}' folds to '${folded}', and the imported ` +
					`surface declares ${String(candidates.length)} mixins that fold to it — ` +
					`${candidates.map((candidate) => candidate.name).join(', ')}. Choosing between them ` +
					'is not a reading, so nothing was written.',
			);
			continue;
		}
		const declaration = candidates[0];
		if (declaration === undefined) continue;
		const nameStart = source.indexOf(name, offset);
		if (nameStart < 0) continue;
		const nameEnd = nameStart + name.length;
		let cursor = nameEnd;
		while (cursor < source.length && (source[cursor] === ' ' || source[cursor] === '\t'))
			cursor += 1;
		let count = 0;
		if (source[cursor] === '(') {
			const list = balanced(source, cursor);
			if (list === null) {
				unhandled.push(
					`${path} line ${String(line)}: '@include ${name}' opens an argument list this reader ` +
						'cannot close, so the call was not measured and nothing was written.',
				);
				continue;
			}
			count = splitArguments(list.text).length;
		}
		if (!acceptsArgumentCount(declaration, count)) {
			unhandled.push(
				`${path} line ${String(line)}: '@include ${name}' passes ${String(count)} argument(s) and ` +
					`the surface's '${declaration.name}' declares ${String(declaration.parameters.length)} ` +
					`parameter(s), ${String(declaration.defaults)} with defaults. The names fold together and ` +
					'the call does not fit the declaration, so the rename was refused rather than guessed at.',
			);
			continue;
		}
		edits.push({ start: nameStart, end: nameEnd, text: declaration.name });
		changes.push({
			kind: 'sass-mixin-hyphenation',
			line,
			from: name,
			to: declaration.name,
			declaration,
			arguments: count,
		});
	}
	const migrated = applySourceEdits(source, edits);
	return Object.freeze({
		path,
		source: migrated,
		changed: migrated !== source,
		changes: Object.freeze(changes),
		unhandled: Object.freeze(unhandled),
	});
}
