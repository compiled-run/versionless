/**
 * The `witness:synthesize` stage: derive witness journeys for an application
 * nobody has read.
 *
 * Every journey in `packages/cli/src/witness/*-run.ts` was hand-authored
 * against an application somebody had opened, and that is the part of the
 * witness lane that does not scale: an unseen application arrives with no
 * journey and no author. This stage derives one from what the application
 * already ships — its own Cypress or Playwright suite — and falls back to a
 * bounded, loopback-only crawl of its served lane when it ships neither.
 *
 * What this stage does NOT do is run anything. It reads source and, for the
 * crawl, a served lane; it produces journey definitions and a summary. Wiring
 * the definitions into a witness run is a separate stage, and keeping the two
 * apart is what lets the derivation be checked without a browser.
 *
 * The refusal is the load-bearing outcome. An application with no readable
 * suite and no crawlable lane gets a named refusal at exit 2, not an empty
 * journey list at exit 0: a fleet report has to be able to tell "we derived
 * nothing here" from "we derived nothing worth writing down".
 */

import * as path from 'pathe';
import {
	crawlLaneJourneys,
	CRAWL_DEFAULT_BOUNDS,
	type CrawlBounds,
} from '../witness/journey-synthesis/crawl.ts';
import {
	emitSynthesizedJourneys,
	type SynthesizedJourneyEmission,
} from '../witness/journey-synthesis/emit.ts';
import { readCypressJourneys } from '../witness/journey-synthesis/cypress.ts';
import { readPlaywrightJourneys } from '../witness/journey-synthesis/playwright.ts';
import {
	isReplayable,
	type JourneySynthesisReading,
	type SynthesizedJourney,
} from '../witness/journey-synthesis/types.ts';
import { refuse } from './refusals.ts';

export const WITNESS_SYNTHESIS_SCHEMA = 'versionless.witness-journey-synthesis.v1';

/** The stage name every refusal raised here carries. */
export const WITNESS_SYNTHESIZE_STAGE = 'witness-synthesize' as const;

export type WitnessSynthesisOptions = Readonly<{
	/** The application source tree the readers are pointed at. */
	root: string;
	/** A served lane to crawl when no suite yields a journey. Loopback only. */
	laneUrl?: string;
	crawlBounds?: CrawlBounds;
	/** Injected in tests so the crawl can be exercised without a real server. */
	fetchImplementation?: typeof fetch;
}>;

export type ReaderSummary = Readonly<{
	e2eRoots: readonly string[];
	rootBasis: readonly string[];
	specFiles: number;
	journeys: number;
	replayable: number;
}>;

export type WitnessSynthesisRecord = Readonly<{
	flow: 'witness-synthesize';
	schemaVersion: string;
	root: string;
	laneUrl: string | null;
	cypress: ReaderSummary;
	playwright: ReaderSummary;
	crawl: Readonly<{
		attempted: boolean;
		bounds: CrawlBounds | null;
		locality: unknown;
		refusedReason: string | null;
		journeys: number;
	}>;
	summary: Readonly<{
		fromE2eSuite: number;
		fromCrawl: number;
		replayable: number;
		unhandledNotes: number;
		distinctUnhandledConstructs: readonly string[];
	}>;
	journeys: readonly SynthesizedJourneyEmission[];
	notEstablished: readonly string[];
}>;

const NOT_ESTABLISHED: readonly string[] = Object.freeze([
	'A synthesized journey is derived from an application own end-to-end suite or from a bounded crawl of its served lane. Nothing here establishes that the journey runs, that the application renders anything on the routes it names, or that the suite it came from covers the application.',
	'A construct recorded as unhandled is one the readers declined to express. Its count is a count of derivation gaps, not of application defects.',
	'The crawl is bounded by a declared depth and route count and is checked for a loopback host before every request. Routes beyond the bounds were not visited and are not claimed absent.',
	'This stage runs no browser. It produces journey definitions; whether a definition survives a witness run is measured elsewhere.',
]);

function summarize(reading: JourneySynthesisReading): ReaderSummary {
	return Object.freeze({
		e2eRoots: reading.e2eRoots,
		rootBasis: reading.rootBasis,
		specFiles: reading.specFiles.length,
		journeys: reading.journeys.length,
		replayable: reading.journeys.filter((journey) => isReplayable(journey)).length,
	});
}

/**
 * Derive journeys for one application.
 *
 * The suite readers run first and the crawl runs only when they produced no
 * replayable journey, because an application's own suite is a stronger reading
 * of what matters than a traversal of whatever its homepage happens to link to.
 */
export async function synthesizeWitnessJourneys(
	options: WitnessSynthesisOptions,
): Promise<WitnessSynthesisRecord> {
	const root = path.resolve(options.root);
	const cypress = await readCypressJourneys(root);
	const playwright = await readPlaywrightJourneys(root);
	const fromSuites: SynthesizedJourney[] = [
		...cypress.journeys.filter((journey) => isReplayable(journey)),
		...playwright.journeys.filter((journey) => isReplayable(journey)),
	];
	const bounds = options.crawlBounds ?? CRAWL_DEFAULT_BOUNDS;
	const laneUrl = options.laneUrl;
	const crawlAttempted = fromSuites.length === 0 && laneUrl !== undefined;
	const crawl =
		crawlAttempted && laneUrl !== undefined
			? await crawlLaneJourneys(laneUrl, bounds, options.fetchImplementation ?? fetch)
			: null;
	const crawlJourneys = crawl === null ? [] : [...crawl.journeys];
	const journeys = [...fromSuites, ...crawlJourneys];
	if (journeys.length === 0)
		refuse({
			code: 'witness-synthesize.no-journey-derived',
			message: `witness-synthesize: ${path.relative(process.cwd(), root) || '.'} yields no witness journey. Its ${String(cypress.specFiles.length + playwright.specFiles.length)} located spec file(s) carry no replayable visit, and ${laneUrl === undefined ? 'no lane URL was declared to crawl instead' : `the bounded crawl of ${laneUrl} ended with ${crawl?.refusedReason ?? 'no reached route'}`}. This flow refuses rather than emitting a journey nobody derived.`,
			stage: 'witness-synthesize',
			origin: 'pipeline',
		});
	const emissions = emitSynthesizedJourneys(
		journeys,
		crawlJourneys.length > 0 ? { crawlBounds: bounds } : {},
	);
	const constructs: string[] = [];
	let unhandledNotes = 0;
	for (const journey of journeys)
		for (const item of journey.unhandled) {
			unhandledNotes += 1;
			if (!constructs.includes(item.construct)) constructs.push(item.construct);
		}
	return Object.freeze({
		flow: 'witness-synthesize',
		schemaVersion: WITNESS_SYNTHESIS_SCHEMA,
		root,
		laneUrl: options.laneUrl ?? null,
		cypress: summarize(cypress),
		playwright: summarize(playwright),
		crawl: Object.freeze({
			attempted: crawlAttempted,
			bounds: crawl === null ? null : crawl.bounds,
			locality: crawl === null ? null : crawl.locality,
			refusedReason: crawl?.refusedReason ?? null,
			journeys: crawlJourneys.length,
		}),
		summary: Object.freeze({
			fromE2eSuite: fromSuites.length,
			fromCrawl: crawlJourneys.length,
			replayable: emissions.filter((emission) => emission.replayable).length,
			unhandledNotes,
			distinctUnhandledConstructs: Object.freeze([...constructs].sort()),
		}),
		journeys: emissions,
		notEstablished: NOT_ESTABLISHED,
	});
}

/** The synthesis as an operator reads it. */
export function renderWitnessSynthesis(
	record: WitnessSynthesisRecord,
	written: string | null,
): string {
	const lines = [
		`root: ${record.root}`,
		`lane url: ${record.laneUrl ?? 'not declared'}`,
		'',
		`journeys from an end-to-end suite: ${String(record.summary.fromE2eSuite)}`,
		`journeys from the bounded crawl: ${String(record.summary.fromCrawl)}`,
		`journeys with a replayable visit: ${String(record.summary.replayable)}`,
		`unhandled constructs recorded: ${String(record.summary.unhandledNotes)}`,
		'',
	];
	for (const root of record.cypress.rootBasis) lines.push(`  cypress root: ${root}`);
	for (const root of record.playwright.rootBasis) lines.push(`  playwright root: ${root}`);
	if (record.crawl.attempted) lines.push(`  crawl: ${JSON.stringify(record.crawl.locality)}`);
	lines.push('');
	for (const construct of record.summary.distinctUnhandledConstructs)
		lines.push(`  unhandled: ${construct}`);
	lines.push('');
	for (const emission of record.journeys)
		lines.push(
			`  [${emission.source}] ${emission.name} — ${String(emission.plan.routes.length)} route(s), ${String(emission.plan.selectors.length)} selector(s)`,
		);
	lines.push('');
	if (written !== null) lines.push(`written: ${written}`, '');
	for (const line of record.notEstablished) lines.push(`not established: ${line}`);
	return `${lines.join('\n')}\n`;
}

/**
 * Read a declared crawl bound.
 *
 * A bound that is not a non-negative integer is refused by name rather than
 * coerced, because a silently coerced bound is a bound the recorded evidence
 * would misreport.
 */
export function readCrawlBound(flag: string, value: string | undefined, fallback: number): number {
	if (value === undefined) return fallback;
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 0)
		refuse({
			code: 'witness-synthesize.bound-is-not-a-non-negative-integer',
			message: `witness-synthesize: ${flag} must be a non-negative integer, received ${value}`,
			stage: 'witness-synthesize',
			origin: 'pipeline',
		});
	return parsed;
}
