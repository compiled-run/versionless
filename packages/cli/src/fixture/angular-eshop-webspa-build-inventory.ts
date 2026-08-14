/**
 * Inventory two production builds of the migrated eShopOnContainers WebSPA lane
 * and compare them byte for byte.
 *
 * A build that completes is not yet a build that means anything. What makes the
 * output a fact rather than an event is that the same tree, built twice in the
 * same cell, emits the same bytes — so this driver records both runs by path,
 * size and digest, and states the comparison rather than asserting it. A file
 * present in one run and not the other, or present in both with different
 * content, is named individually: a hashed filename that moves between runs is
 * exactly the kind of difference an "identical" summary would otherwise hide.
 *
 * It reads directories and writes one record. Nothing here builds anything, and
 * nothing here knows what the application is; it is pointed at two directories
 * the caller already produced.
 */

import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { canonical, sha256 } from './angular-factoriolab-migration-run.ts';

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');

/** One emitted file: where it sits under the output root, its size and its digest. */
export type InventoryEntry = Readonly<{ path: string; bytes: number; sha256: string }>;

/** One run's whole output, with the label the record carries it under. */
export type BuildInventory = Readonly<{
	dirLabel: string;
	files: number;
	totalBytes: number;
	entries: readonly InventoryEntry[];
}>;

export type InventoryComparison = Readonly<{
	byteIdentical: boolean;
	onlyInRunA: readonly string[];
	onlyInRunB: readonly string[];
	differingContent: readonly string[];
}>;

/**
 * Every file below `directory`, by output-relative path.
 *
 * The order is the one the baseline lane's own inventory was written in, so the
 * two records can be read side by side without either being re-sorted first.
 */
export async function inventoryOf(directory: string, dirLabel: string): Promise<BuildInventory> {
	const entries: InventoryEntry[] = [];
	const walk = async (current: string): Promise<void> => {
		for (const entry of await readdir(current, { withFileTypes: true })) {
			const item = path.join(current, entry.name);
			if (entry.isDirectory()) {
				await walk(item);
				continue;
			}
			if (!entry.isFile()) continue;
			entries.push(
				Object.freeze({
					path: path.relative(directory, item),
					bytes: (await stat(item)).size,
					sha256: sha256(await readFile(item)),
				}),
			);
		}
	};
	await walk(directory);
	entries.sort((left, right) => left.path.localeCompare(right.path));
	return Object.freeze({
		dirLabel,
		files: entries.length,
		totalBytes: entries.reduce((total, entry) => total + entry.bytes, 0),
		entries: Object.freeze(entries),
	});
}

/** What the two inventories say about each other, file by file. */
export function compareInventories(runA: BuildInventory, runB: BuildInventory): InventoryComparison {
	const a = new Map(runA.entries.map((entry) => [entry.path, entry] as const));
	const b = new Map(runB.entries.map((entry) => [entry.path, entry] as const));
	const onlyInRunA = [...a.keys()].filter((key) => !b.has(key)).sort();
	const onlyInRunB = [...b.keys()].filter((key) => !a.has(key)).sort();
	const differingContent = [...a.entries()]
		.filter(([key, entry]) => {
			const other = b.get(key);
			return other !== undefined && other.sha256 !== entry.sha256;
		})
		.map(([key]) => key)
		.sort();
	return Object.freeze({
		byteIdentical:
			onlyInRunA.length === 0 && onlyInRunB.length === 0 && differingContent.length === 0,
		onlyInRunA: Object.freeze(onlyInRunA),
		onlyInRunB: Object.freeze(onlyInRunB),
		differingContent: Object.freeze(differingContent),
	});
}

export function buildInventoryRecord(
	runA: BuildInventory,
	runB: BuildInventory,
): Record<string, unknown> {
	return { runA, runB, comparison: compareInventories(runA, runB) };
}

export async function main(): Promise<void> {
	const [runADirectory, runBDirectory, out] = process.argv.slice(2);
	if (runADirectory === undefined || runBDirectory === undefined || out === undefined)
		throw new Error(
			'angular-eshop-webspa-build-inventory: expected <run-a-directory> <run-b-directory> <output-file>',
		);
	const runA = await inventoryOf(runADirectory, 'u4-build-run1');
	const runB = await inventoryOf(runBDirectory, 'u4-build-run2');
	const record = buildInventoryRecord(runA, runB);
	await writeFile(out, canonical(record));
	const comparison = record['comparison'] as InventoryComparison;
	process.stdout.write(
		`${String(runA.files)} files, ${String(runA.totalBytes)} bytes; byte-identical across runs: ` +
			`${String(comparison.byteIdentical)}; wrote ${path.relative(repositoryRoot, out)}\n`,
	);
}

if (process.argv[1]?.endsWith('angular-eshop-webspa-build-inventory.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
