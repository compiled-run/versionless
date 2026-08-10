import { describe, expect, it } from 'vitest';
import { main } from '../src/fixture/react-boilerplate-v4-zero-sw-run.ts';

describe('React Boilerplate v4 zero-SW profile', () => {
	it('passes immutable strip-only preflight', async () => {
		await expect(main(['--preflight', '--namespace', 't693'])).resolves.toBeUndefined();
	});

	it('rejects incomplete modes', async () => {
		await expect(main([])).rejects.toThrow('requires');
		await expect(main(['--run', '--namespace', 'wrong'])).rejects.toThrow('requires');
	});
});
