/**
 * The derived admission path, and the sealed corpus it must not disturb.
 *
 * Two properties are asserted here and they pull against each other on purpose.
 * With no run record filed, the corpus this builder emits has to be the
 * published `corpus-conformance.json` byte for byte — the eighteen sealed
 * transaction members are historical assertions and opening the summary types
 * is not licence to move one of them. With a clean run record filed, the same
 * builder has to admit an application nobody wrote into this source file, which
 * is the whole point of removing the literal unions.
 */
import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	analyzeCorpusConformance,
	assertCorpusSummaryDerived,
	type CorpusRunRecordReading,
	deriveRunRecordApplications,
	verifyCorpusConformanceDigest,
} from '../src/corpus/conformance.ts';

const root = path.resolve(import.meta.dirname, '../../..');

/**
 * A run the harness classified proven, measured at zero, every stage run — and
 * which states where its application came from.
 *
 * The pin and the licence reading are part of the fixture rather than an extra
 * on it: a run record that names no repository, ref, revision or licence is not
 * admitted at all, so a fixture without them would be testing the refusal path
 * while claiming to test the admission one.
 */
const provenRunRecord = (
	overrides: Partial<CorpusRunRecordReading> = {},
): CorpusRunRecordReading => ({
	id: 'unseen-application',
	application: 'unseen-application',
	framework: 'react',
	terminalClassification: 'proven',
	interventions: { count: 0 },
	stages: [
		{ name: 'ingest', status: 'ran' },
		{ name: 'plan', status: 'ran' },
	],
	runRecordPath: 'evidence/runs/unseen-application/run-record.json',
	interventionRecordPath: 'evidence/runs/unseen-application/intervention-count.json',
	pin: {
		repository: 'acme/unseen-application',
		ref: 'refs/tags/v1.0.0',
		commitSha: '069b6690d9fa7a24a6e7727386ab85148c89b90e',
	},
	licence: {
		identifier: 'MIT',
		artifactSha256: 'fbfe10674aef1e0bf084850644879fa4114d8a98debc5fb8e680f295af169d43',
	},
	...overrides,
});

describe('corpus conformance run-record admission', () => {
	/**
	 * With no run record filed, this builder is exactly the sealed corpus.
	 *
	 * The published file is no longer the whole oracle for this case, because a
	 * clean run has since been filed and the package carries the row it admits.
	 * What remains an oracle — and is the property this test exists for — is
	 * that every part of the published corpus that is *not* a run-record row is
	 * reproduced here unchanged: the twelve sealed applications byte for byte,
	 * the twenty verticals, the lanes and the coverage block. The eighteen
	 * sealed transaction members are historical assertions, and admitting a
	 * thirteenth application is not licence to move one of them.
	 */
	it('reproduces the sealed corpus exactly when no run record is filed', async () => {
		const result = await analyzeCorpusConformance({ rootDir: root, runRecords: [] });
		const published = JSON.parse(
			await readFile(
				path.join(root, 'evidence/trust/current/corpus-conformance.json'),
				'utf8',
			),
		) as typeof result;
		const sealedApplications = published.applications.filter(
			(row) => row.provenanceOfStatus !== 'run-record',
		);
		expect(JSON.stringify(result.applications, null, 2)).toBe(
			JSON.stringify(sealedApplications, null, 2),
		);
		expect(JSON.stringify(result.verticals, null, 2)).toBe(
			JSON.stringify(published.verticals, null, 2),
		);
		expect(JSON.stringify(result.frameworkLanes, null, 2)).toBe(
			JSON.stringify(published.frameworkLanes, null, 2),
		);
		expect(JSON.stringify(result.coverage, null, 2)).toBe(
			JSON.stringify(published.coverage, null, 2),
		);
		expect(verifyCorpusConformanceDigest(result)).toBe(result.integrity.canonicalDigest);
		expect(result.summary.sourceApplications).toBe(12);
		expect(result.summary.verticals).toBe(20);
		/** The published number is the sealed twelve plus the rows it admitted. */
		expect(published.summary.sourceApplications).toBe(
			12 + (published.applications.length - sealedApplications.length),
		);
	});

	it('counts the summary rather than declaring it', async () => {
		const result = await analyzeCorpusConformance({ rootDir: root });
		expect(result.summary.verticals).toBe(result.verticals.length);
		expect(result.summary.sourceApplications).toBe(result.applications.length);
		/** A summary edited to a number nobody counted fails re-derivation. */
		const edited = structuredClone(result);
		edited.summary.sourceApplications = 13;
		expect(() => assertCorpusSummaryDerived(edited)).toThrow(
			'summary sourceApplications is not the counted distinct applications',
		);
		const editedVerticals = structuredClone(result);
		editedVerticals.summary.verticals = 21;
		expect(() => assertCorpusSummaryDerived(editedVerticals)).toThrow(
			'summary verticals is not the counted vertical rows',
		);
	});

	it('admits one proven zero-intervention run beside the sealed rows', async () => {
		const result = await analyzeCorpusConformance({
			rootDir: root,
			runRecords: [provenRunRecord()],
		});
		expect(result.summary.sourceApplications).toBe(13);
		expect(result.applications).toHaveLength(13);
		expect(result.verticals).toHaveLength(20);
		/** The sealed rows stay first and stay themselves. */
		expect(result.applications.slice(0, 12).map((row) => row.id)).toEqual([
			'react-boilerplate',
			'angular-phonecat',
			'angular-realworld',
			'killedbygoogle',
			'papercups',
			'react-hospitalrun',
			'angular-factoriolab',
			'angular-jira-clone',
			'react-memos',
			'react-linkfree',
			'angular-tiny-translator',
			'angular-super-productivity',
		]);
		expect(result.applications[12]).toMatchObject({
			id: 'unseen-application',
			provenanceOfStatus: 'run-record',
			basis: {
				runRecord: 'evidence/runs/unseen-application/run-record.json',
				interventionRecord: 'evidence/runs/unseen-application/intervention-count.json',
			},
			/** The row states where the application came from, or it is not here. */
			source: {
				repository: 'acme/unseen-application',
				ref: 'refs/tags/v1.0.0',
				revision: '069b6690d9fa7a24a6e7727386ab85148c89b90e',
				license: 'MIT',
				basis: 'run-record',
				basisPath: 'evidence/runs/unseen-application/run-record.json',
			},
		});
		expect(verifyCorpusConformanceDigest(result)).toBe(result.integrity.canonicalDigest);
	});

	it('admits nothing from a run that was helped, refused, or left a stage unrun', () => {
		expect(
			deriveRunRecordApplications([provenRunRecord({ interventions: { count: 1 } })]),
		).toEqual([]);
		expect(
			deriveRunRecordApplications([provenRunRecord({ interventions: undefined })]),
		).toEqual([]);
		expect(
			deriveRunRecordApplications([
				provenRunRecord({
					terminalClassification: 'refused:ingest.revision-not-determined',
				}),
			]),
		).toEqual([]);
		expect(
			deriveRunRecordApplications([
				provenRunRecord({ terminalClassification: 'defect:stages-not-all-run' }),
			]),
		).toEqual([]);
		expect(
			deriveRunRecordApplications([
				provenRunRecord({
					stages: [
						{ name: 'ingest', status: 'ran' },
						{ name: 'build', status: 'not-reached' },
					],
				}),
			]),
		).toEqual([]);
		expect(deriveRunRecordApplications([provenRunRecord({ stages: [] })])).toEqual([]);
		expect(deriveRunRecordApplications([provenRunRecord({ stages: undefined })])).toEqual([]);
	});

	/**
	 * Rows are keyed by the identity the run record is filed under.
	 *
	 * Not by the free-text application name: `acquire` derived the evidence and
	 * lane directories from the identifier an operator declared, so that is the
	 * identity a corpus row is about, and two runs filed under one directory are
	 * one application however they each describe themselves. Ordering by that
	 * key is what keeps the emitted corpus independent of the order the run
	 * directory happened to be walked in.
	 */
	it('orders admitted rows by filed identity and never re-admits a sealed one', async () => {
		const derived = deriveRunRecordApplications([
			provenRunRecord({ id: 'zebra-app', application: 'Zebra' }),
			provenRunRecord({ id: 'alpha-app', application: 'Alpha' }),
			provenRunRecord({ id: 'alpha-app', application: 'Alpha, run again' }),
		]);
		expect(derived.map((row) => row.id)).toEqual(['alpha-app', 'zebra-app']);
		const result = await analyzeCorpusConformance({
			rootDir: root,
			runRecords: [provenRunRecord({ id: 'react-boilerplate' })],
		});
		expect(result.applications).toHaveLength(12);
		expect(result.summary.sourceApplications).toBe(12);
	});
});
