import { createHash } from 'node:crypto';
import { transformReactConnectToHooks } from './react-connect-to-hooks.ts';
import {
	transformHomePageConnectToHooks,
	transformRepoListItemConnectToHooks,
} from './react-data-flow-connect-to-hooks.ts';

export const REACT_COMPOSED_PATHS = [
	'app/containers/LocaleToggle/index.js',
	'app/containers/HomePage/index.js',
	'app/containers/RepoListItem/index.js',
	'package.json',
	'package-lock.json',
] as const;

export type ReactComposedPath = (typeof REACT_COMPOSED_PATHS)[number];
export type ReactComposedInputs = Record<ReactComposedPath, string>;
export type ReactComposedOrder = 'locale-first' | 'data-flow-first';
export type ReactComposedStep =
	| 'locale-toggle'
	| 'home-page'
	| 'repo-list-item'
	| 'maintained-package-lock';

export const REACT_COMPOSED_EXECUTION_ORDERS: Record<
	ReactComposedOrder,
	readonly ReactComposedStep[]
> = {
	'locale-first': ['locale-toggle', 'home-page', 'repo-list-item', 'maintained-package-lock'],
	'data-flow-first': ['home-page', 'repo-list-item', 'locale-toggle', 'maintained-package-lock'],
};

const sourceHashes: Record<ReactComposedPath, string> = {
	'app/containers/LocaleToggle/index.js':
		'70c2ea867367b5dbd0820413f344bcd6c19729ef04d41c1fd9e12d43d72e8dfa',
	'app/containers/HomePage/index.js':
		'db0413d948d68980dd24db7660e1bd854cabcc4642ec15fff710f5c95131f232',
	'app/containers/RepoListItem/index.js':
		'21a570ed27af053040ce6b503f1af0c22bbdfea52284dccb47b2dc382844d867',
	'package.json': 'a3383c3ccce6bd460952c5ac8b721ed5f7087ffc5a96713b6e9103f2ba3a8d76',
	'package-lock.json': '09a37fc1d35eb4cfaab46e0ac8c0d3f33824b300a731ec25f1e50998e9c14edb',
};

export const REACT_COMPOSED_TARGET_HASHES: Record<ReactComposedPath, string> = {
	'app/containers/LocaleToggle/index.js':
		'db70524e86f9a5983d18f6ad1f2d72fec14b71bd5701d66da475ff600703e9b3',
	'app/containers/HomePage/index.js':
		'9132cb8b6ab4af9c88499ae4daa6783229a8d4898266f2953d0bc99a5ff168c1',
	'app/containers/RepoListItem/index.js':
		'5669977385fb57491fcb117cd65ffaa2a4ab86d2258bf36c7fa81ff880387517',
	'package.json': '7fb3098e57021e790638e31677d3cbfe815087f889b708cab4e1efdc9785414a',
	'package-lock.json': '42ffa936b19115ad380e77dcbc3800c7adf117aa560c5f678c837b7f4b09e00d',
};

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

function assertExactInputs(inputs: ReactComposedInputs): void {
	for (const file of REACT_COMPOSED_PATHS)
		if (sha256(inputs[file]) !== sourceHashes[file])
			throw new Error(`Refused: composed source SHA-256 mismatch for ${file}`);
}

function assertMaintainedPackageResult(packageJson: string, packageLock: string): void {
	if (
		sha256(packageJson) !== REACT_COMPOSED_TARGET_HASHES['package.json'] ||
		sha256(packageLock) !== REACT_COMPOSED_TARGET_HASHES['package-lock.json']
	)
		throw new Error('Refused: proven maintained package/lock result changed');
	const manifest = JSON.parse(packageJson) as {
		dependencies?: Record<string, string>;
		devDependencies?: Record<string, string>;
	};
	const lock = JSON.parse(packageLock) as {
		lockfileVersion?: number;
		dependencies?: Record<string, { version?: string }>;
	};
	if (
		manifest.dependencies?.['react-redux'] !== '7.1.3' ||
		manifest.devDependencies?.webpack !== '4.47.0' ||
		manifest.devDependencies?.['terser-webpack-plugin'] !== '1.4.6' ||
		lock.lockfileVersion !== 1 ||
		lock.dependencies?.['react-redux']?.version !== '7.1.3'
	)
		throw new Error('Refused: maintained dependency closure mismatch');
}

export function planReactComposedMigration(options: {
	inputs: ReactComposedInputs;
	maintainedPackage: string;
	maintainedPackageLock: string;
	order: ReactComposedOrder;
}) {
	// No output is exposed until every source and maintained-result precondition passes.
	assertExactInputs(options.inputs);
	assertMaintainedPackageResult(options.maintainedPackage, options.maintainedPackageLock);
	const outputs = { ...options.inputs };
	const executionTrace: ReactComposedStep[] = [];
	let edits = 0;
	let semanticEngine:
		| ReturnType<typeof transformReactConnectToHooks>['semanticEngine']
		| undefined;
	const executeStep = (step: ReactComposedStep): void => {
		switch (step) {
			case 'locale-toggle': {
				const result = transformReactConnectToHooks(
					options.inputs['app/containers/LocaleToggle/index.js'],
				);
				outputs['app/containers/LocaleToggle/index.js'] = result.code;
				edits += result.edits.length;
				semanticEngine = result.semanticEngine;
				break;
			}
			case 'home-page': {
				const result = transformHomePageConnectToHooks(
					options.inputs['app/containers/HomePage/index.js'],
				);
				outputs['app/containers/HomePage/index.js'] = result.code;
				edits += result.edits.length;
				break;
			}
			case 'repo-list-item': {
				const result = transformRepoListItemConnectToHooks(
					options.inputs['app/containers/RepoListItem/index.js'],
				);
				outputs['app/containers/RepoListItem/index.js'] = result.code;
				edits += result.edits.length;
				break;
			}
			case 'maintained-package-lock':
				outputs['package.json'] = options.maintainedPackage;
				outputs['package-lock.json'] = options.maintainedPackageLock;
				edits += 2;
		}
		executionTrace.push(step);
	};
	for (const step of REACT_COMPOSED_EXECUTION_ORDERS[options.order]) executeStep(step);
	if (!semanticEngine) throw new Error('Refused: locale transform was not executed');
	for (const file of REACT_COMPOSED_PATHS)
		if (sha256(outputs[file]) !== REACT_COMPOSED_TARGET_HASHES[file])
			throw new Error(`Refused: composed target SHA-256 mismatch for ${file}`);
	return {
		outputs,
		order: options.order,
		executionTrace,
		sourceHashes: Object.fromEntries(
			REACT_COMPOSED_PATHS.map((file) => [file, sha256(options.inputs[file])]),
		),
		targetHashes: Object.fromEntries(
			REACT_COMPOSED_PATHS.map((file) => [file, sha256(outputs[file])]),
		),
		edits,
		semanticEngine,
	};
}
