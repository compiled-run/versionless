import { spawnSync } from 'node:child_process';
import { resolve } from 'pathe';
import { beforeAll, describe, expect, it } from 'vitest';
import { legacyCandidateConfig } from '../src/fixture/legacy-candidate-ingest.ts';
import {
	loadLegacyEvidence,
	verifyLegacyEvidence,
	type LegacyEvidenceDocuments,
} from '../src/fixture/legacy-candidate-verify.ts';

const root = resolve(import.meta.dirname, '../../..');
const papercups = legacyCandidateConfig('react-papercups-v1-0-0');

type DeepMutable<T> = T extends readonly (infer U)[]
	? DeepMutable<U>[]
	: T extends object
		? { -readonly [K in keyof T]: DeepMutable<T[K]> }
		: T;
type MutableEvidence = Omit<DeepMutable<LegacyEvidenceDocuments>, 'attemptBytes' | 'treeBytes'> &
	Pick<LegacyEvidenceDocuments, 'attemptBytes' | 'treeBytes'>;

let published: LegacyEvidenceDocuments;

beforeAll(async () => {
	published = await loadLegacyEvidence(papercups);
});

function mutated(edit: (documents: MutableEvidence) => void): LegacyEvidenceDocuments {
	const copy: MutableEvidence = {
		attemptBytes: published.attemptBytes,
		treeBytes: published.treeBytes,
		source: structuredClone(published.source) as DeepMutable<LegacyEvidenceDocuments['source']>,
		closure: structuredClone(published.closure) as DeepMutable<
			LegacyEvidenceDocuments['closure']
		>,
		license: structuredClone(published.license) as DeepMutable<
			LegacyEvidenceDocuments['license']
		>,
		baseline: structuredClone(published.baseline) as DeepMutable<
			LegacyEvidenceDocuments['baseline']
		>,
		fixture: structuredClone(published.fixture) as DeepMutable<
			LegacyEvidenceDocuments['fixture']
		>,
		treeRows: structuredClone(published.treeRows) as DeepMutable<
			LegacyEvidenceDocuments['treeRows']
		>,
		treeTruncated: published.treeTruncated,
		probeLedger: structuredClone(published.probeLedger) as DeepMutable<
			LegacyEvidenceDocuments['probeLedger']
		>,
	};
	edit(copy);
	return copy as unknown as LegacyEvidenceDocuments;
}

const rejects = (edit: (documents: MutableEvidence) => void, message: string): void => {
	expect(() => verifyLegacyEvidence(papercups, mutated(edit))).toThrow(message);
};

describe('legacy candidate evidence verification', () => {
	it('accepts the published papercups ingest evidence offline', () => {
		const verification = verifyLegacyEvidence(papercups, published);
		expect(verification.valid).toBe(true);
		expect(verification.fixture).toBe('react-papercups-v1-0-0');
		expect(verification.source).toEqual({
			commitSha: '3546a5f60c52fcc86fe9cbcc3bbac07356ba134f',
			archiveSha256: 'f8a6576c0399e1eca5e1936a9e5e5b311798cccf3cb7c6fcce0cecbf8b46ea8f',
			acceptedResponses: 6,
			regularFiles: 164,
		});
		expect(verification.closure).toEqual({
			lockedPlacements: 2001,
			distinctNameVersionPairs: 1647,
		});
		expect(verification.baseline).toEqual({ outcome: 'succeeded', steps: 2 });
		expect(verification.checks).toEqual(
			expect.arrayContaining([
				'attempt-document-recomputed',
				'attempt-digest-bound',
				'archive-streams-byte-identical',
				'archive-digest-fields',
				'blob-manifest-reconciliation',
				'closure-totals',
				'licence-digest',
				'baseline-step-plan',
				'portable-paths',
			]),
		);
		expect(verification.digest).toHaveLength(64);
		expect(verifyLegacyEvidence(papercups, published).digest).toBe(verification.digest);
	});

	it('refuses an attempt document that the configuration does not reproduce', () => {
		expect(() =>
			verifyLegacyEvidence(papercups, {
				...published,
				attemptBytes: Buffer.from('{}\n', 'utf8'),
			}),
		).toThrow('published acquisition attempt differs');
		rejects((documents) => {
			documents.source.attemptSha256 = 'a'.repeat(64);
		}, 'not bound to the published attempt');
	});

	it('refuses archive digest fields that disagree', () => {
		rejects((documents) => {
			documents.fixture.source.archiveSha256 = 'b'.repeat(64);
		}, 'archive digest fields disagree');
		rejects((documents) => {
			const stream = documents.source.requests.find((request) => request.stream === 2);
			if (stream) stream.sha256 = 'c'.repeat(64);
		}, 'not byte-identical');
		rejects((documents) => {
			documents.source.transaction.acceptedWireBytes += 1;
		}, 'transaction totals disagree');
	});

	it('refuses blob-manifest counts that do not close', () => {
		rejects((documents) => {
			documents.source.archiveParity.gitBlobs += 1;
		}, 'blob-manifest reconciliation counts do not close');
		rejects((documents) => {
			documents.source.archiveParity.mismatchedBlobs = 1;
		}, 'blob-manifest reconciliation counts do not close');
		rejects((documents) => {
			documents.source.revision.treeBlobs += 1;
		}, 'recorded tree counts differ');
		rejects((documents) => {
			documents.fixture.source.normalizedManifestSha256 = 'd'.repeat(64);
		}, 'normalized archive manifest identity disagrees');
	});

	it('refuses closure totals that contradict the recorded placements', () => {
		rejects((documents) => {
			documents.closure.counts.lockedPlacements += 1;
		}, 'closure totals do not close');
		rejects((documents) => {
			documents.closure.lockState.everyEntryHasIntegrityHash = false;
		}, 'closure lock state contradicts');
		rejects((documents) => {
			documents.fixture.lockState.distinctNameVersionPairs += 1;
		}, 'closure record disagrees with the fixture lock state');
	});

	it('refuses licence digests that are not bound to the recorded tree', () => {
		rejects((documents) => {
			const artifact = documents.license.artifacts[0];
			if (artifact) artifact.gitBlobSha = 'e'.repeat(40);
		}, 'licence artifact is not bound to the recorded tree');
		rejects((documents) => {
			documents.fixture.source.licenseSha256 = 'f'.repeat(64);
		}, 'licence digest disagrees');
		rejects((documents) => {
			documents.license.inventory.licenceFilesInTree += 1;
		}, 'licence inventory disagrees');
	});

	it('refuses a baseline attempt whose shape contradicts the declared cell', () => {
		rejects((documents) => {
			const install = documents.baseline.steps[0];
			if (install) install.exitCode = 1;
		}, 'baseline attempt step plan differs');
		rejects((documents) => {
			const install = documents.baseline.steps[0];
			if (install) install.outcome = 'failed';
		}, 'baseline step shape differs');
		rejects((documents) => {
			documents.baseline.outcome = 'failed';
		}, 'baseline outcome or artifact record is inconsistent');
	});

	it('refuses host-specific absolute paths in the published evidence', () => {
		rejects((documents) => {
			documents.source.cache.verifiedSource = '/Users/someone/cache/extracted';
		}, 'host-specific absolute path');
	});
});

describe('legacy candidate evidence verification CLI', () => {
	it('verifies the papercups ingest evidence offline', () => {
		const result = spawnSync(
			process.execPath,
			[
				'--experimental-strip-types',
				'packages/cli/src/cli.ts',
				'fixture:verify',
				'--fixture',
				'react-papercups-v1-0-0',
				'--offline',
			],
			{
				cwd: root,
				encoding: 'utf8',
				env: {
					...process.env,
					VERSIONLESS_NETWORK_MODE: 'offline',
					NPM_CONFIG_OFFLINE: 'true',
				},
			},
		);
		expect(result.status).toBe(0);
		expect(JSON.parse(result.stdout)).toMatchObject({
			result: 'pass',
			fixture: 'react-papercups-v1-0-0',
		});
	});

	it('refuses to verify without explicit offline mode', () => {
		const result = spawnSync(
			process.execPath,
			[
				'--experimental-strip-types',
				'packages/cli/src/cli.ts',
				'fixture:verify',
				'--fixture',
				'react-papercups-v1-0-0',
			],
			{ cwd: root, encoding: 'utf8', env: { ...process.env, VERSIONLESS_NETWORK_MODE: '' } },
		);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('requires --offline');
	});
});
