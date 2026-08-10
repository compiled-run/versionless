import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import * as path from 'pathe';
import { describe, expect, test } from 'vitest';
import {
	canonicalize,
	nextKilledByGoogleAggregateMember,
	witnessAngularRealworldAggregateMember,
	witnessReactBoilerplateAggregateMember,
	witnessNextKilledByGoogleAggregateMember,
} from '../../core/src/index.ts';
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
		const witness = fixtures.filter((fixture) => fixture.id === 'witness-angular-realworld');
		expect(witness).toHaveLength(1);
		expect(witness[0]).toEqual(
			witnessAngularRealworldAggregateMember(String(witness[0]!.digest)),
		);
		const react = fixtures.filter((fixture) => fixture.id === 'witness-react-boilerplate');
		expect(react).toHaveLength(1);
		expect(react[0]).toEqual(witnessReactBoilerplateAggregateMember(String(react[0]!.digest)));
		const nextWitness = fixtures.filter(
			(fixture) => fixture.id === 'witness-next-killedbygoogle',
		);
		if (nextWitness.length === 1)
			expect(nextWitness[0]).toEqual(
				witnessNextKilledByGoogleAggregateMember(String(nextWitness[0]!.digest)),
			);
		else expect(nextWitness).toEqual([]);
		return {
			...structuredClone(aggregate),
			fixtures: fixtures.filter(
				(fixture) =>
					fixture.id !== 'next-killedbygoogle-derived-state-to-memo' &&
					fixture.id !== 'witness-angular-realworld' &&
					fixture.id !== 'witness-react-boilerplate' &&
					fixture.id !== 'witness-next-killedbygoogle' &&
					fixture.id !== 'react-boilerplate-v4-zero-sw' &&
					fixture.id !== 'witness-react-boilerplate-zero-sw' &&
					fixture.id !== 'react-papercups-v1-0-0' &&
					fixture.id !== 'witness-react-papercups',
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
		expect(aggregate.fixtures as Array<Record<string, unknown>>).toHaveLength(10);
		const first = integrateNextKilledByGoogleAggregate(aggregate, canonicalDigest);
		const second = integrateNextKilledByGoogleAggregate(first, canonicalDigest);
		const currentAgain = integrateNextKilledByGoogleAggregate(current, canonicalDigest);
		expect(canonicalize(currentAgain)).toBe(canonicalize(current));
		expect(canonicalize(second)).toBe(canonicalize(first));
		const ids = (first.fixtures as Array<Record<string, unknown>>).map((fixture) => fixture.id);
		expect(ids.indexOf('next-killedbygoogle-derived-state-to-memo')).toBe(
			ids.indexOf('react-boilerplate-v4-data-flow') - 1,
		);
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
		for (const mutate of [
			(value: Record<string, unknown>) => {
				const witness = (value.fixtures as Array<Record<string, unknown>>).find(
					(item) => item.id === 'witness-angular-realworld',
				);
				if (!witness) throw new Error('Witness member missing');
				(value.fixtures as Array<Record<string, unknown>>).push(structuredClone(witness));
			},
			(value: Record<string, unknown>) => {
				const witness = (value.fixtures as Array<Record<string, unknown>>).find(
					(item) => item.id === 'witness-angular-realworld',
				);
				if (!witness) throw new Error('Witness member missing');
				witness.digest = 'A'.repeat(64);
			},
			(value: Record<string, unknown>) => {
				const witness = (value.fixtures as Array<Record<string, unknown>>).find(
					(item) => item.id === 'witness-angular-realworld',
				);
				if (!witness) throw new Error('Witness member missing');
				witness.receipt = 'evidence/runs/wrong.json';
			},
			(value: Record<string, unknown>) => {
				value.fixtures = (value.fixtures as Array<Record<string, unknown>>).filter(
					(item) => item.id !== 'next-killedbygoogle-derived-state-to-memo',
				);
			},
			(value: Record<string, unknown>) => {
				const react = (value.fixtures as Array<Record<string, unknown>>).find(
					(item) => item.id === 'witness-react-boilerplate',
				);
				if (!react) throw new Error('React Witness member missing');
				react.framework = 'preact';
			},
			(value: Record<string, unknown>) => {
				const fixtures = value.fixtures as Array<Record<string, unknown>>;
				fixtures.unshift(fixtures.pop()!);
			},
		]) {
			const invalid = structuredClone(current) as Record<string, unknown>;
			mutate(invalid);
			expect(() => integrateNextKilledByGoogleAggregate(invalid, canonicalDigest)).toThrow();
		}
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
