/**
 * The final lane of the `angular-tiny-translator-v0-12-0` cell: the four
 * residual demands u17c itemised, answered by capabilities, and the production
 * build run again on the result.
 *
 * u17c left the lane at four diagnostics and zero unresolvable specifiers, and
 * named each remaining demand. This driver is what that list was for. It reads
 * the installed closure — `@angular/service-worker`'s own exports map — and the
 * compiler's own `TS2322`, hands both to `@versionless/angular`, and writes
 * back whatever the capabilities produce. Nothing here decides what a symbol
 * maps to or what a call site becomes.
 *
 * Two of the four are pure readings of the parsed module and need no input at
 * all: `entryComponents` is dropped only when the same `@NgModule` literal
 * already reaches every component it names, and `ModuleWithProviders` gets the
 * module its initialiser's receiver states. The other two are readings of
 * something outside the module — the published surface, and the compiler.
 */

import { existsSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import {
	addModuleWithProvidersTypeArgument,
	dropWebpackTildeSpecifiers,
	narrowWidenedAssignments,
	redirectUnreachableImports,
	removeEntryComponents,
	type ClosureFileReading,
	type DeepImportReading,
	type WidenedAssignmentDiagnostic,
} from '../../../frameworks/angular/src/index.ts';
import { APPLIED_TREE, STAGE_DIRECTORY } from './angular-tiny-translator-apply-run.ts';
import { readPackageSurface, type CapabilityOutcome } from './angular-tiny-translator-green-run.ts';

/** The package this application reaches past the published surface of. */
export const DEEP_IMPORT_PACKAGE = '@angular/service-worker';

/**
 * Every specifier the installed package's exports map answers, including the
 * subpaths that carry no declaration file. A wildcard subpath is expanded to
 * nothing and treated as unreachable-by-reading rather than guessed at, so an
 * import matching one is refused instead of redirected.
 */
export async function readReachableSpecifiers(
	tree: string,
	name: string,
): Promise<readonly string[]> {
	const manifest: unknown = JSON.parse(
		await readFile(path.join(tree, 'node_modules', name, 'package.json'), 'utf8'),
	);
	const exportsField = (manifest as Readonly<{ exports?: unknown }>).exports;
	if (typeof exportsField !== 'object' || exportsField === null)
		throw new Error(`${name} publishes no exports map, so its reachable subpaths cannot be read`);
	const specifiers: string[] = [];
	for (const subpath of Object.keys(exportsField as Readonly<Record<string, unknown>>)) {
		if (subpath.includes('*')) continue;
		if (!subpath.startsWith('.')) continue;
		specifiers.push(subpath === '.' ? name : `${name}/${subpath.slice(2)}`);
	}
	return Object.freeze(specifiers.sort());
}

/** The package surface plus its reachable specifiers, as the redirection reads them. */
export async function readDeepImportReading(
	tree: string,
	name: string,
): Promise<DeepImportReading> {
	return Object.freeze({
		surface: await readPackageSurface(tree, name),
		reachableSpecifiers: await readReachableSpecifiers(tree, name),
	});
}

/**
 * The widened-assignment sites a TypeScript build named. Every `TS2322`
 * carries the file, the 1-based position, the type the expression has and the
 * type the position requires — which is the whole of what the narrowing
 * capability reads, and more than the syntax could supply.
 */
export function readWidenedAssignmentDiagnostics(
	log: string,
): ReadonlyMap<string, readonly WidenedAssignmentDiagnostic[]> {
	const found = new Map<string, WidenedAssignmentDiagnostic[]>();
	const pattern =
		/(src\/[^\s():]+\.ts):(\d+):(\d+) - error TS2322: Type '(.+?)' is not assignable to type '(.+?)'\./g;
	for (const match of log.matchAll(pattern)) {
		const [, file, line, column, sourceType, targetType] = match;
		if (
			file === undefined ||
			line === undefined ||
			column === undefined ||
			sourceType === undefined ||
			targetType === undefined
		)
			continue;
		const list = found.get(file) ?? [];
		const diagnostic: WidenedAssignmentDiagnostic = Object.freeze({
			line: Number.parseInt(line, 10),
			column: Number.parseInt(column, 10),
			sourceType,
			targetType,
		});
		if (!list.some((entry) => entry.line === diagnostic.line && entry.column === diagnostic.column))
			list.push(diagnostic);
		found.set(file, list);
	}
	return found;
}

async function filesWithSuffix(root: string, suffixes: readonly string[]): Promise<readonly string[]> {
	const found: string[] = [];
	const walk = async (directory: string): Promise<void> => {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			const full = path.join(directory, entry.name);
			if (entry.isDirectory()) await walk(full);
			else if (suffixes.some((suffix) => entry.name.endsWith(suffix))) found.push(full);
		}
	};
	await walk(root);
	return Object.freeze(found.sort());
}

async function sourceFiles(root: string): Promise<readonly string[]> {
	return await filesWithSuffix(root, ['.ts']);
}

/**
 * Whether the installed closure carries a path, asked of the one directory node
 * resolution would reach a bare specifier through.
 */
export function closureReading(tree: string): ClosureFileReading {
	const modules = path.join(tree, 'node_modules');
	return Object.freeze({
		carries: (relativePath: string): boolean => existsSync(path.join(modules, relativePath)),
	});
}

/**
 * Apply one round of the four capabilities to the applied tree, and report what
 * each of them did and refused.
 *
 * The narrowing runs first, for the reason the RxJS migration ran first in the
 * green lane: its input is a set of compiler positions read from a build of
 * exactly these bytes, and a capability that removed a line above one of them
 * would move it out from under the position.
 */
export async function applyFinalRound(
	diagnosticsLog: string | null,
): Promise<readonly CapabilityOutcome[]> {
	const root = path.join(APPLIED_TREE, 'src');
	const files = await sourceFiles(root);
	const relative = (file: string): string => path.relative(APPLIED_TREE, file);
	const outcomes: CapabilityOutcome[] = [];

	if (diagnosticsLog !== null) {
		const diagnostics = readWidenedAssignmentDiagnostics(await readFile(diagnosticsLog, 'utf8'));
		const changed: string[] = [];
		const changes: string[] = [];
		const differences: string[] = [];
		const unhandled: string[] = [];
		for (const file of files) {
			const name = relative(file);
			const source = await readFile(file, 'utf8');
			const migration = narrowWidenedAssignments(name, source, diagnostics.get(name) ?? []);
			unhandled.push(...migration.unhandled);
			differences.push(...migration.declaredDifferences);
			if (!migration.changed) continue;
			await writeFile(file, migration.source);
			changed.push(name);
			for (const change of migration.changes)
				changes.push(
					`${name} line ${String(change.line)}: ${change.binding} narrowed from ` +
						`${change.sourceType} to ${change.targetType} over ` +
						`${String(change.statementsGuarded)} statements`,
				);
		}
		outcomes.push({
			capability: 'widened-union-narrowing (TS2322)',
			filesChanged: Object.freeze(changed),
			changes: Object.freeze(changes),
			declaredDifferences: Object.freeze(differences),
			unhandled: Object.freeze(unhandled),
		});
	}

	const reading = await readDeepImportReading(APPLIED_TREE, DEEP_IMPORT_PACKAGE);
	const deepChanged: string[] = [];
	const deepChanges: string[] = [];
	const deepUnhandled: string[] = [];
	for (const file of files) {
		const name = relative(file);
		const source = await readFile(file, 'utf8');
		const migration = redirectUnreachableImports(name, source, reading);
		deepUnhandled.push(...migration.unhandled);
		if (!migration.changed) continue;
		await writeFile(file, migration.source);
		deepChanged.push(name);
		for (const change of migration.changes)
			deepChanges.push(
				`${name} line ${String(change.line)}: ${change.symbols.join(', ')} from ${change.from} → ${change.to}`,
			);
	}
	outcomes.push({
		capability: `deep-import-redirection (${DEEP_IMPORT_PACKAGE}@${reading.surface.version})`,
		filesChanged: Object.freeze(deepChanged),
		changes: Object.freeze(deepChanges),
		declaredDifferences: Object.freeze([]),
		unhandled: Object.freeze(deepUnhandled),
	});

	const entryChanged: string[] = [];
	const entryChanges: string[] = [];
	const entryUnhandled: string[] = [];
	for (const file of files) {
		const name = relative(file);
		const source = await readFile(file, 'utf8');
		const migration = removeEntryComponents(name, source);
		entryUnhandled.push(...migration.unhandled);
		if (!migration.changed) continue;
		await writeFile(file, migration.source);
		entryChanged.push(name);
		for (const change of migration.changes)
			entryChanges.push(
				`${name} line ${String(change.line)}: entryComponents [${change.symbols.join(', ')}] dropped`,
			);
	}
	outcomes.push({
		capability: 'entry-components-removal (@angular/core)',
		filesChanged: Object.freeze(entryChanged),
		changes: Object.freeze(entryChanges),
		declaredDifferences: Object.freeze([]),
		unhandled: Object.freeze(entryUnhandled),
	});

	const genericChanged: string[] = [];
	const genericChanges: string[] = [];
	const genericUnhandled: string[] = [];
	for (const file of files) {
		const name = relative(file);
		const source = await readFile(file, 'utf8');
		const migration = addModuleWithProvidersTypeArgument(name, source);
		genericUnhandled.push(...migration.unhandled);
		if (!migration.changed) continue;
		await writeFile(file, migration.source);
		genericChanged.push(name);
		for (const change of migration.changes)
			genericChanges.push(
				`${name} line ${String(change.line)}: ModuleWithProviders<${change.argument}>, read from the ${change.readFrom}`,
			);
	}
	outcomes.push({
		capability: 'module-with-providers-type-argument (@angular/core)',
		filesChanged: Object.freeze(genericChanged),
		changes: Object.freeze(genericChanges),
		declaredDifferences: Object.freeze([]),
		unhandled: Object.freeze(genericUnhandled),
	});

	const closure = closureReading(APPLIED_TREE);
	const styles = await filesWithSuffix(root, ['.scss', '.sass', '.css']);
	const tildeChanged: string[] = [];
	const tildeChanges: string[] = [];
	const tildeUnhandled: string[] = [];
	for (const file of styles) {
		const name = relative(file);
		const source = await readFile(file, 'utf8');
		const migration = dropWebpackTildeSpecifiers(name, source, closure);
		tildeUnhandled.push(...migration.unhandled);
		if (!migration.changed) continue;
		await writeFile(file, migration.source);
		tildeChanged.push(name);
		for (const change of migration.changes)
			tildeChanges.push(
				`${name} line ${String(change.line)}: ${change.from} → ${change.to} (${change.resolved})`,
			);
	}
	outcomes.push({
		capability: 'webpack-tilde-style-specifier (installed closure)',
		filesChanged: Object.freeze(tildeChanged),
		changes: Object.freeze(tildeChanges),
		declaredDifferences: Object.freeze([]),
		unhandled: Object.freeze(tildeUnhandled),
	});

	return Object.freeze(outcomes);
}

export async function main(): Promise<void> {
	const log = process.argv[2] ?? null;
	const outcomes = await applyFinalRound(log === null ? null : path.resolve(log));
	await writeFile(
		path.join(STAGE_DIRECTORY, 'final-round.json'),
		`${JSON.stringify(outcomes, null, '\t')}\n`,
	);
	for (const outcome of outcomes)
		process.stdout.write(
			`${outcome.capability}: ${String(outcome.filesChanged.length)} files changed, ` +
				`${String(outcome.changes.length)} changes, ${String(outcome.unhandled.length)} refused\n`,
		);
}

if (process.argv[1]?.endsWith('angular-tiny-translator-final-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
