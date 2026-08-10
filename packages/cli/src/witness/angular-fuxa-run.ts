import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';

export type FuxaWitnessObservation = Readonly<{
	lane: 'angular14-node16' | 'angular16-node18';
	run: 1 | 2;
	journey: 'rectangle-drag-move-undo-redo' | 'local-save-reload-persistence';
	directWitnessModule: 'link:../witness';
	geometry: Readonly<{ created: string; moved: string; undo: string; redo: string }>;
	persistedGeometry: string;
	requestUrls: readonly string[];
	webSocketUrls: readonly string[];
	credentialsObserved: false;
	userOrPaymentDataObserved: false;
	serviceWorkers: Readonly<{ registrations: 0; controllers: 0; requests: readonly [] }>;
	consoleErrors: readonly [];
	pageErrors: readonly [];
	requestFailures: readonly [];
}>;

function loopback(url: string): boolean {
	const parsed = new URL(url);
	return (
		(parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') &&
		(parsed.protocol === 'http:' || parsed.protocol === 'ws:')
	);
}

export function verifyFuxaWitnessObservation(observation: FuxaWitnessObservation): string {
	if (observation.directWitnessModule !== 'link:../witness')
		throw new Error('FUXA journey did not use direct linked Witness');
	if (
		observation.geometry.created === observation.geometry.moved ||
		observation.geometry.undo !== observation.geometry.created ||
		observation.geometry.redo !== observation.geometry.moved ||
		observation.persistedGeometry !== observation.geometry.moved
	)
		throw new Error('FUXA rectangle geometry, undo-redo, or persistence differs');
	if (![...observation.requestUrls, ...observation.webSocketUrls].every(loopback))
		throw new Error('FUXA journey attempted nonloopback communication');
	if (
		observation.credentialsObserved ||
		observation.userOrPaymentDataObserved ||
		observation.serviceWorkers.registrations !== 0 ||
		observation.serviceWorkers.controllers !== 0 ||
		observation.serviceWorkers.requests.length !== 0 ||
		observation.consoleErrors.length !== 0 ||
		observation.pageErrors.length !== 0 ||
		observation.requestFailures.length !== 0
	)
		throw new Error(
			'FUXA journey observation is not clean, private, local, and service-worker-free',
		);
	return sha256(canonicalize(observation));
}

export function verifyFuxaWitnessMatrix(observations: readonly FuxaWitnessObservation[]): void {
	const keys = new Set(observations.map((item) => `${item.lane}:${item.run}:${item.journey}`));
	for (const lane of ['angular14-node16', 'angular16-node18'] as const)
		for (const run of [1, 2] as const)
			for (const journey of [
				'rectangle-drag-move-undo-redo',
				'local-save-reload-persistence',
			] as const)
				if (!keys.has(`${lane}:${run}:${journey}`))
					throw new Error('FUXA direct-Witness matrix is incomplete');
	for (const observation of observations) verifyFuxaWitnessObservation(observation);
}
