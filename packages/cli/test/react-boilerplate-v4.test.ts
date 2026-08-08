import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import { sha256 } from '../../core/src/receipts/canonicalize.ts';

describe('React Boilerplate fixture', () => {
	test('cached source is pinned and worktrees differ only by migration intent', async () => {
		const manifest = JSON.parse(
			await readFile('fixtures/react-boilerplate-v4/fixture.json', 'utf8'),
		);
		const archive = await readFile('.versionless/cache/react-boilerplate-v4/source.tar.gz');
		expect(sha256(archive)).toBe(manifest.source.archiveSha256);
		const legacy = await readFile(
			'.versionless/work/react-boilerplate-v4/legacy/app/containers/LocaleToggle/index.js',
		);
		const target = await readFile(
			'.versionless/work/react-boilerplate-v4/target/app/containers/LocaleToggle/index.js',
		);
		expect(sha256(legacy)).toBe(manifest.source.localeToggleSha256);
		expect(sha256(target)).not.toBe(sha256(legacy));
	});
});
