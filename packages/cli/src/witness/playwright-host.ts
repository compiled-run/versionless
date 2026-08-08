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
	type CDPSession,
	type Page,
	type Request,
	type Route,
} from 'playwright';
import { parseHost, parseURL } from 'ufo';

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

export type PlaywrightWitnessHost = {
	browser: WitnessBrowser;
	locality(): { successfulNonLoopback: 0; mockedNonLoopback: number };
	serviceWorkerTelemetry(timeoutMs: number): Promise<ServiceWorkerTelemetry>;
	serviceWorkerObserverFinalization(): ServiceWorkerObserverFinalization;
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

function loopback(url: string): boolean {
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
): WitnessBrowserPage {
	const consoleListeners: Array<(message: BrowserConsoleMessage) => void> = [];
	const pageErrorListeners: Array<(error: BrowserPageError) => void> = [];
	const failureListeners: Array<(failure: BrowserRequestFailure) => void> = [];
	const requestListeners: Array<(request: BrowserNetworkRequest) => void> = [];
	const navigationListeners: Array<(url: string) => void> = [];
	const requestStarts = new WeakMap<Request, number>();
	page.on('console', (message) => {
		for (const listener of consoleListeners)
			listener({ level: message.type(), text: message.text() });
	});
	page.on('pageerror', (error) => {
		for (const listener of pageErrorListeners) listener({ message: error.message });
	});
	page.on('request', (request) => requestStarts.set(request, Date.now()));
	page.on('requestfailed', (request) => {
		const failure = {
			url: request.url(),
			method: request.method(),
			reason: request.failure()?.errorText ?? null,
		};
		for (const listener of failureListeners) listener(failure);
		void requestRecord(request, requestStarts.get(request) ?? Date.now()).then((record) => {
			for (const listener of requestListeners) listener(record);
		});
	});
	page.on('requestfinished', (request) => {
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
		drag: async () => {
			throw new Error('drag is not-tested because no selected genuine surface exists');
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
}): PlaywrightWitnessHost {
	let successfulNonLoopback = 0;
	let mockedNonLoopback = 0;
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
		if (loopback(request.url())) {
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
				const context: BrowserContext = await browser.newContext({
					serviceWorkers: 'allow',
					...(options.contextProfile === 'canonical-t060'
						? {
								locale: 'en-US',
								timezoneId: 'America/Chicago',
								viewport: { width: 1280, height: 720 },
							}
						: {}),
				});
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
								!loopback(response.url()) &&
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
