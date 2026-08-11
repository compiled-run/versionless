/**
 * Imports of a package barrel that the installed package no longer answers.
 *
 * A library that once published every symbol from its package root and later
 * moved to one secondary entry point per component leaves an application's
 * barrel import resolving to a package that exports almost nothing. The
 * diagnostic is not a missing package and not a renamed symbol: the symbols are
 * all still published, one directory deeper each, and the import has to be split
 * into the entry points that own them.
 *
 * The split is a reading of the installed closure, never a table:
 *
 * - the entry points are the subpaths the package's own `exports` map names,
 * - each entry point's surface is the set of names its published declaration
 *   file exports, parsed rather than assumed,
 * - a symbol is mapped only when exactly one entry point at the shallowest
 *   depth that carries it exports it, and
 * - a symbol no entry point exports is refused by name.
 *
 * Nothing here knows which library it is looking at. A package that kept its
 * barrel exports the symbols from the root entry point, the root wins, and this
 * capability reports that there is nothing to split.
 *
 * The refusal is all-or-nothing per import declaration. A declaration that names
 * ten symbols of which nine map is left exactly as it is, because a rewrite that
 * dropped the tenth would turn one honest diagnostic into a silent deletion.
 */

import { compareStrings } from './angular-target-cell.ts';
import { applySourceEdits, lineOf, parseModule, type SourceEdit } from './semantic-module.ts';

const CAPABILITY = 'Barrel entry point split';

/** An exports-map subpath without its leading `./`. */
function stripDotSlash(subpath: string): string {
	return subpath.startsWith('./') ? subpath.slice(2) : subpath;
}

/** One published entry point of a package, as read from the installed closure. */
export type EntryPointSurface = Readonly<{
	/** The exports-map subpath, `'.'` for the package root. */
	subpath: string;
	/** The specifier an importer writes to reach it. */
	specifier: string;
	/** Every name the entry point's declaration file exports. */
	exports: readonly string[];
	/**
	 * Whether the declaration file re-exports a whole module (`export *`). A
	 * surface with one of those is not fully enumerable from the file alone, so a
	 * symbol is never mapped *into* it and the incompleteness is reported.
	 */
	opaque: boolean;
}>;

/** A package's published entry points, as read from the installed closure. */
export type PackageSurfaceReading = Readonly<{
	name: string;
	version: string;
	entryPoints: readonly EntryPointSurface[];
}>;

export type BarrelSymbolResolution =
	| Readonly<{ kind: 'root'; specifier: string }>
	| Readonly<{ kind: 'entry-point'; specifier: string }>
	| Readonly<{ kind: 'unmapped'; reason: string }>
	| Readonly<{ kind: 'ambiguous'; reason: string }>;

export type BarrelSplitChange = Readonly<{
	kind: 'barrel-split';
	line: number;
	from: string;
	to: string;
	symbols: readonly string[];
}>;

export type BarrelSplitMigration = Readonly<{
	path: string;
	source: string;
	changed: boolean;
	changes: readonly BarrelSplitChange[];
	unhandled: readonly string[];
}>;

/**
 * The names one entry point's declaration file exports.
 *
 * The declaration is parsed, not scanned: `export declare class X`,
 * `export { X }`, `export { X as Y }` and `export type X` all reach the same
 * record, and a name that only appears inside an import or a comment reaches
 * none of them. A declaration that does not parse is a hard failure naming the
 * entry point rather than an entry point silently read as exporting nothing.
 */
export function readEntryPointSurface(
	packageName: string,
	subpath: string,
	declaration: string,
): EntryPointSurface {
	const relative = subpath === '.' ? '' : `/${stripDotSlash(subpath)}`;
	const specifier = `${packageName}${relative}`;
	const module = parseModule(CAPABILITY, `${specifier}/index.d.ts`, declaration);
	const exports: string[] = [];
	let opaque = false;
	for (const record of module.exports) {
		if (record.isStar) {
			opaque = true;
			continue;
		}
		if (record.name === null || record.name === 'default') continue;
		if (!exports.includes(record.name)) exports.push(record.name);
	}
	return Object.freeze({
		subpath,
		specifier,
		exports: Object.freeze([...exports].sort(compareStrings)),
		opaque,
	});
}

/** The depth of an exports-map subpath: `'.'` is 0, `'./button'` is 1. */
function depthOf(subpath: string): number {
	return subpath === '.' ? 0 : stripDotSlash(subpath).split('/').length;
}

/**
 * Where the installed package publishes `symbol`.
 *
 * The root entry point wins whenever it still exports the symbol: a barrel that
 * kept a name is not a barrel this capability splits. Otherwise the shallowest
 * entry point that exports it wins, and a tie at that depth is an ambiguity the
 * capability refuses rather than breaks — two entry points publishing the same
 * name are two different symbols as often as they are one.
 */
export function resolveBarrelSymbol(
	reading: PackageSurfaceReading,
	symbol: string,
): BarrelSymbolResolution {
	const carriers = reading.entryPoints.filter(
		(entry) => !entry.opaque && entry.exports.includes(symbol),
	);
	const root = carriers.find((entry) => entry.subpath === '.');
	if (root !== undefined) return Object.freeze({ kind: 'root', specifier: root.specifier });
	if (carriers.length === 0)
		return Object.freeze({
			kind: 'unmapped',
			reason:
				`${reading.name}@${reading.version} publishes no entry point that exports ` +
				`${symbol}: the installed surface was read and the name is not on it`,
		});
	const shallowest = Math.min(...carriers.map((entry) => depthOf(entry.subpath)));
	const best = carriers.filter((entry) => depthOf(entry.subpath) === shallowest);
	const first = best[0];
	if (first === undefined || best.length > 1)
		return Object.freeze({
			kind: 'ambiguous',
			reason:
				`${reading.name}@${reading.version} exports ${symbol} from ` +
				`${best.map((entry) => entry.specifier).join(' and ')}, so which entry point owns it ` +
				'is not a question the installed surface answers',
		});
	return Object.freeze({ kind: 'entry-point', specifier: first.specifier });
}

type ImportedSpecifier = Readonly<{ name: string; text: string }>;

/**
 * Split one module's imports of a package barrel into the entry points the
 * installed package publishes the named symbols from.
 *
 * Each rewritten declaration keeps its specifiers' own text — an alias, a
 * per-specifier `type` modifier — so the rewrite moves names between
 * declarations without restating what any of them said.
 */
export function splitBarrelImports(
	path: string,
	source: string,
	reading: PackageSurfaceReading,
): BarrelSplitMigration {
	const module = parseModule(CAPABILITY, path, source);
	const edits: SourceEdit[] = [];
	const changes: BarrelSplitChange[] = [];
	const unhandled: string[] = [];
	for (const declaration of module.ast.body) {
		if (declaration.type !== 'ImportDeclaration') continue;
		if (declaration.source.value !== reading.name) continue;
		const line = lineOf(source, declaration.start);
		const named: ImportedSpecifier[] = [];
		let wide = false;
		for (const specifier of declaration.specifiers) {
			if (specifier.type !== 'ImportSpecifier' || specifier.imported.type !== 'Identifier') {
				wide = true;
				continue;
			}
			named.push({
				name: specifier.imported.name,
				text: source.slice(specifier.start, specifier.end),
			});
		}
		if (wide) {
			unhandled.push(
				`${path} line ${String(line)}: the import of ${reading.name} carries a default or ` +
					'namespace binding, whose members cannot be resolved to entry points by name, so the ' +
					'declaration was left exactly as it is',
			);
			continue;
		}
		if (named.length === 0) continue;
		const groups = new Map<string, ImportedSpecifier[]>();
		const refusals: string[] = [];
		let rootHeld = false;
		for (const entry of named) {
			const resolution = resolveBarrelSymbol(reading, entry.name);
			if (resolution.kind === 'root') {
				rootHeld = true;
				continue;
			}
			if (resolution.kind !== 'entry-point') {
				refusals.push(resolution.reason);
				continue;
			}
			const group = groups.get(resolution.specifier);
			if (group === undefined) groups.set(resolution.specifier, [entry]);
			else group.push(entry);
		}
		if (refusals.length > 0) {
			for (const reason of refusals)
				unhandled.push(
					`${path} line ${String(line)}: ${reason}. The whole declaration was left as it is: ` +
						'splitting the symbols that do map would delete the one that does not.',
				);
			continue;
		}
		if (groups.size === 0) continue;
		if (rootHeld) {
			unhandled.push(
				`${path} line ${String(line)}: ${reading.name}@${reading.version} still exports some of ` +
					'the names this declaration imports from its root and publishes the others from ' +
					'secondary entry points. A split that left a root import behind is a shape this ' +
					'capability does not write, so the declaration was left as it is.',
			);
			continue;
		}
		const quote = source.slice(declaration.source.start, declaration.source.start + 1);
		const prefix = declaration.importKind === 'type' ? 'import type' : 'import';
		const specifiers = [...groups.keys()].sort(compareStrings);
		const text = specifiers
			.map((specifier) => {
				const group = groups.get(specifier) ?? [];
				const names = group.map((entry) => entry.text).join(', ');
				return `${prefix} {${names}} from ${quote}${specifier}${quote};`;
			})
			.join('\n');
		let end = declaration.end;
		if (source[end] === ';') end += 1;
		edits.push({ start: declaration.start, end, text });
		changes.push({
			kind: 'barrel-split',
			line,
			from: reading.name,
			to: specifiers.join(', '),
			symbols: Object.freeze(named.map((entry) => entry.name).sort(compareStrings)),
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
