import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	parseWitnessReactHospitalrunReceipt,
	REACT_HOSPITALRUN_CANONICAL_DIGEST,
	REACT_HOSPITALRUN_RECEIPT_PATH,
	renderWitnessReactHospitalrunReceipt,
	verifyWitnessReactHospitalrunEvidence,
	WITNESS_REACT_HOSPITALRUN_CONSOLE_ERRORS,
	WITNESS_REACT_HOSPITALRUN_FAILED_REQUESTS,
	WITNESS_REACT_HOSPITALRUN_RECEIPT_PATH,
	WITNESS_REACT_HOSPITALRUN_REGISTRATION_ATTEMPTS,
	WITNESS_REACT_HOSPITALRUN_ROUTES,
	WITNESS_REACT_HOSPITALRUN_SERVICE_WORKER_REQUESTS,
	witnessReactHospitalrunBehaviorDigest,
	witnessReactHospitalrunDigest,
	witnessReactHospitalrunRawDigest,
	type WitnessReactHospitalrunReceipt,
} from '../src/receipts/witness-react-hospitalrun.ts';

const root = path.resolve(import.meta.dirname, '../../..');

async function published(): Promise<WitnessReactHospitalrunReceipt> {
	return parseWitnessReactHospitalrunReceipt(
		JSON.parse(
			await readFile(path.join(root, WITNESS_REACT_HOSPITALRUN_RECEIPT_PATH), 'utf8'),
		) as unknown,
	);
}

function resealed(receipt: WitnessReactHospitalrunReceipt): WitnessReactHospitalrunReceipt {
	const copy = structuredClone(receipt);
	copy.integrity.canonicalDigest = witnessReactHospitalrunDigest(copy);
	return copy;
}

/**
 * Reseals a tampered receipt as thoroughly as a forger could: every per-run
 * digest is recomputed over the edited content before the receipt digest is
 * sealed. The digests therefore cannot be what rejects the edit, which is the
 * point — each test below has to be caught by the specific evidence check it
 * targets rather than by a hash that happened to stop it first.
 */
function resealedDeep(receipt: WitnessReactHospitalrunReceipt): WitnessReactHospitalrunReceipt {
	const copy = structuredClone(receipt);
	for (const run of copy.runs) {
		run.semanticDigest = witnessReactHospitalrunRawDigest(run);
		run.behaviorDigest = witnessReactHospitalrunBehaviorDigest(run);
	}
	copy.integrity.canonicalDigest = witnessReactHospitalrunDigest(copy);
	return copy;
}

describe('HospitalRun direct Witness receipt', () => {
	it('verifies the published browser proof and its rendered companion', async () => {
		const verified = await verifyWitnessReactHospitalrunEvidence(root);
		expect(verified.valid).toBe(true);
		expect(verified.receipt.result).toBe('pass');
		expect(verified.receipt.runs).toHaveLength(4);
		expect(verified.receipt.canonicalReceipt.path).toBe(REACT_HOSPITALRUN_RECEIPT_PATH);
		expect(verified.receipt.canonicalReceipt.canonicalDigest).toBe(
			REACT_HOSPITALRUN_CANONICAL_DIGEST,
		);
		expect(
			await readFile(
				path.join(root, path.dirname(WITNESS_REACT_HOSPITALRUN_RECEIPT_PATH), 'receipt.md'),
				'utf8',
			),
		).toBe(renderWitnessReactHospitalrunReceipt(verified.receipt));
	});

	it('proves one behavior across both lanes and both passes', async () => {
		const receipt = await published();
		const digests = new Set(receipt.runs.map((run) => run.behaviorDigest));
		expect(digests.size).toBe(1);
		expect([...digests]).toEqual([receipt.mutation.restoredBehaviorDigest]);
		expect(receipt.runs.map((run) => `${run.lane}:${run.pass}`).sort()).toEqual([
			'baseline:1',
			'baseline:2',
			'migrated:1',
			'migrated:2',
		]);
		for (const run of receipt.runs)
			expect(witnessReactHospitalrunBehaviorDigest(run)).toBe(run.behaviorDigest);
	});

	it('drives the whole clinical journey rather than a page load', async () => {
		const receipt = await published();
		for (const run of receipt.runs) {
			expect(run.routes).toEqual([...WITNESS_REACT_HOSPITALRUN_ROUTES]);
			const kinds = run.interactions.map((interaction) => interaction.kind);
			expect(kinds).toContain('type');
			expect(kinds).toContain('hover');
			expect(kinds).toContain('scroll');
			expect(kinds.filter((kind) => kind === 'click').length).toBeGreaterThanOrEqual(10);
		}
		expect(receipt.persistence).toEqual({
			store: 'browser-local-pouchdb',
			stubbed: false,
			survivesOnlineReload: true,
		});
	});

	it('claims scroll only where the document genuinely overflows the viewport', async () => {
		const receipt = await published();
		expect(receipt.scrollSurface.state).toBe('measured-genuine-viewport-scroll');
		expect(receipt.scrollSurface.route).toBe('/appointments');
		expect(receipt.scrollSurface.viewport).toEqual({ width: 1280, height: 720 });
		expect(receipt.scrollSurface.clientHeight).toBe(720);
		expect(receipt.scrollSurface.scrollHeight).toBeGreaterThan(
			receipt.scrollSurface.clientHeight,
		);
		expect(receipt.nonclaims.join('\n')).toContain('Scroll is claimed only for');
	});

	it('accounts for every console error exactly instead of allowing them', async () => {
		const receipt = await published();
		expect(receipt.consoleErrors).toEqual(WITNESS_REACT_HOSPITALRUN_CONSOLE_ERRORS);
		for (const run of receipt.runs) {
			expect(run.consoleErrorInventory.policy).toBe(
				'exact-app-scoped-expected-console-errors',
			);
			expect(run.consoleErrorInventory.outsideInventory).toEqual([]);
			expect(run.consoleErrorInventory.observed).toEqual(run.consoleErrorInventory.expected);
			expect(run.witnessRecord.consoleErrors).toBe(run.consoleErrorInventory.total);
		}
		const baseline = receipt.runs.find((run) => run.lane === 'baseline');
		const migrated = receipt.runs.find((run) => run.lane === 'migrated');
		expect(baseline?.consoleErrorInventory.observed[0]?.message).toContain(
			'Error during service worker registration',
		);
		expect(migrated?.consoleErrorInventory.observed[0]?.message).toContain('404 (Not Found)');
	});

	it('accounts for every failed request exactly instead of allowing them', async () => {
		const receipt = await published();
		expect(receipt.failedRequests).toEqual(WITNESS_REACT_HOSPITALRUN_FAILED_REQUESTS);
		for (const run of receipt.runs) {
			expect(run.failedRequestInventory.policy).toBe(
				'exact-app-scoped-expected-failed-requests',
			);
			expect(run.failedRequestInventory.outsideInventory).toEqual([]);
			expect(run.witnessRecord.failedRequests).toBe(run.failedRequestInventory.total);
			expect(run.failedRequestInventory.observed).toEqual([
				{ method: 'GET', path: '/service-worker.js', reason: 'net::ERR_ABORTED', count: 2 },
			]);
		}
	});

	it('records the refused registration and the baseline/target worker difference', async () => {
		const receipt = await published();
		expect(receipt.serviceWorkerDifference.masked).toBe(false);
		for (const run of receipt.runs) {
			expect(run.blockedServiceWorkerRuntime.registration).toBe(
				'application-register-refused-by-context',
			);
			expect(run.blockedServiceWorkerRuntime.workerEvents).toEqual([]);
			expect(
				run.blockedServiceWorkerRuntime.requests.filter(
					(event) => event.source === 'browser' && event.phase === 'request',
				),
			).toHaveLength(WITNESS_REACT_HOSPITALRUN_REGISTRATION_ATTEMPTS);
			expect(run.blockedServiceWorkerRuntime.requestTally).toEqual(
				expect.arrayContaining([...WITNESS_REACT_HOSPITALRUN_SERVICE_WORKER_REQUESTS[run.lane]]),
			);
			for (const checkpoint of run.blockedServiceWorkerRuntime.checkpoints) {
				expect(checkpoint.registrations).toBe(0);
				expect(checkpoint.controller).toBeNull();
				expect(checkpoint.cacheNames).toEqual([]);
				expect(checkpoint.workerEvents).toEqual([]);
			}
		}
		const baseline = receipt.runs.filter((run) => run.lane === 'baseline');
		const migrated = receipt.runs.filter((run) => run.lane === 'migrated');
		expect(
			baseline.map((run) =>
				run.blockedServiceWorkerRuntime.emittedOutputFiles.map((file) => file.path),
			),
		).toEqual([['service-worker.js'], ['service-worker.js']]);
		expect(migrated.map((run) => run.blockedServiceWorkerRuntime.emittedOutputFiles)).toEqual([
			[],
			[],
		]);
	});

	it('states plainly that neither lane has a silent console', async () => {
		const receipt = await published();
		expect(receipt.nonclaims.join('\n')).toContain('Neither lane has a silent console');
		expect(receipt.nonclaims.join('\n')).toContain('not counted');
	});

	it('rejects a console error smuggled in outside the pinned inventory', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		tampered.runs[0]!.consoleErrorInventory.observed = [
			...tampered.runs[0]!.consoleErrorInventory.observed,
			{ message: 'Uncaught TypeError: patients is undefined', count: 1 },
		];
		expect(() => parseWitnessReactHospitalrunReceipt(resealedDeep(tampered))).toThrow(
			/console-error inventory differs/,
		);
	});

	it('rejects a failed request smuggled in outside the pinned inventory', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		tampered.runs[0]!.failedRequestInventory.observed = [
			...tampered.runs[0]!.failedRequestInventory.observed,
			{ method: 'GET', path: '/api/patients', reason: 'net::ERR_FAILED', count: 1 },
		];
		expect(() => parseWitnessReactHospitalrunReceipt(resealedDeep(tampered))).toThrow(
			/failed-request inventory differs/,
		);
	});

	it('rejects a worker-script trace edited to hide what the server answered', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		const migrated = tampered.runs.find((run) => run.lane === 'migrated');
		migrated!.blockedServiceWorkerRuntime.requests =
			migrated!.blockedServiceWorkerRuntime.requests.filter(
				(event) => event.detail.status !== 404,
			);
		expect(() => parseWitnessReactHospitalrunReceipt(resealedDeep(tampered))).toThrow(
			/worker-script trace differs/,
		);
	});

	it('rejects a masked service-worker registration', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		tampered.runs[0]!.blockedServiceWorkerRuntime.checkpoints[1]!.registrations = 1 as 0;
		expect(() => parseWitnessReactHospitalrunReceipt(resealedDeep(tampered))).toThrow(
			/blocked service-worker/,
		);
	});

	it('rejects a CacheStorage name hidden from the checkpoints', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		tampered.blockedServiceWorker.checkpoints[0]!.cacheNames = [
			'hospitalrun-precache',
		] as unknown as [];
		expect(() => parseWitnessReactHospitalrunReceipt(resealed(tampered))).toThrow(
			/blocked service-worker/,
		);
	});

	it('rejects a dropped route from the clinical journey', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		tampered.runs[0]!.routes = tampered.runs[0]!.routes.filter((route) => route !== '/labs');
		expect(() => parseWitnessReactHospitalrunReceipt(resealed(tampered))).toThrow(
			/Witness run differs/,
		);
	});

	it('rejects a scroll claim on a document that does not overflow', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		tampered.runs[0]!.scrollSurface.scrollHeight = 720;
		expect(() => parseWitnessReactHospitalrunReceipt(resealedDeep(tampered))).toThrow(
			/scroll surface differs/,
		);
	});

	it('rejects a mutation that did not restore byte-identically', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		tampered.mutation.afterRestoreSha256 = '0'.repeat(64);
		expect(() => parseWitnessReactHospitalrunReceipt(resealed(tampered))).toThrow(/integrity/);
	});

	it('rejects a mutation whose bytes never actually changed', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		tampered.mutation.mutatedSha256 = tampered.mutation.beforeSha256;
		expect(() => parseWitnessReactHospitalrunReceipt(resealed(tampered))).toThrow(/integrity/);
	});

	it('rejects a rebound canonical build receipt', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		tampered.canonicalReceipt.canonicalDigest = '1'.repeat(64);
		expect(() => parseWitnessReactHospitalrunReceipt(resealed(tampered))).toThrow(/binding/);
	});

	it('rejects a dropped pass', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		tampered.runs = tampered.runs.slice(0, 3);
		expect(() => parseWitnessReactHospitalrunReceipt(resealed(tampered))).toThrow(/binding/);
	});

	it('rejects a receipt whose declared digest does not seal its content', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		tampered.nonclaims = [];
		expect(() => parseWitnessReactHospitalrunReceipt(tampered)).toThrow(/integrity/);
	});

	it('keeps the vertical uncounted until the Judge audits it', async () => {
		const receipt = await published();
		expect(receipt.readiness).toEqual({
			reactLineage: { ready: 1, total: 4, counted: false },
			overall: { ready: 3, total: 12 },
		});
		expect(receipt.locality).toEqual({
			mode: 'offline',
			successfulNonLoopback: 0,
			osWideIsolation: false,
		});
	});
});
