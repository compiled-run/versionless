import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	analyzeCorpusConformance,
	deriveCorpusTransactionState,
	verifyCorpusConformanceDigest,
} from '../src/corpus/conformance.ts';
import { nextKilledByGoogleAggregateMember } from '../src/receipts/next-killedbygoogle.ts';
import { reactAvataaarsCompatibilityAggregateMember } from '../src/receipts/react-avataaars-compatibility.ts';
import { witnessAngularRealworldAggregateMember } from '../src/receipts/witness-angular-realworld.ts';
import { witnessReactBoilerplateAggregateMember } from '../src/receipts/witness-react-boilerplate.ts';
import { witnessNextKilledByGoogleAggregateMember } from '../src/receipts/witness-next-killedbygoogle.ts';
import {
	REACT_PAPERCUPS_RECEIPT_PATH,
	reactPapercupsAggregateMember,
	verifyWitnessReactPapercupsEvidence,
	WITNESS_REACT_PAPERCUPS_RECEIPT_PATH,
	witnessReactPapercupsAggregateMember,
} from '../src/receipts/witness-react-papercups.ts';
import {
	REACT_HOSPITALRUN_RECEIPT_PATH,
	verifyWitnessReactHospitalrunEvidence,
	WITNESS_REACT_HOSPITALRUN_RECEIPT_PATH,
	witnessReactHospitalrunAggregateMember,
} from '../src/receipts/witness-react-hospitalrun.ts';
import {
	verifyWitnessAngularFactoriolabEvidence,
	WITNESS_ANGULAR_FACTORIOLAB_RECEIPT_PATH,
	witnessAngularFactoriolabAggregateMember,
} from '../src/receipts/witness-angular-factoriolab.ts';
import {
	verifyWitnessAngularJiraCloneEvidence,
	WITNESS_ANGULAR_JIRA_CLONE_RECEIPT_PATH,
	witnessAngularJiraCloneAggregateMember,
} from '../src/receipts/witness-angular-jira-clone.ts';
import {
	verifyWitnessReactMemosEvidence,
	WITNESS_REACT_MEMOS_RECEIPT_PATH,
	witnessReactMemosAggregateMember,
} from '../src/receipts/witness-react-memos.ts';
import {
	verifyWitnessNextKilledbygoogleV3Evidence,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECEIPT_PATH,
	witnessNextKilledbygoogleV3AggregateMember,
} from '../src/receipts/witness-next-killedbygoogle-v3.ts';
import {
	verifyWitnessReactLinkfreeEvidence,
	WITNESS_REACT_LINKFREE_RECEIPT_PATH,
	witnessReactLinkfreeAggregateMember,
} from '../src/receipts/witness-react-linkfree.ts';
import {
	holdoutReactCypressRwaCorpusRecord,
	verifyHoldoutReactCypressRwaEvidence,
} from '../src/receipts/holdout-react-cypress-rwa.ts';
import {
	ANGULAR_PRE_IVY_SUPPORT_BOUNDARY,
	HOLDOUT_ANGULAR_PIGALLERY2_RUN_EVIDENCE,
	holdoutAngularPigallery2CorpusRecord,
	verifyHoldoutAngularPigallery2Evidence,
} from '../src/receipts/holdout-angular-pigallery2.ts';
import {
	HOLDOUT_ANGULAR_ESHOP_WEBSPA_OUTCOME,
	HOLDOUT_ANGULAR_ESHOP_WEBSPA_RUN_EVIDENCE,
	holdoutAngularEshopWebspaCorpusRecord,
	verifyHoldoutAngularEshopWebspaEvidence,
} from '../src/receipts/holdout-angular-eshop-webspa.ts';
import {
	ANGULAR_PRE_IVY_BOUNDARY_AMENDMENT,
	ANGULAR_PRE_IVY_BOUNDARY_POPULATION_STATEMENT,
	assertAngularPreIvyBoundaryAmendment,
} from '../src/receipts/angular-pre-ivy-boundary-amendment.ts';
import { reactHospitalrunAggregateMember } from '../src/corpus/conformance.ts';
import { receiptDigest, sha256 } from '../src/receipts/canonicalize.ts';
import { renderReceipt } from '../src/receipts/render.ts';
import type { MigrationReceipt } from '../src/receipts/schema.ts';

const root = path.resolve(import.meta.dirname, '../../..');
const killedByGoogleDigest = 'a018c6490cd559fab74ea402ff93660f053503dbed1a52ba9b68ed7fdc086b7c';

function prepublicationFixtures(fixtures: Array<Record<string, unknown>>) {
	const expected = nextKilledByGoogleAggregateMember(killedByGoogleDigest);
	const matches = fixtures.filter((fixture) => fixture.id === expected.id);
	expect(matches).toEqual([expected]);
	const witnessMatches = fixtures.filter((fixture) => fixture.id === 'witness-angular-realworld');
	if (witnessMatches.length === 1) {
		const witness = witnessMatches[0]!;
		expect(witness).toEqual(witnessAngularRealworldAggregateMember(String(witness.digest)));
	} else expect(witnessMatches).toEqual([]);
	const reactMatches = fixtures.filter((fixture) => fixture.id === 'witness-react-boilerplate');
	if (reactMatches.length === 1) {
		const witness = reactMatches[0]!;
		expect(witness).toEqual(witnessReactBoilerplateAggregateMember(String(witness.digest)));
	} else expect(reactMatches).toEqual([]);
	const nextWitnessMatches = fixtures.filter(
		(fixture) => fixture.id === 'witness-next-killedbygoogle',
	);
	if (nextWitnessMatches.length === 1) {
		const witness = nextWitnessMatches[0]!;
		expect(witness).toEqual(witnessNextKilledByGoogleAggregateMember(String(witness.digest)));
	} else expect(nextWitnessMatches).toEqual([]);
	return fixtures.filter(
		(fixture) =>
			fixture.id !== expected.id &&
			fixture.id !== 'witness-angular-realworld' &&
			fixture.id !== 'witness-react-boilerplate' &&
			fixture.id !== 'witness-next-killedbygoogle' &&
			fixture.id !== 'react-boilerplate-v4-zero-sw' &&
			fixture.id !== 'witness-react-boilerplate-zero-sw' &&
			fixture.id !== 'react-papercups-v1-0-0' &&
			fixture.id !== 'witness-react-papercups' &&
			fixture.id !== 'react-hospitalrun' &&
			fixture.id !== 'witness-react-hospitalrun' &&
			fixture.id !== 'witness-angular-factoriolab' &&
			fixture.id !== 'witness-angular-jira-clone' &&
			fixture.id !== 'witness-react-memos-v0-1-3' &&
			fixture.id !== 'witness-next-killedbygoogle-v3-0-0' &&
			fixture.id !== 'witness-react-linkfree-v0-72-0' &&
			fixture.id !== 'witness-angular-tiny-translator' &&
			fixture.id !== 'witness-angular-super-productivity',
	);
}

async function corpusCopy(label: string): Promise<string> {
	const directory = await mkdtemp(path.join(os.tmpdir(), `versionless-corpus-${label}-`));
	await cp(path.join(root, 'evidence/runs'), path.join(directory, 'evidence/runs'), {
		recursive: true,
	});
	await cp(
		path.join(root, 'evidence/ingests/angular-realworld-v16'),
		path.join(directory, 'evidence/ingests/angular-realworld-v16'),
		{ recursive: true },
	);
	await cp(
		path.join(root, 'fixtures/angular-realworld-v15-to-v16'),
		path.join(directory, 'fixtures/angular-realworld-v15-to-v16'),
		{ recursive: true },
	);
	// The Angular holdout's run evidence, copied file by file rather than as a
	// directory: the ingest also holds the source archive, and a corpus copy per
	// test does not need to carry a tarball to check a ledger.
	await mkdir(path.join(directory, 'evidence/ingests/angular-pigallery2-v1-7-0/migration'), {
		recursive: true,
	});
	for (const evidence of HOLDOUT_ANGULAR_PIGALLERY2_RUN_EVIDENCE)
		await cp(path.join(root, evidence.path), path.join(directory, evidence.path));
	// The eShop holdout's run evidence, copied the same way and for the same
	// reason: its ingest carries the pinned monorepo archive, and a ledger check
	// needs the sealed attempt record and the lane logs, not a tarball.
	await mkdir(
		path.join(directory, 'evidence/ingests/angular-eshop-webspa-netcore2-2/migration'),
		{ recursive: true },
	);
	for (const evidence of HOLDOUT_ANGULAR_ESHOP_WEBSPA_RUN_EVIDENCE)
		await cp(path.join(root, evidence.path), path.join(directory, evidence.path));
	return directory;
}

async function mutateJson(
	rootDir: string,
	relative: string,
	transform: (value: Record<string, unknown>) => void,
): Promise<void> {
	const file = path.join(rootDir, relative);
	const value = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
	transform(value);
	await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function rebindComposedArtifact(
	rootDir: string,
	name: string,
	transform: (value: Record<string, unknown>) => void,
): Promise<void> {
	const artifactRelative = `evidence/runs/react-boilerplate-v4-composed/artifacts/${name}`;
	const artifactFile = path.join(rootDir, artifactRelative);
	const artifact = JSON.parse(await readFile(artifactFile, 'utf8')) as Record<string, unknown>;
	transform(artifact);
	const artifactBody = `${JSON.stringify(artifact, null, 2)}\n`;
	await writeFile(artifactFile, artifactBody);
	const receiptRelative = 'evidence/runs/react-boilerplate-v4-composed/t060-run.json';
	const receiptFile = path.join(rootDir, receiptRelative);
	const receipt = JSON.parse(await readFile(receiptFile, 'utf8')) as Record<string, any>;
	const reference = receipt.artifacts.find(
		(value: Record<string, unknown>) => value.path === artifactRelative,
	) as Record<string, unknown> | undefined;
	if (!reference) throw new Error(`test artifact missing: ${name}`);
	reference.sha256 = sha256(artifactBody);
	receipt.integrity.canonicalDigest = receiptDigest(receipt as MigrationReceipt);
	await writeFile(receiptFile, `${JSON.stringify(receipt, null, 2)}\n`);
	await writeFile(
		path.join(rootDir, 'evidence/runs/react-boilerplate-v4-composed/t060-run.md'),
		renderReceipt(receipt as MigrationReceipt),
	);
	const aggregateFile = path.join(rootDir, 'evidence/runs/aggregate.json');
	const aggregate = JSON.parse(await readFile(aggregateFile, 'utf8')) as Record<string, any>;
	const fixture = aggregate.fixtures.find(
		(value: Record<string, unknown>) => value.receipt === receiptRelative,
	) as Record<string, unknown> | undefined;
	if (!fixture) throw new Error('test aggregate fixture missing');
	fixture.digest = receipt.integrity.canonicalDigest;
	await writeFile(aggregateFile, `${JSON.stringify(aggregate, null, 2)}\n`);
}

async function rebindPhonecatViteArtifact(
	rootDir: string,
	name: string,
	transform: (value: Record<string, unknown>) => void,
): Promise<void> {
	const artifactRelative = `evidence/runs/angular-phonecat-vite8/artifacts/${name}`;
	const artifactFile = path.join(rootDir, artifactRelative);
	const artifact = JSON.parse(await readFile(artifactFile, 'utf8')) as Record<string, unknown>;
	transform(artifact);
	const artifactBody = `${JSON.stringify(artifact, null, 2)}\n`;
	await writeFile(artifactFile, artifactBody);
	const receiptRelative = 'evidence/runs/angular-phonecat-vite8/t069-run.json';
	const receiptFile = path.join(rootDir, receiptRelative);
	const receipt = JSON.parse(await readFile(receiptFile, 'utf8')) as Record<string, any>;
	const reference = receipt.artifacts.find(
		(value: Record<string, unknown>) => value.path === artifactRelative,
	) as Record<string, unknown> | undefined;
	if (!reference) throw new Error(`test artifact missing: ${name}`);
	reference.sha256 = sha256(artifactBody);
	receipt.integrity.canonicalDigest = receiptDigest(receipt as MigrationReceipt);
	await writeFile(receiptFile, `${JSON.stringify(receipt, null, 2)}\n`);
	await writeFile(
		path.join(rootDir, 'evidence/runs/angular-phonecat-vite8/t069-run.md'),
		renderReceipt(receipt as MigrationReceipt),
	);
	const aggregateFile = path.join(rootDir, 'evidence/runs/aggregate.json');
	const aggregate = JSON.parse(await readFile(aggregateFile, 'utf8')) as Record<string, any>;
	const fixture = aggregate.fixtures.find(
		(value: Record<string, unknown>) => value.receipt === receiptRelative,
	) as Record<string, unknown> | undefined;
	if (!fixture) throw new Error('test aggregate fixture missing');
	fixture.digest = receipt.integrity.canonicalDigest;
	await writeFile(aggregateFile, `${JSON.stringify(aggregate, null, 2)}\n`);
}

describe('canonical corpus conformance', () => {
	it('derives the canonical twenty verticals as twelve narrowly scoped source applications', async () => {
		const result = await analyzeCorpusConformance({ rootDir: root });
		expect(verifyCorpusConformanceDigest(result)).toBe(result.integrity.canonicalDigest);
		expect(result.summary).toEqual({
			verticals: 20,
			sourceApplications: 12,
			designatedPilotsVerified: 0,
		});
		expect(result.verticals).toHaveLength(20);
		expect(result.applications).toHaveLength(12);
		expect(result.applications[0]).toMatchObject({
			id: 'react-boilerplate',
			boundaries: {
				viteAdapter: 'fixture-specific',
				oldVite: 'not-tested',
				genericAdapter: 'not-tested',
				unplugin: 'not-tested',
				fullEquivalence: 'not-claimed',
			},
		});
		expect(result.applications[2]).toMatchObject({
			id: 'angular-realworld',
			verticals: ['angular-realworld-v15-to-v16'],
			boundaries: {
				track: 'angular2-plus-adjacent-major',
				designatedPilot: false,
				genericAngularSupport: 'not-claimed',
			},
		});
		expect(
			result.applications.find((application) => application.id === 'killedbygoogle'),
		).toMatchObject({
			verticals: [
				'next-killedbygoogle-derived-state-to-memo',
				'next-killedbygoogle-v3-0-0',
			],
		});
		expect(result.applications[1]).toMatchObject({
			id: 'angular-phonecat',
			verticals: [
				'angular-phonecat',
				'angular-phonecat-route-resolve',
				'angular-phonecat-composed',
				'angular-phonecat-vite8',
			],
			conformance: { journeyDigestIdentical: true, migrationsRemainDistinct: true },
			boundaries: {
				track: 'angularjs-special-track',
				bundler: 'none-static / Vite 8.0.16',
				angular2Plus: 'not-applicable',
				angularCliAot: 'not-applicable',
				designatedPilot: false,
			},
		});
		expect(result.applications[0]).toMatchObject({
			verticals: [
				'react-boilerplate-v4',
				'react-boilerplate-v4-node24',
				'react-boilerplate-v4-vite8',
				'react-boilerplate-v4-data-flow',
				'react-boilerplate-v4-composed',
			],
		});
		expect(
			result.verticals.find((vertical) => vertical.id === 'angular-phonecat-composed'),
		).toMatchObject({
			composition: 'verified',
			orderIndependent: true,
			track: 'angularjs-special-track',
			angular2Plus: 'not-applicable',
			designatedPilot: false,
		});
		expect(result.coverage).toMatchObject({
			takenote: 'not-tested',
			angular2Hn: 'not-tested',
			authenticity: 'not-established',
			certification: 'not-claimed',
			locality: 'process-scoped-not-os-wide',
			nextjs: 'fixture-specific-next12-pages-verified',
		});
		expect(result.frameworkLanes).toEqual([
			expect.objectContaining({
				id: 'synthetic-next12-pages',
				framework: 'nextjs',
				routing: 'pages',
			}),
			expect.objectContaining({
				id: 'synthetic-next13-transition-app',
				framework: 'nextjs',
				routing: 'mixed',
			}),
			expect.objectContaining({
				id: 'synthetic-next14-app',
				framework: 'nextjs',
				routing: 'app',
			}),
		]);
		for (const lane of result.frameworkLanes) {
			expect(lane.synthetic).toBe(true);
			for (const field of [
				'provenance',
				'migration',
				'build',
				'browser',
				'locality',
				'compilerBundlerRuntime',
				'tier',
				'pilot',
				'support',
			])
				expect(lane[field]).toBe('not-tested');
		}
	});

	it('emits the Papercups vertical and source application derived from its receipts', async () => {
		const result = await analyzeCorpusConformance({ rootDir: root });
		const verified = await verifyWitnessReactPapercupsEvidence(root);
		const aggregate = JSON.parse(
			await readFile(path.join(root, 'evidence/runs/aggregate.json'), 'utf8'),
		) as { fixtures: Array<Record<string, unknown>> };
		const migrationMember = aggregate.fixtures.find(
			(item) => item.receipt === REACT_PAPERCUPS_RECEIPT_PATH,
		);
		const witnessMember = aggregate.fixtures.find(
			(item) => item.receipt === WITNESS_REACT_PAPERCUPS_RECEIPT_PATH,
		);
		expect(migrationMember).toEqual(
			reactPapercupsAggregateMember(verified.receipt.canonicalReceipt.canonicalDigest),
		);
		expect(witnessMember).toEqual(witnessReactPapercupsAggregateMember(verified.digest));
		expect(result.verticals.at(-9)).toEqual({
			id: 'react-papercups-v1-0-0',
			application: 'papercups',
			framework: 'react',
			receiptPath: WITNESS_REACT_PAPERCUPS_RECEIPT_PATH,
			receiptDigest: verified.digest,
			canonicalReceipt: {
				path: REACT_PAPERCUPS_RECEIPT_PATH,
				canonicalDigest: verified.receipt.canonicalReceipt.canonicalDigest,
				sha256: verified.receipt.canonicalReceipt.sha256,
			},
			runtime: 'node-16.20.2-to-node-24.15.0',
			bundler: 'webpack-4.42.0-to-vite-8.0.16',
			track: 'production-readiness-direct-witness-create-react-app-to-vite8',
			migrationTrack: 'create-react-app-3.4.1-to-vite8-build',
			locality: {
				mode: 'offline',
				scope: 'process-scoped',
				osWideIsolation: false,
				successfulNonLoopback: 0,
			},
			browserProof: 'verified-direct-witness',
			browserRuns: 4,
			behaviorDigest: verified.receipt.runs[0]!.behaviorDigest,
			serviceWorker: 'application-unregister',
			scrollSurface: 'omitted-not-meaningful',
			productionReadiness: 'verified-direct-witness',
			readinessScoreboard: { reactLineage: { ready: 1, total: 4, counted: false }, overall: { ready: 3, total: 12 } },
			designatedPilot: false,
		});
		expect(result.applications.at(-8)).toEqual({
			id: 'papercups',
			source: {
				repository: 'https://github.com/papercups-io/papercups',
				ref: 'refs/tags/v1.0.0',
				revision: '3546a5f60c52fcc86fe9cbcc3bbac07356ba134f',
				archiveSha256: 'f8a6576c0399e1eca5e1936a9e5e5b311798cccf3cb7c6fcce0cecbf8b46ea8f',
				frontendRoot: 'assets',
				license: 'MIT',
				licenseSha256: 'cd94b1bf29eec689bd048f0f202c038d2d3033d80102a7ff47ddf65d2890291c',
			},
			verticals: ['react-papercups-v1-0-0'],
			conformance: {
				browserProof: 'direct-witness-verified',
				runs: 4,
				behaviorDigest: verified.receipt.runs[0]!.behaviorDigest,
				mutation: 'pass',
				mutationRestoration: 'byte-identical',
				zeroServiceWorker: 'application-unregister',
				readinessScoreboard: {
					reactLineage: { ready: 1, total: 4, counted: false },
					overall: { ready: 3, total: 12 },
				},
			},
			boundaries: {
				track: 'production-readiness-direct-witness-create-react-app-to-vite8',
				designatedPilot: false,
				genericReactSupport: 'not-claimed',
				scrollSurface: 'omitted-not-meaningful',
				locality: 'process-scoped-not-os-wide',
			},
		});
		// The T007 Judge counts this browser-proven application, so it is one of
		// the three cells behind the React-lineage numerator.
		expect(result.coverage).toMatchObject({
			productionReadiness: expect.objectContaining({
				reactLineage: { ready: 6, total: 6, counted: true, candidate: 'judge-approved' },
			}),
		});
	});

	it('emits the HospitalRun vertical and source application derived from its receipts', async () => {
		const result = await analyzeCorpusConformance({ rootDir: root });
		const verified = await verifyWitnessReactHospitalrunEvidence(root);
		const aggregate = JSON.parse(
			await readFile(path.join(root, 'evidence/runs/aggregate.json'), 'utf8'),
		) as { fixtures: Array<Record<string, unknown>> };
		const migrationMember = aggregate.fixtures.find(
			(item) => item.receipt === REACT_HOSPITALRUN_RECEIPT_PATH,
		);
		const witnessMember = aggregate.fixtures.find(
			(item) => item.receipt === WITNESS_REACT_HOSPITALRUN_RECEIPT_PATH,
		);
		expect(migrationMember).toEqual(
			reactHospitalrunAggregateMember(verified.receipt.canonicalReceipt.canonicalDigest),
		);
		expect(witnessMember).toEqual(witnessReactHospitalrunAggregateMember(verified.digest));
		expect(result.verticals.at(-8)).toEqual({
			id: 'react-hospitalrun',
			application: 'react-hospitalrun',
			framework: 'react',
			receiptPath: WITNESS_REACT_HOSPITALRUN_RECEIPT_PATH,
			receiptDigest: verified.digest,
			canonicalReceipt: {
				path: REACT_HOSPITALRUN_RECEIPT_PATH,
				canonicalDigest: verified.receipt.canonicalReceipt.canonicalDigest,
				sha256: verified.receipt.canonicalReceipt.sha256,
			},
			runtime: 'node-12.14.1-to-node-24.15.0',
			bundler: 'webpack-4.42.0-to-vite-8.0.16',
			track: 'production-readiness-direct-witness-create-react-app-to-vite8',
			migrationTrack: 'create-react-app-3.4.4-to-vite8-build-and-boot',
			locality: {
				mode: 'offline',
				scope: 'process-scoped',
				osWideIsolation: false,
				successfulNonLoopback: 0,
			},
			browserProof: 'verified-direct-witness',
			browserRuns: 4,
			behaviorDigest: verified.receipt.runs[0]!.behaviorDigest,
			serviceWorker: 'application-register-refused-by-context',
			serviceWorkerDifference: 'recorded-behavioral-migration-difference',
			serviceWorkerDifferenceMasked: false,
			scrollSurface: 'measured-genuine-viewport-scroll',
			productionReadiness: 'verified-direct-witness',
			readinessScoreboard: {
				reactLineage: { ready: 1, total: 4, counted: false },
				overall: { ready: 3, total: 12 },
			},
			designatedPilot: false,
		});
		expect(result.applications.at(-7)).toEqual({
			id: 'react-hospitalrun',
			source: {
				repository: 'https://github.com/HospitalRun/hospitalrun-frontend',
				ref: 'refs/tags/v2.0.0-alpha.7',
				revision: '8156955145551d0366df10faa28e724f3377dea1',
				archiveSha256: 'c9d07e8ee7ffaa174dff597dcecbd00c8eb0b6d525bb7a3f9a7d48e6a46ec306',
				frontendRoot: '.',
				license: 'MIT',
				licenseSha256:
					'460148c79f31dd2a352b401068e0ae512a807cf643edac512eb22cf3342027a3',
			},
			verticals: ['react-hospitalrun'],
			conformance: {
				browserProof: 'direct-witness-verified',
				runs: 4,
				behaviorDigest: verified.receipt.runs[0]!.behaviorDigest,
				mutation: 'pass',
				mutationRestoration: 'byte-identical',
				serviceWorker: 'application-register-refused-by-context',
				serviceWorkerDifference: 'recorded-behavioral-migration-difference',
				serviceWorkerDifferenceMasked: false,
				persistence: {
					store: 'browser-local-pouchdb',
					stubbed: false,
					survivesOnlineReload: true,
				},
				readinessScoreboard: {
					reactLineage: { ready: 1, total: 4, counted: false },
					overall: { ready: 3, total: 12 },
				},
			},
			boundaries: {
				track: 'production-readiness-direct-witness-create-react-app-to-vite8',
				designatedPilot: false,
				genericReactSupport: 'not-claimed',
				scrollSurface: 'measured-genuine-viewport-scroll',
				locality: 'process-scoped-not-os-wide',
			},
		});
		// The T007 Judge counts this browser-proven application, so it is one of
		// the three cells behind the React-lineage numerator.
		expect(result.coverage).toMatchObject({
			productionReadiness: expect.objectContaining({
				reactLineage: { ready: 6, total: 6, counted: true, candidate: 'judge-approved' },
			}),
		});
	});

	it('emits the factoriolab vertical and source application derived from its receipts', async () => {
		const result = await analyzeCorpusConformance({ rootDir: root });
		const verified = await verifyWitnessAngularFactoriolabEvidence(root);
		const aggregate = JSON.parse(
			await readFile(path.join(root, 'evidence/runs/aggregate.json'), 'utf8'),
		) as { fixtures: Array<Record<string, unknown>> };
		const witnessMember = aggregate.fixtures.find(
			(item) => item.receipt === WITNESS_ANGULAR_FACTORIOLAB_RECEIPT_PATH,
		);
		// The lane publishes one member, not a pair: its three build-lane
		// receipts are sealed inside the Witness receipt rather than carried as
		// separate aggregate rows, so no migration member exists to find.
		expect(
			aggregate.fixtures.filter((item) => String(item.id).includes('factoriolab')),
		).toHaveLength(1);
		expect(witnessMember).toEqual(witnessAngularFactoriolabAggregateMember(verified.digest));
		expect(result.verticals.at(-7)).toEqual({
			id: 'angular-factoriolab',
			application: 'angular-factoriolab',
			framework: 'angular',
			receiptPath: WITNESS_ANGULAR_FACTORIOLAB_RECEIPT_PATH,
			receiptDigest: verified.digest,
			canonicalReceipts: verified.receipt.canonicalReceipts.map((bound) => ({
				path: bound.path,
				schemaVersion: bound.schemaVersion,
				digest: bound.digest,
				sha256: bound.sha256,
			})),
			runtime: 'node-12.14.1-to-node-16.20.2',
			bundler: 'angular-cli-10.1-browser-builder-to-angular-16.2-browser-builder',
			track: 'production-readiness-direct-witness-angular10-to-angular16-browser-builder',
			locality: {
				mode: 'offline',
				scope: 'process-scoped',
				osWideIsolation: false,
				successfulNonLoopback: 0,
			},
			browserProof: 'verified-direct-witness',
			browserRuns: 4,
			behaviorDigest: verified.receipt.runs[0]!.behaviorDigest,
			serviceWorker: 'no-service-worker-in-either-lane',
			serviceWorkerMasked: false,
			scrollSurface: 'measured-no-overflowing-document',
			productionReadiness: 'verified-direct-witness',
			readinessScoreboard: {
				angularLineage: { ready: 1, total: 4, counted: false },
				overall: { ready: 3, total: 12 },
			},
			designatedPilot: false,
		});
		expect(result.verticals.at(-7)).not.toHaveProperty('migrationTrack');
		expect(result.applications.at(-6)).toEqual({
			id: 'angular-factoriolab',
			source: {
				repository: 'https://github.com/factoriolab/factoriolab',
				ref: 'none — a bare commit sha was pinned; no tag was requested or relied on',
				revision: '5f54abbdcac518d8ebf7e136c4348384d9b1a2bb',
				rootTreeSha: 'b366ea0d6183d83e175aaa52e3620562c46321b8',
				archiveSha256: '11f2ce939f4be04b11e77b7f12e13d7449bf944b9bfefbeca237c46dea12f7ed',
				archiveBytes: 267218,
				license: 'MIT',
				licenseSha256:
					'd2556dbacc2d52cdda0e8b3ebd15b0492d34028074768b3683815540d17e71af',
			},
			verticals: ['angular-factoriolab'],
			conformance: {
				browserProof: 'direct-witness-verified',
				runs: 4,
				behaviorDigest: verified.receipt.runs[0]!.behaviorDigest,
				mutation: 'pass',
				mutationRestoration: 'byte-identical',
				serviceWorker: 'no-service-worker-in-either-lane',
				serviceWorkerMasked: false,
				persistence: {
					plan: 'url-fragment-encoded',
					preferences: 'browser-local-storage',
					backend: 'none',
					stubbed: false,
					survivesOnlineReload: true,
				},
				readinessScoreboard: {
					angularLineage: { ready: 1, total: 4, counted: false },
					overall: { ready: 3, total: 12 },
				},
			},
			boundaries: {
				track: 'production-readiness-direct-witness-angular10-to-angular16-browser-builder',
				designatedPilot: false,
				genericAngularSupport: 'not-claimed',
				scrollSurface: 'measured-no-overflowing-document',
				locality: 'process-scoped-not-os-wide',
			},
		});
		// The Judge counts this vertical and demotes RealWorld's zero
		// application-file version bump out of the denominator, so after the T016
		// re-freeze the Angular numerator is the four non-demoted counted cells.
		expect(result.coverage).toMatchObject({
			productionReadiness: expect.objectContaining({
				angularLineage: {
					ready: 4,
					total: 4,
					counted: true,
					candidate: 'judge-approved',
				},
			}),
		});
	});

	it('emits the jira-clone vertical and source application derived from its receipts', async () => {
		const result = await analyzeCorpusConformance({ rootDir: root });
		const verified = await verifyWitnessAngularJiraCloneEvidence(root);
		const aggregate = JSON.parse(
			await readFile(path.join(root, 'evidence/runs/aggregate.json'), 'utf8'),
		) as { fixtures: Array<Record<string, unknown>> };
		const witnessMember = aggregate.fixtures.find(
			(item) => item.receipt === WITNESS_ANGULAR_JIRA_CLONE_RECEIPT_PATH,
		);
		// Like factoriolab, the lane publishes one member rather than a pair:
		// its four build-lane receipts are sealed inside the Witness receipt
		// rather than carried as separate aggregate rows, so no migration
		// member exists to find.
		expect(
			aggregate.fixtures.filter((item) => String(item.id).includes('jira-clone')),
		).toHaveLength(1);
		expect(verified.receipt.canonicalReceipts).toHaveLength(4);
		expect(witnessMember).toEqual(witnessAngularJiraCloneAggregateMember(verified.digest));
		expect(result.verticals.at(-6)).toEqual({
			id: 'angular-jira-clone',
			application: 'angular-jira-clone',
			framework: 'angular',
			receiptPath: WITNESS_ANGULAR_JIRA_CLONE_RECEIPT_PATH,
			receiptDigest: verified.digest,
			canonicalReceipts: verified.receipt.canonicalReceipts.map((bound) => ({
				path: bound.path,
				schemaVersion: bound.schemaVersion,
				digest: bound.digest,
				sha256: bound.sha256,
			})),
			runtime: 'node-16.20.2',
			bundler: 'angular-cli-13.2-custom-webpack-browser-builder-to-angular-16.2-browser-builder',
			track: 'production-readiness-direct-witness-angular13-to-angular16-browser-builder',
			// The mocked non-loopback seam count is published beside the zero
			// successful non-loopback requests rather than dropped, because the
			// two together are what the run actually measured.
			locality: {
				mode: 'offline',
				scope: 'process-scoped',
				osWideIsolation: false,
				successfulNonLoopback: 0,
				mockedNonLoopbackSeams: 10,
			},
			browserProof: 'verified-direct-witness',
			browserRuns: 4,
			behaviorDigest: verified.receipt.runs[0]!.behaviorDigest,
			serviceWorker: 'no-service-worker-in-either-lane',
			serviceWorkerMasked: false,
			scrollSurface: 'measured-no-overflowing-document',
			productionReadiness: 'verified-direct-witness',
			readinessScoreboard: {
				angularLineage: { ready: 1, total: 4, counted: false },
				overall: { ready: 3, total: 12 },
			},
			designatedPilot: false,
		});
		expect(result.verticals.at(-6)).not.toHaveProperty('migrationTrack');
		expect(result.applications.at(-5)).toEqual({
			id: 'angular-jira-clone',
			source: {
				repository: 'https://github.com/trungvose/jira-clone-angular',
				ref: 'none — a bare commit sha was pinned; no tag was requested or relied on',
				revision: '059455b9933a236456524925065bce2c295e2d9a',
				rootTreeSha: 'd5a79170609bb7b135a4c146a4565b3e7d53a92b',
				archiveSha256: 'd913ad5d4686b6a236799166c7c781f624b3901a1826304e00c36eca82896bc5',
				archiveBytes: 8048993,
				license: 'MIT',
				licenseSha256:
					'c45956b16a34a9e0c74a93163f497174e373623333e47ce3251b4d0107120b09',
			},
			verticals: ['angular-jira-clone'],
			conformance: {
				browserProof: 'direct-witness-verified',
				runs: 4,
				behaviorDigest: verified.receipt.runs[0]!.behaviorDigest,
				mutation: 'pass',
				mutationRestoration: 'byte-identical',
				serviceWorker: 'no-service-worker-in-either-lane',
				serviceWorkerMasked: false,
				// The board is an in-memory store that writes no browser
				// storage and does not survive an online reload; the row says
				// exactly that rather than borrowing factoriolab's shape.
				persistence: {
					board: 'in-memory-store',
					browserStorage: 'none-written',
					backend: 'none',
					stubbed: false,
					survivesOnlineReload: false,
				},
				readinessScoreboard: {
					angularLineage: { ready: 1, total: 4, counted: false },
					overall: { ready: 3, total: 12 },
				},
			},
			boundaries: {
				track: 'production-readiness-direct-witness-angular13-to-angular16-browser-builder',
				designatedPilot: false,
				genericAngularSupport: 'not-claimed',
				scrollSurface: 'measured-no-overflowing-document',
				locality: 'process-scoped-not-os-wide',
			},
		});
		// After the T016 re-freeze all four non-demoted Angular cells are counted;
		// the demoted RealWorld cell stays in the ledger with its reason and out of
		// the denominator.
		expect(result.coverage).toMatchObject({
			productionReadiness: expect.objectContaining({
				angularLineage: {
					ready: 4,
					total: 4,
					counted: true,
					candidate: 'judge-approved',
				},
			}),
		});
	});

	it('emits the memos vertical and source application derived from its receipts', async () => {
		const result = await analyzeCorpusConformance({ rootDir: root });
		const verified = await verifyWitnessReactMemosEvidence(root);
		const aggregate = JSON.parse(
			await readFile(path.join(root, 'evidence/runs/aggregate.json'), 'utf8'),
		) as { fixtures: Array<Record<string, unknown>> };
		// One member, not a pair: the build-lane receipt is sealed inside the
		// Witness receipt by the sha256 of its exact bytes, because that receipt
		// declares no canonical digest of its own.
		expect(
			aggregate.fixtures.filter((item) => String(item.id).includes('memos')),
		).toHaveLength(1);
		expect(verified.receipt.canonicalReceipt.binding).toBe('sha256-over-the-exact-bytes');
		expect(
			aggregate.fixtures.find((item) => item.receipt === WITNESS_REACT_MEMOS_RECEIPT_PATH),
		).toEqual(witnessReactMemosAggregateMember(verified.digest));
		expect(result.verticals.at(-5)).toEqual({
			id: 'react-memos-v0-1-3',
			application: 'react-memos',
			framework: 'react',
			receiptPath: WITNESS_REACT_MEMOS_RECEIPT_PATH,
			receiptDigest: verified.digest,
			canonicalReceipt: {
				path: verified.receipt.canonicalReceipt.path,
				sha256: verified.receipt.canonicalReceipt.sha256,
				binding: verified.receipt.canonicalReceipt.binding,
				bindingReason: verified.receipt.canonicalReceipt.bindingReason,
			},
			runtime: 'node-16.20.2-to-node-24.15.0',
			bundler: 'vite-2.9.5-to-vite-8.0.16',
			track: 'production-readiness-direct-witness-old-vite-origin-to-vite8',
			// The first React-lineage vertical whose origin bundler is Vite: the
			// row says so with the receipt's own measured class.
			migrationClass: 'OLD-VITE-ORIGIN',
			// The journeys were answered by a frozen synthetic projection, and
			// the row publishes which one rather than leaving it in the receipt.
			projection: {
				label: 'synthetic-fixture-evidence-data',
				behaviorDigest: verified.receipt.projection.behaviorDigest,
				seedSha256: verified.receipt.projection.seedSha256,
				pinnedRevision: verified.receipt.projection.pinnedRevision,
			},
			locality: {
				mode: 'offline',
				scope: 'process-scoped',
				osWideIsolation: false,
				successfulNonLoopback: 0,
			},
			browserProof: 'verified-direct-witness',
			browserRuns: 4,
			behaviorDigest: verified.receipt.runs[0]!.behaviorDigest,
			scrollSurface: 'measured-no-overflowing-document',
			productionReadiness: 'verified-direct-witness',
			readinessScoreboard: {
				reactLineage: { ready: 1, total: 4, counted: false },
				overall: { ready: 3, total: 12 },
			},
			designatedPilot: false,
		});
		// The application never registers a service worker and the receipt
		// measures none, so the row emits no service-worker field rather than a
		// manufactured one.
		expect(result.verticals.at(-5)).not.toHaveProperty('serviceWorker');
		expect(result.verticals.at(-5)).not.toHaveProperty('migrationTrack');
		expect(result.applications.at(-4)).toEqual({
			id: 'react-memos',
			source: {
				repository: 'https://github.com/usememos/memos',
				ref: 'refs/tags/v0.1.3',
				tagKind: 'lightweight',
				tagVerification: 'not-applicable-no-tag-object',
				revision: '565fe0cc567c02deb59fc04830df707ea7476d52',
				archiveSha256:
					'184834df7e2ea0272d21b4b0bfd7366986bc0aded740442aac91ca58d270f391',
				frontendRoot: 'web',
				monorepo: true,
				license: 'MIT',
				licenseNote:
					'the grant rests on the repository-root LICENSE file; web/package.json declares no license field',
			},
			verticals: ['react-memos-v0-1-3'],
			conformance: {
				browserProof: 'direct-witness-verified',
				runs: 4,
				behaviorDigest: verified.receipt.runs[0]!.behaviorDigest,
				mutation: 'pass',
				mutationRestoration: 'byte-identical',
				migrationClass: 'OLD-VITE-ORIGIN',
				eraBuildDeviation:
					verified.receipt.eraBuildDeviation.declaredBuildCommandOutcomeAtThisRevision,
				projection: {
					label: 'synthetic-fixture-evidence-data',
					behaviorDigest: verified.receipt.projection.behaviorDigest,
					seedSha256: verified.receipt.projection.seedSha256,
					pinnedRevision: verified.receipt.projection.pinnedRevision,
				},
				readinessScoreboard: {
					reactLineage: { ready: 1, total: 4, counted: false },
					overall: { ready: 3, total: 12 },
				},
			},
			boundaries: {
				track: 'production-readiness-direct-witness-old-vite-origin-to-vite8',
				designatedPilot: false,
				genericReactSupport: 'not-claimed',
				scrollSurface: 'measured-no-overflowing-document',
				locality: 'process-scoped-not-os-wide',
			},
		});
	});

	it('emits the killedbygoogle v3 vertical and source application derived from its receipts', async () => {
		const result = await analyzeCorpusConformance({ rootDir: root });
		const verified = await verifyWitnessNextKilledbygoogleV3Evidence(root);
		const aggregate = JSON.parse(
			await readFile(path.join(root, 'evidence/runs/aggregate.json'), 'utf8'),
		) as { fixtures: Array<Record<string, unknown>> };
		expect(
			aggregate.fixtures.find(
				(item) => item.receipt === WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECEIPT_PATH,
			),
		).toEqual(witnessNextKilledbygoogleV3AggregateMember(verified.digest));
		// The earlier killedbygoogle vertical pins the same revision, so this
		// proof joins that source application rather than opening a new one.
		const earlier = result.applications.find((item) => item.id === 'killedbygoogle');
		expect(earlier).toBeDefined();
		expect((earlier?.source as Record<string, unknown>).revision).toBe(
			verified.receipt.source.revision,
		);
		expect(result.verticals.at(-4)).toEqual({
			id: 'next-killedbygoogle-v3-0-0',
			application: 'killedbygoogle',
			framework: 'next',
			receiptPath: WITNESS_NEXT_KILLEDBYGOOGLE_V3_RECEIPT_PATH,
			receiptDigest: verified.digest,
			canonicalReceipt: {
				path: verified.receipt.canonicalReceipt.path,
				schemaVersion: verified.receipt.canonicalReceipt.schemaVersion,
				sha256: verified.receipt.canonicalReceipt.sha256,
				eraLaneDigest: verified.receipt.canonicalReceipt.eraLaneDigest,
				targetLaneDigest: verified.receipt.canonicalReceipt.targetLaneDigest,
			},
			runtime: 'node-16.20.2',
			bundler: 'next-12.0.10-vendored-webpack-5-to-vite-8.0.16-rolldown',
			track: 'production-readiness-direct-witness-next12-static-export-to-vite8-client-build',
			locality: {
				mode: 'offline',
				scope: 'process-scoped',
				osWideIsolation: false,
				successfulNonLoopback: 0,
				mockedNonLoopbackSeams: 3,
			},
			browserProof: 'verified-direct-witness',
			browserRuns: 4,
			behaviorDigest: verified.receipt.runs[0]!.behaviorDigest,
			serviceWorker: 'no-service-worker-in-either-lane',
			serviceWorkerMasked: false,
			// One lane ships a pre-rendered document and the other mounts it in
			// the client: the difference is published, not repaired.
			documentDelivery: {
				baseline: 'pre-rendered-application-document',
				migrated: 'client-mounted-application-document',
				parityOracle: 'settled-dom-and-behaviour',
				byteParity: 'not-claimed',
			},
			scrollSurface: 'measured-genuine-viewport-scroll',
			productionReadiness: 'verified-direct-witness',
			readinessScoreboard: {
				nextLineage: { ready: 0, total: 1, counted: false },
				overall: { ready: 3, total: 12 },
			},
			designatedPilot: false,
		});
		expect(result.verticals.at(-4)).not.toHaveProperty('migrationTrack');
		// The proof is a second vertical on ONE immutable source, not an
		// eleventh source application: the same repository at the same revision
		// with the same archive digest is not two applications, so the summary
		// gains a vertical and no application.
		expect(
			result.applications.filter((item) => item.id === 'next-killedbygoogle-v3-0-0'),
		).toEqual([]);
		const killedbygoogle = result.applications.find((item) => item.id === 'killedbygoogle');
		expect(killedbygoogle?.source).toEqual({
			repository: 'https://github.com/codyogden/killedbygoogle',
			revision: '56809c31592e6ca1edce8af9bfe842fbcdf71f4d',
			archiveSha256: 'c28878d0f65b56aa595763c852477fb0c1e3533e5c7f7ea9daa2be16f102368d',
			license: 'MIT',
		});
		expect(verified.receipt.source.revision).toBe(
			(killedbygoogle?.source as Record<string, unknown>).revision,
		);
		expect(verified.receipt.source.archiveSha256).toBe(
			(killedbygoogle?.source as Record<string, unknown>).archiveSha256,
		);
		expect(killedbygoogle?.verticals).toEqual([
			'next-killedbygoogle-derived-state-to-memo',
			'next-killedbygoogle-v3-0-0',
		]);
		// The earlier vertical's own conformance block is untouched; the browser
		// proof is published beside it rather than over it.
		expect(killedbygoogle?.conformance).toEqual({
			productionBuild: true,
			browserJourneys: 4,
			mutationRestoration: 'verified',
			productionOutputConformance: 'verified',
			directWitness: {
				vertical: 'next-killedbygoogle-v3-0-0',
				track: 'production-readiness-direct-witness-next12-static-export-to-vite8-client-build',
				browserProof: 'direct-witness-verified',
				runs: 4,
				behaviorDigest: verified.receipt.runs[0]!.behaviorDigest,
				mutation: 'pass',
				mutationRestoration: 'byte-identical',
				serviceWorker: 'no-service-worker-in-either-lane',
				serviceWorkerMasked: false,
				documentDelivery: {
					baseline: 'pre-rendered-application-document',
					migrated: 'client-mounted-application-document',
					parityOracle: 'settled-dom-and-behaviour',
					byteParity: 'not-claimed',
				},
				persistence: {
					store: 'in-memory-react-state',
					browserStorage: 'none-written',
					backend: 'none',
					stubbed: false,
					survivesOnlineReload: false,
				},
				scrollSurface: 'measured-genuine-viewport-scroll',
				readinessScoreboard: {
					nextLineage: { ready: 0, total: 1, counted: false },
					overall: { ready: 3, total: 12 },
				},
			},
		});
	});

	it('emits the LinkFree vertical and source application derived from its receipts', async () => {
		const result = await analyzeCorpusConformance({ rootDir: root });
		const verified = await verifyWitnessReactLinkfreeEvidence(root);
		const aggregate = JSON.parse(
			await readFile(path.join(root, 'evidence/runs/aggregate.json'), 'utf8'),
		) as { fixtures: Array<Record<string, unknown>> };
		expect(
			aggregate.fixtures.filter((item) => String(item.id).includes('linkfree')),
		).toHaveLength(1);
		expect(
			aggregate.fixtures.find((item) => item.receipt === WITNESS_REACT_LINKFREE_RECEIPT_PATH),
		).toEqual(witnessReactLinkfreeAggregateMember(verified.digest));
		expect(result.verticals.at(-3)).toEqual({
			id: 'react-linkfree-v0-72-0',
			application: 'react-linkfree',
			framework: 'react',
			receiptPath: WITNESS_REACT_LINKFREE_RECEIPT_PATH,
			receiptDigest: verified.digest,
			canonicalReceipt: {
				path: verified.receipt.canonicalReceipt.path,
				canonicalDigest: verified.receipt.canonicalReceipt.canonicalDigest,
				sha256: verified.receipt.canonicalReceipt.sha256,
			},
			runtime: 'node-16.20.2-to-node-24.15.0',
			bundler: 'webpack-5.73.0-to-vite-8.0.16',
			track: 'production-readiness-direct-witness-create-react-app-5-to-vite8',
			// The synthetic corpus is the boundary of what this proof proves, so
			// the vertical carries the ruling rather than leaving it behind.
			corpusRuling: {
				ruling: 'synthetic-corpus',
				dataset: 'fixtures/react-linkfree-v0-72-0/witness-corpus',
				seam: verified.receipt.corpusRuling.seam,
				sameCorpusInBothLanes: true,
				applicationSourceEdits: 0,
				realProfileDataRendered: false,
				proves: verified.receipt.corpusRuling.proves,
			},
			locality: {
				mode: 'offline',
				scope: 'process-scoped',
				osWideIsolation: false,
				successfulNonLoopback: 0,
			},
			browserProof: 'verified-direct-witness',
			browserRuns: 4,
			behaviorDigest: verified.receipt.runs[0]!.behaviorDigest,
			scrollSurface: 'measured-genuine-viewport-scroll',
			productionReadiness: 'verified-direct-witness',
			readinessScoreboard: {
				reactLineage: { ready: 1, total: 4, counted: false },
				overall: { ready: 3, total: 12 },
			},
			designatedPilot: false,
		});
		expect(result.verticals.at(-3)).not.toHaveProperty('migrationTrack');
		expect(result.applications.at(-3)).toEqual({
			id: 'react-linkfree',
			source: {
				repository: 'https://github.com/EddieHubCommunity/BioDrop',
				repositoryAtPinnedRevision: 'https://github.com/EddieHubCommunity/LinkFree',
				nearestTag: 'refs/tags/v0.72.0',
				pinnedRevisionIsTagTarget: false,
				revision: '367d77297b5753644e11ecd22cf80e59c87b0dc8',
				archiveSha256:
					'7cef1a1c2ae251e3738d8b8a6c5fe94b118bf13d3a5bae7b522b8db9c1c334ef',
				frontendRoot: '.',
				license: 'MIT',
				licenseSha256:
					'3b5b430ae7e6151220591e69a8a056482a13d36518357c025619cf0d60be50bf',
			},
			verticals: ['react-linkfree-v0-72-0'],
			conformance: {
				browserProof: 'direct-witness-verified',
				runs: 4,
				behaviorDigest: verified.receipt.runs[0]!.behaviorDigest,
				mutation: 'pass',
				mutationRestoration: 'byte-identical',
				corpusRuling: {
					ruling: 'synthetic-corpus',
					dataset: 'fixtures/react-linkfree-v0-72-0/witness-corpus',
					seam: verified.receipt.corpusRuling.seam,
					sameCorpusInBothLanes: true,
					applicationSourceEdits: 0,
					realProfileDataRendered: false,
					proves: verified.receipt.corpusRuling.proves,
				},
				stagedCorpus: {
					policy: 'synthetic-profile-corpus-through-the-applications-own-codegen',
					replacedPaths: ['data/', 'list.json'],
					bundlerAuthoredPaths: 18,
					bundlerAuthoredBytesUnchanged: true,
				},
				readinessScoreboard: {
					reactLineage: { ready: 1, total: 4, counted: false },
					overall: { ready: 3, total: 12 },
				},
			},
			boundaries: {
				track: 'production-readiness-direct-witness-create-react-app-5-to-vite8',
				designatedPilot: false,
				genericReactSupport: 'not-claimed',
				scrollSurface: 'measured-genuine-viewport-scroll',
				locality: 'process-scoped-not-os-wide',
			},
		});
	});

	it('counts both lineage numerators off the Judge ledger and keeps the declined cell visible', async () => {
		const result = await analyzeCorpusConformance({ rootDir: root });
		const readiness = (result.coverage as Record<string, unknown>)
			.productionReadiness as Record<string, unknown>;
		const ledger = readiness.judgeCounting as Array<{
			cell: string;
			application: string;
			lineage: string;
			witnessReceipt: string;
			counted: boolean;
			demoted: boolean;
			reason: string;
			reactSubTag?: string;
		}>;
		// Every cell carries a reason, counted or not: the ledger is the record
		// of the decision, not just of the score.
		expect(ledger.every((cell) => cell.reason.length > 0)).toBe(true);
		expect(ledger.map((cell) => cell.cell)).toEqual([
			'react-boilerplate',
			'react-papercups-v1-0-0',
			'react-hospitalrun',
			'angular-realworld-v15-to-v16',
			'angular-factoriolab',
			'angular-jira-clone',
			'react-memos-v0-1-3',
			'next-killedbygoogle-v3-0-0',
			'react-linkfree-v0-72-0',
			'angular-tiny-translator-v0-12-0',
			'angular-super-productivity-v2-13-15',
		]);
		// After the T016 re-freeze the five newest verticals are counted: their
		// Witness receipts are verified, they carry a reason, and each moves its
		// lineage numerator. next-killedbygoogle-v3-0-0 is reclassified from Next
		// to the React lineage (legacy-Next member) per the charter oracle.
		for (const cell of [
			'react-memos-v0-1-3',
			'next-killedbygoogle-v3-0-0',
			'react-linkfree-v0-72-0',
			'angular-tiny-translator-v0-12-0',
			'angular-super-productivity-v2-13-15',
		])
			expect(ledger.find((entry) => entry.cell === cell)).toMatchObject({ counted: true });
		// The reclassified legacy-Next cell counts inside React with its
		// informational sub-tag, not a separate Next lineage.
		expect(ledger.find((entry) => entry.cell === 'next-killedbygoogle-v3-0-0')).toMatchObject({
			lineage: 'react',
			counted: true,
			reactSubTag: 'legacy-next',
		});
		expect((readiness.reactLineage as { ready: number }).ready).toBe(6);
		// The olderNext separate numerator is retired, not deleted: it is recorded
		// as an informational React sub-tag rather than a standing 0/4 gate.
		expect(readiness.olderNext).toMatchObject({
			retired: true,
			reclassifiedInto: 'reactLineage',
			reactSubTag: 'legacy-next',
		});
		// RealWorld is demoted, not deleted: its Witness receipt is still the
		// cell's evidence, the reason names the measurement, and it is excluded
		// from the Angular denominator.
		const realworld = ledger.find((cell) => cell.cell === 'angular-realworld-v15-to-v16');
		expect(realworld).toMatchObject({
			counted: false,
			demoted: true,
			witnessReceipt: 'evidence/runs/witness-angular-realworld/receipt.json',
		});
		expect(realworld?.reason).toContain('applicationFilesChanged=0');
		// The numerators are the counted cells and the denominators the non-demoted
		// cells, and nothing else.
		for (const lineage of ['react', 'angular']) {
			const score = readiness[`${lineage}Lineage`] as { ready: number; total: number };
			expect(score.ready).toBe(
				ledger.filter((cell) => cell.lineage === lineage && cell.counted).length,
			);
			expect(score.total).toBe(
				ledger.filter((cell) => cell.lineage === lineage && !cell.demoted).length,
			);
		}
		expect((readiness.reactLineage as { total: number }).total).toBe(6);
		expect((readiness.angularLineage as { total: number }).total).toBe(4);
		expect(
			result.applications.find((application) => application.id === 'angular-realworld'),
		).toBeDefined();
	});

	it('refuses a jira-clone aggregate digest that does not match its receipt', async () => {
		const directory = await corpusCopy('jira-clone-digest-rebind');
		try {
			await mutateJson(directory, 'evidence/runs/aggregate.json', (value) => {
				const fixture = (value.fixtures as Array<Record<string, unknown>>).find(
					(item) => item.receipt === WITNESS_ANGULAR_JIRA_CLONE_RECEIPT_PATH,
				);
				if (!fixture) throw new Error('jira-clone witness member missing');
				fixture.digest = '0'.repeat(64);
			});
			await expect(analyzeCorpusConformance({ rootDir: directory })).rejects.toThrow(
				/jira-clone/,
			);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('refuses a factoriolab aggregate digest that does not match its receipt', async () => {
		const directory = await corpusCopy('factoriolab-digest-rebind');
		try {
			await mutateJson(directory, 'evidence/runs/aggregate.json', (value) => {
				const fixture = (value.fixtures as Array<Record<string, unknown>>).find(
					(item) => item.receipt === WITNESS_ANGULAR_FACTORIOLAB_RECEIPT_PATH,
				);
				if (!fixture) throw new Error('factoriolab witness member missing');
				fixture.digest = '0'.repeat(64);
			});
			await expect(analyzeCorpusConformance({ rootDir: directory })).rejects.toThrow(
				/factoriolab/,
			);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('refuses a HospitalRun aggregate digest that does not match its receipt', async () => {
		const directory = await corpusCopy('hospitalrun-digest-rebind');
		try {
			await mutateJson(directory, 'evidence/runs/aggregate.json', (value) => {
				const fixture = (value.fixtures as Array<Record<string, unknown>>).find(
					(item) => item.receipt === WITNESS_REACT_HOSPITALRUN_RECEIPT_PATH,
				);
				if (!fixture) throw new Error('HospitalRun witness member missing');
				fixture.digest = '0'.repeat(64);
			});
			await expect(analyzeCorpusConformance({ rootDir: directory })).rejects.toThrow(
				/HospitalRun/,
			);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('refuses a Papercups aggregate digest that does not match its receipt', async () => {
		const directory = await corpusCopy('papercups-digest-rebind');
		try {
			await mutateJson(directory, 'evidence/runs/aggregate.json', (value) => {
				const fixture = (value.fixtures as Array<Record<string, unknown>>).find(
					(item) => item.receipt === WITNESS_REACT_PAPERCUPS_RECEIPT_PATH,
				);
				if (!fixture) throw new Error('Papercups witness member missing');
				fixture.digest = '0'.repeat(64);
			});
			await expect(analyzeCorpusConformance({ rootDir: directory })).rejects.toThrow(
				/Papercups/,
			);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('derives only the exact prepublication, postintegration and readiness states', async () => {
		const aggregate = JSON.parse(
			await readFile(path.join(root, 'evidence/runs/aggregate.json'), 'utf8'),
		) as { fixtures: Array<Record<string, unknown>> };
		const before = prepublicationFixtures(aggregate.fixtures);
		expect(deriveCorpusTransactionState(before)).toEqual({
			kind: 'prepublication',
			nextKilledByGoogleIntegrated: false,
			angularRealworldWitnessIntegrated: false,
			reactBoilerplateWitnessIntegrated: false,
			nextKilledByGoogleWitnessIntegrated: false,
			verticals: 10,
			sourceApplications: 3,
			receipts: 10,
			resolvedDependencies: 23,
		});
		const nextMember = nextKilledByGoogleAggregateMember(killedByGoogleDigest);
		const afterNext = [...before.slice(0, 8), nextMember, ...before.slice(8)];
		expect(deriveCorpusTransactionState(afterNext)).toEqual({
			kind: 'postintegration',
			nextKilledByGoogleIntegrated: true,
			angularRealworldWitnessIntegrated: false,
			reactBoilerplateWitnessIntegrated: false,
			nextKilledByGoogleWitnessIntegrated: false,
			verticals: 11,
			sourceApplications: 4,
			receipts: 11,
			resolvedDependencies: 24,
		});
		const witnessMember = witnessAngularRealworldAggregateMember('9'.repeat(64));
		const readiness = [...before.slice(0, 8), witnessMember, nextMember, ...before.slice(8)];
		expect(deriveCorpusTransactionState(readiness)).toEqual({
			kind: 'production-readiness',
			nextKilledByGoogleIntegrated: true,
			angularRealworldWitnessIntegrated: true,
			reactBoilerplateWitnessIntegrated: false,
			nextKilledByGoogleWitnessIntegrated: false,
			verticals: 11,
			sourceApplications: 4,
			receipts: 12,
			resolvedDependencies: 25,
		});
		const reactMember = witnessReactBoilerplateAggregateMember('8'.repeat(64));
		expect(deriveCorpusTransactionState([...readiness, reactMember])).toEqual({
			kind: 'react-candidate',
			nextKilledByGoogleIntegrated: true,
			angularRealworldWitnessIntegrated: true,
			reactBoilerplateWitnessIntegrated: true,
			nextKilledByGoogleWitnessIntegrated: false,
			verticals: 11,
			sourceApplications: 4,
			receipts: 13,
			resolvedDependencies: 26,
		});
		const nextWitnessMember = witnessNextKilledByGoogleAggregateMember('7'.repeat(64));
		const nextCandidate = [...readiness, reactMember, nextWitnessMember];
		expect(deriveCorpusTransactionState(nextCandidate)).toEqual({
			kind: 'next-candidate',
			nextKilledByGoogleIntegrated: true,
			angularRealworldWitnessIntegrated: true,
			reactBoilerplateWitnessIntegrated: true,
			nextKilledByGoogleWitnessIntegrated: true,
			verticals: 11,
			sourceApplications: 4,
			receipts: 14,
			resolvedDependencies: 27,
		});
		const avataaarsMember = reactAvataaarsCompatibilityAggregateMember('6'.repeat(64));
		expect(deriveCorpusTransactionState([...nextCandidate, avataaarsMember])).toEqual({
			kind: 'react-avataaars-candidate',
			nextKilledByGoogleIntegrated: true,
			angularRealworldWitnessIntegrated: true,
			reactBoilerplateWitnessIntegrated: true,
			nextKilledByGoogleWitnessIntegrated: true,
			verticals: 11,
			sourceApplications: 4,
			receipts: 15,
			resolvedDependencies: 28,
		});
		for (const fixtures of [
			[...before, before[0]],
			[...before, { ...nextMember, framework: 'nextjs' }],
			[...before, { ...nextMember, receipt: 'evidence/runs/misplaced.json' }],
			[...before, witnessMember],
			[...readiness, witnessMember],
			[
				...readiness.slice(0, 8),
				{ ...witnessMember, digest: 'malformed' },
				...readiness.slice(9),
			],
			[
				...readiness.slice(0, 8),
				{ ...witnessMember, framework: 'angularjs' },
				...readiness.slice(9),
			],
			[
				...readiness.slice(0, 8),
				{ ...witnessMember, receipt: 'evidence/runs/witness-angular-realworld/wrong.json' },
				...readiness.slice(9),
			],
			[...before, { id: 'unknown', receipt: 'unknown', digest: 'a'.repeat(64) }],
			[...readiness, { id: 'unknown', receipt: 'unknown', digest: 'a'.repeat(64) }],
			[reactMember, ...readiness],
			[...readiness, { ...reactMember, framework: 'preact' }],
			[...readiness, reactMember, reactMember],
			[nextWitnessMember, ...readiness, reactMember],
			[...readiness, reactMember, { ...nextWitnessMember, digest: 'A'.repeat(64) }],
			[...readiness, reactMember, nextWitnessMember, nextWitnessMember],
		])
			expect(() => deriveCorpusTransactionState(fixtures)).toThrow();
	});

	it('does not read a stray Killed by Google receipt before aggregate integration', async () => {
		const directory = await corpusCopy('stray-killedbygoogle');
		try {
			await mutateJson(directory, 'evidence/runs/aggregate.json', (value) => {
				value.fixtures = prepublicationFixtures(
					value.fixtures as Array<Record<string, unknown>>,
				);
			});
			await writeFile(
				path.join(
					directory,
					'evidence/runs/next-killedbygoogle-derived-state-to-memo/receipt.json',
				),
				'not-json',
			);
			const result = await analyzeCorpusConformance({ rootDir: directory });
			expect(result.summary).toMatchObject({ verticals: 10, sourceApplications: 3 });
			const aggregateFile = path.join(directory, 'evidence/runs/aggregate.json');
			const aggregate = JSON.parse(await readFile(aggregateFile, 'utf8')) as {
				fixtures: Array<Record<string, unknown>>;
			};
			aggregate.fixtures.push(nextKilledByGoogleAggregateMember(killedByGoogleDigest));
			await writeFile(aggregateFile, `${JSON.stringify(aggregate, null, 2)}\n`);
			await expect(analyzeCorpusConformance({ rootDir: directory })).rejects.toThrow();
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('rejects missing, extra, and aggregate-digest-tampered receipts', async () => {
		for (const [label, transform] of [
			[
				'missing',
				(value: Record<string, unknown>) => {
					value.fixtures = (value.fixtures as Array<Record<string, unknown>>).filter(
						(fixture) => fixture.id !== 'react-boilerplate-v4',
					);
				},
			],
			[
				'extra',
				(value: Record<string, unknown>) => {
					(value.fixtures as unknown[]).push({
						id: 'unknown',
						receipt: 'evidence/runs/unknown.json',
						digest: '0'.repeat(64),
						result: 'pass',
					});
				},
			],
			[
				'digest',
				(value: Record<string, unknown>) => {
					const fixture = (value.fixtures as Array<Record<string, unknown>>)[0];
					if (fixture) fixture.digest = '0'.repeat(64);
				},
			],
		] as const) {
			const directory = await corpusCopy(label);
			try {
				await mutateJson(directory, 'evidence/runs/aggregate.json', (value) => {
					value.fixtures = prepublicationFixtures(
						value.fixtures as Array<Record<string, unknown>>,
					);
					transform(value);
				});
				await expect(analyzeCorpusConformance({ rootDir: directory })).rejects.toThrow();
			} finally {
				await rm(directory, { recursive: true, force: true });
			}
		}
	});

	it('rejects linked-artifact tampering and user-observable behavior drift', async () => {
		for (const label of ['artifact-tamper', 'behavior-drift']) {
			const directory = await corpusCopy(label);
			try {
				const journey = 'evidence/runs/react-boilerplate-v4-vite8/artifacts/journey.json';
				await mutateJson(directory, journey, (value) => {
					const rows = value as unknown as Array<Record<string, unknown>>;
					if (rows[0])
						rows[0][label === 'behavior-drift' ? 'selectedLocale' : 'result'] =
							label === 'behavior-drift' ? 'fr' : 'fail';
				});
				await expect(analyzeCorpusConformance({ rootDir: directory })).rejects.toThrow(
					'Artifact digest mismatch',
				);
			} finally {
				await rm(directory, { recursive: true, force: true });
			}
		}
	});

	it('rejects source divergence and attempted application-count inflation', async () => {
		for (const label of ['source-divergence', 'application-count-inflation']) {
			const directory = await corpusCopy(label);
			try {
				await mutateJson(
					directory,
					'evidence/runs/react-boilerplate-v4-vite8/t028-run.json',
					(value) => {
						const source = value.source as Record<string, unknown>;
						source.revision =
							label === 'source-divergence' ? 'different-revision' : 'third-source';
					},
				);
				await expect(analyzeCorpusConformance({ rootDir: directory })).rejects.toThrow(
					'Canonical digest mismatch',
				);
			} finally {
				await rm(directory, { recursive: true, force: true });
			}
		}
	});

	it('rejects conformance canonical-digest tampering', async () => {
		const result = await analyzeCorpusConformance({ rootDir: root });
		result.summary.sourceApplications = 2 as 3;
		expect(() => verifyCorpusConformanceDigest(result)).toThrow('canonical digest mismatch');
	});

	it('rejects recomputed composed artifact and aggregate rebinding', async () => {
		for (const [label, name, mutate] of [
			[
				'composition-publish',
				'composition.json',
				(value: Record<string, unknown>) => (value.publish = 'five-sequential-writes'),
			],
			[
				'transform-file',
				'transform.json',
				(value: Record<string, unknown>) =>
					((value.changedFiles as string[])[0] = 'app/containers/Wrong/index.js'),
			],
			[
				'migration-diff-adapter',
				'migration-diff.json',
				(value: Record<string, unknown>) => (value.harnessOnlyAdapterExcluded = false),
			],
			[
				'journey-method',
				'journey.json',
				(value: Record<string, unknown>) =>
					((
						(value as unknown as Array<Record<string, unknown>>)[0]!
							.syntheticRequests as Array<Record<string, unknown>>
					)[0]!.method = 'POST'),
			],
			[
				'mutation-renamed',
				'mutation.json',
				(value: Record<string, unknown>) =>
					((value.mutations as Array<Record<string, unknown>>)[0]!.seam = 'renamed'),
			],
			[
				'mutation-missing',
				'mutation.json',
				(value: Record<string, unknown>) =>
					(value.mutations as Array<Record<string, unknown>>).splice(1, 1),
			],
			[
				'mutation-reordered',
				'mutation.json',
				(value: Record<string, unknown>) =>
					(value.mutations as Array<Record<string, unknown>>).reverse(),
			],
			[
				'mutation-extra',
				'mutation.json',
				(value: Record<string, unknown>) =>
					(value.mutations as Array<Record<string, unknown>>).push({
						seam: 'extra',
						result: 'intended-failure',
						restoration: 'byte-identical',
						restoredSha256: '0'.repeat(64),
						reproduced: 'pass',
					}),
			],
			[
				'mutation-restoration-rebound',
				'mutation.json',
				(value: Record<string, unknown>) =>
					((value.mutations as Array<Record<string, unknown>>)[0]!.restoredSha256 =
						'0'.repeat(64)),
			],
		] as const) {
			const directory = await corpusCopy(`rebound-${label}`);
			try {
				await rebindComposedArtifact(directory, name, mutate);
				await expect(analyzeCorpusConformance({ rootDir: directory })).rejects.toThrow(
					'Aggregate membership mismatch',
				);
			} finally {
				await rm(directory, { recursive: true, force: true });
			}
		}
	});

	it('rejects composed receipt-path rebinding even with copied bytes', async () => {
		const directory = await corpusCopy('receipt-path-rebind');
		try {
			const aggregateFile = path.join(directory, 'evidence/runs/aggregate.json');
			const aggregate = JSON.parse(await readFile(aggregateFile, 'utf8')) as Record<
				string,
				any
			>;
			const fixture = aggregate.fixtures.find(
				(value: Record<string, unknown>) => value.id === 'react-boilerplate-v4-composed',
			) as Record<string, unknown>;
			fixture.receipt = 'evidence/runs/react-boilerplate-v4-composed/rebound.json';
			await writeFile(aggregateFile, `${JSON.stringify(aggregate, null, 2)}\n`);
			await expect(analyzeCorpusConformance({ rootDir: directory })).rejects.toThrow(
				'Aggregate is missing receipt',
			);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('rejects recomputed PhoneCat Vite inventory and preparation rebindings', async () => {
		for (const [name, mutate] of [
			[
				'vite-build.json',
				(value: Record<string, unknown>) => {
					const first = value.first as Record<string, unknown>;
					(first.entries as unknown[]).pop();
				},
			],
			[
				'preparation.json',
				(value: Record<string, unknown>) => {
					const input = value.libraryInput as Record<string, unknown>;
					input.treeSha256 = '0'.repeat(64);
				},
			],
			[
				'transform-order.json',
				(value: Record<string, unknown>) => {
					(value.changedFiles as string[])[0] = 'app/rebound.js';
				},
			],
		] as const) {
			const directory = await corpusCopy(`phonecat-vite-${name}`);
			try {
				await rebindPhonecatViteArtifact(directory, name, mutate);
				await expect(analyzeCorpusConformance({ rootDir: directory })).rejects.toThrow();
			} finally {
				await rm(directory, { recursive: true, force: true });
			}
		}
	});

	it('publishes the failed holdout, counted in no numerator and hidden from none', async () => {
		const result = await analyzeCorpusConformance({ rootDir: root });
		const verified = await verifyHoldoutReactCypressRwaEvidence(root);
		const expected = holdoutReactCypressRwaCorpusRecord(verified.receipt);
		const pigalleryVerified = await verifyHoldoutAngularPigallery2Evidence(root);
		const pigalleryExpected = holdoutAngularPigallery2CorpusRecord(pigalleryVerified.receipt);
		const eshopVerified = await verifyHoldoutAngularEshopWebspaEvidence(root);
		const eshopExpected = holdoutAngularEshopWebspaCorpusRecord(eshopVerified.receipt);
		const readiness = (result.coverage as Record<string, unknown>)
			.productionReadiness as Record<string, unknown>;
		expect(readiness.holdouts).toEqual([expected, pigalleryExpected, eshopExpected]);
		const aggregate = JSON.parse(
			await readFile(path.join(root, 'evidence/runs/aggregate.json'), 'utf8'),
		) as { fixtures: Array<Record<string, unknown>>; holdouts: unknown[] };
		expect(aggregate.holdouts).toEqual([expected, pigalleryExpected, eshopExpected]);
		// The eShop holdout is the one entry in this ledger whose migrated build is
		// green, which makes it the one entry that could be read as a pass. It is
		// not one: no journey ran, it is counted nowhere, and the install RED it
		// took under the frozen composite is still in the record beside the green.
		expect(eshopExpected.outcome).toBe(HOLDOUT_ANGULAR_ESHOP_WEBSPA_OUTCOME);
		expect(eshopExpected.migratedLane).toBe('green');
		expect(eshopExpected.migratedLaneUnderFreeze).toBe('red');
		expect(eshopExpected.witness).toBe('not-run');
		expect(eshopExpected.browserProof).toBe('not-tested');
		expect(eshopExpected.countedInLineageNumerator).toBe(false);
		expect(
			aggregate.fixtures.some((fixture) => fixture.receipt === eshopExpected.receipt),
		).toBe(false);
		// The Angular holdout failed and stays failed: it is the falsification
		// evidence the declared support boundary rests on, and a boundary that
		// reclassified its own evidence would be a gate change wearing a
		// limitation's clothes.
		expect(pigalleryExpected.outcome).toBe('failed');
		expect(pigalleryExpected.countedInLineageNumerator).toBe(false);
		expect(
			aggregate.fixtures.some((fixture) => fixture.receipt === pigalleryExpected.receipt),
		).toBe(false);
		// The holdout is evidence about the frozen adapter, not a migrated
		// application, so it is neither an aggregate fixture row nor a Judge
		// counting cell.
		expect(
			aggregate.fixtures.some((fixture) => fixture.receipt === expected.receipt),
		).toBe(false);
		const ledger = readiness.judgeCounting as Array<Record<string, unknown>>;
		expect(ledger.some((cell) => cell.application === expected.application)).toBe(false);
		expect(ledger.some((cell) => cell.cell === expected.id)).toBe(false);
	});

	it('declares the pre-Ivy support boundary as data, with its instance evidence', async () => {
		const result = await analyzeCorpusConformance({ rootDir: root });
		const boundaries = (result.coverage as Record<string, unknown>)
			.supportBoundaries as Array<Record<string, unknown>>;
		expect(boundaries).toHaveLength(1);
		const boundary = boundaries[0] as Record<string, unknown>;
		expect(boundary.id).toBe(ANGULAR_PRE_IVY_SUPPORT_BOUNDARY.id);
		expect(boundary.state).toBe('unsupported');
		expect(boundary.cell).toBe('angular-16-browser-builder');
		expect(boundary.condition).toBe(
			'pre-Ivy-only dependencies (no published Ivy successor) in active application use => unsupported at the Angular 16 target cell',
		);
		expect(String(boundary.certification)).toContain('not-certified');
		const evidence = boundary.instanceEvidence as {
			application: string;
			libraries: number;
			importSites: number;
			wall: Array<{ library: string; importSites: string[] }>;
		};
		// Three libraries at six sites, and the sites are the application's own:
		// a boundary stated without the instances that prove it is an opinion.
		expect(evidence.application).toBe('pigallery2');
		expect(evidence.libraries).toBe(3);
		expect(evidence.importSites).toBe(6);
		expect(evidence.wall.map((entry) => entry.library)).toEqual([
			'@yaga/leaflet-ng2',
			'ng2-slim-loading-bar',
			'jw-bootstrap-switch-ng2',
		]);
		expect(evidence.wall.reduce((total, entry) => total + entry.importSites.length, 0)).toBe(6);
	});

	it('publishes the boundary amendment: reading rules, 5-of-6 prevalence, population statement', async () => {
		const result = await analyzeCorpusConformance({ rootDir: root });
		const boundaries = (result.coverage as Record<string, unknown>)
			.supportBoundaries as Array<Record<string, unknown>>;
		const amendment = boundaries[0]?.amendment as Record<string, unknown>;
		// The amendment is carried beside the declaration and never merged into
		// it: the boundary's own condition, mechanism and certification are the
		// immutable receipt's, and the amendment says which boundary it amends.
		expect(amendment.amends).toBe(ANGULAR_PRE_IVY_SUPPORT_BOUNDARY.id);
		expect(amendment.appendOnly).toBe(true);
		expect(boundaries[0]?.condition).toBe(ANGULAR_PRE_IVY_SUPPORT_BOUNDARY.condition);
		expect(boundaries[0]?.certification).toBe(ANGULAR_PRE_IVY_SUPPORT_BOUNDARY.certification);
		const rules = amendment.readingRules as Array<Record<string, unknown>>;
		expect(rules.map((rule) => rule.id)).toEqual([
			'successor-across-names',
			'declared-but-never-imported-is-not-active-use',
		]);
		// Both rules are ecosystem-availability facts. A boundary read off what the
		// adapter can be made to do would be a capability claim in disguise, and it
		// is exactly what the screen was forbidden to select on.
		for (const rule of rules) expect(rule.kind).toBe('ecosystem-availability-fact');
		const successor = rules[0] as {
			instance: { deprecationMessage: string; successorPackageNamed: string };
		};
		expect(successor.instance.deprecationMessage).toBe(
			'Package no longer supported. Use @angular/common instead, see https://angular.io/guide/deprecations#angularhttp',
		);
		expect(successor.instance.successorPackageNamed).toBe('@angular/common');
		// Five of six, never six of six, and the one tested failure is never merged
		// into the four screened ones.
		const prevalence = amendment.prevalence as {
			statement: string;
			published: string;
			applicationsExamined: number;
			applicationsObservedWithTheCondition: number;
			tested: { count: number; applications: string[]; strength: string };
			screened: { count: number; applications: string[]; strength: string };
			distinctCondition: { application: string; countedInPrevalence: boolean };
		};
		expect(prevalence.published).toBe('5-of-6');
		expect(prevalence.applicationsExamined).toBe(6);
		expect(prevalence.applicationsObservedWithTheCondition).toBe(5);
		expect(prevalence.tested).toMatchObject({
			count: 1,
			applications: ['pigallery2'],
			strength: 'tested-and-failed',
		});
		expect(prevalence.screened).toMatchObject({
			count: 4,
			applications: ['cyclos4-ui', 'ngx-starter-kit', 'tabby', 'coreui-free-angular-admin-template'],
			strength: 'screened-and-failed',
		});
		expect(prevalence.distinctCondition).toMatchObject({
			application: 'eShopOnContainers',
			condition: 'first-party-successor removal',
			countedInPrevalence: false,
		});
		expect(prevalence.statement).toContain('5 of 6');
		expect(amendment.populationStatement).toBe(ANGULAR_PRE_IVY_BOUNDARY_POPULATION_STATEMENT);
		expect(String(amendment.populationStatement)).toContain('supported cell only');
	});

	it('refuses a boundary amendment whose prevalence or population statement was weakened', () => {
		expect(() => assertAngularPreIvyBoundaryAmendment(ANGULAR_PRE_IVY_BOUNDARY_AMENDMENT)).not.toThrow();
		const mutations: Array<[string, (value: Record<string, unknown>) => void]> = [
			[
				'six-of-six',
				(value) => {
					const prevalence = value.prevalence as Record<string, unknown>;
					prevalence.applicationsObservedWithTheCondition = 6;
					prevalence.published = '6-of-6';
				},
			],
			[
				'tested-and-screened-collapsed',
				(value) => {
					const prevalence = value.prevalence as Record<string, unknown>;
					prevalence.tested = { count: 5, applications: ['pigallery2'], strength: 'tested-and-failed' };
					prevalence.screened = { count: 0, applications: [], strength: 'screened-and-failed' };
				},
			],
			[
				'distinct-condition-counted',
				(value) => {
					const prevalence = value.prevalence as Record<string, unknown>;
					(prevalence.distinctCondition as Record<string, unknown>).countedInPrevalence = true;
				},
			],
			[
				'prevalence-dropped',
				(value) => {
					delete value.prevalence;
				},
			],
			[
				'population-dropped',
				(value) => {
					delete value.populationStatement;
				},
			],
			[
				'population-softened',
				(value) => {
					value.populationStatement = 'A GREEN holdout speaks for the webpack-era fleet.';
				},
			],
			[
				'rule-stripped',
				(value) => {
					value.readingRules = (value.readingRules as unknown[]).slice(0, 1);
				},
			],
			[
				'rule-turned-into-a-capability-claim',
				(value) => {
					const rules = value.readingRules as Array<Record<string, unknown>>;
					rules[0].kind = 'adapter-capability-fact';
				},
			],
		];
		for (const [label, mutate] of mutations) {
			const value = JSON.parse(
				JSON.stringify(ANGULAR_PRE_IVY_BOUNDARY_AMENDMENT),
			) as Record<string, unknown>;
			mutate(value);
			expect(() => assertAngularPreIvyBoundaryAmendment(value), label).toThrow();
		}
		expect(() => assertAngularPreIvyBoundaryAmendment(undefined)).toThrow();
	});

	it('refuses a support boundary whose falsification evidence was edited', async () => {
		const directory = await corpusCopy('boundary-evidence');
		try {
			await mutateJson(
				directory,
				'evidence/runs/holdout-angular-pigallery2/receipt.json',
				(value) => {
					const lanes = value.lanes as Record<string, Record<string, unknown>>;
					lanes.migrated.outcome = 'green';
				},
			);
			await expect(analyzeCorpusConformance({ rootDir: directory })).rejects.toThrow();
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('refuses an eShop holdout entry edited into a pass or a browser proof', async () => {
		const mutations: Array<[string, (value: Record<string, unknown>) => void]> = [
			[
				'outcome-upgraded',
				(value) => {
					value.holdoutOutcome = 'passed';
				},
			],
			[
				'witness-claimed',
				(value) => {
					const witness = value.witness as Record<string, unknown>;
					witness.state = 'verified';
					witness.journeysRun = 3;
					witness.browserProof = 'verified';
				},
			],
			[
				'install-red-erased',
				(value) => {
					const lanes = value.lanes as Record<string, Record<string, unknown>>;
					lanes.migratedUnderFreeze.outcome = 'green';
				},
			],
			[
				'reopen-hidden',
				(value) => {
					const adapter = value.frozenAdapter as Record<string, Record<string, unknown>>;
					adapter.authorizedReopen.capabilitiesExtracted = 0;
				},
			],
		];
		for (const [label, mutate] of mutations) {
			const directory = await corpusCopy(`eshop-${label}`);
			try {
				await mutateJson(
					directory,
					'evidence/runs/holdout-angular-eshop-webspa/receipt.json',
					mutate,
				);
				await expect(
					analyzeCorpusConformance({ rootDir: directory }),
					label,
				).rejects.toThrow();
			} finally {
				await rm(directory, { recursive: true, force: true });
			}
		}
	});

	it('leaves both lineage numerators exactly where the Judge ledger puts them', async () => {
		const result = await analyzeCorpusConformance({ rootDir: root });
		const readiness = (result.coverage as Record<string, unknown>)
			.productionReadiness as Record<string, unknown>;
		expect(readiness.reactLineage).toEqual({
			ready: 6,
			total: 6,
			counted: true,
			candidate: 'judge-approved',
		});
		expect(readiness.angularLineage).toEqual({
			ready: 4,
			total: 4,
			counted: true,
			candidate: 'judge-approved',
		});
		const ledger = readiness.judgeCounting as Array<Record<string, unknown>>;
		expect(ledger.filter((cell) => cell.lineage === 'react' && cell.counted)).toHaveLength(6);
		expect(ledger.filter((cell) => cell.lineage === 'angular' && cell.counted)).toHaveLength(4);
	});

	it('refuses an aggregate whose holdout record has been dropped or rewritten', async () => {
		for (const [label, transform] of [
			[
				'dropped',
				(value: Record<string, unknown>) => {
					value.holdouts = [];
				},
			],
			[
				'counted',
				(value: Record<string, unknown>) => {
					const holdout = (value.holdouts as Array<Record<string, unknown>>)[0];
					if (holdout) holdout.countedInLineageNumerator = true;
				},
			],
			[
				'passed',
				(value: Record<string, unknown>) => {
					const holdout = (value.holdouts as Array<Record<string, unknown>>)[0];
					if (holdout) holdout.outcome = 'passed';
				},
			],
		] as const) {
			const directory = await corpusCopy(`holdout-${label}`);
			try {
				await mutateJson(directory, 'evidence/runs/aggregate.json', transform);
				await expect(analyzeCorpusConformance({ rootDir: directory })).rejects.toThrow(
					/holdout/,
				);
			} finally {
				await rm(directory, { recursive: true, force: true });
			}
		}
	});

	it('rejects a PhoneCat Vite aggregate lane rebind', async () => {
		const directory = await corpusCopy('phonecat-vite-aggregate');
		try {
			await mutateJson(directory, 'evidence/runs/aggregate.json', (value) => {
				const fixture = (value.fixtures as Array<Record<string, unknown>>).find(
					(item) => item.id === 'angular-phonecat-vite8',
				);
				if (fixture) fixture.bundler = 'none-static';
			});
			await expect(analyzeCorpusConformance({ rootDir: directory })).rejects.toThrow(
				'Aggregate membership mismatch',
			);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
