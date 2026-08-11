import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'pathe';
import { canonicalize, sha256 } from './canonicalize.ts';
import type {
	WitnessConsoleErrorInventory,
	WitnessConsoleErrorInventoryEntry,
	WitnessFailedRequestInventory,
	WitnessFailedRequestInventoryEntry,
	WitnessMockedNonLoopbackSeamEntry,
	WitnessMockedNonLoopbackSeamInventory,
	WitnessRealAppRun,
	WitnessRenderedStyleEvidence,
	WitnessScrollSurface,
} from './witness-real-app.ts';

/**
 * One declared appearance probe. The runner takes the measurement off the live
 * page; this is the closed list of what it is required to measure, held here so
 * the published receipt can be checked against it rather than against whatever
 * the runner happened to ask for.
 */
export type WitnessReactLinkfreeStyleProbe = {
	label: string;
	selector: string;
	properties: readonly string[];
};

export const WITNESS_REACT_LINKFREE_SCHEMA = 'versionless.witness-react-linkfree.v1' as const;
export const WITNESS_REACT_LINKFREE_RECEIPT_PATH =
	'evidence/runs/witness-react-linkfree-v0-72-0/receipt.json' as const;
export const REACT_LINKFREE_FIXTURE = 'react-linkfree-v0-72-0' as const;
export const REACT_LINKFREE_RECEIPT_PATH =
	'evidence/runs/react-linkfree-v0-72-0/t006-run.json' as const;
export const REACT_LINKFREE_UNIT = 'lrapr-t006/u8-linkfree-migration-lanes' as const;
/**
 * The retained build-lane receipt is bound by its declared canonical digest and
 * by the sha256 of its exact bytes, so the browser proof cannot be re-pointed at
 * a rebuilt or edited build receipt.
 */
export const REACT_LINKFREE_CANONICAL_DIGEST =
	'971b4d8c9b94760d973d8c417780ee8f8c009582dc09e16ac900bc511cb36dd8' as const;
export const REACT_LINKFREE_RECEIPT_SHA256 =
	'0c0fb499e0c976750799c9451210a9d327b01996f9255b5f31b8a777774b3f6a' as const;

/**
 * The immutable source identity, bound here so the browser-proof receipt cannot
 * silently rebind itself to a different revision or archive.
 *
 * The pinned revision is the direct CHILD of the v0.72.0 tag target and the two
 * trees differ in exactly one blob — a code-review bot config. The application
 * is byte identical to the release; the ref is one commit past the tag, and
 * saying so is the difference between a true statement and a convenient one.
 */
export const REACT_LINKFREE_SOURCE = Object.freeze({
	repository: 'https://github.com/EddieHubCommunity/BioDrop',
	repositoryAtPinnedRevision: 'https://github.com/EddieHubCommunity/LinkFree',
	nearestTag: 'refs/tags/v0.72.0',
	pinnedRevisionIsTagTarget: false,
	revision: '367d77297b5753644e11ecd22cf80e59c87b0dc8',
	archiveSha256: '7cef1a1c2ae251e3738d8b8a6c5fe94b118bf13d3a5bae7b522b8db9c1c334ef',
	frontendRoot: '.',
	license: 'MIT',
	licenseSha256: '3b5b430ae7e6151220591e69a8a056482a13d36518357c025619cf0d60be50bf',
});

/**
 * Why this vertical's browser proof runs against an invented dataset, recorded
 * in the receipt rather than left to a reader to reconstruct.
 */
export const WITNESS_REACT_LINKFREE_CORPUS_RULING = Object.freeze({
	ruling: 'synthetic-corpus',
	dataset: 'fixtures/react-linkfree-v0-72-0/witness-corpus',
	why: 'The archive ships 561 profile documents naming real contributors. The MIT grant covers the code; whether a contributor intended their personal profile to be redistributed inside a migration-evidence corpus is recorded upstream as unresolved, and an unresolved question is not a licence.',
	seam: "the application's own corpus-agnostic generate.js, run unmodified over the synthetic profiles",
	applicationSourceEdits: 0,
	sameCorpusInBothLanes: true,
	realProfileDataRendered: false,
	proves: 'the behaviour of the application, not the dataset its archive ships',
});

/** Both lanes are observed at this size, so every extent below is comparable. */
export const WITNESS_REACT_LINKFREE_VIEWPORT = Object.freeze({ width: 1280, height: 720 });

/**
 * Exact console-error inventory, per lane, for the whole journey.
 *
 * This is an accounting mechanism, not an allowance. Two image and data loads
 * in the journey are answered 404 on purpose — the profile avatar, whose
 * synthetic account does not exist at the avatar host and whose refusal is what
 * drives the application's own onerror cascade, and the profile document behind
 * the application's own hard-coded example link, which the synthetic corpus does
 * not contain and which is the 404 journey. Chromium logs each one. Any console
 * error outside this inventory fails the run.
 */
export const WITNESS_REACT_LINKFREE_CONSOLE_ERRORS = Object.freeze({
	baseline: Object.freeze([
		Object.freeze({
			message: 'Failed to load resource: the server responded with a status of 404 (Not Found)',
			count: 2,
		}),
	]),
	migrated: Object.freeze([
		Object.freeze({
			message: 'Failed to load resource: the server responded with a status of 404 (Not Found)',
			count: 2,
		}),
	]),
}) as Readonly<Record<'baseline' | 'migrated', readonly WitnessConsoleErrorInventoryEntry[]>>;

/**
 * Exact failed-request inventory, per lane. Both lanes are empty: nothing in
 * this journey is refused at the transport level, and the two 404 answers above
 * are completed responses rather than failures.
 */
export const WITNESS_REACT_LINKFREE_FAILED_REQUESTS = Object.freeze({
	baseline: Object.freeze([]),
	migrated: Object.freeze([]),
}) as Readonly<Record<'baseline' | 'migrated', readonly WitnessFailedRequestInventoryEntry[]>>;

/**
 * The closed list of seams this application reaches for outside the bounded
 * loopback origin, pinned query-free and identical in both lanes.
 *
 * Both members are the same avatar, twice: the endpoint the profile document
 * declares, and the endpoint the application's own `src/utils.js` cascades to
 * when the first one fails. The ingest recorded that blocking only the first
 * REDIRECTS egress to the second rather than removing it, so a run that
 * declared one and not the other would look quiet while still reaching a live
 * third-party host. Both are answered in context; neither leaves the machine.
 */
export const WITNESS_REACT_LINKFREE_MOCKED_SEAMS = Object.freeze({
	baseline: Object.freeze([
		Object.freeze({
			method: 'GET',
			path: 'https://avatars.dicebear.com/api/initials/Nimbus.svg',
		}),
		Object.freeze({
			method: 'GET',
			path: 'https://avatars.githubusercontent.com/synthetic/synthetic-nimbus.png',
		}),
	]),
	migrated: Object.freeze([
		Object.freeze({
			method: 'GET',
			path: 'https://avatars.dicebear.com/api/initials/Nimbus.svg',
		}),
		Object.freeze({
			method: 'GET',
			path: 'https://avatars.githubusercontent.com/synthetic/synthetic-nimbus.png',
		}),
	]),
}) as Readonly<Record<'baseline' | 'migrated', readonly WitnessMockedNonLoopbackSeamEntry[]>>;

/**
 * The route the application's own homepage hard-codes as its example profile,
 * redacted.
 *
 * The link is application source, not corpus data, and it names a real person.
 * The synthetic corpus does not contain that profile, so following the
 * application's own link is exactly the not-found journey — and the route is
 * written into the evidence through a closed-list rule that keeps any profile
 * route the synthetic corpus does not declare from being recorded verbatim. The
 * route SHAPE survives; the identity does not.
 */
export const WITNESS_REACT_LINKFREE_REDACTED_ROUTE =
	'/{application-authored-example-profile}' as const;

/**
 * The exact route sequence the journey drives, in order, after the initial
 * document load. This cell has a real router with a dynamic segment, so pinning
 * the whole sequence is what makes a dropped navigation or a silently redirected
 * profile route fail the run.
 */
export const WITNESS_REACT_LINKFREE_ROUTES = Object.freeze([
	'/search',
	'/synthetic-nimbus',
	'/search',
	'/',
	WITNESS_REACT_LINKFREE_REDACTED_ROUTE,
]);

/**
 * The rendered-appearance probes, measured on the search route in both lanes.
 *
 * They are worth reading closely for this vertical: the baseline ships a
 * stylesheet its own postbuild purge cut by 91.8%, and the migrated lane ships
 * that stylesheet unpurged. Whether the two still resolve to the same appearance
 * is a genuine open question about the migration, and these probes are how it is
 * answered by measurement instead of by argument.
 */
export const WITNESS_REACT_LINKFREE_STYLE_PROBES = Object.freeze([
	Object.freeze({
		label: 'document-body',
		selector: 'body',
		properties: Object.freeze(['font-family', 'background-color', 'color', 'margin']),
	}),
	Object.freeze({
		label: 'menubar',
		selector: '.p-menubar',
		properties: Object.freeze(['background-color', 'border-radius', 'padding', 'display']),
	}),
	Object.freeze({
		label: 'search-input',
		selector: '#search-input',
		properties: Object.freeze(['width', 'font-size', 'border-radius', 'color']),
	}),
	Object.freeze({
		label: 'profile-chip',
		selector: '.user-list > a:nth-of-type(1) .p-chip',
		properties: Object.freeze([
			'background-color',
			'border-radius',
			'font-size',
			'padding',
			'width',
		]),
	}),
	Object.freeze({
		label: 'profile-type-dropdown',
		selector: '.p-dropdown',
		properties: Object.freeze(['background-color', 'border-radius', 'min-width']),
	}),
]) as readonly WitnessReactLinkfreeStyleProbe[];

/**
 * Deterministic tracked-event floor. The typed, clicked and keyed counts are
 * exact and identical in every lane and pass. Incidental `mouseover` events
 * depend on the pointer path the host takes between the genuine hovers, so the
 * count is bounded from below by those hovers rather than pinned to an unstable
 * number. The bound is checked, not erased.
 */
export const WITNESS_REACT_LINKFREE_TRACKED_EVENTS = Object.freeze({
	click: 6,
	input: 4,
	keydown: 6,
	mouseoverAtLeast: 2,
});

export type WitnessReactLinkfreeJourney = {
	corpus: {
		state: 'synthetic-fixture-corpus';
		directory: string;
		profiles: number;
		aggregateSha256: string;
		generatedIndexSha256: string;
		codegenSha256: string;
		realProfileDataRendered: false;
	};
	directory: {
		state: 'measured-rendered-index';
		route: '/search';
		profiles: number;
		firstName: string;
		lastName: string;
	};
	search: {
		state: 'measured-narrow-and-widen';
		term: string;
		beforeFilter: number;
		narrowed: number;
		narrowedName: string;
		wideningGesture: 'select-all-then-backspace';
		afterClear: number;
	};
	profile: {
		state: 'measured-rendered-profile';
		route: string;
		name: string;
		username: string;
		type: 'community';
		links: number;
		firstLinkLabel: string;
	};
	avatarCascade: {
		state: 'measured-application-onerror-cascade';
		declaredEndpoint: string;
		declaredAnswer: 404;
		cascadedEndpoint: string;
		cascadedAnswer: 200;
		renderedSource: string;
		bothHostsAnsweredInContext: true;
		leftTheMachine: false;
	};
	hover: {
		state: 'measured-hover-restyle';
		selector: string;
		backgroundColor: string;
		labelColor: string;
	};
	notFound: {
		state: 'measured-missing-profile';
		route: typeof WITNESS_REACT_LINKFREE_REDACTED_ROUTE;
		reachedBy: 'the application own hard-coded homepage example link';
		text: string;
	};
	scrollToTop: {
		state: 'measured-scroll-to-top-control';
		hiddenBeforeScroll: true;
		wheelDeltaY: number;
		scrolledTo: number;
		restoredToTop: true;
	};
	routeExtents: {
		state: 'measured-per-route-document-extents';
		viewport: { width: number; height: number };
		routes: Array<{ route: string; scrollHeight: number; clientHeight: number }>;
	};
};

export type WitnessReactLinkfreeRun = WitnessRealAppRun & {
	consoleErrorInventory: WitnessConsoleErrorInventory;
	failedRequestInventory: WitnessFailedRequestInventory;
	mockedNonLoopbackSeams: WitnessMockedNonLoopbackSeamInventory;
	renderedStyles: WitnessRenderedStyleEvidence;
	applicationJourney: WitnessReactLinkfreeJourney;
	scrollSurface: WitnessScrollSurface;
	behaviorDigest: string;
};

export type WitnessReactLinkfreeMutation = {
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

export type WitnessReactLinkfreeReceipt = {
	schemaVersion: typeof WITNESS_REACT_LINKFREE_SCHEMA;
	result: 'pass';
	fixture: typeof REACT_LINKFREE_FIXTURE;
	source: typeof REACT_LINKFREE_SOURCE;
	provenance: Record<string, unknown>;
	canonicalReceipt: { path: string; canonicalDigest: string; sha256: string };
	corpusRuling: typeof WITNESS_REACT_LINKFREE_CORPUS_RULING;
	stagedCorpus: {
		policy: 'synthetic-profile-corpus-through-the-applications-own-codegen';
		replacedPaths: string[];
		bundlerAuthoredPaths: number;
		bundlerAuthoredBytesUnchanged: true;
	};
	runs: WitnessReactLinkfreeRun[];
	mutation: WitnessReactLinkfreeMutation;
	consoleErrors: Readonly<
		Record<'baseline' | 'migrated', readonly WitnessConsoleErrorInventoryEntry[]>
	>;
	failedRequests: Readonly<
		Record<'baseline' | 'migrated', readonly WitnessFailedRequestInventoryEntry[]>
	>;
	mockedSeams: Readonly<
		Record<'baseline' | 'migrated', readonly WitnessMockedNonLoopbackSeamEntry[]>
	>;
	renderedStyleParity: {
		state: 'measured-identical-resolved-styles';
		probes: number;
		lanesAgree: true;
		note: string;
	};
	scrollSurface: WitnessScrollSurface;
	router: {
		library: 'react-router-dom-5';
		routes: string[];
		dynamicSegment: '/:username';
		navigations: number;
	};
	readiness: { reactLineage: { ready: 1; total: 4; counted: false }; overall: { ready: 3; total: 12 } };
	locality: { mode: 'offline'; successfulNonLoopback: 0; osWideIsolation: false };
	nonclaims: string[];
	integrity: { algorithm: 'sha256'; canonicalDigest: string };
};

const exact = (left: unknown, right: unknown): boolean => canonicalize(left) === canonicalize(right);

export function witnessReactLinkfreeRawDigest(
	run: WitnessReactLinkfreeRun | WitnessRealAppRun,
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
		counts.click !== WITNESS_REACT_LINKFREE_TRACKED_EVENTS.click ||
		counts.input !== WITNESS_REACT_LINKFREE_TRACKED_EVENTS.input ||
		counts.keydown !== WITNESS_REACT_LINKFREE_TRACKED_EVENTS.keydown ||
		mouseover < WITNESS_REACT_LINKFREE_TRACKED_EVENTS.mouseoverAtLeast ||
		Object.keys(counts).sort().join(',') !== 'click,input,keydown,mouseover'
	)
		throw new Error('React LinkFree tracked browser events differ');
	return {
		click: counts.click,
		input: counts.input,
		keydown: counts.keydown,
		mouseover: `at-least-${String(
			WITNESS_REACT_LINKFREE_TRACKED_EVENTS.mouseoverAtLeast,
		)}-genuine-hovers`,
	};
}

/**
 * Lane-independent behavior projection.
 *
 * Production bytes are lane-specific by construction, so the byte inventory
 * stays in the run record and out of this digest. Everything else the journey
 * measured is lane-independent and participates: the routes, the rendered
 * directory, the narrowed search, the profile and its link list, the avatar
 * cascade, the hover restyle, the not-found state, the document extents at every
 * route, the seam inventory, and — deliberately — the resolved appearance, which
 * is the one measurement that answers whether the baseline's purged stylesheet
 * and the migrated lane's unpurged one render the same page.
 */
export function witnessReactLinkfreeBehaviorDigest(
	run: WitnessReactLinkfreeRun | WitnessRealAppRun,
): string {
	const linkfree = run as WitnessReactLinkfreeRun;
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
			consoleErrorInventory: linkfree.consoleErrorInventory,
			failedRequestInventory: linkfree.failedRequestInventory,
			mockedNonLoopbackSeams: linkfree.mockedNonLoopbackSeams,
			renderedStyles: linkfree.renderedStyles,
			applicationJourney: linkfree.applicationJourney,
			scrollSurface: linkfree.scrollSurface,
			successfulNonLoopback: run.successfulNonLoopback,
		}),
	);
}

export function witnessReactLinkfreeDigest(receipt: WitnessReactLinkfreeReceipt): string {
	const copy = structuredClone(receipt);
	copy.integrity.canonicalDigest = '';
	return sha256(canonicalize(copy));
}

/**
 * Every recorded route must be one this vertical declared: the two static
 * routes, a profile route the SYNTHETIC corpus names, or the redaction
 * placeholder. A real username can therefore never reach the evidence through a
 * route, and this is checked on the published receipt rather than trusted from
 * the runner that wrote it.
 */
function assertRedactedRoutes(routes: readonly string[], label: string): void {
	for (const route of routes) {
		if (
			route === '/' ||
			route === '/search' ||
			route === WITNESS_REACT_LINKFREE_REDACTED_ROUTE ||
			route.startsWith('/synthetic-')
		)
			continue;
		throw new Error(`React LinkFree recorded a route outside the synthetic corpus: ${label}`);
	}
}

function assertConsoleErrorInventory(
	inventory: WitnessConsoleErrorInventory | undefined,
	lane: 'baseline' | 'migrated',
	label: string,
): void {
	const pinned = [...WITNESS_REACT_LINKFREE_CONSOLE_ERRORS[lane]].map((entry) => ({
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
		throw new Error(`React LinkFree console-error inventory differs: ${label}`);
}

function assertFailedRequestInventory(
	inventory: WitnessFailedRequestInventory | undefined,
	lane: 'baseline' | 'migrated',
	label: string,
): void {
	const pinned = [...WITNESS_REACT_LINKFREE_FAILED_REQUESTS[lane]].map((entry) => ({
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
		throw new Error(`React LinkFree failed-request inventory differs: ${label}`);
}

function assertMockedSeams(
	inventory: WitnessMockedNonLoopbackSeamInventory | undefined,
	lane: 'baseline' | 'migrated',
	label: string,
): void {
	const pinned = [...WITNESS_REACT_LINKFREE_MOCKED_SEAMS[lane]].map((entry) => ({
		method: entry.method,
		path: entry.path,
	}));
	if (
		inventory === undefined ||
		inventory.policy !== 'exact-app-scoped-mocked-non-loopback-seams' ||
		!exact(inventory.category, pinned) ||
		!exact(inventory.outsideInventory, []) ||
		!exact(inventory.absent, []) ||
		inventory.observed.length !== pinned.length ||
		inventory.successfulNonLoopback !== 0 ||
		inventory.observed.some((observation) => observation.requests < 1)
	)
		throw new Error(`React LinkFree mocked non-loopback seam inventory differs: ${label}`);
}

function assertRenderedStyles(
	evidence: WitnessRenderedStyleEvidence | undefined,
	label: string,
): void {
	const probes = WITNESS_REACT_LINKFREE_STYLE_PROBES;
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
		throw new Error(`React LinkFree rendered-style measurement differs: ${label}`);
}

function assertScrollSurface(surface: WitnessScrollSurface | undefined, label: string): void {
	if (
		surface === undefined ||
		surface.state !== 'measured-genuine-viewport-scroll' ||
		surface.route !== '/synthetic-nimbus' ||
		surface.viewport.width !== WITNESS_REACT_LINKFREE_VIEWPORT.width ||
		surface.viewport.height !== WITNESS_REACT_LINKFREE_VIEWPORT.height ||
		surface.clientHeight !== WITNESS_REACT_LINKFREE_VIEWPORT.height ||
		surface.scrollHeight <= surface.clientHeight ||
		surface.wheelDeltaY <= 0 ||
		surface.scrolledFromTop !== true ||
		surface.scrolled !== true
	)
		throw new Error(`React LinkFree scroll surface differs: ${label}`);
}

function assertApplicationJourney(
	journey: WitnessReactLinkfreeJourney | undefined,
	label: string,
): void {
	if (
		journey === undefined ||
		journey.corpus?.state !== 'synthetic-fixture-corpus' ||
		journey.corpus.directory !== WITNESS_REACT_LINKFREE_CORPUS_RULING.dataset ||
		journey.corpus.realProfileDataRendered !== false ||
		journey.corpus.profiles < 2 ||
		journey.directory?.state !== 'measured-rendered-index' ||
		journey.directory.route !== '/search' ||
		journey.directory.profiles !== journey.corpus.profiles ||
		journey.search?.state !== 'measured-narrow-and-widen' ||
		journey.search.beforeFilter !== journey.corpus.profiles ||
		journey.search.afterClear !== journey.corpus.profiles ||
		journey.search.narrowed >= journey.search.beforeFilter ||
		journey.search.narrowed < 1 ||
		journey.search.wideningGesture !== 'select-all-then-backspace' ||
		journey.profile?.state !== 'measured-rendered-profile' ||
		journey.profile.route !== '/synthetic-nimbus' ||
		!journey.profile.username.startsWith('synthetic-') ||
		journey.profile.links < 2 ||
		journey.avatarCascade?.state !== 'measured-application-onerror-cascade' ||
		journey.avatarCascade.declaredAnswer !== 404 ||
		journey.avatarCascade.cascadedAnswer !== 200 ||
		journey.avatarCascade.bothHostsAnsweredInContext !== true ||
		journey.avatarCascade.leftTheMachine !== false ||
		journey.avatarCascade.renderedSource !== journey.avatarCascade.cascadedEndpoint ||
		journey.avatarCascade.declaredEndpoint === journey.avatarCascade.cascadedEndpoint ||
		journey.hover?.state !== 'measured-hover-restyle' ||
		journey.notFound?.state !== 'measured-missing-profile' ||
		journey.notFound.route !== WITNESS_REACT_LINKFREE_REDACTED_ROUTE ||
		journey.scrollToTop?.state !== 'measured-scroll-to-top-control' ||
		journey.scrollToTop.hiddenBeforeScroll !== true ||
		journey.scrollToTop.restoredToTop !== true ||
		journey.scrollToTop.scrolledTo <= 300 ||
		journey.routeExtents?.state !== 'measured-per-route-document-extents' ||
		journey.routeExtents.routes.length < 4 ||
		journey.routeExtents.viewport.height !== WITNESS_REACT_LINKFREE_VIEWPORT.height
	)
		throw new Error(`React LinkFree application journey evidence differs: ${label}`);
	assertRedactedRoutes(
		journey.routeExtents.routes.map((route) => route.route.split(' ')[0] ?? ''),
		label,
	);
}

export function parseWitnessReactLinkfreeReceipt(value: unknown): WitnessReactLinkfreeReceipt {
	if (value === null || typeof value !== 'object' || Array.isArray(value))
		throw new Error('React LinkFree Witness receipt must be an object');
	const receipt = value as WitnessReactLinkfreeReceipt;
	const expectedRuns = new Set(['baseline:1', 'baseline:2', 'migrated:1', 'migrated:2']);
	const behaviors = new Set<string>();
	const styles = new Set<string>();
	if (
		receipt.schemaVersion !== WITNESS_REACT_LINKFREE_SCHEMA ||
		receipt.result !== 'pass' ||
		receipt.fixture !== REACT_LINKFREE_FIXTURE ||
		!exact(receipt.source, REACT_LINKFREE_SOURCE) ||
		!exact(receipt.corpusRuling, WITNESS_REACT_LINKFREE_CORPUS_RULING) ||
		receipt.canonicalReceipt?.path !== REACT_LINKFREE_RECEIPT_PATH ||
		receipt.canonicalReceipt.canonicalDigest !== REACT_LINKFREE_CANONICAL_DIGEST ||
		receipt.canonicalReceipt.sha256 !== REACT_LINKFREE_RECEIPT_SHA256 ||
		receipt.stagedCorpus?.policy !==
			'synthetic-profile-corpus-through-the-applications-own-codegen' ||
		receipt.stagedCorpus.bundlerAuthoredBytesUnchanged !== true ||
		receipt.stagedCorpus.bundlerAuthoredPaths < 1 ||
		!exact(receipt.stagedCorpus.replacedPaths, ['data/', 'list.json']) ||
		!Array.isArray(receipt.runs) ||
		receipt.runs.length !== 4
	)
		throw new Error('React LinkFree Witness binding differs');
	for (const run of receipt.runs) {
		const key = `${run.lane}:${run.pass}`;
		if (
			!expectedRuns.delete(key) ||
			run.app !== 'react-linkfree' ||
			run.framework !== 'react' ||
			run.result !== 'pass' ||
			run.cleanPage !== true ||
			run.successfulNonLoopback !== 0 ||
			run.witnessRecord.pageErrors !== 0 ||
			run.witnessRecord.failedRequests !== run.failedRequestInventory?.total ||
			run.witnessRecord.consoleErrors !== run.consoleErrorInventory?.total ||
			run.offlineEvidence.state !== 'not-applicable' ||
			run.observerFinalization.workerEvents.length !== 0 ||
			run.semanticDigest !== witnessReactLinkfreeRawDigest(run) ||
			run.behaviorDigest !== witnessReactLinkfreeBehaviorDigest(run) ||
			!exact(run.routes, WITNESS_REACT_LINKFREE_ROUTES)
		)
			throw new Error(`React LinkFree Witness run differs: ${key}`);
		assertRedactedRoutes(run.routes, key);
		assertConsoleErrorInventory(run.consoleErrorInventory, run.lane, key);
		assertFailedRequestInventory(run.failedRequestInventory, run.lane, key);
		assertMockedSeams(run.mockedNonLoopbackSeams, run.lane, key);
		assertRenderedStyles(run.renderedStyles, key);
		assertScrollSurface(run.scrollSurface, key);
		assertApplicationJourney(run.applicationJourney, key);
		behaviors.add(run.behaviorDigest);
		styles.add(canonicalize(run.renderedStyles));
	}
	assertScrollSurface(receipt.scrollSurface, 'receipt');
	if (
		expectedRuns.size !== 0 ||
		behaviors.size !== 1 ||
		styles.size !== 1 ||
		receipt.renderedStyleParity?.state !== 'measured-identical-resolved-styles' ||
		receipt.renderedStyleParity.lanesAgree !== true ||
		receipt.renderedStyleParity.probes !== WITNESS_REACT_LINKFREE_STYLE_PROBES.length ||
		!exact(receipt.consoleErrors, WITNESS_REACT_LINKFREE_CONSOLE_ERRORS) ||
		!exact(receipt.failedRequests, WITNESS_REACT_LINKFREE_FAILED_REQUESTS) ||
		!exact(receipt.mockedSeams, WITNESS_REACT_LINKFREE_MOCKED_SEAMS) ||
		receipt.router?.library !== 'react-router-dom-5' ||
		receipt.router.dynamicSegment !== '/:username' ||
		receipt.router.navigations !== WITNESS_REACT_LINKFREE_ROUTES.length ||
		!exact(receipt.router.routes, WITNESS_REACT_LINKFREE_ROUTES) ||
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
		receipt.integrity.canonicalDigest !== witnessReactLinkfreeDigest(receipt)
	)
		throw new Error('React LinkFree Witness integrity differs');
	return receipt;
}

export function renderWitnessReactLinkfreeReceipt(receipt: WitnessReactLinkfreeReceipt): string {
	const journey = receipt.runs[0]!.applicationJourney;
	const inventoryLine = (lane: 'baseline' | 'migrated'): string =>
		receipt.consoleErrors[lane]
			.map((entry) => `${String(entry.count)}x \`${entry.message}\``)
			.join('; ');
	const seamLine = (lane: 'baseline' | 'migrated'): string =>
		receipt.mockedSeams[lane].map((entry) => `\`${entry.method} ${entry.path}\``).join(', ');
	return `# LinkFree v0.72.0 — direct Witness browser proof

- Result: pass
- Canonical SHA-256: ${receipt.integrity.canonicalDigest}
- Runs: 2 baseline + 2 migrated production-static browser journeys
- Behavioral parity: ${receipt.runs[0]!.behaviorDigest}
- Dataset: SYNTHETIC. ${receipt.corpusRuling.why}
- How: ${receipt.corpusRuling.seam}; ${String(receipt.corpusRuling.applicationSourceEdits)} application source edits; the same corpus in both lanes; ${String(receipt.stagedCorpus.bundlerAuthoredPaths)} bundler-authored emitted paths proved byte identical to the committed build output
- Journey: the homepage, the searchable directory of ${String(journey.directory.profiles)} synthetic profiles, a typed search that narrows to ${String(journey.search.narrowed)} and a full clear that restores ${String(journey.search.afterClear)}, a real router navigation into a profile route, its ${String(journey.profile.links)} declared links, a hover that restyles a link, a measured wheel scroll and the application's own scroll-to-top control, and the not-found state behind the application's own example link
- Router: ${receipt.router.library} with a ${receipt.router.dynamicSegment} segment; the exact route sequence ${receipt.router.routes.map((route) => `\`${route}\``).join(' -> ')}
- Avatar cascade: the declared endpoint is answered ${String(journey.avatarCascade.declaredAnswer)} in context, the application's own onerror handler cascades to a second host, and that one is answered ${String(journey.avatarCascade.cascadedAnswer)}. Both are answered locally; neither leaves the machine.
- Mocked non-loopback seams (exact, per lane) — baseline: ${seamLine('baseline')}; migrated: ${seamLine('migrated')}
- Console-error inventory (exact, whole journey, per lane) — baseline: ${inventoryLine('baseline')}; migrated: ${inventoryLine('migrated')}
- Failed requests: none in either lane
- Rendered appearance: ${String(receipt.renderedStyleParity.probes)} probes measured off the live page in both lanes; ${receipt.renderedStyleParity.note}
- Scroll: ${receipt.scrollSurface.state} on ${receipt.scrollSurface.route} — scrollHeight ${String(receipt.scrollSurface.scrollHeight)} against clientHeight ${String(receipt.scrollSurface.clientHeight)} at ${String(receipt.scrollSurface.viewport.width)}x${String(receipt.scrollSurface.viewport.height)}
- Mutation proof: \`${receipt.mutation.seam}\` in \`${receipt.mutation.path}\` at offset ${String(receipt.mutation.offset)} made the journey red, byte-identical restoration made it green again
- React lineage readiness: unchanged at ${String(receipt.readiness.reactLineage.ready)}/${String(receipt.readiness.reactLineage.total)}; this vertical is not counted

${receipt.nonclaims.map((claim) => `- ${claim}`).join('\n')}
`;
}

export function witnessReactLinkfreeAggregateMember(digestValue: string) {
	return {
		id: 'witness-react-linkfree-v0-72-0',
		framework: 'react',
		track: 'production-readiness-direct-witness-create-react-app-5-to-vite8',
		bundler: 'webpack-5.73.0-to-vite-8.0.16',
		runtime: 'node-16.20.2-to-node-24.15.0',
		result: 'pass',
		receipt: WITNESS_REACT_LINKFREE_RECEIPT_PATH,
		digest: digestValue,
	};
}

export async function verifyWitnessReactLinkfreeEvidence(rootDir = '.') {
	const rootPath = resolve(rootDir);
	const receiptPath = join(rootPath, WITNESS_REACT_LINKFREE_RECEIPT_PATH);
	const receipt = parseWitnessReactLinkfreeReceipt(JSON.parse(await readFile(receiptPath, 'utf8')));
	const canonicalBytes = await readFile(join(rootPath, receipt.canonicalReceipt.path));
	if (sha256(canonicalBytes) !== receipt.canonicalReceipt.sha256)
		throw new Error('React LinkFree canonical receipt bytes drifted');
	const canonical = JSON.parse(canonicalBytes.toString('utf8')) as {
		unit?: unknown;
		fixture?: unknown;
		integrity?: { canonicalDigest?: unknown };
	};
	if (
		canonical.unit !== REACT_LINKFREE_UNIT ||
		canonical.fixture !== REACT_LINKFREE_FIXTURE ||
		canonical.integrity?.canonicalDigest !== receipt.canonicalReceipt.canonicalDigest
	)
		throw new Error('React LinkFree canonical receipt identity differs');
	if (
		(await readFile(join(dirname(receiptPath), 'receipt.md'), 'utf8')) !==
		renderWitnessReactLinkfreeReceipt(receipt)
	)
		throw new Error('React LinkFree human Witness receipt differs');
	return { valid: true as const, digest: receipt.integrity.canonicalDigest, artifacts: 0, receipt };
}
