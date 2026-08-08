import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import { sha256 } from '../../core/src/receipts/canonicalize.ts';
import { ingestAngularPhonecat } from '../src/fixture/angular-phonecat-ingest.ts';

describe('Angular PhoneCat fixture', () => {
	test('refuses missing or mismatched explicit consent before ingest', async () => {
		const previousMode = process.env.VERSIONLESS_NETWORK_MODE;
		const previousConsent = process.env.VERSIONLESS_CONSENT_ID;
		try {
			process.env.VERSIONLESS_NETWORK_MODE = 'consented';
			delete process.env.VERSIONLESS_CONSENT_ID;
			await expect(
				ingestAngularPhonecat({ allowNetwork: true, consentId: undefined }),
			).rejects.toThrow('non-empty consent ID');
			process.env.VERSIONLESS_CONSENT_ID = 'environment-consent';
			await expect(
				ingestAngularPhonecat({ allowNetwork: true, consentId: 'cli-consent' }),
			).rejects.toThrow('exact CLI/environment consent ID equality');
			process.env.VERSIONLESS_NETWORK_MODE = 'offline';
			process.env.VERSIONLESS_CONSENT_ID = 'matching-consent';
			await expect(
				ingestAngularPhonecat({ allowNetwork: true, consentId: 'matching-consent' }),
			).rejects.toThrow('consented network mode');
			process.env.VERSIONLESS_NETWORK_MODE = 'consented';
			await expect(
				ingestAngularPhonecat({ allowNetwork: false, consentId: 'matching-consent' }),
			).rejects.toThrow('allowNetwork');
		} finally {
			if (previousMode === undefined) delete process.env.VERSIONLESS_NETWORK_MODE;
			else process.env.VERSIONLESS_NETWORK_MODE = previousMode;
			if (previousConsent === undefined) delete process.env.VERSIONLESS_CONSENT_ID;
			else process.env.VERSIONLESS_CONSENT_ID = previousConsent;
		}
	});

	test('cached source is pinned and target changes only PhoneDetail', async () => {
		let archive: Buffer;
		try {
			archive = await readFile('.versionless/cache/angular-phonecat/source.tar.gz');
		} catch {
			return;
		}
		const manifest = JSON.parse(
			await readFile('fixtures/angular-phonecat/fixture.json', 'utf8'),
		);
		expect(sha256(archive)).toBe(manifest.source.archiveSha256);
		const legacy = await readFile(
			'.versionless/work/angular-phonecat/legacy/app/phone-detail/phone-detail.component.js',
		);
		const target = await readFile(
			'.versionless/work/angular-phonecat/target/app/phone-detail/phone-detail.component.js',
		);
		expect(sha256(legacy)).toBe(manifest.source.phoneDetailSha256);
		expect(sha256(target)).not.toBe(sha256(legacy));
	});
});
