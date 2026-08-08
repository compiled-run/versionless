import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import { findArchiveFile, indexTarGzip, sha256 } from '../../../core/src/index.ts';
import {
	KILLEDBYGOOGLE_APP_SOURCE_SHA256,
	transformNext12DerivedStateToMemo,
} from '../src/index.ts';

async function appSource(): Promise<string> {
	const bytes = await readFile(
		'.versionless/cache/tier-f/next-killedbygoogle/c28878d0f65b56aa595763c852477fb0c1e3533e5c7f7ea9daa2be16f102368d/source.tar.gz',
	);
	const index = indexTarGzip(
		{ bytes, byteLength: bytes.byteLength, sha256: sha256(bytes) },
		'56809c31592e6ca1edce8af9bfe842fbcdf71f4d',
	);
	return findArchiveFile(index, 'components/App.tsx').bytes.toString('utf8');
}

describe('Next 12 derived list state to useMemo', () => {
	test('performs only the three exact spans and is idempotent', async () => {
		const source = await appSource();
		expect(sha256(source)).toBe(KILLEDBYGOOGLE_APP_SOURCE_SHA256);
		const transformed = transformNext12DerivedStateToMemo(source);
		expect(transformed.changed).toBe(true);
		expect(transformed.edits).toHaveLength(3);
		expect(transformed.code).toContain('const listItems = useMemo(() => {');
		expect(transformed.code).toContain("window.umami.trackEvent(searchTerm, 'search')");
		expect(transformed.code).not.toContain('updateListItems');
		const repeated = transformNext12DerivedStateToMemo(transformed.code);
		expect(repeated.changed).toBe(false);
		expect(repeated.code).toBe(transformed.code);
	});

	test('refuses changed and near-match sources', async () => {
		const source = await appSource();
		expect(() => transformNext12DerivedStateToMemo(`${source}\n`)).toThrow('SHA-256 mismatch');
		expect(() =>
			transformNext12DerivedStateToMemo(source.replace('updateListItems', 'setListItems')),
		).toThrow('SHA-256 mismatch');
	});
});
