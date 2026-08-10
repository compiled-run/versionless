import { createHash } from 'node:crypto';
import { afterEach, describe, expect, test } from 'vitest';
import {
	REJECTED_TAKENOTE_CONSENT,
	TAKENOTE_CONSENT,
	analyzeTakeNoteLock,
	assertTakeNoteArchiveEntries,
	assertTakeNoteConsent,
	assertTakeNoteUrl,
	verifyTakeNoteGitBlob,
} from '../src/fixture/react-takenote-ingest.ts';

const originalNetworkMode = process.env.VERSIONLESS_NETWORK_MODE;
const originalConsentId = process.env.VERSIONLESS_CONSENT_ID;

function lockWith(count: number): { lockfileVersion: number; packages: Record<string, unknown> } {
	const packages: Record<string, unknown> = { '': { name: 'takenote' } };
	for (let index = 0; index < count; index += 1) {
		packages[`node_modules/package-${index}`] = {
			version: '1.0.0',
			resolved: `https://registry.npmjs.org/package-${index}/-/package-${index}-1.0.0.tgz`,
			integrity: `sha512-${Buffer.alloc(64, index).toString('base64')}`,
		};
	}
	return { lockfileVersion: 2, packages };
}

afterEach(() => {
	if (originalNetworkMode === undefined) delete process.env.VERSIONLESS_NETWORK_MODE;
	else process.env.VERSIONLESS_NETWORK_MODE = originalNetworkMode;
	if (originalConsentId === undefined) delete process.env.VERSIONLESS_CONSENT_ID;
	else process.env.VERSIONLESS_CONSENT_ID = originalConsentId;
});

describe('TakeNote transactional ingest boundaries', () => {
	test('requires exact consent in both arguments and environment', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = TAKENOTE_CONSENT;
		expect(() =>
			assertTakeNoteConsent(['--acquire', '--consent-id', TAKENOTE_CONSENT]),
		).not.toThrow();
		expect(() => assertTakeNoteConsent(['--acquire', '--consent-id', 'stale'])).toThrow(
			'exact one-shot consent',
		);
		expect(() =>
			assertTakeNoteConsent(['--acquire', '--consent-id', REJECTED_TAKENOTE_CONSENT]),
		).toThrow('exact one-shot consent');
		process.env.VERSIONLESS_NETWORK_MODE = 'offline';
		expect(() =>
			assertTakeNoteConsent(['--acquire', '--consent-id', TAKENOTE_CONSENT]),
		).toThrow('exact one-shot consent');
	});

	test('reconstructs and verifies the tree-derived Git blob identity', () => {
		const bytes = Buffer.from('{"name":"takenote"}\n');
		const gitSha = createHash('sha1')
			.update(Buffer.from(`blob ${bytes.length}\0`))
			.update(bytes)
			.digest('hex');
		expect(
			verifyTakeNoteGitBlob({
				api: {
					sha: gitSha,
					size: bytes.length,
					encoding: 'base64',
					content: bytes.toString('base64'),
				},
				expectedSha: gitSha,
				expectedSize: bytes.length,
			}),
		).toEqual(bytes);
		expect(() =>
			verifyTakeNoteGitBlob({
				api: {
					sha: gitSha,
					size: bytes.length,
					encoding: 'base64',
					content: 'dGFtcGVyZWQ=',
				},
				expectedSha: gitSha,
				expectedSize: bytes.length,
			}),
		).toThrow('reconstructed package blob identity differs');
	});

	test('accepts only exact allowlisted credential-free HTTPS URLs', () => {
		const exact = 'https://registry.npmjs.org/example/-/example-1.0.0.tgz';
		const allowed = new Set([exact]);
		expect(() => assertTakeNoteUrl(exact, allowed)).not.toThrow();
		for (const url of [
			'http://registry.npmjs.org/example/-/example-1.0.0.tgz',
			'https://user@registry.npmjs.org/example/-/example-1.0.0.tgz',
			`${exact}?moving=true`,
			`${exact}#fragment`,
			'https://example.com/example-1.0.0.tgz',
		])
			expect(() => assertTakeNoteUrl(url, allowed)).toThrow('outside exact consent');
	});

	test('accepts a bounded npm-v2 closure and collapses identical artifacts', () => {
		const lock = lockWith(100);
		lock.packages['node_modules/duplicate'] = {
			...(lock.packages['node_modules/package-0'] as object),
		};
		const result = analyzeTakeNoteLock(lock);
		expect(result.placements).toBe(101);
		expect(result.artifacts).toHaveLength(100);
		expect(result.artifacts[0]?.placements).toHaveLength(2);
		expect(result.digest).toHaveLength(64);
	});

	test('rejects weak, foreign, moving, conflicting, and undersized closures', () => {
		const cases = [
			{ ...lockWith(100), lockfileVersion: 1 },
			lockWith(99),
			lockWith(100),
			lockWith(100),
			lockWith(100),
		];
		(cases[2]!.packages['node_modules/package-0'] as { integrity: string }).integrity =
			'sha1-weak';
		(cases[3]!.packages['node_modules/package-0'] as { resolved: string }).resolved =
			'https://example.com/package.tgz';
		(cases[4]!.packages['node_modules/package-0'] as { resolved: string }).resolved +=
			'?moving=true';
		for (const value of cases) expect(() => analyzeTakeNoteLock(value)).toThrow();
		const conflict = lockWith(100);
		conflict.packages['node_modules/conflict'] = {
			...(conflict.packages['node_modules/package-0'] as object),
			integrity: `sha512-${Buffer.alloc(64, 255).toString('base64')}`,
		};
		expect(() => analyzeTakeNoteLock(conflict)).toThrow('same-URL integrity conflict');
	});

	test('rejects archive traversal, multiple roots, separators, and small archives', () => {
		const safe = Array.from({ length: 50 }, (_, index) => `root/file-${index}.txt`);
		expect(() => assertTakeNoteArchiveEntries(safe)).not.toThrow();
		for (const entries of [
			safe.slice(0, 49),
			[...safe.slice(0, 49), '../escape'],
			[...safe.slice(0, 49), 'other/file.txt'],
			[...safe.slice(0, 49), 'root\\escape.txt'],
		])
			expect(() => assertTakeNoteArchiveEntries(entries)).toThrow();
	});
});
