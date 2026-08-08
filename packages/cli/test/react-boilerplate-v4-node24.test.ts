import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	ingestReactBoilerplateNode24,
	REACT_NODE24_CONSENT,
} from '../src/fixture/react-boilerplate-v4-node24-ingest.ts';

const root = path.resolve(import.meta.dirname, '../../..');

describe('React Boilerplate maintained runtime fixture', () => {
	it('pins the exact source, runtime, webpack archive integrity, and unchanged journey', async () => {
		const manifest = JSON.parse(
			await readFile(
				path.join(root, 'fixtures/react-boilerplate-v4-node24/fixture.json'),
				'utf8',
			),
		) as Record<string, any>;
		expect(manifest.source.revision).toBe('d19099afeff64ecfb09133c06c1cb18c0d40887e');
		expect(manifest.runtime).toMatchObject({ version: '24.15.0', platform: 'darwin-arm64' });
		expect(manifest.webpack).toMatchObject({ from: '4.30.0', to: '4.47.0' });
		expect(manifest.webpack.integrity.startsWith('sha512-')).toBe(true);
		expect(manifest.journey).toBe('fixtures/react-boilerplate-v4/journey.json');
	});

	it('refuses ingest without exact explicit consent before network access', async () => {
		for (const options of [
			{ allowNetwork: false, consentId: REACT_NODE24_CONSENT },
			{ allowNetwork: true, consentId: 'wrong' },
		])
			await expect(ingestReactBoilerplateNode24(options)).rejects.toThrow('exact consent');
	});
});
