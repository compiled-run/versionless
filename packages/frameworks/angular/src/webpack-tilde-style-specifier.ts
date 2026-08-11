/**
 * The `~` prefix an era stylesheet used to reach `node_modules`.
 *
 * webpack's css and sass loaders once resolved a specifier beginning with `~`
 * as a module request instead of a relative path, because their default
 * resolution treated everything else as relative. Every Angular CLI project of
 * the era therefore wrote `@import '~@angular/material/theming'`. The loaders
 * deprecated the prefix once module resolution became the fallback for bare
 * specifiers, and the Angular CLI stopped supporting it: the tilde is now part
 * of the path, no such directory exists, and the sass compiler stops the build.
 *
 * The successor is the same specifier without the prefix. That is a one
 * character deletion, and it is the whole of the transform — which is exactly
 * why the interesting part is the check in front of it. A specifier is only
 * un-prefixed when the installed closure really answers it, resolved the way
 * sass documents: the exact path, the partial (`_name`), each of sass's own
 * extensions, and the directory index. A tilde import of something the closure
 * does not carry is refused by name, because deleting the prefix there would
 * turn "this path does not exist" into a different error at a different layer.
 *
 * The closure is read, never assumed. The caller supplies the one question this
 * capability asks of the file system — does the closure carry this path — so
 * the transform stays a pure function of the module and the reading, and a test
 * can answer it without a `node_modules`.
 */

import { charIn, charNotIn, createRegExp, exactly, global, maybe, oneOrMore } from 'magic-regexp';
import { compareStrings } from './angular-target-cell.ts';
import { applySourceEdits, lineOf, type SourceEdit } from './semantic-module.ts';

/** The prefix webpack's loaders read as "resolve this as a module". */
export const WEBPACK_MODULE_PREFIX = '~';

/** The extensions sass resolves a specifier through, in its own documented order. */
export const SASS_EXTENSIONS: readonly string[] = Object.freeze(['.scss', '.sass', '.css']);

/**
 * The one question this capability asks of the installed closure: whether it
 * carries a path, relative to the closure's package root directory.
 */
export type ClosureFileReading = Readonly<{ carries: (relativePath: string) => boolean }>;

export type TildeSpecifierChange = Readonly<{
	kind: 'webpack-tilde-specifier';
	line: number;
	from: string;
	to: string;
	/** The file in the closure that answers the un-prefixed specifier. */
	resolved: string;
}>;

export type TildeSpecifierMigration = Readonly<{
	path: string;
	source: string;
	changed: boolean;
	changes: readonly TildeSpecifierChange[];
	unhandled: readonly string[];
}>;

const TILDE_AT_RULE = createRegExp(
	exactly('@')
		.and(exactly('import').or(exactly('use')).or(exactly('forward')).as('rule'))
		.and(oneOrMore(charIn(' \t')))
		.and(charIn('\'"'))
		.and(exactly(WEBPACK_MODULE_PREFIX))
		.and(oneOrMore(charNotIn('\'"\n')).as('specifier'))
		.and(maybe(charIn('\'"'))),
	[global],
);

/**
 * Every path sass would try for `specifier`, in the order it tries them.
 *
 * A specifier that already names one of sass's extensions is tried as written
 * and as a partial; one that does not is additionally tried with each
 * extension, and as a directory index.
 */
export function sassCandidates(specifier: string): readonly string[] {
	const cut = specifier.lastIndexOf('/');
	const directory = cut < 0 ? '' : specifier.slice(0, cut + 1);
	const base = cut < 0 ? specifier : specifier.slice(cut + 1);
	const named = SASS_EXTENSIONS.some((extension) => base.endsWith(extension));
	const stems = named ? [base] : SASS_EXTENSIONS.map((extension) => `${base}${extension}`);
	const candidates: string[] = [];
	if (named) candidates.push(`${directory}${base}`);
	for (const stem of stems) {
		candidates.push(`${directory}${stem}`);
		candidates.push(`${directory}_${stem}`);
	}
	if (!named)
		for (const extension of SASS_EXTENSIONS) {
			candidates.push(`${specifier}/index${extension}`);
			candidates.push(`${specifier}/_index${extension}`);
		}
	return Object.freeze([...new Set(candidates)]);
}

/** The closure file that answers `specifier`, or null when none does. */
export function resolveInClosure(specifier: string, closure: ClosureFileReading): string | null {
	for (const candidate of sassCandidates(specifier)) if (closure.carries(candidate)) return candidate;
	return null;
}

/**
 * The package name a specifier starts with, replaced by the name it is renamed
 * to, or the specifier unchanged when no rename names its package.
 *
 * A rename is matched on the whole package name and not on a prefix of it, so
 * renaming `ng-pick-datetime` does not touch `ng-pick-datetime-moment`.
 */
export function renamePackageInSpecifier(
	specifier: string,
	renames: Readonly<Record<string, string>>,
): string {
	for (const [from, to] of Object.entries(renames)) {
		if (specifier === from) return to;
		if (specifier.startsWith(`${from}/`)) return `${to}${specifier.slice(from.length)}`;
	}
	return specifier;
}

/**
 * Drop the webpack module prefix from every stylesheet at-rule whose
 * un-prefixed specifier the installed closure answers.
 *
 * `renames` carries package-name substitutions the caller has already
 * established — a successor fork the cell verified, say. They are applied to the
 * specifier *before* it is resolved, so a renamed specifier is un-prefixed only
 * when the closure carries the renamed path: the same check the capability
 * already performs, asked of the name that will actually be written.
 */
export function dropWebpackTildeSpecifiers(
	path: string,
	source: string,
	closure: ClosureFileReading,
	renames: Readonly<Record<string, string>> = {},
): TildeSpecifierMigration {
	const edits: SourceEdit[] = [];
	const changes: TildeSpecifierChange[] = [];
	const unhandled: string[] = [];
	for (const match of source.matchAll(TILDE_AT_RULE)) {
		const specifier = match.groups?.['specifier'];
		const offset = match.index;
		if (specifier === undefined || offset === undefined) continue;
		const line = lineOf(source, offset);
		const renamed = renamePackageInSpecifier(specifier, renames);
		const resolved = resolveInClosure(renamed, closure);
		if (resolved === null) {
			unhandled.push(
				`${path} line ${String(line)}: '${WEBPACK_MODULE_PREFIX}${specifier}' asks webpack to ` +
					`resolve ${renamed} as a module, and the installed closure carries no file sass ` +
					'would resolve it to. Dropping the prefix would move the failure rather than answer ' +
					'it, so the rule was left exactly as it is.',
			);
			continue;
		}
		const tilde = source.indexOf(WEBPACK_MODULE_PREFIX, offset);
		if (tilde < 0) continue;
		edits.push({
			start: tilde,
			end: tilde + WEBPACK_MODULE_PREFIX.length + specifier.length,
			text: renamed,
		});
		changes.push({
			kind: 'webpack-tilde-specifier',
			line,
			from: `${WEBPACK_MODULE_PREFIX}${specifier}`,
			to: renamed,
			resolved,
		});
	}
	const migrated = applySourceEdits(source, edits);
	return Object.freeze({
		path,
		source: migrated,
		changed: migrated !== source,
		changes: Object.freeze(changes),
		unhandled: Object.freeze([...new Set(unhandled)].sort(compareStrings)),
	});
}
