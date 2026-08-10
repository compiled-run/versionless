import { describe, expect, test } from 'vitest';
import {
	verifyFuxaWitnessMatrix,
	verifyFuxaWitnessObservation,
	type FuxaWitnessObservation,
} from '../src/witness/angular-fuxa-run.ts';

function observation(
	lane: FuxaWitnessObservation['lane'],
	run: 1 | 2,
	journey: FuxaWitnessObservation['journey'],
): FuxaWitnessObservation {
	return {
		lane,
		run,
		journey,
		directWitnessModule: 'link:../witness',
		geometry: {
			created: '10,10,40,30',
			moved: '25,20,40,30',
			undo: '10,10,40,30',
			redo: '25,20,40,30',
		},
		persistedGeometry: '25,20,40,30',
		requestUrls: ['http://127.0.0.1:4200/editor'],
		webSocketUrls: [],
		credentialsObserved: false,
		userOrPaymentDataObserved: false,
		serviceWorkers: { registrations: 0, controllers: 0, requests: [] },
		consoleErrors: [],
		pageErrors: [],
		requestFailures: [],
	};
}

describe('FUXA direct-Witness observations', () => {
	test('requires the complete two-lane, two-run, two-journey matrix', () => {
		const values = (['angular14-node16', 'angular16-node18'] as const).flatMap((lane) =>
			([1, 2] as const).flatMap((run) =>
				(['rectangle-drag-move-undo-redo', 'local-save-reload-persistence'] as const).map(
					(journey) => observation(lane, run, journey),
				),
			),
		);
		expect(() => verifyFuxaWitnessMatrix(values)).not.toThrow();
		expect(() => verifyFuxaWitnessMatrix(values.slice(1))).toThrow('incomplete');
	});

	test('rejects nonloopback, service-worker, and geometry failures', () => {
		const value = observation('angular16-node18', 1, 'rectangle-drag-move-undo-redo');
		expect(verifyFuxaWitnessObservation(value)).toHaveLength(64);
		expect(() =>
			verifyFuxaWitnessObservation({ ...value, requestUrls: ['https://example.test'] }),
		).toThrow('nonloopback');
		expect(() =>
			verifyFuxaWitnessObservation({
				...value,
				geometry: { ...value.geometry, undo: value.geometry.moved },
			}),
		).toThrow('geometry');
	});
});
