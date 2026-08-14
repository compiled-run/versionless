/**
 * Packages the application's own source names and its manifest does not declare.
 *
 * `undeclared-runtime-dependency` beside this one reads the *closure*: what each
 * installed package's shipped bundles import without declaring. That reading
 * finds holes a library left. It cannot find the holes the application itself
 * left, and it cannot find the holes a migration *opens*, which is the case this
 * capability exists for:
 *
 * - An application imports `leaflet` directly and declares only the Angular
 *   wrapper around it. The era closure supplied `leaflet` transitively, so the
 *   import resolved; the wrapper is a package the target cell read and found no
 *   successor for, so after the disposition drops it the transitive edge is gone
 *   and a direct import in application source stops resolving. The dependency
 *   was always the application's, and the era manifest never said so.
 * - An application writes a webpack **inline loader chain** —
 *   `require('raw-loader!./messages.xlf')` — and the loader package came into the
 *   tree as a transitive dependency of the era builder. A newer builder does not
 *   depend on it, and the chain has no resolver.
 *
 * Both are one fact read one way: a bare package name written in application
 * source, resolved by nothing the manifest declares. The reading rides the
 * parsed module, so a specifier inside a comment or an unrelated string is not
 * one, and the loader half reads webpack's own syntax — every `!`-separated
 * segment before the module request names a loader — rather than matching a
 * loader name. A chain whose module request is a template literal is still read:
 * the loader segments are in the literal's static prefix even when the request
 * they precede is computed at runtime.
 *
 * ## What it will not invent
 *
 * The version. A range comes from the target cell by the same rule every other
 * declaration in this adapter comes from, and a package the cell has read no
 * line for — or has read and found no successor for — is reported by name with
 * every site that needs it, and nothing is written. That report is the honest
 * form of "this application cannot be carried to this cell without a decision",
 * and it is deliberately louder than a missing declaration: after the cell has
 * dropped a package the application still imports, the manifest saying nothing
 * and the source saying `import` is the whole of the remaining gap.
 *
 * ## Type declarations
 *
 * A package whose types the era closure carried as a separate `@types/` package
 * needs that companion declared too, or the direct import the migration just
 * made resolvable still does not type. Which packages those are is a reading of
 * the era closure — the `@types/` names it actually installed — supplied by the
 * caller. Nothing is inferred from a package name: a companion the era closure
 * did not carry is not declared, because this capability has read nothing that
 * says one exists.
 */

import {
	alignedVersionRange,
	compareStrings,
	ecosystemDispositionOf,
	type AngularTargetCell,
	type PackageManifest,
} from './angular-target-cell.ts';
import { forEachNode, lineOf, parseModule, type AstNode } from './semantic-module.ts';
import { packageNameOfSpecifier } from './undeclared-runtime-dependency.ts';

/** One application source file, as the migration holds it. */
export type ApplicationModule = Readonly<{ path: string; source: string }>;

/** How the application source named the package. */
export type ApplicationPackageUseKind = 'module-import' | 'inline-loader-chain';

/** One place application source names a package. */
export type ApplicationPackageUse = Readonly<{
	package: string;
	/** The specifier exactly as written, loader segment included. */
	specifier: string;
	path: string;
	line: number;
	kind: ApplicationPackageUseKind;
}>;

/** The manifest fields a declaration may already stand in. */
const DECLARING_FIELDS: readonly string[] = Object.freeze([
	'dependencies',
	'devDependencies',
	'peerDependencies',
	'optionalDependencies',
]);

/**
 * The static prefix of a `require` argument: the whole string for a literal, the
 * first quasi for a template literal, and null for anything else. A chain's
 * loader segments are always inside that prefix, because webpack reads them from
 * the front of the request.
 */
function staticRequestPrefix(node: AstNode): string | null {
	if (node.type === 'Literal') return typeof node.value === 'string' ? node.value : null;
	if (node.type !== 'TemplateLiteral') return null;
	const first = node.quasis[0];
	if (first === undefined) return null;
	const raw = first.value.cooked;
	return typeof raw === 'string' ? raw : null;
}

/** Whether a call is a bare `require(...)` with one argument. */
function requireArgument(node: AstNode): AstNode | null {
	if (node.type !== 'CallExpression') return null;
	if (node.callee.type !== 'Identifier' || node.callee.name !== 'require') return null;
	const [argument] = node.arguments;
	return argument === undefined ? null : argument;
}

/**
 * The loader packages one webpack request names.
 *
 * Everything before the last `!` inside the static prefix is a loader chain; the
 * segment after it is the module request and is not a loader. Leading `!`, `!!`
 * and `-!` are webpack's rule-disabling markers rather than segments. A segment
 * carrying loader options after `?` keeps only the specifier, and a relative or
 * absolute loader path names no package at all.
 */
export function inlineLoaderPackages(request: string): readonly string[] {
	let head = request;
	while (head.startsWith('!') || head.startsWith('-!')) head = head.slice(head.startsWith('-!') ? 2 : 1);
	const segments = head.split('!');
	if (segments.length < 2) return Object.freeze([]);
	const packages: string[] = [];
	for (const segment of segments.slice(0, -1)) {
		const query = segment.indexOf('?');
		const specifier = query < 0 ? segment : segment.slice(0, query);
		const name = packageNameOfSpecifier(specifier.trim());
		if (name !== null) packages.push(name);
	}
	return Object.freeze(packages);
}

/**
 * Every package application source names, from every shape this capability
 * reads: static imports and re-exports, and webpack inline loader chains inside
 * `require`.
 */
export function readApplicationPackageUses(
	modules: readonly ApplicationModule[],
): readonly ApplicationPackageUse[] {
	const uses: ApplicationPackageUse[] = [];
	for (const module of modules) {
		const parsed = parseModule('Application source dependency', module.path, module.source);
		for (const record of parsed.imports) {
			const name = packageNameOfSpecifier(record.specifier);
			if (name === null) continue;
			uses.push(
				Object.freeze({
					package: name,
					specifier: record.specifier,
					path: module.path,
					line: lineOf(module.source, record.node.start),
					kind: 'module-import' as const,
				}),
			);
		}
		for (const statement of parsed.ast.body) {
			if (statement.type !== 'ExportAllDeclaration' && statement.type !== 'ExportNamedDeclaration')
				continue;
			const source = statement.source;
			if (source === null || source === undefined || typeof source.value !== 'string') continue;
			const name = packageNameOfSpecifier(source.value);
			if (name === null) continue;
			uses.push(
				Object.freeze({
					package: name,
					specifier: source.value,
					path: module.path,
					line: lineOf(module.source, statement.start),
					kind: 'module-import' as const,
				}),
			);
		}
		forEachNode(parsed.ast, (node) => {
			const argument = requireArgument(node);
			if (argument === null) return;
			const prefix = staticRequestPrefix(argument);
			if (prefix === null) return;
			for (const name of inlineLoaderPackages(prefix))
				uses.push(
					Object.freeze({
						package: name,
						specifier: prefix,
						path: module.path,
						line: lineOf(module.source, node.start),
						kind: 'inline-loader-chain' as const,
					}),
				);
		});
	}
	return Object.freeze(
		uses.sort(
			(left, right) =>
				compareStrings(left.package, right.package) ||
				compareStrings(left.path, right.path) ||
				left.line - right.line,
		),
	);
}

export type ApplicationDependencyDeclaration = Readonly<{
	field: 'dependencies' | 'devDependencies';
	name: string;
	range: string;
	reason: string;
}>;

export type ApplicationDependencyDeclarations = Readonly<{
	manifest: PackageManifest;
	declarations: readonly ApplicationDependencyDeclaration[];
	declaredDifferences: readonly string[];
	unhandled: readonly string[];
}>;

/** The scoped-package spelling DefinitelyTyped publishes a companion under. */
export function typesCompanionOf(name: string): string {
	if (!name.startsWith('@')) return `@types/${name}`;
	const [scope, rest] = name.slice(1).split('/');
	return rest === undefined ? `@types/${name}` : `@types/${scope ?? ''}__${rest}`;
}

function declares(manifest: PackageManifest, name: string): boolean {
	for (const field of DECLARING_FIELDS) {
		const value = manifest[field];
		if (typeof value !== 'object' || value === null || Array.isArray(value)) continue;
		if (name in (value as Record<string, unknown>)) return true;
	}
	return false;
}

function describeSites(uses: readonly ApplicationPackageUse[]): string {
	return uses
		.map((use) => `${use.path}:${String(use.line)} (${use.kind} \`${use.specifier}\`)`)
		.join(', ');
}

/**
 * Declare, in the application's own manifest, the packages its own source names
 * and the manifest does not.
 *
 * A loader named by an inline chain is a build-time edge and is declared in
 * `devDependencies`; a module the application imports is a runtime edge and is
 * declared in `dependencies`. A package used both ways is declared once, as a
 * runtime edge, because that is the stronger of the two claims.
 */
export function declareApplicationSourceDependencies(
	manifest: PackageManifest,
	uses: readonly ApplicationPackageUse[],
	cell: AngularTargetCell,
	eraClosureTypePackages: readonly string[] = [],
): ApplicationDependencyDeclarations {
	const byPackage = new Map<string, ApplicationPackageUse[]>();
	for (const use of uses) {
		const group = byPackage.get(use.package) ?? [];
		group.push(use);
		byPackage.set(use.package, group);
	}
	const typesInEraClosure = new Set(eraClosureTypePackages);
	const declarations: ApplicationDependencyDeclaration[] = [];
	const declaredDifferences: string[] = [];
	const unhandled: string[] = [];
	const added: Record<'dependencies' | 'devDependencies', Record<string, string>> = {
		dependencies: {},
		devDependencies: {},
	};
	for (const name of [...byPackage.keys()].sort(compareStrings)) {
		const group = byPackage.get(name) ?? [];
		if (declares(manifest, name)) continue;
		const sites = describeSites(group);
		const disposition = ecosystemDispositionOf(name, cell);
		if (disposition !== null && disposition.kind === 'no-successor') {
			unhandled.push(
				`${name} is named by this application's own source — ${sites} — and is not declared by ` +
					`the migrated manifest, because ${cell.id} read the package and found no line of it ` +
					`to declare: ${disposition.fact} The import site is the application's, so nothing ` +
					'here can close it: the source asks for a package this cell has no successor for.',
			);
			continue;
		}
		const range = alignedVersionRange(name, cell);
		if (range === null) {
			unhandled.push(
				`${name} is named by this application's own source — ${sites} — and is declared by ` +
					`neither the application manifest nor anything the closure is obliged to supply, but ` +
					`${cell.id} has read no line for it, so the manifest was left as it is rather than ` +
					'declaring an unverified version',
			);
			continue;
		}
		const runtime = group.some((use) => use.kind === 'module-import');
		const field = runtime ? ('dependencies' as const) : ('devDependencies' as const);
		const reason =
			`declared because this application's own source names it and no declaration in the ` +
			`migrated manifest supplies it: ${sites}. Range read for ${cell.id}: ${range}`;
		added[field][name] = range;
		declarations.push(Object.freeze({ field, name, range, reason }));
		declaredDifferences.push(
			`${field}.${name} was added: the migrated workspace declares a package the era workspace ` +
				`never named, because the era closure supplied it without either of them saying so. ${reason}`,
		);
		const companion = typesCompanionOf(name);
		const typed = group.some((use) => use.path.endsWith('.ts'));
		if (!typed || declares(manifest, companion) || !typesInEraClosure.has(companion)) continue;
		const companionRange = alignedVersionRange(companion, cell);
		if (companionRange === null) {
			unhandled.push(
				`${companion} was carried by the era closure and ${name} is imported from TypeScript ` +
					`source — ${sites} — so the declaration this capability just wrote resolves at ` +
					`runtime and does not type; ${cell.id} has read no line for the companion, so it was ` +
					'not declared',
			);
			continue;
		}
		const companionReason =
			`declared beside ${name}: the era closure carried ${companion}, ${name} is imported from ` +
			`this application's TypeScript source, and a runtime declaration alone would leave those ` +
			`imports untyped. Range read for ${cell.id}: ${companionRange}`;
		added.devDependencies[companion] = companionRange;
		declarations.push(
			Object.freeze({
				field: 'devDependencies' as const,
				name: companion,
				range: companionRange,
				reason: companionReason,
			}),
		);
		declaredDifferences.push(
			`devDependencies.${companion} was added: the migrated workspace declares a type package ` +
				`the era workspace never named. ${companionReason}`,
		);
	}
	if (declarations.length === 0)
		return Object.freeze({
			manifest,
			declarations: Object.freeze([]),
			declaredDifferences: Object.freeze([]),
			unhandled: Object.freeze(unhandled.sort(compareStrings)),
		});
	let next: PackageManifest = manifest;
	for (const field of ['dependencies', 'devDependencies'] as const) {
		const entries = added[field];
		if (Object.keys(entries).length === 0) continue;
		const current = next[field];
		if (current !== undefined && (typeof current !== 'object' || current === null))
			throw new Error(`Application source dependency declaration: "${field}" is not an object`);
		const merged: Record<string, unknown> = {
			...(current as Record<string, unknown> | undefined),
			...entries,
		};
		const sorted: Record<string, unknown> = {};
		for (const key of Object.keys(merged).sort(compareStrings)) sorted[key] = merged[key];
		next = Object.freeze({ ...next, [field]: Object.freeze(sorted) });
	}
	return Object.freeze({
		manifest: next,
		declarations: Object.freeze(declarations),
		declaredDifferences: Object.freeze(declaredDifferences.sort(compareStrings)),
		unhandled: Object.freeze(unhandled.sort(compareStrings)),
	});
}
