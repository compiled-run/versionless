import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import { canonicalize, sha256 } from '../../core/src/receipts/canonicalize.ts';
import { deriveCorpusTransactionState } from '../../core/src/corpus/conformance.ts';
import { compareUtf16CodeUnits } from '../../core/src/bundlers/vite8-adapter.ts';
import { reactAvataaarsCompatibilityAggregateMember } from '../../core/src/receipts/react-avataaars-compatibility.ts';
import {
	verifyWitnessAngularRealworldEvidence,
	witnessAngularRealworldAggregateMember,
} from '../../core/src/receipts/witness-angular-realworld.ts';
import {
	verifyWitnessReactBoilerplateEvidence,
	witnessReactBoilerplateAggregateMember,
} from '../../core/src/receipts/witness-react-boilerplate.ts';
import {
	verifyWitnessNextKilledByGoogleEvidence,
	witnessNextKilledByGoogleAggregateMember,
} from '../../core/src/receipts/witness-next-killedbygoogle.ts';
import {
	ANGULAR_FACTORIOLAB_TRUST_MATRIX_CELLS,
	ANGULAR_FACTORIOLAB_TRUST_RECEIPTS,
	ANGULAR_JIRA_CLONE_TRUST_MATRIX_CELLS,
	ANGULAR_JIRA_CLONE_TRUST_RECEIPTS,
	NEXT_KILLEDBYGOOGLE_V3_TRUST_MATRIX_CELLS,
	NEXT_KILLEDBYGOOGLE_V3_TRUST_RECEIPTS,
	REACT_LINKFREE_TRUST_MATRIX_CELLS,
	REACT_LINKFREE_TRUST_RECEIPTS,
	ANGULAR_TINY_TRANSLATOR_TRUST_MATRIX_CELLS,
	ANGULAR_TINY_TRANSLATOR_TRUST_RECEIPTS,
	REACT_MEMOS_TRUST_MATRIX_CELLS,
	REACT_MEMOS_TRUST_RECEIPTS,
	generateTrustPackage,
	licenseInventory,
	NPM_LOCK_ACQUISITION_PREFLIGHT,
	NEXT_TAILWIND_CONSENT_FAILURE,
	NEXT_TAILWIND_EXCLUSION,
	compareTrustResolvedDependencies,
	renderNextTailwindExclusionMarkdown,
	reactAvataaarsCompatibilityTrustReceipts,
	reactGraphiQL013TrustReceipts,
	validateCycloneDx17,
	validateNpmLockAcquisitionPreflight,
	validateNextTailwindConsentFailure,
	validateNextTailwindExclusion,
} from '../src/generate.ts';
import {
	ADAPTER_FREEZE_COMPOSITE,
	adapterFreezePreimage,
	adapterFreezeRecord,
	verifyAdapterFreezeRecord,
} from '../src/freeze.ts';
import { ingestTrustInputs, lockPackages, osvRequest } from '../src/ingest.ts';
import { verifyTrustPackage } from '../src/verify.ts';

const root = path.resolve(import.meta.dirname, '../../..');
const observedAt = '2026-08-05T12:00:00.000Z';
const offline = { VERSIONLESS_NETWORK_MODE: 'offline' };
const expectedResolvedPackages = 187;
const expectedWorkspacePackages = 10;
const expectedComponents = expectedResolvedPackages + expectedWorkspacePackages;

async function distributionInventory(
	directory = path.join(root, 'packages'),
): Promise<Array<{ path: string; sha256: string }>> {
	const files: string[] = [];
	const visit = async (current: string): Promise<void> => {
		for (const entry of await readdir(current, { withFileTypes: true })) {
			const item = path.join(current, entry.name);
			if (entry.isDirectory()) await visit(item);
			else if (entry.isFile() && item.includes(`${path.sep}dist${path.sep}`))
				files.push(item);
		}
	};
	await visit(directory);
	return await Promise.all(
		files.sort(compareUtf16CodeUnits).map(async (file) => ({
			path: path.relative(root, file),
			sha256: sha256(await readFile(file)),
		})),
	);
}

async function setup(): Promise<{
	directory: string;
	cache: string;
	current: string;
	replay: string;
}> {
	const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-trust-'));
	const cache = path.join(directory, 'cache');
	const calls: Array<{ url: string; body?: string }> = [];
	const resolvedPackages = lockPackages(
		await readFile(path.join(root, 'pnpm-lock.yaml'), 'utf8'),
	);
	const ingest = await ingestTrustInputs({
		rootDir: root,
		cacheDir: cache,
		allowNetwork: true,
		consentId: 'unit-consent',
		environment: {
			VERSIONLESS_NETWORK_MODE: 'consented',
			VERSIONLESS_CONSENT_ID: 'unit-consent',
		},
		observedAt,
		fetcher: async (input, init) => {
			const url = String(input);
			calls.push({ url, body: typeof init?.body === 'string' ? init.body : undefined });
			return new Response(
				url.includes('querybatch')
					? JSON.stringify({ results: resolvedPackages.map(() => ({})) })
					: JSON.stringify({ vulnerabilities: [] }),
				{ status: 200 },
			);
		},
	});
	expect(calls).toHaveLength(2);
	const request = JSON.parse(calls[0]?.body ?? '{}') as { queries?: unknown[] };
	expect(request.queries).toHaveLength(expectedResolvedPackages);
	expect(calls[0]?.url).toBe('https://api.osv.dev/v1/querybatch');
	expect(calls[1]?.url).toContain('known_exploited_vulnerabilities.json');
	expect(ingest.sources[0].requestSha256).toBe(sha256(calls[0]?.body ?? ''));
	const current = path.join(directory, 'current');
	const replay = path.join(directory, 'replay');
	await generateTrustPackage({
		rootDir: root,
		cacheDir: cache,
		policyPath: 'trust/policy.json',
		outputDir: current,
		offline: true,
		environment: offline,
		observedAt,
	});
	await generateTrustPackage({
		rootDir: root,
		cacheDir: cache,
		policyPath: 'trust/policy.json',
		outputDir: replay,
		offline: true,
		environment: offline,
		observedAt: '2026-08-05T12:01:00.000Z',
	});
	return { directory, cache, current, replay };
}

async function rewriteArtifact(
	directory: string,
	name: string,
	transform: (value: Record<string, unknown>) => void,
): Promise<void> {
	const file = path.join(directory, name);
	const value = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
	transform(value);
	await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
	const manifestPath = path.join(directory, 'manifest.json');
	const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
		canonicalDigest: string;
		deterministicCore: {
			digest: string;
			artifacts: Array<{ path: string; sha256: string }>;
		};
		receipts: unknown[];
		observation: { vulnerabilityFreshness: string };
	};
	const artifact = manifest.deterministicCore.artifacts.find((item) => item.path === name);
	if (!artifact) throw new Error('test artifact absent');
	artifact.sha256 = sha256(await readFile(file));
	manifest.deterministicCore.digest = sha256(
		canonicalize({
			artifacts: manifest.deterministicCore.artifacts,
			receipts: manifest.receipts,
		}),
	);
	manifest.canonicalDigest = '';
	manifest.canonicalDigest = sha256(canonicalize(manifest));
	await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

describe('offline-first trust package', () => {
	it('routes only the uncounted GraphiQL candidate receipt into trust generation', () => {
		expect(
			reactGraphiQL013TrustReceipts({ kind: 'react-graphiql-013-candidate' } as never),
		).toEqual([
			{
				path: 'evidence/runs/react-graphiql-react15-to-vite8/receipt.json',
				digest: null,
			},
		]);
		expect(reactGraphiQL013TrustReceipts({ kind: 'canonical' } as never)).toEqual([]);
	});
	it('orders mixed-case BV/Bh distribution paths by raw UTF-16 code units', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-dist-order-'));
		const upper = 'packages/cli/dist/BV-ordering-fixture.js';
		const lower = 'packages/cli/dist/Bh-ordering-fixture.js';
		expect([lower, upper].sort(compareUtf16CodeUnits)).toEqual([upper, lower]);
		try {
			await mkdir(path.join(directory, 'packages/cli/dist'), { recursive: true });
			await writeFile(path.join(directory, upper), 'upper-fixture\n');
			await writeFile(path.join(directory, lower), 'lower-fixture\n');
			expect(await distributionInventory(directory)).toEqual([
				{
					path: path.relative(root, path.join(directory, upper)),
					sha256: '707f7ec53b3c5e72d810fb4db227b7d68e7f9be765b19207e86b2a11fc538e31',
				},
				{
					path: path.relative(root, path.join(directory, lower)),
					sha256: '8a7586b8022bd2445bc49f52eb37d45b7305486cc1575159309bbb26b91e2224',
				},
			]);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
	it('orders mixed-case resolved dependency URIs by raw UTF-16 code units', () => {
		const upper = { uri: 'packages/cli/dist/BV-ordering-fixture.js' };
		const lower = { uri: 'packages/cli/dist/Bh-ordering-fixture.js' };
		expect([lower, upper].sort(compareTrustResolvedDependencies)).toEqual([upper, lower]);
	});
	it('parses only deterministic top-level pnpm package coordinates', async () => {
		const fixture = `lockfileVersion: '9.0'

packages:

  '@scope/pkg@1.2.3(peer@2.0.0)':
    peerDependencies:
      '@nested/peer': 2.0.0
    peerDependenciesMeta:
      '@nested/optional':
        optional: true

  plain@4.5.6:
    optionalDependencies:
      '@nested/optional': 1.0.0

snapshots:

  '@scope/pkg@1.2.3(peer@2.0.0)': {}
`;
		expect(lockPackages(fixture)).toEqual([
			{ name: '@scope/pkg', version: '1.2.3(peer@2.0.0)' },
			{ name: 'plain', version: '4.5.6' },
		]);
		expect(JSON.parse(osvRequest(lockPackages(fixture))).queries).toEqual([
			{ package: { ecosystem: 'npm', name: '@scope/pkg' }, version: '1.2.3' },
			{ package: { ecosystem: 'npm', name: 'plain' }, version: '4.5.6' },
		]);
		const current = lockPackages(await readFile(path.join(root, 'pnpm-lock.yaml'), 'utf8'));
		expect(current).toHaveLength(expectedResolvedPackages);
		expect(new Set(current.map((item) => `${item.name}@${item.version}`)).size).toBe(
			expectedResolvedPackages,
		);
	});

	it('rejects duplicate and malformed pnpm package coordinates', () => {
		for (const entry of [
			'  duplicate@1.0.0:\n  duplicate@1.0.0:',
			"  ' bad@1.0.0':",
			'  @broken@1.0.0:',
			'  empty@:',
			'  missing-separator:',
		])
			expect(() => lockPackages(`packages:\n${entry}\n\nsnapshots:\n`)).toThrow();
	});

	it('refuses every consent bypass before fetch', async () => {
		let calls = 0;
		const fetcher = async () => {
			calls++;
			return new Response('{}');
		};
		for (const options of [
			{
				allowNetwork: false,
				consentId: 'x',
				environment: { VERSIONLESS_NETWORK_MODE: 'consented', VERSIONLESS_CONSENT_ID: 'x' },
			},
			{
				allowNetwork: true,
				consentId: '',
				environment: { VERSIONLESS_NETWORK_MODE: 'consented', VERSIONLESS_CONSENT_ID: '' },
			},
			{
				allowNetwork: true,
				consentId: 'x',
				environment: { VERSIONLESS_NETWORK_MODE: 'offline', VERSIONLESS_CONSENT_ID: 'x' },
			},
			{
				allowNetwork: true,
				consentId: 'x',
				environment: { VERSIONLESS_NETWORK_MODE: 'consented', VERSIONLESS_CONSENT_ID: 'y' },
			},
		])
			await expect(
				ingestTrustInputs({ rootDir: root, fetcher, ...options }),
			).rejects.toThrow();
		expect(calls).toBe(0);
	});

	it('rejects request-hash and source-kind/order tampering', async () => {
		const fixture = await setup();
		try {
			const ingestPath = path.join(fixture.cache, 'ingest.json');
			const original = JSON.parse(await readFile(ingestPath, 'utf8')) as {
				sources: Array<Record<string, unknown>>;
			};
			const requestTamper = structuredClone(original);
			if (requestTamper.sources[0]) requestTamper.sources[0].requestSha256 = '0'.repeat(64);
			await writeFile(ingestPath, JSON.stringify(requestTamper));
			await expect(
				generateTrustPackage({
					rootDir: root,
					cacheDir: fixture.cache,
					policyPath: 'trust/policy.json',
					outputDir: path.join(fixture.directory, 'request-tamper'),
					offline: true,
					environment: offline,
					observedAt,
				}),
			).rejects.toThrow('request digest');
			const sourceTamper = structuredClone(original);
			sourceTamper.sources.reverse();
			await writeFile(ingestPath, JSON.stringify(sourceTamper));
			await expect(
				generateTrustPackage({
					rootDir: root,
					cacheDir: fixture.cache,
					policyPath: 'trust/policy.json',
					outputDir: path.join(fixture.directory, 'source-tamper'),
					offline: true,
					environment: offline,
					observedAt,
				}),
			).rejects.toThrow('source');
		} finally {
			await rm(fixture.directory, { recursive: true, force: true });
		}
	}, 30_000);

	it('rejects malformed CycloneDX coordinates and inventory mismatches', async () => {
		const fixture = await setup();
		try {
			const malformed = path.join(fixture.directory, 'malformed-cdx');
			await cp(fixture.current, malformed, { recursive: true });
			await rewriteArtifact(malformed, 'dependency-graph.cdx.json', (value) => {
				const components = value.components as Array<Record<string, unknown>>;
				const library = components.find((item) => item.type === 'library');
				if (library) library.name = ' invalid';
			});
			await expect(
				verifyTrustPackage({
					rootDir: root,
					outputDir: malformed,
					environment: offline,
					now: observedAt,
				}),
			).rejects.toThrow('CycloneDX component.name');
			const sourceGraph = JSON.parse(
				await readFile(path.join(fixture.current, 'dependency-graph.cdx.json'), 'utf8'),
			) as { components: Array<Record<string, unknown>> };
			const badPurl = structuredClone(sourceGraph);
			const purlLibrary = badPurl.components.find((item) => item.type === 'library');
			if (purlLibrary) purlLibrary.purl = 'pkg:npm/ malformed@1.0.0';
			expect(() => validateCycloneDx17(badPurl)).toThrow('purl');
			const badRef = structuredClone(sourceGraph);
			const refLibrary = badRef.components.find((item) => item.type === 'library');
			if (refLibrary) refLibrary['bom-ref'] = '';
			expect(() => validateCycloneDx17(badRef)).toThrow('reference');
			const phantom = path.join(fixture.directory, 'phantom-inventory');
			await cp(fixture.current, phantom, { recursive: true });
			await rewriteArtifact(phantom, 'dependency-graph.cdx.json', (value) => {
				const components = value.components as Array<Record<string, unknown>>;
				const dependencies = value.dependencies as Array<Record<string, unknown>>;
				const ref = 'pkg:npm/phantom@1.0.0';
				components.push({
					type: 'library',
					'bom-ref': ref,
					name: 'phantom',
					version: '1.0.0',
					purl: ref,
				});
				dependencies.push({ ref });
				const rooted = dependencies.find((item) => item.ref === 'workspace:.');
				if (rooted && Array.isArray(rooted.dependsOn)) rooted.dependsOn.push(ref);
			});
			await expect(
				verifyTrustPackage({
					rootDir: root,
					outputDir: phantom,
					environment: offline,
					now: observedAt,
				}),
			).rejects.toThrow('inventory count mismatch');
			const mismatched = path.join(fixture.directory, 'mismatched-inventory');
			await cp(fixture.current, mismatched, { recursive: true });
			await rewriteArtifact(mismatched, 'licenses.json', (value) => {
				(value.coverage as Record<string, unknown>).resolvedPackages = 178;
			});
			await expect(
				verifyTrustPackage({
					rootDir: root,
					outputDir: mismatched,
					environment: offline,
					now: observedAt,
				}),
			).rejects.toThrow('count mismatch');
		} finally {
			await rm(fixture.directory, { recursive: true, force: true });
		}
	}, 30_000);

	it('rejects exact workspace SBOM and license omission, substitution, and duplication', async () => {
		const fixture = await setup();
		try {
			for (const [label, mutate] of [
				[
					'omitted',
					(components: Array<Record<string, unknown>>) => {
						components.splice(
							components.findIndex(
								(component) =>
									component['bom-ref'] === 'workspace:packages/frameworks/nextjs',
							),
							1,
						);
					},
				],
				[
					'substituted',
					(components: Array<Record<string, unknown>>) => {
						const component = components.find(
							(item) => item['bom-ref'] === 'workspace:packages/frameworks/nextjs',
						);
						if (component) component.name = '@versionless/substituted';
					},
				],
				[
					'duplicated',
					(components: Array<Record<string, unknown>>) => {
						const nextIndex = components.findIndex(
							(item) => item['bom-ref'] === 'workspace:packages/frameworks/nextjs',
						);
						const cli = components.find(
							(item) => item['bom-ref'] === 'workspace:packages/cli',
						);
						if (nextIndex >= 0 && cli) components[nextIndex] = structuredClone(cli);
					},
				],
			] as const) {
				const graphOutput = path.join(fixture.directory, `workspace-graph-${label}`);
				await cp(fixture.current, graphOutput, { recursive: true });
				await rewriteArtifact(graphOutput, 'dependency-graph.cdx.json', (value) => {
					mutate(value.components as Array<Record<string, unknown>>);
				});
				await expect(
					verifyTrustPackage({
						rootDir: root,
						outputDir: graphOutput,
						environment: offline,
						now: observedAt,
					}),
				).rejects.toThrow();

				const licenseOutput = path.join(fixture.directory, `workspace-license-${label}`);
				await cp(fixture.current, licenseOutput, { recursive: true });
				await rewriteArtifact(licenseOutput, 'licenses.json', (value) => {
					const entries = value.entries as Array<Record<string, unknown>>;
					const workspaceEntries = entries.filter(
						(entry) => entry.source !== 'pnpm-lock.yaml',
					);
					const nextIndex = workspaceEntries.findIndex(
						(entry) => entry.source === 'packages/frameworks/nextjs/package.json',
					);
					if (label === 'omitted') workspaceEntries.splice(nextIndex, 1);
					else if (label === 'substituted' && nextIndex >= 0)
						workspaceEntries[nextIndex]!.name = '@versionless/substituted';
					else if (label === 'duplicated' && nextIndex >= 0) {
						const cli = workspaceEntries.find(
							(entry) => entry.source === 'packages/cli/package.json',
						);
						if (cli) workspaceEntries[nextIndex] = structuredClone(cli);
					}
					value.entries = [
						...workspaceEntries,
						...entries.filter((entry) => entry.source === 'pnpm-lock.yaml'),
					];
				});
				await expect(
					verifyTrustPackage({
						rootDir: root,
						outputDir: licenseOutput,
						environment: offline,
						now: observedAt,
					}),
				).rejects.toThrow();
			}
		} finally {
			await rm(fixture.directory, { recursive: true, force: true });
		}
	}, 30_000);

	it('rejects every synthetic Next matrix membership or support tamper', async () => {
		const fixture = await setup();
		try {
			for (const [label, mutate] of [
				[
					'missing',
					(cells: Array<Record<string, unknown>>) => {
						cells.splice(
							cells.findIndex((cell) => cell.id === 'synthetic-next12-pages'),
							1,
						);
					},
				],
				[
					'extra',
					(cells: Array<Record<string, unknown>>) => {
						const source = cells.find((cell) => cell.id === 'synthetic-next14-app');
						if (source)
							cells.push({ ...structuredClone(source), id: 'synthetic-next-extra' });
					},
				],
				[
					'renamed',
					(cells: Array<Record<string, unknown>>) => {
						const cell = cells.find(
							(item) => item.id === 'synthetic-next13-transition-app',
						);
						if (cell) cell.id = 'synthetic-next13-renamed';
					},
				],
				[
					'duplicated',
					(cells: Array<Record<string, unknown>>) => {
						const next12 = cells.find((cell) => cell.id === 'synthetic-next12-pages');
						const next14Index = cells.findIndex(
							(cell) => cell.id === 'synthetic-next14-app',
						);
						if (next12 && next14Index >= 0)
							cells[next14Index] = structuredClone(next12);
					},
				],
				[
					'strengthened',
					(cells: Array<Record<string, unknown>>) => {
						const cell = cells.find((item) => item.id === 'synthetic-next14-app');
						if (cell) cell.support = 'verified';
					},
				],
			] as const) {
				const output = path.join(fixture.directory, `next-matrix-${label}`);
				await cp(fixture.current, output, { recursive: true });
				await rewriteArtifact(output, 'matrix.json', (value) => {
					mutate(value.cells as Array<Record<string, unknown>>);
				});
				await expect(
					verifyTrustPackage({
						rootDir: root,
						outputDir: output,
						environment: offline,
						now: observedAt,
					}),
				).rejects.toThrow();
			}
		} finally {
			await rm(fixture.directory, { recursive: true, force: true });
		}
	}, 30_000);

	it('is byte-identical across roots and keeps multiple candidates ambiguous', async () => {
		const left = await mkdtemp(path.join(os.tmpdir(), 'versionless-license-left-'));
		const right = await mkdtemp(path.join(os.tmpdir(), 'versionless-license-right-'));
		const roots = [left, right];
		try {
			for (const directory of roots) {
				for (const peer of ['peer-a']) {
					const packageDir = path.join(
						directory,
						'.versionless/cache/pnpm-virtual-store',
						`ambiguous@1.0.0_${peer}`,
						'node_modules/ambiguous',
					);
					await mkdir(packageDir, { recursive: true });
					await writeFile(
						path.join(packageDir, 'package.json'),
						JSON.stringify({ name: 'ambiguous', version: '1.0.0', license: 'MIT' }),
					);
					await writeFile(path.join(packageDir, 'LICENSE'), 'portable license text\n');
				}
			}
			const verified = await Promise.all(
				roots.map((directory) =>
					licenseInventory(
						directory,
						[{ name: 'ambiguous', version: '1.0.0(peer@2.0.0)' }],
						[],
					),
				),
			);
			expect(canonicalize(verified[0])).toBe(canonicalize(verified[1]));
			for (const directory of roots) {
				const packageDir = path.join(
					directory,
					'.versionless/cache/pnpm-virtual-store',
					'ambiguous@1.0.0_peer-b',
					'node_modules/ambiguous',
				);
				await mkdir(packageDir, { recursive: true });
				await writeFile(
					path.join(packageDir, 'package.json'),
					JSON.stringify({ name: 'ambiguous', version: '1.0.0', license: 'Apache-2.0' }),
				);
				await writeFile(path.join(packageDir, 'LICENSE'), 'conflicting license text\n');
			}
			const ambiguous = await Promise.all(
				roots.map((directory) =>
					licenseInventory(
						directory,
						[{ name: 'ambiguous', version: '1.0.0(peer@2.0.0)' }],
						[],
					),
				),
			);
			expect(canonicalize(ambiguous[0])).toBe(canonicalize(ambiguous[1]));
			const firstAmbiguous = ambiguous[0];
			if (!firstAmbiguous) throw new Error('Cross-root license inventory missing');
			const entry = (firstAmbiguous.entries as Array<Record<string, unknown>>)[0];
			expect(entry).toBeDefined();
			if (!entry) throw new Error('License test entry missing');
			expect((entry.spdxExpression as Record<string, unknown>).state).toBe('ambiguous');
			expect((entry.licenseText as Record<string, unknown>).state).toBe('ambiguous');
		} finally {
			await Promise.all(
				roots.map((directory) => rm(directory, { recursive: true, force: true })),
			);
		}
	});

	it('replays the deterministic core while keeping observations outside it', async () => {
		const verifiedWitness = await verifyWitnessAngularRealworldEvidence(root);
		const expectedWitnessMember = witnessAngularRealworldAggregateMember(
			verifiedWitness.digest,
		);
		const aggregate = JSON.parse(
			await readFile(path.join(root, 'evidence/runs/aggregate.json'), 'utf8'),
		) as { fixtures: Array<Record<string, unknown>> };
		const transaction = deriveCorpusTransactionState(aggregate.fixtures);
		const withoutAvataaars = aggregate.fixtures.filter(
			(item) =>
				item.id !== 'react-avataaars-compatibility-to-vite8' &&
				item.id !== 'react-boilerplate-v4-zero-sw' &&
				item.id !== 'witness-react-boilerplate-zero-sw' &&
				item.id !== 'react-papercups-v1-0-0' &&
				item.id !== 'witness-react-papercups' &&
				item.id !== 'react-hospitalrun' &&
				item.id !== 'witness-react-hospitalrun' &&
				item.id !== 'witness-angular-factoriolab' &&
				item.id !== 'witness-angular-jira-clone' &&
				item.id !== 'witness-react-memos-v0-1-3' &&
				item.id !== 'witness-next-killedbygoogle-v3-0-0' &&
				item.id !== 'witness-react-linkfree-v0-72-0' &&
				item.id !== 'witness-angular-tiny-translator',
		);
		const avataaarsTransaction = deriveCorpusTransactionState([
			...withoutAvataaars,
			reactAvataaarsCompatibilityAggregateMember('6'.repeat(64)),
		]);
		expect(reactAvataaarsCompatibilityTrustReceipts(avataaarsTransaction)).toEqual([
			{
				path: 'evidence/runs/react-avataaars-compatibility-to-vite8/t608/receipt.json',
				digest: null,
			},
		]);
		const verifiedReact = transaction.reactBoilerplateWitnessIntegrated
			? await verifyWitnessReactBoilerplateEvidence(root)
			: null;
		const verifiedNextWitness = transaction.nextKilledByGoogleWitnessIntegrated
			? await verifyWitnessNextKilledByGoogleEvidence(root)
			: null;
		expect(
			aggregate.fixtures.filter((item) => item.receipt === expectedWitnessMember.receipt),
		).toEqual([expectedWitnessMember]);
		if (verifiedReact !== null) {
			const expectedReactMember = witnessReactBoilerplateAggregateMember(
				verifiedReact.digest,
			);
			expect(
				aggregate.fixtures.filter((item) => item.receipt === expectedReactMember.receipt),
			).toEqual([expectedReactMember]);
		}
		if (verifiedNextWitness !== null) {
			const expectedNextWitness = witnessNextKilledByGoogleAggregateMember(
				verifiedNextWitness.digest,
			);
			expect(
				aggregate.fixtures.filter((item) => item.receipt === expectedNextWitness.receipt),
			).toEqual([expectedNextWitness]);
		}
		const fixture = await setup();
		try {
			const result = await verifyTrustPackage({
				rootDir: root,
				outputDir: fixture.current,
				compareDir: fixture.replay,
				environment: offline,
				now: '2026-08-05T12:01:00.000Z',
			});
			expect(result.valid).toBe(true);
			const first = JSON.parse(
				await readFile(path.join(fixture.current, 'manifest.json'), 'utf8'),
			) as {
				canonicalDigest: string;
				deterministicCore: { digest: string; artifacts: unknown[] };
				receipts: Array<{ path: string; digest: string; artifacts: number; state: string }>;
			};
			const second = JSON.parse(
				await readFile(path.join(fixture.replay, 'manifest.json'), 'utf8'),
			) as typeof first;
			expect(first.deterministicCore.digest).toBe(second.deterministicCore.digest);
			expect(first.canonicalDigest).not.toBe(second.canonicalDigest);
			expect(first.deterministicCore.artifacts).toHaveLength(11);
			expect(first.receipts).toHaveLength(transaction.receipts);
			expect(
				first.receipts.filter(
					(item) => item.path === 'evidence/runs/witness-angular-realworld/receipt.json',
				),
			).toEqual([
				{
					path: 'evidence/runs/witness-angular-realworld/receipt.json',
					digest: verifiedWitness.digest,
					artifacts: verifiedWitness.artifacts,
					state: 'verified',
				},
			]);
			expect(
				first.receipts.filter(
					(item) => item.path === 'evidence/runs/witness-react-boilerplate/receipt.json',
				),
			).toEqual(
				verifiedReact === null
					? []
					: [
							{
								path: 'evidence/runs/witness-react-boilerplate/receipt.json',
								digest: verifiedReact.digest,
								artifacts: verifiedReact.artifacts,
								state: 'verified',
							},
						],
			);
			expect(
				first.receipts.filter(
					(item) =>
						item.path === 'evidence/runs/witness-next-killedbygoogle/receipt.json',
				),
			).toEqual(
				verifiedNextWitness === null
					? []
					: [
							{
								path: 'evidence/runs/witness-next-killedbygoogle/receipt.json',
								digest: verifiedNextWitness.digest,
								artifacts: verifiedNextWitness.artifacts,
								state: 'verified',
							},
						],
			);
			expect(
				first.receipts.find(
					(item) =>
						item.path ===
						'evidence/runs/next-killedbygoogle-derived-state-to-memo/receipt.json',
				),
			).toEqual({
				path: 'evidence/runs/next-killedbygoogle-derived-state-to-memo/receipt.json',
				digest: 'a018c6490cd559fab74ea402ff93660f053503dbed1a52ba9b68ed7fdc086b7c',
				artifacts: 13,
				state: 'verified',
			});
			expect(
				first.receipts.find(
					(item) =>
						item.path === 'evidence/runs/angular-realworld-v15-to-v16/receipt.json',
				),
			).toEqual({
				path: 'evidence/runs/angular-realworld-v15-to-v16/receipt.json',
				digest: 'bba54bc67cf5686445b207c530e04c5f9d56cf87f495250e97329e1eed8c6ad1',
				artifacts: 20,
				state: 'verified',
			});
			const dependencyGraph = JSON.parse(
				await readFile(path.join(fixture.current, 'dependency-graph.cdx.json'), 'utf8'),
			) as { components: Array<Record<string, unknown>> };
			expect(dependencyGraph.components).toHaveLength(expectedComponents);
			expect(
				dependencyGraph.components.filter((item) => item.type === 'application'),
			).toHaveLength(expectedWorkspacePackages);
			expect(
				dependencyGraph.components.filter((item) => item.type === 'library'),
			).toHaveLength(expectedResolvedPackages);
			expect(
				dependencyGraph.components.find(
					(item) => item['bom-ref'] === 'workspace:packages/frameworks/angular',
				),
			).toMatchObject({
				type: 'application',
				name: '@versionless/angular',
				version: '0.0.1',
				properties: [
					{
						name: 'versionless:source',
						value: 'packages/frameworks/angular/package.json',
					},
					{ name: 'versionless:state', value: 'verified' },
				],
			});
			const provenance = JSON.parse(
				await readFile(path.join(fixture.current, 'provenance.json'), 'utf8'),
			) as {
				subject: unknown[];
				predicate: {
					buildDefinition: {
						resolvedDependencies: Array<{
							uri: string;
							digest: { sha256: string };
						}>;
					};
					runDetails: { byproducts: unknown[] };
				};
			};
			const distributions = await distributionInventory();
			expect(provenance.subject).toEqual(
				distributions.map((item) => ({ name: item.path, digest: { sha256: item.sha256 } })),
			);
			expect(provenance.predicate.runDetails.byproducts).toEqual(distributions);
			const dependencyUris = provenance.predicate.buildDefinition.resolvedDependencies.map(
				(item) => item.uri,
			);
			expect(new Set(dependencyUris).size).toBe(dependencyUris.length);
			expect(
				dependencyUris.filter((uri) => uri === NEXT_TAILWIND_CONSENT_FAILURE.path),
			).toEqual([NEXT_TAILWIND_CONSENT_FAILURE.path]);
			expect(
				provenance.predicate.buildDefinition.resolvedDependencies.filter(
					(item) => item.uri === 'evidence/runs/witness-angular-realworld/receipt.json',
				),
			).toEqual([
				{
					uri: 'evidence/runs/witness-angular-realworld/receipt.json',
					digest: { sha256: verifiedWitness.digest },
				},
			]);
			expect(
				provenance.predicate.buildDefinition.resolvedDependencies.filter(
					(item) => item.uri === NEXT_TAILWIND_CONSENT_FAILURE.path,
				),
			).toEqual([
				{
					uri: NEXT_TAILWIND_CONSENT_FAILURE.path,
					digest: { sha256: NEXT_TAILWIND_CONSENT_FAILURE.sha256 },
				},
			]);
			expect(
				provenance.predicate.buildDefinition.resolvedDependencies.filter(
					(item) => item.uri === 'evidence/runs/witness-react-boilerplate/receipt.json',
				),
			).toEqual(
				verifiedReact === null
					? []
					: [
							{
								uri: 'evidence/runs/witness-react-boilerplate/receipt.json',
								digest: { sha256: verifiedReact.digest },
							},
						],
			);
			expect(
				provenance.predicate.buildDefinition.resolvedDependencies.filter(
					(item) => item.uri === 'evidence/runs/witness-next-killedbygoogle/receipt.json',
				),
			).toEqual(
				verifiedNextWitness === null
					? []
					: [
							{
								uri: 'evidence/runs/witness-next-killedbygoogle/receipt.json',
								digest: { sha256: verifiedNextWitness.digest },
							},
						],
			);
			expect(
				provenance.predicate.buildDefinition.resolvedDependencies.filter(
					(item) => item.uri === NPM_LOCK_ACQUISITION_PREFLIGHT.path,
				),
			).toEqual([
				{
					uri: NPM_LOCK_ACQUISITION_PREFLIGHT.path,
					digest: { sha256: NPM_LOCK_ACQUISITION_PREFLIGHT.sha256 },
				},
			]);
			const matrix = JSON.parse(
				await readFile(path.join(fixture.current, 'matrix.json'), 'utf8'),
			) as { cells: Array<Record<string, unknown>> };
			expect(
				matrix.cells.find(
					(cell) => cell.id === 'next-killedbygoogle-derived-state-to-memo',
				),
			).toMatchObject({
				state: 'verified',
				framework: 'react',
				bundler: 'Next 12.0.10 webpack 5',
				designatedPilot: false,
				genericNextSupport: 'not-claimed',
			});
			expect(
				matrix.cells.find((cell) => cell.id === 'react-boilerplate-v4-vite8'),
			).toMatchObject({
				state: 'verified',
				bundler: 'Vite 8.0.16',
				adapter: 'fixture-specific',
				oldVite: 'not-tested',
				genericAdapter: 'not-tested',
				unplugin: 'not-tested',
			});
			expect(
				matrix.cells.find((cell) => cell.id === 'react-boilerplate-v4-data-flow'),
			).toMatchObject({
				state: 'verified',
				bundler: 'Vite 8.0.16',
				migration: 'connect-to-hooks',
				adapter: 'fixture-specific',
				designatedPilot: false,
			});
			for (const [id, routing] of [
				['synthetic-next12-pages', 'pages'],
				['synthetic-next13-transition-app', 'mixed'],
				['synthetic-next14-app', 'app'],
			] as const) {
				const cell = matrix.cells.find((item) => item.id === id);
				expect(cell).toMatchObject({
					id,
					framework: 'nextjs',
					routing,
					synthetic: true,
					state: 'not-tested',
					designatedPilot: false,
					productionStack: 'nextjs-preserved-not-tested',
				});
				for (const field of [
					'provenance',
					'migration',
					'build',
					'browser',
					'locality',
					'compilerBundlerRuntime',
					'tier',
					'pilot',
					'support',
				])
					expect(cell?.[field]).toBe('not-tested');
			}
			const conformance = JSON.parse(
				await readFile(path.join(fixture.current, 'corpus-conformance.json'), 'utf8'),
			) as {
				summary: Record<string, unknown>;
				frameworkLanes: Array<Record<string, unknown>>;
				coverage: Record<string, unknown>;
				integrity: { canonicalDigest: string };
			};
			expect(conformance.summary).toEqual({
				verticals: 19,
				sourceApplications: 11,
				designatedPilotsVerified: 0,
			});
			expect(conformance.frameworkLanes).toHaveLength(3);
			// Four more browser-proof cells now, each one member and one
			// vertical, and every one of their lineage scoreboards stays
			// uncounted.
			expect(matrix.cells).toHaveLength(ANGULAR_TINY_TRANSLATOR_TRUST_MATRIX_CELLS);
			expect(first.receipts).toHaveLength(ANGULAR_TINY_TRANSLATOR_TRUST_RECEIPTS);
			expect(ANGULAR_JIRA_CLONE_TRUST_MATRIX_CELLS).toBe(
				ANGULAR_FACTORIOLAB_TRUST_MATRIX_CELLS + 1,
			);
			expect(ANGULAR_JIRA_CLONE_TRUST_RECEIPTS).toBe(ANGULAR_FACTORIOLAB_TRUST_RECEIPTS + 1);
			expect(REACT_MEMOS_TRUST_MATRIX_CELLS).toBe(ANGULAR_JIRA_CLONE_TRUST_MATRIX_CELLS + 1);
			expect(REACT_MEMOS_TRUST_RECEIPTS).toBe(ANGULAR_JIRA_CLONE_TRUST_RECEIPTS + 1);
			expect(NEXT_KILLEDBYGOOGLE_V3_TRUST_MATRIX_CELLS).toBe(
				REACT_MEMOS_TRUST_MATRIX_CELLS + 1,
			);
			expect(NEXT_KILLEDBYGOOGLE_V3_TRUST_RECEIPTS).toBe(REACT_MEMOS_TRUST_RECEIPTS + 1);
			expect(REACT_LINKFREE_TRUST_MATRIX_CELLS).toBe(
				NEXT_KILLEDBYGOOGLE_V3_TRUST_MATRIX_CELLS + 1,
			);
			expect(REACT_LINKFREE_TRUST_RECEIPTS).toBe(NEXT_KILLEDBYGOOGLE_V3_TRUST_RECEIPTS + 1);
			expect(ANGULAR_TINY_TRANSLATOR_TRUST_MATRIX_CELLS).toBe(
				REACT_LINKFREE_TRUST_MATRIX_CELLS + 1,
			);
			expect(ANGULAR_TINY_TRANSLATOR_TRUST_RECEIPTS).toBe(REACT_LINKFREE_TRUST_RECEIPTS + 1);
			expect(matrix.cells.find((cell) => cell.id === 'angular-factoriolab')).toMatchObject({
				framework: 'angular',
				state: 'verified',
				scope: 'fixture-specific-angular-cli-browser-builder-10-to-16',
				genericAngularSupport: 'not-claimed',
				browserProof: 'verified-direct-witness',
				serviceWorker: 'no-service-worker-in-either-lane',
				serviceWorkerMasked: false,
				scrollSurface: 'measured-no-overflowing-document',
				readinessScoreboard: {
					angularLineage: { ready: 1, total: 4, counted: false },
					overall: { ready: 3, total: 12 },
				},
			});
			expect(matrix.cells.find((cell) => cell.id === 'angular-jira-clone')).toMatchObject({
				framework: 'angular',
				state: 'verified',
				scope: 'fixture-specific-angular-cli-custom-webpack-browser-builder-13-to-16',
				genericAngularSupport: 'not-claimed',
				browserProof: 'verified-direct-witness',
				serviceWorker: 'no-service-worker-in-either-lane',
				serviceWorkerMasked: false,
				scrollSurface: 'measured-no-overflowing-document',
				locality: {
					mode: 'offline',
					scope: 'process-scoped',
					osWideIsolation: false,
					successfulNonLoopback: 0,
					mockedNonLoopbackSeams: 10,
				},
				readinessScoreboard: {
					angularLineage: { ready: 1, total: 4, counted: false },
					overall: { ready: 3, total: 12 },
				},
			});
			expect(matrix.cells.find((cell) => cell.id === 'react-memos-v0-1-3')).toMatchObject({
				framework: 'react',
				state: 'verified',
				scope: 'fixture-specific-old-vite-origin-2-9-to-vite8',
				genericReactSupport: 'not-claimed',
				browserProof: 'verified-direct-witness',
				migrationClass: 'OLD-VITE-ORIGIN',
				projection: { label: 'synthetic-fixture-evidence-data' },
				scrollSurface: 'measured-no-overflowing-document',
				readinessScoreboard: {
					reactLineage: { ready: 1, total: 4, counted: false },
					overall: { ready: 3, total: 12 },
				},
			});
			expect(
				matrix.cells.find((cell) => cell.id === 'next-killedbygoogle-v3-0-0'),
			).toMatchObject({
				framework: 'next',
				state: 'verified',
				scope: 'fixture-specific-next12-static-export-to-vite8-client-build',
				genericNextSupport: 'not-claimed',
				browserProof: 'verified-direct-witness',
				serviceWorker: 'no-service-worker-in-either-lane',
				serviceWorkerMasked: false,
				// The lanes deliver the document differently and the cell says
				// so rather than claiming a byte parity the proof never had.
				documentDelivery: {
					baseline: 'pre-rendered-application-document',
					migrated: 'client-mounted-application-document',
					parityOracle: 'settled-dom-and-behaviour',
					byteParity: 'not-claimed',
				},
				scrollSurface: 'measured-genuine-viewport-scroll',
				locality: {
					mode: 'offline',
					scope: 'process-scoped',
					osWideIsolation: false,
					successfulNonLoopback: 0,
					mockedNonLoopbackSeams: 3,
				},
				readinessScoreboard: {
					nextLineage: { ready: 0, total: 1, counted: false },
					overall: { ready: 3, total: 12 },
				},
			});
			expect(matrix.cells.find((cell) => cell.id === 'react-linkfree-v0-72-0')).toMatchObject({
				framework: 'react',
				state: 'verified',
				scope: 'fixture-specific-create-react-app-5-to-vite8',
				genericReactSupport: 'not-claimed',
				browserProof: 'verified-direct-witness',
				// The synthetic corpus is published on the cell rather than
				// left inside the receipt: it is the boundary of the claim.
				corpusRuling: { ruling: 'synthetic-corpus', realProfileDataRendered: false },
				scrollSurface: 'measured-genuine-viewport-scroll',
				readinessScoreboard: {
					reactLineage: { ready: 1, total: 4, counted: false },
					overall: { ready: 3, total: 12 },
				},
			});
			expect(conformance.integrity.canonicalDigest).toHaveLength(64);
			const report = await readFile(path.join(fixture.current, 'report.md'), 'utf8');
			expect(report).toContain(
				'factoriolab Angular CLI 10.1→Angular 16.2 browser-builder direct-Witness browser proof',
			);
			expect(report).toContain(
				'jira-clone Angular CLI 13.2 custom-webpack→Angular 16.2 browser-builder direct-Witness browser proof',
			);
			expect(report).toContain(
				'The immutable Killed by Google Next.js 12 Pages/webpack production vertical is verified only for its exact fixture',
			);
			expect(report).toContain('generic Next.js support is not claimed');
			expect(report).toContain(
				'The Vite adapter is **fixture-specific**; generic adapter: **not-tested**; unplugin portability: **not-tested**',
			);
			expect(report).toContain('T220 is **not included**');
			// The one failed holdout in the corpus is stated in the report with its
			// recorded reason, and stated to be counted in no numerator, so the
			// unchanged lineage scores cannot be read as an absence of contrary
			// evidence.
			const holdouts = (
				conformance.coverage.productionReadiness as Record<string, unknown>
			).holdouts as Array<Record<string, unknown>>;
			expect(holdouts).toHaveLength(1);
			expect(holdouts[0]).toMatchObject({
				id: 'holdout-react-cypress-rwa',
				attempted: true,
				outcome: 'failed',
				reason: 'non-UTF-8 module source decoding',
				countedInLineageNumerator: false,
			});
			expect(report).toContain('holdout-react-cypress-rwa');
			expect(report).toContain('non-UTF-8 module source decoding');
			expect(report).toContain('counted in no lineage numerator');
			const scriptSurface = JSON.parse(
				await readFile(path.join(fixture.current, 'script-surface.json'), 'utf8'),
			) as { summary: Record<string, unknown>; boundaries: Record<string, unknown> };
			expect(scriptSurface.summary).toEqual({
				verticals: 9,
				sourceApplications: 2,
				lanes: 18,
				scripts: 198,
				resources: 72,
				localResources: 66,
				externalResources: 6,
				externalScriptsIntroduced: 0,
			});
			expect(scriptSurface.boundaries).toMatchObject({
				paymentPageApplicability: 'not-established',
				dynamicScriptInsertion: 'not-tested',
				pciCompliance: 'not-claimed',
			});
			const runtimeObservation = JSON.parse(
				await readFile(
					path.join(fixture.current, 'runtime-script-observation.json'),
					'utf8',
				),
			) as { summary: Record<string, unknown>; boundaries: Record<string, unknown> };
			expect(runtimeObservation.summary).toMatchObject({
				verticals: 9,
				lanes: 18,
				runs: 36,
				externalScriptsIntroduced: 0,
			});
			expect(runtimeObservation.boundaries).toMatchObject({
				scope: 'exact-qualified-journeys',
				globalDynamicInsertionCoverage: 'not-established',
			});
			expect(
				matrix.cells.find((cell) => cell.id === 'angular-phonecat-route-resolve'),
			).toMatchObject({
				state: 'verified',
				track: 'angularjs-special-track',
				bundler: 'none-static',
				routeResolves: 'verified',
				componentBindings: 'one-way-verified',
				angular2Plus: 'not-applicable',
			});
			expect(
				matrix.cells.find((cell) => cell.id === 'angular-phonecat-composed'),
			).toMatchObject({
				state: 'verified',
				composition: 'verified',
				orderIndependent: true,
				track: 'angularjs-special-track',
				bundler: 'none-static',
				angular2Plus: 'not-applicable',
				designatedPilot: false,
			});
			expect(matrix.cells.find((cell) => cell.id === 'angular-phonecat-vite8')).toMatchObject(
				{
					state: 'verified',
					track: 'angularjs-special-track',
					bundler: 'Vite 8.0.16',
					adapter: 'fixture-specific',
					oldVite: 'not-tested',
					genericAdapter: 'not-tested',
					unplugin: 'not-tested',
					serviceWorker: 'out-of-scope-not-emitted',
					angular2Plus: 'not-applicable',
					designatedPilot: false,
				},
			);
			expect(
				matrix.cells.find((cell) => cell.id === 'angular-realworld-v15-to-v16'),
			).toMatchObject({
				framework: 'angular',
				track: 'angular2-plus-adjacent-major',
				state: 'verified',
				designatedPilot: false,
				angularCliAot: 'verified',
				adjacentMajor: 'angular-15-to-16-verified',
			});
		} finally {
			await rm(fixture.directory, { recursive: true, force: true });
		}
	}, 30_000);

	it('preserves T465 exactly once as a non-reusable disclosure dependency', async () => {
		const bytes = await readFile(path.join(root, NEXT_TAILWIND_CONSENT_FAILURE.path));
		expect(bytes).toHaveLength(NEXT_TAILWIND_CONSENT_FAILURE.bytes);
		expect(sha256(bytes)).toBe(NEXT_TAILWIND_CONSENT_FAILURE.sha256);
		expect(() => validateNextTailwindConsentFailure(bytes)).not.toThrow();
		for (const mutation of [
			(value: Record<string, unknown>) => (value.reusable = true),
			(value: Record<string, unknown>) => (value.status = 'consumed-closed'),
			(value: Record<string, unknown>) => (value.partialBytes = 'evidence'),
		]) {
			const value = JSON.parse(bytes.toString('utf8')) as Record<string, unknown>;
			mutation(value);
			expect(() =>
				validateNextTailwindConsentFailure(Buffer.from(canonicalize(value))),
			).toThrow();
		}
	});

	it('binds canonical T506 exclusion JSON to its derived Markdown and nonclaims', async () => {
		const [json, markdown] = await Promise.all([
			readFile(path.join(root, NEXT_TAILWIND_EXCLUSION.json.path)),
			readFile(path.join(root, NEXT_TAILWIND_EXCLUSION.markdown.path)),
		]);
		expect(() => validateNextTailwindExclusion(json, markdown)).not.toThrow();
		expect(markdown.toString('utf8')).toBe(renderNextTailwindExclusionMarkdown());
		const value = JSON.parse(json.toString('utf8')) as Record<string, unknown>;
		for (const mutation of [
			(document: Record<string, unknown>) => (document.counted = true),
			(document: Record<string, unknown>) => (document.provenanceComplete = true),
			(document: Record<string, unknown>) => (document.support = 'established'),
		]) {
			const altered = structuredClone(value);
			mutation(altered);
			expect(() =>
				validateNextTailwindExclusion(Buffer.from(`${canonicalize(altered)}\n`), markdown),
			).toThrow('exclusion');
		}
		expect(() =>
			validateNextTailwindExclusion(json, Buffer.from(`${markdown.toString('utf8')} `)),
		).toThrow('exclusion');
	});

	it('rejects T190 safety-fact and single-provenance-boundary tampering', async () => {
		const source = await readFile(path.join(root, NPM_LOCK_ACQUISITION_PREFLIGHT.path));
		expect(() => validateNpmLockAcquisitionPreflight(source)).not.toThrow();
		for (const mutate of [
			(value: Record<string, unknown>) => {
				value.result = 'ready';
			},
			(value: Record<string, unknown>) => {
				const acquisition = value.proposedAcquisition as Record<string, unknown>;
				const consent = acquisition.consent as Record<string, unknown>;
				consent.consumed = true;
			},
			(value: Record<string, unknown>) => {
				const replay = value.replay as Record<string, unknown>;
				replay.networkAttempts = 1;
			},
			(value: Record<string, unknown>) => {
				const acquisition = value.proposedAcquisition as Record<string, unknown>;
				const network = acquisition.network as Record<string, unknown>;
				network.maximumResponseBytes = 1;
			},
		] as const) {
			const value = JSON.parse(source.toString('utf8')) as Record<string, unknown>;
			mutate(value);
			expect(() =>
				validateNpmLockAcquisitionPreflight(Buffer.from(JSON.stringify(value))),
			).toThrow();
		}

		const fixture = await setup();
		try {
			for (const [label, mutate] of [
				[
					'missing',
					(dependencies: Array<Record<string, unknown>>) => {
						const index = dependencies.findIndex(
							(item) => item.uri === NPM_LOCK_ACQUISITION_PREFLIGHT.path,
						);
						dependencies.splice(index, 1);
					},
				],
				[
					'duplicate',
					(dependencies: Array<Record<string, unknown>>) => {
						const item = dependencies.find(
							(candidate) => candidate.uri === NPM_LOCK_ACQUISITION_PREFLIGHT.path,
						);
						if (item) dependencies.push(structuredClone(item));
					},
				],
				[
					'digest',
					(dependencies: Array<Record<string, unknown>>) => {
						const item = dependencies.find(
							(candidate) => candidate.uri === NPM_LOCK_ACQUISITION_PREFLIGHT.path,
						);
						if (item) (item.digest as Record<string, unknown>).sha256 = '0'.repeat(64);
					},
				],
			] as const) {
				const output = path.join(fixture.directory, `t190-${label}`);
				await cp(fixture.current, output, { recursive: true });
				await rewriteArtifact(output, 'provenance.json', (value) => {
					const predicate = value.predicate as Record<string, unknown>;
					const definition = predicate.buildDefinition as Record<string, unknown>;
					mutate(definition.resolvedDependencies as Array<Record<string, unknown>>);
				});
				await expect(
					verifyTrustPackage({
						rootDir: root,
						outputDir: output,
						environment: offline,
						now: observedAt,
					}),
				).rejects.toThrow();
			}
		} finally {
			await rm(fixture.directory, { recursive: true, force: true });
		}
	}, 30_000);

	it('rejects recomputed-hash runtime semantic tampering', async () => {
		const fixture = await setup();
		try {
			const mutations: Array<[string, (value: Record<string, unknown>) => void]> = [
				[
					'detector-falsehood',
					(value) => {
						(value.detectorMutation as Record<string, unknown>).observed = false;
					},
				],
				[
					'deleted-script',
					(value) => {
						const vertical = (value.verticals as Array<Record<string, unknown>>)[0]!;
						const lane = (vertical.lanes as Array<Record<string, unknown>>)[0]!;
						const run = (lane.runs as Array<Record<string, unknown>>)[0]!;
						(run.scripts as unknown[]).pop();
					},
				],
				[
					'browser-error',
					(value) => {
						const vertical = (value.verticals as Array<Record<string, unknown>>)[0]!;
						const lane = (vertical.lanes as Array<Record<string, unknown>>)[0]!;
						const run = (lane.runs as Array<Record<string, unknown>>)[0]!;
						(run.consoleErrors as string[]).push('tampered-browser-error');
					},
				],
			];
			for (const [label, mutate] of mutations) {
				const output = path.join(fixture.directory, `runtime-${label}`);
				await cp(fixture.current, output, { recursive: true });
				await rewriteArtifact(output, 'runtime-script-observation.json', mutate);
				await expect(
					verifyTrustPackage({
						rootDir: root,
						outputDir: output,
						environment: offline,
						now: observedAt,
					}),
				).rejects.toThrow();
			}
		} finally {
			await rm(fixture.directory, { recursive: true, force: true });
		}
	}, 30_000);

	it('rejects script-surface network tampering and enterprise overclaims', async () => {
		const fixture = await setup();
		try {
			const mutations: Array<[string, (value: Record<string, unknown>) => void]> = [
				[
					'network',
					(value) => {
						const verticals = value.verticals as Array<Record<string, unknown>>;
						const lanes = verticals[0]?.lanes as Array<Record<string, unknown>>;
						const network = lanes[0]?.network as Record<string, unknown>;
						network.successfulNonLoopback = ['https://unexpected.example/request'];
					},
				],
				[
					'payment',
					(value) => {
						(value.boundaries as Record<string, unknown>).paymentPageApplicability =
							'established';
					},
				],
				[
					'dynamic',
					(value) => {
						(value.boundaries as Record<string, unknown>).dynamicScriptInsertion =
							'verified';
					},
				],
				[
					'pci',
					(value) => {
						(value.boundaries as Record<string, unknown>).pciCompliance = 'claimed';
					},
				],
				[
					'certification',
					(value) => {
						(value.boundaries as Record<string, unknown>).certification = 'claimed';
					},
				],
				[
					'authenticity',
					(value) => {
						(value.boundaries as Record<string, unknown>).authenticity = 'established';
					},
				],
			];
			for (const [label, mutate] of mutations) {
				const output = path.join(fixture.directory, `script-surface-${label}`);
				await cp(fixture.current, output, { recursive: true });
				await rewriteArtifact(output, 'script-surface.json', mutate);
				const verification = expect(
					verifyTrustPackage({
						rootDir: root,
						outputDir: output,
						environment: offline,
						now: observedAt,
					}),
				).rejects;
				if (label === 'payment')
					await verification.toThrow(
						'Sensitive material refused: [{"path":"$.boundaries.paymentPageApplicability","kind":"forbidden-key"}]',
					);
				else await verification.toThrow('independent re-derivation');
			}
		} finally {
			await rm(fixture.directory, { recursive: true, force: true });
		}
	}, 30_000);

	it('rejects locality, Git, and signing overclaims after all hashes are recomputed', async () => {
		const fixture = await setup();
		try {
			for (const [label, mutate] of [
				[
					'os-wide',
					(value: Record<string, unknown>) => {
						(value.locality as Record<string, unknown>).osWideIsolation = true;
					},
				],
				[
					'git',
					(value: Record<string, unknown>) => {
						(value.gitProvenance as Record<string, unknown>).state = 'verified';
					},
				],
				[
					'signing',
					(value: Record<string, unknown>) => {
						(value.signingIdentity as Record<string, unknown>).state = 'verified';
					},
				],
			] as const) {
				const output = path.join(fixture.directory, `controls-${label}`);
				await cp(fixture.current, output, { recursive: true });
				await rewriteArtifact(output, 'controls.json', mutate);
				await expect(
					verifyTrustPackage({
						rootDir: root,
						outputDir: output,
						environment: offline,
						now: observedAt,
					}),
				).rejects.toThrow('enterprise assurance');
			}
		} finally {
			await rm(fixture.directory, { recursive: true, force: true });
		}
	}, 30_000);

	it('re-derives corpus conformance and rejects generic, unplugin, and Angular 2+ overclaims', async () => {
		const fixture = await setup();
		try {
			for (const [label, mutate] of [
				[
					'generic',
					(value: Record<string, unknown>) => {
						const application = (
							value.applications as Array<Record<string, unknown>>
						)[0];
						if (application)
							(application.boundaries as Record<string, unknown>).genericAdapter =
								'verified';
					},
				],
				[
					'unplugin',
					(value: Record<string, unknown>) => {
						const application = (
							value.applications as Array<Record<string, unknown>>
						)[0];
						if (application)
							(application.boundaries as Record<string, unknown>).unplugin =
								'verified';
					},
				],
				[
					'angular2',
					(value: Record<string, unknown>) => {
						const application = (
							value.applications as Array<Record<string, unknown>>
						)[1];
						if (application)
							(application.boundaries as Record<string, unknown>).angular2Plus =
								'verified';
					},
				],
				[
					'PhoneCat Vite bundler',
					(value: Record<string, unknown>) => {
						const application = (
							value.applications as Array<Record<string, unknown>>
						)[1];
						if (application)
							(application.boundaries as Record<string, unknown>).bundler =
								'none-static';
					},
				],
			] as const) {
				const output = path.join(fixture.directory, `overclaim-${label}`);
				await cp(fixture.current, output, { recursive: true });
				await rewriteArtifact(output, 'corpus-conformance.json', (value) => {
					mutate(value);
					const integrity = value.integrity as Record<string, unknown>;
					integrity.canonicalDigest = '';
					integrity.canonicalDigest = sha256(canonicalize(value));
				});
				await expect(
					verifyTrustPackage({
						rootDir: root,
						outputDir: output,
						environment: offline,
						now: observedAt,
					}),
				).rejects.toThrow('independent re-derivation');
			}
		} finally {
			await rm(fixture.directory, { recursive: true, force: true });
		}
	}, 30_000);

	it('rejects tampering, artifact removal, and broken Markdown linkage', async () => {
		const fixture = await setup();
		try {
			const tampered = path.join(fixture.directory, 'tampered');
			await cp(fixture.current, tampered, { recursive: true });
			await writeFile(path.join(tampered, 'licenses.json'), '{}\n');
			await expect(
				verifyTrustPackage({
					rootDir: root,
					outputDir: tampered,
					environment: offline,
					now: observedAt,
				}),
			).rejects.toThrow('digest mismatch');
			const removed = path.join(fixture.directory, 'removed');
			await cp(fixture.current, removed, { recursive: true });
			await rm(path.join(removed, 'controls.json'));
			await expect(
				verifyTrustPackage({
					rootDir: root,
					outputDir: removed,
					environment: offline,
					now: observedAt,
				}),
			).rejects.toThrow();
			const unlinked = path.join(fixture.directory, 'unlinked');
			await cp(fixture.current, unlinked, { recursive: true });
			await writeFile(path.join(unlinked, 'report.md'), '# unlinked\n');
			await expect(
				verifyTrustPackage({
					rootDir: root,
					outputDir: unlinked,
					environment: offline,
					now: observedAt,
				}),
			).rejects.toThrow('not linked');
		} finally {
			await rm(fixture.directory, { recursive: true, force: true });
		}
	}, 30_000);

	it('rejects portable-evidence path bypasses after enclosing hashes are recomputed', async () => {
		const fixture = await setup();
		try {
			for (const [index, injected] of [
				'/private/host/user/license',
				'C:\\Users\\host\\license',
				'\\\\server\\share\\license',
				'file:///private/host/license',
				'cache/../host/license',
			].entries()) {
				const output = path.join(fixture.directory, `portable-bypass-${index}`);
				await cp(fixture.current, output, { recursive: true });
				await rewriteArtifact(output, 'licenses.json', (value) => {
					value.injectedTrace = injected;
				});
				await expect(
					verifyTrustPackage({
						rootDir: root,
						outputDir: output,
						environment: offline,
						now: observedAt,
					}),
				).rejects.toThrow('Non-portable evidence refused');
			}
		} finally {
			await rm(fixture.directory, { recursive: true, force: true });
		}
	}, 30_000);

	it('keeps stale and unsupported states visible', async () => {
		const fixture = await setup();
		try {
			const stale = path.join(fixture.directory, 'stale');
			await cp(fixture.current, stale, { recursive: true });
			await rewriteArtifact(stale, 'vulnerabilities.json', (value) => {
				(value.freshness as Record<string, unknown>).state = 'verified';
			});

			const staleManifestPath = path.join(stale, 'manifest.json');
			const staleManifest = JSON.parse(await readFile(staleManifestPath, 'utf8')) as {
				canonicalDigest: string;
				observation: { vulnerabilityFreshness: string };
			};
			staleManifest.observation.vulnerabilityFreshness = 'verified';
			staleManifest.canonicalDigest = '';
			staleManifest.canonicalDigest = sha256(canonicalize(staleManifest));
			await writeFile(staleManifestPath, `${JSON.stringify(staleManifest, null, 2)}\n`);
			await expect(
				verifyTrustPackage({
					rootDir: root,
					outputDir: stale,
					environment: offline,
					now: '2026-08-13T12:00:00.000Z',
				}),
			).rejects.toThrow('visibly stale');
			const unsupported = path.join(fixture.directory, 'unsupported');
			await cp(fixture.current, unsupported, { recursive: true });
			await rewriteArtifact(unsupported, 'matrix.json', (value) => {
				const cells = value.cells as Array<Record<string, unknown>>;
				const angular = cells.find((cell) => cell.id === 'angular2-hn');
				if (angular) angular.state = 'verified';
			});
			await expect(
				verifyTrustPackage({
					rootDir: root,
					outputDir: unsupported,
					environment: offline,
					now: observedAt,
				}),
			).rejects.toThrow('upgraded');
		} finally {
			await rm(fixture.directory, { recursive: true, force: true });
		}
	}, 30_000);

	it('rejects a recomputed PhoneCat Vite trust-matrix binding attack', async () => {
		const fixture = await setup();
		try {
			const output = path.join(fixture.directory, 'phonecat-vite-matrix-rebind');
			await cp(fixture.current, output, { recursive: true });
			await rewriteArtifact(output, 'matrix.json', (value) => {
				const cells = value.cells as Array<Record<string, unknown>>;
				const cell = cells.find((item) => item.id === 'angular-phonecat-vite8');
				if (cell) cell.adapter = 'generic';
			});
			await expect(
				verifyTrustPackage({
					rootDir: root,
					outputDir: output,
					environment: offline,
					now: observedAt,
				}),
			).rejects.toThrow('unsupported/not-tested');
		} finally {
			await rm(fixture.directory, { recursive: true, force: true });
		}
	}, 30_000);

	it('publishes an adapter freeze record whose composite is recomputable from its subtrees', () => {
		const record = adapterFreezeRecord();
		const freeze = record.freeze as {
			commit: string;
			composite: string;
			subtrees: Array<{ path: string; treeOid: string }>;
		};
		// The published composite is exactly what a plain shell loop over
		// `git rev-parse HEAD:<path>` piped to `shasum -a 256` produces, so the
		// claim can be checked without this package.
		expect(freeze.composite).toBe(ADAPTER_FREEZE_COMPOSITE);
		expect(sha256(adapterFreezePreimage(freeze.subtrees))).toBe(freeze.composite);
		expect(freeze.subtrees.map((subtree) => subtree.path)).toEqual([
			'packages/frameworks/react',
			'packages/frameworks/angular',
			'packages/core/src/migrations',
			'packages/core/src/bundlers',
			'packages/core/src/analysis',
		]);
		// Freezing the adapters must not freeze the ability to publish evidence.
		expect(record.holdoutPublishing).toMatchObject({
			state: 'outside-freeze',
			surfaces: [
				'packages/core/src/receipts',
				'packages/core/src/corpus',
				'packages/cli/src/witness',
			],
		});
		const capabilities = record.capabilities as {
			experimental: {
				pendingEvidence: string;
				entries: Array<{ lineage: string; capability: string }>;
			};
			crossProven: { entries: Array<{ lineage: string; capability: string }> };
		};
		expect(capabilities.experimental.entries).toHaveLength(11);
		expect(capabilities.experimental.pendingEvidence).toContain('T006');
		expect(capabilities.crossProven.entries.map((entry) => entry.capability)).toContain(
			'react-cra-vite-adapter',
		);
		expect(record.angularHoldout).toMatchObject({
			state: 'deferred',
			deferredUntil: 'post-T006',
			preScreen: 'mandatory license-text-at-pin pre-screen',
		});
		expect(verifyAdapterFreezeRecord(record)).toEqual(record);
	});

	it('refuses a freeze record whose subtree oid was edited under its composite', () => {
		const record = adapterFreezeRecord();
		const freeze = record.freeze as { subtrees: Array<{ path: string; treeOid: string }> };
		const tampered = {
			...record,
			freeze: {
				...freeze,
				subtrees: freeze.subtrees.map((subtree, index) =>
					index === 0 ? { ...subtree, treeOid: '0'.repeat(40) } : subtree,
				),
			},
		};
		expect(() => verifyAdapterFreezeRecord(tampered)).toThrow(
			'Adapter freeze composite does not match its recorded subtrees',
		);
	});

	it('refuses sensitive policy material', async () => {
		const fixture = await setup();
		try {
			const policy = JSON.parse(
				await readFile(path.join(root, 'trust/policy.json'), 'utf8'),
			) as Record<string, unknown>;
			policy.owner = { state: 'unknown', secret: 'sk_live_examplevalue' };
			const policyPath = path.join(fixture.directory, 'sensitive-policy.json');
			await writeFile(policyPath, JSON.stringify(policy));
			await expect(
				generateTrustPackage({
					rootDir: root,
					cacheDir: fixture.cache,
					policyPath,
					outputDir: path.join(fixture.directory, 'sensitive'),
					offline: true,
					environment: offline,
					observedAt,
				}),
			).rejects.toThrow('Sensitive material refused');
		} finally {
			await rm(fixture.directory, { recursive: true, force: true });
		}
	}, 30_000);
});
