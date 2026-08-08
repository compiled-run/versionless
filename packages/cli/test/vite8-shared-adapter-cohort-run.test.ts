import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import * as path from 'pathe';
import { parseURL } from 'ufo';
import { afterEach, describe, expect, it } from 'vitest';
import {
	assertCompleteVite8Inventory,
	canonicalPhonecatInventory,
	createVite8InventoryDelta,
	createVite8SharedAdapterCohortEvidence,
	VITE8_SHARED_ADAPTER_COHORT_PORT_PLAN,
	verifyVite8SharedAdapterCohort,
} from '../src/fixture/vite8-shared-adapter-cohort-run.ts';
import {
	canonicalize,
	compareUtf16CodeUnits,
	normalizedVite8OutputInventory,
	sha256,
	type Vite8OutputEntry,
} from '../../core/src/index.ts';
import {
	reactViteBuildEnvironment,
	REACT_VITE8_DEFAULT_PORT_PLAN,
} from '../src/fixture/react-boilerplate-v4-vite8-run.ts';
import {
	angularPhonecatViteBuildEnvironment,
	ANGULAR_PHONECAT_VITE8_DEFAULT_PORT_PLAN,
} from '../src/fixture/angular-phonecat-vite8-run.ts';

const temporary: string[] = [];
async function directory(): Promise<string> {
	const value = await mkdtemp(path.join(os.tmpdir(), 'versionless-t164-'));
	temporary.push(value);
	return value;
}
afterEach(async () => {
	for (const target of temporary.splice(0)) await rm(target, { recursive: true, force: true });
	delete process.env.VERSIONLESS_NETWORK_MODE;
	delete process.env.NPM_CONFIG_OFFLINE;
});

describe('shared Vite 8 adapter cohort', () => {
	it('derives the same repository root from source and flattened-dist profile layouts', async () => {
		const repositoryRoot = path.resolve(import.meta.dirname, '../../..');
		const convention = [
			{
				directory: path.join(repositoryRoot, 'packages/cli/src/fixture'),
				relative: '../../../..',
			},
			{ directory: path.join(repositoryRoot, 'packages/cli/dist'), relative: '../../..' },
		] as const;
		for (const layout of convention)
			expect(path.resolve(layout.directory, layout.relative)).toBe(repositoryRoot);
		for (const runner of [
			'../src/fixture/react-boilerplate-v4-vite8-run.ts',
			'../src/fixture/angular-phonecat-vite8-run.ts',
			'../src/fixture/vite8-shared-adapter-cohort-run.ts',
		]) {
			const source = await readFile(path.resolve(import.meta.dirname, runner), 'utf8');
			expect(source).toContain('const sourceDirectory = import.meta.dirname;');
			expect(source).toContain("path.basename(sourceDirectory) === 'dist'");
			expect(source).toContain("path.resolve(sourceDirectory, '../../..')");
			expect(source).toContain("path.resolve(sourceDirectory, '../../../..')");
		}
	});

	it('reports every complete-inventory delta in compact exact v2 diagnostics', () => {
		const expected: readonly Vite8OutputEntry[] = [
			{ path: 'assets/app.js', url: '/assets/app.js', sha256: '1'.repeat(64) },
			{ path: 'index.html', url: '/index.html', sha256: '2'.repeat(64) },
		];
		expect(() =>
			assertCompleteVite8Inventory(expected, structuredClone(expected)),
		).not.toThrow();
		const missing = structuredClone(expected).slice(1);
		const unexpected = [
			...structuredClone(expected),
			{ path: 'unexpected.js', url: '/unexpected.js', sha256: '3'.repeat(64) },
		];
		const reversed = [...structuredClone(expected)].reverse();
		const changedUrl = structuredClone(expected).map((entry, index) =>
			index === 0 ? { ...entry, url: '/changed.js' } : entry,
		);
		const changedHash = structuredClone(expected).map((entry, index) =>
			index === 0 ? { ...entry, sha256: '4'.repeat(64) } : entry,
		);
		const duplicate = [...structuredClone(expected), structuredClone(expected[0]!)];
		const remote = structuredClone(expected).map((entry, index) =>
			index === 0 ? { ...entry, url: 'https://example.invalid/assets/app.js' } : entry,
		);
		const malformed = structuredClone(expected).map((entry, index) =>
			index === 0 ? { ...entry, sha256: 'bad' } : entry,
		);
		expect(createVite8InventoryDelta(expected, missing)).toMatchObject({
			expectedCount: 2,
			actualCount: 1,
			missing: [expected[0]],
			unexpected: [],
			changes: [],
			orderRelocations: [{ path: 'index.html', expectedIndex: 1, actualIndex: 0 }],
		});
		expect(createVite8InventoryDelta(expected, unexpected)).toMatchObject({
			missing: [],
			unexpected: [unexpected[2]],
		});
		expect(createVite8InventoryDelta(expected, reversed)).toMatchObject({
			actualValidation: { ordered: false },
			orderRelocations: [
				{ path: 'assets/app.js', expectedIndex: 0, actualIndex: 1 },
				{ path: 'index.html', expectedIndex: 1, actualIndex: 0 },
			],
		});
		expect(createVite8InventoryDelta(expected, changedUrl)).toMatchObject({
			changes: [
				{
					path: 'assets/app.js',
					expected: { url: '/assets/app.js', sha256: '1'.repeat(64) },
					actual: { url: '/changed.js', sha256: '1'.repeat(64) },
					urlChanged: true,
					sha256Changed: false,
				},
			],
		});
		expect(createVite8InventoryDelta(expected, changedHash)).toMatchObject({
			changes: [
				{
					path: 'assets/app.js',
					urlChanged: false,
					sha256Changed: true,
				},
			],
		});
		expect(createVite8InventoryDelta(expected, duplicate)).toMatchObject({
			actualValidation: {
				duplicates: [{ path: 'assets/app.js', indices: [0, 2] }],
			},
		});
		expect(createVite8InventoryDelta(expected, remote)).toMatchObject({
			actualValidation: {
				schemaViolations: [
					{
						index: 0,
						path: 'assets/app.js',
						violations: ['url-not-canonical', 'url-remote'],
					},
				],
			},
		});
		expect(createVite8InventoryDelta(expected, malformed)).toMatchObject({
			actualValidation: {
				schemaViolations: [
					{ index: 0, path: 'assets/app.js', violations: ['sha256-invalid'] },
				],
			},
		});
		for (const actual of [
			missing,
			unexpected,
			reversed,
			changedUrl,
			changedHash,
			duplicate,
			remote,
			malformed,
		]) {
			let message = '';
			try {
				assertCompleteVite8Inventory(expected, actual);
			} catch (error) {
				message = error instanceof Error ? error.message : String(error);
			}
			expect(message).toContain('versionless.vite8-inventory-delta.v2');
			expect(message).not.toContain('"expected":[');
			expect(message).not.toContain('"actual":[');
		}
	});

	it('reconstructs and compares the exact 188-entry canonical PhoneCat inventory', async () => {
		const canonical = await canonicalPhonecatInventory();
		expect(canonical).toHaveLength(188);
		expect(new Set(canonical.map((entry) => entry.path)).size).toBe(188);
		expect(sha256(canonicalize(canonical))).toBe(
			'46111c9368437daae341f7c6a0788fd2f106892439da28aeb6b26d94f6a4f348',
		);
		expect(canonical[0]!.path).toBe('app.animations.css');
		expect(canonical.at(-1)).toEqual({
			path: 'runtime-inventory.json',
			url: '/runtime-inventory.json',
			sha256: '9e671b66db30b584e5d1f55b9cd8c3df7a8d37d829766d4ec5598c398ad3f9ab',
		});
		const groups = {
			root: canonical.filter((entry) => !entry.path.includes('/')).length,
			assets: canonical.filter((entry) => entry.path.startsWith('assets/')).length,
			core: canonical.filter((entry) => entry.path.startsWith('core/')).length,
			phoneImages: canonical.filter((entry) => entry.path.startsWith('img/phones/')).length,
			library: canonical.filter((entry) => entry.path.startsWith('lib/')).length,
			detail: canonical.filter((entry) => entry.path.startsWith('phone-detail/')).length,
			list: canonical.filter((entry) => entry.path.startsWith('phone-list/')).length,
			phoneJson: canonical.filter((entry) => entry.path.startsWith('phones/')).length,
		};
		expect(groups).toEqual({
			root: 7,
			assets: 6,
			core: 4,
			phoneImages: 79,
			library: 65,
			detail: 3,
			list: 3,
			phoneJson: 21,
		});
		const retained = await normalizedVite8OutputInventory(
			path.resolve(
				import.meta.dirname,
				'../../../.versionless/work/angular-phonecat-vite8/target/build-vite',
			),
		);
		expect(() => assertCompleteVite8Inventory(canonical, retained)).not.toThrow();
	});

	it('reports the historical 187-entry PhoneCat oracle as exactly one unexpected entry', async () => {
		const receipt = JSON.parse(
			await readFile(
				path.resolve(
					import.meta.dirname,
					'../../../evidence/runs/angular-phonecat-vite8/artifacts/vite-build.json',
				),
				'utf8',
			),
		) as { first: { entries: Vite8OutputEntry[] } };
		const historical = [...receipt.first.entries].sort((left, right) =>
			compareUtf16CodeUnits(left.path, right.path),
		);
		const canonical = await canonicalPhonecatInventory();
		expect(createVite8InventoryDelta(historical, canonical)).toEqual({
			schemaVersion: 'versionless.vite8-inventory-delta.v2',
			reason: 'entry-mismatch',
			expectedCount: 187,
			actualCount: 188,
			expectedDigest: '4310e880eaf456f75517bb7afc5397db9f0913e4e07d426c46ec7015acb652b6',
			actualDigest: '46111c9368437daae341f7c6a0788fd2f106892439da28aeb6b26d94f6a4f348',
			expectedValidation: { ordered: true, duplicates: [], schemaViolations: [] },
			actualValidation: { ordered: true, duplicates: [], schemaViolations: [] },
			missing: [],
			unexpected: [canonical.at(-1)],
			changes: [],
			orderRelocations: [],
		});
	});

	it('orders the exact canonical React inventory by shared UTF-16 code units', async () => {
		const canonical = JSON.parse(
			await readFile(
				path.resolve(
					import.meta.dirname,
					'../../../evidence/runs/react-boilerplate-v4-vite8/artifacts/service-worker.json',
				),
				'utf8',
			),
		) as {
			entries: Array<{ url: string }>;
			manifest: { path: string };
			worker: { path: string };
		};
		const paths = [
			...canonical.entries.map((entry) =>
				path
					.relative('/', parseURL(entry.url).pathname || '/')
					.split(path.sep)
					.join('/'),
			),
			canonical.manifest.path,
			canonical.worker.path,
		].sort(compareUtf16CodeUnits);
		expect(paths).toEqual([
			'assets/FeaturePage-2zyLJwLV.js',
			'assets/H1-BZCoji1x.js',
			'assets/HomePage-CZiBZHtd.js',
			'assets/NotFoundPage-BkMd3EGU.js',
			'assets/__vite-browser-external-CvNEtdN9.js',
			'assets/banner-6i24qsix.jpg',
			'assets/de-CEvlwdXo.js',
			'assets/en-D7F8Da0k.js',
			'assets/favicon-Ba7brf7t.ico',
			'assets/index-CqaBhjBI.css',
			'assets/index-D47xRHLD.js',
			'assets/intl-tJox8g0n.js',
			'index.html',
			'precache-manifest.json',
			'sw.js',
		]);
	});

	it('keeps canonical defaults and instruments disjoint cohort readiness and diagnostics', async () => {
		expect(process.env.NODE_ENV).toBe('test');
		expect(reactViteBuildEnvironment().NODE_ENV).toBe('production');
		expect(angularPhonecatViteBuildEnvironment().NODE_ENV).toBe('production');
		expect(process.env.NODE_ENV).toBe('test');
		expect(Object.values(REACT_VITE8_DEFAULT_PORT_PLAN)).toEqual([43281, 43282, 43283]);
		expect(Object.values(ANGULAR_PHONECAT_VITE8_DEFAULT_PORT_PLAN)).toEqual([
			43510, 43511, 43512, 43513, 43514, 43515,
		]);
		const cohortPorts = Object.values(VITE8_SHARED_ADAPTER_COHORT_PORT_PLAN).flatMap((plan) => [
			...Object.values(plan.react),
			...Object.values(plan.phonecat),
		]);
		expect(new Set(cohortPorts).size).toBe(cohortPorts.length);
		const cohortSource = await readFile(
			path.resolve(import.meta.dirname, '../src/fixture/vite8-shared-adapter-cohort-run.ts'),
			'utf8',
		);
		expect(cohortSource).toContain('internalReceiptIdentity: order');
		for (const runner of [
			'../src/fixture/react-boilerplate-v4-vite8-run.ts',
			'../src/fixture/angular-phonecat-vite8-run.ts',
		]) {
			const source = await readFile(path.resolve(import.meta.dirname, runner), 'utf8');
			expect(source).toContain("NODE_ENV: 'production'");
			expect(source).toContain('repositoryRoot: root');
			expect(source).toContain("receiptPathBase: 'repository'");
			expect(source).toContain("artifactPathBase: 'repository'");
			expect(source).toContain('requireAggregate: publishAggregate');
			for (const evidence of [
				"joinURL(base, 'index.html')",
				'referencedEntryAssets(indexBody)',
				'indexResponse.ok',
				'response.ok',
				'currentUrl: page.url()',
				'mainDocument',
				'consoleErrors',
				'pageErrors',
				'failedRequests',
				'probe',
				'{ cause: error }',
			])
				expect(source).toContain(evidence);
		}
	});

	it('requires explicit dual offline controls', async () => {
		const base = await directory();
		await expect(
			createVite8SharedAdapterCohortEvidence({
				outputRoot: path.join(base, 'output'),
				workRoot: path.join(base, 'work'),
			}),
		).rejects.toThrow('explicit offline mode');
	});

	it('converges both profile orders with shared and application mutation proof', async () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'offline';
		process.env.NPM_CONFIG_OFFLINE = 'true';
		const base = await directory();
		const outputRoot = path.join(base, 'output');
		const workRoot = path.join(base, 'work');
		const artifacts = await createVite8SharedAdapterCohortEvidence({ outputRoot, workRoot });
		const receipt = JSON.parse(artifacts['receipt.json']!) as Record<string, unknown>;
		expect(receipt).toMatchObject({
			result: 'pass',
			vite: '8.0.16',
			profiles: 2,
			orderConvergent: true,
		});
		await expect(access(workRoot)).rejects.toThrow();
		expect(await verifyVite8SharedAdapterCohort({ outputRoot, workRoot })).toHaveLength(64);
	}, 900_000);
});
