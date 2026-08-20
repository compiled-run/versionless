/**
 * The fallback for an application that ships no end-to-end suite: a bounded
 * breadth-first traversal of the routes its own served lane links to.
 *
 * This is a weaker reading than a spec and says so in its own vocabulary — a
 * crawl knows which routes exist, not which of them matter — but it is the only
 * reading available for an application whose authors wrote no suite, and an
 * absent journey is worth less than a shallow one.
 *
 * Two bounds are structural rather than tuning.
 *
 * **Loopback only.** Every URL is checked before the request is made, not after
 * it returns, and a non-loopback origin is refused rather than fetched: the
 * witness locality claim is `successfulNonLoopback: 0`, and a crawler that
 * followed one off-machine link would falsify it. Redirects are read manually
 * for the same reason — a followed redirect is a request this module did not
 * check.
 *
 * **Bounded depth and route count.** A crawl of an unseen application is a
 * traversal of a graph nobody has measured, so it stops at a declared depth and
 * a declared number of routes and records both in the outcome rather than
 * running until it happens to finish.
 */

import { parseURL } from 'ufo';
import {
	JOURNEY_SYNTHESIS_NOT_ESTABLISHED,
	routesOf,
	type JourneySynthesisReading,
	type SynthesizedJourney,
	type SynthesizedStep,
	type UnhandledConstruct,
} from './types.ts';
import type { JourneyUnreachableReason } from './vocabulary.ts';

export const CRAWL_DEFAULT_MAX_DEPTH = 2;
export const CRAWL_DEFAULT_MAX_ROUTES = 12;
export const CRAWL_DEFAULT_TIMEOUT_MS = 5_000;

export type CrawlBounds = Readonly<{
	maxDepth: number;
	maxRoutes: number;
	requestTimeoutMs: number;
}>;

export const CRAWL_DEFAULT_BOUNDS: CrawlBounds = Object.freeze({
	maxDepth: CRAWL_DEFAULT_MAX_DEPTH,
	maxRoutes: CRAWL_DEFAULT_MAX_ROUTES,
	requestTimeoutMs: CRAWL_DEFAULT_TIMEOUT_MS,
});

/** One route the crawl actually reached, with what the origin answered. */
export type CrawlRoute = Readonly<{
	route: string;
	depth: number;
	status: number;
	contentType: string | null;
	/** Routes this page linked to, before the bounds were applied. */
	links: readonly string[];
}>;

export type CrawlLocality = Readonly<{
	origin: string;
	scope: 'loopback-only';
	/** Every distinct origin a URL was resolved against, checked before request. */
	consideredOrigins: readonly string[];
	/** Off-machine origins the crawl declined to request, counted rather than followed. */
	refusedNonLoopbackOrigins: readonly string[];
	requestsIssued: number;
	nonLoopbackRequests: 0;
}>;

export type CrawlReading = JourneySynthesisReading &
	Readonly<{
		bounds: CrawlBounds;
		locality: CrawlLocality;
		visited: readonly CrawlRoute[];
		/** Set when the crawl produced no journey, from the closed reason set. */
		refusedReason: JourneyUnreachableReason | null;
	}>;

/**
 * Whether a hostname is this machine.
 *
 * The check is on the parsed hostname rather than on the URL text, because
 * `http://127.0.0.1.example.com/` contains a loopback address and is not one.
 */
export function isLoopbackHost(hostname: string): boolean {
	const host = hostname.replace('[', '').replace(']', '').toLowerCase();
	if (host === 'localhost' || host === '::1' || host === '0:0:0:0:0:0:0:1') return true;
	if (host === '::ffff:127.0.0.1') return true;
	const octets = host.split('.');
	if (octets.length !== 4) return false;
	if (octets[0] !== '127') return false;
	return octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255);
}

/** Whether a URL may be requested at all. */
export function isLoopbackUrl(value: string): boolean {
	try {
		const parsed = new URL(value);
		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
		return isLoopbackHost(parsed.hostname);
	} catch {
		return false;
	}
}

const SKIPPED_SCHEMES: readonly string[] = Object.freeze([
	'mailto:',
	'tel:',
	'javascript:',
	'data:',
	'blob:',
	'sms:',
	'ftp:',
]);

/**
 * Link-bearing attributes.
 *
 * `href` is the anchor. `routerLink` and `to` are how the two router libraries
 * in this corpus spell a link that never becomes an `href` until the router has
 * booted, and reading them is what keeps the crawl from stopping at the first
 * client-rendered page.
 */
const LINK_ATTRIBUTE_PATTERN =
	/(?:href|routerLink|routerlink|to|data-href)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/** Every link-shaped attribute value in a document, in source order. */
export function linkCandidates(html: string): readonly string[] {
	const found: string[] = [];
	LINK_ATTRIBUTE_PATTERN.lastIndex = 0;
	let match = LINK_ATTRIBUTE_PATTERN.exec(html);
	while (match !== null) {
		const value = (match[1] ?? match[2] ?? '').trim();
		if (value !== '') found.push(value);
		match = LINK_ATTRIBUTE_PATTERN.exec(html);
	}
	return Object.freeze(found);
}

/**
 * The origin-relative route a candidate resolves to, or `null` when it is not a
 * same-origin document route.
 *
 * A bare fragment (`#top`) is an in-page anchor rather than a route and is
 * dropped; a hash route (`#/settings`) is kept, because for a hash-router
 * application that IS the route.
 */
export function resolveRoute(candidate: string, base: string, origin: string): string | null {
	const lowered = candidate.toLowerCase();
	for (const scheme of SKIPPED_SCHEMES) if (lowered.startsWith(scheme)) return null;
	if (candidate.startsWith('#')) return candidate.startsWith('#/') ? candidate : null;
	let resolved: URL;
	try {
		resolved = new URL(candidate, base);
	} catch {
		return null;
	}
	if (resolved.origin !== origin) return null;
	const hash = resolved.hash.startsWith('#/') ? resolved.hash : '';
	return `${resolved.pathname}${resolved.search}${hash}`;
}

const HTML_CONTENT = 'text/html';

/**
 * Traverse the served lane.
 *
 * `fetchImplementation` is injectable so a test can prove the loopback rule
 * without a network, and defaults to the platform `fetch`.
 */
export async function crawlLaneJourneys(
	laneUrl: string,
	bounds: CrawlBounds = CRAWL_DEFAULT_BOUNDS,
	fetchImplementation: typeof fetch = fetch,
): Promise<CrawlReading> {
	const consideredOrigins: string[] = [];
	const refusedNonLoopbackOrigins: string[] = [];
	const visited: CrawlRoute[] = [];
	const unhandled: UnhandledConstruct[] = [];
	let requestsIssued = 0;
	const empty = (
		origin: string,
		reason: JourneyUnreachableReason,
		journeys: readonly SynthesizedJourney[] = [],
	): CrawlReading =>
		Object.freeze({
			source: 'crawl' as const,
			root: laneUrl,
			e2eRoots: Object.freeze([]),
			rootBasis: Object.freeze([]),
			specFiles: Object.freeze([]),
			journeys: Object.freeze([...journeys]),
			notEstablished: CRAWL_NOT_ESTABLISHED,
			bounds,
			locality: Object.freeze({
				origin,
				scope: 'loopback-only' as const,
				consideredOrigins: Object.freeze([...new Set(consideredOrigins)].sort()),
				refusedNonLoopbackOrigins: Object.freeze(
					[...new Set(refusedNonLoopbackOrigins)].sort(),
				),
				requestsIssued,
				nonLoopbackRequests: 0 as const,
			}),
			visited: Object.freeze([...visited]),
			refusedReason: reason,
		});
	if (!isLoopbackUrl(laneUrl)) {
		let origin = laneUrl;
		const parsed = parseURL(laneUrl);
		if (parsed.host !== undefined && parsed.host !== '')
			origin = `${parsed.protocol ?? 'http:'}//${parsed.host}`;
		consideredOrigins.push(origin);
		refusedNonLoopbackOrigins.push(origin);
		return empty(origin, 'lane-url-is-not-loopback');
	}
	const seed = new URL(laneUrl);
	const origin = seed.origin;
	consideredOrigins.push(origin);
	const seedRoute = `${seed.pathname === '' ? '/' : seed.pathname}${seed.search}${
		seed.hash.startsWith('#/') ? seed.hash : ''
	}`;
	const queue: Array<{ route: string; depth: number }> = [{ route: seedRoute, depth: 0 }];
	const enqueued = new Set<string>([seedRoute]);
	while (queue.length > 0 && visited.length < bounds.maxRoutes) {
		const next = queue.shift();
		if (next === undefined) break;
		const target = new URL(next.route, origin).toString();
		if (!isLoopbackUrl(target)) {
			refusedNonLoopbackOrigins.push(new URL(target).origin);
			continue;
		}
		let response: Response;
		requestsIssued += 1;
		try {
			response = await fetchImplementation(target, {
				redirect: 'manual',
				signal: AbortSignal.timeout(bounds.requestTimeoutMs),
			});
		} catch (error) {
			unhandled.push(
				Object.freeze({
					construct: 'crawl-route-not-answered',
					detail: `${next.route}: ${error instanceof Error ? error.message : String(error)}`,
					file: origin,
					line: 0,
				}),
			);
			continue;
		}
		const contentType = response.headers.get('content-type');
		const html = contentType !== null && contentType.includes(HTML_CONTENT);
		const body = html ? await response.text() : '';
		if (!html) await response.arrayBuffer().catch(() => new ArrayBuffer(0));
		const candidates: string[] = html ? [...linkCandidates(body)] : [];
		const location = response.headers.get('location');
		if (location !== null) candidates.push(location);
		const links: string[] = [];
		for (const candidate of candidates) {
			const route = resolveRoute(candidate, target, origin);
			if (route === null) {
				const offOrigin = offOriginOf(candidate, target);
				if (offOrigin !== null) {
					consideredOrigins.push(offOrigin);
					if (!isLoopbackHost(new URL(offOrigin).hostname))
						refusedNonLoopbackOrigins.push(offOrigin);
				}
				continue;
			}
			if (!links.includes(route)) links.push(route);
		}
		visited.push(
			Object.freeze({
				route: next.route,
				depth: next.depth,
				status: response.status,
				contentType,
				links: Object.freeze([...links]),
			}),
		);
		if (next.depth >= bounds.maxDepth) continue;
		for (const link of links) {
			if (enqueued.has(link)) continue;
			if (enqueued.size >= bounds.maxRoutes) break;
			enqueued.add(link);
			queue.push({ route: link, depth: next.depth + 1 });
		}
	}
	const reached = visited.filter((entry) => entry.status >= 200 && entry.status < 400);
	if (reached.length === 0) return empty(origin, 'crawl-reached-no-same-origin-route');
	const steps: SynthesizedStep[] = reached.map((entry, index) =>
		Object.freeze({
			kind: index === 0 ? ('visit' as const) : ('navigate' as const),
			route: entry.route,
			source: Object.freeze({ file: origin, line: entry.depth, scope: 'body' as const }),
		}),
	);
	const journey: SynthesizedJourney = Object.freeze({
		/**
		 * The name says what the journey measures, and not where it was served.
		 *
		 * A synthesized crawl is served on an ephemeral loopback port, so a name
		 * carrying the origin carried the port, and the port put a fresh value
		 * into the emitted record on every run — which put a fresh value into
		 * `integrity.canonicalDigest` and into every lane `semanticDigest`. A
		 * parity digest that changes every run cannot establish parity. The
		 * origin is still recorded, on `locality.origin`, which no digest reads.
		 */
		name: `bounded crawl of the served lane to depth ${String(bounds.maxDepth)}`,
		source: 'crawl',
		specFile: null,
		steps: Object.freeze(steps),
		routes: routesOf(steps),
		unhandled: Object.freeze([...unhandled]),
	});
	return Object.freeze({
		source: 'crawl' as const,
		root: laneUrl,
		e2eRoots: Object.freeze([]),
		rootBasis: Object.freeze([]),
		specFiles: Object.freeze([]),
		journeys: Object.freeze([journey]),
		notEstablished: CRAWL_NOT_ESTABLISHED,
		bounds,
		locality: Object.freeze({
			origin,
			scope: 'loopback-only' as const,
			consideredOrigins: Object.freeze([...new Set(consideredOrigins)].sort()),
			refusedNonLoopbackOrigins: Object.freeze(
				[...new Set(refusedNonLoopbackOrigins)].sort(),
			),
			requestsIssued,
			nonLoopbackRequests: 0 as const,
		}),
		visited: Object.freeze([...visited]),
		refusedReason: null,
	});
}

/** The origin a candidate points at when it points off this one, else `null`. */
function offOriginOf(candidate: string, base: string): string | null {
	try {
		const resolved = new URL(candidate, base);
		if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return null;
		return resolved.origin;
	} catch {
		return null;
	}
}

const CRAWL_NOT_ESTABLISHED: readonly string[] = Object.freeze([
	...JOURNEY_SYNTHESIS_NOT_ESTABLISHED,
	'A crawl records that a route was linked to and answered. It does not establish that the route matters, that it is reachable by a gesture a user would make, or that anything rendered on it.',
	'The traversal is bounded by a declared depth and route count. Routes beyond those bounds were not visited and are not claimed absent.',
	'Every URL is checked for a loopback host before it is requested and redirects are read rather than followed, so an off-machine origin is counted and declined instead of contacted.',
]);
