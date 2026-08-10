import { afterEach, describe, expect, test } from 'vitest';
import {
	EXCALIDRAW_CONSENT,
	REJECTED_EXCALIDRAW_CONSENT,
	analyzeExcalidrawYarnLock,
	assertExcalidrawArchiveEntries,
	assertExcalidrawConsent,
	assertExcalidrawUrl,
	classifyExcalidrawTagRef,
} from '../src/fixture/react-excalidraw-v011-ingest.ts';

const originalMode = process.env.VERSIONLESS_NETWORK_MODE;
const originalConsent = process.env.VERSIONLESS_CONSENT_ID;

function lock(count: number, integrity = true): Buffer {
	const rows = ['# yarn lockfile v1', ''];
	for (let index = 0; index < count; index += 1) {
		rows.push(
			`package-${index}@1.0.0:`,
			'  version "1.0.0"',
			`  resolved "https://registry.yarnpkg.com/package-${index}/-/package-${index}-1.0.0.tgz#${'a'.repeat(40)}"`,
			...(integrity
				? [`  integrity sha512-${Buffer.alloc(64, index).toString('base64')}`]
				: []),
			'',
		);
	}
	return Buffer.from(rows.join('\n'));
}

afterEach(() => {
	if (originalMode === undefined) delete process.env.VERSIONLESS_NETWORK_MODE;
	else process.env.VERSIONLESS_NETWORK_MODE = originalMode;
	if (originalConsent === undefined) delete process.env.VERSIONLESS_CONSENT_ID;
	else process.env.VERSIONLESS_CONSENT_ID = originalConsent;
});

describe('Excalidraw v0.11.0 ingest boundaries', () => {
	test('requires exact one-shot consent', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = EXCALIDRAW_CONSENT;
		expect(() =>
			assertExcalidrawConsent(['--acquire', '--consent-id', EXCALIDRAW_CONSENT]),
		).not.toThrow();
		expect(() => assertExcalidrawConsent(['--acquire', '--consent-id', 'wrong'])).toThrow();
		expect(() =>
			assertExcalidrawConsent(['--acquire', '--consent-id', REJECTED_EXCALIDRAW_CONSENT]),
		).toThrow();
	});

	test('peels exactly one official lightweight or annotated tag form', () => {
		const sha = 'a'.repeat(40);
		expect(
			classifyExcalidrawTagRef({
				ref: 'refs/tags/v0.11.0',
				object: { type: 'commit', sha },
			}),
		).toEqual({ form: 'lightweight', commitSha: sha, tagObjectSha: null });
		expect(
			classifyExcalidrawTagRef({
				ref: 'refs/tags/v0.11.0',
				object: { type: 'tag', sha },
			}),
		).toEqual({ form: 'annotated', commitSha: null, tagObjectSha: sha });
		for (const object of [{ type: 'tree', sha }, { type: 'commit', sha: 'short' }, null])
			expect(() => classifyExcalidrawTagRef({ ref: 'refs/tags/v0.11.0', object })).toThrow();
	});

	test('allows only exact credential-free HTTPS sources', () => {
		const exact = 'https://api.github.com/repos/excalidraw/excalidraw/git/ref/tags/v0.11.0';
		const allowed = new Set([exact]);
		expect(() => assertExcalidrawUrl(exact, allowed)).not.toThrow();
		for (const url of [
			'http://api.github.com/repos/excalidraw/excalidraw/git/ref/tags/v0.11.0',
			'https://user@api.github.com/repos/excalidraw/excalidraw/git/ref/tags/v0.11.0',
			`${exact}?moving=true`,
			`${exact}#fragment`,
			'https://example.com/archive.tgz',
		])
			expect(() => assertExcalidrawUrl(url, allowed)).toThrow('outside exact consent');
	});

	test('requires a bounded strong-integrity Yarn v1 registry closure', () => {
		const result = analyzeExcalidrawYarnLock(lock(100));
		expect(result.artifacts).toHaveLength(100);
		expect(result.placements).toBe(100);
		expect(() => analyzeExcalidrawYarnLock(lock(99))).toThrow('cardinality differs');
		expect(() => analyzeExcalidrawYarnLock(lock(100, false))).toThrow(
			'strong immutable fields',
		);
	});

	test('rejects unsafe and undersized archives', () => {
		const safe = Array.from({ length: 100 }, (_, index) => `root/file-${index}`);
		expect(() => assertExcalidrawArchiveEntries(safe)).not.toThrow();
		for (const entries of [
			safe.slice(0, 99),
			[...safe.slice(0, 99), '../escape'],
			[...safe.slice(0, 99), 'other/file'],
		])
			expect(() => assertExcalidrawArchiveEntries(entries)).toThrow();
	});
});
