import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	transformHomePageConnectToHooks,
	transformRepoListItemConnectToHooks,
} from '../src/react-data-flow-connect-to-hooks.ts';

const root = path.resolve(import.meta.dirname, '../../../..');
const sourceRoot = path.join(root, '.versionless/work/react-boilerplate-v4-vite8/target');
const hash = (value: string): string => createHash('sha256').update(value).digest('hex');

describe('React data-flow connect-to-hooks transforms', () => {
	it('preserves named prop-driven components and emits deterministic wrappers', async () => {
		const home = await readFile(
			path.join(sourceRoot, 'app/containers/HomePage/index.js'),
			'utf8',
		);
		const repo = await readFile(
			path.join(sourceRoot, 'app/containers/RepoListItem/index.js'),
			'utf8',
		);
		const homeResult = transformHomePageConnectToHooks(home);
		const repoResult = transformRepoListItemConnectToHooks(repo);
		expect(homeResult.edits).toHaveLength(2);
		expect(repoResult.edits).toHaveLength(2);
		expect(homeResult.code).toContain('export function HomePage({');
		expect(homeResult.code).toContain('dispatch(loadRepos())');
		expect(repoResult.code).toContain('export function RepoListItem(props)');
		expect(repoResult.code).toContain('useSelector(selectCurrentUser)');
		for (const code of [homeResult.code, repoResult.code]) {
			expect(code).not.toContain('connect(');
			expect(code).not.toContain('createStructuredSelector');
		}
		expect(transformHomePageConnectToHooks(home).targetSha256).toBe(homeResult.targetSha256);
		expect(transformRepoListItemConnectToHooks(repo).targetSha256).toBe(
			repoResult.targetSha256,
		);
	});

	it('refuses hash, import, reference, and ambiguous-span drift', async () => {
		const home = await readFile(
			path.join(sourceRoot, 'app/containers/HomePage/index.js'),
			'utf8',
		);
		const repo = await readFile(
			path.join(sourceRoot, 'app/containers/RepoListItem/index.js'),
			'utf8',
		);
		expect(() => transformHomePageConnectToHooks(`${home}\n`)).toThrow('SHA-256');
		const shadowed = repo.replace(
			"import { connect } from 'react-redux';",
			'const connect = value => value;',
		);
		expect(() =>
			transformRepoListItemConnectToHooks(shadowed, { expectedSha256: hash(shadowed) }),
		).toThrow('imported binding');
		const changedReference = home.replace(
			'dispatch(loadRepos());',
			'dispatch(loadRepos()); loadRepos();',
		);
		expect(() =>
			transformHomePageConnectToHooks(changedReference, {
				expectedSha256: hash(changedReference),
			}),
		).toThrow('reference count');
		const ambiguous = `${home}\n${home.slice(home.indexOf('const mapStateToProps'))}`;
		expect(() =>
			transformHomePageConnectToHooks(ambiguous, { expectedSha256: hash(ambiguous) }),
		).toThrow();
	});
});
