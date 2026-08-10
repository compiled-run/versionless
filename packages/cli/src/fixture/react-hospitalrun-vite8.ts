import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import * as path from 'pathe';
import { canonicalize } from '../../../core/src/receipts/canonicalize.ts';

/**
 * Fixture-scoped verification for the HospitalRun create-react-app to Vite 8
 * build-stage lane. All application knowledge lives here; the reusable
 * capabilities it exercises live in @versionless/react and stay generic.
 */

const root = path.resolve(import.meta.dirname, '../../../..');
const evidenceRoot = path.join(root, 'evidence/runs/react-hospitalrun');
const reactAdapterRoot = path.join(root, 'packages/frameworks/react/src');

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

export type HospitalRunBuildLane = Readonly<{
	digest: string;
	files: ReadonlyArray<Readonly<{ path: string; sha256: string }>>;
}>;
export type HospitalRunBuild = Readonly<{
	bundler: string;
	runtime: string;
	equal: boolean;
	first: HospitalRunBuildLane;
	second: HospitalRunBuildLane;
	serviceWorkerOutputs: readonly string[];
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
		behavioral: string;
		journeys: string;
		runtimeEquivalence: string;
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
	baselineFiles: number;
	targetFiles: number;
	compatibilityPins: number;
	canonicalDigest: string;
	applicationNamedProductSymbols: readonly string[];
}>;

/**
 * The application identity must never leak into the reusable React product
 * surface. Anything that names this application there is a scope violation,
 * so the fixture asserts its own absence.
 */
export async function applicationNamedProductSymbols(
	needle: string,
): Promise<readonly string[]> {
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
	if (profile.parity.behavioral !== 'not-tested' || profile.parity.journeys !== 'not-tested')
		throw new Error('HospitalRun build profile claims untested behavioral parity');
	for (const gate of ['realServer', 'directWitnessJourneys', 'browserLocality'])
		if (profile.gates[gate] !== 'not-run')
			throw new Error(`HospitalRun browser gate ${gate} must remain not-run at build stage`);
	if (profile.gates.baselineAuthenticity !== 'compatibility-labeled-not-authentic')
		throw new Error('HospitalRun baseline must stay labeled as a compatibility resolution');
	const { compatibilityResolution } = profile.dependencyAcquisition;
	const violations = eraPinViolations(
		compatibilityResolution.pins,
		compatibilityResolution.cutoff,
	);
	if (violations.length > 0)
		throw new Error(`HospitalRun compatibility pins are not era pins: ${violations.join(', ')}`);
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
		baselineFiles: baseline.first.files.length,
		targetFiles: target.first.files.length,
		compatibilityPins: compatibilityResolution.pins.length,
		canonicalDigest: profile.integrity.canonicalDigest,
		applicationNamedProductSymbols: offenders,
	};
}
