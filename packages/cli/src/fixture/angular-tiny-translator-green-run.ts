/**
 * The green lane of the `angular-tiny-translator-v0-12-0` cell: the four demand
 * families u17b itemised, answered by capabilities, and the production build run
 * again on the result.
 *
 * u17b recorded a red build and named every demand. This driver is what the list
 * was for. It reads the installed closure — @angular/material's own entry-point
 * surface and RxJS's own export surface — hands those readings to
 * `@versionless/angular`, and writes back whatever the capabilities produce.
 * Nothing in this file decides what a symbol maps to or what a call site becomes;
 * it decides only which tree is being rewritten and where the compiler's
 * diagnostics were read from.
 *
 * The RxJS transform is diagnostic-driven, and that makes the lane iterative by
 * construction: a `.map` on a receiver the compiler has already given up on is
 * typed `any` and produces no diagnostic, so it becomes visible only once the
 * call before it is fixed. Each round is a build, a diagnostic read, and an
 * application; the record names how many rounds it took and what each one moved.
 */

import { readFile, readdir, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import {
	migrateNodeCoreBindings,
	migrateRxjsPrototypePatches,
	readEntryPointSurface,
	splitBarrelImports,
	type EntryPointSurface,
	type PackageSurfaceReading,
	type PatchedCallDiagnostic,
	type RxjsSurfaceReading,
} from '../../../frameworks/angular/src/index.ts';
import { APPLIED_TREE, STAGE_DIRECTORY } from './angular-tiny-translator-apply-run.ts';

/** The package whose barrel this application imports from. */
export const BARREL_PACKAGE = '@angular/material';
/** The Node core module this application's browser code reaches. */
export const CORE_SPECIFIER = 'util';

type ExportsMap = Readonly<Record<string, unknown>>;

function typesTarget(target: unknown): string | null {
	if (typeof target === 'string') return target.endsWith('.d.ts') ? target : null;
	if (typeof target !== 'object' || target === null) return null;
	const map = target as Readonly<Record<string, unknown>>;
	const types = map['types'];
	if (typeof types === 'string') return types;
	const fallback = map['default'];
	return typeof fallback === 'string' && fallback.endsWith('.d.ts') ? fallback : null;
}

/**
 * Every entry point an installed package publishes a declaration file for, read
 * from its own `exports` map. A subpath with a wildcard is skipped: it names a
 * family of files rather than an entry point, and nothing can be resolved into
 * it without inventing the star.
 */
export async function readPackageSurface(
	tree: string,
	name: string,
): Promise<PackageSurfaceReading> {
	const directory = path.join(tree, 'node_modules', name);
	const manifest: unknown = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
	const record = manifest as Readonly<{ version?: unknown; exports?: unknown }>;
	const exportsField = record.exports;
	if (typeof exportsField !== 'object' || exportsField === null)
		throw new Error(`${name} publishes no exports map, so its entry points cannot be enumerated`);
	const entryPoints: EntryPointSurface[] = [];
	for (const [subpath, target] of Object.entries(exportsField as ExportsMap)) {
		if (subpath.includes('*')) continue;
		const types = typesTarget(target);
		if (types === null) continue;
		const file = path.join(directory, types);
		const declaration = await readFile(file, 'utf8').catch(() => null);
		if (declaration === null) continue;
		entryPoints.push(readEntryPointSurface(name, subpath, declaration));
	}
	return Object.freeze({
		name,
		version: typeof record.version === 'string' ? record.version : 'unknown',
		entryPoints: Object.freeze(entryPoints),
	});
}

/** The installed RxJS root and pipeable-operator surfaces. */
export async function readRxjsSurface(tree: string): Promise<RxjsSurfaceReading> {
	const surface = await readPackageSurface(tree, 'rxjs');
	const entry = (subpath: string): readonly string[] =>
		surface.entryPoints.find((candidate) => candidate.subpath === subpath)?.exports ?? [];
	return Object.freeze({
		version: surface.version,
		rootExports: entry('.'),
		operatorExports: entry('./operators'),
	});
}

/**
 * The patched call sites a TypeScript build named. Every `TS2339` diagnostic
 * carries the file, the 1-based position, the property and the receiver's type,
 * which is the whole of what the RxJS capability needs and more than any reading
 * of the syntax could supply.
 */
export function readPatchedCallDiagnostics(
	log: string,
): ReadonlyMap<string, readonly PatchedCallDiagnostic[]> {
	const found = new Map<string, PatchedCallDiagnostic[]>();
	const pattern =
		/(src\/[^\s():]+\.ts):(\d+):(\d+) - error TS2339: Property '([^']+)' does not exist on type '(.+)'\./g;
	for (const match of log.matchAll(pattern)) {
		const [, file, line, column, property, receiverType] = match;
		if (
			file === undefined ||
			line === undefined ||
			column === undefined ||
			property === undefined ||
			receiverType === undefined
		)
			continue;
		const list = found.get(file) ?? [];
		const diagnostic: PatchedCallDiagnostic = Object.freeze({
			line: Number.parseInt(line, 10),
			column: Number.parseInt(column, 10),
			property,
			receiverType,
		});
		if (!list.some((entry) => entry.line === diagnostic.line && entry.column === diagnostic.column))
			list.push(diagnostic);
		found.set(file, list);
	}
	return found;
}

async function sourceFiles(root: string): Promise<readonly string[]> {
	const found: string[] = [];
	const walk = async (directory: string): Promise<void> => {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			const full = path.join(directory, entry.name);
			if (entry.isDirectory()) await walk(full);
			else if (entry.name.endsWith('.ts')) found.push(full);
		}
	};
	await walk(root);
	return Object.freeze(found.sort());
}

export type CapabilityOutcome = Readonly<{
	capability: string;
	filesChanged: readonly string[];
	changes: readonly string[];
	declaredDifferences: readonly string[];
	unhandled: readonly string[];
}>;

/**
 * Apply one round of the three capabilities to the applied tree, and report what
 * each of them did and refused.
 *
 * The RxJS capability runs first, and the order is load-bearing: its input is a
 * set of compiler positions read from the build of exactly these bytes, and a
 * capability that removed an import line before it ran would move every line
 * below the removal out from under those positions. The other two resolve their
 * own sites from the parsed module and do not care when they run.
 */
export async function applyRound(
	diagnosticsLog: string | null,
): Promise<readonly CapabilityOutcome[]> {
	const root = path.join(APPLIED_TREE, 'src');
	const files = await sourceFiles(root);
	const relative = (file: string): string => path.relative(APPLIED_TREE, file);
	const outcomes: CapabilityOutcome[] = [];

	if (diagnosticsLog !== null) {
		const rxjs = await readRxjsSurface(APPLIED_TREE);
		const diagnostics = readPatchedCallDiagnostics(await readFile(diagnosticsLog, 'utf8'));
		const rxjsChanged: string[] = [];
		const rxjsChanges: string[] = [];
		const rxjsUnhandled: string[] = [];
		for (const file of files) {
			const name = relative(file);
			const source = await readFile(file, 'utf8');
			const migration = migrateRxjsPrototypePatches(
				name,
				source,
				diagnostics.get(name) ?? [],
				rxjs,
			);
			rxjsUnhandled.push(...migration.unhandled);
			if (!migration.changed) continue;
			await writeFile(file, migration.source);
			rxjsChanged.push(name);
			for (const change of migration.changes)
				rxjsChanges.push(`${name} line ${String(change.line)}: ${change.from} → ${change.to}`);
		}
		outcomes.push({
			capability: `rxjs-prototype-patch-migration (rxjs@${rxjs.version})`,
			filesChanged: Object.freeze(rxjsChanged),
			changes: Object.freeze(rxjsChanges),
			declaredDifferences: Object.freeze([]),
			unhandled: Object.freeze(rxjsUnhandled),
		});
	}
	const barrel = await readPackageSurface(APPLIED_TREE, BARREL_PACKAGE);
	const barrelChanged: string[] = [];
	const barrelChanges: string[] = [];
	const barrelUnhandled: string[] = [];
	for (const file of files) {
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
		declaredDifferences: Object.freeze([]),
		unhandled: Object.freeze(barrelUnhandled),
	});

	const coreChanged: string[] = [];
	const coreChanges: string[] = [];
	const coreDifferences: string[] = [];
	const coreUnhandled: string[] = [];
	for (const file of files) {
		const source = await readFile(file, 'utf8');
		const migration = migrateNodeCoreBindings(relative(file), source, CORE_SPECIFIER);
		coreUnhandled.push(...migration.unhandled);
		coreDifferences.push(...migration.declaredDifferences);
		if (!migration.changed) continue;
		await writeFile(file, migration.source);
		coreChanged.push(relative(file));
		for (const change of migration.changes)
			coreChanges.push(`${relative(file)} line ${String(change.line)}: ${change.kind}`);
	}
	outcomes.push({
		capability: `node-core-binding-migration ('${CORE_SPECIFIER}')`,
		filesChanged: Object.freeze(coreChanged),
		changes: Object.freeze(coreChanges),
		declaredDifferences: Object.freeze(coreDifferences),
		unhandled: Object.freeze(coreUnhandled),
	});

	return Object.freeze(outcomes);
}

export async function main(): Promise<void> {
	const log = process.argv[2] ?? null;
	const outcomes = await applyRound(log === null ? null : path.resolve(log));
	await writeFile(
		path.join(STAGE_DIRECTORY, 'green-round.json'),
		`${JSON.stringify(outcomes, null, '\t')}\n`,
	);
	for (const outcome of outcomes)
		process.stdout.write(
			`${outcome.capability}: ${String(outcome.filesChanged.length)} files changed, ` +
				`${String(outcome.changes.length)} changes, ${String(outcome.unhandled.length)} refused\n`,
		);
}

if (process.argv[1]?.endsWith('angular-tiny-translator-green-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
