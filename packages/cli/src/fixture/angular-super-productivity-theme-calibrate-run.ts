/**
 * The Super Productivity leg-(d) THEME-CONTROL calibration driver.
 *
 * u20c2l established the project-switch spine is green and that the witness
 * PageHandle cannot drive a native `input[type=color]`, so the save-side palette
 * shift it produces is unprovable. This driver answers the one question that
 * ruling left open: is there a CLICK-driveable theme control whose driven change
 * provably shifts a MEASURED style variable, on BOTH lanes.
 *
 * The two candidates are the project theme form's own `isAutoContrast` checkbox
 * and its `huePrimary` mat-select. It navigates to the project settings, expands
 * the theme section, probes the palette and contrast custom properties, drives
 * each control by a real click, saves, and re-probes — printing every reading
 * (including the refusals, which are the measurement when a candidate is wrong).
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

const laneRoots = {
	baseline: join(
		root,
		'.versionless/cache/angular-super-productivity-v2-13-15-baseline/dist-run2',
	),
	migrated: join(root, '.versionless/stage/angular-super-productivity-v2-13-15-u18b/dist-25'),
} as const;

const VIEWPORT = { width: 1280, height: 900 } as const;
const INITIAL_ROUTE = '/#/work-view';

/**
 * The palette and contrast custom properties the driven change is measured
 * against. The base `--palette-primary-500` moves only with the primary COLOR
 * (the undriveable color input), so it is the control reading. The
 * `--palette-primary-contrast-*` variables move with `setAutoContrastEnabled`
 * and `setContrastColorThresholdPrimary(huePrimary)`, which are exactly what the
 * checkbox and the select drive.
 */
const PALETTE_PROPS = [
	'--palette-primary-500',
	'--palette-primary-contrast-50',
	'--palette-primary-contrast-100',
	'--palette-primary-contrast-200',
	'--palette-primary-contrast-300',
	'--palette-primary-contrast-400',
	'--palette-primary-contrast-500',
	'--palette-primary-contrast-600',
	'--palette-primary-contrast-700',
	'--palette-primary-contrast-900',
];

export async function calibrateAngularSuperProductivityTheme(
	lane: 'baseline' | 'migrated',
): Promise<void> {
	const laneRoot = laneRoots[lane];
	const receiptDir = join(
		root,
		'.versionless/stage/witness-angular-super-productivity-theme-calibrate',
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
		indexedDb: 'read-keys',
		transport: async () => ({
			action: 'fulfill',
			status: 200,
			contentType: 'text/css',
			body: Buffer.alloc(0),
		}),
	});
	const out: Record<string, unknown> = {};
	const definition = box(`super-productivity-theme-calibrate-${lane}`, async (context) => {
		const page = await context.browser.visit(joinURL(staticServer.origin, INITIAL_ROUTE));
		const wait = (ms: number): Promise<void> =>
			new Promise<void>((settle) => void setTimeout(settle, ms));
		const readPalette = async (): Promise<unknown> =>
			host
				.renderedStyles([{ label: 'body', selector: 'body', properties: [...PALETTE_PROPS] }])
				.then(
					(probes) => probes[0]?.properties ?? null,
					(e: unknown) => `refused: ${e instanceof Error ? e.message : String(e)}`,
				);
		const readCount = async (selector: string): Promise<number | string> => {
			try {
				await context.expect.page.count(page, selector, 0);
				return 0;
			} catch (error: unknown) {
				const line = (error instanceof Error ? error.message : String(error))
					.split('\n')[0]!
					.trim();
				const m = line.match(/observed (\d+)/);
				return m ? Number(m[1]) : line;
			}
		};
		const clickIfPresent = async (selector: string): Promise<string> => {
			try {
				await page.click(selector, { timeoutMs: 4_000 });
				return 'clicked';
			} catch (error: unknown) {
				return `failed: ${(error instanceof Error ? error.message : String(error)).split('\n')[0]!}`;
			}
		};

		const readCurrentTitle = async (): Promise<unknown> =>
			host
				.groupedText({
					group: 'main-header',
					name: '.current-project-title',
					item: '.current-project-title',
				} as const)
				.then(
					(g) => g.map((x) => x.name),
					(e: unknown) => `refused: ${e instanceof Error ? e.message : String(e)}`,
				);
		const readProjectTitles = async (): Promise<unknown> =>
			host
				.groupedText({
					group: 'side-nav .project',
					name: 'button[mat-menu-item]',
					item: 'button[mat-menu-item]',
				} as const)
				.then(
					(g) => g.map((x) => x.name),
					(e: unknown) => `refused: ${e instanceof Error ? e.message : String(e)}`,
				);
		await page.trackEvents('click', 'keydown');

		// (d.1) Project-switch spine: create a second project through the side-nav
		// addProject() dialog and switch to it.
		out['current-title-before'] = await readCurrentTitle();
		out['project-titles-before'] = await readProjectTitles();
		out['project-count-before'] = await readCount('side-nav .project');
		out['add-clicked'] = await clickIfPresent('section.projects > button[mat-menu-item]');
		await wait(1_200);
		out['dialog-count'] = await readCount('dialog-create-project');
		out['title-typed'] = await (async (): Promise<string> => {
			try {
				await page.type('dialog-create-project input:not([type=color])', 'Witness leg-d project', {
					redact: false,
					timeoutMs: 4_000,
				});
				return 'typed';
			} catch (error: unknown) {
				return `failed: ${(error instanceof Error ? error.message : String(error)).split('\n')[0]!}`;
			}
		})();
		await wait(400);
		out['dialog-save-clicked'] = await clickIfPresent('dialog-create-project button[type=submit]');
		await wait(1_500);
		out['project-count-after'] = await readCount('side-nav .project');
		out['project-titles-after'] = await readProjectTitles();
		out['switch-clicked'] = await clickIfPresent(
			'side-nav .project:nth-of-type(2) > button[mat-menu-item]',
		);
		await wait(1_500);
		out['current-title-after-switch'] = await readCurrentTitle();

		// Navigate to the current project's settings via the header control.
		out['settings-nav-clicked'] = await clickIfPresent('main-header .project-settings-btn');
		await wait(1_500);
		out['route-after-settings-nav'] = 'see navigations';
		out['config-section-count'] = await readCount('section.config-section');
		// Expand the theme config-section (the 2nd).
		out['expand-clicked'] = await clickIfPresent(
			'section.config-section:nth-of-type(2) .collapsible-title',
		);
		await wait(1_200);

		const theme = 'section.config-section:nth-of-type(2)';
		out['checkbox-count'] = await readCount(`${theme} mat-checkbox`);
		out['select-count-before'] = await readCount(`${theme} mat-select`);
		out['color-input-count'] = await readCount(`${theme} input[type=color]`);
		out['submit-count'] = await readCount(`${theme} .submit-button`);
		out['palette-before'] = await readPalette();

		// (candidate A) The isAutoContrast checkbox. Default true; a click toggles
		// it false, which flips `setAutoContrastEnabled` and applies the hue
		// thresholds on save.
		out['autocontrast-click'] = await clickIfPresent(`${theme} mat-checkbox label`);
		await wait(500);
		out['palette-after-autocontrast-toggle-preSave'] = await readPalette();
		out['autocontrast-save'] = await clickIfPresent(`${theme} .submit-button`);
		await wait(1_800);
		out['palette-after-autocontrast-save'] = await readPalette();
		out['select-count-after-uncheck'] = await readCount(`${theme} mat-select`);

		// (candidate B) The huePrimary mat-select, now revealed. Open it and pick a
		// hue far from the 500 default; the contrast threshold moves and the
		// contrast custom properties shift on save.
		out['hue-select-open'] = await clickIfPresent(`${theme} mat-select`);
		await wait(800);
		out['overlay-option-count'] = await readCount('.cdk-overlay-container mat-option');
		out['hue-option-click'] = await clickIfPresent(
			'.cdk-overlay-container mat-option:first-of-type',
		);
		await wait(600);
		out['palette-after-hue-pick-preSave'] = await readPalette();
		out['hue-save'] = await clickIfPresent(`${theme} .submit-button`);
		await wait(1_800);
		out['palette-after-hue-save'] = await readPalette();

		// (d.3) Keyboard shortcuts. `w` (goToWorkView) and `b` (toggleBacklog),
		// measured for their observable DOM effect in this state (the box page
		// exposes no route reader, so the work view host tag and the backlog/split
		// surfaces are the measurement).
		out['work-view-count-before-w'] = await readCount('work-view');
		await page.press('body', 'w');
		await wait(1_000);
		out['work-view-count-after-w'] = await readCount('work-view');
		out['split-count-before-b'] = await readCount('split');
		out['backlog-count-before-b'] = await readCount('backlog');
		await page.press('body', 'b');
		await wait(1_000);
		out['work-view-count-after-b'] = await readCount('work-view');
		out['split-count-after-b'] = await readCount('split');
		out['backlog-count-after-b'] = await readCount('backlog');

		await context.receipt.capture('theme-calibration-complete');
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
			assertionTimeoutMs: 4_000,
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
	process.stdout.write(`${canonicalize({ lane, status, failure, receiptPath, out })}\n`);
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const lane = args[0];
	if (lane !== 'baseline' && lane !== 'migrated')
		throw new Error('Super Productivity theme calibration requires a lane: baseline or migrated');
	await calibrateAngularSuperProductivityTheme(lane);
}

if (basename(process.argv[1] ?? '') === 'angular-super-productivity-theme-calibrate-run.ts')
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
