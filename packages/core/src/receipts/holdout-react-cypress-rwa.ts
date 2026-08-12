import { readFile } from 'node:fs/promises';
import { charIn, createRegExp } from 'magic-regexp';
import { join, resolve } from 'pathe';
import { canonicalize, sha256 } from './canonicalize.ts';

/**
 * The cypress-realworld-app holdout falsification receipt.
 *
 * This is not a witness receipt and deliberately does not share their shape: no
 * browser journey ran, because the migrated lane never produced a bundle to
 * boot. What it publishes is the falsification test itself — the adapters were
 * frozen first, the holdout was chosen after, the frozen composition was
 * applied to it without a single byte of change, and the migrated lane did not
 * build. The outcome is `failed`, and it is recorded with the same rigor a pass
 * would have been given: pinned source identity, the frozen fingerprint the run
 * was measured against, both lanes' outcomes, the exact missing capability, the
 * two-attempt identity proof, and the non-claims that keep it from being read
 * as more than it is.
 *
 * Every field is derived from the committed run evidence rather than authored
 * here, so the receipt cannot drift away from what the run measured.
 */
export const HOLDOUT_REACT_CYPRESS_RWA_SCHEMA = 'versionless.holdout-react-cypress-rwa.v1' as const;
export const HOLDOUT_REACT_CYPRESS_RWA_RECEIPT_PATH =
	'evidence/runs/holdout-react-cypress-rwa/receipt.json' as const;
export const HOLDOUT_REACT_CYPRESS_RWA_MARKDOWN_PATH =
	'evidence/runs/holdout-react-cypress-rwa/receipt.md' as const;
export const HOLDOUT_REACT_CYPRESS_RWA_FIXTURE = 'react-cypress-rwa' as const;
export const HOLDOUT_REACT_CYPRESS_RWA_APPLICATION = 'cypress-realworld-app' as const;
export const HOLDOUT_REACT_CYPRESS_RWA_UNIT = 'lrapr-t008/hx2-migration-under-freeze' as const;

/**
 * The committed run evidence this receipt is derived from, bound by exact
 * bytes. Re-deriving the receipt against edited run evidence fails here rather
 * than silently republishing a different measurement under the same name.
 */
export const HOLDOUT_REACT_CYPRESS_RWA_RUN_EVIDENCE = Object.freeze([
	Object.freeze({
		path: 'evidence/runs/react-cypress-rwa/build-profile.json',
		sha256: '596fbefd141573988e69c0e063b563a0b9382ae780997e10e4c97ad1099a8010',
	}),
	Object.freeze({
		path: 'evidence/runs/react-cypress-rwa/t008-run.md',
		sha256: '715581add025e6bb41a55a845bfd7d82b9503ce6b9befa6517b5d620375b5345',
	}),
]);

/**
 * The composite fingerprint over the five frozen subtrees, recomputed before
 * the run started and again by the verification fence. The holdout is only
 * evidence about the frozen adapter if the adapter was in fact frozen, so the
 * fingerprint is part of the receipt rather than a note beside it.
 */
export const HOLDOUT_REACT_CYPRESS_RWA_FROZEN_FINGERPRINT =
	'd9f75ef677cb850f664cc188abf77b8ebfd24e84cb58d147b74e9bbaa143eb77' as const;

/** The missing generic capability the run measured, named exactly once. */
export const HOLDOUT_REACT_CYPRESS_RWA_MISSING_CAPABILITY =
	'non-UTF-8 module source decoding' as const;

/**
 * What this receipt does not claim.
 *
 * The five carried from the run evidence are the run's own non-claims. The two
 * added here are properties of the receipt rather than of the run: no browser
 * evidence exists at all, and a holdout that had passed would still have proven
 * less than a clean-target migration does, so the caveat is carried in the
 * failing direction too rather than being quietly dropped.
 */
export const HOLDOUT_REACT_CYPRESS_RWA_ADDED_NONCLAIMS = Object.freeze([
	'No browser evidence exists for either lane in this unit. No journey ran, no page was loaded, and nothing is claimed about behavior.',
	'A green holdout would still have proven less than a clean-target migration does: it would have shown the frozen adapter carrying one further application, not generic support. That caveat is carried here unchanged, in the failing direction.',
]);

export interface HoldoutReactCypressRwaSource {
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
}

export interface HoldoutReactCypressRwaInvalidByte {
	offset: number;
	byte: string;
	latin1: string;
	inWord: string;
}

export interface HoldoutReactCypressRwaFinding {
	missingCapability: typeof HOLDOUT_REACT_CYPRESS_RWA_MISSING_CAPABILITY;
	verdict: string;
	statement: string;
	exactDemand: {
		code: string;
		module: string;
		importer: string;
		line: number;
		column: number;
		construct: string;
		compilerText: string;
	};
	offendingFile: {
		path: string;
		package: string;
		bytes: number;
		sha256: string;
		encoding: string;
		invalidUtf8ByteCount: number;
		invalidBytes: HoldoutReactCypressRwaInvalidByte[];
		invalidBytesNote: string;
	};
	reachedFromApplicationCode: { importer: string; construct: string; note: string };
	whyThisIsNotAnAdapterBug: string;
	actionTaken: string;
}

export interface HoldoutReactCypressRwaReceipt {
	schemaVersion: typeof HOLDOUT_REACT_CYPRESS_RWA_SCHEMA;
	role: 'holdout';
	holdoutOutcome: 'failed';
	reason: typeof HOLDOUT_REACT_CYPRESS_RWA_MISSING_CAPABILITY;
	unit: typeof HOLDOUT_REACT_CYPRESS_RWA_UNIT;
	fixture: typeof HOLDOUT_REACT_CYPRESS_RWA_FIXTURE;
	application: typeof HOLDOUT_REACT_CYPRESS_RWA_APPLICATION;
	framework: 'react';
	source: HoldoutReactCypressRwaSource;
	runEvidence: Array<{ path: string; sha256: string }>;
	frozenAdapter: {
		composition: string;
		compositeFingerprint: typeof HOLDOUT_REACT_CYPRESS_RWA_FROZEN_FINGERPRINT;
		subtrees: string[];
		recomputedByThisUnit: boolean;
		bytesChanged: 0;
		changesProposedAndExecuted: 0;
		redBuildPatchedAround: false;
		genericCapabilitiesOnly: true;
		holdoutSpecificConfiguration: 'none';
	};
	lanes: {
		sharedClosure: {
			bothLanesMaterializedFromTheSameExtractedTree: boolean;
			bothLanesInstalledFromTheSameFrozenLockfile: boolean;
			lockfileSha256: string;
			manifestSha256: string;
			statement: string;
		};
		baseline: {
			outcome: 'green';
			command: string;
			node: string;
			declaredBy: string[];
			platform: string;
			builds: number;
			byteStableAcrossRebuilds: boolean;
			laneDigest: string;
			secondLaneDigest: string;
			fileCount: number;
			digestScheme: string;
		};
		migrated: {
			outcome: 'red';
			command: string;
			node: string;
			vite: string;
			bundler: string;
			attempts: number;
			stableAcrossAttempts: boolean;
			exitCode: number;
			modulesTransformedBeforeFailure: number;
			demands: Array<{
				code: string;
				module: string;
				importer: string;
				line: number;
				column: number;
				detail: string;
			}>;
			outputProduced: false;
		};
	};
	identityProof: {
		statement: string;
		baselineAttempts: number;
		baselineDigestsIdentical: boolean;
		migratedAttempts: number;
		migratedDemandsIdentical: boolean;
		demandDigest: string;
	};
	finding: HoldoutReactCypressRwaFinding;
	observedButNotFatal: {
		externalizedNodeCoreModules: Array<{ module: string; importer: string }>;
		note: string;
	};
	applicationInfluence: {
		handEditedSourceFiles: string[];
		applicationFilesChanged: 0;
		adapterBytesChanged: 0;
		attestation: string;
		generatedByTheApplicationsOwnScripts: Array<{ path: string; by: string; lanes: string }>;
		generatedByTheMigration: Array<{
			path: string;
			by: string;
			lanes: string;
			sha256?: string;
		}>;
	};
	parity: {
		comparable: false;
		reason: string;
		declaredDifferences: string[];
	};
	nonclaims: string[];
	integrity: { algorithm: 'sha256'; canonicalDigest: string };
}

function record(value: unknown, label: string): Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`Cypress RWA holdout ${label} must be an object`);
	return value as Record<string, unknown>;
}

function array(value: unknown, label: string): unknown[] {
	if (!Array.isArray(value)) throw new Error(`Cypress RWA holdout ${label} must be an array`);
	return value;
}

function text(value: unknown, label: string): string {
	if (typeof value !== 'string' || value.length === 0)
		throw new Error(`Cypress RWA holdout ${label} must be a non-empty string`);
	return value;
}

function count(value: unknown, label: string): number {
	if (typeof value !== 'number' || !Number.isInteger(value) || value < 0)
		throw new Error(`Cypress RWA holdout ${label} must be a non-negative integer`);
	return value;
}

function flag(value: unknown, label: string): boolean {
	if (typeof value !== 'boolean') throw new Error(`Cypress RWA holdout ${label} must be boolean`);
	return value;
}

export function holdoutReactCypressRwaDigest(receipt: HoldoutReactCypressRwaReceipt): string {
	const copy = structuredClone(receipt);
	copy.integrity.canonicalDigest = '';
	return sha256(canonicalize(copy));
}

/**
 * Derives the whole receipt from the committed run evidence.
 *
 * Publication and verification both go through this one function, so a
 * published holdout receipt is exactly what the run profile supports and
 * nothing else. The build profile's bytes are bound first: an edited profile
 * fails here rather than producing a differently-shaped receipt.
 */
export async function deriveHoldoutReactCypressRwaReceipt(
	rootDir = '.',
): Promise<HoldoutReactCypressRwaReceipt> {
	const root = resolve(rootDir);
	for (const evidence of HOLDOUT_REACT_CYPRESS_RWA_RUN_EVIDENCE) {
		const bytes = await readFile(join(root, evidence.path));
		if (sha256(bytes) !== evidence.sha256)
			throw new Error(`Cypress RWA holdout run evidence drifted: ${evidence.path}`);
	}
	const profile = record(
		JSON.parse(
			await readFile(
				join(root, HOLDOUT_REACT_CYPRESS_RWA_RUN_EVIDENCE[0]!.path),
				'utf8',
			),
		),
		'build profile',
	);
	if (
		profile.schemaVersion !== 'versionless.react-cypress-rwa-build-profile.v1' ||
		profile.role !== 'holdout' ||
		profile.fixture !== HOLDOUT_REACT_CYPRESS_RWA_FIXTURE ||
		profile.unit !== HOLDOUT_REACT_CYPRESS_RWA_UNIT
	)
		throw new Error('Cypress RWA holdout build profile identity differs');
	const discipline = record(profile.holdoutDiscipline, 'holdout discipline');
	if (
		discipline.compositeFingerprint !== HOLDOUT_REACT_CYPRESS_RWA_FROZEN_FINGERPRINT ||
		flag(discipline.fingerprintRecomputedByThisUnit, 'fingerprint recomputation') !== true ||
		count(discipline.adapterBytesChanged, 'adapter bytes changed') !== 0 ||
		count(discipline.adapterChangesProposedAndExecuted, 'adapter changes') !== 0 ||
		flag(discipline.redBuildPatchedAround, 'red build patched around') !== false
	)
		throw new Error('Cypress RWA holdout freeze discipline differs');
	const source = record(profile.source, 'source');
	const acquisition = record(profile.dependencyAcquisition, 'dependency acquisition');
	const cells = record(profile.runtimeCells, 'runtime cells');
	const baselineCell = record(cells.baseline, 'baseline runtime cell');
	const targetCell = record(cells.target, 'target runtime cell');
	const baseline = record(profile.baselineLane, 'baseline lane');
	const migrated = record(profile.migratedLane, 'migrated lane');
	const first = record(baseline.first, 'baseline first build');
	const second = record(baseline.second, 'baseline second build');
	if (
		baseline.result !== 'green' ||
		migrated.result !== 'red' ||
		count(baseline.builds, 'baseline builds') !== 2 ||
		count(migrated.attempts, 'migrated attempts') !== 2 ||
		flag(baseline.byteStableAcrossRebuilds, 'baseline byte stability') !== true ||
		flag(migrated.stableAcrossAttempts, 'migrated stability') !== true ||
		text(first.digest, 'baseline first digest') !== text(second.digest, 'baseline second digest')
	)
		throw new Error('Cypress RWA holdout lane outcomes differ');
	const finding = record(profile.falsificationFinding, 'falsification finding');
	if (finding.missingCapability !== HOLDOUT_REACT_CYPRESS_RWA_MISSING_CAPABILITY)
		throw new Error('Cypress RWA holdout missing capability differs');
	const demands = array(migrated.demands, 'migrated demands').map((value) => {
		const demand = record(value, 'migrated demand');
		return {
			code: text(demand.code, 'demand code'),
			module: text(demand.module, 'demand module'),
			importer: text(demand.importer, 'demand importer'),
			line: count(demand.line, 'demand line'),
			column: count(demand.column, 'demand column'),
			detail: text(demand.detail, 'demand detail'),
		};
	});
	const exactDemand = record(finding.exactDemand, 'exact demand');
	const offending = record(finding.offendingFile, 'offending file');
	const reached = record(finding.reachedFromApplicationCode, 'application importer');
	const observed = record(profile.observedButNotFatal, 'observed but not fatal');
	const changed = record(profile.applicationFilesChanged, 'application files changed');
	const parity = record(profile.parity, 'parity');
	const digestScheme = record(profile.digest, 'digest scheme');
	const lockfile = record(acquisition.lockfile, 'lockfile');
	const manifest = record(acquisition.manifest, 'manifest');
	const workArea = record(profile.workArea, 'work area');
	const receipt: HoldoutReactCypressRwaReceipt = {
		schemaVersion: HOLDOUT_REACT_CYPRESS_RWA_SCHEMA,
		role: 'holdout',
		holdoutOutcome: 'failed',
		reason: HOLDOUT_REACT_CYPRESS_RWA_MISSING_CAPABILITY,
		unit: HOLDOUT_REACT_CYPRESS_RWA_UNIT,
		fixture: HOLDOUT_REACT_CYPRESS_RWA_FIXTURE,
		application: HOLDOUT_REACT_CYPRESS_RWA_APPLICATION,
		framework: 'react',
		source: {
			repository: text(source.repository, 'source repository'),
			ref: text(source.ref, 'source ref'),
			revision: text(source.revision, 'source revision'),
			archiveSha256: text(source.archiveSha256, 'source archive digest'),
			frontendRoot: text(source.frontendRoot, 'source frontend root'),
			license: text(source.license, 'source license'),
			react: text(source.react, 'source react version'),
			reactScripts: text(source.reactScripts, 'source react-scripts version'),
			webpack: text(source.webpack, 'source webpack version'),
			typescript: text(source.typescript, 'source typescript version'),
		},
		runEvidence: HOLDOUT_REACT_CYPRESS_RWA_RUN_EVIDENCE.map((evidence) => ({
			path: evidence.path,
			sha256: evidence.sha256,
		})),
		frozenAdapter: {
			composition: text(migrated.adapterComposition, 'adapter composition'),
			compositeFingerprint: HOLDOUT_REACT_CYPRESS_RWA_FROZEN_FINGERPRINT,
			subtrees: array(discipline.frozenSubtrees, 'frozen subtrees').map((value) =>
				text(value, 'frozen subtree'),
			),
			recomputedByThisUnit: true,
			bytesChanged: 0,
			changesProposedAndExecuted: 0,
			redBuildPatchedAround: false,
			genericCapabilitiesOnly: true,
			holdoutSpecificConfiguration: 'none',
		},
		lanes: {
			sharedClosure: {
				bothLanesMaterializedFromTheSameExtractedTree: flag(
					workArea.bothLanesMaterializedFromTheSameExtractedTree,
					'shared extraction',
				),
				bothLanesInstalledFromTheSameFrozenLockfile: flag(
					acquisition.bothLanesInstalledFromTheSameFrozenLockfile,
					'shared lockfile',
				),
				lockfileSha256: text(lockfile.sha256, 'lockfile digest'),
				manifestSha256: text(manifest.sha256, 'manifest digest'),
				statement: text(acquisition.lanesShareOneDependencyClosure, 'shared closure'),
			},
			baseline: {
				outcome: 'green',
				command: text(baseline.command, 'baseline command'),
				node: text(baselineCell.node, 'baseline node'),
				declaredBy: array(baselineCell.declaredBy, 'baseline node declaration').map(
					(value) => text(value, 'baseline node declaration entry'),
				),
				platform: text(baselineCell.platform, 'baseline platform'),
				builds: count(baseline.builds, 'baseline builds'),
				byteStableAcrossRebuilds: true,
				laneDigest: text(first.digest, 'baseline lane digest'),
				secondLaneDigest: text(second.digest, 'baseline second lane digest'),
				fileCount: count(baseline.fileCount, 'baseline file count'),
				digestScheme: text(digestScheme.scheme, 'digest scheme'),
			},
			migrated: {
				outcome: 'red',
				command: text(migrated.command, 'migrated command'),
				node: text(targetCell.node, 'target node'),
				vite: text(targetCell.vite, 'target vite'),
				bundler: text(targetCell.bundler, 'target bundler'),
				attempts: count(migrated.attempts, 'migrated attempts'),
				stableAcrossAttempts: true,
				exitCode: count(migrated.exitCode, 'migrated exit code'),
				modulesTransformedBeforeFailure: count(
					migrated.modulesTransformedBeforeFailure,
					'modules transformed',
				),
				demands,
				outputProduced: false,
			},
		},
		identityProof: {
			statement: text(migrated.stableAcrossAttemptsNote, 'identity statement'),
			baselineAttempts: count(baseline.builds, 'baseline builds'),
			baselineDigestsIdentical: first.digest === second.digest,
			migratedAttempts: count(migrated.attempts, 'migrated attempts'),
			migratedDemandsIdentical: flag(migrated.stableAcrossAttempts, 'migrated stability'),
			demandDigest: sha256(canonicalize(demands)),
		},
		finding: {
			missingCapability: HOLDOUT_REACT_CYPRESS_RWA_MISSING_CAPABILITY,
			verdict: text(finding.verdict, 'finding verdict'),
			statement: text(finding.statement, 'finding statement'),
			exactDemand: {
				code: text(exactDemand.code, 'exact demand code'),
				module: text(exactDemand.module, 'exact demand module'),
				importer: text(exactDemand.importer, 'exact demand importer'),
				line: count(exactDemand.line, 'exact demand line'),
				column: count(exactDemand.column, 'exact demand column'),
				construct: text(exactDemand.construct, 'exact demand construct'),
				compilerText: text(exactDemand.compilerText, 'exact demand compiler text'),
			},
			offendingFile: {
				path: text(offending.path, 'offending path'),
				package: text(offending.package, 'offending package'),
				bytes: count(offending.bytes, 'offending byte length'),
				sha256: text(offending.sha256, 'offending digest'),
				encoding: text(offending.encoding, 'offending encoding'),
				invalidUtf8ByteCount: count(offending.invalidUtf8ByteCount, 'invalid byte count'),
				invalidBytes: array(offending.invalidBytes, 'invalid bytes').map((value) => {
					const entry = record(value, 'invalid byte');
					return {
						offset: count(entry.offset, 'invalid byte offset'),
						byte: text(entry.byte, 'invalid byte value'),
						latin1: text(entry.latin1, 'invalid byte character'),
						inWord: text(entry.inWord, 'invalid byte word'),
					};
				}),
				invalidBytesNote: text(offending.invalidBytesNote, 'invalid bytes note'),
			},
			reachedFromApplicationCode: {
				importer: text(reached.importer, 'application importer'),
				construct: text(reached.construct, 'application construct'),
				note: text(reached.note, 'application importer note'),
			},
			whyThisIsNotAnAdapterBug: text(finding.whyThisIsNotAnAdapterBug, 'adapter reasoning'),
			actionTaken: text(finding.actionTaken, 'action taken'),
		},
		observedButNotFatal: {
			externalizedNodeCoreModules: array(
				observed.externalizedNodeCoreModules,
				'externalized modules',
			).map((value) => {
				const entry = record(value, 'externalized module');
				return {
					module: text(entry.module, 'externalized module name'),
					importer: text(entry.importer, 'externalized module importer'),
				};
			}),
			note: text(observed.note, 'externalized module note'),
		},
		applicationInfluence: {
			handEditedSourceFiles: array(
				changed.handEditedSourceFiles,
				'hand-edited source files',
			).map((value) => text(value, 'hand-edited source file')),
			applicationFilesChanged: 0,
			adapterBytesChanged: 0,
			attestation:
				'The holdout influenced nothing. Zero adapter bytes changed and zero application source files were hand-edited; the red build was recorded, not repaired.',
			generatedByTheApplicationsOwnScripts: array(
				changed.generatedByTheApplicationsOwnScripts,
				'application-generated files',
			).map((value) => {
				const entry = record(value, 'application-generated file');
				return {
					path: text(entry.path, 'application-generated path'),
					by: text(entry.by, 'application-generated by'),
					lanes: text(entry.lanes, 'application-generated lanes'),
				};
			}),
			generatedByTheMigration: array(
				changed.generatedByTheMigration,
				'migration-generated files',
			).map((value) => {
				const entry = record(value, 'migration-generated file');
				return {
					path: text(entry.path, 'migration-generated path'),
					by: text(entry.by, 'migration-generated by'),
					lanes: text(entry.lanes, 'migration-generated lanes'),
					sha256: text(entry.sha256, 'migration-generated digest'),
				};
			}),
		},
		parity: {
			comparable: false,
			reason: text(parity.reason, 'parity reason'),
			declaredDifferences: array(parity.declaredDifferences, 'declared differences').map(
				(value) => text(value, 'declared difference'),
			),
		},
		nonclaims: [
			...array(parity.nonClaims, 'run non-claims').map((value) =>
				text(value, 'run non-claim'),
			),
			...HOLDOUT_REACT_CYPRESS_RWA_ADDED_NONCLAIMS,
		],
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	if (
		count(changed.count, 'application files changed') !== 0 ||
		receipt.applicationInfluence.handEditedSourceFiles.length !== 0 ||
		flag(parity.comparable, 'parity comparability') !== false ||
		receipt.lanes.migrated.demands.length === 0 ||
		receipt.nonclaims.length === 0
	)
		throw new Error('Cypress RWA holdout influence or parity evidence differs');
	receipt.integrity.canonicalDigest = holdoutReactCypressRwaDigest(receipt);
	return receipt;
}

const sha256Hex = createRegExp(
	charIn('0123456789').from('a', 'f').times(64).at.lineStart().at.lineEnd(),
);

export function parseHoldoutReactCypressRwaReceipt(value: unknown): HoldoutReactCypressRwaReceipt {
	const receipt = record(value, 'receipt') as unknown as HoldoutReactCypressRwaReceipt;
	if (
		receipt.schemaVersion !== HOLDOUT_REACT_CYPRESS_RWA_SCHEMA ||
		receipt.role !== 'holdout' ||
		receipt.holdoutOutcome !== 'failed' ||
		receipt.reason !== HOLDOUT_REACT_CYPRESS_RWA_MISSING_CAPABILITY ||
		receipt.unit !== HOLDOUT_REACT_CYPRESS_RWA_UNIT ||
		receipt.fixture !== HOLDOUT_REACT_CYPRESS_RWA_FIXTURE ||
		receipt.application !== HOLDOUT_REACT_CYPRESS_RWA_APPLICATION ||
		receipt.framework !== 'react'
	)
		throw new Error('Cypress RWA holdout identity differs');
	if (
		receipt.frozenAdapter?.compositeFingerprint !==
			HOLDOUT_REACT_CYPRESS_RWA_FROZEN_FINGERPRINT ||
		receipt.frozenAdapter.bytesChanged !== 0 ||
		receipt.frozenAdapter.changesProposedAndExecuted !== 0 ||
		receipt.frozenAdapter.redBuildPatchedAround !== false ||
		receipt.frozenAdapter.recomputedByThisUnit !== true ||
		receipt.frozenAdapter.subtrees.length !== 5
	)
		throw new Error('Cypress RWA holdout freeze binding differs');
	if (
		receipt.lanes?.baseline?.outcome !== 'green' ||
		receipt.lanes.baseline.builds !== 2 ||
		receipt.lanes.baseline.byteStableAcrossRebuilds !== true ||
		receipt.lanes.baseline.laneDigest !== receipt.lanes.baseline.secondLaneDigest ||
		!sha256Hex.test(receipt.lanes.baseline.laneDigest) ||
		receipt.lanes.migrated?.outcome !== 'red' ||
		receipt.lanes.migrated.attempts !== 2 ||
		receipt.lanes.migrated.stableAcrossAttempts !== true ||
		receipt.lanes.migrated.outputProduced !== false ||
		receipt.lanes.migrated.demands.length === 0
	)
		throw new Error('Cypress RWA holdout lane evidence differs');
	if (
		receipt.identityProof?.baselineAttempts !== 2 ||
		receipt.identityProof.migratedAttempts !== 2 ||
		receipt.identityProof.baselineDigestsIdentical !== true ||
		receipt.identityProof.migratedDemandsIdentical !== true ||
		receipt.identityProof.demandDigest !== sha256(canonicalize(receipt.lanes.migrated.demands))
	)
		throw new Error('Cypress RWA holdout two-attempt identity proof differs');
	if (
		receipt.finding?.missingCapability !== HOLDOUT_REACT_CYPRESS_RWA_MISSING_CAPABILITY ||
		receipt.finding.offendingFile.invalidUtf8ByteCount !== 6 ||
		receipt.finding.offendingFile.invalidBytes.length === 0 ||
		!sha256Hex.test(receipt.finding.offendingFile.sha256) ||
		receipt.applicationInfluence?.applicationFilesChanged !== 0 ||
		receipt.applicationInfluence.adapterBytesChanged !== 0 ||
		receipt.applicationInfluence.handEditedSourceFiles.length !== 0 ||
		receipt.parity?.comparable !== false ||
		!Array.isArray(receipt.nonclaims) ||
		!HOLDOUT_REACT_CYPRESS_RWA_ADDED_NONCLAIMS.every((claim) =>
			receipt.nonclaims.includes(claim),
		)
	)
		throw new Error('Cypress RWA holdout finding or non-claims differ');
	if (
		receipt.integrity?.algorithm !== 'sha256' ||
		!sha256Hex.test(receipt.integrity.canonicalDigest) ||
		receipt.integrity.canonicalDigest !== holdoutReactCypressRwaDigest(receipt)
	)
		throw new Error('Cypress RWA holdout integrity differs');
	return receipt;
}

export function renderHoldoutReactCypressRwaReceipt(
	receipt: HoldoutReactCypressRwaReceipt,
): string {
	const demand = receipt.finding.exactDemand;
	const offending = receipt.finding.offendingFile;
	const bytes = offending.invalidBytes
		.map((entry) => `${entry.byte} at offset ${entry.offset} (\`${entry.inWord}\`)`)
		.join(', ');
	return `# cypress-realworld-app — holdout falsification receipt

- Outcome: **${receipt.holdoutOutcome}** — the frozen adapter does not carry this application at this revision
- Recorded reason: missing generic capability — **${receipt.reason}**
- Canonical SHA-256: ${receipt.integrity.canonicalDigest}
- Unit: \`${receipt.unit}\`
- Source: ${receipt.source.repository} at \`${receipt.source.ref}\` (\`${receipt.source.revision}\`, ${receipt.source.license}), create-react-app ${receipt.source.reactScripts} over webpack ${receipt.source.webpack}, React ${receipt.source.react}, TypeScript ${receipt.source.typescript}
- Frozen adapter fingerprint: \`${receipt.frozenAdapter.compositeFingerprint}\` over ${receipt.frozenAdapter.subtrees.length} subtrees, recomputed by this unit; adapter bytes changed: ${receipt.frozenAdapter.bytesChanged}; adapter changes proposed and executed: ${receipt.frozenAdapter.changesProposedAndExecuted}
- Derived from committed run evidence: ${receipt.runEvidence.map((item) => `\`${item.path}\` (\`${item.sha256}\`)`).join(', ')}

## Both lanes

- Shared closure: ${receipt.lanes.sharedClosure.statement}
- Baseline (${receipt.lanes.baseline.command}, Node ${receipt.lanes.baseline.node} declared by ${receipt.lanes.baseline.declaredBy.join(' and ')}): **${receipt.lanes.baseline.outcome}**, built ${receipt.lanes.baseline.builds}x byte-stable, ${receipt.lanes.baseline.fileCount} files, lane digest \`${receipt.lanes.baseline.laneDigest}\` under ${receipt.lanes.baseline.digestScheme}
- Migrated (${receipt.lanes.migrated.command}, Node ${receipt.lanes.migrated.node}, Vite ${receipt.lanes.migrated.vite}, ${receipt.lanes.migrated.bundler}): **${receipt.lanes.migrated.outcome}**, ${receipt.lanes.migrated.attempts} attempts, exit ${receipt.lanes.migrated.exitCode} after ${receipt.lanes.migrated.modulesTransformedBeforeFailure} transformed modules, no output produced
- Two-attempt identity proof: ${receipt.identityProof.statement} Demand multiset digest \`${receipt.identityProof.demandDigest}\`.

## The finding

**Missing capability: ${receipt.finding.missingCapability}.**

${receipt.finding.statement}

- Exact demand: \`${demand.code}\` loading \`${demand.module}\` from \`${demand.importer}\`:${demand.line}:${demand.column} — ${demand.compilerText}
- Offending file: \`${offending.path}\` (${offending.package}, ${offending.bytes} bytes, sha256 \`${offending.sha256}\`), stored in ${offending.encoding}, ${offending.invalidUtf8ByteCount} invalid UTF-8 bytes: ${bytes}. ${offending.invalidBytesNote}
- Reached from production application code: \`${receipt.finding.reachedFromApplicationCode.importer}\` does \`${receipt.finding.reachedFromApplicationCode.construct}\` — ${receipt.finding.reachedFromApplicationCode.note}
- Why this is not an adapter bug: ${receipt.finding.whyThisIsNotAnAdapterBug}
- Action taken: ${receipt.finding.actionTaken}

## Zero influence

${receipt.applicationInfluence.attestation} Application files changed: ${receipt.applicationInfluence.applicationFilesChanged}. Generated by the application's own scripts: ${receipt.applicationInfluence.generatedByTheApplicationsOwnScripts.map((item) => `\`${item.path}\``).join(', ')}; generated by the migration: ${receipt.applicationInfluence.generatedByTheMigration.map((item) => `\`${item.path}\``).join(', ')}.

Observed but not fatal: ${receipt.observedButNotFatal.externalizedNodeCoreModules.map((item) => `\`${item.module}\` for \`${item.importer}\``).join(', ')}. ${receipt.observedButNotFatal.note}

## Parity and non-claims

${receipt.parity.reason}

${receipt.nonclaims.map((claim) => `- ${claim}`).join('\n')}
`;
}

/**
 * The corpus and aggregate record for this holdout.
 *
 * It is deliberately not an aggregate fixture row and deliberately not a
 * lineage counting cell: a holdout that failed is evidence about the adapter,
 * not a migrated application. `countedInLineageNumerator` is false and stays
 * false, and the record is published rather than dropped, following the
 * declined-RealWorld precedent that a cell the Judge does not count still stays
 * visible in the ledger.
 */
export function holdoutReactCypressRwaCorpusRecord(receipt: HoldoutReactCypressRwaReceipt) {
	return {
		id: 'holdout-react-cypress-rwa',
		application: receipt.application,
		framework: receipt.framework,
		lineage: 'react',
		role: 'holdout',
		attempted: true,
		outcome: receipt.holdoutOutcome,
		reason: receipt.reason,
		verdict: receipt.finding.verdict,
		frozenAdapterFingerprint: receipt.frozenAdapter.compositeFingerprint,
		adapterBytesChanged: receipt.frozenAdapter.bytesChanged,
		baselineLane: receipt.lanes.baseline.outcome,
		migratedLane: receipt.lanes.migrated.outcome,
		attempts: receipt.lanes.migrated.attempts,
		receipt: HOLDOUT_REACT_CYPRESS_RWA_RECEIPT_PATH,
		digest: receipt.integrity.canonicalDigest,
		countedInLineageNumerator: false,
		countingNote:
			'Never counted in any lineage numerator: no application was migrated. The record is published rather than dropped so a failed falsification attempt cannot be hidden.',
		browserProof: 'not-tested',
	};
}

export async function verifyHoldoutReactCypressRwaEvidence(rootDir = '.'): Promise<{
	valid: true;
	digest: string;
	artifacts: number;
	receipt: HoldoutReactCypressRwaReceipt;
}> {
	const root = resolve(rootDir);
	const published = parseHoldoutReactCypressRwaReceipt(
		JSON.parse(await readFile(join(root, HOLDOUT_REACT_CYPRESS_RWA_RECEIPT_PATH), 'utf8')),
	);
	const derived = await deriveHoldoutReactCypressRwaReceipt(root);
	if (canonicalize(published) !== canonicalize(derived))
		throw new Error('Cypress RWA holdout receipt does not match its committed run evidence');
	if (
		(await readFile(join(root, HOLDOUT_REACT_CYPRESS_RWA_MARKDOWN_PATH), 'utf8')) !==
		renderHoldoutReactCypressRwaReceipt(published)
	)
		throw new Error('Cypress RWA holdout human receipt differs');
	return {
		valid: true as const,
		digest: published.integrity.canonicalDigest,
		artifacts: published.runEvidence.length,
		receipt: published,
	};
}

/* -------------------------------------------------------------------------- *
 * T017 re-run: the same holdout against the re-frozen adapter composition.
 *
 * The tranche-one FAIL above is immutable. This re-run is a new dated record
 * that supersedes it by reference only: it runs the identical application at
 * the identical pinned revision against the re-frozen adapters (composite
 * 5de7df56, which now carries the generic non-UTF-8 module source decoding
 * capability the tranche-one attempt lacked) and records what the frozen
 * composition does now. The migrated build advances one module past the
 * tranche-one blocker and through the whole transform phase, then stops on a
 * strictly-later, different generic gap. The outcome is `failed` and it is
 * recorded with the same rigor a pass would have been given.
 * -------------------------------------------------------------------------- */

export const HOLDOUT_REACT_CYPRESS_RWA_RERUN_SCHEMA =
	'versionless.holdout-react-cypress-rwa-rerun.v1' as const;
export const HOLDOUT_REACT_CYPRESS_RWA_RERUN_RECEIPT_PATH =
	'evidence/runs/holdout-react-cypress-rwa/rerun-2026-08-12/receipt.json' as const;
export const HOLDOUT_REACT_CYPRESS_RWA_RERUN_MARKDOWN_PATH =
	'evidence/runs/holdout-react-cypress-rwa/rerun-2026-08-12/receipt.md' as const;
export const HOLDOUT_REACT_CYPRESS_RWA_RERUN_UNIT =
	'lrapr-t017/h1-cypress-rwa-holdout-rerun' as const;
export const HOLDOUT_REACT_CYPRESS_RWA_RERUN_FROZEN_FINGERPRINT =
	'5de7df565fb8e445a45f9f8f43eac27b80b71189d59e4df243e93471406a260c' as const;

/** The new generic gap this re-run measured, named exactly once. */
export const HOLDOUT_REACT_CYPRESS_RWA_RERUN_MISSING_CAPABILITY =
	'missing-export tolerance for a self-inconsistent dependency ES module' as const;

/** The tranche-one FAIL this re-run supersedes by reference. */
export const HOLDOUT_REACT_CYPRESS_RWA_RERUN_SUPERSEDED_RECEIPT_PATH =
	HOLDOUT_REACT_CYPRESS_RWA_RECEIPT_PATH;
export const HOLDOUT_REACT_CYPRESS_RWA_RERUN_SUPERSEDED_DIGEST =
	'7ec6f18b27d2967cd533ba89505e8a76590c1866aec8bd7a8d8543cd87743aae' as const;

/**
 * The committed run evidence this re-run receipt is derived from, bound by
 * exact bytes. Re-deriving against edited run evidence fails rather than
 * silently republishing a different measurement under the same name.
 */
export const HOLDOUT_REACT_CYPRESS_RWA_RERUN_RUN_EVIDENCE = Object.freeze([
	Object.freeze({
		path: 'evidence/runs/react-cypress-rwa/rerun-2026-08-12/build-profile.json',
		sha256: '981fbff5b2c8a4e257544bf6ba6abb25334c686fd56605edd6e0a89f4795d1ae',
	}),
	Object.freeze({
		path: 'evidence/runs/react-cypress-rwa/rerun-2026-08-12/run.md',
		sha256: '33d9cb4cfee97a2317b207e74480813e561ad9eac03aec41f6daa48816e45d26',
	}),
	Object.freeze({
		path: 'evidence/runs/react-cypress-rwa/rerun-2026-08-12/migrated-error.log',
		sha256: '6dd02948f7dd8bb2d6b140ade19e318dee8948fc5f0b91ed4d44d514dd5ac435',
	}),
]);

export interface HoldoutReactCypressRwaRerunReceipt {
	schemaVersion: typeof HOLDOUT_REACT_CYPRESS_RWA_RERUN_SCHEMA;
	role: 'holdout';
	holdoutOutcome: 'failed';
	reason: typeof HOLDOUT_REACT_CYPRESS_RWA_RERUN_MISSING_CAPABILITY;
	unit: typeof HOLDOUT_REACT_CYPRESS_RWA_RERUN_UNIT;
	fixture: typeof HOLDOUT_REACT_CYPRESS_RWA_FIXTURE;
	application: typeof HOLDOUT_REACT_CYPRESS_RWA_APPLICATION;
	framework: 'react';
	supersedes: {
		unit: string;
		receipt: string;
		receiptDigest: string;
		priorFrozenFingerprint: string;
		priorReason: string;
		priorGapNowHandled: true;
		note: string;
	};
	source: HoldoutReactCypressRwaSource;
	runEvidence: Array<{ path: string; sha256: string }>;
	frozenAdapter: {
		composition: string;
		compositeFingerprint: typeof HOLDOUT_REACT_CYPRESS_RWA_RERUN_FROZEN_FINGERPRINT;
		subtrees: string[];
		recomputedByThisUnit: true;
		bytesChanged: 0;
		changesProposedAndExecuted: 0;
		redBuildPatchedAround: false;
		genericCapabilitiesOnly: true;
		holdoutSpecificConfiguration: 'none';
		harnessBranchedOnHoldoutIdentity: false;
	};
	capabilityAdvance: {
		priorBlocker: string;
		nowHandledByFrozenCapability: true;
		frozenCapability: string;
		modulesTransformedTrancheOne: number;
		modulesTransformedRerun: number;
		evidence: string;
	};
	lanes: {
		sharedClosure: {
			bothLanesMaterializedFromTheSameExtractedTree: boolean;
			bothLanesInstalledFromTheSameFrozenLockfile: boolean;
			lockfileSha256: string;
			manifestSha256: string;
			statement: string;
		};
		baseline: {
			outcome: 'green';
			command: string;
			node: string;
			declaredBy: string[];
			platform: string;
			builds: number;
			byteStableAcrossRebuilds: boolean;
			laneDigest: string;
			secondLaneDigest: string;
			reproducesTrancheOneBaseline: boolean;
			fileCount: number;
			digestScheme: string;
		};
		migrated: {
			outcome: 'red';
			command: string;
			node: string;
			vite: string;
			bundler: string;
			attempts: number;
			stableAcrossAttempts: boolean;
			exitCode: number;
			modulesTransformedBeforeFailure: number;
			failurePhase: string;
			demands: Array<{
				code: string;
				module: string;
				importer: string;
				line: number;
				column: number;
				detail: string;
			}>;
			outputProduced: false;
		};
	};
	identityProof: {
		statement: string;
		baselineAttempts: number;
		baselineDigestsIdentical: boolean;
		migratedAttempts: number;
		migratedDemandsIdentical: boolean;
		demandDigest: string;
	};
	finding: {
		missingCapability: typeof HOLDOUT_REACT_CYPRESS_RWA_RERUN_MISSING_CAPABILITY;
		verdict: string;
		statement: string;
		exactDemand: {
			code: string;
			module: string;
			importer: string;
			line: number;
			column: number;
			construct: string;
			symbol: string;
			compilerText: string;
		};
		offendingFile: {
			path: string;
			package: string;
			bytes: number;
			sha256: string;
			exportsTheDemandedName: false;
			note: string;
		};
		importerFile: { path: string; bytes: number; sha256: string };
		scopeOfDefect: { danglingImportFilesInEsBuild: number; note: string };
		reachedFromApplicationCode: { importer: string; construct: string; note: string };
		whyThisIsNotAnAdapterBug: string;
		actionTaken: string;
	};
	observedButNotFatal: {
		externalizedNodeCoreModules: Array<{ module: string; importer: string }>;
		note: string;
	};
	applicationInfluence: {
		handEditedSourceFiles: string[];
		applicationFilesChanged: 0;
		adapterBytesChanged: 0;
		attestation: string;
	};
	parity: { comparable: false; reason: string; declaredDifferences: string[] };
	nonclaims: string[];
	integrity: { algorithm: 'sha256'; canonicalDigest: string };
}

export function holdoutReactCypressRwaRerunDigest(
	receipt: HoldoutReactCypressRwaRerunReceipt,
): string {
	const copy = structuredClone(receipt);
	copy.integrity.canonicalDigest = '';
	return sha256(canonicalize(copy));
}

/**
 * Derives the whole re-run receipt from the committed run evidence. Publication
 * and verification both go through this one function, so a published re-run
 * receipt is exactly what the re-run build profile supports and nothing else.
 */
export async function deriveHoldoutReactCypressRwaRerunReceipt(
	rootDir = '.',
): Promise<HoldoutReactCypressRwaRerunReceipt> {
	const root = resolve(rootDir);
	for (const evidence of HOLDOUT_REACT_CYPRESS_RWA_RERUN_RUN_EVIDENCE) {
		const bytes = await readFile(join(root, evidence.path));
		if (sha256(bytes) !== evidence.sha256)
			throw new Error(`Cypress RWA holdout re-run evidence drifted: ${evidence.path}`);
	}
	const profile = record(
		JSON.parse(
			await readFile(
				join(root, HOLDOUT_REACT_CYPRESS_RWA_RERUN_RUN_EVIDENCE[0]!.path),
				'utf8',
			),
		),
		're-run build profile',
	);
	if (
		profile.schemaVersion !== 'versionless.react-cypress-rwa-rerun-build-profile.v1' ||
		profile.role !== 'holdout' ||
		profile.fixture !== HOLDOUT_REACT_CYPRESS_RWA_FIXTURE ||
		profile.unit !== HOLDOUT_REACT_CYPRESS_RWA_RERUN_UNIT
	)
		throw new Error('Cypress RWA holdout re-run build profile identity differs');
	const supersedes = record(profile.supersedes, 're-run supersession');
	const discipline = record(profile.holdoutDiscipline, 're-run holdout discipline');
	if (
		discipline.compositeFingerprint !== HOLDOUT_REACT_CYPRESS_RWA_RERUN_FROZEN_FINGERPRINT ||
		flag(discipline.fingerprintRecomputedByThisUnit, 're-run fingerprint recomputation') !==
			true ||
		count(discipline.adapterBytesChanged, 're-run adapter bytes changed') !== 0 ||
		count(discipline.adapterChangesProposedAndExecuted, 're-run adapter changes') !== 0 ||
		flag(discipline.redBuildPatchedAround, 're-run red build patched around') !== false ||
		flag(discipline.harnessBranchedOnHoldoutIdentity, 're-run harness branch') !== false
	)
		throw new Error('Cypress RWA holdout re-run freeze discipline differs');
	const source = record(profile.source, 're-run source');
	const acquisition = record(profile.dependencyAcquisition, 're-run dependency acquisition');
	const cells = record(profile.runtimeCells, 're-run runtime cells');
	const baselineCell = record(cells.baseline, 're-run baseline runtime cell');
	const targetCell = record(cells.target, 're-run target runtime cell');
	const baseline = record(profile.baselineLane, 're-run baseline lane');
	const migrated = record(profile.migratedLane, 're-run migrated lane');
	const advance = record(profile.capabilityAdvance, 're-run capability advance');
	const first = record(baseline.first, 're-run baseline first build');
	const second = record(baseline.second, 're-run baseline second build');
	if (
		baseline.result !== 'green' ||
		migrated.result !== 'red' ||
		count(baseline.builds, 're-run baseline builds') !== 2 ||
		count(migrated.attempts, 're-run migrated attempts') !== 2 ||
		flag(baseline.byteStableAcrossRebuilds, 're-run baseline byte stability') !== true ||
		flag(migrated.stableAcrossAttempts, 're-run migrated stability') !== true ||
		text(first.digest, 're-run baseline first digest') !==
			text(second.digest, 're-run baseline second digest')
	)
		throw new Error('Cypress RWA holdout re-run lane outcomes differ');
	const priorModules = count(advance.modulesTransformedTrancheOne, 're-run prior module count');
	const rerunModules = count(advance.modulesTransformedRerun, 're-run module count');
	if (
		flag(advance.nowHandledByFrozenCapability, 're-run capability handled') !== true ||
		rerunModules <= priorModules ||
		rerunModules !== count(migrated.modulesTransformedBeforeFailure, 're-run migrated modules')
	)
		throw new Error('Cypress RWA holdout re-run capability advance not demonstrated');
	const finding = record(profile.falsificationFinding, 're-run falsification finding');
	if (finding.missingCapability !== HOLDOUT_REACT_CYPRESS_RWA_RERUN_MISSING_CAPABILITY)
		throw new Error('Cypress RWA holdout re-run missing capability differs');
	const demands = array(migrated.demands, 're-run migrated demands').map((value) => {
		const demand = record(value, 're-run migrated demand');
		return {
			code: text(demand.code, 're-run demand code'),
			module: text(demand.module, 're-run demand module'),
			importer: text(demand.importer, 're-run demand importer'),
			line: count(demand.line, 're-run demand line'),
			column: count(demand.column, 're-run demand column'),
			detail: text(demand.detail, 're-run demand detail'),
		};
	});
	const exactDemand = record(finding.exactDemand, 're-run exact demand');
	const offending = record(finding.offendingFile, 're-run offending file');
	const importerFile = record(finding.importerFile, 're-run importer file');
	const scope = record(finding.scopeOfDefect, 're-run scope of defect');
	const reached = record(finding.reachedFromApplicationCode, 're-run application importer');
	const observed = record(profile.observedButNotFatal, 're-run observed but not fatal');
	const changed = record(profile.applicationFilesChanged, 're-run application files changed');
	const parity = record(profile.parity, 're-run parity');
	const digestScheme = record(profile.digest, 're-run digest scheme');
	const lockfile = record(acquisition.lockfile, 're-run lockfile');
	const manifest = record(acquisition.manifest, 're-run manifest');
	const workArea = record(profile.workArea, 're-run work area');
	const receipt: HoldoutReactCypressRwaRerunReceipt = {
		schemaVersion: HOLDOUT_REACT_CYPRESS_RWA_RERUN_SCHEMA,
		role: 'holdout',
		holdoutOutcome: 'failed',
		reason: HOLDOUT_REACT_CYPRESS_RWA_RERUN_MISSING_CAPABILITY,
		unit: HOLDOUT_REACT_CYPRESS_RWA_RERUN_UNIT,
		fixture: HOLDOUT_REACT_CYPRESS_RWA_FIXTURE,
		application: HOLDOUT_REACT_CYPRESS_RWA_APPLICATION,
		framework: 'react',
		supersedes: {
			unit: text(supersedes.unit, 're-run superseded unit'),
			receipt: text(supersedes.receipt, 're-run superseded receipt'),
			receiptDigest: text(supersedes.receiptDigest, 're-run superseded digest'),
			priorFrozenFingerprint: text(
				supersedes.priorFrozenFingerprint,
				're-run prior fingerprint',
			),
			priorReason: text(supersedes.priorReason, 're-run prior reason'),
			priorGapNowHandled: true,
			note: text(supersedes.note, 're-run supersession note'),
		},
		source: {
			repository: text(source.repository, 're-run source repository'),
			ref: text(source.ref, 're-run source ref'),
			revision: text(source.revision, 're-run source revision'),
			archiveSha256: text(source.archiveSha256, 're-run source archive digest'),
			frontendRoot: text(source.frontendRoot, 're-run source frontend root'),
			license: text(source.license, 're-run source license'),
			react: text(source.react, 're-run source react version'),
			reactScripts: text(source.reactScripts, 're-run source react-scripts version'),
			webpack: text(source.webpack, 're-run source webpack version'),
			typescript: text(source.typescript, 're-run source typescript version'),
		},
		runEvidence: HOLDOUT_REACT_CYPRESS_RWA_RERUN_RUN_EVIDENCE.map((evidence) => ({
			path: evidence.path,
			sha256: evidence.sha256,
		})),
		frozenAdapter: {
			composition: text(migrated.adapterComposition, 're-run adapter composition'),
			compositeFingerprint: HOLDOUT_REACT_CYPRESS_RWA_RERUN_FROZEN_FINGERPRINT,
			subtrees: array(discipline.frozenSubtrees, 're-run frozen subtrees').map((value) =>
				text(value, 're-run frozen subtree'),
			),
			recomputedByThisUnit: true,
			bytesChanged: 0,
			changesProposedAndExecuted: 0,
			redBuildPatchedAround: false,
			genericCapabilitiesOnly: true,
			holdoutSpecificConfiguration: 'none',
			harnessBranchedOnHoldoutIdentity: false,
		},
		capabilityAdvance: {
			priorBlocker: text(advance.priorBlocker, 're-run prior blocker'),
			nowHandledByFrozenCapability: true,
			frozenCapability: text(advance.frozenCapability, 're-run frozen capability'),
			modulesTransformedTrancheOne: priorModules,
			modulesTransformedRerun: rerunModules,
			evidence: text(advance.evidence, 're-run capability evidence'),
		},
		lanes: {
			sharedClosure: {
				bothLanesMaterializedFromTheSameExtractedTree: flag(
					workArea.bothLanesMaterializedFromTheSameExtractedTree,
					're-run shared extraction',
				),
				bothLanesInstalledFromTheSameFrozenLockfile: flag(
					acquisition.bothLanesInstalledFromTheSameFrozenLockfile,
					're-run shared lockfile',
				),
				lockfileSha256: text(lockfile.sha256, 're-run lockfile digest'),
				manifestSha256: text(manifest.sha256, 're-run manifest digest'),
				statement: text(acquisition.lanesShareOneDependencyClosure, 're-run shared closure'),
			},
			baseline: {
				outcome: 'green',
				command: text(baseline.command, 're-run baseline command'),
				node: text(baselineCell.node, 're-run baseline node'),
				declaredBy: array(baselineCell.declaredBy, 're-run baseline node declaration').map(
					(value) => text(value, 're-run baseline node declaration entry'),
				),
				platform: text(baselineCell.platform, 're-run baseline platform'),
				builds: count(baseline.builds, 're-run baseline builds'),
				byteStableAcrossRebuilds: true,
				laneDigest: text(first.digest, 're-run baseline lane digest'),
				secondLaneDigest: text(second.digest, 're-run baseline second lane digest'),
				reproducesTrancheOneBaseline: flag(
					baseline.reproducesTrancheOneBaseline,
					're-run baseline reproduction',
				),
				fileCount: count(baseline.fileCount, 're-run baseline file count'),
				digestScheme: text(digestScheme.scheme, 're-run digest scheme'),
			},
			migrated: {
				outcome: 'red',
				command: text(migrated.command, 're-run migrated command'),
				node: text(targetCell.node, 're-run target node'),
				vite: text(targetCell.vite, 're-run target vite'),
				bundler: text(targetCell.bundler, 're-run target bundler'),
				attempts: count(migrated.attempts, 're-run migrated attempts'),
				stableAcrossAttempts: true,
				exitCode: count(migrated.exitCode, 're-run migrated exit code'),
				modulesTransformedBeforeFailure: rerunModules,
				failurePhase: text(migrated.failurePhase, 're-run failure phase'),
				demands,
				outputProduced: false,
			},
		},
		identityProof: {
			statement: text(migrated.stableAcrossAttemptsNote, 're-run identity statement'),
			baselineAttempts: count(baseline.builds, 're-run baseline builds'),
			baselineDigestsIdentical: first.digest === second.digest,
			migratedAttempts: count(migrated.attempts, 're-run migrated attempts'),
			migratedDemandsIdentical: flag(migrated.stableAcrossAttempts, 're-run migrated stability'),
			demandDigest: sha256(canonicalize(demands)),
		},
		finding: {
			missingCapability: HOLDOUT_REACT_CYPRESS_RWA_RERUN_MISSING_CAPABILITY,
			verdict: text(finding.verdict, 're-run finding verdict'),
			statement: text(finding.statement, 're-run finding statement'),
			exactDemand: {
				code: text(exactDemand.code, 're-run exact demand code'),
				module: text(exactDemand.module, 're-run exact demand module'),
				importer: text(exactDemand.importer, 're-run exact demand importer'),
				line: count(exactDemand.line, 're-run exact demand line'),
				column: count(exactDemand.column, 're-run exact demand column'),
				construct: text(exactDemand.construct, 're-run exact demand construct'),
				symbol: text(exactDemand.symbol, 're-run exact demand symbol'),
				compilerText: text(exactDemand.compilerText, 're-run exact demand compiler text'),
			},
			offendingFile: {
				path: text(offending.path, 're-run offending path'),
				package: text(offending.package, 're-run offending package'),
				bytes: count(offending.bytes, 're-run offending byte length'),
				sha256: text(offending.sha256, 're-run offending digest'),
				exportsTheDemandedName: false,
				note: text(offending.note, 're-run offending note'),
			},
			importerFile: {
				path: text(importerFile.path, 're-run importer path'),
				bytes: count(importerFile.bytes, 're-run importer byte length'),
				sha256: text(importerFile.sha256, 're-run importer digest'),
			},
			scopeOfDefect: {
				danglingImportFilesInEsBuild: count(
					scope.danglingBpfrptImportFilesInEsBuild,
					're-run defect scope',
				),
				note: text(scope.note, 're-run defect scope note'),
			},
			reachedFromApplicationCode: {
				importer: text(reached.importer, 're-run application importer'),
				construct: text(reached.construct, 're-run application construct'),
				note: text(reached.note, 're-run application importer note'),
			},
			whyThisIsNotAnAdapterBug: text(finding.whyThisIsNotAnAdapterBug, 're-run adapter reasoning'),
			actionTaken: text(finding.actionTaken, 're-run action taken'),
		},
		observedButNotFatal: {
			externalizedNodeCoreModules: array(
				observed.externalizedNodeCoreModules,
				're-run externalized modules',
			).map((value) => {
				const entry = record(value, 're-run externalized module');
				return {
					module: text(entry.module, 're-run externalized module name'),
					importer: text(entry.importer, 're-run externalized module importer'),
				};
			}),
			note: text(observed.note, 're-run externalized module note'),
		},
		applicationInfluence: {
			handEditedSourceFiles: array(
				changed.handEditedSourceFiles,
				're-run hand-edited source files',
			).map((value) => text(value, 're-run hand-edited source file')),
			applicationFilesChanged: 0,
			adapterBytesChanged: 0,
			attestation:
				'The holdout influenced nothing. Zero adapter bytes changed and zero application source files were hand-edited; the red build was recorded, not repaired.',
		},
		parity: {
			comparable: false,
			reason: text(parity.reason, 're-run parity reason'),
			declaredDifferences: array(parity.declaredDifferences, 're-run declared differences').map(
				(value) => text(value, 're-run declared difference'),
			),
		},
		nonclaims: array(parity.nonClaims, 're-run non-claims').map((value) =>
			text(value, 're-run non-claim'),
		),
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	if (
		count(changed.count, 're-run application files changed') !== 0 ||
		receipt.applicationInfluence.handEditedSourceFiles.length !== 0 ||
		flag(parity.comparable, 're-run parity comparability') !== false ||
		receipt.lanes.migrated.demands.length === 0 ||
		receipt.nonclaims.length === 0
	)
		throw new Error('Cypress RWA holdout re-run influence or parity evidence differs');
	receipt.integrity.canonicalDigest = holdoutReactCypressRwaRerunDigest(receipt);
	return receipt;
}

export function parseHoldoutReactCypressRwaRerunReceipt(
	value: unknown,
): HoldoutReactCypressRwaRerunReceipt {
	const receipt = record(value, 're-run receipt') as unknown as HoldoutReactCypressRwaRerunReceipt;
	if (
		receipt.schemaVersion !== HOLDOUT_REACT_CYPRESS_RWA_RERUN_SCHEMA ||
		receipt.role !== 'holdout' ||
		receipt.holdoutOutcome !== 'failed' ||
		receipt.reason !== HOLDOUT_REACT_CYPRESS_RWA_RERUN_MISSING_CAPABILITY ||
		receipt.unit !== HOLDOUT_REACT_CYPRESS_RWA_RERUN_UNIT ||
		receipt.fixture !== HOLDOUT_REACT_CYPRESS_RWA_FIXTURE ||
		receipt.application !== HOLDOUT_REACT_CYPRESS_RWA_APPLICATION ||
		receipt.framework !== 'react'
	)
		throw new Error('Cypress RWA holdout re-run identity differs');
	if (
		receipt.supersedes?.receipt !== HOLDOUT_REACT_CYPRESS_RWA_RERUN_SUPERSEDED_RECEIPT_PATH ||
		receipt.supersedes.receiptDigest !== HOLDOUT_REACT_CYPRESS_RWA_RERUN_SUPERSEDED_DIGEST ||
		receipt.supersedes.priorGapNowHandled !== true
	)
		throw new Error('Cypress RWA holdout re-run supersession differs');
	if (
		receipt.frozenAdapter?.compositeFingerprint !==
			HOLDOUT_REACT_CYPRESS_RWA_RERUN_FROZEN_FINGERPRINT ||
		receipt.frozenAdapter.bytesChanged !== 0 ||
		receipt.frozenAdapter.changesProposedAndExecuted !== 0 ||
		receipt.frozenAdapter.redBuildPatchedAround !== false ||
		receipt.frozenAdapter.harnessBranchedOnHoldoutIdentity !== false ||
		receipt.frozenAdapter.recomputedByThisUnit !== true ||
		receipt.frozenAdapter.subtrees.length !== 5
	)
		throw new Error('Cypress RWA holdout re-run freeze binding differs');
	if (
		receipt.capabilityAdvance?.nowHandledByFrozenCapability !== true ||
		receipt.capabilityAdvance.modulesTransformedRerun <=
			receipt.capabilityAdvance.modulesTransformedTrancheOne
	)
		throw new Error('Cypress RWA holdout re-run capability advance differs');
	if (
		receipt.lanes?.baseline?.outcome !== 'green' ||
		receipt.lanes.baseline.builds !== 2 ||
		receipt.lanes.baseline.byteStableAcrossRebuilds !== true ||
		receipt.lanes.baseline.laneDigest !== receipt.lanes.baseline.secondLaneDigest ||
		receipt.lanes.baseline.reproducesTrancheOneBaseline !== true ||
		!sha256Hex.test(receipt.lanes.baseline.laneDigest) ||
		receipt.lanes.migrated?.outcome !== 'red' ||
		receipt.lanes.migrated.attempts !== 2 ||
		receipt.lanes.migrated.stableAcrossAttempts !== true ||
		receipt.lanes.migrated.outputProduced !== false ||
		receipt.lanes.migrated.demands.length === 0
	)
		throw new Error('Cypress RWA holdout re-run lane evidence differs');
	if (
		receipt.identityProof?.baselineAttempts !== 2 ||
		receipt.identityProof.migratedAttempts !== 2 ||
		receipt.identityProof.baselineDigestsIdentical !== true ||
		receipt.identityProof.migratedDemandsIdentical !== true ||
		receipt.identityProof.demandDigest !== sha256(canonicalize(receipt.lanes.migrated.demands))
	)
		throw new Error('Cypress RWA holdout re-run two-attempt identity proof differs');
	if (
		receipt.finding?.missingCapability !== HOLDOUT_REACT_CYPRESS_RWA_RERUN_MISSING_CAPABILITY ||
		receipt.finding.exactDemand.code !== 'MISSING_EXPORT' ||
		receipt.finding.offendingFile.exportsTheDemandedName !== false ||
		!sha256Hex.test(receipt.finding.offendingFile.sha256) ||
		receipt.applicationInfluence?.applicationFilesChanged !== 0 ||
		receipt.applicationInfluence.adapterBytesChanged !== 0 ||
		receipt.applicationInfluence.handEditedSourceFiles.length !== 0 ||
		receipt.parity?.comparable !== false ||
		!Array.isArray(receipt.nonclaims) ||
		receipt.nonclaims.length === 0
	)
		throw new Error('Cypress RWA holdout re-run finding or non-claims differ');
	if (
		receipt.integrity?.algorithm !== 'sha256' ||
		!sha256Hex.test(receipt.integrity.canonicalDigest) ||
		receipt.integrity.canonicalDigest !== holdoutReactCypressRwaRerunDigest(receipt)
	)
		throw new Error('Cypress RWA holdout re-run integrity differs');
	return receipt;
}

export function renderHoldoutReactCypressRwaRerunReceipt(
	receipt: HoldoutReactCypressRwaRerunReceipt,
): string {
	const demand = receipt.finding.exactDemand;
	const advance = receipt.capabilityAdvance;
	return `# cypress-realworld-app — holdout re-run falsification receipt

- Outcome: **${receipt.holdoutOutcome}** — the frozen adapter does not yet carry this application at this revision
- Recorded reason: missing generic capability — **${receipt.reason}**
- Canonical SHA-256: ${receipt.integrity.canonicalDigest}
- Unit: \`${receipt.unit}\`
- Supersedes by reference: \`${receipt.supersedes.unit}\` (\`${receipt.supersedes.receipt}\`, digest \`${receipt.supersedes.receiptDigest}\`) — the tranche-one FAIL stays immutable
- Source: ${receipt.source.repository} at \`${receipt.source.ref}\` (\`${receipt.source.revision}\`, ${receipt.source.license}), create-react-app ${receipt.source.reactScripts} over webpack ${receipt.source.webpack}, React ${receipt.source.react}, TypeScript ${receipt.source.typescript}
- Frozen adapter fingerprint: \`${receipt.frozenAdapter.compositeFingerprint}\` over ${receipt.frozenAdapter.subtrees.length} subtrees, recomputed by this unit; adapter bytes changed: ${receipt.frozenAdapter.bytesChanged}; adapter changes proposed and executed: ${receipt.frozenAdapter.changesProposedAndExecuted}
- Derived from committed run evidence: ${receipt.runEvidence.map((item) => `\`${item.path}\` (\`${item.sha256}\`)`).join(', ')}

## The tranche-one blocker is now handled

The tranche-one attempt failed on **${receipt.supersedes.priorReason}**. That gap is closed: ${advance.frozenCapability}. ${advance.evidence} Module count advanced from ${advance.modulesTransformedTrancheOne} to ${advance.modulesTransformedRerun}.

## Both lanes

- Shared closure: ${receipt.lanes.sharedClosure.statement}
- Baseline (${receipt.lanes.baseline.command}, Node ${receipt.lanes.baseline.node} declared by ${receipt.lanes.baseline.declaredBy.join(' and ')}): **${receipt.lanes.baseline.outcome}**, built ${receipt.lanes.baseline.builds}x byte-stable, ${receipt.lanes.baseline.fileCount} files, lane digest \`${receipt.lanes.baseline.laneDigest}\` under ${receipt.lanes.baseline.digestScheme} — reproduces the tranche-one baseline
- Migrated (${receipt.lanes.migrated.command}, Node ${receipt.lanes.migrated.node}, Vite ${receipt.lanes.migrated.vite}, ${receipt.lanes.migrated.bundler}): **${receipt.lanes.migrated.outcome}**, ${receipt.lanes.migrated.attempts} attempts, exit ${receipt.lanes.migrated.exitCode} after ${receipt.lanes.migrated.modulesTransformedBeforeFailure} transformed modules, failing at ${receipt.lanes.migrated.failurePhase}; no JavaScript output produced
- Two-attempt identity proof: ${receipt.identityProof.statement} Demand multiset digest \`${receipt.identityProof.demandDigest}\`.

## The new finding

**Missing capability: ${receipt.finding.missingCapability}.**

${receipt.finding.statement}

- Exact demand: \`${demand.code}\` — ${demand.compilerText}
- At \`${demand.importer}:${demand.line}:${demand.column}\`: \`${demand.construct}\`
- Offending module: \`${receipt.finding.offendingFile.path}\` (${receipt.finding.offendingFile.package}, ${receipt.finding.offendingFile.bytes} bytes, sha256 \`${receipt.finding.offendingFile.sha256}\`) — exports the demanded name: ${receipt.finding.offendingFile.exportsTheDemandedName}
- Scope: ${receipt.finding.scopeOfDefect.danglingImportFilesInEsBuild} files across the ES build carry the same dangling import pattern
- Reached from application code: \`${receipt.finding.reachedFromApplicationCode.importer}\` — \`${receipt.finding.reachedFromApplicationCode.construct}\`

**Why this is not an adapter bug.** ${receipt.finding.whyThisIsNotAnAdapterBug}

Action taken: ${receipt.finding.actionTaken}

## Influence, parity, and non-claims

${receipt.applicationInfluence.attestation} Application files changed: ${receipt.applicationInfluence.applicationFilesChanged}. Adapter bytes changed: ${receipt.applicationInfluence.adapterBytesChanged}.

Observed but not fatal: ${receipt.observedButNotFatal.externalizedNodeCoreModules.map((item) => `\`${item.module}\` for \`${item.importer}\``).join(', ')}. ${receipt.observedButNotFatal.note}

${receipt.parity.reason}

${receipt.nonclaims.map((claim) => `- ${claim}`).join('\n')}
`;
}

/**
 * The corpus record for the re-run. Like the tranche-one holdout it is never a
 * lineage counting cell: a holdout that failed is evidence about the adapter,
 * not a migrated application. `countedInLineageNumerator` is false and stays
 * false. It supersedes the tranche-one record by reference and is published
 * rather than dropped.
 */
export function holdoutReactCypressRwaRerunCorpusRecord(
	receipt: HoldoutReactCypressRwaRerunReceipt,
) {
	return {
		id: 'holdout-react-cypress-rwa-rerun',
		application: receipt.application,
		framework: receipt.framework,
		lineage: 'react',
		role: 'holdout',
		attempted: true,
		outcome: receipt.holdoutOutcome,
		reason: receipt.reason,
		verdict: receipt.finding.verdict,
		supersedes: receipt.supersedes.receipt,
		supersededDigest: receipt.supersedes.receiptDigest,
		priorGapNowHandled: receipt.supersedes.priorGapNowHandled,
		frozenAdapterFingerprint: receipt.frozenAdapter.compositeFingerprint,
		adapterBytesChanged: receipt.frozenAdapter.bytesChanged,
		baselineLane: receipt.lanes.baseline.outcome,
		migratedLane: receipt.lanes.migrated.outcome,
		attempts: receipt.lanes.migrated.attempts,
		receipt: HOLDOUT_REACT_CYPRESS_RWA_RERUN_RECEIPT_PATH,
		digest: receipt.integrity.canonicalDigest,
		countedInLineageNumerator: false,
		countingNote:
			'Never counted in any lineage numerator: no application was migrated. The record is published rather than dropped so a re-run falsification attempt cannot be hidden.',
		browserProof: 'not-tested',
	};
}

export async function verifyHoldoutReactCypressRwaRerunEvidence(rootDir = '.'): Promise<{
	valid: true;
	digest: string;
	artifacts: number;
	receipt: HoldoutReactCypressRwaRerunReceipt;
}> {
	const root = resolve(rootDir);
	const published = parseHoldoutReactCypressRwaRerunReceipt(
		JSON.parse(
			await readFile(join(root, HOLDOUT_REACT_CYPRESS_RWA_RERUN_RECEIPT_PATH), 'utf8'),
		),
	);
	const derived = await deriveHoldoutReactCypressRwaRerunReceipt(root);
	if (canonicalize(published) !== canonicalize(derived))
		throw new Error('Cypress RWA holdout re-run receipt does not match its committed run evidence');
	if (
		(await readFile(join(root, HOLDOUT_REACT_CYPRESS_RWA_RERUN_MARKDOWN_PATH), 'utf8')) !==
		renderHoldoutReactCypressRwaRerunReceipt(published)
	)
		throw new Error('Cypress RWA holdout re-run human receipt differs');
	return {
		valid: true as const,
		digest: published.integrity.canonicalDigest,
		artifacts: published.runEvidence.length,
		receipt: published,
	};
}
