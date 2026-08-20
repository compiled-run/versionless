import { describe, expect, it } from 'vitest';
import {
	WITNESS_REACT_CYPRESS_RWA_PLACEHOLDERS,
	WITNESS_REACT_CYPRESS_RWA_ROUTES,
	type WitnessReactCypressRwaMeasuredBehavior,
	type WitnessReactCypressRwaMeasuredPass,
	summarizeWitnessReactCypressRwaTwoLaneParity,
	witnessReactCypressRwaMeasuredBehaviorDigest,
	witnessReactCypressRwaMeasuredSemanticDigest,
} from '../src/index.ts';

const laneDigest = (seed: string): string => seed.padStart(64, '0').slice(0, 64);

/**
 * The behavior every clean pass of both lanes shares — the exact shape the live
 * calibrate driver measured off the running application: 51 legs green, the ten
 * recorded routes, the tracked-event outcomes, a clean page, and the eleven
 * declared backend endpoints (the settings PATCH already normalized to its
 * `{created-user-id}` placeholder). This is the lane-independent projection; the
 * per-lane byte identity lives in `presentation`, out of this object.
 */
function sharedBehavior(): WitnessReactCypressRwaMeasuredBehavior {
	return {
		legs: { ok: 51, total: 51 },
		navigations: [...WITNESS_REACT_CYPRESS_RWA_ROUTES],
		trackedEventCounts: { change: 15, click: 16, input: 232, keydown: 232, mouseover: 27 },
		consoleErrors: 0,
		pageErrors: 0,
		failedRequests: 0,
		successfulNonLoopback: 0,
		mockedNonLoopback: 17,
		backend: [
			{ method: 'GET', path: '/checkAuth', requests: 2, statuses: [200] },
			{ method: 'GET', path: '/notifications', requests: 2, statuses: [200] },
			{ method: 'GET', path: '/transactions', requests: 2, statuses: [200] },
			{ method: 'GET', path: '/transactions/contacts', requests: 1, statuses: [200] },
			{ method: 'GET', path: '/transactions/public', requests: 3, statuses: [200] },
			{ method: 'GET', path: '/users', requests: 1, statuses: [200] },
			{ method: 'PATCH', path: '/users/{created-user-id}', requests: 1, statuses: [204] },
			{ method: 'POST', path: '/graphql', requests: 3, statuses: [200] },
			{ method: 'POST', path: '/login', requests: 1, statuses: [200] },
			{ method: 'POST', path: '/transactions', requests: 1, statuses: [200] },
			{ method: 'POST', path: '/users', requests: 1, statuses: [201] },
		],
	};
}

function makePass(
	lane: 'baseline' | 'migrated',
	pass: 1 | 2,
	mutate: (pass: WitnessReactCypressRwaMeasuredPass) => void = () => {},
): WitnessReactCypressRwaMeasuredPass {
	// Byte identity is deliberately per-lane and pass-stable: two genuinely
	// different builds (84-file webpack tree vs 18-file rolldown tree) reaching one
	// behavior is exactly what makes the parity non-trivial.
	const built: WitnessReactCypressRwaMeasuredPass = {
		lane,
		pass,
		status: 'passed',
		behavior: sharedBehavior(),
		presentation: {
			laneStaticFiles: lane === 'baseline' ? 84 : 18,
			laneStaticDigest: lane === 'baseline' ? laneDigest('ba5e') : laneDigest('m19'),
		},
		placeholders: WITNESS_REACT_CYPRESS_RWA_PLACEHOLDERS,
	};
	mutate(built);
	return built;
}

const fourPasses = (): WitnessReactCypressRwaMeasuredPass[] => [
	makePass('baseline', 1),
	makePass('baseline', 2),
	makePass('migrated', 1),
	makePass('migrated', 2),
];

describe('cypress-rwa two-lane parity + pass-twice determinism gate', () => {
	it('accepts four clean passes reaching one behavior over two distinct builds', () => {
		const verdict = summarizeWitnessReactCypressRwaTwoLaneParity(fourPasses());
		expect(verdict.result).toBe('parity');
		expect(verdict.behaviorParity).toBe(true);
		expect(verdict.lanesAreDistinctBuilds).toBe(true);
		// Parity: both lanes' behaviorDigests are the one shared digest.
		expect(verdict.lanes.baseline.behaviorDigest).toBe(verdict.behaviorDigest);
		expect(verdict.lanes.migrated.behaviorDigest).toBe(verdict.behaviorDigest);
		// Determinism folded into the semantic digest, which is distinct per lane.
		expect(verdict.lanes.baseline.deterministic).toBe(true);
		expect(verdict.lanes.migrated.deterministic).toBe(true);
		expect(verdict.lanes.baseline.semanticDigest).not.toBe(
			verdict.lanes.migrated.semanticDigest,
		);
		expect(verdict.lanes.baseline.legs).toEqual({ ok: 51, total: 51 });
	});

	it('keeps the declared per-lane byte identity OUT of the shared behavior digest', () => {
		// Two lanes differ only in their per-lane presentation (byte identity). The
		// behavior digest must be blind to it, and the semantic digest must not.
		const base = makePass('baseline', 1);
		const migrated = makePass('migrated', 1);
		expect(witnessReactCypressRwaMeasuredBehaviorDigest(base)).toBe(
			witnessReactCypressRwaMeasuredBehaviorDigest(migrated),
		);
		expect(witnessReactCypressRwaMeasuredSemanticDigest(base)).not.toBe(
			witnessReactCypressRwaMeasuredSemanticDigest(migrated),
		);
	});

	it('falsifies a genuine behavioral divergence on the migrated lane (dropped route)', () => {
		const passes = fourPasses();
		// The migrated lane silently skips the notifications leg — a real break.
		passes[2]!.behavior.navigations = passes[2]!.behavior.navigations.slice(0, -1);
		passes[3]!.behavior.navigations = passes[3]!.behavior.navigations.slice(0, -1);
		expect(() => summarizeWitnessReactCypressRwaTwoLaneParity(passes)).toThrow(/parity/);
	});

	it('falsifies a different backend interaction on the migrated lane', () => {
		const passes = fourPasses();
		// Migrated resolves onboarding via REST instead of the graphql mutation the
		// baseline used: the backend category shape diverges, so parity must fail.
		for (const index of [2, 3]) {
			const backend = passes[index]!.behavior.backend;
			backend[7] = { method: 'POST', path: '/graphql', requests: 2, statuses: [200] };
		}
		expect(() => summarizeWitnessReactCypressRwaTwoLaneParity(passes)).toThrow(/parity/);
	});

	it('falsifies pass-two determinism drift within a lane', () => {
		const passes = fourPasses();
		// Baseline pass-2 re-seeded but a tracked-event count drifted: the two passes
		// no longer share a semantic digest.
		passes[1]!.behavior.trackedEventCounts = {
			...passes[1]!.behavior.trackedEventCounts,
			click: 99,
		};
		expect(() => summarizeWitnessReactCypressRwaTwoLaneParity(passes)).toThrow(
			/pass-twice|drift/,
		);
	});

	it('rejects a console error the baseline lacks (clean-page break)', () => {
		const passes = fourPasses();
		passes[2]!.behavior.consoleErrors = 1;
		expect(() => summarizeWitnessReactCypressRwaTwoLaneParity(passes)).toThrow(/not clean/);
	});

	it('rejects a page error', () => {
		const passes = fourPasses();
		passes[2]!.behavior.pageErrors = 1;
		expect(() => summarizeWitnessReactCypressRwaTwoLaneParity(passes)).toThrow(/not clean/);
	});

	it('rejects a failed request', () => {
		const passes = fourPasses();
		passes[0]!.behavior.failedRequests = 2;
		expect(() => summarizeWitnessReactCypressRwaTwoLaneParity(passes)).toThrow(/not clean/);
	});

	it('rejects a leg that did not pass', () => {
		const passes = fourPasses();
		passes[2]!.behavior.legs = { ok: 50, total: 51 };
		expect(() => summarizeWitnessReactCypressRwaTwoLaneParity(passes)).toThrow(/not clean/);
	});

	it('rejects a non-loopback origin that succeeded', () => {
		const passes = fourPasses();
		(passes[2]!.behavior as { successfulNonLoopback: number }).successfulNonLoopback = 1;
		expect(() => summarizeWitnessReactCypressRwaTwoLaneParity(passes)).toThrow(/not clean/);
	});

	it('rejects a backend request outside the declared category', () => {
		const passes = fourPasses();
		for (const index of [0, 1, 2, 3])
			passes[index]!.behavior.backend = [
				...passes[index]!.behavior.backend,
				{ method: 'DELETE', path: '/wallet', requests: 1, statuses: [200] },
			];
		expect(() => summarizeWitnessReactCypressRwaTwoLaneParity(passes)).toThrow(/undeclared/);
	});

	it('rejects a seed marker leaking into the measured evidence (redaction)', () => {
		const passes = fourPasses();
		passes[0]!.behavior.backend = [
			...passes[0]!.behavior.backend,
			{ method: 'POST', path: '/login', requests: 1, statuses: [200] },
		];
		// Inject a forbidden seed marker into a recorded string.
		(passes[0]!.behavior.backend[0] as { path: string }).path = '/checkAuth?pw=s3cret';
		expect(() => summarizeWitnessReactCypressRwaTwoLaneParity(passes)).toThrow(
			/redaction|undeclared/,
		);
	});

	it('rejects a trivially-equal parity where the two lanes are byte-identical', () => {
		const passes = fourPasses();
		// Force the migrated lane to carry the baseline's byte identity: parity would
		// then be trivial (same build), which the gate refuses.
		for (const index of [2, 3]) passes[index]!.presentation = { ...passes[0]!.presentation };
		expect(() => summarizeWitnessReactCypressRwaTwoLaneParity(passes)).toThrow(/trivial/);
	});

	it('rejects a missing or duplicated pass', () => {
		expect(() =>
			summarizeWitnessReactCypressRwaTwoLaneParity([
				makePass('baseline', 1),
				makePass('baseline', 2),
				makePass('migrated', 1),
			]),
		).toThrow(/missing/);
		expect(() =>
			summarizeWitnessReactCypressRwaTwoLaneParity([
				makePass('baseline', 1),
				makePass('baseline', 1),
				makePass('migrated', 1),
				makePass('migrated', 2),
			]),
		).toThrow(/unexpected or duplicated/);
	});
});
