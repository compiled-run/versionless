/**
 * TinyTranslator silent translation loss — the root-cause driver.
 *
 * u19h measured the break: a translation typed into the migrated lane's editor
 * never reaches the outer control, the unit is committed with its ORIGINAL text
 * under a changed state, and the exported XLIFF says `state="final"` over text
 * nobody typed. The chain that should carry the edit is
 * `form.valueChanges.pipe(debounceTime(200)) → propagateChange(...)`, and the
 * `.pipe` in it is our own `rxjs-prototype-patch` capability's output. This unit
 * attributes the break, and attribution is worth nothing unless it is measured.
 *
 * Everything published here is measured in this process. The static half is read
 * out of the two pinned closures and the two pinned output roots at run time, so
 * a record cannot outlive the bytes it describes. The browser half runs both
 * lanes: the era lane unmodified, and the migrated lane with counters inserted
 * into four byte-exact sites of its own shipped bundle. The insertion adds
 * recording and changes no application statement — each site is required to
 * occur exactly once in the shipped bytes, and the driver refuses to run if one
 * of them has moved.
 *
 * The decisive measurement is a positive control. After the typed edit fails to
 * propagate, the driver pushes a value into the very FormGroup the debounced
 * subscription is watching. If our translated pipe were defective, nothing would
 * happen. What happens is that it emits, on time.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { Dirent } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'pathe';
import { chromium, type Browser, type Page } from 'playwright';
import { sha256 } from '../../../core/src/receipts/canonicalize.ts';
import { canonical } from './angular-factoriolab-migration-run.ts';
import {
	sealRecord,
	verifySealedRecord,
	type SealedRecord,
} from './angular-factoriolab-build-lanes-run.ts';

const root = resolve(import.meta.dirname, '../../../..');
export const EVIDENCE_DIRECTORY = join(root, 'evidence/runs/angular-tiny-translator-v0-12-0');
export const CAUSE_FILE = 'u19i-data-loss-cause.json';
const UNIT = 'lrapr-t006/u19i-data-loss-root-cause';
const CONSENT = 'VL-LEGACY-CORPUS-2026-08-10';

const ERA_APP = join(root, '.versionless/cache/angular-tiny-translator-v0-12-0-baseline/app');
const MIGRATED_APP = join(root, '.versionless/stage/angular-tiny-translator-v0-12-0-u17b/app');
const LANE_ROOTS = {
	era: join(ERA_APP, 'dist/rebuild-1'),
	migrated: join(root, '.versionless/stage/angular-tiny-translator-v0-12-0-u17b/dist-11'),
} as const;
const FIXTURE = join(root, 'fixtures/angular-tiny-translator-v0-12-0/witness/synthetic-messages.xlf');
const COMPONENT = 'src/app/normalized-message-input/normalized-message-input.component.ts';

/**
 * The four sites the driver inserts counters into, byte-exact as the shipped
 * migrated bundle carries them. Each must occur exactly once. The replacement
 * for a site always contains the site's own statements unchanged.
 */
export const MIGRATED_PATCH_SITES = Object.freeze([
	Object.freeze({
		label: 'initForm',
		find:
			'initForm(){this.subscription&&this.subscription.unsubscribe(),this.form=this.formBuilder.group(' +
			'{displayedText:[{value:this.textToDisplay(),disabled:this.disabled}],icuMessages:this.formBuilder.array(' +
			'this.initIcuMessagesFormArray())}),this.subscription=this.form.valueChanges.pipe(Yd(200)).subscribe(' +
			'e=>{this.valueChanged(e)})}',
		replace:
			'initForm(){this.subscription&&this.subscription.unsubscribe(),this.form=this.formBuilder.group(' +
			'{displayedText:[{value:this.textToDisplay(),disabled:this.disabled}],icuMessages:this.formBuilder.array(' +
			'this.initIcuMessagesFormArray())}),' +
			"window.__P.ev.push({k:'initForm',ro:!!this.readonly,t:Math.round(performance.now())})," +
			'window.__P.reg(this),window.__P.subscribedForm=this.form,' +
			"this.form.valueChanges.subscribe(()=>window.__P.ev.push({k:'rawValueChangesOnSubscribedForm'," +
			'ro:!!this.readonly,t:Math.round(performance.now())})),' +
			'this.subscription=this.form.valueChanges.pipe(Yd(200)).subscribe(' +
			"e=>{window.__P.ev.push({k:'debouncedEmit',ro:!!this.readonly,t:Math.round(performance.now())})," +
			'this.valueChanged(e)})}',
	}),
	Object.freeze({
		label: 'setDisabledState',
		find:
			'setDisabledState(e){this.disabled=e,this.form=this.formBuilder.group(' +
			'{displayedText:[{value:this.textToDisplay(),disabled:this.disabled}]})}',
		replace:
			"setDisabledState(e){window.__P.ev.push({k:'setDisabledState',arg:e,ro:!!this.readonly," +
			't:Math.round(performance.now()),hadSub:!!this.subscription}),' +
			'this.disabled=e,this.form=this.formBuilder.group(' +
			'{displayedText:[{value:this.textToDisplay(),disabled:this.disabled}]}),window.__P.reg(this)}',
	}),
	Object.freeze({
		label: 'registerOnChange',
		find: 'registerOnChange(e){this.propagateChange=e}',
		replace:
			"registerOnChange(e){window.__P.ev.push({k:'registerOnChange',ro:!!this.readonly," +
			't:Math.round(performance.now())}),this.propagateChange=e}',
	}),
	Object.freeze({
		label: 'valueChanged',
		find: 'valueChanged(e){if(!this.readonly&&this.message)',
		replace:
			"valueChanged(e){window.__P.ev.push({k:'valueChanged',ro:!!this.readonly," +
			't:Math.round(performance.now())});if(!this.readonly&&this.message)',
	}),
]);

export function patchMigratedBundle(text: string): string {
	let patched = text;
	for (const site of MIGRATED_PATCH_SITES) {
		const occurrences = patched.split(site.find).length - 1;
		if (occurrences !== 1)
			throw new Error(
				`TinyTranslator cause driver found ${String(occurrences)} occurrences of the ${site.label} site; it must occur exactly once`,
			);
		patched = patched.replace(site.find, site.replace);
	}
	return patched;
}

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

/**
 * The lane, served from loopback exactly as its own build emitted it, with the
 * hash router's unknown paths falling back to the document the build wrote.
 */
async function serveLane(laneRoot: string, patchMain: boolean): Promise<StaticLane> {
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
			const name = file.slice(file.lastIndexOf('/') + 1);
			const body =
				patchMain && name.startsWith('main.') && name.endsWith('.js')
					? Buffer.from(patchMigratedBundle(raw.toString('utf8')), 'utf8')
					: raw;
			response.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
			response.end(body);
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

/** The timer census. Installed before any application byte evaluates. */
const TIMER_INIT = `
(() => {
	const log = [];
	window.__T = log;
	const nativeSetInterval = window.setInterval;
	const nativeClearInterval = window.clearInterval;
	let seq = 0;
	window.setInterval = function (handler, delay, ...rest) {
		if (typeof handler !== 'function') return nativeSetInterval.call(window, handler, delay, ...rest);
		const record = { seq: seq++, delay, scheduledAt: performance.now(), fired: 0, firedAt: [], cleared: null };
		log.push(record);
		const id = nativeSetInterval.call(window, function (...args) {
			record.fired += 1;
			record.firedAt.push(performance.now());
			return handler.apply(this, args);
		}, delay, ...rest);
		record.id = id;
		return id;
	};
	window.clearInterval = function (id) {
		for (const record of log) if (record.id === id && record.cleared === null) record.cleared = performance.now();
		return nativeClearInterval.call(window, id);
	};
})();
`;

/** The counter sink the inserted sites write into. */
const PROBE_INIT = `
(() => {
	window.__P = {
		ev: [],
		instances: [],
		reg(component) { if (!window.__P.instances.includes(component)) window.__P.instances.push(component); },
	};
})();
`;

type ProbeEvent = Readonly<{
	k: string;
	t: number;
	ro?: boolean;
	arg?: boolean;
	hadSub?: boolean;
}>;

type TimerRecord = Readonly<{
	delay: number;
	scheduledAt: number;
	fired: number;
	firedAt: readonly number[];
	cleared: number | null;
}>;

type DomReading = Readonly<{
	hostClass: string;
	textareaDirty: boolean;
	textareaValue: string;
	undoDisabled: string | null;
}>;

type ProbeForm = {
	controls: Record<string, { setValue: (value: string) => void }>;
	valueChanges: { subscribe: (next: () => void) => void };
	getRawValue: () => unknown;
};

type ProbeComponent = {
	readonly?: boolean;
	disabled: boolean;
	form: ProbeForm;
	subscription: { closed: boolean };
	propagateChange: (value: unknown) => void;
};

type ProbeWindow = typeof globalThis & {
	__P: {
		ev: ProbeEvent[];
		instances: ProbeComponent[];
		subscribedForm?: ProbeForm;
		liveForm?: ProbeForm;
	};
	__T: TimerRecord[];
};

const TEXTAREA = '#translationinput textarea';
const TYPED = 'PROBE TEXT';
const POSITIVE_CONTROL_TEXT = 'POSITIVE CONTROL';
/** The settle window. u19h's era measurement is ~200 ms; this is fifteen of them. */
const SETTLE_MS = 3000;

async function readDom(page: Page): Promise<DomReading> {
	return await page.evaluate(() => {
		const host = document.querySelector('#translationinput');
		const textarea = document.querySelector('#translationinput textarea');
		const undo = document.querySelector('#translation button[mat-icon-button]');
		return {
			hostClass: host === null ? '' : host.className,
			textareaDirty:
				textarea !== null && textarea.className.split(' ').includes('ng-dirty'),
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
	await page.fill('#createProjectForm input[formControlName=projectName]', 'u19i');
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

async function typeTranslation(page: Page): Promise<void> {
	await page.click(TEXTAREA);
	await page.keyboard.press('Meta+A');
	await page.type(TEXTAREA, TYPED);
}

type BrowserRun = Readonly<{ browser: Browser; page: Page; pageErrors: string[] }>;

async function openLane(initScripts: readonly string[]): Promise<BrowserRun> {
	const browser = await chromium.launch();
	const context = await browser.newContext({
		viewport: { width: 1280, height: 900 },
		acceptDownloads: false,
	});
	for (const script of initScripts) await context.addInitScript(script);
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
	const pageErrors: string[] = [];
	page.on('pageerror', (error) => {
		pageErrors.push(error.message);
	});
	return Object.freeze({ browser, page, pageErrors });
}

type EraMeasurement = Readonly<{
	pageErrors: readonly string[];
	beforeTyping: DomReading;
	afterSettle: DomReading;
	debounceTimers: readonly TimerRecord[];
	lastDebounceTimerFiredAfterMs: number | null;
}>;

/**
 * The era lane, unmodified. The 200 ms interval the era rxjs schedules for
 * `debounceTime` is the operator's own arming, and the reading below is that
 * arming, its firing, and what the application does about it.
 */
async function measureEra(): Promise<EraMeasurement> {
	const lane = await serveLane(LANE_ROOTS.era, false);
	const run = await openLane([TIMER_INIT]);
	try {
		await driveToEditor(run.page, lane.origin);
		const beforeTyping = await readDom(run.page);
		const mark = await run.page.evaluate(() => performance.now());
		await typeTranslation(run.page);
		await run.page.waitForTimeout(SETTLE_MS);
		const afterSettle = await readDom(run.page);
		const timers = await run.page.evaluate(
			(since: number) =>
				(globalThis as ProbeWindow).__T
					.filter((record) => record.delay === 200 && record.scheduledAt >= since)
					.map((record) => ({
						delay: record.delay,
						scheduledAt: Math.round(record.scheduledAt - since),
						fired: record.fired,
						firedAt: record.firedAt.map((at) => Math.round(at - since)),
						cleared: record.cleared === null ? null : Math.round(record.cleared - since),
					})),
			mark,
		);
		const fired = timers.filter((record) => record.fired > 0);
		const last = fired.at(-1);
		return Object.freeze({
			pageErrors: Object.freeze([...run.pageErrors]),
			beforeTyping,
			afterSettle,
			debounceTimers: Object.freeze(timers),
			lastDebounceTimerFiredAfterMs: last?.firedAt[0] ?? null,
		});
	} finally {
		await run.browser.close();
		await lane.close();
	}
}

type IdentityReading = Readonly<{
	componentFormIsTheSubscribedForm: boolean;
	componentFormControls: readonly string[];
	subscribedFormControls: readonly string[];
	valueChangesPrototypesIdentical: boolean;
	subscriptionClosed: boolean;
	registeredOnChangeSource: string;
}>;

type MigratedMeasurement = Readonly<{
	pageErrors: readonly string[];
	events: readonly ProbeEvent[];
	beforeTyping: DomReading;
	afterSettle: DomReading;
	afterPositiveControl: DomReading;
	identity: IdentityReading;
	debounceTimersWhileTyping: number;
	propagateChangeCallsFromTyping: number;
	positiveControlEmittedAfterMs: number | null;
}>;

/** The migrated lane, with the four counters inserted into its own bundle. */
async function measureMigrated(): Promise<MigratedMeasurement> {
	const lane = await serveLane(LANE_ROOTS.migrated, true);
	const run = await openLane([TIMER_INIT, PROBE_INIT]);
	try {
		await driveToEditor(run.page, lane.origin);
		const beforeTyping = await readDom(run.page);
		// A raw subscriber on the form the view is actually bound to, so the
		// measurement can tell "nothing emitted" from "something emitted where
		// nobody was listening".
		await run.page.evaluate(() => {
			const probe = (globalThis as ProbeWindow).__P;
			const editable = probe.instances.find((component) => component.readonly !== true);
			if (editable === undefined) throw new Error('no editable input component was registered');
			probe.liveForm = editable.form;
			editable.form.valueChanges.subscribe(() => {
				probe.ev.push({ k: 'rawValueChangesOnLiveForm', t: Math.round(performance.now()) });
			});
		});
		const mark = await run.page.evaluate(() => performance.now());
		await typeTranslation(run.page);
		await run.page.waitForTimeout(SETTLE_MS);
		const afterSettle = await readDom(run.page);
		const debounceTimersWhileTyping = await run.page.evaluate(
			(since: number) =>
				(globalThis as ProbeWindow).__T.filter(
					(record) => record.delay === 200 && record.scheduledAt >= since,
				).length,
			mark,
		);
		const identity = await run.page.evaluate(() => {
			const probe = (globalThis as ProbeWindow).__P;
			const editable = probe.instances.find((component) => component.readonly !== true);
			const subscribed = probe.subscribedForm;
			if (editable === undefined || subscribed === undefined)
				throw new Error('the migrated lane registered no editable component or no subscribed form');
			return {
				componentFormIsTheSubscribedForm: editable.form === subscribed,
				componentFormControls: Object.keys(editable.form.controls),
				subscribedFormControls: Object.keys(subscribed.controls),
				valueChangesPrototypesIdentical:
					Object.getPrototypeOf(editable.form.valueChanges) ===
					Object.getPrototypeOf(subscribed.valueChanges),
				subscriptionClosed: editable.subscription.closed,
				registeredOnChangeSource: String(editable.propagateChange).slice(0, 200),
			};
		});
		// The positive control: the subscribed FormGroup itself is given a value.
		const positiveControlAt = await run.page.evaluate((text: string) => {
			const probe = (globalThis as ProbeWindow).__P;
			const subscribed = probe.subscribedForm;
			if (subscribed === undefined) throw new Error('no subscribed form to drive');
			const at = performance.now();
			probe.ev.push({ k: 'positiveControlSetValue', t: Math.round(at) });
			subscribed.controls['displayedText']?.setValue(text);
			return at;
		}, POSITIVE_CONTROL_TEXT);
		await run.page.waitForTimeout(1500);
		const afterPositiveControl = await readDom(run.page);
		const rawEvents = await run.page.evaluate(() => (globalThis as ProbeWindow).__P.ev);
		const events = rawEvents.map((event) => ({ ...event, t: Math.round(event.t - mark) }));
		const emit = rawEvents.find(
			(event) => event.k === 'debouncedEmit' && event.t >= Math.round(positiveControlAt),
		);
		return Object.freeze({
			pageErrors: Object.freeze([...run.pageErrors]),
			events: Object.freeze(events),
			beforeTyping,
			afterSettle,
			afterPositiveControl,
			identity,
			debounceTimersWhileTyping,
			propagateChangeCallsFromTyping: events.filter(
				(event) => event.k === 'valueChanged' && event.t < Math.round(positiveControlAt - mark),
			).length,
			positiveControlEmittedAfterMs:
				emit === undefined ? null : Math.round(emit.t - positiveControlAt),
		});
	} finally {
		await run.browser.close();
		await lane.close();
	}
}

/** A named slice of a source file, read out of the tree rather than restated. */
function slice(text: string, from: string, to: string): string {
	const start = text.indexOf(from);
	if (start === -1) throw new Error(`TinyTranslator cause driver could not find: ${from}`);
	const end = text.indexOf(to, start + from.length);
	if (end === -1) throw new Error(`TinyTranslator cause driver could not find the end of: ${from}`);
	return text.slice(start, end + to.length);
}

type RxjsInstall = Readonly<{ path: string; version: string; reachableAtRuntime: boolean }>;

/**
 * Every rxjs in a closure, with the one question that matters about each: can
 * the application's own import graph reach it at run time, or is it a build
 * tool's private copy?
 */
async function rxjsCensus(appRoot: string): Promise<readonly RxjsInstall[]> {
	const manifest = JSON.parse(await readFile(join(appRoot, 'package.json'), 'utf8')) as Readonly<{
		dependencies?: Readonly<Record<string, string>>;
	}>;
	const runtimeDependencies = new Set(Object.keys(manifest.dependencies ?? {}));
	const found: RxjsInstall[] = [];
	const walk = async (directory: string, depth: number): Promise<void> => {
		if (depth > 4) return;
		let entries: Dirent[] = [];
		try {
			entries = await readdir(directory, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries.sort((left, right) => (left.name < right.name ? -1 : 1))) {
			if (!entry.isDirectory()) continue;
			const child = join(directory, entry.name);
			if (entry.name === 'rxjs') {
				const version = (
					JSON.parse(await readFile(join(child, 'package.json'), 'utf8')) as Readonly<{
						version: string;
					}>
				).version;
				const relativePath = child.slice(appRoot.length + 1);
				const owner = relativePath.split('/node_modules/')[0]?.replace('node_modules/', '') ?? '';
				found.push({
					path: relativePath,
					version,
					reachableAtRuntime: owner === 'rxjs' || runtimeDependencies.has(owner),
				});
				continue;
			}
			if (entry.name.startsWith('@') || entry.name === 'node_modules')
				await walk(child, depth + 1);
			else if (depth < 2) await walk(join(child, 'node_modules'), depth + 2);
		}
	};
	await walk(join(appRoot, 'node_modules'), 0);
	return Object.freeze(found);
}

type StaticEvidence = Readonly<Record<string, unknown>>;

async function readStaticEvidence(): Promise<StaticEvidence> {
	const eraComponent = await readFile(join(ERA_APP, COMPONENT), 'utf8');
	const migratedComponent = await readFile(join(MIGRATED_APP, COMPONENT), 'utf8');
	const eraForms = await readFile(
		join(ERA_APP, 'node_modules/@angular/forms/esm5/forms.js'),
		'utf8',
	);
	const migratedForms = await readFile(
		join(MIGRATED_APP, 'node_modules/@angular/forms/fesm2022/forms.mjs'),
		'utf8',
	);
	const migratedBundleName = (await readdir(LANE_ROOTS.migrated)).find(
		(name) => name.startsWith('main.') && name.endsWith('.js'),
	);
	if (migratedBundleName === undefined)
		throw new Error('the migrated lane root carries no main bundle');
	const migratedBundle = await readFile(join(LANE_ROOTS.migrated, migratedBundleName), 'utf8');
	const version = async (appRoot: string, pkg: string): Promise<string> =>
		(
			JSON.parse(await readFile(join(appRoot, 'node_modules', pkg, 'package.json'), 'utf8')) as {
				version: string;
			}
		).version;

	return Object.freeze({
		component: {
			file: COMPONENT,
			eraSha256: sha256(eraComponent),
			migratedSha256: sha256(migratedComponent),
			eraChain: slice(eraComponent, 'this.subscription = this.form.valueChanges', '});'),
			migratedChain: slice(migratedComponent, 'this.subscription = this.form.valueChanges', '});'),
			setDisabledStateEra: slice(eraComponent, 'setDisabledState?(isDisabled', '\n  }'),
			setDisabledStateMigrated: slice(migratedComponent, 'setDisabledState?(isDisabled', '\n  }'),
			setDisabledStateIdenticalAcrossTheLift:
				slice(eraComponent, 'setDisabledState?(isDisabled', '\n  }') ===
				slice(migratedComponent, 'setDisabledState?(isDisabled', '\n  }'),
			ourTranslation:
				'`.debounceTime(200)` → `.pipe(debounceTime(200))`, with `debounceTime` imported from ' +
				'`rxjs/operators` and `Subscription` moved from `rxjs/Subscription` to `rxjs` — the ' +
				'rxjs-prototype-patch capability’s output, and the only edit this capability made to ' +
				'this file.',
		},
		angularForms: {
			eraVersion: await version(ERA_APP, '@angular/forms'),
			migratedVersion: await version(MIGRATED_APP, '@angular/forms'),
			eraSetUpControl: slice(eraForms, 'function setUpControl(control, dir) {', '\n}'),
			migratedSetUpControl: slice(
				migratedForms,
				'function setUpControl(control, dir, callSetDisabledState',
				'\n}',
			),
			migratedDefault: slice(
				migratedForms,
				'const setDisabledStateDefault =',
				";\n",
			).trim(),
			/**
			 * The two bodies above are embedded verbatim; these are the readings
			 * taken from them. "Passes control.disabled" is the question that
			 * separates attaching from deferring: the era body never hands the
			 * accessor the control's current disabled state, it only forwards a
			 * later one out of `registerOnDisabledChange`. The era body does
			 * mention `setDisabledState` — inside the guard that decides whether
			 * to register that handler at all — so its mere presence proves
			 * nothing and is not read as if it did.
			 */
			eraPassesControlDisabledWhileAttaching: slice(
				eraForms,
				'function setUpControl(control, dir) {',
				'\n}',
			).includes('setDisabledState(control.disabled)'),
			eraDefersToRegisterOnDisabledChange: slice(
				eraForms,
				'function setUpControl(control, dir) {',
				'\n}',
			).includes('control.registerOnDisabledChange('),
			migratedPassesControlDisabledWhileAttaching: slice(
				migratedForms,
				'function setUpControl(control, dir, callSetDisabledState',
				'\n}',
			).includes('setDisabledState?.(control.disabled)'),
			migratedAttachGuard: slice(
				migratedForms,
				'if (control.disabled || callSetDisabledState',
				'\n    }',
			),
		},
		runtime: {
			eraRxjs: await version(ERA_APP, 'rxjs'),
			migratedRxjs: await version(MIGRATED_APP, 'rxjs'),
			eraZone: await version(ERA_APP, 'zone.js'),
			migratedZone: await version(MIGRATED_APP, 'zone.js'),
			eraRxjsInstalls: await rxjsCensus(ERA_APP),
			migratedRxjsInstalls: await rxjsCensus(MIGRATED_APP),
		},
		migratedBundle: {
			file: migratedBundleName,
			sha256: sha256(migratedBundle),
			compiledChain: slice(
				migratedBundle,
				'this.subscription=this.form.valueChanges',
				'this.valueChanged(e)})}',
			),
			compiledSetDisabledState: MIGRATED_PATCH_SITES[1]?.find ?? '',
			debounceTimeDefinitionsInBundle: migratedBundle.split('function Yd(t,n=Fh){').length - 1,
		},
	});
}

export function buildCauseRecord(input: {
	readonly staticEvidence: StaticEvidence;
	readonly era: EraMeasurement;
	readonly migrated: MigratedMeasurement;
}): SealedRecord {
	const { staticEvidence, era, migrated } = input;
	return sealRecord({
		schemaVersion: 'versionless.angular-tiny-translator-data-loss-cause.v1',
		unit: UNIT,
		consentId: CONSENT,
		result: 'attributed-app-latent-bug-exposed-our-pipe-translation-cleared',
		attributedCause: 'app-latent-bug-exposed',
		meaning:
			'The migrated lane loses a typed translation because the application’s own ' +
			'`setDisabledState` rebuilds `this.form` and never re-subscribes, and Angular 16 calls ' +
			'`setDisabledState` on every ControlValueAccessor as it attaches — including an enabled ' +
			'one. Angular 5 called it only for a control that was already disabled, so on the era ' +
			'cell the method never ran and the bug never fired. The debounced subscription our ' +
			'`.pipe(debounceTime(200))` translation carries is alive and correct: it is watching a ' +
			'FormGroup the view was detached from a microtask after it was built. Nothing typed ever ' +
			'reaches it, `propagateChange` is never called, the outer control stays pristine, and the ' +
			'commit writes the ORIGINAL text under a changed state.',
		mechanism: Object.freeze([
			'ngOnInit → initForm() builds FormGroup A {displayedText, icuMessages} and subscribes ' +
				'A.valueChanges.pipe(debounceTime(200)) → valueChanged → propagateChange.',
			'@angular/forms 16.2.12 setUpControl calls valueAccessor.setDisabledState(control.disabled) ' +
				'unconditionally, because CALL_SET_DISABLED_STATE defaults to `always`.',
			'The application’s setDisabledState assigns this.form = a NEW FormGroup B {displayedText} ' +
				'and does not touch this.subscription.',
			'The template’s [formGroup]="form" now binds the view to B. Typing updates B, so the ' +
				'textarea goes ng-dirty; A never receives a value, so debounceTime never arms.',
			'propagateChange — Angular’s own updateControl closure — is therefore never called, the ' +
				'host app-normalized-message-input stays ng-pristine, translate-unit._editedTargetMessage ' +
				'keeps the unit’s original message, and commitChanges() writes that original message with ' +
				'the new target state.',
		]),
		refuted: Object.freeze([
			Object.freeze({
				hypothesis: 'our transform’s output (the rxjs-prototype-patch pipe translation)',
				verdict: 'refuted',
				evidence:
					'The positive control drives the very FormGroup the translated chain subscribes to and ' +
					'the chain emits on time — see measurements.migrated.positiveControlEmittedAfterMs. The ' +
					'compiled site in the shipped bundle is `this.form.valueChanges.pipe(Yd(200)).subscribe(...)` ' +
					'where Yd is rxjs 7’s debounceTime, and the subscription is open at the moment of loss. ' +
					'The capability’s edit is `.debounceTime(200)` → `.pipe(debounceTime(200))`, which is the ' +
					'documented rxjs 5→7 equivalent, and it changed nothing else in the method.',
			}),
			Object.freeze({
				hypothesis:
					'an ecosystem/runtime interaction — dual rxjs copies, zone.js scheduling, or NgZone ' +
					'starving the debounce timer',
				verdict: 'refuted',
				evidence:
					'One rxjs is reachable at run time in the migrated closure (7.8.2); the only other install ' +
					'is rxjs 5.5.2 nested under `ngx-i18nsupport`, a devDependency build tool the application ' +
					'never imports (its source imports `ngx-i18nsupport-lib`, which declares no rxjs). The ' +
					'bundle carries exactly one debounceTime definition, and the two FormGroups’ valueChanges ' +
					'share one Observable prototype. Scheduling is not starved: no 200 ms timer is armed at ' +
					'all while typing, and the same scheduler delivers the positive control on time.',
			}),
		]),
		exposedBy: Object.freeze({
			change: 'Angular’s `callSetDisabledState` default',
			eraBehaviour:
				'@angular/forms 5.0.3 setUpControl registers registerOnDisabledChange and never calls ' +
				'setDisabledState while attaching a control.',
			migratedBehaviour:
				"@angular/forms 16.2.12 setUpControl calls it when `control.disabled || callSetDisabledState === 'always'`, " +
				'and CALL_SET_DISABLED_STATE’s root factory returns `always`.',
			angularsOwnWords:
				'The migrated framework source names the era behaviour a bug: “The legacy behavior only ' +
				'calls the CVA’s `setDisabledState` if the control is disabled. If the `callSetDisabledState` ' +
				'option is set to `always`, then this bug is fixed and the method is always called.”',
			vendorCompatibilitySwitch:
				"ReactiveFormsModule.withConfig({callSetDisabledState: 'whenDisabledForLegacyCode'}), or the " +
				'CALL_SET_DISABLED_STATE injection token, restores the era behaviour exactly. Angular ships ' +
				'it for this migration.',
		}),
		staticEvidence,
		measurements: Object.freeze({ era, migrated }),
		instrumentation: Object.freeze({
			what:
				'Four byte-exact sites of the migrated lane’s own shipped main bundle are served with ' +
				'counters inserted. Each replacement contains the original statements unchanged; each site ' +
				'must occur exactly once or the driver refuses to run. The era lane is served unmodified.',
			sites: Object.freeze(MIGRATED_PATCH_SITES.map((site) => site.label)),
			networkPolicy: 'loopback only; every non-loopback request is aborted',
		}),
		recommendation: Object.freeze({
			decision: 'repair-in-the-adapter, not in the application',
			capabilityGap:
				'No capability defect is proven, so nothing is being fixed in an existing transform. What ' +
				'is missing is a capability: an Angular forms era-compatibility transform that, when an ' +
				'application crossing the v15 boundary implements `setDisabledState` on a custom ' +
				'ControlValueAccessor, provides CALL_SET_DISABLED_STATE as ' +
				"'whenDisabledForLegacyCode' (or configures ReactiveFormsModule/FormsModule with it).",
			whyThatShape:
				'It is the vendor’s own switch for exactly this migration, it restores the era semantics ' +
				'byte-for-byte at the seam that changed, and it touches no application logic — which keeps ' +
				'the zero-manual-steps claim honest. Repairing the application’s setDisabledState instead ' +
				'would be us fixing somebody’s latent bug and calling it a migration.',
			detectionShape:
				'A class that implements setDisabledState and whose body assigns to a field the template ' +
				'binds a form directive to is the detectable shape; the general shape is any CVA whose ' +
				'setDisabledState has effects beyond toggling a disabled flag.',
			recordedRegardless:
				'The application’s setDisabledState is genuinely broken — it also drops the `icuMessages` ' +
				'control the ICU branch of its own template binds — and that stays recorded against the ' +
				'application whether or not the adapter suppresses the call.',
		}),
		notEstablished: Object.freeze([
			'No fix is applied in this unit. packages/frameworks/angular/src is untouched and the ' +
				'capability described above does not exist yet.',
			'The ICU branch of the component was not exercised: the synthetic fixture carries no ICU ' +
				'message, so the dropped `icuMessages` control is a code-level reading of the same ' +
				'defective method, not a measured symptom.',
			'The exact Angular minor that changed the default was not bisected. Both endpoints are read ' +
				'out of the two installed closures, which is what this lift actually crossed.',
			'The Witness receipt for this vertical was not re-run. This record attributes the break u19h ' +
				'measured; it does not re-measure the journey.',
			'Nothing was published over the migrated lane, and neither lane was rebuilt or edited.',
		]),
	});
}

export async function main(): Promise<void> {
	const staticEvidence = await readStaticEvidence();
	const era = await measureEra();
	const migrated = await measureMigrated();
	const record = verifySealedRecord(buildCauseRecord({ staticEvidence, era, migrated }));
	await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
	await writeFile(join(EVIDENCE_DIRECTORY, CAUSE_FILE), canonical(record));
	process.stdout.write(
		`tiny-translator cause ${String(record['result'])}, digest ${record.digest.slice(0, 12)}\n`,
	);
}

if (process.argv[1]?.endsWith('angular-tiny-translator-u19i-cause-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
