import { describe, expect, it } from 'vitest';
import { canonicalize, sha256 } from '../src/receipts/canonicalize.ts';
import {
	parseWitnessRealAppReceipt,
	WITNESS_REAL_APP_NAMES,
	WITNESS_REAL_APP_RUNS,
	WITNESS_REAL_APP_SCHEMA,
	witnessRealAppDigest,
	type WitnessOfflineEvidence,
	type WitnessRealAppReceipt,
} from '../src/receipts/witness-real-app.ts';

function fixture(): WitnessRealAppReceipt {
	const runs = WITNESS_REAL_APP_NAMES.flatMap((app, appIndex) =>
		(['baseline', 'migrated'] as const).flatMap((lane) =>
			([1, 2] as const).map((pass) => ({
				app,
				framework: (['react', 'angularjs', 'next', 'angular', 'react'] as const)[appIndex]!,
				lane,
				pass,
				result: 'pass' as const,
				interactions: ['click', 'type', 'press', 'hover', 'scroll'].map((kind) => ({
					kind: kind as 'click' | 'type' | 'press' | 'hover' | 'scroll',
					selector: '#fixture',
				})),
				assertions: ['visible'],
				routes: ['/'],
				trackedEvents: [],
				witnessRecord: {
					interactions: ['click', 'type', 'press', 'hover', 'scroll'].map((kind) => ({
						kind: kind as 'click' | 'type' | 'press' | 'hover' | 'scroll',
						selector: '#fixture',
					})),
					navigationPaths: [],
					trackedEventCounts: {},
					consoleErrors: 0,
					pageErrors: 0,
					failedRequests: 0,
				},
				cleanPage: true as const,
				offlineEvidence:
					app === 'react-boilerplate'
						? ({
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
									receiptPath:
										'evidence/runs/react-boilerplate-v4-composed/t060-run.json',
									canonicalDigest:
										'52400147929220935a9ebe47a16c8dff50b5c28e9d51c930d000c99c2bdc8a21',
									newProof: false,
								},
								lifecycle: {
									state: 'ready-online-reload-controlled-offline-reset',
									ready: {
										state: 'ready',
										registration: {
											scriptPath: '/sw.js',
											scope: '/',
											installing: null,
											waiting: null,
											active: 'activated',
										},
										controller: null,
										cacheNames: [
											lane === 'baseline'
												? 'webpack-offline:versionless-deterministic'
												: 'versionless-react-vite8-553cd1cc611a0851b1978bbc041ef2f8c7b9fbbd3fdd9bb68274f29364987cdc',
										],
										cacheEntries: [
											{
												name:
													lane === 'baseline'
														? 'webpack-offline:versionless-deterministic'
														: 'versionless-react-vite8-553cd1cc611a0851b1978bbc041ef2f8c7b9fbbd3fdd9bb68274f29364987cdc',
												paths: ['/index.html'],
											},
										],
										workerEvents: [],
									},
									controlled: {
										state: 'ready',
										registration: {
											scriptPath: '/sw.js',
											scope: '/',
											installing: null,
											waiting: null,
											active: 'activated',
										},
										controller: 'activated',
										cacheNames: [
											lane === 'baseline'
												? 'webpack-offline:versionless-deterministic'
												: 'versionless-react-vite8-553cd1cc611a0851b1978bbc041ef2f8c7b9fbbd3fdd9bb68274f29364987cdc',
										],
										cacheEntries: [
											{
												name:
													lane === 'baseline'
														? 'webpack-offline:versionless-deterministic'
														: 'versionless-react-vite8-553cd1cc611a0851b1978bbc041ef2f8c7b9fbbd3fdd9bb68274f29364987cdc',
												paths: ['/index.html'],
											},
										],
										workerEvents: [],
									},
									onlineStaticPaths: ['/index.html', '/sw.js'],
									offlineServerRequests: 0,
								},
							} as WitnessOfflineEvidence)
						: ({ state: 'not-applicable' } as const),
				servedStatic: {
					transport: 'isolated-bounded-loopback-production-static' as const,
					documentFallback: 'index-only' as const,
					missingAssets: '404' as const,
					traversal: 'rejected' as const,
					inventory: {
						files: 2,
						beforeSha256: 'c'.repeat(64),
						afterSha256: 'c'.repeat(64),
					},
					application: {
						path: 'index.html' as const,
						beforeSha256: 'd'.repeat(64),
						afterSha256: 'd'.repeat(64),
					},
					serviceWorkers:
						app === 'react-boilerplate'
							? [
									{
										path: 'sw.js',
										beforeSha256: 'e'.repeat(64),
										afterSha256: 'e'.repeat(64),
									},
								]
							: [],
					byteIdentical: true as const,
					hmrControls: false as const,
					legacyMainPrecache:
						app === 'react-boilerplate' && lane === 'baseline'
							? {
									state: 'exact-completed' as const,
									responses: [
										['/favicon.ico', 'favicon.ico', 'image/x-icon'],
										[
											'/2f1a976c9c35ffed9b7e23cf2cbf8f19.jpg',
											'2f1a976c9c35ffed9b7e23cf2cbf8f19.jpg',
											'image/jpeg',
										],
										[
											'/runtime.bfb7866e5bd316b6a048.js',
											'runtime.bfb7866e5bd316b6a048.js',
											'text/javascript',
										],
										['/', 'index.html', 'text/html'],
									].map(([pathname, resolvedFile, mime]) => ({
										method: 'GET' as const,
										pathname,
										query: '?__uncache=versionless-deterministic' as const,
										destination: 'empty' as const,
										resolvedFile,
										status: 200 as const,
										mime,
										bytes: 1,
										sha256: 'f'.repeat(64),
										urlPath: `${pathname}?__uncache=versionless-deterministic`,
										source: 'production-static-origin' as const,
									})),
								}
							: { state: 'not-applicable' as const },
					phonecatOrdering:
						app === 'angular-phonecat'
							? {
									state: 'data-derived-full-order' as const,
									datasetSha256: '1'.repeat(64),
									orderSha256: '2'.repeat(64),
									rows: 20 as const,
									comparator: 'stable-lowercase-utf16-source-order-ties' as const,
								}
							: { state: 'not-applicable' as const },
					phonecatImageTransition:
						app === 'angular-phonecat'
							? {
									state: 'data-derived-visible-transition' as const,
									detailSha256: '3'.repeat(64),
									defaultImage: 'img/phones/default.jpg',
									nonDefaultImage: 'img/phones/non-default.jpg',
									hover: 'genuine-thumbnail-mouseover' as const,
									transition: 'genuine-ng-click' as const,
									heroVisibility: 'genuine-hover' as const,
								}
							: { state: 'not-applicable' as const },
				},
				observerFinalization: {
					state: 'target-closed' as const,
					detach: 'owned-detach-complete' as const,
					pageClose: 'owned-page-close-complete' as const,
					workerEvents: [],
				},
				semanticDigest: '',
				successfulNonLoopback: 0 as const,
			})),
		),
	);
	for (const run of runs)
		run.semanticDigest = sha256(
			canonicalize({
				app: run.app,
				framework: run.framework,
				lane: run.lane,
				interactions: run.interactions,
				assertions: run.assertions,
				routes: run.routes,
				trackedEvents: run.trackedEvents,
				witnessRecord: run.witnessRecord,
				cleanPage: run.cleanPage,
				offlineEvidence: run.offlineEvidence,
				servedStatic: run.servedStatic,
				observerFinalization: run.observerFinalization,
				successfulNonLoopback: run.successfulNonLoopback,
			}),
		);
	const receipt: WitnessRealAppReceipt = {
		schemaVersion: WITNESS_REAL_APP_SCHEMA,
		result: 'pass',
		provenance: {},
		canonicalReceipts: WITNESS_REAL_APP_NAMES.map((app) => ({
			app,
			path: `evidence/${app}.json`,
			sha256: 'a'.repeat(64),
			canonicalDigest: 'b'.repeat(64),
		})),
		runs,
		mutations: [
			{
				app: 'react-boilerplate',
				failure: 'witness-semantic-assertion',
				intendedFailure: true,
				restoredByteIdentically: true,
			},
			{
				app: 'angular-realworld',
				failure: 'witness-semantic-assertion',
				intendedFailure: true,
				restoredByteIdentically: true,
			},
		],
		killedByGoogleInventory: {
			archiveSha256: 'c'.repeat(64),
			mirrorFiles: 1,
			sourceFiles: { baseline: 1, migrated: 1 },
			buildFiles: { baseline: 1, migrated: 1 },
			transformEdits: 3,
		},
		locality: { mode: 'offline', successfulNonLoopback: 0, osWideIsolation: false },
		nonclaims: ['Drag is not-tested; no genuine selected surface exists.'],
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	receipt.integrity.canonicalDigest = witnessRealAppDigest(receipt);
	return receipt;
}

describe('linked Witness real-app receipt', () => {
	it('accepts every named app across two lanes and two passes', () => {
		expect(WITNESS_REAL_APP_RUNS).toBe(WITNESS_REAL_APP_NAMES.length * 4);
		expect(parseWitnessRealAppReceipt(fixture()).runs).toHaveLength(WITNESS_REAL_APP_RUNS);
	});

	it('rejects a receipt that omits a named app', () => {
		const receipt = fixture();
		receipt.runs = receipt.runs.slice(0, WITNESS_REAL_APP_RUNS - 4);
		expect(() => parseWitnessRealAppReceipt(receipt)).toThrow('cardinality');
	});

	it('rejects fake drag and semantic tampering', () => {
		const receipt = fixture();
		receipt.runs[0]!.interactions[0]!.kind = 'drag' as 'click';
		expect(() => parseWitnessRealAppReceipt(receipt)).toThrow('drag');
	});

	it('rejects strengthened or ambiguous React offline claims', () => {
		const receipt = fixture();
		const run = receipt.runs.find((candidate) => candidate.app === 'react-boilerplate')!;
		if (run.offlineEvidence.state !== 'react-shell-rendered-state-reset') throw new Error();
		run.offlineEvidence.apiResponseCaching = 'cached' as 'not-claimed';
		receipt.integrity.canonicalDigest = witnessRealAppDigest(receipt);
		expect(() => parseWitnessRealAppReceipt(receipt)).toThrow('run differs');
	});

	it('rejects incomplete observer finalization', () => {
		const receipt = fixture();
		receipt.runs[0]!.observerFinalization.detach = 'failed' as 'owned-detach-complete';
		receipt.integrity.canonicalDigest = witnessRealAppDigest(receipt);
		expect(() => parseWitnessRealAppReceipt(receipt)).toThrow('run differs');
	});

	it('rejects missing legacy root precache completion', () => {
		const receipt = fixture();
		const run = receipt.runs.find(
			(candidate) => candidate.app === 'react-boilerplate' && candidate.lane === 'baseline',
		)!;
		if (run.servedStatic.legacyMainPrecache.state !== 'exact-completed') throw new Error();
		run.servedStatic.legacyMainPrecache.responses.pop();
		receipt.integrity.canonicalDigest = witnessRealAppDigest(receipt);
		expect(() => parseWitnessRealAppReceipt(receipt)).toThrow('run differs');
	});

	it('rejects a weakened PhoneCat ordering digest', () => {
		const receipt = fixture();
		const run = receipt.runs.find((candidate) => candidate.app === 'angular-phonecat')!;
		if (run.servedStatic.phonecatOrdering.state !== 'data-derived-full-order')
			throw new Error();
		run.servedStatic.phonecatOrdering.orderSha256 = 'short';
		receipt.integrity.canonicalDigest = witnessRealAppDigest(receipt);
		expect(() => parseWitnessRealAppReceipt(receipt)).toThrow('run differs');
	});

	it('rejects a weakened PhoneCat image transition', () => {
		const receipt = fixture();
		const run = receipt.runs.find((candidate) => candidate.app === 'angular-phonecat')!;
		if (run.servedStatic.phonecatImageTransition.state !== 'data-derived-visible-transition')
			throw new Error();
		run.servedStatic.phonecatImageTransition.heroVisibility = 'not-tested' as 'genuine-hover';
		receipt.integrity.canonicalDigest = witnessRealAppDigest(receipt);
		expect(() => parseWitnessRealAppReceipt(receipt)).toThrow('run differs');
	});
});
