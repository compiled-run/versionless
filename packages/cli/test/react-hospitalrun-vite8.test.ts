import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import {
	applicationNamedProductSymbols,
	eraPinViolations,
	laneDigestIsReproducible,
	readHospitalRunBuildProfile,
	verifyHospitalRunBuildProfile,
} from '../src/fixture/react-hospitalrun-vite8.ts';
import {
	classifyConsoleErrors,
	knownConsoleErrorInventory,
	laneDigestScheme,
} from '../src/fixture/react-hospitalrun-vite8-run.ts';

describe('HospitalRun create-react-app to Vite 8 build and boot profile', () => {
	test('verifies deterministic builds and a proven boot on both lanes', async () => {
		const result = await verifyHospitalRunBuildProfile();
		expect(result.result).toBe('pass');
		expect(result.baselineDeterministic).toBe(true);
		expect(result.targetDeterministic).toBe(true);
		expect(result.baselineBooted).toBe(true);
		expect(result.targetBooted).toBe(true);
		expect(result.compatibilityPins).toBe(8);
		expect(result.runtimeBreaks).toBe(3);
		expect(result.reproducibleLaneDigests).toBe(4);
		expect(result.applicationNamedProductSymbols).toEqual([]);
	});

	test('every lane digest recomputes from the file list recorded beside it', async () => {
		const profile = await readHospitalRunBuildProfile();
		expect(profile.digest.scheme).toBe(laneDigestScheme);
		for (const build of [profile.builds.baseline, profile.builds.target])
			for (const lane of [build.first, build.second])
				expect(laneDigestIsReproducible(lane)).toBe(true);
		// The superseded record is named, and its irreproducibility is the reason.
		expect(profile.digest.supersedes.baselineDigestClaimed).toBe(
			'302e499bc7e2e9597f7e0f33cf3eb586407764f02afbcd98dad3b5a42495cafe',
		);
		expect(
			laneDigestIsReproducible({
				digest: profile.digest.supersedes.baselineDigestClaimed as string,
				files: profile.builds.baseline.first.files,
			}),
		).toBe(false);
	});

	test('keeps all three runtime breaks the boot gate caught, with their generic fixes', async () => {
		const profile = await readHospitalRunBuildProfile();
		expect(profile.runtimeBreaks.map((entry) => entry.order)).toEqual([1, 2, 3]);
		expect(profile.runtimeBreaks[0]?.symptom).toContain('global is not defined');
		expect(profile.runtimeBreaks[0]?.genericFix).toContain('createCraGlobalIdentifierPlugin');
		expect(profile.runtimeBreaks[1]?.symptom).toContain('__vite-browser-external');
		expect(profile.runtimeBreaks[1]?.genericFix).toContain('createCraNodeCoreModulePlugin');
		expect(profile.runtimeBreaks[2]?.symptom).toContain('txt is not defined');
		expect(profile.runtimeBreaks[2]?.genericFix).toContain(
			'createCraSloppyCommonJsGlobalsPlugin',
		);
		for (const entry of profile.runtimeBreaks) expect(entry.caughtBy).toContain('boot gate');
	});

	test('the migrated lane boots with a silent console; the baseline carries the known inventory', async () => {
		const profile = await readHospitalRunBuildProfile();
		const { baseline, target } = profile.builds;
		expect(target.boot.consoleErrors).toEqual({ known: {}, unexpected: [] });
		expect(target.boot.pageErrors).toEqual([]);
		expect(target.boot.failedRequests).toEqual([]);
		expect(target.boot.successfulNonLoopback).toEqual([]);
		expect(baseline.boot.consoleErrors.unexpected).toEqual([]);
		expect(Object.keys(baseline.boot.consoleErrors.known)).toEqual([
			'service-worker-registration',
		]);
		expect(baseline.boot.rootElementBytes).toBe(target.boot.rootElementBytes);
		expect(profile.parity.boot.rootElementBytesEqual).toBe(true);
	});

	test('classifies only the known service-worker console errors, and nothing else', () => {
		const classified = classifyConsoleErrors([
			`${knownConsoleErrorInventory['service-worker-registration'] as string} TypeError`,
			'Uncaught ReferenceError: txt is not defined',
		]);
		expect(classified.known).toEqual({ 'service-worker-registration': 1 });
		expect(classified.unexpected).toEqual(['Uncaught ReferenceError: txt is not defined']);
		expect(classifyConsoleErrors([])).toEqual({ known: {}, unexpected: [] });
	});

	test('records the one dependency module that needed the sloppy CommonJS wrapper', async () => {
		const profile = await readHospitalRunBuildProfile();
		expect(profile.builds.target.sloppyCommonJsImplicitGlobals).toEqual([
			{ module: 'node_modules/md5-jkmyers/md5.min.js', names: ['txt'] },
		]);
	});

	test('labels the baseline as a compatibility resolution rather than the upstream state', async () => {
		const profile = await readHospitalRunBuildProfile();
		const resolution = profile.dependencyAcquisition.compatibilityResolution;
		expect(profile.dependencyAcquisition.lockfile).toBe(null);
		expect(resolution.label).toContain('NOT the upstream-committed state');
		expect(resolution.cutoff).toBe('2020-11-07T10:12:53Z');
		expect(profile.gates.baselineAuthenticity).toBe('compatibility-labeled-not-authentic');
		for (const pin of resolution.pins) {
			expect(Date.parse(pin.published)).toBeLessThanOrEqual(Date.parse(resolution.cutoff));
			expect(pin.reason.length).toBeGreaterThan(0);
			expect(pin.tarballSha256).toMatch(/^[0-9a-f]{64}$/);
		}
	});

	test('rejects a pin published after the declared cutoff', () => {
		expect(
			eraPinViolations(
				[
					{
						name: '@types/example',
						version: '9.9.9',
						published: '2026-01-01T00:00:00.000Z',
						reason: 'drifted',
						tarball: 'https://registry.npmjs.org/example',
						tarballSha256: 'a'.repeat(64),
					},
				],
				'2020-11-07T10:12:53Z',
			),
		).toEqual(['@types/example@9.9.9']);
	});

	test('records the baseline-only service worker and the shared public assets', async () => {
		const profile = await readHospitalRunBuildProfile();
		expect(profile.builds.baseline.serviceWorkerOutputs).toContain('service-worker.js');
		expect(profile.builds.target.serviceWorkerOutputs).toEqual([]);
		expect(profile.parity.inventory.byteIdenticalSharedPaths).toContain('favicon.ico');
		expect(profile.parity.inventory.targetOnlyPaths.length).toBeGreaterThan(0);
		expect(profile.builds.target.bundler).toBe('vite-8.0.16');
		expect(profile.builds.baseline.bundler).toContain('webpack-4.42.0');
		expect(profile.parity.runtimeEquivalence).toBe('unknown');
	});

	test('the run receipt proves boot, keeps journeys unproven, and reports zero source edits', async () => {
		const receipt = JSON.parse(
			await readFile('evidence/runs/react-hospitalrun/t004-run.json', 'utf8'),
		) as {
			verification: Record<string, unknown> & {
				boot: { result: string };
				deterministicCore: Record<string, { equal: boolean }>;
			};
			migration: {
				applicationNamedProductBranches: number;
				applicationSourceEdits: number;
				reusableSurfaceChanged: boolean;
				runtimeBreaks: unknown[];
			};
			supersedes: { claimedCanonicalDigest: string };
			baseline: { authenticity: string };
		};
		expect(receipt.verification.result).toBe('build-and-boot-pass');
		expect(receipt.verification.boot.result).toBe('pass');
		expect(receipt.verification.digestScheme).toBe(laneDigestScheme);
		expect(receipt.verification.deterministicCore.baseline?.equal).toBe(true);
		expect(receipt.verification.deterministicCore.target?.equal).toBe(true);
		// Everything past boot stays unproven and stays labelled unproven.
		expect(receipt.verification.journeys).toBe('not-run');
		expect(receipt.verification.mutation).toBe('not-run');
		expect(receipt.verification.serviceWorker).toBe('not-tested');
		expect(receipt.migration.applicationNamedProductBranches).toBe(0);
		expect(receipt.migration.applicationSourceEdits).toBe(0);
		expect(receipt.migration.reusableSurfaceChanged).toBe(true);
		expect(receipt.migration.runtimeBreaks).toHaveLength(3);
		expect(receipt.supersedes.claimedCanonicalDigest).toBe(
			'4f498c3cc7496af2d93a9be8a9aafec551178dfec150d8b34196abc64fc8d0ad',
		);
		expect(receipt.baseline.authenticity).toBe('explicitly-labeled-compatibility-resolution');
	});

	test('the derived markdown is linked to both canonical digests', async () => {
		const profile = await readHospitalRunBuildProfile();
		const receipt = JSON.parse(
			await readFile('evidence/runs/react-hospitalrun/t004-run.json', 'utf8'),
		) as { integrity: { canonicalDigest: string } };
		const report = await readFile('evidence/runs/react-hospitalrun/t004-run.md', 'utf8');
		expect(report).toContain(receipt.integrity.canonicalDigest);
		expect(report).toContain(profile.integrity.canonicalDigest);
	});

	test('detects an application name leaking into the reusable React surface', async () => {
		expect(await applicationNamedProductSymbols('createCraViteAdapter')).toContain(
			'react-cra-vite-adapter.ts',
		);
	});
});
