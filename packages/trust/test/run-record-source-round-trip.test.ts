/**
 * Where a run-record-derived application says it came from, and who agrees.
 *
 * Two claims, and the second is the one this seam was closed for. First, the
 * source block on a derived row is a function of the run record alone: five
 * fields read off the record under adjudication, no second document opened, and
 * an absent field refused by name rather than filled with a plausible value —
 * a row that cannot say where its application came from is not admitted beside
 * twelve rows that each can.
 *
 * Second, the generator and the verifier are handed the same two inputs. The
 * trust package emits a corpus derived from the corpus source *and* the filed
 * run records; a verifier that re-derived from the source alone was comparing a
 * thirteen-application corpus against a twelve-application one and calling the
 * missing row a mismatch. The round trip below is that comparison done right:
 * the same reading, twice, byte-identical, and equal to the published file.
 */
import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	analyzeCorpusConformance,
	type CorpusRunRecordReading,
	RUN_RECORD_SOURCE_INCOMPLETE,
	runRecordSource,
} from '../../core/src/corpus/conformance.ts';
import { canonicalize } from '../../core/src/receipts/canonicalize.ts';
import { readRunRecords } from '../src/coverage-report.ts';

const root = path.resolve(import.meta.dirname, '../../..');

/** A run record that states every field a source block is derived from. */
const sourced = (overrides: Partial<CorpusRunRecordReading> = {}): CorpusRunRecordReading => ({
	id: 'react-widget-v1',
	application: 'widget',
	framework: 'react',
	terminalClassification: 'proven',
	interventions: { count: 0 },
	stages: [{ name: 'ingest', status: 'ran' }],
	runRecordPath: 'evidence/runs/react-widget-v1/run-record.json',
	pin: {
		repository: 'acme/widget',
		ref: 'refs/tags/v1.0.0',
		commitSha: '069b6690d9fa7a24a6e7727386ab85148c89b90e',
	},
	licence: {
		identifier: 'MIT',
		artifactSha256: 'fbfe10674aef1e0bf084850644879fa4114d8a98debc5fb8e680f295af169d43',
	},
	...overrides,
});

describe('runRecordSource — the source block a run record states about itself', () => {
	it('derives every field from the record alone, and names the basis it read', () => {
		const derived = runRecordSource(sourced());
		expect(derived.statusReason).toBeNull();
		expect(derived.source).toEqual({
			repository: 'acme/widget',
			ref: 'refs/tags/v1.0.0',
			revision: '069b6690d9fa7a24a6e7727386ab85148c89b90e',
			license: 'MIT',
			licenseSha256: 'fbfe10674aef1e0bf084850644879fa4114d8a98debc5fb8e680f295af169d43',
			/** Not `sealed-corpus`: this row was not written into the source. */
			basis: 'run-record',
			basisPath: 'evidence/runs/react-widget-v1/run-record.json',
		});
	});

	/**
	 * One case per field, and the refusal names which one was missing.
	 *
	 * A single `run-record-states-no-source` would tell an operator that the row
	 * was refused and nothing about what to fix. The field is in the code, so
	 * the refusal census can count the five apart and a reader of one refusal
	 * knows whether to re-run the ingest stage or the licence-at-pin stage.
	 */
	const missing: ReadonlyArray<readonly [string, Partial<CorpusRunRecordReading>]> = [
		['pin.repository', { pin: { ref: 'refs/tags/v1.0.0', commitSha: 'a'.repeat(40) } }],
		['pin.ref', { pin: { repository: 'acme/widget', commitSha: 'a'.repeat(40) } }],
		['pin.commitSha', { pin: { repository: 'acme/widget', ref: 'refs/tags/v1.0.0' } }],
		['licenceAtPin.identifier', { licence: { artifactSha256: 'b'.repeat(64) } }],
		['licenceAtPin.artifactSha256', { licence: { identifier: 'MIT' } }],
	];

	for (const [field, overrides] of missing)
		it(`refuses by name when ${field} is not stated`, () => {
			const derived = runRecordSource(sourced(overrides));
			expect(derived.source).toBeNull();
			expect(derived.statusReason).toBe(`${RUN_RECORD_SOURCE_INCOMPLETE}:${field}`);
			expect(derived.statusReason).toBe(`run-record-states-no-source:${field}`);
		});

	it('refuses a record that states no pin and no licence at all, by the first field', () => {
		const derived = runRecordSource(sourced({ pin: undefined, licence: undefined }));
		expect(derived.source).toBeNull();
		expect(derived.statusReason).toBe('run-record-states-no-source:pin.repository');
	});

	it('reads a blank string as an absence rather than as a stated value', () => {
		const derived = runRecordSource(
			sourced({ pin: { repository: '   ', ref: 'refs/heads/main', commitSha: 'a'.repeat(40) } }),
		);
		expect(derived.statusReason).toBe('run-record-states-no-source:pin.repository');
	});
});

describe('a run-record row round-trips generate → verify', () => {
	it('re-derives byte-identically when both sides read the same run records', async () => {
		/** The one reading both `generate.ts` and `verify.ts` now make. */
		const runRecords = await readRunRecords(root);
		const emitted = await analyzeCorpusConformance({ rootDir: root, runRecords });
		const rederived = await analyzeCorpusConformance({ rootDir: root, runRecords });
		expect(canonicalize(rederived)).toBe(canonicalize(emitted));
		/**
		 * And it equals the published package, which is the assertion the trust
		 * verifier makes. A generator handed the run records and a verifier
		 * handed none disagree here by exactly the derived rows.
		 */
		const published = await readFile(
			path.join(root, 'evidence/trust/current/corpus-conformance.json'),
			'utf8',
		);
		expect(`${JSON.stringify(emitted, null, 2)}\n`).toBe(published);
	});

	it('disagrees by exactly the derived rows when only one side is given them', async () => {
		const runRecords = await readRunRecords(root);
		const withRecords = await analyzeCorpusConformance({ rootDir: root, runRecords });
		const withoutRecords = await analyzeCorpusConformance({ rootDir: root, runRecords: [] });
		const derivedRows = withRecords.applications.filter(
			(row) => row.provenanceOfStatus === 'run-record',
		);
		expect(derivedRows.length).toBeGreaterThan(0);
		expect(withoutRecords.applications).toHaveLength(
			withRecords.applications.length - derivedRows.length,
		);
		expect(withoutRecords.summary.sourceApplications).toBe(
			withRecords.summary.sourceApplications - derivedRows.length,
		);
		/** Only the applications move: the sealed verticals are untouched. */
		expect(withoutRecords.verticals).toHaveLength(withRecords.verticals.length);
		expect(canonicalize(withoutRecords.applications)).not.toBe(
			canonicalize(withRecords.applications),
		);
		/** Every derived row states its source; that is the admission bar. */
		for (const row of derivedRows)
			expect(row.source).toMatchObject({ basis: 'run-record' });
	});
});
