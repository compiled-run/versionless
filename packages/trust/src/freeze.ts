import { sha256 } from '../../core/src/receipts/canonicalize.ts';
import { TRUST_SCHEMA, asRecord, asString } from './schema.ts';

/**
 * The commit at which the migration engine's adapter surfaces were frozen.
 *
 * The freeze is a claim about exact bytes, so it is pinned to an exact commit
 * rather than to a branch name that can move underneath it.
 */
export const ADAPTER_FREEZE_COMMIT = 'ddc2870aa934be7c8bc6caaeca74095d270776d5' as const;

/**
 * The frozen subtrees, in the exact order the composite fingerprint hashes them.
 *
 * Each entry is a Git tree object id, so the fingerprint covers the complete
 * recursive content of the subtree — every file, every byte, and the tree shape
 * itself. Reordering this list changes the composite, which is the point: the
 * order is part of the claim, not an incidental detail of how it was computed.
 */
export const ADAPTER_FREEZE_SUBTREES = [
	{ path: 'packages/frameworks/react', treeOid: 'ad28e7c430b78e040a0609c24d7665601e480771' },
	{ path: 'packages/frameworks/angular', treeOid: 'd20a740dd03179df6c8c7990dbe39e1e94e31316' },
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
	'140ce86e163ddbae2ad6f1504022efca9468641cc50fd3dca354c6aba8cbb562' as const;

/**
 * The freeze this record supersedes, retained by reference.
 *
 * The 27741d9c composite over the five subtrees at commit 0ecd4106 was the
 * prior freeze. It was reopened once, under the single supersession the
 * bank-demo-fleet-pipeline goal authorizes for T010, to publish Angular 13.4.0
 * as a plannable target cell. Two subtrees moved and three did not: Angular
 * moved for capability work and for the format epoch together, React moved for
 * the format epoch alone — the first time in this chain the React tree has
 * moved at all, and it moved for whitespace — and migrations, bundlers and
 * analysis are re-frozen byte-identical at the oids they already carried. The
 * prior composite is recorded as superseded rather than deleted so the freeze
 * history stays legible and each holdout receipt's frozenAdapterFingerprint
 * still points at the boundary it actually ran against — the pigallery2 record
 * still names f1a63359 and the eShop record and its witness still name
 * 27741d9c as the composite they ran against. The chain d9f75ef6 (commit
 * 57b308a) -> 5de7df56 (commit cce34175) -> 4df7bc96 (commit c695a586) ->
 * f1a63359 (commit 852079a1) -> 27741d9c (commit 0ecd4106) -> 140ce86e (commit
 * ddc2870a) stays traceable, every link recorded at the point the adapters were
 * reopened and why.
 */
export const ADAPTER_FREEZE_SUPERSEDES = {
	composite: '27741d9c8bfac1b6bb0b330423b1cf258fcde722f548ecb9cf8b389cc98e4234',
	commit: '0ecd410691df10fbc68c9ddcd012dafa86aba536',
	state: 'superseded' as const,
	reopenReason:
		'Authorized freeze supersession for the bank-demo-fleet-pipeline T010 Angular-13 target-cell tranche — the ONE supersession that goal authorizes, and the only reopen of the 27741d9c freeze. Seven units carried it: u1 and u2 threaded --cell from the CLI into the plan and analyze stages and pinned the describable-is-not-plannable seam, and u3, u5b, u6 and u7 published ANGULAR_13_BROWSER_CELL and the three i18n capabilities (all under run bank-demo-fleet-pipeline-p2b); u9 ran the repository-wide format epoch and regenerated the refusal census in the same unit (run bank-demo-fleet-pipeline-p2c). The adapter state those units left is commit ddc2870aa934be7c8bc6caaeca74095d270776d5, which this record names as ADAPTER_FREEZE_COMMIT and which is deliberately a different commit from the one carrying this record, exactly as 0ecd4106 related to the T024 commits. Two of the five subtrees moved and three did not, and the reasons are kept apart rather than averaged. packages/frameworks/angular moved 4b6e2f44 -> d20a740d for BOTH reasons: the 13-cell capability work (ANGULAR_13_BROWSER_CELL with its narrow eleven-entry ecosystem table, the three value-carrying --i18n-* RemovedCliFlag rows, the new locale-id-provider capability, and the widened template-i18n-runtime gate) AND the format epoch. packages/frameworks/react moved 972ca801 -> ad28e7c4 for FORMATTING ALONE — 8 files, whitespace (line re-wrapping, trailing commas and quote normalisation the formatter emits), no capability — which is why this is the first reopen in the chain to publish reactSubtreeUnchanged: false, and it is false for a cosmetic reason with nothing a user can run behind it. packages/core/src/migrations (5237ce59), packages/core/src/bundlers (cec2f0b5) and packages/core/src/analysis (262dc8b7) are byte-identical, took zero formatter changes, and are re-frozen at those same oids. One sealed surface moved under this reopen, once, and it is recorded rather than absorbed: the sealed 16-path pigallery2 changeset changed when the three value-carrying --i18n-* rows landed, because pigallery2’s run-dev and build-stats scripts are ng-first and carry --i18n-locale and --i18n-file, so the sealed migration had been preserving scripts that die at Angular 16 on Unknown option. The PM authorized that single movement as a defect fix rather than a re-baseline: the byte-identity Angular operator/driver digest moved 2b85d619 -> a044d716, and the holdout receipts’ HISTORY pins were not touched — the pigallery2 receipt still names composite f1a63359 and the eShop receipt and its witness still name 27741d9c, because those are the boundaries they actually ran against. The format epoch was run to fixpoint rather than once: vp fmt over packages/ needed two passes, because the formatter is not idempotent on one signature in angular-target-cell.ts (a line break only), and it is the second pass that makes vp fmt --check clean. What the reopen bought is angular-13.4.0 as a plannable, refusal-honest target: a declared cell id now reaches the plan and analyze stages instead of silently aligning the manifest to Angular 16, an id no adapter publishes is a named refusal rather than a fallback, and the cell carries a narrow evidence-backed ecosystem table read verbatim from one installed closure. What it did NOT buy is stated with the same precision: no community-layer coverage for Angular 13 beyond what the T009 proving run measured — no registry survey was performed for this cell, a package the table does not name is reported unknown rather than fine, and the cell’s own nonclaims declare that gap; and no composed localize capability — the widened template-i18n-runtime gate reads a supplied closure reading homed on its own input and is deliberately left uncomposed pending the tiny-translator ownership decision. 27741d9c had itself superseded f1a63359 (commit 852079a1), which superseded 4df7bc96 (commit c695a586), which superseded 5de7df56 (commit cce34175), which superseded the tranche-one d9f75ef6 freeze (commit 57b308a).',
	chain: [
		'd9f75ef677cb850f664cc188abf77b8ebfd24e84cb58d147b74e9bbaa143eb77',
		'5de7df565fb8e445a45f9f8f43eac27b80b71189d59e4df243e93471406a260c',
		'4df7bc961033fc5856b4d58e0bca9f11ad2aa9d43aaaee726956f34d209b37e7',
		'f1a63359210b87c04408b27cf8c40e88e1b47d44bcc7f5a9be20d9478dc71012',
		'27741d9c8bfac1b6bb0b330423b1cf258fcde722f548ecb9cf8b389cc98e4234',
		'140ce86e163ddbae2ad6f1504022efca9468641cc50fd3dca354c6aba8cbb562',
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
	/**
	 * The three capabilities the T010 Angular 13 target-cell reopen produced.
	 * One is new and two are extensions of capabilities the T024 slice already
	 * carries, and the difference is kept visible rather than folded into a
	 * single number: `locale-id-provider` is a capability that did not exist
	 * before this reopen, `workspace-script-flags-i18n-value-flags` widens the
	 * existing `workspace-script-flags` capability to value-carrying --i18n-*
	 * rows, and `template-i18n-runtime-closure-reading` widens the existing
	 * template-i18n-runtime gate to admit a supplied closure reading as an
	 * input. All three were written against one application — pigallery2 1.7.0
	 * lifted onto Angular 13.4.0 in the T009 proving run — so all three stay in
	 * the experimental column. The reopen published a cell, not a second
	 * application for anything.
	 */
	{ lineage: 'angular', capability: 'locale-id-provider' },
	{ lineage: 'angular', capability: 'workspace-script-flags-i18n-value-flags' },
	{ lineage: 'angular', capability: 'template-i18n-runtime-closure-reading' },
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
export const ADAPTER_FREEZE_T021_EXPERIMENTAL_CAPABILITIES =
	ADAPTER_FREEZE_EXPERIMENTAL_CAPABILITIES.slice(-24, -12);

/**
 * The exact subset the T024 Angular reopen produced, kept countable the same
 * way and for the same reason.
 *
 * The difference between the two reopens is worth being able to read off the
 * freeze without prose: T021 bought twelve capabilities and no artifact, T024
 * bought nine and a repeatable production build. Neither bought a second
 * application, so both slices are wholly inside the experimental column.
 */
export const ADAPTER_FREEZE_T024_EXPERIMENTAL_CAPABILITIES =
	ADAPTER_FREEZE_EXPERIMENTAL_CAPABILITIES.slice(-12, -3);

/**
 * The exact subset the T010 Angular 13 target-cell reopen produced, kept
 * countable the same way and for the same reason.
 *
 * The three reopens now read off the freeze without prose: T021 bought twelve
 * capabilities and no artifact, T024 bought nine and a repeatable production
 * build, T010 bought three — one new capability and two widenings — and a
 * published target cell. None of the three bought a second application, so all
 * three slices are wholly inside the experimental column.
 */
export const ADAPTER_FREEZE_T010_EXPERIMENTAL_CAPABILITIES =
	ADAPTER_FREEZE_EXPERIMENTAL_CAPABILITIES.slice(-3);

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
				authorization:
					'board-authorized Angular-subtree reopen for the pigallery2 1.7.0 holdout chase (2026-08-13)',
				commits: ['283d27f', '03b34ae', 'e6a219e', '8126736'],
				capabilitiesExtracted: ADAPTER_FREEZE_T021_EXPERIMENTAL_CAPABILITIES.length,
				entries: ADAPTER_FREEZE_T021_EXPERIMENTAL_CAPABILITIES.map((entry) => ({
					...entry,
				})),
				state: 'all-single-application-experimental',
				outcome:
					'The chased application stayed RED. The reopen bought twelve generic capabilities and a declared support boundary, not a green holdout.',
				reactSubtreeUnchanged: true,
			},
			{
				task: 'T024',
				subtree: 'packages/frameworks/angular',
				authorization:
					'board-authorized Angular-subtree reopen for the eShopOnContainers WebSPA holdout chase (2026-08-14)',
				commits: ['82f48ab', '7543e0e', '8c6a8da', '0ecd410'],
				capabilitiesExtracted: ADAPTER_FREEZE_T024_EXPERIMENTAL_CAPABILITIES.length,
				entries: ADAPTER_FREEZE_T024_EXPERIMENTAL_CAPABILITIES.map((entry) => ({
					...entry,
				})),
				state: 'all-single-application-experimental',
				outcome:
					'The chased application is no longer refused at install, its migrated production build now completes twice with byte-identical output, and the T024 u6 Witness run after this re-freeze is green on its anonymous catalog surface. The reopen bought nine generic capabilities, a repeatable build, and a browser proof bounded to that one surface — not a pass on the application, and not a second application for any capability.',
				reactSubtreeUnchanged: true,
			},
			{
				task: 'T010',
				subtree: 'packages/frameworks/angular and packages/frameworks/react',
				authorization:
					'the ONE freeze supersession authorized by the bank-demo-fleet-pipeline goal, to publish Angular 13.4.0 as a plannable target cell (T010, PM rulings 2026-08-20)',
				commits: ['f032aec', '7367e2e', 'ddc2870'],
				capabilitiesExtracted: ADAPTER_FREEZE_T010_EXPERIMENTAL_CAPABILITIES.length,
				entries: ADAPTER_FREEZE_T010_EXPERIMENTAL_CAPABILITIES.map((entry) => ({
					...entry,
				})),
				state: 'all-single-application-experimental',
				outcome:
					'angular-13.4.0 is now a published, plannable, refusal-honest target: a declared cell id reaches the plan and analyze stages instead of silently aligning the manifest to Angular 16, an unpublished id is a named refusal rather than a fallback, and the cell carries a narrow eleven-entry ecosystem table read verbatim from one installed closure. The reopen bought three capabilities — one new (locale-id-provider) and two widenings of existing ones — and no second application for any of them. It did not buy community-layer coverage for Angular 13 beyond what the T009 proving run measured (no registry survey was performed; unnamed packages are reported unknown, and the cell says so in its own nonclaims), and it did not buy a composed localize capability (the widened template-i18n-runtime gate is deliberately uncomposed). The Angular subtree moved for capability work AND formatting; the React subtree moved for formatting alone.',
				reactSubtreeUnchanged: false,
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
				outcome: 'witness-passed-on-bounded-anonymous-catalog-surface',
				preScreen:
					'mandatory license-text-at-pin pre-screen; the pre-Ivy screen verdict on this candidate was overturned by the T022 follow-up ruling under the successor-across-names rule',
				reason: 'The replacement Angular holdout was refused at install by the frozen f1a63359 adapter, and that RED stands as history. After the authorized T024 reopen its migrated production build completes and repeats byte-identically, and the T024 u6 Witness — run after this re-freeze, on two lanes observed twice each — measures one behaviour parity digest with a mutation-red and byte-restore proof under it. The Witness covers the anonymous catalog surface only: identity, basket, orders and campaigns are out of surface, the SignalR hub was never reached, and text entry and drag were not tested. It is counted in no numerator, and it is published as a pass on that bounded surface rather than as a pass on the application.',
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
