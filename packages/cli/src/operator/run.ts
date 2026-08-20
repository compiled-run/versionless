/**
 * `run`: the whole pipeline, on one application, in one command.
 *
 * Every stage in this directory was proven on its own before this module
 * existed, and `migrate` reaches most of them only when each is opted into.
 * That is deliberate and stays: `migrate`'s exit-0 path has to remain runnable
 * with no registry, and a stage it was never asked for has to be recorded as
 * not run rather than implied. So this is the other entry beside it — the one
 * whose answer is "what does this application do when all nine stages are
 * asked for" — and it adds no migration decision of its own.
 *
 * Three properties are structural rather than convenient.
 *
 * **It composes; it does not reimplement.** Each stage here is the same
 * exported function the single-stage command composes, called with the same
 * declarations. A policy nobody declared refuses exactly where it refuses when
 * the stage is invoked alone, because it is the same guard.
 *
 * **The first refusing stage settles the run.** Its refusal is carried
 * verbatim, the exit code is 2, and every later stage is recorded not-run with
 * that stage named. Nothing here catches a refusal in order to keep going: a
 * chained run that stepped over a refused migration would report a lane the
 * pipeline declined to make.
 *
 * **One seam.** `runStage` is the only place a stage begins and ends. The
 * timestamps, the status and the refusal capture all live in it, so a later
 * reading that needs to count something per stage has one place to instrument
 * rather than nine call sites to find.
 */

import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import {
	COVERAGE_REPORT_SCHEMA,
	coverageReportDigest,
	type CoverageReport,
} from '../../../trust/src/coverage-report.ts';
import { analyzeApplication, fileExists } from './analyze.ts';
import { applyPlan } from './apply.ts';
import { runLaneBuild } from './build.ts';
import { establishEraCell, type EraCellDeclarations } from './era-cell.ts';
import { ingestApplicationSource, readFrontendRoot, type IngestDeclarations } from './ingest.ts';
import { writeLaneFiles } from './lane.ts';
import { readLicenceAtPin, type LicencePolicy } from './license.ts';
import { runLaneInstall, type InstallPolicy } from './install.ts';
import { planApplication } from './plan.ts';
import { composeLane, displayPath } from './record.ts';
import {
	EXIT_DEFECT,
	EXIT_PROCEEDED,
	EXIT_REFUSAL,
	pipelineRefusalOf,
	renderRefusal,
	type PipelineRefusal,
} from './refusals.ts';
import { runLaneWitness } from './witness.ts';

export const RUN_SCHEMA = 'versionless.run.v1';

/**
 * The slot the coverage report occupies.
 *
 * `run` does not derive that document and does not regenerate the trust package
 * to refresh it: it points at what the guarded derivation emitted. Pointing is
 * the whole contract, so the three readings this seam can take are all recorded
 * as what they are — the report is there and internally consistent, it is there
 * and does not recompute to its own digest, or it is not there at all.
 */
export const RUN_COVERAGE_REPORT_SLOT = 'evidence/trust/current/coverage-report.json';

export type RunReportSlot =
	| Readonly<{ status: 'emitted'; slot: string; path: string; digest: string }>
	| Readonly<{ status: 'not-yet-emitted' | 'stale'; slot: string; reason: string }>;

/**
 * Read the emitted coverage report, or say honestly why this is not one.
 *
 * The digest is recomputed over the published record rather than trusted from
 * the field it carries, so a report edited after emission reads `stale` here
 * instead of being pointed at as if it were derived. What this cannot establish
 * is freshness with respect to *this* run: keeping the report current across a
 * rebuild is the generator's ordering problem, not this seam's.
 */
export async function readCoverageReportSlot(rootDir = '.'): Promise<RunReportSlot> {
	const file = path.join(rootDir, RUN_COVERAGE_REPORT_SLOT);
	let body: string;
	try {
		body = await readFile(file, 'utf8');
	} catch {
		return Object.freeze({
			status: 'not-yet-emitted' as const,
			slot: RUN_COVERAGE_REPORT_SLOT,
			reason: 'no coverage report is published at the slot',
		});
	}
	let report: CoverageReport;
	try {
		report = JSON.parse(body) as CoverageReport;
	} catch {
		return Object.freeze({
			status: 'stale' as const,
			slot: RUN_COVERAGE_REPORT_SLOT,
			reason: 'the published coverage report is not readable JSON',
		});
	}
	if (report.schemaVersion !== COVERAGE_REPORT_SCHEMA)
		return Object.freeze({
			status: 'stale' as const,
			slot: RUN_COVERAGE_REPORT_SLOT,
			reason: `the published coverage report carries schema ${String(report.schemaVersion)} rather than ${COVERAGE_REPORT_SCHEMA}`,
		});
	if (coverageReportDigest(report) !== report.integrity.canonicalDigest)
		return Object.freeze({
			status: 'stale' as const,
			slot: RUN_COVERAGE_REPORT_SLOT,
			reason: 'the published coverage report does not recompute to its own canonical digest',
		});
	return Object.freeze({
		status: 'emitted' as const,
		slot: RUN_COVERAGE_REPORT_SLOT,
		path: RUN_COVERAGE_REPORT_SLOT,
		digest: report.integrity.canonicalDigest,
	});
}

/**
 * The stages, in the order they run.
 *
 * The order is not a preference. Admission precedes composition because a
 * licence nobody read is a reason not to compose a lane at all; the cell
 * precedes the install because the install runs inside it; the witness is last
 * because there is nothing to witness until something has been emitted.
 */
export const RUN_STAGES = [
	'analyze',
	'ingest',
	'license-at-pin',
	'era-cell',
	'plan',
	'apply',
	'install',
	'build',
	'witness',
] as const;

export type RunStageName = (typeof RUN_STAGES)[number];

/** Which stage owns which declaration. `run` forwards and owns none of them. */
export const RUN_STAGE_FLAGS: Readonly<Record<RunStageName, readonly string[]>> = Object.freeze({
	analyze: Object.freeze([]),
	ingest: Object.freeze([
		'--source-root',
		'--id',
		'--frontend-root',
		'--revision',
		'--repository',
		'--ref',
		'--lockfile',
		'--license',
	]),
	'license-at-pin': Object.freeze(['--frontend-root', '--license']),
	'era-cell': Object.freeze(['--cell', '--node', '--arch']),
	/**
	 * `--cell` appears here as well as on the era-cell stage because both stages
	 * read it, for different things: era-cell reads the Node line the cell
	 * needs, and plan composes the changeset against the cell itself. Listing it
	 * once would say one of the two stages ignores a declaration it does not.
	 */
	plan: Object.freeze(['--source-dir', '--template-dir', '--style-dir', '--entry', '--cell']),
	apply: Object.freeze(['--out', '--materialize', '--compose-only']),
	install: Object.freeze([
		'--allow-remote-tarballs',
		'--allow-install-scripts',
		'--skip-install-scripts',
		'--allow-peer-conflicts',
		'--allow-foreign-lockfile',
	]),
	build: Object.freeze([]),
	witness: Object.freeze([]),
});

export type RunStageStatus = 'ran' | 'not-run' | 'refused' | 'defect';

export type RunStageRow = Readonly<{
	name: RunStageName;
	status: RunStageStatus;
	/** Why the stage did not run, or what broke in it. */
	reason?: string;
	refusal?: PipelineRefusal;
	/** The record the stage itself produced, unaltered. */
	record?: unknown;
	startedAt: string;
	endedAt: string;
}>;

export type RunStagePlanRow = Readonly<{
	name: RunStageName;
	/** The declarations from this command line the stage is given. */
	forwards: readonly string[];
}>;

export type RunRecord = Readonly<{
	schema: string;
	flow: 'run';
	outcome: 'proceeded' | 'refused' | 'defect' | 'not-run';
	exitCode: number;
	application: string;
	lane: string;
	/**
	 * The two roots this run read, printed side by side so a reader can see
	 * which tree each stage was given: the acquisition root is the unit of
	 * provenance (journal, revision, licence, tree parity) and the frontend
	 * root is the unit of composition (analyze, era-cell, plan, apply).
	 */
	roots: Readonly<{
		source: string;
		frontend: string;
		frontendSource: 'declared' | 'read' | 'not-read';
		frontendBasis: string;
	}>;
	dryRun: boolean;
	stagePlan: readonly RunStagePlanRow[];
	stages: readonly RunStageRow[];
	refusal?: PipelineRefusal;
	defect?: Readonly<{ stage: RunStageName; message: string }>;
	report: RunReportSlot;
	notEstablished: readonly string[];
}>;

/** What the report slot does not establish, in each of its three readings. */
const REPORT_NOT_ESTABLISHED: Readonly<Record<RunReportSlot['status'], string>> = Object.freeze({
	emitted: `The coverage report at ${RUN_COVERAGE_REPORT_SLOT} was emitted by the guarded derivation and recomputes to the digest recorded here. This run did not derive it, did not regenerate it, and establishes nothing about whether it is current with respect to this run.`,
	stale: `A file exists at ${RUN_COVERAGE_REPORT_SLOT} and is not the report this run may point at: it does not recompute to its own canonical digest or does not carry the coverage schema. Nothing here establishes what a regenerated report would say.`,
	'not-yet-emitted': `No coverage report is published at ${RUN_COVERAGE_REPORT_SLOT}. This run did not emit one; a reader who needs coverage has to derive it elsewhere.`,
});

const RUN_NOT_ESTABLISHED: readonly string[] = Object.freeze([
	'A stage recorded `ran` returned its own record. What that record establishes is what that stage states, and no more: this row adds no reading of its own on top of it.',
	'A stage recorded `not-run` was not reached, because an earlier stage refused or broke. Nothing here establishes what it would have recorded.',
	'Exit 2 is a refusal and exit 1 is a defect. A crash, a hang, or a tree that will not install is a defect even when it happens inside a stage that can also refuse.',
	'The stage timestamps bound the wall-clock interval the seam observed around each stage. They are not a measurement of machine time and they are not comparable across hosts.',
]);

export type RunDeclarations = Readonly<{
	appRoot: string;
	out: string;
	/** The repository root the ingest stage reads; defaults to the app root. */
	sourceRoot: string;
	/**
	 * Whether the apply stage copies the application into the lane first.
	 *
	 * `run` sets this true unless `--compose-only` was declared. It is the same
	 * choice `migrate --materialize` makes and it is taken through the same
	 * writer: `applyPlan`'s own `materialize` option. There is no second lane
	 * writer here, and the apply row records which of the two lanes was written
	 * as its `mode` — `materialized` or `changeset-lane`.
	 */
	materialize: boolean;
	dryRun: boolean;
	ingest: IngestDeclarations;
	licence: LicencePolicy;
	eraCell: EraCellDeclarations;
	angular: Readonly<{
		sourceDirectories?: readonly string[] | undefined;
		templateDirectories?: readonly string[] | undefined;
		styleSheetDirectories?: readonly string[] | undefined;
		/**
		 * The `--cell` declaration, as an identifier, for the plan stage to
		 * resolve. It is not resolved here: an identifier no frozen adapter
		 * publishes is the plan stage's refusal, and the run record has to be
		 * able to attribute it to the plan row rather than to the chaining.
		 */
		cellId?: string | null | undefined;
	}>;
	react: Readonly<{ entryModule?: string | undefined }>;
	install: InstallPolicy;
	/** The flags this command line carried, for the forwarding table. */
	flags: Readonly<Record<string, readonly string[]>>;
}>;

/** Why the stages after the one that stopped the run were not reached. */
function notRunBecause(stage: RunStageName, status: 'refused' | 'defect'): string {
	return `not-run-because: ${stage} ${status === 'refused' ? 'refused' : 'raised a defect'}`;
}

type RunState = {
	readonly rows: RunStageRow[];
	/** The stage that stopped the run, once one has. */
	halted: Readonly<{ stage: RunStageName; status: 'refused' | 'defect' }> | null;
	refusal: PipelineRefusal | null;
	defect: Readonly<{ stage: RunStageName; message: string }> | null;
};

/**
 * The stage seam: the one place a stage begins and ends.
 *
 * Everything a reader can say per stage is decided here — when it started,
 * when it ended, whether it ran, and what it refused with. A stage after the
 * run has halted is recorded rather than skipped silently, because a table
 * missing its later rows reads as a run that was never asked for them.
 */
async function runStage<T>(
	state: RunState,
	name: RunStageName,
	stage: () => Promise<T>,
): Promise<T | null> {
	const halted = state.halted;
	if (halted !== null) {
		const at = new Date().toISOString();
		state.rows.push(
			Object.freeze({
				name,
				status: 'not-run' as const,
				reason: notRunBecause(halted.stage, halted.status),
				startedAt: at,
				endedAt: at,
			}),
		);
		return null;
	}
	const startedAt = new Date().toISOString();
	try {
		const value = await stage();
		state.rows.push(
			Object.freeze({
				name,
				status: 'ran' as const,
				record: value,
				startedAt,
				endedAt: new Date().toISOString(),
			}),
		);
		return value;
	} catch (error) {
		const endedAt = new Date().toISOString();
		const refusal = pipelineRefusalOf(error);
		if (refusal !== null) {
			state.rows.push(
				Object.freeze({
					name,
					status: 'refused' as const,
					reason: refusal.code,
					refusal,
					startedAt,
					endedAt,
				}),
			);
			state.halted = Object.freeze({ stage: name, status: 'refused' as const });
			state.refusal = refusal;
			return null;
		}
		/**
		 * A defect is carried rather than rethrown, and it is carried here for
		 * the same reason a refusal is: the stage table is the outcome a reader
		 * needs, and an exception that escapes this seam takes the table with
		 * it. The exit code is still 1 and the stage is still named, so nothing
		 * a defect used to be scored as has changed.
		 */
		const message = error instanceof Error ? error.message : String(error);
		state.rows.push(
			Object.freeze({ name, status: 'defect' as const, reason: message, startedAt, endedAt }),
		);
		state.halted = Object.freeze({ stage: name, status: 'defect' as const });
		state.defect = Object.freeze({ stage: name, message });
		return null;
	}
}

/** The stage order with the declarations each stage is handed, and nothing run. */
export function runStagePlan(
	flags: Readonly<Record<string, readonly string[]>>,
): readonly RunStagePlanRow[] {
	return Object.freeze(
		RUN_STAGES.map((name) =>
			Object.freeze({
				name,
				forwards: Object.freeze(
					RUN_STAGE_FLAGS[name].filter((flag) => flags[flag] !== undefined),
				),
			}),
		),
	);
}

/**
 * Run all nine stages, or state which one stopped the run.
 *
 * The stages are composed here in order and nowhere else. Each one receives
 * the declarations its own command would give it, which is what makes the
 * refusing defaults survive the chain: nothing is widened on the way through.
 */
export async function runFullPipeline(declarations: RunDeclarations): Promise<RunRecord> {
	const stagePlan = runStagePlan(declarations.flags);
	const application = displayPath(declarations.appRoot);
	const lane = displayPath(declarations.out);
	const report = await readCoverageReportSlot();
	/**
	 * The frontend reading is made once, before the stages, and every stage that
	 * composes is given it. It cannot be taken off the ingest record because
	 * `analyze` runs first, and it is not re-read per stage because two readings
	 * of the same tree that disagree would be a defect nobody could see. When
	 * the reading refuses, this stays at the app root and the `ingest` stage
	 * raises the same refusal in the row that owns it.
	 */
	let frontend: RunRecord['roots'] = Object.freeze({
		source: displayPath(declarations.sourceRoot),
		frontend: displayPath(declarations.appRoot),
		frontendSource: 'not-read' as const,
		frontendBasis:
			'the frontend root reading refused; the ingest stage below states which refusal.',
	});
	let composeRoot = declarations.appRoot;
	try {
		const reading = await readFrontendRoot(
			declarations.sourceRoot,
			declarations.ingest.frontendRoot,
		);
		/**
		 * An operator who declared `--source-root` separately from the
		 * application root has already said which directory the application is.
		 * The reading is recorded either way; it replaces the composition root
		 * only when one root was named and the pipeline had to find the
		 * frontend inside it.
		 */
		if (path.resolve(declarations.appRoot) === path.resolve(declarations.sourceRoot))
			composeRoot = path.join(declarations.sourceRoot, reading.frontendRoot);
		frontend = Object.freeze({
			source: displayPath(declarations.sourceRoot),
			frontend: displayPath(composeRoot),
			frontendSource: reading.frontendRootSource,
			frontendBasis: reading.frontendRootBasis,
		});
	} catch (error) {
		if (pipelineRefusalOf(error) === null) throw error;
	}
	if (declarations.dryRun)
		return Object.freeze({
			schema: RUN_SCHEMA,
			flow: 'run' as const,
			outcome: 'not-run' as const,
			exitCode: EXIT_PROCEEDED,
			application,
			lane,
			roots: frontend,
			dryRun: true,
			stagePlan,
			stages: Object.freeze([]),
			report,
			notEstablished: Object.freeze([
				'--dry-run was declared, so no stage ran. Nothing here establishes what any of them would have recorded, and nothing was written into the lane.',
				...RUN_NOT_ESTABLISHED,
				REPORT_NOT_ESTABLISHED[report.status],
			]),
		});
	const state: RunState = { rows: [], halted: null, refusal: null, defect: null };
	const analysis = await runStage(state, 'analyze', () => analyzeApplication(composeRoot));
	await runStage(state, 'ingest', () =>
		ingestApplicationSource(declarations.sourceRoot, declarations.ingest),
	);
	await runStage(state, 'license-at-pin', async () => {
		const manifest = path.join(composeRoot, 'package.json');
		return readLicenceAtPin(
			declarations.sourceRoot,
			(await fileExists(manifest)) ? manifest : null,
			declarations.licence,
		);
	});
	await runStage(state, 'era-cell', () => establishEraCell(composeRoot, declarations.eraCell));
	const planned = await runStage(state, 'plan', () =>
		planApplication({
			appRoot: composeRoot,
			angular: declarations.angular,
			react: declarations.react,
		}),
	);
	const applied = await runStage(state, 'apply', async () => {
		if (planned === null || analysis === null)
			throw new Error(
				'run: the apply stage was reached without a plan. This is a defect in the chaining rather than a refusal: the stage order guarantees a plan before an apply.',
			);
		const changeset = await applyPlan(planned.plan, {
			appRoot: composeRoot,
			out: declarations.out,
			materialize: declarations.materialize,
		});
		const composition = await composeLane(
			composeRoot,
			declarations.out,
			planned.plan.lineage,
			analysis.builder,
		);
		await writeLaneFiles(declarations.out, composition);
		return {
			applied: changeset,
			laneComposition: {
				...composition,
				files: composition.files.map(({ source: _source, ...rest }) => rest),
			},
		};
	});
	await runStage(state, 'install', () =>
		runLaneInstall(
			declarations.out,
			declarations.install,
			process.env,
			applied?.laneComposition.composed === true ? 'resolve' : 'replay',
		),
	);
	const built = await runStage(state, 'build', () => runLaneBuild(declarations.out));
	await runStage(state, 'witness', () =>
		runLaneWitness({
			application: path.basename(declarations.appRoot),
			sourceRoot: declarations.appRoot,
			laneBuild: path.join(declarations.out, built?.outDirectory ?? 'dist'),
		}),
	);
	const halted = state.halted;
	const exitCode =
		halted === null ? EXIT_PROCEEDED : halted.status === 'refused' ? EXIT_REFUSAL : EXIT_DEFECT;
	return Object.freeze({
		schema: RUN_SCHEMA,
		flow: 'run' as const,
		outcome:
			halted === null
				? ('proceeded' as const)
				: halted.status === 'refused'
					? ('refused' as const)
					: ('defect' as const),
		exitCode,
		application,
		lane,
		roots: frontend,
		dryRun: false,
		stagePlan,
		stages: Object.freeze([...state.rows]),
		...(state.refusal === null ? {} : { refusal: state.refusal }),
		...(state.defect === null ? {} : { defect: state.defect }),
		report,
		notEstablished: Object.freeze([
			...RUN_NOT_ESTABLISHED,
			REPORT_NOT_ESTABLISHED[report.status],
		]),
	});
}

const STAGE_COLUMN = Math.max(...RUN_STAGES.map((name) => name.length)) + 2;

function renderStagePlan(plan: readonly RunStagePlanRow[]): readonly string[] {
	return plan.map(
		(row, index) =>
			`  ${String(index + 1)}. ${row.name.padEnd(STAGE_COLUMN)}${
				row.forwards.length === 0
					? 'no declaration from this command line'
					: row.forwards.join(' ')
			}`,
	);
}

/** The run as an operator reads it: the stage table, then whatever stopped it. */
export function renderRun(record: RunRecord): string {
	const lines = [
		`application: ${record.application}`,
		`lane: ${record.lane}`,
		`acquisition root: ${record.roots.source}`,
		`frontend root: ${record.roots.frontend} (${record.roots.frontendSource})`,
		`frontend root basis: ${record.roots.frontendBasis}`,
		'',
	];
	if (record.dryRun) {
		lines.push('dry run: the stage order and the declarations each stage would be given.');
		lines.push('');
		lines.push(...renderStagePlan(record.stagePlan));
		lines.push('');
		lines.push('No stage ran and nothing was written into the lane.');
	} else {
		for (const row of record.stages)
			lines.push(
				`  ${row.name.padEnd(STAGE_COLUMN)}${row.status.padEnd(10)}${row.reason ?? ''}`,
			);
		lines.push('');
		lines.push(
			record.outcome === 'proceeded'
				? `all ${String(record.stages.length)} stage(s) proceeded.`
				: record.outcome === 'refused'
					? `stopped at ${record.refusal?.stage ?? ''}.`
					: `stopped at ${record.defect?.stage ?? ''} with a defect.`,
		);
	}
	lines.push('');
	if (record.refusal !== undefined) lines.push(renderRefusal(record.refusal));
	if (record.defect !== undefined) {
		lines.push(`defect: ${record.defect.stage}`);
		lines.push('');
		lines.push(record.defect.message);
		lines.push('');
	}
	lines.push(
		record.report.status === 'emitted'
			? `report: emitted at ${record.report.path} (${record.report.digest})`
			: `report: ${record.report.status} (${record.report.slot}) — ${record.report.reason}`,
	);
	lines.push('');
	for (const line of record.notEstablished) lines.push(`not established: ${line}`);
	return `${lines.join('\n')}\n`;
}
