import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'pathe';
import { canonicalize, sha256 } from './canonicalize.ts';
import { WITNESS_NON_LOOPBACK_QUERY_FREE_PATH_RULE } from './witness-real-app.ts';
import type {
	WitnessConsoleErrorInventory,
	WitnessConsoleErrorInventoryEntry,
	WitnessFailedRequestInventory,
	WitnessFailedRequestInventoryEntry,
	WitnessMockedNonLoopbackSeamEntry,
	WitnessMockedNonLoopbackSeamInventory,
	WitnessRealAppRun,
	WitnessRenderedStyleEvidence,
	WitnessRenderedStyleMeasurement,
	WitnessScrollSurface,
} from './witness-real-app.ts';

/**
 * The browser proof for the LEGACY-NEXT static-export vertical.
 *
 * This is the first Witness cell whose baseline lane is a framework rather than
 * a bundler, and that changes what a parity claim can even mean. The era lane
 * ships a document with the whole application already rendered into it; the
 * migrated lane ships a mount element and a module that renders the same
 * application when it evaluates. No comparison of document bytes could ever come
 * out equal, and pretending otherwise would be the dishonest move. So the oracle
 * here is the settled DOM and the behaviour on top of it: the same records in
 * the same order with the same text, the same resolved appearance on laid-out
 * elements, and the same answers to the same gestures.
 */
export const WITNESS_NEXT_KILLEDBYGOOGLE_V3_SCHEMA =
	'versionless.witness-next-killedbygoogle-v3.v1' as const;
export const WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECEIPT_PATH =
	'evidence/runs/witness-next-killedbygoogle-v3-0-0/receipt.json' as const;
export const NEXT_KILLEDBYGOOGLE_V3_FIXTURE = 'next-killedbygoogle-v3-0-0' as const;

/**
 * The immutable source identity, bound here so the browser proof cannot
 * silently rebind itself to a different revision or archive. The pin is a bare
 * commit sha because the repository publishes no tag for this tree.
 */
export const NEXT_KILLEDBYGOOGLE_V3_SOURCE = Object.freeze({
	repository: 'https://github.com/codyogden/killedbygoogle',
	ref: 'none — a bare commit sha was pinned; no tag was requested or relied on',
	revision: '56809c31592e6ca1edce8af9bfe842fbcdf71f4d',
	archiveSha256: 'c28878d0f65b56aa595763c852477fb0c1e3533e5c7f7ea9daa2be16f102368d',
	archiveBytes: 370006,
	license: 'MIT',
	licenseSha256: '10547fb81e311e470cdcda5a273bac2a76f50ded6b33ce4362bcb05e1176d5e0',
});

/**
 * The build-lane receipt this browser proof stands on, bound by its exact bytes.
 *
 * It carries no self-declared digest of its own, so the binding is the sha256 of
 * the file plus the two lane digests it published. Both lane digests are
 * recomputed from the served directories before any browser is launched, which
 * is what stops the proof from being re-pointed at a rebuilt lane.
 */
export const NEXT_KILLEDBYGOOGLE_V3_CANONICAL_RECEIPT = Object.freeze({
	path: 'evidence/runs/next-killedbygoogle-v3-0-0/t006-build-lanes.json',
	schemaVersion: 'versionless.legacy-build-parity.v1',
	sha256: '7e311d8c8c5e5ac3e68008d113c5be403b40de07ee113556f078b6bfcd658a02',
	eraLaneDigest: '0c7d86363d4a15c64aeca4f9c674a49e1abd006457c7a24621d4fff161bcf5c2',
	targetLaneDigest: 'f048ea581b990bb71b85be8f4255764abd9a2904da409357b1980e3dbc12e3d4',
});

/** The application name this vertical occupies in the closed Witness corpus list. */
export const NEXT_KILLEDBYGOOGLE_V3_APP = 'next-killedbygoogle-v3-0-0' as const;

/**
 * Exact console-error inventory, per lane, for the whole journey. Both are
 * empty, which is the strictest inventory rather than an allowance: the
 * accounting mechanism is the same non-masking one used elsewhere, so a single
 * console error in either lane lands outside the inventory and fails the run.
 */
export const WITNESS_NEXT_KILLEDBYGOOGLE_V3_CONSOLE_ERRORS = Object.freeze({
	baseline: Object.freeze([]),
	migrated: Object.freeze([]),
}) as Readonly<Record<'baseline' | 'migrated', readonly WitnessConsoleErrorInventoryEntry[]>>;

/**
 * Exact failed-request inventory, per lane, held to the same discipline and
 * empty for the same reason. Every third-party destination this application
 * reaches for is answered inside the browser context, so none of them becomes a
 * network failure and none of them leaves the machine; they are accounted for
 * endpoint by endpoint in the mocked-seam inventory below instead.
 */
export const WITNESS_NEXT_KILLEDBYGOOGLE_V3_FAILED_REQUESTS = Object.freeze({
	baseline: Object.freeze([]),
	migrated: Object.freeze([]),
}) as Readonly<Record<'baseline' | 'migrated', readonly WitnessFailedRequestInventoryEntry[]>>;

/**
 * Every seam this application reaches for outside the bounded loopback origin,
 * per lane, pinned query-free per {@link WITNESS_NON_LOOPBACK_QUERY_FREE_PATH_RULE}.
 *
 * The two lanes declare different memberships, and that difference is the
 * finding rather than an inconvenience. All three third-party scripts are
 * present in the rendered DOM of both lanes. In the era lane two of them —
 * the analytics tag in the document head and the card script at the end of the
 * body — are parser-inserted, so the browser executes them and fetches them. In
 * the migrated lane the same two elements are created by React while it renders,
 * and a script element React inserts is never executed by the browser, so they
 * are never fetched. The advertising script is fetched in both lanes because the
 * application appends it imperatively with `document.createElement`, which is a
 * different insertion path with a different rule.
 *
 * Declaring this per lane is what makes the difference falsifiable: if the
 * migrated lane ever started fetching the analytics tag, that request would land
 * outside its declared inventory and fail the run.
 *
 * The advertising endpoint is reached over `http:` because the application
 * writes a protocol-relative `//cdn.carbonads.com/...` source and the bounded
 * loopback origin is itself `http:`. It carries a query in the request, and the
 * query is what the query-free rule strips: what identifies the seam is the
 * endpoint, and the endpoint is here in full.
 *
 * The members are listed in the one canonical order the harness's inventory
 * builder emits, because the published inventory is compared to this list
 * exactly.
 */
export const WITNESS_NEXT_KILLEDBYGOOGLE_V3_MOCKED_SEAMS = Object.freeze({
	baseline: Object.freeze([
		Object.freeze({ method: 'GET', path: 'http://cdn.carbonads.com/carbon.js' }),
		Object.freeze({ method: 'GET', path: 'https://analytics.bale.media/umami.js' }),
		Object.freeze({ method: 'GET', path: 'https://card.codyogden.com/card.js' }),
	]),
	migrated: Object.freeze([
		Object.freeze({ method: 'GET', path: 'http://cdn.carbonads.com/carbon.js' }),
	]),
}) as Readonly<Record<'baseline' | 'migrated', readonly WitnessMockedNonLoopbackSeamEntry[]>>;

/**
 * The third-party script execution difference, stated once as a recorded
 * difference rather than folded into the cross-lane behaviour digest.
 *
 * A parity digest that carried the seam membership would never agree, and
 * making it agree would mean either suppressing the era lane's requests or
 * inventing the migrated lane's. Neither is evidence. What is published instead
 * is the difference itself, alongside the measurement that says it changes
 * nothing a reader of the page can see: the rendered list, the resolved
 * appearance and every journey answer are identical in both lanes.
 */
export const WITNESS_NEXT_KILLEDBYGOOGLE_V3_SCRIPT_EXECUTION_DIFFERENCE = Object.freeze({
	difference: 'parser-inserted third-party scripts execute in the era lane and not after the lift',
	eraFetched: 3,
	migratedFetched: 1,
	alwaysFetched: 'http://cdn.carbonads.com/carbon.js',
	presentInBothRenderedDocuments: 3,
	cause: 'The era lane statically renders the analytics tag into <head> and the card script into the body, where the HTML parser inserts and therefore executes them. After the lift the same two elements are produced by React during render, and a script element inserted by React is never executed by the browser. The advertising script is appended imperatively by the application itself with document.createElement in both lanes, so it runs in both.',
	visibleConsequence: 'none measured: the rendered list, the resolved appearance of every probe and every journey answer are identical in both lanes',
	masked: false,
});

/**
 * The second recorded lane difference: the framework's client router installs a
 * history entry of its own when it hydrates, and after the lift there is no
 * router to install one.
 *
 * The journey navigates nowhere — this application has one authored route and
 * every gesture is an in-place state change — so what each lane records after
 * its initial document load is the journey's own reload, plus, in the era lane,
 * that one extra entry. Both entries name the same URL, nothing about the
 * rendered page differs, and each lane's count is asserted exactly rather than
 * relaxed until both fit.
 */
export const WITNESS_NEXT_KILLEDBYGOOGLE_V3_ROUTER_HISTORY_DIFFERENCE = Object.freeze({
	difference: 'the era lane records one client-router history entry the lifted lane has no router to record',
	eraRecordedNavigations: 2,
	migratedRecordedNavigations: 1,
	sharedNavigation: 'the journey\'s own document reload, recorded by both lanes',
	distinctRoutesInEitherLane: 1,
	route: '/',
	visibleConsequence: 'none measured: both lanes stay on the same URL throughout, and the rendered list, the resolved appearance of every probe and every journey answer are identical',
	masked: false,
});

/** The number of graveyard records the pinned data set renders. */
export const WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECORDS = 263 as const;
/**
 * The number of list items those records produce.
 *
 * The extra one is not an off-by-one: the application renders an advertising
 * slot as the first `<li>` of the same list, and that slot is not a graveyard
 * record. Every count in this receipt is therefore published twice — records,
 * and list items — because a proof that only counted one of them would be
 * asserting the application's own arithmetic away.
 */
export const WITNESS_NEXT_KILLEDBYGOOGLE_V3_LIST_ITEMS = 264 as const;
export const WITNESS_NEXT_KILLEDBYGOOGLE_V3_AD_LIST_ITEMS = 1 as const;

/** The search term the journey types, and the one record its name matches. */
export const WITNESS_NEXT_KILLEDBYGOOGLE_V3_SEARCH_TERM = 'Google+' as const;
export const WITNESS_NEXT_KILLEDBYGOOGLE_V3_SEARCH_RECORDS = 1 as const;

/** The two filter options the journey selects, by their rendered labels. */
export const WITNESS_NEXT_KILLEDBYGOOGLE_V3_KEYBOARD_FILTER = 'Apps (50)' as const;
export const WITNESS_NEXT_KILLEDBYGOOGLE_V3_KEYBOARD_FILTER_RECORDS = 50 as const;
export const WITNESS_NEXT_KILLEDBYGOOGLE_V3_CLICK_FILTER = 'Hardware (21)' as const;
export const WITNESS_NEXT_KILLEDBYGOOGLE_V3_CLICK_FILTER_RECORDS = 21 as const;
export const WITNESS_NEXT_KILLEDBYGOOGLE_V3_ALL_FILTER = 'All (263)' as const;

/** The compound narrowing: the click-selected filter, narrowed further by a typed term. */
export const WITNESS_NEXT_KILLEDBYGOOGLE_V3_COMPOUND_TERM = 'Nexus' as const;
export const WITNESS_NEXT_KILLEDBYGOOGLE_V3_COMPOUND_RECORDS = 3 as const;

/**
 * How many rendered-appearance probes the journey takes in each lane.
 *
 * The number is load-bearing. This migration changes who produces the styling:
 * the era lane serves Emotion's style rules already inserted into the document,
 * while the migrated lane inserts them from the client when the application
 * mounts, and the lift deliberately drops Emotion's Babel plugin, which changes
 * the generated class names. Measuring resolved appearance on laid-out elements
 * in both lanes, and requiring the measurements to be identical, is the only
 * honest way to say that difference is invisible.
 */
export const WITNESS_NEXT_KILLEDBYGOOGLE_V3_STYLE_PROBES = 7 as const;

/**
 * The one route this application has.
 *
 * It is a single authored page with no router, so the only navigation the
 * journey can record is its own document reload. No navigation journey is
 * claimed anywhere in this receipt, and the single-route limitation is published
 * as a non-claim rather than left to be inferred from a short list.
 */
export const WITNESS_NEXT_KILLEDBYGOOGLE_V3_ROUTES = Object.freeze(['/']);

export const WITNESS_NEXT_KILLEDBYGOOGLE_V3_VIEWPORT = Object.freeze({ width: 1280, height: 720 });

/**
 * Neither lane ships or registers a service worker, and the browser context
 * allowed them to. Recording that the context permitted registration is the
 * point: zero workers here is the application's own behaviour, not a policy the
 * harness imposed to make the number come out right.
 */
export const WITNESS_NEXT_KILLEDBYGOOGLE_V3_SERVICE_WORKER = Object.freeze({
	state: 'no-service-worker-in-either-lane',
	contextPolicy: 'registration-allowed-and-never-attempted',
	applicationRegisterCalls: 0,
	emittedWorkerScriptsInEitherLane: 0,
	registrationsInEitherLane: 0,
	controllerInEitherLane: null,
	cacheStorageNamesInEitherLane: 0,
	masked: false,
});

export type WitnessNextKilledbygoogleV3Checkpoint = {
	phase: 'before-interactions' | 'after-interactions' | 'after-online-reload';
	state: 'timeout';
	registrations: 0;
	controller: null;
	cacheNames: [];
	workerEvents: [];
};

export type WitnessNextKilledbygoogleV3ZeroServiceWorker = {
	checkpoints: WitnessNextKilledbygoogleV3Checkpoint[];
	outputFiles: [];
	requests: [];
	workerEvents: [];
};

/** A list measurement: the records, and the list items those records sit among. */
export type WitnessNextKilledbygoogleV3Counts = { records: number; listItems: number };

/**
 * The settled list, read off the live page.
 *
 * This is the arbitration the whole vertical exists for. The era lane's document
 * arrives with all 263 rows already in it; the migrated lane's document arrives
 * with a mount element. `contentSha256` is taken over the ordered rendered text
 * of every row — its title and its description — so a lane that rendered the
 * same number of rows in a different order, or with different text, produces a
 * different digest and fails the cross-lane behaviour comparison.
 */
export type WitnessNextKilledbygoogleV3RenderedList = {
	state: 'measured-settled-list-dom';
	records: typeof WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECORDS;
	listItems: typeof WITNESS_NEXT_KILLEDBYGOOGLE_V3_LIST_ITEMS;
	adListItems: typeof WITNESS_NEXT_KILLEDBYGOOGLE_V3_AD_LIST_ITEMS;
	contentScheme: 'sha256(canonicalize([{name,items}] in document order))';
	contentSha256: string;
	firstRecord: { name: string; description: string };
	lastRecord: { name: string; description: string };
};

export type WitnessNextKilledbygoogleV3Search = {
	state: 'measured-narrow-and-widen';
	term: typeof WITNESS_NEXT_KILLEDBYGOOGLE_V3_SEARCH_TERM;
	gesture: 'typed-into-the-search-box';
	beforeSearch: WitnessNextKilledbygoogleV3Counts;
	narrowed: WitnessNextKilledbygoogleV3Counts;
	wideningGesture: 'select-all-then-backspace';
	afterClear: WitnessNextKilledbygoogleV3Counts;
};

export type WitnessNextKilledbygoogleV3TypeFilter = {
	state: 'measured-select-narrowing';
	control: 'react-select-filter-select';
	keyboard: {
		gesture: 'typed-then-enter';
		option: typeof WITNESS_NEXT_KILLEDBYGOOGLE_V3_KEYBOARD_FILTER;
		counts: WitnessNextKilledbygoogleV3Counts;
	};
	click: {
		gesture: 'menu-opened-and-option-clicked';
		optionId: string;
		option: typeof WITNESS_NEXT_KILLEDBYGOOGLE_V3_CLICK_FILTER;
		counts: WitnessNextKilledbygoogleV3Counts;
	};
};

export type WitnessNextKilledbygoogleV3Compound = {
	state: 'measured-compound-narrowing';
	filter: typeof WITNESS_NEXT_KILLEDBYGOOGLE_V3_CLICK_FILTER;
	term: typeof WITNESS_NEXT_KILLEDBYGOOGLE_V3_COMPOUND_TERM;
	counts: WitnessNextKilledbygoogleV3Counts;
	afterFullClear: WitnessNextKilledbygoogleV3Counts;
	fullClearGesture: 'search-cleared-then-filter-returned-to-all';
};

/**
 * The advertising slot, measured rather than assumed away.
 *
 * It is the reason every count in this receipt is published twice. The slot is a
 * list item of the same list and carries no record title, so it moves the list
 * item count by exactly one at every stage of the journey and never moves the
 * record count.
 */
export type WitnessNextKilledbygoogleV3AdSlot = {
	state: 'measured-non-data-list-item';
	selector: string;
	recordTitles: 0;
	countedInListItems: true;
	countedInRecords: false;
};

export type WitnessNextKilledbygoogleV3ReloadRestore = {
	state: 'measured-initial-state-restored';
	counts: WitnessNextKilledbygoogleV3Counts;
	searchValue: '';
	filterLabel: typeof WITNESS_NEXT_KILLEDBYGOOGLE_V3_ALL_FILTER;
	localStorageKeys: [];
	sessionStorageKeys: [];
	backend: 'none';
	survivesOnlineReload: false;
};

/** Everything the journey measured that only this application's surfaces express. */
export type WitnessNextKilledbygoogleV3GraveyardEvidence = {
	renderedList: WitnessNextKilledbygoogleV3RenderedList;
	search: WitnessNextKilledbygoogleV3Search;
	typeFilter: WitnessNextKilledbygoogleV3TypeFilter;
	compound: WitnessNextKilledbygoogleV3Compound;
	adSlot: WitnessNextKilledbygoogleV3AdSlot;
	reloadRestore: WitnessNextKilledbygoogleV3ReloadRestore;
};

export type WitnessNextKilledbygoogleV3Run = WitnessRealAppRun & {
	zeroServiceWorker: WitnessNextKilledbygoogleV3ZeroServiceWorker;
	consoleErrorInventory: WitnessConsoleErrorInventory;
	failedRequestInventory: WitnessFailedRequestInventory;
	mockedNonLoopbackSeams: WitnessMockedNonLoopbackSeamInventory;
	renderedStyles: WitnessRenderedStyleEvidence;
	applicationJourney: WitnessNextKilledbygoogleV3GraveyardEvidence;
	scrollSurface: WitnessScrollSurface;
	behaviorDigest: string;
};

export type WitnessNextKilledbygoogleV3Mutation = {
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

export type WitnessNextKilledbygoogleV3Receipt = {
	schemaVersion: typeof WITNESS_NEXT_KILLEDBYGOOGLE_V3_SCHEMA;
	result: 'pass';
	fixture: typeof NEXT_KILLEDBYGOOGLE_V3_FIXTURE;
	source: typeof NEXT_KILLEDBYGOOGLE_V3_SOURCE;
	provenance: Record<string, unknown>;
	canonicalReceipt: typeof NEXT_KILLEDBYGOOGLE_V3_CANONICAL_RECEIPT;
	runs: WitnessNextKilledbygoogleV3Run[];
	mutation: WitnessNextKilledbygoogleV3Mutation;
	serviceWorker: typeof WITNESS_NEXT_KILLEDBYGOOGLE_V3_SERVICE_WORKER;
	consoleErrors: Readonly<
		Record<'baseline' | 'migrated', readonly WitnessConsoleErrorInventoryEntry[]>
	>;
	failedRequests: Readonly<
		Record<'baseline' | 'migrated', readonly WitnessFailedRequestInventoryEntry[]>
	>;
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
	/** The two behavioural differences the lanes genuinely have, published as differences. */
	scriptExecutionDifference: typeof WITNESS_NEXT_KILLEDBYGOOGLE_V3_SCRIPT_EXECUTION_DIFFERENCE;
	routerHistoryDifference: typeof WITNESS_NEXT_KILLEDBYGOOGLE_V3_ROUTER_HISTORY_DIFFERENCE;
	renderedStyles: WitnessRenderedStyleEvidence;
	/** The exact tracked-event counts, published once and required of every run. */
	trackedEvents: Record<string, number>;
	scrollSurface: WitnessScrollSurface;
	/**
	 * The two lanes as the build unit published them, bound by the digests this
	 * proof recomputed from the directories it served.
	 */
	buildLanes: {
		baseline: { framework: string; bundler: string; node: string; digest: string; files: 41 };
		migrated: { framework: string; bundler: string; node: string; digest: string; files: 27 };
	};
	/**
	 * The document-level difference the lift makes, recorded rather than
	 * repaired: one lane delivers the application, the other delivers a mount
	 * element and builds it.
	 */
	documentDelivery: {
		baseline: 'pre-rendered-application-document';
		migrated: 'client-mounted-application-document';
		baselineIndexBytes: 291004;
		migratedIndexBytes: 268;
		parityOracle: 'settled-dom-and-behaviour';
		byteParity: 'not-claimed';
	};
	persistence: {
		store: 'in-memory-react-state';
		browserStorage: 'none-written';
		backend: 'none';
		stubbed: false;
		survivesOnlineReload: false;
	};
	readiness: {
		nextLineage: { ready: number; total: number; counted: false };
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

export function witnessNextKilledbygoogleV3RawDigest(
	run: WitnessNextKilledbygoogleV3Run | WitnessRealAppRun,
): string {
	const { pass: _pass, result: _result, semanticDigest: _semanticDigest, ...raw } = run;
	const withoutBehavior = { ...raw } as Record<string, unknown>;
	delete withoutBehavior.behaviorDigest;
	return sha256(canonicalize(withoutBehavior));
}

/**
 * Lane-independent behaviour projection: everything the era lane and the
 * migrated lane must agree on.
 *
 * Two things are deliberately outside it. Production bytes are lane-specific by
 * construction — two builders, and one of them does not even deliver the
 * application in the document — so the byte inventory stays in the run record
 * and out of this digest. The declared non-loopback seam membership is outside
 * it for the opposite reason: the lanes genuinely differ there, that difference
 * is this vertical's finding, and folding it in would either hide the finding or
 * make parity unreachable. Everything that is a claim about the application —
 * the settled list, the journey answers, the resolved appearance, the scroll
 * surface, the console and failure inventories — is in.
 */
export function witnessNextKilledbygoogleV3BehaviorDigest(
	run: WitnessNextKilledbygoogleV3Run | WitnessRealAppRun,
): string {
	const graveyard = run as WitnessNextKilledbygoogleV3Run;
	return sha256(
		canonicalize({
			app: run.app,
			framework: run.framework,
			interactions: run.interactions,
			assertions: run.assertions,
			// The distinct routes rather than the recorded sequence, and the
			// witness record without its navigation list, for the reason the
			// router-history difference sets out: the era lane's client router
			// records a history entry for the same URL that the lifted lane has
			// no router to record. Both lanes are still held to exactly one
			// distinct route, each lane's own navigation count is asserted
			// exactly by the journey, and the counts are published as a recorded
			// difference. Everything else in the witness record participates
			// whole.
			distinctRoutes: [...new Set(run.routes)],
			trackedEvents: run.trackedEvents,
			witnessRecord: {
				interactions: run.witnessRecord.interactions,
				distinctNavigationPaths: [...new Set(run.witnessRecord.navigationPaths)],
				trackedEventCounts: run.witnessRecord.trackedEventCounts,
				consoleErrors: run.witnessRecord.consoleErrors,
				pageErrors: run.witnessRecord.pageErrors,
				failedRequests: run.witnessRecord.failedRequests,
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
				checkpoints: graveyard.zeroServiceWorker?.checkpoints,
				outputFiles: graveyard.zeroServiceWorker?.outputFiles,
				requests: graveyard.zeroServiceWorker?.requests,
				workerEvents: graveyard.zeroServiceWorker?.workerEvents,
			},
			consoleErrorInventory: run.consoleErrorInventory,
			failedRequestInventory: run.failedRequestInventory,
			mockedNonLoopbackSeamPolicy: {
				policy: run.mockedNonLoopbackSeams?.policy,
				pathPolicy: run.mockedNonLoopbackSeams?.pathPolicy,
				outsideInventory: run.mockedNonLoopbackSeams?.outsideInventory,
				successfulNonLoopback: run.mockedNonLoopbackSeams?.successfulNonLoopback,
			},
			renderedStyles: run.renderedStyles,
			applicationJourney: run.applicationJourney,
			scrollSurface: graveyard.scrollSurface,
			successfulNonLoopback: run.successfulNonLoopback,
		}),
	);
}

export function witnessNextKilledbygoogleV3Digest(
	receipt: WitnessNextKilledbygoogleV3Receipt,
): string {
	const copy = structuredClone(receipt);
	copy.integrity.canonicalDigest = '';
	return sha256(canonicalize(copy));
}

function assertZeroServiceWorker(
	zero: WitnessNextKilledbygoogleV3ZeroServiceWorker | undefined,
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
		throw new Error(`KilledByGoogle v3 zero-service-worker evidence differs: ${label}`);
}

function assertConsoleErrorInventory(
	inventory: WitnessConsoleErrorInventory | undefined,
	lane: 'baseline' | 'migrated',
	label: string,
): void {
	const pinned = WITNESS_NEXT_KILLEDBYGOOGLE_V3_CONSOLE_ERRORS[lane].map((entry) => ({
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
		throw new Error(`KilledByGoogle v3 console-error inventory differs: ${label}`);
}

function assertFailedRequestInventory(
	inventory: WitnessFailedRequestInventory | undefined,
	lane: 'baseline' | 'migrated',
	label: string,
): void {
	const pinned = WITNESS_NEXT_KILLEDBYGOOGLE_V3_FAILED_REQUESTS[lane].map((entry) => ({
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
		throw new Error(`KilledByGoogle v3 failed-request inventory differs: ${label}`);
}

/**
 * Query-freedom, checked rather than trusted, on every path recorded for a
 * request outside loopback. A `?` here would mean the construction that keeps
 * account identifiers out of published receipts had failed upstream, so it fails
 * loudly instead of being published quietly.
 */
function assertQueryFreeNonLoopbackPaths(paths: readonly string[], label: string): void {
	for (const path of paths) {
		if (path.startsWith('/')) continue;
		if (path.includes('?') || path.includes('#'))
			throw new Error(`KilledByGoogle v3 non-loopback path is not query-free: ${label}`);
	}
}

function assertMockedSeams(
	inventory: WitnessMockedNonLoopbackSeamInventory | undefined,
	lane: 'baseline' | 'migrated',
	label: string,
): void {
	const pinned = WITNESS_NEXT_KILLEDBYGOOGLE_V3_MOCKED_SEAMS[lane].map((entry) => ({
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
		throw new Error(`KilledByGoogle v3 mocked non-loopback seam inventory differs: ${label}`);
	assertQueryFreeNonLoopbackPaths(
		[...inventory.category, ...inventory.observed, ...inventory.absent].map(
			(entry) => entry.path,
		),
		`${label} mocked seams`,
	);
}

/**
 * The scroll claim, checked against the surface that actually exists: the
 * document must genuinely overflow the stated viewport, the gesture must have
 * started from the top, and the wheel must have moved it.
 */
function assertScrollSurface(surface: WitnessScrollSurface | undefined, label: string): void {
	if (
		surface === undefined ||
		surface.state !== 'measured-genuine-viewport-scroll' ||
		surface.route !== WITNESS_NEXT_KILLEDBYGOOGLE_V3_ROUTES[0] ||
		surface.viewport.width !== WITNESS_NEXT_KILLEDBYGOOGLE_V3_VIEWPORT.width ||
		surface.viewport.height !== WITNESS_NEXT_KILLEDBYGOOGLE_V3_VIEWPORT.height ||
		surface.clientHeight !== WITNESS_NEXT_KILLEDBYGOOGLE_V3_VIEWPORT.height ||
		surface.scrollHeight <= surface.clientHeight ||
		surface.wheelDeltaY <= 0 ||
		surface.scrolledFromTop !== true ||
		surface.scrolled !== true
	)
		throw new Error(`KilledByGoogle v3 scroll surface differs: ${label}`);
}

function assertRenderedStyles(
	styles: WitnessRenderedStyleEvidence | undefined,
	label: string,
): void {
	if (
		styles === undefined ||
		styles.state !== 'measured-resolved-styles' ||
		!Array.isArray(styles.probes) ||
		styles.probes.length !== WITNESS_NEXT_KILLEDBYGOOGLE_V3_STYLE_PROBES ||
		new Set(styles.probes.map((probe) => probe.label)).size !== styles.probes.length ||
		styles.probes.some(
			(probe: WitnessRenderedStyleMeasurement) =>
				probe.label.length === 0 ||
				probe.selector.length === 0 ||
				!Number.isFinite(probe.width) ||
				!Number.isFinite(probe.height) ||
				probe.height <= 0 ||
				Object.keys(probe.properties).length === 0 ||
				Object.values(probe.properties).some((value) => value.length === 0),
		)
	)
		throw new Error(`KilledByGoogle v3 rendered-style evidence differs: ${label}`);
}

const counts = (
	value: WitnessNextKilledbygoogleV3Counts | undefined,
	records: number,
): boolean =>
	value !== undefined &&
	value.records === records &&
	value.listItems === records + WITNESS_NEXT_KILLEDBYGOOGLE_V3_AD_LIST_ITEMS;

/**
 * The graveyard journey, checked fact by fact against the record that would show
 * it failing rather than against a boolean the runner could have set.
 *
 * Every count is checked twice over — the records, and the list items the
 * advertising slot adds one to — because the application's own arithmetic is
 * part of what is being proved.
 */
function assertGraveyardEvidence(
	evidence: WitnessNextKilledbygoogleV3GraveyardEvidence | undefined,
	label: string,
): void {
	if (evidence === null || evidence === undefined || typeof evidence !== 'object')
		throw new Error(`KilledByGoogle v3 graveyard evidence is absent: ${label}`);
	const list = evidence.renderedList;
	if (
		list === undefined ||
		list.state !== 'measured-settled-list-dom' ||
		list.records !== WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECORDS ||
		list.listItems !== WITNESS_NEXT_KILLEDBYGOOGLE_V3_LIST_ITEMS ||
		list.adListItems !== WITNESS_NEXT_KILLEDBYGOOGLE_V3_AD_LIST_ITEMS ||
		list.records + list.adListItems !== list.listItems ||
		list.contentScheme !== 'sha256(canonicalize([{name,items}] in document order))' ||
		typeof list.contentSha256 !== 'string' ||
		list.contentSha256.length !== 64 ||
		list.firstRecord?.name.length === 0 ||
		list.firstRecord?.description.length === 0 ||
		list.lastRecord?.name.length === 0 ||
		list.lastRecord?.description.length === 0 ||
		list.firstRecord.name === list.lastRecord.name
	)
		throw new Error(`KilledByGoogle v3 rendered-list evidence differs: ${label}`);
	const search = evidence.search;
	if (
		search === undefined ||
		search.state !== 'measured-narrow-and-widen' ||
		search.term !== WITNESS_NEXT_KILLEDBYGOOGLE_V3_SEARCH_TERM ||
		search.gesture !== 'typed-into-the-search-box' ||
		search.wideningGesture !== 'select-all-then-backspace' ||
		!counts(search.beforeSearch, WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECORDS) ||
		!counts(search.narrowed, WITNESS_NEXT_KILLEDBYGOOGLE_V3_SEARCH_RECORDS) ||
		!counts(search.afterClear, WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECORDS)
	)
		throw new Error(`KilledByGoogle v3 search evidence differs: ${label}`);
	const filter = evidence.typeFilter;
	if (
		filter === undefined ||
		filter.state !== 'measured-select-narrowing' ||
		filter.control !== 'react-select-filter-select' ||
		filter.keyboard?.gesture !== 'typed-then-enter' ||
		filter.keyboard.option !== WITNESS_NEXT_KILLEDBYGOOGLE_V3_KEYBOARD_FILTER ||
		!counts(filter.keyboard.counts, WITNESS_NEXT_KILLEDBYGOOGLE_V3_KEYBOARD_FILTER_RECORDS) ||
		filter.click?.gesture !== 'menu-opened-and-option-clicked' ||
		filter.click.optionId.length === 0 ||
		filter.click.option !== WITNESS_NEXT_KILLEDBYGOOGLE_V3_CLICK_FILTER ||
		!counts(filter.click.counts, WITNESS_NEXT_KILLEDBYGOOGLE_V3_CLICK_FILTER_RECORDS)
	)
		throw new Error(`KilledByGoogle v3 type-filter evidence differs: ${label}`);
	const compound = evidence.compound;
	if (
		compound === undefined ||
		compound.state !== 'measured-compound-narrowing' ||
		compound.filter !== WITNESS_NEXT_KILLEDBYGOOGLE_V3_CLICK_FILTER ||
		compound.term !== WITNESS_NEXT_KILLEDBYGOOGLE_V3_COMPOUND_TERM ||
		compound.fullClearGesture !== 'search-cleared-then-filter-returned-to-all' ||
		!counts(compound.counts, WITNESS_NEXT_KILLEDBYGOOGLE_V3_COMPOUND_RECORDS) ||
		compound.counts.records >= WITNESS_NEXT_KILLEDBYGOOGLE_V3_CLICK_FILTER_RECORDS ||
		!counts(compound.afterFullClear, WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECORDS)
	)
		throw new Error(`KilledByGoogle v3 compound-narrowing evidence differs: ${label}`);
	const advertisement = evidence.adSlot;
	if (
		advertisement === undefined ||
		advertisement.state !== 'measured-non-data-list-item' ||
		advertisement.selector.length === 0 ||
		advertisement.recordTitles !== 0 ||
		advertisement.countedInListItems !== true ||
		advertisement.countedInRecords !== false
	)
		throw new Error(`KilledByGoogle v3 advertising-slot evidence differs: ${label}`);
	const restore = evidence.reloadRestore;
	if (
		restore === undefined ||
		restore.state !== 'measured-initial-state-restored' ||
		!counts(restore.counts, WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECORDS) ||
		restore.searchValue !== '' ||
		restore.filterLabel !== WITNESS_NEXT_KILLEDBYGOOGLE_V3_ALL_FILTER ||
		!exact(restore.localStorageKeys, []) ||
		!exact(restore.sessionStorageKeys, []) ||
		restore.backend !== 'none' ||
		restore.survivesOnlineReload !== false
	)
		throw new Error(`KilledByGoogle v3 reload-restore evidence differs: ${label}`);
}

/**
 * The route sequence. This application has exactly one route and no router, so
 * every recorded navigation must be that route: the journey's own document
 * reload is the only navigation there is to record.
 */
function assertRoutes(routes: string[] | undefined, label: string): void {
	const distinct = [...new Set(routes ?? [])];
	if (
		routes === undefined ||
		routes.length < 1 ||
		routes.some((route) => route !== WITNESS_NEXT_KILLEDBYGOOGLE_V3_ROUTES[0]) ||
		!exact(distinct, WITNESS_NEXT_KILLEDBYGOOGLE_V3_ROUTES)
	)
		throw new Error(`KilledByGoogle v3 route sequence differs: ${label}`);
}

function assertRollups(receipt: WitnessNextKilledbygoogleV3Receipt): void {
	const seams = receipt.mockedNonLoopbackSeams;
	if (
		seams === undefined ||
		seams.pathPolicy !== WITNESS_NON_LOOPBACK_QUERY_FREE_PATH_RULE ||
		!exact(seams.category, WITNESS_NEXT_KILLEDBYGOOGLE_V3_MOCKED_SEAMS) ||
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
		throw new Error('KilledByGoogle v3 mocked non-loopback seam roll-up differs');
}

export function parseWitnessNextKilledbygoogleV3Receipt(
	value: unknown,
): WitnessNextKilledbygoogleV3Receipt {
	if (value === null || typeof value !== 'object' || Array.isArray(value))
		throw new Error('KilledByGoogle v3 Witness receipt must be an object');
	const receipt = value as WitnessNextKilledbygoogleV3Receipt;
	const expectedRuns = new Set(['baseline:1', 'baseline:2', 'migrated:1', 'migrated:2']);
	const behaviors = new Set<string>();
	const listDigests = new Set<string>();
	if (
		receipt.schemaVersion !== WITNESS_NEXT_KILLEDBYGOOGLE_V3_SCHEMA ||
		receipt.result !== 'pass' ||
		receipt.fixture !== NEXT_KILLEDBYGOOGLE_V3_FIXTURE ||
		!exact(receipt.source, NEXT_KILLEDBYGOOGLE_V3_SOURCE) ||
		!exact(receipt.canonicalReceipt, NEXT_KILLEDBYGOOGLE_V3_CANONICAL_RECEIPT) ||
		!Array.isArray(receipt.runs) ||
		receipt.runs.length !== 4
	)
		throw new Error('KilledByGoogle v3 Witness binding differs');
	for (const run of receipt.runs) {
		const key = `${run.lane}:${run.pass}`;
		if (
			!expectedRuns.delete(key) ||
			run.app !== NEXT_KILLEDBYGOOGLE_V3_APP ||
			run.framework !== 'next' ||
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
			run.scrollAbsence !== undefined ||
			run.interactions.length === 0 ||
			[...new Set(run.interactions.map((interaction) => interaction.kind))]
				.sort()
				.join(',') !== 'click,hover,press,scroll,type' ||
			!exact(run.witnessRecord.trackedEventCounts, receipt.trackedEvents) ||
			run.semanticDigest !== witnessNextKilledbygoogleV3RawDigest(run) ||
			run.behaviorDigest !== witnessNextKilledbygoogleV3BehaviorDigest(run)
		)
			throw new Error(`KilledByGoogle v3 Witness run differs: ${key}`);
		assertRoutes(run.routes, key);
		assertZeroServiceWorker(run.zeroServiceWorker, key);
		assertConsoleErrorInventory(run.consoleErrorInventory, run.lane, key);
		assertFailedRequestInventory(run.failedRequestInventory, run.lane, key);
		assertMockedSeams(run.mockedNonLoopbackSeams, run.lane, key);
		assertRenderedStyles(run.renderedStyles, key);
		assertGraveyardEvidence(run.applicationJourney, key);
		assertScrollSurface(run.scrollSurface, key);
		behaviors.add(run.behaviorDigest);
		listDigests.add(run.applicationJourney.renderedList.contentSha256);
	}
	assertRenderedStyles(receipt.renderedStyles, 'receipt');
	assertScrollSurface(receipt.scrollSurface, 'receipt');
	assertRollups(receipt);
	const trackedEventNames = Object.keys(receipt.trackedEvents ?? {});
	if (
		expectedRuns.size !== 0 ||
		behaviors.size !== 1 ||
		// The lift's central question, checked directly: the pre-rendered
		// document and the client-mounted one settled to the same list.
		listDigests.size !== 1 ||
		trackedEventNames.length === 0 ||
		// Every published count is a measured non-negative integer and every run
		// reproduced the whole set exactly. A zero is kept rather than dropped:
		// this journey tracks `change` and never provokes one, because the
		// application's controls are React-controlled and re-render on `input`,
		// and recording that measured zero is worth more than quietly not
		// looking for it.
		trackedEventNames.some(
			(name) =>
				!Number.isInteger(receipt.trackedEvents[name]) ||
				(receipt.trackedEvents[name] ?? -1) < 0,
		) ||
		Object.values(receipt.trackedEvents).reduce((sum, count) => sum + count, 0) < 1 ||
		!exact(receipt.renderedStyles, receipt.runs[0]!.renderedStyles) ||
		!exact(receipt.scrollSurface, receipt.runs[0]!.scrollSurface) ||
		!exact(receipt.consoleErrors, WITNESS_NEXT_KILLEDBYGOOGLE_V3_CONSOLE_ERRORS) ||
		!exact(receipt.failedRequests, WITNESS_NEXT_KILLEDBYGOOGLE_V3_FAILED_REQUESTS) ||
		!exact(receipt.serviceWorker, WITNESS_NEXT_KILLEDBYGOOGLE_V3_SERVICE_WORKER) ||
		!exact(
			receipt.scriptExecutionDifference,
			WITNESS_NEXT_KILLEDBYGOOGLE_V3_SCRIPT_EXECUTION_DIFFERENCE,
		) ||
		!exact(
			receipt.routerHistoryDifference,
			WITNESS_NEXT_KILLEDBYGOOGLE_V3_ROUTER_HISTORY_DIFFERENCE,
		) ||
		// Each lane recorded exactly the navigations the published difference
		// says it did, checked against the runs rather than taken on trust.
		receipt.runs.some(
			(run) =>
				run.routes.length !==
				(run.lane === 'baseline'
					? WITNESS_NEXT_KILLEDBYGOOGLE_V3_ROUTER_HISTORY_DIFFERENCE.eraRecordedNavigations
					: WITNESS_NEXT_KILLEDBYGOOGLE_V3_ROUTER_HISTORY_DIFFERENCE
							.migratedRecordedNavigations),
		) ||
		receipt.buildLanes?.baseline?.files !== 41 ||
		receipt.buildLanes.baseline.digest !==
			NEXT_KILLEDBYGOOGLE_V3_CANONICAL_RECEIPT.eraLaneDigest ||
		receipt.buildLanes.migrated?.files !== 27 ||
		receipt.buildLanes.migrated.digest !==
			NEXT_KILLEDBYGOOGLE_V3_CANONICAL_RECEIPT.targetLaneDigest ||
		!exact(receipt.documentDelivery, {
			baseline: 'pre-rendered-application-document',
			migrated: 'client-mounted-application-document',
			baselineIndexBytes: 291004,
			migratedIndexBytes: 268,
			parityOracle: 'settled-dom-and-behaviour',
			byteParity: 'not-claimed',
		}) ||
		!exact(receipt.persistence, {
			store: 'in-memory-react-state',
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
		receipt.readiness?.nextLineage?.counted !== false ||
		!Number.isInteger(receipt.readiness.nextLineage.ready) ||
		!Number.isInteger(receipt.readiness.nextLineage.total) ||
		receipt.readiness.nextLineage.ready > receipt.readiness.nextLineage.total ||
		!Number.isInteger(receipt.readiness.overall.ready) ||
		!Number.isInteger(receipt.readiness.overall.total) ||
		receipt.readiness.overall.ready > receipt.readiness.overall.total ||
		receipt.locality?.mode !== 'offline' ||
		receipt.locality.successfulNonLoopback !== 0 ||
		receipt.locality.mockedNonLoopbackSeams !==
			WITNESS_NEXT_KILLEDBYGOOGLE_V3_MOCKED_SEAMS.baseline.length ||
		receipt.locality.osWideIsolation !== false ||
		!Array.isArray(receipt.nonclaims) ||
		receipt.nonclaims.length === 0 ||
		!receipt.nonclaims.some((claim) => claim.includes('single authored route')) ||
		receipt.integrity?.algorithm !== 'sha256' ||
		receipt.integrity.canonicalDigest !== witnessNextKilledbygoogleV3Digest(receipt)
	)
		throw new Error('KilledByGoogle v3 Witness integrity differs');
	return receipt;
}

export function renderWitnessNextKilledbygoogleV3Receipt(
	receipt: WitnessNextKilledbygoogleV3Receipt,
): string {
	const journey = receipt.runs[0]!.applicationJourney;
	const styles = receipt.renderedStyles.probes
		.map(
			(probe) =>
				`${probe.label} ${probe.width}x${probe.height} ${Object.entries(probe.properties)
					.map(([property, value]) => `${property}=${value}`)
					.join(' ')}`,
		)
		.join('; ');
	const seamLine = (lane: 'baseline' | 'migrated'): string =>
		receipt.mockedNonLoopbackSeams.category[lane]
			.map((entry) => `${entry.method} ${entry.path}`)
			.join(', ');
	const seamInstances = receipt.mockedNonLoopbackSeams.instances
		.map(
			(instance) =>
				`${instance.lane} pass ${instance.pass}: ${instance.observed
					.map((observed) => `${observed.requests}x ${observed.path} (${observed.statuses.join('/')})`)
					.join('; ')}${instance.absent.length === 0 ? '' : `; absent ${instance.absent.map((entry) => entry.path).join(', ')}`}`,
		)
		.join(' | ');
	const trackedEvents = Object.entries(receipt.trackedEvents)
		.map(([name, count]) => `${name} ${count}`)
		.join(', ');
	return `# killedbygoogle @56809c3 — direct Witness browser proof of the LEGACY-NEXT static-export lift

- Result: pass
- Canonical SHA-256: ${receipt.integrity.canonicalDigest}
- Runs: 2 era-pinned baseline + 2 migrated production-static browser journeys
- Behavioral parity: ${receipt.runs[0]!.behaviorDigest}
- Build lanes: era ${receipt.buildLanes.baseline.framework} / ${receipt.buildLanes.baseline.bundler} on ${receipt.buildLanes.baseline.node} (${receipt.buildLanes.baseline.files} files, ${receipt.buildLanes.baseline.digest.slice(0, 12)}) against migrated ${receipt.buildLanes.migrated.framework} / ${receipt.buildLanes.migrated.bundler} on ${receipt.buildLanes.migrated.node} (${receipt.buildLanes.migrated.files} files, ${receipt.buildLanes.migrated.digest.slice(0, 12)})
- Bound build receipt: \`${receipt.canonicalReceipt.path}\` (${receipt.canonicalReceipt.sha256.slice(0, 12)}), whose two lane digests were recomputed from the served directories before any browser was launched
- Document delivery: the era lane serves a ${receipt.documentDelivery.baselineIndexBytes}-byte ${receipt.documentDelivery.baseline}; the migrated lane serves a ${receipt.documentDelivery.migratedIndexBytes}-byte ${receipt.documentDelivery.migrated}. Byte parity is ${receipt.documentDelivery.byteParity}; the oracle is ${receipt.documentDelivery.parityOracle}
- Rendered list: both lanes settle to ${journey.renderedList.records} records inside ${journey.renderedList.listItems} list items, in the same order with the same text, digest ${journey.renderedList.contentSha256.slice(0, 12)} (${journey.renderedList.contentScheme}); first "${journey.renderedList.firstRecord.name}", last "${journey.renderedList.lastRecord.name}"
- Advertising slot: ${journey.adSlot.state} at \`${journey.adSlot.selector}\` — it carries ${journey.adSlot.recordTitles} record titles, is counted in list items and never in records, which is why every count below is published twice
- Search: "${journey.search.term}" typed into the search box narrows ${journey.search.beforeSearch.records}/${journey.search.beforeSearch.listItems} to ${journey.search.narrowed.records}/${journey.search.narrowed.listItems} records/list items, and a ${journey.search.wideningGesture} clear restores ${journey.search.afterClear.records}/${journey.search.afterClear.listItems}
- Type filter: keyboard selection of ${journey.typeFilter.keyboard.option} gives ${journey.typeFilter.keyboard.counts.records}/${journey.typeFilter.keyboard.counts.listItems}; opening the menu and clicking ${journey.typeFilter.click.option} gives ${journey.typeFilter.click.counts.records}/${journey.typeFilter.click.counts.listItems}
- Compound: ${journey.compound.filter} narrowed by "${journey.compound.term}" gives ${journey.compound.counts.records}/${journey.compound.counts.listItems}, and a full clear restores ${journey.compound.afterFullClear.records}/${journey.compound.afterFullClear.listItems}
- Reload: an online reload restores ${journey.reloadRestore.counts.records}/${journey.reloadRestore.counts.listItems} with an empty search box and the ${journey.reloadRestore.filterLabel} filter; nothing is written to browser storage and there is no backend
- Routes: every recorded navigation is ${WITNESS_NEXT_KILLEDBYGOOGLE_V3_ROUTES.join(' → ')}, which is the application's only route; no navigation journey is claimed
- Tracked browser events, identical in every lane and pass: ${trackedEvents}
- Service worker: ${receipt.serviceWorker.state}; the context allowed registration and the application never attempted one, so zero registrations, controller, CacheStorage names and worker requests at three checkpoints in every pass
- Console-error inventory (exact, whole journey, per lane): empty in both lanes — any console error at all fails the run
- Failed-request inventory (exact, whole journey, per lane): empty in both lanes; no request failed, because every third-party destination was answered inside the browser context
- Mocked non-loopback seams, answered in-context so none left the machine — era lane: ${seamLine('baseline')}; migrated lane: ${seamLine('migrated')}. ${receipt.mockedNonLoopbackSeams.pathPolicy}
- Mocked seam observations as published: ${seamInstances}
- Recorded lane difference: ${receipt.routerHistoryDifference.difference} — ${receipt.routerHistoryDifference.eraRecordedNavigations} recorded navigations in the era lane against ${receipt.routerHistoryDifference.migratedRecordedNavigations} in the migrated one, all of them ${receipt.routerHistoryDifference.route}. Visible consequence: ${receipt.routerHistoryDifference.visibleConsequence}
- Recorded lane difference: ${receipt.scriptExecutionDifference.difference}. ${receipt.scriptExecutionDifference.cause} Visible consequence: ${receipt.scriptExecutionDifference.visibleConsequence}
- Rendered appearance, measured on ${receipt.renderedStyles.probes.length} laid-out elements and identical in both lanes: ${styles}
- Mutation proof: \`${receipt.mutation.seam}\` in \`${receipt.mutation.path}\` at offset ${receipt.mutation.offset} made the journey red, byte-identical restoration made it green again
- Scroll: ${receipt.scrollSurface.state} on ${receipt.scrollSurface.route}, ${receipt.scrollSurface.scrollHeight}/${receipt.scrollSurface.clientHeight} at ${receipt.scrollSurface.viewport.width}x${receipt.scrollSurface.viewport.height}, moved by a ${receipt.scrollSurface.wheelDeltaY}px wheel gesture from the top
- Next lineage readiness: unchanged at ${receipt.readiness.nextLineage.ready}/${receipt.readiness.nextLineage.total}; this vertical is not counted before Judge audit

${receipt.nonclaims.map((claim) => `- ${claim}`).join('\n')}
`;
}

export function witnessNextKilledbygoogleV3AggregateMember(digestValue: string) {
	return {
		id: 'witness-next-killedbygoogle-v3-0-0',
		framework: 'next',
		track: 'production-readiness-direct-witness-next12-static-export-to-vite8-client-build',
		bundler: 'next-12.0.10-vendored-webpack-5-to-vite-8.0.16-rolldown',
		runtime: 'node-16.20.2',
		result: 'pass',
		receipt: WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECEIPT_PATH,
		digest: digestValue,
	};
}

export async function verifyWitnessNextKilledbygoogleV3Evidence(rootDir = '.') {
	const root = resolve(rootDir);
	const receiptPath = join(root, WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECEIPT_PATH);
	const receipt = parseWitnessNextKilledbygoogleV3Receipt(
		JSON.parse(await readFile(receiptPath, 'utf8')),
	);
	const bytes = await readFile(join(root, receipt.canonicalReceipt.path));
	if (sha256(bytes) !== receipt.canonicalReceipt.sha256)
		throw new Error('KilledByGoogle v3 bound build receipt bytes drifted');
	const parsed = JSON.parse(bytes.toString('utf8')) as {
		schemaVersion?: unknown;
		revision?: unknown;
		eraLane?: { digest?: unknown };
		targetLane?: { digest?: unknown };
	};
	if (
		parsed.schemaVersion !== receipt.canonicalReceipt.schemaVersion ||
		parsed.revision !== receipt.source.revision ||
		parsed.eraLane?.digest !== receipt.canonicalReceipt.eraLaneDigest ||
		parsed.targetLane?.digest !== receipt.canonicalReceipt.targetLaneDigest
	)
		throw new Error('KilledByGoogle v3 bound build receipt identity differs');
	if (
		(await readFile(join(dirname(receiptPath), 'receipt.md'), 'utf8')) !==
		renderWitnessNextKilledbygoogleV3Receipt(receipt)
	)
		throw new Error('KilledByGoogle v3 human Witness receipt differs');
	return {
		valid: true as const,
		digest: receipt.integrity.canonicalDigest,
		artifacts: 0,
		receipt,
	};
}
