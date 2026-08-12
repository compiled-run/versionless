import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import { sha256 } from '../src/receipts/canonicalize.ts';
import {
	ANGULAR_TINY_TRANSLATOR_CANONICAL_RECEIPTS,
	ANGULAR_TINY_TRANSLATOR_MIGRATED_LANE_CHAIN,
	ANGULAR_TINY_TRANSLATOR_SOURCE,
	parseWitnessAngularTinyTranslatorReceipt,
	renderWitnessAngularTinyTranslatorReceipt,
	WITNESS_ANGULAR_TINY_TRANSLATOR_ACCOMMODATIONS,
	WITNESS_ANGULAR_TINY_TRANSLATOR_BASELINE_SEAMS,
	WITNESS_ANGULAR_TINY_TRANSLATOR_DOWNLOAD_SURFACE,
	WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_FIXTURE,
	WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_SURFACES,
	WITNESS_ANGULAR_TINY_TRANSLATOR_FONT_SEAM_DIFFERENCE,
	WITNESS_ANGULAR_TINY_TRANSLATOR_MAT_ICON_DEGRADATIONS,
	WITNESS_ANGULAR_TINY_TRANSLATOR_MIGRATION_FINDINGS,
	WITNESS_ANGULAR_TINY_TRANSLATOR_RECORDED_AMENDMENTS,
	WITNESS_ANGULAR_TINY_TRANSLATOR_ROUTE_SHAPE,
	WITNESS_ANGULAR_TINY_TRANSLATOR_SCHEMA,
	WITNESS_ANGULAR_TINY_TRANSLATOR_SERVICE_WORKER_ATTEMPT,
	WITNESS_ANGULAR_TINY_TRANSLATOR_STYLE_DIFFERENCES,
	WITNESS_ANGULAR_TINY_TRANSLATOR_STYLE_PROBES,
	witnessAngularTinyTranslatorAggregateMember,
	witnessAngularTinyTranslatorBehaviorDigest,
	witnessAngularTinyTranslatorDigest,
	witnessAngularTinyTranslatorRawDigest,
	type WitnessAngularTinyTranslatorReceipt,
	type WitnessAngularTinyTranslatorRun,
} from '../src/receipts/witness-angular-tiny-translator.ts';
import {
	WITNESS_DOWNLOAD_CAPTURE_RULE,
	WITNESS_FILE_INPUT_LOAD_RULE,
	WITNESS_NON_LOOPBACK_QUERY_FREE_PATH_RULE,
	WITNESS_REAL_APP_NAMES,
} from '../src/receipts/witness-real-app.ts';

const root = path.resolve(import.meta.dirname, '../../..');

/**
 * A synthetic member of the migrated lane's seam category, in the shape the
 * font provider's own versioned CDN path has. No such file is fetched by this
 * test and none of these bytes exist; what is under test is that the schema
 * holds the migrated lane to the font-file origin and off the stylesheet one.
 */
const MIGRATED_SEAM = {
	method: 'GET',
	path: 'https://fonts.gstatic.com/s/materialicons/v0/synthetic-not-a-real-font.woff2',
};

const digestOf = (label: string): string => sha256(label);

/**
 * The registration this application attempts and is refused, and the observer
 * trace the refusal leaves behind.
 *
 * The trace is NOT empty, and that is the point of the first recorded
 * amendment: the schema used to require an empty one, and a browser load of
 * either lane contradicts that on every page. Every event here names the script
 * and the scope the application asked for, which is what the schema holds it to.
 */
const ATTEMPT_SCRIPT = '/%BASE_HREF%ngsw-worker.js';
const ATTEMPT_EVENTS = [
	{ kind: 'registration', scopePath: '/' },
	{
		kind: 'version',
		scriptPath: ATTEMPT_SCRIPT,
		status: 'redundant',
		runningStatus: 'stopped',
	},
];

function styleProbes(lane: 'baseline' | 'migrated') {
	return WITNESS_ANGULAR_TINY_TRANSLATOR_STYLE_PROBES.map((probe) => ({
		label: probe.label,
		selector: probe.selector,
		width: 100,
		height: 24,
		properties: Object.fromEntries(
			probe.properties.map((property) => [
				property,
				// The two declared differences differ by lane and everything else
				// resolves identically — which is exactly what the schema checks.
				WITNESS_ANGULAR_TINY_TRANSLATOR_STYLE_DIFFERENCES.some(
					(entry) => entry.label === probe.label,
				)
					? `${property}-${lane}`
					: `${property}-shared`,
			]),
		),
	}));
}

function run(lane: 'baseline' | 'migrated', pass: 1 | 2): WitnessAngularTinyTranslatorRun {
	const degradation = WITNESS_ANGULAR_TINY_TRANSLATOR_MAT_ICON_DEGRADATIONS[lane];
	const seams =
		lane === 'baseline' ? [...WITNESS_ANGULAR_TINY_TRANSLATOR_BASELINE_SEAMS] : [MIGRATED_SEAM];
	const draft = {
		app: 'angular-tiny-translator',
		framework: 'angular',
		lane,
		pass,
		result: 'pass',
		interactions: [
			{ kind: 'click', selector: '#fixture' },
			{ kind: 'type', selector: '#fixture' },
		],
		assertions: ['the created project is listed'],
		routes: ['/#/home', '#/createproject', '#/translate'],
		trackedEvents: ['click', 'input'],
		witnessRecord: {
			interactions: [
				{ kind: 'click', selector: '#fixture' },
				{ kind: 'type', selector: '#fixture' },
			],
			navigationPaths: ['#/home'],
			trackedEventCounts: { click: 4, input: 6 },
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
				files: 524,
				beforeSha256: digestOf('inventory'),
				afterSha256: digestOf('inventory'),
			},
			application: {
				path: 'index.html',
				beforeSha256: digestOf(`index-${lane}`),
				afterSha256: digestOf(`index-${lane}`),
			},
			serviceWorkers: [],
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
			workerEvents: ATTEMPT_EVENTS,
		},
		refusedServiceWorker: {
			attempt: { script: ATTEMPT_SCRIPT, scopePath: '/' },
			checkpoints: (
				['before-interactions', 'after-interactions', 'after-online-reload'] as const
			).map((phase) => ({
				phase,
				state: 'timeout',
				registrations: 0,
				controller: null,
				cacheNames: [],
				attemptEvents: ATTEMPT_EVENTS,
			})),
			outputFiles: [],
			requests: [
				{
					source: 'browser',
					phase: 'requestfailed',
					urlPath: ATTEMPT_SCRIPT,
					detail: { serviceWorker: true, status: 400 },
				},
			],
			workerEvents: ATTEMPT_EVENTS,
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
			observed: seams.map((seam) => ({ ...seam, requests: 2, statuses: [200] })),
			absent: [],
			outsideInventory: [],
			successfulNonLoopback: 0,
		},
		fileInputLoads: {
			policy: 'declared-file-input-surfaces-only',
			rule: WITNESS_FILE_INPUT_LOAD_RULE,
			declared: [...WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_SURFACES],
			loaded: [
				{
					...WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_SURFACES[0]!,
					fileName: WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_FIXTURE.fileName,
					bytes: WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_FIXTURE.bytes,
					sha256: WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_FIXTURE.sha256,
				},
			],
			unused: [],
			outsideDeclaration: [],
		},
		downloadCaptures: {
			policy: 'declared-download-surface-only',
			rule: WITNESS_DOWNLOAD_CAPTURE_RULE,
			acceptDownloads: true,
			captured: [
				{
					suggestedFilename: 'synthetic-messages.xlf',
					bytes: 1170,
					sha256: digestOf('exported'),
				},
			],
		},
		renderedStyles: { state: 'measured-resolved-styles', probes: styleProbes(lane) },
		applicationJourney: {
			matIcon: {
				...degradation,
				resolvedFontFamily: degradation.iconFontFamilyDeclared
					? '"Material Icons"'
					: 'Roboto, "Helvetica Neue", sans-serif',
				renderedText: 'translate',
			},
			fileReaderParity: {
				state: 'measured-identical-parse-across-lanes',
				assertion: 'the three synthetic units parse identically in both lanes',
				parsedUnits: WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_FIXTURE.transUnits,
				parsedDigest: digestOf('parsed-units'),
			},
			persistence: {
				store: 'browser-local-storage',
				service: 'the applications own BackendLocalStorageService behind BackendServiceAPI',
				backend: 'none',
				stubbed: false,
				keysBeforeJourney: [],
				keysAfterJourney: ['tinytranslator.project.1', 'tinytranslator.projects'],
				survivesOnlineReload: true,
			},
		},
		scrollAbsence: {
			state: 'measured-no-overflowing-document',
			viewport: { width: 1280, height: 720 },
			routes: [{ route: '#/home', scrollHeight: 720, clientHeight: 720 }],
			documentOverflow:
				'the application pins its document to the viewport and scrolls its own unit list',
			claimed: false,
		},
		semanticDigest: '',
		behaviorDigest: '',
	} as unknown as WitnessAngularTinyTranslatorRun;
	draft.semanticDigest = witnessAngularTinyTranslatorRawDigest(draft);
	draft.behaviorDigest = witnessAngularTinyTranslatorBehaviorDigest(draft);
	return draft;
}

function fixture(): WitnessAngularTinyTranslatorReceipt {
	const runs = [run('baseline', 1), run('baseline', 2), run('migrated', 1), run('migrated', 2)];
	const receipt = {
		schemaVersion: WITNESS_ANGULAR_TINY_TRANSLATOR_SCHEMA,
		result: 'pass',
		fixture: 'angular-tiny-translator-v0-12-0',
		source: ANGULAR_TINY_TRANSLATOR_SOURCE,
		provenance: { unit: 'synthetic-round-trip' },
		canonicalReceipts: structuredClone([...ANGULAR_TINY_TRANSLATOR_CANONICAL_RECEIPTS]),
		runs,
		mutation: {
			failure: 'witness-semantic-assertion',
			intendedFailure: true,
			lane: 'migrated',
			seam: 'the parsed unit count the file input produced',
			path: 'dist-7/main.js',
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
			baseline: [...WITNESS_ANGULAR_TINY_TRANSLATOR_BASELINE_SEAMS],
			migrated: [MIGRATED_SEAM],
		},
		fontSeamDifference: WITNESS_ANGULAR_TINY_TRANSLATOR_FONT_SEAM_DIFFERENCE,
		serviceWorkerAttempt: WITNESS_ANGULAR_TINY_TRANSLATOR_SERVICE_WORKER_ATTEMPT,
		migratedLaneChain: ANGULAR_TINY_TRANSLATOR_MIGRATED_LANE_CHAIN,
		migrationFindings: WITNESS_ANGULAR_TINY_TRANSLATOR_MIGRATION_FINDINGS,
		amendments: WITNESS_ANGULAR_TINY_TRANSLATOR_RECORDED_AMENDMENTS,
		fileReaderArbitration: {
			state: 'arbitrated-declared-difference',
			obligation: WITNESS_ANGULAR_TINY_TRANSLATOR_ACCOMMODATIONS.journeyObligations[0]!,
			outcome: 'identical-parse-in-both-lanes',
			parsedUnits: runs[0]!.applicationJourney.fileReaderParity.parsedUnits,
			parsedDigest: runs[0]!.applicationJourney.fileReaderParity.parsedDigest,
			inBehaviorDigest: true,
		},
		matIconDegradations: {
			baseline: runs[0]!.applicationJourney.matIcon,
			migrated: runs[2]!.applicationJourney.matIcon,
		},
		renderedStyleParity: {
			state: 'measured-resolved-styles-with-declared-differences',
			probes: WITNESS_ANGULAR_TINY_TRANSLATOR_STYLE_PROBES.length,
			declaredDifferences: WITNESS_ANGULAR_TINY_TRANSLATOR_STYLE_DIFFERENCES,
			otherProbesAgree: true,
		},
		fileInput: {
			surfaces: [...WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_SURFACES],
			fixture: WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_FIXTURE,
			rule: WITNESS_FILE_INPUT_LOAD_RULE,
		},
		downloads: {
			surface: WITNESS_ANGULAR_TINY_TRANSLATOR_DOWNLOAD_SURFACE,
			rule: WITNESS_DOWNLOAD_CAPTURE_RULE,
			captured: runs.map((published) => ({
				lane: published.lane,
				pass: published.pass,
				files: published.downloadCaptures.captured,
			})),
		},
		persistence: {
			store: 'browser-local-storage',
			backend: 'none',
			stubbed: false,
			survivesOnlineReload: true,
		},
		routeShape: WITNESS_ANGULAR_TINY_TRANSLATOR_ROUTE_SHAPE,
		scrollAbsence: runs[0]!.scrollAbsence,
		accommodations: WITNESS_ANGULAR_TINY_TRANSLATOR_ACCOMMODATIONS,
		readiness: {
			angularLineage: { ready: 1, total: 4, counted: false },
			overall: { ready: 3, total: 12 },
		},
		locality: {
			mode: 'offline',
			successfulNonLoopback: 0,
			osWideIsolation: false,
			mockedNonLoopbackSeams: 1,
		},
		nonclaims: ['No claim is made about the four localised build variants; none was built.'],
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	} as unknown as WitnessAngularTinyTranslatorReceipt;
	receipt.integrity.canonicalDigest = witnessAngularTinyTranslatorDigest(receipt);
	return receipt;
}

/**
 * Reseals a tampered receipt as thoroughly as a forger could: every per-run
 * digest is recomputed over the edited content before the receipt digest is
 * sealed, so no test below passes because a stale hash caught the edit first.
 */
function resealedDeep(
	receipt: WitnessAngularTinyTranslatorReceipt,
): WitnessAngularTinyTranslatorReceipt {
	const copy = structuredClone(receipt);
	for (const published of copy.runs) {
		published.semanticDigest = witnessAngularTinyTranslatorRawDigest(published);
		published.behaviorDigest = witnessAngularTinyTranslatorBehaviorDigest(published);
	}
	copy.mutation.restoredBehaviorDigest = copy.runs[0]!.behaviorDigest;
	copy.integrity.canonicalDigest = witnessAngularTinyTranslatorDigest(copy);
	return copy;
}

describe('Angular TinyTranslator direct Witness receipt schema', () => {
	it('round-trips a well-formed receipt and its rendered companion', () => {
		const receipt = parseWitnessAngularTinyTranslatorReceipt(fixture());
		expect(receipt.result).toBe('pass');
		expect(receipt.runs).toHaveLength(4);
		expect(new Set(receipt.runs.map((published) => published.behaviorDigest)).size).toBe(1);
		expect(renderWitnessAngularTinyTranslatorReceipt(receipt)).toContain(
			'TinyTranslator v0.12.0',
		);
		expect(
			witnessAngularTinyTranslatorAggregateMember(receipt.integrity.canonicalDigest),
		).toEqual({
			id: 'witness-angular-tiny-translator',
			framework: 'angular',
			track: 'production-readiness-direct-witness-angular5-to-angular16-browser-builder',
			bundler: 'angular-cli-1.5.4-webpack-3.8.1-to-angular-16.2-browser-builder',
			runtime: 'node-8.9.3-to-node-16.20.2',
			result: 'pass',
			receipt: 'evidence/runs/witness-angular-tiny-translator-v0-12-0/receipt.json',
			digest: receipt.integrity.canonicalDigest,
		});
	});

	it('names the application in the closed corpus list', () => {
		expect(WITNESS_REAL_APP_NAMES).toContain('angular-tiny-translator');
	});

	it('binds each lane to one canonical output root and its byte-identical sibling', () => {
		expect(
			ANGULAR_TINY_TRANSLATOR_CANONICAL_RECEIPTS.map((bound) => [
				bound.lane,
				bound.canonicalRoot,
				bound.repeatedRoot,
				bound.byteIdenticalSibling,
			]),
		).toEqual([
			['baseline', 'dist/rebuild-1', 'dist/rebuild-2', true],
			['migrated', 'dist-13', 'dist-14', true],
		]);
	});

	it('records the refused registration instead of asserting an empty observer trace', () => {
		const receipt = parseWitnessAngularTinyTranslatorReceipt(fixture());
		for (const published of receipt.runs) {
			expect(published.observerFinalization.workerEvents.length).toBeGreaterThan(0);
			expect(published.refusedServiceWorker.checkpoints.map((point) => point.phase)).toEqual([
				'before-interactions',
				'after-interactions',
				'after-online-reload',
			]);
			for (const point of published.refusedServiceWorker.checkpoints) {
				expect(point.registrations).toBe(0);
				expect(point.controller).toBeNull();
				expect(point.cacheNames).toEqual([]);
				expect(point.attemptEvents.length).toBeGreaterThan(0);
			}
			expect(published.refusedServiceWorker.outputFiles).toEqual([]);
		}
	});

	it('rejects a run whose attempt trace is empty, which is the claim the browser contradicted', () => {
		const copy = fixture();
		for (const published of copy.runs) {
			published.observerFinalization.workerEvents = [];
			published.refusedServiceWorker.workerEvents = [];
			for (const point of published.refusedServiceWorker.checkpoints)
				point.attemptEvents = [];
		}
		expect(() => parseWitnessAngularTinyTranslatorReceipt(resealedDeep(copy))).toThrow(
			/refused service-worker evidence differs/,
		);
	});

	it('rejects an attempt trace naming a script the application never asked for', () => {
		const copy = fixture();
		const trace = [
			{
				kind: 'version' as const,
				scriptPath: '/ngsw-worker.js',
				status: 'activated',
				runningStatus: 'running',
			},
		];
		for (const published of copy.runs) {
			published.observerFinalization.workerEvents = trace;
			published.refusedServiceWorker.workerEvents = trace;
			for (const point of published.refusedServiceWorker.checkpoints)
				point.attemptEvents = trace;
		}
		expect(() => parseWitnessAngularTinyTranslatorReceipt(resealedDeep(copy))).toThrow(
			/refused service-worker evidence differs/,
		);
	});

	it('rejects a checkpoint that reports a worker controlling the page', () => {
		const copy = fixture();
		copy.runs[0]!.refusedServiceWorker.checkpoints[1]!.controller = 'activated' as never;
		expect(() => parseWitnessAngularTinyTranslatorReceipt(resealedDeep(copy))).toThrow(
			/refused service-worker evidence differs/,
		);
	});

	it('rejects a finalized trace that disagrees with the attempt the run recorded', () => {
		const copy = fixture();
		copy.runs[0]!.observerFinalization.workerEvents = [
			{ kind: 'registration', scopePath: '/' },
		];
		expect(() => parseWitnessAngularTinyTranslatorReceipt(resealedDeep(copy))).toThrow(
			/Witness run differs/,
		);
	});

	it('keeps the per-lane console-error membership out of the parity digest and exact in the receipt', () => {
		const receipt = parseWitnessAngularTinyTranslatorReceipt(fixture());
		const digest = receipt.runs[0]!.behaviorDigest;
		const copy = structuredClone(receipt.runs[0]!);
		// A lane whose framework words the same refusal differently keeps the
		// parity digest — the amendment — and the membership is still checked
		// exactly against the published per-lane inventory elsewhere.
		copy.consoleErrorInventory!.expected = [{ message: 'a differently worded refusal', count: 1 }];
		copy.consoleErrorInventory!.observed = [{ message: 'a differently worded refusal', count: 1 }];
		copy.consoleErrorInventory!.total = 1;
		expect(witnessAngularTinyTranslatorBehaviorDigest(copy)).not.toBe(digest);
		copy.consoleErrorInventory!.total = 0;
		copy.consoleErrorInventory!.expected = [];
		copy.consoleErrorInventory!.observed = [];
		expect(witnessAngularTinyTranslatorBehaviorDigest(copy)).toBe(digest);
	});

	it('publishes the amendments, the findings and the lane chain the served root ends', () => {
		const receipt = parseWitnessAngularTinyTranslatorReceipt(fixture());
		expect(receipt.amendments).toEqual(WITNESS_ANGULAR_TINY_TRANSLATOR_RECORDED_AMENDMENTS);
		expect(receipt.migrationFindings).toEqual(
			WITNESS_ANGULAR_TINY_TRANSLATOR_MIGRATION_FINDINGS,
		);
		expect(receipt.migratedLaneChain.at(-1)!.record).toBe(
			ANGULAR_TINY_TRANSLATOR_CANONICAL_RECEIPTS[1]!.path,
		);
		expect(
			receipt.migratedLaneChain.filter((entry) => entry.contradictedBy !== null),
		).toHaveLength(2);
		const rendered = renderWitnessAngularTinyTranslatorReceipt(receipt);
		expect(rendered).toContain('Recorded schema amendments');
		expect(rendered).toContain('silently discarded a typed translation');
		expect(rendered).toContain('identical-parse-in-both-lanes');
	});

	it('rejects a lane chain that does not end at the lane this proof serves', () => {
		const copy = fixture();
		copy.migratedLaneChain = ANGULAR_TINY_TRANSLATOR_MIGRATED_LANE_CHAIN.slice(
			0,
			2,
		) as unknown as typeof ANGULAR_TINY_TRANSLATOR_MIGRATED_LANE_CHAIN;
		expect(() => parseWitnessAngularTinyTranslatorReceipt(resealedDeep(copy))).toThrow(
			/integrity differs/,
		);
	});

	it('rejects a FileReader arbitration that does not match what the runs parsed', () => {
		const copy = fixture();
		copy.fileReaderArbitration.parsedDigest = digestOf('a parse nobody measured');
		expect(() => parseWitnessAngularTinyTranslatorReceipt(resealedDeep(copy))).toThrow(
			/integrity differs/,
		);
	});

	it('rejects a receipt re-pointed at a different build receipt', () => {
		const copy = fixture();
		copy.canonicalReceipts[1]!.canonicalRoot = 'dist-9';
		expect(() => parseWitnessAngularTinyTranslatorReceipt(resealedDeep(copy))).toThrow(
			/binding differs/,
		);
	});

	it('holds the bound build receipts to the bytes on disk', async () => {
		for (const bound of ANGULAR_TINY_TRANSLATOR_CANONICAL_RECEIPTS) {
			const bytes = await readFile(path.join(root, bound.path));
			expect(sha256(bytes)).toBe(bound.sha256);
			const parsed = JSON.parse(bytes.toString('utf8')) as Record<string, unknown>;
			expect(parsed.schemaVersion).toBe(bound.schemaVersion);
			expect(parsed.digest).toBe(bound.digest);
		}
	});
});

describe('Angular TinyTranslator per-lane font seam and icon degradation', () => {
	it('rejects a migrated lane still asking the stylesheet origin, which is the divergence', () => {
		const copy = fixture();
		const stylesheet = { method: 'GET', path: 'https://fonts.googleapis.com/icon' };
		copy.mockedSeams.migrated = [stylesheet];
		for (const published of copy.runs.filter((entry) => entry.lane === 'migrated')) {
			published.mockedNonLoopbackSeams.category = [stylesheet];
			published.mockedNonLoopbackSeams.observed = [
				{ ...stylesheet, requests: 2, statuses: [200] },
			];
		}
		expect(() => parseWitnessAngularTinyTranslatorReceipt(resealedDeep(copy))).toThrow(
			/mocked seam inventory differs/,
		);
	});

	it('rejects a baseline that declared the icon family it never received', () => {
		const copy = fixture();
		for (const published of copy.runs.filter((entry) => entry.lane === 'baseline'))
			published.applicationJourney.matIcon.resolvedFontFamily = '"Material Icons"';
		copy.matIconDegradations.baseline = copy.runs[0]!.applicationJourney.matIcon;
		expect(() => parseWitnessAngularTinyTranslatorReceipt(resealedDeep(copy))).toThrow(
			/mat-icon degradation differs/,
		);
	});

	it('rejects a migrated lane recorded as the baseline degradation', () => {
		const copy = fixture();
		for (const published of copy.runs.filter((entry) => entry.lane === 'migrated'))
			published.applicationJourney.matIcon = structuredClone(
				copy.runs[0]!.applicationJourney.matIcon,
			);
		copy.matIconDegradations.migrated = copy.runs[2]!.applicationJourney.matIcon;
		expect(() => parseWitnessAngularTinyTranslatorReceipt(resealedDeep(copy))).toThrow(
			/mat-icon degradation differs/,
		);
	});

	it('rejects an icon degradation the receipt masked', () => {
		const copy = fixture();
		for (const published of copy.runs) published.applicationJourney.matIcon.renderedText = '';
		copy.matIconDegradations.baseline = copy.runs[0]!.applicationJourney.matIcon;
		copy.matIconDegradations.migrated = copy.runs[2]!.applicationJourney.matIcon;
		expect(() => parseWitnessAngularTinyTranslatorReceipt(resealedDeep(copy))).toThrow(
			/mat-icon degradation differs/,
		);
	});
});

describe('Angular TinyTranslator rendered-style declared differences', () => {
	it('rejects a probe outside the declaration that stopped agreeing', () => {
		const copy = fixture();
		for (const published of copy.runs.filter((entry) => entry.lane === 'migrated'))
			published.renderedStyles.probes[0]!.properties['background-color'] = 'rgb(1, 2, 3)';
		expect(() => parseWitnessAngularTinyTranslatorReceipt(resealedDeep(copy))).toThrow(
			/declared difference differs: application-toolbar/,
		);
	});

	it('rejects a declared difference that no longer differs, so the declaration cannot go stale', () => {
		const copy = fixture();
		for (const published of copy.runs.filter((entry) => entry.lane === 'migrated'))
			published.renderedStyles.probes[1]!.properties = structuredClone(
				copy.runs[0]!.renderedStyles.probes[1]!.properties,
			);
		expect(() => parseWitnessAngularTinyTranslatorReceipt(resealedDeep(copy))).toThrow(
			/declared difference differs: material-icon/,
		);
	});

	it('keeps the declared differences out of the parity digest and everything else in it', () => {
		const receipt = parseWitnessAngularTinyTranslatorReceipt(fixture());
		expect(new Set(receipt.runs.map((published) => published.behaviorDigest)).size).toBe(1);
		const shifted = structuredClone(receipt.runs[0]!);
		shifted.renderedStyles.probes[0]!.properties['color'] = 'rgb(9, 9, 9)';
		expect(witnessAngularTinyTranslatorBehaviorDigest(shifted)).not.toBe(
			receipt.runs[0]!.behaviorDigest,
		);
	});

	it('rejects a run that measured fewer probes than the closed list declares', () => {
		const copy = fixture();
		for (const published of copy.runs) published.renderedStyles.probes.pop();
		expect(() => parseWitnessAngularTinyTranslatorReceipt(resealedDeep(copy))).toThrow(
			/rendered-style measurement differs/,
		);
	});
});

describe('Angular TinyTranslator file-input and download evidence', () => {
	it('binds the synthetic fixture to the bytes committed for it', async () => {
		const bytes = await readFile(
			path.join(root, WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_SURFACES[0]!.fixturePath),
		);
		expect(bytes.length).toBe(WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_FIXTURE.bytes);
		expect(sha256(bytes)).toBe(WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_FIXTURE.sha256);
	});

	it('rejects a load of any file but the bound one', () => {
		const copy = fixture();
		for (const published of copy.runs)
			published.fileInputLoads.loaded[0]!.sha256 = digestOf('some other file');
		expect(() => parseWitnessAngularTinyTranslatorReceipt(resealedDeep(copy))).toThrow(
			/file-input evidence differs/,
		);
	});

	it('rejects a run whose declared surface was never loaded', () => {
		const copy = fixture();
		for (const published of copy.runs) {
			published.fileInputLoads.loaded = [];
			published.fileInputLoads.unused = [
				...WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_SURFACES,
			];
		}
		expect(() => parseWitnessAngularTinyTranslatorReceipt(resealedDeep(copy))).toThrow(
			/file-input evidence differs/,
		);
	});

	it('rejects a download ledger whose context never accepted downloads', () => {
		const copy = fixture();
		for (const published of copy.runs)
			published.downloadCaptures.acceptDownloads = false as unknown as true;
		expect(() => parseWitnessAngularTinyTranslatorReceipt(resealedDeep(copy))).toThrow(
			/download evidence differs/,
		);
	});

	it('rejects an export the browser wrote no bytes for', () => {
		const copy = fixture();
		for (const published of copy.runs) published.downloadCaptures.captured[0]!.bytes = 0;
		copy.downloads.captured = copy.runs.map((published) => ({
			lane: published.lane,
			pass: published.pass,
			files: published.downloadCaptures.captured,
		}));
		expect(() => parseWitnessAngularTinyTranslatorReceipt(resealedDeep(copy))).toThrow(
			/download evidence differs/,
		);
	});

	it('rejects a receipt roll-up quieter than the runs it summarizes', () => {
		const copy = fixture();
		copy.downloads.captured[0]!.files = [];
		expect(() => parseWitnessAngularTinyTranslatorReceipt(resealedDeep(copy))).toThrow(
			/integrity differs/,
		);
	});
});

describe('Angular TinyTranslator route shape, persistence and accommodations', () => {
	it('rejects a route that is not a hash route', () => {
		const copy = fixture();
		for (const published of copy.runs) published.routes = ['/home'];
		expect(() => parseWitnessAngularTinyTranslatorReceipt(resealedDeep(copy))).toThrow(
			/not a hash route/,
		);
	});

	it('rejects a hash route the application does not declare', () => {
		const copy = fixture();
		for (const published of copy.runs) published.routes = ['#/administration'];
		expect(() => parseWitnessAngularTinyTranslatorReceipt(resealedDeep(copy))).toThrow(
			/not a declared route/,
		);
	});

	it('rejects a journey that lost a storage key it started with', () => {
		const copy = fixture();
		for (const published of copy.runs) {
			published.applicationJourney.persistence.keysBeforeJourney = [
				'tinytranslator.settings',
			];
			published.applicationJourney.persistence.keysAfterJourney = ['tinytranslator.projects'];
		}
		expect(() => parseWitnessAngularTinyTranslatorReceipt(resealedDeep(copy))).toThrow(
			/persistence evidence differs/,
		);
	});

	it('rejects a parse that read a different number of units than the fixture holds', () => {
		const copy = fixture();
		for (const published of copy.runs)
			published.applicationJourney.fileReaderParity.parsedUnits = 2;
		expect(() => parseWitnessAngularTinyTranslatorReceipt(resealedDeep(copy))).toThrow(
			/FileReader parity differs/,
		);
	});

	it('carries the zero-manual-step framing with its inventory and journey obligation', () => {
		const receipt = parseWitnessAngularTinyTranslatorReceipt(fixture());
		expect(receipt.accommodations.manualMigrationSteps).toBe(0);
		expect(receipt.accommodations.inventory.applicationFilesChanged).toBe(10);
		expect(receipt.accommodations.inventory.capabilities).toBe(8);
		expect(receipt.accommodations.inventory.record).toBe(
			ANGULAR_TINY_TRANSLATOR_CANONICAL_RECEIPTS[1]!.path,
		);
		expect(receipt.accommodations.journeyObligations[0]).toContain('FileReader');
	});

	it('rejects a softened accommodation framing', () => {
		const copy = fixture();
		copy.accommodations = {
			...WITNESS_ANGULAR_TINY_TRANSLATOR_ACCOMMODATIONS,
			manualMigrationSteps: 1,
		} as unknown as typeof WITNESS_ANGULAR_TINY_TRANSLATOR_ACCOMMODATIONS;
		expect(() => parseWitnessAngularTinyTranslatorReceipt(resealedDeep(copy))).toThrow(
			/integrity differs/,
		);
	});

	it('rejects a mutation proof that never went red', () => {
		const copy = fixture();
		copy.mutation.mutatedSha256 = copy.mutation.beforeSha256;
		expect(() => parseWitnessAngularTinyTranslatorReceipt(resealedDeep(copy))).toThrow(
			/integrity differs/,
		);
	});

	it('rejects a rendered companion that drifted from the receipt', () => {
		const receipt = parseWitnessAngularTinyTranslatorReceipt(fixture());
		const copy = structuredClone(receipt);
		copy.nonclaims = [...copy.nonclaims, 'an unrecorded claim'];
		expect(renderWitnessAngularTinyTranslatorReceipt(copy)).not.toBe(
			renderWitnessAngularTinyTranslatorReceipt(receipt),
		);
	});
});
