import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { gunzipSync, gzipSync } from 'node:zlib';
import * as path from 'pathe';
import { afterEach, describe, expect, it } from 'vitest';
import {
	auditNpmContentCaches,
	inspectNpmPackageTarball,
	npmLockRowSetDigest,
	parseNpmLockPlan,
	sha256,
	verifyNpmSri,
	type NpmLockIdentity,
} from '../src/index.ts';

const temporary: string[] = [];
afterEach(async () => {
	for (const target of temporary.splice(0)) await rm(target, { recursive: true, force: true });
});

type TarEntry = Readonly<{
	name: string;
	prefix?: string;
	body?: string | Buffer;
	type?: '0' | '1' | '2' | '5' | 'x';
	linkName?: string;
}>;

function octal(header: Buffer, offset: number, length: number, value: number): void {
	const text = value.toString(8).padStart(length - 1, '0');
	header.write(text, offset, length - 1, 'ascii');
	header[offset + length - 1] = 0;
}

function tarGzip(entries: readonly TarEntry[], trailing?: Buffer): Buffer {
	const blocks: Buffer[] = [];
	for (const entry of entries) {
		const body = Buffer.from(entry.body ?? '');
		const header = Buffer.alloc(512);
		header.write(entry.name, 0, 100, 'utf8');
		if (entry.prefix) header.write(entry.prefix, 345, 155, 'utf8');
		octal(header, 100, 8, 0o644);
		octal(header, 108, 8, 0);
		octal(header, 116, 8, 0);
		octal(header, 124, 12, body.byteLength);
		octal(header, 136, 12, 0);
		header.fill(32, 148, 156);
		header[156] = (entry.type ?? '0').charCodeAt(0);
		if (entry.linkName) header.write(entry.linkName, 157, 100, 'utf8');
		header.write('ustar', 257, 5, 'ascii');
		header.write('00', 263, 2, 'ascii');
		let checksum = 0;
		for (const byte of header) checksum += byte;
		header.write(checksum.toString(8).padStart(6, '0'), 148, 6, 'ascii');
		header[154] = 0;
		header[155] = 32;
		blocks.push(header, body, Buffer.alloc((512 - (body.byteLength % 512)) % 512));
	}
	blocks.push(Buffer.alloc(1_024));
	if (trailing) blocks.push(trailing);
	return gzipSync(Buffer.concat(blocks));
}

function manifestTar(
	root: string,
	manifest: Record<string, unknown>,
	extra: readonly TarEntry[] = [],
): Buffer {
	return tarGzip([{ name: `${root}/package.json`, body: JSON.stringify(manifest) }, ...extra]);
}

function sri(bytes: Buffer, algorithm: 'sha1' | 'sha512'): string {
	return `${algorithm}-${createHash(algorithm).update(bytes).digest('base64')}`;
}

function identity(name: string, version: string): readonly NpmLockIdentity[] {
	return [{ name, version }];
}

function paxRecord(key: string, value: string): string {
	const payload = `${key}=${value}\n`;
	let length = payload.length + 2;
	while (`${length} `.length + payload.length !== length)
		length = `${length} `.length + payload.length;
	return `${length} ${payload}`;
}

describe('npm lock acquisition preflight', () => {
	it('parses and deduplicates exact npm v3 and nested v1 URL/SRI rows', () => {
		const bytes = Buffer.from('artifact');
		const integrity = sri(bytes, 'sha512');
		const url = 'https://registry.npmjs.org/example/-/example-1.0.0.tgz';
		const v3 = parseNpmLockPlan(
			Buffer.from(
				JSON.stringify({
					lockfileVersion: 3,
					packages: {
						'': { name: 'root', version: '1.0.0' },
						'node_modules/example': { version: '1.0.0', resolved: url, integrity },
						'node_modules/parent/node_modules/example': {
							version: '1.0.0',
							resolved: url,
							integrity,
						},
					},
				}),
			),
		);
		expect(v3).toMatchObject({ lockfileVersion: 3, pairs: [{ url, integrity }] });
		expect(v3.pairs).toHaveLength(1);
		const v1 = parseNpmLockPlan(
			Buffer.from(
				JSON.stringify({
					lockfileVersion: 1,
					dependencies: {
						parent: {
							version: '2.0.0',
							resolved: 'https://registry.npmjs.org/parent/-/parent-2.0.0.tgz',
							integrity,
							dependencies: {
								example: { version: '1.0.0', resolved: url, integrity },
							},
						},
					},
				}),
			),
		);
		expect(v1.lockfileVersion).toBe(1);
		expect(v1.pairs.map((pair) => pair.url)).toEqual([
			url,
			'https://registry.npmjs.org/parent/-/parent-2.0.0.tgz',
		]);
		expect(npmLockRowSetDigest([...v3.pairs, ...v3.pairs])).toHaveLength(64);
	});

	it('refuses mutable, remote, incomplete, and malformed lock rows', () => {
		const integrity = sri(Buffer.from('artifact'), 'sha512');
		const lock = (resolved: string, candidateIntegrity: unknown = integrity) =>
			Buffer.from(
				JSON.stringify({
					lockfileVersion: 3,
					packages: {
						'node_modules/example': {
							version: '1.0.0',
							resolved,
							integrity: candidateIntegrity,
						},
					},
				}),
			);
		for (const url of [
			'http://registry.npmjs.org/example/-/example-1.0.0.tgz',
			'https://example.invalid/example/-/example-1.0.0.tgz',
			'https://registry.npmjs.org/example/-/example-1.0.0.tgz?token=blocked',
			'https://registry.npmjs.org/example/-/example-1.0.0.tgz#blocked',
		])
			expect(() => parseNpmLockPlan(lock(url))).toThrow('URL');
		expect(() =>
			parseNpmLockPlan(
				lock('https://registry.npmjs.org/example/-/example-1.0.0.tgz', 'sha256-bad'),
			),
		).toThrow('SRI');
		expect(() => parseNpmLockPlan(Buffer.from('{'))).toThrow('invalid JSON');
	});

	it('preserves package and legacy license forms plus all metadata states', () => {
		const packageLayout = manifestTar('package', {
			name: 'example',
			version: '1.0.0',
			license: 'MIT',
			scripts: { install: 'node-gyp rebuild', prepare: 7 },
			gypfile: true,
			engines: { node: '>=18' },
			os: ['darwin', 'linux'],
			cpu: 7,
			optionalDependencies: { optional: '1.0.0' },
		});
		const metadata = inspectNpmPackageTarball(packageLayout, identity('example', '1.0.0'));
		expect(metadata).toMatchObject({
			layout: 'package',
			license: { state: 'declared', declarations: ['MIT'] },
			lifecycleScripts: [
				{ name: 'install', state: 'declared' },
				{ name: 'prepare', state: 'ambiguous' },
			],
			nativeIndicators: { gypfile: 'true', lifecycleMentionsNodeGyp: true },
			engines: { state: 'declared', values: { node: '>=18' } },
			os: { state: 'declared', values: ['darwin', 'linux'] },
			cpu: { state: 'ambiguous', values: [] },
			optionalDependencies: { state: 'declared', names: ['optional'] },
		});
		const jsonSchema = inspectNpmPackageTarball(
			manifestTar('package', {
				name: 'json-schema',
				version: '0.2.3',
				licenses: [{ type: 'AFLv2.1' }, { type: 'BSD' }],
			}),
			identity('json-schema', '0.2.3'),
		);
		expect(jsonSchema.license).toEqual({
			state: 'declared',
			declarations: ['AFLv2.1', 'BSD'],
			files: [],
		});
		const typesQ = inspectNpmPackageTarball(
			manifestTar('q', { name: '@types/q', version: '0.0.32', license: 'MIT' }),
			identity('@types/q', '0.0.32'),
		);
		expect(typesQ).toMatchObject({
			layout: 'legacy-single-root',
			license: { state: 'declared', declarations: ['MIT'] },
		});
		const fileOnly = inspectNpmPackageTarball(
			manifestTar('package', { name: 'file-only', version: '1.0.0' }, [
				{ name: 'package/LICENSE', body: 'retained text' },
			]),
			identity('file-only', '1.0.0'),
		);
		expect(fileOnly.license).toEqual({
			state: 'file-only',
			declarations: [],
			files: ['LICENSE'],
		});
		const empty = inspectNpmPackageTarball(
			manifestTar('package', { name: 'empty', version: '1.0.0' }),
			identity('empty', '1.0.0'),
		);
		expect(empty.license.state).toBe('empty');
	});

	it('rejects unsafe paths, links, checksum changes, identity drift, mixed roots, and trailing data', () => {
		const valid = manifestTar('package', { name: 'example', version: '1.0.0', license: 'MIT' });
		expect(() => inspectNpmPackageTarball(valid, identity('other', '1.0.0'))).toThrow(
			'identity differs',
		);
		expect(() =>
			inspectNpmPackageTarball(
				tarGzip([{ name: '../package/package.json', body: '{}' }]),
				identity('example', '1.0.0'),
			),
		).toThrow('path is unsafe');
		expect(() =>
			inspectNpmPackageTarball(
				tarGzip([
					{
						name: 'package/package.json',
						body: JSON.stringify({ name: 'example', version: '1.0.0' }),
					},
					{ name: 'package/link', type: '2', linkName: '../blocked' },
				]),
				identity('example', '1.0.0'),
			),
		).toThrow('link target is forbidden');
		const corrupt = Buffer.from(valid);
		corrupt[corrupt.length - 1] ^= 1;
		expect(() => inspectNpmPackageTarball(corrupt, identity('example', '1.0.0'))).toThrow();
		expect(() =>
			inspectNpmPackageTarball(
				tarGzip(
					[
						{
							name: 'package/package.json',
							body: JSON.stringify({ name: 'example', version: '1.0.0' }),
						},
					],
					Buffer.from('blocked'),
				),
				identity('example', '1.0.0'),
			),
		).toThrow('trailing data');
	});

	it('accepts only the raw zero-body type-5 single-terminal-slash representation', () => {
		const manifest = JSON.stringify({ name: '@types/cors', version: '2.8.13', license: 'MIT' });
		const identities = identity('@types/cors', '2.8.13');
		const acceptedName = tarGzip([
			{ name: 'cors/', type: '5' },
			{ name: 'cors/package.json', body: manifest },
		]);
		expect(inspectNpmPackageTarball(acceptedName, identities).layout).toBe(
			'legacy-single-root',
		);
		const acceptedPrefix = tarGzip([
			{ name: 'nested/', prefix: 'cors', type: '5' },
			{ name: 'cors/package.json', body: manifest },
		]);
		expect(inspectNpmPackageTarball(acceptedPrefix, identities).name).toBe('@types/cors');

		const rejected: readonly Readonly<{ entry: TarEntry; message: string }>[] = [
			{ entry: { name: 'cors//', type: '5' }, message: 'path is unsafe' },
			{ entry: { name: 'cors/./', type: '5' }, message: 'path is unsafe' },
			{ entry: { name: 'cors/../', type: '5' }, message: 'path is unsafe' },
			{ entry: { name: '../cors/', type: '5' }, message: 'path is unsafe' },
			{ entry: { name: '/cors/', type: '5' }, message: 'path is unsafe' },
			{ entry: { name: 'cors\\nested/', type: '5' }, message: 'path is unsafe' },
			{ entry: { name: '/', type: '5' }, message: 'path is unsafe' },
			{ entry: { name: 'cors/', type: '0' }, message: 'path is unsafe' },
			{ entry: { name: 'cors/', type: '2' }, message: 'path is unsafe' },
			{ entry: { name: 'cors/', type: '1' }, message: 'path is unsafe' },
			{ entry: { name: 'cors/', type: '5', body: 'x' }, message: 'path is unsafe' },
		];
		for (const candidate of rejected)
			expect(() =>
				inspectNpmPackageTarball(
					tarGzip([candidate.entry, { name: 'cors/package.json', body: manifest }]),
					identities,
				),
			).toThrow(candidate.message);

		expect(() =>
			inspectNpmPackageTarball(
				tarGzip([
					{ name: 'pax', type: 'x', body: paxRecord('path', 'cors/') },
					{ name: 'ignored', type: '5' },
					{ name: 'cors/package.json', body: manifest },
				]),
				identities,
			),
		).toThrow('path is unsafe');
		expect(() =>
			inspectNpmPackageTarball(
				tarGzip([
					{ name: 'cors', type: '5' },
					{ name: 'cors/package.json', body: manifest },
					{ name: 'cors/package.json', body: manifest },
				]),
				identities,
			),
		).toThrow('duplicated');
		expect(() =>
			inspectNpmPackageTarball(
				gzipSync(
					Buffer.concat([
						gunzipSync(
							tarGzip([{ name: 'cors/package.json', body: manifest }]),
						).subarray(0, -512),
					]),
				),
				identities,
			),
		).toThrow('terminator');
	});

	it('uses an exact URL index only to locate content and then verifies every lock SRI', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-t192-cache-'));
		temporary.push(directory);
		const bytes = manifestTar('package', { name: 'example', version: '1.0.0', license: 'MIT' });
		const sha1 = sri(bytes, 'sha1');
		const sha512 = sri(bytes, 'sha512');
		const url = 'https://registry.npmjs.org/example/-/example-1.0.0.tgz';
		const encoded = sha512.slice('sha512-'.length);
		const hex = Buffer.from(encoded, 'base64').toString('hex');
		const content = path.join(
			directory,
			'_cacache/content-v2/sha512',
			hex.slice(0, 2),
			hex.slice(2, 4),
			hex.slice(4),
		);
		const key = `make-fetch-happen:request-cache:${url}`;
		const indexDigest = sha256(key);
		const index = path.join(
			directory,
			'_cacache/index-v5',
			indexDigest.slice(0, 2),
			indexDigest.slice(2, 4),
			indexDigest.slice(4),
		);
		await mkdir(path.dirname(content), { recursive: true });
		await mkdir(path.dirname(index), { recursive: true });
		await writeFile(content, bytes);
		await writeFile(
			index,
			`entry\t${JSON.stringify({ key, integrity: sha512, size: bytes.byteLength, metadata: { url } })}\n`,
		);
		const pair = { url, integrity: sha1, identities: identity('example', '1.0.0') };
		const audit = await auditNpmContentCaches(
			[pair],
			[{ label: 'synthetic', path: directory }],
		);
		expect(audit.cached).toHaveLength(1);
		expect(audit.missing).toEqual([]);
		verifyNpmSri(bytes, sha1);
		await writeFile(content, Buffer.from('tampered'));
		await expect(
			auditNpmContentCaches([pair], [{ label: 'synthetic', path: directory }]),
		).rejects.toThrow('SRI');
	});
});
