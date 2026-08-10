import { describe, expect, test } from 'vitest';
import {
	finalizeTechnicalMigrationReceipt,
	TECHNICAL_EVALUATION_BOUNDARY,
	verifyTechnicalMigrationReceipt,
} from '../src/receipts/technical-migration.ts';

function receipt() {
	return finalizeTechnicalMigrationReceipt({
		fixture: 'angular-fuxa',
		lanes: [
			{ name: 'angular14-node16', build: 'not-run', journeyRuns: 0 },
			{ name: 'angular16-node18', build: 'not-run', journeyRuns: 0 },
		],
		mutation: 'not-run',
		locality: {
			nonLoopbackRequests: 0,
			credentialsObserved: false,
			userOrPaymentDataObserved: false,
			serviceWorkers: 0,
		},
		nonclaims: [
			'Technical evaluation only; legal and enterprise adoption decisions remain outside this receipt.',
		],
	});
}

describe('technical migration receipt', () => {
	test('always preserves every legal and enterprise nonclaim flag', () => {
		const value = receipt();
		expect(value.boundary).toEqual(TECHNICAL_EVALUATION_BOUNDARY);
		expect(verifyTechnicalMigrationReceipt(value)).toEqual(value);
	});

	test('rejects any strengthened unknown-license or redistribution state', () => {
		const value = receipt();
		for (const boundary of [
			{ ...value.boundary, unresolvedLicenses: 'approved' },
			{ ...value.boundary, redistributionAuthorized: true },
			{ ...value.boundary, legalReviewRequired: false },
		])
			expect(() => verifyTechnicalMigrationReceipt({ ...value, boundary })).toThrow(
				'strengthens',
			);
	});
});
