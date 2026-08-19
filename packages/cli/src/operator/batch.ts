/**
 * The fleet loop: one application at a time, each scored by the out-of-band
 * harness, each filed where the coverage report reads it.
 *
 * Three constraints shape everything below, and each of them is a finding this
 * repository already paid for:
 *
 * **The fleet is never in source.** A batch that lists its applications in a
 * TypeScript array is not a fleet tool; it is a fixture wearing one. The list
 * arrives as `--apps <manifest>` or as repeated `--apps <root>` values, and this
 * module has no default list to fall back to.
 *
 * **A refusal is a returned outcome, not an exception to catch.** The harness
 * reports the terminal classification the run reached — `refused:<code>` when a
 * stage declined — and this loop reads it. Nothing here infers a refusal from a
 * thrown stack. A `try` remains around each invocation for exactly one reason:
 * an application whose harness *broke* is one `defect:*` row, not a batch that
 * stops at application three of three hundred.
 *
 * **The loop is serial.** The witness serializes per host, and determinism under
 * load is the property being protected; a fleet that fans out gets faster
 * numbers and loses the reading they were for. Operator stages may fan out
 * later. This loop does not.
 *
 * What the batch produces is a summary, and the summary is the product: totals
 * that never restate a bounded per-app outcome more generally, refused rows
 * carrying their named code and their message verbatim, and a terminal pass
 * through the enterprise honesty guard before anything is written.
 */

import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import {
	ANGULAR_PRE_IVY_BOUNDARY_POPULATION_STATEMENT,
	ANGULAR_PRE_IVY_BOUNDARY_PREVALENCE,
} from '../../../core/src/receipts/angular-pre-ivy-boundary-amendment.ts';
import { HOLDOUT_ANGULAR_ESHOP_WEBSPA_OUTCOME } from '../../../core/src/receipts/holdout-angular-eshop-webspa.ts';
import { assertEnterpriseSurfaceHonesty } from '../../../trust/src/enterprise.ts';
import { acquisitionLaneOf } from './ingest.ts';
import { INTERVENTION_COUNT_SCHEMA, interventionRecordPathFor } from './intervention-count.ts';
import { refuse } from './refusals.ts';
import { displayPath, writeRecord } from './record.ts';

export const FLEET_BATCH_SCHEMA = 'versionless.fleet-batch.v1';

/** Where a fleet summary is filed, one directory per batch. */
export const FLEET_BATCH_ROOT = 'evidence/runs/fleet-batch';
export const FLEET_SUMMARY_JSON = 'fleet-summary.json';
export const FLEET_SUMMARY_MARKDOWN = 'fleet-summary.md';

/** Where each application's run record is filed, so the coverage report reads it. */
export const RUN_RECORD_ROOT = 'evidence/runs';
export const RUN_RECORD_FILE = 'run-record.json';

/**
 * What a batch establishes and what it does not.
 *
 * The first, third and fourth entries are carried verbatim from the batch
 * operator dry run that measured this loop's machine time; they were true of
 * that spike and remain true of this command. The rest are this command's own.
 */
export const FLEET_NOT_ESTABLISHED: readonly string[] = Object.freeze([
	'A count of refusal sites is not a count of refusable applications. What this summary tallies is the outcome each named application reached on this host, in this order, once.',
	'A refusal is an outcome rather than a failure of the run. The refusing roots are counted at the cost they actually took.',
	'The fleet here is whatever list this command was handed. It is not a random sample of any target fleet and it carries whatever selection that list carries.',
	'The timings are one host, one process, a warm page cache and one repetition. They are a reading of this machine rather than a specification.',
	'An intervention count of zero is the out-of-band harness reporting that no path outside the declared write set changed and that one process was spawned. It is not a statement that any application in this batch produced a working build.',
	'Applications ran one at a time. Nothing here establishes what any of these outcomes would have been under a loop that fanned out, and the witness surface is the reason this one does not.',
	'The publish steps below, when declared, report what each command exited with. A regenerated report is a re-derivation of what the evidence on disk already carried; it is not certification, and no authenticity claim rides along with it.',
]);

export type BatchApplication = Readonly<{
	id: string;
	root: string;
	framework?: string;
}>;

export type BatchRow = Readonly<{
	id: string;
	framework: string;
	applicationRoot: string;
	lane: string;
	terminalClassification: string;
	interventionCount: number | null;
	exitCode: number | null;
	/**
	 * The refusal the run record carries, verbatim: the code, the message, and
	 * the stage that raised it. The stage is the third field of the same
	 * refusal, and a summary that reports which code fired without reporting
	 * where it fired cannot say how far an application got.
	 */
	refusal: Readonly<{ code: string; message: string; stage: string }> | null;
	elapsedMs: number;
	runRecordPath: string;
	interventionRecordPath: string;
	detail?: string;
}>;

export type PublishStep = Readonly<{
	step: string;
	command: string;
	argv: readonly string[];
	env?: Readonly<Record<string, string>>;
	/** Why a step may be skipped, when the condition it depends on is not met. */
	condition?: string;
}>;

export type PublishStepOutcome = Readonly<{
	step: string;
	command: string;
	status: 'ran' | 'skipped' | 'failed' | 'not-run';
	exitCode: number | null;
	detail: string;
}>;

export type PublishExecution = Readonly<{
	exitCode: number | null;
	stdout: string;
	stderr: string;
}>;

export type PublishExecutor = (step: PublishStep) => Promise<PublishExecution>;

export type HarnessInvocation = Readonly<{
	id: string;
	applicationRoot: string;
	lane: string;
	runRecord: string;
	/** The operator arguments, exactly as a shell operator would type them. */
	argv: readonly string[];
}>;

export type HarnessOutcome = Readonly<{ text: string; json: unknown; exitCode: number }>;
export type HarnessRunner = (invocation: HarnessInvocation) => Promise<HarnessOutcome>;

export type BatchDeclarations = Readonly<{
	applications: readonly BatchApplication[];
	laneRoot: string;
	/** The declarations forwarded to every application's harness, unchanged. */
	forwarded: readonly string[];
	name: string;
	publish: boolean;
	root: string;
	appsSource: readonly string[];
}>;

export type FleetSummary = Readonly<{
	schemaVersion: typeof FLEET_BATCH_SCHEMA;
	flow: 'batch';
	name: string;
	startedAt: string;
	endedAt: string;
	machineTimeMs: number;
	declared: Readonly<{
		applicationsFrom: readonly string[];
		laneRoot: string;
		forwarded: readonly string[];
		concurrency: string;
		publish: string;
	}>;
	totals: Readonly<{
		applications: number;
		proven: number;
		refused: number;
		refusedByCode: Readonly<Record<string, number>>;
		defects: number;
		interventionCount: number;
		interventionCountNotAsserted: number;
	}>;
	unattended: Readonly<{ state: boolean; statement: string }>;
	applications: readonly BatchRow[];
	publish: Readonly<{ declared: boolean; steps: readonly PublishStepOutcome[] }>;
	notEstablished: readonly string[];
}>;

/**
 * The identity of an application root, inferred the way ingest infers it.
 *
 * An acquired tree sits at `.versionless/work/<id>/baseline`, and that `<id>` is
 * the name the pipeline already files evidence under. A root that is not a lane
 * baseline yields its own directory name, which is a name for this batch rather
 * than a claim about the application's declared identity.
 */
export function inferApplicationId(root: string): string {
	const lane = acquisitionLaneOf(root);
	if (lane !== null) return lane.laneId;
	const base = path.basename(path.resolve(root));
	return base === '' ? 'application' : base;
}

/**
 * Read the fleet list from a manifest, or take an entry as one application root.
 *
 * Two manifest shapes are read because two are already written by hand: a JSON
 * document carrying `applications`, and a newline list of roots. Neither is a
 * list this module carries — an entry that names no readable list and no
 * readable directory is refused rather than dropped.
 */
export function parseManifest(body: string, source: string): readonly BatchApplication[] {
	const trimmed = body.trim();
	if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
		let parsed: unknown;
		try {
			parsed = JSON.parse(trimmed);
		} catch {
			refuse({
				code: 'batch.manifest-is-not-readable',
				message: `batch: ${source} is not readable as JSON. A manifest is a JSON document carrying \`applications\`, or a newline list of application roots.`,
				stage: 'batch',
				origin: 'pipeline',
			});
		}
		const entries = Array.isArray(parsed)
			? parsed
			: ((parsed as { applications?: unknown }).applications ?? null);
		if (!Array.isArray(entries))
			refuse({
				code: 'batch.manifest-declares-no-applications',
				message: `batch: ${source} carries no \`applications\` array. This command has no fleet of its own to fall back to.`,
				stage: 'batch',
				origin: 'pipeline',
			});
		return Object.freeze(
			(entries as readonly unknown[]).map((entry) => {
				if (typeof entry === 'string')
					return Object.freeze({ id: inferApplicationId(entry), root: entry });
				const record = (entry ?? {}) as Record<string, unknown>;
				const root = typeof record.root === 'string' ? record.root : null;
				if (root === null)
					refuse({
						code: 'batch.manifest-entry-names-no-root',
						message: `batch: an entry in ${source} names no \`root\`. Every application in a manifest is a root this command can read.`,
						stage: 'batch',
						origin: 'pipeline',
					});
				return Object.freeze({
					id:
						typeof record.id === 'string'
							? record.id
							: inferApplicationId(root as string),
					root: root as string,
					...(typeof record.framework === 'string'
						? { framework: record.framework }
						: {}),
				});
			}),
		);
	}
	const roots = trimmed
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line !== '' && !line.startsWith('#'));
	if (roots.length === 0)
		refuse({
			code: 'batch.manifest-declares-no-applications',
			message: `batch: ${source} lists no application roots. This command has no fleet of its own to fall back to.`,
			stage: 'batch',
			origin: 'pipeline',
		});
	return Object.freeze(
		roots.map((root) => Object.freeze({ id: inferApplicationId(root), root })),
	);
}

async function isFile(target: string): Promise<boolean> {
	try {
		return (await stat(target)).isFile();
	} catch {
		return false;
	}
}

async function isDirectory(target: string): Promise<boolean> {
	try {
		return (await stat(target)).isDirectory();
	} catch {
		return false;
	}
}

/** The fleet, in the order it was declared, from files and roots and nowhere else. */
export async function readFleet(entries: readonly string[]): Promise<readonly BatchApplication[]> {
	if (entries.length === 0)
		refuse({
			code: 'batch.no-applications-declared',
			message:
				'batch: --apps <manifest-file> or --apps <application-root> is required, and may be repeated. This command carries no fleet in its own source.',
			stage: 'batch',
			origin: 'pipeline',
		});
	const applications: BatchApplication[] = [];
	for (const entry of entries) {
		if (await isFile(entry)) {
			applications.push(...parseManifest(await readFile(entry, 'utf8'), displayPath(entry)));
			continue;
		}
		if (await isDirectory(entry)) {
			applications.push(Object.freeze({ id: inferApplicationId(entry), root: entry }));
			continue;
		}
		refuse({
			code: 'batch.declared-application-is-not-readable',
			message: `batch: ${entry} is neither a manifest file nor a directory this command can read. A fleet entry names something on disk.`,
			stage: 'batch',
			origin: 'pipeline',
		});
	}
	return Object.freeze(applications);
}

/** The operator arguments the harness is invoked with, for one application. */
export function harnessInvocationFor(
	application: BatchApplication,
	declarations: Pick<BatchDeclarations, 'laneRoot' | 'forwarded'>,
): HarnessInvocation {
	const lane = path.join(declarations.laneRoot, application.id);
	const runRecord = path.join(RUN_RECORD_ROOT, application.id, RUN_RECORD_FILE);
	return Object.freeze({
		id: application.id,
		applicationRoot: application.root,
		lane,
		runRecord,
		argv: Object.freeze([
			application.root,
			'--out',
			lane,
			'--record',
			runRecord,
			'--json',
			...declarations.forwarded,
		]),
	});
}

type RunReading = Readonly<{
	refusal?: { code?: unknown; message?: unknown; stage?: unknown };
	lineage?: unknown;
}>;

async function readRunRecord(file: string): Promise<RunReading | null> {
	try {
		const parsed: unknown = JSON.parse(await readFile(path.resolve(file), 'utf8'));
		return typeof parsed === 'object' && parsed !== null ? (parsed as RunReading) : null;
	} catch {
		return null;
	}
}

/**
 * One application: invoke the harness, read what it returned, build the row.
 *
 * The classification comes off the harness record verbatim. The refusal code and
 * message come off the run record the harness scored, also verbatim — a fleet
 * report that paraphrases why an application declined is a fleet report an
 * operator cannot act on.
 */
export async function runOneApplication(
	application: BatchApplication,
	declarations: Pick<BatchDeclarations, 'laneRoot' | 'forwarded'>,
	runHarness: HarnessRunner,
): Promise<BatchRow> {
	const invocation = harnessInvocationFor(application, declarations);
	const started = Date.now();
	const base = {
		id: application.id,
		framework: application.framework ?? 'not-recorded',
		applicationRoot: displayPath(application.root),
		lane: displayPath(invocation.lane),
		runRecordPath: invocation.runRecord,
		interventionRecordPath: interventionRecordPathFor(invocation.runRecord),
	};
	let outcome: HarnessOutcome;
	try {
		outcome = await runHarness(invocation);
	} catch (error) {
		/**
		 * The harness broke. That is one defect row and the loop continues: a
		 * fleet run that stops at the first broken application reports nothing
		 * about the applications after it.
		 */
		return Object.freeze({
			...base,
			terminalClassification: 'defect:harness-did-not-return',
			interventionCount: null,
			exitCode: null,
			refusal: null,
			elapsedMs: Date.now() - started,
			detail: error instanceof Error ? error.message : String(error),
		});
	}
	const elapsedMs = Date.now() - started;
	const record = (outcome.json ?? {}) as Record<string, unknown>;
	if (record.schemaVersion !== INTERVENTION_COUNT_SCHEMA) {
		/**
		 * The harness returned something that is not a count record. That is the
		 * harness itself refusing — an argument it would not accept, say — and it
		 * is reported with its named code and no invented count: an unmeasured
		 * intervention count is not a measured zero.
		 */
		const refusal =
			typeof record.refusal === 'object' && record.refusal !== null
				? (record.refusal as { code?: unknown; message?: unknown; stage?: unknown })
				: null;
		const code = refusal === null ? 'unnamed' : String(refusal.code ?? 'unnamed');
		return Object.freeze({
			...base,
			terminalClassification:
				outcome.exitCode === 2 ? `refused:${code}` : 'defect:no-harness-record',
			interventionCount: null,
			exitCode: outcome.exitCode,
			refusal:
				refusal === null
					? null
					: Object.freeze({
							code,
							message: String(refusal.message ?? ''),
							stage: String(refusal.stage ?? 'not-recorded'),
						}),
			elapsedMs,
		});
	}
	const classification = String(record.terminalClassification ?? 'defect:outcome-not-classified');
	const reading = classification.startsWith('refused:')
		? await readRunRecord(invocation.runRecord)
		: null;
	const declared = reading?.refusal ?? null;
	return Object.freeze({
		...base,
		framework:
			application.framework ??
			(typeof reading?.lineage === 'string' ? reading.lineage : 'not-recorded'),
		terminalClassification: classification,
		interventionCount:
			typeof record.interventionCount === 'number' ? record.interventionCount : null,
		exitCode: typeof record.exitCode === 'number' ? record.exitCode : null,
		refusal:
			declared === null
				? classification.startsWith('refused:')
					? Object.freeze({
							code: classification.slice('refused:'.length),
							message:
								'the run record carries no refusal message this batch could read',
							stage: 'not-recorded',
						})
					: null
				: Object.freeze({
						code: String(declared.code ?? ''),
						message: String(declared.message ?? ''),
						stage: String(declared.stage ?? 'not-recorded'),
					}),
		elapsedMs,
	});
}

/** The four publish steps, in the one order that leaves a readable report. */
export function publishStepsFor(
	options: Readonly<{ distStale: boolean; trustDir: string; cliEntry: string }>,
): readonly PublishStep[] {
	return Object.freeze([
		Object.freeze({
			step: 'pack',
			command: 'pnpm exec vp pack',
			argv: Object.freeze(['exec', 'vp', 'pack']),
			condition: options.distStale
				? 'packages/cli/dist is older than the sources it is built from'
				: 'packages/cli/dist is not older than the sources it is built from',
		}),
		Object.freeze({
			step: 'trust:generate',
			command:
				'npm run trust:generate -- --offline --policy trust/policy.json --output evidence/trust/current',
			argv: Object.freeze([
				'run',
				'trust:generate',
				'--',
				'--offline',
				'--policy',
				'trust/policy.json',
				'--output',
				options.trustDir,
			]),
			env: Object.freeze({ VERSIONLESS_NETWORK_MODE: 'offline' }),
		}),
		Object.freeze({
			step: 'trust:verify',
			command: 'npm run trust:verify -- --offline',
			argv: Object.freeze(['run', 'trust:verify', '--', '--offline']),
			env: Object.freeze({ VERSIONLESS_NETWORK_MODE: 'offline' }),
		}),
		Object.freeze({
			step: 'report:coverage',
			command: 'report:coverage --offline --verify-only',
			argv: Object.freeze([
				'--experimental-strip-types',
				options.cliEntry,
				'report:coverage',
				'--offline',
				'--verify-only',
			]),
			env: Object.freeze({ VERSIONLESS_NETWORK_MODE: 'offline' }),
		}),
	]);
}

/**
 * Run the publish chain in order and stop at the first step that did not exit 0.
 *
 * A chain that carried on past a failed generate would verify the artifacts the
 * failed step did not write, so the steps after a failure are recorded
 * `not-run` rather than attempted.
 */
export async function runPublishChain(
	steps: readonly PublishStep[],
	execute: PublishExecutor,
	skip: (step: PublishStep) => boolean = (step) =>
		step.step === 'pack' &&
		step.condition?.startsWith('packages/cli/dist is not older') === true,
): Promise<readonly PublishStepOutcome[]> {
	const outcomes: PublishStepOutcome[] = [];
	let stopped = false;
	for (const step of steps) {
		if (stopped) {
			outcomes.push(
				Object.freeze({
					step: step.step,
					command: step.command,
					status: 'not-run' as const,
					exitCode: null,
					detail: 'an earlier step in this chain did not exit 0, so this step was not run',
				}),
			);
			continue;
		}
		if (skip(step)) {
			outcomes.push(
				Object.freeze({
					step: step.step,
					command: step.command,
					status: 'skipped' as const,
					exitCode: null,
					detail: step.condition ?? 'the condition this step depends on was not met',
				}),
			);
			continue;
		}
		let execution: PublishExecution;
		try {
			execution = await execute(step);
		} catch (error) {
			execution = {
				exitCode: 1,
				stdout: '',
				stderr: error instanceof Error ? error.message : String(error),
			};
		}
		const ran = execution.exitCode === 0;
		if (!ran) stopped = true;
		outcomes.push(
			Object.freeze({
				step: step.step,
				command: step.command,
				status: ran ? ('ran' as const) : ('failed' as const),
				exitCode: execution.exitCode,
				detail: ran
					? (step.condition ?? 'the step exited 0')
					: execution.stderr.trim().split('\n').slice(-1).join('') ||
						'the step did not exit 0',
			}),
		);
	}
	return Object.freeze(outcomes);
}

/** Spawn a publish step as a child process, with no shell between. */
export const spawnPublishStep =
	(root: string): PublishExecutor =>
	async (step) =>
		await new Promise<PublishExecution>((resolve) => {
			const runtime = step.step === 'report:coverage' ? process.execPath : 'npm';
			const argv = [...step.argv];
			const binary = step.step === 'pack' ? 'pnpm' : runtime;
			execFile(
				binary,
				argv,
				{
					cwd: root,
					env: { ...process.env, ...(step.env ?? {}) },
					maxBuffer: 64 * 1024 * 1024,
				},
				(error, stdout, stderr) => {
					resolve({
						exitCode:
							error === null
								? 0
								: typeof (error as { code?: unknown }).code === 'number'
									? ((error as { code?: number }).code ?? 1)
									: 1,
						stdout: String(stdout),
						stderr: String(stderr),
					});
				},
			);
		});

async function newestMtime(root: string, into: { value: number }): Promise<void> {
	let entries;
	try {
		entries = await readdir(root, { withFileTypes: true });
	} catch {
		return;
	}
	for (const entry of entries) {
		if (entry.name === 'node_modules' || entry.name === '.git') continue;
		const full = path.join(root, entry.name);
		if (entry.isDirectory()) {
			await newestMtime(full, into);
			continue;
		}
		try {
			const stats = await stat(full);
			if (stats.mtimeMs > into.value) into.value = stats.mtimeMs;
		} catch {
			/* a file that vanished between the walk and the stat is not a reading */
		}
	}
}

/**
 * Whether the built CLI is older than the sources it is built from.
 *
 * A missing `dist` is stale by construction: there is nothing there that could
 * be newer than anything.
 */
export async function distIsStale(root: string): Promise<boolean> {
	const dist = { value: 0 };
	await newestMtime(path.join(root, 'packages/cli/dist'), dist);
	if (dist.value === 0) return true;
	const source = { value: 0 };
	for (const directory of ['packages/cli/src', 'packages/core/src', 'packages/trust/src'])
		await newestMtime(path.join(root, directory), source);
	return source.value > dist.value;
}

function tallyTotals(rows: readonly BatchRow[]): FleetSummary['totals'] {
	const refusedByCode: Record<string, number> = {};
	let refused = 0;
	let proven = 0;
	let defects = 0;
	let interventionCount = 0;
	let notAsserted = 0;
	for (const row of rows) {
		if (row.terminalClassification === 'proven') proven += 1;
		if (row.terminalClassification.startsWith('refused:')) {
			refused += 1;
			const code = row.refusal?.code ?? row.terminalClassification.slice('refused:'.length);
			refusedByCode[code] = (refusedByCode[code] ?? 0) + 1;
		}
		if (row.terminalClassification.startsWith('defect:')) defects += 1;
		if (typeof row.interventionCount === 'number') interventionCount += row.interventionCount;
		else notAsserted += 1;
	}
	return Object.freeze({
		applications: rows.length,
		proven,
		refused,
		refusedByCode: Object.freeze(refusedByCode),
		defects,
		interventionCount,
		interventionCountNotAsserted: notAsserted,
	});
}

/**
 * Whether this batch may be described as unattended, and the sentence that says
 * so either way.
 *
 * Three conditions, all of them mechanical: no defect row, an intervention sum
 * of zero, and every application having asserted a count. A batch missing any
 * of them gets the sentence naming which.
 */
export function unattendedStatement(totals: FleetSummary['totals']): FleetSummary['unattended'] {
	const reasons: string[] = [];
	if (totals.defects > 0)
		reasons.push(`${String(totals.defects)} application(s) reached a defect classification`);
	if (totals.interventionCount > 0)
		reasons.push(
			`the out-of-band harness observed ${String(totals.interventionCount)} intervention(s)`,
		);
	if (totals.interventionCountNotAsserted > 0)
		reasons.push(
			`${String(totals.interventionCountNotAsserted)} application(s) asserted no intervention count, and an unmeasured count is not a measured zero`,
		);
	if (reasons.length > 0)
		return Object.freeze({
			state: false,
			statement: `This batch is not described as unattended: ${reasons.join('; ')}.`,
		});
	return Object.freeze({
		state: true,
		statement: `Across ${String(totals.applications)} application(s) the out-of-band harness observed zero interventions and no defect classification. That is a statement about what changed on disk and how many processes were spawned; it is not a statement that any of these applications built or rendered.`,
	});
}

/**
 * The summary as a document, and the guard the document has to survive.
 *
 * The boundary statements below are quoted from the receipts that own them
 * rather than restated, because the guard this render terminates in is exactly
 * the mechanism that refuses a restatement.
 */
export function renderFleetSummary(summary: FleetSummary): string {
	const lines: string[] = [];
	lines.push('# Versionless fleet batch');
	lines.push('');
	lines.push(`batch: ${summary.name}`);
	lines.push(`started: ${summary.startedAt}`);
	lines.push(`ended: ${summary.endedAt}`);
	lines.push(`machine time: ${String(summary.machineTimeMs)} ms`);
	lines.push(`applications declared from: ${summary.declared.applicationsFrom.join(', ')}`);
	lines.push(`lane root: ${summary.declared.laneRoot}`);
	lines.push(`forwarded declarations: ${summary.declared.forwarded.join(' ') || 'none'}`);
	lines.push(`concurrency: ${summary.declared.concurrency}`);
	lines.push(`publish: ${summary.declared.publish}`);
	lines.push('');
	lines.push('## Totals');
	lines.push('');
	lines.push(`- applications: ${String(summary.totals.applications)}`);
	lines.push(`- proven: ${String(summary.totals.proven)}`);
	lines.push(`- refused: ${String(summary.totals.refused)}`);
	for (const code of Object.keys(summary.totals.refusedByCode).sort())
		lines.push(`  - \`${code}\`: ${String(summary.totals.refusedByCode[code])}`);
	lines.push(`- defects: ${String(summary.totals.defects)}`);
	lines.push(`- intervention count, summed: ${String(summary.totals.interventionCount)}`);
	lines.push(
		`- applications asserting no intervention count: ${String(summary.totals.interventionCountNotAsserted)}`,
	);
	lines.push('');
	lines.push(summary.unattended.statement);
	lines.push('');
	lines.push('## Applications');
	lines.push('');
	for (const row of summary.applications) {
		lines.push(`### ${row.id}`);
		lines.push('');
		lines.push(`- framework: ${row.framework}`);
		lines.push(`- application root: \`${row.applicationRoot}\``);
		lines.push(`- lane: \`${row.lane}\``);
		lines.push(`- terminal classification: \`${row.terminalClassification}\``);
		lines.push(
			`- intervention count: ${row.interventionCount === null ? 'not asserted' : String(row.interventionCount)}`,
		);
		lines.push(`- exit code: ${row.exitCode === null ? 'not recorded' : String(row.exitCode)}`);
		lines.push(`- elapsed: ${String(row.elapsedMs)} ms`);
		lines.push(`- run record: \`${row.runRecordPath}\``);
		lines.push(`- harness record: \`${row.interventionRecordPath}\``);
		if (row.refusal !== null) {
			lines.push(`- refusal code: \`${row.refusal.code}\` (raised at stage \`${row.refusal.stage}\`)`);
			lines.push(`- refusal message: ${row.refusal.message}`);
		}
		if (row.detail !== undefined) lines.push(`- detail: ${row.detail}`);
		lines.push('');
	}
	lines.push('## Publish');
	lines.push('');
	if (!summary.publish.declared) lines.push('publish: not-declared');
	for (const step of summary.publish.steps)
		lines.push(
			`- \`${step.step}\` — ${step.status} (exit ${step.exitCode === null ? 'not-recorded' : String(step.exitCode)}): ${step.detail}`,
		);
	lines.push('');
	lines.push('## Boundaries this summary does not restate');
	lines.push('');
	lines.push(`- ${HOLDOUT_ANGULAR_ESHOP_WEBSPA_OUTCOME}`);
	lines.push(
		`- boundary prevalence published as ${ANGULAR_PRE_IVY_BOUNDARY_PREVALENCE.published}`,
	);
	lines.push(`- ${ANGULAR_PRE_IVY_BOUNDARY_PREVALENCE.statement}`);
	lines.push(`- ${ANGULAR_PRE_IVY_BOUNDARY_POPULATION_STATEMENT}`);
	lines.push(
		'- The holdout applications named above are counted in no lineage numerator, and no outcome in this batch changes that.',
	);
	lines.push('');
	lines.push('## Not established');
	lines.push('');
	for (const entry of summary.notEstablished) lines.push(`- ${entry}`);
	lines.push('');
	lines.push(
		'This document is not certification. It reports what each named application reached on this host, once, in the order declared.',
	);
	return `${lines.join('\n')}\n`;
}

/**
 * Every string this summary carries, through the enterprise honesty guard.
 *
 * The document is checked, and so is the record: a refusal message quoted into
 * the JSON but not into the Markdown would otherwise reach a reader unguarded.
 */
export function assertFleetSummaryHonesty(summary: FleetSummary, markdown: string): void {
	assertEnterpriseSurfaceHonesty(markdown, 'fleet-batch summary document');
	const preamble = markdown.split('## Boundaries this summary does not restate')[1] ?? '';
	assertEnterpriseSurfaceHonesty(
		`${JSON.stringify(summary, null, '\t')}\n## Boundaries this summary does not restate${preamble}`,
		'fleet-batch summary record',
	);
}

export type BatchResult = Readonly<{
	summary: FleetSummary;
	markdown: string;
	summaryPath: string;
	markdownPath: string;
	exitCode: number;
}>;

/**
 * The fleet loop itself: serial, filing as it goes, summarising at the end.
 */
export async function runFleetBatch(
	declarations: BatchDeclarations,
	hooks: Readonly<{
		runHarness: HarnessRunner;
		publish?: PublishExecutor;
		distStale?: () => Promise<boolean>;
		cliEntry: string;
	}>,
): Promise<BatchResult> {
	const startedAt = new Date().toISOString();
	const started = Date.now();
	const rows: BatchRow[] = [];
	for (const application of declarations.applications)
		rows.push(await runOneApplication(application, declarations, hooks.runHarness));
	const totals = tallyTotals(rows);
	let steps: readonly PublishStepOutcome[] = Object.freeze([]);
	if (declarations.publish) {
		const stale = await (hooks.distStale ?? (() => distIsStale(declarations.root)))();
		steps = await runPublishChain(
			publishStepsFor({
				distStale: stale,
				trustDir: 'evidence/trust/current',
				cliEntry: hooks.cliEntry,
			}),
			hooks.publish ?? spawnPublishStep(declarations.root),
		);
	}
	const machineTimeMs = Date.now() - started;
	const summary: FleetSummary = Object.freeze({
		schemaVersion: FLEET_BATCH_SCHEMA,
		flow: 'batch' as const,
		name: declarations.name,
		startedAt,
		endedAt: new Date().toISOString(),
		machineTimeMs,
		declared: Object.freeze({
			applicationsFrom: Object.freeze([...declarations.appsSource]),
			laneRoot: displayPath(declarations.laneRoot),
			forwarded: Object.freeze([...declarations.forwarded]),
			concurrency:
				'one application at a time, in the order declared; nothing in this batch ran in parallel',
			publish: declarations.publish ? 'declared' : 'not-declared',
		}),
		totals,
		unattended: unattendedStatement(totals),
		applications: Object.freeze(rows),
		publish: Object.freeze({ declared: declarations.publish, steps }),
		notEstablished: FLEET_NOT_ESTABLISHED,
	});
	const markdown = renderFleetSummary(summary);
	assertFleetSummaryHonesty(summary, markdown);
	const directory = path.join(FLEET_BATCH_ROOT, declarations.name);
	const summaryPath = path.join(directory, FLEET_SUMMARY_JSON);
	const markdownPath = path.join(directory, FLEET_SUMMARY_MARKDOWN);
	await writeRecord(summaryPath, summary);
	await writeMarkdown(markdownPath, markdown);
	const publishFailed = steps.some((step) => step.status !== 'ran' && step.status !== 'skipped');
	return Object.freeze({
		summary,
		markdown,
		summaryPath,
		markdownPath,
		exitCode: totals.defects > 0 || publishFailed ? 1 : 0,
	});
}

async function writeMarkdown(file: string, body: string): Promise<void> {
	await mkdir(path.dirname(path.resolve(file)), { recursive: true });
	await writeFile(path.resolve(file), body);
}

/** The batch as an operator reads it: the rows, the totals, then what they name. */
export function renderBatch(result: BatchResult): string {
	const lines = [
		`fleet batch: ${result.summary.name}`,
		`applications: ${String(result.summary.totals.applications)}`,
		'',
	];
	for (const row of result.summary.applications)
		lines.push(
			`  - ${row.id}: ${row.terminalClassification}, interventions ${row.interventionCount === null ? 'not asserted' : String(row.interventionCount)}, ${String(row.elapsedMs)} ms`,
		);
	lines.push('');
	lines.push(`proven: ${String(result.summary.totals.proven)}`);
	lines.push(`refused: ${String(result.summary.totals.refused)}`);
	for (const code of Object.keys(result.summary.totals.refusedByCode).sort())
		lines.push(`  ${code}: ${String(result.summary.totals.refusedByCode[code])}`);
	lines.push(`defects: ${String(result.summary.totals.defects)}`);
	lines.push(`intervention count, summed: ${String(result.summary.totals.interventionCount)}`);
	lines.push('');
	lines.push(result.summary.unattended.statement);
	lines.push('');
	lines.push(`publish: ${result.summary.declared.publish}`);
	for (const step of result.summary.publish.steps)
		lines.push(
			`  ${step.step}: ${step.status} (exit ${step.exitCode === null ? 'not-recorded' : String(step.exitCode)})`,
		);
	lines.push('');
	lines.push(`summary: ${result.summaryPath}`);
	lines.push(`document: ${result.markdownPath}`);
	return `${lines.join('\n')}\n`;
}

/** The batch name, when none was declared: the instant it started, as a path segment. */
export function defaultBatchName(now: Date = new Date()): string {
	return now.toISOString().replace(/[:.]/g, '-');
}
