/**
 * The `--witness` stage of `migrate`.
 *
 * It is opt-in for exactly the reason `--install`, `--build`, `--ingest` and
 * `--era-cell` are: a run that did not ask for it gets a record saying the lane
 * was not witnessed, rather than a record whose silence a reader could take for
 * a lane that was. It is ordered after the build because there is nothing to
 * witness until something has been emitted.
 *
 * The stage invokes exactly the path `witness:real-app` invokes. It composes no
 * journey of its own and forks no runner: the driver selection, the serialized
 * replay and the locality gate are all the generic runner's.
 */

import * as path from 'pathe';
import type { WitnessSynthesizedRealAppRecord } from '../../../core/src/receipts/witness-real-app.ts';
import { witnessBrowserNotProvisioned } from '../witness/browser.ts';
import { refuse } from './refusals.ts';

/**
 * One replayed journey as this row carries it: the standalone record's reading,
 * copied and not re-derived.
 *
 * `outcomes` are the closed-vocabulary strings the standalone record already
 * publishes, reproduced verbatim. They are legibility and never a verdict: a
 * reader learns from them which routes a replay reached and which it did not,
 * and nothing here promotes a string in that vocabulary to a pass. The counts
 * beside them are the same numbers the strings are composed from, carried so a
 * reader who will not parse prose does not have to.
 */
export type WitnessJourneyRow = Readonly<{
	lane: 'baseline' | 'migrated';
	name: string;
	source: 'cypress' | 'playwright' | 'crawl';
	replayable: boolean;
	ran: boolean;
	routesDeclared: number;
	routesReached: number;
	selectorsDeclared: number;
	selectorsPresent: number;
	outcomes: readonly string[];
}>;

export type WitnessRecord = Readonly<{
	ran: boolean;
	/** Why the stage did not run, when it did not. */
	reason?: string;
	journeySource?: WitnessSynthesizedRealAppRecord['journeySource'];
	replayabilityRatio?: number;
	journeysRun?: number;
	/**
	 * Every replayed journey, in the order the lanes ran, with its outcome
	 * strings verbatim.
	 *
	 * Before this field the row carried a digest and three counts, and a reader
	 * who wanted to know what the replay actually reached had to open the
	 * standalone record the digest names. The row is the surface a fleet report
	 * reads, so the thin row was the thin proof.
	 */
	journeys?: readonly WitnessJourneyRow[];
	/**
	 * The locality reading the run recorded, verbatim.
	 *
	 * `successfulNonLoopback` is the number the whole locality claim rests on,
	 * and a row that omitted it asked a reader to take the claim on the stage's
	 * word. It is copied rather than recomputed here: this stage measured
	 * nothing, the runner did.
	 */
	locality?: WitnessSynthesizedRealAppRecord['locality'];
	digest?: string;
	notEstablished: readonly string[];
}>;

const NOT_REQUESTED_NOT_ESTABLISHED: readonly string[] = Object.freeze([
	'The lane was not witnessed. Nothing in this record establishes that anything renders, that any route is reachable, or that any gesture the application offers still works after the migration.',
]);

const RAN_NOT_ESTABLISHED: readonly string[] = Object.freeze([
	'A witnessed lane is a lane whose declared journeys were replayed once each on this host, serialized. Nothing here establishes an outcome under concurrent load.',
	'Where the journeys were synthesized, they were derived from the application own end-to-end suite or from a bounded loopback crawl. The replayability ratio in the record is a count of derived journeys that name a route to start from, not a measure of coverage.',
	'The outcome strings on each journey are the closed measurement vocabulary the standalone record publishes, reproduced verbatim so this row can be read without opening it. They are legibility and not a verdict: no string in that vocabulary is a pass, and nothing in this row is decided by reading one.',
	'`locality.successfulNonLoopback` is the runner’s own count of requests that left both loopback origins. It is copied here, not recomputed: this stage measured nothing and asserts nothing the standalone record does not already state.',
]);

export function witnessNotRequested(reason: string): WitnessRecord {
	return Object.freeze({ ran: false, reason, notEstablished: NOT_REQUESTED_NOT_ESTABLISHED });
}

/**
 * Run the witness body, and name the one condition that is about this host.
 *
 * A host with no provisioned browser is not a defect in the application and not
 * a defect in the pipeline: it is a declaration nobody made. It is raised here,
 * inside the operator surface, so the census can count it and a fleet report can
 * tally it — the resolver itself lives under `witness/` and stays free of the
 * refusal carrier.
 */
async function witnessing<T>(body: () => Promise<T>): Promise<T> {
	try {
		return await body();
	} catch (error) {
		const missing = witnessBrowserNotProvisioned(error);
		if (missing === null) throw error;
		refuse({
			code: 'witness.browser-not-provisioned',
			message: missing.message,
			stage: 'witness',
			origin: 'pipeline',
		});
	}
}

/**
 * Witness the built lane.
 *
 * The runner is imported lazily, because it pulls in a browser host and a static
 * server that a `migrate` run which never declared `--witness` has no business
 * loading.
 */
export async function runLaneWitness(options: {
	application: string;
	sourceRoot: string;
	laneBuild: string;
	baselineBuild?: string;
}): Promise<WitnessRecord> {
	const { runSynthesizedWitnessRealApp, synthesizedWitnessOutputDir } =
		await import('../witness/real-app-run.ts');
	const record = await witnessing(async () =>
		runSynthesizedWitnessRealApp({
			application: options.application,
			framework: 'react',
			declaration: 'default',
			sourceRoot: options.sourceRoot,
			lanes:
				options.baselineBuild === undefined
					? [{ lane: 'migrated' as const, laneRoot: path.resolve(options.laneBuild) }]
					: [
							{
								lane: 'baseline' as const,
								laneRoot: path.resolve(options.baselineBuild),
							},
							{
								lane: 'migrated' as const,
								laneRoot: path.resolve(options.laneBuild),
							},
						],
			output: synthesizedWitnessOutputDir(options.application),
		}),
	);
	return Object.freeze({
		ran: true,
		journeySource: record.journeySource,
		replayabilityRatio: record.synthesized.replayabilityRatio,
		journeysRun: record.execution.journeysRun,
		journeys: witnessJourneyRows(record),
		locality: Object.freeze({ ...record.locality }),
		digest: record.integrity.canonicalDigest,
		notEstablished: RAN_NOT_ESTABLISHED,
	});
}

/**
 * The standalone record's per-journey readings, flattened lane by lane.
 *
 * The lane is carried on every row rather than nesting the rows under it: a
 * two-lane run and a one-lane run then read the same way, and a reader counting
 * routes never has to know which shape they were handed.
 */
export function witnessJourneyRows(
	record: WitnessSynthesizedRealAppRecord,
): readonly WitnessJourneyRow[] {
	return Object.freeze(
		record.lanes.flatMap((lane) =>
			lane.journeys.map((journey) =>
				Object.freeze({
					lane: lane.lane,
					name: journey.name,
					source: journey.source,
					replayable: journey.replayable,
					ran: journey.ran,
					routesDeclared: journey.routesDeclared,
					routesReached: journey.routesReached,
					selectorsDeclared: journey.selectorsDeclared,
					selectorsPresent: journey.selectorsPresent,
					outcomes: Object.freeze([...journey.outcomes]),
				}),
			),
		),
	);
}
