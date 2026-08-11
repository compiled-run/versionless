import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'pathe';
import { compareUtf16CodeUnits } from '../bundlers/vite8-adapter.ts';
import { canonicalize, sha256 } from './canonicalize.ts';
import type {
	WitnessConsoleErrorInventory,
	WitnessConsoleErrorInventoryEntry,
	WitnessFailedRequestInventory,
	WitnessFailedRequestInventoryEntry,
	WitnessRealAppRun,
	WitnessScrollSurface,
	WitnessServiceWorkerRequestEvent,
	WitnessServiceWorkerRequestTally,
} from './witness-real-app.ts';

export const WITNESS_REACT_HOSPITALRUN_SCHEMA =
	'versionless.witness-react-hospitalrun.v1' as const;
export const WITNESS_REACT_HOSPITALRUN_RECEIPT_PATH =
	'evidence/runs/witness-react-hospitalrun/receipt.json' as const;
export const REACT_HOSPITALRUN_FIXTURE = 'react-hospitalrun' as const;
export const REACT_HOSPITALRUN_RECEIPT_PATH =
	'evidence/runs/react-hospitalrun/t004-run.json' as const;
export const REACT_HOSPITALRUN_RUN_ID = 'T004-react-hospitalrun-cra-to-vite8-boot' as const;
/**
 * The retained build-and-boot receipt is bound by its declared canonical digest
 * and by the sha256 of its exact bytes, so the browser proof cannot be
 * re-pointed at a rebuilt or edited build receipt.
 */
export const REACT_HOSPITALRUN_CANONICAL_DIGEST =
	'1fa0278923101efe6af370a44d0ef90e3309ac4c7a823fad448eb196cca37cd8' as const;
export const REACT_HOSPITALRUN_RECEIPT_SHA256 =
	'abd2cb8532cf06d174d0f4b09130a098ac559abe5a88d1f53967471c05b09313' as const;

/**
 * The immutable HospitalRun source identity, bound here so the browser-proof
 * receipt cannot silently rebind itself to a different revision or archive.
 */
export const REACT_HOSPITALRUN_SOURCE = Object.freeze({
	repository: 'https://github.com/HospitalRun/hospitalrun-frontend',
	ref: 'refs/tags/v2.0.0-alpha.7',
	revision: '8156955145551d0366df10faa28e724f3377dea1',
	archiveSha256: 'c9d07e8ee7ffaa174dff597dcecbd00c8eb0b6d525bb7a3f9a7d48e6a46ec306',
	frontendRoot: '.',
	license: 'MIT',
	licenseSha256: '460148c79f31dd2a352b401068e0ae512a807cf643edac512eb22cf3342027a3',
});

/**
 * Exact console-error inventory, per lane, for the whole journey (two document
 * loads: the initial visit and the online reload).
 *
 * This is an accounting mechanism, not an allowance. The application's own
 * `src/index.tsx` calls `serviceWorker.register()` twice; the browser context
 * refuses service workers, so each load produces exactly two console errors,
 * and the two lanes fail differently — a real, recorded behavioral migration
 * difference:
 *
 * - the retained create-react-app baseline still emits `service-worker.js`, so
 *   the application reaches `navigator.serviceWorker.register()` and its own
 *   error handler logs the refusal;
 * - the migrated Vite build emits no worker script at all, so the application's
 *   `checkValidServiceWorker` probe 404s and never reaches registration.
 *
 * Message texts are recorded verbatim except for the ephemeral loopback origin,
 * which is normalized. Any console error outside this inventory fails the run.
 */
export const WITNESS_REACT_HOSPITALRUN_CONSOLE_ERRORS = Object.freeze({
	baseline: Object.freeze([
		Object.freeze({
			message:
				"Error during service worker registration: TypeError: Cannot set properties of undefined (setting 'onupdatefound')\n    at {production-static-origin}/static/js/main.963b07d9.chunk.js:1:205808",
			count: 4,
		}),
	]),
	migrated: Object.freeze([
		Object.freeze({
			message: 'Failed to load resource: the server responded with a status of 404 (Not Found)',
			count: 4,
		}),
	]),
}) as Readonly<Record<'baseline' | 'migrated', readonly WitnessConsoleErrorInventoryEntry[]>>;

/**
 * Exact failed-request inventory, per lane, for the whole journey.
 *
 * The browser context refuses service workers, so the application's own
 * `serviceWorker.register()` leaves exactly one aborted worker-script request
 * per document load — two across the journey's initial visit and online reload.
 * Both lanes reach registration, so both record the same aborted request; the
 * lanes differ in what the server answers, which is what the console-error
 * inventory records. Any failed request outside this inventory fails the run.
 */
export const WITNESS_REACT_HOSPITALRUN_FAILED_REQUESTS = Object.freeze({
	baseline: Object.freeze([
		Object.freeze({
			method: 'GET',
			path: '/service-worker.js',
			reason: 'net::ERR_ABORTED',
			count: 2,
		}),
	]),
	migrated: Object.freeze([
		Object.freeze({
			method: 'GET',
			path: '/service-worker.js',
			reason: 'net::ERR_ABORTED',
			count: 2,
		}),
	]),
}) as Readonly<Record<'baseline' | 'migrated', readonly WitnessFailedRequestInventoryEntry[]>>;

const swPath = '/service-worker.js';
const swAttempt = (count: number): WitnessServiceWorkerRequestTally[] => [
	{ source: 'browser', phase: 'request', urlPath: swPath, detail: { serviceWorker: false }, count },
	{
		source: 'context-route',
		phase: 'start',
		urlPath: swPath,
		detail: { serviceWorker: false },
		count,
	},
	{
		source: 'context-route',
		phase: 'continue',
		urlPath: swPath,
		detail: { serviceWorker: false },
		count,
	},
];
const swAborted = (count: number): WitnessServiceWorkerRequestTally => ({
	source: 'browser',
	phase: 'failure',
	urlPath: swPath,
	detail: { serviceWorker: false, reason: 'net::ERR_ABORTED' },
	count,
});

/**
 * Exact worker-script event tally, per lane, for the whole journey.
 *
 * This is where the migration difference is at its most concrete. The
 * application attempts registration four times — twice per document load,
 * across the initial visit and the online reload — in both lanes, and the
 * browser context refuses every one of them. What differs is what the server
 * had to answer with:
 *
 * - the retained create-react-app baseline still ships `service-worker.js`, so
 *   all four probes are answered `200`;
 * - the migrated Vite build emits no worker script, so all four are answered
 *   `404` and the browser logs each one.
 *
 * Neither lane ends up with a worker: the two script fetches that reach the
 * registration stage are aborted by the context in both lanes.
 */
export const WITNESS_REACT_HOSPITALRUN_SERVICE_WORKER_REQUESTS = Object.freeze({
	baseline: Object.freeze([
		...swAttempt(4),
		{
			source: 'browser',
			phase: 'response',
			urlPath: swPath,
			detail: { serviceWorker: false, status: 200 },
			count: 4,
		},
		swAborted(2),
	]),
	migrated: Object.freeze([
		...swAttempt(4),
		{
			source: 'browser',
			phase: 'response',
			urlPath: swPath,
			detail: { serviceWorker: false, status: 404 },
			count: 4,
		},
		{
			source: 'browser',
			phase: 'console',
			urlPath: swPath,
			detail: {
				level: 'error',
				text: 'Failed to load resource: the server responded with a status of 404 (Not Found)',
			},
			count: 4,
		},
		swAborted(2),
	]),
}) as Readonly<Record<'baseline' | 'migrated', readonly WitnessServiceWorkerRequestTally[]>>;

/**
 * Registration attempts the application makes across the journey, identical in
 * both lanes and refused in both: the lane-independent invariant the parity
 * digest carries in place of the lane-specific trace above.
 */
export const WITNESS_REACT_HOSPITALRUN_REGISTRATION_ATTEMPTS = 4;

/**
 * The baseline registers a worker script and the migrated build has none to
 * register. Recording the difference is the point: it is a genuine change in
 * observable behavior across the migration, not something to be normalized
 * away, and it is the only difference the two lanes exhibit.
 */
export const WITNESS_REACT_HOSPITALRUN_SERVICE_WORKER_DIFFERENCE = Object.freeze({
	state: 'recorded-behavioral-migration-difference',
	baseline: 'emits-service-worker-js-and-calls-register',
	migrated: 'emits-no-service-worker-and-register-probe-404s',
	registrationsInEitherLane: 0,
	controllerInEitherLane: null,
	cacheStorageNamesInEitherLane: 0,
	masked: false,
});

/**
 * The exact route sequence the journey drives, in order, after the initial
 * document load. The patient identifier is minted in the browser at intake, so
 * it is normalized to a placeholder; everything else is the literal path the
 * application navigated to. Pinning the whole sequence is what makes a dropped
 * sub-tab or a silently redirected department route fail the run.
 */
export const WITNESS_REACT_HOSPITALRUN_ROUTES = Object.freeze([
	'/patients',
	'/patients/new',
	'/patients/{created-patient-id}',
	'/patients/{created-patient-id}/allergies',
	'/patients/{created-patient-id}/notes',
	'/patients/{created-patient-id}/relatedpersons',
	'/patients/{created-patient-id}',
	'/patients',
	'/labs',
	'/incidents',
	'/imaging',
	'/appointments',
	'/patients',
	'/patients',
]);

export type WitnessReactHospitalrunCheckpoint = {
	phase: 'before-interactions' | 'after-interactions' | 'after-online-reload';
	state: 'timeout';
	registrations: 0;
	controller: null;
	cacheNames: [];
	workerEvents: [];
};

/**
 * Runtime blocked-service-worker observation.
 *
 * `emittedOutputFiles` is deliberately not required to be empty: the retained
 * create-react-app baseline ships a real `service-worker.js`, and erasing that
 * from the evidence would be masking. What is required is that no worker is
 * ever registered, controls the page, opens a cache, or emits a lifecycle event
 * in either lane or any pass.
 */
export type WitnessReactHospitalrunBlockedServiceWorker = {
	registration: 'application-register-refused-by-context';
	checkpoints: WitnessReactHospitalrunCheckpoint[];
	emittedOutputFiles: Array<{ path: string; sha256: string }>;
	/**
	 * The whole ordered trace of worker-script events, kept rather than
	 * summarized away, so the refusal can be read event by event.
	 */
	requests: WitnessServiceWorkerRequestEvent[];
	/** The same trace as an exact multiset, checked against the pinned per-lane tally. */
	requestTally: WitnessServiceWorkerRequestTally[];
	workerEvents: [];
};

export type WitnessReactHospitalrunRun = WitnessRealAppRun & {
	blockedServiceWorkerRuntime: WitnessReactHospitalrunBlockedServiceWorker;
	consoleErrorInventory: WitnessConsoleErrorInventory;
	failedRequestInventory: WitnessFailedRequestInventory;
	scrollSurface: WitnessScrollSurface;
	behaviorDigest: string;
};

export type WitnessReactHospitalrunMutation = {
	failure: 'witness-semantic-assertion';
	intendedFailure: true;
	lane: 'migrated';
	seam: string;
	path: string;
	offset: number;
	beforeSha256: string;
	mutatedSha256: string;
	afterRestoreSha256: string;
	restoredByteIdentically: true;
	restoredRun: 'pass';
	restoredBehaviorDigest: string;
};

export type WitnessReactHospitalrunReceipt = {
	schemaVersion: typeof WITNESS_REACT_HOSPITALRUN_SCHEMA;
	result: 'pass';
	fixture: typeof REACT_HOSPITALRUN_FIXTURE;
	source: typeof REACT_HOSPITALRUN_SOURCE;
	provenance: Record<string, unknown>;
	canonicalReceipt: { path: string; canonicalDigest: string; sha256: string };
	runs: WitnessReactHospitalrunRun[];
	mutation: WitnessReactHospitalrunMutation;
	blockedServiceWorker: WitnessReactHospitalrunBlockedServiceWorker;
	serviceWorkerDifference: typeof WITNESS_REACT_HOSPITALRUN_SERVICE_WORKER_DIFFERENCE;
	consoleErrors: Readonly<
		Record<'baseline' | 'migrated', readonly WitnessConsoleErrorInventoryEntry[]>
	>;
	failedRequests: Readonly<
		Record<'baseline' | 'migrated', readonly WitnessFailedRequestInventoryEntry[]>
	>;
	scrollSurface: WitnessScrollSurface;
	persistence: {
		store: 'browser-local-pouchdb';
		stubbed: false;
		survivesOnlineReload: true;
	};
	readiness: {
		reactLineage: { ready: 1; total: 4; counted: false };
		overall: { ready: 3; total: 12 };
	};
	locality: { mode: 'offline'; successfulNonLoopback: 0; osWideIsolation: false };
	nonclaims: string[];
	integrity: { algorithm: 'sha256'; canonicalDigest: string };
};

const exact = (left: unknown, right: unknown): boolean =>
	canonicalize(left) === canonicalize(right);

export function witnessReactHospitalrunRawDigest(
	run: WitnessReactHospitalrunRun | WitnessRealAppRun,
): string {
	const { pass: _pass, result: _result, semanticDigest: _semanticDigest, ...raw } = run;
	const withoutBehavior = { ...raw } as Record<string, unknown>;
	delete withoutBehavior.behaviorDigest;
	return sha256(canonicalize(withoutBehavior));
}

/**
 * Deterministic tracked-event floor.
 *
 * The typed, clicked, changed and keyed counts are exact and identical in every
 * lane and pass, so they are pinned. Incidental `mouseover` events depend on the
 * pointer path the host takes between the genuine hovers, so the count is
 * bounded from below by those hovers instead of being pinned to an unstable
 * number. The bound is checked, not erased.
 */
export const WITNESS_REACT_HOSPITALRUN_TRACKED_EVENTS = Object.freeze({
	change: 2,
	click: 12,
	input: 16,
	keydown: 16,
	mouseoverAtLeast: 3,
});

function trackedEventProjection(run: WitnessRealAppRun): Record<string, unknown> {
	const counts = run.witnessRecord.trackedEventCounts;
	const mouseover = counts.mouseover ?? 0;
	if (
		counts.change !== WITNESS_REACT_HOSPITALRUN_TRACKED_EVENTS.change ||
		counts.click !== WITNESS_REACT_HOSPITALRUN_TRACKED_EVENTS.click ||
		counts.input !== WITNESS_REACT_HOSPITALRUN_TRACKED_EVENTS.input ||
		counts.keydown !== WITNESS_REACT_HOSPITALRUN_TRACKED_EVENTS.keydown ||
		mouseover < WITNESS_REACT_HOSPITALRUN_TRACKED_EVENTS.mouseoverAtLeast ||
		Object.keys(counts).sort().join(',') !== 'change,click,input,keydown,mouseover'
	)
		throw new Error('React HospitalRun tracked browser events differ');
	return {
		change: counts.change,
		click: counts.click,
		input: counts.input,
		keydown: counts.keydown,
		mouseover: `at-least-${WITNESS_REACT_HOSPITALRUN_TRACKED_EVENTS.mouseoverAtLeast}-genuine-hovers`,
	};
}

/**
 * Lane-independent behavior projection.
 *
 * Production bytes are lane-specific by construction, so the byte inventory
 * stays in the run record and out of this digest. The console-error inventory
 * is lane-specific on purpose — it is the recorded migration difference — so
 * the digest carries its shape and total rather than its lane-bound text, and
 * the text itself is verified exactly against the pinned inventory elsewhere.
 */
export function witnessReactHospitalrunBehaviorDigest(
	run: WitnessReactHospitalrunRun | WitnessRealAppRun,
): string {
	const blocked = (run as WitnessReactHospitalrunRun).blockedServiceWorkerRuntime;
	const inventory = run.consoleErrorInventory;
	return sha256(
		canonicalize({
			app: run.app,
			framework: run.framework,
			interactions: run.interactions,
			assertions: run.assertions,
			routes: run.routes,
			trackedEvents: run.trackedEvents,
			witnessRecord: {
				...run.witnessRecord,
				trackedEventCounts: trackedEventProjection(run),
			},
			cleanPage: run.cleanPage,
			offlineEvidence: run.offlineEvidence,
			servedStaticPolicy: {
				transport: run.servedStatic.transport,
				documentFallback: run.servedStatic.documentFallback,
				missingAssets: run.servedStatic.missingAssets,
				traversal: run.servedStatic.traversal,
				byteIdentical: run.servedStatic.byteIdentical,
				hmrControls: run.servedStatic.hmrControls,
			},
			blockedServiceWorkerRuntime: {
				registration: blocked?.registration,
				checkpoints: blocked?.checkpoints,
				workerEvents: blocked?.workerEvents,
				// The worker-script trace is lane-specific on purpose — a served
				// 200 against a 404 is the recorded migration difference — so the
				// parity digest carries only what both lanes must share: the same
				// number of registration attempts, all refused, none surviving.
				// The lane-specific trace is verified exactly against its pinned
				// tally elsewhere.
				registrationAttempts: (blocked?.requests ?? []).filter(
					(event) => event.source === 'browser' && event.phase === 'request',
				).length,
				abortedWorkerScriptFetches: (blocked?.requests ?? []).filter(
					(event) => event.phase === 'failure',
				).length,
			},
			consoleErrorPolicy: {
				policy: inventory?.policy,
				outsideInventory: inventory?.outsideInventory,
				total: inventory?.total,
			},
			// Identical in both lanes, so the whole inventory is lane-independent
			// and participates in the parity digest rather than only its shape.
			failedRequestInventory: run.failedRequestInventory,
			scrollSurface: run.scrollSurface,
			successfulNonLoopback: run.successfulNonLoopback,
		}),
	);
}

export function witnessReactHospitalrunDigest(receipt: WitnessReactHospitalrunReceipt): string {
	const copy = structuredClone(receipt);
	copy.integrity.canonicalDigest = '';
	return sha256(canonicalize(copy));
}

/**
 * The lane-specific worker-script trace, verified exactly. `lane` is null for
 * the receipt-level summary, which carries only the lane-independent parts.
 */
function assertServiceWorkerRequests(
	blocked: WitnessReactHospitalrunBlockedServiceWorker,
	lane: 'baseline' | 'migrated' | null,
	label: string,
): void {
	if (!Array.isArray(blocked.requests) || !Array.isArray(blocked.requestTally))
		throw new Error(`React HospitalRun worker-script trace is absent: ${label}`);
	const attempts = blocked.requests.filter(
		(event) => event.source === 'browser' && event.phase === 'request',
	).length;
	if (attempts !== WITNESS_REACT_HOSPITALRUN_REGISTRATION_ATTEMPTS)
		throw new Error(`React HospitalRun registration attempts differ: ${label}`);
	if (lane === null) return;
	const pinned = [...WITNESS_REACT_HOSPITALRUN_SERVICE_WORKER_REQUESTS[lane]];
	const observed = new Map<string, number>();
	for (const event of blocked.requests) {
		const key = canonicalize({
			source: event.source,
			phase: event.phase,
			urlPath: event.urlPath,
			detail: event.detail,
		});
		observed.set(key, (observed.get(key) ?? 0) + 1);
	}
	const expected = new Map(
		pinned.map((entry) => [
			canonicalize({
				source: entry.source,
				phase: entry.phase,
				urlPath: entry.urlPath,
				detail: entry.detail,
			}),
			entry.count,
		]),
	);
	if (
		observed.size !== expected.size ||
		[...expected].some(([key, count]) => observed.get(key) !== count) ||
		blocked.requests.length !== pinned.reduce((sum, entry) => sum + entry.count, 0) ||
		!exact(
			[...blocked.requestTally].sort((left, right) =>
				compareUtf16CodeUnits(canonicalize(left), canonicalize(right)),
			),
			[...pinned].sort((left, right) =>
				compareUtf16CodeUnits(canonicalize(left), canonicalize(right)),
			),
		)
	)
		throw new Error(`React HospitalRun worker-script trace differs: ${label}`);
}

function assertBlockedServiceWorker(
	blocked: WitnessReactHospitalrunBlockedServiceWorker | undefined,
	lane: 'baseline' | 'migrated' | null,
	label: string,
): void {
	if (
		blocked === undefined ||
		blocked.registration !== 'application-register-refused-by-context' ||
		!Array.isArray(blocked.emittedOutputFiles) ||
		!exact(blocked.workerEvents, []) ||
		!Array.isArray(blocked.checkpoints) ||
		blocked.checkpoints.length !== 3 ||
		canonicalize(blocked.checkpoints.map((checkpoint) => checkpoint.phase)) !==
			canonicalize(['before-interactions', 'after-interactions', 'after-online-reload']) ||
		blocked.checkpoints.some(
			(checkpoint) =>
				checkpoint.state !== 'timeout' ||
				checkpoint.registrations !== 0 ||
				checkpoint.controller !== null ||
				checkpoint.cacheNames.length !== 0 ||
				checkpoint.workerEvents.length !== 0,
		)
	)
		throw new Error(`React HospitalRun blocked service-worker evidence differs: ${label}`);
	assertServiceWorkerRequests(blocked, lane, label);
}

function assertConsoleErrorInventory(
	inventory: WitnessConsoleErrorInventory | undefined,
	lane: 'baseline' | 'migrated',
	label: string,
): void {
	const pinned = [...WITNESS_REACT_HOSPITALRUN_CONSOLE_ERRORS[lane]].map((entry) => ({
		message: entry.message,
		count: entry.count,
	}));
	if (
		inventory === undefined ||
		inventory.policy !== 'exact-app-scoped-expected-console-errors' ||
		inventory.originPlaceholder !== '{production-static-origin}' ||
		!exact(inventory.outsideInventory, []) ||
		!exact(inventory.expected, pinned) ||
		!exact(inventory.observed, pinned) ||
		inventory.total !== pinned.reduce((sum, entry) => sum + entry.count, 0)
	)
		throw new Error(`React HospitalRun console-error inventory differs: ${label}`);
}

function assertFailedRequestInventory(
	inventory: WitnessFailedRequestInventory | undefined,
	lane: 'baseline' | 'migrated',
	label: string,
): void {
	const pinned = [...WITNESS_REACT_HOSPITALRUN_FAILED_REQUESTS[lane]].map((entry) => ({
		method: entry.method,
		path: entry.path,
		reason: entry.reason,
		count: entry.count,
	}));
	if (
		inventory === undefined ||
		inventory.policy !== 'exact-app-scoped-expected-failed-requests' ||
		!exact(inventory.outsideInventory, []) ||
		!exact(inventory.expected, pinned) ||
		!exact(inventory.observed, pinned) ||
		inventory.total !== pinned.reduce((sum, entry) => sum + entry.count, 0)
	)
		throw new Error(`React HospitalRun failed-request inventory differs: ${label}`);
}

function assertScrollSurface(surface: WitnessScrollSurface | undefined, label: string): void {
	if (
		surface === undefined ||
		surface.state !== 'measured-genuine-viewport-scroll' ||
		surface.route !== '/appointments' ||
		surface.viewport.width !== 1280 ||
		surface.viewport.height !== 720 ||
		surface.clientHeight !== 720 ||
		surface.scrollHeight <= surface.clientHeight ||
		surface.wheelDeltaY <= 0 ||
		surface.scrolledFromTop !== true ||
		surface.scrolled !== true
	)
		throw new Error(`React HospitalRun scroll surface differs: ${label}`);
}

export function parseWitnessReactHospitalrunReceipt(
	value: unknown,
): WitnessReactHospitalrunReceipt {
	if (value === null || typeof value !== 'object' || Array.isArray(value))
		throw new Error('React HospitalRun Witness receipt must be an object');
	const receipt = value as WitnessReactHospitalrunReceipt;
	const expectedRuns = new Set(['baseline:1', 'baseline:2', 'migrated:1', 'migrated:2']);
	const behaviors = new Set<string>();
	if (
		receipt.schemaVersion !== WITNESS_REACT_HOSPITALRUN_SCHEMA ||
		receipt.result !== 'pass' ||
		receipt.fixture !== REACT_HOSPITALRUN_FIXTURE ||
		!exact(receipt.source, REACT_HOSPITALRUN_SOURCE) ||
		receipt.canonicalReceipt?.path !== REACT_HOSPITALRUN_RECEIPT_PATH ||
		receipt.canonicalReceipt.canonicalDigest !== REACT_HOSPITALRUN_CANONICAL_DIGEST ||
		receipt.canonicalReceipt.sha256 !== REACT_HOSPITALRUN_RECEIPT_SHA256 ||
		!Array.isArray(receipt.runs) ||
		receipt.runs.length !== 4
	)
		throw new Error('React HospitalRun Witness binding differs');
	for (const run of receipt.runs) {
		const key = `${run.lane}:${run.pass}`;
		if (
			!expectedRuns.delete(key) ||
			run.app !== 'react-hospitalrun' ||
			run.framework !== 'react' ||
			run.result !== 'pass' ||
			run.cleanPage !== true ||
			run.successfulNonLoopback !== 0 ||
			run.witnessRecord.pageErrors !== 0 ||
			run.witnessRecord.failedRequests !== run.failedRequestInventory?.total ||
			run.witnessRecord.consoleErrors !== run.consoleErrorInventory?.total ||
			run.offlineEvidence.state !== 'not-applicable' ||
			run.observerFinalization.workerEvents.length !== 0 ||
			run.semanticDigest !== witnessReactHospitalrunRawDigest(run) ||
			run.behaviorDigest !== witnessReactHospitalrunBehaviorDigest(run) ||
			!exact(run.routes, WITNESS_REACT_HOSPITALRUN_ROUTES)
		)
			throw new Error(`React HospitalRun Witness run differs: ${key}`);
		assertBlockedServiceWorker(run.blockedServiceWorkerRuntime, run.lane, key);
		assertConsoleErrorInventory(run.consoleErrorInventory, run.lane, key);
		assertFailedRequestInventory(run.failedRequestInventory, run.lane, key);
		assertScrollSurface(run.scrollSurface, key);
		behaviors.add(run.behaviorDigest);
	}
	assertBlockedServiceWorker(receipt.blockedServiceWorker, null, 'receipt');
	assertScrollSurface(receipt.scrollSurface, 'receipt');
	if (
		expectedRuns.size !== 0 ||
		behaviors.size !== 1 ||
		!exact(receipt.consoleErrors, WITNESS_REACT_HOSPITALRUN_CONSOLE_ERRORS) ||
		!exact(receipt.failedRequests, WITNESS_REACT_HOSPITALRUN_FAILED_REQUESTS) ||
		!exact(
			receipt.serviceWorkerDifference,
			WITNESS_REACT_HOSPITALRUN_SERVICE_WORKER_DIFFERENCE,
		) ||
		!exact(receipt.persistence, {
			store: 'browser-local-pouchdb',
			stubbed: false,
			survivesOnlineReload: true,
		}) ||
		receipt.mutation?.intendedFailure !== true ||
		receipt.mutation.failure !== 'witness-semantic-assertion' ||
		receipt.mutation.lane !== 'migrated' ||
		receipt.mutation.restoredByteIdentically !== true ||
		receipt.mutation.restoredRun !== 'pass' ||
		receipt.mutation.beforeSha256 !== receipt.mutation.afterRestoreSha256 ||
		receipt.mutation.beforeSha256 === receipt.mutation.mutatedSha256 ||
		!behaviors.has(receipt.mutation.restoredBehaviorDigest) ||
		!exact(receipt.readiness, {
			reactLineage: { ready: 1, total: 4, counted: false },
			overall: { ready: 3, total: 12 },
		}) ||
		receipt.locality?.mode !== 'offline' ||
		receipt.locality.successfulNonLoopback !== 0 ||
		receipt.locality.osWideIsolation !== false ||
		!Array.isArray(receipt.nonclaims) ||
		receipt.nonclaims.length === 0 ||
		receipt.integrity?.algorithm !== 'sha256' ||
		receipt.integrity.canonicalDigest !== witnessReactHospitalrunDigest(receipt)
	)
		throw new Error('React HospitalRun Witness integrity differs');
	return receipt;
}

function uniqueSorted(values: readonly string[]): string[] {
	return [...new Set(values)].sort();
}

export function renderWitnessReactHospitalrunReceipt(
	receipt: WitnessReactHospitalrunReceipt,
): string {
	const emitted = receipt.runs.flatMap((run) =>
		run.blockedServiceWorkerRuntime.emittedOutputFiles.map((file) => file.path),
	);
	const inventoryLine = (lane: 'baseline' | 'migrated'): string =>
		receipt.consoleErrors[lane]
			.map((entry) => `${entry.count}x \`${entry.message.split('\n')[0]}\``)
			.join('; ');
	const swAnswer = (lane: 'baseline' | 'migrated'): string =>
		WITNESS_REACT_HOSPITALRUN_SERVICE_WORKER_REQUESTS[lane]
			.filter((entry) => entry.phase === 'response')
			.map((entry) => `${entry.count}x \`${entry.urlPath ?? ''}\` -> ${String(entry.detail.status)}`)
			.join(', ');
	const failedRequestLine = (lane: 'baseline' | 'migrated'): string =>
		receipt.failedRequests[lane]
			.map((entry) => `${entry.count}x \`${entry.method} ${entry.path} (${entry.reason})\``)
			.join('; ');
	return `# HospitalRun v2.0.0-alpha.7 — direct Witness browser proof

- Result: pass
- Canonical SHA-256: ${receipt.integrity.canonicalDigest}
- Runs: 2 baseline + 2 migrated production-static browser journeys
- Behavioral parity: ${receipt.runs[0]!.behaviorDigest}
- Journey: new-patient intake into the browser-local PouchDB store, success toast, patient row, patient record sub-tabs, labs / incidents / imaging department routes, appointment schedule with a real wheel scroll, and an online reload the created record survives
- Persistence: ${receipt.persistence.store}, stubbed: ${String(receipt.persistence.stubbed)}, survives an online reload: ${String(receipt.persistence.survivesOnlineReload)}
- Service worker: the application's own \`serviceWorker.register()\` is refused by the browser context; zero registrations, controller, CacheStorage names and worker lifecycle events at three checkpoints in every pass. The worker-script requests the application makes are not zero and are not hidden — they are recorded below.
- Recorded migration difference: baseline ${receipt.serviceWorkerDifference.baseline}; migrated ${receipt.serviceWorkerDifference.migrated}; masked: ${String(receipt.serviceWorkerDifference.masked)}
- Console-error inventory (exact, whole journey, per lane) — baseline: ${inventoryLine('baseline')}; migrated: ${inventoryLine('migrated')}
- Failed-request inventory (exact, whole journey, per lane) — baseline: ${failedRequestLine('baseline')}; migrated: ${failedRequestLine('migrated')}
- Worker-script trace: the application attempts registration ${WITNESS_REACT_HOSPITALRUN_REGISTRATION_ATTEMPTS}x per journey in both lanes and every attempt is refused; the baseline's ${swAnswer('baseline')} against the migrated build's ${swAnswer('migrated')}
- Retained but never-controlling worker output: ${emitted.length === 0 ? 'none' : uniqueSorted(emitted).join(', ')}
- Mutation proof: \`${receipt.mutation.seam}\` in \`${receipt.mutation.path}\` at offset ${receipt.mutation.offset} made the journey red, byte-identical restoration made it green again
- Scroll: ${receipt.scrollSurface.state} on ${receipt.scrollSurface.route} — scrollHeight ${receipt.scrollSurface.scrollHeight} against clientHeight ${receipt.scrollSurface.clientHeight} at ${receipt.scrollSurface.viewport.width}x${receipt.scrollSurface.viewport.height}
- React lineage readiness: unchanged at ${receipt.readiness.reactLineage.ready}/${receipt.readiness.reactLineage.total}; this vertical is not counted

${receipt.nonclaims.map((claim) => `- ${claim}`).join('\n')}
`;
}

export function witnessReactHospitalrunAggregateMember(digestValue: string) {
	return {
		id: 'witness-react-hospitalrun',
		framework: 'react',
		track: 'production-readiness-direct-witness-create-react-app-to-vite8',
		bundler: 'webpack-4.42.0-to-vite-8.0.16',
		runtime: 'node-12.14.1-to-node-24.15.0',
		result: 'pass',
		receipt: WITNESS_REACT_HOSPITALRUN_RECEIPT_PATH,
		digest: digestValue,
	};
}

export async function verifyWitnessReactHospitalrunEvidence(rootDir = '.') {
	const root = resolve(rootDir);
	const receiptPath = join(root, WITNESS_REACT_HOSPITALRUN_RECEIPT_PATH);
	const receipt = parseWitnessReactHospitalrunReceipt(
		JSON.parse(await readFile(receiptPath, 'utf8')),
	);
	const canonicalBytes = await readFile(join(root, receipt.canonicalReceipt.path));
	if (sha256(canonicalBytes) !== receipt.canonicalReceipt.sha256)
		throw new Error('React HospitalRun canonical receipt bytes drifted');
	const canonical = JSON.parse(canonicalBytes.toString('utf8')) as {
		runId?: unknown;
		fixture?: unknown;
		integrity?: { canonicalDigest?: unknown };
	};
	if (
		canonical.runId !== REACT_HOSPITALRUN_RUN_ID ||
		canonical.fixture !== REACT_HOSPITALRUN_FIXTURE ||
		canonical.integrity?.canonicalDigest !== receipt.canonicalReceipt.canonicalDigest
	)
		throw new Error('React HospitalRun canonical receipt identity differs');
	if (
		(await readFile(join(dirname(receiptPath), 'receipt.md'), 'utf8')) !==
		renderWitnessReactHospitalrunReceipt(receipt)
	)
		throw new Error('React HospitalRun human Witness receipt differs');
	return {
		valid: true as const,
		digest: receipt.integrity.canonicalDigest,
		artifacts: 0,
		receipt,
	};
}
