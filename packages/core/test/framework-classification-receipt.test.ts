import { describe, expect, it } from 'vitest';
import {
	createFrameworkClassificationReceipt,
	frameworkClassificationDigest,
	NOT_TESTED_EXECUTION,
	parseFrameworkClassificationReceipt,
} from '../src/receipts/framework-classification.ts';

function receipt() {
	return createFrameworkClassificationReceipt({
		descriptor: { framework: 'nextjs', synthetic: true },
		id: 'synthetic-next',
		framework: 'nextjs',
		adapter: 'nextjs',
		inventory: { routing: { mode: 'app' } },
	});
}

describe('framework classification receipt', () => {
	it('is canonical, deterministic, offline, and entirely not-tested', () => {
		const first = receipt();
		const second = receipt();
		expect(first).toEqual(second);
		expect(first.execution).toEqual(NOT_TESTED_EXECUTION);
		expect(first.locality).toEqual({
			mode: 'offline',
			networkAttempts: 0,
			candidateExecution: 'not-requested',
		});
		expect(frameworkClassificationDigest(first)).toBe(first.integrity.canonicalDigest);
		expect(parseFrameworkClassificationReceipt(first)).toEqual(first);
	});

	it('refuses framework uplift and every support-strengthening execution state', () => {
		for (const field of Object.keys(NOT_TESTED_EXECUTION)) {
			const value = structuredClone(receipt()) as unknown as Record<string, any>;
			value.execution[field] = 'verified';
			value.integrity.canonicalDigest = frameworkClassificationDigest(value as never);
			expect(() => parseFrameworkClassificationReceipt(value), field).toThrow(
				'must remain not-tested',
			);
		}
		const react = structuredClone(receipt()) as unknown as Record<string, any>;
		react.classification.framework = 'react';
		react.integrity.canonicalDigest = frameworkClassificationDigest(react as never);
		expect(() => parseFrameworkClassificationReceipt(react)).toThrow(
			'framework/adapter mismatch',
		);
	});

	it('refuses network, execution, claim, digest, and unknown-field tampering', () => {
		for (const mutate of [
			(value: Record<string, any>) => (value.locality.networkAttempts = 1),
			(value: Record<string, any>) => (value.locality.candidateExecution = 'performed'),
			(value: Record<string, any>) => (value.claims.compliance = 'certified'),
			(value: Record<string, any>) => (value.unearnedSupport = true),
		]) {
			const value = structuredClone(receipt()) as unknown as Record<string, any>;
			mutate(value);
			value.integrity.canonicalDigest = frameworkClassificationDigest(value as never);
			expect(() => parseFrameworkClassificationReceipt(value)).toThrow();
		}
		const digest = receipt();
		digest.integrity.canonicalDigest = '0'.repeat(64);
		expect(() => parseFrameworkClassificationReceipt(digest)).toThrow('canonical digest');
	});
});
