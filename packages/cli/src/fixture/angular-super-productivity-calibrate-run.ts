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

		// PM ruling from u20c2i: drive EVERY mutation before the single leg-(e)
		// reload. The after-reload add-task-bar hang the earlier pass hit is a
		// property of the reloaded page, so the two creates, the timer, the drag
		// and the settings change all happen here, and the reload is last.
		const readIcon = async (): Promise<unknown> =>
			host
				.groupedText({ group: 'main-header .play-btn', name: 'mat-icon', item: 'mat-icon' } as const)
				.then(
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
		legs['legs-c-b-d'] = cb;

		await page.type('add-task-bar input', 'Witness calibration task', { redact: false });
		await page.press('add-task-bar input', 'Enter');
		await new Promise<void>((settle) => void setTimeout(settle, 1_500));
		cb['titles-after-first-create'] = await readTitles();
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
			'task .start-task-btn',
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
		// Leg (c), re-anchored (u20c2j): the hover-gated per-task `.start-task-btn`
		// is not visible to a click, so the timer is driven through the header's own
		// global play button, whose `mat-icon` flips play_arrow→pause on start and
		// back on stop. Every reading — the icon, the per-task current marker and the
		// store keys — is taken before start, after start and after stop.
		const readStoreKeys = async (): Promise<unknown> =>
			host.indexedDbKeys().then(
				(inv) =>
					inv.databases
						.find((d) => d.name === 'SUP')
						?.stores.find((s) => s.name === 'SUP_STORE')
						?.keys.map((k) => k.key) ?? 'no SUP_STORE',
				(e: unknown) => `refused: ${e instanceof Error ? e.message : String(e)}`,
			);
		const readCurrentCount = async (selector: string): Promise<number | string> => {
			try {
				await context.expect.page.count(page, selector, 0);
				return 0;
			} catch (error: unknown) {
				return (error instanceof Error ? error.message : String(error)).split('\n')[0]!.trim();
			}
		};
		cb['icon-before-start'] = await readIcon();
		cb['current-before-start'] = await readCurrentCount('task.isCurrent');
		cb['store-before-start'] = await readStoreKeys();
		try {
			await page.click('main-header .play-btn');
			await new Promise<void>((settle) => void setTimeout(settle, 2_000));
			cb['icon-after-header-start'] = await readIcon();
			cb['current-after-header-start'] = await readCurrentCount('task.isCurrent');
			cb['store-after-header-start'] = await readStoreKeys();
			await page.click('main-header .play-btn');
			await new Promise<void>((settle) => void setTimeout(settle, 2_000));
			cb['icon-after-header-stop'] = await readIcon();
			cb['current-after-header-stop'] = await readCurrentCount('task.isCurrent');
			cb['store-after-header-stop'] = await readStoreKeys();
		} catch (error: unknown) {
			cb['time-tracking-error'] = error instanceof Error ? error.message : String(error);
		}
		// Leg (b): the dragula reorder, initiated on the parent drag handle. Two
		// strategies are tried in one pass: drop onto the second task's handle,
		// and — if the order did not change — drag the second task's handle UP
		// onto the first. Every reading is printed.
		cb['order-before-drag'] = await readTitles();
		try {
			await page.drag(
				'task-list:first-of-type task:nth-of-type(1) .drag-handle.handle-par',
				'task-list:first-of-type task:nth-of-type(2)',
				{ steps: 30 },
			);
			await new Promise<void>((settle) => void setTimeout(settle, 1_200));
			cb['order-after-drag-down'] = await readTitles();
			const afterDown = (await readTitles()) as string[];
			if (
				Array.isArray(afterDown) &&
				afterDown.join('\n') === (cb['order-before-drag'] as string[]).join('\n')
			) {
				await page.drag(
					'task-list:first-of-type task:nth-of-type(2) .drag-handle.handle-par',
					'task-list:first-of-type task:nth-of-type(1)',
					{ steps: 30 },
				);
				await new Promise<void>((settle) => void setTimeout(settle, 1_200));
				cb['order-after-drag-up'] = await readTitles();
			}
			cb['indexeddb-after-drag'] = await host
				.indexedDbKeys()
				.then((i) => i, (e: unknown) => `refused: ${e instanceof Error ? e.message : String(e)}`);
		} catch (error: unknown) {
			cb['drag-error'] = error instanceof Error ? error.message : String(error);
		}

		// Leg (d): settings-change. The app exposes NO dark-theme UI control in
		// v2.13.15 (the isDarkMode formly field is commented out), so the real
		// control driven is the project theme colour. Every selector is asked as
		// a count first, then the surface is exercised and the palette custom
		// properties are read before/after. Exploratory: printed, never asserted.
		const dd: Record<string, unknown> = {};
		legs['leg-d'] = dd;
		const paletteProps = [
			'--palette-primary-500',
			'--palette-accent-500',
			'--palette-primary-400',
			'--c-primary',
			'--c-accent',
		];
		const readPalette = async (): Promise<unknown> =>
			host
				.renderedStyles([
					{ label: 'body-palette', selector: 'body', properties: [...paletteProps] },
					{ label: 'drawer-palette', selector: 'mat-drawer-container', properties: [...paletteProps] },
				])
				.then(
					(probes) => probes,
					(e: unknown) => `refused: ${e instanceof Error ? e.message : String(e)}`,
				);
		try {
			dd['palette-before'] = await readPalette();
			for (const selector of [
				'side-nav',
				'side-nav button[mat-menu-item]',
				'side-nav .tour-addProjectBtn',
				'side-nav mat-expansion-panel',
				'.projects',
			]) {
				try {
					await context.expect.page.count(page, selector, 0);
					dd[`count:${selector}`] = 0;
				} catch (error: unknown) {
					dd[`count:${selector}`] = (error instanceof Error ? error.message : String(error))
						.split('\n')[0]!
						.trim();
				}
			}
			// A keyboard shortcut: `b` toggles the backlog. Read the split state
			// before and after so the effect is measured rather than assumed.
			dd['split-count-before-shortcut'] = await host
				.groupedText({ group: 'split', name: 'split', item: 'split' } as const)
				.then((g) => g.length, (e: unknown) => `refused: ${e instanceof Error ? e.message : String(e)}`);
			await page.press('body', 'b');
			await new Promise<void>((settle) => void setTimeout(settle, 800));
			dd['backlog-count-after-b'] = await host
				.groupedText({ group: 'backlog', name: 'backlog', item: 'backlog' } as const)
				.then((g) => g.length, (e: unknown) => `refused: ${e instanceof Error ? e.message : String(e)}`);
			await page.press('body', 'w');
			await new Promise<void>((settle) => void setTimeout(settle, 500));
			dd['route-after-w'] = 'see page navigations';
		} catch (error: unknown) {
			dd['leg-d-error'] = error instanceof Error ? error.message : String(error);
		}
		cb['pageErrors-during-cb'] = 'see page summary';

		// (e) The single reload, LAST, after every mutation has been driven.
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
