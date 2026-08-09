import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	main,
	publishWitnessReactBoilerplateTransaction,
} from '../src/witness/react-boilerplate-run.ts';
import {
	parseWitnessReactBoilerplateReceipt,
	WITNESS_REACT_BOILERPLATE_MUTATION,
	witnessReactBoilerplateDigest,
} from '../../core/src/receipts/witness-react-boilerplate.ts';
import { sha256 } from '../../core/src/receipts/canonicalize.ts';

const root = path.resolve(import.meta.dirname, '../../..');
const retainedBundle = path.join(
	root,
	'.versionless/work/react-boilerplate-v4-composed/target/build-vite',
	WITNESS_REACT_BOILERPLATE_MUTATION.path,
);
const published = path.join(root, 'evidence/runs/witness-react-boilerplate');

async function exists(file: string): Promise<boolean> {
	return access(file).then(
		() => true,
		() => false,
	);
}

describe('standalone React Boilerplate Witness command', () => {
	it('rejects incomplete modes without running another application', async () => {
		await expect(main([])).rejects.toThrow('--run-twice');
		await expect(
			main(['--publish', 'evidence/runs/witness-react-boilerplate']),
		).rejects.toThrow('--run-twice');
	});

	it('pins the exact immutable German-heading production-bundle seam', async () => {
		const bytes = await readFile(retainedBundle);
		const source = Buffer.from(WITNESS_REACT_BOILERPLATE_MUTATION.sourceSpan);
		expect(bytes).toHaveLength(420_324);
		expect(sha256(bytes)).toBe(WITNESS_REACT_BOILERPLATE_MUTATION.beforeSha256);
		expect(source).toHaveLength(WITNESS_REACT_BOILERPLATE_MUTATION.bytes);
		expect(bytes.indexOf(source)).toBe(WITNESS_REACT_BOILERPLATE_MUTATION.offset);
		expect(bytes.lastIndexOf(source)).toBe(WITNESS_REACT_BOILERPLATE_MUTATION.offset);
	});

	it('publishes idempotently and rolls receipt pair plus aggregate back after failure', async () => {
		if (!(await exists(path.join(published, 'receipt.json')))) return;
		const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-react-witness-'));
		try {
			const output = path.join(directory, 'evidence/runs/witness-react-boilerplate');
			const aggregatePath = path.join(directory, 'evidence/runs/aggregate.json');
			await mkdir(path.dirname(aggregatePath), { recursive: true });
			await writeFile(
				aggregatePath,
				await readFile(path.join(root, 'evidence/runs/aggregate.json')),
			);
			const receipt = parseWitnessReactBoilerplateReceipt(
				JSON.parse(await readFile(path.join(published, 'receipt.json'), 'utf8')),
			);
			const transactionStageRoot = path.join(directory, '.versionless/stage/publication');
			const publish = async (value: typeof receipt, verifyPublished?: () => Promise<void>) =>
				await publishWitnessReactBoilerplateTransaction({
					output,
					aggregatePath,
					receipt: value,
					transactionStageRoot,
					verifyPublished,
				});
			await publish(receipt);
			const firstAggregate = await readFile(aggregatePath);
			const firstJson = await readFile(path.join(output, 'receipt.json'));
			const firstMarkdown = await readFile(path.join(output, 'receipt.md'));
			await publish(receipt);
			expect(await readFile(aggregatePath)).toEqual(firstAggregate);
			expect(await readFile(path.join(output, 'receipt.json'))).toEqual(firstJson);

			const changed = structuredClone(receipt);
			changed.provenance = { rollback: 'candidate' };
			changed.integrity.canonicalDigest = witnessReactBoilerplateDigest(changed);
			await expect(
				publish(changed, async () => {
					throw new Error('injected post-swap failure');
				}),
			).rejects.toThrow('injected post-swap failure');
			expect(await readFile(aggregatePath)).toEqual(firstAggregate);
			expect(await readFile(path.join(output, 'receipt.json'))).toEqual(firstJson);
			expect(await readFile(path.join(output, 'receipt.md'))).toEqual(firstMarkdown);
			await expect(access(transactionStageRoot)).rejects.toThrow();
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
