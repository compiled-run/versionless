import { describe, expect, it } from 'vitest';
import {
	REACT_CYPRESS_RWA_SOURCE,
	WITNESS_JOURNEY_PLACEHOLDER_RULE,
	WITNESS_LIVE_BACKEND_SERVED_RULE,
	WITNESS_LOOPBACK_BACKEND_RULE,
	WITNESS_REACT_CYPRESS_RWA_ACTOR,
	WITNESS_REACT_CYPRESS_RWA_BACKEND_CATEGORY,
	WITNESS_REACT_CYPRESS_RWA_FORBIDDEN_MARKERS,
	WITNESS_REACT_CYPRESS_RWA_MOCKED_SEAMS,
	WITNESS_REACT_CYPRESS_RWA_PLACEHOLDERS,
	WITNESS_REACT_CYPRESS_RWA_ROUTES,
	WITNESS_REACT_CYPRESS_RWA_SCHEMA,
	type WitnessLoopbackBackendInventory,
	type WitnessReactCypressRwaReceipt,
	type WitnessReactCypressRwaRun,
	parseWitnessReactCypressRwaReceipt,
	witnessReactCypressRwaBehaviorDigest,
	witnessReactCypressRwaDigest,
	witnessReactCypressRwaRawDigest,
} from '../src/index.ts';

const digest = (seed: string): string => seed.padStart(64, '0').slice(0, 64);

function backendInventory(): WitnessLoopbackBackendInventory {
	const observed = [
		{ method: 'GET', path: '/checkAuth', requests: 2, statuses: [200, 401] },
		{ method: 'POST', path: '/login', requests: 1, statuses: [200] },
		{ method: 'POST', path: '/transactions', requests: 1, statuses: [200] },
	];
	return {
		policy: 'live-first-party-loopback-backend',
		backend: 'live-loopback',
		rule: WITNESS_LOOPBACK_BACKEND_RULE,
		category: WITNESS_REACT_CYPRESS_RWA_BACKEND_CATEGORY.map((entry) => ({ ...entry })),
		observed,
		absent: [],
		outsideCategory: [],
		admitted: observed.reduce((sum, entry) => sum + entry.requests, 0),
		successfulNonLoopback: 0,
	};
}

function makeRun(lane: 'baseline' | 'migrated', pass: 1 | 2): WitnessReactCypressRwaRun {
	// Byte inventory is lane-specific on purpose; everything else is shared, so
	// the lane-independent behavior digest is identical and the pass-twice raw
	// digest is stable within a lane.
	const bytes = lane === 'baseline' ? digest('ba5e') : digest('m1g7a7ed');
	const run: WitnessReactCypressRwaRun = {
		app: 'cypress-realworld-app',
		framework: 'react',
		lane,
		pass,
		result: 'pass',
		interactions: [
			{ kind: 'click', selector: '[data-test=signup]' },
			{ kind: 'type', selector: '[data-test=signup-username]' },
		],
		assertions: ['sign up', 'money movement', 'clean page'],
		routes: [...WITNESS_REACT_CYPRESS_RWA_ROUTES],
		trackedEvents: ['click', 'input', 'keydown'],
		witnessRecord: {
			interactions: [{ kind: 'click', selector: '[data-test=signup]' }],
			navigationPaths: [...WITNESS_REACT_CYPRESS_RWA_ROUTES],
			trackedEventCounts: { click: 12, input: 8, keydown: 8 },
			consoleErrors: 0,
			pageErrors: 0,
			failedRequests: 0,
		},
		cleanPage: true,
		servedStatic: {
			transport: 'isolated-bounded-loopback-production-static',
			documentFallback: 'index-only',
			missingAssets: '404',
			traversal: 'rejected',
			inventory: { files: 84, beforeSha256: bytes, afterSha256: bytes },
			application: { path: 'index.html', beforeSha256: bytes, afterSha256: bytes },
			byteIdentical: true,
			hmrControls: false,
			liveBackend: {
				backend: 'live-loopback',
				byteInventoryScope: 'frontend-spa-dist',
				rule: WITNESS_LIVE_BACKEND_SERVED_RULE,
			},
		},
		loopbackBackend: backendInventory(),
		placeholders: WITNESS_REACT_CYPRESS_RWA_PLACEHOLDERS,
		successfulNonLoopback: 0,
		semanticDigest: '',
		behaviorDigest: '',
	};
	run.semanticDigest = witnessReactCypressRwaRawDigest(run);
	run.behaviorDigest = witnessReactCypressRwaBehaviorDigest(run);
	return run;
}

function makeReceipt(): WitnessReactCypressRwaReceipt {
	const runs = [
		makeRun('baseline', 1),
		makeRun('baseline', 2),
		makeRun('migrated', 1),
		makeRun('migrated', 2),
	];
	const receipt: WitnessReactCypressRwaReceipt = {
		schemaVersion: WITNESS_REACT_CYPRESS_RWA_SCHEMA,
		result: 'pass',
		fixture: 'react-cypress-rwa',
		application: 'cypress-realworld-app',
		framework: 'react',
		source: { ...REACT_CYPRESS_RWA_SOURCE },
		provenance: {},
		canonicalReceipt: { path: 'evidence/x.json', canonicalDigest: digest('c'), sha256: digest('d') },
		runs,
		mutation: {
			failure: 'witness-semantic-assertion',
			intendedFailure: true,
			lane: 'migrated',
			seam: 'App bootstrap root',
			path: 'src/index.tsx',
			offset: 42,
			beforeSha256: digest('be'),
			mutatedSha256: digest('mu'),
			afterRestoreSha256: digest('be'),
			restoredByteIdentically: true,
			restoredRun: 'pass',
			restoredBehaviorDigest: runs[0]!.behaviorDigest,
		},
		placeholders: WITNESS_REACT_CYPRESS_RWA_PLACEHOLDERS,
		backendCategory: WITNESS_REACT_CYPRESS_RWA_BACKEND_CATEGORY.map((entry) => ({ ...entry })),
		determinism: {
			reseededFromSnapshotBeforeEachPass: true,
			mintedValuesPlaceholdered: true,
			rule: WITNESS_JOURNEY_PLACEHOLDER_RULE,
		},
		redaction: {
			policy: 'no-seed-usernames-passwords-or-pii',
			forbiddenMarkers: [...WITNESS_REACT_CYPRESS_RWA_FORBIDDEN_MARKERS],
			actorIsNonSeedCorpusIdentity: true,
		},
		locality: {
			mode: 'live-loopback-backend',
			successfulNonLoopback: 0,
			osWideIsolation: false,
			rule: WITNESS_LOOPBACK_BACKEND_RULE,
		},
		nonclaims: ['This proves one live-backend lineage, not generic stateful support.'],
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	receipt.integrity.canonicalDigest = witnessReactCypressRwaDigest(receipt);
	return receipt;
}

describe('witness-react-cypress-rwa schema', () => {
	it('accepts a well-formed live-backend receipt', () => {
		const receipt = makeReceipt();
		expect(parseWitnessReactCypressRwaReceipt(receipt)).toBe(receipt);
		expect(receipt.runs[0]!.servedStatic.liveBackend.backend).toBe('live-loopback');
		expect(receipt.locality.mode).toBe('live-loopback-backend');
	});

	it('holds the two passes of a lane to one semantic digest', () => {
		const receipt = makeReceipt();
		expect(receipt.runs[0]!.semanticDigest).toBe(receipt.runs[1]!.semanticDigest);
		expect(receipt.runs[2]!.semanticDigest).toBe(receipt.runs[3]!.semanticDigest);
		// Lane-independent behavior is one digest across all four runs.
		const behaviors = new Set(receipt.runs.map((run) => run.behaviorDigest));
		expect(behaviors.size).toBe(1);
	});

	it('rejects a pass-two whose re-seeded semantic digest drifted', () => {
		const receipt = makeReceipt();
		receipt.runs[1]!.witnessRecord.trackedEventCounts.click = 99;
		receipt.runs[1]!.semanticDigest = witnessReactCypressRwaRawDigest(receipt.runs[1]!);
		receipt.runs[1]!.behaviorDigest = witnessReactCypressRwaBehaviorDigest(receipt.runs[1]!);
		receipt.integrity.canonicalDigest = witnessReactCypressRwaDigest(receipt);
		expect(() => parseWitnessReactCypressRwaReceipt(receipt)).toThrow(/pass-twice|behavior|run differs/);
	});

	it('rejects a seed marker leaking into recorded evidence (redaction)', () => {
		const receipt = makeReceipt();
		receipt.runs[0]!.assertions = [...receipt.runs[0]!.assertions, 'logged in with s3cret'];
		receipt.runs[0]!.semanticDigest = witnessReactCypressRwaRawDigest(receipt.runs[0]!);
		receipt.runs[0]!.behaviorDigest = witnessReactCypressRwaBehaviorDigest(receipt.runs[0]!);
		receipt.integrity.canonicalDigest = witnessReactCypressRwaDigest(receipt);
		expect(() => parseWitnessReactCypressRwaReceipt(receipt)).toThrow(/redaction|behavior|run differs/);
	});

	it('rejects a backend request outside the declared category', () => {
		const receipt = makeReceipt();
		receipt.runs[0]!.loopbackBackend.observed = [
			...receipt.runs[0]!.loopbackBackend.observed,
			{ method: 'DELETE', path: '/wallet', requests: 1, statuses: [200] },
		];
		receipt.runs[0]!.loopbackBackend.admitted += 1;
		receipt.runs[0]!.semanticDigest = witnessReactCypressRwaRawDigest(receipt.runs[0]!);
		receipt.runs[0]!.behaviorDigest = witnessReactCypressRwaBehaviorDigest(receipt.runs[0]!);
		receipt.integrity.canonicalDigest = witnessReactCypressRwaDigest(receipt);
		expect(() => parseWitnessReactCypressRwaReceipt(receipt)).toThrow(/undeclared|run differs/);
	});

	it('rejects a backend that is not a live loopback backend', () => {
		const receipt = makeReceipt();
		(receipt.runs[0]!.servedStatic.liveBackend as { backend: string }).backend = 'static';
		receipt.runs[0]!.semanticDigest = witnessReactCypressRwaRawDigest(receipt.runs[0]!);
		receipt.runs[0]!.behaviorDigest = witnessReactCypressRwaBehaviorDigest(receipt.runs[0]!);
		receipt.integrity.canonicalDigest = witnessReactCypressRwaDigest(receipt);
		expect(() => parseWitnessReactCypressRwaReceipt(receipt)).toThrow(/served-static|run differs/);
	});

	it('rejects a mutated SPA tree (byteIdentical must hold on the frontend dist)', () => {
		const receipt = makeReceipt();
		receipt.runs[0]!.servedStatic.inventory.afterSha256 = digest('ffff');
		receipt.runs[0]!.semanticDigest = witnessReactCypressRwaRawDigest(receipt.runs[0]!);
		receipt.runs[0]!.behaviorDigest = witnessReactCypressRwaBehaviorDigest(receipt.runs[0]!);
		receipt.integrity.canonicalDigest = witnessReactCypressRwaDigest(receipt);
		expect(() => parseWitnessReactCypressRwaReceipt(receipt)).toThrow(/served-static/);
	});

	it('carries the real pinned source identity, never the seed', () => {
		expect(REACT_CYPRESS_RWA_SOURCE.revision).toBe('f6b5cf3a1799998dab71181eeed59460f8ada5f4');
		expect(WITNESS_REACT_CYPRESS_RWA_ACTOR.username).not.toContain('s3cret');
	});
});

// These lock the pins to what the live DOM+backend actually surfaced, so a future
// edit that reverts a pin to the spec-derived guess fails the node gate. Every
// value below was read off the running application, not the Cypress specs.
describe('witness-react-cypress-rwa live-surface calibration', () => {
	const categoryKey = (entry: { method: string; path: string }): string =>
		`${entry.method} ${entry.path}`;
	const category = WITNESS_REACT_CYPRESS_RWA_BACKEND_CATEGORY.map(categoryKey);

	it('pins bank-account onboarding as POST /graphql, not the REST endpoints', () => {
		expect(category).toContain('POST /graphql');
		expect(category).not.toContain('POST /bankAccounts');
		expect(category).not.toContain('GET /bankAccounts');
	});

	it('pins peer search as GET /users and drops the never-reached endpoints', () => {
		expect(category).toContain('GET /users');
		expect(category).not.toContain('GET /users/search');
		// The journey never opens a transaction-detail route or signs out.
		expect(category).not.toContain('GET /transactions/{created-transaction-id}');
		expect(category).not.toContain('POST /logout');
	});

	it('pins the personal feed as GET /transactions and the settings write as a minted PATCH', () => {
		expect(category).toContain('GET /transactions');
		expect(category).toContain('PATCH /users/{created-user-id}');
		// The only minted id in the whole category is the settings-write user id.
		const withMint = category.filter((key) => key.includes('{'));
		expect(withMint).toEqual(['PATCH /users/{created-user-id}']);
	});

	it('records literal routes with no minted id (payment settles on /transaction/new)', () => {
		expect([...WITNESS_REACT_CYPRESS_RWA_ROUTES]).toEqual([
			'/signin',
			'/',
			'/user/settings',
			'/transaction/new',
			'/',
			'/personal',
			'/',
			'/contacts',
			'/personal',
			'/notifications',
		]);
		expect(WITNESS_REACT_CYPRESS_RWA_ROUTES.some((route) => route.includes('{'))).toBe(false);
	});

	it('declares the full deterministic seed-avatar seam, all query-free on the S3 host', () => {
		expect(WITNESS_REACT_CYPRESS_RWA_MOCKED_SEAMS).toHaveLength(5);
		for (const seam of WITNESS_REACT_CYPRESS_RWA_MOCKED_SEAMS) {
			expect(seam.method).toBe('GET');
			// The query-free absolute-endpoint rule the seam inventory enforces.
			expect(seam.path.startsWith('/')).toBe(false);
			expect(seam.path).not.toContain('?');
			expect(seam.path).toMatch(
				/^https:\/\/cypress-realworld-app-svgs\.s3\.amazonaws\.com\/[^/]+\.svg$/,
			);
			// A freshly minted actor has no avatar, so no per-run value appears here.
			expect(seam.path).not.toContain('{');
		}
		const distinct = new Set(WITNESS_REACT_CYPRESS_RWA_MOCKED_SEAMS.map((seam) => seam.path));
		expect(distinct.size).toBe(5);
	});
});
