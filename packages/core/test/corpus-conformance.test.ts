import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	analyzeCorpusConformance,
	deriveCorpusTransactionState,
	verifyCorpusConformanceDigest,
} from '../src/corpus/conformance.ts';
import { nextKilledByGoogleAggregateMember } from '../src/receipts/next-killedbygoogle.ts';
import { receiptDigest, sha256 } from '../src/receipts/canonicalize.ts';
import { renderReceipt } from '../src/receipts/render.ts';
import type { MigrationReceipt } from '../src/receipts/schema.ts';

const root = path.resolve(import.meta.dirname, '../../..');
const killedByGoogleDigest = 'a018c6490cd559fab74ea402ff93660f053503dbed1a52ba9b68ed7fdc086b7c';

function prepublicationFixtures(fixtures: Array<Record<string, unknown>>) {
	const expected = nextKilledByGoogleAggregateMember(killedByGoogleDigest);
	const matches = fixtures.filter((fixture) => fixture.id === expected.id);
	expect(matches).toEqual([expected]);
	return fixtures.filter((fixture) => fixture.id !== expected.id);
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
	it('derives the canonical eleven verticals as four narrowly scoped source applications', async () => {
		const result = await analyzeCorpusConformance({ rootDir: root });
		expect(verifyCorpusConformanceDigest(result)).toBe(result.integrity.canonicalDigest);
		expect(result.summary).toEqual({
			verticals: 11,
			sourceApplications: 4,
			designatedPilotsVerified: 0,
		});
		expect(result.applications).toHaveLength(4);
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
		).toMatchObject({ verticals: ['next-killedbygoogle-derived-state-to-memo'] });
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

	it('derives only the exact prepublication and postintegration transaction states', async () => {
		const aggregate = JSON.parse(
			await readFile(path.join(root, 'evidence/runs/aggregate.json'), 'utf8'),
		) as { fixtures: Array<Record<string, unknown>> };
		const before = prepublicationFixtures(aggregate.fixtures);
		expect(deriveCorpusTransactionState(before)).toEqual({
			kind: 'prepublication',
			nextKilledByGoogleIntegrated: false,
			verticals: 10,
			sourceApplications: 3,
			receipts: 10,
			resolvedDependencies: 23,
		});
		const nextMember = nextKilledByGoogleAggregateMember(killedByGoogleDigest);
		expect(deriveCorpusTransactionState([...before, nextMember])).toEqual({
			kind: 'postintegration',
			nextKilledByGoogleIntegrated: true,
			verticals: 11,
			sourceApplications: 4,
			receipts: 11,
			resolvedDependencies: 24,
		});
		for (const fixtures of [
			[...before, before[0]],
			[...before, { ...nextMember, framework: 'nextjs' }],
			[...before, { ...nextMember, receipt: 'evidence/runs/misplaced.json' }],
			[...before, { id: 'unknown', receipt: 'unknown', digest: 'a'.repeat(64) }],
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
