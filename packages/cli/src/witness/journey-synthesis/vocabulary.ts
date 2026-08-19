/**
 * The closed outcome vocabulary a synthesized journey may state.
 *
 * A hand-authored journey states its outcome in prose, because a person read
 * the application and wrote down what they had watched it do. Synthesis has
 * read nobody's application, so it may not borrow that register. What it may
 * say is drawn from this file and nowhere else: a fixed set of forms whose only
 * variable parts are counts and a closed set of reasons.
 *
 * The rule the forms are built around is mechanical rather than stylistic. A
 * synthesized journey states what it MEASURED — routes reached out of routes
 * declared, selectors present out of selectors declared, documents that did not
 * overflow — and never states a verdict about the application. That is why no
 * form here contains an inflected pass verb: there is no sentence in this
 * vocabulary that a reader could take as "the application passed".
 *
 * {@link assertSynthesizedOutcomeHonesty} is the guard, and the emitter runs
 * every string it produces through it. It is deliberately stricter than the
 * enterprise surface guard in `packages/trust/src/enterprise.ts` and does not
 * relax or restate any part of it: this file cannot weaken that guard, only
 * refuse strings before they ever reach it.
 */

/**
 * Why a surface produced no journey.
 *
 * Closed, because a reason assembled from whatever the failure happened to say
 * is a reason nothing can tally.
 */
export const JOURNEY_UNREACHABLE_REASONS = [
	'no-e2e-suite-and-no-lane-url',
	'e2e-suite-carries-no-replayable-visit',
	'crawl-reached-no-same-origin-route',
	'lane-url-is-not-loopback',
	'source-tree-not-readable',
] as const;

export type JourneyUnreachableReason = (typeof JOURNEY_UNREACHABLE_REASONS)[number];

/**
 * The suites a journey may declare it was synthesized from.
 *
 * `crawl` is not a suite, and it has its own form below rather than being
 * folded in here, so a reader can never mistake a traversal of served links for
 * a replay of something the application's own authors wrote.
 */
export const JOURNEY_SUITE_KINDS = ['e2e-suite', 'playwright-suite'] as const;

export type JourneySuiteKind = (typeof JOURNEY_SUITE_KINDS)[number];

const numeral = (value: number): string => {
	if (!Number.isInteger(value) || value < 0)
		throw new Error(
			`journey-synthesis vocabulary: a count must be a non-negative integer, received ${String(value)}`,
		);
	return String(value);
};

/** A journey read out of an application's own end-to-end suite. */
export function synthesizedFromSuite(kind: JourneySuiteKind, reached: number, declared: number) {
	return guarded(
		`journey-synthesized-from-${kind}-reached-${numeral(reached)}-of-${numeral(declared)}-routes`,
	);
}

/** A journey produced by the bounded crawl. */
export function synthesizedByCrawl(depth: number, reached: number) {
	return guarded(
		`journey-synthesized-by-crawl-bounded-depth-${numeral(depth)}-reached-${numeral(reached)}-routes`,
	);
}

/** No journey could be produced, with the reason from the closed set. */
export function surfaceNotReachable(reason: JourneyUnreachableReason) {
	return guarded(`journey-surface-not-reachable-${reason}`);
}

/** Routes the run reached, out of the routes the journey declared. */
export function measuredRoutesReached(reached: number, declared: number) {
	return guarded(
		`journey-measured-route-reached-${numeral(reached)}-of-${numeral(declared)}-declared-routes`,
	);
}

/** Selectors the run found present, out of the selectors the journey declared. */
export function measuredSelectorsPresent(present: number, declared: number) {
	return guarded(
		`journey-measured-selector-present-${numeral(present)}-of-${numeral(declared)}-declared-selectors`,
	);
}

/** Routes measured and found not to overflow the stated viewport. */
export function measuredNoOverflow(routes: number) {
	return guarded(`journey-measured-no-document-overflow-on-${numeral(routes)}-routes`);
}

/** Constructs the reader declined to express, counted rather than hidden. */
export function measuredUnhandledConstructs(count: number) {
	return guarded(`journey-measured-unhandled-construct-count-${numeral(count)}`);
}

/** Replayable gestures the journey declared, counted. */
export function measuredGesturesDeclared(count: number) {
	return guarded(`journey-measured-declared-gesture-count-${numeral(count)}`);
}

/**
 * Every form in this vocabulary, named, so a test can enumerate the whole set
 * rather than the handful of strings some code path happened to build.
 */
export const JOURNEY_OUTCOME_FORMS = [
	'journey-synthesized-from-<suite>-reached-<n>-of-<m>-routes',
	'journey-synthesized-by-crawl-bounded-depth-<d>-reached-<n>-routes',
	'journey-surface-not-reachable-<reason>',
	'journey-measured-route-reached-<n>-of-<m>-declared-routes',
	'journey-measured-selector-present-<n>-of-<m>-declared-selectors',
	'journey-measured-no-document-overflow-on-<n>-routes',
	'journey-measured-unhandled-construct-count-<n>',
	'journey-measured-declared-gesture-count-<n>',
] as const;

/**
 * Every string this vocabulary can produce for counts in `0..bound`.
 *
 * The counts are the only unbounded part of the vocabulary, and they are
 * decimal numerals, which no honesty guard can object to; enumerating a bounded
 * window of them is what lets a test assert over the *set* rather than over a
 * sample somebody chose.
 */
export function enumerateJourneyOutcomeVocabulary(bound = 4): readonly string[] {
	const strings: string[] = [];
	for (const reason of JOURNEY_UNREACHABLE_REASONS) strings.push(surfaceNotReachable(reason));
	for (let left = 0; left <= bound; left += 1) {
		strings.push(measuredNoOverflow(left));
		strings.push(measuredUnhandledConstructs(left));
		strings.push(measuredGesturesDeclared(left));
		for (let right = 0; right <= bound; right += 1) {
			/**
			 * The crawl form names two counts that do not move together: the depth
			 * the crawl was bounded to, and the number of routes it actually
			 * reached. A real bounded crawl of a single-page build reaches fewer
			 * routes than its depth allows, so enumerating only the diagonal left
			 * the strings such a run emits outside the set this vocabulary claims
			 * to close over.
			 */
			strings.push(synthesizedByCrawl(left, right));
			for (const kind of JOURNEY_SUITE_KINDS)
				strings.push(synthesizedFromSuite(kind, left, right));
			strings.push(measuredRoutesReached(left, right));
			strings.push(measuredSelectorsPresent(left, right));
		}
	}
	return Object.freeze(strings);
}

/**
 * Vocabulary this file refuses to spell.
 *
 * The pass-verb pattern is the same shape the enterprise surface guard applies
 * to its own emitted text. It is restated here as a *stricter* local rule —
 * unconditional, on every string, with no bounded-outcome exemption — so a
 * synthesized outcome can never be the thing that guard has to catch. The
 * remaining patterns are verdict words that would turn a measurement into a
 * judgement.
 */
const REFUSED_OUTCOME_PATTERNS: ReadonlyArray<{
	readonly label: string;
	readonly pattern: RegExp;
}> = Object.freeze([
	{ label: 'inflected-pass-verb', pattern: /\bpass(ed|es|ing)\b/i },
	{ label: 'bare-pass-noun', pattern: /\bpass\b/i },
	{ label: 'success-verdict', pattern: /\bsucce(ed|eds|eded|ss|ssful|ssfully)\b/i },
	{ label: 'works-verdict', pattern: /\b(works|working|worked)\b/i },
	{ label: 'verified-verdict', pattern: /\bverified\b/i },
	{ label: 'guaranteed', pattern: /\bguarantee[sd]?\b/i },
	{ label: 'certified', pattern: /(?<!not-)\bcertified\b/i },
	{ label: 'production-ready', pattern: /production.{0,2}ready\b/i },
	{ label: 'enterprise-ready', pattern: /enterprise.{0,2}ready\b/i },
	{ label: 'fully-supported', pattern: /fully[\s-]support/i },
]);

/**
 * Refuse an outcome string that states a verdict instead of a measurement.
 *
 * This throws rather than sanitizing, because a string that has to be repaired
 * to be honest is a string somebody meant to say something else with.
 */
export function assertSynthesizedOutcomeHonesty(value: string): void {
	for (const { label, pattern } of REFUSED_OUTCOME_PATTERNS)
		if (pattern.test(value))
			throw new Error(
				`journey-synthesis outcome states a verdict rather than a measurement (${label}): ${value}`,
			);
}

function guarded(value: string): string {
	assertSynthesizedOutcomeHonesty(value);
	return value;
}

export const JOURNEY_VOCABULARY_NOT_ESTABLISHED: readonly string[] = Object.freeze([
	'Every string in this vocabulary is a count of what a run measured. None of them is a verdict about the application, and none of them may be read as one.',
	'A route counted as reached is a route the run navigated to. Nothing here establishes what the application rendered there beyond the selectors the same journey declares.',
	'This vocabulary is stricter than the enterprise surface honesty guard and replaces no part of it. A surface that publishes these strings is still checked by that guard.',
]);
