import { canonicalize, sha256 } from './canonicalize.ts';

export const WITNESS_REAL_APP_SCHEMA = 'versionless.witness-real-app-interactions.v4' as const;
export const WITNESS_REAL_APP_NAMES = [
	'react-boilerplate',
	'angular-phonecat',
	'killedbygoogle',
	'angular-realworld',
	'papercups',
	'react-hospitalrun',
	'angular-factoriolab',
	'angular-jira-clone',
] as const;
/** Every named app must contribute two lanes observed twice each. */
export const WITNESS_REAL_APP_RUNS = WITNESS_REAL_APP_NAMES.length * 4;

/**
 * The closed list of applications whose journeys are permitted to record a drag
 * gesture. Drag is not a gesture a journey may reach for because it is
 * available: it is only honest where the application has a genuine drag surface
 * whose settled result can be asserted exactly, so every other application in
 * the corpus continues to record drag as not-tested and fails the run if one
 * appears.
 */
export const WITNESS_REAL_APP_DRAG_SURFACES = ['angular-jira-clone'] as const;

export type WitnessGesture = 'click' | 'type' | 'press' | 'hover' | 'scroll' | 'drag';
export type WitnessServiceWorkerTelemetry = {
	state: 'ready';
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
export type WitnessOfflineEvidence =
	| {
			state: 'react-shell-rendered-state-reset';
			shellRendered: true;
			usernameReset: true;
			repositoriesReset: true;
			apiResponseCaching: 'not-claimed';
			reduxPersistence: 'not-implemented';
			priorResultPersistence: 'not-implemented';
			harnessFulfillment: 'synthetic-github-route-online-only';
			serviceWorkerEvidence: {
				source: 'canonical-t060';
				receiptPath: 'evidence/runs/react-boilerplate-v4-composed/t060-run.json';
				canonicalDigest: '52400147929220935a9ebe47a16c8dff50b5c28e9d51c930d000c99c2bdc8a21';
				newProof: false;
			};
			lifecycle: {
				state: 'ready-online-reload-controlled-offline-reset';
				ready: WitnessServiceWorkerTelemetry;
				controlled: WitnessServiceWorkerTelemetry & { controller: 'activated' };
				onlineStaticPaths: string[];
				offlineServerRequests: 0;
			};
	  }
	| { state: 'not-applicable' };
export type WitnessNextPrerenderPayloadEvidence =
	| {
			state: 'exact-lane-bound-next-prerender';
			lane: 'baseline' | 'migrated';
			buildId: string;
			buildIdSha256: string;
			retainedIndexSha256: string;
			prerenderManifestSha256: string;
			dataRoute: string;
			sourcePath: string;
			stagedPath: string;
			payload: {
				bytes: number;
				sha256: string;
				keys: ['__N_SSG', 'pageProps'];
			};
			response: {
				method: 'GET';
				pathname: string;
				query: '';
				destination: 'empty';
				resolvedFile: string;
				status: 200;
				mime: 'application/json';
				bytes: number;
				sha256: string;
			};
	  }
	| { state: 'not-applicable' };
/**
 * Exact, application-scoped accounting for console errors an application emits
 * on its own.
 *
 * A blanket "console errors are allowed" switch would mask regressions, so this
 * is deliberately not one: `expected` pins every message text and its exact
 * occurrence count, `observed` records what the browser actually reported, and
 * `outsideInventory` must stay empty — any error whose text is not already
 * pinned fails the run. Origins are normalized because the loopback port is
 * ephemeral; everything after the origin is real observed text.
 */
export type WitnessConsoleErrorInventoryEntry = { message: string; count: number };
export type WitnessConsoleErrorInventory = {
	policy: 'exact-app-scoped-expected-console-errors';
	originPlaceholder: '{production-static-origin}';
	expected: WitnessConsoleErrorInventoryEntry[];
	observed: WitnessConsoleErrorInventoryEntry[];
	outsideInventory: [];
	total: number;
};

/**
 * Exact, application-scoped accounting for requests the browser itself failed,
 * held to the same discipline as the console-error inventory: every expected
 * failure is pinned by origin-relative path, method and reason with its exact
 * count, and any failure outside the pinned set fails the run. Paths are
 * origin-relative because the loopback port is ephemeral.
 */
export type WitnessFailedRequestInventoryEntry = {
	method: string;
	path: string;
	/** The browser's own failure reason, or null when the driver reported none. */
	reason: string | null;
	count: number;
};
export type WitnessFailedRequestInventory = {
	policy: 'exact-app-scoped-expected-failed-requests';
	expected: WitnessFailedRequestInventoryEntry[];
	observed: WitnessFailedRequestInventoryEntry[];
	outsideInventory: [];
	total: number;
};

/**
 * The exact rule that admits a member of the cancelled-duplicate-fetch
 * category, carried in the receipt so a reader checks the rule rather than
 * trusting the label. It is stated once here and copied into every inventory,
 * so a receipt cannot quietly describe a weaker rule than the one the
 * mechanism enforced.
 */
export const WITNESS_CANCELLED_DUPLICATE_FETCH_RULE =
	'A browser-cancelled fetch is admitted only when the same page also fetched the same origin-relative path with the same method successfully at least once during the same run. A cancelled fetch with no successful sibling is not admitted and fails the run as an ordinary failed request.' as const;

/**
 * One member of the cancelled-duplicate-fetch category, pinned by
 * origin-relative path, method and the browser's own cancellation reason.
 *
 * Deliberately no count. This category exists for one measured browser
 * behavior: a page fetches an asset, re-renders while that fetch is in flight,
 * starts an identical fetch, and the browser cancels one of the two. Which of
 * them the browser cancels, and how many times it happens in a given run, is
 * scheduling — pinning a count would pin a race. What is pinned instead is the
 * identity of the request that may be cancelled, and admission still requires
 * the corroboration below on every single instance.
 */
export type WitnessCancelledDuplicateFetchCategoryEntry = {
	method: string;
	path: string;
	/** The browser's own cancellation reason, matched exactly. */
	reason: string;
};

/**
 * One admitted instance, recorded with the corroboration that admitted it, so
 * the receipt shows the evidence rather than the verdict. `cancelled` is the
 * number of times this exact fetch was cancelled in this run;
 * `corroboratingSuccesses` is the number of times the same page fetched the
 * same path and method successfully, and must be at least one.
 */
export type WitnessCancelledDuplicateFetchInstance =
	WitnessCancelledDuplicateFetchCategoryEntry & {
		cancelled: number;
		corroboratingSuccesses: number;
		/** The distinct response statuses of those successful fetches, ascending. */
		corroboratingStatuses: number[];
	};

/**
 * Accounting for the cancelled-duplicate-fetch category. This is a category,
 * not an allowance: it removes nothing from the evidence, it re-files a named
 * and corroborated browser behavior into its own inventory where every instance
 * is recorded individually. Every other failed request continues through the
 * exact {@link WitnessFailedRequestInventory} and still fails the run, and a
 * cancelled fetch that matches `category` but finds no successful sibling is
 * left in that inventory too — which is to say it fails.
 *
 * `absent` records category members this run never observed, because the whole
 * point of the category is that the behavior is intermittent: a run that did
 * not race is recorded as not having raced rather than silently indistinguishable
 * from one that did. `uncorroborated` must stay empty by construction.
 */
export type WitnessCancelledDuplicateFetchInventory = {
	policy: 'corroborated-browser-cancelled-duplicate-fetch';
	corroborationRule: typeof WITNESS_CANCELLED_DUPLICATE_FETCH_RULE;
	category: WitnessCancelledDuplicateFetchCategoryEntry[];
	observed: WitnessCancelledDuplicateFetchInstance[];
	absent: WitnessCancelledDuplicateFetchCategoryEntry[];
	uncorroborated: [];
	/** Cancelled fetches admitted by the category in this run, summed. */
	admitted: number;
};

/**
 * One observed service-worker-script event, stripped of the two fields that
 * cannot reproduce: the wall-clock timestamp and the run-global sequence
 * number, which counts every other asset the lane happens to load. What
 * remains — who observed it, in what phase, for which path, with what detail —
 * is the substance of the observation and is identical run to run.
 */
export type WitnessServiceWorkerRequestEvent = {
	source: string;
	phase: string;
	urlPath: string | null;
	detail: Record<string, boolean | number | string | null>;
};
/** The same event with the number of times it was observed, for exact accounting. */
export type WitnessServiceWorkerRequestTally = WitnessServiceWorkerRequestEvent & {
	count: number;
};

export type WitnessRealAppRun = {
	app: (typeof WITNESS_REAL_APP_NAMES)[number];
	framework: 'react' | 'angularjs' | 'next' | 'angular';
	lane: 'baseline' | 'migrated';
	pass: 1 | 2;
	result: 'pass';
	interactions: Array<{ kind: WitnessGesture; selector: string }>;
	assertions: string[];
	routes: string[];
	trackedEvents: string[];
	witnessRecord: {
		interactions: Array<{ kind: WitnessGesture; selector: string }>;
		navigationPaths: string[];
		trackedEventCounts: Record<string, number>;
		consoleErrors: number;
		pageErrors: number;
		/**
		 * Requests the browser failed, excluding the ones admitted by this run's
		 * cancelled-duplicate-fetch category, which are recorded instance by
		 * instance in {@link WitnessRealAppRun.cancelledDuplicateFetches}. A run
		 * that declares no such category — every application here but the ones
		 * that measured the behavior — has nothing to exclude, so this stays the
		 * total number of browser-failed requests it has always been.
		 */
		failedRequests: number;
	};
	cleanPage: true;
	offlineEvidence: WitnessOfflineEvidence;
	servedStatic: {
		transport: 'isolated-bounded-loopback-production-static';
		documentFallback: 'index-only';
		missingAssets: '404';
		traversal: 'rejected';
		inventory: { files: number; beforeSha256: string; afterSha256: string };
		application: { path: 'index.html'; beforeSha256: string; afterSha256: string };
		serviceWorkers: Array<{ path: string; beforeSha256: string; afterSha256: string }>;
		byteIdentical: true;
		hmrControls: false;
		legacyMainPrecache:
			| {
					state: 'exact-completed';
					responses: Array<{
						method: 'GET';
						pathname: string;
						query: '?__uncache=versionless-deterministic';
						destination: 'empty';
						resolvedFile: string;
						status: 200;
						mime: string;
						bytes: number;
						sha256: string;
						urlPath: string;
						source: 'production-static-origin';
					}>;
			  }
			| { state: 'not-applicable' };
		phonecatOrdering:
			| {
					state: 'data-derived-full-order';
					datasetSha256: string;
					orderSha256: string;
					rows: 20;
					comparator: 'stable-lowercase-utf16-source-order-ties';
			  }
			| { state: 'not-applicable' };
		phonecatImageTransition:
			| {
					state: 'data-derived-visible-transition';
					detailSha256: string;
					defaultImage: string;
					nonDefaultImage: string;
					hover: 'genuine-thumbnail-mouseover';
					transition: 'genuine-ng-click';
					heroVisibility: 'genuine-hover';
			  }
			| { state: 'not-applicable' };
		nextPrerenderPayload?: WitnessNextPrerenderPayloadEvidence;
	};
	observerFinalization: {
		state: 'target-closed';
		detach: 'owned-detach-complete';
		pageClose: 'owned-page-close-complete';
		workerEvents: WitnessServiceWorkerTelemetry['workerEvents'];
	};
	semanticDigest: string;
	successfulNonLoopback: 0;
	consoleErrorInventory?: WitnessConsoleErrorInventory;
	failedRequestInventory?: WitnessFailedRequestInventory;
	cancelledDuplicateFetches?: WitnessCancelledDuplicateFetchInventory;
	scrollSurface?: WitnessScrollSurface;
	scrollAbsence?: WitnessMeasuredScrollAbsence;
};

/**
 * Measured scroll evidence for one route that genuinely overflows the stated
 * viewport. The document extents are read from the live page, and the scroll
 * itself is a real wheel gesture the browser driver confirms moved the
 * viewport — the boolean is an observation, not a claim substituted for one.
 */
export type WitnessScrollSurface = {
	state: 'measured-genuine-viewport-scroll';
	route: string;
	viewport: { width: number; height: number };
	scrollHeight: number;
	clientHeight: number;
	wheelDeltaY: number;
	scrolledFromTop: true;
	scrolled: true;
};

/**
 * The measured counterpart of {@link WitnessScrollSurface}: evidence that a
 * journey looked for a scroll surface and did not find one.
 *
 * An application that pins its document to the viewport and scrolls its own
 * inner panels instead has no scrollable document to gesture at, and inventing
 * one would be a false claim. So the same generic measurement that backs a
 * scroll claim is taken at every visited route and recorded here instead:
 * `scrollHeight` never exceeds `clientHeight`, which is why no scroll coverage
 * is claimed. Routes are recorded individually rather than summarized, so a
 * route that starts overflowing later cannot hide inside a total.
 */
export type WitnessMeasuredScrollAbsence = {
	state: 'measured-no-overflowing-document';
	viewport: { width: number; height: number };
	routes: Array<{ route: string; scrollHeight: number; clientHeight: number }>;
	/** How the application keeps the document from overflowing, observed rather than assumed. */
	documentOverflow: string;
	claimed: false;
};

export type WitnessMutationProof = {
	app: 'react-boilerplate' | 'angular-realworld';
	failure: 'witness-semantic-assertion';
	intendedFailure: true;
	restoredByteIdentically: true;
};

export type WitnessRealAppReceipt = {
	schemaVersion: typeof WITNESS_REAL_APP_SCHEMA;
	result: 'pass';
	provenance: Record<string, unknown>;
	canonicalReceipts: Array<{
		app: string;
		path: string;
		sha256: string;
		canonicalDigest: string;
	}>;
	runs: WitnessRealAppRun[];
	mutations: WitnessMutationProof[];
	killedByGoogleInventory: {
		archiveSha256: string;
		mirrorFiles: number;
		sourceFiles: Record<'baseline' | 'migrated', number>;
		buildFiles: Record<'baseline' | 'migrated', number>;
		transformEdits: 3;
	};
	locality: { mode: 'offline'; successfulNonLoopback: 0; osWideIsolation: false };
	nonclaims: string[];
	integrity: { algorithm: 'sha256'; canonicalDigest: string };
};

function record(value: unknown, label: string): Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`Witness real-app ${label} must be an object`);
	return value as Record<string, unknown>;
}

function sha256Digest(value: unknown): value is string {
	return typeof value === 'string' && value.length === 64;
}

function sortedUniqueStrings(values: unknown): values is string[] {
	return (
		Array.isArray(values) &&
		values.every((value) => typeof value === 'string') &&
		new Set(values).size === values.length &&
		values.join('\n') === [...values].sort().join('\n')
	);
}

function validServiceWorkerTelemetry(value: unknown): value is WitnessServiceWorkerTelemetry {
	const telemetry = value as WitnessServiceWorkerTelemetry;
	return (
		telemetry?.state === 'ready' &&
		telemetry.registration?.scriptPath === '/sw.js' &&
		telemetry.registration.scope === '/' &&
		telemetry.registration.active === 'activated' &&
		(telemetry.controller === 'activated' || telemetry.controller === null) &&
		sortedUniqueStrings(telemetry.cacheNames) &&
		telemetry.cacheNames.length === 1 &&
		Array.isArray(telemetry.cacheEntries) &&
		telemetry.cacheEntries.length === 1 &&
		telemetry.cacheEntries[0]?.name === telemetry.cacheNames[0] &&
		sortedUniqueStrings(telemetry.cacheEntries[0].paths) &&
		telemetry.cacheEntries[0].paths.length > 0 &&
		telemetry.cacheEntries[0].paths.every((path) => path.startsWith('/')) &&
		Array.isArray(telemetry.workerEvents)
	);
}

export function witnessRealAppDigest(receipt: WitnessRealAppReceipt): string {
	const copy = structuredClone(receipt);
	copy.integrity.canonicalDigest = '';
	return sha256(canonicalize(copy));
}

export function parseWitnessRealAppReceipt(value: unknown): WitnessRealAppReceipt {
	const receipt = record(value, 'receipt') as WitnessRealAppReceipt;
	if (
		receipt.schemaVersion !== WITNESS_REAL_APP_SCHEMA ||
		receipt.result !== 'pass' ||
		!Array.isArray(receipt.runs) ||
		receipt.runs.length !== WITNESS_REAL_APP_RUNS ||
		!Array.isArray(receipt.canonicalReceipts) ||
		receipt.canonicalReceipts.length !== WITNESS_REAL_APP_NAMES.length
	)
		throw new Error('Witness real-app receipt cardinality differs');
	const expected = new Set<string>();
	for (const app of WITNESS_REAL_APP_NAMES)
		for (const lane of ['baseline', 'migrated'])
			for (const pass of [1, 2]) expected.add(`${app}:${lane}:${pass}`);
	const gestures = new Set<WitnessGesture>();
	const semanticPasses = new Map<string, string>();
	for (const run of receipt.runs) {
		const key = `${run.app}:${run.lane}:${run.pass}`;
		const served = run.servedStatic;
		const servedStaticDiffers =
			served?.transport !== 'isolated-bounded-loopback-production-static' ||
			served.documentFallback !== 'index-only' ||
			served.missingAssets !== '404' ||
			served.traversal !== 'rejected' ||
			!Number.isInteger(served.inventory?.files) ||
			served.inventory.files < 1 ||
			!sha256Digest(served.inventory.beforeSha256) ||
			served.inventory.beforeSha256 !== served.inventory.afterSha256 ||
			served.application?.path !== 'index.html' ||
			!sha256Digest(served.application.beforeSha256) ||
			served.application.beforeSha256 !== served.application.afterSha256 ||
			!Array.isArray(served.serviceWorkers) ||
			served.serviceWorkers.some(
				(serviceWorker) =>
					serviceWorker.path !== 'sw.js' ||
					!sha256Digest(serviceWorker.beforeSha256) ||
					serviceWorker.beforeSha256 !== serviceWorker.afterSha256,
			) ||
			(run.app === 'react-boilerplate'
				? served.serviceWorkers.length !== 1
				: served.serviceWorkers.length !== 0) ||
			served.byteIdentical !== true ||
			served.hmrControls !== false;
		const expectedLegacyMain = [
			['/favicon.ico', 'favicon.ico', 'image/x-icon'],
			[
				'/2f1a976c9c35ffed9b7e23cf2cbf8f19.jpg',
				'2f1a976c9c35ffed9b7e23cf2cbf8f19.jpg',
				'image/jpeg',
			],
			[
				'/runtime.bfb7866e5bd316b6a048.js',
				'runtime.bfb7866e5bd316b6a048.js',
				'text/javascript',
			],
			['/', 'index.html', 'text/html'],
		] as const;
		const legacyMainPrecacheDiffers =
			run.app === 'react-boilerplate' && run.lane === 'baseline'
				? served.legacyMainPrecache?.state !== 'exact-completed' ||
					served.legacyMainPrecache.responses.length !== expectedLegacyMain.length ||
					served.legacyMainPrecache.responses.some((response, index) => {
						const expectedResponse = expectedLegacyMain[index];
						return (
							expectedResponse === undefined ||
							response.method !== 'GET' ||
							response.pathname !== expectedResponse[0] ||
							response.query !== '?__uncache=versionless-deterministic' ||
							response.destination !== 'empty' ||
							response.resolvedFile !== expectedResponse[1] ||
							response.status !== 200 ||
							response.mime !== expectedResponse[2] ||
							!Number.isInteger(response.bytes) ||
							response.bytes < 1 ||
							!sha256Digest(response.sha256) ||
							response.urlPath !== `${response.pathname}${response.query}` ||
							response.source !== 'production-static-origin'
						);
					})
				: served.legacyMainPrecache?.state !== 'not-applicable';
		const phonecatOrderingDiffers =
			run.app === 'angular-phonecat'
				? served.phonecatOrdering?.state !== 'data-derived-full-order' ||
					!sha256Digest(served.phonecatOrdering.datasetSha256) ||
					!sha256Digest(served.phonecatOrdering.orderSha256) ||
					served.phonecatOrdering.rows !== 20 ||
					served.phonecatOrdering.comparator !==
						'stable-lowercase-utf16-source-order-ties'
				: served.phonecatOrdering?.state !== 'not-applicable';
		const phonecatImageTransitionDiffers =
			run.app === 'angular-phonecat'
				? served.phonecatImageTransition?.state !== 'data-derived-visible-transition' ||
					!sha256Digest(served.phonecatImageTransition.detailSha256) ||
					!served.phonecatImageTransition.defaultImage.startsWith('img/phones/') ||
					!served.phonecatImageTransition.nonDefaultImage.startsWith('img/phones/') ||
					served.phonecatImageTransition.defaultImage ===
						served.phonecatImageTransition.nonDefaultImage ||
					served.phonecatImageTransition.hover !== 'genuine-thumbnail-mouseover' ||
					served.phonecatImageTransition.transition !== 'genuine-ng-click' ||
					served.phonecatImageTransition.heroVisibility !== 'genuine-hover'
				: served.phonecatImageTransition?.state !== 'not-applicable';
		const observerFinalizationDiffers =
			run.observerFinalization?.state !== 'target-closed' ||
			run.observerFinalization.detach !== 'owned-detach-complete' ||
			run.observerFinalization.pageClose !== 'owned-page-close-complete' ||
			!Array.isArray(run.observerFinalization.workerEvents);
		const lifecycle =
			run.offlineEvidence.state === 'react-shell-rendered-state-reset'
				? run.offlineEvidence.lifecycle
				: undefined;
		const expectedCacheName =
			run.lane === 'baseline'
				? 'webpack-offline:versionless-deterministic'
				: 'versionless-react-vite8-553cd1cc611a0851b1978bbc041ef2f8c7b9fbbd3fdd9bb68274f29364987cdc';
		const lifecycleDiffers =
			run.app === 'react-boilerplate'
				? lifecycle?.state !== 'ready-online-reload-controlled-offline-reset' ||
					!validServiceWorkerTelemetry(lifecycle.ready) ||
					!validServiceWorkerTelemetry(lifecycle.controlled) ||
					lifecycle.controlled.controller !== 'activated' ||
					lifecycle.ready.cacheNames[0] !== expectedCacheName ||
					canonicalize(lifecycle.ready.cacheEntries) !==
						canonicalize(lifecycle.controlled.cacheEntries) ||
					!sortedUniqueStrings(lifecycle.onlineStaticPaths) ||
					!lifecycle.onlineStaticPaths.includes('/sw.js') ||
					lifecycle.ready.cacheEntries[0]!.paths.some(
						(path) =>
							path !== '/__offline_webpack__data' &&
							!lifecycle.onlineStaticPaths.includes(path),
					) ||
					lifecycle.offlineServerRequests !== 0
				: lifecycle !== undefined;
		if (
			run.interactions.some((interaction) => interaction.kind === 'drag') &&
			!(WITNESS_REAL_APP_DRAG_SURFACES as readonly string[]).includes(run.app)
		)
			throw new Error('Witness real-app drag must remain not-tested');
		if (
			!expected.delete(key) ||
			run.result !== 'pass' ||
			run.successfulNonLoopback !== 0 ||
			!Array.isArray(run.interactions) ||
			run.interactions.length === 0 ||
			!Array.isArray(run.assertions) ||
			run.assertions.length === 0 ||
			servedStaticDiffers ||
			legacyMainPrecacheDiffers ||
			phonecatOrderingDiffers ||
			phonecatImageTransitionDiffers ||
			observerFinalizationDiffers ||
			lifecycleDiffers ||
			run.cleanPage !== true ||
			(run.app === 'react-boilerplate'
				? run.offlineEvidence?.state !== 'react-shell-rendered-state-reset' ||
					run.offlineEvidence.shellRendered !== true ||
					run.offlineEvidence.usernameReset !== true ||
					run.offlineEvidence.repositoriesReset !== true ||
					run.offlineEvidence.apiResponseCaching !== 'not-claimed' ||
					run.offlineEvidence.reduxPersistence !== 'not-implemented' ||
					run.offlineEvidence.priorResultPersistence !== 'not-implemented' ||
					run.offlineEvidence.harnessFulfillment !==
						'synthetic-github-route-online-only' ||
					run.offlineEvidence.serviceWorkerEvidence?.source !== 'canonical-t060' ||
					run.offlineEvidence.serviceWorkerEvidence.receiptPath !==
						'evidence/runs/react-boilerplate-v4-composed/t060-run.json' ||
					run.offlineEvidence.serviceWorkerEvidence.canonicalDigest !==
						'52400147929220935a9ebe47a16c8dff50b5c28e9d51c930d000c99c2bdc8a21' ||
					run.offlineEvidence.serviceWorkerEvidence.newProof !== false
				: run.offlineEvidence?.state !== 'not-applicable') ||
			run.semanticDigest !==
				sha256(
					canonicalize({
						app: run.app,
						framework: run.framework,
						lane: run.lane,
						interactions: run.interactions,
						assertions: run.assertions,
						routes: run.routes,
						trackedEvents: run.trackedEvents,
						witnessRecord: run.witnessRecord,
						cleanPage: run.cleanPage,
						offlineEvidence: run.offlineEvidence,
						servedStatic: run.servedStatic,
						observerFinalization: run.observerFinalization,
						successfulNonLoopback: run.successfulNonLoopback,
					}),
				)
		)
			throw new Error(`Witness real-app run differs: ${key}`);
		const pair = `${run.app}:${run.lane}`;
		const prior = semanticPasses.get(pair);
		if (prior !== undefined && prior !== run.semanticDigest)
			throw new Error(`Witness real-app repeated pass differs: ${pair}`);
		semanticPasses.set(pair, run.semanticDigest);
		for (const interaction of run.interactions) {
			gestures.add(interaction.kind);
		}
	}
	if (
		expected.size !== 0 ||
		[...gestures].sort().join(',') !== 'click,drag,hover,press,scroll,type'
	)
		throw new Error('Witness real-app interaction coverage differs');
	if (
		receipt.mutations?.length !== 2 ||
		receipt.mutations.some(
			(mutation) =>
				mutation.failure !== 'witness-semantic-assertion' ||
				mutation.intendedFailure !== true ||
				mutation.restoredByteIdentically !== true,
		) ||
		!receipt.mutations.some((mutation) => mutation.app === 'react-boilerplate') ||
		!receipt.mutations.some((mutation) => mutation.app === 'angular-realworld') ||
		receipt.killedByGoogleInventory?.transformEdits !== 3 ||
		receipt.locality?.mode !== 'offline' ||
		receipt.locality?.successfulNonLoopback !== 0 ||
		receipt.locality?.osWideIsolation !== false ||
		!receipt.nonclaims?.some((claim) => claim.includes('Drag is tested only')) ||
		receipt.integrity?.algorithm !== 'sha256' ||
		receipt.integrity.canonicalDigest !== witnessRealAppDigest(receipt)
	)
		throw new Error('Witness real-app receipt integrity or nonclaims differ');
	return receipt;
}
