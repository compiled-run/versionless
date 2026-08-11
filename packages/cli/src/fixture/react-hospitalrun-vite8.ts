import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import * as path from 'pathe';
import { canonicalize } from '../../../core/src/receipts/canonicalize.ts';

/**
 * Fixture-scoped verification for the HospitalRun create-react-app to Vite 8
 * lanes. All application knowledge lives here; the reusable capabilities it
 * exercises live in @versionless/react and stay generic.
 */

const root = path.resolve(import.meta.dirname, '../../../..');
const evidenceRoot = path.join(root, 'evidence/runs/react-hospitalrun');
const reactAdapterRoot = path.join(root, 'packages/frameworks/react/src');

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

export type HospitalRunBuildLane = Readonly<{
	digest: string;
	files: ReadonlyArray<Readonly<{ path: string; sha256: string }>>;
}>;
export type HospitalRunBoot = Readonly<{
	result: string;
	rootElementBytes: number;
	documentTitle: string;
	headingText: string;
	pageErrors: readonly string[];
	consoleErrors: Readonly<{
		known: Readonly<Record<string, number>>;
		unexpected: readonly string[];
	}>;
	failedRequests: readonly string[];
	successfulNonLoopback: readonly string[];
	booted: boolean;
}>;
export type HospitalRunBuild = Readonly<{
	bundler: string;
	runtime: string;
	equal: boolean;
	first: HospitalRunBuildLane;
	second: HospitalRunBuildLane;
	boot: HospitalRunBoot;
	serviceWorkerOutputs: readonly string[];
	sloppyCommonJsImplicitGlobals?: ReadonlyArray<
		Readonly<{ module: string; names: readonly string[] }>
	>;
}>;
export type HospitalRunRuntimeBreak = Readonly<{
	order: number;
	symptom: string;
	cause: string;
	genericFix: string;
	landedIn: string;
	caughtBy: string;
}>;
export type HospitalRunCompatibilityPin = Readonly<{
	name: string;
	version: string;
	published: string;
	reason: string;
	tarball: string;
	tarballSha256: string;
}>;
export type HospitalRunBuildProfile = Readonly<{
	schemaVersion: string;
	result: string;
	fixture: string;
	digest: Readonly<{
		scheme: string;
		note: string;
		supersedes: Readonly<Record<string, string>>;
	}>;
	runtimeBreaks: readonly HospitalRunRuntimeBreak[];
	dependencyAcquisition: Readonly<{
		consentId: string;
		mode: string;
		registryHosts: readonly string[];
		lockfile: null;
		compatibilityResolution: Readonly<{
			label: string;
			cutoff: string;
			packagesPinned: number;
			pins: readonly HospitalRunCompatibilityPin[];
		}>;
	}>;
	builds: Readonly<{ baseline: HospitalRunBuild; target: HospitalRunBuild }>;
	parity: Readonly<{
		level: string;
		behavioral: string;
		journeys: string;
		runtimeEquivalence: string;
		boot: Readonly<{
			baseline: string;
			target: string;
			rootElementBytesEqual: boolean;
			rootElementBytes: number;
			documentTitleEqual: boolean;
			headingTextEqual: boolean;
		}>;
		inventory: Readonly<{
			baselineOnlyPaths: readonly string[];
			targetOnlyPaths: readonly string[];
			sharedPaths: readonly string[];
			byteIdenticalSharedPaths: readonly string[];
		}>;
	}>;
	gates: Readonly<Record<string, string>>;
	integrity: Readonly<{ algorithm: string; canonicalDigest: string }>;
}>;

export type HospitalRunBuildProfileVerification = Readonly<{
	result: 'pass';
	fixture: string;
	baselineDeterministic: boolean;
	targetDeterministic: boolean;
	baselineBooted: boolean;
	targetBooted: boolean;
	baselineFiles: number;
	targetFiles: number;
	compatibilityPins: number;
	runtimeBreaks: number;
	reproducibleLaneDigests: number;
	canonicalDigest: string;
	applicationNamedProductSymbols: readonly string[];
}>;

/**
 * The digest scheme the profile declares, recomputed rather than trusted: a
 * lane digest must be sha256 over the canonicalized file list recorded beside
 * it, or the record is not reproducible from itself and the claim is void.
 */
export function laneDigestIsReproducible(lane: HospitalRunBuildLane): boolean {
	return sha256(canonicalize(lane.files)) === lane.digest;
}

/**
 * The application identity must never leak into the reusable React product
 * surface. Anything that names this application there is a scope violation,
 * so the fixture asserts its own absence.
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

export async function readHospitalRunBuildProfile(): Promise<HospitalRunBuildProfile> {
	const body = await readFile(path.join(evidenceRoot, 'build-profile.json'), 'utf8');
	const profile = JSON.parse(body) as HospitalRunBuildProfile;
	const { integrity, ...unsigned } = profile;
	if (sha256(canonicalize(unsigned)) !== integrity.canonicalDigest)
		throw new Error('HospitalRun build profile canonical digest differs');
	return profile;
}

/**
 * Every compatibility pin must be an era pin: published on or before the
 * declared cutoff, and carrying the reason it was needed.
 */
export function eraPinViolations(
	pins: readonly HospitalRunCompatibilityPin[],
	cutoff: string,
): readonly string[] {
	const limit = Date.parse(cutoff);
	return pins
		.filter(
			(pin) =>
				!(Date.parse(pin.published) <= limit) ||
				pin.reason.length === 0 ||
				pin.version.length === 0,
		)
		.map((pin) => `${pin.name}@${pin.version}`);
}

export async function verifyHospitalRunBuildProfile(): Promise<HospitalRunBuildProfileVerification> {
	const profile = await readHospitalRunBuildProfile();
	const { baseline, target } = profile.builds;
	if (!baseline.equal || baseline.first.digest !== baseline.second.digest)
		throw new Error('HospitalRun baseline builds are not deterministic');
	if (!target.equal || target.first.digest !== target.second.digest)
		throw new Error('HospitalRun target builds are not deterministic');
	// The digest scheme is recomputed from the record, never taken on trust: this
	// is the defect the superseded receipt carried, and the reason it was replaced.
	if (profile.digest.scheme !== 'sha256(canonicalize(files))')
		throw new Error('HospitalRun build profile declares an unexpected lane digest scheme');
	const lanes = [baseline.first, baseline.second, target.first, target.second];
	const irreproducible = lanes.filter((lane) => !laneDigestIsReproducible(lane));
	if (irreproducible.length > 0)
		throw new Error(
			`HospitalRun lane digests are not reproducible from their own file lists: ${irreproducible
				.map((lane) => lane.digest)
				.join(', ')}`,
		);
	// Boot is proven for both lanes, and nothing beyond boot may be claimed.
	for (const [name, build] of [
		['baseline', baseline],
		['target', target],
	] as const) {
		if (!build.boot.booted || build.boot.result !== 'boot')
			throw new Error(`HospitalRun ${name} lane does not record a proven boot`);
		if (build.boot.rootElementBytes <= 0)
			throw new Error(`HospitalRun ${name} lane booted with an empty root element`);
		if (
			build.boot.pageErrors.length > 0 ||
			build.boot.consoleErrors.unexpected.length > 0 ||
			build.boot.failedRequests.length > 0 ||
			build.boot.successfulNonLoopback.length > 0
		)
			throw new Error(`HospitalRun ${name} lane boot is not clean`);
	}
	// The migrated lane is the one that had to be silent: every console error the
	// baseline raises is a create-react-app service-worker artefact the target
	// does not emit at all.
	if (Object.keys(target.boot.consoleErrors.known).length > 0)
		throw new Error('HospitalRun target lane must boot with no console errors at all');
	if (profile.parity.behavioral !== 'boot-only' || profile.parity.journeys !== 'not-tested')
		throw new Error('HospitalRun build profile claims parity beyond the observed boot');
	if (profile.parity.runtimeEquivalence !== 'unknown')
		throw new Error(
			'HospitalRun build profile claims runtime equivalence it did not establish',
		);
	for (const gate of ['directWitnessJourneys', 'mutationRestoration'])
		if (profile.gates[gate] !== 'not-run')
			throw new Error(`HospitalRun gate ${gate} must remain not-run until the Witness unit`);
	// The caught-breaks history is part of the record and may not be erased.
	if (profile.runtimeBreaks.length < 3)
		throw new Error('HospitalRun build profile must keep every runtime break the gate caught');
	for (const [index, entry] of profile.runtimeBreaks.entries()) {
		if (entry.order !== index + 1)
			throw new Error(
				'HospitalRun runtime breaks are not recorded in the order they surfaced',
			);
		if (entry.symptom.length === 0 || entry.cause.length === 0 || entry.genericFix.length === 0)
			throw new Error(`HospitalRun runtime break ${entry.order} is missing its account`);
	}
	if (profile.gates.baselineAuthenticity !== 'compatibility-labeled-not-authentic')
		throw new Error('HospitalRun baseline must stay labeled as a compatibility resolution');
	const { compatibilityResolution } = profile.dependencyAcquisition;
	const violations = eraPinViolations(
		compatibilityResolution.pins,
		compatibilityResolution.cutoff,
	);
	if (violations.length > 0)
		throw new Error(
			`HospitalRun compatibility pins are not era pins: ${violations.join(', ')}`,
		);
	if (compatibilityResolution.pins.length !== compatibilityResolution.packagesPinned)
		throw new Error('HospitalRun compatibility pin count differs from the recorded pins');
	const offenders = await applicationNamedProductSymbols('hospitalrun');
	if (offenders.length > 0)
		throw new Error(`Reusable React surface names the application: ${offenders.join(', ')}`);
	return {
		result: 'pass',
		fixture: profile.fixture,
		baselineDeterministic: baseline.equal,
		targetDeterministic: target.equal,
		baselineBooted: baseline.boot.booted,
		targetBooted: target.boot.booted,
		runtimeBreaks: profile.runtimeBreaks.length,
		reproducibleLaneDigests: lanes.length,
		baselineFiles: baseline.first.files.length,
		targetFiles: target.first.files.length,
		compatibilityPins: compatibilityResolution.pins.length,
		canonicalDigest: profile.integrity.canonicalDigest,
		applicationNamedProductSymbols: offenders,
	};
}
