import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import { findArchiveFile, indexTarGzip, sha256 } from '../../core/src/index.ts';
import {
	AVATAAARS_CONSENT_ID,
	AVATAAARS_CONSUMED_CONSENT_IDS,
	AVATAAARS_URL_LIST_SHA256,
	avataaarsMirrorName,
	assertAvataaarsMirrorCollision,
	parseAvataaarsYarnLock,
	verifyRetainedAvataaarsTwice,
} from '../src/fixture/react-avataaars-dependency-ingest.ts';

async function lock(): Promise<Buffer> {
	const bytes = await readFile(
		'.versionless/cache/tier-f/react-avataaars/4863a1304b659f1105f69d8ae0c715428c41d2d64b43edfd701148ddfca900da/source.tar.gz',
	);
	const index = indexTarGzip(
		{ bytes, byteLength: bytes.byteLength, sha256: sha256(bytes) },
		'c191c6c2d27f41245e803912d43c7213436a34d3',
	);
	return findArchiveFile(index, 'yarn.lock').bytes;
}

describe('React Avataaars dependency acquisition', () => {
	test('derives the exact corrected immutable plan', async () => {
		const plan = parseAvataaarsYarnLock(await lock());
		expect(plan).toHaveLength(1222);
		expect(plan.filter((row) => row.integrity.startsWith('sha512-'))).toHaveLength(606);
		expect(plan.filter((row) => row.integrity.startsWith('sha1-'))).toHaveLength(616);
		expect(sha256(plan.map((row) => row.resolved).join('\n'))).toBe(AVATAAARS_URL_LIST_SHA256);
		expect(AVATAAARS_CONSENT_ID).toBe('T230-react-avataaars-audited-closure-publication');
		expect(AVATAAARS_CONSUMED_CONSENT_IDS).toEqual([
			'T224-react-avataaars-yarn-closure',
			'T228-react-avataaars-yarn-closure-scoped-mirror',
		]);
	});

	test('replays retained evidence twice without network', async () => {
		await expect(verifyRetainedAvataaarsTwice()).resolves.toBeUndefined();
	});

	test('refuses changed lock bytes', async () => {
		const bytes = await lock();
		expect(() => parseAvataaarsYarnLock(Buffer.concat([bytes, Buffer.from('\n')]))).toThrow(
			'SHA-256 mismatch',
		);
	});

	test('uses Yarn-compatible scoped mirror names without basename collisions', async () => {
		const plan = parseAvataaarsYarnLock(await lock());
		const scoped = plan.find((row) => row.identity.name === '@types/react-transition-group');
		const plain = plan.find((row) => row.identity.name === 'react-transition-group');
		expect(scoped && avataaarsMirrorName(scoped)).toBe(
			'@types-react-transition-group-4.4.2.tgz',
		);
		expect(plain && avataaarsMirrorName(plain)).toBe('react-transition-group-4.4.2.tgz');
		expect(new Set(plan.map(avataaarsMirrorName))).toHaveLength(1222);
	});

	test('refuses true same-name different-content collisions', () => {
		expect(() => assertAvataaarsMirrorCollision('same', 'same')).not.toThrow();
		expect(() => assertAvataaarsMirrorCollision('first', 'second')).toThrow(
			'mirror filename collision differs',
		);
	});
});
