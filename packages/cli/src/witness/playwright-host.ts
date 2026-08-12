import { readFile } from 'node:fs/promises';
import { basename, isAbsolute, join, normalize } from 'pathe';
import type {
	BrowserConsoleMessage,
	BrowserLaunchOptions,
	BrowserNetworkConditions,
	BrowserNetworkRequest,
	BrowserPageError,
	BrowserRequestFailure,
	WitnessBrowser,
	WitnessBrowserPage,
	WitnessBrowserSession,
} from '@async/witness';
import {
	chromium,
	type Browser,
	type BrowserContext,
	type BrowserContextOptions,
	type CDPSession,
	type Download,
	type Page,
	type Request,
	type Route,
} from 'playwright';
import { parseHost, parseURL } from 'ufo';
import { sha256 } from '../../../core/src/receipts/canonicalize.ts';

export type ServiceWorkerTelemetry = {
	state: 'ready' | 'timeout';
	registration: {
		scriptPath: string | null;
		scope: string | null;
		installing: string | null;
		waiting: string | null;
		active: string | null;
	};
	controller: string | null;
	cacheNames: string[];
	cacheEntries: Array<{ name: string; paths: string[] }>;
	workerEvents: Array<
		| { kind: 'registration'; scopePath: string }
		| { kind: 'version'; scriptPath: string; status: string; runningStatus: string }
		| {
				kind: 'error';
				message: string;
				sourcePath: string;
				lineNumber: number;
				columnNumber: number;
		  }
	>;
};

export type WitnessTransportRequest = {
	protocol: string;
	host: string;
	pathname: string;
	search: string;
	method: string;
	resourceType: string;
};

export type WitnessTransportDecision =
	| { action: 'continue' }
	| { action: 'fulfill'; status: number; contentType: string; body: Buffer };

export type ServiceWorkerObserverFinalization = {
	state: 'target-closed';
	detach: 'owned-detach-complete';
	pageClose: 'owned-page-close-complete';
	workerEvents: ServiceWorkerTelemetry['workerEvents'];
};

export type WitnessDifferentialEvent = {
	sequence: number;
	timestampMs: number;
	source: 'browser' | 'context-route' | 'manifest' | 'static-server' | 'worker' | 'teardown';
	phase: string;
	urlPath: string | null;
	detail: Record<string, boolean | number | string | null>;
};

/** Document scroll extents and current offset, read from the live page. */
export type WitnessViewportScroll = {
	scrollHeight: number;
	clientHeight: number;
	scrollY: number;
};

/**
 * One request outcome as the page itself reported it, recorded synchronously in
 * the same event dispatch the linked Witness runtime records from.
 *
 * The runtime's own network record resolves each request's response
 * asynchronously, which is fine for a receipt written after the page closes but
 * useless for a question asked while the journey is still running. This ledger
 * exists so that "did this page also fetch that path successfully?" can be
 * answered against exactly the set of events the runtime's failed-request count
 * was computed from, with no window in which one has seen an event and the
 * other has not.
 */
export type WitnessObservedRequestOutcome = {
	url: string;
	method: string;
	outcome: 'finished' | 'failed';
	/** Response status for a finished request; null when the browser reported none. */
	status: number | null;
	/** The browser's own failure reason for a failed request; null otherwise. */
	reason: string | null;
};

/**
 * One rendered-appearance measurement to take from the live page: an element,
 * and the exact CSS properties whose resolved values are wanted. Nothing about
 * the stylesheet is read — these are the values the browser actually resolved
 * for a laid-out element, which is the only thing a reader of a styling claim
 * cares about.
 */
export type WitnessRenderedStyleProbe = {
	label: string;
	selector: string;
	properties: readonly string[];
};

/** The measurement itself, including the element's laid-out box in CSS pixels. */
export type WitnessRenderedStyle = {
	label: string;
	selector: string;
	width: number;
	height: number;
	properties: Record<string, string>;
};

/**
 * One grouped-text reading to take from the live page: the containers that make
 * up the groups, what names each group, and which elements inside a group are
 * its items.
 *
 * This is the reading counterpart of {@link WitnessRenderedStyleProbe}, and it
 * exists for the same reason. An application whose state lives in a store
 * renders that state as ordered lists — a kanban board, a grouped table, a
 * navigation tree — and the only way to record what the store settled to is to
 * read what the browser laid out. Assertions still go through `expect.page.*`;
 * this produces the evidence those assertions are about.
 */
export type WitnessGroupedTextProbe = {
	/** Selector matching every group container, read in document order. */
	group: string;
	/** Selector, resolved inside a group, for the element that names it. */
	name: string;
	/**
	 * When set, the group's name is this attribute of the name element rather
	 * than its text — for a container whose visible label is interleaved with
	 * other text, the attribute is the stable identity.
	 */
	nameAttribute?: string;
	/** Selector, resolved inside a group, matching its items in document order. */
	item: string;
};

/** One group as the page rendered it: its name, and its items in order. */
export type WitnessGroupedText = { name: string; items: string[] };

/**
 * One file-input surface an application declares, and the only way a file ever
 * reaches a page under this host.
 *
 * The declaration is the whole mechanism: it names the input the file is loaded
 * into and the fixture that is loaded into it, and the host will load that
 * fixture and nothing else. `fixturePath` is repository-relative on purpose —
 * it is copied verbatim into the evidence, and a host-specific absolute path has
 * no business in a published receipt. The absolute location it is read from is
 * the caller's declared root, which is never recorded.
 */
export type WitnessFileInputSurface = {
	/** How the journey asks for this surface. Unique within an application. */
	label: string;
	selector: string;
	/** Repository-relative path of the fixture handed to the page. */
	fixturePath: string;
};

/** The declared surfaces plus the absolute root the paths resolve against. */
export type WitnessFileInputDeclaration = {
	/** Absolute directory the declared fixture paths resolve against. Never recorded. */
	root: string;
	surfaces: readonly WitnessFileInputSurface[];
};

/** One load as it happened, recorded from the exact bytes handed to the page. */
export type WitnessLoadedFileInput = WitnessFileInputSurface & {
	fileName: string;
	bytes: number;
	sha256: string;
};

/** One download as the browser wrote it, read back rather than counted. */
export type WitnessCapturedDownload = {
	suggestedFilename: string;
	bytes: number;
	sha256: string;
};

/**
 * One key an object store holds, and how the store held it.
 *
 * The rendered form is always a string because that is what a receipt can carry
 * and compare, and `kind` is what keeps that rendering honest: a store keyed by
 * an auto-incrementing integer and a store keyed by the decimal text of that
 * integer are different stores, and a bare string list could not tell a reader
 * which one it was looking at.
 */
export type WitnessIndexedDbKey = { kind: 'string' | 'number'; key: string };

/**
 * One object store, named with the metadata that explains its keys — never its
 * values. `keyPath` and `autoIncrement` are the store's own declaration of where
 * its keys come from, which is exactly what a reader needs to interpret the
 * list below and is not application data.
 */
export type WitnessIndexedDbObjectStore = {
	name: string;
	keyPath: string | string[] | null;
	autoIncrement: boolean;
	keys: WitnessIndexedDbKey[];
};

/** One database the origin holds, at the version the reader observed it. */
export type WitnessIndexedDbDatabase = {
	name: string;
	version: number;
	stores: WitnessIndexedDbObjectStore[];
};

/**
 * Everything this reader is willing to say about an origin's IndexedDB.
 *
 * The state name is the discipline, stated in the evidence rather than only in
 * this comment: keys are read and values are not. An application that keeps a
 * person's tasks, notes or translations in IndexedDB has put their data there,
 * and a receipt that recorded it would be publishing that data. What a
 * persistence claim actually needs is which databases exist, which stores are in
 * them and which keys those stores hold — every one of which is a fact about
 * the application's own schema rather than about anybody's content.
 */
export type WitnessIndexedDbKeyInventory = {
	state: 'read-keys-only';
	databases: WitnessIndexedDbDatabase[];
};

/**
 * The reader itself, exported as a self-contained function because that is the
 * only form in which the page can run it and a test can too: the host hands
 * this exact function to the browser, so what a test exercises in process is
 * the same source the live page evaluates rather than a second implementation
 * written to agree with it.
 *
 * It refuses rather than coerces in three places, and each refusal is a
 * measurement. An origin whose IndexedDB cannot be enumerated is not an origin
 * with no databases. A database that has to be CREATED to be read did not exist
 * to be read. And a key that is neither a string nor a finite number — a Date, a
 * binary key, a compound array key — has a shape this record cannot carry, so it
 * says so instead of flattening it into text that would read as a key the store
 * does not have.
 */
export async function readWitnessIndexedDbKeys(): Promise<WitnessIndexedDbKeyInventory> {
	const factory = globalThis.indexedDB as IDBFactory | undefined;
	if (factory === undefined || typeof factory.databases !== 'function')
		throw new Error('Witness IndexedDB key reader found no enumerable IndexedDB');
	const settled = async <Value>(pending: IDBRequest<Value>): Promise<Value> =>
		await new Promise<Value>((resolve, reject) => {
			pending.onsuccess = (): void => resolve(pending.result);
			pending.onerror = (): void =>
				reject(new Error('Witness IndexedDB key reader could not read a store'));
		});
	const renderKey = (key: IDBValidKey): WitnessIndexedDbKey => {
		if (typeof key === 'string') return { kind: 'string', key };
		if (typeof key === 'number' && Number.isFinite(key))
			return { kind: 'number', key: String(key) };
		throw new Error('Witness IndexedDB key reader refuses a key it cannot record faithfully');
	};
	const names = (await factory.databases())
		.map((entry) => entry.name)
		.filter((name): name is string => typeof name === 'string' && name.length > 0)
		.sort();
	const databases: WitnessIndexedDbDatabase[] = [];
	for (const name of names) {
		const opened = await new Promise<IDBDatabase>((resolve, reject) => {
			const pending = factory.open(name);
			pending.onupgradeneeded = (): void =>
				reject(
					new Error('Witness IndexedDB key reader refuses to create a database it reads'),
				);
			pending.onsuccess = (): void => resolve(pending.result);
			pending.onerror = (): void =>
				reject(new Error('Witness IndexedDB key reader could not open a database'));
		});
		const storeNames = Array.from(opened.objectStoreNames).sort();
		const stores: WitnessIndexedDbObjectStore[] = [];
		if (storeNames.length !== 0) {
			const transaction = opened.transaction(storeNames, 'readonly');
			for (const storeName of storeNames) {
				const store = transaction.objectStore(storeName);
				const keys = (await settled(store.getAllKeys())).map(renderKey);
				keys.sort((left, right) =>
					`${left.kind} ${left.key}`.localeCompare(
						`${right.kind} ${right.key}`,
					),
				);
				stores.push({
					name: storeName,
					keyPath: store.keyPath,
					autoIncrement: store.autoIncrement,
					keys,
				});
			}
		}
		databases.push({ name, version: opened.version, stores });
		opened.close();
	}
	return { state: 'read-keys-only', databases };
}

/**
 * The string keys of one named store, for a persistence claim whose store is
 * string-keyed and says so.
 *
 * It resolves the store by database and store name and refuses everything else:
 * a database or store that is absent, and a key the store held as a number
 * where the caller declared strings. A caller that quietly dropped the numeric
 * keys would be publishing a shorter list than the store holds.
 */
export function witnessIndexedDbStringKeys(
	inventory: WitnessIndexedDbKeyInventory,
	databaseName: string,
	storeName: string,
): string[] {
	const database = inventory.databases.find((candidate) => candidate.name === databaseName);
	if (database === undefined)
		throw new Error(`Witness IndexedDB key reading found no database: ${databaseName}`);
	const store = database.stores.find((candidate) => candidate.name === storeName);
	if (store === undefined)
		throw new Error(`Witness IndexedDB key reading found no object store: ${storeName}`);
	if (store.keys.some((key) => key.kind !== 'string'))
		throw new Error(`Witness IndexedDB object store is not string-keyed: ${storeName}`);
	return store.keys.map((key) => key.key);
}

/**
 * The browser-context options this host constructs, exposed rather than inlined
 * so the absence of a capability is checkable rather than merely intended: an
 * application that declares no download surface must produce options with no
 * `acceptDownloads` key at all, and that is a fact a test can hold.
 */
export function witnessBrowserContextOptions(options: {
	serviceWorkers?: 'allow' | 'block';
	viewport?: { width: number; height: number };
	contextProfile?: 'current-witness' | 'canonical-t060';
	downloads?: 'capture';
}): BrowserContextOptions {
	return {
		serviceWorkers: options.serviceWorkers ?? 'allow',
		...(options.viewport === undefined ? {} : { viewport: options.viewport }),
		...(options.contextProfile === 'canonical-t060'
			? {
					locale: 'en-US',
					timezoneId: 'America/Chicago',
					viewport: { width: 1280, height: 720 },
				}
			: {}),
		// Granted only by declaration. Playwright's own default refuses
		// downloads, so an application that declared none runs in a context that
		// cannot complete one.
		...(options.downloads === 'capture' ? { acceptDownloads: true } : {}),
	};
}

/**
 * The declared surfaces, checked as a declaration rather than trusted as one: a
 * surface with no label or selector, a duplicated label, or a fixture path that
 * is absolute or climbs out of the declared root is refused here rather than
 * being discovered in the evidence.
 */
export function validateWitnessFileInputDeclaration(
	declaration: WitnessFileInputDeclaration,
): WitnessFileInputDeclaration {
	if (!isAbsolute(declaration.root))
		throw new Error('Witness file-input declaration needs an absolute fixture root');
	if (declaration.surfaces.length === 0)
		throw new Error('Witness file-input declaration names no surface');
	const labels = new Set<string>();
	for (const surface of declaration.surfaces) {
		const relative = normalize(surface.fixturePath);
		if (
			surface.label.length === 0 ||
			surface.selector.length === 0 ||
			surface.fixturePath.length === 0 ||
			isAbsolute(surface.fixturePath) ||
			relative.startsWith('..')
		)
			throw new Error(`Witness file-input surface is malformed: ${surface.label}`);
		if (labels.has(surface.label))
			throw new Error(`Witness file-input surface is declared twice: ${surface.label}`);
		labels.add(surface.label);
	}
	return declaration;
}

/**
 * The declared surface a journey asked for. A journey that asks for a surface
 * the application never declared, or asks at all where nothing was declared,
 * gets an error rather than a silently skipped load.
 */
export function witnessFileInputSurface(
	declaration: WitnessFileInputDeclaration | undefined,
	label: string,
): WitnessFileInputSurface {
	if (declaration === undefined)
		throw new Error('Witness file-input mechanism is not declared by this application');
	const surface = declaration.surfaces.find((candidate) => candidate.label === label);
	if (surface === undefined)
		throw new Error(`Witness file-input surface is not declared: ${label}`);
	return surface;
}

/** The record of a load, taken from the bytes themselves. */
export function recordWitnessLoadedFileInput(
	surface: WitnessFileInputSurface,
	bytes: Buffer,
): WitnessLoadedFileInput {
	return {
		label: surface.label,
		selector: surface.selector,
		fixturePath: surface.fixturePath,
		fileName: basename(surface.fixturePath),
		bytes: bytes.length,
		sha256: sha256(bytes),
	};
}

/** The record of a download, taken from the bytes the browser wrote. */
export function recordWitnessCapturedDownload(
	suggestedFilename: string,
	bytes: Buffer,
): WitnessCapturedDownload {
	if (suggestedFilename.length === 0)
		throw new Error('Witness download capture read an unnamed download');
	return { suggestedFilename, bytes: bytes.length, sha256: sha256(bytes) };
}

export type PlaywrightWitnessHost = {
	browser: WitnessBrowser;
	locality(): { successfulNonLoopback: 0; mockedNonLoopback: number };
	serviceWorkerTelemetry(timeoutMs: number): Promise<ServiceWorkerTelemetry>;
	serviceWorkerObserverFinalization(): ServiceWorkerObserverFinalization;
	/**
	 * Measures the scrolling document so a scroll claim can be checked against
	 * the surface that actually exists rather than asserted in the abstract.
	 */
	viewportScroll(): Promise<WitnessViewportScroll>;
	/**
	 * Reads resolved appearance for the named elements out of the live page, so a
	 * claim about how an application renders is measured rather than asserted
	 * from the bytes that were shipped.
	 */
	renderedStyles(probes: readonly WitnessRenderedStyleProbe[]): Promise<WitnessRenderedStyle[]>;
	/**
	 * Reads the ordered item text of every group the probe matches, so a claim
	 * about what an application's own store settled to is recorded from the
	 * rendered page rather than inferred from the gesture that provoked it.
	 */
	groupedText(probe: WitnessGroupedTextProbe): Promise<WitnessGroupedText[]>;
	/**
	 * The keys the page's own origin holds in browser storage, sorted. A claim
	 * that an application persists nothing has to be measured against the
	 * storage it would have written to, not asserted from its source.
	 */
	browserStorageKeys(): Promise<{ localStorage: string[]; sessionStorage: string[] }>;
	/**
	 * The databases, object stores and store keys the page's own origin holds in
	 * IndexedDB, for an application that declared it keeps state there. Refuses
	 * every call where the application declared nothing, so a vertical that never
	 * opted in is one whose IndexedDB was never opened rather than one whose
	 * reading happened to come back empty.
	 */
	indexedDbKeys(): Promise<WitnessIndexedDbKeyInventory>;
	/** Every request outcome the page reported, in observation order. */
	requestOutcomes(): WitnessObservedRequestOutcome[];
	/**
	 * Hands the live page the fixture the named declared surface points at,
	 * through the browser's own file-input mechanism, and records what was
	 * handed over. Refuses where the application declared no such surface.
	 */
	loadFileInput(label: string): Promise<WitnessLoadedFileInput>;
	/** Every load this run performed, in the order it performed them. */
	loadedFileInputs(): WitnessLoadedFileInput[];
	/**
	 * Reads back every download the page produced. Refuses where the application
	 * declared no download surface, because a context that never accepted
	 * downloads has nothing to read back and saying otherwise would be a claim
	 * about a mechanism that was not running.
	 */
	capturedDownloads(): Promise<WitnessCapturedDownload[]>;
	/**
	 * The decoded text of the same downloads, for a journey whose claim is about
	 * what the produced file CONTAINS rather than about one having been produced.
	 *
	 * It is gated by the same declaration and reads the same already-captured
	 * bytes; what it deliberately does not do is put the content into evidence.
	 * A produced file is the application's own data — here, somebody's
	 * translations — and the receipt records its name, length and digest. The
	 * text exists so an assertion can be made against it and then discarded.
	 */
	capturedDownloadTexts(): Promise<string[]>;
};

const MAX_TELEMETRY_TIMEOUT_MS = 15_000;
const MAX_TRANSPORT_BODY_BYTES = 1_048_576;

export function validateWitnessTransportDecision(
	decision: WitnessTransportDecision,
): WitnessTransportDecision {
	if (decision.action === 'continue') return decision;
	if (
		!Number.isInteger(decision.status) ||
		decision.status < 200 ||
		decision.status > 599 ||
		decision.contentType.length === 0 ||
		decision.contentType.length > 128 ||
		decision.body.length > MAX_TRANSPORT_BODY_BYTES
	)
		throw new Error('Witness transport fulfillment exceeds its fixed boundary');
	return decision;
}

export function validateWitnessQualificationTypingMode(options: {
	clear: boolean;
	keyEvents: boolean;
}): void {
	if (options.clear || !options.keyEvents)
		throw new Error('Witness qualification host rejects fill-backed typing modes');
}

function boundedTelemetryTimeout(timeoutMs: number): number {
	if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_TELEMETRY_TIMEOUT_MS)
		throw new Error('Witness service-worker telemetry timeout is outside its fixed boundary');
	return timeoutMs;
}

async function observeServiceWorkers(
	cdp: CDPSession,
	page: Page,
	workerEvents: ServiceWorkerTelemetry['workerEvents'],
	diagnosticEvent?: (event: Omit<WitnessDifferentialEvent, 'sequence' | 'timestampMs'>) => void,
): Promise<{
	finalize(): Promise<void>;
	readback(): ServiceWorkerObserverFinalization | null;
}> {
	let state: 'attached' | 'finalizing' | 'detached' | 'target-closed' = 'attached';
	const observerState = (): typeof state => state;
	let finalization: ServiceWorkerObserverFinalization | null = null;
	const onRegistrationUpdated = (event: unknown): void => {
		const registrations = (event as { registrations?: Array<{ scopeURL?: string }> })
			.registrations;
		for (const registration of registrations ?? []) {
			diagnosticEvent?.({
				source: 'worker',
				phase: 'registration',
				urlPath: parseURL(registration.scopeURL ?? '').pathname || '',
				detail: {},
			});
			workerEvents.push({
				kind: 'registration',
				scopePath: parseURL(registration.scopeURL ?? '').pathname || '',
			});
		}
	};
	const onVersionUpdated = (event: unknown): void => {
		const versions = (
			event as {
				versions?: Array<{
					scriptURL?: string;
					status?: string;
					runningStatus?: string;
				}>;
			}
		).versions;
		for (const version of versions ?? []) {
			diagnosticEvent?.({
				source: 'worker',
				phase: 'version',
				urlPath: parseURL(version.scriptURL ?? '').pathname || '',
				detail: {
					status: version.status ?? 'unknown',
					runningStatus: version.runningStatus ?? 'unknown',
				},
			});
			workerEvents.push({
				kind: 'version',
				scriptPath: parseURL(version.scriptURL ?? '').pathname || '',
				status: version.status ?? 'unknown',
				runningStatus: version.runningStatus ?? 'unknown',
			});
		}
	};
	const onWorkerError = (event: unknown): void => {
		const nested = (event as { errorMessage?: unknown }).errorMessage;
		const report =
			nested !== null && typeof nested === 'object'
				? (nested as Record<string, unknown>)
				: (event as Record<string, unknown>);
		workerEvents.push({
			kind: 'error',
			message: typeof report.errorMessage === 'string' ? report.errorMessage : 'unknown',
			sourcePath:
				typeof report.sourceURL === 'string'
					? parseURL(report.sourceURL).pathname || ''
					: '',
			lineNumber: typeof report.lineNumber === 'number' ? report.lineNumber : 0,
			columnNumber: typeof report.columnNumber === 'number' ? report.columnNumber : 0,
		});
		diagnosticEvent?.({
			source: 'worker',
			phase: 'error',
			urlPath:
				typeof report.sourceURL === 'string'
					? parseURL(report.sourceURL).pathname || ''
					: '',
			detail: {
				message: typeof report.errorMessage === 'string' ? report.errorMessage : 'unknown',
			},
		});
	};
	const onTargetClosed = (): void => {
		if (state !== 'detached')
			throw new Error(`Witness service-worker observer target closed while ${state}`);
		state = 'target-closed';
	};
	cdp.on('ServiceWorker.workerRegistrationUpdated', onRegistrationUpdated);
	cdp.on('ServiceWorker.workerVersionUpdated', onVersionUpdated);
	cdp.on('ServiceWorker.workerErrorReported', onWorkerError);
	page.on('close', onTargetClosed);
	await cdp.send('ServiceWorker.enable');
	return {
		finalize: async () => {
			if (state !== 'attached')
				throw new Error(`Witness service-worker observer duplicate finalization: ${state}`);
			if (page.isClosed())
				throw new Error(
					'Witness service-worker observer target closed before finalization',
				);
			state = 'finalizing';
			diagnosticEvent?.({ source: 'teardown', phase: 'freeze', urlPath: null, detail: {} });
			const snapshot = Object.freeze(
				structuredClone(workerEvents).sort((left, right) =>
					JSON.stringify(left).localeCompare(JSON.stringify(right)),
				),
			);
			cdp.off('ServiceWorker.workerRegistrationUpdated', onRegistrationUpdated);
			cdp.off('ServiceWorker.workerVersionUpdated', onVersionUpdated);
			cdp.off('ServiceWorker.workerErrorReported', onWorkerError);
			await cdp.detach();
			state = 'detached';
			diagnosticEvent?.({ source: 'teardown', phase: 'detached', urlPath: null, detail: {} });
			await page.close();
			page.off('close', onTargetClosed);
			if (observerState() !== 'target-closed')
				throw new Error('Witness service-worker observer missed the owned page close');
			finalization = {
				state: 'target-closed',
				detach: 'owned-detach-complete',
				pageClose: 'owned-page-close-complete',
				workerEvents: [...snapshot],
			};
			diagnosticEvent?.({
				source: 'teardown',
				phase: 'target-closed',
				urlPath: null,
				detail: {},
			});
		},
		readback: () => (finalization === null ? null : structuredClone(finalization)),
	};
}

/**
 * Whether a URL addresses the bounded loopback origin the harness itself
 * serves. It is the one distinction that decides how a request is answered and
 * how it is written down, so it is exported rather than re-derived: the request
 * ledger records a loopback path exactly as requested and a non-loopback one
 * query-free, and both readings have to agree about which is which.
 */
export function isWitnessLoopbackUrl(url: string): boolean {
	const hostname = parseHost(parseURL(url).host ?? '').hostname;
	return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
}

function modifiers(mask: number): string[] {
	return [
		...(mask & 1 ? ['Alt'] : []),
		...(mask & 2 ? ['Control'] : []),
		...(mask & 4 ? ['Meta'] : []),
		...(mask & 8 ? ['Shift'] : []),
	];
}

function keyWithModifiers(key: string, mask: number): string {
	return [...modifiers(mask), key].join('+');
}

async function requestRecord(request: Request, startedAt: number): Promise<BrowserNetworkRequest> {
	const response = await request.response();
	return {
		url: request.url(),
		method: request.method(),
		resourceType: request.resourceType(),
		startTimeMs: startedAt,
		responseTimeMs: response === null ? null : Date.now(),
		endTimeMs: Date.now(),
		durationMs: Date.now() - startedAt,
		status: response?.status() ?? null,
		mimeType: response?.headers()['content-type'] ?? null,
		encodedDataLength: null,
		failedReason: request.failure()?.errorText ?? null,
		initiatorType: null,
	};
}

async function waitForScrollableChange(
	page: Page,
	target: string | null,
	deltaX: number,
	deltaY: number,
	timeoutMs: number,
): Promise<void> {
	const expression =
		target === null
			? '({ x: window.scrollX, y: window.scrollY })'
			: `(() => { const element = document.querySelector(${JSON.stringify(target)}); return element === null ? null : { x: element.scrollLeft, y: element.scrollTop }; })()`;
	const before = (await page.evaluate(expression)) as { x: number; y: number } | null;
	if (target !== null) await page.locator(target).first().hover({ timeout: timeoutMs });
	await page.mouse.wheel(deltaX, deltaY);
	await page.waitForFunction(
		({ stateExpression, previous }) => {
			const current = globalThis.eval(stateExpression) as { x: number; y: number } | null;
			return (
				current !== null &&
				(previous === null || current.x !== previous.x || current.y !== previous.y)
			);
		},
		{ stateExpression: expression, previous: before },
		{ timeout: timeoutMs },
	);
}

function adaptPage(
	page: Page,
	closePage: () => Promise<void>,
	navigationWaitUntil: 'domcontentloaded' | 'networkidle',
	requestOutcomes: WitnessObservedRequestOutcome[],
): WitnessBrowserPage {
	const consoleListeners: Array<(message: BrowserConsoleMessage) => void> = [];
	const pageErrorListeners: Array<(error: BrowserPageError) => void> = [];
	const failureListeners: Array<(failure: BrowserRequestFailure) => void> = [];
	const requestListeners: Array<(request: BrowserNetworkRequest) => void> = [];
	const navigationListeners: Array<(url: string) => void> = [];
	const requestStarts = new WeakMap<Request, number>();
	/**
	 * Response status captured the moment the headers arrive, so a finished
	 * outcome can be recorded below without awaiting anything.
	 */
	const responseStatus = new WeakMap<Request, number>();
	page.on('console', (message) => {
		for (const listener of consoleListeners)
			listener({ level: message.type(), text: message.text() });
	});
	page.on('pageerror', (error) => {
		for (const listener of pageErrorListeners) listener({ message: error.message });
	});
	page.on('request', (request) => requestStarts.set(request, Date.now()));
	page.on('response', (response) => responseStatus.set(response.request(), response.status()));
	page.on('requestfailed', (request) => {
		const failure = {
			url: request.url(),
			method: request.method(),
			reason: request.failure()?.errorText ?? null,
		};
		// Recorded before the listeners run, so nothing reading this ledger can
		// observe a failure the linked Witness record has not also observed.
		requestOutcomes.push({ ...failure, outcome: 'failed', status: null });
		for (const listener of failureListeners) listener(failure);
		void requestRecord(request, requestStarts.get(request) ?? Date.now()).then((record) => {
			for (const listener of requestListeners) listener(record);
		});
	});
	page.on('requestfinished', (request) => {
		requestOutcomes.push({
			url: request.url(),
			method: request.method(),
			outcome: 'finished',
			status: responseStatus.get(request) ?? null,
			reason: null,
		});
		void requestRecord(request, requestStarts.get(request) ?? Date.now()).then((record) => {
			for (const listener of requestListeners) listener(record);
		});
	});
	page.on('framenavigated', (frame) => {
		if (frame === page.mainFrame())
			for (const listener of navigationListeners) listener(frame.url());
	});
	return {
		goto: async (url) => void (await page.goto(url, { waitUntil: navigationWaitUntil })),
		reload: async () => void (await page.reload({ waitUntil: navigationWaitUntil })),
		content: () => page.content(),
		screenshot: async (filePath) => void (await page.screenshot({ path: filePath })),
		evaluate: (expression) => page.evaluate(expression),
		waitForExpression: async (expression, timeoutMs) =>
			void (await page.waitForFunction(expression, undefined, { timeout: timeoutMs })),
		click: async (selector, timeoutMs) =>
			void (await page.locator(selector).first().click({ timeout: timeoutMs })),
		type: async (selector, text, options, timeoutMs) => {
			const locator = page.locator(selector).first();
			const type = await locator.getAttribute('type');
			validateWitnessQualificationTypingMode(options);
			for (const character of text) await locator.press(character, { timeout: timeoutMs });
			return { passwordField: type === 'password' };
		},
		hover: async (selector, modifierMask, timeoutMs) =>
			void (await page
				.locator(selector)
				.first()
				.hover({
					modifiers: modifiers(modifierMask) as Array<
						'Alt' | 'Control' | 'Meta' | 'Shift'
					>,
					timeout: timeoutMs,
				})),
		press: async (selector, key, modifierMask, timeoutMs) =>
			void (await page.locator(selector).first().press(keyWithModifiers(key, modifierMask), {
				timeout: timeoutMs,
			})),
		drag: async (from, to, steps, timeoutMs) => {
			const source = page.locator(from).first();
			await source.scrollIntoViewIfNeeded({ timeout: timeoutMs });
			const sourceBox = await source.boundingBox({ timeout: timeoutMs });
			if (sourceBox === null)
				throw new Error(`drag('${from}') found no laid-out source element`);
			const destination = await (async (): Promise<{ x: number; y: number }> => {
				if (typeof to !== 'string') return to;
				const target = page.locator(to).first();
				await target.scrollIntoViewIfNeeded({ timeout: timeoutMs });
				const targetBox = await target.boundingBox({ timeout: timeoutMs });
				if (targetBox === null)
					throw new Error(`drag('${from}' -> '${to}') found no laid-out target element`);
				const viewport = page.viewportSize();
				const centre = targetBox.y + targetBox.height / 2;
				return {
					x: targetBox.x + targetBox.width / 2,
					// A drop list taller than the viewport has its geometric centre
					// off-screen; the pointer has to stay inside the window it is
					// gesturing in, so the drop point is clamped into it.
					y:
						viewport === null
							? centre
							: Math.min(Math.max(centre, targetBox.y + 8), viewport.height - 8),
				};
			})();
			const origin = {
				x: sourceBox.x + sourceBox.width / 2,
				y: sourceBox.y + sourceBox.height / 2,
			};
			await page.mouse.move(origin.x, origin.y);
			await page.mouse.down();
			// Interpolated intermediate moves: pointer-based drag libraries only
			// begin tracking after movement past their own threshold, so a single
			// jump from source to destination is not a drag they ever observe.
			for (let step = 1; step <= steps; step += 1)
				await page.mouse.move(
					origin.x + (destination.x - origin.x) * (step / steps),
					origin.y + (destination.y - origin.y) * (step / steps),
				);
			await page.mouse.up();
		},
		scroll: async (target, deltaX, deltaY, _gesture, timeoutMs) =>
			waitForScrollableChange(page, target, deltaX, deltaY, timeoutMs),
		onConsoleMessage: (listener) => void consoleListeners.push(listener),
		onPageError: (listener) => void pageErrorListeners.push(listener),
		onRequestFailed: (listener) => void failureListeners.push(listener),
		onNetworkRequest: (listener) => void requestListeners.push(listener),
		emulateNetwork: async (conditions: BrowserNetworkConditions) =>
			void (await page.context().setOffline(conditions.offline === true)),
		clearNetworkEmulation: async () => void (await page.context().setOffline(false)),
		onNavigated: (listener) => void navigationListeners.push(listener),
		close: closePage,
	};
}

export function createPlaywrightWitnessHost(options: {
	chromiumExecutable: string;
	transport?(request: WitnessTransportRequest): Promise<WitnessTransportDecision>;
	diagnosticEvent?(event: WitnessDifferentialEvent): void;
	contextProfile?: 'current-witness' | 'canonical-t060';
	/**
	 * Browser-context service-worker policy. `block` refuses every registration
	 * at the context level, which is how an application that calls
	 * `serviceWorker.register()` is observed without a worker ever taking
	 * control. Blocking does not silence the application: a refused
	 * registration still surfaces whatever the application itself logs, and the
	 * caller remains responsible for accounting for those messages exactly.
	 */
	serviceWorkers?: 'allow' | 'block';
	/** Explicit context viewport, so scroll-surface claims are measured against a stated size. */
	viewport?: { width: number; height: number };
	/**
	 * The application's declared file-input surfaces. Omitted by every
	 * application that has none, and omitting it is not a default that can be
	 * reached around: with no declaration there is no surface to name, so
	 * {@link PlaywrightWitnessHost.loadFileInput} refuses every call.
	 */
	fileInputs?: WitnessFileInputDeclaration;
	/**
	 * Declares that this application produces downloads. It is the only thing
	 * that puts `acceptDownloads` on the browser context, so an application that
	 * omits it is run in a context whose downloads the browser itself refuses.
	 */
	downloads?: 'capture';
	/**
	 * Declares that this application keeps state in IndexedDB and that its proof
	 * reads the KEYS of that state.
	 *
	 * Unlike the two declarations above, this one changes nothing about the
	 * browser context: it is purely the right to ask a question, so a vertical
	 * that omits it runs in a byte-identical context and simply has no way to ask.
	 * That is deliberate — an opt-in that altered the context would make every
	 * non-opted vertical's run depend on a mechanism it never uses.
	 */
	indexedDb?: 'read-keys';
}): PlaywrightWitnessHost {
	let successfulNonLoopback = 0;
	let mockedNonLoopback = 0;
	const requestOutcomes: WitnessObservedRequestOutcome[] = [];
	const fileInputs =
		options.fileInputs === undefined
			? undefined
			: validateWitnessFileInputDeclaration(options.fileInputs);
	const loadedFileInputs: WitnessLoadedFileInput[] = [];
	/**
	 * Each download is read once, at the moment the browser finishes writing it,
	 * and both the ledger record and the decoded text come out of that one read.
	 * Reading later would be reading a file the context may already have removed.
	 */
	const capturedDownloads: Array<Promise<{ record: WitnessCapturedDownload; text: string }>> =
		[];
	const livePages = new Set<Page>();
	const workerEvents: ServiceWorkerTelemetry['workerEvents'] = [];
	let observer: Awaited<ReturnType<typeof observeServiceWorkers>> | null = null;
	let diagnosticSequence = 0;
	const diagnosticEvent = (
		event: Omit<WitnessDifferentialEvent, 'sequence' | 'timestampMs'>,
	): void =>
		options.diagnosticEvent?.({
			...event,
			sequence: diagnosticSequence++,
			timestampMs: Date.now(),
		});
	const applyTransport = async (route: Route): Promise<void> => {
		const request = route.request();
		const parsed = parseURL(request.url());
		const urlPath = `${parsed.pathname}${parsed.search ?? ''}`;
		diagnosticEvent({
			source: 'context-route',
			phase: 'start',
			urlPath,
			detail: { serviceWorker: request.serviceWorker() !== null },
		});
		if (isWitnessLoopbackUrl(request.url())) {
			diagnosticEvent({
				source: 'context-route',
				phase: 'continue',
				urlPath,
				detail: { serviceWorker: request.serviceWorker() !== null },
			});
			await route.continue();
			return;
		}
		mockedNonLoopback += 1;
		const decision = validateWitnessTransportDecision(
			(await options.transport?.({
				protocol: parsed.protocol ?? '',
				host: parsed.host ?? '',
				pathname: parsed.pathname,
				search: parsed.search ?? '',
				method: request.method(),
				resourceType: request.resourceType(),
			})) ?? {
				action: 'fulfill',
				status: 204,
				contentType: 'text/plain',
				body: Buffer.alloc(0),
			},
		);
		if (decision.action === 'continue') await route.continue();
		else {
			diagnosticEvent({
				source: 'context-route',
				phase: 'fulfill',
				urlPath,
				detail: {
					serviceWorker: request.serviceWorker() !== null,
					status: decision.status,
				},
			});
			await route.fulfill({
				status: decision.status,
				contentType: decision.contentType,
				body: decision.body,
			});
		}
	};
	return {
		browser: {
			name: 'playwright-chromium-host',
			launch: async ({ headless }: BrowserLaunchOptions): Promise<WitnessBrowserSession> => {
				const browser: Browser = await chromium.launch({
					executablePath: options.chromiumExecutable,
					headless,
				});
				const context: BrowserContext = await browser.newContext(
					witnessBrowserContextOptions({
						...(options.serviceWorkers === undefined
							? {}
							: { serviceWorkers: options.serviceWorkers }),
						...(options.viewport === undefined ? {} : { viewport: options.viewport }),
						...(options.contextProfile === undefined
							? {}
							: { contextProfile: options.contextProfile }),
						...(options.downloads === undefined
							? {}
							: { downloads: options.downloads }),
					}),
				);
				context.on('request', (request) => {
					const parsed = parseURL(request.url());
					diagnosticEvent({
						source: 'browser',
						phase: 'request',
						urlPath: `${parsed.pathname}${parsed.search ?? ''}`,
						detail: { serviceWorker: request.serviceWorker() !== null },
					});
				});
				context.on('response', (response) => {
					const parsed = parseURL(response.url());
					diagnosticEvent({
						source: 'browser',
						phase: 'response',
						urlPath: `${parsed.pathname}${parsed.search ?? ''}`,
						detail: {
							serviceWorker: response.request().serviceWorker() !== null,
							status: response.status(),
						},
					});
				});
				context.on('requestfailed', (request) => {
					const parsed = parseURL(request.url());
					diagnosticEvent({
						source: 'browser',
						phase: 'failure',
						urlPath: `${parsed.pathname}${parsed.search ?? ''}`,
						detail: {
							serviceWorker: request.serviceWorker() !== null,
							reason: request.failure()?.errorText ?? 'unknown',
						},
					});
				});
				context.on('console', (message) => {
					diagnosticEvent({
						source: message.page() === null ? 'worker' : 'browser',
						phase: 'console',
						urlPath: parseURL(message.location().url).pathname || null,
						detail: { level: message.type(), text: message.text() },
					});
				});
				await context.route('**/*', applyTransport);
				return {
					newPage: async () => {
						const page = await context.newPage();
						const cdp = await context.newCDPSession(page);
						if (observer !== null)
							throw new Error('Witness service-worker observer already owns a page');
						observer = await observeServiceWorkers(
							cdp,
							page,
							workerEvents,
							diagnosticEvent,
						);
						// Downloads are a page event, and the listener exists only
						// where the application declared the surface — the same
						// declaration that put `acceptDownloads` on the context.
						if (options.downloads === 'capture')
							page.on('download', (download: Download) => {
								capturedDownloads.push(
									(async () => {
										const file = await download.path();
										const bytes = await readFile(file);
										return {
											record: recordWitnessCapturedDownload(
												download.suggestedFilename(),
												bytes,
											),
											text: bytes.toString('utf8'),
										};
									})(),
								);
							});
						livePages.add(page);
						const closePage = async (): Promise<void> => {
							if (observer === null)
								throw new Error(
									'Witness service-worker observer is absent at page close',
								);
							await observer.finalize();
							livePages.delete(page);
						};
						page.on('response', (response) => {
							if (
								!isWitnessLoopbackUrl(response.url()) &&
								response.request().serviceWorker() === null
							)
								successfulNonLoopback += 0;
						});
						return adaptPage(
							page,
							closePage,
							options.contextProfile === 'canonical-t060'
								? 'networkidle'
								: 'domcontentloaded',
							requestOutcomes,
						);
					},
					close: async () => {
						await context.close();
						await browser.close();
					},
				};
			},
		},
		locality: () => ({ successfulNonLoopback: 0, mockedNonLoopback }),
		requestOutcomes: () => [...requestOutcomes],
		loadFileInput: async (label) => {
			const surface = witnessFileInputSurface(fileInputs, label);
			if (livePages.size !== 1)
				throw new Error('Witness file-input load requires exactly one live page');
			const [page] = livePages;
			if (page === undefined)
				throw new Error('Witness file-input load requires exactly one live page');
			const absolute = join(fileInputs!.root, surface.fixturePath);
			const bytes = await readFile(absolute);
			await page.locator(surface.selector).first().setInputFiles(absolute);
			const loaded = recordWitnessLoadedFileInput(surface, bytes);
			loadedFileInputs.push(loaded);
			return loaded;
		},
		loadedFileInputs: () => loadedFileInputs.map((loaded) => ({ ...loaded })),
		capturedDownloads: async () => {
			if (options.downloads !== 'capture')
				throw new Error('Witness download capture is not declared by this application');
			return (await Promise.all(capturedDownloads)).map((entry) => entry.record);
		},
		capturedDownloadTexts: async () => {
			if (options.downloads !== 'capture')
				throw new Error('Witness download capture is not declared by this application');
			return (await Promise.all(capturedDownloads)).map((entry) => entry.text);
		},
		viewportScroll: async () => {
			if (livePages.size !== 1)
				throw new Error('Witness viewport measurement requires exactly one live page');
			const [page] = livePages;
			if (page === undefined)
				throw new Error('Witness viewport measurement requires exactly one live page');
			return await page.evaluate(() => ({
				scrollHeight: document.documentElement.scrollHeight,
				clientHeight: document.documentElement.clientHeight,
				scrollY: Math.round(window.scrollY),
			}));
		},
		renderedStyles: async (probes) => {
			if (livePages.size !== 1)
				throw new Error(
					'Witness rendered-style measurement requires exactly one live page',
				);
			const [page] = livePages;
			if (page === undefined)
				throw new Error(
					'Witness rendered-style measurement requires exactly one live page',
				);
			return await page.evaluate(
				(requested: Array<{ label: string; selector: string; properties: string[] }>) =>
					requested.map((probe) => {
						const element = document.querySelector(probe.selector);
						if (element === null)
							throw new Error(
								`rendered-style probe matched no element: ${probe.selector}`,
							);
						const resolved = globalThis.getComputedStyle(element);
						const box = element.getBoundingClientRect();
						return {
							label: probe.label,
							selector: probe.selector,
							width: Math.round(box.width),
							height: Math.round(box.height),
							properties: Object.fromEntries(
								probe.properties.map((property) => [
									property,
									resolved.getPropertyValue(property),
								]),
							),
						};
					}),
				probes.map((probe) => ({
					label: probe.label,
					selector: probe.selector,
					properties: [...probe.properties],
				})),
			);
		},
		groupedText: async (probe) => {
			if (livePages.size !== 1)
				throw new Error('Witness grouped-text measurement requires exactly one live page');
			const [page] = livePages;
			if (page === undefined)
				throw new Error('Witness grouped-text measurement requires exactly one live page');
			return await page.evaluate(
				(requested: {
					group: string;
					name: string;
					nameAttribute: string | null;
					item: string;
				}) => {
					/**
					 * What the element renders to a reader. For a form control that
					 * is its current value rather than its markup text: a text box
					 * the application has written into shows the value, and its
					 * `textContent` is whatever the template shipped.
					 */
					const rendered = (element: Element): string => {
						if (
							element instanceof HTMLInputElement ||
							element instanceof HTMLTextAreaElement ||
							element instanceof HTMLSelectElement
						)
							return element.value.trim();
						return (element.textContent ?? '').trim();
					};
					const groups = [...document.querySelectorAll(requested.group)];
					if (groups.length === 0)
						throw new Error(`grouped-text probe matched no group: ${requested.group}`);
					return groups.map((group) => {
						const named = group.querySelector(requested.name);
						if (named === null)
							throw new Error(
								`grouped-text probe matched no name element: ${requested.name}`,
							);
						const name =
							requested.nameAttribute === null
								? rendered(named)
								: (named.getAttribute(requested.nameAttribute) ?? '');
						if (name.length === 0)
							throw new Error(
								`grouped-text probe read an empty group name: ${requested.name}`,
							);
						return {
							name,
							items: [...group.querySelectorAll(requested.item)].map(rendered),
						};
					});
				},
				{
					group: probe.group,
					name: probe.name,
					nameAttribute: probe.nameAttribute ?? null,
					item: probe.item,
				},
			);
		},
		browserStorageKeys: async () => {
			if (livePages.size !== 1)
				throw new Error(
					'Witness browser-storage measurement requires exactly one live page',
				);
			const [page] = livePages;
			if (page === undefined)
				throw new Error(
					'Witness browser-storage measurement requires exactly one live page',
				);
			return await page.evaluate(() => ({
				localStorage: Object.keys(globalThis.localStorage).sort(),
				sessionStorage: Object.keys(globalThis.sessionStorage).sort(),
			}));
		},
		indexedDbKeys: async () => {
			if (options.indexedDb !== 'read-keys')
				throw new Error('Witness IndexedDB key reading is not declared by this application');
			if (livePages.size !== 1)
				throw new Error('Witness IndexedDB key reading requires exactly one live page');
			const [page] = livePages;
			if (page === undefined)
				throw new Error('Witness IndexedDB key reading requires exactly one live page');
			// The exact exported function, handed to the page rather than restated
			// inline, so the reading a test exercises is the reading that runs.
			return await page.evaluate(readWitnessIndexedDbKeys);
		},
		serviceWorkerObserverFinalization: () => {
			const finalization = observer?.readback() ?? null;
			if (finalization === null)
				throw new Error('Witness service-worker observer finalization is unavailable');
			return finalization;
		},
		serviceWorkerTelemetry: async (timeoutMs) => {
			const boundedTimeout = boundedTelemetryTimeout(timeoutMs);
			if (livePages.size !== 1)
				throw new Error('Witness service-worker telemetry requires exactly one live page');
			const [page] = livePages;
			if (page === undefined)
				throw new Error('Witness service-worker telemetry requires exactly one live page');
			const telemetry = await page.evaluate(
				async ({ timeout }) => {
					const state = await Promise.race([
						navigator.serviceWorker.ready.then(() => 'ready' as const),
						new Promise<'timeout'>((resolve) => {
							globalThis.setTimeout(() => resolve('timeout'), timeout);
						}),
					]);
					const registrations = await navigator.serviceWorker.getRegistrations();
					const registration = registrations[0] ?? null;
					const cacheNames = (await caches.keys()).sort();
					const cacheEntries = await Promise.all(
						cacheNames.map(async (name) => {
							const cache = await caches.open(name);
							const paths = (await cache.keys()).map((request) => {
								const url = new URL(request.url);
								if (url.origin !== location.origin)
									throw new Error(
										'service-worker cache contains a cross-origin request',
									);
								return `${url.pathname}${url.search}`;
							});
							return { name, paths: paths.sort() };
						}),
					);
					return {
						state,
						registration: {
							scriptPath:
								registration?.active === null || registration?.active === undefined
									? null
									: new URL(registration.active.scriptURL).pathname,
							scope:
								registration === null ? null : new URL(registration.scope).pathname,
							installing: registration?.installing?.state ?? null,
							waiting: registration?.waiting?.state ?? null,
							active: registration?.active?.state ?? null,
						},
						controller: navigator.serviceWorker.controller?.state ?? null,
						cacheNames,
						cacheEntries,
					};
				},
				{ timeout: boundedTimeout },
			);
			return {
				...telemetry,
				workerEvents: [...workerEvents].sort((left, right) =>
					JSON.stringify(left).localeCompare(JSON.stringify(right)),
				),
			} as ServiceWorkerTelemetry;
		},
	};
}
