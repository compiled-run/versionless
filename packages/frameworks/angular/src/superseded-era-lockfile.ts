/**
 * The era lockfile, declared superseded by the manifest the alignment rewrote.
 *
 * A lockfile is not a configuration file the migration can translate. It is a
 * *resolution* — one package manager's record of the exact closure it computed
 * for a particular manifest — and the moment the manifest asks for different
 * ranges, that record describes a closure nobody asked for. Left in the tree it
 * is not inert: npm reads it first, resolves the era pins it names, and reports a
 * conflict about versions the migrated manifest never mentions. The refusal names
 * the lockfile's numbers, so it reads as a defect in the migration rather than as
 * a stale file.
 *
 * Every lane before this one moved the file out by convention. That was the right
 * thing to do and the wrong place to record it: a changeset that leaves the fact
 * out describes a tree that cannot be installed, and a convention is not part of
 * the changeset. This capability puts the fact where `tslint.json`'s removal
 * already lives — a removal in the changeset with the reason stated as a declared
 * difference.
 *
 * ## The scope is measured, not assumed
 *
 * Nothing here removes a lockfile because a migration ran. A lockfile is
 * superseded only when the *bytes of that lockfile* contradict the *bytes of the
 * migrated manifest*: the lockfile resolves a package the migrated manifest
 * declares to a version outside the major the migrated range names. That is a
 * reading of both documents, and it produces the two answers a reading should:
 *
 * - a lockfile that pins `@angular/core` at 6.1.4 beside a manifest that now asks
 *   for `^16.2.0` is superseded, and the contradiction is named package by
 *   package in the declared difference,
 * - a lockfile that agrees with every range the migrated manifest declares is
 *   *retained*, because it is still that manifest's own resolution and throwing
 *   it away would discard a reproducibility the workspace had.
 *
 * A caller that supplies no lockfile has none removed. The capability reads what
 * it is handed rather than the file system, and a lockfile in a format it cannot
 * read — a `yarn.lock`, a `pnpm-lock.yaml`, a JSON document that is not an npm
 * lockfile — is reported as unhandled and left exactly where it is, because
 * deleting a file whose contents it could not read is what a capability that
 * deletes files it does not understand looks like.
 */

import { compareStrings, majorOf, type PackageManifest } from './angular-target-cell.ts';

/** The dependency fields a lockfile's top level is compared against. */
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies'] as const;

/** One lockfile, as the caller read it out of the workspace. */
export type LockfileReading = Readonly<{ path: string; source: string }>;

/** One package the lockfile resolved, and the version it resolved it to. */
export type LockedResolution = Readonly<{ name: string; version: string }>;

/**
 * One declaration the lockfile and the migrated manifest disagree about: the
 * version the lockfile holds, and the range the manifest now asks for.
 */
export type LockfileContradiction = Readonly<{
	name: string;
	locked: string;
	declared: string;
}>;

export type LockfileSupersession = Readonly<{
	/** The workspace-relative path of the superseded lockfile. */
	at: string;
	/** Why it is superseded, recorded verbatim in evidence. */
	reason: string;
	/** The disagreements that established it, in name order. */
	contradictions: readonly LockfileContradiction[];
}>;

export type LockfileSupersessionResult = Readonly<{
	superseded: readonly LockfileSupersession[];
	/** Lockfiles this capability could not read, and therefore did not touch. */
	unhandled: readonly string[];
}>;

/** The npm lockfile documents this capability can read. */
export const NPM_LOCKFILE_FILENAMES: readonly string[] = Object.freeze([
	'package-lock.json',
	'npm-shrinkwrap.json',
]);

function basenameOf(path: string): string {
	const slash = path.lastIndexOf('/');
	return slash === -1 ? path : path.slice(slash + 1);
}

/** True for a path naming an npm lockfile, at any depth. */
export function isNpmLockfilePath(path: string): boolean {
	return NPM_LOCKFILE_FILENAMES.includes(basenameOf(path));
}

function objectAt(value: unknown): Readonly<Record<string, unknown>> | null {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
	return value as Readonly<Record<string, unknown>>;
}

/**
 * The top-level resolutions an npm lockfile records, in either of the two shapes
 * npm has written.
 *
 * `lockfileVersion` 1 writes a `dependencies` map keyed by package name, whose
 * nested `dependencies` are the transitive tree; only the top level is read,
 * because only the top level is what the manifest declares. `lockfileVersion` 2
 * and 3 write a `packages` map keyed by installed path, where the direct
 * dependencies are the `node_modules/<name>` entries with no second
 * `node_modules` segment in the key — a nested key names a package installed for
 * another package, which no manifest declares.
 *
 * Returns null for a document that is not an npm lockfile at all. The distinction
 * between "no resolutions" and "not readable" is the whole reason this returns
 * null rather than an empty list: a lockfile with no dependencies is a lockfile
 * that contradicts nothing, and a document that could not be read is not evidence
 * of anything.
 */
export function readNpmLockfileResolutions(source: string): readonly LockedResolution[] | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(source) as unknown;
	} catch {
		return null;
	}
	const document = objectAt(parsed);
	if (document === null) return null;
	const resolutions: LockedResolution[] = [];
	const packages = objectAt(document['packages']);
	if (packages !== null) {
		for (const [key, value] of Object.entries(packages)) {
			const marker = 'node_modules/';
			const at = key.indexOf(marker);
			if (at !== 0) continue;
			const name = key.slice(marker.length);
			if (name === '' || name.includes(marker)) continue;
			const entry = objectAt(value);
			const version = entry?.['version'];
			if (typeof version === 'string') resolutions.push(Object.freeze({ name, version }));
		}
	}
	const dependencies = objectAt(document['dependencies']);
	if (dependencies !== null && packages === null) {
		for (const [name, value] of Object.entries(dependencies)) {
			const entry = objectAt(value);
			const version = entry?.['version'];
			if (typeof version === 'string') resolutions.push(Object.freeze({ name, version }));
		}
	}
	if (packages === null && dependencies === null) {
		/**
		 * A JSON document with neither map is only an npm lockfile if it says so.
		 * `lockfileVersion` is the one field every generation of the format writes,
		 * so an empty lockfile is readable and a JSON file that is not a lockfile is
		 * not.
		 */
		if (typeof document['lockfileVersion'] !== 'number') return null;
	}
	return Object.freeze(resolutions.sort((left, right) => compareStrings(left.name, right.name)));
}

/**
 * The major a range asks for, or null when the range names none.
 *
 * A range is compared at its major and nothing finer, because that is what this
 * capability can establish without resolving semantics it does not implement: a
 * locked 6.1.4 against a declared `^16.2.0` is a contradiction on any reading,
 * where a locked 16.2.9 against `^16.2.0` may or may not satisfy it and this is
 * not the place that decides. Comparing majors makes the false-positive direction
 * impossible: a lockfile is never called superseded over a disagreement that a
 * resolver might have accepted.
 */
export function declaredRangeMajor(range: string): number | null {
	let index = 0;
	while (index < range.length && !isDigit(range[index] as string)) {
		const character = range[index] as string;
		if (character === '*' || character === 'x' || character === 'X') return null;
		index += 1;
	}
	if (index >= range.length) return null;
	return majorOf(range.slice(index));
}

function isDigit(character: string): boolean {
	return character >= '0' && character <= '9';
}

function dependencyRanges(manifest: PackageManifest): Readonly<Record<string, string>> {
	const ranges: Record<string, string> = {};
	for (const field of DEPENDENCY_FIELDS) {
		const record = objectAt(manifest[field]);
		if (record === null) continue;
		for (const [name, range] of Object.entries(record))
			if (typeof range === 'string') ranges[name] = range;
	}
	return ranges;
}

/**
 * Every declaration one lockfile and one migrated manifest disagree about.
 *
 * Only packages both documents name are compared. A package the lockfile holds
 * and the manifest no longer declares is not a contradiction — the manifest may
 * have dropped it, or it may be a transitive entry — and a package the manifest
 * declares and the lockfile never resolved is not one either: the lockfile is
 * simply short of it, which is the ordinary state of a manifest that gained a
 * declaration.
 */
export function lockfileContradictions(
	resolutions: readonly LockedResolution[],
	manifest: PackageManifest,
): readonly LockfileContradiction[] {
	const ranges = dependencyRanges(manifest);
	const contradictions: LockfileContradiction[] = [];
	for (const resolution of resolutions) {
		const declared = ranges[resolution.name];
		if (declared === undefined) continue;
		const wanted = declaredRangeMajor(declared);
		const locked = majorOf(resolution.version);
		if (wanted === null || locked === null || wanted === locked) continue;
		contradictions.push(
			Object.freeze({ name: resolution.name, locked: resolution.version, declared }),
		);
	}
	return Object.freeze(contradictions.sort((left, right) => compareStrings(left.name, right.name)));
}

/** How many contradictions a declared difference names before it summarises. */
const NAMED_CONTRADICTIONS = 3;

function describeSupersession(
	path: string,
	contradictions: readonly LockfileContradiction[],
): string {
	const named = contradictions
		.slice(0, NAMED_CONTRADICTIONS)
		.map((entry) => `${entry.name} is locked at ${entry.locked} and now declared ${entry.declared}`)
		.join('; ');
	const rest =
		contradictions.length > NAMED_CONTRADICTIONS
			? ` and ${String(contradictions.length - NAMED_CONTRADICTIONS)} further declaration(s)`
			: '';
	return (
		`${path} was removed: it is the era closure's own resolution, and the migrated manifest no ` +
		`longer asks for that closure. ${named}${rest}. A lockfile is read before a manifest, so ` +
		'leaving it in the tree makes the package manager resolve the era pins it names and refuse ' +
		'the install over versions the migrated manifest never declared. The migrated manifest is to ' +
		'be installed lock-free and re-locked by that install; the era resolution is a fact about the ' +
		'era workspace and is not carried into this one, so the reproducibility it provided is a ' +
		'declared loss rather than a preserved property.'
	);
}

/**
 * Which of the lockfiles the caller supplied the migrated manifest has
 * superseded.
 *
 * The manifest handed here is the *migrated* one — after every capability that
 * writes a dependency range — because the question is whether the tree's own
 * resolution still describes what the tree now asks for, and a partially aligned
 * manifest would answer a question nobody asked.
 */
export function supersedeEraLockfiles(
	lockfiles: readonly LockfileReading[],
	manifest: PackageManifest,
): LockfileSupersessionResult {
	const superseded: LockfileSupersession[] = [];
	const unhandled: string[] = [];
	for (const lockfile of [...lockfiles].sort((left, right) =>
		compareStrings(left.path, right.path),
	)) {
		if (!isNpmLockfilePath(lockfile.path)) {
			unhandled.push(
				`${lockfile.path} is a lockfile this migration does not read: only ` +
					`${NPM_LOCKFILE_FILENAMES.join(' and ')} are read, and a resolution written in another ` +
					'format was left in the tree rather than removed on the strength of its name. Whether it ' +
					'still describes the migrated manifest is unestablished.',
			);
			continue;
		}
		const resolutions = readNpmLockfileResolutions(lockfile.source);
		if (resolutions === null) {
			unhandled.push(
				`${lockfile.path} could not be read as an npm lockfile, so it was left in the tree. A ` +
					'file this capability cannot read is a file it cannot decide has been superseded.',
			);
			continue;
		}
		const contradictions = lockfileContradictions(resolutions, manifest);
		if (contradictions.length === 0) continue;
		superseded.push(
			Object.freeze({
				at: lockfile.path,
				reason: describeSupersession(lockfile.path, contradictions),
				contradictions,
			}),
		);
	}
	return Object.freeze({
		superseded: Object.freeze(superseded),
		unhandled: Object.freeze(unhandled),
	});
}
