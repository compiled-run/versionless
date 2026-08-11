import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	parseWitnessReactLinkfreeReceipt,
	witnessReactLinkfreeBehaviorDigest,
	witnessReactLinkfreeRawDigest,
} from '../../core/src/receipts/witness-react-linkfree.ts';
import {
	LINKFREE_JOURNEY_PROFILE,
	LINKFREE_SYNTHETIC_CORPUS_DIRECTORY,
	LINKFREE_SYNTHETIC_PROFILES,
	linkfreeAvatarFallbackUrl,
	linkfreeSyntheticCorpusDocuments,
	verifyLinkfreeSyntheticCorpus,
} from '../src/fixture/react-linkfree-v0-72-0-witness-corpus.ts';
import { main, verifyWitnessReactLinkfree } from '../src/witness/react-linkfree-run.ts';

const root = resolve(import.meta.dirname, '../../..');
const output = join(root, 'evidence/runs/witness-react-linkfree-v0-72-0');

describe('LinkFree direct Witness command', () => {
	it('rejects incomplete modes without launching a browser', async () => {
		await expect(main([])).rejects.toThrow('--run-twice');
		await expect(
			main(['--publish', 'evidence/runs/witness-react-linkfree-v0-72-0']),
		).rejects.toThrow('--run-twice');
	});

	it('refuses to publish anywhere but the canonical evidence directory', async () => {
		await expect(main(['--run-twice', '--publish', 'evidence/runs/elsewhere'])).rejects.toThrow(
			'publish path differs',
		);
	});

	it('verifies the published browser-proof evidence', async () => {
		const receipt = parseWitnessReactLinkfreeReceipt(
			JSON.parse(await readFile(join(output, 'receipt.json'), 'utf8')),
		);
		expect(new Set(receipt.runs.map(witnessReactLinkfreeBehaviorDigest))).toHaveProperty(
			'size',
			1,
		);
		for (const run of receipt.runs)
			expect(run.semanticDigest).toBe(witnessReactLinkfreeRawDigest(run));
		await expect(verifyWitnessReactLinkfree(output)).resolves.toEqual(receipt);
	});

	it('keeps the committed synthetic corpus byte identical to its generator', async () => {
		const inventory = await verifyLinkfreeSyntheticCorpus(root);
		expect(inventory.files).toHaveLength(LINKFREE_SYNTHETIC_PROFILES.length);
		const committed = (
			await readdir(join(root, LINKFREE_SYNTHETIC_CORPUS_DIRECTORY))
		).sort();
		expect(committed).toEqual(
			linkfreeSyntheticCorpusDocuments()
				.map((document) => document.path)
				.sort(),
		);
		// Every committed document is invented, and the shape of that is checked
		// rather than asserted: a synthetic username, an avatar at the declared
		// seam host, and a biography that says what it is.
		for (const document of committed) expect(document).toMatch(/^synthetic-[a-z]+\.json$/);
		for (const profile of LINKFREE_SYNTHETIC_PROFILES) {
			expect(profile.username).toBe(`synthetic-${profile.name.toLowerCase()}`);
			expect(profile.avatar).toContain(`/synthetic/${profile.username}.png`);
			expect(profile.bio).toContain('Not a person');
			for (const link of profile.links) expect(link.url).toContain('https://example.invalid/');
		}
	});

	it('publishes the journey, mutation and corpus artifacts beside the retained build receipt', async () => {
		const artifacts = join(root, 'evidence/runs/react-linkfree-v0-72-0/artifacts');
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
		const corpus = JSON.parse(
			await readFile(join(artifacts, 'witness-synthetic-corpus.json'), 'utf8'),
		) as {
			staged: Record<string, { corpus: { aggregateSha256: string }; bundlerAuthoredPaths: number }>;
		};
		expect(journeys).toHaveLength(4);
		expect(mutation.intendedFailure).toBe(true);
		expect(mutation.restoredByteIdentically).toBe(true);
		expect(mutation.seam).toBe('Profile not found.');
		expect(mutation.beforeSha256).toBe(mutation.afterRestoreSha256);
		expect(mutation.mutatedSha256).not.toBe(mutation.beforeSha256);
		expect(corpus.staged['baseline']!.corpus.aggregateSha256).toBe(
			corpus.staged['migrated']!.corpus.aggregateSha256,
		);
		expect(corpus.staged['baseline']!.bundlerAuthoredPaths).toBeGreaterThan(0);
	});

	it('records the avatar cascade at the endpoint the application itself builds', async () => {
		const receipt = parseWitnessReactLinkfreeReceipt(
			JSON.parse(await readFile(join(output, 'receipt.json'), 'utf8')),
		);
		for (const run of receipt.runs)
			expect(run.applicationJourney.avatarCascade.cascadedEndpoint).toBe(
				linkfreeAvatarFallbackUrl(LINKFREE_JOURNEY_PROFILE.name),
			);
	});

	it('keeps host identity out of the published receipt', async () => {
		const serialized = await readFile(join(output, 'receipt.json'), 'utf8');
		expect(serialized).not.toContain(root);
		expect(serialized).not.toContain('127.0.0.1');
	});
});
