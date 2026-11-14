import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import { classifySvelteDescriptor } from '../src/classify.ts';

const fixtureDir = path.join(import.meta.dirname, 'fixtures');

async function fixture(name: string): Promise<Record<string, unknown>> {
	return JSON.parse(await readFile(path.join(fixtureDir, name), 'utf8')) as Record<
		string,
		unknown
	>;
}

describe('Svelte first-class classification', () => {
	it('parks Svelte 4 in versionless and keeps Svelte 5 in frameless without claiming migration', async () => {
		const svelte4 = classifySvelteDescriptor(await fixture('svelte-4.json'));
		const svelte5 = classifySvelteDescriptor(await fixture('svelte-5.json'));
		expect(svelte4.inventory).toMatchObject({
			framework: 'svelte',
			major: 4,
			home: 'versionless',
			packageDetected: true,
			migration: { claimed: false },
		});
		expect(svelte5.inventory).toMatchObject({
			framework: 'svelte',
			major: 5,
			home: 'frameless',
			packageDetected: true,
			migration: { claimed: false },
		});
	});

	it('records declared API names rather than inferring them from major', async () => {
		const value = await fixture('svelte-4.json');
		(value.apis as { current: string[] }).current = ['$:', 'let'];
		const result = classifySvelteDescriptor(value).inventory;
		expect(result.major).toBe(4);
		expect(result.home).toBe('versionless');
		expect(result.apis.current).toEqual(['$:', 'let']);
		expect(result.migration).toEqual({ claimed: false });
	});

	it('refuses missing keys, extra keys, claims, and contradictory homes', async () => {
		const original = await fixture('svelte-4.json');
		const svelte5 = await fixture('svelte-5.json');
		const cases: Array<
			[string, Record<string, unknown>, (value: Record<string, any>) => void]
		> = [
			['missing migrationClaimed', original, (value) => delete value.migrationClaimed],
			['extra field', original, (value) => (value.supportMatrix = true)],
			['support claim', original, (value) => (value.supportClaim = true)],
			['execution request', original, (value) => (value.executionRequested = true)],
			['migration claim', original, (value) => (value.migrationClaimed = true)],
			['synthetic not true', original, (value) => (value.synthetic = false)],
			['nonportable id', original, (value) => (value.id = 'Svelte_4')],
			['unsorted apis', original, (value) => (value.apis.current = ['let', '$:'])],
			['duplicate apis', original, (value) => value.apis.current.push(value.apis.current[0])],
			['svelte 4 home contradicts major', original, (value) => (value.home = 'frameless')],
			['svelte 5 home contradicts major', svelte5, (value) => (value.home = 'versionless')],
			['unknown major', original, (value) => (value.major = 3)],
			['wrong framework', original, (value) => (value.framework = 'react')],
		];
		for (const [label, source, mutate] of cases) {
			const value = structuredClone(source);
			mutate(value);
			expect(() => classifySvelteDescriptor(value), label).toThrow();
		}
	});
});
