import { mkdir, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import * as path from 'pathe';
import { describe, expect, test } from 'vitest';
import { canonicalize, receiptDigest } from '../src/receipts/canonicalize.ts';
import { renderReceipt } from '../src/receipts/render.ts';
import { parseMigrationReceipt, type MigrationReceipt } from '../src/receipts/schema.ts';
import { resolveReceiptPath, verifyReceipt, type ReceiptPathBase } from '../src/receipts/verify.ts';

interface DisposableReceipt {
	repositoryRoot: string;
	receipt: MigrationReceipt;
	absoluteReceipt: string;
	repositoryRelativeReceipt: string;
	versionlessRelativeReceipt: string;
	artifactFiles: string[];
	cleanup: () => Promise<void>;
}

async function disposableReceipt(artifactPathBase: ReceiptPathBase): Promise<DisposableReceipt> {
	const temporary = await mkdtemp(path.join(os.tmpdir(), 'versionless-receipt-paths-'));
	const repositoryRoot = path.join(temporary, 'repository');
	const versionlessRelativeReceipt = 'work/deep/receipt.json';
	const repositoryRelativeReceipt = path.join('.versionless', versionlessRelativeReceipt);
	const absoluteReceipt = resolveReceiptPath(
		versionlessRelativeReceipt,
		repositoryRoot,
		'versionless',
	);
	const receipt = JSON.parse(
		await readFile('evidence/runs/react-boilerplate-v4/t008-run.json', 'utf8'),
	) as MigrationReceipt;
	const artifactFiles: string[] = [];
	for (const [index, artifact] of receipt.artifacts.entries()) {
		const body = await readFile(artifact.path);
		const versionlessArtifact = path.join(
			'work/deep/artifacts',
			`${index}-${path.basename(artifact.path)}`,
		);
		artifact.path =
			artifactPathBase === 'repository'
				? path.join('.versionless', versionlessArtifact)
				: versionlessArtifact;
		const artifactFile = resolveReceiptPath(artifact.path, repositoryRoot, artifactPathBase);
		await mkdir(path.dirname(artifactFile), { recursive: true });
		await writeFile(artifactFile, body);
		artifactFiles.push(artifactFile);
	}
	receipt.integrity.canonicalDigest = receiptDigest(receipt);
	await mkdir(path.dirname(absoluteReceipt), { recursive: true });
	await writeFile(absoluteReceipt, `${JSON.stringify(receipt, null, 2)}\n`);
	await writeFile(path.join(path.dirname(absoluteReceipt), 'receipt.md'), renderReceipt(receipt));
	await mkdir(path.join(repositoryRoot, 'evidence/runs'), { recursive: true });
	await writeFile(
		path.join(repositoryRoot, 'evidence/runs/aggregate.json'),
		`${JSON.stringify({ fixtures: [] }, null, 2)}\n`,
	);
	return {
		repositoryRoot,
		receipt,
		absoluteReceipt,
		repositoryRelativeReceipt,
		versionlessRelativeReceipt,
		artifactFiles,
		cleanup: () => rm(temporary, { recursive: true, force: true }),
	};
}

describe('receipts', () => {
	test('resolves absolute, repository, and versionless paths from explicit pathe bases', () => {
		const repositoryRoot = path.resolve('/tmp/versionless-explicit-repository');
		const absolute = path.join(repositoryRoot, '.versionless/work/deep/receipt.json');
		expect(resolveReceiptPath(absolute, repositoryRoot, 'repository')).toBe(absolute);
		expect(resolveReceiptPath(absolute, repositoryRoot, 'versionless')).toBe(absolute);
		expect(
			resolveReceiptPath('.versionless/work/deep/receipt.json', repositoryRoot, 'repository'),
		).toBe(absolute);
		expect(resolveReceiptPath('work/deep/receipt.json', repositoryRoot, 'versionless')).toBe(
			absolute,
		);
	});

	test('verifies explicit receipt and artifact path categories independent of depth', async () => {
		for (const artifactPathBase of ['repository', 'versionless'] as const) {
			const fixture = await disposableReceipt(artifactPathBase);
			try {
				const options = {
					repositoryRoot: fixture.repositoryRoot,
					artifactPathBase,
					requireAggregate: false,
				} as const;
				await expect(
					verifyReceipt(fixture.absoluteReceipt, options),
				).resolves.toMatchObject({
					valid: true,
				});
				await expect(
					verifyReceipt(fixture.repositoryRelativeReceipt, {
						...options,
						receiptPathBase: 'repository',
					}),
				).resolves.toMatchObject({ valid: true });
				await expect(
					verifyReceipt(fixture.versionlessRelativeReceipt, {
						...options,
						receiptPathBase: 'versionless',
					}),
				).resolves.toMatchObject({ valid: true });
			} finally {
				await fixture.cleanup();
			}
		}
	});

	test('aggregate bypass preserves schema, digest, artifact, and Markdown verification', async () => {
		const fixture = await disposableReceipt('repository');
		const options = {
			repositoryRoot: fixture.repositoryRoot,
			receiptPathBase: 'repository' as const,
			artifactPathBase: 'repository' as const,
			requireAggregate: false,
		};
		const writeReceipt = async (receipt: MigrationReceipt) => {
			await writeFile(fixture.absoluteReceipt, `${JSON.stringify(receipt, null, 2)}\n`);
			await writeFile(
				path.join(path.dirname(fixture.absoluteReceipt), 'receipt.md'),
				renderReceipt(receipt),
			);
		};
		try {
			await expect(verifyReceipt(fixture.absoluteReceipt, options)).resolves.toMatchObject({
				valid: true,
			});
			await expect(
				verifyReceipt(fixture.absoluteReceipt, { ...options, requireAggregate: true }),
			).rejects.toThrow('Aggregate is not linked');

			const invalidSchema = structuredClone(fixture.receipt) as Record<string, any>;
			invalidSchema.schemaVersion = 'invalid';
			await writeFile(fixture.absoluteReceipt, JSON.stringify(invalidSchema));
			await expect(verifyReceipt(fixture.absoluteReceipt, options)).rejects.toThrow();

			const invalidDigest = structuredClone(fixture.receipt);
			invalidDigest.integrity.canonicalDigest = '0'.repeat(64);
			await writeReceipt(invalidDigest);
			await expect(verifyReceipt(fixture.absoluteReceipt, options)).rejects.toThrow(
				'Canonical digest mismatch',
			);

			const invalidArtifact = structuredClone(fixture.receipt);
			invalidArtifact.artifacts[0]!.sha256 = '0'.repeat(64);
			invalidArtifact.integrity.canonicalDigest = receiptDigest(invalidArtifact);
			await writeReceipt(invalidArtifact);
			await expect(verifyReceipt(fixture.absoluteReceipt, options)).rejects.toThrow(
				'Artifact digest mismatch',
			);

			await writeReceipt(fixture.receipt);
			await writeFile(
				path.join(path.dirname(fixture.absoluteReceipt), 'receipt.md'),
				'unlinked',
			);
			await expect(verifyReceipt(fixture.absoluteReceipt, options)).rejects.toThrow(
				'Derived Markdown is not linked',
			);

			await writeReceipt(fixture.receipt);
			await unlink(fixture.artifactFiles[0]!);
			await expect(verifyReceipt(fixture.absoluteReceipt, options)).rejects.toThrow();
		} finally {
			await fixture.cleanup();
		}
	});

	test('canonicalization ignores recursive key order', () =>
		expect(canonicalize({ b: 1, a: { d: 2, c: 3 } })).toBe(
			canonicalize({ a: { c: 3, d: 2 }, b: 1 }),
		));
	test('generated receipt verifies and tampering fails', async () => {
		const file = 'evidence/runs/react-boilerplate-v4/t008-run.json';
		let raw: string;
		try {
			raw = await readFile(file, 'utf8');
		} catch {
			return;
		}
		const receipt = JSON.parse(raw);
		expect(receiptDigest(receipt)).toBe(receipt.integrity.canonicalDigest);
		await verifyReceipt(file);
		const tampered = structuredClone(receipt);
		tampered.verification.result = 'tampered';
		await mkdir('.versionless/work/react-boilerplate-v4', { recursive: true });
		const target = '.versionless/work/react-boilerplate-v4/tampered-receipt.json';
		await writeFile(target, JSON.stringify(tampered));
		await expect(verifyReceipt(target)).rejects.toThrow();
	});
	test('AngularJS special-track receipt verifies when generated', async () => {
		const file = 'evidence/runs/angular-phonecat/t011-run.json';
		try {
			await readFile(file, 'utf8');
		} catch {
			return;
		}
		await expect(verifyReceipt(file)).resolves.toMatchObject({ valid: true });
	});
	test('accepts an exact multi-file AngularJS composition receipt shape', async () => {
		const raw = JSON.parse(
			await readFile('evidence/runs/angular-phonecat-route-resolve/t032-run.json', 'utf8'),
		);
		raw.migration.file =
			'app/app.config.js + app/phone-list/phone-list.component.js + app/phone-detail/phone-detail.component.js';
		raw.migration.changedFiles = [
			'app/app.config.js',
			'app/phone-list/phone-list.component.js',
			'app/phone-detail/phone-detail.component.js',
		];
		const parsed = parseMigrationReceipt(raw);
		expect('changedFiles' in parsed.migration && parsed.migration.changedFiles).toHaveLength(3);
	});
	test('accepts the exact React data-flow receipt shape', async () => {
		const raw = JSON.parse(
			await readFile('evidence/runs/react-boilerplate-v4-data-flow/t054-run.json', 'utf8'),
		);
		const parsed = parseMigrationReceipt(raw);
		expect(parsed.migration).toMatchObject({
			transform: 'react-data-flow-connect-to-hooks',
			edits: 6,
			changedFiles: [
				'app/containers/HomePage/index.js',
				'app/containers/RepoListItem/index.js',
			],
		});
	});
	test('refuses recomputed React-composed semantic rebinding', async () => {
		const receipt = JSON.parse(
			await readFile('evidence/runs/react-boilerplate-v4-composed/t060-run.json', 'utf8'),
		) as Record<string, any>;
		const mutations: Array<(value: Record<string, any>) => void> = [
			(value) => (value.fixture = 'react-boilerplate-v4-data-flow'),
			(value) => (value.runId = 'T062-react-boilerplate-v4-composed'),
			(value) => (value.migration.changedFiles[0] = 'app/containers/Wrong/index.js'),
			(value) =>
				(value.migration.sourceHashes['app/containers/LocaleToggle/index.js'] = '0'.repeat(
					64,
				)),
			(value) =>
				(value.migration.targetHashes['app/containers/HomePage/index.js'] =
					'9132cb8b6ab4af9c88499ae4daa6783229a8d4898266f2953d0bc99a5ff168c1'),
			(value) => delete value.migration.targetHashes['app/containers/HomePage/index.js'],
			(value) => {
				value.migration.targetHashes['app/containers/HomePage/renamed.js'] =
					value.migration.targetHashes['app/containers/HomePage/index.js'];
				delete value.migration.targetHashes['app/containers/HomePage/index.js'];
			},
			(value) => (value.migration.targetHashes.extra = '0'.repeat(64)),
			(value) => (value.migration.edits = 12),
			(value) => value.migration.executionTraces.reverse(),
			(value) => (value.migration.actualOrdersExecuted = false),
			(value) => (value.migration.publication = 'five-sequential-writes'),
			(value) => (value.migration.lateFailureRollback = 'partial-target'),
			(value) => (value.migration.failedStageCleanup = false),
			(value) => (value.migration.harnessOnlyAdapterExcluded = false),
			(value) => (value.artifacts[1].path = value.artifacts[0].path),
		];
		for (const mutate of mutations) {
			const rebound = structuredClone(receipt);
			mutate(rebound);
			rebound.integrity.canonicalDigest = receiptDigest(rebound as MigrationReceipt);
			expect(() => parseMigrationReceipt(rebound)).toThrow(
				'Receipt schema invalid React composed migration evidence',
			);
		}
	});
	test('refuses recomputed service-worker semantic rebinding', async () => {
		for (const file of [
			'evidence/runs/react-boilerplate-v4-vite8/t028-run.json',
			'evidence/runs/react-boilerplate-v4-data-flow/t054-run.json',
			'evidence/runs/react-boilerplate-v4-composed/t060-run.json',
		]) {
			const receipt = JSON.parse(await readFile(file, 'utf8')) as Record<string, any>;
			for (const mutate of [
				(value: Record<string, any>) =>
					(value.verification.serviceWorker.workerPath = 'other.js'),
				(value: Record<string, any>) =>
					(value.verification.serviceWorker.scope = '/other/'),
				(value: Record<string, any>) =>
					(value.verification.serviceWorker.controller = 'missing'),
				(value: Record<string, any>) =>
					(value.verification.serviceWorker.offlineJourney = 'fail'),
				(value: Record<string, any>) =>
					(value.verification.serviceWorker.manifestSha256 = '0'.repeat(64)),
				(value: Record<string, any>) =>
					(value.verification.serviceWorker.cacheName =
						'versionless-react-vite8-' + '0'.repeat(64)),
				(value: Record<string, any>) =>
					(value.verification.serviceWorker.currentCacheOnly = false),
				(value: Record<string, any>) =>
					(value.verification.serviceWorker.inventoryMatchesManifest = false),
				(value: Record<string, any>) =>
					(value.verification.serviceWorker.exactCurrentCacheFetch = false),
				...(file.includes('data-flow')
					? [
							(value: Record<string, any>) =>
								value.verification.serviceWorker.upgradeOrders.reverse(),
						]
					: []),
			]) {
				const rebound = structuredClone(receipt);
				mutate(rebound);
				rebound.integrity.canonicalDigest = receiptDigest(rebound as MigrationReceipt);
				expect(() => parseMigrationReceipt(rebound)).toThrow(
					'Receipt schema invalid service-worker evidence',
				);
			}
		}
	});
	test('refuses recomputed Angular PhoneCat Vite semantic rebinding', async () => {
		const receipt = JSON.parse(
			await readFile('evidence/runs/angular-phonecat-vite8/t069-run.json', 'utf8'),
		) as Record<string, any>;
		for (const mutate of [
			(value: Record<string, any>) => value.migration.orders.reverse(),
			(value: Record<string, any>) => (value.migration.actualOrdersExecuted = false),
			(value: Record<string, any>) => (value.migration.atomic = false),
			(value: Record<string, any>) => (value.migration.publication = 'sequential-writes'),
			(value: Record<string, any>) => (value.migration.viteOutput = 'partial'),
			(value: Record<string, any>) => (value.migration.serviceWorker = 'emitted'),
			(value: Record<string, any>) =>
				(value.artifacts[3].path =
					'evidence/runs/angular-phonecat-vite8/artifacts/runtime-inventory.json'),
			(value: Record<string, any>) => (value.artifacts[1].path = value.artifacts[0].path),
		]) {
			const rebound = structuredClone(receipt);
			mutate(rebound);
			rebound.integrity.canonicalDigest = receiptDigest(rebound as MigrationReceipt);
			expect(() => parseMigrationReceipt(rebound)).toThrow();
		}
	});
});
