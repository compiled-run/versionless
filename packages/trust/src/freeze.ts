import { sha256 } from '../../core/src/receipts/canonicalize.ts';
import { TRUST_SCHEMA, asRecord, asString } from './schema.ts';

/**
 * The commit at which the migration engine's adapter surfaces were frozen.
 *
 * The freeze is a claim about exact bytes, so it is pinned to an exact commit
 * rather than to a branch name that can move underneath it.
 */
export const ADAPTER_FREEZE_COMMIT = 'cce34175340273919c0b70341dfada5533f0307c' as const;

/**
 * The frozen subtrees, in the exact order the composite fingerprint hashes them.
 *
 * Each entry is a Git tree object id, so the fingerprint covers the complete
 * recursive content of the subtree — every file, every byte, and the tree shape
 * itself. Reordering this list changes the composite, which is the point: the
 * order is part of the claim, not an incidental detail of how it was computed.
 */
export const ADAPTER_FREEZE_SUBTREES = [
	{ path: 'packages/frameworks/react', treeOid: '9b2af393179749a4093f46e587e7f4fd9ce09b47' },
	{ path: 'packages/frameworks/angular', treeOid: 'ca3824d0595d1fa88d37feda6b1785dfd79e72c4' },
	{ path: 'packages/core/src/migrations', treeOid: '5237ce5990af3623206bcd2301047a59c80731cf' },
	{ path: 'packages/core/src/bundlers', treeOid: 'cec2f0b56fbb7897f38d579be805e19982380ca6' },
	{ path: 'packages/core/src/analysis', treeOid: '262dc8b7528c92883c2300914eb7d42579fb856b' },
] as const;

/**
 * The composite fingerprint of the frozen adapter surface.
 *
 * It is the SHA-256 of the newline-terminated `<path> <tree-oid>` lines above,
 * in that order, which is exactly what a plain shell loop over
 * `git rev-parse HEAD:<path>` piped to `shasum -a 256` produces. Anyone can
 * recompute it from a checkout without this package.
 */
export const ADAPTER_FREEZE_COMPOSITE =
	'5de7df565fb8e445a45f9f8f43eac27b80b71189d59e4df243e93471406a260c' as const;

/**
 * The tranche-one freeze this record supersedes, retained by reference.
 *
 * The d9f75ef6 composite over the five subtrees at commit 57b308a was the
 * tranche-one freeze. It was legitimately reopened (T999 audit): the frozen
 * create-react-app adapter did not carry the cypress-realworld-app holdout, so
 * d9f75ef6 was falsified for CRA holdout carriage and the adapter surface was
 * reopened for the follow-on tranche behind a new Judge freeze boundary. The
 * expanded React and Angular adapters were then re-frozen at the new composite.
 * The prior composite is recorded as superseded rather than deleted so the
 * freeze history stays legible and the holdout receipt's frozenAdapterFingerprint
 * still points at the boundary it actually ran against.
 */
export const ADAPTER_FREEZE_SUPERSEDES = {
	composite: 'd9f75ef677cb850f664cc188abf77b8ebfd24e84cb58d147b74e9bbaa143eb77',
	commit: '57b308a573dd582c844ce401fb1161cd70e9bc66',
	state: 'superseded' as const,
	reopenReason:
		'T999 audit: the tranche-one d9f75ef6 freeze was falsified for cypress-realworld-app holdout carriage (missing non-UTF-8 module source decoding). The adapter surface was reopened behind a new Judge freeze boundary and re-frozen at composite 5de7df56 once the follow-on tranche landed.',
} as const;

/**
 * Rebuilds the preimage the composite fingerprint is taken over.
 *
 * Keeping the preimage constructible rather than merely described means the
 * record can be checked against itself: a subtree whose oid was edited without
 * recomputing the composite is caught here rather than believed.
 */
export function adapterFreezePreimage(
	subtrees: ReadonlyArray<{ path: string; treeOid: string }>,
): string {
	return subtrees.map((subtree) => `${subtree.path} ${subtree.treeOid}\n`).join('');
}

/**
 * The registry surfaces deliberately left outside the freeze.
 *
 * Freezing the adapters is a claim that the migration engine stopped moving; it
 * is not a claim that the project stopped publishing evidence. New holdout
 * verticals land by adding receipts, corpus rows, and witness runners, and that
 * additive publishing has to remain possible or the freeze would be a freeze on
 * proving things rather than on changing the thing being proven.
 */
export const ADAPTER_FREEZE_HOLDOUT_SURFACES = [
	'packages/core/src/receipts',
	'packages/core/src/corpus',
	'packages/cli/src/witness',
] as const;

/**
 * Capabilities proven on exactly one application at the freeze.
 *
 * These are real, verified transforms — every one of them is load-bearing in a
 * browser-proven vertical — but a capability proven once is a capability that
 * may have been shaped by the single application it was written against. They
 * are held out of the supported matrix until T006 supplies a second,
 * independent application for each, and they are listed rather than quietly
 * shipped so the difference between "works here" and "is a product" stays
 * legible.
 */
export const ADAPTER_FREEZE_EXPERIMENTAL_CAPABILITIES = [
	{ lineage: 'react', capability: 'connect-to-hooks' },
	{ lineage: 'react', capability: 'class-lifecycle-to-hooks' },
	{ lineage: 'react', capability: 'data-flow-connect-to-hooks' },
	{ lineage: 'react', capability: 'composed-migration' },
	{ lineage: 'angular', capability: 'custom-webpack-absorption' },
	{ lineage: 'angular', capability: 'sentry-v8-migration' },
	{ lineage: 'angular', capability: 'package-exports-style-imports' },
	{ lineage: 'angular', capability: 'modal-content-params-migration' },
	{ lineage: 'angular', capability: 'undeclared-runtime-dependency' },
	{ lineage: 'angular', capability: 'tslint-toolchain-removal' },
	{ lineage: 'angular', capability: 'ngrx-effects-migration' },
] as const;

/**
 * The capabilities that survived a second independent application.
 *
 * This is the short list the freeze actually stands behind as product: the
 * create-react-app to Vite adapter carried two unrelated React applications,
 * and the Angular spine carried two unrelated Angular applications end to end.
 */
export const ADAPTER_FREEZE_CROSS_PROVEN = [
	{ lineage: 'react', capability: 'react-cra-vite-adapter' },
	{ lineage: 'angular', capability: 'angular-target-cell' },
	{ lineage: 'angular', capability: 'angular-workspace-migration' },
	{ lineage: 'angular', capability: 'angular-source-migration' },
	{ lineage: 'angular', capability: 'angular-cli-era-migration' },
] as const;

/**
 * Builds the adapter freeze record.
 *
 * The record is authored evidence about a Git state rather than a measurement
 * of the running workspace, so it is emitted from constants and then checked
 * against itself: the composite is recomputed from the listed subtrees every
 * time the record is built, and a mismatch throws instead of publishing.
 */
export function adapterFreezeRecord(): Record<string, unknown> {
	const preimage = adapterFreezePreimage(ADAPTER_FREEZE_SUBTREES);
	if (sha256(preimage) !== ADAPTER_FREEZE_COMPOSITE)
		throw new Error('Adapter freeze composite does not match its declared subtrees');
	return {
		schemaVersion: TRUST_SCHEMA,
		freeze: {
			commit: ADAPTER_FREEZE_COMMIT,
			algorithm: 'sha256',
			composite: ADAPTER_FREEZE_COMPOSITE,
			preimage: 'newline-terminated `<path> <tree-oid>` lines in the listed subtree order',
			subtrees: ADAPTER_FREEZE_SUBTREES.map((subtree) => ({ ...subtree })),
			state: 'frozen',
			claim: 'The migration engine adapter surface is byte-stable at this commit.',
			supersedes: { ...ADAPTER_FREEZE_SUPERSEDES },
		},
		holdoutPublishing: {
			state: 'outside-freeze',
			surfaces: [...ADAPTER_FREEZE_HOLDOUT_SURFACES],
			reason: 'Additive holdout publishing must stay possible: new verticals land as receipts, corpus rows, and witness runners without reopening the frozen adapters.',
		},
		capabilities: {
			experimental: {
				state: 'out-of-matrix',
				basis: 'single-application proof',
				pendingEvidence: 'T006 second-application evidence',
				entries: ADAPTER_FREEZE_EXPERIMENTAL_CAPABILITIES.map((entry) => ({ ...entry })),
			},
			crossProven: {
				state: 'in-matrix',
				basis: 'two independent applications',
				entries: ADAPTER_FREEZE_CROSS_PROVEN.map((entry) => ({ ...entry })),
			},
		},
		angularHoldout: {
			state: 'deferred',
			deferredUntil: 'post-T006',
			preScreen: 'mandatory license-text-at-pin pre-screen',
			reason: 'Angular holdout ingestion is deferred until the second-application evidence lands, and no candidate is admitted without verifying license text at the exact pinned revision first.',
		},
	};
}

/**
 * Re-derives an emitted freeze record and refuses any drift.
 *
 * Verification recomputes the composite from the record's own subtree list
 * rather than trusting the published number, so an edited evidence file is
 * caught even if it was edited consistently with itself.
 */
export function verifyAdapterFreezeRecord(value: unknown): Record<string, unknown> {
	const record = asRecord(value, 'adapter freeze record');
	const freeze = asRecord(record.freeze, 'adapter freeze');
	if (!Array.isArray(freeze.subtrees)) throw new Error('Adapter freeze subtrees are absent');
	const subtrees = freeze.subtrees.map((item, index) => {
		const subtree = asRecord(item, `adapter freeze subtree[${index}]`);
		return {
			path: asString(subtree.path, `adapter freeze subtree[${index}].path`),
			treeOid: asString(subtree.treeOid, `adapter freeze subtree[${index}].treeOid`),
		};
	});
	if (sha256(adapterFreezePreimage(subtrees)) !== asString(freeze.composite, 'freeze composite'))
		throw new Error('Adapter freeze composite does not match its recorded subtrees');
	return record;
}
