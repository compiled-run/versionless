import { readFile } from 'node:fs/promises';
import { charIn, createRegExp } from 'magic-regexp';
import { join, resolve } from 'pathe';
import { canonicalize, sha256 } from './canonicalize.ts';
import {
	parseWitnessAngularEshopWebspaReceipt,
	WITNESS_ANGULAR_ESHOP_WEBSPA_SURFACE_LIMITS,
	WITNESS_ANGULAR_ESHOP_WEBSPA_UNIT,
	type WitnessAngularEshopWebspaReceipt,
} from './witness-angular-eshop-webspa.ts';

/**
 * The eShopOnContainers WebSPA Angular holdout ledger entry.
 *
 * This is the third published holdout, and the first Angular one whose migrated
 * lane reached both a build and a browser. It is published for the same reason
 * the two failures were: an adapter that only publishes the applications it
 * carried is not evidence, and an adapter that publishes a partial success as a
 * whole one is worse.
 *
 * What this record states, in the order it happened:
 *
 * 1. Gate zero passed — but only because the T022 follow-up ruling overturned
 *    the pre-Ivy screen verdict on this candidate under the successor-across-
 *    names rule. The original screen text is unchanged and the overturn is
 *    named rather than absorbed.
 * 2. RED at install under the frozen `f1a63359` composite (T023 u5), with zero
 *    adapter bytes changed, five gaps itemised and no closure linked. That
 *    record stands; it is history, not a draft.
 * 3. GREEN migrated production build after the board-authorized T024 Angular
 *    reopen: `npm run build:prod` exits 0 and two full runs are byte-identical.
 * 4. GREEN browser Witness (T024 u6), run AFTER the `27741d9c` re-freeze and
 *    against byte-identical adapter output — the migrated bytes the Witness
 *    served digest to the same inventory the published green build emitted —
 *    with two-lane behaviour parity, per-lane pass-twice determinism, a
 *    mutation-red/byte-restore proof and zero successful non-loopback requests.
 *
 * And what it does not state. The journey is the anonymous catalog surface and
 * only that surface: identity is out of surface, basket, orders and campaigns
 * are out of surface behind it, the SignalR hub was never reached, and text
 * entry and drag were not tested. The outcome word says "on a bounded surface"
 * for exactly that reason — a generic `passed` here would claim the four
 * surfaces nobody drove.
 *
 * Every field is derived from the sealed run and Witness evidence rather than
 * authored here, so the entry cannot drift away from what the runs measured.
 */
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_SCHEMA =
	'versionless.holdout-angular-eshop-webspa.v1' as const;
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_RECEIPT_PATH =
	'evidence/runs/holdout-angular-eshop-webspa/receipt.json' as const;
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_MARKDOWN_PATH =
	'evidence/runs/holdout-angular-eshop-webspa/receipt.md' as const;
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_ATTEMPT_PATH =
	'evidence/ingests/angular-eshop-webspa-netcore2-2/attempt.json' as const;
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_BUILD_INVENTORY_PATH =
	'evidence/ingests/angular-eshop-webspa-netcore2-2/migration/u4-t024-build-inventory-run1-vs-run2.json' as const;
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_FIXTURE = 'angular-eshop-webspa-netcore2-2' as const;
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_APPLICATION = 'eShopOnContainers WebSPA' as const;
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_INGEST_UNIT =
	'lrapr-t023/u3-boundary-amend-candidate3-acquire' as const;
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_RED_UNIT =
	'lrapr-t023/u5-frozen-adapter-migration' as const;
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_GREEN_UNIT =
	'lrapr-t024/u4-exports-map-wiring-green-attempt' as const;
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_WITNESS_UNIT = WITNESS_ANGULAR_ESHOP_WEBSPA_UNIT;
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_PUBLISHING_UNIT =
	'lrapr-t024/u7-canonical-holdout-publish' as const;

/**
 * The one word this entry is allowed to be summarised by.
 *
 * `passed` on its own would be the overclaim available here: it would carry the
 * four surfaces the journey never drove. `migrated-build-green-witness-pending`
 * is no longer true either — the Witness ran and it is green. The outcome names
 * the proof and its boundary in one token, so no downstream renderer has to
 * decide which half to carry.
 */
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_OUTCOME =
	'witness-passed-on-bounded-anonymous-catalog-surface' as const;

/** The state this publication supersedes, retained by reference rather than erased. */
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_SUPERSEDED_OUTCOME =
	'migrated-build-green-witness-pending' as const;
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_SUPERSEDED_DIGEST =
	'a1c43326cb9b0f756e269d0e8339abe64df85a4ce9b709d7c612d37f8e7f0712' as const;

/**
 * What is still unproven, stated in the field a failed holdout uses for its
 * missing capability. A holdout proven on part of its surface has to say which
 * part is missing in the same place a holdout that failed does, or a reader
 * comparing the two entries has to know which fields to distrust.
 */
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_STILL_UNPROVEN =
	'every surface outside the anonymous catalog: identity is out of surface and basket, orders and campaigns are out of surface behind it, the SignalR hub was never reached, and text entry and drag were not tested — those surfaces are unproven rather than proven absent' as const;

/** The Witness state and browser-proof words this entry is allowed to publish. */
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_WITNESS_STATE = 'passed-on-bounded-surface' as const;
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_BROWSER_PROOF =
	'verified-on-bounded-anonymous-catalog-surface' as const;
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_PROVEN_SURFACE = 'anonymous-catalog' as const;

/**
 * The committed run evidence this entry is derived from, bound by exact bytes.
 *
 * Both eras of the run are bound: the T023 install RED and the T024 green
 * build. Re-deriving against edited evidence fails here rather than quietly
 * republishing a different measurement under the same name.
 */
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_RUN_EVIDENCE = Object.freeze([
	Object.freeze({
		path: HOLDOUT_ANGULAR_ESHOP_WEBSPA_ATTEMPT_PATH,
		sha256: 'f9ce14109d20634ce7ac679c8dda6be2d2bf3a5f1a13087b47528840045ace86',
	}),
	Object.freeze({
		path: 'evidence/ingests/angular-eshop-webspa-netcore2-2/migration/u5-lane-install-red.log',
		sha256: '6666630237c89b3c89f9df0615fdc443c687482e98728cbaca82ad6aca1b1456',
	}),
	Object.freeze({
		path: 'evidence/ingests/angular-eshop-webspa-netcore2-2/migration/u4-t024-lane-install.log',
		sha256: '5254287d3fda581b45ef864c53eb6a8fd83cbb7c71cbb823e56760b484e3f920',
	}),
	Object.freeze({
		path: 'evidence/ingests/angular-eshop-webspa-netcore2-2/migration/u4-t024-target-build.log',
		sha256: 'e1d04fe579de4639e1565bac20e3c55f416fd8cfde68665dcfa10b3327bb7bf1',
	}),
	Object.freeze({
		path: 'evidence/ingests/angular-eshop-webspa-netcore2-2/migration/u4-t024-target-build-run2.log',
		sha256: '78eb802f319b32f4a85c8c7269f07a59141b7a8ba9a83b795120993101a79b8b',
	}),
	Object.freeze({
		path: HOLDOUT_ANGULAR_ESHOP_WEBSPA_BUILD_INVENTORY_PATH,
		sha256: '1a0cb82feff57b567739542bd674d472fdbd1cffdf4414dc5d7772e78f5bc7c9',
	}),
]);

/**
 * The sealed Witness evidence this entry's browser claims are derived from,
 * bound by exact bytes.
 *
 * The Witness receipt is not summarised here: it is parsed by its own verifier,
 * which re-proves parity across the four runs, per-lane pass-twice determinism,
 * the mutation-red/byte-restore seam, the projection ledger's accounting and
 * the surface limits, before one field of it reaches this entry. The three
 * companion artefacts are bound too, so an edit to any of them fails the
 * derivation instead of republishing a different measurement under this name.
 */
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_WITNESS_EVIDENCE = Object.freeze([
	Object.freeze({
		path: 'evidence/runs/angular-eshop-webspa/receipt.json',
		sha256: 'e6835d8af995c197d24ebd2ea7fd22ae4ca3e5b04cbab0430b5c6bc3a3bf2d7b',
	}),
	Object.freeze({
		path: 'evidence/runs/angular-eshop-webspa/receipt.md',
		sha256: 'cf16a78c4867033792fe4a6fe5a048f7f791bea6dad97cf2af189110ec14d354',
	}),
	Object.freeze({
		path: 'evidence/runs/angular-eshop-webspa/witness-journeys.json',
		sha256: '2e4700e1a05b3f6884162c8999c2a0969957469b34e6c5b4d20908975f8718c0',
	}),
	Object.freeze({
		path: 'evidence/runs/angular-eshop-webspa/witness-mutation.json',
		sha256: 'a7a63482e4ff72e895b3ea775464d2c0e8a1f29f699e8e2aeec7bab445c519b1',
	}),
	Object.freeze({
		path: 'evidence/runs/angular-eshop-webspa/witness-projection-ledger.json',
		sha256: '581508622ee998afeac570652329528d65d207225a8df64ab294a238b66731eb',
	}),
]);

/** Where the sealed Witness evidence lives, as one path a reader can open. */
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_WITNESS_EVIDENCE_DIRECTORY =
	'evidence/runs/angular-eshop-webspa' as const;

/**
 * The two adapter states this application was measured under.
 *
 * `f1a63359` is the freeze the install RED was taken against, with zero adapter
 * bytes changed. `4b6e2f44` is the Angular subtree the green build ran against,
 * and `27741d9c` is the composite the re-freeze publishes it as — the same
 * composite the Witness receipt names, because the Witness ran after the
 * re-freeze rather than beside it. Both adapter states are recorded because
 * both are true of different runs, and the reopen between them was authorized
 * and is named — a reader is never asked to assume the adapter stood still when
 * it did not.
 */
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_FROZEN_FINGERPRINT =
	'f1a63359210b87c04408b27cf8c40e88e1b47d44bcc7f5a9be20d9478dc71012' as const;
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_ANGULAR_SUBTREE_AT_GREEN =
	'4b6e2f4494d98582e4fe9b420c2b412059dc0720' as const;
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_REFREEZE_COMPOSITE =
	'27741d9c8bfac1b6bb0b330423b1cf258fcde722f548ecb9cf8b389cc98e4234' as const;
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_REACT_SUBTREE =
	'972ca80155bbc2a6eb3779943cd481b71d35e803' as const;

/**
 * The nine capabilities and composition repairs the authorized T024 reopen
 * produced, each bound to a marker that must appear verbatim in the sealed run
 * record.
 *
 * Authoring the list here and checking it against the runs is the point: a
 * capability nobody can find in the evidence is a capability nobody proved, and
 * the reopen's cost has to stay countable without diffing two freezes.
 */
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_REOPEN_CAPABILITIES = Object.freeze([
	Object.freeze({
		capability: 'unread-declaration-silence-reporting',
		unit: 'lrapr-t024/u1-silence-defect-and-declarations',
		what: 'the manifest alignment reports every era-pinned declaration the cell has read no line for, instead of carrying it silently at its era pin',
		markers: Object.freeze([
			'alignAngularPackageManifest now reports every era-pinned declaration the cell has read no line for',
		]),
	}),
	Object.freeze({
		capability: 'angular-16-community-layer-readings',
		unit: 'lrapr-t024/u1-silence-defect-and-declarations',
		what: 'community-layer readings of published bytes for the two packages that stopped the lane, taken by the same rule every other entry there was chosen by',
		markers: Object.freeze(['a community-layer reading of the published bytes']),
	}),
	Object.freeze({
		capability: 'superseded-era-lockfile',
		unit: 'lrapr-t024/u1-silence-defect-and-declarations',
		what: 'era-lockfile supersession as a changeset declaration rather than a lane convention, taken only where the lockfile bytes contradict the migrated manifest bytes',
		markers: Object.freeze(['supersedeEraLockfiles']),
	}),
	Object.freeze({
		capability: 'workspace-script-flags',
		unit: 'lrapr-t024/u1-silence-defect-and-declarations',
		what: 'npm-script flag retargeting driven by the builder options this workspace migration actually removed',
		markers: Object.freeze(['retargetWorkspaceScripts']),
	}),
	Object.freeze({
		capability: 'use-position-symbol-successor',
		unit: 'lrapr-t024/u2-value-position-successor-and-compile-wall',
		what: 'cross-package removed-symbol carriage read one use position at a time, with a measured refusal where a rename would compile and lie',
		markers: Object.freeze(['use-position-symbol-successor']),
	}),
	Object.freeze({
		capability: 'removed-static-module-method',
		unit: 'lrapr-t024/u2-value-position-successor-and-compile-wall',
		what: 'removal of a static module configuration method the aligned line no longer declares, gated on the installed declarations',
		markers: Object.freeze(['removed-static-module-method']),
	}),
	Object.freeze({
		capability: 'rxjs-prototype-patch-and-tilde-sass-composition',
		unit: 'lrapr-t024/u2-value-position-successor-and-compile-wall',
		what: 'two already-exported capabilities composed into the driver behind supply gates: the RxJS prototype-patch seam on compiler-stated positions, and the webpack tilde style specifier after the exports-map rewrite whose output it resolves',
		markers: Object.freeze(['rxjs-prototype-patch-migration', 'webpack-tilde-style-specifier']),
	}),
	Object.freeze({
		capability: 'http-client-call-surface',
		unit: 'lrapr-t024/u3-httpclient-call-surface',
		what: 'the call surface of a removed HTTP client carried as one whole flow at a time, supply-gated on the successor classes as the lane installed them',
		markers: Object.freeze(['http-client-call-surface']),
	}),
	Object.freeze({
		capability: 'package-exports-republished-subpath',
		unit: HOLDOUT_ANGULAR_ESHOP_WEBSPA_GREEN_UNIT,
		what: 'a blocked stylesheet import whose file the package exports map still publishes under another key is rewritten onto that key, which changes no payload and therefore declares nothing',
		markers: Object.freeze(['republished subpath', 'package-exports-style-imports']),
	}),
]);

/**
 * What this entry does not claim, over and above the runs' own non-claims.
 *
 * The first one is the load-bearing sentence of this publication: the outcome
 * is a pass on a named surface, and it is not a pass on the application.
 */
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_ADDED_NONCLAIMS = Object.freeze([
	'This holdout passed on a bounded surface, and the boundary is part of the claim. The anonymous catalog surface is what the journey drove and what parity was measured over; identity, basket, orders and campaigns are out of surface, the SignalR hub was never reached, and text entry and drag were not tested. Nothing here may be restated as a generic pass.',
	'The install RED under the frozen f1a63359 composite is not retracted by anything that followed it. It is what the frozen adapter did, it is published unchanged, and both the green build and the Witness ran against a reopened and re-frozen adapter and say so.',
	'No claim that the nine capabilities the reopen extracted are proven. Every one of them was written against this single application, and all nine stay experimental and out of the supported matrix until a second, independent Angular application carries them.',
	"This entry is counted in no lineage numerator, and this receipt does not decide whether it ever should be. Counting is the Judge's layer: `countedInLineageNumerator` stays false here, and any flip is made there, with its own reasoning, on evidence this receipt only supplies.",
	'A behaviour digest that matches across the two lanes is a statement that the migrated build did what the era baseline did on the legs recorded here. It is not a statement that either build is correct, and the application’s own test suites were not run.',
]);

export interface HoldoutAngularEshopWebspaCapability {
	capability: string;
	unit: string;
	what: string;
	markers: string[];
}

export interface HoldoutAngularEshopWebspaSurfaceLimit {
	surface: string;
	state: string;
	reason: string;
}

export interface HoldoutAngularEshopWebspaReceipt {
	schemaVersion: typeof HOLDOUT_ANGULAR_ESHOP_WEBSPA_SCHEMA;
	role: 'holdout';
	holdoutOutcome: typeof HOLDOUT_ANGULAR_ESHOP_WEBSPA_OUTCOME;
	reason: typeof HOLDOUT_ANGULAR_ESHOP_WEBSPA_STILL_UNPROVEN;
	supersedes: {
		outcome: typeof HOLDOUT_ANGULAR_ESHOP_WEBSPA_SUPERSEDED_OUTCOME;
		digest: typeof HOLDOUT_ANGULAR_ESHOP_WEBSPA_SUPERSEDED_DIGEST;
		note: string;
	};
	ingestUnit: typeof HOLDOUT_ANGULAR_ESHOP_WEBSPA_INGEST_UNIT;
	measuringUnit: typeof HOLDOUT_ANGULAR_ESHOP_WEBSPA_GREEN_UNIT;
	witnessUnit: typeof HOLDOUT_ANGULAR_ESHOP_WEBSPA_WITNESS_UNIT;
	publishedBy: typeof HOLDOUT_ANGULAR_ESHOP_WEBSPA_PUBLISHING_UNIT;
	fixture: typeof HOLDOUT_ANGULAR_ESHOP_WEBSPA_FIXTURE;
	application: typeof HOLDOUT_ANGULAR_ESHOP_WEBSPA_APPLICATION;
	framework: 'angular';
	source: {
		repository: string;
		release: string;
		revision: string;
		subpath: string;
		archiveSha256: string;
		license: string;
		licenseSha256: string;
		angular: string;
		angularCli: string;
		typescript: string;
	};
	gateZero: {
		state: 'passed';
		licenseAtPin: string;
		screenVerdict: string;
		ruledVerdict: string;
		overturnRecord: string;
		originalScreenTextUnchanged: true;
		statement: string;
	};
	runEvidence: Array<{ path: string; sha256: string }>;
	witnessEvidence: Array<{ path: string; sha256: string }>;
	frozenAdapter: {
		compositeFingerprintAtIngestion: typeof HOLDOUT_ANGULAR_ESHOP_WEBSPA_FROZEN_FINGERPRINT;
		bytesChangedAtIngestion: 0;
		authorizedReopen: {
			task: 'T024';
			subtree: 'packages/frameworks/angular';
			capabilitiesExtracted: number;
			angularSubtreeOidAtGreen: typeof HOLDOUT_ANGULAR_ESHOP_WEBSPA_ANGULAR_SUBTREE_AT_GREEN;
			refreezeComposite: typeof HOLDOUT_ANGULAR_ESHOP_WEBSPA_REFREEZE_COMPOSITE;
			reactSubtreeUnchanged: typeof HOLDOUT_ANGULAR_ESHOP_WEBSPA_REACT_SUBTREE;
			entries: HoldoutAngularEshopWebspaCapability[];
			statement: string;
		};
		holdoutSpecificConfiguration: 'none';
		applicationFilesHandEdited: 0;
	};
	cell: { id: string; angularLine: string; builder: string; node: string };
	lanes: {
		baseline: {
			outcome: 'green';
			toolchain: string;
			buildsCompared: number;
			byteIdenticalAcrossRuns: true;
			statement: string;
		};
		migratedUnderFreeze: {
			outcome: 'red';
			unit: typeof HOLDOUT_ANGULAR_ESHOP_WEBSPA_RED_UNIT;
			composite: typeof HOLDOUT_ANGULAR_ESHOP_WEBSPA_FROZEN_FINGERPRINT;
			stage: 'install';
			installAttempts: number;
			packagesInstalled: 0;
			gapsItemised: number;
			buildAttempted: false;
			artifactProduced: false;
			statement: string;
		};
		migratedAfterReopen: {
			outcome: 'green';
			unit: typeof HOLDOUT_ANGULAR_ESHOP_WEBSPA_GREEN_UNIT;
			installExitStatus: 0;
			buildRuns: number;
			byteIdenticalAcrossRuns: true;
			artifactProduced: true;
			filesEmitted: number;
			bytesEmitted: number;
			remainingDiagnostics: 0;
			forcedFlagsUsed: false;
			narrowingApplied: false;
			statement: string;
		};
	};
	witness: {
		state: typeof HOLDOUT_ANGULAR_ESHOP_WEBSPA_WITNESS_STATE;
		unit: typeof HOLDOUT_ANGULAR_ESHOP_WEBSPA_WITNESS_UNIT;
		evidenceDirectory: typeof HOLDOUT_ANGULAR_ESHOP_WEBSPA_WITNESS_EVIDENCE_DIRECTORY;
		witnessReceiptDigest: string;
		adapterComposite: typeof HOLDOUT_ANGULAR_ESHOP_WEBSPA_REFREEZE_COMPOSITE;
		ranAfterRefreeze: true;
		servedMigratedBytes: {
			state: 'byte-identical-to-the-published-green-build';
			laneInventorySha256: string;
			recomputedFromBuildInventory: true;
			files: number;
		};
		lanesObserved: 2;
		passesPerLane: 2;
		runsRecorded: number;
		parityBehaviorDigest: string;
		semanticDigestsPerLane: { baseline: string; migrated: string };
		perLanePassTwiceIdentical: true;
		legs: string[];
		legsRecorded: number;
		interactionsRecorded: number;
		consoleErrors: 0;
		failedRequests: 0;
		projection: {
			label: string;
			transport: string;
			identicalAcrossLanes: true;
			behaviorDigest: string;
			seedFixture: string;
			seedSha256: string;
			served: number;
			refusedUnknown: 0;
			refusedUnprojected: 0;
			declinedNonApi: number;
		};
		mutation: {
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
		locality: { mode: 'offline'; successfulNonLoopback: 0; osWideIsolation: false };
		surface: {
			proven: typeof HOLDOUT_ANGULAR_ESHOP_WEBSPA_PROVEN_SURFACE;
			provenStatement: string;
			outOfSurface: number;
			notReached: number;
			notTested: number;
			limits: HoldoutAngularEshopWebspaSurfaceLimit[];
		};
		browserProof: typeof HOLDOUT_ANGULAR_ESHOP_WEBSPA_BROWSER_PROOF;
		statement: string;
	};
	buildEraNotEstablished: {
		asRecordedBy: typeof HOLDOUT_ANGULAR_ESHOP_WEBSPA_GREEN_UNIT;
		answeredSince: string;
		entries: string[];
	};
	finding: {
		stillUnproven: typeof HOLDOUT_ANGULAR_ESHOP_WEBSPA_STILL_UNPROVEN;
		verdict: string;
		statement: string;
		capabilitiesExtracted: number;
		applicationFilesChanged: number;
		handEdits: 0;
	};
	counting: {
		countedInLineageNumerator: false;
		decidedBy: 'judge';
		note: string;
	};
	nonclaims: string[];
	integrity: { algorithm: 'sha256'; canonicalDigest: string };
}

const sha256Hex = createRegExp(
	charIn('0123456789').from('a', 'f').times(64).at.lineStart().at.lineEnd(),
);

function record(value: unknown, label: string): Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value))
		throw new Error(`${label} is not an object`);
	return value as Record<string, unknown>;
}

function text(value: unknown, label: string): string {
	if (typeof value !== 'string' || value.length === 0)
		throw new Error(`${label} is not a string`);
	return value;
}

function count(value: unknown, label: string): number {
	if (typeof value !== 'number' || !Number.isInteger(value))
		throw new Error(`${label} is not an integer`);
	return value;
}

/** The canonical digest of an entry, taken with the digest field emptied. */
export function holdoutAngularEshopWebspaDigest(receipt: HoldoutAngularEshopWebspaReceipt): string {
	const copy = structuredClone(receipt);
	copy.integrity.canonicalDigest = '';
	return sha256(canonicalize(copy));
}

/**
 * The inventory digest of a build-run entry list, taken the way the Witness
 * harness takes it: `{path, sha256}` pairs in path order, canonicalized.
 *
 * This is what lets the entry state that the Witness served the published green
 * build's bytes rather than some other build of the same application. The
 * Witness receipt carries the digest it measured off the directory it served;
 * this recomputes the same digest from the sealed build inventory, and the two
 * have to agree.
 */
export function holdoutAngularEshopWebspaInventoryDigest(
	entries: ReadonlyArray<{ path: string; sha256: string }>,
): string {
	return sha256(
		canonicalize(
			[...entries]
				.map((entry) => ({ path: entry.path, sha256: entry.sha256 }))
				.sort((left, right) =>
					left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
				),
		),
	);
}

/**
 * Reads the sealed attempt record and the sealed Witness evidence and rebuilds
 * the entry from them.
 *
 * The four states this application passed through are each asserted against the
 * evidence separately — gate zero overturned, install RED under the frozen
 * composite, build green twice under the reopen, Witness green on the bounded
 * surface after the re-freeze — so an entry that has quietly lost one of them
 * cannot be derived.
 */
export async function deriveHoldoutAngularEshopWebspaReceipt(
	rootDir = '.',
): Promise<HoldoutAngularEshopWebspaReceipt> {
	const root = resolve(rootDir);
	for (const evidence of [
		...HOLDOUT_ANGULAR_ESHOP_WEBSPA_RUN_EVIDENCE,
		...HOLDOUT_ANGULAR_ESHOP_WEBSPA_WITNESS_EVIDENCE,
	]) {
		const bytes = await readFile(join(root, evidence.path));
		if (sha256(bytes.toString('utf8')) !== evidence.sha256)
			throw new Error(`eShop WebSPA holdout run evidence changed: ${evidence.path}`);
	}
	const attempt = record(
		JSON.parse(await readFile(join(root, HOLDOUT_ANGULAR_ESHOP_WEBSPA_ATTEMPT_PATH), 'utf8')),
		'eShop WebSPA attempt record',
	);
	const attemptText = JSON.stringify(attempt);
	const candidate = record(attempt.candidate, 'eShop WebSPA candidate');
	const gateZero = record(attempt.gateZero, 'eShop WebSPA gate zero');
	const licenseAtPin = record(gateZero.licenseAtPin, 'eShop WebSPA license at pin');
	const boundary = record(gateZero.boundary, 'eShop WebSPA gate-zero boundary');
	const detect = record(attempt.detect, 'eShop WebSPA detection');
	const angular = record(detect.angular, 'eShop WebSPA Angular detection');
	const cliGeneration = record(detect.angularCliGeneration, 'eShop WebSPA CLI generation');
	const baseline = record(attempt.baseline, 'eShop WebSPA baseline');
	const identityCheck = record(baseline.identityCheck, 'eShop WebSPA archive identity');
	const eraCell = record(baseline.eraCell, 'eShop WebSPA era cell');
	const determinism = record(baseline.determinism, 'eShop WebSPA baseline determinism');
	const run1VsRun2 = record(determinism.run1VsRun2, 'eShop WebSPA baseline run comparison');
	const migration = record(attempt.migration, 'eShop WebSPA migration');
	const application = record(migration.application, 'eShop WebSPA migrated application');
	const laneInstall = record(migration.laneInstall, 'eShop WebSPA migrated lane install');
	const targetBuild = record(migration.targetBuild, 'eShop WebSPA migrated target build');
	const green = record(attempt.t024U4Rerun, 'eShop WebSPA T024 u4 re-run');
	const greenInstall = record(green.laneInstall, 'eShop WebSPA green lane install');
	const greenBuild = record(green.targetBuild, 'eShop WebSPA green target build');
	const outputInventory = record(green.outputInventory, 'eShop WebSPA green output inventory');
	const changesetCounts = record(green.changesetCounts, 'eShop WebSPA green changeset counts');

	// Gate zero passed on a ruling, not on the screen. Both are asserted so the
	// entry cannot present the overturn as an ordinary pass.
	if (
		!text(boundary.ruledVerdict, 'eShop WebSPA gate-zero ruled verdict').startsWith('pass') ||
		boundary.originalScreenTextUnchanged !== true
	)
		throw new Error('eShop WebSPA gate-zero record no longer states an overturned pass');
	// The install RED under the frozen composite is history and must stay in the
	// record; a re-run that overwrote it would be caught here.
	if (
		migration.outcome !== 'red-migration-gaps-itemised' ||
		targetBuild.produced !== false ||
		targetBuild.attempted !== false ||
		count(laneInstall.packagesInstalled, 'eShop WebSPA packages installed') !== 0
	)
		throw new Error(
			'eShop WebSPA install RED under the frozen composite is no longer recorded',
		);
	if (
		!text(migration.holdoutPosition, 'eShop WebSPA holdout position').includes(
			HOLDOUT_ANGULAR_ESHOP_WEBSPA_FROZEN_FINGERPRINT,
		)
	)
		throw new Error('eShop WebSPA RED was not measured under the recorded frozen composite');
	// The green build is asserted at the same strength: exit zero, two runs, and
	// byte-identical output, or there is no green to publish.
	if (
		green.outcome !== 'green-build-twice-byte-identical' ||
		greenBuild.produced !== true ||
		greenBuild.exitStatus !== 0 ||
		greenBuild.byteIdenticalAcrossRuns !== true ||
		count(greenBuild.runs, 'eShop WebSPA green build runs') !== 2 ||
		greenInstall.exitStatus !== 0 ||
		greenInstall.forcedFlagsUsed !== false ||
		greenInstall.narrowingApplied !== false ||
		count(changesetCounts.handEdits, 'eShop WebSPA hand edits') !== 0
	)
		throw new Error(
			'eShop WebSPA green build record no longer states a repeatable clean build',
		);
	if (
		!Array.isArray(greenBuild.remainingDiagnostics) ||
		greenBuild.remainingDiagnostics.length !== 0
	)
		throw new Error('eShop WebSPA green build record no longer states zero diagnostics');
	if (
		!text(green.authorization, 'eShop WebSPA reopen authorization').includes(
			HOLDOUT_ANGULAR_ESHOP_WEBSPA_REACT_SUBTREE,
		)
	)
		throw new Error('eShop WebSPA reopen record no longer names the untouched React subtree');
	// Every capability the reopen is credited with has to be findable in the run
	// record. A list nobody can check against the evidence is a list.
	for (const entry of HOLDOUT_ANGULAR_ESHOP_WEBSPA_REOPEN_CAPABILITIES)
		for (const marker of entry.markers)
			if (!attemptText.includes(marker))
				throw new Error(`eShop WebSPA run record omits ${entry.capability}: ${marker}`);
	if (HOLDOUT_ANGULAR_ESHOP_WEBSPA_REOPEN_CAPABILITIES.length !== 9)
		throw new Error('eShop WebSPA reopen is not the declared nine capabilities');
	// The cell below is authored as four fields rather than one prose string, so
	// it is checked back against the prose the run recorded: every part of it has
	// to appear in the target the attempt declares.
	const target = text(application.target, 'eShop WebSPA target declaration');
	for (const part of [
		'angular-16-browser-builder',
		'16.2',
		'@angular-devkit/build-angular:browser',
		'16.20.2',
	])
		if (!target.includes(part))
			throw new Error(`eShop WebSPA target cell no longer declares ${part}`);
	if (run1VsRun2.byteIdentical !== true)
		throw new Error('eShop WebSPA era baseline is no longer recorded byte-reproducible');
	// The build-era record said no witness had run. It is history and it stays
	// exactly as written: this entry carries it in its own labelled field rather
	// than deleting it now that a Witness has run.
	const buildEraNotEstablished = Array.isArray(green.notEstablished)
		? green.notEstablished.map((claim, index) =>
				text(claim, `eShop WebSPA build-era non-claim[${index}]`),
			)
		: [];
	if (!buildEraNotEstablished.some((claim) => claim.includes('no witness has run')))
		throw new Error('eShop WebSPA green record no longer states that no witness had run');

	// The Witness. It is not summarised from the file: it is parsed by its own
	// verifier, which re-proves four passes, one parity digest, per-lane
	// determinism, the mutation seam and restore, the projection ledger's
	// accounting, zero successful non-loopback requests, and the surface limits.
	const witness: WitnessAngularEshopWebspaReceipt = parseWitnessAngularEshopWebspaReceipt(
		JSON.parse(
			await readFile(
				join(root, HOLDOUT_ANGULAR_ESHOP_WEBSPA_WITNESS_EVIDENCE[0]!.path),
				'utf8',
			),
		),
	);
	if (witness.adapterComposite !== HOLDOUT_ANGULAR_ESHOP_WEBSPA_REFREEZE_COMPOSITE)
		throw new Error('eShop WebSPA Witness did not run against the re-frozen composite');
	if (witness.unit !== HOLDOUT_ANGULAR_ESHOP_WEBSPA_WITNESS_UNIT)
		throw new Error('eShop WebSPA Witness unit differs from the unit this entry publishes');
	// The four sealed journey records are the receipt's own runs, and the sealed
	// mutation record is the receipt's own mutation: bound by bytes above, and
	// checked to be the same measurement here rather than two documents that
	// merely travel together.
	const journeys: unknown = JSON.parse(
		await readFile(join(root, HOLDOUT_ANGULAR_ESHOP_WEBSPA_WITNESS_EVIDENCE[2]!.path), 'utf8'),
	);
	if (canonicalize(journeys) !== canonicalize(witness.runs))
		throw new Error('eShop WebSPA Witness journey records differ from the Witness receipt');
	const mutation: unknown = JSON.parse(
		await readFile(join(root, HOLDOUT_ANGULAR_ESHOP_WEBSPA_WITNESS_EVIDENCE[3]!.path), 'utf8'),
	);
	if (canonicalize(mutation) !== canonicalize(witness.mutation))
		throw new Error('eShop WebSPA Witness mutation record differs from the Witness receipt');
	// The bytes the Witness served on the migrated lane are the bytes the
	// published green build emitted: the sealed build inventory re-digests to the
	// lane inventory digest the Witness measured. Without this, "the Witness ran
	// after the re-freeze" would be a claim about a directory nobody bound.
	const inventoryDocument = record(
		JSON.parse(
			await readFile(join(root, HOLDOUT_ANGULAR_ESHOP_WEBSPA_BUILD_INVENTORY_PATH), 'utf8'),
		),
		'eShop WebSPA build inventory',
	);
	const inventoryRun = record(inventoryDocument.runA, 'eShop WebSPA build inventory run');
	if (!Array.isArray(inventoryRun.entries))
		throw new Error('eShop WebSPA build inventory carries no entries');
	const inventoryEntries = inventoryRun.entries.map((entry, index) => {
		const item = record(entry, `eShop WebSPA build inventory entry[${index}]`);
		return {
			path: text(item.path, `eShop WebSPA build inventory entry[${index}].path`),
			sha256: text(item.sha256, `eShop WebSPA build inventory entry[${index}].sha256`),
		};
	});
	if (
		holdoutAngularEshopWebspaInventoryDigest(inventoryEntries) !== witness.lanes.migrated.sha256
	)
		throw new Error(
			'eShop WebSPA Witness served migrated bytes that are not the published green build output',
		);
	if (inventoryEntries.length !== witness.lanes.migrated.files)
		throw new Error(
			'eShop WebSPA Witness migrated lane file count differs from the built output',
		);

	const firstRun = witness.runs[0]!;
	if (!Array.isArray(firstRun['assertions']))
		throw new Error('eShop WebSPA Witness run records no legs');
	const legs = firstRun['assertions'].map((leg, index) =>
		text(leg, `eShop WebSPA Witness leg[${index}]`),
	);
	const witnessRecord = record(firstRun['witnessRecord'], 'eShop WebSPA Witness run record');
	const interactions = Array.isArray(firstRun['interactions'])
		? firstRun['interactions'].length
		: 0;
	if (
		count(witnessRecord.consoleErrors, 'eShop WebSPA Witness console errors') !== 0 ||
		count(witnessRecord.failedRequests, 'eShop WebSPA Witness failed requests') !== 0
	)
		throw new Error('eShop WebSPA Witness run no longer records a clean console and network');
	// Every run has to carry the same legs, or "the legs recorded" is one run's
	// fact being published as four runs' fact.
	for (const run of witness.runs)
		if (canonicalize(run['assertions']) !== canonicalize(legs))
			throw new Error('eShop WebSPA Witness runs do not agree on the legs they recorded');
	const limits = witness.journey.surfaceLimits.map((limit) => ({
		surface: limit.surface,
		state: limit.state,
		reason: limit.reason,
	}));
	const limitsInState = (state: string): number =>
		limits.filter((limit) => limit.state === state).length;

	const receipt: HoldoutAngularEshopWebspaReceipt = {
		schemaVersion: HOLDOUT_ANGULAR_ESHOP_WEBSPA_SCHEMA,
		role: 'holdout',
		holdoutOutcome: HOLDOUT_ANGULAR_ESHOP_WEBSPA_OUTCOME,
		reason: HOLDOUT_ANGULAR_ESHOP_WEBSPA_STILL_UNPROVEN,
		supersedes: {
			outcome: HOLDOUT_ANGULAR_ESHOP_WEBSPA_SUPERSEDED_OUTCOME,
			digest: HOLDOUT_ANGULAR_ESHOP_WEBSPA_SUPERSEDED_DIGEST,
			note: 'This publication supersedes the witness-pending entry by reference. The three states that entry recorded are unchanged here, field for field; what is added is the Witness that entry said had not run, and the Witness itself was measured while that entry was the published one.',
		},
		ingestUnit: HOLDOUT_ANGULAR_ESHOP_WEBSPA_INGEST_UNIT,
		measuringUnit: HOLDOUT_ANGULAR_ESHOP_WEBSPA_GREEN_UNIT,
		witnessUnit: HOLDOUT_ANGULAR_ESHOP_WEBSPA_WITNESS_UNIT,
		publishedBy: HOLDOUT_ANGULAR_ESHOP_WEBSPA_PUBLISHING_UNIT,
		fixture: HOLDOUT_ANGULAR_ESHOP_WEBSPA_FIXTURE,
		application: HOLDOUT_ANGULAR_ESHOP_WEBSPA_APPLICATION,
		framework: 'angular',
		source: {
			repository: text(candidate.repository, 'eShop WebSPA repository'),
			release: text(candidate.requestedRelease, 'eShop WebSPA release'),
			revision: text(migration.commit, 'eShop WebSPA revision'),
			subpath: text(candidate.applicationSubpath, 'eShop WebSPA subpath'),
			archiveSha256: text(identityCheck.measuredSha256, 'eShop WebSPA archive digest'),
			license: text(licenseAtPin.spdx, 'eShop WebSPA license'),
			licenseSha256: text(licenseAtPin.sha256, 'eShop WebSPA license digest'),
			angular: text(angular.framework, 'eShop WebSPA Angular version'),
			angularCli: text(cliGeneration.cli, 'eShop WebSPA Angular CLI'),
			typescript: text(angular.typescript, 'eShop WebSPA TypeScript version'),
		},
		gateZero: {
			state: 'passed',
			licenseAtPin: `${text(licenseAtPin.spdx, 'eShop WebSPA license')} verified at the pin (sha256 ${text(licenseAtPin.sha256, 'eShop WebSPA license digest')})`,
			screenVerdict: text(boundary.screenVerdict, 'eShop WebSPA gate-zero screen verdict'),
			ruledVerdict: text(boundary.ruledVerdict, 'eShop WebSPA gate-zero ruled verdict'),
			overturnRecord: text(boundary.overturnRecord, 'eShop WebSPA overturn record'),
			originalScreenTextUnchanged: true,
			statement:
				'This candidate did not clear the pre-Ivy screen on its own reading. The T022 follow-up ruling overturned that verdict under the successor-across-names rule — @angular/http has a published first-party Ivy successor — and the original screen text was left exactly as written. The pass is a ruling, and it is published as one.',
		},
		runEvidence: HOLDOUT_ANGULAR_ESHOP_WEBSPA_RUN_EVIDENCE.map((entry) => ({ ...entry })),
		witnessEvidence: HOLDOUT_ANGULAR_ESHOP_WEBSPA_WITNESS_EVIDENCE.map((entry) => ({
			...entry,
		})),
		frozenAdapter: {
			compositeFingerprintAtIngestion: HOLDOUT_ANGULAR_ESHOP_WEBSPA_FROZEN_FINGERPRINT,
			bytesChangedAtIngestion: 0,
			authorizedReopen: {
				task: 'T024',
				subtree: 'packages/frameworks/angular',
				capabilitiesExtracted: HOLDOUT_ANGULAR_ESHOP_WEBSPA_REOPEN_CAPABILITIES.length,
				angularSubtreeOidAtGreen: HOLDOUT_ANGULAR_ESHOP_WEBSPA_ANGULAR_SUBTREE_AT_GREEN,
				refreezeComposite: HOLDOUT_ANGULAR_ESHOP_WEBSPA_REFREEZE_COMPOSITE,
				reactSubtreeUnchanged: HOLDOUT_ANGULAR_ESHOP_WEBSPA_REACT_SUBTREE,
				entries: HOLDOUT_ANGULAR_ESHOP_WEBSPA_REOPEN_CAPABILITIES.map((entry) => ({
					...entry,
					markers: [...entry.markers],
				})),
				statement:
					'T023 u5 ran this application against the frozen f1a63359 composition with zero adapter bytes changed, and it was refused at install. T024 then reopened the Angular subtree under board authorization and extracted nine generic capabilities and composition repairs across four units; the build below ran against Angular subtree oid 4b6e2f44, which is the tree the 27741d9c re-freeze publishes, and the Witness ran after that re-freeze against the bytes that build emitted. The React subtree is byte-identical at 972ca801 throughout. No capability branches on this application, and no application source file was hand-edited in any unit.',
			},
			holdoutSpecificConfiguration: 'none',
			applicationFilesHandEdited: 0,
		},
		cell: {
			id: 'angular-16-browser-builder',
			angularLine: '16.2',
			builder: '@angular-devkit/build-angular:browser',
			node: '16.20.2',
		},
		lanes: {
			baseline: {
				outcome: 'green',
				toolchain: text(eraCell.selected, 'eShop WebSPA era cell'),
				buildsCompared: 2,
				byteIdenticalAcrossRuns: true,
				statement: text(baseline.result, 'eShop WebSPA baseline result'),
			},
			migratedUnderFreeze: {
				outcome: 'red',
				unit: HOLDOUT_ANGULAR_ESHOP_WEBSPA_RED_UNIT,
				composite: HOLDOUT_ANGULAR_ESHOP_WEBSPA_FROZEN_FINGERPRINT,
				stage: 'install',
				installAttempts: Array.isArray(laneInstall.attempts)
					? laneInstall.attempts.length
					: 0,
				packagesInstalled: 0,
				gapsItemised: Array.isArray(migration.gaps) ? migration.gaps.length : 0,
				buildAttempted: false,
				artifactProduced: false,
				statement: text(migration.result, 'eShop WebSPA migrated RED result'),
			},
			migratedAfterReopen: {
				outcome: 'green',
				unit: HOLDOUT_ANGULAR_ESHOP_WEBSPA_GREEN_UNIT,
				installExitStatus: 0,
				buildRuns: count(greenBuild.runs, 'eShop WebSPA green build runs'),
				byteIdenticalAcrossRuns: true,
				artifactProduced: true,
				filesEmitted: count(outputInventory.files, 'eShop WebSPA emitted files'),
				bytesEmitted: count(outputInventory.totalBytes, 'eShop WebSPA emitted bytes'),
				remainingDiagnostics: 0,
				forcedFlagsUsed: false,
				narrowingApplied: false,
				statement: text(green.result, 'eShop WebSPA green result'),
			},
		},
		witness: {
			state: HOLDOUT_ANGULAR_ESHOP_WEBSPA_WITNESS_STATE,
			unit: HOLDOUT_ANGULAR_ESHOP_WEBSPA_WITNESS_UNIT,
			evidenceDirectory: HOLDOUT_ANGULAR_ESHOP_WEBSPA_WITNESS_EVIDENCE_DIRECTORY,
			witnessReceiptDigest: witness.integrity.canonicalDigest,
			adapterComposite: HOLDOUT_ANGULAR_ESHOP_WEBSPA_REFREEZE_COMPOSITE,
			ranAfterRefreeze: true,
			servedMigratedBytes: {
				state: 'byte-identical-to-the-published-green-build',
				laneInventorySha256: witness.lanes.migrated.sha256,
				recomputedFromBuildInventory: true,
				files: witness.lanes.migrated.files,
			},
			lanesObserved: 2,
			passesPerLane: 2,
			runsRecorded: witness.runs.length,
			parityBehaviorDigest: witness.parity.behaviorDigest,
			semanticDigestsPerLane: { ...witness.parity.semanticDigestsPerLane },
			perLanePassTwiceIdentical: true,
			legs,
			legsRecorded: legs.length,
			interactionsRecorded: interactions,
			consoleErrors: 0,
			failedRequests: 0,
			projection: {
				label: witness.projection.label,
				transport: witness.projection.transport,
				identicalAcrossLanes: true,
				behaviorDigest: witness.projection.behaviorDigest,
				seedFixture: witness.projection.seedFixture,
				seedSha256: witness.projection.seedSha256,
				served: witness.projection.ledger.served,
				refusedUnknown: 0,
				refusedUnprojected: 0,
				declinedNonApi: witness.projection.ledger.declinedNonApi,
			},
			mutation: {
				seam: witness.mutation.seam,
				path: witness.mutation.path,
				offset: witness.mutation.offset,
				beforeSha256: witness.mutation.beforeSha256,
				mutatedSha256: witness.mutation.mutatedSha256,
				afterRestoreSha256: witness.mutation.afterRestoreSha256,
				restoredByteIdentically: true,
				restoredRun: 'pass',
				restoredBehaviorDigest: witness.mutation.restoredBehaviorDigest,
			},
			locality: { mode: 'offline', successfulNonLoopback: 0, osWideIsolation: false },
			surface: {
				proven: HOLDOUT_ANGULAR_ESHOP_WEBSPA_PROVEN_SURFACE,
				provenStatement:
					'the surface an unauthenticated visitor is offered: the rendered catalog page, a genuine wheel scroll on a document that really overflows the measured viewport, server-paged navigation forward and back, and the type and brand filters selected by keyboard and applied by the application’s own control',
				outOfSurface: limitsInState('out-of-surface'),
				notReached: limitsInState('not-reached'),
				notTested: limitsInState('not-tested'),
				limits,
			},
			browserProof: HOLDOUT_ANGULAR_ESHOP_WEBSPA_BROWSER_PROOF,
			statement:
				'The migrated build the re-frozen 27741d9c adapter produced and the era baseline build were served as production static bytes on a bounded loopback origin, behind one declared same-origin projection that is identical for both lanes, and each was driven twice through the same anonymous catalog journey. All four runs normalize to one behaviour digest; each lane’s two passes agree exactly; overwriting one equal-length seam in the migrated bundle turns the run red, and restoring those bytes reproduces the parity digest. No non-loopback request succeeded, and no console error or failed request was observed. This is a proof about the surface the journey drove and about nothing else: the surfaces listed below were never exercised, and they are unproven rather than proven absent.',
		},
		buildEraNotEstablished: {
			asRecordedBy: HOLDOUT_ANGULAR_ESHOP_WEBSPA_GREEN_UNIT,
			answeredSince:
				'Only the first of these — that no test, journey or witness had run — has been answered, and only on the anonymous catalog surface the Witness above drove. The remaining four still stand exactly as the build run wrote them, and the sealed build record itself is unedited.',
			entries: buildEraNotEstablished,
		},
		finding: {
			stillUnproven: HOLDOUT_ANGULAR_ESHOP_WEBSPA_STILL_UNPROVEN,
			verdict:
				'the reopened and re-frozen Angular adapter carries this application to a repeatable production build and to a browser journey whose behaviour is indistinguishable from the era baseline on the anonymous catalog surface; everything behind identity is out of surface and stays unproven',
			statement:
				'Four states are recorded rather than reconciled. Gate zero passed on an overturn ruling. The frozen adapter was refused at install and that RED stands as history. The reopened adapter composed a changeset for an application it had never seen, installed the closure unforced and unnarrowed, and produced a production build twice with byte-identical output and no diagnostics. The re-frozen adapter’s output was then served to a browser beside the era baseline and behaved identically on the anonymous catalog surface, twice per lane, with a mutation-red and byte-restore proof under it. What a holdout exists to prove — that the migrated application is still the application — is proven here for that surface and is not proven for identity, basket, orders, campaigns or the SignalR hub, which the journey never entered.',
			capabilitiesExtracted: HOLDOUT_ANGULAR_ESHOP_WEBSPA_REOPEN_CAPABILITIES.length,
			applicationFilesChanged: count(
				changesetCounts.applicationFilesChanged,
				'eShop WebSPA application files changed',
			),
			handEdits: 0,
		},
		counting: {
			countedInLineageNumerator: false,
			decidedBy: 'judge',
			note: 'Counting is a separate layer from measuring, and this receipt is a measurement. The entry is counted in no lineage numerator; whether a holdout proven on a bounded surface should ever reach one is the Judge’s decision, made against the Judge’s ledger, and it is deliberately not taken here.',
		},
		nonclaims: [...witness.nonclaims, ...HOLDOUT_ANGULAR_ESHOP_WEBSPA_ADDED_NONCLAIMS],
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	receipt.integrity.canonicalDigest = holdoutAngularEshopWebspaDigest(receipt);
	return receipt;
}

/**
 * Parses a published entry and refuses one whose claims have moved.
 *
 * Four edits are the flattering ones available to this entry, and each is
 * refused explicitly rather than only by digest, so an edit that recomputed the
 * digest consistently with itself is still caught:
 *
 * - erasing the RED — turning the install refusal under the frozen composite
 *   into anything other than a red that produced no artifact;
 * - inflating the scope — widening the proven surface by trimming or softening
 *   the recorded limits, which are checked against the sealed Witness constant;
 * - overclaiming the Witness — more legs, more runs, more lanes or a browser
 *   proof beyond the ones the sealed runs recorded;
 * - hiding the reopen — shrinking or unnaming the authorized T024 reopen the
 *   green build and the Witness both ran under.
 */
export function parseHoldoutAngularEshopWebspaReceipt(
	value: unknown,
): HoldoutAngularEshopWebspaReceipt {
	const receipt = record(
		value,
		'eShop WebSPA holdout receipt',
	) as unknown as HoldoutAngularEshopWebspaReceipt;
	if (
		receipt.schemaVersion !== HOLDOUT_ANGULAR_ESHOP_WEBSPA_SCHEMA ||
		receipt.role !== 'holdout' ||
		receipt.holdoutOutcome !== HOLDOUT_ANGULAR_ESHOP_WEBSPA_OUTCOME ||
		receipt.reason !== HOLDOUT_ANGULAR_ESHOP_WEBSPA_STILL_UNPROVEN ||
		receipt.application !== HOLDOUT_ANGULAR_ESHOP_WEBSPA_APPLICATION ||
		receipt.framework !== 'angular'
	)
		throw new Error('eShop WebSPA holdout receipt identity or outcome differs');
	if (
		receipt.supersedes?.outcome !== HOLDOUT_ANGULAR_ESHOP_WEBSPA_SUPERSEDED_OUTCOME ||
		receipt.supersedes.digest !== HOLDOUT_ANGULAR_ESHOP_WEBSPA_SUPERSEDED_DIGEST
	)
		throw new Error('eShop WebSPA holdout superseded state was dropped or rewritten');
	// RED-erasure.
	if (
		receipt.lanes?.baseline?.outcome !== 'green' ||
		receipt.lanes?.migratedUnderFreeze?.outcome !== 'red' ||
		receipt.lanes?.migratedUnderFreeze?.composite !==
			HOLDOUT_ANGULAR_ESHOP_WEBSPA_FROZEN_FINGERPRINT ||
		receipt.lanes?.migratedUnderFreeze?.stage !== 'install' ||
		receipt.lanes?.migratedUnderFreeze?.artifactProduced !== false ||
		receipt.lanes?.migratedUnderFreeze?.buildAttempted !== false ||
		receipt.lanes?.migratedUnderFreeze?.packagesInstalled !== 0 ||
		receipt.lanes?.migratedAfterReopen?.outcome !== 'green' ||
		receipt.lanes?.migratedAfterReopen?.byteIdenticalAcrossRuns !== true ||
		receipt.lanes?.migratedAfterReopen?.artifactProduced !== true
	)
		throw new Error('eShop WebSPA holdout lanes differ');
	// Witness-overclaim: the state words, the counted legs, and the runs behind
	// them are all pinned to what the sealed Witness recorded.
	const witness = receipt.witness;
	if (
		witness?.state !== HOLDOUT_ANGULAR_ESHOP_WEBSPA_WITNESS_STATE ||
		witness.browserProof !== HOLDOUT_ANGULAR_ESHOP_WEBSPA_BROWSER_PROOF ||
		witness.unit !== HOLDOUT_ANGULAR_ESHOP_WEBSPA_WITNESS_UNIT ||
		witness.adapterComposite !== HOLDOUT_ANGULAR_ESHOP_WEBSPA_REFREEZE_COMPOSITE ||
		witness.ranAfterRefreeze !== true ||
		witness.lanesObserved !== 2 ||
		witness.passesPerLane !== 2 ||
		witness.runsRecorded !== 4 ||
		!Array.isArray(witness.legs) ||
		witness.legs.length !== witness.legsRecorded ||
		witness.consoleErrors !== 0 ||
		witness.failedRequests !== 0 ||
		!sha256Hex.test(witness.parityBehaviorDigest) ||
		witness.locality?.successfulNonLoopback !== 0 ||
		witness.locality?.osWideIsolation !== false ||
		witness.mutation?.restoredByteIdentically !== true ||
		witness.mutation?.restoredRun !== 'pass' ||
		witness.mutation?.beforeSha256 !== witness.mutation?.afterRestoreSha256 ||
		witness.mutation?.mutatedSha256 === witness.mutation?.beforeSha256 ||
		witness.mutation?.restoredBehaviorDigest !== witness.parityBehaviorDigest ||
		witness.servedMigratedBytes?.state !== 'byte-identical-to-the-published-green-build'
	)
		throw new Error('eShop WebSPA holdout Witness claims exceed the recorded runs');
	// Scope-inflation: the proven surface and its limits are the sealed Witness
	// constant, entry for entry, and the counts are derived from them.
	if (
		witness.surface?.proven !== HOLDOUT_ANGULAR_ESHOP_WEBSPA_PROVEN_SURFACE ||
		!Array.isArray(witness.surface.limits) ||
		canonicalize(witness.surface.limits) !==
			canonicalize(
				WITNESS_ANGULAR_ESHOP_WEBSPA_SURFACE_LIMITS.map((limit) => ({
					surface: limit.surface,
					state: limit.state,
					reason: limit.reason,
				})),
			) ||
		witness.surface.outOfSurface !==
			witness.surface.limits.filter((limit) => limit.state === 'out-of-surface').length ||
		witness.surface.notReached !==
			witness.surface.limits.filter((limit) => limit.state === 'not-reached').length ||
		witness.surface.notTested !==
			witness.surface.limits.filter((limit) => limit.state === 'not-tested').length
	)
		throw new Error('eShop WebSPA holdout proven surface was widened');
	// Reopen-hiding.
	if (
		receipt.frozenAdapter?.applicationFilesHandEdited !== 0 ||
		receipt.frozenAdapter?.bytesChangedAtIngestion !== 0 ||
		receipt.frozenAdapter?.authorizedReopen?.task !== 'T024' ||
		receipt.frozenAdapter?.authorizedReopen?.subtree !== 'packages/frameworks/angular' ||
		receipt.frozenAdapter?.authorizedReopen?.refreezeComposite !==
			HOLDOUT_ANGULAR_ESHOP_WEBSPA_REFREEZE_COMPOSITE ||
		receipt.frozenAdapter?.authorizedReopen?.reactSubtreeUnchanged !==
			HOLDOUT_ANGULAR_ESHOP_WEBSPA_REACT_SUBTREE ||
		receipt.frozenAdapter?.authorizedReopen?.capabilitiesExtracted !==
			HOLDOUT_ANGULAR_ESHOP_WEBSPA_REOPEN_CAPABILITIES.length ||
		!Array.isArray(receipt.frozenAdapter?.authorizedReopen?.entries) ||
		receipt.frozenAdapter.authorizedReopen.entries.length !==
			HOLDOUT_ANGULAR_ESHOP_WEBSPA_REOPEN_CAPABILITIES.length
	)
		throw new Error('eShop WebSPA holdout adapter influence differs');
	if (
		receipt.counting?.countedInLineageNumerator !== false ||
		receipt.counting?.decidedBy !== 'judge'
	)
		throw new Error('eShop WebSPA holdout counting was decided here rather than by the Judge');
	if (
		!Array.isArray(receipt.nonclaims) ||
		!HOLDOUT_ANGULAR_ESHOP_WEBSPA_ADDED_NONCLAIMS.every((claim) =>
			receipt.nonclaims.includes(claim),
		)
	)
		throw new Error('eShop WebSPA holdout non-claims differ');
	if (
		!Array.isArray(receipt.buildEraNotEstablished?.entries) ||
		!receipt.buildEraNotEstablished.entries.some((claim) =>
			claim.includes('no witness has run'),
		)
	)
		throw new Error('eShop WebSPA holdout dropped the build-era record of what was not proven');
	if (
		receipt.integrity?.algorithm !== 'sha256' ||
		!sha256Hex.test(receipt.integrity.canonicalDigest) ||
		receipt.integrity.canonicalDigest !== holdoutAngularEshopWebspaDigest(receipt)
	)
		throw new Error('eShop WebSPA holdout integrity differs');
	return receipt;
}

export function renderHoldoutAngularEshopWebspaReceipt(
	receipt: HoldoutAngularEshopWebspaReceipt,
): string {
	const reopen = receipt.frozenAdapter.authorizedReopen;
	const witness = receipt.witness;
	return `# eShopOnContainers WebSPA — Angular holdout ledger entry

- Outcome: **${receipt.holdoutOutcome}** — the migrated production build completes and repeats, and its browser behaviour is indistinguishable from the era baseline **on the anonymous catalog surface**; this is a pass on that surface and not a pass on the application
- Still unproven: **${receipt.reason}**
- Canonical SHA-256: ${receipt.integrity.canonicalDigest}
- Supersedes: the \`${receipt.supersedes.outcome}\` entry \`${receipt.supersedes.digest}\` — ${receipt.supersedes.note}
- Ingested by \`${receipt.ingestUnit}\`, measured green by \`${receipt.measuringUnit}\`, witnessed by \`${receipt.witnessUnit}\`, published by \`${receipt.publishedBy}\`
- Source: ${receipt.source.repository} at release \`${receipt.source.release}\` (\`${receipt.source.revision}\`, subpath \`${receipt.source.subpath}\`, ${receipt.source.license}, license text sha256 \`${receipt.source.licenseSha256}\`), Angular ${receipt.source.angular} under Angular CLI ${receipt.source.angularCli}, TypeScript ${receipt.source.typescript}
- Target cell: \`${receipt.cell.id}\` — Angular ${receipt.cell.angularLine}, \`${receipt.cell.builder}\`, Node ${receipt.cell.node}
- Adapter at ingestion: frozen composite \`${receipt.frozenAdapter.compositeFingerprintAtIngestion}\`, ${receipt.frozenAdapter.bytesChangedAtIngestion} bytes changed; ${receipt.frozenAdapter.applicationFilesHandEdited} application files hand-edited
- Authorized reopen: ${reopen.statement}
- Derived from committed run evidence: ${receipt.runEvidence.map((item) => `\`${item.path}\` (\`${item.sha256}\`)`).join(', ')}
- Derived from sealed Witness evidence: ${receipt.witnessEvidence.map((item) => `\`${item.path}\` (\`${item.sha256}\`)`).join(', ')}

## Gate zero

**${receipt.gateZero.state}** — screen verdict \`${receipt.gateZero.screenVerdict}\`, ruled verdict \`${receipt.gateZero.ruledVerdict}\`, overturn recorded at ${receipt.gateZero.overturnRecord}. ${receipt.gateZero.statement}

## Four measured states

- Baseline (${receipt.lanes.baseline.toolchain}): **${receipt.lanes.baseline.outcome}** — ${receipt.lanes.baseline.statement}
- Migrated under the frozen \`${receipt.lanes.migratedUnderFreeze.composite}\` composite (\`${receipt.lanes.migratedUnderFreeze.unit}\`): **${receipt.lanes.migratedUnderFreeze.outcome}** at ${receipt.lanes.migratedUnderFreeze.stage} — ${receipt.lanes.migratedUnderFreeze.installAttempts} install attempts, ${receipt.lanes.migratedUnderFreeze.packagesInstalled} packages installed, ${receipt.lanes.migratedUnderFreeze.gapsItemised} gaps itemised, no build attempted and no artifact produced. ${receipt.lanes.migratedUnderFreeze.statement}
- Migrated after the authorized reopen (\`${receipt.lanes.migratedAfterReopen.unit}\`): **${receipt.lanes.migratedAfterReopen.outcome}** — install exit ${receipt.lanes.migratedAfterReopen.installExitStatus} with no forced flag and no narrowing, ${receipt.lanes.migratedAfterReopen.buildRuns} production build runs, byte-identical output, ${receipt.lanes.migratedAfterReopen.filesEmitted} files and ${receipt.lanes.migratedAfterReopen.bytesEmitted} bytes emitted, ${receipt.lanes.migratedAfterReopen.remainingDiagnostics} diagnostics remaining. ${receipt.lanes.migratedAfterReopen.statement}
- Witness after the re-freeze (\`${witness.unit}\`): **${witness.state}** — see below.

The RED is not retracted by the green, and neither is retracted by the Witness. Each is what one adapter state did, and each is published unchanged.

## Witness — ${witness.state}

- Ran against adapter composite \`${witness.adapterComposite}\` **after** the re-freeze, serving migrated bytes that are ${witness.servedMigratedBytes.state}: lane inventory \`${witness.servedMigratedBytes.laneInventorySha256}\` over ${witness.servedMigratedBytes.files} files, recomputed here from the sealed build inventory
- ${witness.lanesObserved} lanes × ${witness.passesPerLane} passes = ${witness.runsRecorded} runs, all normalizing to behaviour parity digest \`${witness.parityBehaviorDigest}\`; per-lane semantic digests \`${witness.semanticDigestsPerLane.baseline}\` (baseline) and \`${witness.semanticDigestsPerLane.migrated}\` (migrated), each stable across its two passes
- ${witness.legsRecorded} recorded legs over ${witness.interactionsRecorded} interactions, ${witness.consoleErrors} console errors, ${witness.failedRequests} failed requests
- Declared same-origin projection \`${witness.projection.label}\` (${witness.projection.transport}), identical across both lanes, behaviour digest \`${witness.projection.behaviorDigest}\`; ledger: ${witness.projection.served} served, ${witness.projection.refusedUnknown} refused-unknown, ${witness.projection.refusedUnprojected} refused-unprojected, ${witness.projection.declinedNonApi} declined-non-api
- Mutation: seam \`${witness.mutation.seam}\` in \`${witness.mutation.path}\` at byte offset ${witness.mutation.offset} — \`${witness.mutation.beforeSha256}\` → \`${witness.mutation.mutatedSha256}\` (red) → \`${witness.mutation.afterRestoreSha256}\` (restored byte-identically, run ${witness.mutation.restoredRun}, behaviour \`${witness.mutation.restoredBehaviorDigest}\`)
- Locality: ${witness.locality.mode}, ${witness.locality.successfulNonLoopback} successful non-loopback requests, OS-wide isolation ${witness.locality.osWideIsolation}
- Browser proof: **${witness.browserProof}**

Legs recorded:

${witness.legs.map((leg) => `- ${leg}`).join('\n')}

${witness.statement}

### The surface this proof covers, and the surfaces it does not

Proven: **${witness.surface.proven}** — ${witness.surface.provenStatement}.

Not covered (${witness.surface.outOfSurface} out-of-surface, ${witness.surface.notReached} not-reached, ${witness.surface.notTested} not-tested):

${witness.surface.limits.map((limit) => `- **${limit.surface}** (${limit.state}) — ${limit.reason}`).join('\n')}

## What the reopen bought

${reopen.capabilitiesExtracted} capabilities and composition repairs, **all of them experimental and out of the supported matrix**, extracted against Angular subtree \`${reopen.angularSubtreeOidAtGreen}\` and published under composite \`${reopen.refreezeComposite}\` with the React subtree unchanged at \`${reopen.reactSubtreeUnchanged}\`:

${reopen.entries.map((entry) => `- \`${entry.capability}\` (${entry.unit}) — ${entry.what}`).join('\n')}

## What the build run said was not established

Recorded by \`${receipt.buildEraNotEstablished.asRecordedBy}\`, unedited. ${receipt.buildEraNotEstablished.answeredSince}

${receipt.buildEraNotEstablished.entries.map((claim) => `- ${claim}`).join('\n')}

## Finding

**${receipt.finding.verdict}.**

${receipt.finding.statement}

${receipt.finding.applicationFilesChanged} application files changed by the changeset; ${receipt.finding.handEdits} hand edits.

## Counting

Counted in a lineage numerator: **${receipt.counting.countedInLineageNumerator}**; decided by: **${receipt.counting.decidedBy}**. ${receipt.counting.note}

## Non-claims

${receipt.nonclaims.map((claim) => `- ${claim}`).join('\n')}
`;
}

/**
 * The corpus and aggregate record for this holdout.
 *
 * It follows the two failed holdout records field for field, including the one
 * field that matters most: `countedInLineageNumerator` is false and stays
 * false — not because a bounded pass is worthless, but because counting is the
 * Judge's layer and this record is a measurement. The record carries both
 * adapter states, the Witness state and the surface the Witness covered, so
 * that no consumer of the ledger can read a bounded pass as a whole one.
 */
export function holdoutAngularEshopWebspaCorpusRecord(receipt: HoldoutAngularEshopWebspaReceipt) {
	return {
		id: 'holdout-angular-eshop-webspa',
		application: receipt.application,
		framework: receipt.framework,
		lineage: 'angular',
		role: 'holdout',
		attempted: true,
		outcome: receipt.holdoutOutcome,
		reason: receipt.reason,
		verdict: receipt.finding.verdict,
		frozenAdapterFingerprint: receipt.frozenAdapter.compositeFingerprintAtIngestion,
		adapterBytesChanged: receipt.frozenAdapter.bytesChangedAtIngestion,
		authorizedReopen: {
			task: receipt.frozenAdapter.authorizedReopen.task,
			subtree: receipt.frozenAdapter.authorizedReopen.subtree,
			capabilitiesExtracted: receipt.frozenAdapter.authorizedReopen.capabilitiesExtracted,
			angularSubtreeOidAtGreen:
				receipt.frozenAdapter.authorizedReopen.angularSubtreeOidAtGreen,
			refreezeComposite: receipt.frozenAdapter.authorizedReopen.refreezeComposite,
			outcomeAfterReopen: receipt.holdoutOutcome,
		},
		baselineLane: receipt.lanes.baseline.outcome,
		migratedLaneUnderFreeze: receipt.lanes.migratedUnderFreeze.outcome,
		migratedLane: receipt.lanes.migratedAfterReopen.outcome,
		attempts: receipt.lanes.migratedAfterReopen.buildRuns,
		witness: receipt.witness.state,
		witnessUnit: receipt.witnessUnit,
		witnessParityDigest: receipt.witness.parityBehaviorDigest,
		witnessRuns: receipt.witness.runsRecorded,
		witnessLegs: receipt.witness.legsRecorded,
		witnessSurface: receipt.witness.surface.proven,
		witnessSurfaceNotCovered: receipt.witness.surface.limits.map((limit) => ({
			surface: limit.surface,
			state: limit.state,
		})),
		receipt: HOLDOUT_ANGULAR_ESHOP_WEBSPA_RECEIPT_PATH,
		digest: receipt.integrity.canonicalDigest,
		countedInLineageNumerator: false,
		countingNote: `Never counted in any lineage numerator by this record. The migrated production build is green and repeatable, and the Witness is green on the anonymous catalog surface — twice per lane, one parity digest, with a mutation-red and byte-restore proof under it. What that leaves unproven is stated beside it: ${receipt.reason}. Whether a holdout proven on a bounded surface should ever reach a numerator is the Judge's decision, taken on the Judge's ledger and not here. The install RED under the frozen f1a63359 composite is retained beside all of it as the record of what the frozen adapter did.`,
		browserProof: receipt.witness.browserProof,
	};
}

export async function verifyHoldoutAngularEshopWebspaEvidence(rootDir = '.'): Promise<{
	valid: true;
	digest: string;
	artifacts: number;
	receipt: HoldoutAngularEshopWebspaReceipt;
}> {
	const root = resolve(rootDir);
	const published = parseHoldoutAngularEshopWebspaReceipt(
		JSON.parse(await readFile(join(root, HOLDOUT_ANGULAR_ESHOP_WEBSPA_RECEIPT_PATH), 'utf8')),
	);
	const derived = await deriveHoldoutAngularEshopWebspaReceipt(root);
	if (canonicalize(published) !== canonicalize(derived))
		throw new Error('eShop WebSPA holdout receipt does not match its committed run evidence');
	if (
		(await readFile(join(root, HOLDOUT_ANGULAR_ESHOP_WEBSPA_MARKDOWN_PATH), 'utf8')) !==
		renderHoldoutAngularEshopWebspaReceipt(published)
	)
		throw new Error('eShop WebSPA holdout human receipt differs');
	return {
		valid: true as const,
		digest: published.integrity.canonicalDigest,
		artifacts: published.runEvidence.length + published.witnessEvidence.length,
		receipt: published,
	};
}
