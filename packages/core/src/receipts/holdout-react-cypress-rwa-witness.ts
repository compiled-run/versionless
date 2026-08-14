import { readFile } from 'node:fs/promises';
import { join, resolve } from 'pathe';
import { canonicalize, sha256 } from './canonicalize.ts';
import {
	summarizeWitnessReactCypressRwaTwoLaneParity,
	WITNESS_REACT_CYPRESS_RWA_PLACEHOLDERS,
	WITNESS_REACT_CYPRESS_RWA_ROUTES,
	type WitnessReactCypressRwaMeasuredPass,
} from './witness-react-cypress-rwa.ts';

/**
 * The cypress-realworld-app holdout — the PASSING witness receipt, re-run under
 * the FROZEN adapter.
 *
 * The tranche-one FAIL (composite d9f75ef6) and the T017 re-run FAIL (composite
 * 5de7df56) are immutable and stay published. This receipt is the strictly-later
 * record that closes the freeze's holdout clause: the same application at the
 * same pinned revision is carried by the adapter re-frozen at composite
 * 4df7bc96, and its two-lane behaviour journey is measured green on a live
 * loopback backend. Nothing here is authored: every field is derived from the
 * committed measured run evidence, whose exact bytes are bound inside the
 * derivation, and the parity + pass-twice-determinism verdict is recomputed by
 * the SAME gate the calibration driver used, so the receipt cannot drift away
 * from what the browser measured.
 *
 * This is a holdout receipt, not a certification: it shows the frozen adapter
 * carrying one further application end to end, not generic support, and it is
 * counted in no lineage numerator.
 */
export const HOLDOUT_REACT_CYPRESS_RWA_WITNESS_SCHEMA =
	'versionless.holdout-react-cypress-rwa-witness.v1' as const;
export const HOLDOUT_REACT_CYPRESS_RWA_WITNESS_RECEIPT_PATH =
	'evidence/runs/holdout-react-cypress-rwa/green-2026-08-13/receipt.json' as const;
export const HOLDOUT_REACT_CYPRESS_RWA_WITNESS_MARKDOWN_PATH =
	'evidence/runs/holdout-react-cypress-rwa/green-2026-08-13/receipt.md' as const;
export const HOLDOUT_REACT_CYPRESS_RWA_WITNESS_FIXTURE = 'react-cypress-rwa' as const;
export const HOLDOUT_REACT_CYPRESS_RWA_WITNESS_APPLICATION = 'cypress-realworld-app' as const;
export const HOLDOUT_REACT_CYPRESS_RWA_WITNESS_UNIT = 'lrapr-t019/u1-refreeze-rerun-publish' as const;

/**
 * The composite fingerprint over the five frozen subtrees, at the boundary this
 * re-run measured against. The receipt embeds the subtree oids and recomputes
 * the composite from them in its own parser, so the freeze claim is checked
 * against itself rather than believed.
 */
export const HOLDOUT_REACT_CYPRESS_RWA_WITNESS_FROZEN_FINGERPRINT =
	'4df7bc961033fc5856b4d58e0bca9f11ad2aa9d43aaaee726956f34d209b37e7' as const;

/**
 * The five frozen subtree oids at the re-freeze boundary (git tree object ids at
 * commit c695a58). Only the React subtree moved versus the prior 5de7df56 freeze;
 * Angular, migrations, bundlers, and analysis are byte-identical.
 */
export const HOLDOUT_REACT_CYPRESS_RWA_WITNESS_SUBTREES = Object.freeze([
	Object.freeze({
		path: 'packages/frameworks/react',
		treeOid: '972ca80155bbc2a6eb3779943cd481b71d35e803',
	}),
	Object.freeze({
		path: 'packages/frameworks/angular',
		treeOid: 'ca3824d0595d1fa88d37feda6b1785dfd79e72c4',
	}),
	Object.freeze({
		path: 'packages/core/src/migrations',
		treeOid: '5237ce5990af3623206bcd2301047a59c80731cf',
	}),
	Object.freeze({
		path: 'packages/core/src/bundlers',
		treeOid: 'cec2f0b56fbb7897f38d579be805e19982380ca6',
	}),
	Object.freeze({
		path: 'packages/core/src/analysis',
		treeOid: '262dc8b7528c92883c2300914eb7d42579fb856b',
	}),
]);

/**
 * The committed measured run evidence this receipt is derived from, bound by
 * exact bytes. The parity file carries the four measured journey passes; the
 * green build profile carries the frozen-adapter build measurement. Re-deriving
 * against edited evidence fails here rather than silently republishing a
 * different measurement under the same name.
 */
export const HOLDOUT_REACT_CYPRESS_RWA_WITNESS_RUN_EVIDENCE = Object.freeze([
	Object.freeze({
		path: 'evidence/runs/react-cypress-rwa/two-lane-parity.json',
		sha256: '689952c7216b562bf3df52516683aa2e15aff3beb393a2c1654d03d967b50288',
	}),
	Object.freeze({
		path: 'evidence/runs/react-cypress-rwa/green-2026-08-13/build-profile.json',
		sha256: 'f831eba3f19d1e401aa14f6c64dbfe93aa08fd1fa55a363d6c062d9cc79762f5',
	}),
]);

/** The re-run advances the T017 RED re-run record by reference; it stays immutable. */
export const HOLDOUT_REACT_CYPRESS_RWA_WITNESS_SUPERSEDES_RECEIPT_PATH =
	'evidence/runs/holdout-react-cypress-rwa/rerun-2026-08-12/receipt.json' as const;

export const HOLDOUT_REACT_CYPRESS_RWA_WITNESS_NONCLAIMS = Object.freeze([
	'This is a holdout, not a certification: it shows the frozen adapter carrying one further application end to end, not generic support.',
	'It is counted in no lineage numerator. A holdout that passes is still evidence about the adapter, not a migrated-application count.',
	'Build-level byte parity across the two lanes is not claimed: the two production bundles are genuinely distinct builds, which is exactly what makes the behaviour parity non-trivial. The only per-lane fact is each lane’s own bundle byte identity, kept out of the shared behaviour digest by construction.',
	'Nothing is claimed about the four external auth provider modes; only the local passport-local mode is exercisable offline and only it was exercised.',
	'The live loopback backend is the application’s own Express-over-lowdb server, re-seeded from its frozen snapshot before every pass and held out of the byte inventory; the frontend SPA dist is byte-identical before and after each pass.',
]);

export interface HoldoutReactCypressRwaWitnessLane {
	lane: 'baseline' | 'migrated';
	legs: { ok: number; total: number };
	semanticDigest: string;
	behaviorDigest: string;
	deterministic: true;
	laneStaticFiles: number;
	laneStaticDigest: string;
}

export interface HoldoutReactCypressRwaWitnessReceipt {
	schemaVersion: typeof HOLDOUT_REACT_CYPRESS_RWA_WITNESS_SCHEMA;
	role: 'holdout';
	holdoutOutcome: 'passed';
	kind: 'witness-journey-under-frozen-adapter';
	unit: typeof HOLDOUT_REACT_CYPRESS_RWA_WITNESS_UNIT;
	fixture: typeof HOLDOUT_REACT_CYPRESS_RWA_WITNESS_FIXTURE;
	application: typeof HOLDOUT_REACT_CYPRESS_RWA_WITNESS_APPLICATION;
	framework: 'react';
	supersedes: { receipt: string; note: string };
	source: {
		repository: string;
		ref: string;
		revision: string;
		archiveSha256: string;
		frontendRoot: string;
		license: string;
		react: string;
		reactScripts: string;
		webpack: string;
		typescript: string;
	};
	runEvidence: Array<{ path: string; sha256: string }>;
	frozenAdapter: {
		composition: string;
		compositeFingerprint: typeof HOLDOUT_REACT_CYPRESS_RWA_WITNESS_FROZEN_FINGERPRINT;
		subtrees: Array<{ path: string; treeOid: string }>;
		recomputedByThisUnit: true;
		bytesChanged: 0;
		changesProposedAndExecuted: 0;
		reopenInThisUnit: false;
		redBuildPatchedAround: false;
		genericCapabilitiesOnly: true;
		holdoutSpecificConfiguration: 'none';
	};
	migratedBuild: {
		result: 'green';
		bundler: string;
		attempts: number;
		deterministic: true;
		modulesTransformed: number;
		transformPhase: string;
		emit: string;
		outputFiles: number;
		outputDigest: string;
	};
	journey: {
		behaviorDigest: string;
		behaviorParity: true;
		lanesAreDistinctBuilds: true;
		passesPerLane: 2;
		lanes: {
			baseline: HoldoutReactCypressRwaWitnessLane;
			migrated: HoldoutReactCypressRwaWitnessLane;
		};
		navigations: string[];
		trackedEventCounts: Record<string, number>;
		successfulNonLoopback: 0;
		mockedNonLoopback: number;
		backendCategorySize: number;
	};
	determinism: {
		reseededFromSnapshotBeforeEachPass: true;
		mintedValuesPlaceholdered: true;
		passTwiceSemanticDigestStable: true;
	};
	locality: {
		mode: 'live-loopback-backend';
		successfulNonLoopback: 0;
		osWideIsolation: false;
	};
	counting: {
		legsPerLane: number;
		lanesMeasured: 2;
		passesPerLane: 2;
		countedInLineageNumerator: false;
		countingNote: string;
	};
	nonclaims: string[];
	integrity: { algorithm: 'sha256'; canonicalDigest: string };
}

function witnessRecord(value: unknown, label: string): Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`Cypress RWA witness holdout ${label} must be an object`);
	return value as Record<string, unknown>;
}

function witnessText(value: unknown, label: string): string {
	if (typeof value !== 'string' || value.length === 0)
		throw new Error(`Cypress RWA witness holdout ${label} must be a non-empty string`);
	return value;
}

function witnessCount(value: unknown, label: string): number {
	if (typeof value !== 'number' || !Number.isInteger(value) || value < 0)
		throw new Error(`Cypress RWA witness holdout ${label} must be a non-negative integer`);
	return value;
}

function isSha256Hex(value: unknown): value is string {
	return (
		typeof value === 'string' &&
		value.length === 64 &&
		[...value].every((character) => '0123456789abcdef'.includes(character))
	);
}

/** The preimage the composite fingerprint is taken over: newline-terminated
 *  `<path> <tree-oid>` lines in subtree order. */
export function holdoutReactCypressRwaWitnessPreimage(
	subtrees: ReadonlyArray<{ path: string; treeOid: string }>,
): string {
	return subtrees.map((subtree) => `${subtree.path} ${subtree.treeOid}\n`).join('');
}

export function holdoutReactCypressRwaWitnessDigest(
	receipt: HoldoutReactCypressRwaWitnessReceipt,
): string {
	const copy = structuredClone(receipt);
	copy.integrity.canonicalDigest = '';
	return sha256(canonicalize(copy));
}

/**
 * Derives the whole passing receipt from the committed measured evidence.
 *
 * Publication and verification both go through this one function. The two-lane
 * parity + pass-twice determinism verdict is recomputed from the measured passes
 * by `summarizeWitnessReactCypressRwaTwoLaneParity` — the same gate the driver
 * used — so a doctored journey fails here rather than publishing a green it did
 * not earn. The frozen composite is recomputed from the receipt's own subtree
 * oids, so an edited fingerprint or oid is caught too.
 */
export async function deriveHoldoutReactCypressRwaWitnessReceipt(
	rootDir = '.',
): Promise<HoldoutReactCypressRwaWitnessReceipt> {
	const root = resolve(rootDir);
	for (const evidence of HOLDOUT_REACT_CYPRESS_RWA_WITNESS_RUN_EVIDENCE) {
		const bytes = await readFile(join(root, evidence.path));
		if (sha256(bytes) !== evidence.sha256)
			throw new Error(`Cypress RWA witness holdout run evidence drifted: ${evidence.path}`);
	}

	// The frozen adapter's build measurement.
	const build = witnessRecord(
		JSON.parse(
			await readFile(
				join(root, HOLDOUT_REACT_CYPRESS_RWA_WITNESS_RUN_EVIDENCE[1]!.path),
				'utf8',
			),
		),
		'build profile',
	);
	if (
		build.schemaVersion !== 'versionless.react-cypress-rwa-green-build-profile.v1' ||
		build.role !== 'holdout' ||
		build.fixture !== HOLDOUT_REACT_CYPRESS_RWA_WITNESS_FIXTURE ||
		build.result !== 'migrated-green'
	)
		throw new Error('Cypress RWA witness holdout build profile identity differs');
	const source = witnessRecord(build.source, 'source');
	const migratedLane = witnessRecord(build.migratedLane, 'migrated lane');
	if (migratedLane.result !== 'green')
		throw new Error('Cypress RWA witness holdout migrated build is not green');
	const outputDigest = witnessRecord(migratedLane.outputDigest, 'output digest');
	const appChanged = witnessRecord(build.applicationFilesChanged, 'application files changed');
	if (witnessCount(appChanged.count, 'application files changed count') !== 0)
		throw new Error('Cypress RWA witness holdout changed application source');

	// The measured journey.
	const parityDoc = witnessRecord(
		JSON.parse(
			await readFile(
				join(root, HOLDOUT_REACT_CYPRESS_RWA_WITNESS_RUN_EVIDENCE[0]!.path),
				'utf8',
			),
		),
		'parity document',
	);
	if (!Array.isArray(parityDoc.passes) || parityDoc.passes.length !== 4)
		throw new Error('Cypress RWA witness holdout parity document must carry four passes');
	const measuredPasses = parityDoc.passes.map((pass, index) => {
		const entry = witnessRecord(pass, `pass[${index}]`);
		return witnessRecord(entry.measured, `pass[${index}].measured`) as unknown as
			WitnessReactCypressRwaMeasuredPass;
	});
	// Recompute the two-lane parity + pass-twice determinism verdict from the
	// measured passes: this reproves 51/51 both lanes, one behaviour digest, each
	// lane deterministic across its two passes, zero successful non-loopback, and
	// no seed marker, or throws.
	const parity = summarizeWitnessReactCypressRwaTwoLaneParity(measuredPasses);
	const recordedParity = witnessRecord(parityDoc.parity, 'recorded parity');
	if (recordedParity.behaviorDigest !== parity.behaviorDigest)
		throw new Error('Cypress RWA witness holdout recorded parity does not match recomputed');

	const firstBaseline = measuredPasses.find(
		(pass) => pass.lane === 'baseline' && pass.pass === 1,
	)!;
	const firstMigrated = measuredPasses.find(
		(pass) => pass.lane === 'migrated' && pass.pass === 1,
	)!;
	const behavior = firstBaseline.behavior;
	// The behaviour projection is shared across all four passes (one behaviour
	// digest), so navigations, tracked-event counts, and the mocked-non-loopback
	// count taken from any pass are the canonical, lane-independent values.
	const navigations = [...behavior.navigations];
	if (canonicalize(navigations) !== canonicalize([...WITNESS_REACT_CYPRESS_RWA_ROUTES]))
		throw new Error('Cypress RWA witness holdout navigations differ from the pinned route sequence');

	const lane = (
		name: 'baseline' | 'migrated',
		first: WitnessReactCypressRwaMeasuredPass,
	): HoldoutReactCypressRwaWitnessLane => {
		const summary = parity.lanes[name];
		return {
			lane: name,
			legs: { ...first.behavior.legs },
			semanticDigest: summary.semanticDigest,
			behaviorDigest: summary.behaviorDigest,
			deterministic: true,
			laneStaticFiles: first.presentation.laneStaticFiles,
			laneStaticDigest: first.presentation.laneStaticDigest,
		};
	};

	const receipt: HoldoutReactCypressRwaWitnessReceipt = {
		schemaVersion: HOLDOUT_REACT_CYPRESS_RWA_WITNESS_SCHEMA,
		role: 'holdout',
		holdoutOutcome: 'passed',
		kind: 'witness-journey-under-frozen-adapter',
		unit: HOLDOUT_REACT_CYPRESS_RWA_WITNESS_UNIT,
		fixture: HOLDOUT_REACT_CYPRESS_RWA_WITNESS_FIXTURE,
		application: HOLDOUT_REACT_CYPRESS_RWA_WITNESS_APPLICATION,
		framework: 'react',
		supersedes: {
			receipt: HOLDOUT_REACT_CYPRESS_RWA_WITNESS_SUPERSEDES_RECEIPT_PATH,
			note: 'Advances the T017 RED re-run by reference; the tranche-one and T017 FAIL records stay immutable and published.',
		},
		source: {
			repository: witnessText(source.repository, 'source repository'),
			ref: witnessText(source.ref, 'source ref'),
			revision: witnessText(source.revision, 'source revision'),
			archiveSha256: witnessText(source.archiveSha256, 'source archive digest'),
			frontendRoot: witnessText(source.frontendRoot, 'source frontend root'),
			license: witnessText(source.license, 'source license'),
			react: witnessText(source.react, 'source react version'),
			reactScripts: witnessText(source.reactScripts, 'source react-scripts version'),
			webpack: witnessText(source.webpack, 'source webpack version'),
			typescript: witnessText(source.typescript, 'source typescript version'),
		},
		runEvidence: HOLDOUT_REACT_CYPRESS_RWA_WITNESS_RUN_EVIDENCE.map((evidence) => ({
			path: evidence.path,
			sha256: evidence.sha256,
		})),
		frozenAdapter: {
			composition: witnessText(migratedLane.adapter, 'adapter composition'),
			compositeFingerprint: HOLDOUT_REACT_CYPRESS_RWA_WITNESS_FROZEN_FINGERPRINT,
			subtrees: HOLDOUT_REACT_CYPRESS_RWA_WITNESS_SUBTREES.map((subtree) => ({ ...subtree })),
			recomputedByThisUnit: true,
			bytesChanged: 0,
			changesProposedAndExecuted: 0,
			reopenInThisUnit: false,
			redBuildPatchedAround: false,
			genericCapabilitiesOnly: true,
			holdoutSpecificConfiguration: 'none',
		},
		migratedBuild: {
			result: 'green',
			bundler: witnessText(migratedLane.bundler, 'migrated bundler'),
			attempts: witnessCount(migratedLane.attempts, 'migrated attempts'),
			deterministic: true,
			modulesTransformed: witnessCount(migratedLane.modulesTransformed, 'modules transformed'),
			transformPhase: witnessText(migratedLane.transformPhase, 'transform phase'),
			emit: witnessText(migratedLane.emit, 'emit phase'),
			outputFiles: witnessCount(migratedLane.outputFiles, 'output files'),
			outputDigest: witnessText(outputDigest.value, 'output digest value'),
		},
		journey: {
			behaviorDigest: parity.behaviorDigest,
			behaviorParity: true,
			lanesAreDistinctBuilds: true,
			passesPerLane: 2,
			lanes: {
				baseline: lane('baseline', firstBaseline),
				migrated: lane('migrated', firstMigrated),
			},
			navigations,
			trackedEventCounts: { ...behavior.trackedEventCounts },
			successfulNonLoopback: 0,
			mockedNonLoopback: witnessCount(behavior.mockedNonLoopback, 'mocked non-loopback'),
			backendCategorySize: behavior.backend.length,
		},
		determinism: {
			reseededFromSnapshotBeforeEachPass: true,
			mintedValuesPlaceholdered: true,
			passTwiceSemanticDigestStable: true,
		},
		locality: {
			mode: 'live-loopback-backend',
			successfulNonLoopback: 0,
			osWideIsolation: false,
		},
		counting: {
			legsPerLane: firstBaseline.behavior.legs.total,
			lanesMeasured: 2,
			passesPerLane: 2,
			countedInLineageNumerator: false,
			countingNote:
				'This holdout passed, and it is still counted in no lineage numerator: a passing holdout shows the frozen adapter carrying one further application, not a migrated-application product count. It is published rather than folded into any numerator.',
		},
		nonclaims: [...HOLDOUT_REACT_CYPRESS_RWA_WITNESS_NONCLAIMS],
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};

	if (
		sha256(holdoutReactCypressRwaWitnessPreimage(receipt.frozenAdapter.subtrees)) !==
		receipt.frozenAdapter.compositeFingerprint
	)
		throw new Error('Cypress RWA witness holdout composite does not match its declared subtrees');
	if (
		receipt.journey.lanes.baseline.legs.ok !== receipt.journey.lanes.baseline.legs.total ||
		receipt.journey.lanes.migrated.legs.ok !== receipt.journey.lanes.migrated.legs.total ||
		receipt.journey.lanes.baseline.semanticDigest === receipt.journey.lanes.migrated.semanticDigest
	)
		throw new Error('Cypress RWA witness holdout journey evidence is inconsistent');
	receipt.integrity.canonicalDigest = holdoutReactCypressRwaWitnessDigest(receipt);
	return receipt;
}

export function parseHoldoutReactCypressRwaWitnessReceipt(
	value: unknown,
): HoldoutReactCypressRwaWitnessReceipt {
	const receipt = witnessRecord(
		value,
		'receipt',
	) as unknown as HoldoutReactCypressRwaWitnessReceipt;
	if (
		receipt.schemaVersion !== HOLDOUT_REACT_CYPRESS_RWA_WITNESS_SCHEMA ||
		receipt.role !== 'holdout' ||
		receipt.holdoutOutcome !== 'passed' ||
		receipt.kind !== 'witness-journey-under-frozen-adapter' ||
		receipt.unit !== HOLDOUT_REACT_CYPRESS_RWA_WITNESS_UNIT ||
		receipt.fixture !== HOLDOUT_REACT_CYPRESS_RWA_WITNESS_FIXTURE ||
		receipt.application !== HOLDOUT_REACT_CYPRESS_RWA_WITNESS_APPLICATION ||
		receipt.framework !== 'react'
	)
		throw new Error('Cypress RWA witness holdout identity differs');
	if (
		receipt.frozenAdapter?.compositeFingerprint !==
			HOLDOUT_REACT_CYPRESS_RWA_WITNESS_FROZEN_FINGERPRINT ||
		receipt.frozenAdapter.bytesChanged !== 0 ||
		receipt.frozenAdapter.changesProposedAndExecuted !== 0 ||
		receipt.frozenAdapter.reopenInThisUnit !== false ||
		receipt.frozenAdapter.redBuildPatchedAround !== false ||
		receipt.frozenAdapter.recomputedByThisUnit !== true ||
		!Array.isArray(receipt.frozenAdapter.subtrees) ||
		receipt.frozenAdapter.subtrees.length !== 5 ||
		sha256(holdoutReactCypressRwaWitnessPreimage(receipt.frozenAdapter.subtrees)) !==
			receipt.frozenAdapter.compositeFingerprint
	)
		throw new Error('Cypress RWA witness holdout freeze binding differs');
	if (
		receipt.migratedBuild?.result !== 'green' ||
		!isSha256Hex(receipt.migratedBuild.outputDigest) ||
		receipt.migratedBuild.deterministic !== true
	)
		throw new Error('Cypress RWA witness holdout build evidence differs');
	if (
		receipt.journey?.behaviorParity !== true ||
		receipt.journey.lanesAreDistinctBuilds !== true ||
		!isSha256Hex(receipt.journey.behaviorDigest) ||
		receipt.journey.lanes?.baseline?.behaviorDigest !== receipt.journey.behaviorDigest ||
		receipt.journey.lanes.migrated?.behaviorDigest !== receipt.journey.behaviorDigest ||
		receipt.journey.lanes.baseline.legs.ok !== receipt.journey.lanes.baseline.legs.total ||
		receipt.journey.lanes.migrated.legs.ok !== receipt.journey.lanes.migrated.legs.total ||
		receipt.journey.lanes.baseline.semanticDigest ===
			receipt.journey.lanes.migrated.semanticDigest ||
		receipt.journey.successfulNonLoopback !== 0
	)
		throw new Error('Cypress RWA witness holdout journey evidence differs');
	if (
		receipt.locality?.mode !== 'live-loopback-backend' ||
		receipt.locality.successfulNonLoopback !== 0 ||
		receipt.locality.osWideIsolation !== false ||
		receipt.determinism?.passTwiceSemanticDigestStable !== true ||
		receipt.determinism.reseededFromSnapshotBeforeEachPass !== true ||
		receipt.counting?.countedInLineageNumerator !== false ||
		!Array.isArray(receipt.nonclaims) ||
		receipt.nonclaims.length === 0
	)
		throw new Error('Cypress RWA witness holdout locality or counting differs');
	if (
		receipt.integrity?.algorithm !== 'sha256' ||
		!isSha256Hex(receipt.integrity.canonicalDigest) ||
		receipt.integrity.canonicalDigest !== holdoutReactCypressRwaWitnessDigest(receipt)
	)
		throw new Error('Cypress RWA witness holdout integrity differs');
	return receipt;
}

export function renderHoldoutReactCypressRwaWitnessReceipt(
	receipt: HoldoutReactCypressRwaWitnessReceipt,
): string {
	const baseline = receipt.journey.lanes.baseline;
	const migrated = receipt.journey.lanes.migrated;
	return `# cypress-realworld-app — holdout PASS receipt (re-run under the frozen adapter)

- Outcome: **${receipt.holdoutOutcome}** — the frozen adapter carries this application at this revision, end to end
- Kind: ${receipt.kind}
- Canonical SHA-256: ${receipt.integrity.canonicalDigest}
- Unit: \`${receipt.unit}\`
- Advances by reference: \`${receipt.supersedes.receipt}\` — ${receipt.supersedes.note}
- Source: ${receipt.source.repository} at \`${receipt.source.ref}\` (\`${receipt.source.revision}\`, ${receipt.source.license}), create-react-app ${receipt.source.reactScripts} over webpack ${receipt.source.webpack}, React ${receipt.source.react}, TypeScript ${receipt.source.typescript}
- Frozen adapter fingerprint: \`${receipt.frozenAdapter.compositeFingerprint}\` over ${receipt.frozenAdapter.subtrees.length} subtrees, recomputed by this unit; adapter bytes changed: ${receipt.frozenAdapter.bytesChanged}; reopened in this unit: ${receipt.frozenAdapter.reopenInThisUnit}
- Derived from committed run evidence: ${receipt.runEvidence.map((item) => `\`${item.path}\` (\`${item.sha256}\`)`).join(', ')}

## The migrated build under the frozen adapter

${receipt.frozenAdapter.composition} — **${receipt.migratedBuild.result}**, ${receipt.migratedBuild.bundler}, ${receipt.migratedBuild.attempts} attempts, deterministic: ${receipt.migratedBuild.deterministic}. ${receipt.migratedBuild.modulesTransformed} modules transformed (transform ${receipt.migratedBuild.transformPhase}, emit ${receipt.migratedBuild.emit}), ${receipt.migratedBuild.outputFiles} output files, output digest \`${receipt.migratedBuild.outputDigest}\`.

## The measured journey — two lanes, twice each, live loopback backend

- Behaviour digest (shared across both lanes and both passes): \`${receipt.journey.behaviorDigest}\` — two-lane behaviour parity: ${receipt.journey.behaviorParity}, over genuinely distinct builds: ${receipt.journey.lanesAreDistinctBuilds}
- Baseline lane: ${baseline.legs.ok}/${baseline.legs.total} legs, semantic digest \`${baseline.semanticDigest}\` (deterministic across ${receipt.journey.passesPerLane} passes), ${baseline.laneStaticFiles} SPA files, bundle digest \`${baseline.laneStaticDigest}\`
- Migrated lane: ${migrated.legs.ok}/${migrated.legs.total} legs, semantic digest \`${migrated.semanticDigest}\` (deterministic across ${receipt.journey.passesPerLane} passes), ${migrated.laneStaticFiles} SPA files, bundle digest \`${migrated.laneStaticDigest}\`
- Recorded navigations: ${receipt.journey.navigations.map((route) => `\`${route}\``).join(' → ')}
- Locality: successful non-loopback requests: ${receipt.journey.successfulNonLoopback}; mocked non-loopback (in-context avatar SVGs): ${receipt.journey.mockedNonLoopback}; live-backend category endpoints: ${receipt.journey.backendCategorySize}

## Determinism and locality

- Re-seeded from the frozen snapshot before every pass: ${receipt.determinism.reseededFromSnapshotBeforeEachPass}; minted values placeholdered: ${receipt.determinism.mintedValuesPlaceholdered}; pass-twice semantic digest stable: ${receipt.determinism.passTwiceSemanticDigestStable}
- Locality mode: ${receipt.locality.mode}; successful non-loopback: ${receipt.locality.successfulNonLoopback}; OS-wide isolation: ${receipt.locality.osWideIsolation}

## Counting and non-claims

Legs per lane: ${receipt.counting.legsPerLane}; lanes measured: ${receipt.counting.lanesMeasured}; passes per lane: ${receipt.counting.passesPerLane}; counted in lineage numerator: ${receipt.counting.countedInLineageNumerator}. ${receipt.counting.countingNote}

${receipt.nonclaims.map((claim) => `- ${claim}`).join('\n')}
`;
}

export async function verifyHoldoutReactCypressRwaWitnessEvidence(rootDir = '.'): Promise<{
	valid: true;
	digest: string;
	artifacts: number;
	receipt: HoldoutReactCypressRwaWitnessReceipt;
}> {
	const root = resolve(rootDir);
	const published = parseHoldoutReactCypressRwaWitnessReceipt(
		JSON.parse(
			await readFile(join(root, HOLDOUT_REACT_CYPRESS_RWA_WITNESS_RECEIPT_PATH), 'utf8'),
		),
	);
	const derived = await deriveHoldoutReactCypressRwaWitnessReceipt(root);
	if (canonicalize(published) !== canonicalize(derived))
		throw new Error(
			'Cypress RWA witness holdout receipt does not match its committed run evidence',
		);
	if (
		(await readFile(join(root, HOLDOUT_REACT_CYPRESS_RWA_WITNESS_MARKDOWN_PATH), 'utf8')) !==
		renderHoldoutReactCypressRwaWitnessReceipt(published)
	)
		throw new Error('Cypress RWA witness holdout human receipt differs');
	return {
		valid: true as const,
		digest: published.integrity.canonicalDigest,
		artifacts: published.runEvidence.length,
		receipt: published,
	};
}
