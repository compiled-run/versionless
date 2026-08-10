import { readFile } from 'node:fs/promises';
import { join, resolve } from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	parseWitnessReactBoilerplateZeroSwReceipt,
	witnessReactBoilerplateZeroSwBehaviorDigest,
} from '../../core/src/receipts/react-boilerplate-zero-sw.ts';
import {
	main,
	verifyWitnessReactBoilerplateZeroSw,
} from '../src/witness/react-boilerplate-zero-sw-run.ts';

const root = resolve(import.meta.dirname, '../../..');
const output = join(root, 'evidence/runs/witness-react-boilerplate-zero-sw');

describe('React Boilerplate zero-service-worker Witness command', () => {
	it('rejects incomplete modes without launching a browser', async () => {
		await expect(main([])).rejects.toThrow('--run-twice');
		await expect(
			main(['--publish', 'evidence/runs/witness-react-boilerplate-zero-sw']),
		).rejects.toThrow('--run-twice');
	});

	it('verifies published zero-SW evidence when present', async () => {
		const receiptPath = join(output, 'receipt.json');
		const exists = await readFile(receiptPath, 'utf8').then(
			() => true,
			() => false,
		);
		if (!exists) return;
		const receipt = parseWitnessReactBoilerplateZeroSwReceipt(
			JSON.parse(await readFile(receiptPath, 'utf8')),
		);
		expect(
			new Set(receipt.runs.map(witnessReactBoilerplateZeroSwBehaviorDigest)),
		).toHaveProperty('size', 1);
		await expect(verifyWitnessReactBoilerplateZeroSw(output)).resolves.toEqual(receipt);
	});
});
