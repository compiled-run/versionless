/**
 * Stylesheet imports a package's `exports` map no longer resolves.
 *
 * A package that adds an `exports` field stops being a directory and becomes a
 * declared surface: every subpath it does not name is unreachable, whatever the
 * bytes on disk are. Libraries that publish per-component stylesheets alongside
 * whole-library aggregates routinely name the component subpaths and not the
 * root one, so an application that imported the root entry finds exactly that
 * one import blocked while its neighbours keep resolving.
 *
 * There is no narrow successor for a blocked root entry. The package exports an
 * aggregate — the whole library's stylesheet — or it exports nothing this
 * capability can put in the blocked import's place, and in that second case it
 * refuses and leaves the import exactly as it is.
 *
 * When an aggregate does exist, the rewrite is a substitution, not a repair:
 *
 * ```scss
 * ⁠@import 'pkg/style/index.min.css';          ⁠@import 'pkg/pkg.min.css';
 * ⁠@import 'pkg/tooltip/style/index.min.css';
 * ⁠@import 'pkg/modal/style/index.min.css';    ->
 * ```
 *
 * The aggregate contains every component stylesheet, so the granular imports of
 * the same package become redundant and are removed — each removal recorded by
 * name. The migrated application therefore ships the package's entire
 * stylesheet where it previously shipped a chosen subset. That is a payload
 * change, and it is reported through the changeset's declared-differences
 * channel with the byte counts named whenever the closure was measured, because
 * a substitution that quietly multiplies a CSS payload is exactly the kind of
 * difference a clean-looking changeset would otherwise hide. Parity carries it
 * as a non-claim; a witness arbitrates whether the application still looks and
 * behaves as it did.
 */

import { charIn, charNotIn, createRegExp, exactly, global, maybe, oneOrMore } from 'magic-regexp';
import { compareStrings } from './angular-target-cell.ts';
import { lineOf, applySourceEdits, type SourceEdit } from './semantic-module.ts';

/**
 * The export conditions a stylesheet import is resolved under. `style` is the
 * condition a CSS consumer sets; `default` is the unconditional fallback every
 * exports map may carry.
 */
export const STYLE_EXPORT_CONDITIONS: readonly string[] = Object.freeze(['style', 'default']);

/** A package's published surface, as read from the installed closure. */
export type PackageExportsReading = Readonly<{
	name: string;
	version: string;
	/** The `exports` field exactly as the package published it. */
	exports: unknown;
	/**
	 * Byte size per package-relative file path, when the closure was measured.
	 * Supplying it is what lets the payload change be named in bytes rather than
	 * in words; omitting it costs the numbers, not the report.
	 */
	fileSizes?: Readonly<Record<string, number>>;
}>;

export type StyleImportChange = Readonly<{
	kind: 'style-import-aggregate' | 'style-import-redundant';
	line: number;
	from: string;
	to: string;
}>;

export type StyleImportMigration = Readonly<{
	path: string;
	source: string;
	changed: boolean;
	changes: readonly StyleImportChange[];
	declaredDifferences: readonly string[];
	unhandled: readonly string[];
}>;

const STYLE_IMPORT = createRegExp(
	exactly('@import')
		.and(oneOrMore(charIn(' \t')))
		.and(charIn('\'"'))
		.and(oneOrMore(charNotIn('\'"\n')).as('specifier'))
		.and(charIn('\'"'))
		.and(maybe(oneOrMore(charIn(' \t'))))
		.and(maybe(exactly(';'))),
	[global],
);

type ExportsObject = Readonly<Record<string, unknown>>;

function asObject(value: unknown): ExportsObject | null {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as ExportsObject)
		: null;
}

/**
 * Resolve one target of an exports map under a condition list. A string is the
 * target; an object is a condition map, taken in declaration order; an array is
 * a fallback list, taken left to right; `null` is an explicit block.
 */
function resolveTarget(
	target: unknown,
	conditions: readonly string[],
	star: string | null,
): string | null {
	if (typeof target === 'string')
		return star === null ? target : target.split('*').join(star);
	if (Array.isArray(target)) {
		for (const entry of target as readonly unknown[]) {
			const resolved = resolveTarget(entry, conditions, star);
			if (resolved !== null) return resolved;
		}
		return null;
	}
	const object = asObject(target);
	if (object === null) return null;
	for (const [condition, value] of Object.entries(object)) {
		if (condition !== 'default' && !conditions.includes(condition)) continue;
		const resolved = resolveTarget(value, conditions, star);
		if (resolved !== null) return resolved;
	}
	return null;
}

/**
 * The file a package's `exports` field resolves `subpath` to under
 * `conditions`, or null when the map does not expose it at all. Exact keys win
 * over patterns, and among patterns the longest literal prefix wins — the
 * resolution algorithm the runtime itself uses.
 */
export function resolvePackageExport(
	exportsField: unknown,
	subpath: string,
	conditions: readonly string[] = STYLE_EXPORT_CONDITIONS,
): string | null {
	if (exportsField === undefined || exportsField === null) return null;
	if (typeof exportsField === 'string' || Array.isArray(exportsField))
		return subpath === '.' ? resolveTarget(exportsField, conditions, null) : null;
	const map = asObject(exportsField);
	if (map === null) return null;
	const keys = Object.keys(map);
	const isSubpathMap = keys.length > 0 && keys.every((key) => key.startsWith('.'));
	if (!isSubpathMap) return subpath === '.' ? resolveTarget(map, conditions, null) : null;
	if (subpath in map) return resolveTarget(map[subpath], conditions, null);
	let bestPrefix: string | null = null;
	let bestStar: string | null = null;
	for (const key of keys) {
		const starIndex = key.indexOf('*');
		if (starIndex < 0) continue;
		const prefix = key.slice(0, starIndex);
		const suffix = key.slice(starIndex + 1);
		if (suffix.includes('*')) continue;
		if (!subpath.startsWith(prefix) || !subpath.endsWith(suffix)) continue;
		if (subpath.length < prefix.length + suffix.length) continue;
		if (bestPrefix !== null && prefix.length <= bestPrefix.length) continue;
		bestPrefix = key;
		bestStar = subpath.slice(prefix.length, subpath.length - suffix.length);
	}
	if (bestPrefix === null) return null;
	return resolveTarget(map[bestPrefix], conditions, bestStar);
}

/** The package a stylesheet specifier names, and the subpath it asks that package for. */
function splitSpecifier(specifier: string): Readonly<{ name: string; subpath: string }> | null {
	if (specifier === '' || specifier.startsWith('.') || specifier.startsWith('/')) return null;
	if (specifier.includes(':')) return null;
	const trimmed = specifier.startsWith('~') ? specifier.slice(1) : specifier;
	const segments = trimmed.split('/');
	const first = segments[0];
	if (first === undefined || first === '') return null;
	const consumed = first.startsWith('@') ? 2 : 1;
	const name = segments.slice(0, consumed).join('/');
	if (consumed === 2 && (segments[1] === undefined || segments[1] === '')) return null;
	const rest = segments.slice(consumed).join('/');
	return Object.freeze({ name, subpath: rest === '' ? '.' : `./${rest}` });
}

/**
 * The extension chain of a subpath's file name: everything from its first dot.
 * `./style/index.min.css` carries `.min.css`, and a minified entry is replaced
 * by a minified aggregate rather than silently by an unminified one.
 */
function extensionChainOf(subpath: string): string | null {
	const fileName = subpath.slice(subpath.lastIndexOf('/') + 1);
	const dot = fileName.indexOf('.');
	return dot <= 0 ? null : fileName.slice(dot);
}

/**
 * The package's exported root aggregate stylesheet for a blocked import, or
 * null when it publishes none.
 *
 * The aggregate is identified mechanically and not by a list: it is the exports
 * key that sits at the package root, is spelled with the package's own
 * unscoped name, carries the same extension chain the blocked import asked for,
 * and resolves under the style conditions. A themed or otherwise qualified
 * sibling — one whose stem is the package name plus something else — is a
 * different stylesheet, not the aggregate, and is never substituted.
 */
export function rootAggregateStylesheet(
	reading: PackageExportsReading,
	blockedSubpath: string,
): Readonly<{ subpath: string; file: string }> | null {
	const extension = extensionChainOf(blockedSubpath);
	if (extension === null) return null;
	const unscoped = reading.name.slice(reading.name.lastIndexOf('/') + 1);
	const subpath = `./${unscoped}${extension}`;
	const map = asObject(reading.exports);
	if (map === null || !(subpath in map)) return null;
	const file = resolvePackageExport(reading.exports, subpath, STYLE_EXPORT_CONDITIONS);
	return file === null ? null : Object.freeze({ subpath, file });
}

type Site = Readonly<{
	start: number;
	end: number;
	specifier: string;
	specifierStart: number;
	subpath: string;
	line: number;
	resolved: string | null;
}>;

function packageRelative(subpath: string): string {
	return subpath.startsWith('./') ? subpath.slice(2) : subpath;
}

function sizeOf(reading: PackageExportsReading, file: string | null): number | null {
	if (file === null) return null;
	const sizes = reading.fileSizes;
	if (sizes === undefined) return null;
	const size = sizes[packageRelative(file)];
	return typeof size === 'number' ? size : null;
}

/**
 * Rewrite one stylesheet's imports of a package whose exports map blocks them.
 *
 * A stylesheet with no import of the package, or whose every import of it
 * resolves, is returned byte-identical and reports nothing: an exports map that
 * still exposes what the application asked for is not this capability's
 * business.
 */
export function migratePackageStyleImports(
	path: string,
	source: string,
	reading: PackageExportsReading,
): StyleImportMigration {
	const unchanged = (unhandled: readonly string[] = []): StyleImportMigration =>
		Object.freeze({
			path,
			source,
			changed: false,
			changes: Object.freeze([]),
			declaredDifferences: Object.freeze([]),
			unhandled: Object.freeze([...new Set(unhandled)].sort(compareStrings)),
		});
	const sites: Site[] = [];
	for (const match of source.matchAll(STYLE_IMPORT)) {
		const specifier = match.groups?.['specifier'];
		const start = match.index;
		const matched = match[0];
		if (specifier === undefined || start === undefined || matched === undefined) continue;
		const split = splitSpecifier(specifier);
		if (split === null || split.name !== reading.name) continue;
		sites.push(
			Object.freeze({
				start,
				end: start + matched.length,
				specifier,
				specifierStart: source.indexOf(specifier, start),
				subpath: split.subpath,
				line: lineOf(source, start),
				resolved: resolvePackageExport(reading.exports, split.subpath, STYLE_EXPORT_CONDITIONS),
			}),
		);
	}
	if (sites.length === 0) return unchanged();
	const blocked = sites.filter((site) => site.resolved === null);
	if (blocked.length === 0) return unchanged();
	const first = blocked[0] as Site;
	const aggregate = rootAggregateStylesheet(reading, first.subpath);
	if (aggregate === null)
		return unchanged(
			blocked.map(
				(site) =>
					`${path} line ${site.line}: ${reading.name}@${reading.version} does not expose ` +
					`${site.subpath} through its exports map and publishes no root aggregate stylesheet ` +
					'to put in its place, so the import was left exactly as it is',
			),
		);
	const aggregateSpecifier = `${reading.name}/${packageRelative(aggregate.subpath)}`;
	const edits: SourceEdit[] = [
		{
			start: first.specifierStart,
			end: first.specifierStart + first.specifier.length,
			text: aggregateSpecifier,
		},
	];
	const changes: StyleImportChange[] = [
		{
			kind: 'style-import-aggregate',
			line: first.line,
			from: first.specifier,
			to: aggregateSpecifier,
		},
	];
	const removed = sites.filter((site) => site !== first);
	for (const site of removed) {
		let end = site.end;
		while (source[end] === ' ' || source[end] === '\t') end += 1;
		if (source[end] === '\r') end += 1;
		if (source[end] === '\n') end += 1;
		edits.push({ start: site.start, end, text: '' });
		changes.push({
			kind: 'style-import-redundant',
			line: site.line,
			from: site.specifier,
			to: aggregateSpecifier,
		});
	}
	const aggregateBytes = sizeOf(reading, aggregate.file);
	const replacedBytes = [first, ...removed].reduce<number | null>((total, site) => {
		if (total === null) return null;
		const size = sizeOf(reading, site.resolved ?? site.subpath);
		return size === null ? null : total + size;
	}, 0);
	const payload =
		aggregateBytes === null || replacedBytes === null
			? 'The migrated application ships the package\'s whole stylesheet where it previously ' +
				'shipped the subset it named; the closure was not measured, so the change is not ' +
				'stated in bytes here.'
			: `The migrated application ships ${aggregateBytes} bytes of stylesheet where it ` +
				`previously shipped ${replacedBytes}.`;
	const declaredDifferences: string[] = [
		`${path}: ${sites.length} ${reading.name} stylesheet import(s) were replaced by the single ` +
			`exported aggregate ${aggregateSpecifier}, because ${reading.name}@${reading.version} ` +
			`does not expose ${first.subpath} through its exports map and publishes no narrower ` +
			`equivalent. ${payload} This changeset makes no claim that the application renders as it ` +
			'did; a witness arbitrates that.',
	];
	for (const site of removed)
		declaredDifferences.push(
			`${path} line ${site.line}: the granular import ${site.specifier} was removed. It is ` +
				`contained in the aggregate ${aggregateSpecifier} that replaced the blocked root ` +
				'import, so keeping it would import the same rules twice.',
		);
	const migrated = applySourceEdits(source, edits);
	return Object.freeze({
		path,
		source: migrated,
		changed: migrated !== source,
		changes: Object.freeze(changes),
		declaredDifferences: Object.freeze(declaredDifferences),
		unhandled: Object.freeze([]),
	});
}
