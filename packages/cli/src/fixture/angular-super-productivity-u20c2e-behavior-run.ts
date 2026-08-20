/**
 * The u20c2e behavior check: boot the migrated lane under the Witness host and
 * measure whether the work-view `split` regression the u18j lane carried is gone
 * from the rebuilt, reorder-fixed lane.
 *
 * The regression is recorded, on both retained lanes, as one page error and a
 * pair of `TypeError`s per load out of the work view's `split` component: under
 * Ivy the `@Input() set splitPos` accessor ran before `splitTopEl`/`splitBottomEl`
 * were populated, and `Renderer2.addClass(undefined, …)` threw. The
 * template-binding-reorder capability moves the position binding after the two
 * element bindings, and this driver measures the consequence in a real browser.
 *
 * It boots two roots under one host on one day: dist-23, the immutable lane u23
 * published without the reorder, expected to still throw — a control that comes
 * back clean would mean the host was measuring nothing — and dist-25, this unit's
 * rebuild carrying the reorder, expected to load with zero page errors and none
 * of the split console errors. The host, the Roboto transport seam and the
 * chromium build are the calibration driver's, pointed at these roots rather than
 * copied. Nothing is written to `evidence/`; the record beside this reads it.
 */

import { readFileSync } from 'node:fs';
import { join, resolve } from 'pathe';
import { box, runBoxes } from '@async/witness';
import { joinURL } from 'ufo';
import { witnessNodeFileSystem } from '../witness/node-filesystem.ts';
import { createPlaywrightWitnessHost } from '../witness/playwright-host.ts';
import { startStaticServer } from '../witness/real-app-run.ts';

const root = resolve(import.meta.dirname, '../../../..');
const STAGE = join(root, '.versionless/stage/angular-super-productivity-v2-13-15-u18b');
const CHROMIUM = join(
	root,
	'.versionless/cache/react-boilerplate-v4/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell',
);
const VIEWPORT = { width: 1280, height: 900 } as const;
const INITIAL_ROUTE = '/#/work-view';

/** One console message the browser recorded, narrowed to what the check needs. */
export type ConsoleMessage = Readonly<{ type?: string; text?: string; count?: number }>;

/** What one boot of one lane observed, read back out of its box receipt. */
export type LaneBehavior = Readonly<{
	root: string;
	status: string;
	failure: string;
	/** The page errors the browser threw during the load. */
	pageErrors: readonly unknown[];
	/** The console messages, whole and unfiltered. */
	consoleMessages: readonly ConsoleMessage[];
	/** The console messages that name the split component's addClass throw. */
	splitConsoleErrors: readonly ConsoleMessage[];
}>;

/** The split regression's fingerprint in a console message or page error text. */
function isSplitError(text: string): boolean {
	return (
		text.includes('addClass') ||
		text.includes('classList') ||
		(text.includes('TypeError') && text.toLowerCase().includes('undefined'))
	);
}

function readLane(
	root: string,
	status: string,
	failure: string,
	receiptPath: string,
): LaneBehavior {
	const receipt =
		receiptPath === ''
			? null
			: (JSON.parse(readFileSync(receiptPath, 'utf8')) as {
					boxes?: Array<{ pages?: Array<Record<string, unknown>> }>;
				});
	const page = receipt?.boxes?.[0]?.pages?.[0];
	const pageErrors = (page?.['pageErrors'] as readonly unknown[] | undefined) ?? [];
	const consoleMessages =
		(page?.['consoleMessages'] as readonly ConsoleMessage[] | undefined) ?? [];
	const splitConsoleErrors = consoleMessages.filter((message) =>
		isSplitError(String(message.text ?? '')),
	);
	return Object.freeze({
		root,
		status,
		failure,
		pageErrors,
		consoleMessages,
		splitConsoleErrors,
	});
}

/** Boot one dist root, load the work view, and read back what the browser saw. */
export async function bootLane(outputRoot: string): Promise<LaneBehavior> {
	const laneRoot = join(STAGE, outputRoot);
	const receiptDir = join(STAGE, `u20c2e-behavior/${outputRoot}`);
	const staticServer = await startStaticServer(laneRoot, { profile: 'current-witness' });
	const host = createPlaywrightWitnessHost({
		chromiumExecutable: CHROMIUM,
		contextProfile: 'current-witness',
		viewport: VIEWPORT,
		transport: async () => ({
			action: 'fulfill',
			status: 200,
			contentType: 'text/css',
			body: Buffer.alloc(0),
		}),
	});
	const definition = box(`super-productivity-u20c2e-${outputRoot}`, async (context) => {
		await context.browser.visit(joinURL(staticServer.origin, INITIAL_ROUTE));
		// The split component renders on the work view, so one load is enough to
		// provoke the regression where it exists; a settle lets its setters run.
		await new Promise<void>((settle) => void setTimeout(settle, 2_500));
		await context.receipt.capture('behavior-complete');
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
	return readLane(outputRoot, status, failure, receiptPath);
}

export async function main(): Promise<void> {
	for (const outputRoot of ['dist-23', 'dist-25']) {
		const lane = await bootLane(outputRoot);
		process.stdout.write(
			`${outputRoot}: status ${lane.status}, pageErrors ${String(lane.pageErrors.length)}, ` +
				`splitConsoleErrors ${String(lane.splitConsoleErrors.length)}` +
				(lane.failure === '' ? '' : `, failure ${lane.failure}`) +
				'\n',
		);
		for (const message of lane.splitConsoleErrors)
			process.stdout.write(`  split console: ${String(message.text)}\n`);
		for (const error of lane.pageErrors)
			process.stdout.write(`  pageError: ${JSON.stringify(error).slice(0, 200)}\n`);
	}
}

if (process.argv[1]?.endsWith('angular-super-productivity-u20c2e-behavior-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
