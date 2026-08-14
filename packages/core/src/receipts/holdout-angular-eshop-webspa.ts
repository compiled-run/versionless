import { readFile } from 'node:fs/promises';
import { charIn, createRegExp } from 'magic-regexp';
import { join, resolve } from 'pathe';
import { canonicalize, sha256 } from './canonicalize.ts';

/**
 * The eShopOnContainers WebSPA Angular holdout ledger entry.
 *
 * This is the third published holdout and the first one whose migrated lane
 * reached a build. It is published for the same reason the two failures were:
 * an adapter that only publishes the applications it carried is not evidence,
 * and an adapter that publishes a partial success as a whole one is worse.
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
 *
 * And what it does not state: no witness journey has been run, in either lane,
 * so nothing here is a browser proof and nothing here is a passed holdout. The
 * outcome field says exactly that and nothing more.
 *
 * Every field is derived from the sealed run evidence rather than authored
 * here, so the entry cannot drift away from what the runs measured.
 */
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_SCHEMA =
	'versionless.holdout-angular-eshop-webspa.v1' as const;
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_RECEIPT_PATH =
	'evidence/runs/holdout-angular-eshop-webspa/receipt.json' as const;
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_MARKDOWN_PATH =
	'evidence/runs/holdout-angular-eshop-webspa/receipt.md' as const;
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_ATTEMPT_PATH =
	'evidence/ingests/angular-eshop-webspa-netcore2-2/attempt.json' as const;
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_FIXTURE = 'angular-eshop-webspa-netcore2-2' as const;
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_APPLICATION = 'eShopOnContainers WebSPA' as const;
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_INGEST_UNIT =
	'lrapr-t023/u3-boundary-amend-candidate3-acquire' as const;
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_RED_UNIT =
	'lrapr-t023/u5-frozen-adapter-migration' as const;
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_GREEN_UNIT =
	'lrapr-t024/u4-exports-map-wiring-green-attempt' as const;
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_PUBLISHING_UNIT =
	'lrapr-t024/u5-refreeze-and-holdout-ledger' as const;

/**
 * The one word this entry is allowed to be summarised by.
 *
 * `passed` would be a lie and `failed` would be one too. The build completed
 * and repeats; no journey has run. The outcome names both halves so that no
 * downstream renderer has to choose which half to carry.
 */
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_OUTCOME =
	'migrated-build-green-witness-pending' as const;

/**
 * What is still unproven, stated in the field a failed holdout uses for its
 * missing capability. A holdout that is not finished has to say what is
 * missing in the same place a holdout that failed does, or a reader comparing
 * the two entries has to know which fields to distrust.
 */
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_PENDING =
	'browser behaviour: no witness journey has run in either lane, so the migrated production build is proven to exist and repeat and is proven to do nothing else' as const;

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
		path: 'evidence/ingests/angular-eshop-webspa-netcore2-2/migration/u4-t024-build-inventory-run1-vs-run2.json',
		sha256: '1a0cb82feff57b567739542bd674d472fdbd1cffdf4414dc5d7772e78f5bc7c9',
	}),
]);

/**
 * The two adapter states this application was measured under.
 *
 * `f1a63359` is the freeze the install RED was taken against, with zero adapter
 * bytes changed. `4b6e2f44` is the Angular subtree the green build ran against,
 * and `27741d9c` is the composite the re-freeze publishes it as. Both are
 * recorded because both are true of different runs, and the reopen between them
 * was authorized and is named — a reader is never asked to assume the adapter
 * stood still when it did not.
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
 */
export const HOLDOUT_ANGULAR_ESHOP_WEBSPA_ADDED_NONCLAIMS = Object.freeze([
	'This is not a passed holdout. A holdout passes when a migrated application is proven to still be the application; no journey has run here, so that proof does not exist and is not claimed.',
	'The install RED under the frozen f1a63359 composite is not retracted by the later green. It is what the frozen adapter did, it is published unchanged, and the green build ran against a reopened adapter and says so.',
	'No claim that the nine capabilities the reopen extracted are proven. Every one of them was written against this single application, and all nine stay experimental and out of the supported matrix until a second, independent Angular application carries them.',
	'This entry is counted in no lineage numerator. A build is not a vertical, and nothing here moves the Angular score.',
]);

export interface HoldoutAngularEshopWebspaCapability {
	capability: string;
	unit: string;
	what: string;
	markers: string[];
}

export interface HoldoutAngularEshopWebspaReceipt {
	schemaVersion: typeof HOLDOUT_ANGULAR_ESHOP_WEBSPA_SCHEMA;
	role: 'holdout';
	holdoutOutcome: typeof HOLDOUT_ANGULAR_ESHOP_WEBSPA_OUTCOME;
	reason: typeof HOLDOUT_ANGULAR_ESHOP_WEBSPA_PENDING;
	ingestUnit: typeof HOLDOUT_ANGULAR_ESHOP_WEBSPA_INGEST_UNIT;
	measuringUnit: typeof HOLDOUT_ANGULAR_ESHOP_WEBSPA_GREEN_UNIT;
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
		state: 'not-run';
		journeysRun: 0;
		browserProof: 'not-tested';
		statement: string;
	};
	finding: {
		pending: typeof HOLDOUT_ANGULAR_ESHOP_WEBSPA_PENDING;
		verdict: string;
		statement: string;
		capabilitiesExtracted: number;
		applicationFilesChanged: number;
		handEdits: 0;
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
	if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} is not a string`);
	return value;
}

function count(value: unknown, label: string): number {
	if (typeof value !== 'number' || !Number.isInteger(value))
		throw new Error(`${label} is not an integer`);
	return value;
}

/** The canonical digest of an entry, taken with the digest field emptied. */
export function holdoutAngularEshopWebspaDigest(
	receipt: HoldoutAngularEshopWebspaReceipt,
): string {
	const copy = structuredClone(receipt);
	copy.integrity.canonicalDigest = '';
	return sha256(canonicalize(copy));
}

/**
 * Reads the sealed attempt record and rebuilds the entry from it.
 *
 * The three states this application passed through are each asserted against
 * the record separately — gate zero overturned, install RED under the frozen
 * composite, build green twice under the reopen — so an entry that has quietly
 * lost one of them cannot be derived.
 */
export async function deriveHoldoutAngularEshopWebspaReceipt(
	rootDir = '.',
): Promise<HoldoutAngularEshopWebspaReceipt> {
	const root = resolve(rootDir);
	for (const evidence of HOLDOUT_ANGULAR_ESHOP_WEBSPA_RUN_EVIDENCE) {
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
		throw new Error('eShop WebSPA install RED under the frozen composite is no longer recorded');
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
		throw new Error('eShop WebSPA green build record no longer states a repeatable clean build');
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
	// The whole point of the entry: the build is green and no journey ran. If the
	// run record ever stops saying the second half, the entry stops deriving.
	// The cell below is authored as four fields rather than one prose string, so
	// it is checked back against the prose the run recorded: every part of it has
	// to appear in the target the attempt declares.
	const target = text(application.target, 'eShop WebSPA target declaration');
	for (const part of ['angular-16-browser-builder', '16.2', '@angular-devkit/build-angular:browser', '16.20.2'])
		if (!target.includes(part))
			throw new Error(`eShop WebSPA target cell no longer declares ${part}`);
	if (run1VsRun2.byteIdentical !== true)
		throw new Error('eShop WebSPA era baseline is no longer recorded byte-reproducible');
	if (
		!Array.isArray(green.notEstablished) ||
		!green.notEstablished.some(
			(claim) => typeof claim === 'string' && claim.includes('no witness has run'),
		)
	)
		throw new Error('eShop WebSPA green record no longer states that no witness ran');

	const receipt: HoldoutAngularEshopWebspaReceipt = {
		schemaVersion: HOLDOUT_ANGULAR_ESHOP_WEBSPA_SCHEMA,
		role: 'holdout',
		holdoutOutcome: HOLDOUT_ANGULAR_ESHOP_WEBSPA_OUTCOME,
		reason: HOLDOUT_ANGULAR_ESHOP_WEBSPA_PENDING,
		ingestUnit: HOLDOUT_ANGULAR_ESHOP_WEBSPA_INGEST_UNIT,
		measuringUnit: HOLDOUT_ANGULAR_ESHOP_WEBSPA_GREEN_UNIT,
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
					'T023 u5 ran this application against the frozen f1a63359 composition with zero adapter bytes changed, and it was refused at install. T024 then reopened the Angular subtree under board authorization and extracted nine generic capabilities and composition repairs across four units; the build below ran against Angular subtree oid 4b6e2f44, which is the tree the 27741d9c re-freeze publishes. The React subtree is byte-identical at 972ca801 throughout. No capability branches on this application, and no application source file was hand-edited in any unit.',
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
				installAttempts: Array.isArray(laneInstall.attempts) ? laneInstall.attempts.length : 0,
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
			state: 'not-run',
			journeysRun: 0,
			browserProof: 'not-tested',
			statement:
				'No witness journey has been run against this application in either lane. A build that completes and repeats is not a build that behaves: nothing here establishes rendering, parity, or any browser behaviour, and the witness gates this ledger applies to counted verticals have not been applied to it.',
		},
		finding: {
			pending: HOLDOUT_ANGULAR_ESHOP_WEBSPA_PENDING,
			verdict:
				'the reopened Angular adapter carries this application as far as a repeatable production build and no further; the entry is published as a measured state, not as a passed holdout',
			statement:
				'Three states are recorded rather than reconciled. Gate zero passed on an overturn ruling. The frozen adapter was refused at install and that RED stands as history. The reopened adapter composed a changeset for an application it had never seen, installed the closure unforced and unnarrowed, and produced a production build twice with byte-identical output and no diagnostics. What has not happened is a journey, so the one thing a holdout exists to prove — that the migrated application is still the application — is not proven here.',
			capabilitiesExtracted: HOLDOUT_ANGULAR_ESHOP_WEBSPA_REOPEN_CAPABILITIES.length,
			applicationFilesChanged: count(
				changesetCounts.applicationFilesChanged,
				'eShop WebSPA application files changed',
			),
			handEdits: 0,
		},
		nonclaims: [
			...(Array.isArray(green.notEstablished)
				? green.notEstablished.map((claim, index) =>
						text(claim, `eShop WebSPA non-claim[${index}]`),
					)
				: []),
			...HOLDOUT_ANGULAR_ESHOP_WEBSPA_ADDED_NONCLAIMS,
		],
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	receipt.integrity.canonicalDigest = holdoutAngularEshopWebspaDigest(receipt);
	return receipt;
}

/**
 * Parses a published entry and refuses one whose claims have moved.
 *
 * The two edits this entry is most exposed to are the flattering ones: turning
 * the outcome into a pass, and dropping the install RED that preceded it. Both
 * are checked explicitly rather than only by digest, so an edit that recomputed
 * the digest consistently with itself is still caught.
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
		receipt.reason !== HOLDOUT_ANGULAR_ESHOP_WEBSPA_PENDING ||
		receipt.application !== HOLDOUT_ANGULAR_ESHOP_WEBSPA_APPLICATION ||
		receipt.framework !== 'angular'
	)
		throw new Error('eShop WebSPA holdout receipt identity or outcome differs');
	if (
		receipt.lanes?.baseline?.outcome !== 'green' ||
		receipt.lanes?.migratedUnderFreeze?.outcome !== 'red' ||
		receipt.lanes?.migratedUnderFreeze?.composite !==
			HOLDOUT_ANGULAR_ESHOP_WEBSPA_FROZEN_FINGERPRINT ||
		receipt.lanes?.migratedUnderFreeze?.artifactProduced !== false ||
		receipt.lanes?.migratedAfterReopen?.outcome !== 'green' ||
		receipt.lanes?.migratedAfterReopen?.byteIdenticalAcrossRuns !== true ||
		receipt.lanes?.migratedAfterReopen?.artifactProduced !== true
	)
		throw new Error('eShop WebSPA holdout lanes differ');
	if (
		receipt.witness?.state !== 'not-run' ||
		receipt.witness?.journeysRun !== 0 ||
		receipt.witness?.browserProof !== 'not-tested'
	)
		throw new Error('eShop WebSPA holdout witness state was upgraded');
	if (
		receipt.frozenAdapter?.applicationFilesHandEdited !== 0 ||
		receipt.frozenAdapter?.bytesChangedAtIngestion !== 0 ||
		receipt.frozenAdapter?.authorizedReopen?.task !== 'T024' ||
		receipt.frozenAdapter?.authorizedReopen?.reactSubtreeUnchanged !==
			HOLDOUT_ANGULAR_ESHOP_WEBSPA_REACT_SUBTREE ||
		receipt.frozenAdapter?.authorizedReopen?.capabilitiesExtracted !==
			HOLDOUT_ANGULAR_ESHOP_WEBSPA_REOPEN_CAPABILITIES.length
	)
		throw new Error('eShop WebSPA holdout adapter influence differs');
	if (
		!Array.isArray(receipt.nonclaims) ||
		!HOLDOUT_ANGULAR_ESHOP_WEBSPA_ADDED_NONCLAIMS.every((claim) =>
			receipt.nonclaims.includes(claim),
		)
	)
		throw new Error('eShop WebSPA holdout non-claims differ');
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
	return `# eShopOnContainers WebSPA — Angular holdout ledger entry

- Outcome: **${receipt.holdoutOutcome}** — the migrated production build completes and repeats; **no witness journey has run**, so this is not a passed holdout
- Still unproven: **${receipt.reason}**
- Canonical SHA-256: ${receipt.integrity.canonicalDigest}
- Ingested by \`${receipt.ingestUnit}\`, measured green by \`${receipt.measuringUnit}\`, published by \`${receipt.publishedBy}\`
- Source: ${receipt.source.repository} at release \`${receipt.source.release}\` (\`${receipt.source.revision}\`, subpath \`${receipt.source.subpath}\`, ${receipt.source.license}, license text sha256 \`${receipt.source.licenseSha256}\`), Angular ${receipt.source.angular} under Angular CLI ${receipt.source.angularCli}, TypeScript ${receipt.source.typescript}
- Target cell: \`${receipt.cell.id}\` — Angular ${receipt.cell.angularLine}, \`${receipt.cell.builder}\`, Node ${receipt.cell.node}
- Adapter at ingestion: frozen composite \`${receipt.frozenAdapter.compositeFingerprintAtIngestion}\`, ${receipt.frozenAdapter.bytesChangedAtIngestion} bytes changed; ${receipt.frozenAdapter.applicationFilesHandEdited} application files hand-edited
- Authorized reopen: ${reopen.statement}
- Derived from committed run evidence: ${receipt.runEvidence.map((item) => `\`${item.path}\` (\`${item.sha256}\`)`).join(', ')}

## Gate zero

**${receipt.gateZero.state}** — screen verdict \`${receipt.gateZero.screenVerdict}\`, ruled verdict \`${receipt.gateZero.ruledVerdict}\`, overturn recorded at ${receipt.gateZero.overturnRecord}. ${receipt.gateZero.statement}

## Three measured states

- Baseline (${receipt.lanes.baseline.toolchain}): **${receipt.lanes.baseline.outcome}** — ${receipt.lanes.baseline.statement}
- Migrated under the frozen \`${receipt.lanes.migratedUnderFreeze.composite}\` composite (\`${receipt.lanes.migratedUnderFreeze.unit}\`): **${receipt.lanes.migratedUnderFreeze.outcome}** at ${receipt.lanes.migratedUnderFreeze.stage} — ${receipt.lanes.migratedUnderFreeze.installAttempts} install attempts, ${receipt.lanes.migratedUnderFreeze.packagesInstalled} packages installed, ${receipt.lanes.migratedUnderFreeze.gapsItemised} gaps itemised, no build attempted and no artifact produced. ${receipt.lanes.migratedUnderFreeze.statement}
- Migrated after the authorized reopen (\`${receipt.lanes.migratedAfterReopen.unit}\`): **${receipt.lanes.migratedAfterReopen.outcome}** — install exit ${receipt.lanes.migratedAfterReopen.installExitStatus} with no forced flag and no narrowing, ${receipt.lanes.migratedAfterReopen.buildRuns} production build runs, byte-identical output, ${receipt.lanes.migratedAfterReopen.filesEmitted} files and ${receipt.lanes.migratedAfterReopen.bytesEmitted} bytes emitted, ${receipt.lanes.migratedAfterReopen.remainingDiagnostics} diagnostics remaining. ${receipt.lanes.migratedAfterReopen.statement}

The RED is not retracted by the green. It is what the frozen adapter did, and it is published unchanged.

## Witness

**${receipt.witness.state}** — ${receipt.witness.journeysRun} journeys run, browser proof \`${receipt.witness.browserProof}\`. ${receipt.witness.statement}

## What the reopen bought

${reopen.capabilitiesExtracted} capabilities and composition repairs, **all of them experimental and out of the supported matrix**, extracted against Angular subtree \`${reopen.angularSubtreeOidAtGreen}\` and published under composite \`${reopen.refreezeComposite}\` with the React subtree unchanged at \`${reopen.reactSubtreeUnchanged}\`:

${reopen.entries.map((entry) => `- \`${entry.capability}\` (${entry.unit}) — ${entry.what}`).join('\n')}

## Finding

**${receipt.finding.verdict}.**

${receipt.finding.statement}

${receipt.finding.applicationFilesChanged} application files changed by the changeset; ${receipt.finding.handEdits} hand edits.

## Non-claims

${receipt.nonclaims.map((claim) => `- ${claim}`).join('\n')}
`;
}

/**
 * The corpus and aggregate record for this holdout.
 *
 * It follows the two failed holdout records field for field, including the one
 * field that matters most: `countedInLineageNumerator` is false and stays
 * false. A build is not a vertical. The record carries both adapter states and
 * the witness state so that no consumer of the ledger can read the green build
 * as a proven migration.
 */
export function holdoutAngularEshopWebspaCorpusRecord(
	receipt: HoldoutAngularEshopWebspaReceipt,
) {
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
			angularSubtreeOidAtGreen: receipt.frozenAdapter.authorizedReopen.angularSubtreeOidAtGreen,
			refreezeComposite: receipt.frozenAdapter.authorizedReopen.refreezeComposite,
			outcomeAfterReopen: receipt.holdoutOutcome,
		},
		baselineLane: receipt.lanes.baseline.outcome,
		migratedLaneUnderFreeze: receipt.lanes.migratedUnderFreeze.outcome,
		migratedLane: receipt.lanes.migratedAfterReopen.outcome,
		attempts: receipt.lanes.migratedAfterReopen.buildRuns,
		witness: receipt.witness.state,
		receipt: HOLDOUT_ANGULAR_ESHOP_WEBSPA_RECEIPT_PATH,
		digest: receipt.integrity.canonicalDigest,
		countedInLineageNumerator: false,
		countingNote:
			'Never counted in any lineage numerator. The migrated production build is green and repeatable, but no witness journey has run, so no application is proven migrated: this entry is a measured state published in full, not a vertical and not a pass. The install RED under the frozen f1a63359 composite is retained beside it as the record of what the frozen adapter did.',
		browserProof: 'not-tested',
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
		artifacts: published.runEvidence.length,
		receipt: published,
	};
}
