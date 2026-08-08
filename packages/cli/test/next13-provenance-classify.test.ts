import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import * as path from 'pathe';
import { afterEach, describe, expect, it } from 'vitest';
import { sha256 } from '../../core/src/receipts/canonicalize.ts';
import { runNext13ProvenanceClassification } from '../src/next13-provenance-classify.ts';

const workspace = path.resolve(import.meta.dirname, '../../..');
const archiveSha = 'c227efa283b4a17d7ae76aa1b9ea259075f606128642d59f7b43ca63405ee1f7';
const replaySha = '5b525cf6cfc447fbdd3ca0640115c7810b67de5dd1680e3d5ff624356e767a98';
const closureFiles = [
	'fixtures/next-tailwind-starter-blog/fixture.json',
	'fixtures/next-tailwind-starter-blog/provenance.json',
	'evidence/ingests/next-tailwind-starter-blog/t142-ingest.json',
	`.versionless/cache/tier-f/next-tailwind-starter-blog/${archiveSha}/source.tar.gz`,
	`.versionless/cache/tier-f/next-tailwind-starter-blog/${archiveSha}/manifest.json`,
] as const;
const outputPath = 'evidence/classifications/next-tailwind-starter-blog/t149-classification.json';
const temporary: string[] = [];
const verified = async () => ({ networkAttempts: 0 as const, digest: replaySha });

async function rootWithClosure(): Promise<string> {
	const root = await mkdtemp(path.join(os.tmpdir(), 'versionless-t149-classification-'));
	temporary.push(root);
	for (const relative of closureFiles) {
		const destination = path.join(root, relative);
		await mkdir(path.dirname(destination), { recursive: true });
		await writeFile(destination, await readFile(path.join(workspace, relative)));
	}
	return root;
}

afterEach(async () => {
	for (const directory of temporary.splice(0))
		await rm(directory, { recursive: true, force: true });
});

describe('offline Next13 provenance classification CLI', () => {
	it('re-indexes the exact T142 closure and publishes only a static receipt', async () => {
		const root = await rootWithClosure();
		const before = await Promise.all(
			closureFiles.map(async (relative) => sha256(await readFile(path.join(root, relative)))),
		);
		const receipt = await runNext13ProvenanceClassification({
			fixtureId: 'next-tailwind-starter-blog',
			outputPath,
			offline: true,
			rootDir: root,
			environment: { VERSIONLESS_NETWORK_MODE: 'offline' },
			verifyT142: verified,
		});
		expect(receipt.closure).toMatchObject({
			fixtureSha256: 'd24bf99d50e7f90ac53dcc7d99f04fcd9842379d94393548c7abbf486288b6c1',
			provenanceSha256: 'b0cb4e5b597bd619d8ea76912b09a6257bb1e3be4f4d259160334518a8b5bc29',
			evidenceSha256: '4562e7fe0ab786cede4a40ead07666d44d085a45699443fe65da4aabed9b61f0',
			archiveSha256: archiveSha,
			offlineReplaySha256: replaySha,
			officialTreeRows: 138,
			archiveFiles: 110,
			assets: { total: 25, excluded: 11, unknown: 14, compatible: 0 },
			provenance: 'verified',
		});
		expect(receipt.classification.sourceFacts).toMatchObject({
			next: { declaration: '13.4.8' },
			packageManager: { pinnedRelease: 'absent', resolutions: 1165, checksums: 1110 },
			routing: { mode: 'app', generateStaticParams: 'present-not-executed' },
			apiRoute: { method: 'POST', state: 'present-not-executed' },
			nodeEngine: 'absent',
		});
		expect(JSON.parse(await readFile(path.join(root, outputPath), 'utf8'))).toEqual(receipt);
		const after = await Promise.all(
			closureFiles.map(async (relative) => sha256(await readFile(path.join(root, relative)))),
		);
		expect(after).toEqual(before);
		await expect(
			access(
				path.join(
					path.dirname(path.join(root, outputPath)),
					'.t149-classification.json.tmp',
				),
			),
		).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it('rejects every closure-byte mutation', async () => {
		for (const relative of closureFiles) {
			const root = await rootWithClosure();
			const file = path.join(root, relative);
			await writeFile(file, Buffer.concat([await readFile(file), Buffer.from('tamper')]));
			await expect(
				runNext13ProvenanceClassification({
					fixtureId: 'next-tailwind-starter-blog',
					outputPath,
					offline: true,
					rootDir: root,
					environment: { VERSIONLESS_NETWORK_MODE: 'offline' },
					verifyT142: verified,
				}),
			).rejects.toThrow('closure hash mismatch');
		}
	});

	it('rejects mode, fixture, verifier, execution, and every non-designated output before verification', async () => {
		const root = await rootWithClosure();
		const base = {
			fixtureId: 'next-tailwind-starter-blog',
			outputPath,
			offline: true,
			rootDir: root,
			environment: { VERSIONLESS_NETWORK_MODE: 'offline' },
			verifyT142: verified,
		};
		await expect(
			runNext13ProvenanceClassification({ ...base, offline: false }),
		).rejects.toThrow('offline');
		await expect(
			runNext13ProvenanceClassification({ ...base, fixtureId: 'other' }),
		).rejects.toThrow('not authorized');
		await expect(
			runNext13ProvenanceClassification({ ...base, candidateExecution: true }),
		).rejects.toThrow('forbids candidate execution');
		await expect(
			runNext13ProvenanceClassification({
				...base,
				verifyT142: async () => ({ networkAttempts: 0, digest: 'wrong' }),
			}),
		).rejects.toThrow('prerequisite');
		for (const protectedPath of [
			...closureFiles,
			'../escape.json',
			'package.json',
			'evidence/classifications/next-killedbygoogle/t130-classification.json',
		]) {
			let calls = 0;
			await expect(
				runNext13ProvenanceClassification({
					...base,
					outputPath: protectedPath,
					verifyT142: async () => {
						calls += 1;
						return verified();
					},
				}),
			).rejects.toThrow('exact designated path');
			expect(calls).toBe(0);
		}
	});
});
