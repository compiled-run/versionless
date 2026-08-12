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

import { readFileSync } from 'node:fs';
import { basename, join, resolve } from 'pathe';
import { box, runBoxes } from '@async/witness';
import { joinURL } from 'ufo';
import { canonicalize } from '../../../core/src/receipts/canonicalize.ts';
import { WITNESS_ANGULAR_SUPER_PRODUCTIVITY_STYLE_PROBES } from '../../../core/src/receipts/witness-angular-super-productivity.ts';
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
	migrated: join(root, '.versionless/stage/angular-super-productivity-v2-13-15-u18b/dist-25'),
} as const;

const VIEWPORT = { width: 1280, height: 900 } as const;

/**
 * The route the driver deep-links to.
 *
 * The bare document was measured first and records its navigation as `#/`,
 * which is not one of the nine routes the application declares — the router
 * renders the work view for it through the wildcard, and a recorded `#/` would
 * be a navigation the application did not name. Deep-linking the declared route
 * is what makes the recorded navigation a declared one.
 */
const INITIAL_ROUTE = '/#/work-view';

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
	// Corrected in the u20c2a round. The first calibration pass asked for
	// `work-view-page` because that is what the component's FILE is called; the
	// component's own `selector` is `work-view`, and the earlier pass measured
	// the mistake honestly as zero. The wrong spelling is kept beside the right
	// one so the correction stays visible in the driver rather than only in a
	// note: a reader can see both asked, and the counts say which one the
	// application actually renders.
	'work-view-page',
	'work-view',
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

/**
 * The observed page record out of the box receipt, narrowed to the four things
 * an exact inventory has to be pinned from: what the console said, what the
 * browser failed to fetch, what the page threw, and where it navigated.
 */
function pageSummary(receiptPath: string): unknown {
	const receipt = JSON.parse(readFileSync(receiptPath, 'utf8')) as {
		boxes?: Array<{ pages?: Array<Record<string, unknown>> }>;
	};
	const page = receipt.boxes?.[0]?.pages?.[0];
	if (page === undefined) return null;
	return {
		consoleMessages: page.consoleMessages,
		pageErrors: page.pageErrors,
		failedRequests: page.failedRequests,
		navigations: page.navigations,
	};
}

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
		// The reader is an opt-in and this driver opts in, because reading the
		// store's keys either side of a create is the whole of leg (e).
		indexedDb: 'read-keys',
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
	const legs: Record<string, unknown> = {};
	const definition = box(`super-productivity-calibrate-${lane}`, async (context) => {
		const page = await context.browser.visit(joinURL(staticServer.origin, INITIAL_ROUTE));
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

		// Legs (a) and (e), driven here before either is pinned into a journey.
		// Every reading is printed rather than asserted: what this pass is for is
		// finding out what the application does, and an assertion written before
		// the reading exists is a guess with a stack trace.
		const titleProbe = { group: 'task', name: '.task-title', item: '.task-title' } as const;
		const report = async (stage: string): Promise<void> => {
			legs[stage] = {
				indexedDb: await host.indexedDbKeys().then(
					(inventory) => inventory,
					(error: unknown) => `refused: ${error instanceof Error ? error.message : String(error)}`,
				),
				localStorage: await host.browserStorageKeys(),
				taskTitles: await host.groupedText(titleProbe).then(
					(groups) => groups,
					(error: unknown) => `refused: ${error instanceof Error ? error.message : String(error)}`,
				),
				scroll: await host.viewportScroll(),
			};
		};
		legs['renderedStyles'] = await host.renderedStyles(
			WITNESS_ANGULAR_SUPER_PRODUCTIVITY_STYLE_PROBES.map((probe) => ({
				label: probe.label,
				selector: probe.selector,
				properties: [...probe.properties],
			})),
		);
		await report('before-create');
		await page.trackEvents('click', 'input', 'keydown');
		await page.type('add-task-bar input', 'Witness calibration task', { redact: false });
		await page.press('add-task-bar input', 'Enter');
		await new Promise<void>((settle) => void setTimeout(settle, 1_500));
		await report('after-create');
		await page.reload();
		await new Promise<void>((settle) => void setTimeout(settle, 2_500));
		await report('after-reload');
		legs['after-reload-telemetry'] = await host.serviceWorkerTelemetry(10_000);
		for (const selector of ['task-list', 'task-list task', 'task', 'task .task-title']) {
			try {
				await context.expect.page.count(page, selector, 0);
				legs[`count:${selector}`] = 0;
			} catch (error: unknown) {
				legs[`count:${selector}`] = (error instanceof Error ? error.message : String(error))
					.split('\n')[0]!
					.trim();
			}
		}

		// Legs (c) time-tracking and (b) drag reorder, driven here for the first
		// time before either is pinned. A second task is created so the reorder
		// has a permutation to settle into, and every reading is printed.
		const iconProbe = { group: 'main-header .play-btn', name: 'mat-icon', item: 'mat-icon' } as const;
		const readIcon = async (): Promise<unknown> =>
			host.groupedText(iconProbe).then(
				(groups) => groups.flatMap((group) => group.items),
				(error: unknown) => `refused: ${error instanceof Error ? error.message : String(error)}`,
			);
		const readTitles = async (): Promise<unknown> =>
			host.groupedText({ group: 'task', name: '.task-title', item: '.task-title' } as const).then(
				(groups) => groups.map((group) => group.name),
				(error: unknown) => `refused: ${error instanceof Error ? error.message : String(error)}`,
			);
		const cb: Record<string, unknown> = {};
		// Assigned before the drives so a step that throws still leaves every
		// reading taken up to that point in the printed record, rather than losing
		// the whole block to one refusal.
		legs['legs-c-b'] = cb;
		await page.type('add-task-bar input', 'Witness calibration task two', { redact: false });
		await page.press('add-task-bar input', 'Enter');
		await new Promise<void>((settle) => void setTimeout(settle, 1_000));
		cb['titles-after-second-create'] = await readTitles();
		for (const selector of [
			'main-header .play-btn',
			'task .play-icon-indicator',
			'task .time-wrapper',
			'task .time-wrapper .time-val',
			'task .drag-handle',
			'task .drag-handle.handle-par',
			'.task-list-inner',
			'.task-list-inner[dragula]',
		]) {
			try {
				await context.expect.page.count(page, selector, 0);
				cb[`count:${selector}`] = 0;
			} catch (error: unknown) {
				cb[`count:${selector}`] = (error instanceof Error ? error.message : String(error))
					.split('\n')[0]!
					.trim();
			}
		}
		// Leg (c): the icon flip on the global tracking control.
		cb['icon-before-start'] = await readIcon();
		try {
			await page.click('main-header .play-btn');
			await new Promise<void>((settle) => void setTimeout(settle, 1_200));
			cb['icon-after-start'] = await readIcon();
			cb['play-indicator-after-start'] = await host
				.groupedText({ group: 'task .play-icon-indicator', name: 'task .play-icon-indicator', item: 'task .play-icon-indicator' } as const)
				.then((g) => g.length, (e: unknown) => `refused: ${e instanceof Error ? e.message : String(e)}`);
			cb['time-val-after-start'] = await host
				.groupedText({ group: 'task .time-wrapper', name: '.time-val', item: '.time-val' } as const)
				.then((g) => g, (e: unknown) => `refused: ${e instanceof Error ? e.message : String(e)}`);
			await page.click('main-header .play-btn');
			await new Promise<void>((settle) => void setTimeout(settle, 800));
			cb['icon-after-stop'] = await readIcon();
		} catch (error: unknown) {
			cb['time-tracking-error'] = error instanceof Error ? error.message : String(error);
		}
		// Leg (b): the dragula reorder, initiated on the parent drag handle.
		cb['order-before-drag'] = await readTitles();
		try {
			await page.drag(
				'task-list:first-of-type task:nth-of-type(1) .drag-handle.handle-par',
				'task-list:first-of-type task:nth-of-type(2) .drag-handle.handle-par',
				{ steps: 24 },
			);
			await new Promise<void>((settle) => void setTimeout(settle, 1_200));
			cb['order-after-drag'] = await readTitles();
			cb['indexeddb-after-drag'] = await host
				.indexedDbKeys()
				.then((i) => i, (e: unknown) => `refused: ${e instanceof Error ? e.message : String(e)}`);
		} catch (error: unknown) {
			cb['drag-error'] = error instanceof Error ? error.message : String(error);
		}
		cb['pageErrors-during-cb'] = 'see page summary';
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
			legs,
			page: receiptPath === '' ? null : pageSummary(receiptPath),
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
