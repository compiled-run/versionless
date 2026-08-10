import { describe, expect, test } from 'vitest';
import {
	REACT_GRAPHIQL_013_SCHEMA,
	canonicalize,
	parseReactGraphiQL013Receipt,
	reactGraphiQL013AggregateMember,
	sha256,
} from '../src/index.ts';

const hex = (character: string): string => character.repeat(64);
const capture = (logicalRun: string) => ({
	logicalRun,
	outcome: 'pass',
	assertions: { passed: 1, failed: 0 },
	intendedFailures: 0,
	interactions: [
		...Array.from({ length: 6 }, () => ({ kind: 'click', selector: '.x' })),
		...Array.from({ length: 2 }, () => ({ kind: 'type', selector: '.x' })),
		...Array.from({ length: 5 }, () => ({ kind: 'press', selector: '.x' })),
		...Array.from({ length: 2 }, () => ({ kind: 'drag', selector: '.x' })),
	],
	eventCounts: { click: 6, keydown: 20, mousedown: 2, mousemove: 2, mouseup: 2 },
	navigations: ['/'],
	network: [{ method: 'GET', path: '/', status: 200 }],
	failedRequests: 0,
	pageErrors: 0,
	consoleErrors: 0,
	captures: [
		{
			kind: 'html',
			path: `evidence/runs/react-graphiql-react15-to-vite8/captures/${logicalRun}/01.html`,
			sha256: hex('a'),
		},
		{
			kind: 'png',
			path: `evidence/runs/react-graphiql-react15-to-vite8/captures/${logicalRun}/01.png`,
			sha256: hex('b'),
		},
	],
});
const run = (lane: 'baseline' | 'target', pass: 1 | 2, logicalRun = `${lane}-green-${pass}`) => ({
	lane,
	pass,
	result: 'pass',
	interactions: [
		['type', '.query-editor .CodeMirror textarea'],
		['type', '.variable-editor .CodeMirror textarea'],
		['keyboard-execute', '.query-editor .CodeMirror textarea'],
		['click', '.toolbar-button[title="Show History"]'],
		['click', '.history-contents .history-query:last-child'],
		['click', '.docExplorerShow'],
		['click', '.doc-category-item:first-child'],
		['drag', '.variable-editor-title->.resultWrap'],
		['drag', '.docExplorerResizer->.queryWrap'],
	].map(([kind, selector]) => ({ kind, selector })),
	journey1: {
		id: 'abc123',
		isTest: true,
		serializedBoolean: '{"boolean":true}',
		post: '/graphql',
		urlReload: true,
	},
	journey2: {
		historyRestore: true,
		docsQueryFields: true,
		realVariableDrag: true,
		realDocsDrag: true,
		reloadPersistence: true,
	},
	graphqlPosts: [
		{
			path: '/graphql',
			method: 'POST',
			status: 200,
			body: JSON.stringify({
				query: 'query Inspect($flag:Boolean){ id isTest hasArgs(boolean:$flag) }',
				variables: { flag: true },
			}),
		},
		{
			path: '/graphql',
			method: 'POST',
			status: 200,
			body: JSON.stringify({
				query: 'query Inspect($flag:Boolean){ id isTest hasArgs(boolean:$flag) }',
				variables: { flag: true },
			}),
		},
		{
			path: '/graphql',
			method: 'POST',
			status: 200,
			body: JSON.stringify({ query: '{ id }' }),
		},
	],
	completedRequests: [
		'/',
		'/graphiql.css',
		lane === 'baseline' ? '/graphiql.js' : '/graphiql-vite.js',
		'/vendor/es6-promise.auto.min.js',
		'/vendor/fetch.min.js',
		lane === 'baseline' ? '/vendor/react.min.js' : '/vendor/react-18.3.1.js',
		lane === 'baseline' ? '/vendor/react-dom.min.js' : '/vendor/react-dom-18.3.1.js',
		'/graphql',
	].map((path) => ({ path, status: 200 })),
	attemptedNonLoopback: [],
	successfulNonLoopback: 0,
	pageErrors: [],
	consoleErrors: [],
	witness: capture(logicalRun),
});

function valid(): Record<string, any> {
	const inventory = [{ path: 'graphiql.js', sha256: hex('c') }];
	const runs = [run('baseline', 1), run('baseline', 2), run('target', 1), run('target', 2)];
	const red = {
		...capture('target-mutation-red-3'),
		outcome: 'expected-red',
		intendedFailures: 1,
		exactError: 'expected GraphiQL result isTest true, but it was false',
		applicationPosts: [
			{
				path: '/graphql',
				method: 'POST',
				status: 200,
				body: JSON.stringify({
					query: 'query Inspect($flag:Boolean){ id isTest hasArgs(boolean:$flag) }',
					variables: { flag: true },
				}),
			},
		],
		locality: {
			attemptedNonLoopback: 0,
			successfulNonLoopback: 0,
			failedRequests: 0,
			serviceWorkerRegistrations: 0,
			controllers: 0,
			caches: 0,
			pageErrors: 0,
			consoleErrors: 0,
		},
	};
	const artifactNames = [
		'assets.json',
		'build.json',
		'dependencies.json',
		'licenses.json',
		'locality.json',
		'mutation.json',
		'policy.json',
		'privacy.json',
		'provenance.json',
		'receipt.md',
		'sbom.json',
		'witness.json',
		'witness-01.json',
		'witness-02.json',
		'witness-03.json',
		'witness-04.json',
		'witness-mutation-red.json',
		'witness-restored.json',
		'build-output/baseline-graphiql.js',
		'build-output/baseline-graphiql.css',
		'build-output/target-graphiql-vite.js',
		'build-output/target-graphiql.css',
		...[
			'baseline-green-1',
			'baseline-green-2',
			'target-green-1',
			'target-green-2',
			'target-mutation-red-3',
			'target-restored-3',
		].flatMap((name) => [`captures/${name}/01.html`, `captures/${name}/01.png`]),
	].sort();
	const receipt: Record<string, any> = {
		schemaVersion: REACT_GRAPHIQL_013_SCHEMA,
		result: 'pass',
		counted: false,
		artifacts: artifactNames.map((name) => ({
			path: `evidence/runs/react-graphiql-react15-to-vite8/${name}`,
			sha256: hex('d'),
		})),
		build: {
			baseline: {
				runtime: '16.20.2',
				bundler: 'browserify-16.2.3',
				digests: [hex('e'), hex('e')],
				inventories: [structuredClone(inventory), structuredClone(inventory)],
			},
			target: {
				runtime: '24.15.0',
				bundler: 'vite-8.0.16',
				digests: [hex('f'), hex('f')],
				inventories: [structuredClone(inventory), structuredClone(inventory)],
			},
			tools: {
				yarnBin: '148e19db309ec9eaf7720b28df811337906eea8a1758deaa54afee60a6305e04',
				yarnCli: '443ed69e76443b89afddccfc9faec1ff16eb5e500979cc079c696dec4c3d94ee',
				yarnManifest: '9533b84eaaeea708ab99bcf92772bc81c7389f90a04f8b0188c163f9b3b621c3',
				viteBin: 'fa03478846d229651a3c6aa64833ba2c6cbf580a798b92bd8f47c7480bafb5d8',
				viteManifest: 'a2b943431b51bfcc2e9386eecf8b4b3f6e4bf443e56d17b1f4c8495a61b4050c',
				pnpmLock: '71fb680c6febb2024b8117efadf3ca0641fafa1cc076a08a126724a1b337e166',
				node16: '83325958463d59cb0b16433eefab0a03fd1ce7d565a27e0274f507b1f3839a6e',
				node24: '3200fbd9f7fd4410426dd541e10d1ab829d3472f270d743c7fabd1696c03fe32',
				chromium: 'a46b3b1e63163fa2d2437fb6ae967cb5a73b50050bca32f1964e6129b6228244',
			},
		},
		witness: {
			directLinkedWitness: true,
			runs,
			successfulNonLoopback: 0,
			serviceWorkerRegistrations: 0,
			serviceWorkerControllers: 0,
			serviceWorkerCaches: 0,
		},
		mutation: {
			red: true,
			redReason: 'graphiql-isTest-true-red',
			exactFailure: 'expected GraphiQL result isTest true, but it was false',
			green: true,
			originalSourceSha256: hex('1'),
			restoredSourceSha256: hex('1'),
			originalBuildDigest: hex('f'),
			restoredBuildDigest: hex('f'),
			mutatedBuildDigest: hex('2'),
			redWitnessReceipt: red,
			restoredRun: run('target', 2, 'target-restored-3'),
		},
		nonclaims: [
			'not certification',
			'not signer authenticity',
			'not OS-wide isolation',
			'uncounted pending Judge',
			'not legal or compliance opinion',
			'no SLSA level claimed',
			'React15-only enzyme-adapter-react-15 and react-test-renderer test stack is retained but incompatible/not-tested on the React18 browser target',
		],
		integrity: { algorithm: 'sha256', authenticity: 'not-established', canonicalDigest: '' },
	};
	receipt.integrity.canonicalDigest = sha256(canonicalize(receipt));
	return receipt;
}

function reseal(receipt: Record<string, any>): void {
	receipt.integrity.canonicalDigest = '';
	receipt.integrity.canonicalDigest = sha256(canonicalize(receipt));
}

describe('GraphiQL production receipt', () => {
	test('accepts exact uncounted 2+2 build/Witness/mutation semantics', () => {
		const receipt = parseReactGraphiQL013Receipt(valid());
		expect(reactGraphiQL013AggregateMember(receipt.integrity.canonicalDigest)).toMatchObject({
			id: 'react-graphiql-013',
			counted: false,
			digest: receipt.integrity.canonicalDigest,
		});
	});

	test('rejects semantic tampering even when the canonical envelope is resealed', () => {
		for (const mutate of [
			(receipt: Record<string, any>) => (receipt.counted = true),
			(receipt: Record<string, any>) =>
				(receipt.build.target.inventories[1][0].sha256 = hex('3')),
			(receipt: Record<string, any>) =>
				(receipt.witness.runs[0].attemptedNonLoopback = ['https://cdn.example/']),
			(receipt: Record<string, any>) => (receipt.mutation.mutatedBuildDigest = hex('f')),
			(receipt: Record<string, any>) =>
				(receipt.mutation.redWitnessReceipt.exactError = 'wrong'),
			(receipt: Record<string, any>) =>
				(receipt.artifacts[1].path = receipt.artifacts[0].path),
		]) {
			const receipt = valid();
			mutate(receipt);
			reseal(receipt);
			expect(() => parseReactGraphiQL013Receipt(receipt)).toThrow();
		}
	});
});
