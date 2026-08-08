import { describe, expect, it } from 'vitest';
import {
	ANGULAR_REALWORLD_CANONICAL_DIGEST,
	ANGULAR_REALWORLD_CANONICAL_RECEIPT_PATH,
	parseWitnessAngularRealworldReceipt,
	WITNESS_ANGULAR_REALWORLD_SCHEMA,
	WITNESS_ANGULAR_REALWORLD_ROUTES,
	WITNESS_ANGULAR_REALWORLD_MUTATION,
	WITNESS_ANGULAR_REALWORLD_ASSERTIONS,
	WITNESS_ANGULAR_REALWORLD_INTERACTIONS,
	witnessAngularRealworldBehaviorDigest,
	witnessAngularRealworldDigest,
	witnessAngularRealworldRawSemanticDigest,
	type WitnessAngularRealworldReceipt,
	type WitnessAngularRealworldRun,
} from '../src/receipts/witness-angular-realworld.ts';
import type { WitnessRealAppRun } from '../src/receipts/witness-real-app.ts';

function run(lane: 'baseline' | 'migrated', pass: 1 | 2): WitnessAngularRealworldRun {
	const interactions = WITNESS_ANGULAR_REALWORLD_INTERACTIONS.map((item) => ({ ...item }));
	const value: WitnessRealAppRun = {
		app: 'angular-realworld',
		framework: 'angular',
		lane,
		pass,
		result: 'pass',
		interactions,
		assertions: [...WITNESS_ANGULAR_REALWORLD_ASSERTIONS],
		routes: [...WITNESS_ANGULAR_REALWORLD_ROUTES],
		trackedEvents: ['click', 'input', 'keydown', 'mouseover'],
		witnessRecord: {
			interactions,
			navigationPaths: [...WITNESS_ANGULAR_REALWORLD_ROUTES],
			trackedEventCounts: {
				click: 3,
				input: 16,
				keydown: 18,
				mouseover: lane === 'baseline' && pass === 2 ? 10 : 9,
			},
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
				files: 3,
				beforeSha256: lane === 'baseline' ? 'a'.repeat(64) : 'b'.repeat(64),
				afterSha256: lane === 'baseline' ? 'a'.repeat(64) : 'b'.repeat(64),
			},
			application: {
				path: 'index.html',
				beforeSha256: lane === 'baseline' ? 'c'.repeat(64) : 'd'.repeat(64),
				afterSha256: lane === 'baseline' ? 'c'.repeat(64) : 'd'.repeat(64),
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
			workerEvents: [],
		},
		semanticDigest: '',
		successfulNonLoopback: 0,
	};
	value.semanticDigest = witnessAngularRealworldRawSemanticDigest(value);
	return { ...value, behaviorDigest: witnessAngularRealworldBehaviorDigest(value) };
}

function rebindRun(receipt: WitnessAngularRealworldReceipt, index = 0): void {
	const run = receipt.runs[index]!;
	run.semanticDigest = witnessAngularRealworldRawSemanticDigest(run);
	run.behaviorDigest = witnessAngularRealworldBehaviorDigest(run);
	receipt.integrity.canonicalDigest = witnessAngularRealworldDigest(receipt);
}

function fixture(): WitnessAngularRealworldReceipt {
	const runs = (['baseline', 'migrated'] as const).flatMap((lane) =>
		([1, 2] as const).map((pass) => run(lane, pass)),
	);
	const receipt: WitnessAngularRealworldReceipt = {
		schemaVersion: WITNESS_ANGULAR_REALWORLD_SCHEMA,
		result: 'pass',
		fixture: 'angular-realworld-v15-to-v16',
		provenance: {},
		canonicalReceipt: {
			path: ANGULAR_REALWORLD_CANONICAL_RECEIPT_PATH,
			canonicalDigest: ANGULAR_REALWORLD_CANONICAL_DIGEST,
			sha256: '1'.repeat(64),
		},
		runs,
		mutation: {
			seam: 'production-static-angular-bootstrap-root',
			failure: 'witness-semantic-assertion',
			sourceSpan: WITNESS_ANGULAR_REALWORLD_MUTATION.sourceSpan,
			mutatedSpan: WITNESS_ANGULAR_REALWORLD_MUTATION.mutatedSpan,
			failureAssertion: WITNESS_ANGULAR_REALWORLD_MUTATION.failureAssertion,
			intendedFailure: true,
			beforeSha256: WITNESS_ANGULAR_REALWORLD_MUTATION.beforeSha256,
			mutatedSha256: WITNESS_ANGULAR_REALWORLD_MUTATION.mutatedSha256,
			afterRestoreSha256: WITNESS_ANGULAR_REALWORLD_MUTATION.beforeSha256,
			restoredByteIdentically: true,
			restoredRun: 'pass',
			restoredBehaviorDigest: runs[0]!.behaviorDigest,
		},
		readiness: {
			angularLineage: { ready: 1, total: 4 },
			harness: { ready: 0, total: 4 },
			phonecat: 'unsupported-visible-transition-not-counted',
		},
		locality: { mode: 'offline', successfulNonLoopback: 0, osWideIsolation: false },
		nonclaims: ['No generic Angular support is claimed.'],
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	receipt.integrity.canonicalDigest = witnessAngularRealworldDigest(receipt);
	return receipt;
}

describe('standalone Angular RealWorld direct-Witness receipt', () => {
	it('accepts the exact four-run readiness vertical', () => {
		const receipt = parseWitnessAngularRealworldReceipt(fixture());
		expect(receipt.runs).toHaveLength(4);
		expect(receipt.runs[0]!.semanticDigest).not.toBe(receipt.runs[1]!.semanticDigest);
		expect(new Set(receipt.runs.map((run) => run.behaviorDigest)).size).toBe(1);
	});

	it('rejects missing gesture coverage', () => {
		const receipt = fixture();
		receipt.runs[0]!.interactions.pop();
		receipt.integrity.canonicalDigest = witnessAngularRealworldDigest(receipt);
		expect(() => parseWitnessAngularRealworldReceipt(receipt)).toThrow('run differs');
	});

	it('rejects an inflated harness scoreboard', () => {
		const receipt = fixture();
		receipt.readiness.harness.ready = 1 as 0;
		receipt.integrity.canonicalDigest = witnessAngularRealworldDigest(receipt);
		expect(() => parseWitnessAngularRealworldReceipt(receipt)).toThrow('boundary differs');
	});

	it.each([
		['missing', ['/', '/article/versionless-angular', '/register', '/register']],
		['reordered', ['/', '/register', '/article/versionless-angular', '/register', '/register']],
		['renamed', ['/', '/article/renamed', '/register', '/register', '/register']],
		[
			'extra',
			[
				'/',
				'/article/versionless-angular',
				'/register',
				'/register',
				'/register',
				'/register',
			],
		],
	] as const)('rejects recomputed and rebound %s route evidence', (_label, routes) => {
		const receipt = fixture();
		for (const run of receipt.runs) {
			run.routes = [...routes];
			run.witnessRecord.navigationPaths = [...routes];
			run.semanticDigest = witnessAngularRealworldRawSemanticDigest(run);
			run.behaviorDigest = witnessAngularRealworldBehaviorDigest(run);
		}
		receipt.mutation.restoredBehaviorDigest = receipt.runs[0]!.behaviorDigest;
		receipt.integrity.canonicalDigest = witnessAngularRealworldDigest(receipt);
		expect(() => parseWitnessAngularRealworldReceipt(receipt)).toThrow('run differs');
	});

	it.each([
		[
			'missing event',
			(receipt: WitnessAngularRealworldReceipt) => {
				delete receipt.runs[0]!.witnessRecord.trackedEventCounts.mouseover;
			},
		],
		[
			'below-floor event',
			(receipt: WitnessAngularRealworldReceipt) => {
				receipt.runs[0]!.witnessRecord.trackedEventCounts.click = 2;
			},
		],
		[
			'extra event',
			(receipt: WitnessAngularRealworldReceipt) => {
				receipt.runs[0]!.witnessRecord.trackedEventCounts.change = 1;
			},
		],
		[
			'missing tracked event name',
			(receipt: WitnessAngularRealworldReceipt) => {
				receipt.runs[0]!.trackedEvents.pop();
			},
		],
		[
			'extra tracked event name',
			(receipt: WitnessAngularRealworldReceipt) => {
				receipt.runs[0]!.trackedEvents.push('change');
			},
		],
		[
			'interaction kind',
			(receipt: WitnessAngularRealworldReceipt) => {
				receipt.runs[0]!.interactions[0]!.kind = 'hover';
			},
		],
		[
			'interaction selector',
			(receipt: WitnessAngularRealworldReceipt) => {
				receipt.runs[0]!.interactions[0]!.selector = 'a.changed';
			},
		],
		[
			'assertion drift',
			(receipt: WitnessAngularRealworldReceipt) => {
				receipt.runs[0]!.assertions[0] = 'changed';
			},
		],
	] as const)('rejects recomputed %s evidence', (_label, mutate) => {
		const receipt = fixture();
		mutate(receipt);
		rebindRun(receipt);
		expect(() => parseWitnessAngularRealworldReceipt(receipt)).toThrow('run differs');
	});

	it('rejects raw and normalized digest rebinding', () => {
		const raw = fixture();
		raw.runs[0]!.semanticDigest = '6'.repeat(64);
		raw.integrity.canonicalDigest = witnessAngularRealworldDigest(raw);
		expect(() => parseWitnessAngularRealworldReceipt(raw)).toThrow('run differs');

		const behavior = fixture();
		behavior.runs[0]!.behaviorDigest = '7'.repeat(64);
		behavior.integrity.canonicalDigest = witnessAngularRealworldDigest(behavior);
		expect(() => parseWitnessAngularRealworldReceipt(behavior)).toThrow('run differs');
	});

	it.each(['g'.repeat(64), 'A'.repeat(64), 'a'.repeat(63)])(
		'rejects invalid lowercase SHA-256 %s',
		(value) => {
			const receipt = fixture();
			receipt.canonicalReceipt.sha256 = value;
			receipt.integrity.canonicalDigest = witnessAngularRealworldDigest(receipt);
			expect(() => parseWitnessAngularRealworldReceipt(receipt)).toThrow('boundary differs');
		},
	);

	it.each([
		['sourceSpan', '<app-root>Changed...</app-root>'],
		['mutatedSpan', '<app-root-disabled>Changed...</app-root-disabled>'],
		['beforeSha256', '3'.repeat(64)],
		['mutatedSha256', '4'.repeat(64)],
		['afterRestoreSha256', '5'.repeat(64)],
		['failureAssertion', 'browser launch failed'],
	] as const)('rejects recomputed mutation %s rebinding', (field, value) => {
		const receipt = fixture();
		(receipt.mutation as unknown as Record<string, unknown>)[field] = value;
		receipt.integrity.canonicalDigest = witnessAngularRealworldDigest(receipt);
		expect(() => parseWitnessAngularRealworldReceipt(receipt)).toThrow('boundary differs');
	});
});
