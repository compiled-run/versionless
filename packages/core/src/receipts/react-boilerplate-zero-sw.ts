import { canonicalize, receiptDigest } from './canonicalize.ts';
import { sha256 } from './canonicalize.ts';
import { parseMigrationReceipt, type MigrationReceipt } from './schema.ts';
import type { WitnessRealAppRun } from './witness-real-app.ts';

export const REACT_BOILERPLATE_ZERO_SW_SCHEMA = 'versionless.receipt.v1' as const;
export const REACT_BOILERPLATE_ZERO_SW_RUN_ID = 'T693-react-boilerplate-v4-zero-sw' as const;
export const REACT_BOILERPLATE_ZERO_SW_FIXTURE = 'react-boilerplate-v4-zero-sw' as const;
export const WITNESS_REACT_BOILERPLATE_ZERO_SW_SCHEMA =
	'versionless.witness-react-boilerplate-zero-sw.v1' as const;
export const WITNESS_REACT_BOILERPLATE_ZERO_SW_RECEIPT_PATH =
	'evidence/runs/witness-react-boilerplate-zero-sw/receipt.json' as const;

export const REACT_BOILERPLATE_ZERO_SW_SUPERSEDES = Object.freeze({
	t060: {
		path: 'evidence/runs/react-boilerplate-v4-composed/t060-run.json',
		sha256: 'ea708cf382e4911057225cc732ee0e7cd294985c0c97690b8147e84d00e26954',
		canonicalDigest: '52400147929220935a9ebe47a16c8dff50b5c28e9d51c930d000c99c2bdc8a21',
	},
	witness: {
		path: 'evidence/runs/witness-react-boilerplate/receipt.json',
		sha256: '39a12cc6defaad5c5103f69b272a83f1ea80cf9e625c6e6fff7daac50caab103',
		canonicalDigest: 'bfa48f718ee86566f120cb0bc42645b22c989a27d87c102b9c2f256d15661ed7',
	},
});

export type ZeroServiceWorkerObservation = Readonly<{
	outputFiles: readonly [];
	registrations: 0;
	controller: null;
	requests: readonly [];
	workerEvents: readonly [];
	cacheStorageNames: readonly [];
}>;

export type WitnessReactBoilerplateZeroSwRun = WitnessRealAppRun & {
	zeroServiceWorker: {
		checkpoints: Array<{
			phase: 'before-interactions' | 'after-interactions' | 'after-online-reload';
			state: 'timeout';
			registrations: 0;
			controller: null;
			cacheNames: [];
			workerEvents: [];
		}>;
		outputFiles: [];
		requests: [];
		workerEvents: [];
	};
	behaviorDigest: string;
};

export type WitnessReactBoilerplateZeroSwReceipt = {
	schemaVersion: typeof WITNESS_REACT_BOILERPLATE_ZERO_SW_SCHEMA;
	result: 'pass';
	fixture: typeof REACT_BOILERPLATE_ZERO_SW_FIXTURE;
	source: {
		repository: 'https://github.com/react-boilerplate/react-boilerplate';
		revision: 'd19099afeff64ecfb09133c06c1cb18c0d40887e';
		archiveSha256: 'd6ca60a3c8881ae2be26a8d04e00da4d922a6653f8512f2b12ac55d48f2ce2d5';
		license: 'MIT';
		licenseSha256: 'e773e6b91c13f55310668e15ce178a2fcf779ff39dbcc0b910b4b5f1ecb17acb';
	};
	provenance: Record<string, unknown>;
	canonicalReceipt: { path: string; canonicalDigest: string; sha256: string };
	supersedes: typeof REACT_BOILERPLATE_ZERO_SW_SUPERSEDES.witness & {
		scope: 'current-zero-service-worker-policy-only';
		originalOfflineFirstEvidenceRetained: true;
	};
	runs: WitnessReactBoilerplateZeroSwRun[];
	mutations: {
		semantic: {
			failure: 'witness-semantic-assertion';
			intendedFailure: true;
			path: string;
			beforeSha256: string;
			mutatedSha256: string;
			afterRestoreSha256: string;
			restoredByteIdentically: true;
			restoredRun: 'pass';
		};
		serviceWorker: {
			failure: 'zero-service-worker-policy-assertion';
			intendedFailure: true;
			observedOutputFiles: ['sw.js'];
			observedRegistrationOrWorker: true;
		};
	};
	zeroServiceWorker: ZeroServiceWorkerObservation;
	readiness: {
		reactLineage: { ready: 1; total: 4; counted: true };
		alignedReact: { ready: 0; total: 4; counted: false };
		overall: { ready: 3; total: 12 };
	};
	locality: { mode: 'offline'; successfulNonLoopback: 0; osWideIsolation: false };
	nonclaims: string[];
	integrity: { algorithm: 'sha256'; canonicalDigest: string };
};

export type ReactBoilerplateZeroSwReceipt = MigrationReceipt &
	Readonly<{
		supersedes: {
			scope: 'current-zero-service-worker-policy-only';
			t060: typeof REACT_BOILERPLATE_ZERO_SW_SUPERSEDES.t060;
			witness: typeof REACT_BOILERPLATE_ZERO_SW_SUPERSEDES.witness;
			originalOfflineFirstEvidenceRetained: true;
			historicalZeroSwParityClaimed: false;
		};
		policyProfile: {
			removals: readonly [
				'offline-plugin-runtime-registration',
				'offline-plugin-webpack-execution',
			];
			dependencyClosure: 'retained-unused-unshipped';
			baselineBuilds: 2;
			targetBuilds: 2;
			zeroServiceWorker: ZeroServiceWorkerObservation;
		};
	}>;

const exact = (left: unknown, right: unknown): boolean =>
	canonicalize(left) === canonicalize(right);

export function witnessReactBoilerplateZeroSwRawDigest(
	run: WitnessReactBoilerplateZeroSwRun | WitnessRealAppRun,
): string {
	const { pass: _pass, result: _result, semanticDigest: _semanticDigest, ...raw } = run;
	const withoutBehavior = { ...raw } as Record<string, unknown>;
	delete withoutBehavior.behaviorDigest;
	return sha256(canonicalize(withoutBehavior));
}

export function witnessReactBoilerplateZeroSwBehaviorDigest(
	run: WitnessReactBoilerplateZeroSwRun | WitnessRealAppRun,
): string {
	const zero = (run as WitnessReactBoilerplateZeroSwRun).zeroServiceWorker;
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
				trackedEventCounts: { change: 1, click: 3, input: 2, keydown: 3, mouseover: 1 },
			},
			cleanPage: run.cleanPage,
			offlineEvidence: run.offlineEvidence,
			servedStaticPolicy: {
				transport: run.servedStatic.transport,
				documentFallback: run.servedStatic.documentFallback,
				missingAssets: run.servedStatic.missingAssets,
				traversal: run.servedStatic.traversal,
				serviceWorkerPaths: run.servedStatic.serviceWorkers.map((item) => item.path),
				byteIdentical: run.servedStatic.byteIdentical,
				hmrControls: run.servedStatic.hmrControls,
			},
			zeroServiceWorker: zero,
			successfulNonLoopback: run.successfulNonLoopback,
		}),
	);
}

export function witnessReactBoilerplateZeroSwDigest(
	receipt: WitnessReactBoilerplateZeroSwReceipt,
): string {
	const copy = structuredClone(receipt);
	copy.integrity.canonicalDigest = '';
	return sha256(canonicalize(copy));
}

export function parseWitnessReactBoilerplateZeroSwReceipt(
	value: unknown,
): WitnessReactBoilerplateZeroSwReceipt {
	if (value === null || typeof value !== 'object' || Array.isArray(value))
		throw new Error('React Boilerplate zero-SW Witness receipt must be an object');
	const receipt = value as WitnessReactBoilerplateZeroSwReceipt;
	const expectedRuns = new Set(['baseline:1', 'baseline:2', 'migrated:1', 'migrated:2']);
	const behaviors = new Set<string>();
	if (
		receipt.schemaVersion !== WITNESS_REACT_BOILERPLATE_ZERO_SW_SCHEMA ||
		receipt.result !== 'pass' ||
		receipt.fixture !== REACT_BOILERPLATE_ZERO_SW_FIXTURE ||
		!exact(receipt.supersedes, {
			...REACT_BOILERPLATE_ZERO_SW_SUPERSEDES.witness,
			scope: 'current-zero-service-worker-policy-only',
			originalOfflineFirstEvidenceRetained: true,
		}) ||
		!Array.isArray(receipt.runs) ||
		receipt.runs.length !== 4
	)
		throw new Error('React Boilerplate zero-SW Witness binding differs');
	for (const run of receipt.runs) {
		const key = `${run.lane}:${run.pass}`;
		if (
			!expectedRuns.delete(key) ||
			run.app !== 'react-boilerplate' ||
			run.framework !== 'react' ||
			run.result !== 'pass' ||
			run.cleanPage !== true ||
			run.successfulNonLoopback !== 0 ||
			run.witnessRecord.consoleErrors !== 0 ||
			run.witnessRecord.pageErrors !== 0 ||
			run.witnessRecord.failedRequests !== 0 ||
			run.offlineEvidence.state !== 'not-applicable' ||
			run.servedStatic.serviceWorkers.length !== 0 ||
			run.observerFinalization.workerEvents.length !== 0 ||
			run.semanticDigest !== witnessReactBoilerplateZeroSwRawDigest(run) ||
			run.behaviorDigest !== witnessReactBoilerplateZeroSwBehaviorDigest(run) ||
			!exact(run.zeroServiceWorker.outputFiles, []) ||
			!exact(run.zeroServiceWorker.requests, []) ||
			!exact(run.zeroServiceWorker.workerEvents, []) ||
			run.zeroServiceWorker.checkpoints.length !== 3 ||
			run.zeroServiceWorker.checkpoints.some(
				(checkpoint) =>
					checkpoint.state !== 'timeout' ||
					checkpoint.registrations !== 0 ||
					checkpoint.controller !== null ||
					checkpoint.cacheNames.length !== 0 ||
					checkpoint.workerEvents.length !== 0,
			)
		)
			throw new Error(`React Boilerplate zero-SW Witness run differs: ${key}`);
		behaviors.add(run.behaviorDigest);
	}
	if (
		expectedRuns.size !== 0 ||
		behaviors.size !== 1 ||
		!exact(receipt.zeroServiceWorker, {
			outputFiles: [],
			registrations: 0,
			controller: null,
			requests: [],
			workerEvents: [],
			cacheStorageNames: [],
		}) ||
		receipt.mutations?.semantic.intendedFailure !== true ||
		receipt.mutations.serviceWorker.intendedFailure !== true ||
		receipt.mutations.serviceWorker.observedRegistrationOrWorker !== true ||
		!exact(receipt.readiness, {
			reactLineage: { ready: 1, total: 4, counted: true },
			alignedReact: { ready: 0, total: 4, counted: false },
			overall: { ready: 3, total: 12 },
		}) ||
		receipt.locality?.mode !== 'offline' ||
		receipt.locality.successfulNonLoopback !== 0 ||
		receipt.locality.osWideIsolation !== false ||
		receipt.integrity?.algorithm !== 'sha256' ||
		receipt.integrity.canonicalDigest !== witnessReactBoilerplateZeroSwDigest(receipt)
	)
		throw new Error('React Boilerplate zero-SW Witness integrity differs');
	return receipt;
}

export function renderWitnessReactBoilerplateZeroSwReceipt(
	receipt: WitnessReactBoilerplateZeroSwReceipt,
): string {
	return `# React Boilerplate v4 — direct Witness zero-service-worker profile\n\n- Result: pass\n- Canonical SHA-256: ${receipt.integrity.canonicalDigest}\n- Runs: 2 baseline + 2 migrated production-static browser journeys\n- Behavioral parity: ${receipt.runs[0]!.behaviorDigest}\n- Service worker: zero output, registration, controller, request, event, and CacheStorage names\n- Mutation proofs: German heading semantic red/restoration; service-worker policy red\n- Supersession: current zero-service-worker policy only; original offline-first receipt remains retained\n- Official React readiness: 1/4 unchanged; aligned React: 0/4 pending Judge\n\n${receipt.nonclaims.map((claim) => `- ${claim}`).join('\n')}\n`;
}

export function witnessReactBoilerplateZeroSwAggregateMember(digestValue: string) {
	return {
		id: 'witness-react-boilerplate-zero-sw',
		framework: 'react',
		track: 'production-readiness-direct-witness-current-zero-sw-policy',
		bundler: 'webpack-4.30.0-to-vite-8.0.16',
		runtime: 'node-16.20.2-to-node-24.15.0',
		result: 'pass',
		receipt: WITNESS_REACT_BOILERPLATE_ZERO_SW_RECEIPT_PATH,
		digest: digestValue,
	};
}

export async function verifyWitnessReactBoilerplateZeroSwEvidence(rootDir = '.') {
	const root = resolve(rootDir);
	const receiptPath = join(root, WITNESS_REACT_BOILERPLATE_ZERO_SW_RECEIPT_PATH);
	const receipt = parseWitnessReactBoilerplateZeroSwReceipt(
		JSON.parse(await readFile(receiptPath, 'utf8')),
	);
	const canonicalBytes = await readFile(join(root, receipt.canonicalReceipt.path));
	if (sha256(canonicalBytes) !== receipt.canonicalReceipt.sha256)
		throw new Error('React Boilerplate zero-SW canonical receipt bytes drifted');
	parseReactBoilerplateZeroSwReceipt(JSON.parse(canonicalBytes.toString('utf8')));
	if (
		(await readFile(join(dirname(receiptPath), 'receipt.md'), 'utf8')) !==
		renderWitnessReactBoilerplateZeroSwReceipt(receipt)
	)
		throw new Error('React Boilerplate zero-SW human Witness receipt differs');
	return {
		valid: true as const,
		digest: receipt.integrity.canonicalDigest,
		artifacts: 0,
		receipt,
	};
}

export function parseReactBoilerplateZeroSwReceipt(value: unknown): ReactBoilerplateZeroSwReceipt {
	const receipt = parseMigrationReceipt(value) as ReactBoilerplateZeroSwReceipt;
	if (
		receipt.runId !== REACT_BOILERPLATE_ZERO_SW_RUN_ID ||
		receipt.fixture !== REACT_BOILERPLATE_ZERO_SW_FIXTURE ||
		receipt.supersedes?.scope !== 'current-zero-service-worker-policy-only' ||
		receipt.supersedes.originalOfflineFirstEvidenceRetained !== true ||
		receipt.supersedes.historicalZeroSwParityClaimed !== false ||
		!exact(receipt.supersedes.t060, REACT_BOILERPLATE_ZERO_SW_SUPERSEDES.t060) ||
		!exact(receipt.supersedes.witness, REACT_BOILERPLATE_ZERO_SW_SUPERSEDES.witness) ||
		!exact(receipt.policyProfile?.removals, [
			'offline-plugin-runtime-registration',
			'offline-plugin-webpack-execution',
		]) ||
		receipt.policyProfile.dependencyClosure !== 'retained-unused-unshipped' ||
		receipt.policyProfile.baselineBuilds !== 2 ||
		receipt.policyProfile.targetBuilds !== 2 ||
		!exact(receipt.policyProfile.zeroServiceWorker, {
			outputFiles: [],
			registrations: 0,
			controller: null,
			requests: [],
			workerEvents: [],
			cacheStorageNames: [],
		})
	)
		throw new Error('React Boilerplate zero-SW receipt policy binding differs');
	if (receipt.integrity.canonicalDigest !== receiptDigest(receipt))
		throw new Error('React Boilerplate zero-SW receipt digest differs');
	return receipt;
}

export function renderReactBoilerplateZeroSwReceipt(
	receipt: ReactBoilerplateZeroSwReceipt,
): string {
	return `# React Boilerplate v4 — zero-service-worker production profile

- Result: ${receipt.verification.result}
- Source revision: ${receipt.source.revision}
- Baseline: Node 16.20.2 / webpack 4.30.0, two deterministic builds
- Target: Node 24.15.0 / Vite 8.0.16 / React 18-compatible, two deterministic builds
- Service worker: zero output, registration, controller, request, event, and CacheStorage names
- Supersedes: T060 and its Witness receipt for current zero-service-worker policy only
- Historical truth retained: T060's offline-first behavior remains valid and visible
- Official React score: unchanged at 1/4; current-policy-aligned score remains 0/4 pending Judge
- Integrity: ${receipt.integrity.canonicalDigest}

This receipt establishes reproducibility and hash integrity, not certification, legal compliance, authenticity, signer identity, OS-wide isolation, or an earned SLSA level.
`;
}
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'pathe';
