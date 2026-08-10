import { describe, expect, test } from 'vitest';
import {
	ANGULAR_CONTACTS_TECHNICAL_BOUNDARY,
	finalizeAngularContactsReceipt,
	verifyAngularContactsReceipt,
} from '../src/receipts/angular-contacts-angular9-to16.ts';

function receipt() {
	return finalizeAngularContactsReceipt({
		result: 'pass',
		source: {
			commit: '875aa2df7f5f87b6731a1259b63e2b399fa5fb3f',
			archiveSha256: '93b2add6bbda402b86769b39a50cc4cae9050c363619ce3b5f20e8f7cd2f42f0',
		},
		baseline: {
			node: '16.20.2',
			architecture: 'darwin-arm64',
			angular: '9.0.0',
			builder: 'webpack',
			aotBuilds: 2,
			deterministic: true,
		},
		migration: {
			sequentialMajors: [9, 10, 11, 12, 13, 14, 15, 16],
			aotAtEveryMajor: true,
			files: 12,
			spans: 80,
		},
		target: {
			node: '18.20.8',
			architecture: 'darwin-arm64',
			angular: '16.2.12',
			cli: '16.2.16',
			builder: 'browser-esbuild',
			aotBuilds: 2,
			deterministic: true,
		},
		witness: {
			observations: 8,
			directModule: 'link:../witness',
			restOperations: 5,
			socketEvents: 3,
			twoClientCausality: true,
			runsPerLane: 2,
		},
		mutation: {
			seam: 'contactsAdapter.removeOne(id, state)',
			red: true,
			exactByteRestoration: true,
			restoredGreen: true,
		},
		locality: {
			loopbackOnly: true,
			serviceWorkers: 0,
			remoteAssets: 0,
			credentials: false,
			customerOrPaymentData: false,
		},
		boundary: ANGULAR_CONTACTS_TECHNICAL_BOUNDARY,
		nonclaims: [
			'Technical evaluation of an example application; not enterprise adoption, compliance, certification, legal approval, or redistribution authorization.',
		],
	});
}

describe('Angular Contacts production receipt', () => {
	test('verifies the honest native-arm64 compatibility and complete evidence boundary', () =>
		expect(verifyAngularContactsReceipt(receipt())).toEqual(receipt()));
	test('rejects an original-Node12 or incomplete claim', () => {
		const value = structuredClone(receipt()) as any;
		value.baseline.node = '12.22.12';
		expect(() => verifyAngularContactsReceipt(value)).toThrow('differs');
	});
});
