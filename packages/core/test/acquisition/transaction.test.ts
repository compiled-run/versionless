import { describe, expect, it } from 'vitest';
import {
	AcquisitionFailure,
	exactRequestUrl,
	responseRecord,
} from '../../src/acquisition/transaction.ts';

describe('shared exact acquisition transaction types', () => {
	it('constructs and reads back an exact GitHub URL through ufo', () => {
		expect(
			exactRequestUrl({
				host: 'api.github.com',
				path: ['repos', 'provectus', 'kafka-ui', 'git', 'ref', 'tags', 'v0.3.3'],
				purpose: 'exact release ref',
				responseKind: 'json',
			}),
		).toBe('https://api.github.com/repos/provectus/kafka-ui/git/ref/tags/v0.3.3');
	});

	it('rejects ambiguous path segments', () => {
		expect(() =>
			exactRequestUrl({
				host: 'codeload.github.com',
				path: ['provectus/kafka-ui', 'tar.gz', 'commit'],
				purpose: 'archive',
				responseKind: 'archive',
			}),
		).toThrow(AcquisitionFailure);
	});

	it('binds exact body digests before processing', () => {
		const record = responseRecord(
			{
				host: 'codeload.github.com',
				path: ['provectus', 'kafka-ui', 'tar.gz', 'a'.repeat(40)],
				purpose: 'duplicate archive',
				responseKind: 'archive',
				intentionalDuplicateIndex: 2,
			},
			2,
			Buffer.from('archive'),
		);
		expect(record).toMatchObject({
			ordinal: 2,
			bodyBytes: 7,
			intentionalDuplicateIndex: 2,
		});
		expect(record.sha256).toHaveLength(64);
		expect(record.sha512).toHaveLength(128);
	});
});
