import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { canonicalize, sha256 } from './canonicalize.ts';

export const ANGULAR_REALWORLD_V15_TO_V16_RECEIPT = {
	path: 'evidence/runs/angular-realworld-v15-to-v16/receipt.json',
	fileSha256: '6cdfab902dc9f28a35fdb9e133b053053f7c47b9829f07b0af5cdcea9aa967b4',
	canonicalDigest: 'bba54bc67cf5686445b207c530e04c5f9d56cf87f495250e97329e1eed8c6ad1',
} as const;

export const ANGULAR_REALWORLD_V15_TO_V16_SUPPORT_ARTIFACTS = [
	[
		'evidence/ingests/angular-realworld-v16/github-commit-accept-415.json',
		'0dfb81fe6b2cc8e0cb0e549aea239dd835b55f8e6a2a2a140c4dff0e821cdf36',
	],
	[
		'evidence/ingests/angular-realworld-v16/receipt.json',
		'4716561cd8ae74c51056fdb191d75f5d9dfd1dd62d0c81ba2537c543dcb8a395',
	],
	[
		'evidence/runs/angular-realworld-v15-to-v16/attempt1-legacy-build.log',
		'659396969d0c5ce9a676f7d54b31e9603fe7f0a526d1ba233eb0cd06aba337ea',
	],
	[
		'evidence/runs/angular-realworld-v15-to-v16/attempt1-legacy-install.log',
		'cc19d1229a3bbeb03a73783ad47819438fedddb5a080b96cd2745650b5026fe8',
	],
	[
		'evidence/runs/angular-realworld-v15-to-v16/attempt1-target-install.log',
		'3c634b492720515950aebeef2931fca0c7817cc97d87232d48f66d52367b2508',
	],
	[
		'evidence/runs/angular-realworld-v15-to-v16/attempt1-target-peer-resolution-failure.json',
		'8bfdafebcdf7cf50ea88d8f8217666a3510fd862de1399b641b04a7879692be6',
	],
	[
		'evidence/runs/angular-realworld-v15-to-v16/t218-legacy-build.log',
		'55722e21d3ff8c03d5f78373d754c1b0df076fad0e200a4c04b67eb4edf21764',
	],
	[
		'evidence/runs/angular-realworld-v15-to-v16/t218-legacy-install.log',
		'cc19d1229a3bbeb03a73783ad47819438fedddb5a080b96cd2745650b5026fe8',
	],
	[
		'evidence/runs/angular-realworld-v15-to-v16/t218-mutation-enotcached.log',
		'8a10a78a285aef7a67e15ffbd5cced908c239315e8a8045ae2b5e32a5b866b1e',
	],
	[
		'evidence/runs/angular-realworld-v15-to-v16/t218-target-build.log',
		'52a893fafbc20f6462b6ff14590c27cb90b1eaef7ee32ae25712fd32e898978c',
	],
	[
		'evidence/runs/angular-realworld-v15-to-v16/t218-target-install.log',
		'dab7e9a2c4b321880102e6a37e6a89ed618f7d8c3a446bb9850f5301c5e62cd9',
	],
	[
		'evidence/runs/angular-realworld-v15-to-v16/t218-terminal-failure.json',
		'fec986ee2b9d97cd208f9e46670741bdbe2e645dc98e771063544a92c2753151',
	],
	[
		'evidence/runs/angular-realworld-v15-to-v16/target-api-mutation-build.log',
		'4bebe143df3a287613da8053ed774b0e11b1fecdf2087d81323b529dab88b831',
	],
	[
		'evidence/runs/angular-realworld-v15-to-v16/target-api-mutation.json',
		'f2be9ee52b940baaa47e56c9bd99a6c90f5c79941e1051ca5c581f50a4edeec6',
	],
	[
		'evidence/runs/angular-realworld-v15-to-v16/target-policy-restored-install.log',
		'436ccb9722ac506d5a890588b6870e12b589c8771a44fee1a02db52d0f92b533',
	],
	[
		'evidence/runs/angular-realworld-v15-to-v16/target-restored-build.log',
		'475492c446407564a4569fb6cabbe11f2d3b7960a147f4291175252f94edb63b',
	],
	[
		'evidence/runs/angular-realworld-v15-to-v16/target-restored-install.log',
		'148d2dd0647f7f676c11b5a54ce756f0fa163b23314020be542f7f66099439ad',
	],
	[
		'fixtures/angular-realworld-v15-to-v16/fixture.json',
		'54573d95d8c38979ea07745a7fa930ba4cc82ca33c76801c7a7bee2c1c4f49ff',
	],
	[
		'fixtures/angular-realworld-v15-to-v16/journey.json',
		'3c441f709151e885ff8acc64c16402c579662c228ce4bf77f8abd0170ad098ac',
	],
	[
		'fixtures/angular-realworld-v15-to-v16/provenance.json',
		'4849f1bb99658b893327b978ae69d7045a91631ccf339fda392faf2f27991c9b',
	],
] as const;

export type AngularRealworldV15ToV16Receipt = Record<string, unknown> & {
	integrity: { algorithm: 'sha256'; canonicalDigest: string };
	journeys: Array<Record<string, unknown>>;
};

function record(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`Angular RealWorld v15-to-v16 ${label} must be an object`);
	return value as Record<string, unknown>;
}

function exactKeys(
	value: Record<string, unknown>,
	expected: readonly string[],
	label: string,
): void {
	if (canonicalize(Object.keys(value).sort()) !== canonicalize([...expected].sort()))
		throw new Error(`Angular RealWorld v15-to-v16 ${label} keys differ`);
}

export function parseAngularRealworldV15ToV16Receipt(
	value: unknown,
): AngularRealworldV15ToV16Receipt {
	const receipt = record(value, 'receipt');
	exactKeys(
		receipt,
		[
			'schemaVersion',
			'result',
			'status',
			'source',
			'migration',
			'legacy',
			'target',
			'parity',
			'journeys',
			'mutation',
			'nonclaims',
			'integrity',
		],
		'receipt',
	);
	const integrity = record(receipt.integrity, 'integrity');
	const source = record(receipt.source, 'source');
	const migration = record(receipt.migration, 'migration');
	const legacy = record(receipt.legacy, 'legacy');
	const target = record(receipt.target, 'target');
	const targetInstall = record(target.install, 'target install');
	const mutation = record(receipt.mutation, 'mutation');
	const restoration = record(mutation.restoration, 'mutation restoration');
	if (!Array.isArray(receipt.journeys) || receipt.journeys.length !== 4)
		throw new Error('Angular RealWorld v15-to-v16 journeys differ');
	const lanes = receipt.journeys.map((value, index) => {
		const journey = record(value, `journey ${index}`);
		if (
			journey.result !== 'pass' ||
			journey.tagsRequests !== 1 ||
			journey.articlesRequests !== 1 ||
			journey.externalStylesheets !== 3 ||
			journey.storageInitiallyEmpty !== true ||
			!Array.isArray(journey.pageErrors) ||
			journey.pageErrors.length !== 0 ||
			journey.rejectedRequests !== 0 ||
			journey.successfulNonLoopback !== 0
		)
			throw new Error(`Angular RealWorld v15-to-v16 journey ${index} differs`);
		return `${String(journey.lane)}:${String(journey.pass)}`;
	});
	const copy = structuredClone(receipt);
	record(copy.integrity, 'canonical integrity').canonicalDigest = '';
	if (
		receipt.schemaVersion !== 'versionless.angular-realworld-v15-to-v16.v1' ||
		receipt.result !== 'pass' ||
		receipt.status !== 'pass' ||
		integrity.algorithm !== 'sha256' ||
		integrity.canonicalDigest !== ANGULAR_REALWORLD_V15_TO_V16_RECEIPT.canonicalDigest ||
		sha256(canonicalize(copy)) !== integrity.canonicalDigest ||
		source.parentCommit !== 'e28c8969aab9a27ece9873118b1ab7251f9ccb0c' ||
		source.targetCommit !== '0d28f5c63b9cd678a3f1f724f68d6e41363bdd5a' ||
		source.parentVerified !== true ||
		canonicalize(migration.changedFiles) !==
			canonicalize(['package-lock.json', 'package.json']) ||
		migration.applicationFilesChanged !== 0 ||
		legacy.distDigest !== '34bbecf0f342a65b6c813e6d93f07dd93397716915f0673ac9251a175ca77274' ||
		target.distDigest !== 'f1915039e70a1f5058343b5daa08c97b4cdce496fee571abfab20a686877c185' ||
		targetInstall.legacyPeerDeps !== true ||
		targetInstall.npmVersion !== '10.8.2' ||
		targetInstall.compatibilityReason !== 'immutable-upstream-rx-angular-15-peer-metadata' ||
		canonicalize(lanes) !== canonicalize(['legacy:1', 'legacy:2', 'target:1', 'target:2']) ||
		mutation.seam !== 'target-api-origin' ||
		mutation.file !== 'src/app/core/interceptors/api.interceptor.ts' ||
		mutation.originalHash !==
			'5afdac9c0ed22ea38ebba4e957455563ba92d9704a3027b952b239793bbbf1f4' ||
		mutation.reason !== 'unexpected-nonloopback-api-binding' ||
		canonicalize(mutation.rejectedUrls) !==
			canonicalize([
				'https://invalid.versionless.test/api/articles?limit=10&offset=0',
				'https://invalid.versionless.test/api/tags',
			]) ||
		mutation.successfulNonLoopback !== 0 ||
		restoration.sourceHash !==
			'5afdac9c0ed22ea38ebba4e957455563ba92d9704a3027b952b239793bbbf1f4' ||
		restoration.packageHash !==
			'48e23882a01326609a8c9b5fdf4b039a42ac013705a6d15b9104ddd3b28809ec' ||
		restoration.distDigest !==
			'f1915039e70a1f5058343b5daa08c97b4cdce496fee571abfab20a686877c185' ||
		restoration.status !== 'pass'
	)
		throw new Error('Angular RealWorld v15-to-v16 receipt differs');
	return receipt as AngularRealworldV15ToV16Receipt;
}

export async function verifyAngularRealworldV15ToV16Evidence(rootDir = '.'): Promise<{
	digest: string;
	artifacts: number;
	receipt: AngularRealworldV15ToV16Receipt;
}> {
	const root = path.resolve(rootDir);
	const receiptBytes = await readFile(path.join(root, ANGULAR_REALWORLD_V15_TO_V16_RECEIPT.path));
	if (sha256(receiptBytes) !== ANGULAR_REALWORLD_V15_TO_V16_RECEIPT.fileSha256)
		throw new Error('Angular RealWorld v15-to-v16 receipt file digest differs');
	const receipt = parseAngularRealworldV15ToV16Receipt(JSON.parse(receiptBytes.toString('utf8')));
	for (const [relative, expected] of ANGULAR_REALWORLD_V15_TO_V16_SUPPORT_ARTIFACTS)
		if (sha256(await readFile(path.join(root, relative))) !== expected)
			throw new Error(`Angular RealWorld v15-to-v16 support artifact differs: ${relative}`);
	return {
		digest: ANGULAR_REALWORLD_V15_TO_V16_RECEIPT.canonicalDigest,
		artifacts: ANGULAR_REALWORLD_V15_TO_V16_SUPPORT_ARTIFACTS.length,
		receipt,
	};
}
