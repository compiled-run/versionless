import { spawn } from 'node:child_process';
import {
	access,
	cp,
	lstat,
	mkdir,
	readdir,
	readFile,
	rename,
	rm,
	writeFile,
} from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Duplex } from 'node:stream';
import { dirname, extname, isAbsolute, join, normalize, relative, resolve } from 'pathe';
import { box, runBoxes, type BoxContext, type PageHandle, type PageRecord } from '@async/witness';
import { charIn, createRegExp, exactly, global } from 'magic-regexp';
import { joinURL, parseURL, stringifyParsedURL } from 'ufo';
import {
	canonicalize,
	compareUtf16CodeUnits,
	parseWitnessRealAppReceipt,
	sha256,
	WITNESS_REAL_APP_SCHEMA,
	witnessRealAppDigest,
	type WitnessConsoleErrorInventory,
	type WitnessCancelledDuplicateFetchCategoryEntry,
	type WitnessCancelledDuplicateFetchInstance,
	type WitnessCancelledDuplicateFetchInventory,
	type WitnessConsoleErrorInventoryEntry,
	type WitnessFailedRequestInventory,
	type WitnessFailedRequestInventoryEntry,
	type WitnessMeasuredScrollAbsence,
	type WitnessMockedNonLoopbackSeamEntry,
	type WitnessMockedNonLoopbackSeamInventory,
	type WitnessMockedNonLoopbackSeamObservation,
	type WitnessApplicationJourneyEvidence,
	type WitnessRenderedStyleEvidence,
	WITNESS_CANCELLED_DUPLICATE_FETCH_NON_LOOPBACK_SCOPE,
	WITNESS_CANCELLED_DUPLICATE_FETCH_RULE,
	WITNESS_NON_LOOPBACK_QUERY_FREE_PATH_RULE,
	type WitnessScrollSurface,
	type WitnessServiceWorkerRequestEvent,
	type WitnessServiceWorkerRequestTally,
	type WitnessMutationProof,
	type WitnessNextPrerenderPayloadEvidence,
	type WitnessOfflineEvidence,
	type WitnessRealAppReceipt,
	type WitnessRealAppRun,
	type WitnessServiceWorkerTelemetry,
} from '../../../core/src/index.ts';
import {
	WITNESS_ANGULAR_FACTORIOLAB_CANCELLED_DUPLICATE_FETCHES,
	WITNESS_ANGULAR_FACTORIOLAB_CONSOLE_ERRORS,
	WITNESS_ANGULAR_FACTORIOLAB_FAILED_REQUESTS,
} from '../../../core/src/receipts/witness-angular-factoriolab.ts';
import {
	WITNESS_ANGULAR_JIRA_CLONE_CANCELLED_DUPLICATE_FETCHES,
	WITNESS_ANGULAR_JIRA_CLONE_CONSOLE_ERRORS,
	WITNESS_ANGULAR_JIRA_CLONE_FAILED_REQUESTS,
	WITNESS_ANGULAR_JIRA_CLONE_FILTER_NARROWED,
	WITNESS_ANGULAR_JIRA_CLONE_FILTER_TERM,
	WITNESS_ANGULAR_JIRA_CLONE_MOCKED_SEAMS,
	WITNESS_ANGULAR_JIRA_CLONE_TOOLTIP,
	type WitnessAngularJiraCloneBoardEvidence,
	type WitnessAngularJiraCloneColumn,
} from '../../../core/src/receipts/witness-angular-jira-clone.ts';
import {
	WITNESS_REACT_HOSPITALRUN_CONSOLE_ERRORS,
	WITNESS_REACT_HOSPITALRUN_FAILED_REQUESTS,
} from '../../../core/src/receipts/witness-react-hospitalrun.ts';
import {
	NEXT_KILLEDBYGOOGLE_V3_APP,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_ALL_FILTER,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_AD_LIST_ITEMS,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_CLICK_FILTER,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_CLICK_FILTER_RECORDS,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_COMPOUND_RECORDS,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_COMPOUND_TERM,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_CONSOLE_ERRORS,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_FAILED_REQUESTS,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_KEYBOARD_FILTER,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_KEYBOARD_FILTER_RECORDS,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_LIST_ITEMS,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_MOCKED_SEAMS,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECORDS,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_SEARCH_RECORDS,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_SEARCH_TERM,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_VIEWPORT,
	type WitnessNextKilledbygoogleV3Counts,
	type WitnessNextKilledbygoogleV3GraveyardEvidence,
} from '../../../core/src/receipts/witness-next-killedbygoogle-v3.ts';
import { transformNext12DerivedStateToMemo } from '../../../frameworks/nextjs/src/index.ts';
import {
	REACT_LINKFREE_CANONICAL_DIGEST,
	REACT_LINKFREE_RECEIPT_PATH,
	WITNESS_REACT_LINKFREE_CONSOLE_ERRORS,
	WITNESS_REACT_LINKFREE_CORPUS_RULING,
	WITNESS_REACT_LINKFREE_FAILED_REQUESTS,
	WITNESS_REACT_LINKFREE_MOCKED_SEAMS,
	WITNESS_REACT_LINKFREE_REDACTED_ROUTE,
	WITNESS_REACT_LINKFREE_ROUTES,
	WITNESS_REACT_LINKFREE_STYLE_PROBES,
	type WitnessReactLinkfreeJourney,
} from '../../../core/src/receipts/witness-react-linkfree.ts';
import {
	REACT_MEMOS_BUILD_LANES_PATH,
	REACT_MEMOS_BUILD_LANES_SHA256,
	WITNESS_REACT_MEMOS_CONSOLE_ERRORS,
	WITNESS_REACT_MEMOS_FAILED_REQUESTS,
	WITNESS_REACT_MEMOS_STYLE_PROBES,
	type WitnessReactMemosJourney,
	type WitnessReactMemosLedgerEntry,
} from '../../../core/src/receipts/witness-react-memos.ts';
import {
	LINKFREE_AVATAR_FALLBACK_HOST,
	LINKFREE_AVATAR_HOST,
	LINKFREE_JOURNEY_PROFILE,
	LINKFREE_SYNTHETIC_NAMES_SORTED,
	LINKFREE_SYNTHETIC_PROFILES,
	linkfreeAvatarFallbackUrl,
	type LinkfreeStagedCorpus,
} from '../fixture/react-linkfree-v0-72-0-witness-corpus.ts';
import { witnessNodeFileSystem } from './node-filesystem.ts';
import {
	createPapercupsProjection,
	PAPERCUPS_CONVERSATIONS,
	PAPERCUPS_SOCKET_PATH,
	PAPERCUPS_USER,
} from './papercups-projection.ts';
import {
	createMemosProjection,
	MEMOS_OWNER_PASSWORD,
	MEMOS_PINNED_REVISION,
	MEMOS_PROJECTION_BEHAVIOR_DIGEST,
	MEMOS_PROJECTION_LABEL,
	MEMOS_SEED,
	memosSeedDigest,
	memosTagsInContent,
	type MemosProjection,
	type MemosProjectionDecision,
	type MemosProjectionLedgerRecord,
} from './memos-projection.ts';
import { createPhoenixSocketUpgrade } from './phoenix-socket.ts';
import {
	createPlaywrightWitnessHost,
	isWitnessLoopbackUrl,
	type PlaywrightWitnessHost,
	type ServiceWorkerTelemetry,
	type WitnessCapturedDownload,
	type WitnessDifferentialEvent,
	type WitnessFileInputDeclaration,
	type WitnessGroupedText,
	type WitnessGroupedTextProbe,
	type WitnessLoadedFileInput,
	type WitnessObservedRequestOutcome,
	type WitnessRenderedStyle,
	type WitnessRenderedStyleProbe,
	type WitnessTransportDecision,
	type WitnessTransportRequest,
	type WitnessViewportScroll,
} from './playwright-host.ts';
import { verifyLinkedWitnessProvenance } from './provenance.ts';
import type {
	WitnessSocketLedgerDetail,
	WitnessSocketLedgerRecord,
	WitnessSocketLedgerRecorder,
} from './socket-ledger.ts';

const root = resolve(import.meta.dirname, '../../../..');
const stageRoot = join(root, '.versionless/stage/witness-real-app');
const chromiumExecutable = join(
	root,
	'.versionless/cache/react-boilerplate-v4/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell',
);
const killedByGoogleArchive = join(
	root,
	'.versionless/cache/tier-f/next-killedbygoogle/c28878d0f65b56aa595763c852477fb0c1e3533e5c7f7ea9daa2be16f102368d/source.tar.gz',
);
const killedByGoogleMirror = join(
	root,
	'.versionless/cache/next-killedbygoogle-dependencies/a676ee932cef5e54d469dc6d1e040e50f42f9cc88beb16ae5c72c13e26ebc48a/mirror',
);
const EXPECTED_KILLED_BY_GOOGLE_ARCHIVE =
	'c28878d0f65b56aa595763c852477fb0c1e3533e5c7f7ea9daa2be16f102368d';

type App =
	| 'react-boilerplate'
	| 'angular-phonecat'
	| 'killedbygoogle'
	| 'angular-realworld'
	| 'papercups'
	| 'react-hospitalrun'
	| 'angular-factoriolab'
	| 'angular-jira-clone'
	| 'next-killedbygoogle-v3-0-0'
	| 'react-linkfree'
	| 'react-memos';
type Lane = 'baseline' | 'migrated';
type JourneyEvidence = {
	assertions: string[];
	offlineEvidence: WitnessOfflineEvidence;
	timeoutTelemetry?: ServiceWorkerTelemetry;
	zeroServiceWorker?: {
		checkpoints: Array<{
			phase: 'before-interactions' | 'after-interactions' | 'after-online-reload';
			state: 'timeout';
			registrations: 0;
			controller: null;
			cacheNames: [];
			workerEvents: [];
		}>;
	};
	/**
	 * Runtime zero-service-worker evidence for an application whose legacy build
	 * still emits a worker script it never registers. The emitted bytes are
	 * recorded rather than asserted away, and the runtime is required to show no
	 * registration, controller, CacheStorage name, lifecycle event, or worker
	 * request in any lane.
	 */
	zeroServiceWorkerRuntime?: {
		registration: 'application-unregister';
		checkpoints: Array<{
			phase: 'before-interactions' | 'after-interactions' | 'after-online-reload';
			state: 'timeout';
			registrations: 0;
			controller: null;
			cacheNames: [];
			workerEvents: [];
		}>;
	};
	/**
	 * Runtime evidence for an application whose own code calls
	 * `serviceWorker.register()`. The registration is refused at the browser
	 * context, so no worker is ever installed, controls the page, or opens a
	 * cache — and the refusal is not silenced: whatever the application logs in
	 * response is accounted for by the exact console-error inventory.
	 */
	blockedServiceWorkerRuntime?: {
		registration: 'application-register-refused-by-context';
		checkpoints: Array<{
			phase: 'before-interactions' | 'after-interactions' | 'after-online-reload';
			state: 'timeout';
			registrations: 0;
			controller: null;
			cacheNames: [];
			workerEvents: [];
		}>;
	};
	scrollSurface?: WitnessScrollSurface;
	/**
	 * The measured counterpart of {@link JourneyEvidence.scrollSurface}, for a
	 * journey whose routes were measured and found not to overflow.
	 */
	scrollAbsence?: WitnessMeasuredScrollAbsence;
	/**
	 * Resolved appearance the journey measured off the live page, for a lane pair
	 * whose styling parity is a claim rather than an assumption.
	 */
	renderedStyles?: WitnessRenderedStyle[];
	/**
	 * Measured facts expressible only in this application's own surfaces, carried
	 * through untouched and narrowed by that application's receipt schema.
	 */
	applicationJourney?: WitnessApplicationJourneyEvidence;
};
type JourneyTransportEvidence = { apiUsernames: string[] };
type JourneyLifecycle = {
	/**
	 * The lane this journey is running against. A journey should almost never
	 * need it — a claim that differs by lane is usually a claim that is not
	 * about the application — but a lane pair whose measured difference is the
	 * point has to be able to assert both halves of it exactly rather than
	 * relax the assertion until both fit.
	 */
	lane: Lane;
	serviceWorkerTelemetry(timeoutMs: number): Promise<ServiceWorkerTelemetry>;
	staticRequests(): string[];
	expectedServiceWorker: {
		cacheNames: string[];
		cacheEntries: Array<{ name: string; paths: string[] }>;
	} | null;
	phonecatOrdering: {
		names: string[];
		datasetSha256: string;
		orderSha256: string;
	} | null;
	phonecatImages: {
		detailSha256: string;
		defaultImage: string;
		nonDefaultImage: string;
	} | null;
	/** Live document scroll extents, for journeys that exercise a real scroll surface. */
	viewportScroll(): Promise<WitnessViewportScroll>;
	/**
	 * Total console errors this lane is allowed to have emitted by the end of
	 * the journey, summed from the application-scoped exact inventory. Zero
	 * when the application pins no inventory at all.
	 */
	expectedConsoleErrors: number;
	/** The same total for browser-failed requests, from the exact failed-request inventory. */
	expectedFailedRequests: number;
	/**
	 * Cancelled duplicate fetches the run's category has admitted so far,
	 * measured live from the page's own request ledger. A journey adds this to
	 * the exact failed-request total it asserts, so the assertion stays exact
	 * against what the browser actually did rather than being relaxed to a
	 * range; a cancelled fetch without a corroborating success throws here and
	 * turns the journey red where it happened.
	 */
	admittedCancelledDuplicateFetches(): number;
	/**
	 * Reads resolved appearance for this application's declared probe list off
	 * the live page. A journey that calls it without the application having
	 * declared any probes gets an error rather than an empty measurement, so a
	 * styling claim can never rest on nothing having been measured.
	 */
	renderedStyles(): Promise<WitnessRenderedStyle[]>;
	/**
	 * Reads the ordered item text of every group the probe matches off the live
	 * page, for a journey whose claim is about what the application's own store
	 * settled to rather than about the gesture that provoked it.
	 */
	groupedText(probe: WitnessGroupedTextProbe): Promise<WitnessGroupedText[]>;
	/** The keys this origin holds in browser storage, for a persistence claim. */
	browserStorageKeys(): Promise<{ localStorage: string[]; sessionStorage: string[] }>;
	/**
	 * Hands the page the fixture behind one of this application's declared
	 * file-input surfaces. A journey whose application declared none gets an
	 * error rather than a load, which is what keeps the mechanism an opt-in
	 * rather than a capability every journey inherits.
	 */
	loadFileInput(label: string): Promise<WitnessLoadedFileInput>;
	/**
	 * Reads back every download the page produced, for an application that
	 * declared it produces them. Errors for one that did not, because its
	 * context refused downloads and there is nothing to read.
	 */
	capturedDownloads(): Promise<WitnessCapturedDownload[]>;
};
export type AppSpec = {
	app: App;
	framework: WitnessRealAppRun['framework'];
	canonicalReceipt: string;
	canonicalDigest: string;
	/**
	 * How {@link AppSpec.canonicalDigest} binds the retained build receipt.
	 * Almost every vertical publishes an `integrity.canonicalDigest` and is
	 * bound by it, which is the default. A vertical whose retained receipt
	 * carries no such field is bound by the sha256 of its exact bytes instead —
	 * the same strength of binding, taken over the whole file, and named rather
	 * than borrowed from a field that is not there.
	 */
	canonicalBinding?: 'integrity-digest' | 'file-sha256';
	sources: Record<Lane, string>;
	initialRoute?: string;
	/**
	 * Browser-context service-worker policy for this application. `block` is
	 * for applications that call `serviceWorker.register()` themselves: the
	 * registration is refused instead of being allowed to take control, and the
	 * application's own reaction is then accounted for exactly.
	 */
	serviceWorkers?: 'block';
	/** Explicit context viewport when the journey makes a viewport-relative claim. */
	viewport?: { width: number; height: number };
	/**
	 * Per-lane exact console-error inventory. Every pinned message is required
	 * with its exact count, and any console error whose text is not pinned
	 * fails the run — this is an accounting mechanism, never an allowance.
	 */
	consoleErrorInventory?: Record<Lane, readonly WitnessConsoleErrorInventoryEntry[]>;
	/**
	 * Per-lane exact failed-request inventory, held to the same discipline as the
	 * console inventory: pinned entries are required exactly and anything else
	 * fails the run.
	 */
	failedRequestInventory?: Record<Lane, readonly WitnessFailedRequestInventoryEntry[]>;
	/**
	 * Per-lane cancelled-duplicate-fetch category. Declaring a member says one
	 * thing only: this exact request may be cancelled by the browser because the
	 * page raced itself for the same asset. Admission still requires a
	 * corroborating successful fetch of the same path in the same run, and every
	 * failure outside these members remains an ordinary failure.
	 */
	cancelledDuplicateFetches?: Record<
		Lane,
		readonly WitnessCancelledDuplicateFetchCategoryEntry[]
	>;
	/**
	 * Per-lane closed list of the seams this application reaches for outside the
	 * bounded loopback origin, each pinned query-free. Declaring the list is what
	 * makes an undeclared seam fail the run; the harness answers every one of
	 * them in-context, so none of them leaves the machine.
	 */
	mockedNonLoopbackSeams?: Record<Lane, readonly WitnessMockedNonLoopbackSeamEntry[]>;
	/**
	 * The closed list of rendered-appearance probes this application's journey
	 * measures, identical in both lanes so the two measurements are comparable.
	 */
	renderedStyleProbes?: readonly WitnessRenderedStyleProbe[];
	/**
	 * The file-input surfaces this application declares, and the absolute root
	 * its repository-relative fixture paths resolve against. Declaring it is the
	 * only way a file ever reaches the page: an application that omits it runs
	 * with the mechanism absent, and its journey cannot ask for one.
	 */
	fileInputs?: WitnessFileInputDeclaration;
	/**
	 * Declares that this application produces downloads. It is the only thing
	 * that grants the browser context `acceptDownloads`, so an application that
	 * omits it runs in a context that refuses them.
	 */
	downloads?: 'capture';
	/**
	 * Replaces identifiers the application itself mints at runtime with a stable
	 * placeholder, so a recorded route is comparable across runs. It normalizes
	 * only the generated identifier; the route shape around it stays exactly as
	 * the application navigated it.
	 */
	normalizeRoute?(path: string): string;
	journey(
		context: BoxContext,
		page: PageHandle,
		transportEvidence: JourneyTransportEvidence,
		lifecycle: JourneyLifecycle,
	): Promise<JourneyEvidence>;
	transport?(
		request: WitnessTransportRequest,
		transportEvidence: JourneyTransportEvidence,
	): Promise<WitnessTransportDecision>;
	/**
	 * Per-run same-origin loopback seams. The factory is invoked once per run so
	 * every run starts from the frozen projection state instead of inheriting
	 * mutations from an earlier pass.
	 */
	loopback?(): {
		api(request: StaticServerApiRequest): Promise<StaticServerApiResponse | null>;
		/**
		 * Omitted by an application that opens no socket. The origin then
		 * registers no upgrade handler at all, so an unexpected upgrade is left
		 * unanswered rather than quietly absorbed by a handler written for an
		 * application that never asks for one.
		 */
		upgrade?(
			request: IncomingMessage,
			socket: Duplex,
			head: Buffer,
			record: WitnessSocketLedgerRecorder,
		): void;
	};
};

export const ANGULAR_REALWORLD_TERMINAL_MARKER =
	'VERSIONLESS ANGULAR MIGRATION EVIDENCE COMPLETE' as const;
export const ANGULAR_REALWORLD_ARTICLE_BODY = `## Baseline identity

The baseline lane serves the pinned Angular 15 production-AOT output without rebuilding or rewriting application bytes. Its immutable archive, source revision, dependency closure, and generated static inventory remain bound to the canonical migration receipt.

The local article is evidence data supplied through the normal RealWorld API contract. It does not modify the application, inject markup, or substitute browser behavior.

## Adjacent-major migration

The migrated lane serves the independently prepared Angular 16 production-AOT output. The application source delta is limited to the recorded adjacent-major migration, while this qualification compares user-observable behavior across the two retained outputs.

Both lanes render the same feed record, open the same article slug, preserve the same title and author, and navigate through the same registration surface.

## Direct Witness interaction

Every click, type, key press, hover, and wheel action is issued through the directly linked Witness implementation. Playwright supplies the low-level browser host, but it does not replace or synthesize the selected user interactions.

The journey records route changes, tracked browser events, console messages, page errors, failed requests, and owned observer shutdown for each qualification pass.

## Production-static bytes

Each run inventories the complete static directory before serving it and again after the browser closes. The directory digest, application document digest, file count, and absence of development controls must remain exact.

The bounded loopback server rejects traversal, returns missing assets as missing, and uses the application document only for browser document navigation.

## Local API projection

One immutable article record is projected through exact list and detail envelopes. The comments route returns an exact empty comments envelope, while unknown article subpaths fail closed instead of inheriting a general response.

External styles and the RealWorld API are fulfilled locally. Successful non-loopback traffic remains zero, and the evidence does not claim operating-system-wide isolation.

## Behavioral parity

Two baseline passes and two migrated passes must produce one normalized behavioral digest. Production file hashes remain lane-specific and are verified separately rather than erased from the static-byte evidence.

The article title, registration heading, tracked events, navigation paths, and clean-page outcome are required in every pass.

## Mutation and restoration

A staged migrated copy receives one causal bootstrap-root mutation. Witness must report the intended semantic failure, after which the exact original bytes are restored and the complete journey must pass again.

The mutation never touches the immutable source worktree or retained production output. Restoration is accepted only when the application document hash is byte-identical.

## Assurance boundary

This fixture-specific evidence establishes reproducibility and hash integrity for one Angular 15-to-16 lineage. It does not establish generic Angular support, a designated pilot, certification, signer authenticity, compliance, an earned SLSA level, or operating-system-wide isolation.

${ANGULAR_REALWORLD_TERMINAL_MARKER}` as const;

export const ANGULAR_REALWORLD_ARTICLE = Object.freeze({
	slug: 'versionless-angular',
	title: 'Versionless Angular baseline',
	description: 'Synthetic local evidence for the immutable Angular baseline.',
	body: ANGULAR_REALWORLD_ARTICLE_BODY,
	tagList: Object.freeze(['migration']),
	createdAt: '2026-08-08T00:00:00.000Z',
	updatedAt: '2026-08-08T00:00:00.000Z',
	favorited: false,
	favoritesCount: 0,
	author: Object.freeze({
		username: 'versionless',
		bio: '',
		image: '',
		following: false,
	}),
});

function angularJson(value: unknown): WitnessTransportDecision {
	return {
		action: 'fulfill',
		status: 200,
		contentType: 'application/json',
		body: Buffer.from(JSON.stringify(value)),
	};
}

export async function angularRealworldTransport(
	request: WitnessTransportRequest,
): Promise<WitnessTransportDecision> {
	if (request.pathname === '/api/tags') return angularJson({ tags: ['migration', 'angular'] });
	if (request.pathname === '/api/articles/versionless-angular/comments')
		return angularJson({ comments: [] });
	if (request.pathname === '/api/articles/versionless-angular')
		return angularJson({ article: ANGULAR_REALWORLD_ARTICLE });
	if (request.pathname === '/api/articles')
		return angularJson({ articlesCount: 1, articles: [ANGULAR_REALWORLD_ARTICLE] });
	if (request.pathname.startsWith('/api/articles/'))
		throw new Error(`Angular RealWorld local API refuses unknown path: ${request.pathname}`);
	return {
		action: 'fulfill',
		status: 204,
		contentType: 'text/plain',
		body: Buffer.alloc(0),
	};
}

type StaticInventory = {
	files: number;
	digest: string;
	applicationSha256: string;
	serviceWorkers: Array<{ path: string; sha256: string }>;
};
type StaticResponseLedgerEntry = {
	method: string;
	pathname: string;
	query: string;
	destination: string;
	resolvedFile: string | null;
	status: number;
	mime: string;
	bytes: number;
	sha256: string;
	socket?: WitnessSocketLedgerDetail;
};

type LegacyMainPrecacheResponse = {
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
};
type NextPrerenderPayloadInput = Omit<
	Extract<WitnessNextPrerenderPayloadEvidence, { state: 'exact-lane-bound-next-prerender' }>,
	'response'
>;

const CONTENT_TYPES: Record<string, string> = {
	'.css': 'text/css',
	'.gif': 'image/gif',
	'.html': 'text/html',
	'.ico': 'image/x-icon',
	'.jpeg': 'image/jpeg',
	'.jpg': 'image/jpeg',
	'.js': 'text/javascript',
	'.json': 'application/json',
	'.map': 'application/json',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
};

async function staticInventory(staticRoot: string): Promise<StaticInventory> {
	const entries: Array<{ path: string; sha256: string }> = [];
	const visit = async (directory: string): Promise<void> => {
		for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) =>
			a.name.localeCompare(b.name),
		)) {
			const path = join(directory, entry.name);
			if (entry.isSymbolicLink())
				throw new Error('Witness production-static inventory rejects symbolic links');
			if (entry.isDirectory()) await visit(path);
			else if (entry.isFile())
				entries.push({
					path: relative(staticRoot, path),
					sha256: sha256(await readFile(path)),
				});
			else throw new Error('Witness production-static inventory contains a non-file entry');
		}
	};
	await visit(staticRoot);
	entries.sort((a, b) => a.path.localeCompare(b.path));
	const application = entries.find((entry) => entry.path === 'index.html');
	if (application === undefined) throw new Error('Witness production-static index is absent');
	return {
		files: entries.length,
		digest: sha256(canonicalize(entries)),
		applicationSha256: application.sha256,
		serviceWorkers: entries.filter(
			(entry) => entry.path === 'sw.js' || entry.path === 'service-worker.js',
		),
	};
}

function safeStaticPath(staticRoot: string, requestUrl: string): string | null {
	let pathname: string;
	try {
		pathname = decodeURIComponent(parseURL(requestUrl).pathname || '/');
	} catch {
		return null;
	}
	if (
		pathname.includes('\\') ||
		pathname.includes('\0') ||
		pathname.split('/').some((part) => part === '..')
	)
		return null;
	let relativePath = normalize(pathname);
	while (relativePath.startsWith('/')) relativePath = relativePath.slice(1);
	const file = resolve(staticRoot, relativePath === '' ? 'index.html' : relativePath);
	const fromRoot = relative(staticRoot, file);
	if (fromRoot === '..' || fromRoot.startsWith('../') || isAbsolute(fromRoot)) return null;
	return file;
}

async function readStaticFile(file: string): Promise<{ file: string; body: Buffer } | null> {
	const details = await lstat(file).catch(() => null);
	if (details === null || details.isSymbolicLink()) return null;
	const resolved = details.isDirectory() ? join(file, 'index.html') : file;
	const resolvedDetails = await lstat(resolved).catch(() => null);
	if (resolvedDetails === null || !resolvedDetails.isFile() || resolvedDetails.isSymbolicLink())
		return null;
	return { file: resolved, body: await readFile(resolved) };
}

export type StaticServerApiResponse = {
	status: number;
	contentType: string;
	body: Buffer;
};
export type StaticServerApiRequest = {
	method: string;
	pathname: string;
	search: string;
	body: Buffer;
};

const MAX_API_REQUEST_BYTES = 1_048_576;

async function collectRequestBody(request: IncomingMessage): Promise<Buffer | null> {
	const chunks: Buffer[] = [];
	let bytes = 0;
	for await (const chunk of request as AsyncIterable<Buffer | string>) {
		const buffer = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk;
		bytes += buffer.length;
		if (bytes > MAX_API_REQUEST_BYTES) return null;
		chunks.push(buffer);
	}
	return Buffer.concat(chunks);
}

export async function startStaticServer(
	staticRoot: string,
	options: {
		profile?: 'current-witness' | 'canonical-t060';
		diagnosticEvent?: (
			event: Omit<WitnessDifferentialEvent, 'sequence' | 'timestampMs'>,
		) => void;
		api?: (request: StaticServerApiRequest) => Promise<StaticServerApiResponse | null>;
		upgrade?: (
			request: IncomingMessage,
			socket: Duplex,
			head: Buffer,
			record: WitnessSocketLedgerRecorder,
		) => void | Promise<void>;
	} = {},
): Promise<{
	origin: string;
	close(): Promise<void>;
	assertClean(): void;
	requests(): string[];
	ledger(): StaticResponseLedgerEntry[];
}> {
	const failures: string[] = [];
	const requests: string[] = [];
	const ledger: StaticResponseLedgerEntry[] = [];
	const server: Server = createServer((request, response) => {
		void (async () => {
			const parsedRequest = parseURL(request.url ?? '/');
			const pathname = parsedRequest.pathname || '/';
			const urlPath = `${pathname}${parsedRequest.search ?? ''}`;
			options.diagnosticEvent?.({
				source: 'static-server',
				phase: 'start',
				urlPath,
				detail: {},
			});
			request.once('aborted', () =>
				options.diagnosticEvent?.({
					source: 'static-server',
					phase: 'abort',
					urlPath,
					detail: {},
				}),
			);
			requests.push(pathname);
			const complete = (
				status: number,
				mime: string,
				body: Buffer,
				resolvedFile: string | null,
			): void => {
				response.once('finish', () => {
					ledger.push({
						method: request.method ?? 'GET',
						pathname,
						query: parsedRequest.search ?? '',
						destination:
							typeof request.headers['sec-fetch-dest'] === 'string'
								? request.headers['sec-fetch-dest']
								: '',
						resolvedFile,
						status,
						mime,
						bytes: body.length,
						sha256: sha256(body),
					});
					options.diagnosticEvent?.({
						source: 'static-server',
						phase: 'finish',
						urlPath,
						detail: { status, bytes: body.length, sha256: sha256(body), mime },
					});
				});
				response.writeHead(status, {
					...(options.profile === 'canonical-t060'
						? {}
						: { 'cache-control': 'no-store' }),
					'content-type':
						options.profile === 'canonical-t060' &&
						(mime === 'text/html' || mime === 'text/javascript')
							? `${mime}; charset=utf-8`
							: mime,
				});
				response.end(body);
			};
			if (options.api !== undefined) {
				const body = await collectRequestBody(request);
				if (body === null) {
					complete(413, 'text/plain', Buffer.from('payload too large'), null);
					return;
				}
				const fulfilled = await options.api({
					method: request.method ?? 'GET',
					pathname,
					search: parsedRequest.search ?? '',
					body,
				});
				if (fulfilled !== null) {
					complete(fulfilled.status, fulfilled.contentType, fulfilled.body, null);
					return;
				}
			}
			const requestedFile = safeStaticPath(staticRoot, request.url ?? '/');
			if (requestedFile === null) {
				complete(400, 'text/plain', Buffer.from('invalid path'), null);
				return;
			}
			let result = await readStaticFile(requestedFile);
			if (result === null && request.headers['sec-fetch-dest'] === 'document')
				result = await readStaticFile(join(staticRoot, 'index.html'));
			if (result === null) {
				complete(404, 'text/plain', Buffer.from('not found'), null);
				return;
			}
			complete(
				200,
				CONTENT_TYPES[extname(result.file)] ?? 'application/octet-stream',
				result.body,
				relative(staticRoot, result.file),
			);
		})().catch((error: unknown) => {
			failures.push(error instanceof Error ? error.message : String(error));
			if (!response.headersSent) response.writeHead(500, { 'content-type': 'text/plain' });
			response.end('static server failure');
		});
	});
	server.requestTimeout = 15_000;
	server.headersTimeout = 10_000;
	if (options.upgrade !== undefined) {
		const upgrade = options.upgrade;
		const recordSocket = (record: WitnessSocketLedgerRecord): void => {
			ledger.push({
				method: record.method,
				pathname: record.pathname,
				query: record.query,
				destination: 'websocket',
				resolvedFile: null,
				status: record.status,
				mime: record.mime,
				bytes: record.body.length,
				sha256: sha256(record.body),
				socket: record.socket,
			});
		};
		server.on('upgrade', (request, socket, head) => {
			void (async () => {
				await upgrade(request, socket, head, recordSocket);
			})().catch((error: unknown) => {
				failures.push(error instanceof Error ? error.message : String(error));
				socket.destroy();
			});
		});
	}
	await new Promise<void>((resolveListen, rejectListen) => {
		server.once('error', rejectListen);
		server.listen(0, '127.0.0.1', () => {
			server.off('error', rejectListen);
			resolveListen();
		});
	});
	const address = server.address();
	if (address === null || typeof address === 'string') throw new Error('static origin is absent');
	const origin = stringifyParsedURL({
		protocol: 'http:',
		host: `127.0.0.1:${(address as AddressInfo).port}`,
	});
	return {
		origin,
		close: async () =>
			void (await new Promise<void>((resolveClose, rejectClose) => {
				server.close((error) =>
					error === undefined ? resolveClose() : rejectClose(error),
				);
			})),
		assertClean: () => {
			if (failures.length > 0)
				throw new Error(`Witness production-static server failed: ${failures.join('; ')}`);
		},
		requests: () => [...requests],
		ledger: () => structuredClone(ledger),
	};
}

const BASELINE_REACT_CACHE_NAME = 'webpack-offline:versionless-deterministic';
const BASELINE_REACT_CACHE_BUST_QUERY = '?__uncache=versionless-deterministic';
const BASELINE_REACT_MAIN_ASSETS = [
	{ pathname: '/favicon.ico', resolvedFile: 'favicon.ico', mime: 'image/x-icon' },
	{
		pathname: '/2f1a976c9c35ffed9b7e23cf2cbf8f19.jpg',
		resolvedFile: '2f1a976c9c35ffed9b7e23cf2cbf8f19.jpg',
		mime: 'image/jpeg',
	},
	{
		pathname: '/runtime.bfb7866e5bd316b6a048.js',
		resolvedFile: 'runtime.bfb7866e5bd316b6a048.js',
		mime: 'text/javascript',
	},
	{ pathname: '/', resolvedFile: 'index.html', mime: 'text/html' },
] as const;
const BASELINE_REACT_CACHE_PATHS = [
	'/',
	'/14.2ef2b4a3d26bb1eb81fe.chunk.js',
	'/15.63e7c613fb32f7f731ca.chunk.js',
	'/16.87cd011ed2f020d4e6d4.chunk.js',
	'/17.d6848cc7cc19eb7fbec4.chunk.js',
	'/2f1a976c9c35ffed9b7e23cf2cbf8f19.jpg',
	'/3.a9fb20e5f448e036b4ad.chunk.js',
	'/__offline_webpack__data',
	'/favicon.ico',
	'/main.7bb4cda122f2e2a46418.chunk.js',
	'/npm.babel.a75018fd1b7c886eec7f.chunk.js',
	'/npm.connected-react-router.8fd4eda0f65262f02a5e.chunk.js',
	'/npm.intl-messageformat.7f32d245bfcb5c0501de.chunk.js',
	'/npm.intl-relativeformat.0c1d32cae8b23b70584f.chunk.js',
	'/npm.intl.1601d791a7de6967584b.chunk.js',
	'/npm.lodash.df83a9ce6a6ba2f8ebcb.chunk.js',
	'/npm.react-app-polyfill.02ee820043fb75ec004c.chunk.js',
	'/npm.react-intl.590480c86bf89f4d91b3.chunk.js',
	'/npm.react-redux.cba95f2d297d6dbfe0c6.chunk.js',
	'/npm.redux-saga.e4c67e286e17aab928d8.chunk.js',
	'/npm.webpack.59e68e65a7ea323c5295.chunk.js',
	'/runtime.bfb7866e5bd316b6a048.js',
].sort();

async function exactLegacyMainPrecacheResponses(
	laneRoot: string,
	ledger: StaticResponseLedgerEntry[],
): Promise<LegacyMainPrecacheResponse[]> {
	const responses: LegacyMainPrecacheResponse[] = [];
	for (const expected of BASELINE_REACT_MAIN_ASSETS) {
		const matches = ledger.filter(
			(entry) =>
				entry.pathname === expected.pathname &&
				entry.query === BASELINE_REACT_CACHE_BUST_QUERY,
		);
		if (matches.length !== 1)
			throw new Error(
				`React legacy main precache response cardinality differs: ${expected.pathname}${BASELINE_REACT_CACHE_BUST_QUERY}`,
			);
		const [entry] = matches;
		const body = await readFile(join(laneRoot, expected.resolvedFile));
		if (
			entry === undefined ||
			entry.method !== 'GET' ||
			entry.destination !== 'empty' ||
			entry.resolvedFile !== expected.resolvedFile ||
			entry.status !== 200 ||
			entry.mime !== expected.mime ||
			entry.bytes !== body.length ||
			entry.sha256 !== sha256(body)
		)
			throw new Error(
				`React legacy main precache response differs: ${expected.pathname}${BASELINE_REACT_CACHE_BUST_QUERY}`,
			);
		responses.push({
			method: 'GET',
			pathname: entry.pathname,
			query: BASELINE_REACT_CACHE_BUST_QUERY,
			destination: 'empty',
			resolvedFile: expected.resolvedFile,
			status: 200,
			mime: entry.mime,
			bytes: entry.bytes,
			sha256: entry.sha256,
			urlPath: `${entry.pathname}${entry.query}`,
			source: 'production-static-origin',
		});
	}
	return responses;
}

function exactNextPrerenderPayloadEvidence(
	laneRoot: string,
	ledger: StaticResponseLedgerEntry[],
	input: NextPrerenderPayloadInput,
): Extract<WitnessNextPrerenderPayloadEvidence, { state: 'exact-lane-bound-next-prerender' }> {
	const failed = ledger.filter((entry) => entry.status !== 200);
	if (failed.length !== 0)
		throw new Error(
			`KilledByGoogle local production-static response failed: ${canonicalize(failed)}`,
		);
	const matches = ledger.filter(
		(entry) => entry.pathname === input.dataRoute && entry.query === '',
	);
	if (matches.length !== 1)
		throw new Error(
			`KilledByGoogle prerender response cardinality differs: ${input.dataRoute}`,
		);
	const [entry] = matches;
	const stagedFile = join(laneRoot, input.stagedPath);
	if (
		entry === undefined ||
		entry.method !== 'GET' ||
		entry.destination !== 'empty' ||
		entry.resolvedFile !== input.stagedPath ||
		entry.status !== 200 ||
		entry.mime !== 'application/json' ||
		entry.bytes !== input.payload.bytes ||
		entry.sha256 !== input.payload.sha256
	)
		throw new Error(`KilledByGoogle prerender response differs: ${input.dataRoute}`);
	return {
		...input,
		response: {
			method: 'GET',
			pathname: entry.pathname,
			query: '',
			destination: 'empty',
			resolvedFile: relative(laneRoot, stagedFile),
			status: 200,
			mime: 'application/json',
			bytes: entry.bytes,
			sha256: entry.sha256,
		},
	};
}

async function expectedReactTelemetry(
	laneRoot: string,
	lane: Lane,
): Promise<{ cacheNames: string[]; cacheEntries: Array<{ name: string; paths: string[] }> }> {
	if (lane === 'baseline')
		return {
			cacheNames: [BASELINE_REACT_CACHE_NAME],
			cacheEntries: [{ name: BASELINE_REACT_CACHE_NAME, paths: BASELINE_REACT_CACHE_PATHS }],
		};
	const manifest = JSON.parse(
		await readFile(join(laneRoot, 'precache-manifest.json'), 'utf8'),
	) as {
		schemaVersion?: string;
		scope?: string;
		entries?: Array<{ url?: string }>;
	};
	if (
		manifest.schemaVersion !== 'versionless.react-vite8-precache.v1' ||
		manifest.scope !== '/' ||
		!Array.isArray(manifest.entries) ||
		manifest.entries.some((entry) => typeof entry.url !== 'string')
	)
		throw new Error('React migrated precache manifest differs');
	const cacheName = `versionless-react-vite8-${sha256(
		await readFile(join(laneRoot, 'precache-manifest.json')),
	)}`;
	return {
		cacheNames: [cacheName],
		cacheEntries: [
			{ name: cacheName, paths: manifest.entries.map((entry) => entry.url!).sort() },
		],
	};
}

async function expectedPhonecatOrdering(laneRoot: string): Promise<{
	names: string[];
	datasetSha256: string;
	orderSha256: string;
}> {
	const dataset = await readFile(join(laneRoot, 'phones/phones.json'));
	const phones = JSON.parse(dataset.toString('utf8')) as Array<{ name?: unknown }>;
	if (
		phones.length !== 20 ||
		phones.some((phone) => typeof phone.name !== 'string' || phone.name.length === 0)
	)
		throw new Error('PhoneCat immutable phone-name dataset differs');
	const names = phones
		.map((phone, sourceIndex) => ({ name: phone.name as string, sourceIndex }))
		.sort((left, right) => {
			const leftName = left.name.toLowerCase();
			const rightName = right.name.toLowerCase();
			if (leftName < rightName) return -1;
			if (leftName > rightName) return 1;
			return left.sourceIndex - right.sourceIndex;
		})
		.map((phone) => phone.name);
	return {
		names,
		datasetSha256: sha256(dataset),
		orderSha256: sha256(canonicalize(names)),
	};
}

async function expectedPhonecatImages(laneRoot: string): Promise<{
	detailSha256: string;
	defaultImage: string;
	nonDefaultImage: string;
}> {
	const detail = await readFile(join(laneRoot, 'phones/nexus-s.json'));
	const phone = JSON.parse(detail.toString('utf8')) as { images?: unknown };
	if (
		!Array.isArray(phone.images) ||
		phone.images.length < 2 ||
		phone.images.some((image) => typeof image !== 'string' || image.length === 0)
	)
		throw new Error('PhoneCat immutable Nexus S image dataset differs');
	const defaultImage = phone.images[0] as string;
	const nonDefaultImage = phone.images.find((image) => image !== defaultImage) as
		| string
		| undefined;
	if (nonDefaultImage === undefined)
		throw new Error('PhoneCat immutable Nexus S non-default image is absent');
	return { detailSha256: sha256(detail), defaultImage, nonDefaultImage };
}

/**
 * Clean-page outcome. `consoleErrors` and `failedRequests` default to zero and
 * are only ever raised to the total of an application's exact, entry-by-entry
 * inventory; each inventory is checked separately against the recorded
 * messages and failures, so a raised total can never widen into a blanket
 * allowance.
 */
const clean = async (
	context: BoxContext,
	page: PageHandle,
	navigations: number,
	consoleErrors = 0,
	failedRequests = 0,
): Promise<void> => {
	await context.expect.page.outcome(page, {
		navigations,
		consoleErrors,
		failedRequests,
	});
};

const CONSOLE_ORIGIN_PLACEHOLDER = '{production-static-origin}' as const;

function tallyConsoleErrors(page: PageRecord, origin: string): WitnessConsoleErrorInventoryEntry[] {
	const counts = new Map<string, number>();
	for (const message of page.consoleMessages) {
		if (message.level !== 'error') continue;
		const normalized = message.text.split(origin).join(CONSOLE_ORIGIN_PLACEHOLDER);
		counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
	}
	return [...counts]
		.map(([message, count]) => ({ message, count }))
		.sort((left, right) => compareUtf16CodeUnits(left.message, right.message));
}

/**
 * Non-masking console-error accounting. The observed errors must equal the
 * pinned inventory exactly — same messages, same counts — and any error outside
 * the inventory is reported by its own text rather than folded into a total.
 */
function buildConsoleErrorInventory(
	page: PageRecord,
	origin: string,
	expected: readonly WitnessConsoleErrorInventoryEntry[],
): WitnessConsoleErrorInventory {
	const observed = tallyConsoleErrors(page, origin);
	const pinned = expected
		.map((entry) => ({ message: entry.message, count: entry.count }))
		.sort((left, right) => compareUtf16CodeUnits(left.message, right.message));
	const pinnedMessages = new Set(pinned.map((entry) => entry.message));
	const outside = observed.filter((entry) => !pinnedMessages.has(entry.message));
	if (outside.length > 0)
		throw new Error(`console errors outside the pinned inventory: ${canonicalize(outside)}`);
	if (canonicalize(observed) !== canonicalize(pinned))
		throw new Error(
			`pinned console-error inventory differs: expected ${canonicalize(pinned)}, observed ${canonicalize(observed)}`,
		);
	return {
		policy: 'exact-app-scoped-expected-console-errors',
		originPlaceholder: CONSOLE_ORIGIN_PLACEHOLDER,
		expected: pinned,
		observed,
		outsideInventory: [],
		total: observed.reduce((sum, entry) => sum + entry.count, 0),
	};
}

/**
 * Drops the wall clock and the run-global sequence number from observed
 * service-worker events, keeping every field that describes what was actually
 * observed. Nothing is filtered out here — the whole ordered trace survives, it
 * simply becomes reproducible.
 */
function projectServiceWorkerEvents(
	events: readonly WitnessDifferentialEvent[],
): WitnessServiceWorkerRequestEvent[] {
	return events.map((event) => ({
		source: event.source,
		phase: event.phase,
		urlPath: event.urlPath,
		detail: event.detail,
	}));
}

/** Exact multiset of the projected trace, for verification against a pinned tally. */
function tallyServiceWorkerEvents(
	events: readonly WitnessServiceWorkerRequestEvent[],
): WitnessServiceWorkerRequestTally[] {
	const counts = new Map<string, WitnessServiceWorkerRequestTally>();
	for (const event of events) {
		const key = canonicalize(event);
		const existing = counts.get(key);
		if (existing === undefined) counts.set(key, { ...event, count: 1 });
		else existing.count += 1;
	}
	return [...counts]
		.sort(([left], [right]) => compareUtf16CodeUnits(left, right))
		.map(([, tally]) => tally);
}

const failedRequestKey = (entry: WitnessFailedRequestInventoryEntry): string =>
	canonicalize({ method: entry.method, path: entry.path, reason: entry.reason });

/**
 * The one way an observed URL is written into the evidence.
 *
 * For the bounded loopback origin this is the origin-relative form it has
 * always been: the port is ephemeral, so the origin is the one part that cannot
 * be pinned, and everything after it is exactly what the browser requested —
 * query included, because the harness's own origin mints no identifiers and its
 * queries are part of what a production-static claim is about.
 *
 * For anything outside that origin the query is dropped, and the record is
 * scheme, host and pathname. The endpoints applications of this era reach for
 * carry their account identifier in the query — a measurement id, a DSN public
 * key — and a published receipt has no business carrying one. What identifies
 * the seam is the endpoint, and the endpoint survives intact.
 */
export const witnessRecordedRequestPath = (url: string, origin: string): string => {
	if (origin.length > 0 && url.startsWith(origin)) return url.slice(origin.length);
	if (isWitnessLoopbackUrl(url)) return url;
	const parsed = parseURL(url);
	const recorded = stringifyParsedURL({
		protocol: parsed.protocol,
		host: parsed.host,
		pathname: parsed.pathname,
	});
	if (recorded.includes('?'))
		throw new Error(`recorded non-loopback path must be query-free: ${recorded}`);
	return recorded;
};

function tallyFailedRequests(
	page: PageRecord,
	origin: string,
	admitted: ReadonlySet<string>,
): WitnessFailedRequestInventoryEntry[] {
	const counts = new Map<string, WitnessFailedRequestInventoryEntry>();
	for (const request of page.failedRequests) {
		const entry = {
			method: request.method,
			path: witnessRecordedRequestPath(request.url, origin),
			reason: request.reason,
			count: 1,
		};
		// Admitted cancelled duplicates are accounted for instance by instance in
		// their own inventory, so they are not counted twice here. Everything
		// else — including a cancelled fetch the corroboration rule refused —
		// stays in this exact inventory and fails the run if it is not pinned.
		if (admitted.has(failedRequestKey(entry))) continue;
		const existing = counts.get(failedRequestKey(entry));
		if (existing === undefined) counts.set(failedRequestKey(entry), entry);
		else existing.count += 1;
	}
	return [...counts.values()].sort((left, right) =>
		compareUtf16CodeUnits(failedRequestKey(left), failedRequestKey(right)),
	);
}

/**
 * Non-masking failed-request accounting, the exact analogue of the console-error
 * inventory: the observed failures must equal the pinned ones entry for entry
 * and count for count, and any failure outside the inventory is reported by its
 * own path and reason rather than folded into a total.
 */
function buildFailedRequestInventory(
	page: PageRecord,
	origin: string,
	expected: readonly WitnessFailedRequestInventoryEntry[],
	admitted: ReadonlySet<string> = new Set(),
): WitnessFailedRequestInventory {
	const observed = tallyFailedRequests(page, origin, admitted);
	const pinned = expected
		.map((entry) => ({
			method: entry.method,
			path: entry.path,
			reason: entry.reason,
			count: entry.count,
		}))
		.sort((left, right) =>
			compareUtf16CodeUnits(failedRequestKey(left), failedRequestKey(right)),
		);
	const pinnedKeys = new Set(pinned.map(failedRequestKey));
	const outside = observed.filter((entry) => !pinnedKeys.has(failedRequestKey(entry)));
	if (outside.length > 0)
		throw new Error(`failed requests outside the pinned inventory: ${canonicalize(outside)}`);
	if (canonicalize(observed) !== canonicalize(pinned))
		throw new Error(
			`pinned failed-request inventory differs: expected ${canonicalize(pinned)}, observed ${canonicalize(observed)}`,
		);
	return {
		policy: 'exact-app-scoped-expected-failed-requests',
		expected: pinned,
		observed,
		outsideInventory: [],
		total: observed.reduce((sum, entry) => sum + entry.count, 0),
	};
}

export const cancelledDuplicateFetchKey = (
	entry: WitnessCancelledDuplicateFetchCategoryEntry,
): string => canonicalize({ method: entry.method, path: entry.path, reason: entry.reason });

/**
 * The cancelled-duplicate-fetch category, applied to one run's observed request
 * ledger.
 *
 * The behavior this exists for is measurable and narrow: a page fetches an
 * asset, re-renders while that fetch is still in flight, issues an identical
 * fetch, and the browser cancels one of the two. The cancellation is real and
 * is recorded as such — what the category establishes is that the page still
 * got the bytes, by requiring the same page to have fetched the same
 * origin-relative path with the same method successfully at least once in the
 * same run.
 *
 * The discipline is deliberately narrow in three ways. Membership is pinned by
 * path, method and the browser's own reason and never by count, because the
 * count is the race. Corroboration is checked per member against this run's own
 * ledger, so a category member declared by an application that did not in fact
 * fetch the asset successfully throws here rather than being waved through.
 * And nothing outside the pinned members is looked at at all: every other
 * failed request continues through the exact failed-request inventory.
 */
export function buildCancelledDuplicateFetchInventory(
	outcomes: readonly WitnessObservedRequestOutcome[],
	origin: string,
	category: readonly WitnessCancelledDuplicateFetchCategoryEntry[],
): WitnessCancelledDuplicateFetchInventory {
	const pinned = category
		.map((entry) => ({ method: entry.method, path: entry.path, reason: entry.reason }))
		.sort((left, right) =>
			compareUtf16CodeUnits(
				cancelledDuplicateFetchKey(left),
				cancelledDuplicateFetchKey(right),
			),
		);
	if (new Set(pinned.map(cancelledDuplicateFetchKey)).size !== pinned.length)
		throw new Error('cancelled-duplicate-fetch category repeats a member');
	// A member outside the loopback origin is pinned query-free by construction,
	// checked here rather than trusted, so a category can never become the place
	// an account identifier enters the evidence.
	const nonLoopbackMembers = pinned.filter((entry) => !entry.path.startsWith('/'));
	for (const entry of nonLoopbackMembers)
		if (entry.path.includes('?'))
			throw new Error(
				`non-loopback cancelled-duplicate member must be pinned query-free: ${entry.path}`,
			);
	const observed: WitnessCancelledDuplicateFetchInstance[] = [];
	const absent: WitnessCancelledDuplicateFetchCategoryEntry[] = [];
	for (const entry of pinned) {
		const sameRequest = outcomes.filter(
			(outcome) =>
				outcome.method === entry.method &&
				witnessRecordedRequestPath(outcome.url, origin) === entry.path,
		);
		const cancelled = sameRequest.filter(
			(outcome) => outcome.outcome === 'failed' && outcome.reason === entry.reason,
		).length;
		const successes = sameRequest.filter(
			(outcome) =>
				outcome.outcome === 'finished' &&
				outcome.status !== null &&
				outcome.status >= 200 &&
				outcome.status < 300,
		);
		if (cancelled === 0) {
			absent.push(entry);
			continue;
		}
		if (successes.length === 0)
			throw new Error(
				`cancelled fetch has no corroborating successful fetch of the same path: ${canonicalize(
					{ ...entry, cancelled, observedForPath: sameRequest },
				)}`,
			);
		observed.push({
			...entry,
			cancelled,
			corroboratingSuccesses: successes.length,
			corroboratingStatuses: [...new Set(successes.map((outcome) => outcome.status!))].sort(
				(left, right) => left - right,
			),
		});
	}
	return {
		policy: 'corroborated-browser-cancelled-duplicate-fetch',
		corroborationRule: WITNESS_CANCELLED_DUPLICATE_FETCH_RULE,
		category: pinned,
		observed,
		absent,
		uncorroborated: [],
		admitted: observed.reduce((sum, instance) => sum + instance.cancelled, 0),
		// Carried only where it applies. An application whose category is entirely
		// same-origin says nothing about mocked seams, and an omitted field is the
		// honest way to say nothing.
		...(nonLoopbackMembers.length === 0
			? {}
			: { nonLoopbackScope: WITNESS_CANCELLED_DUPLICATE_FETCH_NON_LOOPBACK_SCOPE }),
	};
}

const mockedSeamKey = (entry: WitnessMockedNonLoopbackSeamEntry): string =>
	canonicalize({ method: entry.method, path: entry.path });

/**
 * The mocked non-loopback seam inventory, applied to one run's observed request
 * ledger.
 *
 * Every request the page made outside the bounded loopback origin is written
 * down by its query-free recorded path and must name a declared member. A seam
 * nobody declared is reported by its own path and fails the run — that is the
 * whole mechanism, and it is why the count of declared seams is worth reading:
 * it is the complete set of endpoints this application reaches for, not a
 * sample of them.
 *
 * Per-seam request counts are recorded rather than pinned. How many times a
 * page reports to an analytics or error endpoint depends on when its bundles
 * resolve, and pinning that number would pin load timing; what the inventory
 * pins is which endpoints exist, which is the fact that does not move.
 */
export function buildMockedNonLoopbackSeamInventory(
	outcomes: readonly WitnessObservedRequestOutcome[],
	origin: string,
	category: readonly WitnessMockedNonLoopbackSeamEntry[],
): WitnessMockedNonLoopbackSeamInventory {
	const pinned = category
		.map((entry) => ({ method: entry.method, path: entry.path }))
		.sort((left, right) => compareUtf16CodeUnits(mockedSeamKey(left), mockedSeamKey(right)));
	if (new Set(pinned.map(mockedSeamKey)).size !== pinned.length)
		throw new Error('mocked non-loopback seam inventory repeats a member');
	for (const entry of pinned) {
		if (entry.path.startsWith('/') || entry.path.includes('?'))
			throw new Error(
				`mocked non-loopback seam must be a query-free absolute endpoint: ${entry.path}`,
			);
	}
	const pinnedKeys = new Set(pinned.map(mockedSeamKey));
	const seen = new Map<string, WitnessMockedNonLoopbackSeamObservation>();
	const outside: WitnessMockedNonLoopbackSeamEntry[] = [];
	for (const outcome of outcomes) {
		if (isWitnessLoopbackUrl(outcome.url) || outcome.url.startsWith(origin)) continue;
		const entry = {
			method: outcome.method,
			path: witnessRecordedRequestPath(outcome.url, origin),
		};
		const key = mockedSeamKey(entry);
		if (!pinnedKeys.has(key)) {
			if (!outside.some((candidate) => mockedSeamKey(candidate) === key)) outside.push(entry);
			continue;
		}
		const existing = seen.get(key);
		const statuses = existing?.statuses ?? [];
		if (outcome.status !== null && !statuses.includes(outcome.status))
			statuses.push(outcome.status);
		statuses.sort((left, right) => left - right);
		if (existing === undefined) seen.set(key, { ...entry, requests: 1, statuses });
		else existing.requests += 1;
	}
	if (outside.length > 0)
		throw new Error(
			`non-loopback requests outside the declared seam inventory: ${canonicalize(outside)}`,
		);
	return {
		policy: 'exact-app-scoped-mocked-non-loopback-seams',
		pathPolicy: WITNESS_NON_LOOPBACK_QUERY_FREE_PATH_RULE,
		category: pinned,
		observed: pinned.flatMap((entry) => {
			const observation = seen.get(mockedSeamKey(entry));
			return observation === undefined ? [] : [observation];
		}),
		absent: pinned.filter((entry) => !seen.has(mockedSeamKey(entry))),
		outsideInventory: [],
		successfulNonLoopback: 0,
	};
}

/**
 * HospitalRun journey inputs. The application resolves `en-US` against its
 * bundled `en` catalogue, so every assertion below is the exact English string
 * the application itself renders from `src/shared/locales/enUs`.
 */
const HOSPITALRUN_GIVEN_NAME = 'Aurelia' as const;
const HOSPITALRUN_FAMILY_NAME = 'Whitfield' as const;
const HOSPITALRUN_FULL_NAME = `${HOSPITALRUN_GIVEN_NAME} ${HOSPITALRUN_FAMILY_NAME}` as const;
/**
 * Visible intake-success text shipped inside the migrated module. The journey
 * asserts the rendered toast that contains it, so overwriting these bytes must
 * turn the journey genuinely red instead of changing an unread constant.
 */
export const HOSPITALRUN_MUTATION_SEAM = 'Successfully created patient' as const;
const HOSPITALRUN_INTAKE_TOAST = `${HOSPITALRUN_MUTATION_SEAM} ${HOSPITALRUN_FULL_NAME}` as const;
const HOSPITALRUN_EMPTY_PATIENTS = "There are no patients yet, let's add the first one!" as const;
const HOSPITALRUN_VIEWPORT = { width: 1280, height: 720 } as const;
const HOSPITALRUN_SCROLL_ROUTE = '/appointments' as const;
const HOSPITALRUN_WHEEL_DELTA_Y = 400 as const;
/**
 * Every navigation the journey performs after the initial document load: the
 * thirteen client-side route changes the application pushes as the journey
 * moves through intake, the patient record sub-tabs and the department routes,
 * plus the one real document reload. Pinning the exact count is what keeps a
 * silently dropped or duplicated route change from passing unnoticed.
 */
const HOSPITALRUN_JOURNEY_NAVIGATIONS = 14;
/**
 * The patient identifier is a UUID the application mints in the browser when
 * the record is created, so it is different in every run and every lane. Only
 * that identifier is replaced; the surrounding route shape is left exactly as
 * the application navigated it, so a changed route still changes the record.
 */
const HOSPITALRUN_PATIENT_ID = createRegExp(
	exactly('/patients/'),
	charIn('0123456789abcdef-').times.between(32, 40).groupedAs('id'),
	[global],
);
const HOSPITALRUN_PATIENT_ID_PLACEHOLDER = '/patients/{created-patient-id}' as const;
const normalizeHospitalrunRoute = (path: string): string =>
	path.replace(HOSPITALRUN_PATIENT_ID, HOSPITALRUN_PATIENT_ID_PLACEHOLDER);

const sidebarItem = (label: string): string =>
	`.sidebar .nav-item.list-group-item:text-is(${JSON.stringify(label)})`;
const patientTab = (label: string): string => `button.nav-link:text-is(${JSON.stringify(label)})`;

/**
 * Papercups journey inputs derived from the frozen loopback projection rather
 * than hand-copied, so a projection edit moves the assertion instead of
 * silently detaching it from the served evidence data.
 */
function papercupsPreview(id: string): string {
	const conversation = PAPERCUPS_CONVERSATIONS.find((candidate) => candidate.id === id);
	const body = conversation?.messages[0]?.body;
	if (body === undefined || body.length === 0)
		throw new Error(`Papercups projection preview is absent: ${id}`);
	return body;
}

const PAPERCUPS_SIGN_IN_PASSWORD = 'synthetic-evidence-password';
const PAPERCUPS_UNASSIGNED_PREVIEW = papercupsPreview('conversation-unassigned');
const PAPERCUPS_ASSIGNED_PREVIEW = papercupsPreview('conversation-assigned');
const PAPERCUPS_PRIORITY_PREVIEW = papercupsPreview('conversation-priority');
const PAPERCUPS_CLOSED_PREVIEW = papercupsPreview('conversation-closed');
const PAPERCUPS_OPEN_PREVIEWS = [
	PAPERCUPS_UNASSIGNED_PREVIEW,
	PAPERCUPS_ASSIGNED_PREVIEW,
	PAPERCUPS_PRIORITY_PREVIEW,
];
export const PAPERCUPS_REPLY_BODY =
	'Restored the offline mirror; the migration receipt is attached.' as const;
/**
 * Post-load navigations after the `/login` document: the sign-in push to
 * `/conversations`, its redirect to `/conversations/all`, the prioritized and
 * closed category routes, the return to `/conversations/all`, and the online
 * reload of that route.
 */
const PAPERCUPS_JOURNEY_NAVIGATIONS = 6;

/**
 * factoriolab journey inputs.
 *
 * Every string below is text the application itself renders from its own
 * bundled dataset and templates — the era-pinned Factorio 1.0 data that ships
 * inside both lanes' `data/` directory — so each assertion is anchored to
 * settled visible state rather than to a timing window. The application's
 * production solver is compute-heavy and recomputes the whole table after every
 * edit, which is exactly why nothing here is asserted on elapsed time: the
 * assertions wait for the recomputed values themselves.
 */
const FACTORIOLAB_VIEWPORT = { width: 1280, height: 720 } as const;
const FACTORIOLAB_ITEMS_HEADER = 'lab-list table thead tr th:nth-child(2)' as const;
const FACTORIOLAB_TOTAL_POWER =
	'lab-list table tr:has(td.summary-label) td:nth-child(2) span.monospace' as const;
const FACTORIOLAB_TOTAL_POLLUTION =
	'lab-list table tr:has(td.summary-label) td:nth-child(3) span.monospace' as const;
const FACTORIOLAB_HEADER_CELLS = 'lab-list table thead th' as const;
const FACTORIOLAB_PRODUCT_ICON = 'lab-products .product-row lab-icon' as const;
const FACTORIOLAB_RATE_INPUT = 'lab-products input[type=number]' as const;
const FACTORIOLAB_PICKER = 'lab-picker' as const;
const FACTORIOLAB_PICKER_TABS = 'lab-picker .tabs lab-icon' as const;
/** The third category tab is Intermediate products, where iron plate lives. */
const FACTORIOLAB_PICKER_TAB = 'lab-picker .tabs lab-icon:nth-of-type(3)' as const;
const FACTORIOLAB_PICKER_TAB_TOOLTIP = `${FACTORIOLAB_PICKER_TAB} .tooltip .title` as const;
const FACTORIOLAB_PICKER_ITEM = 'lab-picker .tab lab-icon:has(img.iron-plate)' as const;
const FACTORIOLAB_PICKER_ITEM_TOOLTIP = `${FACTORIOLAB_PICKER_ITEM} .tooltip .title` as const;
const FACTORIOLAB_CHOSEN_PRODUCT = 'lab-products .product-row lab-icon img.iron-plate' as const;
const FACTORIOLAB_COLUMNS_TOGGLE = 'lab-list i[title="Select columns"]' as const;
const FACTORIOLAB_COLUMNS_DIALOG = 'lab-multiselect' as const;
const FACTORIOLAB_COLUMNS_TITLE = 'lab-multiselect span.header' as const;
const FACTORIOLAB_COLUMN_OPTIONS = 'lab-multiselect > div.clickable' as const;
const FACTORIOLAB_POLLUTION_OPTION =
	'lab-multiselect > div.clickable:has-text("Pollution")' as const;
/** Outside the dialog and low enough on the page that the dialog cannot cover it. */
const FACTORIOLAB_DIALOG_DISMISS = 'lab-list td.summary-label span.monospace' as const;
const FACTORIOLAB_NAV_SETTINGS = 'ul[role=navigation] li:nth-child(1)' as const;
const FACTORIOLAB_NAV_LIST = 'ul[role=navigation] li:nth-child(2)' as const;
const FACTORIOLAB_NAV_FLOW = 'ul[role=navigation] li:nth-child(3)' as const;
const FACTORIOLAB_SETTINGS = 'lab-settings' as const;
const FACTORIOLAB_PER_HOUR = 'label[title="Display rates per hour"]' as const;
const FACTORIOLAB_NAME_STATE = 'lab-settings i[title="Name and save this state"]' as const;
const FACTORIOLAB_STATE_NAME_INPUT = 'lab-settings input[placeholder="Enter a name..."]' as const;
const FACTORIOLAB_SAVE_STATE = 'lab-settings i[title="Save this state"]' as const;
const FACTORIOLAB_DELETE_STATE = 'lab-settings i[title="Delete this saved state"]' as const;
const FACTORIOLAB_FLOW_MESSAGE = 'lab-list td.message' as const;
const FACTORIOLAB_SAVED_STATE_NAME = 'versionless-witness' as const;
const FACTORIOLAB_SAVED_STATE_OPTION =
	`lab-settings .states select option[label="${FACTORIOLAB_SAVED_STATE_NAME}"]` as const;
/**
 * Visible dialog title shipped inside the migrated module. The journey asserts
 * the rendered heading, so overwriting these bytes must turn the journey
 * genuinely red instead of changing an unread constant.
 */
export const FACTORIOLAB_MUTATION_SEAM = 'Select Columns' as const;
const FACTORIOLAB_FLOW_EMPTY_SELECTION = 'Select a node to see details' as const;
/** The item the picker journey switches the default product to. */
const FACTORIOLAB_ITEM_TOOLTIP = 'Iron plate' as const;
const FACTORIOLAB_CATEGORY_TOOLTIP = 'Intermediate products' as const;
/**
 * The exact settled figures the application's own solver produces from its
 * bundled Factorio 1.0 dataset at each stage of the journey. They are the
 * assertion targets, not decoration: a solver that recomputes differently after
 * the framework hop changes these strings and fails the run.
 */
const FACTORIOLAB_DEFAULT_TOTAL_POWER = '1.3 kW' as const;
const FACTORIOLAB_DEFAULT_TOTAL_POLLUTION = '0.1' as const;
const FACTORIOLAB_IRON_PLATE_TOTAL_POWER = '8.0 kW' as const;
const FACTORIOLAB_IRON_PLATE_TOTAL_POLLUTION = '0.4' as const;
const FACTORIOLAB_RATE_TEN_TOTAL_POWER = '79.6 kW' as const;
const FACTORIOLAB_RATE_TEN_TOTAL_POLLUTION = '3.6' as const;
const FACTORIOLAB_PER_HOUR_TOTAL_POWER = '1.4 kW' as const;
const FACTORIOLAB_ITEMS_PER_MINUTE = 'Items/m' as const;
const FACTORIOLAB_ITEMS_PER_HOUR = 'Items/h' as const;
const FACTORIOLAB_POLLUTION_COLUMN = 'Pollution/m' as const;
const FACTORIOLAB_COLUMNS_WITH_POLLUTION = 9;
const FACTORIOLAB_COLUMNS_WITHOUT_POLLUTION = 8;
const FACTORIOLAB_CATEGORY_TABS = 6;
const FACTORIOLAB_COLUMN_CHOICES = 7;
/**
 * The digit typed onto the end of the default output rate of 1, turning it into
 * 10. It is typed rather than set, so the keystroke, the `input` the field
 * emits and the `change` the blur emits are all genuine.
 */
const FACTORIOLAB_TYPED_RATE_DIGIT = '0' as const;
/**
 * Every navigation the journey performs after the initial document load: the
 * three fragment pushes the application makes as the plan changes, the flow
 * route and the return to the list, the one real document reload, and the
 * fragment the application re-emits for the plan it restored. Pinning the exact
 * count is what keeps a silently dropped or duplicated state push from passing
 * unnoticed; the ordered sequence itself is pinned in the receipt schema.
 */
const FACTORIOLAB_JOURNEY_NAVIGATIONS = 7;

/**
 * jira-clone journey inputs.
 *
 * Every selector below is the application's own: the board columns are the
 * drop lists Angular CDK gives its own status ids, the cards are the
 * application's `issue-card` elements, and the modal surfaces are the
 * components the application renders into the overlay. Nothing here is a test
 * hook the application does not otherwise have.
 */
const JIRA_CLONE_VIEWPORT = { width: 1280, height: 720 } as const;
const JIRA_CLONE_ROUTE = '/project/board' as const;
const JIRA_CLONE_COLUMN = '.board-dnd-list' as const;
const JIRA_CLONE_BACKLOG = '#Backlog' as const;
const JIRA_CLONE_SELECTED = '#Selected' as const;
/** The four drop-list ids, which are also the names the board evidence records. */
const JIRA_CLONE_BACKLOG_COLUMN = 'Backlog' as const;
const JIRA_CLONE_SELECTED_COLUMN = 'Selected' as const;
const JIRA_CLONE_BACKLOG_CARDS = `${JIRA_CLONE_BACKLOG} issue-card` as const;
const JIRA_CLONE_SELECTED_CARDS = `${JIRA_CLONE_SELECTED} issue-card` as const;
const JIRA_CLONE_FIRST_BACKLOG_CARD = `${JIRA_CLONE_BACKLOG_CARDS}:nth-of-type(1)` as const;
const JIRA_CLONE_FIRST_SELECTED_CARD = `${JIRA_CLONE_SELECTED_CARDS}:nth-of-type(1)` as const;
const JIRA_CLONE_FIRST_SELECTED_TITLE = `${JIRA_CLONE_FIRST_SELECTED_CARD} p` as const;
/**
 * The board as a whole, read group by group. The group's name is the drop
 * list's own id rather than its heading, because the heading interleaves the
 * column's issue count with its display name and the identity of a column has
 * to survive the count changing under a drag.
 */
const JIRA_CLONE_BOARD_PROBE = {
	group: JIRA_CLONE_COLUMN,
	name: '.cdk-drop-list',
	nameAttribute: 'id',
	item: 'issue-card p',
} as const satisfies WitnessGroupedTextProbe;
/** The open issue modal, read the same way: its type line names it, its title box is the item. */
const JIRA_CLONE_MODAL_PROBE = {
	group: 'issue-detail',
	name: 'issue-type j-button button',
	item: 'issue-title textarea',
} as const satisfies WitnessGroupedTextProbe;
const JIRA_CLONE_DRAG_ISSUE = 'Angular Spotify 🎧' as const;
/**
 * Interpolated pointer steps for the board drag. Angular CDK begins tracking a
 * drag only after the pointer has moved past its own threshold, so the gesture
 * is made of enough real moves to cross it rather than one jump the library
 * never observes.
 */
const JIRA_CLONE_DRAG_STEPS = 10;
const JIRA_CLONE_MODAL_TYPE = 'issue-detail issue-type j-button button' as const;
const JIRA_CLONE_MODAL_STATUS = 'issue-detail issue-status j-button button' as const;
const JIRA_CLONE_MODAL_TITLE = 'issue-detail issue-title textarea' as const;
const JIRA_CLONE_MODAL_DESCRIPTION = 'issue-detail issue-description .ql-editor' as const;
const JIRA_CLONE_MODAL_CLOSE = 'issue-detail j-button[icon="times"] button' as const;
const JIRA_CLONE_ISSUE_TYPE_LINE = 'Story-2021' as const;
/**
 * The status the dragged issue reports once its modal is reopened. This is the
 * settled Akita state rather than the drop animation, and it is also the
 * mutation seam: the string is shipped in the migrated bundle exactly once, and
 * overwriting it has to turn this journey red.
 */
export const JIRA_CLONE_MUTATION_SEAM = 'Selected for Development' as const;
/**
 * A fragment of the seeded description, rendered as read-only rich text. The
 * journey asserts that it renders and never that it can be edited: the editor
 * is a Quill surface that refuses synthetic keystrokes, so an edit claim would
 * record the driver's limitation rather than the application's behavior.
 */
const JIRA_CLONE_DESCRIPTION_TEXT = 'I wanted to introduce you my latest application' as const;
const JIRA_CLONE_DESCRIPTION_NONCLAIM =
	'The description editor is a Quill surface that does not accept the synthetic keystrokes the driver produces, so editing it is not claimed; the journey asserts only that the seeded description renders.' as const;
/**
 * Typed onto the end of the issue title with a real key sequence. It carries no
 * fragment of the filter term below, so the filter's narrowed shape stays a
 * fact about the one issue the journey created rather than about this edit.
 */
const JIRA_CLONE_TITLE_SUFFIX = ' [edited]' as const;
/**
 * The create-issue control is the third navbar item. The second opens a search
 * drawer whose overlay intercepts every later pointer gesture, which is
 * recorded here so the next reader does not rediscover it by hanging a journey.
 */
const JIRA_CLONE_CREATE_CONTROL = 'aside.navbarLeft .item:nth-of-type(3) .itemIcon' as const;
const JIRA_CLONE_CREATE_MODAL = 'add-issue-modal' as const;
const JIRA_CLONE_CREATE_TITLE = 'add-issue-modal input.form-input' as const;
const JIRA_CLONE_CREATE_SUBMIT =
	'add-issue-modal .form-action j-button:nth-of-type(1) button' as const;
const JIRA_CLONE_CREATED_ISSUE = `${WITNESS_ANGULAR_JIRA_CLONE_FILTER_TERM} created issue` as const;
const JIRA_CLONE_FILTER_INPUT = 'board-filter input.form-input' as const;
/** The four columns' card selectors, in the order the board lays them out. */
const JIRA_CLONE_COLUMN_CARDS = [
	JIRA_CLONE_BACKLOG_CARDS,
	JIRA_CLONE_SELECTED_CARDS,
	'#InProgress issue-card',
	'#Done issue-card',
] as const;
const JIRA_CLONE_TOOLTIP = '.ant-tooltip-inner' as const;
const JIRA_CLONE_AVATAR = `${JIRA_CLONE_BACKLOG_CARDS} j-avatar` as const;
/**
 * The seven rendered-appearance probes. The migration replaced the component
 * library's narrow per-component style entry points with its single aggregate
 * stylesheet, so the two lanes ship different style bytes on purpose; these
 * measurements are how the receipt says that difference is invisible, and the
 * behavior digest requires both lanes to produce them identically.
 */
const JIRA_CLONE_STYLE_PROBES = [
	{
		label: 'issue-card',
		selector: `${JIRA_CLONE_BACKLOG_CARDS} .issue`,
		properties: ['background-color', 'border-radius', 'box-shadow', 'font-size', 'color'],
	},
	{
		label: 'board-column',
		selector: JIRA_CLONE_COLUMN,
		properties: ['width', 'margin-right', 'background-color'],
	},
	{
		label: 'column-header',
		selector: `${JIRA_CLONE_COLUMN} div.uppercase`,
		properties: ['text-transform', 'font-size', 'color'],
	},
	{
		label: 'filter-input',
		selector: JIRA_CLONE_FILTER_INPUT,
		properties: ['height', 'border-radius', 'background-color', 'font-size'],
	},
	{ label: 'navbar', selector: 'aside.navbarLeft', properties: ['background-color', 'width'] },
	{ label: 'sidebar', selector: '.sidebar', properties: ['background-color', 'width'] },
	{
		label: 'document-body',
		selector: 'body',
		properties: ['font-family', 'background-color', 'overflow-y'],
	},
] as const satisfies readonly WitnessRenderedStyleProbe[];
/**
 * Every navigation after the initial document load, which is not itself
 * recorded as one: the redirect the router makes from the root to the board,
 * the one real document reload, and the redirect the router makes again as the
 * reloaded application boots. Modal surfaces deliberately contribute none — an
 * issue modal that started pushing a route of its own would show up here as a
 * count that no longer matches.
 */
const JIRA_CLONE_JOURNEY_NAVIGATIONS = 3;
/** The board is the only route the journey ever occupies; the labels name the stage. */
const jiraCloneStage = (stage: string): string => `${JIRA_CLONE_ROUTE} (${stage})`;
const jiraCloneColumns = (groups: readonly WitnessGroupedText[]): WitnessAngularJiraCloneColumn[] =>
	groups.map((group) => ({ column: group.name, issues: [...group.items] }));
const jiraCloneCounts = (columns: readonly WitnessAngularJiraCloneColumn[]): number[] =>
	columns.map((column) => column.issues.length);

/**
 * The one non-loopback seam the application posts to is its error-reporting
 * envelope, and it is answered with the empty JSON document the reporting
 * client expects so the report completes instead of retrying. Everything else
 * the application reaches for is a script or an image, answered empty. Nothing
 * leaves the machine either way, and the account identifiers these endpoints
 * carry live in the query, which is never recorded.
 */
export async function angularJiraCloneTransport(
	request: WitnessTransportRequest,
): Promise<WitnessTransportDecision> {
	const endpoint = `${request.protocol}//${request.host}${request.pathname}`;
	const reporting = WITNESS_ANGULAR_JIRA_CLONE_MOCKED_SEAMS.migrated.some(
		(seam) =>
			seam.method === request.method && seam.path === endpoint && seam.method === 'POST',
	);
	return reporting
		? {
				action: 'fulfill',
				status: 200,
				contentType: 'application/json',
				body: Buffer.from('{}'),
			}
		: { action: 'fulfill', status: 204, contentType: 'text/plain', body: Buffer.alloc(0) };
}

/* -------------------------------------------------------------------------- */
/* killedbygoogle: the LEGACY-NEXT static-export vertical                       */
/* -------------------------------------------------------------------------- */

/**
 * The graveyard list, scoped by the only structural fact that distinguishes it
 * from the press-coverage list further down the page: its rows carry record
 * titles. Scoping by a bare `ul` would silently count the footer's logos.
 */
const KBG_LIST = 'ul:has(h2)' as const;
const KBG_LIST_ITEM = `${KBG_LIST} > li` as const;
const KBG_RECORD = `${KBG_LIST} > li h2` as const;
const KBG_AD_SLOT = `${KBG_LIST} > li:nth-of-type(1)` as const;
const KBG_AD_SLOT_LABEL = `${KBG_AD_SLOT} > span` as const;
const KBG_FIRST_RECORD_TITLE = `${KBG_LIST} > li:nth-of-type(2) h2` as const;
const KBG_SEARCH_BOX = '#searchBox' as const;
const KBG_FILTER = '#listFilter' as const;
const KBG_FILTER_INPUT = '#react-select-filter-select-input' as const;
const KBG_CLICK_FILTER_OPTION = '#react-select-filter-select-option-3' as const;
const KBG_HEADER_TITLE = 'header h1' as const;
const KBG_TITLE = 'Killed by Google' as const;
const KBG_WHEEL_DELTA_Y = 900 as const;
/**
 * The navigations each lane records after its initial document load, asserted
 * exactly and separately because the two lanes genuinely differ here.
 *
 * The journey navigates nowhere: this application has one authored route and no
 * router, and every gesture in the journey is an in-place state change. Both
 * lanes therefore record the journey's own document reload. The era lane records
 * one more — the framework's client router installs its own history entry for
 * the same URL when it hydrates — and after the lift there is no router to do
 * that. The URL is identical in both cases and nothing about the rendered page
 * differs, so the difference is recorded and asserted rather than smoothed over
 * by a looser assertion that would fit either lane.
 */
const KBG_JOURNEY_NAVIGATIONS: Record<Lane, number> = { baseline: 2, migrated: 1 };

/**
 * The mutation seam: a string the journey asserts by its rendered text, which is
 * what makes overwriting it in the migrated bundle turn the journey red on that
 * exact assertion rather than on something incidental.
 */
export const KBG_MUTATION_SEAM = 'Advertisement' as const;

/**
 * The grouped-text probe that reads the settled list off the live page: every
 * row that carries a record title is a group, named by that title, whose item is
 * the rendered description. It is the oracle for the one question this vertical
 * exists to answer — whether the document the era lane pre-rendered and the
 * document the migrated lane mounts settle to the same list.
 */
const KBG_LIST_PROBE: WitnessGroupedTextProbe = {
	group: `${KBG_LIST} > li:has(h2)`,
	name: 'h2',
	item: 'p',
};

/**
 * The rendered-appearance probes. They are spread across the page on purpose:
 * the document body and the header answer whether Emotion's global and
 * component styles resolved at all, the list container answers whether its grid
 * did, the advertising slot and a record row answer whether the styles the
 * migration's dropped Babel plugin used to label still resolve to the same
 * values, and the search box answers it for a form control.
 */
const KBG_STYLE_PROBES: readonly WitnessRenderedStyleProbe[] = Object.freeze([
	Object.freeze({
		label: 'document-body',
		selector: 'body',
		properties: Object.freeze(['background-color', 'color', 'font-family', 'margin']),
	}),
	Object.freeze({
		label: 'header-title',
		selector: KBG_HEADER_TITLE,
		properties: Object.freeze(['font-size', 'font-weight', 'margin', 'color']),
	}),
	Object.freeze({
		label: 'list-container',
		selector: KBG_LIST,
		properties: Object.freeze([
			'display',
			'grid-template-columns',
			'gap',
			'list-style-type',
			'padding',
		]),
	}),
	Object.freeze({
		label: 'advertising-list-item',
		selector: KBG_AD_SLOT,
		properties: Object.freeze([
			'display',
			'align-items',
			'justify-content',
			'border-bottom-width',
		]),
	}),
	Object.freeze({
		label: 'first-record-list-item',
		selector: `${KBG_LIST} > li:nth-of-type(2)`,
		properties: Object.freeze(['display', 'flex', 'margin', 'box-sizing']),
	}),
	Object.freeze({
		label: 'first-record-title',
		selector: KBG_FIRST_RECORD_TITLE,
		properties: Object.freeze(['font-weight', 'margin', 'font-size']),
	}),
	Object.freeze({
		label: 'search-box',
		selector: KBG_SEARCH_BOX,
		properties: Object.freeze([
			'border-bottom-color',
			'font-size',
			'font-weight',
			'background-color',
		]),
	}),
]);

/* -------------------------------------------------------------------------- */
/* LinkFree: the create-react-app 5 vertical, on a SYNTHETIC profile corpus     */
/* -------------------------------------------------------------------------- */

const LINKFREE_VIEWPORT = { width: 1280, height: 720 } as const;
const LINKFREE_HOME_HEADLINE =
	'LinkFree connects audiences to all of your content with just one link' as const;
/**
 * The mutation seam: the not-found text the journey asserts by its rendered
 * body, which is what makes overwriting it in the migrated bundle turn the
 * journey red on that exact assertion rather than on something incidental.
 */
export const LINKFREE_MUTATION_SEAM = 'Profile not found.' as const;
const LINKFREE_SEARCH_LINK = 'a[aria-label="Search"]' as const;
const LINKFREE_HOME_LINK = 'a[aria-label="Go back to Home"]' as const;
const LINKFREE_BACK_TO_SEARCH = 'a[aria-label="Go back to Search"]' as const;
/**
 * The application's own hard-coded example-profile link, reached structurally.
 * The href names a real person, so the selector deliberately does not: it is the
 * first anchor of the third paragraph of the homepage, which is what a reader
 * clicks.
 */
const LINKFREE_EXAMPLE_PROFILE_LINK = 'main p.text-1xl a:nth-of-type(1)' as const;
const LINKFREE_SEARCH_INPUT = '#search-input' as const;
const LINKFREE_DIRECTORY_ENTRY = '.user-list > a' as const;
const LINKFREE_PROFILE_NAME = 'main section h1' as const;
const LINKFREE_PROFILE_USERNAME = 'main section p.text-2xl' as const;
const LINKFREE_PROFILE_BIO = 'main section .w-50 p' as const;
const LINKFREE_PROFILE_LINK = 'a.p-button-outlined' as const;
const LINKFREE_PROFILE_FIRST_LINK = 'a.p-button-outlined.github' as const;
const LINKFREE_PROFILE_AVATAR = '.p-avatar img' as const;
const LINKFREE_SCROLL_TO_TOP = '.scrollToTop-btn' as const;
const LINKFREE_SEARCH_TERM = 'nim' as const;
const LINKFREE_WHEEL_DELTA_Y = 500 as const;
/**
 * The link colour the application's own `src/config/links.json` declares for the
 * first icon, as the browser resolves it. The hover handler assigns it inline,
 * so this is the observable result of the gesture rather than a stylesheet rule.
 */
const LINKFREE_HOVER_BACKGROUND = 'rgb(23, 21, 21)' as const;
/** What the application's own stylesheet turns the label into while hovered. */
const LINKFREE_HOVER_LABEL_COLOR = 'rgb(255, 255, 255)' as const;
const LINKFREE_JOURNEY_NAVIGATIONS = WITNESS_REACT_LINKFREE_ROUTES.length;
const LINKFREE_PROFILE_ROUTE = `/${LINKFREE_JOURNEY_PROFILE.username}`;

/**
 * What this vertical's runner staged in front of both lanes, bound before any
 * browser is launched. The journey records the corpus digests it was served, so
 * a lane pair that somehow received different datasets could never agree on a
 * behavior digest.
 */
let linkfreeStaging: LinkfreeStagedCorpus | null = null;
export function bindReactLinkfreeStaging(staged: LinkfreeStagedCorpus): void {
	linkfreeStaging = staged;
}
const linkfreeStagedCorpus = (): LinkfreeStagedCorpus => {
	if (linkfreeStaging === null)
		throw new Error('LinkFree Witness staging was not bound before the journey ran');
	return linkfreeStaging;
};

/**
 * The closed-list route redaction.
 *
 * Two static routes and the profile routes the SYNTHETIC corpus declares are
 * recorded verbatim. Anything else is a profile route this corpus does not
 * contain — in this journey, the example profile the application's own homepage
 * hard-codes, which names a real person — and is recorded as the placeholder.
 * The rule is positive rather than a blocklist, so a real username cannot reach
 * the evidence by being one nobody thought to exclude.
 */
const normalizeLinkfreeRoute = (path: string): string =>
	path === '/' ||
	path === '/search' ||
	LINKFREE_SYNTHETIC_PROFILES.some((profile) => path === `/${profile.username}`)
		? path
		: WITNESS_REACT_LINKFREE_REDACTED_ROUTE;

/**
 * A deterministic fallback avatar, so the cascaded host answers with a real
 * image the browser can decode rather than with an empty body that would fail a
 * second time and hide what was being measured.
 */
const LINKFREE_FALLBACK_AVATAR_SVG =
	'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="#dddddd"/></svg>';

/**
 * Both avatar hosts, answered in context.
 *
 * The declared endpoint is answered 404 because that is the truthful answer for
 * a synthetic account that does not exist at that host — and it is what drives
 * the application's own onerror handler to the second host, which is the cascade
 * the ingest warned a hermetic run must not leave unanswered. The second host is
 * answered with a decodable image. Anything else outside the loopback origin is
 * answered empty and then fails the seam inventory, which is the point.
 */
export async function reactLinkfreeTransport(
	request: WitnessTransportRequest,
): Promise<WitnessTransportDecision> {
	const endpoint = `${request.protocol}//${request.host}${request.pathname}`;
	if (endpoint.startsWith(`${LINKFREE_AVATAR_FALLBACK_HOST}/`))
		return {
			action: 'fulfill',
			status: 200,
			contentType: 'image/svg+xml',
			body: Buffer.from(LINKFREE_FALLBACK_AVATAR_SVG),
		};
	if (endpoint.startsWith(`${LINKFREE_AVATAR_HOST}/`))
		return { action: 'fulfill', status: 404, contentType: 'text/plain', body: Buffer.alloc(0) };
	return { action: 'fulfill', status: 204, contentType: 'text/plain', body: Buffer.alloc(0) };
}

/**
 * Memos journey inputs.
 *
 * Every selector below is the application's own class, transcribed from
 * `web/src` at the pinned revision, and every count is derived from the frozen
 * projection seed rather than written down twice.
 */
const MEMOS_VIEWPORT = { width: 1280, height: 720 } as const;
/**
 * The visible list-status text the memo list renders once it has fetched and is
 * not filtering. The journey asserts it, so replacing its bytes makes the
 * browser journey genuinely red rather than merely changing an unread constant.
 */
export const MEMOS_MUTATION_SEAM = 'Fetching completed 🎉' as const;
const MEMOS_SIGNIN_EMAIL = '.page-wrapper.signin input[type="email"]' as const;
const MEMOS_SIGNIN_PASSWORD = '.page-wrapper.signin input[type="password"]' as const;
const MEMOS_SIGNIN_BUTTON = '.page-wrapper.signin .signin-btn' as const;
const MEMOS_HEADER_TITLE = '.memos-header-container .title-text' as const;
const MEMOS_USERNAME = '.user-banner-container .username-text' as const;
const MEMOS_LIST_ENTRY = '.memo-list-container > .memo-wrapper' as const;
const MEMOS_LIST_STATUS = '.memo-list-container .status-text' as const;
const MEMOS_EDITOR_INPUT = '.memo-editor-container .common-editor-inputer' as const;
const MEMOS_EDITOR_SAVE = '.memo-editor-container .confirm-btn' as const;
const MEMOS_SEARCH_INPUT = '.search-bar-container .text-input' as const;
const MEMOS_TAG_ITEM = '.tags-container > .tag-item-container' as const;
const MEMOS_SIDEBAR_SETTING =
	'.sidebar-wrapper .action-btns-container > button:nth-of-type(2)' as const;
const MEMOS_SIDEBAR_TRASH =
	'.sidebar-wrapper .action-btns-container > button:nth-of-type(3)' as const;
const MEMOS_TRASH_ENTRY = '.memo-trash-dialog .deleted-memos-container > .memo-wrapper' as const;
const MEMOS_TRASH_CLOSE = '.memo-trash-dialog .dialog-header-container .close-btn' as const;
const MEMOS_SETTING_USERNAME = '.setting-dialog .username-label input' as const;
const MEMOS_SETTING_CONFIRM = '.setting-dialog .username-label .confirm-btn' as const;
const MEMOS_SETTING_CLOSE = '.setting-dialog .dialog-content-container > .close-btn' as const;
/** The seeded memo the archive journey moves to the recycle bin and back. */
const MEMOS_ARCHIVED_MEMO_ID = 2;
const MEMOS_ARCHIVED_MEMO = `.memo-wrapper.memos-${String(MEMOS_ARCHIVED_MEMO_ID)}` as const;
/**
 * The memo's action column. It is the hover target rather than the `…` control
 * inside it because the menu the hover reveals is positioned OVER that control,
 * so the pointer necessarily ends up on the menu; hovering the column the menu
 * belongs to says what actually happens instead of pretending the pointer
 * stays on the button underneath it.
 */
const MEMOS_ARCHIVED_ACTION_COLUMN =
	`${MEMOS_ARCHIVED_MEMO} .memo-top-wrapper > .btns-container` as const;
const MEMOS_ARCHIVED_ACTIONS = `${MEMOS_ARCHIVED_MEMO} .more-action-btns-wrapper` as const;
const MEMOS_ARCHIVED_DELETE = `${MEMOS_ARCHIVED_MEMO} .btn.delete-btn` as const;
const MEMOS_TRASH_RESTORE = `.memo-trash-dialog ${MEMOS_ARCHIVED_MEMO} .btn.restore-btn` as const;
const MEMOS_COMPOSED_CONTENT =
	'Witnessed compose on the retained lane. #evidence recorded.' as const;
/** The projection mints identifiers from the seed's own high-water mark. */
const MEMOS_COMPOSED_MEMO_ID = MEMOS_SEED.memos.length + 1;
const MEMOS_COMPOSED_MEMO = `.memo-wrapper.memos-${String(MEMOS_COMPOSED_MEMO_ID)}` as const;
/** A substring of exactly one seeded memo, so the narrowed count is one. */
const MEMOS_SEARCH_TERM = 'majors' as const;
const MEMOS_TAG = 'migration' as const;
const MEMOS_NEXT_USERNAME = 'evidence-owner' as const;
/**
 * The exact number of recorded navigations.
 *
 * This application has no router library: it writes its own history entries
 * through `history.replaceState`, once per query change, so a typed search
 * records one navigation per keystroke. That makes the count large and it makes
 * it EXACT — every one of them is the application's own call — so it is pinned
 * rather than bounded.
 */
export const MEMOS_JOURNEY_NAVIGATIONS = 13;
/** Seeded live memos, plus the one the journey writes. */
const MEMOS_SEEDED_LIVE = MEMOS_SEED.memos.filter((record) => record.rowStatus === 'NORMAL').length;
const MEMOS_SEEDED_ARCHIVED = MEMOS_SEED.memos.length - MEMOS_SEEDED_LIVE;
const MEMOS_LIVE_AFTER_COMPOSE = MEMOS_SEEDED_LIVE + 1;
/** The tags the projection derives from the live seeded memos, in its own order. */
const MEMOS_TAGS = [
	...new Set(
		MEMOS_SEED.memos
			.filter((record) => record.rowStatus === 'NORMAL')
			.flatMap((record) => memosTagsInContent(record.content)),
	),
].sort();

/**
 * The per-run projection instance.
 *
 * The loopback factory is invoked once per run by {@link executeRun}, so this
 * always holds the projection the browser in front of it is talking to, and the
 * journey can read the ledger that projection actually wrote rather than a
 * reconstruction of it.
 */
let memosProjection: MemosProjection | null = null;
const memosProjectionForRun = (): MemosProjection => {
	if (memosProjection === null)
		throw new Error('Memos journey ran without its frozen synthetic projection');
	return memosProjection;
};

/**
 * The ordered ledger the most recent Memos run's projection wrote, so the whole
 * sequence can be published as an artifact alongside the tally the receipt
 * digests.
 */
export function reactMemosProjectionLedger(): MemosProjectionLedgerRecord[] {
	return memosProjectionForRun().ledger();
}

/**
 * The projection ledger, tallied by request identity instead of by sequence.
 *
 * The application fires several of its mount requests concurrently, so the
 * ORDER two runs record them in is a property of the event loop rather than of
 * the application. Tallying by identity keeps every method, path, endpoint,
 * decision and status in the evidence — and keeps the count of each exact —
 * without pinning a race.
 */
function memosLedgerTally(
	records: readonly MemosProjectionLedgerRecord[],
): WitnessReactMemosLedgerEntry[] {
	const tally = new Map<string, WitnessReactMemosLedgerEntry>();
	for (const entry of records) {
		const key = canonicalize({
			method: entry.method,
			pathname: entry.pathname,
			endpoint: entry.endpoint,
			decision: entry.decision,
			status: entry.status,
		});
		const found = tally.get(key);
		if (found === undefined)
			tally.set(key, {
				method: entry.method,
				pathname: entry.pathname,
				endpoint: entry.endpoint,
				decision: entry.decision,
				status: entry.status,
				count: 1,
			});
		else found.count += 1;
	}
	return [...tally.entries()]
		.sort(([left], [right]) => compareUtf16CodeUnits(left, right))
		.map(([, entry]) => entry);
}

const apps: AppSpec[] = [
	{
		app: 'react-boilerplate',
		framework: 'react',
		canonicalReceipt: 'evidence/runs/react-boilerplate-v4-composed/t060-run.json',
		canonicalDigest: '52400147929220935a9ebe47a16c8dff50b5c28e9d51c930d000c99c2bdc8a21',
		sources: {
			baseline: '.versionless/work/react-boilerplate-v4-composed/legacy/build',
			migrated: '.versionless/work/react-boilerplate-v4-composed/target/build-vite',
		},
		transport: async (request, transportEvidence) => {
			const payload = await readFile(
				join(root, 'fixtures/react-boilerplate-v4-data-flow/repos.json'),
			);
			if (request.host === 'api.github.com') {
				const parts = request.pathname.split('/').filter(Boolean);
				if (parts.length === 3 && parts[0] === 'users' && parts[2] === 'repos')
					transportEvidence.apiUsernames.push(decodeURIComponent(parts[1]!));
				return {
					action: 'fulfill',
					status: 200,
					contentType: 'application/json',
					body: payload,
				};
			}
			if (request.host === 'fonts.googleapis.com')
				return {
					action: 'fulfill',
					status: 200,
					contentType: 'text/css',
					body: Buffer.from(
						'@font-face { font-family: "Open Sans"; src: local("Arial"); font-style: normal; font-weight: 400 700; }',
					),
				};
			return {
				action: 'fulfill',
				status: 204,
				contentType: 'text/plain',
				body: Buffer.alloc(0),
			};
		},
		journey: async (context, page, transportEvidence, lifecycle) => {
			await page.trackEvents('click', 'input', 'change', 'keydown', 'mouseover');
			await page.click('a[href="/features"]');
			await context.expect.page.bodyText(page, { contains: 'Features' });
			await page.click('a[href="/"]');
			await page.click('select');
			await page.press('select', 'd');
			await context.expect.page.bodyText(page, {
				contains: 'Beginnen Sie Ihr nächstes React Projekt in Sekunden',
			});
			await page.hover('#username');
			await page.type('#username', 'octocat');
			await page.press('#username', 'Enter');
			await context.expect.page.bodyText(page, { contains: 'owned-repo' });
			await context.expect.page.bodyText(page, { contains: 'fork-owner/forked-repo' });
			await page.scroll(null, { y: 500 });
			await context.expect.page.outcome(page, {
				events: {
					click: { atLeast: 3 },
					input: { atLeast: 1 },
					change: { atLeast: 1 },
					keydown: { atLeast: 1 },
					mouseover: { atLeast: 1 },
				},
			});
			if (lifecycle.expectedServiceWorker === null)
				throw new Error('React service-worker expectation is absent');
			const readyTelemetry = await lifecycle.serviceWorkerTelemetry(10_000);
			if (readyTelemetry.state === 'timeout')
				return {
					assertions: ['service-worker readiness diagnostic'],
					offlineEvidence: { state: 'not-applicable' },
					timeoutTelemetry: readyTelemetry,
				};
			if (
				readyTelemetry.registration.scriptPath !== '/sw.js' ||
				readyTelemetry.registration.scope !== '/' ||
				readyTelemetry.registration.active !== 'activated' ||
				canonicalize({
					cacheNames: readyTelemetry.cacheNames,
					cacheEntries: readyTelemetry.cacheEntries,
				}) !== canonicalize(lifecycle.expectedServiceWorker)
			)
				throw new Error('React ready service-worker cache inventory differs');
			const readyLifecycle = readyTelemetry as WitnessServiceWorkerTelemetry;
			await page.reload();
			const controlledTelemetry = await lifecycle.serviceWorkerTelemetry(10_000);
			if (controlledTelemetry.state === 'timeout')
				return {
					assertions: ['service-worker controller diagnostic'],
					offlineEvidence: { state: 'not-applicable' },
					timeoutTelemetry: controlledTelemetry,
				};
			if (
				controlledTelemetry.registration.scriptPath !== '/sw.js' ||
				controlledTelemetry.registration.scope !== '/' ||
				controlledTelemetry.registration.active !== 'activated' ||
				controlledTelemetry.controller !== 'activated' ||
				canonicalize({
					cacheNames: controlledTelemetry.cacheNames,
					cacheEntries: controlledTelemetry.cacheEntries,
				}) !== canonicalize(lifecycle.expectedServiceWorker)
			)
				throw new Error(
					'React service worker did not control the exact cached application',
				);
			const controlledLifecycle = controlledTelemetry as WitnessServiceWorkerTelemetry & {
				controller: 'activated';
			};
			const onlineRequests = [...new Set(lifecycle.staticRequests())].sort();
			const precachePaths = lifecycle.expectedServiceWorker.cacheEntries[0]!.paths.filter(
				(path) => path !== '/__offline_webpack__data',
			);
			if (
				!onlineRequests.includes('/sw.js') ||
				precachePaths.some((path) => !onlineRequests.includes(path))
			)
				throw new Error(
					'React online service-worker or precache request inventory differs',
				);
			const requestsBeforeOffline = lifecycle.staticRequests().length;
			await page.emulateNetwork({
				offline: true,
				latencyMs: 0,
				downloadThroughputBytesPerSecond: -1,
				uploadThroughputBytesPerSecond: -1,
			});
			await page.reload();
			await context.expect.page.bodyText(page, {
				contains: 'Start your next react project in seconds',
				notContains: 'owned-repo',
			});
			await context.expect.page.bodyText(page, { notContains: 'fork-owner/forked-repo' });
			const offlineServerRequests = lifecycle.staticRequests().length - requestsBeforeOffline;
			if (offlineServerRequests !== 0)
				throw new Error('React offline reload reached the production-static server');
			await page.clearNetworkEmulation();
			await page.type('#username', 'reset-proof');
			await page.press('#username', 'Enter');
			await context.expect.page.bodyText(page, { contains: 'owned-repo' });
			if (transportEvidence.apiUsernames.join(',') !== 'octocat,reset-proof')
				throw new Error('React username state did not reset after offline reload');
			await clean(context, page, 4);
			return {
				assertions: [
					'feature route',
					'keyboard locale selection',
					'canonical repository payload',
					'offline shell render and state reset',
					'clean page',
				],
				offlineEvidence: {
					state: 'react-shell-rendered-state-reset',
					shellRendered: true,
					usernameReset: true,
					repositoriesReset: true,
					apiResponseCaching: 'not-claimed',
					reduxPersistence: 'not-implemented',
					priorResultPersistence: 'not-implemented',
					harnessFulfillment: 'synthetic-github-route-online-only',
					serviceWorkerEvidence: {
						source: 'canonical-t060',
						receiptPath: 'evidence/runs/react-boilerplate-v4-composed/t060-run.json',
						canonicalDigest:
							'52400147929220935a9ebe47a16c8dff50b5c28e9d51c930d000c99c2bdc8a21',
						newProof: false,
					},
					lifecycle: {
						state: 'ready-online-reload-controlled-offline-reset',
						ready: readyLifecycle,
						controlled: controlledLifecycle,
						onlineStaticPaths: onlineRequests,
						offlineServerRequests: 0,
					},
				},
			};
		},
	},
	{
		app: 'angular-phonecat',
		framework: 'angularjs',
		canonicalReceipt: 'evidence/runs/angular-phonecat-composed/t048-run.json',
		canonicalDigest: 'a7e8a9dc864085d77338f1615e3434a8a842fa5f4156a13bd2f5560bd2f8dc12',
		sources: {
			baseline: '.versionless/work/angular-phonecat-composed/legacy/app',
			migrated: '.versionless/work/angular-phonecat-composed/target/app',
		},
		initialRoute: '/#!/phones',
		journey: async (context, page, _transportEvidence, lifecycle) => {
			const query = 'input[ng-model="$ctrl.query"]';
			await page.trackEvents('click', 'input', 'change', 'keydown', 'mouseover');
			await page.type(query, 'nexus');
			await context.expect.page.count(page, 'ul.phones > li', 1);
			for (let index = 0; index < 5; index += 1) await page.press(query, 'Backspace');
			await context.expect.page.count(page, 'ul.phones > li', 20);
			await page.click('select');
			await page.press('select', 'a');
			await context.expect.page.exists(page, 'select option[value="name"]:checked');
			await context.expect.page.outcome(page, { events: { change: { atLeast: 1 } } });
			if (lifecycle.phonecatOrdering === null)
				throw new Error('PhoneCat data-derived ordering expectation is absent');
			for (const [index, name] of lifecycle.phonecatOrdering.names.entries())
				await context.expect.page.text(
					page,
					`ul.phones > li:nth-child(${index + 1}) a:not(.thumb)`,
					name,
				);
			await page.type(query, 'nexus');
			await page.click('ul.phones a:not(.thumb)');
			await context.expect.page.text(page, 'h1', 'Nexus S');
			if (lifecycle.phonecatImages === null)
				throw new Error('PhoneCat data-derived image expectation is absent');
			await context.expect.page.attribute(
				page,
				'img.phone.selected',
				'src',
				lifecycle.phonecatImages.defaultImage,
			);
			const nonDefaultThumbnail = `ul.phone-thumbs img[ng-src=${JSON.stringify(
				lifecycle.phonecatImages.nonDefaultImage,
			)}]`;
			await page.hover(nonDefaultThumbnail);
			await context.expect.page.outcome(page, { events: { mouseover: { atLeast: 1 } } });
			await page.click(nonDefaultThumbnail);
			await context.expect.page.attribute(
				page,
				'img.phone.selected',
				'src',
				lifecycle.phonecatImages.nonDefaultImage,
			);
			await page.hover('img.phone.selected');
			await page.scroll(null, { y: 500 });
			await context.expect.page.outcome(page, {
				events: {
					click: { atLeast: 3 },
					input: { atLeast: 2 },
					change: { atLeast: 1 },
					keydown: { atLeast: 2 },
					mouseover: { atLeast: 1 },
				},
			});
			await page.reload();
			await context.expect.page.text(page, 'h1', 'Nexus S');
			await clean(context, page, 2);
			return {
				assertions: [
					'filter',
					'keyboard selection change and alphabetical ordering',
					'detail route',
					'thumbnail swap',
					'clean page',
				],
				offlineEvidence: { state: 'not-applicable' },
			};
		},
	},
	{
		app: 'killedbygoogle',
		framework: 'next',
		canonicalReceipt: 'evidence/runs/next-killedbygoogle-derived-state-to-memo/receipt.json',
		canonicalDigest: 'a018c6490cd559fab74ea402ff93660f053503dbed1a52ba9b68ed7fdc086b7c',
		sources: {
			baseline: '.versionless/stage/witness-real-app/killedbygoogle-retained/baseline',
			migrated: '.versionless/stage/witness-real-app/killedbygoogle-retained/migrated',
		},
		journey: async (context, page) => {
			const filter = '#react-select-filter-select-input';
			await page.trackEvents('click', 'input', 'change', 'keydown', 'mouseover');
			await context.expect.page.count(page, 'ul > li h2', 263);
			await page.type('#searchBox', 'Google+');
			await context.expect.page.bodyText(page, { contains: 'Google+' });
			await context.expect.page.count(page, 'ul > li h2', 1);
			await page.press('#searchBox', 'a', {
				modifiers: process.platform === 'darwin' ? ['Meta'] : ['Control'],
			});
			await page.press('#searchBox', 'Backspace');
			await page.click(filter);
			await page.type(filter, 'Apps');
			await page.press(filter, 'Enter');
			await context.expect.page.bodyText(page, { contains: 'Apps (50)' });
			await context.expect.page.count(page, 'ul > li h2', 50);
			await page.hover('ul > li h2');
			await page.scroll(null, { y: 500 });
			await context.expect.page.outcome(page, {
				events: {
					click: { atLeast: 1 },
					input: { atLeast: 2 },
					keydown: { atLeast: 2 },
					mouseover: { atLeast: 1 },
				},
			});
			await clean(context, page, 0);
			return {
				assertions: ['search', 'keyboard filter', 'filtered inventory', 'clean page'],
				offlineEvidence: { state: 'not-applicable' },
			};
		},
	},
	{
		app: 'angular-realworld',
		framework: 'angular',
		canonicalReceipt: 'evidence/runs/angular-realworld-v15-to-v16/receipt.json',
		canonicalDigest: 'bba54bc67cf5686445b207c530e04c5f9d56cf87f495250e97329e1eed8c6ad1',
		sources: {
			baseline: '.versionless/work/angular-realworld-v15-to-v16/dist/legacy',
			migrated: '.versionless/work/angular-realworld-v15-to-v16/dist/target',
		},
		transport: angularRealworldTransport,
		journey: async (context, page) => {
			await page.trackEvents('click', 'input', 'keydown', 'mouseover');
			await context.expect.page.bodyText(page, { contains: 'Global Feed' });
			await page.click('a.tag-pill');
			await page.click('a.preview-link');
			await context.expect.page.text(page, 'h1', 'Versionless Angular baseline');
			await page.hover('h1');
			await context.expect.page.bodyText(page, {
				contains: ANGULAR_REALWORLD_TERMINAL_MARKER,
			});
			await page.scroll(null, { y: 500 });
			await page.click('a[routerlink="/register"]');
			await context.expect.page.text(page, 'h1', 'Sign up');
			await page.type('input[placeholder="Username"]', 'versionless-user');
			await page.press('input[placeholder="Username"]', 'a', {
				modifiers: ['Control'],
			});
			await context.expect.page.outcome(page, {
				events: {
					click: { atLeast: 3 },
					input: { atLeast: 1 },
					keydown: { atLeast: 1 },
					mouseover: { atLeast: 1 },
				},
			});
			await page.reload();
			await context.expect.page.text(page, 'h1', 'Sign up');
			await clean(context, page, 5);
			return {
				assertions: [
					'feed',
					'tag interaction',
					'article route',
					'terminal article section rendered before observed scroll',
					'keyboard-backed registration input',
					'clean page',
				],
				offlineEvidence: { state: 'not-applicable' },
			};
		},
	},
	{
		app: 'papercups',
		framework: 'react',
		canonicalReceipt: 'evidence/runs/react-papercups-v1-0-0/t004-run.json',
		canonicalDigest: 'b433f214727389676b308332f7689d773ad28dde0984b9bf245f3f780f87d35a',
		sources: {
			baseline: '.versionless/work/react-papercups-v1-0-0/baseline/build',
			migrated: '.versionless/work/react-papercups-v1-0-0/target/build-vite',
		},
		initialRoute: '/login',
		loopback: () => {
			const projection = createPapercupsProjection();
			return {
				api: projection.api,
				upgrade: createPhoenixSocketUpgrade({
					pathname: PAPERCUPS_SOCKET_PATH,
					projection: projection.channel,
				}),
			};
		},
		journey: async (context, page, _transportEvidence, lifecycle) => {
			if (lifecycle.expectedServiceWorker !== null)
				throw new Error('Papercups journey received a service-worker expectation');
			const checkpoints = [
				await zeroServiceWorkerCheckpoint(lifecycle, 'before-interactions'),
			];
			await page.trackEvents('click', 'input', 'change', 'keydown', 'mouseover');
			await context.expect.page.bodyText(page, { contains: 'Welcome back' });
			await page.hover('#email');
			await page.type('#email', PAPERCUPS_USER.email);
			await page.type('#password', PAPERCUPS_SIGN_IN_PASSWORD);
			await page.press('#password', 'Enter');
			await context.expect.page.text(page, 'h3', 'All conversations');
			for (const preview of PAPERCUPS_OPEN_PREVIEWS)
				await context.expect.page.bodyText(page, { contains: preview });
			await page.hover('a[href="/conversations/priority"]');
			await page.click('a[href="/conversations/priority"]');
			await context.expect.page.text(page, 'h3', 'Prioritized');
			await context.expect.page.bodyText(page, {
				contains: PAPERCUPS_PRIORITY_PREVIEW,
				notContains: PAPERCUPS_UNASSIGNED_PREVIEW,
			});
			await page.hover('a[href="/conversations/closed"]');
			await page.click('a[href="/conversations/closed"]');
			await context.expect.page.text(page, 'h3', 'Closed');
			await context.expect.page.bodyText(page, {
				contains: PAPERCUPS_CLOSED_PREVIEW,
				notContains: PAPERCUPS_PRIORITY_PREVIEW,
			});
			await page.click('a[href="/conversations/all"]');
			await context.expect.page.text(page, 'h3', 'All conversations');
			await context.expect.page.bodyText(page, { notContains: PAPERCUPS_REPLY_BODY });
			await page.type('textarea.ant-input', PAPERCUPS_REPLY_BODY);
			await page.click('.ant-layout-footer button.ant-btn-primary');
			await context.expect.page.bodyText(page, { contains: PAPERCUPS_REPLY_BODY });
			await context.expect.page.outcome(page, {
				events: {
					click: { atLeast: 3 },
					input: { atLeast: 3 },
					change: { atLeast: 3 },
					keydown: { atLeast: 3 },
					mouseover: { atLeast: 1 },
				},
			});
			checkpoints.push(await zeroServiceWorkerCheckpoint(lifecycle, 'after-interactions'));
			await page.reload();
			await context.expect.page.text(page, 'h3', 'All conversations');
			await context.expect.page.bodyText(page, { contains: PAPERCUPS_REPLY_BODY });
			checkpoints.push(await zeroServiceWorkerCheckpoint(lifecycle, 'after-online-reload'));
			await clean(context, page, PAPERCUPS_JOURNEY_NAVIGATIONS);
			return {
				assertions: [
					'sign-in route change to the agent console',
					'inbox category triage across all, prioritized and closed',
					'category-distinct conversation text',
					'reply round-trip echoed over the Phoenix shout broadcast',
					'online reload retains the sent reply',
					'zero service-worker lifecycle and CacheStorage',
					'clean page',
				],
				offlineEvidence: { state: 'not-applicable' },
				zeroServiceWorkerRuntime: { registration: 'application-unregister', checkpoints },
			};
		},
	},
	{
		app: 'react-hospitalrun',
		framework: 'react',
		canonicalReceipt: 'evidence/runs/react-hospitalrun/t004-run.json',
		canonicalDigest: '1fa0278923101efe6af370a44d0ef90e3309ac4c7a823fad448eb196cca37cd8',
		sources: {
			baseline: '.versionless/work/react-hospitalrun/baseline/build-run1',
			migrated: '.versionless/work/react-hospitalrun/target/build-vite-run1',
		},
		serviceWorkers: 'block',
		viewport: HOSPITALRUN_VIEWPORT,
		consoleErrorInventory: WITNESS_REACT_HOSPITALRUN_CONSOLE_ERRORS,
		failedRequestInventory: WITNESS_REACT_HOSPITALRUN_FAILED_REQUESTS,
		normalizeRoute: normalizeHospitalrunRoute,
		journey: async (context, page, _transportEvidence, lifecycle) => {
			if (lifecycle.expectedServiceWorker !== null)
				throw new Error('HospitalRun journey received a service-worker expectation');
			const checkpoints = [
				await blockedServiceWorkerCheckpoint(lifecycle, 'before-interactions'),
			];
			await page.trackEvents('click', 'input', 'change', 'keydown', 'mouseover');
			await context.expect.page.text(page, 'h1', 'Dashboard');

			// (a) New-patient intake against the browser-local PouchDB store.
			await page.hover(sidebarItem('Patients'));
			await page.click(sidebarItem('Patients'));
			await context.expect.page.text(page, 'h1', 'Patients');
			await context.expect.page.bodyText(page, { contains: HOSPITALRUN_EMPTY_PATIENTS });
			await page.click(sidebarItem('New Patient'));
			await context.expect.page.text(page, 'h1', 'New Patient');
			await page.type('#givenNameTextInput', HOSPITALRUN_GIVEN_NAME, { redact: false });
			await page.type('#familyNameTextInput', HOSPITALRUN_FAMILY_NAME, { redact: false });
			await page.hover('button.btn-save');
			await page.click('button.btn-save');
			await context.expect.page.bodyText(page, { contains: HOSPITALRUN_INTAKE_TOAST });
			await context.expect.page.text(page, 'h1', 'Patient');
			await context.expect.page.text(page, 'h3', HOSPITALRUN_FULL_NAME);

			// (b) Clinical navigation: patient record sub-tabs, then the
			// department routes, each identified by its own visible header.
			await page.hover(patientTab('Allergies'));
			await page.click(patientTab('Allergies'));
			await context.expect.page.bodyText(page, { contains: 'No Allergies' });
			await page.click(patientTab('Notes'));
			await context.expect.page.bodyText(page, {
				contains: 'No Notes',
				notContains: 'No Allergies',
			});
			await page.click(patientTab('Related Persons'));
			await context.expect.page.bodyText(page, {
				contains: 'No related persons',
				notContains: 'No Notes',
			});
			await page.click(patientTab('General Information'));
			await context.expect.page.bodyText(page, { contains: 'Basic Information' });
			await page.click(sidebarItem('Patients'));
			await context.expect.page.text(page, 'h1', 'Patients');
			await context.expect.page.text(
				page,
				'table tbody tr td:nth-child(2)',
				HOSPITALRUN_GIVEN_NAME,
			);
			await context.expect.page.text(
				page,
				'table tbody tr td:nth-child(3)',
				HOSPITALRUN_FAMILY_NAME,
			);
			await page.click(sidebarItem('Labs'));
			await context.expect.page.text(page, 'h1', 'Labs');
			await context.expect.page.bodyText(page, { contains: 'Lab Code' });
			await page.click(sidebarItem('Incidents'));
			await context.expect.page.text(page, 'h1', 'Reported Incidents');
			await context.expect.page.bodyText(page, { contains: 'Date of Incident' });
			await page.click(sidebarItem('Imagings'));
			await context.expect.page.text(page, 'h1', 'Imagings');
			await context.expect.page.bodyText(page, { contains: 'Imaging Code' });

			// (c) Appointment schedule, the one route whose document genuinely
			// overflows the stated viewport; the scroll is a real wheel gesture.
			await page.click(sidebarItem('Scheduling'));
			await context.expect.page.text(page, 'h1', 'Appointments');
			await context.expect.page.bodyText(page, { contains: 'all-day' });
			const before = await lifecycle.viewportScroll();
			if (before.scrollHeight <= before.clientHeight || before.scrollY !== 0)
				throw new Error(
					`HospitalRun appointment schedule is not a scrollable surface: ${canonicalize(before)}`,
				);
			await page.scroll(null, { y: HOSPITALRUN_WHEEL_DELTA_Y });
			const after = await lifecycle.viewportScroll();
			if (after.scrollY <= before.scrollY || after.scrollHeight !== before.scrollHeight)
				throw new Error(
					`HospitalRun appointment schedule did not scroll: ${canonicalize(after)}`,
				);
			const scrollSurface: WitnessScrollSurface = {
				state: 'measured-genuine-viewport-scroll',
				route: HOSPITALRUN_SCROLL_ROUTE,
				viewport: { ...HOSPITALRUN_VIEWPORT },
				scrollHeight: before.scrollHeight,
				clientHeight: before.clientHeight,
				wheelDeltaY: HOSPITALRUN_WHEEL_DELTA_Y,
				scrolledFromTop: true,
				scrolled: true,
			};
			await context.expect.page.outcome(page, {
				events: {
					click: { atLeast: 10 },
					input: { atLeast: 2 },
					change: { atLeast: 2 },
					keydown: { atLeast: 2 },
					mouseover: { atLeast: 2 },
				},
			});
			checkpoints.push(await blockedServiceWorkerCheckpoint(lifecycle, 'after-interactions'));

			// The created record must survive a real document reload, which is
			// what proves the browser-local PouchDB store, not React state.
			await page.click(sidebarItem('Patients'));
			await context.expect.page.text(page, 'h1', 'Patients');
			await page.reload();
			await context.expect.page.text(page, 'h1', 'Patients');
			await context.expect.page.bodyText(page, {
				contains: HOSPITALRUN_FAMILY_NAME,
				notContains: HOSPITALRUN_EMPTY_PATIENTS,
			});
			checkpoints.push(
				await blockedServiceWorkerCheckpoint(lifecycle, 'after-online-reload'),
			);
			await clean(
				context,
				page,
				HOSPITALRUN_JOURNEY_NAVIGATIONS,
				lifecycle.expectedConsoleErrors,
				lifecycle.expectedFailedRequests,
			);
			return {
				assertions: [
					'new-patient intake persisted to the browser-local PouchDB store',
					'intake success toast naming the created patient',
					'patient row on the patients list',
					'patient record sub-tabs across allergies, notes, related persons and general information',
					'department routes labs, incidents and imaging with distinct visible headers',
					'appointment schedule with a genuine wheel scroll on a measured overflowing document',
					'created patient survives an online reload',
					'blocked service-worker registration with an exact console-error inventory',
					'clean page',
				],
				offlineEvidence: { state: 'not-applicable' },
				blockedServiceWorkerRuntime: {
					registration: 'application-register-refused-by-context',
					checkpoints,
				},
				scrollSurface,
			};
		},
	},
	{
		app: 'angular-factoriolab',
		framework: 'angular',
		canonicalReceipt: 'evidence/runs/angular-factoriolab/m2-build-parity.json',
		canonicalDigest: '4430f24ba6af8d7fd6d90faa0d4eb2fb275aab717cb9edd345f4a8ab6eb8957d',
		sources: {
			baseline: '.versionless/cache/angular-factoriolab-baseline/rebuild/dist-1',
			migrated: '.versionless/stage/angular-factoriolab-m2/dist-a',
		},
		viewport: FACTORIOLAB_VIEWPORT,
		consoleErrorInventory: WITNESS_ANGULAR_FACTORIOLAB_CONSOLE_ERRORS,
		failedRequestInventory: WITNESS_ANGULAR_FACTORIOLAB_FAILED_REQUESTS,
		cancelledDuplicateFetches: WITNESS_ANGULAR_FACTORIOLAB_CANCELLED_DUPLICATE_FETCHES,
		journey: async (context, page, _transportEvidence, lifecycle) => {
			if (lifecycle.expectedServiceWorker !== null)
				throw new Error('factoriolab journey received a service-worker expectation');
			const checkpoints = [
				await zeroServiceWorkerCheckpoint(lifecycle, 'before-interactions'),
			];
			const measuredRoutes: WitnessMeasuredScrollAbsence['routes'] = [];
			/**
			 * The generic scroll measurement, taken at every visited route. This
			 * application pins the document to the viewport and scrolls its own
			 * panels instead, so the measurement is what licenses the receipt to
			 * claim no scroll coverage: a route that started overflowing would
			 * fail here rather than pass silently unexercised.
			 */
			const measure = async (route: string): Promise<void> => {
				const extents = await lifecycle.viewportScroll();
				if (
					extents.clientHeight !== FACTORIOLAB_VIEWPORT.height ||
					extents.scrollHeight > extents.clientHeight ||
					extents.scrollY !== 0
				)
					throw new Error(
						`factoriolab route overflows the viewport the receipt says it does not: ${route} ${canonicalize(extents)}`,
					);
				measuredRoutes.push({
					route,
					scrollHeight: extents.scrollHeight,
					clientHeight: extents.clientHeight,
				});
			};
			await page.trackEvents('click', 'input', 'change', 'keydown', 'mouseover');

			// (a) The era-pinned default production plan, solved from the
			// application's own bundled Factorio 1.0 dataset.
			await context.expect.page.text(
				page,
				FACTORIOLAB_ITEMS_HEADER,
				FACTORIOLAB_ITEMS_PER_MINUTE,
			);
			await context.expect.page.count(
				page,
				FACTORIOLAB_HEADER_CELLS,
				FACTORIOLAB_COLUMNS_WITH_POLLUTION,
			);
			await context.expect.page.text(
				page,
				FACTORIOLAB_TOTAL_POWER,
				FACTORIOLAB_DEFAULT_TOTAL_POWER,
			);
			await context.expect.page.text(
				page,
				FACTORIOLAB_TOTAL_POLLUTION,
				FACTORIOLAB_DEFAULT_TOTAL_POLLUTION,
			);
			await measure('/list');

			// (b) Item picker: open it on the current product, hover a category
			// tab and an item for their tooltips, and switch the product. The
			// whole table is re-solved for the new item.
			await page.click(FACTORIOLAB_PRODUCT_ICON);
			await context.expect.page.count(
				page,
				FACTORIOLAB_PICKER_TABS,
				FACTORIOLAB_CATEGORY_TABS,
			);
			await page.hover(FACTORIOLAB_PICKER_TAB);
			await context.expect.page.text(
				page,
				FACTORIOLAB_PICKER_TAB_TOOLTIP,
				FACTORIOLAB_CATEGORY_TOOLTIP,
			);
			await page.click(FACTORIOLAB_PICKER_TAB);
			await context.expect.page.exists(page, FACTORIOLAB_PICKER_ITEM);
			await page.hover(FACTORIOLAB_PICKER_ITEM);
			await context.expect.page.text(
				page,
				FACTORIOLAB_PICKER_ITEM_TOOLTIP,
				FACTORIOLAB_ITEM_TOOLTIP,
			);
			await page.click(FACTORIOLAB_PICKER_ITEM);
			await context.expect.page.count(page, FACTORIOLAB_PICKER, 0);
			await context.expect.page.exists(page, FACTORIOLAB_CHOSEN_PRODUCT);
			await context.expect.page.text(
				page,
				FACTORIOLAB_TOTAL_POWER,
				FACTORIOLAB_IRON_PLATE_TOTAL_POWER,
			);
			await context.expect.page.text(
				page,
				FACTORIOLAB_TOTAL_POLLUTION,
				FACTORIOLAB_IRON_PLATE_TOTAL_POLLUTION,
			);

			// (c) Typed output-rate edit. The caret is put at the end of the
			// field with a real key, the digit is typed, and the field is
			// blurred with another real key so the application sees the same
			// keydown / input / change sequence a person would produce.
			await page.press(FACTORIOLAB_RATE_INPUT, 'End');
			await page.type(FACTORIOLAB_RATE_INPUT, FACTORIOLAB_TYPED_RATE_DIGIT, {
				redact: false,
			});
			await page.press(FACTORIOLAB_RATE_INPUT, 'Tab');
			await context.expect.page.text(
				page,
				FACTORIOLAB_TOTAL_POWER,
				FACTORIOLAB_RATE_TEN_TOTAL_POWER,
			);
			await context.expect.page.text(
				page,
				FACTORIOLAB_TOTAL_POLLUTION,
				FACTORIOLAB_RATE_TEN_TOTAL_POLLUTION,
			);
			await measure('/list#p=iron-plate*10');

			// (d) Columns dialog: drop a column and commit by clicking away.
			await page.click(FACTORIOLAB_COLUMNS_TOGGLE);
			await context.expect.page.text(
				page,
				FACTORIOLAB_COLUMNS_TITLE,
				FACTORIOLAB_MUTATION_SEAM,
			);
			await context.expect.page.count(
				page,
				FACTORIOLAB_COLUMN_OPTIONS,
				FACTORIOLAB_COLUMN_CHOICES,
			);
			await page.click(FACTORIOLAB_POLLUTION_OPTION);
			await page.click(FACTORIOLAB_DIALOG_DISMISS);
			await context.expect.page.count(page, FACTORIOLAB_COLUMNS_DIALOG, 0);
			await context.expect.page.count(
				page,
				FACTORIOLAB_HEADER_CELLS,
				FACTORIOLAB_COLUMNS_WITHOUT_POLLUTION,
			);
			await context.expect.page.bodyText(page, {
				notContains: FACTORIOLAB_POLLUTION_COLUMN,
			});
			await context.expect.page.text(
				page,
				FACTORIOLAB_TOTAL_POWER,
				FACTORIOLAB_RATE_TEN_TOTAL_POWER,
			);

			// (e) Settings panel: change the display rate, which re-solves the
			// whole plan, then name and save the state into browser-local
			// storage.
			await page.click(FACTORIOLAB_NAV_SETTINGS);
			await context.expect.page.exists(page, FACTORIOLAB_SETTINGS);
			await page.click(FACTORIOLAB_PER_HOUR);
			await context.expect.page.text(
				page,
				FACTORIOLAB_ITEMS_HEADER,
				FACTORIOLAB_ITEMS_PER_HOUR,
			);
			await context.expect.page.text(
				page,
				FACTORIOLAB_TOTAL_POWER,
				FACTORIOLAB_PER_HOUR_TOTAL_POWER,
			);
			await measure('/list#p=iron-plate*10&s=*************3600 (settings panel open)');
			await page.click(FACTORIOLAB_NAME_STATE);
			await page.type(FACTORIOLAB_STATE_NAME_INPUT, FACTORIOLAB_SAVED_STATE_NAME, {
				redact: false,
			});
			await page.click(FACTORIOLAB_SAVE_STATE);
			await context.expect.page.count(page, FACTORIOLAB_SAVED_STATE_OPTION, 1);
			await context.expect.page.exists(page, FACTORIOLAB_DELETE_STATE);
			await page.click(FACTORIOLAB_NAV_SETTINGS);
			await context.expect.page.count(page, FACTORIOLAB_SETTINGS, 0);
			await context.expect.page.outcome(page, {
				events: {
					click: { atLeast: 8 },
					input: { atLeast: 2 },
					change: { atLeast: 2 },
					keydown: { atLeast: 2 },
					mouseover: { atLeast: 2 },
				},
			});
			checkpoints.push(await zeroServiceWorkerCheckpoint(lifecycle, 'after-interactions'));

			// (f) The plan is carried across routes in the URL fragment.
			await page.click(FACTORIOLAB_NAV_FLOW);
			await context.expect.page.text(
				page,
				FACTORIOLAB_FLOW_MESSAGE,
				FACTORIOLAB_FLOW_EMPTY_SELECTION,
			);
			await measure('/flow#p=iron-plate*10&s=*************3600');
			await page.click(FACTORIOLAB_NAV_LIST);
			await context.expect.page.text(
				page,
				FACTORIOLAB_TOTAL_POWER,
				FACTORIOLAB_PER_HOUR_TOTAL_POWER,
			);

			// (g) A real document reload. The plan comes back out of the URL
			// fragment and the named state out of browser-local storage; the
			// dropped column comes back out of the stored preferences.
			await page.reload();
			await context.expect.page.text(
				page,
				FACTORIOLAB_ITEMS_HEADER,
				FACTORIOLAB_ITEMS_PER_HOUR,
			);
			await context.expect.page.text(
				page,
				FACTORIOLAB_TOTAL_POWER,
				FACTORIOLAB_PER_HOUR_TOTAL_POWER,
			);
			await context.expect.page.count(
				page,
				FACTORIOLAB_HEADER_CELLS,
				FACTORIOLAB_COLUMNS_WITHOUT_POLLUTION,
			);
			await page.click(FACTORIOLAB_NAV_SETTINGS);
			await context.expect.page.count(page, FACTORIOLAB_SAVED_STATE_OPTION, 1);
			await page.click(FACTORIOLAB_NAV_SETTINGS);
			await context.expect.page.count(page, FACTORIOLAB_SETTINGS, 0);
			await measure('/list#p=iron-plate*10&s=*************3600 (after online reload)');
			checkpoints.push(await zeroServiceWorkerCheckpoint(lifecycle, 'after-online-reload'));
			await clean(
				context,
				page,
				FACTORIOLAB_JOURNEY_NAVIGATIONS,
				lifecycle.expectedConsoleErrors,
				// Still an exact assertion. The pinned inventory total is zero,
				// and the second term is the number of cancelled duplicate
				// fetches this run's category actually admitted, measured from
				// the page's own ledger — so the count asserted here is the
				// count the browser produced, not a widened bound.
				lifecycle.expectedFailedRequests + lifecycle.admittedCancelledDuplicateFetches(),
			);
			return {
				assertions: [
					'era-pinned default production plan solved from the bundled Factorio 1.0 dataset',
					'item picker category tab and item tooltips reached by genuine hover',
					'product switched through the picker and the whole table re-solved',
					'typed output-rate edit the production table recomputes to exact settled figures',
					'columns dialog removes a column from the rendered table',
					'settings panel changes the display rate and the plan is re-solved',
					'named state saved into browser-local storage from a typed name',
					'flow route reached with the plan carried in the URL fragment',
					'URL-encoded plan, stored column preference and saved state all survive an online reload',
					'no service worker registered, controlling, cached or requested in either lane',
					'clean page',
				],
				offlineEvidence: { state: 'not-applicable' },
				zeroServiceWorker: { checkpoints },
				scrollAbsence: {
					state: 'measured-no-overflowing-document',
					viewport: { ...FACTORIOLAB_VIEWPORT },
					routes: measuredRoutes,
					documentOverflow:
						'the application sets `overflow: hidden` on the document body and scrolls its own inner panels, so no visited route produces a scrollable document',
					claimed: false,
				},
			};
		},
	},
	{
		app: 'angular-jira-clone',
		framework: 'angular',
		canonicalReceipt: 'evidence/runs/angular-jira-clone/mj3c-build-parity.json',
		canonicalDigest: 'a52921a5e4507688220c6296afdbcb97665484701b3c0097e7f930766de72eb3',
		sources: {
			baseline: '.versionless/cache/angular-jira-clone-baseline/rebuild/dist-1',
			migrated: '.versionless/stage/angular-jira-clone-mj2/dist-a',
		},
		viewport: JIRA_CLONE_VIEWPORT,
		consoleErrorInventory: WITNESS_ANGULAR_JIRA_CLONE_CONSOLE_ERRORS,
		failedRequestInventory: WITNESS_ANGULAR_JIRA_CLONE_FAILED_REQUESTS,
		cancelledDuplicateFetches: WITNESS_ANGULAR_JIRA_CLONE_CANCELLED_DUPLICATE_FETCHES,
		mockedNonLoopbackSeams: WITNESS_ANGULAR_JIRA_CLONE_MOCKED_SEAMS,
		renderedStyleProbes: JIRA_CLONE_STYLE_PROBES,
		transport: async (request) => await angularJiraCloneTransport(request),
		journey: async (context, page, _transportEvidence, lifecycle) => {
			if (lifecycle.expectedServiceWorker !== null)
				throw new Error('jira-clone journey received a service-worker expectation');
			const checkpoints = [
				await zeroServiceWorkerCheckpoint(lifecycle, 'before-interactions'),
			];
			const measuredRoutes: WitnessMeasuredScrollAbsence['routes'] = [];
			/**
			 * The generic scroll measurement, taken at every stage of the journey.
			 * The board pins the document to the viewport and gives its own columns
			 * the overflow, so this is what licenses the receipt to claim no scroll
			 * coverage: a stage that started overflowing would fail here rather than
			 * pass silently unexercised.
			 */
			const measure = async (stage: string): Promise<void> => {
				const extents = await lifecycle.viewportScroll();
				if (
					extents.clientHeight !== JIRA_CLONE_VIEWPORT.height ||
					extents.scrollHeight > extents.clientHeight ||
					extents.scrollY !== 0
				)
					throw new Error(
						`jira-clone stage overflows the viewport the receipt says it does not: ${stage} ${canonicalize(extents)}`,
					);
				measuredRoutes.push({
					route: jiraCloneStage(stage),
					scrollHeight: extents.scrollHeight,
					clientHeight: extents.clientHeight,
				});
			};
			const board = async (): Promise<WitnessAngularJiraCloneColumn[]> =>
				jiraCloneColumns(await lifecycle.groupedText(JIRA_CLONE_BOARD_PROBE));
			const issuesIn = (
				columns: readonly WitnessAngularJiraCloneColumn[],
				name: string,
			): string[] => columns.find((column) => column.column === name)?.issues ?? [];
			const storageIsEmpty = async (stage: string): Promise<string[]> => {
				const keys = await lifecycle.browserStorageKeys();
				if (keys.localStorage.length !== 0 || keys.sessionStorage.length !== 0)
					throw new Error(
						`jira-clone wrote browser storage the receipt says it does not: ${stage} ${canonicalize(keys)}`,
					);
				return keys.localStorage;
			};
			// `mouseover` is deliberately not tracked here, and the reason is
			// measured rather than assumed: this is the one journey in the corpus
			// with a real pointer drag, and the drag's interpolated moves cross
			// whatever elements lie on the path, so the count differs run to run
			// (29 against 30 across the two lanes when it was tracked). Pinning it
			// would pin pointer geometry. The hover itself loses nothing — it is
			// recorded as an interaction of its own kind, and the tooltip it
			// reveals is asserted by its rendered text.
			await page.trackEvents('click', 'input', 'change', 'keydown');

			// (a) The seeded board, as the application solves it from the project
			// document it bundles. Appearance is measured here, on the seeded
			// board, so both lanes and both passes measure the same layout.
			await context.expect.page.count(
				page,
				JIRA_CLONE_COLUMN,
				JIRA_CLONE_COLUMN_CARDS.length,
			);
			await context.expect.page.text(
				page,
				`${JIRA_CLONE_FIRST_BACKLOG_CARD} p`,
				JIRA_CLONE_DRAG_ISSUE,
			);
			const renderedStyles = await lifecycle.renderedStyles();
			await measure('seeded board');

			// (b) A genuine hover on a card's assignee avatar, for the tooltip the
			// application renders into its own overlay.
			await page.hover(JIRA_CLONE_AVATAR);
			await context.expect.page.text(
				page,
				JIRA_CLONE_TOOLTIP,
				WITNESS_ANGULAR_JIRA_CLONE_TOOLTIP,
			);

			// (c) A real pointer drag across the board. What is asserted is not the
			// gesture but the state it settled: the card leaves one column, lands
			// first in the other, and both columns' counts move with it.
			const beforeDrag = await board();
			const dragIndex = issuesIn(beforeDrag, JIRA_CLONE_BACKLOG_COLUMN).indexOf(
				JIRA_CLONE_DRAG_ISSUE,
			);
			if (dragIndex < 0)
				throw new Error(`jira-clone seeded board is missing ${JIRA_CLONE_DRAG_ISSUE}`);
			const backlogRows = issuesIn(beforeDrag, JIRA_CLONE_BACKLOG_COLUMN).length;
			const selectedRows = issuesIn(beforeDrag, JIRA_CLONE_SELECTED_COLUMN).length;
			// The drop point is the card currently at the top of the target
			// column rather than the column box, and the reason is measured
			// rather than stylistic: the column is taller than the viewport, so
			// bringing the column box into view before the press scrolls the
			// board and moves the source card out from under the pointer. A
			// person dropping a card at the top of a column aims at the card
			// that is already there, which is what this does.
			await page.drag(JIRA_CLONE_FIRST_BACKLOG_CARD, JIRA_CLONE_FIRST_SELECTED_CARD, {
				steps: JIRA_CLONE_DRAG_STEPS,
			});
			await context.expect.page.count(page, JIRA_CLONE_BACKLOG_CARDS, backlogRows - 1);
			await context.expect.page.count(page, JIRA_CLONE_SELECTED_CARDS, selectedRows + 1);
			await context.expect.page.text(
				page,
				JIRA_CLONE_FIRST_SELECTED_TITLE,
				JIRA_CLONE_DRAG_ISSUE,
			);
			const afterDrag = await board();
			const droppedIndex = issuesIn(afterDrag, JIRA_CLONE_SELECTED_COLUMN).indexOf(
				JIRA_CLONE_DRAG_ISSUE,
			);
			if (droppedIndex < 0)
				throw new Error('jira-clone drag did not settle the issue into its target column');
			await measure('after the board drag');

			// (d) The issue modal on the card the drag moved. Its status line is
			// the settled store rather than the drop animation, and its description
			// renders as read-only rich text.
			await page.click(JIRA_CLONE_FIRST_SELECTED_CARD);
			await context.expect.page.text(page, JIRA_CLONE_MODAL_TYPE, JIRA_CLONE_ISSUE_TYPE_LINE);
			await context.expect.page.text(page, JIRA_CLONE_MODAL_STATUS, JIRA_CLONE_MUTATION_SEAM);
			await context.expect.page.exists(page, JIRA_CLONE_MODAL_DESCRIPTION);
			await context.expect.page.bodyText(page, { contains: JIRA_CLONE_DESCRIPTION_TEXT });
			const openedTitle = (await lifecycle.groupedText(JIRA_CLONE_MODAL_PROBE))[0]?.items[0];
			if (openedTitle === undefined || openedTitle.length === 0)
				throw new Error('jira-clone issue modal rendered no title to edit');
			const typedTitle = `${openedTitle}${JIRA_CLONE_TITLE_SUFFIX}`;

			// The caret is put at the end of the field with a real key, the suffix
			// is typed, and the field is blurred with another real key, so the
			// application sees the keydown / input / change sequence a person makes.
			await page.press(JIRA_CLONE_MODAL_TITLE, 'End');
			await page.type(JIRA_CLONE_MODAL_TITLE, JIRA_CLONE_TITLE_SUFFIX, { redact: false });
			await page.press(JIRA_CLONE_MODAL_TITLE, 'Tab');
			await context.expect.page.text(page, JIRA_CLONE_FIRST_SELECTED_TITLE, typedTitle);
			await page.click(JIRA_CLONE_MODAL_CLOSE);
			await context.expect.page.count(page, JIRA_CLONE_MODAL_PROBE.group, 0);
			await context.expect.page.text(page, JIRA_CLONE_FIRST_SELECTED_TITLE, typedTitle);

			// Reopening is what makes this evidence about the application's store
			// rather than about a text box retaining what was typed into it.
			await page.click(JIRA_CLONE_FIRST_SELECTED_CARD);
			await context.expect.page.text(page, JIRA_CLONE_MODAL_TYPE, JIRA_CLONE_ISSUE_TYPE_LINE);
			const reopenedTitle = (await lifecycle.groupedText(JIRA_CLONE_MODAL_PROBE))[0]
				?.items[0];
			if (reopenedTitle === undefined)
				throw new Error('jira-clone reopened issue modal rendered no title');
			await page.click(JIRA_CLONE_MODAL_CLOSE);
			await context.expect.page.count(page, JIRA_CLONE_MODAL_PROBE.group, 0);
			await measure('after the modal title edit');

			// (e) An issue created through the navbar control, typed into the
			// modal-scoped title field and submitted by the form's own button.
			const beforeCreate = await board();
			const createdColumn = issuesIn(beforeCreate, JIRA_CLONE_BACKLOG_COLUMN).length;
			await page.click(JIRA_CLONE_CREATE_CONTROL);
			await context.expect.page.exists(page, JIRA_CLONE_CREATE_MODAL);
			await page.type(JIRA_CLONE_CREATE_TITLE, JIRA_CLONE_CREATED_ISSUE, { redact: false });
			await page.click(JIRA_CLONE_CREATE_SUBMIT);
			await context.expect.page.count(page, JIRA_CLONE_CREATE_MODAL, 0);
			await context.expect.page.count(page, JIRA_CLONE_BACKLOG_CARDS, createdColumn + 1);
			await context.expect.page.text(
				page,
				`${JIRA_CLONE_BACKLOG_CARDS}:nth-of-type(${createdColumn + 1}) p`,
				JIRA_CLONE_CREATED_ISSUE,
			);
			const afterCreate = await board();
			await measure('after the created issue');

			// (f) The board filter, narrowed by a typed term and widened again by a
			// full clear. One Backspace widens nothing — the remaining prefix still
			// matches — so the gesture is select-all and then Backspace.
			const beforeFilter = jiraCloneCounts(afterCreate);
			await page.type(JIRA_CLONE_FILTER_INPUT, WITNESS_ANGULAR_JIRA_CLONE_FILTER_TERM, {
				redact: false,
			});
			for (const [index, selector] of JIRA_CLONE_COLUMN_CARDS.entries())
				await context.expect.page.count(
					page,
					selector,
					WITNESS_ANGULAR_JIRA_CLONE_FILTER_NARROWED[index]!,
				);
			const narrowed = jiraCloneCounts(await board());
			await page.press(JIRA_CLONE_FILTER_INPUT, 'a', { modifiers: ['Meta'] });
			await page.press(JIRA_CLONE_FILTER_INPUT, 'Backspace');
			for (const [index, selector] of JIRA_CLONE_COLUMN_CARDS.entries())
				await context.expect.page.count(page, selector, beforeFilter[index]!);
			const afterClear = jiraCloneCounts(await board());
			await measure('after the filter was cleared');
			await context.expect.page.outcome(page, {
				events: {
					click: { atLeast: 6 },
					input: { atLeast: 3 },
					change: { atLeast: 1 },
					keydown: { atLeast: 4 },
				},
			});
			checkpoints.push(await zeroServiceWorkerCheckpoint(lifecycle, 'after-interactions'));
			await storageIsEmpty('after interactions');

			// (g) A real document reload. Nothing the journey did survives it: the
			// board lives in an in-memory store, the application writes no browser
			// storage and talks to no backend, so what comes back is the seed.
			await page.reload();
			await context.expect.page.count(page, JIRA_CLONE_BACKLOG_CARDS, backlogRows);
			await context.expect.page.text(
				page,
				`${JIRA_CLONE_FIRST_BACKLOG_CARD} p`,
				JIRA_CLONE_DRAG_ISSUE,
			);
			await context.expect.page.bodyText(page, {
				notContains: JIRA_CLONE_CREATED_ISSUE,
			});
			const afterReload = await board();
			const localStorageKeys = await storageIsEmpty('after the online reload');
			await measure('after the online reload');
			checkpoints.push(await zeroServiceWorkerCheckpoint(lifecycle, 'after-online-reload'));
			await clean(
				context,
				page,
				JIRA_CLONE_JOURNEY_NAVIGATIONS,
				lifecycle.expectedConsoleErrors,
				// Still exact. The pinned inventory total is zero, and the second
				// term is the number of cancelled duplicate fetches this run's
				// category actually admitted, measured from the page's own ledger.
				lifecycle.expectedFailedRequests + lifecycle.admittedCancelledDuplicateFetches(),
			);
			const applicationJourney: WitnessAngularJiraCloneBoardEvidence = {
				drag: {
					state: 'measured-genuine-pointer-drag',
					surface: 'angular-jira-clone',
					pointer: 'genuine-pointer-down-move-up',
					issue: JIRA_CLONE_DRAG_ISSUE,
					from: { column: JIRA_CLONE_BACKLOG_COLUMN, index: dragIndex },
					to: { column: JIRA_CLONE_SELECTED_COLUMN, index: droppedIndex },
					before: beforeDrag,
					after: afterDrag,
				},
				modalTitleEdit: {
					state: 'measured-modal-round-trip',
					route: JIRA_CLONE_ROUTE,
					before: openedTitle,
					typed: typedTitle,
					afterReopen: reopenedTitle,
					descriptionRendering: 'not-claimed',
					descriptionNonclaimReason: JIRA_CLONE_DESCRIPTION_NONCLAIM,
				},
				createIssue: {
					state: 'measured-created-row',
					control: 'navbar-item-3',
					column: JIRA_CLONE_BACKLOG_COLUMN,
					rowsBefore: createdColumn,
					rowsAfter: issuesIn(afterCreate, JIRA_CLONE_BACKLOG_COLUMN).length,
				},
				filter: {
					state: 'measured-narrow-and-widen',
					term: WITNESS_ANGULAR_JIRA_CLONE_FILTER_TERM,
					beforeFilter,
					narrowed,
					wideningGesture: 'select-all-then-backspace',
					afterClear,
				},
				tooltip: {
					state: 'measured-hover-tooltip',
					text: WITNESS_ANGULAR_JIRA_CLONE_TOOLTIP,
				},
				reloadRestore: {
					state: 'measured-seed-board-restored',
					localStorageKeys: localStorageKeys as [],
					sessionStorageKeys: [],
					backend: 'none',
					survivesOnlineReload: false,
					afterReload,
				},
			};
			return {
				assertions: [
					'seeded board solved in the browser from the bundled project document',
					'assignee tooltip reached by a genuine hover on an issue card avatar',
					'genuine pointer drag that moves an issue between board columns and settles the store',
					'issue modal whose status line reports the column the drag moved the issue into',
					'seeded issue description rendered as read-only rich text',
					'modal title edit that survives closing and reopening the modal and changes the board card',
					'issue created through the navbar control and appended to its column',
					'board filtered to a single matching row and widened back by a full clear',
					'no route ever left the board, and no modal surface pushed one',
					'in-memory board restored to its seed by an online reload, with no browser storage written',
					'no service worker registered, controlling, cached or requested in either lane',
					'clean page',
				],
				offlineEvidence: { state: 'not-applicable' },
				zeroServiceWorker: { checkpoints },
				renderedStyles,
				applicationJourney,
				scrollAbsence: {
					state: 'measured-no-overflowing-document',
					viewport: { ...JIRA_CLONE_VIEWPORT },
					routes: measuredRoutes,
					documentOverflow:
						'the application pins the document to the viewport and gives the board columns their own overflow, so no stage of the journey produces a scrollable document',
					claimed: false,
				},
			};
		},
	},
	{
		app: NEXT_KILLEDBYGOOGLE_V3_APP,
		framework: 'next',
		canonicalReceipt: 'evidence/runs/next-killedbygoogle-v3-0-0/t006-build-lanes.json',
		canonicalDigest: '7e311d8c8c5e5ac3e68008d113c5be403b40de07ee113556f078b6bfcd658a02',
		sources: {
			baseline: '.versionless/cache/next-killedbygoogle-v3-0-0-baseline/app/out-run1',
			migrated: '.versionless/work/next-killedbygoogle-v3-0-0/target/dist-vite-run1',
		},
		viewport: WITNESS_NEXT_KILLEDBYGOOGLE_V3_VIEWPORT,
		consoleErrorInventory: WITNESS_NEXT_KILLEDBYGOOGLE_V3_CONSOLE_ERRORS,
		failedRequestInventory: WITNESS_NEXT_KILLEDBYGOOGLE_V3_FAILED_REQUESTS,
		mockedNonLoopbackSeams: WITNESS_NEXT_KILLEDBYGOOGLE_V3_MOCKED_SEAMS,
		renderedStyleProbes: KBG_STYLE_PROBES,
		journey: async (context, page, _transportEvidence, lifecycle) => {
			if (lifecycle.expectedServiceWorker !== null)
				throw new Error('killedbygoogle journey received a service-worker expectation');
			const checkpoints = [
				await zeroServiceWorkerCheckpoint(lifecycle, 'before-interactions'),
			];
			/**
			 * Every count this application settles to, asserted twice against the
			 * live page: once for the graveyard records, and once for the list
			 * items those records sit among. The second number is the first plus
			 * the advertising slot, which is a list item and not a record — the
			 * application's own arithmetic, asserted rather than assumed.
			 */
			const settled = async (records: number): Promise<WitnessNextKilledbygoogleV3Counts> => {
				const listItems = records + WITNESS_NEXT_KILLEDBYGOOGLE_V3_AD_LIST_ITEMS;
				await context.expect.page.count(page, KBG_RECORD, records);
				await context.expect.page.count(page, KBG_LIST_ITEM, listItems);
				return { records, listItems };
			};
			const clearSearch = async (): Promise<void> => {
				await page.press(KBG_SEARCH_BOX, 'a', {
					modifiers: process.platform === 'darwin' ? ['Meta'] : ['Control'],
				});
				await page.press(KBG_SEARCH_BOX, 'Backspace');
			};
			const chooseFilter = async (label: string): Promise<void> => {
				await page.click(KBG_FILTER_INPUT);
				await page.type(KBG_FILTER_INPUT, label.slice(0, label.indexOf(' ')), {
					redact: false,
				});
				await page.press(KBG_FILTER_INPUT, 'Enter');
				await context.expect.page.bodyText(page, { contains: label });
			};
			/**
			 * The search box's current value, read off the live control. The group
			 * is named by the control's placeholder rather than by its value,
			 * because the value this reads is expected to be empty and a probe
			 * cannot name a group with nothing.
			 */
			const searchBoxValue = async (): Promise<string> => {
				const read = await lifecycle.groupedText({
					group: 'label[for="searchBox"]',
					name: KBG_SEARCH_BOX,
					nameAttribute: 'placeholder',
					item: KBG_SEARCH_BOX,
				});
				const value = read[0]?.items[0];
				if (read.length !== 1 || value === undefined)
					throw new Error('killedbygoogle search box was not readable');
				return value;
			};
			await page.trackEvents('click', 'input', 'change', 'keydown', 'mouseover');

			// (a) The settled list. This is the whole point of the vertical: the
			// era lane's document arrives with all of these rows already in it and
			// the migrated lane's arrives with a mount element, and what is
			// compared is what the two of them settle to.
			await context.expect.page.text(page, KBG_HEADER_TITLE, KBG_TITLE);
			const beforeSearch = await settled(WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECORDS);
			const rendered = await lifecycle.groupedText(KBG_LIST_PROBE);
			const firstRendered = rendered[0];
			const lastRendered = rendered.at(-1);
			if (
				rendered.length !== WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECORDS ||
				firstRendered === undefined ||
				lastRendered === undefined ||
				rendered.some((row) => row.name.length === 0 || (row.items[0] ?? '').length === 0)
			)
				throw new Error(
					`killedbygoogle rendered list is not the settled record set: ${rendered.length}`,
				);
			const renderedStyles = await lifecycle.renderedStyles();

			// (b) The advertising slot, measured rather than argued about. It is a
			// list item of the same list and carries no record title, which is why
			// every count above and below is published twice.
			await context.expect.page.count(page, `${KBG_AD_SLOT} h2`, 0);
			await context.expect.page.text(page, KBG_AD_SLOT_LABEL, KBG_MUTATION_SEAM);
			await page.hover(KBG_FIRST_RECORD_TITLE);

			// (c) Search narrowing on a typed term, and a full clear that widens it
			// back. One Backspace would widen nothing, so the clear is select-all
			// and then Backspace.
			await page.type(KBG_SEARCH_BOX, WITNESS_NEXT_KILLEDBYGOOGLE_V3_SEARCH_TERM, {
				redact: false,
			});
			await context.expect.page.bodyText(page, {
				contains: WITNESS_NEXT_KILLEDBYGOOGLE_V3_SEARCH_TERM,
			});
			const narrowed = await settled(WITNESS_NEXT_KILLEDBYGOOGLE_V3_SEARCH_RECORDS);
			await clearSearch();
			const afterClear = await settled(WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECORDS);

			// (d) The type filter, reached both ways a person reaches it: typed and
			// committed with Enter, then by opening the menu and clicking an option.
			await chooseFilter(WITNESS_NEXT_KILLEDBYGOOGLE_V3_KEYBOARD_FILTER);
			const keyboardFiltered = await settled(
				WITNESS_NEXT_KILLEDBYGOOGLE_V3_KEYBOARD_FILTER_RECORDS,
			);
			await page.click(KBG_FILTER_INPUT);
			await context.expect.page.text(
				page,
				KBG_CLICK_FILTER_OPTION,
				WITNESS_NEXT_KILLEDBYGOOGLE_V3_CLICK_FILTER,
			);
			await page.click(KBG_CLICK_FILTER_OPTION);
			await context.expect.page.bodyText(page, {
				contains: WITNESS_NEXT_KILLEDBYGOOGLE_V3_CLICK_FILTER,
			});
			const clickFiltered = await settled(
				WITNESS_NEXT_KILLEDBYGOOGLE_V3_CLICK_FILTER_RECORDS,
			);

			// (e) The two narrowings composed, then undone completely.
			await page.type(KBG_SEARCH_BOX, WITNESS_NEXT_KILLEDBYGOOGLE_V3_COMPOUND_TERM, {
				redact: false,
			});
			const compound = await settled(WITNESS_NEXT_KILLEDBYGOOGLE_V3_COMPOUND_RECORDS);
			await clearSearch();
			await chooseFilter(WITNESS_NEXT_KILLEDBYGOOGLE_V3_ALL_FILTER);
			const afterFullClear = await settled(WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECORDS);

			// (f) The document genuinely overflows the stated viewport with the
			// whole list restored, so the scroll is a real wheel gesture on a
			// measured surface rather than a claim.
			const beforeScroll = await lifecycle.viewportScroll();
			if (
				beforeScroll.clientHeight !== WITNESS_NEXT_KILLEDBYGOOGLE_V3_VIEWPORT.height ||
				beforeScroll.scrollHeight <= beforeScroll.clientHeight ||
				beforeScroll.scrollY !== 0
			)
				throw new Error(
					`killedbygoogle graveyard is not a scrollable surface: ${canonicalize(beforeScroll)}`,
				);
			await page.scroll(null, { y: KBG_WHEEL_DELTA_Y });
			const afterScroll = await lifecycle.viewportScroll();
			if (
				afterScroll.scrollY <= beforeScroll.scrollY ||
				afterScroll.scrollHeight !== beforeScroll.scrollHeight
			)
				throw new Error(
					`killedbygoogle graveyard did not scroll: ${canonicalize(afterScroll)}`,
				);
			const scrollSurface: WitnessScrollSurface = {
				state: 'measured-genuine-viewport-scroll',
				route: '/',
				viewport: { ...WITNESS_NEXT_KILLEDBYGOOGLE_V3_VIEWPORT },
				scrollHeight: beforeScroll.scrollHeight,
				clientHeight: beforeScroll.clientHeight,
				wheelDeltaY: KBG_WHEEL_DELTA_Y,
				scrolledFromTop: true,
				scrolled: true,
			};
			await context.expect.page.outcome(page, {
				events: {
					click: { atLeast: 4 },
					input: { atLeast: 4 },
					keydown: { atLeast: 4 },
					mouseover: { atLeast: 1 },
				},
			});
			checkpoints.push(await zeroServiceWorkerCheckpoint(lifecycle, 'after-interactions'));

			// (g) A real document reload. Nothing the journey did survives it: the
			// application keeps its search term and its filter in React state,
			// writes no browser storage and talks to no backend.
			await page.reload();
			await context.expect.page.text(page, KBG_HEADER_TITLE, KBG_TITLE);
			const afterReload = await settled(WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECORDS);
			await context.expect.page.bodyText(page, {
				contains: WITNESS_NEXT_KILLEDBYGOOGLE_V3_ALL_FILTER,
			});
			const restoredSearch = await searchBoxValue();
			if (restoredSearch !== '')
				throw new Error('killedbygoogle search box survived an online reload');
			const storage = await lifecycle.browserStorageKeys();
			if (storage.localStorage.length !== 0 || storage.sessionStorage.length !== 0)
				throw new Error(
					`killedbygoogle wrote browser storage the receipt says it does not: ${canonicalize(storage)}`,
				);
			checkpoints.push(await zeroServiceWorkerCheckpoint(lifecycle, 'after-online-reload'));
			await clean(
				context,
				page,
				KBG_JOURNEY_NAVIGATIONS[lifecycle.lane],
				lifecycle.expectedConsoleErrors,
				lifecycle.expectedFailedRequests,
			);
			const applicationJourney: WitnessNextKilledbygoogleV3GraveyardEvidence = {
				renderedList: {
					state: 'measured-settled-list-dom',
					records: WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECORDS,
					listItems: WITNESS_NEXT_KILLEDBYGOOGLE_V3_LIST_ITEMS,
					adListItems: WITNESS_NEXT_KILLEDBYGOOGLE_V3_AD_LIST_ITEMS,
					contentScheme: 'sha256(canonicalize([{name,items}] in document order))',
					contentSha256: sha256(canonicalize(rendered)),
					firstRecord: {
						name: firstRendered.name,
						description: firstRendered.items[0] ?? '',
					},
					lastRecord: {
						name: lastRendered.name,
						description: lastRendered.items[0] ?? '',
					},
				},
				search: {
					state: 'measured-narrow-and-widen',
					term: WITNESS_NEXT_KILLEDBYGOOGLE_V3_SEARCH_TERM,
					gesture: 'typed-into-the-search-box',
					beforeSearch,
					narrowed,
					wideningGesture: 'select-all-then-backspace',
					afterClear,
				},
				typeFilter: {
					state: 'measured-select-narrowing',
					control: 'react-select-filter-select',
					keyboard: {
						gesture: 'typed-then-enter',
						option: WITNESS_NEXT_KILLEDBYGOOGLE_V3_KEYBOARD_FILTER,
						counts: keyboardFiltered,
					},
					click: {
						gesture: 'menu-opened-and-option-clicked',
						optionId: KBG_CLICK_FILTER_OPTION,
						option: WITNESS_NEXT_KILLEDBYGOOGLE_V3_CLICK_FILTER,
						counts: clickFiltered,
					},
				},
				compound: {
					state: 'measured-compound-narrowing',
					filter: WITNESS_NEXT_KILLEDBYGOOGLE_V3_CLICK_FILTER,
					term: WITNESS_NEXT_KILLEDBYGOOGLE_V3_COMPOUND_TERM,
					counts: compound,
					afterFullClear,
					fullClearGesture: 'search-cleared-then-filter-returned-to-all',
				},
				adSlot: {
					state: 'measured-non-data-list-item',
					selector: KBG_AD_SLOT,
					recordTitles: 0,
					countedInListItems: true,
					countedInRecords: false,
				},
				reloadRestore: {
					state: 'measured-initial-state-restored',
					counts: afterReload,
					searchValue: '',
					filterLabel: WITNESS_NEXT_KILLEDBYGOOGLE_V3_ALL_FILTER,
					localStorageKeys: storage.localStorage as [],
					sessionStorageKeys: storage.sessionStorage as [],
					backend: 'none',
					survivesOnlineReload: false,
				},
			};
			return {
				assertions: [
					'the settled graveyard list, identical in a pre-rendered document and a client-mounted one',
					'the advertising slot, labelled for screen readers, counted as a list item and never as a record',
					'search narrowed by a typed term and widened back by a full clear',
					'type filter selected from the keyboard and again by clicking its menu option',
					'search and type filter composed, then undone completely',
					'genuine wheel scroll on a measured overflowing document',
					'record title reached by a genuine hover',
					'online reload restores the initial list, an empty search box and the unfiltered selection',
					'no service worker registered, controlling, cached or requested in either lane',
					'clean page',
				],
				offlineEvidence: { state: 'not-applicable' },
				zeroServiceWorker: { checkpoints },
				renderedStyles,
				applicationJourney,
				scrollSurface,
			};
		},
	},
	{
		app: 'react-linkfree',
		framework: 'react',
		canonicalReceipt: REACT_LINKFREE_RECEIPT_PATH,
		canonicalDigest: REACT_LINKFREE_CANONICAL_DIGEST,
		// Both lanes are staged by this vertical's own runner, which replaces the
		// served profile corpus with the synthetic one before a browser is
		// launched. These paths are the committed build outputs the staging
		// copies from, and nothing is ever served directly out of them.
		sources: {
			baseline: '.versionless/work/react-linkfree-v0-72-0/baseline/build-run1',
			migrated: '.versionless/work/react-linkfree-v0-72-0/target/build-vite-run1',
		},
		viewport: LINKFREE_VIEWPORT,
		consoleErrorInventory: WITNESS_REACT_LINKFREE_CONSOLE_ERRORS,
		failedRequestInventory: WITNESS_REACT_LINKFREE_FAILED_REQUESTS,
		mockedNonLoopbackSeams: WITNESS_REACT_LINKFREE_MOCKED_SEAMS,
		renderedStyleProbes: WITNESS_REACT_LINKFREE_STYLE_PROBES,
		normalizeRoute: normalizeLinkfreeRoute,
		transport: async (request) => await reactLinkfreeTransport(request),
		journey: async (context, page, _transportEvidence, lifecycle) => {
			if (lifecycle.expectedServiceWorker !== null)
				throw new Error('LinkFree journey received a service-worker expectation');
			const profiles = LINKFREE_SYNTHETIC_PROFILES.length;
			const sortedNames = LINKFREE_SYNTHETIC_NAMES_SORTED;
			const routeExtents: Array<{
				route: string;
				scrollHeight: number;
				clientHeight: number;
			}> = [];
			/**
			 * The generic document measurement, taken at every route the journey
			 * occupies. It is what licenses the scroll claim to name one route
			 * rather than the journey: the routes that do not overflow are
			 * recorded with their extents instead of being left unmeasured.
			 */
			const measure = async (route: string): Promise<WitnessViewportScroll> => {
				const extents = await lifecycle.viewportScroll();
				if (extents.clientHeight !== LINKFREE_VIEWPORT.height)
					throw new Error(
						`LinkFree route measured against an unexpected viewport: ${route} ${canonicalize(extents)}`,
					);
				routeExtents.push({
					route,
					scrollHeight: extents.scrollHeight,
					clientHeight: extents.clientHeight,
				});
				return extents;
			};
			await page.trackEvents('click', 'input', 'keydown', 'mouseover');

			// (a) The homepage the application serves at its root: a static hero,
			// not the directory. Saying which is which is the point of visiting it.
			await context.expect.page.text(page, 'main h1', LINKFREE_HOME_HEADLINE);
			await measure('/');

			// (b) The searchable directory, solved in the browser from the index
			// the application's own codegen wrote over the synthetic corpus.
			await page.hover(LINKFREE_SEARCH_LINK);
			await page.click(LINKFREE_SEARCH_LINK);
			await context.expect.page.count(page, LINKFREE_DIRECTORY_ENTRY, profiles);
			await context.expect.page.text(
				page,
				`${LINKFREE_DIRECTORY_ENTRY}:nth-of-type(1)`,
				sortedNames[0]!,
			);
			await context.expect.page.text(
				page,
				`${LINKFREE_DIRECTORY_ENTRY}:nth-of-type(${String(profiles)})`,
				sortedNames[profiles - 1]!,
			);
			const renderedStyles = await lifecycle.renderedStyles();
			await measure('/search');

			// (c) A typed search that narrows the directory, and a full clear that
			// restores it. One Backspace widens nothing — the remaining prefix
			// still matches — so the widening gesture is select-all and Backspace.
			await page.type(LINKFREE_SEARCH_INPUT, LINKFREE_SEARCH_TERM, { redact: false });
			await context.expect.page.count(page, LINKFREE_DIRECTORY_ENTRY, 1);
			await context.expect.page.text(
				page,
				`${LINKFREE_DIRECTORY_ENTRY}:nth-of-type(1)`,
				LINKFREE_JOURNEY_PROFILE.name,
			);
			await page.press(LINKFREE_SEARCH_INPUT, 'a', { modifiers: ['Meta'] });
			await page.press(LINKFREE_SEARCH_INPUT, 'Backspace');
			await context.expect.page.count(page, LINKFREE_DIRECTORY_ENTRY, profiles);
			await measure('/search (after the search was cleared)');

			// (d) A real router navigation into the dynamic profile route, by the
			// directory entry a person would click.
			await page.click(`${LINKFREE_DIRECTORY_ENTRY}:nth-of-type(${String(profiles)})`);
			await context.expect.page.text(
				page,
				LINKFREE_PROFILE_NAME,
				LINKFREE_JOURNEY_PROFILE.name,
			);
			await context.expect.page.text(
				page,
				LINKFREE_PROFILE_USERNAME,
				`(${LINKFREE_JOURNEY_PROFILE.username})`,
			);
			await context.expect.page.text(
				page,
				LINKFREE_PROFILE_BIO,
				LINKFREE_JOURNEY_PROFILE.bio,
			);
			await context.expect.page.bodyText(page, { contains: 'Community' });
			await context.expect.page.count(
				page,
				LINKFREE_PROFILE_LINK,
				LINKFREE_JOURNEY_PROFILE.links.length,
			);
			await context.expect.page.text(
				page,
				`${LINKFREE_PROFILE_FIRST_LINK} span`,
				LINKFREE_JOURNEY_PROFILE.links[0]!.name,
			);

			// (e) The avatar cascade. The declared endpoint is refused, so the
			// application's own onerror handler rewrites the image source to a
			// second host — which is exactly the egress redirection the ingest
			// warned about, observed here as the rendered attribute.
			const cascadedAvatar = linkfreeAvatarFallbackUrl(LINKFREE_JOURNEY_PROFILE.name);
			await context.expect.page.attribute(
				page,
				LINKFREE_PROFILE_AVATAR,
				'src',
				cascadedAvatar,
			);

			// (f) A hover with an observable result: the application assigns the
			// link's declared colour inline and its stylesheet turns the label
			// white while the pointer is over it.
			await context.expect.page.computedStyle(page, LINKFREE_SCROLL_TO_TOP, {
				display: 'none',
			});
			await page.hover(LINKFREE_PROFILE_FIRST_LINK);
			await context.expect.page.computedStyle(page, LINKFREE_PROFILE_FIRST_LINK, {
				'background-color': LINKFREE_HOVER_BACKGROUND,
			});
			await context.expect.page.computedStyle(page, `${LINKFREE_PROFILE_FIRST_LINK} span`, {
				color: LINKFREE_HOVER_LABEL_COLOR,
			});

			// (g) The one route whose document genuinely overflows the stated
			// viewport, scrolled by a real wheel gesture. Past 300 pixels the
			// application reveals its own scroll-to-top control, and clicking it
			// is what proves the control is visible: a hidden element is not
			// actionable and the click would fail rather than pass quietly.
			const beforeScroll = await measure(LINKFREE_PROFILE_ROUTE);
			if (
				beforeScroll.scrollHeight <= beforeScroll.clientHeight ||
				beforeScroll.scrollY !== 0
			)
				throw new Error(
					`LinkFree profile route is not a scrollable surface: ${canonicalize(beforeScroll)}`,
				);
			await page.scroll(null, { y: LINKFREE_WHEEL_DELTA_Y });
			const afterScroll = await lifecycle.viewportScroll();
			if (
				afterScroll.scrollY <= 300 ||
				afterScroll.scrollHeight !== beforeScroll.scrollHeight
			)
				throw new Error(
					`LinkFree profile route did not scroll past the control threshold: ${canonicalize(afterScroll)}`,
				);
			await context.expect.page.visible(page, LINKFREE_SCROLL_TO_TOP);
			await page.click(LINKFREE_SCROLL_TO_TOP);
			// The control hides itself again below its own 300-pixel threshold, so
			// waiting for that is a bounded, event-driven wait on the
			// application's own reaction rather than on a timer.
			await context.expect.page.computedStyle(page, LINKFREE_SCROLL_TO_TOP, {
				display: 'none',
			});
			// The last stretch is a smooth-scroll animation, which fires no DOM
			// event when it settles, so the settled offset is polled under a fixed
			// bound and required to reach the top rather than accepted wherever it
			// happened to be.
			let restored = await lifecycle.viewportScroll();
			for (let attempt = 0; attempt < 40 && restored.scrollY !== 0; attempt += 1) {
				await new Promise<void>((settle) => void setTimeout(settle, 25));
				restored = await lifecycle.viewportScroll();
			}
			if (restored.scrollY !== 0)
				throw new Error(
					`LinkFree scroll-to-top control did not return the document to the top: ${canonicalize(restored)}`,
				);
			const scrollSurface: WitnessScrollSurface = {
				state: 'measured-genuine-viewport-scroll',
				route: LINKFREE_PROFILE_ROUTE,
				viewport: { ...LINKFREE_VIEWPORT },
				scrollHeight: beforeScroll.scrollHeight,
				clientHeight: beforeScroll.clientHeight,
				wheelDeltaY: LINKFREE_WHEEL_DELTA_Y,
				scrolledFromTop: true,
				scrolled: true,
			};

			// (h) Back through the router to the directory and the homepage, then
			// the application's own example-profile link — which the synthetic
			// corpus does not contain, so it is the not-found route.
			await page.click(LINKFREE_BACK_TO_SEARCH);
			await context.expect.page.count(page, LINKFREE_DIRECTORY_ENTRY, profiles);
			await page.click(LINKFREE_HOME_LINK);
			await context.expect.page.text(page, 'main h1', LINKFREE_HOME_HEADLINE);
			await page.click(LINKFREE_EXAMPLE_PROFILE_LINK);
			await context.expect.page.bodyText(page, {
				contains: LINKFREE_MUTATION_SEAM,
				notContains: LINKFREE_JOURNEY_PROFILE.name,
			});
			await measure(WITNESS_REACT_LINKFREE_REDACTED_ROUTE);

			await context.expect.page.outcome(page, {
				events: {
					click: { atLeast: 5 },
					input: { atLeast: 4 },
					keydown: { atLeast: 5 },
					mouseover: { atLeast: 2 },
				},
			});
			await clean(
				context,
				page,
				LINKFREE_JOURNEY_NAVIGATIONS,
				lifecycle.expectedConsoleErrors,
				lifecycle.expectedFailedRequests,
			);
			const applicationJourney: WitnessReactLinkfreeJourney = {
				corpus: {
					state: 'synthetic-fixture-corpus',
					directory: WITNESS_REACT_LINKFREE_CORPUS_RULING.dataset,
					profiles,
					aggregateSha256: linkfreeStagedCorpus().corpus.aggregateSha256,
					generatedIndexSha256: linkfreeStagedCorpus().generatedIndex.sha256,
					codegenSha256: linkfreeStagedCorpus().codegen.sha256,
					realProfileDataRendered: false,
				},
				directory: {
					state: 'measured-rendered-index',
					route: '/search',
					profiles,
					firstName: sortedNames[0]!,
					lastName: sortedNames[profiles - 1]!,
				},
				search: {
					state: 'measured-narrow-and-widen',
					term: LINKFREE_SEARCH_TERM,
					beforeFilter: profiles,
					narrowed: 1,
					narrowedName: LINKFREE_JOURNEY_PROFILE.name,
					wideningGesture: 'select-all-then-backspace',
					afterClear: profiles,
				},
				profile: {
					state: 'measured-rendered-profile',
					route: LINKFREE_PROFILE_ROUTE,
					name: LINKFREE_JOURNEY_PROFILE.name,
					username: LINKFREE_JOURNEY_PROFILE.username,
					type: 'community',
					links: LINKFREE_JOURNEY_PROFILE.links.length,
					firstLinkLabel: LINKFREE_JOURNEY_PROFILE.links[0]!.name,
				},
				avatarCascade: {
					state: 'measured-application-onerror-cascade',
					declaredEndpoint: LINKFREE_JOURNEY_PROFILE.avatar,
					declaredAnswer: 404,
					cascadedEndpoint: cascadedAvatar,
					cascadedAnswer: 200,
					renderedSource: cascadedAvatar,
					bothHostsAnsweredInContext: true,
					leftTheMachine: false,
				},
				hover: {
					state: 'measured-hover-restyle',
					selector: LINKFREE_PROFILE_FIRST_LINK,
					backgroundColor: LINKFREE_HOVER_BACKGROUND,
					labelColor: LINKFREE_HOVER_LABEL_COLOR,
				},
				notFound: {
					state: 'measured-missing-profile',
					route: WITNESS_REACT_LINKFREE_REDACTED_ROUTE,
					reachedBy: 'the application own hard-coded homepage example link',
					text: LINKFREE_MUTATION_SEAM,
				},
				scrollToTop: {
					state: 'measured-scroll-to-top-control',
					hiddenBeforeScroll: true,
					wheelDeltaY: LINKFREE_WHEEL_DELTA_Y,
					scrolledTo: afterScroll.scrollY,
					restoredToTop: true,
				},
				routeExtents: {
					state: 'measured-per-route-document-extents',
					viewport: { ...LINKFREE_VIEWPORT },
					routes: routeExtents,
				},
			};
			return {
				assertions: [
					'homepage hero rendered at the root route, which is not the directory',
					'searchable directory solved in the browser from the index the application own codegen wrote over a synthetic corpus',
					'directory narrowed to one entry by a typed search and restored in full by a clear',
					'real react-router navigation into the dynamic profile route',
					'profile name, username, biography, community type and complete declared link list',
					'avatar onerror cascade to the second host, both answered in context and neither contacted',
					'link restyled by a genuine hover, in the colour the application own configuration declares',
					'genuine wheel scroll on a measured overflowing document, past the threshold the application reveals its scroll-to-top control at',
					'scroll-to-top control clicked while visible and the document returned to the top',
					'not-found state behind the application own example-profile link, which the synthetic corpus does not contain',
					'no real profile data rendered in either lane',
					'clean page',
				],
				offlineEvidence: { state: 'not-applicable' },
				renderedStyles,
				applicationJourney,
				scrollSurface,
			};
		},
	},
	{
		app: 'react-memos',
		framework: 'react',
		// This vertical's retained build-lane receipt carries no
		// `integrity.canonicalDigest`, so it is bound by the sha256 of its exact
		// bytes instead of by a field it does not have.
		canonicalReceipt: REACT_MEMOS_BUILD_LANES_PATH,
		canonicalDigest: REACT_MEMOS_BUILD_LANES_SHA256,
		canonicalBinding: 'file-sha256',
		sources: {
			baseline: '.versionless/work/react-memos-v0-1-3/baseline/dist-run1',
			migrated: '.versionless/work/react-memos-v0-1-3/target/dist-vite-run1',
		},
		viewport: MEMOS_VIEWPORT,
		consoleErrorInventory: WITNESS_REACT_MEMOS_CONSOLE_ERRORS,
		failedRequestInventory: WITNESS_REACT_MEMOS_FAILED_REQUESTS,
		renderedStyleProbes: WITNESS_REACT_MEMOS_STYLE_PROBES,
		/**
		 * The whole `/api` surface, answered same-origin by the frozen synthetic
		 * projection. A fresh instance per run, so no run inherits another's
		 * writes; nothing here is a captured production payload.
		 */
		loopback: () => {
			const projection = createMemosProjection();
			memosProjection = projection;
			return { api: projection.api };
		},
		journey: async (context, page, _transportEvidence, lifecycle) => {
			if (lifecycle.expectedServiceWorker !== null)
				throw new Error('Memos journey received a service-worker expectation');
			const projection = memosProjectionForRun();
			/**
			 * The projection's `/api` decisions, and the origin's `/api`
			 * requests. Both exclude the static-asset traffic that passes
			 * through the same seam: the claim under test is that the client
			 * filters WITHOUT asking the server for data, not that a page with
			 * `cache-control: no-store` stops re-fetching the icons inside a
			 * card React just re-rendered.
			 */
			const apiRecords = (): number =>
				projection.ledger().filter((entry) => entry.decision !== 'declined-non-api').length;
			const apiOriginRequests = (): number =>
				lifecycle.staticRequests().filter((path) => path.startsWith('/api/')).length;
			const originRequests = (): number => lifecycle.staticRequests().length;
			const routeExtents: Array<{
				route: string;
				scrollHeight: number;
				clientHeight: number;
			}> = [];
			/**
			 * The generic document measurement, taken at every stage the journey
			 * occupies. It is what licenses the scroll claim to be an absence
			 * rather than an omission: no stage is left unmeasured.
			 */
			const measure = async (route: string): Promise<void> => {
				const extents = await lifecycle.viewportScroll();
				if (extents.clientHeight !== MEMOS_VIEWPORT.height)
					throw new Error(
						`Memos stage measured against an unexpected viewport: ${route} ${canonicalize(extents)}`,
					);
				if (extents.scrollHeight > extents.clientHeight)
					throw new Error(
						`Memos stage overflows the document it is claimed not to: ${route} ${canonicalize(extents)}`,
					);
				routeExtents.push({
					route,
					scrollHeight: extents.scrollHeight,
					clientHeight: extents.clientHeight,
				});
			};
			await page.trackEvents('click', 'input', 'keydown', 'mouseover');

			// (a) The session gate, observed from outside. The home route asks
			// `GET /api/user/me` before a session exists, the projection refuses
			// it, and the application replaces history with its signin route.
			await context.expect.page.text(page, MEMOS_SIGNIN_BUTTON, 'Sign in');
			await context.expect.page.bodyText(page, { contains: 'self-hosted' });
			const gateRecord = projection
				.ledger()
				.find((entry) => entry.endpoint === 'user.me.get');
			if (gateRecord?.status !== 401 || gateRecord.authenticated !== false)
				throw new Error(
					`Memos session gate did not refuse the signed-out probe: ${canonicalize(gateRecord ?? null)}`,
				);
			await measure('/signin (the session gate)');

			// (b) The application's own sign-in form, with the amended owner pair
			// the pinned client-side validator accepts.
			await page.hover(MEMOS_SIGNIN_EMAIL);
			await page.type(MEMOS_SIGNIN_EMAIL, MEMOS_SEED.users[0]!.email, { redact: false });
			await page.type(MEMOS_SIGNIN_PASSWORD, MEMOS_OWNER_PASSWORD);
			await page.click(MEMOS_SIGNIN_BUTTON);
			await context.expect.page.text(page, MEMOS_HEADER_TITLE, 'MEMOS');
			await context.expect.page.text(page, MEMOS_USERNAME, MEMOS_SEED.users[0]!.name);
			await context.expect.page.count(page, MEMOS_LIST_ENTRY, MEMOS_SEEDED_LIVE);
			await context.expect.page.text(page, MEMOS_LIST_STATUS, MEMOS_MUTATION_SEAM);
			const renderedStyles = await lifecycle.renderedStyles();
			await measure('/ (signed in)');

			// (c) A memo composed in the application's own editor and saved. The
			// typed content has to reach the list AND the projection ledger: a
			// store that rendered without a write would pass the first and fail
			// the second.
			await page.type(MEMOS_EDITOR_INPUT, MEMOS_COMPOSED_CONTENT, { redact: false });
			await page.click(MEMOS_EDITOR_SAVE);
			await context.expect.page.count(page, MEMOS_LIST_ENTRY, MEMOS_LIVE_AFTER_COMPOSE);
			await context.expect.page.bodyText(page, { contains: MEMOS_COMPOSED_CONTENT });
			await context.expect.page.count(page, MEMOS_COMPOSED_MEMO, 1);
			const created = projection
				.ledger()
				.find((entry) => entry.endpoint === 'memo.create' && entry.status === 200);
			if (created === undefined)
				throw new Error('Memos compose did not reach the projection ledger');
			await measure('/ (after the memo was saved)');

			// (d) A typed search and a tag filter, both solved in the browser
			// from the store the application already holds. Nothing may leave
			// the page while they narrow, and that is measured rather than
			// asserted: the projection ledger and the origin request log are
			// both required to be unchanged across the whole block.
			const apiBeforeSearch = apiRecords();
			const apiOriginBeforeSearch = apiOriginRequests();
			const originBeforeSearch = originRequests();
			await page.type(MEMOS_SEARCH_INPUT, MEMOS_SEARCH_TERM, { redact: false });
			await context.expect.page.count(page, MEMOS_LIST_ENTRY, 1);
			await context.expect.page.count(page, MEMOS_ARCHIVED_MEMO, 1);
			await measure('/ (the typed search narrowed the list)');
			await page.press(MEMOS_SEARCH_INPUT, 'a', { modifiers: ['Meta'] });
			await page.press(MEMOS_SEARCH_INPUT, 'Backspace');
			await context.expect.page.count(page, MEMOS_LIST_ENTRY, MEMOS_LIVE_AFTER_COMPOSE);
			const searchApiDelta = apiRecords() - apiBeforeSearch;
			const searchApiOriginDelta = apiOriginRequests() - apiOriginBeforeSearch;
			const searchAssetDelta = originRequests() - originBeforeSearch - searchApiOriginDelta;

			const apiBeforeTag = apiRecords();
			const apiOriginBeforeTag = apiOriginRequests();
			const originBeforeTag = originRequests();
			await context.expect.page.count(page, MEMOS_TAG_ITEM, MEMOS_TAGS.length);
			const tagIndex = MEMOS_TAGS.indexOf(MEMOS_TAG) + 1;
			const tagSelector = `${MEMOS_TAG_ITEM}:nth-of-type(${String(tagIndex)})`;
			await context.expect.page.text(page, `${tagSelector} .tag-text`, MEMOS_TAG);
			await page.click(tagSelector);
			await context.expect.page.count(page, MEMOS_LIST_ENTRY, 2);
			await measure('/ (the tag filter narrowed the list)');
			await page.click(tagSelector);
			await context.expect.page.count(page, MEMOS_LIST_ENTRY, MEMOS_LIVE_AFTER_COMPOSE);
			const tagApiDelta = apiRecords() - apiBeforeTag;
			const tagApiOriginDelta = apiOriginRequests() - apiOriginBeforeTag;
			const tagAssetDelta = originRequests() - originBeforeTag - tagApiOriginDelta;
			if (
				searchApiDelta !== 0 ||
				searchApiOriginDelta !== 0 ||
				tagApiDelta !== 0 ||
				tagApiOriginDelta !== 0
			)
				throw new Error(
					`Memos client-side filtering fired API requests: ${canonicalize({
						searchApiDelta,
						searchApiOriginDelta,
						tagApiDelta,
						tagApiOriginDelta,
					})}`,
				);

			// (e) A hover with an observable result: the memo's action menu is
			// display:none until the pointer is over the control that reveals it.
			await context.expect.page.computedStyle(page, MEMOS_ARCHIVED_ACTIONS, {
				display: 'none',
			});
			await page.hover(MEMOS_ARCHIVED_ACTION_COLUMN);
			await context.expect.page.computedStyle(page, MEMOS_ARCHIVED_ACTIONS, {
				display: 'flex',
			});

			// (f) Archive behind the application's own two-click confirmation,
			// then restore through the recycle bin. The first click only arms
			// the control; asserting its label is what proves the second click
			// is a confirmation rather than a repeat.
			await context.expect.page.text(page, MEMOS_ARCHIVED_DELETE, 'Delete');
			await page.click(MEMOS_ARCHIVED_DELETE);
			await context.expect.page.text(page, MEMOS_ARCHIVED_DELETE, 'Delete!');
			await page.click(MEMOS_ARCHIVED_DELETE);
			await context.expect.page.count(page, MEMOS_LIST_ENTRY, MEMOS_SEEDED_LIVE);
			await context.expect.page.count(page, `${MEMOS_LIST_ENTRY}${MEMOS_ARCHIVED_MEMO}`, 0);
			await page.click(MEMOS_SIDEBAR_TRASH);
			await context.expect.page.count(page, MEMOS_TRASH_ENTRY, MEMOS_SEEDED_ARCHIVED + 1);
			await page.click(MEMOS_TRASH_RESTORE);
			await context.expect.page.count(page, MEMOS_TRASH_ENTRY, MEMOS_SEEDED_ARCHIVED);
			await page.click(MEMOS_TRASH_CLOSE);
			await context.expect.page.count(page, MEMOS_LIST_ENTRY, MEMOS_LIVE_AFTER_COMPOSE);
			await context.expect.page.count(page, `${MEMOS_LIST_ENTRY}${MEMOS_ARCHIVED_MEMO}`, 1);
			await measure('/ (after the archive was restored)');

			// (g) The settings dialog, and the one write in this journey that is
			// not about memos at all: the account rename the application sends
			// as `PATCH /api/user/me`.
			await page.click(MEMOS_SIDEBAR_SETTING);
			await context.expect.page.bodyText(page, { contains: 'Account Information' });
			await page.press(MEMOS_SETTING_USERNAME, 'a', { modifiers: ['Meta'] });
			await page.type(MEMOS_SETTING_USERNAME, MEMOS_NEXT_USERNAME, { redact: false });
			await page.click(MEMOS_SETTING_CONFIRM);
			await context.expect.page.text(page, MEMOS_USERNAME, MEMOS_NEXT_USERNAME);
			const patched = projection
				.ledger()
				.find((entry) => entry.endpoint === 'user.me.patch' && entry.status === 200);
			if (patched === undefined || patched.method !== 'PATCH')
				throw new Error('Memos account rename did not reach the projection ledger');
			await measure('/ (the settings dialog is open)');
			await page.click(MEMOS_SETTING_CLOSE);
			await context.expect.page.text(page, MEMOS_LIST_STATUS, MEMOS_MUTATION_SEAM);

			const ledger = projection.ledger();
			const decisions = (decision: MemosProjectionDecision): number =>
				ledger.filter((entry) => entry.decision === decision).length;
			await context.expect.page.outcome(page, {
				events: {
					click: { atLeast: 9 },
					input: { atLeast: 60 },
					keydown: { atLeast: 60 },
					mouseover: { atLeast: 2 },
				},
			});
			await clean(
				context,
				page,
				MEMOS_JOURNEY_NAVIGATIONS,
				lifecycle.expectedConsoleErrors,
				lifecycle.expectedFailedRequests,
			);
			const applicationJourney: WitnessReactMemosJourney = {
				projection: {
					state: 'frozen-synthetic-loopback-projection',
					label: MEMOS_PROJECTION_LABEL,
					pinnedRevision: MEMOS_PINNED_REVISION,
					behaviorDigest: MEMOS_PROJECTION_BEHAVIOR_DIGEST,
					seedSha256: memosSeedDigest(),
					transport: 'same-origin-bounded-loopback-api',
					ledger: {
						state: 'measured-projection-ledger',
						records: ledger.length,
						apiRecords: ledger.length - decisions('declined-non-api'),
						served: decisions('served'),
						refusedUnknown: decisions('refused-unknown'),
						refusedUnprojected: decisions('refused-unprojected'),
						declinedNonApi: decisions('declined-non-api'),
						entries: memosLedgerTally(
							ledger.filter((entry) => entry.decision !== 'declined-non-api'),
						),
					},
				},
				gate: {
					state: 'measured-session-gate',
					signedOutStatus: 401,
					signedOutRoute: '/signin',
					signedInRoute: '/',
					signedInBy: "the application's own Signin form",
					owner: MEMOS_SEED.users[0]!.email,
					ownerPassesPinnedValidator: true,
				},
				compose: {
					state: 'measured-memo-created',
					content: MEMOS_COMPOSED_CONTENT,
					memoId: MEMOS_COMPOSED_MEMO_ID,
					listBefore: MEMOS_SEEDED_LIVE,
					listAfter: MEMOS_LIVE_AFTER_COMPOSE,
					endpoint: 'memo.create',
					status: 200,
				},
				search: {
					state: 'measured-client-side-narrowing',
					term: MEMOS_SEARCH_TERM,
					beforeFilter: MEMOS_LIVE_AFTER_COMPOSE,
					narrowed: 1,
					afterClear: MEMOS_LIVE_AFTER_COMPOSE,
					wideningGesture: 'select-all-then-backspace',
					apiRecordsDuringFilter: 0,
					apiOriginRequestsDuringFilter: 0,
					assetRequestsDuringFilter: searchAssetDelta,
				},
				tagFilter: {
					state: 'measured-client-side-tag-filter',
					tags: [...MEMOS_TAGS],
					tag: MEMOS_TAG,
					narrowed: 2,
					afterRestore: MEMOS_LIVE_AFTER_COMPOSE,
					apiRecordsDuringFilter: 0,
					apiOriginRequestsDuringFilter: 0,
					assetRequestsDuringFilter: tagAssetDelta,
				},
				archive: {
					state: 'measured-two-click-archive-and-restore',
					memoId: MEMOS_ARCHIVED_MEMO_ID,
					firstClickLabel: 'Delete',
					confirmLabel: 'Delete!',
					listAfterArchive: MEMOS_SEEDED_LIVE,
					trashEntries: MEMOS_SEEDED_ARCHIVED + 1,
					trashEntriesAfterRestore: MEMOS_SEEDED_ARCHIVED,
					listAfterRestore: MEMOS_LIVE_AFTER_COMPOSE,
					archivedRowStatus: 'ARCHIVED',
					restoredRowStatus: 'NORMAL',
				},
				settings: {
					state: 'measured-account-patch',
					previousName: MEMOS_SEED.users[0]!.name,
					nextName: MEMOS_NEXT_USERNAME,
					endpoint: 'user.me.patch',
					method: 'PATCH',
					path: '/api/user/me',
					status: 200,
					renderedUsername: MEMOS_NEXT_USERNAME,
				},
				hover: {
					state: 'measured-hover-revealed-actions',
					selector: MEMOS_ARCHIVED_ACTION_COLUMN,
					hiddenDisplay: 'none',
					revealedDisplay: 'flex',
				},
				routeExtents: {
					state: 'measured-per-route-document-extents',
					viewport: { ...MEMOS_VIEWPORT },
					routes: routeExtents,
				},
			};
			return {
				assertions: [
					'the session gate refuses the signed-out probe and the application replaces history with its own signin route',
					"a real session opened through the application's own Signin form with the amended owner pair",
					'the seeded memo list rendered behind the gate, pinned memo first',
					'a memo composed in the application own editor, rendered in the list and recorded as a create in the projection ledger',
					'a typed search narrowed the list and a select-all clear restored it, with no request fired',
					'a tag filter narrowed the list and a second click on the same tag restored it, with no request fired',
					'the memo action menu revealed by a genuine hover, measured as display none then flex',
					'archive behind the application own two-click confirmation, removal from the list, restore through the recycle bin and return to the list',
					'an account rename sent as PATCH /api/user/me and rendered back into the user banner',
					'every projection decision served; no unknown-endpoint and no withheld-endpoint refusal',
					'clean page',
				],
				offlineEvidence: { state: 'not-applicable' },
				renderedStyles,
				applicationJourney,
				scrollAbsence: {
					state: 'measured-no-overflowing-document',
					viewport: { ...MEMOS_VIEWPORT },
					routes: routeExtents,
					documentOverflow:
						'the application pins its page wrapper to the viewport height and scrolls its own memo list and sidebar panels internally, so the document never overflows and there is no document scroll surface to gesture at',
					claimed: false,
				},
			};
		},
	},
];

/**
 * The published application specs, exported so the two opt-in browser
 * mechanisms can be held to their own construction rather than to an intention:
 * a reader — and a test — can see directly that every vertical that predates
 * them declares neither a file-input surface nor a download surface, which is
 * what makes "those journeys are untouched" a checkable fact.
 */
export const witnessRealAppSpecs: readonly AppSpec[] = apps;

async function exists(file: string): Promise<boolean> {
	return access(file).then(
		() => true,
		() => false,
	);
}

async function execute(
	command: string,
	args: string[],
	cwd: string,
	environment: NodeJS.ProcessEnv,
): Promise<void> {
	await new Promise<void>((resolvePromise, reject) => {
		const child = spawn(command, args, { cwd, env: environment, stdio: 'inherit' });
		child.once('error', reject);
		child.once('exit', (code) =>
			code === 0 ? resolvePromise() : reject(new Error(`${command} exited ${code}`)),
		);
	});
}

async function fileCount(directory: string): Promise<number> {
	let count = 0;
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		if (entry.isDirectory()) count += await fileCount(join(directory, entry.name));
		else if (entry.isFile()) count += 1;
	}
	return count;
}

async function reconstructKilledByGoogle(): Promise<
	WitnessRealAppReceipt['killedByGoogleInventory']
> {
	const archiveSha256 = sha256(await readFile(killedByGoogleArchive));
	if (archiveSha256 !== EXPECTED_KILLED_BY_GOOGLE_ARCHIVE)
		throw new Error('KilledByGoogle immutable archive identity differs');
	const mirrorFiles = await fileCount(killedByGoogleMirror);
	if (mirrorFiles === 0) throw new Error('KilledByGoogle offline mirror is empty');
	const retained = join(stageRoot, 'killedbygoogle-retained');
	const node16 = join(root, '.versionless/cache/angular-phonecat/node16/bin/node');
	const yarn = join(process.env.HOME ?? '', '.cache/node/corepack/v1/yarn/1.22.22/bin/yarn.js');
	await rm(retained, { recursive: true, force: true });
	const sourceFiles = { baseline: 0, migrated: 0 };
	const buildFiles = { baseline: 0, migrated: 0 };
	for (const lane of ['baseline', 'migrated'] as const) {
		const source = join(retained, `${lane}-source`);
		await mkdir(source, { recursive: true });
		await execute(
			'/usr/bin/tar',
			['-xzf', killedByGoogleArchive, '-C', source, '--strip-components', '1'],
			root,
			process.env,
		);
		await writeFile(
			join(source, '.yarnrc'),
			`yarn-offline-mirror "${killedByGoogleMirror}"\nyarn-offline-mirror-pruning false\n`,
		);
		const environment = {
			PATH: `${dirname(node16)}:/usr/bin:/bin`,
			VERSIONLESS_NETWORK_MODE: 'offline',
			NPM_CONFIG_OFFLINE: 'true',
			YARN_ENABLE_NETWORK: '0',
			SKIP_YARN_COREPACK_CHECK: '1',
			NEXT_TELEMETRY_DISABLED: '1',
			CI: '1',
		};
		await execute(
			node16,
			[
				yarn,
				'install',
				'--frozen-lockfile',
				'--offline',
				'--ignore-scripts',
				'--non-interactive',
				'--cache-folder',
				join(source, '.yarn-cache'),
			],
			source,
			environment,
		);
		if (lane === 'migrated') {
			const appFile = join(source, 'components/App.tsx');
			const before = await readFile(appFile, 'utf8');
			const transformed = transformNext12DerivedStateToMemo(before);
			if (!transformed.changed || transformed.edits.length !== 3)
				throw new Error('KilledByGoogle retained target transform differs');
			await writeFile(appFile, transformed.code);
		}
		sourceFiles[lane] = await fileCount(source);
		await execute(
			node16,
			[join(source, 'node_modules/next/dist/bin/next'), 'build'],
			source,
			environment,
		);
		const output = join(retained, lane);
		await mkdir(join(output, '_next'), { recursive: true });
		await cp(join(source, '.next/server/pages/index.html'), join(output, 'index.html'));
		await cp(join(source, '.next/static'), join(output, '_next/static'), { recursive: true });
		await cp(join(source, 'public'), output, { recursive: true });
		buildFiles[lane] = await fileCount(output);
		if (buildFiles[lane] === 0)
			throw new Error(`KilledByGoogle ${lane} build inventory is empty`);
	}
	return { archiveSha256, mirrorFiles, sourceFiles, buildFiles, transformEdits: 3 };
}

async function bindCanonicalReceipts(): Promise<WitnessRealAppReceipt['canonicalReceipts']> {
	return await Promise.all(
		apps.map(async (app) => {
			const bytes = await readFile(join(root, app.canonicalReceipt));
			const value = JSON.parse(bytes.toString('utf8')) as {
				integrity?: { canonicalDigest?: string };
			};
			const bound =
				app.canonicalBinding === 'file-sha256'
					? sha256(bytes)
					: value.integrity?.canonicalDigest;
			if (bound !== app.canonicalDigest)
				throw new Error(`${app.app} canonical receipt silently rebound`);
			return {
				app: app.app,
				path: app.canonicalReceipt,
				sha256: sha256(bytes),
				canonicalDigest: app.canonicalDigest,
			};
		}),
	);
}

async function stageInputs(): Promise<WitnessRealAppReceipt['killedByGoogleInventory']> {
	const inventory = await reconstructKilledByGoogle();
	await rm(join(stageRoot, 'lanes'), { recursive: true, force: true });
	for (const app of apps) {
		for (const lane of ['baseline', 'migrated'] as const) {
			const source = join(root, app.sources[lane]);
			if (!(await exists(source)))
				throw new Error(`${app.app} ${lane} retained browser output missing`);
			const destination = join(stageRoot, 'lanes', app.app, lane);
			await mkdir(destination, { recursive: true });
			await cp(source, destination, { recursive: true, force: false });
		}
	}
	return inventory;
}

function pageRecordFromReceipt(value: unknown): PageRecord {
	const receipt = value as { boxes?: Array<{ pages?: PageRecord[] }> };
	const page = receipt.boxes?.[0]?.pages?.[0];
	if (page === undefined)
		throw new Error('linked Witness receipt omitted the observed page record');
	return page;
}

function assertHmrFree(page: PageRecord): void {
	for (const url of [
		page.url,
		...page.navigations.map((navigation) => navigation.url),
		...page.networkRequests.map((request) => request.url),
	]) {
		const parsed = parseURL(url);
		const pathname = parsed.pathname || '';
		if (
			parsed.protocol === 'ws:' ||
			parsed.protocol === 'wss:' ||
			pathname === '/@vite/client' ||
			pathname.startsWith('/@id/') ||
			pathname.startsWith('/@fs/')
		)
			throw new Error(`Witness production-static journey imported HMR control: ${pathname}`);
	}
}

function normalizedRecord(
	page: PageRecord,
	normalizeRoute: (path: string) => string = (path) => path,
	admittedCancelledDuplicates: ReadonlySet<string> = new Set(),
	origin = '',
): WitnessRealAppRun['witnessRecord'] {
	return {
		interactions: page.interactions.map((interaction) => ({
			kind: interaction.kind as WitnessRealAppRun['interactions'][number]['kind'],
			selector:
				'selector' in interaction && typeof interaction.selector === 'string'
					? interaction.selector
					: 'viewport',
		})),
		navigationPaths: page.navigations.map((navigation) => {
			const parsed = parseURL(navigation.url);
			return normalizeRoute(`${parsed.pathname}${parsed.hash}`);
		}),
		trackedEventCounts: Object.fromEntries(
			Object.entries(page.trackedEvents).map(([name, events]) => [name, events.length]),
		),
		consoleErrors: page.consoleMessages.filter((message) => message.level === 'error').length,
		pageErrors: page.pageErrors.length,
		// Every browser-failed request except the ones the cancelled-duplicate
		// category admitted, which are recorded individually in their own
		// inventory. With no category declared the set is empty and this is the
		// plain total it has always been.
		failedRequests: page.failedRequests.filter(
			(request) =>
				!admittedCancelledDuplicates.has(
					failedRequestKey({
						method: request.method,
						path: witnessRecordedRequestPath(request.url, origin),
						reason: request.reason,
						count: 1,
					}),
				),
		).length,
	};
}

async function executeRun(
	app: AppSpec,
	lane: Lane,
	pass: 1 | 2,
	options: {
		laneRoot?: string;
		receiptRoot?: string;
		nextPrerenderPayload?: NextPrerenderPayloadInput;
		serviceWorkerPolicy?: 'canonical' | 'zero';
	} = {},
): Promise<WitnessRealAppRun> {
	const laneRoot = options.laneRoot ?? join(stageRoot, 'lanes', app.app, lane);
	const receiptDir = join(
		options.receiptRoot ?? join(stageRoot, 'witness-receipts'),
		app.app,
		lane,
		`pass-${pass}`,
	);
	await rm(receiptDir, { recursive: true, force: true });
	const beforeInventory = await staticInventory(laneRoot);
	const contextProfile =
		app.app === 'react-boilerplate' &&
		lane === 'baseline' &&
		options.serviceWorkerPolicy !== 'zero'
			? ('canonical-t060' as const)
			: ('current-witness' as const);
	const loopback = app.loopback?.();
	const staticServer = await startStaticServer(laneRoot, {
		profile: contextProfile,
		api: loopback?.api,
		upgrade: loopback?.upgrade,
	});
	const productionUrl = joinURL(staticServer.origin, app.initialRoute ?? '/');
	const transportEvidence: JourneyTransportEvidence = { apiUsernames: [] };
	const expectedServiceWorker =
		app.app === 'react-boilerplate' && options.serviceWorkerPolicy !== 'zero'
			? await expectedReactTelemetry(laneRoot, lane)
			: null;
	const phonecatOrdering =
		app.app === 'angular-phonecat' ? await expectedPhonecatOrdering(laneRoot) : null;
	const phonecatImages =
		app.app === 'angular-phonecat' ? await expectedPhonecatImages(laneRoot) : null;
	const differentialEvents: WitnessDifferentialEvent[] = [];
	const host = createPlaywrightWitnessHost({
		chromiumExecutable,
		contextProfile,
		transport:
			app.transport === undefined
				? undefined
				: async (request) => await app.transport!(request, transportEvidence),
		diagnosticEvent:
			options.serviceWorkerPolicy === 'zero' || app.serviceWorkers === 'block'
				? (event) => differentialEvents.push(event)
				: undefined,
		...(app.serviceWorkers === undefined ? {} : { serviceWorkers: app.serviceWorkers }),
		...(app.viewport === undefined ? {} : { viewport: app.viewport }),
		// Both mechanisms are per-application opt-ins and are spread in only
		// where the application declared them, so an application that declares
		// neither is run by exactly the host it was run by before they existed.
		...(app.fileInputs === undefined ? {} : { fileInputs: app.fileInputs }),
		...(app.downloads === undefined ? {} : { downloads: app.downloads }),
	});
	const expectedConsoleErrors = (app.consoleErrorInventory?.[lane] ?? []).reduce(
		(sum, entry) => sum + entry.count,
		0,
	);
	const expectedFailedRequests = (app.failedRequestInventory?.[lane] ?? []).reduce(
		(sum, entry) => sum + entry.count,
		0,
	);
	const cancelledDuplicateCategory = app.cancelledDuplicateFetches?.[lane] ?? [];
	const cancelledDuplicateFetchInventory = (): WitnessCancelledDuplicateFetchInventory =>
		buildCancelledDuplicateFetchInventory(
			host.requestOutcomes(),
			staticServer.origin,
			cancelledDuplicateCategory,
		);
	let journeyEvidence: JourneyEvidence | undefined;
	const definition = box(`${app.app}-${lane}-${pass}`, async (context) => {
		const page = await context.browser.visit(productionUrl);
		journeyEvidence = await app.journey(context, page, transportEvidence, {
			lane,
			serviceWorkerTelemetry: host.serviceWorkerTelemetry,
			staticRequests: staticServer.requests,
			expectedServiceWorker,
			phonecatOrdering,
			phonecatImages,
			viewportScroll: host.viewportScroll,
			expectedConsoleErrors,
			expectedFailedRequests,
			admittedCancelledDuplicateFetches: () => cancelledDuplicateFetchInventory().admitted,
			renderedStyles: async () => {
				const probes = app.renderedStyleProbes ?? [];
				if (probes.length === 0)
					throw new Error(`${app.app} declares no rendered-style probes to measure`);
				return await host.renderedStyles(probes);
			},
			groupedText: async (probe) => await host.groupedText(probe),
			browserStorageKeys: host.browserStorageKeys,
			loadFileInput: host.loadFileInput,
			capturedDownloads: host.capturedDownloads,
		});
		await context.receipt.capture('journey-complete');
	});
	let result: Awaited<ReturnType<typeof runBoxes>>;
	try {
		result = await runBoxes({
			root: laneRoot,
			boxes: [
				{
					file: join(laneRoot, 'versionless-runtime.box.ts'),
					relativeFile: 'versionless-runtime.box.ts',
					exportName: 'default',
					box: definition,
				},
			],
			receiptDir,
			assertionTimeoutMs: 10_000,
			fileSystem: witnessNodeFileSystem,
			browser: host.browser,
			headless: true,
		});
	} finally {
		await staticServer.close();
	}
	staticServer.assertClean();
	const afterInventory = await staticInventory(laneRoot);
	if (canonicalize(beforeInventory) !== canonicalize(afterInventory))
		throw new Error(`${app.app} ${lane} served bytes changed during the journey`);
	const rawReceipt = JSON.parse(await readFile(result.receiptPath, 'utf8')) as unknown;
	const completedJourney = journeyEvidence as JourneyEvidence | undefined;
	const observerFinalization = host.serviceWorkerObserverFinalization();
	if (completedJourney?.timeoutTelemetry !== undefined) {
		const diagnostic = {
			schemaVersion: 'versionless.witness-real-app-sw-diagnostic.v1',
			result: 'timeout',
			app: app.app,
			lane,
			pass,
			telemetry: completedJourney.timeoutTelemetry,
			observerFinalization,
			staticLedger: staticServer.ledger(),
		};
		const diagnosticDirectory = join(stageRoot, 'diagnostics');
		await mkdir(diagnosticDirectory, { recursive: true });
		await writeFile(
			join(diagnosticDirectory, `${app.app}-${lane}-service-worker.json`),
			`${canonicalize(diagnostic)}\n`,
		);
		throw new Error(
			`linked Witness service-worker diagnostic timed out: ${canonicalize({ telemetry: diagnostic.telemetry, failedResponses: diagnostic.staticLedger.filter((entry) => entry.status !== 200) })}`,
		);
	}
	if (result.status !== 'passed' || completedJourney === undefined)
		throw new Error(
			`linked Witness runtime journey failed: ${result.boxes[0]?.error?.message ?? 'unknown failure'}; static paths: ${canonicalize(staticServer.requests())}`,
		);
	const pageRecord = pageRecordFromReceipt(rawReceipt);
	const serviceWorkerRequests = projectServiceWorkerEvents(
		differentialEvents.filter(
			(event) =>
				event.detail.serviceWorker === true ||
				event.urlPath === '/sw.js' ||
				event.urlPath === '/service-worker.js',
		),
	);
	const legacyMainPrecache =
		app.app === 'react-boilerplate' &&
		lane === 'baseline' &&
		options.serviceWorkerPolicy !== 'zero'
			? {
					state: 'exact-completed' as const,
					responses: await exactLegacyMainPrecacheResponses(
						laneRoot,
						staticServer.ledger(),
					),
				}
			: { state: 'not-applicable' as const };
	const nextPrerenderPayload =
		options.nextPrerenderPayload === undefined
			? ({ state: 'not-applicable' } as const)
			: exactNextPrerenderPayloadEvidence(
					laneRoot,
					staticServer.ledger(),
					options.nextPrerenderPayload,
				);
	assertHmrFree(pageRecord);
	/**
	 * Computed once from the whole run's ledger, before anything is counted, so
	 * the failed-request inventory and the recorded failure count both see the
	 * same admitted set.
	 */
	const cancelledDuplicates = cancelledDuplicateFetchInventory();
	const admittedCancelledKeys = new Set(
		cancelledDuplicates.observed.map(cancelledDuplicateFetchKey),
	);
	const witnessRecord = normalizedRecord(
		pageRecord,
		app.normalizeRoute,
		admittedCancelledKeys,
		staticServer.origin,
	);
	const interactions = witnessRecord.interactions;
	const trackedEvents = Object.entries(witnessRecord.trackedEventCounts)
		.filter(([, count]) => count > 0)
		.map(([name]) => name)
		.sort();
	const runWithoutDigest = {
		app: app.app,
		framework: app.framework,
		lane,
		interactions,
		assertions: completedJourney.assertions,
		routes: witnessRecord.navigationPaths,
		trackedEvents,
		witnessRecord,
		cleanPage: true as const,
		offlineEvidence: completedJourney.offlineEvidence,
		servedStatic: {
			transport: 'isolated-bounded-loopback-production-static' as const,
			documentFallback: 'index-only' as const,
			missingAssets: '404' as const,
			traversal: 'rejected' as const,
			inventory: {
				files: beforeInventory.files,
				beforeSha256: beforeInventory.digest,
				afterSha256: afterInventory.digest,
			},
			application: {
				path: 'index.html' as const,
				beforeSha256: beforeInventory.applicationSha256,
				afterSha256: afterInventory.applicationSha256,
			},
			serviceWorkers: beforeInventory.serviceWorkers.map((serviceWorker, index) => ({
				path: serviceWorker.path,
				beforeSha256: serviceWorker.sha256,
				afterSha256: afterInventory.serviceWorkers[index]!.sha256,
			})),
			byteIdentical: true as const,
			hmrControls: false as const,
			legacyMainPrecache,
			phonecatOrdering:
				phonecatOrdering === null
					? { state: 'not-applicable' as const }
					: {
							state: 'data-derived-full-order' as const,
							datasetSha256: phonecatOrdering.datasetSha256,
							orderSha256: phonecatOrdering.orderSha256,
							rows: 20 as const,
							comparator: 'stable-lowercase-utf16-source-order-ties' as const,
						},
			phonecatImageTransition:
				phonecatImages === null
					? { state: 'not-applicable' as const }
					: {
							state: 'data-derived-visible-transition' as const,
							detailSha256: phonecatImages.detailSha256,
							defaultImage: phonecatImages.defaultImage,
							nonDefaultImage: phonecatImages.nonDefaultImage,
							hover: 'genuine-thumbnail-mouseover' as const,
							transition: 'genuine-ng-click' as const,
							heroVisibility: 'genuine-hover' as const,
						},
			nextPrerenderPayload,
		},
		observerFinalization,
		...(completedJourney.zeroServiceWorker === undefined
			? {}
			: {
					zeroServiceWorker: {
						...completedJourney.zeroServiceWorker,
						outputFiles: beforeInventory.serviceWorkers,
						requests: differentialEvents.filter(
							(event) =>
								event.detail.serviceWorker === true ||
								event.urlPath === '/sw.js' ||
								event.urlPath === '/service-worker.js',
						),
						workerEvents: observerFinalization.workerEvents,
					},
				}),
		...(completedJourney.zeroServiceWorkerRuntime === undefined
			? {}
			: {
					zeroServiceWorkerRuntime: {
						...completedJourney.zeroServiceWorkerRuntime,
						emittedOutputFiles: beforeInventory.serviceWorkers,
						requests: differentialEvents.filter(
							(event) =>
								event.detail.serviceWorker === true ||
								event.urlPath === '/sw.js' ||
								event.urlPath === '/service-worker.js',
						),
						workerEvents: observerFinalization.workerEvents,
					},
				}),
		...(completedJourney.blockedServiceWorkerRuntime === undefined
			? {}
			: {
					blockedServiceWorkerRuntime: {
						...completedJourney.blockedServiceWorkerRuntime,
						emittedOutputFiles: beforeInventory.serviceWorkers,
						requests: serviceWorkerRequests,
						requestTally: tallyServiceWorkerEvents(serviceWorkerRequests),
						workerEvents: observerFinalization.workerEvents,
					},
				}),
		...(completedJourney.scrollSurface === undefined
			? {}
			: { scrollSurface: completedJourney.scrollSurface }),
		...(completedJourney.scrollAbsence === undefined
			? {}
			: { scrollAbsence: completedJourney.scrollAbsence }),
		...(app.consoleErrorInventory === undefined
			? {}
			: {
					consoleErrorInventory: buildConsoleErrorInventory(
						pageRecord,
						staticServer.origin,
						app.consoleErrorInventory[lane],
					),
				}),
		...(app.failedRequestInventory === undefined
			? {}
			: {
					failedRequestInventory: buildFailedRequestInventory(
						pageRecord,
						staticServer.origin,
						app.failedRequestInventory[lane],
						admittedCancelledKeys,
					),
				}),
		...(app.cancelledDuplicateFetches === undefined
			? {}
			: { cancelledDuplicateFetches: cancelledDuplicates }),
		...(app.mockedNonLoopbackSeams === undefined
			? {}
			: {
					mockedNonLoopbackSeams: buildMockedNonLoopbackSeamInventory(
						host.requestOutcomes(),
						staticServer.origin,
						app.mockedNonLoopbackSeams[lane],
					),
				}),
		...(completedJourney.renderedStyles === undefined
			? {}
			: {
					renderedStyles: {
						state: 'measured-resolved-styles' as const,
						probes: completedJourney.renderedStyles,
					} satisfies WitnessRenderedStyleEvidence,
				}),
		...(completedJourney.applicationJourney === undefined
			? {}
			: { applicationJourney: completedJourney.applicationJourney }),
		successfulNonLoopback: host.locality().successfulNonLoopback,
	};
	if ('blockedServiceWorkerRuntime' in runWithoutDigest) {
		const blocked = runWithoutDigest.blockedServiceWorkerRuntime;
		if (
			blocked === undefined ||
			blocked.registration !== 'application-register-refused-by-context' ||
			blocked.workerEvents.length !== 0 ||
			blocked.checkpoints.length !== 3 ||
			blocked.checkpoints.some(
				(checkpoint) =>
					checkpoint.state !== 'timeout' ||
					checkpoint.registrations !== 0 ||
					checkpoint.controller !== null ||
					checkpoint.cacheNames.length !== 0 ||
					checkpoint.workerEvents.length !== 0,
			)
		)
			throw new Error('blocked-service-worker policy assertion failed');
	}
	if ('zeroServiceWorker' in runWithoutDigest) {
		const zero = runWithoutDigest.zeroServiceWorker;
		if (
			zero === undefined ||
			zero.outputFiles.length !== 0 ||
			zero.requests.length !== 0 ||
			zero.workerEvents.length !== 0 ||
			zero.checkpoints.length !== 3 ||
			zero.checkpoints.some(
				(checkpoint) =>
					checkpoint.state !== 'timeout' ||
					checkpoint.registrations !== 0 ||
					checkpoint.controller !== null ||
					checkpoint.cacheNames.length !== 0 ||
					checkpoint.workerEvents.length !== 0,
			)
		)
			throw new Error('zero-service-worker policy assertion failed');
	}
	if ('zeroServiceWorkerRuntime' in runWithoutDigest) {
		const zero = runWithoutDigest.zeroServiceWorkerRuntime;
		if (
			zero === undefined ||
			zero.registration !== 'application-unregister' ||
			zero.requests.length !== 0 ||
			zero.workerEvents.length !== 0 ||
			zero.checkpoints.length !== 3 ||
			zero.checkpoints.some(
				(checkpoint) =>
					checkpoint.state !== 'timeout' ||
					checkpoint.registrations !== 0 ||
					checkpoint.controller !== null ||
					checkpoint.cacheNames.length !== 0 ||
					checkpoint.workerEvents.length !== 0,
			)
		)
			throw new Error('runtime zero-service-worker policy assertion failed');
	}
	return {
		...runWithoutDigest,
		pass,
		result: 'pass',
		semanticDigest: sha256(canonicalize(runWithoutDigest)),
	};
}

export async function executeAngularRealworldWitnessRun(options: {
	lane: Lane;
	pass: 1 | 2;
	laneRoot: string;
	receiptRoot: string;
}): Promise<WitnessRealAppRun> {
	const app = apps.find((candidate) => candidate.app === 'angular-realworld');
	if (app === undefined) throw new Error('Angular RealWorld Witness specification is absent');
	return await executeRun(app, options.lane, options.pass, options);
}

export async function executeReactBoilerplateWitnessRun(options: {
	lane: Lane;
	pass: 1 | 2;
	laneRoot: string;
	receiptRoot: string;
}): Promise<WitnessRealAppRun> {
	const app = apps.find((candidate) => candidate.app === 'react-boilerplate');
	if (app === undefined) throw new Error('React Boilerplate Witness specification is absent');
	return await executeRun(app, options.lane, options.pass, options);
}

export async function executeReactPapercupsWitnessRun(options: {
	lane: Lane;
	pass: 1 | 2;
	laneRoot: string;
	receiptRoot: string;
}): Promise<WitnessRealAppRun> {
	const app = apps.find((candidate) => candidate.app === 'papercups');
	if (app === undefined) throw new Error('Papercups Witness specification is absent');
	return await executeRun(app, options.lane, options.pass, {
		...options,
		serviceWorkerPolicy: 'zero',
	});
}

/**
 * Same runtime check as the zero-worker checkpoint, for an application whose
 * own code calls `register()` and whose registration the browser context
 * refuses: nothing may be registered, controlling, cached, or emitting worker
 * lifecycle events at this point in the journey.
 */
async function blockedServiceWorkerCheckpoint(
	lifecycle: JourneyLifecycle,
	phase: 'before-interactions' | 'after-interactions' | 'after-online-reload',
): Promise<{
	phase: typeof phase;
	state: 'timeout';
	registrations: 0;
	controller: null;
	cacheNames: [];
	workerEvents: [];
}> {
	return await zeroServiceWorkerCheckpoint(lifecycle, phase);
}

export async function executeReactHospitalrunWitnessRun(options: {
	lane: Lane;
	pass: 1 | 2;
	laneRoot: string;
	receiptRoot: string;
}): Promise<WitnessRealAppRun> {
	const app = apps.find((candidate) => candidate.app === 'react-hospitalrun');
	if (app === undefined) throw new Error('HospitalRun Witness specification is absent');
	return await executeRun(app, options.lane, options.pass, options);
}

/**
 * The Memos Witness specification, reachable so its declared inventories,
 * probes and lane bindings can be checked against the receipt schema that
 * enforces them without launching a browser.
 */
export function reactMemosWitnessSpec(): AppSpec {
	const app = apps.find((candidate) => candidate.app === 'react-memos');
	if (app === undefined) throw new Error('Memos Witness specification is absent');
	return app;
}

export async function executeReactMemosWitnessRun(options: {
	lane: Lane;
	pass: 1 | 2;
	laneRoot: string;
	receiptRoot: string;
}): Promise<WitnessRealAppRun> {
	return await executeRun(reactMemosWitnessSpec(), options.lane, options.pass, options);
}

export async function executeReactLinkfreeWitnessRun(options: {
	lane: Lane;
	pass: 1 | 2;
	laneRoot: string;
	receiptRoot: string;
}): Promise<WitnessRealAppRun> {
	const app = apps.find((candidate) => candidate.app === 'react-linkfree');
	if (app === undefined) throw new Error('LinkFree Witness specification is absent');
	return await executeRun(app, options.lane, options.pass, options);
}

/**
 * factoriolab ships no service worker in either lane and never calls
 * `register()`, so the run is executed under the zero-worker policy: the
 * browser context still allows registration, and the journey is required to
 * observe nothing registered, controlling, cached or requested at each of its
 * three checkpoints.
 */
export async function executeAngularFactoriolabWitnessRun(options: {
	lane: Lane;
	pass: 1 | 2;
	laneRoot: string;
	receiptRoot: string;
}): Promise<WitnessRealAppRun> {
	const app = apps.find((candidate) => candidate.app === 'angular-factoriolab');
	if (app === undefined) throw new Error('factoriolab Witness specification is absent');
	return await executeRun(app, options.lane, options.pass, {
		...options,
		serviceWorkerPolicy: 'zero',
	});
}

/**
 * The jira-clone Witness specification, reachable so its declared inventories,
 * probes and seams can be checked against the receipt schema that enforces them
 * without launching a browser.
 */
export function angularJiraCloneWitnessSpec(): AppSpec {
	const app = apps.find((candidate) => candidate.app === 'angular-jira-clone');
	if (app === undefined) throw new Error('jira-clone Witness specification is absent');
	return app;
}

/**
 * jira-clone ships no service worker in either lane and never calls
 * `register()`, so the run is executed under the zero-worker policy: the
 * browser context still allows registration, and the journey is required to
 * observe nothing registered, controlling, cached or requested at each of its
 * three checkpoints.
 */
export async function executeAngularJiraCloneWitnessRun(options: {
	lane: Lane;
	pass: 1 | 2;
	laneRoot: string;
	receiptRoot: string;
}): Promise<WitnessRealAppRun> {
	return await executeRun(angularJiraCloneWitnessSpec(), options.lane, options.pass, {
		...options,
		serviceWorkerPolicy: 'zero',
	});
}

/**
 * The killedbygoogle v3 Witness specification, reachable so its declared
 * inventories, probes and lane bindings can be checked against the receipt
 * schema that enforces them without launching a browser.
 */
export function nextKilledbygoogleV3WitnessSpec(): AppSpec {
	const app = apps.find((candidate) => candidate.app === NEXT_KILLEDBYGOOGLE_V3_APP);
	if (app === undefined) throw new Error('KilledByGoogle v3 Witness specification is absent');
	return app;
}

/**
 * Neither lane ships a service worker and the application never calls
 * `register()`, so the run is executed under the zero-worker policy: the browser
 * context still allows registration, and the journey is required to observe
 * nothing registered, controlling, cached or requested at each of its three
 * checkpoints.
 */
export async function executeNextKilledbygoogleV3WitnessRun(options: {
	lane: Lane;
	pass: 1 | 2;
	laneRoot: string;
	receiptRoot: string;
}): Promise<WitnessRealAppRun> {
	return await executeRun(nextKilledbygoogleV3WitnessSpec(), options.lane, options.pass, {
		...options,
		serviceWorkerPolicy: 'zero',
	});
}

async function zeroServiceWorkerCheckpoint(
	lifecycle: JourneyLifecycle,
	phase: 'before-interactions' | 'after-interactions' | 'after-online-reload',
): Promise<{
	phase: typeof phase;
	state: 'timeout';
	registrations: 0;
	controller: null;
	cacheNames: [];
	workerEvents: [];
}> {
	const telemetry = await lifecycle.serviceWorkerTelemetry(250);
	if (
		telemetry.state !== 'timeout' ||
		telemetry.registration.scriptPath !== null ||
		telemetry.registration.scope !== null ||
		telemetry.registration.installing !== null ||
		telemetry.registration.waiting !== null ||
		telemetry.registration.active !== null ||
		telemetry.controller !== null ||
		telemetry.cacheNames.length !== 0 ||
		telemetry.cacheEntries.length !== 0 ||
		telemetry.workerEvents.length !== 0
	)
		throw new Error('zero-service-worker policy assertion failed');
	return {
		phase,
		state: 'timeout',
		registrations: 0,
		controller: null,
		cacheNames: [],
		workerEvents: [],
	};
}

function reactBoilerplateZeroSwSpec(): AppSpec {
	const canonical = apps.find((candidate) => candidate.app === 'react-boilerplate');
	if (canonical === undefined)
		throw new Error('React Boilerplate canonical Witness specification is absent');
	return {
		...canonical,
		journey: async (context, page, transportEvidence, lifecycle) => {
			if (lifecycle.expectedServiceWorker !== null)
				throw new Error('Zero-SW journey received a service-worker expectation');
			const checkpoints = [
				await zeroServiceWorkerCheckpoint(lifecycle, 'before-interactions'),
			];
			await page.trackEvents('click', 'input', 'change', 'keydown', 'mouseover');
			await page.click('a[href="/features"]');
			await context.expect.page.bodyText(page, { contains: 'Features' });
			await page.click('a[href="/"]');
			await page.click('select');
			await page.press('select', 'd');
			await context.expect.page.bodyText(page, {
				contains: 'Beginnen Sie Ihr nächstes React Projekt in Sekunden',
			});
			await page.hover('#username');
			await page.type('#username', 'octocat');
			await page.press('#username', 'Enter');
			await context.expect.page.bodyText(page, { contains: 'owned-repo' });
			await context.expect.page.bodyText(page, { contains: 'fork-owner/forked-repo' });
			await page.scroll(null, { y: 500 });
			await context.expect.page.outcome(page, {
				events: {
					click: { atLeast: 3 },
					input: { atLeast: 1 },
					change: { atLeast: 1 },
					keydown: { atLeast: 1 },
					mouseover: { atLeast: 1 },
				},
			});
			checkpoints.push(await zeroServiceWorkerCheckpoint(lifecycle, 'after-interactions'));
			await page.reload();
			await context.expect.page.bodyText(page, {
				contains: 'Start your next react project in seconds',
				notContains: 'owned-repo',
			});
			checkpoints.push(await zeroServiceWorkerCheckpoint(lifecycle, 'after-online-reload'));
			await page.type('#username', 'reset-proof');
			await page.press('#username', 'Enter');
			await context.expect.page.bodyText(page, { contains: 'owned-repo' });
			if (transportEvidence.apiUsernames.join(',') !== 'octocat,reset-proof')
				throw new Error('React zero-SW username state did not reset after online reload');
			await clean(context, page, 3);
			return {
				assertions: [
					'feature route',
					'keyboard locale selection',
					'canonical repository payload',
					'online reload and state reset',
					'zero service-worker lifecycle and CacheStorage',
					'clean page',
				],
				offlineEvidence: { state: 'not-applicable' },
				zeroServiceWorker: { checkpoints },
			};
		},
	};
}

export async function executeReactBoilerplateZeroSwWitnessRun(options: {
	lane: Lane;
	pass: 1 | 2;
	laneRoot: string;
	receiptRoot: string;
}): Promise<WitnessRealAppRun> {
	return await executeRun(reactBoilerplateZeroSwSpec(), options.lane, options.pass, {
		...options,
		serviceWorkerPolicy: 'zero',
	});
}

export async function executeNextKilledByGoogleWitnessRun(options: {
	lane: Lane;
	pass: 1 | 2;
	laneRoot: string;
	receiptRoot: string;
	nextPrerenderPayload: NextPrerenderPayloadInput;
}): Promise<WitnessRealAppRun> {
	const app = apps.find((candidate) => candidate.app === 'killedbygoogle');
	if (app === undefined) throw new Error('KilledByGoogle Witness specification is absent');
	return await executeRun(app, options.lane, options.pass, options);
}

async function mutationProof(
	app: 'react-boilerplate' | 'angular-realworld',
): Promise<WitnessMutationProof> {
	const file = join(stageRoot, 'lanes', app, 'migrated/index.html');
	const before = await readFile(file);
	const expectedTitle = app === 'react-boilerplate' ? 'React Boilerplate' : 'Conduit';
	const mutatedTitle =
		app === 'react-boilerplate' ? 'Mutated React Subject' : 'Mutated Angular Subject';
	const mutatedText = before
		.toString('utf8')
		.replace(`<title>${expectedTitle}</title>`, `<title>${mutatedTitle}</title>`);
	if (mutatedText === before.toString('utf8'))
		throw new Error(`${app} exact mutation span is absent`);
	let intendedFailure = false;
	try {
		await writeFile(file, mutatedText);
		const staticServer = await startStaticServer(dirname(file));
		const host = createPlaywrightWitnessHost({ chromiumExecutable });
		const definition = box(`${app}-mutation-red`, async (context) => {
			const page = await context.browser.visit(joinURL(staticServer.origin, '/'));
			await context.expect.page.text(page, 'title', expectedTitle);
		});
		let result: Awaited<ReturnType<typeof runBoxes>>;
		try {
			result = await runBoxes({
				root: dirname(file),
				boxes: [
					{
						file: join(dirname(file), 'versionless-mutation.box.ts'),
						relativeFile: 'versionless-mutation.box.ts',
						exportName: 'default',
						box: definition,
					},
				],
				receiptDir: join(stageRoot, 'witness-receipts', app, 'mutation-red'),
				assertionTimeoutMs: 1_000,
				fileSystem: witnessNodeFileSystem,
				browser: host.browser,
			});
		} finally {
			await staticServer.close();
		}
		staticServer.assertClean();
		intendedFailure =
			result.status === 'failed' &&
			(result.boxes[0]?.error?.message.includes(`expected 'title' to have text`) ?? false);
	} finally {
		await writeFile(file, before);
	}
	if (!intendedFailure || sha256(await readFile(file)) !== sha256(before))
		throw new Error(`${app} mutation did not fail semantically and restore byte-identically`);
	return {
		app,
		failure: 'witness-semantic-assertion',
		intendedFailure: true,
		restoredByteIdentically: true,
	};
}

async function executeRuns(): Promise<WitnessRealAppRun[]> {
	const runs: WitnessRealAppRun[] = [];
	for (const app of apps)
		for (const lane of ['baseline', 'migrated'] as const)
			for (const pass of [1, 2] as const) runs.push(await executeRun(app, lane, pass));
	return runs;
}

type ReactBaselineDifferentialProfile = {
	profile: 'current-witness' | 'canonical-t060';
	telemetry: ServiceWorkerTelemetry;
	events: WitnessDifferentialEvent[];
	staticLedger: StaticResponseLedgerEntry[];
	observerFinalization: ReturnType<PlaywrightWitnessHost['serviceWorkerObserverFinalization']>;
};

async function runReactBaselineDifferentialProfile(
	profile: ReactBaselineDifferentialProfile['profile'],
): Promise<ReactBaselineDifferentialProfile> {
	const app = apps[0]!;
	const laneRoot = join(stageRoot, 'lanes', 'react-boilerplate', 'baseline');
	const events: WitnessDifferentialEvent[] = [];
	const recordEvent = (
		event:
			| WitnessDifferentialEvent
			| Omit<WitnessDifferentialEvent, 'sequence' | 'timestampMs'>,
	): void => {
		events.push({
			...event,
			sequence: events.length,
			timestampMs: 'timestampMs' in event ? event.timestampMs : Date.now(),
		});
	};
	for (const asset of BASELINE_REACT_MAIN_ASSETS)
		recordEvent({
			source: 'manifest',
			phase: 'constructed',
			urlPath: `${asset.pathname}${BASELINE_REACT_CACHE_BUST_QUERY}`,
			detail: { cacheMode: 'default', credentials: 'same-origin', mode: 'cors' },
		});
	const staticServer = await startStaticServer(laneRoot, {
		profile,
		diagnosticEvent: recordEvent,
	});
	const productionUrl = joinURL(staticServer.origin, '/');
	const transportEvidence: JourneyTransportEvidence = { apiUsernames: [] };
	const expectedServiceWorker = await expectedReactTelemetry(laneRoot, 'baseline');
	const host = createPlaywrightWitnessHost({
		chromiumExecutable,
		contextProfile: profile,
		diagnosticEvent: recordEvent,
		transport: async (request) => await app.transport!(request, transportEvidence),
	});
	let telemetry: ServiceWorkerTelemetry | undefined;
	const definition = box(`react-baseline-differential-${profile}`, async (context) => {
		const page = await context.browser.visit(productionUrl);
		if (profile === 'current-witness') {
			const journey = await app.journey(context, page, transportEvidence, {
				lane: 'baseline',
				serviceWorkerTelemetry: host.serviceWorkerTelemetry,
				staticRequests: staticServer.requests,
				expectedServiceWorker,
				phonecatOrdering: null,
				phonecatImages: null,
				viewportScroll: host.viewportScroll,
				expectedConsoleErrors: 0,
				expectedFailedRequests: 0,
				// This differential lane declares no cancelled-duplicate
				// category, so there is nothing for it to admit.
				admittedCancelledDuplicateFetches: () => 0,
				// It declares no rendered-style probes either, and refusing
				// here is the point: a lane that measured nothing must not be
				// able to return an empty measurement that reads as agreement.
				renderedStyles: () => {
					throw new Error(
						'react baseline differential lane declares no rendered-style probes',
					);
				},
				// The same refusal, for the same reason: this lane exists to
				// diagnose a service worker, and a reading it never took must
				// not be able to come back as an empty measurement.
				groupedText: () => {
					throw new Error(
						'react baseline differential lane takes no grouped-text readings',
					);
				},
				browserStorageKeys: host.browserStorageKeys,
				// This lane declares neither opt-in, so both mechanisms refuse
				// exactly as they do for every application that declares none.
				loadFileInput: host.loadFileInput,
				capturedDownloads: host.capturedDownloads,
			});
			telemetry =
				journey.timeoutTelemetry ??
				(journey.offlineEvidence.state === 'react-shell-rendered-state-reset'
					? (journey.offlineEvidence.lifecycle.controlled as ServiceWorkerTelemetry)
					: undefined);
		} else {
			telemetry = await host.serviceWorkerTelemetry(10_000);
			if (telemetry.state === 'ready') {
				await page.reload();
				telemetry = await host.serviceWorkerTelemetry(10_000);
			}
		}
		await context.receipt.capture('differential-complete');
	});
	try {
		const receiptDir = join(stageRoot, 'diagnostic-receipts', profile);
		await rm(receiptDir, { recursive: true, force: true });
		const result = await runBoxes({
			root: laneRoot,
			boxes: [
				{
					file: join(laneRoot, 'versionless-runtime.box.ts'),
					relativeFile: 'versionless-runtime.box.ts',
					exportName: 'default',
					box: definition,
				},
			],
			receiptDir,
			assertionTimeoutMs: 10_000,
			fileSystem: witnessNodeFileSystem,
			browser: host.browser,
			headless: true,
		});
		if (result.status !== 'passed' || telemetry === undefined)
			throw new Error(`React baseline differential ${profile} did not complete`);
	} finally {
		await staticServer.close();
	}
	staticServer.assertClean();
	return {
		profile,
		telemetry,
		events,
		staticLedger: staticServer.ledger(),
		observerFinalization: host.serviceWorkerObserverFinalization(),
	};
}

function firstMissingRootTransition(
	current: ReactBaselineDifferentialProfile,
	canonical: ReactBaselineDifferentialProfile,
): string | null {
	const root = `/${BASELINE_REACT_CACHE_BUST_QUERY}`;
	const transitions = [
		['browser', 'request'],
		['context-route', 'start'],
		['context-route', 'continue'],
		['static-server', 'start'],
		['static-server', 'finish'],
		['browser', 'response'],
	] as const;
	for (const [source, phase] of transitions) {
		const canonicalHas = canonical.events.some(
			(event) => event.source === source && event.phase === phase && event.urlPath === root,
		);
		const currentHas = current.events.some(
			(event) => event.source === source && event.phase === phase && event.urlPath === root,
		);
		if (canonicalHas && !currentHas) return `${source}:${phase}`;
	}
	return null;
}

export async function diagnoseReactBaselineServiceWorker(): Promise<void> {
	if (process.env.VERSIONLESS_NETWORK_MODE !== 'offline')
		throw new Error('React baseline differential requires VERSIONLESS_NETWORK_MODE=offline');
	const provenance = await verifyLinkedWitnessProvenance(root);
	await stageInputs();
	const diagnosticDirectory = join(stageRoot, 'diagnostics');
	await rm(diagnosticDirectory, { recursive: true, force: true });
	await mkdir(diagnosticDirectory, { recursive: true });
	const canonical = await runReactBaselineDifferentialProfile('canonical-t060');
	const current = await runReactBaselineDifferentialProfile('current-witness');
	const firstMissingTransition = firstMissingRootTransition(current, canonical);
	const canonicalReceipt = JSON.parse(
		await readFile(
			join(root, 'evidence/runs/react-boilerplate-v4-composed/t060-run.json'),
			'utf8',
		),
	) as { environment?: { browser?: { chromium?: string; playwright?: string } } };
	const diagnostic = {
		schemaVersion: 'versionless.witness-react-baseline-differential.v1',
		result: firstMissingTransition === null ? 'unsupported-unidentified' : 'identified',
		firstMissingTransition,
		manifestMainUrls: BASELINE_REACT_MAIN_ASSETS.map(
			(asset) => `${asset.pathname}${BASELINE_REACT_CACHE_BUST_QUERY}`,
		),
		environment: {
			chromium: canonicalReceipt.environment?.browser?.chromium ?? 'unknown',
			playwright: canonicalReceipt.environment?.browser?.playwright ?? 'unknown',
			linkedWitnessCommit: provenance.commit,
			workerSha256: sha256(
				await readFile(join(stageRoot, 'lanes/react-boilerplate/baseline/sw.js')),
			),
		},
		canonical,
		current,
	};
	await writeFile(
		join(diagnosticDirectory, 'react-boilerplate-baseline-differential.json'),
		`${canonicalize(diagnostic)}\n`,
	);
	process.stdout.write(
		`${canonicalize({ result: diagnostic.result, firstMissingTransition })}\n`,
	);
}

export async function runWitnessRealApps(output: string): Promise<WitnessRealAppReceipt> {
	if (process.env.VERSIONLESS_NETWORK_MODE !== 'offline')
		throw new Error('real-app Witness run requires VERSIONLESS_NETWORK_MODE=offline');
	const provenance = await verifyLinkedWitnessProvenance(root);
	const canonicalReceipts = await bindCanonicalReceipts();
	const killedByGoogleInventory = await stageInputs();
	await rm(join(stageRoot, 'diagnostics'), { recursive: true, force: true });
	const runs = await executeRuns();
	const mutations = await Promise.all([
		mutationProof('react-boilerplate'),
		mutationProof('angular-realworld'),
	]);
	const receipt: WitnessRealAppReceipt = {
		schemaVersion: WITNESS_REAL_APP_SCHEMA,
		result: 'pass',
		provenance,
		canonicalReceipts,
		runs,
		mutations,
		killedByGoogleInventory,
		locality: { mode: 'offline', successfulNonLoopback: 0, osWideIsolation: false },
		nonclaims: [
			'Direct sibling link is local-only and layout-dependent; portable publication is not claimed.',
			'Drag is not-tested; no genuine selected surface exists and no synthetic drag was used.',
			'Non-loopback requests were policy-mocked locally and are not live egress.',
			'React API fulfillment is synthetic and online-only; API caching, Redux persistence and prior-result persistence are not claimed.',
			'React offline evidence proves shell rendering and state reset only; canonical T060 remains the bound service-worker proof and no new service-worker proof is claimed.',
			'Receipts prove reproducibility and hash integrity, not certification, authenticity, signer identity, compliance or OS-wide isolation.',
		],
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	receipt.integrity.canonicalDigest = witnessRealAppDigest(receipt);
	parseWitnessRealAppReceipt(receipt);
	const stagedOutput = join(stageRoot, 'publication');
	await rm(stagedOutput, { recursive: true, force: true });
	await mkdir(stagedOutput, { recursive: true });
	await writeFile(join(stagedOutput, 'receipt.json'), `${canonicalize(receipt)}\n`);
	await rm(output, { recursive: true, force: true });
	await mkdir(resolve(output, '..'), { recursive: true });
	await rename(stagedOutput, output);
	return receipt;
}

export async function verifyWitnessRealApps(output: string): Promise<WitnessRealAppReceipt> {
	await verifyLinkedWitnessProvenance(root);
	const receipt = parseWitnessRealAppReceipt(
		JSON.parse(await readFile(join(output, 'receipt.json'), 'utf8')),
	);
	const current = await bindCanonicalReceipts();
	if (canonicalize(current) !== canonicalize(receipt.canonicalReceipts))
		throw new Error('canonical receipt binding drifted');
	if (
		JSON.stringify(receipt).includes(root) ||
		JSON.stringify(receipt).includes(process.env.USER ?? '')
	)
		throw new Error('Witness real-app receipt leaks host identity');
	return receipt;
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	if (args.length === 1 && args[0] === '--diagnose-react-baseline-service-worker') {
		await diagnoseReactBaselineServiceWorker();
		return;
	}
	if (args.length === 1 && args[0] === '--verify-provenance-only') {
		process.stdout.write(`${canonicalize(await verifyLinkedWitnessProvenance(root))}\n`);
		return;
	}
	const publishIndex = args.indexOf('--publish');
	const verifyIndex = args.indexOf('--verify');
	if (args.includes('--run-twice') && publishIndex >= 0 && args[publishIndex + 1]) {
		const receipt = await runWitnessRealApps(resolve(root, args[publishIndex + 1]!));
		process.stdout.write(
			`${canonicalize({ result: receipt.result, digest: receipt.integrity.canonicalDigest })}\n`,
		);
		return;
	}
	if (verifyIndex >= 0 && args[verifyIndex + 1]) {
		const receipt = await verifyWitnessRealApps(resolve(root, args[verifyIndex + 1]!));
		process.stdout.write(
			`${canonicalize({ result: receipt.result, digest: receipt.integrity.canonicalDigest })}\n`,
		);
		return;
	}
	throw new Error(
		'Witness real-app runner requires --verify-provenance-only, --run-twice --publish <dir>, or --verify <dir>',
	);
}

if (process.argv[1]?.endsWith('real-app-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
