import { readFile, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	deriveHoldoutReactCypressRwaReceipt,
	HOLDOUT_REACT_CYPRESS_RWA_ADDED_NONCLAIMS,
	HOLDOUT_REACT_CYPRESS_RWA_FROZEN_FINGERPRINT,
	HOLDOUT_REACT_CYPRESS_RWA_MARKDOWN_PATH,
	HOLDOUT_REACT_CYPRESS_RWA_MISSING_CAPABILITY,
	HOLDOUT_REACT_CYPRESS_RWA_RECEIPT_PATH,
	HOLDOUT_REACT_CYPRESS_RWA_RUN_EVIDENCE,
	holdoutReactCypressRwaCorpusRecord,
	holdoutReactCypressRwaDigest,
	parseHoldoutReactCypressRwaReceipt,
	renderHoldoutReactCypressRwaReceipt,
	verifyHoldoutReactCypressRwaEvidence,
	type HoldoutReactCypressRwaReceipt,
} from '../src/receipts/holdout-react-cypress-rwa.ts';
import { canonicalize, sha256 } from '../src/receipts/canonicalize.ts';
import { assertSyntheticEvidence } from '../src/policy/payment-signals.ts';

const root = path.resolve(import.meta.dirname, '../../..');

async function published(): Promise<HoldoutReactCypressRwaReceipt> {
	return parseHoldoutReactCypressRwaReceipt(
		JSON.parse(
			await readFile(path.join(root, HOLDOUT_REACT_CYPRESS_RWA_RECEIPT_PATH), 'utf8'),
		) as unknown,
	);
}

/**
 * Reseals a tampered receipt the way a forger would, so each test below has to
 * be caught by the evidence check it targets rather than by a stale digest.
 */
function resealed(receipt: HoldoutReactCypressRwaReceipt): HoldoutReactCypressRwaReceipt {
	const copy = structuredClone(receipt);
	copy.integrity.canonicalDigest = holdoutReactCypressRwaDigest(copy);
	return copy;
}

describe('cypress-realworld-app holdout falsification receipt', () => {
	it('verifies the published receipt and its rendered companion', async () => {
		const verified = await verifyHoldoutReactCypressRwaEvidence(root);
		expect(verified.valid).toBe(true);
		expect(verified.receipt.holdoutOutcome).toBe('failed');
		expect(verified.receipt.reason).toBe(HOLDOUT_REACT_CYPRESS_RWA_MISSING_CAPABILITY);
		expect(
			await readFile(path.join(root, HOLDOUT_REACT_CYPRESS_RWA_MARKDOWN_PATH), 'utf8'),
		).toBe(renderHoldoutReactCypressRwaReceipt(verified.receipt));
	});

	it('round-trips: the published receipt is exactly what the run evidence derives', async () => {
		const receipt = await published();
		const derived = await deriveHoldoutReactCypressRwaReceipt(root);
		expect(canonicalize(receipt)).toBe(canonicalize(derived));
		expect(parseHoldoutReactCypressRwaReceipt(structuredClone(derived))).toEqual(derived);
		expect(receipt.integrity.canonicalDigest).toBe(holdoutReactCypressRwaDigest(receipt));
		assertSyntheticEvidence(receipt);
	});

	it('binds the committed run evidence by exact bytes', async () => {
		for (const evidence of HOLDOUT_REACT_CYPRESS_RWA_RUN_EVIDENCE)
			expect(sha256(await readFile(path.join(root, evidence.path)))).toBe(evidence.sha256);
		const receipt = await published();
		expect(receipt.runEvidence).toEqual(
			HOLDOUT_REACT_CYPRESS_RWA_RUN_EVIDENCE.map((evidence) => ({
				path: evidence.path,
				sha256: evidence.sha256,
			})),
		);
	});

	it('records both lanes, the frozen fingerprint, and zero adapter influence', async () => {
		const receipt = await published();
		expect(receipt.frozenAdapter.compositeFingerprint).toBe(
			HOLDOUT_REACT_CYPRESS_RWA_FROZEN_FINGERPRINT,
		);
		expect(receipt.frozenAdapter.subtrees).toHaveLength(5);
		expect(receipt.frozenAdapter.bytesChanged).toBe(0);
		expect(receipt.frozenAdapter.changesProposedAndExecuted).toBe(0);
		expect(receipt.frozenAdapter.redBuildPatchedAround).toBe(false);
		expect(receipt.applicationInfluence.applicationFilesChanged).toBe(0);
		expect(receipt.applicationInfluence.handEditedSourceFiles).toEqual([]);
		expect(receipt.lanes.baseline.outcome).toBe('green');
		expect(receipt.lanes.baseline.laneDigest).toBe(receipt.lanes.baseline.secondLaneDigest);
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

	it('names the missing capability with the bytes that caused it', async () => {
		const receipt = await published();
		expect(receipt.finding.missingCapability).toBe(
			HOLDOUT_REACT_CYPRESS_RWA_MISSING_CAPABILITY,
		);
		expect(receipt.finding.exactDemand.code).toBe('UNLOADABLE_DEPENDENCY');
		expect(receipt.finding.exactDemand.compilerText).toBe('stream did not contain valid UTF-8');
		expect(receipt.finding.offendingFile.package).toBe('faker@5.5.3');
		expect(receipt.finding.offendingFile.encoding).toContain('ISO-8859-1');
		expect(receipt.finding.offendingFile.invalidUtf8ByteCount).toBe(6);
		expect(receipt.finding.offendingFile.invalidBytes.map((entry) => entry.offset)).toEqual([
			5170, 6973, 9233, 9538, 9570,
		]);
		expect(receipt.finding.reachedFromApplicationCode.importer).toBe(
			'src/utils/transactionUtils.ts',
		);
	});

	it('carries the non-claims, including that no browser evidence exists', async () => {
		const receipt = await published();
		for (const claim of HOLDOUT_REACT_CYPRESS_RWA_ADDED_NONCLAIMS)
			expect(receipt.nonclaims).toContain(claim);
		expect(receipt.nonclaims.join('\n')).toContain('No browser evidence exists');
		expect(receipt.nonclaims.join('\n')).toContain('would still have proven less');
		expect(receipt.parity.comparable).toBe(false);
	});

	it('never enters a lineage numerator', async () => {
		const receipt = await published();
		const corpusRecord = holdoutReactCypressRwaCorpusRecord(receipt);
		expect(corpusRecord.countedInLineageNumerator).toBe(false);
		expect(corpusRecord.attempted).toBe(true);
		expect(corpusRecord.outcome).toBe('failed');
		expect(corpusRecord.reason).toBe(HOLDOUT_REACT_CYPRESS_RWA_MISSING_CAPABILITY);
		expect(corpusRecord.frozenAdapterFingerprint).toBe(
			HOLDOUT_REACT_CYPRESS_RWA_FROZEN_FINGERPRINT,
		);
		expect(corpusRecord.digest).toBe(receipt.integrity.canonicalDigest);
	});

	it('rejects a holdout relabelled as a pass', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		tampered.holdoutOutcome = 'passed' as 'failed';
		expect(() => parseHoldoutReactCypressRwaReceipt(resealed(tampered))).toThrow(
			/identity differs/,
		);
	});

	it('rejects a migrated lane recoloured green', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		tampered.lanes.migrated.outcome = 'green' as 'red';
		expect(() => parseHoldoutReactCypressRwaReceipt(resealed(tampered))).toThrow(
			/lane evidence differs/,
		);
	});

	it('rejects a demand list edited after the identity proof was taken', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		tampered.lanes.migrated.demands = [
			{
				...tampered.lanes.migrated.demands[0]!,
				detail: 'something else entirely',
			},
		];
		expect(() => parseHoldoutReactCypressRwaReceipt(resealed(tampered))).toThrow(
			/identity proof differs/,
		);
	});

	it('rejects a claim that adapter bytes changed', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		tampered.frozenAdapter.bytesChanged = 1 as 0;
		expect(() => parseHoldoutReactCypressRwaReceipt(resealed(tampered))).toThrow(
			/freeze binding differs/,
		);
	});

	it('rejects dropped non-claims', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		tampered.nonclaims = tampered.nonclaims.filter(
			(claim) => !claim.startsWith('No browser evidence'),
		);
		expect(() => parseHoldoutReactCypressRwaReceipt(resealed(tampered))).toThrow(
			/non-claims differ/,
		);
	});

	it('rejects a receipt whose declared digest does not seal its content', async () => {
		const receipt = await published();
		const tampered = structuredClone(receipt);
		tampered.finding.verdict = 'the frozen adapter carries this application';
		expect(() => parseHoldoutReactCypressRwaReceipt(tampered)).toThrow(/integrity differs/);
	});

	it('refuses to derive from edited run evidence', async () => {
		const { mkdtemp, mkdir, cp, rm } = await import('node:fs/promises');
		const os = await import('node:os');
		const directory = await mkdtemp(path.join(os.tmpdir(), 'holdout-cypress-rwa-'));
		try {
			await mkdir(path.join(directory, 'evidence/runs'), { recursive: true });
			await cp(
				path.join(root, 'evidence/runs/react-cypress-rwa'),
				path.join(directory, 'evidence/runs/react-cypress-rwa'),
				{ recursive: true },
			);
			const profile = path.join(directory, HOLDOUT_REACT_CYPRESS_RWA_RUN_EVIDENCE[0]!.path);
			const value = JSON.parse(await readFile(profile, 'utf8')) as {
				migratedLane: { result: string };
			};
			value.migratedLane.result = 'green';
			await writeFile(profile, `${JSON.stringify(value, null, 2)}\n`);
			await expect(deriveHoldoutReactCypressRwaReceipt(directory)).rejects.toThrow(
				/run evidence drifted/,
			);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
