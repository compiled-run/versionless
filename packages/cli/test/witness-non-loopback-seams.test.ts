import { describe, expect, it } from 'vitest';
import {
	WITNESS_CANCELLED_DUPLICATE_FETCH_NON_LOOPBACK_SCOPE,
	WITNESS_CANCELLED_DUPLICATE_FETCH_RULE,
	WITNESS_NON_LOOPBACK_QUERY_FREE_PATH_RULE,
} from '../../core/src/receipts/witness-real-app.ts';
import type { WitnessObservedRequestOutcome } from '../src/witness/playwright-host.ts';
import {
	buildCancelledDuplicateFetchInventory,
	buildMockedNonLoopbackSeamInventory,
	witnessRecordedRequestPath,
} from '../src/witness/real-app-run.ts';

const origin = 'http://127.0.0.1:54321';

/**
 * A synthetic error-reporting endpoint in the shape the real one has: an
 * account-scoped host and path, and the credential in the query. No value here
 * belongs to any account — the point of the test is that the query never
 * reaches the evidence, and the test would be self-defeating if it published a
 * real one to prove it.
 */
const SEAM = 'https://o000000.ingest.example.invalid/api/0000000/envelope/';
const SEAM_URL = `${SEAM}?sentry_key=synthetic-not-a-credential&sentry_version=7`;
const TAG = 'https://www.googletagmanager.example.invalid/gtag/js';
const TAG_URL = `${TAG}?id=SYNTHETIC-TAG-ID`;
const GIF = '/assets/transparent.gif';

const outcome = (
	url: string,
	overrides: Partial<WitnessObservedRequestOutcome> = {},
): WitnessObservedRequestOutcome => ({
	url,
	method: 'GET',
	outcome: 'finished',
	status: 200,
	reason: null,
	...overrides,
});

const posted = (url: string, status: number): WitnessObservedRequestOutcome =>
	outcome(url, { method: 'POST', status });

const aborted = (url: string, method = 'POST'): WitnessObservedRequestOutcome =>
	outcome(url, { method, outcome: 'failed', status: null, reason: 'net::ERR_ABORTED' });

describe('recorded request paths', () => {
	it('keeps a same-origin path exactly as the browser requested it, query included', () => {
		expect(witnessRecordedRequestPath(`${origin}${GIF}`, origin)).toBe(GIF);
		expect(
			witnessRecordedRequestPath(`${origin}/?__uncache=versionless-deterministic`, origin),
		).toBe('/?__uncache=versionless-deterministic');
	});

	it('drops the query from a non-loopback path, keeping scheme, host and pathname', () => {
		expect(witnessRecordedRequestPath(SEAM_URL, origin)).toBe(SEAM);
		expect(witnessRecordedRequestPath(TAG_URL, origin)).toBe(TAG);
	});

	it('never lets an account identifier through in a recorded non-loopback path', () => {
		for (const url of [SEAM_URL, TAG_URL]) {
			const recorded = witnessRecordedRequestPath(url, origin);
			expect(recorded).not.toContain('?');
			expect(recorded).not.toContain('sentry_key');
			expect(recorded).not.toContain('SYNTHETIC-TAG-ID');
		}
	});

	it('drops a fragment as well, so nothing after the pathname survives', () => {
		expect(witnessRecordedRequestPath(`${TAG}#anchor`, origin)).toBe(TAG);
	});
});

describe('cancelled-duplicate-fetch category on a mocked non-loopback seam', () => {
	const category = [{ method: 'POST', path: SEAM, reason: 'net::ERR_ABORTED' }] as const;

	it('admits a cancelled report the same page already delivered, and records the corroboration', () => {
		const inventory = buildCancelledDuplicateFetchInventory(
			[
				outcome(`${origin}/index.html`),
				posted(SEAM_URL, 200),
				posted(SEAM_URL, 200),
				aborted(SEAM_URL),
			],
			origin,
			category,
		);
		expect(inventory.corroborationRule).toBe(WITNESS_CANCELLED_DUPLICATE_FETCH_RULE);
		expect(inventory.nonLoopbackScope).toBe(
			WITNESS_CANCELLED_DUPLICATE_FETCH_NON_LOOPBACK_SCOPE,
		);
		expect(inventory.observed).toEqual([
			{
				method: 'POST',
				path: SEAM,
				reason: 'net::ERR_ABORTED',
				cancelled: 1,
				corroboratingSuccesses: 2,
				corroboratingStatuses: [200],
			},
		]);
		expect(inventory.admitted).toBe(1);
		expect(inventory.uncorroborated).toEqual([]);
	});

	it('matches the member regardless of which query the cancelled request carried', () => {
		const inventory = buildCancelledDuplicateFetchInventory(
			[
				posted(`${SEAM}?sentry_key=synthetic-not-a-credential&sentry_version=7`, 200),
				aborted(`${SEAM}?sentry_key=synthetic-not-a-credential&sentry_version=7&t=2`),
			],
			origin,
			category,
		);
		expect(inventory.admitted).toBe(1);
		expect(JSON.stringify(inventory)).not.toContain('sentry_key');
	});

	it('records the count it observed without the count ever becoming membership', () => {
		const once = buildCancelledDuplicateFetchInventory(
			[posted(SEAM_URL, 200), aborted(SEAM_URL)],
			origin,
			category,
		);
		const twice = buildCancelledDuplicateFetchInventory(
			[posted(SEAM_URL, 200), aborted(SEAM_URL), aborted(SEAM_URL)],
			origin,
			category,
		);
		expect(once.admitted).toBe(1);
		expect(twice.admitted).toBe(2);
		expect(once.category).toEqual(twice.category);
	});

	it('records a run whose reload caught nothing in flight as absent, not as observed', () => {
		const inventory = buildCancelledDuplicateFetchInventory(
			[posted(SEAM_URL, 200), posted(SEAM_URL, 200)],
			origin,
			category,
		);
		expect(inventory.observed).toEqual([]);
		expect(inventory.absent).toEqual([
			{ method: 'POST', path: SEAM, reason: 'net::ERR_ABORTED' },
		]);
		expect(inventory.admitted).toBe(0);
	});

	it('refuses an uncorroborated cancellation of the seam', () => {
		expect(() =>
			buildCancelledDuplicateFetchInventory(
				[outcome(`${origin}/index.html`), aborted(SEAM_URL)],
				origin,
				category,
			),
		).toThrow(/no corroborating successful fetch/);
	});

	it('refuses a cancellation corroborated only by a non-successful answer', () => {
		expect(() =>
			buildCancelledDuplicateFetchInventory(
				[posted(SEAM_URL, 429), aborted(SEAM_URL)],
				origin,
				category,
			),
		).toThrow(/no corroborating successful fetch/);
	});

	it('does not admit the seam under a different method', () => {
		const inventory = buildCancelledDuplicateFetchInventory(
			[outcome(SEAM_URL), aborted(SEAM_URL, 'GET')],
			origin,
			category,
		);
		expect(inventory.observed).toEqual([]);
		expect(inventory.admitted).toBe(0);
	});

	it('refuses a category member pinned with a query', () => {
		expect(() =>
			buildCancelledDuplicateFetchInventory([], origin, [
				{ method: 'POST', path: SEAM_URL, reason: 'net::ERR_ABORTED' },
			]),
		).toThrow(/must be pinned query-free/);
	});

	it('leaves the same-origin behavior exactly as it was', () => {
		const inventory = buildCancelledDuplicateFetchInventory(
			[outcome(`${origin}${GIF}`), aborted(`${origin}${GIF}`, 'GET'), outcome(`${origin}${GIF}`)],
			origin,
			[{ method: 'GET', path: GIF, reason: 'net::ERR_ABORTED' }],
		);
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
		// A wholly same-origin category says nothing about mocked seams, so it
		// carries no scope statement at all.
		expect(inventory.nonLoopbackScope).toBeUndefined();
	});
});

describe('mocked non-loopback seam inventory', () => {
	const category = [
		{ method: 'GET', path: TAG },
		{ method: 'POST', path: SEAM },
	] as const;

	it('records every declared seam by its query-free path, with the answers it received', () => {
		const inventory = buildMockedNonLoopbackSeamInventory(
			[
				outcome(`${origin}/index.html`),
				outcome(TAG_URL),
				posted(SEAM_URL, 200),
				posted(SEAM_URL, 200),
			],
			origin,
			category,
		);
		expect(inventory.policy).toBe('exact-app-scoped-mocked-non-loopback-seams');
		expect(inventory.pathPolicy).toBe(WITNESS_NON_LOOPBACK_QUERY_FREE_PATH_RULE);
		expect(inventory.successfulNonLoopback).toBe(0);
		expect(inventory.observed).toEqual([
			{ method: 'GET', path: TAG, requests: 1, statuses: [200] },
			{ method: 'POST', path: SEAM, requests: 2, statuses: [200] },
		]);
		expect(inventory.absent).toEqual([]);
		expect(inventory.outsideInventory).toEqual([]);
	});

	it('publishes no path anywhere in the inventory that carries a query', () => {
		const inventory = buildMockedNonLoopbackSeamInventory(
			[outcome(TAG_URL), posted(SEAM_URL, 200)],
			origin,
			category,
		);
		const paths = [...inventory.category, ...inventory.observed, ...inventory.absent].map(
			(entry) => entry.path,
		);
		expect(paths.length).toBeGreaterThan(0);
		for (const path of paths) expect(path).not.toContain('?');
		expect(JSON.stringify(inventory)).not.toContain('sentry_key');
		expect(JSON.stringify(inventory)).not.toContain('SYNTHETIC-TAG-ID');
	});

	it('records a declared seam the run never reached as absent', () => {
		const inventory = buildMockedNonLoopbackSeamInventory([outcome(TAG_URL)], origin, category);
		expect(inventory.observed).toEqual([
			{ method: 'GET', path: TAG, requests: 1, statuses: [200] },
		]);
		expect(inventory.absent).toEqual([{ method: 'POST', path: SEAM }]);
	});

	it('fails the run on a seam nobody declared', () => {
		expect(() =>
			buildMockedNonLoopbackSeamInventory(
				[outcome(TAG_URL), outcome('https://undeclared.example.invalid/pixel.gif')],
				origin,
				category,
			),
		).toThrow(/outside the declared seam inventory/);
	});

	it('refuses a member pinned with a query, and one pinned as an origin-relative path', () => {
		expect(() =>
			buildMockedNonLoopbackSeamInventory([], origin, [{ method: 'GET', path: TAG_URL }]),
		).toThrow(/query-free absolute endpoint/);
		expect(() =>
			buildMockedNonLoopbackSeamInventory([], origin, [{ method: 'GET', path: GIF }]),
		).toThrow(/query-free absolute endpoint/);
	});

	it('refuses a category that repeats a member', () => {
		expect(() =>
			buildMockedNonLoopbackSeamInventory([], origin, [...category, { method: 'GET', path: TAG }]),
		).toThrow(/repeats a member/);
	});

	it('looks at nothing the page fetched from its own origin', () => {
		const inventory = buildMockedNonLoopbackSeamInventory(
			[outcome(`${origin}${GIF}`), outcome(`${origin}/main.js`)],
			origin,
			[],
		);
		expect(inventory.observed).toEqual([]);
		expect(inventory.absent).toEqual([]);
		expect(inventory.outsideInventory).toEqual([]);
	});
});
