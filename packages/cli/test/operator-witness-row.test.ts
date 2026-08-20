/**
 * The two facts the witness stage row used to drop on the floor.
 *
 * The run record is the surface a fleet report reads. Before this, its witness
 * row carried a digest and three counts, so the proof a reader could see was
 * thinner than the proof the standalone record held — and the slot that
 * standalone record was written into was keyed by the lane directory, which is
 * `baseline` for every application `acquire` fetches.
 */
import { describe, expect, it } from 'vitest';
import type { WitnessSynthesizedRealAppRecord } from '../../core/src/receipts/witness-real-app.ts';
import { witnessSlotKey } from '../src/operator/run.ts';
import { witnessJourneyRows } from '../src/operator/witness.ts';

const record = {
	schemaVersion: 'versionless.witness-real-app-synthesized.v1',
	flow: 'witness-real-app-synthesized',
	application: 'react-flame-v2-4-0',
	framework: 'react',
	selection: {
		journeySource: 'synthesized-crawl',
		overridden: false,
		reason: 'no-hand-authored-driver-registered',
		registeredDriver: null,
	},
	journeySource: 'synthesized-crawl',
	synthesized: { total: 1, replayable: 1, ran: 1, replayabilityRatio: 1, unhandledByKind: {} },
	lanes: [
		{
			lane: 'migrated',
			journeys: [
				{
					name: 'bounded crawl of the served lane to depth 2',
					source: 'crawl',
					specFile: null,
					replayable: true,
					ran: true,
					routesDeclared: 12,
					routesReached: 1,
					selectorsDeclared: 0,
					selectorsPresent: 0,
					routesWithoutOverflow: 1,
					outcomes: [
						'journey-measured-route-reached-1-of-12-declared-routes',
						'journey-measured-no-document-overflow-on-1-routes',
					],
				},
			],
			successfulNonLoopback: 0,
			semanticDigest: 'fe744f0b',
		},
	],
	execution: { mode: 'serialized-one-lane-one-journey', lanesRun: 1, journeysRun: 1 },
	locality: { mode: 'offline', successfulNonLoopback: 0, osWideIsolation: false },
	notEstablished: [],
	integrity: { algorithm: 'sha256', canonicalDigest: '50b1e155' },
} as unknown as WitnessSynthesizedRealAppRecord;

describe('the witness row a run record keeps', () => {
	it('carries the per-journey outcome strings verbatim, with the lane they ran on', () => {
		const [journey] = witnessJourneyRows(record);
		expect(journey?.lane).toBe('migrated');
		expect(journey?.outcomes).toEqual([
			'journey-measured-route-reached-1-of-12-declared-routes',
			'journey-measured-no-document-overflow-on-1-routes',
		]);
		expect(journey?.routesDeclared).toBe(12);
		expect(journey?.routesReached).toBe(1);
	});

	it('carries every lane, so a two-lane run is not read as a one-lane one', () => {
		const twoLanes = {
			...record,
			lanes: [{ ...record.lanes[0], lane: 'baseline' }, record.lanes[0]],
		} as unknown as WitnessSynthesizedRealAppRecord;
		expect(witnessJourneyRows(twoLanes).map((row) => row.lane)).toEqual([
			'baseline',
			'migrated',
		]);
	});
});

describe('the slot the witness record is filed under', () => {
	it('is the acquisition identity, not the lane directory every application shares', () => {
		expect(witnessSlotKey('.versionless/work/react-flame-v2-4-0/baseline')).toBe(
			'react-flame-v2-4-0',
		);
		expect(witnessSlotKey('.versionless/work/react-papercups-v1-0-0/baseline')).toBe(
			'react-papercups-v1-0-0',
		);
		expect(
			witnessSlotKey('.versionless/work/react-flame-v2-4-0/baseline') ===
				witnessSlotKey('.versionless/work/react-papercups-v1-0-0/baseline'),
		).toBe(false);
	});

	it('keeps its own basename when there is no acquisition identity above it', () => {
		expect(witnessSlotKey('/tmp/some-checkout/an-application')).toBe('an-application');
	});
});
