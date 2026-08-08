import {
	chmod,
	cp,
	lstat,
	mkdir,
	mkdtemp,
	readFile,
	readdir,
	realpath,
	readlink,
	rm,
	symlink,
	writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import * as path from 'pathe';
import { describe, expect, test } from 'vitest';
import { canonicalize, findArchiveFile, indexTarGzip, sha256 } from '../../core/src/index.ts';
import {
	acquireNextServerNftRuns,
	acquireNextServerNftProductionComparison,
	acquireIsolatedNextCacheKeyRuns,
	assertIsolatedProductionCacheKeyBinding,
	assertIsolatedProductionCacheKeyBindings,
	assertKilledByGoogleSettledSearchCount,
	assertProductionSnapshotFidelity,
	bindProductionSnapshot,
	canonicalNftMismatchPredicates,
	captureNextServerNftRun,
	captureKilledByGoogleMutationWithRestoration,
	captureProductionComparisonProjection,
	categorizeLaneValues,
	classifyKilledByGoogleMutationSignal,
	compareProductionNfts,
	compareCanonicalNftProjections,
	compareLaneValueCategories,
	createNextServerNftOperationBisectArtifact,
	createNextServerCacheKeyProvenanceArtifact,
	createNextServerIsolatedCacheKeyArtifact,
	createKilledByGoogleJourneyDescriptors,
	createKilledByGoogleJourneyPhaseState,
	diagnosticRunToCanonicalNftProjection,
	createNextServerNftProductionComparisonArtifact,
	expectedTraceValueDimensions,
	killedByGoogleBrowserOracle,
	instrumentT283BaselineInterval,
	KilledByGoogleJourneyOracleError,
	KilledByGoogleMutationPhaseError,
	KilledByGoogleJourneyPhaseFailure,
	nextServerNftMismatchDigest,
	nextServerCacheKeyProvenanceDigest,
	nextServerIsolatedCacheKeyDigest,
	nextServerNftOperationBisectDigest,
	nextServerNftProductionComparisonDigest,
	nextServerNftMismatchPredicates,
	next12NftConsumerAssertions,
	productionBindingToCanonicalNftProjection,
	productionCopyPathsAreDisjoint,
	productionNftBinding,
	productionNftPaths,
	promoteAfterIsolatedNextWorkflow,
	projectKilledByGoogleJourneySemantics,
	resetProductionBuildRoot,
	revalidateKilledByGoogleJourneyLaunch,
	runKilledByGoogleRestorationJourney,
	settledKilledByGoogleSearchCount,
	terminateKilledByGoogleServerChild,
	validateKilledByGoogleJourneyPhaseOrder,
	validateNextServerNftMismatchArtifact,
	validateNextServerCacheKeyProvenanceArtifact,
	validateNextServerIsolatedCacheKeyArtifact,
	validateNextServerNftOperationBisectArtifact,
	validateNextServerNftProductionComparisonArtifact,
	verifyIsolatedNextBuildLanePrerequisite,
	withIsolatedNextBuildLane,
	withIsolatedNextWorkflowLanes,
	type BuildSnapshot,
	type BaselineIntervalFingerprint,
	type BaselineIntervalMeasurement,
	type BaselineIntervalObservation,
	type CanonicalNftProjection,
	type NftMismatchBinding,
	type NftMismatchRun,
	type ProductionNftBinding,
	type ProductionNftPath,
	type ProductionSnapshot,
	type ProductionSnapshotIdentity,
	modelNext12CacheKeyCandidates,
} from '../src/fixture/next-killedbygoogle-run.ts';

async function snapshotRows(directory: string) {
	const rows: Array<{ path: string; byteLength: number; sha256: string }> = [];
	const visit = async (current: string): Promise<void> => {
		for (const entry of await readdir(current, { withFileTypes: true })) {
			const absolute = path.join(current, entry.name);
			if (entry.isDirectory()) await visit(absolute);
			else if (entry.isFile()) {
				const bytes = await readFile(absolute);
				rows.push({
					path: path.relative(directory, absolute),
					byteLength: bytes.byteLength,
					sha256: sha256(bytes),
				});
			} else throw new Error('synthetic snapshot contains a special entry');
		}
	};
	await visit(directory);
	return rows.sort((left, right) => left.path.localeCompare(right.path));
}

async function syntheticProduction() {
	const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-kbg-production-'));
	const lane = path.join(directory, 'lane');
	const build = path.join(lane, '.next');
	const target = path.join(lane, 'node_modules/pkg/runtime.js');
	await mkdir(path.dirname(target), { recursive: true });
	await writeFile(target, 'runtime');
	await writeFile(path.join(build, 'BUILD_ID'), 'fixed-build-id\n').catch(async () => {
		await mkdir(build, { recursive: true });
		await writeFile(path.join(build, 'BUILD_ID'), 'fixed-build-id\n');
	});
	for (const nftPath of productionNftPaths) {
		await mkdir(path.dirname(path.join(build, nftPath)), { recursive: true });
		const depth = nftPath === 'next-server.js.nft.json' ? '../' : '../../../';
		await writeFile(
			path.join(build, nftPath),
			`${JSON.stringify({
				...(nftPath === 'next-server.js.nft.json' ? { cacheKey: 'fixed' } : {}),
				files: [`${depth}node_modules/pkg/runtime.js`],
				version: 1,
			})}\n`,
		);
	}
	const rows = await snapshotRows(build);
	const captured: BuildSnapshot = {
		buildId: 'fixed-build-id',
		rawDigest: sha256(canonicalize(rows)),
		normalizedDigest: sha256(canonicalize(rows)),
		rows,
		normalizedRows: rows.map(({ path: rowPath, sha256: digest }) => ({
			path: rowPath,
			sha256: digest,
		})),
	};
	return { directory, lane, build, captured };
}

const testDigest = 'a'.repeat(64);

type MutableMismatchRun = {
	id: 'first' | 'second';
	manifest: { sha256: string; byteLength: number };
	cacheKey: {
		present: true;
		type: 'string';
		valueSha256: string;
		byteLength: number;
		valueRetained: boolean;
	};
	members: Array<{
		member: string;
		selectedStorageRegion: 'bound-build-output' | 'bound-lane';
		targetType: 'file' | 'symlink';
		portableRealTargetIdentity: string;
		targetSha256: string;
		byteLength: number;
	}>;
};

type MutableNftMismatchBinding = {
	-readonly [Key in keyof NftMismatchBinding]: NftMismatchBinding[Key];
};

function mutableRuns(artifact: Record<string, unknown>): MutableMismatchRun[] {
	return artifact.runs as MutableMismatchRun[];
}

function mutableConsumerSources(artifact: Record<string, unknown>): Array<Record<string, unknown>> {
	return (artifact.consumerContext as Record<string, unknown>).sources as Array<
		Record<string, unknown>
	>;
}

function mismatchArtifact() {
	const binding = {
		member: '../node_modules/pkg/runtime.js',
		selectedStorageRegion: 'bound-lane',
		targetType: 'file',
		portableRealTargetIdentity: 'node_modules/pkg/runtime.js',
		targetSha256: testDigest,
		byteLength: 7,
	} as const;
	const run = (id: 'first' | 'second', cacheDigest: string) => ({
		id,
		manifest: { sha256: testDigest, byteLength: 100 },
		cacheKey: {
			present: true as const,
			type: 'string' as const,
			valueSha256: cacheDigest,
			byteLength: 12,
			valueRetained: false as const,
		},
		members: [binding],
	});
	const runs = [run('first', testDigest), run('second', 'b'.repeat(64))] as const;
	const rows = nextServerNftMismatchPredicates(runs[0], runs[1]);
	const artifact: Record<string, unknown> = {
		schemaVersion: 'versionless.next12-next-server-nft-mismatch.v1',
		fixture: 'next-killedbygoogle',
		manifestPath: '.next/next-server.js.nft.json',
		immutableInputs: {
			sourceRevision: '56809c31592e6ca1edce8af9bfe842fbcdf71f4d',
			sourceArchiveSha256: 'c28878d0f65b56aa595763c852477fb0c1e3533e5c7f7ea9daa2be16f102368d',
			lockSha256: 'a676ee932cef5e54d469dc6d1e040e50f42f9cc88beb16ae5c72c13e26ebc48a',
			closureFileSha256: '38d2a2532f77835ae6ae8e7eaa6512c408760c534b8ab4dd92c57a3fcb873a84',
			closureCanonicalDigest:
				'61fcd0d02df1212e8a7f461fbfb69917037b4fd85533a095f5d683064991311e',
			closureArtifacts: 710,
			installTreeSha256: 'c49e2976f5d5bd7898512df31472e4b65a5884dee7065f04b9504dda4bab9070',
			nextTarballSha256: 'f8069b42f1ba01bd63c528ff4bd084f0f13119649eee9f34f4c645d5e345bce7',
			node: '16.20.2',
			yarn: '1.22.22',
			next: '12.0.10',
			offlineControls: { VERSIONLESS_NETWORK_MODE: 'offline', NPM_CONFIG_OFFLINE: true },
		},
		runs,
		comparison: {
			...rows,
			mismatchClasses: ['cacheKeyMismatch'],
		},
		consumerContext: {
			nextStartReadsManifest: false,
			requiredServerGenerationReadsManifest: false,
			standaloneCopyConsumesEveryMember: true,
			fixtureStandaloneOutput: false,
			independentMemberRuntimeRelevance: 'pending-read-only-judge',
			sources: [
				{ identity: 'next.config.js', sha256: testDigest, byteLength: 10 },
				{
					identity: 'node_modules/next/dist/build/index.js',
					sha256: testDigest,
					byteLength: 10,
				},
				{
					identity: 'node_modules/next/dist/server/next-server.js',
					sha256: testDigest,
					byteLength: 10,
				},
			],
		},
		privacy: {
			rawPayloadRetained: false,
			absolutePathsRetained: false,
			environmentValuesRetained: false,
			secretsRetained: false,
			cacheKeyValueRetained: false,
			traceContentAccessed: false,
			traceContentRetained: false,
			buildInventoryRetained: false,
			browserEvidenceRetained: false,
			receiptRetained: false,
			aggregateCorpusTrustRetained: false,
			productionCountability: 'diagnostic-only-not-countable',
			cleanup: 'opaque-whole-dedicated-root-removal',
		},
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	(artifact.integrity as Record<string, unknown>).canonicalDigest =
		nextServerNftMismatchDigest(artifact);
	return artifact;
}

function reseal(artifact: Record<string, unknown>) {
	(artifact.integrity as Record<string, unknown>).canonicalDigest =
		nextServerNftMismatchDigest(artifact);
	return artifact;
}

const mismatchNames = [
	'bindingSetMismatch',
	'cacheKeyMismatch',
	'memberFieldMismatch',
	'targetByteMismatch',
] as const;

function synchronizeMismatchComparison(artifact: Record<string, unknown>) {
	const [first, second] = mutableRuns(artifact);
	if (!first || !second) throw new Error('synthetic mismatch runs are absent');
	const predicates = nextServerNftMismatchPredicates(
		first as NftMismatchRun,
		second as NftMismatchRun,
	);
	artifact.comparison = {
		...predicates,
		mismatchClasses: mismatchNames
			.filter((name) => predicates[name].value)
			.sort((left, right) => left.localeCompare(right)),
	};
	return reseal(artifact);
}

function canonicalProductionBinding(): ProductionNftBinding {
	return {
		relativeManifest: 'next-server.js.nft.json',
		version: 1,
		rawSha256: 'a'.repeat(64),
		rawByteLength: 100,
		bindings: [
			{
				member: '../node_modules/pkg/link.js',
				laneRelativeTarget: 'node_modules/pkg/link.js',
				realLaneRelativeTarget: 'node_modules/pkg/runtime.js',
				physicalRoot: 'canonical-lane',
				targetType: 'symbolic-link',
				targetSha256: 'b'.repeat(64),
				targetByteLength: 7,
			},
			{
				member: '../node_modules/pkg/runtime.js',
				laneRelativeTarget: 'node_modules/pkg/runtime.js',
				realLaneRelativeTarget: 'node_modules/pkg/runtime.js',
				physicalRoot: 'canonical-lane',
				targetType: 'file',
				targetSha256: 'b'.repeat(64),
				targetByteLength: 7,
			},
			{
				member: './server-runtime.js',
				laneRelativeTarget: '.next/server-runtime.js',
				realLaneRelativeTarget: '.next/server-runtime.js',
				physicalRoot: 'snapshot-storage',
				targetType: 'file',
				targetSha256: 'c'.repeat(64),
				targetByteLength: 11,
			},
		],
		cacheKeyPresent: true,
		cacheKeyType: 'string',
		cacheKeySha256: 'd'.repeat(64),
		cacheKeyByteLength: 12,
		traceMembershipOccurrences: 0,
	};
}

function equivalentDiagnosticRun(binding: ProductionNftBinding): NftMismatchRun {
	const projection = productionBindingToCanonicalNftProjection(binding);
	return {
		id: 'first',
		manifest: projection.rawObservation,
		cacheKey: {
			present: true,
			type: 'string',
			valueSha256: projection.semantic.cacheKey.valueSha256!,
			byteLength: projection.semantic.cacheKey.byteLength!,
			valueRetained: false,
		},
		members: projection.semantic.members,
	};
}

function productionComparisonArtifact() {
	const first = productionBindingToCanonicalNftProjection(canonicalProductionBinding());
	const changed = structuredClone(canonicalProductionBinding()) as unknown as Record<
		string,
		unknown
	>;
	(changed.bindings as Array<Record<string, unknown>>)[1]!.targetSha256 = 'e'.repeat(64);
	const second = productionBindingToCanonicalNftProjection(
		changed as unknown as ProductionNftBinding,
	);
	return createNextServerNftProductionComparisonArtifact(first, second);
}

function resealProductionComparison(artifact: Record<string, unknown>) {
	(artifact.integrity as Record<string, unknown>).canonicalDigest =
		nextServerNftProductionComparisonDigest(artifact);
	return artifact;
}

type MutableBaselineFingerprint = {
	-readonly [Key in keyof BaselineIntervalFingerprint]: BaselineIntervalFingerprint[Key];
};

type MutableBaselineObservation = {
	-readonly [Key in keyof BaselineIntervalMeasurement]: BaselineIntervalMeasurement[Key];
};

async function syntheticBaselineLedger(
	options: {
		canonicalLane?: string;
		copyDestination?: string;
		secondProjection?: string;
		mutate?: (
			operation: BaselineIntervalObservation['operation'],
			observation: MutableBaselineObservation,
		) => void;
	} = {},
) {
	let current: MutableBaselineFingerprint = {
		source: 'a'.repeat(64),
		install: 'b'.repeat(64),
		externalTargets: 'c'.repeat(64),
		canonicalBuildOutput: 'd'.repeat(64),
		firstLiveProjection: null,
		copiedProjection: null,
		secondLiveProjection: null,
		copyDestination: null,
	};
	return await instrumentT283BaselineInterval({
		canonicalLane: options.canonicalLane ?? '/synthetic/canonical-lane',
		copyDestination: options.copyDestination ?? '/synthetic/disjoint-snapshots/baseline-first',
		observe: async (specification) => {
			const before = structuredClone(current);
			const after = structuredClone(current);
			switch (specification.operation) {
				case 'first-cache-removal':
					after.canonicalBuildOutput = 'e'.repeat(64);
					break;
				case 'first-live-projection':
					after.firstLiveProjection = 'f'.repeat(64);
					break;
				case 'copy-first-build-output':
					after.copyDestination = 'e'.repeat(64);
					break;
				case 'copied-bind-inventory-hash-realpath':
					after.copiedProjection = 'f'.repeat(64);
					break;
				case 'second-build-boundary':
					after.canonicalBuildOutput = '1'.repeat(64);
					break;
				case 'second-cache-removal':
					after.canonicalBuildOutput = '2'.repeat(64);
					break;
				case 'second-live-projection':
					after.secondLiveProjection = options.secondProjection ?? 'f'.repeat(64);
					break;
				default:
					break;
			}
			const observation: MutableBaselineObservation = {
				operation: specification.operation,
				before,
				after,
			};
			options.mutate?.(specification.operation, observation);
			current = structuredClone(observation.after);
			return observation;
		},
	});
}

async function operationBisectArtifact(options: { variant?: boolean; fidelity?: boolean } = {}) {
	const first = productionBindingToCanonicalNftProjection(canonicalProductionBinding());
	const copied = structuredClone(first) as unknown as Record<string, unknown>;
	if (options.fidelity === false)
		(copied.rawObservation as Record<string, unknown>).sha256 = '9'.repeat(64);
	const secondBinding = structuredClone(canonicalProductionBinding()) as unknown as Record<
		string,
		unknown
	>;
	if (options.variant)
		(secondBinding.bindings as Array<Record<string, unknown>>)[1]!.targetSha256 = 'e'.repeat(
			64,
		);
	const second = productionBindingToCanonicalNftProjection(
		secondBinding as unknown as ProductionNftBinding,
	);
	const modeled = await syntheticBaselineLedger();
	let current = structuredClone(modeled.ledger[0]!.before) as MutableBaselineFingerprint;
	const ledger = modeled.ledger.slice(0, 10).map((row) => {
		const before = structuredClone(current);
		const after = structuredClone(current) as MutableBaselineFingerprint;
		if (row.operation === 'first-live-projection')
			after.firstLiveProjection = sha256(canonicalize(first));
		if (row.operation === 'copy-first-build-output') after.copyDestination = '8'.repeat(64);
		if (row.operation === 'copied-bind-inventory-hash-realpath')
			after.copiedProjection = sha256(canonicalize(copied));
		if (row.operation === 'second-build-boundary') after.canonicalBuildOutput = '1'.repeat(64);
		if (row.operation === 'second-live-projection')
			after.secondLiveProjection = sha256(canonicalize(second));
		current = structuredClone(after);
		return { ...row, before, after };
	});
	return createNextServerNftOperationBisectArtifact(
		ledger,
		first,
		copied as unknown as CanonicalNftProjection,
		second,
	);
}

function resealOperationBisect(artifact: Record<string, unknown>) {
	(artifact.integrity as Record<string, unknown>).canonicalDigest =
		nextServerNftOperationBisectDigest(artifact);
	return artifact;
}

describe('Killed by Google Next 12 production runner', () => {
	async function fixtureYarnLockBytes() {
		const archiveBytes = await readFile(
			'.versionless/cache/tier-f/next-killedbygoogle/c28878d0f65b56aa595763c852477fb0c1e3533e5c7f7ea9daa2be16f102368d/source.tar.gz',
		);
		const indexed = indexTarGzip(
			{
				bytes: archiveBytes,
				byteLength: archiveBytes.byteLength,
				sha256: sha256(archiveBytes),
			},
			'56809c31592e6ca1edce8af9bfe842fbcdf71f4d',
		);
		return findArchiveFile(indexed, 'yarn.lock').bytes;
	}

	async function productionCacheKeyModel() {
		return modelNext12CacheKeyCandidates({
			nextVersion: '12.0.10',
			hasSsrAmpPages: false,
			hasNextSupport: false,
			buildSourceSha256: '8b9f70734856102c56df52752081ee73b0b39dca2adbc51dc2d40d8331d22dac',
			lockFiles: [
				{ identity: 'fixture/yarn.lock', bytes: await fixtureYarnLockBytes() },
				{ identity: 'ambient/pnpm-lock.yaml', bytes: await readFile('pnpm-lock.yaml') },
			],
		});
	}

	test('models the exact Next 12 concurrent lock-read permutations fail closed', async () => {
		const model = await productionCacheKeyModel();
		expect(model.findUp).toEqual([
			{ name: 'package-lock.json', result: 'absent' },
			{ name: 'yarn.lock', result: 'fixture/yarn.lock' },
			{ name: 'pnpm-lock.yaml', result: 'ambient/pnpm-lock.yaml' },
		]);
		expect(model.locks).toMatchObject([
			{
				identity: 'fixture/yarn.lock',
				sha256: 'a676ee932cef5e54d469dc6d1e040e50f42f9cc88beb16ae5c72c13e26ebc48a',
			},
			{
				identity: 'ambient/pnpm-lock.yaml',
				sha256: '71fb680c6febb2024b8117efadf3ca0641fafa1cc076a08a126724a1b337e166',
			},
		]);
		expect(model.candidates).toHaveLength(2);
		expect(new Set(model.candidates.map((candidate) => candidate.cacheKeySha256)).size).toBe(2);
		expect(model.candidates.map((candidate) => candidate.updateOrder)).toEqual([
			['fixture/yarn.lock', 'ambient/pnpm-lock.yaml'],
			['ambient/pnpm-lock.yaml', 'fixture/yarn.lock'],
		]);

		const fixture = Buffer.from('fixture-lock');
		const ambient = Buffer.from('ambient-lock');
		const input = {
			nextVersion: '12.0.10' as const,
			hasSsrAmpPages: false as const,
			hasNextSupport: false as const,
			buildSourceSha256: '8b9f70734856102c56df52752081ee73b0b39dca2adbc51dc2d40d8331d22dac',
			lockFiles: [
				{ identity: 'fixture/yarn.lock' as const, bytes: fixture },
				{ identity: 'ambient/pnpm-lock.yaml' as const, bytes: ambient },
			],
		};
		const initial = modelNext12CacheKeyCandidates(input);
		const changed = modelNext12CacheKeyCandidates({
			...input,
			lockFiles: [
				input.lockFiles[0]!,
				{ ...input.lockFiles[1]!, bytes: Buffer.from('changed') },
			],
		});
		expect(changed.candidates).not.toEqual(initial.candidates);
		for (const invalid of [
			{ ...input, lockFiles: input.lockFiles.slice(0, 1) },
			{ ...input, lockFiles: [input.lockFiles[0]!, input.lockFiles[0]!] },
			{
				...input,
				lockFiles: [
					input.lockFiles[0]!,
					{ identity: 'fixture/yarn.lock' as const, bytes: ambient },
				],
			},
		])
			expect(() => modelNext12CacheKeyCandidates(invalid)).toThrow('T314');
		for (const fixedChange of [
			{ nextVersion: '12.0.11' },
			{ hasSsrAmpPages: true },
			{ hasNextSupport: true },
			{ buildSourceSha256: 'a'.repeat(64) },
		])
			expect(() =>
				modelNext12CacheKeyCandidates({
					...input,
					...fixedChange,
				} as Parameters<typeof modelNext12CacheKeyCandidates>[0]),
			).toThrow('T314');
	});

	test('classifies both cacheKey provenance outcomes and rejects capture mismatches', async () => {
		const model = await productionCacheKeyModel();
		const [first, second] = model.candidates.map((candidate) => candidate.cacheKeySha256) as [
			string,
			string,
		];
		const unchanged = {
			bindingSetMismatch: false,
			memberFieldMismatch: false,
			targetByteMismatch: false,
		};
		expect(
			createNextServerCacheKeyProvenanceArtifact(model, [first, second], unchanged)
				.classification,
		).toBe('observed-order-variance');
		expect(
			createNextServerCacheKeyProvenanceArtifact(model, [first, first], unchanged)
				.classification,
		).toBe('mechanism-present-unreproduced');
		expect(() =>
			createNextServerCacheKeyProvenanceArtifact(model, ['invalid', first], unchanged),
		).toThrow('lowercase SHA-256');
		expect(() =>
			createNextServerCacheKeyProvenanceArtifact(model, ['f'.repeat(64), first], unchanged),
		).toThrow('outside the source-derived candidate set');
		expect(() =>
			createNextServerCacheKeyProvenanceArtifact(model, [first, second], {
				...unchanged,
				targetByteMismatch: true,
			}),
		).toThrow('non-cacheKey NFT predicate differs');
	});

	test('validates portable hash-only cacheKey provenance schema, privacy, and integrity', async () => {
		const model = await productionCacheKeyModel();
		const [first, second] = model.candidates.map((candidate) => candidate.cacheKeySha256) as [
			string,
			string,
		];
		const create = () =>
			structuredClone(
				createNextServerCacheKeyProvenanceArtifact(model, [first, second], {
					bindingSetMismatch: false,
					memberFieldMismatch: false,
					targetByteMismatch: false,
				}),
			) as unknown as Record<string, unknown>;
		const resealCacheKey = (artifact: Record<string, unknown>) => {
			(artifact.integrity as Record<string, unknown>).canonicalDigest =
				nextServerCacheKeyProvenanceDigest(artifact);
			return artifact;
		};
		expect(validateNextServerCacheKeyProvenanceArtifact(create()).classification).toBe(
			'observed-order-variance',
		);
		for (const mutate of [
			(artifact: Record<string, unknown>) => Object.assign(artifact, { unknown: true }),
			(artifact: Record<string, unknown>) =>
				Object.assign(artifact, { classification: 'mechanism-present-unreproduced' }),
			(artifact: Record<string, unknown>) => {
				(artifact.privacy as Record<string, unknown>).rawLockfileBytesRetained = true;
				return artifact;
			},
			(artifact: Record<string, unknown>) => {
				(
					(artifact.model as Record<string, unknown>).locks as Array<
						Record<string, unknown>
					>
				)[0]!.sha256 = 'b'.repeat(64);
				return artifact;
			},
			(artifact: Record<string, unknown>) => {
				(
					(artifact.model as Record<string, unknown>).locks as Array<
						Record<string, unknown>
					>
				)[0]!.identity = 'ambient/pnpm-lock.yaml';
				return artifact;
			},
			(artifact: Record<string, unknown>) => {
				(
					(artifact.model as Record<string, unknown>).locks as Array<
						Record<string, unknown>
					>
				)[0]!.byteLength = 1;
				return artifact;
			},
			(artifact: Record<string, unknown>) => {
				(
					(artifact.model as Record<string, unknown>).fixedInputs as Record<
						string,
						unknown
					>
				).hasNextSupport = true;
				return artifact;
			},
			(artifact: Record<string, unknown>) => {
				(
					(artifact.model as Record<string, unknown>).findUp as Array<
						Record<string, unknown>
					>
				)[0]!.result = 'ambient/package-lock.json';
				return artifact;
			},
			(artifact: Record<string, unknown>) => {
				(
					(artifact.model as Record<string, unknown>).candidates as Array<
						Record<string, unknown>
					>
				).reverse();
				return artifact;
			},
			(artifact: Record<string, unknown>) => {
				(
					(artifact.model as Record<string, unknown>).candidates as Array<
						Record<string, unknown>
					>
				)[0]!.cacheKeySha256 = 'b'.repeat(64);
				return artifact;
			},
			(artifact: Record<string, unknown>) => {
				(artifact.runs as Array<Record<string, unknown>>)[0]!.actualCacheKeySha256 =
					'f'.repeat(64);
				return artifact;
			},
			(artifact: Record<string, unknown>) => {
				(artifact.nonCacheKeyPredicates as Record<string, unknown>).bindingSetMismatch =
					true;
				return artifact;
			},
		])
			expect(() =>
				validateNextServerCacheKeyProvenanceArtifact(resealCacheKey(mutate(create()))),
			).toThrow('T314');
		const stale = create();
		(stale.integrity as Record<string, unknown>).canonicalDigest = '0'.repeat(64);
		expect(() => validateNextServerCacheKeyProvenanceArtifact(stale)).toThrow(
			'artifact integrity differs',
		);
	});

	test('keeps the cacheKey provenance capture below prohibited runtime and publication boundaries', async () => {
		const source = await readFile(
			'packages/cli/src/fixture/next-killedbygoogle-run.ts',
			'utf8',
		);
		const start = source.indexOf('async function exactFindUp(');
		const end = source.indexOf('export type ProductionComparisonAcquisitionOperations', start);
		const capture = source.slice(start, end);
		for (const prohibited of [
			'chromium',
			'startProduction(',
			'runNextKilledByGoogle(',
			'receipt.json',
			'aggregate.json',
			'evidence/trust',
			'productionOutputConformance(',
		])
			expect(capture).not.toContain(prohibited);
		expect(capture).toContain("rm(path.join(lane, '.next'), { recursive: true, force: true })");
		expect(capture).toContain('nextServerNftMismatchPredicates(first.nft, second.nft)');
		const isolationStart = source.indexOf(
			'export async function verifyIsolatedNextBuildLanePrerequisite(',
		);
		const isolationEnd = source.indexOf('const isolatedCacheKeyCandidate', isolationStart);
		const isolation = source.slice(isolationStart, isolationEnd);
		for (const prohibited of [
			'execute(',
			'runDiagnosticBuild(',
			'writeFile(',
			'cacheKeyProvenanceOutput',
			'chromium',
			'spawn(',
		])
			expect(isolation).not.toContain(prohibited);
	});

	test('proves fresh owned isolated-lane containment, permissions, one-lock discovery, and cleanup', async () => {
		const yarnBytes = await fixtureYarnLockBytes();
		let ownedRoot = '';
		const result = await verifyIsolatedNextBuildLanePrerequisite({
			createOwnedRoot: async (prefix) => {
				ownedRoot = await mkdtemp(prefix);
				return { path: ownedRoot, existedBefore: false };
			},
			populateFixtureLane: async (lane) => {
				await writeFile(path.join(lane, 'yarn.lock'), yarnBytes);
			},
			removeOwnedRoot: async (target) => await rm(target, { recursive: true, force: true }),
		});
		expect(result).toEqual({
			freshOwnedRoot: true,
			realpathDisjoint: true,
			permissions: '0700',
			findUp: {
				packageLock: 'absent',
				yarnLock: 'fixture/yarn.lock',
				pnpmLock: 'absent',
			},
			fixtureLock: {
				sha256: 'a676ee932cef5e54d469dc6d1e040e50f42f9cc88beb16ae5c72c13e26ebc48a',
				byteLength: 256_958,
			},
			cleanup: 'verified-absent',
		});
		await expect(lstat(ownedRoot)).rejects.toThrow();
	});

	test('rejects ancestor locks, aliases, stale roots, permission changes, and partial failures with cleanup', async () => {
		const yarnBytes = await fixtureYarnLockBytes();
		const attempt = async (
			populate: (lane: string) => Promise<void>,
			options: { existedBefore?: boolean } = {},
		) => {
			let ownedRoot = '';
			const execution = verifyIsolatedNextBuildLanePrerequisite({
				createOwnedRoot: async (prefix) => {
					ownedRoot = await mkdtemp(prefix);
					return { path: ownedRoot, existedBefore: options.existedBefore ?? false };
				},
				populateFixtureLane: populate,
				removeOwnedRoot: async (target) =>
					await rm(target, { recursive: true, force: true }),
			});
			await expect(execution).rejects.toThrow();
			await expect(lstat(ownedRoot)).rejects.toThrow();
		};
		await attempt(async (lane) => {
			await writeFile(path.join(lane, 'yarn.lock'), yarnBytes);
			await writeFile(path.join(path.dirname(lane), 'pnpm-lock.yaml'), 'ambient');
		});
		await attempt(async (lane) => {
			const target = path.join(path.dirname(lane), 'real-yarn.lock');
			await writeFile(target, yarnBytes);
			await symlink(target, path.join(lane, 'yarn.lock'));
		});
		await attempt(async () => undefined, { existedBefore: true });
		await attempt(async (lane) => {
			await writeFile(path.join(lane, 'yarn.lock'), yarnBytes);
			await chmod(path.dirname(lane), 0o755);
		});
		await attempt(async () => {
			throw new Error('injected partial population failure');
		});
	});

	test('rejects aliased roots and verifies cleanup failure explicitly', async () => {
		let aliasTarget = '';
		await expect(
			verifyIsolatedNextBuildLanePrerequisite({
				createOwnedRoot: async (prefix) => {
					aliasTarget = await mkdtemp(`${prefix}target-`);
					const alias = await mkdtemp(`${prefix}alias-`);
					await rm(alias, { recursive: true, force: true });
					await symlink(aliasTarget, alias);
					return { path: alias, existedBefore: false };
				},
				populateFixtureLane: async () => undefined,
				removeOwnedRoot: async (target) =>
					await rm(target, { recursive: true, force: true }),
			}),
		).rejects.toThrow('T316');
		await rm(aliasTarget, { recursive: true, force: true });

		let uncleared = '';
		await expect(
			verifyIsolatedNextBuildLanePrerequisite({
				createOwnedRoot: async (prefix) => {
					uncleared = await mkdtemp(prefix);
					return { path: uncleared, existedBefore: false };
				},
				populateFixtureLane: async () => undefined,
				removeOwnedRoot: async () => undefined,
			}),
		).rejects.toThrow('isolated root cleanup failed');
		await rm(uncleared, { recursive: true, force: true });
	});

	test('runs exactly one isolated install and two reset-build-capture cycles without retry', async () => {
		const calls: string[] = [];
		const [first, second] = mutableRuns(mismatchArtifact());
		if (!first || !second) throw new Error('synthetic NFT runs are absent');
		const runs = await acquireIsolatedNextCacheKeyRuns('/isolated/lane', {
			install: async (lane) => void calls.push(`install:${lane}`),
			resetBuild: async (lane) => void calls.push(`reset:${lane}`),
			build: async (lane) => void calls.push(`build:${lane}`),
			capture: async (lane, id) => {
				calls.push(`capture:${id}:${lane}`);
				return {
					actualCacheKeySha256:
						'a6375d1500463115ea1b64cb8acbf5de78fb93a2ac3607df9d9b83b36e06dd6d',
					nft: (id === 'first' ? first : second) as NftMismatchRun,
				};
			},
		});
		expect(runs).toHaveLength(2);
		expect(calls).toEqual([
			'install:/isolated/lane',
			'reset:/isolated/lane',
			'build:/isolated/lane',
			'capture:first:/isolated/lane',
			'reset:/isolated/lane',
			'build:/isolated/lane',
			'capture:second:/isolated/lane',
		]);
		calls.length = 0;
		await expect(
			acquireIsolatedNextCacheKeyRuns('/isolated/lane', {
				install: async () => void calls.push('install'),
				resetBuild: async () => void calls.push('reset'),
				build: async () => {
					calls.push('build');
					throw new Error('injected build failure');
				},
				capture: async () => {
					throw new Error('capture must not run');
				},
			}),
		).rejects.toThrow('injected build failure');
		expect(calls).toEqual(['install', 'reset', 'build']);
	});

	test('validates the isolated cacheKey artifact lifecycle, schema, privacy, and integrity fail closed', () => {
		const [first, second] = mutableRuns(mismatchArtifact());
		if (!first || !second) throw new Error('synthetic NFT runs are absent');
		const proof = {
			freshOwnedRoot: true as const,
			realpathDisjoint: true as const,
			permissions: '0700' as const,
			findUp: {
				packageLock: 'absent' as const,
				yarnLock: 'fixture/yarn.lock' as const,
				pnpmLock: 'absent' as const,
			},
			fixtureLock: {
				sha256: 'a676ee932cef5e54d469dc6d1e040e50f42f9cc88beb16ae5c72c13e26ebc48a',
				byteLength: 256_958 as const,
			},
			cleanup: 'verified-absent' as const,
		};
		const actual = 'a6375d1500463115ea1b64cb8acbf5de78fb93a2ac3607df9d9b83b36e06dd6d';
		const create = () =>
			structuredClone(
				createNextServerIsolatedCacheKeyArtifact(proof, [
					{ actualCacheKeySha256: actual, nft: first as NftMismatchRun },
					{ actualCacheKeySha256: actual, nft: second as NftMismatchRun },
				]),
			) as unknown as Record<string, unknown>;
		const resealIsolated = (artifact: Record<string, unknown>) => {
			(artifact.integrity as Record<string, unknown>).canonicalDigest =
				nextServerIsolatedCacheKeyDigest(artifact);
			return artifact;
		};
		expect(() => validateNextServerIsolatedCacheKeyArtifact(create())).not.toThrow();
		for (const mutate of [
			(artifact: Record<string, unknown>) => Object.assign(artifact, { unknown: true }),
			(artifact: Record<string, unknown>) =>
				Object.assign(artifact, { candidate: 'f'.repeat(64) }),
			(artifact: Record<string, unknown>) => {
				(artifact.runs as Array<Record<string, unknown>>)[0]!.actualCacheKeySha256 =
					'f'.repeat(64);
				return artifact;
			},
			(artifact: Record<string, unknown>) => {
				(artifact.runs as Array<Record<string, unknown>>)[1]!.nonCacheKeyProjectionSha256 =
					'f'.repeat(64);
				return artifact;
			},
			(artifact: Record<string, unknown>) => {
				(artifact.nonCacheKeyPredicates as Record<string, unknown>).targetByteMismatch =
					true;
				return artifact;
			},
			(artifact: Record<string, unknown>) => {
				(artifact.lifecycle as Record<string, unknown>).builds = 3;
				return artifact;
			},
			(artifact: Record<string, unknown>) => {
				(artifact.lifecycle as Record<string, unknown>).cleanupBeforePublication = false;
				return artifact;
			},
			(artifact: Record<string, unknown>) => {
				(artifact.isolation as Record<string, unknown>).permissions = '0755';
				return artifact;
			},
			(artifact: Record<string, unknown>) => {
				(artifact.privacy as Record<string, unknown>).rawManifestRetained = true;
				return artifact;
			},
		])
			expect(() =>
				validateNextServerIsolatedCacheKeyArtifact(resealIsolated(mutate(create()))),
			).toThrow('T318');
		const stale = create();
		(stale.integrity as Record<string, unknown>).canonicalDigest = '0'.repeat(64);
		expect(() => validateNextServerIsolatedCacheKeyArtifact(stale)).toThrow(
			'artifact integrity differs',
		);

		const changed = structuredClone(second);
		changed.members[0]!.targetSha256 = 'c'.repeat(64);
		expect(() =>
			createNextServerIsolatedCacheKeyArtifact(proof, [
				{ actualCacheKeySha256: actual, nft: first as NftMismatchRun },
				{ actualCacheKeySha256: actual, nft: changed as NftMismatchRun },
			]),
		).toThrow('non-cacheKey NFT predicate differs');
		expect(() =>
			createNextServerIsolatedCacheKeyArtifact(proof, [
				{ actualCacheKeySha256: 'f'.repeat(64), nft: first as NftMismatchRun },
				{ actualCacheKeySha256: actual, nft: second as NftMismatchRun },
			]),
		).toThrow('actual cacheKey differs');
	});

	test('runs the isolated callback only after proof and cleans before returning results', async () => {
		const yarnBytes = await fixtureYarnLockBytes();
		let ownedRoot = '';
		let callbackObserved = false;
		const completed = await withIsolatedNextBuildLane(
			{
				createOwnedRoot: async (prefix) => {
					ownedRoot = await mkdtemp(prefix);
					return { path: ownedRoot, existedBefore: false };
				},
				populateFixtureLane: async (lane) => {
					await writeFile(path.join(lane, 'yarn.lock'), yarnBytes);
				},
				removeOwnedRoot: async (target) =>
					await rm(target, { recursive: true, force: true }),
			},
			async (lane, proof) => {
				callbackObserved = true;
				expect(proof.findUp).toEqual({
					packageLock: 'absent',
					yarnLock: 'fixture/yarn.lock',
					pnpmLock: 'absent',
				});
				expect((await lstat(lane)).isDirectory()).toBe(true);
				return 'captured';
			},
		);
		expect(callbackObserved).toBe(true);
		expect(completed.result).toBe('captured');
		await expect(lstat(ownedRoot)).rejects.toThrow();
	});

	test('orders isolated cleanup before atomic publication and excludes prohibited paths', async () => {
		const source = await readFile(
			'packages/cli/src/fixture/next-killedbygoogle-run.ts',
			'utf8',
		);
		const start = source.indexOf(
			'export async function captureNextServerIsolatedCacheKeyProvenance',
		);
		const end = source.indexOf('async function extractCacheKeyProvenanceLane()', start);
		const capture = source.slice(start, end);
		expect(capture.indexOf('await withIsolatedNextBuildLane(')).toBeGreaterThan(-1);
		expect(capture.indexOf('await withIsolatedNextBuildLane(')).toBeLessThan(
			capture.indexOf('await mkdir(isolatedCacheKeyProvenanceStage'),
		);
		for (const prohibited of [
			'chromium',
			'startProduction(',
			'runNextKilledByGoogle(',
			'receipt.json',
			'aggregate.json',
			'evidence/trust',
			'productionOutputConformance(',
			'cp(',
		])
			expect(capture).not.toContain(prohibited);
	});

	test('keeps two independent verified workflow lanes alive through resource closure and cleans both', async () => {
		const yarnBytes = await fixtureYarnLockBytes();
		const events: string[] = [];
		const roots: string[] = [];
		const result = await withIsolatedNextWorkflowLanes(
			{
				createOwnedRoot: async (prefix) => {
					const ownedRoot = await mkdtemp(prefix);
					roots.push(ownedRoot);
					events.push(`create:${roots.length}`);
					return { path: ownedRoot, existedBefore: false };
				},
				populateFixtureLane: async (lane) => {
					events.push(`populate:${roots.indexOf(path.dirname(lane)) + 1}`);
					await writeFile(path.join(lane, 'yarn.lock'), yarnBytes);
				},
				removeOwnedRoot: async (ownedRoot) => {
					events.push(`remove:${roots.indexOf(ownedRoot) + 1}`);
					await rm(ownedRoot, { recursive: true, force: true });
				},
			},
			async () => {
				events.push('close');
			},
			async ({ baseline, migrated, proofs }) => {
				events.push('use');
				expect(baseline).not.toBe(migrated);
				expect(proofs.baseline.findUp).toEqual(proofs.migrated.findUp);
				expect((await lstat(baseline)).isDirectory()).toBe(true);
				expect((await lstat(migrated)).isDirectory()).toBe(true);
				return 'staged';
			},
		);
		expect(result).toBe('staged');
		expect(events).toEqual([
			'create:1',
			'populate:1',
			'create:2',
			'populate:2',
			'use',
			'close',
			'remove:2',
			'remove:1',
		]);
		for (const ownedRoot of roots) await expect(lstat(ownedRoot)).rejects.toThrow();
	});

	test('closes and removes both workflow lanes on failure without retry', async () => {
		const yarnBytes = await fixtureYarnLockBytes();
		const roots: string[] = [];
		let uses = 0;
		let closes = 0;
		await expect(
			withIsolatedNextWorkflowLanes(
				{
					createOwnedRoot: async (prefix) => {
						const ownedRoot = await mkdtemp(prefix);
						roots.push(ownedRoot);
						return { path: ownedRoot, existedBefore: false };
					},
					populateFixtureLane: async (lane) =>
						await writeFile(path.join(lane, 'yarn.lock'), yarnBytes),
					removeOwnedRoot: async (ownedRoot) =>
						await rm(ownedRoot, { recursive: true, force: true }),
				},
				async () => {
					closes += 1;
				},
				async () => {
					uses += 1;
					throw new Error('workflow failed');
				},
			),
		).rejects.toThrow('workflow failed');
		expect(uses).toBe(1);
		expect(closes).toBe(1);
		for (const ownedRoot of roots) await expect(lstat(ownedRoot)).rejects.toThrow();
	});

	test('removes and verifies work before promotion and blocks early promotion on failure', async () => {
		const events: string[] = [];
		await expect(
			promoteAfterIsolatedNextWorkflow({
				runInsideLanes: async () => {
					events.push('lanes');
					return 'receipt';
				},
				removeWork: async () => {
					events.push('remove-work');
				},
				assertWorkAbsent: async () => {
					events.push('absent');
				},
				promote: async (result) => {
					events.push(`promote:${result}`);
				},
			}),
		).resolves.toBe('receipt');
		expect(events).toEqual(['lanes', 'remove-work', 'absent', 'promote:receipt']);
		events.length = 0;
		await expect(
			promoteAfterIsolatedNextWorkflow({
				runInsideLanes: async () => {
					events.push('lanes');
					throw new Error('failed');
				},
				removeWork: async () => {
					events.push('remove-work');
				},
				assertWorkAbsent: async () => {
					events.push('absent');
				},
				promote: async () => {
					events.push('promote');
				},
			}),
		).rejects.toThrow('failed');
		expect(events).toEqual(['lanes', 'remove-work', 'absent']);
	});

	test('requires every production snapshot to bind the isolated cacheKey projection', () => {
		const binding = {
			relativeManifest: 'next-server.js.nft.json' as const,
			cacheKeyPresent: true,
			cacheKeyType: 'string' as const,
			cacheKeySha256: '7687588279f783d4d9e5f43a4fdb316c06c2b540f5c6b99ca3959a4bbafbfadb',
			cacheKeyByteLength: 64,
		} as ProductionNftBinding;
		const snapshotWith = (candidate: ProductionNftBinding) =>
			({
				identity: 'baseline-first',
				canonicalLaneRoot: '/isolated/baseline',
				storageRoot: '/isolated/baseline/.next',
				buildId: 'synthetic',
				inventory: [],
				nftBindings: [candidate],
			}) as ProductionSnapshot;
		const snapshot = snapshotWith(binding);
		expect(() => assertIsolatedProductionCacheKeyBinding(snapshot)).not.toThrow();
		expect(() =>
			assertIsolatedProductionCacheKeyBindings(Array.from({ length: 6 }, () => snapshot)),
		).not.toThrow();
		for (const changed of [
			{
				...binding,
				cacheKeySha256: 'a6375d1500463115ea1b64cb8acbf5de78fb93a2ac3607df9d9b83b36e06dd6d',
			},
			{
				...binding,
				cacheKeySha256: 'ee9df882b64425c77a104eb9fe076d45723e11daafe255b4dbc6f7dba55b20f7',
			},
			{ ...binding, cacheKeyByteLength: 63 },
			{ ...binding, cacheKeyType: 'absent' as const },
			{ ...binding, cacheKeyPresent: false },
			{ ...binding, cacheKeySha256: null },
		] as ProductionNftBinding[])
			expect(() => assertIsolatedProductionCacheKeyBinding(snapshotWith(changed))).toThrow(
				'T322',
			);
		expect(() =>
			assertIsolatedProductionCacheKeyBindings([
				...Array.from({ length: 5 }, () => snapshot),
				snapshotWith({ ...binding, cacheKeyByteLength: 63 }),
			]),
		).toThrow('T322');
		expect(() => assertIsolatedProductionCacheKeyBindings([snapshot])).toThrow('T322');
	});

	test('wires T318 validation, isolated lanes, cacheKey binding, cleanup, and promotion in order', async () => {
		const source = await readFile(
			'packages/cli/src/fixture/next-killedbygoogle-run.ts',
			'utf8',
		);
		const start = source.indexOf('export async function runNextKilledByGoogle()');
		const end = source.indexOf('async function extractOperationBisectLane(', start);
		const workflow = source.slice(start, end);
		for (const required of [
			'42cdd32f10fd1e94a45e0f83656015cb40a741cf460d13745444e3faad5c4bc8',
			'411d2d6e725389981f32d8051a7a1fa286d191aebc9d5ddfba1e283793b2daba',
			'withIsolatedNextWorkflowLanes(',
			'assertIsolatedProductionCacheKeyBindings([',
			'promoteAfterIsolatedNextWorkflow({',
			'supports.length !== 13',
			'valueHashRetained: false',
		])
			expect(source).toContain(required);
		expect(source).toContain('binding.cacheKeySha256 !== isolatedCacheKeyProjectionSha256');
		expect(source).not.toContain('sha256(binding.cacheKeySha256)');
		expect(workflow).not.toContain("extractLane('baseline')");
		expect(workflow).not.toContain("extractLane('migrated')");
		expect(
			workflow.indexOf('validatePublishedNextServerIsolatedCacheKeyProvenance()'),
		).toBeLessThan(workflow.indexOf('await mkdir(work'));
		expect(workflow.indexOf('assertWorkAbsent:')).toBeLessThan(
			workflow.indexOf('promote: async'),
		);
		const chromium = workflow.indexOf('browser = await chromium.launch');
		for (const snapshotName of [
			'baselineFirstLiveProduction',
			'baselineFirstProduction',
			'baselineSecondProduction',
			'migratedInitialLiveProduction',
			'migratedFirstProduction',
		])
			expect(
				workflow.indexOf(`assertIsolatedProductionCacheKeyBinding(${snapshotName})`),
			).toBeLessThan(chromium);
		expect(workflow.indexOf('const baselineProduction =')).toBeLessThan(chromium);
		expect(
			workflow.indexOf('assertIsolatedProductionCacheKeyBinding(migratedSecondProduction)'),
		).toBeLessThan(workflow.indexOf('const migratedProduction ='));
		expect(workflow.indexOf('assertIsolatedProductionCacheKeyBindings([')).toBeGreaterThan(
			workflow.indexOf('const migratedProduction ='),
		);
	});

	const semanticJourney = () => ({
		pass: 1 as const,
		phase: 'baseline-parity' as const,
		lane: 'baseline' as const,
		appSha256: 'a'.repeat(64),
		buildSha256: 'b'.repeat(64),
		initialRows: 263,
		initialProducts: 263,
		searchTerm: 'Google+',
		searchRows: 1,
		googlePlus: {
			name: 'Google+',
			type: 'service',
			link: 'https://en.wikipedia.org/wiki/Google%2B',
			description: 'Google+ was an Internet-based social network.',
		},
		filterLabel: 'Apps (50)',
		appRows: 50,
		blocked: [
			{ kind: 'nonloopback' as const, value: 'https://analytics.bale.media/a.js' },
			{ kind: 'excluded-local-asset' as const, value: 'public/assets/missing.png' },
		] as Array<{
			kind: 'nonloopback' | 'excluded-local-asset';
			value: string;
		}>,
		scripts: [
			{ src: '', async: false, defer: false },
			{
				src: 'http://127.0.0.1:31001/_next/static/chunks/pages/index-a1.js',
				async: true,
				defer: false,
			},
			{ src: 'https://cdn.example.test/external.js', async: false, defer: true },
		],
		successfulNonLoopback: 0,
		pageErrors: [] as string[],
	});

	test('projects exact journey semantics while excluding only lane provenance and generated local identity', () => {
		const baseline = semanticJourney();
		const expected = projectKilledByGoogleJourneySemantics(baseline);
		for (const provenance of [
			{ pass: 2 },
			{ phase: 'migrated-parity' },
			{ lane: 'migrated' },
			{ appSha256: 'c'.repeat(64) },
			{ buildSha256: 'd'.repeat(64) },
		]) {
			const changed = structuredClone(baseline) as Record<string, unknown>;
			Object.assign(changed, provenance);
			expect(projectKilledByGoogleJourneySemantics(changed)).toEqual(expected);
		}
		for (const source of [
			'http://127.0.0.1:31999/_next/static/chunks/pages/index-a1.js',
			'http://127.0.0.1:31001/_next/static/chunks/pages/index-z9.js',
		]) {
			const changed = structuredClone(baseline) as Record<string, unknown>;
			(changed.scripts as Array<Record<string, unknown>>)[1]!.src = source;
			expect(projectKilledByGoogleJourneySemantics(changed)).toEqual(expected);
		}
		const reorderedBlocked = structuredClone(baseline);
		reorderedBlocked.blocked.reverse();
		expect(projectKilledByGoogleJourneySemantics(reorderedBlocked)).toEqual(expected);
	});

	test('retains every UI, locality, error, blocked-request, and script semantic independently', () => {
		const baseline = semanticJourney();
		const expected = projectKilledByGoogleJourneySemantics(baseline);
		const mutations: Array<(journey: ReturnType<typeof semanticJourney>) => void> = [
			(journey) => void (journey.initialRows = 262),
			(journey) => void (journey.initialProducts = 262),
			(journey) => void (journey.searchTerm = 'Google'),
			(journey) => void (journey.searchRows = 2),
			(journey) => void (journey.googlePlus.name = 'Google Plus'),
			(journey) => void (journey.googlePlus.type = 'app'),
			(journey) => void (journey.googlePlus.link = 'https://example.test/google-plus'),
			(journey) => void (journey.googlePlus.description = 'Changed.'),
			(journey) => void (journey.filterLabel = 'Apps'),
			(journey) => void (journey.appRows = 49),
			(journey) => void (journey.blocked[0]!.value = 'https://analytics.bale.media/b.js'),
			(journey) => void (journey.blocked[0]!.kind = 'excluded-local-asset'),
			(journey) => void journey.blocked.pop(),
			(journey) => void journey.scripts.pop(),
			(journey) => void journey.scripts.reverse(),
			(journey) => void (journey.scripts[0]!.async = true),
			(journey) => void (journey.scripts[0]!.defer = true),
			(journey) => void (journey.scripts[0]!.src = 'http://127.0.0.1:31001/local.js'),
			(journey) => void (journey.scripts[2]!.src = 'https://cdn.example.test/other.js'),
			(journey) => void (journey.successfulNonLoopback = 1),
			(journey) => void journey.pageErrors.push('synthetic page error'),
		];
		for (const mutate of mutations) {
			const changed = structuredClone(baseline);
			mutate(changed);
			expect(projectKilledByGoogleJourneySemantics(changed)).not.toEqual(expected);
		}
	});

	test('rejects unknown journey and nested semantic fields fail closed', () => {
		for (const mutate of [
			(journey: Record<string, unknown>) => Object.assign(journey, { unknown: true }),
			(journey: Record<string, unknown>) =>
				Object.assign(journey.googlePlus as Record<string, unknown>, { unknown: true }),
			(journey: Record<string, unknown>) =>
				Object.assign((journey.blocked as Array<Record<string, unknown>>)[0]!, {
					unknown: true,
				}),
			(journey: Record<string, unknown>) =>
				Object.assign((journey.scripts as Array<Record<string, unknown>>)[0]!, {
					unknown: true,
				}),
		]) {
			const changed = structuredClone(semanticJourney()) as Record<string, unknown>;
			mutate(changed);
			expect(() => projectKilledByGoogleJourneySemantics(changed)).toThrow('T308');
		}
	});

	test('derives the exact immutable product, Apps, and literal Google+ oracle', async () => {
		const archive = await readFile(
			'.versionless/cache/tier-f/next-killedbygoogle/c28878d0f65b56aa595763c852477fb0c1e3533e5c7f7ea9daa2be16f102368d/source.tar.gz',
		);
		const graveyard = JSON.parse(
			findArchiveFile(
				indexTarGzip(
					{ bytes: archive, byteLength: archive.byteLength, sha256: sha256(archive) },
					'56809c31592e6ca1edce8af9bfe842fbcdf71f4d',
				),
				'graveyard.json',
			).bytes.toString('utf8'),
		) as Array<Record<string, string>>;
		const literal = 'google+';
		const matches = graveyard.filter(
			(item) =>
				item.name?.toLowerCase().includes(literal) ||
				item.description?.toLowerCase().includes(literal),
		);
		expect(graveyard).toHaveLength(263);
		expect(graveyard.filter((item) => item.type === 'app')).toHaveLength(50);
		expect(matches).toHaveLength(1);
		expect(matches[0]).toMatchObject(killedByGoogleBrowserOracle.googlePlus);
		expect(
			graveyard.reduce(
				(count, item) =>
					count +
					(item.name?.includes('Google+') ? 1 : 0) +
					(item.description?.includes('Google+') ? 1 : 0),
				0,
			),
		).toBe(2);
	});

	test('uses exact product-only browser and typed mutation oracles', () => {
		expect(killedByGoogleBrowserOracle).toEqual({
			total: 263,
			apps: 50,
			googlePlus: {
				name: 'Google+',
				type: 'service',
				link: 'https://en.wikipedia.org/wiki/Google%2B',
				description: 'Google+ was an Internet-based social network.',
			},
		});
		const mutation = new KilledByGoogleJourneyOracleError(263);
		expect(mutation).toMatchObject({
			code: 'google-plus-product-count',
			expected: 1,
			actual: 263,
		});
	});

	test('structurally captures only the exact typed mutation-red signal', () => {
		const exact = { code: 'google-plus-product-count', expected: 1, actual: 263 };
		const provenance = { phase: 'mutation-red', lane: 'migrated' };
		expect(
			classifyKilledByGoogleMutationSignal(
				new KilledByGoogleJourneyOracleError(263),
				provenance,
			),
		).toEqual(exact);
		expect(classifyKilledByGoogleMutationSignal(exact, provenance)).toEqual(exact);
		for (const rejected of [
			null,
			new Error('unrelated'),
			{ ...exact, code: 'other' },
			{ ...exact, expected: 263 },
			{ ...exact, actual: 1 },
		])
			expect(classifyKilledByGoogleMutationSignal(rejected, provenance)).toBeNull();
		expect(
			classifyKilledByGoogleMutationSignal(exact, {
				phase: 'migrated-parity',
				lane: 'migrated',
			}),
		).toBeNull();
	});

	test('always restores and byte-verifies before returning an injected mutation signal', async () => {
		const calls: string[] = [];
		const original = Buffer.from('original');
		const signal = await captureKilledByGoogleMutationWithRestoration({
			runMutated: async () => {
				calls.push('mutated');
				throw { code: 'google-plus-product-count', expected: 1, actual: 263 };
			},
			restore: async () => {
				calls.push('restore');
			},
			readRestored: async () => {
				calls.push('verify-bytes');
				return original;
			},
			expectedSha256: sha256(original),
			provenance: { phase: 'mutation-red', lane: 'migrated' },
		});
		expect(signal).toEqual({ code: 'google-plus-product-count', expected: 1, actual: 263 });
		expect(calls).toEqual(['mutated', 'restore', 'verify-bytes']);
	});

	test('restores after absent, malformed, and unrelated mutation outcomes', async () => {
		for (const outcome of [
			undefined,
			{ code: 'wrong', expected: 1, actual: 263 },
			{ code: 'google-plus-product-count', expected: 2, actual: 263 },
			{ code: 'google-plus-product-count', expected: 1, actual: 262 },
			new Error('unrelated'),
		]) {
			const calls: string[] = [];
			const operation = captureKilledByGoogleMutationWithRestoration({
				runMutated: async () => {
					calls.push('mutated');
					if (outcome !== undefined) throw outcome;
				},
				restore: async () => {
					calls.push('restore');
				},
				readRestored: async () => {
					calls.push('verify-bytes');
					return Buffer.from('original');
				},
				expectedSha256: sha256('original'),
				provenance: { phase: 'mutation-red', lane: 'migrated' },
			});
			await expect(operation).rejects.toBeDefined();
			expect(calls).toEqual(['mutated', 'restore', 'verify-bytes']);
		}
	});

	test('phase-tags restoration byte and restored-journey failures', async () => {
		await expect(
			captureKilledByGoogleMutationWithRestoration({
				runMutated: async () => {},
				restore: async () => {},
				readRestored: async () => Buffer.from('original'),
				expectedSha256: sha256('original'),
				provenance: { phase: 'mutation-red', lane: 'migrated' },
			}),
		).rejects.toMatchObject({ phase: 'mutation-red' });
		await expect(
			captureKilledByGoogleMutationWithRestoration({
				runMutated: async () => {
					throw { code: 'google-plus-product-count', expected: 1, actual: 263 };
				},
				restore: async () => {},
				readRestored: async () => Buffer.from('changed'),
				expectedSha256: sha256('original'),
				provenance: { phase: 'mutation-red', lane: 'migrated' },
			}),
		).rejects.toMatchObject({ phase: 'restoration-bytes' });
		await expect(
			runKilledByGoogleRestorationJourney(async () => {
				throw new Error('journey failed');
			}),
		).rejects.toBeInstanceOf(KilledByGoogleMutationPhaseError);
		await expect(
			runKilledByGoogleRestorationJourney(async () => {
				throw new Error('journey failed');
			}),
		).rejects.toMatchObject({ phase: 'restoration-journey' });
	});

	test('orders finally restoration and byte verification before the restoration build', async () => {
		const source = await readFile(
			'packages/cli/src/fixture/next-killedbygoogle-run.ts',
			'utf8',
		);
		const helperStart = source.indexOf(
			'export async function captureKilledByGoogleMutationWithRestoration',
		);
		const helperEnd = source.indexOf(
			'export async function runKilledByGoogleRestorationJourney',
			helperStart,
		);
		const helper = source.slice(helperStart, helperEnd);
		expect(helper.indexOf('} finally {')).toBeGreaterThan(0);
		expect(helper.indexOf('await operations.restore();')).toBeGreaterThan(
			helper.indexOf('} finally {'),
		);
		expect(helper.indexOf('await operations.readRestored()')).toBeGreaterThan(
			helper.indexOf('await operations.restore();'),
		);
		const workflowStart = source.indexOf('const mutationFailure = await');
		const workflow = source.slice(
			workflowStart,
			source.indexOf('const allJourneys', workflowStart),
		);
		expect(workflow.indexOf('captureKilledByGoogleMutationWithRestoration')).toBeLessThan(
			workflow.indexOf('const migratedRestored = await buildSnapshot(migrated);'),
		);
		expect(workflow).toContain('runKilledByGoogleRestorationJourney');
	});

	test('creates exact pre-server phase descriptors and rejects aliases, stale state, and mistagging', async () => {
		const laneRoot = '/canonical/lane';
		const app = Buffer.from('app');
		const buildSha256 = 'a'.repeat(64);
		const observe = {
			realpath: async (target: string) => target,
			readApp: async () => app,
			buildFingerprint: async () => buildSha256,
		};
		const descriptors = await createKilledByGoogleJourneyDescriptors(
			{
				phase: 'migrated-parity',
				lane: 'migrated',
				laneRoot,
				expectedAppSha256: sha256(app),
				expectedBuildSha256: buildSha256,
			},
			observe,
		);
		expect(descriptors).toEqual([
			{
				phase: 'migrated-parity',
				lane: 'migrated',
				pass: 1,
				canonicalLaneRoot: laneRoot,
				canonicalBuildRoot: `${laneRoot}/.next`,
				expectedAppSha256: sha256(app),
				expectedBuildSha256: buildSha256,
				expectedSearchRows: 1,
			},
			{
				phase: 'migrated-parity',
				lane: 'migrated',
				pass: 2,
				canonicalLaneRoot: laneRoot,
				canonicalBuildRoot: `${laneRoot}/.next`,
				expectedAppSha256: sha256(app),
				expectedBuildSha256: buildSha256,
				expectedSearchRows: 1,
			},
		]);
		await expect(
			createKilledByGoogleJourneyDescriptors(
				{
					phase: 'baseline-parity',
					lane: 'baseline',
					laneRoot,
					expectedAppSha256: sha256(app),
					expectedBuildSha256: buildSha256,
				},
				{
					...observe,
					realpath: async (target) => (target === laneRoot ? '/aliased/lane' : target),
				},
			),
		).rejects.toThrow('aliases or escapes');
		await expect(
			createKilledByGoogleJourneyDescriptors(
				{
					phase: 'migrated-parity',
					lane: 'migrated',
					laneRoot,
					expectedAppSha256: 'b'.repeat(64),
					expectedBuildSha256: buildSha256,
				},
				observe,
			),
		).rejects.toThrow('fingerprint is stale');
		await expect(
			createKilledByGoogleJourneyDescriptors(
				{
					phase: 'restoration-green',
					lane: 'baseline',
					laneRoot,
					expectedAppSha256: sha256(app),
					expectedBuildSha256: buildSha256,
				},
				observe,
			),
		).rejects.toThrow('wrong lane');
	});

	test('rejects wrong phase order and confines exact 263 mutation classification', async () => {
		expect(() =>
			validateKilledByGoogleJourneyPhaseOrder([
				'baseline-parity',
				'migrated-parity',
				'mutation-red',
				'restoration-green',
			]),
		).not.toThrow();
		expect(() =>
			validateKilledByGoogleJourneyPhaseOrder([
				'migrated-parity',
				'baseline-parity',
				'mutation-red',
				'restoration-green',
			]),
		).toThrow('phase order differs');
		const base = {
			lane: 'migrated' as const,
			pass: 1 as const,
			canonicalLaneRoot: '/lane',
			canonicalBuildRoot: '/lane/.next',
			expectedAppSha256: 'a'.repeat(64),
			expectedBuildSha256: 'b'.repeat(64),
		};
		expect(() =>
			assertKilledByGoogleSettledSearchCount(
				{ ...base, phase: 'migrated-parity', expectedSearchRows: 1 },
				1,
			),
		).not.toThrow();
		expect(() =>
			assertKilledByGoogleSettledSearchCount(
				{ ...base, phase: 'migrated-parity', expectedSearchRows: 1 },
				263,
			),
		).toThrow('unsettled or wrong-state');
		expect(() =>
			assertKilledByGoogleSettledSearchCount(
				{ ...base, phase: 'mutation-red', expectedSearchRows: 263 },
				263,
			),
		).toThrow(KilledByGoogleJourneyOracleError);
		expect(() =>
			assertKilledByGoogleSettledSearchCount(
				{ ...base, phase: 'mutation-red', expectedSearchRows: 263 },
				1,
			),
		).toThrow('unsettled or wrong-state');
	});

	test('revalidates exact roots and fingerprints at launch time', async () => {
		const app = Buffer.from('app');
		const descriptor = {
			phase: 'migrated-parity' as const,
			lane: 'migrated' as const,
			pass: 1 as const,
			canonicalLaneRoot: '/lane',
			canonicalBuildRoot: '/lane/.next',
			expectedAppSha256: sha256(app),
			expectedBuildSha256: 'b'.repeat(64),
			expectedSearchRows: 1 as const,
		};
		const descriptors = [descriptor, { ...descriptor, pass: 2 as const }] as const;
		const calls: string[] = [];
		const observe = {
			realpath: async (target: string) => {
				calls.push(`realpath:${target}`);
				return target;
			},
			readApp: async (lane: string) => {
				calls.push(`app:${lane}`);
				return app;
			},
			buildFingerprint: async (build: string) => {
				calls.push(`build:${build}`);
				return descriptor.expectedBuildSha256;
			},
		};
		await expect(
			revalidateKilledByGoogleJourneyLaunch(descriptors, observe),
		).resolves.toBeUndefined();
		expect(calls).toEqual([
			'realpath:/lane',
			'realpath:/lane/.next',
			'app:/lane',
			'build:/lane/.next',
		]);
		await expect(
			revalidateKilledByGoogleJourneyLaunch(descriptors, {
				...observe,
				buildFingerprint: async () => 'c'.repeat(64),
			}),
		).rejects.toThrow('launch-time App or build fingerprint changed');
		await expect(
			revalidateKilledByGoogleJourneyLaunch(descriptors, {
				...observe,
				realpath: async (target) => (target === '/lane/.next' ? '/other/.next' : target),
			}),
		).rejects.toThrow('launch-time lane or build root changed or aliased');
	});

	test('binds phase ordering to consumption by actual journey execution state', () => {
		const descriptor = {
			lane: 'migrated' as const,
			pass: 1 as const,
			canonicalLaneRoot: '/lane',
			canonicalBuildRoot: '/lane/.next',
			expectedAppSha256: 'a'.repeat(64),
			expectedBuildSha256: 'b'.repeat(64),
			expectedSearchRows: 1 as 1 | 263,
		};
		const pair = (
			phase: 'baseline-parity' | 'migrated-parity' | 'mutation-red' | 'restoration-green',
		) =>
			[
				{
					...descriptor,
					phase,
					lane:
						phase === 'baseline-parity' ? ('baseline' as const) : ('migrated' as const),
				},
				{
					...descriptor,
					phase,
					pass: 2 as const,
					lane:
						phase === 'baseline-parity' ? ('baseline' as const) : ('migrated' as const),
				},
			] as const;
		const state = createKilledByGoogleJourneyPhaseState();
		state.consume(pair('baseline-parity'));
		state.consume(pair('migrated-parity'));
		state.consume(pair('mutation-red'));
		state.consume(pair('restoration-green'));
		expect(() => state.assertComplete()).not.toThrow();
		const wrong = createKilledByGoogleJourneyPhaseState();
		expect(() => wrong.consume(pair('migrated-parity'))).toThrow(
			'executed browser phase order',
		);
		expect(() => createKilledByGoogleJourneyPhaseState().assertComplete()).toThrow(
			'executed browser phases are incomplete',
		);
	});

	test('requires two stable post-input turns and rejects mutation observations of one', () => {
		const base = {
			lane: 'migrated' as const,
			pass: 1 as const,
			canonicalLaneRoot: '/lane',
			canonicalBuildRoot: '/lane/.next',
			expectedAppSha256: 'a'.repeat(64),
			expectedBuildSha256: 'b'.repeat(64),
		};
		const mutation = {
			...base,
			phase: 'mutation-red' as const,
			expectedSearchRows: 263 as const,
		};
		const initial = { inputValue: '', count: 263, postInputTurn: 0 };
		expect(settledKilledByGoogleSearchCount(mutation, [initial])).toBeNull();
		expect(
			settledKilledByGoogleSearchCount(mutation, [
				initial,
				{ inputValue: 'Google+', count: 263, postInputTurn: 1 },
			]),
		).toBeNull();
		expect(
			settledKilledByGoogleSearchCount(mutation, [
				initial,
				{ inputValue: 'Google+', count: 263, postInputTurn: 1 },
				{ inputValue: 'Google+', count: 263, postInputTurn: 2 },
			]),
		).toBe(263);
		expect(() =>
			settledKilledByGoogleSearchCount(mutation, [
				initial,
				{ inputValue: 'Google+', count: 1, postInputTurn: 1 },
				{ inputValue: 'Google+', count: 263, postInputTurn: 2 },
			]),
		).toThrow('forbidden settled filtered state');
		const parity = {
			...base,
			phase: 'migrated-parity' as const,
			expectedSearchRows: 1 as const,
		};
		expect(
			settledKilledByGoogleSearchCount(parity, [
				initial,
				{ inputValue: 'Google+', count: 1, postInputTurn: 1 },
				{ inputValue: 'Google+', count: 1, postInputTurn: 2 },
			]),
		).toBe(1);
	});

	test('attaches complete provenance and preserves exact structural mutation fields', () => {
		const descriptor = {
			phase: 'mutation-red' as const,
			lane: 'migrated' as const,
			pass: 1 as const,
			canonicalLaneRoot: '/lane',
			canonicalBuildRoot: '/lane/.next',
			expectedAppSha256: 'a'.repeat(64),
			expectedBuildSha256: 'b'.repeat(64),
			expectedSearchRows: 263 as const,
		};
		const failure = new KilledByGoogleJourneyPhaseFailure(
			descriptor,
			new KilledByGoogleJourneyOracleError(263),
		);
		expect(failure).toMatchObject({
			...descriptor,
			code: 'google-plus-product-count',
			expected: 1,
			actual: 263,
		});
		expect(failure.message).toContain('/lane/.next');
		expect(classifyKilledByGoogleMutationSignal(failure, descriptor)).toEqual({
			code: 'google-plus-product-count',
			expected: 1,
			actual: 263,
		});
	});

	test('escalates TERM to bounded KILL and rejects a surviving child', async () => {
		const makeChild = () => ({
			exitCode: null as number | null,
			signalCode: null as NodeJS.Signals | null,
			killCalls: [] as string[],
			kill(signal?: NodeJS.Signals | number) {
				this.killCalls.push(String(signal));
				return true;
			},
			once() {
				return this;
			},
		});
		const killed = makeChild();
		let waits = 0;
		await terminateKilledByGoogleServerChild(
			killed as unknown as Parameters<typeof terminateKilledByGoogleServerChild>[0],
			async () => {
				waits += 1;
				if (waits === 2) killed.signalCode = 'SIGKILL';
				return waits === 2;
			},
		);
		expect(killed.killCalls).toEqual(['SIGTERM', 'SIGKILL']);
		const surviving = makeChild();
		await expect(
			terminateKilledByGoogleServerChild(
				surviving as unknown as Parameters<typeof terminateKilledByGoogleServerChild>[0],
				async () => false,
			),
		).rejects.toThrow('survived bounded TERM and KILL');
		expect(surviving.killCalls).toEqual(['SIGTERM', 'SIGKILL']);
	});

	test('binds every journey call to descriptors, settled counts, finally cleanup, and confirmed exit', async () => {
		const source = await readFile(
			'packages/cli/src/fixture/next-killedbygoogle-run.ts',
			'utf8',
		);
		expect(source).not.toContain('waitForTimeout(250)');
		expect(source.split('await runJourneys(').length - 1).toBe(4);
		for (const descriptor of [
			'baselineDescriptors',
			'migratedDescriptors',
			'mutationDescriptors',
			'restorationDescriptors',
		]) {
			const declaration = source.indexOf(`const ${descriptor} = await`);
			expect(declaration).toBeGreaterThan(0);
			expect(source.indexOf(descriptor, declaration + descriptor.length)).toBeGreaterThan(
				declaration,
			);
		}
		expect(source.split('phaseState,').length - 1).toBe(4);
		expect(source.indexOf('const migratedDescriptors = await')).toBeLessThan(
			source.indexOf('browser = await chromium.launch'),
		);
		const journeyStart = source.indexOf('async function runJourneys(');
		const journeyEnd = source.indexOf('async function artifact(', journeyStart);
		const journeySource = source.slice(journeyStart, journeyEnd);
		expect(journeySource).toContain('} finally {');
		expect(journeySource).toContain('await context.close();');
		expect(journeySource).toContain('await stopProduction(server.child);');
		const start = source.slice(
			source.indexOf('async function startProduction('),
			source.indexOf('type StoppableChild'),
		);
		expect(
			start.indexOf('await revalidateKilledByGoogleJourneyLaunch(descriptors);'),
		).toBeLessThan(start.indexOf('const child = spawn('));
		const stopStart = source.indexOf(
			'export async function terminateKilledByGoogleServerChild(',
		);
		const stopSource = source.slice(
			stopStart,
			source.indexOf('async function settleKilledByGoogleSearch(', stopStart),
		);
		expect(stopSource).toContain('child.signalCode === null');
		expect(stopSource).toContain("child.kill('SIGTERM')");
		expect(stopSource).toContain("child.kill('SIGKILL')");
		expect(stopSource).toContain('survived bounded TERM and KILL');
		expect(journeySource).toContain('new KilledByGoogleJourneyPhaseFailure');
	});

	test('binds copied/live inventories and all five fixed NFT paths', async () => {
		const fixture = await syntheticProduction();
		try {
			const copied = path.join(fixture.directory, 'copied');
			await cp(fixture.build, copied, { recursive: true });
			const first = await bindProductionSnapshot(
				'baseline-first',
				fixture.captured,
				fixture.lane,
				copied,
			);
			const second = await bindProductionSnapshot(
				'baseline-first',
				fixture.captured,
				fixture.lane,
				fixture.build,
			);
			expect(() => assertProductionSnapshotFidelity(second, first)).not.toThrow();
			expect(productionNftPaths).toHaveLength(5);
			expect(new Set(productionNftPaths).size).toBe(5);
			for (const nftPath of productionNftPaths) {
				const copiedBinding = await productionNftBinding(first, nftPath);
				const liveBinding = await productionNftBinding(second, nftPath);
				expect(copiedBinding.bindings).toEqual(liveBinding.bindings);
			}
		} finally {
			await rm(fixture.directory, { recursive: true, force: true });
		}
	});

	test('rejects forged identity, copied-byte mismatch, and unsupported NFT path', async () => {
		const fixture = await syntheticProduction();
		try {
			await expect(
				bindProductionSnapshot(
					'forged' as ProductionSnapshotIdentity,
					fixture.captured,
					fixture.lane,
					fixture.build,
				),
			).rejects.toThrow('identity differs');
			const copied = path.join(fixture.directory, 'changed-copy');
			await cp(fixture.build, copied, { recursive: true });
			await writeFile(path.join(copied, 'BUILD_ID'), 'changed\n');
			await expect(
				bindProductionSnapshot('baseline-first', fixture.captured, fixture.lane, copied),
			).rejects.toThrow('inventory or BUILD_ID differs');
			const bound = await bindProductionSnapshot(
				'baseline-first',
				fixture.captured,
				fixture.lane,
				fixture.build,
			);
			expect(() =>
				productionNftBinding(bound, 'unknown.nft.json' as ProductionNftPath),
			).toThrow('NFT path differs');
		} finally {
			await rm(fixture.directory, { recursive: true, force: true });
		}
	});

	test('binds copied .next targets to copied bytes and rejects later live-byte mismatch', async () => {
		const fixture = await syntheticProduction();
		try {
			const target = path.join(fixture.build, 'snapshot-runtime.js');
			const manifest = path.join(fixture.build, 'next-server.js.nft.json');
			await writeFile(target, 'copied bytes');
			await writeFile(
				manifest,
				`${JSON.stringify({ cacheKey: 'fixed', files: ['./snapshot-runtime.js'], version: 1 })}\n`,
			);
			const firstRows = await snapshotRows(fixture.build);
			const firstCaptured = {
				...fixture.captured,
				rawDigest: sha256(canonicalize(firstRows)),
				rows: firstRows,
			};
			const copied = path.join(fixture.directory, 'copied-next');
			await cp(fixture.build, copied, { recursive: true });
			await writeFile(target, 'later live bytes');
			const secondRows = await snapshotRows(fixture.build);
			const secondCaptured = {
				...fixture.captured,
				rawDigest: sha256(canonicalize(secondRows)),
				rows: secondRows,
			};
			const first = await bindProductionSnapshot(
				'baseline-first',
				firstCaptured,
				fixture.lane,
				copied,
			);
			const second = await bindProductionSnapshot(
				'baseline-second',
				secondCaptured,
				fixture.lane,
				fixture.build,
			);
			const firstBinding = await productionNftBinding(first, 'next-server.js.nft.json');
			const secondBinding = await productionNftBinding(second, 'next-server.js.nft.json');
			expect(firstBinding.bindings[0]?.targetSha256).toBe(sha256('copied bytes'));
			expect(secondBinding.bindings[0]?.targetSha256).toBe(sha256('later live bytes'));
			await expect(compareProductionNfts(first, second)).rejects.toThrow(
				'target-byte mismatch',
			);
		} finally {
			await rm(fixture.directory, { recursive: true, force: true });
		}
	});

	test('removes the whole build root before production build acquisition', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-kbg-reset-'));
		const lane = path.join(directory, 'lane');
		await mkdir(path.join(lane, '.next', 'nested'), { recursive: true });
		await writeFile(path.join(lane, '.next', 'nested', 'stale'), 'stale');
		await resetProductionBuildRoot(lane);
		await expect(lstat(path.join(lane, '.next'))).rejects.toThrow();
		await rm(directory, { recursive: true, force: true });
	});

	test('freezes eager copied/live bindings across internal and external target mutation', async () => {
		const fixture = await syntheticProduction();
		try {
			const internal = path.join(fixture.build, 'snapshot-runtime.js');
			const external = path.join(fixture.lane, 'node_modules/pkg/runtime.js');
			await writeFile(internal, 'internal-first');
			await writeFile(
				path.join(fixture.build, 'next-server.js.nft.json'),
				`${JSON.stringify({
					cacheKey: 'fixed',
					files: ['./snapshot-runtime.js', '../node_modules/pkg/runtime.js'],
					version: 1,
				})}\n`,
			);
			const rows = await snapshotRows(fixture.build);
			const captured = {
				...fixture.captured,
				rawDigest: sha256(canonicalize(rows)),
				rows,
			};
			const live = await bindProductionSnapshot(
				'baseline-first',
				captured,
				fixture.lane,
				fixture.build,
			);
			const copiedRoot = path.join(fixture.directory, 'copied-first');
			await cp(fixture.build, copiedRoot, { recursive: true });
			const copied = await bindProductionSnapshot(
				'baseline-first',
				captured,
				fixture.lane,
				copiedRoot,
			);
			expect(() => assertProductionSnapshotFidelity(live, copied)).not.toThrow();
			const frozen = structuredClone(productionNftBinding(copied, 'next-server.js.nft.json'));

			await writeFile(external, 'external-later');
			await writeFile(internal, 'live-internal-later');
			await writeFile(path.join(copiedRoot, 'snapshot-runtime.js'), 'copied-internal-later');
			expect(productionNftBinding(copied, 'next-server.js.nft.json')).toEqual(frozen);
			expect(productionNftBinding(live, 'next-server.js.nft.json')).toEqual(frozen);

			const changedRows = await snapshotRows(copiedRoot);
			const changedCaptured = {
				...captured,
				rawDigest: sha256(canonicalize(changedRows)),
				rows: changedRows,
			};
			const rebound = await bindProductionSnapshot(
				'baseline-second',
				changedCaptured,
				fixture.lane,
				copiedRoot,
			);
			await expect(compareProductionNfts(copied, rebound)).rejects.toThrow(
				'target-byte mismatch',
			);
		} finally {
			await rm(fixture.directory, { recursive: true, force: true });
		}
	});

	test('rejects every frozen NFT binding and cacheKey projection difference', async () => {
		const fixture = await syntheticProduction();
		try {
			const snapshot = await bindProductionSnapshot(
				'baseline-first',
				fixture.captured,
				fixture.lane,
				fixture.build,
			);
			const mutations = [
				(binding: Record<string, unknown>) => {
					binding.cacheKeySha256 = 'b'.repeat(64);
				},
				(binding: Record<string, unknown>) => {
					(binding.bindings as unknown[]).length = 0;
				},
				(binding: Record<string, unknown>) => {
					(binding.bindings as Array<Record<string, unknown>>)[0]!.physicalRoot =
						'snapshot-storage';
				},
				(binding: Record<string, unknown>) => {
					(binding.bindings as Array<Record<string, unknown>>)[0]!.targetType =
						'symbolic-link';
				},
				(binding: Record<string, unknown>) => {
					(
						binding.bindings as Array<Record<string, unknown>>
					)[0]!.realLaneRelativeTarget = 'node_modules/pkg/other.js';
				},
				(binding: Record<string, unknown>) => {
					(binding.bindings as Array<Record<string, unknown>>)[0]!.targetSha256 =
						'b'.repeat(64);
				},
				(binding: Record<string, unknown>) => {
					(binding.bindings as Array<Record<string, unknown>>)[0]!.targetByteLength = 8;
				},
			];
			const expectedErrors = [
				'cacheKey mismatch',
				'binding-set mismatch',
				'member-field mismatch',
				'member-field mismatch',
				'member-field mismatch',
				'target-byte mismatch',
				'target-byte mismatch',
			];
			for (const [index, mutate] of mutations.entries()) {
				const changed = structuredClone(snapshot) as unknown as Record<string, unknown>;
				const binding = (changed.nftBindings as Array<Record<string, unknown>>).find(
					(candidate) => candidate.relativeManifest === 'next-server.js.nft.json',
				)!;
				mutate(binding);
				await expect(
					compareProductionNfts(snapshot, changed as unknown as ProductionSnapshot),
				).rejects.toThrow(expectedErrors[index]);
			}
		} finally {
			await rm(fixture.directory, { recursive: true, force: true });
		}
	});

	test('rejects lexical and realpath NFT target escapes', async () => {
		for (const escape of ['lexical', 'realpath'] as const) {
			const fixture = await syntheticProduction();
			try {
				const manifest = path.join(fixture.build, 'next-server.js.nft.json');
				if (escape === 'lexical')
					await writeFile(
						manifest,
						`${JSON.stringify({ cacheKey: 'fixed', files: ['../../outside'], version: 1 })}\n`,
					);
				else {
					const outside = path.join(fixture.directory, 'outside');
					await writeFile(outside, 'outside');
					const link = path.join(fixture.lane, 'escape-link');
					await symlink(await realpath(outside), link);
					await writeFile(
						manifest,
						`${JSON.stringify({ cacheKey: 'fixed', files: ['../escape-link'], version: 1 })}\n`,
					);
				}
				const rows = await snapshotRows(fixture.build);
				const rebound = {
					...fixture.captured,
					rawDigest: sha256(canonicalize(rows)),
					rows,
				};
				await expect(
					bindProductionSnapshot('baseline-first', rebound, fixture.lane, fixture.build),
				).rejects.toThrow(escape === 'lexical' ? 'lexical escape' : 'realpath escape');
			} finally {
				await rm(fixture.directory, { recursive: true, force: true });
			}
		}
	});

	test('projects equivalent production and diagnostic bindings canonically', () => {
		const binding = canonicalProductionBinding();
		const production = productionBindingToCanonicalNftProjection(binding);
		const diagnostic = diagnosticRunToCanonicalNftProjection(equivalentDiagnosticRun(binding));
		const comparison = compareCanonicalNftProjections(production, diagnostic);
		expect(production.semantic).toEqual(diagnostic.semantic);
		expect(comparison.predicates).toEqual({
			bindingSetMismatch: { value: false, added: [], removed: [] },
			memberFieldMismatch: { value: false, members: [] },
			targetByteMismatch: { value: false, members: [] },
			cacheKeyMismatch: { value: false },
		});
		expect(comparison).toMatchObject({
			rawEqual: true,
			pathResolutionSemanticsEqual: false,
		});
		expect(production.semantic.members).toMatchObject([
			{ selectedStorageRegion: 'bound-lane', targetType: 'symlink' },
			{ selectedStorageRegion: 'bound-lane', targetType: 'file' },
			{ selectedStorageRegion: 'bound-build-output', targetType: 'file' },
		]);
		expect(next12NftConsumerAssertions).toEqual({
			nextStartReadsManifest: false,
			nextServerReadsManifest: false,
			requiredServerGenerationReadsManifest: false,
			standaloneCopyReadsFilesOnly: true,
			standaloneCopyJoinsMembersRelativeToManifest: true,
			standaloneCopyPreservesSymlinksOrCopiesBytes: true,
			standaloneCopyIgnoresRawManifestIdentityVersionAndCacheKey: true,
			pathResolutionParity:
				'unresolved-production-native-realpath-versus-diagnostic-manual-leaf-traversal',
		});
	});

	test('keeps raw manifest and member ordering outside semantic mismatch classes', () => {
		const first = productionBindingToCanonicalNftProjection(canonicalProductionBinding());
		const changedBinding = structuredClone(canonicalProductionBinding()) as unknown as {
			rawSha256: string;
			rawByteLength: number;
			bindings: ProductionNftBinding['bindings'][number][];
		};
		changedBinding.rawSha256 = 'e'.repeat(64);
		changedBinding.rawByteLength += 1;
		changedBinding.bindings.reverse();
		const second = productionBindingToCanonicalNftProjection(
			changedBinding as unknown as ProductionNftBinding,
		);
		const comparison = compareCanonicalNftProjections(first, second);
		expect(comparison.rawEqual).toBe(false);
		expect(Object.values(comparison.predicates).every((row) => !row.value)).toBe(true);
	});

	test('maps every semantic production field to exactly one shared mismatch class', () => {
		const base = productionBindingToCanonicalNftProjection(canonicalProductionBinding());
		const cases: Array<{
			expected: (typeof mismatchNames)[number];
			mutate: (projection: CanonicalNftProjection) => void;
		}> = [
			{
				expected: 'bindingSetMismatch',
				mutate: (projection) => {
					(
						projection.semantic
							.members as NftMismatchRun['members'] as MutableNftMismatchBinding[]
					).pop();
				},
			},
			{
				expected: 'memberFieldMismatch',
				mutate: (projection) => {
					(
						projection.semantic
							.members as NftMismatchRun['members'] as MutableNftMismatchBinding[]
					)[0]!.selectedStorageRegion = 'bound-build-output';
				},
			},
			{
				expected: 'memberFieldMismatch',
				mutate: (projection) => {
					(
						projection.semantic
							.members as NftMismatchRun['members'] as MutableNftMismatchBinding[]
					)[1]!.targetType = 'symlink';
				},
			},
			{
				expected: 'memberFieldMismatch',
				mutate: (projection) => {
					(
						projection.semantic
							.members as NftMismatchRun['members'] as MutableNftMismatchBinding[]
					)[1]!.portableRealTargetIdentity = 'node_modules/pkg/other.js';
				},
			},
			{
				expected: 'targetByteMismatch',
				mutate: (projection) => {
					(
						projection.semantic
							.members as NftMismatchRun['members'] as MutableNftMismatchBinding[]
					)[1]!.targetSha256 = 'e'.repeat(64);
				},
			},
			{
				expected: 'targetByteMismatch',
				mutate: (projection) => {
					(
						projection.semantic
							.members as NftMismatchRun['members'] as MutableNftMismatchBinding[]
					)[1]!.byteLength += 1;
				},
			},
			{
				expected: 'cacheKeyMismatch',
				mutate: (projection) => {
					(projection.semantic.cacheKey as Record<string, unknown>).valueSha256 =
						'e'.repeat(64);
				},
			},
			{
				expected: 'cacheKeyMismatch',
				mutate: (projection) => {
					(projection.semantic.cacheKey as Record<string, unknown>).byteLength = 13;
				},
			},
			{
				expected: 'cacheKeyMismatch',
				mutate: (projection) => {
					Object.assign(projection.semantic.cacheKey, {
						present: false,
						type: 'absent',
						valueSha256: null,
						byteLength: null,
					});
				},
			},
		];
		for (const { expected, mutate } of cases) {
			const changed = structuredClone(base);
			mutate(changed);
			const predicates = canonicalNftMismatchPredicates(base, changed);
			expect(mismatchNames.filter((name) => predicates[name].value)).toEqual([expected]);
		}
	});

	test('rejects lexical inconsistency and malformed or lossy production projections', () => {
		const cases: Array<{
			expected: string;
			mutate: (binding: Record<string, unknown>) => void;
		}> = [
			{
				expected: 'laneRelativeTarget lexical invariant differs',
				mutate: (binding) => {
					(binding.bindings as Array<Record<string, unknown>>)[0]!.laneRelativeTarget =
						'node_modules/pkg/other.js';
				},
			},
			{
				expected: 'production NFT binding enum differs',
				mutate: (binding) => {
					(binding.bindings as Array<Record<string, unknown>>)[0]!.physicalRoot =
						'unknown';
				},
			},
			{
				expected: 'production NFT binding enum differs',
				mutate: (binding) => {
					(binding.bindings as Array<Record<string, unknown>>)[0]!.targetType =
						'directory';
				},
			},
			{
				expected: 'canonical target digest',
				mutate: (binding) => {
					(binding.bindings as Array<Record<string, unknown>>)[0]!.targetSha256 =
						'INVALID';
				},
			},
			{
				expected: 'duplicate or unsorted',
				mutate: (binding) => {
					(binding.bindings as unknown[]).push(
						structuredClone((binding.bindings as unknown[])[0]),
					);
				},
			},
			{
				expected: 'production NFT binding schema differs',
				mutate: (binding) => {
					binding.version = 2;
				},
			},
		];
		for (const { expected, mutate } of cases) {
			const changed = structuredClone(canonicalProductionBinding()) as unknown as Record<
				string,
				unknown
			>;
			mutate(changed);
			expect(() =>
				productionBindingToCanonicalNftProjection(
					changed as unknown as ProductionNftBinding,
				),
			).toThrow(expected);
		}
	});

	test('recomputes trace occurrence count and rejects canonical identity/version mismatch', () => {
		const binding = structuredClone(canonicalProductionBinding()) as unknown as {
			bindings: ProductionNftBinding['bindings'][number][];
			traceMembershipOccurrences: number;
		};
		binding.bindings.push({
			member: './trace',
			laneRelativeTarget: '.next/trace',
			realLaneRelativeTarget: '.next/trace',
			physicalRoot: 'snapshot-storage',
			targetType: 'file',
			targetSha256: 'e'.repeat(64),
			targetByteLength: 1,
		});
		binding.traceMembershipOccurrences = 99;
		const first = productionBindingToCanonicalNftProjection(
			binding as unknown as ProductionNftBinding,
		);
		expect(first.traceMembershipOccurrences).toBe(1);
		const second = structuredClone(first) as unknown as Record<string, unknown>;
		second.relativeManifest = 'server/pages/index.js.nft.json';
		second.traceMembershipOccurrences = 0;
		expect(() =>
			canonicalNftMismatchPredicates(first, second as unknown as CanonicalNftProjection),
		).toThrow('identity or version differs');
	});

	test('validates exact production-comparison artifacts for every shared mismatch class', () => {
		const cases: Array<{
			expected: (typeof mismatchNames)[number];
			mutate: (projection: CanonicalNftProjection) => void;
		}> = [
			{
				expected: 'bindingSetMismatch',
				mutate: (projection) => {
					(projection.semantic.members as MutableNftMismatchBinding[]).pop();
				},
			},
			{
				expected: 'memberFieldMismatch',
				mutate: (projection) => {
					(projection.semantic.members as MutableNftMismatchBinding[])[0]!.targetType =
						'file';
				},
			},
			{
				expected: 'targetByteMismatch',
				mutate: (projection) => {
					(projection.semantic.members as MutableNftMismatchBinding[])[1]!.byteLength +=
						1;
				},
			},
			{
				expected: 'cacheKeyMismatch',
				mutate: (projection) => {
					(projection.semantic.cacheKey as Record<string, unknown>).valueSha256 =
						'e'.repeat(64);
				},
			},
		];
		for (const { expected, mutate } of cases) {
			const first = productionBindingToCanonicalNftProjection(canonicalProductionBinding());
			const second = structuredClone(first);
			mutate(second);
			const artifact = createNextServerNftProductionComparisonArtifact(first, second);
			expect(validateNextServerNftProductionComparisonArtifact(artifact)).toMatchObject({
				mismatchClasses: [expected],
			});
		}
	});

	test('rejects zero-class, raw-only, stale, malformed, and privacy-weakened artifacts', () => {
		const projection = productionBindingToCanonicalNftProjection(canonicalProductionBinding());
		const zero = createNextServerNftProductionComparisonArtifact(projection, projection);
		expect(() => validateNextServerNftProductionComparisonArtifact(zero)).toThrow(
			'no production NFT mismatch reproduced',
		);

		const rawOnlySecond = structuredClone(projection) as unknown as Record<string, unknown>;
		(rawOnlySecond.rawObservation as Record<string, unknown>).sha256 = 'e'.repeat(64);
		const rawOnly = createNextServerNftProductionComparisonArtifact(
			projection,
			rawOnlySecond as unknown as CanonicalNftProjection,
		);
		expect((rawOnly.rawObservation as Record<string, unknown>).manifestEqual).toBe(false);
		expect(() => validateNextServerNftProductionComparisonArtifact(rawOnly)).toThrow(
			'no production NFT mismatch reproduced',
		);

		const stale = productionComparisonArtifact();
		(stale.comparison as Record<string, unknown>).mismatchClasses = [];
		expect(() =>
			validateNextServerNftProductionComparisonArtifact(resealProductionComparison(stale)),
		).toThrow('classes differ from predicates');

		const malformed = productionComparisonArtifact();
		const malformedRuns = malformed.runs as Array<Record<string, unknown>>;
		const malformedProjection = malformedRuns[0]!.projection as Record<string, unknown>;
		(malformedProjection.rawObservation as Record<string, unknown>).sha256 = 'INVALID';
		expect(() =>
			validateNextServerNftProductionComparisonArtifact(
				resealProductionComparison(malformed),
			),
		).toThrow('raw manifest digest');

		const weakened = productionComparisonArtifact();
		(weakened.privacy as Record<string, unknown>).traceContentAccessed = true;
		expect(() =>
			validateNextServerNftProductionComparisonArtifact(resealProductionComparison(weakened)),
		).toThrow('privacy differs');
	});

	test('sequences one production lane through two reset/build/cache-remove/capture cycles', async () => {
		const calls: string[] = [];
		const lane = '/synthetic/production-comparison-lane';
		const first = productionBindingToCanonicalNftProjection(canonicalProductionBinding());
		const second = structuredClone(first);
		(second.semantic.members as MutableNftMismatchBinding[])[1]!.targetSha256 = 'e'.repeat(64);
		let capture = 0;
		const acquired = await acquireNextServerNftProductionComparison({
			extract: async () => {
				calls.push('extract');
				return lane;
			},
			install: async (received) => {
				calls.push(`install:${received}`);
			},
			resetBuildRoot: async (received) => {
				calls.push(`reset:${received}`);
			},
			build: async (received) => {
				calls.push(`build:${received}`);
			},
			removeBuildCache: async (received) => {
				calls.push(`remove-cache:${received}`);
			},
			capture: async (received) => {
				calls.push(`capture:${received}`);
				capture += 1;
				return capture === 1 ? first : second;
			},
			assertImmutable: async (received) => {
				calls.push(`immutable:${received}`);
			},
		});
		expect(acquired).toMatchObject({ lane });
		expect(calls).toEqual([
			'extract',
			`install:${lane}`,
			`immutable:${lane}`,
			`reset:${lane}`,
			`build:${lane}`,
			`remove-cache:${lane}`,
			`capture:${lane}`,
			`immutable:${lane}`,
			`reset:${lane}`,
			`build:${lane}`,
			`remove-cache:${lane}`,
			`capture:${lane}`,
			`immutable:${lane}`,
		]);
	});

	test('rejects production trace membership before target filesystem access', async () => {
		const directory = await mkdtemp(
			path.join(os.tmpdir(), 'versionless-kbg-production-trace-'),
		);
		const lane = path.join(directory, 'lane');
		await mkdir(path.join(lane, '.next'), { recursive: true });
		await writeFile(
			path.join(lane, '.next', 'next-server.js.nft.json'),
			JSON.stringify({ cacheKey: 'synthetic', files: ['./trace'], version: 1 }),
		);
		await expect(captureProductionComparisonProjection(lane)).rejects.toThrow(
			'forbidden build trace',
		);
		await rm(directory, { recursive: true, force: true });
	});

	test('models the exact T283 baseline interval with scoped immutable ledger entries', async () => {
		const result = await syntheticBaselineLedger();
		expect(result).toMatchObject({
			classification: 'expected',
			reason: 'disjoint-destination-only-copy-and-stable-projections',
		});
		expect(result.ledger.map((row) => row.operation)).toEqual([
			'first-cache-removal',
			'first-live-projection',
			'copy-first-build-output',
			'copied-bind-inventory-hash-realpath',
			'copy-fidelity-assertion',
			'source-install-external-rehash',
			'second-build-boundary',
			'second-cache-removal',
			'second-live-projection',
			'compare-frozen-projections',
			'baseline-conformance-complete',
			'browser-start',
			'server-start',
		]);
		expect(
			result.ledger.findIndex((row) => row.operation === 'first-cache-removal'),
		).toBeLessThan(result.ledger.findIndex((row) => row.operation === 'first-live-projection'));
		expect(
			result.ledger.findIndex((row) => row.operation === 'second-cache-removal'),
		).toBeLessThan(
			result.ledger.findIndex((row) => row.operation === 'second-live-projection'),
		);
		expect(
			result.ledger.findIndex((row) => row.operation === 'baseline-conformance-complete'),
		).toBeLessThan(result.ledger.findIndex((row) => row.operation === 'browser-start'));
		expect(result.ledger.findIndex((row) => row.operation === 'browser-start')).toBeLessThan(
			result.ledger.findIndex((row) => row.operation === 'server-start'),
		);
		expect(Object.isFrozen(result)).toBe(true);
		expect(Object.isFrozen(result.ledger)).toBe(true);
		expect(result.ledger.every((row) => Object.isFrozen(row))).toBe(true);
	});

	test('rejects nested and realpath-aliased copy destinations', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-kbg-disjoint-'));
		try {
			const lane = path.join(directory, 'lane');
			const sibling = path.join(directory, 'snapshots', 'baseline-first');
			await mkdir(lane, { recursive: true });
			await symlink(lane, path.join(directory, 'lane-alias'));
			expect(await productionCopyPathsAreDisjoint(lane, sibling)).toBe(true);
			expect(await productionCopyPathsAreDisjoint(lane, path.join(lane, 'copy'))).toBe(false);
			expect(await productionCopyPathsAreDisjoint(path.join(lane, 'copy'), lane)).toBe(false);
			expect(
				await productionCopyPathsAreDisjoint(
					lane,
					path.join(directory, 'lane-alias', 'uncreated-copy'),
				),
			).toBe(false);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	test('proves copy-only writes and read-only binding, hashing, realpath, fidelity, and rehash scopes', async () => {
		const { ledger } = await syntheticBaselineLedger();
		const copy = ledger.find((row) => row.operation === 'copy-first-build-output')!;
		expect(copy).toMatchObject({
			reads: ['canonical-build-output'],
			writes: ['copy-destination'],
		});
		for (const operation of [
			'first-live-projection',
			'copied-bind-inventory-hash-realpath',
			'copy-fidelity-assertion',
			'source-install-external-rehash',
			'second-live-projection',
			'compare-frozen-projections',
		] as const)
			expect(ledger.find((row) => row.operation === operation)?.writes).toEqual([]);
	});

	test('classifies overlap, input changes, and fidelity changes as harness defects', async () => {
		const overlap = await syntheticBaselineLedger({
			copyDestination: '/synthetic/canonical-lane/copied',
		});
		expect(overlap).toMatchObject({
			classification: 'harness-defect',
			reason: 'copy-destination-overlaps-or-aliases-canonical-lane',
		});

		const scopeForgery = await syntheticBaselineLedger({
			mutate: (operation, observation) => {
				if (operation === 'copy-first-build-output')
					(observation as unknown as Record<string, unknown>).writes = [
						'canonical-build-output',
					];
			},
		});
		expect(scopeForgery).toMatchObject({
			classification: 'expected',
			reason: 'disjoint-destination-only-copy-and-stable-projections',
		});
		expect(
			scopeForgery.ledger.find((row) => row.operation === 'copy-first-build-output'),
		).toMatchObject({ writes: ['copy-destination'] });

		for (const field of ['source', 'install', 'externalTargets'] as const) {
			const changed = await syntheticBaselineLedger({
				mutate: (operation, observation) => {
					if (operation === 'source-install-external-rehash')
						observation.after = {
							...observation.after,
							[field]: '3'.repeat(64),
						};
				},
			});
			expect(changed.classification).toBe('harness-defect');
			expect(changed.reason).toContain(field);
		}

		const fidelity = await syntheticBaselineLedger({
			mutate: (operation, observation) => {
				if (operation === 'copied-bind-inventory-hash-realpath')
					observation.after = {
						...observation.after,
						copiedProjection: '4'.repeat(64),
					};
			},
		});
		expect(fidelity).toMatchObject({
			classification: 'harness-defect',
			reason: 'copied-live-fidelity-differs',
		});
	});

	test('classifies unchanged-input projection variance as unsupported nondeterminism', async () => {
		const result = await syntheticBaselineLedger({ secondProjection: '5'.repeat(64) });
		expect(result).toMatchObject({
			classification: 'unsupported-nondeterminism',
			reason: 'unchanged-input-production-projection-variance',
		});
	});

	test('validates ordered hash-only operation artifacts and all three classifications', async () => {
		const equal = await operationBisectArtifact();
		expect(validateNextServerNftOperationBisectArtifact(equal)).toMatchObject({
			classification: { result: 'expected' },
			mismatchClasses: [],
		});
		const variant = await operationBisectArtifact({ variant: true });
		expect(validateNextServerNftOperationBisectArtifact(variant)).toMatchObject({
			classification: { result: 'unsupported-nondeterminism' },
			mismatchClasses: ['targetByteMismatch'],
		});
		const fidelity = await operationBisectArtifact({ fidelity: false });
		expect(validateNextServerNftOperationBisectArtifact(fidelity)).toMatchObject({
			classification: { result: 'harness-defect' },
		});
	});

	test('rejects forged operation order, scopes, continuity, projection bindings, privacy, and integrity', async () => {
		const mutations: Array<(artifact: Record<string, unknown>) => void> = [
			(artifact) => {
				const ledger = artifact.ledger as Array<Record<string, unknown>>;
				[ledger[0], ledger[1]] = [ledger[1]!, ledger[0]!];
			},
			(artifact) => {
				const ledger = artifact.ledger as Array<Record<string, unknown>>;
				ledger[2]!.writes = ['canonical-build-output'];
			},
			(artifact) => {
				const ledger = artifact.ledger as Array<Record<string, unknown>>;
				(ledger[3]!.before as Record<string, unknown>).source = '7'.repeat(64);
			},
			(artifact) => {
				const ledger = artifact.ledger as Array<Record<string, unknown>>;
				(ledger[9]!.after as Record<string, unknown>).secondLiveProjection = '7'.repeat(64);
			},
			(artifact) => {
				(artifact.privacy as Record<string, unknown>).traceContentAccessed = true;
			},
		];
		for (const mutate of mutations) {
			const artifact = structuredClone(await operationBisectArtifact()) as unknown as Record<
				string,
				unknown
			>;
			mutate(artifact);
			resealOperationBisect(artifact);
			expect(() => validateNextServerNftOperationBisectArtifact(artifact)).toThrow();
		}
		const integrity = structuredClone(await operationBisectArtifact()) as unknown as Record<
			string,
			unknown
		>;
		(integrity.integrity as Record<string, unknown>).canonicalDigest = '0'.repeat(64);
		expect(() => validateNextServerNftOperationBisectArtifact(integrity)).toThrow(
			'artifact integrity differs',
		);
	});

	test('keeps the operation bisect capture below conformance, browser, server, workflow, and publication boundaries', async () => {
		const source = await readFile(
			'packages/cli/src/fixture/next-killedbygoogle-run.ts',
			'utf8',
		);
		const start = source.indexOf('async function extractOperationBisectLane');
		const end = source.indexOf('export async function main', start);
		const capture = source.slice(start, end);
		expect(capture).not.toContain('productionOutputConformance(');
		expect(capture).not.toContain('chromium');
		expect(capture).not.toContain('runJourney(');
		expect(capture).not.toContain('startServer(');
		expect(capture).not.toContain('runNextKilledByGoogle(');
		expect(capture).not.toContain('aggregate');
		expect(capture).not.toContain('receipt.json');
		expect(capture).toContain('append(9);');
	});

	test('keeps production comparison acquisition free of forbidden workflow paths', async () => {
		const source = await readFile(
			'packages/cli/src/fixture/next-killedbygoogle-run.ts',
			'utf8',
		);
		const start = source.indexOf('export type ProductionComparisonAcquisitionOperations');
		const end = source.indexOf('export async function diagnoseNextServerNftMismatch', start);
		const acquisition = source.slice(start, end);
		expect(acquisition).not.toContain('buildSnapshot(');
		expect(acquisition).not.toContain('productionStorageInventory(');
		expect(acquisition).not.toContain('cp(');
		expect(acquisition).not.toContain('chromium');
		expect(acquisition).not.toContain('diagnoseNextServerNftMismatch(');
		expect(acquisition).not.toContain('secondLane');
		expect(acquisition).toContain("rm(path.join(lane, '.next'), {");
		expect(acquisition).toContain("rm(path.join(lane, '.next', 'cache'), {");
	});

	test('binds the exact production, browser, mutation, and receipt gates', async () => {
		const source = await readFile(
			'packages/cli/src/fixture/next-killedbygoogle-run.ts',
			'utf8',
		);
		for (const required of [
			"'build'",
			"'start'",
			"'16.20.2'",
			"'12.0.10'",
			"'Google+'",
			'apps: 50',
			'initialRows !== killedByGoogleBrowserOracle.total',
			'assertKilledByGoogleSettledSearchCount(descriptor, searchRows)',
			'appRows !== killedByGoogleBrowserOracle.apps',
			'successfulNonLoopback: 0',
			'supports.length !== 13',
			'versionless.receipt.v1',
		])
			expect(source).toContain(required);
		expect(source).not.toContain("node_modules/next/dist/bin/next'), 'preview'");
		expect(source).not.toContain("'export'");
		expect(source).not.toContain("'npx'");
		expect(source).not.toContain("'vite'");
		expect(source).not.toContain('async function typeCheck');
		expect(source).not.toContain("typescriptNoEmit: 'pass'");
		expect(source).toContain("standaloneTypeScriptCheck: 'not-run'");
	});

	test('preserves exact nonclaims and blocks all classified assets', async () => {
		const source = await readFile(
			'packages/cli/src/fixture/next-killedbygoogle-run.ts',
			'utf8',
		);
		for (const required of [
			'excludedAssets.length !== 22',
			'no generic React or Next.js support',
			'No Vite replacement, compliance, certification, authenticity, signer identity, SLSA level, or OS-wide isolation claim.',
		])
			expect(source).toContain(required);
	});

	test('binds the diagnostic-only two-build variance package', async () => {
		const source = await readFile(
			'packages/cli/src/fixture/next-killedbygoogle-run.ts',
			'utf8',
		);
		for (const required of [
			'--diagnose-build-variance',
			'versionless.next-killedbygoogle-build-variance-diagnostic.v11',
			"result: 'diagnostic-only'",
			'payloadsRetained: false',
			'no-normalization-or-support-decision',
			'expectedInstallTree',
			'expectedVariance',
			"'previewModeId'",
			'semanticProjectionEqual: true',
			'bindingsEqual: true',
			"classification: 'build-local-app-dir'",
			'containsGeneratedBuildId: false',
			'containsRelativeAppDir: false',
			'next12EscapeStringRegexp',
			'generatedBuildIdsRetained: false',
			'containsBuildIdOutsideDerivedFields: false',
			"const targetPath = 'dataRoutes[0].dataRouteRegex'",
			'path: "routes[\'/\'].dataRoute"',
			'safeMismatchPersistence: true',
			"classificationStatus: 'mismatch'",
			'normalizationEligible: false',
			'publishBuildVarianceDiagnostic',
			'await rename(output, previous)',
			'rawDifferingPaths',
			'semanticDifferingPaths',
			'classifiedPaths',
			"classification: 'raw-byte-equal'",
			"classification: 'source-backed-semantic-equal'",
			'explicit-next12-semantic-reproducibility-diagnostic-only',
			'requiredServerFilesFieldDiagnostic',
			"classificationStatus: 'field-diagnostic-complete'",
			"classification: 'required-server-field-diagnostic-only'",
			"appDirProjection: '<LANE>'",
			'semanticDecision: null',
			'aggregateTraceDiagnostic',
			'traceIdentityCount',
			'logicalSpanCount',
			'duplicateIdentityGroupCount',
			'duplicateOccurrenceCount',
			'duplicateGroups',
			'unresolvedParentCount: 0',
			"name: 'check-static-error-page'",
			"parentName: 'static-check'",
			'occurrences: 2',
			'semanticsEqual: true',
			"classificationStatus: 'lane-projection-category-diagnostic-complete'",
			"classification: 'next12-lane-trace-projection-category-diagnostic-only'",
			'valuesRetained: false',
			'valueHashesRetained: false',
			'laneProjectionDiagnostic',
			'querystringEscape',
			'expectedTraceValueDimensions',
			'exactDimensionCount',
			'eligibleDimensionCount',
			'nonProjectableDimensionCount',
			'allEligibleProjectedEqual',
			'allDifferencesLaneDerived: false',
			"sourceCategory: 'webpack-compilation-asset-name'",
			'diagnosticAttemptCount: 1',
			'tokenlessMultisetEqual',
			'laneBearingProjectedMultisetEqual',
			'fullProjectedMultisetEqual',
			'failureCategories',
		])
			expect(source).toContain(required);
	});

	test('categorizes mixed exact tokens without changing tokenless or rejected candidates', () => {
		const lane = '/synthetic/lane-a';
		const encodedLane = '%2Fsynthetic%2Flane-a';
		const categorized = categorizeLaneValues(
			[
				'stable-module',
				`${lane}/src/a.ts`,
				`loader!${lane}/src/b.ts?absolute=${encodedLane}%2Fsrc%2Fb.ts`,
				`${lane}/src/c.ts!${lane}/src/d.ts`,
				`prefix${lane}suffix`,
			],
			lane,
		);

		expect(categorized).toMatchObject({
			literalCandidateCount: 5,
			acceptedLiteralOccurrenceCount: 4,
			rejectedLiteralOccurrenceCount: 1,
			encodedCandidateCount: 1,
			acceptedEncodedOccurrenceCount: 1,
			rejectedEncodedOccurrenceCount: 0,
			literalOnlyValueCount: 2,
			encodedOnlyValueCount: 0,
			bothTokenFormsValueCount: 1,
			tokenlessOccurrenceCount: 2,
			tokenlessDistinctCount: 2,
		});
		expect(categorized.tokenlessValues).toEqual([`prefix${lane}suffix`, 'stable-module']);
		expect(categorized.projectedValues).toContain(`prefix${lane}suffix`);
		expect(categorized.projectedValues).toContain(
			'loader!<LANE>/src/b.ts?absolute=<LANE>%2Fsrc%2Fb.ts',
		);
	});

	test('compares tokenless, lane-bearing, and full projected multisets independently', () => {
		const firstLane = '/synthetic/lane-a';
		const secondLane = '/synthetic/lane-b';
		const equal = compareLaneValueCategories(
			[
				'stable-module',
				`${firstLane}/src/a.ts`,
				`loader?path=%2Fsynthetic%2Flane-a%2Fsrc%2Fb.ts!${firstLane}/src/b.ts`,
			],
			[
				`loader?path=%2Fsynthetic%2Flane-b%2Fsrc%2Fb.ts!${secondLane}/src/b.ts`,
				`${secondLane}/src/a.ts`,
				'stable-module',
			],
			firstLane,
			secondLane,
		);
		expect(equal).toMatchObject({
			tokenlessMultisetEqual: true,
			laneBearingProjectedMultisetEqual: true,
			fullProjectedMultisetEqual: true,
			failureCategories: [],
		});

		const unequal = compareLaneValueCategories(
			['stable-a', `${firstLane}/src/a.ts`],
			['stable-b', `${secondLane}/src/b.ts`],
			firstLane,
			secondLane,
		);
		expect(unequal.tokenlessMultisetEqual).toBe(false);
		expect(unequal.laneBearingProjectedMultisetEqual).toBe(false);
		expect(unequal.fullProjectedMultisetEqual).toBe(false);
		expect(unequal.failureCategories).toEqual([
			'complete-projected-multiset-mismatch',
			'lane-bearing-projected-multiset-mismatch',
			'tokenless-multiset-mismatch',
		]);
	});

	test('retains all sixteen dimension contracts and leaves minify as the sole residual', () => {
		expect(expectedTraceValueDimensions).toHaveLength(16);
		expect(
			expectedTraceValueDimensions.filter((dimension) => dimension.projectionEligible),
		).toHaveLength(15);
		expect(
			expectedTraceValueDimensions.filter((dimension) => !dimension.projectionEligible),
		).toEqual([
			{
				name: 'minify-js',
				parentName: 'terser-webpack-plugin-optimize',
				tagKey: 'name',
				occurrenceCount: 12,
				distinctCount: 12,
				sourceCategory: 'webpack-compilation-asset-name',
				projectionEligible: false,
			},
		]);
	});

	test('validates the exact portable hash-only mismatch schema fail closed', () => {
		expect(validateNextServerNftMismatchArtifact(mismatchArtifact()).digest).toHaveLength(64);
		for (const mutate of [
			(artifact: Record<string, unknown>) => Object.assign(artifact, { extra: true }),
			(artifact: Record<string, unknown>) => {
				mutableRuns(artifact)[0]!.manifest.sha256 = testDigest.toUpperCase();
				return artifact;
			},
			(artifact: Record<string, unknown>) => {
				mutableRuns(artifact)[0]!.manifest.byteLength = 0;
				return artifact;
			},
			(artifact: Record<string, unknown>) => {
				mutableRuns(artifact)[0]!.members[0]!.portableRealTargetIdentity = '../escape';
				return artifact;
			},
			(artifact: Record<string, unknown>) => {
				mutableRuns(artifact)[0]!.cacheKey.valueRetained = true;
				return artifact;
			},
			(artifact: Record<string, unknown>) => {
				mutableConsumerSources(artifact)[0]!.identity = '/host/source.js';
				return artifact;
			},
		]) {
			const changed = mutate(structuredClone(mismatchArtifact()));
			expect(() => validateNextServerNftMismatchArtifact(reseal(changed))).toThrow();
		}
		const stale = mismatchArtifact();
		(stale.privacy as Record<string, unknown>).rawPayloadRetained = true;
		expect(() => validateNextServerNftMismatchArtifact(stale)).toThrow();
	});

	test('derives independent and combined mismatch predicates with exact sorted classes', () => {
		const runsFor = () => {
			const [first, second] = mutableRuns(mismatchArtifact());
			if (!first || !second) throw new Error('synthetic mismatch runs are absent');
			second.cacheKey = structuredClone(first.cacheKey);
			second.members = structuredClone(first.members);
			return { first, second };
		};
		let { first, second } = runsFor();
		second.members.push({ ...second.members[0]!, member: 'zz-added.js' });
		let predicates = nextServerNftMismatchPredicates(
			first as NftMismatchRun,
			second as NftMismatchRun,
		);
		expect(mismatchNames.filter((name) => predicates[name].value)).toEqual([
			'bindingSetMismatch',
		]);

		({ first, second } = runsFor());
		second.members[0]!.selectedStorageRegion = 'bound-build-output';
		predicates = nextServerNftMismatchPredicates(
			first as NftMismatchRun,
			second as NftMismatchRun,
		);
		expect(mismatchNames.filter((name) => predicates[name].value)).toEqual([
			'memberFieldMismatch',
		]);

		({ first, second } = runsFor());
		second.members[0]!.targetSha256 = 'b'.repeat(64);
		predicates = nextServerNftMismatchPredicates(
			first as NftMismatchRun,
			second as NftMismatchRun,
		);
		expect(mismatchNames.filter((name) => predicates[name].value)).toEqual([
			'targetByteMismatch',
		]);

		({ first, second } = runsFor());
		second.cacheKey.valueSha256 = 'b'.repeat(64);
		predicates = nextServerNftMismatchPredicates(
			first as NftMismatchRun,
			second as NftMismatchRun,
		);
		expect(mismatchNames.filter((name) => predicates[name].value)).toEqual([
			'cacheKeyMismatch',
		]);

		const combined = mismatchArtifact();
		[first, second] = mutableRuns(combined);
		if (!first || !second) throw new Error('synthetic mismatch runs are absent');
		first.members.push({ ...first.members[0]!, member: 'shared-target.js' });
		second.members = structuredClone(first.members);
		second.members[0]!.selectedStorageRegion = 'bound-build-output';
		second.members[1]!.targetSha256 = 'c'.repeat(64);
		second.members.push({ ...second.members[1]!, member: 'zz-added.js' });
		synchronizeMismatchComparison(combined);
		expect((combined.comparison as Record<string, unknown>).mismatchClasses).toEqual([
			'bindingSetMismatch',
			'cacheKeyMismatch',
			'memberFieldMismatch',
			'targetByteMismatch',
		]);
		expect(() => validateNextServerNftMismatchArtifact(combined)).not.toThrow();
	});

	test('rejects stale predicate details, stale classes, and zero-class captures distinctly', () => {
		const stalePredicates = mismatchArtifact();
		(
			(stalePredicates.comparison as Record<string, unknown>).cacheKeyMismatch as Record<
				string,
				unknown
			>
		).value = false;
		expect(() => validateNextServerNftMismatchArtifact(reseal(stalePredicates))).toThrow(
			'T281 serialized mismatch predicates differ from runs',
		);

		const staleClasses = mismatchArtifact();
		(staleClasses.comparison as Record<string, unknown>).mismatchClasses = [];
		expect(() => validateNextServerNftMismatchArtifact(reseal(staleClasses))).toThrow(
			'T281 mismatch classes differ from true predicates',
		);

		const zeroClass = mismatchArtifact();
		const [first, second] = mutableRuns(zeroClass);
		if (!first || !second) throw new Error('synthetic mismatch runs are absent');
		second.manifest = structuredClone(first.manifest);
		second.cacheKey = structuredClone(first.cacheKey);
		second.members = structuredClone(first.members);
		synchronizeMismatchComparison(zeroClass);
		expect(
			mismatchNames.map(
				(name) =>
					((zeroClass.comparison as Record<string, unknown>)[name] as { value: boolean })
						.value,
			),
		).toEqual([false, false, false, false]);
		expect(() => validateNextServerNftMismatchArtifact(zeroClass)).toThrow(
			'T281 no classified next-server NFT mismatch reproduced',
		);
	});

	test('acquires two consecutive builds from one installed lane in exact order', async () => {
		const calls: string[] = [];
		const lane = '/synthetic/canonical-lane';
		const templateRuns = mutableRuns(mismatchArtifact());
		const acquired = await acquireNextServerNftRuns({
			extract: async () => {
				calls.push('extract');
				return lane;
			},
			install: async (received) => {
				calls.push(`install:${received}`);
			},
			resetBuildRoot: async (received) => {
				calls.push(`reset:${received}`);
			},
			build: async (received) => {
				calls.push(`build:${received}`);
			},
			capture: async (received, id) => {
				calls.push(`capture:${id}:${received}`);
				return structuredClone(
					id === 'first' ? templateRuns[0]! : templateRuns[1]!,
				) as NftMismatchRun;
			},
			assertImmutable: async (received) => {
				calls.push(`immutable:${received}`);
			},
		});
		expect(acquired).toMatchObject({ lane, first: { id: 'first' }, second: { id: 'second' } });
		expect(calls).toEqual([
			'extract',
			`install:${lane}`,
			`immutable:${lane}`,
			`reset:${lane}`,
			`build:${lane}`,
			`capture:first:${lane}`,
			`immutable:${lane}`,
			`reset:${lane}`,
			`build:${lane}`,
			`capture:second:${lane}`,
			`immutable:${lane}`,
		]);
	});

	test('pre-screens trace members and symlink aliases before trace filesystem access', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-kbg-nft-'));
		const lane = path.join(directory, 'lane');
		const build = path.join(lane, '.next');
		await mkdir(build, { recursive: true });
		await writeFile(
			path.join(build, 'next-server.js.nft.json'),
			JSON.stringify({ cacheKey: 'redacted', files: ['trace'], version: 1 }),
		);
		const calls: string[] = [];
		const instrumented = {
			readFile: async (file: string) => {
				calls.push(file);
				return await readFile(file);
			},
			lstat: async (file: string) => {
				calls.push(file);
				return await lstat(file);
			},
			readlink: async (file: string) => {
				calls.push(file);
				return await readlink(file);
			},
		};
		await expect(captureNextServerNftRun(lane, 'first', instrumented)).rejects.toThrow(
			'forbidden build trace',
		);
		expect(calls).toEqual([path.join(build, 'next-server.js.nft.json')]);

		await writeFile(
			path.join(build, 'next-server.js.nft.json'),
			JSON.stringify({ cacheKey: 'redacted', files: ['safe-link'], version: 1 }),
		);
		await symlink('trace', path.join(build, 'safe-link'));
		calls.length = 0;
		await expect(captureNextServerNftRun(lane, 'second', instrumented)).rejects.toThrow(
			'forbidden build trace',
		);
		expect(calls).toEqual([
			path.join(build, 'next-server.js.nft.json'),
			path.join(build, 'safe-link'),
			path.join(build, 'safe-link'),
		]);
		expect(calls.some((call) => call === path.join(build, 'trace'))).toBe(false);
		await rm(directory, { recursive: true, force: true });
	});

	test('keeps the diagnostic path free of snapshots, build copies, and recursive build inventory', async () => {
		const source = await readFile(
			'packages/cli/src/fixture/next-killedbygoogle-run.ts',
			'utf8',
		);
		const start = source.indexOf('export type DiagnosticAcquisitionOperations');
		const end = source.indexOf('async function productionStorageInventory', start);
		const diagnosticPath = source.slice(start, end);
		expect(diagnosticPath).not.toContain('buildSnapshot(');
		expect(diagnosticPath).not.toContain('productionStorageInventory(');
		expect(diagnosticPath).not.toContain('cp(');
		expect(diagnosticPath).not.toContain("readdir(path.join(lane, '.next')");
		expect(diagnosticPath).not.toContain("realpath(path.join(lane, '.next')");
		expect(diagnosticPath).not.toContain('secondLane');
		expect(diagnosticPath).not.toContain("extractDiagnosticLane('");
		expect(diagnosticPath).toContain("rm(path.join(buildLane, '.next'), {");
	});
});
