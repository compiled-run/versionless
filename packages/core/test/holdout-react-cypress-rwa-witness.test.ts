import { readFile } from 'node:fs/promises';
import { resolve } from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	deriveHoldoutReactCypressRwaWitnessReceipt,
	HOLDOUT_REACT_CYPRESS_RWA_WITNESS_FROZEN_FINGERPRINT,
	HOLDOUT_REACT_CYPRESS_RWA_WITNESS_RECEIPT_PATH,
	holdoutReactCypressRwaWitnessDigest,
	parseHoldoutReactCypressRwaWitnessReceipt,
	verifyHoldoutReactCypressRwaWitnessEvidence,
	type HoldoutReactCypressRwaWitnessReceipt,
} from '../src/receipts/holdout-react-cypress-rwa-witness.ts';

const root = resolve(import.meta.dirname, '../../..');

async function published(): Promise<HoldoutReactCypressRwaWitnessReceipt> {
	return parseHoldoutReactCypressRwaWitnessReceipt(
		JSON.parse(
			await readFile(resolve(root, HOLDOUT_REACT_CYPRESS_RWA_WITNESS_RECEIPT_PATH), 'utf8'),
		),
	);
}

describe('cypress-realworld-app holdout PASS receipt (frozen-adapter re-run)', () => {
	it('verifies the committed receipt against its measured run evidence', async () => {
		const verified = await verifyHoldoutReactCypressRwaWitnessEvidence(root);
		expect(verified.valid).toBe(true);
		expect(verified.receipt.holdoutOutcome).toBe('passed');
		expect(verified.receipt.frozenAdapter.compositeFingerprint).toBe(
			HOLDOUT_REACT_CYPRESS_RWA_WITNESS_FROZEN_FINGERPRINT,
		);
		expect(verified.receipt.frozenAdapter.bytesChanged).toBe(0);
		expect(verified.receipt.frozenAdapter.reopenInThisUnit).toBe(false);
		expect(verified.digest).toBe(verified.receipt.integrity.canonicalDigest);
	});

	it('re-derives to exactly the committed receipt', async () => {
		const derived = await deriveHoldoutReactCypressRwaWitnessReceipt(root);
		const committed = await published();
		expect(derived).toEqual(committed);
	});

	it('carries 51/51 both lanes, one behaviour digest over distinct builds, and zero non-loopback', async () => {
		const receipt = await published();
		expect(receipt.journey.lanes.baseline.legs).toEqual({ ok: 51, total: 51 });
		expect(receipt.journey.lanes.migrated.legs).toEqual({ ok: 51, total: 51 });
		expect(receipt.journey.behaviorParity).toBe(true);
		expect(receipt.journey.lanes.baseline.behaviorDigest).toBe(receipt.journey.behaviorDigest);
		expect(receipt.journey.lanes.migrated.behaviorDigest).toBe(receipt.journey.behaviorDigest);
		expect(receipt.journey.lanes.baseline.semanticDigest).not.toBe(
			receipt.journey.lanes.migrated.semanticDigest,
		);
		expect(receipt.journey.successfulNonLoopback).toBe(0);
		expect(receipt.locality.mode).toBe('live-loopback-backend');
	});

	it('is a holdout that is counted in no lineage numerator', async () => {
		const receipt = await published();
		expect(receipt.role).toBe('holdout');
		expect(receipt.counting.countedInLineageNumerator).toBe(false);
	});

	it('recomputes the frozen composite from its own subtree oids', async () => {
		const receipt = await published();
		expect(receipt.frozenAdapter.subtrees).toHaveLength(5);
		// The parser recomputes sha256 over the subtree lines and refuses a mismatch.
		const tampered = structuredClone(receipt);
		tampered.frozenAdapter.subtrees[0]!.treeOid = 'a'.repeat(40);
		tampered.integrity.canonicalDigest = holdoutReactCypressRwaWitnessDigest(tampered);
		expect(() => parseHoldoutReactCypressRwaWitnessReceipt(tampered)).toThrow(
			/freeze binding differs/,
		);
	});

	it('refuses a receipt whose outcome was flipped or whose lanes were made byte-identical', async () => {
		const receipt = await published();
		const flipped = structuredClone(receipt);
		(flipped as { holdoutOutcome: string }).holdoutOutcome = 'failed';
		flipped.integrity.canonicalDigest = holdoutReactCypressRwaWitnessDigest(flipped);
		expect(() => parseHoldoutReactCypressRwaWitnessReceipt(flipped)).toThrow(
			/identity differs/,
		);

		const trivial = structuredClone(receipt);
		trivial.journey.lanes.migrated.semanticDigest =
			trivial.journey.lanes.baseline.semanticDigest;
		trivial.integrity.canonicalDigest = holdoutReactCypressRwaWitnessDigest(trivial);
		expect(() => parseHoldoutReactCypressRwaWitnessReceipt(trivial)).toThrow(
			/journey evidence differs/,
		);
	});
});
