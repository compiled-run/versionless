import { readFile } from 'node:fs/promises';
import { charIn, createRegExp } from 'magic-regexp';
import * as path from 'pathe';
import { normalizeURL, parseURL } from 'ufo';
import { canonicalize, sha256 } from '../receipts/canonicalize.ts';
import {
	parseMigrationReceipt,
	REACT_COMPOSED_CHANGED_FILES,
	REACT_COMPOSED_EXECUTION_TRACES,
	REACT_COMPOSED_SOURCE_HASHES,
	REACT_COMPOSED_TARGET_HASHES,
	type MigrationReceipt,
} from '../receipts/schema.ts';
import { verifyReceipt } from '../receipts/verify.ts';
import {
	ANGULAR_REALWORLD_V15_TO_V16_RECEIPT,
	verifyAngularRealworldV15ToV16Evidence,
} from '../receipts/angular-realworld-v15-to-v16.ts';
import {
	NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH,
	nextKilledByGoogleAggregateMember,
	verifyNextKilledByGoogleEvidence,
} from '../receipts/next-killedbygoogle.ts';
import {
	WITNESS_ANGULAR_REALWORLD_RECEIPT_PATH,
	verifyWitnessAngularRealworldEvidence,
	witnessAngularRealworldAggregateMember,
} from '../receipts/witness-angular-realworld.ts';
import {
	REACT_BOILERPLATE_CANONICAL_RECEIPT_PATH,
	WITNESS_REACT_BOILERPLATE_RECEIPT_PATH,
	verifyWitnessReactBoilerplateEvidence,
	witnessReactBoilerplateAggregateMember,
} from '../receipts/witness-react-boilerplate.ts';
import {
	WITNESS_NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH,
	verifyWitnessNextKilledByGoogleEvidence,
	witnessNextKilledByGoogleAggregateMember,
} from '../receipts/witness-next-killedbygoogle.ts';
import {
	REACT_AVATAAARS_COMPATIBILITY_RECEIPT_PATH,
	reactAvataaarsCompatibilityAggregateMember,
	verifyReactAvataaarsCompatibilityEvidence,
} from '../receipts/react-avataaars-compatibility.ts';
import {
	REACT_CALCULATOR_RECEIPT_PATH,
	reactCalculatorAggregateMember,
	verifyReactCalculatorEvidence,
} from '../receipts/react-calculator.ts';
import {
	REACT_GRAPHIQL_013_RECEIPT_PATH,
	reactGraphiQL013AggregateMember,
	verifyReactGraphiQL013Evidence,
} from '../receipts/react-graphiql-013.ts';
import {
	WITNESS_REACT_BOILERPLATE_ZERO_SW_RECEIPT_PATH,
	verifyWitnessReactBoilerplateZeroSwEvidence,
	witnessReactBoilerplateZeroSwAggregateMember,
} from '../receipts/react-boilerplate-zero-sw.ts';
import {
	REACT_PAPERCUPS_FIXTURE,
	REACT_PAPERCUPS_RECEIPT_PATH,
	reactPapercupsAggregateMember,
	verifyWitnessReactPapercupsEvidence,
	WITNESS_REACT_PAPERCUPS_RECEIPT_PATH,
	witnessReactPapercupsAggregateMember,
} from '../receipts/witness-react-papercups.ts';
import {
	REACT_HOSPITALRUN_FIXTURE,
	REACT_HOSPITALRUN_RECEIPT_PATH,
	verifyWitnessReactHospitalrunEvidence,
	WITNESS_REACT_HOSPITALRUN_RECEIPT_PATH,
	witnessReactHospitalrunAggregateMember,
} from '../receipts/witness-react-hospitalrun.ts';
import {
	ANGULAR_FACTORIOLAB_FIXTURE,
	verifyWitnessAngularFactoriolabEvidence,
	WITNESS_ANGULAR_FACTORIOLAB_RECEIPT_PATH,
	witnessAngularFactoriolabAggregateMember,
} from '../receipts/witness-angular-factoriolab.ts';
import {
	ANGULAR_JIRA_CLONE_FIXTURE,
	verifyWitnessAngularJiraCloneEvidence,
	WITNESS_ANGULAR_JIRA_CLONE_RECEIPT_PATH,
	witnessAngularJiraCloneAggregateMember,
} from '../receipts/witness-angular-jira-clone.ts';
import {
	REACT_MEMOS_FIXTURE,
	verifyWitnessReactMemosEvidence,
	WITNESS_REACT_MEMOS_RECEIPT_PATH,
	witnessReactMemosAggregateMember,
} from '../receipts/witness-react-memos.ts';
import {
	NEXT_KILLEDBYGOOGLE_V3_FIXTURE,
	verifyWitnessNextKilledbygoogleV3Evidence,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECEIPT_PATH,
	witnessNextKilledbygoogleV3AggregateMember,
} from '../receipts/witness-next-killedbygoogle-v3.ts';
import {
	REACT_LINKFREE_FIXTURE,
	verifyWitnessReactLinkfreeEvidence,
	WITNESS_REACT_LINKFREE_RECEIPT_PATH,
	witnessReactLinkfreeAggregateMember,
} from '../receipts/witness-react-linkfree.ts';
import {
	ANGULAR_TINY_TRANSLATOR_FIXTURE,
	verifyWitnessAngularTinyTranslatorEvidence,
	WITNESS_ANGULAR_TINY_TRANSLATOR_RECEIPT_PATH,
	witnessAngularTinyTranslatorAggregateMember,
} from '../receipts/witness-angular-tiny-translator.ts';
import {
	ANGULAR_SUPER_PRODUCTIVITY_FIXTURE,
	verifyWitnessAngularSuperProductivityEvidence,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_RECEIPT_PATH,
	witnessAngularSuperProductivityAggregateMember,
} from '../receipts/witness-angular-super-productivity.ts';
import {
	HOLDOUT_REACT_CYPRESS_RWA_APPLICATION,
	HOLDOUT_REACT_CYPRESS_RWA_RECEIPT_PATH,
	holdoutReactCypressRwaCorpusRecord,
	holdoutReactCypressRwaRerunCorpusRecord,
	verifyHoldoutReactCypressRwaEvidence,
	verifyHoldoutReactCypressRwaRerunEvidence,
} from '../receipts/holdout-react-cypress-rwa.ts';
import {
	ANGULAR_PRE_IVY_SUPPORT_BOUNDARY,
	HOLDOUT_ANGULAR_PIGALLERY2_APPLICATION,
	holdoutAngularPigallery2CorpusRecord,
	verifyHoldoutAngularPigallery2Evidence,
} from '../receipts/holdout-angular-pigallery2.ts';
import {
	HOLDOUT_ANGULAR_ESHOP_WEBSPA_APPLICATION,
	HOLDOUT_ANGULAR_ESHOP_WEBSPA_BROWSER_PROOF,
	HOLDOUT_ANGULAR_ESHOP_WEBSPA_OUTCOME,
	HOLDOUT_ANGULAR_ESHOP_WEBSPA_PROVEN_SURFACE,
	HOLDOUT_ANGULAR_ESHOP_WEBSPA_WITNESS_STATE,
	holdoutAngularEshopWebspaCorpusRecord,
	verifyHoldoutAngularEshopWebspaEvidence,
} from '../receipts/holdout-angular-eshop-webspa.ts';
import {
	ANGULAR_PRE_IVY_BOUNDARY_AMENDMENT,
	assertAngularPreIvyBoundaryAmendment,
} from '../receipts/angular-pre-ivy-boundary-amendment.ts';

export const CORPUS_CONFORMANCE_SCHEMA = 'versionless.corpus-conformance.v1' as const;

/**
 * The one immutable killedbygoogle source the corpus carries.
 *
 * Two verticals rest on it — the derived-state-to-useMemo migration and the
 * v3.0.0 direct-Witness browser proof — and they are two proofs of one source,
 * not two sources. Naming it once is what lets the browser-proof lane be
 * checked against it instead of quietly publishing a second application row for
 * the same repository at the same revision.
 */
const KILLED_BY_GOOGLE_PUBLISHED_SOURCE = Object.freeze({
	repository: normalizeURL('https://github.com/codyogden/killedbygoogle'),
	revision: '56809c31592e6ca1edce8af9bfe842fbcdf71f4d',
	archiveSha256: 'c28878d0f65b56aa595763c852477fb0c1e3533e5c7f7ea9daa2be16f102368d',
	license: 'MIT',
});
const REACT_BOILERPLATE_ZERO_SW_RECEIPT_PATH =
	'evidence/runs/react-boilerplate-v4-zero-sw/t693-run.json' as const;

/**
 * The aggregate row for the retained HospitalRun build-and-boot receipt.
 *
 * The Witness module owns the browser-proof row it seals; the retained build
 * receipt's row belongs beside the transaction state that admits it, exactly as
 * the zero-service-worker reconciliation's retained migration row already does.
 * Only the digest varies, and callers supply it from verified evidence rather
 * than from a literal.
 */
export function reactHospitalrunAggregateMember(digestValue: string) {
	return {
		id: REACT_HOSPITALRUN_FIXTURE,
		framework: 'react',
		track: 'create-react-app-3.4.4-to-vite8-build-and-boot',
		bundler: 'webpack-4.42.0-to-vite-8.0.16',
		runtime: 'node-12.14.1-to-node-24.15.0',
		result: 'pass',
		receipt: REACT_HOSPITALRUN_RECEIPT_PATH,
		digest: digestValue,
	};
}

export const NEXTJS_SYNTHETIC_NOT_TESTED_LANES = [
	{ id: 'synthetic-next12-pages', nextLane: '12', routing: 'pages' },
	{ id: 'synthetic-next13-transition-app', nextLane: '13', routing: 'mixed' },
	{ id: 'synthetic-next14-app', nextLane: '14', routing: 'app' },
].map((lane) => ({
	...lane,
	framework: 'nextjs' as const,
	synthetic: true as const,
	provenance: 'not-tested' as const,
	migration: 'not-tested' as const,
	build: 'not-tested' as const,
	browser: 'not-tested' as const,
	locality: 'not-tested' as const,
	compilerBundlerRuntime: 'not-tested' as const,
	tier: 'not-tested' as const,
	pilot: 'not-tested' as const,
	support: 'not-tested' as const,
}));

/**
 * The two lineages the charter oracle recognises. Next.js-on-React is
 * React-lineage per the charter's completion target ("six React-lineage
 * applications ... at least one legacy Next.js app"), so there is no separate
 * Next oracle lineage — only React and Angular. (T016 charter ruling.)
 */
export type LineageId = 'react' | 'angular';

/**
 * One production-readiness lineage cell as the Judge ruled on it.
 *
 * A cell is a source application proven by exactly one direct-Witness receipt.
 * `counted` is the Judge's acceptance, and `reason` is why — including for the
 * cells the Judge declines, which stay visible here rather than disappearing
 * from the ledger. Lineage numerators are counted off these entries, so a cell
 * cannot reach a numerator without a verified Witness receipt in the corpus and
 * a declined cell cannot be quietly dropped to flatter a score.
 *
 * `demoted` excludes a cell from its lineage *denominator*: a demoted cell stays
 * in the ledger with its reason but counts toward neither the numerator nor the
 * total. The denominator is therefore the number of non-demoted cells in the
 * lineage, derived rather than a fixed target. angular-realworld is the only
 * demoted cell (applicationFilesChanged=0), so the Angular total is four, not
 * five.
 *
 * `reactSubTag` is an informational-only record, never a gate. It marks the
 * legacy-Next member the charter oracle counts as React-lineage; the retired
 * `olderNext` separate numerator was finer tracking, not an oracle lineage, and
 * folds into React through this sub-tag rather than a second scoreboard.
 */
export interface LineageCountingCell {
	readonly cell: string;
	readonly application: string;
	readonly lineage: LineageId;
	readonly witnessReceipt: string;
	readonly counted: boolean;
	readonly demoted: boolean;
	readonly reason: string;
	readonly reactSubTag?: 'legacy-next';
}

/**
 * Builds the Judge's counting ledger from which lineage cells the corpus
 * actually carries verified Witness evidence for.
 *
 * Presence is the caller's already-verified evidence, never an assertion made
 * here, so an earlier transaction state emits a strictly shorter ledger and a
 * correspondingly smaller numerator without any separate bookkeeping.
 */
function lineageCountingLedger(present: {
	reactBoilerplate: boolean;
	papercups: boolean;
	hospitalrun: boolean;
	angularRealworld: boolean;
	factoriolab: boolean;
	jiraClone: boolean;
	memos: boolean;
	killedbygoogleV3: boolean;
	linkfree: boolean;
	tinyTranslator: boolean;
	superProductivity: boolean;
}): LineageCountingCell[] {
	const cells: Array<LineageCountingCell | null> = [
		present.reactBoilerplate
			? {
					cell: 'react-boilerplate',
					application: 'react-boilerplate',
					lineage: 'react' as const,
					witnessReceipt: WITNESS_REACT_BOILERPLATE_RECEIPT_PATH,
					counted: true,
					demoted: false,
					reason: 'Judge-accepted: webpack 4.30.0 to Vite 8.0.16 across Node 16 to Node 24 with a direct-Witness browser proof, byte-identical mutation restoration, and a current zero-service-worker policy reconciliation on the same immutable source.',
				}
			: null,
		present.papercups
			? {
					cell: REACT_PAPERCUPS_FIXTURE,
					application: 'papercups',
					lineage: 'react' as const,
					witnessReceipt: WITNESS_REACT_PAPERCUPS_RECEIPT_PATH,
					counted: true,
					demoted: false,
					reason: 'Judge-accepted: a create-react-app 3.4.1 production application really moved to a Vite 8 build, with behavioral parity and mutation restoration proven in the browser rather than inferred from the build.',
				}
			: null,
		present.hospitalrun
			? {
					cell: REACT_HOSPITALRUN_FIXTURE,
					application: 'react-hospitalrun',
					lineage: 'react' as const,
					witnessReceipt: WITNESS_REACT_HOSPITALRUN_RECEIPT_PATH,
					counted: true,
					demoted: false,
					reason: 'Judge-accepted: a create-react-app 3.4.4 application on Node 12 reached a booting Vite 8 build on Node 24, and its baseline/migrated service-worker difference is recorded rather than masked, so the cell is counted with its difference visible.',
				}
			: null,
		present.angularRealworld
			? {
					cell: 'angular-realworld-v15-to-v16',
					application: 'angular-realworld',
					lineage: 'angular' as const,
					witnessReceipt: WITNESS_ANGULAR_REALWORLD_RECEIPT_PATH,
					counted: false,
					demoted: true,
					reason: 'Judge-declined and demoted from the denominator: the migration changed applicationFilesChanged=0 application files, so it is an Angular 15-to-16 dependency version bump rebuilt under AOT rather than a proven application migration. Its browser-proof receipt stays verified and retained; it is excluded from the Angular denominator rather than counted, which is why the Angular total is four non-demoted cells and not five.',
				}
			: null,
		present.factoriolab
			? {
					cell: ANGULAR_FACTORIOLAB_FIXTURE,
					application: 'angular-factoriolab',
					lineage: 'angular' as const,
					witnessReceipt: WITNESS_ANGULAR_FACTORIOLAB_RECEIPT_PATH,
					counted: true,
					demoted: false,
					reason: 'Judge-accepted: Angular CLI 10.1 to 16.2 browser-builder across six majors with application source really rewritten, proven in the browser with byte-identical mutation restoration.',
				}
			: null,
		present.jiraClone
			? {
					cell: ANGULAR_JIRA_CLONE_FIXTURE,
					application: 'angular-jira-clone',
					lineage: 'angular' as const,
					witnessReceipt: WITNESS_ANGULAR_JIRA_CLONE_RECEIPT_PATH,
					counted: true,
					demoted: false,
					reason: 'Judge-accepted: Angular CLI 13.2 custom-webpack to 16.2 browser-builder, absorbing a non-default builder and rewriting application source, proven in the browser on a second independent Angular application.',
				}
			: null,
		present.memos
			? {
					cell: REACT_MEMOS_FIXTURE,
					application: 'react-memos',
					lineage: 'react' as const,
					witnessReceipt: WITNESS_REACT_MEMOS_RECEIPT_PATH,
					counted: true,
					demoted: false,
					reason: 'Judge-accepted (T016 re-freeze audit): a substantive old-Vite-origin React application (Vite 2.9.5 to Vite 8) really migrated with a direct-Witness browser proof and byte-identical mutation restoration. React-lineage is measured by the charter oracle regardless of origin bundler, so it counts toward the React numerator; the receipt keeps its own per-vertical scoreboard recorded rather than masked.',
				}
			: null,
		present.killedbygoogleV3
			? {
					cell: NEXT_KILLEDBYGOOGLE_V3_FIXTURE,
					application: NEXT_KILLEDBYGOOGLE_V3_FIXTURE,
					lineage: 'react' as const,
					witnessReceipt: WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECEIPT_PATH,
					counted: true,
					demoted: false,
					reactSubTag: 'legacy-next' as const,
					reason: 'Judge-accepted (T016 charter ruling): Next.js-on-React is React-lineage per the charter completion target ("six React-lineage applications ... at least one legacy Next.js app"), so this legacy-Next v3.0.0 vertical is the legacy-Next member of the six and counts toward the React numerator. It carries the informational legacy-next sub-tag; its baseline/migrated document-delivery difference stays recorded rather than masked, and the retired olderNext separate numerator folds into React here.',
				}
			: null,
		present.linkfree
			? {
					cell: REACT_LINKFREE_FIXTURE,
					application: 'react-linkfree',
					lineage: 'react' as const,
					witnessReceipt: WITNESS_REACT_LINKFREE_RECEIPT_PATH,
					counted: true,
					demoted: false,
					reason: 'Judge-accepted (T016 re-freeze audit): a create-react-app 5 application really migrated to a Vite 8 build with a direct-Witness browser proof and byte-identical mutation restoration. Its synthetic profile corpus is the recorded boundary of the claim, published rather than hidden, and does not disqualify the migration from the React numerator; the receipt keeps its own per-vertical scoreboard recorded rather than masked.',
				}
			: null,
		present.tinyTranslator
			? {
					cell: ANGULAR_TINY_TRANSLATOR_FIXTURE,
					application: 'angular-tiny-translator',
					lineage: 'angular' as const,
					witnessReceipt: WITNESS_ANGULAR_TINY_TRANSLATOR_RECEIPT_PATH,
					counted: true,
					demoted: false,
					reason: 'Judge-accepted (T016 re-freeze audit): an eleven-major Angular CLI 1.5.4 to 16.2 browser-builder lift with application source really rewritten, proven in the browser with byte-identical mutation restoration. Its era-defect service-worker registration stays recorded rather than masked and does not disqualify the migration from the Angular numerator; the receipt keeps its own per-vertical scoreboard recorded rather than masked.',
				}
			: null,
		present.superProductivity
			? {
					cell: ANGULAR_SUPER_PRODUCTIVITY_FIXTURE,
					application: 'angular-super-productivity',
					lineage: 'angular' as const,
					witnessReceipt: WITNESS_ANGULAR_SUPER_PRODUCTIVITY_RECEIPT_PATH,
					counted: true,
					demoted: false,
					reason: 'Judge-accepted (T016 re-freeze audit): an eight-major Angular CLI 8.3.4 to 16.2 browser-builder lift with application source really rewritten, proven in the browser. Its declared cross-lane appearance differences and unseeded Sass random() build instability across the supersede boundary stay recorded rather than masked and do not disqualify the migration from the Angular numerator; the receipt keeps its own per-vertical scoreboard recorded rather than masked.',
				}
			: null,
	];
	return cells.filter((cell): cell is LineageCountingCell => cell !== null);
}

/**
 * Counts one lineage's numerator off the Judge's ledger.
 *
 * The score is the number of accepted cells and nothing else, so it cannot be
 * set to a value the ledger does not support.
 */
function countedLineageCells(ledger: LineageCountingCell[], lineage: LineageId): number {
	return ledger.filter((cell) => cell.lineage === lineage && cell.counted).length;
}

/**
 * Derives one lineage's denominator off the Judge's ledger.
 *
 * The total is the number of non-demoted cells in the lineage and nothing else,
 * so it cannot be hand-set: a demoted cell (angular-realworld) is excluded and
 * every other present cell is in-denominator. In the completed corpus this
 * derives to six for React and four for Angular.
 */
function lineageDenominator(ledger: LineageCountingCell[], lineage: LineageId): number {
	return ledger.filter((cell) => cell.lineage === lineage && !cell.demoted).length;
}

/**
 * Derives the corpus holdout ledger from verified holdout evidence.
 *
 * A holdout is an application the adapters were applied to *after* they were
 * frozen, to try to falsify them. It is not a vertical, not a source
 * application, and not a lineage counting cell, so it never reaches a
 * numerator. What it must not do is disappear: the cypress-realworld-app
 * attempt failed, and a corpus that publishes only its successes is not
 * evidence. The record is therefore derived from the published receipt, cross-
 * checked against the aggregate's own `holdouts` membership, and emitted with
 * its outcome, its recorded reason, and the frozen fingerprint it ran against.
 */
async function holdoutLedger(
	root: string,
	aggregate: Record<string, unknown>,
): Promise<Array<Record<string, unknown>>> {
	const verified = await verifyHoldoutReactCypressRwaEvidence(root);
	const derived = holdoutReactCypressRwaCorpusRecord(verified.receipt);
	// The Angular holdout is the second published falsification attempt and is
	// treated exactly as the first: derived from its own verified receipt,
	// cross-checked against the aggregate's own membership, failed, and counted
	// nowhere. Its RED is what the declared pre-Ivy support boundary rests on,
	// so it is bound here rather than described beside the boundary.
	const pigalleryVerified = await verifyHoldoutAngularPigallery2Evidence(root);
	const pigalleryDerived = holdoutAngularPigallery2CorpusRecord(pigalleryVerified.receipt);
	// The third holdout is the first whose migrated build is green and the first
	// carried through a browser, which makes it the one entry that could be
	// overstated. It is bound exactly like the two failures — derived from its
	// own verified receipt, cross-checked against the aggregate, counted nowhere
	// — and the facts that keep a bounded pass from reading as a whole one are
	// asserted here rather than left to prose: the Witness state is the bounded
	// one, the browser proof names its surface, the proven surface is the
	// anonymous catalog, the seven recorded surface limits are still carried, and
	// the install RED it took under the frozen composite is still in the record.
	const eshopVerified = await verifyHoldoutAngularEshopWebspaEvidence(root);
	const eshopDerived = holdoutAngularEshopWebspaCorpusRecord(eshopVerified.receipt);
	const published = aggregate.holdouts;
	if (!Array.isArray(published) || published.length !== 3)
		throw new Error('Aggregate holdout membership must carry exactly three records');
	if (canonicalize(record(published[0], 'aggregate holdout record')) !== canonicalize(derived))
		throw new Error('Aggregate holdout record differs from its verified receipt');
	if (
		canonicalize(record(published[1], 'aggregate Angular holdout record')) !==
		canonicalize(pigalleryDerived)
	)
		throw new Error('Aggregate holdout record differs from its verified receipt');
	if (
		canonicalize(record(published[2], 'aggregate Angular holdout record')) !==
		canonicalize(eshopDerived)
	)
		throw new Error('Aggregate holdout record differs from its verified receipt');
	if (derived.countedInLineageNumerator !== false || derived.outcome !== 'failed')
		throw new Error('Corpus holdout record misstates its counting or outcome');
	if (
		pigalleryDerived.countedInLineageNumerator !== false ||
		pigalleryDerived.outcome !== 'failed' ||
		pigalleryDerived.migratedLane !== 'red'
	)
		throw new Error('Corpus holdout record misstates its counting or outcome');
	if (
		eshopDerived.countedInLineageNumerator !== false ||
		eshopDerived.outcome !== HOLDOUT_ANGULAR_ESHOP_WEBSPA_OUTCOME ||
		eshopDerived.witness !== HOLDOUT_ANGULAR_ESHOP_WEBSPA_WITNESS_STATE ||
		eshopDerived.browserProof !== HOLDOUT_ANGULAR_ESHOP_WEBSPA_BROWSER_PROOF ||
		eshopDerived.witnessSurface !== HOLDOUT_ANGULAR_ESHOP_WEBSPA_PROVEN_SURFACE ||
		eshopDerived.witnessSurfaceNotCovered.length !== 7 ||
		eshopDerived.witnessSurfaceNotCovered.filter(
			(limit) => limit.state === 'out-of-surface',
		).length !== 4 ||
		eshopDerived.witnessRuns !== 4 ||
		eshopDerived.migratedLaneUnderFreeze !== 'red'
	)
		throw new Error('Corpus holdout record misstates its counting, outcome or proven surface');
	// The T017 re-run supersedes the tranche-one FAIL by reference. The published
	// holdout membership above stays the immutable tranche-one record; the re-run
	// is bound here as a superseding verification so the corpus ledger reflects
	// its outcome every gate run — proven, still counted in no numerator, and
	// pointing back at the record it supersedes rather than overwriting it.
	const rerunVerified = await verifyHoldoutReactCypressRwaRerunEvidence(root);
	const rerun = holdoutReactCypressRwaRerunCorpusRecord(rerunVerified.receipt);
	if (rerun.countedInLineageNumerator !== false || rerun.outcome !== 'failed')
		throw new Error('Corpus holdout re-run record misstates its counting or outcome');
	if (
		rerun.supersedes !== HOLDOUT_REACT_CYPRESS_RWA_RECEIPT_PATH ||
		rerun.supersededDigest !== verified.receipt.integrity.canonicalDigest ||
		rerun.priorGapNowHandled !== true
	)
		throw new Error('Corpus holdout re-run must supersede the tranche-one receipt by reference');
	if (rerunVerified.receipt.capabilityAdvance.nowHandledByFrozenCapability !== true)
		throw new Error('Corpus holdout re-run must record the prior gap as handled');
	return [
		derived as unknown as Record<string, unknown>,
		pigalleryDerived as unknown as Record<string, unknown>,
		eshopDerived as unknown as Record<string, unknown>,
	];
}

/**
 * Derives the declared support boundaries the corpus publishes.
 *
 * A boundary is the opposite of a claim: it states, as data the matrix and the
 * enterprise reports carry, a cell this engine does not support and why. It is
 * derived from the holdout receipt that established it rather than authored
 * beside it, so a boundary can never be softened without the falsification
 * evidence under it moving first — and that evidence is immutable.
 */
async function supportBoundaryLedger(root: string): Promise<Array<Record<string, unknown>>> {
	const verified = await verifyHoldoutAngularPigallery2Evidence(root);
	const boundary = verified.receipt.supportBoundary;
	if (
		boundary.state !== 'unsupported' ||
		boundary.condition !== ANGULAR_PRE_IVY_SUPPORT_BOUNDARY.condition ||
		boundary.instanceEvidence.libraries !== 3 ||
		boundary.instanceEvidence.importSites !== 6
	)
		throw new Error('Declared support boundary differs from its instance evidence');
	// The amendment is carried beside the declaration, never merged into it: the
	// receipt above is immutable, so the reading rules, the prevalence and the
	// population statement the T022 follow-up ruling added are appended here as
	// their own record and checked before they are published.
	assertAngularPreIvyBoundaryAmendment(ANGULAR_PRE_IVY_BOUNDARY_AMENDMENT);
	return [
		{
			...ANGULAR_PRE_IVY_SUPPORT_BOUNDARY,
			instanceEvidence: {
				...ANGULAR_PRE_IVY_SUPPORT_BOUNDARY.instanceEvidence,
				digest: verified.digest,
				wall: verified.receipt.finding.wall.map((entry) => ({
					library: entry.library,
					lastPublishedVersion: entry.lastPublishedVersion,
					importSites: [...entry.importSites],
				})),
			},
			nonclaims: [...ANGULAR_PRE_IVY_SUPPORT_BOUNDARY.nonclaims],
			amendment: JSON.parse(
				JSON.stringify(ANGULAR_PRE_IVY_BOUNDARY_AMENDMENT),
			) as Record<string, unknown>,
		},
	];
}

/**
 * Refuses a holdout that has leaked into the Judge's counting ledger.
 *
 * The ledger is the only thing a numerator is counted off, so keeping the
 * holdout out of it is what actually keeps it out of the score. This checks the
 * mechanism rather than trusting the construction above it.
 */
function assertHoldoutsAreUncounted(
	ledger: LineageCountingCell[],
	holdouts: Array<Record<string, unknown>>,
): void {
	const applications = new Set<unknown>(holdouts.map((holdout) => holdout.application));
	const cells = new Set<unknown>(holdouts.map((holdout) => holdout.id));
	if (!applications.has(HOLDOUT_REACT_CYPRESS_RWA_APPLICATION))
		throw new Error('Corpus holdout ledger omits the cypress-realworld-app holdout');
	if (!applications.has(HOLDOUT_ANGULAR_PIGALLERY2_APPLICATION))
		throw new Error('Corpus holdout ledger omits the pigallery2 holdout');
	if (!applications.has(HOLDOUT_ANGULAR_ESHOP_WEBSPA_APPLICATION))
		throw new Error('Corpus holdout ledger omits the eShopOnContainers WebSPA holdout');
	if (ledger.some((cell) => applications.has(cell.application) || cells.has(cell.cell)))
		throw new Error('A holdout reached the Judge counting ledger');
}

const sha256Pattern = createRegExp(
	charIn('0123456789').from('a', 'f').times(64).at.lineStart().at.lineEnd(),
);

const canonicalReceipts = [
	{
		id: 'react-boilerplate-v4',
		path: 'evidence/runs/react-boilerplate-v4/t008-run.json',
		digest: '4d32ae0a46041e5ec2ac68aa31a9b8f86bd9d294d312ce41968ddd99dc5ee758',
		application: 'react-boilerplate',
		framework: 'react',
		bundler: 'webpack 4.30.0',
		runtime: 'Node 16.20.2 EOL compatibility sandbox',
	},
	{
		id: 'angular-phonecat',
		path: 'evidence/runs/angular-phonecat/t014-run.json',
		digest: 'a6798081c0b005c76534b5acd4dc647d77d497b0b649748c685b779451035f51',
		application: 'angular-phonecat',
		framework: 'angularjs',
		bundler: 'none-static',
		runtime: 'Node 16 legacy / Node 24 target tooling',
	},
	{
		id: 'react-boilerplate-v4-node24',
		path: 'evidence/runs/react-boilerplate-v4-node24/t022-run.json',
		digest: '815a5416b90c0a0c0a2f0adb779308c0ba0447d67c965003f15d343940d9b593',
		application: 'react-boilerplate',
		framework: 'react',
		bundler: 'webpack 4.47.0',
		runtime: 'Node 24.15.0 darwin-arm64',
	},
	{
		id: 'react-boilerplate-v4-vite8',
		path: 'evidence/runs/react-boilerplate-v4-vite8/t028-run.json',
		digest: '1caf9dfa24b14b83ac63ceab9ca90829346045aac690c7b95a952ae4d9e72849',
		application: 'react-boilerplate',
		framework: 'react',
		bundler: 'Vite 8.0.16',
		runtime: 'Node 24.15.0 darwin-arm64',
	},
	{
		id: 'angular-phonecat-route-resolve',
		path: 'evidence/runs/angular-phonecat-route-resolve/t032-run.json',
		digest: 'aa8b2923a38aa5f1adc870b48cdd938b739e107c927aac71b8c2890705f6beef',
		application: 'angular-phonecat',
		framework: 'angularjs',
		bundler: 'none-static',
		runtime: 'Node 16 legacy / Node 24 target tooling',
	},
	{
		id: 'angular-phonecat-composed',
		path: 'evidence/runs/angular-phonecat-composed/t048-run.json',
		digest: null,
		application: 'angular-phonecat',
		framework: 'angularjs',
		bundler: 'none-static',
		runtime: 'Node 16 legacy / Node 24 target tooling',
	},
	{
		id: 'react-boilerplate-v4-data-flow',
		path: 'evidence/runs/react-boilerplate-v4-data-flow/t054-run.json',
		digest: '2bd6e145d611fb0bb5fb89c9d6ed164a3b30e9c0b1b2a290032f56908e5035da',
		application: 'react-boilerplate',
		framework: 'react',
		bundler: 'Vite 8.0.16',
		runtime: 'Node 24.15.0 darwin-arm64',
	},
	{
		id: 'react-boilerplate-v4-composed',
		path: 'evidence/runs/react-boilerplate-v4-composed/t060-run.json',
		digest: '52400147929220935a9ebe47a16c8dff50b5c28e9d51c930d000c99c2bdc8a21',
		application: 'react-boilerplate',
		framework: 'react',
		bundler: 'webpack 4.30.0 / Vite 8.0.16',
		runtime: 'Node 16.20.2 legacy / Node 24.15.0 target',
	},
	{
		id: 'angular-phonecat-vite8',
		path: 'evidence/runs/angular-phonecat-vite8/t069-run.json',
		digest: '033fc40237975e28df36117cc309625632610a399b5c0f88735079ed21fcad0d',
		application: 'angular-phonecat',
		framework: 'angularjs',
		bundler: 'none-static / Vite 8.0.16',
		runtime: 'Node 16.20.2 legacy / Node 24.15.0 target',
	},
] as const;

const orderedPrepublicationReceipts = [
	'evidence/runs/react-boilerplate-v4/t008-run.json',
	'evidence/runs/angular-phonecat/t014-run.json',
	'evidence/runs/react-boilerplate-v4-node24/t022-run.json',
	'evidence/runs/angular-phonecat-route-resolve/t032-run.json',
	'evidence/runs/angular-phonecat-composed/t048-run.json',
	'evidence/runs/react-boilerplate-v4-vite8/t028-run.json',
	'evidence/runs/angular-phonecat-vite8/t069-run.json',
	ANGULAR_REALWORLD_V15_TO_V16_RECEIPT.path,
	'evidence/runs/react-boilerplate-v4-data-flow/t054-run.json',
	REACT_BOILERPLATE_CANONICAL_RECEIPT_PATH,
] as const;

function assertOrderedAggregate(
	actual: string[],
	expected: readonly string[],
	label: string,
): void {
	if (canonicalize(actual) !== canonicalize(expected))
		throw new Error(`${label} aggregate receipt order differs`);
}

type CanonicalReceipt = (typeof canonicalReceipts)[number];

interface CorpusConformanceOptions {
	rootDir?: string;
}

interface JourneyProjection {
	result: string;
	selectedLocale: string;
	translatedHeading: string;
}

export interface CorpusConformance {
	schemaVersion: typeof CORPUS_CONFORMANCE_SCHEMA;
	summary: {
		verticals: 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20;
		sourceApplications: 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
		designatedPilotsVerified: 0;
	};
	verticals: Array<Record<string, unknown>>;
	applications: Array<Record<string, unknown>>;
	frameworkLanes: Array<Record<string, unknown>>;
	coverage: Record<string, unknown>;
	integrity: { algorithm: 'sha256'; canonicalDigest: string };
}

export type CorpusTransactionState = Readonly<
	| {
			kind: 'prepublication';
			nextKilledByGoogleIntegrated: false;
			angularRealworldWitnessIntegrated: false;
			reactBoilerplateWitnessIntegrated: false;
			nextKilledByGoogleWitnessIntegrated: false;
			verticals: 10;
			sourceApplications: 3;
			receipts: 10;
			resolvedDependencies: 23;
	  }
	| {
			kind: 'postintegration';
			nextKilledByGoogleIntegrated: true;
			verticals: 11;
			sourceApplications: 4;
			receipts: 11;
			resolvedDependencies: 24;
			angularRealworldWitnessIntegrated: false;
			reactBoilerplateWitnessIntegrated: false;
			nextKilledByGoogleWitnessIntegrated: false;
	  }
	| {
			kind: 'production-readiness';
			nextKilledByGoogleIntegrated: true;
			angularRealworldWitnessIntegrated: true;
			verticals: 11;
			sourceApplications: 4;
			receipts: 12;
			resolvedDependencies: 25;
			reactBoilerplateWitnessIntegrated: false;
			nextKilledByGoogleWitnessIntegrated: false;
	  }
	| {
			kind: 'react-candidate';
			nextKilledByGoogleIntegrated: true;
			angularRealworldWitnessIntegrated: true;
			reactBoilerplateWitnessIntegrated: true;
			verticals: 11;
			sourceApplications: 4;
			receipts: 13;
			resolvedDependencies: 26;
			nextKilledByGoogleWitnessIntegrated: false;
	  }
	| {
			kind: 'next-candidate';
			nextKilledByGoogleIntegrated: true;
			angularRealworldWitnessIntegrated: true;
			reactBoilerplateWitnessIntegrated: true;
			nextKilledByGoogleWitnessIntegrated: true;
			verticals: 11;
			sourceApplications: 4;
			receipts: 14;
			resolvedDependencies: 27;
	  }
	| {
			kind: 'react-zero-sw-reconciliation';
			nextKilledByGoogleIntegrated: true;
			angularRealworldWitnessIntegrated: true;
			reactBoilerplateWitnessIntegrated: true;
			nextKilledByGoogleWitnessIntegrated: true;
			verticals: 11;
			sourceApplications: 4;
			receipts: 16;
			resolvedDependencies: 29;
	  }
	| {
			/**
			 * The Papercups create-react-app lineage joins on top of the
			 * zero-service-worker reconciliation, adding its retained build
			 * receipt and its direct browser-proof Witness receipt. It is a new
			 * immutable source application, so it is a new vertical rather than
			 * a reconciliation of an already-counted one.
			 */
			kind: 'react-papercups-browser-proof';
			nextKilledByGoogleIntegrated: true;
			angularRealworldWitnessIntegrated: true;
			reactBoilerplateWitnessIntegrated: true;
			nextKilledByGoogleWitnessIntegrated: true;
			verticals: 12;
			sourceApplications: 5;
			receipts: 18;
			resolvedDependencies: 31;
	  }
	| {
			/**
			 * The HospitalRun create-react-app lineage joins on top of the
			 * Papercups browser proof, adding its retained build-and-boot
			 * receipt and its direct browser-proof Witness receipt. It is a
			 * separate immutable source application, so it is a new vertical
			 * rather than a reconciliation of an already-counted one, and its
			 * React-lineage readiness remains explicitly uncounted.
			 */
			kind: 'react-hospitalrun-browser-proof';
			nextKilledByGoogleIntegrated: true;
			angularRealworldWitnessIntegrated: true;
			reactBoilerplateWitnessIntegrated: true;
			nextKilledByGoogleWitnessIntegrated: true;
			verticals: 13;
			sourceApplications: 6;
			receipts: 20;
			resolvedDependencies: 33;
	  }
	| {
			/**
			 * The factoriolab Angular CLI lineage joins on top of the HospitalRun
			 * browser proof and is the first Angular-lineage browser proof to
			 * enter the aggregate. It publishes one member rather than a pair:
			 * its three build-lane receipts are sealed inside the Witness receipt
			 * by both canonical digest and exact bytes rather than carried as
			 * separate aggregate rows, so the Witness receipt is the whole of its
			 * membership. It is a separate immutable source application, so it is
			 * a new vertical, and its Angular-lineage readiness remains
			 * explicitly uncounted.
			 */
			kind: 'angular-factoriolab-browser-proof';
			nextKilledByGoogleIntegrated: true;
			angularRealworldWitnessIntegrated: true;
			reactBoilerplateWitnessIntegrated: true;
			nextKilledByGoogleWitnessIntegrated: true;
			verticals: 14;
			sourceApplications: 7;
			receipts: 21;
			resolvedDependencies: 34;
	  }
	| {
			/**
			 * The jira-clone Angular CLI lineage joins on top of the factoriolab
			 * browser proof and is the second Angular-lineage browser proof to
			 * enter the aggregate. Like factoriolab it publishes one member
			 * rather than a pair: its four build-lane receipts are sealed inside
			 * the Witness receipt by both canonical digest and exact bytes rather
			 * than carried as separate aggregate rows, so the Witness receipt is
			 * the whole of its membership. It is a separate immutable source
			 * application, so it is a new vertical, and its Angular-lineage
			 * readiness remains explicitly uncounted.
			 */
			kind: 'angular-jira-clone-browser-proof';
			nextKilledByGoogleIntegrated: true;
			angularRealworldWitnessIntegrated: true;
			reactBoilerplateWitnessIntegrated: true;
			nextKilledByGoogleWitnessIntegrated: true;
			verticals: 15;
			sourceApplications: 8;
			receipts: 22;
			resolvedDependencies: 35;
	  }
	| {
			/**
			 * The memos old-Vite-origin lineage joins on top of the jira-clone
			 * browser proof and is the first React-lineage vertical whose origin
			 * bundler is Vite rather than webpack. It publishes one member: its
			 * build-lane receipt is sealed inside the Witness receipt by the
			 * sha256 of its exact bytes — the lane receipt declares no canonical
			 * digest of its own — so a second aggregate row would restate a
			 * binding that already exists. It is a separate immutable source
			 * application, so it is a new vertical, and its React-lineage
			 * readiness is explicitly uncounted pending the Judge.
			 */
			kind: 'react-memos-browser-proof';
			nextKilledByGoogleIntegrated: true;
			angularRealworldWitnessIntegrated: true;
			reactBoilerplateWitnessIntegrated: true;
			nextKilledByGoogleWitnessIntegrated: true;
			verticals: 16;
			sourceApplications: 9;
			receipts: 23;
			resolvedDependencies: 36;
	  }
	| {
			/**
			 * The killedbygoogle v3.0.0 legacy-Next lineage joins on top of the
			 * memos browser proof. It is a new vertical but NOT a new source
			 * application: it is the same repository at the same pinned revision
			 * with the same archive digest as the derived-state-to-memo vertical
			 * already in the corpus, so it joins that application's vertical list
			 * rather than being counted a second time. The proof itself is new —
			 * the earlier vertical is a derived-state migration, this one is a
			 * direct-Witness browser proof of the Next 12 static export moved to
			 * a Vite 8 client build — which is why the vertical count rises and
			 * the source-application count does not. Its two build-lane digests
			 * are sealed inside the Witness receipt, so it publishes one member,
			 * and its Next lineage stays the standing olderNext 0/4 pending the
			 * Judge.
			 */
			kind: 'next-killedbygoogle-v3-browser-proof';
			nextKilledByGoogleIntegrated: true;
			angularRealworldWitnessIntegrated: true;
			reactBoilerplateWitnessIntegrated: true;
			nextKilledByGoogleWitnessIntegrated: true;
			verticals: 17;
			sourceApplications: 9;
			receipts: 24;
			resolvedDependencies: 37;
	  }
	| {
			/**
			 * The LinkFree create-react-app 5 lineage joins on top of the
			 * killedbygoogle v3 browser proof and is the third create-react-app
			 * source application in the corpus. It publishes one member: the
			 * build-lane receipt it seals is bound by both canonical digest and
			 * exact bytes inside the Witness receipt. Its proof was run over a
			 * synthetic profile corpus staged through the application's own
			 * codegen, which the receipt records as a corpus ruling rather than
			 * hiding, and its React-lineage readiness is explicitly uncounted
			 * pending the Judge.
			 */
			kind: 'react-linkfree-browser-proof';
			nextKilledByGoogleIntegrated: true;
			angularRealworldWitnessIntegrated: true;
			reactBoilerplateWitnessIntegrated: true;
			nextKilledByGoogleWitnessIntegrated: true;
			verticals: 18;
			sourceApplications: 10;
			receipts: 25;
			resolvedDependencies: 38;
	  }
	| {
			/**
			 * The TinyTranslator Angular CLI 1.5.4 lineage joins on top of the
			 * LinkFree browser proof and is the third Angular-lineage browser
			 * proof to enter the aggregate. Like factoriolab and jira-clone it
			 * publishes one member rather than a pair: its two build-lane
			 * receipts — the era baseline and the offline-font migrated lane —
			 * are sealed inside the Witness receipt by both canonical digest and
			 * exact bytes rather than carried as separate aggregate rows, so the
			 * Witness receipt is the whole of its membership. It is a separate
			 * immutable source application, so it is a new vertical, and its
			 * Angular-lineage readiness remains explicitly uncounted: the receipt
			 * records an era-defect service-worker registration carried across the
			 * migration rather than masking it.
			 */
			kind: 'angular-tiny-translator-browser-proof';
			nextKilledByGoogleIntegrated: true;
			angularRealworldWitnessIntegrated: true;
			reactBoilerplateWitnessIntegrated: true;
			nextKilledByGoogleWitnessIntegrated: true;
			verticals: 19;
			sourceApplications: 11;
			receipts: 26;
			resolvedDependencies: 39;
	  }
	| {
			/**
			 * The super-productivity Angular CLI 8.3.4 lineage joins on top of the
			 * TinyTranslator browser proof and is the fourth Angular-lineage
			 * browser proof to enter the aggregate, and the last portfolio cell of
			 * this matrix. Like factoriolab, jira-clone and tiny-translator it
			 * publishes one member rather than a pair: its two build-lane receipts
			 * — the era-baseline digest correction and the deterministic-modulo-the
			 * -service-worker-manifest migrated lane — are sealed inside the Witness
			 * receipt by both canonical digest and exact bytes rather than carried
			 * as separate aggregate rows, so the Witness receipt is the whole of its
			 * membership. It is a separate immutable source application, so it is a
			 * new vertical, and its Angular-lineage readiness remains explicitly
			 * uncounted: the receipt records declared cross-lane appearance
			 * differences and an unseeded Sass random() build instability carried
			 * across the supersede boundary rather than masking either.
			 */
			kind: 'angular-super-productivity-browser-proof';
			nextKilledByGoogleIntegrated: true;
			angularRealworldWitnessIntegrated: true;
			reactBoilerplateWitnessIntegrated: true;
			nextKilledByGoogleWitnessIntegrated: true;
			verticals: 20;
			sourceApplications: 12;
			receipts: 27;
			resolvedDependencies: 40;
	  }
	| {
			kind: 'react-avataaars-candidate';
			nextKilledByGoogleIntegrated: true;
			angularRealworldWitnessIntegrated: true;
			reactBoilerplateWitnessIntegrated: true;
			nextKilledByGoogleWitnessIntegrated: true;
			verticals: 11;
			sourceApplications: 4;
			receipts: 15;
			resolvedDependencies: 28;
	  }
	| {
			kind: 'react-calculator-candidate';
			nextKilledByGoogleIntegrated: true;
			angularRealworldWitnessIntegrated: true;
			reactBoilerplateWitnessIntegrated: true;
			nextKilledByGoogleWitnessIntegrated: true;
			verticals: 12;
			sourceApplications: 5;
			receipts: 15;
			resolvedDependencies: 28;
	  }
	| {
			kind: 'react-graphiql-013-candidate';
			nextKilledByGoogleIntegrated: true;
			angularRealworldWitnessIntegrated: true;
			reactBoilerplateWitnessIntegrated: true;
			nextKilledByGoogleWitnessIntegrated: true;
			verticals: 12;
			sourceApplications: 5;
			receipts: 15;
			resolvedDependencies: 28;
	  }
>;

function record(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`Corpus conformance ${label} must be an object`);
	return value as Record<string, unknown>;
}

function string(value: unknown, label: string): string {
	if (typeof value !== 'string' || value.length === 0)
		throw new Error(`Corpus conformance ${label} must be a non-empty string`);
	return value;
}

async function readJson(file: string): Promise<unknown> {
	return JSON.parse(await readFile(file, 'utf8'));
}

function sourceIdentity(receipt: MigrationReceipt): Record<string, string> {
	const parsed = parseURL(receipt.source.repository);
	if (parsed.protocol !== 'https:' || !parsed.host || !parsed.pathname)
		throw new Error(
			`Corpus source repository is not a canonical HTTPS URL: ${receipt.fixture}`,
		);
	return {
		repository: normalizeURL(receipt.source.repository),
		revision: receipt.source.revision,
		archiveSha256: receipt.source.archiveSha256,
		license: receipt.source.license,
		licenseSha256: receipt.source.licenseSha256,
	};
}

function keys(value: Record<string, unknown>): string[] {
	return Object.keys(value).sort();
}

function uniqueCanonical<T>(values: T[]): T[] {
	const found = new Map(values.map((value) => [canonicalize(value), value]));
	return [...found.entries()]
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([, value]) => value);
}

function journeyArtifact(receipt: MigrationReceipt): { path: string; sha256: string } {
	const artifact = receipt.artifacts.find((item) => path.basename(item.path) === 'journey.json');
	if (!artifact) throw new Error(`Corpus receipt omits journey artifact: ${receipt.fixture}`);
	return artifact;
}

function reactProjection(value: unknown, fixture: string): JourneyProjection {
	const item = record(value, `${fixture} journey row`);
	return {
		result: string(item.result, `${fixture} journey result`),
		selectedLocale: string(item.selectedLocale, `${fixture} selected locale`),
		translatedHeading: string(item.translatedHeading, `${fixture} translated heading`),
	};
}

function blockedUrls(value: unknown, fixture: string): string[] {
	const blocked = record(value, `${fixture} journey row`).blocked;
	if (!Array.isArray(blocked)) throw new Error(`Corpus ${fixture} blocked observation missing`);
	return blocked.map((item) => normalizeURL(string(item, `${fixture} blocked URL`))).sort();
}

function receiptShape(receipt: MigrationReceipt, journey: unknown[]): Record<string, unknown> {
	const migration = receipt.migration as unknown as Record<string, unknown>;
	return {
		schemaVersion: receipt.schemaVersion,
		toolingFields: keys(receipt.tooling),
		migrationFields: keys(migration),
		journeyFields: uniqueCanonical(
			journey.map((value) => keys(record(value, `${receipt.fixture} journey row`))),
		),
	};
}

function assertAggregateFixture(
	value: unknown,
	expected: CanonicalReceipt,
): Record<string, unknown> {
	const fixture = record(value, `aggregate fixture ${expected.id}`);
	if (
		fixture.id !== expected.id ||
		fixture.receipt !== expected.path ||
		(expected.digest !== null && fixture.digest !== expected.digest) ||
		fixture.result !== 'pass' ||
		fixture.framework !== expected.framework ||
		(expected.id === 'angular-phonecat-vite8' &&
			(fixture.bundler !== 'none-static-to-vite-8' ||
				fixture.track !== 'angularjs-special-track' ||
				fixture.runtime !== 'node-16-to-node-24.15.0'))
	)
		throw new Error(`Aggregate membership mismatch: ${expected.id}`);
	return fixture;
}

/**
 * Derives the three browser-proof states that sit above the jira-clone one.
 *
 * They are checked here rather than inline for one reason only: the inline
 * chain is already ten conditionals deep, and three more would bury the checks
 * under indentation without changing a single one of them. Every check the
 * inline chain makes is made here too, in the same order and with the same
 * strictness — the derived member must canonicalize to exactly what its Witness
 * module builds from the published digest, the aggregate must hold exactly the
 * expected number of members at each state, and the receipt order must match
 * the exact appended sequence. Each state is only reachable through its own
 * predecessor, so the three lanes cannot be admitted out of order.
 *
 * Returning `null` means the memos member is absent, which is the jira-clone
 * state's business to conclude, not this function's.
 */
function deriveReactTrioTransactionState(
	byPath: Map<string, unknown>,
	orderedPaths: string[],
	jiraCloneOrder: readonly string[],
): CorpusTransactionState | null {
	const memos = byPath.get(WITNESS_REACT_MEMOS_RECEIPT_PATH);
	if (!memos) return null;
	const memosRecord = record(memos, 'React memos Witness aggregate fixture');
	const memosDigest = string(memosRecord.digest, 'React memos Witness aggregate digest');
	if (
		!sha256Pattern.test(memosDigest) ||
		canonicalize(memosRecord) !== canonicalize(witnessReactMemosAggregateMember(memosDigest))
	)
		throw new Error('React memos aggregate membership mismatch');
	const memosOrder = [...jiraCloneOrder, WITNESS_REACT_MEMOS_RECEIPT_PATH];
	const killedbygoogle = byPath.get(WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECEIPT_PATH);
	if (!killedbygoogle) {
		if (byPath.size !== canonicalReceipts.length + 14)
			throw new Error('React memos aggregate membership mismatch');
		assertOrderedAggregate(orderedPaths, memosOrder, 'React memos browser proof');
		return {
			kind: 'react-memos-browser-proof',
			nextKilledByGoogleIntegrated: true,
			angularRealworldWitnessIntegrated: true,
			reactBoilerplateWitnessIntegrated: true,
			nextKilledByGoogleWitnessIntegrated: true,
			verticals: 16,
			sourceApplications: 9,
			receipts: 23,
			resolvedDependencies: 36,
		};
	}
	const killedbygoogleRecord = record(
		killedbygoogle,
		'KilledByGoogle v3 Witness aggregate fixture',
	);
	const killedbygoogleDigest = string(
		killedbygoogleRecord.digest,
		'KilledByGoogle v3 Witness aggregate digest',
	);
	if (
		!sha256Pattern.test(killedbygoogleDigest) ||
		canonicalize(killedbygoogleRecord) !==
			canonicalize(witnessNextKilledbygoogleV3AggregateMember(killedbygoogleDigest))
	)
		throw new Error('KilledByGoogle v3 aggregate membership mismatch');
	const killedbygoogleOrder = [...memosOrder, WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECEIPT_PATH];
	const linkfree = byPath.get(WITNESS_REACT_LINKFREE_RECEIPT_PATH);
	if (!linkfree) {
		if (byPath.size !== canonicalReceipts.length + 15)
			throw new Error('KilledByGoogle v3 aggregate membership mismatch');
		assertOrderedAggregate(
			orderedPaths,
			killedbygoogleOrder,
			'KilledByGoogle v3 browser proof',
		);
		return {
			kind: 'next-killedbygoogle-v3-browser-proof',
			nextKilledByGoogleIntegrated: true,
			angularRealworldWitnessIntegrated: true,
			reactBoilerplateWitnessIntegrated: true,
			nextKilledByGoogleWitnessIntegrated: true,
			verticals: 17,
			sourceApplications: 9,
			receipts: 24,
			resolvedDependencies: 37,
		};
	}
	const linkfreeRecord = record(linkfree, 'React LinkFree Witness aggregate fixture');
	const linkfreeDigest = string(linkfreeRecord.digest, 'React LinkFree Witness aggregate digest');
	if (
		!sha256Pattern.test(linkfreeDigest) ||
		canonicalize(linkfreeRecord) !==
			canonicalize(witnessReactLinkfreeAggregateMember(linkfreeDigest))
	)
		throw new Error('React LinkFree aggregate membership mismatch');
	const linkfreeOrder = [...killedbygoogleOrder, WITNESS_REACT_LINKFREE_RECEIPT_PATH];
	const tinyTranslator = byPath.get(WITNESS_ANGULAR_TINY_TRANSLATOR_RECEIPT_PATH);
	if (!tinyTranslator) {
		if (byPath.size !== canonicalReceipts.length + 16)
			throw new Error('React LinkFree aggregate membership mismatch');
		assertOrderedAggregate(orderedPaths, linkfreeOrder, 'React LinkFree browser proof');
		return {
			kind: 'react-linkfree-browser-proof',
			nextKilledByGoogleIntegrated: true,
			angularRealworldWitnessIntegrated: true,
			reactBoilerplateWitnessIntegrated: true,
			nextKilledByGoogleWitnessIntegrated: true,
			verticals: 18,
			sourceApplications: 10,
			receipts: 25,
			resolvedDependencies: 38,
		};
	}
	const tinyTranslatorRecord = record(
		tinyTranslator,
		'Angular TinyTranslator Witness aggregate fixture',
	);
	const tinyTranslatorDigest = string(
		tinyTranslatorRecord.digest,
		'Angular TinyTranslator Witness aggregate digest',
	);
	if (
		!sha256Pattern.test(tinyTranslatorDigest) ||
		canonicalize(tinyTranslatorRecord) !==
			canonicalize(witnessAngularTinyTranslatorAggregateMember(tinyTranslatorDigest))
	)
		throw new Error('Angular TinyTranslator aggregate membership mismatch');
	const tinyTranslatorOrder = [...linkfreeOrder, WITNESS_ANGULAR_TINY_TRANSLATOR_RECEIPT_PATH];
	const superProductivity = byPath.get(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_RECEIPT_PATH);
	if (!superProductivity) {
		if (byPath.size !== canonicalReceipts.length + 17)
			throw new Error('Angular TinyTranslator aggregate membership mismatch');
		assertOrderedAggregate(
			orderedPaths,
			tinyTranslatorOrder,
			'Angular TinyTranslator browser proof',
		);
		return {
			kind: 'angular-tiny-translator-browser-proof',
			nextKilledByGoogleIntegrated: true,
			angularRealworldWitnessIntegrated: true,
			reactBoilerplateWitnessIntegrated: true,
			nextKilledByGoogleWitnessIntegrated: true,
			verticals: 19,
			sourceApplications: 11,
			receipts: 26,
			resolvedDependencies: 39,
		};
	}
	const superProductivityRecord = record(
		superProductivity,
		'Angular Super Productivity Witness aggregate fixture',
	);
	const superProductivityDigest = string(
		superProductivityRecord.digest,
		'Angular Super Productivity Witness aggregate digest',
	);
	if (
		!sha256Pattern.test(superProductivityDigest) ||
		canonicalize(superProductivityRecord) !==
			canonicalize(witnessAngularSuperProductivityAggregateMember(superProductivityDigest)) ||
		byPath.size !== canonicalReceipts.length + 18
	)
		throw new Error('Angular Super Productivity aggregate membership mismatch');
	assertOrderedAggregate(
		orderedPaths,
		[...tinyTranslatorOrder, WITNESS_ANGULAR_SUPER_PRODUCTIVITY_RECEIPT_PATH],
		'Angular Super Productivity browser proof',
	);
	return {
		kind: 'angular-super-productivity-browser-proof',
		nextKilledByGoogleIntegrated: true,
		angularRealworldWitnessIntegrated: true,
		reactBoilerplateWitnessIntegrated: true,
		nextKilledByGoogleWitnessIntegrated: true,
		verticals: 20,
		sourceApplications: 12,
		receipts: 27,
		resolvedDependencies: 40,
	};
}

export function deriveCorpusTransactionState(fixtures: unknown): CorpusTransactionState {
	if (!Array.isArray(fixtures)) throw new Error('Aggregate fixtures must be an array');
	const byPath = new Map<string, unknown>();
	const orderedPaths: string[] = [];
	for (const value of fixtures) {
		const fixture = record(value, 'aggregate fixture');
		const receiptPath = string(fixture.receipt, 'aggregate receipt path');
		if (byPath.has(receiptPath))
			throw new Error('Aggregate membership contains duplicate receipts');
		byPath.set(receiptPath, value);
		orderedPaths.push(receiptPath);
	}
	for (const expected of canonicalReceipts) {
		const value = byPath.get(expected.path);
		if (!value) throw new Error(`Aggregate is missing receipt: ${expected.path}`);
		assertAggregateFixture(value, expected);
		const digest = record(value, `aggregate fixture ${expected.id}`).digest;
		if (typeof digest !== 'string' || !sha256Pattern.test(digest))
			throw new Error(`Aggregate digest is invalid: ${expected.id}`);
	}
	const angular = byPath.get(ANGULAR_REALWORLD_V15_TO_V16_RECEIPT.path);
	if (
		!angular ||
		canonicalize(record(angular, 'Angular RealWorld aggregate fixture')) !==
			canonicalize({
				id: 'angular-realworld-v15-to-v16',
				framework: 'angular',
				track: 'angular2-plus-adjacent-major',
				bundler: 'angular-cli-architect-aot-15-to-16',
				runtime: 'node-18.20.8',
				result: 'pass',
				receipt: ANGULAR_REALWORLD_V15_TO_V16_RECEIPT.path,
				digest: ANGULAR_REALWORLD_V15_TO_V16_RECEIPT.canonicalDigest,
			})
	)
		throw new Error('Angular RealWorld aggregate membership mismatch');
	const next = byPath.get(NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH);
	if (next) {
		const nextRecord = record(next, 'Killed by Google aggregate fixture');
		const digest = string(nextRecord.digest, 'Killed by Google aggregate digest');
		if (
			!sha256Pattern.test(digest) ||
			canonicalize(nextRecord) !== canonicalize(nextKilledByGoogleAggregateMember(digest))
		)
			throw new Error('Killed by Google aggregate membership mismatch');
		const witness = byPath.get(WITNESS_ANGULAR_REALWORLD_RECEIPT_PATH);
		if (witness) {
			const witnessRecord = record(witness, 'Witness Angular RealWorld aggregate fixture');
			const witnessDigest = string(
				witnessRecord.digest,
				'Witness Angular RealWorld aggregate digest',
			);
			if (
				!sha256Pattern.test(witnessDigest) ||
				canonicalize(witnessRecord) !==
					canonicalize(witnessAngularRealworldAggregateMember(witnessDigest))
			)
				throw new Error('Witness Angular RealWorld aggregate membership mismatch');
			const react = byPath.get(WITNESS_REACT_BOILERPLATE_RECEIPT_PATH);
			if (react) {
				const reactRecord = record(react, 'Witness React Boilerplate aggregate fixture');
				const reactDigest = string(
					reactRecord.digest,
					'Witness React Boilerplate aggregate digest',
				);
				if (
					!sha256Pattern.test(reactDigest) ||
					canonicalize(reactRecord) !==
						canonicalize(witnessReactBoilerplateAggregateMember(reactDigest))
				)
					throw new Error('Witness React Boilerplate aggregate membership mismatch');
				const nextWitness = byPath.get(WITNESS_NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH);
				if (nextWitness) {
					const nextWitnessRecord = record(
						nextWitness,
						'Witness Next KilledByGoogle aggregate fixture',
					);
					const nextWitnessDigest = string(
						nextWitnessRecord.digest,
						'Witness Next KilledByGoogle aggregate digest',
					);
					if (
						!sha256Pattern.test(nextWitnessDigest) ||
						canonicalize(nextWitnessRecord) !==
							canonicalize(
								witnessNextKilledByGoogleAggregateMember(nextWitnessDigest),
							)
					)
						throw new Error(
							'Witness Next KilledByGoogle aggregate membership mismatch',
						);
					const avataaars = byPath.get(REACT_AVATAAARS_COMPATIBILITY_RECEIPT_PATH);
					const calculator = byPath.get(REACT_CALCULATOR_RECEIPT_PATH);
					const graphiql = byPath.get(REACT_GRAPHIQL_013_RECEIPT_PATH);
					const candidateOrder = [
						...orderedPrepublicationReceipts.slice(0, 8),
						WITNESS_ANGULAR_REALWORLD_RECEIPT_PATH,
						NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH,
						...orderedPrepublicationReceipts.slice(8),
						WITNESS_REACT_BOILERPLATE_RECEIPT_PATH,
						WITNESS_NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH,
					];
					const zeroSw = byPath.get(WITNESS_REACT_BOILERPLATE_ZERO_SW_RECEIPT_PATH);
					if (zeroSw) {
						const zeroSwMigration = byPath.get(REACT_BOILERPLATE_ZERO_SW_RECEIPT_PATH);
						const zeroSwRecord = record(
							zeroSw,
							'React Boilerplate zero-SW aggregate fixture',
						);
						const digest = string(
							zeroSwRecord.digest,
							'React Boilerplate zero-SW aggregate digest',
						);
						if (
							zeroSwMigration === undefined ||
							canonicalize(
								record(
									zeroSwMigration,
									'React Boilerplate zero-SW migration aggregate fixture',
								),
							) !==
								canonicalize({
									id: 'react-boilerplate-v4-zero-sw',
									framework: 'react',
									track: 'current-zero-service-worker-policy-reconciliation',
									bundler: 'webpack-4.30.0-to-vite-8.0.16',
									runtime: 'node-16.20.2-to-node-24.15.0',
									result: 'pass',
									receipt: REACT_BOILERPLATE_ZERO_SW_RECEIPT_PATH,
									digest: record(
										zeroSwMigration,
										'React Boilerplate zero-SW migration aggregate fixture',
									).digest,
								}) ||
							!sha256Pattern.test(digest) ||
							canonicalize(zeroSwRecord) !==
								canonicalize(witnessReactBoilerplateZeroSwAggregateMember(digest))
						)
							throw new Error(
								'React Boilerplate zero-SW aggregate membership mismatch',
							);
						const zeroSwOrder = [
							...candidateOrder,
							REACT_BOILERPLATE_ZERO_SW_RECEIPT_PATH,
							WITNESS_REACT_BOILERPLATE_ZERO_SW_RECEIPT_PATH,
						];
						const papercups = byPath.get(WITNESS_REACT_PAPERCUPS_RECEIPT_PATH);
						if (papercups) {
							const papercupsMigration = byPath.get(REACT_PAPERCUPS_RECEIPT_PATH);
							const papercupsRecord = record(
								papercups,
								'React Papercups Witness aggregate fixture',
							);
							const papercupsDigest = string(
								papercupsRecord.digest,
								'React Papercups Witness aggregate digest',
							);
							if (papercupsMigration === undefined)
								throw new Error('React Papercups aggregate membership mismatch');
							const papercupsMigrationRecord = record(
								papercupsMigration,
								'React Papercups migration aggregate fixture',
							);
							const papercupsMigrationDigest = string(
								papercupsMigrationRecord.digest,
								'React Papercups migration aggregate digest',
							);
							if (
								!sha256Pattern.test(papercupsDigest) ||
								!sha256Pattern.test(papercupsMigrationDigest) ||
								canonicalize(papercupsRecord) !==
									canonicalize(
										witnessReactPapercupsAggregateMember(papercupsDigest),
									) ||
								canonicalize(papercupsMigrationRecord) !==
									canonicalize(
										reactPapercupsAggregateMember(papercupsMigrationDigest),
									)
							)
								throw new Error('React Papercups aggregate membership mismatch');
							const papercupsOrder = [
								...zeroSwOrder,
								REACT_PAPERCUPS_RECEIPT_PATH,
								WITNESS_REACT_PAPERCUPS_RECEIPT_PATH,
							];
							const hospitalrun = byPath.get(
								WITNESS_REACT_HOSPITALRUN_RECEIPT_PATH,
							);
							if (hospitalrun) {
								const hospitalrunMigration = byPath.get(
									REACT_HOSPITALRUN_RECEIPT_PATH,
								);
								const hospitalrunRecord = record(
									hospitalrun,
									'React HospitalRun Witness aggregate fixture',
								);
								const hospitalrunDigest = string(
									hospitalrunRecord.digest,
									'React HospitalRun Witness aggregate digest',
								);
								if (hospitalrunMigration === undefined)
									throw new Error(
										'React HospitalRun aggregate membership mismatch',
									);
								const hospitalrunMigrationRecord = record(
									hospitalrunMigration,
									'React HospitalRun migration aggregate fixture',
								);
								const hospitalrunMigrationDigest = string(
									hospitalrunMigrationRecord.digest,
									'React HospitalRun migration aggregate digest',
								);
								if (
									!sha256Pattern.test(hospitalrunDigest) ||
									!sha256Pattern.test(hospitalrunMigrationDigest) ||
									canonicalize(hospitalrunRecord) !==
										canonicalize(
											witnessReactHospitalrunAggregateMember(
												hospitalrunDigest,
											),
										) ||
									canonicalize(hospitalrunMigrationRecord) !==
										canonicalize(
											reactHospitalrunAggregateMember(
												hospitalrunMigrationDigest,
											),
										)
								)
									throw new Error(
										'React HospitalRun aggregate membership mismatch',
									);
								const hospitalrunOrder = [
									...papercupsOrder,
									REACT_HOSPITALRUN_RECEIPT_PATH,
									WITNESS_REACT_HOSPITALRUN_RECEIPT_PATH,
								];
								const factoriolab = byPath.get(
									WITNESS_ANGULAR_FACTORIOLAB_RECEIPT_PATH,
								);
								if (factoriolab) {
									const factoriolabRecord = record(
										factoriolab,
										'Angular factoriolab Witness aggregate fixture',
									);
									const factoriolabDigest = string(
										factoriolabRecord.digest,
										'Angular factoriolab Witness aggregate digest',
									);
									if (
										!sha256Pattern.test(factoriolabDigest) ||
										canonicalize(factoriolabRecord) !==
											canonicalize(
												witnessAngularFactoriolabAggregateMember(
													factoriolabDigest,
												),
											)
									)
										throw new Error(
											'Angular factoriolab aggregate membership mismatch',
										);
									const factoriolabOrder = [
										...hospitalrunOrder,
										WITNESS_ANGULAR_FACTORIOLAB_RECEIPT_PATH,
									];
									const jiraClone = byPath.get(
										WITNESS_ANGULAR_JIRA_CLONE_RECEIPT_PATH,
									);
									if (jiraClone) {
										const jiraCloneRecord = record(
											jiraClone,
											'Angular jira-clone Witness aggregate fixture',
										);
										const jiraCloneDigest = string(
											jiraCloneRecord.digest,
											'Angular jira-clone Witness aggregate digest',
										);
										if (
											!sha256Pattern.test(jiraCloneDigest) ||
											canonicalize(jiraCloneRecord) !==
												canonicalize(
													witnessAngularJiraCloneAggregateMember(
														jiraCloneDigest,
													),
												)
										)
											throw new Error(
												'Angular jira-clone aggregate membership mismatch',
											);
										const jiraCloneOrder = [
											...factoriolabOrder,
											WITNESS_ANGULAR_JIRA_CLONE_RECEIPT_PATH,
										];
										const trio = deriveReactTrioTransactionState(
											byPath,
											orderedPaths,
											jiraCloneOrder,
										);
										if (trio) return trio;
										if (byPath.size !== canonicalReceipts.length + 13)
											throw new Error(
												'Angular jira-clone aggregate membership mismatch',
											);
										assertOrderedAggregate(
											orderedPaths,
											jiraCloneOrder,
											'Angular jira-clone browser proof',
										);
										return {
											kind: 'angular-jira-clone-browser-proof',
											nextKilledByGoogleIntegrated: true,
											angularRealworldWitnessIntegrated: true,
											reactBoilerplateWitnessIntegrated: true,
											nextKilledByGoogleWitnessIntegrated: true,
											verticals: 15,
											sourceApplications: 8,
											receipts: 22,
											resolvedDependencies: 35,
										};
									}
									if (byPath.size !== canonicalReceipts.length + 12)
										throw new Error(
											'Angular factoriolab aggregate membership mismatch',
										);
									assertOrderedAggregate(
										orderedPaths,
										factoriolabOrder,
										'Angular factoriolab browser proof',
									);
									return {
										kind: 'angular-factoriolab-browser-proof',
										nextKilledByGoogleIntegrated: true,
										angularRealworldWitnessIntegrated: true,
										reactBoilerplateWitnessIntegrated: true,
										nextKilledByGoogleWitnessIntegrated: true,
										verticals: 14,
										sourceApplications: 7,
										receipts: 21,
										resolvedDependencies: 34,
									};
								}
								if (byPath.size !== canonicalReceipts.length + 11)
									throw new Error(
										'React HospitalRun aggregate membership mismatch',
									);
								assertOrderedAggregate(
									orderedPaths,
									hospitalrunOrder,
									'React HospitalRun browser proof',
								);
								return {
									kind: 'react-hospitalrun-browser-proof',
									nextKilledByGoogleIntegrated: true,
									angularRealworldWitnessIntegrated: true,
									reactBoilerplateWitnessIntegrated: true,
									nextKilledByGoogleWitnessIntegrated: true,
									verticals: 13,
									sourceApplications: 6,
									receipts: 20,
									resolvedDependencies: 33,
								};
							}
							if (byPath.size !== canonicalReceipts.length + 9)
								throw new Error('React Papercups aggregate membership mismatch');
							assertOrderedAggregate(
								orderedPaths,
								papercupsOrder,
								'React Papercups browser proof',
							);
							return {
								kind: 'react-papercups-browser-proof',
								nextKilledByGoogleIntegrated: true,
								angularRealworldWitnessIntegrated: true,
								reactBoilerplateWitnessIntegrated: true,
								nextKilledByGoogleWitnessIntegrated: true,
								verticals: 12,
								sourceApplications: 5,
								receipts: 18,
								resolvedDependencies: 31,
							};
						}
						if (byPath.size !== canonicalReceipts.length + 7)
							throw new Error(
								'React Boilerplate zero-SW aggregate membership mismatch',
							);
						assertOrderedAggregate(
							orderedPaths,
							[
								...candidateOrder,
								REACT_BOILERPLATE_ZERO_SW_RECEIPT_PATH,
								WITNESS_REACT_BOILERPLATE_ZERO_SW_RECEIPT_PATH,
							],
							'React zero-SW reconciliation',
						);
						return {
							kind: 'react-zero-sw-reconciliation',
							nextKilledByGoogleIntegrated: true,
							angularRealworldWitnessIntegrated: true,
							reactBoilerplateWitnessIntegrated: true,
							nextKilledByGoogleWitnessIntegrated: true,
							verticals: 11,
							sourceApplications: 4,
							receipts: 16,
							resolvedDependencies: 29,
						};
					}
					if (avataaars) {
						const avataaarsRecord = record(
							avataaars,
							'React Avataaars aggregate fixture',
						);
						const digest = string(
							avataaarsRecord.digest,
							'React Avataaars aggregate digest',
						);
						if (
							canonicalize(avataaarsRecord) !==
								canonicalize(reactAvataaarsCompatibilityAggregateMember(digest)) ||
							byPath.size !== canonicalReceipts.length + 6
						)
							throw new Error('React Avataaars aggregate membership mismatch');
						assertOrderedAggregate(
							orderedPaths,
							[...candidateOrder, REACT_AVATAAARS_COMPATIBILITY_RECEIPT_PATH],
							'React Avataaars candidate',
						);
						return {
							kind: 'react-avataaars-candidate',
							nextKilledByGoogleIntegrated: true,
							angularRealworldWitnessIntegrated: true,
							reactBoilerplateWitnessIntegrated: true,
							nextKilledByGoogleWitnessIntegrated: true,
							verticals: 11,
							sourceApplications: 4,
							receipts: 15,
							resolvedDependencies: 28,
						};
					}
					if (calculator) {
						const calculatorRecord = record(
							calculator,
							'React Calculator aggregate fixture',
						);
						const digest = string(
							calculatorRecord.digest,
							'React Calculator aggregate digest',
						);
						if (
							canonicalize(calculatorRecord) !==
								canonicalize(reactCalculatorAggregateMember(digest)) ||
							byPath.size !== canonicalReceipts.length + 6
						)
							throw new Error('React Calculator aggregate membership mismatch');
						assertOrderedAggregate(
							orderedPaths,
							[...candidateOrder, REACT_CALCULATOR_RECEIPT_PATH],
							'React Calculator candidate',
						);
						return {
							kind: 'react-calculator-candidate',
							nextKilledByGoogleIntegrated: true,
							angularRealworldWitnessIntegrated: true,
							reactBoilerplateWitnessIntegrated: true,
							nextKilledByGoogleWitnessIntegrated: true,
							verticals: 12,
							sourceApplications: 5,
							receipts: 15,
							resolvedDependencies: 28,
						};
					}
					if (graphiql) {
						const graphiqlRecord = record(graphiql, 'React GraphiQL aggregate fixture');
						const digest = string(
							graphiqlRecord.digest,
							'React GraphiQL aggregate digest',
						);
						if (
							canonicalize(graphiqlRecord) !==
								canonicalize(reactGraphiQL013AggregateMember(digest)) ||
							byPath.size !== canonicalReceipts.length + 6
						)
							throw new Error('React GraphiQL aggregate membership mismatch');
						assertOrderedAggregate(
							orderedPaths,
							[...candidateOrder, REACT_GRAPHIQL_013_RECEIPT_PATH],
							'React GraphiQL candidate',
						);
						return {
							kind: 'react-graphiql-013-candidate',
							nextKilledByGoogleIntegrated: true,
							angularRealworldWitnessIntegrated: true,
							reactBoilerplateWitnessIntegrated: true,
							nextKilledByGoogleWitnessIntegrated: true,
							verticals: 12,
							sourceApplications: 5,
							receipts: 15,
							resolvedDependencies: 28,
						};
					}
					if (byPath.size !== canonicalReceipts.length + 5)
						throw new Error(
							'Witness Next KilledByGoogle aggregate membership mismatch',
						);
					assertOrderedAggregate(orderedPaths, candidateOrder, 'Next candidate');
					return {
						kind: 'next-candidate',
						nextKilledByGoogleIntegrated: true,
						angularRealworldWitnessIntegrated: true,
						reactBoilerplateWitnessIntegrated: true,
						nextKilledByGoogleWitnessIntegrated: true,
						verticals: 11,
						sourceApplications: 4,
						receipts: 14,
						resolvedDependencies: 27,
					};
				}
				if (
					byPath.size !== canonicalReceipts.length + 4 ||
					orderedPaths.at(-1) !== WITNESS_REACT_BOILERPLATE_RECEIPT_PATH ||
					!orderedPaths.includes(REACT_BOILERPLATE_CANONICAL_RECEIPT_PATH)
				)
					throw new Error('Witness React Boilerplate aggregate membership mismatch');
				assertOrderedAggregate(
					orderedPaths,
					[
						...orderedPrepublicationReceipts.slice(0, 8),
						WITNESS_ANGULAR_REALWORLD_RECEIPT_PATH,
						NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH,
						...orderedPrepublicationReceipts.slice(8),
						WITNESS_REACT_BOILERPLATE_RECEIPT_PATH,
					],
					'React candidate',
				);
				return {
					kind: 'react-candidate',
					nextKilledByGoogleIntegrated: true,
					angularRealworldWitnessIntegrated: true,
					reactBoilerplateWitnessIntegrated: true,
					verticals: 11,
					sourceApplications: 4,
					receipts: 13,
					resolvedDependencies: 26,
					nextKilledByGoogleWitnessIntegrated: false,
				};
			}
			if (byPath.size !== canonicalReceipts.length + 3)
				throw new Error(
					'Production-readiness aggregate must contain exactly twelve receipts',
				);
			assertOrderedAggregate(
				orderedPaths,
				[
					...orderedPrepublicationReceipts.slice(0, 8),
					WITNESS_ANGULAR_REALWORLD_RECEIPT_PATH,
					NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH,
					...orderedPrepublicationReceipts.slice(8),
				],
				'Production-readiness',
			);
			return {
				kind: 'production-readiness',
				nextKilledByGoogleIntegrated: true,
				angularRealworldWitnessIntegrated: true,
				verticals: 11,
				sourceApplications: 4,
				receipts: 12,
				resolvedDependencies: 25,
				reactBoilerplateWitnessIntegrated: false,
				nextKilledByGoogleWitnessIntegrated: false,
			};
		}
		if (byPath.size !== canonicalReceipts.length + 2)
			throw new Error(
				'Postintegration aggregate must contain exactly eleven canonical receipts',
			);
		assertOrderedAggregate(
			orderedPaths,
			[
				...orderedPrepublicationReceipts.slice(0, 8),
				NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH,
				...orderedPrepublicationReceipts.slice(8),
			],
			'Postintegration',
		);
		return {
			kind: 'postintegration',
			nextKilledByGoogleIntegrated: true,
			angularRealworldWitnessIntegrated: false,
			reactBoilerplateWitnessIntegrated: false,
			nextKilledByGoogleWitnessIntegrated: false,
			verticals: 11,
			sourceApplications: 4,
			receipts: 11,
			resolvedDependencies: 24,
		};
	}
	if (byPath.size !== canonicalReceipts.length + 1)
		throw new Error('Prepublication aggregate must contain exactly ten canonical receipts');
	assertOrderedAggregate(orderedPaths, orderedPrepublicationReceipts, 'Prepublication');
	return {
		kind: 'prepublication',
		nextKilledByGoogleIntegrated: false,
		angularRealworldWitnessIntegrated: false,
		reactBoilerplateWitnessIntegrated: false,
		nextKilledByGoogleWitnessIntegrated: false,
		verticals: 10,
		sourceApplications: 3,
		receipts: 10,
		resolvedDependencies: 23,
	};
}

/**
 * Derives the Papercups conformance rows.
 *
 * Every emitted field comes from either the canonical aggregate members or the
 * verified browser-proof receipt and its sealed build receipt; nothing here is
 * an authored constant, so the emitted vertical and source application cannot
 * drift away from the evidence they claim to summarize.
 */
async function reactPapercupsConformanceRows(
	root: string,
	aggregateByPath: Map<string, unknown>,
): Promise<{ vertical: Record<string, unknown>; application: Record<string, unknown> }> {
	const verified = await verifyWitnessReactPapercupsEvidence(root);
	const witnessMember = record(
		aggregateByPath.get(WITNESS_REACT_PAPERCUPS_RECEIPT_PATH),
		'React Papercups Witness aggregate fixture',
	);
	if (witnessMember.digest !== verified.digest)
		throw new Error('React Papercups Witness aggregate digest differs');
	const migrationMember = record(
		aggregateByPath.get(REACT_PAPERCUPS_RECEIPT_PATH),
		'React Papercups migration aggregate fixture',
	);
	const receipt = verified.receipt;
	if (migrationMember.digest !== receipt.canonicalReceipt.canonicalDigest)
		throw new Error('React Papercups migration aggregate digest differs');
	const run = receipt.runs[0];
	if (!run) throw new Error('React Papercups Witness receipt carries no runs');
	const id = string(migrationMember.id, 'React Papercups migration aggregate id');
	const application = string(run.app, 'React Papercups application identity');
	const behaviorDigest = string(run.behaviorDigest, 'React Papercups behavior digest');
	const source = {
		repository: normalizeURL(receipt.source.repository),
		ref: receipt.source.ref,
		revision: receipt.source.revision,
		archiveSha256: receipt.source.archiveSha256,
		frontendRoot: receipt.source.frontendRoot,
		license: receipt.source.license,
		licenseSha256: receipt.source.licenseSha256,
	};
	const locality = {
		mode: receipt.locality.mode,
		scope: 'process-scoped',
		osWideIsolation: receipt.locality.osWideIsolation,
		successfulNonLoopback: receipt.locality.successfulNonLoopback,
	};
	return {
		vertical: {
			id,
			application,
			framework: string(migrationMember.framework, 'React Papercups aggregate framework'),
			receiptPath: WITNESS_REACT_PAPERCUPS_RECEIPT_PATH,
			receiptDigest: verified.digest,
			canonicalReceipt: {
				path: receipt.canonicalReceipt.path,
				canonicalDigest: receipt.canonicalReceipt.canonicalDigest,
				sha256: receipt.canonicalReceipt.sha256,
			},
			runtime: string(migrationMember.runtime, 'React Papercups aggregate runtime'),
			bundler: string(migrationMember.bundler, 'React Papercups aggregate bundler'),
			track: string(witnessMember.track, 'React Papercups Witness aggregate track'),
			migrationTrack: string(migrationMember.track, 'React Papercups migration track'),
			locality,
			browserProof: 'verified-direct-witness',
			browserRuns: receipt.runs.length,
			behaviorDigest,
			serviceWorker: receipt.zeroServiceWorker.registration,
			scrollSurface: receipt.scrollSurface.state,
			productionReadiness: 'verified-direct-witness',
			readinessScoreboard: receipt.readiness,
			designatedPilot: false,
		},
		application: {
			id: application,
			source,
			verticals: [id],
			conformance: {
				browserProof: 'direct-witness-verified',
				runs: receipt.runs.length,
				behaviorDigest,
				mutation: receipt.mutation.restoredRun,
				mutationRestoration: receipt.mutation.restoredByteIdentically
					? 'byte-identical'
					: 'not-byte-identical',
				zeroServiceWorker: receipt.zeroServiceWorker.registration,
				readinessScoreboard: receipt.readiness,
			},
			boundaries: {
				track: string(witnessMember.track, 'React Papercups Witness aggregate track'),
				designatedPilot: false,
				genericReactSupport: 'not-claimed',
				scrollSurface: receipt.scrollSurface.state,
				locality: 'process-scoped-not-os-wide',
			},
		},
	};
}

/**
 * Derives the HospitalRun conformance rows.
 *
 * Every emitted field comes from either the canonical aggregate members or the
 * verified browser-proof receipt and its sealed build-and-boot receipt, so the
 * emitted vertical and source application cannot drift away from the evidence
 * they summarize. The recorded service-worker migration difference is carried
 * through rather than flattened: this lane's baseline and migrated builds fail
 * the application's own registration differently, and that difference is a
 * published fact of the vertical.
 */
async function reactHospitalrunConformanceRows(
	root: string,
	aggregateByPath: Map<string, unknown>,
): Promise<{ vertical: Record<string, unknown>; application: Record<string, unknown> }> {
	const verified = await verifyWitnessReactHospitalrunEvidence(root);
	const witnessMember = record(
		aggregateByPath.get(WITNESS_REACT_HOSPITALRUN_RECEIPT_PATH),
		'React HospitalRun Witness aggregate fixture',
	);
	if (witnessMember.digest !== verified.digest)
		throw new Error('React HospitalRun Witness aggregate digest differs');
	const migrationMember = record(
		aggregateByPath.get(REACT_HOSPITALRUN_RECEIPT_PATH),
		'React HospitalRun migration aggregate fixture',
	);
	const receipt = verified.receipt;
	if (migrationMember.digest !== receipt.canonicalReceipt.canonicalDigest)
		throw new Error('React HospitalRun migration aggregate digest differs');
	const run = receipt.runs[0];
	if (!run) throw new Error('React HospitalRun Witness receipt carries no runs');
	const id = string(migrationMember.id, 'React HospitalRun migration aggregate id');
	const application = string(run.app, 'React HospitalRun application identity');
	const behaviorDigest = string(run.behaviorDigest, 'React HospitalRun behavior digest');
	const source = {
		repository: normalizeURL(receipt.source.repository),
		ref: receipt.source.ref,
		revision: receipt.source.revision,
		archiveSha256: receipt.source.archiveSha256,
		frontendRoot: receipt.source.frontendRoot,
		license: receipt.source.license,
		licenseSha256: receipt.source.licenseSha256,
	};
	const locality = {
		mode: receipt.locality.mode,
		scope: 'process-scoped',
		osWideIsolation: receipt.locality.osWideIsolation,
		successfulNonLoopback: receipt.locality.successfulNonLoopback,
	};
	return {
		vertical: {
			id,
			application,
			framework: string(migrationMember.framework, 'React HospitalRun aggregate framework'),
			receiptPath: WITNESS_REACT_HOSPITALRUN_RECEIPT_PATH,
			receiptDigest: verified.digest,
			canonicalReceipt: {
				path: receipt.canonicalReceipt.path,
				canonicalDigest: receipt.canonicalReceipt.canonicalDigest,
				sha256: receipt.canonicalReceipt.sha256,
			},
			runtime: string(migrationMember.runtime, 'React HospitalRun aggregate runtime'),
			bundler: string(migrationMember.bundler, 'React HospitalRun aggregate bundler'),
			track: string(witnessMember.track, 'React HospitalRun Witness aggregate track'),
			migrationTrack: string(migrationMember.track, 'React HospitalRun migration track'),
			locality,
			browserProof: 'verified-direct-witness',
			browserRuns: receipt.runs.length,
			behaviorDigest,
			serviceWorker: receipt.blockedServiceWorker.registration,
			serviceWorkerDifference: receipt.serviceWorkerDifference.state,
			serviceWorkerDifferenceMasked: receipt.serviceWorkerDifference.masked,
			scrollSurface: receipt.scrollSurface.state,
			productionReadiness: 'verified-direct-witness',
			readinessScoreboard: receipt.readiness,
			designatedPilot: false,
		},
		application: {
			id: application,
			source,
			verticals: [id],
			conformance: {
				browserProof: 'direct-witness-verified',
				runs: receipt.runs.length,
				behaviorDigest,
				mutation: receipt.mutation.restoredRun,
				mutationRestoration: receipt.mutation.restoredByteIdentically
					? 'byte-identical'
					: 'not-byte-identical',
				serviceWorker: receipt.blockedServiceWorker.registration,
				serviceWorkerDifference: receipt.serviceWorkerDifference.state,
				serviceWorkerDifferenceMasked: receipt.serviceWorkerDifference.masked,
				persistence: receipt.persistence,
				readinessScoreboard: receipt.readiness,
			},
			boundaries: {
				track: string(witnessMember.track, 'React HospitalRun Witness aggregate track'),
				designatedPilot: false,
				genericReactSupport: 'not-claimed',
				scrollSurface: receipt.scrollSurface.state,
				locality: 'process-scoped-not-os-wide',
			},
		},
	};
}

/**
 * Derives the factoriolab conformance rows.
 *
 * This is the first Angular-lineage browser proof in the corpus, and the shape
 * difference is carried through rather than smoothed over. There is no retained
 * migration member to read metadata from: the three build-lane receipts are
 * sealed inside the Witness receipt by canonical digest and exact bytes, so the
 * emitted `canonicalReceipts` list is that sealed binding and the lane
 * identity comes from the single Witness aggregate member. Everything else is
 * read out of the verified receipt, so the emitted vertical and source
 * application cannot drift away from the evidence they summarize. The measured
 * scroll absence and the never-registered service worker are published as the
 * receipt measured them, not as a claim the harness arranged.
 */
async function angularFactoriolabConformanceRows(
	root: string,
	aggregateByPath: Map<string, unknown>,
): Promise<{ vertical: Record<string, unknown>; application: Record<string, unknown> }> {
	const verified = await verifyWitnessAngularFactoriolabEvidence(root);
	const witnessMember = record(
		aggregateByPath.get(WITNESS_ANGULAR_FACTORIOLAB_RECEIPT_PATH),
		'Angular factoriolab Witness aggregate fixture',
	);
	if (witnessMember.digest !== verified.digest)
		throw new Error('Angular factoriolab Witness aggregate digest differs');
	const receipt = verified.receipt;
	const run = receipt.runs[0];
	if (!run) throw new Error('Angular factoriolab Witness receipt carries no runs');
	const id = string(receipt.fixture, 'Angular factoriolab receipt fixture');
	const application = string(run.app, 'Angular factoriolab application identity');
	const behaviorDigest = string(run.behaviorDigest, 'Angular factoriolab behavior digest');
	const track = string(witnessMember.track, 'Angular factoriolab Witness aggregate track');
	const source = {
		repository: normalizeURL(receipt.source.repository),
		ref: receipt.source.ref,
		revision: receipt.source.revision,
		rootTreeSha: receipt.source.rootTreeSha,
		archiveSha256: receipt.source.archiveSha256,
		archiveBytes: receipt.source.archiveBytes,
		license: receipt.source.license,
		licenseSha256: receipt.source.licenseSha256,
	};
	const locality = {
		mode: receipt.locality.mode,
		scope: 'process-scoped',
		osWideIsolation: receipt.locality.osWideIsolation,
		successfulNonLoopback: receipt.locality.successfulNonLoopback,
	};
	return {
		vertical: {
			id,
			application,
			framework: string(witnessMember.framework, 'Angular factoriolab aggregate framework'),
			receiptPath: WITNESS_ANGULAR_FACTORIOLAB_RECEIPT_PATH,
			receiptDigest: verified.digest,
			canonicalReceipts: receipt.canonicalReceipts.map((bound) => ({
				path: bound.path,
				schemaVersion: bound.schemaVersion,
				digest: bound.digest,
				sha256: bound.sha256,
			})),
			runtime: string(witnessMember.runtime, 'Angular factoriolab aggregate runtime'),
			bundler: string(witnessMember.bundler, 'Angular factoriolab aggregate bundler'),
			track,
			locality,
			browserProof: 'verified-direct-witness',
			browserRuns: receipt.runs.length,
			behaviorDigest,
			serviceWorker: receipt.serviceWorker.state,
			serviceWorkerMasked: receipt.serviceWorker.masked,
			scrollSurface: receipt.scrollAbsence.state,
			productionReadiness: 'verified-direct-witness',
			readinessScoreboard: receipt.readiness,
			designatedPilot: false,
		},
		application: {
			id: application,
			source,
			verticals: [id],
			conformance: {
				browserProof: 'direct-witness-verified',
				runs: receipt.runs.length,
				behaviorDigest,
				mutation: receipt.mutation.restoredRun,
				mutationRestoration: receipt.mutation.restoredByteIdentically
					? 'byte-identical'
					: 'not-byte-identical',
				serviceWorker: receipt.serviceWorker.state,
				serviceWorkerMasked: receipt.serviceWorker.masked,
				persistence: receipt.persistence,
				readinessScoreboard: receipt.readiness,
			},
			boundaries: {
				track,
				designatedPilot: false,
				genericAngularSupport: 'not-claimed',
				scrollSurface: receipt.scrollAbsence.state,
				locality: 'process-scoped-not-os-wide',
			},
		},
	};
}

/**
 * Derives the jira-clone conformance rows.
 *
 * This is the second Angular-lineage browser proof in the corpus and follows
 * the factoriolab idiom exactly: there is no retained migration member to read
 * metadata from, because the four build-lane receipts are sealed inside the
 * Witness receipt by canonical digest and exact bytes, so the emitted
 * `canonicalReceipts` list is that sealed binding and the lane identity comes
 * from the single Witness aggregate member. Everything else is read out of the
 * verified receipt.
 *
 * Two measured differences from factoriolab are carried through rather than
 * smoothed over. The locality row publishes the number of mocked non-loopback
 * seams the run declared alongside the zero successful non-loopback requests,
 * because a proof that mocked ten off-origin seams and a proof that mocked none
 * are different observations and the row must not hide the difference. The
 * persistence block is emitted exactly as the receipt measured it, which for
 * this application is an in-memory board that writes no browser storage and
 * does not survive an online reload.
 */
async function angularJiraCloneConformanceRows(
	root: string,
	aggregateByPath: Map<string, unknown>,
): Promise<{ vertical: Record<string, unknown>; application: Record<string, unknown> }> {
	const verified = await verifyWitnessAngularJiraCloneEvidence(root);
	const witnessMember = record(
		aggregateByPath.get(WITNESS_ANGULAR_JIRA_CLONE_RECEIPT_PATH),
		'Angular jira-clone Witness aggregate fixture',
	);
	if (witnessMember.digest !== verified.digest)
		throw new Error('Angular jira-clone Witness aggregate digest differs');
	const receipt = verified.receipt;
	const run = receipt.runs[0];
	if (!run) throw new Error('Angular jira-clone Witness receipt carries no runs');
	const id = string(receipt.fixture, 'Angular jira-clone receipt fixture');
	const application = string(run.app, 'Angular jira-clone application identity');
	const behaviorDigest = string(run.behaviorDigest, 'Angular jira-clone behavior digest');
	const track = string(witnessMember.track, 'Angular jira-clone Witness aggregate track');
	const source = {
		repository: normalizeURL(receipt.source.repository),
		ref: receipt.source.ref,
		revision: receipt.source.revision,
		rootTreeSha: receipt.source.rootTreeSha,
		archiveSha256: receipt.source.archiveSha256,
		archiveBytes: receipt.source.archiveBytes,
		license: receipt.source.license,
		licenseSha256: receipt.source.licenseSha256,
	};
	const locality = {
		mode: receipt.locality.mode,
		scope: 'process-scoped',
		osWideIsolation: receipt.locality.osWideIsolation,
		successfulNonLoopback: receipt.locality.successfulNonLoopback,
		mockedNonLoopbackSeams: receipt.locality.mockedNonLoopbackSeams,
	};
	return {
		vertical: {
			id,
			application,
			framework: string(witnessMember.framework, 'Angular jira-clone aggregate framework'),
			receiptPath: WITNESS_ANGULAR_JIRA_CLONE_RECEIPT_PATH,
			receiptDigest: verified.digest,
			canonicalReceipts: receipt.canonicalReceipts.map((bound) => ({
				path: bound.path,
				schemaVersion: bound.schemaVersion,
				digest: bound.digest,
				sha256: bound.sha256,
			})),
			runtime: string(witnessMember.runtime, 'Angular jira-clone aggregate runtime'),
			bundler: string(witnessMember.bundler, 'Angular jira-clone aggregate bundler'),
			track,
			locality,
			browserProof: 'verified-direct-witness',
			browserRuns: receipt.runs.length,
			behaviorDigest,
			serviceWorker: receipt.serviceWorker.state,
			serviceWorkerMasked: receipt.serviceWorker.masked,
			scrollSurface: receipt.scrollAbsence.state,
			productionReadiness: 'verified-direct-witness',
			readinessScoreboard: receipt.readiness,
			designatedPilot: false,
		},
		application: {
			id: application,
			source,
			verticals: [id],
			conformance: {
				browserProof: 'direct-witness-verified',
				runs: receipt.runs.length,
				behaviorDigest,
				mutation: receipt.mutation.restoredRun,
				mutationRestoration: receipt.mutation.restoredByteIdentically
					? 'byte-identical'
					: 'not-byte-identical',
				serviceWorker: receipt.serviceWorker.state,
				serviceWorkerMasked: receipt.serviceWorker.masked,
				persistence: receipt.persistence,
				readinessScoreboard: receipt.readiness,
			},
			boundaries: {
				track,
				designatedPilot: false,
				genericAngularSupport: 'not-claimed',
				scrollSurface: receipt.scrollAbsence.state,
				locality: 'process-scoped-not-os-wide',
			},
		},
	};
}

/**
 * Derives the memos conformance rows.
 *
 * This is the first React-lineage vertical whose origin bundler is Vite rather
 * than webpack, and the row says so through the receipt's own measured
 * migration class rather than through a label invented here. Three further
 * shape differences are carried rather than smoothed: the sealed build-lane
 * receipt is bound by the sha256 of its exact bytes, so the emitted binding
 * publishes that reason instead of a canonical digest the lane receipt does not
 * carry; the application never registers a service worker and the receipt
 * measures none, so no service-worker field is emitted rather than a
 * manufactured "none"; and the proof talked to a frozen synthetic projection,
 * which the row publishes by label, digest and seed so the reader knows what
 * the journeys were answered by.
 */
async function reactMemosConformanceRows(
	root: string,
	aggregateByPath: Map<string, unknown>,
): Promise<{ vertical: Record<string, unknown>; application: Record<string, unknown> }> {
	const verified = await verifyWitnessReactMemosEvidence(root);
	const witnessMember = record(
		aggregateByPath.get(WITNESS_REACT_MEMOS_RECEIPT_PATH),
		'React memos Witness aggregate fixture',
	);
	if (witnessMember.digest !== verified.digest)
		throw new Error('React memos Witness aggregate digest differs');
	const receipt = verified.receipt;
	const run = receipt.runs[0];
	if (!run) throw new Error('React memos Witness receipt carries no runs');
	const id = string(receipt.fixture, 'React memos receipt fixture');
	const application = string(run.app, 'React memos application identity');
	const behaviorDigest = string(run.behaviorDigest, 'React memos behavior digest');
	const track = string(witnessMember.track, 'React memos Witness aggregate track');
	const source = {
		repository: normalizeURL(receipt.source.repository),
		ref: receipt.source.ref,
		tagKind: receipt.source.tagKind,
		tagVerification: receipt.source.tagVerification,
		revision: receipt.source.revision,
		archiveSha256: receipt.source.archiveSha256,
		frontendRoot: receipt.source.frontendRoot,
		monorepo: receipt.source.monorepo,
		license: receipt.source.license,
		licenseNote: receipt.source.licenseNote,
	};
	const locality = {
		mode: receipt.locality.mode,
		scope: 'process-scoped',
		osWideIsolation: receipt.locality.osWideIsolation,
		successfulNonLoopback: receipt.locality.successfulNonLoopback,
	};
	const projection = {
		label: receipt.projection.label,
		behaviorDigest: receipt.projection.behaviorDigest,
		seedSha256: receipt.projection.seedSha256,
		pinnedRevision: receipt.projection.pinnedRevision,
	};
	return {
		vertical: {
			id,
			application,
			framework: string(witnessMember.framework, 'React memos aggregate framework'),
			receiptPath: WITNESS_REACT_MEMOS_RECEIPT_PATH,
			receiptDigest: verified.digest,
			canonicalReceipt: {
				path: receipt.canonicalReceipt.path,
				sha256: receipt.canonicalReceipt.sha256,
				binding: receipt.canonicalReceipt.binding,
				bindingReason: receipt.canonicalReceipt.bindingReason,
			},
			runtime: string(witnessMember.runtime, 'React memos aggregate runtime'),
			bundler: string(witnessMember.bundler, 'React memos aggregate bundler'),
			track,
			migrationClass: receipt.migrationClass.migrationClass,
			projection,
			locality,
			browserProof: 'verified-direct-witness',
			browserRuns: receipt.runs.length,
			behaviorDigest,
			scrollSurface: receipt.scrollAbsence.state,
			productionReadiness: 'verified-direct-witness',
			readinessScoreboard: receipt.readiness,
			designatedPilot: false,
		},
		application: {
			id: application,
			source,
			verticals: [id],
			conformance: {
				browserProof: 'direct-witness-verified',
				runs: receipt.runs.length,
				behaviorDigest,
				mutation: receipt.mutation.restoredRun,
				mutationRestoration: receipt.mutation.restoredByteIdentically
					? 'byte-identical'
					: 'not-byte-identical',
				migrationClass: receipt.migrationClass.migrationClass,
				eraBuildDeviation: receipt.eraBuildDeviation.declaredBuildCommandOutcomeAtThisRevision,
				projection,
				readinessScoreboard: receipt.readiness,
			},
			boundaries: {
				track,
				designatedPilot: false,
				genericReactSupport: 'not-claimed',
				scrollSurface: receipt.scrollAbsence.state,
				locality: 'process-scoped-not-os-wide',
			},
		},
	};
}

/**
 * Derives the killedbygoogle v3.0.0 conformance rows.
 *
 * This lane is a new vertical on a source application the corpus already
 * carries, and the difference matters enough to be enforced rather than
 * assumed. The published `killedbygoogle` application row pins a repository, a
 * revision and an archive digest; this proof pins the same three. Counting it
 * as an eleventh source application would count one immutable source twice and
 * inflate the only number in the summary that is supposed to mean "distinct
 * real applications", so the function returns no application row at all: it
 * returns the vertical plus the browser-proof block that joins the existing
 * application, and refuses outright if the two sources ever diverge.
 *
 * The two document-delivery shapes are a genuine measured difference between
 * the lanes rather than a defect, so the row publishes the receipt's own
 * recorded difference instead of claiming byte parity, and the locality row
 * publishes the mocked non-loopback seam count beside the zero successful
 * non-loopback requests exactly as the jira-clone row does.
 */
async function nextKilledbygoogleV3ConformanceRows(
	root: string,
	aggregateByPath: Map<string, unknown>,
	publishedSource: { repository: string; revision: string; archiveSha256: string; license: string },
): Promise<{ vertical: Record<string, unknown>; browserProof: Record<string, unknown> }> {
	const verified = await verifyWitnessNextKilledbygoogleV3Evidence(root);
	const witnessMember = record(
		aggregateByPath.get(WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECEIPT_PATH),
		'KilledByGoogle v3 Witness aggregate fixture',
	);
	if (witnessMember.digest !== verified.digest)
		throw new Error('KilledByGoogle v3 Witness aggregate digest differs');
	const receipt = verified.receipt;
	if (
		normalizeURL(receipt.source.repository) !== publishedSource.repository ||
		receipt.source.revision !== publishedSource.revision ||
		receipt.source.archiveSha256 !== publishedSource.archiveSha256 ||
		receipt.source.license !== publishedSource.license
	)
		throw new Error(
			'KilledByGoogle v3 browser proof does not pin the published killedbygoogle source',
		);
	const run = receipt.runs[0];
	if (!run) throw new Error('KilledByGoogle v3 Witness receipt carries no runs');
	const id = string(receipt.fixture, 'KilledByGoogle v3 receipt fixture');
	const behaviorDigest = string(run.behaviorDigest, 'KilledByGoogle v3 behavior digest');
	const track = string(witnessMember.track, 'KilledByGoogle v3 Witness aggregate track');
	const locality = {
		mode: receipt.locality.mode,
		scope: 'process-scoped',
		osWideIsolation: receipt.locality.osWideIsolation,
		successfulNonLoopback: receipt.locality.successfulNonLoopback,
		mockedNonLoopbackSeams: receipt.locality.mockedNonLoopbackSeams,
	};
	const documentDelivery = {
		baseline: receipt.documentDelivery.baseline,
		migrated: receipt.documentDelivery.migrated,
		parityOracle: receipt.documentDelivery.parityOracle,
		byteParity: receipt.documentDelivery.byteParity,
	};
	return {
		vertical: {
			id,
			application: 'killedbygoogle',
			framework: string(witnessMember.framework, 'KilledByGoogle v3 aggregate framework'),
			receiptPath: WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECEIPT_PATH,
			receiptDigest: verified.digest,
			canonicalReceipt: {
				path: receipt.canonicalReceipt.path,
				schemaVersion: receipt.canonicalReceipt.schemaVersion,
				sha256: receipt.canonicalReceipt.sha256,
				eraLaneDigest: receipt.canonicalReceipt.eraLaneDigest,
				targetLaneDigest: receipt.canonicalReceipt.targetLaneDigest,
			},
			runtime: string(witnessMember.runtime, 'KilledByGoogle v3 aggregate runtime'),
			bundler: string(witnessMember.bundler, 'KilledByGoogle v3 aggregate bundler'),
			track,
			locality,
			browserProof: 'verified-direct-witness',
			browserRuns: receipt.runs.length,
			behaviorDigest,
			serviceWorker: receipt.serviceWorker.state,
			serviceWorkerMasked: receipt.serviceWorker.masked,
			documentDelivery,
			scrollSurface: receipt.scrollSurface.state,
			productionReadiness: 'verified-direct-witness',
			readinessScoreboard: receipt.readiness,
			designatedPilot: false,
		},
		browserProof: {
			vertical: id,
			track,
			browserProof: 'direct-witness-verified',
			runs: receipt.runs.length,
			behaviorDigest,
			mutation: receipt.mutation.restoredRun,
			mutationRestoration: receipt.mutation.restoredByteIdentically
				? 'byte-identical'
				: 'not-byte-identical',
			serviceWorker: receipt.serviceWorker.state,
			serviceWorkerMasked: receipt.serviceWorker.masked,
			documentDelivery,
			persistence: receipt.persistence,
			scrollSurface: receipt.scrollSurface.state,
			readinessScoreboard: receipt.readiness,
		},
	};
}

/**
 * Derives the LinkFree conformance rows.
 *
 * This is the third create-react-app source application in the corpus and the
 * first whose proof was run over a staged synthetic corpus. That is the fact
 * most easily lost in a summary, so it is the one the rows carry most
 * explicitly: the receipt's own corpus ruling — what was replaced, what it
 * proves, and what it does not — is published on both the vertical and the
 * source application rather than being left inside the receipt.
 */
async function reactLinkfreeConformanceRows(
	root: string,
	aggregateByPath: Map<string, unknown>,
): Promise<{ vertical: Record<string, unknown>; application: Record<string, unknown> }> {
	const verified = await verifyWitnessReactLinkfreeEvidence(root);
	const witnessMember = record(
		aggregateByPath.get(WITNESS_REACT_LINKFREE_RECEIPT_PATH),
		'React LinkFree Witness aggregate fixture',
	);
	if (witnessMember.digest !== verified.digest)
		throw new Error('React LinkFree Witness aggregate digest differs');
	const receipt = verified.receipt;
	const run = receipt.runs[0];
	if (!run) throw new Error('React LinkFree Witness receipt carries no runs');
	const id = string(receipt.fixture, 'React LinkFree receipt fixture');
	const application = string(run.app, 'React LinkFree application identity');
	const behaviorDigest = string(run.behaviorDigest, 'React LinkFree behavior digest');
	const track = string(witnessMember.track, 'React LinkFree Witness aggregate track');
	const source = {
		repository: normalizeURL(receipt.source.repository),
		repositoryAtPinnedRevision: normalizeURL(receipt.source.repositoryAtPinnedRevision),
		nearestTag: receipt.source.nearestTag,
		pinnedRevisionIsTagTarget: receipt.source.pinnedRevisionIsTagTarget,
		revision: receipt.source.revision,
		archiveSha256: receipt.source.archiveSha256,
		frontendRoot: receipt.source.frontendRoot,
		license: receipt.source.license,
		licenseSha256: receipt.source.licenseSha256,
	};
	const locality = {
		mode: receipt.locality.mode,
		scope: 'process-scoped',
		osWideIsolation: receipt.locality.osWideIsolation,
		successfulNonLoopback: receipt.locality.successfulNonLoopback,
	};
	const corpusRuling = {
		ruling: receipt.corpusRuling.ruling,
		dataset: receipt.corpusRuling.dataset,
		seam: receipt.corpusRuling.seam,
		sameCorpusInBothLanes: receipt.corpusRuling.sameCorpusInBothLanes,
		applicationSourceEdits: receipt.corpusRuling.applicationSourceEdits,
		realProfileDataRendered: receipt.corpusRuling.realProfileDataRendered,
		proves: receipt.corpusRuling.proves,
	};
	return {
		vertical: {
			id,
			application,
			framework: string(witnessMember.framework, 'React LinkFree aggregate framework'),
			receiptPath: WITNESS_REACT_LINKFREE_RECEIPT_PATH,
			receiptDigest: verified.digest,
			canonicalReceipt: {
				path: receipt.canonicalReceipt.path,
				canonicalDigest: receipt.canonicalReceipt.canonicalDigest,
				sha256: receipt.canonicalReceipt.sha256,
			},
			runtime: string(witnessMember.runtime, 'React LinkFree aggregate runtime'),
			bundler: string(witnessMember.bundler, 'React LinkFree aggregate bundler'),
			track,
			corpusRuling,
			locality,
			browserProof: 'verified-direct-witness',
			browserRuns: receipt.runs.length,
			behaviorDigest,
			scrollSurface: receipt.scrollSurface.state,
			productionReadiness: 'verified-direct-witness',
			readinessScoreboard: receipt.readiness,
			designatedPilot: false,
		},
		application: {
			id: application,
			source,
			verticals: [id],
			conformance: {
				browserProof: 'direct-witness-verified',
				runs: receipt.runs.length,
				behaviorDigest,
				mutation: receipt.mutation.restoredRun,
				mutationRestoration: receipt.mutation.restoredByteIdentically
					? 'byte-identical'
					: 'not-byte-identical',
				corpusRuling,
				stagedCorpus: receipt.stagedCorpus,
				readinessScoreboard: receipt.readiness,
			},
			boundaries: {
				track,
				designatedPilot: false,
				genericReactSupport: 'not-claimed',
				scrollSurface: receipt.scrollSurface.state,
				locality: 'process-scoped-not-os-wide',
			},
		},
	};
}

/**
 * Derives the TinyTranslator conformance rows.
 *
 * This is the third Angular-lineage browser proof in the corpus and follows the
 * factoriolab/jira-clone idiom exactly: there is no retained migration member to
 * read metadata from, because the two build-lane receipts are sealed inside the
 * Witness receipt by canonical digest and exact bytes, so the emitted
 * `canonicalReceipts` list is that sealed binding and the lane identity comes
 * from the single Witness aggregate member. Everything else is read out of the
 * verified receipt.
 *
 * The service-worker fact is the one most easily lost in a summary, so the rows
 * carry it as the receipt measured it: a registration the era application always
 * attempted and that the migration neither introduced nor repaired, answered 400
 * and registering nothing, published as `serviceWorkerAttempt` rather than a
 * masked absence. The persistence block is emitted exactly as measured — a
 * browser-local-storage store with no backend that survives an online reload —
 * and the locality row publishes the mocked non-loopback seam count beside the
 * zero successful non-loopback requests.
 */
async function angularTinyTranslatorConformanceRows(
	root: string,
	aggregateByPath: Map<string, unknown>,
): Promise<{ vertical: Record<string, unknown>; application: Record<string, unknown> }> {
	const verified = await verifyWitnessAngularTinyTranslatorEvidence(root);
	const witnessMember = record(
		aggregateByPath.get(WITNESS_ANGULAR_TINY_TRANSLATOR_RECEIPT_PATH),
		'Angular TinyTranslator Witness aggregate fixture',
	);
	if (witnessMember.digest !== verified.digest)
		throw new Error('Angular TinyTranslator Witness aggregate digest differs');
	const receipt = verified.receipt;
	const run = receipt.runs[0];
	if (!run) throw new Error('Angular TinyTranslator Witness receipt carries no runs');
	const id = string(receipt.fixture, 'Angular TinyTranslator receipt fixture');
	const application = string(run.app, 'Angular TinyTranslator application identity');
	const behaviorDigest = string(run.behaviorDigest, 'Angular TinyTranslator behavior digest');
	const track = string(witnessMember.track, 'Angular TinyTranslator Witness aggregate track');
	const source = {
		repository: normalizeURL(receipt.source.repository),
		ref: receipt.source.ref,
		tagKind: receipt.source.tagKind,
		revision: receipt.source.revision,
		rootTreeSha: receipt.source.rootTreeSha,
		archiveSha256: receipt.source.archiveSha256,
		archiveBytes: receipt.source.archiveBytes,
		frontendRoot: receipt.source.frontendRoot,
		license: receipt.source.license,
		licenseSha256: receipt.source.licenseSha256,
	};
	const locality = {
		mode: receipt.locality.mode,
		scope: 'process-scoped',
		osWideIsolation: receipt.locality.osWideIsolation,
		successfulNonLoopback: receipt.locality.successfulNonLoopback,
		mockedNonLoopbackSeams: receipt.locality.mockedNonLoopbackSeams,
	};
	return {
		vertical: {
			id,
			application,
			framework: string(witnessMember.framework, 'Angular TinyTranslator aggregate framework'),
			receiptPath: WITNESS_ANGULAR_TINY_TRANSLATOR_RECEIPT_PATH,
			receiptDigest: verified.digest,
			canonicalReceipts: receipt.canonicalReceipts.map((bound) => ({
				path: bound.path,
				schemaVersion: bound.schemaVersion,
				digest: bound.digest,
				sha256: bound.sha256,
			})),
			runtime: string(witnessMember.runtime, 'Angular TinyTranslator aggregate runtime'),
			bundler: string(witnessMember.bundler, 'Angular TinyTranslator aggregate bundler'),
			track,
			locality,
			browserProof: 'verified-direct-witness',
			browserRuns: receipt.runs.length,
			behaviorDigest,
			serviceWorkerAttempt: receipt.serviceWorkerAttempt.state,
			serviceWorkerAttemptMasked: receipt.serviceWorkerAttempt.masked,
			scrollSurface: receipt.scrollAbsence.state,
			productionReadiness: 'verified-direct-witness',
			readinessScoreboard: receipt.readiness,
			designatedPilot: false,
		},
		application: {
			id: application,
			source,
			verticals: [id],
			conformance: {
				browserProof: 'direct-witness-verified',
				runs: receipt.runs.length,
				behaviorDigest,
				mutation: receipt.mutation.restoredRun,
				mutationRestoration: receipt.mutation.restoredByteIdentically
					? 'byte-identical'
					: 'not-byte-identical',
				serviceWorkerAttempt: receipt.serviceWorkerAttempt.state,
				serviceWorkerAttemptMasked: receipt.serviceWorkerAttempt.masked,
				persistence: receipt.persistence,
				readinessScoreboard: receipt.readiness,
			},
			boundaries: {
				track,
				designatedPilot: false,
				genericAngularSupport: 'not-claimed',
				scrollSurface: receipt.scrollAbsence.state,
				locality: 'process-scoped-not-os-wide',
			},
		},
	};
}

/**
 * Derives the super-productivity conformance rows.
 *
 * This is the fourth Angular-lineage browser proof in the corpus and the last
 * portfolio cell of this matrix; it follows the factoriolab/jira-clone/
 * tiny-translator idiom exactly: there is no retained migration member to read
 * metadata from, because the two build-lane receipts are sealed inside the
 * Witness receipt by canonical digest and exact bytes, so the emitted
 * `canonicalReceipts` list is that sealed binding and the lane identity comes
 * from the single Witness aggregate member. Everything else is read out of the
 * verified receipt.
 *
 * super-productivity's facts differ from tiny-translator's and the rows carry
 * them as the receipt measured them. The service worker is a REAL `ngsw-worker`
 * registration present in both lanes — not a refused attempt — so it is
 * published as `serviceWorker` with the constant's own settled-state string and
 * `masked:false`, not as a `serviceWorkerAttempt`. Persistence is the
 * application's own localforage/IndexedDB store rather than a browser
 * local-storage surface. The lift's declared cross-lane appearance differences
 * — the MDC typography family fallthrough and the dropped Helvetica-Neue family
 * — are emitted as the vertical's `declaredDifferences`, and the per-lane
 * determinism reading is carried beside them, because the unseeded Sass
 * `random()` build instability crossing the supersede boundary is the fact most
 * easily lost in a summary. The scroll surface is emitted as measured: a journey
 * that found no overflowing document because the application pins its own
 * drawer container to the viewport.
 */
async function angularSuperProductivityConformanceRows(
	root: string,
	aggregateByPath: Map<string, unknown>,
): Promise<{ vertical: Record<string, unknown>; application: Record<string, unknown> }> {
	const verified = await verifyWitnessAngularSuperProductivityEvidence(root);
	const witnessMember = record(
		aggregateByPath.get(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_RECEIPT_PATH),
		'Angular Super Productivity Witness aggregate fixture',
	);
	if (witnessMember.digest !== verified.digest)
		throw new Error('Angular Super Productivity Witness aggregate digest differs');
	const receipt = verified.receipt;
	const run = receipt.runs[0];
	if (!run) throw new Error('Angular Super Productivity Witness receipt carries no runs');
	const id = string(receipt.fixture, 'Angular Super Productivity receipt fixture');
	const application = string(run.app, 'Angular Super Productivity application identity');
	const behaviorDigest = string(run.behaviorDigest, 'Angular Super Productivity behavior digest');
	const track = string(witnessMember.track, 'Angular Super Productivity Witness aggregate track');
	const source = {
		repository: normalizeURL(receipt.source.repository),
		ref: receipt.source.ref,
		tagKind: receipt.source.tagKind,
		revision: receipt.source.revision,
		rootTreeSha: receipt.source.rootTreeSha,
		archiveSha256: receipt.source.archiveSha256,
		archiveBytes: receipt.source.archiveBytes,
		frontendRoot: receipt.source.frontendRoot,
		license: receipt.source.license,
		licenseSha256: receipt.source.licenseSha256,
	};
	const locality = {
		mode: receipt.locality.mode,
		scope: 'process-scoped',
		osWideIsolation: receipt.locality.osWideIsolation,
		successfulNonLoopback: receipt.locality.successfulNonLoopback,
		mockedNonLoopbackSeams: receipt.locality.mockedNonLoopbackSeams,
	};
	const determinism = {
		baseline: receipt.determinism.baseline.state,
		migrated: receipt.determinism.migrated.state,
	};
	const declaredDifferences = receipt.renderedStyleParity.declaredDifferences.map((entry) => ({
		label: entry.label,
		why: entry.why,
	}));
	return {
		vertical: {
			id,
			application,
			framework: string(
				witnessMember.framework,
				'Angular Super Productivity aggregate framework',
			),
			receiptPath: WITNESS_ANGULAR_SUPER_PRODUCTIVITY_RECEIPT_PATH,
			receiptDigest: verified.digest,
			canonicalReceipts: receipt.canonicalReceipts.map((bound) => ({
				path: bound.path,
				schemaVersion: bound.schemaVersion,
				digest: bound.digest,
				sha256: bound.sha256,
			})),
			runtime: string(witnessMember.runtime, 'Angular Super Productivity aggregate runtime'),
			bundler: string(witnessMember.bundler, 'Angular Super Productivity aggregate bundler'),
			track,
			locality,
			browserProof: 'verified-direct-witness',
			browserRuns: receipt.runs.length,
			behaviorDigest,
			serviceWorker: receipt.serviceWorker.state,
			serviceWorkerMasked: receipt.serviceWorker.masked,
			scrollSurface: receipt.scroll.state,
			determinism,
			declaredDifferences,
			productionReadiness: 'verified-direct-witness',
			readinessScoreboard: receipt.readiness,
			designatedPilot: false,
		},
		application: {
			id: application,
			source,
			verticals: [id],
			conformance: {
				browserProof: 'direct-witness-verified',
				runs: receipt.runs.length,
				behaviorDigest,
				mutation: receipt.mutation.restoredRun,
				mutationRestoration: receipt.mutation.restoredByteIdentically
					? 'byte-identical'
					: 'not-byte-identical',
				serviceWorker: receipt.serviceWorker.state,
				serviceWorkerMasked: receipt.serviceWorker.masked,
				persistence: receipt.persistence,
				determinism,
				declaredDifferences,
				readinessScoreboard: receipt.readiness,
			},
			boundaries: {
				track,
				designatedPilot: false,
				genericAngularSupport: 'not-claimed',
				scrollSurface: receipt.scroll.state,
				locality: 'process-scoped-not-os-wide',
			},
		},
	};
}

export async function analyzeCorpusConformance(
	options: CorpusConformanceOptions = {},
): Promise<CorpusConformance> {
	const root = path.resolve(options.rootDir ?? '.');
	const aggregate = record(
		await readJson(path.join(root, 'evidence/runs/aggregate.json')),
		'aggregate',
	);
	const transaction = deriveCorpusTransactionState(aggregate.fixtures);
	const aggregateByPath = new Map(
		(aggregate.fixtures as unknown[]).map((value) => {
			const fixture = record(value, 'aggregate fixture');
			return [string(fixture.receipt, 'aggregate receipt path'), value];
		}),
	);
	const nextKilledByGoogleDigest = transaction.nextKilledByGoogleIntegrated
		? string(
				record(
					aggregateByPath.get(NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH),
					'Killed by Google aggregate fixture',
				).digest,
				'Killed by Google aggregate digest',
			)
		: null;

	const inspected = [];
	for (const expected of canonicalReceipts) {
		const aggregateFixture = aggregateByPath.get(expected.path);
		if (!aggregateFixture) throw new Error(`Aggregate is missing receipt: ${expected.path}`);
		assertAggregateFixture(aggregateFixture, expected);
		const file = path.join(root, expected.path);
		const verified = await verifyReceipt(file);
		const aggregateDigest = string(
			record(aggregateFixture, `aggregate fixture ${expected.id}`).digest,
			`aggregate digest ${expected.id}`,
		);
		const expectedDigest = expected.digest ?? aggregateDigest;
		if (
			verified.digest !== expectedDigest ||
			aggregateDigest !== expectedDigest ||
			!sha256Pattern.test(verified.digest)
		)
			throw new Error(`Canonical receipt digest mismatch: ${expected.path}`);
		const receipt = parseMigrationReceipt(await readJson(file));
		if (receipt.fixture !== expected.id)
			throw new Error(`Receipt fixture identity mismatch: ${expected.path}`);
		const journeyRef = journeyArtifact(receipt);
		const journey = await readJson(path.join(root, journeyRef.path));
		if (!Array.isArray(journey) || journey.length === 0)
			throw new Error(`Corpus journey is empty: ${expected.id}`);
		if (
			[
				'react-boilerplate-v4-vite8',
				'react-boilerplate-v4-data-flow',
				'react-boilerplate-v4-composed',
			].includes(expected.id)
		) {
			const receiptWorker = receipt.verification.serviceWorker;
			if (
				!receiptWorker ||
				receiptWorker.cacheName !==
					`versionless-react-vite8-${receiptWorker.manifestSha256}` ||
				receiptWorker.currentCacheOnly !== true ||
				receiptWorker.inventoryMatchesManifest !== true ||
				receiptWorker.exactCurrentCacheFetch !== true
			)
				throw new Error(`Corpus service-worker semantic binding mismatch: ${expected.id}`);
			const buildReference = receipt.artifacts.find((item) =>
				['service-worker.json', 'build.json'].includes(path.basename(item.path)),
			);
			if (!buildReference)
				throw new Error(`Service-worker build artifact missing: ${expected.id}`);
			const buildValue = await readJson(path.join(root, buildReference.path));
			const workerByLane = new Map<string, Record<string, unknown>>();
			if (expected.id === 'react-boilerplate-v4-vite8') {
				const evidence = record(buildValue, `${expected.id} service-worker build`);
				workerByLane.set('target', {
					manifestSha256: record(evidence.manifest, 'manifest').sha256,
					entries: evidence.entries,
				});
			} else {
				if (!Array.isArray(buildValue))
					throw new Error(`Service-worker build rows missing: ${expected.id}`);
				for (const value of buildValue) {
					const build = record(value, `${expected.id} build row`);
					if (build.serviceWorker)
						workerByLane.set(
							string(build.lane, `${expected.id} build lane`),
							record(build.serviceWorker, `${expected.id} build worker`),
						);
				}
			}
			const targetWorker = workerByLane.get('target');
			if (!targetWorker || targetWorker.manifestSha256 !== receiptWorker.manifestSha256)
				throw new Error(`Corpus service-worker receipt/build mismatch: ${expected.id}`);
			for (const value of journey) {
				const row = record(value, `${expected.id} offline journey row`);
				const worker = record(row.serviceWorker, `${expected.id} service worker`);
				const lane =
					expected.id === 'react-boilerplate-v4-vite8'
						? 'target'
						: string(row.lane, `${expected.id} journey lane`);
				const buildWorker = workerByLane.get(lane);
				const entries = buildWorker?.entries;
				const expectedCache = buildWorker
					? `versionless-react-vite8-${String(buildWorker.manifestSha256)}`
					: null;
				if (
					row.offlineReload !== 'pass' ||
					worker.registration !== 'active' ||
					worker.scope !== '/' ||
					worker.controller !== 'activated' ||
					!Array.isArray(worker.cacheNames) ||
					worker.cacheNames.length === 0 ||
					!Array.isArray(worker.inventory) ||
					worker.inventory.length === 0 ||
					(buildWorker &&
						(canonicalize(worker.cacheNames) !== canonicalize([expectedCache]) ||
							!Array.isArray(entries) ||
							canonicalize(worker.inventory) !==
								canonicalize(
									entries.map((entry) =>
										string(record(entry, 'precache entry').url, 'precache URL'),
									),
								)))
				)
					throw new Error(
						`Corpus service-worker offline evidence mismatch: ${expected.id}`,
					);
			}
			if (expected.id === 'react-boilerplate-v4-data-flow') {
				const upgradeReference = receipt.artifacts.find(
					(item) => path.basename(item.path) === 'upgrade.json',
				);
				if (!upgradeReference)
					throw new Error(
						'Service-worker upgrade artifact missing: react-boilerplate-v4-data-flow',
					);
				const upgrades = await readJson(path.join(root, upgradeReference.path));
				if (
					!Array.isArray(upgrades) ||
					canonicalize(upgrades.map((value) => record(value, 'upgrade row').order)) !==
						canonicalize(['base-to-data-flow', 'data-flow-to-base'])
				)
					throw new Error('Service-worker upgrade order evidence mismatch');
				for (const value of upgrades) {
					const upgrade = record(value, 'upgrade row');
					if (!Array.isArray(upgrade.phases) || upgrade.phases.length !== 2)
						throw new Error('Service-worker upgrade phases mismatch');
					const expectedLanes =
						upgrade.order === 'base-to-data-flow'
							? ['legacy', 'target']
							: ['target', 'legacy'];
					if (
						canonicalize(
							upgrade.phases.map((phase) => record(phase, 'upgrade phase').lane),
						) !== canonicalize(expectedLanes) ||
						new Set(
							upgrade.phases.map((phase) => record(phase, 'upgrade phase').origin),
						).size !== 1
					)
						throw new Error('Service-worker upgrade origin/lane evidence mismatch');
					for (const phaseValue of upgrade.phases) {
						const phase = record(phaseValue, 'upgrade phase');
						const laneWorker = workerByLane.get(string(phase.lane, 'upgrade lane'));
						if (
							!laneWorker ||
							canonicalize(phase.cacheNames) !==
								canonicalize([
									`versionless-react-vite8-${String(laneWorker.manifestSha256)}`,
								]) ||
							canonicalize(phase.inventory) !==
								canonicalize(
									(laneWorker.entries as unknown[]).map((entry) =>
										string(record(entry, 'upgrade entry').url, 'upgrade URL'),
									),
								) ||
							phase.scope !== '/' ||
							phase.controller !== 'activated' ||
							phase.offlineReload !== 'pass'
						)
							throw new Error('Service-worker upgrade semantic evidence mismatch');
					}
				}
			}
			const mutationRef = receipt.artifacts.find(
				(item) => path.basename(item.path) === 'mutation.json',
			);
			if (!mutationRef)
				throw new Error(`Service-worker mutation artifact missing: ${expected.id}`);
			const mutation = record(
				await readJson(path.join(root, mutationRef.path)),
				`${expected.id} mutation artifact`,
			);
			const mutationRows = Array.isArray(mutation.mutations)
				? mutation.mutations
				: [mutation];
			const workerMutation = mutationRows
				.map((value) => record(value, `${expected.id} mutation row`))
				.find(
					(value) =>
						value.seam === 'service-worker-registration' ||
						value.mutationKind === 'service-worker-registration-disabled',
				);
			if (
				!workerMutation ||
				(workerMutation.result ?? workerMutation.mutation) !== 'intended-failure' ||
				workerMutation.restoration !== 'byte-identical' ||
				workerMutation.reproduced !== 'pass'
			)
				throw new Error(`Service-worker mutation evidence mismatch: ${expected.id}`);
		}
		let composition: Record<string, unknown> | null = null;
		if (expected.id === 'angular-phonecat-composed') {
			const compositionRef = receipt.artifacts.find(
				(item) => path.basename(item.path) === 'composition.json',
			);
			if (!compositionRef)
				throw new Error('Composed PhoneCat receipt omits composition artifact');
			composition = record(
				await readJson(path.join(root, compositionRef.path)),
				'PhoneCat composition artifact',
			);
			if (
				receipt.migration.transform !==
					'phone-detail-lexical-this+phone-route-resolve-component-binding' ||
				composition.orderIndependent !== true
			)
				throw new Error('Composed PhoneCat order-independence evidence missing');
		}
		if (expected.id === 'angular-phonecat-vite8') {
			const artifactRecord = async (name: string): Promise<Record<string, unknown>> => {
				const reference = receipt.artifacts.find(
					(item) => path.basename(item.path) === name,
				);
				if (!reference) throw new Error(`PhoneCat Vite receipt omits ${name}`);
				return record(
					await readJson(path.join(root, reference.path)),
					`PhoneCat Vite ${name} artifact`,
				);
			};
			const preparation = await artifactRecord('preparation.json');
			const transformOrder = await artifactRecord('transform-order.json');
			const viteBuild = await artifactRecord('vite-build.json');
			const publication = await artifactRecord('publication.json');
			const mutation = await artifactRecord('mutation.json');
			const buildsEqual = viteBuild.equal === true;
			const libraryInput = record(preparation.libraryInput, 'PhoneCat Vite library input');
			const firstBuild = record(viteBuild.first, 'PhoneCat Vite first build');
			const secondBuild = record(viteBuild.second, 'PhoneCat Vite second build');
			const buildEntries = firstBuild.entries;
			const mutations = Array.isArray(mutation.mutations) ? mutation.mutations : [];
			if (
				receipt.migration.transform !==
					'phone-detail-lexical-this+phone-route-resolve-component-binding' ||
				transformOrder.orderIndependent !== true ||
				canonicalize(transformOrder.changedFiles) !==
					canonicalize([
						'app/app.config.js',
						'app/phone-list/phone-list.component.js',
						'app/phone-detail/phone-detail.component.js',
					]) ||
				canonicalize(
					(transformOrder.orders as Array<Record<string, unknown>> | undefined)?.map(
						(value) => ({ order: value.order, trace: value.trace }),
					),
				) !==
					canonicalize([
						{
							order: [
								'phone-detail-lexical-this',
								'phone-route-resolve-component-binding',
							],
							trace: ['phone-detail', 'app-config', 'phone-list'],
						},
						{
							order: [
								'phone-route-resolve-component-binding',
								'phone-detail-lexical-this',
							],
							trace: ['app-config', 'phone-list', 'phone-detail'],
						},
					]) ||
				canonicalize(libraryInput) !==
					canonicalize({
						treeSha256:
							'811fb0f3190dc4f07398c326dfd47b501d677b8c4662621ccaefe472bf0a717b',
						manifestSha256:
							'747a69dbe4fffca6deb1eb12517c7d80e5a829b1a27616d2a04350c015373d2e',
						provenanceSha256:
							'e3f7dcb0034b6092ee5576de1a2a227c067835b39713ce93fb5ac37feff3b878',
						entries: 65,
					}) ||
				!buildsEqual ||
				canonicalize(firstBuild) !== canonicalize(secondBuild) ||
				!Array.isArray(buildEntries) ||
				buildEntries.length !== 187 ||
				viteBuild.serviceWorker !== 'out-of-scope-not-emitted' ||
				publication.method !== 'same-filesystem-staged-directory-rename' ||
				publication.validatedBeforePublish !== true ||
				publication.injectedFailure !== 'refused' ||
				publication.publishedTarget !== 'unchanged' ||
				publication.failedStageCleanup !== true ||
				mutations.length !== 2 ||
				mutations.some((value) => {
					const row = record(value, 'PhoneCat Vite mutation row');
					return (
						row.result !== 'intended-failure' ||
						row.restoration !== 'byte-identical' ||
						row.reproduced !== 'pass'
					);
				})
			)
				throw new Error('PhoneCat Vite exact migration evidence mismatch');
			composition = transformOrder;
		}
		if (expected.id === 'react-boilerplate-v4-composed') {
			const artifactRecord = async (name: string): Promise<Record<string, unknown>> => {
				const reference = receipt.artifacts.find(
					(item) => path.basename(item.path) === name,
				);
				if (!reference) throw new Error(`Composed React receipt omits ${name}`);
				return record(
					await readJson(path.join(root, reference.path)),
					`React ${name} artifact`,
				);
			};
			composition = await artifactRecord('composition.json');
			const transform = await artifactRecord('transform.json');
			const migrationDiff = await artifactRecord('migration-diff.json');
			const mutation = await artifactRecord('mutation.json');
			const expectedComposition = {
				schemaVersion: 'versionless.react-composed-plan.v1',
				requestedOrders: ['locale-first', 'data-flow-first'],
				executionTraces: [
					{ order: 'locale-first', steps: REACT_COMPOSED_EXECUTION_TRACES[0] },
					{ order: 'data-flow-first', steps: REACT_COMPOSED_EXECUTION_TRACES[1] },
				],
				actualOrdersExecuted: true,
				outputsEqual: true,
				latePreconditionFailure: 'refused',
				publish: 'same-filesystem-staged-directory-rename',
				injectedWriteFailure: 'refused',
				stagedWritesBeforeFailure: 1,
				rollback: 'published-target-unmodified',
				failedStageCleanup: true,
			};
			if (
				receipt.migration.transform !== 'react-composed-connect-to-hooks' ||
				canonicalize(composition) !== canonicalize(expectedComposition) ||
				canonicalize(transform.changedFiles) !==
					canonicalize(REACT_COMPOSED_CHANGED_FILES) ||
				transform.edits !== 13 ||
				canonicalize(transform.semanticEngine) !==
					canonicalize({
						parser: 'yuku-parser@0.7.0',
						analyzer: 'yuku-analyzer@0.7.0',
						diagnostics: 0,
					}) ||
				canonicalize(transform.sourceHashes) !==
					canonicalize(REACT_COMPOSED_SOURCE_HASHES) ||
				canonicalize(transform.targetHashes) !==
					canonicalize(REACT_COMPOSED_TARGET_HASHES) ||
				canonicalize(migrationDiff) !==
					canonicalize({
						changedFiles: REACT_COMPOSED_CHANGED_FILES,
						harnessOnlyAdapterExcluded: true,
						sourceHashes: REACT_COMPOSED_SOURCE_HASHES,
						targetHashes: REACT_COMPOSED_TARGET_HASHES,
					}) ||
				canonicalize(mutation) !==
					canonicalize({
						mutations: [
							{
								seam: 'home-reducer-injection',
								result: 'intended-failure',
								restoration: 'byte-identical',
								restoredSha256:
									REACT_COMPOSED_TARGET_HASHES[
										'app/containers/HomePage/index.js'
									],
								reproduced: 'pass',
							},
							{
								seam: 'locale-dispatch',
								result: 'intended-failure',
								restoration: 'byte-identical',
								restoredSha256:
									REACT_COMPOSED_TARGET_HASHES[
										'app/containers/LocaleToggle/index.js'
									],
								reproduced: 'pass',
							},
							{
								seam: 'repository-load',
								result: 'intended-failure',
								restoration: 'byte-identical',
								restoredSha256:
									REACT_COMPOSED_TARGET_HASHES[
										'app/containers/HomePage/index.js'
									],
								reproduced: 'pass',
							},
							{
								seam: 'service-worker-registration',
								result: 'intended-failure',
								restoration: 'byte-identical',
								restoredSha256:
									'17f8b8601929cd25a8557a6351d429ba24bd8871d557552351afb53363871c78',
								reproduced: 'pass',
							},
						],
						isolated: true,
					})
			)
				throw new Error('Composed React exact migration evidence mismatch');
			if (journey.length !== 4)
				throw new Error('Composed React journey must contain four exact runs');
			for (const [index, value] of journey.entries()) {
				const row = record(value, 'React composed journey row');
				const lane = index < 2 ? 'legacy' : 'target';
				const run = (index % 2) + 1;
				const expectedBlocked =
					lane === 'legacy'
						? ['https://fonts.googleapis.com/css?family=Open+Sans:400,700']
						: [];
				if (
					row.lane !== lane ||
					row.run !== run ||
					row.result !== 'pass' ||
					row.selectedLocale !== 'de' ||
					row.username !== 'octocat' ||
					canonicalize(row.repositories) !==
						canonicalize(['owned-repo', 'fork-owner/forked-repo']) ||
					canonicalize(row.issueCounts) !== canonicalize([3, 7]) ||
					canonicalize(row.blocked) !== canonicalize(expectedBlocked) ||
					canonicalize(row.successfulNonLoopback) !== canonicalize([]) ||
					canonicalize(row.consoleErrors) !== canonicalize([]) ||
					canonicalize(row.pageErrors) !== canonicalize([])
				)
					throw new Error('Composed React journey contract mismatch');
				const requests = row.syntheticRequests;
				if (
					!Array.isArray(requests) ||
					canonicalize(requests) !==
						canonicalize([
							{
								method: 'GET',
								url: 'https://api.github.com/users/octocat/repos?type=all&sort=updated',
								kind: 'synthetic-interception',
							},
						])
				)
					throw new Error('Composed React synthetic journey request mismatch');
			}
		}
		inspected.push({
			expected,
			receipt,
			journey,
			journeyRef,
			source: sourceIdentity(receipt),
			composition,
		});
	}
	if (
		aggregateByPath.size !==
		inspected.length +
			1 +
			(transaction.nextKilledByGoogleIntegrated ? 1 : 0) +
			(transaction.angularRealworldWitnessIntegrated ? 1 : 0) +
			(transaction.reactBoilerplateWitnessIntegrated ? 1 : 0) +
			(transaction.nextKilledByGoogleWitnessIntegrated ? 1 : 0) +
			(transaction.kind === 'react-avataaars-candidate' ||
			transaction.kind === 'react-calculator-candidate' ||
			transaction.kind === 'react-graphiql-013-candidate' ||
			transaction.kind === 'react-zero-sw-reconciliation' ||
			transaction.kind === 'react-papercups-browser-proof' ||
			transaction.kind === 'react-hospitalrun-browser-proof' ||
			transaction.kind === 'angular-factoriolab-browser-proof' ||
			transaction.kind === 'angular-jira-clone-browser-proof' ||
			transaction.kind === 'react-memos-browser-proof' ||
			transaction.kind === 'next-killedbygoogle-v3-browser-proof' ||
			transaction.kind === 'react-linkfree-browser-proof' ||
			transaction.kind === 'angular-tiny-translator-browser-proof' ||
			transaction.kind === 'angular-super-productivity-browser-proof'
				? transaction.kind === 'react-zero-sw-reconciliation'
					? 2
					: transaction.kind === 'react-papercups-browser-proof'
						? 4
						: transaction.kind === 'react-hospitalrun-browser-proof'
							? 6
							: transaction.kind === 'angular-factoriolab-browser-proof'
								? 7
								: transaction.kind === 'angular-jira-clone-browser-proof'
									? 8
									: transaction.kind === 'react-memos-browser-proof'
										? 9
										: transaction.kind ===
											  'next-killedbygoogle-v3-browser-proof'
											? 10
											: transaction.kind ===
												  'react-linkfree-browser-proof'
												? 11
												: transaction.kind ===
													  'angular-tiny-translator-browser-proof'
													? 12
													: transaction.kind ===
														  'angular-super-productivity-browser-proof'
														? 13
														: 1
				: 0)
	)
		throw new Error('Aggregate contains an unknown or extra receipt');
	const angularRealworld = await verifyAngularRealworldV15ToV16Evidence(root);
	const angularRealworldWitness = transaction.angularRealworldWitnessIntegrated
		? await verifyWitnessAngularRealworldEvidence(root)
		: null;
	const reactBoilerplateWitness = transaction.reactBoilerplateWitnessIntegrated
		? await verifyWitnessReactBoilerplateEvidence(root)
		: null;
	const nextKilledByGoogleWitness = transaction.nextKilledByGoogleWitnessIntegrated
		? await verifyWitnessNextKilledByGoogleEvidence(root)
		: null;
	/**
	 * Which browser-proof lanes this transaction state carries.
	 *
	 * Each lane is admitted only above its own predecessor, so presence
	 * cascades: a later state carries every earlier lane's rows. Deriving that
	 * cascade once keeps every row, receipt-count and matrix check reading the
	 * same answer instead of restating a longer disjunction at each use.
	 */
	const superProductivityIntegrated =
		transaction.kind === 'angular-super-productivity-browser-proof';
	const tinyTranslatorIntegrated =
		transaction.kind === 'angular-tiny-translator-browser-proof' || superProductivityIntegrated;
	const linkfreeIntegrated =
		transaction.kind === 'react-linkfree-browser-proof' || tinyTranslatorIntegrated;
	const killedbygoogleV3Integrated =
		transaction.kind === 'next-killedbygoogle-v3-browser-proof' || linkfreeIntegrated;
	const memosIntegrated =
		transaction.kind === 'react-memos-browser-proof' || killedbygoogleV3Integrated;
	const jiraCloneIntegrated =
		transaction.kind === 'angular-jira-clone-browser-proof' || memosIntegrated;
	const factoriolabIntegrated =
		transaction.kind === 'angular-factoriolab-browser-proof' || jiraCloneIntegrated;
	const hospitalrunIntegrated =
		transaction.kind === 'react-hospitalrun-browser-proof' || factoriolabIntegrated;
	const papercupsIntegrated =
		transaction.kind === 'react-papercups-browser-proof' || hospitalrunIntegrated;
	const papercups = papercupsIntegrated
		? await reactPapercupsConformanceRows(root, aggregateByPath)
		: null;
	const hospitalrun = hospitalrunIntegrated
		? await reactHospitalrunConformanceRows(root, aggregateByPath)
		: null;
	const factoriolab = factoriolabIntegrated
		? await angularFactoriolabConformanceRows(root, aggregateByPath)
		: null;
	const jiraClone = jiraCloneIntegrated
		? await angularJiraCloneConformanceRows(root, aggregateByPath)
		: null;
	const memos = memosIntegrated ? await reactMemosConformanceRows(root, aggregateByPath) : null;
	const killedbygoogleV3 = killedbygoogleV3Integrated
		? await nextKilledbygoogleV3ConformanceRows(
				root,
				aggregateByPath,
				KILLED_BY_GOOGLE_PUBLISHED_SOURCE,
			)
		: null;
	const linkfree = linkfreeIntegrated
		? await reactLinkfreeConformanceRows(root, aggregateByPath)
		: null;
	const tinyTranslator = tinyTranslatorIntegrated
		? await angularTinyTranslatorConformanceRows(root, aggregateByPath)
		: null;
	const superProductivity = superProductivityIntegrated
		? await angularSuperProductivityConformanceRows(root, aggregateByPath)
		: null;
	if (transaction.kind === 'react-zero-sw-reconciliation' || papercupsIntegrated) {
		const migration = await verifyReceipt(REACT_BOILERPLATE_ZERO_SW_RECEIPT_PATH, {
			repositoryRoot: root,
		});
		const migrationMember = record(
			aggregateByPath.get(REACT_BOILERPLATE_ZERO_SW_RECEIPT_PATH),
			'React Boilerplate zero-SW migration aggregate fixture',
		);
		if (migrationMember.digest !== migration.digest)
			throw new Error('React Boilerplate zero-SW migration aggregate digest differs');
		const verified = await verifyWitnessReactBoilerplateZeroSwEvidence(root);
		const member = record(
			aggregateByPath.get(WITNESS_REACT_BOILERPLATE_ZERO_SW_RECEIPT_PATH),
			'React Boilerplate zero-SW aggregate fixture',
		);
		if (member.digest !== verified.digest)
			throw new Error('React Boilerplate zero-SW aggregate digest differs');
	}
	const nextKilledByGoogle = transaction.nextKilledByGoogleIntegrated
		? await verifyNextKilledByGoogleEvidence(root)
		: null;
	if (transaction.kind === 'react-avataaars-candidate') {
		const verified = await verifyReactAvataaarsCompatibilityEvidence(root);
		const member = record(
			aggregateByPath.get(REACT_AVATAAARS_COMPATIBILITY_RECEIPT_PATH),
			'React Avataaars aggregate fixture',
		);
		if (member.digest !== verified.digest)
			throw new Error('React Avataaars aggregate digest differs');
	}
	if (transaction.kind === 'react-calculator-candidate') {
		const verified = await verifyReactCalculatorEvidence(root);
		const member = record(
			aggregateByPath.get(REACT_CALCULATOR_RECEIPT_PATH),
			'React Calculator aggregate fixture',
		);
		if (member.digest !== verified.digest)
			throw new Error('React Calculator aggregate digest differs');
	}
	if (transaction.kind === 'react-graphiql-013-candidate') {
		const verified = await verifyReactGraphiQL013Evidence(root);
		const member = record(
			aggregateByPath.get(REACT_GRAPHIQL_013_RECEIPT_PATH),
			'React GraphiQL aggregate fixture',
		);
		if (member.digest !== verified.digest)
			throw new Error('React GraphiQL aggregate digest differs');
	}
	if (nextKilledByGoogle && nextKilledByGoogle.digest !== nextKilledByGoogleDigest)
		throw new Error('Killed by Google aggregate digest differs');

	const sourceGroups = new Map<string, typeof inspected>();
	for (const item of inspected) {
		const key = canonicalize(item.source);
		const group = sourceGroups.get(key) ?? [];
		group.push(item);
		sourceGroups.set(key, group);
	}
	if (sourceGroups.size !== 2)
		throw new Error(
			`Corpus must resolve to exactly two immutable source applications, found ${sourceGroups.size}`,
		);
	for (const item of inspected) {
		const peers = sourceGroups.get(canonicalize(item.source)) ?? [];
		if (peers.some((peer) => peer.expected.application !== item.expected.application))
			throw new Error('Corpus source identity crosses expected application boundaries');
	}

	const react = inspected.filter((item) => item.expected.application === 'react-boilerplate');
	const phonecat = inspected.filter((item) => item.expected.application === 'angular-phonecat');
	if (react.length !== 5 || phonecat.length !== 4)
		throw new Error(
			'Corpus application grouping does not preserve five React and four PhoneCat verticals',
		);
	if (new Set(react.map((item) => canonicalize(item.source))).size !== 1)
		throw new Error('React Boilerplate immutable source divergence');
	const reactWorkerBuild = async (id: string): Promise<unknown> => {
		const item = react.find((value) => value.expected.id === id);
		const reference = item?.receipt.artifacts.find(
			(value) => path.basename(value.path) === 'build.json',
		);
		if (!reference) throw new Error(`React service-worker build missing: ${id}`);
		const builds = await readJson(path.join(root, reference.path));
		if (!Array.isArray(builds)) throw new Error(`React service-worker builds invalid: ${id}`);
		const target = builds
			.map((value) => record(value, `${id} build`))
			.find((value) => value.lane === 'target');
		if (!target?.serviceWorker) throw new Error(`React target service worker missing: ${id}`);
		return target.serviceWorker;
	};
	if (
		canonicalize(await reactWorkerBuild('react-boilerplate-v4-data-flow')) !==
		canonicalize(await reactWorkerBuild('react-boilerplate-v4-composed'))
	)
		throw new Error('React composed target is not the identical transformed Vite output');
	if (new Set(phonecat.map((item) => canonicalize(item.source))).size !== 1)
		throw new Error('Angular PhoneCat immutable source divergence');

	const projections = react.map((item) => {
		const values = uniqueCanonical(
			item.journey.map((value) => reactProjection(value, item.expected.id)),
		);
		if (values.length !== 1)
			throw new Error(`React behavior drift within vertical: ${item.expected.id}`);
		return values[0] as JourneyProjection;
	});
	if (uniqueCanonical(projections).length !== 1)
		throw new Error('React common user-observable projection drift');
	const commonProjection = projections[0];
	if (!commonProjection || commonProjection.result !== 'pass')
		throw new Error('React common user-observable projection is not passing');

	const phonecatJourneyDigests = new Set(phonecat.map((item) => item.journeyRef.sha256));
	if (phonecatJourneyDigests.size !== 1) throw new Error('PhoneCat journey digest drift');
	const phonecatJourneyDigest = phonecat[0]?.journeyRef.sha256;
	if (!phonecatJourneyDigest || !sha256Pattern.test(phonecatJourneyDigest))
		throw new Error('PhoneCat journey digest is invalid');

	const verticals: Array<Record<string, unknown>> = inspected.map((item) => ({
		id: item.expected.id,
		application: item.expected.application,
		framework: item.expected.framework,
		receiptPath: item.expected.path,
		receiptDigest: item.receipt.integrity.canonicalDigest,
		receiptSchema: receiptShape(item.receipt, item.journey),
		runtime: item.expected.runtime,
		bundler: item.expected.bundler,
		locality: {
			mode: 'offline',
			scope: item.receipt.verification.locality.scope,
			osWideIsolation: false,
			successfulNonLoopback: 0,
			browserBlockedRequests: item.receipt.verification.locality.browserBlockedRequests,
		},
		...(item.expected.id === 'react-boilerplate-v4-vite8' ||
		item.expected.id === 'react-boilerplate-v4-data-flow' ||
		item.expected.id === 'react-boilerplate-v4-composed' ||
		item.expected.id === 'angular-phonecat-vite8'
			? {
					adapter: 'fixture-specific',
					oldVite: 'not-tested',
					genericAdapter: 'not-tested',
					unplugin: 'not-tested',
				}
			: {}),
		...(item.expected.id === 'angular-phonecat'
			? { lexicalThis: 'verified' }
			: item.expected.id === 'angular-phonecat-route-resolve'
				? { routeResolves: 'verified', componentBindings: 'one-way-verified' }
				: item.expected.id === 'angular-phonecat-composed'
					? {
							composition: 'verified',
							orderIndependent: item.composition?.orderIndependent,
							lexicalThis: 'verified',
							routeResolves: 'verified',
							componentBindings: 'one-way-verified',
						}
					: item.expected.id === 'angular-phonecat-vite8'
						? {
								composition: 'verified',
								orderIndependent: item.composition?.orderIndependent,
								lexicalThis: 'verified',
								routeResolves: 'verified',
								componentBindings: 'one-way-verified',
								viteOutput: 'self-contained-rehashable',
								serviceWorker: 'out-of-scope-not-emitted',
							}
						: {}),
		...(item.expected.framework === 'angularjs'
			? {
					track: 'angularjs-special-track',
					angular2Plus: 'not-applicable',
					angularCliAot: 'not-applicable',
					designatedPilot: false,
				}
			: { designatedPilot: false }),
	}));
	verticals.push({
		id: 'angular-realworld-v15-to-v16',
		application: 'angular-realworld',
		framework: 'angular',
		receiptPath: ANGULAR_REALWORLD_V15_TO_V16_RECEIPT.path,
		receiptDigest: ANGULAR_REALWORLD_V15_TO_V16_RECEIPT.canonicalDigest,
		receiptSchema: {
			schemaVersion: angularRealworld.receipt.schemaVersion,
			toolingFields: ['npmVersion', 'legacyPeerDeps', 'compatibilityReason'],
			migrationFields: ['applicationFilesChanged', 'changedFiles'],
			journeyFields: uniqueCanonical(
				angularRealworld.receipt.journeys.map((value) =>
					keys(record(value, 'Angular RealWorld journey')),
				),
			),
		},
		runtime: 'Node 18.20.8',
		bundler: 'Angular CLI/Architect production AOT 15-to-16',
		locality: {
			mode: 'offline',
			scope: 'process-scoped',
			osWideIsolation: false,
			successfulNonLoopback: 0,
			browserBlockedRequests: 2,
		},
		track: 'angular2-plus-adjacent-major',
		angular2Plus: 'verified-one-adjacent-major',
		angularCliAot: 'verified',
		productionReadiness:
			angularRealworldWitness === null ? 'not-tested' : 'verified-direct-witness',
		readinessScoreboard:
			angularRealworldWitness === null
				? { angularLineage: { ready: 0, total: 4 }, harness: { ready: 0, total: 4 } }
				: angularRealworldWitness.receipt.readiness,
		designatedPilot: false,
	});
	if (nextKilledByGoogle)
		verticals.push({
			id: 'next-killedbygoogle-derived-state-to-memo',
			application: 'killedbygoogle',
			framework: 'react',
			receiptPath: NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH,
			receiptDigest: nextKilledByGoogle.digest,
			receiptSchema: {
				schemaVersion: nextKilledByGoogle.receipt.schemaVersion,
				toolingFields: keys(
					record(nextKilledByGoogle.receipt.tooling, 'Killed by Google tooling'),
				),
				migrationFields: keys(
					record(nextKilledByGoogle.receipt.migration, 'Killed by Google migration'),
				),
				journeyFields: ['baseline', 'migrated', 'normalizedEquivalent', 'restored'],
			},
			runtime: 'Node 16.20.2 EOL compatibility sandbox',
			bundler: 'Next 12.0.10 webpack 5',
			locality: {
				mode: 'offline',
				scope: 'process-scoped',
				osWideIsolation: false,
				successfulNonLoopback: 0,
			},
			track: 'next12-pages-derived-state-to-use-memo',
			traceDiagnosticReproducibility: 'not-claimed',
			designatedPilot: false,
		});
	if (papercups) verticals.push(papercups.vertical);
	if (hospitalrun) verticals.push(hospitalrun.vertical);
	if (factoriolab) verticals.push(factoriolab.vertical);
	if (jiraClone) verticals.push(jiraClone.vertical);
	if (memos) verticals.push(memos.vertical);
	if (killedbygoogleV3) verticals.push(killedbygoogleV3.vertical);
	if (linkfree) verticals.push(linkfree.vertical);
	if (tinyTranslator) verticals.push(tinyTranslator.vertical);
	if (superProductivity) verticals.push(superProductivity.vertical);

	const applications: Array<Record<string, unknown>> = [
		{
			id: 'react-boilerplate',
			source: react[0]?.source,
			verticals: react.map((item) => item.expected.id),
			conformance: {
				scope: 'common-user-observable-projection-only',
				projection: commonProjection,
				projectionSha256: sha256(canonicalize(commonProjection)),
				blockedNetworkObservations: react.map((item) => ({
					vertical: item.expected.id,
					browserBlockedRequests:
						item.receipt.verification.locality.browserBlockedRequests,
					blockedUrls: uniqueCanonical(
						item.journey.flatMap((value) => blockedUrls(value, item.expected.id)),
					),
				})),
			},
			boundaries: {
				viteAdapter: 'fixture-specific',
				oldVite: 'not-tested',
				genericAdapter: 'not-tested',
				unplugin: 'not-tested',
				fullEquivalence: 'not-claimed',
			},
		},
		{
			id: 'angular-phonecat',
			source: phonecat[0]?.source,
			verticals: phonecat.map((item) => item.expected.id),
			conformance: {
				journeySha256: phonecatJourneyDigest,
				journeyDigestIdentical: true,
				migrationsRemainDistinct: true,
			},
			boundaries: {
				track: 'angularjs-special-track',
				bundler: 'none-static / Vite 8.0.16',
				angular2Plus: 'not-applicable',
				angularCliAot: 'not-applicable',
				adjacentMajor: 'not-applicable',
				designatedPilot: false,
			},
		},
		{
			id: 'angular-realworld',
			source: {
				repository: normalizeURL(
					'https://github.com/realworld-apps/angular-realworld-example-app',
				),
				parentRevision: 'e28c8969aab9a27ece9873118b1ab7251f9ccb0c',
				targetRevision: '0d28f5c63b9cd678a3f1f724f68d6e41363bdd5a',
				archiveSha256: 'b834410ded0baae07950ba680d2ee82a5d7b797ee01bd86d9a901d3e696544a2',
				license: 'MIT',
				licenseSha256: 'dd241fc76d00987f9a025558ec977a2df69875320ab0379bd8f5865ad1033c7b',
			},
			verticals: ['angular-realworld-v15-to-v16'],
			conformance: {
				adjacentMajor: 'angular-15-to-16-verified',
				productionAot: true,
				journeys: 4,
				mutation: 'target-api-origin-rejection-verified',
				productionReadiness:
					angularRealworldWitness === null ? 'not-tested' : 'direct-witness-verified',
				readinessScoreboard:
					angularRealworldWitness === null
						? {
								angularLineage: { ready: 0, total: 4 },
								harness: { ready: 0, total: 4 },
							}
						: angularRealworldWitness.receipt.readiness,
			},
			boundaries: {
				track: 'angular2-plus-adjacent-major',
				designatedPilot: false,
				genericAngularSupport: 'not-claimed',
				locality: 'process-scoped-not-os-wide',
			},
		},
		...(nextKilledByGoogle
			? [
					{
						id: 'killedbygoogle',
						source: KILLED_BY_GOOGLE_PUBLISHED_SOURCE,
						/**
						 * The v3.0.0 browser proof is a second vertical on this
						 * one immutable source, not a second source: it pins the
						 * same repository, revision and archive digest, which
						 * `nextKilledbygoogleV3ConformanceRows` refuses to emit
						 * without checking.
						 */
						verticals: [
							'next-killedbygoogle-derived-state-to-memo',
							...(killedbygoogleV3
								? [string(killedbygoogleV3.vertical.id, 'KilledByGoogle v3 id')]
								: []),
						],
						conformance: {
							productionBuild: true,
							browserJourneys: 4,
							mutationRestoration: 'verified',
							productionOutputConformance: 'verified',
							...(killedbygoogleV3
								? { directWitness: killedbygoogleV3.browserProof }
								: {}),
						},
						boundaries: {
							traceDiagnosticReproducibility: 'not-claimed',
							genericNextSupport: 'not-claimed',
							productionReadiness: 'not-claimed',
							locality: 'process-scoped-not-os-wide',
						},
					},
				]
			: []),
		...(papercups ? [papercups.application] : []),
		...(hospitalrun ? [hospitalrun.application] : []),
		...(factoriolab ? [factoriolab.application] : []),
		...(jiraClone ? [jiraClone.application] : []),
		...(memos ? [memos.application] : []),
		...(linkfree ? [linkfree.application] : []),
		...(tinyTranslator ? [tinyTranslator.application] : []),
		...(superProductivity ? [superProductivity.application] : []),
	];
	if (
		verticals.length !== transaction.verticals ||
		applications.length !== transaction.sourceApplications
	)
		throw new Error(
			'Corpus conformance rows do not agree with the derived transaction summary',
		);

	const judgeCounting = lineageCountingLedger({
		reactBoilerplate: reactBoilerplateWitness !== null,
		papercups: papercups !== null,
		hospitalrun: hospitalrun !== null,
		angularRealworld: angularRealworldWitness !== null,
		factoriolab: factoriolab !== null,
		jiraClone: jiraClone !== null,
		memos: memos !== null,
		killedbygoogleV3: killedbygoogleV3 !== null,
		linkfree: linkfree !== null,
		tinyTranslator: tinyTranslator !== null,
		superProductivity: superProductivity !== null,
	});
	const reactLineageReady = countedLineageCells(judgeCounting, 'react');
	const angularLineageReady = countedLineageCells(judgeCounting, 'angular');
	const reactLineageTotal = lineageDenominator(judgeCounting, 'react');
	const angularLineageTotal = lineageDenominator(judgeCounting, 'angular');
	const holdouts = await holdoutLedger(root, aggregate);
	assertHoldoutsAreUncounted(judgeCounting, holdouts);
	const supportBoundaries = await supportBoundaryLedger(root);

	const result: CorpusConformance = {
		schemaVersion: CORPUS_CONFORMANCE_SCHEMA,
		summary: {
			verticals: transaction.verticals,
			sourceApplications: transaction.sourceApplications,
			designatedPilotsVerified: 0,
		},
		verticals,
		applications,
		frameworkLanes: NEXTJS_SYNTHETIC_NOT_TESTED_LANES,
		coverage: {
			takenote: 'not-tested',
			angular2Hn: 'not-tested',
			oldVite: 'not-tested',
			genericAdapter: 'not-tested',
			unplugin: 'not-tested',
			nextjs: nextKilledByGoogle ? 'fixture-specific-next12-pages-verified' : 'not-tested',
			/**
			 * Cells this engine declares it does not support, with the
			 * falsification evidence that established each one. A declared
			 * boundary is published for the same reason a failed holdout is:
			 * a matrix that only shows what worked is not a matrix.
			 */
			supportBoundaries,
			authenticity: 'not-established',
			certification: 'not-claimed',
			locality: 'process-scoped-not-os-wide',
			productionReadiness: {
				reactLineage: {
					ready: reactLineageReady,
					total: reactLineageTotal,
					counted: reactLineageReady > 0,
					candidate: reactLineageReady > 0 ? 'judge-approved' : 'not-tested',
				},
				angularLineage: {
					ready: angularLineageReady,
					total: angularLineageTotal,
					counted: angularLineageReady > 0,
					candidate: angularLineageReady > 0 ? 'judge-approved' : 'not-tested',
				},
				judgeCounting,
				/**
				 * Holdouts attempted against the frozen adapters, counted in no
				 * numerator and hidden from none of them.
				 */
				holdouts,
				/**
					 * The retired olderNext scoreboard. The charter oracle has exactly
					 * two lineages (React, Angular), so olderNext was never an oracle
					 * lineage — it was finer tracking of the legacy-Next member. Per the
					 * T016 charter ruling it is retired to this informational React
					 * sub-tag rather than deleted: Next.js-on-React is React-lineage, the
					 * legacy-Next member (next-killedbygoogle-v3-0-0) is now counted
					 * within the React numerator, and the older-Next direct-Witness
					 * candidate folds into React here rather than standing as a separate
					 * 0/4 gate. Recorded, never a silent gate change.
					 */
				olderNext: {
					retired: true,
					formerNumerator: '0/4',
					reclassifiedInto: 'reactLineage',
					reactSubTag: 'legacy-next',
					reason:
						'Next.js-on-React is React-lineage per the charter oracle; the olderNext 0/4 separate numerator was finer tracking, not an oracle lineage, and is retired into the React numerator with the legacy-Next member counted there.',
					candidate:
						nextKilledByGoogleWitness === null
							? 'not-tested'
							: 'reclassified-into-react-lineage',
				},
				harness: { ready: 0, total: 4 },
				phonecat: 'unsupported-visible-transition-not-counted',
			},
		},
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	result.integrity.canonicalDigest = sha256(canonicalize(result));
	return result;
}

export function verifyCorpusConformanceDigest(value: CorpusConformance): string {
	if (value.schemaVersion !== CORPUS_CONFORMANCE_SCHEMA)
		throw new Error('Unsupported corpus conformance schema');
	const copy = structuredClone(value);
	const declared = copy.integrity.canonicalDigest;
	copy.integrity.canonicalDigest = '';
	const calculated = sha256(canonicalize(copy));
	if (!sha256Pattern.test(declared) || calculated !== declared)
		throw new Error('Corpus conformance canonical digest mismatch');
	return calculated;
}
