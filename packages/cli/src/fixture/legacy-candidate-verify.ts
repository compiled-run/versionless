// Offline verification of one legacy corpus candidate's published ingest evidence.
//
// This validates documents, not remotes: it recomputes the acquisition attempt from the candidate
// configuration, reconciles the source record against the recorded git tree, and cross-checks the
// archive digests, blob-manifest counts, closure totals, licence digests, and baseline-attempt shape
// against each other and against the fixture record. It performs no request and re-acquires nothing.
import { readFile } from 'node:fs/promises';
import { basename, join } from 'pathe';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';
import {
	acquisitionAttempt,
	archiveEndpoint,
	archiveMatchesGitTree,
	assertAllowedAcquisitionUrl,
	blobEndpoint,
	cacheRootFor,
	documentBytes,
	evidenceRootFor,
	lowerHex40,
	lowerHex64,
	regularBlobIndex,
	summarizeTree,
	treeEndpoint,
	workRootFor,
	workspaceRoot,
	type LegacyBaselineRecord,
	type LegacyCandidateConfig,
	type LegacyClosureRecord,
	type LegacySourceRecord,
	type TreeRow,
} from './legacy-candidate-ingest.ts';

export type LegacyLicenseArtifact = Readonly<{
	path: string;
	role: string;
	gitBlobSha: string;
	bytes: number;
	sha256: string;
}>;

export type LegacyLicenseRecord = Readonly<{
	schemaVersion: string;
	slug: string;
	consentId: string;
	revision: Readonly<{
		repository: string;
		ref: string;
		commitSha: string;
		rootTreeSha: string;
	}>;
	declaration: Readonly<{ identifier: string; frontendManifestLicenseField: string }>;
	artifacts: readonly LegacyLicenseArtifact[];
	inventory: Readonly<{
		licenceFilesInTree: number;
		committedNodeModules: number;
		committedDistDirectories: number;
	}>;
}>;

export type LegacyProbeRecord = Readonly<{
	url: string;
	status: number;
	bytes: number;
	sha256: string;
}>;

export type LegacyFixtureRecord = Readonly<{
	id: string;
	source: Readonly<{
		repository: string;
		ref: string;
		revision: string;
		rootTreeSha: string;
		archiveUrl: string;
		archiveBytes: number;
		archiveSha256: string;
		archiveRoot: string;
		normalizedManifestSha256: string;
		license: string;
		licensePath: string;
		licenseSha256: string;
		frontendRoot: string;
		packageSha256: string;
		packageLockSha256: string;
	}>;
	lockState: Readonly<{
		lockfileVersion: number;
		lockedPlacements: number;
		distinctNameVersionPairs: number;
		integrityAlgorithms: readonly string[];
		registryHosts: readonly string[];
	}>;
}>;

export type LegacyEvidenceDocuments = Readonly<{
	attemptBytes: Buffer;
	source: LegacySourceRecord;
	closure: LegacyClosureRecord;
	license: LegacyLicenseRecord;
	baseline: LegacyBaselineRecord;
	treeBytes: Buffer;
	treeRows: readonly TreeRow[];
	treeTruncated: boolean;
	probeLedger: readonly LegacyProbeRecord[];
	fixture: LegacyFixtureRecord;
}>;

export type LegacyEvidenceVerification = Readonly<{
	valid: true;
	fixture: string;
	checks: readonly string[];
	source: Readonly<{
		commitSha: string;
		archiveSha256: string;
		acceptedResponses: number;
		regularFiles: number;
	}>;
	closure: Readonly<{ lockedPlacements: number; distinctNameVersionPairs: number }>;
	baseline: Readonly<{ outcome: string; steps: number }>;
	digest: string;
}>;

const readJsonDocument = async <T>(file: string): Promise<T> =>
	JSON.parse(await readFile(file, 'utf8')) as T;

export async function loadLegacyEvidence(
	config: LegacyCandidateConfig,
	root: string = workspaceRoot,
): Promise<LegacyEvidenceDocuments> {
	const evidenceDirectory = join(root, evidenceRootFor(config));
	const treeBytes = await readFile(join(evidenceDirectory, 'probe-tree.json'));
	const tree = JSON.parse(treeBytes.toString('utf8')) as {
		tree: TreeRow[];
		truncated?: boolean;
	};
	const ledgerText = await readFile(join(evidenceDirectory, 'probe-ledger.ndjson'), 'utf8');
	return {
		attemptBytes: await readFile(join(evidenceDirectory, 'attempt.json')),
		source: await readJsonDocument<LegacySourceRecord>(join(evidenceDirectory, 'source.json')),
		closure: await readJsonDocument<LegacyClosureRecord>(
			join(evidenceDirectory, 'closure.json'),
		),
		license: await readJsonDocument<LegacyLicenseRecord>(
			join(evidenceDirectory, 'license.json'),
		),
		baseline: await readJsonDocument<LegacyBaselineRecord>(
			join(evidenceDirectory, 'baseline-attempt.json'),
		),
		treeBytes,
		treeRows: tree.tree,
		treeTruncated: tree.truncated === true,
		probeLedger: ledgerText
			.split('\n')
			.filter((line) => line.trim().length > 0)
			.map((line) => JSON.parse(line) as LegacyProbeRecord),
		fixture: await readJsonDocument<LegacyFixtureRecord>(
			join(root, 'fixtures', config.id, 'fixture.json'),
		),
	};
}

const pathSegments = (value: string): readonly string[] => value.split('/');
const isRelativePath = (value: string): boolean => value.length > 0 && !value.startsWith('/');
const sum = (values: readonly number[]): number =>
	values.reduce((total, value) => total + value, 0);

export function verifyLegacyEvidence(
	config: LegacyCandidateConfig,
	documents: LegacyEvidenceDocuments,
): LegacyEvidenceVerification {
	const checks: string[] = [];
	const ensure = (condition: boolean, message: string): void => {
		if (!condition) throw new Error(`${config.id}: ${message}`);
	};
	const record = (condition: boolean, message: string, check: string): void => {
		ensure(condition, message);
		checks.push(check);
	};
	const { source, closure, license, baseline, fixture } = documents;

	// The attempt document is a pure function of the candidate configuration, so it is recomputed
	// here rather than trusted, and the source record's binding digest is recomputed from its bytes.
	record(
		documents.attemptBytes.toString('utf8') === documentBytes(acquisitionAttempt(config)),
		'published acquisition attempt differs from the configured attempt',
		'attempt-document-recomputed',
	);
	record(
		source.attemptSha256 === sha256(documents.attemptBytes) &&
			source.consentId === config.consentId,
		'source record is not bound to the published attempt',
		'attempt-digest-bound',
	);

	const first = source.requests[0];
	ensure(first !== undefined, 'source record carries no accepted responses');
	for (const request of source.requests) assertAllowedAcquisitionUrl(request.endpoint, config);
	const archiveRequests = source.requests.filter((request) => request.stream !== undefined);
	const archive = archiveRequests[0];
	ensure(archive !== undefined, 'source record carries no archive stream');
	record(
		archiveRequests.length === config.caps.requiredArchiveStreams &&
			archiveRequests.every(
				(request) =>
					request.endpoint === archiveEndpoint(config, source.revision.commitSha) &&
					request.status === 200 &&
					request.sha256 === archive!.sha256 &&
					request.bytes === archive!.bytes,
			) &&
			source.transaction.archivesByteIdentical,
		'archive streams are not byte-identical across the required repeats',
		'archive-streams-byte-identical',
	);
	record(
		lowerHex64.test(archive!.sha256) &&
			archive!.bytes > 0 &&
			archive!.bytes <= config.caps.maximumArchiveBytes &&
			fixture.source.archiveSha256 === archive!.sha256 &&
			fixture.source.archiveBytes === archive!.bytes &&
			fixture.source.archiveUrl === archive!.endpoint,
		'archive digest fields disagree between the source and fixture records',
		'archive-digest-fields',
	);
	record(
		source.repository.responseBytes === first!.bytes &&
			source.repository.responseSha256 === first!.sha256 &&
			source.requests.every(
				(request) => request.status === 200 && lowerHex64.test(request.sha256),
			),
		'accepted response digests are inconsistent',
		'accepted-response-digests',
	);
	record(
		source.transaction.acceptedResponses === source.requests.length &&
			source.transaction.attemptedRequests === source.requests.length &&
			source.requests.length <= config.caps.maximumAcceptedResponses &&
			source.transaction.acceptedWireBytes ===
				sum(source.requests.map((request) => request.bytes)) &&
			source.transaction.acceptedDecodedBytes === source.transaction.acceptedWireBytes &&
			source.transaction.acceptedWireBytes <= config.caps.maximumAggregateWireBytes &&
			source.transaction.redirectsObserved === 0 &&
			source.transaction.setCookiesUsed === 0 &&
			source.transaction.retries === 0,
		'acquisition transaction totals disagree with the recorded responses',
		'transaction-totals',
	);
	record(
		source.revision.ref === `refs/tags/${config.tag}` &&
			lowerHex40.test(source.revision.commitSha) &&
			lowerHex40.test(source.revision.rootTreeSha) &&
			fixture.source.revision === source.revision.commitSha &&
			fixture.source.rootTreeSha === source.revision.rootTreeSha &&
			fixture.source.ref === source.revision.ref &&
			fixture.source.repository.endsWith(`/${config.owner}/${config.repository}`) &&
			fixture.id === config.id,
		'revision identity disagrees between the source and fixture records',
		'revision-identity',
	);

	const treeRequest = source.requests.find(
		(request) => request.endpoint === treeEndpoint(config, source.revision.rootTreeSha),
	);
	ensure(treeRequest !== undefined, 'source record carries no recursive tree response');
	record(
		treeRequest!.bytes === documents.treeBytes.byteLength &&
			treeRequest!.sha256 === sha256(documents.treeBytes) &&
			!documents.treeTruncated &&
			!source.revision.treeTruncated,
		'the retained tree document is not the tree response the source record accepted',
		'tree-document-bound',
	);
	const summary = summarizeTree(documents.treeRows);
	record(
		summary.treeEntries === source.revision.treeEntries &&
			summary.treeBlobs === source.revision.treeBlobs &&
			summary.treeDirectories === source.revision.treeDirectories &&
			summary.treeSymlinks === source.revision.treeSymlinks &&
			summary.treeGitlinks === source.revision.treeGitlinks,
		'recorded tree counts differ from the retained tree document',
		'tree-counts-recomputed',
	);

	const parity = source.archiveParity;
	const blobs = regularBlobIndex(documents.treeRows);
	record(
		parity.gitBlobs === blobs.size &&
			parity.missingFiles === 0 &&
			parity.extraFiles === 0 &&
			parity.mismatchedBlobs === 0 &&
			parity.specialEntries === 0 &&
			parity.regularFiles === parity.gitBlobs &&
			parity.safeEntries === parity.regularFiles + parity.directories &&
			parity.directories === summary.treeDirectories + 1 &&
			source.transaction.archiveMatchesGitTree === archiveMatchesGitTree(parity),
		'blob-manifest reconciliation counts do not close',
		'blob-manifest-reconciliation',
	);
	record(
		parity.singleRoot === `${config.repository}-${source.revision.commitSha}` &&
			fixture.source.archiveRoot === parity.singleRoot &&
			lowerHex64.test(parity.normalizedManifestSha256) &&
			fixture.source.normalizedManifestSha256 === parity.normalizedManifestSha256,
		'normalized archive manifest identity disagrees with the fixture record',
		'normalized-manifest-identity',
	);

	const withoutResolved = closure.lockState.entriesWithoutResolvedUrl.length;
	const hostTotals = sum(Object.values(closure.registryHosts));
	record(
		closure.slug === config.id &&
			closure.frontendRoot === config.frontendRoot &&
			closure.lockState.file === config.lockFileName &&
			closure.lockState.committedWithSource &&
			closure.lockState.everyEntryHasResolvedUrl === (withoutResolved === 0) &&
			closure.lockState.everyEntryHasIntegrityHash ===
				(closure.lockState.entriesWithoutIntegrityHash.length === 0) &&
			closure.lockState.coversDevDependencies === closure.counts.devPlacements > 0,
		'closure lock state contradicts its own entry lists',
		'closure-lock-state',
	);
	record(
		closure.counts.lockedPlacements > 0 &&
			closure.counts.distinctNameVersionPairs > 0 &&
			closure.counts.distinctNameVersionPairs <= closure.counts.lockedPlacements &&
			closure.counts.devPlacements <= closure.counts.lockedPlacements &&
			closure.counts.optionalPlacements <= closure.counts.lockedPlacements &&
			closure.counts.bundledPlacements <= closure.counts.lockedPlacements &&
			hostTotals ===
				closure.counts.lockedPlacements -
					withoutResolved -
					closure.counts.bundledPlacements &&
			lowerHex64.test(closure.closureSha256),
		'closure totals do not close against the recorded placements',
		'closure-totals',
	);
	record(
		fixture.lockState.lockedPlacements === closure.counts.lockedPlacements &&
			fixture.lockState.distinctNameVersionPairs ===
				closure.counts.distinctNameVersionPairs &&
			fixture.lockState.lockfileVersion === closure.lockState.lockfileVersion &&
			canonicalize(fixture.lockState.integrityAlgorithms) ===
				canonicalize(closure.lockState.lockfileIntegrityAlgorithms) &&
			canonicalize(fixture.lockState.registryHosts) ===
				canonicalize(Object.keys(closure.registryHosts)) &&
			fixture.source.packageSha256 === closure.source.packageJsonSha256 &&
			fixture.source.packageLockSha256 === closure.source.packageLockSha256 &&
			closure.source.packageLockBytes > 0 &&
			closure.source.verifiedSourceRoot ===
				`${cacheRootFor(config)}/verify/extracted/${parity.singleRoot}`,
		'closure record disagrees with the fixture lock state',
		'closure-fixture-agreement',
	);

	const licenceFiles = documents.treeRows.filter(
		(row) =>
			row.type === 'blob' &&
			(basename(row.path).toUpperCase().startsWith('LICENSE') ||
				basename(row.path).toUpperCase().startsWith('LICENCE')),
	).length;
	record(
		license.slug === config.id &&
			license.consentId === config.consentId &&
			license.revision.commitSha === source.revision.commitSha &&
			license.revision.rootTreeSha === source.revision.rootTreeSha &&
			license.revision.ref === source.revision.ref &&
			license.revision.repository === `${config.owner}/${config.repository}` &&
			license.inventory.licenceFilesInTree === licenceFiles &&
			license.inventory.committedNodeModules ===
				documents.treeRows.filter((row) => pathSegments(row.path).includes('node_modules'))
					.length &&
			license.inventory.committedDistDirectories ===
				documents.treeRows.filter((row) => pathSegments(row.path).includes('dist')).length,
		'licence inventory disagrees with the retained tree document',
		'licence-inventory',
	);
	for (const artifact of license.artifacts) {
		const row = documents.treeRows.find((candidate) => candidate.path === artifact.path);
		record(
			row !== undefined &&
				row.type === 'blob' &&
				row.sha === artifact.gitBlobSha &&
				lowerHex40.test(artifact.gitBlobSha) &&
				lowerHex64.test(artifact.sha256) &&
				artifact.bytes > 0 &&
				documents.probeLedger.some(
					(entry) =>
						entry.url === blobEndpoint(config, artifact.gitBlobSha) &&
						entry.status === 200,
				),
			`licence artifact is not bound to the recorded tree: ${artifact.path}`,
			`licence-artifact:${artifact.path}`,
		);
	}
	const rootLicence = license.artifacts.find(
		(artifact) => artifact.path === fixture.source.licensePath,
	);
	record(
		rootLicence !== undefined &&
			rootLicence.sha256 === fixture.source.licenseSha256 &&
			license.declaration.identifier === fixture.source.license &&
			license.declaration.frontendManifestLicenseField === fixture.source.license &&
			fixture.source.frontendRoot === config.frontendRoot,
		'licence digest disagrees with the fixture record',
		'licence-digest',
	);
	for (const entry of documents.probeLedger) {
		assertAllowedAcquisitionUrl(entry.url, config);
		ensure(
			entry.status === 200 && lowerHex64.test(entry.sha256) && entry.bytes > 0,
			`probe ledger entry is not an accepted response: ${entry.url}`,
		);
	}
	checks.push('probe-ledger-allowlisted');

	const install = baseline.steps[0];
	ensure(install !== undefined, 'baseline attempt records no install step');
	record(
		baseline.slug === config.id &&
			baseline.workRoot === workRootFor(config) &&
			isRelativePath(baseline.workRoot) &&
			baseline.cell.node.length > 0 &&
			baseline.cell.npm.length > 0 &&
			install!.name === 'install' &&
			install!.command === `npm ${config.legacyCell.installCommand.join(' ')}` &&
			baseline.steps.length === (install!.exitCode === 0 ? 2 : 1) &&
			(baseline.steps[1] === undefined ||
				(baseline.steps[1].name === 'build' &&
					baseline.steps[1].command ===
						`npm ${config.legacyCell.buildCommand.join(' ')}`)),
		'baseline attempt step plan differs from the declared legacy cell',
		'baseline-step-plan',
	);
	for (const step of baseline.steps)
		ensure(
			step.outcome === (step.exitCode === 0 ? 'succeeded' : 'failed') &&
				lowerHex64.test(step.stdoutSha256) &&
				lowerHex64.test(step.stderrSha256) &&
				step.stdoutBytes >= 0 &&
				step.stderrBytes >= 0 &&
				step.durationMs >= 0 &&
				!Number.isNaN(Date.parse(step.startedAt)),
			`baseline step shape differs: ${step.name}`,
		);
	record(
		baseline.outcome === baseline.steps.at(-1)?.outcome &&
			(baseline.artifacts === null ||
				(isRelativePath(baseline.artifacts.root) &&
					baseline.artifacts.root ===
						`${workRootFor(config)}/${config.legacyCell.buildOutputDirectory}` &&
					baseline.artifacts.files >= 0 &&
					baseline.artifacts.bytes >= 0 &&
					lowerHex64.test(baseline.artifacts.manifestSha256))),
		'baseline outcome or artifact record is inconsistent',
		'baseline-outcome',
	);
	record(
		isRelativePath(source.cache.root) &&
			source.cache.root === cacheRootFor(config) &&
			isRelativePath(source.cache.archive1) &&
			isRelativePath(source.cache.archive2) &&
			isRelativePath(source.cache.verifiedSource) &&
			isRelativePath(closure.source.verifiedSourceRoot),
		'evidence records a host-specific absolute path',
		'portable-paths',
	);

	const verified = {
		fixture: config.id,
		checks,
		commitSha: source.revision.commitSha,
		archiveSha256: archive!.sha256,
		normalizedManifestSha256: parity.normalizedManifestSha256,
		closureSha256: closure.closureSha256,
		licenceSha256: rootLicence!.sha256,
		baselineOutcome: baseline.outcome,
	};
	return {
		valid: true,
		fixture: config.id,
		checks,
		source: {
			commitSha: source.revision.commitSha,
			archiveSha256: archive!.sha256,
			acceptedResponses: source.transaction.acceptedResponses,
			regularFiles: parity.regularFiles,
		},
		closure: {
			lockedPlacements: closure.counts.lockedPlacements,
			distinctNameVersionPairs: closure.counts.distinctNameVersionPairs,
		},
		baseline: { outcome: baseline.outcome, steps: baseline.steps.length },
		digest: sha256(canonicalize(verified)),
	};
}

export async function verifyLegacyCandidateEvidence(
	config: LegacyCandidateConfig,
	options: { root?: string } = {},
): Promise<LegacyEvidenceVerification> {
	return verifyLegacyEvidence(config, await loadLegacyEvidence(config, options.root));
}
