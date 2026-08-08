import { afterEach, describe, expect, it } from 'vitest';
import {
	TARGET_COMMIT,
	V16_CONSENT,
	assertV16Consent,
	assertV16Url,
	finalizeV16Acquisition,
	verifyV16Acquisition,
} from '../src/fixture/angular-realworld-v15-to-v16-ingest.ts';

afterEach(() => delete process.env.VERSIONLESS_NETWORK_MODE);

describe('Angular RealWorld v15 to v16 acquisition', () => {
	it('requires exact consent and exact immutable URLs', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		expect(() => assertV16Consent(V16_CONSENT)).not.toThrow();
		expect(() => assertV16Consent('wrong')).toThrow('exact consent');
		const commit = `https://api.github.com/repos/realworld-apps/angular-realworld-example-app/git/commits/${TARGET_COMMIT}`;
		const archive = `https://codeload.github.com/realworld-apps/angular-realworld-example-app/tar.gz/${TARGET_COMMIT}`;
		expect(() => assertV16Url(commit)).not.toThrow();
		expect(() => assertV16Url(archive)).not.toThrow();
		expect(() => assertV16Url(`${archive}?mutable=true`)).toThrow('exact acquisition scope');
	});

	it('seals and rejects tampered acquisition receipts', () => {
		const receipt = finalizeV16Acquisition({
			schemaVersion: 'versionless.angular-realworld-v16-acquisition.v1',
			result: 'published',
			manifestSha256: 'a'.repeat(64),
			publication: `.versionless/cache/angular-realworld-v16/closures/${'a'.repeat(64)}`,
			requests: 941,
			acceptedBytes: 123,
			networkAttemptsDuringVerification: 0,
		});
		expect(verifyV16Acquisition(receipt)).toEqual(receipt);
		expect(() => verifyV16Acquisition({ ...receipt, requests: 942 })).toThrow('differs');
	});
});
