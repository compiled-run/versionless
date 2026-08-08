import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
	bindRuntimeObservationConfig,
	parseRuntimeObservationConfig,
	renderRuntimeObservation,
	type RuntimeScriptObservation,
	verifyRuntimeScriptObservationEvidence,
} from '../src/enterprise/runtime-script-observation.ts';
import { verifyScriptSurface } from '../src/enterprise/script-surface.ts';

describe('runtime script observation contract', () => {
	async function inputs() {
		const config = parseRuntimeObservationConfig(
			JSON.parse(await readFile('trust/runtime-script-observation.json', 'utf8')),
		);
		const surface = await verifyScriptSurface({
			environment: { VERSIONLESS_NETWORK_MODE: 'offline' },
		});
		const evidence = JSON.parse(
			await readFile(
				'evidence/runtime-script-observation/current/runtime-script-observation.json',
				'utf8',
			),
		) as Record<string, unknown>;
		return { config, surface, evidence };
	}

	it('binds exactly nine profiles to the canonical eighteen lanes', async () => {
		const config = parseRuntimeObservationConfig(
			JSON.parse(await readFile('trust/runtime-script-observation.json', 'utf8')),
		);
		const surface = await verifyScriptSurface({
			environment: { VERSIONLESS_NETWORK_MODE: 'offline' },
		});
		expect(() => bindRuntimeObservationConfig(config, surface)).not.toThrow();
		expect(config.verticals).toHaveLength(9);
		expect(surface.verticals.flatMap((vertical) => vertical.lanes)).toHaveLength(18);
	});

	it('refuses profile and vertical-order rebinding', async () => {
		const raw = JSON.parse(
			await readFile('trust/runtime-script-observation.json', 'utf8'),
		) as Record<string, unknown>;
		const rebound = structuredClone(raw);
		(rebound.verticals as Array<Record<string, unknown>>)[0]!.profile = 'angular-phonecat';
		expect(() => parseRuntimeObservationConfig(rebound)).toThrow('profile rebinding refused');
		const reordered = structuredClone(raw);
		(reordered.verticals as unknown[]).reverse();
		expect(() => parseRuntimeObservationConfig(reordered)).toThrow(
			'ID/order rebinding refused',
		);
		for (const field of ['journey', 'journeySha256', 'payload', 'payloadSha256'] as const) {
			const changed = structuredClone(raw);
			const profiles = changed.profiles as Record<string, Record<string, unknown>>;
			const profile = field.startsWith('payload')
				? profiles['react-data-flow']
				: profiles['react-locale'];
			if (!profile) throw new Error('test profile missing');
			profile[field] = field.endsWith('Sha256') ? '0'.repeat(64) : 'fixtures/rebound.json';
			expect(() => parseRuntimeObservationConfig(changed)).toThrow(
				'journey/payload binding refused',
			);
		}
	});

	it('strictly verifies all runtime evidence semantics and local hashes', async () => {
		const { config, surface, evidence } = await inputs();
		await expect(
			verifyRuntimeScriptObservationEvidence(evidence, { config, surface }),
		).resolves.toMatchObject({ schemaVersion: 'versionless.runtime-script-observation.v1' });
	});

	it('rejects adversarial runtime semantics even when JSON remains structurally valid', async () => {
		const { config, surface, evidence } = await inputs();
		const firstVertical = (value: Record<string, unknown>) =>
			(value.verticals as Array<Record<string, unknown>>)[0]!;
		const firstLane = (value: Record<string, unknown>) =>
			(firstVertical(value).lanes as Array<Record<string, unknown>>)[0]!;
		const firstRun = (value: Record<string, unknown>) =>
			(firstLane(value).runs as Array<Record<string, unknown>>)[0]!;
		const firstScript = (value: Record<string, unknown>) =>
			(firstRun(value).scripts as Array<Record<string, unknown>>)[0]!;
		const composedLane = (value: Record<string, unknown>) =>
			(
				(value.verticals as Array<Record<string, unknown>>)[7]!.lanes as Array<
					Record<string, unknown>
				>
			)[0]!;
		const phonecatViteLane = (value: Record<string, unknown>) =>
			(
				(value.verticals as Array<Record<string, unknown>>)[8]!.lanes as Array<
					Record<string, unknown>
				>
			)[1]!;
		const mutations: Array<[string, (value: Record<string, unknown>) => void]> = [
			[
				'detector',
				(value) => ((value.detectorMutation as Record<string, unknown>).observed = false),
			],
			['deleted script', (value) => (firstRun(value).scripts as unknown[]).pop()],
			['unhashed script', (value) => (firstScript(value).sha256 = null)],
			['escaping script', (value) => (firstScript(value).resolvedPath = '../escape.js')],
			['browser error', (value) => (firstRun(value).consoleErrors as string[]).push('error')],
			['nondeterminism', (value) => (firstRun(value).createdScripts as string[]).pop()],
			['source application', (value) => (firstVertical(value).sourceApplication = 'rebound')],
			['lane', (value) => (firstLane(value).lane = 'target')],
			[
				'entrypoint',
				(value) =>
					((firstLane(value).entrypoint as Record<string, unknown>).path =
						'rebound/index.html'),
			],
			[
				'receipt',
				(value) =>
					((firstLane(value).receipt as Record<string, unknown>).digest = '0'.repeat(64)),
			],
			[
				'composed receipt rebinding',
				(value) =>
					((composedLane(value).receipt as Record<string, unknown>).path =
						'evidence/runs/react-boilerplate-v4-data-flow/t054-run.json'),
			],
			[
				'PhoneCat Vite receipt rebinding',
				(value) =>
					((phonecatViteLane(value).receipt as Record<string, unknown>).path =
						'evidence/runs/angular-phonecat-composed/t048-run.json'),
			],
			['profile', (value) => (firstVertical(value).profile = 'angular-phonecat')],
			[
				'input journey',
				(value) =>
					((
						(value.inputs as Record<string, unknown>).profiles as Record<
							string,
							Record<string, unknown>
						>
					)['react-locale']!.journey = 'fixtures/rebound.json'),
			],
			[
				'input payload',
				(value) =>
					((
						(value.inputs as Record<string, unknown>).profiles as Record<
							string,
							Record<string, unknown>
						>
					)['react-data-flow']!.payloadSha256 = '0'.repeat(64)),
			],
			[
				'synthetic drift',
				(value) =>
					(firstRun(value).syntheticInterceptions as string[]).push(
						'https://synthetic.invalid/drift',
					),
			],
			['external script', (value) => (firstScript(value).kind = 'external')],
			[
				'projection drift',
				(value) =>
					((firstRun(value).journeyProjection as Record<string, unknown>).selectedLocale =
						'fr'),
			],
			[
				'boundary overclaim',
				(value) =>
					((value.boundaries as Record<string, unknown>).globalDynamicInsertionCoverage =
						'verified'),
			],
		];
		for (const [label, mutate] of mutations) {
			const changed = structuredClone(evidence);
			mutate(changed);
			await expect(
				verifyRuntimeScriptObservationEvidence(changed, { config, surface }),
				label,
			).rejects.toThrow();
		}
	});

	it('renders journey-scoped nonclaims', () => {
		const result = {
			schemaVersion: 'versionless.runtime-script-observation.v1',
			summary: {
				verticals: 9,
				sourceApplications: 2,
				lanes: 18,
				runs: 36,
				externalScriptsIntroduced: 0,
			},
			detectorMutation: {
				source: 'https://synthetic.invalid/runtime-detector.js',
				observed: true,
				result: 'intended-refusal',
				restoration: 'no-worktree-write',
			},
		} as RuntimeScriptObservation;
		expect(renderRuntimeObservation(result)).toContain('not global dynamic-insertion coverage');
	});
});
