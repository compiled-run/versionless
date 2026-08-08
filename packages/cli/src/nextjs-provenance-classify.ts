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
	createProvenanceFrameworkClassificationReceipt,
	parseProvenanceFrameworkClassificationReceipt,
	type ProvenanceFrameworkClassificationReceipt,
} from '../../core/src/receipts/provenance-framework-classification.ts';
import { classifyNextjsProvenanceArchive } from '../../frameworks/nextjs/src/provenance-classify.ts';

const expected = {
	fixtureId: 'next-killedbygoogle',
	repository: 'codyogden/killedbygoogle',
	commit: '56809c31592e6ca1edce8af9bfe842fbcdf71f4d',
	tree: 'b8ac7b4fc3a1e12240f1848f6e8d98c1c7d80763',
	fixtureSha256: 'dd8725527ffa7f9b50826bd740cbda9bf5e2e08ee4c0fe8727505051c055d23a',
	provenanceSha256: '2d7b33af46e951f2e128b5dd4c440d611e0c27f593d3004b470190abc703164b',
	evidenceSha256: 'ee5498bb5b1187371b6c58c4dfb3e0cdd58fdab8e5eea1eb09eba839c6b66843',
	archiveSha256: 'c28878d0f65b56aa595763c852477fb0c1e3533e5c7f7ea9daa2be16f102368d',
	cacheManifestSha256: '04d5d4ca5f4133ecb5772c5aab9053af4f58cfcfdb2d837dcdd0f16da5eec9d8',
	archiveManifestSha256: '05c3677979d98740e8c76a599497e43fe2b623a43e56226edd01c53bf2bf572c',
	offlineReplaySha256: 'faf10cb59a9b63919346d3a98250afbd8f89527fd616576c337da3e1e70bd85a',
} as const;

const reliedPaths = [
	'.github/workflows/playwright.yml',
	'LICENSE',
	'components/Search/index.tsx',
	'next.config.js',
	'package.json',
	'pages/index.tsx',
	'yarn.lock',
] as const;

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
		throw new Error(`Next.js provenance ${label} must be an object`);
	return value as JsonRecord;
}

function exactKeys(value: JsonRecord, keys: readonly string[], label: string): void {
	if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort()))
		throw new Error(`Next.js provenance ${label} schema mismatch`);
}

function exactJson(left: unknown, right: unknown, label: string): void {
	if (JSON.stringify(left) !== JSON.stringify(right))
		throw new Error(`Next.js provenance ${label} mismatch`);
}

function designatedOutput(root: string, outputPath: string): string {
	const normalized = normalize(outputPath);
	if (normalized !== outputPath)
		throw new Error('Next.js provenance classification output path must be normalized');
	const output = isAbsolute(normalized) ? normalized : resolve(root, normalized);
	const designated = resolve(
		root,
		'evidence/classifications/next-killedbygoogle/t130-classification.json',
	);
	if (output !== designated)
		throw new Error(
			'Next.js provenance classification output must be the exact designated path',
		);
	return output;
}

async function optionalStat(file: string) {
	try {
		return await lstat(file);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
		throw error;
	}
}

async function requireSafeDesignatedOutput(root: string, outputPath: string) {
	const output = designatedOutput(root, outputPath);
	const rootStatus = await optionalStat(root);
	if (!rootStatus || rootStatus.isSymbolicLink())
		throw new Error('Next.js provenance classification output path contains a symlink');
	if (!rootStatus.isDirectory())
		throw new Error('Next.js provenance classification output path has a type collision');
	const scoped = relative(root, output);
	let cursor = root;
	const segments = scoped.split('/');
	for (const [index, segment] of segments.entries()) {
		cursor = join(cursor, segment);
		const status = await optionalStat(cursor);
		if (!status) continue;
		if (status.isSymbolicLink())
			throw new Error('Next.js provenance classification output path contains a symlink');
		const isOutput = index === segments.length - 1;
		if ((isOutput && !status.isFile()) || (!isOutput && !status.isDirectory()))
			throw new Error('Next.js provenance classification output path has a type collision');
	}
	const temporary = join(dirname(output), `.${basename(output)}.t132.tmp`);
	if (await optionalStat(temporary))
		throw new Error('Next.js provenance classification temporary publication residue exists');
	return { output, temporary };
}

async function publishAtomically(
	output: string,
	temporary: string,
	contents: string,
	injectFailure: boolean,
): Promise<void> {
	await mkdir(dirname(output), { recursive: true });
	let handle: Awaited<ReturnType<typeof open>> | undefined;
	try {
		handle = await open(temporary, 'wx', 0o600);
		await handle.writeFile(contents, 'utf8');
		await handle.sync();
		await handle.close();
		handle = undefined;
		if (injectFailure) throw new Error('Injected atomic classification publication failure');
		await rename(temporary, output);
	} finally {
		await handle?.close();
		await rm(temporary, { force: true });
	}
}

function defaultT128Verifier(root: string): Promise<{ networkAttempts: 0; digest: string }> {
	return new Promise((resolveResult, reject) => {
		execFile(
			process.execPath,
			[
				'--experimental-strip-types',
				'packages/cli/src/fixture/tier-f-ingest.ts',
				'--verify-only',
				'--fixture',
				'next-killedbygoogle',
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
				if (error) {
					reject(new Error(`T128 offline verifier failed: ${stderr || error.message}`));
					return;
				}
				let output: JsonRecord;
				try {
					output = record(JSON.parse(stdout), 'T128 verifier output');
				} catch {
					reject(new Error('T128 offline verifier output is not exact JSON'));
					return;
				}
				const fixtures = output.fixtures;
				if (
					output.networkAttempts !== 0 ||
					!Array.isArray(fixtures) ||
					fixtures.length !== 1 ||
					fixtures[0]?.fixture !== expected.fixtureId ||
					fixtures[0]?.canonicalOutputSha256 !== expected.offlineReplaySha256
				) {
					reject(
						new Error('T128 offline verifier digest or zero-attempt result mismatch'),
					);
					return;
				}
				resolveResult({ networkAttempts: 0, digest: expected.offlineReplaySha256 });
			},
		);
	});
}

export function rejectSensitiveMaterial(value: unknown): void {
	const forbidden = [
		'file://',
		'/users/',
		'authorization:',
		'cookie:',
		'api_key',
		'api-key',
		'cardnumber',
		'card number',
		'jacksm5pro',
	];
	const inspect = (candidate: unknown): boolean => {
		if (typeof candidate === 'string') {
			const lower = candidate.toLowerCase();
			return forbidden.some((marker) => lower.includes(marker));
		}
		if (Array.isArray(candidate)) return candidate.some(inspect);
		if (candidate && typeof candidate === 'object')
			return Object.values(candidate).some(inspect);
		return false;
	};
	if (inspect(value))
		throw new Error('Next.js provenance classification contains sensitive material');
}

export async function runNextjsProvenanceClassification(options: {
	fixtureId: string;
	outputPath: string;
	offline: boolean;
	rootDir?: string;
	environment?: NodeJS.ProcessEnv;
	candidateExecution?: boolean;
	injectPublicationFailure?: boolean;
	verifyT128?: () => Promise<{ networkAttempts: 0; digest: string }>;
}): Promise<ProvenanceFrameworkClassificationReceipt> {
	const environment = options.environment ?? process.env;
	if (!options.offline || environment.VERSIONLESS_NETWORK_MODE !== 'offline')
		throw new Error('nextjs:provenance-classify requires explicit offline mode');
	if (options.candidateExecution === true)
		throw new Error('Next.js provenance classification forbids candidate execution');
	if (options.fixtureId !== expected.fixtureId)
		throw new Error('Next.js provenance classification fixture is not authorized');
	const root = resolve(options.rootDir ?? '.');
	const { output, temporary } = await requireSafeDesignatedOutput(root, options.outputPath);
	const verification = await (options.verifyT128 ?? (() => defaultT128Verifier(root)))();
	if (verification.networkAttempts !== 0 || verification.digest !== expected.offlineReplaySha256)
		throw new Error('T128 offline verification prerequisite mismatch');
	const fixturePath = resolve(root, 'fixtures/next-killedbygoogle/fixture.json');
	const provenancePath = resolve(root, 'fixtures/next-killedbygoogle/provenance.json');
	const evidencePath = resolve(root, 'evidence/ingests/next-killedbygoogle/t128-ingest.json');
	const archivePath = resolve(
		root,
		`.versionless/cache/tier-f/next-killedbygoogle/${expected.archiveSha256}/source.tar.gz`,
	);
	const cacheManifestPath = resolve(
		root,
		`.versionless/cache/tier-f/next-killedbygoogle/${expected.archiveSha256}/manifest.json`,
	);
	const [fixtureBytes, provenanceBytes, evidenceBytes, archiveBytes, cacheManifestBytes] =
		await Promise.all([
			readFile(fixturePath),
			readFile(provenancePath),
			readFile(evidencePath),
			readFile(archivePath),
			readFile(cacheManifestPath),
		]);
	if (
		sha256(fixtureBytes) !== expected.fixtureSha256 ||
		sha256(provenanceBytes) !== expected.provenanceSha256 ||
		sha256(evidenceBytes) !== expected.evidenceSha256 ||
		sha256(archiveBytes) !== expected.archiveSha256 ||
		sha256(cacheManifestBytes) !== expected.cacheManifestSha256
	)
		throw new Error('Next.js provenance accepted closure hash mismatch');
	const fixture = record(JSON.parse(fixtureBytes.toString('utf8')), 'fixture');
	const provenance = record(JSON.parse(provenanceBytes.toString('utf8')), 'provenance');
	const evidence = record(JSON.parse(evidenceBytes.toString('utf8')), 'evidence');
	const cacheManifest = record(JSON.parse(cacheManifestBytes.toString('utf8')), 'cache manifest');
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
		evidence.consent?.task !== 'T128' ||
		evidence.consent?.status !== 'closed' ||
		evidence.reconciliation?.attempts !== 19 ||
		evidence.reconciliation?.completedBodies !== 19
	)
		throw new Error('Next.js provenance accepted identity or evidence mismatch');
	exactJson(fixture.reliedPaths, reliedPaths, 'fixture relied paths');
	const index = indexTarGzip(
		{
			bytes: archiveBytes,
			byteLength: archiveBytes.byteLength,
			sha256: hashBytes(archiveBytes),
		},
		expected.commit,
	);
	if (
		archiveBytes.byteLength !== fixture.archive?.byteLength ||
		fixture.archive?.sha256 !== expected.archiveSha256 ||
		provenance.archive?.sha256 !== expected.archiveSha256 ||
		index.files.length !== 72 ||
		index.manifestSha256 !== expected.archiveManifestSha256 ||
		fixture.archiveManifestSha256 !== expected.archiveManifestSha256 ||
		provenance.fileCount !== 72 ||
		provenance.fileManifestSha256 !== expected.archiveManifestSha256 ||
		cacheManifest.archiveSha256 !== expected.archiveSha256 ||
		cacheManifest.manifestSha256 !== expected.archiveManifestSha256
	)
		throw new Error('Next.js provenance archive or manifest mismatch');
	exactJson(index.globalMetadata, provenance.acceptedGlobalMetadata, 'global metadata');
	exactJson(index.pathMetadata, provenance.acceptedPathMetadata, 'path metadata');
	const files = index.files.map((file) => ({
		path: file.path,
		byteLength: file.byteLength,
		sha256: file.sha256,
	}));
	exactJson(files, provenance.files, 'complete file manifest');
	exactJson(cacheManifest.files, files, 'cache file manifest');
	if (!Array.isArray(provenance.officialTree) || provenance.officialTreeRowCount !== 86)
		throw new Error('Next.js provenance exact official tree is absent');
	const treeRows = provenance.officialTree as Array<{
		path: string;
		mode: string;
		type: string;
		sha: string;
	}>;
	if (
		treeRows.length !== 86 ||
		treeRows.some((row) => row.type === 'commit' || row.mode === '160000')
	)
		throw new Error('Next.js provenance official tree count or submodule boundary mismatch');
	const treeFiles = treeRows
		.filter((row) => row.type === 'blob')
		.map((row) => row.path)
		.sort((left, right) => left.localeCompare(right));
	requireOfficialTreeInventory(index, treeFiles);
	for (const reliedPath of reliedPaths) findArchiveFile(index, reliedPath);
	const rootLicense = requireRootMitLicense(index, 'LICENSE');
	if (
		provenance.rootLicense?.path !== rootLicense.path ||
		provenance.rootLicense?.sha256 !== rootLicense.sha256 ||
		provenance.rootLicense?.classification !== 'verified-compatible'
	)
		throw new Error('Next.js provenance root MIT binding mismatch');
	const licenseInventory = inventoryLicensing(index);
	if (
		!Array.isArray(provenance.licensing) ||
		licenseInventory.length !== provenance.licensing.length ||
		licenseInventory.some(
			(file, indexValue) =>
				file.path !== provenance.licensing[indexValue]?.path ||
				file.sha256 !== provenance.licensing[indexValue]?.sha256,
		)
	)
		throw new Error('Next.js provenance complete license inventory mismatch');
	if (!Array.isArray(provenance.assets))
		throw new Error('Next.js provenance asset classifications are absent');
	requireCompleteAssetClassifications(index, provenance.assets);
	const sourceFacts = classifyNextjsProvenanceArchive(index);
	const receipt = createProvenanceFrameworkClassificationReceipt({
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
			officialTreeRows: 86,
			archiveFiles: 72,
			reliedPaths: [...reliedPaths],
			rootLicense: {
				path: 'LICENSE',
				sha256: rootLicense.sha256,
				classification: 'verified-compatible',
			},
			licenseInventoryEntries: licenseInventory.length,
			assetClassificationEntries: provenance.assets.length,
		},
		sourceFacts,
	});
	rejectSensitiveMaterial(receipt);
	const after = await Promise.all([
		readFile(fixturePath),
		readFile(provenancePath),
		readFile(evidencePath),
		readFile(archivePath),
		readFile(cacheManifestPath),
	]);
	if (
		sha256(after[0]) !== expected.fixtureSha256 ||
		sha256(after[1]) !== expected.provenanceSha256 ||
		sha256(after[2]) !== expected.evidenceSha256 ||
		sha256(after[3]) !== expected.archiveSha256 ||
		sha256(after[4]) !== sha256(cacheManifestBytes)
	)
		throw new Error('Next.js provenance accepted closure changed during classification');
	await publishAtomically(
		output,
		temporary,
		`${JSON.stringify(receipt, null, 2)}\n`,
		options.injectPublicationFailure === true,
	);
	return parseProvenanceFrameworkClassificationReceipt(receipt);
}
