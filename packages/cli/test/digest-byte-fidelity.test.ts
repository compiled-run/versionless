/**
 * Regression gate for the u21 latin1 digest defect.
 *
 * The build-lane inventory walker used to digest `bytes.toString('binary')` — a
 * latin1 decode that Node re-encoded as UTF-8 before hashing. For a file made
 * only of bytes below 0x80 that composition is the identity and the published
 * digest was right by coincidence; for any file carrying a byte at or above
 * 0x80 it published sha256(UTF-8(latin1(bytes))) instead of sha256(bytes).
 *
 * The fixture below is built so that the three candidate answers are three
 * different digests, and the test pins the only correct one. A walker that
 * regressed to latin1, and a walker that regressed to a lossy UTF-8 read, both
 * fail here rather than quietly publishing a wrong number that still compares
 * equal to itself.
 */

import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'pathe';
import { afterAll, describe, expect, it } from 'vitest';
import { inventoryOf } from '../src/fixture/angular-factoriolab-build-lanes-run.ts';
import { sha256 } from '../src/fixture/angular-factoriolab-migration-run.ts';

const repositoryRoot = path.resolve(import.meta.dirname, '../../..');

/**
 * A file whose bytes exercise every distinguishing case at once: the full
 * ASCII run whose digests coincide, the full high-byte run that latin1 widens,
 * a valid UTF-8 sequence, and two byte pairs that a UTF-8 read replaces with
 * the replacement character rather than round-tripping.
 */
const FIXTURE = path.join(repositoryRoot, 'fixtures/digest-byte-fidelity/high-bytes.bin');

/** sha256 of the fixture's 264 bytes, taken over the bytes. */
const RAW_DIGEST = '0e7118cf7427c6062ec2ce19baba570ee7f3bdc9c3129ae1b8d47ea961d526ff';
/** What the defect published: sha256 of the UTF-8 re-encoding of a latin1 decode. */
const LATIN1_DIGEST = 'b87c6fb1d167270ef4bb3be16a2512bc094ec2bd968973673264a191bf56bc0d';
/** What a lossy UTF-8 read would publish, replacement characters and all. */
const UTF8_ROUNDTRIP_DIGEST =
	'37154b9b8422ab6f45196ee0ae09971fa95b3fe336a5545f95702316785b2f40';

const temporaries: string[] = [];

async function stagedTree(): Promise<string> {
	const directory = await mkdtemp(path.join(tmpdir(), 'versionless-digest-'));
	temporaries.push(directory);
	const bytes = await readFile(FIXTURE);
	await writeFile(path.join(directory, 'high-bytes.bin'), bytes);
	await mkdir(path.join(directory, 'nested'), { recursive: true });
	await writeFile(path.join(directory, 'nested/ascii.txt'), 'plain ascii\n');
	return directory;
}

afterAll(async () => {
	for (const directory of temporaries) await rm(directory, { recursive: true, force: true });
});

describe('artifact digests address bytes', () => {
	it('the fixture really does discriminate the three candidate answers', async () => {
		const bytes = await readFile(FIXTURE);
		expect(bytes.byteLength).toBe(264);
		expect(bytes.some((byte) => byte >= 0x80)).toBe(true);
		expect(createHash('sha256').update(bytes).digest('hex')).toBe(RAW_DIGEST);
		expect(createHash('sha256').update(bytes.toString('binary')).digest('hex')).toBe(
			LATIN1_DIGEST,
		);
		expect(createHash('sha256').update(bytes.toString('utf8')).digest('hex')).toBe(
			UTF8_ROUNDTRIP_DIGEST,
		);
		expect(new Set([RAW_DIGEST, LATIN1_DIGEST, UTF8_ROUNDTRIP_DIGEST]).size).toBe(3);
	});

	it('the shared hasher digests a byte array as its bytes and a string as UTF-8', async () => {
		const bytes = await readFile(FIXTURE);
		expect(sha256(bytes)).toBe(RAW_DIGEST);
		expect(sha256(bytes.toString('binary'))).toBe(LATIN1_DIGEST);
		expect(sha256('plain ascii\n')).toBe(
			createHash('sha256').update('plain ascii\n').digest('hex'),
		);
	});

	it('the build-lane inventory walker publishes sha256 of the file bytes', async () => {
		const directory = await stagedTree();
		const inventory = await inventoryOf(directory);
		const high = inventory.find((item) => item.path === 'high-bytes.bin');
		expect(high).toBeDefined();
		expect(high?.sha256).toBe(RAW_DIGEST);
		expect(high?.sha256).not.toBe(LATIN1_DIGEST);
		expect(high?.sha256).not.toBe(UTF8_ROUNDTRIP_DIGEST);
		expect(high?.bytes).toBe(264);
	});

	it('an ASCII-only file is the coincidence that hid the defect, and still agrees', async () => {
		const directory = await stagedTree();
		const inventory = await inventoryOf(directory);
		const ascii = inventory.find((item) => item.path === 'nested/ascii.txt');
		expect(ascii?.sha256).toBe(createHash('sha256').update('plain ascii\n').digest('hex'));
	});
});
