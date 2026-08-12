/**
 * A `url()` in an imported stylesheet partial, written relative to the entry
 * that imports it rather than to the partial itself.
 *
 * `@import` in Sass is textual: the partial's rules end up inside the entry
 * sheet, and a relative `url()` inside them is a string in the emitted CSS with
 * no record of which file wrote it. The era's pipeline resolved such a url
 * against the entry — the file the browser would have loaded the CSS as — and a
 * whole generation of stylesheets was written to that behaviour. The modern
 * pipeline runs `resolve-url-loader` with source maps on, which rebases each url
 * onto the *originating* partial's directory, so a url that was correct for the
 * entry now points somewhere no file exists and webpack stops the build with
 * `Can't resolve`.
 *
 * The successor is arithmetic, not judgement, and only when the arithmetic has
 * exactly one answer: the url must fail to resolve from the partial's own
 * directory, must resolve from the directory of the entry that imports it, and
 * every entry that imports the partial must resolve it to the *same* file. Then
 * the url is rewritten to that file expressed relative to the partial, which is
 * the spelling the rebasing pipeline turns back into the path the era pipeline
 * produced. A url that already resolves is left alone, a url no entry answers is
 * refused by name, and a partial reached from two entries that disagree is
 * refused rather than resolved in favour of one of them.
 *
 * Absolute urls, data urls, fragment-only urls and urls carrying a scheme are
 * not paths into the tree and are passed over untouched.
 */

import * as path from 'pathe';
import { applySourceEdits, lineOf, type SourceEdit } from './semantic-module.ts';

/** The questions this capability asks of the tree. */
export type StylesheetTreeReading = Readonly<{
	/** Does the tree carry this path, expressed from the tree root. */
	carries: (treePath: string) => boolean;
	/**
	 * The directories of the entry stylesheets that import this partial,
	 * expressed from the tree root. Empty means nothing imports it, and then
	 * there is no era behaviour to reproduce.
	 */
	entryDirectories: readonly string[];
}>;

export type UrlRebaseChange = Readonly<{
	kind: 'stylesheet-url-rebase';
	line: number;
	from: string;
	to: string;
	/** The file in the tree both spellings name. */
	resolved: string;
}>;

export type UrlRebaseMigration = Readonly<{
	path: string;
	source: string;
	changed: boolean;
	changes: readonly UrlRebaseChange[];
	unhandled: readonly string[];
}>;

const URL_FUNCTION = /url\(\s*(?<quote>['"]?)(?<target>[^'")]+)\k<quote>\s*\)/gu;

/** Is this url a path into the tree at all, rather than a scheme, data or fragment url. */
export function isTreeRelativeUrl(target: string): boolean {
	if (target === '') return false;
	if (target.startsWith('/') || target.startsWith('#')) return false;
	if (target.startsWith('data:') || /^[A-Za-z][\w+.-]*:/u.test(target)) return false;
	return true;
}

/** The url with any `?query` or `#fragment` suffix split off. */
export function splitUrlSuffix(target: string): Readonly<{ file: string; suffix: string }> {
	const cut = target.search(/[?#]/u);
	if (cut < 0) return Object.freeze({ file: target, suffix: '' });
	return Object.freeze({ file: target.slice(0, cut), suffix: target.slice(cut) });
}

/**
 * Rewrite every `url()` the modern pipeline would rebase onto a path that does
 * not exist, onto the file the era pipeline resolved it to.
 */
export function rebaseStylesheetUrls(
	stylesheet: string,
	source: string,
	reading: StylesheetTreeReading,
): UrlRebaseMigration {
	const partialDirectory = path.dirname(stylesheet);
	const edits: SourceEdit[] = [];
	const changes: UrlRebaseChange[] = [];
	const unhandled: string[] = [];
	for (const match of source.matchAll(URL_FUNCTION)) {
		const target = match.groups?.['target'];
		const offset = match.index;
		if (target === undefined || offset === undefined) continue;
		if (!isTreeRelativeUrl(target)) continue;
		const { file, suffix } = splitUrlSuffix(target);
		if (file === '') continue;
		const line = lineOf(source, offset);
		if (reading.carries(path.join(partialDirectory, file))) continue;
		if (reading.entryDirectories.length === 0) {
			unhandled.push(
				`${stylesheet} line ${String(line)}: url(${target}) does not resolve from this partial's ` +
					'own directory and no entry stylesheet was found that imports the partial, so there is ' +
					'no era resolution to reproduce and nothing was written.',
			);
			continue;
		}
		const resolved = [
			...new Set(
				reading.entryDirectories
					.map((directory) => path.join(directory, file))
					.filter((candidate) => reading.carries(candidate)),
			),
		];
		if (resolved.length === 0) {
			unhandled.push(
				`${stylesheet} line ${String(line)}: url(${target}) resolves neither from this partial nor ` +
					`from the ${String(reading.entryDirectories.length)} entry stylesheet directory(ies) that ` +
					'import it. The tree carries no file this url names, so rebasing it would move the ' +
					'failure rather than answer it.',
			);
			continue;
		}
		if (resolved.length > 1) {
			unhandled.push(
				`${stylesheet} line ${String(line)}: url(${target}) resolves to ${String(resolved.length)} ` +
					`different files depending on which entry imports this partial — ${resolved.join(', ')}. ` +
					'One spelling cannot name both, so nothing was written.',
			);
			continue;
		}
		const answer = resolved[0];
		if (answer === undefined) continue;
		const relative = path.relative(partialDirectory, answer);
		const written = relative.startsWith('.') ? relative : `./${relative}`;
		const start = source.indexOf(target, offset);
		if (start < 0) continue;
		edits.push({ start, end: start + target.length, text: `${written}${suffix}` });
		changes.push({
			kind: 'stylesheet-url-rebase',
			line,
			from: target,
			to: `${written}${suffix}`,
			resolved: answer,
		});
	}
	const migrated = applySourceEdits(source, edits);
	return Object.freeze({
		path: stylesheet,
		source: migrated,
		changed: migrated !== source,
		changes: Object.freeze(changes),
		unhandled: Object.freeze(unhandled),
	});
}
