import { basename, join, resolve } from 'pathe';
import { chromium } from 'playwright';
import { createEshopWebspaProjection } from '../witness/angular-eshop-webspa-projection.ts';
import { startStaticServer } from '../witness/real-app-run.ts';

/**
 * A measurement probe, not a proof.
 *
 * The Witness journey for the eShop WebSPA holdout may only pin values that were
 * measured off the live DOM of the two retained builds. This driver serves one
 * lane through the same bounded loopback static server and the same declared API
 * projection the journey will use, drives the anonymous catalog surface, and
 * prints what the application actually rendered. Nothing it prints is evidence;
 * it exists so the journey's selectors, counts and texts are read off the
 * application rather than assumed, and so a wrong assumption fails here rather
 * than turning into a pinned claim.
 */
const root = resolve(import.meta.dirname, '../../../..');
const chromiumExecutable = join(
	root,
	'.versionless/cache/react-boilerplate-v4/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell',
);
const laneRoots = {
	baseline: join(root, '.versionless/work/angular-eshop-webspa/build-run1'),
	migrated: join(root, '.versionless/work/angular-eshop-webspa/target/app/wwwroot'),
} as const;

type Lane = keyof typeof laneRoots;

const CATALOG_ITEM = '.esh-catalog-item';
const BRAND_SELECT = '.esh-catalog-label[data-title="brand"] .esh-catalog-filter';
const TYPE_SELECT = '.esh-catalog-label[data-title="type"] .esh-catalog-filter';
const SEND = '.esh-catalog-send';

async function probeLane(lane: Lane): Promise<void> {
	const projection = createEshopWebspaProjection();
	const server = await startStaticServer(laneRoots[lane], { api: projection.api });
	const browser = await chromium.launch({ executablePath: chromiumExecutable, headless: true });
	const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
	const page = await context.newPage();
	const consoleMessages: string[] = [];
	const failedRequests: string[] = [];
	page.on('console', (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
	page.on('pageerror', (error) => consoleMessages.push(`pageerror: ${error.message}`));
	page.on('requestfailed', (request) =>
		failedRequests.push(`${request.url()} ${request.failure()?.errorText ?? ''}`),
	);
	const snapshot = async (label: string): Promise<void> => {
		const measured = await page.evaluate(() => {
			const all = (selector: string): Element[] => [...document.querySelectorAll(selector)];
			const texts = (selector: string): string[] =>
				all(selector).map((element) => (element.textContent ?? '').trim());
			return {
				items: all('.esh-catalog-item').length,
				names: texts('.esh-catalog-name span'),
				prices: texts('.esh-catalog-price span'),
				brandOptions: all('.esh-catalog-label[data-title="brand"] option').map(
					(element) => [
						(element as HTMLOptionElement).value,
						(element.textContent ?? '').trim(),
					],
				),
				typeOptions: all('.esh-catalog-label[data-title="type"] option').map((element) => [
					(element as HTMLOptionElement).value,
					(element.textContent ?? '').trim(),
				]),
				brandValue: (
					document.querySelector(
						'.esh-catalog-label[data-title="brand"] .esh-catalog-filter',
					) as HTMLSelectElement | null
				)?.value,
				typeValue: (
					document.querySelector(
						'.esh-catalog-label[data-title="type"] .esh-catalog-filter',
					) as HTMLSelectElement | null
				)?.value,
				pagerLines: texts('.esh-pager-item').filter((text) => text.startsWith('Showing')),
				pagers: all('.esh-pager').length,
				nextClasses: all('#Next').map((element) => element.className),
				previousClasses: all('#Previous').map((element) => element.className),
				thumbnails: all('.esh-catalog-thumbnail').map((element) =>
					element.getAttribute('src'),
				),
				identity: texts('.esh-identity-name'),
				basketStatus: all('esh-basket-status').length,
				emptyMessage: texts('esh-catalog span').filter((text) =>
					text.startsWith('THERE ARE NO RESULTS'),
				),
				scroll: {
					scrollHeight: document.documentElement.scrollHeight,
					clientHeight: document.documentElement.clientHeight,
					scrollY: window.scrollY,
				},
				title: document.title,
			};
		});
		process.stdout.write(`\n### ${lane} :: ${label}\n${JSON.stringify(measured, null, 1)}\n`);
	};

	try {
		await page.goto(server.origin, { waitUntil: 'load' });
		await page.waitForSelector(CATALOG_ITEM, { timeout: 20_000 });
		await snapshot('initial catalog');

		await page.click('#Next');
		await page.waitForFunction(
			() =>
				[...document.querySelectorAll('.esh-pager-item')].some((element) =>
					(element.textContent ?? '').includes('Page 2'),
				),
			undefined,
			{ timeout: 10_000 },
		);
		await snapshot('after Next');

		await page.click('#Previous');
		await page.waitForFunction(
			() =>
				[...document.querySelectorAll('.esh-pager-item')].some((element) =>
					(element.textContent ?? '').includes('Page 1'),
				),
			undefined,
			{ timeout: 10_000 },
		);
		await snapshot('after Previous');

		// Selecting a native `<select>` option. `ArrowDown` on a closed select was
		// measured NOT to move the selection under this browser (value unchanged,
		// zero `change` events), while the browser's own type-ahead does move it
		// and fires the application's handler. The journey uses the gesture that
		// genuinely works, and this is where that was established.
		await page.press(TYPE_SELECT, 'm');
		await page.waitForTimeout(200);
		process.stdout.write(
			`TYPE-SELECT after type-ahead: ${await page.$eval(
				TYPE_SELECT,
				(element) => (element as HTMLSelectElement).value,
			)}\n`,
		);
		await page.click(SEND);
		await page.waitForTimeout(500);
		await snapshot('after type filter applied');

		await page.focus(BRAND_SELECT);
		await page.press(BRAND_SELECT, 'n');
		await page.click(SEND);
		await page.waitForTimeout(500);
		await snapshot('after brand+type filter applied');

		process.stdout.write(
			`\n### ${lane} :: projection ledger\n${JSON.stringify(
				projection.ledger().filter((entry) => entry.decision !== 'declined-non-api'),
				null,
				1,
			)}\n`,
		);
		process.stdout.write(
			`\n### ${lane} :: console\n${consoleMessages.join('\n')}\n### ${lane} :: failed\n${failedRequests.join('\n')}\n`,
		);
	} finally {
		await context.close();
		await browser.close();
		await server.close();
	}
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const lane = args[0];
	if (lane !== 'baseline' && lane !== 'migrated')
		throw new Error('eShop WebSPA witness probe requires a lane: baseline | migrated');
	await probeLane(lane);
}

if (basename(process.argv[1] ?? '') === 'angular-eshop-webspa-witness-probe.ts')
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
