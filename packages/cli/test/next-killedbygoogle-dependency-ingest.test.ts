import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import { findArchiveFile, indexTarGzip, sha256 } from '../../core/src/index.ts';
import {
	KILLEDBYGOOGLE_CONSENT_ID,
	KILLEDBYGOOGLE_URL_LIST_SHA256,
	killedbygoogleMirrorName,
	assertKilledByGoogleMirrorCollision,
	parseKilledByGoogleYarnLock,
	verifyRetainedKilledByGoogleTwice,
} from '../src/fixture/next-killedbygoogle-dependency-ingest.ts';

async function lock(): Promise<Buffer> {
	const bytes = await readFile(
		'.versionless/cache/tier-f/next-killedbygoogle/c28878d0f65b56aa595763c852477fb0c1e3533e5c7f7ea9daa2be16f102368d/source.tar.gz',
	);
	const index = indexTarGzip(
		{ bytes, byteLength: bytes.byteLength, sha256: sha256(bytes) },
		'56809c31592e6ca1edce8af9bfe842fbcdf71f4d',
	);
	return findArchiveFile(index, 'yarn.lock').bytes;
}

describe('Next Killed by Google dependency acquisition', () => {
	test('derives the exact corrected immutable plan', async () => {
		const plan = parseKilledByGoogleYarnLock(await lock());
		expect(plan).toHaveLength(710);
		expect(plan.filter((row) => row.integrity.startsWith('sha512-'))).toHaveLength(657);
		expect(plan.filter((row) => row.integrity.startsWith('sha1-'))).toHaveLength(53);
		expect(sha256(plan.map((row) => row.url).join('\n'))).toBe(KILLEDBYGOOGLE_URL_LIST_SHA256);
		expect(KILLEDBYGOOGLE_CONSENT_ID).toBe('T236-next-killedbygoogle-yarn-v1-closure');
	});

	test('replays retained evidence twice without network', async () => {
		await expect(verifyRetainedKilledByGoogleTwice()).resolves.toBeUndefined();
	});

	test('refuses changed lock bytes', async () => {
		const bytes = await lock();
		expect(() =>
			parseKilledByGoogleYarnLock(Buffer.concat([bytes, Buffer.from('\n')])),
		).toThrow('SHA-256 mismatch');
	});

	test('uses Yarn-compatible scoped mirror names without basename collisions', async () => {
		const plan = parseKilledByGoogleYarnLock(await lock());
		const scoped = plan.find((row) => row.identity.name.startsWith('@'));
		expect(scoped && killedbygoogleMirrorName(scoped).startsWith('@')).toBe(true);
		expect(new Set(plan.map(killedbygoogleMirrorName))).toHaveLength(710);
	});

	test('refuses true same-name different-content collisions', () => {
		expect(() => assertKilledByGoogleMirrorCollision('same', 'same')).not.toThrow();
		expect(() => assertKilledByGoogleMirrorCollision('first', 'second')).toThrow(
			'mirror filename collision differs',
		);
	});
});
