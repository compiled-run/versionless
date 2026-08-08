import { execFile } from 'node:child_process';
import { lstat, mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, normalize, relative, resolve } from 'pathe';
import {
	findArchiveFile,
	hashBytes,
	indexTarGzip,
	inventoryLicensing,
	requireCompleteAssetClassifications,
	requireOfficialTreeInventory,
	requireRootMitLicense,
} from '../../core/src/corpus/tier-f-provenance.ts';
import { sha256 } from '../../core/src/receipts/canonicalize.ts';
import {
	createNext13ProvenanceClassificationReceipt,
	NEXT13_RELIED_PATHS,
	parseNext13ProvenanceClassificationReceipt,
	type Next13ProvenanceClassificationReceipt,
} from '../../core/src/receipts/next13-provenance-classification.ts';
import { classifyNext13ProvenanceArchive } from '../../frameworks/nextjs/src/next13-provenance-classify.ts';
import { rejectSensitiveMaterial } from './nextjs-provenance-classify.ts';

const expected = {
	fixtureId: 'next-tailwind-starter-blog',
	repository: 'timlrx/tailwind-nextjs-starter-blog',
	commit: '09ba0550caea03a8c38bc4878d05838d2a57f999',
	tree: '2609b3fc4a63d7bccd8f187d66c141f4a7d3cadf',
	fixtureSha256: 'd24bf99d50e7f90ac53dcc7d99f04fcd9842379d94393548c7abbf486288b6c1',
	provenanceSha256: 'b0cb4e5b597bd619d8ea76912b09a6257bb1e3be4f4d259160334518a8b5bc29',
	evidenceSha256: '4562e7fe0ab786cede4a40ead07666d44d085a45699443fe65da4aabed9b61f0',
	archiveSha256: 'c227efa283b4a17d7ae76aa1b9ea259075f606128642d59f7b43ca63405ee1f7',
	cacheManifestSha256: '8079a31d105783e6e293402ea541c13c4fe2ff7038d010b414d322491b3dd202',
	archiveManifestSha256: '8cce8b04846e0382bf1a4b2812881a998fc3d2cf061b2f43362310139da801e3',
	offlineReplaySha256: '5b525cf6cfc447fbdd3ca0640115c7810b67de5dd1680e3d5ff624356e767a98',
} as const;

const fixtureKeys = [
	'schemaVersion',
	'id',
	'framework',
	'repository',
	'repositoryUrl',
	'commit',
	'tree',
	'archive',
	'archiveManifestSha256',
	'repositoryIdentity',
	'reliedPaths',
	'corroboratedLeadFacts',
	'evidenceBlockers',
	'usableClosure',
	'localityBoundaries',
	'nonclaims',
] as const;
const provenanceKeys = [
	'acceptedGlobalMetadata',
	'acceptedPathMetadata',
	'archive',
	'assets',
	'commit',
	'corroboratedLeadFacts',
	'evidenceBlockers',
	'excludedCommittedDist',
	'fileCount',
	'fileManifestSha256',
	'files',
	'fixture',
	'licensing',
	'nestedCompatibleLicense',
	'officialTree',
	'officialTreeRowCount',
	'repository',
	'repositoryIdentity',
	'rootLicense',
	'schemaVersion',
	'tree',
] as const;
type JsonRecord = Record<string, any>;

function record(value: unknown, label: string): JsonRecord {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`Next13 provenance ${label} must be an object`);
	return value as JsonRecord;
}
function exactKeys(value: JsonRecord, keys: readonly string[], label: string): void {
	if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort()))
		throw new Error(`Next13 provenance ${label} schema mismatch`);
}
function exactJson(left: unknown, right: unknown, label: string): void {
	if (JSON.stringify(left) !== JSON.stringify(right))
		throw new Error(`Next13 provenance ${label} mismatch`);
}
async function optionalStat(file: string) {
	try {
		return await lstat(file);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
		throw error;
	}
}
async function safeOutput(root: string, outputPath: string) {
	const normalized = normalize(outputPath);
	if (normalized !== outputPath)
		throw new Error('Next13 classification output path must be normalized');
	const output = isAbsolute(normalized) ? normalized : resolve(root, normalized);
	const designated = resolve(
		root,
		'evidence/classifications/next-tailwind-starter-blog/t149-classification.json',
	);
	if (output !== designated)
		throw new Error('Next13 classification output must be the exact designated path');
	const rootStatus = await optionalStat(root);
	if (!rootStatus || rootStatus.isSymbolicLink())
		throw new Error('Next13 classification output path contains a symlink');
	if (!rootStatus.isDirectory()) throw new Error('Next13 classification root is not a directory');
	let cursor = root;
	const segments = relative(root, output).split('/');
	for (const [index, segment] of segments.entries()) {
		cursor = join(cursor, segment);
		const status = await optionalStat(cursor);
		if (!status) continue;
		if (status.isSymbolicLink())
			throw new Error('Next13 classification output path contains a symlink');
		const final = index === segments.length - 1;
		if ((final && !status.isFile()) || (!final && !status.isDirectory()))
			throw new Error('Next13 classification output path has a type collision');
	}
	const temporary = join(dirname(output), `.${basename(output)}.tmp`);
	if (await optionalStat(temporary)) throw new Error('Next13 classification residue exists');
	return { output, temporary };
}
async function publish(output: string, temporary: string, contents: string): Promise<void> {
	await mkdir(dirname(output), { recursive: true });
	let handle: Awaited<ReturnType<typeof open>> | undefined;
	try {
		handle = await open(temporary, 'wx', 0o600);
		await handle.writeFile(contents, 'utf8');
		await handle.sync();
		await handle.close();
		handle = undefined;
		await rename(temporary, output);
	} finally {
		await handle?.close();
		await rm(temporary, { force: true });
	}
}

function defaultVerifier(root: string): Promise<{ networkAttempts: 0; digest: string }> {
	return new Promise((resolveResult, reject) => {
		execFile(
			process.execPath,
			[
				'--experimental-strip-types',
				'packages/cli/src/fixture/tier-f-ingest.ts',
				'--verify-only',
				'--fixture',
				expected.fixtureId,
			],
			{
				cwd: root,
				env: {
					...process.env,
					VERSIONLESS_NETWORK_MODE: 'offline',
					NPM_CONFIG_OFFLINE: 'true',
				},
			},
			(error, stdout, stderr) => {
				if (error)
					return reject(
						new Error(`T142 offline verifier failed: ${stderr || error.message}`),
					);
				try {
					const output = record(JSON.parse(stdout), 'verifier output');
					if (
						output.networkAttempts !== 0 ||
						!Array.isArray(output.fixtures) ||
						output.fixtures.length !== 1 ||
						output.fixtures[0]?.fixture !== expected.fixtureId ||
						output.fixtures[0]?.canonicalOutputSha256 !== expected.offlineReplaySha256
					)
						throw new Error('T142 verifier digest or zero-attempt result mismatch');
					resolveResult({ networkAttempts: 0, digest: expected.offlineReplaySha256 });
				} catch (parseError) {
					reject(parseError);
				}
			},
		);
	});
}

export async function runNext13ProvenanceClassification(options: {
	fixtureId: string;
	outputPath: string;
	offline: boolean;
	rootDir?: string;
	environment?: NodeJS.ProcessEnv;
	candidateExecution?: boolean;
	verifyT142?: () => Promise<{ networkAttempts: 0; digest: string }>;
}): Promise<Next13ProvenanceClassificationReceipt> {
	const environment = options.environment ?? process.env;
	if (!options.offline || environment.VERSIONLESS_NETWORK_MODE !== 'offline')
		throw new Error('next13:provenance-classify requires explicit offline mode');
	if (options.candidateExecution === true)
		throw new Error('Next13 provenance classification forbids candidate execution');
	if (options.fixtureId !== expected.fixtureId)
		throw new Error('Next13 provenance classification fixture is not authorized');
	const root = resolve(options.rootDir ?? '.');
	const { output, temporary } = await safeOutput(root, options.outputPath);
	const verification = await (options.verifyT142 ?? (() => defaultVerifier(root)))();
	if (verification.networkAttempts !== 0 || verification.digest !== expected.offlineReplaySha256)
		throw new Error('T142 offline verification prerequisite mismatch');
	const fixturePath = resolve(root, `fixtures/${expected.fixtureId}/fixture.json`);
	const provenancePath = resolve(root, `fixtures/${expected.fixtureId}/provenance.json`);
	const evidencePath = resolve(root, `evidence/ingests/${expected.fixtureId}/t142-ingest.json`);
	const cacheRoot = `.versionless/cache/tier-f/${expected.fixtureId}/${expected.archiveSha256}`;
	const archivePath = resolve(root, `${cacheRoot}/source.tar.gz`);
	const cacheManifestPath = resolve(root, `${cacheRoot}/manifest.json`);
	const paths = [fixturePath, provenancePath, evidencePath, archivePath, cacheManifestPath];
	const before = await Promise.all(paths.map((file) => readFile(file)));
	const hashes = before.map((bytes) => sha256(bytes));
	if (
		JSON.stringify(hashes) !==
		JSON.stringify([
			expected.fixtureSha256,
			expected.provenanceSha256,
			expected.evidenceSha256,
			expected.archiveSha256,
			expected.cacheManifestSha256,
		])
	)
		throw new Error('Next13 accepted closure hash mismatch');
	const fixture = record(JSON.parse(before[0]!.toString('utf8')), 'fixture');
	const provenance = record(JSON.parse(before[1]!.toString('utf8')), 'provenance');
	const evidence = record(JSON.parse(before[2]!.toString('utf8')), 'evidence');
	const cacheManifest = record(JSON.parse(before[4]!.toString('utf8')), 'cache manifest');
	exactKeys(fixture, fixtureKeys, 'fixture');
	exactKeys(provenance, provenanceKeys, 'provenance');
	if (
		fixture.id !== expected.fixtureId ||
		fixture.framework !== 'nextjs' ||
		fixture.repository !== expected.repository ||
		fixture.commit !== expected.commit ||
		fixture.tree !== expected.tree ||
		fixture.repositoryIdentity?.fullName !== expected.repository ||
		fixture.repositoryIdentity?.fork !== false ||
		provenance.fixture !== expected.fixtureId ||
		provenance.repository !== expected.repository ||
		provenance.commit !== expected.commit ||
		provenance.tree !== expected.tree ||
		provenance.repositoryIdentity?.fullName !== expected.repository ||
		provenance.repositoryIdentity?.fork !== false ||
		evidence.fixture !== expected.fixtureId ||
		evidence.consent?.task !== 'T142' ||
		evidence.consent?.status !== 'closed' ||
		evidence.reconciliation?.attempts !== 21 ||
		evidence.reconciliation?.completedBodies !== 21 ||
		evidence.reconciliation?.completedBytes !== 3679363
	)
		throw new Error('Next13 accepted identity or evidence mismatch');
	exactJson(fixture.reliedPaths, NEXT13_RELIED_PATHS, 'fixture relied paths');
	const archiveBytes = before[3]!;
	const index = indexTarGzip(
		{
			bytes: archiveBytes,
			byteLength: archiveBytes.byteLength,
			sha256: hashBytes(archiveBytes),
		},
		expected.commit,
	);
	if (
		fixture.archive?.sha256 !== expected.archiveSha256 ||
		provenance.archive?.sha256 !== expected.archiveSha256 ||
		index.files.length !== 110 ||
		index.manifestSha256 !== expected.archiveManifestSha256 ||
		fixture.archiveManifestSha256 !== expected.archiveManifestSha256 ||
		provenance.fileCount !== 110 ||
		provenance.fileManifestSha256 !== expected.archiveManifestSha256 ||
		cacheManifest.archiveSha256 !== expected.archiveSha256 ||
		cacheManifest.manifestSha256 !== expected.archiveManifestSha256
	)
		throw new Error('Next13 archive or manifest mismatch');
	const files = index.files.map((file) => ({
		path: file.path,
		byteLength: file.byteLength,
		sha256: file.sha256,
	}));
	exactJson(index.globalMetadata, provenance.acceptedGlobalMetadata, 'global metadata');
	exactJson(index.pathMetadata, provenance.acceptedPathMetadata, 'path metadata');
	exactJson(files, provenance.files, 'complete file manifest');
	exactJson(cacheManifest.files, files, 'cache file manifest');
	if (
		!Array.isArray(provenance.officialTree) ||
		provenance.officialTreeRowCount !== 138 ||
		provenance.officialTree.length !== 138
	)
		throw new Error('Next13 exact official tree is absent');
	const treePaths = new Set<string>();
	for (const row of provenance.officialTree as JsonRecord[]) {
		if (
			typeof row.path !== 'string' ||
			!row.path ||
			treePaths.has(row.path) ||
			typeof row.sha !== 'string' ||
			row.sha.length !== 40 ||
			![...row.sha].every(
				(character) =>
					(character >= '0' && character <= '9') ||
					(character >= 'a' && character <= 'f'),
			) ||
			!(
				(row.type === 'tree' && row.mode === '040000') ||
				(row.type === 'blob' && (row.mode === '100644' || row.mode === '100755'))
			)
		)
			throw new Error('Next13 official tree row is malformed or duplicated');
		treePaths.add(row.path);
	}
	const treeFiles = provenance.officialTree
		.filter((row: JsonRecord) => row.type === 'blob')
		.map((row: JsonRecord) => row.path)
		.sort((left: string, right: string) => left.localeCompare(right));
	requireOfficialTreeInventory(index, treeFiles);
	for (const reliedPath of NEXT13_RELIED_PATHS) findArchiveFile(index, reliedPath);
	const rootLicense = requireRootMitLicense(index, 'LICENSE');
	if (
		provenance.rootLicense?.sha256 !== rootLicense.sha256 ||
		rootLicense.sha256 !== '317b52bec9a462916d9219427552de01604be107efc60606a3046df2d2ee0ff2'
	)
		throw new Error('Next13 root MIT binding mismatch');
	const licensing = inventoryLicensing(index);
	if (
		licensing.length !== 1 ||
		!Array.isArray(provenance.licensing) ||
		provenance.licensing.length !== 1 ||
		provenance.licensing[0]?.sha256 !== rootLicense.sha256
	)
		throw new Error('Next13 license inventory mismatch');
	if (!Array.isArray(provenance.assets) || provenance.assets.length !== 25)
		throw new Error('Next13 asset classifications are absent');
	requireCompleteAssetClassifications(index, provenance.assets);
	const assetCounts = {
		total: provenance.assets.length,
		excluded: provenance.assets.filter(
			(asset: JsonRecord) => asset.classification === 'excluded',
		).length,
		unknown: provenance.assets.filter((asset: JsonRecord) => asset.classification === 'unknown')
			.length,
		compatible: provenance.assets.filter(
			(asset: JsonRecord) => asset.classification === 'verified-compatible',
		).length,
	};
	if (
		JSON.stringify(assetCounts) !==
		JSON.stringify({ total: 25, excluded: 11, unknown: 14, compatible: 0 })
	)
		throw new Error('Next13 asset boundary count mismatch');
	const receipt = createNext13ProvenanceClassificationReceipt({
		closure: {
			fixtureId: expected.fixtureId,
			repository: expected.repository,
			nonFork: true,
			commit: expected.commit,
			tree: expected.tree,
			fixtureSha256: expected.fixtureSha256,
			provenanceSha256: expected.provenanceSha256,
			evidenceSha256: expected.evidenceSha256,
			archiveSha256: expected.archiveSha256,
			cacheManifestSha256: expected.cacheManifestSha256,
			archiveManifestSha256: expected.archiveManifestSha256,
			offlineReplaySha256: expected.offlineReplaySha256,
			officialTreeRows: 138,
			archiveFiles: 110,
			reliedPaths: [...NEXT13_RELIED_PATHS],
			rootLicense: {
				path: 'LICENSE',
				sha256: rootLicense.sha256,
				classification: 'verified-compatible',
			},
			licenseInventoryEntries: 1,
			assets: { total: 25, excluded: 11, unknown: 14, compatible: 0 },
		},
		sourceFacts: classifyNext13ProvenanceArchive(index),
	});
	rejectSensitiveMaterial(receipt);
	const after = await Promise.all(paths.map((file) => readFile(file)));
	if (after.some((bytes, indexValue) => sha256(bytes) !== hashes[indexValue]))
		throw new Error('Next13 accepted closure changed during classification');
	await publish(output, temporary, `${JSON.stringify(receipt, null, 2)}\n`);
	return parseNext13ProvenanceClassificationReceipt(receipt);
}
