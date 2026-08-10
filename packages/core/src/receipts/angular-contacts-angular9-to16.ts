import { canonicalize, sha256 } from './canonicalize.ts';

export const ANGULAR_CONTACTS_RECEIPT_SCHEMA =
	'versionless.angular-contacts-angular9-to16.v1' as const;
export const ANGULAR_CONTACTS_TECHNICAL_BOUNDARY = {
	technicalEvaluationOnly: true,
	compatibilityBaseline: 'native-arm64-node16-not-original-node12-reproduction',
	exampleApplication: true,
	enterpriseAdoptionApproval: false,
	legalReviewRequired: true,
	redistributionAuthorized: false,
	complianceStatus: 'not-assessed',
	certificationClaim: false,
} as const;

export type AngularContactsReceipt = Readonly<{
	schemaVersion: typeof ANGULAR_CONTACTS_RECEIPT_SCHEMA;
	result: 'pass';
	source: Readonly<{
		commit: '875aa2df7f5f87b6731a1259b63e2b399fa5fb3f';
		archiveSha256: '93b2add6bbda402b86769b39a50cc4cae9050c363619ce3b5f20e8f7cd2f42f0';
	}>;
	baseline: Readonly<{
		node: '16.20.2';
		architecture: 'darwin-arm64';
		angular: '9.0.0';
		builder: 'webpack';
		aotBuilds: 2;
		deterministic: true;
	}>;
	migration: Readonly<{
		sequentialMajors: readonly [9, 10, 11, 12, 13, 14, 15, 16];
		aotAtEveryMajor: true;
		files: number;
		spans: number;
	}>;
	target: Readonly<{
		node: '18.20.8';
		architecture: 'darwin-arm64';
		angular: '16.2.12';
		cli: '16.2.16';
		builder: 'browser-esbuild';
		aotBuilds: 2;
		deterministic: true;
	}>;
	witness: Readonly<{
		observations: 8;
		directModule: 'link:../witness';
		restOperations: 5;
		socketEvents: 3;
		twoClientCausality: true;
		runsPerLane: 2;
	}>;
	mutation: Readonly<{
		seam: 'contactsAdapter.removeOne(id, state)';
		red: true;
		exactByteRestoration: true;
		restoredGreen: true;
	}>;
	locality: Readonly<{
		loopbackOnly: true;
		serviceWorkers: 0;
		remoteAssets: 0;
		credentials: false;
		customerOrPaymentData: false;
	}>;
	boundary: typeof ANGULAR_CONTACTS_TECHNICAL_BOUNDARY;
	nonclaims: readonly string[];
	integrity: Readonly<{ algorithm: 'sha256'; canonicalDigest: string }>;
}>;

function object(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`Angular Contacts receipt ${label} must be an object`);
	return value as Record<string, unknown>;
}

export function angularContactsReceiptDigest(receipt: AngularContactsReceipt): string {
	const copy = structuredClone(receipt);
	(copy.integrity as { canonicalDigest: string }).canonicalDigest = '';
	return sha256(canonicalize(copy));
}

export function finalizeAngularContactsReceipt(
	receipt: Omit<AngularContactsReceipt, 'schemaVersion' | 'integrity'>,
): AngularContactsReceipt {
	const complete = {
		schemaVersion: ANGULAR_CONTACTS_RECEIPT_SCHEMA,
		...receipt,
		integrity: { algorithm: 'sha256' as const, canonicalDigest: '' },
	} as AngularContactsReceipt;
	(complete.integrity as { canonicalDigest: string }).canonicalDigest =
		angularContactsReceiptDigest(complete);
	return complete;
}

export function verifyAngularContactsReceipt(value: unknown): AngularContactsReceipt {
	const receipt = object(value, 'document') as unknown as AngularContactsReceipt;
	if (
		receipt.schemaVersion !== ANGULAR_CONTACTS_RECEIPT_SCHEMA ||
		receipt.result !== 'pass' ||
		receipt.source?.commit !== '875aa2df7f5f87b6731a1259b63e2b399fa5fb3f' ||
		receipt.source?.archiveSha256 !==
			'93b2add6bbda402b86769b39a50cc4cae9050c363619ce3b5f20e8f7cd2f42f0' ||
		receipt.baseline?.node !== '16.20.2' ||
		receipt.baseline?.architecture !== 'darwin-arm64' ||
		receipt.baseline?.angular !== '9.0.0' ||
		receipt.baseline?.builder !== 'webpack' ||
		receipt.baseline?.aotBuilds !== 2 ||
		receipt.baseline?.deterministic !== true ||
		canonicalize(receipt.migration?.sequentialMajors) !==
			canonicalize([9, 10, 11, 12, 13, 14, 15, 16]) ||
		receipt.migration?.aotAtEveryMajor !== true ||
		receipt.target?.node !== '18.20.8' ||
		receipt.target?.architecture !== 'darwin-arm64' ||
		receipt.target?.angular !== '16.2.12' ||
		receipt.target?.cli !== '16.2.16' ||
		receipt.target?.builder !== 'browser-esbuild' ||
		receipt.target?.aotBuilds !== 2 ||
		receipt.target?.deterministic !== true ||
		receipt.witness?.observations !== 8 ||
		receipt.witness?.directModule !== 'link:../witness' ||
		receipt.witness?.restOperations !== 5 ||
		receipt.witness?.socketEvents !== 3 ||
		receipt.witness?.twoClientCausality !== true ||
		receipt.mutation?.seam !== 'contactsAdapter.removeOne(id, state)' ||
		receipt.mutation?.red !== true ||
		receipt.mutation?.exactByteRestoration !== true ||
		receipt.mutation?.restoredGreen !== true ||
		receipt.locality?.loopbackOnly !== true ||
		receipt.locality?.serviceWorkers !== 0 ||
		receipt.locality?.remoteAssets !== 0 ||
		receipt.locality?.credentials !== false ||
		receipt.locality?.customerOrPaymentData !== false ||
		canonicalize(receipt.boundary) !== canonicalize(ANGULAR_CONTACTS_TECHNICAL_BOUNDARY) ||
		receipt.integrity?.algorithm !== 'sha256' ||
		angularContactsReceiptDigest(receipt) !== receipt.integrity.canonicalDigest
	)
		throw new Error('Angular Contacts production receipt differs');
	return receipt;
}
