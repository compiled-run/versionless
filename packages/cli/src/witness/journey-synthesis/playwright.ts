/**
 * Reading an application's own Playwright suite into witness journeys.
 *
 * The shape of the problem is the Cypress one and the vocabulary is not, so
 * this is a sibling of `cypress.ts` rather than a parameterisation of it: a
 * Playwright spec names elements through locator builders that already carry
 * their own basis (`getByRole`, `getByTestId`), sequences gestures with `await`
 * instead of with a command queue, and installs its unreplayable state through
 * fixtures and `page.route` rather than through custom commands and `cy.task`.
 * Folding the two into one reader would have meant a table of exceptions that
 * reads like neither runner.
 *
 * What is shared is the rule: a step survives only if it replays against a
 * served lane with nothing behind it, and everything else is recorded by name.
 */

import * as path from 'pathe';
import {
	bodyStatements,
	calleeName,
	callChainsBelow,
	callbackOf,
	lineOf,
	moduleStatements,
	parseSpec,
	sourceForm,
	staticString,
	statementCall,
	type CallChain,
	type Node,
} from './ast.ts';
import {
	dedupeRoots,
	directoryExists,
	fileText,
	filesBelow,
	isSpecFileName,
	staticConfigString,
	type LocatedRoot,
} from './files.ts';
import { selectorBasisOfCss } from './selectors.ts';
import {
	JOURNEY_SYNTHESIS_NOT_ESTABLISHED,
	routesOf,
	type JourneySynthesisReading,
	type SelectorBasis,
	type SynthesizedJourney,
	type SynthesizedStep,
	type UnhandledConstruct,
} from './types.ts';

const PLAYWRIGHT_CONVENTIONS: readonly string[] = Object.freeze([
	'e2e',
	'tests/e2e',
	'test/e2e',
	'tests',
	'playwright',
	'playwright/tests',
	'src/e2e',
]);

const PLAYWRIGHT_CONFIG_FILES: readonly string[] = Object.freeze([
	'playwright.config.ts',
	'playwright.config.js',
	'playwright.config.mjs',
	'playwright.config.cjs',
]);

/** Locator builders, with the selector basis each one establishes. */
const LOCATOR_BUILDERS: Readonly<Record<string, SelectorBasis>> = Object.freeze({
	getByTestId: 'test-id',
	getByRole: 'role',
	getByText: 'text',
	getByLabel: 'label',
	getByPlaceholder: 'placeholder',
	getByTitle: 'text',
	getByAltText: 'text',
});

type Collector = Readonly<{ steps: SynthesizedStep[]; unhandled: UnhandledConstruct[] }>;

function note(
	collector: Collector,
	construct: string,
	node: Node,
	source: string,
	file: string,
): void {
	const line = lineOf(source, node.start);
	if (
		collector.unhandled.some(
			(existing) => existing.construct === construct && existing.line === line,
		)
	)
		return;
	collector.unhandled.push(
		Object.freeze({ construct, detail: sourceForm(node, source), file, line }),
	);
}

/**
 * Read one `page.` or `expect(...)` chain.
 *
 * A locator builder sets the selector the rest of the chain acts on, exactly as
 * `cy.get` does, so the two readers agree about what a step is even though they
 * disagree about how a spec spells one.
 */
function readPlaywrightChain(
	chain: CallChain,
	collector: Collector,
	source: string,
	file: string,
	scope: SynthesizedStep['source']['scope'],
	pageIdentifiers: readonly string[],
): void {
	const at = (node: Node) => Object.freeze({ file, line: lineOf(source, node.start), scope });
	const first = chain.links[0];
	if (first === undefined) return;
	if (chain.rootIdentifier === null) {
		if (first.name !== 'expect') return;
		for (const link of chain.links.slice(1)) {
			if (link.name !== 'toHaveURL') continue;
			const target = staticString(link.args[0]);
			if (target === null) {
				note(collector, 'playwright-computed-url-expectation', link.node, source, file);
				continue;
			}
			collector.steps.push({ kind: 'assert-route', route: target, source: at(link.node) });
		}
		return;
	}
	if (!pageIdentifiers.includes(chain.rootIdentifier)) return;
	let selector: string | null = null;
	let basis: SelectorBasis = 'css';
	for (const link of chain.links) {
		const { name, args, node } = link;
		if (name === 'goto') {
			const target = staticString(args[0]);
			if (target === null) {
				note(collector, 'playwright-computed-route', node, source, file);
				continue;
			}
			collector.steps.push({ kind: 'visit', route: target, source: at(node) });
			continue;
		}
		if (name === 'waitForURL') {
			const target = staticString(args[0]);
			if (target === null) {
				note(collector, 'playwright-computed-route', node, source, file);
				continue;
			}
			collector.steps.push({ kind: 'wait-for-route', route: target, source: at(node) });
			continue;
		}
		if (name === 'locator') {
			const value = staticString(args[0]);
			if (value === null) {
				note(collector, 'playwright-computed-selector', node, source, file);
				selector = null;
				continue;
			}
			selector = value;
			basis = selectorBasisOfCss(value);
			continue;
		}
		const builderBasis = LOCATOR_BUILDERS[name];
		if (builderBasis !== undefined) {
			const value = staticString(args[0]);
			if (value === null) {
				note(collector, 'playwright-computed-selector', node, source, file);
				selector = null;
				continue;
			}
			selector = value;
			basis = builderBasis;
			continue;
		}
		/**
		 * A gesture spells its arguments one way on the page and another on a
		 * locator: `page.fill(selector, value)` names the element, and
		 * `getByLabel(x).fill(value)` was handed one by the front of the chain.
		 * Reading the first argument as a selector in both cases would record
		 * the typed text as the element, so the chain's own state decides.
		 */
		const located = selector !== null;
		if (name === 'click' || name === 'dblclick' || name === 'check' || name === 'tap') {
			const inlineSelector = located ? null : staticString(args[0]);
			const target = inlineSelector ?? selector;
			if (target === null) {
				note(collector, 'playwright-gesture-without-a-named-element', node, source, file);
				continue;
			}
			collector.steps.push({
				kind: 'click',
				selector: target,
				selectorBasis: inlineSelector === null ? basis : selectorBasisOfCss(inlineSelector),
				source: at(node),
			});
			continue;
		}
		if (name === 'fill' || name === 'type') {
			const inlineSelector = located ? null : staticString(args[0]);
			const typed = staticString(args[located ? 0 : 1]);
			const target = inlineSelector ?? selector;
			if (target === null || typed === null) {
				note(collector, 'playwright-typed-value-not-static', node, source, file);
				continue;
			}
			collector.steps.push({
				kind: 'type',
				selector: target,
				selectorBasis: inlineSelector === null ? basis : selectorBasisOfCss(inlineSelector),
				value: typed,
				source: at(node),
			});
			continue;
		}
		if (name === 'press') {
			const inlineSelector = located ? null : staticString(args[0]);
			const key = staticString(args[located ? 0 : 1]);
			const target = inlineSelector ?? selector;
			if (target === null || key === null) {
				note(collector, 'playwright-computed-key-press', node, source, file);
				continue;
			}
			collector.steps.push({
				kind: 'press',
				selector: target,
				selectorBasis: inlineSelector === null ? basis : selectorBasisOfCss(inlineSelector),
				value: key,
				source: at(node),
			});
			continue;
		}
		if (name === 'route' || name === 'unroute' || name === 'routeFromHAR') {
			note(collector, 'playwright-network-intercept', node, source, file);
			continue;
		}
		if (name === 'waitForResponse' || name === 'waitForRequest') {
			note(collector, 'playwright-wait-on-network', node, source, file);
			continue;
		}
		if (name === 'waitForTimeout') {
			note(collector, 'playwright-wait-on-timer', node, source, file);
			continue;
		}
		if (name === 'evaluate' || name === 'evaluateHandle' || name === 'addInitScript') {
			note(collector, 'playwright-injected-script', node, source, file);
			continue;
		}
		if (name === 'setInputFiles') {
			note(collector, 'playwright-fixture-seeded-state', node, source, file);
			continue;
		}
		note(collector, `playwright-page-api:${name}`, node, source, file);
	}
}

/** The destructured fixtures a `test` callback asks for, e.g. `{ page, request }`. */
function fixtureNames(fn: Node | undefined): readonly string[] {
	if (fn === undefined) return [];
	const params = ((fn.params ?? []) as Node[]).filter((value) => value !== undefined);
	const names: string[] = [];
	for (const param of params) {
		if (param.type !== 'ObjectPattern') continue;
		for (const property of ((param.properties ?? []) as Node[]).filter(
			(value) => value !== undefined,
		)) {
			const key = property.key as Node | undefined;
			if (key !== undefined && key.type === 'Identifier') names.push(key.name as string);
		}
	}
	return Object.freeze(names);
}

function collectFrom(
	fn: Node | undefined,
	source: string,
	file: string,
	scope: SynthesizedStep['source']['scope'],
): Collector {
	const collector: Collector = { steps: [], unhandled: [] };
	if (fn === undefined) return collector;
	const fixtures = fixtureNames(fn);
	/**
	 * `page` is the only fixture whose gestures this reader replays. A spec that
	 * drives a second context or a raw `request` fixture is read for its page
	 * gestures and its other fixtures are recorded by name below.
	 */
	const pageIdentifiers: readonly string[] = Object.freeze(['page']);
	for (const fixture of fixtures)
		if (fixture !== 'page')
			collector.unhandled.push(
				Object.freeze({
					construct: `playwright-fixture:${fixture}`,
					detail: `the test declares the ${fixture} fixture, which this reader does not supply`,
					file,
					line: lineOf(source, fn.start),
				}),
			);
	for (const chain of callChainsBelow(fn))
		readPlaywrightChain(chain, collector, source, file, scope, pageIdentifiers);
	collector.steps.sort((left, right) => left.source.line - right.source.line);
	return collector;
}

function keywordOf(name: string | null): string | null {
	if (name === null) return null;
	if (name === 'test' || name === 'it') return 'test';
	if (name.startsWith('test.describe') || name === 'describe') return 'describe';
	if (name === 'test.beforeEach') return 'beforeEach';
	if (name === 'test.beforeAll' || name === 'beforeEach') return 'beforeEach';
	if (name.startsWith('test.') || name.startsWith('it.')) {
		const modifier = name.split('.')[1] ?? '';
		if (modifier === 'only' || modifier === 'skip' || modifier === 'fixme') return 'test';
		return null;
	}
	return null;
}

/** Read one Playwright spec's source into journeys. */
export function readPlaywrightSpecSource(
	source: string,
	file: string,
): readonly SynthesizedJourney[] {
	let root: Node;
	try {
		root = parseSpec(source, file);
	} catch (error) {
		return Object.freeze([
			Object.freeze({
				name: `${file} (not parsed)`,
				source: 'playwright' as const,
				specFile: file,
				steps: Object.freeze([]),
				routes: Object.freeze([]),
				unhandled: Object.freeze([
					Object.freeze({
						construct: 'playwright-spec-not-parsed',
						detail: error instanceof Error ? error.message : String(error),
						file,
						line: 1,
					}),
				]),
			}),
		]);
	}
	const journeys: SynthesizedJourney[] = [];
	const visitBlock = (
		statements: readonly Node[],
		titles: readonly string[],
		inherited: Collector,
	): void => {
		const hooks: Collector = {
			steps: [...inherited.steps],
			unhandled: [...inherited.unhandled],
		};
		for (const statement of statements) {
			const call = statementCall(statement);
			if (call === null) continue;
			const args = ((call.arguments ?? []) as Node[]).filter((value) => value !== undefined);
			if (keywordOf(calleeName(call)) !== 'beforeEach') continue;
			const collected = collectFrom(callbackOf(args), source, file, 'beforeEach');
			hooks.steps.push(...collected.steps);
			hooks.unhandled.push(...collected.unhandled);
		}
		for (const statement of statements) {
			const call = statementCall(statement);
			if (call === null) continue;
			const keyword = keywordOf(calleeName(call));
			if (keyword === null) continue;
			const args = ((call.arguments ?? []) as Node[]).filter((value) => value !== undefined);
			const title = staticString(args[0]);
			if (keyword === 'describe') {
				visitBlock(
					bodyStatements(callbackOf(args)),
					title === null ? titles : [...titles, title],
					hooks,
				);
				continue;
			}
			if (keyword !== 'test') continue;
			const body = collectFrom(callbackOf(args), source, file, 'body');
			const steps = Object.freeze([...hooks.steps, ...body.steps]);
			const unhandled: UnhandledConstruct[] = [];
			for (const item of [...hooks.unhandled, ...body.unhandled])
				if (
					!unhandled.some(
						(existing) =>
							existing.construct === item.construct && existing.line === item.line,
					)
				)
					unhandled.push(item);
			journeys.push(
				Object.freeze({
					name: [...titles, title ?? 'unnamed test'].join(' > '),
					source: 'playwright' as const,
					specFile: file,
					steps,
					routes: routesOf(steps),
					unhandled: Object.freeze(
						unhandled.sort((left, right) => left.line - right.line),
					),
				}),
			);
		}
	};
	visitBlock(moduleStatements(root), [], { steps: [], unhandled: [] });
	return Object.freeze(journeys);
}

/** Locate the suite root, preferring what `playwright.config.*` declares. */
export async function locatePlaywrightRoots(root: string): Promise<readonly LocatedRoot[]> {
	const located: LocatedRoot[] = [];
	for (const configFile of PLAYWRIGHT_CONFIG_FILES) {
		const text = await fileText(path.join(root, configFile));
		if (text === null) continue;
		const declared = staticConfigString(text, 'testDir');
		if (declared === null) continue;
		const directory = path.resolve(root, declared);
		if (!(await directoryExists(directory))) continue;
		located.push({ directory, basis: `${configFile} declares testDir: ${declared}` });
	}
	for (const convention of PLAYWRIGHT_CONVENTIONS) {
		const directory = path.join(root, convention);
		if (!(await directoryExists(directory))) continue;
		located.push({ directory, basis: `the ${convention} convention` });
	}
	return dedupeRoots(located);
}

/** Read an application's Playwright suite, wherever this reader can find it. */
export async function readPlaywrightJourneys(root: string): Promise<JourneySynthesisReading> {
	const resolved = path.resolve(root);
	const roots = await locatePlaywrightRoots(resolved);
	const specFiles: string[] = [];
	for (const located of roots)
		for (const file of await filesBelow(located.directory, isSpecFileName))
			if (!specFiles.includes(file)) specFiles.push(file);
	const journeys: SynthesizedJourney[] = [];
	for (const file of specFiles) {
		const text = await fileText(file);
		if (text === null) continue;
		if (!text.includes('@playwright/test')) continue;
		journeys.push(...readPlaywrightSpecSource(text, path.relative(resolved, file)));
	}
	return Object.freeze({
		source: 'playwright',
		root: resolved,
		e2eRoots: Object.freeze(roots.map((located) => path.relative(resolved, located.directory))),
		rootBasis: Object.freeze(roots.map((located) => located.basis)),
		specFiles: Object.freeze(specFiles.map((file) => path.relative(resolved, file))),
		journeys: Object.freeze(journeys),
		notEstablished: Object.freeze([
			...JOURNEY_SYNTHESIS_NOT_ESTABLISHED,
			'Only a spec that imports @playwright/test is read here. A spec in the same directory that belongs to another runner is listed as a located file and not parsed as a Playwright journey.',
		]),
	});
}
