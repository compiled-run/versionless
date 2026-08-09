import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	main,
	publishWitnessNextKilledByGoogleTransaction,
	stageNextKilledByGoogleInputs,
} from '../src/witness/next-killedbygoogle-run.ts';
import { sha256 } from '../../core/src/receipts/canonicalize.ts';
import {
	parseWitnessNextKilledByGoogleReceipt,
	WITNESS_NEXT_KILLED_BY_GOOGLE_MUTATION,
	WITNESS_NEXT_KILLED_BY_GOOGLE_PRERENDER,
	witnessNextKilledByGoogleDigest,
} from '../../core/src/receipts/witness-next-killedbygoogle.ts';

const root = path.resolve(import.meta.dirname, '../../..');
const retained = path.join(
	root,
	'.versionless/stage/witness-real-app/killedbygoogle-retained/migrated/index.html',
);

describe('standalone Next KilledByGoogle Witness command', () => {
	it('rejects incomplete modes without running another application', async () => {
		await expect(main([])).rejects.toThrow('--run-twice');
		await expect(
			main(['--publish', 'evidence/runs/witness-next-killedbygoogle']),
		).rejects.toThrow('--run-twice');
	});

	it('pins exact UTF-8 Buffer offsets and four-span mutation hashes', async () => {
		const before = await readFile(retained);
		const source = Buffer.from(WITNESS_NEXT_KILLED_BY_GOOGLE_MUTATION.sourceSpan, 'utf8');
		const replacement = Buffer.from(WITNESS_NEXT_KILLED_BY_GOOGLE_MUTATION.mutatedSpan, 'utf8');
		const offsets: number[] = [];
		for (
			let offset = before.indexOf(source);
			offset >= 0;
			offset = before.indexOf(source, offset + 1)
		)
			offsets.push(offset);
		expect(before).toHaveLength(WITNESS_NEXT_KILLED_BY_GOOGLE_MUTATION.bytes);
		expect(sha256(before)).toBe(WITNESS_NEXT_KILLED_BY_GOOGLE_MUTATION.beforeSha256);
		expect(offsets).toEqual(WITNESS_NEXT_KILLED_BY_GOOGLE_MUTATION.offsets);
		const mutated = Buffer.from(before);
		for (const offset of offsets) replacement.copy(mutated, offset);
		expect(sha256(mutated)).toBe(WITNESS_NEXT_KILLED_BY_GOOGLE_MUTATION.mutatedSha256);
		expect(mutated.indexOf(source)).toBe(-1);
	});

	it('stages exact lane-bound Next prerender payloads without changing retained output', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-next-stage-'));
		try {
			const retainedHashes = Object.fromEntries(
				await Promise.all(
					(['baseline', 'migrated'] as const).map(async (lane) => [
						lane,
						sha256(
							await readFile(
								path.join(
									root,
									`.versionless/stage/witness-real-app/killedbygoogle-retained/${lane}/index.html`,
								),
							),
						),
					]),
				),
			);
			const staged = await stageNextKilledByGoogleInputs(directory);
			for (const lane of ['baseline', 'migrated'] as const) {
				const expected = WITNESS_NEXT_KILLED_BY_GOOGLE_PRERENDER[lane];
				const payload = await readFile(path.join(staged.lanes[lane], expected.stagedPath));
				expect(payload).toHaveLength(WITNESS_NEXT_KILLED_BY_GOOGLE_PRERENDER.payload.bytes);
				expect(sha256(payload)).toBe(
					WITNESS_NEXT_KILLED_BY_GOOGLE_PRERENDER.payload.sha256,
				);
				expect(Object.keys(JSON.parse(payload.toString('utf8'))).sort()).toEqual(
					WITNESS_NEXT_KILLED_BY_GOOGLE_PRERENDER.payload.keys,
				);
				expect(staged.support[lane]).toMatchObject({
					lane,
					buildId: expected.buildId,
					dataRoute: expected.dataRoute,
				});
				const retainedIndex = path.join(
					root,
					`.versionless/stage/witness-real-app/killedbygoogle-retained/${lane}/index.html`,
				);
				expect(sha256(await readFile(retainedIndex))).toBe(retainedHashes[lane]);
			}
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('is idempotent and rolls back JSON, Markdown and aggregate together', async () => {
		const published = path.join(root, 'evidence/runs/witness-next-killedbygoogle');
		try {
			await access(path.join(published, 'receipt.json'));
		} catch {
			return;
		}
		const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-next-witness-'));
		try {
			const output = path.join(directory, 'evidence/runs/witness-next-killedbygoogle');
			const aggregatePath = path.join(directory, 'evidence/runs/aggregate.json');
			await mkdir(path.dirname(aggregatePath), { recursive: true });
			await writeFile(
				aggregatePath,
				await readFile(path.join(root, 'evidence/runs/aggregate.json')),
			);
			const receipt = parseWitnessNextKilledByGoogleReceipt(
				JSON.parse(await readFile(path.join(published, 'receipt.json'), 'utf8')),
			);
			const stage = path.join(directory, '.versionless/stage/publication');
			const publish = async (value: typeof receipt, verifyPublished?: () => Promise<void>) =>
				await publishWitnessNextKilledByGoogleTransaction({
					output,
					aggregatePath,
					receipt: value,
					transactionStageRoot: stage,
					verifyPublished,
				});
			await publish(receipt);
			const originalAggregate = await readFile(aggregatePath);
			const originalJson = await readFile(path.join(output, 'receipt.json'));
			const originalMarkdown = await readFile(path.join(output, 'receipt.md'));
			await publish(receipt);
			expect(await readFile(aggregatePath)).toEqual(originalAggregate);
			const changed = structuredClone(receipt);
			changed.provenance = { rollback: 'candidate' };
			changed.integrity.canonicalDigest = witnessNextKilledByGoogleDigest(changed);
			await expect(
				publish(changed, async () => {
					throw new Error('injected post-swap failure');
				}),
			).rejects.toThrow('injected post-swap failure');
			expect(await readFile(aggregatePath)).toEqual(originalAggregate);
			expect(await readFile(path.join(output, 'receipt.json'))).toEqual(originalJson);
			expect(await readFile(path.join(output, 'receipt.md'))).toEqual(originalMarkdown);
			await expect(access(stage)).rejects.toThrow();
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
