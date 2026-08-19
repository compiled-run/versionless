/**
 * Which journey a witness run replays, and why.
 *
 * Every application in this corpus that has a witness proof has it because
 * somebody opened the application and wrote a driver for it. That is the part
 * that does not scale, and it is also the part that is strongest: a
 * hand-authored journey knows what the application is FOR. So the selection here
 * is not "synthesize when you can" — it is "use the author's journey when there
 * is one, and say so when there is not".
 *
 * The one case this file exists to make impossible to misread is the third one.
 * An application that HAS an author's driver can still be witnessed through
 * synthesis, deliberately, as a controlled comparison — and a record of that run
 * which said only `synthesized-crawl` would read exactly like a record of an
 * application nobody could write a journey for. So the override is recorded as
 * an override: the registered driver is named even though it was not used, and
 * the reason says the declaration overrode it.
 *
 * Nothing here runs anything. It decides and it explains; the replay is
 * `real-app-run.ts`'s.
 */

import type {
	WitnessDriverSelection,
	WitnessJourneySource,
} from '../../../../core/src/receipts/witness-real-app.ts';
import type { JourneySynthesisSource } from './types.ts';

/** What a caller declared about which journeys to use. */
export type JourneyDeclaration = 'default' | 'synthesized';

/**
 * Read the `--journeys` declaration.
 *
 * An unrecognized value is refused by name rather than treated as the default,
 * because a run that silently ignored what it was told is a run whose record
 * describes a different run.
 */
export function readJourneyDeclaration(value: string | undefined): JourneyDeclaration {
	if (value === undefined) return 'default';
	if (value === 'synthesized') return 'synthesized';
	throw new Error(`--journeys accepts only "synthesized", received ${value}`);
}

/** The path a run takes before anything has been derived. */
export type JourneyPath = 'hand-authored' | 'synthesized';

export function selectJourneyPath(options: {
	registeredDriver: string | null;
	declaration: JourneyDeclaration;
}): JourneyPath {
	if (options.declaration === 'synthesized') return 'synthesized';
	return options.registeredDriver === null ? 'synthesized' : 'hand-authored';
}

/** The synthesized member that matches the reader which produced the journeys. */
export function journeySourceOfSynthesis(source: JourneySynthesisSource): WitnessJourneySource {
	return source === 'crawl' ? 'synthesized-crawl' : 'synthesized-e2e';
}

/**
 * The selection as it is recorded.
 *
 * `derivedFrom` is supplied only on the synthesized path, and it is required
 * there: a synthesized run that could not say which reader produced its
 * journeys would be a run that cannot distinguish replaying the application's
 * own suite from traversing its links.
 */
export function recordDriverSelection(options: {
	registeredDriver: string | null;
	declaration: JourneyDeclaration;
	derivedFrom?: JourneySynthesisSource;
}): WitnessDriverSelection {
	const path = selectJourneyPath(options);
	if (path === 'hand-authored')
		return Object.freeze({
			registeredDriver: options.registeredDriver,
			journeySource: 'hand-authored',
			overridden: false,
			reason: 'hand-authored-driver-registered',
		});
	if (options.derivedFrom === undefined)
		throw new Error(
			'a synthesized witness selection must name the reader its journeys were derived from',
		);
	const overridden = options.registeredDriver !== null;
	return Object.freeze({
		registeredDriver: options.registeredDriver,
		journeySource: journeySourceOfSynthesis(options.derivedFrom),
		overridden,
		reason: overridden
			? 'hand-authored-driver-overridden-by-declaration'
			: 'no-hand-authored-driver-registered',
	});
}

/**
 * The selectors a replay may click to reach a route from the page it is on.
 *
 * A synthesized journey names routes; it does not name the gesture that reaches
 * them, because the reader that derived it saw links and not gestures. So the
 * replay reaches a route the only way a user could — by clicking something that
 * points at it — and this is the bounded list of ways an anchor can point at the
 * same route. A route no anchor on the current document points at is recorded as
 * unreached rather than reached by an address bar the application never offered.
 *
 * Every candidate is an attribute selector over a literal href, so a route
 * carrying a quote or a backslash produces no candidate at all rather than a
 * selector that means something else.
 */
export function routeLinkSelectors(route: string): readonly string[] {
	if (route.includes('"') || route.includes('\\')) return Object.freeze([]);
	const trimmed = route.startsWith('/') ? route.slice(1) : route;
	const candidates = [
		`a[href="${route}"]`,
		`a[href="${trimmed}"]`,
		`a[href="./${trimmed}"]`,
		`a[href="#${trimmed}"]`,
	];
	const seen: string[] = [];
	for (const candidate of candidates) if (!seen.includes(candidate)) seen.push(candidate);
	return Object.freeze(seen);
}

/**
 * Whether a URL the browser settled on is the route the journey asked for.
 *
 * Compared on pathname and hash rather than on the whole URL, because the
 * loopback port is ephemeral and a query the application added is the
 * application's business, not a different route.
 */
export function urlIsRoute(url: string, route: string): boolean {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return false;
	}
	const reached = `${parsed.pathname}${parsed.hash}`;
	if (reached === route) return true;
	if (route === '/' && reached === '') return true;
	return reached === (route.startsWith('/') ? route : `/${route}`);
}

/** Tally unhandled constructs by their stable name, so a fleet report can sum them. */
export function tallyUnhandledByKind(
	constructs: readonly { readonly construct: string }[],
): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const item of constructs) counts[item.construct] = (counts[item.construct] ?? 0) + 1;
	return Object.fromEntries(
		Object.entries(counts).sort(([left], [right]) => (left < right ? -1 : 1)),
	);
}
