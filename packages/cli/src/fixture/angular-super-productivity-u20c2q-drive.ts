/**
 * The Super Productivity ASSERTING-journey drive (u20c2q).
 *
 * Unlike the calibration driver, this launches the real asserting journey
 * `executeAngularSuperProductivityWitnessRun` against BOTH bound lanes and
 * prints, per lane: whether it drove to green, the page-error count, the raw
 * and behavior digests, and — on a RED — the assertion message, which carries
 * the measured reading the pin disagreed with.
 *
 * It publishes nothing and is not part of any receipt. Its only output is
 * stdout; it is how each JOURNEY pin is calibrated against a real asserting run.
 */

import { writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'pathe';
import { canonicalize } from '../../../core/src/receipts/canonicalize.ts';
import {
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_MEASURED_STYLE_DIFFERENCES,
	witnessAngularSuperProductivityBehaviorDigest,
	witnessAngularSuperProductivityRawDigest,
	type WitnessAngularSuperProductivityRun,
} from '../../../core/src/receipts/witness-angular-super-productivity.ts';
import { executeAngularSuperProductivityWitnessRun } from '../witness/real-app-run.ts';

const root = resolve(import.meta.dirname, '../../../..');

const laneRoots = {
	baseline: join(
		root,
		'.versionless/cache/angular-super-productivity-v2-13-15-baseline/dist-run2',
	),
	migrated: join(root, '.versionless/stage/angular-super-productivity-v2-13-15-u18b/dist-25'),
} as const;

const declaredDifferenceLabels = WITNESS_ANGULAR_SUPER_PRODUCTIVITY_MEASURED_STYLE_DIFFERENCES.map(
	(difference) => difference.label,
);

async function driveLane(
	lane: 'baseline' | 'migrated',
	pass: 1 | 2,
): Promise<void> {
	process.stdout.write(`\n===== ${lane} pass ${pass} =====\n`);
	try {
		const raw = await executeAngularSuperProductivityWitnessRun({
			lane,
			pass,
			laneRoot: laneRoots[lane],
			receiptRoot: join(root, '.versionless/stage/witness-super-productivity-u20c2q/receipts'),
		});
		const run = raw as WitnessAngularSuperProductivityRun;
		const rawDigest = witnessAngularSuperProductivityRawDigest(run);
		const behaviorDigest = witnessAngularSuperProductivityBehaviorDigest(
			run,
			declaredDifferenceLabels,
		);
		if (process.env.SP_DUMP)
			writeFileSync(
				join(process.env.SP_DUMP, `${lane}-run.json`),
				`${canonicalize(run)}\n`,
			);
		process.stdout.write(
			`${canonicalize({
				result: run.result,
				cleanPage: run.cleanPage,
				pageErrors: run.witnessRecord.pageErrors,
				consoleErrors: run.witnessRecord.consoleErrors,
				failedRequests: run.witnessRecord.failedRequests,
				successfulNonLoopback: run.successfulNonLoopback,
				routes: run.routes,
				rawDigest,
				behaviorDigest,
			})}\n`,
		);
	} catch (error) {
		process.stdout.write(
			`RED: ${error instanceof Error ? error.message : String(error)}\n`,
		);
		if (error instanceof Error && error.stack) process.stdout.write(`${error.stack}\n`);
	}
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const only = args[0] as 'baseline' | 'migrated' | undefined;
	const lanes: ReadonlyArray<'baseline' | 'migrated'> =
		only === 'baseline' || only === 'migrated' ? [only] : ['baseline', 'migrated'];
	for (const lane of lanes) await driveLane(lane, 1);
}

if (basename(process.argv[1] ?? '') === 'angular-super-productivity-u20c2q-drive.ts')
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
