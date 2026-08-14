import { sha256 } from '../../core/src/receipts/canonicalize.ts';
import { TRUST_SCHEMA, asRecord, asString } from './schema.ts';

/**
 * The commit at which the migration engine's adapter surfaces were frozen.
 *
 * The freeze is a claim about exact bytes, so it is pinned to an exact commit
 * rather than to a branch name that can move underneath it.
 */
export const ADAPTER_FREEZE_COMMIT = '0ecd410691df10fbc68c9ddcd012dafa86aba536' as const;

/**
 * The frozen subtrees, in the exact order the composite fingerprint hashes them.
 *
 * Each entry is a Git tree object id, so the fingerprint covers the complete
 * recursive content of the subtree — every file, every byte, and the tree shape
 * itself. Reordering this list changes the composite, which is the point: the
 * order is part of the claim, not an incidental detail of how it was computed.
 */
export const ADAPTER_FREEZE_SUBTREES = [
	{ path: 'packages/frameworks/react', treeOid: '972ca80155bbc2a6eb3779943cd481b71d35e803' },
	{ path: 'packages/frameworks/angular', treeOid: '4b6e2f4494d98582e4fe9b420c2b412059dc0720' },
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
	'27741d9c8bfac1b6bb0b330423b1cf258fcde722f548ecb9cf8b389cc98e4234' as const;

/**
 * The freeze this record supersedes, retained by reference.
 *
 * The f1a63359 composite over the five subtrees at commit 852079a1 was the
 * prior freeze. It was legitimately reopened (T024, board-authorized
 * 2026-08-14) on the Angular subtree alone, to chase the eShopOnContainers
 * WebSPA Angular holdout after the frozen adapter refused it at install: four
 * units extracted nine generic capabilities and composition repairs from that
 * chase (commits 82f48ab, 7543e0e, 8c6a8da, 0ecd410), none of which branches on
 * the holdout's identity. Only the Angular subtree moved
 * (1f63f32c -> 4b6e2f44); the React, migrations, bundlers, and analysis
 * subtrees stayed byte-identical, and the React subtree is still the
 * 972ca801 tree the 4df7bc96 freeze published. The prior composite is recorded
 * as superseded rather than deleted so the freeze history stays legible and
 * each holdout receipt's frozenAdapterFingerprint still points at the boundary
 * it actually ran against — the pigallery2 record still names f1a63359 and the
 * eShop record still names it as the composite that refused it. The chain
 * d9f75ef6 (commit 57b308a) -> 5de7df56 (commit cce34175) -> 4df7bc96 (commit
 * c695a586) -> f1a63359 (commit 852079a1) -> 27741d9c stays traceable, every
 * link recorded at the point the adapters were reopened and why.
 */
export const ADAPTER_FREEZE_SUPERSEDES = {
	composite: 'f1a63359210b87c04408b27cf8c40e88e1b47d44bcc7f5a9be20d9478dc71012',
	commit: '852079a1d163617f810dba7e8b3509bc8e25343a',
	state: 'superseded' as const,
	reopenReason:
		'Authorized Angular-subtree reopen for the eShopOnContainers WebSPA holdout chase (T024, board-authorized 2026-08-14): nine generic capabilities and composition repairs were extracted from the falsification across commits 82f48ab, 7543e0e, 8c6a8da and 0ecd410, and the adapter was re-frozen at composite 27741d9c. Only the Angular subtree moved (1f63f32c -> 4b6e2f44); React stayed byte-identical at 972ca801, as did migrations, bundlers and analysis. What the chase bought is stated exactly: the holdout is no longer refused at install and its migrated production build now completes twice byte-identically, and no witness journey has run against it, so it is published as a measured state and not as a passed holdout. The pigallery2 RED and the declared pre-Ivy-only-dependency support boundary are untouched by this reopen. f1a63359 had itself superseded 4df7bc96 (commit c695a586), which superseded 5de7df56 (commit cce34175), which superseded the tranche-one d9f75ef6 freeze (commit 57b308a).',
	chain: [
		'd9f75ef677cb850f664cc188abf77b8ebfd24e84cb58d147b74e9bbaa143eb77',
		'5de7df565fb8e445a45f9f8f43eac27b80b71189d59e4df243e93471406a260c',
		'4df7bc961033fc5856b4d58e0bca9f11ad2aa9d43aaaee726956f34d209b37e7',
		'f1a63359210b87c04408b27cf8c40e88e1b47d44bcc7f5a9be20d9478dc71012',
		'27741d9c8bfac1b6bb0b330423b1cf258fcde722f548ecb9cf8b389cc98e4234',
	],
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
	{ lineage: 'react', capability: 'react-cra-process-global' },
	{ lineage: 'angular', capability: 'custom-webpack-absorption' },
	{ lineage: 'angular', capability: 'sentry-v8-migration' },
	{ lineage: 'angular', capability: 'package-exports-style-imports' },
	{ lineage: 'angular', capability: 'modal-content-params-migration' },
	{ lineage: 'angular', capability: 'undeclared-runtime-dependency' },
	{ lineage: 'angular', capability: 'tslint-toolchain-removal' },
	{ lineage: 'angular', capability: 'ngrx-effects-migration' },
	/**
	 * The twelve capabilities and composition repairs the T021 pigallery2 chase
	 * extracted. Every one of them is generic — none branches on the holdout's
	 * name, revision, or source text — but every one of them was written against
	 * the single application that demanded it, and that application's migrated
	 * build is RED. They are therefore experimental on the strictest reading of
	 * the rule: not merely unproven on a second application, but proven on no
	 * application at all in the end-to-end sense, since the one that exercised
	 * them never produced an artifact. They stay out of the matrix until a
	 * second, independent Angular application carries them.
	 */
	{ lineage: 'angular', capability: 'module-with-providers-type-argument' },
	{ lineage: 'angular', capability: 'subject-void-type-argument' },
	{ lineage: 'angular', capability: 'promise-executor-void-parameter' },
	{ lineage: 'angular', capability: 'unparameterised-base-class' },
	{ lineage: 'angular', capability: 'deep-import-redirection' },
	{ lineage: 'angular', capability: 'family-prefixed-ecosystem-readings' },
	{ lineage: 'angular', capability: 'install-stage-successor-readings' },
	{ lineage: 'angular', capability: 'compile-stage-published-bytes-verdicts' },
	{ lineage: 'angular', capability: 'workspace-engines-retarget' },
	{ lineage: 'angular', capability: 'undecorated-angular-base-class' },
	{ lineage: 'angular', capability: 'application-source-dependency' },
	{ lineage: 'angular', capability: 'departed-dom-lib-member' },
	/**
	 * The nine capabilities and composition repairs the T024 eShopOnContainers
	 * WebSPA chase extracted. Every one of them is generic — none branches on the
	 * holdout's name, revision, or source text — but every one of them was
	 * written against the single application that demanded it. That application's
	 * migrated production build is green and repeats byte-identically, which is
	 * more than the T021 twelve ever reached, and it is still one application and
	 * still has no witness journey behind it. They stay out of the matrix until a
	 * second, independent Angular application carries them.
	 */
	{ lineage: 'angular', capability: 'unread-declaration-silence-reporting' },
	{ lineage: 'angular', capability: 'angular-16-community-layer-readings' },
	{ lineage: 'angular', capability: 'superseded-era-lockfile' },
	{ lineage: 'angular', capability: 'workspace-script-flags' },
	{ lineage: 'angular', capability: 'use-position-symbol-successor' },
	{ lineage: 'angular', capability: 'removed-static-module-method' },
	{ lineage: 'angular', capability: 'rxjs-prototype-patch-and-tilde-sass-composition' },
	{ lineage: 'angular', capability: 'http-client-call-surface' },
	{ lineage: 'angular', capability: 'package-exports-republished-subpath' },
] as const;

/**
 * The exact subset of the experimental list the T021 Angular reopen produced.
 *
 * It is listed separately as well as inline so the reopen's cost stays
 * countable: twelve capabilities entered the adapter, none of them left the
 * experimental column, and the application they were extracted from is still
 * RED. A reader who wants to know what the reopen bought does not have to diff
 * two freezes to find out.
 */
export const ADAPTER_FREEZE_T021_EXPERIMENTAL_CAPABILITIES = ADAPTER_FREEZE_EXPERIMENTAL_CAPABILITIES.slice(
	-21,
	-9,
);

/**
 * The exact subset the T024 Angular reopen produced, kept countable the same
 * way and for the same reason.
 *
 * The difference between the two reopens is worth being able to read off the
 * freeze without prose: T021 bought twelve capabilities and no artifact, T024
 * bought nine and a repeatable production build. Neither bought a second
 * application, so both slices are wholly inside the experimental column.
 */
export const ADAPTER_FREEZE_T024_EXPERIMENTAL_CAPABILITIES = ADAPTER_FREEZE_EXPERIMENTAL_CAPABILITIES.slice(
	-9,
);

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
		reopens: [
			{
				task: 'T021',
				subtree: 'packages/frameworks/angular',
				authorization: 'board-authorized Angular-subtree reopen for the pigallery2 1.7.0 holdout chase (2026-08-13)',
				commits: ['283d27f', '03b34ae', 'e6a219e', '8126736'],
				capabilitiesExtracted: ADAPTER_FREEZE_T021_EXPERIMENTAL_CAPABILITIES.length,
				entries: ADAPTER_FREEZE_T021_EXPERIMENTAL_CAPABILITIES.map((entry) => ({ ...entry })),
				state: 'all-single-application-experimental',
				outcome: 'The chased application stayed RED. The reopen bought twelve generic capabilities and a declared support boundary, not a green holdout.',
				reactSubtreeUnchanged: true,
			},
			{
				task: 'T024',
				subtree: 'packages/frameworks/angular',
				authorization: 'board-authorized Angular-subtree reopen for the eShopOnContainers WebSPA holdout chase (2026-08-14)',
				commits: ['82f48ab', '7543e0e', '8c6a8da', '0ecd410'],
				capabilitiesExtracted: ADAPTER_FREEZE_T024_EXPERIMENTAL_CAPABILITIES.length,
				entries: ADAPTER_FREEZE_T024_EXPERIMENTAL_CAPABILITIES.map((entry) => ({ ...entry })),
				state: 'all-single-application-experimental',
				outcome: 'The chased application is no longer refused at install and its migrated production build now completes twice with byte-identical output. No witness journey has run against it, so the reopen bought nine generic capabilities and a repeatable build, not a passed holdout.',
				reactSubtreeUnchanged: true,
			},
		],
		angularHoldouts: [
			{
				state: 'attempted',
				application: 'pigallery2 1.7.0',
				outcome: 'failed',
				preScreen: 'mandatory license-text-at-pin pre-screen',
				reason: 'The Angular holdout was ingested under the mandatory license-text-at-pin pre-screen and run against the frozen adapters. Its migrated build is RED at the declared pre-Ivy-only-dependency support boundary; the record is published as permanent falsification evidence and counted in no numerator.',
				boundary:
					'pre-Ivy-only dependencies (no published Ivy successor) in active application use => unsupported at the Angular 16 target cell',
			},
			{
				state: 'attempted',
				application: 'eShopOnContainers WebSPA (netcore2.2, src/Web/WebSPA)',
				outcome: 'migrated-build-green-witness-pending',
				preScreen: 'mandatory license-text-at-pin pre-screen; the pre-Ivy screen verdict on this candidate was overturned by the T022 follow-up ruling under the successor-across-names rule',
				reason: 'The replacement Angular holdout was refused at install by the frozen f1a63359 adapter, and that RED stands as history. After the authorized T024 reopen its migrated production build completes and repeats byte-identically. No witness journey has run in either lane, so nothing about its behavior is established, it is counted in no numerator, and it is published as a measured state rather than as a passed holdout.',
				boundary: 'none declared by this holdout',
			},
		],
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
