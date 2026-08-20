/**
 * The discriminator u19h caught the data loss with, re-run against the lane the
 * CVA capability produced.
 *
 * The reading is one fact, taken on both lanes by the same code: after a
 * translation is typed into the editor and the 200 ms debounce window has
 * passed several times over, does the undo control still carry `disabled`?
 *
 * On the era cell it does not — the edit reached the outer control, the unit
 * became dirty, and undo became available. On the migrated lane u19h measured,
 * it did: the edit reached a `FormGroup` the view had been detached from, the
 * outer control stayed pristine, and the application committed the ORIGINAL
 * text under a changed state. Nothing about that is visible to a build.
 *
 * So this driver measures it rather than asserting it. Both lanes are served
 * from loopback exactly as their own builds emitted them, with every
 * non-loopback request aborted, and neither bundle is patched: this is the
 * shipped artifact, driven through the application's own gestures.
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

/** The two lanes this discriminator separates. */
export const BEHAVIOR_LANE_ROOTS = Object.freeze({
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

const TEXTAREA = '#translationinput textarea';
const TYPED = 'PROBE TEXT';
/** Fifteen debounce windows. u19h's era propagation lands at ~200 ms. */
const SETTLE_MS = 3000;

export type DiscriminatorReading = Readonly<{
	hostClass: string;
	textareaDirty: boolean;
	textareaValue: string;
	undoDisabled: string | null;
}>;

async function readDom(page: Page): Promise<DiscriminatorReading> {
	return await page.evaluate(() => {
		const host = document.querySelector('#translationinput');
		const textarea = document.querySelector('#translationinput textarea');
		const undo = document.querySelector('#translation button[mat-icon-button]');
		return {
			hostClass: host === null ? '' : host.className,
			textareaDirty: textarea !== null && textarea.className.split(' ').includes('ng-dirty'),
			textareaValue: textarea instanceof HTMLTextAreaElement ? textarea.value : '',
			undoDisabled: undo === null ? null : undo.getAttribute('disabled'),
		};
	});
}

/**
 * The application's own route to a unit in the editor: create a project through
 * its form, hand it the synthetic file through its own file input, and open the
 * first unit. Nothing is faked and no state is written behind its back.
 */
async function driveToEditor(page: Page, origin: string): Promise<void> {
	await page.goto(`${origin}/#/home`, { waitUntil: 'load' });
	await page.waitForSelector('#apptitle', { timeout: 60000 });
	await page.click('a[mat-raised-button]');
	await page.waitForSelector('#createProjectForm');
	await page.fill('#createProjectForm input[formControlName=projectName]', 'u19j');
	await page.setInputFiles('input[type=file]', FIXTURE);
	await page.waitForFunction(() => document.body.innerText.includes('3 entries'), null, {
		timeout: 60000,
	});
	await page.click('mat-radio-button[value=withReview]');
	await page.click('#createProjectForm button[mat-raised-button]');
	await page.waitForSelector('app-translate-unit-list mat-list-item');
	await page.click('app-translate-unit-list mat-list-item:nth-of-type(1)');
	await page.waitForSelector(TEXTAREA);
}

export type LaneBehavior = Readonly<{
	lane: 'era' | 'migrated';
	laneRoot: string;
	pageErrors: readonly string[];
	beforeTyping: DiscriminatorReading;
	afterSettle: DiscriminatorReading;
	/** The discriminator: the undo control lost `disabled` inside the settle window. */
	undoEnabledAfterSettle: boolean;
}>;

export async function measureLane(lane: 'era' | 'migrated'): Promise<LaneBehavior> {
	const laneRoot = BEHAVIOR_LANE_ROOTS[lane];
	const served = await serveLane(laneRoot);
	const browser = await chromium.launch();
	const pageErrors: string[] = [];
	try {
		const context = await browser.newContext({
			viewport: { width: 1280, height: 900 },
			acceptDownloads: false,
		});
		// Loopback only. Nothing in this measurement is allowed to leave the machine.
		await context.route('**/*', async (route) => {
			const host = new URL(route.request().url()).hostname;
			if (host === '127.0.0.1' || host === 'localhost') {
				await route.continue();
				return;
			}
			await route.abort();
		});
		const page = await context.newPage();
		page.on('pageerror', (error) => {
			pageErrors.push(error.message);
		});
		await driveToEditor(page, served.origin);
		const beforeTyping = await readDom(page);
		await page.click(TEXTAREA);
		await page.keyboard.press('Meta+A');
		await page.type(TEXTAREA, TYPED);
		await page.waitForTimeout(SETTLE_MS);
		const afterSettle = await readDom(page);
		return Object.freeze({
			lane,
			laneRoot: laneRoot.slice(root.length + 1),
			pageErrors: Object.freeze([...pageErrors]),
			beforeTyping,
			afterSettle,
			undoEnabledAfterSettle: afterSettle.undoDisabled === null,
		});
	} finally {
		await browser.close();
		await served.close();
	}
}

export async function measureDiscriminator(): Promise<Readonly<Record<string, unknown>>> {
	const era = await measureLane('era');
	const migrated = await measureLane('migrated');
	return Object.freeze({
		era,
		migrated,
		flipped: migrated.undoEnabledAfterSettle,
		agrees: era.undoEnabledAfterSettle === migrated.undoEnabledAfterSettle,
	});
}

export async function main(): Promise<void> {
	const reading = await measureDiscriminator();
	await writeFile(join(STAGE, 'cva-behavior.json'), canonical(reading));
	process.stdout.write(`${canonical(reading)}\n`);
}

if (process.argv[1]?.endsWith('angular-tiny-translator-cva-behavior-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
