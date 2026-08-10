import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { describe, expect, test } from 'vitest';
import {
	calculatorPlacementPath,
	isReactCalculatorMultiplicationRed,
	mutateReactCalculatorOperate,
	runReactCalculatorAtomicPublication,
} from '../src/fixture/react-calculator-run.ts';

describe('React Calculator production runner boundaries', () => {
	test('maps npm-v1 placements into bounded nested node_modules paths', () => {
		expect(calculatorPlacementPath('/work/lane', 'react')).toBe(
			'/work/lane/node_modules/react',
		);
		expect(calculatorPlacementPath('/work/lane', 'react-scripts>webpack')).toBe(
			'/work/lane/node_modules/react-scripts/node_modules/webpack',
		);
		for (const value of ['', '..', 'react>..', '/absolute', 'react\\escape'])
			expect(() => calculatorPlacementPath('/work/lane', value)).toThrow();
	});

	test('accepts only the exact multiplication display assertion as mutation red', () => {
		expect(
			isReactCalculatorMultiplicationRed(
				`expected '.component-display > div' to have text "42", but it was "7"`,
			),
		).toBe(true);
		for (const failure of [
			`expected '.component-display > div' to have text "42", but no element matched`,
			`expected '.component-display > div' to have text "9", but it was "7"`,
			`page error at '.component-display > div' while expecting 42`,
			'network request failed',
		])
			expect(isReactCalculatorMultiplicationRed(failure)).toBe(false);
	});

	test('restores output, aggregate and trust state after injected publication failure', async () => {
		const state = { output: 'old-output', aggregate: 'old-aggregate', trust: 'old-trust' };
		await expect(
			runReactCalculatorAtomicPublication({
				snapshot: async () => ({ ...state }),
				publish: async () => {
					state.output = 'new-output';
					state.aggregate = 'new-aggregate';
					state.trust = 'staged-trust';
				},
				verify: async () => {
					throw new Error('injected verification failure');
				},
				commit: async () => {
					state.trust = 'new-trust';
				},
				restore: async (snapshot) => {
					Object.assign(state, snapshot);
				},
			}),
		).rejects.toThrow('injected verification failure');
		expect(state).toEqual({
			output: 'old-output',
			aggregate: 'old-aggregate',
			trust: 'old-trust',
		});
	});

	test('restores real output, aggregate, trust-current and prior replay bytes', async () => {
		const temporary = await mkdtemp(join(tmpdir(), 'versionless-calculator-publication-'));
		const output = join(temporary, 'output');
		const aggregate = join(temporary, 'aggregate.json');
		const trust = join(temporary, 'trust-current');
		const replay = join(temporary, 'trust-replay');
		for (const directory of [output, trust, replay])
			await mkdir(directory, { recursive: true });
		await writeFile(join(output, 'receipt.json'), 'old-output');
		await writeFile(aggregate, 'old-aggregate');
		await writeFile(join(trust, 'manifest.json'), 'old-trust');
		await writeFile(join(replay, 'manifest.json'), 'old-replay');
		await expect(
			runReactCalculatorAtomicPublication({
				snapshot: async () => ({
					output: await readFile(join(output, 'receipt.json')),
					aggregate: await readFile(aggregate),
					trust: await readFile(join(trust, 'manifest.json')),
					replay: await readFile(join(replay, 'manifest.json')),
				}),
				publish: async () => {
					await writeFile(join(output, 'receipt.json'), 'new-output');
					await writeFile(aggregate, 'new-aggregate');
					await writeFile(join(trust, 'manifest.json'), 'new-trust');
					await writeFile(join(replay, 'manifest.json'), 'new-replay');
				},
				verify: async () => {
					throw new Error('injected filesystem publication failure');
				},
				commit: async () => undefined,
				restore: async (snapshot) => {
					await writeFile(join(output, 'receipt.json'), snapshot.output);
					await writeFile(aggregate, snapshot.aggregate);
					await writeFile(join(trust, 'manifest.json'), snapshot.trust);
					await writeFile(join(replay, 'manifest.json'), snapshot.replay);
				},
			}),
		).rejects.toThrow('injected filesystem publication failure');
		expect(await readFile(join(output, 'receipt.json'), 'utf8')).toBe('old-output');
		expect(await readFile(aggregate, 'utf8')).toBe('old-aggregate');
		expect(await readFile(join(trust, 'manifest.json'), 'utf8')).toBe('old-trust');
		expect(await readFile(join(replay, 'manifest.json'), 'utf8')).toBe('old-replay');
		await rm(temporary, { recursive: true, force: true });
	});

	test('mutates only the exact repeated multiplication operation branch', () => {
		const source = 'if (operation === "x") {\n  return one.times(two).toString();\n}\n';
		expect(mutateReactCalculatorOperate(source)).toContain('return one.div(two).toString();');
		expect(() => mutateReactCalculatorOperate('return one.plus(two);')).toThrow(
			'mutation branch differs',
		);
		expect(() => mutateReactCalculatorOperate(`${source}${source}`)).toThrow(
			'mutation branch differs',
		);
	});
});
