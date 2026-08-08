import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { transformReactConnectToHooks } from '../src/react-connect-to-hooks.ts';

const sourcePath =
	'.versionless/cache/react-boilerplate-v4/source/app/containers/LocaleToggle/index.js';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
describe('React connect-to-hooks transform', () => {
	test('uses five deterministic minimal spans', async () => {
		const source = await readFile(sourcePath, 'utf8');
		const result = transformReactConnectToHooks(source);
		expect(result.edits).toHaveLength(5);
		expect(result.code).toContain('useSelector(selectLocale)');
		for (const removed of ['connect(', 'createSelector', 'PropTypes'])
			expect(result.code).not.toContain(removed);
		expect(transformReactConnectToHooks(source).targetSha256).toBe(result.targetSha256);
	});
	test('refuses changed and shadowed input', async () => {
		const source = await readFile(sourcePath, 'utf8');
		expect(() => transformReactConnectToHooks(`${source}\n`)).toThrow('SHA-256 mismatch');
		const changed = source.replace(
			"import { connect } from 'react-redux';",
			'const connect = value => value;',
		);
		expect(() =>
			transformReactConnectToHooks(changed, { expectedSha256: hash(changed) }),
		).toThrow('not the imported binding');
	});
});
