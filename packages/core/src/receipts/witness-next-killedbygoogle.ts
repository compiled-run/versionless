import { readFile } from 'node:fs/promises';
import { charIn, createRegExp } from 'magic-regexp';
import * as path from 'pathe';
import { canonicalize, sha256 } from './canonicalize.ts';
import type {
	WitnessGesture,
	WitnessNextPrerenderPayloadEvidence,
	WitnessRealAppRun,
} from './witness-real-app.ts';

export const WITNESS_NEXT_KILLED_BY_GOOGLE_SCHEMA =
	'versionless.witness-next-killedbygoogle.v1' as const;
export const WITNESS_NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH =
	'evidence/runs/witness-next-killedbygoogle/receipt.json' as const;
export const NEXT_KILLED_BY_GOOGLE_CANONICAL_RECEIPT_PATH =
	'evidence/runs/next-killedbygoogle-derived-state-to-memo/receipt.json' as const;
export const NEXT_KILLED_BY_GOOGLE_CANONICAL_DIGEST =
	'a018c6490cd559fab74ea402ff93660f053503dbed1a52ba9b68ed7fdc086b7c' as const;
export const WITNESS_NEXT_KILLED_BY_GOOGLE_ROUTES = [] as const;
export const WITNESS_NEXT_KILLED_BY_GOOGLE_INTERACTIONS = [
	{ kind: 'type', selector: '#searchBox' },
	{ kind: 'press', selector: '#searchBox' },
	{ kind: 'press', selector: '#searchBox' },
	{ kind: 'click', selector: '#react-select-filter-select-input' },
	{ kind: 'type', selector: '#react-select-filter-select-input' },
	{ kind: 'press', selector: '#react-select-filter-select-input' },
	{ kind: 'hover', selector: 'ul > li h2' },
	{ kind: 'scroll', selector: 'viewport' },
] as const;
export const WITNESS_NEXT_KILLED_BY_GOOGLE_ASSERTIONS = [
	'search',
	'keyboard filter',
	'filtered inventory',
	'clean page',
] as const;
export const WITNESS_NEXT_KILLED_BY_GOOGLE_TRACKED_EVENTS = [
	'change',
	'click',
	'input',
	'keydown',
	'mouseover',
] as const;
export const WITNESS_NEXT_KILLED_BY_GOOGLE_ACTIVE_EVENTS = [
	'click',
	'input',
	'keydown',
	'mouseover',
] as const;
export const WITNESS_NEXT_KILLED_BY_GOOGLE_EVENT_FLOORS = {
	click: 1,
	input: 2,
	keydown: 2,
	mouseover: 1,
} as const;
export const WITNESS_NEXT_KILLED_BY_GOOGLE_MUTATION = {
	path: 'index.html',
	bytes: 291_003,
	offsets: [80_815, 80_902, 236_235, 236_339],
	sourceSpan: 'Google+',
	mutatedSpan: 'Googlx+',
	beforeSha256: '8e44287105c02cbff82b950c6f48f9306baa5ab8ed08439cb5d25346e684908f',
	mutatedSha256: 'c379a48613e59032f6d9341e05437507bc717f309fe720533d4449ce7b8dce37',
	failureAssertion: 'page.bodyText contains "Google+"',
} as const;
export const NEXT_KILLED_BY_GOOGLE_SOURCE = {
	repository: 'https://github.com/codyogden/killedbygoogle',
	revision: '56809c31592e6ca1edce8af9bfe842fbcdf71f4d',
	tree: 'b8ac7b4fc3a1e12240f1848f6e8d98c1c7d80763',
	archiveSha256: 'c28878d0f65b56aa595763c852477fb0c1e3533e5c7f7ea9daa2be16f102368d',
	license: 'MIT',
	licenseSha256: '10547fb81e311e470cdcda5a273bac2a76f50ded6b33ce4362bcb05e1176d5e0',
} as const;
export const WITNESS_NEXT_KILLED_BY_GOOGLE_PRERENDER = {
	baseline: {
		buildId: 'syVkoUOI9y_1eQpBWrx_a',
		buildIdSha256: 'ef326a229da103c95a281791a9f637ec6404e8b63076099ec9386ab29fefe910',
		retainedIndexSha256: 'f30b96a81ddab38d65ff08bd8aa844ccaab9e9203858eb9673d364000497d58d',
		prerenderManifestSha256: 'd028a7b1b4c69e38d2c6a91911f19eceb9d3d8530b450ffd0e1cd84b5af3e455',
		dataRoute: '/_next/data/syVkoUOI9y_1eQpBWrx_a/index.json',
		sourcePath:
			'.versionless/stage/witness-real-app/killedbygoogle-retained/baseline-source/.next/server/pages/index.json',
		stagedPath: '_next/data/syVkoUOI9y_1eQpBWrx_a/index.json',
	},
	migrated: {
		buildId: 'Ta8U_1AmFceOdWrITQBKm',
		buildIdSha256: '87d93441783166e7503cbd47bf93b1ea2d4dbe213e33935e70b32e9a405b0b46',
		retainedIndexSha256: '8e44287105c02cbff82b950c6f48f9306baa5ab8ed08439cb5d25346e684908f',
		prerenderManifestSha256: '4a5ea4c87d9556f128d6409f397c2562195f11523ea2bdf5785f488e5a1f68b6',
		dataRoute: '/_next/data/Ta8U_1AmFceOdWrITQBKm/index.json',
		sourcePath:
			'.versionless/stage/witness-real-app/killedbygoogle-retained/migrated-source/.next/server/pages/index.json',
		stagedPath: '_next/data/Ta8U_1AmFceOdWrITQBKm/index.json',
	},
	payload: {
		bytes: 86_917,
		sha256: '9c438dbfa8ba2c6c9e17fbacd9503134ff0f947cbb30f3d4f0b5cb5d4afb0c25',
		keys: ['__N_SSG', 'pageProps'],
	},
} as const;

export type WitnessNextKilledByGoogleRun = WitnessRealAppRun & { behaviorDigest: string };
export type WitnessNextKilledByGoogleReceipt = {
	schemaVersion: typeof WITNESS_NEXT_KILLED_BY_GOOGLE_SCHEMA;
	result: 'pass';
	fixture: 'next-killedbygoogle-derived-state-to-memo';
	source: typeof NEXT_KILLED_BY_GOOGLE_SOURCE;
	provenance: Record<string, unknown>;
	canonicalReceipt: {
		path: typeof NEXT_KILLED_BY_GOOGLE_CANONICAL_RECEIPT_PATH;
		canonicalDigest: typeof NEXT_KILLED_BY_GOOGLE_CANONICAL_DIGEST;
		sha256: string;
	};
	runs: WitnessNextKilledByGoogleRun[];
	mutation: {
		seam: 'production-static-four-google-plus-spans';
		failure: 'witness-semantic-assertion';
		path: 'index.html';
		bytes: 291003;
		offsets: number[];
		sourceSpan: 'Google+';
		mutatedSpan: 'Googlx+';
		failureAssertion: 'page.bodyText contains "Google+"';
		intendedFailure: true;
		unrelatedErrors: 0;
		beforeSha256: typeof WITNESS_NEXT_KILLED_BY_GOOGLE_MUTATION.beforeSha256;
		mutatedSha256: typeof WITNESS_NEXT_KILLED_BY_GOOGLE_MUTATION.mutatedSha256;
		afterRestoreSha256: typeof WITNESS_NEXT_KILLED_BY_GOOGLE_MUTATION.beforeSha256;
		restoredByteIdentically: true;
		restoredRun: 'pass';
		restoredBehaviorDigest: string;
	};
	readiness: {
		reactLineage: { ready: 1; total: 4 };
		angularLineage: { ready: 1; total: 4 };
		olderNext: { ready: 0; total: 4; counted: false };
		harness: { ready: 0; total: 4 };
	};
	locality: { mode: 'offline'; successfulNonLoopback: 0; osWideIsolation: false };
	nonclaims: string[];
	integrity: { algorithm: 'sha256'; canonicalDigest: string };
};

const lowercaseSha256 = createRegExp(
	charIn('0123456789').from('a', 'f').times(64).at.lineStart().at.lineEnd(),
);
function digest(value: unknown): value is string {
	return typeof value === 'string' && lowercaseSha256.test(value);
}

export function witnessNextKilledByGoogleRawSemanticDigest(run: WitnessRealAppRun): string {
	return sha256(
		canonicalize({
			app: run.app,
			framework: run.framework,
			lane: run.lane,
			interactions: run.interactions,
			assertions: run.assertions,
			routes: run.routes,
			trackedEvents: run.trackedEvents,
			witnessRecord: run.witnessRecord,
			cleanPage: run.cleanPage,
			offlineEvidence: run.offlineEvidence,
			servedStatic: run.servedStatic,
			observerFinalization: run.observerFinalization,
			successfulNonLoopback: run.successfulNonLoopback,
		}),
	);
}

export function witnessNextKilledByGoogleBehaviorDigest(run: WitnessRealAppRun): string {
	const support = run.servedStatic.nextPrerenderPayload;
	return sha256(
		canonicalize({
			app: run.app,
			framework: run.framework,
			interactions: run.interactions,
			assertions: run.assertions,
			routes: run.routes,
			trackedEvents: run.trackedEvents,
			witnessRecord: {
				...run.witnessRecord,
				trackedEventCounts: {
					...WITNESS_NEXT_KILLED_BY_GOOGLE_EVENT_FLOORS,
					change: run.witnessRecord.trackedEventCounts.change,
				},
			},
			cleanPage: run.cleanPage,
			offlineEvidence: run.offlineEvidence,
			servedStaticPolicy: {
				transport: run.servedStatic.transport,
				documentFallback: run.servedStatic.documentFallback,
				missingAssets: run.servedStatic.missingAssets,
				traversal: run.servedStatic.traversal,
				serviceWorkerPaths: run.servedStatic.serviceWorkers.map((item) => item.path),
				byteIdentical: run.servedStatic.byteIdentical,
				hmrControls: run.servedStatic.hmrControls,
				nextPrerenderPayload:
					support?.state === 'exact-lane-bound-next-prerender'
						? {
								state: support.state,
								buildId: '<BUILD_ID>',
								dataRoute: '/_next/data/<BUILD_ID>/index.json',
								stagedPath: '_next/data/<BUILD_ID>/index.json',
								payload: support.payload,
								response: {
									...support.response,
									pathname: '/_next/data/<BUILD_ID>/index.json',
									resolvedFile: '_next/data/<BUILD_ID>/index.json',
								},
							}
						: support,
			},
			successfulNonLoopback: run.successfulNonLoopback,
		}),
	);
}

function exactPrerenderEvidence(
	value: WitnessNextPrerenderPayloadEvidence | undefined,
	lane: 'baseline' | 'migrated',
): boolean {
	if (value?.state !== 'exact-lane-bound-next-prerender') return false;
	const binding = WITNESS_NEXT_KILLED_BY_GOOGLE_PRERENDER[lane];
	const expected = {
		state: 'exact-lane-bound-next-prerender',
		lane,
		...binding,
		payload: WITNESS_NEXT_KILLED_BY_GOOGLE_PRERENDER.payload,
		response: {
			method: 'GET',
			pathname: binding.dataRoute,
			query: '',
			destination: 'empty',
			resolvedFile: binding.stagedPath,
			status: 200,
			mime: 'application/json',
			bytes: WITNESS_NEXT_KILLED_BY_GOOGLE_PRERENDER.payload.bytes,
			sha256: WITNESS_NEXT_KILLED_BY_GOOGLE_PRERENDER.payload.sha256,
		},
	};
	return canonicalize(value) === canonicalize(expected);
}

export function witnessNextKilledByGoogleDigest(receipt: WitnessNextKilledByGoogleReceipt): string {
	const copy = structuredClone(receipt);
	copy.integrity.canonicalDigest = '';
	return sha256(canonicalize(copy));
}

export function parseWitnessNextKilledByGoogleReceipt(
	value: unknown,
): WitnessNextKilledByGoogleReceipt {
	if (value === null || typeof value !== 'object' || Array.isArray(value))
		throw new Error('Witness Next KilledByGoogle receipt must be an object');
	const receipt = value as WitnessNextKilledByGoogleReceipt;
	if (
		receipt.schemaVersion !== WITNESS_NEXT_KILLED_BY_GOOGLE_SCHEMA ||
		receipt.result !== 'pass' ||
		receipt.fixture !== 'next-killedbygoogle-derived-state-to-memo' ||
		canonicalize(receipt.source) !== canonicalize(NEXT_KILLED_BY_GOOGLE_SOURCE) ||
		!Array.isArray(receipt.runs) ||
		receipt.runs.length !== 4
	)
		throw new Error('Witness Next KilledByGoogle receipt cardinality differs');
	const expected = new Set(['baseline:1', 'baseline:2', 'migrated:1', 'migrated:2']);
	const behaviors = new Set<string>();
	const gestures = ['click', 'hover', 'press', 'scroll', 'type'] satisfies WitnessGesture[];
	for (const run of receipt.runs) {
		const key = `${run.lane}:${run.pass}`;
		const counts = run.witnessRecord?.trackedEventCounts;
		const names = counts === undefined ? [] : Object.keys(counts).sort();
		const observed = new Set(run.interactions?.map((item) => item.kind));
		if (
			!expected.delete(key) ||
			run.app !== 'killedbygoogle' ||
			run.framework !== 'next' ||
			run.result !== 'pass' ||
			run.cleanPage !== true ||
			run.successfulNonLoopback !== 0 ||
			run.witnessRecord.consoleErrors !== 0 ||
			run.witnessRecord.pageErrors !== 0 ||
			run.witnessRecord.failedRequests !== 0 ||
			canonicalize(run.routes) !== canonicalize(WITNESS_NEXT_KILLED_BY_GOOGLE_ROUTES) ||
			canonicalize(run.witnessRecord.navigationPaths) !==
				canonicalize(WITNESS_NEXT_KILLED_BY_GOOGLE_ROUTES) ||
			canonicalize(run.interactions) !==
				canonicalize(WITNESS_NEXT_KILLED_BY_GOOGLE_INTERACTIONS) ||
			canonicalize(run.witnessRecord.interactions) !==
				canonicalize(WITNESS_NEXT_KILLED_BY_GOOGLE_INTERACTIONS) ||
			canonicalize(run.assertions) !==
				canonicalize(WITNESS_NEXT_KILLED_BY_GOOGLE_ASSERTIONS) ||
			canonicalize(run.trackedEvents) !==
				canonicalize(WITNESS_NEXT_KILLED_BY_GOOGLE_ACTIVE_EVENTS) ||
			canonicalize(names) !== canonicalize(WITNESS_NEXT_KILLED_BY_GOOGLE_TRACKED_EVENTS) ||
			WITNESS_NEXT_KILLED_BY_GOOGLE_TRACKED_EVENTS.some(
				(name) => !Number.isInteger(counts?.[name]),
			) ||
			Object.entries(WITNESS_NEXT_KILLED_BY_GOOGLE_EVENT_FLOORS).some(
				([name, floor]) => (counts?.[name] ?? 0) < floor,
			) ||
			gestures.some((gesture) => !observed.has(gesture)) ||
			run.offlineEvidence?.state !== 'not-applicable' ||
			run.servedStatic?.transport !== 'isolated-bounded-loopback-production-static' ||
			run.servedStatic.documentFallback !== 'index-only' ||
			run.servedStatic.missingAssets !== '404' ||
			run.servedStatic.traversal !== 'rejected' ||
			run.servedStatic.byteIdentical !== true ||
			run.servedStatic.hmrControls !== false ||
			run.servedStatic.inventory.beforeSha256 !== run.servedStatic.inventory.afterSha256 ||
			run.servedStatic.application.beforeSha256 !==
				run.servedStatic.application.afterSha256 ||
			run.servedStatic.serviceWorkers.length !== 0 ||
			!exactPrerenderEvidence(run.servedStatic.nextPrerenderPayload, run.lane) ||
			run.observerFinalization?.state !== 'target-closed' ||
			run.observerFinalization.detach !== 'owned-detach-complete' ||
			run.observerFinalization.pageClose !== 'owned-page-close-complete' ||
			!digest(run.semanticDigest) ||
			run.semanticDigest !== witnessNextKilledByGoogleRawSemanticDigest(run) ||
			!digest(run.behaviorDigest) ||
			run.behaviorDigest !== witnessNextKilledByGoogleBehaviorDigest(run)
		)
			throw new Error(`Witness Next KilledByGoogle run differs: ${key}`);
		behaviors.add(run.behaviorDigest);
	}
	if (expected.size !== 0 || behaviors.size !== 1)
		throw new Error('Witness Next KilledByGoogle behavioral parity differs');
	const mutation = receipt.mutation;
	if (
		receipt.canonicalReceipt?.path !== NEXT_KILLED_BY_GOOGLE_CANONICAL_RECEIPT_PATH ||
		receipt.canonicalReceipt.canonicalDigest !== NEXT_KILLED_BY_GOOGLE_CANONICAL_DIGEST ||
		!digest(receipt.canonicalReceipt.sha256) ||
		mutation?.seam !== 'production-static-four-google-plus-spans' ||
		mutation.failure !== 'witness-semantic-assertion' ||
		mutation.path !== WITNESS_NEXT_KILLED_BY_GOOGLE_MUTATION.path ||
		mutation.bytes !== WITNESS_NEXT_KILLED_BY_GOOGLE_MUTATION.bytes ||
		canonicalize(mutation.offsets) !==
			canonicalize(WITNESS_NEXT_KILLED_BY_GOOGLE_MUTATION.offsets) ||
		mutation.sourceSpan !== WITNESS_NEXT_KILLED_BY_GOOGLE_MUTATION.sourceSpan ||
		mutation.mutatedSpan !== WITNESS_NEXT_KILLED_BY_GOOGLE_MUTATION.mutatedSpan ||
		mutation.failureAssertion !== WITNESS_NEXT_KILLED_BY_GOOGLE_MUTATION.failureAssertion ||
		mutation.intendedFailure !== true ||
		mutation.unrelatedErrors !== 0 ||
		mutation.beforeSha256 !== WITNESS_NEXT_KILLED_BY_GOOGLE_MUTATION.beforeSha256 ||
		mutation.mutatedSha256 !== WITNESS_NEXT_KILLED_BY_GOOGLE_MUTATION.mutatedSha256 ||
		mutation.afterRestoreSha256 !== WITNESS_NEXT_KILLED_BY_GOOGLE_MUTATION.beforeSha256 ||
		mutation.restoredByteIdentically !== true ||
		mutation.restoredRun !== 'pass' ||
		mutation.restoredBehaviorDigest !== [...behaviors][0] ||
		canonicalize(receipt.readiness) !==
			canonicalize({
				reactLineage: { ready: 1, total: 4 },
				angularLineage: { ready: 1, total: 4 },
				olderNext: { ready: 0, total: 4, counted: false },
				harness: { ready: 0, total: 4 },
			}) ||
		receipt.locality?.mode !== 'offline' ||
		receipt.locality.successfulNonLoopback !== 0 ||
		receipt.locality.osWideIsolation !== false ||
		!receipt.nonclaims?.some((claim) => claim.includes('generic Next')) ||
		receipt.integrity?.algorithm !== 'sha256' ||
		receipt.integrity.canonicalDigest !== witnessNextKilledByGoogleDigest(receipt)
	)
		throw new Error('Witness Next KilledByGoogle receipt integrity or boundary differs');
	return receipt;
}

export function renderWitnessNextKilledByGoogleReceipt(
	receipt: WitnessNextKilledByGoogleReceipt,
): string {
	const support = (['baseline', 'migrated'] as const)
		.map((lane) => {
			const evidence = receipt.runs.find((run) => run.lane === lane)!.servedStatic
				.nextPrerenderPayload;
			if (evidence?.state !== 'exact-lane-bound-next-prerender')
				throw new Error(`Witness Next KilledByGoogle ${lane} prerender evidence is absent`);
			return `- ${lane}: build \`${evidence.buildId}\`; manifest \`${evidence.prerenderManifestSha256}\`; source/staged payload \`${evidence.payload.sha256}\` (${evidence.payload.bytes} bytes); GET \`${evidence.response.pathname}\` -> 200 \`${evidence.response.mime}\``;
		})
		.join('\n');
	return `# KilledByGoogle Next 12 direct-Witness receipt\n\n- Result: **pass**\n- Canonical SHA-256: \`${receipt.integrity.canonicalDigest}\`\n- Bound migration receipt: \`${receipt.canonicalReceipt.canonicalDigest}\`\n- Qualification runs: 2 baseline + 2 migrated production-static passes\n- Meaningful journey: 263 rows; one Google+ search result; keyboard reset; Apps (50) and 50 rows; hover and scroll\n- Raw navigation events per run: 0\n- Behavioral parity: \`${receipt.runs[0]!.behaviorDigest}\`\n- Mutation-red/restoration: exact missing Google+ assertion; zero unrelated errors; byte-identical restoration; restored run passed\n- Successful non-loopback requests: 0\n- Older Next readiness: 0/4, candidate not counted pending Judge audit\n- React lineage readiness: 1/4\n- Angular lineage readiness: 1/4\n- Harness readiness: 0/4\n\n## Exact prerender support\n\n${support}\n\n## Boundaries\n\n${receipt.nonclaims.map((claim) => `- ${claim}`).join('\n')}\n`;
}

export async function verifyWitnessNextKilledByGoogleEvidence(rootDir = '.'): Promise<{
	valid: true;
	digest: string;
	artifacts: 0;
	receipt: WitnessNextKilledByGoogleReceipt;
}> {
	const root = path.resolve(rootDir);
	const file = path.join(root, WITNESS_NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH);
	const receipt = parseWitnessNextKilledByGoogleReceipt(JSON.parse(await readFile(file, 'utf8')));
	const canonicalBytes = await readFile(
		path.join(root, NEXT_KILLED_BY_GOOGLE_CANONICAL_RECEIPT_PATH),
	);
	if (sha256(canonicalBytes) !== receipt.canonicalReceipt.sha256)
		throw new Error('Witness Next KilledByGoogle canonical receipt bytes drifted');
	if (
		(await readFile(path.join(path.dirname(file), 'receipt.md'), 'utf8')) !==
		renderWitnessNextKilledByGoogleReceipt(receipt)
	)
		throw new Error('Witness Next KilledByGoogle human receipt differs');
	return { valid: true, digest: receipt.integrity.canonicalDigest, artifacts: 0, receipt };
}

export function witnessNextKilledByGoogleAggregateMember(digestValue: string) {
	if (!digest(digestValue))
		throw new Error('Witness Next KilledByGoogle aggregate digest differs');
	return {
		id: 'witness-next-killedbygoogle',
		framework: 'nextjs',
		track: 'older-next-production-readiness-direct-witness-candidate',
		bundler: 'next-12.0.10-webpack-production-static',
		runtime: 'node-16.20.2',
		result: 'pass',
		receipt: WITNESS_NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH,
		digest: digestValue,
	};
}
