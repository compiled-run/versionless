import { createHash } from 'node:crypto';
import { lstat, mkdtemp, readlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { gzipSync } from 'node:zlib';
import { join } from 'pathe';
import { afterEach, describe, expect, test } from 'vitest';
import {
	DEJAVU_CONSENT,
	analyzeDejavuNpmLock,
	analyzeDejavuTargetPnpmClosure,
	analyzeDejavuYarnV1Lock,
	assertDejavuArchiveEntries,
	assertDejavuConsent,
	assertDejavuRollbackPlan,
	assertDejavuUrl,
	bindDejavuRetainedAssets,
	decodeDejavuTarGz,
	deriveDejavuNativeArm64Lane,
	materializeDejavuArchive,
	requestDejavuWithZeroResponseRetry,
	verifyDejavuArchiveParity,
	verifyDejavuGitArchiveParity,
	verifyDejavuProductSource,
	verifyDejavuSymlinkGitBlob,
	verifyDejavuSourceAndLicense,
} from '../src/fixture/react-dejavu-production-ingest.ts';

const originalMode = process.env.VERSIONLESS_NETWORK_MODE;
const originalConsent = process.env.VERSIONLESS_CONSENT_ID;

function lockWith(count: number): {
	lockfileVersion: number;
	packages: Record<string, unknown>;
} {
	const packages: Record<string, unknown> = { '': { name: 'dejavu' } };
	for (let index = 0; index < count; index += 1)
		packages[`node_modules/dependency-${index}`] = {
			resolved: `${index === 0 ? 'http' : 'https'}://registry.npmjs.org/dependency-${index}/-/dependency-${index}-1.0.0.tgz`,
			integrity: `sha512-${Buffer.alloc(64, index).toString('base64')}`,
		};
	return { lockfileVersion: 2, packages };
}

function tarArchive(
	rows: Array<{ path: string; type?: string; bytes?: Buffer; target?: string }>,
): Buffer {
	const blocks: Buffer[] = [];
	for (const row of rows) {
		const bytes = row.bytes ?? Buffer.alloc(0);
		const header = Buffer.alloc(512);
		header.write(row.path, 0, 100, 'utf8');
		header.write('0000644\0', 100, 8, 'ascii');
		header.write('0000000\0', 108, 8, 'ascii');
		header.write('0000000\0', 116, 8, 'ascii');
		header.write(`${bytes.length.toString(8).padStart(11, '0')}\0`, 124, 12, 'ascii');
		header.write('00000000000\0', 136, 12, 'ascii');
		header.fill(32, 148, 156);
		header.write(row.type ?? '0', 156, 1, 'ascii');
		if (row.target) header.write(row.target, 157, 100, 'utf8');
		header.write('ustar\0', 257, 6, 'ascii');
		let checksum = 0;
		for (const byte of header) checksum += byte;
		header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii');
		blocks.push(header, bytes, Buffer.alloc((512 - (bytes.length % 512)) % 512));
	}
	blocks.push(Buffer.alloc(1024));
	return gzipSync(Buffer.concat(blocks));
}

function gitSha(bytes: Buffer): string {
	return createHash('sha1')
		.update(Buffer.from(`blob ${bytes.length}\0`))
		.update(bytes)
		.digest('hex');
}

afterEach(() => {
	if (originalMode === undefined) delete process.env.VERSIONLESS_NETWORK_MODE;
	else process.env.VERSIONLESS_NETWORK_MODE = originalMode;
	if (originalConsent === undefined) delete process.env.VERSIONLESS_CONSENT_ID;
	else process.env.VERSIONLESS_CONSENT_ID = originalConsent;
});

describe('Dejavu T606 transaction boundaries', () => {
	test('requires the literal fresh consent and exact command shape', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = DEJAVU_CONSENT;
		expect(() => assertDejavuConsent(['--consent-id', DEJAVU_CONSENT])).not.toThrow();
		expect(() => assertDejavuConsent(['--acquire', '--consent-id', DEJAVU_CONSENT])).toThrow(
			'exact fresh one-shot consent',
		);
		process.env.VERSIONLESS_CONSENT_ID =
			'T600-official-source-dejavu-legacy-react-qualification';
		expect(() => assertDejavuConsent(['--consent-id', DEJAVU_CONSENT])).toThrow(
			'exact fresh one-shot consent',
		);
	});

	test('allowlists only exact credential-free HTTPS endpoints', () => {
		const exact = 'https://api.github.com/repos/appbaseio/dejavu';
		const allowed = new Set([exact]);
		expect(() => assertDejavuUrl(exact, allowed)).not.toThrow();
		for (const url of [
			'http://api.github.com/repos/appbaseio/dejavu',
			'https://user@api.github.com/repos/appbaseio/dejavu',
			`${exact}?moving=true`,
			`${exact}#fragment`,
			'https://example.com/repos/appbaseio/dejavu',
		])
			expect(() => assertDejavuUrl(url, allowed)).toThrow('outside exact consent');
	});

	test('retries only three identical zero-observation failures', async () => {
		let calls = 0;
		const result = await requestDejavuWithZeroResponseRetry(
			'https://example.test/fixed',
			() => {
				calls += 1;
				return Promise.reject(Object.assign(new Error('dns'), { code: 'ENOTFOUND' }));
			},
		);
		expect(calls).toBe(3);
		expect(result.response).toBeUndefined();
		expect(result.attempts).toEqual(
			[1, 2, 3].map((attempt) => ({
				attempt,
				url: 'https://example.test/fixed',
				method: 'GET',
				acceptEncoding: 'identity',
				observedStatus: false,
				observedHeaders: false,
				observedBodyBytes: 0,
				errorCode: 'ENOTFOUND',
			})),
		);
	});

	test('never retries a response-observed failure or a successful response', async () => {
		let observedCalls = 0;
		await expect(
			requestDejavuWithZeroResponseRetry('https://example.test/fixed', () => {
				observedCalls += 1;
				return Promise.reject(Object.assign(new Error('truncated'), { observed: true }));
			}),
		).rejects.toThrow('not retryable');
		expect(observedCalls).toBe(1);
		let successCalls = 0;
		const success = await requestDejavuWithZeroResponseRetry(
			'https://example.test/fixed',
			() => {
				successCalls += 1;
				return Promise.resolve({ status: 200, headers: {}, body: Buffer.from('{}') });
			},
		);
		expect(successCalls).toBe(1);
		expect(success.response?.status).toBe(200);
	});

	test('requires safe exact archive/tree parity', () => {
		const files = Array.from({ length: 25 }, (_, index) => `root/source-${index}.ts`);
		const bytes = Buffer.from('immutable archive');
		const parity = verifyDejavuArchiveParity({
			first: bytes,
			second: Buffer.from(bytes),
			entries: files,
			expectedTreeFiles: new Set(files.map((path) => path.slice('root/'.length))),
		});
		expect(parity.files).toBe(25);
		expect(parity.archiveSha256).toHaveLength(64);
		for (const entries of [
			files.slice(0, 24),
			[...files.slice(0, 24), '../escape'],
			[...files.slice(0, 24), 'other/file.ts'],
			[...files.slice(0, 24), 'root\\escape.ts'],
		])
			expect(() => assertDejavuArchiveEntries(entries)).toThrow();
		expect(() =>
			verifyDejavuArchiveParity({
				first: bytes,
				second: Buffer.from('different'),
				entries: files,
				expectedTreeFiles: new Set(),
			}),
		).toThrow('archive replay differs');
	});

	test('parses tar headers itself and rejects links or special entries before materialization', () => {
		const safeRows = Array.from({ length: 25 }, (_, index) => ({
			path: `root/source-${index}.ts`,
			bytes: Buffer.from(`source ${index}`),
		}));
		const decoded = decodeDejavuTarGz(tarArchive(safeRows));
		expect(decoded).toHaveLength(25);
		expect(decoded[0]).toMatchObject({ path: 'root/source-0.ts', type: 'file', mode: 0o644 });
		expect(() =>
			decodeDejavuTarGz(
				tarArchive([
					...safeRows,
					{ path: 'root/hard-link', type: '1', bytes: Buffer.alloc(0) },
				]),
			),
		).toThrow('link or special');
		expect(() =>
			decodeDejavuTarGz(
				tarArchive([
					...safeRows.slice(0, 24),
					{ path: 'root/../escape', bytes: Buffer.from('x') },
				]),
			),
		).toThrow('unsafe');
	});

	test('binds mode-120000 Git blobs to safe direct tar symlinks and materializes links last', async () => {
		const regularRows = Array.from({ length: 24 }, (_, index) => ({
			path: `root/source-${index}.ts`,
			bytes: Buffer.from(`source ${index}`),
		}));
		const targetBytes = Buffer.from('source-0.ts');
		const targetSha = gitSha(targetBytes);
		const symlink = verifyDejavuSymlinkGitBlob({
			api: {
				sha: targetSha,
				size: targetBytes.length,
				encoding: 'base64',
				content: targetBytes.toString('base64'),
			},
			path: 'link.ts',
			expectedSha: targetSha,
			expectedSize: targetBytes.length,
		});
		const entries = decodeDejavuTarGz(
			tarArchive([
				...regularRows,
				{ path: 'root/link.ts', type: '2', target: 'source-0.ts', bytes: Buffer.alloc(0) },
			]),
		);
		const regular = regularRows.map((row) => ({
			path: row.path.slice('root/'.length),
			sha: gitSha(row.bytes),
			size: row.bytes.length,
			mode: '100644' as const,
		}));
		expect(
			verifyDejavuGitArchiveParity({
				entries,
				prefix: 'root',
				regular,
				symlinks: [symlink],
			}),
		).toMatchObject({ regularFiles: 24, symlinks: 1, digest: expect.any(String) });
		const directory = await mkdtemp(join(tmpdir(), 'versionless-dejavu-link-'));
		try {
			await materializeDejavuArchive(entries, 'root', directory);
			expect((await lstat(join(directory, 'link.ts'))).isSymbolicLink()).toBe(true);
			expect(await readlink(join(directory, 'link.ts'))).toBe('source-0.ts');
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	test('terminally rejects unsafe symlink targets and executable-mode conflicts', () => {
		const rows = Array.from({ length: 24 }, (_, index) => ({
			path: `root/source-${index}.ts`,
			bytes: Buffer.from(`source ${index}`),
		}));
		const regular = rows.map((row) => ({
			path: row.path.slice('root/'.length),
			sha: gitSha(row.bytes),
			size: row.bytes.length,
			mode: '100644' as '100644' | '100755',
		}));
		const parityFor = (target: string): void => {
			const targetBytes = Buffer.from(target);
			verifyDejavuGitArchiveParity({
				entries: decodeDejavuTarGz(
					tarArchive([
						...rows,
						{ path: 'root/link.ts', type: '2', target, bytes: Buffer.alloc(0) },
					]),
				),
				prefix: 'root',
				regular,
				symlinks: [
					{
						path: 'link.ts',
						sha: gitSha(targetBytes),
						size: targetBytes.length,
						target,
					},
				],
			});
		};
		for (const target of [
			'/absolute.ts',
			'../escape.ts',
			'missing.ts',
			'link.ts',
			'nested\\bad.ts',
		])
			expect(() => parityFor(target)).toThrow();
		regular[0]!.mode = '100755';
		expect(() => parityFor('source-0.ts')).toThrow('regular archive/Git parity');
		regular[0]!.mode = '100644';
		const safeEntries = decodeDejavuTarGz(
			tarArchive([
				...rows,
				{ path: 'root/link.ts', type: '2', target: 'source-0.ts', bytes: Buffer.alloc(0) },
			]),
		);
		expect(() =>
			verifyDejavuGitArchiveParity({
				entries: safeEntries,
				prefix: 'root',
				regular,
				symlinks: [
					{ path: 'link.ts', sha: '0'.repeat(40), size: 11, target: 'source-0.ts' },
				],
			}),
		).toThrow('not bound to its Git blob');
		expect(() =>
			verifyDejavuSymlinkGitBlob({
				api: { sha: gitSha(Buffer.alloc(0)), size: 0, encoding: 'base64', content: '' },
				path: 'empty',
				expectedSha: gitSha(Buffer.alloc(0)),
				expectedSize: 0,
			}),
		).toThrow('unsafe');
	});

	test('binds a complete immutable lock with narrow registry normalization', () => {
		const result = analyzeDejavuNpmLock(lockWith(20));
		expect(result.placements).toBe(20);
		expect(result.artifacts).toHaveLength(20);
		expect(result.artifacts[0]?.url.startsWith('https://registry.npmjs.org/')).toBe(true);
		expect(result.digest).toHaveLength(64);
		const conflict = lockWith(20);
		conflict.packages['node_modules/conflict'] = {
			...(conflict.packages['node_modules/dependency-0'] as object),
			integrity: `sha512-${Buffer.alloc(64, 255).toString('base64')}`,
		};
		expect(() => analyzeDejavuNpmLock(conflict)).toThrow('same-URL integrity conflict');
		const moving = lockWith(20);
		(moving.packages['node_modules/dependency-0'] as { resolved: string }).resolved +=
			'?latest=true';
		expect(() => analyzeDejavuNpmLock(moving)).toThrow('foreign or moving');
		expect(() => analyzeDejavuNpmLock(lockWith(19))).toThrow('unexpectedly small');
	});

	test('supports observed committed npm-v1 and Yarn-v1 closure shapes', () => {
		const npmV1Dependencies: Record<string, unknown> = {};
		for (let index = 0; index < 20; index += 1)
			npmV1Dependencies[`dependency-${index}`] = {
				version: '1.0.0',
				resolved: `https://registry.npmjs.org/dependency-${index}/-/dependency-${index}-1.0.0.tgz`,
				integrity: `sha512-${Buffer.alloc(64, index).toString('base64')}`,
			};
		expect(
			analyzeDejavuNpmLock({
				name: 'dejavu',
				lockfileVersion: 1,
				dependencies: npmV1Dependencies,
			}),
		).toMatchObject({ placements: 20, artifacts: expect.any(Array) });
		const yarn = [
			'# yarn lockfile v1',
			'',
			...Array.from({ length: 20 }, (_, index) =>
				[
					`dependency-${index}@^1.0.0:`,
					'  version "1.0.0"',
					`  resolved "https://registry.npmjs.org/dependency-${index}/-/dependency-${index}-1.0.0.tgz"`,
					`  integrity sha512-${Buffer.alloc(64, index).toString('base64')}`,
					'',
				].join('\n'),
			),
		].join('\n');
		expect(analyzeDejavuYarnV1Lock(yarn)).toMatchObject({
			placements: 20,
			artifacts: expect.any(Array),
		});
	});

	test('binds official source, immutable date, permissive license, manifest, and lock', () => {
		const verified = verifyDejavuSourceAndLicense({
			repository: {
				id: 123,
				full_name: 'appbaseio/dejavu',
				archived: false,
				license: { spdx_id: 'MIT' },
			},
			commit: {
				sha: 'a'.repeat(40),
				commit: { committer: { date: '2020-06-01T00:00:00Z' } },
			},
			license: Buffer.from(
				'MIT License\n\nPermission is hereby granted, free of charge, to any person',
			),
			packageJson: { scripts: { build: 'webpack' }, dependencies: { react: '16.8.0' } },
			lock: lockWith(20),
		});
		expect(verified.repositoryId).toBe(123);
		expect(verified.commit).toBe('a'.repeat(40));
		expect(verified.licenseSha256).toHaveLength(64);
		expect(verified.lockDigest).toHaveLength(64);
	});

	test('qualifies authentic product seams and binds or rejects retained assets', () => {
		const license = Buffer.from(
			'MIT License\nPermission is hereby granted, free of charge, to any person',
		);
		const entries = [
			{ path: 'root/LICENSE', type: 'file' as const, mode: 0o644, bytes: license },
			{
				path: 'root/src/app.tsx',
				type: 'file' as const,
				mode: 0o644,
				bytes: Buffer.from(
					'_search _mapping _cat/indices connect document filter sort create edit delete',
				),
			},
			{
				path: 'root/src/logo.svg',
				type: 'file' as const,
				mode: 0o644,
				bytes: Buffer.from('<svg></svg>'),
			},
		];
		const product = verifyDejavuProductSource({
			packageJson: {
				dependencies: { react: '16.8.0' },
				devDependencies: { webpack: '4.0.0' },
				scripts: { build: 'webpack --mode production' },
			},
			entries,
			prefix: 'root',
		});
		expect(product).toMatchObject({ react: '16.8.0', bundler: 'webpack' });
		expect(bindDejavuRetainedAssets(entries, 'root', license)).toHaveLength(1);
		expect(() =>
			bindDejavuRetainedAssets(
				[
					...entries,
					{
						path: 'root/vendor/generated.min.js',
						type: 'file',
						mode: 0o644,
						bytes: Buffer.from('generated'),
					},
				] as never,
				'root',
				license,
			),
		).toThrow('not independently licensed');
	});

	test('derives the oldest source-supported official native arm64 lane', () => {
		expect(deriveDejavuNativeArm64Lane(['>=10', '>=12'])).toEqual({
			version: '16.20.2',
			basis: ['>=10', '>=12'],
		});
		expect(() => deriveDejavuNativeArm64Lane(['>=10 <16'])).toThrow('no source-supported');
		expect(() => deriveDejavuNativeArm64Lane([])).toThrow('absent or ambiguous');
	});

	test('freezes a target Vite8/Node24 content-addressed pnpm closure', () => {
		const lock = [
			'lockfileVersion: 9.0',
			'',
			'packages:',
			'',
			"  '@types/node@24.12.2':",
			`    resolution: {integrity: sha512-${Buffer.alloc(64, 1).toString('base64')}}`,
			'',
			'  vite@8.0.16:',
			`    resolution: {integrity: sha512-${Buffer.alloc(64, 2).toString('base64')}}`,
			'',
			'snapshots:',
		].join('\n');
		const closure = analyzeDejavuTargetPnpmClosure(lock);
		expect(closure).toHaveLength(2);
		expect(
			closure.every((artifact) => artifact.url.startsWith('https://registry.npmjs.org/')),
		).toBe(true);
		expect(() =>
			analyzeDejavuTargetPnpmClosure(lock.replace('vite@8.0.16', 'vite@8.0.15')),
		).toThrow('omits vite@8.0.16');
	});

	test('limits rollback to newly created T606 positive roots', () => {
		expect(() =>
			assertDejavuRollbackPlan({
				created: [
					'fixtures/react-dejavu/source/package.json',
					'evidence/dependencies/react-dejavu/closure.json',
					'.versionless/work/react-dejavu/t606/source/package.json',
				],
				preexisting: new Set(),
			}),
		).not.toThrow();
		expect(() =>
			assertDejavuRollbackPlan({
				created: ['fixtures/react-dejavu/source/package.json'],
				preexisting: new Set(['fixtures/react-dejavu/source/package.json']),
			}),
		).toThrow('escape task-owned');
		expect(() =>
			assertDejavuRollbackPlan({
				created: ['packages/core/src/index.ts'],
				preexisting: new Set(),
			}),
		).toThrow('escape task-owned');
	});
});
