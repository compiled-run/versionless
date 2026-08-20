/**
 * The seam between a filed `versionless run` and the corpus that may admit it.
 *
 * `readRunRecords` already decided the count question; what it now also carries
 * is the evidence a corpus row has to cite — the stages the run reached, the
 * classification the out-of-band harness reached, and the two paths those came
 * from. This test walks a real directory rather than a hand-built object so the
 * admission cannot pass on a shape no reader produces.
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import { deriveRunRecordApplications } from '../../core/src/corpus/conformance.ts';
import {
	applyInterventionRule,
	provenBoundedness,
	readInterventionRecord,
	readRunRecords,
} from '../src/coverage-report.ts';

describe('run records as corpus admission evidence', () => {
	it('carries stages, classification and basis paths through to an admitted row', async () => {
		const checkout = await mkdtemp(path.join(tmpdir(), 'versionless-corpus-admission-'));
		try {
			const directory = path.join(checkout, 'evidence/runs/unseen-application');
			await mkdir(directory, { recursive: true });
			await writeFile(
				path.join(directory, 'run-record.json'),
				`${JSON.stringify({
					schema: 'versionless.run.v1',
					application: 'unseen-application',
					lineage: 'react',
					outcome: 'proceeded',
					/**
					 * The ingest and licence stages carry the records they write,
					 * because a row that cannot say where its application came
					 * from is not admitted however clean its run was.
					 */
					stages: [
						{
							name: 'ingest',
							status: 'ran',
							record: {
								pin: {
									repository: 'acme/unseen-application',
									ref: 'refs/tags/v1.0.0',
									commitSha: '069b6690d9fa7a24a6e7727386ab85148c89b90e',
								},
							},
						},
						{
							name: 'license-at-pin',
							status: 'ran',
							record: {
								identifier: 'MIT',
								artifacts: [
									{
										role: 'repository-root-licence',
										sha256: 'fbfe10674aef1e0bf084850644879fa4114d8a98debc5fb8e680f295af169d43',
									},
								],
							},
						},
						{ name: 'plan', status: 'ran' },
					],
				})}\n`,
			);
			await writeFile(
				path.join(directory, 'intervention-count.json'),
				`${JSON.stringify({
					schemaVersion: 'versionless.intervention-count.v1',
					interventionCount: 0,
					terminalClassification: 'proven',
				})}\n`,
			);
			const records = await readRunRecords(checkout);
			expect(records).toHaveLength(1);
			expect(records[0]?.stages).toEqual([
				{ name: 'ingest', status: 'ran' },
				{ name: 'license-at-pin', status: 'ran' },
				{ name: 'plan', status: 'ran' },
			]);
			expect(records[0]?.pin).toEqual({
				repository: 'acme/unseen-application',
				ref: 'refs/tags/v1.0.0',
				commitSha: '069b6690d9fa7a24a6e7727386ab85148c89b90e',
			});
			expect(records[0]?.licence).toEqual({
				identifier: 'MIT',
				artifactSha256: 'fbfe10674aef1e0bf084850644879fa4114d8a98debc5fb8e680f295af169d43',
			});
			expect(records[0]?.terminalClassification).toBe('proven');
			expect(records[0]?.runRecordPath).toBe(
				'evidence/runs/unseen-application/run-record.json',
			);
			expect(records[0]?.interventionRecordPath).toBe(
				'evidence/runs/unseen-application/intervention-count.json',
			);
			expect(await readInterventionRecord(directory)).toEqual({
				file: 'intervention-count.json',
				interventionCount: 0,
				terminalClassification: 'proven',
			});
			const derived = deriveRunRecordApplications(records);
			expect(derived).toHaveLength(1);
			expect(derived[0]).toMatchObject({
				id: 'unseen-application',
				provenanceOfStatus: 'run-record',
				verticals: ['unseen-application'],
				source: {
					repository: 'acme/unseen-application',
					ref: 'refs/tags/v1.0.0',
					revision: '069b6690d9fa7a24a6e7727386ab85148c89b90e',
					license: 'MIT',
					basis: 'run-record',
					basisPath: 'evidence/runs/unseen-application/run-record.json',
				},
			});
		} finally {
			await rm(checkout, { recursive: true, force: true });
		}
	});

	it('admits nothing when the harness recorded no classification', async () => {
		const checkout = await mkdtemp(path.join(tmpdir(), 'versionless-corpus-admission-'));
		try {
			const directory = path.join(checkout, 'evidence/runs/run-unclassified');
			await mkdir(directory, { recursive: true });
			await writeFile(
				path.join(directory, 'run-record.json'),
				`${JSON.stringify({
					schema: 'versionless.run.v1',
					application: 'unclassified-application',
					lineage: 'react',
					outcome: 'proceeded',
					stages: [{ name: 'ingest', status: 'ran' }],
				})}\n`,
			);
			await writeFile(
				path.join(directory, 'intervention-count.json'),
				`${JSON.stringify({
					schemaVersion: 'versionless.intervention-count.v1',
					interventionCount: 0,
				})}\n`,
			);
			const records = await readRunRecords(checkout);
			expect(records[0]?.terminalClassification).toBeUndefined();
			expect(deriveRunRecordApplications(records)).toEqual([]);
		} finally {
			await rm(checkout, { recursive: true, force: true });
		}
	});
});

/**
 * The honesty surface of a run-record row: what it publishes about where the
 * application came from, what bounds the proof, and which lineage it detected.
 *
 * Each leg reads the field out of a record on disk rather than a hand-built
 * row, because the defect these close was exactly a reader that had the fact in
 * hand and published a row without it.
 */
describe('what a run-record row publishes about its own proof', () => {
	const record = (stages: unknown[]): Record<string, unknown> => ({
		schema: 'versionless.run.v1',
		application: '.versionless/work/an-application/baseline',
		outcome: 'proceeded',
		stages,
	});

	const sourceStages = [
		{
			name: 'analyze',
			status: 'ran',
			record: { lineage: 'react', builder: 'react-scripts' },
		},
		{
			name: 'ingest',
			status: 'ran',
			record: {
				pin: {
					repository: 'acme/an-application',
					ref: 'refs/tags/v2.4.0',
					commitSha: '069b6690d9fa7a24a6e7727386ab85148c89b90e',
				},
			},
		},
		{
			name: 'license-at-pin',
			status: 'ran',
			record: {
				identifier: 'MIT',
				artifacts: [
					{
						role: 'repository-root-licence',
						sha256: 'fbfe10674aef1e0bf084850644879fa4114d8a98debc5fb8e680f295af169d43',
					},
				],
			},
		},
	];

	const readOne = async (stages: unknown[]) => {
		const checkout = await mkdtemp(path.join(tmpdir(), 'versionless-run-row-'));
		const directory = path.join(checkout, 'evidence/runs/an-application');
		await mkdir(directory, { recursive: true });
		await writeFile(
			path.join(directory, 'run-record.json'),
			`${JSON.stringify(record(stages))}\n`,
		);
		await writeFile(
			path.join(directory, 'intervention-count.json'),
			`${JSON.stringify({
				schemaVersion: 'versionless.intervention-count.v1',
				interventionCount: 0,
				terminalClassification: 'proven',
			})}\n`,
		);
		try {
			const [reading] = await readRunRecords(checkout);
			if (reading === undefined) throw new Error('no run record was read');
			return reading;
		} finally {
			await rm(checkout, { recursive: true, force: true });
		}
	};

	it('reads the framework off the analyze stage the record already carries', async () => {
		const reading = await readOne(sourceStages);
		expect(reading.framework).toBe('react');
		expect(applyInterventionRule({ ...reading, stages: [] }).framework).toBe('react');
	});

	it('publishes the source block the proven decision was taken on', async () => {
		const reading = await readOne([
			...sourceStages,
			{ name: 'era-cell', status: 'ran' },
			{ name: 'plan', status: 'ran' },
			{ name: 'apply', status: 'ran' },
			{ name: 'install', status: 'ran' },
			{ name: 'build', status: 'ran' },
			{ name: 'witness', status: 'ran' },
		]);
		const row = applyInterventionRule(reading);
		expect(row.status).toBe('proven');
		expect(row.source).toMatchObject({
			repository: 'acme/an-application',
			ref: 'refs/tags/v2.4.0',
			license: 'MIT',
			basis: 'run-record',
		});
	});

	it('states a bound it cannot measure as absent rather than as a zero', async () => {
		const reading = await readOne([
			...sourceStages,
			{
				name: 'install',
				status: 'ran',
				record: {
					policy: { allowInstallScripts: true },
					installScriptPackages: ['node_modules/core-js', 'node_modules/fsevents'],
				},
			},
			{ name: 'witness', status: 'ran', record: { ran: true, journeysRun: 1 } },
		]);
		expect(reading.installScripts).toMatchObject({
			policyDeclared: true,
			lockfileDeclaredPackages: 2,
			ran: 'not-recorded',
			skipped: 'not-recorded',
		});
		expect(reading.witness).toMatchObject({
			journeysRun: 1,
			routesDeclared: 'not-recorded',
			routesReached: 'not-recorded',
		});
		const bounds = provenBoundedness(reading);
		expect(bounds.join('\n')).toContain('2 package(s)');
		expect(bounds.join('\n')).toContain('records no reading of which of them npm started');
		expect(bounds.join('\n')).toContain('carries no per-journey route reading');
	});

	it('states the measured bound once the record carries the readings', async () => {
		const reading = await readOne([
			...sourceStages,
			{
				name: 'install',
				status: 'ran',
				record: {
					policy: { allowInstallScripts: true },
					installScriptPackages: ['node_modules/core-js', 'node_modules/fsevents'],
					installScripts: {
						ran: ['node_modules/core-js'],
						skipped: [{ package: 'node_modules/fsevents' }],
					},
				},
			},
			{
				name: 'witness',
				status: 'ran',
				record: {
					ran: true,
					journeysRun: 1,
					journeys: [
						{
							lane: 'migrated',
							name: 'bounded crawl',
							routesDeclared: 12,
							routesReached: 1,
							outcomes: ['journey-measured-route-reached-1-of-12-declared-routes'],
						},
					],
					locality: { mode: 'offline', successfulNonLoopback: 0 },
				},
			},
		]);
		expect(reading.installScripts).toMatchObject({ ran: 1, skipped: 1 });
		expect(reading.witness).toMatchObject({ routesDeclared: 12, routesReached: 1 });
		const bounds = provenBoundedness(reading).join('\n');
		expect(bounds).toContain('starting 1 script(s) and skipping 1 by policy');
		expect(bounds).toContain('reaching 1 of 12 declared route(s)');
	});
});
