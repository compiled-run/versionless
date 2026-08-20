import { readFileSync } from 'node:fs';
import { join, resolve } from 'pathe';
import { describe, expect, it } from 'vitest';
import { canonicalize } from '../src/receipts/canonicalize.ts';
import {
	parseWitnessAngularEshopWebspaReceipt,
	renderWitnessAngularEshopWebspaReceipt,
	witnessAngularEshopWebspaBehaviorDigest,
	witnessAngularEshopWebspaDigest,
	WITNESS_ANGULAR_ESHOP_WEBSPA_ADAPTER_COMPOSITE,
	WITNESS_ANGULAR_ESHOP_WEBSPA_EVIDENCE_DIRECTORY,
	WITNESS_ANGULAR_ESHOP_WEBSPA_MUTATION_SEAM,
	WITNESS_ANGULAR_ESHOP_WEBSPA_PROJECTION_BEHAVIOR_DIGEST,
	WITNESS_ANGULAR_ESHOP_WEBSPA_SCHEMA,
	WITNESS_ANGULAR_ESHOP_WEBSPA_SELECTORS,
	WITNESS_ANGULAR_ESHOP_WEBSPA_STAGES,
	WITNESS_ANGULAR_ESHOP_WEBSPA_SURFACE_LIMITS,
	type WitnessAngularEshopWebspaReceipt,
} from '../src/receipts/witness-angular-eshop-webspa.ts';
import { WITNESS_REAL_APP_PROJECTED_HOLDOUT_NAMES } from '../src/receipts/witness-real-app.ts';

const root = resolve(import.meta.dirname, '../../..');
const published = (): WitnessAngularEshopWebspaReceipt =>
	JSON.parse(
		readFileSync(
			join(root, WITNESS_ANGULAR_ESHOP_WEBSPA_EVIDENCE_DIRECTORY, 'receipt.json'),
			'utf8',
		),
	) as WitnessAngularEshopWebspaReceipt;

const reseal = (receipt: WitnessAngularEshopWebspaReceipt): WitnessAngularEshopWebspaReceipt => ({
	...receipt,
	integrity: { ...receipt.integrity, canonicalDigest: witnessAngularEshopWebspaDigest(receipt) },
});

describe('eShop WebSPA holdout Witness', () => {
	it('holds the recorded browser-parity receipt', () => {
		const receipt = parseWitnessAngularEshopWebspaReceipt(published());
		expect(receipt.schemaVersion).toBe(WITNESS_ANGULAR_ESHOP_WEBSPA_SCHEMA);
		expect(receipt.result).toBe('pass');
		expect(receipt.adapterComposite).toBe(WITNESS_ANGULAR_ESHOP_WEBSPA_ADAPTER_COMPOSITE);
		expect(receipt.runs).toHaveLength(4);
		expect(receipt.parity.lanes).toBe(2);
		expect(receipt.parity.passesPerLane).toBe(2);
		expect(receipt.locality.successfulNonLoopback).toBe(0);
	});

	it('proves pass-twice determinism per lane and one behavior digest across both', () => {
		const receipt = published();
		for (const lane of ['baseline', 'migrated'] as const) {
			const passes = receipt.runs.filter((run) => run.lane === lane);
			expect(passes).toHaveLength(2);
			expect(new Set(passes.map((run) => run.semanticDigest)).size).toBe(1);
		}
		expect(new Set(receipt.runs.map((run) => run.behaviorDigest)).size).toBe(1);
		// The two lanes ship different bytes on purpose, so an identical semantic
		// digest would mean the lane-specific evidence had been erased.
		expect(receipt.parity.semanticDigestsPerLane.baseline).not.toBe(
			receipt.parity.semanticDigestsPerLane.migrated,
		);
		for (const run of receipt.runs)
			expect(run.behaviorDigest).toBe(witnessAngularEshopWebspaBehaviorDigest(run));
	});

	it('holds a mutation that went red and was restored byte for byte', () => {
		const { mutation, parity } = published();
		expect(mutation.seam).toBe(WITNESS_ANGULAR_ESHOP_WEBSPA_MUTATION_SEAM);
		expect(mutation.intendedFailure).toBe(true);
		expect(mutation.beforeSha256).toBe(mutation.afterRestoreSha256);
		expect(mutation.mutatedSha256).not.toBe(mutation.beforeSha256);
		expect(mutation.restoredBehaviorDigest).toBe(parity.behaviorDigest);
	});

	it('declares one projection, identical across lanes, that refused nothing the app asked for', () => {
		const { projection } = published();
		expect(projection.identicalAcrossLanes).toBe(true);
		expect(projection.transport).toBe('same-origin-bounded-loopback-api');
		expect(projection.behaviorDigest).toBe(
			WITNESS_ANGULAR_ESHOP_WEBSPA_PROJECTION_BEHAVIOR_DIGEST,
		);
		expect(projection.ledger.refusedUnknown).toBe(0);
		expect(projection.ledger.refusedUnprojected).toBe(0);
		expect(projection.ledger.served).toBe(projection.ledger.apiRecords);
		expect(projection.ledger.declinedNonApi).toBeGreaterThan(0);
	});

	it('records the truthful surface limits rather than claiming the gated surfaces', () => {
		const receipt = published();
		expect(canonicalize(receipt.journey.surfaceLimits)).toBe(
			canonicalize(WITNESS_ANGULAR_ESHOP_WEBSPA_SURFACE_LIMITS),
		);
		const identity = receipt.journey.surfaceLimits.find(
			(limit) => limit.surface === 'identity',
		);
		expect(identity?.state).toBe('out-of-surface');
		expect(
			receipt.nonclaims.some((claim) => claim.includes('Identity is out of surface')),
		).toBe(true);
		expect(
			receipt.nonclaims.some((claim) => claim.includes('frozen synthetic same-origin')),
		).toBe(true);
	});

	it('pins the measured journey stages the runner asserts', () => {
		expect(WITNESS_ANGULAR_ESHOP_WEBSPA_STAGES.catalogPageSize).toBe(10);
		expect(WITNESS_ANGULAR_ESHOP_WEBSPA_STAGES.catalogTotal).toBe(20);
		expect(WITNESS_ANGULAR_ESHOP_WEBSPA_STAGES.firstPageText).toContain('Page 1 - 2');
		expect(WITNESS_ANGULAR_ESHOP_WEBSPA_STAGES.secondPageText).toContain('Page 2 - 2');
		expect(WITNESS_ANGULAR_ESHOP_WEBSPA_STAGES.brandFilteredItems).toBe(1);
		// The seam has to live inside the line the journey actually asserts, or
		// overwriting it would not be a behavior-breaking mutation.
		expect(WITNESS_ANGULAR_ESHOP_WEBSPA_STAGES.firstPageText).toContain(
			WITNESS_ANGULAR_ESHOP_WEBSPA_MUTATION_SEAM,
		);
		expect(WITNESS_ANGULAR_ESHOP_WEBSPA_SELECTORS.catalogItem).toBe('.esh-catalog-item');
	});

	it('keeps the holdout out of the frozen static corpus roster', () => {
		expect([...WITNESS_REAL_APP_PROJECTED_HOLDOUT_NAMES]).toEqual(['angular-eshop-webspa']);
	});

	it('rejects a tampered parity digest, mutation, or locality claim', () => {
		const receipt = published();
		expect(() =>
			parseWitnessAngularEshopWebspaReceipt(
				reseal({
					...receipt,
					parity: { ...receipt.parity, behaviorDigest: 'x'.repeat(64) },
				}),
			),
		).toThrow();
		expect(() =>
			parseWitnessAngularEshopWebspaReceipt(
				reseal({
					...receipt,
					mutation: { ...receipt.mutation, mutatedSha256: receipt.mutation.beforeSha256 },
				}),
			),
		).toThrow();
		expect(() =>
			parseWitnessAngularEshopWebspaReceipt(
				reseal({
					...receipt,
					locality: { ...receipt.locality, successfulNonLoopback: 1 as 0 },
				}),
			),
		).toThrow();
		expect(() =>
			parseWitnessAngularEshopWebspaReceipt({
				...receipt,
				integrity: { ...receipt.integrity, canonicalDigest: 'y'.repeat(64) },
			}),
		).toThrow();
	});

	it('renders the human receipt the published bytes hold', () => {
		const receipt = published();
		const rendered = readFileSync(
			join(root, WITNESS_ANGULAR_ESHOP_WEBSPA_EVIDENCE_DIRECTORY, 'receipt.md'),
			'utf8',
		);
		expect(rendered).toBe(renderWitnessAngularEshopWebspaReceipt(receipt));
		expect(rendered).not.toContain(root);
	});
});
