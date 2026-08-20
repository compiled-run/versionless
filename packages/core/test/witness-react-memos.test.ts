import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	parseWitnessReactMemosReceipt,
	REACT_MEMOS_BUILD_LANES_PATH,
	REACT_MEMOS_BUILD_LANES_SHA256,
	REACT_MEMOS_ERA_BUILD_DEVIATION,
	REACT_MEMOS_PROJECTION_BEHAVIOR_DIGEST,
	REACT_MEMOS_SEED_AMENDMENT,
	REACT_MEMOS_SOURCE,
	renderWitnessReactMemosReceipt,
	verifyWitnessReactMemosEvidence,
	WITNESS_REACT_MEMOS_CONSOLE_ERRORS,
	WITNESS_REACT_MEMOS_FAILED_REQUESTS,
	WITNESS_REACT_MEMOS_RECEIPT_PATH,
	WITNESS_REACT_MEMOS_ROUTER_ROUTES,
	WITNESS_REACT_MEMOS_STYLE_PROBES,
	WITNESS_REACT_MEMOS_TRACKED_EVENTS,
	witnessReactMemosAggregateMember,
	witnessReactMemosBehaviorDigest,
	witnessReactMemosDigest,
	witnessReactMemosRawDigest,
	type WitnessReactMemosReceipt,
} from '../src/receipts/witness-react-memos.ts';
import { WITNESS_REAL_APP_NAMES } from '../src/receipts/witness-real-app.ts';

const root = path.resolve(import.meta.dirname, '../../..');

async function published(): Promise<WitnessReactMemosReceipt> {
	return parseWitnessReactMemosReceipt(
		JSON.parse(
			await readFile(path.join(root, WITNESS_REACT_MEMOS_RECEIPT_PATH), 'utf8'),
		) as unknown,
	);
}

/**
 * Reseals a tampered receipt as thoroughly as a forger could: every per-run
 * digest is recomputed over the edited content before the receipt digest is
 * sealed, so no test below can be passed by a hash that happened to stop the
 * edit first. Each one has to be caught by the evidence check it targets.
 */
function resealedDeep(receipt: WitnessReactMemosReceipt): WitnessReactMemosReceipt {
	const copy = structuredClone(receipt);
	for (const run of copy.runs) {
		run.semanticDigest = witnessReactMemosRawDigest(run);
		run.behaviorDigest = witnessReactMemosBehaviorDigest(run);
	}
	copy.integrity.canonicalDigest = witnessReactMemosDigest(copy);
	return copy;
}

describe('Memos direct Witness receipt', () => {
	it('verifies the published browser proof and its rendered companion', async () => {
		const verified = await verifyWitnessReactMemosEvidence(root);
		expect(verified.valid).toBe(true);
		expect(verified.receipt.result).toBe('pass');
		expect(verified.receipt.runs).toHaveLength(4);
		expect(verified.receipt.canonicalReceipt.path).toBe(REACT_MEMOS_BUILD_LANES_PATH);
		expect(verified.receipt.canonicalReceipt.sha256).toBe(REACT_MEMOS_BUILD_LANES_SHA256);
		expect(
			await readFile(
				path.join(root, path.dirname(WITNESS_REACT_MEMOS_RECEIPT_PATH), 'receipt.md'),
				'utf8',
			),
		).toBe(renderWitnessReactMemosReceipt(verified.receipt));
		expect(witnessReactMemosAggregateMember(verified.digest).receipt).toBe(
			WITNESS_REACT_MEMOS_RECEIPT_PATH,
		);
	});

	it('names the application in the closed real-app list', () => {
		expect(WITNESS_REAL_APP_NAMES).toContain('react-memos');
	});

	it('proves one behavior across both lanes and both passes', async () => {
		const receipt = await published();
		const digests = new Set(receipt.runs.map((run) => run.behaviorDigest));
		expect(digests.size).toBe(1);
		expect([...digests]).toEqual([receipt.mutation.restoredBehaviorDigest]);
		expect(receipt.runs.map((run) => `${run.lane}:${String(run.pass)}`).sort()).toEqual([
			'baseline:1',
			'baseline:2',
			'migrated:1',
			'migrated:2',
		]);
		for (const run of receipt.runs) {
			expect(run.semanticDigest).toBe(witnessReactMemosRawDigest(run));
			expect(run.witnessRecord.trackedEventCounts).toMatchObject({
				click: WITNESS_REACT_MEMOS_TRACKED_EVENTS.click,
				input: WITNESS_REACT_MEMOS_TRACKED_EVENTS.input,
				keydown: WITNESS_REACT_MEMOS_TRACKED_EVENTS.keydown,
			});
		}
	});

	it('binds the frozen projection, its seed and the amendment that moved the owner pair', async () => {
		const receipt = await published();
		expect(receipt.projection.behaviorDigest).toBe(REACT_MEMOS_PROJECTION_BEHAVIOR_DIGEST);
		expect(receipt.projection.amendment).toEqual(REACT_MEMOS_SEED_AMENDMENT);
		expect(receipt.projection.amendment.supersededBehaviorDigest).not.toBe(
			REACT_MEMOS_PROJECTION_BEHAVIOR_DIGEST,
		);
		for (const run of receipt.runs)
			expect(run.applicationJourney.projection.behaviorDigest).toBe(
				REACT_MEMOS_PROJECTION_BEHAVIOR_DIGEST,
			);
	});

	it('carries the era tsc-gate deviation rather than leaving it in the build receipt', async () => {
		const receipt = await published();
		expect(receipt.eraBuildDeviation).toEqual(REACT_MEMOS_ERA_BUILD_DEVIATION);
		expect(receipt.eraBuildDeviation.declaredBuildCommandOutcomeAtThisRevision).toContain(
			'fails',
		);
		expect(renderWitnessReactMemosReceipt(receipt)).toContain(
			REACT_MEMOS_ERA_BUILD_DEVIATION.commandRun,
		);
		expect(receipt.nonclaims.some((claim) => claim.includes('tsc gate'))).toBe(true);
	});

	it('publishes a projection ledger whose API surface is entirely served', async () => {
		const receipt = await published();
		for (const run of receipt.runs) {
			const ledger = run.applicationJourney.projection.ledger;
			expect(ledger.refusedUnknown).toBe(0);
			expect(ledger.refusedUnprojected).toBe(0);
			expect(ledger.served).toBe(ledger.apiRecords);
			expect(ledger.records).toBe(ledger.apiRecords + ledger.declinedNonApi);
			expect(ledger.entries.reduce((sum, entry) => sum + entry.count, 0)).toBe(
				ledger.apiRecords,
			);
			expect(ledger.entries.map((entry) => entry.endpoint)).toContain('memo.create');
			expect(ledger.entries.map((entry) => entry.endpoint)).toContain('user.me.patch');
		}
	});

	it('records the client-side filters as firing no API request at all', async () => {
		const receipt = await published();
		for (const run of receipt.runs) {
			const { search, tagFilter } = run.applicationJourney;
			expect(search.apiRecordsDuringFilter).toBe(0);
			expect(search.apiOriginRequestsDuringFilter).toBe(0);
			expect(tagFilter.apiRecordsDuringFilter).toBe(0);
			expect(tagFilter.apiOriginRequestsDuringFilter).toBe(0);
			// The asset re-fetches are recorded rather than hidden: the origin
			// answers no-store, so a re-rendered memo card refetches its icons.
			expect(search.assetRequestsDuringFilter).toBeGreaterThan(0);
			expect(tagFilter.assetRequestsDuringFilter).toBeGreaterThan(0);
		}
	});

	it('keeps every recorded route inside the application own two-route router', async () => {
		const receipt = await published();
		expect(receipt.router.routes).toEqual([...WITNESS_REACT_MEMOS_ROUTER_ROUTES]);
		for (const run of receipt.runs) {
			expect(run.routes.length).toBe(receipt.router.navigations);
			for (const route of run.routes)
				expect(WITNESS_REACT_MEMOS_ROUTER_ROUTES).toContain(route);
		}
	});

	it('rejects a claimed scroll surface where the document never overflowed', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		tampered.scrollAbsence.claimed = true as false;
		expect(() => parseWitnessReactMemosReceipt(resealedDeep(tampered))).toThrow(
			'scroll absence differs',
		);
		const overflowed = structuredClone(receipt);
		overflowed.runs[0]!.scrollAbsence.routes[0]!.scrollHeight = 4000;
		expect(() => parseWitnessReactMemosReceipt(resealedDeep(overflowed))).toThrow(
			'scroll absence differs',
		);
	});

	it('rejects a filter claim that quietly admits an API request', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		tampered.runs[0]!.applicationJourney.search.apiRecordsDuringFilter = 3 as 0;
		expect(() => parseWitnessReactMemosReceipt(resealedDeep(tampered))).toThrow(
			'application journey evidence differs',
		);
	});

	it('rejects a projection ledger that hides a refusal', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		tampered.runs[0]!.applicationJourney.projection.ledger.refusedUnknown = 1;
		expect(() => parseWitnessReactMemosReceipt(resealedDeep(tampered))).toThrow(
			'application journey evidence differs',
		);
	});

	it('rejects a rebound projection digest or a rewritten amendment', async () => {
		const receipt = await published();
		const rebound = structuredClone(receipt);
		rebound.projection.behaviorDigest = receipt.projection.amendment
			.supersededBehaviorDigest as typeof REACT_MEMOS_PROJECTION_BEHAVIOR_DIGEST;
		expect(() => parseWitnessReactMemosReceipt(resealedDeep(rebound))).toThrow(
			'Witness binding differs',
		);
		const rewritten = structuredClone(receipt);
		rewritten.projection.amendment = {
			...receipt.projection.amendment,
			scope: 'everything',
		} as unknown as typeof REACT_MEMOS_SEED_AMENDMENT;
		expect(() => parseWitnessReactMemosReceipt(resealedDeep(rewritten))).toThrow(
			'Witness binding differs',
		);
	});

	it('rejects a widened console-error inventory and a masked failed request', async () => {
		const receipt = await published();
		const widened = structuredClone(receipt);
		widened.runs[0]!.consoleErrorInventory.expected = [
			...widened.runs[0]!.consoleErrorInventory.expected,
			{ message: 'anything at all', count: 1 },
		];
		expect(() => parseWitnessReactMemosReceipt(resealedDeep(widened))).toThrow(
			'console-error inventory differs',
		);
		expect(WITNESS_REACT_MEMOS_CONSOLE_ERRORS.baseline).toEqual(
			WITNESS_REACT_MEMOS_CONSOLE_ERRORS.migrated,
		);
		expect(WITNESS_REACT_MEMOS_FAILED_REQUESTS.baseline).toEqual([]);
		const masked = structuredClone(receipt);
		masked.runs[0]!.witnessRecord.failedRequests = 2;
		expect(() => parseWitnessReactMemosReceipt(resealedDeep(masked))).toThrow(
			'Witness run differs',
		);
	});

	it('rejects a rendered-style claim measured on a different probe list', async () => {
		const receipt = await published();
		expect(receipt.renderedStyleParity.probes).toBe(WITNESS_REACT_MEMOS_STYLE_PROBES.length);
		const tampered = structuredClone(receipt);
		tampered.runs[0]!.renderedStyles.probes[0]!.selector = 'html';
		expect(() => parseWitnessReactMemosReceipt(resealedDeep(tampered))).toThrow(
			'rendered-style measurement differs',
		);
	});

	it('rejects a rebound source identity', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		tampered.source = {
			...REACT_MEMOS_SOURCE,
			revision: 'f'.repeat(40),
		} as typeof REACT_MEMOS_SOURCE;
		expect(() => parseWitnessReactMemosReceipt(resealedDeep(tampered))).toThrow(
			'Witness binding differs',
		);
	});

	it('rejects a mutation that never went red or never came back', async () => {
		const receipt = await published();
		const unrestored = structuredClone(receipt);
		unrestored.mutation.afterRestoreSha256 = 'a'.repeat(64);
		expect(() => parseWitnessReactMemosReceipt(resealedDeep(unrestored))).toThrow(
			'Witness integrity differs',
		);
		const neverRed = structuredClone(receipt);
		neverRed.mutation.mutatedSha256 = receipt.mutation.beforeSha256;
		expect(() => parseWitnessReactMemosReceipt(resealedDeep(neverRed))).toThrow(
			'Witness integrity differs',
		);
	});

	it('keeps the vertical uncounted against the React lineage', async () => {
		const receipt = await published();
		expect(receipt.readiness.reactLineage.counted).toBe(false);
		expect(receipt.readiness.reactLineage.ready).toBe(1);
		expect(receipt.locality.successfulNonLoopback).toBe(0);
		for (const run of receipt.runs) expect(run.successfulNonLoopback).toBe(0);
	});
});
