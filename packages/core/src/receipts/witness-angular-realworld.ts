import { readFile } from 'node:fs/promises';
import { charIn, createRegExp } from 'magic-regexp';
import * as path from 'pathe';
import { canonicalize, sha256 } from './canonicalize.ts';
import type { WitnessGesture, WitnessRealAppRun } from './witness-real-app.ts';

export const WITNESS_ANGULAR_REALWORLD_SCHEMA = 'versionless.witness-angular-realworld.v1' as const;
export const WITNESS_ANGULAR_REALWORLD_RECEIPT_PATH =
	'evidence/runs/witness-angular-realworld/receipt.json' as const;
export const ANGULAR_REALWORLD_CANONICAL_RECEIPT_PATH =
	'evidence/runs/angular-realworld-v15-to-v16/receipt.json' as const;
export const ANGULAR_REALWORLD_CANONICAL_DIGEST =
	'bba54bc67cf5686445b207c530e04c5f9d56cf87f495250e97329e1eed8c6ad1' as const;
export const WITNESS_ANGULAR_REALWORLD_ROUTES = [
	'/',
	'/article/versionless-angular',
	'/register',
	'/register',
	'/register',
] as const;
export const WITNESS_ANGULAR_REALWORLD_MUTATION = {
	sourceSpan: '<app-root>Loading...</app-root>',
	mutatedSpan: '<app-root-disabled>Loading...</app-root-disabled>',
	beforeSha256: '681986b2faee1d58983451bf5579f17fee37451f8a2c2d0776ea9eec6f0551d3',
	mutatedSha256: '63359dc9a5e4223312565ca46b629789a83490f8f04c203cf4afd04b0797f232',
	failureAssertion: 'page.bodyText contains "Global Feed"',
} as const;
export const WITNESS_ANGULAR_REALWORLD_INTERACTIONS = [
	{ kind: 'click', selector: 'a.tag-pill' },
	{ kind: 'click', selector: 'a.preview-link' },
	{ kind: 'hover', selector: 'h1' },
	{ kind: 'scroll', selector: 'viewport' },
	{ kind: 'click', selector: 'a[routerlink="/register"]' },
	{ kind: 'type', selector: 'input[placeholder="Username"]' },
	{ kind: 'press', selector: 'input[placeholder="Username"]' },
] as const;
export const WITNESS_ANGULAR_REALWORLD_ASSERTIONS = [
	'feed',
	'tag interaction',
	'article route',
	'terminal article section rendered before observed scroll',
	'keyboard-backed registration input',
	'clean page',
] as const;
export const WITNESS_ANGULAR_REALWORLD_EVENT_FLOORS = {
	click: 3,
	input: 1,
	keydown: 1,
	mouseover: 1,
} as const;
export const WITNESS_ANGULAR_REALWORLD_TRACKED_EVENTS = [
	'click',
	'input',
	'keydown',
	'mouseover',
] as const;

export type WitnessAngularRealworldRun = WitnessRealAppRun & { behaviorDigest: string };

export type WitnessAngularRealworldReceipt = {
	schemaVersion: typeof WITNESS_ANGULAR_REALWORLD_SCHEMA;
	result: 'pass';
	fixture: 'angular-realworld-v15-to-v16';
	provenance: Record<string, unknown>;
	canonicalReceipt: {
		path: typeof ANGULAR_REALWORLD_CANONICAL_RECEIPT_PATH;
		canonicalDigest: typeof ANGULAR_REALWORLD_CANONICAL_DIGEST;
		sha256: string;
	};
	runs: WitnessAngularRealworldRun[];
	mutation: {
		seam: 'production-static-angular-bootstrap-root';
		failure: 'witness-semantic-assertion';
		sourceSpan: typeof WITNESS_ANGULAR_REALWORLD_MUTATION.sourceSpan;
		mutatedSpan: typeof WITNESS_ANGULAR_REALWORLD_MUTATION.mutatedSpan;
		failureAssertion: typeof WITNESS_ANGULAR_REALWORLD_MUTATION.failureAssertion;
		intendedFailure: true;
		beforeSha256: typeof WITNESS_ANGULAR_REALWORLD_MUTATION.beforeSha256;
		mutatedSha256: typeof WITNESS_ANGULAR_REALWORLD_MUTATION.mutatedSha256;
		afterRestoreSha256: typeof WITNESS_ANGULAR_REALWORLD_MUTATION.beforeSha256;
		restoredByteIdentically: true;
		restoredRun: 'pass';
		restoredBehaviorDigest: string;
	};
	readiness: {
		angularLineage: { ready: 1; total: 4 };
		harness: { ready: 0; total: 4 };
		phonecat: 'unsupported-visible-transition-not-counted';
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

export function witnessAngularRealworldBehaviorDigest(run: WitnessRealAppRun): string {
	const normalizedWitnessRecord = {
		...run.witnessRecord,
		trackedEventCounts: WITNESS_ANGULAR_REALWORLD_EVENT_FLOORS,
	};
	return sha256(
		canonicalize({
			app: run.app,
			framework: run.framework,
			interactions: run.interactions,
			assertions: run.assertions,
			routes: run.routes,
			trackedEvents: run.trackedEvents,
			witnessRecord: normalizedWitnessRecord,
			cleanPage: run.cleanPage,
			offlineEvidence: run.offlineEvidence,
			servedStaticPolicy: {
				transport: run.servedStatic.transport,
				documentFallback: run.servedStatic.documentFallback,
				missingAssets: run.servedStatic.missingAssets,
				traversal: run.servedStatic.traversal,
				files: run.servedStatic.inventory.files,
				serviceWorkerPaths: run.servedStatic.serviceWorkers.map((item) => item.path),
				byteIdentical: run.servedStatic.byteIdentical,
				hmrControls: run.servedStatic.hmrControls,
			},
			successfulNonLoopback: run.successfulNonLoopback,
		}),
	);
}

export function witnessAngularRealworldRawSemanticDigest(run: WitnessRealAppRun): string {
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

export function witnessAngularRealworldDigest(receipt: WitnessAngularRealworldReceipt): string {
	const copy = structuredClone(receipt);
	copy.integrity.canonicalDigest = '';
	return sha256(canonicalize(copy));
}

export function parseWitnessAngularRealworldReceipt(
	value: unknown,
): WitnessAngularRealworldReceipt {
	if (value === null || typeof value !== 'object' || Array.isArray(value))
		throw new Error('Witness Angular RealWorld receipt must be an object');
	const receipt = value as WitnessAngularRealworldReceipt;
	if (
		receipt.schemaVersion !== WITNESS_ANGULAR_REALWORLD_SCHEMA ||
		receipt.result !== 'pass' ||
		receipt.fixture !== 'angular-realworld-v15-to-v16' ||
		!Array.isArray(receipt.runs) ||
		receipt.runs.length !== 4
	)
		throw new Error('Witness Angular RealWorld receipt cardinality differs');
	const expected = new Set(['baseline:1', 'baseline:2', 'migrated:1', 'migrated:2']);
	const behaviorDigests = new Set<string>();
	const requiredGestures = [
		'click',
		'hover',
		'press',
		'scroll',
		'type',
	] satisfies WitnessGesture[];
	for (const run of receipt.runs) {
		const key = `${run.lane}:${run.pass}`;
		const gestures = new Set(run.interactions?.map((interaction) => interaction.kind));
		const eventCounts = run.witnessRecord?.trackedEventCounts;
		const eventNames = eventCounts === undefined ? [] : Object.keys(eventCounts).sort();
		const eventFloorsSatisfied = WITNESS_ANGULAR_REALWORLD_TRACKED_EVENTS.every(
			(name) =>
				Number.isInteger(eventCounts?.[name]) &&
				(eventCounts?.[name] ?? 0) >= WITNESS_ANGULAR_REALWORLD_EVENT_FLOORS[name],
		);
		if (
			!expected.delete(key) ||
			run.app !== 'angular-realworld' ||
			run.framework !== 'angular' ||
			run.result !== 'pass' ||
			run.cleanPage !== true ||
			run.successfulNonLoopback !== 0 ||
			run.witnessRecord?.consoleErrors !== 0 ||
			run.witnessRecord.pageErrors !== 0 ||
			run.witnessRecord.failedRequests !== 0 ||
			canonicalize(run.routes) !== canonicalize(WITNESS_ANGULAR_REALWORLD_ROUTES) ||
			canonicalize(run.witnessRecord.navigationPaths) !==
				canonicalize(WITNESS_ANGULAR_REALWORLD_ROUTES) ||
			canonicalize(run.interactions) !==
				canonicalize(WITNESS_ANGULAR_REALWORLD_INTERACTIONS) ||
			canonicalize(run.witnessRecord.interactions) !==
				canonicalize(WITNESS_ANGULAR_REALWORLD_INTERACTIONS) ||
			canonicalize(run.assertions) !== canonicalize(WITNESS_ANGULAR_REALWORLD_ASSERTIONS) ||
			canonicalize(run.trackedEvents) !==
				canonicalize(WITNESS_ANGULAR_REALWORLD_TRACKED_EVENTS) ||
			canonicalize(eventNames) !== canonicalize(WITNESS_ANGULAR_REALWORLD_TRACKED_EVENTS) ||
			!eventFloorsSatisfied ||
			requiredGestures.some((gesture) => !gestures.has(gesture)) ||
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
			run.observerFinalization?.state !== 'target-closed' ||
			run.observerFinalization.detach !== 'owned-detach-complete' ||
			run.observerFinalization.pageClose !== 'owned-page-close-complete' ||
			!digest(run.semanticDigest) ||
			run.semanticDigest !== witnessAngularRealworldRawSemanticDigest(run) ||
			!digest(run.behaviorDigest) ||
			run.behaviorDigest !== witnessAngularRealworldBehaviorDigest(run)
		)
			throw new Error(`Witness Angular RealWorld run differs: ${key}`);
		behaviorDigests.add(run.behaviorDigest);
	}
	if (expected.size !== 0 || behaviorDigests.size !== 1)
		throw new Error('Witness Angular RealWorld behavioral parity differs');
	if (
		receipt.canonicalReceipt?.path !== ANGULAR_REALWORLD_CANONICAL_RECEIPT_PATH ||
		receipt.canonicalReceipt.canonicalDigest !== ANGULAR_REALWORLD_CANONICAL_DIGEST ||
		!digest(receipt.canonicalReceipt.sha256) ||
		receipt.mutation?.seam !== 'production-static-angular-bootstrap-root' ||
		receipt.mutation.failure !== 'witness-semantic-assertion' ||
		receipt.mutation.sourceSpan !== WITNESS_ANGULAR_REALWORLD_MUTATION.sourceSpan ||
		receipt.mutation.mutatedSpan !== WITNESS_ANGULAR_REALWORLD_MUTATION.mutatedSpan ||
		receipt.mutation.failureAssertion !== WITNESS_ANGULAR_REALWORLD_MUTATION.failureAssertion ||
		receipt.mutation.intendedFailure !== true ||
		receipt.mutation.beforeSha256 !== WITNESS_ANGULAR_REALWORLD_MUTATION.beforeSha256 ||
		receipt.mutation.mutatedSha256 !== WITNESS_ANGULAR_REALWORLD_MUTATION.mutatedSha256 ||
		receipt.mutation.afterRestoreSha256 !== WITNESS_ANGULAR_REALWORLD_MUTATION.beforeSha256 ||
		receipt.mutation.restoredByteIdentically !== true ||
		receipt.mutation.restoredRun !== 'pass' ||
		receipt.mutation.restoredBehaviorDigest !== [...behaviorDigests][0] ||
		canonicalize(receipt.readiness) !==
			canonicalize({
				angularLineage: { ready: 1, total: 4 },
				harness: { ready: 0, total: 4 },
				phonecat: 'unsupported-visible-transition-not-counted',
			}) ||
		receipt.locality?.mode !== 'offline' ||
		receipt.locality.successfulNonLoopback !== 0 ||
		receipt.locality.osWideIsolation !== false ||
		!receipt.nonclaims?.some((claim) => claim.includes('generic Angular')) ||
		receipt.integrity?.algorithm !== 'sha256' ||
		receipt.integrity.canonicalDigest !== witnessAngularRealworldDigest(receipt)
	)
		throw new Error('Witness Angular RealWorld receipt integrity or boundary differs');
	return receipt;
}

export function renderWitnessAngularRealworldReceipt(
	receipt: WitnessAngularRealworldReceipt,
): string {
	return `# Angular RealWorld direct-Witness receipt\n\n- Result: **pass**\n- Canonical SHA-256: \`${receipt.integrity.canonicalDigest}\`\n- Bound migration receipt: \`${receipt.canonicalReceipt.canonicalDigest}\`\n- Qualification runs: 2 baseline + 2 migrated production-static passes\n- Interaction coverage per run: click, type, press, hover, scroll\n- Behavioral parity: \`${receipt.runs[0]!.behaviorDigest}\`\n- Mutation-red/restoration: intended Witness assertion failure; byte-identical restoration; restored run passed\n- Successful non-loopback requests: 0\n- Angular lineage readiness: 1/4\n- Harness readiness: 0/4\n- PhoneCat: unsupported visible-transition result retained and not counted\n\n## Boundaries\n\n${receipt.nonclaims.map((claim) => `- ${claim}`).join('\n')}\n`;
}

export async function verifyWitnessAngularRealworldEvidence(
	rootDir = '.',
): Promise<{ valid: true; digest: string; artifacts: 0; receipt: WitnessAngularRealworldReceipt }> {
	const root = path.resolve(rootDir);
	const receiptFile = path.join(root, WITNESS_ANGULAR_REALWORLD_RECEIPT_PATH);
	const receipt = parseWitnessAngularRealworldReceipt(
		JSON.parse(await readFile(receiptFile, 'utf8')),
	);
	const canonicalBytes = await readFile(
		path.join(root, ANGULAR_REALWORLD_CANONICAL_RECEIPT_PATH),
	);
	if (sha256(canonicalBytes) !== receipt.canonicalReceipt.sha256)
		throw new Error('Witness Angular RealWorld canonical receipt bytes drifted');
	const markdown = await readFile(path.join(path.dirname(receiptFile), 'receipt.md'), 'utf8');
	if (markdown !== renderWitnessAngularRealworldReceipt(receipt))
		throw new Error('Witness Angular RealWorld human receipt differs');
	return {
		valid: true,
		digest: receipt.integrity.canonicalDigest,
		artifacts: 0,
		receipt,
	};
}

export function witnessAngularRealworldAggregateMember(digestValue: string) {
	if (!digest(digestValue)) throw new Error('Witness Angular RealWorld aggregate digest differs');
	return {
		id: 'witness-angular-realworld',
		framework: 'angular',
		track: 'production-readiness-direct-witness',
		bundler: 'angular-cli-architect-aot-15-to-16',
		runtime: 'node-18.20.8',
		result: 'pass',
		receipt: WITNESS_ANGULAR_REALWORLD_RECEIPT_PATH,
		digest: digestValue,
	};
}
