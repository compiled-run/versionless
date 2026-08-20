/**
 * The `All units` probe: one stage-labelled pass over both lanes, taken because
 * the published journey asserts a count the application contradicts.
 *
 * The journey's reviewer half ends by widening the unit list back out — the
 * reviewer commits the last `Review needed` unit, the filtered list empties, and
 * the journey clicks `All units` to read the committed state back. It then
 * asserts that the widened list carries every unit the synthetic file declared.
 * The migrated lane disagreed with that number, and a disagreement between two
 * lanes about a list the application renders is a fact worth measuring rather
 * than a number worth adjusting until it passes.
 *
 * So this driver walks the same gestures in both lanes and, at each labelled
 * stage, records what the application actually renders: which filter radio is
 * checked, how many rows the list holds, and the state text on each row. It
 * asserts nothing. The reading it writes is what the journey's assertion is then
 * corrected to.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'pathe';
import { chromium, type Page } from 'playwright';
import { canonical } from './angular-factoriolab-migration-run.ts';

const root = resolve(import.meta.dirname, '../../../..');
const STAGE = join(root, '.versionless/stage/angular-tiny-translator-v0-12-0-u17b');
const FIXTURE = join(
	root,
	'fixtures/angular-tiny-translator-v0-12-0/witness/synthetic-messages.xlf',
);

/** The two lanes, each served exactly as its own build emitted it. */
export const PROBE_LANE_ROOTS = Object.freeze({
	era: join(
		root,
		'.versionless/cache/angular-tiny-translator-v0-12-0-baseline/app/dist/rebuild-1',
	),
	migrated: join(STAGE, 'dist-13'),
});

const MIME: Readonly<Record<string, string>> = Object.freeze({
	'.css': 'text/css',
	'.eot': 'application/vnd.ms-fontobject',
	'.html': 'text/html',
	'.ico': 'image/x-icon',
	'.js': 'text/javascript',
	'.json': 'application/json',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.ttf': 'font/ttf',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
});

type StaticLane = Readonly<{ origin: string; close: () => Promise<void> }>;

async function serveLane(laneRoot: string): Promise<StaticLane> {
	const handler = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
		const requested = (request.url ?? '/').split('?')[0] ?? '/';
		let decoded = requested;
		try {
			decoded = decodeURIComponent(requested);
		} catch {
			decoded = requested;
		}
		let file = join(laneRoot, decoded);
		try {
			const entry = await stat(file);
			if (entry.isDirectory()) file = join(file, 'index.html');
		} catch {
			file = join(laneRoot, 'index.html');
		}
		try {
			const raw = await readFile(file);
			response.writeHead(200, {
				'content-type': MIME[extname(file)] ?? 'application/octet-stream',
			});
			response.end(raw);
		} catch (error: unknown) {
			response.writeHead(500);
			response.end(error instanceof Error ? error.message : String(error));
		}
	};
	const server: Server = createServer((request, response) => {
		void handler(request, response);
	});
	await new Promise<void>((done) => {
		server.listen(0, '127.0.0.1', () => {
			done();
		});
	});
	const address = server.address() as AddressInfo;
	return Object.freeze({
		origin: `http://127.0.0.1:${String(address.port)}`,
		close: async (): Promise<void> => {
			await new Promise<void>((done) => {
				server.close(() => {
					done();
				});
			});
		},
	});
}

const UNIT_LIST = 'app-translate-unit-list';
const UNIT_ITEM = `${UNIT_LIST} mat-list-item`;
const TEXTAREA = '#translationinput textarea';
const UNDO = '#translation button[mat-icon-button]';
const FILTER_ALL = `${UNIT_LIST} mat-radio-button[value=all] label`;
const FILTER_NEEDS_REVIEW = `${UNIT_LIST} mat-radio-button[value=needsReview] label`;
const TYPED = 'Synthetic greeting unit, witnessed';

export type StageReading = Readonly<{
	stage: string;
	checkedFilters: readonly string[];
	listItems: number;
	rowTexts: readonly string[];
	bodyHasStateFinal: boolean;
	bodyHasNoTranslationUnit: boolean;
	/** Whether the text the journey typed is anywhere on the page at this stage. */
	bodyHasTypedTranslation: boolean;
}>;

async function read(page: Page, stage: string): Promise<StageReading> {
	const raw = await page.evaluate(() => {
		const checked = [...document.querySelectorAll('app-translate-unit-list mat-radio-button')]
			.filter((button) => {
				const input = button.querySelector('input[type=radio]');
				return input instanceof HTMLInputElement && input.checked;
			})
			.map((button) => button.getAttribute('value') ?? '');
		const rows = [...document.querySelectorAll('app-translate-unit-list mat-list-item')].map(
			(row) => (row.textContent ?? '').replace(/\s+/gu, ' ').trim(),
		);
		const body = document.body.innerText;
		return {
			checked,
			rows,
			stateFinal: body.includes('State final'),
			noUnit: body.includes('No Translation Unit'),
			typed: body.includes('Synthetic greeting unit, witnessed'),
		};
	});
	return Object.freeze({
		stage,
		checkedFilters: Object.freeze(raw.checked),
		listItems: raw.rows.length,
		rowTexts: Object.freeze(raw.rows),
		bodyHasStateFinal: raw.stateFinal,
		bodyHasNoTranslationUnit: raw.noUnit,
		bodyHasTypedTranslation: raw.typed,
	});
}

export type LaneProbe = Readonly<{
	lane: 'era' | 'migrated';
	laneRoot: string;
	pageErrors: readonly string[];
	stages: readonly StageReading[];
}>;

/**
 * The published journey's reviewer half, walked gesture for gesture, with a
 * reading taken at every stage it passes through.
 */
export async function probeLane(lane: 'era' | 'migrated'): Promise<LaneProbe> {
	const laneRoot = PROBE_LANE_ROOTS[lane];
	const served = await serveLane(laneRoot);
	const browser = await chromium.launch();
	const pageErrors: string[] = [];
	const stages: StageReading[] = [];
	try {
		const context = await browser.newContext({
			viewport: { width: 1280, height: 1024 },
			acceptDownloads: false,
		});
		await context.route('**/*', async (route) => {
			const host = new URL(route.request().url()).hostname;
			if (host === '127.0.0.1' || host === 'localhost') {
				await route.continue();
				return;
			}
			await route.fulfill({ status: 200, body: '' });
		});
		const page = await context.newPage();
		page.on('pageerror', (error) => {
			pageErrors.push(error.message);
		});
		await page.goto(`${served.origin}/#/home`, { waitUntil: 'load' });
		await page.waitForSelector('#apptitle', { timeout: 60000 });
		await page.click('a[mat-raised-button]');
		await page.waitForSelector('#createProjectForm');
		await page.fill(
			'#createProjectForm input[formControlName=projectName]',
			'versionless-witness',
		);
		await page.setInputFiles('input[type=file]', FIXTURE);
		await page.waitForFunction(() => document.body.innerText.includes('3 entries'), null, {
			timeout: 60000,
		});
		await page.click('mat-radio-button[value=withReview]');
		await page.click('#createProjectForm button[mat-raised-button]');
		await page.waitForSelector(UNIT_ITEM);
		stages.push(await read(page, 'project-created-default-filter'));

		await page.click(`${UNIT_LIST} mat-list-item:nth-of-type(1)`);
		await page.waitForSelector(TEXTAREA);
		await page.click(TEXTAREA);
		await page.keyboard.press('Meta+A');
		await page.type(TEXTAREA, TYPED);
		await page.waitForSelector(`${UNDO}:not([disabled])`, { timeout: 30000 });
		await page.click('button:has(:text-is("mark as translated"))');
		await page.waitForFunction(
			() => document.body.innerText.includes('33 % translated'),
			null,
			{
				timeout: 30000,
			},
		);
		stages.push(await read(page, 'after-mark-translated'));

		await page.click('a[href="#/editproject"]');
		await page.waitForSelector('#editProjectForm');
		await page.click('mat-radio-button[value=reviewer]');
		await page.click('#editProjectForm button[mat-raised-button]');
		await page.waitForFunction(
			() => document.body.innerText.includes('You are currently working as reviewer!'),
			null,
			{ timeout: 30000 },
		);
		stages.push(await read(page, 'reviewer-role-set'));

		await page.click(FILTER_NEEDS_REVIEW);
		await page.waitForTimeout(500);
		stages.push(await read(page, 'review-needed-filter'));

		await page.click('button:has(:text-is("mark as reviewed"))');
		await page.waitForTimeout(1000);
		stages.push(await read(page, 'after-mark-reviewed-still-review-needed-filter'));

		await page.click(FILTER_ALL);
		await page.waitForTimeout(1000);
		stages.push(await read(page, 'all-units-filter-after-review'));

		await page.click(`${UNIT_LIST} mat-list-item:nth-of-type(1)`);
		await page.waitForTimeout(500);
		stages.push(await read(page, 'all-units-first-row-opened'));

		// The journey's last stage: a real document reload, which is what the
		// persistence claim rests on. What the application restores is the reading
		// this probe exists for.
		await page.reload({ waitUntil: 'load' });
		await page.waitForSelector(UNIT_ITEM, { timeout: 60000 });
		await page.waitForTimeout(1500);
		stages.push(await read(page, 'after-online-reload-default-filter'));
		await page.click(FILTER_ALL);
		await page.waitForTimeout(1000);
		stages.push(await read(page, 'after-online-reload-all-units-filter'));
		await page.click(`${UNIT_LIST} mat-list-item:nth-of-type(1)`);
		await page.waitForTimeout(500);
		stages.push(await read(page, 'after-online-reload-first-row-opened'));
		return Object.freeze({
			lane,
			laneRoot: laneRoot.slice(root.length + 1),
			pageErrors: Object.freeze([...pageErrors]),
			stages: Object.freeze(stages),
		});
	} finally {
		await browser.close();
		await served.close();
	}
}

export async function probeBothLanes(): Promise<Readonly<Record<string, unknown>>> {
	const era = await probeLane('era');
	const migrated = await probeLane('migrated');
	const stageNames = era.stages.map((stage) => stage.stage);
	return Object.freeze({
		era,
		migrated,
		perStage: stageNames.map((stage, index) => ({
			stage,
			eraItems: era.stages[index]?.listItems ?? null,
			migratedItems: migrated.stages[index]?.listItems ?? null,
			agrees: era.stages[index]?.listItems === migrated.stages[index]?.listItems,
		})),
	});
}

export async function main(): Promise<void> {
	const reading = await probeBothLanes();
	await writeFile(join(STAGE, 'allunits-probe.json'), canonical(reading));
	process.stdout.write(`${canonical(reading)}\n`);
}

if (process.argv[1]?.endsWith('angular-tiny-translator-allunits-probe-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
