import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import * as path from 'pathe';
import { canonicalize } from '../../../core/src/receipts/canonicalize.ts';

/**
 * Fixture-scoped verification for the papercups create-react-app to Vite 8
 * build-stage lane. All application knowledge lives here; the reusable
 * capabilities it exercises live in @versionless/react and stay generic.
 */

const root = path.resolve(import.meta.dirname, '../../../..');
const evidenceRoot = path.join(root, 'evidence/runs/react-papercups-v1-0-0');
const reactAdapterRoot = path.join(root, 'packages/frameworks/react/src');

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

export type BuildProfileLane = Readonly<{
	digest: string;
	files: ReadonlyArray<Readonly<{ path: string; sha256: string }>>;
}>;
export type BuildProfileBuild = Readonly<{
	bundler: string;
	runtime: string;
	equal: boolean;
	first: BuildProfileLane;
	second: BuildProfileLane;
}>;
export type PapercupsBuildProfile = Readonly<{
	schemaVersion: string;
	result: string;
	fixture: string;
	builds: Readonly<{ baseline: BuildProfileBuild; target: BuildProfileBuild }>;
	parity: Readonly<{ behavioral: string; journeys: string; runtimeEquivalence: string }>;
	gates: Readonly<Record<string, string>>;
	integrity: Readonly<{ algorithm: string; canonicalDigest: string }>;
}>;

export type PapercupsBuildProfileVerification = Readonly<{
	result: 'pass';
	fixture: string;
	baselineDeterministic: boolean;
	targetDeterministic: boolean;
	baselineFiles: number;
	targetFiles: number;
	canonicalDigest: string;
	applicationNamedProductSymbols: readonly string[];
}>;

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

export async function readPapercupsBuildProfile(): Promise<PapercupsBuildProfile> {
	const body = await readFile(path.join(evidenceRoot, 'build-profile.json'), 'utf8');
	const profile = JSON.parse(body) as PapercupsBuildProfile;
	const { integrity, ...unsigned } = profile;
	if (sha256(canonicalize(unsigned)) !== integrity.canonicalDigest)
		throw new Error('Papercups build profile canonical digest differs');
	return profile;
}

export async function verifyPapercupsBuildProfile(): Promise<PapercupsBuildProfileVerification> {
	const profile = await readPapercupsBuildProfile();
	const { baseline, target } = profile.builds;
	if (!baseline.equal || baseline.first.digest !== baseline.second.digest)
		throw new Error('Papercups baseline builds are not deterministic');
	if (!target.equal || target.first.digest !== target.second.digest)
		throw new Error('Papercups target builds are not deterministic');
	if (profile.parity.behavioral !== 'not-tested' || profile.parity.journeys !== 'not-tested')
		throw new Error('Papercups build profile claims untested behavioral parity');
	for (const gate of ['realServer', 'directWitnessJourneys', 'browserLocality'])
		if (profile.gates[gate] !== 'not-run')
			throw new Error(`Papercups browser gate ${gate} must remain not-run at build stage`);
	const offenders = await applicationNamedProductSymbols('papercups');
	if (offenders.length > 0)
		throw new Error(`Reusable React surface names the application: ${offenders.join(', ')}`);
	return {
		result: 'pass',
		fixture: profile.fixture,
		baselineDeterministic: baseline.equal,
		targetDeterministic: target.equal,
		baselineFiles: baseline.first.files.length,
		targetFiles: target.first.files.length,
		canonicalDigest: profile.integrity.canonicalDigest,
		applicationNamedProductSymbols: offenders,
	};
}
