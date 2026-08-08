import { gunzipSync, gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
	classifyAssets,
	completeBuffer,
	findArchiveFile,
	indexTarGzip as indexTarGzipWithCommit,
	materializationPath,
	readCompleteBody,
	requireCompleteAssetClassifications,
	requireOfficialTreeInventory,
	requirePortableJson,
	requireRawArchiveMatch,
	requireRepeatedBodies,
	requireRootMitLicense,
} from '../src/corpus/tier-f-provenance.ts';

const mit = Buffer.from(
	'MIT License\n\nCopyright (c) fixture\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.\n',
);
const expectedCommit = 'c191c6c2d27f41245e803912d43c7213436a34d3';
const otherExpectedCommit = '875aa2df7f5f87b6731a1259b63e2b399fa5fb3f';

function indexTarGzip(
	archive: Parameters<typeof indexTarGzipWithCommit>[0],
	commit = expectedCommit,
) {
	return indexTarGzipWithCommit(archive, commit);
}

function octal(value: number, length: number): Buffer {
	const rendered = value.toString(8).padStart(length - 1, '0');
	return Buffer.from(`${rendered}\0`);
}

function tarArchive(
	files: ReadonlyArray<{
		path: string;
		bytes: Buffer;
		type?: string;
		link?: string;
		prefix?: string;
		mutateHeader?: (header: Buffer) => void;
		corruptChecksum?: boolean;
	}>,
	terminator = Buffer.alloc(1_024),
): Buffer {
	const chunks: Buffer[] = [];
	for (const file of files) {
		const header = Buffer.alloc(512);
		Buffer.from(file.path).copy(header, 0, 0, 100);
		octal(0o644, 8).copy(header, 100);
		octal(0, 8).copy(header, 108);
		octal(0, 8).copy(header, 116);
		octal(file.bytes.byteLength, 12).copy(header, 124);
		octal(0, 12).copy(header, 136);
		header.fill(32, 148, 156);
		if (file.type === '\0') header[156] = 0;
		else header.write(file.type ?? '0', 156, 1, 'ascii');
		if (file.link) header.write(file.link, 157, 100, 'utf8');
		Buffer.from([117, 115, 116, 97, 114, 0]).copy(header, 257);
		header.write('00', 263, 2, 'ascii');
		if (file.prefix) Buffer.from(file.prefix).copy(header, 345, 0, 155);
		file.mutateHeader?.(header);
		let checksum = 0;
		for (const byte of header) checksum += byte;
		octal(checksum, 8).copy(header, 148);
		if (file.corruptChecksum) header[148] = header[148] === 48 ? 49 : 48;
		chunks.push(
			header,
			file.bytes,
			Buffer.alloc(Math.ceil(file.bytes.byteLength / 512) * 512 - file.bytes.byteLength),
		);
	}
	chunks.push(terminator);
	return gzipSync(Buffer.concat(chunks));
}

function paxRecord(key: string, value: string): Buffer {
	const content = `${key}=${value}\n`;
	let length = Buffer.byteLength(content) + 2;
	while (true) {
		const record = `${length} ${content}`;
		const actual = Buffer.byteLength(record);
		if (actual === length) return Buffer.from(record);
		length = actual;
	}
}

function globalCommentEntry(
	commit = expectedCommit,
	overrides: Partial<Parameters<typeof tarArchive>[0][number]> = {},
): Parameters<typeof tarArchive>[0][number] {
	return {
		path: 'pax_global_header',
		bytes: paxRecord('comment', commit),
		type: 'g',
		...overrides,
	};
}

function pathOfBytes(length: number): string {
	const parts = ['fixture'];
	let remaining = length - Buffer.byteLength('fixture/');
	while (remaining > 0) {
		const separator = parts.length > 1 ? 1 : 0;
		const segment = Math.min(255, remaining - separator);
		if (segment <= 0) break;
		parts.push('a'.repeat(segment));
		remaining -= segment + separator;
	}
	return parts.join('/');
}

function safeArchive(extra: Parameters<typeof tarArchive>[0] = []): Buffer {
	return tarArchive([
		{ path: 'fixture/LICENSE', bytes: mit },
		{ path: 'fixture/package.json', bytes: Buffer.from('{"name":"fixture"}\n') },
		{ path: 'fixture/src/index.ts', bytes: Buffer.from('export {};\n') },
		{ path: 'fixture/public/logo.svg', bytes: Buffer.from('<svg/>\n') },
		...extra,
	]);
}

async function* chunks(values: readonly Buffer[]): AsyncIterable<Uint8Array> {
	for (const value of values) yield value;
}

describe('T084 complete Buffer acquisition', () => {
	it.each([
		['LF', Buffer.from('value\n')],
		['repeated LF', Buffer.from('value\n\n')],
		['CRLF', Buffer.from('value\r\n')],
		['NUL', Buffer.from([118, 97, 108, 117, 101, 0])],
		['arbitrary binary', Buffer.from([0, 255, 128, 10, 13, 0, 42])],
	])('hashes and counts complete %s bytes before parsing', async (_label, bytes) => {
		const split = [bytes.subarray(0, 1), bytes.subarray(1, 3), bytes.subarray(3)];
		const body = await readCompleteBody(chunks(split), 1_024);
		expect(body.byteLength).toBe(bytes.byteLength);
		expect(body.bytes.equals(bytes)).toBe(true);
		expect(body).toEqual(completeBuffer([bytes]));
	});

	it('refuses trailing-newline truncation and repeated-but-wrong bytes', () => {
		expect(() =>
			requireRepeatedBodies(
				completeBuffer([Buffer.from('a\n')]),
				completeBuffer([Buffer.from('a')]),
			),
		).toThrow();
		expect(() =>
			requireRepeatedBodies(
				completeBuffer([Buffer.from('first')]),
				completeBuffer([Buffer.from('other')]),
			),
		).toThrow();
	});

	it('refuses a truncated stream at the transfer limit', async () => {
		await expect(
			readCompleteBody(chunks([Buffer.from('123'), Buffer.from('456')]), 5),
		).rejects.toThrow();
	});
});

describe('T090 strict extended-tar indexing', () => {
	it('indexes safe bytes and requires raw/archive identity', () => {
		const index = indexTarGzip(completeBuffer([safeArchive()]));
		const manifest = findArchiveFile(index, 'package.json');
		requireRawArchiveMatch(completeBuffer([manifest.bytes]), manifest);
		expect(() =>
			requireRawArchiveMatch(completeBuffer([Buffer.from('{}')]), manifest),
		).toThrow();
		expect(requireRootMitLicense(index, 'LICENSE').sha256).toBe(
			findArchiveFile(index, 'LICENSE').sha256,
		);
	});

	it('accepts USTAR, PAX path, GNU long name, matching L+x, and metadata directories', () => {
		const paxPath = 'fixture/long/pax-entry.ts';
		const gnuPath = 'fixture/long/gnu-entry.ts';
		const matchingPath = 'fixture/long/matching-entry.ts';
		const directoryPath = 'fixture/generated-directory';
		const index = indexTarGzip(
			completeBuffer([
				tarArchive([
					{ path: 'fixture/LICENSE', bytes: mit },
					{ path: 'PaxHeaders/pax', bytes: paxRecord('path', paxPath), type: 'x' },
					{ path: 'fixture/raw-pax', bytes: Buffer.from('pax') },
					{ path: '././@LongLink', bytes: Buffer.from(`${gnuPath}\0`), type: 'L' },
					{ path: 'fixture/raw-gnu', bytes: Buffer.from('gnu') },
					{ path: '././@LongLink', bytes: Buffer.from(`${matchingPath}\0`), type: 'L' },
					{ path: 'PaxHeaders/match', bytes: paxRecord('path', matchingPath), type: 'x' },
					{ path: 'fixture/raw-match', bytes: Buffer.from('match') },
					{
						path: 'PaxHeaders/directory',
						bytes: paxRecord('path', directoryPath),
						type: 'x',
					},
					{ path: 'fixture/raw-directory', bytes: Buffer.alloc(0), type: '5' },
				]),
			]),
		);
		expect(index.files.map((file) => file.path)).toEqual([
			'LICENSE',
			'long/gnu-entry.ts',
			'long/matching-entry.ts',
			'long/pax-entry.ts',
		]);
		expect(index.files).not.toContainEqual(expect.objectContaining({ path: 'PaxHeaders/pax' }));
	});

	it.each([100, 255, 4_096])('accepts a safe final path at the %i-byte boundary', (length) => {
		const finalPath = pathOfBytes(length);
		expect(Buffer.byteLength(finalPath)).toBe(length);
		const index = indexTarGzip(
			completeBuffer([
				tarArchive([
					{ path: 'PaxHeaders/boundary', bytes: paxRecord('path', finalPath), type: 'x' },
					{ path: 'fixture/raw', bytes: Buffer.from('x') },
				]),
			]),
		);
		expect(index.files[0]?.path).toBe(finalPath.slice('fixture/'.length));
	});

	it('uses prefix/name USTAR paths and produces stable final manifests', () => {
		const archive = completeBuffer([
			tarArchive([{ path: 'entry.ts', prefix: 'fixture/src', bytes: Buffer.from('x') }]),
		]);
		const first = indexTarGzip(archive);
		const second = indexTarGzip(archive);
		expect(first.files.map(({ path: file, sha256 }) => ({ path: file, sha256 }))).toEqual(
			second.files.map(({ path: file, sha256 }) => ({ path: file, sha256 })),
		);
		expect(first.manifestSha256).toBe(second.manifestSha256);
		requireOfficialTreeInventory(first, ['src/entry.ts']);
		expect(() => requireOfficialTreeInventory(first, ['src/other.ts'])).toThrow();
	});

	it.each([
		['missing LF', Buffer.from('15 path=value')],
		['leading zero', Buffer.from('014 path=x\n')],
		['signed length', Buffer.from('+12 path=x\n')],
		['missing equality', Buffer.from('10 pathxx\n')],
		['duplicate equality', paxRecord('path', 'a=b')],
		[
			'multiple records',
			Buffer.concat([paxRecord('path', 'fixture/a'), paxRecord('path', 'fixture/b')]),
		],
		[
			'invalid UTF-8',
			Buffer.concat([Buffer.from('11 path='), Buffer.from([255]), Buffer.from('\n')]),
		],
		['NUL path', paxRecord('path', 'fixture/a\0b')],
		['CR path', paxRecord('path', 'fixture/a\rb')],
		['LF path', paxRecord('path', 'fixture/a\nb')],
		['non-NFC path', paxRecord('path', 'fixture/e\u0301')],
	] as const)('refuses malformed or unsafe PAX: %s', (_label, payload) => {
		expect(() =>
			indexTarGzip(
				completeBuffer([
					tarArchive([
						{ path: 'PaxHeaders/value', bytes: payload, type: 'x' },
						{ path: 'fixture/raw', bytes: Buffer.from('x') },
					]),
				]),
			),
		).toThrow();
	});

	it.each([
		'linkpath',
		'size',
		'uid',
		'gid',
		'uname',
		'gname',
		'mtime',
		'atime',
		'ctime',
		'charset',
		'comment',
		'hdrcharset',
		'GNU.sparse.map',
		'SCHILY.acl.access',
		'LIBARCHIVE.xattr.security',
		'vendor.key',
	])('refuses forbidden PAX key %s', (key) => {
		expect(() =>
			indexTarGzip(
				completeBuffer([
					tarArchive([
						{ path: 'PaxHeaders/value', bytes: paxRecord(key, 'value'), type: 'x' },
						{ path: 'fixture/raw', bytes: Buffer.from('x') },
					]),
				]),
			),
		).toThrow();
	});

	it('refuses oversized PAX and GNU metadata payloads', () => {
		for (const entry of [
			{ path: 'PaxHeaders/value', bytes: Buffer.alloc(8_193, 97), type: 'x' },
			{ path: '././@LongLink', bytes: Buffer.alloc(4_098, 97), type: 'L' },
		])
			expect(() =>
				indexTarGzip(
					completeBuffer([
						tarArchive([entry, { path: 'fixture/raw', bytes: Buffer.from('x') }]),
					]),
				),
			).toThrow();
	});

	it.each([
		['no NUL', Buffer.from('fixture/name')],
		['only NUL', Buffer.from([0])],
		['embedded NUL', Buffer.from('fixture/a\0b\0')],
		['invalid UTF-8', Buffer.from([102, 255, 0])],
	] as const)('refuses malformed GNU L: %s', (_label, payload) => {
		expect(() =>
			indexTarGzip(
				completeBuffer([
					tarArchive([
						{ path: 'LongLink', bytes: payload, type: 'L' },
						{ path: 'fixture/raw', bytes: Buffer.from('x') },
					]),
				]),
			),
		).toThrow();
	});

	it.each([
		['absolute', '/fixture/file'],
		['UNC', '//server/share'],
		['drive', 'C:/fixture/file'],
		['backslash', 'fixture\\file'],
		['traversal', 'fixture/../escape'],
		['oversized segment', `fixture/${'a'.repeat(256)}`],
		['oversized path', `${pathOfBytes(4_096)}a`],
	] as const)('refuses unsafe override paths: %s', (_label, finalPath) => {
		expect(() =>
			indexTarGzip(
				completeBuffer([
					tarArchive([
						{
							path: 'PaxHeaders/value',
							bytes: paxRecord('path', finalPath),
							type: 'x',
						},
						{ path: 'fixture/raw', bytes: Buffer.from('x') },
					]),
				]),
			),
		).toThrow();
	});

	it('refuses repeated, reversed, conflicting, dangling, and duplicate-final metadata', () => {
		const cases = [
			[
				{ path: 'LongLink', bytes: Buffer.from('fixture/a\0'), type: 'L' },
				{ path: 'LongLink', bytes: Buffer.from('fixture/a\0'), type: 'L' },
			],
			[
				{ path: 'PaxHeaders/a', bytes: paxRecord('path', 'fixture/a'), type: 'x' },
				{ path: 'LongLink', bytes: Buffer.from('fixture/a\0'), type: 'L' },
			],
			[
				{ path: 'LongLink', bytes: Buffer.from('fixture/a\0'), type: 'L' },
				{ path: 'PaxHeaders/b', bytes: paxRecord('path', 'fixture/b'), type: 'x' },
				{ path: 'fixture/raw', bytes: Buffer.from('x') },
			],
			[{ path: 'PaxHeaders/a', bytes: paxRecord('path', 'fixture/a'), type: 'x' }],
			[
				{ path: 'PaxHeaders/a', bytes: paxRecord('path', 'fixture/a'), type: 'x' },
				{ path: 'fixture/raw-a', bytes: Buffer.from('a') },
				{ path: 'PaxHeaders/b', bytes: paxRecord('path', 'fixture/a'), type: 'x' },
				{ path: 'fixture/raw-b', bytes: Buffer.from('b') },
			],
		];
		for (const entries of cases)
			expect(() => indexTarGzip(completeBuffer([tarArchive(entries)]))).toThrow();
	});

	it('refuses a safe override when the raw header path is unsafe', () => {
		expect(() =>
			indexTarGzip(
				completeBuffer([
					tarArchive([
						{
							path: 'PaxHeaders/value',
							bytes: paxRecord('path', 'fixture/safe'),
							type: 'x',
						},
						{ path: '../unsafe', bytes: Buffer.from('x') },
					]),
				]),
			),
		).toThrow();
	});

	it('refuses more than 50000 actual entries', () => {
		const entries = Array.from({ length: 50_001 }, (_, index) => ({
			path: `fixture/f${index.toString(36)}`,
			bytes: Buffer.alloc(0),
		}));
		expect(() => indexTarGzip(completeBuffer([tarArchive(entries)]))).toThrow(
			'actual entry limit',
		);
	});

	it.each(['g', 'K', '1', '2', '3', '4', '6', '7', 'S', 'Z'])(
		'refuses forbidden tar entry type %s',
		(type) => {
			expect(() =>
				indexTarGzip(
					completeBuffer([
						tarArchive([{ path: 'fixture/unsafe', bytes: Buffer.alloc(0), type }]),
					]),
				),
			).toThrow();
		},
	);

	it('refuses invalid signatures, numerics, checksums, directory bodies, links, and terminators', () => {
		const truncatedBody = gunzipSync(
			tarArchive([{ path: 'fixture/a', bytes: Buffer.alloc(513) }]),
		).subarray(0, 512 + 513);
		const cases = [
			tarArchive([{ path: 'fixture/a', bytes: Buffer.from('x'), corruptChecksum: true }]),
			tarArchive([
				{
					path: 'fixture/a',
					bytes: Buffer.from('x'),
					mutateHeader: (header) => header.fill(0, 257, 265),
				},
			]),
			tarArchive([
				{
					path: 'fixture/a',
					bytes: Buffer.from('x'),
					mutateHeader: (header) => {
						header[8] = 255;
					},
				},
			]),
			tarArchive([
				{
					path: 'fixture/a',
					bytes: Buffer.from('x'),
					mutateHeader: (header) => {
						header[124] = 128;
					},
				},
			]),
			tarArchive([{ path: 'fixture/directory', bytes: Buffer.from('x'), type: '5' }]),
			tarArchive([{ path: 'fixture/a', bytes: Buffer.from('x'), link: 'target' }]),
			tarArchive([{ path: 'fixture/a', bytes: Buffer.from('x') }], Buffer.alloc(512)),
			tarArchive(
				[{ path: 'fixture/a', bytes: Buffer.from('x') }],
				Buffer.concat([Buffer.alloc(1_024), Buffer.from('x')]),
			),
			gzipSync(truncatedBody),
		];
		for (const archive of cases)
			expect(() => indexTarGzip(completeBuffer([archive]))).toThrow();
	});

	it('refuses archive tamper, traversal, links, and nested archives', () => {
		const tampered = safeArchive();
		tampered[20] = (tampered[20] ?? 0) ^ 1;
		expect(() => indexTarGzip(completeBuffer([tampered]))).toThrow();
		expect(() =>
			indexTarGzip(
				completeBuffer([tarArchive([{ path: '../escape', bytes: Buffer.from('x') }])]),
			),
		).toThrow();
		expect(() =>
			indexTarGzip(
				completeBuffer([
					tarArchive([
						{
							path: 'fixture/link',
							bytes: Buffer.alloc(0),
							type: '2',
							link: '../outside',
						},
					]),
				]),
			),
		).toThrow();
		expect(() =>
			indexTarGzip(
				completeBuffer([
					safeArchive([{ path: 'fixture/hidden.zip', bytes: Buffer.from('x') }]),
				]),
			),
		).toThrow();
		expect(() =>
			indexTarGzip(
				completeBuffer([
					tarArchive([
						{ path: 'first/a', bytes: Buffer.from('a') },
						{ path: 'second/b', bytes: Buffer.from('b') },
					]),
				]),
			),
		).toThrow('exactly one root');
	});

	it('refuses license tamper and omitted or strengthened asset classifications', () => {
		const index = indexTarGzip(completeBuffer([safeArchive()]));
		expect(() => requireRootMitLicense(index, 'package.json')).toThrow();
		const assets = classifyAssets(index);
		expect(assets).toHaveLength(1);
		expect(assets[0]?.classification).toBe('excluded');
		requireCompleteAssetClassifications(index, assets);
		expect(() => requireCompleteAssetClassifications(index, [])).toThrow();
		expect(() =>
			requireCompleteAssetClassifications(index, [
				{ ...assets[0]!, classification: 'verified-compatible' },
			]),
		).toThrow();
	});

	it('refuses path escape and host/sensitive evidence leakage', () => {
		expect(() => materializationPath('/portable/root', '../escape')).toThrow();
		for (const unsafe of [
			{ path: '/Users/person/tmp' },
			{ path: '/var/private/evidence.json' },
			{ path: 'C:\\Users\\person\\evidence.json' },
			{ path: '\\\\host\\share\\evidence.json' },
			{ path: 'file:///Users/person/evidence.json' },
			{ path: '../private/evidence.json' },
			{ path: 'safe/../../private/evidence.json' },
			{ authorization: 'authorization: secret' },
			{ note: 'api-key=secret-value' },
			{ claim: 'payment supported' },
			{ customerEmail: 'person@example.com' },
			{ username: 'host-owner' },
			{ card: '4111111111111111' },
		])
			expect(() => requirePortableJson(unsafe)).toThrow();
		requirePortableJson({
			payment: 'not-tested',
			customer: 'not-established',
			authentication: 'nonclaim: not tested',
			evidenceBlockers: [
				'Server, API, data, authentication, and payment behavior remain not-tested.',
			],
			nonclaims: ['No payment, customer, or authentication support is established.'],
		});
		requirePortableJson({
			repository: 'fangpenlin/avataaars-generator',
			path: 'client/src/app/users/user.component.ts',
			claim: 'fixture provenance only',
		});
		requirePortableJson({
			schemaVersion: 'versionless.runtime-script-observation.v1',
			summary: {},
			boundaries: {},
			inputs: {},
			verticals: [{ lanes: [{ runs: [{ journeyProjection: { username: 'octocat' } }] }] }],
			detectorMutation: {},
		});
	});

	it('permits only exact synthetic T124 official-tree object-ID fields', () => {
		const objectId = (index: number) => {
			const digits = index % 2 === 0 ? '1234567890123' : '1234567890123456789';
			return `a${digits}${index.toString(16).padStart(39 - digits.length, 'c')}`;
		};
		const provenance = () => ({
			schemaVersion: 'versionless.cross-source-provenance.v1',
			fixture: 'next-killedbygoogle',
			repository: 'codyogden/killedbygoogle',
			repositoryIdentity: { fullName: 'codyogden/killedbygoogle', fork: false },
			commit: '56809c31592e6ca1edce8af9bfe842fbcdf71f4d',
			tree: 'b8ac7b4fc3a1e12240f1848f6e8d98c1c7d80763',
			archive: {},
			fileCount: 86,
			officialTreeRowCount: 86,
			officialTree: Array.from({ length: 86 }, (_, index) => ({
				path: `synthetic/provenance-${index}.ts`,
				mode: '100644',
				type: 'blob',
				sha: objectId(index),
			})),
			fileManifestSha256: 'synthetic-manifest',
			acceptedGlobalMetadata: null,
			acceptedPathMetadata: [],
			files: [],
			rootLicense: {},
			licensing: [],
			assets: [],
			corroboratedLeadFacts: { scope: 'provenance-only' },
			evidenceBlockers: ['not-tested'],
			nestedCompatibleLicense: null,
			excludedCommittedDist: [],
		});
		expect(() => requirePortableJson(provenance())).not.toThrow();
		for (const mutate of [
			(document: ReturnType<typeof provenance>) => {
				document.officialTree[0]!.sha = '1234567890123456789012345678901234567890';
			},
			(document: ReturnType<typeof provenance>) => {
				document.officialTree[85]!.path = 'synthetic/../escape.ts';
			},
			(document: ReturnType<typeof provenance>) => {
				(document.officialTree[85] as Record<string, unknown>).shaSibling = objectId(85);
			},
		]) {
			const document = provenance();
			mutate(document);
			expect(() => requirePortableJson(document)).toThrow('Sensitive material refused');
		}
	});

	it('permits only direct T138 official-tree object IDs in the exact subject revision', () => {
		const objectId = (index: number) => {
			const digits = index % 2 === 0 ? '1234567890123' : '1234567890123456789';
			return `a${digits}${index.toString(16).padStart(39 - digits.length, 'd')}`;
		};
		const provenance = () => ({
			schemaVersion: 'versionless.cross-source-provenance.v1',
			fixture: 'next-tailwind-starter-blog',
			repository: 'timlrx/tailwind-nextjs-starter-blog',
			repositoryIdentity: {
				fullName: 'timlrx/tailwind-nextjs-starter-blog',
				fork: false,
			},
			commit: '09ba0550caea03a8c38bc4878d05838d2a57f999',
			tree: '2609b3fc4a63d7bccd8f187d66c141f4a7d3cadf',
			archive: {},
			fileCount: 120,
			officialTreeRowCount: 138,
			officialTree: Array.from({ length: 138 }, (_, index) => ({
				path: `synthetic/t138-provenance-${index}.ts`,
				mode: index === 0 ? '040000' : '100644',
				type: index === 0 ? 'tree' : 'blob',
				sha: objectId(index),
			})),
			fileManifestSha256: 'synthetic-manifest',
			acceptedGlobalMetadata: null as unknown,
			acceptedPathMetadata: [],
			files: [],
			rootLicense: {},
			licensing: [],
			assets: [],
			corroboratedLeadFacts: { scope: 'provenance-only' },
			evidenceBlockers: ['not-tested'],
			nestedCompatibleLicense: null,
			excludedCommittedDist: [],
		});
		expect(() => requirePortableJson(provenance())).not.toThrow();
		for (const mutate of [
			(document: ReturnType<typeof provenance>) => {
				document.officialTree[0]!.sha = '1234567890123456789012345678901234567890';
			},
			(document: ReturnType<typeof provenance>) => {
				document.officialTree[137]!.path = document.officialTree[0]!.path;
			},
			(document: ReturnType<typeof provenance>) => {
				(document.officialTree[137] as Record<string, unknown>).shaSibling = objectId(137);
			},
			(document: ReturnType<typeof provenance>) => {
				document.repositoryIdentity.fork = true;
			},
		]) {
			const document = provenance();
			mutate(document);
			expect(() => requirePortableJson(document)).toThrow('Sensitive material refused');
		}
	});

	it('permits the exact immutable tailwind fixture while scanning ordinary nested paths', () => {
		const fixtureDocument = () => ({
			schemaVersion: 'versionless.immutable-fixture.v1',
			id: 'next-tailwind-starter-blog',
			framework: 'nextjs',
			repository: 'timlrx/tailwind-nextjs-starter-blog',
			repositoryUrl: 'https://github.com/timlrx/tailwind-nextjs-starter-blog',
			commit: '09ba0550caea03a8c38bc4878d05838d2a57f999',
			tree: '2609b3fc4a63d7bccd8f187d66c141f4a7d3cadf',
			archive: {
				url: 'https://example.test/archive',
				sha256: 'a'.repeat(64),
				byteLength: 1,
			},
			archiveManifestSha256: 'b'.repeat(64),
			repositoryIdentity: {
				fullName: 'timlrx/tailwind-nextjs-starter-blog',
				fork: false,
			},
			reliedPaths: [
				'.yarnrc.yml',
				'LICENSE',
				'app/api/newsletter2/route.ts',
				'app/blog/[...slug]/page.tsx',
				'app/layout.tsx',
				'next.config.js',
				'package.json',
				'yarn.lock',
			],
			corroboratedLeadFacts: { scope: 'provenance-only' },
			evidenceBlockers: ['not-tested'],
			usableClosure: {
				assets: 'not-tested',
				nestedLicensing: 'not-tested',
				committedDist: 'not-tested',
			},
			localityBoundaries: ['not-tested'],
			nonclaims: ['No payment or authentication support is established.'],
		});
		expect(() => requirePortableJson(fixtureDocument())).not.toThrow();
		const absolutePath = fixtureDocument();
		absolutePath.usableClosure.assets = '/Users/synthetic/private';
		expect(() => requirePortableJson(absolutePath)).toThrow('host-specific or unsafe path');
		const escapePath = fixtureDocument();
		escapePath.usableClosure.assets = 'safe/../../private';
		expect(() => requirePortableJson(escapePath)).toThrow('host-specific or unsafe path');
		const arbitraryDigest = fixtureDocument();
		arbitraryDigest.usableClosure.assets = 'a1234567890123bbbbbbbbbbbbbbbbbbbbbbbbb';
		expect(() => requirePortableJson(arbitraryDigest)).toThrow('Sensitive material refused');
	});
});

describe('T092 exact global PAX commit-comment indexing', () => {
	it('requires a valid caller-supplied expected commit even when no global header exists', () => {
		const archive = completeBuffer([safeArchive()]);
		expect(indexTarGzip(archive).globalMetadata).toBeNull();
		for (const commit of ['', expectedCommit.toUpperCase(), `${expectedCommit.slice(0, -1)}g`])
			expect(() => indexTarGzipWithCommit(archive, commit)).toThrow(
				'Expected archive commit',
			);
		expect(() => indexTarGzipWithCommit(archive, undefined as unknown as string)).toThrow(
			'Expected archive commit',
		);
	});

	it('records one exact first-header comment separately from later L/x path metadata', () => {
		const finalPath = 'fixture/src/metadata-entry.ts';
		const archive = completeBuffer([
			tarArchive([
				globalCommentEntry(),
				{ path: 'fixture/LICENSE', bytes: mit },
				{ path: '././@LongLink', bytes: Buffer.from(`${finalPath}\0`), type: 'L' },
				{ path: 'PaxHeaders/path', bytes: paxRecord('path', finalPath), type: 'x' },
				{ path: 'fixture/raw', bytes: Buffer.from('value') },
			]),
		]);
		const first = indexTarGzip(archive);
		const second = indexTarGzip(archive);
		expect(first.globalMetadata).toEqual({
			kind: 'pax-global-comment',
			comment: expectedCommit,
			bytes: 52,
		});
		expect(first.pathMetadata).toEqual([
			{ kind: 'gnu-long-name', value: finalPath, bytes: Buffer.byteLength(finalPath) },
			{ kind: 'pax-path', value: finalPath, bytes: Buffer.byteLength(finalPath) },
		]);
		expect(first.files.map((file) => file.path)).toEqual(['LICENSE', 'src/metadata-entry.ts']);
		expect(first.manifestSha256).toBe(second.manifestSha256);
		expect(first.globalMetadata).toEqual(second.globalMetadata);
		expect(first.pathMetadata).toEqual(second.pathMetadata);
	});

	it('binds independently to two different expected commits', () => {
		for (const commit of [expectedCommit, otherExpectedCommit]) {
			const index = indexTarGzip(
				completeBuffer([
					tarArchive([
						globalCommentEntry(commit),
						{ path: 'fixture/file.ts', bytes: Buffer.from('value') },
					]),
				]),
				commit,
			);
			expect(index.globalMetadata?.comment).toBe(commit);
		}
	});

	it.each([
		[
			'wrong name',
			[
				globalCommentEntry(expectedCommit, { path: 'PaxHeaders/global' }),
				{ path: 'fixture/file', bytes: Buffer.from('x') },
			],
		],
		[
			'after actual entry',
			[{ path: 'fixture/file', bytes: Buffer.from('x') }, globalCommentEntry()],
		],
		[
			'repeated',
			[
				globalCommentEntry(),
				globalCommentEntry(),
				{ path: 'fixture/file', bytes: Buffer.from('x') },
			],
		],
		[
			'after GNU L',
			[
				{ path: '././@LongLink', bytes: Buffer.from('fixture/file\0'), type: 'L' },
				globalCommentEntry(),
				{ path: 'fixture/raw', bytes: Buffer.from('x') },
			],
		],
		[
			'after PAX x',
			[
				{ path: 'PaxHeaders/path', bytes: paxRecord('path', 'fixture/file'), type: 'x' },
				globalCommentEntry(),
				{ path: 'fixture/raw', bytes: Buffer.from('x') },
			],
		],
		['dangling', [globalCommentEntry()]],
	] as const)('refuses invalid global-header placement: %s', (_label, entries) => {
		expect(() => indexTarGzip(completeBuffer([tarArchive(entries)]))).toThrow();
	});

	it.each([
		'path',
		'linkpath',
		'size',
		'uid',
		'gid',
		'uname',
		'gname',
		'mtime',
		'atime',
		'ctime',
		'SCHILY.acl.access',
		'LIBARCHIVE.xattr.security',
		'vendor.key',
	])('refuses global PAX key %s', (key) => {
		const valueBytes = 52 - Buffer.byteLength(`00 ${key}=\n`);
		const payload = paxRecord(key, 'a'.repeat(Math.max(1, valueBytes)));
		expect(() =>
			indexTarGzip(
				completeBuffer([
					tarArchive([
						globalCommentEntry(expectedCommit, { bytes: payload }),
						{ path: 'fixture/file', bytes: Buffer.from('x') },
					]),
				]),
			),
		).toThrow();
	});

	it.each([
		[
			'multiple records',
			Buffer.concat([
				paxRecord('comment', expectedCommit),
				paxRecord('comment', expectedCommit),
			]),
		],
		['wrong declared length', Buffer.from(`51 comment=${expectedCommit}\n`)],
		['missing LF', Buffer.from(`52 comment=${expectedCommit}x`)],
		['uppercase', paxRecord('comment', expectedCommit.toUpperCase())],
		['nonhex', paxRecord('comment', `${expectedCommit.slice(0, -1)}g`)],
		['mismatch', paxRecord('comment', otherExpectedCommit)],
		['wrong value length', paxRecord('comment', expectedCommit.slice(1))],
		[
			'invalid UTF-8',
			Buffer.concat([
				Buffer.from('52 comment='),
				Buffer.from([255]),
				Buffer.from(expectedCommit.slice(1)),
				Buffer.from('\n'),
			]),
		],
		['oversized', Buffer.alloc(8_193, 97)],
	] as const)('refuses malformed global PAX comment: %s', (_label, payload) => {
		expect(() =>
			indexTarGzip(
				completeBuffer([
					tarArchive([
						globalCommentEntry(expectedCommit, { bytes: payload }),
						{ path: 'fixture/file', bytes: Buffer.from('x') },
					]),
				]),
			),
		).toThrow();
	});

	it('refuses global header linkname, checksum, signature, and numeric violations', () => {
		const archives = [
			tarArchive([
				globalCommentEntry(expectedCommit, { link: 'fixture/target' }),
				{ path: 'fixture/file', bytes: Buffer.from('x') },
			]),
			tarArchive([
				globalCommentEntry(expectedCommit, { corruptChecksum: true }),
				{ path: 'fixture/file', bytes: Buffer.from('x') },
			]),
			tarArchive([
				globalCommentEntry(expectedCommit, {
					mutateHeader: (header) => header.fill(0, 257, 265),
				}),
				{ path: 'fixture/file', bytes: Buffer.from('x') },
			]),
			tarArchive([
				globalCommentEntry(expectedCommit, {
					mutateHeader: (header) => {
						header[108] = 128;
					},
				}),
				{ path: 'fixture/file', bytes: Buffer.from('x') },
			]),
		];
		for (const archive of archives)
			expect(() => indexTarGzip(completeBuffer([archive]))).toThrow();
	});

	it('never applies a global comment as path or entry state', () => {
		const index = indexTarGzip(
			completeBuffer([
				tarArchive([
					globalCommentEntry(),
					{ path: 'fixture/header-path.ts', bytes: Buffer.from('x') },
				]),
			]),
		);
		expect(index.files.map((file) => file.path)).toEqual(['header-path.ts']);
		expect(index.pathMetadata).toEqual([]);
	});
});
