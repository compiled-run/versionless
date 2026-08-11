import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, test } from 'vitest';
import { craPrefixedEnvironment, craEnvironmentPrefix } from '../../../fixtures/react-cypress-rwa/vite.config.ts';
import {
	laneDigestIsReproducible,
	laneDigestScheme,
	parseBuildDemands,
	parseExternalizedModules,
	parseModulesTransformed,
	stripAnsi,
	summarizeLane,
	type LaneBuild,
	type LaneInventory,
} from '../src/fixture/react-cypress-rwa-migration-run.ts';

const repositoryRoot = path.resolve(import.meta.dirname, '../../..');

type BuildProfile = Readonly<{
	result: string;
	role: string;
	holdoutDiscipline: Readonly<{
		compositeFingerprint: string;
		adapterBytesChanged: number;
		adapterChangesProposedAndExecuted: number;
		redBuildPatchedAround: boolean;
	}>;
	digest: Readonly<{ scheme: string }>;
	dependencyAcquisition: Readonly<{ bothLanesInstalledFromTheSameFrozenLockfile: boolean }>;
	baselineLane: Readonly<{
		result: string;
		builds: number;
		deterministic: boolean;
		first: LaneInventory;
		second: Readonly<{ digest: string }>;
		fileCount: number;
	}>;
	migratedLane: Readonly<{
		result: string;
		attempts: number;
		stableAcrossAttempts: boolean;
		modulesTransformedBeforeFailure: number;
		genericCapabilitiesOnly: boolean;
		holdoutSpecificConfiguration: string;
		demands: readonly Readonly<{ code: string; module: string; detail: string }>[];
	}>;
	falsificationFinding: Readonly<{
		missingCapability: string;
		actionTaken: string;
		exactDemand: Readonly<{ code: string; module: string; compilerText: string }>;
		offendingFile: Readonly<{ encoding: string; invalidUtf8ByteCount: number }>;
	}>;
	applicationFilesChanged: Readonly<{
		count: number;
		handEditedSourceFiles: readonly string[];
	}>;
	serviceWorkerState: Readonly<{
		applicationRegistersOne: boolean;
		baselineOutputContainsWorkerAssets: boolean;
		baselineWorkerAssets: readonly string[];
	}>;
	parity: Readonly<{ comparable: boolean; nonClaims: readonly string[] }>;
}>;

async function readBuildProfile(): Promise<BuildProfile> {
	return JSON.parse(
		await readFile(path.join(repositoryRoot, 'evidence/runs/react-cypress-rwa/build-profile.json'), 'utf8'),
	) as BuildProfile;
}

/** The failed migrated build as the bundler printed it, with colour stripped. */
const capturedFailureLog = [
	'vite v8.0.16 building client environment for production...',
	'transforming...[plugin rolldown:vite-resolve] Module "fs" has been externalized for browser compatibility, imported by "/work/target/node_modules/dotenv/lib/main.js". See https://vite.dev/guide/troubleshooting.html for more details.',
	'✓ 10181 modules transformed.',
	'✗ Build failed in 1.17s',
	'error during build:',
	'Build failed with 1 error:',
	'',
	'[UNLOADABLE_DEPENDENCY] Could not load node_modules/faker/lib/locales/it/name/first_name.js',
	'   ╭─[ node_modules/faker/lib/locales/it/name/index.js:5:27 ]',
	'   │',
	' 5 │ name.first_name = require("./first_name");',
	'   │                           ───────┬──────',
	'   │                                  ╰──────── stream did not contain valid UTF-8',
	'───╯',
].join('\n');

describe('cypress-realworld-app holdout: lane orchestration primitives', () => {
	test('itemizes the loader demand a failed build reported, as the compiler stated it', () => {
		expect(parseBuildDemands(capturedFailureLog)).toEqual([
			{
				code: 'UNLOADABLE_DEPENDENCY',
				module: 'node_modules/faker/lib/locales/it/name/first_name.js',
				importer: 'node_modules/faker/lib/locales/it/name/index.js',
				line: 5,
				column: 27,
				detail: 'stream did not contain valid UTF-8',
			},
		]);
	});

	test('a build log with no demand itemizes nothing', () => {
		expect(parseBuildDemands('✓ 42 modules transformed.\n✓ built in 3.10s')).toEqual([]);
	});

	test('records the Node core specifiers Vite externalized, relative to the work area', () => {
		expect(parseExternalizedModules(capturedFailureLog, '/work/target')).toEqual([
			{ module: 'fs', importer: 'node_modules/dotenv/lib/main.js' },
		]);
	});

	test('reads how far the bundler got before it stopped', () => {
		expect(parseModulesTransformed(capturedFailureLog)).toBe(10181);
		expect(parseModulesTransformed('no counter here')).toBeNull();
	});

	test('strips the colour codes a terminal build log carries', () => {
		expect(stripAnsi(`${String.fromCharCode(27)}[31mred${String.fromCharCode(27)}[0m`)).toBe('red');
	});

	test('two identical failures are a stable measurement, two different ones are not', () => {
		const failure = (log: string): LaneBuild => ({ result: 'failed', exitCode: 1, log, inventory: null });
		expect(summarizeLane(failure(capturedFailureLog), failure(capturedFailureLog)).stable).toBe(true);
		expect(summarizeLane(failure(capturedFailureLog), failure(capturedFailureLog)).deterministic).toBe(false);
		expect(
			summarizeLane(
				failure(capturedFailureLog),
				failure(capturedFailureLog.replace('first_name.js', 'last_name.js')),
			).stable,
		).toBe(false);
	});

	test("applies create-react-app's own prefix rule to a dotenv document", () => {
		expect(craEnvironmentPrefix).toBe('REACT_APP_');
		expect(
			craPrefixedEnvironment(
				['# a comment', '', 'SEED_USERBASE_SIZE=5', 'REACT_APP_PORT=3000', 'REACT_APP_NAME="quoted"'].join('\n'),
			),
		).toEqual({ REACT_APP_NAME: 'quoted', REACT_APP_PORT: '3000' });
	});
});

describe('cypress-realworld-app holdout: the recorded falsification run', () => {
	test('the era baseline lane is green and byte-stable across two rebuilds', async () => {
		const profile = await readBuildProfile();
		expect(profile.baselineLane.result).toBe('green');
		expect(profile.baselineLane.builds).toBe(2);
		expect(profile.baselineLane.deterministic).toBe(true);
		expect(profile.baselineLane.first.digest).toBe(profile.baselineLane.second.digest);
		expect(profile.baselineLane.fileCount).toBe(profile.baselineLane.first.files.length);
	});

	test('the baseline lane digest recomputes from the file list recorded beside it', async () => {
		const profile = await readBuildProfile();
		expect(profile.digest.scheme).toBe(laneDigestScheme);
		expect(laneDigestIsReproducible(profile.baselineLane.first)).toBe(true);
	});

	test('the migrated lane is red, and red the same way twice', async () => {
		const profile = await readBuildProfile();
		expect(profile.migratedLane.result).toBe('red');
		expect(profile.migratedLane.attempts).toBe(2);
		expect(profile.migratedLane.stableAcrossAttempts).toBe(true);
		expect(profile.migratedLane.demands).toHaveLength(1);
		expect(profile.migratedLane.demands[0]?.code).toBe('UNLOADABLE_DEPENDENCY');
		expect(profile.migratedLane.demands[0]?.detail).toBe('stream did not contain valid UTF-8');
		expect(profile.migratedLane.modulesTransformedBeforeFailure).toBe(10181);
	});

	test('the adapter was applied as it stands, with nothing holdout-specific', async () => {
		const profile = await readBuildProfile();
		expect(profile.role).toBe('holdout');
		expect(profile.migratedLane.genericCapabilitiesOnly).toBe(true);
		expect(profile.migratedLane.holdoutSpecificConfiguration).toBe('none');
		expect(profile.dependencyAcquisition.bothLanesInstalledFromTheSameFrozenLockfile).toBe(true);
	});

	test('the freeze held: no adapter byte changed and the red was not patched around', async () => {
		const profile = await readBuildProfile();
		expect(profile.holdoutDiscipline.compositeFingerprint).toBe(
			'd9f75ef677cb850f664cc188abf77b8ebfd24e84cb58d147b74e9bbaa143eb77',
		);
		expect(profile.holdoutDiscipline.adapterBytesChanged).toBe(0);
		expect(profile.holdoutDiscipline.adapterChangesProposedAndExecuted).toBe(0);
		expect(profile.holdoutDiscipline.redBuildPatchedAround).toBe(false);
		expect(profile.falsificationFinding.actionTaken).toMatch(/^none\./);
	});

	test('the finding names the missing capability and the file that demands it', async () => {
		const profile = await readBuildProfile();
		expect(profile.falsificationFinding.missingCapability).toBe('non-UTF-8 module source decoding');
		expect(profile.falsificationFinding.exactDemand.module).toBe(
			'node_modules/faker/lib/locales/it/name/first_name.js',
		);
		expect(profile.falsificationFinding.offendingFile.encoding).toBe('ISO-8859-1, not UTF-8');
		expect(profile.falsificationFinding.offendingFile.invalidUtf8ByteCount).toBe(6);
	});

	test('no application source file was edited by hand', async () => {
		const profile = await readBuildProfile();
		expect(profile.applicationFilesChanged.count).toBe(0);
		expect(profile.applicationFilesChanged.handEditedSourceFiles).toEqual([]);
	});

	test('the service worker state is recorded, and it is that there is none', async () => {
		const profile = await readBuildProfile();
		expect(profile.serviceWorkerState.applicationRegistersOne).toBe(false);
		expect(profile.serviceWorkerState.baselineOutputContainsWorkerAssets).toBe(false);
		expect(profile.serviceWorkerState.baselineWorkerAssets).toEqual([]);
	});

	test('parity is declared incomparable, and the non-claims say why', async () => {
		const profile = await readBuildProfile();
		expect(profile.parity.comparable).toBe(false);
		expect(profile.parity.nonClaims.length).toBeGreaterThan(3);
	});
});
