/**
 * The intermediate shape a synthesized witness journey is read into.
 *
 * Every hand-authored journey in `packages/cli/src/witness/*-run.ts` was
 * written by a person who had read the application. An unseen application has
 * nobody who has read it, so its journey has to be derived from what it already
 * ships: its own end-to-end suite, or — when it ships none — a bounded crawl of
 * its served lane.
 *
 * This module carries only the derived shape. Two properties of it are
 * deliberate and load-bearing.
 *
 * A step is recorded only when it can be replayed without the application's own
 * fixtures. A click on a `data-test` attribute can be replayed; a click behind a
 * custom Cypress command that seeds a database first cannot. The second kind is
 * not approximated and not dropped — it is recorded as a named
 * {@link UnhandledConstruct} on the journey that contained it, so a reader can
 * see exactly what the synthesis declined to express and count it.
 *
 * Nothing here states an outcome. A `SynthesizedJourney` says what a run would
 * DO; what a run may CLAIM is the emitter's business and is drawn from a closed
 * vocabulary (`vocabulary.ts`) that cannot spell a bare pass verb.
 */

/** Where a journey was derived from. */
export type JourneySynthesisSource = 'cypress' | 'playwright' | 'crawl';

/**
 * How a step names the element it touches.
 *
 * The basis is recorded rather than flattened into a CSS string because it is
 * the thing that decides whether the step survives a migration: a `data-test`
 * attribute is a contract the application maintains, and a positional CSS
 * descendant selector is not.
 */
export type SelectorBasis =
	| 'data-test'
	| 'data-cy'
	| 'data-testid'
	| 'test-id'
	| 'role'
	| 'text'
	| 'label'
	| 'placeholder'
	| 'css';

export type StepSource = Readonly<{
	/** Path of the spec the step was read from, relative to the synthesis root. */
	file: string;
	line: number;
	/** `it`/`test` body, or the hook whose body contributed the step. */
	scope: 'body' | 'before' | 'beforeEach';
}>;

/**
 * One replayable step.
 *
 * `visit` and `navigate` carry a route. `click`, `type`, `press` and
 * `assert-selector` carry a selector and its basis. `assert-route` and
 * `wait-for-route` carry the route a run waits for the application to settle
 * on, which is the only wait form synthesis admits: a wait on a network alias
 * is a wait on an intercept the synthesis did not install, and a wait on a
 * timer is not a wait on the application at all.
 */
export type SynthesizedStep = Readonly<{
	kind:
		| 'visit'
		| 'navigate'
		| 'click'
		| 'type'
		| 'press'
		| 'assert-selector'
		| 'assert-route'
		| 'wait-for-route';
	route?: string;
	selector?: string;
	selectorBasis?: SelectorBasis;
	/** Typed text, or the key for a `press`. Never a credential the spec computed. */
	value?: string;
	source: StepSource;
}>;

/**
 * A construct the reader could see and could not express, named rather than
 * dropped.
 *
 * `construct` is a stable identifier a fleet report can tally by —
 * `cypress-custom-command:login`, `cypress-network-intercept`,
 * `playwright-fixture-use`. `detail` is the source form, collapsed to one line,
 * so a reader can go and look at it.
 */
export type UnhandledConstruct = Readonly<{
	construct: string;
	detail: string;
	file: string;
	line: number;
}>;

export type SynthesizedJourney = Readonly<{
	/** `<describe> > <it>` for a spec, or the crawl's own bounded name. */
	name: string;
	source: JourneySynthesisSource;
	/** The spec this journey was read from; `null` for a crawl. */
	specFile: string | null;
	steps: readonly SynthesizedStep[];
	/** Distinct routes the steps name, in first-seen order. */
	routes: readonly string[];
	unhandled: readonly UnhandledConstruct[];
}>;

/** A journey is replayable when it names at least one route to start from. */
export function isReplayable(journey: SynthesizedJourney): boolean {
	return journey.steps.some((step) => step.kind === 'visit' && step.route !== undefined);
}

/** Distinct values in first-seen order. */
export function distinctInOrder(values: readonly string[]): readonly string[] {
	const seen = new Set<string>();
	const ordered: string[] = [];
	for (const value of values) {
		if (seen.has(value)) continue;
		seen.add(value);
		ordered.push(value);
	}
	return Object.freeze(ordered);
}

/** The routes a step list names, in first-seen order. */
export function routesOf(steps: readonly SynthesizedStep[]): readonly string[] {
	return distinctInOrder(
		steps.map((step) => step.route).filter((route): route is string => route !== undefined),
	);
}

/**
 * What one reader established about one source tree.
 *
 * `specFiles` and `e2eRoots` are recorded even when no journey came out of
 * them, because "there was a suite and nothing in it could be replayed" is a
 * different fact from "there was no suite".
 */
export type JourneySynthesisReading = Readonly<{
	source: JourneySynthesisSource;
	/** The root the reader was pointed at. */
	root: string;
	/** Directories the reader located by convention or by configuration. */
	e2eRoots: readonly string[];
	/** How each root was located: a configuration key, or the convention name. */
	rootBasis: readonly string[];
	specFiles: readonly string[];
	journeys: readonly SynthesizedJourney[];
	notEstablished: readonly string[];
}>;

export const JOURNEY_SYNTHESIS_NOT_ESTABLISHED: readonly string[] = Object.freeze([
	'A synthesized journey is a reading of the application own end-to-end suite or of its served routes. It is not a reading of what the application does, and nothing here establishes that a step will succeed when it is run.',
	'A construct recorded as unhandled is one this reader declined to express. It is not a defect in the application and it is not a claim that the construct is unreplayable in principle.',
	'Route and selector strings are reproduced as the spec writes them. A route the spec computes at run time is recorded as unhandled rather than guessed at.',
	'A count of synthesized journeys is not a count of covered behaviour.',
]);
