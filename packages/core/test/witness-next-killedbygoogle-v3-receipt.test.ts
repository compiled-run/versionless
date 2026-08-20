import { readFile } from 'node:fs/promises';
import { join, resolve } from 'pathe';
import { describe, expect, it } from 'vitest';
import { canonicalize } from '../src/receipts/canonicalize.ts';
import {
	NEXT_KILLEDBYGOOGLE_V3_APP,
	NEXT_KILLEDBYGOOGLE_V3_CANONICAL_RECEIPT,
	parseWitnessNextKilledbygoogleV3Receipt,
	renderWitnessNextKilledbygoogleV3Receipt,
	verifyWitnessNextKilledbygoogleV3Evidence,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_LIST_ITEMS,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_MOCKED_SEAMS,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECORDS,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_ROUTER_HISTORY_DIFFERENCE,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_STYLE_PROBES,
	witnessNextKilledbygoogleV3BehaviorDigest,
	witnessNextKilledbygoogleV3Digest,
	witnessNextKilledbygoogleV3RawDigest,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECEIPT_PATH,
	type WitnessNextKilledbygoogleV3Receipt,
} from '../src/receipts/witness-next-killedbygoogle-v3.ts';
import { WITNESS_REAL_APP_NAMES } from '../src/receipts/witness-real-app.ts';

const root = resolve(import.meta.dirname, '../../..');

async function published(): Promise<WitnessNextKilledbygoogleV3Receipt> {
	return parseWitnessNextKilledbygoogleV3Receipt(
		JSON.parse(await readFile(join(root, WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECEIPT_PATH), 'utf8')),
	);
}

describe('killedbygoogle v3 Witness receipt', () => {
	it('is a member of the closed real-app corpus under its own versioned name', () => {
		expect(WITNESS_REAL_APP_NAMES).toContain(NEXT_KILLEDBYGOOGLE_V3_APP);
		expect(WITNESS_REAL_APP_NAMES).toContain('killedbygoogle');
		expect(NEXT_KILLEDBYGOOGLE_V3_APP).not.toBe('killedbygoogle');
	});

	it('parses the published receipt and verifies its bound build lanes', async () => {
		const receipt = await published();
		expect(receipt.result).toBe('pass');
		expect(receipt.runs).toHaveLength(4);
		await expect(verifyWitnessNextKilledbygoogleV3Evidence(root)).resolves.toMatchObject({
			valid: true,
			digest: receipt.integrity.canonicalDigest,
		});
	});

	it('settles the pre-rendered and the client-mounted document to the same list', async () => {
		const receipt = await published();
		const digests = new Set(
			receipt.runs.map((run) => run.applicationJourney.renderedList.contentSha256),
		);
		const behaviors = new Set(receipt.runs.map(witnessNextKilledbygoogleV3BehaviorDigest));
		expect(digests.size).toBe(1);
		expect(behaviors.size).toBe(1);
		for (const run of receipt.runs) {
			expect(run.applicationJourney.renderedList.records).toBe(
				WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECORDS,
			);
			expect(run.applicationJourney.renderedList.listItems).toBe(
				WITNESS_NEXT_KILLEDBYGOOGLE_V3_LIST_ITEMS,
			);
		}
	});

	it('measures the same resolved appearance in both lanes', async () => {
		const receipt = await published();
		expect(receipt.renderedStyles.probes).toHaveLength(
			WITNESS_NEXT_KILLEDBYGOOGLE_V3_STYLE_PROBES,
		);
		for (const run of receipt.runs)
			expect(canonicalize(run.renderedStyles)).toBe(canonicalize(receipt.renderedStyles));
	});

	it('publishes the two lane differences instead of normalising them away', async () => {
		const receipt = await published();
		expect(receipt.scriptExecutionDifference.masked).toBe(false);
		expect(receipt.routerHistoryDifference.masked).toBe(false);
		expect(receipt.mockedNonLoopbackSeams.category.baseline).toHaveLength(3);
		expect(receipt.mockedNonLoopbackSeams.category.migrated).toHaveLength(1);
		for (const run of receipt.runs)
			expect(run.routes).toHaveLength(
				run.lane === 'baseline'
					? WITNESS_NEXT_KILLEDBYGOOGLE_V3_ROUTER_HISTORY_DIFFERENCE.eraRecordedNavigations
					: WITNESS_NEXT_KILLEDBYGOOGLE_V3_ROUTER_HISTORY_DIFFERENCE.migratedRecordedNavigations,
			);
	});

	it('reaches no third-party destination and pins every seam query-free', async () => {
		const receipt = await published();
		expect(receipt.locality.successfulNonLoopback).toBe(0);
		for (const lane of ['baseline', 'migrated'] as const)
			for (const seam of WITNESS_NEXT_KILLEDBYGOOGLE_V3_MOCKED_SEAMS[lane]) {
				expect(seam.path).not.toContain('?');
				expect(seam.path).not.toContain('#');
			}
		for (const run of receipt.runs) {
			expect(run.mockedNonLoopbackSeams.successfulNonLoopback).toBe(0);
			expect(run.mockedNonLoopbackSeams.outsideInventory).toEqual([]);
			expect(run.successfulNonLoopback).toBe(0);
		}
	});

	it('keeps every inventory exact and every run clean', async () => {
		const receipt = await published();
		for (const run of receipt.runs) {
			expect(run.consoleErrorInventory.outsideInventory).toEqual([]);
			expect(run.consoleErrorInventory.total).toBe(0);
			expect(run.failedRequestInventory.outsideInventory).toEqual([]);
			expect(run.failedRequestInventory.total).toBe(0);
			expect(run.witnessRecord.consoleErrors).toBe(0);
			expect(run.witnessRecord.pageErrors).toBe(0);
			expect(run.witnessRecord.failedRequests).toBe(0);
			expect(run.cancelledDuplicateFetches).toBeUndefined();
		}
	});

	it('refuses a receipt whose lanes settled to different lists', async () => {
		const receipt = await published();
		const tampered = JSON.parse(canonicalize(receipt)) as WitnessNextKilledbygoogleV3Receipt;
		tampered.runs[3]!.applicationJourney.renderedList.contentSha256 = 'f'.repeat(64);
		tampered.integrity.canonicalDigest = witnessNextKilledbygoogleV3Digest(tampered);
		expect(() => parseWitnessNextKilledbygoogleV3Receipt(tampered)).toThrow('run differs');
	});

	it('refuses a receipt whose migrated lane claims the era lane seams', async () => {
		const receipt = await published();
		const tampered = JSON.parse(canonicalize(receipt)) as WitnessNextKilledbygoogleV3Receipt;
		const run = tampered.runs[3]!;
		run.mockedNonLoopbackSeams.category = [
			...WITNESS_NEXT_KILLEDBYGOOGLE_V3_MOCKED_SEAMS.baseline,
		];
		// Re-derived so the run's own digests still agree with its contents, which
		// is what makes the seam inventory the assertion that fires rather than
		// the digest that would have caught the edit first.
		run.semanticDigest = witnessNextKilledbygoogleV3RawDigest(run);
		run.behaviorDigest = witnessNextKilledbygoogleV3BehaviorDigest(run);
		tampered.integrity.canonicalDigest = witnessNextKilledbygoogleV3Digest(tampered);
		expect(() => parseWitnessNextKilledbygoogleV3Receipt(tampered)).toThrow(
			'mocked non-loopback seam inventory differs',
		);
	});

	it('refuses a receipt that was re-pointed at a different build lane', async () => {
		const receipt = await published();
		const tampered = JSON.parse(canonicalize(receipt)) as WitnessNextKilledbygoogleV3Receipt;
		tampered.canonicalReceipt = {
			...NEXT_KILLEDBYGOOGLE_V3_CANONICAL_RECEIPT,
			targetLaneDigest: '0'.repeat(64),
		} as typeof NEXT_KILLEDBYGOOGLE_V3_CANONICAL_RECEIPT;
		tampered.integrity.canonicalDigest = witnessNextKilledbygoogleV3Digest(tampered);
		expect(() => parseWitnessNextKilledbygoogleV3Receipt(tampered)).toThrow('binding differs');
	});

	it('renders a human receipt that names the lift, the oracle and the differences', async () => {
		const receipt = await published();
		const rendered = renderWitnessNextKilledbygoogleV3Receipt(receipt);
		expect(rendered).toContain('settled-dom-and-behaviour');
		expect(rendered).toContain('Byte parity is not-claimed');
		expect(rendered).toContain('no navigation journey is claimed');
		expect(rendered).toBe(
			await readFile(
				join(root, 'evidence/runs/witness-next-killedbygoogle-v3-0-0/receipt.md'),
				'utf8',
			),
		);
	});
});
