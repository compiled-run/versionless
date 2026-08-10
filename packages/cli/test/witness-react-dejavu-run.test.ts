import { describe, expect, test } from 'vitest';
import {
	assertDejavuWitnessMatrix,
	type DejavuWitnessObservation,
	verifyDejavuWitnessObservation,
} from '../src/witness/react-dejavu-run.ts';

function observation(
	lane: 'legacy' | 'vite8',
	run: 1 | 2,
	journey: 1 | 2,
): DejavuWitnessObservation {
	return {
		lane,
		run,
		journey,
		directWitnessModule: 'link:../witness',
		events: [
			{ kind: 'click', target: '#connect' },
			{ kind: 'type', target: '#endpoint', value: 'http://127.0.0.1:19200' },
			{ kind: 'keyboard', target: '#endpoint', value: 'Enter' },
			{ kind: 'select', target: '#index', value: 'synthetic-primary' },
			{ kind: 'scroll', target: '#documents' },
		],
		requestUrls: ['http://127.0.0.1:19200/_cat/indices'],
		webSockets: [],
		serviceWorkers: { registrations: 0, controllers: 0, requests: [] },
	};
}

describe('direct Witness Dejavu boundaries', () => {
	test('accepts visible loopback-only SW-free observations', () => {
		const verified = verifyDejavuWitnessObservation(observation('legacy', 1, 1));
		expect(verified.visibleGestures).toBe(5);
		expect(verified.requests).toBe(1);
		expect(verified.digest).toHaveLength(64);
	});

	test('requires the complete two-lane two-run two-journey matrix', () => {
		const matrix: DejavuWitnessObservation[] = [];
		for (const lane of ['legacy', 'vite8'] as const)
			for (const run of [1, 2] as const)
				for (const journey of [1, 2] as const) matrix.push(observation(lane, run, journey));
		expect(() => assertDejavuWitnessMatrix(matrix)).not.toThrow();
		expect(() => assertDejavuWitnessMatrix(matrix.slice(1))).toThrow('incomplete');
	});

	test('rejects remote traffic and any service-worker state', () => {
		const remote = observation('vite8', 2, 2);
		remote.requestUrls.push('https://example.com/telemetry');
		expect(() => verifyDejavuWitnessObservation(remote)).toThrow('nonloopback');
		const serviceWorker = observation('vite8', 2, 2);
		serviceWorker.serviceWorkers.registrations = 1;
		expect(() => verifyDejavuWitnessObservation(serviceWorker)).toThrow('service worker');
	});
});
