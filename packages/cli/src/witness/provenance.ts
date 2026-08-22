/**
 * What `@async/witness` is, in this tree.
 *
 * Twice now the answer has been something a reader could not check. First it was
 * `link:../witness`: a sibling checkout, so a clone of this repository alone
 * could not even load the CLI, and the audited identity was a reading of another
 * repository's working tree — its git status, its untracked directories, its
 * HEAD. Then it was `file:vendor/async-witness-0.8.0.tgz`: a `pnpm pack` tarball
 * committed here, which at least travelled with the checkout, but which no
 * registry had ever seen and whose upstream commit was a claim this tree could
 * not verify.
 *
 * `@async/witness@0.9.0` is published. The dependency is now an exact registry
 * pin, the vendored tarball is gone, and the audited identity is a reading of
 * the bytes the installed package exports: its `package.json`, its type
 * declaration and its runtime module. Those bytes are what this file re-hashes
 * on every provenance check.
 *
 * The upstream commit is still recorded rather than verified, and for the same
 * reason as before: that repository is not in this tree. What changed is who
 * says it. `vendor/README.md` used to say it, because a human had run `pnpm
 * pack` in a sibling directory; the 0.9.0 release says it now — the registry
 * metadata for this version declares `gitHead`
 * `5fde464ed3cb3268efca82ee26e6bb45afb55c5a`, which is the release commit of
 * `github.com/async/witness` v0.9.0. That string is not readable from the
 * installed package (npm keeps `gitHead` in registry metadata, not in the packed
 * `package.json`), so it is carried here as the release's own declaration,
 * recorded at adoption, and never presented as something this tree checked.
 */

import { readFile, realpath } from 'node:fs/promises';
import { dirname, join, resolve } from 'pathe';
import { sha256 } from '../../../core/src/index.ts';

/** The specifier the manifest must declare, verbatim: an exact registry pin, no range. */
export const REGISTRY_WITNESS_SPECIFIER = '0.9.0';

const EXPECTED = {
	version: '0.9.0',
	/**
	 * The commit the 0.9.0 release declares as its source (`gitHead` in the
	 * registry metadata). Recorded, not verified here.
	 */
	sourceCommit: '5fde464ed3cb3268efca82ee26e6bb45afb55c5a',
	packageSha256: '008a69d1effe3eb7a9d2146e2e0869620d5a102be40cd3b5523834c19167fbdf',
	declarationSha256: '4e249b3c60178168dd876fac5c3ae5cfc537b4f492e6574f2c4b7f76a2eb0360',
	runtimeSha256: 'd1fd099bf9de85f10518b5c94c3f6b2d3ad4c0b68c6b1449fd4bf9446dd1cea5',
} as const;

/**
 * The Witness releases this repository names, newest first.
 *
 * Every sealed receipt in `evidence/runs/` was written against 0.8.0 — first as
 * `link:../witness`, then as the committed tarball — and records that version
 * and that commit. 0.9.0 does not invalidate those readings and does not require
 * re-running a single sealed driver, because the two releases export the same
 * bytes: `dist/index.d.mts` hashes to `4e249b3c…` and `dist/index.mjs` to
 * `d1fd099b…` under both, which is measured here on every check for the
 * installed release and was measured for 0.8.0 when it was the installed one.
 * 0.9.0 is 0.8.0's content-bearing commit (`83b86de…`) plus a version and
 * changelog bump, and a version bump is exactly the kind of difference that
 * moves a name without moving a byte.
 *
 * So the lineage is additive: the superseded release keeps its own named
 * acceptance for as long as published evidence still names it, and the new
 * release becomes the current reading. Nothing here says the two are the same
 * release — they are two named releases whose exported bytes are equal, which is
 * a narrower and checkable claim.
 */
export const NAMED_WITNESS_RELEASES = [
	{
		version: EXPECTED.version,
		sourceCommit: EXPECTED.sourceCommit,
		declarationSha256: EXPECTED.declarationSha256,
		runtimeSha256: EXPECTED.runtimeSha256,
		/** How this release is installed here: an exact registry pin. */
		resolution: 'registry',
		note: 'Current: published on the npm registry and installed from it.',
	},
	{
		version: '0.8.0',
		sourceCommit: '83b86de431db306170cd8bb85317a88070512f9d',
		declarationSha256: '4e249b3c60178168dd876fac5c3ae5cfc537b4f492e6574f2c4b7f76a2eb0360',
		runtimeSha256: 'd1fd099bf9de85f10518b5c94c3f6b2d3ad4c0b68c6b1449fd4bf9446dd1cea5',
		resolution: 'superseded',
		note: 'Superseded: never published; reached as link:../witness and then as the committed tarball vendor/async-witness-0.8.0.tgz, and still named by every sealed receipt written before the 0.9.0 adoption.',
	},
] as const;

export type LinkedWitnessProvenance = {
	dependency: '@async/witness';
	/** The manifest specifier, verbatim. */
	specifier: typeof REGISTRY_WITNESS_SPECIFIER;
	/** How the dependency is reached: from the registry, not from a path in this tree. */
	resolution: 'registry';
	version: typeof EXPECTED.version;
	/** The commit the release declares as its source. Recorded, not verified here. */
	sourceCommit: string;
	packageSha256: string;
	declarationSha256: string;
	runtimeSha256: string;
	/**
	 * Nothing here establishes that the upstream commit is what the release was
	 * built from: that repository is not in this tree and was not read.
	 */
	upstreamCommitVerified: false;
	/** True since 0.9.0: a fresh clone installs this from the registry, with no vendored artifact. */
	portableReleaseDependency: true;
};

export async function verifyLinkedWitnessProvenance(
	root = resolve(import.meta.dirname, '../../../..'),
): Promise<LinkedWitnessProvenance> {
	const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
		devDependencies?: Record<string, string>;
	};
	if (packageJson.devDependencies?.['@async/witness'] !== REGISTRY_WITNESS_SPECIFIER)
		throw new Error(
			`Witness dependency must be exactly ${REGISTRY_WITNESS_SPECIFIER}: an exact registry pin, no range`,
		);
	const installRoot = dirname(
		await realpath(join(root, 'node_modules/@async/witness/package.json')),
	);
	const packageBytes = await readFile(join(installRoot, 'package.json'));
	const installedPackage = JSON.parse(packageBytes.toString('utf8')) as { version?: string };
	const packageSha256 = sha256(packageBytes);
	const declarationSha256 = sha256(await readFile(join(installRoot, 'dist/index.d.mts')));
	const runtimeSha256 = sha256(await readFile(join(installRoot, 'dist/index.mjs')));
	if (
		installedPackage.version !== EXPECTED.version ||
		packageSha256 !== EXPECTED.packageSha256 ||
		declarationSha256 !== EXPECTED.declarationSha256 ||
		runtimeSha256 !== EXPECTED.runtimeSha256
	)
		throw new Error('installed Witness audited identity drifted');
	return {
		dependency: '@async/witness',
		specifier: REGISTRY_WITNESS_SPECIFIER,
		resolution: 'registry',
		version: EXPECTED.version,
		sourceCommit: EXPECTED.sourceCommit,
		packageSha256,
		declarationSha256,
		runtimeSha256,
		upstreamCommitVerified: false,
		portableReleaseDependency: true,
	};
}

/**
 * What a sealed receipt's recorded provenance has to match, and what it only has
 * to state.
 *
 * The sealed per-application Witness receipts were written against 0.8.0, most of
 * them while the dependency was `link:../witness`, so each one records a reading
 * of a sibling checkout: `linkTarget`, the git `index`/`tracked` state, the
 * `untracked` directories, and a `packageSha256` taken from that checkout's
 * `package.json`. Three different manifest digests exist for the same code
 * (`d166f031…` in the sealed receipts, `920905ea…` from the vendored tarball,
 * `008a69d1…` from the published 0.9.0), because `pnpm pack` and `npm publish`
 * each rewrite `package.json` on the way in, while the bytes the package exports
 * do not change.
 *
 * So identity is the exported bytes, plus a release name drawn from a list this
 * repository publishes. The declaration digest and the runtime digest must be
 * equal — those are the package. The version and the upstream commit must name
 * one entry of `NAMED_WITNESS_RELEASES`, together, so a receipt cannot pair one
 * release's version with another's commit. Everything that describes HOW the
 * dependency was reached — the specifier form, the link target, the sibling
 * checkout's git readings, the manifest digest — is returned as a recorded fact
 * and is never compared.
 *
 * Equality on version and commit was the right test while one release existed;
 * keeping it across the 0.9.0 boundary would have meant either re-running every
 * sealed browser driver to restate a byte-identical package under a new name, or
 * quietly rewriting sealed receipts. Naming both releases states the truth
 * instead: two names, one set of exported bytes, and a receipt is accepted only
 * under the name it was actually written against.
 */
export type LinkedWitnessProvenanceEquivalence = {
	/** The two readings that must be equal, and the named release the recording matches. */
	compared: {
		dependency: '@async/witness';
		declarationSha256: string;
		runtimeSha256: string;
		release: { version: string; sourceCommit: string; resolution: string };
	};
	/** Read off the recorded provenance and stated, never compared. */
	recorded: {
		/** `link:../witness` for the oldest sealed receipts, the current pin for a current reading. */
		specifier: string;
		linkTarget: string | null;
		index: string | null;
		tracked: string | null;
		untracked: readonly string[] | null;
		packageSha256: string | null;
	};
};

const readString = (record: Record<string, unknown>, key: string): string | null =>
	typeof record[key] === 'string' ? record[key] : null;

/**
 * Compare a receipt's recorded Witness provenance with the current reading on the
 * bytes that identify the package, check that the release it names is one this
 * repository names, and return everything else as recorded fact. Throws naming
 * the field that differs.
 */
export function assertLinkedWitnessProvenanceEquivalent(
	recorded: unknown,
	expected: LinkedWitnessProvenance,
	label: string,
): LinkedWitnessProvenanceEquivalence {
	if (typeof recorded !== 'object' || recorded === null || Array.isArray(recorded))
		throw new Error(`${label} Witness provenance is not a record`);
	const record = recorded as Record<string, unknown>;
	const untracked = record.untracked;
	/** Sealed receipts name the upstream commit `commit`; the current reading names it `sourceCommit`. */
	const recordedCommit = readString(record, 'commit') ?? readString(record, 'sourceCommit');
	const recordedVersion = readString(record, 'version');
	const release = NAMED_WITNESS_RELEASES.find(
		(candidate) =>
			candidate.version === recordedVersion && candidate.sourceCommit === recordedCommit,
	);
	const differences = [
		record.dependency === '@async/witness' ? null : 'dependency',
		readString(record, 'declarationSha256') === expected.declarationSha256
			? null
			: 'declarationSha256',
		readString(record, 'runtimeSha256') === expected.runtimeSha256 ? null : 'runtimeSha256',
		release === undefined ? 'release (version + commit)' : null,
	].filter((field): field is string => field !== null);
	if (differences.length > 0)
		throw new Error(`${label} Witness provenance identity differs: ${differences.join(', ')}`);
	if (release === undefined) throw new Error(`${label} Witness provenance names no known release`);
	return {
		compared: {
			dependency: '@async/witness',
			declarationSha256: expected.declarationSha256,
			runtimeSha256: expected.runtimeSha256,
			release: {
				version: release.version,
				sourceCommit: release.sourceCommit,
				resolution: release.resolution,
			},
		},
		recorded: {
			specifier:
				readString(record, 'linkTarget') === null
					? REGISTRY_WITNESS_SPECIFIER
					: `link:${readString(record, 'linkTarget')}`,
			linkTarget: readString(record, 'linkTarget'),
			index: readString(record, 'index'),
			tracked: readString(record, 'tracked'),
			untracked: Array.isArray(untracked) ? untracked.map(String) : null,
			packageSha256: readString(record, 'packageSha256'),
		},
	};
}
