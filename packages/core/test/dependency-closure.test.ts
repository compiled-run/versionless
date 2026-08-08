import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import * as path from 'pathe';
import { parseURL } from 'ufo';
import { describe, expect, it } from 'vitest';
import { findArchiveFile, indexTarGzip } from '../src/corpus/tier-f-provenance.ts';
import {
	finalizeDependencyClosureReceipt,
	FUXA_LOCK_SHA256,
	FUXA_RUNTIME_SHA256,
	inspectDependencyTarball,
	parseFuxaDependencyPlan,
	verifyDependencyClosureReceipt,
	verifyDependencySri,
} from '../src/receipts/dependency-closure.ts';
import { sha256 } from '../src/receipts/canonicalize.ts';

const root = path.resolve(import.meta.dirname, '../../..');
const archivePath = path.join(
	root,
	'.versionless/cache/tier-f/angular-fuxa/4913aabfec74fc990664a5d60760d8f3438ee067b682f833f5869cd2c9c3c372/source.tar.gz',
);

function octal(value: number, width: number): Buffer {
	const output = Buffer.alloc(width, 0);
	output.write(`${value.toString(8).padStart(width - 1, '0')}\0`, 'ascii');
	return output;
}

function tarFile(name: string, body: Buffer, type = '0'): Buffer {
	const header = Buffer.alloc(512, 0);
	header.write(name, 0, 100, 'utf8');
	octal(420, 8).copy(header, 100);
	octal(0, 8).copy(header, 108);
	octal(0, 8).copy(header, 116);
	octal(body.byteLength, 12).copy(header, 124);
	octal(0, 12).copy(header, 136);
	header.fill(32, 148, 156);
	header.write(type, 156, 1, 'ascii');
	header.write('ustar\0', 257, 6, 'ascii');
	header.write('00', 263, 2, 'ascii');
	octal(
		[...header].reduce((sum, byte) => sum + byte, 0),
		8,
	).copy(header, 148);
	return Buffer.concat([header, body, Buffer.alloc((512 - (body.byteLength % 512)) % 512)]);
}

function packageTar(
	manifest: Record<string, unknown>,
	extraName = 'package/LICENSE',
	type = '0',
): Buffer {
	return gzipSync(
		Buffer.concat([
			tarFile('package/package.json', Buffer.from(JSON.stringify(manifest))),
			tarFile(extraName, Buffer.from('MIT\n'), type),
			Buffer.alloc(1024),
		]),
	);
}

describe('FUXA npm-v1 dependency closure', () => {
	it('binds the immutable T094 lock to the exact 1,222 request plan', async () => {
		const bytes = await readFile(archivePath);
		const index = indexTarGzip(
			{ bytes, byteLength: bytes.byteLength, sha256: sha256(bytes) },
			'8b323c177615c0d152a54e5ef0a6f98dae7b8ff0',
		);
		const lock = findArchiveFile(index, 'client/package-lock.json').bytes;
		expect(sha256(lock)).toBe(FUXA_LOCK_SHA256);
		const plan = parseFuxaDependencyPlan(lock);
		expect(plan).toHaveLength(1222);
		expect(plan.map((request) => request.sequence)).toEqual(
			Array.from({ length: 1222 }, (_, index) => index + 1),
		);
		expect(new Set(plan.map((request) => parseURL(request.url).host))).toEqual(
			new Set(['registry.npmjs.org']),
		);
		expect(plan.every((request) => request.identities.length > 0)).toBe(true);
	});

	it('rejects any lock mutation before interpreting dependency data', async () => {
		const bytes = await readFile(archivePath);
		const index = indexTarGzip(
			{ bytes, byteLength: bytes.byteLength, sha256: sha256(bytes) },
			'8b323c177615c0d152a54e5ef0a6f98dae7b8ff0',
		);
		const mutated = Buffer.from(findArchiveFile(index, 'client/package-lock.json').bytes);
		mutated[mutated.byteLength - 2] = mutated[mutated.byteLength - 2] === 32 ? 10 : 32;
		expect(() => parseFuxaDependencyPlan(mutated)).toThrow('SHA-256 mismatch');
	});

	it('validates SRI, package identity, license evidence, paths, and entry types', () => {
		const bytes = packageTar({ name: '@scope/example', version: '1.2.3', license: 'MIT' });
		const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
		expect(() => verifyDependencySri(bytes, integrity)).not.toThrow();
		expect(() =>
			verifyDependencySri(Buffer.concat([bytes, Buffer.from('x')]), integrity),
		).toThrow('SRI mismatch');
		expect(
			inspectDependencyTarball(bytes, [{ name: '@scope/example', version: '1.2.3' }]),
		).toMatchObject({ name: '@scope/example', version: '1.2.3', license: 'MIT' });
		expect(() =>
			inspectDependencyTarball(bytes, [{ name: '@scope/example', version: '1.2.4' }]),
		).toThrow('differs from the lock');
		expect(() =>
			inspectDependencyTarball(
				packageTar({ name: 'example', version: '1.0.0' }, 'package/../escape'),
				[{ name: 'example', version: '1.0.0' }],
			),
		).toThrow('path is unsafe');
		expect(() =>
			inspectDependencyTarball(
				packageTar({ name: 'example', version: '1.0.0' }, 'package/link', '2'),
				[{ name: 'example', version: '1.0.0' }],
			),
		).toThrow('special entries');
		expect(() =>
			inspectDependencyTarball(
				packageTar({ name: 'example', version: '1.0.0' }, 'package/readme'),
				[{ name: 'example', version: '1.0.0' }],
			),
		).toThrow('neither a license');
	});

	it('seals and rejects mutations to a complete 1,222-artifact receipt', () => {
		const artifacts = Array.from({ length: 1222 }, (_, index) => ({
			sequence: index + 1,
			url: `https://registry.npmjs.org/p/-/p-${index}.tgz`,
			integrity: `sha512-${Buffer.alloc(64, index % 255).toString('base64')}`,
			sha256: 'a'.repeat(64),
			byteLength: 1,
			name: 'p',
			version: String(index),
			license: 'MIT',
			licenseFiles: [],
		}));
		const receipt = finalizeDependencyClosureReceipt({
			fixture: 'angular-fuxa',
			repository: 'frangoteam/FUXA',
			commit: '8b323c177615c0d152a54e5ef0a6f98dae7b8ff0',
			lock: {
				path: 'client/package-lock.json',
				sha256: FUXA_LOCK_SHA256,
				lockfileVersion: 1,
				entries: 1468,
				uniqueTarballs: 1222,
				missingResolvedOrIntegrity: 0,
				hosts: ['registry.npmjs.org'],
			},
			runtime: {
				node: '16.20.2',
				npm: '8.19.4',
				archiveSha256: FUXA_RUNTIME_SHA256,
				state: 'eol-compatibility-sandbox-only',
			},
			consent: {
				id: 'consent',
				status: 'closed',
				methods: ['GET'],
				requests: 1222,
				responseBytes: 1222,
				aggregateBytes: 1_024 * 1_024 * 1_024,
			},
			artifacts,
			installVerification: {
				runs: 2,
				networkAttempts: 0,
				ignoreScripts: true,
				firstDigest: 'b'.repeat(64),
				secondDigest: 'b'.repeat(64),
				lockUnchanged: true,
				residue: 'none',
			},
			nonclaims: ['bounded'],
		});
		expect(verifyDependencyClosureReceipt(receipt)).toEqual(receipt);
		const mutated = structuredClone(receipt);
		(mutated.artifacts[0] as { sha256: string }).sha256 = 'c'.repeat(64);
		expect(() => verifyDependencyClosureReceipt(mutated)).toThrow('invalid');
	});
});
