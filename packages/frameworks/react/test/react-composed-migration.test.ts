import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import * as path from 'pathe';
import {
	planReactComposedMigration,
	REACT_COMPOSED_PATHS,
	type ReactComposedInputs,
} from '../src/react-composed-migration.ts';

const root = path.resolve(import.meta.dirname, '../../../..');
const original = path.join(root, '.versionless/work/react-boilerplate-v4/legacy');
const maintained = path.join(root, '.versionless/work/react-boilerplate-v4-node24/target');

async function inputs(): Promise<ReactComposedInputs> {
	return Object.fromEntries(
		await Promise.all(
			REACT_COMPOSED_PATHS.map(async (file) => [
				file,
				await readFile(path.join(original, file), 'utf8'),
			]),
		),
	) as ReactComposedInputs;
}

describe('React composed migration planning', () => {
	it('preflights every input and is order independent', async () => {
		const source = await inputs();
		const packageJson = await readFile(path.join(maintained, 'package.json'), 'utf8');
		const packageLock = await readFile(path.join(maintained, 'package-lock.json'), 'utf8');
		const localeFirst = planReactComposedMigration({
			inputs: source,
			maintainedPackage: packageJson,
			maintainedPackageLock: packageLock,
			order: 'locale-first',
		});
		const dataFirst = planReactComposedMigration({
			inputs: source,
			maintainedPackage: packageJson,
			maintainedPackageLock: packageLock,
			order: 'data-flow-first',
		});
		expect(dataFirst.outputs).toEqual(localeFirst.outputs);
		expect(localeFirst.executionTrace).toEqual([
			'locale-toggle',
			'home-page',
			'repo-list-item',
			'maintained-package-lock',
		]);
		expect(dataFirst.executionTrace).toEqual([
			'home-page',
			'repo-list-item',
			'locale-toggle',
			'maintained-package-lock',
		]);
		expect(dataFirst.executionTrace).not.toEqual(localeFirst.executionTrace);
		expect(localeFirst.edits).toBe(13);
		expect(dataFirst.edits).toBe(13);
		expect(localeFirst.targetHashes['app/containers/HomePage/index.js']).toBe(
			'4d5f28e30df04e4e85e2791ee34c9e3d27e68a398ab0e400624fade4b51398c2',
		);
		expect(localeFirst.outputs['app/containers/HomePage/index.js']).toContain(
			'const withReducer = injectReducer({ key, reducer });',
		);
	});

	it('refuses a late source mismatch without exposing outputs', async () => {
		const source = await inputs();
		source['app/containers/RepoListItem/index.js'] += '\n';
		await expect(async () =>
			planReactComposedMigration({
				inputs: source,
				maintainedPackage: await readFile(path.join(maintained, 'package.json'), 'utf8'),
				maintainedPackageLock: await readFile(
					path.join(maintained, 'package-lock.json'),
					'utf8',
				),
				order: 'locale-first',
			}),
		).rejects.toThrow('RepoListItem');
	});
});
