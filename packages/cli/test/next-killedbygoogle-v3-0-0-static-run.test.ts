import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, test } from 'vitest';
import { canonicalize } from '../../core/src/receipts/canonicalize.ts';
import {
	applicationLayout,
	classifyLaneOutput,
	laneDigestScheme,
	normalizeBuildIdentifier,
	publicAssetParity,
	recordedDifferences,
	type LaneInventory,
} from '../src/fixture/next-killedbygoogle-v3-0-0-static-run.ts';

const observationFile = path.join(
	import.meta.dirname,
	'../../../evidence/runs/next-killedbygoogle-v3-0-0/t006-build-lanes.json',
);

type Lane = Readonly<{
	digest: string;
	secondDigest: string;
	deterministic: boolean;
	documents: readonly string[];
	indexDocumentBytes: number;
	inventory: readonly Readonly<{ path: string; sha256: string; bytes: number }>[];
}>;

type Observation = Readonly<{
	schemaVersion: string;
	migrationClass: string;
	laneDigestScheme: string;
	revision: string;
	eraLane: Lane &
		Readonly<{
			buildIdentifiers: readonly string[];
			deterministicModuloBuildIdentifier: boolean;
			normalizedDigest: string;
			secondNormalizedDigest: string;
		}>;
	targetLane: Lane;
	applicationFilesChanged: Readonly<{
		filesCompared: number;
		changed: readonly Readonly<{ path: string; before: string | null; after: string | null }>[];
	}>;
	frameworkLift: Readonly<{
		modulesLiftedOnDisk: readonly Readonly<{ path: string }>[];
		buildTimeGuardReport: Readonly<{
			babel: Readonly<{ jsx: Readonly<{ importSource: string | null }> }>;
			modules: readonly Readonly<{ module: string; imports: readonly unknown[] }>[];
		}>;
	}>;
	buildLevelParity: Readonly<{
		publicAssets: Readonly<{
			shared: readonly string[];
			onlyInEra: readonly string[];
			onlyInTarget: readonly string[];
			identicalBytes: readonly string[];
			differingBytes: readonly string[];
		}>;
	}>;
	recordedDifferences: readonly Readonly<{ difference: string; detail: string }>[];
	nonclaims: readonly string[];
}>;

const readObservation = async (): Promise<Observation> =>
	JSON.parse(await readFile(observationFile, 'utf8')) as Observation;

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

const digestOf = (inventory: LaneInventory): string => sha256(canonicalize(inventory.files));

describe('the killedbygoogle LEGACY-NEXT build lanes', () => {
	test('publishes both lanes under the parity schema, with the digest scheme it used', async () => {
		const observation = await readObservation();
		expect(observation.schemaVersion).toBe('versionless.legacy-build-parity.v1');
		expect(observation.migrationClass).toBe('LEGACY-NEXT');
		expect(observation.laneDigestScheme).toBe(laneDigestScheme);
		expect(observation.revision).toBe('56809c31592e6ca1edce8af9bfe842fbcdf71f4d');
	});

	test('every published lane digest recomputes from the file list recorded beside it', async () => {
		const observation = await readObservation();
		for (const lane of [observation.eraLane, observation.targetLane])
			expect(digestOf({ digest: lane.digest, files: lane.inventory })).toBe(lane.digest);
	});

	/**
	 * The era lane's red is the interesting half of this record. It is asserted
	 * rather than tolerated, so a later change that quietly made it green — by
	 * pinning a build identifier the repository never pinned, for instance —
	 * would fail here instead of being published as an improvement.
	 */
	test('reports the era lane as not byte-stable, and says exactly what moved', async () => {
		const observation = await readObservation();
		expect(observation.eraLane.deterministic).toBe(false);
		expect(observation.eraLane.digest).not.toBe(observation.eraLane.secondDigest);
		expect(observation.eraLane.buildIdentifiers).toHaveLength(2);
		expect(observation.eraLane.buildIdentifiers[0]).not.toBe(
			observation.eraLane.buildIdentifiers[1],
		);
		expect(observation.eraLane.deterministicModuloBuildIdentifier).toBe(true);
		expect(observation.eraLane.normalizedDigest).toBe(
			observation.eraLane.secondNormalizedDigest,
		);
	});

	test('reports the migrated lane as byte-stable across two builds', async () => {
		const observation = await readObservation();
		expect(observation.targetLane.deterministic).toBe(true);
		expect(observation.targetLane.digest).toBe(observation.targetLane.secondDigest);
	});

	test('records the document difference in kind rather than smoothing it over', async () => {
		const observation = await readObservation();
		expect(observation.eraLane.documents).toEqual(['404.html', 'index.html']);
		expect(observation.targetLane.documents).toEqual(['index.html']);
		// The era document carries the rendered application; the migrated one carries a mount point.
		expect(observation.eraLane.indexDocumentBytes).toBeGreaterThan(100_000);
		expect(observation.targetLane.indexDocumentBytes).toBeLessThan(1_000);
		expect(observation.recordedDifferences).toBe(observation.recordedDifferences);
		expect(observation.recordedDifferences.map((entry) => entry.difference)).toEqual(
			recordedDifferences.map((entry) => entry.difference),
		);
	});

	test('copied public assets agree byte for byte, which is the one comparable surface', async () => {
		const parity = (await readObservation()).buildLevelParity.publicAssets;
		expect(parity.onlyInEra).toEqual([]);
		expect(parity.onlyInTarget).toEqual([]);
		expect(parity.differingBytes).toEqual([]);
		expect(parity.identicalBytes).toEqual(parity.shared);
		expect(parity.shared.length).toBeGreaterThan(20);
	});

	test('counts the application files the migration changed, and names each one', async () => {
		const observation = await readObservation();
		const changed = observation.applicationFilesChanged.changed.map((entry) => entry.path);
		// Five first-party modules moved a framework import; three files are new.
		expect(changed).toContain('pages/index.tsx');
		expect(changed).toContain('pages/_app.tsx');
		expect(changed).toContain(applicationLayout.entryDocument);
		expect(changed).toContain(applicationLayout.entryModule);
		for (const entry of observation.frameworkLift.modulesLiftedOnDisk)
			expect(changed).toContain(entry.path);
		for (const entry of observation.applicationFilesChanged.changed)
			expect(entry.before === null || entry.before !== entry.after).toBe(true);
		expect(observation.applicationFilesChanged.filesCompared).toBeGreaterThan(50);
	});

	test('carries the JSX import source it read out of the application Babel configuration', async () => {
		const observation = await readObservation();
		expect(observation.frameworkLift.buildTimeGuardReport.babel.jsx.importSource).toBe(
			'@emotion/react',
		);
		// The guard runs over already-lifted source, so finding nothing is it passing.
		for (const entry of observation.frameworkLift.buildTimeGuardReport.modules)
			expect(entry.imports).toEqual([]);
	});

	test('makes no browser claim anywhere in the record', async () => {
		const observation = await readObservation();
		expect(observation.nonclaims.join(' ')).toContain('No page was loaded in a browser');
		expect(observation.nonclaims.join(' ')).toContain('single-route');
	});
});

describe('the lane classification and parity helpers', () => {
	const inventory = (
		files: readonly Readonly<{ path: string; sha256: string }>[],
	): LaneInventory => ({
		digest: 'unused',
		files: files.map((file) => ({ ...file, bytes: 1 })),
	});

	test('splits an output into documents, copied assets and bundler-named assets', () => {
		const classified = classifyLaneOutput(
			inventory([
				{ path: 'index.html', sha256: 'a' },
				{ path: '_next/static/chunks/main.js', sha256: 'b' },
				{ path: 'assets/index-abc.js', sha256: 'c' },
				{ path: 'favicon.png', sha256: 'd' },
			]),
		);
		expect(classified.documents).toEqual(['index.html']);
		expect(classified.bundledAssets).toEqual([
			'_next/static/chunks/main.js',
			'assets/index-abc.js',
		]);
		expect(classified.publicAssets).toEqual(['favicon.png']);
	});

	test('reports copied assets present in one lane only, and shared ones that differ', () => {
		const parity = publicAssetParity(
			inventory([
				{ path: 'a.svg', sha256: 'same' },
				{ path: 'b.svg', sha256: 'one' },
				{ path: 'era-only.svg', sha256: 'x' },
			]),
			inventory([
				{ path: 'a.svg', sha256: 'same' },
				{ path: 'b.svg', sha256: 'two' },
				{ path: 'target-only.svg', sha256: 'y' },
			]),
		);
		expect(parity.identicalBytes).toEqual(['a.svg']);
		expect(parity.differingBytes).toEqual(['b.svg']);
		expect(parity.onlyInEra).toEqual(['era-only.svg']);
		expect(parity.onlyInTarget).toEqual(['target-only.svg']);
	});

	test('normalising the build identifier changes the digest only when the identifier is present', () => {
		const withIdentifier = inventory([{ path: '_next/static/ABC/main.js', sha256: 'a' }]);
		const normalized = normalizeBuildIdentifier(withIdentifier, 'ABC');
		expect(normalized.files[0]?.path).toBe('_next/static/<build-id>/main.js');
		const without = inventory([{ path: 'index.html', sha256: 'a' }]);
		expect(normalizeBuildIdentifier(without, 'ABC').files[0]?.path).toBe('index.html');
	});
});
