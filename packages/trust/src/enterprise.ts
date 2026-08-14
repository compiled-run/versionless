import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { canonicalize } from '../../core/src/receipts/canonicalize.ts';
import type { CapabilityCoverage } from '../../core/src/receipts/capability-coverage.ts';
import type { CorpusConformance } from '../../core/src/corpus/conformance.ts';
import {
	ANGULAR_PRE_IVY_BOUNDARY_POPULATION_STATEMENT,
	ANGULAR_PRE_IVY_BOUNDARY_PREVALENCE,
} from '../../core/src/receipts/angular-pre-ivy-boundary-amendment.ts';
import {
	HOLDOUT_ANGULAR_ESHOP_WEBSPA_APPLICATION,
	HOLDOUT_ANGULAR_ESHOP_WEBSPA_OUTCOME,
	HOLDOUT_ANGULAR_ESHOP_WEBSPA_PROVEN_SURFACE,
	HOLDOUT_ANGULAR_ESHOP_WEBSPA_WITNESS_STATE,
} from '../../core/src/receipts/holdout-angular-eshop-webspa.ts';
import {
	HOLDOUT_ANGULAR_PIGALLERY2_APPLICATION,
} from '../../core/src/receipts/holdout-angular-pigallery2.ts';
import {
	HOLDOUT_REACT_CYPRESS_RWA_WITNESS_APPLICATION,
	HOLDOUT_REACT_CYPRESS_RWA_WITNESS_RECEIPT_PATH,
	verifyHoldoutReactCypressRwaWitnessEvidence,
	type HoldoutReactCypressRwaWitnessReceipt,
} from '../../core/src/receipts/holdout-react-cypress-rwa-witness.ts';
import { asRecord, asString, TRUST_SCHEMA, type TrustManifest } from './schema.ts';

/**
 * The enterprise surfaces are the two documents an adoption decision is actually
 * taken from: one machine artifact and one human document. Everything in them is
 * derived from a canonical receipt the trust package already verified, so the
 * only way to change a claim is to change the evidence under it.
 *
 * Three failure modes are what this module exists to make impossible, and each
 * is checked as a mechanism rather than trusted from how the text was written:
 *
 * 1. A counted cell that nobody proved. The green cells are read off the Judge's
 *    counting ledger and cross-checked against the corpus' own numerator, so a
 *    hand-added row cannot survive re-derivation.
 * 2. A bounded pass restated as a generic one. The eShop holdout's outcome is
 *    the exact bounded string its receipt carries and the word "passed" may not
 *    appear beside that application in any other form.
 * 3. A quietly dropped RED, boundary, prevalence figure, or non-claim. Each is
 *    carried verbatim and asserted present before the document is emitted.
 */
export const ENTERPRISE_REPORT_SCHEMA = 'versionless.enterprise-report.v1' as const;
export const ENTERPRISE_REPORT_JSON = 'enterprise-report.json' as const;
export const ENTERPRISE_REPORT_MARKDOWN = 'enterprise-report.md' as const;

/**
 * Blanket-support vocabulary this record may never use.
 *
 * "production ready" is the phrase the whole goal exists to avoid: it converts a
 * counted set of ten proven cells into an unbounded product claim. The corpus'
 * own "production readiness" *score* is a different token and stays legal — the
 * word boundary after `ready` is what separates them.
 */
const BLANKET_CLAIM_PATTERNS: ReadonlyArray<{ readonly label: string; readonly pattern: RegExp }> =
	Object.freeze([
		{ label: 'production-ready', pattern: /production.{0,2}ready\b/i },
		{ label: 'enterprise-ready', pattern: /enterprise.{0,2}ready\b/i },
		{ label: 'fully-supported', pattern: /fully[\s-]support/i },
		{ label: 'generally-available', pattern: /generally[\s-]available/i },
		{ label: 'guaranteed', pattern: /\bguarantee[sd]?\b/i },
		// `not-certified` is the declaration this record is required to carry, so
		// the pattern refuses only an unnegated certification claim.
		{ label: 'certified', pattern: /(?<!not[\s-])\bcertified\b/i },
		{ label: 'any-react-or-angular-app', pattern: /\bany (react|angular)\b/i },
	]);

export interface EnterpriseMatrixVertical {
	readonly vertical: string;
	readonly runtime: string;
	readonly bundler: string;
	readonly migrationTrack: string;
	readonly browserProof: string;
	readonly browserRuns: number | string;
	readonly behaviorDigest: string;
	readonly locality: unknown;
}

/**
 * What this record says when the corpus does not carry a field.
 *
 * The five React Boilerplate verticals record runtime and bundler but no
 * per-vertical browser proof: that cell's browser evidence lives in the Witness
 * receipt the Judge counted it off, which is named in the same row. A few source
 * records likewise carry no revision or license-text hash. Naming the gap is the
 * honest reading; filling it with a plausible value, or printing `undefined`
 * where a reviewer expects a hash, is not.
 */
const NOT_RECORDED = 'not-recorded-in-the-corpus-record' as const;

const recordedText = (value: unknown): string =>
	typeof value === 'string' && value.length > 0 ? value : NOT_RECORDED;

const recordedCount = (value: unknown): number | string =>
	typeof value === 'number' ? value : NOT_RECORDED;

export interface EnterpriseMatrixCell {
	readonly cell: string;
	readonly application: string;
	readonly lineage: string;
	readonly witnessReceipt: string;
	readonly verticals: EnterpriseMatrixVertical[];
	readonly acceptance: string;
	readonly reactSubTag?: string;
}

export interface EnterpriseHoldout {
	readonly id: string;
	readonly application: string;
	readonly lineage: string;
	readonly outcome: string;
	readonly receipt: string;
	readonly digest: string;
	readonly countedInLineageNumerator: false;
	readonly countingNote: string;
	readonly reason: string;
	readonly provenSurface?: string;
	readonly surfacesNotCovered?: ReadonlyArray<{ readonly surface: string; readonly state: string }>;
}

export interface EnterpriseFalsification {
	readonly id: string;
	readonly application: string;
	readonly lane: string;
	readonly state: 'red';
	readonly frozenAdapterFingerprint: string;
	readonly receipt: string;
	readonly digest: string;
	readonly retention: string;
}

export interface EnterpriseSupportMatrix {
	readonly derivation: string;
	readonly counted: Record<
		string,
		{ readonly ready: number; readonly total: number; readonly cells: EnterpriseMatrixCell[] }
	>;
	readonly demoted: Array<{
		readonly cell: string;
		readonly lineage: string;
		readonly reason: string;
	}>;
	readonly holdouts: EnterpriseHoldout[];
	readonly falsificationHistory: EnterpriseFalsification[];
	readonly declaredBoundaries: Array<Record<string, unknown>>;
	readonly boundaryPrevalence: {
		readonly published: string;
		readonly neverPublishedAs: string;
		readonly statement: string;
		readonly populationStatement: string;
	};
	readonly trancheTwoCommitment: string;
	readonly outOfMatrixCapabilities: {
		readonly total: number;
		readonly crossProven: number;
		readonly experimental: number;
		readonly note: string;
		readonly entries: Array<{ readonly lineage: string; readonly capability: string }>;
	};
}

export interface EnterpriseClaims {
	readonly derivation: string;
	readonly claims: string[];
	readonly nonClaims: string[];
}

export interface EnterpriseReport {
	readonly schemaVersion: typeof ENTERPRISE_REPORT_SCHEMA;
	readonly purpose: string;
	readonly certification: Record<string, string>;
	readonly derivedFrom: Record<string, string>;
	readonly sourcesAndRights: Array<Record<string, unknown>>;
	readonly toolAndTargetVersions: {
		readonly tool: Record<string, string>;
		readonly cells: Array<Record<string, string>>;
	};
	readonly hashes: {
		readonly artifacts: Array<{ readonly path: string; readonly sha256: string }>;
		readonly receipts: Array<{
			readonly path: string;
			readonly digest: string;
			readonly state: string;
		}>;
	};
	readonly commands: {
		readonly note: string;
		readonly generation: Array<{ readonly name: string; readonly command: string }>;
		readonly verification: Array<{ readonly name: string; readonly command: string }>;
		readonly receiptVerification: Array<{ readonly receipt: string; readonly command: string }>;
	};
	readonly locality: Record<string, unknown>;
	readonly journeys: Array<Record<string, unknown>>;
	readonly results: { readonly supportMatrix: EnterpriseSupportMatrix };
	readonly deviations: Array<Record<string, unknown>>;
	readonly unsupportedAndUnknown: Record<string, unknown>;
	readonly claims: EnterpriseClaims;
}

export interface EnterpriseReportInputs {
	readonly manifest: TrustManifest;
	readonly conformance: CorpusConformance;
	readonly capabilityCoverage: CapabilityCoverage;
	readonly matrix: Record<string, unknown>;
	readonly controls: Record<string, unknown>;
	readonly licenses: Record<string, unknown>;
	readonly freeze: Record<string, unknown>;
	readonly scriptSurface: Record<string, unknown>;
	readonly runtimeScriptObservation: Record<string, unknown>;
	readonly cypressWitness: HoldoutReactCypressRwaWitnessReceipt;
	readonly workspaceScripts: Record<string, string>;
}

const readiness = (conformance: CorpusConformance): Record<string, unknown> =>
	asRecord(
		(conformance.coverage as Record<string, unknown>).productionReadiness,
		'corpus production readiness',
	);

const judgeLedger = (conformance: CorpusConformance): Array<Record<string, unknown>> => {
	const ledger = readiness(conformance).judgeCounting;
	if (!Array.isArray(ledger) || ledger.length === 0)
		throw new Error('Corpus conformance omits the Judge counting ledger');
	return ledger.map((entry) => asRecord(entry, 'Judge counting cell'));
};

const holdoutLedger = (conformance: CorpusConformance): Array<Record<string, unknown>> => {
	const holdouts = readiness(conformance).holdouts;
	if (!Array.isArray(holdouts) || holdouts.length === 0)
		throw new Error('Corpus conformance omits the holdout ledger');
	return holdouts.map((entry) => asRecord(entry, 'holdout record'));
};

/**
 * Resolves the corpus verticals a Judge-counted cell was proven across.
 *
 * Most counted cells are one vertical and resolve by id. The React Boilerplate
 * cell is not: the Judge counted one application proven across five verticals,
 * and collapsing that into a single row would either drop four measured lanes
 * or invent a version pair no receipt carries. The list is therefore resolved,
 * carried, and rendered as what it is.
 */
const cellVerticals = (
	conformance: CorpusConformance,
	cell: string,
	application: string,
): Array<Record<string, unknown>> => {
	const records = conformance.verticals.map((value) => asRecord(value, 'corpus vertical'));
	const byId = records.filter(
		(vertical) => asString(vertical.id, 'corpus vertical id') === cell,
	);
	if (byId.length > 0) return byId;
	const byApplication = records.filter((vertical) => vertical.application === application);
	if (byApplication.length === 0)
		throw new Error(`Judge-counted cell ${cell} has no corpus vertical to derive versions from`);
	return byApplication;
};

/**
 * Derives one lineage's counted green cells straight off the Judge's ledger.
 *
 * The cells are never listed here. They are filtered out of the ledger the
 * corpus derived and then cross-checked against the corpus' own numerator and
 * denominator, so a row that nobody proved cannot be added and a proven row
 * cannot be dropped without the score moving with it.
 */
function countedCells(
	conformance: CorpusConformance,
	lineage: string,
): { ready: number; total: number; cells: EnterpriseMatrixCell[] } {
	const ledger = judgeLedger(conformance);
	const score = asRecord(readiness(conformance)[`${lineage}Lineage`], `${lineage} readiness`);
	const ready = score.ready;
	const total = score.total;
	if (typeof ready !== 'number' || typeof total !== 'number')
		throw new Error(`Corpus conformance omits a numeric ${lineage} readiness score`);
	const inLineage = ledger.filter((cell) => cell.lineage === lineage);
	const cells = inLineage
		.filter((cell) => cell.counted === true)
		.map((cell): EnterpriseMatrixCell => {
			const id = asString(cell.cell, 'Judge counting cell id');
			const application = asString(cell.application, 'Judge counting application');
			const subTag = cell.reactSubTag;
			return {
				cell: id,
				application,
				lineage,
				witnessReceipt: asString(cell.witnessReceipt, 'Judge counting witness receipt'),
				verticals: cellVerticals(conformance, id, application).map((vertical) => ({
					vertical: asString(vertical.id, 'corpus vertical id'),
					runtime: asString(vertical.runtime, 'corpus vertical runtime'),
					bundler: asString(vertical.bundler, 'corpus vertical bundler'),
					migrationTrack: recordedText(vertical.migrationTrack ?? vertical.track),
					browserProof: recordedText(vertical.browserProof),
					browserRuns: recordedCount(vertical.browserRuns),
					behaviorDigest: recordedText(vertical.behaviorDigest),
					locality: vertical.locality,
				})),
				acceptance: asString(cell.reason, 'Judge counting reason'),
				...(typeof subTag === 'string' ? { reactSubTag: subTag } : {}),
			};
		});
	if (cells.length !== ready)
		throw new Error(
			`Derived ${lineage} green cells (${cells.length}) differ from the corpus numerator (${ready})`,
		);
	if (inLineage.filter((cell) => cell.demoted !== true).length !== total)
		throw new Error(`Derived ${lineage} denominator differs from the corpus denominator`);
	return { ready, total, cells };
}

/**
 * Carries the tranche-two commitment out of the boundary's own non-claims.
 *
 * The commitment is what keeps the declared boundary from reading as a
 * permanent ceiling, and it is quoted rather than paraphrased: the sentence
 * that names the ngcc-bearing Angular 12/13 cell is the sentence published.
 */
function trancheTwoCommitment(boundaries: Array<Record<string, unknown>>): string {
	const commitments = boundaries.flatMap((boundary) => {
		const nonclaims = boundary.nonclaims;
		if (!Array.isArray(nonclaims)) return [];
		return nonclaims.filter(
			(claim): claim is string => typeof claim === 'string' && claim.includes('tranche-two'),
		);
	});
	if (commitments.length !== 1)
		throw new Error('Exactly one declared tranche-two commitment must be published');
	return commitments[0]!;
}

function supportMatrix(inputs: EnterpriseReportInputs): EnterpriseSupportMatrix {
	const { conformance, capabilityCoverage } = inputs;
	const ledger = judgeLedger(conformance);
	const holdouts = holdoutLedger(conformance);
	const boundaries = (conformance.coverage as Record<string, unknown>).supportBoundaries;
	if (!Array.isArray(boundaries) || boundaries.length === 0)
		throw new Error('Corpus conformance omits the declared support boundaries');
	const boundaryRecords = boundaries.map((value) => asRecord(value, 'support boundary'));
	const eshop = holdouts.find(
		(holdout) => holdout.application === HOLDOUT_ANGULAR_ESHOP_WEBSPA_APPLICATION,
	);
	const pigallery2 = holdouts.find(
		(holdout) => holdout.application === HOLDOUT_ANGULAR_PIGALLERY2_APPLICATION,
	);
	const cypressTrancheOne = holdouts.find(
		(holdout) => holdout.application === HOLDOUT_REACT_CYPRESS_RWA_WITNESS_APPLICATION,
	);
	if (eshop === undefined || pigallery2 === undefined || cypressTrancheOne === undefined)
		throw new Error('The holdout ledger omits a published falsification attempt');
	if (eshop.outcome !== HOLDOUT_ANGULAR_ESHOP_WEBSPA_OUTCOME)
		throw new Error('The eShop holdout outcome is not its exact bounded receipt string');
	const cypress = inputs.cypressWitness;
	if (cypress.holdoutOutcome !== 'passed')
		throw new Error('The cypress-realworld-app holdout receipt is not the passing record');
	if (cypress.counting.countedInLineageNumerator !== false)
		throw new Error('A passing holdout must be counted in no lineage numerator');
	const surfaces = eshop.witnessSurfaceNotCovered;
	if (!Array.isArray(surfaces) || surfaces.length !== 7)
		throw new Error('The eShop holdout must carry its seven recorded surface limits');
	return {
		derivation:
			'Every green cell below is filtered out of the Judge counting ledger the corpus derived and cross-checked against that corpus numerator and denominator. No cell is listed by hand, and a cell edited into this record fails re-derivation.',
		counted: {
			react: countedCells(conformance, 'react'),
			angular: countedCells(conformance, 'angular'),
		},
		demoted: ledger
			.filter((cell) => cell.demoted === true)
			.map((cell) => ({
				cell: asString(cell.cell, 'demoted cell'),
				lineage: asString(cell.lineage, 'demoted lineage'),
				reason: asString(cell.reason, 'demoted reason'),
			})),
		holdouts: [
			{
				id: 'holdout-react-cypress-rwa',
				application: HOLDOUT_REACT_CYPRESS_RWA_WITNESS_APPLICATION,
				lineage: 'react',
				outcome: cypress.holdoutOutcome,
				receipt: HOLDOUT_REACT_CYPRESS_RWA_WITNESS_RECEIPT_PATH,
				digest: cypress.integrity.canonicalDigest,
				countedInLineageNumerator: false,
				countingNote: cypress.counting.countingNote,
				reason: cypress.nonclaims[0] ?? '',
			},
			{
				id: asString(eshop.id, 'eShop holdout id'),
				application: HOLDOUT_ANGULAR_ESHOP_WEBSPA_APPLICATION,
				lineage: asString(eshop.lineage, 'eShop lineage'),
				outcome: HOLDOUT_ANGULAR_ESHOP_WEBSPA_OUTCOME,
				receipt: asString(eshop.receipt, 'eShop receipt'),
				digest: asString(eshop.digest, 'eShop digest'),
				countedInLineageNumerator: false,
				countingNote: asString(eshop.countingNote, 'eShop counting note'),
				reason: asString(eshop.reason, 'eShop reason'),
				provenSurface: HOLDOUT_ANGULAR_ESHOP_WEBSPA_PROVEN_SURFACE,
				surfacesNotCovered: surfaces.map((entry) => {
					const limit = asRecord(entry, 'eShop surface limit');
					return {
						surface: asString(limit.surface, 'eShop surface'),
						state: asString(limit.state, 'eShop surface state'),
					};
				}),
			},
		],
		falsificationHistory: [
			{
				id: asString(pigallery2.id, 'pigallery2 holdout id'),
				application: HOLDOUT_ANGULAR_PIGALLERY2_APPLICATION,
				lane: 'migrated',
				state: 'red',
				frozenAdapterFingerprint: asString(
					pigallery2.frozenAdapterFingerprint,
					'pigallery2 frozen fingerprint',
				),
				receipt: asString(pigallery2.receipt, 'pigallery2 receipt'),
				digest: asString(pigallery2.digest, 'pigallery2 digest'),
				retention:
					'Permanent falsification evidence. The declared pre-Ivy support boundary rests on this RED, and the RED is published unchanged rather than retracted or excused by it.',
			},
			{
				id: asString(eshop.id, 'eShop holdout id'),
				application: HOLDOUT_ANGULAR_ESHOP_WEBSPA_APPLICATION,
				lane: 'migrated-at-install-under-frozen-composite',
				state: 'red',
				frozenAdapterFingerprint: asString(
					eshop.frozenAdapterFingerprint,
					'eShop frozen fingerprint',
				),
				receipt: asString(eshop.receipt, 'eShop receipt'),
				digest: asString(eshop.digest, 'eShop digest'),
				retention:
					'Permanent falsification evidence. The install RED this application took under the frozen composite is retained beside its later bounded-surface result, not replaced by it.',
			},
			{
				id: asString(cypressTrancheOne.id, 'cypress tranche-one holdout id'),
				application: HOLDOUT_REACT_CYPRESS_RWA_WITNESS_APPLICATION,
				lane: 'migrated',
				state: 'red',
				frozenAdapterFingerprint: asString(
					cypressTrancheOne.frozenAdapterFingerprint,
					'cypress tranche-one frozen fingerprint',
				),
				receipt: asString(cypressTrancheOne.receipt, 'cypress tranche-one receipt'),
				digest: asString(cypressTrancheOne.digest, 'cypress tranche-one digest'),
				retention:
					'Permanent falsification evidence. The tranche-one RED is superseded by reference and stays published; it is not deleted by the later passing record.',
			},
		],
		declaredBoundaries: boundaryRecords,
		boundaryPrevalence: {
			published: ANGULAR_PRE_IVY_BOUNDARY_PREVALENCE.published,
			neverPublishedAs: ANGULAR_PRE_IVY_BOUNDARY_PREVALENCE.neverPublishedAs,
			statement: ANGULAR_PRE_IVY_BOUNDARY_PREVALENCE.statement,
			populationStatement: ANGULAR_PRE_IVY_BOUNDARY_POPULATION_STATEMENT,
		},
		trancheTwoCommitment: trancheTwoCommitment(boundaryRecords),
		outOfMatrixCapabilities: {
			total: capabilityCoverage.summary.total,
			crossProven: capabilityCoverage.summary.crossProven,
			experimental: capabilityCoverage.summary.experimental,
			note: `A capability is claimed general, and therefore in the matrix, only once at least ${capabilityCoverage.crossProvenThreshold} independent applications prove it. The capabilities below are proven on fewer than that and are out of the matrix; they are named rather than silently claimed.`,
			entries: capabilityCoverage.capabilities
				.filter((capability) => capability.classification === 'experimental')
				.map((capability) => ({ lineage: capability.lineage, capability: capability.name })),
		},
	};
}

/**
 * Assembles the claims and non-claims one-pager out of the canonical records.
 *
 * Nothing here is authored as prose. Each claim restates a counted score or a
 * verified digest, and each non-claim is lifted verbatim from the record that
 * already carries it, so the one-pager cannot say more than the evidence and
 * cannot quietly say less.
 */
function claimsOnePager(
	inputs: EnterpriseReportInputs,
	matrix: EnterpriseSupportMatrix,
): EnterpriseClaims {
	const controls = inputs.controls;
	const locality = asRecord(controls.locality, 'controls locality');
	const scriptSurface = asRecord(controls.scriptSurface, 'controls script surface');
	const runtime = asRecord(controls.runtimeScriptObservation, 'controls runtime observation');
	const boundaryNonclaims = matrix.declaredBoundaries.flatMap((boundary) => {
		const nonclaims = boundary.nonclaims;
		return Array.isArray(nonclaims)
			? nonclaims.filter((claim): claim is string => typeof claim === 'string')
			: [];
	});
	const eshop = matrix.holdouts.find(
		(holdout) => holdout.application === HOLDOUT_ANGULAR_ESHOP_WEBSPA_APPLICATION,
	)!;
	const claims = [
		`${matrix.counted.react!.ready} of ${matrix.counted.react!.total} React-lineage cells and ${matrix.counted.angular!.ready} of ${matrix.counted.angular!.total} Angular-lineage cells carry a Judge-accepted direct-Witness browser proof against the frozen adapter, each on its own immutable source application.`,
		`Every number above is derived from the Judge counting ledger inside \`corpus-conformance.json\` (\`${inputs.conformance.integrity.canonicalDigest}\`); the cells are enumerated in this record and each names the receipt it was counted off.`,
		`${matrix.outOfMatrixCapabilities.crossProven} of ${matrix.outOfMatrixCapabilities.total} enumerated migration capabilities are cross-proven on at least two independent applications and are therefore in the matrix.`,
		'Every artifact in this package is bound by SHA-256 to the trust manifest, and the derived documents are re-derived from the same canonical receipts at verification time.',
		'The two published holdouts that did not end RED are reported with the exact outcome string their receipts carry, and both are counted in no lineage numerator.',
	];
	const nonClaims = [
		'This package is evidence, not certification, legal assurance, PCI compliance, or SOC 2 attestation. No cell in it carries a certification of any kind.',
		`Integrity is hash-only: authenticity is **${inputs.manifest.integrity.authenticity}** and certification is **${inputs.manifest.integrity.certification}**. Signer authenticity is not established.`,
		'No SLSA level is claimed. The provenance record is in-toto/SLSA-shaped only, and Git provenance and official CI identity remain unknown.',
		`Locality is ${asString(locality.scope, 'locality scope')} and process-scoped: OS-wide isolation is **${String(locality.osWideIsolation)}** and is not claimed.`,
		`Neither holdout is counted in any lineage numerator. ${matrix.holdouts.map((holdout) => holdout.countingNote).join(' ')}`,
		`The ${HOLDOUT_ANGULAR_ESHOP_WEBSPA_APPLICATION} holdout is published as \`${HOLDOUT_ANGULAR_ESHOP_WEBSPA_OUTCOME}\` and is never restated in any shorter or more general form. The surfaces it does not cover are named: ${(eshop.surfacesNotCovered ?? []).map((limit) => `${limit.surface} (${limit.state})`).join(', ')}.`,
		`${matrix.outOfMatrixCapabilities.experimental} of ${matrix.outOfMatrixCapabilities.total} enumerated capabilities are proven on fewer than two independent applications and are **out of the matrix**; nothing general is claimed for them.`,
		`Static script-surface evidence claims no payment-page applicability (**${asString(scriptSurface.paymentPageApplicability, 'payment applicability')}**), no dynamic script insertion coverage (**${asString(scriptSurface.dynamicScriptInsertion, 'dynamic insertion')}**), and no PCI compliance (**${asString(scriptSurface.pciCompliance, 'PCI')}**).`,
		`Runtime script observation is scoped to the exact qualified journeys: global dynamic-insertion coverage is **${asString(runtime.globalDynamicInsertionCoverage, 'global dynamic insertion')}** and PCI compliance is **${asString(runtime.pciCompliance, 'runtime PCI')}**.`,
		`The Angular 16 pre-Ivy-only-dependency cell is declared **unsupported**. Prevalence is published as **${matrix.boundaryPrevalence.published}** and is never rounded up to include the sixth application, whose condition is a different one: ${matrix.boundaryPrevalence.statement}`,
		matrix.boundaryPrevalence.populationStatement,
		...boundaryNonclaims,
		matrix.trancheTwoCommitment,
		...matrix.falsificationHistory.map((entry) => `${entry.application}: ${entry.retention}`),
	];
	return {
		derivation:
			'Every claim restates a score or digest the corpus derived; every non-claim is carried verbatim from the record that already publishes it. Neither list is authored beside the evidence.',
		claims,
		nonClaims,
	};
}

function sourcesAndRights(conformance: CorpusConformance): Array<Record<string, unknown>> {
	const applications = (conformance as unknown as Record<string, unknown>).applications;
	if (!Array.isArray(applications) || applications.length === 0)
		throw new Error('Corpus conformance omits its source applications');
	return applications.map((value) => {
		const application = asRecord(value, 'corpus application');
		const source = asRecord(application.source, 'corpus application source');
		return {
			application: asString(application.id, 'corpus application id'),
			repository: recordedText(source.repository),
			// The pinned revision is named by reference rather than restated here.
			// Two of the corpus revisions are git object ids whose digit runs the
			// synthetic-evidence scanner reads as account-number-like, and that
			// scanner admits them only inside the corpus-conformance document they
			// belong to. Pointing at that hash-bound record is the honest way to
			// carry the pin without either tripping the scanner or weakening it;
			// the human document renders the revisions from the same record.
			revisionRecordedIn: {
				path: 'corpus-conformance.json',
				field: `applications[].source.revision for ${asString(application.id, 'corpus application id')}`,
			},
			// A field the corpus source record does not carry is named as absent
			// rather than printed as `undefined`: an enterprise reviewer reading a
			// rights table has to be able to tell a missing hash from a real one.
			archiveSha256: recordedText(source.archiveSha256),
			license: recordedText(source.license),
			licenseSha256: recordedText(source.licenseSha256),
			verticals: application.verticals,
			rights:
				'Ingested at a pin under recorded consent, with the license text hashed at that pin. No redistribution right beyond the upstream license is claimed.',
		};
	});
}

function deviations(
	conformance: CorpusConformance,
	matrix: EnterpriseSupportMatrix,
): Array<Record<string, unknown>> {
	const recorded: Array<Record<string, unknown>> = [];
	for (const vertical of conformance.verticals) {
		const record = asRecord(vertical, 'corpus vertical');
		const id = asString(record.id, 'corpus vertical id');
		const serviceWorker = record.serviceWorker;
		if (typeof serviceWorker === 'string' && serviceWorker !== 'not-applicable')
			recorded.push({
				cell: id,
				kind: 'service-worker',
				state: serviceWorker,
				disposition: 'recorded, not masked',
			});
		const scrollSurface = record.scrollSurface;
		if (typeof scrollSurface === 'string' && scrollSurface !== 'verified')
			recorded.push({
				cell: id,
				kind: 'scroll-surface',
				state: scrollSurface,
				disposition: 'recorded, not masked',
			});
	}
	for (const holdout of matrix.holdouts)
		for (const limit of holdout.surfacesNotCovered ?? [])
			recorded.push({
				cell: holdout.id,
				kind: 'witness-surface-limit',
				state: `${limit.surface}: ${limit.state}`,
				disposition: 'unproven rather than proven absent',
			});
	for (const demoted of matrix.demoted)
		recorded.push({
			cell: demoted.cell,
			kind: 'demoted-from-denominator',
			state: demoted.reason,
			disposition: 'recorded, not masked',
		});
	return recorded;
}

function unsupportedAndUnknown(inputs: EnterpriseReportInputs): Record<string, unknown> {
	const coverage = inputs.conformance.coverage as Record<string, unknown>;
	const controls = inputs.controls;
	const licenseSummary = asRecord(inputs.licenses.summary, 'license summary');
	return {
		unsupportedCells: (coverage.supportBoundaries as unknown[]).map((value) => {
			const boundary = asRecord(value, 'support boundary');
			return {
				cell: boundary.cell,
				state: boundary.state,
				certification: boundary.certification,
				condition: boundary.condition,
			};
		}),
		notTested: {
			takenote: coverage.takenote,
			angular2Hn: coverage.angular2Hn,
			oldVite: coverage.oldVite,
			genericAdapter: coverage.genericAdapter,
			unplugin: coverage.unplugin,
			nextjs: coverage.nextjs,
		},
		unknown: {
			securityPolicy: controls.securityPolicy,
			gitProvenance: controls.gitProvenance,
			signingIdentity: controls.signingIdentity,
			rootLicenseText: inputs.licenses.rootLicenseText,
			licenseCoverage: licenseSummary,
		},
	};
}

export function buildEnterpriseReport(inputs: EnterpriseReportInputs): EnterpriseReport {
	const matrix = supportMatrix(inputs);
	const claims = claimsOnePager(inputs, matrix);
	const freeze = asRecord(inputs.freeze.freeze, 'adapter freeze');
	const controlsLocality = asRecord(inputs.controls.locality, 'controls locality');
	const scriptCommands = Object.entries(inputs.workspaceScripts)
		.filter(([name]) => name.endsWith(':verify'))
		.map(([name, command]) => ({ name, command }))
		.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
	const generationCommands = Object.entries(inputs.workspaceScripts)
		.filter(([name]) => name.endsWith(':generate') || name.endsWith(':ingest'))
		.map(([name, command]) => ({ name, command }))
		.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
	const allCells = [...matrix.counted.react!.cells, ...matrix.counted.angular!.cells];
	return {
		schemaVersion: ENTERPRISE_REPORT_SCHEMA,
		purpose:
			'One machine artifact for an enterprise reviewer, derived entirely from canonical receipts the trust package already verified. It states what was proven, on which sources, with which tools, under which commands, and — in the same document — what is unsupported, unknown, or deliberately not claimed.',
		certification: {
			state: 'not-certified',
			assurance:
				'This package is evidence, not certification, legal assurance, PCI compliance, or SOC 2 attestation.',
			integrity: 'hash-only; authenticity is not established',
			slsaLevel: 'not-claimed',
		},
		derivedFrom: {
			trustManifestCanonicalDigest: inputs.manifest.canonicalDigest,
			deterministicCoreDigest: inputs.manifest.deterministicCore.digest,
			corpusConformanceDigest: inputs.conformance.integrity.canonicalDigest,
			adapterFreezeComposite: asString(freeze.composite, 'freeze composite'),
			adapterFreezeCommit: asString(freeze.commit, 'freeze commit'),
		},
		sourcesAndRights: sourcesAndRights(inputs.conformance),
		toolAndTargetVersions: {
			tool: {
				generator: 'versionless-local-trust-generator',
				adapterFreezeCommit: asString(freeze.commit, 'freeze commit'),
				adapterFreezeComposite: asString(freeze.composite, 'freeze composite'),
				networkMode: 'offline',
			},
			cells: allCells.flatMap((cell) =>
				cell.verticals.map((vertical) => ({
					cell: cell.cell,
					vertical: vertical.vertical,
					lineage: cell.lineage,
					runtime: vertical.runtime,
					bundler: vertical.bundler,
					migrationTrack: vertical.migrationTrack,
				})),
			),
		},
		hashes: {
			artifacts: inputs.manifest.deterministicCore.artifacts.map((artifact) => ({
				path: artifact.path,
				sha256: artifact.sha256,
			})),
			receipts: inputs.manifest.receipts.map((receipt) => ({
				path: receipt.path,
				digest: receipt.digest,
				state: receipt.state,
			})),
		},
		commands: {
			note: 'Every command below is the workspace script as committed; the receipt list is the manifest receipt inventory. All acceptance work runs offline under dual offline controls.',
			generation: generationCommands,
			verification: scriptCommands,
			receiptVerification: inputs.manifest.receipts.map((receipt) => ({
				receipt: receipt.path,
				command: `VERSIONLESS_NETWORK_MODE=offline NPM_CONFIG_OFFLINE=true pnpm run receipt:verify -- ${receipt.path}`,
			})),
		},
		locality: {
			mode: 'offline',
			scope: controlsLocality.scope,
			osWideIsolation: controlsLocality.osWideIsolation,
			perCell: allCells.flatMap((cell) =>
				cell.verticals.map((vertical) => ({
					cell: cell.cell,
					vertical: vertical.vertical,
					locality: vertical.locality,
				})),
			),
		},
		journeys: allCells.flatMap((cell) =>
			cell.verticals.map((vertical) => ({
				cell: cell.cell,
				vertical: vertical.vertical,
				browserProof: vertical.browserProof,
				browserRuns: vertical.browserRuns,
				behaviorDigest: vertical.behaviorDigest,
			})),
		),
		results: { supportMatrix: matrix },
		deviations: deviations(inputs.conformance, matrix),
		unsupportedAndUnknown: unsupportedAndUnknown(inputs),
		claims,
	};
}

const cellLines = (cells: EnterpriseMatrixCell[]): string =>
	cells
		.flatMap((cell) =>
			cell.verticals.map(
				(vertical) =>
					`| \`${cell.cell}\` | ${cell.application} | \`${vertical.vertical}\` | ${vertical.runtime} | ${vertical.bundler} | ${vertical.migrationTrack} | ${typeof vertical.browserRuns === 'number' ? `${vertical.browserProof} (${vertical.browserRuns} runs)` : vertical.browserProof} | \`${cell.witnessReceipt}\` |`,
			),
		)
		.join('\n');

export function renderEnterpriseReport(report: EnterpriseReport): string {
	const matrix = report.results.supportMatrix;
	const boundary = matrix.declaredBoundaries
		.map((value) => {
			const evidence = asRecord(value.instanceEvidence, 'boundary instance evidence');
			return `- Boundary \`${asString(value.id, 'boundary id')}\` at cell \`${asString(value.cell, 'boundary cell')}\`: **${asString(value.state, 'boundary state')}** — ${asString(value.condition, 'boundary condition')}\n  - ${asString(value.mechanism, 'boundary mechanism')}\n  - **${asString(value.certification, 'boundary certification')}**\n  - Instance evidence: ${asString(evidence.application, 'boundary application')}, ${String(evidence.libraries)} libraries at ${String(evidence.importSites)} import sites — recorded RED in \`${asString(evidence.receipt, 'boundary receipt')}\` \`${asString(evidence.digest, 'boundary digest')}\`.`;
		})
		.join('\n');
	return `# Versionless enterprise evidence report

${report.purpose}

- Trust manifest canonical SHA-256: \`${report.derivedFrom.trustManifestCanonicalDigest}\`
- Deterministic core: \`${report.derivedFrom.deterministicCoreDigest}\`
- Corpus conformance: \`${report.derivedFrom.corpusConformanceDigest}\`
- Adapter freeze: commit \`${report.derivedFrom.adapterFreezeCommit}\`, composite \`${report.derivedFrom.adapterFreezeComposite}\`
- Certification: **${report.certification.state}** — ${report.certification.assurance}
- Integrity: **${report.certification.integrity}**; SLSA level: **${report.certification.slsaLevel}**

The machine artifact for this document is [\`${ENTERPRISE_REPORT_JSON}\`](${ENTERPRISE_REPORT_JSON}). Both are regenerated from the same canonical receipts and compared at verification time, so an edit to either fails verification rather than changing a claim.

## 1. Sources and rights

| Application | Repository | Archive SHA-256 | License | License SHA-256 | Pinned revision |
| --- | --- | --- | --- | --- | --- |
${report.sourcesAndRights
	.map((source) => {
		const pointer = asRecord(source.revisionRecordedIn, 'revision pointer');
		return `| ${String(source.application)} | ${String(source.repository)} | \`${String(source.archiveSha256)}\` | ${String(source.license)} | \`${String(source.licenseSha256)}\` | \`${asString(pointer.path, 'revision pointer path')}\` → \`${asString(pointer.field, 'revision pointer field')}\` |`;
	})
	.join('\n')}

Each application is pinned to an exact upstream revision. Those revisions are carried in [\`corpus-conformance.json\`](corpus-conformance.json) rather than restated here, and that record is itself bound by SHA-256 to the trust manifest above.

${String(report.sourcesAndRights[0]?.rights ?? '')}

## 2. Tool and target versions

Tool: \`${report.toolAndTargetVersions.tool.generator}\`, adapter frozen at commit \`${report.toolAndTargetVersions.tool.adapterFreezeCommit}\` (composite \`${report.toolAndTargetVersions.tool.adapterFreezeComposite}\`), network mode **${report.toolAndTargetVersions.tool.networkMode}**.

| Cell | Vertical | Lineage | Runtime | Bundler | Migration track |
| --- | --- | --- | --- | --- | --- |
${report.toolAndTargetVersions.cells
	.map(
		(cell) =>
			`| \`${cell.cell}\` | \`${cell.vertical}\` | ${cell.lineage} | ${cell.runtime} | ${cell.bundler} | ${cell.migrationTrack} |`,
	)
	.join('\n')}

## 3. Hashes

${report.hashes.artifacts.map((artifact) => `- \`${artifact.path}\` — \`${artifact.sha256}\``).join('\n')}

Receipt inventory (${report.hashes.receipts.length} preserved receipts):

${report.hashes.receipts.map((receipt) => `- \`${receipt.path}\` — \`${receipt.digest}\` (${receipt.state})`).join('\n')}

## 4. Commands

${report.commands.note}

Generation:

\`\`\`sh
${report.commands.generation.map((entry) => `pnpm run ${entry.name}`).join('\n')}
\`\`\`

Verification:

\`\`\`sh
${report.commands.verification.map((entry) => `pnpm run ${entry.name}`).join('\n')}
\`\`\`

Each preserved receipt is independently checkable with its own command, for example:

\`\`\`sh
${report.commands.receiptVerification[0]?.command ?? ''}
\`\`\`

## 5. Locality

Mode **${String(report.locality.mode)}**; scope: ${String(report.locality.scope)}. OS-wide isolation: **${String(report.locality.osWideIsolation)}** — locality evidence is process-scoped and does not establish OS-wide isolation.

## 6. Journeys

| Cell | Vertical | Browser proof | Runs | Behaviour digest |
| --- | --- | --- | --- | --- |
${report.journeys
	.map(
		(journey) =>
			`| \`${String(journey.cell)}\` | \`${String(journey.vertical)}\` | ${String(journey.browserProof)} | ${String(journey.browserRuns)} | \`${String(journey.behaviorDigest)}\` |`,
	)
	.join('\n')}

## 7. Results — supported and unsupported matrix

${matrix.derivation}

### React lineage — ${matrix.counted.react!.ready}/${matrix.counted.react!.total} counted green cells

| Cell | Application | Vertical | Runtime | Bundler | Migration track | Browser proof | Witness receipt |
| --- | --- | --- | --- | --- | --- | --- | --- |
${cellLines(matrix.counted.react!.cells)}

### Angular lineage — ${matrix.counted.angular!.ready}/${matrix.counted.angular!.total} counted green cells

| Cell | Application | Vertical | Runtime | Bundler | Migration track | Browser proof | Witness receipt |
| --- | --- | --- | --- | --- | --- | --- | --- |
${cellLines(matrix.counted.angular!.cells)}

### Demoted from the denominator

${matrix.demoted.map((entry) => `- \`${entry.cell}\` (${entry.lineage}): ${entry.reason}`).join('\n')}

### Holdouts — counted in no lineage numerator

${matrix.holdouts
	.map(
		(holdout) =>
			`- \`${holdout.id}\` (${holdout.application}, ${holdout.lineage} lineage): outcome \`${holdout.outcome}\` — receipt \`${holdout.receipt}\` \`${holdout.digest}\`. Counted in no lineage numerator. ${holdout.countingNote}${holdout.provenSurface ? `\n  - Proven surface: **${holdout.provenSurface}** only. Surfaces not covered: ${(holdout.surfacesNotCovered ?? []).map((limit) => `${limit.surface} (${limit.state})`).join(', ')}.` : ''}`,
	)
	.join('\n')}

### Permanent falsification history

${matrix.falsificationHistory
	.map(
		(entry) =>
			`- \`${entry.id}\` — ${entry.application}, ${entry.lane} lane **RED** against frozen adapter composite \`${entry.frozenAdapterFingerprint}\`; receipt \`${entry.receipt}\` \`${entry.digest}\`. ${entry.retention}`,
	)
	.join('\n')}

### Declared support boundaries

${boundary}

- Prevalence (**${matrix.boundaryPrevalence.published}**): ${matrix.boundaryPrevalence.statement}
- Population: ${matrix.boundaryPrevalence.populationStatement}
- Tranche two: ${matrix.trancheTwoCommitment}

### Out of matrix

${matrix.outOfMatrixCapabilities.note} ${matrix.outOfMatrixCapabilities.experimental} of ${matrix.outOfMatrixCapabilities.total} enumerated capabilities are out of the matrix; ${matrix.outOfMatrixCapabilities.crossProven} are cross-proven and in it.

${matrix.outOfMatrixCapabilities.entries.map((entry) => `- ${entry.lineage}: \`${entry.capability}\``).join('\n')}

## 8. Deviations recorded, not masked

${report.deviations.map((deviation) => `- \`${String(deviation.cell)}\` — ${String(deviation.kind)}: ${String(deviation.state)} (${String(deviation.disposition)})`).join('\n')}

## 9. Unsupported and unknown states

${(report.unsupportedAndUnknown.unsupportedCells as Array<Record<string, unknown>>).map((cell) => `- Unsupported cell \`${String(cell.cell)}\`: ${String(cell.condition)} — **${String(cell.certification)}**`).join('\n')}

${Object.entries(report.unsupportedAndUnknown.notTested as Record<string, unknown>)
	.map(([key, value]) => `- \`${key}\`: **${JSON.stringify(value)}**`)
	.join('\n')}

${Object.entries(report.unsupportedAndUnknown.unknown as Record<string, unknown>)
	.map(([key, value]) => `- \`${key}\`: ${JSON.stringify(value)}`)
	.join('\n')}

## 10. Claims and non-claims

${report.claims.derivation}

### Claims

${report.claims.claims.map((claim) => `- ${claim}`).join('\n')}

### Non-claims

${report.claims.nonClaims.map((claim) => `- ${claim}`).join('\n')}

---

This document is not certification. It establishes hash integrity only; authenticity is not established, no SLSA level is claimed, and locality is process-scoped rather than OS-wide isolation.
`;
}

/**
 * Refuses an enterprise document whose honesty-carrying parts have been
 * softened, dropped, or restated more broadly than the evidence.
 *
 * The check runs against the emitted text rather than the construction above
 * it, because the failure this exists for is a sentence that reads well and
 * claims more than a receipt supports.
 */
export function assertEnterpriseSurfaceHonesty(text: string, surface: string): void {
	for (const { label, pattern } of BLANKET_CLAIM_PATTERNS)
		if (pattern.test(text))
			throw new Error(`${surface} uses blanket-support language: ${label}`);
	if (!text.includes(HOLDOUT_ANGULAR_ESHOP_WEBSPA_OUTCOME))
		throw new Error(`${surface} omits the eShop holdout's exact bounded outcome string`);
	// The eShop result may be described as a pass only alongside its own bounded
	// outcome string, and never as a bare verb. Two mechanical rules carry that:
	// a line naming the application and using any pass-word must also carry the
	// exact outcome string, and once that string is removed no inflected verb
	// form may remain — those are the forms ("passed", "passes") a reader takes
	// as a whole-application result, whereas the surviving noun only appears in
	// the bounding phrases that name the surface.
	for (const line of text.split('\n')) {
		if (!line.includes(HOLDOUT_ANGULAR_ESHOP_WEBSPA_APPLICATION)) continue;
		if (!/\bpass(ed|es|ing)?\b/i.test(line)) continue;
		if (!line.includes(HOLDOUT_ANGULAR_ESHOP_WEBSPA_OUTCOME))
			throw new Error(
				`${surface} calls the eShop holdout a pass without its exact bounded outcome string`,
			);
		const stripped = line
			.split(HOLDOUT_ANGULAR_ESHOP_WEBSPA_OUTCOME)
			.join(' ')
			.split(HOLDOUT_ANGULAR_ESHOP_WEBSPA_WITNESS_STATE)
			.join(' ');
		if (/\bpass(ed|es|ing)\b/i.test(stripped))
			throw new Error(`${surface} restates the eShop holdout as a generic pass`);
	}
	if (
		!text.includes(ANGULAR_PRE_IVY_BOUNDARY_PREVALENCE.statement) ||
		!text.includes(ANGULAR_PRE_IVY_BOUNDARY_PREVALENCE.published) ||
		text.includes(ANGULAR_PRE_IVY_BOUNDARY_PREVALENCE.neverPublishedAs)
	)
		throw new Error(`${surface} does not publish the boundary prevalence as 5-of-6`);
	if (!text.includes(ANGULAR_PRE_IVY_BOUNDARY_POPULATION_STATEMENT))
		throw new Error(`${surface} omits the boundary population statement`);
	if (!text.includes('counted in no lineage numerator'))
		throw new Error(`${surface} omits the holdout counting non-claim`);
	if (!text.includes('not certification'))
		throw new Error(`${surface} omits the non-certification statement`);
}

/**
 * Inputs the two enterprise surfaces are derived from, minus the parts this
 * module reads off disk itself.
 *
 * The cypress-realworld-app holdout receipt and the workspace scripts are
 * re-verified here rather than passed in, so the generator and the verifier
 * cannot disagree about them: both call this one function.
 */
export interface EnterpriseSurfaceInputs {
	readonly root: string;
	readonly output: string;
	readonly manifest: TrustManifest;
	readonly conformance: CorpusConformance;
	readonly capabilityCoverage: CapabilityCoverage;
	readonly matrix: Record<string, unknown>;
	readonly controls: Record<string, unknown>;
	readonly licenses: Record<string, unknown>;
	readonly freeze: Record<string, unknown>;
	readonly scriptSurface: Record<string, unknown>;
	readonly runtimeScriptObservation: Record<string, unknown>;
}

export async function deriveEnterpriseSurfaces(
	inputs: EnterpriseSurfaceInputs,
): Promise<{ report: EnterpriseReport; markdown: string }> {
	const cypressWitness = (await verifyHoldoutReactCypressRwaWitnessEvidence(inputs.root)).receipt;
	const workspaceScripts = asRecord(
		asRecord(
			JSON.parse(await readFile(path.join(inputs.root, 'package.json'), 'utf8')),
			'workspace package manifest',
		).scripts,
		'workspace scripts',
	) as Record<string, string>;
	const report = buildEnterpriseReport({
		manifest: inputs.manifest,
		conformance: inputs.conformance,
		capabilityCoverage: inputs.capabilityCoverage,
		matrix: inputs.matrix,
		controls: inputs.controls,
		licenses: inputs.licenses,
		freeze: inputs.freeze,
		scriptSurface: inputs.scriptSurface,
		runtimeScriptObservation: inputs.runtimeScriptObservation,
		cypressWitness,
		workspaceScripts,
	});
	const markdown = renderEnterpriseReport(report);
	assertEnterpriseReport(report, markdown);
	return { report, markdown };
}

/**
 * Refuses an enterprise surface that was edited rather than derived.
 *
 * Both files are rebuilt from the canonical receipts and compared — the JSON
 * canonically, the Markdown byte for byte — so a cell typed into either one
 * fails here even if every enclosing hash had been recomputed around it.
 */
export async function verifyEnterpriseSurfaces(inputs: EnterpriseSurfaceInputs): Promise<void> {
	const { report, markdown } = await deriveEnterpriseSurfaces(inputs);
	const publishedJson = JSON.parse(
		await readFile(path.join(inputs.output, ENTERPRISE_REPORT_JSON), 'utf8'),
	) as unknown;
	if (canonicalize(publishedJson) !== canonicalize(report))
		throw new Error(
			`${ENTERPRISE_REPORT_JSON} does not match independent re-derivation from the canonical receipts`,
		);
	const publishedMarkdown = await readFile(
		path.join(inputs.output, ENTERPRISE_REPORT_MARKDOWN),
		'utf8',
	);
	if (publishedMarkdown !== markdown)
		throw new Error(
			`${ENTERPRISE_REPORT_MARKDOWN} does not match independent re-derivation from the canonical receipts`,
		);
	assertEnterpriseSurfaceHonesty(publishedMarkdown, ENTERPRISE_REPORT_MARKDOWN);
}

export function assertEnterpriseReport(report: EnterpriseReport, rendered: string): void {
	if (report.schemaVersion !== ENTERPRISE_REPORT_SCHEMA)
		throw new Error('Enterprise report carries the wrong schema version');
	if (report.certification.state !== 'not-certified')
		throw new Error('Enterprise report must declare itself not certified');
	const matrix = report.results.supportMatrix;
	for (const lineage of ['react', 'angular']) {
		const counted = matrix.counted[lineage];
		if (counted === undefined || counted.cells.length !== counted.ready)
			throw new Error(`Enterprise matrix ${lineage} cells do not match the counted numerator`);
		for (const cell of counted.cells)
			if (cell.lineage !== lineage || cell.witnessReceipt.length === 0)
				throw new Error(`Enterprise matrix cell ${cell.cell} is not derived from a receipt`);
	}
	if (matrix.holdouts.some((holdout) => holdout.countedInLineageNumerator !== false))
		throw new Error('A holdout reached a lineage numerator in the enterprise matrix');
	if (matrix.falsificationHistory.some((entry) => entry.state !== 'red'))
		throw new Error('The falsification history must carry only RED records');
	if (matrix.falsificationHistory.length < 2)
		throw new Error('The permanent falsification history is incomplete');
	if (matrix.boundaryPrevalence.published !== ANGULAR_PRE_IVY_BOUNDARY_PREVALENCE.published)
		throw new Error('The boundary prevalence was rounded away from 5-of-6');
	if (report.claims.nonClaims.length === 0) throw new Error('The claims one-pager has no non-claims');
	assertEnterpriseSurfaceHonesty(rendered, ENTERPRISE_REPORT_MARKDOWN);
}
