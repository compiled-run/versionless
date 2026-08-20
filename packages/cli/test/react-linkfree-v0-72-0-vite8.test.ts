import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import {
	applicationNamedProductSymbols,
	capabilityContributionsAgreeWithObservations,
	corpusPathsLeakedIntoRecord,
	laneDigestIsReproducible,
	purgeDecisionIsMeasured,
	readLinkfreeBuildProfile,
	verifyLinkfreeBuildProfile,
} from '../src/fixture/react-linkfree-v0-72-0-vite8.ts';
import {
	isCorpusPath,
	laneDigestScheme,
	publishLane,
} from '../src/fixture/react-linkfree-v0-72-0-vite8-run.ts';

describe('LinkFree create-react-app 5 to Vite 8 build lanes', () => {
	test('verifies a byte-stable baseline and a deterministic migrated lane', async () => {
		const result = await verifyLinkfreeBuildProfile();
		expect(result.result).toBe('pass');
		expect(result.baselineByteStable).toBe(true);
		expect(result.targetDeterministic).toBe(true);
		expect(result.reproducibleLaneDigests).toBe(4);
		expect(result.runtimeBreaks).toBe(1);
		expect(result.applicationNamedProductSymbols).toEqual([]);
	});

	test('every lane digest recomputes from the record published beside it', async () => {
		const profile = await readLinkfreeBuildProfile();
		expect(profile.digest.scheme).toBe(laneDigestScheme);
		for (const build of [profile.builds.baseline, profile.builds.target])
			for (const lane of [build.first, build.second])
				expect(laneDigestIsReproducible(lane)).toBe(true);
		// A lane record whose corpus aggregate is altered no longer recomputes.
		const tampered = {
			...profile.builds.target.first,
			corpus: { ...profile.builds.target.first.corpus, files: 0 },
		};
		expect(laneDigestIsReproducible(tampered)).toBe(false);
	});

	test('the profile corpus appears only as an aggregate, never as a path', async () => {
		const profile = await readLinkfreeBuildProfile();
		expect(corpusPathsLeakedIntoRecord(profile)).toEqual([]);
		const corpus = profile.builds.target.first.corpus;
		expect(corpus.files).toBe(561);
		expect(corpus.aggregateSha256).toMatch(/^[0-9a-f]{64}$/);
		// Both lanes carry the same corpus, byte for byte: one digest says so
		// without naming a single contributor.
		expect(profile.builds.baseline.first.corpus.aggregateSha256).toBe(corpus.aggregateSha256);
		const raw = await readFile(
			'evidence/runs/react-linkfree-v0-72-0/build-profile.json',
			'utf8',
		);
		expect(raw.includes(`"${corpus.directory}`)).toBe(true);
		expect(raw.split(`"${corpus.directory}`).length - 1).toBe(
			raw.split(`"directory": "${corpus.directory}"`).length - 1,
		);
	});

	test('folds only corpus paths, and leaves the bundler-authored inventory alone', () => {
		expect(isCorpusPath('data/anything.json')).toBe(true);
		expect(isCorpusPath('assets/index-abc.js')).toBe(false);
		expect(isCorpusPath('list.json')).toBe(false);
		const published = publishLane({
			digest: 'ignored',
			files: [
				{ path: 'assets/index.js', sha256: 'a'.repeat(64) },
				{ path: 'data/one.json', sha256: 'b'.repeat(64) },
				{ path: 'data/two.json', sha256: 'c'.repeat(64) },
			],
		});
		expect(published.files.map((file) => file.path)).toEqual(['assets/index.js']);
		expect(published.corpus.files).toBe(2);
		expect(laneDigestIsReproducible(published)).toBe(true);
	});

	test('the migrated lane runs the declared codegen prebuild and edits no application source', async () => {
		const profile = await readLinkfreeBuildProfile();
		const target = profile.builds.target;
		expect(target.applicationSourceEdits).toBe(0);
		expect(profile.declaredBuildSteps.codegenPrebuild.migratedLaneRunsIt).toBe(true);
		expect(target.applicationFilesChanged?.map((file) => file.path)).toEqual([
			'index.html',
			'public/list.json',
		]);
		// The codegen's own output is the file the record names, not a copy of it.
		expect(profile.declaredBuildSteps.codegenPrebuild.emittedSha256).toBe(
			target.applicationFilesChanged?.find((file) => file.path === 'public/list.json')
				?.sha256,
		);
	});

	test('the postbuild purge is declared out of scope and measured on both lanes', async () => {
		const profile = await readLinkfreeBuildProfile();
		const purge = profile.declaredBuildSteps.postbuildCssPurge;
		expect(purge.migratedLaneRunsIt).toBe(false);
		expect(purge.decision).toBe('declared-out-of-scope-of-the-vite-build');
		expect(purge.reasoning.length).toBeGreaterThanOrEqual(4);
		expect(purgeDecisionIsMeasured(profile)).toBe(true);
		const [baseline, target] = purge.measuredBothWays;
		expect(baseline?.bytesBeforePurge).toBe(619824);
		expect(baseline?.bytesAfterPurge).toBe(50728);
		expect(target?.bytesBeforePurge).toBe(587122);
		expect(target?.bytesAfterPurge).toBe(43283);
		// The measurement is of the application's own declared step: purging the
		// baseline's pre-purge output reproduces the stylesheet it actually ships.
		expect(purge.baselinePurgeAgreesWithShippedLane).toBe(true);
		expect(purge.shippedCssBytes.baseline).toBe(50728);
		expect(purge.shippedCssBytes.target).toBe(587122);
	});

	test('rejects a purge decision whose measurement does not cover both lanes', async () => {
		const profile = await readLinkfreeBuildProfile();
		const purge = profile.declaredBuildSteps.postbuildCssPurge;
		expect(
			purgeDecisionIsMeasured({
				...profile,
				declaredBuildSteps: {
					...profile.declaredBuildSteps,
					postbuildCssPurge: {
						...purge,
						measuredBothWays: purge.measuredBothWays.slice(0, 1),
					},
				},
			}),
		).toBe(false);
	});

	test('records what each adapter capability actually contributed, including the inert ones', async () => {
		const profile = await readLinkfreeBuildProfile();
		expect(capabilityContributionsAgreeWithObservations(profile)).toBe(true);
		const fired = new Map(
			profile.capabilities.contribution.map((entry) => [entry.capability, entry.fired]),
		);
		expect(fired.get('createCraJavaScriptJsxPlugin')).toBe(true);
		// This closure is not the non-UTF-8 capability's second live application,
		// and the record says so rather than leaving it ambiguous.
		expect(profile.capabilities.measured.nonUtf8DecodedModules).toEqual([]);
		expect(fired.get('createCraNonUtf8ModuleSourcePlugin')).toBe(false);
		expect(profile.capabilities.measured.sloppyCommonJsImplicitGlobals).toEqual([]);
		expect(fired.get('createCraSloppyCommonJsGlobalsPlugin')).toBe(false);
		// webpack 5 ships no automatic core-module polyfills, so an import of one
		// would have failed the green baseline: the capability is inert here.
		expect(fired.get('createCraNodeCoreModulePlugin')).toBe(false);
	});

	test('detects a capability contribution that disagrees with its observation', async () => {
		const profile = await readLinkfreeBuildProfile();
		expect(
			capabilityContributionsAgreeWithObservations({
				...profile,
				capabilities: {
					...profile.capabilities,
					contribution: profile.capabilities.contribution.map((entry) =>
						entry.capability === 'createCraNonUtf8ModuleSourcePlugin'
							? { ...entry, fired: true }
							: entry,
					),
				},
			}),
		).toBe(false);
	});

	test('keeps the runtime break the migrated lane caught, with its generic fix', async () => {
		const profile = await readLinkfreeBuildProfile();
		expect(profile.runtimeBreaks.map((entry) => entry.order)).toEqual([1]);
		expect(profile.runtimeBreaks[0]?.symptom).toContain('JSX syntax is disabled');
		expect(profile.runtimeBreaks[0]?.genericFix).toContain('createCraJavaScriptJsxPlugin');
		expect(profile.runtimeBreaks[0]?.landedIn).toContain(
			'packages/frameworks/react/src/react-cra-vite-adapter.ts',
		);
	});

	test('claims build-level parity only, and no behaviour', async () => {
		const profile = await readLinkfreeBuildProfile();
		expect(profile.parity.level).toBe('build-artifacts-only');
		expect(profile.parity.behavioral).toBe('not-tested');
		expect(profile.parity.journeys).toBe('not-tested');
		expect(profile.parity.runtimeEquivalence).toBe('unknown');
		expect(profile.parity.entryHtml.equal).toBe(false);
		for (const gate of [
			'browserLocality',
			'realServer',
			'directWitnessJourneys',
			'mutationRestoration',
			'upstreamCypressSuite',
		])
			expect(profile.gates[gate]).toBe('not-run');
		expect(profile.builds.baseline.bundler).toContain('webpack-5.73.0');
		expect(profile.builds.target.bundler).toBe('vite-8.0.16');
	});

	test('records the egress cascade as a witness-phase fact rather than a solved one', async () => {
		const profile = await readLinkfreeBuildProfile();
		expect(profile.witnessPhaseFacts.runtimeEgressCascade).toContain('REDIRECTS');
		expect(profile.witnessPhaseFacts.buildTimeEgress).toContain('None');
		expect(profile.dependencyAcquisition.closureInstalledByThisUnit).toBe(false);
		expect(profile.dependencyAcquisition.networkDuringThisUnit).toBe('none');
	});

	test('the derived report is linked to both canonical digests', async () => {
		const profile = await readLinkfreeBuildProfile();
		const receipt = JSON.parse(
			await readFile('evidence/runs/react-linkfree-v0-72-0/t006-run.json', 'utf8'),
		) as {
			buildProfile: { canonicalDigest: string };
			integrity: { canonicalDigest: string };
			verification: { parityLevel: string; boot: string };
		};
		expect(receipt.buildProfile.canonicalDigest).toBe(profile.integrity.canonicalDigest);
		expect(receipt.verification.parityLevel).toBe('build-artifacts-only');
		expect(receipt.verification.boot).toBe('not-run');
		const report = await readFile('evidence/runs/react-linkfree-v0-72-0/t006-run.md', 'utf8');
		expect(report).toContain(profile.integrity.canonicalDigest);
		expect(report).toContain(receipt.integrity.canonicalDigest);
	});

	test('detects an application name leaking into the reusable React surface', async () => {
		expect(await applicationNamedProductSymbols('createCraViteAdapter')).toContain(
			'react-cra-vite-adapter.ts',
		);
	});
});
