import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'pathe';
import { canonicalize, sha256 } from './canonicalize.ts';
import type {
	WitnessConsoleErrorInventory,
	WitnessConsoleErrorInventoryEntry,
	WitnessFailedRequestInventory,
	WitnessFailedRequestInventoryEntry,
	WitnessMeasuredScrollAbsence,
	WitnessRealAppRun,
	WitnessRenderedStyleEvidence,
} from './witness-real-app.ts';

/**
 * One declared appearance probe. The runner takes the measurement off the live
 * page; this is the closed list of what it is required to measure, held here so
 * the published receipt can be checked against it rather than against whatever
 * the runner happened to ask for.
 */
export type WitnessReactMemosStyleProbe = {
	label: string;
	selector: string;
	properties: readonly string[];
};

export const WITNESS_REACT_MEMOS_SCHEMA = 'versionless.witness-react-memos.v1' as const;
export const WITNESS_REACT_MEMOS_RECEIPT_PATH =
	'evidence/runs/witness-react-memos-v0-1-3/receipt.json' as const;
export const REACT_MEMOS_FIXTURE = 'react-memos-v0-1-3' as const;

/**
 * The retained build-lane receipt this browser proof stands on.
 *
 * It is bound by the sha256 of its EXACT BYTES rather than by a declared
 * `integrity.canonicalDigest`, because this vertical's build-lane receipt
 * carries no such field. A byte digest over the whole file is a binding of the
 * same strength — it simply says so instead of borrowing a field that is not
 * there.
 */
export const REACT_MEMOS_BUILD_LANES_PATH =
	'evidence/runs/react-memos-v0-1-3/t006-build-lanes.json' as const;
export const REACT_MEMOS_BUILD_LANES_SHA256 =
	'9d0139c40d273eeb8b97d831116aaf52f80e35409444c8cee6173e8876d600aa' as const;
export const REACT_MEMOS_BUILD_LANES_BINDING = 'sha256-over-the-exact-bytes' as const;
export const REACT_MEMOS_BUILD_LANES_BINDING_REASON =
	'the retained build-lane receipt for this vertical declares no integrity.canonicalDigest, so the browser proof binds it by the sha256 of its exact bytes rather than by a field it does not carry' as const;
export const REACT_MEMOS_LANES_UNIT = 'lrapr-t006/u6-memos-migration-lanes' as const;

/**
 * The immutable source identity, bound here so the browser-proof receipt cannot
 * silently rebind itself to a different revision or archive. `v0.1.3` is a
 * LIGHTWEIGHT tag — a direct pointer to the commit, with no tag object to
 * verify — and the ingested cell is the `web/` subtree of a Go/React monorepo.
 */
export const REACT_MEMOS_SOURCE = Object.freeze({
	repository: 'https://github.com/usememos/memos',
	ref: 'refs/tags/v0.1.3',
	tagKind: 'lightweight',
	tagVerification: 'not-applicable-no-tag-object',
	revision: '565fe0cc567c02deb59fc04830df707ea7476d52',
	archiveSha256: '184834df7e2ea0272d21b4b0bfd7366986bc0aded740442aac91ca58d270f391',
	frontendRoot: 'web',
	monorepo: true,
	license: 'MIT',
	licenseNote:
		'the grant rests on the repository-root LICENSE file; web/package.json declares no license field',
});

/**
 * The era build deviation, carried into the browser proof rather than left in
 * the build-lane receipt for a reader to go and find.
 *
 * The repository's own declared build is `tsc && vite build`, and at this
 * revision the tsc gate FAILS. The era lane therefore runs `vite build` alone.
 * That is a labelled deviation from the declared build, and every claim this
 * receipt makes about the baseline lane stands on the deviated command.
 */
export const REACT_MEMOS_ERA_BUILD_DEVIATION = Object.freeze({
	lane: 'baseline',
	declaredBuildCommand: 'yarn build (tsc && vite build)',
	declaredBuildCommandOutcomeAtThisRevision:
		'fails, exit 2, inside the tsc gate; four errors, all in node_modules, none under src',
	commandRun: 'node node_modules/vite/bin/vite.js build',
	ruling: 'a labelled deviation, not the declared build',
	carriedFrom: REACT_MEMOS_BUILD_LANES_PATH,
});

/**
 * The migration class, carried from the same build-lane receipt. This is the
 * portfolio's first migration whose ORIGIN bundler is Vite itself, which is why
 * the vertical exists at all.
 */
export const REACT_MEMOS_MIGRATION_CLASS = Object.freeze({
	migrationClass: 'OLD-VITE-ORIGIN',
	baselineBundler: 'vite 2.9.5',
	targetBundler: 'vite 8.0.16 (rolldown 1.0.3)',
	baselineRuntime: 'node 16.20.2',
	targetRuntime: 'node 24.15.0',
	carriedFrom: REACT_MEMOS_BUILD_LANES_PATH,
});

/**
 * The frozen projection this proof talks to, pinned by digest in the receipt
 * schema so a journey cannot quietly reshape the API underneath its own
 * assertions.
 */
export const REACT_MEMOS_PROJECTION_LABEL = 'synthetic-fixture-evidence-data' as const;
export const REACT_MEMOS_PROJECTION_BEHAVIOR_DIGEST =
	'b17da56bba70249f1d3b25b2837083b80ba0ae8c1c2899f710fc1eaf9b059902' as const;
export const REACT_MEMOS_PROJECTION_SEED_FIXTURE =
	'fixtures/react-memos-v0-1-3/witness-projection-seed.json' as const;

/**
 * The recorded seed amendment, referenced here so the published receipt states
 * which credentials moved and what the digests were before they did.
 *
 * The projection's behaviour is frozen precisely so a journey cannot drift it.
 * That freeze is not a reason to keep a seed the pinned application's own
 * client-side validator rejects, and under the recorded ruling the owner pair —
 * and only the owner pair — was replaced. Both digests below are the superseded
 * ones.
 */
export const REACT_MEMOS_SEED_AMENDMENT = Object.freeze({
	unit: 'lrapr-t006/u12b-memos-seed-and-witness',
	scope: 'credentials-only — the seeded owner email, the owner name derived from it, and the owner passphrase',
	supersededSeedSha256: 'cf422f2cda23b4c777d27b2bccd68a24b53cac027dbe57347e1b150fc8cdb7ff',
	supersededBehaviorDigest: '1672b43f0f01379b74890013cf145ed87164873cff037d4b6ace072a1fa79493',
});

/** Both lanes are observed at this size, so every extent below is comparable. */
export const WITNESS_REACT_MEMOS_VIEWPORT = Object.freeze({ width: 1280, height: 720 });

/**
 * Exact console-error inventory, per lane, for the whole journey.
 *
 * The single pinned entry is the application's own session gate observed from
 * the outside: `pages/Home.tsx` asks `GET /api/user/me` before a session
 * exists, the projection answers 401, and Chromium logs the failed load. That
 * refusal is the gate working. Any console error outside this inventory fails
 * the run.
 */
export const WITNESS_REACT_MEMOS_CONSOLE_ERRORS = Object.freeze({
	baseline: Object.freeze([
		Object.freeze({
			message:
				'Failed to load resource: the server responded with a status of 401 (Unauthorized)',
			count: 1,
		}),
	]),
	migrated: Object.freeze([
		Object.freeze({
			message:
				'Failed to load resource: the server responded with a status of 401 (Unauthorized)',
			count: 1,
		}),
	]),
}) as Readonly<Record<'baseline' | 'migrated', readonly WitnessConsoleErrorInventoryEntry[]>>;

/**
 * Exact failed-request inventory, per lane. Both lanes are empty: every request
 * this journey makes is answered by the bounded loopback origin or by the
 * frozen projection behind it, and the 401 above is a completed response rather
 * than a transport failure.
 */
export const WITNESS_REACT_MEMOS_FAILED_REQUESTS = Object.freeze({
	baseline: Object.freeze([]),
	migrated: Object.freeze([]),
}) as Readonly<Record<'baseline' | 'migrated', readonly WitnessFailedRequestInventoryEntry[]>>;

/**
 * The two routes this application's router knows, transcribed from
 * `routers/appRouter.tsx`: a signin page and a catch-all that is the home page.
 * Anything else the address bar holds is normalized to `/` by the application's
 * own `getValidPathname`, so the recorded sequence can only ever be drawn from
 * these two.
 */
export const WITNESS_REACT_MEMOS_ROUTER_ROUTES = Object.freeze(['/signin', '/']);

/**
 * The rendered-appearance probes, measured on the signed-in home route in both
 * lanes. The baseline ships a Vite 2 stylesheet and the migrated lane ships a
 * Vite 8 one whose bytes differ; whether the two still resolve to the same page
 * is a genuine open question about the migration, and these probes answer it by
 * measurement rather than by argument.
 */
export const WITNESS_REACT_MEMOS_STYLE_PROBES = Object.freeze([
	Object.freeze({
		label: 'document-body',
		selector: 'body',
		properties: Object.freeze(['font-family', 'background-color', 'color', 'margin']),
	}),
	Object.freeze({
		label: 'sidebar',
		selector: '.sidebar-wrapper',
		properties: Object.freeze(['background-color', 'display', 'flex-direction', 'padding']),
	}),
	Object.freeze({
		label: 'memo-editor',
		selector: '.memo-editor-container',
		properties: Object.freeze(['background-color', 'border-radius', 'padding', 'display']),
	}),
	Object.freeze({
		label: 'memo-card',
		selector: '.memo-wrapper.memos-1',
		properties: Object.freeze(['background-color', 'border-radius', 'padding', 'color']),
	}),
	Object.freeze({
		label: 'editor-save-button',
		selector: '.memo-editor-container .confirm-btn',
		properties: Object.freeze(['background-color', 'color', 'border-radius', 'font-size']),
	}),
]) as readonly WitnessReactMemosStyleProbe[];

/**
 * Deterministic tracked-event floor. The clicked, typed and keyed counts are
 * exact and identical in every lane and pass. Incidental `mouseover` events
 * depend on the pointer path the host takes between the genuine hovers, so the
 * count is bounded from below by those hovers rather than pinned to an unstable
 * number. The bound is checked, not erased.
 */
export const WITNESS_REACT_MEMOS_TRACKED_EVENTS = Object.freeze({
	click: 12,
	input: 116,
	keydown: 120,
	mouseoverAtLeast: 3,
});

/** One projection ledger line, tallied by identity rather than by sequence. */
export type WitnessReactMemosLedgerEntry = {
	method: string;
	pathname: string;
	endpoint: string | null;
	decision: string;
	status: number | null;
	count: number;
};

export type WitnessReactMemosJourney = {
	projection: {
		state: 'frozen-synthetic-loopback-projection';
		label: typeof REACT_MEMOS_PROJECTION_LABEL;
		pinnedRevision: string;
		behaviorDigest: typeof REACT_MEMOS_PROJECTION_BEHAVIOR_DIGEST;
		seedSha256: string;
		transport: 'same-origin-bounded-loopback-api';
		/**
		 * Every decision the projection took in this run.
		 *
		 * The loopback seam sees every request the origin serves, not only the
		 * `/api` ones, so `declinedNonApi` is the count of static-asset requests
		 * that passed through the seam untouched and fell through to the file
		 * server. It is recorded rather than filtered away: the number is what
		 * makes "the API surface is exactly this" checkable against the whole
		 * traffic the origin saw.
		 */
		ledger: {
			state: 'measured-projection-ledger';
			records: number;
			apiRecords: number;
			served: number;
			refusedUnknown: number;
			refusedUnprojected: number;
			declinedNonApi: number;
			entries: WitnessReactMemosLedgerEntry[];
		};
	};
	gate: {
		state: 'measured-session-gate';
		signedOutStatus: 401;
		signedOutRoute: '/signin';
		signedInRoute: '/';
		signedInBy: "the application's own Signin form";
		owner: string;
		ownerPassesPinnedValidator: true;
	};
	compose: {
		state: 'measured-memo-created';
		content: string;
		memoId: number;
		listBefore: number;
		listAfter: number;
		endpoint: 'memo.create';
		status: 200;
	};
	search: {
		state: 'measured-client-side-narrowing';
		term: string;
		beforeFilter: number;
		narrowed: number;
		afterClear: number;
		wideningGesture: 'select-all-then-backspace';
		apiRecordsDuringFilter: 0;
		apiOriginRequestsDuringFilter: 0;
		/**
		 * Static-asset requests the browser made while the filter narrowed.
		 * They are not zero and saying so is the point: the origin answers
		 * `cache-control: no-store`, so the icons inside a re-rendered memo card
		 * are fetched again. None of them is an API call, which is the claim.
		 */
		assetRequestsDuringFilter: number;
	};
	tagFilter: {
		state: 'measured-client-side-tag-filter';
		tags: string[];
		tag: string;
		narrowed: number;
		afterRestore: number;
		apiRecordsDuringFilter: 0;
		apiOriginRequestsDuringFilter: 0;
		assetRequestsDuringFilter: number;
	};
	archive: {
		state: 'measured-two-click-archive-and-restore';
		memoId: number;
		firstClickLabel: 'Delete';
		confirmLabel: 'Delete!';
		listAfterArchive: number;
		trashEntries: number;
		trashEntriesAfterRestore: number;
		listAfterRestore: number;
		archivedRowStatus: 'ARCHIVED';
		restoredRowStatus: 'NORMAL';
	};
	settings: {
		state: 'measured-account-patch';
		previousName: string;
		nextName: string;
		endpoint: 'user.me.patch';
		method: 'PATCH';
		path: '/api/user/me';
		status: 200;
		renderedUsername: string;
	};
	hover: {
		state: 'measured-hover-revealed-actions';
		selector: string;
		hiddenDisplay: 'none';
		revealedDisplay: 'flex';
	};
	routeExtents: {
		state: 'measured-per-route-document-extents';
		viewport: { width: number; height: number };
		routes: Array<{ route: string; scrollHeight: number; clientHeight: number }>;
	};
};

export type WitnessReactMemosRun = WitnessRealAppRun & {
	consoleErrorInventory: WitnessConsoleErrorInventory;
	failedRequestInventory: WitnessFailedRequestInventory;
	renderedStyles: WitnessRenderedStyleEvidence;
	applicationJourney: WitnessReactMemosJourney;
	scrollAbsence: WitnessMeasuredScrollAbsence;
	behaviorDigest: string;
};

export type WitnessReactMemosMutation = {
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

export type WitnessReactMemosReceipt = {
	schemaVersion: typeof WITNESS_REACT_MEMOS_SCHEMA;
	result: 'pass';
	fixture: typeof REACT_MEMOS_FIXTURE;
	source: typeof REACT_MEMOS_SOURCE;
	provenance: Record<string, unknown>;
	canonicalReceipt: {
		path: typeof REACT_MEMOS_BUILD_LANES_PATH;
		binding: typeof REACT_MEMOS_BUILD_LANES_BINDING;
		bindingReason: typeof REACT_MEMOS_BUILD_LANES_BINDING_REASON;
		sha256: string;
		unit: typeof REACT_MEMOS_LANES_UNIT;
	};
	migrationClass: typeof REACT_MEMOS_MIGRATION_CLASS;
	eraBuildDeviation: typeof REACT_MEMOS_ERA_BUILD_DEVIATION;
	projection: {
		label: typeof REACT_MEMOS_PROJECTION_LABEL;
		pinnedRevision: string;
		behaviorDigest: typeof REACT_MEMOS_PROJECTION_BEHAVIOR_DIGEST;
		seedSha256: string;
		seedFixture: typeof REACT_MEMOS_PROJECTION_SEED_FIXTURE;
		amendment: typeof REACT_MEMOS_SEED_AMENDMENT;
	};
	runs: WitnessReactMemosRun[];
	mutation: WitnessReactMemosMutation;
	consoleErrors: Readonly<
		Record<'baseline' | 'migrated', readonly WitnessConsoleErrorInventoryEntry[]>
	>;
	failedRequests: Readonly<
		Record<'baseline' | 'migrated', readonly WitnessFailedRequestInventoryEntry[]>
	>;
	renderedStyleParity: {
		state: 'measured-identical-resolved-styles';
		probes: number;
		lanesAgree: true;
		note: string;
	};
	scrollAbsence: WitnessMeasuredScrollAbsence;
	router: {
		library: 'application-authored-pathname-switch';
		routes: string[];
		fallback: '*';
		navigations: number;
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

export function witnessReactMemosRawDigest(run: WitnessReactMemosRun | WitnessRealAppRun): string {
	const { pass: _pass, result: _result, semanticDigest: _semanticDigest, ...raw } = run;
	const withoutBehavior = { ...raw } as Record<string, unknown>;
	delete withoutBehavior.behaviorDigest;
	return sha256(canonicalize(withoutBehavior));
}

function trackedEventProjection(run: WitnessRealAppRun): Record<string, unknown> {
	const counts = run.witnessRecord.trackedEventCounts;
	const mouseover = counts.mouseover ?? 0;
	if (
		counts.click !== WITNESS_REACT_MEMOS_TRACKED_EVENTS.click ||
		counts.input !== WITNESS_REACT_MEMOS_TRACKED_EVENTS.input ||
		counts.keydown !== WITNESS_REACT_MEMOS_TRACKED_EVENTS.keydown ||
		mouseover < WITNESS_REACT_MEMOS_TRACKED_EVENTS.mouseoverAtLeast ||
		Object.keys(counts).sort().join(',') !== 'click,input,keydown,mouseover'
	)
		throw new Error('React Memos tracked browser events differ');
	return {
		click: counts.click,
		input: counts.input,
		keydown: counts.keydown,
		mouseover: `at-least-${String(
			WITNESS_REACT_MEMOS_TRACKED_EVENTS.mouseoverAtLeast,
		)}-genuine-hovers`,
	};
}

/**
 * Lane-independent behavior projection.
 *
 * Production bytes are lane-specific by construction, so the byte inventory
 * stays in the run record and out of this digest. Everything else the journey
 * measured is lane-independent and participates: the route sequence, the whole
 * application journey — including the projection ledger tally, which is what
 * makes "no request fired while the filter narrowed" a digested claim rather
 * than a sentence — the exact inventories, the measured absence of an
 * overflowing document, and the resolved appearance in both lanes.
 */
export function witnessReactMemosBehaviorDigest(
	run: WitnessReactMemosRun | WitnessRealAppRun,
): string {
	const memos = run as WitnessReactMemosRun;
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
			consoleErrorInventory: memos.consoleErrorInventory,
			failedRequestInventory: memos.failedRequestInventory,
			renderedStyles: memos.renderedStyles,
			applicationJourney: memos.applicationJourney,
			scrollAbsence: memos.scrollAbsence,
			successfulNonLoopback: run.successfulNonLoopback,
		}),
	);
}

export function witnessReactMemosDigest(receipt: WitnessReactMemosReceipt): string {
	const copy = structuredClone(receipt);
	copy.integrity.canonicalDigest = '';
	return sha256(canonicalize(copy));
}

/**
 * Every recorded route must be one of the two the application's own router
 * knows. This application normalizes any other pathname to `/` itself, so a
 * recorded route outside the pair would mean the recording, not the router,
 * invented it.
 */
function assertRouterRoutes(routes: readonly string[], label: string): void {
	for (const route of routes)
		if (!WITNESS_REACT_MEMOS_ROUTER_ROUTES.includes(route))
			throw new Error(
				`React Memos recorded a route outside its own router: ${label} ${route}`,
			);
}

function assertConsoleErrorInventory(
	inventory: WitnessConsoleErrorInventory | undefined,
	lane: 'baseline' | 'migrated',
	label: string,
): void {
	const pinned = [...WITNESS_REACT_MEMOS_CONSOLE_ERRORS[lane]].map((entry) => ({
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
		throw new Error(`React Memos console-error inventory differs: ${label}`);
}

function assertFailedRequestInventory(
	inventory: WitnessFailedRequestInventory | undefined,
	lane: 'baseline' | 'migrated',
	label: string,
): void {
	const pinned = [...WITNESS_REACT_MEMOS_FAILED_REQUESTS[lane]].map((entry) => ({
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
		inventory.total !== 0
	)
		throw new Error(`React Memos failed-request inventory differs: ${label}`);
}

function assertRenderedStyles(
	evidence: WitnessRenderedStyleEvidence | undefined,
	label: string,
): void {
	const probes = WITNESS_REACT_MEMOS_STYLE_PROBES;
	if (
		evidence === undefined ||
		evidence.state !== 'measured-resolved-styles' ||
		evidence.probes.length !== probes.length ||
		!exact(
			evidence.probes.map((probe) => ({
				label: probe.label,
				selector: probe.selector,
				properties: Object.keys(probe.properties).sort(),
			})),
			probes.map((probe) => ({
				label: probe.label,
				selector: probe.selector,
				properties: [...probe.properties].sort(),
			})),
		) ||
		evidence.probes.some((probe) => probe.width <= 0 || probe.height <= 0)
	)
		throw new Error(`React Memos rendered-style measurement differs: ${label}`);
}

/**
 * The measured absence of a scrollable document. This application pins its
 * page wrapper to the viewport and scrolls its own inner panels, so there is no
 * document scroll surface to gesture at and inventing one would be a false
 * claim. Every visited stage is required to have been measured and to have come
 * back non-overflowing.
 */
function assertScrollAbsence(
	absence: WitnessMeasuredScrollAbsence | undefined,
	label: string,
): void {
	if (
		absence === undefined ||
		absence.state !== 'measured-no-overflowing-document' ||
		absence.claimed !== false ||
		absence.viewport.width !== WITNESS_REACT_MEMOS_VIEWPORT.width ||
		absence.viewport.height !== WITNESS_REACT_MEMOS_VIEWPORT.height ||
		absence.routes.length < 5 ||
		absence.documentOverflow.length === 0 ||
		absence.routes.some(
			(route) =>
				route.clientHeight !== WITNESS_REACT_MEMOS_VIEWPORT.height ||
				route.scrollHeight > route.clientHeight,
		)
	)
		throw new Error(`React Memos measured scroll absence differs: ${label}`);
	assertRouterRoutes(
		absence.routes.map((route) => route.route.split(' ')[0] ?? ''),
		label,
	);
}

function assertApplicationJourney(
	journey: WitnessReactMemosJourney | undefined,
	label: string,
): void {
	if (
		journey === undefined ||
		journey.projection?.state !== 'frozen-synthetic-loopback-projection' ||
		journey.projection.label !== REACT_MEMOS_PROJECTION_LABEL ||
		journey.projection.behaviorDigest !== REACT_MEMOS_PROJECTION_BEHAVIOR_DIGEST ||
		journey.projection.transport !== 'same-origin-bounded-loopback-api' ||
		journey.projection.pinnedRevision !== REACT_MEMOS_SOURCE.revision ||
		journey.projection.seedSha256.length !== 64 ||
		journey.projection.ledger?.state !== 'measured-projection-ledger' ||
		journey.projection.ledger.refusedUnknown !== 0 ||
		journey.projection.ledger.refusedUnprojected !== 0 ||
		journey.projection.ledger.declinedNonApi < 1 ||
		journey.projection.ledger.apiRecords < 1 ||
		journey.projection.ledger.records !==
			journey.projection.ledger.apiRecords + journey.projection.ledger.declinedNonApi ||
		journey.projection.ledger.apiRecords !== journey.projection.ledger.served ||
		journey.projection.ledger.entries.length === 0 ||
		journey.projection.ledger.entries.reduce((sum, entry) => sum + entry.count, 0) !==
			journey.projection.ledger.apiRecords ||
		journey.projection.ledger.entries.some(
			(entry) => entry.decision !== 'served' || entry.endpoint === null,
		) ||
		journey.gate?.state !== 'measured-session-gate' ||
		journey.gate.signedOutStatus !== 401 ||
		journey.gate.signedOutRoute !== '/signin' ||
		journey.gate.signedInRoute !== '/' ||
		journey.gate.ownerPassesPinnedValidator !== true ||
		journey.compose?.state !== 'measured-memo-created' ||
		journey.compose.endpoint !== 'memo.create' ||
		journey.compose.status !== 200 ||
		journey.compose.listAfter !== journey.compose.listBefore + 1 ||
		journey.search?.state !== 'measured-client-side-narrowing' ||
		journey.search.beforeFilter !== journey.compose.listAfter ||
		journey.search.afterClear !== journey.search.beforeFilter ||
		journey.search.narrowed >= journey.search.beforeFilter ||
		journey.search.narrowed < 1 ||
		journey.search.wideningGesture !== 'select-all-then-backspace' ||
		journey.search.apiRecordsDuringFilter !== 0 ||
		journey.search.apiOriginRequestsDuringFilter !== 0 ||
		journey.search.assetRequestsDuringFilter < 0 ||
		journey.tagFilter?.state !== 'measured-client-side-tag-filter' ||
		journey.tagFilter.tags.length < 2 ||
		!journey.tagFilter.tags.includes(journey.tagFilter.tag) ||
		journey.tagFilter.narrowed >= journey.tagFilter.afterRestore ||
		journey.tagFilter.narrowed < 1 ||
		journey.tagFilter.apiRecordsDuringFilter !== 0 ||
		journey.tagFilter.apiOriginRequestsDuringFilter !== 0 ||
		journey.tagFilter.assetRequestsDuringFilter < 0 ||
		journey.archive?.state !== 'measured-two-click-archive-and-restore' ||
		journey.archive.firstClickLabel !== 'Delete' ||
		journey.archive.confirmLabel !== 'Delete!' ||
		journey.archive.archivedRowStatus !== 'ARCHIVED' ||
		journey.archive.restoredRowStatus !== 'NORMAL' ||
		journey.archive.listAfterArchive !== journey.archive.listAfterRestore - 1 ||
		journey.archive.trashEntriesAfterRestore !== journey.archive.trashEntries - 1 ||
		journey.settings?.state !== 'measured-account-patch' ||
		journey.settings.endpoint !== 'user.me.patch' ||
		journey.settings.method !== 'PATCH' ||
		journey.settings.path !== '/api/user/me' ||
		journey.settings.status !== 200 ||
		journey.settings.previousName === journey.settings.nextName ||
		journey.settings.renderedUsername !== journey.settings.nextName ||
		journey.hover?.state !== 'measured-hover-revealed-actions' ||
		journey.hover.hiddenDisplay !== 'none' ||
		journey.hover.revealedDisplay !== 'flex' ||
		journey.routeExtents?.state !== 'measured-per-route-document-extents' ||
		journey.routeExtents.routes.length < 5 ||
		journey.routeExtents.viewport.height !== WITNESS_REACT_MEMOS_VIEWPORT.height
	)
		throw new Error(`React Memos application journey evidence differs: ${label}`);
	if (
		!journey.projection.ledger.entries.some(
			(entry) => entry.endpoint === 'memo.create' && entry.status === 200,
		) ||
		!journey.projection.ledger.entries.some(
			(entry) => entry.endpoint === 'user.me.patch' && entry.status === 200,
		)
	)
		throw new Error(`React Memos projection ledger omits a witnessed write: ${label}`);
	assertRouterRoutes(
		journey.routeExtents.routes.map((route) => route.route.split(' ')[0] ?? ''),
		label,
	);
}

export function parseWitnessReactMemosReceipt(value: unknown): WitnessReactMemosReceipt {
	if (value === null || typeof value !== 'object' || Array.isArray(value))
		throw new Error('React Memos Witness receipt must be an object');
	const receipt = value as WitnessReactMemosReceipt;
	const expectedRuns = new Set(['baseline:1', 'baseline:2', 'migrated:1', 'migrated:2']);
	const behaviors = new Set<string>();
	const styles = new Set<string>();
	const routes = new Set<string>();
	if (
		receipt.schemaVersion !== WITNESS_REACT_MEMOS_SCHEMA ||
		receipt.result !== 'pass' ||
		receipt.fixture !== REACT_MEMOS_FIXTURE ||
		!exact(receipt.source, REACT_MEMOS_SOURCE) ||
		!exact(receipt.migrationClass, REACT_MEMOS_MIGRATION_CLASS) ||
		!exact(receipt.eraBuildDeviation, REACT_MEMOS_ERA_BUILD_DEVIATION) ||
		receipt.canonicalReceipt?.path !== REACT_MEMOS_BUILD_LANES_PATH ||
		receipt.canonicalReceipt.binding !== REACT_MEMOS_BUILD_LANES_BINDING ||
		receipt.canonicalReceipt.bindingReason !== REACT_MEMOS_BUILD_LANES_BINDING_REASON ||
		receipt.canonicalReceipt.unit !== REACT_MEMOS_LANES_UNIT ||
		receipt.canonicalReceipt.sha256 !== REACT_MEMOS_BUILD_LANES_SHA256 ||
		receipt.projection?.label !== REACT_MEMOS_PROJECTION_LABEL ||
		receipt.projection.behaviorDigest !== REACT_MEMOS_PROJECTION_BEHAVIOR_DIGEST ||
		receipt.projection.pinnedRevision !== REACT_MEMOS_SOURCE.revision ||
		receipt.projection.seedFixture !== REACT_MEMOS_PROJECTION_SEED_FIXTURE ||
		receipt.projection.seedSha256.length !== 64 ||
		!exact(receipt.projection.amendment, REACT_MEMOS_SEED_AMENDMENT) ||
		!Array.isArray(receipt.runs) ||
		receipt.runs.length !== 4
	)
		throw new Error('React Memos Witness binding differs');
	for (const run of receipt.runs) {
		const key = `${run.lane}:${String(run.pass)}`;
		if (
			!expectedRuns.delete(key) ||
			run.app !== 'react-memos' ||
			run.framework !== 'react' ||
			run.result !== 'pass' ||
			run.cleanPage !== true ||
			run.successfulNonLoopback !== 0 ||
			run.witnessRecord.pageErrors !== 0 ||
			run.witnessRecord.failedRequests !== run.failedRequestInventory?.total ||
			run.witnessRecord.consoleErrors !== run.consoleErrorInventory?.total ||
			run.offlineEvidence.state !== 'not-applicable' ||
			run.observerFinalization.workerEvents.length !== 0 ||
			run.servedStatic.serviceWorkers.length !== 0 ||
			run.semanticDigest !== witnessReactMemosRawDigest(run) ||
			run.behaviorDigest !== witnessReactMemosBehaviorDigest(run)
		)
			throw new Error(`React Memos Witness run differs: ${key}`);
		assertRouterRoutes(run.routes, key);
		assertConsoleErrorInventory(run.consoleErrorInventory, run.lane, key);
		assertFailedRequestInventory(run.failedRequestInventory, run.lane, key);
		assertRenderedStyles(run.renderedStyles, key);
		assertScrollAbsence(run.scrollAbsence, key);
		assertApplicationJourney(run.applicationJourney, key);
		behaviors.add(run.behaviorDigest);
		styles.add(canonicalize(run.renderedStyles));
		routes.add(canonicalize(run.routes));
	}
	assertScrollAbsence(receipt.scrollAbsence, 'receipt');
	if (
		expectedRuns.size !== 0 ||
		behaviors.size !== 1 ||
		styles.size !== 1 ||
		routes.size !== 1 ||
		receipt.renderedStyleParity?.state !== 'measured-identical-resolved-styles' ||
		receipt.renderedStyleParity.lanesAgree !== true ||
		receipt.renderedStyleParity.probes !== WITNESS_REACT_MEMOS_STYLE_PROBES.length ||
		!exact(receipt.consoleErrors, WITNESS_REACT_MEMOS_CONSOLE_ERRORS) ||
		!exact(receipt.failedRequests, WITNESS_REACT_MEMOS_FAILED_REQUESTS) ||
		receipt.router?.library !== 'application-authored-pathname-switch' ||
		receipt.router.fallback !== '*' ||
		!exact(receipt.router.routes, WITNESS_REACT_MEMOS_ROUTER_ROUTES) ||
		receipt.router.navigations !== receipt.runs[0]!.routes.length ||
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
		receipt.integrity.canonicalDigest !== witnessReactMemosDigest(receipt)
	)
		throw new Error('React Memos Witness integrity differs');
	return receipt;
}

export function renderWitnessReactMemosReceipt(receipt: WitnessReactMemosReceipt): string {
	const journey = receipt.runs[0]!.applicationJourney;
	const inventoryLine = (lane: 'baseline' | 'migrated'): string =>
		receipt.consoleErrors[lane]
			.map((entry) => `${String(entry.count)}x \`${entry.message}\``)
			.join('; ');
	return `# Memos v0.1.3 — direct Witness browser proof

- Result: pass
- Canonical SHA-256: ${receipt.integrity.canonicalDigest}
- Runs: 2 baseline + 2 migrated production-static browser journeys
- Behavioral parity: ${receipt.runs[0]!.behaviorDigest}
- Migration class: ${receipt.migrationClass.migrationClass} — ${receipt.migrationClass.baselineBundler} to ${receipt.migrationClass.targetBundler}, ${receipt.migrationClass.baselineRuntime} to ${receipt.migrationClass.targetRuntime}
- Build lanes: \`${receipt.canonicalReceipt.path}\` bound by ${receipt.canonicalReceipt.binding} \`${receipt.canonicalReceipt.sha256}\` — ${receipt.canonicalReceipt.bindingReason}
- Era build deviation (${receipt.eraBuildDeviation.lane}): the declared \`${receipt.eraBuildDeviation.declaredBuildCommand}\` ${receipt.eraBuildDeviation.declaredBuildCommandOutcomeAtThisRevision}, so the era lane ran \`${receipt.eraBuildDeviation.commandRun}\` — ${receipt.eraBuildDeviation.ruling}
- API: a frozen synthetic same-origin projection, behaviour digest \`${receipt.projection.behaviorDigest}\`, seed \`${receipt.projection.seedFixture}\` at \`${receipt.projection.seedSha256}\`. No captured production payload and no real user data are involved.
- Seed amendment (${receipt.projection.amendment.unit}): ${receipt.projection.amendment.scope}; it superseded seed \`${receipt.projection.amendment.supersededSeedSha256}\` and behaviour digest \`${receipt.projection.amendment.supersededBehaviorDigest}\`
- Session: the application's own Signin form opens the \`GET /api/user/me\` gate; before it, the gate answers ${String(journey.gate.signedOutStatus)} and the application replaces history with \`${journey.gate.signedOutRoute}\`
- Journey: a memo composed and saved (\`${journey.compose.endpoint}\`, list ${String(journey.compose.listBefore)} to ${String(journey.compose.listAfter)}), a typed search narrowing ${String(journey.search.beforeFilter)} to ${String(journey.search.narrowed)} and restoring ${String(journey.search.afterClear)}, a tag filter narrowing to ${String(journey.tagFilter.narrowed)} and restoring ${String(journey.tagFilter.afterRestore)}, a two-click archive and a restore through the recycle bin, and an account rename through \`${journey.settings.method} ${journey.settings.path}\`
- No API request fired while the client filtered: ${String(journey.search.apiRecordsDuringFilter)} projection API records and ${String(journey.search.apiOriginRequestsDuringFilter)} \`/api\` origin requests across the typed search, and the same across the tag filter. The ${String(journey.search.assetRequestsDuringFilter)} and ${String(journey.tagFilter.assetRequestsDuringFilter)} requests those two blocks did make are the memo-card icons, re-fetched because the origin answers \`cache-control: no-store\`.
- Projection ledger: ${String(journey.projection.ledger.records)} decisions — ${String(journey.projection.ledger.apiRecords)} on the \`/api\` surface, all served, with ${String(journey.projection.ledger.refusedUnknown)} unknown-endpoint and ${String(journey.projection.ledger.refusedUnprojected)} withheld-endpoint refusals, and ${String(journey.projection.ledger.declinedNonApi)} static-asset requests declined through to the file server
- Router: ${receipt.router.library} over ${receipt.router.routes.map((route) => `\`${route}\``).join(' and ')} with a \`${receipt.router.fallback}\` fallback; ${String(receipt.router.navigations)} recorded navigations
- Console-error inventory (exact, whole journey, per lane) — baseline: ${inventoryLine('baseline')}; migrated: ${inventoryLine('migrated')}
- Failed requests: none in either lane
- Rendered appearance: ${String(receipt.renderedStyleParity.probes)} probes measured off the live page in both lanes; ${receipt.renderedStyleParity.note}
- Scroll: ${receipt.scrollAbsence.state} across ${String(receipt.scrollAbsence.routes.length)} measured stages at ${String(receipt.scrollAbsence.viewport.width)}x${String(receipt.scrollAbsence.viewport.height)} — ${receipt.scrollAbsence.documentOverflow}
- Mutation proof: \`${receipt.mutation.seam}\` in \`${receipt.mutation.path}\` at offset ${String(receipt.mutation.offset)} made the journey red, byte-identical restoration made it green again
- React lineage readiness: unchanged at ${String(receipt.readiness.reactLineage.ready)}/${String(receipt.readiness.reactLineage.total)}; this vertical is not counted

${receipt.nonclaims.map((claim) => `- ${claim}`).join('\n')}
`;
}

export function witnessReactMemosAggregateMember(digestValue: string) {
	return {
		id: 'witness-react-memos-v0-1-3',
		framework: 'react',
		track: 'production-readiness-direct-witness-old-vite-origin-to-vite8',
		bundler: 'vite-2.9.5-to-vite-8.0.16',
		runtime: 'node-16.20.2-to-node-24.15.0',
		result: 'pass',
		receipt: WITNESS_REACT_MEMOS_RECEIPT_PATH,
		digest: digestValue,
	};
}

export async function verifyWitnessReactMemosEvidence(rootDir = '.') {
	const rootPath = resolve(rootDir);
	const receiptPath = join(rootPath, WITNESS_REACT_MEMOS_RECEIPT_PATH);
	const receipt = parseWitnessReactMemosReceipt(JSON.parse(await readFile(receiptPath, 'utf8')));
	const canonicalBytes = await readFile(join(rootPath, receipt.canonicalReceipt.path));
	if (sha256(canonicalBytes) !== receipt.canonicalReceipt.sha256)
		throw new Error('React Memos build-lane receipt bytes drifted');
	const canonical = JSON.parse(canonicalBytes.toString('utf8')) as {
		unit?: unknown;
		slug?: unknown;
		revision?: unknown;
	};
	if (
		canonical.unit !== REACT_MEMOS_LANES_UNIT ||
		canonical.slug !== REACT_MEMOS_FIXTURE ||
		canonical.revision !== REACT_MEMOS_SOURCE.revision
	)
		throw new Error('React Memos build-lane receipt identity differs');
	if (
		(await readFile(join(dirname(receiptPath), 'receipt.md'), 'utf8')) !==
		renderWitnessReactMemosReceipt(receipt)
	)
		throw new Error('React Memos human Witness receipt differs');
	return {
		valid: true as const,
		digest: receipt.integrity.canonicalDigest,
		artifacts: 0,
		receipt,
	};
}
