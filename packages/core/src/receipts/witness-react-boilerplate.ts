import { readFile } from 'node:fs/promises';
import { charIn, createRegExp } from 'magic-regexp';
import * as path from 'pathe';
import { canonicalize, sha256 } from './canonicalize.ts';
import type { WitnessGesture, WitnessRealAppRun } from './witness-real-app.ts';

export const WITNESS_REACT_BOILERPLATE_SCHEMA = 'versionless.witness-react-boilerplate.v1' as const;
export const WITNESS_REACT_BOILERPLATE_RECEIPT_PATH =
	'evidence/runs/witness-react-boilerplate/receipt.json' as const;
export const REACT_BOILERPLATE_CANONICAL_RECEIPT_PATH =
	'evidence/runs/react-boilerplate-v4-composed/t060-run.json' as const;
export const REACT_BOILERPLATE_CANONICAL_DIGEST =
	'52400147929220935a9ebe47a16c8dff50b5c28e9d51c930d000c99c2bdc8a21' as const;
export const REACT_BOILERPLATE_CANONICAL_SHA256 =
	'ea708cf382e4911057225cc732ee0e7cd294985c0c97690b8147e84d00e26954' as const;
export const WITNESS_REACT_BOILERPLATE_ROUTES = ['/features', '/', '/', '/'] as const;
export const WITNESS_REACT_BOILERPLATE_INTERACTIONS = [
	{ kind: 'click', selector: 'a[href="/features"]' },
	{ kind: 'click', selector: 'a[href="/"]' },
	{ kind: 'click', selector: 'select' },
	{ kind: 'press', selector: 'select' },
	{ kind: 'hover', selector: '#username' },
	{ kind: 'type', selector: '#username' },
	{ kind: 'press', selector: '#username' },
	{ kind: 'scroll', selector: 'viewport' },
	{ kind: 'type', selector: '#username' },
	{ kind: 'press', selector: '#username' },
] as const;
export const WITNESS_REACT_BOILERPLATE_ASSERTIONS = [
	'feature route',
	'keyboard locale selection',
	'canonical repository payload',
	'offline shell render and state reset',
	'clean page',
] as const;
export const WITNESS_REACT_BOILERPLATE_TRACKED_EVENTS = [
	'change',
	'click',
	'input',
	'keydown',
	'mouseover',
] as const;
export const WITNESS_REACT_BOILERPLATE_EVENT_FLOORS = {
	change: 1,
	click: 3,
	input: 2,
	keydown: 3,
	mouseover: 1,
} as const;
export const WITNESS_REACT_BOILERPLATE_MUTATION = {
	path: 'assets/index-U4Un0wt4.js',
	offset: 389_492,
	bytes: 52,
	sourceSpan: 'Beginnen Sie Ihr nächstes React Projekt in Sekunden',
	mutatedSpan: 'Beginnen Sie Ihr nächstes React Projekt in SekundeX',
	beforeSha256: '3bad33c507fa197938885575224ebf5fd50b5b9b3492adae3981fb0cb0fd99f3',
	mutatedSha256: 'cb004a72b61a148690a6aaf246d032fb1bfc143607c5303aeca6ea2e32419111',
	failureAssertion:
		'page.bodyText contains "Beginnen Sie Ihr nächstes React Projekt in Sekunden"',
} as const;
export const REACT_BOILERPLATE_SOURCE = {
	repository: 'https://github.com/react-boilerplate/react-boilerplate',
	revision: 'd19099afeff64ecfb09133c06c1cb18c0d40887e',
	archiveSha256: 'd6ca60a3c8881ae2be26a8d04e00da4d922a6653f8512f2b12ac55d48f2ce2d5',
	license: 'MIT',
	licenseSha256: 'e773e6b91c13f55310668e15ce178a2fcf779ff39dbcc0b910b4b5f1ecb17acb',
} as const;

export type WitnessReactBoilerplateRun = WitnessRealAppRun & { behaviorDigest: string };
export type WitnessReactBoilerplateReceipt = {
	schemaVersion: typeof WITNESS_REACT_BOILERPLATE_SCHEMA;
	result: 'pass';
	fixture: 'react-boilerplate-v4-composed';
	source: typeof REACT_BOILERPLATE_SOURCE;
	provenance: Record<string, unknown>;
	canonicalReceipt: {
		path: typeof REACT_BOILERPLATE_CANONICAL_RECEIPT_PATH;
		canonicalDigest: typeof REACT_BOILERPLATE_CANONICAL_DIGEST;
		sha256: typeof REACT_BOILERPLATE_CANONICAL_SHA256;
	};
	runs: WitnessReactBoilerplateRun[];
	mutation: {
		seam: 'production-static-german-heading';
		failure: 'witness-semantic-assertion';
		path: typeof WITNESS_REACT_BOILERPLATE_MUTATION.path;
		offset: typeof WITNESS_REACT_BOILERPLATE_MUTATION.offset;
		bytes: typeof WITNESS_REACT_BOILERPLATE_MUTATION.bytes;
		sourceSpan: typeof WITNESS_REACT_BOILERPLATE_MUTATION.sourceSpan;
		mutatedSpan: typeof WITNESS_REACT_BOILERPLATE_MUTATION.mutatedSpan;
		failureAssertion: typeof WITNESS_REACT_BOILERPLATE_MUTATION.failureAssertion;
		intendedFailure: true;
		beforeSha256: typeof WITNESS_REACT_BOILERPLATE_MUTATION.beforeSha256;
		mutatedSha256: typeof WITNESS_REACT_BOILERPLATE_MUTATION.mutatedSha256;
		afterRestoreSha256: typeof WITNESS_REACT_BOILERPLATE_MUTATION.beforeSha256;
		restoredByteIdentically: true;
		restoredRun: 'pass';
		restoredBehaviorDigest: string;
	};
	readiness: {
		reactLineage: { ready: 0; total: 4; counted: false };
		angularLineage: { ready: 1; total: 4 };
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

export function witnessReactBoilerplateRawSemanticDigest(run: WitnessRealAppRun): string {
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

export function witnessReactBoilerplateBehaviorDigest(run: WitnessRealAppRun): string {
	const offline = run.offlineEvidence;
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
				trackedEventCounts: WITNESS_REACT_BOILERPLATE_EVENT_FLOORS,
			},
			cleanPage: run.cleanPage,
			offlineEvidence:
				offline.state === 'react-shell-rendered-state-reset'
					? {
							state: offline.state,
							shellRendered: offline.shellRendered,
							usernameReset: offline.usernameReset,
							repositoriesReset: offline.repositoriesReset,
							apiResponseCaching: offline.apiResponseCaching,
							reduxPersistence: offline.reduxPersistence,
							priorResultPersistence: offline.priorResultPersistence,
							harnessFulfillment: offline.harnessFulfillment,
							serviceWorkerEvidence: offline.serviceWorkerEvidence,
							lifecycle: {
								state: offline.lifecycle.state,
								ready: {
									state: offline.lifecycle.ready.state,
									registration: offline.lifecycle.ready.registration,
									controller: offline.lifecycle.ready.controller,
								},
								controlled: {
									state: offline.lifecycle.controlled.state,
									registration: offline.lifecycle.controlled.registration,
									controller: offline.lifecycle.controlled.controller,
								},
								offlineServerRequests: offline.lifecycle.offlineServerRequests,
							},
						}
					: offline,
			servedStaticPolicy: {
				transport: run.servedStatic.transport,
				documentFallback: run.servedStatic.documentFallback,
				missingAssets: run.servedStatic.missingAssets,
				traversal: run.servedStatic.traversal,
				serviceWorkerPaths: run.servedStatic.serviceWorkers.map((item) => item.path),
				byteIdentical: run.servedStatic.byteIdentical,
				hmrControls: run.servedStatic.hmrControls,
			},
			successfulNonLoopback: run.successfulNonLoopback,
		}),
	);
}

export function witnessReactBoilerplateDigest(receipt: WitnessReactBoilerplateReceipt): string {
	const copy = structuredClone(receipt);
	copy.integrity.canonicalDigest = '';
	return sha256(canonicalize(copy));
}

export function parseWitnessReactBoilerplateReceipt(
	value: unknown,
): WitnessReactBoilerplateReceipt {
	if (value === null || typeof value !== 'object' || Array.isArray(value))
		throw new Error('Witness React Boilerplate receipt must be an object');
	const receipt = value as WitnessReactBoilerplateReceipt;
	if (
		receipt.schemaVersion !== WITNESS_REACT_BOILERPLATE_SCHEMA ||
		receipt.result !== 'pass' ||
		receipt.fixture !== 'react-boilerplate-v4-composed' ||
		canonicalize(receipt.source) !== canonicalize(REACT_BOILERPLATE_SOURCE) ||
		!Array.isArray(receipt.runs) ||
		receipt.runs.length !== 4
	)
		throw new Error('Witness React Boilerplate receipt cardinality differs');
	const expected = new Set(['baseline:1', 'baseline:2', 'migrated:1', 'migrated:2']);
	const behaviorDigests = new Set<string>();
	const gestures = ['click', 'hover', 'press', 'scroll', 'type'] satisfies WitnessGesture[];
	for (const run of receipt.runs) {
		const key = `${run.lane}:${run.pass}`;
		const counts = run.witnessRecord?.trackedEventCounts;
		const eventNames = counts === undefined ? [] : Object.keys(counts).sort();
		const observedGestures = new Set(run.interactions?.map((item) => item.kind));
		if (
			!expected.delete(key) ||
			run.app !== 'react-boilerplate' ||
			run.framework !== 'react' ||
			run.result !== 'pass' ||
			run.cleanPage !== true ||
			run.successfulNonLoopback !== 0 ||
			run.witnessRecord.consoleErrors !== 0 ||
			run.witnessRecord.pageErrors !== 0 ||
			run.witnessRecord.failedRequests !== 0 ||
			canonicalize(run.routes) !== canonicalize(WITNESS_REACT_BOILERPLATE_ROUTES) ||
			canonicalize(run.witnessRecord.navigationPaths) !==
				canonicalize(WITNESS_REACT_BOILERPLATE_ROUTES) ||
			canonicalize(run.interactions) !==
				canonicalize(WITNESS_REACT_BOILERPLATE_INTERACTIONS) ||
			canonicalize(run.witnessRecord.interactions) !==
				canonicalize(WITNESS_REACT_BOILERPLATE_INTERACTIONS) ||
			canonicalize(run.assertions) !== canonicalize(WITNESS_REACT_BOILERPLATE_ASSERTIONS) ||
			canonicalize(run.trackedEvents) !==
				canonicalize(WITNESS_REACT_BOILERPLATE_TRACKED_EVENTS) ||
			canonicalize(eventNames) !== canonicalize(WITNESS_REACT_BOILERPLATE_TRACKED_EVENTS) ||
			WITNESS_REACT_BOILERPLATE_TRACKED_EVENTS.some(
				(name) =>
					!Number.isInteger(counts?.[name]) ||
					(counts?.[name] ?? 0) < WITNESS_REACT_BOILERPLATE_EVENT_FLOORS[name],
			) ||
			gestures.some((gesture) => !observedGestures.has(gesture)) ||
			run.offlineEvidence?.state !== 'react-shell-rendered-state-reset' ||
			run.offlineEvidence.lifecycle?.state !==
				'ready-online-reload-controlled-offline-reset' ||
			run.offlineEvidence.lifecycle.offlineServerRequests !== 0 ||
			run.servedStatic?.transport !== 'isolated-bounded-loopback-production-static' ||
			run.servedStatic.documentFallback !== 'index-only' ||
			run.servedStatic.missingAssets !== '404' ||
			run.servedStatic.traversal !== 'rejected' ||
			run.servedStatic.byteIdentical !== true ||
			run.servedStatic.hmrControls !== false ||
			run.servedStatic.inventory.beforeSha256 !== run.servedStatic.inventory.afterSha256 ||
			run.servedStatic.application.beforeSha256 !==
				run.servedStatic.application.afterSha256 ||
			run.servedStatic.serviceWorkers.length !== 1 ||
			run.servedStatic.serviceWorkers[0]?.path !== 'sw.js' ||
			run.servedStatic.serviceWorkers[0].beforeSha256 !==
				run.servedStatic.serviceWorkers[0].afterSha256 ||
			run.observerFinalization?.state !== 'target-closed' ||
			run.observerFinalization.detach !== 'owned-detach-complete' ||
			run.observerFinalization.pageClose !== 'owned-page-close-complete' ||
			!digest(run.semanticDigest) ||
			run.semanticDigest !== witnessReactBoilerplateRawSemanticDigest(run) ||
			!digest(run.behaviorDigest) ||
			run.behaviorDigest !== witnessReactBoilerplateBehaviorDigest(run)
		)
			throw new Error(`Witness React Boilerplate run differs: ${key}`);
		behaviorDigests.add(run.behaviorDigest);
	}
	if (expected.size !== 0 || behaviorDigests.size !== 1)
		throw new Error('Witness React Boilerplate behavioral parity differs');
	const mutation = receipt.mutation;
	if (
		receipt.canonicalReceipt?.path !== REACT_BOILERPLATE_CANONICAL_RECEIPT_PATH ||
		receipt.canonicalReceipt.canonicalDigest !== REACT_BOILERPLATE_CANONICAL_DIGEST ||
		receipt.canonicalReceipt.sha256 !== REACT_BOILERPLATE_CANONICAL_SHA256 ||
		mutation?.seam !== 'production-static-german-heading' ||
		mutation.failure !== 'witness-semantic-assertion' ||
		mutation.path !== WITNESS_REACT_BOILERPLATE_MUTATION.path ||
		mutation.offset !== WITNESS_REACT_BOILERPLATE_MUTATION.offset ||
		mutation.bytes !== WITNESS_REACT_BOILERPLATE_MUTATION.bytes ||
		mutation.sourceSpan !== WITNESS_REACT_BOILERPLATE_MUTATION.sourceSpan ||
		mutation.mutatedSpan !== WITNESS_REACT_BOILERPLATE_MUTATION.mutatedSpan ||
		mutation.failureAssertion !== WITNESS_REACT_BOILERPLATE_MUTATION.failureAssertion ||
		mutation.intendedFailure !== true ||
		mutation.beforeSha256 !== WITNESS_REACT_BOILERPLATE_MUTATION.beforeSha256 ||
		mutation.mutatedSha256 !== WITNESS_REACT_BOILERPLATE_MUTATION.mutatedSha256 ||
		mutation.afterRestoreSha256 !== WITNESS_REACT_BOILERPLATE_MUTATION.beforeSha256 ||
		mutation.restoredByteIdentically !== true ||
		mutation.restoredRun !== 'pass' ||
		mutation.restoredBehaviorDigest !== [...behaviorDigests][0] ||
		canonicalize(receipt.readiness) !==
			canonicalize({
				reactLineage: { ready: 0, total: 4, counted: false },
				angularLineage: { ready: 1, total: 4 },
				harness: { ready: 0, total: 4 },
			}) ||
		receipt.locality?.mode !== 'offline' ||
		receipt.locality.successfulNonLoopback !== 0 ||
		receipt.locality.osWideIsolation !== false ||
		!receipt.nonclaims?.some((claim) => claim.includes('generic React')) ||
		receipt.integrity?.algorithm !== 'sha256' ||
		receipt.integrity.canonicalDigest !== witnessReactBoilerplateDigest(receipt)
	)
		throw new Error('Witness React Boilerplate receipt integrity or boundary differs');
	return receipt;
}

export function renderWitnessReactBoilerplateReceipt(
	receipt: WitnessReactBoilerplateReceipt,
): string {
	return `# React Boilerplate direct-Witness receipt\n\n- Result: **pass**\n- Canonical SHA-256: \`${receipt.integrity.canonicalDigest}\`\n- Bound migration receipt: \`${receipt.canonicalReceipt.canonicalDigest}\`\n- Qualification runs: 2 baseline + 2 migrated production-static passes\n- Interaction coverage per run: click, type, press, hover, scroll\n- Behavioral parity: \`${receipt.runs[0]!.behaviorDigest}\`\n- Mutation-red/restoration: missing original German heading assertion; byte-identical restoration; restored run passed\n- Successful non-loopback requests: 0\n- React lineage readiness: 0/4, candidate not counted pending Judge audit\n- Angular lineage readiness: 1/4\n- Harness readiness: 0/4\n\n## Boundaries\n\n${receipt.nonclaims.map((claim) => `- ${claim}`).join('\n')}\n`;
}

export async function verifyWitnessReactBoilerplateEvidence(
	rootDir = '.',
): Promise<{ valid: true; digest: string; artifacts: 0; receipt: WitnessReactBoilerplateReceipt }> {
	const root = path.resolve(rootDir);
	const receiptFile = path.join(root, WITNESS_REACT_BOILERPLATE_RECEIPT_PATH);
	const receipt = parseWitnessReactBoilerplateReceipt(
		JSON.parse(await readFile(receiptFile, 'utf8')),
	);
	const canonicalBytes = await readFile(
		path.join(root, REACT_BOILERPLATE_CANONICAL_RECEIPT_PATH),
	);
	if (sha256(canonicalBytes) !== REACT_BOILERPLATE_CANONICAL_SHA256)
		throw new Error('Witness React Boilerplate canonical receipt bytes drifted');
	const markdown = await readFile(path.join(path.dirname(receiptFile), 'receipt.md'), 'utf8');
	if (markdown !== renderWitnessReactBoilerplateReceipt(receipt))
		throw new Error('Witness React Boilerplate human receipt differs');
	return { valid: true, digest: receipt.integrity.canonicalDigest, artifacts: 0, receipt };
}

export function witnessReactBoilerplateAggregateMember(digestValue: string) {
	if (!digest(digestValue)) throw new Error('Witness React Boilerplate aggregate digest differs');
	return {
		id: 'witness-react-boilerplate',
		framework: 'react',
		track: 'production-readiness-direct-witness-candidate',
		bundler: 'webpack-4.30.0-to-vite-8.0.16',
		runtime: 'node-16.20.2-to-node-24.15.0',
		result: 'pass',
		receipt: WITNESS_REACT_BOILERPLATE_RECEIPT_PATH,
		digest: digestValue,
	};
}
