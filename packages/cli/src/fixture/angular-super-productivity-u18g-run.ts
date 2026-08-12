/**
 * The u18g round of the `angular-super-productivity-v2-13-15` cell: the two
 * TypeScript-line families u18f named as the cheapest remaining, read with the
 * readings each one needs, and the production build attempted on the result.
 *
 * Neither is a library migration. TS1259 is the compiler objecting to a default
 * import of a package that gained `export =` typings between the two eras, and
 * the answer is a compiler flag rather than an edit to the line; TS2794 is the
 * compiler objecting to `resolve()` in an un-parameterised promise executor, and
 * naming the type argument that fixes it in the diagnostic text itself.
 *
 * What this driver measures is the evidence each capability refuses on. For the
 * flag: every bare default import in the application, every namespace import it
 * calls as a function, and — for each package so imported — the declaration
 * entry the installed package points at and whether that entry ends in an export
 * assignment or names an ES default. For the executors: nothing beyond the
 * modules the compiler itself named, because the whole of the evidence for
 * `void` is inside the executor.
 *
 * Nothing here decides what a flag or a type argument means. It decides which
 * tree is read and which tree is written.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as path from 'pathe';
import {
	enableSyntheticDefaultImports,
	packageOfSpecifier,
	parameteriseVoidPromiseExecutors,
	readModuleInterop,
	type ExportAssignmentReading,
	type ModuleInteropReading,
} from '../../../frameworks/angular/src/index.ts';
import { APPLIED_TREE, STAGE_DIRECTORY } from './angular-super-productivity-apply-run.ts';
import { applyRound, type CapabilityOutcome } from './angular-super-productivity-u18c-run.ts';

/** Every file below `root` with `extension`, in a stable order. */
async function filesBelow(root: string, extension: string): Promise<readonly string[]> {
	const { readdir } = await import('node:fs/promises');
	const found: string[] = [];
	const walk = async (directory: string): Promise<void> => {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			const absolute = path.join(directory, entry.name);
			if (entry.isDirectory()) await walk(absolute);
			else if (entry.name.endsWith(extension)) found.push(absolute);
		}
	};
	if (existsSync(root)) await walk(root);
	return Object.freeze(found.sort());
}

/** The `types` condition of an exports entry, however it is nested. */
function typesOf(value: unknown): string | null {
	if (typeof value === 'string') return value.endsWith('.d.ts') ? value : null;
	if (typeof value !== 'object' || value === null) return null;
	const record = value as Record<string, unknown>;
	for (const key of ['types', 'typings', 'default', 'import', 'require', 'node']) {
		const found = typesOf(record[key]);
		if (found !== null) return found;
	}
	return null;
}

/**
 * What one installed package's declaration entry says about how it may be
 * imported.
 *
 * The two facts are read off the entry file's own text: `export = X` is the
 * shape that makes a default import illegal without the flag, and
 * `export default` is the shape that makes it legal without one. A package with
 * no declaration entry is recorded as such rather than guessed at — an untyped
 * import raises no TS1259 and demands nothing.
 */
async function readExportAssignment(
	tree: string,
	name: string,
): Promise<ExportAssignmentReading> {
	const root = path.join(tree, 'node_modules', name);
	const absent: ExportAssignmentReading = Object.freeze({
		package: name,
		version: 'unknown',
		declarationFile: null,
		exportAssignment: false,
		esDefaultExport: false,
		complete: false,
	});
	if (!existsSync(path.join(root, 'package.json'))) return absent;
	const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as Readonly<{
		version?: unknown;
		types?: unknown;
		typings?: unknown;
		exports?: unknown;
	}>;
	const version = typeof manifest.version === 'string' ? manifest.version : 'unknown';
	const declared =
		typeof manifest.types === 'string'
			? manifest.types
			: typeof manifest.typings === 'string'
				? manifest.typings
				: typesOf(manifest.exports);
	// A package with no declared entry may still be typed by a sibling
	// `index.d.ts`, which is what node's own resolution falls back to.
	const fallback = existsSync(path.join(root, 'index.d.ts')) ? 'index.d.ts' : null;
	const entry = declared ?? fallback;
	if (entry === null)
		return Object.freeze({ ...absent, version, complete: true });
	const file = path.join(root, entry);
	if (!existsSync(file)) return Object.freeze({ ...absent, version });
	const source = await readFile(file, 'utf8');
	return Object.freeze({
		package: name,
		version,
		declarationFile: entry,
		exportAssignment: /^export\s*=\s*/mu.test(source),
		esDefaultExport: /^export\s+default\b/mu.test(source),
		complete: true,
	});
}

/**
 * The synthetic-default-import round. Driven by the tree rather than by the log:
 * a compiler flag applies to every module in the program, so the reading that
 * justifies it has to be of every module too.
 */
async function interopRound(): Promise<CapabilityOutcome> {
	const modules = await filesBelow(path.join(APPLIED_TREE, 'src'), '.ts');
	const readings: ModuleInteropReading[] = [];
	for (const file of modules) {
		const source = await readFile(file, 'utf8');
		readings.push(readModuleInterop(path.relative(APPLIED_TREE, file), source));
	}
	const wanted = new Set<string>();
	for (const reading of readings)
		for (const site of reading.defaultImports) wanted.add(packageOfSpecifier(site.specifier));
	const packages: ExportAssignmentReading[] = [];
	for (const name of [...wanted].sort())
		packages.push(await readExportAssignment(APPLIED_TREE, name));

	const config = path.join(APPLIED_TREE, 'tsconfig.json');
	const migration = enableSyntheticDefaultImports(
		await readFile(config, 'utf8'),
		readings,
		packages,
	);
	const changed: string[] = [];
	const changes: string[] = [];
	if (migration.changed) {
		await writeFile(config, migration.config);
		changed.push('tsconfig.json');
		for (const change of migration.changes)
			changes.push(
				`tsconfig.json: ${change.path} ${change.from ?? 'undeclared'} → ${change.to}, ` +
					`required by ${change.requiredBy.join('; ')}`,
			);
	}
	const defaults = readings.reduce((total, entry) => total + entry.defaultImports.length, 0);
	const called = readings.reduce(
		(total, entry) => total + entry.calledNamespaceImports.length,
		0,
	);
	return Object.freeze({
		capability:
			`synthetic-default-import-interop, against ${String(modules.length)} modules ` +
			`(${String(defaults)} bare default import(s), ${String(called)} called namespace ` +
			`import(s)) and ${packages
				.map(
					(entry) =>
						`'${entry.package}'@${entry.version} (${entry.declarationFile ?? 'no typings'}, ` +
						`export =: ${String(entry.exportAssignment)}, export default: ` +
						`${String(entry.esDefaultExport)})`,
				)
				.join(', ')}`,
		filesChanged: Object.freeze(changed),
		changes: Object.freeze(changes),
		unhandled: Object.freeze(migration.unhandled),
	});
}

/** The promise-executor round, driven by the compiler's own TS2794 lines. */
async function voidExecutorRound(log: string): Promise<CapabilityOutcome> {
	const wanted = new Set<string>();
	for (const raw of log.split('\n')) {
		const line = raw.trim();
		if (!line.includes(' - error TS2794: ')) continue;
		const head = line.split(' - error TS2794: ')[0] ?? '';
		const parts = head.split(':');
		if (parts.length < 3) continue;
		wanted.add(parts.slice(0, -2).join(':').replace('Error: ', ''));
	}
	const changed: string[] = [];
	const changes: string[] = [];
	const unhandled: string[] = [];
	for (const file of [...wanted].sort()) {
		const absolute = path.join(APPLIED_TREE, file);
		if (!existsSync(absolute) || !file.endsWith('.ts')) {
			unhandled.push(`${file}: the diagnostic names a file the applied tree does not carry`);
			continue;
		}
		const source = await readFile(absolute, 'utf8');
		const migration = parameteriseVoidPromiseExecutors(file, source);
		unhandled.push(...migration.unhandled);
		if (!migration.changed) continue;
		await writeFile(absolute, migration.source);
		changed.push(file);
		for (const change of migration.changes)
			changes.push(
				`${file} line ${String(change.line)}: new Promise(…) → new Promise<void>(…) ` +
					`(${change.parameter}, ${String(change.callSites)} zero-argument settle(s))`,
			);
	}
	return Object.freeze({
		capability: `promise-executor-void-parameter, against ${String(wanted.size)} module(s) the compiler named`,
		filesChanged: Object.freeze(changed),
		changes: Object.freeze(changes),
		unhandled: Object.freeze(unhandled.sort()),
	});
}

export async function main(): Promise<void> {
	const log = await readFile(path.join(STAGE_DIRECTORY, process.argv[2] ?? 'build-5.log'), 'utf8');
	const outcomes: CapabilityOutcome[] = [...(await applyRound())];
	outcomes.push(await interopRound());
	outcomes.push(await voidExecutorRound(log));
	await writeFile(
		path.join(STAGE_DIRECTORY, 'u18g-round.json'),
		`${JSON.stringify(outcomes, null, '\t')}\n`,
	);
	for (const outcome of outcomes)
		process.stdout.write(
			`${outcome.capability}: ${String(outcome.filesChanged.length)} files changed, ` +
				`${String(outcome.changes.length)} changes, ${String(outcome.unhandled.length)} refused\n`,
		);
}

if (process.argv[1]?.endsWith('angular-super-productivity-u18g-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
