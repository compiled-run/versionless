import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import { findArchiveFile, indexTarGzip, sha256 } from '../../../core/src/index.ts';
import {
	transformAvataaarsReact18,
	transformAvataaarsReact18Index,
} from '../src/react-avataaars-react18-migration.ts';

async function source(path: string): Promise<string> {
	const bytes = await readFile(
		'.versionless/cache/tier-f/react-avataaars/4863a1304b659f1105f69d8ae0c715428c41d2d64b43edfd701148ddfca900da/source.tar.gz',
	);
	const archive = indexTarGzip(
		{ bytes, byteLength: bytes.byteLength, sha256: sha256(bytes) },
		'c191c6c2d27f41245e803912d43c7213436a34d3',
	);
	return findArchiveFile(archive, path).bytes.toString('utf8');
}

describe('Avataaars React 18 migration', () => {
	test('performs the exact typed bootstrap, service-worker, and lifecycle edits', async () => {
		const result = transformAvataaarsReact18({
			index: await source('src/index.tsx'),
			app: await source('src/components/App.tsx'),
		});
		expect(result.changed).toBe(true);
		expect(result.index.edits).toEqual([
			'react-dom-render-to-createRoot',
			'obsolete-registerServiceWorker-import-call-removal',
			'renderer-render-to-createRoot',
		]);
		expect(result.index.code).toContain("import { createRoot } from 'react-dom/client'");
		expect(result.index.code).not.toContain('registerServiceWorker');
		expect(result.app.edits).toHaveLength(1);
		expect(
			transformAvataaarsReact18({ index: result.index.code, app: result.app.code }),
		).toMatchObject({ changed: false });
	});

	test('refuses drift and partial target shapes', async () => {
		const index = await source('src/index.tsx');
		expect(() => transformAvataaarsReact18Index(`${index}\n`)).toThrow('SHA-256 mismatch');
		expect(() =>
			transformAvataaarsReact18Index(
				index.replace(
					"import * as ReactDOM from 'react-dom'",
					"import { createRoot } from 'react-dom/client'",
				),
			),
		).toThrow('ambiguous');
	});
});
