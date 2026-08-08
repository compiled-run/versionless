import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import { findArchiveFile, indexTarGzip, sha256 } from '../../../core/src/index.ts';
import { transformReactClassLifecycleToHooks } from '../src/react-class-lifecycle-to-hooks.ts';

async function app(): Promise<string> {
	const bytes = await readFile(
		'.versionless/cache/tier-f/react-avataaars/4863a1304b659f1105f69d8ae0c715428c41d2d64b43edfd701148ddfca900da/source.tar.gz',
	);
	const index = indexTarGzip(
		{ bytes, byteLength: bytes.byteLength, sha256: sha256(bytes) },
		'c191c6c2d27f41245e803912d43c7213436a34d3',
	);
	return findArchiveFile(index, 'src/components/App.tsx').bytes.toString('utf8');
}

describe('React Avataaars lifecycle transform', () => {
	test('uses one exact semantic edit with cleanup', async () => {
		const result = transformReactClassLifecycleToHooks(await app());
		expect(result.changed).toBe(true);
		expect(result.edits).toHaveLength(1);
		expect(result.code).toContain('const unlisten = history.listen(() => forceUpdate())');
		expect(result.code).toContain('return unlisten');
	});

	test('is idempotent and refuses near matches', async () => {
		const source = await app();
		const first = transformReactClassLifecycleToHooks(source);
		expect(transformReactClassLifecycleToHooks(first.code)).toMatchObject({
			code: first.code,
			changed: false,
		});
		expect(() => transformReactClassLifecycleToHooks(`${source}\n`)).toThrow(
			'SHA-256 mismatch',
		);
	});
});
