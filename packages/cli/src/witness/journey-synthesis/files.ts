/**
 * Locating an application's end-to-end suite on disk.
 *
 * The readers do not take a path from an operator: the whole point of synthesis
 * is that nobody has read this application, so nobody can be asked where its
 * specs are. They are found by the conventions the two runners publish, and the
 * convention that found them is recorded alongside the directory so a reader can
 * see whether the suite was declared or guessed at.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import * as path from 'pathe';

/** Directory entries that are never worth descending into. */
const SKIPPED_DIRECTORIES: readonly string[] = Object.freeze([
	'node_modules',
	'.git',
	'dist',
	'build',
	'coverage',
	'.next',
	'.nuxt',
	'out',
	'screenshots',
	'videos',
	'downloads',
	'snapshots',
]);

export async function directoryExists(target: string): Promise<boolean> {
	try {
		return (await stat(target)).isDirectory();
	} catch {
		return false;
	}
}

export async function fileText(target: string): Promise<string | null> {
	try {
		return await readFile(target, 'utf8');
	} catch {
		return null;
	}
}

/**
 * Every file below `directory` whose base name the predicate admits, sorted, and
 * bounded so a mis-pointed root cannot walk a whole disk.
 */
export async function filesBelow(
	directory: string,
	admits: (name: string) => boolean,
	limit = 400,
): Promise<readonly string[]> {
	const found: string[] = [];
	const walk = async (current: string, depth: number): Promise<void> => {
		if (found.length >= limit || depth > 8) return;
		let entries;
		try {
			entries = await readdir(current, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of [...entries].sort((left, right) => (left.name < right.name ? -1 : 1))) {
			if (found.length >= limit) return;
			if (entry.name.startsWith('.') && entry.name !== '.') continue;
			if (SKIPPED_DIRECTORIES.includes(entry.name)) continue;
			const item = path.join(current, entry.name);
			if (entry.isDirectory()) {
				await walk(item, depth + 1);
				continue;
			}
			if (entry.isFile() && admits(entry.name)) found.push(item);
		}
	};
	await walk(directory, 0);
	return Object.freeze(found.sort());
}

const SPEC_EXTENSIONS: readonly string[] = Object.freeze(['.js', '.jsx', '.ts', '.tsx', '.mjs']);

/** `*.cy.*`, `*.spec.*` and `*.test.*` are the three names both runners admit. */
export function isSpecFileName(name: string): boolean {
	const extension = path.extname(name);
	if (!SPEC_EXTENSIONS.includes(extension)) return false;
	const stem = name.slice(0, name.length - extension.length);
	return stem.endsWith('.cy') || stem.endsWith('.spec') || stem.endsWith('.test');
}

/**
 * A directory admitted by convention, with the convention that admitted it.
 *
 * `basis` is prose rather than an enum because it has to be able to say
 * "`cypress.json` declares integrationFolder: cypress/tests" as readily as
 * "the `cypress/e2e` convention", and a reader needs the difference.
 */
export type LocatedRoot = Readonly<{ directory: string; basis: string }>;

/** Keep the first hit for each directory, so a declared root is not listed twice. */
export function dedupeRoots(roots: readonly LocatedRoot[]): readonly LocatedRoot[] {
	const seen = new Set<string>();
	const kept: LocatedRoot[] = [];
	for (const root of roots) {
		if (seen.has(root.directory)) continue;
		seen.add(root.directory);
		kept.push(root);
	}
	return Object.freeze(kept);
}

/**
 * The value a configuration file assigns to a key, read as a static string.
 *
 * The Cypress and Playwright configurations are programs, so this reads the
 * literal a key is assigned and nothing else: a `testDir` computed from
 * `process.env` is not a directory this reader knows, and returning `null` for
 * it is how the convention search stays in charge instead of a guess.
 */
export function staticConfigString(source: string, key: string): string | null {
	const pattern = new RegExp(
		`['"]?${key}['"]?\\s*:\\s*(?:'([^']*)'|"([^"]*)"|\`([^\`$]*)\`)`,
		'm',
	);
	const match = pattern.exec(source);
	if (match === null) return null;
	return match[1] ?? match[2] ?? match[3] ?? null;
}
