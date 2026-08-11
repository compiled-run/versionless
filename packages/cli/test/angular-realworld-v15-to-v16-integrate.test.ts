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
		const current = JSON.parse(
			await readFile(path.join(root, 'evidence/runs/aggregate.json'), 'utf8'),
		) as Record<string, unknown>;
		const currentFixtures = current.fixtures as Array<Record<string, unknown>>;
		expect(currentFixtures).toHaveLength(22);
		expect(canonicalize(integrateAngularRealworldAggregate(current))).toBe(
			canonicalize(current),
		);
		const productionReadiness = structuredClone(current);
		productionReadiness.fixtures = (
			productionReadiness.fixtures as Array<Record<string, unknown>>
		).filter((item) => item.id !== 'witness-react-boilerplate');
		productionReadiness.fixtures = (
			productionReadiness.fixtures as Array<Record<string, unknown>>
		).filter(
			(item) =>
				item.id !== 'witness-next-killedbygoogle' &&
				item.id !== 'react-boilerplate-v4-zero-sw' &&
				item.id !== 'witness-react-boilerplate-zero-sw' &&
				item.id !== 'react-papercups-v1-0-0' &&
				item.id !== 'witness-react-papercups' &&
				item.id !== 'react-hospitalrun' &&
				item.id !== 'witness-react-hospitalrun' &&
				item.id !== 'witness-angular-factoriolab' &&
				item.id !== 'witness-angular-jira-clone',
		);
		expect(productionReadiness.fixtures as Array<Record<string, unknown>>).toHaveLength(12);
		const first = integrateAngularRealworldAggregate(productionReadiness);
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
				witness.digest = 'ABC';
			},
			(value: Record<string, unknown>) => {
				const witness = (value.fixtures as Array<Record<string, unknown>>).find(
					(item) => item.id === 'witness-angular-realworld',
				);
				if (!witness) throw new Error('Witness member missing');
				witness.framework = 'angularjs';
			},
			(value: Record<string, unknown>) => {
				value.fixtures = (value.fixtures as Array<Record<string, unknown>>).filter(
					(item) => item.id !== 'next-killedbygoogle-derived-state-to-memo',
				);
			},
			(value: Record<string, unknown>) => {
				const composed = (value.fixtures as Array<Record<string, unknown>>).find(
					(item) => item.id === 'react-boilerplate-v4-composed',
				);
				if (!composed) throw new Error('React composed member missing');
				composed.digest =
					'9341f5e70c00ebbde65a919db5b5d31fde0fa39983e985deb01afb71ed00d1ad';
			},
			(value: Record<string, unknown>) => {
				const dataFlow = (value.fixtures as Array<Record<string, unknown>>).find(
					(item) => item.id === 'react-boilerplate-v4-data-flow',
				);
				if (!dataFlow) throw new Error('React data-flow member missing');
				dataFlow.digest =
					'a6c25918ed9650d3315c42501932e8e6fe26552e48bcbdf74d4987f7b384452b';
			},
		]) {
			const invalid = structuredClone(current);
			mutate(invalid);
			expect(() => integrateAngularRealworldAggregate(invalid)).toThrow();
		}
		for (const mutateReact of [
			(value: Record<string, unknown>) => {
				const react = (value.fixtures as Array<Record<string, unknown>>).find(
					(item) => item.id === 'witness-react-boilerplate',
				);
				if (!react) throw new Error('React Witness member missing');
				react.digest = 'A'.repeat(64);
			},
			(value: Record<string, unknown>) => {
				const fixtures = value.fixtures as Array<Record<string, unknown>>;
				fixtures.unshift(fixtures.pop()!);
			},
		]) {
			const invalid = structuredClone(current);
			mutateReact(invalid);
			expect(() => integrateAngularRealworldAggregate(invalid)).toThrow();
		}
	});
});
