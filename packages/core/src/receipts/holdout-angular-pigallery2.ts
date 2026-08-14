import { readFile } from 'node:fs/promises';
import { charIn, createRegExp } from 'magic-regexp';
import { join, resolve } from 'pathe';
import { canonicalize, sha256 } from './canonicalize.ts';

/**
 * The pigallery2 1.7.0 Angular holdout falsification receipt.
 *
 * This is the Angular counterpart of the cypress-realworld-app record, and it
 * is published for the same reason: an adapter that only publishes the
 * applications it carried is not evidence. pigallery2 was ingested after the
 * adapters were frozen, was never fixtured or adapted before it, and its
 * migrated build has never produced an artifact. T018 measured it against the
 * frozen 4df7bc96 composition and it stopped at the resolver with seven itemised
 * gaps. T021 then reopened the Angular subtree under board authorization and
 * chased it through four units and twelve generic capabilities; the migrated
 * closure now installs and the compiler now reads the application, and the
 * build still refuses.
 *
 * What is left is not a gap in the engine. It is three libraries that stop at
 * pre-Ivy bytes and have no published Ivy successor, used by this application
 * at six import sites it authored. Angular 16 removed ngcc, so those bytes are
 * unconsumable at the 16 cell by any transform that does not edit the
 * application. That is a support boundary, and it is declared as one here
 * rather than being worked around: the RED stands, the boundary is published,
 * and neither is softened by the other.
 *
 * Every field below is derived from the committed run evidence — the sealed
 * `attempt.json` and the two u4 lane logs — rather than authored here, so the
 * receipt cannot drift away from what the run measured.
 */
export const HOLDOUT_ANGULAR_PIGALLERY2_SCHEMA =
	'versionless.holdout-angular-pigallery2.v1' as const;
export const HOLDOUT_ANGULAR_PIGALLERY2_RECEIPT_PATH =
	'evidence/runs/holdout-angular-pigallery2/receipt.json' as const;
export const HOLDOUT_ANGULAR_PIGALLERY2_MARKDOWN_PATH =
	'evidence/runs/holdout-angular-pigallery2/receipt.md' as const;
export const HOLDOUT_ANGULAR_PIGALLERY2_ATTEMPT_PATH =
	'evidence/ingests/angular-pigallery2-v1-7-0/attempt.json' as const;
export const HOLDOUT_ANGULAR_PIGALLERY2_FIXTURE = 'angular-pigallery2-v1-7-0' as const;
export const HOLDOUT_ANGULAR_PIGALLERY2_APPLICATION = 'pigallery2' as const;
export const HOLDOUT_ANGULAR_PIGALLERY2_INGEST_UNIT =
	'lrapr-t018/u1-license-prescreen-ingest' as const;
export const HOLDOUT_ANGULAR_PIGALLERY2_PUBLISHING_UNIT =
	'lrapr-t023/u1-boundary-publish-refreeze' as const;

/**
 * The committed run evidence this receipt is derived from, bound by exact
 * bytes. Re-deriving the receipt against edited run evidence fails here rather
 * than silently republishing a different measurement under the same name.
 */
export const HOLDOUT_ANGULAR_PIGALLERY2_RUN_EVIDENCE = Object.freeze([
	Object.freeze({
		path: HOLDOUT_ANGULAR_PIGALLERY2_ATTEMPT_PATH,
		sha256: '222fd0ab7e4fa2c6b462d306534eeb82c88b47c37bd102093ecbce12d4e25fbb',
	}),
	Object.freeze({
		path: 'evidence/ingests/angular-pigallery2-v1-7-0/migration/t021-u4-lane-install.log',
		sha256: 'af3cac2a3c9803958f2927e83832c5f741aa08c44b7e787e1224bb5ca7fb467b',
	}),
	Object.freeze({
		path: 'evidence/ingests/angular-pigallery2-v1-7-0/migration/t021-u4-lane-build-run1.log',
		sha256: '47231a5f3b39ae05f9d36a9c9a0baf579633478383b207bd1d4b6ea48370226e',
	}),
]);

/**
 * The freeze the falsification was taken under, and the freeze the final
 * measurement's adapter bytes are now published as.
 *
 * Both are recorded because both are true of different runs and neither is a
 * substitute for the other: T018 ran against the frozen 4df7bc96 composition
 * with zero adapter bytes changed, and the last T021 build ran against the
 * Angular subtree oid `1f63f32c`, which is exactly the tree the f1a63359
 * re-freeze publishes. The reopen between them was authorized and is named, so
 * a reader is never asked to assume the adapter stood still when it did not.
 */
export const HOLDOUT_ANGULAR_PIGALLERY2_FROZEN_FINGERPRINT =
	'4df7bc961033fc5856b4d58e0bca9f11ad2aa9d43aaaee726956f34d209b37e7' as const;
export const HOLDOUT_ANGULAR_PIGALLERY2_ANGULAR_SUBTREE_AT_WALL =
	'1f63f32c9f4eb327e2c85f63e69544f1eeb99428' as const;

/** The missing capability the run measured, named exactly once. */
export const HOLDOUT_ANGULAR_PIGALLERY2_MISSING_CAPABILITY =
	'consumption of pre-Ivy-only dependencies with no published Ivy successor at the Angular 16 target cell' as const;

/**
 * The declared support boundary this holdout established.
 *
 * It is a limitation, published as data so the matrix and the enterprise
 * reports carry it rather than a prose footnote somebody has to remember to
 * repeat. A declared boundary is not a weakened gate: nothing in the corpus is
 * reclassified by it, no numerator moves, and the application that proved it
 * stays RED.
 */
export const ANGULAR_PRE_IVY_SUPPORT_BOUNDARY = Object.freeze({
	id: 'angular-16-pre-ivy-only-dependency',
	lineage: 'angular',
	cell: 'angular-16-browser-builder',
	state: 'unsupported',
	declaredBy: 'lrapr-t022 boundary ruling (Judge, 2026-08-14)',
	publishedBy: HOLDOUT_ANGULAR_PIGALLERY2_PUBLISHING_UNIT,
	condition:
		'pre-Ivy-only dependencies (no published Ivy successor) in active application use => unsupported at the Angular 16 target cell',
	mechanism:
		'Angular 16 removed ngcc, so ViewEngine bytes cannot be consumed at this cell, and a library whose last published version is pre-Ivy has no successor to align to. Carrying such an application would require editing its source at the import sites, which is an application change rather than a migration the engine can perform.',
	certification: 'not-certified: this cell is declared unsupported, not tested-and-failed-once',
	instanceEvidence: {
		application: HOLDOUT_ANGULAR_PIGALLERY2_APPLICATION,
		receipt: HOLDOUT_ANGULAR_PIGALLERY2_RECEIPT_PATH,
		libraries: 3,
		importSites: 6,
	},
	nonclaims: [
		'No claim that every application carrying a pre-Ivy-only dependency is unmigratable in general: the boundary is declared at the Angular 16 target cell, which is the only Angular cell this engine has.',
		'No claim that this boundary is unreachable: an ngcc-bearing multi-hop cell (Angular 12 or 13) would consume those bytes. It is a declared tranche-two commitment, not a silent deferral, and it invalidates every Angular 16 cell reading in this record, so it is not taken here.',
		'No claim that the boundary excuses the pigallery2 RED. The RED is permanent falsification evidence and is published unchanged alongside this declaration.',
	],
});

/**
 * The three libraries the wall is made of, and every application site that
 * needs them.
 *
 * These are authored here as structured data and then checked against the
 * sealed run record: each library name, each version the registry stops at, and
 * each `path:line` below must appear verbatim in the run's own wall text, or
 * derivation fails. Structure that cannot be checked against the measurement is
 * decoration, so this one is checked.
 */
export const HOLDOUT_ANGULAR_PIGALLERY2_WALL = Object.freeze([
	Object.freeze({
		library: '@yaga/leaflet-ng2',
		lastPublishedVersion: '1.1.0',
		verdict:
			'stops at 1.1.0, built against Angular 12 in full compilation mode with no partial declarations for a linker to read',
		importSites: Object.freeze([
			'frontend/app/app.module.ts:14',
			'frontend/app/ui/gallery/map/map.gallery.component.ts:7',
			'frontend/app/ui/gallery/map/lightbox/lightbox.map.gallery.component.ts:16',
		]),
	}),
	Object.freeze({
		library: 'ng2-slim-loading-bar',
		lastPublishedVersion: '4.0.0',
		verdict: 'stops at 4.0.0, whose declared peer is @angular/core "^2.4.7 || ^4.0.0"',
		importSites: Object.freeze([
			'frontend/app/app.module.ts:31',
			'frontend/app/model/network/network.service.ts:4',
		]),
	}),
	Object.freeze({
		library: 'jw-bootstrap-switch-ng2',
		lastPublishedVersion: '2.0.5',
		verdict: 'stops at 2.0.5, a pre-Ivy ViewEngine package, on a cell whose ngcc is a stub',
		importSites: Object.freeze(['frontend/app/app.module.ts:41']),
	}),
]);

/**
 * What this receipt does not claim, over and above the run's own non-claims.
 */
export const HOLDOUT_ANGULAR_PIGALLERY2_ADDED_NONCLAIMS = Object.freeze([
	'No browser evidence exists for either lane. No journey ran, no page was loaded, and nothing is claimed about behavior.',
	'No claim that the twelve capabilities the chase extracted are proven: every one of them was written against this single application, whose migrated build is RED, and all twelve stay experimental and out of the supported matrix.',
	'No claim that a green holdout would have proven generic Angular support. The caveat is carried here in the failing direction too.',
]);

export interface HoldoutAngularPigallery2WallEntry {
	library: string;
	lastPublishedVersion: string;
	verdict: string;
	importSites: string[];
}

export interface HoldoutAngularPigallery2Receipt {
	schemaVersion: typeof HOLDOUT_ANGULAR_PIGALLERY2_SCHEMA;
	role: 'holdout';
	holdoutOutcome: 'failed';
	reason: typeof HOLDOUT_ANGULAR_PIGALLERY2_MISSING_CAPABILITY;
	ingestUnit: typeof HOLDOUT_ANGULAR_PIGALLERY2_INGEST_UNIT;
	measuringUnit: string;
	publishedBy: typeof HOLDOUT_ANGULAR_PIGALLERY2_PUBLISHING_UNIT;
	fixture: typeof HOLDOUT_ANGULAR_PIGALLERY2_FIXTURE;
	application: typeof HOLDOUT_ANGULAR_PIGALLERY2_APPLICATION;
	framework: 'angular';
	source: {
		repository: string;
		release: string;
		revision: string;
		archiveSha256: string;
		license: string;
		licenseSha256: string;
		angular: string;
		angularCli: string;
		typescript: string;
	};
	runEvidence: Array<{ path: string; sha256: string }>;
	frozenAdapter: {
		compositeFingerprintAtIngestion: typeof HOLDOUT_ANGULAR_PIGALLERY2_FROZEN_FINGERPRINT;
		bytesChangedAtIngestion: 0;
		authorizedReopen: {
			task: 'T021';
			subtree: 'packages/frameworks/angular';
			capabilitiesExtracted: 12;
			angularSubtreeOidAtWall: typeof HOLDOUT_ANGULAR_PIGALLERY2_ANGULAR_SUBTREE_AT_WALL;
			statement: string;
		};
		holdoutSpecificConfiguration: 'none';
		applicationFilesHandEdited: 0;
	};
	cell: { id: string; angularLine: string; builder: string; node: string };
	lanes: {
		baseline: { outcome: 'green'; toolchain: string; statement: string };
		migrated: {
			outcome: 'red';
			installs: true;
			buildsAttempted: number;
			diagnosticsAtWall: number;
			diagnosticsBeforeWall: number;
			artifactProduced: false;
			statement: string;
		};
	};
	finding: {
		missingCapability: typeof HOLDOUT_ANGULAR_PIGALLERY2_MISSING_CAPABILITY;
		verdict: string;
		statement: string;
		wall: HoldoutAngularPigallery2WallEntry[];
		libraries: 3;
		importSites: 6;
		downstreamReading: string;
		actionTaken: string;
	};
	supportBoundary: typeof ANGULAR_PRE_IVY_SUPPORT_BOUNDARY;
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
	if (typeof value !== 'number' || !Number.isInteger(value)) throw new Error(`${label} is not an integer`);
	return value;
}

/** The canonical digest of a receipt, taken with the digest field emptied. */
export function holdoutAngularPigallery2Digest(receipt: HoldoutAngularPigallery2Receipt): string {
	const copy = structuredClone(receipt);
	copy.integrity.canonicalDigest = '';
	return sha256(canonicalize(copy));
}

/**
 * Reads the sealed attempt record and rebuilds the receipt from it.
 *
 * The wall structure above is checked against this record rather than trusted:
 * every library, every version the readings stop at and every import site must
 * appear in the run's own wall text.
 */
export async function deriveHoldoutAngularPigallery2Receipt(
	rootDir = '.',
): Promise<HoldoutAngularPigallery2Receipt> {
	const root = resolve(rootDir);
	for (const evidence of HOLDOUT_ANGULAR_PIGALLERY2_RUN_EVIDENCE) {
		const bytes = await readFile(join(root, evidence.path));
		if (sha256(bytes.toString('utf8')) !== evidence.sha256)
			throw new Error(`pigallery2 holdout run evidence changed: ${evidence.path}`);
	}
	const attempt = record(
		JSON.parse(await readFile(join(root, HOLDOUT_ANGULAR_PIGALLERY2_ATTEMPT_PATH), 'utf8')),
		'pigallery2 attempt record',
	);
	const candidate = record(attempt.candidate, 'pigallery2 candidate');
	const gateZero = record(attempt.gateZero, 'pigallery2 gate zero');
	const licenseAtPin = record(gateZero.licenseAtPin, 'pigallery2 license at pin');
	const detect = record(attempt.detect, 'pigallery2 detection');
	const angular = record(detect.angular, 'pigallery2 Angular detection');
	const cliGeneration = record(detect.angularCliGeneration, 'pigallery2 CLI generation');
	const baseline = record(attempt.baseline, 'pigallery2 baseline');
	const identityCheck = record(baseline.identityCheck, 'pigallery2 archive identity');
	const migration = record(attempt.migration, 'pigallery2 migration');
	const freeze = record(migration.freeze, 'pigallery2 migration freeze');
	const cell = record(migration.cell, 'pigallery2 target cell');
	const targetBuild = record(migration.targetBuild, 'pigallery2 target build');
	const wall = record(migration.u4Wall, 'pigallery2 u4 wall');
	const wallText = JSON.stringify(wall);

	if (freeze.compositeFingerprint !== HOLDOUT_ANGULAR_PIGALLERY2_FROZEN_FINGERPRINT)
		throw new Error('pigallery2 holdout was not measured under the recorded frozen composite');
	if (migration.outcome !== 'red-migration-gaps-itemised' || targetBuild.produced !== false)
		throw new Error('pigallery2 holdout attempt record no longer states a RED with no artifact');
	for (const entry of HOLDOUT_ANGULAR_PIGALLERY2_WALL) {
		if (!wallText.includes(entry.library) || !wallText.includes(entry.lastPublishedVersion))
			throw new Error(`pigallery2 wall record omits ${entry.library}`);
		for (const site of entry.importSites)
			if (!wallText.includes(site))
				throw new Error(`pigallery2 wall record omits import site ${site}`);
	}
	const importSites = HOLDOUT_ANGULAR_PIGALLERY2_WALL.reduce(
		(total, entry) => total + entry.importSites.length,
		0,
	);
	if (HOLDOUT_ANGULAR_PIGALLERY2_WALL.length !== 3 || importSites !== 6)
		throw new Error('pigallery2 wall is not the declared three libraries at six sites');

	const receipt: HoldoutAngularPigallery2Receipt = {
		schemaVersion: HOLDOUT_ANGULAR_PIGALLERY2_SCHEMA,
		role: 'holdout',
		holdoutOutcome: 'failed',
		reason: HOLDOUT_ANGULAR_PIGALLERY2_MISSING_CAPABILITY,
		ingestUnit: HOLDOUT_ANGULAR_PIGALLERY2_INGEST_UNIT,
		measuringUnit: text(wall.unit, 'pigallery2 wall unit'),
		publishedBy: HOLDOUT_ANGULAR_PIGALLERY2_PUBLISHING_UNIT,
		fixture: HOLDOUT_ANGULAR_PIGALLERY2_FIXTURE,
		application: HOLDOUT_ANGULAR_PIGALLERY2_APPLICATION,
		framework: 'angular',
		source: {
			repository: text(candidate.repository, 'pigallery2 repository'),
			release: text(candidate.requestedRelease, 'pigallery2 release'),
			revision: text(migration.commit, 'pigallery2 revision'),
			archiveSha256: text(identityCheck.measuredSha256, 'pigallery2 archive digest'),
			license: text(licenseAtPin.spdx, 'pigallery2 license'),
			licenseSha256: text(licenseAtPin.sha256, 'pigallery2 license digest'),
			angular: text(angular.framework, 'pigallery2 Angular version'),
			angularCli: text(cliGeneration.cli, 'pigallery2 Angular CLI'),
			typescript: text(angular.typescript, 'pigallery2 TypeScript version'),
		},
		runEvidence: HOLDOUT_ANGULAR_PIGALLERY2_RUN_EVIDENCE.map((entry) => ({ ...entry })),
		frozenAdapter: {
			compositeFingerprintAtIngestion: HOLDOUT_ANGULAR_PIGALLERY2_FROZEN_FINGERPRINT,
			bytesChangedAtIngestion: 0,
			authorizedReopen: {
				task: 'T021',
				subtree: 'packages/frameworks/angular',
				capabilitiesExtracted: 12,
				angularSubtreeOidAtWall: HOLDOUT_ANGULAR_PIGALLERY2_ANGULAR_SUBTREE_AT_WALL,
				statement:
					'T018 ran this application against the frozen 4df7bc96 composition with zero adapter bytes changed. T021 then reopened the Angular subtree under board authorization and extracted twelve generic capabilities from the falsification; the final build below ran against Angular subtree oid 1f63f32c, which is the tree the f1a63359 re-freeze publishes. No capability branches on this application, and no application source file was hand-edited in any unit.',
			},
			holdoutSpecificConfiguration: 'none',
			applicationFilesHandEdited: 0,
		},
		cell: {
			id: text(cell.id, 'pigallery2 cell id'),
			angularLine: text(cell.angularLine, 'pigallery2 Angular line'),
			builder: text(cell.builder, 'pigallery2 builder'),
			node: text(cell.node, 'pigallery2 cell node'),
		},
		lanes: {
			baseline: {
				outcome: 'green',
				toolchain: "the application's own era toolchain (Node 10.24.1, npm 6.14.12)",
				statement: text(baseline.result, 'pigallery2 baseline result'),
			},
			migrated: {
				outcome: 'red',
				installs: true,
				buildsAttempted: 3,
				diagnosticsAtWall: count(wall.diagnostics, 'pigallery2 wall diagnostics'),
				diagnosticsBeforeWall: count(wall.before, 'pigallery2 pre-wall diagnostics'),
				artifactProduced: false,
				statement:
					'The migrated closure installs from the manifest as authored and the compiler reads the application. Three successive migrated builds refused at the compiler and emitted nothing; the movement across them is itemised in the sealed attempt record.',
			},
		},
		finding: {
			missingCapability: HOLDOUT_ANGULAR_PIGALLERY2_MISSING_CAPABILITY,
			verdict:
				'the frozen Angular adapter does not carry this application, and the reason is a declared support boundary rather than a missing transform',
			statement:
				'Three libraries this application imports stop at pre-Ivy bytes and have no published Ivy successor. Angular 16 removed ngcc, so those bytes cannot be consumed at the target cell, and there is no version to align to. Every transform that would clear them edits the application at its six import sites, which is an application change and not a migration. The engine has no capability positioned there, and adding one would be adding an application edit.',
			wall: HOLDOUT_ANGULAR_PIGALLERY2_WALL.map((entry) => ({
				...entry,
				importSites: [...entry.importSites],
			})),
			libraries: 3,
			importSites: 6,
			downstreamReading: text(migration.downstreamReading, 'pigallery2 downstream reading'),
			actionTaken:
				'none against the application. The RED is recorded, the boundary is declared, and the twelve capabilities the chase produced stay experimental.',
		},
		supportBoundary: ANGULAR_PRE_IVY_SUPPORT_BOUNDARY,
		nonclaims: [
			...(Array.isArray(migration.notEstablished)
				? migration.notEstablished.map((claim, index) =>
						text(claim, `pigallery2 non-claim[${index}]`),
					)
				: []),
			...HOLDOUT_ANGULAR_PIGALLERY2_ADDED_NONCLAIMS,
		],
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	receipt.integrity.canonicalDigest = holdoutAngularPigallery2Digest(receipt);
	return receipt;
}

/**
 * Parses a published receipt and refuses one whose claims have moved.
 *
 * The outcome, the counting-relevant fields and the boundary declaration are
 * checked explicitly rather than only by digest, so an edit that recomputed the
 * digest consistently with itself is still caught.
 */
export function parseHoldoutAngularPigallery2Receipt(
	value: unknown,
): HoldoutAngularPigallery2Receipt {
	const receipt = record(value, 'pigallery2 holdout receipt') as unknown as
		HoldoutAngularPigallery2Receipt;
	if (
		receipt.schemaVersion !== HOLDOUT_ANGULAR_PIGALLERY2_SCHEMA ||
		receipt.role !== 'holdout' ||
		receipt.holdoutOutcome !== 'failed' ||
		receipt.reason !== HOLDOUT_ANGULAR_PIGALLERY2_MISSING_CAPABILITY ||
		receipt.application !== HOLDOUT_ANGULAR_PIGALLERY2_APPLICATION ||
		receipt.framework !== 'angular'
	)
		throw new Error('pigallery2 holdout receipt identity or outcome differs');
	if (
		receipt.lanes?.baseline?.outcome !== 'green' ||
		receipt.lanes?.migrated?.outcome !== 'red' ||
		receipt.lanes?.migrated?.artifactProduced !== false ||
		receipt.frozenAdapter?.applicationFilesHandEdited !== 0 ||
		receipt.frozenAdapter?.bytesChangedAtIngestion !== 0
	)
		throw new Error('pigallery2 holdout lanes or influence differ');
	if (
		receipt.finding?.libraries !== 3 ||
		receipt.finding?.importSites !== 6 ||
		receipt.supportBoundary?.state !== 'unsupported' ||
		receipt.supportBoundary?.condition !== ANGULAR_PRE_IVY_SUPPORT_BOUNDARY.condition
	)
		throw new Error('pigallery2 holdout finding or support boundary differs');
	if (
		!Array.isArray(receipt.nonclaims) ||
		!HOLDOUT_ANGULAR_PIGALLERY2_ADDED_NONCLAIMS.every((claim) =>
			receipt.nonclaims.includes(claim),
		)
	)
		throw new Error('pigallery2 holdout non-claims differ');
	if (
		receipt.integrity?.algorithm !== 'sha256' ||
		!sha256Hex.test(receipt.integrity.canonicalDigest) ||
		receipt.integrity.canonicalDigest !== holdoutAngularPigallery2Digest(receipt)
	)
		throw new Error('pigallery2 holdout integrity differs');
	return receipt;
}

export function renderHoldoutAngularPigallery2Receipt(
	receipt: HoldoutAngularPigallery2Receipt,
): string {
	const boundary = receipt.supportBoundary;
	return `# pigallery2 1.7.0 — Angular holdout falsification receipt

- Outcome: **${receipt.holdoutOutcome}** — the frozen Angular adapter does not carry this application at this revision
- Recorded reason: **${receipt.reason}**
- Canonical SHA-256: ${receipt.integrity.canonicalDigest}
- Ingested by \`${receipt.ingestUnit}\`, measured at the wall by \`${receipt.measuringUnit}\`, published by \`${receipt.publishedBy}\`
- Source: ${receipt.source.repository} at release \`${receipt.source.release}\` (\`${receipt.source.revision}\`, ${receipt.source.license}, license text sha256 \`${receipt.source.licenseSha256}\`), Angular ${receipt.source.angular} under ${receipt.source.angularCli}, TypeScript ${receipt.source.typescript}
- Target cell: \`${receipt.cell.id}\` — Angular ${receipt.cell.angularLine}, \`${receipt.cell.builder}\`
- Adapter at ingestion: frozen composite \`${receipt.frozenAdapter.compositeFingerprintAtIngestion}\`, ${receipt.frozenAdapter.bytesChangedAtIngestion} bytes changed; ${receipt.frozenAdapter.applicationFilesHandEdited} application files hand-edited
- Authorized reopen: ${receipt.frozenAdapter.authorizedReopen.statement}
- Derived from committed run evidence: ${receipt.runEvidence.map((item) => `\`${item.path}\` (\`${item.sha256}\`)`).join(', ')}

## Both lanes

- Baseline (${receipt.lanes.baseline.toolchain}): **${receipt.lanes.baseline.outcome}** — ${receipt.lanes.baseline.statement}
- Migrated: **${receipt.lanes.migrated.outcome}** — closure installs, ${receipt.lanes.migrated.buildsAttempted} builds attempted, ${receipt.lanes.migrated.diagnosticsBeforeWall} diagnostics before the last capability pass and ${receipt.lanes.migrated.diagnosticsAtWall} at the wall, no artifact produced. ${receipt.lanes.migrated.statement}

## The wall

**${receipt.finding.missingCapability}.**

${receipt.finding.statement}

${receipt.finding.wall.map((entry) => `- \`${entry.library}\` — ${entry.verdict}. Import sites: ${entry.importSites.map((site) => `\`${site}\``).join(', ')}.`).join('\n')}

${receipt.finding.libraries} libraries at ${receipt.finding.importSites} import sites. ${receipt.finding.downstreamReading}

Action taken: ${receipt.finding.actionTaken}

## Declared support boundary

**${boundary.condition}**

- State: **${boundary.state}** at cell \`${boundary.cell}\` (${boundary.lineage} lineage)
- Declared by ${boundary.declaredBy}; published by \`${boundary.publishedBy}\`
- Mechanism: ${boundary.mechanism}
- Certification: ${boundary.certification}

${boundary.nonclaims.map((claim) => `- ${claim}`).join('\n')}

## Non-claims

${receipt.nonclaims.map((claim) => `- ${claim}`).join('\n')}
`;
}

/**
 * The corpus and aggregate record for this holdout.
 *
 * It follows the cypress-realworld-app record field for field: a holdout that
 * failed is evidence about the adapter, not a migrated application, so it is
 * never an aggregate fixture row and never a Judge counting cell, and
 * `countedInLineageNumerator` is false and stays false.
 */
export function holdoutAngularPigallery2CorpusRecord(receipt: HoldoutAngularPigallery2Receipt) {
	return {
		id: 'holdout-angular-pigallery2',
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
			angularSubtreeOidAtWall: receipt.frozenAdapter.authorizedReopen.angularSubtreeOidAtWall,
			outcomeAfterReopen: 'failed',
		},
		baselineLane: receipt.lanes.baseline.outcome,
		migratedLane: receipt.lanes.migrated.outcome,
		attempts: receipt.lanes.migrated.buildsAttempted,
		receipt: HOLDOUT_ANGULAR_PIGALLERY2_RECEIPT_PATH,
		digest: receipt.integrity.canonicalDigest,
		countedInLineageNumerator: false,
		countingNote:
			'Never counted in any lineage numerator: no application was migrated. The record is published rather than dropped so a failed falsification attempt cannot be hidden, and it is not reclassified by the support boundary it established.',
		supportBoundary: ANGULAR_PRE_IVY_SUPPORT_BOUNDARY.id,
		browserProof: 'not-tested',
	};
}

export async function verifyHoldoutAngularPigallery2Evidence(rootDir = '.'): Promise<{
	valid: true;
	digest: string;
	artifacts: number;
	receipt: HoldoutAngularPigallery2Receipt;
}> {
	const root = resolve(rootDir);
	const published = parseHoldoutAngularPigallery2Receipt(
		JSON.parse(await readFile(join(root, HOLDOUT_ANGULAR_PIGALLERY2_RECEIPT_PATH), 'utf8')),
	);
	const derived = await deriveHoldoutAngularPigallery2Receipt(root);
	if (canonicalize(published) !== canonicalize(derived))
		throw new Error('pigallery2 holdout receipt does not match its committed run evidence');
	if (
		(await readFile(join(root, HOLDOUT_ANGULAR_PIGALLERY2_MARKDOWN_PATH), 'utf8')) !==
		renderHoldoutAngularPigallery2Receipt(published)
	)
		throw new Error('pigallery2 holdout human receipt differs');
	return {
		valid: true as const,
		digest: published.integrity.canonicalDigest,
		artifacts: published.runEvidence.length,
		receipt: published,
	};
}
