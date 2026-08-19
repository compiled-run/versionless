import { existsSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	ANGULAR_PRE_IVY_BOUNDARY_POPULATION_STATEMENT,
	ANGULAR_PRE_IVY_BOUNDARY_PREVALENCE,
} from '../../core/src/receipts/angular-pre-ivy-boundary-amendment.ts';
import {
	HOLDOUT_ANGULAR_ESHOP_WEBSPA_APPLICATION,
	HOLDOUT_ANGULAR_ESHOP_WEBSPA_OUTCOME,
} from '../../core/src/receipts/holdout-angular-eshop-webspa.ts';
import type { WitnessApplicationJourneyEvidence } from '../../core/src/receipts/witness-real-app.ts';
import { assertEnterpriseSurfaceHonesty } from '../../trust/src/enterprise.ts';
import { buildRefusalCensus } from '../src/operator/refusal-census.ts';
import { runOperatorCommand, OPERATOR_COMMANDS, operatorHelp } from '../src/operator/flows.ts';
import { PIPELINE_STAGES } from '../src/operator/refusals.ts';
import { synthesizeWitnessJourneys } from '../src/operator/witness-synthesize.ts';
import {
	crawlLaneJourneys,
	isLoopbackHost,
	isLoopbackUrl,
	resolveRoute,
} from '../src/witness/journey-synthesis/crawl.ts';
import {
	readCypressJourneys,
	readCypressSpecSource,
} from '../src/witness/journey-synthesis/cypress.ts';
import {
	completeSynthesizedJourney,
	emitSynthesizedJourney,
	emitUnreachableSurface,
} from '../src/witness/journey-synthesis/emit.ts';
import { readPlaywrightSpecSource } from '../src/witness/journey-synthesis/playwright.ts';
import { isReplayable, type SynthesizedJourney } from '../src/witness/journey-synthesis/types.ts';
import {
	assertSynthesizedOutcomeHonesty,
	enumerateJourneyOutcomeVocabulary,
	JOURNEY_OUTCOME_FORMS,
} from '../src/witness/journey-synthesis/vocabulary.ts';
import type { JourneyEvidence } from '../src/witness/real-app-run.ts';

async function temporaryDirectory(): Promise<string> {
	return mkdtemp(path.join(tmpdir(), 'versionless-journey-synthesis-'));
}

/**
 * The cypress-realworld-app work area, when this host has one.
 *
 * `.versionless/work/` is gitignored, so the application's own suite is present
 * on a developer machine that has ingested it and absent on a clean checkout.
 * The reading of the REAL suite is asserted when it is there and skipped when it
 * is not; the committed fixture below is written to a temporary directory and
 * asserts the same reader behaviours unconditionally, so no assertion in this
 * file depends on an ignored path being present.
 */
const RWA_BASELINE = path.resolve('.versionless/work/react-cypress-rwa/baseline');

/**
 * A spec written in the idiom a real suite is written in: hooks that seed state
 * this reader cannot supply, gestures it can replay, a custom command it cannot,
 * and one route the spec computes at run time.
 */
const CYPRESS_FIXTURE_SPEC = [
	"describe('account settings', () => {",
	'	beforeEach(() => {',
	"		cy.task('db:seed');",
	"		cy.intercept('POST', '/api/session').as('session');",
	'	});',
	'',
	"	it('reaches the settings route and renames the account', () => {",
	"		cy.visit('/');",
	"		cy.get('[data-test=nav-settings]').click();",
	"		cy.location('pathname').should('equal', '/settings');",
	"		cy.get('[data-cy=display-name]').type('Ada');",
	"		cy.contains('Save').click();",
	"		cy.login('ada', 'opensesame');",
	"		cy.wait('@session');",
	'		cy.visit(`/user/${accountId}`);',
	'	});',
	'});',
	'',
].join('\n');

const PLAYWRIGHT_FIXTURE_SPEC = [
	"import { expect, test } from '@playwright/test';",
	'',
	"test.describe('account settings', () => {",
	"	test('reaches the settings route', async ({ page }) => {",
	"		await page.goto('/');",
	"		await page.getByTestId('nav-settings').click();",
	"		await expect(page).toHaveURL('/settings');",
	"		await page.getByLabel('Display name').fill('Ada');",
	"		await page.route('**/api/**', (route) => route.abort());",
	'		await page.waitForTimeout(50);',
	'	});',
	'});',
	'',
].join('\n');

const constructsOf = (journey: SynthesizedJourney): readonly string[] =>
	journey.unhandled.map((item) => item.construct);

describe('journey synthesis — the Cypress reader', () => {
	it('reads a spec into a replayable journey and names what it will not replay', () => {
		const journeys = readCypressSpecSource(CYPRESS_FIXTURE_SPEC, 'cypress/e2e/settings.cy.ts');
		expect(journeys).toHaveLength(1);
		const journey = journeys[0] as SynthesizedJourney;
		expect(journey.name).toBe(
			'account settings > reaches the settings route and renames the account',
		);
		expect(isReplayable(journey)).toBe(true);
		expect(journey.steps.filter((step) => step.kind === 'visit')).toHaveLength(1);
		expect(journey.routes).toEqual(['/', '/settings']);
		expect(
			journey.steps.map((step) => [step.kind, step.selector ?? step.route ?? null]),
		).toEqual([
			['visit', '/'],
			['click', '[data-test=nav-settings]'],
			['assert-route', '/settings'],
			['type', '[data-cy=display-name]'],
			['click', 'Save'],
		]);
		expect(
			journey.steps.filter((step) => step.kind === 'click').map((step) => step.selectorBasis),
		).toEqual(['data-test', 'text']);
		const typed = journey.steps.find((step) => step.kind === 'type');
		expect(typed?.value).toBe('Ada');
		expect(typed?.selectorBasis).toBe('data-cy');
	});

	it('records the hook state, the intercept, the custom command and the computed route', () => {
		const journeys = readCypressSpecSource(CYPRESS_FIXTURE_SPEC, 'cypress/e2e/settings.cy.ts');
		const constructs = constructsOf(journeys[0] as SynthesizedJourney);
		expect(constructs).toContain('cypress-task:db:seed');
		expect(constructs).toContain('cypress-network-intercept');
		expect(constructs).toContain('cypress-custom-command:login');
		expect(constructs).toContain('cypress-wait-on-network-alias');
		expect(constructs).toContain('cypress-computed-route');
		// The custom command's own literal arguments are never lifted into a
		// step: a value a support file consumes is not a value a page consumes.
		expect(JSON.stringify(journeys[0]?.steps)).not.toContain('opensesame');
		for (const item of (journeys[0] as SynthesizedJourney).unhandled) {
			expect(item.file).toBe('cypress/e2e/settings.cy.ts');
			expect(item.line).toBeGreaterThan(0);
			expect(item.detail.length).toBeGreaterThan(0);
		}
	});

	it('locates a suite through the application own configuration', async () => {
		const root = await temporaryDirectory();
		try {
			await mkdir(path.join(root, 'cypress', 'tests'), { recursive: true });
			await writeFile(
				path.join(root, 'cypress.json'),
				`${JSON.stringify({ integrationFolder: 'cypress/tests' }, null, '\t')}\n`,
			);
			await writeFile(
				path.join(root, 'cypress', 'tests', 'settings.spec.ts'),
				CYPRESS_FIXTURE_SPEC,
			);
			const reading = await readCypressJourneys(root);
			expect(reading.e2eRoots).toEqual(['cypress/tests']);
			expect(reading.rootBasis[0]).toContain('integrationFolder');
			expect(reading.specFiles).toEqual([path.join('cypress', 'tests', 'settings.spec.ts')]);
			expect(reading.journeys.filter((journey) => isReplayable(journey))).toHaveLength(1);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	/**
	 * The reading of the real cypress-realworld-app suite, when it is on disk.
	 *
	 * The application ships 21 spec files under the `integrationFolder` its own
	 * `cypress.json` declares, and this asserts what a synthesis of an unseen
	 * application is actually up against: most of its journeys are unreplayable
	 * because they are driven by the support file's own commands, and the
	 * handful that are replayable are the ones that start from a literal visit.
	 */
	it.skipIf(!existsSyncSafe(RWA_BASELINE))(
		'reads the cypress-realworld-app suite off its own work area',
		async () => {
			const reading = await readCypressJourneys(RWA_BASELINE);
			expect(reading.rootBasis.join(' ')).toContain('integrationFolder');
			expect(reading.specFiles.length).toBeGreaterThan(0);
			const replayable = reading.journeys.filter((journey) => isReplayable(journey));
			expect(replayable.length).toBeGreaterThanOrEqual(1);
			expect(
				(replayable[0] as SynthesizedJourney).steps.filter((step) => step.kind === 'visit')
					.length,
			).toBeGreaterThanOrEqual(1);
			const constructs = new Set(
				reading.journeys.flatMap((journey) => constructsOf(journey)),
			);
			expect(constructs.has('cypress-task:db:seed')).toBe(true);
			expect(constructs.has('cypress-network-intercept')).toBe(true);
			expect(constructs.has('cypress-custom-command:getBySel')).toBe(true);
		},
	);
});

describe('journey synthesis — the Playwright reader', () => {
	it('reads locator gestures and records the intercept and the timer wait', () => {
		const journeys = readPlaywrightSpecSource(PLAYWRIGHT_FIXTURE_SPEC, 'e2e/settings.spec.ts');
		expect(journeys).toHaveLength(1);
		const journey = journeys[0] as SynthesizedJourney;
		expect(isReplayable(journey)).toBe(true);
		expect(
			journey.steps.map((step) => [step.kind, step.selector ?? step.route ?? null]),
		).toEqual([
			['visit', '/'],
			['click', 'nav-settings'],
			['assert-route', '/settings'],
			['type', 'Display name'],
		]);
		const typed = journey.steps.find((step) => step.kind === 'type');
		// A locator gesture's first argument is the typed value, not a selector.
		expect(typed?.value).toBe('Ada');
		expect(typed?.selectorBasis).toBe('label');
		const constructs = constructsOf(journey);
		expect(constructs).toContain('playwright-network-intercept');
		expect(constructs).toContain('playwright-wait-on-timer');
	});
});

describe('journey synthesis — the emitter', () => {
	const journey = readCypressSpecSource(
		CYPRESS_FIXTURE_SPEC,
		'cypress/e2e/settings.cy.ts',
	)[0] as SynthesizedJourney;

	it('emits evidence the generic real-app journey shape accepts', () => {
		const emission = emitSynthesizedJourney(journey);
		/**
		 * The compile-time half of the check: the emission is assigned to the
		 * generic runner's own journey-evidence type and to the receipt module's
		 * application-journey type. A shape the runner would not accept fails
		 * `tsc` here rather than at a witness run nobody can afford to repeat.
		 */
		const evidence: Pick<
			JourneyEvidence,
			'assertions' | 'offlineEvidence' | 'applicationJourney'
		> = emission.evidence;
		const applicationJourney: WitnessApplicationJourneyEvidence | undefined =
			evidence.applicationJourney;
		expect(evidence.offlineEvidence).toEqual({ state: 'not-applicable' });
		expect(applicationJourney?.state).toBe('synthesized-witness-journey');
		expect(applicationJourney?.declaredRoutes).toEqual(['/', '/settings']);
		expect(emission.plan.selectors).toEqual([
			'[data-test=nav-settings]',
			'[data-cy=display-name]',
			'Save',
		]);
		expect(emission.plan.durableSelectors).toEqual([
			'[data-test=nav-settings]',
			'[data-cy=display-name]',
		]);
		expect(emission.replayable).toBe(true);
	});

	it('states declared counts on derivation and measured counts only after a run', () => {
		const emission = emitSynthesizedJourney(journey);
		expect(emission.evidence.assertions).toEqual([
			'journey-measured-declared-gesture-count-3',
			`journey-measured-unhandled-construct-count-${String(journey.unhandled.length)}`,
		]);
		expect(emission.plan.pins).toContain(
			'journey-synthesized-from-e2e-suite-reached-2-of-2-routes',
		);
		const completed = completeSynthesizedJourney(emission, {
			routesReached: 1,
			selectorsPresent: 2,
			routesWithoutOverflow: 1,
		});
		expect(completed.assertions).toContain(
			'journey-synthesized-from-e2e-suite-reached-1-of-2-routes',
		);
		expect(completed.assertions).toContain(
			'journey-measured-selector-present-2-of-3-declared-selectors',
		);
		for (const assertion of completed.assertions)
			expect(() => assertSynthesizedOutcomeHonesty(assertion)).not.toThrow();
	});

	it('carries a surface nobody could derive a journey for as evidence', () => {
		const evidence = emitUnreachableSurface(
			'no-e2e-suite-and-no-lane-url',
			'the tree ships no spec file and no lane URL was declared',
		);
		expect(evidence.assertions).toEqual([
			'journey-surface-not-reachable-no-e2e-suite-and-no-lane-url',
		]);
	});
});

/**
 * The honesty guard, applied to the whole vocabulary rather than to a sample.
 *
 * Two positions are checked. The first embeds every string in a document that
 * carries the enterprise surface's required declarations, which is how a
 * published surface would carry it. The second puts every string on the ONE
 * line the guard is strictest about — the line naming the eShop holdout, where
 * any inflected pass verb surviving the removal of the bounded outcome string is
 * a refusal. A vocabulary that survives that position survives anywhere.
 */
describe('journey synthesis — the outcome vocabulary is honest by construction', () => {
	const vocabulary = enumerateJourneyOutcomeVocabulary();

	const document = (lines: readonly string[]): string =>
		[
			`${HOLDOUT_ANGULAR_ESHOP_WEBSPA_APPLICATION} is recorded as ${HOLDOUT_ANGULAR_ESHOP_WEBSPA_OUTCOME}, counted in no lineage numerator.`,
			ANGULAR_PRE_IVY_BOUNDARY_PREVALENCE.statement,
			`The prevalence is published as ${ANGULAR_PRE_IVY_BOUNDARY_PREVALENCE.published}.`,
			ANGULAR_PRE_IVY_BOUNDARY_POPULATION_STATEMENT,
			'This record is evidence, not certification.',
			...lines,
		].join('\n');

	it('enumerates a non-trivial vocabulary covering every published form', () => {
		expect(vocabulary.length).toBeGreaterThan(50);
		expect(new Set(vocabulary).size).toBe(vocabulary.length);
		expect(JOURNEY_OUTCOME_FORMS.length).toBe(8);
	});

	it('survives the enterprise surface honesty guard as published text', () => {
		expect(() =>
			assertEnterpriseSurfaceHonesty(document(vocabulary), 'journey-synthesis vocabulary'),
		).not.toThrow();
	});

	it('survives it on the one line the guard is strictest about', () => {
		for (const value of vocabulary)
			expect(() =>
				assertEnterpriseSurfaceHonesty(
					document([
						`${HOLDOUT_ANGULAR_ESHOP_WEBSPA_APPLICATION} ${HOLDOUT_ANGULAR_ESHOP_WEBSPA_OUTCOME} ${value}`,
					]),
					'journey-synthesis vocabulary',
				),
			).not.toThrow();
	});

	it('refuses a verdict string, and the guard would catch one that got through', () => {
		for (const forbidden of [
			'journey-passed-on-the-settings-route',
			'journey-synthesis-passes',
			'journey-succeeded-on-2-routes',
			'journey-works-on-every-route',
		])
			expect(() => assertSynthesizedOutcomeHonesty(forbidden)).toThrow();
		expect(() =>
			assertEnterpriseSurfaceHonesty(
				document([
					`${HOLDOUT_ANGULAR_ESHOP_WEBSPA_APPLICATION} ${HOLDOUT_ANGULAR_ESHOP_WEBSPA_OUTCOME} journey-passed-on-the-settings-route`,
				]),
				'journey-synthesis vocabulary',
			),
		).toThrow('generic pass');
	});
});

describe('journey synthesis — the bounded crawl', () => {
	it('classifies loopback hosts and same-origin routes', () => {
		expect(isLoopbackHost('127.0.0.1')).toBe(true);
		expect(isLoopbackHost('localhost')).toBe(true);
		expect(isLoopbackHost('::1')).toBe(true);
		expect(isLoopbackHost('127.0.0.1.example.com')).toBe(false);
		expect(isLoopbackUrl('https://example.com/')).toBe(false);
		expect(isLoopbackUrl('file:///etc/passwd')).toBe(false);
		expect(resolveRoute('/b', 'http://127.0.0.1:1/a', 'http://127.0.0.1:1')).toBe('/b');
		expect(resolveRoute('#top', 'http://127.0.0.1:1/a', 'http://127.0.0.1:1')).toBeNull();
		expect(resolveRoute('#/settings', 'http://127.0.0.1:1/a', 'http://127.0.0.1:1')).toBe(
			'#/settings',
		);
		expect(
			resolveRoute('mailto:a@b.c', 'http://127.0.0.1:1/a', 'http://127.0.0.1:1'),
		).toBeNull();
		expect(
			resolveRoute('https://example.com/x', 'http://127.0.0.1:1/a', 'http://127.0.0.1:1'),
		).toBeNull();
	});

	it('walks two linked pages on a loopback origin and never leaves it', async () => {
		const pages: Readonly<Record<string, string>> = {
			'/': '<html><body><h1>one</h1><a href="/second.html">two</a><a href="https://example.com/away">off</a><a href="#top">anchor</a></body></html>',
			'/second.html':
				'<html><body><h1>two</h1><a href="/">back</a><a routerLink="/third">three</a></body></html>',
		};
		const server: Server = createServer((request, response) => {
			const body = pages[request.url ?? '/'];
			if (body === undefined) {
				response.writeHead(404, { 'content-type': 'text/plain' });
				response.end('not found');
				return;
			}
			response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
			response.end(body);
		});
		await new Promise<void>((listening) => void server.listen(0, '127.0.0.1', listening));
		try {
			const port = (server.address() as AddressInfo).port;
			const reading = await crawlLaneJourneys(`http://127.0.0.1:${String(port)}/`, {
				maxDepth: 1,
				maxRoutes: 2,
				requestTimeoutMs: 5_000,
			});
			expect(reading.refusedReason).toBeNull();
			expect(reading.journeys).toHaveLength(1);
			const journey = reading.journeys[0] as SynthesizedJourney;
			expect(journey.source).toBe('crawl');
			expect(journey.routes).toEqual(['/', '/second.html']);
			expect(journey.steps.map((step) => step.kind)).toEqual(['visit', 'navigate']);
			expect(reading.locality.nonLoopbackRequests).toBe(0);
			expect(reading.locality.refusedNonLoopbackOrigins).toEqual(['https://example.com']);
			expect(reading.locality.requestsIssued).toBe(2);
			for (const origin of reading.locality.consideredOrigins)
				expect(origin === `http://127.0.0.1:${String(port)}`).toBe(
					origin !== 'https://example.com',
				);
			const emission = emitSynthesizedJourney(journey, { crawlBounds: reading.bounds });
			expect(emission.plan.pins).toContain(
				'journey-synthesized-by-crawl-bounded-depth-1-reached-2-routes',
			);
		} finally {
			await new Promise<void>((closed) => void server.close(() => void closed()));
		}
	});

	it('refuses a non-loopback lane url without issuing a request', async () => {
		const reading = await crawlLaneJourneys('https://example.com/', undefined, () => {
			throw new Error('the crawl requested a non-loopback origin');
		});
		expect(reading.refusedReason).toBe('lane-url-is-not-loopback');
		expect(reading.locality.requestsIssued).toBe(0);
		expect(reading.locality.nonLoopbackRequests).toBe(0);
		expect(reading.journeys).toHaveLength(0);
	});
});

describe('journey synthesis — the witness-synthesize operator command', () => {
	it('is a published command with a stage, help and a census module', async () => {
		expect(OPERATOR_COMMANDS).toContain('witness-synthesize');
		expect(PIPELINE_STAGES).toContain('witness-synthesize');
		expect(
			operatorHelp('witness-synthesize').startsWith('versionless witness-synthesize'),
		).toBe(true);
		const census = await buildRefusalCensus();
		const entries = census.entries.filter(
			(entry) => entry.file === 'packages/cli/src/operator/witness-synthesize.ts',
		);
		expect(entries.length).toBeGreaterThanOrEqual(2);
		expect(entries.map((entry) => entry.code)).toContain(
			'witness-synthesize.no-journey-derived',
		);
		for (const entry of entries) {
			expect(entry.stage).toBe('witness-synthesize');
			expect(entry.origin).toBe('pipeline');
			expect(entry.classification).toBe('refusal');
		}
	});

	it('synthesizes from a tree that ships its own suite', async () => {
		const root = await temporaryDirectory();
		try {
			await mkdir(path.join(root, 'cypress', 'e2e'), { recursive: true });
			await writeFile(
				path.join(root, 'cypress', 'e2e', 'settings.cy.ts'),
				CYPRESS_FIXTURE_SPEC,
			);
			const record = await synthesizeWitnessJourneys({ root });
			expect(record.summary.fromE2eSuite).toBe(1);
			expect(record.summary.fromCrawl).toBe(0);
			expect(record.crawl.attempted).toBe(false);
			expect(record.summary.distinctUnhandledConstructs).toContain(
				'cypress-custom-command:login',
			);
			expect(record.journeys[0]?.evidence.applicationJourney?.state).toBe(
				'synthesized-witness-journey',
			);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it('refuses a tree with neither a readable suite nor a crawlable lane', async () => {
		const root = await temporaryDirectory();
		try {
			await writeFile(
				path.join(root, 'package.json'),
				`${JSON.stringify({ name: 'unseen' }, null, '\t')}\n`,
			);
			const outcome = await runOperatorCommand('witness-synthesize', [root]);
			expect(outcome.exitCode).toBe(2);
			const json = outcome.json as {
				outcome: string;
				refusal: { code: string; stage: string; origin: string; message: string };
			};
			expect(json.outcome).toBe('refused');
			expect(json.refusal.code).toBe('witness-synthesize.no-journey-derived');
			expect(json.refusal.stage).toBe('witness-synthesize');
			expect(json.refusal.origin).toBe('pipeline');
			expect(json.refusal.message).toContain('no lane URL was declared to crawl instead');
			expect(() => assertSynthesizedOutcomeHonesty(json.refusal.message)).not.toThrow();
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});

/** Whether this host carries the ingested work area, without throwing if not. */
function existsSyncSafe(target: string): boolean {
	try {
		return existsSync(target);
	} catch {
		return false;
	}
}
