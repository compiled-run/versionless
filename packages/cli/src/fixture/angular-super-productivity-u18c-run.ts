/**
 * The u18c round of the `angular-super-productivity-v2-13-15` cell: the two
 * owed adapter items from u18b, written into the tree the lane already staged,
 * and the production build attempted again on the result.
 *
 * u18b recorded a red build and itemised every demand. Two of those demands were
 * adapter work rather than application work — a `successor-fork` disposition kind
 * the cell did not carry, and an existing capability the era pipeline never
 * called — and both now exist. This driver is what they were for.
 *
 * Two of the demands are answered by closure readings rather than by tables, and
 * the readings are taken here because only the installed tree can answer them:
 * which entry point of the installed Material package publishes each symbol a
 * module names, and whether the successor fork's own root declaration exports
 * every name the application imports from the package it replaces. Nothing in
 * this file decides what a symbol maps to. It decides which tree is read and
 * which tree is written, and hands both readings to `@versionless/angular`.
 *
 * The driver is fixture-scoped: it knows where this fixture's stage tree was
 * materialised and nothing else.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as path from 'pathe';
import {
	dropWebpackTildeSpecifiers,
	migrateSuccessorForkImports,
	parseModule,
	splitBarrelImports,
	successorForkRenames,
	ANGULAR_16_BROWSER_CELL,
	type ClosureFileReading,
	type SuccessorForkPackage,
	type SuccessorSurfaceReading,
} from '../../../frameworks/angular/src/index.ts';
import { applyMigration } from './angular-tiny-translator-apply-run.ts';
import { readPackageSurface } from './angular-tiny-translator-green-run.ts';
import { composeMigration, SOURCE_TREE } from './angular-super-productivity-lanes-run.ts';
import { APPLIED_TREE, STAGE_DIRECTORY } from './angular-super-productivity-apply-run.ts';

/** The package whose barrel this application imports from. */
export const BARREL_PACKAGE = '@angular/material';

/**
 * Every name a package's root declaration exports, following the whole-module
 * re-exports an Angular library's generated entry point is built out of.
 *
 * A published `index.d.ts` that says `export * from './public-api'` enumerates
 * nothing on its own. Following the star is what turns "this file lists no
 * names" into "this package exports these names", and the difference matters
 * exactly once: a capability that treats an unread surface as an empty one
 * refuses every rename for a reason that is not true. A star this reader cannot
 * follow — a re-export of another package, a file that is not on disk — leaves
 * the reading incomplete and says so, which is the honest half of the same
 * distinction.
 */
export async function readSuccessorSurface(
	tree: string,
	name: string,
): Promise<SuccessorSurfaceReading> {
	const directory = path.join(tree, 'node_modules', name);
	const manifest: unknown = JSON.parse(
		await readFile(path.join(directory, 'package.json'), 'utf8'),
	);
	const record = manifest as Readonly<{ version?: unknown; types?: unknown; typings?: unknown }>;
	const declared = typeof record.types === 'string' ? record.types : record.typings;
	const version = typeof record.version === 'string' ? record.version : 'unknown';
	if (typeof declared !== 'string')
		return Object.freeze({
			name,
			version,
			rootExports: Object.freeze([]),
			complete: false,
			incompleteReason: 'the package declares no root declaration file',
		});
	const names = new Set<string>();
	const seen = new Set<string>();
	const unfollowed: string[] = [];
	const resolve = (from: string, specifier: string): string | null => {
		const base = path.resolve(path.dirname(from), specifier);
		for (const candidate of [base, `${base}.d.ts`, path.join(base, 'index.d.ts')])
			if (candidate.endsWith('.d.ts') && existsSync(candidate)) return candidate;
		return null;
	};
	const visit = async (file: string): Promise<void> => {
		if (seen.has(file)) return;
		seen.add(file);
		const source = await readFile(file, 'utf8');
		const module = parseModule('Successor surface reading', file, source);
		for (const entry of module.exports)
			if (!entry.isStar && entry.name !== null && entry.name !== 'default') names.add(entry.name);
		for (const node of module.ast.body) {
			if (node.type !== 'ExportAllDeclaration') continue;
			const specifier = node.source.value;
			if (!specifier.startsWith('.')) {
				unfollowed.push(`${path.relative(directory, file)} re-exports all of ${specifier}`);
				continue;
			}
			const target = resolve(file, specifier);
			if (target === null) {
				unfollowed.push(`${path.relative(directory, file)} re-exports all of ${specifier}, which is not on disk`);
				continue;
			}
			await visit(target);
		}
	};
	await visit(path.join(directory, declared));
	return Object.freeze({
		name,
		version,
		rootExports: Object.freeze([...names].sort()),
		complete: unfollowed.length === 0,
		...(unfollowed.length === 0 ? {} : { incompleteReason: unfollowed.join('; ') }),
	});
}

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

export type CapabilityOutcome = Readonly<{
	capability: string;
	filesChanged: readonly string[];
	changes: readonly string[];
	unhandled: readonly string[];
}>;

/**
 * Apply the closure-read capabilities to the applied tree.
 *
 * The successor-fork rename runs before the barrel split for one reason: both
 * rewrite import declarations, and running them in one pass over stale bytes
 * would let the second overwrite the first. Each capability here reads the file
 * from disk and writes it back, so the order is a statement about which reading
 * is current, not about which transform matters more.
 */
export async function applyRound(tree: string = APPLIED_TREE): Promise<readonly CapabilityOutcome[]> {
	const modules = await filesBelow(path.join(tree, 'src'), '.ts');
	const sheets = await filesBelow(path.join(tree, 'src'), '.scss');
	const relative = (file: string): string => path.relative(tree, file);
	const outcomes: CapabilityOutcome[] = [];

	const renames = successorForkRenames(ANGULAR_16_BROWSER_CELL);
	for (const [name, successor] of Object.entries(renames)) {
		const disposition = ANGULAR_16_BROWSER_CELL.ecosystemPackages[name];
		if (disposition === undefined || disposition.kind !== 'successor-fork') continue;
		const surface = await readSuccessorSurface(tree, successor);
		const changed: string[] = [];
		const changes: string[] = [];
		const unhandled: string[] = [];
		for (const file of modules) {
			const source = await readFile(file, 'utf8');
			const migration = migrateSuccessorForkImports(relative(file), source, {
				name,
				disposition: disposition as SuccessorForkPackage,
				surface,
			});
			unhandled.push(...migration.unhandled);
			if (!migration.changed) continue;
			await writeFile(file, migration.source);
			changed.push(relative(file));
			for (const change of migration.changes)
				changes.push(
					`${relative(file)} line ${String(change.line)}: ${change.symbols.join(', ')} from ` +
						`${change.from} → ${change.to}`,
				);
		}
		outcomes.push({
			capability: `successor-fork-package (${name} → ${surface.name}@${surface.version}, ${String(surface.rootExports.length)} root exports read, complete: ${String(surface.complete)})`,
			filesChanged: Object.freeze(changed),
			changes: Object.freeze(changes),
			unhandled: Object.freeze(unhandled),
		});
	}

	const barrel = await readPackageSurface(tree, BARREL_PACKAGE);
	const barrelChanged: string[] = [];
	const barrelChanges: string[] = [];
	const barrelUnhandled: string[] = [];
	for (const file of modules) {
		const source = await readFile(file, 'utf8');
		const migration = splitBarrelImports(relative(file), source, barrel);
		barrelUnhandled.push(...migration.unhandled);
		if (!migration.changed) continue;
		await writeFile(file, migration.source);
		barrelChanged.push(relative(file));
		for (const change of migration.changes)
			barrelChanges.push(
				`${relative(file)} line ${String(change.line)}: ${change.symbols.join(', ')} → ${change.to}`,
			);
	}
	outcomes.push({
		capability: `barrel-entry-point-split (${BARREL_PACKAGE}@${barrel.version})`,
		filesChanged: Object.freeze(barrelChanged),
		changes: Object.freeze(barrelChanges),
		unhandled: Object.freeze(barrelUnhandled),
	});

	/**
	 * The one question the tilde capability asks of the file system, answered
	 * against the closure the build will actually resolve against.
	 */
	const closure: ClosureFileReading = Object.freeze({
		carries: (relativePath: string): boolean =>
			existsSync(path.join(tree, 'node_modules', relativePath)),
	});
	const tildeChanged: string[] = [];
	const tildeChanges: string[] = [];
	const tildeUnhandled: string[] = [];
	for (const file of sheets) {
		const source = await readFile(file, 'utf8');
		const migration = dropWebpackTildeSpecifiers(relative(file), source, closure, renames);
		tildeUnhandled.push(...migration.unhandled);
		if (!migration.changed) continue;
		await writeFile(file, migration.source);
		tildeChanged.push(relative(file));
		for (const change of migration.changes)
			tildeChanges.push(
				`${relative(file)} line ${String(change.line)}: ${change.from} → ${change.to} (resolved ${change.resolved})`,
			);
	}
	outcomes.push({
		capability: 'webpack-tilde-style-specifier',
		filesChanged: Object.freeze(tildeChanged),
		changes: Object.freeze(tildeChanges),
		unhandled: Object.freeze(tildeUnhandled),
	});

	return Object.freeze(outcomes);
}

export async function main(): Promise<void> {
	const phase = process.argv[2] ?? 'round';
	if (phase === 'apply') {
		const migration = await composeMigration(SOURCE_TREE);
		const applied = await applyMigration(migration, APPLIED_TREE);
		await writeFile(
			path.join(STAGE_DIRECTORY, 'u18c-applied.json'),
			`${JSON.stringify(
				{
					applicationFilesScanned: migration.applicationFilesScanned,
					applicationFilesChanged: migration.applicationFilesChanged,
					workspaceFilesChanged: migration.workspaceFilesChanged,
					written: applied.written.map((entry) => entry.path),
					removed: applied.removed,
					declaredDifferences: migration.declaredDifferences,
					unhandled: migration.unhandled,
				},
				null,
				'\t',
			)}\n`,
		);
		process.stdout.write(
			`applied ${String(applied.written.length)} files (${String(
				migration.applicationFilesChanged,
			)}/${String(migration.applicationFilesScanned)} application, ${String(
				migration.workspaceFilesChanged,
			)} workspace), ${String(migration.unhandled.length)} unhandled\n`,
		);
		return;
	}
	const outcomes = await applyRound();
	await writeFile(
		path.join(STAGE_DIRECTORY, 'u18c-round.json'),
		`${JSON.stringify(outcomes, null, '\t')}\n`,
	);
	for (const outcome of outcomes)
		process.stdout.write(
			`${outcome.capability}: ${String(outcome.filesChanged.length)} files changed, ` +
				`${String(outcome.changes.length)} changes, ${String(outcome.unhandled.length)} refused\n`,
		);
}

if (process.argv[1]?.endsWith('angular-super-productivity-u18c-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
