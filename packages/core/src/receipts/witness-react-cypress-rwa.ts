import { canonicalize, sha256 } from './canonicalize.ts';
import {
	WITNESS_JOURNEY_PLACEHOLDER_RULE,
	WITNESS_LIVE_BACKEND_SERVED_RULE,
	WITNESS_LOOPBACK_BACKEND_RULE,
	type WitnessGesture,
	type WitnessJourneyPlaceholderDeclaration,
	type WitnessLiveBackendServed,
	type WitnessLoopbackBackendInventory,
} from './witness-real-app.ts';

/**
 * The cypress-realworld-app direct Witness browser proof — the corpus's first
 * live-backend stateful vertical.
 *
 * Every other vertical in the corpus serves a byte-frozen static tree and
 * nothing else; its whole proof is that the served bytes never change. This one
 * cannot be that shape and stay honest, because the application is a
 * peer-to-peer payment app whose journey is meaningful precisely BECAUSE it
 * mutates server state: it signs a fresh account up, moves money, and reads the
 * transaction back. So the invariants move rather than weaken. The frontend SPA
 * dist is still inventoried before and after the journey and must be
 * byte-identical; the live backend — the application's own Express-over-lowdb
 * server, spawned by the harness on a second bounded loopback origin — is
 * explicitly outside the byte inventory, re-seeded from its frozen snapshot
 * before every pass, and every request the page makes to it is counted in its
 * own loopback-backend category. Determinism under a mutating store is bought
 * two ways: the re-seed, and the generic placeholder normalization that replaces
 * the identifiers the server mints with stable tokens, so two passes produce one
 * semantic digest.
 *
 * This module is the schema and its parser only. No journey ran to produce this
 * unit's evidence; the runner and its published receipt are a separate unit.
 */
export const WITNESS_REACT_CYPRESS_RWA_SCHEMA =
	'versionless.witness-react-cypress-rwa.v1' as const;
export const WITNESS_REACT_CYPRESS_RWA_RECEIPT_PATH =
	'evidence/runs/witness-react-cypress-rwa/receipt.json' as const;
export const REACT_CYPRESS_RWA_FIXTURE = 'react-cypress-rwa' as const;
export const REACT_CYPRESS_RWA_APPLICATION = 'cypress-realworld-app' as const;

/**
 * The immutable cypress-realworld-app source identity, bound here so the
 * browser-proof receipt cannot silently rebind itself to a different revision or
 * archive. Every value is the application's own, taken from the pinned tag.
 */
export const REACT_CYPRESS_RWA_SOURCE = Object.freeze({
	repository: 'https://github.com/cypress-io/cypress-realworld-app',
	ref: 'refs/tags/v1.0.18',
	revision: 'f6b5cf3a1799998dab71181eeed59460f8ada5f4',
	archiveSha256: 'bd9319272dabc1e7263a0186e0aaae011f6219e6e106363d2c89426f9357b315',
	frontendRoot: '.',
	backendRoot: 'backend',
	license: 'MIT',
	react: '17.0.2',
	reactScripts: '4.0.3',
	typescript: '4.3.4',
});

/**
 * The stable placeholder tokens the journey normalizes its minted, server-decided
 * and seed-derived values to. Each is generic — a token and where the value
 * comes from — and deliberately carries NO literal value: the created ids are
 * decided by the server at run time, and `{recipient-handle}` is captured from a
 * seed user the money-movement step pays, then normalized away so no seed
 * identity ever reaches the evidence.
 */
export const WITNESS_REACT_CYPRESS_RWA_PLACEHOLDERS = Object.freeze([
	Object.freeze({
		token: '{created-user-id}',
		origin: 'the id the backend mints for the freshly signed-up account',
	}),
	Object.freeze({
		token: '{created-account-id}',
		origin: 'the id the backend mints for the account onboarding creates',
	}),
	Object.freeze({
		token: '{created-transaction-id}',
		origin: 'the id the backend mints for the payment the journey sends',
	}),
	Object.freeze({
		token: '{recipient-handle}',
		origin: 'a seed user the payment is sent to, captured from search and normalized so no seed identity reaches the evidence',
	}),
]) as readonly WitnessJourneyPlaceholderDeclaration[];

/**
 * The deterministic, NON-SEED account the journey signs up and acts as. It is a
 * corpus identity invented for the proof, not a credential from the seed
 * database, so recording it discloses nothing the application ships. The
 * redaction test enforces that this is the only identity literal in the
 * evidence and that no seed username, password or hash appears anywhere.
 */
export const WITNESS_REACT_CYPRESS_RWA_ACTOR = Object.freeze({
	firstName: 'Versionless',
	lastName: 'Prover',
	username: 'versionless-rwa-actor',
	password: 'versionless-rwa-passphrase',
});

/**
 * Seed-database markers that must never appear in the evidence. The bcrypt
 * prefixes are the shape of every hashed password in the seed; `s3cret` is the
 * seed's shared plaintext password. Their absence is the redaction proof, and
 * the parser fails the run if any of them is found in a recorded string.
 */
export const WITNESS_REACT_CYPRESS_RWA_FORBIDDEN_MARKERS = Object.freeze([
	's3cret',
	'$2a$',
	'$2b$',
	'$2y$',
]);

/**
 * The exact route sequence the journey drives, in order, after the initial
 * document load. Server-minted identifiers are normalized to their declared
 * placeholder tokens; every other segment is the literal path the application
 * navigated to. Pinning the whole sequence is what makes a dropped step or a
 * silently redirected route fail the run.
 */
export const WITNESS_REACT_CYPRESS_RWA_ROUTES = Object.freeze([
	'/signup',
	'/signin',
	'/',
	'/user/settings',
	'/',
	'/transaction/new',
	'/transaction/{created-transaction-id}',
	'/',
	'/public',
	'/contacts',
	'/personal',
	'/notifications',
	'/',
]);

/**
 * The declared loopback-backend category: every REST endpoint the journey
 * reaches on the application's own server, by method and origin-relative path.
 * A request to an endpoint outside this list fails the run. Paths that carry a
 * server-minted id use the placeholder token, so the category is comparable
 * across runs the same way the routes are.
 */
export const WITNESS_REACT_CYPRESS_RWA_BACKEND_CATEGORY = Object.freeze([
	Object.freeze({ method: 'GET', path: '/checkAuth' }),
	Object.freeze({ method: 'POST', path: '/users' }),
	Object.freeze({ method: 'POST', path: '/login' }),
	Object.freeze({ method: 'POST', path: '/logout' }),
	Object.freeze({ method: 'GET', path: '/users' }),
	Object.freeze({ method: 'PATCH', path: '/users/{created-user-id}' }),
	Object.freeze({ method: 'GET', path: '/users/search' }),
	Object.freeze({ method: 'POST', path: '/bankAccounts' }),
	Object.freeze({ method: 'GET', path: '/bankAccounts' }),
	Object.freeze({ method: 'POST', path: '/transactions' }),
	Object.freeze({ method: 'GET', path: '/transactions' }),
	Object.freeze({ method: 'GET', path: '/transactions/public' }),
	Object.freeze({ method: 'GET', path: '/transactions/contacts' }),
	Object.freeze({ method: 'GET', path: '/transactions/{created-transaction-id}' }),
	Object.freeze({ method: 'GET', path: '/notifications' }),
]);

export type WitnessReactCypressRwaSource = typeof REACT_CYPRESS_RWA_SOURCE;

/** The SPA byte inventory for a live-backend run: scoped to the frontend dist only. */
export type WitnessReactCypressRwaServedStatic = {
	transport: 'isolated-bounded-loopback-production-static';
	documentFallback: 'index-only';
	missingAssets: '404';
	traversal: 'rejected';
	inventory: { files: number; beforeSha256: string; afterSha256: string };
	application: { path: 'index.html'; beforeSha256: string; afterSha256: string };
	byteIdentical: true;
	hmrControls: false;
	liveBackend: WitnessLiveBackendServed;
};

export type WitnessReactCypressRwaRun = {
	app: typeof REACT_CYPRESS_RWA_APPLICATION;
	framework: 'react';
	lane: 'baseline' | 'migrated';
	pass: 1 | 2;
	result: 'pass';
	interactions: Array<{ kind: WitnessGesture; selector: string }>;
	assertions: string[];
	routes: string[];
	trackedEvents: string[];
	witnessRecord: {
		interactions: Array<{ kind: WitnessGesture; selector: string }>;
		navigationPaths: string[];
		trackedEventCounts: Record<string, number>;
		consoleErrors: number;
		pageErrors: number;
		failedRequests: number;
	};
	cleanPage: true;
	servedStatic: WitnessReactCypressRwaServedStatic;
	loopbackBackend: WitnessLoopbackBackendInventory;
	placeholders: readonly WitnessJourneyPlaceholderDeclaration[];
	successfulNonLoopback: 0;
	semanticDigest: string;
	behaviorDigest: string;
};

export type WitnessReactCypressRwaMutation = {
	failure: 'witness-semantic-assertion';
	intendedFailure: true;
	lane: 'migrated';
	seam: string;
	path: string;
	offset: number;
	beforeSha256: string;
	mutatedSha256: string;
	afterRestoreSha256: string;
	restoredByteIdentically: true;
	restoredRun: 'pass';
	restoredBehaviorDigest: string;
};

export type WitnessReactCypressRwaReceipt = {
	schemaVersion: typeof WITNESS_REACT_CYPRESS_RWA_SCHEMA;
	result: 'pass';
	fixture: typeof REACT_CYPRESS_RWA_FIXTURE;
	application: typeof REACT_CYPRESS_RWA_APPLICATION;
	framework: 'react';
	source: WitnessReactCypressRwaSource;
	provenance: Record<string, unknown>;
	canonicalReceipt: { path: string; canonicalDigest: string; sha256: string };
	runs: WitnessReactCypressRwaRun[];
	mutation: WitnessReactCypressRwaMutation;
	placeholders: readonly WitnessJourneyPlaceholderDeclaration[];
	backendCategory: readonly { method: string; path: string }[];
	determinism: {
		reseededFromSnapshotBeforeEachPass: true;
		mintedValuesPlaceholdered: true;
		rule: typeof WITNESS_JOURNEY_PLACEHOLDER_RULE;
	};
	redaction: {
		policy: 'no-seed-usernames-passwords-or-pii';
		forbiddenMarkers: readonly string[];
		actorIsNonSeedCorpusIdentity: true;
	};
	locality: {
		mode: 'live-loopback-backend';
		successfulNonLoopback: 0;
		osWideIsolation: false;
		rule: typeof WITNESS_LOOPBACK_BACKEND_RULE;
	};
	nonclaims: string[];
	integrity: { algorithm: 'sha256'; canonicalDigest: string };
};

const exact = (left: unknown, right: unknown): boolean =>
	canonicalize(left) === canonicalize(right);

function sha256Digest(value: unknown): value is string {
	return typeof value === 'string' && value.length === 64;
}

/**
 * The raw run digest: the whole run except the fields that identify a pass. Two
 * passes of the same lane re-seed to the same state and normalize the same
 * minted values, so this must be identical across a lane's passes.
 */
export function witnessReactCypressRwaRawDigest(run: WitnessReactCypressRwaRun): string {
	const { pass: _pass, result: _result, semanticDigest: _semanticDigest, ...raw } = run;
	const withoutBehavior = { ...raw } as Record<string, unknown>;
	delete withoutBehavior.behaviorDigest;
	return sha256(canonicalize(withoutBehavior));
}

/**
 * The lane-independent behavior projection.
 *
 * Production SPA bytes are lane-specific by construction, so the byte inventory
 * stays in the run record and out of this digest; what remains is what both
 * lanes must share — the same journey, the same routes, the same backend
 * category shape, the same clean page. The loopback-backend inventory's admitted
 * total and category participate; the exact per-status observations do not,
 * because a lane's server build may answer a poll a different number of times.
 */
export function witnessReactCypressRwaBehaviorDigest(run: WitnessReactCypressRwaRun): string {
	return sha256(
		canonicalize({
			app: run.app,
			framework: run.framework,
			interactions: run.interactions,
			assertions: run.assertions,
			routes: run.routes,
			trackedEvents: run.trackedEvents,
			witnessRecord: run.witnessRecord,
			cleanPage: run.cleanPage,
			servedStaticPolicy: {
				transport: run.servedStatic.transport,
				documentFallback: run.servedStatic.documentFallback,
				missingAssets: run.servedStatic.missingAssets,
				traversal: run.servedStatic.traversal,
				byteIdentical: run.servedStatic.byteIdentical,
				hmrControls: run.servedStatic.hmrControls,
				liveBackend: run.servedStatic.liveBackend,
			},
			loopbackBackendPolicy: {
				policy: run.loopbackBackend.policy,
				backend: run.loopbackBackend.backend,
				category: run.loopbackBackend.category,
				outsideCategory: run.loopbackBackend.outsideCategory,
				admitted: run.loopbackBackend.admitted,
				successfulNonLoopback: run.loopbackBackend.successfulNonLoopback,
			},
			placeholders: run.placeholders,
			successfulNonLoopback: run.successfulNonLoopback,
		}),
	);
}

export function witnessReactCypressRwaDigest(receipt: WitnessReactCypressRwaReceipt): string {
	const copy = structuredClone(receipt);
	copy.integrity.canonicalDigest = '';
	return sha256(canonicalize(copy));
}

/**
 * Every string reachable in a value, so the redaction check can assert no seed
 * marker appears anywhere in the recorded evidence rather than in a hand-picked
 * subset of fields.
 */
function collectStrings(value: unknown, into: string[]): void {
	if (typeof value === 'string') into.push(value);
	else if (Array.isArray(value)) for (const item of value) collectStrings(item, into);
	else if (value !== null && typeof value === 'object')
		for (const item of Object.values(value)) collectStrings(item, into);
}

function assertRedaction(run: WitnessReactCypressRwaRun, label: string): void {
	const strings: string[] = [];
	collectStrings(run, strings);
	for (const text of strings)
		for (const marker of WITNESS_REACT_CYPRESS_RWA_FORBIDDEN_MARKERS)
			if (text.includes(marker))
				throw new Error(`Cypress RWA Witness redaction leaked a seed marker: ${label}`);
}

function assertServedStatic(served: WitnessReactCypressRwaServedStatic, label: string): void {
	if (
		served.transport !== 'isolated-bounded-loopback-production-static' ||
		served.documentFallback !== 'index-only' ||
		served.missingAssets !== '404' ||
		served.traversal !== 'rejected' ||
		!Number.isInteger(served.inventory?.files) ||
		served.inventory.files < 1 ||
		!sha256Digest(served.inventory.beforeSha256) ||
		served.inventory.beforeSha256 !== served.inventory.afterSha256 ||
		served.application?.path !== 'index.html' ||
		!sha256Digest(served.application.beforeSha256) ||
		served.application.beforeSha256 !== served.application.afterSha256 ||
		served.byteIdentical !== true ||
		served.hmrControls !== false ||
		served.liveBackend?.backend !== 'live-loopback' ||
		served.liveBackend.byteInventoryScope !== 'frontend-spa-dist' ||
		served.liveBackend.rule !== WITNESS_LIVE_BACKEND_SERVED_RULE
	)
		throw new Error(`Cypress RWA Witness served-static differs: ${label}`);
}

function assertLoopbackBackend(inventory: WitnessLoopbackBackendInventory, label: string): void {
	if (
		inventory?.policy !== 'live-first-party-loopback-backend' ||
		inventory.backend !== 'live-loopback' ||
		inventory.rule !== WITNESS_LOOPBACK_BACKEND_RULE ||
		inventory.successfulNonLoopback !== 0 ||
		!exact(inventory.outsideCategory, []) ||
		!exact(inventory.category, WITNESS_REACT_CYPRESS_RWA_BACKEND_CATEGORY) ||
		!Array.isArray(inventory.observed) ||
		inventory.observed.length === 0 ||
		inventory.admitted !== inventory.observed.reduce((sum, entry) => sum + entry.requests, 0)
	)
		throw new Error(`Cypress RWA Witness loopback-backend inventory differs: ${label}`);
	const declared = new Set(
		WITNESS_REACT_CYPRESS_RWA_BACKEND_CATEGORY.map((entry) => `${entry.method} ${entry.path}`),
	);
	for (const observation of inventory.observed)
		if (!declared.has(`${observation.method} ${observation.path}`))
			throw new Error(`Cypress RWA Witness backend observation is undeclared: ${label}`);
}

export function parseWitnessReactCypressRwaReceipt(value: unknown): WitnessReactCypressRwaReceipt {
	if (value === null || typeof value !== 'object' || Array.isArray(value))
		throw new Error('Cypress RWA Witness receipt must be an object');
	const receipt = value as WitnessReactCypressRwaReceipt;
	const expectedRuns = new Set(['baseline:1', 'baseline:2', 'migrated:1', 'migrated:2']);
	const behaviors = new Set<string>();
	const semanticByLane = new Map<string, string>();
	if (
		receipt.schemaVersion !== WITNESS_REACT_CYPRESS_RWA_SCHEMA ||
		receipt.result !== 'pass' ||
		receipt.fixture !== REACT_CYPRESS_RWA_FIXTURE ||
		receipt.application !== REACT_CYPRESS_RWA_APPLICATION ||
		receipt.framework !== 'react' ||
		!exact(receipt.source, REACT_CYPRESS_RWA_SOURCE) ||
		!Array.isArray(receipt.runs) ||
		receipt.runs.length !== 4 ||
		!exact(receipt.placeholders, WITNESS_REACT_CYPRESS_RWA_PLACEHOLDERS) ||
		!exact(receipt.backendCategory, WITNESS_REACT_CYPRESS_RWA_BACKEND_CATEGORY)
	)
		throw new Error('Cypress RWA Witness binding differs');
	for (const run of receipt.runs) {
		const key = `${run.lane}:${run.pass}`;
		if (
			!expectedRuns.delete(key) ||
			run.app !== REACT_CYPRESS_RWA_APPLICATION ||
			run.framework !== 'react' ||
			run.result !== 'pass' ||
			run.cleanPage !== true ||
			run.successfulNonLoopback !== 0 ||
			run.witnessRecord.pageErrors !== 0 ||
			!Array.isArray(run.interactions) ||
			run.interactions.length === 0 ||
			!Array.isArray(run.assertions) ||
			run.assertions.length === 0 ||
			!exact(run.routes, WITNESS_REACT_CYPRESS_RWA_ROUTES) ||
			!exact(run.placeholders, WITNESS_REACT_CYPRESS_RWA_PLACEHOLDERS) ||
			run.semanticDigest !== witnessReactCypressRwaRawDigest(run) ||
			run.behaviorDigest !== witnessReactCypressRwaBehaviorDigest(run)
		)
			throw new Error(`Cypress RWA Witness run differs: ${key}`);
		assertServedStatic(run.servedStatic, key);
		assertLoopbackBackend(run.loopbackBackend, key);
		assertRedaction(run, key);
		const priorSemantic = semanticByLane.get(run.lane);
		if (priorSemantic !== undefined && priorSemantic !== run.semanticDigest)
			throw new Error(`Cypress RWA Witness pass-twice semantic digest differs: ${run.lane}`);
		semanticByLane.set(run.lane, run.semanticDigest);
		behaviors.add(run.behaviorDigest);
	}
	if (
		expectedRuns.size !== 0 ||
		behaviors.size !== 1 ||
		receipt.determinism?.reseededFromSnapshotBeforeEachPass !== true ||
		receipt.determinism.mintedValuesPlaceholdered !== true ||
		receipt.determinism.rule !== WITNESS_JOURNEY_PLACEHOLDER_RULE ||
		receipt.redaction?.policy !== 'no-seed-usernames-passwords-or-pii' ||
		receipt.redaction.actorIsNonSeedCorpusIdentity !== true ||
		!exact(receipt.redaction.forbiddenMarkers, WITNESS_REACT_CYPRESS_RWA_FORBIDDEN_MARKERS) ||
		receipt.mutation?.intendedFailure !== true ||
		receipt.mutation.failure !== 'witness-semantic-assertion' ||
		receipt.mutation.lane !== 'migrated' ||
		receipt.mutation.restoredByteIdentically !== true ||
		receipt.mutation.restoredRun !== 'pass' ||
		receipt.mutation.beforeSha256 !== receipt.mutation.afterRestoreSha256 ||
		receipt.mutation.beforeSha256 === receipt.mutation.mutatedSha256 ||
		!behaviors.has(receipt.mutation.restoredBehaviorDigest) ||
		receipt.locality?.mode !== 'live-loopback-backend' ||
		receipt.locality.successfulNonLoopback !== 0 ||
		receipt.locality.osWideIsolation !== false ||
		receipt.locality.rule !== WITNESS_LOOPBACK_BACKEND_RULE ||
		!Array.isArray(receipt.nonclaims) ||
		receipt.nonclaims.length === 0 ||
		receipt.integrity?.algorithm !== 'sha256' ||
		receipt.integrity.canonicalDigest !== witnessReactCypressRwaDigest(receipt)
	)
		throw new Error('Cypress RWA Witness integrity or determinism differs');
	return receipt;
}

export function witnessReactCypressRwaAggregateMember(digestValue: string) {
	return {
		id: 'witness-react-cypress-rwa',
		framework: 'react',
		track: 'production-readiness-direct-witness-live-backend-create-react-app-to-vite8',
		bundler: 'webpack-4.44.2-to-vite-8.0.16',
		backend: 'live-loopback',
		result: 'pass',
		receipt: WITNESS_REACT_CYPRESS_RWA_RECEIPT_PATH,
		digest: digestValue,
	};
}
