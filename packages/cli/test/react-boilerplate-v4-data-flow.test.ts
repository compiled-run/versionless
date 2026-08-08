import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	transformHomePageConnectToHooks,
	transformRepoListItemConnectToHooks,
} from '../../frameworks/react/src/react-data-flow-connect-to-hooks.ts';
import { isExpectedReactDataFlowMutationFailure } from '../src/fixture/react-boilerplate-v4-data-flow-run.ts';

const root = path.resolve(import.meta.dirname, '../../..');

describe('React Boilerplate data-flow fixture', () => {
	it('accepts only the exact reducer-injection reset-state failure', () => {
		expect(
			isExpectedReactDataFlowMutationFailure(
				'home-reducer-injection',
				'Username input-state assertion failed',
			),
		).toBe(true);
		expect(
			isExpectedReactDataFlowMutationFailure(
				'home-reducer-injection',
				'owned repository name assertion failed',
			),
		).toBe(false);
		expect(
			isExpectedReactDataFlowMutationFailure(
				'home-load-repos-dispatch',
				'Username input-state assertion failed',
			),
		).toBe(false);
	});

	it('pins the T028 baseline, synthetic payload, runtime, and existing adapter', async () => {
		const manifest = JSON.parse(
			await readFile(
				path.join(root, 'fixtures/react-boilerplate-v4-data-flow/fixture.json'),
				'utf8',
			),
		) as Record<string, any>;
		expect(manifest.baseline).toMatchObject({
			receiptDigest: '1caf9dfa24b14b83ac63ceab9ca90829346045aac690c7b95a952ae4d9e72849',
			homePageSha256: 'db0413d948d68980dd24db7660e1bd854cabcc4642ec15fff710f5c95131f232',
			repoListItemSha256: '21a570ed27af053040ce6b503f1af0c22bbdfea52284dccb47b2dc382844d867',
			packageSha256: 'a3383c3ccce6bd460952c5ac8b721ed5f7087ffc5a96713b6e9103f2ba3a8d76',
			packageLockSha256: '09a37fc1d35eb4cfaab46e0ac8c0d3f33824b300a731ec25f1e50998e9c14edb',
		});
		expect(manifest.runtime.version).toBe('24.15.0');
		expect(manifest.vite).toMatchObject({
			version: '8.0.16',
			config: 'fixtures/react-boilerplate-v4-vite8/vite.adapter.ts',
		});
		const payload = JSON.parse(
			await readFile(path.join(root, manifest.payload), 'utf8'),
		) as Array<Record<string, any>>;
		expect(payload).toHaveLength(2);
		expect(payload.map((item) => item.owner.login)).toEqual(['octocat', 'fork-owner']);
	});

	it('transforms only the two pinned application sources deterministically', async () => {
		const baseline = path.join(
			root,
			'.versionless/work/react-boilerplate-v4-vite8/target/app/containers',
		);
		const home = transformHomePageConnectToHooks(
			await readFile(path.join(baseline, 'HomePage/index.js'), 'utf8'),
		);
		const repo = transformRepoListItemConnectToHooks(
			await readFile(path.join(baseline, 'RepoListItem/index.js'), 'utf8'),
		);
		expect(home.code).toContain('useDispatch()');
		expect(home.code).toContain('useSelector(selectRepos)');
		expect(home.code).toContain('const withReducer = injectReducer({ key, reducer });');
		expect(home.code).toContain('const withSaga = injectSaga({ key, saga });');
		expect(home.code).not.toContain('useInjectReducer');
		expect(home.code).not.toContain('useInjectSaga');
		expect(repo.code).toContain('useSelector(selectCurrentUser)');
		expect(home.semanticEngine.diagnostics).toBe(0);
		expect(repo.semanticEngine.diagnostics).toBe(0);
	});
});
