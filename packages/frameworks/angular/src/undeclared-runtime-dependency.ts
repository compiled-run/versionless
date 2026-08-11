/**
 * Undeclared runtime dependencies — peer holes — read out of an installed
 * dependency closure and closed in the application's own manifest.
 *
 * A published package states its runtime edges in `dependencies` and
 * `peerDependencies`. When the bundles it actually ships import a package it
 * declares in neither, the edge exists but nothing in the closure is obliged to
 * satisfy it. An installation that works anyway works by accident: some other
 * package happened to hoist the module to a place the resolver found. Nothing
 * records that, so nothing preserves it, and the first unrelated dependency
 * change breaks a build for a reason the manifest cannot explain.
 *
 * The detection is entirely a reading of the closure's own facts:
 *
 * - what each installed package's manifest declares, and
 * - what each installed package's shipped bundles import.
 *
 * Nothing here knows which packages have holes. The pair (importer, imported)
 * is discovered, never listed. What the capability will not invent is the
 * *version*: the range comes from the target cell's community-layer reading,
 * chosen by the same mechanical rule every other entry in that table was chosen
 * by, and a hole the cell has read no line for is reported rather than guessed
 * at. Declaring a dependency at a version nobody read would replace an accident
 * with a fabrication.
 *
 * What closing a hole establishes is narrow, and the reason recorded with the
 * change says so: the application now declares an edge the closure previously
 * supplied by accident. It does not establish that the declared line's export
 * surface matches what the importer's bundles reach for — a build, and then a
 * witness, arbitrate that.
 */

import { builtinModules } from 'node:module';
import {
	compareStrings,
	ecosystemDispositionOf,
	type AngularTargetCell,
	type PackageManifest,
} from './angular-target-cell.ts';
import { parseModule, type AstNode } from './semantic-module.ts';

/** The manifest fields that declare an edge a runtime import may rely on. */
export const RUNTIME_DEPENDENCY_FIELDS: readonly string[] = Object.freeze([
	'dependencies',
	'peerDependencies',
	'optionalDependencies',
]);

/** The manifest fields an application may already close a hole in. */
const APPLICATION_DEPENDENCY_FIELDS: readonly string[] = Object.freeze([
	'dependencies',
	'devDependencies',
]);

const NODE_BUILTINS: ReadonlySet<string> = new Set(builtinModules);

/** One file of a published package, as installed. */
export type InstalledFile = Readonly<{ path: string; source: string }>;

/** One bare specifier a package's shipped bundles import, and where from. */
export type PackageImport = Readonly<{ specifier: string; from: string }>;

/** One installed package, reduced to the two facts the detection needs. */
export type InstalledPackage = Readonly<{
	name: string;
	version: string;
	/** Package names declared in any of {@link RUNTIME_DEPENDENCY_FIELDS}. */
	declared: readonly string[];
	/** Bare specifiers the shipped bundles import, with the file each came from. */
	imports: readonly PackageImport[];
}>;

export type UndeclaredRuntimeDependency = Readonly<{
	/** The package whose bundles import without declaring. */
	importer: string;
	importerVersion: string;
	/** The package name the bundles reach for. */
	dependency: string;
	/** The specifiers, deduplicated and sorted, that produced the hole. */
	specifiers: readonly string[];
	/** The shipped files, deduplicated and sorted, the specifiers were read in. */
	files: readonly string[];
	/**
	 * Whether some package in the closure happens to carry the name anyway. A
	 * hole is a hole either way — the point is that nothing declared the edge —
	 * but a hole that is currently unsatisfied is also a build that cannot run.
	 */
	satisfiedByClosure: boolean;
}>;

/**
 * The package a bare module specifier names, or null when the specifier does
 * not name one: a relative or absolute path, a protocol-qualified specifier, or
 * a Node builtin, none of which a manifest is expected to declare.
 */
export function packageNameOfSpecifier(specifier: string): string | null {
	if (specifier === '' || specifier.startsWith('.') || specifier.startsWith('/')) return null;
	if (specifier.includes(':')) return null;
	if (specifier.startsWith('#')) return null;
	const segments = specifier.split('/').filter((segment) => segment !== '');
	const first = segments[0];
	if (first === undefined) return null;
	if (!first.startsWith('@')) return NODE_BUILTINS.has(first) ? null : first;
	const second = segments[1];
	return second === undefined ? null : `${first}/${second}`;
}

function declaredNames(manifest: Readonly<Record<string, unknown>>): readonly string[] {
	const names = new Set<string>();
	for (const field of RUNTIME_DEPENDENCY_FIELDS) {
		const value = manifest[field];
		if (typeof value !== 'object' || value === null || Array.isArray(value)) continue;
		for (const name of Object.keys(value as Record<string, unknown>)) names.add(name);
	}
	return Object.freeze([...names].sort(compareStrings));
}

/** The module specifier of a re-export declaration, when it has one. */
function reexportSpecifier(node: AstNode): string | null {
	if (node.type !== 'ExportAllDeclaration' && node.type !== 'ExportNamedDeclaration') return null;
	const source = node.source;
	if (source === null || source === undefined || source.type !== 'Literal') return null;
	return typeof source.value === 'string' ? source.value : null;
}

/**
 * Read one installed package into the facts the detection needs.
 *
 * The bundles are parsed, not scanned for text: a specifier is a specifier
 * because the module graph says so, not because the bytes of a comment or a
 * string constant happened to spell one. Static imports, re-exports and
 * dynamic imports with a literal specifier all count, because all three are
 * runtime edges the package's own code makes.
 */
export function readInstalledPackage(
	manifestSource: string,
	bundles: readonly InstalledFile[],
): InstalledPackage {
	const parsed: unknown = JSON.parse(manifestSource);
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
		throw new Error('Undeclared runtime dependency reading: a package manifest is not an object');
	const manifest = parsed as Readonly<Record<string, unknown>>;
	const name = manifest['name'];
	const version = manifest['version'];
	if (typeof name !== 'string')
		throw new Error('Undeclared runtime dependency reading: a package manifest declares no name');
	const imports: PackageImport[] = [];
	for (const bundle of bundles) {
		const module = parseModule('Undeclared runtime dependency reading', bundle.path, bundle.source);
		for (const record of module.imports)
			imports.push(Object.freeze({ specifier: record.specifier, from: bundle.path }));
		for (const statement of module.ast.body as readonly AstNode[]) {
			const specifier = reexportSpecifier(statement);
			if (specifier !== null) imports.push(Object.freeze({ specifier, from: bundle.path }));
		}
	}
	return Object.freeze({
		name,
		version: typeof version === 'string' ? version : '',
		declared: declaredNames(manifest),
		imports: Object.freeze(imports),
	});
}

/**
 * Every runtime edge the closure's own packages make without declaring it.
 *
 * A package importing itself by name is not a hole — that is a package reaching
 * its own subpath exports — and neither is a specifier that names no package at
 * all.
 */
export function undeclaredRuntimeDependencies(
	packages: readonly InstalledPackage[],
): readonly UndeclaredRuntimeDependency[] {
	const installed = new Set(packages.map((entry) => entry.name));
	const holes: UndeclaredRuntimeDependency[] = [];
	for (const importer of packages) {
		const declared = new Set(importer.declared);
		const byDependency = new Map<string, { specifiers: Set<string>; files: Set<string> }>();
		for (const record of importer.imports) {
			const dependency = packageNameOfSpecifier(record.specifier);
			if (dependency === null || dependency === importer.name) continue;
			if (declared.has(dependency)) continue;
			const entry = byDependency.get(dependency) ?? { specifiers: new Set(), files: new Set() };
			entry.specifiers.add(record.specifier);
			entry.files.add(record.from);
			byDependency.set(dependency, entry);
		}
		for (const dependency of [...byDependency.keys()].sort(compareStrings)) {
			const entry = byDependency.get(dependency);
			if (entry === undefined) continue;
			holes.push(
				Object.freeze({
					importer: importer.name,
					importerVersion: importer.version,
					dependency,
					specifiers: Object.freeze([...entry.specifiers].sort(compareStrings)),
					files: Object.freeze([...entry.files].sort(compareStrings)),
					satisfiedByClosure: installed.has(dependency),
				}),
			);
		}
	}
	return Object.freeze(
		holes.sort(
			(left, right) =>
				compareStrings(left.dependency, right.dependency) ||
				compareStrings(left.importer, right.importer),
		),
	);
}

export type RuntimeDependencyDeclaration = Readonly<{
	field: 'dependencies';
	name: string;
	range: string;
	reason: string;
}>;

export type RuntimeDependencyDeclarations = Readonly<{
	manifest: PackageManifest;
	declarations: readonly RuntimeDependencyDeclaration[];
	declaredDifferences: readonly string[];
	unhandled: readonly string[];
}>;

function applicationDeclares(manifest: PackageManifest, name: string): boolean {
	for (const field of APPLICATION_DEPENDENCY_FIELDS) {
		const value = manifest[field];
		if (typeof value !== 'object' || value === null || Array.isArray(value)) continue;
		if (name in (value as Record<string, unknown>)) return true;
	}
	return false;
}

function describeHoles(holes: readonly UndeclaredRuntimeDependency[]): string {
	return holes
		.map(
			(hole) =>
				`${hole.importer}@${hole.importerVersion} imports it as ` +
				`${hole.specifiers.join(', ')} from ${hole.files.join(', ')} but declares it in none of ` +
				`${RUNTIME_DEPENDENCY_FIELDS.join(', ')}`,
		)
		.join('; ');
}

/**
 * Close the holes in the application manifest.
 *
 * A hole the application already declares is left alone: the edge is already
 * stated, and restating it at the cell's range would be an upgrade decision
 * this capability is not making. A hole the cell has read no line for, or has
 * read and found no successor for, is reported and left open — the manifest
 * keeps saying nothing rather than saying something unverified.
 */
export function declareUndeclaredRuntimeDependencies(
	manifest: PackageManifest,
	holes: readonly UndeclaredRuntimeDependency[],
	cell: AngularTargetCell,
): RuntimeDependencyDeclarations {
	const byDependency = new Map<string, UndeclaredRuntimeDependency[]>();
	for (const hole of holes) {
		const entry = byDependency.get(hole.dependency) ?? [];
		entry.push(hole);
		byDependency.set(hole.dependency, entry);
	}
	const declarations: RuntimeDependencyDeclaration[] = [];
	const declaredDifferences: string[] = [];
	const unhandled: string[] = [];
	const added: Record<string, string> = {};
	for (const name of [...byDependency.keys()].sort(compareStrings)) {
		const group = byDependency.get(name) ?? [];
		if (applicationDeclares(manifest, name)) continue;
		const disposition = ecosystemDispositionOf(name, cell);
		if (disposition === null) {
			unhandled.push(
				`${name} is imported by the installed closure without being declared — ` +
					`${describeHoles(group)} — but ${cell.id} has read no line for it, so the ` +
					'manifest was left as it is rather than declaring an unverified version',
			);
			continue;
		}
		if (disposition.kind === 'no-successor') {
			unhandled.push(
				`${name} is imported by the installed closure without being declared — ` +
					`${describeHoles(group)} — but ${cell.id} found no line of it to declare: ` +
					disposition.fact,
			);
			continue;
		}
		added[name] = disposition.range;
		const reason =
			`declared to close an undeclared runtime dependency the installed closure supplied by ` +
			`accident: ${describeHoles(group)}. Version read for ${cell.id}: ${disposition.fact}`;
		declarations.push(
			Object.freeze({ field: 'dependencies' as const, name, range: disposition.range, reason }),
		);
		declaredDifferences.push(
			`dependencies.${name} was added: the migrated workspace declares a package the era ` +
				`workspace never named. ${reason}`,
		);
	}
	if (declarations.length === 0)
		return Object.freeze({
			manifest,
			declarations: Object.freeze([]),
			declaredDifferences: Object.freeze([]),
			unhandled: Object.freeze(unhandled.sort(compareStrings)),
		});
	const current = manifest['dependencies'];
	if (current !== undefined && (typeof current !== 'object' || current === null))
		throw new Error('Undeclared runtime dependency declaration: "dependencies" is not an object');
	const merged: Record<string, unknown> = {
		...(current as Record<string, unknown> | undefined),
		...added,
	};
	const sorted: Record<string, unknown> = {};
	for (const key of Object.keys(merged).sort(compareStrings)) sorted[key] = merged[key];
	return Object.freeze({
		manifest: Object.freeze({ ...manifest, dependencies: Object.freeze(sorted) }),
		declarations: Object.freeze(declarations),
		declaredDifferences: Object.freeze(declaredDifferences.sort(compareStrings)),
		unhandled: Object.freeze(unhandled.sort(compareStrings)),
	});
}
