import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import { sha256 } from '../../core/src/receipts/canonicalize.ts';
import type {
	AcquisitionState,
	ExactRequestDescriptor,
} from '../../core/src/acquisition/transaction.ts';
import { exactRequestUrl } from '../../core/src/acquisition/transaction.ts';
import {
	persistAcceptedResponse,
	type AcquisitionTransaction,
} from '../src/acquisition/https-transaction.ts';
import {
	acquireApplicationSource,
	acquireBaselineRoot,
	acquireCacheRoot,
	acquireEvidenceRoot,
	renderAcquire,
	resolveConsentId,
	splitRepository,
	type AcquireTransport,
} from '../src/operator/acquire.ts';
import { pipelineRefusalOf } from '../src/operator/refusals.ts';
import { gitBlobId } from '../src/fixture/legacy-candidate-ingest.ts';

const scratch = async (): Promise<string> => mkdtemp(path.join(tmpdir(), 'vl-acquire-'));

/**
 * The refusal an expression raised, or a failure naming what it did instead.
 *
 * A stage that *returns* where a refusal was expected is the failure this
 * helper exists to make loud: `expect(...).rejects` alone would pass on any
 * error, including a crash, and a crash is a defect rather than a refusal.
 */
const refusalOf = async (run: () => Promise<unknown>) => {
	try {
		await run();
	} catch (error) {
		const refusal = pipelineRefusalOf(error);
		if (refusal === null) throw error;
		return refusal;
	}
	throw new Error('expected a refusal, the call returned');
};

const CONSENTED = { VERSIONLESS_NETWORK_MODE: 'consented' } as NodeJS.ProcessEnv;

describe('acquire — consent is a gate, not a formality', () => {
	it('refuses without a consent id and opens no socket', async () => {
		const refusal = await refusalOf(() =>
			acquireApplicationSource(
				{
					repository: 'owner/name',
					ref: 'v1.0.0',
					id: 'owner-name-v1-0-0',
					consentId: null,
					declaredLicence: null,
				},
				{
					environment: CONSENTED,
					transport: () => {
						throw new Error('the transport must not be reached');
					},
				},
			),
		);
		expect(refusal.code).toBe('acquire.consent-not-declared');
		expect(refusal.stage).toBe('acquire');
		expect(refusal.origin).toBe('pipeline');
	});

	it('refuses when the host was never put in consented network mode', () => {
		const refusal = (() => {
			try {
				resolveConsentId('VL-TEST', {} as NodeJS.ProcessEnv);
			} catch (error) {
				return pipelineRefusalOf(error);
			}
			return null;
		})();
		expect(refusal?.code).toBe('acquire.network-mode-not-consented');
	});

	it('reads the consent id out of the environment when no flag declares one', () => {
		expect(
			resolveConsentId(null, {
				VERSIONLESS_NETWORK_MODE: 'consented',
				VERSIONLESS_CONSENT_ID: 'VL-FROM-ENV',
			} as NodeJS.ProcessEnv),
		).toBe('VL-FROM-ENV');
	});

	it('refuses a repository that is not owner/name', () => {
		for (const value of ['', 'name', 'https://github.com/owner/name', 'a/b/c']) {
			let code: string | null = null;
			try {
				splitRepository(value);
			} catch (error) {
				code = pipelineRefusalOf(error)?.code ?? null;
			}
			expect(code).toBe('acquire.repository-not-owner-name');
		}
	});
});

/**
 * A repository served entirely from memory.
 *
 * The tree, the archive and the metadata are built here from one description of
 * a source, so an acquisition can be driven end to end with no network at all —
 * and so a *corrupted* archive can be served against an honest tree, which is
 * the only way to exercise the parity refusal.
 */
type FakeSource = Readonly<{ files: Readonly<Record<string, string>>; corruptPath?: string }>;

async function fakeRepository(
	workspace: string,
	source: FakeSource,
): Promise<{ transport: AcquireTransport; archiveBytes: Buffer }> {
	const staging = path.join(workspace, 'staging');
	const singleRoot = 'name-' + 'c'.repeat(40);
	const stagedRoot = path.join(staging, singleRoot);
	await rm(staging, { recursive: true, force: true });
	for (const [file, text] of Object.entries(source.files)) {
		const target = path.join(stagedRoot, file);
		await mkdir(path.dirname(target), { recursive: true });
		await writeFile(target, source.corruptPath === file ? `${text}corrupted` : text);
	}
	const archive = path.join(workspace, 'archive.tar.gz');
	execFileSync('tar', ['-czf', archive, '-C', staging, singleRoot]);
	const archiveBytes = await readFile(archive);

	const rows = Object.entries(source.files)
		.map(([file, text]) => ({
			path: file,
			mode: '100644',
			type: 'blob',
			sha: gitBlobId(Buffer.from(text, 'utf8')),
		}))
		.sort((left, right) => (left.path < right.path ? -1 : 1));
	const bodies = new Map<string, Buffer>([
		[
			'https://api.github.com/repos/owner/name',
			Buffer.from(
				JSON.stringify({
					id: 42,
					full_name: 'owner/name',
					private: false,
					archived: false,
					disabled: false,
				}),
			),
		],
		[
			'https://api.github.com/repos/owner/name/git/ref/tags/v1.0.0',
			Buffer.from(JSON.stringify({ object: { sha: 'c'.repeat(40), type: 'commit' } })),
		],
		[
			`https://api.github.com/repos/owner/name/git/commits/${'c'.repeat(40)}`,
			Buffer.from(
				JSON.stringify({
					tree: { sha: 't'.repeat(40) },
					committer: { date: '2021-03-04T05:06:07Z' },
					verification: { verified: false },
				}),
			),
		],
		[
			`https://api.github.com/repos/owner/name/git/trees/${'t'.repeat(40)}?recursive=1`,
			Buffer.from(JSON.stringify({ truncated: false, tree: rows })),
		],
		[`https://codeload.github.com/owner/name/tar.gz/${'c'.repeat(40)}`, archiveBytes],
	]);

	const transport: AcquireTransport = async (
		transaction: AcquisitionTransaction,
		descriptor: ExactRequestDescriptor,
		state: AcquisitionState,
	) => {
		const url = exactRequestUrl(descriptor);
		const body = bodies.get(url);
		if (body === undefined) throw new Error(`unserved acquisition url: ${url}`);
		state.observations.push({
			method: 'GET',
			url,
			purpose: descriptor.purpose,
			attempt: 1,
			status: 200,
			headersObserved: true,
			bodyBytes: body.byteLength,
			acceptedResponse: true,
		});
		const record = await persistAcceptedResponse(transaction, descriptor, state, body);
		state.acceptedResponses += 1;
		state.aggregateBytes += body.byteLength;
		state.ledger.push(record);
		return body;
	};
	return { transport, archiveBytes };
}

const MIT = [
	'MIT License',
	'',
	'Copyright (c) 2021 Nobody',
	'',
	'Permission is hereby granted, free of charge, to any person obtaining a copy',
	'of this software and associated documentation files (the "Software"), to deal',
	'in the Software without restriction.',
	'',
	'The above copyright notice and this permission notice shall be included in all',
	'copies or substantial portions of the Software.',
	'',
	'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.',
	'',
].join('\n');

const SOURCE: Readonly<Record<string, string>> = Object.freeze({
	LICENSE: MIT,
	'package.json': `${JSON.stringify({ name: 'name', version: '1.0.0', license: 'MIT' }, null, 2)}\n`,
	'src/index.js': "console.log('hello');\n",
});

const declarations = {
	repository: 'owner/name',
	ref: 'v1.0.0',
	id: 'owner-name-v1-0-0',
	consentId: 'VL-TEST-CONSENT',
	declaredLicence: null,
};

describe('acquire — parity is a gate', () => {
	it('refuses when the archive does not reconcile with the git tree', async () => {
		const workspace = await scratch();
		try {
			const { transport } = await fakeRepository(workspace, {
				files: SOURCE,
				corruptPath: 'src/index.js',
			});
			const refusal = await refusalOf(() =>
				acquireApplicationSource(declarations, {
					root: workspace,
					environment: CONSENTED,
					transport,
				}),
			);
			expect(refusal.code).toBe('acquire.archive-parity-differs');
			expect(refusal.stage).toBe('acquire');
			expect(refusal.message).toContain('1 mismatched');
			// A refused acquisition publishes no source record.
			await expect(
				readFile(path.join(workspace, acquireEvidenceRoot(declarations.id), 'source.json')),
			).rejects.toThrow();
		} finally {
			await rm(workspace, { recursive: true, force: true });
		}
	});

	it('refuses a tree that carries no licence at the pin', async () => {
		const workspace = await scratch();
		try {
			const { transport } = await fakeRepository(workspace, {
				files: {
					'package.json': SOURCE['package.json'] as string,
					'src/index.js': SOURCE['src/index.js'] as string,
				},
			});
			const refusal = await refusalOf(() =>
				acquireApplicationSource(declarations, {
					root: workspace,
					environment: CONSENTED,
					transport,
				}),
			);
			expect(refusal.code).toBe('acquire.licence-absent-at-pin');
			expect(refusal.origin).toBe('pipeline');
		} finally {
			await rm(workspace, { recursive: true, force: true });
		}
	});
});

describe('acquire — the record it publishes', () => {
	it('carries the same keys the sealed source-bound records carry', async () => {
		const workspace = await scratch();
		try {
			const { transport } = await fakeRepository(workspace, { files: SOURCE });
			const record = await acquireApplicationSource(declarations, {
				root: workspace,
				environment: CONSENTED,
				transport,
			});
			const sealed = JSON.parse(
				await readFile('evidence/ingests/react-papercups-v1-0-0/source.json', 'utf8'),
			) as Record<string, unknown>;
			const published = JSON.parse(
				await readFile(
					path.join(workspace, acquireEvidenceRoot(declarations.id), 'source.json'),
					'utf8',
				),
			) as Record<string, unknown>;
			for (const key of Object.keys(sealed)) expect(published).toHaveProperty(key);
			expect(published.schemaVersion).toBe(sealed.schemaVersion);
			for (const group of ['repository', 'revision', 'archiveParity', 'transaction', 'cache'])
				for (const key of Object.keys(sealed[group] as Record<string, unknown>))
					expect(published[group]).toHaveProperty(key);

			expect(record.revision.commitSha).toBe('c'.repeat(40));
			expect(record.archiveParity.mismatchedBlobs).toBe(0);
			expect(record.archiveParity.missingFiles).toBe(0);
			expect(record.archiveParity.extraFiles).toBe(0);
			expect(record.transaction.archiveMatchesGitTree).toBe(true);
			expect(record.transaction.archivesByteIdentical).toBe(true);
			expect(record.licence.identifier).toBe('MIT');
			expect(record.consentId).toBe('VL-TEST-CONSENT');
			expect(record.baseline).toBe(acquireBaselineRoot(declarations.id));
			expect(record.cache.root).toBe(acquireCacheRoot(declarations.id));

			// The baseline is a materialized tree, not a path in a document.
			const baseline = path.join(workspace, acquireBaselineRoot(declarations.id));
			expect((await readdir(baseline)).sort()).toEqual(['LICENSE', 'package.json', 'src']);
			expect(sha256(await readFile(path.join(baseline, 'LICENSE')))).toBe(
				sha256(Buffer.from(MIT, 'utf8')),
			);

			// The consented transaction journalled every accepted response.
			const journal = await readFile(
				path.join(
					workspace,
					acquireCacheRoot(declarations.id),
					'transaction/journal.ndjson',
				),
				'utf8',
			);
			expect(journal.trim().split('\n')).toHaveLength(record.transaction.acceptedResponses);
			expect(renderAcquire(record)).toContain('owner/name');
		} finally {
			await rm(workspace, { recursive: true, force: true });
		}
	});
});
