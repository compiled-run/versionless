import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, test } from 'vitest';

const root = path.resolve(import.meta.dirname, '../../..');

describe('Angular PhoneCat route-resolve fixture', () => {
	test('pins the immutable corpus and three exact application inputs', async () => {
		const manifest = JSON.parse(
			await readFile(
				path.join(root, 'fixtures/angular-phonecat-route-resolve/fixture.json'),
				'utf8',
			),
		) as Record<string, any>;
		expect(manifest.source.revision).toBe('ef6f6eb672ded472b4e442d598f5df40d0e0642c');
		expect(manifest.source.license).toBe('MIT');
		expect(manifest.source.appConfigSha256).toHaveLength(64);
		expect(manifest.source.phoneListSha256).toHaveLength(64);
		expect(manifest.source.phoneDetailSha256).toHaveLength(64);
		expect(manifest.track).toBe('angularjs-special-track');
		expect(manifest.journey).toBe('fixtures/angular-phonecat/journey.json');
	});
});
