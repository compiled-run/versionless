import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'pathe';
import { canonicalize, sha256 } from './canonicalize.ts';
import { WITNESS_CANCELLED_DUPLICATE_FETCH_RULE } from './witness-real-app.ts';
import type {
	WitnessCancelledDuplicateFetchCategoryEntry,
	WitnessCancelledDuplicateFetchInventory,
	WitnessConsoleErrorInventory,
	WitnessConsoleErrorInventoryEntry,
	WitnessFailedRequestInventory,
	WitnessFailedRequestInventoryEntry,
	WitnessMeasuredScrollAbsence,
	WitnessRealAppRun,
} from './witness-real-app.ts';

export const WITNESS_ANGULAR_FACTORIOLAB_SCHEMA =
	'versionless.witness-angular-factoriolab.v1' as const;
export const WITNESS_ANGULAR_FACTORIOLAB_RECEIPT_PATH =
	'evidence/runs/witness-angular-factoriolab/receipt.json' as const;
export const ANGULAR_FACTORIOLAB_FIXTURE = 'angular-factoriolab' as const;

/**
 * The immutable factoriolab source identity, bound here so the browser proof
 * cannot silently rebind itself to a different revision or archive. The
 * revision is a bare commit sha: no tag was pinned upstream, and none is
 * claimed.
 */
export const ANGULAR_FACTORIOLAB_SOURCE = Object.freeze({
	repository: 'https://github.com/factoriolab/factoriolab',
	ref: 'none — a bare commit sha was pinned; no tag was requested or relied on',
	revision: '5f54abbdcac518d8ebf7e136c4348384d9b1a2bb',
	rootTreeSha: 'b366ea0d6183d83e175aaa52e3620562c46321b8',
	archiveSha256: '11f2ce939f4be04b11e77b7f12e13d7449bf944b9bfefbeca237c46dea12f7ed',
	archiveBytes: 267218,
	license: 'MIT',
	licenseSha256: 'd2556dbacc2d52cdda0e8b3ebd15b0492d34028074768b3683815540d17e71af',
});

/**
 * The three build-lane receipts this browser proof stands on, each bound by the
 * digest it declares for itself and by the sha256 of its exact bytes, so the
 * proof cannot be re-pointed at a rebuilt or edited build receipt.
 */
export const ANGULAR_FACTORIOLAB_CANONICAL_RECEIPTS = Object.freeze([
	Object.freeze({
		path: 'evidence/runs/angular-factoriolab/m2-era-baseline.json',
		schemaVersion: 'versionless.angular-factoriolab-era-baseline.v1',
		digest: '4459a44f2ab0527e7d79fab82a33149236d041db23f35b595425b422e0c8a48d',
		sha256: '5252a8fbb30b6e91891d2bf1868908141f3d0eb82d984a95f2d465250f96eaa6',
	}),
	Object.freeze({
		path: 'evidence/runs/angular-factoriolab/m2-migrated-build.json',
		schemaVersion: 'versionless.angular-factoriolab-migrated-build.v1',
		digest: '371649fc4e032bd1e99372ac7afa6f54642b061d0300e37f6603e2e5880cfd65',
		sha256: '600a8ea3e6fa95be1b83d33b18a89dac5f7938bcc0bd9ce7fcd10e828d56d170',
	}),
	Object.freeze({
		path: 'evidence/runs/angular-factoriolab/m2-build-parity.json',
		schemaVersion: 'versionless.angular-factoriolab-build-parity.v1',
		digest: '4430f24ba6af8d7fd6d90faa0d4eb2fb275aab717cb9edd345f4a8ab6eb8957d',
		sha256: '60b6ebea6936ccb2655df99b435f06be83e11c09fa2cca33ce387aa03207eded',
	}),
]);

/**
 * Exact console-error inventory, per lane, for the whole journey — both
 * document loads, every route and every interaction.
 *
 * Both inventories are empty because both lanes are genuinely silent: the
 * application registers no service worker, requests nothing but its own local
 * assets, and logs no error in either build. An empty inventory is not an
 * allowance — it is the strictest possible one. The mechanism that checks it is
 * the same non-masking accounting used elsewhere: any console error at all
 * lands outside the inventory and fails the run.
 */
export const WITNESS_ANGULAR_FACTORIOLAB_CONSOLE_ERRORS = Object.freeze({
	baseline: Object.freeze([]),
	migrated: Object.freeze([]),
}) as Readonly<Record<'baseline' | 'migrated', readonly WitnessConsoleErrorInventoryEntry[]>>;

/**
 * Exact failed-request inventory, per lane, held to the same discipline and
 * empty for the same reason: neither lane leaves a single request the browser
 * failed. The application's one non-loopback seam — the Google Analytics tag in
 * `index.html` — is answered inside the browser context by the harness, so it
 * never becomes a failure and never becomes a successful non-loopback request
 * either.
 */
export const WITNESS_ANGULAR_FACTORIOLAB_FAILED_REQUESTS = Object.freeze({
	baseline: Object.freeze([]),
	migrated: Object.freeze([]),
}) as Readonly<Record<'baseline' | 'migrated', readonly WitnessFailedRequestInventoryEntry[]>>;

/**
 * The one asset in this application the browser is permitted to cancel a
 * duplicate fetch of, in either lane.
 *
 * The behavior was measured, not assumed. Every `lab-icon` the application
 * renders — hundreds of them across the item picker and the production table —
 * points its `<img>` at the same 1x1 `assets/transparent.gif` and positions a
 * sprite sheet behind it. The bounded static origin answers with
 * `cache-control: no-store`, and Angular re-renders the icon set when the
 * bundled dataset resolves during bootstrap. The browser therefore has an
 * in-flight fetch of that gif and a fresh identical one at the same moment, and
 * it cancels one of them with `net::ERR_ABORTED` — in roughly one bootstrap in
 * three, which is exactly the shape of a race rather than of a broken asset.
 *
 * Membership is pinned by path, method and reason and carries no count, because
 * the count is the race. Admission is not membership: the generic mechanism
 * additionally requires this run's own ledger to show the same page fetching
 * the same path successfully, and every instance it admits is recorded in the
 * run with the corroboration that admitted it.
 */
export const WITNESS_ANGULAR_FACTORIOLAB_CANCELLED_DUPLICATE_FETCHES = Object.freeze({
	baseline: Object.freeze([
		Object.freeze({
			method: 'GET',
			path: '/assets/transparent.gif',
			reason: 'net::ERR_ABORTED',
		}),
	]),
	migrated: Object.freeze([
		Object.freeze({
			method: 'GET',
			path: '/assets/transparent.gif',
			reason: 'net::ERR_ABORTED',
		}),
	]),
}) as Readonly<
	Record<'baseline' | 'migrated', readonly WitnessCancelledDuplicateFetchCategoryEntry[]>
>;

/**
 * Neither build ships or registers a service worker, and the browser context
 * allowed them to. Recording that the context permitted registration is the
 * point: zero workers here is the application's own behavior, not a policy the
 * harness imposed to make the number come out right.
 */
export const WITNESS_ANGULAR_FACTORIOLAB_SERVICE_WORKER = Object.freeze({
	state: 'no-service-worker-in-either-lane',
	contextPolicy: 'registration-allowed-and-never-attempted',
	applicationRegisterCalls: 0,
	emittedWorkerScriptsInEitherLane: 0,
	registrationsInEitherLane: 0,
	controllerInEitherLane: null,
	cacheStorageNamesInEitherLane: 0,
	masked: false,
});

/**
 * The exact route sequence the journey drives, in order, after the initial
 * document load.
 *
 * factoriolab encodes the whole production plan into the URL fragment, so these
 * are not decorative paths: each one is the application serializing the state
 * the previous interaction produced. Pinning the sequence is what makes a
 * dropped state push, a silently reordered fragment, or a lost plan on reload
 * fail the run.
 */
export const WITNESS_ANGULAR_FACTORIOLAB_ROUTES = Object.freeze([
	'/list#p=iron-plate*1',
	'/list#p=iron-plate*10',
	'/list#p=iron-plate*10&s=*************3600',
	'/flow#p=iron-plate*10&s=*************3600',
	'/list#p=iron-plate*10&s=*************3600',
	'/list#p=iron-plate*10&s=*************3600',
	'/list#p=iron-plate*10&s=*************3600',
]);

/**
 * Deterministic tracked-event floor.
 *
 * The clicked, typed, changed and keyed counts are produced by the journey's
 * own gestures and are identical in every lane and pass, so they are pinned
 * exactly. Incidental `mouseover` events depend on the pointer path the driver
 * takes between the genuine hovers, so that count is bounded from below by
 * those hovers rather than pinned to an unstable number. The bound is checked,
 * not erased.
 */
export const WITNESS_ANGULAR_FACTORIOLAB_TRACKED_EVENTS = Object.freeze({
	change: 3,
	click: 12,
	input: 21,
	keydown: 22,
	mouseoverAtLeast: 2,
});

export type WitnessAngularFactoriolabCheckpoint = {
	phase: 'before-interactions' | 'after-interactions' | 'after-online-reload';
	state: 'timeout';
	registrations: 0;
	controller: null;
	cacheNames: [];
	workerEvents: [];
};

/**
 * Runtime zero-service-worker observation for a build that ships no worker at
 * all. Unlike the applications that emit one and never register it, there is
 * nothing retained to record here: `outputFiles` and `requests` must both be
 * empty, because a single worker script in the served inventory or a single
 * worker-scoped request would mean the claim is wrong.
 */
export type WitnessAngularFactoriolabZeroServiceWorker = {
	checkpoints: WitnessAngularFactoriolabCheckpoint[];
	outputFiles: [];
	requests: [];
	workerEvents: [];
};

export type WitnessAngularFactoriolabRun = WitnessRealAppRun & {
	zeroServiceWorker: WitnessAngularFactoriolabZeroServiceWorker;
	consoleErrorInventory: WitnessConsoleErrorInventory;
	failedRequestInventory: WitnessFailedRequestInventory;
	cancelledDuplicateFetches: WitnessCancelledDuplicateFetchInventory;
	scrollAbsence: WitnessMeasuredScrollAbsence;
	behaviorDigest: string;
};

export type WitnessAngularFactoriolabMutation = {
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

export type WitnessAngularFactoriolabReceipt = {
	schemaVersion: typeof WITNESS_ANGULAR_FACTORIOLAB_SCHEMA;
	result: 'pass';
	fixture: typeof ANGULAR_FACTORIOLAB_FIXTURE;
	source: typeof ANGULAR_FACTORIOLAB_SOURCE;
	provenance: Record<string, unknown>;
	canonicalReceipts: Array<{
		path: string;
		schemaVersion: string;
		digest: string;
		sha256: string;
	}>;
	runs: WitnessAngularFactoriolabRun[];
	mutation: WitnessAngularFactoriolabMutation;
	serviceWorker: typeof WITNESS_ANGULAR_FACTORIOLAB_SERVICE_WORKER;
	consoleErrors: Readonly<
		Record<'baseline' | 'migrated', readonly WitnessConsoleErrorInventoryEntry[]>
	>;
	failedRequests: Readonly<
		Record<'baseline' | 'migrated', readonly WitnessFailedRequestInventoryEntry[]>
	>;
	/**
	 * The cancelled-duplicate-fetch category this vertical declares, the rule
	 * that admits a member, and every instance the four published runs actually
	 * observed — recorded per run and per lane rather than summarized, because
	 * whether a given bootstrap raced is itself the evidence.
	 */
	cancelledDuplicateFetches: {
		category: Readonly<
			Record<'baseline' | 'migrated', readonly WitnessCancelledDuplicateFetchCategoryEntry[]>
		>;
		corroborationRule: typeof WITNESS_CANCELLED_DUPLICATE_FETCH_RULE;
		instances: Array<{
			lane: 'baseline' | 'migrated';
			pass: 1 | 2;
			observed: WitnessCancelledDuplicateFetchInventory['observed'];
			absent: WitnessCancelledDuplicateFetchInventory['absent'];
			admitted: number;
		}>;
	};
	scrollAbsence: WitnessMeasuredScrollAbsence;
	buildLanes: {
		baseline: { angular: string; builder: string; node: string; distFiles: 42 };
		migrated: { angular: string; builder: string; node: string; distFiles: 39 };
	};
	persistence: {
		plan: 'url-fragment-encoded';
		preferences: 'browser-local-storage';
		backend: 'none';
		stubbed: false;
		survivesOnlineReload: true;
	};
	readiness: {
		angularLineage: { ready: 1; total: 4; counted: false };
		overall: { ready: 3; total: 12 };
	};
	locality: { mode: 'offline'; successfulNonLoopback: 0; osWideIsolation: false };
	nonclaims: string[];
	integrity: { algorithm: 'sha256'; canonicalDigest: string };
};

const exact = (left: unknown, right: unknown): boolean =>
	canonicalize(left) === canonicalize(right);

export function witnessAngularFactoriolabRawDigest(
	run: WitnessAngularFactoriolabRun | WitnessRealAppRun,
): string {
	const { pass: _pass, result: _result, semanticDigest: _semanticDigest, ...raw } = run;
	const withoutBehavior = { ...raw } as Record<string, unknown>;
	delete withoutBehavior.behaviorDigest;
	return sha256(canonicalize(withoutBehavior));
}

function trackedEventProjection(run: WitnessRealAppRun): Record<string, unknown> {
	const counts = run.witnessRecord.trackedEventCounts;
	const mouseover = counts.mouseover ?? 0;
	if (
		counts.change !== WITNESS_ANGULAR_FACTORIOLAB_TRACKED_EVENTS.change ||
		counts.click !== WITNESS_ANGULAR_FACTORIOLAB_TRACKED_EVENTS.click ||
		counts.input !== WITNESS_ANGULAR_FACTORIOLAB_TRACKED_EVENTS.input ||
		counts.keydown !== WITNESS_ANGULAR_FACTORIOLAB_TRACKED_EVENTS.keydown ||
		mouseover < WITNESS_ANGULAR_FACTORIOLAB_TRACKED_EVENTS.mouseoverAtLeast ||
		Object.keys(counts).sort().join(',') !== 'change,click,input,keydown,mouseover'
	)
		throw new Error('Angular factoriolab tracked browser events differ');
	return {
		change: counts.change,
		click: counts.click,
		input: counts.input,
		keydown: counts.keydown,
		mouseover: `at-least-${WITNESS_ANGULAR_FACTORIOLAB_TRACKED_EVENTS.mouseoverAtLeast}-genuine-hovers`,
	};
}

/**
 * Lane-independent behavior projection.
 *
 * Production bytes are lane-specific by construction — the two builders hash
 * their output differently — so the byte inventory stays in the run record and
 * out of this digest. Everything the two lanes must agree on is in it: the same
 * gestures, the same assertions, the same URL-encoded route sequence, the same
 * empty error inventories, the same absent scroll surface, and the same zero
 * service-worker runtime.
 */
export function witnessAngularFactoriolabBehaviorDigest(
	run: WitnessAngularFactoriolabRun | WitnessRealAppRun,
): string {
	const zero = (run as WitnessAngularFactoriolabRun).zeroServiceWorker;
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
				serviceWorkerScripts: run.servedStatic.serviceWorkers.length,
			},
			zeroServiceWorker: {
				checkpoints: zero?.checkpoints,
				outputFiles: zero?.outputFiles,
				requests: zero?.requests,
				workerEvents: zero?.workerEvents,
			},
			// Both inventories are empty in both lanes, so unlike an application
			// whose lanes fail differently these participate whole rather than
			// only by shape: an error appearing in one lane must break parity.
			consoleErrorInventory: run.consoleErrorInventory,
			failedRequestInventory: run.failedRequestInventory,
			// The category, its rule and its membership must be identical in
			// every lane and pass, so they participate whole. The observed
			// instances deliberately do not: whether a given bootstrap lost the
			// race is browser scheduling, and folding it into a parity digest
			// would make the two lanes disagree about a fact that is not about
			// the framework hop at all. Nothing is lost — every instance is
			// recorded in the run and in the receipt, and the failed-request
			// inventory above still accounts exactly for everything else.
			cancelledDuplicateFetchCategory: {
				policy: run.cancelledDuplicateFetches?.policy,
				corroborationRule: run.cancelledDuplicateFetches?.corroborationRule,
				category: run.cancelledDuplicateFetches?.category,
				uncorroborated: run.cancelledDuplicateFetches?.uncorroborated,
			},
			scrollAbsence: run.scrollAbsence,
			successfulNonLoopback: run.successfulNonLoopback,
		}),
	);
}

export function witnessAngularFactoriolabDigest(receipt: WitnessAngularFactoriolabReceipt): string {
	const copy = structuredClone(receipt);
	copy.integrity.canonicalDigest = '';
	return sha256(canonicalize(copy));
}

function assertZeroServiceWorker(
	zero: WitnessAngularFactoriolabZeroServiceWorker | undefined,
	label: string,
): void {
	if (
		zero === undefined ||
		!exact(zero.outputFiles, []) ||
		!exact(zero.requests, []) ||
		!exact(zero.workerEvents, []) ||
		!Array.isArray(zero.checkpoints) ||
		zero.checkpoints.length !== 3 ||
		!exact(
			zero.checkpoints.map((checkpoint) => checkpoint.phase),
			['before-interactions', 'after-interactions', 'after-online-reload'],
		) ||
		zero.checkpoints.some(
			(checkpoint) =>
				checkpoint.state !== 'timeout' ||
				checkpoint.registrations !== 0 ||
				checkpoint.controller !== null ||
				checkpoint.cacheNames.length !== 0 ||
				checkpoint.workerEvents.length !== 0,
		)
	)
		throw new Error(`Angular factoriolab zero-service-worker evidence differs: ${label}`);
}

function assertConsoleErrorInventory(
	inventory: WitnessConsoleErrorInventory | undefined,
	lane: 'baseline' | 'migrated',
	label: string,
): void {
	const pinned = WITNESS_ANGULAR_FACTORIOLAB_CONSOLE_ERRORS[lane].map((entry) => ({
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
		throw new Error(`Angular factoriolab console-error inventory differs: ${label}`);
}

function assertFailedRequestInventory(
	inventory: WitnessFailedRequestInventory | undefined,
	lane: 'baseline' | 'migrated',
	label: string,
): void {
	const pinned = WITNESS_ANGULAR_FACTORIOLAB_FAILED_REQUESTS[lane].map((entry) => ({
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
		throw new Error(`Angular factoriolab failed-request inventory differs: ${label}`);
}

/**
 * The cancelled-duplicate-fetch category, checked as an accounting mechanism
 * rather than as a label.
 *
 * The declared membership must be exactly the pinned one, the rule carried in
 * the run must be the exact generic rule, and nothing may sit in
 * `uncorroborated`. Every observed instance must name a member of the category,
 * must have been cancelled at least once, and must carry at least one
 * corroborating successful fetch with a 2xx status — an instance recording zero
 * successes is precisely the case the rule refuses, so it fails here too.
 * Every member is accounted for: each one is either observed or explicitly
 * absent, never silently missing.
 */
function assertCancelledDuplicateFetches(
	inventory: WitnessCancelledDuplicateFetchInventory | undefined,
	lane: 'baseline' | 'migrated',
	label: string,
): void {
	const pinned = WITNESS_ANGULAR_FACTORIOLAB_CANCELLED_DUPLICATE_FETCHES[lane].map((entry) => ({
		method: entry.method,
		path: entry.path,
		reason: entry.reason,
	}));
	const named = (entry: WitnessCancelledDuplicateFetchCategoryEntry): boolean =>
		pinned.some(
			(member) =>
				member.method === entry.method &&
				member.path === entry.path &&
				member.reason === entry.reason,
		);
	if (
		inventory === undefined ||
		inventory.policy !== 'corroborated-browser-cancelled-duplicate-fetch' ||
		inventory.corroborationRule !== WITNESS_CANCELLED_DUPLICATE_FETCH_RULE ||
		!exact(inventory.category, pinned) ||
		!exact(inventory.uncorroborated, []) ||
		!Array.isArray(inventory.observed) ||
		!Array.isArray(inventory.absent) ||
		inventory.observed.length + inventory.absent.length !== pinned.length ||
		inventory.observed.some(
			(instance) =>
				!named(instance) ||
				instance.cancelled < 1 ||
				instance.corroboratingSuccesses < 1 ||
				instance.corroboratingStatuses.length === 0 ||
				instance.corroboratingStatuses.some((status) => status < 200 || status >= 300),
		) ||
		inventory.absent.some((entry) => !named(entry)) ||
		inventory.admitted !==
			inventory.observed.reduce((sum, instance) => sum + instance.cancelled, 0)
	)
		throw new Error(`Angular factoriolab cancelled-duplicate-fetch category differs: ${label}`);
}

/**
 * The scroll claim this vertical does not make, checked as strictly as one it
 * would: every visited route must be present, and every one of them must have
 * measured a document that does not overflow. A route whose `scrollHeight`
 * exceeded its `clientHeight` would mean a scroll surface existed and went
 * unexercised, which fails rather than passes quietly.
 */
function assertScrollAbsence(
	absence: WitnessMeasuredScrollAbsence | undefined,
	label: string,
): void {
	if (
		absence === undefined ||
		absence.state !== 'measured-no-overflowing-document' ||
		absence.claimed !== false ||
		absence.viewport.width !== 1280 ||
		absence.viewport.height !== 720 ||
		absence.documentOverflow.length === 0 ||
		!Array.isArray(absence.routes) ||
		absence.routes.length < 3 ||
		absence.routes.some(
			(route) =>
				route.route.length === 0 ||
				route.clientHeight !== 720 ||
				route.scrollHeight > route.clientHeight,
		)
	)
		throw new Error(`Angular factoriolab scroll-absence measurement differs: ${label}`);
}

/**
 * The receipt-level roll-up must reproduce the runs it summarizes exactly: one
 * entry per published run, each carrying that run's own observed and absent
 * members and its own admitted count. A summary that disagreed with the runs
 * would let a reader see a quieter story than the evidence tells.
 */
function assertCancelledDuplicateFetchRollup(receipt: WitnessAngularFactoriolabReceipt): void {
	const rollup = receipt.cancelledDuplicateFetches;
	if (
		rollup === undefined ||
		rollup.corroborationRule !== WITNESS_CANCELLED_DUPLICATE_FETCH_RULE ||
		!exact(rollup.category, WITNESS_ANGULAR_FACTORIOLAB_CANCELLED_DUPLICATE_FETCHES) ||
		!Array.isArray(rollup.instances) ||
		rollup.instances.length !== receipt.runs.length ||
		rollup.instances.some((instance, index) => {
			const run = receipt.runs[index];
			return (
				run === undefined ||
				instance.lane !== run.lane ||
				instance.pass !== run.pass ||
				!exact(instance.observed, run.cancelledDuplicateFetches?.observed) ||
				!exact(instance.absent, run.cancelledDuplicateFetches?.absent) ||
				instance.admitted !== run.cancelledDuplicateFetches?.admitted
			);
		})
	)
		throw new Error('Angular factoriolab cancelled-duplicate-fetch roll-up differs');
}

export function parseWitnessAngularFactoriolabReceipt(
	value: unknown,
): WitnessAngularFactoriolabReceipt {
	if (value === null || typeof value !== 'object' || Array.isArray(value))
		throw new Error('Angular factoriolab Witness receipt must be an object');
	const receipt = value as WitnessAngularFactoriolabReceipt;
	const expectedRuns = new Set(['baseline:1', 'baseline:2', 'migrated:1', 'migrated:2']);
	const behaviors = new Set<string>();
	if (
		receipt.schemaVersion !== WITNESS_ANGULAR_FACTORIOLAB_SCHEMA ||
		receipt.result !== 'pass' ||
		receipt.fixture !== ANGULAR_FACTORIOLAB_FIXTURE ||
		!exact(receipt.source, ANGULAR_FACTORIOLAB_SOURCE) ||
		!Array.isArray(receipt.canonicalReceipts) ||
		receipt.canonicalReceipts.length !== ANGULAR_FACTORIOLAB_CANONICAL_RECEIPTS.length ||
		receipt.canonicalReceipts.some((bound, index) => {
			const pinned = ANGULAR_FACTORIOLAB_CANONICAL_RECEIPTS[index];
			return (
				pinned === undefined ||
				bound.path !== pinned.path ||
				bound.schemaVersion !== pinned.schemaVersion ||
				bound.digest !== pinned.digest ||
				bound.sha256 !== pinned.sha256
			);
		}) ||
		!Array.isArray(receipt.runs) ||
		receipt.runs.length !== 4
	)
		throw new Error('Angular factoriolab Witness binding differs');
	for (const run of receipt.runs) {
		const key = `${run.lane}:${run.pass}`;
		if (
			!expectedRuns.delete(key) ||
			run.app !== 'angular-factoriolab' ||
			run.framework !== 'angular' ||
			run.result !== 'pass' ||
			run.cleanPage !== true ||
			run.successfulNonLoopback !== 0 ||
			run.witnessRecord.pageErrors !== 0 ||
			run.witnessRecord.consoleErrors !== 0 ||
			run.witnessRecord.failedRequests !== 0 ||
			run.offlineEvidence.state !== 'not-applicable' ||
			run.observerFinalization.workerEvents.length !== 0 ||
			run.servedStatic.serviceWorkers.length !== 0 ||
			run.servedStatic.byteIdentical !== true ||
			run.scrollSurface !== undefined ||
			run.interactions.length === 0 ||
			[...new Set(run.interactions.map((interaction) => interaction.kind))]
				.sort()
				.join(',') !== 'click,hover,press,type' ||
			run.semanticDigest !== witnessAngularFactoriolabRawDigest(run) ||
			run.behaviorDigest !== witnessAngularFactoriolabBehaviorDigest(run) ||
			!exact(run.routes, WITNESS_ANGULAR_FACTORIOLAB_ROUTES)
		)
			throw new Error(`Angular factoriolab Witness run differs: ${key}`);
		assertZeroServiceWorker(run.zeroServiceWorker, key);
		assertConsoleErrorInventory(run.consoleErrorInventory, run.lane, key);
		assertFailedRequestInventory(run.failedRequestInventory, run.lane, key);
		assertCancelledDuplicateFetches(run.cancelledDuplicateFetches, run.lane, key);
		assertScrollAbsence(run.scrollAbsence, key);
		behaviors.add(run.behaviorDigest);
	}
	assertScrollAbsence(receipt.scrollAbsence, 'receipt');
	assertCancelledDuplicateFetchRollup(receipt);
	if (
		expectedRuns.size !== 0 ||
		behaviors.size !== 1 ||
		!exact(receipt.consoleErrors, WITNESS_ANGULAR_FACTORIOLAB_CONSOLE_ERRORS) ||
		!exact(receipt.failedRequests, WITNESS_ANGULAR_FACTORIOLAB_FAILED_REQUESTS) ||
		!exact(receipt.serviceWorker, WITNESS_ANGULAR_FACTORIOLAB_SERVICE_WORKER) ||
		receipt.buildLanes?.baseline?.distFiles !== 42 ||
		receipt.buildLanes.migrated?.distFiles !== 39 ||
		!exact(receipt.persistence, {
			plan: 'url-fragment-encoded',
			preferences: 'browser-local-storage',
			backend: 'none',
			stubbed: false,
			survivesOnlineReload: true,
		}) ||
		receipt.mutation?.intendedFailure !== true ||
		receipt.mutation.failure !== 'witness-semantic-assertion' ||
		receipt.mutation.lane !== 'migrated' ||
		receipt.mutation.seam.length === 0 ||
		receipt.mutation.restoredByteIdentically !== true ||
		receipt.mutation.restoredRun !== 'pass' ||
		receipt.mutation.beforeSha256 !== receipt.mutation.afterRestoreSha256 ||
		receipt.mutation.beforeSha256 === receipt.mutation.mutatedSha256 ||
		!behaviors.has(receipt.mutation.restoredBehaviorDigest) ||
		!exact(receipt.readiness, {
			angularLineage: { ready: 1, total: 4, counted: false },
			overall: { ready: 3, total: 12 },
		}) ||
		receipt.locality?.mode !== 'offline' ||
		receipt.locality.successfulNonLoopback !== 0 ||
		receipt.locality.osWideIsolation !== false ||
		!Array.isArray(receipt.nonclaims) ||
		receipt.nonclaims.length === 0 ||
		receipt.integrity?.algorithm !== 'sha256' ||
		receipt.integrity.canonicalDigest !== witnessAngularFactoriolabDigest(receipt)
	)
		throw new Error('Angular factoriolab Witness integrity differs');
	return receipt;
}

export function renderWitnessAngularFactoriolabReceipt(
	receipt: WitnessAngularFactoriolabReceipt,
): string {
	const boundReceipts = receipt.canonicalReceipts
		.map((bound) => `\`${bound.path}\` (${bound.digest.slice(0, 12)})`)
		.join(', ');
	const routes = receipt.scrollAbsence.routes
		.map((route) => `${route.route} ${route.scrollHeight}/${route.clientHeight}`)
		.join(', ');
	const cancelledCategory = receipt.cancelledDuplicateFetches.category.migrated
		.map((entry) => `${entry.method} ${entry.path} (${entry.reason})`)
		.join(', ');
	const cancelledInstances = receipt.cancelledDuplicateFetches.instances
		.map(
			(instance) =>
				`${instance.lane} pass ${instance.pass}: ${
					instance.observed.length === 0
						? 'no cancellation observed'
						: instance.observed
								.map(
									(observedInstance) =>
										`${observedInstance.cancelled} cancelled ${observedInstance.path}, corroborated by ${observedInstance.corroboratingSuccesses} successful fetch(es) with status ${observedInstance.corroboratingStatuses.join('/')}`,
								)
								.join('; ')
				}`,
		)
		.join(' | ');
	return `# factoriolab @5f54abb — direct Witness browser proof

- Result: pass
- Canonical SHA-256: ${receipt.integrity.canonicalDigest}
- Runs: 2 baseline + 2 migrated production-static browser journeys
- Behavioral parity: ${receipt.runs[0]!.behaviorDigest}
- Build lanes: era ${receipt.buildLanes.baseline.angular} / ${receipt.buildLanes.baseline.builder} on ${receipt.buildLanes.baseline.node} (${receipt.buildLanes.baseline.distFiles} files) against migrated ${receipt.buildLanes.migrated.angular} / ${receipt.buildLanes.migrated.builder} on ${receipt.buildLanes.migrated.node} (${receipt.buildLanes.migrated.distFiles} files)
- Bound build receipts: ${boundReceipts}
- Journey: the era-pinned default production plan, an item swap through the icon picker with hovered tooltips, a typed output-rate edit the production table recomputes, a columns dialog that removes a column, the settings panel switching the display rate and saving a named state, the flow route, and an online reload the URL-encoded plan and the browser-local saved state both survive
- Persistence: plan ${receipt.persistence.plan}, preferences ${receipt.persistence.preferences}, backend ${receipt.persistence.backend}, stubbed: ${String(receipt.persistence.stubbed)}, survives an online reload: ${String(receipt.persistence.survivesOnlineReload)}
- Service worker: ${receipt.serviceWorker.state}; the context allowed registration and the application never attempted one, so zero registrations, controller, CacheStorage names and worker requests at three checkpoints in every pass
- Console-error inventory (exact, whole journey, per lane): empty in both lanes — both builds are genuinely silent, and any error at all fails the run
- Failed-request inventory (exact, whole journey, per lane): empty in both lanes, once the cancelled-duplicate category below has taken its own instances; every other failed request still fails the run
- Cancelled-duplicate-fetch category (both lanes): ${cancelledCategory} — pinned by path, method and browser reason, never by count. ${receipt.cancelledDuplicateFetches.corroborationRule}
- Cancelled-duplicate-fetch instances as published: ${cancelledInstances}
- Mutation proof: \`${receipt.mutation.seam}\` in \`${receipt.mutation.path}\` at offset ${receipt.mutation.offset} made the journey red, byte-identical restoration made it green again
- Scroll: ${receipt.scrollAbsence.state} — ${receipt.scrollAbsence.documentOverflow}; measured scrollHeight/clientHeight per visited route at ${receipt.scrollAbsence.viewport.width}x${receipt.scrollAbsence.viewport.height}: ${routes}
- Angular lineage readiness: unchanged at ${receipt.readiness.angularLineage.ready}/${receipt.readiness.angularLineage.total}; this vertical is not counted

${receipt.nonclaims.map((claim) => `- ${claim}`).join('\n')}
`;
}

export function witnessAngularFactoriolabAggregateMember(digestValue: string) {
	return {
		id: 'witness-angular-factoriolab',
		framework: 'angular',
		track: 'production-readiness-direct-witness-angular10-to-angular16-browser-builder',
		bundler: 'angular-cli-10.1-browser-builder-to-angular-16.2-browser-builder',
		runtime: 'node-12.14.1-to-node-16.20.2',
		result: 'pass',
		receipt: WITNESS_ANGULAR_FACTORIOLAB_RECEIPT_PATH,
		digest: digestValue,
	};
}

export async function verifyWitnessAngularFactoriolabEvidence(rootDir = '.') {
	const root = resolve(rootDir);
	const receiptPath = join(root, WITNESS_ANGULAR_FACTORIOLAB_RECEIPT_PATH);
	const receipt = parseWitnessAngularFactoriolabReceipt(
		JSON.parse(await readFile(receiptPath, 'utf8')),
	);
	for (const bound of receipt.canonicalReceipts) {
		const bytes = await readFile(join(root, bound.path));
		if (sha256(bytes) !== bound.sha256)
			throw new Error(`Angular factoriolab bound build receipt bytes drifted: ${bound.path}`);
		const parsed = JSON.parse(bytes.toString('utf8')) as {
			schemaVersion?: unknown;
			digest?: unknown;
		};
		if (parsed.schemaVersion !== bound.schemaVersion || parsed.digest !== bound.digest)
			throw new Error(
				`Angular factoriolab bound build receipt identity differs: ${bound.path}`,
			);
	}
	if (
		(await readFile(join(dirname(receiptPath), 'receipt.md'), 'utf8')) !==
		renderWitnessAngularFactoriolabReceipt(receipt)
	)
		throw new Error('Angular factoriolab human Witness receipt differs');
	return {
		valid: true as const,
		digest: receipt.integrity.canonicalDigest,
		artifacts: 0,
		receipt,
	};
}
