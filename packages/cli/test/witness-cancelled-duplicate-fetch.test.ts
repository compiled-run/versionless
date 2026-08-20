import { describe, expect, it } from 'vitest';
import { WITNESS_CANCELLED_DUPLICATE_FETCH_RULE } from '../../core/src/receipts/witness-real-app.ts';
import type { WitnessObservedRequestOutcome } from '../src/witness/playwright-host.ts';
import { buildCancelledDuplicateFetchInventory } from '../src/witness/real-app-run.ts';

const origin = 'http://127.0.0.1:54321';
const GIF = '/assets/transparent.gif';
const category = [{ method: 'GET', path: GIF, reason: 'net::ERR_ABORTED' }] as const;

const finished = (path: string, status = 200, method = 'GET'): WitnessObservedRequestOutcome => ({
	url: `${origin}${path}`,
	method,
	outcome: 'finished',
	status,
	reason: null,
});

const failed = (path: string, reason: string, method = 'GET'): WitnessObservedRequestOutcome => ({
	url: `${origin}${path}`,
	method,
	outcome: 'failed',
	status: null,
	reason,
});

describe('corroborated cancelled-duplicate-fetch category', () => {
	it('admits a cancelled fetch the same page also fetched successfully, and records the corroboration', () => {
		const inventory = buildCancelledDuplicateFetchInventory(
			[
				finished('/index.html'),
				finished(GIF),
				failed(GIF, 'net::ERR_ABORTED'),
				finished(GIF),
			],
			origin,
			category,
		);
		expect(inventory.policy).toBe('corroborated-browser-cancelled-duplicate-fetch');
		expect(inventory.corroborationRule).toBe(WITNESS_CANCELLED_DUPLICATE_FETCH_RULE);
		expect(inventory.category).toEqual([
			{ method: 'GET', path: GIF, reason: 'net::ERR_ABORTED' },
		]);
		expect(inventory.observed).toEqual([
			{
				method: 'GET',
				path: GIF,
				reason: 'net::ERR_ABORTED',
				cancelled: 1,
				corroboratingSuccesses: 2,
				corroboratingStatuses: [200],
			},
		]);
		expect(inventory.absent).toEqual([]);
		expect(inventory.uncorroborated).toEqual([]);
		expect(inventory.admitted).toBe(1);
	});

	it('counts every instance of the admitted member without pinning the count', () => {
		const twice = buildCancelledDuplicateFetchInventory(
			[finished(GIF), failed(GIF, 'net::ERR_ABORTED'), failed(GIF, 'net::ERR_ABORTED')],
			origin,
			category,
		);
		const once = buildCancelledDuplicateFetchInventory(
			[finished(GIF), failed(GIF, 'net::ERR_ABORTED')],
			origin,
			category,
		);
		expect(twice.admitted).toBe(2);
		expect(once.admitted).toBe(1);
		expect(twice.category).toEqual(once.category);
	});

	it('records a member the run never raced as absent rather than as observed', () => {
		const inventory = buildCancelledDuplicateFetchInventory(
			[finished('/index.html'), finished(GIF)],
			origin,
			category,
		);
		expect(inventory.observed).toEqual([]);
		expect(inventory.absent).toEqual([
			{ method: 'GET', path: GIF, reason: 'net::ERR_ABORTED' },
		]);
		expect(inventory.admitted).toBe(0);
	});

	it('refuses a cancelled fetch with no successful sibling', () => {
		expect(() =>
			buildCancelledDuplicateFetchInventory(
				[finished('/index.html'), failed(GIF, 'net::ERR_ABORTED')],
				origin,
				category,
			),
		).toThrow(/no corroborating successful fetch/);
	});

	it('refuses a cancelled fetch whose only sibling fetch did not succeed', () => {
		expect(() =>
			buildCancelledDuplicateFetchInventory(
				[finished(GIF, 404), failed(GIF, 'net::ERR_ABORTED')],
				origin,
				category,
			),
		).toThrow(/no corroborating successful fetch/);
	});

	it('does not admit a cancelled fetch of a path outside the category', () => {
		const inventory = buildCancelledDuplicateFetchInventory(
			[finished('/assets/data.json'), failed('/assets/data.json', 'net::ERR_ABORTED')],
			origin,
			category,
		);
		expect(inventory.observed).toEqual([]);
		expect(inventory.admitted).toBe(0);
		expect(inventory.absent).toHaveLength(1);
	});

	it('does not admit a cancelled fetch of the pinned path by a different method', () => {
		const inventory = buildCancelledDuplicateFetchInventory(
			[finished(GIF, 200, 'POST'), failed(GIF, 'net::ERR_ABORTED', 'POST')],
			origin,
			category,
		);
		expect(inventory.observed).toEqual([]);
		expect(inventory.admitted).toBe(0);
	});

	it('does not admit any other failure reason on the pinned path', () => {
		const inventory = buildCancelledDuplicateFetchInventory(
			[finished(GIF), failed(GIF, 'net::ERR_CONNECTION_REFUSED')],
			origin,
			category,
		);
		expect(inventory.observed).toEqual([]);
		expect(inventory.admitted).toBe(0);
		expect(inventory.absent).toHaveLength(1);
	});

	it('holds successful corroboration to the same page origin', () => {
		expect(() =>
			buildCancelledDuplicateFetchInventory(
				[
					{
						url: `https://example.invalid${GIF}`,
						method: 'GET',
						outcome: 'finished',
						status: 200,
						reason: null,
					},
					failed(GIF, 'net::ERR_ABORTED'),
				],
				origin,
				category,
			),
		).toThrow(/no corroborating successful fetch/);
	});

	it('is inert for a run that declares no category at all', () => {
		const inventory = buildCancelledDuplicateFetchInventory(
			[finished(GIF), failed(GIF, 'net::ERR_ABORTED'), failed('/other', 'net::ERR_FAILED')],
			origin,
			[],
		);
		expect(inventory.category).toEqual([]);
		expect(inventory.observed).toEqual([]);
		expect(inventory.absent).toEqual([]);
		expect(inventory.admitted).toBe(0);
	});

	it('refuses a category that repeats a member', () => {
		expect(() =>
			buildCancelledDuplicateFetchInventory([], origin, [...category, ...category]),
		).toThrow(/repeats a member/);
	});
});
