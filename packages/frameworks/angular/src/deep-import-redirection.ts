/**
 * Imports of a subpath the installed package does not publish.
 *
 * An era application often reaches past a package's public surface — `import
 * {X} from 'pkg/src/internal'` — because the era package had no `exports` map
 * and every file on disk was addressable. A package that later declares one
 * closes that door: the subpath is unreachable whatever is still on disk, and
 * the compiler reports a module it cannot find.
 *
 * This is the mirror image of {@link splitBarrelImports}. There a symbol was
 * reached one directory too shallow and had to move deeper; here it is reached
 * too deep and has to move out to whichever entry point the package actually
 * publishes it from. Both questions are answered by the same reading of the
 * installed closure — the package's own `exports` map, and the names each
 * published declaration file exports — so both share
 * {@link resolveBarrelSymbol} and neither carries a table.
 *
 * The reachable set is read, never inferred. A subpath the exports map names is
 * reachable even when this capability cannot type it (a `.js` or `.json` target
 * carries no declaration file), so an import of one is left alone rather than
 * redirected on the strength of a surface that was never consulted.
 *
 * Refusal is all-or-nothing per declaration, for the reason the barrel split
 * refuses: rewriting the symbols that do resolve would silently drop the one
 * that does not, turning a build error into missing behaviour.
 */

import { compareStrings } from './angular-target-cell.ts';
import { resolveBarrelSymbol, type PackageSurfaceReading } from './barrel-entry-point-split.ts';
import { applySourceEdits, lineOf, parseModule, type SourceEdit } from './semantic-module.ts';

const CAPABILITY = 'Deep import redirection';

/**
 * What the installed package publishes, and which specifiers it answers.
 *
 * `reachableSpecifiers` is every specifier the exports map resolves, including
 * the ones with no declaration file. It is deliberately wider than the typed
 * entry points in `surface`: this capability only ever acts on a specifier that
 * is in neither, so a subpath whose target it cannot read is still safe.
 */
export type DeepImportReading = Readonly<{
	surface: PackageSurfaceReading;
	reachableSpecifiers: readonly string[];
}>;

export type DeepImportChange = Readonly<{
	kind: 'deep-import-redirect';
	line: number;
	from: string;
	to: string;
	symbols: readonly string[];
}>;

export type DeepImportMigration = Readonly<{
	path: string;
	source: string;
	changed: boolean;
	changes: readonly DeepImportChange[];
	unhandled: readonly string[];
}>;

type ImportedSpecifier = Readonly<{ name: string; text: string }>;

/** Whether `specifier` addresses `name` — the package root or a subpath of it. */
function addresses(specifier: string, name: string): boolean {
	return specifier === name || specifier.startsWith(`${name}/`);
}

/**
 * Rewrite one module's imports of unreachable subpaths of a package onto the
 * entry points the installed package publishes the named symbols from.
 *
 * Each specifier keeps its own text — an alias, a per-specifier `type` modifier
 * — so the rewrite moves names between declarations without restating any of
 * them.
 */
export function redirectUnreachableImports(
	path: string,
	source: string,
	reading: DeepImportReading,
): DeepImportMigration {
	const { surface } = reading;
	const module = parseModule(CAPABILITY, path, source);
	const edits: SourceEdit[] = [];
	const changes: DeepImportChange[] = [];
	const unhandled: string[] = [];
	for (const declaration of module.ast.body) {
		if (declaration.type !== 'ImportDeclaration') continue;
		const specifier = declaration.source.value;
		if (typeof specifier !== 'string') continue;
		if (!addresses(specifier, surface.name)) continue;
		if (reading.reachableSpecifiers.includes(specifier)) continue;
		const line = lineOf(source, declaration.start);
		const named: ImportedSpecifier[] = [];
		let wide = false;
		for (const imported of declaration.specifiers) {
			if (imported.type !== 'ImportSpecifier' || imported.imported.type !== 'Identifier') {
				wide = true;
				continue;
			}
			named.push({
				name: imported.imported.name,
				text: source.slice(imported.start, imported.end),
			});
		}
		if (wide) {
			unhandled.push(
				`${path} line ${String(line)}: ${specifier} is not a subpath ` +
					`${surface.name}@${surface.version} publishes, and the declaration carries a default ` +
					'or namespace binding whose members cannot be resolved to an entry point by name, so ' +
					'it was left exactly as it is',
			);
			continue;
		}
		if (named.length === 0) {
			unhandled.push(
				`${path} line ${String(line)}: ${specifier} is not a subpath ` +
					`${surface.name}@${surface.version} publishes, and the declaration names no symbol — ` +
					'it is imported for its side effect, and nothing about the published surface says ' +
					'which entry point runs the same one, so it was left exactly as it is',
			);
			continue;
		}
		const groups = new Map<string, ImportedSpecifier[]>();
		const refusals: string[] = [];
		for (const entry of named) {
			const resolution = resolveBarrelSymbol(surface, entry.name);
			if (resolution.kind === 'unmapped' || resolution.kind === 'ambiguous') {
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
					`${path} line ${String(line)}: ${specifier} is unreachable and ${reason}. The whole ` +
						'declaration was left as it is: redirecting the symbols that do resolve would ' +
						'delete the one that does not.',
				);
			continue;
		}
		const quote = source.slice(declaration.source.start, declaration.source.start + 1);
		const prefix = declaration.importKind === 'type' ? 'import type' : 'import';
		const targets = [...groups.keys()].sort(compareStrings);
		const text = targets
			.map((target) => {
				const group = groups.get(target) ?? [];
				return `${prefix} {${group.map((entry) => entry.text).join(', ')}} from ${quote}${target}${quote};`;
			})
			.join('\n');
		let end = declaration.end;
		if (source[end] === ';') end += 1;
		edits.push({ start: declaration.start, end, text });
		changes.push({
			kind: 'deep-import-redirect',
			line,
			from: specifier,
			to: targets.join(', '),
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
