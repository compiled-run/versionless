import { type ChildProcess, spawn } from 'node:child_process';
import { copyFile, mkdir } from 'node:fs/promises';
import { get } from 'node:http';
import { dirname, resolve } from 'pathe';
import { parseURL, stringifyParsedURL } from 'ufo';
import type {
	WitnessJourneyPlaceholderDeclaration,
	WitnessLoopbackBackendCategoryEntry,
	WitnessLoopbackBackendInventory,
	WitnessLoopbackBackendObservation,
} from '../../../core/src/receipts/witness-real-app.ts';
import {
	WITNESS_LOOPBACK_BACKEND_RULE,
	WITNESS_REAL_APP_STATEFUL_NAMES,
} from '../../../core/src/receipts/witness-real-app.ts';
import { isWitnessLoopbackUrl, type WitnessObservedRequestOutcome } from './playwright-host.ts';

/**
 * A live first-party backend an {@link AppSpec} declares.
 *
 * Everything here is the application's own — its server command, the loopback
 * port its SPA was built against, the frozen seed snapshot it ships, and the
 * mutable store the server reads. The harness knows nothing app-specific: it
 * copies the declared snapshot over the declared store, runs the declared
 * command from the declared working directory, and waits for the declared
 * health probe. A future stateful application inherits this by declaring the
 * same fields; there is no branch on application identity anywhere in the
 * serving path.
 */
export type LiveBackendSpec = {
	/** The application's own server executable, run from its lane root. */
	command: string;
	args: readonly string[];
	/** The server's working directory, relative to the lane root. */
	cwd?: string;
	/** Extra environment the application's server reads, merged over the inherited environment. */
	env?: Readonly<Record<string, string>>;
	/**
	 * The loopback port the server binds. It is fixed by the application because
	 * its built SPA addresses it; the harness does not choose it, it serves it.
	 */
	port: number;
	/**
	 * The deterministic re-seed mechanism: the frozen seed snapshot and the
	 * mutable store it is copied over before every pass. Both are lane-relative,
	 * so the evidence names files rather than the machine.
	 */
	seed: { snapshot: string; store: string };
	/**
	 * Additional lane-relative file copies the application requires before its
	 * server boots (for example a committed mock-config file the build expects).
	 * Applied on every re-seed so a pass never inherits a previous pass's copy.
	 */
	prepare?: readonly { from: string; to: string }[];
	/**
	 * The readiness probe: an origin-relative path the server answers once it is
	 * up, and the set of statuses that count as up. An auth-gated route that
	 * answers 401 before any session exists is a server that is up, so the set is
	 * declared rather than assumed to be 200.
	 */
	health: { path: string; okStatus: readonly number[] };
	/** How long to wait for the health probe to pass before giving up. */
	readyTimeoutMs?: number;
};

/** A running live backend bound to a second bounded loopback origin. */
export type LiveBackendHandle = {
	/** The `http://127.0.0.1:<port>` origin the application's server is bound to. */
	origin: string;
	/**
	 * Restore the frozen seed and restart the server, so the next pass starts from
	 * exactly the declared snapshot rather than inheriting the mutations the
	 * previous pass made. A lowdb store is read at boot, so a re-seed is a
	 * restart, not a live file swap.
	 */
	reseed(): Promise<void>;
	/** Stop the server and release the loopback port. */
	close(): Promise<void>;
};

const DEFAULT_READY_TIMEOUT_MS = 30_000;
const HEALTH_POLL_INTERVAL_MS = 250;

function backendOrigin(port: number): string {
	return stringifyParsedURL({ protocol: 'http:', host: `127.0.0.1:${port}` });
}

async function probeHealth(origin: string, path: string): Promise<number | null> {
	return await new Promise<number | null>((resolvePromise) => {
		const request = get(`${origin}${path}`, (response) => {
			const status = response.statusCode ?? null;
			response.resume();
			resolvePromise(status);
		});
		request.setTimeout(HEALTH_POLL_INTERVAL_MS, () => request.destroy());
		request.on('error', () => resolvePromise(null));
	});
}

async function delay(ms: number): Promise<void> {
	await new Promise<void>((resolvePromise) => {
		setTimeout(resolvePromise, ms);
	});
}

async function applySeed(laneRoot: string, spec: LiveBackendSpec): Promise<void> {
	const copies = [
		{ from: spec.seed.snapshot, to: spec.seed.store },
		...(spec.prepare ?? []),
	];
	for (const copy of copies) {
		const to = resolve(laneRoot, copy.to);
		await mkdir(dirname(to), { recursive: true });
		await copyFile(resolve(laneRoot, copy.from), to);
	}
}

function spawnBackend(laneRoot: string, spec: LiveBackendSpec): ChildProcess {
	return spawn(spec.command, [...spec.args], {
		cwd: resolve(laneRoot, spec.cwd ?? '.'),
		env: { ...process.env, ...spec.env, PORT: String(spec.port) },
		stdio: 'ignore',
	});
}

async function waitForHealth(origin: string, spec: LiveBackendSpec): Promise<void> {
	const deadline = Date.now() + (spec.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS);
	const okStatus = new Set(spec.health.okStatus);
	while (Date.now() < deadline) {
		const status = await probeHealth(origin, spec.health.path);
		if (status !== null && okStatus.has(status)) return;
		await delay(HEALTH_POLL_INTERVAL_MS);
	}
	throw new Error(`live backend did not become healthy at ${origin}${spec.health.path}`);
}

async function stopProcess(child: ChildProcess): Promise<void> {
	if (child.exitCode !== null || child.signalCode !== null) return;
	await new Promise<void>((resolvePromise) => {
		child.once('exit', () => resolvePromise());
		child.kill('SIGTERM');
		setTimeout(() => {
			if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
		}, 2_000);
	});
}

/**
 * Spawns the application's own server on a second bounded loopback origin,
 * having first restored its frozen seed. Generic: every value comes from the
 * declared {@link LiveBackendSpec}, so a stateful application is served by
 * declaring one, not by teaching the harness its name.
 */
export async function startLiveBackend(
	laneRoot: string,
	spec: LiveBackendSpec,
): Promise<LiveBackendHandle> {
	const origin = backendOrigin(spec.port);
	let child: ChildProcess | null = null;
	const bringUp = async (): Promise<void> => {
		if (child !== null) await stopProcess(child);
		await applySeed(laneRoot, spec);
		child = spawnBackend(laneRoot, spec);
		await waitForHealth(origin, spec);
	};
	await bringUp();
	return {
		origin,
		reseed: bringUp,
		close: async () => {
			if (child !== null) await stopProcess(child);
			child = null;
		},
	};
}

function originRelativePath(url: string, origin: string): string {
	const rest = url.slice(origin.length);
	const parsed = parseURL(rest.startsWith('/') ? rest : `/${rest}`);
	return parsed.pathname || '/';
}

const backendKey = (method: string, path: string): string => `${method} ${path}`;

/**
 * Builds the live-backend request inventory for one run from the observed
 * request outcomes and the two bounded loopback origins.
 *
 * The static origin is ignored here — it has its own byte inventory — and every
 * request to the backend origin is counted in its own category by method and
 * origin-relative path. The non-loopback discipline is unweakened: a request to
 * anything that is neither loopback origin fails the run, and a backend endpoint
 * the journey did not declare lands in `outsideCategory`, which must stay empty.
 * `successfulNonLoopback` is fixed at 0 by construction, because nothing counted
 * here left the machine.
 */
export function buildLoopbackBackendInventory(
	requestOutcomes: readonly WitnessObservedRequestOutcome[],
	staticOrigin: string,
	origin: string,
	category: readonly WitnessLoopbackBackendCategoryEntry[],
): WitnessLoopbackBackendInventory {
	const declared = new Set(category.map((entry) => backendKey(entry.method, entry.path)));
	if (declared.size !== category.length)
		throw new Error('live backend inventory repeats a declared endpoint');
	const observations = new Map<string, WitnessLoopbackBackendObservation>();
	const outside: WitnessLoopbackBackendCategoryEntry[] = [];
	for (const outcome of requestOutcomes) {
		if (outcome.url.startsWith(staticOrigin)) continue;
		if (!outcome.url.startsWith(origin)) {
			if (!isWitnessLoopbackUrl(outcome.url))
				throw new Error(`live backend run reached a non-loopback origin: ${outcome.url}`);
			throw new Error(`live backend run reached an unexpected loopback origin: ${outcome.url}`);
		}
		const path = originRelativePath(outcome.url, origin);
		const key = backendKey(outcome.method, path);
		if (!declared.has(key)) {
			if (!outside.some((entry) => backendKey(entry.method, entry.path) === key))
				outside.push({ method: outcome.method, path });
			continue;
		}
		const existing = observations.get(key);
		const status = outcome.status ?? 0;
		if (existing === undefined)
			observations.set(key, {
				method: outcome.method,
				path,
				requests: 1,
				statuses: [status],
			});
		else {
			existing.requests += 1;
			if (!existing.statuses.includes(status)) existing.statuses.push(status);
		}
	}
	if (outside.length > 0)
		throw new Error(
			`live backend requests outside the declared category: ${JSON.stringify(outside)}`,
		);
	const observed = [...observations.values()].map((observation) => ({
		...observation,
		statuses: [...observation.statuses].sort((left, right) => left - right),
	}));
	observed.sort((left, right) =>
		backendKey(left.method, left.path).localeCompare(backendKey(right.method, right.path)),
	);
	const observedKeys = new Set(observed.map((entry) => backendKey(entry.method, entry.path)));
	const absent = category
		.filter((entry) => !observedKeys.has(backendKey(entry.method, entry.path)))
		.map((entry) => ({ method: entry.method, path: entry.path }));
	return {
		policy: 'live-first-party-loopback-backend',
		backend: 'live-loopback',
		rule: WITNESS_LOOPBACK_BACKEND_RULE,
		category: category.map((entry) => ({ method: entry.method, path: entry.path })),
		observed,
		absent,
		outsideCategory: [],
		admitted: observed.reduce((sum, entry) => sum + entry.requests, 0),
		successfulNonLoopback: 0,
	};
}

/** One minted value captured from a run, paired with the token that replaces it. */
export type WitnessCapturedMint = WitnessJourneyPlaceholderDeclaration & { value: string };

/**
 * Replaces every occurrence of each declared minted value with its stable
 * placeholder token throughout a run's recorded journey evidence.
 *
 * This is the generic form of the HospitalRun `{created-patient-id}` idiom: a
 * stateful journey mints identifiers its server decides, captures them, and
 * declares the token each is normalized to. Only the captured values are
 * touched — the shape of the evidence is untouched — so two passes that minted
 * different identifiers normalize to identical evidence while a dropped step
 * still differs. Longer values are substituted first so a value that is a
 * substring of another cannot be half-replaced, and a token that already appears
 * literally in the un-normalized evidence is rejected as ambiguous.
 */
export function normalizeJourneyPlaceholders<T>(evidence: T, mints: readonly WitnessCapturedMint[]): T {
	if (mints.length === 0) return structuredClone(evidence);
	const serialized = JSON.stringify(evidence);
	if (serialized === undefined)
		throw new Error('journey evidence is not serializable for placeholder normalization');
	let text = serialized;
	const ordered = [...mints].sort((left, right) => right.value.length - left.value.length);
	for (const mint of ordered) {
		if (mint.value.length === 0 || mint.token.length === 0)
			throw new Error('journey placeholder declares an empty value or token');
		if (text.includes(mint.token))
			throw new Error(`journey placeholder token collides with recorded evidence: ${mint.token}`);
	}
	for (const mint of ordered) text = text.split(mint.value).join(mint.token);
	return JSON.parse(text) as T;
}

/** The stateful application names this serving path admits, re-exported for callers. */
export const LIVE_BACKEND_STATEFUL_NAMES = WITNESS_REAL_APP_STATEFUL_NAMES;
