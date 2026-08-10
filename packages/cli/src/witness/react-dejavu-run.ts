import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';

export type DejavuWitnessEvent = {
	kind: 'click' | 'type' | 'keyboard' | 'select' | 'scroll' | 'resize' | 'request';
	target: string;
	value?: string;
};

export type DejavuWitnessObservation = {
	lane: 'legacy' | 'vite8';
	run: 1 | 2;
	journey: 1 | 2;
	events: DejavuWitnessEvent[];
	requestUrls: string[];
	webSockets: string[];
	serviceWorkers: { registrations: number; controllers: number; requests: string[] };
	directWitnessModule: 'link:../witness';
};

export function verifyDejavuWitnessObservation(observation: DejavuWitnessObservation): {
	digest: string;
	visibleGestures: number;
	requests: number;
} {
	if (observation.directWitnessModule !== 'link:../witness')
		throw new Error('Dejavu run did not use direct linked Witness');
	const visibleKinds = new Set(['click', 'type', 'keyboard', 'select', 'scroll', 'resize']);
	const visibleGestures = observation.events.filter((event) =>
		visibleKinds.has(event.kind),
	).length;
	if (visibleGestures < 4) throw new Error('Dejavu Witness gestures are insufficient');
	for (const url of [...observation.requestUrls, ...observation.webSockets]) {
		const parsed = new URL(url);
		if (
			!['127.0.0.1', 'localhost'].includes(parsed.hostname) ||
			!['http:', 'ws:'].includes(parsed.protocol)
		)
			throw new Error('Dejavu runtime attempted a nonloopback origin');
	}
	if (
		observation.serviceWorkers.registrations !== 0 ||
		observation.serviceWorkers.controllers !== 0 ||
		observation.serviceWorkers.requests.length !== 0
	)
		throw new Error('Dejavu runtime observed a service worker');
	return {
		digest: sha256(canonicalize(observation)),
		visibleGestures,
		requests: observation.requestUrls.length,
	};
}

export function assertDejavuWitnessMatrix(observations: DejavuWitnessObservation[]): void {
	const keys = new Set(observations.map((item) => `${item.lane}:${item.run}:${item.journey}`));
	for (const lane of ['legacy', 'vite8'] as const)
		for (const run of [1, 2] as const)
			for (const journey of [1, 2] as const)
				if (!keys.has(`${lane}:${run}:${journey}`))
					throw new Error('Dejavu Witness matrix is incomplete');
	for (const observation of observations) verifyDejavuWitnessObservation(observation);
}
