import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import { canonicalize } from '../../core/src/index.ts';
import {
	ANGULAR_REALWORLD_V15_TO_V16_AGGREGATE_MEMBER,
	integrateAngularRealworldAggregate,
	verifyAngularRealworldV15ToV16Inputs,
} from '../src/fixture/angular-realworld-v15-to-v16-integrate.ts';

const root = path.resolve(import.meta.dirname, '../../..');

describe('Angular RealWorld v15-to-v16 integration', () => {
	it('verifies all immutable inputs offline', async () => {
		await expect(
			verifyAngularRealworldV15ToV16Inputs(root, {
				...process.env,
				VERSIONLESS_NETWORK_MODE: 'offline',
				NPM_CONFIG_OFFLINE: 'true',
			}),
		).resolves.toBeUndefined();
	});

	it('is idempotent and refuses a conflicting aggregate member', async () => {
		const aggregate = JSON.parse(
			await readFile(path.join(root, 'evidence/runs/aggregate.json'), 'utf8'),
		) as Record<string, unknown>;
		const first = integrateAngularRealworldAggregate(aggregate);
		const second = integrateAngularRealworldAggregate(first);
		expect(canonicalize(second)).toBe(canonicalize(first));
		expect(
			(first.fixtures as Array<Record<string, unknown>>).find(
				(item) => item.id === ANGULAR_REALWORLD_V15_TO_V16_AGGREGATE_MEMBER.id,
			),
		).toEqual(ANGULAR_REALWORLD_V15_TO_V16_AGGREGATE_MEMBER);
		const conflict = structuredClone(first);
		const member = (conflict.fixtures as Array<Record<string, unknown>>).find(
			(item) => item.id === ANGULAR_REALWORLD_V15_TO_V16_AGGREGATE_MEMBER.id,
		);
		if (!member) throw new Error('Angular RealWorld member missing');
		member.digest = 'conflict';
		expect(() => integrateAngularRealworldAggregate(conflict)).toThrow('conflicts');
		for (const mutate of [
			(value: Record<string, unknown>) =>
				(value.fixtures as Array<Record<string, unknown>>).push({ id: 'unknown' }),
			(value: Record<string, unknown>) =>
				(value.fixtures as Array<Record<string, unknown>>).push(
					structuredClone(ANGULAR_REALWORLD_V15_TO_V16_AGGREGATE_MEMBER),
				),
			(value: Record<string, unknown>) => {
				const killed = (value.fixtures as Array<Record<string, unknown>>).find(
					(item) => item.id === 'next-killedbygoogle-derived-state-to-memo',
				);
				if (!killed) throw new Error('Killed by Google member missing');
				killed.digest = 'conflict';
			},
		]) {
			const invalid = structuredClone(first);
			mutate(invalid);
			expect(() => integrateAngularRealworldAggregate(invalid)).toThrow();
		}
	});
});
