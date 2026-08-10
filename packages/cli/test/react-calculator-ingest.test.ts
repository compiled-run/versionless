import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, test } from 'vitest';
import {
	REACT_CALCULATOR_CONSENT,
	analyzeReactCalculatorLock,
	assertReactCalculatorBaselineLock,
	assertReactCalculatorArchiveEntries,
	assertReactCalculatorCommitDocument,
	assertReactCalculatorPackageEntries,
	assertReactCalculatorUrl,
	collectReactCalculatorResponse,
	parseReactCalculatorTargetMetadata,
	parseReactCalculatorLauncher,
	publishReactCalculatorTransaction,
	reactCalculatorResponseLimits,
	verifyReactCalculatorPackageIdentity,
} from '../src/fixture/react-calculator-ingest.ts';

const exactPackageBytes = Buffer.from(`{
  "name": "calculator",
  "version": "0.1.0",
  "license": "MIT",
  "homepage": "http://ahfarmer.github.io/calculator",
  "devDependencies": {
    "chai": "^4.2.0",
    "gh-pages": "^2.0.1",
    "prettier": "^1.17.1",
    "react-scripts": "^3.0.1"
  },
  "dependencies": {
    "big.js": "^5.2.2",
    "github-fork-ribbon-css": "^0.2.1",
    "react": "^16.8.6",
    "react-dom": "^16.8.6"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test --env=jsdom",
    "eject": "react-scripts eject",
    "deploy": "gh-pages -d build"
  },
  "prettier": {
    "trailingComma": "all"
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  }
}
`);
const exactManifestExpected = {
	react: '^16.8.6',
	reactDom: '^16.8.6',
	reactScripts: '^3.0.1',
	bigJs: '^5.2.2',
};

const originalNetworkMode = process.env.VERSIONLESS_NETWORK_MODE;
const originalConsentId = process.env.VERSIONLESS_CONSENT_ID;
const originalNpmOffline = process.env.NPM_CONFIG_OFFLINE;

function lockWith(count: number): Record<string, unknown> {
	const dependencies: Record<string, unknown> = {};
	for (let index = 0; index < count; index += 1)
		dependencies[`package-${index}`] = {
			version: '1.0.0',
			resolved: `https://registry.npmjs.org/package-${index}/-/package-${index}-1.0.0.tgz`,
			integrity: `sha512-${Buffer.alloc(64, index).toString('base64')}`,
		};
	return { name: 'calculator', lockfileVersion: 1, dependencies };
}

afterEach(() => {
	if (originalNetworkMode === undefined) delete process.env.VERSIONLESS_NETWORK_MODE;
	else process.env.VERSIONLESS_NETWORK_MODE = originalNetworkMode;
	if (originalConsentId === undefined) delete process.env.VERSIONLESS_CONSENT_ID;
	else process.env.VERSIONLESS_CONSENT_ID = originalConsentId;
	if (originalNpmOffline === undefined) delete process.env.NPM_CONFIG_OFFLINE;
	else process.env.NPM_CONFIG_OFFLINE = originalNpmOffline;
});

describe('React Calculator transactional ingest', () => {
	test('binds the exact 881-byte package and requires react-scripts only in devDependencies', () => {
		expect(exactPackageBytes).toHaveLength(881);
		expect(createHash('sha256').update(exactPackageBytes).digest('hex')).toBe(
			'57a53728d17deee9c41a30d888577791bcf2b744196a7a967db30e22f63f55d9',
		);
		expect(
			createHash('sha1')
				.update(Buffer.from(`blob ${exactPackageBytes.length}\0`))
				.update(exactPackageBytes)
				.digest('hex'),
		).toBe('33df28fc715d9353f96b2f71c4719ffad500280b');
		const exact = JSON.parse(exactPackageBytes.toString('utf8')) as Record<string, unknown>;
		expect(() =>
			verifyReactCalculatorPackageIdentity(exact, exactManifestExpected),
		).not.toThrow();
		const dependencies = exact.dependencies as Record<string, unknown>;
		const devDependencies = exact.devDependencies as Record<string, unknown>;
		for (const changed of [
			{ ...exact, devDependencies: { ...devDependencies, 'react-scripts': undefined } },
			{
				...exact,
				dependencies: { ...dependencies, 'react-scripts': '^3.0.1' },
				devDependencies: { ...devDependencies, 'react-scripts': undefined },
			},
			{ ...exact, dependencies: { ...dependencies, 'react-scripts': '^3.0.1' } },
			{ ...exact, devDependencies: { ...devDependencies, 'react-scripts': '^3.0.2' } },
			{ ...exact, devDependencies: ['react-scripts'] },
		])
			expect(() =>
				verifyReactCalculatorPackageIdentity(changed, exactManifestExpected),
			).toThrow('legacy package identity differs');
	});

	test('shares an exact production parser for offline smoke and consented acquisition', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'offline';
		process.env.NPM_CONFIG_OFFLINE = 'true';
		delete process.env.VERSIONLESS_CONSENT_ID;
		expect(
			parseReactCalculatorLauncher([
				'--launcher-smoke',
				'--consent-id',
				REACT_CALCULATOR_CONSENT,
			]),
		).toBe('launcher-smoke');
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		process.env.VERSIONLESS_CONSENT_ID = REACT_CALCULATOR_CONSENT;
		expect(
			parseReactCalculatorLauncher(['--acquire', '--consent-id', REACT_CALCULATOR_CONSENT]),
		).toBe('acquire');
		process.env.VERSIONLESS_NETWORK_MODE = 'offline';
		expect(() =>
			parseReactCalculatorLauncher(['--acquire', '--consent-id', REACT_CALCULATOR_CONSENT]),
		).toThrow('exact one-shot consent');
	});

	test('accepts only exact credential-free HTTPS URLs', () => {
		const exact = 'https://registry.npmjs.org/example/-/example-1.0.0.tgz';
		const allowed = new Set([exact]);
		expect(() => assertReactCalculatorUrl(exact, allowed)).not.toThrow();
		for (const url of [
			'http://registry.npmjs.org/example/-/example-1.0.0.tgz',
			'https://user@registry.npmjs.org/example/-/example-1.0.0.tgz',
			`${exact}?moving=true`,
			`${exact}#fragment`,
			'https://example.com/example-1.0.0.tgz',
		])
			expect(() => assertReactCalculatorUrl(url, allowed)).toThrow('outside exact consent');
	});

	test('binds the immutable commit to the selected tree', () => {
		expect(() =>
			assertReactCalculatorCommitDocument({
				sha: '37b56077e78b82bf2088ec993d55becb47538de9',
				tree: { sha: 'd173cbae55964a2553c308ebbb7ed6e2d14f9a8a' },
			}),
		).not.toThrow();
		for (const value of [
			{},
			{
				sha: '37b56077e78b82bf2088ec993d55becb47538de9',
				tree: { sha: 'moving' },
			},
			{
				sha: 'moving',
				tree: { sha: 'd173cbae55964a2553c308ebbb7ed6e2d14f9a8a' },
			},
		])
			expect(() => assertReactCalculatorCommitDocument(value)).toThrow(
				'commit-to-tree binding differs',
			);
	});

	test('analyzes the committed npm-v1 closure and strengthens its identity', () => {
		const lock = lockWith(100);
		const dependencies = lock.dependencies as Record<string, unknown>;
		Object.assign(dependencies, {
			react: {
				version: '16.8.6',
				resolved: 'https://registry.npmjs.org/react/-/react-16.8.6.tgz',
				integrity: `sha512-${Buffer.alloc(64, 101).toString('base64')}`,
			},
			'react-dom': {
				version: '16.8.6',
				resolved: 'https://registry.npmjs.org/react-dom/-/react-dom-16.8.6.tgz',
				integrity: `sha512-${Buffer.alloc(64, 102).toString('base64')}`,
			},
			'react-scripts': {
				version: '3.0.1',
				resolved: 'https://registry.npmjs.org/react-scripts/-/react-scripts-3.0.1.tgz',
				integrity: `sha512-${Buffer.alloc(64, 103).toString('base64')}`,
			},
			'big.js': {
				version: '5.2.2',
				resolved: 'https://registry.npmjs.org/big.js/-/big.js-5.2.2.tgz',
				integrity: `sha512-${Buffer.alloc(64, 104).toString('base64')}`,
			},
		});
		const result = analyzeReactCalculatorLock(lock);
		expect(result.artifacts).toHaveLength(104);
		expect(result.placements).toBe(104);
		expect(result.digest).toHaveLength(64);
		expect(result.artifacts[0]?.metadataUrl).toContain('registry.npmjs.org');
		expect(() =>
			assertReactCalculatorBaselineLock(result.artifacts, {
				react: '16.8.6',
				reactDom: '16.8.6',
				reactScripts: '3.0.1',
				bigJs: '5.2.2',
			}),
		).not.toThrow();
		expect(() =>
			assertReactCalculatorBaselineLock(result.artifacts, {
				react: '16.8.7',
				reactDom: '16.8.6',
				reactScripts: '3.0.1',
				bigJs: '5.2.2',
			}),
		).toThrow('locked baseline identity differs');
	});

	test('binds the exact React18 target metadata, tarball and dependency edges', () => {
		const value = {
			name: 'react-dom',
			version: '18.3.1',
			dist: {
				tarball: 'https://registry.npmjs.org/react-dom/-/react-dom-18.3.1.tgz',
				integrity: `sha512-${Buffer.alloc(64).toString('base64')}`,
				shasum: 'a'.repeat(40),
			},
			dependencies: { scheduler: '^0.23.2', 'loose-envify': '^1.1.0' },
		};
		expect(
			parseReactCalculatorTargetMetadata(value, { name: 'react-dom', version: '18.3.1' }),
		).toMatchObject({
			resolved: 'https://registry.npmjs.org/react-dom/-/react-dom-18.3.1.tgz',
		});
		for (const changed of [
			{ ...value, version: '18.3.0' },
			{ ...value, dependencies: { scheduler: '^0.23.1' } },
			{ ...value, dist: { ...value.dist, tarball: 'https://example.com/react-dom.tgz' } },
		])
			expect(() =>
				parseReactCalculatorTargetMetadata(changed, {
					name: 'react-dom',
					version: '18.3.1',
				}),
			).toThrow();
	});

	test('streams fragmented gzip with distinct wire and decoded identities', async () => {
		const decoded = Buffer.from('{"version":1}');
		const wire = gzipSync(decoded);
		const result = await collectReactCalculatorResponse(
			Readable.from([wire.subarray(0, 3), wire.subarray(3, 11), wire.subarray(11)]),
			{ encoding: 'gzip', wireLimit: 100, decodedLimit: 100 },
		);
		expect(result.decoded).toEqual(decoded);
		expect(result.wireByteLength).toBe(wire.length);
		expect(result.decodedByteLength).toBe(decoded.length);
		expect(result.wireSha256).not.toBe(result.decodedSha256);
	});

	test('rejects wire, expansion, corrupt gzip and late events without hanging', async () => {
		await expect(
			collectReactCalculatorResponse(Readable.from([Buffer.alloc(11)]), {
				encoding: 'identity',
				wireLimit: 10,
				decodedLimit: 20,
			}),
		).rejects.toMatchObject({ code: 'response-wire-cap-exceeded' });
		const expanded = gzipSync(Buffer.alloc(1_000));
		await expect(
			collectReactCalculatorResponse(Readable.from([expanded]), {
				encoding: 'gzip',
				wireLimit: expanded.length,
				decodedLimit: 999,
			}),
		).rejects.toMatchObject({ code: 'response-decoded-cap-exceeded' });
		for (const corrupt of [Buffer.from('corrupt'), expanded.subarray(0, expanded.length - 3)])
			await expect(
				collectReactCalculatorResponse(Readable.from([corrupt]), {
					encoding: 'gzip',
					wireLimit: 100,
					decodedLimit: 2_000,
				}),
			).rejects.toMatchObject({ code: 'response-gzip-decode-failed' });
		const late = new Readable({ read() {} });
		const pending = collectReactCalculatorResponse(late, {
			encoding: 'identity',
			wireLimit: 1,
			decodedLimit: 1,
		});
		late.push(Buffer.from('too-large'));
		late.push(Buffer.from('late'));
		late.push(null);
		await expect(pending).rejects.toMatchObject({ code: 'response-wire-cap-exceeded' });
	});

	test('enforces independent aggregate wire and decoded caps before acceptance', async () => {
		const total = 750 * 1024 * 1024;
		expect(
			reactCalculatorResponseLimits(
				{ wireBytes: total - 1, decodedBytes: total - 2 },
				10 * 1024 * 1024,
			),
		).toEqual({ wireLimit: 1, decodedLimit: 2 });
		const state = {
			requests: 1,
			responses: 0,
			wireBytes: total - 1,
			decodedBytes: total - 2,
			cookieResponses: 0,
			ledger: [],
		};
		const limits = reactCalculatorResponseLimits(state, 10);
		await expect(
			collectReactCalculatorResponse(Readable.from([Buffer.from('xx')]), {
				encoding: 'identity',
				...limits,
			}),
		).rejects.toMatchObject({ code: 'response-wire-cap-exceeded' });
		expect(state.responses).toBe(0);
		expect(state.ledger).toEqual([]);
	});

	test('rolls back every publication target when any atomic publication move fails', async () => {
		const removed: string[] = [];
		let moves = 0;
		await expect(
			publishReactCalculatorTransaction(
				{
					cacheStage: 'stage/cache',
					ingestReceiptStage: 'stage/ingest',
					dependencyReceiptStage: 'stage/dependency',
					cacheTarget: 'published/cache',
					ingestReceiptTarget: 'published/ingest',
					dependencyReceiptTarget: 'published/dependency',
				},
				{
					mkdir: async () => undefined,
					rename: async () => {
						moves += 1;
						if (moves === 2) throw new Error('injected publication failure');
					},
					rm: async (target) => {
						removed.push(String(target));
					},
				},
			),
		).rejects.toThrow('injected publication failure');
		expect(removed).toEqual(['published/cache', 'published/ingest', 'published/dependency']);
	});

	test('rejects weak, moving, foreign and undersized lock closures', () => {
		const weak = lockWith(100);
		(weak.dependencies as Record<string, { integrity: string }>)['package-0']!.integrity =
			'md5-weak';
		const moving = lockWith(100);
		(moving.dependencies as Record<string, { resolved: string }>)['package-0']!.resolved +=
			'?moving=true';
		for (const value of [
			lockWith(99),
			lockWith(2_501),
			weak,
			moving,
			{ ...lockWith(100), lockfileVersion: 2 },
		])
			expect(() => analyzeReactCalculatorLock(value)).toThrow();
	});

	test('rejects archive traversal, multiple roots and small archives', () => {
		const safe = Array.from({ length: 20 }, (_, index) => `root/file-${index}.txt`);
		expect(() => assertReactCalculatorArchiveEntries(safe)).not.toThrow();
		for (const entries of [
			safe.slice(0, 19),
			[...safe.slice(0, 19), '../escape'],
			[...safe.slice(0, 19), 'other/file.txt'],
			[...safe.slice(0, 19), 'root\\escape.txt'],
		])
			expect(() => assertReactCalculatorArchiveEntries(entries)).toThrow();
	});

	test('requires one bounded duplicate-free package root before extraction', () => {
		expect(() =>
			assertReactCalculatorPackageEntries([
				'package/package.json',
				'package/index.js',
				'package/lib/',
				'package/lib/value.js',
			]),
		).not.toThrow();
		for (const entries of [
			['package/index.js'],
			['package/package.json', '../escape'],
			['package/package.json', 'other/file.js'],
			['package/package.json', 'package\\escape'],
			['package/package.json', 'package/lib/../escape'],
			['package/package.json', 'package/index.js', 'package/index.js'],
			Array.from({ length: 100_001 }, (_, index) => `package/file-${index}`),
		])
			expect(() => assertReactCalculatorPackageEntries(entries)).toThrow();
	});
});
