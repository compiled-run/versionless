import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'pathe';
import { canonicalize, sha256 } from './canonicalize.ts';
import {
	WITNESS_CANCELLED_DUPLICATE_FETCH_NON_LOOPBACK_SCOPE,
	WITNESS_CANCELLED_DUPLICATE_FETCH_RULE,
	WITNESS_NON_LOOPBACK_QUERY_FREE_PATH_RULE,
	WITNESS_REAL_APP_DRAG_SURFACES,
} from './witness-real-app.ts';
import type {
	WitnessCancelledDuplicateFetchCategoryEntry,
	WitnessCancelledDuplicateFetchInventory,
	WitnessConsoleErrorInventory,
	WitnessConsoleErrorInventoryEntry,
	WitnessFailedRequestInventory,
	WitnessFailedRequestInventoryEntry,
	WitnessMeasuredScrollAbsence,
	WitnessMockedNonLoopbackSeamEntry,
	WitnessMockedNonLoopbackSeamInventory,
	WitnessRealAppRun,
	WitnessRenderedStyleEvidence,
	WitnessRenderedStyleMeasurement,
} from './witness-real-app.ts';

export const WITNESS_ANGULAR_JIRA_CLONE_SCHEMA =
	'versionless.witness-angular-jira-clone.v1' as const;
export const WITNESS_ANGULAR_JIRA_CLONE_RECEIPT_PATH =
	'evidence/runs/witness-angular-jira-clone/receipt.json' as const;
export const ANGULAR_JIRA_CLONE_FIXTURE = 'angular-jira-clone' as const;

/**
 * The immutable jira-clone source identity, bound here so the browser proof
 * cannot silently rebind itself to a different revision or archive.
 *
 * The pin is a bare commit sha rather than the nearby `v2.0.0` tag, and the
 * reason is recorded rather than assumed: the tag's tree carries no LICENCE
 * file, and this commit — whose own subject line says so — restores it four
 * days later. Pinning the tag would name a revision that fails the licence
 * gate, so the sha is the pin.
 */
export const ANGULAR_JIRA_CLONE_SOURCE = Object.freeze({
	repository: 'https://github.com/trungvose/jira-clone-angular',
	ref: 'none — a bare commit sha was pinned; no tag was requested or relied on',
	revision: '059455b9933a236456524925065bce2c295e2d9a',
	rootTreeSha: 'd5a79170609bb7b135a4c146a4565b3e7d53a92b',
	archiveSha256: 'd913ad5d4686b6a236799166c7c781f624b3901a1826304e00c36eca82896bc5',
	archiveBytes: 8048993,
	license: 'MIT',
	licenseSha256: 'c45956b16a34a9e0c74a93163f497174e373623333e47ce3251b4d0107120b09',
});

/**
 * The four build-lane receipts this browser proof stands on, each bound both by
 * the digest it declares for itself and by the sha256 of its exact bytes, so
 * the proof cannot be re-pointed at a rebuilt or edited build receipt. The
 * source-migration receipt is bound alongside the three build receipts because
 * the migrated lane's bytes are the output of exactly that recorded changeset.
 */
export const ANGULAR_JIRA_CLONE_CANONICAL_RECEIPTS = Object.freeze([
	Object.freeze({
		path: 'evidence/runs/angular-jira-clone/mj3c-source-migration.json',
		schemaVersion: 'versionless.angular-jira-clone-source-migration.v3',
		digest: 'd522d6d7eab4a2b2b4a0937311acf784d842f906b44334a2adc280612dc09729',
		sha256: 'f0d681c93d28f1f6ae0eae2e4416eb67fbfe5693c090a306540802fb840bbdbc',
	}),
	Object.freeze({
		path: 'evidence/runs/angular-jira-clone/mj3c-era-baseline.json',
		schemaVersion: 'versionless.angular-jira-clone-era-baseline.v2',
		digest: 'be3c41771a49ee1de8bc366bf8641db7abaaf5f455c7615af51cf35915789b33',
		sha256: '3211963049e3d389830e6051bf5ee2e6b717ab45fb6f89736e9eaf9aa5449a39',
	}),
	Object.freeze({
		path: 'evidence/runs/angular-jira-clone/mj3c-migrated-build.json',
		schemaVersion: 'versionless.angular-jira-clone-migrated-build.v1',
		digest: 'c477d9294a2a582e21ebe162121aa3304dc0b41b1f0b0adaf58e40a43a8cd8ff',
		sha256: '15e3de51d4bdccafd183c1b0bfaec48b32d7511103a2a167ae0e2b497dda20fd',
	}),
	Object.freeze({
		path: 'evidence/runs/angular-jira-clone/mj3c-build-parity.json',
		schemaVersion: 'versionless.angular-jira-clone-build-parity.v1',
		digest: 'a52921a5e4507688220c6296afdbcb97665484701b3c0097e7f930766de72eb3',
		sha256: '7f5a6c49c5fec4eec52b2fb268d1aab3a659e28b0ae8a47a1dd97c8d92aea64f',
	}),
]);

/**
 * Exact console-error inventory, per lane, for the whole journey.
 *
 * Both inventories are empty. That is the strictest possible inventory, not an
 * allowance: the accounting mechanism is the same non-masking one used
 * elsewhere, so any console error at all lands outside the inventory and fails
 * the run.
 */
export const WITNESS_ANGULAR_JIRA_CLONE_CONSOLE_ERRORS = Object.freeze({
	baseline: Object.freeze([]),
	migrated: Object.freeze([]),
}) as Readonly<Record<'baseline' | 'migrated', readonly WitnessConsoleErrorInventoryEntry[]>>;

/**
 * Exact failed-request inventory, per lane, held to the same discipline and
 * empty for the same reason. The application's non-loopback seams are answered
 * inside the browser context, so they never become network failures, and the
 * one cancellation the journey does provoke is accounted for instance by
 * instance in the cancelled-duplicate category below rather than here.
 */
export const WITNESS_ANGULAR_JIRA_CLONE_FAILED_REQUESTS = Object.freeze({
	baseline: Object.freeze([]),
	migrated: Object.freeze([]),
}) as Readonly<Record<'baseline' | 'migrated', readonly WitnessFailedRequestInventoryEntry[]>>;

/**
 * Every seam this application reaches for outside the bounded loopback origin,
 * pinned query-free, per {@link WITNESS_NON_LOOPBACK_QUERY_FREE_PATH_RULE}.
 *
 * Eight endpoints: the analytics tag the production document loads, the six
 * distinct avatar images the seeded board renders, and the error-reporting
 * envelope the application's bootstrap opens. Each is answered by the harness
 * inside the browser context, so none of them leaves the machine and
 * `successfulNonLoopback` stays zero.
 *
 * Not one of these paths carries a query string, and that is a construction
 * rather than a coincidence: the analytics measurement id and the
 * error-reporting public key both live in the query of the requests the
 * application actually issues, and a published receipt has no business
 * carrying either. What identifies the seam is the endpoint, and the endpoint
 * is here in full.
 */
export const WITNESS_ANGULAR_JIRA_CLONE_MOCKED_SEAMS = Object.freeze({
	baseline: Object.freeze([
		Object.freeze({
			method: 'GET',
			path: 'https://www.googletagmanager.com/gtag/js',
		}),
		Object.freeze({
			method: 'GET',
			path: 'https://res.cloudinary.com/dvujyxh7e/image/upload/c_scale,w_256/v1593097745/angular-vietnam-transparent_iwfwxa.png',
		}),
		Object.freeze({
			method: 'GET',
			path: 'https://res.cloudinary.com/dvujyxh7e/image/upload/c_scale,w_48/v1592405731/spiderman_zlrtx0.jpg',
		}),
		Object.freeze({
			method: 'GET',
			path: 'https://res.cloudinary.com/dvujyxh7e/image/upload/c_scale,w_48/v1592405731/thor_juqwzf.jpg',
		}),
		Object.freeze({
			method: 'GET',
			path: 'https://res.cloudinary.com/dvujyxh7e/image/upload/c_scale,w_48/v1592405732/captain_e8s9nk.jpg',
		}),
		Object.freeze({
			method: 'GET',
			path: 'https://res.cloudinary.com/dvujyxh7e/image/upload/c_scale,w_48/v1592405732/ironman_c3jrbc.jpg',
		}),
		Object.freeze({
			method: 'GET',
			path: 'https://res.cloudinary.com/dvujyxh7e/image/upload/c_scale,w_48/v1593253478/trung-vo_bioxmc.png',
		}),
		Object.freeze({
			method: 'POST',
			path: 'https://o495789.ingest.sentry.io/api/5569161/envelope/',
		}),
	]),
	migrated: Object.freeze([
		Object.freeze({
			method: 'GET',
			path: 'https://www.googletagmanager.com/gtag/js',
		}),
		Object.freeze({
			method: 'GET',
			path: 'https://res.cloudinary.com/dvujyxh7e/image/upload/c_scale,w_256/v1593097745/angular-vietnam-transparent_iwfwxa.png',
		}),
		Object.freeze({
			method: 'GET',
			path: 'https://res.cloudinary.com/dvujyxh7e/image/upload/c_scale,w_48/v1592405731/spiderman_zlrtx0.jpg',
		}),
		Object.freeze({
			method: 'GET',
			path: 'https://res.cloudinary.com/dvujyxh7e/image/upload/c_scale,w_48/v1592405731/thor_juqwzf.jpg',
		}),
		Object.freeze({
			method: 'GET',
			path: 'https://res.cloudinary.com/dvujyxh7e/image/upload/c_scale,w_48/v1592405732/captain_e8s9nk.jpg',
		}),
		Object.freeze({
			method: 'GET',
			path: 'https://res.cloudinary.com/dvujyxh7e/image/upload/c_scale,w_48/v1592405732/ironman_c3jrbc.jpg',
		}),
		Object.freeze({
			method: 'GET',
			path: 'https://res.cloudinary.com/dvujyxh7e/image/upload/c_scale,w_48/v1593253478/trung-vo_bioxmc.png',
		}),
		Object.freeze({
			method: 'POST',
			path: 'https://o495789.ingest.sentry.io/api/5569161/envelope/',
		}),
	]),
}) as Readonly<Record<'baseline' | 'migrated', readonly WitnessMockedNonLoopbackSeamEntry[]>>;

/**
 * The one request in this application the browser is permitted to cancel a
 * duplicate of, in either lane.
 *
 * The behavior was measured, not assumed. The journey's final gesture is an
 * online reload, and the reload tears down a page that has an error-reporting
 * envelope still in flight; the browser cancels it with `net::ERR_ABORTED`.
 * Whether it does so depends on how far that request got before the navigation
 * committed, which is load timing, so what is pinned is the identity of the
 * request that may be cancelled and never a count.
 *
 * This is the same category the corpus already uses for a same-origin asset a
 * page raced itself for, applied unchanged to a seam the harness answers
 * in-context: admission still requires this run's own ledger to show the same
 * page issuing the same method and path and receiving a 2xx answer, which the
 * same page did twice before the reload. The member is pinned query-free, so
 * the record cannot encode the account the report was addressed to.
 */
export const WITNESS_ANGULAR_JIRA_CLONE_CANCELLED_DUPLICATE_FETCHES = Object.freeze({
	baseline: Object.freeze([
		Object.freeze({
			method: 'POST',
			path: 'https://o495789.ingest.sentry.io/api/5569161/envelope/',
			reason: 'net::ERR_ABORTED',
		}),
	]),
	migrated: Object.freeze([
		Object.freeze({
			method: 'POST',
			path: 'https://o495789.ingest.sentry.io/api/5569161/envelope/',
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
export const WITNESS_ANGULAR_JIRA_CLONE_SERVICE_WORKER = Object.freeze({
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
 * The two distinct routes the journey ever occupies, in the order it first
 * reaches them.
 *
 * The application redirects its root to the board and then never leaves it —
 * opening an issue, editing its title, creating an issue and filtering the
 * board are all modal or in-place surfaces that change no URL. Pinning the
 * distinct sequence rather than a literal array is what lets the reload at the
 * end of the journey re-record the board route without weakening the claim:
 * the verifier requires the first navigation to be the root, every later one to
 * be the board, and nothing else to appear at all. A modal that started pushing
 * a route, or an interaction that navigated away, fails here.
 */
export const WITNESS_ANGULAR_JIRA_CLONE_ROUTES = Object.freeze(['/', '/project/board']);

/**
 * The filter term the journey types and the exact per-column issue counts the
 * board narrows to while it is typed.
 *
 * The board has four columns, and the seeded issue that matches is in the
 * first, so the narrowed shape is one row and three empty columns. Widening is
 * a full clear gesture — select-all then Backspace — because a single Backspace
 * does not widen anything: the remaining prefix still matches, which is the
 * application behaving correctly and a weaker assertion pretending otherwise.
 */
export const WITNESS_ANGULAR_JIRA_CLONE_FILTER_TERM = 'Witness' as const;
export const WITNESS_ANGULAR_JIRA_CLONE_FILTER_NARROWED = Object.freeze([1, 0, 0, 0]);

/** The rendered tooltip text the journey hovers the seeded assignee avatar for. */
export const WITNESS_ANGULAR_JIRA_CLONE_TOOLTIP = 'Assignee: Trung Vo' as const;

/**
 * How many rendered-appearance probes the journey takes in each lane.
 *
 * The number is load-bearing rather than decorative. The migration replaced the
 * library's narrow per-component style entry points with its single aggregate
 * stylesheet, because the packaged exports map offers no narrow equivalent —
 * a declared difference in shipped bytes. The only honest way to say that
 * difference is invisible is to measure resolved appearance on laid-out
 * elements in both lanes and require the measurements to be identical, which
 * the behavior digest below then enforces.
 */
export const WITNESS_ANGULAR_JIRA_CLONE_STYLE_PROBES = 7 as const;

export type WitnessAngularJiraCloneCheckpoint = {
	phase: 'before-interactions' | 'after-interactions' | 'after-online-reload';
	state: 'timeout';
	registrations: 0;
	controller: null;
	cacheNames: [];
	workerEvents: [];
};

/**
 * Runtime zero-service-worker observation for a build that ships no worker at
 * all: `outputFiles` and `requests` must both be empty, because a single worker
 * script in the served inventory or a single worker-scoped request would mean
 * the claim is wrong.
 */
export type WitnessAngularJiraCloneZeroServiceWorker = {
	checkpoints: WitnessAngularJiraCloneCheckpoint[];
	outputFiles: [];
	requests: [];
	workerEvents: [];
};

/** One board column as the page rendered it, in the order its issues appear. */
export type WitnessAngularJiraCloneColumn = { column: string; issues: string[] };

/**
 * The settled result of a genuine pointer drag across the board.
 *
 * The gesture is a real pointer press, a real move and a real release, and what
 * is asserted is not that the gesture happened but that the application's own
 * state changed because of it: the moved issue leaves the column it was in and
 * appears in the target column at the target index, and the whole board is
 * recorded before and after so a reader can see the move rather than take it.
 */
export type WitnessAngularJiraCloneDrag = {
	state: 'measured-genuine-pointer-drag';
	surface: (typeof WITNESS_REAL_APP_DRAG_SURFACES)[number];
	pointer: 'genuine-pointer-down-move-up';
	issue: string;
	from: { column: string; index: number };
	to: { column: string; index: number };
	before: WitnessAngularJiraCloneColumn[];
	after: WitnessAngularJiraCloneColumn[];
};

/**
 * The modal title edit, recorded as a round trip: the title the issue had, the
 * title typed into the modal-scoped field, and the title the modal shows when
 * it is closed and reopened. Reopening is what makes this evidence about the
 * application's store rather than about a text box retaining what was typed
 * into it.
 *
 * The description editor is deliberately not part of the claim. It is a Quill
 * surface the driver cannot type into the way a person does, so what would be
 * recorded is the harness's own limitation rather than the application's
 * behavior, and a non-claim is the honest record.
 */
export type WitnessAngularJiraCloneModalTitleEdit = {
	state: 'measured-modal-round-trip';
	route: '/project/board';
	before: string;
	typed: string;
	afterReopen: string;
	descriptionRendering: 'not-claimed';
	descriptionNonclaimReason: string;
};

/**
 * Creating an issue through the navbar control, counted on the column it lands
 * in. The control is the third navbar item; the second opens a search drawer
 * whose overlay a journey cannot get back out of, which is recorded here so the
 * next reader does not rediscover it.
 */
export type WitnessAngularJiraCloneCreateIssue = {
	state: 'measured-created-row';
	control: 'navbar-item-3';
	column: string;
	rowsBefore: number;
	rowsAfter: number;
};

/**
 * The filter narrowing and the widening that undoes it, counted per column both
 * times. `afterClear` must equal `beforeFilter` exactly — a filter that
 * narrowed and then restored something other than what it started from would be
 * losing rows, which is the failure this shape exists to catch.
 */
export type WitnessAngularJiraCloneFilter = {
	state: 'measured-narrow-and-widen';
	term: typeof WITNESS_ANGULAR_JIRA_CLONE_FILTER_TERM;
	beforeFilter: number[];
	narrowed: number[];
	wideningGesture: 'select-all-then-backspace';
	afterClear: number[];
};

/**
 * Where the board lives between page loads, observed rather than assumed: the
 * application keeps it in an in-memory store, writes nothing to browser
 * storage, and talks to no backend, so an online reload brings back the seeded
 * board rather than the board the journey left behind. Recording that the drag
 * and the created issue do not survive is the claim; pretending they do, or
 * declining to reload, would both be quieter.
 */
export type WitnessAngularJiraCloneReloadRestore = {
	state: 'measured-seed-board-restored';
	localStorageKeys: [];
	sessionStorageKeys: [];
	backend: 'none';
	survivesOnlineReload: false;
	afterReload: WitnessAngularJiraCloneColumn[];
};

/** Everything the journey measured that only this application's surfaces express. */
export type WitnessAngularJiraCloneBoardEvidence = {
	drag: WitnessAngularJiraCloneDrag;
	modalTitleEdit: WitnessAngularJiraCloneModalTitleEdit;
	createIssue: WitnessAngularJiraCloneCreateIssue;
	filter: WitnessAngularJiraCloneFilter;
	tooltip: { state: 'measured-hover-tooltip'; text: typeof WITNESS_ANGULAR_JIRA_CLONE_TOOLTIP };
	reloadRestore: WitnessAngularJiraCloneReloadRestore;
};

export type WitnessAngularJiraCloneRun = WitnessRealAppRun & {
	zeroServiceWorker: WitnessAngularJiraCloneZeroServiceWorker;
	consoleErrorInventory: WitnessConsoleErrorInventory;
	failedRequestInventory: WitnessFailedRequestInventory;
	cancelledDuplicateFetches: WitnessCancelledDuplicateFetchInventory;
	mockedNonLoopbackSeams: WitnessMockedNonLoopbackSeamInventory;
	renderedStyles: WitnessRenderedStyleEvidence;
	applicationJourney: WitnessAngularJiraCloneBoardEvidence;
	scrollAbsence: WitnessMeasuredScrollAbsence;
	behaviorDigest: string;
};

export type WitnessAngularJiraCloneMutation = {
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

export type WitnessAngularJiraCloneReceipt = {
	schemaVersion: typeof WITNESS_ANGULAR_JIRA_CLONE_SCHEMA;
	result: 'pass';
	fixture: typeof ANGULAR_JIRA_CLONE_FIXTURE;
	source: typeof ANGULAR_JIRA_CLONE_SOURCE;
	provenance: Record<string, unknown>;
	canonicalReceipts: Array<{
		path: string;
		schemaVersion: string;
		digest: string;
		sha256: string;
	}>;
	runs: WitnessAngularJiraCloneRun[];
	mutation: WitnessAngularJiraCloneMutation;
	serviceWorker: typeof WITNESS_ANGULAR_JIRA_CLONE_SERVICE_WORKER;
	consoleErrors: Readonly<
		Record<'baseline' | 'migrated', readonly WitnessConsoleErrorInventoryEntry[]>
	>;
	failedRequests: Readonly<
		Record<'baseline' | 'migrated', readonly WitnessFailedRequestInventoryEntry[]>
	>;
	/**
	 * The declared non-loopback seam membership and, per published run, what that
	 * run actually observed. Counts are recorded rather than summarized because a
	 * page that reported once and a page that reported three times are different
	 * observations, and neither is a defect.
	 */
	mockedNonLoopbackSeams: {
		category: Readonly<
			Record<'baseline' | 'migrated', readonly WitnessMockedNonLoopbackSeamEntry[]>
		>;
		pathPolicy: typeof WITNESS_NON_LOOPBACK_QUERY_FREE_PATH_RULE;
		instances: Array<{
			lane: 'baseline' | 'migrated';
			pass: 1 | 2;
			observed: WitnessMockedNonLoopbackSeamInventory['observed'];
			absent: WitnessMockedNonLoopbackSeamInventory['absent'];
		}>;
	};
	/**
	 * The cancelled-duplicate-fetch category this vertical declares, the generic
	 * rule that admits a member, the scope statement that extends it to a mocked
	 * seam, and every instance the four published runs actually observed —
	 * recorded per run rather than summarized, because whether a given reload
	 * caught a report in flight is itself the evidence.
	 */
	cancelledDuplicateFetches: {
		category: Readonly<
			Record<'baseline' | 'migrated', readonly WitnessCancelledDuplicateFetchCategoryEntry[]>
		>;
		corroborationRule: typeof WITNESS_CANCELLED_DUPLICATE_FETCH_RULE;
		nonLoopbackScope: typeof WITNESS_CANCELLED_DUPLICATE_FETCH_NON_LOOPBACK_SCOPE;
		instances: Array<{
			lane: 'baseline' | 'migrated';
			pass: 1 | 2;
			observed: WitnessCancelledDuplicateFetchInventory['observed'];
			absent: WitnessCancelledDuplicateFetchInventory['absent'];
			admitted: number;
		}>;
	};
	/**
	 * The seven rendered-appearance measurements, published once. Every run must
	 * reproduce them exactly, which is what makes the aggregate-stylesheet
	 * difference a recorded difference in bytes rather than in behavior.
	 */
	renderedStyles: WitnessRenderedStyleEvidence;
	/** The exact tracked-event counts, published once and required of every run. */
	trackedEvents: Record<string, number>;
	scrollAbsence: WitnessMeasuredScrollAbsence;
	buildLanes: {
		baseline: { angular: string; builder: string; node: string; distFiles: 24 };
		migrated: { angular: string; builder: string; node: string; distFiles: 24 };
	};
	persistence: {
		board: 'in-memory-store';
		browserStorage: 'none-written';
		backend: 'none';
		stubbed: false;
		survivesOnlineReload: false;
	};
	readiness: {
		angularLineage: { ready: number; total: number; counted: false };
		overall: { ready: number; total: number };
	};
	locality: {
		mode: 'offline';
		successfulNonLoopback: 0;
		mockedNonLoopbackSeams: number;
		osWideIsolation: false;
	};
	nonclaims: string[];
	integrity: { algorithm: 'sha256'; canonicalDigest: string };
};

const exact = (left: unknown, right: unknown): boolean =>
	canonicalize(left) === canonicalize(right);

export function witnessAngularJiraCloneRawDigest(
	run: WitnessAngularJiraCloneRun | WitnessRealAppRun,
): string {
	const { pass: _pass, result: _result, semanticDigest: _semanticDigest, ...raw } = run;
	const withoutBehavior = { ...raw } as Record<string, unknown>;
	delete withoutBehavior.behaviorDigest;
	return sha256(canonicalize(withoutBehavior));
}

/**
 * Lane-independent behavior projection.
 *
 * Production bytes are lane-specific by construction — the two builders emit
 * different chunk names, and the migration deliberately swapped one stylesheet
 * entry point for another — so the byte inventory stays in the run record and
 * out of this digest. Everything the two lanes must agree on is in it, and the
 * two additions this vertical makes are the point of the vertical: the measured
 * board journey, and the seven resolved-appearance measurements that say the
 * stylesheet swap changed nothing a user can see.
 */
export function witnessAngularJiraCloneBehaviorDigest(
	run: WitnessAngularJiraCloneRun | WitnessRealAppRun,
): string {
	const jira = run as WitnessAngularJiraCloneRun;
	return sha256(
		canonicalize({
			app: run.app,
			framework: run.framework,
			interactions: run.interactions,
			assertions: run.assertions,
			routes: run.routes,
			trackedEvents: run.trackedEvents,
			witnessRecord: run.witnessRecord,
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
				checkpoints: jira.zeroServiceWorker?.checkpoints,
				outputFiles: jira.zeroServiceWorker?.outputFiles,
				requests: jira.zeroServiceWorker?.requests,
				workerEvents: jira.zeroServiceWorker?.workerEvents,
			},
			consoleErrorInventory: run.consoleErrorInventory,
			failedRequestInventory: run.failedRequestInventory,
			// The category, its rule, its scope and its membership must be
			// identical in every lane and pass, so they participate whole. The
			// observed instances deliberately do not: whether a given reload
			// caught a report in flight is browser scheduling, and folding it
			// into a parity digest would make the two lanes disagree about a
			// fact that is not about the framework hop at all. Nothing is lost —
			// every instance is recorded in the run and in the receipt.
			cancelledDuplicateFetchCategory: {
				policy: run.cancelledDuplicateFetches?.policy,
				corroborationRule: run.cancelledDuplicateFetches?.corroborationRule,
				nonLoopbackScope: run.cancelledDuplicateFetches?.nonLoopbackScope,
				category: run.cancelledDuplicateFetches?.category,
				uncorroborated: run.cancelledDuplicateFetches?.uncorroborated,
			},
			// The same split, for the same reason: which endpoints exist is a
			// fact about the application, how many times each was reached is a
			// fact about load timing.
			mockedNonLoopbackSeamCategory: {
				policy: run.mockedNonLoopbackSeams?.policy,
				pathPolicy: run.mockedNonLoopbackSeams?.pathPolicy,
				category: run.mockedNonLoopbackSeams?.category,
				outsideInventory: run.mockedNonLoopbackSeams?.outsideInventory,
				successfulNonLoopback: run.mockedNonLoopbackSeams?.successfulNonLoopback,
			},
			renderedStyles: run.renderedStyles,
			applicationJourney: run.applicationJourney,
			scrollAbsence: jira.scrollAbsence,
			successfulNonLoopback: run.successfulNonLoopback,
		}),
	);
}

export function witnessAngularJiraCloneDigest(receipt: WitnessAngularJiraCloneReceipt): string {
	const copy = structuredClone(receipt);
	copy.integrity.canonicalDigest = '';
	return sha256(canonicalize(copy));
}

function assertZeroServiceWorker(
	zero: WitnessAngularJiraCloneZeroServiceWorker | undefined,
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
		throw new Error(`Angular jira-clone zero-service-worker evidence differs: ${label}`);
}

function assertConsoleErrorInventory(
	inventory: WitnessConsoleErrorInventory | undefined,
	lane: 'baseline' | 'migrated',
	label: string,
): void {
	const pinned = WITNESS_ANGULAR_JIRA_CLONE_CONSOLE_ERRORS[lane].map((entry) => ({
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
		throw new Error(`Angular jira-clone console-error inventory differs: ${label}`);
}

function assertFailedRequestInventory(
	inventory: WitnessFailedRequestInventory | undefined,
	lane: 'baseline' | 'migrated',
	label: string,
): void {
	const pinned = WITNESS_ANGULAR_JIRA_CLONE_FAILED_REQUESTS[lane].map((entry) => ({
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
		throw new Error(`Angular jira-clone failed-request inventory differs: ${label}`);
}

/**
 * Query-freedom, checked rather than trusted, on every path this vertical
 * records for a request outside loopback.
 *
 * The whole reason the analytics and error-reporting seams can be published at
 * all is that the account identifiers they carry live in the query and the
 * query is never recorded. A `?` anywhere in these inventories would mean that
 * construction had failed somewhere upstream, so it fails here loudly instead
 * of being published quietly.
 */
function assertQueryFreeNonLoopbackPaths(paths: readonly string[], label: string): void {
	for (const path of paths) {
		if (path.startsWith('/')) continue;
		if (path.includes('?') || path.includes('#'))
			throw new Error(`Angular jira-clone non-loopback path is not query-free: ${label}`);
	}
}

/**
 * The mocked non-loopback seam inventory, checked as an accounting mechanism.
 *
 * The declared membership must be exactly the pinned one, every member must be
 * either observed or explicitly absent, nothing may sit outside the inventory,
 * and no observation may claim a successful non-loopback request — the harness
 * answered every one of these inside the browser context, and a receipt that
 * said otherwise would be claiming the machine reached the network.
 */
function assertMockedSeams(
	inventory: WitnessMockedNonLoopbackSeamInventory | undefined,
	lane: 'baseline' | 'migrated',
	label: string,
): void {
	const pinned = WITNESS_ANGULAR_JIRA_CLONE_MOCKED_SEAMS[lane].map((entry) => ({
		method: entry.method,
		path: entry.path,
	}));
	const named = (entry: WitnessMockedNonLoopbackSeamEntry): boolean =>
		pinned.some((member) => member.method === entry.method && member.path === entry.path);
	if (
		inventory === undefined ||
		inventory.policy !== 'exact-app-scoped-mocked-non-loopback-seams' ||
		inventory.pathPolicy !== WITNESS_NON_LOOPBACK_QUERY_FREE_PATH_RULE ||
		!exact(inventory.category, pinned) ||
		!exact(inventory.outsideInventory, []) ||
		inventory.successfulNonLoopback !== 0 ||
		!Array.isArray(inventory.observed) ||
		!Array.isArray(inventory.absent) ||
		inventory.observed.length + inventory.absent.length !== pinned.length ||
		inventory.absent.some((entry) => !named(entry)) ||
		inventory.observed.some(
			(observation) =>
				!named(observation) ||
				observation.requests < 1 ||
				observation.statuses.length === 0 ||
				observation.statuses.some((status) => status < 200 || status >= 300),
		)
	)
		throw new Error(`Angular jira-clone mocked non-loopback seam inventory differs: ${label}`);
	assertQueryFreeNonLoopbackPaths(
		[...inventory.category, ...inventory.observed, ...inventory.absent].map(
			(entry) => entry.path,
		),
		`${label} mocked seams`,
	);
}

/**
 * The cancelled-duplicate-fetch category, checked as an accounting mechanism
 * rather than as a label.
 *
 * The declared membership must be exactly the pinned one, the run must carry
 * both the exact generic rule and the exact non-loopback scope statement that
 * extends it, and nothing may sit in `uncorroborated`. Every observed instance
 * must name a member, must have been cancelled at least once, and must carry at
 * least one corroborating 2xx success — an instance recording zero successes is
 * precisely the case the rule refuses, so it fails here too.
 */
function assertCancelledDuplicateFetches(
	inventory: WitnessCancelledDuplicateFetchInventory | undefined,
	lane: 'baseline' | 'migrated',
	label: string,
): void {
	const pinned = WITNESS_ANGULAR_JIRA_CLONE_CANCELLED_DUPLICATE_FETCHES[lane].map((entry) => ({
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
		inventory.nonLoopbackScope !== WITNESS_CANCELLED_DUPLICATE_FETCH_NON_LOOPBACK_SCOPE ||
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
		throw new Error(`Angular jira-clone cancelled-duplicate-fetch category differs: ${label}`);
	assertQueryFreeNonLoopbackPaths(
		[...inventory.category, ...inventory.observed, ...inventory.absent].map(
			(entry) => entry.path,
		),
		`${label} cancelled duplicates`,
	);
}

/**
 * The scroll claim this vertical does not make, checked as strictly as one it
 * would: every visited route must be present, and every one of them must have
 * measured a document that does not overflow the stated viewport.
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
		absence.routes.length < 2 ||
		absence.routes.some(
			(route) =>
				route.route.length === 0 ||
				route.clientHeight !== 720 ||
				route.scrollHeight > route.clientHeight,
		)
	)
		throw new Error(`Angular jira-clone scroll-absence measurement differs: ${label}`);
}

const columnsAreWellFormed = (columns: unknown): columns is WitnessAngularJiraCloneColumn[] =>
	Array.isArray(columns) &&
	columns.length === 4 &&
	columns.every(
		(column) =>
			typeof (column as WitnessAngularJiraCloneColumn).column === 'string' &&
			(column as WitnessAngularJiraCloneColumn).column.length > 0 &&
			Array.isArray((column as WitnessAngularJiraCloneColumn).issues) &&
			(column as WitnessAngularJiraCloneColumn).issues.every(
				(issue) => typeof issue === 'string' && issue.length > 0,
			),
	);

const issuesIn = (columns: WitnessAngularJiraCloneColumn[], name: string): string[] =>
	columns.find((column) => column.column === name)?.issues ?? [];

/**
 * The board journey, checked fact by fact.
 *
 * Each of these is an assertion about the application's own settled state, and
 * each one is checked against the record that would show it failing rather than
 * against a boolean the runner could have set: the drag must have moved the
 * named issue out of its source column and into the target column at the target
 * index, the modal title must come back changed after the modal is closed and
 * reopened, the created issue must have added exactly one row, the filter must
 * narrow to the pinned shape and restore exactly what it started from, and the
 * reload must bring back a board that is no longer the one the journey left.
 */
function assertBoardEvidence(
	evidence: WitnessAngularJiraCloneBoardEvidence | undefined,
	label: string,
): void {
	if (evidence === null || typeof evidence !== 'object')
		throw new Error(`Angular jira-clone board evidence is absent: ${label}`);
	const drag = evidence.drag;
	if (
		drag === undefined ||
		drag.state !== 'measured-genuine-pointer-drag' ||
		!(WITNESS_REAL_APP_DRAG_SURFACES as readonly string[]).includes(drag.surface) ||
		drag.pointer !== 'genuine-pointer-down-move-up' ||
		drag.issue.length === 0 ||
		drag.from.column === drag.to.column ||
		!Number.isInteger(drag.from.index) ||
		!Number.isInteger(drag.to.index) ||
		drag.from.index < 0 ||
		drag.to.index < 0 ||
		!columnsAreWellFormed(drag.before) ||
		!columnsAreWellFormed(drag.after) ||
		exact(drag.before, drag.after) ||
		issuesIn(drag.before, drag.from.column)[drag.from.index] !== drag.issue ||
		issuesIn(drag.after, drag.to.column)[drag.to.index] !== drag.issue ||
		issuesIn(drag.after, drag.from.column).includes(drag.issue)
	)
		throw new Error(`Angular jira-clone drag evidence differs: ${label}`);
	const edit = evidence.modalTitleEdit;
	if (
		edit === undefined ||
		edit.state !== 'measured-modal-round-trip' ||
		edit.route !== '/project/board' ||
		edit.before.length === 0 ||
		edit.typed.length === 0 ||
		edit.before === edit.typed ||
		edit.afterReopen !== edit.typed ||
		edit.descriptionRendering !== 'not-claimed' ||
		edit.descriptionNonclaimReason.length === 0
	)
		throw new Error(`Angular jira-clone modal title-edit evidence differs: ${label}`);
	const created = evidence.createIssue;
	if (
		created === undefined ||
		created.state !== 'measured-created-row' ||
		created.control !== 'navbar-item-3' ||
		created.column.length === 0 ||
		!Number.isInteger(created.rowsBefore) ||
		created.rowsAfter !== created.rowsBefore + 1
	)
		throw new Error(`Angular jira-clone create-issue evidence differs: ${label}`);
	const filter = evidence.filter;
	if (
		filter === undefined ||
		filter.state !== 'measured-narrow-and-widen' ||
		filter.term !== WITNESS_ANGULAR_JIRA_CLONE_FILTER_TERM ||
		filter.wideningGesture !== 'select-all-then-backspace' ||
		!exact(filter.narrowed, WITNESS_ANGULAR_JIRA_CLONE_FILTER_NARROWED) ||
		!Array.isArray(filter.beforeFilter) ||
		filter.beforeFilter.length !== WITNESS_ANGULAR_JIRA_CLONE_FILTER_NARROWED.length ||
		!exact(filter.afterClear, filter.beforeFilter) ||
		exact(filter.beforeFilter, filter.narrowed)
	)
		throw new Error(`Angular jira-clone filter evidence differs: ${label}`);
	if (
		evidence.tooltip?.state !== 'measured-hover-tooltip' ||
		evidence.tooltip.text !== WITNESS_ANGULAR_JIRA_CLONE_TOOLTIP
	)
		throw new Error(`Angular jira-clone tooltip evidence differs: ${label}`);
	const restore = evidence.reloadRestore;
	if (
		restore === undefined ||
		restore.state !== 'measured-seed-board-restored' ||
		!exact(restore.localStorageKeys, []) ||
		!exact(restore.sessionStorageKeys, []) ||
		restore.backend !== 'none' ||
		restore.survivesOnlineReload !== false ||
		!columnsAreWellFormed(restore.afterReload) ||
		exact(restore.afterReload, drag.after)
	)
		throw new Error(`Angular jira-clone reload-restore evidence differs: ${label}`);
}

/**
 * The seven resolved-appearance measurements, checked for exactly the shape a
 * styling parity claim needs: seven distinctly labelled probes, each one a real
 * laid-out element with a non-empty resolved property set. The cross-lane part
 * of the claim is enforced by the behavior digest, which carries these whole.
 */
function assertRenderedStyles(
	styles: WitnessRenderedStyleEvidence | undefined,
	label: string,
): void {
	if (
		styles === undefined ||
		styles.state !== 'measured-resolved-styles' ||
		!Array.isArray(styles.probes) ||
		styles.probes.length !== WITNESS_ANGULAR_JIRA_CLONE_STYLE_PROBES ||
		new Set(styles.probes.map((probe) => probe.label)).size !== styles.probes.length ||
		styles.probes.some(
			(probe: WitnessRenderedStyleMeasurement) =>
				probe.label.length === 0 ||
				probe.selector.length === 0 ||
				!Number.isFinite(probe.width) ||
				!Number.isFinite(probe.height) ||
				probe.width <= 0 ||
				probe.height <= 0 ||
				Object.keys(probe.properties).length === 0 ||
				Object.values(probe.properties).some((value) => value.length === 0),
		)
	)
		throw new Error(`Angular jira-clone rendered-style evidence differs: ${label}`);
}

/**
 * The route sequence, checked as a shape rather than as a literal array: the
 * journey enters at the root, the application redirects to the board, and every
 * later navigation — including the reload at the end — is that same board
 * route. A modal that pushed a route of its own, or an interaction that
 * navigated away, appears here as a route outside the pinned pair and fails.
 */
function assertRoutes(routes: string[] | undefined, label: string): void {
	const distinct = (routes ?? []).filter(
		(route, index) => index === 0 || route !== routes![index - 1],
	);
	if (
		routes === undefined ||
		routes.length < 2 ||
		routes[0] !== WITNESS_ANGULAR_JIRA_CLONE_ROUTES[0] ||
		routes.slice(1).some((route) => route !== WITNESS_ANGULAR_JIRA_CLONE_ROUTES[1]) ||
		!exact(distinct, WITNESS_ANGULAR_JIRA_CLONE_ROUTES)
	)
		throw new Error(`Angular jira-clone route sequence differs: ${label}`);
}

/**
 * The receipt-level roll-ups must reproduce the runs they summarize exactly:
 * one entry per published run, each carrying that run's own observations. A
 * summary that disagreed with the runs would let a reader see a quieter story
 * than the evidence tells.
 */
function assertRollups(receipt: WitnessAngularJiraCloneReceipt): void {
	const cancelled = receipt.cancelledDuplicateFetches;
	if (
		cancelled === undefined ||
		cancelled.corroborationRule !== WITNESS_CANCELLED_DUPLICATE_FETCH_RULE ||
		cancelled.nonLoopbackScope !== WITNESS_CANCELLED_DUPLICATE_FETCH_NON_LOOPBACK_SCOPE ||
		!exact(cancelled.category, WITNESS_ANGULAR_JIRA_CLONE_CANCELLED_DUPLICATE_FETCHES) ||
		!Array.isArray(cancelled.instances) ||
		cancelled.instances.length !== receipt.runs.length ||
		cancelled.instances.some((instance, index) => {
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
		throw new Error('Angular jira-clone cancelled-duplicate-fetch roll-up differs');
	const seams = receipt.mockedNonLoopbackSeams;
	if (
		seams === undefined ||
		seams.pathPolicy !== WITNESS_NON_LOOPBACK_QUERY_FREE_PATH_RULE ||
		!exact(seams.category, WITNESS_ANGULAR_JIRA_CLONE_MOCKED_SEAMS) ||
		!Array.isArray(seams.instances) ||
		seams.instances.length !== receipt.runs.length ||
		seams.instances.some((instance, index) => {
			const run = receipt.runs[index];
			return (
				run === undefined ||
				instance.lane !== run.lane ||
				instance.pass !== run.pass ||
				!exact(instance.observed, run.mockedNonLoopbackSeams?.observed) ||
				!exact(instance.absent, run.mockedNonLoopbackSeams?.absent)
			);
		})
	)
		throw new Error('Angular jira-clone mocked non-loopback seam roll-up differs');
}

export function parseWitnessAngularJiraCloneReceipt(
	value: unknown,
): WitnessAngularJiraCloneReceipt {
	if (value === null || typeof value !== 'object' || Array.isArray(value))
		throw new Error('Angular jira-clone Witness receipt must be an object');
	const receipt = value as WitnessAngularJiraCloneReceipt;
	const expectedRuns = new Set(['baseline:1', 'baseline:2', 'migrated:1', 'migrated:2']);
	const behaviors = new Set<string>();
	if (
		receipt.schemaVersion !== WITNESS_ANGULAR_JIRA_CLONE_SCHEMA ||
		receipt.result !== 'pass' ||
		receipt.fixture !== ANGULAR_JIRA_CLONE_FIXTURE ||
		!exact(receipt.source, ANGULAR_JIRA_CLONE_SOURCE) ||
		!Array.isArray(receipt.canonicalReceipts) ||
		receipt.canonicalReceipts.length !== ANGULAR_JIRA_CLONE_CANONICAL_RECEIPTS.length ||
		receipt.canonicalReceipts.some((bound, index) => {
			const pinned = ANGULAR_JIRA_CLONE_CANONICAL_RECEIPTS[index];
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
		throw new Error('Angular jira-clone Witness binding differs');
	for (const run of receipt.runs) {
		const key = `${run.lane}:${run.pass}`;
		if (
			!expectedRuns.delete(key) ||
			run.app !== 'angular-jira-clone' ||
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
			[...new Set(run.interactions.map((interaction) => interaction.kind))].sort().join(',') !==
				'click,drag,hover,press,type' ||
			!exact(run.witnessRecord.trackedEventCounts, receipt.trackedEvents) ||
			run.semanticDigest !== witnessAngularJiraCloneRawDigest(run) ||
			run.behaviorDigest !== witnessAngularJiraCloneBehaviorDigest(run)
		)
			throw new Error(`Angular jira-clone Witness run differs: ${key}`);
		assertRoutes(run.routes, key);
		assertZeroServiceWorker(run.zeroServiceWorker, key);
		assertConsoleErrorInventory(run.consoleErrorInventory, run.lane, key);
		assertFailedRequestInventory(run.failedRequestInventory, run.lane, key);
		assertCancelledDuplicateFetches(run.cancelledDuplicateFetches, run.lane, key);
		assertMockedSeams(run.mockedNonLoopbackSeams, run.lane, key);
		assertRenderedStyles(run.renderedStyles, key);
		assertBoardEvidence(run.applicationJourney, key);
		assertScrollAbsence(run.scrollAbsence, key);
		behaviors.add(run.behaviorDigest);
	}
	assertScrollAbsence(receipt.scrollAbsence, 'receipt');
	assertRenderedStyles(receipt.renderedStyles, 'receipt');
	assertRollups(receipt);
	const trackedEventNames = Object.keys(receipt.trackedEvents ?? {});
	if (
		expectedRuns.size !== 0 ||
		behaviors.size !== 1 ||
		trackedEventNames.length === 0 ||
		trackedEventNames.some((name) => (receipt.trackedEvents[name] ?? 0) < 1) ||
		!exact(receipt.renderedStyles, receipt.runs[0]!.renderedStyles) ||
		!exact(receipt.consoleErrors, WITNESS_ANGULAR_JIRA_CLONE_CONSOLE_ERRORS) ||
		!exact(receipt.failedRequests, WITNESS_ANGULAR_JIRA_CLONE_FAILED_REQUESTS) ||
		!exact(receipt.serviceWorker, WITNESS_ANGULAR_JIRA_CLONE_SERVICE_WORKER) ||
		receipt.buildLanes?.baseline?.distFiles !== 24 ||
		receipt.buildLanes.migrated?.distFiles !== 24 ||
		!exact(receipt.persistence, {
			board: 'in-memory-store',
			browserStorage: 'none-written',
			backend: 'none',
			stubbed: false,
			survivesOnlineReload: false,
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
		receipt.readiness?.angularLineage?.counted !== false ||
		!Number.isInteger(receipt.readiness.angularLineage.ready) ||
		!Number.isInteger(receipt.readiness.angularLineage.total) ||
		receipt.readiness.angularLineage.ready > receipt.readiness.angularLineage.total ||
		!Number.isInteger(receipt.readiness.overall.ready) ||
		!Number.isInteger(receipt.readiness.overall.total) ||
		receipt.readiness.overall.ready > receipt.readiness.overall.total ||
		receipt.locality?.mode !== 'offline' ||
		receipt.locality.successfulNonLoopback !== 0 ||
		receipt.locality.mockedNonLoopbackSeams !==
			WITNESS_ANGULAR_JIRA_CLONE_MOCKED_SEAMS.migrated.length ||
		receipt.locality.osWideIsolation !== false ||
		!Array.isArray(receipt.nonclaims) ||
		receipt.nonclaims.length === 0 ||
		receipt.integrity?.algorithm !== 'sha256' ||
		receipt.integrity.canonicalDigest !== witnessAngularJiraCloneDigest(receipt)
	)
		throw new Error('Angular jira-clone Witness integrity differs');
	return receipt;
}

export function renderWitnessAngularJiraCloneReceipt(
	receipt: WitnessAngularJiraCloneReceipt,
): string {
	const boundReceipts = receipt.canonicalReceipts
		.map((bound) => `\`${bound.path}\` (${bound.digest.slice(0, 12)})`)
		.join(', ');
	const routes = receipt.scrollAbsence.routes
		.map((route) => `${route.route} ${route.scrollHeight}/${route.clientHeight}`)
		.join(', ');
	const seams = receipt.mockedNonLoopbackSeams.category.migrated
		.map((entry) => `${entry.method} ${entry.path}`)
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
									(observed) =>
										`${observed.cancelled} cancelled ${observed.path}, corroborated by ${observed.corroboratingSuccesses} successful request(s) with status ${observed.corroboratingStatuses.join('/')}`,
								)
								.join('; ')
				}`,
		)
		.join(' | ');
	const styles = receipt.renderedStyles.probes
		.map(
			(probe) =>
				`${probe.label} ${probe.width}x${probe.height} ${Object.entries(probe.properties)
					.map(([property, value]) => `${property}=${value}`)
					.join(' ')}`,
		)
		.join('; ');
	const journey = receipt.runs[0]!.applicationJourney;
	const trackedEvents = Object.entries(receipt.trackedEvents)
		.map(([name, count]) => `${name} ${count}`)
		.join(', ');
	return `# jira-clone-angular @059455b — direct Witness browser proof

- Result: pass
- Canonical SHA-256: ${receipt.integrity.canonicalDigest}
- Runs: 2 baseline + 2 migrated production-static browser journeys
- Behavioral parity: ${receipt.runs[0]!.behaviorDigest}
- Build lanes: era ${receipt.buildLanes.baseline.angular} / ${receipt.buildLanes.baseline.builder} on ${receipt.buildLanes.baseline.node} (${receipt.buildLanes.baseline.distFiles} files) against migrated ${receipt.buildLanes.migrated.angular} / ${receipt.buildLanes.migrated.builder} on ${receipt.buildLanes.migrated.node} (${receipt.buildLanes.migrated.distFiles} files)
- Bound build receipts: ${boundReceipts}
- Journey: a genuine pointer drag that moves \`${journey.drag.issue}\` from ${journey.drag.from.column} to ${journey.drag.to.column} at index ${journey.drag.to.index}, an issue modal whose title edit survives closing and reopening the modal, an issue created through navbar item 3 that takes ${journey.createIssue.column} from ${journey.createIssue.rowsBefore} rows to ${journey.createIssue.rowsAfter}, a board filtered to ${journey.filter.narrowed.join('/')} on "${journey.filter.term}" and widened back to ${journey.filter.afterClear.join('/')} by a full clear gesture, a hovered avatar whose tooltip reads "${journey.tooltip.text}", and an online reload that brings the seeded board back
- Routes: ${WITNESS_ANGULAR_JIRA_CLONE_ROUTES.join(' → ')}; every modal surface leaves the route alone
- Tracked browser events, identical in every lane and pass: ${trackedEvents}
- Persistence: board ${receipt.persistence.board}, browser storage ${receipt.persistence.browserStorage}, backend ${receipt.persistence.backend}, stubbed: ${String(receipt.persistence.stubbed)}, survives an online reload: ${String(receipt.persistence.survivesOnlineReload)}
- Service worker: ${receipt.serviceWorker.state}; the context allowed registration and the application never attempted one, so zero registrations, controller, CacheStorage names and worker requests at three checkpoints in every pass
- Console-error inventory (exact, whole journey, per lane): empty in both lanes — both builds are genuinely silent, and any error at all fails the run
- Failed-request inventory (exact, whole journey, per lane): empty in both lanes, once the cancelled-duplicate category below has taken its own instances; every other failed request still fails the run
- Mocked non-loopback seams (${receipt.locality.mockedNonLoopbackSeams}, answered in-context, none left the machine): ${seams}. ${receipt.mockedNonLoopbackSeams.pathPolicy}
- Cancelled-duplicate-fetch category (both lanes): ${cancelledCategory} — pinned by path, method and browser reason, never by count. ${receipt.cancelledDuplicateFetches.corroborationRule} ${receipt.cancelledDuplicateFetches.nonLoopbackScope}
- Cancelled-duplicate-fetch instances as published: ${cancelledInstances}
- Rendered appearance, measured on ${receipt.renderedStyles.probes.length} laid-out elements and identical in both lanes: ${styles}
- Mutation proof: \`${receipt.mutation.seam}\` in \`${receipt.mutation.path}\` at offset ${receipt.mutation.offset} made the journey red, byte-identical restoration made it green again
- Scroll: ${receipt.scrollAbsence.state} — ${receipt.scrollAbsence.documentOverflow}; measured scrollHeight/clientHeight per visited route at ${receipt.scrollAbsence.viewport.width}x${receipt.scrollAbsence.viewport.height}: ${routes}
- Angular lineage readiness: unchanged at ${receipt.readiness.angularLineage.ready}/${receipt.readiness.angularLineage.total}; this vertical is not counted

${receipt.nonclaims.map((claim) => `- ${claim}`).join('\n')}
`;
}

export function witnessAngularJiraCloneAggregateMember(digestValue: string) {
	return {
		id: 'witness-angular-jira-clone',
		framework: 'angular',
		track: 'production-readiness-direct-witness-angular13-to-angular16-browser-builder',
		bundler: 'angular-cli-13.2-custom-webpack-browser-builder-to-angular-16.2-browser-builder',
		runtime: 'node-16.20.2',
		result: 'pass',
		receipt: WITNESS_ANGULAR_JIRA_CLONE_RECEIPT_PATH,
		digest: digestValue,
	};
}

export async function verifyWitnessAngularJiraCloneEvidence(rootDir = '.') {
	const root = resolve(rootDir);
	const receiptPath = join(root, WITNESS_ANGULAR_JIRA_CLONE_RECEIPT_PATH);
	const receipt = parseWitnessAngularJiraCloneReceipt(
		JSON.parse(await readFile(receiptPath, 'utf8')),
	);
	for (const bound of receipt.canonicalReceipts) {
		const bytes = await readFile(join(root, bound.path));
		if (sha256(bytes) !== bound.sha256)
			throw new Error(`Angular jira-clone bound build receipt bytes drifted: ${bound.path}`);
		const parsed = JSON.parse(bytes.toString('utf8')) as {
			schemaVersion?: unknown;
			digest?: unknown;
		};
		if (parsed.schemaVersion !== bound.schemaVersion || parsed.digest !== bound.digest)
			throw new Error(
				`Angular jira-clone bound build receipt identity differs: ${bound.path}`,
			);
	}
	if (
		(await readFile(join(dirname(receiptPath), 'receipt.md'), 'utf8')) !==
		renderWitnessAngularJiraCloneReceipt(receipt)
	)
		throw new Error('Angular jira-clone human Witness receipt differs');
	return {
		valid: true as const,
		digest: receipt.integrity.canonicalDigest,
		artifacts: 0,
		receipt,
	};
}
