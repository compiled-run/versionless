import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import { classifyVueDescriptor } from '../src/classify.ts';

const fixtureDir = path.join(import.meta.dirname, 'fixtures');

async function fixture(name: string): Promise<Record<string, unknown>> {
	return JSON.parse(await readFile(path.join(fixtureDir, name), 'utf8')) as Record<
		string,
		unknown
	>;
}

describe('Vue first-class classification', () => {
	it('parks Vue 2 in versionless and keeps Vue 3 in frameless without claiming migration', async () => {
		const vue2 = classifyVueDescriptor(await fixture('vue-2.json'));
		const vue3 = classifyVueDescriptor(await fixture('vue-3.json'));
		expect(vue2.inventory).toMatchObject({
			framework: 'vue',
			major: 2,
			home: 'versionless',
			packageDetected: true,
			migration: { claimed: false },
		});
		expect(vue3.inventory).toMatchObject({
			framework: 'vue',
			major: 3,
			home: 'frameless',
			packageDetected: true,
			migration: { claimed: false },
		});
	});

	it('records declared API names rather than inferring them from major', async () => {
		const value = await fixture('vue-2.json');
		(value.apis as { current: string[] }).current = ['Options API'];
		const result = classifyVueDescriptor(value).inventory;
		expect(result.major).toBe(2);
		expect(result.home).toBe('versionless');
		expect(result.apis.current).toEqual(['Options API']);
		expect(result.migration).toEqual({ claimed: false });
	});

	it('refuses missing keys, extra keys, claims, and contradictory homes', async () => {
		const original = await fixture('vue-2.json');
		const vue3 = await fixture('vue-3.json');
		const cases: Array<
			[string, Record<string, unknown>, (value: Record<string, any>) => void]
		> = [
			['missing migrationClaimed', original, (value) => delete value.migrationClaimed],
			['extra field', original, (value) => (value.supportMatrix = true)],
			['support claim', original, (value) => (value.supportClaim = true)],
			['execution request', original, (value) => (value.executionRequested = true)],
			['migration claim', original, (value) => (value.migrationClaimed = true)],
			['synthetic not true', original, (value) => (value.synthetic = false)],
			['nonportable id', original, (value) => (value.id = 'Vue_2')],
			[
				'unsorted apis',
				original,
				(value) => (value.apis.current = ['Vue 2 SFC', 'Options API']),
			],
			['duplicate apis', original, (value) => value.apis.current.push(value.apis.current[0])],
			['vue 2 home contradicts major', original, (value) => (value.home = 'frameless')],
			['vue 3 home contradicts major', vue3, (value) => (value.home = 'versionless')],
			['unknown major', original, (value) => (value.major = 1)],
			['wrong framework', original, (value) => (value.framework = 'react')],
		];
		for (const [label, source, mutate] of cases) {
			const value = structuredClone(source);
			mutate(value);
			expect(() => classifyVueDescriptor(value), label).toThrow();
		}
	});
});
