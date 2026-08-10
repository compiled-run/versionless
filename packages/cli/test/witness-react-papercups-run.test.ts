import { readFile } from 'node:fs/promises';
import { join, resolve } from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	parseWitnessReactPapercupsReceipt,
	witnessReactPapercupsBehaviorDigest,
	witnessReactPapercupsRawDigest,
} from '../../core/src/receipts/witness-react-papercups.ts';
import { main, verifyWitnessReactPapercups } from '../src/witness/react-papercups-run.ts';

const root = resolve(import.meta.dirname, '../../..');
const output = join(root, 'evidence/runs/witness-react-papercups');

describe('Papercups direct Witness command', () => {
	it('rejects incomplete modes without launching a browser', async () => {
		await expect(main([])).rejects.toThrow('--run-twice');
		await expect(main(['--publish', 'evidence/runs/witness-react-papercups'])).rejects.toThrow(
			'--run-twice',
		);
	});

	it('refuses to publish anywhere but the canonical evidence directory', async () => {
		await expect(main(['--run-twice', '--publish', 'evidence/runs/elsewhere'])).rejects.toThrow(
			'publish path differs',
		);
	});

	it('verifies the published browser-proof evidence', async () => {
		const receipt = parseWitnessReactPapercupsReceipt(
			JSON.parse(await readFile(join(output, 'receipt.json'), 'utf8')),
		);
		expect(new Set(receipt.runs.map(witnessReactPapercupsBehaviorDigest))).toHaveProperty(
			'size',
			1,
		);
		for (const run of receipt.runs)
			expect(run.semanticDigest).toBe(witnessReactPapercupsRawDigest(run));
		await expect(verifyWitnessReactPapercups(output)).resolves.toEqual(receipt);
	});

	it('publishes the journey and mutation artifacts beside the retained build receipt', async () => {
		const artifacts = join(root, 'evidence/runs/react-papercups-v1-0-0/artifacts');
		const journeys = JSON.parse(
			await readFile(join(artifacts, 'witness-journeys.json'), 'utf8'),
		) as unknown[];
		const mutation = JSON.parse(
			await readFile(join(artifacts, 'witness-mutation.json'), 'utf8'),
		) as { seam: string; intendedFailure: boolean; restoredByteIdentically: boolean };
		expect(journeys).toHaveLength(4);
		expect(mutation.intendedFailure).toBe(true);
		expect(mutation.restoredByteIdentically).toBe(true);
		expect(mutation.seam.length).toBeGreaterThan(0);
	});
});
