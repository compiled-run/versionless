import { readFile } from 'node:fs/promises';
import { join, resolve } from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	parseWitnessReactHospitalrunReceipt,
	witnessReactHospitalrunBehaviorDigest,
	witnessReactHospitalrunRawDigest,
} from '../../core/src/receipts/witness-react-hospitalrun.ts';
import { main, verifyWitnessReactHospitalrun } from '../src/witness/react-hospitalrun-run.ts';

const root = resolve(import.meta.dirname, '../../..');
const output = join(root, 'evidence/runs/witness-react-hospitalrun');

describe('HospitalRun direct Witness command', () => {
	it('rejects incomplete modes without launching a browser', async () => {
		await expect(main([])).rejects.toThrow('--run-twice');
		await expect(
			main(['--publish', 'evidence/runs/witness-react-hospitalrun']),
		).rejects.toThrow('--run-twice');
	});

	it('refuses to publish anywhere but the canonical evidence directory', async () => {
		await expect(main(['--run-twice', '--publish', 'evidence/runs/elsewhere'])).rejects.toThrow(
			'publish path differs',
		);
	});

	it('verifies the published browser-proof evidence', async () => {
		const receipt = parseWitnessReactHospitalrunReceipt(
			JSON.parse(await readFile(join(output, 'receipt.json'), 'utf8')),
		);
		expect(new Set(receipt.runs.map(witnessReactHospitalrunBehaviorDigest))).toHaveProperty(
			'size',
			1,
		);
		for (const run of receipt.runs)
			expect(run.semanticDigest).toBe(witnessReactHospitalrunRawDigest(run));
		await expect(verifyWitnessReactHospitalrun(output)).resolves.toEqual(receipt);
	});

	it('publishes the journey and mutation artifacts beside the retained build receipt', async () => {
		const artifacts = join(root, 'evidence/runs/react-hospitalrun/artifacts');
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
		expect(journeys).toHaveLength(4);
		expect(mutation.intendedFailure).toBe(true);
		expect(mutation.restoredByteIdentically).toBe(true);
		expect(mutation.seam).toBe('Successfully created patient');
		expect(mutation.beforeSha256).toBe(mutation.afterRestoreSha256);
		expect(mutation.mutatedSha256).not.toBe(mutation.beforeSha256);
	});

	it('keeps host identity out of the published receipt', async () => {
		const serialized = await readFile(join(output, 'receipt.json'), 'utf8');
		expect(serialized).not.toContain(root);
		expect(serialized).not.toContain('127.0.0.1');
	});
});
