/**
 * The named refusal a pristine checkout gets instead of a digest-mismatch
 * sentence.
 *
 * Both legs matter and they are opposites: a subject that is absent is a build
 * that never happened and is refused by name, and a subject that is present is
 * not this refusal's business at all — whatever it hashes to is settled by the
 * comparison downstream, which stays the hard error it is.
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import { TRUST_DISTRIBUTION_NOT_BUILT, assertDistributionBuilt } from '../src/verify.ts';

describe('trust.distribution-not-built', () => {
	it('refuses by name, and names the remedy and its ordering, when a subject is absent', async () => {
		const checkout = await mkdtemp(path.join(tmpdir(), 'versionless-unbuilt-'));
		try {
			await expect(
				assertDistributionBuilt(checkout, [
					{ path: 'packages/core/dist/index.js' },
					{ path: 'packages/cli/dist/index.js' },
				]),
			).rejects.toThrow(TRUST_DISTRIBUTION_NOT_BUILT);
			const failure = await assertDistributionBuilt(checkout, [
				{ path: 'packages/core/dist/index.js' },
			]).catch((error: unknown) => (error as Error).message);
			expect(failure).toContain('npm run build');
			expect(failure).toContain('build first, trust second');
			expect(failure).toContain('packages/core/dist/index.js');
		} finally {
			await rm(checkout, { recursive: true, force: true });
		}
	});

	it('says nothing about a subject that is present, whatever it contains', async () => {
		const checkout = await mkdtemp(path.join(tmpdir(), 'versionless-built-'));
		try {
			await mkdir(path.join(checkout, 'packages/core/dist'), { recursive: true });
			await writeFile(
				path.join(checkout, 'packages/core/dist/index.js'),
				'not what the attestation says\n',
			);
			await expect(
				assertDistributionBuilt(checkout, [{ path: 'packages/core/dist/index.js' }]),
			).resolves.toBeUndefined();
		} finally {
			await rm(checkout, { recursive: true, force: true });
		}
	});

	it('refuses nothing when the provenance attests no subject at all', async () => {
		await expect(assertDistributionBuilt('/nonexistent', [])).resolves.toBeUndefined();
	});
});
