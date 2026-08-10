import { canonicalize, sha256 } from './canonicalize.ts';

export const TECHNICAL_MIGRATION_SCHEMA = 'versionless.technical-migration.v1' as const;

export type TechnicalEvaluationBoundary = Readonly<{
	technicalEvaluationOnly: true;
	unresolvedLicenses: 'unknown';
	legalReviewRequired: true;
	redistributionAuthorized: false;
	complianceStatus: 'not-assessed';
	certificationClaim: false;
	enterpriseAdoptionApproval: false;
}>;

export const TECHNICAL_EVALUATION_BOUNDARY: TechnicalEvaluationBoundary = Object.freeze({
	technicalEvaluationOnly: true,
	unresolvedLicenses: 'unknown',
	legalReviewRequired: true,
	redistributionAuthorized: false,
	complianceStatus: 'not-assessed',
	certificationClaim: false,
	enterpriseAdoptionApproval: false,
});

export type TechnicalMigrationReceipt = Readonly<{
	schemaVersion: typeof TECHNICAL_MIGRATION_SCHEMA;
	fixture: 'angular-fuxa';
	boundary: TechnicalEvaluationBoundary;
	lanes: readonly Readonly<{
		name: 'angular14-node16' | 'angular16-node18';
		build: 'pass' | 'not-run' | 'failed';
		journeyRuns: 0 | 2;
	}>[];
	mutation: 'pass' | 'not-run' | 'failed';
	locality: Readonly<{
		nonLoopbackRequests: number;
		credentialsObserved: false;
		userOrPaymentDataObserved: false;
		serviceWorkers: 0;
	}>;
	nonclaims: readonly string[];
	integrity: Readonly<{ algorithm: 'sha256'; canonicalDigest: string }>;
}>;

function object(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error('Technical migration receipt must be an object');
	return value as Record<string, unknown>;
}

export function technicalMigrationDigest(receipt: TechnicalMigrationReceipt): string {
	return sha256(
		canonicalize({ ...receipt, integrity: { ...receipt.integrity, canonicalDigest: '' } }),
	);
}

export function finalizeTechnicalMigrationReceipt(
	value: Omit<TechnicalMigrationReceipt, 'schemaVersion' | 'boundary' | 'integrity'>,
): TechnicalMigrationReceipt {
	const receipt: TechnicalMigrationReceipt = {
		schemaVersion: TECHNICAL_MIGRATION_SCHEMA,
		boundary: TECHNICAL_EVALUATION_BOUNDARY,
		...value,
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	(receipt.integrity as { canonicalDigest: string }).canonicalDigest =
		technicalMigrationDigest(receipt);
	return receipt;
}

export function verifyTechnicalMigrationReceipt(value: unknown): TechnicalMigrationReceipt {
	const receipt = object(value) as unknown as TechnicalMigrationReceipt;
	if (
		receipt.schemaVersion !== TECHNICAL_MIGRATION_SCHEMA ||
		receipt.fixture !== 'angular-fuxa' ||
		canonicalize(receipt.boundary) !== canonicalize(TECHNICAL_EVALUATION_BOUNDARY) ||
		receipt.lanes?.length !== 2 ||
		receipt.locality?.nonLoopbackRequests !== 0 ||
		receipt.locality?.credentialsObserved !== false ||
		receipt.locality?.userOrPaymentDataObserved !== false ||
		receipt.locality?.serviceWorkers !== 0 ||
		!receipt.nonclaims?.length ||
		receipt.integrity?.algorithm !== 'sha256' ||
		technicalMigrationDigest(receipt) !== receipt.integrity.canonicalDigest
	)
		throw new Error('Technical migration receipt is invalid or strengthens an unknown state');
	return receipt;
}
