/**
 * An exported name a package renamed, applied where the compiler itself
 * resolved the successor.
 *
 * A library that renames an export leaves an application importing a name the
 * new package does not have. Some of those names were deleted and some were
 * renamed, and the two are indistinguishable from the import site: `ChartsModule`
 * and `Label` are both "not exported" by the installed package, and only one of
 * them has a successor. Guessing the difference from spelling is how a migration
 * writes a name nobody published.
 *
 * So this capability does not guess it. TypeScript already computes the answer:
 * `'"ng2-charts"' has no exported member named 'ChartsModule'. Did you mean
 * 'NgChartsModule'?` is TS2724, and the suggestion in it is the compiler's own
 * resolution against the installed declaration files — the same reading the
 * build will do. A name the compiler offers no successor for is reported as
 * TS2305 with no suggestion, and this capability never sees it. That is the
 * whole separation, and it is drawn by the type checker rather than by a table.
 *
 * The suggestion is then checked rather than trusted: the successor has to be on
 * the installed package's measured export surface and the name being replaced
 * has to be absent from it, or the rename is refused by name. A compiler
 * suggestion is a claim about a tree; the surface reading is the tree.
 *
 * The rewrite is a binding rename, not a text substitution. An import written
 * with an alias has only its exported name replaced, because the local name is
 * the application's and not the package's. An import written without one has its
 * exported name *and* every resolved reference to its binding replaced, so the
 * module still compiles — and only when the successor name is free in the
 * module's root scope, because a rename that collided with an existing
 * declaration would silently change which symbol the references mean.
 */

import { charNotIn, createRegExp, digit, exactly, oneOrMore } from 'magic-regexp';
import { compareStrings } from './angular-target-cell.ts';
import {
	applySourceEdits,
	importDeclarationOf,
	isFreeRootName,
	lineOf,
	offsetOfPosition,
	parseModule,
	type AstNode,
	type SemanticModule,
	type SourceEdit,
} from './semantic-module.ts';

const CAPABILITY = 'Suggested export rename';

/**
 * One compiler diagnostic naming an import of a renamed export: TypeScript's
 * `'"pkg"' has no exported member named 'X'. Did you mean 'Y'?`, decomposed.
 * `line` and `column` are the compiler's own 1-based pair, pointing at the
 * imported name.
 */
export type SuggestedExportRenameDiagnostic = Readonly<{
	line: number;
	column: number;
	/** The name the module imports, which the installed package does not export. */
	imported: string;
	/** The name the compiler resolved as its successor. */
	suggested: string;
}>;

/**
 * One installed package's export surface, read from the closure. `complete` is
 * false when the reading could not follow everything the declaration re-exports;
 * an incomplete surface can prove a name absent from nothing, so it refuses.
 */
export type ExportSurfaceReading = Readonly<{
	name: string;
	version: string;
	exports: readonly string[];
	complete: boolean;
}>;

export type SuggestedExportRenameChange = Readonly<{
	kind: 'suggested-export-rename';
	line: number;
	specifier: string;
	from: string;
	to: string;
	/** How many resolved references to the binding were renamed beside the import. */
	references: number;
}>;

export type SuggestedExportRenameMigration = Readonly<{
	path: string;
	source: string;
	changed: boolean;
	changes: readonly SuggestedExportRenameChange[];
	unhandled: readonly string[];
}>;

/**
 * The package a module specifier names: its first segment, or its first two when
 * the specifier is scoped. A subpath import of `@angular/material/dialog` is the
 * package `@angular/material`, whose surface is a different reading — so a
 * subpath is refused rather than measured against the root.
 */
export function packageOfSpecifier(specifier: string): string {
	const segments = specifier.split('/');
	if (specifier.startsWith('@')) return segments.slice(0, 2).join('/');
	return segments[0] ?? specifier;
}

/** Whether a specifier names a package root rather than a subpath beneath one. */
export function isPackageRootSpecifier(specifier: string): boolean {
	if (specifier.startsWith('.')) return false;
	return specifier === packageOfSpecifier(specifier);
}

/** The estree shape of a named import specifier, narrowed out of the node union. */
type ImportSpecifierNode = Extract<AstNode, { type: 'ImportSpecifier' }>;

function importSpecifierAt(module: SemanticModule, offset: number): ImportSpecifierNode | null {
	for (const record of module.imports) {
		const node = record.node;
		if (node.type !== 'ImportSpecifier') continue;
		const imported = node.imported;
		if (imported.type !== 'Identifier') continue;
		if (imported.start <= offset && offset < imported.end) return node;
	}
	return null;
}

/**
 * Apply the compiler's own export renames to one module.
 *
 * Every diagnostic is answered or refused on its own; a refusal leaves that
 * import exactly as it is and does not stop the others, because two renames in
 * one module are two independent facts about two packages.
 */
export function applySuggestedExportRenames(
	path: string,
	source: string,
	diagnostics: readonly SuggestedExportRenameDiagnostic[],
	surfaces: readonly ExportSurfaceReading[],
): SuggestedExportRenameMigration {
	const module = parseModule(CAPABILITY, path, source);
	const byName = new Map(surfaces.map((surface) => [surface.name, surface]));
	const edits: SourceEdit[] = [];
	const changes: SuggestedExportRenameChange[] = [];
	const unhandled: string[] = [];
	const refuse = (line: number, reason: string): void => {
		unhandled.push(`${path} line ${String(line)}: ${reason}`);
	};
	for (const diagnostic of diagnostics) {
		const { line, column, imported, suggested } = diagnostic;
		const offset = offsetOfPosition(source, line, column);
		if (offset === null) {
			refuse(line, `column ${String(column)} is not a position in this file`);
			continue;
		}
		const specifierNode = importSpecifierAt(module, offset);
		if (specifierNode === null) {
			refuse(
				line,
				`column ${String(column)} is not the exported name of an import specifier, so the ` +
					`${imported} the compiler named cannot be placed`,
			);
			continue;
		}
		const importedNode = specifierNode.imported;
		if (importedNode.type !== 'Identifier' || importedNode.name !== imported) {
			refuse(
				line,
				`the compiler named ${imported} and the import at that position is not that name`,
			);
			continue;
		}
		const declaration = importDeclarationOf(module, specifierNode);
		const moduleSpecifier: unknown =
			declaration !== null && declaration.type === 'ImportDeclaration'
				? declaration.source.value
				: undefined;
		if (typeof moduleSpecifier !== 'string') {
			refuse(line, `${imported} is not imported from a literal module specifier`);
			continue;
		}
		if (!isPackageRootSpecifier(moduleSpecifier)) {
			refuse(
				line,
				`${imported} comes from '${moduleSpecifier}', which is a subpath rather than a package ` +
					'root; the surface measured here is the root surface, so the rename is not proved',
			);
			continue;
		}
		const surface = byName.get(moduleSpecifier);
		if (surface === undefined) {
			refuse(line, `no export surface was read for '${moduleSpecifier}'`);
			continue;
		}
		if (!surface.complete) {
			refuse(
				line,
				`the export surface of '${moduleSpecifier}'@${surface.version} is incomplete, so it ` +
					`cannot establish that ${suggested} is published or that ${imported} is not`,
			);
			continue;
		}
		if (!surface.exports.includes(suggested)) {
			refuse(
				line,
				`the compiler suggested ${suggested}, and '${moduleSpecifier}'@${surface.version} does ` +
					'not export it',
			);
			continue;
		}
		if (surface.exports.includes(imported)) {
			refuse(
				line,
				`'${moduleSpecifier}'@${surface.version} exports ${imported}, so the diagnostic does ` +
					'not describe this closure and the rename would be a rewrite of working code',
			);
			continue;
		}
		const localNode = specifierNode.local;
		const aliased = localNode.name !== imported;
		const binding = module.symbolOf(localNode);
		const references = aliased ? [] : (binding?.references ?? []);
		if (!aliased && binding === null) {
			refuse(line, `${imported} is imported without an alias and its binding does not resolve`);
			continue;
		}
		if (!aliased && !isFreeRootName(module, suggested) && suggested !== imported) {
			refuse(
				line,
				`${imported} is imported without an alias and ${suggested} is already declared in this ` +
					'module, so renaming the binding would change which symbol its uses mean',
			);
			continue;
		}
		edits.push({ start: importedNode.start, end: importedNode.end, text: suggested });
		let renamed = 0;
		for (const reference of references) {
			const node: AstNode = reference.node;
			if (node.start === importedNode.start) continue;
			if (node.start === localNode.start && node.end === localNode.end) continue;
			edits.push({ start: node.start, end: node.end, text: suggested });
			renamed += 1;
		}
		changes.push({
			kind: 'suggested-export-rename',
			line: lineOf(source, importedNode.start),
			specifier: moduleSpecifier,
			from: imported,
			to: suggested,
			references: renamed,
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

/**
 * The `TS2724` lines of a build log, decomposed into diagnostics by file.
 *
 * The builder prints one line per diagnostic naming the file, the 1-based
 * position, the code and the message. Only the code that carries a successor is
 * read: `TS2305` is the same absence with no suggestion, and a capability that
 * treated it as one would be inventing the very thing this one refuses to.
 */
export function readSuggestedExportRenames(
	log: string,
): ReadonlyMap<string, readonly SuggestedExportRenameDiagnostic[]> {
	const found = new Map<string, SuggestedExportRenameDiagnostic[]>();
	for (const line of log.split('\n')) {
		const head = DIAGNOSTIC_HEAD.exec(line.trim())?.groups;
		const message = RENAMED_MEMBER.exec(line)?.groups;
		if (head === undefined || message === undefined) continue;
		const file = head['file'] as string;
		const entry: SuggestedExportRenameDiagnostic = Object.freeze({
			line: Number(head['line']),
			column: Number(head['column']),
			imported: message['imported'] as string,
			suggested: message['suggested'] as string,
		});
		const list = found.get(file);
		if (list === undefined) found.set(file, [entry]);
		else list.push(entry);
	}
	return new Map([...found].map(([file, list]) => [file, Object.freeze(list)]));
}

/** The position and code the builder prints in front of a diagnostic's message. */
const DIAGNOSTIC_HEAD = createRegExp(
	oneOrMore(charNotIn(' \t\n:'))
		.as('file')
		.and(exactly(':'))
		.and(oneOrMore(digit).as('line'))
		.and(exactly(':'))
		.and(oneOrMore(digit).as('column'))
		.and(exactly(' - error TS2724: ')),
);

/** The message body that carries the compiler's resolved successor. */
const RENAMED_MEMBER = createRegExp(
	exactly("has no exported member named '")
		.and(oneOrMore(charNotIn("'")).as('imported'))
		.and(exactly("'. Did you mean '"))
		.and(oneOrMore(charNotIn("'")).as('suggested'))
		.and(exactly("'?")),
);
