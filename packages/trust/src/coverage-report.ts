/**
 * The coverage report: what the fleet pipeline actually proved, and on what.
 *
 * This document exists because `versionless run` ends by pointing at a coverage
 * number, and a coverage number is exactly the kind of claim that inflates
 * quietly. Three properties keep it from doing so, and each is a mechanism
 * rather than an intention.
 *
 * **One derivation, not two.** Every counted cell, holdout, demotion, boundary
 * and capability figure here is read off the same support matrix the enterprise
 * report and `supported-matrix` already publish — `buildSupportMatrix`, off the
 * Judge counting ledger. Nothing is recounted locally, so this surface cannot
 * disagree with that one; widening what reads the derivation does not widen the
 * claim it carries.
 *
 * **The intervention rule.** An application whose status derives from a
 * `versionless run` record is recorded proven only when that record carries an
 * intervention count of zero. A record that does not assert an intervention
 * count cannot produce a proven application at all: it is recorded
 * `not-admitted` with `intervention-count-not-asserted`, because "nobody
 * measured the hand-help" and "there was none" are not the same statement. The
 * rule reaches run-record-derived rows only — the sealed cells the Judge already
 * counted are not re-adjudicated by a counter that did not exist when they were
 * proven.
 *
 * **The same honesty guard.** The human rendering terminates in
 * `assertEnterpriseSurfaceHonesty`, so a bounded outcome restated as a generic
 * pass, a dropped boundary prevalence figure or blanket-support vocabulary stops
 * the render here rather than reaching a reader.
 *
 * Both files are re-derived from the canonical receipts and compared at
 * verification time — the JSON canonically, the Markdown byte for byte — so an
 * edit to either fails verification rather than changing a claim.
 */

import { readFile, readdir } from 'node:fs/promises';
import * as path from 'pathe';
import { runRecordSource } from '../../core/src/corpus/conformance.ts';
import { canonicalize, sha256 } from '../../core/src/receipts/canonicalize.ts';
import type { CapabilityCoverage } from '../../core/src/receipts/capability-coverage.ts';
import { assertEnterpriseSurfaceHonesty, type EnterpriseSupportMatrix } from './enterprise.ts';
import { asRecord, asString } from './schema.ts';

export const COVERAGE_REPORT_SCHEMA = 'versionless.coverage-report.v1' as const;
export const COVERAGE_REPORT_JSON = 'coverage-report.json' as const;
export const COVERAGE_REPORT_MARKDOWN = 'coverage-report.md' as const;

/** Where the refusal census this report tallies is published. */
export const REFUSAL_CENSUS_PATH = 'evidence/runs/operator-flows/refusal-census.json' as const;

/** The directory each `versionless run` record is filed under, one per run. */
export const RUN_RECORD_ROOT = 'evidence/runs' as const;
export const RUN_RECORD_FILE = 'run-record.json' as const;

/**
 * The out-of-band harness record, filed beside the run record it scored.
 *
 * Two names are read because the harness files its record beside whatever path
 * `--record` named, and a run filed here is filed at `run-record.json`. Reading
 * both is what lets the count arrive from the harness rather than from the run:
 * a `versionless run` record carries no count of its own, and a count it did
 * carry would be the number the thing under test chose to report.
 */
export const INTERVENTION_RECORD_SCHEMA = 'versionless.intervention-count.v1' as const;
export const INTERVENTION_RECORD_FILES: readonly string[] = Object.freeze([
	'intervention-count.json',
	`${RUN_RECORD_FILE}.interventions.json`,
]);

/** Why a run-record-derived application was not admitted as proven. */
export const INTERVENTION_COUNT_NOT_ASSERTED = 'intervention-count-not-asserted' as const;
export const INTERVENTION_COUNT_NOT_ZERO = 'intervention-count-not-zero' as const;
/**
 * The proven bar this surface used to be the weakest holder of.
 *
 * `intervention-count.ts` returns `proven` only when every stage row reads
 * `ran`, and the corpus conformance admission path requires the same. This
 * reader reached `proven` on `outcome === 'proceeded'` plus a zero count and
 * read the stage rows not at all — so a run that proceeded without every stage
 * running could be counted here and nowhere else. It is named rather than
 * folded into `run-did-not-proceed:` because the two states differ: that one is
 * a run that stopped, this one is a run that claims to have finished with a
 * stage that did not run.
 */
export const STAGES_NOT_ALL_RAN = 'stages-not-all-ran' as const;

/** The rule, in one sentence, published inside the record it governs. */
export const INTERVENTION_RULE_STATEMENT =
	'An application admitted through `versionless run` is recorded proven only if its run record exists, carries `interventions.count === 0`, and every one of its stage rows reads `ran`. A run record that does not assert an intervention count cannot yield a proven application: it is recorded `not-admitted` with `intervention-count-not-asserted`, because an unmeasured intervention count is not a measured zero. A run that proceeded with a stage that did not run is recorded `not-admitted` with `stages-not-all-ran`, which is the same bar the intervention harness and the corpus conformance admission path already hold. Applications whose status derives from sealed receipts are outside this rule; their status is what the Judge counting ledger and the holdout ledger already carry.' as const;

export type CoverageStatus = 'proven' | 'bounded' | 'refused' | 'not-admitted';
export type CoverageProvenance = 'sealed-receipts' | 'run-record';

export interface CoverageApplicationRow {
	readonly id: string;
	readonly application: string;
	readonly framework: string;
	readonly status: CoverageStatus;
	readonly provenanceOfStatus: CoverageProvenance;
	/** The Judge's counting reason, for a sealed proven cell. */
	readonly acceptance?: string;
	readonly witnessReceipt?: string;
	/** The bounded outcome string a holdout carries, verbatim. */
	readonly boundedOutcome?: string;
	readonly countingNote?: string;
	readonly refusalCode?: string;
	/** Why this row is not proven, when a code does not say it. */
	readonly statusReason?: string;
	readonly interventionCount?: number | 'not-asserted';
	/**
	 * The stage table a run-record row was adjudicated on, carried verbatim.
	 *
	 * A sealed cell carries none: the Judge counted it off a witness receipt,
	 * and there is no pipeline stage table behind it to publish. Its presence is
	 * what distinguishes a pipeline proof from a counted matrix cell here.
	 */
	readonly stages?: readonly { readonly name: string; readonly status: string }[];
}

/**
 * A `versionless run` record as this report reads it.
 *
 * `interventions` is optional on purpose: the field is emitted by the
 * out-of-band intervention harness, and a record written before that harness
 * existed carries no count. That absence is a readable state here rather than a
 * parse failure — and it is never a proven application.
 */
export interface CoverageRunRecord {
	readonly id: string;
	readonly application: string;
	readonly framework: string;
	readonly outcome: string;
	readonly refusal?: { readonly code?: string } | undefined;
	readonly interventions?: { readonly count?: number } | undefined;
	/**
	 * The stages the run states it reached, verbatim. Carried, never rewritten:
	 * the corpus conformance admission path reads them to refuse a run that
	 * proceeded without every stage running, and this reader is not the place
	 * that decides what that means.
	 */
	readonly stages?: readonly { readonly name: string; readonly status: string }[] | undefined;
	/** The classification the out-of-band harness recorded beside the run. */
	readonly terminalClassification?: string | undefined;
	/** Repository-relative basis paths, for a row that has to name its evidence. */
	readonly runRecordPath?: string | undefined;
	readonly interventionRecordPath?: string | undefined;
	/**
	 * The ingest stage's pin and the licence-at-pin stage's reading, verbatim.
	 *
	 * Carried rather than interpreted, for the same reason `stages` is: the
	 * corpus admission path decides what a stated source is, and this reader is
	 * not the place that decides it. Nothing here opens the acquisition journal
	 * the pin cites — the run record is the whole basis of a run-record row.
	 */
	readonly pin?:
		| {
				readonly repository?: string | undefined;
				readonly ref?: string | undefined;
				readonly commitSha?: string | undefined;
		  }
		| undefined;
	readonly licence?:
		| {
				readonly identifier?: string | undefined;
				readonly artifactSha256?: string | undefined;
		  }
		| undefined;
}

/** The pin the run record's ingest stage recorded, as this reader carries it. */
function runPin(stages: unknown): CoverageRunRecord['pin'] {
	if (!Array.isArray(stages)) return undefined;
	const stage = stages.find(
		(entry) =>
			typeof entry === 'object' &&
			entry !== null &&
			(entry as Record<string, unknown>).name === 'ingest',
	);
	const pin = (stage as Record<string, unknown> | undefined)?.record;
	if (typeof pin !== 'object' || pin === null) return undefined;
	const value = (pin as Record<string, unknown>).pin;
	if (typeof value !== 'object' || value === null) return undefined;
	const fields = value as Record<string, unknown>;
	return Object.freeze({
		...(typeof fields.repository === 'string' ? { repository: fields.repository } : {}),
		...(typeof fields.ref === 'string' ? { ref: fields.ref } : {}),
		...(typeof fields.commitSha === 'string' ? { commitSha: fields.commitSha } : {}),
	});
}

/**
 * The licence the run record's licence-at-pin stage read, as this reader carries it.
 *
 * The digest is the one on the artifact that stage recorded as the repository
 * root licence — the file the identifier was read out of. A stage that recorded
 * an identifier but hashed no licence file carries no digest here, and the row
 * is refused rather than published with an identifier nothing backs.
 */
function runLicence(stages: unknown): CoverageRunRecord['licence'] {
	if (!Array.isArray(stages)) return undefined;
	const stage = stages.find(
		(entry) =>
			typeof entry === 'object' &&
			entry !== null &&
			(entry as Record<string, unknown>).name === 'license-at-pin',
	);
	const value = (stage as Record<string, unknown> | undefined)?.record;
	if (typeof value !== 'object' || value === null) return undefined;
	const fields = value as Record<string, unknown>;
	const artifacts = Array.isArray(fields.artifacts) ? fields.artifacts : [];
	const root = artifacts.find(
		(entry) =>
			typeof entry === 'object' &&
			entry !== null &&
			(entry as Record<string, unknown>).role === 'repository-root-licence',
	) as Record<string, unknown> | undefined;
	return Object.freeze({
		...(typeof fields.identifier === 'string' ? { identifier: fields.identifier } : {}),
		...(typeof root?.sha256 === 'string' ? { artifactSha256: root.sha256 } : {}),
	});
}

export interface CoverageReport {
	readonly schemaVersion: typeof COVERAGE_REPORT_SCHEMA;
	readonly purpose: string;
	readonly derivation: string;
	readonly certification: Readonly<Record<string, string>>;
	readonly sealedBaseline: {
		readonly counted: Readonly<
			Record<string, { readonly ready: number; readonly total: number }>
		>;
		readonly demoted: EnterpriseSupportMatrix['demoted'];
		readonly capabilities: {
			readonly total: number;
			readonly crossProven: number;
			readonly experimental: number;
			readonly crossProvenThreshold: number;
			readonly note: string;
		};
		readonly boundaryPrevalence: {
			readonly published: string;
			readonly statement: string;
			readonly populationStatement: string;
		};
		readonly trancheTwoCommitment: string;
	};
	readonly applications: readonly CoverageApplicationRow[];
	readonly totals: Readonly<Record<CoverageStatus | 'applications', number>>;
	readonly refusalCensus: {
		readonly source: string;
		readonly adapterFreezeComposite: string;
		readonly totals: Readonly<Record<string, unknown>>;
		readonly byCode: Readonly<Record<string, number>>;
	};
	readonly interventionRule: { readonly applied: true; readonly statement: string };
	readonly notEstablished: readonly string[];
	readonly integrity: {
		readonly algorithm: 'sha256';
		readonly canonicalDigest: string;
		readonly authenticity: 'not-established';
		readonly certification: 'not-claimed';
	};
}

export interface CoverageReportInputs {
	readonly matrix: EnterpriseSupportMatrix;
	readonly capabilityCoverage: CapabilityCoverage;
	readonly refusalCensus: Record<string, unknown>;
	readonly runRecords: readonly CoverageRunRecord[];
}

/**
 * The one place a run-record-derived status is decided.
 *
 * A refusal is carried by its code, a run that did not proceed is named as such,
 * and a run that proceeded is proven only against an asserted zero **and** a
 * stage table every row of which reads `ran`. There is no branch here that
 * reaches `proven` without reading a number, and none that reaches it without
 * reading the stages: the harness (`intervention-count.ts`) and the corpus
 * conformance admission path both hold that second bar, and a report weaker
 * than either of them is the surface a proven count would inflate through.
 */
export function applyInterventionRule(record: CoverageRunRecord): CoverageApplicationRow {
	const base = {
		id: record.id,
		application: record.application,
		framework: record.framework,
		provenanceOfStatus: 'run-record' as const,
	};
	if (record.outcome === 'refused')
		return Object.freeze({
			...base,
			status: 'refused' as const,
			refusalCode: record.refusal?.code ?? 'refusal-code-not-recorded',
			...interventionField(record),
		});
	if (record.outcome !== 'proceeded')
		return Object.freeze({
			...base,
			status: 'not-admitted' as const,
			statusReason: `run-did-not-proceed:${record.outcome}`,
			...interventionField(record),
		});
	const count = record.interventions?.count;
	if (typeof count !== 'number')
		return Object.freeze({
			...base,
			status: 'not-admitted' as const,
			statusReason: INTERVENTION_COUNT_NOT_ASSERTED,
			interventionCount: 'not-asserted' as const,
		});
	if (count !== 0)
		return Object.freeze({
			...base,
			status: 'not-admitted' as const,
			statusReason: INTERVENTION_COUNT_NOT_ZERO,
			interventionCount: count,
		});
	const stages = record.stages ?? [];
	if (stages.length === 0 || !stages.every((stage) => stage.status === 'ran'))
		return Object.freeze({
			...base,
			status: 'not-admitted' as const,
			statusReason: STAGES_NOT_ALL_RAN,
			interventionCount: 0,
			stages: [...stages],
		});
	/**
	 * The same source reading the corpus admits on, applied here so the two
	 * surfaces cannot disagree: a run whose record states no repository, ref,
	 * revision, licence identifier or licence digest is not a proven row on one
	 * document and an absent row on the other. The refusal names the field.
	 */
	const derived = runRecordSource(record);
	if (derived.source === null)
		return Object.freeze({
			...base,
			status: 'not-admitted' as const,
			statusReason: derived.statusReason,
			interventionCount: 0,
			stages: [...stages],
		});
	return Object.freeze({
		...base,
		status: 'proven' as const,
		interventionCount: 0,
		stages: [...stages],
	});
}

const interventionField = (
	record: CoverageRunRecord,
): { interventionCount: number | 'not-asserted' } => ({
	interventionCount:
		typeof record.interventions?.count === 'number'
			? record.interventions.count
			: 'not-asserted',
});

/** The sealed rows: counted cells, holdouts, demotions — each off the matrix. */
function sealedRows(matrix: EnterpriseSupportMatrix): CoverageApplicationRow[] {
	const rows: CoverageApplicationRow[] = [];
	for (const lineage of Object.keys(matrix.counted).sort()) {
		const counted = matrix.counted[lineage];
		if (counted === undefined) continue;
		for (const cell of counted.cells)
			rows.push(
				Object.freeze({
					id: cell.cell,
					application: cell.application,
					framework: cell.lineage,
					status: 'proven' as const,
					provenanceOfStatus: 'sealed-receipts' as const,
					acceptance: cell.acceptance,
					witnessReceipt: cell.witnessReceipt,
				}),
			);
	}
	for (const holdout of matrix.holdouts)
		rows.push(
			Object.freeze({
				id: holdout.id,
				application: holdout.application,
				framework: holdout.lineage,
				status: 'bounded' as const,
				provenanceOfStatus: 'sealed-receipts' as const,
				boundedOutcome: holdout.outcome,
				countingNote: holdout.countingNote,
			}),
		);
	for (const demoted of matrix.demoted)
		rows.push(
			Object.freeze({
				id: demoted.cell,
				application: demoted.cell,
				framework: demoted.lineage,
				status: 'not-admitted' as const,
				provenanceOfStatus: 'sealed-receipts' as const,
				statusReason: demoted.reason,
			}),
		);
	return rows;
}

const censusByCode = (census: Record<string, unknown>): Record<string, number> => {
	const entries = census.entries;
	if (!Array.isArray(entries)) throw new Error('The refusal census carries no entries');
	const tally: Record<string, number> = {};
	for (const value of entries) {
		const entry = asRecord(value, 'refusal census entry');
		const code = asString(entry.code, 'refusal census code');
		tally[code] = (tally[code] ?? 0) + 1;
	}
	return tally;
};

const NOT_ESTABLISHED: readonly string[] = Object.freeze([
	'A row recorded `proven` states that the Judge counted that cell off a witness receipt under the frozen adapter. It is not a statement about the application outside the cell, about a later revision of it, or about any application not listed.',
	'A row recorded `proven` with `provenanceOfStatus: run-record` states a pipeline proof and nothing wider: the command ran unattended, the out-of-band harness counted zero interventions, and every stage in the table it carries read `ran`. No Judge counted a matrix cell from it, it is not counted in any lineage numerator, and the source it names is the one its own run record pinned.',
	'A row recorded `bounded` carries its outcome string verbatim because the outcome is bounded to the surface named in it. Restating it as a whole-application result is the failure this document is guarded against.',
	'A row recorded `not-admitted` was not proven by this record. Nothing here establishes that it would fail; it establishes only that no receipt in this package counts it.',
	'The refusal census enumerates refusal *sites* in the operator and frozen-adapter sources. It is a census of what the code can refuse, not a tally of what any run refused.',
	'The capability figures count enumerated capabilities against the cross-proven threshold. A capability outside the matrix is untested rather than known-absent.',
	'This document is not certification. It establishes hash integrity only; authenticity is not established, and no SLSA level is claimed.',
]);

export function buildCoverageReport(inputs: CoverageReportInputs): CoverageReport {
	const { matrix, capabilityCoverage, refusalCensus } = inputs;
	const rows = [...sealedRows(matrix), ...inputs.runRecords.map(applyInterventionRule)];
	const counted: Record<string, { ready: number; total: number }> = {};
	for (const lineage of Object.keys(matrix.counted).sort()) {
		const cell = matrix.counted[lineage];
		if (cell !== undefined) counted[lineage] = { ready: cell.ready, total: cell.total };
	}
	const totals = {
		applications: rows.length,
		proven: rows.filter((row) => row.status === 'proven').length,
		bounded: rows.filter((row) => row.status === 'bounded').length,
		refused: rows.filter((row) => row.status === 'refused').length,
		'not-admitted': rows.filter((row) => row.status === 'not-admitted').length,
	};
	const census = asRecord(refusalCensus, 'refusal census');
	const report: CoverageReport = {
		schemaVersion: COVERAGE_REPORT_SCHEMA,
		purpose:
			'What the fleet pipeline proved, per application, against the sealed baseline it was proved on. Every figure is read off the support matrix the trust package already derives and verifies; nothing is counted a second time here.',
		derivation: matrix.derivation,
		certification: {
			state: 'not-certified',
			assurance:
				'This report is evidence, not certification, legal assurance, or an attestation of any kind.',
			integrity: 'hash-only; authenticity is not established',
			slsaLevel: 'not-claimed',
		},
		sealedBaseline: {
			counted,
			demoted: matrix.demoted,
			capabilities: {
				total: matrix.outOfMatrixCapabilities.total,
				crossProven: matrix.outOfMatrixCapabilities.crossProven,
				experimental: matrix.outOfMatrixCapabilities.experimental,
				crossProvenThreshold: capabilityCoverage.crossProvenThreshold,
				note: matrix.outOfMatrixCapabilities.note,
			},
			boundaryPrevalence: {
				published: matrix.boundaryPrevalence.published,
				statement: matrix.boundaryPrevalence.statement,
				populationStatement: matrix.boundaryPrevalence.populationStatement,
			},
			trancheTwoCommitment: matrix.trancheTwoCommitment,
		},
		applications: rows,
		totals,
		refusalCensus: {
			source: REFUSAL_CENSUS_PATH,
			adapterFreezeComposite: asString(
				census.adapterFreezeComposite,
				'refusal census freeze composite',
			),
			totals: asRecord(census.summary, 'refusal census summary'),
			byCode: censusByCode(census),
		},
		interventionRule: { applied: true, statement: INTERVENTION_RULE_STATEMENT },
		notEstablished: NOT_ESTABLISHED,
		integrity: {
			algorithm: 'sha256',
			canonicalDigest: '',
			authenticity: 'not-established',
			certification: 'not-claimed',
		},
	};
	return {
		...report,
		integrity: { ...report.integrity, canonicalDigest: sha256(canonicalize(report)) },
	};
}

/** Recompute the digest a published report carries, over the same shape. */
export function coverageReportDigest(report: CoverageReport): string {
	return sha256(
		canonicalize({ ...report, integrity: { ...report.integrity, canonicalDigest: '' } }),
	);
}

const detailOf = (row: CoverageApplicationRow): string =>
	row.boundedOutcome ??
	row.refusalCode ??
	row.statusReason ??
	row.acceptance ??
	'no further detail is recorded';

const rowLine = (row: CoverageApplicationRow): string =>
	`| \`${row.id}\` | ${row.application} | ${row.framework} | **${row.status}** | ${row.provenanceOfStatus} | ${
		row.interventionCount === undefined ? 'not-applicable' : String(row.interventionCount)
	} | ${detailOf(row)} |`;

/**
 * The human rendering, which is the artifact a reader actually reads.
 *
 * It terminates in the enterprise honesty guard rather than being trusted from
 * how it was written: a bounded outcome restated generally, a dropped prevalence
 * figure, or blanket-support vocabulary throws here.
 */
export function renderCoverageReport(report: CoverageReport): string {
	const baseline = report.sealedBaseline;
	const countedLines = Object.keys(baseline.counted)
		.sort()
		.map((lineage) => {
			const cell = baseline.counted[lineage];
			return `- ${lineage}: **${String(cell?.ready ?? 0)} counted of ${String(cell?.total ?? 0)}** proven cells`;
		})
		.join('\n');
	const runRows = report.applications.filter((row) => row.provenanceOfStatus === 'run-record');
	const text = `# Versionless coverage report

${report.purpose}

- Schema: \`${report.schemaVersion}\`
- Certification state: **${report.certification.state ?? 'unknown'}**
- Canonical SHA-256: \`${report.integrity.canonicalDigest}\`
- Integrity: ${report.certification.integrity ?? ''}

${report.derivation}

## 1. The sealed baseline, as this report reads it

${countedLines}
- capabilities: **${String(baseline.capabilities.crossProven)} cross-proven** and ${String(baseline.capabilities.experimental)} experimental of ${String(baseline.capabilities.total)} enumerated capabilities, at a cross-proven threshold of ${String(baseline.capabilities.crossProvenThreshold)}

${baseline.capabilities.note}

### Demoted from a denominator

${baseline.demoted.map((entry) => `- \`${entry.cell}\` (${entry.lineage}): ${entry.reason}`).join('\n')}

## 2. Applications

| id | application | framework | status | provenance of status | intervention count | detail |
| --- | --- | --- | --- | --- | --- | --- |
${report.applications.map(rowLine).join('\n')}

Totals: ${String(report.totals.proven)} proven, ${String(report.totals.bounded)} bounded, ${String(report.totals.refused)} refused, ${String(report.totals['not-admitted'])} not-admitted, of ${String(report.totals.applications)} rows.

### Counting notes carried by the bounded rows

${report.applications
	.filter((row) => row.countingNote !== undefined)
	.map((row) => `- \`${row.id}\`: ${row.countingNote ?? ''}`)
	.join('\n')}

## 3. The intervention rule

${report.interventionRule.statement}

${
	runRows.length === 0
		? 'No application in this report has a status derived from a `versionless run` record. Every row above was decided on sealed receipts, so the rule changed no status in this emission — it governs the rows that arrive next.'
		: runRows
				.map(
					(row) =>
						`- \`${row.id}\`: ${row.status} — intervention count ${String(row.interventionCount ?? 'not-asserted')}${row.statusReason === undefined ? '' : ` (${row.statusReason})`}`,
				)
				.join('\n')
}

## 4. Boundary prevalence

- Published (**${baseline.boundaryPrevalence.published}**): ${baseline.boundaryPrevalence.statement}
- Population: ${baseline.boundaryPrevalence.populationStatement}
- Tranche two: ${baseline.trancheTwoCommitment}

## 5. Refusal census

Source: \`${report.refusalCensus.source}\`, taken under adapter freeze composite \`${report.refusalCensus.adapterFreezeComposite}\`.

${Object.keys(report.refusalCensus.totals)
	.sort()
	.map((key) => `- \`${key}\`: ${JSON.stringify(report.refusalCensus.totals[key])}`)
	.join('\n')}

### Sites per code

${Object.keys(report.refusalCensus.byCode)
	.sort()
	.map((code) => `- \`${code}\`: ${String(report.refusalCensus.byCode[code])}`)
	.join('\n')}

## 6. What this does not establish

${report.notEstablished.map((line) => `- ${line}`).join('\n')}
`;
	assertEnterpriseSurfaceHonesty(text, COVERAGE_REPORT_MARKDOWN);
	return text;
}

/**
 * Read the `versionless run` records on disk, in a stable order.
 *
 * A run record is a file with the run schema filed beside the run it records.
 * There are none today, and that is the honest reading rather than a gap: no
 * application in this package was admitted through `run`.
 */
/**
 * The count the out-of-band harness observed for this run, or `null`.
 *
 * `null` is the honest reading when no harness record is filed beside the run:
 * the rule above then has no measured zero to admit, which is the state it
 * calls `intervention-count-not-asserted`. A record carrying the wrong schema
 * or a non-numeric count is read the same way — an unreadable count is not a
 * count. This reader takes only the number; the classification, the named
 * paths and the invocation ledger stay in the harness record.
 */
export async function readInterventionCount(directory: string): Promise<number | null> {
	return (await readInterventionRecord(directory))?.interventionCount ?? null;
}

/**
 * The whole harness reading, for callers that need more than the number.
 *
 * The corpus conformance admission path needs three facts about a run and not
 * one: which file carried the count (so the admitted row can name its basis),
 * the count itself, and the terminal classification the harness computed. They
 * are read here together because they were written together; splitting the read
 * would let a row cite a count from one record and a classification from
 * another.
 */
export interface InterventionRecordReading {
	/** The harness record's filename, relative to the run directory. */
	readonly file: string;
	readonly interventionCount: number;
	/** The classification the harness recorded, or `null` when it recorded none. */
	readonly terminalClassification: string | null;
}

export async function readInterventionRecord(
	directory: string,
): Promise<InterventionRecordReading | null> {
	for (const file of INTERVENTION_RECORD_FILES) {
		let body: string;
		try {
			body = await readFile(path.join(directory, file), 'utf8');
		} catch {
			continue;
		}
		let parsed: unknown;
		try {
			parsed = JSON.parse(body);
		} catch {
			continue;
		}
		const record = asRecord(parsed, 'intervention count record');
		if (record.schemaVersion !== INTERVENTION_RECORD_SCHEMA) continue;
		if (typeof record.interventionCount !== 'number') continue;
		return Object.freeze({
			file,
			interventionCount: record.interventionCount,
			terminalClassification:
				typeof record.terminalClassification === 'string'
					? record.terminalClassification
					: null,
		});
	}
	return null;
}

/** The stage rows a run states about itself, or `undefined` when it states none. */
function runStages(
	value: unknown,
): readonly { readonly name: string; readonly status: string }[] | undefined {
	if (!Array.isArray(value)) return undefined;
	return Object.freeze(
		value.map((entry) => {
			/**
			 * An unreadable stage row is carried as one that did not run rather
			 * than thrown on: this reader's job is to report what a run states,
			 * and a run that states a stage badly has not stated that it ran.
			 */
			const stage: Record<string, unknown> =
				typeof entry === 'object' && entry !== null
					? (entry as Record<string, unknown>)
					: {};
			return Object.freeze({
				name: typeof stage.name === 'string' ? stage.name : 'not-recorded',
				status: typeof stage.status === 'string' ? stage.status : 'not-recorded',
			});
		}),
	);
}

export async function readRunRecords(root: string): Promise<readonly CoverageRunRecord[]> {
	const runsRoot = path.join(root, RUN_RECORD_ROOT);
	let directories: string[];
	try {
		directories = (await readdir(runsRoot, { withFileTypes: true }))
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name)
			.sort();
	} catch {
		return Object.freeze([]);
	}
	const records: CoverageRunRecord[] = [];
	for (const directory of directories) {
		let body: string;
		try {
			body = await readFile(path.join(runsRoot, directory, RUN_RECORD_FILE), 'utf8');
		} catch {
			continue;
		}
		const record = asRecord(JSON.parse(body), 'run record');
		if (record.schema !== 'versionless.run.v1') continue;
		const harness = await readInterventionRecord(path.join(runsRoot, directory));
		const harnessCount = harness === null ? null : harness.interventionCount;
		const interventions =
			harnessCount !== null
				? { count: harnessCount }
				: typeof record.interventions === 'object' && record.interventions !== null
					? asRecord(record.interventions, 'run record interventions')
					: undefined;
		records.push(
			Object.freeze({
				id: directory,
				application: asString(record.application, 'run record application'),
				framework: typeof record.lineage === 'string' ? record.lineage : 'not-recorded',
				outcome: asString(record.outcome, 'run record outcome'),
				...(typeof record.refusal === 'object' && record.refusal !== null
					? {
							refusal: {
								code: String(asRecord(record.refusal, 'run refusal').code ?? ''),
							},
						}
					: {}),
				...(interventions === undefined
					? {}
					: {
							interventions: {
								...(typeof interventions.count === 'number'
									? { count: interventions.count }
									: {}),
							},
						}),
				...(runStages(record.stages) === undefined
					? {}
					: { stages: runStages(record.stages) }),
				...(runPin(record.stages) === undefined ? {} : { pin: runPin(record.stages) }),
				...(runLicence(record.stages) === undefined
					? {}
					: { licence: runLicence(record.stages) }),
				...(harness?.terminalClassification == null
					? {}
					: { terminalClassification: harness.terminalClassification }),
				runRecordPath: path.join(RUN_RECORD_ROOT, directory, RUN_RECORD_FILE),
				...(harness === null
					? {}
					: {
							interventionRecordPath: path.join(
								RUN_RECORD_ROOT,
								directory,
								harness.file,
							),
						}),
			}),
		);
	}
	return Object.freeze(records);
}

/**
 * Refuses a published coverage pair that was edited rather than derived.
 *
 * The comparison lives here rather than in the operator flow that calls it for
 * two reasons: it is the same comparison the trust verifier makes, so there is
 * one of it; and the operator directory is a censused refusal surface, where a
 * throw is a refusal site an operator can be handed rather than a re-derivation
 * mismatch a reviewer reads.
 */
export async function verifyPublishedCoverageSurfaces(
	output: string,
	derived: { report: CoverageReport; markdown: string },
): Promise<void> {
	const published = JSON.parse(
		await readFile(path.join(output, COVERAGE_REPORT_JSON), 'utf8'),
	) as unknown;
	if (canonicalize(published) !== canonicalize(derived.report))
		throw new Error(
			`${COVERAGE_REPORT_JSON} does not match independent re-derivation from the canonical receipts`,
		);
	if ((await readFile(path.join(output, COVERAGE_REPORT_MARKDOWN), 'utf8')) !== derived.markdown)
		throw new Error(
			`${COVERAGE_REPORT_MARKDOWN} does not match independent re-derivation from the canonical receipts`,
		);
}

export interface CoverageSurfaceInputs {
	readonly root: string;
	readonly output: string;
	readonly matrix: EnterpriseSupportMatrix;
	readonly capabilityCoverage: CapabilityCoverage;
}

/** Derive both coverage surfaces from the verified matrix and the receipts. */
export async function deriveCoverageSurfaces(
	inputs: CoverageSurfaceInputs,
): Promise<{ report: CoverageReport; markdown: string }> {
	const refusalCensus = asRecord(
		JSON.parse(await readFile(path.join(inputs.root, REFUSAL_CENSUS_PATH), 'utf8')),
		'refusal census',
	);
	const report = buildCoverageReport({
		matrix: inputs.matrix,
		capabilityCoverage: inputs.capabilityCoverage,
		refusalCensus,
		runRecords: await readRunRecords(inputs.root),
	});
	return { report, markdown: renderCoverageReport(report) };
}
