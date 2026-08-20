import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'pathe';
import { describe, expect, it } from 'vitest';
import { canonicalize } from '../../core/src/receipts/canonicalize.ts';
import { WITNESS_REACT_CYPRESS_RWA_FORBIDDEN_MARKERS } from '../../core/src/receipts/witness-react-cypress-rwa.ts';
import {
	buildLoopbackBackendInventory,
	normalizeJourneyPlaceholders,
	type WitnessCapturedMint,
} from '../src/witness/live-backend.ts';
import type { WitnessObservedRequestOutcome } from '../src/witness/playwright-host.ts';

const STATIC = 'http://127.0.0.1:40001';
const BACKEND = 'http://127.0.0.1:3001';

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

const category = [
	{ method: 'GET', path: '/checkAuth' },
	{ method: 'POST', path: '/login' },
	{ method: 'GET', path: '/transactions/{created-transaction-id}' },
];

describe('buildLoopbackBackendInventory', () => {
	it('counts backend requests in their own category and ignores static requests', () => {
		const inventory = buildLoopbackBackendInventory(
			[
				outcome(`${STATIC}/index.html`),
				outcome(`${STATIC}/static/js/main.js`),
				outcome(`${BACKEND}/checkAuth`, { status: 401 }),
				outcome(`${BACKEND}/checkAuth`, { status: 200 }),
				outcome(`${BACKEND}/login`, { method: 'POST' }),
			],
			STATIC,
			BACKEND,
			category,
		);
		expect(inventory.backend).toBe('live-loopback');
		expect(inventory.successfulNonLoopback).toBe(0);
		expect(inventory.outsideCategory).toEqual([]);
		expect(inventory.admitted).toBe(3);
		const checkAuth = inventory.observed.find((entry) => entry.path === '/checkAuth');
		expect(checkAuth?.requests).toBe(2);
		expect(checkAuth?.statuses).toEqual([200, 401]);
		// A declared endpoint the run never hit is recorded absent, not hidden.
		expect(
			inventory.absent.some(
				(entry) => entry.path === '/transactions/{created-transaction-id}',
			),
		).toBe(true);
	});

	it('fails on a backend request outside the declared category', () => {
		expect(() =>
			buildLoopbackBackendInventory(
				[outcome(`${BACKEND}/wallet/drain`, { method: 'DELETE' })],
				STATIC,
				BACKEND,
				category,
			),
		).toThrow(/outside the declared category/);
	});

	it('hard-fails on any non-loopback origin', () => {
		expect(() =>
			buildLoopbackBackendInventory(
				[outcome('https://api.example.invalid/track')],
				STATIC,
				BACKEND,
				category,
			),
		).toThrow(/non-loopback origin/);
	});
});

describe('normalizeJourneyPlaceholders (generic minted-value normalization)', () => {
	it('is deterministic under re-seed: different minted ids normalize to one inventory', () => {
		const mint = (value: string): readonly WitnessCapturedMint[] => [
			{ token: '{created-transaction-id}', origin: 'server-minted transaction id', value },
		];
		const invFor = (id: string) => {
			const outcomes = normalizeJourneyPlaceholders(
				[
					outcome(`${BACKEND}/checkAuth`, { status: 401 }),
					outcome(`${BACKEND}/login`, { method: 'POST' }),
					outcome(`${BACKEND}/transactions/${id}`),
				],
				mint(id),
			);
			return buildLoopbackBackendInventory(outcomes, STATIC, BACKEND, category);
		};
		// Two passes mint different ids; after normalization the inventories are byte-identical.
		expect(canonicalize(invFor('txn-aaa-111'))).toBe(canonicalize(invFor('txn-bbb-222')));
	});

	it('rejects a token that already appears literally in the evidence', () => {
		expect(() =>
			normalizeJourneyPlaceholders({ route: '/x/{id}/y' }, [
				{ token: '{id}', origin: 'x', value: 'abc' },
			]),
		).toThrow(/collides/);
	});

	it('rejects an empty minted value or token', () => {
		expect(() =>
			normalizeJourneyPlaceholders({ a: 'b' }, [{ token: '', origin: 'x', value: 'b' }]),
		).toThrow(/empty value or token/);
	});

	it('substitutes longer values first so a substring value cannot be half-replaced', () => {
		const out = normalizeJourneyPlaceholders({ v: 'abcabc-abc' }, [
			{ token: '{short}', origin: 'x', value: 'abc' },
			{ token: '{long}', origin: 'y', value: 'abcabc' },
		]);
		expect(out).toEqual({ v: '{long}-{short}' });
	});
});

describe('cypress-rwa spec redaction', () => {
	it('hard-codes no seed username, password or bcrypt hash', async () => {
		const specPath = join(
			dirname(fileURLToPath(import.meta.url)),
			'..',
			'src',
			'witness',
			'react-cypress-rwa-run.ts',
		);
		const source = await readFile(specPath, 'utf8');
		for (const marker of WITNESS_REACT_CYPRESS_RWA_FORBIDDEN_MARKERS)
			expect(source.includes(marker)).toBe(false);
	});
});
