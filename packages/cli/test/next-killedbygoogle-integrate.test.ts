import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import * as path from 'pathe';
import { describe, expect, test } from 'vitest';
import { canonicalize, nextKilledByGoogleAggregateMember } from '../../core/src/index.ts';
import {
	integrateNextKilledByGoogleAggregate,
	publishNextKilledByGoogleAggregateTransaction,
	publishNextKilledByGoogleTrust,
} from '../src/fixture/next-killedbygoogle-integrate.ts';

describe('Killed by Google integration', () => {
	const canonicalDigest = 'a018c6490cd559fab74ea402ff93660f053503dbed1a52ba9b68ed7fdc086b7c';
	const prepublication = (aggregate: Record<string, unknown>) => {
		const fixtures = aggregate.fixtures as Array<Record<string, unknown>>;
		const expected = nextKilledByGoogleAggregateMember(canonicalDigest);
		const matches = fixtures.filter(
			(fixture) => fixture.id === 'next-killedbygoogle-derived-state-to-memo',
		);
		expect(matches).toEqual([expected]);
		return {
			...structuredClone(aggregate),
			fixtures: fixtures.filter(
				(fixture) => fixture.id !== 'next-killedbygoogle-derived-state-to-memo',
			),
		};
	};

	test('parses receipt verification arguments strictly and preserves ordinary linkage', () => {
		const receipt = 'evidence/runs/react-boilerplate-v4/t008-run.json';
		const invoke = (args: string[], environment: NodeJS.ProcessEnv = process.env) =>
			spawnSync(
				process.execPath,
				[
					'--experimental-strip-types',
					'packages/cli/src/cli.ts',
					'receipt:verify',
					...args,
				],
				{ encoding: 'utf8', env: { ...process.env, ...environment } },
			);
		for (const [args, message] of [
			[['--unknown', receipt], 'unknown flag'],
			[['--pre-integration', '--pre-integration', receipt], 'duplicate --pre-integration'],
			[['--pre-integration'], 'exactly one receipt path'],
			[[receipt, receipt], 'exactly one receipt path'],
		] as const) {
			const result = invoke([...args]);
			expect(result.status).toBe(1);
			expect(result.stderr).toContain(message);
		}
		const missingControls = invoke(['--pre-integration', receipt], {
			VERSIONLESS_NETWORK_MODE: '',
			NPM_CONFIG_OFFLINE: '',
		});
		expect(missingControls.status).toBe(1);
		expect(missingControls.stderr).toContain('dual offline controls');
		expect(invoke([receipt]).status).toBe(0);
		expect(
			invoke(['--pre-integration', receipt], {
				VERSIONLESS_NETWORK_MODE: 'offline',
				NPM_CONFIG_OFFLINE: 'true',
			}).status,
		).toBe(0);
	});

	test('adds exactly one member and is idempotent', async () => {
		const current = JSON.parse(await readFile('evidence/runs/aggregate.json', 'utf8'));
		const aggregate = prepublication(current);
		const first = integrateNextKilledByGoogleAggregate(aggregate, canonicalDigest);
		const second = integrateNextKilledByGoogleAggregate(first, canonicalDigest);
		expect(canonicalize(first)).toBe(canonicalize(current));
		expect(canonicalize(second)).toBe(canonicalize(first));
		expect(
			(first.fixtures as Array<Record<string, unknown>>).filter(
				(fixture) => fixture.id === 'next-killedbygoogle-derived-state-to-memo',
			),
		).toHaveLength(1);
		const conflict = structuredClone(first);
		(
			(conflict.fixtures as Array<Record<string, unknown>>).find(
				(fixture) => fixture.id === 'next-killedbygoogle-derived-state-to-memo',
			) as Record<string, unknown>
		).digest = 'conflict';
		expect(() => integrateNextKilledByGoogleAggregate(conflict, canonicalDigest)).toThrow(
			'conflicts',
		);
	});

	test('restores aggregate bytes and cleans stage after a post-swap failure', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-kbg-aggregate-'));
		try {
			const target = path.join(directory, 'evidence/runs/aggregate.json');
			const stageRoot = path.join(
				directory,
				'.versionless/stage/next-killedbygoogle/aggregate',
			);
			await mkdir(path.dirname(target), { recursive: true });
			const current = JSON.parse(await readFile('evidence/runs/aggregate.json', 'utf8'));
			const original = Buffer.from(`${JSON.stringify(prepublication(current), null, 2)}\n`);
			await writeFile(target, original);
			const aggregate = JSON.parse(original.toString('utf8'));
			const integrated = integrateNextKilledByGoogleAggregate(aggregate, canonicalDigest);
			await expect(
				publishNextKilledByGoogleAggregateTransaction({
					target,
					stageRoot,
					integrated,
					verifyIntegrated: async () => {
						throw new Error('injected post-swap failure');
					},
				}),
			).rejects.toThrow('injected post-swap failure');
			expect(await readFile(target)).toEqual(original);
			await expect(access(stageRoot)).rejects.toThrow();
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	test('requires both offline controls before trust publication', async () => {
		for (const environment of [
			{ VERSIONLESS_NETWORK_MODE: 'offline' },
			{ NPM_CONFIG_OFFLINE: 'true' },
		])
			await expect(
				publishNextKilledByGoogleTrust('unused', '.', environment),
			).rejects.toThrow('dual offline controls');
	});
});
import { spawnSync } from 'node:child_process';
