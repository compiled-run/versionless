/**
 * The human-intervention counter: a harness *outside* the command it scores.
 *
 * The zero-manual-steps gate is the half of the oracle that inflates quietly,
 * and the way it inflates is by being scored by the thing under test. A run
 * that reports its own intervention count reports the number a bad stage would
 * report. So this module never runs a stage: it snapshots the disk, spawns
 * `versionless run` exactly once as a child process, re-snapshots, diffs, and
 * writes the record. `run` is not asked what it did; it is observed.
 *
 * Four counters, and the gate passes only when all four are zero. A zero here
 * is asserted rather than assumed — each counter names what it looked at, so
 * "no evidence of hand-help" and "evidence of no hand-help" stay different
 * statements.
 *
 * **C1 — worktree mutation outside the declared write set.** Every tracked path
 * in the checkout, plus the application root and the lane parent, hashed before
 * and after. The command declares its write set (`--out`, `--record`, and the
 * `evidence/**` paths it names); a changed or created path outside that set is
 * one intervention, named.
 *
 * **C2 — prompt / stdin reads.** The child is spawned with stdin `ignore` and
 * `CI=1`, so a read of stdin cannot be answered by construction. A child that
 * emits no stdout for longer than the stage budget is a **hang**, which the
 * charter classifies as a defect — scored `defect:hang`, never as an
 * intervention and never as a refusal.
 *
 * **C3 — invocations.** One spawn is permitted. A second command — a retry with
 * different flags included — is one intervention per retry, because choosing
 * the flags for the retry is exactly the operator decision this gate counts.
 *
 * **C4 — authoring-home writes.** The eight authoring homes, hashed before and
 * after. A create or a modify in any of them is one intervention per file,
 * named. This is the counter aimed at silent manual residue: an application
 * that "ran unattended" while a fixture was quietly authored beside it.
 *
 * Nothing here throws. A harness that raises where it is supposed to observe
 * loses the record, and the record is the whole point; every failure this can
 * meet is a classification instead (`defect:no-run-record`,
 * `defect:spawn-failed`).
 */

import { spawn } from 'node:child_process';
import { execFile } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';
import { promisify } from 'node:util';
import * as path from 'pathe';
import { sha256 } from '../../../core/src/receipts/canonicalize.ts';
import { displayPath, writeRecord } from './record.ts';

const execute = promisify(execFile);

export const INTERVENTION_COUNT_SCHEMA = 'versionless.intervention-count.v1';

/** Where the harness record is filed beside a run record at `<file>`. */
export function interventionRecordPathFor(runRecord: string): string {
	return `${runRecord}.interventions.json`;
}

/** The default stage budget: the longest a stage may be silent before it hangs. */
export const DEFAULT_STAGE_BUDGET_MS = 900_000;

/**
 * The eight authoring homes, as the plan validation names them.
 *
 * A `prefix` matches everything below a directory; a `file` is exact; a
 * `suffix` pair matches a file below a prefix whose name ends the given way.
 * They are matched against checkout-relative POSIX paths.
 */
export type AuthoringHome = Readonly<{
	home: string;
	kind: 'prefix' | 'file' | 'prefix-suffix';
	prefix?: string;
	suffixes?: readonly string[];
}>;

export const AUTHORING_HOMES: readonly AuthoringHome[] = Object.freeze([
	Object.freeze({ home: 'fixtures/**', kind: 'prefix' as const, prefix: 'fixtures/' }),
	Object.freeze({
		home: 'packages/cli/src/fixture/**',
		kind: 'prefix' as const,
		prefix: 'packages/cli/src/fixture/',
	}),
	Object.freeze({
		home: 'packages/cli/src/witness/**',
		kind: 'prefix' as const,
		prefix: 'packages/cli/src/witness/',
	}),
	Object.freeze({
		home: 'packages/core/src/receipts/witness-*.ts',
		kind: 'prefix-suffix' as const,
		prefix: 'packages/core/src/receipts/witness-',
		suffixes: Object.freeze(['.ts']),
	}),
	Object.freeze({
		home: 'packages/core/src/receipts/capability-coverage.ts',
		kind: 'file' as const,
		prefix: 'packages/core/src/receipts/capability-coverage.ts',
	}),
	Object.freeze({
		home: 'packages/core/src/corpus/conformance.ts',
		kind: 'file' as const,
		prefix: 'packages/core/src/corpus/conformance.ts',
	}),
	Object.freeze({
		home: 'packages/trust/src/generate.ts',
		kind: 'file' as const,
		prefix: 'packages/trust/src/generate.ts',
	}),
	Object.freeze({
		home: 'packages/cli/src/fixture/legacy-candidate-ingest.ts',
		kind: 'file' as const,
		prefix: 'packages/cli/src/fixture/legacy-candidate-ingest.ts',
	}),
	Object.freeze({
		home: '.versionless/work/**/*.{mjs,sh}',
		kind: 'prefix-suffix' as const,
		prefix: '.versionless/work/',
		suffixes: Object.freeze(['.mjs', '.sh']),
	}),
]);

/** The authoring home a checkout-relative path sits in, or `null`. */
export function authoringHomeOf(relative: string): string | null {
	for (const home of AUTHORING_HOMES) {
		const prefix = home.prefix ?? '';
		if (home.kind === 'file') {
			if (relative === prefix) return home.home;
			continue;
		}
		if (!relative.startsWith(prefix)) continue;
		if (home.kind === 'prefix') return home.home;
		if ((home.suffixes ?? []).some((suffix) => relative.endsWith(suffix))) return home.home;
	}
	return null;
}

export type SpawnAttempt = Readonly<{
	/** The arguments handed to this runtime, as the harness spawned them. */
	argv: readonly string[];
	exitCode: number | null;
	signal: string | null;
	/** A child killed for emitting no stdout inside the stage budget. */
	hang: boolean;
	stdoutBytes: number;
	stderrBytes: number;
	startedAt: string;
	endedAt: string;
	/** Set when the child could not be spawned at all. */
	spawnError?: string;
}>;

export type InterventionCountRecord = Readonly<{
	schemaVersion: typeof INTERVENTION_COUNT_SCHEMA;
	flow: 'intervention-count';
	application: string;
	lane: string;
	runRecord: string;
	/** The paths the command declared it writes. Everything else is counted. */
	writeSet: readonly string[];
	invocations: number;
	stdinReads: number;
	mutatedPathsOutsideWriteSet: readonly string[];
	authoringPathsTouched: readonly string[];
	interventionCount: number;
	exitCode: number;
	terminalClassification: string;
	attempts: readonly SpawnAttempt[];
	observation: Readonly<{
		stdio: string;
		environment: Readonly<Record<string, string>>;
		stageBudgetMs: number;
		trackedPathsSource: 'git' | 'directory-walk';
		pathsObservedBefore: number;
		pathsObservedAfter: number;
		authoringHomes: readonly string[];
	}>;
	notEstablished: readonly string[];
}>;

export type InterventionCountDeclarations = Readonly<{
	appRoot: string;
	/** The lane `run` was told to write, which is the first declared write path. */
	out: string;
	/** Where `run` was told to file its own record; the second declared write path. */
	runRecord: string;
	/** The checkout whose tracked paths are hashed. Defaults to the working directory. */
	root: string;
	/** The `evidence/**` paths the command names, if any. */
	evidencePaths: readonly string[];
	/**
	 * The command lines spawned, in order. One is the permitted case; a second
	 * entry is a retry, and a retry is an operator decision this gate counts.
	 */
	attempts: readonly (readonly string[])[];
	stageBudgetMs: number;
}>;

const NOT_ESTABLISHED: readonly string[] = Object.freeze([
	'This is a count of interventions this harness could observe from outside the command: bytes on disk that changed, how many times a process was spawned, and whether stdin could have been read. It is not a statement that the run produced a working application.',
	'`node_modules` and `.git` are not walked below the application root or the lane parent. A change inside an installed dependency tree is not observed here, and the counters do not establish that none happened.',
	'A directory walk observes files. A permission change, a symlink retarget, or a file whose bytes were rewritten identically is not a change this harness counts.',
	'`stdinReads: 0` is a construction, not a measurement of the child’s syscalls: the child was spawned with stdin `ignore` and `CI=1`, so a prompt had nothing to read and no answer could have been supplied.',
	'A hang is a defect, not a refusal and not an intervention. It says the child emitted no stdout inside the stage budget; it does not establish what the child would have done given longer.',
	'A refusal exit is a terminal outcome, not an intervention. Nothing here establishes what the run would have reached had the refusal not fired.',
]);

type Snapshot = ReadonlyMap<string, string>;

const SKIPPED_DIRECTORIES: readonly string[] = Object.freeze(['node_modules', '.git']);

async function hashFile(file: string): Promise<string | null> {
	try {
		return sha256(await readFile(file));
	} catch {
		return null;
	}
}

async function walkFiles(directory: string, into: string[]): Promise<void> {
	let entries;
	try {
		entries = await readdir(directory, { withFileTypes: true });
	} catch {
		return;
	}
	for (const entry of entries) {
		if (SKIPPED_DIRECTORIES.includes(entry.name)) continue;
		const full = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			await walkFiles(full, into);
			continue;
		}
		if (entry.isFile()) into.push(full);
	}
}

/** Every tracked path in the checkout, or `null` when Git cannot answer. */
async function trackedPaths(root: string): Promise<readonly string[] | null> {
	try {
		const { stdout } = await execute('git', ['ls-files', '-z'], {
			cwd: root,
			maxBuffer: 256 * 1024 * 1024,
		});
		const files = stdout.split('\0').filter((entry) => entry !== '');
		return files.length === 0 ? null : files.map((file) => path.join(root, file));
	} catch {
		return null;
	}
}

/**
 * Hash every path this harness watches, once.
 *
 * The set is the same before and after by construction — it is recomputed both
 * times, so a file created by the child is present in the second reading and
 * absent from the first, which is how a creation is observed rather than
 * inferred.
 */
export async function snapshotWatchedPaths(
	declarations: Pick<InterventionCountDeclarations, 'root' | 'appRoot' | 'out'>,
): Promise<{ snapshot: Snapshot; source: 'git' | 'directory-walk' }> {
	const root = path.resolve(declarations.root);
	const tracked = await trackedPaths(root);
	const files: string[] = tracked === null ? [] : [...tracked];
	if (tracked === null) await walkFiles(root, files);
	await walkFiles(path.resolve(declarations.appRoot), files);
	await walkFiles(path.dirname(path.resolve(declarations.out)), files);
	const snapshot = new Map<string, string>();
	for (const file of new Set(files.map((file) => path.resolve(file)))) {
		const digest = await hashFile(file);
		if (digest !== null) snapshot.set(file, digest);
	}
	return { snapshot, source: tracked === null ? 'directory-walk' : 'git' };
}

/** Whether a path is one the command declared it writes. */
function insideWriteSet(file: string, writeSet: readonly string[]): boolean {
	return writeSet.some(
		(declared) => file === declared || file.startsWith(`${declared}${path.sep}`),
	);
}

function changedPaths(before: Snapshot, after: Snapshot): readonly string[] {
	const changed: string[] = [];
	for (const [file, digest] of after) if (before.get(file) !== digest) changed.push(file);
	for (const file of before.keys()) if (!after.has(file)) changed.push(file);
	return changed.sort();
}

type RunReading = Readonly<{ outcome?: unknown; refusal?: unknown; stages?: unknown }>;

/**
 * The terminal classification, read from the run's own record.
 *
 * The record is read rather than trusted for the count: what a run may state
 * about itself is what it refused with and which stages it reached, and those
 * are the facts this classification needs. The count is never taken from it.
 */
export function classifyTerminal(
	reading: RunReading | null,
	exitCode: number,
	hang: boolean,
): string {
	if (hang) return 'defect:hang';
	if (reading === null) return 'defect:no-run-record';
	const outcome = typeof reading.outcome === 'string' ? reading.outcome : 'not-recorded';
	if (outcome === 'refused') {
		const refusal = reading.refusal;
		const code =
			typeof refusal === 'object' && refusal !== null && 'code' in refusal
				? String((refusal as { code: unknown }).code)
				: 'unnamed';
		return `refused:${code}`;
	}
	if (outcome === 'defect') {
		const defect = (reading as { defect?: unknown }).defect;
		const stage =
			typeof defect === 'object' && defect !== null && 'stage' in defect
				? String((defect as { stage: unknown }).stage)
				: 'unnamed';
		return `defect:${stage}`;
	}
	if (outcome === 'proceeded') {
		const stages = Array.isArray(reading.stages) ? reading.stages : [];
		const everyStageRan =
			stages.length > 0 &&
			stages.every(
				(stage) =>
					typeof stage === 'object' &&
					stage !== null &&
					(stage as { status?: unknown }).status === 'ran',
			);
		if (exitCode === 0 && everyStageRan) return 'proven';
		return 'defect:stages-not-all-run';
	}
	if (outcome === 'not-run') return 'defect:no-stage-ran';
	return 'defect:outcome-not-classified';
}

async function readRunReading(file: string): Promise<RunReading | null> {
	try {
		const parsed: unknown = JSON.parse(await readFile(file, 'utf8'));
		return typeof parsed === 'object' && parsed !== null ? (parsed as RunReading) : null;
	} catch {
		return null;
	}
}

/**
 * Spawn one child and watch it: stdin closed, `CI=1`, stdout the only heartbeat.
 *
 * The budget re-arms on every stdout chunk rather than bounding the whole run,
 * because machine time is explicitly not an intervention — a stage that takes
 * twenty minutes and says so is not the thing being counted. A child that says
 * nothing for the whole budget is.
 */
export async function spawnWatched(
	argv: readonly string[],
	options: Readonly<{ cwd: string; stageBudgetMs: number }>,
): Promise<SpawnAttempt> {
	const startedAt = new Date().toISOString();
	return await new Promise<SpawnAttempt>((resolve) => {
		let stdoutBytes = 0;
		let stderrBytes = 0;
		let hang = false;
		let settled = false;
		const child = spawn(process.execPath, [...argv], {
			cwd: options.cwd,
			stdio: ['ignore', 'pipe', 'pipe'],
			env: { ...process.env, CI: '1' },
		});
		let timer: NodeJS.Timeout | null = null;
		const finish = (attempt: SpawnAttempt): void => {
			if (settled) return;
			settled = true;
			if (timer !== null) clearTimeout(timer);
			resolve(attempt);
		};
		const arm = (): void => {
			if (timer !== null) clearTimeout(timer);
			timer = setTimeout(() => {
				hang = true;
				child.kill('SIGKILL');
			}, options.stageBudgetMs);
			timer.unref();
		};
		child.stdout?.on('data', (chunk: Buffer) => {
			stdoutBytes += chunk.length;
			arm();
		});
		child.stderr?.on('data', (chunk: Buffer) => {
			stderrBytes += chunk.length;
		});
		child.on('error', (error: Error) => {
			finish(
				Object.freeze({
					argv: Object.freeze([...argv]),
					exitCode: null,
					signal: null,
					hang: false,
					stdoutBytes,
					stderrBytes,
					startedAt,
					endedAt: new Date().toISOString(),
					spawnError: error.message,
				}),
			);
		});
		child.on('close', (code: number | null, signal: string | null) => {
			finish(
				Object.freeze({
					argv: Object.freeze([...argv]),
					exitCode: code,
					signal,
					hang,
					stdoutBytes,
					stderrBytes,
					startedAt,
					endedAt: new Date().toISOString(),
				}),
			);
		});
		arm();
	});
}

/** The argv this harness spawns `run` with, from the declarations it was given. */
export function runArgvFor(
	cliEntry: string,
	declarations: Pick<InterventionCountDeclarations, 'appRoot' | 'out' | 'runRecord'>,
	forwarded: readonly string[],
): readonly string[] {
	return Object.freeze([
		'--experimental-strip-types',
		cliEntry,
		'run',
		declarations.appRoot,
		'--out',
		declarations.out,
		'--record',
		declarations.runRecord,
		...forwarded,
	]);
}

/** The CLI entry this harness spawns, resolved from this module rather than cwd. */
export function cliEntryPath(): string {
	return path.resolve(path.dirname(new URL(import.meta.url).pathname), '../cli.ts');
}

/**
 * Snapshot, spawn, re-snapshot, count.
 *
 * The order matters and is the whole method: nothing is read from the command
 * about itself except which refusal it named, and every counter is a difference
 * between two readings this harness took.
 */
export async function countInterventions(
	declarations: InterventionCountDeclarations,
): Promise<InterventionCountRecord> {
	const root = path.resolve(declarations.root);
	const laneAbsolute = path.resolve(declarations.out);
	const runRecordAbsolute = path.resolve(declarations.runRecord);
	const harnessRecordAbsolute = path.resolve(interventionRecordPathFor(declarations.runRecord));
	const writeSet = [
		laneAbsolute,
		runRecordAbsolute,
		harnessRecordAbsolute,
		...declarations.evidencePaths.map((entry) => path.resolve(root, entry)),
	];
	const before = await snapshotWatchedPaths(declarations);
	const attempts: SpawnAttempt[] = [];
	for (const argv of declarations.attempts)
		attempts.push(
			await spawnWatched(argv, { cwd: root, stageBudgetMs: declarations.stageBudgetMs }),
		);
	const after = await snapshotWatchedPaths(declarations);
	const last = attempts.at(-1);
	const mutated: string[] = [];
	const authoring: string[] = [];
	for (const file of changedPaths(before.snapshot, after.snapshot)) {
		const relative = path.relative(root, file).split(path.sep).join('/');
		const home = authoringHomeOf(relative);
		if (home !== null) {
			authoring.push(displayPath(file));
			continue;
		}
		if (insideWriteSet(file, writeSet)) continue;
		mutated.push(displayPath(file));
	}
	const hang = last?.hang === true;
	const exitCode = last === undefined ? 1 : (last.exitCode ?? 1);
	const reading = hang ? null : await readRunReading(runRecordAbsolute);
	const invocations = attempts.length;
	const stdinReads = 0;
	const interventionCount =
		Math.max(invocations - 1, 0) + stdinReads + mutated.length + authoring.length;
	const classification =
		last?.spawnError === undefined
			? classifyTerminal(reading, exitCode, hang)
			: 'defect:spawn-failed';
	return Object.freeze({
		schemaVersion: INTERVENTION_COUNT_SCHEMA,
		flow: 'intervention-count' as const,
		application: displayPath(declarations.appRoot),
		lane: displayPath(declarations.out),
		runRecord: displayPath(declarations.runRecord),
		writeSet: Object.freeze(writeSet.map((entry) => displayPath(entry))),
		invocations,
		stdinReads,
		mutatedPathsOutsideWriteSet: Object.freeze(mutated),
		authoringPathsTouched: Object.freeze(authoring),
		interventionCount,
		exitCode,
		terminalClassification: classification,
		attempts: Object.freeze(attempts),
		observation: Object.freeze({
			stdio: "['ignore', 'pipe', 'pipe']",
			environment: Object.freeze({ CI: '1' }),
			stageBudgetMs: declarations.stageBudgetMs,
			trackedPathsSource: before.source,
			pathsObservedBefore: before.snapshot.size,
			pathsObservedAfter: after.snapshot.size,
			authoringHomes: Object.freeze(AUTHORING_HOMES.map((home) => home.home)),
		}),
		notEstablished: NOT_ESTABLISHED,
	});
}

/** File the harness record beside the run record it scored. */
export async function writeInterventionRecord(
	runRecord: string,
	record: InterventionCountRecord,
): Promise<string> {
	const target = interventionRecordPathFor(runRecord);
	await writeRecord(target, record);
	return target;
}

/** Whether the lane parent exists, so a reader knows the walk had something to read. */
export async function directoryExists(directory: string): Promise<boolean> {
	try {
		return (await stat(directory)).isDirectory();
	} catch {
		return false;
	}
}

/** The count as an operator reads it: the four counters, then what they name. */
export function renderInterventionCount(record: InterventionCountRecord): string {
	const lines = [
		`application: ${record.application}`,
		`lane: ${record.lane}`,
		`run record: ${record.runRecord}`,
		'',
		`invocations                       ${String(record.invocations)}`,
		`stdin reads                       ${String(record.stdinReads)}`,
		`mutated outside the write set     ${String(record.mutatedPathsOutsideWriteSet.length)}`,
		`authoring-home paths touched      ${String(record.authoringPathsTouched.length)}`,
		'',
		`intervention count: ${String(record.interventionCount)}`,
		`terminal classification: ${record.terminalClassification}`,
		`exit code: ${String(record.exitCode)}`,
		'',
	];
	for (const file of record.mutatedPathsOutsideWriteSet) lines.push(`mutated: ${file}`);
	for (const file of record.authoringPathsTouched) lines.push(`authoring home: ${file}`);
	if (
		record.mutatedPathsOutsideWriteSet.length === 0 &&
		record.authoringPathsTouched.length === 0
	)
		lines.push(
			`no path outside the declared write set changed, across ${String(record.observation.pathsObservedAfter)} observed path(s).`,
		);
	lines.push('');
	for (const line of record.notEstablished) lines.push(`not established: ${line}`);
	return `${lines.join('\n')}\n`;
}
