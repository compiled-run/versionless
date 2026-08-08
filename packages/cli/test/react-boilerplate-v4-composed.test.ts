import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import { isExpectedReactComposedMutationFailure } from '../src/fixture/react-boilerplate-v4-composed-run.ts';

const root = path.resolve(import.meta.dirname, '../../..');

describe('React Boilerplate cumulative fixture', () => {
	it('pins the immutable source, maintained target, dual runtime, and combined journey', async () => {
		const manifest = JSON.parse(
			await readFile(
				path.join(root, 'fixtures/react-boilerplate-v4-composed/fixture.json'),
				'utf8',
			),
		) as Record<string, any>;
		expect(manifest.sourceHashes).toEqual({
			localeToggle: '70c2ea867367b5dbd0820413f344bcd6c19729ef04d41c1fd9e12d43d72e8dfa',
			homePage: 'db0413d948d68980dd24db7660e1bd854cabcc4642ec15fff710f5c95131f232',
			repoListItem: '21a570ed27af053040ce6b503f1af0c22bbdfea52284dccb47b2dc382844d867',
			package: 'a3383c3ccce6bd460952c5ac8b721ed5f7087ffc5a96713b6e9103f2ba3a8d76',
			packageLock: '09a37fc1d35eb4cfaab46e0ac8c0d3f33824b300a731ec25f1e50998e9c14edb',
		});
		expect(manifest.targetHashes).toEqual({
			localeToggle: 'db70524e86f9a5983d18f6ad1f2d72fec14b71bd5701d66da475ff600703e9b3',
			homePage: '4d5f28e30df04e4e85e2791ee34c9e3d27e68a398ab0e400624fade4b51398c2',
			repoListItem: '5669977385fb57491fcb117cd65ffaa2a4ab86d2258bf36c7fa81ff880387517',
			package: '7fb3098e57021e790638e31677d3cbfe815087f889b708cab4e1efdc9785414a',
			packageLock: '42ffa936b19115ad380e77dcbc3800c7adf117aa560c5f678c837b7f4b09e00d',
		});
		expect(manifest.runtime).toMatchObject({ legacy: '16.20.2', target: '24.15.0' });
		expect(manifest.vite.version).toBe('8.0.16');
		expect(manifest.journey).toBe('fixtures/react-boilerplate-v4-data-flow/journey.json');
	});

	it('retains exact order traces and atomic staged publication evidence', async () => {
		const composition = JSON.parse(
			await readFile(
				path.join(
					root,
					'evidence/runs/react-boilerplate-v4-composed/artifacts/composition.json',
				),
				'utf8',
			),
		) as Record<string, unknown>;
		expect(composition).toMatchObject({
			actualOrdersExecuted: true,
			outputsEqual: true,
			publish: 'same-filesystem-staged-directory-rename',
			injectedWriteFailure: 'refused',
			stagedWritesBeforeFailure: 1,
			rollback: 'published-target-unmodified',
			failedStageCleanup: true,
		});
		expect(composition.executionTraces).toEqual([
			{
				order: 'locale-first',
				steps: ['locale-toggle', 'home-page', 'repo-list-item', 'maintained-package-lock'],
			},
			{
				order: 'data-flow-first',
				steps: ['home-page', 'repo-list-item', 'locale-toggle', 'maintained-package-lock'],
			},
		]);
	});

	it('records exactly four ordered causal mutations', async () => {
		const mutation = JSON.parse(
			await readFile(
				path.join(
					root,
					'evidence/runs/react-boilerplate-v4-composed/artifacts/mutation.json',
				),
				'utf8',
			),
		) as { mutations: Array<Record<string, unknown>> };
		expect(mutation.mutations.map((row) => row.seam)).toEqual([
			'home-reducer-injection',
			'locale-dispatch',
			'repository-load',
			'service-worker-registration',
		]);
		for (const row of mutation.mutations)
			expect(row).toMatchObject({
				result: 'intended-failure',
				restoration: 'byte-identical',
				reproduced: 'pass',
			});
	});

	it('accepts only the expected failure for each mutation seam', () => {
		expect(
			isExpectedReactComposedMutationFailure(
				'home-reducer-injection',
				'repository load assertion failed',
			),
		).toBe(true);
		expect(
			isExpectedReactComposedMutationFailure(
				'home-reducer-injection',
				'locale dispatch assertion failed',
			),
		).toBe(false);
		expect(
			isExpectedReactComposedMutationFailure(
				'locale-dispatch',
				'locale dispatch assertion failed',
			),
		).toBe(true);
		expect(
			isExpectedReactComposedMutationFailure(
				'locale-dispatch',
				'repository load assertion failed',
			),
		).toBe(false);
		expect(
			isExpectedReactComposedMutationFailure(
				'repository-load',
				'repository load assertion failed',
			),
		).toBe(true);
		expect(
			isExpectedReactComposedMutationFailure(
				'repository-load',
				'locale dispatch assertion failed',
			),
		).toBe(false);
	});
});
