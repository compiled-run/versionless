import { describe, expect, it } from 'vitest';
import {
	buildLoopbackBackendInventory,
	type LiveBackendSpec,
	liveBackendCorsEnv,
	liveBackendOrigin,
} from '../src/witness/live-backend.ts';
import { isWitnessLoopbackUrl } from '../src/witness/playwright-host.ts';
import type { WitnessObservedRequestOutcome } from '../src/witness/playwright-host.ts';

/**
 * The origin/CORS coordination that lets a served production-static SPA reach its
 * own spawned loopback backend. The generic serving path binds the static server
 * on 127.0.0.1 but must address the browser — and bucket the backend's requests
 * — at whatever loopback host the application's built SPA actually addresses, and
 * must inject the ephemeral served port into the CORS-origin variable the
 * backend reads. This locks that behavior at the unit level, no browser required.
 */

const spec = (overrides: Partial<LiveBackendSpec> = {}): LiveBackendSpec => ({
	command: 'node',
	args: ['server.js'],
	port: 3001,
	seed: { snapshot: 'data/seed.json', store: 'data/store.json' },
	health: { path: '/checkAuth', okStatus: [401] },
	...overrides,
});

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
];

describe('isWitnessLoopbackUrl (loopback-name recognition)', () => {
	it('recognizes both localhost and 127.0.0.1 as loopback, with an ephemeral port', () => {
		// The served SPA is addressed as `localhost` while the static server binds
		// `127.0.0.1`; both must read as loopback or the served origin would be
		// mistaken for egress.
		expect(isWitnessLoopbackUrl('http://localhost:3001/login')).toBe(true);
		expect(isWitnessLoopbackUrl('http://127.0.0.1:54321/index.html')).toBe(true);
	});

	it('rejects a genuinely remote host', () => {
		expect(isWitnessLoopbackUrl('https://api.example.invalid/track')).toBe(false);
	});
});

describe('liveBackendOrigin (declared host, never a name branch)', () => {
	it('defaults to 127.0.0.1 for an origin-agnostic backend', () => {
		expect(liveBackendOrigin(spec())).toBe('http://127.0.0.1:3001');
	});

	it('uses the declared loopback host the built SPA addresses', () => {
		expect(liveBackendOrigin(spec({ host: 'localhost' }))).toBe('http://localhost:3001');
	});
});

describe('liveBackendCorsEnv (served-port injection)', () => {
	it('injects nothing when the backend declares no CORS-origin port variable', () => {
		expect(liveBackendCorsEnv(spec(), { spaPort: 54321 })).toEqual({});
	});

	it('injects the actual served SPA port into each declared variable', () => {
		expect(
			liveBackendCorsEnv(spec({ corsOriginPortEnv: ['REACT_APP_PORT'] }), { spaPort: 54321 }),
		).toEqual({ REACT_APP_PORT: '54321' });
	});

	it('errors when a CORS-origin variable is declared but no served port is supplied', () => {
		expect(() =>
			liveBackendCorsEnv(spec({ corsOriginPortEnv: ['REACT_APP_PORT'] }), null),
		).toThrow(/no served SPA port/);
	});
});

describe('loopback-backend bucketing accepts the live localhost backend origin', () => {
	// The exact defect this unit fixes: with the backend origin computed from the
	// declared host, the localhost origin the SPA really calls is bucketed instead
	// of rejected as an "unexpected loopback origin".
	const backendOrigin = liveBackendOrigin(spec({ host: 'localhost' }));
	const staticOrigin = 'http://localhost:54321';

	it('buckets requests to the live localhost backend without throwing', () => {
		const inventory = buildLoopbackBackendInventory(
			[
				outcome(`${staticOrigin}/index.html`),
				outcome(`${backendOrigin}/checkAuth`, { status: 401 }),
				outcome(`${backendOrigin}/login`, { method: 'POST' }),
			],
			staticOrigin,
			backendOrigin,
			category,
		);
		expect(backendOrigin).toBe('http://localhost:3001');
		expect(inventory.admitted).toBe(2);
		expect(inventory.observed.map((entry) => entry.path).sort()).toEqual([
			'/checkAuth',
			'/login',
		]);
	});

	it('still rejects a third loopback origin that is neither static nor backend', () => {
		expect(() =>
			buildLoopbackBackendInventory(
				[outcome('http://localhost:9999/sneaky')],
				staticOrigin,
				backendOrigin,
				category,
			),
		).toThrow(/unexpected loopback origin/);
	});
});
