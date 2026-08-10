import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, test } from 'vitest';
import { join } from 'pathe';
import { canonicalize, sha256 } from '../src/receipts/canonicalize.ts';
import {
	REACT_ACTUAL_BUDGET_RECEIPT_PATH,
	REACT_ACTUAL_BUDGET_SCHEMA,
	assertActualBudgetReceipt,
	verifyReactActualBudgetEvidence,
	type ActualBudgetReceipt,
} from '../src/receipts/react-actual-budget-v22-12-9.ts';

const temporaryRoots: string[] = [];

afterEach(async () => {
	for (const root of temporaryRoots.splice(0)) await rm(root, { recursive: true, force: true });
});

function journey(
	lane: 'baseline' | 'target',
	pass: 1 | 2,
): ActualBudgetReceipt['journeys'][number] {
	return {
		lane,
		pass,
		result: 'pass',
		journey1: {
			budget: 'Versionless Synthetic Budget',
			account: 'Synthetic Checking',
			category: 'Synthetic Groceries',
			payee: 'Synthetic Market',
			initialBalanceCents: 100_000,
			firstExpenseCents: 1_234,
			firstBalanceCents: 98_766,
			editedExpenseCents: 2_345,
			editedBalanceCents: 97_655,
			undo: true,
			redo: true,
			persistedAfterReload: true,
		},
		journey2: {
			category: 'Synthetic Groceries',
			allocatedCents: 20_000,
			transferredCents: 5_000,
			budgetedCents: 25_000,
			expenseCents: 7_500,
			remainingCents: 17_500,
			search: true,
			navigation: true,
			persistedAfterReload: true,
			drag: 'unavailable',
		},
		locality: {
			allAttemptedUrlsLoopback: true,
			requestFailures: 0,
			externalOriginAttempts: 0,
			cookies: 0,
			authorizationHeaders: 0,
			pageErrors: 0,
			consoleErrors: 0,
			serviceWorkerRegistrations: 0,
			serviceWorkerControllers: 0,
			serviceWorkerCaches: 0,
		},
		witness: {
			package: '@async/witness',
			version: '0.7.0',
			link: 'link:../witness',
			gitCommit: 'synthetic-test-identity',
			workingTree: 'clean',
			index: 'clean',
			executableSha256: 'a'.repeat(64),
			chromiumSha256: 'b'.repeat(64),
		},
	};
}

function receipt(artifacts: ActualBudgetReceipt['artifacts']): ActualBudgetReceipt {
	const builds = (['baseline', 'target'] as const).flatMap((lane) =>
		([1, 2] as const).map((pass) => ({
			lane,
			pass,
			result: 'pass' as const,
			pageDigest: lane === 'baseline' ? '1'.repeat(64) : '4'.repeat(64),
			workerDigest: lane === 'baseline' ? '2'.repeat(64) : '5'.repeat(64),
			assetDigest: lane === 'baseline' ? '3'.repeat(64) : '6'.repeat(64),
			serviceWorker:
				lane === 'baseline'
					? ('dormant-historical-inventory' as const)
					: ('absent' as const),
		})),
	);
	const value: ActualBudgetReceipt = {
		schemaVersion: REACT_ACTUAL_BUDGET_SCHEMA,
		result: 'pass',
		counted: false,
		fixture: 'react-actual-budget-v22-12-9',
		provenance: {
			revision: '3edf94714540837c67e6ac521efef3eed5e15bc6',
			tree: '1dcc782100f84487473a871b5af099769ab90a07',
			license: { root: 'MIT', lootCore: 'ISC' },
		},
		compatibilityOverlay: {
			payload: '{ testMode, avoidUpload: true }',
			testMode: false,
			skipsOnly: 'optional cloudStorage.upload()',
			routeInterception: false,
			financeMocks: false,
			storageMocks: false,
		},
		builds,
		journeys: [
			journey('baseline', 1),
			journey('baseline', 2),
			journey('target', 1),
			journey('target', 2),
		],
		serviceWorker: {
			baseline: 'generated-unrequested-unregistered-uncontrolled-uncached',
			target: 'not-emitted-not-registered',
			behavioralDependence: false,
		},
		mutation: {
			path: 'packages/loot-core/src/server/budget/actions.js',
			before: 'amount: budgeted + amount',
			after: 'amount: budgeted - amount',
			journey1StayedGreen: true,
			journey2TransferredCategoryTurnedRed: true,
			unrelatedReds: 0,
			sourceRestored: true,
			buildRestored: true,
			restoredJourneyGreen: true,
		},
		privacy: {
			syntheticOnly: true,
			paymentData: false,
			customerData: false,
			credentials: false,
			hostPaths: false,
		},
		sbom: {
			format: 'CycloneDX',
			rootApplication: true,
			pageTopology: true,
			workerTopology: true,
			licenses: ['MIT', 'ISC'],
		},
		artifacts,
		nonclaims: [
			'not certification',
			'not a compliance or legal opinion',
			'not signer authenticity',
			'not OS-wide isolation',
			'not an earned SLSA level',
		],
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	value.integrity.canonicalDigest = sha256(canonicalize(value));
	return value;
}

describe('Actual Budget enterprise receipt', () => {
	test('independently reopens all artifacts and canonical receipt bytes', async () => {
		const root = await mkdtemp(join(tmpdir(), 'versionless-t582-receipt-'));
		temporaryRoots.push(root);
		const artifacts = await Promise.all(
			Array.from({ length: 12 }, async (_, index) => {
				const path = `evidence/runs/react-actual-budget-v22-12-9-react16-to-vite8/artifacts/${index}.json`;
				const bytes = Buffer.from(`${JSON.stringify({ index })}\n`);
				await mkdir(join(root, path, '..'), { recursive: true });
				await writeFile(join(root, path), bytes);
				return {
					path,
					sha256: sha256(bytes),
					bytes: bytes.length,
					role: `synthetic-${index}`,
				};
			}),
		);
		const value = receipt(artifacts);
		const receiptPath = join(root, REACT_ACTUAL_BUDGET_RECEIPT_PATH);
		await mkdir(join(receiptPath, '..'), { recursive: true });
		await writeFile(receiptPath, `${canonicalize(value)}\n`);
		await expect(verifyReactActualBudgetEvidence(root)).resolves.toEqual({
			valid: true,
			digest: value.integrity.canonicalDigest,
			artifacts: 12,
		});
	});

	test('rejects strengthened claims, mocked locality and noncausal mutation evidence', () => {
		const value = receipt(
			Array.from({ length: 12 }, (_, index) => ({
				path: `evidence/synthetic/${index}.json`,
				sha256: 'a'.repeat(64),
				bytes: 1,
				role: 'synthetic',
			})),
		);
		expect(() => assertActualBudgetReceipt(value)).not.toThrow();
		const changed = structuredClone(value) as unknown as {
			mutation: { journey2TransferredCategoryTurnedRed: boolean };
		};
		changed.mutation.journey2TransferredCategoryTurnedRed = false;
		expect(() => assertActualBudgetReceipt(changed)).toThrow('mutation/restoration');
		const external = structuredClone(value) as unknown as {
			journeys: Array<{ locality: { externalOriginAttempts: number } }>;
		};
		external.journeys[0]!.locality.externalOriginAttempts = 1;
		expect(() => assertActualBudgetReceipt(external)).toThrow('Witness behavior');
	});
});
