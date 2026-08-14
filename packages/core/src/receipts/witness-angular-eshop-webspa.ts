import { canonicalize, sha256 } from './canonicalize.ts';

/**
 * Browser-parity Witness schema for the eShop WebSPA holdout.
 *
 * The holdout is a backend-coupled enterprise SPA. Its two retained outputs — the
 * era baseline build and the migrated build produced by the re-frozen adapter —
 * are served as production static bytes on a bounded loopback origin, and the
 * same-origin API surface they both reach is answered by one declared projection
 * that is identical for both lanes. That identity is the whole point: a
 * behavioral difference between the lanes cannot be attributed to the surface
 * they were served, so the normalized behavior digest is a statement about the
 * migration and nothing else.
 *
 * The anonymous catalog surface is the whole surface under proof. Identity is
 * NOT projected: `SecurityService.Authorize()` navigates the document to an
 * IdentityServer `/connect/authorize` endpoint that no part of this run stands
 * in for, so `Login` is out of surface and everything behind it — basket,
 * orders, campaigns, the SignalR hub — is out of surface with it. That is
 * recorded as a limitation of the proof rather than worked around.
 */
export const WITNESS_ANGULAR_ESHOP_WEBSPA_SCHEMA =
	'versionless.witness-angular-eshop-webspa.v1' as const;

export const WITNESS_ANGULAR_ESHOP_WEBSPA_APP = 'angular-eshop-webspa' as const;
export const WITNESS_ANGULAR_ESHOP_WEBSPA_FIXTURE = 'angular-eshop-webspa-netcore2-2' as const;
export const WITNESS_ANGULAR_ESHOP_WEBSPA_EVIDENCE_DIRECTORY =
	'evidence/runs/angular-eshop-webspa' as const;
export const WITNESS_ANGULAR_ESHOP_WEBSPA_UNIT = 'lrapr-t024/u6-eshop-witness-journeys' as const;

export const WITNESS_ANGULAR_ESHOP_WEBSPA_SOURCE = Object.freeze({
	repository: 'dotnet-architecture/eShopOnContainers',
	revision: 'a387f21029f0b2d49614d165d5384717d2398f8e',
	subpath: 'src/Web/WebSPA',
	consent: 'VL-LEGACY-CORPUS-2026-08-10',
});

/** The re-freeze composite the migrated lane's adapter is published as. */
export const WITNESS_ANGULAR_ESHOP_WEBSPA_ADAPTER_COMPOSITE =
	'27741d9c8bfac1b6bb0b330423b1cf258fcde722f548ecb9cf8b389cc98e4234' as const;

export const WITNESS_ANGULAR_ESHOP_WEBSPA_PROJECTION_LABEL =
	'synthetic-fixture-evidence-data' as const;
export const WITNESS_ANGULAR_ESHOP_WEBSPA_PROJECTION_BEHAVIOR_DIGEST =
	'747dc5258b30703c9b29f3c0087e1728e93fc160f1cbf3c53f9589ee09aad849' as const;
export const WITNESS_ANGULAR_ESHOP_WEBSPA_PROJECTION_SEED_FIXTURE =
	'fixtures/angular-eshop-webspa/witness-projection-seed.json' as const;

/** The viewport every stage of this journey is measured at. */
export const WITNESS_ANGULAR_ESHOP_WEBSPA_VIEWPORT = Object.freeze({ width: 1280, height: 720 });

/**
 * Selectors, all of them the application's own class names from
 * `catalog.component.html`, `pager.html` and `identity.html` — none authored for
 * the harness.
 */
export const WITNESS_ANGULAR_ESHOP_WEBSPA_SELECTORS = Object.freeze({
	catalogItem: '.esh-catalog-item',
	catalogName: '.esh-catalog-name span',
	catalogThumbnail: '.esh-catalog-thumbnail',
	brandSelect: '.esh-catalog-label[data-title="brand"] .esh-catalog-filter',
	typeSelect: '.esh-catalog-label[data-title="type"] .esh-catalog-filter',
	applyFilter: '.esh-catalog-send',
	pagerNext: '#Next',
	pagerPrevious: '#Previous',
	identityName: '.esh-identity-name',
	basketStatus: 'esh-basket-status',
});

/**
 * Every value below was measured off the live DOM of BOTH retained builds before
 * it was written down; none of it is derived from the projection seed by hand.
 */
export const WITNESS_ANGULAR_ESHOP_WEBSPA_STAGES = Object.freeze({
	catalogPageSize: 10,
	catalogTotal: 20,
	firstPageText: 'Showing 10 of 20 products - Page 1 - 2',
	secondPageText: 'Showing 10 of 20 products - Page 2 - 2',
	firstItemName: 'Contoso Cloud Mug',
	secondPageFirstItemName: 'Fabrikam Works Poster',
	typeFilterKey: 'm',
	typeFilterValue: '1',
	typeFilteredItems: 5,
	typeFilteredText: 'Showing 5 of 5 products - Page 1 - 1',
	brandFilterKey: 'n',
	brandFilterValue: '2',
	brandFilteredItems: 1,
	brandFilteredText: 'Showing 1 of 1 products - Page 1 - 1',
	brandFilteredItemName: 'Northwind Labs Mug',
	anonymousIdentity: 'Login',
});

/**
 * The byte-mutation seam on the migrated lane.
 *
 * It is the literal the compiled pager template interpolates its counts into,
 * emitted exactly once across the served output. The journey asserts the pager's
 * settled line at four separate stages, so overwriting the seam in place with an
 * equal-length filler makes those assertions observe a line the receipt does not
 * name, and the run is red without any file changing length.
 */
export const WITNESS_ANGULAR_ESHOP_WEBSPA_MUTATION_SEAM = ' products - Page ' as const;

/** The truthful limits of this proof, carried in the receipt rather than in a comment. */
export const WITNESS_ANGULAR_ESHOP_WEBSPA_SURFACE_LIMITS = Object.freeze([
	Object.freeze({
		surface: 'identity',
		state: 'out-of-surface',
		reason: "SecurityService.Authorize() navigates the document to an IdentityServer '/connect/authorize' endpoint; no identity provider is projected, so Login is never exercised and nothing behind it is claimed.",
	}),
	Object.freeze({
		surface: 'basket',
		state: 'out-of-surface',
		reason: 'the add-to-cart control renders disabled for an anonymous visitor and esh-basket-status is not rendered at all, so no basket behavior is exercised or claimed.',
	}),
	Object.freeze({
		surface: 'orders',
		state: 'out-of-surface',
		reason: 'the orders routes are reachable only from the authenticated identity menu.',
	}),
	Object.freeze({
		surface: 'campaigns',
		state: 'out-of-surface',
		reason: 'campaigns are gated behind both identity and the configuration switch, which the declared payload leaves off.',
	}),
	Object.freeze({
		surface: 'signalr',
		state: 'not-reached',
		reason: 'SignalrService.init() returns before building a hub connection unless the visitor is authorized, so the anonymous run opens no socket.',
	}),
	Object.freeze({
		surface: 'text-entry',
		state: 'not-tested',
		reason: 'the anonymous catalog surface has no text input; the journey drives clicks, keyboard selection and a genuine wheel scroll, and claims no typing coverage.',
	}),
	Object.freeze({
		surface: 'drag',
		state: 'not-tested',
		reason: 'the anonymous catalog surface has no drag affordance.',
	}),
]);

export type WitnessAngularEshopWebspaSurfaceLimit =
	(typeof WITNESS_ANGULAR_ESHOP_WEBSPA_SURFACE_LIMITS)[number];

export type WitnessAngularEshopWebspaLedgerEntry = {
	method: string;
	pathname: string;
	endpoint: string | null;
	decision: string;
	status: number | null;
	count: number;
};

export type WitnessAngularEshopWebspaProjectionEvidence = {
	state: 'frozen-synthetic-loopback-projection';
	label: typeof WITNESS_ANGULAR_ESHOP_WEBSPA_PROJECTION_LABEL;
	pinnedCommit: string;
	behaviorDigest: typeof WITNESS_ANGULAR_ESHOP_WEBSPA_PROJECTION_BEHAVIOR_DIGEST;
	seedSha256: string;
	seedFixture: typeof WITNESS_ANGULAR_ESHOP_WEBSPA_PROJECTION_SEED_FIXTURE;
	transport: 'same-origin-bounded-loopback-api';
	identicalAcrossLanes: true;
	ledger: {
		state: 'measured-projection-ledger';
		records: number;
		apiRecords: number;
		served: number;
		refusedUnknown: number;
		refusedUnprojected: number;
		declinedNonApi: number;
		entries: WitnessAngularEshopWebspaLedgerEntry[];
	};
};

/** The measured application facts this journey adds to the generic run record. */
export type WitnessAngularEshopWebspaJourney = {
	state: 'anonymous-catalog-journey';
	catalog: {
		state: 'measured-rendered-catalog';
		items: number;
		total: number;
		pagerLine: string;
		firstItemName: string;
	};
	pager: {
		state: 'measured-server-paged-navigation';
		forwardLine: string;
		backLine: string;
		requests: number;
	};
	filters: {
		state: 'measured-keyboard-selected-filters';
		typeValue: string;
		typeItems: number;
		typeLine: string;
		brandValue: string;
		brandItems: number;
		brandLine: string;
		narrowedItemName: string;
	};
	scroll: {
		state: 'measured-genuine-viewport-scroll';
		scrollHeight: number;
		clientHeight: number;
		scrolled: true;
	};
	surfaceLimits: readonly WitnessAngularEshopWebspaSurfaceLimit[];
};

export type WitnessAngularEshopWebspaRun = {
	app: typeof WITNESS_ANGULAR_ESHOP_WEBSPA_APP;
	framework: 'angular';
	lane: 'baseline' | 'migrated';
	pass: 1 | 2;
	result: 'pass';
	semanticDigest: string;
	behaviorDigest: string;
	[key: string]: unknown;
};

export type WitnessAngularEshopWebspaMutation = {
	failure: 'witness-semantic-assertion';
	intendedFailure: true;
	lane: 'migrated';
	seam: typeof WITNESS_ANGULAR_ESHOP_WEBSPA_MUTATION_SEAM;
	path: string;
	offset: number;
	beforeSha256: string;
	mutatedSha256: string;
	afterRestoreSha256: string;
	restoredByteIdentically: true;
	restoredRun: 'pass';
	restoredBehaviorDigest: string;
};

export type WitnessAngularEshopWebspaReceipt = {
	schemaVersion: typeof WITNESS_ANGULAR_ESHOP_WEBSPA_SCHEMA;
	result: 'pass';
	unit: typeof WITNESS_ANGULAR_ESHOP_WEBSPA_UNIT;
	fixture: typeof WITNESS_ANGULAR_ESHOP_WEBSPA_FIXTURE;
	app: typeof WITNESS_ANGULAR_ESHOP_WEBSPA_APP;
	source: typeof WITNESS_ANGULAR_ESHOP_WEBSPA_SOURCE;
	adapterComposite: typeof WITNESS_ANGULAR_ESHOP_WEBSPA_ADAPTER_COMPOSITE;
	lanes: {
		baseline: { output: string; files: number; sha256: string };
		migrated: { output: string; files: number; sha256: string };
	};
	projection: WitnessAngularEshopWebspaProjectionEvidence;
	journey: WitnessAngularEshopWebspaJourney;
	runs: WitnessAngularEshopWebspaRun[];
	parity: {
		state: 'measured-two-lane-normalized-behavior-parity';
		behaviorDigest: string;
		lanes: 2;
		passesPerLane: 2;
		semanticDigestsPerLane: { baseline: string; migrated: string };
	};
	mutation: WitnessAngularEshopWebspaMutation;
	locality: { mode: 'offline'; successfulNonLoopback: 0; osWideIsolation: false };
	nonclaims: string[];
	integrity: { algorithm: 'sha256'; canonicalDigest: string };
};

/**
 * The per-pass determinism digest: the whole run minus the fields that are
 * allowed to differ between the two passes of one lane. Two passes of a lane
 * must agree.
 */
export function witnessAngularEshopWebspaRawDigest(run: WitnessAngularEshopWebspaRun): string {
	const { pass: _pass, result: _result, semanticDigest, behaviorDigest, ...rest } = run;
	void semanticDigest;
	void behaviorDigest;
	return sha256(canonicalize(rest));
}

/**
 * The lane-independent parity digest.
 *
 * The two lanes ship different bytes on purpose — different bundlers, different
 * content hashes, and the migrated lane inlines its critical CSS — so the byte
 * digests, the file inventory and the served-static digests are projected out.
 * What remains is what a person could observe: the gestures made, the assertions
 * settled, the routes navigated, the events the application fired, and the
 * policy the bytes were served under. All four runs must agree.
 */
export function witnessAngularEshopWebspaBehaviorDigest(
	run: WitnessAngularEshopWebspaRun,
): string {
	const served = (run['servedStatic'] ?? {}) as Record<string, unknown>;
	return sha256(
		canonicalize({
			app: run.app,
			framework: run.framework,
			interactions: run['interactions'],
			assertions: run['assertions'],
			routes: run['routes'],
			trackedEvents: run['trackedEvents'],
			witnessRecord: run['witnessRecord'],
			cleanPage: run['cleanPage'],
			applicationJourney: run['applicationJourney'],
			scrollSurface: run['scrollSurface'],
			servedStaticPolicy: {
				transport: served['transport'],
				documentFallback: served['documentFallback'],
				missingAssets: served['missingAssets'],
				traversal: served['traversal'],
				byteIdentical: served['byteIdentical'],
				hmrControls: served['hmrControls'],
			},
			successfulNonLoopback: run['successfulNonLoopback'],
		}),
	);
}

export function witnessAngularEshopWebspaDigest(
	receipt: WitnessAngularEshopWebspaReceipt,
): string {
	const { integrity, ...rest } = receipt;
	void integrity;
	return sha256(canonicalize(rest));
}

const fail = (message: string): never => {
	throw new Error(message);
};

export function parseWitnessAngularEshopWebspaReceipt(
	value: unknown,
): WitnessAngularEshopWebspaReceipt {
	const receipt = value as WitnessAngularEshopWebspaReceipt;
	if (receipt.schemaVersion !== WITNESS_ANGULAR_ESHOP_WEBSPA_SCHEMA)
		fail('eShop WebSPA Witness schema version differs');
	if (receipt.result !== 'pass') fail('eShop WebSPA Witness result is not a pass');
	if (receipt.app !== WITNESS_ANGULAR_ESHOP_WEBSPA_APP) fail('eShop WebSPA Witness app differs');
	if (receipt.adapterComposite !== WITNESS_ANGULAR_ESHOP_WEBSPA_ADAPTER_COMPOSITE)
		fail('eShop WebSPA Witness adapter composite differs');
	if (receipt.runs.length !== 4) fail('eShop WebSPA Witness must record two lanes observed twice');
	const projection = receipt.projection;
	if (
		projection.state !== 'frozen-synthetic-loopback-projection' ||
		projection.transport !== 'same-origin-bounded-loopback-api' ||
		projection.identicalAcrossLanes !== true ||
		projection.behaviorDigest !== WITNESS_ANGULAR_ESHOP_WEBSPA_PROJECTION_BEHAVIOR_DIGEST
	)
		fail('eShop WebSPA Witness projection declaration differs');
	const ledger = projection.ledger;
	if (ledger.refusedUnknown !== 0)
		fail('eShop WebSPA Witness projection refused a path the application asked for');
	if (ledger.refusedUnprojected !== 0)
		fail('eShop WebSPA Witness projection withheld a path the application asked for');
	if (ledger.apiRecords !== ledger.served)
		fail('eShop WebSPA Witness projection served fewer records than it answered');
	if (ledger.declinedNonApi < 1)
		fail('eShop WebSPA Witness projection declined no static request');
	if (ledger.records !== ledger.apiRecords + ledger.declinedNonApi)
		fail('eShop WebSPA Witness projection ledger does not account for every record');
	if (ledger.entries.reduce((sum, entry) => sum + entry.count, 0) !== ledger.apiRecords)
		fail('eShop WebSPA Witness projection ledger entries do not sum to its API records');
	const semantic = new Map<string, string>();
	for (const run of receipt.runs) {
		if (run.result !== 'pass') fail('eShop WebSPA Witness run is not a pass');
		if (run.semanticDigest !== witnessAngularEshopWebspaRawDigest(run))
			fail('eShop WebSPA Witness run semantic digest differs');
		if (run.behaviorDigest !== witnessAngularEshopWebspaBehaviorDigest(run))
			fail('eShop WebSPA Witness run behavior digest differs');
		if (run['successfulNonLoopback'] !== 0)
			fail('eShop WebSPA Witness run reached a non-loopback origin');
		const held = semantic.get(run.lane);
		if (held === undefined) semantic.set(run.lane, run.semanticDigest);
		else if (held !== run.semanticDigest)
			fail('eShop WebSPA Witness repeated pass differs');
	}
	if (semantic.size !== 2) fail('eShop WebSPA Witness did not observe both lanes');
	if (new Set(receipt.runs.map((run) => run.behaviorDigest)).size !== 1)
		fail('eShop WebSPA Witness two-lane behavior parity differs');
	if (receipt.parity.behaviorDigest !== receipt.runs[0]!.behaviorDigest)
		fail('eShop WebSPA Witness parity digest differs from its runs');
	const mutation = receipt.mutation;
	if (
		mutation.intendedFailure !== true ||
		mutation.lane !== 'migrated' ||
		mutation.seam !== WITNESS_ANGULAR_ESHOP_WEBSPA_MUTATION_SEAM ||
		mutation.restoredByteIdentically !== true ||
		mutation.restoredRun !== 'pass' ||
		mutation.beforeSha256 !== mutation.afterRestoreSha256 ||
		mutation.mutatedSha256 === mutation.beforeSha256
	)
		fail('eShop WebSPA Witness mutation proof differs');
	if (mutation.restoredBehaviorDigest !== receipt.parity.behaviorDigest)
		fail('eShop WebSPA Witness restored behavior differs from the parity digest');
	if (receipt.locality.successfulNonLoopback !== 0 || receipt.locality.osWideIsolation !== false)
		fail('eShop WebSPA Witness locality differs');
	if (
		canonicalize(receipt.journey.surfaceLimits) !==
		canonicalize(WITNESS_ANGULAR_ESHOP_WEBSPA_SURFACE_LIMITS)
	)
		fail('eShop WebSPA Witness surface limits differ');
	if (receipt.integrity.canonicalDigest !== witnessAngularEshopWebspaDigest(receipt))
		fail('eShop WebSPA Witness integrity digest differs');
	return receipt;
}

export function renderWitnessAngularEshopWebspaReceipt(
	receipt: WitnessAngularEshopWebspaReceipt,
): string {
	const lines: string[] = [];
	lines.push('# eShop WebSPA holdout — browser-parity Witness');
	lines.push('');
	lines.push(`- Result: ${receipt.result}`);
	lines.push(`- Unit: ${receipt.unit}`);
	lines.push(`- Fixture: ${receipt.fixture}`);
	lines.push(`- Source: ${receipt.source.repository}@${receipt.source.revision}`);
	lines.push(`- Adapter composite: ${receipt.adapterComposite}`);
	lines.push(`- Behavior parity digest: ${receipt.parity.behaviorDigest}`);
	lines.push(`- Canonical digest: ${receipt.integrity.canonicalDigest}`);
	lines.push('');
	lines.push('## Lanes');
	lines.push('');
	lines.push('| Lane | Output | Files | Inventory sha256 | Semantic digest |');
	lines.push('| --- | --- | --- | --- | --- |');
	for (const lane of ['baseline', 'migrated'] as const)
		lines.push(
			`| ${lane} | ${receipt.lanes[lane].output} | ${String(receipt.lanes[lane].files)} | ${receipt.lanes[lane].sha256} | ${receipt.parity.semanticDigestsPerLane[lane]} |`,
		);
	lines.push('');
	lines.push('## Declared same-origin projection');
	lines.push('');
	lines.push(`- Label: ${receipt.projection.label}`);
	lines.push(`- Transport: ${receipt.projection.transport}`);
	lines.push(`- Behavior digest: ${receipt.projection.behaviorDigest}`);
	lines.push(`- Seed: ${receipt.projection.seedFixture} (${receipt.projection.seedSha256})`);
	lines.push(
		`- Ledger: ${String(receipt.projection.ledger.served)} served, ${String(receipt.projection.ledger.refusedUnknown)} refused-unknown, ${String(receipt.projection.ledger.refusedUnprojected)} refused-unprojected, ${String(receipt.projection.ledger.declinedNonApi)} declined-non-api`,
	);
	lines.push('- Identical across both lanes: yes');
	lines.push('');
	lines.push('## Surface limits');
	lines.push('');
	for (const limit of receipt.journey.surfaceLimits)
		lines.push(`- **${limit.surface}** (${limit.state}) — ${limit.reason}`);
	lines.push('');
	lines.push('## Mutation');
	lines.push('');
	lines.push(`- Seam: \`${receipt.mutation.seam}\` in ${receipt.mutation.path}`);
	lines.push(`- Before: ${receipt.mutation.beforeSha256}`);
	lines.push(`- Mutated: ${receipt.mutation.mutatedSha256}`);
	lines.push(`- After restore: ${receipt.mutation.afterRestoreSha256}`);
	lines.push(`- Restored run: ${receipt.mutation.restoredRun}`);
	lines.push('');
	lines.push('## Non-claims');
	lines.push('');
	for (const nonclaim of receipt.nonclaims) lines.push(`- ${nonclaim}`);
	lines.push('');
	return lines.join('\n');
}
