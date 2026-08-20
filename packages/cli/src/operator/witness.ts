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

export type WitnessRecord = Readonly<{
	ran: boolean;
	/** Why the stage did not run, when it did not. */
	reason?: string;
	journeySource?: WitnessSynthesizedRealAppRecord['journeySource'];
	replayabilityRatio?: number;
	journeysRun?: number;
	digest?: string;
	notEstablished: readonly string[];
}>;

const NOT_REQUESTED_NOT_ESTABLISHED: readonly string[] = Object.freeze([
	'The lane was not witnessed. Nothing in this record establishes that anything renders, that any route is reachable, or that any gesture the application offers still works after the migration.',
]);

const RAN_NOT_ESTABLISHED: readonly string[] = Object.freeze([
	'A witnessed lane is a lane whose declared journeys were replayed once each on this host, serialized. Nothing here establishes an outcome under concurrent load.',
	'Where the journeys were synthesized, they were derived from the application own end-to-end suite or from a bounded loopback crawl. The replayability ratio in the record is a count of derived journeys that name a route to start from, not a measure of coverage.',
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
		digest: record.integrity.canonicalDigest,
		notEstablished: RAN_NOT_ESTABLISHED,
	});
}
