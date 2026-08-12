import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import { sha256 } from '../src/receipts/canonicalize.ts';
import {
	ANGULAR_SUPER_PRODUCTIVITY_APP,
	ANGULAR_SUPER_PRODUCTIVITY_CANONICAL_RECEIPTS,
	ANGULAR_SUPER_PRODUCTIVITY_FIXTURE,
	ANGULAR_SUPER_PRODUCTIVITY_MIGRATED_LANE_CHAIN,
	ANGULAR_SUPER_PRODUCTIVITY_SOURCE,
	assertAngularSuperProductivityBoundBuildReceipt,
	parseWitnessAngularSuperProductivityReceipt,
	renderWitnessAngularSuperProductivityReceipt,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_ACCOMMODATION_PAYLOAD,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_ACCOMMODATIONS,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_DETERMINISM,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_DRAG_SURFACE,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_FONT_SEAM,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_MIGRATION_FINDINGS,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_PERSISTENCE,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_ROUTE_SHAPE,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SASS_RANDOM_BOUNDARY,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SCHEMA,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SEAMS,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SERVICE_WORKER,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_STYLE_DIFFERENCE_RULE,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_STYLE_PROBES,
	witnessAngularSuperProductivityAggregateMember,
	witnessAngularSuperProductivityBehaviorDigest,
	witnessAngularSuperProductivityDigest,
	witnessAngularSuperProductivityRawDigest,
	type WitnessAngularSuperProductivityReceipt,
	type WitnessAngularSuperProductivityRun,
} from '../src/receipts/witness-angular-super-productivity.ts';
import {
	WITNESS_NON_LOOPBACK_QUERY_FREE_PATH_RULE,
	WITNESS_REAL_APP_DRAG_SURFACES,
	WITNESS_REAL_APP_NAMES,
} from '../src/receipts/witness-real-app.ts';

const root = path.resolve(import.meta.dirname, '../../..');

const digestOf = (label: string): string => sha256(label);

/**
 * A synthetic declared-difference membership. The schema pins the RULE and not
 * the list, because no browser has been driven at this application yet, so the
 * fixture supplies a membership of its own and the tests then check that the
 * rule is enforced in both directions against it.
 */
const DECLARED_DIFFERENCES = [
	{
		label: 'header-icon-button',
		why: 'Angular Material reimplemented the icon button on MDC between 8.2 and 16.2',
	},
];
const DECLARED_DIFFERENCE_LABELS = DECLARED_DIFFERENCES.map((entry) => entry.label);

/** A seam outside the one declared origin, used to drive the rejection it owes. */
const FONT_FILE_SEAM = {
	method: 'GET',
	path: 'https://fonts.gstatic.com/s/roboto/v0/synthetic-not-a-real-font.woff2',
};

const WORKER_EVENTS = [
	{ kind: 'registration', scopePath: '/' },
	{
		kind: 'version',
		scriptPath: '/ngsw-worker.js',
		status: 'activated',
		runningStatus: 'running',
	},
];

function styleProbes(lane: 'baseline' | 'migrated') {
	return WITNESS_ANGULAR_SUPER_PRODUCTIVITY_STYLE_PROBES.map((probe) => ({
		label: probe.label,
		selector: probe.selector,
		width: 240,
		height: 48,
		properties: Object.fromEntries(
			probe.properties.map((property) => [
				property,
				DECLARED_DIFFERENCE_LABELS.includes(probe.label)
					? `${property}-${lane}`
					: `${property}-shared`,
			]),
		),
	}));
}

function telemetry(lane: 'baseline' | 'migrated', phase: string) {
	return {
		state: 'ready',
		registration: {
			scriptPath: '/ngsw-worker.js',
			scope: '/',
			installing: null,
			waiting: null,
			active: 'activated',
		},
		controller: phase === 'before-interactions' ? null : 'activated',
		cacheNames: [`ngsw:/:db:control`, `ngsw:/:1:cache:${lane}`],
		cacheEntries: [],
		workerEvents: WORKER_EVENTS,
	};
}

function run(lane: 'baseline' | 'migrated', pass: 1 | 2): WitnessAngularSuperProductivityRun {
	const seams = [...WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SEAMS];
	const draft = {
		app: ANGULAR_SUPER_PRODUCTIVITY_APP,
		framework: 'angular',
		lane,
		pass,
		result: 'pass',
		interactions: [
			{ kind: 'click', selector: '#fixture' },
			{ kind: 'type', selector: '#fixture' },
			{ kind: 'drag', selector: 'task-list task' },
		],
		assertions: ['the created task is listed', 'the reordered task list settled'],
		routes: ['/#/work-view', '#/config', '#/daily-summary/2019-12-05'],
		trackedEvents: ['click', 'input'],
		witnessRecord: {
			interactions: [
				{ kind: 'click', selector: '#fixture' },
				{ kind: 'type', selector: '#fixture' },
				{ kind: 'drag', selector: 'task-list task' },
			],
			navigationPaths: ['#/work-view'],
			trackedEventCounts: { click: 5, input: 7 },
			consoleErrors: 0,
			pageErrors: 0,
			failedRequests: 0,
		},
		cleanPage: true,
		offlineEvidence: { state: 'not-applicable' },
		servedStatic: {
			transport: 'isolated-bounded-loopback-production-static',
			documentFallback: 'index-only',
			missingAssets: '404',
			traversal: 'rejected',
			inventory: {
				files: lane === 'baseline' ? 64 : 62,
				beforeSha256: digestOf(`inventory-${lane}`),
				afterSha256: digestOf(`inventory-${lane}`),
			},
			application: {
				path: 'index.html',
				beforeSha256: digestOf(`index-${lane}`),
				afterSha256: digestOf(`index-${lane}`),
			},
			serviceWorkers: [
				{
					path: 'ngsw-worker.js',
					beforeSha256: digestOf(`ngsw-${lane}`),
					afterSha256: digestOf(`ngsw-${lane}`),
				},
				{
					path: 'safety-worker.js',
					beforeSha256: digestOf(`safety-${lane}`),
					afterSha256: digestOf(`safety-${lane}`),
				},
			],
			byteIdentical: true,
			hmrControls: false,
			legacyMainPrecache: { state: 'not-applicable' },
			phonecatOrdering: { state: 'not-applicable' },
			phonecatImageTransition: { state: 'not-applicable' },
		},
		observerFinalization: {
			state: 'target-closed',
			detach: 'owned-detach-complete',
			pageClose: 'owned-page-close-complete',
			workerEvents: WORKER_EVENTS,
		},
		serviceWorker: {
			script: '/ngsw-worker.js',
			checkpoints: WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SERVICE_WORKER.checkpointPhases.map(
				(phase) => ({ phase, telemetry: telemetry(lane, phase) }),
			),
			outputFiles: [
				{
					path: 'ngsw-worker.js',
					beforeSha256: digestOf(`ngsw-${lane}`),
					afterSha256: digestOf(`ngsw-${lane}`),
				},
				{
					path: 'safety-worker.js',
					beforeSha256: digestOf(`safety-${lane}`),
					afterSha256: digestOf(`safety-${lane}`),
				},
			],
			workerEvents: WORKER_EVENTS,
		},
		successfulNonLoopback: 0,
		consoleErrorInventory: {
			policy: 'exact-app-scoped-expected-console-errors',
			originPlaceholder: '{production-static-origin}',
			expected: [],
			observed: [],
			outsideInventory: [],
			total: 0,
		},
		failedRequestInventory: {
			policy: 'exact-app-scoped-expected-failed-requests',
			expected: [],
			observed: [],
			outsideInventory: [],
			total: 0,
		},
		mockedNonLoopbackSeams: {
			policy: 'exact-app-scoped-mocked-non-loopback-seams',
			pathPolicy: WITNESS_NON_LOOPBACK_QUERY_FREE_PATH_RULE,
			category: seams,
			observed: seams.map((seam) => ({ ...seam, requests: 1, statuses: [200] })),
			absent: [],
			outsideInventory: [],
			successfulNonLoopback: 0,
		},
		renderedStyles: { state: 'measured-resolved-styles', probes: styleProbes(lane) },
		applicationJourney: {
			typeface: {
				state: 'measured-typeface-degradation',
				cause: 'roboto-stylesheet-answered-in-context-so-no-font-face-rule-reaches-the-page',
				fontFaceDeclared: false,
				resolvedFontFamily: 'Helvetica Neue, sans-serif',
				masked: false,
			},
			persistence: {
				store: WITNESS_ANGULAR_SUPER_PRODUCTIVITY_PERSISTENCE.store,
				databaseName: 'SUP',
				storeName: 'SUP_STORE',
				backend: 'none',
				stubbed: false,
				driverInUse: 'asyncStorage',
				keysBeforeJourney: [],
				keysAfterJourney: ['SUP_GLOBAL_CFG', 'TASKS_STATE'],
				localStorageKeysBeforeJourney: [],
				localStorageKeysAfterJourney: ['SUP_LAST_ACTIVE'],
				survivesOnlineReload: true,
			},
			drag: {
				state: 'measured-task-list-reorder',
				surface: ANGULAR_SUPER_PRODUCTIVITY_APP,
				pointer: 'genuine-dragula-pointer-down-move-up',
				movedTask: 'Witness task alpha',
				renderedOrderBefore: ['Witness task alpha', 'Witness task beta', 'Witness task gamma'],
				renderedOrderAfter: ['Witness task beta', 'Witness task alpha', 'Witness task gamma'],
				storeOrderAfter: ['Witness task beta', 'Witness task alpha', 'Witness task gamma'],
			},
			timeTracking: {
				state: 'measured-task-time-tracking',
				control: 'main-header .play-btn mat-icon',
				iconBeforeStart: 'play_arrow',
				iconAfterStart: 'pause',
				iconAfterStop: 'play_arrow',
				currentTasksOnStart: 1,
				currentTasksOnStop: 0,
			},
		},
		scroll: {
			state: 'measured-genuine-viewport-scroll',
			route: '#/work-view',
			viewport: { width: 1280, height: 720 },
			scrollHeight: 1840,
			clientHeight: 720,
			wheelDeltaY: 400,
			scrolledFromTop: true,
			scrolled: true,
		},
		semanticDigest: '',
		behaviorDigest: '',
	} as unknown as WitnessAngularSuperProductivityRun;
	draft.semanticDigest = witnessAngularSuperProductivityRawDigest(draft);
	draft.behaviorDigest = witnessAngularSuperProductivityBehaviorDigest(
		draft,
		DECLARED_DIFFERENCE_LABELS,
	);
	return draft;
}

function fixture(): WitnessAngularSuperProductivityReceipt {
	const runs = [run('baseline', 1), run('baseline', 2), run('migrated', 1), run('migrated', 2)];
	const parity = (lane: 'baseline' | 'migrated') => {
		const source = runs.find((candidate) => candidate.lane === lane)!;
		const final = source.serviceWorker.checkpoints.at(-1)!;
		return {
			registeredScriptPath: final.telemetry.registration.scriptPath!,
			scope: final.telemetry.registration.scope!,
			activeAtFinalCheckpoint: final.telemetry.registration.active!,
			controlledAtFinalCheckpoint: final.telemetry.controller !== null,
			cacheNames: final.telemetry.cacheNames,
		};
	};
	const receipt = {
		schemaVersion: WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SCHEMA,
		result: 'pass',
		fixture: ANGULAR_SUPER_PRODUCTIVITY_FIXTURE,
		source: ANGULAR_SUPER_PRODUCTIVITY_SOURCE,
		provenance: { unit: 'synthetic-round-trip' },
		canonicalReceipts: structuredClone([...ANGULAR_SUPER_PRODUCTIVITY_CANONICAL_RECEIPTS]),
		determinism: structuredClone(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_DETERMINISM),
		sassRandomBoundary: structuredClone(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SASS_RANDOM_BOUNDARY),
		runs,
		mutation: {
			failure: 'witness-semantic-assertion',
			intendedFailure: true,
			lane: 'migrated',
			seam: 'the task the work view lists after the journey created it',
			path: 'dist-25/main.389e30ec3e83a786.js',
			offset: 4096,
			beforeSha256: digestOf('before'),
			mutatedSha256: digestOf('mutated'),
			afterRestoreSha256: digestOf('before'),
			restoredByteIdentically: true,
			restoredRun: 'pass',
			restoredBehaviorDigest: runs[0]!.behaviorDigest,
		},
		consoleErrors: { baseline: [], migrated: [] },
		failedRequests: { baseline: [], migrated: [] },
		mockedSeams: {
			baseline: [...WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SEAMS],
			migrated: [...WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SEAMS],
		},
		fontSeam: structuredClone(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_FONT_SEAM),
		serviceWorker: structuredClone(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SERVICE_WORKER),
		serviceWorkerParity: { baseline: parity('baseline'), migrated: parity('migrated') },
		migratedLaneChain: structuredClone([...ANGULAR_SUPER_PRODUCTIVITY_MIGRATED_LANE_CHAIN]),
		migrationFindings: structuredClone([...WITNESS_ANGULAR_SUPER_PRODUCTIVITY_MIGRATION_FINDINGS]),
		typefaceDegradations: {
			baseline: runs[0]!.applicationJourney.typeface,
			migrated: runs[2]!.applicationJourney.typeface,
		},
		renderedStyleParity: {
			state: 'measured-resolved-styles-with-declared-differences',
			probes: WITNESS_ANGULAR_SUPER_PRODUCTIVITY_STYLE_PROBES.length,
			rule: WITNESS_ANGULAR_SUPER_PRODUCTIVITY_STYLE_DIFFERENCE_RULE,
			declaredDifferences: structuredClone(DECLARED_DIFFERENCES),
			otherProbesAgree: true,
		},
		persistence: structuredClone(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_PERSISTENCE),
		routeShape: structuredClone(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_ROUTE_SHAPE),
		scroll: structuredClone(runs[0]!.scroll),
		accommodations: structuredClone(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_ACCOMMODATIONS),
		accommodationPayload: structuredClone(
			WITNESS_ANGULAR_SUPER_PRODUCTIVITY_ACCOMMODATION_PAYLOAD,
		),
		dragSurface: structuredClone(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_DRAG_SURFACE),
		readiness: {
			angularLineage: { ready: 1, total: 4, counted: false },
			overall: { ready: 3, total: 12 },
		},
		locality: {
			mode: 'offline',
			successfulNonLoopback: 0,
			osWideIsolation: false,
			mockedNonLoopbackSeams: WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SEAMS.length,
		},
		nonclaims: [
			'This receipt records a browser proof of one application over two build lanes. It establishes nothing about any other application, and nothing about the Electron sidecar this repository also ships.',
		],
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	} as unknown as WitnessAngularSuperProductivityReceipt;
	receipt.integrity.canonicalDigest = witnessAngularSuperProductivityDigest(receipt);
	return receipt;
}

describe('Angular Super Productivity Witness receipt', () => {
	it('is admitted to the closed real-app list as an Angular vertical and to the drag list', () => {
		expect(WITNESS_REAL_APP_NAMES).toContain(ANGULAR_SUPER_PRODUCTIVITY_APP);
		expect(WITNESS_REAL_APP_DRAG_SURFACES as readonly string[]).toContain(
			ANGULAR_SUPER_PRODUCTIVITY_APP,
		);
		// jira-clone and super-productivity are the two members of the closed list.
		expect(WITNESS_REAL_APP_DRAG_SURFACES).toHaveLength(2);
		expect(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_DRAG_SURFACE.state).toBe(
			'member-of-the-closed-drag-surface-list',
		);
		expect(fixture().runs.every((entry) => entry.framework === 'angular')).toBe(true);
	});

	it('accepts a well-formed receipt and round-trips its digest', () => {
		const receipt = parseWitnessAngularSuperProductivityReceipt(fixture());
		expect(receipt.integrity.canonicalDigest).toBe(
			witnessAngularSuperProductivityDigest(receipt),
		);
		expect(new Set(receipt.runs.map((entry) => entry.behaviorDigest)).size).toBe(1);
		expect(witnessAngularSuperProductivityAggregateMember(receipt.integrity.canonicalDigest)).toMatchObject(
			{ framework: 'angular', result: 'pass' },
		);
		expect(renderWitnessAngularSuperProductivityReceipt(receipt)).toContain(
			'Super Productivity v2.13.15',
		);
	});

	it('rejects a rebound source, build lane or determinism record', () => {
		// The published constants are frozen, and their receipt fields inherit that
		// readonly-ness by type. Reaching past it is exactly what these cases are
		// for: what is under test is that the parser rejects a rebinding, not that
		// the compiler makes one awkward to write.
		const loosen = (value: unknown): Record<string, unknown> =>
			value as Record<string, unknown>;
		for (const mutate of [
			(receipt: WitnessAngularSuperProductivityReceipt) => {
				loosen(receipt).source = { ...receipt.source, revision: 'a'.repeat(40) };
			},
			(receipt: WitnessAngularSuperProductivityReceipt) => {
				loosen(receipt.canonicalReceipts[0]).files = 63;
			},
			(receipt: WitnessAngularSuperProductivityReceipt) => {
				loosen(receipt.determinism.migrated).deterministicModuloClock = false;
			},
			(receipt: WitnessAngularSuperProductivityReceipt) => {
				loosen(receipt.sassRandomBoundary).withinRoundDifferences = 1;
			},
		]) {
			const receipt = fixture();
			mutate(receipt);
			receipt.integrity.canonicalDigest = witnessAngularSuperProductivityDigest(receipt);
			expect(() => parseWitnessAngularSuperProductivityReceipt(receipt)).toThrow('binding differs');
		}
	});

	it('rejects a lane whose seam is not the one shared declaration', () => {
		const receipt = fixture();
		const run = receipt.runs.find((entry) => entry.lane === 'migrated')!;
		run.mockedNonLoopbackSeams.category = [FONT_FILE_SEAM];
		run.mockedNonLoopbackSeams.observed = [{ ...FONT_FILE_SEAM, requests: 1, statuses: [200] }];
		receipt.mockedSeams.migrated = [FONT_FILE_SEAM];
		run.semanticDigest = witnessAngularSuperProductivityRawDigest(run);
		run.behaviorDigest = witnessAngularSuperProductivityBehaviorDigest(
			run,
			DECLARED_DIFFERENCE_LABELS,
		);
		receipt.integrity.canonicalDigest = witnessAngularSuperProductivityDigest(receipt);
		expect(() => parseWitnessAngularSuperProductivityReceipt(receipt)).toThrow(
			'mocked seam inventory differs',
		);
	});

	it('rejects a run that refuses the drag it must now record', () => {
		const receipt = fixture();
		const run = receipt.runs[0]!;
		// Strip the earned reorder gesture from the interaction list; a member of the
		// closed drag list that recorded no drag is refusing a surface it must drive.
		run.interactions = run.interactions.filter((interaction) => interaction.kind !== 'drag');
		run.witnessRecord.interactions = run.witnessRecord.interactions.filter(
			(interaction) => interaction.kind !== 'drag',
		);
		run.semanticDigest = witnessAngularSuperProductivityRawDigest(run);
		run.behaviorDigest = witnessAngularSuperProductivityBehaviorDigest(
			run,
			DECLARED_DIFFERENCE_LABELS,
		);
		receipt.integrity.canonicalDigest = witnessAngularSuperProductivityDigest(receipt);
		expect(() => parseWitnessAngularSuperProductivityReceipt(receipt)).toThrow('run differs');
	});

	it('rejects a reorder whose store disagrees with the rendered list', () => {
		const receipt = fixture();
		for (const run of receipt.runs) {
			run.applicationJourney.drag!.storeOrderAfter = [
				...run.applicationJourney.drag!.renderedOrderAfter,
			].reverse();
			run.semanticDigest = witnessAngularSuperProductivityRawDigest(run);
			run.behaviorDigest = witnessAngularSuperProductivityBehaviorDigest(
				run,
				DECLARED_DIFFERENCE_LABELS,
			);
		}
		receipt.integrity.canonicalDigest = witnessAngularSuperProductivityDigest(receipt);
		expect(() => parseWitnessAngularSuperProductivityReceipt(receipt)).toThrow(
			'drag evidence differs',
		);
	});

	it('rejects an after-order that is not a permutation of the order before the move', () => {
		const receipt = fixture();
		for (const run of receipt.runs) {
			const drag = run.applicationJourney.drag!;
			// Drop a task in the move: a reorder may not create or lose one.
			drag.renderedOrderAfter = drag.renderedOrderAfter.slice(0, -1);
			drag.storeOrderAfter = [...drag.renderedOrderAfter];
			run.semanticDigest = witnessAngularSuperProductivityRawDigest(run);
			run.behaviorDigest = witnessAngularSuperProductivityBehaviorDigest(
				run,
				DECLARED_DIFFERENCE_LABELS,
			);
		}
		receipt.integrity.canonicalDigest = witnessAngularSuperProductivityDigest(receipt);
		expect(() => parseWitnessAngularSuperProductivityReceipt(receipt)).toThrow(
			'drag evidence differs',
		);
	});

	it('rejects a time-tracking leg whose icon never flipped', () => {
		const receipt = fixture();
		for (const run of receipt.runs) {
			run.applicationJourney.timeTracking!.iconAfterStart =
				run.applicationJourney.timeTracking!.iconBeforeStart;
			run.semanticDigest = witnessAngularSuperProductivityRawDigest(run);
			run.behaviorDigest = witnessAngularSuperProductivityBehaviorDigest(
				run,
				DECLARED_DIFFERENCE_LABELS,
			);
		}
		receipt.integrity.canonicalDigest = witnessAngularSuperProductivityDigest(receipt);
		expect(() => parseWitnessAngularSuperProductivityReceipt(receipt)).toThrow(
			'time-tracking evidence differs',
		);
	});

	it('rejects a stop that did not return the control icon to rest', () => {
		const receipt = fixture();
		for (const run of receipt.runs) {
			run.applicationJourney.timeTracking!.iconAfterStop = 'pause';
			run.semanticDigest = witnessAngularSuperProductivityRawDigest(run);
			run.behaviorDigest = witnessAngularSuperProductivityBehaviorDigest(
				run,
				DECLARED_DIFFERENCE_LABELS,
			);
		}
		receipt.integrity.canonicalDigest = witnessAngularSuperProductivityDigest(receipt);
		expect(() => parseWitnessAngularSuperProductivityReceipt(receipt)).toThrow(
			'time-tracking evidence differs',
		);
	});

	it('rejects a stop that never cleared the current task', () => {
		const receipt = fixture();
		for (const run of receipt.runs) {
			run.applicationJourney.timeTracking!.currentTasksOnStop = 1;
			run.semanticDigest = witnessAngularSuperProductivityRawDigest(run);
			run.behaviorDigest = witnessAngularSuperProductivityBehaviorDigest(
				run,
				DECLARED_DIFFERENCE_LABELS,
			);
		}
		receipt.integrity.canonicalDigest = witnessAngularSuperProductivityDigest(receipt);
		expect(() => parseWitnessAngularSuperProductivityReceipt(receipt)).toThrow(
			'time-tracking evidence differs',
		);
	});

	it('checks the declared style differences in both directions', () => {
		const stale = fixture();
		for (const entry of stale.runs) {
			const probe = entry.renderedStyles.probes.find(
				(candidate) => candidate.label === DECLARED_DIFFERENCE_LABELS[0],
			)!;
			probe.properties = Object.fromEntries(
				Object.keys(probe.properties).map((property) => [property, `${property}-shared`]),
			);
			entry.semanticDigest = witnessAngularSuperProductivityRawDigest(entry);
			entry.behaviorDigest = witnessAngularSuperProductivityBehaviorDigest(
				entry,
				DECLARED_DIFFERENCE_LABELS,
			);
		}
		stale.integrity.canonicalDigest = witnessAngularSuperProductivityDigest(stale);
		expect(() => parseWitnessAngularSuperProductivityReceipt(stale)).toThrow(
			'declared difference differs',
		);

		const undeclared = fixture();
		undeclared.renderedStyleParity.declaredDifferences = [];
		for (const entry of undeclared.runs) {
			entry.behaviorDigest = witnessAngularSuperProductivityBehaviorDigest(entry, []);
		}
		undeclared.integrity.canonicalDigest = witnessAngularSuperProductivityDigest(undeclared);
		expect(() => parseWitnessAngularSuperProductivityReceipt(undeclared)).toThrow(
			'declared difference differs',
		);
	});

	it('rejects a service-worker record that asserts a registration away', () => {
		for (const [expected, mutate] of [
			[
				'service-worker evidence differs',
				(run: WitnessAngularSuperProductivityRun) => {
					run.serviceWorker.checkpoints = run.serviceWorker.checkpoints.slice(0, 2);
				},
			],
			[
				'service-worker evidence differs',
				(run: WitnessAngularSuperProductivityRun) => {
					for (const checkpoint of run.serviceWorker.checkpoints)
						checkpoint.telemetry.registration.scriptPath = null;
				},
			],
			[
				'service-worker evidence differs',
				(run: WitnessAngularSuperProductivityRun) => {
					run.serviceWorker.outputFiles = [];
				},
			],
			[
				'service-worker evidence differs',
				(run: WitnessAngularSuperProductivityRun) => {
					run.serviceWorker.workerEvents = [];
					run.observerFinalization.workerEvents = [];
				},
			],
		] as const) {
			const receipt = fixture();
			for (const entry of receipt.runs) {
				mutate(entry);
				entry.semanticDigest = witnessAngularSuperProductivityRawDigest(entry);
				entry.behaviorDigest = witnessAngularSuperProductivityBehaviorDigest(
					entry,
					DECLARED_DIFFERENCE_LABELS,
				);
			}
			receipt.integrity.canonicalDigest = witnessAngularSuperProductivityDigest(receipt);
			expect(() => parseWitnessAngularSuperProductivityReceipt(receipt)).toThrow(expected);
		}
	});

	it('rejects a route the application does not declare and admits its parameterised one', () => {
		const receipt = fixture();
		for (const entry of receipt.runs) {
			entry.routes = ['#/not-a-route'];
			entry.semanticDigest = witnessAngularSuperProductivityRawDigest(entry);
			entry.behaviorDigest = witnessAngularSuperProductivityBehaviorDigest(
				entry,
				DECLARED_DIFFERENCE_LABELS,
			);
		}
		receipt.integrity.canonicalDigest = witnessAngularSuperProductivityDigest(receipt);
		expect(() => parseWitnessAngularSuperProductivityReceipt(receipt)).toThrow(
			'not a declared route',
		);
		expect(
			parseWitnessAngularSuperProductivityReceipt(fixture()).runs[0]!.routes,
		).toContain('#/daily-summary/2019-12-05');
	});

	it('rejects persistence that lost a key or names the wrong store', () => {
		for (const mutate of [
			(run: WitnessAngularSuperProductivityRun) => {
				run.applicationJourney.persistence.keysBeforeJourney = ['TASKS_ARCHIVE'];
			},
			(run: WitnessAngularSuperProductivityRun) => {
				run.applicationJourney.persistence.localStorageKeysAfterJourney = ['unrelated'];
			},
		]) {
			const receipt = fixture();
			for (const entry of receipt.runs) {
				mutate(entry);
				entry.semanticDigest = witnessAngularSuperProductivityRawDigest(entry);
				entry.behaviorDigest = witnessAngularSuperProductivityBehaviorDigest(
					entry,
					DECLARED_DIFFERENCE_LABELS,
				);
			}
			receipt.integrity.canonicalDigest = witnessAngularSuperProductivityDigest(receipt);
			expect(() => parseWitnessAngularSuperProductivityReceipt(receipt)).toThrow(
				'persistence evidence differs',
			);
		}
	});

	it('accepts a measured scroll absence as readily as a measured scroll', () => {
		const receipt = fixture();
		const absence = {
			state: 'measured-no-overflowing-document',
			viewport: { width: 1280, height: 720 },
			routes: [{ route: '#/work-view', scrollHeight: 720, clientHeight: 720 }],
			documentOverflow: 'the application pins its drawer container to the viewport',
			claimed: false,
		};
		for (const entry of receipt.runs) {
			entry.scroll = structuredClone(absence) as WitnessAngularSuperProductivityRun['scroll'];
			entry.semanticDigest = witnessAngularSuperProductivityRawDigest(entry);
			entry.behaviorDigest = witnessAngularSuperProductivityBehaviorDigest(
				entry,
				DECLARED_DIFFERENCE_LABELS,
			);
		}
		receipt.scroll = structuredClone(absence) as WitnessAngularSuperProductivityRun['scroll'];
		receipt.mutation.restoredBehaviorDigest = receipt.runs[0]!.behaviorDigest;
		receipt.integrity.canonicalDigest = witnessAngularSuperProductivityDigest(receipt);
		expect(parseWitnessAngularSuperProductivityReceipt(receipt).scroll.state).toBe(
			'measured-no-overflowing-document',
		);
	});

	it('rejects a scroll claim the measurement does not support', () => {
		const receipt = fixture();
		for (const entry of receipt.runs) {
			if (entry.scroll.state !== 'measured-genuine-viewport-scroll') throw new Error();
			entry.scroll.scrollHeight = entry.scroll.clientHeight;
			entry.semanticDigest = witnessAngularSuperProductivityRawDigest(entry);
			entry.behaviorDigest = witnessAngularSuperProductivityBehaviorDigest(
				entry,
				DECLARED_DIFFERENCE_LABELS,
			);
		}
		receipt.integrity.canonicalDigest = witnessAngularSuperProductivityDigest(receipt);
		expect(() => parseWitnessAngularSuperProductivityReceipt(receipt)).toThrow(
			'scroll surface differs',
		);
	});

	it('binds the era digest correction and the dist-25 rebind lane by their exact bytes', async () => {
		expect(ANGULAR_SUPER_PRODUCTIVITY_CANONICAL_RECEIPTS).toHaveLength(2);
		for (const bound of ANGULAR_SUPER_PRODUCTIVITY_CANONICAL_RECEIPTS) {
			const bytes = await readFile(path.join(root, bound.path));
			expect(sha256(bytes)).toBe(bound.sha256);
			const parsed = JSON.parse(bytes.toString('utf8')) as Record<string, unknown>;
			expect(parsed.schemaVersion).toBe(bound.schemaVersion);
			expect(parsed.digest).toBe(bound.digest);
			assertAngularSuperProductivityBoundBuildReceipt(bound, parsed);
			expect(() =>
				assertAngularSuperProductivityBoundBuildReceipt(bound, {
					...parsed,
					digest: 'f'.repeat(64),
				}),
			).toThrow('identity differs');
		}
	});

	it('ends the migrated lane chain at the lane it serves', () => {
		const chain = ANGULAR_SUPER_PRODUCTIVITY_MIGRATED_LANE_CHAIN;
		expect(chain).toHaveLength(3);
		expect(chain.at(-1)!.contradictedBy).toBeNull();
		expect(chain.at(-1)!.record).toBe(
			ANGULAR_SUPER_PRODUCTIVITY_CANONICAL_RECEIPTS.find((bound) => bound.lane === 'migrated')!
				.path,
		);
		// Every superseded link in the chain names what its successor could not see.
		for (const link of chain.slice(0, -1)) expect(link.contradictedBy).not.toBeNull();
	});

	it('binds the one accommodation payload the inventory names', async () => {
		const payload = await readFile(
			path.join(root, WITNESS_ANGULAR_SUPER_PRODUCTIVITY_ACCOMMODATION_PAYLOAD.path),
		);
		expect(sha256(payload)).toBe(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_ACCOMMODATION_PAYLOAD.sha256);
		expect(payload.length).toBe(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_ACCOMMODATION_PAYLOAD.bytes);
		expect(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_ACCOMMODATIONS.manualMigrationSteps).toBe(19);
		expect(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_ACCOMMODATIONS.distinctDecisions).toBe(8);
		expect(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_ACCOMMODATIONS.families).toHaveLength(5);
		expect(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_ACCOMMODATIONS.payloadFiles).toBe(1);
	});

	it('carries every migration finding with the record it was measured in', () => {
		expect(WITNESS_ANGULAR_SUPER_PRODUCTIVITY_MIGRATION_FINDINGS.length).toBeGreaterThan(0);
		for (const finding of WITNESS_ANGULAR_SUPER_PRODUCTIVITY_MIGRATION_FINDINGS)
			expect(finding.record).toMatch(/^evidence\/runs\/angular-super-productivity-v2-13-15\//);
	});
});
