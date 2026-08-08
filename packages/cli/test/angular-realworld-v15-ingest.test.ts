import { afterEach, describe, expect, it } from 'vitest';
import {
	ANGULAR_REALWORLD_COMMIT,
	ANGULAR_REALWORLD_CONSENT,
	analyzeDependencyClosure,
	assertAcquisitionConsent,
	assertAcquisitionUrl,
	createAcquisitionState,
	finalizeAcquisitionReceipt,
	verifyAcquisitionReceipt,
} from '../src/fixture/angular-realworld-v15-ingest.ts';

afterEach(() => {
	delete process.env.VERSIONLESS_NETWORK_MODE;
});

describe('Angular RealWorld v15 acquisition', () => {
	function syntheticLock(): Record<string, unknown> {
		const packages: Record<string, unknown> = { '': { name: 'angular-realworld-example-app' } };
		for (let index = 0; index < 865; index += 1) {
			const name = `pkg-${index}`;
			const resolved = `https://registry.npmjs.org/${name}/-/${name}-1.0.0.tgz`;
			const integrity = `sha512-${Buffer.alloc(64, index % 256).toString('base64')}`;
			packages[`node_modules/${name}`] = { version: '1.0.0', resolved, integrity };
			if (index >= 38) continue;
			const repeats = 3 + (index < 15 ? 1 : 0);
			for (let repeat = 0; repeat < repeats; repeat += 1)
				packages[`node_modules/parent-${index}-${repeat}/node_modules/${name}`] = {
					version: '1.0.0',
					resolved,
					integrity,
				};
		}
		return { name: 'synthetic-cardinality-regression', lockfileVersion: 3, packages };
	}

	it('requires the exact purpose-bound consent before acquisition', () => {
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		expect(() => assertAcquisitionConsent(undefined)).toThrow('exact purpose-bound consent');
		expect(() => assertAcquisitionConsent('wrong')).toThrow('exact purpose-bound consent');
		delete process.env.VERSIONLESS_NETWORK_MODE;
		expect(() => assertAcquisitionConsent(ANGULAR_REALWORLD_CONSENT)).toThrow(
			'exact purpose-bound consent',
		);
		process.env.VERSIONLESS_NETWORK_MODE = 'consented';
		expect(() => assertAcquisitionConsent(ANGULAR_REALWORLD_CONSENT)).not.toThrow();
	});

	it('accepts only the exact static and lock-derived HTTPS URLs', () => {
		const source = `https://codeload.github.com/realworld-apps/angular-realworld-example-app/tar.gz/${ANGULAR_REALWORLD_COMMIT}`;
		const registry = 'https://registry.npmjs.org/example/-/example-1.0.0.tgz';
		expect(() => assertAcquisitionUrl(source)).not.toThrow();
		expect(() => assertAcquisitionUrl(registry, new Set([registry]))).not.toThrow();
		for (const url of [
			`${source}?mutable=true`,
			'http://registry.npmjs.org/example/-/example-1.0.0.tgz',
			'https://user:secret@registry.npmjs.org/example/-/example-1.0.0.tgz',
			'https://example.invalid/example.tgz',
		])
			expect(() => assertAcquisitionUrl(url, new Set([registry]))).toThrow(
				'exact acquisition scope',
			);
	});

	it('seals canonical published receipts and rejects tampering', () => {
		const state = createAcquisitionState();
		expect(state).toEqual({
			attempts: 0,
			aggregateBytes: 0,
			priorAttempts: 0,
			priorAggregateBytes: 0,
			ledger: [],
		});
		const receipt = finalizeAcquisitionReceipt({
			schemaVersion: 'versionless.angular-realworld-v15-acquisition.v1',
			result: 'published',
			manifestSha256: 'a'.repeat(64),
			publication: `.versionless/cache/angular-realworld-v15/closures/${'a'.repeat(64)}`,
			requests: 868,
			acceptedBytes: 123,
			cumulativeRequests: 870,
			cumulativeAcceptedBytes: 187_501,
			networkAttemptsDuringVerification: 0,
		});
		expect(verifyAcquisitionReceipt(receipt)).toEqual(receipt);
		const tampered = { ...structuredClone(receipt), requests: 869 };
		expect(() => verifyAcquisitionReceipt(tampered)).toThrow('differs');
	});

	it('separates the null-inclusive URL count and proves the exact collapsed closure', () => {
		const lock = syntheticLock();
		const packages = lock.packages as Record<string, Record<string, unknown>>;
		expect(new Set(Object.values(packages).map((entry) => entry.resolved ?? null)).size).toBe(
			866,
		);
		const analysis = analyzeDependencyClosure(Buffer.from(JSON.stringify(lock)), false);
		expect(analysis).toMatchObject({
			entries: 994,
			uniqueUrls: 865,
			uniqueUrlSriPairs: 865,
			repeatedUrlGroups: 38,
			collapsedPlacements: 129,
			rootNullInclusiveValues: 866,
			conflicts: 0,
		});
		expect(analysis.plan).toHaveLength(865);
	});

	it('fails closed with URL, SRI, and identity diagnostics before acquisition', () => {
		const lock = syntheticLock();
		const packages = lock.packages as Record<string, Record<string, unknown>>;
		const conflictPath = 'node_modules/parent-0-0/node_modules/pkg-0';
		packages[conflictPath] = {
			...packages[conflictPath],
			integrity: `sha512-${Buffer.alloc(64, 255).toString('base64')}`,
		};
		let message = '';
		try {
			analyzeDependencyClosure(Buffer.from(JSON.stringify(lock)), false);
		} catch (error) {
			message = error instanceof Error ? error.message : String(error);
		}
		expect(message).toContain('same-URL/different-SRI conflict');
		expect(message).toContain('pkg-0/-/pkg-0-1.0.0.tgz');
		expect(message).toContain('sha512-');
		expect(message).toContain('pkg-0@1.0.0');
	});
});
