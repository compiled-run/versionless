import { readFile } from 'node:fs/promises';
import { charIn, createRegExp } from 'magic-regexp';
import { isAbsolute, join, normalize, relative, resolve } from 'pathe';
import { parseURL } from 'ufo';
import { canonicalize, sha256 } from './canonicalize.ts';

export const REACT_ACTUAL_BUDGET_SCHEMA =
	'versionless.react-actual-budget-v22-12-9-react16-to-vite8.v1' as const;
export const REACT_ACTUAL_BUDGET_RECEIPT_PATH =
	'evidence/runs/react-actual-budget-v22-12-9-react16-to-vite8/receipt.json' as const;

const lowerHex64 = createRegExp(
	charIn('0123456789').from('a', 'f').times(64).at.lineStart().at.lineEnd(),
);
const sensitiveTerms = [
	'authorization:',
	'bearer ',
	'card number',
	'customer account',
	'password=',
	'private key',
] as const;

type Artifact = { path: string; sha256: string; bytes: number; role: string };
type Build = {
	lane: 'baseline' | 'target';
	pass: 1 | 2;
	result: 'pass';
	pageDigest: string;
	workerDigest: string;
	assetDigest: string;
	serviceWorker: 'dormant-historical-inventory' | 'absent';
};
type Journey = {
	lane: 'baseline' | 'target';
	pass: 1 | 2;
	result: 'pass';
	journey1: {
		budget: 'Versionless Synthetic Budget';
		account: 'Synthetic Checking';
		category: 'Synthetic Groceries';
		payee: 'Synthetic Market';
		initialBalanceCents: 100_000;
		firstExpenseCents: 1_234;
		firstBalanceCents: 98_766;
		editedExpenseCents: 2_345;
		editedBalanceCents: 97_655;
		undo: true;
		redo: true;
		persistedAfterReload: true;
	};
	journey2: {
		category: 'Synthetic Groceries';
		allocatedCents: 20_000;
		transferredCents: 5_000;
		budgetedCents: 25_000;
		expenseCents: 7_500;
		remainingCents: 17_500;
		search: true;
		navigation: true;
		persistedAfterReload: true;
		drag: 'performed' | 'unavailable';
	};
	locality: {
		allAttemptedUrlsLoopback: true;
		requestFailures: 0;
		externalOriginAttempts: 0;
		cookies: 0;
		authorizationHeaders: 0;
		pageErrors: 0;
		consoleErrors: 0;
		serviceWorkerRegistrations: 0;
		serviceWorkerControllers: 0;
		serviceWorkerCaches: 0;
	};
	witness: {
		package: '@async/witness';
		version: '0.7.0';
		link: 'link:../witness';
		gitCommit: string;
		workingTree: 'clean' | 'dirty';
		index: 'clean' | 'dirty';
		executableSha256: string;
		chromiumSha256: string;
	};
};

export type ActualBudgetReceipt = {
	schemaVersion: typeof REACT_ACTUAL_BUDGET_SCHEMA;
	result: 'pass';
	counted: false;
	fixture: 'react-actual-budget-v22-12-9';
	provenance: {
		revision: '3edf94714540837c67e6ac521efef3eed5e15bc6';
		tree: '1dcc782100f84487473a871b5af099769ab90a07';
		license: { root: 'MIT'; lootCore: 'ISC' };
	};
	compatibilityOverlay: {
		payload: '{ testMode, avoidUpload: true }';
		testMode: false;
		skipsOnly: 'optional cloudStorage.upload()';
		routeInterception: false;
		financeMocks: false;
		storageMocks: false;
	};
	builds: Build[];
	journeys: Journey[];
	serviceWorker: {
		baseline: 'generated-unrequested-unregistered-uncontrolled-uncached';
		target: 'not-emitted-not-registered';
		behavioralDependence: false;
	};
	mutation: {
		path: 'packages/loot-core/src/server/budget/actions.js';
		before: 'amount: budgeted + amount';
		after: 'amount: budgeted - amount';
		journey1StayedGreen: true;
		journey2TransferredCategoryTurnedRed: true;
		unrelatedReds: 0;
		sourceRestored: true;
		buildRestored: true;
		restoredJourneyGreen: true;
	};
	privacy: {
		syntheticOnly: true;
		paymentData: false;
		customerData: false;
		credentials: false;
		hostPaths: false;
	};
	sbom: {
		format: 'CycloneDX';
		rootApplication: true;
		pageTopology: true;
		workerTopology: true;
		licenses: ['MIT', 'ISC'];
	};
	artifacts: Artifact[];
	nonclaims: string[];
	integrity: { algorithm: 'sha256'; canonicalDigest: string };
};

function assertSafeArtifact(path: string, seen: Set<string>): void {
	const normalized = normalize(path);
	if (
		!path ||
		isAbsolute(path) ||
		normalized !== path ||
		path.startsWith('../') ||
		path.includes('/../') ||
		seen.has(path)
	)
		throw new Error('Actual Budget artifact path is unsafe or duplicated');
	seen.add(path);
}

export function assertActualBudgetReceipt(value: unknown): asserts value is ActualBudgetReceipt {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error('Actual Budget receipt must be an object');
	const receipt = value as Partial<ActualBudgetReceipt>;
	if (
		receipt.schemaVersion !== REACT_ACTUAL_BUDGET_SCHEMA ||
		receipt.result !== 'pass' ||
		receipt.counted !== false ||
		receipt.fixture !== 'react-actual-budget-v22-12-9' ||
		receipt.provenance?.revision !== '3edf94714540837c67e6ac521efef3eed5e15bc6' ||
		receipt.provenance.tree !== '1dcc782100f84487473a871b5af099769ab90a07' ||
		receipt.provenance.license.root !== 'MIT' ||
		receipt.provenance.license.lootCore !== 'ISC'
	)
		throw new Error('Actual Budget receipt provenance differs');
	if (
		receipt.compatibilityOverlay?.payload !== '{ testMode, avoidUpload: true }' ||
		receipt.compatibilityOverlay.testMode !== false ||
		receipt.compatibilityOverlay.skipsOnly !== 'optional cloudStorage.upload()' ||
		receipt.compatibilityOverlay.routeInterception !== false ||
		receipt.compatibilityOverlay.financeMocks !== false ||
		receipt.compatibilityOverlay.storageMocks !== false
	)
		throw new Error('Actual Budget compatibility overlay differs');
	if (!Array.isArray(receipt.builds) || receipt.builds.length !== 4)
		throw new Error('Actual Budget deterministic build matrix differs');
	for (const lane of ['baseline', 'target'] as const) {
		const builds = receipt.builds.filter((row) => row.lane === lane);
		if (
			builds.length !== 2 ||
			builds[0]?.pass !== 1 ||
			builds[1]?.pass !== 2 ||
			builds.some(
				(row) =>
					row.result !== 'pass' ||
					!lowerHex64.test(row.pageDigest) ||
					!lowerHex64.test(row.workerDigest) ||
					!lowerHex64.test(row.assetDigest) ||
					row.pageDigest !== builds[0]!.pageDigest ||
					row.workerDigest !== builds[0]!.workerDigest ||
					row.assetDigest !== builds[0]!.assetDigest ||
					row.serviceWorker !==
						(lane === 'baseline' ? 'dormant-historical-inventory' : 'absent'),
			)
		)
			throw new Error('Actual Budget deterministic build identity differs');
	}
	if (!Array.isArray(receipt.journeys) || receipt.journeys.length !== 4)
		throw new Error('Actual Budget Witness matrix differs');
	for (const lane of ['baseline', 'target'] as const) {
		const journeys = receipt.journeys.filter((row) => row.lane === lane);
		if (journeys.length !== 2 || journeys[0]?.pass !== 1 || journeys[1]?.pass !== 2)
			throw new Error('Actual Budget Witness lane/pass identity differs');
	}
	for (const row of receipt.journeys) {
		if (
			row.result !== 'pass' ||
			row.journey1.budget !== 'Versionless Synthetic Budget' ||
			row.journey1.account !== 'Synthetic Checking' ||
			row.journey1.category !== 'Synthetic Groceries' ||
			row.journey1.payee !== 'Synthetic Market' ||
			row.journey1.initialBalanceCents !== 100_000 ||
			row.journey1.firstExpenseCents !== 1_234 ||
			row.journey1.firstBalanceCents !== 98_766 ||
			row.journey1.editedExpenseCents !== 2_345 ||
			row.journey1.editedBalanceCents !== 97_655 ||
			row.journey1.undo !== true ||
			row.journey1.redo !== true ||
			row.journey1.persistedAfterReload !== true ||
			row.journey2.category !== 'Synthetic Groceries' ||
			row.journey2.allocatedCents !== 20_000 ||
			row.journey2.transferredCents !== 5_000 ||
			row.journey2.budgetedCents !== 25_000 ||
			row.journey2.expenseCents !== 7_500 ||
			row.journey2.remainingCents !== 17_500 ||
			row.journey2.search !== true ||
			row.journey2.navigation !== true ||
			row.journey2.persistedAfterReload !== true ||
			!['performed', 'unavailable'].includes(row.journey2.drag) ||
			row.locality.allAttemptedUrlsLoopback !== true ||
			Object.entries(row.locality)
				.filter(([key]) => key !== 'allAttemptedUrlsLoopback')
				.some(([, count]) => count !== 0) ||
			row.witness.package !== '@async/witness' ||
			row.witness.version !== '0.7.0' ||
			row.witness.link !== 'link:../witness' ||
			!lowerHex64.test(row.witness.executableSha256) ||
			!lowerHex64.test(row.witness.chromiumSha256)
		)
			throw new Error('Actual Budget meaningful Witness behavior differs');
	}
	if (
		receipt.serviceWorker?.baseline !==
			'generated-unrequested-unregistered-uncontrolled-uncached' ||
		receipt.serviceWorker.target !== 'not-emitted-not-registered' ||
		receipt.serviceWorker.behavioralDependence !== false
	)
		throw new Error('Actual Budget service-worker boundary differs');
	if (
		receipt.mutation?.path !== 'packages/loot-core/src/server/budget/actions.js' ||
		receipt.mutation.before !== 'amount: budgeted + amount' ||
		receipt.mutation.after !== 'amount: budgeted - amount' ||
		receipt.mutation.journey1StayedGreen !== true ||
		receipt.mutation.journey2TransferredCategoryTurnedRed !== true ||
		receipt.mutation.unrelatedReds !== 0 ||
		receipt.mutation.sourceRestored !== true ||
		receipt.mutation.buildRestored !== true ||
		receipt.mutation.restoredJourneyGreen !== true
	)
		throw new Error('Actual Budget mutation/restoration proof differs');
	if (
		receipt.privacy?.syntheticOnly !== true ||
		receipt.privacy.paymentData !== false ||
		receipt.privacy.customerData !== false ||
		receipt.privacy.credentials !== false ||
		receipt.privacy.hostPaths !== false ||
		receipt.sbom?.format !== 'CycloneDX' ||
		receipt.sbom.rootApplication !== true ||
		receipt.sbom.pageTopology !== true ||
		receipt.sbom.workerTopology !== true ||
		canonicalize(receipt.sbom.licenses) !== canonicalize(['MIT', 'ISC'])
	)
		throw new Error('Actual Budget privacy or SBOM boundary differs');
	if (!Array.isArray(receipt.artifacts) || receipt.artifacts.length < 12)
		throw new Error('Actual Budget artifact inventory is incomplete');
	const seen = new Set<string>();
	for (const artifact of receipt.artifacts) {
		assertSafeArtifact(artifact.path, seen);
		if (
			!lowerHex64.test(artifact.sha256) ||
			!Number.isSafeInteger(artifact.bytes) ||
			artifact.bytes < 0 ||
			!artifact.role
		)
			throw new Error('Actual Budget artifact identity differs');
	}
	if (
		!Array.isArray(receipt.nonclaims) ||
		!receipt.nonclaims.includes('not certification') ||
		!receipt.nonclaims.includes('not a compliance or legal opinion') ||
		!receipt.nonclaims.includes('not signer authenticity') ||
		!receipt.nonclaims.includes('not OS-wide isolation') ||
		!receipt.nonclaims.includes('not an earned SLSA level') ||
		receipt.integrity?.algorithm !== 'sha256' ||
		!lowerHex64.test(receipt.integrity.canonicalDigest)
	)
		throw new Error('Actual Budget receipt nonclaims or integrity differs');
	const serialized = canonicalize(receipt).toLowerCase();
	if (sensitiveTerms.some((term) => serialized.includes(term)))
		throw new Error('Actual Budget receipt contains sensitive material');
}

export async function verifyReactActualBudgetEvidence(
	repositoryRoot: string,
): Promise<{ valid: true; digest: string; artifacts: number }> {
	const root = normalize(resolve(repositoryRoot));
	const receiptPath = join(root, REACT_ACTUAL_BUDGET_RECEIPT_PATH);
	const receipt = JSON.parse(await readFile(receiptPath, 'utf8')) as unknown;
	assertActualBudgetReceipt(receipt);
	const copy = structuredClone(receipt);
	copy.integrity.canonicalDigest = '';
	const digest = sha256(canonicalize(copy));
	if (digest !== receipt.integrity.canonicalDigest)
		throw new Error('Actual Budget canonical receipt digest differs');
	for (const artifact of receipt.artifacts) {
		const absolute = resolve(root, artifact.path);
		if (relative(root, absolute).startsWith('../'))
			throw new Error('Actual Budget artifact escapes the repository');
		const bytes = await readFile(absolute);
		if (bytes.length !== artifact.bytes || sha256(bytes) !== artifact.sha256)
			throw new Error(`Actual Budget artifact digest differs: ${artifact.path}`);
	}
	const urls = receipt.journeys.flatMap((row) => [`http://127.0.0.1/${row.lane}/${row.pass}`]);
	if (urls.some((url) => parseURL(url).host !== '127.0.0.1'))
		throw new Error('Actual Budget normalized locality URL differs');
	return { valid: true, digest, artifacts: receipt.artifacts.length };
}

export function reactActualBudgetAggregateMember(receipt: ActualBudgetReceipt): {
	id: string;
	receipt: typeof REACT_ACTUAL_BUDGET_RECEIPT_PATH;
	digest: string;
	counted: false;
} {
	assertActualBudgetReceipt(receipt);
	return {
		id: 'react-actual-budget-v22-12-9',
		receipt: REACT_ACTUAL_BUDGET_RECEIPT_PATH,
		digest: receipt.integrity.canonicalDigest,
		counted: false,
	};
}
