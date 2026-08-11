import { describe, expect, it } from 'vitest';
import { canonicalize } from '../src/receipts/canonicalize.ts';
import {
	ANGULAR_JIRA_CLONE_CANONICAL_RECEIPTS,
	ANGULAR_JIRA_CLONE_FIXTURE,
	ANGULAR_JIRA_CLONE_SOURCE,
	parseWitnessAngularJiraCloneReceipt,
	renderWitnessAngularJiraCloneReceipt,
	WITNESS_ANGULAR_JIRA_CLONE_CANCELLED_DUPLICATE_FETCHES,
	WITNESS_ANGULAR_JIRA_CLONE_CONSOLE_ERRORS,
	WITNESS_ANGULAR_JIRA_CLONE_FAILED_REQUESTS,
	WITNESS_ANGULAR_JIRA_CLONE_FILTER_NARROWED,
	WITNESS_ANGULAR_JIRA_CLONE_FILTER_TERM,
	WITNESS_ANGULAR_JIRA_CLONE_MOCKED_SEAMS,
	WITNESS_ANGULAR_JIRA_CLONE_ROUTES,
	WITNESS_ANGULAR_JIRA_CLONE_SCHEMA,
	WITNESS_ANGULAR_JIRA_CLONE_SERVICE_WORKER,
	WITNESS_ANGULAR_JIRA_CLONE_STYLE_PROBES,
	WITNESS_ANGULAR_JIRA_CLONE_TOOLTIP,
	witnessAngularJiraCloneAggregateMember,
	witnessAngularJiraCloneBehaviorDigest,
	witnessAngularJiraCloneDigest,
	witnessAngularJiraCloneRawDigest,
	type WitnessAngularJiraCloneBoardEvidence,
	type WitnessAngularJiraCloneReceipt,
	type WitnessAngularJiraCloneRun,
} from '../src/receipts/witness-angular-jira-clone.ts';
import {
	WITNESS_CANCELLED_DUPLICATE_FETCH_NON_LOOPBACK_SCOPE,
	WITNESS_CANCELLED_DUPLICATE_FETCH_RULE,
	WITNESS_NON_LOOPBACK_QUERY_FREE_PATH_RULE,
	WITNESS_REAL_APP_DRAG_SURFACES,
} from '../src/receipts/witness-real-app.ts';

/**
 * A structurally complete receipt in exactly the shape the browser proof will
 * publish, assembled here so the schema is exercised before any run exists to
 * publish one. Nothing in it is presented as a measurement: the digests are
 * computed by the same functions the verifier uses, and every test below either
 * confirms the shape the schema requires or breaks one field and requires the
 * schema to notice.
 */
const SEED_BOARD = [
	{ column: 'Backlog', issues: ['SEED-1', 'SEED-2', 'SEED-3'] },
	{ column: 'Selected for development', issues: ['SEED-4'] },
	{ column: 'In progress', issues: ['SEED-5'] },
	{ column: 'Done', issues: ['SEED-6'] },
];

const DRAGGED_BOARD = [
	{ column: 'Backlog', issues: ['SEED-2', 'SEED-3'] },
	{ column: 'Selected for development', issues: ['SEED-1', 'SEED-4'] },
	{ column: 'In progress', issues: ['SEED-5'] },
	{ column: 'Done', issues: ['SEED-6'] },
];

const boardEvidence = (): WitnessAngularJiraCloneBoardEvidence => ({
	drag: {
		state: 'measured-genuine-pointer-drag',
		surface: WITNESS_REAL_APP_DRAG_SURFACES[0],
		pointer: 'genuine-pointer-down-move-up',
		issue: 'SEED-1',
		from: { column: 'Backlog', index: 0 },
		to: { column: 'Selected for development', index: 0 },
		before: structuredClone(SEED_BOARD),
		after: structuredClone(DRAGGED_BOARD),
	},
	modalTitleEdit: {
		state: 'measured-modal-round-trip',
		route: '/project/board',
		before: 'SEED-1',
		typed: 'SEED-1 edited by Witness',
		afterReopen: 'SEED-1 edited by Witness',
		descriptionRendering: 'not-claimed',
		descriptionNonclaimReason:
			'the description editor is a Quill surface the driver cannot type into as a person does',
	},
	createIssue: {
		state: 'measured-created-row',
		control: 'navbar-item-3',
		column: 'Backlog',
		rowsBefore: 3,
		rowsAfter: 4,
	},
	filter: {
		state: 'measured-narrow-and-widen',
		term: WITNESS_ANGULAR_JIRA_CLONE_FILTER_TERM,
		beforeFilter: [3, 2, 1, 1],
		narrowed: [...WITNESS_ANGULAR_JIRA_CLONE_FILTER_NARROWED],
		wideningGesture: 'select-all-then-backspace',
		afterClear: [3, 2, 1, 1],
	},
	tooltip: { state: 'measured-hover-tooltip', text: WITNESS_ANGULAR_JIRA_CLONE_TOOLTIP },
	reloadRestore: {
		state: 'measured-seed-board-restored',
		localStorageKeys: [],
		sessionStorageKeys: [],
		backend: 'none',
		survivesOnlineReload: false,
		afterReload: structuredClone(SEED_BOARD),
	},
});

const renderedStyles = () => ({
	state: 'measured-resolved-styles' as const,
	probes: Array.from({ length: WITNESS_ANGULAR_JIRA_CLONE_STYLE_PROBES }, (_unused, index) => ({
		label: `probe-${index + 1}`,
		selector: `.probe-${index + 1}`,
		width: 120 + index,
		height: 32,
		properties: { 'font-size': '14px', color: 'rgb(23, 43, 77)' },
	})),
});

const scrollAbsence = () => ({
	state: 'measured-no-overflowing-document' as const,
	viewport: { width: 1280, height: 720 },
	routes: [
		{ route: '/project/board (loaded)', scrollHeight: 720, clientHeight: 720 },
		{ route: '/project/board (after-reload)', scrollHeight: 720, clientHeight: 720 },
	],
	documentOverflow: 'the application pins the document to the viewport and scrolls inner panels',
	claimed: false as const,
});

const digest = (seed: string): string => seed.padEnd(64, '0').slice(0, 64);

function run(lane: 'baseline' | 'migrated', pass: 1 | 2): WitnessAngularJiraCloneRun {
	const trackedEventCounts = { click: 11, input: 31, keydown: 33, mouseover: 3 };
	const seamCategory = WITNESS_ANGULAR_JIRA_CLONE_MOCKED_SEAMS[lane].map((entry) => ({
		method: entry.method,
		path: entry.path,
	}));
	const cancelledCategory = WITNESS_ANGULAR_JIRA_CLONE_CANCELLED_DUPLICATE_FETCHES[lane].map(
		(entry) => ({ method: entry.method, path: entry.path, reason: entry.reason }),
	);
	const interactions = [
		{ kind: 'click' as const, selector: '.board-issue' },
		{ kind: 'type' as const, selector: '.modal-title' },
		{ kind: 'press' as const, selector: '.filter-input' },
		{ kind: 'hover' as const, selector: '.assignee-avatar' },
		{ kind: 'drag' as const, selector: '.board-issue' },
	];
	const laneDigest = digest(`${lane}-${pass}-`);
	const raw = {
		app: 'angular-jira-clone' as const,
		framework: 'angular' as const,
		lane,
		interactions,
		assertions: ['the dragged issue settles in the target column'],
		routes: ['/project/board', '/project/board', '/project/board'],
		trackedEvents: ['click', 'input', 'keydown', 'mouseover'],
		witnessRecord: {
			interactions,
			navigationPaths: ['/project/board', '/project/board', '/project/board'],
			trackedEventCounts,
			consoleErrors: 0,
			pageErrors: 0,
			failedRequests: 0,
		},
		cleanPage: true as const,
		offlineEvidence: { state: 'not-applicable' as const },
		servedStatic: {
			transport: 'isolated-bounded-loopback-production-static' as const,
			documentFallback: 'index-only' as const,
			missingAssets: '404' as const,
			traversal: 'rejected' as const,
			inventory: { files: 24, beforeSha256: laneDigest, afterSha256: laneDigest },
			application: {
				path: 'index.html' as const,
				beforeSha256: laneDigest,
				afterSha256: laneDigest,
			},
			serviceWorkers: [],
			byteIdentical: true as const,
			hmrControls: false as const,
			legacyMainPrecache: { state: 'not-applicable' as const },
			phonecatOrdering: { state: 'not-applicable' as const },
			phonecatImageTransition: { state: 'not-applicable' as const },
			nextPrerenderPayload: { state: 'not-applicable' as const },
		},
		observerFinalization: {
			state: 'target-closed' as const,
			detach: 'owned-detach-complete' as const,
			pageClose: 'owned-page-close-complete' as const,
			workerEvents: [],
		},
		zeroServiceWorker: {
			checkpoints: (
				['before-interactions', 'after-interactions', 'after-online-reload'] as const
			).map((phase) => ({
				phase,
				state: 'timeout' as const,
				registrations: 0 as const,
				controller: null,
				cacheNames: [] as [],
				workerEvents: [] as [],
			})),
			outputFiles: [] as [],
			requests: [] as [],
			workerEvents: [] as [],
		},
		consoleErrorInventory: {
			policy: 'exact-app-scoped-expected-console-errors' as const,
			originPlaceholder: '{production-static-origin}' as const,
			expected: [],
			observed: [],
			outsideInventory: [] as [],
			total: 0,
		},
		failedRequestInventory: {
			policy: 'exact-app-scoped-expected-failed-requests' as const,
			expected: [],
			observed: [],
			outsideInventory: [] as [],
			total: 0,
		},
		cancelledDuplicateFetches: {
			policy: 'corroborated-browser-cancelled-duplicate-fetch' as const,
			corroborationRule: WITNESS_CANCELLED_DUPLICATE_FETCH_RULE,
			nonLoopbackScope: WITNESS_CANCELLED_DUPLICATE_FETCH_NON_LOOPBACK_SCOPE,
			category: cancelledCategory,
			observed: cancelledCategory.map((entry) => ({
				...entry,
				cancelled: 1,
				corroboratingSuccesses: 2,
				corroboratingStatuses: [200],
			})),
			absent: [],
			uncorroborated: [] as [],
			admitted: 1,
		},
		mockedNonLoopbackSeams: {
			policy: 'exact-app-scoped-mocked-non-loopback-seams' as const,
			pathPolicy: WITNESS_NON_LOOPBACK_QUERY_FREE_PATH_RULE,
			category: seamCategory,
			observed: seamCategory.map((entry) => ({ ...entry, requests: 1, statuses: [200] })),
			absent: [],
			outsideInventory: [] as [],
			successfulNonLoopback: 0 as const,
		},
		renderedStyles: renderedStyles(),
		applicationJourney: boardEvidence(),
		scrollAbsence: scrollAbsence(),
		successfulNonLoopback: 0 as const,
	};
	const withDigests = {
		...raw,
		pass,
		result: 'pass' as const,
		semanticDigest: '',
		behaviorDigest: '',
	} as WitnessAngularJiraCloneRun;
	withDigests.semanticDigest = witnessAngularJiraCloneRawDigest(withDigests);
	withDigests.behaviorDigest = witnessAngularJiraCloneBehaviorDigest(withDigests);
	return withDigests;
}

function receipt(): WitnessAngularJiraCloneReceipt {
	const runs = [
		run('baseline', 1),
		run('baseline', 2),
		run('migrated', 1),
		run('migrated', 2),
	];
	const sealed: WitnessAngularJiraCloneReceipt = {
		schemaVersion: WITNESS_ANGULAR_JIRA_CLONE_SCHEMA,
		result: 'pass',
		fixture: ANGULAR_JIRA_CLONE_FIXTURE,
		source: ANGULAR_JIRA_CLONE_SOURCE,
		provenance: { linked: true },
		canonicalReceipts: ANGULAR_JIRA_CLONE_CANONICAL_RECEIPTS.map((bound) => ({ ...bound })),
		runs,
		mutation: {
			failure: 'witness-semantic-assertion',
			intendedFailure: true,
			lane: 'migrated',
			seam: 'Assignee: ',
			path: 'main.js',
			offset: 4096,
			beforeSha256: digest('before-'),
			mutatedSha256: digest('mutated-'),
			afterRestoreSha256: digest('before-'),
			restoredByteIdentically: true,
			restoredRun: 'pass',
			restoredBehaviorDigest: runs[0]!.behaviorDigest,
		},
		serviceWorker: WITNESS_ANGULAR_JIRA_CLONE_SERVICE_WORKER,
		consoleErrors: WITNESS_ANGULAR_JIRA_CLONE_CONSOLE_ERRORS,
		failedRequests: WITNESS_ANGULAR_JIRA_CLONE_FAILED_REQUESTS,
		mockedNonLoopbackSeams: {
			category: WITNESS_ANGULAR_JIRA_CLONE_MOCKED_SEAMS,
			pathPolicy: WITNESS_NON_LOOPBACK_QUERY_FREE_PATH_RULE,
			instances: runs.map((entry) => ({
				lane: entry.lane,
				pass: entry.pass,
				observed: entry.mockedNonLoopbackSeams.observed,
				absent: entry.mockedNonLoopbackSeams.absent,
			})),
		},
		cancelledDuplicateFetches: {
			category: WITNESS_ANGULAR_JIRA_CLONE_CANCELLED_DUPLICATE_FETCHES,
			corroborationRule: WITNESS_CANCELLED_DUPLICATE_FETCH_RULE,
			nonLoopbackScope: WITNESS_CANCELLED_DUPLICATE_FETCH_NON_LOOPBACK_SCOPE,
			instances: runs.map((entry) => ({
				lane: entry.lane,
				pass: entry.pass,
				observed: entry.cancelledDuplicateFetches.observed,
				absent: entry.cancelledDuplicateFetches.absent,
				admitted: entry.cancelledDuplicateFetches.admitted,
			})),
		},
		renderedStyles: runs[0]!.renderedStyles,
		trackedEvents: runs[0]!.witnessRecord.trackedEventCounts,
		scrollAbsence: scrollAbsence(),
		buildLanes: {
			baseline: {
				angular: '13.2.5',
				builder: '@angular-builders/custom-webpack:browser',
				node: 'v16.20.2',
				distFiles: 24,
			},
			migrated: {
				angular: '16.2',
				builder: '@angular-devkit/build-angular:browser',
				node: 'v16.20.2',
				distFiles: 24,
			},
		},
		persistence: {
			board: 'in-memory-store',
			browserStorage: 'none-written',
			backend: 'none',
			stubbed: false,
			survivesOnlineReload: false,
		},
		readiness: {
			angularLineage: { ready: 1, total: 4, counted: false },
			overall: { ready: 3, total: 12 },
		},
		locality: {
			mode: 'offline',
			successfulNonLoopback: 0,
			mockedNonLoopbackSeams: WITNESS_ANGULAR_JIRA_CLONE_MOCKED_SEAMS.migrated.length,
			osWideIsolation: false,
		},
		nonclaims: ['No generic Angular support or pilot status is established by this record.'],
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	sealed.integrity.canonicalDigest = witnessAngularJiraCloneDigest(sealed);
	return sealed;
}

/**
 * Reseals a tampered receipt as thoroughly as a forger could: every per-run
 * digest is recomputed over the edited content before the receipt digest is
 * sealed, so no test below can be passing because a stale hash caught the edit
 * first. Each one has to be caught by the evidence check it targets.
 */
function resealedDeep(value: WitnessAngularJiraCloneReceipt): WitnessAngularJiraCloneReceipt {
	const copy = structuredClone(value);
	for (const entry of copy.runs) {
		entry.semanticDigest = witnessAngularJiraCloneRawDigest(entry);
		entry.behaviorDigest = witnessAngularJiraCloneBehaviorDigest(entry);
	}
	copy.integrity.canonicalDigest = witnessAngularJiraCloneDigest(copy);
	return copy;
}

describe('Angular jira-clone direct Witness schema', () => {
	it('parses a complete receipt and holds every lane and pass to one behavior digest', () => {
		const parsed = parseWitnessAngularJiraCloneReceipt(receipt());
		expect(parsed.runs).toHaveLength(4);
		expect(new Set(parsed.runs.map((entry) => entry.behaviorDigest)).size).toBe(1);
		expect(parsed.integrity.canonicalDigest).toBe(witnessAngularJiraCloneDigest(parsed));
	});

	it('renders a companion that moves when the receipt does', () => {
		const original = receipt();
		const rendered = renderWitnessAngularJiraCloneReceipt(original);
		expect(rendered).toContain('direct Witness browser proof');
		expect(rendered).toContain(WITNESS_ANGULAR_JIRA_CLONE_ROUTES.join(' → '));
		expect(rendered).toContain(WITNESS_ANGULAR_JIRA_CLONE_TOOLTIP);
		const drifted = structuredClone(original);
		drifted.nonclaims = [...drifted.nonclaims, 'an unrecorded claim'];
		expect(renderWitnessAngularJiraCloneReceipt(drifted)).not.toBe(rendered);
	});

	it('renders a companion that is a function of the published bytes', () => {
		// The tracked-event counts and the resolved style properties are objects
		// whose keys the browser reported in its own order, and canonicalization
		// sorts them. A companion rendered from the in-memory receipt would then
		// disagree with the same companion rendered from the file it accompanies,
		// which is the only form a verifier ever sees. Publishing must render from
		// the round trip, and this is the assertion that says so.
		const original = receipt();
		const reported = { mouseover: 3, keydown: 33, input: 31, click: 11 };
		original.trackedEvents = reported;
		for (const entry of original.runs) entry.witnessRecord.trackedEventCounts = reported;
		const sealed = resealedDeep(original);
		const published = parseWitnessAngularJiraCloneReceipt(JSON.parse(canonicalize(sealed)));
		// The hazard is real: rendering the object the browser filled in and
		// rendering the file it was published as are not the same string.
		expect(renderWitnessAngularJiraCloneReceipt(published)).not.toBe(
			renderWitnessAngularJiraCloneReceipt(sealed),
		);
		// And rendering from the file is stable, which is what makes it the one
		// form a publisher may write and a verifier may check.
		expect(
			renderWitnessAngularJiraCloneReceipt(
				parseWitnessAngularJiraCloneReceipt(JSON.parse(canonicalize(published))),
			),
		).toBe(renderWitnessAngularJiraCloneReceipt(published));
	});

	it('names the aggregate member by the receipt it is bound to', () => {
		const member = witnessAngularJiraCloneAggregateMember(digest('member-'));
		expect(member.id).toBe('witness-angular-jira-clone');
		expect(member.receipt).toBe('evidence/runs/witness-angular-jira-clone/receipt.json');
	});

	it('rejects a resealed receipt whose mutation proof no longer went red', () => {
		const copy = receipt();
		copy.mutation.mutatedSha256 = copy.mutation.beforeSha256;
		expect(() => parseWitnessAngularJiraCloneReceipt(resealedDeep(copy))).toThrow(
			/integrity differs/,
		);
	});

	it('rejects a run whose gestures no longer include the drag this vertical is for', () => {
		const copy = receipt();
		for (const entry of copy.runs)
			entry.interactions = entry.interactions.filter(
				(interaction) => interaction.kind !== 'drag',
			);
		expect(() => parseWitnessAngularJiraCloneReceipt(resealedDeep(copy))).toThrow(
			/Witness run differs/,
		);
	});

	it('rejects a route sequence that a modal quietly pushed to', () => {
		const copy = receipt();
		copy.runs[0]!.routes = [
			'/project/board',
			'/project/board',
			'/project/board/issue/SEED-1',
		];
		expect(() => parseWitnessAngularJiraCloneReceipt(resealedDeep(copy))).toThrow(
			/route sequence differs/,
		);
	});

	it('rejects a route sequence that reintroduces the root as a recorded navigation', () => {
		const copy = receipt();
		copy.runs[0]!.routes = ['/', '/project/board', '/project/board'];
		expect(() => parseWitnessAngularJiraCloneReceipt(resealedDeep(copy))).toThrow(
			/route sequence differs/,
		);
	});

	it('rejects a run that recorded the board route only once, losing the reload', () => {
		const copy = receipt();
		copy.runs[0]!.routes = ['/project/board'];
		expect(() => parseWitnessAngularJiraCloneReceipt(resealedDeep(copy))).toThrow(
			/route sequence differs/,
		);
	});

	it('rejects tracked-event counts that disagree between a run and the published total', () => {
		const copy = receipt();
		copy.runs[3]!.witnessRecord.trackedEventCounts = {
			...copy.runs[3]!.witnessRecord.trackedEventCounts,
			click: 12,
		};
		expect(() => parseWitnessAngularJiraCloneReceipt(resealedDeep(copy))).toThrow(
			/Witness run differs/,
		);
	});
});

describe('Angular jira-clone board journey evidence', () => {
	it('rejects a drag whose board did not actually change', () => {
		const copy = receipt();
		for (const entry of copy.runs)
			entry.applicationJourney.drag.after = structuredClone(SEED_BOARD);
		expect(() => parseWitnessAngularJiraCloneReceipt(resealedDeep(copy))).toThrow(
			/drag evidence differs/,
		);
	});

	it('rejects a drag whose issue never left the column it started in', () => {
		const copy = receipt();
		for (const entry of copy.runs)
			entry.applicationJourney.drag.after = [
				{ column: 'Backlog', issues: ['SEED-1', 'SEED-2', 'SEED-3'] },
				{ column: 'Selected for development', issues: ['SEED-1', 'SEED-4'] },
				{ column: 'In progress', issues: ['SEED-5'] },
				{ column: 'Done', issues: ['SEED-6'] },
			];
		expect(() => parseWitnessAngularJiraCloneReceipt(resealedDeep(copy))).toThrow(
			/drag evidence differs/,
		);
	});

	it('rejects a title edit the modal did not still show after being reopened', () => {
		const copy = receipt();
		for (const entry of copy.runs)
			entry.applicationJourney.modalTitleEdit.afterReopen =
				entry.applicationJourney.modalTitleEdit.before;
		expect(() => parseWitnessAngularJiraCloneReceipt(resealedDeep(copy))).toThrow(
			/modal title-edit evidence differs/,
		);
	});

	it('rejects a description claim this vertical does not make', () => {
		const copy = receipt();
		for (const entry of copy.runs)
			entry.applicationJourney.modalTitleEdit.descriptionRendering =
				'measured' as 'not-claimed';
		expect(() => parseWitnessAngularJiraCloneReceipt(resealedDeep(copy))).toThrow(
			/modal title-edit evidence differs/,
		);
	});

	it('rejects a created issue that added no row', () => {
		const copy = receipt();
		for (const entry of copy.runs) entry.applicationJourney.createIssue.rowsAfter = 3;
		expect(() => parseWitnessAngularJiraCloneReceipt(resealedDeep(copy))).toThrow(
			/create-issue evidence differs/,
		);
	});

	it('rejects a create-issue recorded against the search drawer control', () => {
		const copy = receipt();
		for (const entry of copy.runs)
			entry.applicationJourney.createIssue.control = 'navbar-item-2' as 'navbar-item-3';
		expect(() => parseWitnessAngularJiraCloneReceipt(resealedDeep(copy))).toThrow(
			/create-issue evidence differs/,
		);
	});

	it('rejects a filter that restored something other than what it started from', () => {
		const copy = receipt();
		for (const entry of copy.runs) entry.applicationJourney.filter.afterClear = [3, 2, 1, 0];
		expect(() => parseWitnessAngularJiraCloneReceipt(resealedDeep(copy))).toThrow(
			/filter evidence differs/,
		);
	});

	it('rejects a filter narrowed to a shape other than the measured one', () => {
		const copy = receipt();
		for (const entry of copy.runs) entry.applicationJourney.filter.narrowed = [2, 0, 0, 0];
		expect(() => parseWitnessAngularJiraCloneReceipt(resealedDeep(copy))).toThrow(
			/filter evidence differs/,
		);
	});

	it('rejects a reload that claims the journey state survived it', () => {
		const copy = receipt();
		for (const entry of copy.runs) {
			entry.applicationJourney.reloadRestore.afterReload = structuredClone(DRAGGED_BOARD);
			entry.applicationJourney.reloadRestore.survivesOnlineReload = false;
		}
		expect(() => parseWitnessAngularJiraCloneReceipt(resealedDeep(copy))).toThrow(
			/reload-restore evidence differs/,
		);
	});

	it('rejects a run that wrote to browser storage after claiming it wrote none', () => {
		const copy = receipt();
		for (const entry of copy.runs)
			(
				entry.applicationJourney.reloadRestore as unknown as {
					localStorageKeys: string[];
				}
			).localStorageKeys = ['board'];
		expect(() => parseWitnessAngularJiraCloneReceipt(resealedDeep(copy))).toThrow(
			/reload-restore evidence differs/,
		);
	});
});

describe('Angular jira-clone non-loopback seam evidence', () => {
	it('publishes every declared seam query-free, in both lanes', () => {
		const parsed = parseWitnessAngularJiraCloneReceipt(receipt());
		for (const lane of ['baseline', 'migrated'] as const) {
			const seams = parsed.mockedNonLoopbackSeams.category[lane];
			expect(seams).toHaveLength(10);
			for (const seam of seams) {
				expect(seam.path).not.toContain('?');
				expect(seam.path).not.toContain('#');
			}
		}
	});

	it('declares the two description images the issue modal renders, in both lanes', () => {
		const parsed = parseWitnessAngularJiraCloneReceipt(receipt());
		for (const lane of ['baseline', 'migrated'] as const) {
			const images = parsed.mockedNonLoopbackSeams.category[lane].filter((seam) =>
				seam.path.endsWith('.gif'),
			);
			expect(images.map((seam) => seam.path)).toEqual([
				'https://github.com/trungk18/angular-spotify/raw/main/libs/web/shared/assets/src/assets/readme/angular-spotify-demo-short.gif',
				'https://github.com/trungk18/angular-spotify/raw/main/libs/web/shared/assets/src/assets/readme/angular-spotify-visualization.gif',
			]);
			for (const image of images) expect(image.method).toBe('GET');
		}
	});

	it('accounts for seam identity without pinning how many times a seam was requested', () => {
		// Repeat counts are load timing: the browser may reuse a response it
		// already holds for an image the board renders more than once, so two
		// passes of the same lane can legitimately disagree. Identity is the pin;
		// the count is a measurement, and a receipt that recorded a different one
		// is still a receipt about the same seam.
		const copy = receipt();
		for (const entry of copy.runs)
			for (const observed of entry.mockedNonLoopbackSeams.observed)
				observed.requests = observed.requests + entry.pass;
		expect(() => parseWitnessAngularJiraCloneReceipt(resealedDeep(copy))).not.toThrow();
	});

	it('still rejects a seam observation that claims it was never requested at all', () => {
		const copy = receipt();
		for (const entry of copy.runs)
			for (const observed of entry.mockedNonLoopbackSeams.observed) observed.requests = 0;
		expect(() => parseWitnessAngularJiraCloneReceipt(resealedDeep(copy))).toThrow(
			/mocked non-loopback seam inventory differs/,
		);
	});

	it('rejects a run that dropped one of the description images from its inventory', () => {
		const copy = receipt();
		for (const entry of copy.runs) {
			entry.mockedNonLoopbackSeams.category = entry.mockedNonLoopbackSeams.category.filter(
				(seam) => !seam.path.endsWith('-visualization.gif'),
			);
			entry.mockedNonLoopbackSeams.observed = entry.mockedNonLoopbackSeams.observed.filter(
				(seam) => !seam.path.endsWith('-visualization.gif'),
			);
		}
		expect(() => parseWitnessAngularJiraCloneReceipt(resealedDeep(copy))).toThrow(
			/mocked non-loopback seam inventory differs/,
		);
	});

	it('carries no recorded path with a query anywhere in any inventory of any run', () => {
		const parsed = parseWitnessAngularJiraCloneReceipt(receipt());
		const paths = parsed.runs.flatMap((entry) => [
			...entry.mockedNonLoopbackSeams.category,
			...entry.mockedNonLoopbackSeams.observed,
			...entry.mockedNonLoopbackSeams.absent,
			...entry.cancelledDuplicateFetches.category,
			...entry.cancelledDuplicateFetches.observed,
			...entry.cancelledDuplicateFetches.absent,
			...entry.failedRequestInventory.observed,
		]);
		expect(paths.length).toBeGreaterThan(0);
		for (const entry of paths) expect(entry.path).not.toContain('?');
	});

	it('rejects a seam republished with the query the application actually sent', () => {
		const copy = receipt();
		for (const entry of copy.runs) {
			const seam = entry.mockedNonLoopbackSeams.observed.find(
				(observed) => observed.method === 'POST',
			)!;
			seam.path = `${seam.path}?sentry_key=synthetic-not-a-credential`;
		}
		expect(() => parseWitnessAngularJiraCloneReceipt(resealedDeep(copy))).toThrow(
			/mocked non-loopback seam inventory differs/,
		);
	});

	it('rejects a run that reached a seam nobody declared', () => {
		const copy = receipt();
		for (const entry of copy.runs)
			entry.mockedNonLoopbackSeams.observed = [
				...entry.mockedNonLoopbackSeams.observed,
				{
					method: 'GET',
					path: 'https://undeclared.example.invalid/pixel.gif',
					requests: 1,
					statuses: [200],
				},
			];
		expect(() => parseWitnessAngularJiraCloneReceipt(resealedDeep(copy))).toThrow(
			/mocked non-loopback seam inventory differs/,
		);
	});

	it('rejects a receipt that claims a successful non-loopback request', () => {
		const copy = receipt();
		for (const entry of copy.runs)
			entry.mockedNonLoopbackSeams.successfulNonLoopback = 1 as 0;
		expect(() => parseWitnessAngularJiraCloneReceipt(resealedDeep(copy))).toThrow(
			/mocked non-loopback seam inventory differs/,
		);
	});

	it('rejects a seam roll-up that tells a quieter story than its runs', () => {
		const copy = receipt();
		copy.mockedNonLoopbackSeams.instances[0]!.observed = [];
		expect(() => parseWitnessAngularJiraCloneReceipt(resealedDeep(copy))).toThrow(
			/mocked non-loopback seam roll-up differs/,
		);
	});
});

describe('Angular jira-clone cancelled-duplicate-fetch category', () => {
	it('carries the generic rule and the non-loopback scope that extends it', () => {
		const parsed = parseWitnessAngularJiraCloneReceipt(receipt());
		expect(parsed.cancelledDuplicateFetches.corroborationRule).toBe(
			WITNESS_CANCELLED_DUPLICATE_FETCH_RULE,
		);
		expect(parsed.cancelledDuplicateFetches.nonLoopbackScope).toBe(
			WITNESS_CANCELLED_DUPLICATE_FETCH_NON_LOOPBACK_SCOPE,
		);
		for (const entry of parsed.runs)
			expect(entry.cancelledDuplicateFetches.uncorroborated).toEqual([]);
	});

	it('rejects an instance that claims no corroborating successful request', () => {
		const copy = receipt();
		for (const entry of copy.runs) {
			entry.cancelledDuplicateFetches.observed[0]!.corroboratingSuccesses = 0;
			entry.cancelledDuplicateFetches.observed[0]!.corroboratingStatuses = [];
		}
		for (const instance of copy.cancelledDuplicateFetches.instances)
			instance.observed = copy.runs[0]!.cancelledDuplicateFetches.observed;
		expect(() => parseWitnessAngularJiraCloneReceipt(resealedDeep(copy))).toThrow(
			/cancelled-duplicate-fetch category differs/,
		);
	});

	it('rejects an instance corroborated only by a non-successful answer', () => {
		const copy = receipt();
		for (const entry of copy.runs)
			entry.cancelledDuplicateFetches.observed[0]!.corroboratingStatuses = [429];
		for (const instance of copy.cancelledDuplicateFetches.instances)
			instance.observed = copy.runs[0]!.cancelledDuplicateFetches.observed;
		expect(() => parseWitnessAngularJiraCloneReceipt(resealedDeep(copy))).toThrow(
			/cancelled-duplicate-fetch category differs/,
		);
	});

	it('rejects a run that dropped the scope statement it is relying on', () => {
		const copy = receipt();
		for (const entry of copy.runs)
			delete (entry.cancelledDuplicateFetches as { nonLoopbackScope?: string })
				.nonLoopbackScope;
		expect(() => parseWitnessAngularJiraCloneReceipt(resealedDeep(copy))).toThrow(
			/cancelled-duplicate-fetch category differs/,
		);
	});

	it('rejects a widened category that admits a second endpoint', () => {
		const copy = receipt();
		for (const entry of copy.runs) {
			entry.cancelledDuplicateFetches.category = [
				...entry.cancelledDuplicateFetches.category,
				{
					method: 'GET',
					path: 'https://undeclared.example.invalid/pixel.gif',
					reason: 'net::ERR_ABORTED',
				},
			];
			entry.cancelledDuplicateFetches.absent = [
				{
					method: 'GET',
					path: 'https://undeclared.example.invalid/pixel.gif',
					reason: 'net::ERR_ABORTED',
				},
			];
		}
		expect(() => parseWitnessAngularJiraCloneReceipt(resealedDeep(copy))).toThrow(
			/cancelled-duplicate-fetch category differs/,
		);
	});

	it('still fails a run that left an ordinary failed request behind', () => {
		const copy = receipt();
		copy.runs[0]!.witnessRecord.failedRequests = 1;
		expect(() => parseWitnessAngularJiraCloneReceipt(resealedDeep(copy))).toThrow(
			/Witness run differs/,
		);
	});
});

describe('Angular jira-clone rendered-style evidence', () => {
	it('requires the seven measurements the styling claim rests on', () => {
		const copy = receipt();
		for (const entry of copy.runs)
			entry.renderedStyles.probes = entry.renderedStyles.probes.slice(0, 6);
		copy.renderedStyles = copy.runs[0]!.renderedStyles;
		expect(() => parseWitnessAngularJiraCloneReceipt(resealedDeep(copy))).toThrow(
			/rendered-style evidence differs/,
		);
	});

	it('breaks lane parity when one lane resolved a different value', () => {
		const copy = receipt();
		copy.runs[2]!.renderedStyles.probes[0]!.properties['font-size'] = '15px';
		const resealed = resealedDeep(copy);
		expect(new Set(resealed.runs.map((entry) => entry.behaviorDigest)).size).toBe(2);
		expect(() => parseWitnessAngularJiraCloneReceipt(resealed)).toThrow(/integrity differs/);
	});

	it('rejects a probe that measured an element with no laid-out box', () => {
		const copy = receipt();
		for (const entry of copy.runs) entry.renderedStyles.probes[0]!.height = 0;
		copy.renderedStyles = copy.runs[0]!.renderedStyles;
		expect(() => parseWitnessAngularJiraCloneReceipt(resealedDeep(copy))).toThrow(
			/rendered-style evidence differs/,
		);
	});
});
