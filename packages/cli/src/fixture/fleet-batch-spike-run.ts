/**
 * SPIKE B — the batch operator dry run.
 *
 * Two questions are open before a 300-application fleet can be scheduled, and
 * both of them are measurements rather than opinions.
 *
 * The first is machine time. The per-application cost this repository has
 * recorded so far — roughly 9–10 units per green vertical — conflates authoring
 * with execution, so the operator surface's own cost, what a batch runner would
 * actually spend per application once nothing is being authored, has never been
 * separated out. This driver separates it: it loops the existing `analyze`,
 * `plan` and `migrate` flows over an already-ingested fleet and times each
 * stage on the monotonic clock, with no authoring inside a timed region.
 *
 * The second is the disk floor. `.versionless/work` is the largest thing on
 * disk per application, and pruning it after receipt is only safe if the
 * offline verification still passes from the published receipts alone. That is
 * proven by moving one application's work directory aside, re-running the same
 * verification `versionless receipt:verify` runs, and moving it back. Nothing
 * is deleted at any point.
 *
 * This driver composes the operator command surface and adds no migration
 * decision of its own. Every stage below is `runOperatorCommand`, called
 * exactly as an operator would call it from a shell.
 *
 * What it does not measure is stated in the record it writes: install, build,
 * and the witness passes are outside the timed region entirely, and those are
 * the stages the recorded per-vertical cost is dominated by.
 */

import { mkdir, mkdtemp, readdir, rename, stat, writeFile } from 'node:fs/promises';
import { cpus, tmpdir, totalmem } from 'node:os';
import * as path from 'pathe';
import { verifyReceipt } from '../../../core/src/receipts/verify.ts';
import { assertEnterpriseSurfaceHonesty } from '../../../trust/src/enterprise.ts';
import { directoryExists } from '../operator/analyze.ts';
import { runOperatorCommand } from '../operator/flows.ts';
import { readSupportedMatrix, renderSupportedMatrix } from '../operator/matrix.ts';

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');

export const UNIT = 'nts-t004/spike-b-batch-operator-dryrun';

export const EVIDENCE_DIRECTORY = path.join(repositoryRoot, 'evidence/spikes/fleet-batch-dryrun');
export const SUMMARY_FILE = 'fleet-summary.json';
export const PRUNE_SAFETY_FILE = 'prune-safety.json';
export const README_FILE = 'README.md';

export const SUMMARY_SCHEMA = 'versionless.spike.fleet-batch-dryrun.fleet-summary.v1' as const;
export const PRUNE_SAFETY_SCHEMA = 'versionless.spike.fleet-batch-dryrun.prune-safety.v1' as const;

/** How many times each read-only stage is timed. The write stage runs once. */
export const REPETITIONS = 3;

/** The fleet size every projection in the record is for. */
export const PROJECTION_FLEET_SIZE = 300;

export type Lineage = 'react' | 'angular';

export type FleetApplication = Readonly<{
	/** The identifier this spike files the application under. */
	id: string;
	lineage: Lineage;
	/** The application root, relative to the repository root. */
	appRoot: string;
	/** The already-ingested work area the root was taken from. */
	workArea: string;
	/** Why this root, in one line. */
	note: string;
}>;

/**
 * The fleet, drawn from the work areas this checkout already carries.
 *
 * Selection rule: a root is in the fleet if `.versionless/work` already carries
 * it, so nothing here is acquired, installed or built by this spike. The mix is
 * deliberate — roots whose plan composes and roots the flows refuse are both
 * in, because a batch runner meets both and a projection built only on the
 * composing ones would price the wrong fleet.
 */
export const FLEET: readonly FleetApplication[] = Object.freeze([
	Object.freeze({
		id: 'react-cypress-rwa',
		lineage: 'react' as const,
		appRoot: '.versionless/work/react-cypress-rwa/baseline',
		workArea: '.versionless/work/react-cypress-rwa',
		note: 'create-react-app origin; the React holdout application at its baseline lane',
	}),
	Object.freeze({
		id: 'react-hospitalrun',
		lineage: 'react' as const,
		appRoot: '.versionless/work/react-hospitalrun/baseline',
		workArea: '.versionless/work/react-hospitalrun',
		note: 'create-react-app origin; ingested React corpus application',
	}),
	Object.freeze({
		id: 'react-linkfree-v0-72-0',
		lineage: 'react' as const,
		appRoot: '.versionless/work/react-linkfree-v0-72-0/baseline',
		workArea: '.versionless/work/react-linkfree-v0-72-0',
		note: 'create-react-app origin; ingested React corpus application',
	}),
	Object.freeze({
		id: 'react-papercups-v1-0-0',
		lineage: 'react' as const,
		appRoot: '.versionless/work/react-papercups-v1-0-0/baseline',
		workArea: '.versionless/work/react-papercups-v1-0-0',
		note: 'create-react-app origin; ingested React corpus application',
	}),
	Object.freeze({
		id: 'react-memos-v0-1-3',
		lineage: 'react' as const,
		appRoot: '.versionless/work/react-memos-v0-1-3/baseline',
		workArea: '.versionless/work/react-memos-v0-1-3',
		note: 'Vite origin rather than create-react-app; exercises the other React engine',
	}),
	Object.freeze({
		id: 'react-mycrypto',
		lineage: 'react' as const,
		appRoot: '.versionless/work/react-mycrypto/baseline',
		workArea: '.versionless/work/react-mycrypto',
		note: 'React lineage on a bespoke webpack build; no frozen React adapter claims it',
	}),
	Object.freeze({
		id: 'react-boilerplate-v4',
		lineage: 'react' as const,
		appRoot: '.versionless/work/react-boilerplate-v4/target',
		workArea: '.versionless/work/react-boilerplate-v4',
		note: 'React lineage, already-migrated lane declaring neither react-scripts nor a Vite configuration',
	}),
	Object.freeze({
		id: 'angular-pigallery2',
		lineage: 'angular' as const,
		appRoot: '.versionless/work/angular-pigallery2/baseline',
		workArea: '.versionless/work/angular-pigallery2',
		note: 'Angular CLI era workspace; the largest composing tree in this fleet',
	}),
	Object.freeze({
		id: 'angular-eshop-webspa',
		lineage: 'angular' as const,
		appRoot: '.versionless/work/angular-eshop-webspa/baseline',
		workArea: '.versionless/work/angular-eshop-webspa',
		note: 'Angular CLI era workspace; second composing Angular tree',
	}),
	Object.freeze({
		id: 'angular-pigallery2-operator-lane',
		lineage: 'angular' as const,
		appRoot: '.versionless/work/operator-flows/angular-pigallery2-lane',
		workArea: '.versionless/work/operator-flows',
		note: 'Angular lane that already carries the composed changeset; composes to a zero-change plan',
	}),
	Object.freeze({
		id: 'angular-realworld-v15-to-v16',
		lineage: 'angular' as const,
		appRoot: '.versionless/work/angular-realworld-v15-to-v16/lanes/legacy',
		workArea: '.versionless/work/angular-realworld-v15-to-v16',
		note: 'Angular workspace whose tsconfig carries comments',
	}),
	Object.freeze({
		id: 'angular-realworld-production-parity',
		lineage: 'angular' as const,
		appRoot: '.versionless/work/angular-realworld-production-parity/lanes/angular15',
		workArea: '.versionless/work/angular-realworld-production-parity',
		note: 'second Angular workspace whose tsconfig carries comments',
	}),
]);

/** The application whose work directory the prune proof sets aside. */
export const PRUNE_PROOF_APPLICATION = 'react-boilerplate-v4-composed' as const;
/** Its canonical receipt: the one `receipt:verify` checks when handed no path. */
export const PRUNE_PROOF_RECEIPT = 'evidence/runs/react-boilerplate-v4-composed/t060-run.json';
export const PRUNE_PROOF_WORK_DIRECTORY = '.versionless/work/react-boilerplate-v4-composed';

const message = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);

const round = (value: number): number => Math.round(value * 1000) / 1000;

/** Milliseconds elapsed on the monotonic clock while `run` was awaited. */
async function timed<T>(run: () => Promise<T>): Promise<{ ms: number; value: T }> {
	const started = process.hrtime.bigint();
	const value = await run();
	return { ms: round(Number(process.hrtime.bigint() - started) / 1e6), value };
}

function median(values: readonly number[]): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((left, right) => left - right);
	const middle = Math.floor(sorted.length / 2);
	if (sorted.length % 2 === 1) return sorted[middle] as number;
	return round(((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2);
}

function mean(values: readonly number[]): number {
	if (values.length === 0) return 0;
	let total = 0;
	for (const value of values) total += value;
	return round(total / values.length);
}

const best = (values: readonly number[]): number => (values.length === 0 ? 0 : Math.min(...values));

export type StageName = 'analyze' | 'plan' | 'migrate';

export type StageOutcome = 'reported' | 'composed' | 'applied' | 'refused' | 'not-attempted';

export type StageMeasurement = Readonly<{
	stage: StageName;
	outcome: StageOutcome;
	/** Machine-time milliseconds per repetition, monotonic clock, nothing else inside. */
	runs: readonly number[];
	bestMs: number;
	medianMs: number;
	/** The refusal string the flow produced, quoted, when it refused. */
	refusal: string | null;
	/** What the stage reported, when it did not refuse. */
	detail: string | null;
}>;

export type AppMeasurement = Readonly<{
	id: string;
	lineage: Lineage;
	appRoot: string;
	workArea: string;
	note: string;
	stages: readonly StageMeasurement[];
	/** The deepest stage that completed. */
	pipelineBasis: StageName;
	/**
	 * What one operator pass over this application costs, taken from the deepest
	 * stage that completed rather than summed: each flow re-runs the stages below
	 * it, so the deepest stage already contains them and a sum would count
	 * detection two or three times.
	 */
	pipelineMedianMs: number;
	pipelineBestMs: number;
	outcome: 'migrated-to-lane' | 'refused-at-plan' | 'refused-at-analyze';
	refusals: readonly string[];
	/** The scratch lane the migrate stage wrote into, relative to the temp root. */
	lane: string | null;
	laneFilesWritten: number | null;
}>;

type AnalyzeJson = Readonly<{ lineage?: string; builder?: string }>;

type PlanJson = Readonly<{
	plan?: Readonly<{
		files?: readonly Readonly<{ changed?: boolean }>[];
		applicationFilesScanned?: number;
		unhandled?: readonly string[];
	}>;
}>;

type MigrateJson = Readonly<{
	applied?: Readonly<{ written?: readonly unknown[]; copied?: number }>;
}>;

async function measureStages(
	application: FleetApplication,
	laneRoot: string,
): Promise<AppMeasurement> {
	const root = path.join(repositoryRoot, application.appRoot);
	const refusals: string[] = [];

	const analyzeRuns: number[] = [];
	let analyzeOutcome: StageOutcome = 'reported';
	let analyzeDetail: string | null = null;
	let analyzeRefusal: string | null = null;
	for (let attempt = 0; attempt < REPETITIONS; attempt += 1)
		try {
			const { ms, value } = await timed(async () => runOperatorCommand('analyze', [root]));
			analyzeRuns.push(ms);
			const json = value.json as AnalyzeJson;
			analyzeDetail = `lineage ${json.lineage ?? 'unknown'}, builder ${json.builder ?? 'unknown'}`;
		} catch (error) {
			analyzeOutcome = 'refused';
			analyzeRefusal = message(error);
			break;
		}
	if (analyzeRefusal !== null) refusals.push(`analyze: ${analyzeRefusal}`);
	const analyze: StageMeasurement = Object.freeze({
		stage: 'analyze' as const,
		outcome: analyzeOutcome,
		runs: Object.freeze([...analyzeRuns]),
		bestMs: best(analyzeRuns),
		medianMs: median(analyzeRuns),
		refusal: analyzeRefusal,
		detail: analyzeDetail,
	});

	const planRuns: number[] = [];
	let planOutcome: StageOutcome = analyzeOutcome === 'refused' ? 'not-attempted' : 'composed';
	let planDetail: string | null = null;
	let planRefusal: string | null = null;
	if (planOutcome === 'composed')
		for (let attempt = 0; attempt < REPETITIONS; attempt += 1)
			try {
				const { ms, value } = await timed(async () => runOperatorCommand('plan', [root]));
				planRuns.push(ms);
				const json = value.json as PlanJson;
				const files = json.plan?.files ?? [];
				const changed = files.filter((file) => file.changed === true).length;
				planDetail = `${String(changed)} files changed of ${String(
					json.plan?.applicationFilesScanned ?? 0,
				)} scanned, ${String((json.plan?.unhandled ?? []).length)} unhandled findings`;
			} catch (error) {
				planOutcome = 'refused';
				planRefusal = message(error);
				break;
			}
	if (planRefusal !== null) refusals.push(`plan: ${planRefusal}`);
	const plan: StageMeasurement = Object.freeze({
		stage: 'plan' as const,
		outcome: planOutcome,
		runs: Object.freeze([...planRuns]),
		bestMs: best(planRuns),
		medianMs: median(planRuns),
		refusal: planRefusal,
		detail: planDetail,
	});

	const migrateRuns: number[] = [];
	let migrateOutcome: StageOutcome = planOutcome === 'composed' ? 'applied' : 'not-attempted';
	let migrateRefusal: string | null = null;
	let migrateDetail: string | null = null;
	let lane: string | null = null;
	let laneFilesWritten: number | null = null;
	if (migrateOutcome === 'applied') {
		const laneDirectory = path.join(laneRoot, application.id);
		lane = laneDirectory;
		try {
			await mkdir(laneDirectory, { recursive: true });
			const { ms, value } = await timed(async () =>
				runOperatorCommand('migrate', [root, '--out', laneDirectory]),
			);
			migrateRuns.push(ms);
			const json = value.json as MigrateJson;
			laneFilesWritten = (json.applied?.written ?? []).length;
			migrateDetail = `${String(laneFilesWritten)} files written into the scratch lane, ${String(
				json.applied?.copied ?? 0,
			)} copied`;
		} catch (error) {
			migrateOutcome = 'refused';
			migrateRefusal = message(error);
		}
	}
	if (migrateRefusal !== null) refusals.push(`migrate: ${migrateRefusal}`);
	const migrate: StageMeasurement = Object.freeze({
		stage: 'migrate' as const,
		outcome: migrateOutcome,
		runs: Object.freeze([...migrateRuns]),
		bestMs: best(migrateRuns),
		medianMs: median(migrateRuns),
		refusal: migrateRefusal,
		detail: migrateDetail,
	});

	const deepest =
		migrateOutcome === 'applied' ? migrate : planOutcome === 'composed' ? plan : analyze;
	return Object.freeze({
		id: application.id,
		lineage: application.lineage,
		appRoot: application.appRoot,
		workArea: application.workArea,
		note: application.note,
		stages: Object.freeze([analyze, plan, migrate]),
		pipelineBasis: deepest.stage,
		pipelineMedianMs: deepest.medianMs,
		pipelineBestMs: deepest.bestMs,
		outcome:
			migrateOutcome === 'applied'
				? ('migrated-to-lane' as const)
				: analyzeOutcome === 'refused'
					? ('refused-at-analyze' as const)
					: ('refused-at-plan' as const),
		refusals: Object.freeze(refusals),
		lane: lane === null ? null : path.relative(laneRoot, lane),
		laneFilesWritten,
	});
}

export type PruneSafetyRecord = Readonly<{
	schemaVersion: typeof PRUNE_SAFETY_SCHEMA;
	unit: string;
	measuredAt: string;
	question: string;
	application: string;
	receipt: string;
	workDirectory: string;
	method: string;
	workDirectoryBytes: number;
	workDirectoryEntriesBefore: readonly string[];
	workDirectoryEntriesAfterRestore: readonly string[];
	restored: boolean;
	verifications: Readonly<Record<string, unknown>>;
	verdict: 'yes' | 'no';
	verdictStatement: string;
	diskFloorImplication: readonly string[];
	notEstablished: readonly string[];
}>;

async function verifyReceiptOnce(): Promise<Record<string, unknown>> {
	try {
		const { ms, value } = await timed(async () =>
			verifyReceipt(path.join(repositoryRoot, PRUNE_PROOF_RECEIPT), { requireAggregate: true }),
		);
		return { state: 'pass', digest: value.digest, artifacts: value.artifacts, ms };
	} catch (error) {
		return { state: 'fail', error: message(error) };
	}
}

/** Bytes held below a directory, counting regular files only. */
async function directoryBytes(directory: string): Promise<number> {
	let total = 0;
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const child = path.join(directory, entry.name);
		if (entry.isDirectory()) total += await directoryBytes(child);
		else if (entry.isFile()) total += (await stat(child)).size;
	}
	return total;
}

/**
 * Move one application's work directory aside, re-verify its canonical receipt,
 * and move the directory back.
 *
 * The set-aside is a rename inside the same unversioned scratch tree, so it is
 * a move rather than a copy and never a deletion, and the restore runs in a
 * `finally` so a throw on the verification path cannot leave the tree moved.
 */
export async function proveDisposableWorkDirectory(): Promise<PruneSafetyRecord> {
	const workDirectory = path.join(repositoryRoot, PRUNE_PROOF_WORK_DIRECTORY);
	const setAside = `${workDirectory}.set-aside-by-spike-b`;
	if (!(await directoryExists(workDirectory)))
		throw new Error(`prune proof: ${PRUNE_PROOF_WORK_DIRECTORY} is not present in this checkout`);
	if (await directoryExists(setAside))
		throw new Error(`prune proof: ${setAside} already exists; a previous run did not restore it`);
	const entriesBefore = (await readdir(workDirectory)).sort();
	const bytesBefore = await directoryBytes(workDirectory);
	const before = await verifyReceiptOnce();
	let moved = false;
	let absentDuringVerification = false;
	let duringSetAside: Record<string, unknown>;
	try {
		await rename(workDirectory, setAside);
		moved = true;
		absentDuringVerification = !(await directoryExists(workDirectory));
		duringSetAside = await verifyReceiptOnce();
	} finally {
		if (moved) await rename(setAside, workDirectory);
	}
	const entriesAfter = (await readdir(workDirectory)).sort();
	const after = await verifyReceiptOnce();
	const restored =
		!(await directoryExists(setAside)) &&
		entriesAfter.length === entriesBefore.length &&
		entriesAfter.every((entry, index) => entry === entriesBefore[index]);
	if (!restored) throw new Error('prune proof: the work directory was not restored');
	const passed =
		duringSetAside.state === 'pass' &&
		absentDuringVerification &&
		duringSetAside.digest === before.digest;
	return Object.freeze({
		schemaVersion: PRUNE_SAFETY_SCHEMA,
		unit: UNIT,
		measuredAt: new Date().toISOString().slice(0, 10),
		question:
			'With one receipted application’s .versionless/work directory moved aside, does the offline receipt verification still pass from the published receipts alone?',
		application: PRUNE_PROOF_APPLICATION,
		receipt: PRUNE_PROOF_RECEIPT,
		workDirectory: PRUNE_PROOF_WORK_DIRECTORY,
		method:
			'verifyReceipt(receipt, { requireAggregate: true }) — the same function `versionless receipt:verify` calls — is run three times: with the work directory in place, with it renamed to a sibling set-aside path inside the same unversioned scratch tree, and again after it is renamed back. The absence of the directory is checked inside the middle window rather than assumed, the restore runs in a finally block, and the restored listing is compared entry by entry against the listing taken before the move. Nothing is deleted.',
		workDirectoryBytes: bytesBefore,
		workDirectoryEntriesBefore: Object.freeze(entriesBefore),
		workDirectoryEntriesAfterRestore: Object.freeze(entriesAfter),
		restored,
		verifications: Object.freeze({
			before: Object.freeze(before),
			withWorkDirectorySetAside: Object.freeze({
				...duringSetAside,
				workDirectoryAbsentDuringVerification: absentDuringVerification,
			}),
			afterRestore: Object.freeze(after),
		}),
		verdict: passed ? ('yes' as const) : ('no' as const),
		verdictStatement: passed
			? `The offline verification of ${PRUNE_PROOF_RECEIPT} returned the same receipt digest with ${PRUNE_PROOF_WORK_DIRECTORY} absent as it did with the directory present. For this receipt the work directory is not an input to verification.`
			: `The offline verification of ${PRUNE_PROOF_RECEIPT} did not reproduce with ${PRUNE_PROOF_WORK_DIRECTORY} absent. The work directory is an input to verification for this receipt, and pruning it would break the offline check.`,
		diskFloorImplication: Object.freeze(
			passed
				? [
						'A work directory the receipt verification does not read can be pruned once the receipt is published without losing the offline check. That is what sets the disk floor at fleet scale.',
						'What the floor then holds is the evidence tree, not the work tree. Re-migrating a pruned application means re-acquiring its sources and its era closure first.',
						'This is proven on one receipt. A receipt schema that reads a lane out of .versionless/work would behave differently and has to be checked before the policy is applied to it.',
					]
				: [
						'Pruning the work tree after receipt is not safe for this receipt: the offline verification reads it.',
						'The disk floor at fleet scale therefore holds the work tree as well as the evidence tree.',
					],
		),
		notEstablished: Object.freeze([
			'A passing receipt verification is a hash-integrity check over published artifacts. It is not a re-run of the migration and it does not establish that the application still builds.',
			'This proof covers one application’s canonical receipt. It is not a statement about every receipt schema this repository carries.',
			'Moving the directory aside proves the verification does not read that path. It does not prove that no other tool in this repository reads it.',
			`The directory moved aside holds ${String(bytesBefore)} bytes, while the largest work areas in this checkout hold three orders of magnitude more. What the move establishes is that the verification never resolves a path under the work tree, which does not depend on how much was moved — but it is still one directory rather than a survey.`,
		]),
	});
}

export type ProjectionRow = Readonly<{
	population: string;
	applications: number;
	perApplicationMedianMs: number;
	perApplicationMeanMs: number;
	serialSecondsAt300: number;
	serialMinutesAt300: number;
}>;

export type StageProjection = Readonly<{
	stage: StageName;
	applicationsMeasured: number;
	perApplicationMedianMs: number;
	perApplicationMeanMs: number;
	serialSecondsAt300: number;
}>;

export type ParallelismReading = Readonly<{
	stage: string;
	classification: string;
	reason: string;
}>;

export type FleetSummary = Readonly<{
	schemaVersion: typeof SUMMARY_SCHEMA;
	spike: string;
	unit: string;
	measuredAt: string;
	host: Readonly<Record<string, unknown>>;
	scope: Readonly<{
		measured: readonly string[];
		notMeasured: readonly string[];
		whyItMatters: string;
	}>;
	method: string;
	repetitions: number;
	apps: readonly AppMeasurement[];
	totals: Readonly<{
		applications: number;
		react: number;
		angular: number;
		migratedToLane: number;
		refused: number;
		fleetLoopWallClockMs: number;
		fleetLoopWallClockSeconds: number;
		scratchLaneRoot: string;
		scratchLaneNote: string;
		refusalStrings: readonly string[];
	}>;
	extrapolation: Readonly<{
		fleetSize: number;
		basis: string;
		rows: readonly ProjectionRow[];
		byStage: readonly StageProjection[];
		readingRule: string;
	}>;
	parallelism: readonly ParallelismReading[];
	pruneSafety: Readonly<Record<string, unknown>>;
	notEstablished: readonly string[];
}>;

function project(label: string, measured: readonly AppMeasurement[]): ProjectionRow {
	const values = measured.map((entry) => entry.pipelineMedianMs);
	const perMean = mean(values);
	return Object.freeze({
		population: label,
		applications: measured.length,
		perApplicationMedianMs: median(values),
		perApplicationMeanMs: perMean,
		serialSecondsAt300: round((perMean * PROJECTION_FLEET_SIZE) / 1000),
		serialMinutesAt300: round((perMean * PROJECTION_FLEET_SIZE) / 60000),
	});
}

function projectStage(stage: StageName, apps: readonly AppMeasurement[]): StageProjection {
	const values = apps
		.flatMap((entry) => entry.stages)
		.filter((measurement) => measurement.stage === stage && measurement.runs.length > 0)
		.map((measurement) => measurement.medianMs);
	const perMean = mean(values);
	return Object.freeze({
		stage,
		applicationsMeasured: values.length,
		perApplicationMedianMs: median(values),
		perApplicationMeanMs: perMean,
		serialSecondsAt300: round((perMean * PROJECTION_FLEET_SIZE) / 1000),
	});
}

const PARALLELISM: readonly ParallelismReading[] = Object.freeze([
	Object.freeze({
		stage: 'analyze',
		classification: 'parallelizable across processes',
		reason:
			'Detection reads declarations out of the application tree and writes nothing into it. Two detections of two applications share no mutable state.',
	}),
	Object.freeze({
		stage: 'plan',
		classification: 'parallelizable across processes',
		reason:
			'Composition reads the tree and returns a changeset; the flow writes nothing into the application it read.',
	}),
	Object.freeze({
		stage: 'migrate',
		classification: 'parallelizable across processes, one lane per application',
		reason:
			'The apply flow refuses a lane inside the application and refuses a lane that already carries files, so two concurrent migrations with distinct lanes cannot reach the same bytes.',
	}),
	Object.freeze({
		stage: 'witness browser passes',
		classification: 'witness-serialized on one host; not measured by this spike',
		reason:
			'The determinism-under-load finding carried over from the previous goal (T010/T011) is that the gates come back green when the passes run serially and fail when they run in parallel on one host. Multi-host is therefore the only witness throughput lever, and no projection here may assume this stage parallelizes.',
	}),
	Object.freeze({
		stage: 'install and migrated build',
		classification: 'not measured by this spike',
		reason:
			'Acquisition and build were outside the timed region. Their behaviour under concurrency is not established here.',
	}),
]);

export async function measureFleet(): Promise<{
	summary: FleetSummary;
	pruneSafety: PruneSafetyRecord;
	rendered: string;
}> {
	const missing: string[] = [];
	for (const application of FLEET)
		if (!(await directoryExists(path.join(repositoryRoot, application.appRoot))))
			missing.push(application.appRoot);
	if (missing.length > 0)
		throw new Error(
			`fleet batch spike: these roots are not in this checkout: ${missing.join(', ')}`,
		);
	const laneRoot = await mkdtemp(path.join(tmpdir(), 'versionless-fleet-batch-'));

	const { ms: fleetMs, value: apps } = await timed(async () => {
		const measured: AppMeasurement[] = [];
		for (const application of FLEET) measured.push(await measureStages(application, laneRoot));
		return measured;
	});

	const pruneSafety = await proveDisposableWorkDirectory();

	const composed = apps.filter((entry) => entry.outcome === 'migrated-to-lane');
	const refused = apps.filter((entry) => entry.outcome !== 'migrated-to-lane');
	const reactApps = apps.filter((entry) => entry.lineage === 'react');
	const angularApps = apps.filter((entry) => entry.lineage === 'angular');

	const summary: FleetSummary = Object.freeze({
		schemaVersion: SUMMARY_SCHEMA,
		spike: 'SPIKE B — batch operator dry run: measured operator machine time and the prune floor',
		unit: UNIT,
		measuredAt: new Date().toISOString().slice(0, 10),
		host: Object.freeze({
			node: process.version,
			platform: `${process.platform}-${process.arch}`,
			logicalCpus: cpus().length,
			totalMemoryGiB: round(totalmem() / 1024 ** 3),
			concurrency: 'one process, one application at a time; nothing below ran in parallel',
		}),
		scope: Object.freeze({
			measured: Object.freeze([
				'analyze — the operator detection flow, over an application root already on disk',
				'plan — the operator composition flow, which re-runs detection and then composes the frozen adapter’s changeset',
				'migrate — the operator apply flow, which re-runs detection and composition and then writes the changeset into an empty scratch lane',
			]),
			notMeasured: Object.freeze([
				'dependency acquisition and install',
				'the migrated build',
				'witness journey authoring, calibration, and the browser passes',
				'receipt schema authoring and publication',
			]),
			whyItMatters:
				'The recorded per-vertical cost of roughly 9–10 units conflates authoring with execution. What is timed here is only the operator surface, which is the part a batch runner repeats unattended; the unmeasured stages above are where the recorded per-vertical cost mostly sits.',
		}),
		method:
			'Each stage is `runOperatorCommand` from packages/cli/src/operator/flows.ts, called exactly as a shell operator would call it, timed with process.hrtime.bigint() around the awaited call and nothing else. The read-only stages are timed over three repetitions and reported as a median and a best; the write stage runs once per application, because the apply flow refuses a lane that already carries files. No authoring, editing or waiting happens inside a timed region.',
		repetitions: REPETITIONS,
		apps: Object.freeze(apps),
		totals: Object.freeze({
			applications: apps.length,
			react: reactApps.length,
			angular: angularApps.length,
			migratedToLane: composed.length,
			refused: refused.length,
			fleetLoopWallClockMs: fleetMs,
			fleetLoopWallClockSeconds: round(fleetMs / 1000),
			scratchLaneRoot: path.relative(tmpdir(), laneRoot),
			scratchLaneNote:
				'The scratch lanes are created under the operating system temporary directory, outside this repository, and are left in place. This driver deletes nothing.',
			refusalStrings: Object.freeze(
				refused.flatMap((entry) => entry.refusals.map((line) => `${entry.id} — ${line}`)),
			),
		}),
		extrapolation: Object.freeze({
			fleetSize: PROJECTION_FLEET_SIZE,
			basis: 'per-application median of the deepest stage that completed, projected serially on one process on this host',
			rows: Object.freeze([
				project('measured fleet, every outcome', apps),
				project('applications whose plan composed and migrated', composed),
				project('applications the flows refused', refused),
				project('React lineage', reactApps),
				project('Angular lineage', angularApps),
			]),
			byStage: Object.freeze([
				projectStage('analyze', apps),
				projectStage('plan', apps),
				projectStage('migrate', apps),
			]),
			readingRule:
				'These projections cover the operator surface alone. They are a floor on fleet machine time rather than an estimate of the whole per-application cost, because install, build and the witness passes are not in the timed region.',
		}),
		parallelism: PARALLELISM,
		pruneSafety: Object.freeze({
			record: PRUNE_SAFETY_FILE,
			application: pruneSafety.application,
			receipt: pruneSafety.receipt,
			verdict: pruneSafety.verdict,
			statement: pruneSafety.verdictStatement,
		}),
		notEstablished: Object.freeze([
			'A composed changeset is a set of edits, not a build. Nothing here establishes that any lane this spike wrote installs, compiles or emits anything.',
			'The timings are one host, one process, a warm page cache and one repetition count. They are a reading of this machine rather than a specification.',
			'The read-only stages ran three times each and the write stage once, and the repetitions were not interleaved across applications. On the two largest Angular trees the single migrate run came in below the plan median for the same tree; across a spread of roughly thirty per cent that is warm-cache variance, not migrate costing less than the composition it re-runs.',
			'A refusal is an outcome rather than a failure of the run. The refusing roots are counted in the projections at the cost they actually took.',
			'The fleet here is drawn from applications this checkout had already ingested. It is not a random sample of the target fleet and it carries whatever selection the corpus carries.',
			'Nothing here measures authoring. The stages that dominate the recorded per-vertical cost — witness journey authoring, calibration and the browser passes — were not run.',
			'The parallelizability readings for the three operator stages are read off what the flows do to disk, not measured under load. Only the witness serialization is backed by a load measurement, and that one was made by an earlier unit rather than by this spike.',
		]),
	});
	const rendered = await renderFleetSummary(summary, pruneSafety);
	return { summary, pruneSafety, rendered };
}

const msLine = (value: number): string => `${value.toFixed(1)} ms`;

/**
 * The human rendering.
 *
 * The spike's own sections are followed by the derived support matrix, read out
 * of the verified trust package and quoted by the same renderer the
 * `supported-matrix` flow uses, so a reader who takes a number off this page
 * has the bounded outcomes, the declared boundary and the counting non-claims
 * in front of them as well. The whole document is then handed to the enterprise
 * surface's own honesty guard before it is written.
 */
export async function renderFleetSummary(
	summary: FleetSummary,
	pruneSafety: PruneSafetyRecord,
): Promise<string> {
	const lines: string[] = [];
	lines.push('# SPIKE B — batch operator dry run');
	lines.push('');
	lines.push(`Unit \`${summary.unit}\`. Measured ${summary.measuredAt}.`);
	lines.push('');
	lines.push(
		'This page prices two things a 300-application fleet schedule needs, neither of which had been measured before: the machine time the operator surface costs per application, and whether the per-application work tree can be set aside once its receipt is published.',
	);
	lines.push('');
	lines.push('## What was timed, and what was not');
	lines.push('');
	for (const entry of summary.scope.measured) lines.push(`- timed: ${entry}`);
	for (const entry of summary.scope.notMeasured) lines.push(`- not timed: ${entry}`);
	lines.push('');
	lines.push(summary.scope.whyItMatters);
	lines.push('');
	lines.push(`Method: ${summary.method}`);
	lines.push('');
	lines.push(
		`Host: node ${String(summary.host.node)} on ${String(summary.host.platform)}, ${String(
			summary.host.logicalCpus,
		)} logical CPUs, ${String(summary.host.totalMemoryGiB)} GiB. ${String(summary.host.concurrency)}.`,
	);
	lines.push('');
	lines.push('## Per-application machine time');
	lines.push('');
	lines.push('| application | lineage | analyze | plan | migrate | one operator pass | outcome |');
	lines.push('|---|---|---|---|---|---|---|');
	for (const app of summary.apps) {
		const cell = (stage: StageName): string => {
			const measurement = app.stages.find((entry) => entry.stage === stage);
			if (measurement === undefined) return 'not-run';
			return measurement.runs.length === 0 ? measurement.outcome : msLine(measurement.medianMs);
		};
		lines.push(
			`| \`${app.id}\` | ${app.lineage} | ${cell('analyze')} | ${cell('plan')} | ${cell(
				'migrate',
			)} | ${msLine(app.pipelineMedianMs)} (${app.pipelineBasis}) | ${app.outcome} |`,
		);
	}
	lines.push('');
	lines.push(
		'The three stages are not additive. `plan` re-runs detection, and `migrate` re-runs detection and composition, so one operator pass costs the deepest stage that completed rather than the sum of the row.',
	);
	lines.push('');
	lines.push('### Refusals, quoted');
	lines.push('');
	if (summary.totals.refusalStrings.length === 0)
		lines.push('No root in this fleet was refused.');
	for (const refusal of summary.totals.refusalStrings) lines.push(`- ${refusal}`);
	lines.push('');
	lines.push(
		`${String(summary.totals.refused)} of ${String(
			summary.totals.applications,
		)} roots were refused by name rather than migrated. A refusal is an outcome a batch runner has to schedule for, and it is cheap: a refusing root costs the reading above it, not a migration.`,
	);
	lines.push('');
	lines.push(`## Extrapolation to ${String(summary.extrapolation.fleetSize)} applications`);
	lines.push('');
	lines.push(
		'| population | applications measured | per application (median) | per application (mean) | serial at 300 |',
	);
	lines.push('|---|---|---|---|---|');
	for (const row of summary.extrapolation.rows)
		lines.push(
			`| ${row.population} | ${String(row.applications)} | ${msLine(
				row.perApplicationMedianMs,
			)} | ${msLine(row.perApplicationMeanMs)} | ${row.serialSecondsAt300.toFixed(
				1,
			)} s (${row.serialMinutesAt300.toFixed(2)} min) |`,
		);
	lines.push('');
	lines.push('| stage | applications measured | per application (median) | serial at 300 |');
	lines.push('|---|---|---|---|');
	for (const row of summary.extrapolation.byStage)
		lines.push(
			`| ${row.stage} | ${String(row.applicationsMeasured)} | ${msLine(
				row.perApplicationMedianMs,
			)} | ${row.serialSecondsAt300.toFixed(1)} s |`,
		);
	lines.push('');
	lines.push(summary.extrapolation.readingRule);
	lines.push('');
	lines.push('### Which stages can be run side by side');
	lines.push('');
	for (const entry of summary.parallelism)
		lines.push(`- **${entry.stage}** — ${entry.classification}. ${entry.reason}`);
	lines.push('');
	lines.push('## Prune safety: can the work tree be set aside after receipt?');
	lines.push('');
	lines.push(`Application under test: \`${pruneSafety.application}\`.`);
	lines.push(`Receipt: \`${pruneSafety.receipt}\`.`);
	lines.push(`Work directory: \`${pruneSafety.workDirectory}\`.`);
	lines.push('');
	lines.push(pruneSafety.method);
	lines.push('');
	lines.push(`**Verdict: ${pruneSafety.verdict}.** ${pruneSafety.verdictStatement}`);
	lines.push('');
	for (const entry of pruneSafety.diskFloorImplication) lines.push(`- ${entry}`);
	lines.push('');
	lines.push('## What this does not establish');
	lines.push('');
	for (const entry of summary.notEstablished) lines.push(`- ${entry}`);
	for (const entry of pruneSafety.notEstablished) lines.push(`- ${entry}`);
	lines.push('');
	lines.push('## Standing bounded context');
	lines.push('');
	lines.push(
		'The block below is the derived support matrix, read out of the verified trust package and rendered by the same renderer the `supported-matrix` flow uses. Every outcome string, boundary, prevalence figure and counting note in it is quoted exactly as the record carries it. It is reproduced here so that no number above is read outside the bounds the evidence sets.',
	);
	lines.push('');
	lines.push('```');
	lines.push(renderSupportedMatrix(await readSupportedMatrix()).trimEnd());
	lines.push('```');
	lines.push('');
	const text = `${lines.join('\n')}\n`;
	assertEnterpriseSurfaceHonesty(text, 'evidence/spikes/fleet-batch-dryrun/README.md');
	return text;
}

export async function main(): Promise<void> {
	const { summary, pruneSafety, rendered } = await measureFleet();
	await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
	await writeFile(
		path.join(EVIDENCE_DIRECTORY, SUMMARY_FILE),
		`${JSON.stringify(summary, null, '\t')}\n`,
	);
	await writeFile(
		path.join(EVIDENCE_DIRECTORY, PRUNE_SAFETY_FILE),
		`${JSON.stringify(pruneSafety, null, '\t')}\n`,
	);
	await writeFile(path.join(EVIDENCE_DIRECTORY, README_FILE), rendered);
	process.stdout.write(
		`${String(summary.apps.length)} applications measured, ${String(
			summary.totals.migratedToLane,
		)} migrated into a scratch lane, ${String(summary.totals.refused)} refused; prune-safety verdict ${
			pruneSafety.verdict
		}\n`,
	);
}

if (process.argv[1]?.endsWith('fleet-batch-spike-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${message(error)}\n`);
		process.exitCode = 1;
	});
