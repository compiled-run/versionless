import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import { sha256 } from '../../core/src/receipts/canonicalize.ts';
import { assertEnterpriseSurfaceHonesty } from '../../trust/src/enterprise.ts';
import {
	FLEET_BATCH_SCHEMA,
	assertFleetSummaryHonesty,
	harnessInvocationFor,
	inferApplicationId,
	parseManifest,
	publishStepsFor,
	readFleet,
	renderFleetSummary,
	runFleetBatch,
	runPublishChain,
	type BatchApplication,
	type HarnessOutcome,
	type PublishStep,
} from '../src/operator/batch.ts';
import { pipelineRefusalOf } from '../src/operator/refusals.ts';

/**
 * The batch is a loop over a list this command was handed, and every property
 * worth testing is about what the loop refuses to do: read its fleet from its
 * own source, run two applications at once, stop at a broken one, restate a
 * bounded outcome, or publish out of order.
 */

const COVERAGE_REPORT = path.resolve(
	path.dirname(new URL(import.meta.url).pathname),
	'../../../evidence/trust/current/coverage-report.json',
);

async function withTemporaryCwd<T>(run: (root: string) => Promise<T>): Promise<T> {
	const root = await mkdtemp(path.join(tmpdir(), 'versionless-batch-'));
	const previous = process.cwd();
	process.chdir(root);
	try {
		return await run(root);
	} finally {
		process.chdir(previous);
		await rm(root, { recursive: true, force: true });
	}
}

const countRecord = (
	classification: string,
	interventionCount = 0,
): Readonly<Record<string, unknown>> =>
	Object.freeze({
		schemaVersion: 'versionless.intervention-count.v1',
		flow: 'intervention-count',
		terminalClassification: classification,
		interventionCount,
		exitCode: classification === 'proven' ? 0 : 2,
	});

const outcome = (json: unknown, exitCode = 0): HarnessOutcome =>
	Object.freeze({ text: '', json, exitCode });

const application = (id: string): BatchApplication => Object.freeze({ id, root: `roots/${id}` });

const declarationsFor = (applications: readonly BatchApplication[], publish = false) =>
	({
		applications,
		laneRoot: 'lanes',
		forwarded: Object.freeze([]),
		name: 'batch-under-test',
		publish,
		root: process.cwd(),
		appsSource: Object.freeze(['fleet.txt']),
	}) as const;

describe('the fleet list', () => {
	it('is read from a manifest file and never from this command’s own source', async () => {
		await withTemporaryCwd(async (root) => {
			await mkdir(path.join(root, 'a'), { recursive: true });
			await mkdir(path.join(root, 'b'), { recursive: true });
			await writeFile(path.join(root, 'fleet.txt'), '# a comment\na\nb\n');
			const fleet = await readFleet(['fleet.txt']);
			expect(fleet.map((entry) => entry.id)).toEqual(['a', 'b']);
		});
	});

	it('reads a JSON manifest carrying roots, identifiers and frameworks', () => {
		const fleet = parseManifest(
			JSON.stringify({
				applications: [
					{ root: '.versionless/work/one/baseline', framework: 'react' },
					{ root: 'trees/two', id: 'declared-two' },
				],
			}),
			'fleet.json',
		);
		expect(fleet).toEqual([
			{ id: 'one', root: '.versionless/work/one/baseline', framework: 'react' },
			{ id: 'declared-two', root: 'trees/two' },
		]);
	});

	it('refuses by name when no fleet was declared, rather than falling back to a list', async () => {
		const refusal = await readFleet([]).then(
			() => null,
			(error: unknown) => pipelineRefusalOf(error),
		);
		expect(refusal?.code).toBe('batch.no-applications-declared');
	});

	it('refuses an entry that names nothing on disk', async () => {
		await withTemporaryCwd(async () => {
			const refusal = await readFleet(['not-a-tree']).then(
				() => null,
				(error: unknown) => pipelineRefusalOf(error),
			);
			expect(refusal?.code).toBe('batch.declared-application-is-not-readable');
		});
	});

	it('infers the identifier the way ingest infers it, from the acquisition lane', () => {
		expect(inferApplicationId('.versionless/work/react-mycrypto/baseline')).toBe(
			'react-mycrypto',
		);
		expect(inferApplicationId('trees/some-app')).toBe('some-app');
	});
});

describe('the loop', () => {
	it('invokes the harness exactly where the coverage report reads records from', () => {
		const invocation = harnessInvocationFor(application('one'), {
			laneRoot: 'lanes',
			forwarded: ['--node', '16'],
		});
		expect(invocation.argv).toEqual([
			'roots/one',
			'--out',
			'lanes/one',
			'--record',
			'evidence/runs/one/run-record.json',
			'--json',
			'--node',
			'16',
		]);
	});

	it('runs applications serially, in the order declared, never two at once', async () => {
		await withTemporaryCwd(async () => {
			const order: string[] = [];
			let inFlight = 0;
			let overlapped = false;
			const result = await runFleetBatch(
				declarationsFor([application('one'), application('two'), application('three')]),
				{
					cliEntry: 'cli.ts',
					runHarness: async (invocation) => {
						inFlight += 1;
						if (inFlight > 1) overlapped = true;
						order.push(invocation.id);
						await new Promise((resolve) => setTimeout(resolve, 5));
						inFlight -= 1;
						return outcome(countRecord('refused:ingest.declined'));
					},
				},
			);
			expect(order).toEqual(['one', 'two', 'three']);
			expect(overlapped).toBe(false);
			expect(result.summary.applications.map((row) => row.id)).toEqual([
				'one',
				'two',
				'three',
			]);
			expect(result.summary.schemaVersion).toBe(FLEET_BATCH_SCHEMA);
		});
	});

	it('records a broken harness as one defect row and keeps going', async () => {
		await withTemporaryCwd(async () => {
			const result = await runFleetBatch(
				declarationsFor([application('one'), application('two'), application('three')]),
				{
					cliEntry: 'cli.ts',
					runHarness: async (invocation) => {
						if (invocation.id === 'two')
							throw new Error('the harness did not return a record');
						return outcome(countRecord('refused:era-cell.declined'));
					},
				},
			);
			expect(result.summary.applications.map((row) => row.terminalClassification)).toEqual([
				'refused:era-cell.declined',
				'defect:harness-did-not-return',
				'refused:era-cell.declined',
			]);
			expect(result.summary.totals.defects).toBe(1);
			expect(result.summary.totals.refused).toBe(2);
			expect(result.exitCode).toBe(1);
		});
	});

	it('carries a refusal code and its message verbatim out of the run record', async () => {
		await withTemporaryCwd(async (root) => {
			await mkdir(path.join(root, 'evidence/runs/one'), { recursive: true });
			await writeFile(
				path.join(root, 'evidence/runs/one/run-record.json'),
				JSON.stringify({
					outcome: 'refused',
					lineage: 'react',
					refusal: {
						code: 'ingest.acquisition-journal-does-not-match-the-tree',
						message: 'Ingest: the journal does not describe this tree.',
						stage: 'ingest',
					},
				}),
			);
			const result = await runFleetBatch(declarationsFor([application('one')]), {
				cliEntry: 'cli.ts',
				runHarness: async () =>
					outcome(
						countRecord('refused:ingest.acquisition-journal-does-not-match-the-tree'),
					),
			});
			const row = result.summary.applications[0];
			/**
			 * The stage is carried verbatim beside the code and the message: a
			 * summary that says which code fired without saying where it fired
			 * cannot say how far an application got.
			 */
			expect(row?.refusal).toEqual({
				code: 'ingest.acquisition-journal-does-not-match-the-tree',
				message: 'Ingest: the journal does not describe this tree.',
				stage: 'ingest',
			});
			expect(row?.framework).toBe('react');
			expect(result.summary.totals.refusedByCode).toEqual({
				'ingest.acquisition-journal-does-not-match-the-tree': 1,
			});
			expect(result.exitCode).toBe(0);
		});
	});

	it('does not describe a batch carrying an intervention as unattended, and exits 0 only when nothing broke', async () => {
		await withTemporaryCwd(async () => {
			const result = await runFleetBatch(declarationsFor([application('one')]), {
				cliEntry: 'cli.ts',
				runHarness: async () => outcome(countRecord('proven', 1)),
			});
			expect(result.summary.totals.interventionCount).toBe(1);
			expect(result.summary.unattended.state).toBe(false);
			expect(result.summary.unattended.statement).toContain('is not described as unattended');
		});
	});

	it('never turns an unmeasured intervention count into a measured zero', async () => {
		await withTemporaryCwd(async () => {
			const result = await runFleetBatch(declarationsFor([application('one')]), {
				cliEntry: 'cli.ts',
				runHarness: async () =>
					outcome({ flow: 'refusal', refusal: { code: 'arguments.unknown-flag' } }, 2),
			});
			const row = result.summary.applications[0];
			expect(row?.interventionCount).toBeNull();
			expect(row?.terminalClassification).toBe('refused:arguments.unknown-flag');
			expect(result.summary.totals.interventionCountNotAsserted).toBe(1);
			expect(result.summary.unattended.state).toBe(false);
		});
	});
});

describe('the summary', () => {
	it('passes every string it carries through the enterprise honesty guard', async () => {
		await withTemporaryCwd(async () => {
			const result = await runFleetBatch(declarationsFor([application('one')]), {
				cliEntry: 'cli.ts',
				runHarness: async () => outcome(countRecord('refused:ingest.declined')),
			});
			assertEnterpriseSurfaceHonesty(result.markdown, 'test');
			expect(() => {
				assertFleetSummaryHonesty(result.summary, result.markdown);
			}).not.toThrow();
			expect(renderFleetSummary(result.summary)).toBe(result.markdown);
			const written = JSON.parse(await readFile(result.summaryPath, 'utf8')) as {
				schemaVersion: string;
			};
			expect(written.schemaVersion).toBe(FLEET_BATCH_SCHEMA);
		});
	});

	it('refuses to write a summary whose quoted refusal message carries blanket-support language', async () => {
		await withTemporaryCwd(async (root) => {
			await mkdir(path.join(root, 'evidence/runs/one'), { recursive: true });
			await writeFile(
				path.join(root, 'evidence/runs/one/run-record.json'),
				JSON.stringify({
					outcome: 'refused',
					refusal: {
						code: 'ingest.declined',
						message: 'This application is production ready.',
					},
				}),
			);
			await expect(
				runFleetBatch(declarationsFor([application('one')]), {
					cliEntry: 'cli.ts',
					runHarness: async () => outcome(countRecord('refused:ingest.declined')),
				}),
			).rejects.toThrow(/blanket-support language/);
		});
	});
});

describe('--publish', () => {
	const stepsUnderTest = publishStepsFor({
		distStale: true,
		trustDir: 'evidence/trust/current',
		cliEntry: 'packages/cli/src/cli.ts',
	});

	it('names the four steps in the one order that leaves a readable report', () => {
		expect(stepsUnderTest.map((step) => step.step)).toEqual([
			'pack',
			'trust:generate',
			'trust:verify',
			'report:coverage',
		]);
	});

	it('runs them in that order when each exits 0', async () => {
		const ran: string[] = [];
		const outcomes = await runPublishChain(stepsUnderTest, async (step: PublishStep) => {
			ran.push(step.step);
			return { exitCode: 0, stdout: '', stderr: '' };
		});
		expect(ran).toEqual(['pack', 'trust:generate', 'trust:verify', 'report:coverage']);
		expect(outcomes.every((step) => step.status === 'ran')).toBe(true);
	});

	it('skips the build when the built CLI is not older than its sources, and says so', async () => {
		const ran: string[] = [];
		const outcomes = await runPublishChain(
			publishStepsFor({
				distStale: false,
				trustDir: 'evidence/trust/current',
				cliEntry: 'packages/cli/src/cli.ts',
			}),
			async (step: PublishStep) => {
				ran.push(step.step);
				return { exitCode: 0, stdout: '', stderr: '' };
			},
		);
		expect(ran).toEqual(['trust:generate', 'trust:verify', 'report:coverage']);
		expect(outcomes[0]?.status).toBe('skipped');
		expect(outcomes[0]?.detail).toContain('not older than the sources');
	});

	it('stops the chain at the first step that did not exit 0, and exits 1', async () => {
		await withTemporaryCwd(async () => {
			const ran: string[] = [];
			const result = await runFleetBatch(declarationsFor([application('one')], true), {
				cliEntry: 'packages/cli/src/cli.ts',
				runHarness: async () => outcome(countRecord('refused:ingest.declined')),
				distStale: async () => true,
				publish: async (step: PublishStep) => {
					ran.push(step.step);
					return step.step === 'trust:generate'
						? { exitCode: 1, stdout: '', stderr: 'the generate step did not exit 0' }
						: { exitCode: 0, stdout: '', stderr: '' };
				},
			});
			expect(ran).toEqual(['pack', 'trust:generate']);
			expect(result.summary.publish.steps.map((step) => step.status)).toEqual([
				'ran',
				'failed',
				'not-run',
				'not-run',
			]);
			expect(result.exitCode).toBe(1);
			expect(result.summary.totals.defects).toBe(0);
		});
	});

	it('leaves the published coverage report byte-unchanged when publish was not declared', async () => {
		const before = sha256(await readFile(COVERAGE_REPORT));
		await withTemporaryCwd(async () => {
			const result = await runFleetBatch(declarationsFor([application('one')]), {
				cliEntry: 'packages/cli/src/cli.ts',
				runHarness: async () => outcome(countRecord('refused:ingest.declined')),
			});
			expect(result.summary.declared.publish).toBe('not-declared');
			expect(result.summary.publish.steps).toEqual([]);
			expect(result.markdown).toContain('publish: not-declared');
		});
		expect(sha256(await readFile(COVERAGE_REPORT))).toBe(before);
	});
});
