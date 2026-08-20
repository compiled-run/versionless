import { describe, expect, it } from 'vitest';
import {
	WITNESS_REACT_CYPRESS_RWA_BACKEND_CATEGORY,
	WITNESS_REACT_CYPRESS_RWA_PLACEHOLDERS,
	witnessReactCypressRwaMeasuredBehaviorDigest,
	type WitnessReactCypressRwaMeasuredBehavior,
} from '../../core/src/receipts/witness-react-cypress-rwa.ts';
import {
	buildLoopbackBackendInventory,
	normalizeJourneyPlaceholders,
	type WitnessCapturedMint,
} from '../src/witness/live-backend.ts';
import type { WitnessObservedRequestOutcome } from '../src/witness/playwright-host.ts';
import { captureMintedUserId } from '../src/fixture/react-cypress-rwa-calibrate-run.ts';

const STATIC = 'http://localhost:5321';
const BACKEND = 'http://localhost:3001';

const outcome = (method: string, url: string, status: number): WitnessObservedRequestOutcome => ({
	method,
	url,
	status,
	outcome: 'finished',
	reason: null,
});

/**
 * The backend ledger one journey pass produces, parameterized by the created
 * user's server-minted id, so two passes can differ in exactly that one value —
 * the way the live backend actually mints a fresh id each reseed.
 */
function ledger(userId: string): WitnessObservedRequestOutcome[] {
	return [
		outcome('GET', `${STATIC}/index.html`, 200),
		outcome('POST', `${BACKEND}/users`, 201),
		outcome('POST', `${BACKEND}/login`, 200),
		outcome('GET', `${BACKEND}/checkAuth`, 200),
		outcome('POST', `${BACKEND}/graphql`, 200),
		outcome('PATCH', `${BACKEND}/users/${userId}`, 204),
		outcome('GET', `${BACKEND}/users?q=a`, 200),
		outcome('POST', `${BACKEND}/transactions`, 200),
		outcome('GET', `${BACKEND}/transactions`, 200),
		outcome('GET', `${BACKEND}/transactions/public`, 200),
		outcome('GET', `${BACKEND}/transactions/contacts`, 200),
		outcome('GET', `${BACKEND}/notifications`, 200),
	];
}

/** The measured behavior a pass would carry, built from a normalized ledger the
 *  same way the calibrate driver builds it. */
function behaviorFromLedger(userId: string): WitnessReactCypressRwaMeasuredBehavior {
	const raw = ledger(userId);
	const minted = captureMintedUserId(raw, BACKEND);
	const mints: WitnessCapturedMint[] = minted
		? [{ ...WITNESS_REACT_CYPRESS_RWA_PLACEHOLDERS[0]!, value: minted }]
		: [];
	const inventory = buildLoopbackBackendInventory(
		normalizeJourneyPlaceholders(
			raw.map((entry) => ({ ...entry })),
			mints,
		),
		STATIC,
		BACKEND,
		WITNESS_REACT_CYPRESS_RWA_BACKEND_CATEGORY,
	);
	return {
		legs: { ok: 51, total: 51 },
		navigations: ['/signin', '/'],
		trackedEventCounts: { click: 16, input: 232, keydown: 232 },
		consoleErrors: 0,
		pageErrors: 0,
		failedRequests: 0,
		successfulNonLoopback: 0,
		mockedNonLoopback: 17,
		backend: inventory.observed.map((entry) => ({
			method: entry.method,
			path: entry.path,
			requests: entry.requests,
			statuses: [...entry.statuses],
		})),
	};
}

describe('cypress-rwa calibrate driver — minted-id capture + normalization', () => {
	it('captures the created user id from the settings PATCH', () => {
		expect(captureMintedUserId(ledger('edZNfbrD5'), BACKEND)).toBe('edZNfbrD5');
		expect(captureMintedUserId(ledger('yiWKdiTt2'), BACKEND)).toBe('yiWKdiTt2');
	});

	it('returns null when no user PATCH reached the backend', () => {
		expect(
			captureMintedUserId(
				[
					outcome('GET', `${BACKEND}/checkAuth`, 200),
					outcome('POST', `${BACKEND}/login`, 200),
				],
				BACKEND,
			),
		).toBeNull();
	});

	it('ignores a PATCH to a different backend origin', () => {
		expect(captureMintedUserId(ledger('edZNfbrD5'), 'http://localhost:9999')).toBeNull();
	});

	it('normalizes the minted id so two reseeded passes carry one behavior digest', () => {
		// Two passes that minted DIFFERENT user ids must reach the same normalized
		// backend category — the settings write appears as PATCH /users/{created-user-id}
		// in both — and therefore the same behavior digest. This is the determinism
		// the pass-twice guarantee rests on.
		const one = behaviorFromLedger('edZNfbrD5');
		const two = behaviorFromLedger('yiWKdiTt2');
		const patch = one.backend.find((entry) => entry.method === 'PATCH');
		expect(patch?.path).toBe('/users/{created-user-id}');
		expect(one.backend).toEqual(two.backend);
		const pass = (behavior: WitnessReactCypressRwaMeasuredBehavior) =>
			witnessReactCypressRwaMeasuredBehaviorDigest({
				lane: 'baseline',
				pass: 1,
				status: 'passed',
				behavior,
				presentation: { laneStaticFiles: 84, laneStaticDigest: 'a'.repeat(64) },
				placeholders: WITNESS_REACT_CYPRESS_RWA_PLACEHOLDERS,
			});
		expect(pass(one)).toBe(pass(two));
	});

	it('admits every observed endpoint into the declared backend category', () => {
		const behavior = behaviorFromLedger('edZNfbrD5');
		const declared = new Set(
			WITNESS_REACT_CYPRESS_RWA_BACKEND_CATEGORY.map(
				(entry) => `${entry.method} ${entry.path}`,
			),
		);
		for (const entry of behavior.backend)
			expect(declared.has(`${entry.method} ${entry.path}`)).toBe(true);
	});
});
