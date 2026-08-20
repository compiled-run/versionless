/**
 * The TinyTranslator Witness calibration driver.
 *
 * The publishing runner executes four journeys and two mutation journeys before
 * it reports anything, which is the right shape for a proof and the wrong shape
 * for measuring the facts that proof has to pin. This drives ONE lane, ONE pass,
 * through the same journey the proof uses, and prints what it measured — or the
 * exact refusal, which is the measurement when a pin is wrong.
 *
 * It publishes nothing and asserts nothing of its own.
 */

import { basename, join, resolve } from 'pathe';
import { canonicalize } from '../../../core/src/receipts/canonicalize.ts';
import { executeAngularTinyTranslatorWitnessRun } from '../witness/real-app-run.ts';
import type { WitnessAngularTinyTranslatorRun } from '../../../core/src/receipts/witness-angular-tiny-translator.ts';

const root = resolve(import.meta.dirname, '../../../..');
const laneRoots = {
	baseline: join(
		root,
		'.versionless/cache/angular-tiny-translator-v0-12-0-baseline/app/dist/rebuild-1',
	),
	migrated: join(root, '.versionless/stage/angular-tiny-translator-v0-12-0-u17b/dist-11'),
} as const;

export async function calibrateAngularTinyTranslatorLane(
	lane: 'baseline' | 'migrated',
): Promise<void> {
	const raw = (await executeAngularTinyTranslatorWitnessRun({
		lane,
		pass: 1,
		laneRoot: laneRoots[lane],
		receiptRoot: join(
			root,
			'.versionless/stage/witness-angular-tiny-translator-calibrate',
			lane,
		),
	})) as WitnessAngularTinyTranslatorRun;
	process.stdout.write(
		`${canonicalize({
			lane,
			navigations: raw.routes.length,
			routes: raw.routes,
			consoleErrors: raw.consoleErrorInventory?.observed,
			failedRequests: raw.failedRequestInventory?.observed,
			seams: raw.mockedNonLoopbackSeams?.category,
			seamObservations: raw.mockedNonLoopbackSeams?.observed,
			renderedStyles: raw.renderedStyles,
			matIcon: raw.applicationJourney?.matIcon,
			fileReaderParity: raw.applicationJourney?.fileReaderParity,
			persistence: raw.applicationJourney?.persistence,
			downloads: raw.downloadCaptures?.captured,
			scrollAbsence: raw.scrollAbsence,
			interactions: raw.interactions.length,
			trackedEvents: raw.trackedEvents,
		})}\n`,
	);
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const lane = args[0];
	if (lane !== 'baseline' && lane !== 'migrated')
		throw new Error('TinyTranslator calibration requires a lane: baseline or migrated');
	await calibrateAngularTinyTranslatorLane(lane);
}

if (basename(process.argv[1] ?? '') === 'angular-tiny-translator-calibrate-run.ts')
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
