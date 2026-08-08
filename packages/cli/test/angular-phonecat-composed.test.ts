import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, test } from 'vitest';

const root = path.resolve(import.meta.dirname, '../../..');

describe('Angular PhoneCat composed fixture', () => {
	test('pins the immutable source and reuses the unchanged PhoneCat journey', async () => {
		const manifest = JSON.parse(
			await readFile(
				path.join(root, 'fixtures/angular-phonecat-composed/fixture.json'),
				'utf8',
			),
		) as Record<string, Record<string, string> | string>;
		expect(manifest.id).toBe('angular-phonecat-composed');
		expect(manifest.track).toBe('angularjs-special-track');
		expect((manifest.source as Record<string, string>).revision).toBe(
			'ef6f6eb672ded472b4e442d598f5df40d0e0642c',
		);
		expect((manifest.source as Record<string, string>).appConfigSha256).toHaveLength(64);
		expect((manifest.source as Record<string, string>).phoneListSha256).toHaveLength(64);
		expect((manifest.source as Record<string, string>).phoneDetailSha256).toHaveLength(64);
	});
});
