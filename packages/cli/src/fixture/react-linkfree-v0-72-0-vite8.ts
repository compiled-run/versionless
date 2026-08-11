import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { canonicalize } from '../../../core/src/receipts/canonicalize.ts';

/**
 * Fixture-scoped verification for this application's create-react-app 5 to
 * Vite 8 build lanes. All application knowledge lives here; the reusable
 * capabilities it exercises live in @versionless/react and stay generic.
 */

const root = path.resolve(import.meta.dirname, '../../../..');
const evidenceRoot = path.join(root, 'evidence/runs/react-linkfree-v0-72-0');
const reactAdapterRoot = path.join(root, 'packages/frameworks/react/src');

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

export type CorpusAggregate = Readonly<{
	directory: string;
	files: number;
	aggregateSha256: string;
	note: string;
}>;
export type BuildProfileLane = Readonly<{
	digest: string;
	files: ReadonlyArray<Readonly<{ path: string; sha256: string }>>;
	corpus: CorpusAggregate;
}>;
export type BuildProfileBuild = Readonly<{
	bundler: string;
	runtime: string;
	command: string;
	equal: boolean;
	first: BuildProfileLane;
	second: BuildProfileLane;
	applicationSourceEdits?: number;
	applicationFilesChanged?: ReadonlyArray<Readonly<{ path: string; sha256: string }>>;
	byteStable?: boolean;
	adapterCapabilities?: readonly string[];
}>;
export type CssPurgeMeasurement = Readonly<{
	lane: string;
	stylesheets: readonly string[];
	bytesBeforePurge: number;
	bytesAfterPurge: number;
	reductionPercent: number;
	shipped: boolean;
}>;
export type CapabilityContribution = Readonly<{
	capability: string;
	fired: boolean;
	what: string;
}>;
export type RuntimeBreak = Readonly<{
	order: number;
	symptom: string;
	cause: string;
	genericFix: string;
	landedIn: string;
	caughtBy: string;
}>;
export type LinkfreeBuildProfile = Readonly<{
	schemaVersion: string;
	result: string;
	fixture: string;
	digest: Readonly<{ scheme: string; note: string }>;
	dependencyAcquisition: Readonly<{
		mode: string;
		networkDuringThisUnit: string;
		closureInstalledByThisUnit: boolean;
	}>;
	builds: Readonly<{ baseline: BuildProfileBuild; target: BuildProfileBuild }>;
	declaredBuildSteps: Readonly<{
		codegenPrebuild: Readonly<{
			migratedLaneRunsIt: boolean;
			emittedSha256: string;
		}>;
		postbuildCssPurge: Readonly<{
			migratedLaneRunsIt: boolean;
			decision: string;
			reasoning: readonly string[];
			measuredBothWays: readonly CssPurgeMeasurement[];
			baselinePurgeAgreesWithShippedLane: boolean;
			shippedCssBytes: Readonly<{ baseline: number; target: number }>;
		}>;
	}>;
	capabilities: Readonly<{
		measured: Readonly<{
			sloppyCommonJsImplicitGlobals: readonly unknown[];
			nonUtf8DecodedModules: readonly unknown[];
		}>;
		contribution: readonly CapabilityContribution[];
	}>;
	runtimeBreaks: readonly RuntimeBreak[];
	parity: Readonly<{
		level: string;
		behavioral: string;
		journeys: string;
		runtimeEquivalence: string;
		entryHtml: Readonly<{ equal: boolean; baselineBytes: number; targetBytes: number }>;
		inventory: Readonly<{
			baselineFiles: number;
			targetFiles: number;
			baselineOnlyPaths: readonly string[];
			targetOnlyPaths: readonly string[];
			sharedPaths: readonly string[];
			byteIdenticalSharedPaths: readonly string[];
		}>;
	}>;
	witnessPhaseFacts: Readonly<{
		runtimeEgressCascade: string;
		buildTimeEgress: string;
		profileCorpus: string;
		corpusInThisRecord: Readonly<{ profileDataFilesCopiedIntoBuild: number }>;
	}>;
	gates: Readonly<Record<string, string>>;
	nonclaims: readonly string[];
	integrity: Readonly<{ algorithm: string; canonicalDigest: string }>;
}>;

export type LinkfreeBuildProfileVerification = Readonly<{
	result: 'pass';
	fixture: string;
	baselineByteStable: boolean;
	targetDeterministic: boolean;
	baselineFiles: number;
	targetFiles: number;
	byteIdenticalSharedPaths: number;
	runtimeBreaks: number;
	reproducibleLaneDigests: number;
	canonicalDigest: string;
	applicationNamedProductSymbols: readonly string[];
}>;

/**
 * The digest scheme the profile declares, recomputed rather than trusted: a lane
 * digest must be sha256 over the canonicalized file list recorded beside it, or
 * the record is not reproducible from itself and the claim is void.
 */
export function laneDigestIsReproducible(lane: BuildProfileLane): boolean {
	return sha256(canonicalize({ corpus: lane.corpus, files: lane.files })) === lane.digest;
}

/**
 * The profile corpus is real contributors' personal data, and the ingest fixed
 * that no filename from it may enter an evidence record. This is that rule
 * enforced against the published record rather than trusted: every recorded path
 * is checked, and the corpus is expected to be present only as an aggregate.
 */
export function corpusPathsLeakedIntoRecord(profile: LinkfreeBuildProfile): readonly string[] {
	const recorded = [
		...profile.builds.baseline.first.files,
		...profile.builds.baseline.second.files,
		...profile.builds.target.first.files,
		...profile.builds.target.second.files,
	].map((file) => file.path);
	const inventory = profile.parity.inventory;
	const paths = [
		...recorded,
		...inventory.baselineOnlyPaths,
		...inventory.targetOnlyPaths,
		...inventory.sharedPaths,
		...inventory.byteIdenticalSharedPaths,
	];
	const directory = profile.builds.target.first.corpus.directory;
	return paths.filter((file) => file.startsWith(directory)).sort();
}

/**
 * The application identity must never leak into the reusable React product
 * surface. Anything that names this application there is a scope violation, so
 * the fixture asserts its own absence.
 */
export async function applicationNamedProductSymbols(needle: string): Promise<readonly string[]> {
	const lowered = needle.toLowerCase();
	const offenders: string[] = [];
	for (const entry of await readdir(reactAdapterRoot, { withFileTypes: true })) {
		if (!entry.isFile()) continue;
		const source = await readFile(path.join(reactAdapterRoot, entry.name), 'utf8');
		if (source.toLowerCase().includes(lowered)) offenders.push(entry.name);
	}
	return offenders.sort();
}

export async function readLinkfreeBuildProfile(): Promise<LinkfreeBuildProfile> {
	const body = await readFile(path.join(evidenceRoot, 'build-profile.json'), 'utf8');
	const profile = JSON.parse(body) as LinkfreeBuildProfile;
	const { integrity, ...unsigned } = profile;
	if (sha256(canonicalize(unsigned)) !== integrity.canonicalDigest)
		throw new Error('LinkFree build profile canonical digest differs');
	return profile;
}

/**
 * A declared difference is only a declared difference when it is measured. The
 * purge decision must carry a measurement of BOTH lanes, and the baseline
 * measurement must agree with the stylesheet the baseline lane actually ships —
 * otherwise the measurement describes a retargeted approximation rather than the
 * application's own declared step.
 */
export function purgeDecisionIsMeasured(profile: LinkfreeBuildProfile): boolean {
	const purge = profile.declaredBuildSteps.postbuildCssPurge;
	const lanes = purge.measuredBothWays.map((measurement) => measurement.lane).sort();
	if (lanes.length !== 2 || lanes[0] !== 'baseline' || lanes[1] !== 'target') return false;
	if (!purge.baselinePurgeAgreesWithShippedLane) return false;
	const baselineMeasurement = purge.measuredBothWays.find(
		(measurement) => measurement.lane === 'baseline',
	);
	const targetMeasurement = purge.measuredBothWays.find(
		(measurement) => measurement.lane === 'target',
	);
	if (baselineMeasurement === undefined || targetMeasurement === undefined) return false;
	// The shipped figures must be the ones the measurements imply: the baseline
	// ships what the purge produced, the migrated lane ships what preceded it.
	if (purge.shippedCssBytes.baseline !== baselineMeasurement.bytesAfterPurge) return false;
	if (purge.shippedCssBytes.target !== targetMeasurement.bytesBeforePurge) return false;
	return purge.measuredBothWays.every(
		(measurement) =>
			measurement.bytesBeforePurge > measurement.bytesAfterPurge &&
			measurement.bytesAfterPurge > 0 &&
			!measurement.shipped,
	);
}

/**
 * A capability whose contribution is recorded as fired must have something to
 * show for it, and a capability recorded as inert must have an empty observation
 * behind it. This is what keeps "composed the whole adapter" from turning into a
 * claim that every capability was exercised.
 */
export function capabilityContributionsAgreeWithObservations(
	profile: LinkfreeBuildProfile,
): boolean {
	const { measured, contribution } = profile.capabilities;
	const byName = new Map(contribution.map((entry) => [entry.capability, entry.fired]));
	if (byName.get('createCraSloppyCommonJsGlobalsPlugin') !== (measured.sloppyCommonJsImplicitGlobals.length > 0))
		return false;
	if (byName.get('createCraNonUtf8ModuleSourcePlugin') !== (measured.nonUtf8DecodedModules.length > 0))
		return false;
	return byName.get('createCraJavaScriptJsxPlugin') === true;
}

export async function verifyLinkfreeBuildProfile(): Promise<LinkfreeBuildProfileVerification> {
	const profile = await readLinkfreeBuildProfile();
	const { baseline, target } = profile.builds;
	if (!baseline.equal || baseline.first.digest !== baseline.second.digest)
		throw new Error('LinkFree baseline rebuilds are not byte-stable');
	if (!target.equal || target.first.digest !== target.second.digest)
		throw new Error('LinkFree target builds are not deterministic');
	if (profile.digest.scheme !== 'sha256(canonicalize({corpus, files}))')
		throw new Error('LinkFree build profile declares an unexpected lane digest scheme');
	const lanes = [baseline.first, baseline.second, target.first, target.second];
	const irreproducible = lanes.filter((lane) => !laneDigestIsReproducible(lane));
	if (irreproducible.length > 0)
		throw new Error(
			`LinkFree lane digests are not reproducible from their own file lists: ${irreproducible
				.map((lane) => lane.digest)
				.join(', ')}`,
		);
	if (target.applicationSourceEdits !== 0)
		throw new Error('LinkFree migrated lane edited application source');
	// The migrated lane runs the application's own codegen prebuild, and the
	// index it emits is load-bearing for two of the four declared journeys.
	if (!profile.declaredBuildSteps.codegenPrebuild.migratedLaneRunsIt)
		throw new Error('LinkFree migrated lane does not run the declared codegen prebuild');
	if (!purgeDecisionIsMeasured(profile))
		throw new Error('LinkFree postbuild purge decision is declared but not measured both ways');
	if (!capabilityContributionsAgreeWithObservations(profile))
		throw new Error('LinkFree capability contributions disagree with the observations recorded');
	if (
		profile.parity.level !== 'build-artifacts-only' ||
		profile.parity.behavioral !== 'not-tested' ||
		profile.parity.journeys !== 'not-tested' ||
		profile.parity.runtimeEquivalence !== 'unknown'
	)
		throw new Error('LinkFree build profile claims parity beyond the emitted artifacts');
	for (const gate of [
		'browserLocality',
		'realServer',
		'directWitnessJourneys',
		'mutationRestoration',
		'upstreamCypressSuite',
	])
		if (profile.gates[gate] !== 'not-run')
			throw new Error(`LinkFree gate ${gate} must remain not-run at build stage`);
	// The runtime-break history is part of the record and may not be erased.
	if (profile.runtimeBreaks.length < 1)
		throw new Error('LinkFree build profile must keep every runtime break the lane caught');
	for (const [index, entry] of profile.runtimeBreaks.entries())
		if (
			entry.order !== index + 1 ||
			entry.symptom.length === 0 ||
			entry.cause.length === 0 ||
			entry.genericFix.length === 0
		)
			throw new Error(`LinkFree runtime break ${String(index + 1)} is missing its account`);
	const leaked = corpusPathsLeakedIntoRecord(profile);
	if (leaked.length > 0)
		throw new Error(
			`LinkFree build profile records ${String(leaked.length)} profile-corpus paths, which the fixture's data-handling rule forbids`,
		);
	const offenders = await applicationNamedProductSymbols('linkfree');
	if (offenders.length > 0)
		throw new Error(`Reusable React surface names the application: ${offenders.join(', ')}`);
	return {
		result: 'pass',
		fixture: profile.fixture,
		baselineByteStable: baseline.equal,
		targetDeterministic: target.equal,
		baselineFiles: baseline.first.files.length,
		targetFiles: target.first.files.length,
		byteIdenticalSharedPaths: profile.parity.inventory.byteIdenticalSharedPaths.length,
		runtimeBreaks: profile.runtimeBreaks.length,
		reproducibleLaneDigests: lanes.length,
		canonicalDigest: profile.integrity.canonicalDigest,
		applicationNamedProductSymbols: offenders,
	};
}
