import { readFile } from 'node:fs/promises';
import { join, resolve } from 'pathe';
import { describe, expect, it } from 'vitest';
import { canonicalize } from '../../core/src/receipts/canonicalize.ts';
import {
	parseWitnessReactMemosReceipt,
	REACT_MEMOS_PROJECTION_BEHAVIOR_DIGEST,
	REACT_MEMOS_PROJECTION_SEED_FIXTURE,
	WITNESS_REACT_MEMOS_CONSOLE_ERRORS,
	WITNESS_REACT_MEMOS_FAILED_REQUESTS,
	WITNESS_REACT_MEMOS_STYLE_PROBES,
	witnessReactMemosBehaviorDigest,
	witnessReactMemosRawDigest,
} from '../../core/src/receipts/witness-react-memos.ts';
import {
	MEMOS_OWNER_PASSWORD,
	MEMOS_PROJECTION_BEHAVIOR_DIGEST,
	MEMOS_SEED,
	MEMOS_SEED_AMENDMENT,
	memosSeedDigest,
	memosSigninValidates,
	replayMemosProjectionBehavior,
} from '../src/witness/memos-projection.ts';
import { main, verifyWitnessReactMemos } from '../src/witness/react-memos-run.ts';
import {
	MEMOS_JOURNEY_NAVIGATIONS,
	MEMOS_MUTATION_SEAM,
	reactMemosWitnessSpec,
} from '../src/witness/real-app-run.ts';

const root = resolve(import.meta.dirname, '../../..');
const output = join(root, 'evidence/runs/witness-react-memos-v0-1-3');

describe('Memos direct Witness command', () => {
	it('rejects incomplete modes without launching a browser', async () => {
		await expect(main([])).rejects.toThrow('--run-twice');
		await expect(
			main(['--publish', 'evidence/runs/witness-react-memos-v0-1-3']),
		).rejects.toThrow('--run-twice');
	});

	it('refuses to publish anywhere but the canonical evidence directory', async () => {
		await expect(main(['--run-twice', '--publish', 'evidence/runs/elsewhere'])).rejects.toThrow(
			'publish path differs',
		);
	});

	it('verifies the published browser-proof evidence', async () => {
		const receipt = parseWitnessReactMemosReceipt(
			JSON.parse(await readFile(join(output, 'receipt.json'), 'utf8')),
		);
		expect(new Set(receipt.runs.map(witnessReactMemosBehaviorDigest))).toHaveProperty(
			'size',
			1,
		);
		for (const run of receipt.runs)
			expect(run.semanticDigest).toBe(witnessReactMemosRawDigest(run));
		await expect(verifyWitnessReactMemos(output)).resolves.toEqual(receipt);
	});

	it('holds the frozen projection to its committed seed and its frozen behaviour', async () => {
		const committed = JSON.parse(
			await readFile(join(root, REACT_MEMOS_PROJECTION_SEED_FIXTURE), 'utf8'),
		) as Record<string, unknown> & { sha256?: unknown };
		const { sha256: committedDigest, ...seed } = committed;
		expect(canonicalize(seed)).toBe(canonicalize(MEMOS_SEED));
		expect(committedDigest).toBe(memosSeedDigest());
		const replay = await replayMemosProjectionBehavior();
		expect(replay.digest).toBe(MEMOS_PROJECTION_BEHAVIOR_DIGEST);
		expect(replay.digest).toBe(REACT_MEMOS_PROJECTION_BEHAVIOR_DIGEST);
	});

	it('keeps the amended owner pair acceptable to the pinned sign-in validator', () => {
		const owner = MEMOS_SEED.users[0]!;
		expect(memosSigninValidates(owner.email)).toBe(true);
		expect(memosSigninValidates(MEMOS_OWNER_PASSWORD)).toBe(true);
		// The pair the amendment superseded is the reason the amendment exists,
		// and it is still refused by the same rule.
		expect(memosSigninValidates(MEMOS_SEED_AMENDMENT.supersededOwnerEmail)).toBe(false);
		expect(memosSigninValidates(MEMOS_SEED_AMENDMENT.supersededOwnerPassword)).toBe(false);
	});

	it('declares the lane bindings, inventories and probes the receipt schema enforces', () => {
		const spec = reactMemosWitnessSpec();
		expect(spec.framework).toBe('react');
		expect(spec.canonicalBinding).toBe('file-sha256');
		expect(spec.sources.baseline).toContain('baseline/dist-run1');
		expect(spec.sources.migrated).toContain('target/dist-vite-run1');
		expect(spec.consoleErrorInventory).toBe(WITNESS_REACT_MEMOS_CONSOLE_ERRORS);
		expect(spec.failedRequestInventory).toBe(WITNESS_REACT_MEMOS_FAILED_REQUESTS);
		expect(spec.renderedStyleProbes).toBe(WITNESS_REACT_MEMOS_STYLE_PROBES);
		// The application opens no socket, so the loopback seam declares none and
		// the origin registers no upgrade handler at all.
		expect(spec.loopback?.().upgrade).toBeUndefined();
		expect(spec.serviceWorkers).toBeUndefined();
	});

	it('publishes the journey, mutation and projection-ledger artifacts beside the build receipt', async () => {
		const artifacts = join(root, 'evidence/runs/react-memos-v0-1-3/artifacts');
		const journeys = JSON.parse(
			await readFile(join(artifacts, 'witness-journeys.json'), 'utf8'),
		) as unknown[];
		const mutation = JSON.parse(
			await readFile(join(artifacts, 'witness-mutation.json'), 'utf8'),
		) as {
			seam: string;
			intendedFailure: boolean;
			restoredByteIdentically: boolean;
			beforeSha256: string;
			mutatedSha256: string;
			afterRestoreSha256: string;
		};
		const ledger = JSON.parse(
			await readFile(join(artifacts, 'witness-projection-ledger.json'), 'utf8'),
		) as {
			behaviorDigest: string;
			seedSha256: string;
			records: Array<{ sequence: number; decision: string; endpoint: string | null }>;
		};
		expect(journeys).toHaveLength(4);
		expect(mutation.intendedFailure).toBe(true);
		expect(mutation.restoredByteIdentically).toBe(true);
		expect(mutation.seam).toBe(MEMOS_MUTATION_SEAM);
		expect(mutation.beforeSha256).toBe(mutation.afterRestoreSha256);
		expect(mutation.mutatedSha256).not.toBe(mutation.beforeSha256);
		expect(ledger.behaviorDigest).toBe(REACT_MEMOS_PROJECTION_BEHAVIOR_DIGEST);
		expect(ledger.seedSha256).toBe(memosSeedDigest());
		expect(ledger.records.length).toBeGreaterThan(0);
		expect(ledger.records.map((record) => record.sequence)).toEqual(
			ledger.records.map((_record, index) => index + 1),
		);
		expect(
			ledger.records.some(
				(record) => record.endpoint === 'memo.create' && record.decision === 'served',
			),
		).toBe(true);
	});

	it('pins the navigation count the application own history writes produce', async () => {
		const receipt = parseWitnessReactMemosReceipt(
			JSON.parse(await readFile(join(output, 'receipt.json'), 'utf8')),
		);
		expect(receipt.router.navigations).toBe(MEMOS_JOURNEY_NAVIGATIONS);
		for (const run of receipt.runs) expect(run.routes).toHaveLength(MEMOS_JOURNEY_NAVIGATIONS);
	});

	it('keeps host identity out of the published receipt', async () => {
		const serialized = await readFile(join(output, 'receipt.json'), 'utf8');
		expect(serialized).not.toContain(root);
		expect(serialized).not.toContain('127.0.0.1');
	});
});
