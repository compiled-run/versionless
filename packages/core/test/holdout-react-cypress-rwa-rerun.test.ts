import { readFile, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	deriveHoldoutReactCypressRwaRerunReceipt,
	HOLDOUT_REACT_CYPRESS_RWA_RERUN_FROZEN_FINGERPRINT,
	HOLDOUT_REACT_CYPRESS_RWA_RERUN_MARKDOWN_PATH,
	HOLDOUT_REACT_CYPRESS_RWA_RERUN_MISSING_CAPABILITY,
	HOLDOUT_REACT_CYPRESS_RWA_RERUN_RECEIPT_PATH,
	HOLDOUT_REACT_CYPRESS_RWA_RERUN_RUN_EVIDENCE,
	HOLDOUT_REACT_CYPRESS_RWA_RERUN_SUPERSEDED_DIGEST,
	HOLDOUT_REACT_CYPRESS_RWA_RERUN_SUPERSEDED_RECEIPT_PATH,
	holdoutReactCypressRwaRerunCorpusRecord,
	holdoutReactCypressRwaRerunDigest,
	parseHoldoutReactCypressRwaRerunReceipt,
	renderHoldoutReactCypressRwaRerunReceipt,
	verifyHoldoutReactCypressRwaRerunEvidence,
	type HoldoutReactCypressRwaRerunReceipt,
} from '../src/receipts/holdout-react-cypress-rwa.ts';
import { canonicalize, sha256 } from '../src/receipts/canonicalize.ts';
import { assertSyntheticEvidence } from '../src/policy/payment-signals.ts';

const root = path.resolve(import.meta.dirname, '../../..');

async function published(): Promise<HoldoutReactCypressRwaRerunReceipt> {
	return parseHoldoutReactCypressRwaRerunReceipt(
		JSON.parse(
			await readFile(path.join(root, HOLDOUT_REACT_CYPRESS_RWA_RERUN_RECEIPT_PATH), 'utf8'),
		) as unknown,
	);
}

function resealed(
	receipt: HoldoutReactCypressRwaRerunReceipt,
): HoldoutReactCypressRwaRerunReceipt {
	const copy = structuredClone(receipt);
	copy.integrity.canonicalDigest = holdoutReactCypressRwaRerunDigest(copy);
	return copy;
}

describe('cypress-realworld-app holdout re-run falsification receipt', () => {
	it('verifies the published re-run receipt and its rendered companion', async () => {
		const verified = await verifyHoldoutReactCypressRwaRerunEvidence(root);
		expect(verified.valid).toBe(true);
		expect(verified.receipt.holdoutOutcome).toBe('failed');
		expect(verified.receipt.reason).toBe(HOLDOUT_REACT_CYPRESS_RWA_RERUN_MISSING_CAPABILITY);
		expect(
			await readFile(path.join(root, HOLDOUT_REACT_CYPRESS_RWA_RERUN_MARKDOWN_PATH), 'utf8'),
		).toBe(renderHoldoutReactCypressRwaRerunReceipt(verified.receipt));
	});

	it('round-trips: the published re-run receipt is exactly what the run evidence derives', async () => {
		const receipt = await published();
		const derived = await deriveHoldoutReactCypressRwaRerunReceipt(root);
		expect(canonicalize(receipt)).toBe(canonicalize(derived));
		expect(parseHoldoutReactCypressRwaRerunReceipt(structuredClone(derived))).toEqual(derived);
		expect(receipt.integrity.canonicalDigest).toBe(holdoutReactCypressRwaRerunDigest(receipt));
		assertSyntheticEvidence(receipt);
	});

	it('binds the committed re-run evidence by exact bytes', async () => {
		for (const evidence of HOLDOUT_REACT_CYPRESS_RWA_RERUN_RUN_EVIDENCE)
			expect(sha256(await readFile(path.join(root, evidence.path)))).toBe(evidence.sha256);
	});

	it('ran against the re-frozen fingerprint with zero adapter influence', async () => {
		const receipt = await published();
		expect(receipt.frozenAdapter.compositeFingerprint).toBe(
			HOLDOUT_REACT_CYPRESS_RWA_RERUN_FROZEN_FINGERPRINT,
		);
		expect(receipt.frozenAdapter.subtrees).toHaveLength(5);
		expect(receipt.frozenAdapter.bytesChanged).toBe(0);
		expect(receipt.frozenAdapter.changesProposedAndExecuted).toBe(0);
		expect(receipt.frozenAdapter.redBuildPatchedAround).toBe(false);
		expect(receipt.frozenAdapter.harnessBranchedOnHoldoutIdentity).toBe(false);
		expect(receipt.applicationInfluence.applicationFilesChanged).toBe(0);
		expect(receipt.applicationInfluence.handEditedSourceFiles).toEqual([]);
	});

	it('supersedes the tranche-one FAIL by reference, not by overwrite', async () => {
		const receipt = await published();
		expect(receipt.supersedes.receipt).toBe(
			HOLDOUT_REACT_CYPRESS_RWA_RERUN_SUPERSEDED_RECEIPT_PATH,
		);
		expect(receipt.supersedes.receiptDigest).toBe(
			HOLDOUT_REACT_CYPRESS_RWA_RERUN_SUPERSEDED_DIGEST,
		);
		expect(receipt.supersedes.priorReason).toBe('non-UTF-8 module source decoding');
		expect(receipt.supersedes.priorGapNowHandled).toBe(true);
	});

	it('proves the tranche-one blocker is now handled and the build reaches further', async () => {
		const receipt = await published();
		expect(receipt.capabilityAdvance.nowHandledByFrozenCapability).toBe(true);
		expect(receipt.capabilityAdvance.modulesTransformedRerun).toBeGreaterThan(
			receipt.capabilityAdvance.modulesTransformedTrancheOne,
		);
		expect(receipt.capabilityAdvance.modulesTransformedTrancheOne).toBe(10181);
		expect(receipt.capabilityAdvance.modulesTransformedRerun).toBe(10182);
	});

	it('records both lanes: baseline green and byte-stable, migrated red', async () => {
		const receipt = await published();
		expect(receipt.lanes.baseline.outcome).toBe('green');
		expect(receipt.lanes.baseline.builds).toBe(2);
		expect(receipt.lanes.baseline.byteStableAcrossRebuilds).toBe(true);
		expect(receipt.lanes.baseline.laneDigest).toBe(receipt.lanes.baseline.secondLaneDigest);
		expect(receipt.lanes.baseline.reproducesTrancheOneBaseline).toBe(true);
		expect(receipt.lanes.baseline.laneDigest).toBe(
			'57cea24966c61963914da814e8348c970f11468127228c070def6c6472980028',
		);
		expect(receipt.lanes.migrated.outcome).toBe('red');
		expect(receipt.lanes.migrated.outputProduced).toBe(false);
	});

	it('proves the red is a measurement rather than a flake', async () => {
		const receipt = await published();
		expect(receipt.identityProof.baselineAttempts).toBe(2);
		expect(receipt.identityProof.migratedAttempts).toBe(2);
		expect(receipt.identityProof.baselineDigestsIdentical).toBe(true);
		expect(receipt.identityProof.migratedDemandsIdentical).toBe(true);
		expect(receipt.identityProof.demandDigest).toBe(
			sha256(canonicalize(receipt.lanes.migrated.demands)),
		);
	});

	it('names the new gap with the bytes that caused it', async () => {
		const receipt = await published();
		expect(receipt.finding.missingCapability).toBe(
			HOLDOUT_REACT_CYPRESS_RWA_RERUN_MISSING_CAPABILITY,
		);
		expect(receipt.finding.exactDemand.code).toBe('MISSING_EXPORT');
		expect(receipt.finding.exactDemand.symbol).toBe('bpfrpt_proptype_WindowScroller');
		expect(receipt.finding.exactDemand.line).toBe(74);
		expect(receipt.finding.offendingFile.package).toBe('react-virtualized@9.22.3');
		expect(receipt.finding.offendingFile.exportsTheDemandedName).toBe(false);
		expect(receipt.finding.reachedFromApplicationCode.importer).toBe(
			'src/components/TransactionInfiniteList.tsx',
		);
	});

	it('never enters a lineage numerator and supersedes by reference', async () => {
		const receipt = await published();
		const rerunRecord = holdoutReactCypressRwaRerunCorpusRecord(receipt);
		expect(rerunRecord.countedInLineageNumerator).toBe(false);
		expect(rerunRecord.attempted).toBe(true);
		expect(rerunRecord.outcome).toBe('failed');
		expect(rerunRecord.reason).toBe(HOLDOUT_REACT_CYPRESS_RWA_RERUN_MISSING_CAPABILITY);
		expect(rerunRecord.frozenAdapterFingerprint).toBe(
			HOLDOUT_REACT_CYPRESS_RWA_RERUN_FROZEN_FINGERPRINT,
		);
		expect(rerunRecord.supersedes).toBe(HOLDOUT_REACT_CYPRESS_RWA_RERUN_SUPERSEDED_RECEIPT_PATH);
		expect(rerunRecord.digest).toBe(receipt.integrity.canonicalDigest);
	});

	it('rejects a re-run relabelled as a pass', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		tampered.holdoutOutcome = 'passed' as 'failed';
		expect(() => parseHoldoutReactCypressRwaRerunReceipt(resealed(tampered))).toThrow(
			/identity differs/,
		);
	});

	it('rejects a migrated lane recoloured green', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		tampered.lanes.migrated.outcome = 'green' as 'red';
		expect(() => parseHoldoutReactCypressRwaRerunReceipt(resealed(tampered))).toThrow(
			/lane evidence differs/,
		);
	});

	it('rejects a claim that the module count did not advance past tranche-one', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		tampered.capabilityAdvance.modulesTransformedRerun =
			tampered.capabilityAdvance.modulesTransformedTrancheOne;
		expect(() => parseHoldoutReactCypressRwaRerunReceipt(resealed(tampered))).toThrow(
			/capability advance differs/,
		);
	});

	it('rejects a claim that adapter bytes changed', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		tampered.frozenAdapter.bytesChanged = 1 as 0;
		expect(() => parseHoldoutReactCypressRwaRerunReceipt(resealed(tampered))).toThrow(
			/freeze binding differs/,
		);
	});

	it('rejects a dropped supersession reference', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		tampered.supersedes.receiptDigest = `${'0'.repeat(64)}`;
		expect(() => parseHoldoutReactCypressRwaRerunReceipt(resealed(tampered))).toThrow(
			/supersession differs/,
		);
	});

	it('rejects a receipt whose declared digest does not seal its content', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		tampered.finding.verdict = 'the frozen adapter carries this application';
		expect(() => parseHoldoutReactCypressRwaRerunReceipt(tampered)).toThrow(/integrity differs/);
	});

	it('refuses to derive from edited re-run evidence', async () => {
		const { mkdtemp, mkdir, cp, rm } = await import('node:fs/promises');
		const os = await import('node:os');
		const directory = await mkdtemp(path.join(os.tmpdir(), 'holdout-cypress-rwa-rerun-'));
		try {
			await mkdir(path.join(directory, 'evidence/runs'), { recursive: true });
			await cp(
				path.join(root, 'evidence/runs/react-cypress-rwa'),
				path.join(directory, 'evidence/runs/react-cypress-rwa'),
				{ recursive: true },
			);
			const profile = path.join(directory, HOLDOUT_REACT_CYPRESS_RWA_RERUN_RUN_EVIDENCE[0]!.path);
			const value = JSON.parse(await readFile(profile, 'utf8')) as {
				migratedLane: { result: string };
			};
			value.migratedLane.result = 'green';
			await writeFile(profile, `${JSON.stringify(value, null, 2)}\n`);
			await expect(deriveHoldoutReactCypressRwaRerunReceipt(directory)).rejects.toThrow(
				/re-run evidence drifted/,
			);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
