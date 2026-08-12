/**
 * The u18i round of the `angular-super-productivity-v2-13-15` cell: the round
 * that answers the bundler.
 *
 * u18h took the source census to zero and the build reached the bundler for the
 * first time in this cell's history, where three families were waiting that
 * nothing had ever been able to see. None of them is application source in the
 * sense the earlier rounds meant it — one is a closure decision, one is a
 * stylesheet, one is a module-graph rule the type checker does not share — and
 * each is answered here by a reading rather than by a table.
 *
 * The @ngx-formly correction is not driven from this file: it is a fact about
 * the target cell, and it is corrected where the cell's ecosystem readings live.
 * What this driver does is the other two, and it does them with capabilities:
 *
 *  - `sass-mixin-hyphenation-successor` rewrites `@include initMaterialCssVars()`
 *    onto the `init-material-css-vars` the installed angular-material-css-vars
 *    5.0.3 declares, after resolving the stylesheet's own `@import` specifiers
 *    through the package's `exports` map under the `sass` condition and reading
 *    the mixins those files actually declare.
 *  - `json-module-named-import` rewrites `import {version} from '../../package.json'`
 *    into a default import and a destructuring, after parsing the resolved JSON
 *    and confirming it declares the key.
 *
 * Both are pure functions of a module and a reading. This driver is the part
 * that makes the readings — the closure questions — and it makes them against
 * the installed tree, never against a table of what the tree ought to contain.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import * as path from 'pathe';
import {
	renameHyphenatedSassMixins,
	readSassMixinDeclarations,
	rewriteJsonNamedImports,
	rebaseStylesheetUrls,
	type JsonModuleReading,
	type StylesheetTreeReading,
	type UrlRebaseChange,
	type SassMixinDeclaration,
	type SassMixinRenameChange,
	type JsonNamedImportChange,
} from '../../../frameworks/angular/src/index.ts';
import { APPLIED_TREE, STAGE_DIRECTORY } from './angular-super-productivity-apply-run.ts';

/** The stylesheet the bundler names, and the environments that name the manifest. */
export const STYLE_ENTRY = 'src/styles/themes.scss';
export const ENVIRONMENT_MODULES: readonly string[] = Object.freeze([
	'src/environments/environment.ts',
	'src/environments/environment.prod.ts',
]);

type ExportsMap = Readonly<Record<string, unknown>>;

/**
 * The file a package's `exports` map answers `subpath` with under the stylesheet
 * pipeline's conditions, or null when the map does not answer it.
 *
 * Only `sass` and `style` are honoured, and `default` after them, because those
 * are the conditions the Angular builder's sass loader resolves with. A package
 * publishing no map answers nothing here and is left to the file candidates.
 */
export function sassEntryPointOf(manifest: ExportsMap, subpath: string): string | null {
	const map = manifest['exports'];
	if (typeof map !== 'object' || map === null) return null;
	const entry = (map as Record<string, unknown>)[subpath];
	if (typeof entry === 'string') return entry;
	if (typeof entry !== 'object' || entry === null) return null;
	for (const condition of ['sass', 'style', 'default']) {
		const answered = (entry as Record<string, unknown>)[condition];
		if (typeof answered === 'string') return answered;
	}
	return null;
}

/**
 * Resolve a bare stylesheet specifier to a file inside the installed closure.
 *
 * The package's own `exports` map is consulted first — a package that publishes
 * one is reachable through it and only through it — and sass's file candidates
 * are the fallback for a package that publishes none.
 */
export function resolveSassSpecifier(specifier: string, modulesRoot: string): string | null {
	const segments = specifier.split('/');
	const packageName = specifier.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0] ?? '';
	const subpath = specifier.slice(packageName.length);
	const manifestPath = path.join(modulesRoot, packageName, 'package.json');
	if (existsSync(manifestPath)) {
		const manifest: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'));
		if (typeof manifest === 'object' && manifest !== null) {
			const answered = sassEntryPointOf(manifest as ExportsMap, subpath === '' ? '.' : `.${subpath}`);
			if (answered !== null) return path.join(modulesRoot, packageName, answered);
		}
	}
	const direct = path.join(modulesRoot, specifier);
	for (const candidate of [
		direct,
		`${direct}.scss`,
		path.join(path.dirname(direct), `_${path.basename(direct)}.scss`),
		path.join(direct, '_index.scss'),
		path.join(direct, 'index.scss'),
	])
		if (existsSync(candidate)) return candidate;
	return null;
}

/**
 * Every mixin the stylesheet's own `@import` rules put in its global namespace.
 *
 * `@import` hoists a file's members into the importing file, and `@forward`
 * re-exports the members of another file through the one doing the forwarding,
 * so both are followed. `@use` is not followed: its members are reachable only
 * through the namespace it binds, and a namespaced `@include a.b()` is a call
 * this capability passes over.
 */
export async function readImportedSassSurface(
	stylesheet: string,
	modulesRoot: string,
): Promise<Readonly<{ surface: readonly SassMixinDeclaration[]; files: readonly string[] }>> {
	const source = await readFile(stylesheet, 'utf8');
	const surface: SassMixinDeclaration[] = [];
	const files: string[] = [];
	const seen = new Set<string>();
	const queue: string[] = [];
	for (const match of source.matchAll(/@import\s+['"]([^'"\n]+)['"]/gu)) {
		const specifier = match[1];
		if (specifier === undefined || specifier.startsWith('.') || specifier.startsWith('/')) continue;
		const resolved = resolveSassSpecifier(specifier, modulesRoot);
		if (resolved !== null) queue.push(resolved);
	}
	while (queue.length > 0) {
		const file = queue.shift();
		if (file === undefined || seen.has(file) || !existsSync(file)) continue;
		seen.add(file);
		files.push(path.relative(modulesRoot, file));
		const text = await readFile(file, 'utf8');
		surface.push(...readSassMixinDeclarations(text));
		for (const match of text.matchAll(/@forward\s+['"]([^'"\n]+)['"]/gu)) {
			const specifier = match[1];
			if (specifier === undefined) continue;
			const base = specifier.startsWith('.')
				? path.resolve(path.dirname(file), specifier)
				: resolveSassSpecifier(specifier, modulesRoot);
			if (base === null) continue;
			for (const candidate of [
				base,
				`${base}.scss`,
				path.join(path.dirname(base), `_${path.basename(base)}.scss`),
			])
				if (existsSync(candidate)) {
					queue.push(candidate);
					break;
				}
		}
	}
	return Object.freeze({ surface: Object.freeze(surface), files: Object.freeze(files.sort()) });
}

export type RoundOutcome = Readonly<{
	capability: string;
	filesChanged: readonly string[];
	changes: readonly string[];
	unhandled: readonly string[];
	reading: readonly string[];
}>;

/** The Sass mixin round, read off the installed closure the stylesheet imports. */
export async function sassMixinRound(tree: string = APPLIED_TREE): Promise<RoundOutcome> {
	const modulesRoot = path.join(tree, 'node_modules');
	const stylesheet = path.join(tree, STYLE_ENTRY);
	const { surface, files } = await readImportedSassSurface(stylesheet, modulesRoot);
	const source = await readFile(stylesheet, 'utf8');
	const migration = renameHyphenatedSassMixins(STYLE_ENTRY, source, surface);
	if (migration.changed) await writeFile(stylesheet, migration.source);
	return Object.freeze({
		capability: 'sass-mixin-hyphenation-successor',
		filesChanged: Object.freeze(migration.changed ? [STYLE_ENTRY] : []),
		changes: Object.freeze(
			migration.changes.map(
				(change: SassMixinRenameChange) =>
					`${STYLE_ENTRY} line ${String(change.line)}: @include ${change.from} → ${change.to} ` +
					`(${String(change.declaration.parameters.length)} declared parameter(s), ` +
					`${String(change.declaration.defaults)} with defaults; the call passes ` +
					`${String(change.arguments)})`,
			),
		),
		unhandled: migration.unhandled,
		reading: Object.freeze([
			`surface read from ${String(files.length)} file(s) the stylesheet's @import rules resolve to: ` +
				files.join(', '),
			`${String(surface.length)} mixin declaration(s) in that surface`,
		]),
	});
}

/** The JSON named-import round, read off the resolved manifest itself. */
export async function jsonNamedImportRound(tree: string = APPLIED_TREE): Promise<RoundOutcome> {
	const changed: string[] = [];
	const changes: string[] = [];
	const unhandled: string[] = [];
	const reading: string[] = [];
	for (const file of ENVIRONMENT_MODULES) {
		const absolute = path.join(tree, file);
		if (!existsSync(absolute)) continue;
		const source = await readFile(absolute, 'utf8');
		const parsedFor: JsonModuleReading = (specifier: string) => {
			const target = path.resolve(path.dirname(absolute), specifier);
			if (!existsSync(target)) return null;
			try {
				const value: unknown = JSON.parse(readFileSync(target, 'utf8'));
				if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
				reading.push(
					`${file}: '${specifier}' resolved to ${path.relative(APPLIED_TREE, target)}, ` +
						`${String(Object.keys(value).length)} top-level key(s)`,
				);
				return value as Readonly<Record<string, unknown>>;
			} catch {
				return null;
			}
		};
		const migration = rewriteJsonNamedImports(file, source, parsedFor);
		unhandled.push(...migration.unhandled);
		if (!migration.changed) continue;
		await writeFile(absolute, migration.source);
		changed.push(file);
		for (const change of migration.changes as readonly JsonNamedImportChange[])
			changes.push(
				`${file} line ${String(change.line)}: import { ` +
					`${change.bindings.map((binding) => binding.exported).join(', ')} } from ` +
					`'${change.specifier}' → default import ${change.defaultLocal} plus a destructuring of ` +
					'the same names',
			);
	}
	return Object.freeze({
		capability: 'json-module-named-import',
		filesChanged: Object.freeze(changed),
		changes: Object.freeze(changes),
		unhandled: Object.freeze(unhandled),
		reading: Object.freeze(reading),
	});
}

/**
 * The url-rebase round.
 *
 * The entry stylesheets are the ones `angular.json` names in the build's
 * `styles` option, and the partials are every `.scss` under `src/` those entries
 * reach by `@import`. Both readings are made from the tree: the entry list from
 * the workspace file, the import graph by following each entry's own relative
 * `@import` rules, so nothing here assumes a layout.
 */
export async function urlRebaseRound(tree: string = APPLIED_TREE): Promise<RoundOutcome> {
	const workspace: unknown = JSON.parse(readFileSync(path.join(tree, 'angular.json'), 'utf8'));
	const entries = new Set<string>();
	const projects = (workspace as { projects?: Record<string, unknown> }).projects ?? {};
	for (const project of Object.values(projects)) {
		const styles = (
			project as { architect?: { build?: { options?: { styles?: unknown } } } }
		).architect?.build?.options?.styles;
		if (!Array.isArray(styles)) continue;
		for (const style of styles) if (typeof style === 'string') entries.add(style);
	}
	// The import graph, followed from each entry through its own relative rules.
	const importedBy = new Map<string, Set<string>>();
	const queue = [...entries].map((entry) => Object.freeze({ file: entry, root: entry }));
	const seen = new Set<string>();
	while (queue.length > 0) {
		const next = queue.shift();
		if (next === undefined) continue;
		const key = `${next.root}\u0000${next.file}`;
		if (seen.has(key)) continue;
		seen.add(key);
		const absolute = path.join(tree, next.file);
		if (!existsSync(absolute)) continue;
		const text = await readFile(absolute, 'utf8');
		for (const match of text.matchAll(/@import\s+['"]([^'"\n]+)['"]/gu)) {
			const specifier = match[1];
			if (specifier === undefined) continue;
			const base = path.join(path.dirname(next.file), specifier);
			const candidate = [
				base,
				`${base}.scss`,
				path.join(path.dirname(base), `_${path.basename(base)}.scss`),
			].find((option) => existsSync(path.join(tree, option)));
			if (candidate === undefined) continue;
			importedBy.set(candidate, (importedBy.get(candidate) ?? new Set()).add(path.dirname(next.root)));
			queue.push(Object.freeze({ file: candidate, root: next.root }));
		}
	}
	const changed: string[] = [];
	const changes: string[] = [];
	const unhandled: string[] = [];
	for (const partial of [...importedBy.keys()].sort()) {
		const absolute = path.join(tree, partial);
		const source = await readFile(absolute, 'utf8');
		const reading: StylesheetTreeReading = Object.freeze({
			carries: (treePath: string): boolean => existsSync(path.join(tree, treePath)),
			entryDirectories: Object.freeze([...(importedBy.get(partial) ?? new Set<string>())].sort()),
		});
		const migration = rebaseStylesheetUrls(partial, source, reading);
		unhandled.push(...migration.unhandled);
		if (!migration.changed) continue;
		await writeFile(absolute, migration.source);
		changed.push(partial);
		for (const change of migration.changes as readonly UrlRebaseChange[])
			changes.push(
				`${partial} line ${String(change.line)}: url(${change.from}) → url(${change.to}) ` +
					`(both spellings name ${change.resolved})`,
			);
	}
	return Object.freeze({
		capability: 'stylesheet-url-rebase',
		filesChanged: Object.freeze(changed),
		changes: Object.freeze(changes),
		unhandled: Object.freeze(unhandled),
		reading: Object.freeze([
			`${String(entries.size)} entry stylesheet(s) named by angular.json: ${[...entries].sort().join(', ')}`,
			`${String(importedBy.size)} imported partial(s) reached from them`,
		]),
	});
}

export async function main(): Promise<void> {
	const outcomes: RoundOutcome[] = [
		await sassMixinRound(),
		await jsonNamedImportRound(),
		await urlRebaseRound(),
	];
	await writeFile(
		path.join(STAGE_DIRECTORY, 'u18i-round.json'),
		`${JSON.stringify({ capabilities: outcomes }, null, '\t')}\n`,
	);
	for (const outcome of outcomes)
		process.stdout.write(
			`${outcome.capability}: ${String(outcome.filesChanged.length)} files changed, ` +
				`${String(outcome.changes.length)} changes, ${String(outcome.unhandled.length)} refused\n`,
		);
}

if (process.argv[1]?.endsWith('angular-super-productivity-u18i-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
