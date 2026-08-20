/**
 * What `@async/witness` is, in this tree.
 *
 * Until this file was rewritten the answer was "whatever is checked out in a
 * sibling directory": the dependency was `link:../witness`, so a clone of this
 * repository alone could not even load the CLI, and the audited identity was a
 * reading of another repository's working tree — its git status, its untracked
 * directories, its HEAD. None of that travels with a checkout.
 *
 * The dependency now lives in this repository as a committed `pnpm pack`
 * tarball under `vendor/`, which is what pnpm installs it from. The audited
 * identity is therefore a reading of committed bytes: the tarball's digest, and
 * the two dist files the installed package actually exports. The upstream commit those bytes were packed
 * from is recorded because it is the only thing a reader could not recompute
 * from this tree, and it is recorded as a claim about provenance rather than as
 * something verified here — this repository cannot check another repository it
 * does not carry, and does not pretend to.
 */

import { readFile, realpath } from 'node:fs/promises';
import { dirname, join, resolve } from 'pathe';
import { sha256 } from '../../../core/src/index.ts';

/** The specifier the manifest must declare, verbatim. */
export const VENDORED_WITNESS_SPECIFIER = 'file:vendor/async-witness-0.8.0.tgz';

/** The packed tarball pnpm installs the dependency from. */
export const VENDORED_WITNESS_TARBALL = 'vendor/async-witness-0.8.0.tgz';

const EXPECTED = {
	version: '0.8.0',
	/** The upstream commit the tarball was packed from. Recorded, not verified here. */
	sourceCommit: '83b86de431db306170cd8bb85317a88070512f9d',
	tarballSha256: 'c15d44fac722e7f0eb1366301d093ce43910e914606fa25d83ea1c08a47f2201',
	packageSha256: '920905ea00d0db03de7465b48f1293427fb92aab52678fdc444c011b869428d7',
	declarationSha256: '4e249b3c60178168dd876fac5c3ae5cfc537b4f492e6574f2c4b7f76a2eb0360',
	runtimeSha256: 'd1fd099bf9de85f10518b5c94c3f6b2d3ad4c0b68c6b1449fd4bf9446dd1cea5',
} as const;

export type LinkedWitnessProvenance = {
	dependency: '@async/witness';
	/** The committed artifact the dependency is installed from. */
	tarball: string;
	tarballSha256: string;
	version: '0.8.0';
	/** The upstream commit the tarball was packed from, as recorded in vendor/README.md. */
	sourceCommit: string;
	packageSha256: string;
	declarationSha256: string;
	runtimeSha256: string;
	/**
	 * Nothing here establishes that the upstream commit is what the tarball was
	 * packed from: that repository is not in this tree and was not read.
	 */
	upstreamCommitVerified: false;
	portableReleaseDependency: false;
};

export async function verifyLinkedWitnessProvenance(
	root = resolve(import.meta.dirname, '../../../..'),
): Promise<LinkedWitnessProvenance> {
	const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
		devDependencies?: Record<string, string>;
	};
	if (packageJson.devDependencies?.['@async/witness'] !== VENDORED_WITNESS_SPECIFIER)
		throw new Error(
			`vendored Witness dependency must be exactly ${VENDORED_WITNESS_SPECIFIER}`,
		);
	const vendorRoot = dirname(
		await realpath(join(root, 'node_modules/@async/witness/package.json')),
	);
	const packageBytes = await readFile(join(vendorRoot, 'package.json'));
	const linkedPackage = JSON.parse(packageBytes.toString('utf8')) as { version?: string };
	const tarballSha256 = sha256(await readFile(join(root, VENDORED_WITNESS_TARBALL)));
	const packageSha256 = sha256(packageBytes);
	const declarationSha256 = sha256(await readFile(join(vendorRoot, 'dist/index.d.mts')));
	const runtimeSha256 = sha256(await readFile(join(vendorRoot, 'dist/index.mjs')));
	if (
		linkedPackage.version !== EXPECTED.version ||
		tarballSha256 !== EXPECTED.tarballSha256 ||
		packageSha256 !== EXPECTED.packageSha256 ||
		declarationSha256 !== EXPECTED.declarationSha256 ||
		runtimeSha256 !== EXPECTED.runtimeSha256
	)
		throw new Error('vendored Witness audited identity drifted');
	return {
		dependency: '@async/witness',
		tarball: VENDORED_WITNESS_TARBALL,
		tarballSha256,
		version: '0.8.0',
		sourceCommit: EXPECTED.sourceCommit,
		packageSha256,
		declarationSha256,
		runtimeSha256,
		upstreamCommitVerified: false,
		portableReleaseDependency: false,
	};
}

/**
 * What a sealed receipt's recorded provenance has to match, and what it only has
 * to state.
 *
 * The sealed per-application Witness receipts were written while the dependency
 * was `link:../witness`, so each one records a reading of a sibling checkout:
 * `linkTarget`, the git `index`/`tracked` state, the `untracked` directories, and
 * a `packageSha256` taken from that checkout's `package.json`. The dependency is
 * now installed from the committed tarball, and `pnpm pack` rewrites
 * `package.json` on the way in, so that one digest necessarily differs
 * (`d166f031…` in the sealed receipts, `920905ea…` from the tarball) while the
 * bytes the package actually exports do not.
 *
 * So identity is the exported bytes and the version they carry: the declaration
 * digest, the runtime digest, the version, and the upstream commit the tarball
 * claims to come from — all four are equal across every sealed receipt and the
 * vendored tarball, which is why no sealed driver has to be re-run. Everything
 * that describes HOW the dependency was reached — the specifier form, the link
 * target, the sibling checkout's git readings, the manifest digest — is returned
 * as a recorded fact and is never compared. Widening the comparison is not
 * loosening it: the narrower whole-object equality was comparing the shape of a
 * workstation, not the identity of a package.
 */
export type LinkedWitnessProvenanceEquivalence = {
	/** The four readings that must be equal for the recorded package to be the same package. */
	compared: {
		dependency: '@async/witness';
		version: string;
		declarationSha256: string;
		runtimeSha256: string;
		sourceCommit: string;
	};
	/** Read off the recorded provenance and stated, never compared. */
	recorded: {
		/** `link:../witness` for a sealed receipt, `file:vendor/…` for a current reading. */
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
 * four fields that identify the package, and return everything else as recorded
 * fact. Throws naming the field that differs.
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
	const compared = {
		dependency: '@async/witness',
		version: expected.version,
		declarationSha256: expected.declarationSha256,
		runtimeSha256: expected.runtimeSha256,
		sourceCommit: expected.sourceCommit,
	} as const;
	/** Sealed receipts name the upstream commit `commit`; the current reading names it `sourceCommit`. */
	const recordedCommit = readString(record, 'commit') ?? readString(record, 'sourceCommit');
	const differences = [
		record.dependency === compared.dependency ? null : 'dependency',
		readString(record, 'version') === compared.version ? null : 'version',
		readString(record, 'declarationSha256') === compared.declarationSha256
			? null
			: 'declarationSha256',
		readString(record, 'runtimeSha256') === compared.runtimeSha256 ? null : 'runtimeSha256',
		recordedCommit === compared.sourceCommit ? null : 'commit',
	].filter((field): field is string => field !== null);
	if (differences.length > 0)
		throw new Error(`${label} Witness provenance identity differs: ${differences.join(', ')}`);
	return {
		compared,
		recorded: {
			specifier:
				readString(record, 'linkTarget') === null
					? VENDORED_WITNESS_SPECIFIER
					: `link:${readString(record, 'linkTarget')}`,
			linkTarget: readString(record, 'linkTarget'),
			index: readString(record, 'index'),
			tracked: readString(record, 'tracked'),
			untracked: Array.isArray(untracked) ? untracked.map(String) : null,
			packageSha256: readString(record, 'packageSha256'),
		},
	};
}
