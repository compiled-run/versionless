import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'pathe';
import { canonicalize, sha256 } from './canonicalize.ts';
import type { WitnessRealAppRun } from './witness-real-app.ts';

export const WITNESS_REACT_PAPERCUPS_SCHEMA = 'versionless.witness-react-papercups.v1' as const;
export const WITNESS_REACT_PAPERCUPS_RECEIPT_PATH =
	'evidence/runs/witness-react-papercups/receipt.json' as const;
export const REACT_PAPERCUPS_FIXTURE = 'react-papercups-v1-0-0' as const;
export const REACT_PAPERCUPS_RECEIPT_PATH =
	'evidence/runs/react-papercups-v1-0-0/t004-run.json' as const;
export const REACT_PAPERCUPS_RUN_ID = 'T004-react-papercups-v1-0-0-cra-to-vite8-build' as const;
/**
 * The retained build-stage receipt is bound by its declared canonical digest
 * and by the sha256 of its exact bytes, so the browser proof cannot be
 * re-pointed at a rebuilt or edited build receipt.
 */
export const REACT_PAPERCUPS_CANONICAL_DIGEST =
	'b433f214727389676b308332f7689d773ad28dde0984b9bf245f3f780f87d35a' as const;
export const REACT_PAPERCUPS_RECEIPT_SHA256 =
	'864a3c207d4f6639fe1f1c377e2b87e5163783aef035ad107198d36315f0d395' as const;

/**
 * The immutable Papercups source identity, bound here so the browser-proof
 * receipt cannot silently rebind itself to a different revision or archive.
 */
export const REACT_PAPERCUPS_SOURCE = Object.freeze({
	repository: 'https://github.com/papercups-io/papercups',
	ref: 'refs/tags/v1.0.0',
	revision: '3546a5f60c52fcc86fe9cbcc3bbac07356ba134f',
	archiveSha256: 'f8a6576c0399e1eca5e1936a9e5e5b311798cccf3cb7c6fcce0cecbf8b46ea8f',
	frontendRoot: 'assets',
	license: 'MIT',
	licenseSha256: 'cd94b1bf29eec689bd048f0f202c038d2d3033d80102a7ff47ddf65d2890291c',
});

export type WitnessReactPapercupsZeroServiceWorkerCheckpoint = {
	phase: 'before-interactions' | 'after-interactions' | 'after-online-reload';
	state: 'timeout';
	registrations: 0;
	controller: null;
	cacheNames: [];
	workerEvents: [];
};

/**
 * Runtime zero-service-worker observation.
 *
 * `emittedOutputFiles` is deliberately not required to be empty: the retained
 * create-react-app baseline still ships an unregistered `service-worker.js`,
 * and erasing that from the evidence would be masking. What is required is that
 * the application never registers it — zero registrations, zero controller,
 * zero CacheStorage names, zero lifecycle events, and zero worker requests in
 * every lane and pass.
 */
export type WitnessReactPapercupsZeroServiceWorker = {
	registration: 'application-unregister';
	checkpoints: WitnessReactPapercupsZeroServiceWorkerCheckpoint[];
	emittedOutputFiles: Array<{ path: string; sha256: string }>;
	requests: [];
	workerEvents: [];
};

export type WitnessReactPapercupsRun = WitnessRealAppRun & {
	zeroServiceWorkerRuntime: WitnessReactPapercupsZeroServiceWorker;
	behaviorDigest: string;
};

export type WitnessReactPapercupsMutation = {
	failure: 'witness-semantic-assertion';
	intendedFailure: true;
	lane: 'migrated';
	seam: string;
	path: string;
	offset: number;
	beforeSha256: string;
	mutatedSha256: string;
	afterRestoreSha256: string;
	restoredByteIdentically: true;
	restoredRun: 'pass';
	restoredBehaviorDigest: string;
};

/**
 * Measured surface limitation. At 1280x720 every route the journey visits
 * reports `scrollHeight === clientHeight`, so there is no scroll distance to
 * exercise. Scroll is therefore omitted rather than simulated, and the omission
 * is recorded instead of being presented as coverage.
 */
export type WitnessReactPapercupsScrollSurface = {
	state: 'omitted-not-meaningful';
	viewport: { width: 1280; height: 720 };
	observation: 'scrollHeight-equals-clientHeight-on-every-visited-route';
	claimed: false;
};

export type WitnessReactPapercupsReceipt = {
	schemaVersion: typeof WITNESS_REACT_PAPERCUPS_SCHEMA;
	result: 'pass';
	fixture: typeof REACT_PAPERCUPS_FIXTURE;
	source: typeof REACT_PAPERCUPS_SOURCE;
	provenance: Record<string, unknown>;
	canonicalReceipt: { path: string; canonicalDigest: string; sha256: string };
	runs: WitnessReactPapercupsRun[];
	mutation: WitnessReactPapercupsMutation;
	zeroServiceWorker: WitnessReactPapercupsZeroServiceWorker;
	scrollSurface: WitnessReactPapercupsScrollSurface;
	readiness: {
		reactLineage: { ready: 1; total: 4; counted: false };
		overall: { ready: 3; total: 12 };
	};
	locality: { mode: 'offline'; successfulNonLoopback: 0; osWideIsolation: false };
	nonclaims: string[];
	integrity: { algorithm: 'sha256'; canonicalDigest: string };
};

const exact = (left: unknown, right: unknown): boolean =>
	canonicalize(left) === canonicalize(right);

export function witnessReactPapercupsRawDigest(
	run: WitnessReactPapercupsRun | WitnessRealAppRun,
): string {
	const { pass: _pass, result: _result, semanticDigest: _semanticDigest, ...raw } = run;
	const withoutBehavior = { ...raw } as Record<string, unknown>;
	delete withoutBehavior.behaviorDigest;
	return sha256(canonicalize(withoutBehavior));
}

/**
 * Deterministic tracked-event floor.
 *
 * The typed, clicked, changed and keyed counts are exact and identical in every
 * lane and pass, so they are pinned. Incidental `mouseover` events depend on the
 * pointer path the host takes between the three genuine hovers, so the count is
 * bounded from below by those hovers instead of being pinned to an unstable
 * number. The bound is checked, not erased.
 */
export const WITNESS_REACT_PAPERCUPS_TRACKED_EVENTS = Object.freeze({
	change: 3,
	click: 5,
	input: 124,
	keydown: 125,
	mouseoverAtLeast: 3,
});

function trackedEventProjection(run: WitnessRealAppRun): Record<string, unknown> {
	const counts = run.witnessRecord.trackedEventCounts;
	const mouseover = counts.mouseover ?? 0;
	if (
		counts.change !== WITNESS_REACT_PAPERCUPS_TRACKED_EVENTS.change ||
		counts.click !== WITNESS_REACT_PAPERCUPS_TRACKED_EVENTS.click ||
		counts.input !== WITNESS_REACT_PAPERCUPS_TRACKED_EVENTS.input ||
		counts.keydown !== WITNESS_REACT_PAPERCUPS_TRACKED_EVENTS.keydown ||
		mouseover < WITNESS_REACT_PAPERCUPS_TRACKED_EVENTS.mouseoverAtLeast ||
		Object.keys(counts).sort().join(',') !== 'change,click,input,keydown,mouseover'
	)
		throw new Error('React Papercups tracked browser events differ');
	return {
		change: counts.change,
		click: counts.click,
		input: counts.input,
		keydown: counts.keydown,
		mouseover: `at-least-${WITNESS_REACT_PAPERCUPS_TRACKED_EVENTS.mouseoverAtLeast}-genuine-hovers`,
	};
}

/**
 * Lane-independent behavior projection. Production bytes are lane-specific by
 * construction, so the byte inventory stays in the run record and out of this
 * digest, while every user-observable signal and the runtime zero-worker
 * evidence stay inside it.
 */
export function witnessReactPapercupsBehaviorDigest(
	run: WitnessReactPapercupsRun | WitnessRealAppRun,
): string {
	const zero = (run as WitnessReactPapercupsRun).zeroServiceWorkerRuntime;
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
				trackedEventCounts: trackedEventProjection(run),
			},
			cleanPage: run.cleanPage,
			offlineEvidence: run.offlineEvidence,
			servedStaticPolicy: {
				transport: run.servedStatic.transport,
				documentFallback: run.servedStatic.documentFallback,
				missingAssets: run.servedStatic.missingAssets,
				traversal: run.servedStatic.traversal,
				byteIdentical: run.servedStatic.byteIdentical,
				hmrControls: run.servedStatic.hmrControls,
			},
			zeroServiceWorkerRuntime: {
				registration: zero?.registration,
				checkpoints: zero?.checkpoints,
				requests: zero?.requests,
				workerEvents: zero?.workerEvents,
			},
			successfulNonLoopback: run.successfulNonLoopback,
		}),
	);
}

export function witnessReactPapercupsDigest(receipt: WitnessReactPapercupsReceipt): string {
	const copy = structuredClone(receipt);
	copy.integrity.canonicalDigest = '';
	return sha256(canonicalize(copy));
}

function assertZeroServiceWorker(
	zero: WitnessReactPapercupsZeroServiceWorker | undefined,
	label: string,
): void {
	if (
		zero === undefined ||
		zero.registration !== 'application-unregister' ||
		!Array.isArray(zero.emittedOutputFiles) ||
		!exact(zero.requests, []) ||
		!exact(zero.workerEvents, []) ||
		!Array.isArray(zero.checkpoints) ||
		zero.checkpoints.length !== 3 ||
		canonicalize(zero.checkpoints.map((checkpoint) => checkpoint.phase)) !==
			canonicalize(['before-interactions', 'after-interactions', 'after-online-reload']) ||
		zero.checkpoints.some(
			(checkpoint) =>
				checkpoint.state !== 'timeout' ||
				checkpoint.registrations !== 0 ||
				checkpoint.controller !== null ||
				checkpoint.cacheNames.length !== 0 ||
				checkpoint.workerEvents.length !== 0,
		)
	)
		throw new Error(`React Papercups runtime zero-service-worker evidence differs: ${label}`);
}

export function parseWitnessReactPapercupsReceipt(value: unknown): WitnessReactPapercupsReceipt {
	if (value === null || typeof value !== 'object' || Array.isArray(value))
		throw new Error('React Papercups Witness receipt must be an object');
	const receipt = value as WitnessReactPapercupsReceipt;
	const expectedRuns = new Set(['baseline:1', 'baseline:2', 'migrated:1', 'migrated:2']);
	const behaviors = new Set<string>();
	if (
		receipt.schemaVersion !== WITNESS_REACT_PAPERCUPS_SCHEMA ||
		receipt.result !== 'pass' ||
		receipt.fixture !== REACT_PAPERCUPS_FIXTURE ||
		!exact(receipt.source, REACT_PAPERCUPS_SOURCE) ||
		receipt.canonicalReceipt?.path !== REACT_PAPERCUPS_RECEIPT_PATH ||
		receipt.canonicalReceipt.canonicalDigest !== REACT_PAPERCUPS_CANONICAL_DIGEST ||
		receipt.canonicalReceipt.sha256 !== REACT_PAPERCUPS_RECEIPT_SHA256 ||
		!Array.isArray(receipt.runs) ||
		receipt.runs.length !== 4
	)
		throw new Error('React Papercups Witness binding differs');
	for (const run of receipt.runs) {
		const key = `${run.lane}:${run.pass}`;
		if (
			!expectedRuns.delete(key) ||
			run.app !== 'papercups' ||
			run.framework !== 'react' ||
			run.result !== 'pass' ||
			run.cleanPage !== true ||
			run.successfulNonLoopback !== 0 ||
			run.witnessRecord.consoleErrors !== 0 ||
			run.witnessRecord.pageErrors !== 0 ||
			run.witnessRecord.failedRequests !== 0 ||
			run.offlineEvidence.state !== 'not-applicable' ||
			run.observerFinalization.workerEvents.length !== 0 ||
			run.semanticDigest !== witnessReactPapercupsRawDigest(run) ||
			run.behaviorDigest !== witnessReactPapercupsBehaviorDigest(run) ||
			!exact(run.routes, [
				'/conversations',
				'/conversations/all',
				'/conversations/priority',
				'/conversations/closed',
				'/conversations/all',
				'/conversations/all',
			])
		)
			throw new Error(`React Papercups Witness run differs: ${key}`);
		assertZeroServiceWorker(run.zeroServiceWorkerRuntime, key);
		behaviors.add(run.behaviorDigest);
	}
	assertZeroServiceWorker(receipt.zeroServiceWorker, 'receipt');
	if (
		expectedRuns.size !== 0 ||
		behaviors.size !== 1 ||
		receipt.mutation?.intendedFailure !== true ||
		receipt.mutation.failure !== 'witness-semantic-assertion' ||
		receipt.mutation.lane !== 'migrated' ||
		receipt.mutation.restoredByteIdentically !== true ||
		receipt.mutation.restoredRun !== 'pass' ||
		receipt.mutation.beforeSha256 !== receipt.mutation.afterRestoreSha256 ||
		receipt.mutation.beforeSha256 === receipt.mutation.mutatedSha256 ||
		!behaviors.has(receipt.mutation.restoredBehaviorDigest) ||
		!exact(receipt.scrollSurface, {
			state: 'omitted-not-meaningful',
			viewport: { width: 1280, height: 720 },
			observation: 'scrollHeight-equals-clientHeight-on-every-visited-route',
			claimed: false,
		}) ||
		!exact(receipt.readiness, {
			reactLineage: { ready: 1, total: 4, counted: false },
			overall: { ready: 3, total: 12 },
		}) ||
		receipt.locality?.mode !== 'offline' ||
		receipt.locality.successfulNonLoopback !== 0 ||
		receipt.locality.osWideIsolation !== false ||
		!Array.isArray(receipt.nonclaims) ||
		receipt.nonclaims.length === 0 ||
		receipt.integrity?.algorithm !== 'sha256' ||
		receipt.integrity.canonicalDigest !== witnessReactPapercupsDigest(receipt)
	)
		throw new Error('React Papercups Witness integrity differs');
	return receipt;
}

export function renderWitnessReactPapercupsReceipt(receipt: WitnessReactPapercupsReceipt): string {
	const emitted = receipt.runs
		.flatMap((run) => run.zeroServiceWorkerRuntime.emittedOutputFiles.map((file) => file.path))
		.sort();
	return `# Papercups v1.0.0 — direct Witness browser proof

- Result: pass
- Canonical SHA-256: ${receipt.integrity.canonicalDigest}
- Runs: 2 baseline + 2 migrated production-static browser journeys
- Behavioral parity: ${receipt.runs[0]!.behaviorDigest}
- Journey: sign-in, inbox triage across all/prioritized/closed, reply round-trip over the Phoenix shout broadcast, online reload
- Service worker: the application calls \`serviceWorker.unregister()\`; zero registrations, controller, CacheStorage names, lifecycle events, and worker requests at three checkpoints in every pass
- Retained but unregistered worker output: ${emitted.length === 0 ? 'none' : uniqueSorted(emitted).join(', ')}
- Mutation proof: \`${receipt.mutation.seam}\` in \`${receipt.mutation.path}\` at offset ${receipt.mutation.offset} made the journey red, byte-identical restoration made it green again
- Scroll: ${receipt.scrollSurface.state} — ${receipt.scrollSurface.observation} at ${receipt.scrollSurface.viewport.width}x${receipt.scrollSurface.viewport.height}
- React lineage readiness: unchanged at ${receipt.readiness.reactLineage.ready}/${receipt.readiness.reactLineage.total}; this vertical is not counted

${receipt.nonclaims.map((claim) => `- ${claim}`).join('\n')}
`;
}

function uniqueSorted(values: readonly string[]): string[] {
	return [...new Set(values)].sort();
}

export function witnessReactPapercupsAggregateMember(digestValue: string) {
	return {
		id: 'witness-react-papercups',
		framework: 'react',
		track: 'production-readiness-direct-witness-create-react-app-to-vite8',
		bundler: 'webpack-4.42.0-to-vite-8.0.16',
		runtime: 'node-16.20.2-to-node-24.15.0',
		result: 'pass',
		receipt: WITNESS_REACT_PAPERCUPS_RECEIPT_PATH,
		digest: digestValue,
	};
}

export function reactPapercupsAggregateMember(digestValue: string) {
	return {
		id: REACT_PAPERCUPS_FIXTURE,
		framework: 'react',
		track: 'create-react-app-3.4.1-to-vite8-build',
		bundler: 'webpack-4.42.0-to-vite-8.0.16',
		runtime: 'node-16.20.2-to-node-24.15.0',
		result: 'pass',
		receipt: REACT_PAPERCUPS_RECEIPT_PATH,
		digest: digestValue,
	};
}

export async function verifyWitnessReactPapercupsEvidence(rootDir = '.') {
	const root = resolve(rootDir);
	const receiptPath = join(root, WITNESS_REACT_PAPERCUPS_RECEIPT_PATH);
	const receipt = parseWitnessReactPapercupsReceipt(
		JSON.parse(await readFile(receiptPath, 'utf8')),
	);
	const canonicalBytes = await readFile(join(root, receipt.canonicalReceipt.path));
	if (sha256(canonicalBytes) !== receipt.canonicalReceipt.sha256)
		throw new Error('React Papercups canonical receipt bytes drifted');
	const canonical = JSON.parse(canonicalBytes.toString('utf8')) as {
		runId?: unknown;
		fixture?: unknown;
		stage?: unknown;
		integrity?: { canonicalDigest?: unknown };
	};
	if (
		canonical.runId !== REACT_PAPERCUPS_RUN_ID ||
		canonical.fixture !== REACT_PAPERCUPS_FIXTURE ||
		canonical.stage !== 'build' ||
		canonical.integrity?.canonicalDigest !== receipt.canonicalReceipt.canonicalDigest
	)
		throw new Error('React Papercups canonical receipt identity differs');
	if (
		(await readFile(join(dirname(receiptPath), 'receipt.md'), 'utf8')) !==
		renderWitnessReactPapercupsReceipt(receipt)
	)
		throw new Error('React Papercups human Witness receipt differs');
	return {
		valid: true as const,
		digest: receipt.integrity.canonicalDigest,
		artifacts: 0,
		receipt,
	};
}
