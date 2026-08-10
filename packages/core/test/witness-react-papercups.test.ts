import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import { deriveCorpusTransactionState } from '../src/corpus/conformance.ts';
import {
	parseWitnessReactPapercupsReceipt,
	REACT_PAPERCUPS_CANONICAL_DIGEST,
	REACT_PAPERCUPS_RECEIPT_PATH,
	reactPapercupsAggregateMember,
	renderWitnessReactPapercupsReceipt,
	verifyWitnessReactPapercupsEvidence,
	WITNESS_REACT_PAPERCUPS_RECEIPT_PATH,
	witnessReactPapercupsAggregateMember,
	witnessReactPapercupsBehaviorDigest,
	witnessReactPapercupsDigest,
	type WitnessReactPapercupsReceipt,
} from '../src/receipts/witness-react-papercups.ts';

const root = path.resolve(import.meta.dirname, '../../..');

async function published(): Promise<WitnessReactPapercupsReceipt> {
	return parseWitnessReactPapercupsReceipt(
		JSON.parse(
			await readFile(path.join(root, WITNESS_REACT_PAPERCUPS_RECEIPT_PATH), 'utf8'),
		) as unknown,
	);
}

function resealed(receipt: WitnessReactPapercupsReceipt): WitnessReactPapercupsReceipt {
	const copy = structuredClone(receipt);
	copy.integrity.canonicalDigest = witnessReactPapercupsDigest(copy);
	return copy;
}

describe('Papercups direct Witness receipt', () => {
	it('verifies the published browser proof and its rendered companion', async () => {
		const verified = await verifyWitnessReactPapercupsEvidence(root);
		expect(verified.valid).toBe(true);
		expect(verified.receipt.result).toBe('pass');
		expect(verified.receipt.runs).toHaveLength(4);
		expect(verified.receipt.canonicalReceipt.path).toBe(REACT_PAPERCUPS_RECEIPT_PATH);
		expect(verified.receipt.canonicalReceipt.canonicalDigest).toBe(
			REACT_PAPERCUPS_CANONICAL_DIGEST,
		);
		expect(
			await readFile(
				path.join(root, path.dirname(WITNESS_REACT_PAPERCUPS_RECEIPT_PATH), 'receipt.md'),
				'utf8',
			),
		).toBe(renderWitnessReactPapercupsReceipt(verified.receipt));
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
			expect(witnessReactPapercupsBehaviorDigest(run)).toBe(run.behaviorDigest);
	});

	it('records the retained but unregistered create-react-app worker without masking it', async () => {
		const receipt = await published();
		const baseline = receipt.runs.filter((run) => run.lane === 'baseline');
		const migrated = receipt.runs.filter((run) => run.lane === 'migrated');
		expect(
			baseline.map((run) =>
				run.zeroServiceWorkerRuntime.emittedOutputFiles.map((file) => file.path),
			),
		).toEqual([['service-worker.js'], ['service-worker.js']]);
		expect(
			migrated.map((run) => run.zeroServiceWorkerRuntime.emittedOutputFiles),
		).toEqual([[], []]);
		expect(receipt.zeroServiceWorker.emittedOutputFiles.map((file) => file.path)).toEqual([
			'service-worker.js',
		]);
		for (const run of receipt.runs) {
			expect(run.zeroServiceWorkerRuntime.registration).toBe('application-unregister');
			expect(run.zeroServiceWorkerRuntime.requests).toEqual([]);
			expect(run.zeroServiceWorkerRuntime.workerEvents).toEqual([]);
			expect(run.zeroServiceWorkerRuntime.checkpoints.map((item) => item.phase)).toEqual([
				'before-interactions',
				'after-interactions',
				'after-online-reload',
			]);
			for (const checkpoint of run.zeroServiceWorkerRuntime.checkpoints) {
				expect(checkpoint.registrations).toBe(0);
				expect(checkpoint.controller).toBeNull();
				expect(checkpoint.cacheNames).toEqual([]);
				expect(checkpoint.workerEvents).toEqual([]);
			}
		}
	});

	it('records the measured scroll limitation instead of claiming coverage', async () => {
		const receipt = await published();
		expect(receipt.scrollSurface).toEqual({
			state: 'omitted-not-meaningful',
			viewport: { width: 1280, height: 720 },
			observation: 'scrollHeight-equals-clientHeight-on-every-visited-route',
			claimed: false,
		});
		expect(receipt.readiness.reactLineage).toEqual({ ready: 1, total: 4, counted: false });
		expect(receipt.nonclaims.join('\n')).toContain('does not establish generic React');
	});

	it('rejects a masked service-worker registration', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		tampered.runs[0]!.zeroServiceWorkerRuntime.checkpoints[1]!.registrations = 1 as 0;
		expect(() => parseWitnessReactPapercupsReceipt(resealed(tampered))).toThrow(
			/Witness run differs/,
		);
	});

	it('rejects a CacheStorage name hidden from the checkpoints', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		tampered.zeroServiceWorker.checkpoints[0]!.cacheNames = ['papercups-precache'] as unknown as [];
		expect(() => parseWitnessReactPapercupsReceipt(resealed(tampered))).toThrow(
			/zero-service-worker/,
		);
	});

	it('rejects a mutation that did not restore byte-identically', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		tampered.mutation.afterRestoreSha256 = '0'.repeat(64);
		expect(() => parseWitnessReactPapercupsReceipt(resealed(tampered))).toThrow(/integrity/);
	});

	it('rejects a mutation whose bytes never actually changed', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		tampered.mutation.mutatedSha256 = tampered.mutation.beforeSha256;
		expect(() => parseWitnessReactPapercupsReceipt(resealed(tampered))).toThrow(/integrity/);
	});

	it('rejects a rebound canonical build receipt', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		tampered.canonicalReceipt.canonicalDigest = '1'.repeat(64);
		expect(() => parseWitnessReactPapercupsReceipt(resealed(tampered))).toThrow(/binding/);
	});

	it('rejects a dropped pass', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		tampered.runs = tampered.runs.slice(0, 3);
		expect(() => parseWitnessReactPapercupsReceipt(resealed(tampered))).toThrow(/binding/);
	});

	it('rejects a receipt whose declared digest does not seal its content', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		tampered.nonclaims = [];
		expect(() => parseWitnessReactPapercupsReceipt(tampered)).toThrow(/integrity/);
	});
});

describe('Papercups corpus transaction state', () => {
	async function aggregateFixtures(): Promise<Array<Record<string, unknown>>> {
		const aggregate = JSON.parse(
			await readFile(path.join(root, 'evidence/runs/aggregate.json'), 'utf8'),
		) as { fixtures: Array<Record<string, unknown>> };
		return aggregate.fixtures;
	}

	const migrationMember = reactPapercupsAggregateMember(REACT_PAPERCUPS_CANONICAL_DIGEST);

	it('derives the exact composition once both Papercups receipts join', async () => {
		const receipt = await published();
		const fixtures = [
			...(await aggregateFixtures()),
			migrationMember,
			witnessReactPapercupsAggregateMember(receipt.integrity.canonicalDigest),
		];
		expect(fixtures).toHaveLength(18);
		expect(deriveCorpusTransactionState(fixtures)).toEqual({
			kind: 'react-papercups-browser-proof',
			nextKilledByGoogleIntegrated: true,
			angularRealworldWitnessIntegrated: true,
			reactBoilerplateWitnessIntegrated: true,
			nextKilledByGoogleWitnessIntegrated: true,
			verticals: 12,
			sourceApplications: 5,
			receipts: 18,
			resolvedDependencies: 31,
		});
	});

	it('refuses the Witness receipt without its retained build receipt', async () => {
		const receipt = await published();
		const fixtures = [
			...(await aggregateFixtures()),
			witnessReactPapercupsAggregateMember(receipt.integrity.canonicalDigest),
		];
		expect(() => deriveCorpusTransactionState(fixtures)).toThrow(/Papercups/);
	});

	it('refuses a reordered Papercups tail', async () => {
		const receipt = await published();
		const fixtures = [
			...(await aggregateFixtures()),
			witnessReactPapercupsAggregateMember(receipt.integrity.canonicalDigest),
			migrationMember,
		];
		expect(() => deriveCorpusTransactionState(fixtures)).toThrow();
	});

	it('refuses an unexpected extra member alongside the Papercups tail', async () => {
		const receipt = await published();
		const fixtures = [
			...(await aggregateFixtures()),
			migrationMember,
			witnessReactPapercupsAggregateMember(receipt.integrity.canonicalDigest),
			{ ...migrationMember, id: 'react-papercups-shadow', receipt: 'evidence/runs/shadow.json' },
		];
		expect(() => deriveCorpusTransactionState(fixtures)).toThrow(/Papercups/);
	});

	it('refuses a Papercups member whose shape drifts from the canonical row', async () => {
		const receipt = await published();
		const fixtures = [
			...(await aggregateFixtures()),
			{ ...migrationMember, track: 'production-ready' },
			witnessReactPapercupsAggregateMember(receipt.integrity.canonicalDigest),
		];
		expect(() => deriveCorpusTransactionState(fixtures)).toThrow(/Papercups/);
	});

	it('keeps the zero-service-worker state when Papercups has not joined', async () => {
		expect(deriveCorpusTransactionState(await aggregateFixtures())).toEqual({
			kind: 'react-zero-sw-reconciliation',
			nextKilledByGoogleIntegrated: true,
			angularRealworldWitnessIntegrated: true,
			reactBoilerplateWitnessIntegrated: true,
			nextKilledByGoogleWitnessIntegrated: true,
			verticals: 11,
			sourceApplications: 4,
			receipts: 16,
			resolvedDependencies: 29,
		});
	});
});
