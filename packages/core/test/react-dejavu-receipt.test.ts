import { describe, expect, test } from 'vitest';
import { canonicalize, sha256 } from '../src/receipts/canonicalize.ts';
import {
	REACT_DEJAVU_RECEIPT_PATH,
	reactDejavuAggregateMember,
	verifyReactDejavuReceipt,
} from '../src/receipts/react-dejavu.ts';

function receipt(): Record<string, unknown> {
	const unsigned = {
		schemaVersion: 1,
		id: 'react-dejavu-legacy-to-vite8',
		status: 'verified',
		source: {
			repository: 'appbaseio/dejavu',
			revision: 'a'.repeat(40),
			tree: 'b'.repeat(40),
			license: 'MIT',
			gitObjectParityDigest: 'e'.repeat(64),
			symlinks: 1,
		},
		target: { react: '18.3.1', node: '24.15.0', vite: '8.0.16', bundler: 'vite' },
		builds: {
			legacy: ['c'.repeat(64), 'c'.repeat(64)],
			target: ['d'.repeat(64), 'd'.repeat(64)],
		},
		journeys: { observations: 8, directWitness: true, loopbackOnly: true },
		serviceWorker: { registrations: 0, controllers: 0, requests: 0, outputFiles: 0 },
		mutation: { red: true, restored: true, sourceIdentityRestored: true },
		artifacts: Array.from({ length: 8 }, (_, index) => ({
			path: `evidence/runs/react-dejavu-vite8/artifact-${index}.json`,
			sha256: String(index).repeat(64),
		})),
	};
	return { ...unsigned, digest: sha256(canonicalize(unsigned)) };
}

describe('React Dejavu semantic receipt', () => {
	test('binds source, deterministic builds, complete witness matrix and restoration', () => {
		const verified = verifyReactDejavuReceipt(receipt());
		expect(verified.digest).toHaveLength(64);
		expect(reactDejavuAggregateMember(verified.digest)).toEqual({
			id: 'react-dejavu-legacy-to-vite8',
			receipt: REACT_DEJAVU_RECEIPT_PATH,
			digest: verified.digest,
		});
	});

	test('rejects nondeterminism, service workers, missing observations and tampering', () => {
		const cases = [receipt(), receipt(), receipt(), receipt(), receipt()];
		(cases[0]!.builds as { target: string[] }).target[1] = 'e'.repeat(64);
		(cases[1]!.serviceWorker as { registrations: number }).registrations = 1;
		(cases[2]!.journeys as { observations: number }).observations = 7;
		cases[3]!.digest = 'f'.repeat(64);
		(cases[4]!.source as { symlinks: number }).symlinks = 0;
		for (const value of cases) expect(() => verifyReactDejavuReceipt(value)).toThrow();
	});
});
