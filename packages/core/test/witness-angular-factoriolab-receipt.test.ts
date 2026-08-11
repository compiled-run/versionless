import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	ANGULAR_FACTORIOLAB_CANONICAL_RECEIPTS,
	parseWitnessAngularFactoriolabReceipt,
	renderWitnessAngularFactoriolabReceipt,
	verifyWitnessAngularFactoriolabEvidence,
	WITNESS_ANGULAR_FACTORIOLAB_CANCELLED_DUPLICATE_FETCHES,
	WITNESS_ANGULAR_FACTORIOLAB_RECEIPT_PATH,
	WITNESS_ANGULAR_FACTORIOLAB_ROUTES,
	witnessAngularFactoriolabBehaviorDigest,
	witnessAngularFactoriolabDigest,
	witnessAngularFactoriolabRawDigest,
	type WitnessAngularFactoriolabReceipt,
} from '../src/receipts/witness-angular-factoriolab.ts';
import { WITNESS_CANCELLED_DUPLICATE_FETCH_RULE } from '../src/receipts/witness-real-app.ts';

const root = path.resolve(import.meta.dirname, '../../..');

async function published(): Promise<WitnessAngularFactoriolabReceipt> {
	return parseWitnessAngularFactoriolabReceipt(
		JSON.parse(
			await readFile(path.join(root, WITNESS_ANGULAR_FACTORIOLAB_RECEIPT_PATH), 'utf8'),
		) as unknown,
	);
}

/**
 * Reseals a tampered receipt as thoroughly as a forger could: every per-run
 * digest is recomputed over the edited content before the receipt digest is
 * sealed, so no test below can be passing because a stale hash caught the edit
 * first. Each one has to be caught by the evidence check it targets.
 */
function resealedDeep(
	receipt: WitnessAngularFactoriolabReceipt,
): WitnessAngularFactoriolabReceipt {
	const copy = structuredClone(receipt);
	for (const run of copy.runs) {
		run.semanticDigest = witnessAngularFactoriolabRawDigest(run);
		run.behaviorDigest = witnessAngularFactoriolabBehaviorDigest(run);
	}
	copy.integrity.canonicalDigest = witnessAngularFactoriolabDigest(copy);
	return copy;
}

/** The published run that actually observed a cancelled duplicate. */
function racedIndex(receipt: WitnessAngularFactoriolabReceipt): number {
	const index = receipt.runs.findIndex(
		(run) => run.cancelledDuplicateFetches.observed.length > 0,
	);
	expect(index).toBeGreaterThanOrEqual(0);
	return index;
}

describe('Angular factoriolab direct Witness receipt', () => {
	it('verifies the published browser proof and its rendered companion', async () => {
		const verified = await verifyWitnessAngularFactoriolabEvidence(root);
		expect(verified.valid).toBe(true);
		expect(verified.receipt.result).toBe('pass');
		expect(verified.receipt.runs).toHaveLength(4);
		expect(verified.receipt.readiness.angularLineage.counted).toBe(false);
	});

	it('binds the three build-lane receipts and the pinned route sequence', async () => {
		const receipt = await published();
		expect(receipt.canonicalReceipts.map((bound) => bound.path)).toEqual(
			ANGULAR_FACTORIOLAB_CANONICAL_RECEIPTS.map((bound) => bound.path),
		);
		for (const run of receipt.runs) expect(run.routes).toEqual([...WITNESS_ANGULAR_FACTORIOLAB_ROUTES]);
	});

	it('holds every lane and pass to one behavior digest', async () => {
		const receipt = await published();
		expect(new Set(receipt.runs.map((run) => run.behaviorDigest)).size).toBe(1);
		expect(receipt.mutation.restoredBehaviorDigest).toBe(receipt.runs[0]!.behaviorDigest);
	});

	it('rejects a receipt whose rendered companion drifted', async () => {
		const receipt = await published();
		const copy = structuredClone(receipt);
		copy.nonclaims = [...copy.nonclaims, 'an unrecorded claim'];
		expect(renderWitnessAngularFactoriolabReceipt(copy)).not.toBe(
			renderWitnessAngularFactoriolabReceipt(receipt),
		);
	});

	it('rejects a resealed receipt whose mutation proof no longer went red', async () => {
		const receipt = await published();
		const copy = structuredClone(receipt);
		copy.mutation.mutatedSha256 = copy.mutation.beforeSha256;
		expect(() => parseWitnessAngularFactoriolabReceipt(resealedDeep(copy))).toThrow();
	});
});

describe('Angular factoriolab cancelled-duplicate-fetch category', () => {
	it('publishes the category, its rule, and every instance the runs observed', async () => {
		const receipt = await published();
		expect(receipt.cancelledDuplicateFetches.category).toEqual(
			WITNESS_ANGULAR_FACTORIOLAB_CANCELLED_DUPLICATE_FETCHES,
		);
		expect(receipt.cancelledDuplicateFetches.corroborationRule).toBe(
			WITNESS_CANCELLED_DUPLICATE_FETCH_RULE,
		);
		expect(receipt.cancelledDuplicateFetches.instances).toHaveLength(receipt.runs.length);
		for (const run of receipt.runs) {
			expect(run.cancelledDuplicateFetches.policy).toBe(
				'corroborated-browser-cancelled-duplicate-fetch',
			);
			expect(run.cancelledDuplicateFetches.uncorroborated).toEqual([]);
			// Every pinned member is accounted for, either observed or absent.
			expect(
				run.cancelledDuplicateFetches.observed.length +
					run.cancelledDuplicateFetches.absent.length,
			).toBe(run.cancelledDuplicateFetches.category.length);
		}
	});

	it('records each admitted instance with the successful fetches that corroborated it', async () => {
		const receipt = await published();
		const raced = receipt.runs[racedIndex(receipt)]!;
		for (const instance of raced.cancelledDuplicateFetches.observed) {
			expect(instance.path).toBe('/assets/transparent.gif');
			expect(instance.reason).toBe('net::ERR_ABORTED');
			expect(instance.cancelled).toBeGreaterThanOrEqual(1);
			expect(instance.corroboratingSuccesses).toBeGreaterThanOrEqual(1);
			expect(instance.corroboratingStatuses).toEqual([200]);
		}
	});

	it('keeps the category out of the behavior digest only where the count is the race', async () => {
		const receipt = await published();
		// The published runs disagree about whether the race happened at all,
		// and still share one behavior digest — that is the whole point.
		expect(
			new Set(receipt.runs.map((run) => run.cancelledDuplicateFetches.admitted)).size,
		).toBeGreaterThan(1);
		expect(new Set(receipt.runs.map((run) => run.behaviorDigest)).size).toBe(1);
		// The membership itself does participate: changing it changes the digest.
		const copy = structuredClone(receipt.runs[0]!);
		copy.cancelledDuplicateFetches.category = [
			{ method: 'GET', path: '/assets/other.gif', reason: 'net::ERR_ABORTED' },
		];
		expect(witnessAngularFactoriolabBehaviorDigest(copy)).not.toBe(
			receipt.runs[0]!.behaviorDigest,
		);
	});

	it('rejects an instance that claims no corroborating successful fetch', async () => {
		const receipt = await published();
		const copy = structuredClone(receipt);
		const raced = copy.runs[racedIndex(copy)]!;
		raced.cancelledDuplicateFetches.observed[0]!.corroboratingSuccesses = 0;
		raced.cancelledDuplicateFetches.observed[0]!.corroboratingStatuses = [];
		copy.cancelledDuplicateFetches.instances[racedIndex(copy)]!.observed =
			raced.cancelledDuplicateFetches.observed;
		expect(() => parseWitnessAngularFactoriolabReceipt(resealedDeep(copy))).toThrow(
			/cancelled-duplicate-fetch category differs/,
		);
	});

	it('rejects an instance corroborated only by a non-successful response', async () => {
		const receipt = await published();
		const copy = structuredClone(receipt);
		const raced = copy.runs[racedIndex(copy)]!;
		raced.cancelledDuplicateFetches.observed[0]!.corroboratingStatuses = [404];
		copy.cancelledDuplicateFetches.instances[racedIndex(copy)]!.observed =
			raced.cancelledDuplicateFetches.observed;
		expect(() => parseWitnessAngularFactoriolabReceipt(resealedDeep(copy))).toThrow(
			/cancelled-duplicate-fetch category differs/,
		);
	});

	it('rejects an instance for a path outside the pinned category', async () => {
		const receipt = await published();
		const copy = structuredClone(receipt);
		const raced = copy.runs[racedIndex(copy)]!;
		raced.cancelledDuplicateFetches.observed[0]!.path = '/assets/data.json';
		copy.cancelledDuplicateFetches.instances[racedIndex(copy)]!.observed =
			raced.cancelledDuplicateFetches.observed;
		expect(() => parseWitnessAngularFactoriolabReceipt(resealedDeep(copy))).toThrow(
			/cancelled-duplicate-fetch category differs/,
		);
	});

	it('rejects an instance recorded under any other failure reason', async () => {
		const receipt = await published();
		const copy = structuredClone(receipt);
		const raced = copy.runs[racedIndex(copy)]!;
		raced.cancelledDuplicateFetches.observed[0]!.reason = 'net::ERR_CONNECTION_REFUSED';
		copy.cancelledDuplicateFetches.instances[racedIndex(copy)]!.observed =
			raced.cancelledDuplicateFetches.observed;
		expect(() => parseWitnessAngularFactoriolabReceipt(resealedDeep(copy))).toThrow(
			/cancelled-duplicate-fetch category differs/,
		);
	});

	it('rejects a widened category that admits a second path', async () => {
		const receipt = await published();
		const copy = structuredClone(receipt);
		for (const run of copy.runs) {
			run.cancelledDuplicateFetches.category = [
				...run.cancelledDuplicateFetches.category,
				{ method: 'GET', path: '/assets/data.json', reason: 'net::ERR_ABORTED' },
			];
			run.cancelledDuplicateFetches.absent = [
				...run.cancelledDuplicateFetches.absent,
				{ method: 'GET', path: '/assets/data.json', reason: 'net::ERR_ABORTED' },
			];
		}
		expect(() => parseWitnessAngularFactoriolabReceipt(resealedDeep(copy))).toThrow(
			/cancelled-duplicate-fetch category differs/,
		);
	});

	it('rejects a receipt whose roll-up tells a quieter story than its runs', async () => {
		const receipt = await published();
		const copy = structuredClone(receipt);
		const index = racedIndex(copy);
		copy.cancelledDuplicateFetches.instances[index]!.observed = [];
		copy.cancelledDuplicateFetches.instances[index]!.admitted = 0;
		expect(() => parseWitnessAngularFactoriolabReceipt(resealedDeep(copy))).toThrow(
			/cancelled-duplicate-fetch roll-up differs/,
		);
	});

	it('rejects an admitted total that disagrees with the instances it sums', async () => {
		const receipt = await published();
		const copy = structuredClone(receipt);
		const index = racedIndex(copy);
		copy.runs[index]!.cancelledDuplicateFetches.admitted = 99;
		copy.cancelledDuplicateFetches.instances[index]!.admitted = 99;
		expect(() => parseWitnessAngularFactoriolabReceipt(resealedDeep(copy))).toThrow(
			/cancelled-duplicate-fetch category differs/,
		);
	});

	it('rejects a run that weakens the corroboration rule it carries', async () => {
		const receipt = await published();
		const copy = structuredClone(receipt);
		copy.runs[0]!.cancelledDuplicateFetches.corroborationRule =
			'Cancelled fetches are allowed.' as typeof WITNESS_CANCELLED_DUPLICATE_FETCH_RULE;
		expect(() => parseWitnessAngularFactoriolabReceipt(resealedDeep(copy))).toThrow(
			/cancelled-duplicate-fetch category differs/,
		);
	});

	it('still fails a run that left an ordinary failed request behind', async () => {
		const receipt = await published();
		const copy = structuredClone(receipt);
		copy.runs[0]!.witnessRecord.failedRequests = 1;
		expect(() => parseWitnessAngularFactoriolabReceipt(resealedDeep(copy))).toThrow(
			/Witness run differs/,
		);
	});

	it('still fails a run whose exact failed-request inventory gained an entry', async () => {
		const receipt = await published();
		const copy = structuredClone(receipt);
		copy.runs[0]!.failedRequestInventory.observed = [
			{ method: 'GET', path: '/assets/transparent.gif', reason: 'net::ERR_ABORTED', count: 1 },
		];
		copy.runs[0]!.failedRequestInventory.total = 1;
		expect(() => parseWitnessAngularFactoriolabReceipt(resealedDeep(copy))).toThrow(
			/failed-request inventory differs/,
		);
	});
});
