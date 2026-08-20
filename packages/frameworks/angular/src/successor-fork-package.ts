/**
 * Imports of a package whose maintained continuation is published under another
 * name.
 *
 * A package that stopped publishing is usually the end of the story: the cell
 * declares `no-successor`, the dependency is dropped, and the modules that
 * imported it are left for a source answer. Sometimes it is not the end. The
 * source tree carried on under a different package name, and every module that
 * names the old one needs the same one-word edit.
 *
 * That edit is small and the reason to refuse it is large, so this capability
 * asks for two independent readings before it writes anything:
 *
 * - the lineage, which the cell carries and verifies — the forge's own answer to
 *   what the successor repository was forked from, checked against the
 *   repository the era package declares (see `verifyForkLineage`), and
 * - the successor's published surface, read from the installed closure, which
 *   has to export every name the module actually imports.
 *
 * Either reading failing is a refusal by name, and both refusals matter for the
 * same reason: a rename onto a package that is not the same source tree, or
 * onto one that no longer publishes the symbol a module names, produces a
 * workspace whose failure has moved somewhere harder to read.
 *
 * Nothing here knows which package it is looking at. The specifier rename is the
 * same shape the zone.js and RxJS-5 tables already perform; what is different is
 * that the pair of names comes from a verified reading rather than a table of
 * framework facts.
 */

import {
	compareStrings,
	verifyForkLineage,
	type SuccessorForkPackage,
} from './angular-target-cell.ts';
import { applySourceEdits, lineOf, parseModule, type SourceEdit } from './semantic-module.ts';

const CAPABILITY = 'Successor fork package';

/**
 * The successor's published root surface, as read from the installed closure.
 *
 * `complete` is the reading's own statement about itself. A declaration file
 * that re-exports whole modules is only enumerable if every one of those was
 * followed; a reader that could not follow one says so here, and this capability
 * refuses rather than treating an unread name as an absent one.
 */
export type SuccessorSurfaceReading = Readonly<{
	/** The successor package name, as the closure carries it. */
	name: string;
	/** The installed version, for the record. */
	version: string;
	/** Every name the successor's root entry point exports. */
	rootExports: readonly string[];
	/** Whether the export list above is the whole of the root surface. */
	complete: boolean;
	/** Why the reading is incomplete, when it is. */
	incompleteReason?: string;
}>;

/** One era package name, the cell's disposition for it, and the closure reading. */
export type SuccessorForkReading = Readonly<{
	/** The package name the application's source still imports. */
	name: string;
	disposition: SuccessorForkPackage;
	surface: SuccessorSurfaceReading;
}>;

export type SuccessorForkChange = Readonly<{
	kind: 'successor-fork-specifier';
	line: number;
	from: string;
	to: string;
	/** The names the declaration imports, every one of them measured. */
	symbols: readonly string[];
}>;

export type SuccessorForkMigration = Readonly<{
	path: string;
	source: string;
	changed: boolean;
	changes: readonly SuccessorForkChange[];
	unhandled: readonly string[];
}>;

/**
 * Rewrite one module's imports of the era package onto its verified successor.
 *
 * The refusal is per declaration and total. A declaration naming five symbols of
 * which four are on the successor's surface is left exactly as it is, because a
 * rewrite that carried four across would turn one honest "this package does not
 * resolve" into a quieter "this symbol does not exist" four files away.
 */
export function migrateSuccessorForkImports(
	path: string,
	source: string,
	fork: SuccessorForkReading,
): SuccessorForkMigration {
	const unchanged = Object.freeze({
		path,
		source,
		changed: false,
		changes: Object.freeze([]),
		unhandled: Object.freeze([]),
	});
	if (!source.includes(fork.name)) return unchanged;
	const module = parseModule(CAPABILITY, path, source);
	const edits: SourceEdit[] = [];
	const changes: SuccessorForkChange[] = [];
	const unhandled: string[] = [];
	const successor = fork.disposition.successor;
	const verdict = verifyForkLineage(fork.name, fork.disposition);
	for (const declaration of module.ast.body) {
		if (
			declaration.type !== 'ImportDeclaration' &&
			declaration.type !== 'ExportNamedDeclaration' &&
			declaration.type !== 'ExportAllDeclaration'
		)
			continue;
		const literal = declaration.source;
		if (literal === null || literal === undefined || typeof literal.value !== 'string')
			continue;
		if (literal.value !== fork.name && !literal.value.startsWith(`${fork.name}/`)) continue;
		const line = lineOf(source, declaration.start);
		if (!verdict.verified) {
			unhandled.push(
				`${path} line ${String(line)}: ${literal.value} is dispositioned as succeeded by ` +
					`${successor}, and the rename was refused: ${verdict.reason}.`,
			);
			continue;
		}
		if (literal.value !== fork.name) {
			unhandled.push(
				`${path} line ${String(line)}: ${literal.value} names a subpath of ${fork.name}, and ` +
					`what ${successor} publishes under that subpath is not something this reading of its ` +
					'root surface answers. The declaration was left exactly as it is.',
			);
			continue;
		}
		if (!fork.surface.complete) {
			unhandled.push(
				`${path} line ${String(line)}: the published surface of ${fork.surface.name}@` +
					`${fork.surface.version} could not be read in full` +
					(fork.surface.incompleteReason === undefined
						? ''
						: ` (${fork.surface.incompleteReason})`) +
					', so a name missing from it cannot be told from a name that was never read. The ' +
					'declaration was left exactly as it is.',
			);
			continue;
		}
		const named: string[] = [];
		let wide = declaration.type === 'ExportAllDeclaration';
		for (const specifier of declaration.type === 'ExportAllDeclaration'
			? []
			: declaration.specifiers) {
			if (specifier.type === 'ImportSpecifier' && specifier.imported.type === 'Identifier') {
				named.push(specifier.imported.name);
				continue;
			}
			if (specifier.type === 'ExportSpecifier' && specifier.local.type === 'Identifier') {
				named.push(specifier.local.name);
				continue;
			}
			wide = true;
		}
		if (wide || declaration.type === 'ExportAllDeclaration') {
			unhandled.push(
				`${path} line ${String(line)}: the declaration reaches ${fork.name} through a default, ` +
					'namespace or star binding, whose members cannot be measured against the successor ' +
					`surface by name. Whether ${successor} carries them is therefore unestablished, and ` +
					'the declaration was left exactly as it is.',
			);
			continue;
		}
		const missing = named.filter((symbol) => !fork.surface.rootExports.includes(symbol));
		if (missing.length > 0) {
			unhandled.push(
				`${path} line ${String(line)}: ${fork.surface.name}@${fork.surface.version} exports no ` +
					`${missing.sort(compareStrings).join(', ')} from its root entry point, so it does not ` +
					`carry the whole of what this module imports from ${fork.name}. A rename here would ` +
					'move the failure rather than answer it, so the declaration was left exactly as it is.',
			);
			continue;
		}
		const quote = source.slice(literal.start, literal.start + 1);
		edits.push({
			start: literal.start,
			end: literal.end,
			text: `${quote}${successor}${quote}`,
		});
		changes.push({
			kind: 'successor-fork-specifier',
			line,
			from: fork.name,
			to: successor,
			symbols: Object.freeze([...named].sort(compareStrings)),
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
