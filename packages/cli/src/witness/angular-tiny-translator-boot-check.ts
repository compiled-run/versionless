/**
 * The boot fact for one production output root of the
 * `angular-tiny-translator-v0-12-0` cell.
 *
 * u19d's finding was that the migrated lane's build lanes were green and
 * deterministic while the artifact they emitted threw before Angular
 * bootstrapped — a failure invisible to every check the build lanes perform,
 * and visible in a browser within a second of loading the page. A build record
 * that claims a green migrated lane without opening the artifact once is a
 * record that can be contradicted the same way again.
 *
 * So this is the narrowest browser measurement that would have caught it: serve
 * the output root over loopback, load the initial route, and read back whether
 * Angular's own root component rendered the home surface — with every page
 * error and console error the load produced recorded exactly, whether the
 * surface appeared or not.
 *
 * It is deliberately not a journey. No gesture is performed, no seam is mocked
 * and nothing is asserted about behaviour; the four uncalibrated facts the
 * Witness proof owes this vertical remain uncalibrated and are not touched
 * here. What this establishes is one fact — the bundle evaluates and the
 * application mounts — and that is the exact fact u19d found missing.
 */

import { join, resolve } from 'pathe';
import { joinURL } from 'ufo';
import type { BrowserConsoleMessage, BrowserPageError } from '@async/witness';
import { createPlaywrightWitnessHost } from './playwright-host.ts';
import { startStaticServer } from './real-app-run.ts';

const root = resolve(import.meta.dirname, '../../../..');
const chromiumExecutable = join(
	root,
	'.versionless/cache/react-boilerplate-v4/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell',
);

/**
 * The route the application's own router treats as home, and the element the
 * home surface renders its title into. Both are read out of the served bundle
 * by the journey this vertical already carries; they are restated here because
 * a boot check that waited for nothing in particular would pass on a blank
 * page.
 */
export const TINY_TRANSLATOR_HOME_ROUTE = '/#/home';
export const TINY_TRANSLATOR_HOME_SELECTOR = '#apptitle';
export const TINY_TRANSLATOR_HOME_TITLE = 'Tiny Translator';

export type BootObservation = Readonly<{
	/** The output root served, as handed in. */
	laneRoot: string;
	/** The page URL, with the ephemeral loopback origin normalized away. */
	url: string;
	/** Whether the home surface rendered its title within the budget. */
	booted: boolean;
	/** The text the home selector carried, or null when it never appeared. */
	renderedTitle: string | null;
	/** Every uncaught page error, in observation order. */
	pageErrors: readonly string[];
	/** Every console error, in observation order. */
	consoleErrors: readonly string[];
	/** The refusal, when the surface did not render. */
	refusal: string | null;
}>;

const PLACEHOLDER_ORIGIN = '{production-static-origin}';

/** How long the home surface is given to render before the load is a failure. */
const BOOT_TIMEOUT_MS = 10_000;

function normalizeOrigin(text: string, origin: string): string {
	return text.split(origin).join(PLACEHOLDER_ORIGIN);
}

/**
 * Load one production output root in a browser and report whether the
 * application mounted.
 *
 * The browser context is the same one the vertical's Witness runs under, with
 * one deliberate exception: service workers are left at the host's default
 * rather than blocked, because this check makes no claim about them and a
 * policy imposed here would produce console errors of its own that the caller
 * would then have to account for.
 */
export async function observeAngularTinyTranslatorBoot(
	laneRoot: string,
): Promise<BootObservation> {
	const staticServer = await startStaticServer(laneRoot);
	const host = createPlaywrightWitnessHost({ chromiumExecutable });
	const pageErrors: string[] = [];
	const consoleErrors: string[] = [];
	const url = joinURL(staticServer.origin, TINY_TRANSLATOR_HOME_ROUTE);
	const session = await host.browser.launch({ headless: true });
	let booted = false;
	let renderedTitle: string | null = null;
	let refusal: string | null = null;
	try {
		const page = await session.newPage();
		page.onPageError((error: BrowserPageError) => pageErrors.push(error.message));
		page.onConsoleMessage((message: BrowserConsoleMessage) => {
			if (message.level === 'error') consoleErrors.push(message.text);
		});
		await page.goto(url);
		const expression =
			`document.querySelector(${JSON.stringify(TINY_TRANSLATOR_HOME_SELECTOR)})` +
			`?.textContent?.trim() === ${JSON.stringify(TINY_TRANSLATOR_HOME_TITLE)}`;
		try {
			await page.waitForExpression(expression, BOOT_TIMEOUT_MS);
			booted = true;
		} catch (error) {
			refusal = error instanceof Error ? error.message : String(error);
		}
		const text = await page.evaluate(
			`document.querySelector(${JSON.stringify(TINY_TRANSLATOR_HOME_SELECTOR)})?.textContent ?? null`,
		);
		renderedTitle = typeof text === 'string' ? text.trim() : null;
		await page.close();
	} finally {
		await session.close();
		await staticServer.close();
	}
	return Object.freeze({
		laneRoot,
		url: normalizeOrigin(url, staticServer.origin),
		booted,
		renderedTitle,
		pageErrors: Object.freeze(
			pageErrors.map((message) => normalizeOrigin(message, staticServer.origin)),
		),
		consoleErrors: Object.freeze(
			consoleErrors.map((message) => normalizeOrigin(message, staticServer.origin)),
		),
		refusal: refusal === null ? null : normalizeOrigin(refusal, staticServer.origin),
	});
}

export async function main(): Promise<void> {
	const laneRoot = process.argv[2];
	if (laneRoot === undefined)
		throw new Error('TinyTranslator boot check requires an output root to serve');
	const observation = await observeAngularTinyTranslatorBoot(resolve(laneRoot));
	process.stdout.write(`${JSON.stringify(observation, null, '\t')}\n`);
	if (!observation.booted) process.exitCode = 1;
}

if (process.argv[1]?.endsWith('angular-tiny-translator-boot-check.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
