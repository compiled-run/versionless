import { describe, expect, it } from 'vitest';
import {
	parseWitnessReactBoilerplateReceipt,
	REACT_BOILERPLATE_CANONICAL_DIGEST,
	REACT_BOILERPLATE_CANONICAL_RECEIPT_PATH,
	REACT_BOILERPLATE_CANONICAL_SHA256,
	REACT_BOILERPLATE_SOURCE,
	WITNESS_REACT_BOILERPLATE_ASSERTIONS,
	WITNESS_REACT_BOILERPLATE_EVENT_FLOORS,
	WITNESS_REACT_BOILERPLATE_INTERACTIONS,
	WITNESS_REACT_BOILERPLATE_MUTATION,
	WITNESS_REACT_BOILERPLATE_ROUTES,
	WITNESS_REACT_BOILERPLATE_SCHEMA,
	WITNESS_REACT_BOILERPLATE_TRACKED_EVENTS,
	witnessReactBoilerplateAggregateMember,
	witnessReactBoilerplateBehaviorDigest,
	witnessReactBoilerplateDigest,
	witnessReactBoilerplateRawSemanticDigest,
	type WitnessReactBoilerplateReceipt,
	type WitnessReactBoilerplateRun,
} from '../src/receipts/witness-react-boilerplate.ts';

function run(lane: 'baseline' | 'migrated', pass: 1 | 2): WitnessReactBoilerplateRun {
	const telemetry = {
		state: 'ready' as const,
		registration: {
			scriptPath: '/sw.js',
			scope: '/',
			installing: null,
			waiting: null,
			active: 'activated',
		},
		controller: null,
		cacheNames: ['cache'],
		cacheEntries: [{ name: 'cache', paths: ['/'] }],
		workerEvents: [],
	};
	const value = {
		app: 'react-boilerplate' as const,
		framework: 'react' as const,
		lane,
		pass,
		result: 'pass' as const,
		interactions: [...WITNESS_REACT_BOILERPLATE_INTERACTIONS],
		assertions: [...WITNESS_REACT_BOILERPLATE_ASSERTIONS],
		routes: [...WITNESS_REACT_BOILERPLATE_ROUTES],
		trackedEvents: [...WITNESS_REACT_BOILERPLATE_TRACKED_EVENTS],
		witnessRecord: {
			interactions: [...WITNESS_REACT_BOILERPLATE_INTERACTIONS],
			navigationPaths: [...WITNESS_REACT_BOILERPLATE_ROUTES],
			trackedEventCounts: { ...WITNESS_REACT_BOILERPLATE_EVENT_FLOORS },
			consoleErrors: 0,
			pageErrors: 0,
			failedRequests: 0,
		},
		cleanPage: true as const,
		offlineEvidence: {
			state: 'react-shell-rendered-state-reset' as const,
			shellRendered: true as const,
			usernameReset: true as const,
			repositoriesReset: true as const,
			apiResponseCaching: 'not-claimed' as const,
			reduxPersistence: 'not-implemented' as const,
			priorResultPersistence: 'not-implemented' as const,
			harnessFulfillment: 'synthetic-github-route-online-only' as const,
			serviceWorkerEvidence: {
				source: 'canonical-t060' as const,
				receiptPath: REACT_BOILERPLATE_CANONICAL_RECEIPT_PATH,
				canonicalDigest: REACT_BOILERPLATE_CANONICAL_DIGEST,
				newProof: false as const,
			},
			lifecycle: {
				state: 'ready-online-reload-controlled-offline-reset' as const,
				ready: telemetry,
				controlled: { ...telemetry, controller: 'activated' as const },
				onlineStaticPaths: ['/', '/sw.js'],
				offlineServerRequests: 0 as const,
			},
		},
		servedStatic: {
			transport: 'isolated-bounded-loopback-production-static' as const,
			documentFallback: 'index-only' as const,
			missingAssets: '404' as const,
			traversal: 'rejected' as const,
			inventory: { files: 2, beforeSha256: 'a'.repeat(64), afterSha256: 'a'.repeat(64) },
			application: {
				path: 'index.html' as const,
				beforeSha256: 'b'.repeat(64),
				afterSha256: 'b'.repeat(64),
			},
			serviceWorkers: [
				{ path: 'sw.js', beforeSha256: 'c'.repeat(64), afterSha256: 'c'.repeat(64) },
			],
			byteIdentical: true as const,
			hmrControls: false as const,
			legacyMainPrecache: { state: 'not-applicable' as const },
			phonecatOrdering: { state: 'not-applicable' as const },
			phonecatImageTransition: { state: 'not-applicable' as const },
		},
		observerFinalization: {
			state: 'target-closed' as const,
			detach: 'owned-detach-complete' as const,
			pageClose: 'owned-page-close-complete' as const,
			workerEvents: [],
		},
		semanticDigest: '',
		successfulNonLoopback: 0 as const,
	};
	value.semanticDigest = witnessReactBoilerplateRawSemanticDigest(value);
	return { ...value, behaviorDigest: witnessReactBoilerplateBehaviorDigest(value) };
}

function fixture(): WitnessReactBoilerplateReceipt {
	const runs = [run('baseline', 1), run('baseline', 2), run('migrated', 1), run('migrated', 2)];
	const receipt: WitnessReactBoilerplateReceipt = {
		schemaVersion: WITNESS_REACT_BOILERPLATE_SCHEMA,
		result: 'pass',
		fixture: 'react-boilerplate-v4-composed',
		source: REACT_BOILERPLATE_SOURCE,
		provenance: { local: true },
		canonicalReceipt: {
			path: REACT_BOILERPLATE_CANONICAL_RECEIPT_PATH,
			canonicalDigest: REACT_BOILERPLATE_CANONICAL_DIGEST,
			sha256: REACT_BOILERPLATE_CANONICAL_SHA256,
		},
		runs,
		mutation: {
			seam: 'production-static-german-heading',
			failure: 'witness-semantic-assertion',
			...WITNESS_REACT_BOILERPLATE_MUTATION,
			intendedFailure: true,
			afterRestoreSha256: WITNESS_REACT_BOILERPLATE_MUTATION.beforeSha256,
			restoredByteIdentically: true,
			restoredRun: 'pass',
			restoredBehaviorDigest: runs[0]!.behaviorDigest,
		},
		readiness: {
			reactLineage: { ready: 0, total: 4, counted: false },
			angularLineage: { ready: 1, total: 4 },
			harness: { ready: 0, total: 4 },
		},
		locality: { mode: 'offline', successfulNonLoopback: 0, osWideIsolation: false },
		nonclaims: ['This does not establish generic React support.'],
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	receipt.integrity.canonicalDigest = witnessReactBoilerplateDigest(receipt);
	return receipt;
}

describe('standalone React Boilerplate Witness receipt', () => {
	it('accepts exact 2+2 raw and normalized parity with candidate readiness', () => {
		const receipt = parseWitnessReactBoilerplateReceipt(fixture());
		expect(new Set(receipt.runs.map((item) => item.semanticDigest))).toHaveLength(2);
		expect(new Set(receipt.runs.map((item) => item.behaviorDigest))).toHaveLength(1);
		expect(receipt.readiness.reactLineage).toEqual({ ready: 0, total: 4, counted: false });
	});

	it('rejects raw, normalized, mutation and readiness rebinding', () => {
		for (const mutate of [
			(value: WitnessReactBoilerplateReceipt) =>
				(value.runs[0]!.semanticDigest = '0'.repeat(64)),
			(value: WitnessReactBoilerplateReceipt) =>
				(value.runs[0]!.behaviorDigest = '0'.repeat(64)),
			(value: WitnessReactBoilerplateReceipt) => (value.mutation.offset = 0 as 389492),
			(value: WitnessReactBoilerplateReceipt) =>
				(value.readiness.reactLineage.counted = true as false),
		]) {
			const receipt = fixture();
			mutate(receipt);
			receipt.integrity.canonicalDigest = witnessReactBoilerplateDigest(receipt);
			expect(() => parseWitnessReactBoilerplateReceipt(receipt)).toThrow();
		}
	});

	it('rejects an invented leading slash before the four raw Witness navigation events', () => {
		const receipt = fixture();
		const run = receipt.runs[0]!;
		run.routes = ['/', ...run.routes];
		run.witnessRecord.navigationPaths = ['/', ...run.witnessRecord.navigationPaths];
		run.semanticDigest = witnessReactBoilerplateRawSemanticDigest(run);
		run.behaviorDigest = witnessReactBoilerplateBehaviorDigest(run);
		receipt.integrity.canonicalDigest = witnessReactBoilerplateDigest(receipt);
		expect(() => parseWitnessReactBoilerplateReceipt(receipt)).toThrow('run differs');
	});

	it('creates only the exact supplemental aggregate member', () => {
		const receipt = fixture();
		expect(witnessReactBoilerplateAggregateMember(receipt.integrity.canonicalDigest)).toEqual({
			id: 'witness-react-boilerplate',
			framework: 'react',
			track: 'production-readiness-direct-witness-candidate',
			bundler: 'webpack-4.30.0-to-vite-8.0.16',
			runtime: 'node-16.20.2-to-node-24.15.0',
			result: 'pass',
			receipt: 'evidence/runs/witness-react-boilerplate/receipt.json',
			digest: receipt.integrity.canonicalDigest,
		});
	});
});
