import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import { classifyQwikDescriptor } from '../src/classify.ts';

const fixtureDir = path.join(import.meta.dirname, 'fixtures');

async function fixture(name: string): Promise<Record<string, unknown>> {
	return JSON.parse(await readFile(path.join(fixtureDir, name), 'utf8')) as Record<
		string,
		unknown
	>;
}

describe('Qwik first-class classification', () => {
	it('parks Qwik 1 in versionless and keeps Qwik 2 in frameless without claiming migration', async () => {
		const qwik1 = classifyQwikDescriptor(await fixture('qwik-1.json'));
		const qwik2 = classifyQwikDescriptor(await fixture('qwik-2.json'));
		expect(qwik1.inventory).toMatchObject({
			framework: 'qwik',
			major: 1,
			home: 'versionless',
			packageDetected: true,
			migration: { claimed: false },
		});
		expect(qwik2.inventory).toMatchObject({
			framework: 'qwik',
			major: 2,
			home: 'frameless',
			packageDetected: true,
			migration: { claimed: false },
		});
	});

	it('records declared API names rather than inferring them from major', async () => {
		const value = await fixture('qwik-1.json');
		(value.apis as { current: string[] }).current = ['@builder.io/qwik'];
		const result = classifyQwikDescriptor(value).inventory;
		expect(result.major).toBe(1);
		expect(result.home).toBe('versionless');
		expect(result.apis.current).toEqual(['@builder.io/qwik']);
		expect(result.migration).toEqual({ claimed: false });
	});

	it('refuses missing keys, extra keys, claims, and contradictory homes', async () => {
		const original = await fixture('qwik-1.json');
		const qwik2 = await fixture('qwik-2.json');
		const cases: Array<
			[string, Record<string, unknown>, (value: Record<string, any>) => void]
		> = [
			['missing migrationClaimed', original, (value) => delete value.migrationClaimed],
			['extra field', original, (value) => (value.supportMatrix = true)],
			['support claim', original, (value) => (value.supportClaim = true)],
			['execution request', original, (value) => (value.executionRequested = true)],
			['migration claim', original, (value) => (value.migrationClaimed = true)],
			['synthetic not true', original, (value) => (value.synthetic = false)],
			['nonportable id', original, (value) => (value.id = 'Qwik_1')],
			[
				'unsorted apis',
				original,
				(value) => (value.apis.current = ['@qwik.dev/core', '@builder.io/qwik']),
			],
			['duplicate apis', original, (value) => value.apis.current.push(value.apis.current[0])],
			['qwik 1 home contradicts major', original, (value) => (value.home = 'frameless')],
			['qwik 2 home contradicts major', qwik2, (value) => (value.home = 'versionless')],
			['unknown major', original, (value) => (value.major = 3)],
			['wrong framework', original, (value) => (value.framework = 'react')],
		];
		for (const [label, source, mutate] of cases) {
			const value = structuredClone(source);
			mutate(value);
			expect(() => classifyQwikDescriptor(value), label).toThrow();
		}
	});
});
