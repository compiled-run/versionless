/**
 * The generic admission path.
 *
 * The claim under test is narrow and mechanical: an application this pipeline
 * has never seen can be admitted with no per-application source file and no
 * entry in any allowlist, and the record that comes out is the record the
 * hand-written modules publish — not a differently shaped approximation of one.
 *
 * The sealed evidence is the oracle. `evidence/ingests/react-papercups-v1-0-0/license.json`
 * is a hand-authored `versionless.legacy-corpus-rights.v1` document, and it
 * records the digests of the licence file it was written from. That is enough to
 * rebuild the licence bytes from the record's own fields and check that the
 * generic stage reads them back to the same digests, the same clause readings
 * and the same declaration — without copying the sealed record's answers into
 * this file and without depending on any tree that is not committed.
 */

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import { sha256 } from '../../core/src/receipts/canonicalize.ts';
import { isLegacyCandidateId, legacyCandidates } from '../src/fixture/legacy-candidate-ingest.ts';
import { runOperatorCommand } from '../src/operator/flows.ts';
import {
	acquisitionLaneOf,
	DEFAULT_INGEST_DECLARATIONS,
	INGEST_RECORD_SCHEMA,
	ingestApplicationSource,
	readGitRevision,
	type IngestDeclarations,
} from '../src/operator/ingest.ts';
import {
	licenceIdentifierOf,
	readLicenceAtPin,
	DEFAULT_LICENCE_POLICY,
} from '../src/operator/license.ts';
import { EXIT_PROCEEDED, EXIT_REFUSAL, pipelineRefusalOf } from '../src/operator/refusals.ts';

const PAPERCUPS_SEALED_LICENCE = 'evidence/ingests/react-papercups-v1-0-0/license.json';
const PAPERCUPS_SEALED_CLOSURE = 'evidence/ingests/react-papercups-v1-0-0/closure.json';
const PAPERCUPS_SEALED_SOURCE = 'evidence/ingests/react-papercups-v1-0-0/source.json';

/** The pinned source the sealed records were derived from, if it is on disk. */
const PAPERCUPS_PINNED_SOURCE =
	'.versionless/cache/react-papercups-v1-0-0-source/verify/extracted/papercups-3546a5f60c52fcc86fe9cbcc3bbac07356ba134f';

type SealedLicence = {
	declaration: {
		identifier: string;
		identifierSource: string;
		copyrightNotice: string;
		frontendManifestLicenseField: string;
	};
	artifacts: ReadonlyArray<Record<string, unknown>>;
};

const readSealed = async <T>(file: string): Promise<T> =>
	JSON.parse(await readFile(file, 'utf8')) as T;

async function temporaryDirectory(): Promise<string> {
	return mkdtemp(path.join(tmpdir(), 'versionless-ingest-'));
}

/**
 * The canonical MIT text, parameterised by its copyright line.
 *
 * Nothing is copied from the sealed record here — the copyright line is read
 * out of it at run time and the rest is the licence's own canonical wording. If
 * the bytes this composes do not digest to the digests the sealed record
 * carries, the first assertion in the first test fails and the equivalence
 * claim below it is never made.
 */
function mitLicenceText(copyrightNotice: string): string {
	return [
		'MIT License',
		'',
		copyrightNotice,
		'',
		'Permission is hereby granted, free of charge, to any person obtaining a copy',
		'of this software and associated documentation files (the "Software"), to deal',
		'in the Software without restriction, including without limitation the rights',
		'to use, copy, modify, merge, publish, distribute, sublicense, and/or sell',
		'copies of the Software, and to permit persons to whom the Software is',
		'furnished to do so, subject to the following conditions:',
		'',
		'The above copyright notice and this permission notice shall be included in all',
		'copies or substantial portions of the Software.',
		'',
		'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR',
		'IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,',
		'FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE',
		'AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER',
		'LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,',
		'OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE',
		'SOFTWARE.',
		'',
	].join('\n');
}

const gitBlob = (bytes: Buffer): string =>
	createHash('sha1')
		.update(Buffer.from(`blob ${String(bytes.byteLength)}\0`))
		.update(bytes)
		.digest('hex');

/** A minimal npm lockfile whose closure the reading can walk. */
const LOCKFILE = {
	name: 'papercups-ui',
	lockfileVersion: 1,
	requires: true,
	dependencies: {
		react: {
			version: '16.13.1',
			resolved: 'https://registry.npmjs.org/react/-/react-16.13.1.tgz',
			integrity: 'sha512-react',
		},
		'react-scripts': {
			version: '3.4.1',
			resolved: 'https://registry.npmjs.org/react-scripts/-/react-scripts-3.4.1.tgz',
			integrity: 'sha512-scripts',
			dev: true,
		},
	},
};

const declare = (overrides: Partial<IngestDeclarations>): IngestDeclarations =>
	Object.freeze({ ...DEFAULT_INGEST_DECLARATIONS, ...overrides });

const PINNED_REVISION = '3546a5f60c52fcc86fe9cbcc3bbac07356ba134f';

/**
 * A source root shaped like the sealed application: a repository-root licence
 * and a frontend in a subdirectory the stage has to find for itself.
 */
async function writeSource(
	root: string,
	options: {
		licenceText?: string | null;
		frontend?: string;
		manifest?: Record<string, unknown>;
		lockfile?: unknown;
		extraFrontend?: string;
		extraFrontendManifest?: Record<string, unknown>;
	} = {},
): Promise<void> {
	const frontend = options.frontend ?? 'assets';
	await mkdir(path.join(root, frontend, 'public'), { recursive: true });
	await mkdir(path.join(root, frontend, 'src'), { recursive: true });
	/** The two files the frozen create-react-app adapter admits a tree on. */
	await writeFile(
		path.join(root, frontend, 'public', 'index.html'),
		'<!DOCTYPE html>\n<html><head><title>t</title></head><body><div id="root"></div></body></html>\n',
	);
	await writeFile(path.join(root, frontend, 'src', 'index.js'), 'export const main = 1;\n');
	if (options.licenceText !== null)
		await writeFile(
			path.join(root, 'LICENSE'),
			options.licenceText ?? mitLicenceText('Copyright (c) 2020 Papercups'),
		);
	await writeFile(
		path.join(root, frontend, 'package.json'),
		`${JSON.stringify(
			options.manifest ?? {
				name: 'papercups-ui',
				private: true,
				license: 'MIT',
				dependencies: { react: '^16.13.1', 'react-scripts': '3.4.1' },
			},
			null,
			2,
		)}\n`,
	);
	if (options.lockfile !== null)
		await writeFile(
			path.join(root, frontend, 'package-lock.json'),
			`${JSON.stringify(options.lockfile ?? LOCKFILE, null, 2)}\n`,
		);
	if (options.extraFrontend !== undefined) {
		await mkdir(path.join(root, options.extraFrontend), { recursive: true });
		await writeFile(
			path.join(root, options.extraFrontend, 'package.json'),
			`${JSON.stringify(options.extraFrontendManifest ?? { name: 'second' }, null, 2)}\n`,
		);
	}
}

/** The refusal an awaited call raised, or `null` when it did not refuse. */
async function refusalOf(
	run: () => Promise<unknown>,
): Promise<ReturnType<typeof pipelineRefusalOf>> {
	try {
		await run();
		return null;
	} catch (error) {
		const refusal = pipelineRefusalOf(error);
		if (refusal === null) throw error;
		return refusal;
	}
}

/**
 * A workspace shaped the way `acquire` leaves one: the tree under
 * `.versionless/work/<id>/baseline`, and the consent-journalled acquisition
 * receipt beside it under `evidence/ingests/<id>/source.json`.
 */
async function writeAcquiredLane(
	workspace: string,
	id: string,
	journal: (digest: string) => Record<string, unknown> | null,
): Promise<string> {
	const baseline = path.join(workspace, '.versionless', 'work', id, 'baseline');
	await mkdir(baseline, { recursive: true });
	await writeSource(baseline);
	/** The digest the journal has to carry is the one this tree walks to. */
	const walked = await ingestApplicationSource(baseline, declare({ revision: PINNED_REVISION }));
	const document = journal(walked.tree?.normalizedManifestSha256 ?? '');
	if (document !== null) {
		await mkdir(path.join(workspace, 'evidence', 'ingests', id), { recursive: true });
		await writeFile(
			path.join(workspace, 'evidence', 'ingests', id, 'source.json'),
			`${JSON.stringify(document, null, '\t')}\n`,
		);
	}
	return baseline;
}

const ACQUIRED_REVISION = '645d6ed4fd27c6fab55cbf64d2fb2995018bddcb';

const sourceBoundJournal = (digest: string): Record<string, unknown> => ({
	schemaVersion: 'versionless.official-source.v1',
	consentId: 'VL-LEGACY-CORPUS-2026-08-10',
	result: 'source-bound',
	revision: { ref: 'refs/tags/v5.2.0', commitSha: ACQUIRED_REVISION },
	archiveParity: { normalizedManifestSha256: digest },
	transaction: { archivesByteIdentical: true, archiveMatchesGitTree: true },
});

describe('operator ingest — the pin comes from the pipeline’s own acquisition journal', () => {
	it('reads the revision the consent-journalled acquisition pinned, and records the basis', async () => {
		const workspace = await temporaryDirectory();
		try {
			const baseline = await writeAcquiredLane(workspace, 'react-widget-v1', (digest) =>
				sourceBoundJournal(digest),
			);
			const record = await ingestApplicationSource(baseline, DEFAULT_INGEST_DECLARATIONS);
			expect(record.pin?.commitSha).toBe(ACQUIRED_REVISION);
			/** A reading, not a declaration: nobody typed this sha at the seam. */
			expect(record.pin?.commitShaSource).toBe('read');
			const readFrom = record.pin?.commitShaReadFrom ?? '';
			expect(readFrom).toContain('evidence/ingests/react-widget-v1/source.json');
			expect(readFrom).toContain('VL-LEGACY-CORPUS-2026-08-10');
			expect(readFrom).toContain('source-bound');
			expect(readFrom).toContain(record.tree?.normalizedManifestSha256 ?? 'no digest');
		} finally {
			await rm(workspace, { recursive: true, force: true });
		}
	});

	it('refuses a journal whose transaction did not bind a source', async () => {
		const workspace = await temporaryDirectory();
		try {
			const baseline = await writeAcquiredLane(workspace, 'react-widget-v1', (digest) => ({
				...sourceBoundJournal(digest),
				result: 'refused',
			}));
			const refusal = await refusalOf(() =>
				ingestApplicationSource(baseline, DEFAULT_INGEST_DECLARATIONS),
			);
			expect(refusal?.code).toBe('ingest.acquisition-journal-not-source-bound');
			expect(refusal?.stage).toBe('ingest');
			expect(refusal?.message).toContain('refused');
		} finally {
			await rm(workspace, { recursive: true, force: true });
		}
	});

	it('refuses a journal carrying no consent identifier', async () => {
		const workspace = await temporaryDirectory();
		try {
			const baseline = await writeAcquiredLane(workspace, 'react-widget-v1', (digest) => {
				const { consentId: _dropped, ...rest } = sourceBoundJournal(digest);
				return rest;
			});
			const refusal = await refusalOf(() =>
				ingestApplicationSource(baseline, DEFAULT_INGEST_DECLARATIONS),
			);
			expect(refusal?.code).toBe('ingest.acquisition-journal-carries-no-consent');
		} finally {
			await rm(workspace, { recursive: true, force: true });
		}
	});

	it('refuses a journal that reconciled no archive against the published Git tree', async () => {
		const workspace = await temporaryDirectory();
		try {
			const baseline = await writeAcquiredLane(workspace, 'react-widget-v1', (digest) => ({
				...sourceBoundJournal(digest),
				transaction: { archivesByteIdentical: true, archiveMatchesGitTree: false },
			}));
			const refusal = await refusalOf(() =>
				ingestApplicationSource(baseline, DEFAULT_INGEST_DECLARATIONS),
			);
			expect(refusal?.code).toBe('ingest.acquisition-journal-carries-no-parity-basis');
		} finally {
			await rm(workspace, { recursive: true, force: true });
		}
	});

	it('refuses a journal whose manifest digest is not this tree’s', async () => {
		const workspace = await temporaryDirectory();
		try {
			const baseline = await writeAcquiredLane(workspace, 'react-widget-v1', () =>
				sourceBoundJournal(
					'0000000000000000000000000000000000000000000000000000000000000000',
				),
			);
			const refusal = await refusalOf(() =>
				ingestApplicationSource(baseline, DEFAULT_INGEST_DECLARATIONS),
			);
			expect(refusal?.code).toBe('ingest.acquisition-journal-does-not-match-the-tree');
			expect(refusal?.message).toContain('--revision');
		} finally {
			await rm(workspace, { recursive: true, force: true });
		}
	});

	it('refuses a lane with no journal at all, as it did before', async () => {
		const workspace = await temporaryDirectory();
		try {
			const baseline = await writeAcquiredLane(workspace, 'react-widget-v1', () => null);
			const refusal = await refusalOf(() =>
				ingestApplicationSource(baseline, DEFAULT_INGEST_DECLARATIONS),
			);
			expect(refusal?.code).toBe('ingest.revision-not-determined');
		} finally {
			await rm(workspace, { recursive: true, force: true });
		}
	});

	it('reads the checkout’s own Git metadata when it has some, and consults no journal', async () => {
		const workspace = await temporaryDirectory();
		try {
			const baseline = await writeAcquiredLane(workspace, 'react-widget-v1', (digest) =>
				sourceBoundJournal(digest),
			);
			await mkdir(path.join(baseline, '.git'), { recursive: true });
			await writeFile(path.join(baseline, '.git', 'HEAD'), `${PINNED_REVISION}\n`);
			const record = await ingestApplicationSource(baseline, DEFAULT_INGEST_DECLARATIONS);
			expect(record.pin?.commitSha).toBe(PINNED_REVISION);
			expect(record.pin?.commitShaReadFrom).toBe('.git/HEAD');
		} finally {
			await rm(workspace, { recursive: true, force: true });
		}
	});
});

/**
 * The repository and the ref, out of the same reading that produced the sha.
 *
 * The claim under test is that a pin is one reading of one document rather than
 * three separately-sourced values: the transaction that reconciled these bytes
 * against a published Git tree named the repository it read that tree from and
 * the ref it resolved the commit through, so the three fields are adopted
 * together, carry the same basis string, and are refused together. Two
 * asymmetries are asserted alongside it — a declaration wins and then carries no
 * basis, because a basis is what a reading has and a declaration does not; and
 * a journal that fails any one of the four gates yields none of the three, so
 * there is no state in which the sha is refused and the repository survives.
 */
describe('operator ingest — repository, ref and sha are one journal reading', () => {
	const ACQUIRED_REPOSITORY = 'pawelmalak/flame';
	const ACQUIRED_REF = 'refs/tags/v5.2.0';

	/** The journal `acquire` writes, with the repository field it records. */
	const journalWithRepository = (digest: string): Record<string, unknown> => ({
		...sourceBoundJournal(digest),
		repository: { fullName: ACQUIRED_REPOSITORY },
	});

	it('carries all three off one journal, each with its own basis field', async () => {
		const workspace = await temporaryDirectory();
		try {
			const baseline = await writeAcquiredLane(workspace, 'react-widget-v1', (digest) =>
				journalWithRepository(digest),
			);
			const record = await ingestApplicationSource(baseline, DEFAULT_INGEST_DECLARATIONS);
			expect(record.pin?.repository).toBe(ACQUIRED_REPOSITORY);
			expect(record.pin?.ref).toBe(ACQUIRED_REF);
			expect(record.pin?.commitSha).toBe(ACQUIRED_REVISION);
			expect(record.pin?.commitShaSource).toBe('read');
			/**
			 * One reading, so one basis string — and it is present on all three
			 * rather than on the sha alone, which is what makes the repository a
			 * read value in the record rather than an unattributed one.
			 */
			const basis = record.pin?.commitShaReadFrom ?? '';
			expect(basis).toContain('evidence/ingests/react-widget-v1/source.json');
			expect(record.pin?.repositoryReadFrom).toBe(basis);
			expect(record.pin?.refReadFrom).toBe(basis);
		} finally {
			await rm(workspace, { recursive: true, force: true });
		}
	});

	it('lets a declared repository and ref win, and then records no basis for them', async () => {
		const workspace = await temporaryDirectory();
		try {
			const baseline = await writeAcquiredLane(workspace, 'react-widget-v1', (digest) =>
				journalWithRepository(digest),
			);
			const record = await ingestApplicationSource(
				baseline,
				declare({ repository: 'acme/widget', ref: 'refs/heads/main' }),
			);
			expect(record.pin?.repository).toBe('acme/widget');
			expect(record.pin?.ref).toBe('refs/heads/main');
			/** A declaration is not a reading, so neither carries a read basis. */
			expect(record.pin?.repositoryReadFrom).toBeNull();
			expect(record.pin?.refReadFrom).toBeNull();
			/** The sha was not declared, so it is still the journal's, with its basis. */
			expect(record.pin?.commitSha).toBe(ACQUIRED_REVISION);
			expect(record.pin?.commitShaSource).toBe('read');
			expect(record.pin?.commitShaReadFrom).toContain(
				'evidence/ingests/react-widget-v1/source.json',
			);
		} finally {
			await rm(workspace, { recursive: true, force: true });
		}
	});

	/** The four gates, each with a journal that carries a repository and a ref. */
	const gateFailures: ReadonlyArray<
		readonly [string, (digest: string) => Record<string, unknown>, string]
	> = [
		[
			'a transaction that did not bind a source',
			(digest) => ({ ...journalWithRepository(digest), result: 'refused' }),
			'ingest.acquisition-journal-not-source-bound',
		],
		[
			'no consent identifier',
			(digest) => {
				const { consentId: _dropped, ...rest } = journalWithRepository(digest);
				return rest;
			},
			'ingest.acquisition-journal-carries-no-consent',
		],
		[
			'no parity basis',
			(digest) => ({
				...journalWithRepository(digest),
				transaction: { archivesByteIdentical: true, archiveMatchesGitTree: false },
			}),
			'ingest.acquisition-journal-carries-no-parity-basis',
		],
		[
			'a manifest digest that is not this tree’s',
			() =>
				journalWithRepository(
					'0000000000000000000000000000000000000000000000000000000000000000',
				),
			'ingest.acquisition-journal-does-not-match-the-tree',
		],
	];

	for (const [description, journal, code] of gateFailures)
		it(`adopts none of the three from a journal with ${description}`, async () => {
			const workspace = await temporaryDirectory();
			try {
				const baseline = await writeAcquiredLane(workspace, 'react-widget-v1', journal);
				const refusal = await refusalOf(() =>
					ingestApplicationSource(baseline, DEFAULT_INGEST_DECLARATIONS),
				);
				expect(refusal?.code).toBe(code);
				expect(refusal?.stage).toBe('ingest');
				/**
				 * There is no record, so there is no pin — the repository and the
				 * ref are not adopted from a journal whose sha was refused, and
				 * the stage does not emit a half-read pin for a later stage to
				 * treat as provenance.
				 */
				const record = await ingestApplicationSource(
					baseline,
					declare({ revision: PINNED_REVISION }),
				).catch(() => null);
				expect(record?.pin?.repository ?? null).toBeNull();
				expect(record?.pin?.ref ?? null).toBeNull();
			} finally {
				await rm(workspace, { recursive: true, force: true });
			}
		});
});

/**
 * A lane shaped the way an acquired monorepo is: one acquired tree, whose
 * repository root carries a server manifest and whose frontend sits under
 * `client/`. The unit of provenance and the unit of composition are two
 * different directories here, which is the whole point of the fixture.
 */
async function writeAcquiredMonorepoLane(
	workspace: string,
	id: string,
	options: {
		frontendManifest?: Record<string, unknown>;
		journal?: (digest: string) => Record<string, unknown>;
	} = {},
): Promise<string> {
	const baseline = path.join(workspace, '.versionless', 'work', id, 'baseline');
	await mkdir(baseline, { recursive: true });
	await writeSource(baseline, {
		frontend: 'client',
		...(options.frontendManifest === undefined ? {} : { manifest: options.frontendManifest }),
	});
	/** The repository root is an Express server, and it is not the frontend. */
	await writeFile(
		path.join(baseline, 'package.json'),
		`${JSON.stringify({ name: 'flame', dependencies: { express: '^4.17.1' } }, null, 2)}\n`,
	);
	/** The licence sits in both, so ingesting either root reads one. */
	await writeFile(
		path.join(baseline, 'client', 'LICENSE'),
		mitLicenceText('Copyright (c) 2020 Papercups'),
	);
	const walked = await ingestApplicationSource(
		baseline,
		declare({ revision: PINNED_REVISION, id: 'digest-probe' }),
	);
	const document = (options.journal ?? sourceBoundJournal)(
		walked.tree?.normalizedManifestSha256 ?? '',
	);
	document.baseline = `.versionless/work/${id}/baseline`;
	await mkdir(path.join(workspace, 'evidence', 'ingests', id), { recursive: true });
	await writeFile(
		path.join(workspace, 'evidence', 'ingests', id, 'source.json'),
		`${JSON.stringify(document, null, '\t')}\n`,
	);
	return baseline;
}

describe('operator ingest — the acquisition root and the frontend root are two readings', () => {
	it('walks up to the enclosing acquisition baseline and gates on that tree’s digest', () => {
		const lane = acquisitionLaneOf('/w/.versionless/work/react-flame-v2-4-0/baseline/client');
		expect(lane?.laneId).toBe('react-flame-v2-4-0');
		expect(lane?.acquisitionRoot).toBe('/w/.versionless/work/react-flame-v2-4-0/baseline');
		expect(lane?.subPath).toBe('client');
		expect(acquisitionLaneOf('/w/.versionless/work/react-flame-v2-4-0/baseline')?.subPath).toBe(
			'.',
		);
		expect(acquisitionLaneOf('/w/some/checkout')).toBeNull();
	});

	it('reads the pin from the journal when the ingested root is a subpath of the acquired tree', async () => {
		const workspace = await temporaryDirectory();
		try {
			const baseline = await writeAcquiredMonorepoLane(workspace, 'react-flame-v2-4-0');
			const record = await ingestApplicationSource(
				path.join(baseline, 'client'),
				DEFAULT_INGEST_DECLARATIONS,
			);
			expect(record.pin?.commitSha).toBe(ACQUIRED_REVISION);
			expect(record.pin?.commitShaSource).toBe('read');
			/** The record states the relationship rather than implying it. */
			expect(record.pin?.commitShaReadFrom).toContain('enclosing acquisition tree');
			expect(record.pin?.commitShaReadFrom).toContain('client is a subpath of that tree');
		} finally {
			await rm(workspace, { recursive: true, force: true });
		}
	});

	it('refuses when the enclosing acquisition tree is not the tree the journal is about', async () => {
		const workspace = await temporaryDirectory();
		try {
			const baseline = await writeAcquiredMonorepoLane(workspace, 'react-flame-v2-4-0', {
				journal: () => sourceBoundJournal('0'.repeat(64)),
			});
			const refusal = await refusalOf(() =>
				ingestApplicationSource(path.join(baseline, 'client'), DEFAULT_INGEST_DECLARATIONS),
			);
			expect(refusal?.code).toBe('ingest.acquisition-journal-does-not-match-the-tree');
			expect(refusal?.message).toContain('enclosing acquisition tree');
		} finally {
			await rm(workspace, { recursive: true, force: true });
		}
	});

	it('reads the frontend root by lineage, never by position, and records every candidate', async () => {
		const workspace = await temporaryDirectory();
		try {
			const baseline = await writeAcquiredMonorepoLane(workspace, 'react-flame-v2-4-0');
			const record = await ingestApplicationSource(baseline, DEFAULT_INGEST_DECLARATIONS);
			expect(record.frontendRoot).toBe('client');
			expect(record.frontendRootSource).toBe('read');
			expect(record.frontendRootBasis).toContain('. declares no framework this stage reads');
			expect(record.frontendRootBasis).toContain('client declares react ^16.13.1');
			expect(record.detected?.lineage).toBe('react');
			expect(record.acquisitionRoot).toBe(baseline);
		} finally {
			await rm(workspace, { recursive: true, force: true });
		}
	});

	it('reads the identifier the operator declared at acquire time when the manifest declares none', async () => {
		const workspace = await temporaryDirectory();
		try {
			const baseline = await writeAcquiredMonorepoLane(workspace, 'react-flame-v2-4-0', {
				frontendManifest: {
					private: true,
					license: 'MIT',
					dependencies: { react: '^16.13.1', 'react-scripts': '3.4.1' },
				},
			});
			const record = await ingestApplicationSource(baseline, DEFAULT_INGEST_DECLARATIONS);
			expect(record.id).toBe('react-flame-v2-4-0');
			expect(record.idSource).toBe('read');
			expect(record.idReadFrom).toContain('evidence/ingests/react-flame-v2-4-0/source.json');
			expect(record.idReadFrom).toContain(
				'declared by an operator with --id at acquire time',
			);
			expect(record.idReadFrom).toContain('declares no name and this stage read none');
		} finally {
			await rm(workspace, { recursive: true, force: true });
		}
	});

	it('refuses the identifier when the journal carries no parity basis for these bytes', async () => {
		const workspace = await temporaryDirectory();
		try {
			const baseline = await writeAcquiredMonorepoLane(workspace, 'react-flame-v2-4-0', {
				frontendManifest: {
					private: true,
					license: 'MIT',
					dependencies: { react: '^16.13.1', 'react-scripts': '3.4.1' },
				},
				journal: (digest) => ({
					...sourceBoundJournal(digest),
					transaction: { archivesByteIdentical: true, archiveMatchesGitTree: false },
				}),
			});
			const refusal = await refusalOf(() =>
				ingestApplicationSource(baseline, DEFAULT_INGEST_DECLARATIONS),
			);
			expect(refusal?.code).toBe('ingest.identifier-not-determined');
			expect(refusal?.message).toContain('--id');
		} finally {
			await rm(workspace, { recursive: true, force: true });
		}
	});
});

describe('operator ingest — admission without a per-application file', () => {
	it('admits an application no allowlist carries, reading its identity and frontend root', async () => {
		const root = await temporaryDirectory();
		try {
			await writeSource(root);
			const record = await ingestApplicationSource(
				root,
				declare({ revision: PINNED_REVISION }),
			);
			expect(record.schemaVersion).toBe(INGEST_RECORD_SCHEMA);
			expect(record.ran).toBe(true);
			/** Read out of the manifest, not taken from the directory name. */
			expect(record.id).toBe('papercups-ui');
			expect(record.idSource).toBe('read');
			expect(record.frontendRoot).toBe('assets');
			expect(record.frontendRootSource).toBe('read');
			expect(record.pin?.commitSha).toBe(PINNED_REVISION);
			expect(record.pin?.commitShaSource).toBe('declared');
			expect(record.detected?.lineage).toBe('react');
			expect(record.detected?.builder).toBe('react-scripts');
			/**
			 * The point of the unit, stated as an assertion: the application this
			 * stage just admitted is not in `legacyCandidates`, and admission did
			 * not ask whether it was.
			 */
			expect(isLegacyCandidateId(record.id ?? '')).toBe(false);
			expect(legacyCandidates.some((candidate) => candidate.id === record.id)).toBe(false);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it('reads the pinned revision out of the checkout when none is declared', async () => {
		const root = await temporaryDirectory();
		try {
			await writeSource(root);
			await mkdir(path.join(root, '.git', 'refs', 'heads'), { recursive: true });
			await writeFile(path.join(root, '.git', 'HEAD'), 'ref: refs/heads/main\n');
			await writeFile(
				path.join(root, '.git', 'refs', 'heads', 'main'),
				`${PINNED_REVISION}\n`,
			);
			expect(await readGitRevision(root)).toEqual({
				commitSha: PINNED_REVISION,
				readFrom: '.git/refs/heads/main',
			});
			const record = await ingestApplicationSource(root, DEFAULT_INGEST_DECLARATIONS);
			expect(record.pin?.commitSha).toBe(PINNED_REVISION);
			expect(record.pin?.commitShaSource).toBe('read');
			expect(record.pin?.commitShaReadFrom).toBe('.git/refs/heads/main');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});

describe('operator ingest — equivalence with the sealed hand-written record', () => {
	/**
	 * The licence half, proven byte-for-byte and without any tree that is not
	 * committed: the licence bytes are rebuilt from the sealed record's own
	 * copyright line, checked against the sealed digests, and then read back by
	 * the generic stage.
	 */
	it('reproduces the sealed papercups licence record from the pinned licence text', async () => {
		const sealed = await readSealed<SealedLicence>(PAPERCUPS_SEALED_LICENCE);
		const artifact = sealed.artifacts[0] as Record<string, unknown>;
		const bytes = Buffer.from(mitLicenceText(sealed.declaration.copyrightNotice), 'utf8');
		/** If this fails, the composed bytes are not the sealed ones and nothing below means anything. */
		expect(sha256(bytes)).toBe(artifact.sha256);
		expect(gitBlob(bytes)).toBe(artifact.gitBlobSha);
		expect(bytes.byteLength).toBe(artifact.bytes);

		const root = await temporaryDirectory();
		try {
			await writeSource(root, { licenceText: bytes.toString('utf8') });
			const record = await ingestApplicationSource(
				root,
				declare({ id: 'react-papercups-v1-0-0', revision: PINNED_REVISION }),
			);
			const licence = record.licence;
			expect(licence?.identifier).toBe(sealed.declaration.identifier);
			expect(licence?.identifierSource).toBe('observed');
			expect(licence?.identifierBasis).toBe(sealed.declaration.identifierSource);
			expect(licence?.copyrightNotice).toBe(sealed.declaration.copyrightNotice);
			expect(licence?.manifestLicenseField).toBe(
				sealed.declaration.frontendManifestLicenseField,
			);
			const derived = licence?.artifacts[0];
			for (const key of [
				'path',
				'role',
				'gitBlobSha',
				'bytes',
				'sha256',
				'firstLine',
				'permissionGrantPresent',
				'noticeRetentionClausePresent',
				'warrantyDisclaimerPresent',
			] as const)
				expect([key, (derived as Record<string, unknown>)[key]]).toEqual([
					key,
					artifact[key],
				]);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it('emits the closure in the schema the sealed closure record carries', async () => {
		const sealed = await readSealed<Record<string, unknown>>(PAPERCUPS_SEALED_CLOSURE);
		const root = await temporaryDirectory();
		try {
			await writeSource(root);
			const record = await ingestApplicationSource(
				root,
				declare({ id: 'react-papercups-v1-0-0', revision: PINNED_REVISION }),
			);
			const closure = record.closure as unknown as Record<string, unknown>;
			expect(closure).not.toBeNull();
			expect(closure.schemaVersion).toBe(sealed.schemaVersion);
			expect(Object.keys(closure).sort()).toEqual(Object.keys(sealed).sort());
			expect(Object.keys(closure.lockState as object).sort()).toEqual(
				Object.keys(sealed.lockState as object).sort(),
			);
			expect(Object.keys(closure.counts as object).sort()).toEqual(
				Object.keys(sealed.counts as object).sort(),
			);
			expect(closure.slug).toBe('react-papercups-v1-0-0');
			expect(closure.frontendRoot).toBe('assets');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	/**
	 * The whole-record equivalence, against the pinned source the sealed records
	 * were derived from. That source is a cache the checkout does not carry, so
	 * this runs where it is present and states its absence rather than passing
	 * quietly on nothing.
	 */
	it.skipIf(!existsSync(PAPERCUPS_PINNED_SOURCE))(
		'derives the sealed closure and tree digests from the pinned source itself',
		async () => {
			const sealedClosure =
				await readSealed<Record<string, unknown>>(PAPERCUPS_SEALED_CLOSURE);
			const sealedSource = await readSealed<{
				archiveParity: { normalizedManifestSha256: string; regularFiles: number };
			}>(PAPERCUPS_SEALED_SOURCE);
			const record = await ingestApplicationSource(
				PAPERCUPS_PINNED_SOURCE,
				declare({ id: 'react-papercups-v1-0-0', revision: PINNED_REVISION }),
			);
			expect(record.frontendRoot).toBe('assets');
			expect(record.frontendRootSource).toBe('read');
			expect(record.tree?.normalizedManifestSha256).toBe(
				sealedSource.archiveParity.normalizedManifestSha256,
			);
			expect(record.tree?.files).toBe(sealedSource.archiveParity.regularFiles);
			const closure = record.closure as unknown as Record<string, unknown>;
			/** Every field but the host path the record was written from. */
			expect({
				...closure,
				source: { ...(closure.source as object), verifiedSourceRoot: '' },
			}).toEqual({
				...sealedClosure,
				source: { ...(sealedClosure.source as object), verifiedSourceRoot: '' },
			});
		},
	);
});

describe('operator ingest — a value it cannot read is a named refusal', () => {
	it('refuses a source whose revision it cannot read and nobody declared', async () => {
		const root = await temporaryDirectory();
		try {
			await writeSource(root);
			const refusal = await refusalOf(() =>
				ingestApplicationSource(root, DEFAULT_INGEST_DECLARATIONS),
			);
			expect(refusal?.code).toBe('ingest.revision-not-determined');
			expect(refusal?.stage).toBe('ingest');
			expect(refusal?.origin).toBe('pipeline');
			expect(refusal?.message).toContain('--revision');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it('refuses two frontend roots that both declare a lineage rather than picking the first', async () => {
		const root = await temporaryDirectory();
		try {
			await writeSource(root, {
				extraFrontend: 'admin',
				extraFrontendManifest: { name: 'second', dependencies: { react: '^17.0.0' } },
			});
			const refusal = await refusalOf(() =>
				ingestApplicationSource(root, declare({ revision: PINNED_REVISION })),
			);
			expect(refusal?.code).toBe('ingest.frontend-root-lineage-ambiguous');
			/** Every candidate is named, with what its manifest declared. */
			expect(refusal?.message).toContain('admin declares react ^17.0.0');
			expect(refusal?.message).toContain('assets declares react ^16.13.1');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it('refuses two manifest-bearing subdirectories that declare no lineage, by the code it always did', async () => {
		const root = await temporaryDirectory();
		try {
			await writeSource(root, {
				manifest: { name: 'server', private: true },
				extraFrontend: 'admin',
			});
			const refusal = await refusalOf(() =>
				ingestApplicationSource(root, declare({ revision: PINNED_REVISION })),
			);
			expect(refusal?.code).toBe('ingest.frontend-root-ambiguous');
			expect(refusal?.message).toContain('admin');
			expect(refusal?.message).toContain('assets');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it('refuses a lone manifest that declares no framework rather than composing a server', async () => {
		const root = await temporaryDirectory();
		try {
			await writeSource(root, {
				manifest: { name: 'flame', private: true, dependencies: { express: '^4.17.1' } },
			});
			const refusal = await refusalOf(() =>
				ingestApplicationSource(root, declare({ revision: PINNED_REVISION })),
			);
			expect(refusal?.code).toBe('ingest.frontend-root-declares-no-framework');
			expect(refusal?.message).toContain('assets declares no framework this stage reads');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it('refuses a manifest with no name rather than using the directory it sits in', async () => {
		const root = await temporaryDirectory();
		try {
			await writeSource(root, {
				manifest: {
					private: true,
					license: 'MIT',
					dependencies: { react: '^16.13.1', 'react-scripts': '3.4.1' },
				},
			});
			const refusal = await refusalOf(() =>
				ingestApplicationSource(root, declare({ revision: PINNED_REVISION })),
			);
			expect(refusal?.code).toBe('ingest.identifier-not-determined');
			expect(refusal?.message).toContain('--id');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it('refuses a declared frontend root that carries no manifest', async () => {
		const root = await temporaryDirectory();
		try {
			await writeSource(root);
			const refusal = await refusalOf(() =>
				ingestApplicationSource(
					root,
					declare({ revision: PINNED_REVISION, frontendRoot: 'client' }),
				),
			);
			expect(refusal?.code).toBe('ingest.declared-frontend-root-carries-no-manifest');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it('refuses an abbreviated revision rather than resolving one', async () => {
		const root = await temporaryDirectory();
		try {
			await writeSource(root);
			const refusal = await refusalOf(() =>
				ingestApplicationSource(root, declare({ revision: '3546a5f' })),
			);
			expect(refusal?.code).toBe('ingest.declared-revision-is-not-a-commit-sha');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});

describe('operator license-at-pin', () => {
	it('reads the identifiers it recognises and nothing it does not', () => {
		expect(licenceIdentifierOf(mitLicenceText('Copyright (c) 2020 Papercups'))).toBe('MIT');
		expect(licenceIdentifierOf('All rights reserved. Internal use only.')).toBeNull();
		expect(
			licenceIdentifierOf(
				'Redistribution and use in source and binary forms, with or without modification.',
			),
		).toBe('BSD-2-Clause');
		expect(
			licenceIdentifierOf(
				'Redistribution and use in source and binary forms. Neither the name of the copyright holder.',
			),
		).toBe('BSD-3-Clause');
	});

	it('refuses a source root carrying no licence file', async () => {
		const root = await temporaryDirectory();
		try {
			await writeSource(root, { licenceText: null });
			const refusal = await refusalOf(() => readLicenceAtPin(root, null));
			expect(refusal?.code).toBe('license-at-pin.licence-file-absent');
			expect(refusal?.stage).toBe('license-at-pin');
			expect(refusal?.origin).toBe('pipeline');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it('refuses a licence text it does not read, and records --license as declared', async () => {
		const root = await temporaryDirectory();
		try {
			await writeSource(root, { licenceText: 'Proprietary. All rights reserved.\n' });
			const refusal = await refusalOf(() =>
				readLicenceAtPin(root, null, DEFAULT_LICENCE_POLICY),
			);
			expect(refusal?.code).toBe('license-at-pin.identifier-not-recognised');
			const declared = await readLicenceAtPin(root, null, {
				declaredIdentifier: 'LicenseRef-Proprietary',
			});
			expect(declared.identifier).toBe('LicenseRef-Proprietary');
			expect(declared.identifierSource).toBe('declared');
			expect(declared.identifierBasis).toContain('declared with --license');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it('refuses a manifest field that disagrees with the licence text', async () => {
		const root = await temporaryDirectory();
		try {
			await writeSource(root, {
				manifest: { name: 'papercups-ui', license: 'Apache-2.0' },
			});
			const refusal = await refusalOf(() =>
				readLicenceAtPin(root, path.join(root, 'assets', 'package.json')),
			);
			expect(refusal?.code).toBe('license-at-pin.manifest-field-conflicts-with-licence-text');
			expect(refusal?.message).toContain('MIT');
			expect(refusal?.message).toContain('Apache-2.0');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});

describe('operator ingest — the command surface', () => {
	it('proceeds with exit 0 and emits the record under --json', async () => {
		const root = await temporaryDirectory();
		try {
			await writeSource(root);
			const outcome = await runOperatorCommand('ingest', [
				root,
				'--revision',
				PINNED_REVISION,
				'--json',
			]);
			expect(outcome.exitCode).toBe(EXIT_PROCEEDED);
			const json = JSON.parse(outcome.text) as Record<string, unknown>;
			expect(json.flow).toBe('ingest');
			expect(json.schemaVersion).toBe(INGEST_RECORD_SCHEMA);
			expect(json.id).toBe('papercups-ui');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it('refuses with exit 2 and a countable code rather than a stack trace', async () => {
		const root = await temporaryDirectory();
		try {
			await writeSource(root, { licenceText: null });
			const outcome = await runOperatorCommand('license-at-pin', [
				root,
				'--frontend-root',
				'assets',
				'--json',
			]);
			expect(outcome.exitCode).toBe(EXIT_REFUSAL);
			const json = JSON.parse(outcome.text) as {
				outcome: string;
				refusal: { code: string; stage: string; origin: string };
			};
			expect(json.outcome).toBe('refused');
			expect(json.refusal.code).toBe('license-at-pin.licence-file-absent');
			expect(json.refusal.stage).toBe('license-at-pin');
			expect(json.refusal.origin).toBe('pipeline');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it('leaves migrate’s admission stage off unless it is declared', async () => {
		const root = await temporaryDirectory();
		const lane = await temporaryDirectory();
		try {
			await writeSource(root);
			const outcome = await runOperatorCommand('migrate', [
				path.join(root, 'assets'),
				'--out',
				path.join(lane, 'lane'),
				'--json',
			]);
			const json = JSON.parse(outcome.text) as {
				ingest: { ran: boolean; reason: string };
			};
			expect(json.ingest.ran).toBe(false);
			expect(json.ingest.reason).toContain('--ingest was not declared');
		} finally {
			await rm(root, { recursive: true, force: true });
			await rm(lane, { recursive: true, force: true });
		}
	});

	it('runs admission inside migrate when it is declared, against the declared source root', async () => {
		const root = await temporaryDirectory();
		const lane = await temporaryDirectory();
		try {
			await writeSource(root);
			const outcome = await runOperatorCommand('migrate', [
				path.join(root, 'assets'),
				'--out',
				path.join(lane, 'lane'),
				'--source-root',
				root,
				'--ingest',
				'--revision',
				PINNED_REVISION,
				'--json',
			]);
			expect(outcome.exitCode).toBe(EXIT_PROCEEDED);
			const json = JSON.parse(outcome.text) as {
				ingest: { ran: boolean; id: string; licence: { identifier: string } };
			};
			expect(json.ingest.ran).toBe(true);
			expect(json.ingest.id).toBe('papercups-ui');
			expect(json.ingest.licence.identifier).toBe('MIT');
		} finally {
			await rm(root, { recursive: true, force: true });
			await rm(lane, { recursive: true, force: true });
		}
	});
});
