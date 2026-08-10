import { readFile, readdir } from 'node:fs/promises';
import { charIn, createRegExp } from 'magic-regexp';
import { isAbsolute, join, normalize, relative } from 'pathe';
import { encodeParam, joinURL } from 'ufo';
import { canonicalize, sha256 } from './canonicalize.ts';

export const REACT_GRAPHIQL_013_SCHEMA = 'versionless.react-graphiql-013-run.v1' as const;
export const REACT_GRAPHIQL_013_RECEIPT_PATH =
	'evidence/runs/react-graphiql-react15-to-vite8/receipt.json' as const;
const evidencePrefix = 'evidence/runs/react-graphiql-react15-to-vite8/';
const lowerHex64 = createRegExp(
	charIn('0123456789').from('a', 'f').times(64).at.lineStart().at.lineEnd(),
);
const compare = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);
const npmPurl = (name: string, version: string): string => {
	const encode = (value: string) => encodeParam(value).replaceAll('@', '%40');
	const pieces = name.startsWith('@') ? name.slice(1).split('/') : [name];
	const encodedName = name.startsWith('@')
		? joinURL(`%40${encode(pieces[0] ?? '')}`, encode(pieces[1] ?? ''))
		: encode(name);
	return `pkg:npm/${encodedName}@${encode(version)}`;
};

export type ReactGraphiQL013Receipt = {
	schemaVersion: typeof REACT_GRAPHIQL_013_SCHEMA;
	result: 'pass';
	counted: false;
	artifacts: Array<{ path: string; sha256: string }>;
	build: Record<string, unknown> & {
		baseline: {
			runtime: '16.20.2';
			bundler: 'browserify-16.2.3';
			digests: [string, string];
			inventories: unknown[];
		};
		target: {
			runtime: '24.15.0';
			bundler: 'vite-8.0.16';
			digests: [string, string];
			inventories: unknown[];
		};
	};
	witness: Record<string, unknown> & {
		directLinkedWitness: true;
		runs: Array<Record<string, unknown>>;
		successfulNonLoopback: 0;
		serviceWorkerRegistrations: 0;
	};
	mutation: Record<string, unknown>;
	nonclaims: string[];
	integrity: { algorithm: 'sha256'; authenticity: 'not-established'; canonicalDigest: string };
};

function object(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`GraphiQL receipt ${label} differs`);
	return value as Record<string, unknown>;
}

function digest(value: unknown, label: string): string {
	if (typeof value !== 'string' || !lowerHex64.test(value))
		throw new Error(`GraphiQL receipt ${label} digest differs`);
	return value;
}

function validateInventory(value: unknown, label: string): void {
	if (!Array.isArray(value) || value.length === 0)
		throw new Error(`GraphiQL receipt ${label} inventory differs`);
	const paths = value.map((item) => {
		const row = object(item, `${label} inventory row`);
		if (
			typeof row.path !== 'string' ||
			!row.path ||
			normalize(row.path) !== row.path ||
			isAbsolute(row.path)
		)
			throw new Error(`GraphiQL receipt ${label} inventory path differs`);
		digest(row.sha256, `${label} inventory`);
		return row.path;
	});
	if (
		new Set(paths).size !== paths.length ||
		canonicalize(paths) !== canonicalize([...paths].sort(compare))
	)
		throw new Error(`GraphiQL receipt ${label} inventory ordering differs`);
}

function validateProjectedWitness(value: unknown, expected: 'pass' | 'expected-red'): void {
	const projection = object(value, 'Witness projection');
	const assertions = object(projection.assertions, 'Witness assertions');
	if (
		projection.outcome !== expected ||
		typeof projection.logicalRun !== 'string' ||
		!Array.isArray(projection.interactions) ||
		!Array.isArray(projection.navigations) ||
		!Array.isArray(projection.network) ||
		projection.failedRequests !== 0 ||
		projection.pageErrors !== 0 ||
		projection.consoleErrors !== 0 ||
		assertions.failed !== 0 ||
		typeof assertions.passed !== 'number' ||
		Number(assertions.passed) < 0 ||
		projection.intendedFailures !== (expected === 'expected-red' ? 1 : 0) ||
		(expected === 'expected-red' &&
			projection.exactError !== 'expected GraphiQL result isTest true, but it was false')
	)
		throw new Error('GraphiQL normalized Witness projection differs');
	const eventCounts = object(projection.eventCounts, 'Witness event counts');
	const minimum =
		expected === 'pass'
			? { click: 6, keydown: 20, mousedown: 2, mousemove: 2, mouseup: 2 }
			: { keydown: 1 };
	if (Object.entries(minimum).some(([name, count]) => Number(eventCounts[name]) < count))
		throw new Error('GraphiQL Witness tracked event evidence differs');
	if (
		(projection.network as Array<unknown>).some(
			(row) => object(row, 'Witness request').status !== 200,
		)
	)
		throw new Error('GraphiQL Witness HTTP status evidence differs');
	const projectedInteractions = projection.interactions as Array<Record<string, unknown>>;
	const expectedInteractionMinimum =
		expected === 'pass'
			? { click: 6, type: 2, press: 5, drag: 2 }
			: { click: 2, type: 2, press: 3 };
	if (
		Object.entries(expectedInteractionMinimum).some(
			([kind, count]) =>
				projectedInteractions.filter((row) => row.kind === kind).length < count,
		)
	)
		throw new Error('GraphiQL Witness interaction evidence differs');
	if (expected === 'expected-red') {
		const posts = projection.applicationPosts;
		const locality = object(projection.locality, 'mutation-red locality');
		if (!Array.isArray(posts) || posts.length !== 1)
			throw new Error('GraphiQL mutation-red POST count differs');
		const post = object(posts[0], 'mutation-red POST');
		const body = object(JSON.parse(String(post.body)), 'mutation-red POST body');
		if (
			post.path !== '/graphql' ||
			post.method !== 'POST' ||
			post.status !== 200 ||
			body.query !== 'query Inspect($flag:Boolean){ id isTest hasArgs(boolean:$flag) }' ||
			canonicalize(body.variables) !== canonicalize({ flag: true }) ||
			Object.values(locality).some((count) => count !== 0)
		)
			throw new Error('GraphiQL mutation-red causal POST/locality differs');
	}
	const captures = projection.captures;
	if (!Array.isArray(captures) || captures.length !== 2)
		throw new Error('GraphiQL Witness capture inventory differs');
	const kinds = captures.map((value) => object(value, 'capture'));
	if (
		kinds.filter((row) => row.kind === 'html').length !== 1 ||
		kinds.filter((row) => row.kind === 'png').length !== 1 ||
		kinds.some(
			(row) =>
				typeof row.path !== 'string' ||
				!row.path.startsWith(`${evidencePrefix}captures/`) ||
				!lowerHex64.test(String(row.sha256)),
		)
	)
		throw new Error('GraphiQL Witness capture binding differs');
}

function validateRun(value: unknown, lane: 'baseline' | 'target', pass: 1 | 2): void {
	const run = object(value, 'Witness run');
	const journey1 = object(run.journey1, 'Journey 1');
	const journey2 = object(run.journey2, 'Journey 2');
	const posts = Array.isArray(run.graphqlPosts)
		? run.graphqlPosts.map((post) => object(post, 'POST'))
		: [];
	const applicationPosts = posts.filter(
		(post) => !String(post.body).includes('IntrospectionQuery'),
	);
	const parsedApplications = applicationPosts.map((post) =>
		object(JSON.parse(String(post.body)), 'POST body'),
	);
	const completed = Array.isArray(run.completedRequests)
		? run.completedRequests.map((row) => object(row, 'completed request'))
		: [];
	const essentialPaths = [
		'/',
		'/graphiql.css',
		lane === 'baseline' ? '/graphiql.js' : '/graphiql-vite.js',
		'/vendor/es6-promise.auto.min.js',
		'/vendor/fetch.min.js',
		lane === 'baseline' ? '/vendor/react.min.js' : '/vendor/react-18.3.1.js',
		lane === 'baseline' ? '/vendor/react-dom.min.js' : '/vendor/react-dom-18.3.1.js',
		'/graphql',
	];
	const expectedInteractions = [
		['type', '.query-editor .CodeMirror textarea'],
		['type', '.variable-editor .CodeMirror textarea'],
		['keyboard-execute', '.query-editor .CodeMirror textarea'],
		['click', '.toolbar-button[title="Show History"]'],
		['click', '.history-contents .history-query:last-child'],
		['click', '.docExplorerShow'],
		['click', '.doc-category-item:first-child'],
		['drag', '.variable-editor-title->.resultWrap'],
		['drag', '.docExplorerResizer->.queryWrap'],
	].map(([kind, selector]) => ({ kind, selector }));
	if (
		run.lane !== lane ||
		run.pass !== pass ||
		run.result !== 'pass' ||
		journey1.id !== 'abc123' ||
		journey1.isTest !== true ||
		journey1.serializedBoolean !== '{"boolean":true}' ||
		journey1.post !== '/graphql' ||
		journey1.urlReload !== true ||
		journey2.historyRestore !== true ||
		journey2.docsQueryFields !== true ||
		journey2.realVariableDrag !== true ||
		journey2.realDocsDrag !== true ||
		journey2.reloadPersistence !== true ||
		posts.length < 3 ||
		applicationPosts.length !== 3 ||
		parsedApplications.filter(
			(post) =>
				post.query === 'query Inspect($flag:Boolean){ id isTest hasArgs(boolean:$flag) }' &&
				canonicalize(post.variables) === canonicalize({ flag: true }),
		).length !== 2 ||
		parsedApplications.filter(
			(post) =>
				post.query === '{ id }' &&
				(post.variables === undefined ||
					post.variables === null ||
					canonicalize(post.variables) === canonicalize({})),
		).length !== 1 ||
		posts.some(
			(post) => post.path !== '/graphql' || post.method !== 'POST' || post.status !== 200,
		) ||
		canonicalize(run.interactions) !== canonicalize(expectedInteractions) ||
		completed.some((row) => row.status !== 200) ||
		essentialPaths.some(
			(path) => !completed.some((row) => row.path === path && row.status === 200),
		) ||
		!Array.isArray(run.attemptedNonLoopback) ||
		run.attemptedNonLoopback.length !== 0 ||
		run.successfulNonLoopback !== 0 ||
		!Array.isArray(run.pageErrors) ||
		run.pageErrors.length !== 0 ||
		!Array.isArray(run.consoleErrors) ||
		run.consoleErrors.length !== 0
	)
		throw new Error('GraphiQL browser journey evidence differs');
	validateProjectedWitness(run.witness, 'pass');
}

export function parseReactGraphiQL013Receipt(value: unknown): ReactGraphiQL013Receipt {
	const receipt = object(value, 'root') as ReactGraphiQL013Receipt;
	const baseline = receipt.build?.baseline;
	const target = receipt.build?.target;
	if (
		receipt.schemaVersion !== REACT_GRAPHIQL_013_SCHEMA ||
		receipt.result !== 'pass' ||
		receipt.counted !== false ||
		baseline?.runtime !== '16.20.2' ||
		baseline.bundler !== 'browserify-16.2.3' ||
		target?.runtime !== '24.15.0' ||
		target.bundler !== 'vite-8.0.16'
	)
		throw new Error('GraphiQL receipt production evidence differs');
	for (const [label, build] of [
		['baseline', baseline],
		['target', target],
	] as const) {
		if (!Array.isArray(build.digests) || build.digests.length !== 2)
			throw new Error(`GraphiQL receipt ${label} build repetitions differ`);
		digest(build.digests[0], `${label} build`);
		digest(build.digests[1], `${label} build`);
		if (
			build.digests[0] !== build.digests[1] ||
			!Array.isArray(build.inventories) ||
			build.inventories.length !== 2
		)
			throw new Error(`GraphiQL receipt ${label} build stability differs`);
		validateInventory(build.inventories[0], `${label} first build`);
		validateInventory(build.inventories[1], `${label} second build`);
		if (canonicalize(build.inventories[0]) !== canonicalize(build.inventories[1]))
			throw new Error(`GraphiQL receipt ${label} build inventories differ`);
	}
	const tools = object(receipt.build.tools, 'build tools');
	const exactTools = {
		yarnBin: '148e19db309ec9eaf7720b28df811337906eea8a1758deaa54afee60a6305e04',
		yarnCli: '443ed69e76443b89afddccfc9faec1ff16eb5e500979cc079c696dec4c3d94ee',
		yarnManifest: '9533b84eaaeea708ab99bcf92772bc81c7389f90a04f8b0188c163f9b3b621c3',
		viteBin: 'fa03478846d229651a3c6aa64833ba2c6cbf580a798b92bd8f47c7480bafb5d8',
		viteManifest: 'a2b943431b51bfcc2e9386eecf8b4b3f6e4bf443e56d17b1f4c8495a61b4050c',
		pnpmLock: '71fb680c6febb2024b8117efadf3ca0641fafa1cc076a08a126724a1b337e166',
		node16: '83325958463d59cb0b16433eefab0a03fd1ce7d565a27e0274f507b1f3839a6e',
		node24: '3200fbd9f7fd4410426dd541e10d1ab829d3472f270d743c7fabd1696c03fe32',
		chromium: 'a46b3b1e63163fa2d2437fb6ae967cb5a73b50050bca32f1964e6129b6228244',
	};
	if (canonicalize(tools) !== canonicalize(exactTools))
		throw new Error('GraphiQL durable tool identity differs');
	const runs = receipt.witness?.runs;
	if (
		receipt.witness?.directLinkedWitness !== true ||
		!Array.isArray(runs) ||
		runs.length !== 4 ||
		receipt.witness.successfulNonLoopback !== 0 ||
		receipt.witness.serviceWorkerRegistrations !== 0 ||
		receipt.witness.serviceWorkerControllers !== 0 ||
		receipt.witness.serviceWorkerCaches !== 0
	)
		throw new Error('GraphiQL linked Witness summary differs');
	validateRun(runs[0], 'baseline', 1);
	validateRun(runs[1], 'baseline', 2);
	validateRun(runs[2], 'target', 1);
	validateRun(runs[3], 'target', 2);
	const mutation = object(receipt.mutation, 'mutation');
	if (
		mutation.red !== true ||
		mutation.redReason !== 'graphiql-isTest-true-red' ||
		mutation.exactFailure !== 'expected GraphiQL result isTest true, but it was false' ||
		mutation.green !== true ||
		digest(mutation.originalSourceSha256, 'original source') !==
			digest(mutation.restoredSourceSha256, 'restored source') ||
		digest(mutation.originalBuildDigest, 'original build') !==
			digest(mutation.restoredBuildDigest, 'restored build') ||
		digest(mutation.mutatedBuildDigest, 'mutated build') === mutation.originalBuildDigest
	)
		throw new Error('GraphiQL mutation red/restoration evidence differs');
	validateProjectedWitness(mutation.redWitnessReceipt, 'expected-red');
	validateRun(mutation.restoredRun, 'target', 2);
	const exactNonclaims = [
		'not certification',
		'not signer authenticity',
		'not OS-wide isolation',
		'uncounted pending Judge',
		'not legal or compliance opinion',
		'no SLSA level claimed',
		'React15-only enzyme-adapter-react-15 and react-test-renderer test stack is retained but incompatible/not-tested on the React18 browser target',
	];
	if (canonicalize(receipt.nonclaims) !== canonicalize(exactNonclaims))
		throw new Error('GraphiQL receipt nonclaims differ');
	if (
		receipt.integrity?.algorithm !== 'sha256' ||
		receipt.integrity.authenticity !== 'not-established' ||
		!lowerHex64.test(receipt.integrity.canonicalDigest)
	)
		throw new Error('GraphiQL receipt integrity metadata differs');
	const expected = sha256(
		canonicalize({ ...receipt, integrity: { ...receipt.integrity, canonicalDigest: '' } }),
	);
	if (receipt.integrity.canonicalDigest !== expected)
		throw new Error('GraphiQL receipt canonical digest differs');
	if (!Array.isArray(receipt.artifacts))
		throw new Error('GraphiQL receipt artifact inventory differs');
	const artifactPaths = receipt.artifacts.map((artifact) => {
		if (
			typeof artifact.path !== 'string' ||
			!artifact.path.startsWith(evidencePrefix) ||
			isAbsolute(artifact.path) ||
			normalize(artifact.path) !== artifact.path ||
			!lowerHex64.test(artifact.sha256)
		)
			throw new Error('GraphiQL receipt artifact row differs');
		return artifact.path;
	});
	if (
		new Set(artifactPaths).size !== artifactPaths.length ||
		canonicalize(artifactPaths) !== canonicalize([...artifactPaths].sort(compare))
	)
		throw new Error('GraphiQL receipt artifact ordering differs');
	const documentNames = [
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
	];
	const projections = [
		...runs.map((run) => object(run, 'run').witness),
		mutation.redWitnessReceipt,
		object(mutation.restoredRun, 'restored run').witness,
	];
	const capturePaths = projections.flatMap((projection) =>
		(object(projection, 'Witness projection').captures as Array<Record<string, unknown>>).map(
			(row) => String(row.path).slice(evidencePrefix.length),
		),
	);
	const expectedArtifactPaths = [...documentNames, ...capturePaths]
		.map((path) => `${evidencePrefix}${path}`)
		.sort(compare);
	if (canonicalize(artifactPaths) !== canonicalize(expectedArtifactPaths))
		throw new Error('GraphiQL exact artifact names/count differs');
	return receipt;
}

function json(bytes: Uint8Array, label: string): Record<string, unknown> {
	try {
		return object(JSON.parse(Buffer.from(bytes).toString('utf8')), label);
	} catch {
		throw new Error(`GraphiQL ${label} JSON differs`);
	}
}

async function evidenceFiles(directory: string): Promise<string[]> {
	const files: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await evidenceFiles(path)));
		else if (entry.isFile()) files.push(path);
		else throw new Error('GraphiQL evidence contains symbolic link or special entry');
	}
	return files.sort(compare);
}

export async function verifyReactGraphiQL013Evidence(
	rootDir: string,
): Promise<{ receipt: ReactGraphiQL013Receipt; digest: string; artifacts: number }> {
	const receiptPath = join(rootDir, REACT_GRAPHIQL_013_RECEIPT_PATH);
	const receipt = parseReactGraphiQL013Receipt(JSON.parse(await readFile(receiptPath, 'utf8')));
	const evidenceRoot = join(rootDir, evidencePrefix);
	const actualPaths = (await evidenceFiles(evidenceRoot)).map(
		(path) => `${evidencePrefix}${relative(evidenceRoot, path)}`,
	);
	const expectedPaths = [
		...receipt.artifacts.map((artifact) => artifact.path),
		REACT_GRAPHIQL_013_RECEIPT_PATH,
	].sort(compare);
	if (canonicalize(actualPaths) !== canonicalize(expectedPaths))
		throw new Error('GraphiQL exact evidence output set differs');
	const bodies = new Map<string, Uint8Array>();
	for (const artifact of receipt.artifacts) {
		const path = join(rootDir, artifact.path);
		if (relative(rootDir, path).startsWith('..'))
			throw new Error(`GraphiQL artifact escapes root: ${artifact.path}`);
		const bytes = await readFile(path);
		if (sha256(bytes) !== artifact.sha256)
			throw new Error(`GraphiQL artifact binding differs: ${artifact.path}`);
		if (
			artifact.path.endsWith('.json') ||
			artifact.path.endsWith('.md') ||
			artifact.path.endsWith('.html') ||
			artifact.path.endsWith('.js') ||
			artifact.path.endsWith('.css')
		) {
			const text = bytes.toString('utf8');
			if (text.includes('/Users/') || text.includes('C:\\Users\\') || text.includes(rootDir))
				throw new Error(`GraphiQL artifact contains host identity: ${artifact.path}`);
		}
		bodies.set(artifact.path.slice(evidencePrefix.length), bytes);
	}
	const required = [
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
	];
	if (required.some((path) => !bodies.has(path)))
		throw new Error('GraphiQL required semantic artifact is missing');
	const buildOutputs = [
		['build-output/baseline-graphiql.js', 'baseline', 'graphiql.js'],
		['build-output/baseline-graphiql.css', 'baseline', 'graphiql.css'],
		['build-output/target-graphiql-vite.js', 'target', 'graphiql-vite.js'],
		['build-output/target-graphiql.css', 'target', 'graphiql.css'],
	] as const;
	for (const [artifactPath, lane, inventoryPath] of buildOutputs) {
		const bytes = bodies.get(artifactPath);
		const inventory = receipt.build[lane].inventories[0] as Array<Record<string, unknown>>;
		if (!bytes || inventory.find((row) => row.path === inventoryPath)?.sha256 !== sha256(bytes))
			throw new Error('GraphiQL retained build output binding differs');
	}
	const build = json(bodies.get('build.json')!, 'build');
	const witness = json(bodies.get('witness.json')!, 'witness');
	const mutation = json(bodies.get('mutation.json')!, 'mutation');
	if (
		canonicalize(build) !== canonicalize(receipt.build) ||
		canonicalize(witness) !== canonicalize(receipt.witness) ||
		canonicalize(mutation) !== canonicalize(receipt.mutation)
	)
		throw new Error('GraphiQL primary artifact projection differs');
	for (const [index, run] of receipt.witness.runs.entries())
		if (
			canonicalize(json(bodies.get(`witness-0${index + 1}.json`)!, 'Witness run')) !==
			canonicalize(run.witness)
		)
			throw new Error('GraphiQL Witness run artifact differs');
	if (
		canonicalize(json(bodies.get('witness-mutation-red.json')!, 'red Witness')) !==
			canonicalize(receipt.mutation.redWitnessReceipt) ||
		canonicalize(json(bodies.get('witness-restored.json')!, 'restored Witness')) !==
			canonicalize(object(receipt.mutation.restoredRun, 'restored run').witness)
	)
		throw new Error('GraphiQL mutation Witness projection differs');
	const projectedCaptures = [
		...receipt.witness.runs.map((run) => object(run.witness, 'run Witness')),
		object(receipt.mutation.redWitnessReceipt, 'red Witness'),
		object(object(receipt.mutation.restoredRun, 'restored run').witness, 'restored Witness'),
	].flatMap((projection) => projection.captures as Array<Record<string, unknown>>);
	for (const capture of projectedCaptures) {
		const artifact = receipt.artifacts.find((row) => row.path === capture.path);
		if (
			!artifact ||
			artifact.sha256 !== capture.sha256 ||
			!bodies.has(String(capture.path).slice(evidencePrefix.length))
		)
			throw new Error('GraphiQL recursive capture verification differs');
	}
	const assets = json(bodies.get('assets.json')!, 'assets');
	const dependencies = json(bodies.get('dependencies.json')!, 'dependencies');
	const licenses = json(bodies.get('licenses.json')!, 'licenses');
	const sbom = json(bodies.get('sbom.json')!, 'SBOM');
	const provenance = json(bodies.get('provenance.json')!, 'provenance');
	const sourceProvenance = object(provenance.source, 'source provenance');
	const linkedWitness = object(provenance.linkedWitness, 'linked Witness provenance');
	const ingestReceiptDigest = String(provenance.ingestReceiptDigest ?? '');
	if (
		sourceProvenance.repository !== 'https://github.com/graphql/graphiql' ||
		sourceProvenance.revision !== 'f997c204e4d4bb0be4d0e2e136471dc62b807ddd' ||
		sourceProvenance.tree !== '7b4f52a518bfc6e4080589cc9ec0f2e731463147' ||
		!lowerHex64.test(String(sourceProvenance.archiveSha256 ?? '')) ||
		!lowerHex64.test(ingestReceiptDigest) ||
		canonicalize(linkedWitness) !==
			canonicalize({
				dependency: '@async/witness',
				linkTarget: '../witness',
				version: '0.8.0',
				commit: '83b86de431db306170cd8bb85317a88070512f9d',
				tracked: 'clean',
				index: 'clean',
				untracked: ['.async/', 'design/'],
				packageSha256: 'd166f03192c6d022568e56ef02031db740141a29ed9a435b9a4a2c921f6a7be4',
				declarationSha256:
					'4e249b3c60178168dd876fac5c3ae5cfc537b4f492e6574f2c4b7f76a2eb0360',
				runtimeSha256: 'd1fd099bf9de85f10518b5c94c3f6b2d3ad4c0b68c6b1449fd4bf9446dd1cea5',
				localOnly: true,
				portableReleaseDependency: false,
			})
	)
		throw new Error('GraphiQL source/linked Witness provenance differs');
	if (dependencies.ingestReceiptDigest !== ingestReceiptDigest)
		throw new Error('GraphiQL dependency-to-ingest receipt link differs');
	const ingestReceipt = json(
		await readFile(join(rootDir, 'evidence/ingests/react-graphiql-013/receipt.json')),
		'ingest receipt',
	);
	const ingestIntegrity = object(ingestReceipt.integrity, 'ingest integrity');
	if (
		ingestReceipt.schemaVersion !== 'versionless.react-graphiql-013-ingest.v1' ||
		ingestReceipt.result !== 'pass' ||
		ingestReceipt.counted !== false ||
		ingestReceipt.consentId !== 'T577-official-source-graphiql-013-react15-production' ||
		ingestIntegrity.canonicalDigest !== ingestReceiptDigest ||
		sha256(
			canonicalize({
				...ingestReceipt,
				integrity: { algorithm: 'sha256', canonicalDigest: '' },
			}),
		) !== ingestReceiptDigest
	)
		throw new Error('GraphiQL public ingest receipt chain differs');
	if (
		canonicalize(sourceProvenance) !== canonicalize(ingestReceipt.provenance) ||
		canonicalize(dependencies.closure) !== canonicalize(ingestReceipt.closure) ||
		canonicalize(dependencies.dependencies) !== canonicalize(ingestReceipt.dependencies) ||
		canonicalize(assets.assets) !== canonicalize(ingestReceipt.assets) ||
		canonicalize(assets.supplemental) !== canonicalize(ingestReceipt.supplemental)
	)
		throw new Error('GraphiQL ingest-to-run semantic projection differs');
	const assetRows = assets.assets as Array<Record<string, unknown>>;
	const supplemental = assets.supplemental as Array<Record<string, unknown>>;
	const licenseLinks = licenses.cdnLicenseLinks as Array<Record<string, unknown>>;
	const expectedAssets = [
		[
			'es6-promise',
			'4.0.5',
			'https://cdn.jsdelivr.net/es6-promise/4.0.5/es6-promise.auto.min.js',
		],
		['fetch', '0.9.0', 'https://cdn.jsdelivr.net/fetch/0.9.0/fetch.min.js'],
		['react', '15.4.2', 'https://cdn.jsdelivr.net/react/15.4.2/react.min.js'],
		['react-dom', '15.4.2', 'https://cdn.jsdelivr.net/react/15.4.2/react-dom.min.js'],
	].map(([packageName, version, url]) => ({ package: packageName, version, url }));
	const expectedSupplemental = [
		'es6-promise@4.0.5',
		'fetch@0.9.0',
		'react@15.4.2',
		'react-dom@15.4.2',
		'react@18.3.1',
		'react-dom@18.3.1',
		'scheduler@0.23.2',
		'loose-envify@1.4.0',
		'js-tokens@4.0.0',
	].sort(compare);
	if (
		!Array.isArray(assetRows) ||
		assetRows.length !== 4 ||
		!Array.isArray(supplemental) ||
		supplemental.length !== 9 ||
		!Array.isArray(licenseLinks) ||
		licenseLinks.length !== 4 ||
		!Array.isArray(dependencies.dependencies) ||
		canonicalize(
			assetRows.map((row) => ({ package: row.package, version: row.version, url: row.url })),
		) !== canonicalize(expectedAssets) ||
		assetRows.some(
			(row) =>
				!lowerHex64.test(String(row.sha256)) ||
				!lowerHex64.test(String(row.sha512)) ||
				typeof row.bytes !== 'number',
		) ||
		canonicalize(supplemental.map((row) => `${row.name}@${row.version}`).sort(compare)) !==
			canonicalize(expectedSupplemental) ||
		dependencies.closure === undefined ||
		object(dependencies.closure, 'dependency closure').artifacts !==
			dependencies.dependencies.length ||
		!lowerHex64.test(String(object(dependencies.closure, 'dependency closure').digest ?? '')) ||
		!sourceProvenance.revision
	)
		throw new Error('GraphiQL dependency/license inventory differs');
	const sourceLicense = object(licenses.sourceLicense, 'source license');
	if (
		sourceLicense.path !== 'source/LICENSE' ||
		sourceLicense.gitBlob !== 'cd2262e3a31be829b623167928cce428ffe32733' ||
		sourceLicense.sha256 !== '64b1e722d46dbbd0fd63deba6005774a5695b5255b28db067b758306854680eb'
	)
		throw new Error('GraphiQL source license binding differs');
	for (const link of licenseLinks) {
		const coordinate = String(link.coordinate);
		const asset = assetRows.find((row) => `${row.package}@${row.version}` === coordinate);
		const packageRow = supplemental.find((row) => `${row.name}@${row.version}` === coordinate);
		if (!asset || !packageRow) throw new Error('GraphiQL CDN license coordinate differs');
		const linkedPackage = object(link.package, 'license package');
		const inspection = object(packageRow.inspection, 'package inspection');
		if (
			canonicalize(link.asset) !== canonicalize({ url: asset.url, sha256: asset.sha256 }) ||
			linkedPackage.tarballSha256 !== packageRow.tarballSha256 ||
			canonicalize(linkedPackage.license) !== canonicalize(inspection.license)
		)
			throw new Error('GraphiQL CDN license join differs');
	}
	const metadata = object(sbom.metadata, 'SBOM metadata');
	const app = object(metadata.component, 'SBOM root component');
	const components = sbom.components;
	const graph = sbom.dependencies;
	const dependencyRows = dependencies.dependencies as Array<Record<string, unknown>>;
	const inventoryRows = [...dependencyRows, ...supplemental];
	const expectedComponentDigests = new Map(
		inventoryRows.map((row) => [
			`${String(row.name)}@${String(row.version)}`,
			String(row.sha256 ?? row.tarballSha256),
		]),
	);
	if (
		sbom.bomFormat !== 'CycloneDX' ||
		sbom.specVersion !== '1.7' ||
		sbom.version !== 1 ||
		app.name !== 'graphiql' ||
		app.version !== '0.13.0' ||
		app['bom-ref'] !== 'pkg:npm/graphiql@0.13.0' ||
		!Array.isArray(components) ||
		components.length !== expectedComponentDigests.size ||
		!Array.isArray(graph) ||
		!graph.some((row) => object(row, 'SBOM graph row').ref === app['bom-ref'])
	)
		throw new Error('GraphiQL CycloneDX root topology differs');
	const componentRefs = components
		.map((value) => {
			const component = object(value, 'SBOM component');
			const key = `${String(component.name)}@${String(component.version)}`;
			const hashes = component.hashes as Array<Record<string, unknown>>;
			const properties = component.properties as Array<Record<string, unknown>>;
			const expectedRef = npmPurl(String(component.name), String(component.version));
			const inventory = [...inventoryRows]
				.reverse()
				.find((row) => row.name === component.name && row.version === component.version);
			const inspection = inventory
				? object(inventory.inspection ?? inventory.metadata, 'SBOM inspection')
				: null;
			const license = inspection ? object(inspection.license, 'SBOM license') : null;
			if (
				component.type !== 'library' ||
				component.purl !== expectedRef ||
				component['bom-ref'] !== expectedRef ||
				!expectedComponentDigests.has(key) ||
				!Array.isArray(hashes) ||
				hashes.length !== 1 ||
				hashes[0]?.alg !== 'SHA-256' ||
				hashes[0].content !== expectedComponentDigests.get(key) ||
				!Array.isArray(properties) ||
				!license ||
				!properties.some(
					(row) =>
						row.name === 'versionless:license-state' &&
						row.value === String(license.state),
				) ||
				!properties.some(
					(row) =>
						row.name === 'versionless:license-declarations' &&
						row.value === canonicalize(license.declarations ?? []),
				)
			)
				throw new Error('GraphiQL CycloneDX component binding differs');
			return String(component['bom-ref']);
		})
		.sort(compare);
	const rootEdge = graph
		.map((row) => object(row, 'SBOM graph row'))
		.find((row) => row.ref === app['bom-ref']);
	const nonRootEdgeRefs = graph
		.map((row) => object(row, 'SBOM graph row'))
		.filter((row) => row.ref !== app['bom-ref'])
		.map((row) => String(row.ref))
		.sort(compare);
	if (
		new Set(componentRefs).size !== componentRefs.length ||
		new Set(nonRootEdgeRefs).size !== nonRootEdgeRefs.length ||
		canonicalize(nonRootEdgeRefs) !== canonicalize(componentRefs) ||
		!rootEdge ||
		canonicalize([...(rootEdge.dependsOn as string[])].sort(compare)) !==
			canonicalize(componentRefs) ||
		graph.length !== componentRefs.length + 1 ||
		graph
			.filter((row) => object(row, 'SBOM graph row').ref !== app['bom-ref'])
			.some((row) => {
				const edge = object(row, 'SBOM dependency edge');
				return !componentRefs.includes(String(edge.ref)) || edge.dependsOn !== undefined;
			})
	)
		throw new Error('GraphiQL CycloneDX dependency graph differs');
	const appProperties = app.properties as Array<Record<string, unknown>>;
	if (
		!Array.isArray(appProperties) ||
		!appProperties.some(
			(row) =>
				row.name === 'versionless:source-revision' &&
				row.value === sourceProvenance.revision,
		) ||
		!appProperties.some(
			(row) => row.name === 'versionless:source-tree' && row.value === sourceProvenance.tree,
		) ||
		!appProperties.some(
			(row) =>
				row.name === 'versionless:source-archive-sha256' &&
				row.value === sourceProvenance.archiveSha256,
		)
	)
		throw new Error('GraphiQL CycloneDX source root properties differ');
	const policy = json(bodies.get('policy.json')!, 'policy');
	const locality = json(bodies.get('locality.json')!, 'locality');
	const privacy = json(bodies.get('privacy.json')!, 'privacy');
	if (
		canonicalize(policy) !==
			canonicalize({
				lifecycleExecuted: false,
				nativeExecuted: false,
				react15TestStack: 'incompatible-not-tested',
				credentialMode: 'include',
				observedCookieHeaders: 0,
				observedAuthorizationHeaders: 0,
			}) ||
		canonicalize(locality) !==
			canonicalize({
				attemptedNonLoopback: 0,
				successfulNonLoopback: 0,
				failedRequests: 0,
				serviceWorkerRegistrations: 0,
				controllers: 0,
				caches: 0,
				pageErrors: 0,
				consoleErrors: 0,
			}) ||
		canonicalize(privacy) !==
			canonicalize({
				credentialMode: 'include',
				observedCookieHeaders: 0,
				observedAuthorizationHeaders: 0,
				customerData: false,
				paymentData: false,
				endpoint: 'synthetic loopback /graphql only',
				persistence: 'local synthetic IDE state only',
			})
	)
		throw new Error('GraphiQL policy/locality/privacy semantics differ');
	const human = Buffer.from(bodies.get('receipt.md')!).toString('utf8');
	for (const text of [
		'Uncounted',
		'not certification',
		'signer authenticity',
		'OS-wide isolation',
		'legal/compliance opinion',
		'No SLSA level',
	])
		if (!human.includes(text)) throw new Error('GraphiQL human nonclaims differ');
	return {
		receipt,
		digest: receipt.integrity.canonicalDigest,
		artifacts: receipt.artifacts.length,
	};
}

export function reactGraphiQL013AggregateMember(receiptDigest: string): Record<string, unknown> {
	digest(receiptDigest, 'aggregate member');
	return {
		id: 'react-graphiql-013',
		framework: 'react',
		kind: 'production',
		counted: false,
		result: 'pass',
		receipt: REACT_GRAPHIQL_013_RECEIPT_PATH,
		digest: receiptDigest,
	};
}
