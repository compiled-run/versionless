import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	parseWitnessSynthesizedRealAppRecord,
	witnessReplayabilityRatio,
	witnessSynthesizedRealAppDigest,
	WITNESS_SYNTHESIZED_NOT_ESTABLISHED,
	WITNESS_SYNTHESIZED_REAL_APP_SCHEMA,
	type WitnessSynthesizedRealAppRecord,
} from '../../core/src/receipts/witness-real-app.ts';
import {
	journeySourceOfSynthesis,
	readJourneyDeclaration,
	recordDriverSelection,
	routeLinkSelectors,
	selectJourneyPath,
	tallyUnhandledByKind,
	urlIsRoute,
} from '../src/witness/journey-synthesis/driver.ts';
import { crawlLaneJourneys, CRAWL_DEFAULT_BOUNDS } from '../src/witness/journey-synthesis/crawl.ts';
import { emitSynthesizedJourneys } from '../src/witness/journey-synthesis/emit.ts';
import { isReplayable } from '../src/witness/journey-synthesis/types.ts';
import { enumerateJourneyOutcomeVocabulary } from '../src/witness/journey-synthesis/vocabulary.ts';
import { runSynthesizedWitnessRealApp } from '../src/witness/real-app-run.ts';

const PAPERCUPS_BASELINE = resolve(
	import.meta.dirname,
	'../../../.versionless/work/react-papercups-v1-0-0/baseline/build',
);
const PAPERCUPS_MIGRATED = resolve(
	import.meta.dirname,
	'../../../.versionless/work/react-papercups-v1-0-0/target/build-vite',
);
const PUBLISHED_RECORD = resolve(
	import.meta.dirname,
	'../../../evidence/runs/witness-synthesized/react-papercups-v1-0-0/record.json',
);

const present = async (file: string): Promise<boolean> => {
	try {
		await access(file);
		return true;
	} catch {
		return false;
	}
};

const papercupsLanePair =
	(await present(PAPERCUPS_BASELINE)) && (await present(PAPERCUPS_MIGRATED));

describe('synthesized witness driver selection', () => {
	it('uses the hand-authored driver when one is registered', () => {
		expect(selectJourneyPath({ registeredDriver: 'papercups', declaration: 'default' })).toBe(
			'hand-authored',
		);
		const selection = recordDriverSelection({
			registeredDriver: 'papercups',
			declaration: 'default',
		});
		expect(selection.journeySource).toBe('hand-authored');
		expect(selection.overridden).toBe(false);
		expect(selection.reason).toBe('hand-authored-driver-registered');
	});

	it('synthesizes when no hand-authored driver is registered, and names the reader', () => {
		expect(selectJourneyPath({ registeredDriver: null, declaration: 'default' })).toBe(
			'synthesized',
		);
		const crawl = recordDriverSelection({
			registeredDriver: null,
			declaration: 'default',
			derivedFrom: 'crawl',
		});
		expect(crawl.journeySource).toBe('synthesized-crawl');
		expect(crawl.reason).toBe('no-hand-authored-driver-registered');
		expect(crawl.overridden).toBe(false);
		const suite = recordDriverSelection({
			registeredDriver: null,
			declaration: 'default',
			derivedFrom: 'cypress',
		});
		expect(suite.journeySource).toBe('synthesized-e2e');
		expect(journeySourceOfSynthesis('playwright')).toBe('synthesized-e2e');
	});

	it('records the override when --journeys synthesized displaces a registered driver', () => {
		expect(readJourneyDeclaration('synthesized')).toBe('synthesized');
		expect(readJourneyDeclaration(undefined)).toBe('default');
		expect(() => readJourneyDeclaration('handwritten')).toThrow(/--journeys/);
		const selection = recordDriverSelection({
			registeredDriver: 'papercups',
			declaration: 'synthesized',
			derivedFrom: 'crawl',
		});
		expect(selection.registeredDriver).toBe('papercups');
		expect(selection.overridden).toBe(true);
		expect(selection.reason).toBe('hand-authored-driver-overridden-by-declaration');
		expect(selection.journeySource).toBe('synthesized-crawl');
	});

	it('refuses a synthesized selection that cannot name the reader it derived from', () => {
		expect(() =>
			recordDriverSelection({ registeredDriver: null, declaration: 'default' }),
		).toThrow(/derived from/);
	});

	it('reaches a route only by something on the page that points at it', () => {
		expect(routeLinkSelectors('/second.html')).toContain('a[href="/second.html"]');
		expect(routeLinkSelectors('/second.html')).toContain('a[href="second.html"]');
		expect(routeLinkSelectors('/a"b')).toHaveLength(0);
		expect(urlIsRoute('http://127.0.0.1:5000/second.html?x=1', '/second.html')).toBe(true);
		expect(urlIsRoute('http://127.0.0.1:5000/other', '/second.html')).toBe(false);
	});
});

const baseRecord = (): WitnessSynthesizedRealAppRecord => {
	const record: WitnessSynthesizedRealAppRecord = {
		schemaVersion: WITNESS_SYNTHESIZED_REAL_APP_SCHEMA,
		flow: 'witness-real-app-synthesized',
		application: 'papercups',
		framework: 'react',
		selection: {
			registeredDriver: 'papercups',
			journeySource: 'synthesized-crawl',
			overridden: true,
			reason: 'hand-authored-driver-overridden-by-declaration',
		},
		journeySource: 'synthesized-crawl',
		synthesized: {
			total: 4,
			replayable: 1,
			ran: 1,
			replayabilityRatio: witnessReplayabilityRatio(1, 4),
			unhandledByKind: { 'cypress-custom-command:login': 2 },
		},
		lanes: [
			{
				lane: 'baseline',
				journeys: [
					{
						name: 'bounded crawl of http://127.0.0.1:0 to depth 2',
						source: 'crawl',
						specFile: null,
						replayable: true,
						ran: true,
						routesDeclared: 2,
						routesReached: 2,
						selectorsDeclared: 0,
						selectorsPresent: 0,
						routesWithoutOverflow: 2,
						outcomes: ['journey-measured-route-reached-2-of-2-declared-routes'],
					},
				],
				successfulNonLoopback: 0,
				semanticDigest: 'a'.repeat(64),
			},
		],
		execution: { mode: 'serialized-one-lane-one-journey', lanesRun: 1, journeysRun: 1 },
		locality: { mode: 'offline', successfulNonLoopback: 0, osWideIsolation: false },
		notEstablished: [...WITNESS_SYNTHESIZED_NOT_ESTABLISHED],
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	record.integrity.canonicalDigest = witnessSynthesizedRealAppDigest(record);
	return record;
};

describe('synthesized witness record', () => {
	it('carries the replayability ratio as a required field the parser recomputes', () => {
		const record = baseRecord();
		expect(record.synthesized.replayabilityRatio).toBe(0.25);
		expect(parseWitnessSynthesizedRealAppRecord(record).synthesized.replayabilityRatio).toBe(
			0.25,
		);
		/**
		 * The field is not optional and it is not decorative: a record whose ratio
		 * disagrees with its own counts is refused rather than published, which is
		 * what stops the number from being something a writer chose.
		 */
		const drifted = baseRecord();
		drifted.synthesized.replayabilityRatio = 1;
		drifted.integrity.canonicalDigest = witnessSynthesizedRealAppDigest(drifted);
		expect(() => parseWitnessSynthesizedRealAppRecord(drifted)).toThrow(/replayability ratio/);
		const missing = baseRecord() as unknown as { synthesized: Record<string, unknown> };
		delete missing.synthesized.replayabilityRatio;
		expect(() =>
			parseWitnessSynthesizedRealAppRecord(
				missing as unknown as WitnessSynthesizedRealAppRecord,
			),
		).toThrow(/replayability ratio/);
	});

	it('refuses a run that left loopback and a ratio that exceeds its own total', () => {
		const left = baseRecord();
		(left.lanes[0] as { successfulNonLoopback: number }).successfulNonLoopback = 1;
		left.integrity.canonicalDigest = witnessSynthesizedRealAppDigest(left);
		expect(() => parseWitnessSynthesizedRealAppRecord(left)).toThrow(/left loopback/);
		expect(() => witnessReplayabilityRatio(3, 2)).toThrow(/cannot exceed/);
		expect(witnessReplayabilityRatio(0, 0)).toBe(0);
	});

	it('refuses an override that does not say it overrode anything', () => {
		const quiet = baseRecord();
		quiet.selection.reason = 'no-hand-authored-driver-registered';
		quiet.integrity.canonicalDigest = witnessSynthesizedRealAppDigest(quiet);
		expect(() => parseWitnessSynthesizedRealAppRecord(quiet)).toThrow(
			/driver selection differs/,
		);
	});

	it('tallies unhandled constructs by their stable name', () => {
		expect(
			tallyUnhandledByKind([
				{ construct: 'cypress-network-intercept' },
				{ construct: 'cypress-custom-command:login' },
				{ construct: 'cypress-network-intercept' },
			]),
		).toEqual({ 'cypress-custom-command:login': 1, 'cypress-network-intercept': 2 });
	});
});

describe('crawl-synthesized journey over two static pages on loopback', () => {
	it('derives a two-route journey whose every outcome is in the closed vocabulary', async () => {
		const pages: Record<string, string> = {
			'/': '<html><body><h1>first</h1><a href="/second.html">second</a></body></html>',
			'/second.html': '<html><body><h1>second</h1><a href="/">first</a></body></html>',
		};
		const server = createServer((request, response) => {
			const body = pages[(request.url ?? '/').split('?')[0] ?? '/'];
			if (body === undefined) {
				response.writeHead(404).end();
				return;
			}
			response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(body);
		});
		await new Promise<void>((settle) => server.listen(0, '127.0.0.1', settle));
		const origin = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
		try {
			const reading = await crawlLaneJourneys(origin, CRAWL_DEFAULT_BOUNDS, fetch);
			expect(reading.refusedReason).toBeNull();
			expect(reading.locality.nonLoopbackRequests).toBe(0);
			expect(reading.journeys).toHaveLength(1);
			const journey = reading.journeys[0]!;
			expect(journey.routes).toEqual(['/', '/second.html']);
			expect(isReplayable(journey)).toBe(true);
			const [emission] = emitSynthesizedJourneys(reading.journeys, {
				crawlBounds: CRAWL_DEFAULT_BOUNDS,
			});
			expect(emission!.replayable).toBe(true);
			expect(emission!.plan.routes).toHaveLength(2);
			/**
			 * The selectors the replay would click to reach the second route exist on
			 * the first page. This is the whole navigation contract of a crawl-derived
			 * journey: a route is reached by clicking something that points at it, or
			 * it is recorded unreached.
			 */
			expect(routeLinkSelectors('/second.html')[0]).toBe('a[href="/second.html"]');
			expect(pages['/']).toContain('href="/second.html"');
			const vocabulary = new Set(enumerateJourneyOutcomeVocabulary(8));
			for (const outcome of [...emission!.evidence.assertions, ...emission!.plan.pins])
				expect(vocabulary.has(outcome)).toBe(true);
			const ratio = witnessReplayabilityRatio(
				reading.journeys.filter((candidate) => isReplayable(candidate)).length,
				reading.journeys.length,
			);
			expect(ratio).toBe(1);
		} finally {
			await new Promise<void>((settle) => server.close(() => settle()));
		}
	});
});

describe.skipIf(!papercupsLanePair)('papercups lane pair on this host', () => {
	it('has no end-to-end suite, so the crawl fallback is the synthesized path', async () => {
		const server = createServer(() => undefined);
		server.close();
		/**
		 * The lane pair is on disk. Papercups ships no Cypress or Playwright suite,
		 * which is exactly why it is the first interesting synthesized case: its
		 * journeys can only come from a bounded crawl of what it serves, and its
		 * record must say `synthesized-crawl` rather than `synthesized-e2e`.
		 */
		expect(await present(`${PAPERCUPS_BASELINE}/index.html`)).toBe(true);
		expect(await present(`${PAPERCUPS_MIGRATED}/index.html`)).toBe(true);
		expect(await present(`${PAPERCUPS_MIGRATED}/../cypress`)).toBe(false);
		const selection = recordDriverSelection({
			registeredDriver: 'papercups',
			declaration: 'synthesized',
			derivedFrom: 'crawl',
		});
		expect(selection.journeySource).toBe('synthesized-crawl');
		expect(selection.overridden).toBe(true);
	});

	/**
	 * The browser leg. This drives Chromium against the lane pair that is on
	 * disk, through exactly the entry `witness:real-app --journeys synthesized`
	 * calls, and asserts the record that comes back rather than a record this
	 * file composed. The crawl is capped to two routes so the leg stays bounded:
	 * the derivation is the thing under test here, not the size of the traversal.
	 */
	it('drives Chromium against the lane pair and records an overridden synthesized run', async () => {
		const record = await runSynthesizedWitnessRealApp({
			application: 'papercups',
			framework: 'react',
			declaration: 'synthesized',
			lanes: [{ lane: 'baseline', laneRoot: PAPERCUPS_BASELINE }],
			crawlBounds: { ...CRAWL_DEFAULT_BOUNDS, maxDepth: 1, maxRoutes: 2 },
		});
		expect(record.journeySource).toBe('synthesized-crawl');
		expect(record.selection.registeredDriver).toBe('papercups');
		expect(record.selection.overridden).toBe(true);
		expect(record.selection.reason).toBe('hand-authored-driver-overridden-by-declaration');
		expect(record.locality.successfulNonLoopback).toBe(0);
		for (const lane of record.lanes) expect(lane.successfulNonLoopback).toBe(0);
		/**
		 * The ratio is present, is the number the parser recomputes from the very
		 * counts sitting beside it, and was never a number this run chose.
		 */
		expect(record.synthesized.replayabilityRatio).toBe(
			witnessReplayabilityRatio(record.synthesized.replayable, record.synthesized.total),
		);
		expect(record.synthesized.ran).toBeLessThanOrEqual(record.synthesized.replayable);
		expect(record.synthesized.ran).toBeGreaterThan(0);
		const vocabulary = new Set(enumerateJourneyOutcomeVocabulary(16));
		const outcomes = record.lanes.flatMap((lane) =>
			lane.journeys.flatMap((journey) => [...journey.outcomes]),
		);
		expect(outcomes.length).toBeGreaterThan(0);
		for (const outcome of outcomes) expect(vocabulary.has(outcome)).toBe(true);
		expect(parseWitnessSynthesizedRealAppRecord(record).journeySource).toBe(
			'synthesized-crawl',
		);
	}, 300_000);
});

/**
 * The record this unit published, read back from where the runner wrote it.
 *
 * It is asserted rather than described because the point of publishing it was
 * that a later reader can check the claims against the file instead of against
 * a sentence somebody wrote about the file.
 */
describe.skipIf(!(await present(PUBLISHED_RECORD)))(
	'published papercups synthesized record',
	() => {
		it('is a parseable record of an overridden, loopback-only, two-lane run', async () => {
			const record = parseWitnessSynthesizedRealAppRecord(
				JSON.parse(
					await readFile(PUBLISHED_RECORD, 'utf8'),
				) as WitnessSynthesizedRealAppRecord,
			);
			expect(record.application).toBe('papercups');
			expect(record.journeySource).toBe('synthesized-crawl');
			expect(record.selection.reason).toBe('hand-authored-driver-overridden-by-declaration');
			expect(record.selection.registeredDriver).toBe('papercups');
			expect(record.execution.mode).toBe('serialized-one-lane-one-journey');
			expect(record.execution.lanesRun).toBe(2);
			expect(record.lanes.map((lane) => lane.lane)).toEqual(['baseline', 'migrated']);
			expect(record.locality.successfulNonLoopback).toBe(0);
			expect(record.synthesized.replayabilityRatio).toBe(
				witnessReplayabilityRatio(record.synthesized.replayable, record.synthesized.total),
			);
			const vocabulary = new Set(enumerateJourneyOutcomeVocabulary(16));
			for (const lane of record.lanes)
				for (const journey of lane.journeys)
					for (const outcome of journey.outcomes)
						expect(vocabulary.has(outcome)).toBe(true);
		});
	},
);
