import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	publishHoldoutReactCypressRwaReceipt,
	publishedHoldoutAggregateRecord,
} from '../src/fixture/holdout-react-cypress-rwa-publish.ts';
import {
	holdoutReactCypressRwaCorpusRecord,
	HOLDOUT_REACT_CYPRESS_RWA_MARKDOWN_PATH,
	HOLDOUT_REACT_CYPRESS_RWA_RECEIPT_PATH,
	verifyHoldoutReactCypressRwaEvidence,
} from '../../core/src/index.ts';

const repositoryRoot = path.resolve(import.meta.dirname, '../../..');

/**
 * Stages only the committed run evidence, so publication is proven to be a
 * derivation of that evidence rather than a copy of the already-published
 * receipt.
 */
async function stagedRoot(): Promise<string> {
	const directory = await mkdtemp(path.join(os.tmpdir(), 'holdout-cypress-rwa-publish-'));
	await mkdir(path.join(directory, 'evidence/runs'), { recursive: true });
	await cp(
		path.join(repositoryRoot, 'evidence/runs/react-cypress-rwa'),
		path.join(directory, 'evidence/runs/react-cypress-rwa'),
		{ recursive: true },
	);
	return directory;
}

describe('cypress-realworld-app holdout publication', () => {
	it('republishes the committed receipt byte-identically from the run evidence alone', async () => {
		const directory = await stagedRoot();
		try {
			const published = await publishHoldoutReactCypressRwaReceipt(directory);
			expect(published.written).toEqual([
				HOLDOUT_REACT_CYPRESS_RWA_RECEIPT_PATH,
				HOLDOUT_REACT_CYPRESS_RWA_MARKDOWN_PATH,
			]);
			for (const relative of published.written)
				expect(await readFile(path.join(directory, relative), 'utf8')).toBe(
					await readFile(path.join(repositoryRoot, relative), 'utf8'),
				);
			const verified = await verifyHoldoutReactCypressRwaEvidence(repositoryRoot);
			expect(published.digest).toBe(verified.digest);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('refuses to publish against edited run evidence', async () => {
		const directory = await stagedRoot();
		try {
			const profile = path.join(
				directory,
				'evidence/runs/react-cypress-rwa/build-profile.json',
			);
			const value = JSON.parse(await readFile(profile, 'utf8')) as {
				holdoutDiscipline: { adapterBytesChanged: number };
			};
			value.holdoutDiscipline.adapterBytesChanged = 1;
			await writeFile(profile, `${JSON.stringify(value, null, 2)}\n`);
			await expect(publishHoldoutReactCypressRwaReceipt(directory)).rejects.toThrow(
				/run evidence drifted/,
			);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('carries the holdout in the published aggregate, counted in no numerator', async () => {
		const verified = await verifyHoldoutReactCypressRwaEvidence(repositoryRoot);
		expect(await publishedHoldoutAggregateRecord(repositoryRoot)).toEqual(
			holdoutReactCypressRwaCorpusRecord(verified.receipt),
		);
	});
});
