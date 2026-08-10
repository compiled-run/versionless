import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	acquisitionAttempt,
	analyzeLegacyLockClosure,
	archiveEndpoint,
	archiveMatchesGitTree,
	assertAllowedAcquisitionUrl,
	assertLegacyAcquisitionConsent,
	blobEndpoint,
	cacheRootFor,
	candidateAllowlist,
	collectLockPlacements,
	composeLegacyBaseline,
	documentBytes,
	evidenceRootFor,
	gitBlobId,
	ingestLegacyCandidate,
	isLegacyCandidateId,
	legacyCandidateConfig,
	legacyCandidates,
	normalizedManifest,
	reconcileArchiveWithTree,
	recordLegacyStep,
	regularBlobIndex,
	runLegacyBaselineSteps,
	summarizeTree,
	treeEndpoint,
	workRootFor,
	type LegacyStepOutcome,
	type TreeRow,
} from '../src/fixture/legacy-candidate-ingest.ts';
import type { FixtureId } from '../src/fixture/tier-f-ingest.ts';

const root = resolve(import.meta.dirname, '../../..');
const papercups = legacyCandidateConfig('react-papercups-v1-0-0');
// The tier-f fixture identity union must name this candidate; this binding is the compile-time gate.
const tierFIdentity: FixtureId = 'react-papercups-v1-0-0';

const bytes = (text: string): Uint8Array => new Uint8Array(Buffer.from(text, 'utf8'));
const blobRow = (path: string, sha: string): TreeRow => ({
	path,
	mode: '100644',
	type: 'blob',
	sha,
});
const outcome = (exitCode: number | null): LegacyStepOutcome => ({
	exitCode,
	signal: null,
	stdout: 'out',
	stderr: 'err',
});

describe('legacy candidate configuration', () => {
	it('names the papercups candidate on every identity surface', () => {
		expect(tierFIdentity).toBe('react-papercups-v1-0-0');
		expect(legacyCandidates.map((candidate) => candidate.id)).toContain(
			'react-papercups-v1-0-0',
		);
		expect(isLegacyCandidateId('react-papercups-v1-0-0')).toBe(true);
		expect(isLegacyCandidateId('react-boilerplate-v4')).toBe(false);
		expect(() => legacyCandidateConfig('react-focalboard')).toThrow(
			'Unknown legacy corpus candidate',
		);
		expect(evidenceRootFor(papercups)).toBe('evidence/ingests/react-papercups-v1-0-0');
		expect(cacheRootFor(papercups)).toBe('.versionless/cache/react-papercups-v1-0-0-source');
		expect(workRootFor(papercups)).toBe('.versionless/work/react-papercups-v1-0-0/legacy');
	});

	it('derives every consented endpoint from the candidate configuration', () => {
		expect(candidateAllowlist(papercups)).toEqual([
			'https://api.github.com/repos/papercups-io/papercups',
			'https://api.github.com/repos/papercups-io/papercups/git/ref/tags/v1.0.0',
			'https://api.github.com/repos/papercups-io/papercups/git/commits/<validated-commit-sha>',
			'https://api.github.com/repos/papercups-io/papercups/git/trees/<validated-tree-sha>?recursive=1',
			'https://codeload.github.com/papercups-io/papercups/tar.gz/<validated-commit-sha>',
		]);
		expect(treeEndpoint(papercups, 'abc')).toBe(
			'https://api.github.com/repos/papercups-io/papercups/git/trees/abc?recursive=1',
		);
		expect(blobEndpoint(papercups, 'abc')).toBe(
			'https://api.github.com/repos/papercups-io/papercups/git/blobs/abc',
		);
		expect(archiveEndpoint(papercups, 'abc')).toBe(
			'https://codeload.github.com/papercups-io/papercups/tar.gz/abc',
		);
	});

	it('accepts only credential-free HTTPS URLs inside the candidate repository', () => {
		for (const url of [
			'https://api.github.com/repos/papercups-io/papercups',
			'https://api.github.com/repos/papercups-io/papercups/git/blobs/abc',
			'https://codeload.github.com/papercups-io/papercups/tar.gz/abc',
		])
			expect(() => assertAllowedAcquisitionUrl(url, papercups)).not.toThrow();
		for (const url of [
			'http://api.github.com/repos/papercups-io/papercups',
			'https://user@api.github.com/repos/papercups-io/papercups',
			'https://example.com/repos/papercups-io/papercups',
			'https://api.github.com/repos/papercups-io/other',
			'https://codeload.github.com/other/papercups/tar.gz/abc',
			'https://api.github.com/repos/papercups-io/papercups#fragment',
		])
			expect(() => assertAllowedAcquisitionUrl(url, papercups)).toThrow(
				'outside literal consent',
			);
	});

	it('recomputes the published acquisition attempt from configuration alone', async () => {
		const published = await readFile(
			join(root, evidenceRootFor(papercups), 'attempt.json'),
			'utf8',
		);
		expect(documentBytes(acquisitionAttempt(papercups))).toBe(published);
	});
});

describe('archive reconciliation', () => {
	it('hashes bytes as git blob objects', () => {
		expect(gitBlobId(bytes('hello\n'))).toBe('ce013625030ba8dba906f756967f9e9ca394464a');
	});

	it('normalizes the extracted manifest independently of walk order', () => {
		const files = [
			{ path: 'b.txt', bytes: bytes('b') },
			{ path: 'a.txt', bytes: bytes('a') },
		];
		const manifest = normalizedManifest(files);
		expect(manifest.text.split('\n')[0]?.startsWith('a.txt ')).toBe(true);
		expect(normalizedManifest([...files].reverse()).sha256).toBe(manifest.sha256);
	});

	it('summarizes tree rows and indexes only regular blobs', () => {
		const rows: TreeRow[] = [
			blobRow('a.txt', gitBlobId(bytes('a'))),
			{ path: 'link', mode: '120000', type: 'blob', sha: 'ffff' },
			{ path: 'src', mode: '040000', type: 'tree', sha: 'eeee' },
			{ path: 'sub', mode: '160000', type: 'commit', sha: 'dddd' },
		];
		expect(summarizeTree(rows)).toEqual({
			treeEntries: 4,
			treeBlobs: 2,
			treeDirectories: 1,
			treeSymlinks: 1,
			treeGitlinks: 1,
		});
		expect([...regularBlobIndex(rows).keys()]).toEqual(['a.txt']);
	});

	it('closes the blob manifest only when every extracted file matches its git object', () => {
		const rows = [
			blobRow('a.txt', gitBlobId(bytes('a'))),
			blobRow('b.txt', gitBlobId(bytes('b'))),
		];
		const parity = reconcileArchiveWithTree({
			singleRoot: 'candidate-abc',
			rows,
			files: [
				{ path: 'a.txt', bytes: bytes('a') },
				{ path: 'b.txt', bytes: bytes('b') },
			],
			directories: 1,
			specialEntries: 0,
		});
		expect(parity).toMatchObject({
			safeEntries: 3,
			regularFiles: 2,
			gitBlobs: 2,
			missingFiles: 0,
			extraFiles: 0,
			mismatchedBlobs: 0,
		});
		expect(archiveMatchesGitTree(parity)).toBe(true);
		const tampered = reconcileArchiveWithTree({
			singleRoot: 'candidate-abc',
			rows,
			files: [
				{ path: 'a.txt', bytes: bytes('tampered') },
				{ path: 'extra.txt', bytes: bytes('extra') },
			],
			directories: 1,
			specialEntries: 0,
		});
		expect(tampered).toMatchObject({ mismatchedBlobs: 1, extraFiles: 1, missingFiles: 1 });
		expect(archiveMatchesGitTree(tampered)).toBe(false);
	});
});

describe('dependency closure', () => {
	const lock = {
		lockfileVersion: 1,
		requires: true,
		dependencies: {
			react: {
				version: '16.13.1',
				resolved: 'https://registry.npmjs.org/react/-/react-16.13.1.tgz',
				integrity: 'sha1-AAA',
				dependencies: {
					'object-assign': {
						version: '4.1.1',
						resolved:
							'https://registry.npmjs.org/object-assign/-/object-assign-4.1.1.tgz',
						integrity: 'sha512-BBB',
					},
				},
			},
			typescript: { version: '3.7.5', dev: true },
			fsevents: {
				version: '1.2.12',
				resolved: 'https://registry.npmjs.org/fsevents/-/fsevents-1.2.12.tgz',
				integrity: 'sha512-CCC',
				optional: true,
				dependencies: { abbrev: { version: '1.1.1', bundled: true } },
			},
		},
	};

	it('walks every nested placement without re-resolving', () => {
		expect(collectLockPlacements(lock).map((placement) => placement.path)).toEqual([
			'react',
			'react/object-assign',
			'typescript',
			'fsevents',
			'fsevents/abbrev',
		]);
		expect(() => collectLockPlacements({ dependencies: { bad: 7 } })).toThrow(
			'Legacy lock node differs',
		);
	});

	it('records the lock state as found, including missing resolution', () => {
		const closure = analyzeLegacyLockClosure(papercups, {
			verifiedSourceRoot: `${cacheRootFor(papercups)}/verify/extracted/papercups-abc`,
			packageBytes: bytes(
				JSON.stringify({
					dependencies: { react: '^16.13.1' },
					devDependencies: { typescript: '~3.7.2' },
				}),
			),
			lockBytes: bytes(JSON.stringify(lock)),
		});
		expect(closure.slug).toBe('react-papercups-v1-0-0');
		expect(closure.frontendRoot).toBe('assets');
		expect(closure.counts).toMatchObject({
			declaredDependencies: 1,
			declaredDevDependencies: 1,
			lockedPlacements: 5,
			distinctNameVersionPairs: 5,
			devPlacements: 1,
			optionalPlacements: 1,
			bundledPlacements: 1,
		});
		expect(closure.registryHosts).toEqual({ 'registry.npmjs.org': 3 });
		expect(closure.lockState.lockfileVersion).toBe(1);
		expect(closure.lockState.requiresField).toBe(true);
		expect(closure.lockState.everyEntryHasResolvedUrl).toBe(false);
		expect(closure.lockState.entriesWithoutResolvedUrl).toEqual(['typescript']);
		expect(closure.lockState.lockfileIntegrityAlgorithms).toEqual(['none', 'sha1', 'sha512']);
		expect(closure.closureSha256).toHaveLength(64);
	});
});

describe('legacy baseline attempt', () => {
	it('records a failing install without attempting a build', () => {
		const steps = runLegacyBaselineSteps(papercups, () => outcome(1), {
			now: () => new Date('2026-08-10T18:00:00.000Z'),
			elapsedMs: () => 0,
		});
		expect(steps).toHaveLength(1);
		expect(steps[0]).toMatchObject({
			name: 'install',
			command: 'npm ci --ignore-scripts --no-audit --no-fund',
			outcome: 'failed',
		});
		const record = composeLegacyBaseline({
			config: papercups,
			cell: {
				node: 'v16.20.2',
				npm: '8.19.4',
				platform: 'darwin-arm64',
				lifecycleScripts: 'disabled for install (--ignore-scripts)',
				network: 'offline',
			},
			steps,
			artifacts: null,
		});
		expect(record).toMatchObject({
			schemaVersion: 'versionless.legacy-baseline-attempt.v1',
			slug: 'react-papercups-v1-0-0',
			workRoot: '.versionless/work/react-papercups-v1-0-0/legacy',
			outcome: 'failed',
			artifacts: null,
		});
	});

	it('builds only after a successful install and digests both streams', () => {
		const steps = runLegacyBaselineSteps(papercups, () => outcome(0), {
			now: () => new Date('2026-08-10T18:00:00.000Z'),
			elapsedMs: () => 0,
		});
		expect(steps.map((step) => step.name)).toEqual(['install', 'build']);
		expect(steps[1]?.command).toBe('npm run build');
		const step = recordLegacyStep({
			name: 'install',
			args: ['ci'],
			startedAt: '2026-08-10T18:00:00.000Z',
			durationMs: 12,
			outcome: { exitCode: 0, signal: null, stdout: 'a\nb', stderr: '' },
		});
		expect(step.stdoutBytes).toBe(3);
		expect(step.stdoutTail).toBe('a\nb');
		expect(step.stdoutSha256).toHaveLength(64);
		expect(step.outcome).toBe('succeeded');
	});
});

describe('legacy candidate ingest consent', () => {
	it('refuses acquisition without exact purpose-bound consent', async () => {
		expect(() =>
			assertLegacyAcquisitionConsent(papercups, { allowNetwork: true, consentId: 'other' }),
		).toThrow('requires explicit consent VL-LEGACY-CORPUS-2026-08-10');
		await expect(
			ingestLegacyCandidate({
				fixture: 'react-papercups-v1-0-0',
				allowNetwork: false,
				consentId: papercups.consentId,
			}),
		).rejects.toThrow('requires explicit consent');
	});

	it('is a named fixture:ingest candidate that still refuses to reach the network', () => {
		const result = spawnSync(
			process.execPath,
			[
				'--experimental-strip-types',
				'packages/cli/src/cli.ts',
				'fixture:ingest',
				'--fixture',
				'react-papercups-v1-0-0',
			],
			{
				cwd: root,
				encoding: 'utf8',
				env: { ...process.env, VERSIONLESS_NETWORK_MODE: 'offline' },
			},
		);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('requires explicit consent VL-LEGACY-CORPUS-2026-08-10');
		expect(result.stderr).not.toContain('Unsupported fixture');
	});

	it('still refuses an unknown fixture id', () => {
		const result = spawnSync(
			process.execPath,
			[
				'--experimental-strip-types',
				'packages/cli/src/cli.ts',
				'fixture:ingest',
				'--fixture',
				'react-focalboard',
			],
			{
				cwd: root,
				encoding: 'utf8',
				env: { ...process.env, VERSIONLESS_NETWORK_MODE: 'offline' },
			},
		);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('Unsupported fixture');
	});
});
