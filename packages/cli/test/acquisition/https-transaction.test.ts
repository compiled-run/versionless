import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { responseRecord } from '../../../core/src/acquisition/transaction.ts';
import {
	persistAcceptedResponse,
	verifyDurableResponses,
} from '../../src/acquisition/https-transaction.ts';

describe('shared durable acquisition replay', () => {
	it('fsyncs a body and append-only event before returning', async () => {
		const durableRoot = await mkdtemp(join(tmpdir(), 'versionless-acquisition-'));
		const transaction = {
			consentId: 'test',
			durableRoot,
			metadataCap: 1024,
			archiveCap: 1024,
			aggregateCap: 2048,
		};
		const state = { acceptedResponses: 0, aggregateBytes: 0, observations: [], ledger: [] };
		const record = await persistAcceptedResponse(
			transaction,
			{
				host: 'api.github.com',
				path: ['repos', 'provectus', 'kafka-ui'],
				purpose: 'identity',
				responseKind: 'json',
			},
			state,
			Buffer.from('body'),
		);
		expect(await readFile(join(durableRoot, record.bodyFile), 'utf8')).toBe('body');
		expect(
			JSON.parse(await readFile(join(durableRoot, 'journal.ndjson'), 'utf8')),
		).toMatchObject({ bodyBytes: 4, purpose: 'identity' });
	});

	it('rejects a missing durable body', async () => {
		const durableRoot = await mkdtemp(join(tmpdir(), 'versionless-acquisition-'));
		const transaction = {
			consentId: 'test',
			durableRoot,
			metadataCap: 1024,
			archiveCap: 1024,
			aggregateCap: 2048,
		};
		const record = responseRecord(
			{
				host: 'api.github.com',
				path: ['repos', 'provectus', 'kafka-ui'],
				purpose: 'identity',
				responseKind: 'json',
			},
			1,
			Buffer.from('body'),
		);
		await expect(verifyDurableResponses(transaction, [record])).rejects.toThrow();
	});
});
