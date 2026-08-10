import { createHash } from 'node:crypto';
import { access, lstat, mkdtemp, readlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, test } from 'vitest';
import { join } from 'pathe';
import {
	REACT_ACTUAL_BUDGET_CONSENT,
	analyzeActualBudgetYarnLock,
	assertActualBudgetArchiveEntries,
	assertActualBudgetTarballUrl,
	assertActualBudgetTreeRows,
	assertActualBudgetUrl,
	actualBudgetSourceManifestFromFilesystem,
	collectActualBudgetIdentityStream,
	inspectActualBudgetSourceArchive,
	materializeActualBudgetSource,
	parseActualBudgetSymlinkBlob,
	parseActualBudgetLauncher,
	validateActualBudgetSymlinkRows,
	type GitTreeRow,
} from '../src/fixture/react-actual-budget-v22-12-9-ingest.ts';

const originalMode = process.env.VERSIONLESS_NETWORK_MODE;
const originalConsent = process.env.VERSIONLESS_CONSENT_ID;
const originalOffline = process.env.NPM_CONFIG_OFFLINE;
const temporaryRoots: string[] = [];

function gitBlobSha(bytes: Uint8Array): string {
	return createHash('sha1')
		.update(Buffer.from(`blob ${bytes.length}\0`))
		.update(bytes)
		.digest('hex');
}

function writeTarField(header: Buffer, offset: number, length: number, value: string): void {
	header.write(value, offset, Math.min(length, Buffer.byteLength(value)), 'utf8');
}

function writeTarOctal(header: Buffer, offset: number, length: number, value: number): void {
	const encoded = value.toString(8).padStart(length - 1, '0');
	writeTarField(header, offset, length, `${encoded}\0`);
}

function tarEntry(input: {
	name: string;
	type: '0' | '1' | '2' | '5' | 'x';
	data?: Buffer;
	target?: string;
	mode?: number;
}): Buffer {
	const data = input.data ?? Buffer.alloc(0);
	const header = Buffer.alloc(512);
	writeTarField(header, 0, 100, input.name);
	writeTarOctal(header, 100, 8, input.mode ?? 0o644);
	writeTarOctal(header, 108, 8, 0);
	writeTarOctal(header, 116, 8, 0);
	writeTarOctal(header, 124, 12, data.length);
	writeTarOctal(header, 136, 12, 0);
	header.fill(32, 148, 156);
	writeTarField(header, 156, 1, input.type);
	if (input.target) writeTarField(header, 157, 100, input.target);
	writeTarField(header, 257, 6, 'ustar\0');
	writeTarField(header, 263, 2, '00');
	let checksum = 0;
	for (const byte of header) checksum += byte;
	writeTarField(header, 148, 8, `${checksum.toString(8).padStart(6, '0')}\0 `);
	const padding = Buffer.alloc(Math.ceil(data.length / 512) * 512 - data.length);
	return Buffer.concat([header, data, padding]);
}

function sourceArchive(input: { linkTarget?: string; linkType?: '1' | '2' | 'x' } = {}): {
	archive: Buffer;
	rows: GitTreeRow[];
	linkBytes: Map<string, Buffer>;
} {
	const fileBytes = Buffer.from('export const value = 1;\n');
	const linkBytes = Buffer.from(input.linkTarget ?? 'file.ts');
	const rows: GitTreeRow[] = [
		{ path: 'source', mode: '040000', type: 'tree', sha: '1'.repeat(40) },
		{
			path: 'source/file.ts',
			mode: '100644',
			type: 'blob',
			sha: gitBlobSha(fileBytes),
			size: fileBytes.length,
		},
		{
			path: 'source/link.ts',
			mode: '120000',
			type: 'blob',
			sha: gitBlobSha(linkBytes),
			size: linkBytes.length,
		},
	];
	return {
		archive: gzipSync(
			Buffer.concat([
				tarEntry({ name: 'actual-source/', type: '5', mode: 0o755 }),
				tarEntry({ name: 'actual-source/source/', type: '5', mode: 0o755 }),
				tarEntry({ name: 'actual-source/source/file.ts', type: '0', data: fileBytes }),
				tarEntry({
					name: 'actual-source/source/link.ts',
					type: input.linkType ?? '2',
					target: linkBytes.toString('utf8'),
					mode: 0o777,
				}),
				Buffer.alloc(1_024),
			]),
		),
		rows,
		linkBytes: new Map([[gitBlobSha(linkBytes), linkBytes]]),
	};
}

afterEach(async () => {
	if (originalMode === undefined) delete process.env.VERSIONLESS_NETWORK_MODE;
	else process.env.VERSIONLESS_NETWORK_MODE = originalMode;
	if (originalConsent === undefined) delete process.env.VERSIONLESS_CONSENT_ID;
	else process.env.VERSIONLESS_CONSENT_ID = originalConsent;
	if (originalOffline === undefined) delete process.env.NPM_CONFIG_OFFLINE;
	else process.env.NPM_CONFIG_OFFLINE = originalOffline;
	for (const root of temporaryRoots.splice(0)) await rm(root, { recursive: true, force: true });
});

describe('Actual Budget v22.12.9 transactional ingest', () => {
	test('uses one exact production launcher graph and keeps smoke offline', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'offline';
		process.env.NPM_CONFIG_OFFLINE = 'true';
		delete process.env.VERSIONLESS_CONSENT_ID;
		expect(
			parseActualBudgetLauncher([
				'--launcher-smoke',
				'--consent-id',
				REACT_ACTUAL_BUDGET_CONSENT,
			]),
		).toBe('launcher-smoke');
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = REACT_ACTUAL_BUDGET_CONSENT;
		expect(
			parseActualBudgetLauncher(['--acquire', '--consent-id', REACT_ACTUAL_BUDGET_CONSENT]),
		).toBe('acquire');
		process.env.VERSIONLESS_NETWORK_MODE = 'offline';
		expect(() =>
			parseActualBudgetLauncher(['--acquire', '--consent-id', REACT_ACTUAL_BUDGET_CONSENT]),
		).toThrow('one-shot consent');
	});

	test('parses a bounded Yarn schema-6 npm identity set deterministically', () => {
		const stanzas = Array.from({ length: 200 }, (_, index) => {
			const name = index === 0 ? '@actual-app/example' : `actual-example-${index}`;
			return `"${name}@npm:^1.0.${index}":\n  version: 1.0.${index}\n  resolution: "${name}@npm:1.0.${index}"\n  checksum: synthetic-${index}\n  languageName: node\n  linkType: hard\n`;
		});
		const bytes = Buffer.from(
			`__metadata:\n  version: 6\n  cacheKey: 8\n\n${stanzas.join('\n')}`,
		);
		const first = analyzeActualBudgetYarnLock(bytes);
		const second = analyzeActualBudgetYarnLock(bytes);
		expect(first).toEqual(second);
		expect(first.artifacts).toHaveLength(200);
		expect(first.selectors).toBe(200);
		expect(first.artifacts[0]?.name).toBe('@actual-app/example');
		expect(first.digest).toHaveLength(64);
	});

	test('allows only exact credential-free official immutable URLs', () => {
		const exact =
			'https://api.github.com/repos/actualbudget/actual/git/commits/3edf94714540837c67e6ac521efef3eed5e15bc6';
		const allowed = new Set([exact]);
		expect(() => assertActualBudgetUrl(exact, allowed)).not.toThrow();
		for (const changed of [
			exact.replace('https:', 'http:'),
			exact.replace('https://', 'https://user@'),
			`${exact}?moving=true`,
			'https://example.com/source',
		])
			expect(() => assertActualBudgetUrl(changed, allowed)).toThrow('outside exact consent');
		expect(() =>
			assertActualBudgetTarballUrl(
				'https://registry.npmjs.org/@babel/core/-/core-7.20.5.tgz',
				{ name: '@babel/core', version: '7.20.5' },
			),
		).not.toThrow();
		expect(() =>
			assertActualBudgetTarballUrl(
				'https://registry.npmjs.org/@babel/core/-/core-7.20.6.tgz',
				{ name: '@babel/core', version: '7.20.5' },
			),
		).toThrow('tarball URL differs');
	});

	test('rejects unsafe source archives and unsupported Git rows', () => {
		const entries = Array.from(
			{ length: 3_000 },
			(_, index) => `actual-source/file-${index}.ts`,
		);
		expect(() => assertActualBudgetArchiveEntries(entries)).not.toThrow();
		expect(() =>
			assertActualBudgetArchiveEntries([...entries.slice(0, -1), '../escape']),
		).toThrow('unsafe');
		const rows = Array.from({ length: 3_203 }, (_, index) => ({
			path: `source/file-${index}.ts`,
			mode: '100644',
			type: 'blob',
			sha: index.toString(16).padStart(40, '0'),
			size: index,
		}));
		expect(() => assertActualBudgetTreeRows(rows)).not.toThrow();
		const target = Buffer.from('source/file-1.ts');
		expect(() =>
			assertActualBudgetTreeRows([
				{
					...rows[0]!,
					mode: '120000',
					sha: gitBlobSha(target),
					size: target.length,
				},
				...rows.slice(1),
			]),
		).not.toThrow();
		expect(() =>
			assertActualBudgetTreeRows([
				{ ...rows[0]!, type: 'commit', mode: '160000', size: undefined },
				...rows.slice(1),
			]),
		).toThrow('submodule or special');
	});

	test('binds Git symlink blobs and validates only in-root acyclic regular-file targets', () => {
		const safe = sourceArchive();
		const links = validateActualBudgetSymlinkRows(safe.rows, safe.linkBytes);
		expect(links).toMatchObject([
			{ path: 'source/link.ts', target: 'file.ts', resolvedPath: 'source/file.ts' },
		]);
		for (const target of ['/outside', '../../outside', 'missing.ts', 'source']) {
			const candidate = sourceArchive({ linkTarget: target });
			expect(() =>
				validateActualBudgetSymlinkRows(candidate.rows, candidate.linkBytes),
			).toThrow();
		}
		const cycleTarget = Buffer.from('link.ts');
		const cycleRows = sourceArchive().rows.map((row) =>
			row.path === 'source/link.ts'
				? { ...row, sha: gitBlobSha(cycleTarget), size: cycleTarget.length }
				: row,
		);
		expect(() =>
			validateActualBudgetSymlinkRows(
				cycleRows,
				new Map([[gitBlobSha(cycleTarget), cycleTarget]]),
			),
		).toThrow('cyclic');
	});

	test('requires exact base64 Git blob identity for symlink targets', () => {
		const candidate = sourceArchive();
		const row = candidate.rows[2]!;
		const url = `https://api.github.com/repos/actualbudget/actual/git/blobs/${row.sha}`;
		const bytes = candidate.linkBytes.get(row.sha)!;
		expect(
			parseActualBudgetSymlinkBlob(
				{
					sha: row.sha,
					size: row.size,
					url,
					encoding: 'base64',
					content: bytes.toString('base64'),
				},
				row,
				url,
			),
		).toEqual(bytes);
		expect(() =>
			parseActualBudgetSymlinkBlob(
				{ sha: row.sha, size: row.size, url, encoding: 'base64', content: 'd3Jvbmc=' },
				row,
				url,
			),
		).toThrow('base64 identity differs');
	});

	test('validates archive headers and identities before materialization', () => {
		const candidate = sourceArchive();
		const links = validateActualBudgetSymlinkRows(candidate.rows, candidate.linkBytes);
		const entries = inspectActualBudgetSourceArchive(candidate.archive, candidate.rows, links);
		expect(entries.map((entry) => [entry.path, entry.kind])).toEqual([
			['source', 'directory'],
			['source/file.ts', 'file'],
			['source/link.ts', 'symlink'],
		]);
		for (const linkType of ['1', 'x'] as const) {
			const changed = sourceArchive({ linkType });
			const changedLinks = validateActualBudgetSymlinkRows(changed.rows, changed.linkBytes);
			expect(() =>
				inspectActualBudgetSourceArchive(changed.archive, changed.rows, changedLinks),
			).toThrow('entry type is forbidden');
		}
		expect(() =>
			inspectActualBudgetSourceArchive(candidate.archive, candidate.rows, links, 100),
		).toThrow('expansion cap');
	});

	test('materializes links last and replays them with lstat/readlink without outside-root access', async () => {
		const temporary = await mkdtemp(join(tmpdir(), 'versionless-t584-source-'));
		temporaryRoots.push(temporary);
		const candidate = sourceArchive();
		const links = validateActualBudgetSymlinkRows(candidate.rows, candidate.linkBytes);
		const entries = inspectActualBudgetSourceArchive(candidate.archive, candidate.rows, links);
		const source = join(temporary, 'source');
		await materializeActualBudgetSource(source, entries);
		expect((await lstat(join(source, 'source/link.ts'))).isSymbolicLink()).toBe(true);
		expect(await readlink(join(source, 'source/link.ts'))).toBe('file.ts');
		const manifest = await actualBudgetSourceManifestFromFilesystem(source, candidate.rows);
		expect(manifest.map((row) => [row.path, row.kind])).toEqual([
			['source/file.ts', 'file'],
			['source/link.ts', 'symlink'],
		]);
		await expect(access(join(temporary, 'outside-marker'))).rejects.toThrow();
		await expect(
			materializeActualBudgetSource(join(temporary, 'malicious'), [
				{
					path: '../outside-marker',
					kind: 'file',
					mode: '100644',
					data: Buffer.from('x'),
					target: null,
				},
			]),
		).rejects.toThrow('path is unsafe');
		await expect(access(join(temporary, 'outside-marker'))).rejects.toThrow();
	});

	test('counts response bytes and fails closed above the per-response cap', async () => {
		let observed = 0;
		const bytes = await collectActualBudgetIdentityStream(
			Readable.from([Buffer.from('actual'), Buffer.from('-budget')]),
			32,
			(size) => {
				observed += size;
			},
		);
		expect(bytes.toString('utf8')).toBe('actual-budget');
		expect(observed).toBe(bytes.length);
		await expect(
			collectActualBudgetIdentityStream(
				Readable.from([Buffer.alloc(5), Buffer.alloc(6)]),
				10,
			),
		).rejects.toThrow('byte cap exceeded');
	});
});
