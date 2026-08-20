/**
 * The u18d round of the `angular-super-productivity-v2-13-15` cell: two more
 * closure readings written against the tree u18c left red, and the production
 * build attempted again on the result.
 *
 * u18c cleared six diagnostic families and itemised eight demands. Two of those
 * eight are answerable by reading the installed tree harder rather than by any
 * new decision, and this driver takes both readings:
 *
 * The first is a manifest reading. u18c's tilde capability refused five sass
 * at-rules because no file sits at `angular-material-css-vars/public-util`, and
 * that refusal was correct about the file system and wrong about the package: the
 * installed 5.0.3 publishes an `exports` map that answers `./public-util` under
 * the `sass` condition, and the Angular builder resolves stylesheet module
 * requests with exactly that condition — `conditionNames: ['sass', 'style']` in
 * its own webpack styles config. So the closure reading handed to the capability
 * now answers both questions, and the capability un-prefixes a subpath that the
 * package answers through its map.
 *
 * The second is a diagnostic reading. The compiler's TS2724 lines carry its own
 * resolution of a renamed export — `has no exported member named 'ChartsModule'.
 * Did you mean 'NgChartsModule'?` — and that is a successor a table did not
 * supply and this driver did not guess. Each one is checked against the measured
 * export surface of the package it names before anything is written.
 *
 * Nothing here decides what a symbol maps to. It decides which tree is read and
 * which tree is written, and hands both readings to `@versionless/angular`.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import * as path from 'pathe';
import {
	applySuggestedExportRenames,
	dropWebpackTildeSpecifiers,
	parseModule,
	readSuggestedExportRenames,
	successorForkRenames,
	ANGULAR_16_BROWSER_CELL,
	type ClosureFileReading,
	type ExportSurfaceReading,
	type SuggestedExportRenameDiagnostic,
} from '../../../frameworks/angular/src/index.ts';
import { applyMigration } from './angular-tiny-translator-apply-run.ts';
import { composeMigration, SOURCE_TREE } from './angular-super-productivity-lanes-run.ts';
import { APPLIED_TREE, STAGE_DIRECTORY } from './angular-super-productivity-apply-run.ts';
import { applyRound, type CapabilityOutcome } from './angular-super-productivity-u18c-run.ts';

/** The conditions the Angular builder resolves a stylesheet module request with. */
export const STYLE_CONDITIONS: readonly string[] = Object.freeze(['sass', 'style']);

async function filesBelow(root: string, extension: string): Promise<readonly string[]> {
	const found: string[] = [];
	const walk = async (directory: string): Promise<void> => {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			const full = path.join(directory, entry.name);
			if (entry.isDirectory()) await walk(full);
			else if (entry.name.endsWith(extension)) found.push(full);
		}
	};
	await walk(root);
	return Object.freeze(found.sort());
}

/** The package a bare specifier names, and the subpath beneath it. */
function splitSpecifier(specifier: string): Readonly<{ name: string; subpath: string }> {
	const segments = specifier.split('/');
	const width = specifier.startsWith('@') ? 2 : 1;
	return Object.freeze({
		name: segments.slice(0, width).join('/'),
		subpath: segments.slice(width).join('/'),
	});
}

function resolveCondition(target: unknown, conditions: readonly string[]): string | null {
	if (typeof target === 'string') return target;
	if (target === null || typeof target !== 'object' || Array.isArray(target)) return null;
	const record = target as Readonly<Record<string, unknown>>;
	for (const condition of [...conditions, 'default'])
		if (condition in record) {
			const resolved = resolveCondition(record[condition], conditions);
			if (resolved !== null) return resolved;
		}
	return null;
}

/**
 * The closure reading the tilde capability asks its two questions of.
 *
 * `carries` is the file system, unchanged. `entryPoint` is the installed
 * package's own `exports` map, read under the conditions the stylesheet
 * pipeline resolves with, and answered only when the file the map points at is
 * really on disk — a map entry naming a file the package did not ship answers
 * nothing.
 */
export function styleClosure(tree: string): ClosureFileReading {
	const modules = path.join(tree, 'node_modules');
	return Object.freeze({
		carries: (relativePath: string): boolean => existsSync(path.join(modules, relativePath)),
		entryPoint: (specifier: string): string | null => {
			const { name, subpath } = splitSpecifier(specifier);
			if (subpath === '') return null;
			const manifest = path.join(modules, name, 'package.json');
			if (!existsSync(manifest)) return null;
			let exports: unknown;
			try {
				exports = (JSON.parse(readFileSync(manifest, 'utf8')) as Record<string, unknown>)[
					'exports'
				];
			} catch {
				return null;
			}
			if (exports === null || typeof exports !== 'object' || Array.isArray(exports))
				return null;
			const entry = (exports as Readonly<Record<string, unknown>>)[`./${subpath}`];
			if (entry === undefined) return null;
			const target = resolveCondition(entry, STYLE_CONDITIONS);
			if (target === null || !target.startsWith('./')) return null;
			const relative = path.join(name, target.slice(2));
			return existsSync(path.join(modules, relative)) ? relative : null;
		},
	});
}

/**
 * Every name a package's root declaration exports.
 *
 * This is the same star-following reading u18c takes of a successor fork, with
 * one resolution rule added: a declaration that re-exports `./types/index.js` is
 * naming the module, and the declaration for it is `./types/index.d.ts`. A
 * reader that could not follow that would call a complete surface incomplete,
 * and an incomplete surface refuses every rename for a reason that is not true.
 */
export async function readExportSurface(tree: string, name: string): Promise<ExportSurfaceReading> {
	const directory = path.join(tree, 'node_modules', name);
	const manifest = JSON.parse(
		await readFile(path.join(directory, 'package.json'), 'utf8'),
	) as Readonly<{ version?: unknown; types?: unknown; typings?: unknown }>;
	const declared = typeof manifest.types === 'string' ? manifest.types : manifest.typings;
	const version = typeof manifest.version === 'string' ? manifest.version : 'unknown';
	if (typeof declared !== 'string')
		return Object.freeze({ name, version, exports: Object.freeze([]), complete: false });
	const names = new Set<string>();
	const seen = new Set<string>();
	let complete = true;
	const resolve = (from: string, specifier: string): string | null => {
		const base = path.resolve(path.dirname(from), specifier);
		const stem = base.endsWith('.js') ? base.slice(0, -3) : base;
		for (const candidate of [base, `${stem}.d.ts`, path.join(stem, 'index.d.ts')])
			if (candidate.endsWith('.d.ts') && existsSync(candidate)) return candidate;
		return null;
	};
	const visit = async (file: string): Promise<void> => {
		if (seen.has(file)) return;
		seen.add(file);
		const source = await readFile(file, 'utf8');
		const module = parseModule('Export surface reading', file, source);
		for (const entry of module.exports)
			if (!entry.isStar && entry.name !== null && entry.name !== 'default')
				names.add(entry.name);
		for (const node of module.ast.body) {
			if (node.type !== 'ExportAllDeclaration') continue;
			const specifier: string = node.source.value;
			const target = specifier.startsWith('.') ? resolve(file, specifier) : null;
			if (target === null) {
				complete = false;
				continue;
			}
			await visit(target);
		}
	};
	await visit(path.join(directory, declared));
	return Object.freeze({
		name,
		version,
		exports: Object.freeze([...names].sort()),
		complete,
	});
}

/** The stylesheet round, re-asked of a closure that reads exports maps. */
export async function tildeRound(tree: string = APPLIED_TREE): Promise<CapabilityOutcome> {
	const sheets = await filesBelow(path.join(tree, 'src'), '.scss');
	const relative = (file: string): string => path.relative(tree, file);
	const closure = styleClosure(tree);
	const renames = successorForkRenames(ANGULAR_16_BROWSER_CELL);
	const changed: string[] = [];
	const changes: string[] = [];
	const unhandled: string[] = [];
	for (const file of sheets) {
		const source = await readFile(file, 'utf8');
		const migration = dropWebpackTildeSpecifiers(relative(file), source, closure, renames);
		unhandled.push(...migration.unhandled);
		if (!migration.changed) continue;
		await writeFile(file, migration.source);
		changed.push(relative(file));
		for (const change of migration.changes)
			changes.push(
				`${relative(file)} line ${String(change.line)}: ${change.from} → ${change.to} (resolved ${change.resolved})`,
			);
	}
	return Object.freeze({
		capability: 'webpack-tilde-style-specifier, closure reading the installed exports maps',
		filesChanged: Object.freeze(changed),
		changes: Object.freeze(changes),
		unhandled: Object.freeze(unhandled),
	});
}

/** The rename round, driven by the compiler's own suggestions in a build log. */
export async function suggestedRenameRound(
	log: string,
	tree: string = APPLIED_TREE,
): Promise<CapabilityOutcome> {
	const byFile = readSuggestedExportRenames(log);
	const packages = new Set<string>();
	for (const file of byFile.keys()) {
		const absolute = path.join(tree, file);
		if (!existsSync(absolute)) continue;
		const source = await readFile(absolute, 'utf8');
		const module = parseModule('u18d rename round', file, source);
		for (const record of module.imports) {
			const specifier = record.specifier;
			if (specifier.startsWith('.')) continue;
			const { name, subpath } = splitSpecifier(specifier);
			if (subpath === '') packages.add(name);
		}
	}
	const surfaces: ExportSurfaceReading[] = [];
	for (const name of [...packages].sort())
		if (existsSync(path.join(tree, 'node_modules', name)))
			surfaces.push(await readExportSurface(tree, name));
	const changed: string[] = [];
	const changes: string[] = [];
	const unhandled: string[] = [];
	for (const [file, diagnostics] of byFile) {
		const absolute = path.join(tree, file);
		if (!existsSync(absolute)) {
			unhandled.push(`${file}: the diagnostic names a file the applied tree does not carry`);
			continue;
		}
		const source = await readFile(absolute, 'utf8');
		const migration = applySuggestedExportRenames(
			file,
			source,
			diagnostics as readonly SuggestedExportRenameDiagnostic[],
			surfaces,
		);
		unhandled.push(...migration.unhandled);
		if (!migration.changed) continue;
		await writeFile(absolute, migration.source);
		changed.push(file);
		for (const change of migration.changes)
			changes.push(
				`${file} line ${String(change.line)}: ${change.from} → ${change.to} from ` +
					`'${change.specifier}', with ${String(change.references)} reference(s)`,
			);
	}
	return Object.freeze({
		capability:
			'suggested-export-rename, against ' +
			surfaces
				.map(
					(surface) =>
						`${surface.name}@${surface.version} (${String(surface.exports.length)} exports, complete: ${String(surface.complete)})`,
				)
				.join(', '),
		filesChanged: Object.freeze(changed),
		changes: Object.freeze(changes),
		unhandled: Object.freeze(unhandled),
	});
}

export async function main(): Promise<void> {
	const phase = process.argv[2] ?? 'round';
	if (phase === 'apply') {
		const migration = await composeMigration(SOURCE_TREE);
		const applied = await applyMigration(migration, APPLIED_TREE);
		await writeFile(
			path.join(STAGE_DIRECTORY, 'u18d-applied.json'),
			`${JSON.stringify(
				{
					applicationFilesScanned: migration.applicationFilesScanned,
					applicationFilesChanged: migration.applicationFilesChanged,
					workspaceFilesChanged: migration.workspaceFilesChanged,
					written: applied.written.map((entry) => entry.path),
					removed: applied.removed,
					unhandled: migration.unhandled,
				},
				null,
				'\t',
			)}\n`,
		);
		process.stdout.write(
			`applied ${String(applied.written.length)} files (${String(
				migration.applicationFilesChanged,
			)}/${String(migration.applicationFilesScanned)} application)\n`,
		);
		return;
	}
	const log = await readFile(
		path.join(STAGE_DIRECTORY, process.argv[3] ?? 'build-2.log'),
		'utf8',
	);
	const outcomes: CapabilityOutcome[] = [...(await applyRound())];
	outcomes.push(await tildeRound());
	outcomes.push(await suggestedRenameRound(log));
	await writeFile(
		path.join(STAGE_DIRECTORY, 'u18d-round.json'),
		`${JSON.stringify(outcomes, null, '\t')}\n`,
	);
	for (const outcome of outcomes)
		process.stdout.write(
			`${outcome.capability}: ${String(outcome.filesChanged.length)} files changed, ` +
				`${String(outcome.changes.length)} changes, ${String(outcome.unhandled.length)} refused\n`,
		);
}

if (process.argv[1]?.endsWith('angular-super-productivity-u18d-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
