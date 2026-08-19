/**
 * Mapping a synthesized journey onto the shape the generic real-app runner
 * consumes.
 *
 * The mapping is where the honesty rule becomes structural rather than
 * editorial. A hand-authored journey returns `assertions` in prose because a
 * person watched the application do the thing they wrote down. Synthesis
 * watched nothing, so what it returns is drawn entirely from the closed
 * vocabulary in `vocabulary.ts`, and every string is passed back through that
 * file's guard on the way out — a synthesized journey physically cannot return
 * a bare pass verb, because the only strings it can build refuse to contain one.
 *
 * The emission is deliberately in two halves.
 *
 * {@link emitSynthesizedJourney} produces what is true the moment the journey
 * is derived: how many gestures it declares, how many constructs the reader
 * declined to express, which routes it will visit. Nothing there is a claim
 * about the application.
 *
 * {@link completeSynthesizedJourney} produces what is true after a run has
 * measured it: routes reached out of routes declared, selectors found present
 * out of selectors declared. That half is the runner's to call, and it is
 * separate precisely so the derivation cannot state a measurement it has not
 * taken.
 */

import type { WitnessApplicationJourneyEvidence } from '../../../../core/src/receipts/witness-real-app.ts';
import type { JourneyEvidence } from '../real-app-run.ts';
import type { CrawlBounds } from './crawl.ts';
import { isDurableSelector } from './selectors.ts';
import {
	isReplayable,
	type JourneySynthesisSource,
	type SynthesizedJourney,
	type SynthesizedStep,
} from './types.ts';
import {
	assertSynthesizedOutcomeHonesty,
	measuredGesturesDeclared,
	measuredNoOverflow,
	measuredRoutesReached,
	measuredSelectorsPresent,
	measuredUnhandledConstructs,
	surfaceNotReachable,
	synthesizedByCrawl,
	synthesizedFromSuite,
	type JourneySuiteKind,
	type JourneyUnreachableReason,
} from './vocabulary.ts';

/**
 * The half of a journey's evidence synthesis can supply.
 *
 * `offlineEvidence` is `not-applicable` because a synthesized journey makes no
 * offline claim: it was derived from a suite or a crawl, neither of which says
 * anything about what the application does with the network taken away.
 */
export type SynthesizedJourneyEvidence = Pick<
	JourneyEvidence,
	'assertions' | 'offlineEvidence' | 'applicationJourney'
>;

/** The gestures a run must replay, in order. */
export type SynthesizedJourneyPlan = Readonly<{
	routes: readonly string[];
	steps: readonly SynthesizedStep[];
	/** Selectors the journey will look for, deduplicated. */
	selectors: readonly string[];
	/** Selectors named by a test attribute, a role or a label. */
	durableSelectors: readonly string[];
	/**
	 * The vocabulary forms the run completes once it has measured. They are
	 * named rather than pre-filled, because a count nobody has taken is not a
	 * number this pipeline is willing to print.
	 */
	pins: readonly string[];
}>;

export type SynthesizedJourneyEmission = Readonly<{
	name: string;
	source: JourneySynthesisSource;
	specFile: string | null;
	replayable: boolean;
	evidence: SynthesizedJourneyEvidence;
	plan: SynthesizedJourneyPlan;
}>;

/** What a run measured, handed back for the second half of the emission. */
export type SynthesizedJourneyMeasurement = Readonly<{
	routesReached: number;
	selectorsPresent: number;
	routesWithoutOverflow: number;
}>;

export type EmitOptions = Readonly<{
	/** Present for a crawl-derived journey; its declared bound is stated. */
	crawlBounds?: CrawlBounds;
}>;

/**
 * A synthesized journey makes no offline claim.
 *
 * It was derived from a suite or from a crawl, and neither of those says
 * anything about what the application does with the network taken away. Stating
 * `not-applicable` is the honest reading; inheriting some other journey's
 * offline shape would be a claim nothing measured.
 */
const NOT_APPLICABLE_OFFLINE: JourneyEvidence['offlineEvidence'] = Object.freeze({
	state: 'not-applicable',
});

function suiteKindOf(source: JourneySynthesisSource): JourneySuiteKind | null {
	if (source === 'cypress') return 'e2e-suite';
	if (source === 'playwright') return 'playwright-suite';
	return null;
}

const GESTURE_KINDS: readonly SynthesizedStep['kind'][] = Object.freeze(['click', 'type', 'press']);

function selectorsOf(steps: readonly SynthesizedStep[]): readonly string[] {
	const seen: string[] = [];
	for (const step of steps) {
		if (step.selector === undefined) continue;
		if (!seen.includes(step.selector)) seen.push(step.selector);
	}
	return Object.freeze(seen);
}

function durableSelectorsOf(steps: readonly SynthesizedStep[]): readonly string[] {
	const seen: string[] = [];
	for (const step of steps) {
		if (step.selector === undefined || step.selectorBasis === undefined) continue;
		if (!isDurableSelector(step.selectorBasis)) continue;
		if (!seen.includes(step.selector)) seen.push(step.selector);
	}
	return Object.freeze(seen);
}

/** Every emitted string goes through the guard, no exceptions and no bypass. */
function guardAll(strings: readonly string[]): string[] {
	for (const value of strings) assertSynthesizedOutcomeHonesty(value);
	return [...strings];
}

/**
 * Derive the evidence and the plan for one journey.
 *
 * The `applicationJourney` record is where the derivation itself is carried.
 * The generic runner does not inspect it — that is the contract
 * `WitnessApplicationJourneyEvidence` states — so it is the right place for
 * facts only this synthesis can express, and it participates in the behaviour
 * digest, which is what makes a lane that synthesized something different
 * unable to agree with its own pair.
 */
export function emitSynthesizedJourney(
	journey: SynthesizedJourney,
	options: EmitOptions = {},
): SynthesizedJourneyEmission {
	const gestures = journey.steps.filter((step) => GESTURE_KINDS.includes(step.kind));
	const selectors = selectorsOf(journey.steps);
	const durable = durableSelectorsOf(journey.steps);
	const suite = suiteKindOf(journey.source);
	const declaredRoutes = journey.routes.length;
	const assertions = guardAll([
		measuredGesturesDeclared(gestures.length),
		measuredUnhandledConstructs(journey.unhandled.length),
	]);
	const pins = guardAll([
		suite === null
			? synthesizedByCrawl(options.crawlBounds?.maxDepth ?? 0, declaredRoutes)
			: synthesizedFromSuite(suite, declaredRoutes, declaredRoutes),
		measuredRoutesReached(declaredRoutes, declaredRoutes),
		measuredSelectorsPresent(selectors.length, selectors.length),
		measuredNoOverflow(declaredRoutes),
	]);
	const applicationJourney: WitnessApplicationJourneyEvidence = {
		state: 'synthesized-witness-journey',
		synthesis: {
			source: journey.source,
			specFile: journey.specFile,
			name: journey.name,
			...(options.crawlBounds === undefined
				? {}
				: { crawlBounds: { ...options.crawlBounds } }),
		},
		declaredRoutes: [...journey.routes],
		declaredGestures: gestures.map((step) => ({
			kind: step.kind,
			selector: step.selector ?? null,
			selectorBasis: step.selectorBasis ?? null,
		})),
		declaredSelectors: { total: selectors.length, durable: durable.length },
		unhandled: journey.unhandled.map((item) => ({
			construct: item.construct,
			file: item.file,
			line: item.line,
		})),
		vocabulary: [...assertions],
		pins: [...pins],
	};
	return Object.freeze({
		name: journey.name,
		source: journey.source,
		specFile: journey.specFile,
		replayable: isReplayable(journey),
		evidence: Object.freeze({
			assertions,
			offlineEvidence: NOT_APPLICABLE_OFFLINE,
			applicationJourney,
		}),
		plan: Object.freeze({
			routes: journey.routes,
			steps: journey.steps,
			selectors,
			durableSelectors: durable,
			pins: Object.freeze(pins),
		}),
	});
}

/**
 * Fill the emission's pins with what a run measured.
 *
 * Returns the same evidence shape with the measured strings appended, so the
 * runner hands the receipt one list rather than two vocabularies.
 */
export function completeSynthesizedJourney(
	emission: SynthesizedJourneyEmission,
	measured: SynthesizedJourneyMeasurement,
	options: EmitOptions = {},
): SynthesizedJourneyEvidence {
	const suite = suiteKindOf(emission.source);
	const declaredRoutes = emission.plan.routes.length;
	const declaredSelectors = emission.plan.selectors.length;
	const measuredStrings = guardAll([
		suite === null
			? synthesizedByCrawl(options.crawlBounds?.maxDepth ?? 0, measured.routesReached)
			: synthesizedFromSuite(suite, measured.routesReached, declaredRoutes),
		measuredRoutesReached(measured.routesReached, declaredRoutes),
		measuredSelectorsPresent(measured.selectorsPresent, declaredSelectors),
		measuredNoOverflow(measured.routesWithoutOverflow),
	]);
	const applicationJourney: WitnessApplicationJourneyEvidence = {
		...emission.evidence.applicationJourney,
		measured: {
			routesReached: measured.routesReached,
			routesDeclared: declaredRoutes,
			selectorsPresent: measured.selectorsPresent,
			selectorsDeclared: declaredSelectors,
			routesWithoutOverflow: measured.routesWithoutOverflow,
		},
		vocabulary: [...emission.evidence.assertions, ...measuredStrings],
	};
	return Object.freeze({
		assertions: [...emission.evidence.assertions, ...measuredStrings],
		offlineEvidence: NOT_APPLICABLE_OFFLINE,
		applicationJourney,
	});
}

/**
 * The evidence for a surface that produced no journey at all.
 *
 * A surface nobody could derive a journey for is a fact worth carrying, and
 * carrying it as evidence rather than as an absence is what stops a fleet
 * report from reading "no journeys" as "nothing went wrong".
 */
export function emitUnreachableSurface(
	reason: JourneyUnreachableReason,
	detail: string,
): SynthesizedJourneyEvidence {
	const assertions = guardAll([surfaceNotReachable(reason)]);
	return Object.freeze({
		assertions,
		offlineEvidence: NOT_APPLICABLE_OFFLINE,
		applicationJourney: {
			state: 'synthesized-witness-journey-not-derived',
			reason,
			detail,
			vocabulary: [...assertions],
		},
	});
}

/** Emit a whole reading's journeys, in the order the reader produced them. */
export function emitSynthesizedJourneys(
	journeys: readonly SynthesizedJourney[],
	options: EmitOptions = {},
): readonly SynthesizedJourneyEmission[] {
	return Object.freeze(journeys.map((journey) => emitSynthesizedJourney(journey, options)));
}
