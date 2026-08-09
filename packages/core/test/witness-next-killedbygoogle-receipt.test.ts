import { describe, expect, it } from 'vitest';
import {
	NEXT_KILLED_BY_GOOGLE_CANONICAL_DIGEST,
	NEXT_KILLED_BY_GOOGLE_CANONICAL_RECEIPT_PATH,
	NEXT_KILLED_BY_GOOGLE_SOURCE,
	parseWitnessNextKilledByGoogleReceipt,
	WITNESS_NEXT_KILLED_BY_GOOGLE_ASSERTIONS,
	WITNESS_NEXT_KILLED_BY_GOOGLE_ACTIVE_EVENTS,
	WITNESS_NEXT_KILLED_BY_GOOGLE_INTERACTIONS,
	WITNESS_NEXT_KILLED_BY_GOOGLE_MUTATION,
	WITNESS_NEXT_KILLED_BY_GOOGLE_PRERENDER,
	WITNESS_NEXT_KILLED_BY_GOOGLE_SCHEMA,
	WITNESS_NEXT_KILLED_BY_GOOGLE_TRACKED_EVENTS,
	witnessNextKilledByGoogleBehaviorDigest,
	witnessNextKilledByGoogleDigest,
	witnessNextKilledByGoogleRawSemanticDigest,
	type WitnessNextKilledByGoogleReceipt,
	type WitnessNextKilledByGoogleRun,
} from '../src/receipts/witness-next-killedbygoogle.ts';
import type { WitnessNextPrerenderPayloadEvidence } from '../src/receipts/witness-real-app.ts';

function prerenderEvidence(
	run: WitnessNextKilledByGoogleRun,
): Extract<WitnessNextPrerenderPayloadEvidence, { state: 'exact-lane-bound-next-prerender' }> {
	const evidence = run.servedStatic.nextPrerenderPayload;
	if (evidence?.state !== 'exact-lane-bound-next-prerender')
		throw new Error('Expected exact lane-bound Next prerender evidence');
	return evidence;
}

function run(lane: 'baseline' | 'migrated', pass: 1 | 2): WitnessNextKilledByGoogleRun {
	const prerender = WITNESS_NEXT_KILLED_BY_GOOGLE_PRERENDER[lane];
	const value = {
		app: 'killedbygoogle' as const,
		framework: 'next' as const,
		lane,
		pass,
		result: 'pass' as const,
		interactions: [...WITNESS_NEXT_KILLED_BY_GOOGLE_INTERACTIONS],
		assertions: [...WITNESS_NEXT_KILLED_BY_GOOGLE_ASSERTIONS],
		routes: [],
		trackedEvents: [...WITNESS_NEXT_KILLED_BY_GOOGLE_ACTIVE_EVENTS],
		witnessRecord: {
			interactions: [...WITNESS_NEXT_KILLED_BY_GOOGLE_INTERACTIONS],
			navigationPaths: [],
			trackedEventCounts: { click: 1, input: 2, change: 0, keydown: 2, mouseover: 1 },
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
			inventory: { files: 3, beforeSha256: 'a'.repeat(64), afterSha256: 'a'.repeat(64) },
			application: {
				path: 'index.html' as const,
				beforeSha256: 'b'.repeat(64),
				afterSha256: 'b'.repeat(64),
			},
			serviceWorkers: [],
			byteIdentical: true as const,
			hmrControls: false as const,
			legacyMainPrecache: { state: 'not-applicable' as const },
			phonecatOrdering: { state: 'not-applicable' as const },
			phonecatImageTransition: { state: 'not-applicable' as const },
			nextPrerenderPayload: {
				state: 'exact-lane-bound-next-prerender' as const,
				lane,
				...prerender,
				payload: {
					bytes: WITNESS_NEXT_KILLED_BY_GOOGLE_PRERENDER.payload.bytes,
					sha256: WITNESS_NEXT_KILLED_BY_GOOGLE_PRERENDER.payload.sha256,
					keys: [...WITNESS_NEXT_KILLED_BY_GOOGLE_PRERENDER.payload.keys] as [
						'__N_SSG',
						'pageProps',
					],
				},
				response: {
					method: 'GET' as const,
					pathname: prerender.dataRoute,
					query: '' as const,
					destination: 'empty' as const,
					resolvedFile: prerender.stagedPath,
					status: 200 as const,
					mime: 'application/json' as const,
					bytes: WITNESS_NEXT_KILLED_BY_GOOGLE_PRERENDER.payload.bytes,
					sha256: WITNESS_NEXT_KILLED_BY_GOOGLE_PRERENDER.payload.sha256,
				},
			},
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
	value.semanticDigest = witnessNextKilledByGoogleRawSemanticDigest(value);
	return { ...value, behaviorDigest: witnessNextKilledByGoogleBehaviorDigest(value) };
}

function fixture(): WitnessNextKilledByGoogleReceipt {
	const runs = [run('baseline', 1), run('baseline', 2), run('migrated', 1), run('migrated', 2)];
	const receipt: WitnessNextKilledByGoogleReceipt = {
		schemaVersion: WITNESS_NEXT_KILLED_BY_GOOGLE_SCHEMA,
		result: 'pass',
		fixture: 'next-killedbygoogle-derived-state-to-memo',
		source: NEXT_KILLED_BY_GOOGLE_SOURCE,
		provenance: { local: true },
		canonicalReceipt: {
			path: NEXT_KILLED_BY_GOOGLE_CANONICAL_RECEIPT_PATH,
			canonicalDigest: NEXT_KILLED_BY_GOOGLE_CANONICAL_DIGEST,
			sha256: 'c'.repeat(64),
		},
		runs,
		mutation: {
			seam: 'production-static-four-google-plus-spans',
			failure: 'witness-semantic-assertion',
			...WITNESS_NEXT_KILLED_BY_GOOGLE_MUTATION,
			offsets: [...WITNESS_NEXT_KILLED_BY_GOOGLE_MUTATION.offsets],
			intendedFailure: true,
			unrelatedErrors: 0,
			afterRestoreSha256: WITNESS_NEXT_KILLED_BY_GOOGLE_MUTATION.beforeSha256,
			restoredByteIdentically: true,
			restoredRun: 'pass',
			restoredBehaviorDigest: runs[0]!.behaviorDigest,
		},
		readiness: {
			reactLineage: { ready: 1, total: 4 },
			angularLineage: { ready: 1, total: 4 },
			olderNext: { ready: 0, total: 4, counted: false },
			harness: { ready: 0, total: 4 },
		},
		locality: { mode: 'offline', successfulNonLoopback: 0, osWideIsolation: false },
		nonclaims: ['This does not establish generic Next support.'],
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	receipt.integrity.canonicalDigest = witnessNextKilledByGoogleDigest(receipt);
	return receipt;
}

describe('standalone Next KilledByGoogle Witness receipt', () => {
	it('accepts exact 2+2 empty-navigation behavior and candidate readiness', () => {
		const receipt = parseWitnessNextKilledByGoogleReceipt(fixture());
		expect(receipt.runs.every((item) => item.routes.length === 0)).toBe(true);
		expect(receipt.runs.every((item) => item.witnessRecord.navigationPaths.length === 0)).toBe(
			true,
		);
		expect(new Set(receipt.runs.map((item) => item.behaviorDigest))).toHaveLength(1);
		expect(receipt.readiness.olderNext.counted).toBe(false);
	});

	it('rejects invented navigation, UTF-16-like offsets, raw loss and counting', () => {
		for (const mutate of [
			(value: WitnessNextKilledByGoogleReceipt) => value.runs[0]!.routes.push('/'),
			(value: WitnessNextKilledByGoogleReceipt) => (value.mutation.offsets[0] = 80_814),
			(value: WitnessNextKilledByGoogleReceipt) =>
				delete value.runs[0]!.witnessRecord.trackedEventCounts.change,
			(value: WitnessNextKilledByGoogleReceipt) =>
				(value.readiness.olderNext.counted = true as false),
		]) {
			const receipt = fixture();
			mutate(receipt);
			receipt.integrity.canonicalDigest = witnessNextKilledByGoogleDigest(receipt);
			expect(() => parseWitnessNextKilledByGoogleReceipt(receipt)).toThrow();
		}
	});

	it('rejects adversarial prerender provenance, staged payload and response changes', () => {
		for (const mutate of [
			(value: WitnessNextKilledByGoogleReceipt) =>
				(prerenderEvidence(value.runs[0]!).buildId = 'wrong'),
			(value: WitnessNextKilledByGoogleReceipt) =>
				(prerenderEvidence(value.runs[0]!).prerenderManifestSha256 = 'd'.repeat(64)),
			(value: WitnessNextKilledByGoogleReceipt) =>
				(prerenderEvidence(value.runs[0]!).dataRoute = '/_next/data/wrong/index.json'),
			(value: WitnessNextKilledByGoogleReceipt) =>
				(prerenderEvidence(value.runs[0]!).payload.sha256 = 'e'.repeat(64)),
			(value: WitnessNextKilledByGoogleReceipt) =>
				(prerenderEvidence(value.runs[0]!).response.status = 404 as 200),
		]) {
			const receipt = fixture();
			mutate(receipt);
			receipt.runs[0]!.semanticDigest = witnessNextKilledByGoogleRawSemanticDigest(
				receipt.runs[0]!,
			);
			receipt.runs[0]!.behaviorDigest = witnessNextKilledByGoogleBehaviorDigest(
				receipt.runs[0]!,
			);
			receipt.integrity.canonicalDigest = witnessNextKilledByGoogleDigest(receipt);
			expect(() => parseWitnessNextKilledByGoogleReceipt(receipt)).toThrow();
		}
	});
});
