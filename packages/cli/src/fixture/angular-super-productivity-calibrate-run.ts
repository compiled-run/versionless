/**
 * The Super Productivity Witness calibration driver.
 *
 * There is no published journey for this application yet, and pinning one
 * before the live DOM has been read is what the TinyTranslator rounds spent
 * four passes undoing. This drives ONE lane of the bound production-static
 * output through the same host the proof will use, asks the page a list of
 * candidate questions, and prints every answer — including the refusals, which
 * are the measurement when a candidate is wrong.
 *
 * It publishes nothing, asserts nothing of its own, and is not part of any
 * receipt. Its only output is stdout.
 */

import { basename, join, resolve } from 'pathe';
import { box, runBoxes } from '@async/witness';
import { joinURL } from 'ufo';
import { canonicalize } from '../../../core/src/receipts/canonicalize.ts';
import { witnessNodeFileSystem } from '../witness/node-filesystem.ts';
import { createPlaywrightWitnessHost } from '../witness/playwright-host.ts';
import { startStaticServer } from '../witness/real-app-run.ts';

const root = resolve(import.meta.dirname, '../../../..');

/**
 * The two bound lanes, exactly as the schema names them: the era lane is the
 * retained tree the u21 digest correction was recomputed from, and the migrated
 * lane is the offline-faithful rebuild u23 published.
 */
const laneRoots = {
	baseline: join(
		root,
		'.versionless/cache/angular-super-productivity-v2-13-15-baseline/dist-run2',
	),
	migrated: join(root, '.versionless/stage/angular-super-productivity-v2-13-15-u18b/dist-23'),
} as const;

const VIEWPORT = { width: 1280, height: 900 } as const;

/**
 * The candidate selectors, read out of the application's own templates rather
 * than guessed: the shell, the work view, the add-task surface, the task list
 * and the two controls the time-tracking and theme legs would be anchored on.
 * Each is asked for as a count, so a candidate that does not resolve reports
 * zero rather than ending the pass.
 */
const CANDIDATES = [
	'main-header',
	'main-header .project-settings-btn',
	'mat-drawer-container',
	'side-nav',
	'work-view-page',
	'.work-view-header',
	'add-task-bar',
	'add-task-bar input',
	'task-list',
	'task-list task',
	'task',
	'task .title',
	'task .play-btn',
	'task .drag-handle',
	'.task-list-wrapper',
	'.completed-tasks-heading',
	'backlog',
	'split',
	'banner',
	'mat-progress-bar',
] as const;

export async function calibrateAngularSuperProductivityLane(
	lane: 'baseline' | 'migrated',
): Promise<void> {
	const laneRoot = laneRoots[lane];
	const receiptDir = join(
		root,
		'.versionless/stage/witness-angular-super-productivity-calibrate',
		lane,
	);
	const staticServer = await startStaticServer(laneRoot, { profile: 'current-witness' });
	const host = createPlaywrightWitnessHost({
		chromiumExecutable: join(
			root,
			'.versionless/cache/react-boilerplate-v4/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell',
		),
		contextProfile: 'current-witness',
		viewport: VIEWPORT,
		// The application's own `index.html` links the Roboto stylesheet, so the
		// seam is answered inside the context with an empty body exactly as the
		// TinyTranslator vertical answers its icon stylesheet. Nothing leaves the
		// machine, and the request is still observed.
		transport: async () => ({
			action: 'fulfill',
			status: 200,
			contentType: 'text/css',
			body: Buffer.alloc(0),
		}),
	});
	const counts: Record<string, number | string> = {};
	let telemetry: unknown;
	let storage: unknown;
	let scroll: unknown;
	const definition = box(`super-productivity-calibrate-${lane}`, async (context) => {
		const page = await context.browser.visit(joinURL(staticServer.origin, '/'));
		for (const selector of CANDIDATES) {
			// Asked for as zero: a candidate that genuinely resolves nothing passes
			// and is recorded as absent, and one that resolves reports its actual
			// count in the refusal, which is the measurement being asked for.
			try {
				await context.expect.page.count(page, selector, 0);
				counts[selector] = 0;
			} catch (error: unknown) {
				counts[selector] = (error instanceof Error ? error.message : String(error))
					.split('\n')[0]!
					.trim();
			}
		}
		telemetry = await host.serviceWorkerTelemetry(10_000);
		storage = await host.browserStorageKeys();
		scroll = await host.viewportScroll();
		await context.receipt.capture('calibration-complete');
	});
	let status = 'unknown';
	let failure = '';
	let receiptPath = '';
	try {
		const result = await runBoxes({
			root: laneRoot,
			boxes: [
				{
					file: join(laneRoot, 'versionless-runtime.box.ts'),
					relativeFile: 'versionless-runtime.box.ts',
					exportName: 'default',
					box: definition,
				},
			],
			receiptDir,
			assertionTimeoutMs: 10_000,
			fileSystem: witnessNodeFileSystem,
			browser: host.browser,
			headless: true,
		});
		status = result.status;
		failure = result.boxes[0]?.error?.message ?? '';
		receiptPath = result.receiptPath;
	} finally {
		await staticServer.close();
	}
	process.stdout.write(
		`${canonicalize({
			lane,
			status,
			failure,
			receiptPath,
			counts,
			telemetry,
			storage,
			scroll,
			requestOutcomes: host.requestOutcomes(),
			staticPaths: staticServer.requests(),
		})}\n`,
	);
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const lane = args[0];
	if (lane !== 'baseline' && lane !== 'migrated')
		throw new Error('Super Productivity calibration requires a lane: baseline or migrated');
	await calibrateAngularSuperProductivityLane(lane);
}

if (basename(process.argv[1] ?? '') === 'angular-super-productivity-calibrate-run.ts')
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
