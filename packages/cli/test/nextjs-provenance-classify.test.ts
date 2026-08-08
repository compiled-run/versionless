import { access, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import * as path from 'pathe';
import { afterEach, describe, expect, it } from 'vitest';
import { sha256 } from '../../core/src/receipts/canonicalize.ts';
import {
	rejectSensitiveMaterial,
	runNextjsProvenanceClassification,
} from '../src/nextjs-provenance-classify.ts';

const workspace = path.resolve(import.meta.dirname, '../../..');
const archiveSha = 'c28878d0f65b56aa595763c852477fb0c1e3533e5c7f7ea9daa2be16f102368d';
const replaySha = 'faf10cb59a9b63919346d3a98250afbd8f89527fd616576c337da3e1e70bd85a';
const closureFiles = [
	'fixtures/next-killedbygoogle/fixture.json',
	'fixtures/next-killedbygoogle/provenance.json',
	'evidence/ingests/next-killedbygoogle/t128-ingest.json',
	`.versionless/cache/tier-f/next-killedbygoogle/${archiveSha}/source.tar.gz`,
	`.versionless/cache/tier-f/next-killedbygoogle/${archiveSha}/manifest.json`,
] as const;
const temporary: string[] = [];
const designatedOutput = 'evidence/classifications/next-killedbygoogle/t130-classification.json';

async function expectMissing(file: string): Promise<void> {
	await expect(access(file)).rejects.toMatchObject({ code: 'ENOENT' });
}

async function closureRoot(): Promise<string> {
	const root = await mkdtemp(path.join(os.tmpdir(), 'versionless-t130-classification-'));
	temporary.push(root);
	for (const relative of closureFiles) {
		const destination = path.join(root, relative);
		await mkdir(path.dirname(destination), { recursive: true });
		await writeFile(destination, await readFile(path.join(workspace, relative)));
	}
	return root;
}

const verified = async () => ({ networkAttempts: 0 as const, digest: replaySha });

afterEach(async () => {
	for (const directory of temporary.splice(0))
		await rm(directory, { recursive: true, force: true });
});

describe('offline Next.js provenance classification CLI', () => {
	it('re-indexes and binds the accepted closure without changing its bytes', async () => {
		const root = await closureRoot();
		const before = await Promise.all(
			closureFiles.map(async (relative) => sha256(await readFile(path.join(root, relative)))),
		);
		const outputPath = designatedOutput;
		const receipt = await runNextjsProvenanceClassification({
			fixtureId: 'next-killedbygoogle',
			outputPath,
			offline: true,
			rootDir: root,
			environment: { VERSIONLESS_NETWORK_MODE: 'offline' },
			verifyT128: verified,
		});
		expect(receipt.closure).toMatchObject({
			fixtureSha256: 'dd8725527ffa7f9b50826bd740cbda9bf5e2e08ee4c0fe8727505051c055d23a',
			provenanceSha256: '2d7b33af46e951f2e128b5dd4c440d611e0c27f593d3004b470190abc703164b',
			evidenceSha256: 'ee5498bb5b1187371b6c58c4dfb3e0cdd58fdab8e5eea1eb09eba839c6b66843',
			archiveSha256: archiveSha,
			cacheManifestSha256: '04d5d4ca5f4133ecb5772c5aab9053af4f58cfcfdb2d837dcdd0f16da5eec9d8',
			offlineReplaySha256: replaySha,
			officialTreeRows: 86,
			archiveFiles: 72,
			provenance: 'verified',
			provenanceScope: 'exact-immutable-closure-only',
		});
		expect(receipt.classification.sourceFacts).toMatchObject({
			next: { major: 12 },
			routing: { mode: 'pages' },
			staticGeneration: { kind: 'getStaticProps' },
			productionStack: { bundler: 'webpack', compatibility: 'not-tested' },
		});
		expect(receipt.locality).toEqual({
			mode: 'offline',
			networkAttempts: 0,
			candidateExecution: 'not-requested',
		});
		expect(JSON.parse(await readFile(path.join(root, outputPath), 'utf8'))).toEqual(receipt);
		const after = await Promise.all(
			closureFiles.map(async (relative) => sha256(await readFile(path.join(root, relative)))),
		);
		expect(after).toEqual(before);
		await expectMissing(
			path.join(
				root,
				'evidence/classifications/next-killedbygoogle/.t130-classification.json.t132.tmp',
			),
		);
	});

	it('rejects fixture/provenance/evidence/archive/cache hash drift', async () => {
		for (const relative of closureFiles) {
			const root = await closureRoot();
			const file = path.join(root, relative);
			await writeFile(file, Buffer.concat([await readFile(file), Buffer.from('tamper')]));
			await expect(
				runNextjsProvenanceClassification({
					fixtureId: 'next-killedbygoogle',
					outputPath: designatedOutput,
					offline: true,
					rootDir: root,
					environment: { VERSIONLESS_NETWORK_MODE: 'offline' },
					verifyT128: verified,
				}),
			).rejects.toThrow();
		}
	});

	it('rejects nonoffline mode, wrong fixture, path escape, candidate execution, and verifier drift before classification', async () => {
		const root = await closureRoot();
		const base = {
			fixtureId: 'next-killedbygoogle',
			outputPath: designatedOutput,
			offline: true,
			rootDir: root,
			environment: { VERSIONLESS_NETWORK_MODE: 'offline' },
			verifyT128: verified,
		};
		await expect(
			runNextjsProvenanceClassification({ ...base, offline: false }),
		).rejects.toThrow('offline');
		await expect(
			runNextjsProvenanceClassification({ ...base, fixtureId: 'other' }),
		).rejects.toThrow('not authorized');
		await expect(
			runNextjsProvenanceClassification({ ...base, outputPath: '../escape.json' }),
		).rejects.toThrow('exact designated path');
		await expect(
			runNextjsProvenanceClassification({ ...base, candidateExecution: true }),
		).rejects.toThrow('forbids candidate execution');
		await expect(
			runNextjsProvenanceClassification({
				...base,
				verifyT128: async () => ({ networkAttempts: 0, digest: 'wrong' }),
			}),
		).rejects.toThrow('prerequisite');
	});

	it('rejects every non-designated collision before verification or mutation', async () => {
		const root = await closureRoot();
		const protectedPaths = [
			...closureFiles,
			'package.json',
			'packages/cli/src/nextjs-provenance-classify.ts',
			'evidence/classifications/arbitrary.json',
		];
		for (const outputPath of [
			...protectedPaths,
			...protectedPaths.map((relative) => path.join(root, relative)),
		]) {
			let verificationCalls = 0;
			const protectedFile = path.isAbsolute(outputPath)
				? outputPath
				: path.join(root, outputPath);
			const before = await readFile(protectedFile).catch(() => undefined);
			await expect(
				runNextjsProvenanceClassification({
					fixtureId: 'next-killedbygoogle',
					outputPath,
					offline: true,
					rootDir: root,
					environment: { VERSIONLESS_NETWORK_MODE: 'offline' },
					verifyT128: async () => {
						verificationCalls += 1;
						return verified();
					},
				}),
			).rejects.toThrow('exact designated path');
			expect(verificationCalls).toBe(0);
			const after = await readFile(protectedFile).catch(() => undefined);
			expect(after).toEqual(before);
		}
	});

	it('rejects designated output path collisions and residue before verification', async () => {
		for (const collision of ['directory', 'output-symlink', 'parent-symlink', 'residue']) {
			const root = await closureRoot();
			const output = path.join(root, designatedOutput);
			const parent = path.dirname(output);
			if (collision === 'directory') await mkdir(output, { recursive: true });
			if (collision === 'output-symlink') {
				await mkdir(parent, { recursive: true });
				await symlink(path.join(root, closureFiles[0]), output);
			}
			if (collision === 'parent-symlink') {
				const target = path.join(root, 'symlink-target');
				await mkdir(target, { recursive: true });
				await mkdir(path.dirname(parent), { recursive: true });
				await symlink(target, parent);
			}
			if (collision === 'residue') {
				await mkdir(parent, { recursive: true });
				await writeFile(path.join(parent, '.t130-classification.json.t132.tmp'), 'residue');
			}
			let verificationCalls = 0;
			await expect(
				runNextjsProvenanceClassification({
					fixtureId: 'next-killedbygoogle',
					outputPath: designatedOutput,
					offline: true,
					rootDir: root,
					environment: { VERSIONLESS_NETWORK_MODE: 'offline' },
					verifyT128: async () => {
						verificationCalls += 1;
						return verified();
					},
				}),
			).rejects.toThrow(
				collision === 'residue'
					? 'residue'
					: collision.includes('symlink')
						? 'symlink'
						: 'type collision',
			);
			expect(verificationCalls).toBe(0);
		}
	});

	it('rejects a symlinked root before verification', async () => {
		const root = await closureRoot();
		const container = await mkdtemp(path.join(os.tmpdir(), 'versionless-t132-root-symlink-'));
		temporary.push(container);
		const linkedRoot = path.join(container, 'workspace');
		await symlink(root, linkedRoot);
		let verificationCalls = 0;
		await expect(
			runNextjsProvenanceClassification({
				fixtureId: 'next-killedbygoogle',
				outputPath: designatedOutput,
				offline: true,
				rootDir: linkedRoot,
				environment: { VERSIONLESS_NETWORK_MODE: 'offline' },
				verifyT128: async () => {
					verificationCalls += 1;
					return verified();
				},
			}),
		).rejects.toThrow('symlink');
		expect(verificationCalls).toBe(0);
	});

	it('preserves an existing classification and removes temporary bytes on publication failure', async () => {
		const root = await closureRoot();
		const options = {
			fixtureId: 'next-killedbygoogle',
			outputPath: designatedOutput,
			offline: true,
			rootDir: root,
			environment: { VERSIONLESS_NETWORK_MODE: 'offline' },
			verifyT128: verified,
		};
		await runNextjsProvenanceClassification(options);
		const output = path.join(root, designatedOutput);
		const before = await readFile(output);
		await expect(
			runNextjsProvenanceClassification({ ...options, injectPublicationFailure: true }),
		).rejects.toThrow('Injected atomic classification publication failure');
		expect(await readFile(output)).toEqual(before);
		await expectMissing(path.join(path.dirname(output), '.t130-classification.json.t132.tmp'));
	});

	it('rejects host paths, credentials, tokens, cookies, and card data while allowing semantic unknown boundaries', () => {
		for (const value of [
			'/Users/example/closure',
			'file:///tmp/closure',
			'Authorization: bearer secret',
			'Cookie: session=secret',
			'api_key=secret',
			'card number 4111111111111111',
		])
			expect(() => rejectSensitiveMaterial({ value })).toThrow('sensitive material');
		expect(() =>
			rejectSensitiveMaterial({
				boundaries: { payment: 'unknown', authentication: 'unknown' },
			}),
		).not.toThrow();
	});
});
