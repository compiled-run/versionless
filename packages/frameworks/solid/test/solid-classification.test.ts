import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import { classifySolidDescriptor } from '../src/classify.ts';

const fixtureDir = path.join(import.meta.dirname, 'fixtures');

async function fixture(name: string): Promise<Record<string, unknown>> {
	return JSON.parse(await readFile(path.join(fixtureDir, name), 'utf8')) as Record<
		string,
		unknown
	>;
}

describe('Solid first-class classification', () => {
	it('records Solid 1 and Solid 2 as frameless without claiming migration', async () => {
		const solid1 = classifySolidDescriptor(await fixture('solid-1.json'));
		const solid2 = classifySolidDescriptor(await fixture('solid-2.json'));
		expect(solid1.inventory).toMatchObject({
			framework: 'solid',
			major: 1,
			home: 'frameless',
			packageDetected: true,
			migration: { claimed: false },
		});
		expect(solid2.inventory).toMatchObject({
			framework: 'solid',
			major: 2,
			home: 'frameless',
			packageDetected: true,
			migration: { claimed: false },
		});
		expect(solid1.inventory.apis.legacy).toEqual([]);
		expect(solid2.inventory.apis.legacy).toEqual(['attr:value', 'produce', 'solid-js/store']);
	});

	it('records declared API names rather than inferring them from major', async () => {
		const value = await fixture('solid-1.json');
		(value.apis as { current: string[] }).current = ['createSignal'];
		const result = classifySolidDescriptor(value).inventory;
		expect(result.major).toBe(1);
		expect(result.apis.current).toEqual(['createSignal']);
		expect(result.migration).toEqual({ claimed: false });
	});

	it('refuses missing keys, extra keys, claims, and contradictory homes', async () => {
		const original = await fixture('solid-1.json');
		const cases: Array<[string, (value: Record<string, any>) => void]> = [
			['missing migrationClaimed', (value) => delete value.migrationClaimed],
			['extra field', (value) => (value.supportMatrix = true)],
			['support claim', (value) => (value.supportClaim = true)],
			['execution request', (value) => (value.executionRequested = true)],
			['migration claim', (value) => (value.migrationClaimed = true)],
			['synthetic not true', (value) => (value.synthetic = false)],
			['nonportable id', (value) => (value.id = 'Solid_1')],
			['unsorted apis', (value) => (value.apis.current = ['untrack', 'createSignal'])],
			['duplicate apis', (value) => value.apis.current.push(value.apis.current[0])],
			['home contradicts major', (value) => (value.home = 'versionless')],
			['unknown major', (value) => (value.major = 3)],
			['wrong framework', (value) => (value.framework = 'react')],
		];
		for (const [label, mutate] of cases) {
			const value = structuredClone(original);
			mutate(value);
			expect(() => classifySolidDescriptor(value), label).toThrow();
		}
	});
});
