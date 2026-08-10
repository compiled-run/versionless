import { canonicalize, sha256 } from './canonicalize.ts';

export const ANGULAR_REALWORLD_PRODUCTION_PARITY_SCHEMA =
	'versionless.angular-realworld-production-parity.v1' as const;

export type AngularRealworldParityRun = Readonly<{
	lane: 'angular15' | 'angular16';
	pass: 1 | 2;
	user: 'author' | 'reader';
	result: 'pass';
	directWitnessModule: 'link:../witness';
	actions: Readonly<{
		registration: true;
		login: true;
		sessionReload: true;
		articleCreate: true;
		articleRead: true;
		articleUpdate: true;
		articleDelete: true;
		tagsFilter: true;
		profile: true;
		favorite: true;
		follow: true;
		commentCreate: true;
		commentDelete: true;
	}>;
	behaviorDigest: string;
	requestMethods: readonly string[];
	pageErrors: readonly [];
	consoleErrors: readonly [];
	failedRequests: readonly [];
	nonloopback: 0;
	serviceWorkers: Readonly<{ outputFiles: 0; registrations: 0; controllers: 0; requests: 0 }>;
}>;

export type AngularRealworldProductionParityReceipt = Readonly<{
	schemaVersion: typeof ANGULAR_REALWORLD_PRODUCTION_PARITY_SCHEMA;
	result: 'pass';
	counted: false;
	source: Readonly<{
		parentCommit: 'e28c8969aab9a27ece9873118b1ab7251f9ccb0c';
		childCommit: '0d28f5c63b9cd678a3f1f724f68d6e41363bdd5a';
		v15ClosureDigest: '4662a5453117b8acf46997880dd9a331ce86e9d8bf9a82dbde1f51694ab92f65';
		v16ClosureDigest: '0361276affa5c44353401a306226ed19c73628a8aa51260fe6926194119d612c';
	}>;
	builds: Readonly<{
		runtime: 'Node 18.20.8';
		productionAot: true;
		angular15Untouched: '34bbecf0f342a65b6c813e6d93f07dd93397716915f0673ac9251a175ca77274';
		angular16Untouched: 'f1915039e70a1f5058343b5daa08c97b4cdce496fee571abfab20a686877c185';
		overlayFrom: 'https://api.realworld.io/api';
		overlayTo: '/api';
		overlayOccurrences: Readonly<{ angular15: 1; angular16: 1 }>;
		angular15Overlay: string;
		angular16Overlay: string;
	}>;
	runs: readonly AngularRealworldParityRun[];
	mutation: Readonly<{
		lane: 'angular16';
		file: 'src/app/core/services/comments.service.ts';
		from: '/comments';
		to: '/commentz';
		intendedFailure: 'visible-created-comment-assertion';
		unrelatedAssertionsPassed: true;
		sourceRestoredByteIdentically: true;
		buildRestoredByteIdentically: true;
		restoredBuildDigest: string;
	}>;
	locality: Readonly<{
		mode: 'offline';
		successfulNonloopback: 0;
		serviceWorkerOutputFiles: 0;
		serviceWorkerRegistrations: 0;
		serviceWorkerControllers: 0;
		serviceWorkerRequests: 0;
	}>;
	nonclaims: readonly string[];
	integrity: Readonly<{ algorithm: 'sha256'; canonicalDigest: string }>;
}>;

export function angularRealworldProductionParityDigest(
	receipt: AngularRealworldProductionParityReceipt,
): string {
	const copy = structuredClone(receipt);
	(copy.integrity as { canonicalDigest: string }).canonicalDigest = '';
	return sha256(canonicalize(copy));
}

export function finalizeAngularRealworldProductionParity(
	receipt: Omit<AngularRealworldProductionParityReceipt, 'integrity'>,
): AngularRealworldProductionParityReceipt {
	const value = {
		...receipt,
		integrity: { algorithm: 'sha256' as const, canonicalDigest: '' },
	};
	(value.integrity as { canonicalDigest: string }).canonicalDigest =
		angularRealworldProductionParityDigest(value);
	return value;
}

export function parseAngularRealworldProductionParity(
	value: unknown,
): AngularRealworldProductionParityReceipt {
	if (value === null || typeof value !== 'object' || Array.isArray(value))
		throw new Error('Angular RealWorld production parity receipt must be an object');
	const receipt = value as AngularRealworldProductionParityReceipt;
	const expectedKeys = [
		'schemaVersion',
		'result',
		'counted',
		'source',
		'builds',
		'runs',
		'mutation',
		'locality',
		'nonclaims',
		'integrity',
	].sort();
	const keys = Object.keys(receipt).sort();
	const runKeys = new Set(receipt.runs?.map((run) => `${run.lane}:${run.pass}:${run.user}`));
	const actions = receipt.runs?.flatMap((run) => Object.values(run.actions));
	if (
		canonicalize(keys) !== canonicalize(expectedKeys) ||
		receipt.schemaVersion !== ANGULAR_REALWORLD_PRODUCTION_PARITY_SCHEMA ||
		receipt.result !== 'pass' ||
		receipt.counted !== false ||
		receipt.source?.parentCommit !== 'e28c8969aab9a27ece9873118b1ab7251f9ccb0c' ||
		receipt.source?.childCommit !== '0d28f5c63b9cd678a3f1f724f68d6e41363bdd5a' ||
		receipt.source?.v15ClosureDigest !==
			'4662a5453117b8acf46997880dd9a331ce86e9d8bf9a82dbde1f51694ab92f65' ||
		receipt.source?.v16ClosureDigest !==
			'0361276affa5c44353401a306226ed19c73628a8aa51260fe6926194119d612c' ||
		receipt.builds?.runtime !== 'Node 18.20.8' ||
		receipt.builds?.productionAot !== true ||
		receipt.builds?.angular15Untouched !==
			'34bbecf0f342a65b6c813e6d93f07dd93397716915f0673ac9251a175ca77274' ||
		receipt.builds?.angular16Untouched !==
			'f1915039e70a1f5058343b5daa08c97b4cdce496fee571abfab20a686877c185' ||
		receipt.builds?.overlayFrom !== 'https://api.realworld.io/api' ||
		receipt.builds?.overlayTo !== '/api' ||
		receipt.builds?.overlayOccurrences.angular15 !== 1 ||
		receipt.builds?.overlayOccurrences.angular16 !== 1 ||
		receipt.runs?.length !== 8 ||
		runKeys.size !== 8 ||
		actions.some((action) => action !== true) ||
		receipt.runs.some(
			(run) =>
				run.result !== 'pass' ||
				run.directWitnessModule !== 'link:../witness' ||
				run.behaviorDigest.length !== 64 ||
				run.nonloopback !== 0 ||
				run.pageErrors.length !== 0 ||
				run.consoleErrors.length !== 0 ||
				run.failedRequests.length !== 0 ||
				Object.values(run.serviceWorkers).some((count) => count !== 0),
		) ||
		receipt.mutation?.lane !== 'angular16' ||
		receipt.mutation?.file !== 'src/app/core/services/comments.service.ts' ||
		receipt.mutation?.from !== '/comments' ||
		receipt.mutation?.to !== '/commentz' ||
		receipt.mutation?.intendedFailure !== 'visible-created-comment-assertion' ||
		receipt.mutation?.unrelatedAssertionsPassed !== true ||
		receipt.mutation?.sourceRestoredByteIdentically !== true ||
		receipt.mutation?.buildRestoredByteIdentically !== true ||
		receipt.mutation?.restoredBuildDigest !== receipt.builds.angular16Overlay ||
		Object.values(receipt.locality ?? {}).some((value) =>
			typeof value === 'number' ? value !== 0 : value !== 'offline',
		) ||
		receipt.integrity?.algorithm !== 'sha256' ||
		angularRealworldProductionParityDigest(receipt) !== receipt.integrity.canonicalDigest
	)
		throw new Error('Angular RealWorld production parity receipt differs');
	return receipt;
}
