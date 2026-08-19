/**
 * Reading an application's own Cypress suite into witness journeys.
 *
 * A Cypress spec is the closest thing an unseen application has to a
 * hand-authored journey: somebody who had read the application wrote down the
 * routes worth visiting and the elements worth touching. What it is not is
 * replayable as written. A real suite seeds a database through `cy.task`,
 * installs network intercepts, and drives the application through custom
 * commands defined in its own support file — none of which the witness runner
 * has, and none of which this reader pretends to.
 *
 * So the reader keeps what replays against a served lane with nothing behind it
 * — a visit, a click on a named element, typed text, a settled route — and
 * records everything else as a named unhandled construct on the journey that
 * contained it. A journey that turns out to be nothing but unhandled constructs
 * is still returned, carrying its own emptiness, because "this suite exists and
 * none of it replays" is a reading and silence is not.
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
	type ChainLink,
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

/** The directories Cypress publishes as its suite root, newest convention first. */
const CYPRESS_CONVENTIONS: readonly string[] = Object.freeze([
	'cypress/e2e',
	'cypress/integration',
	'cypress/tests',
	'cypress/specs',
	'e2e',
	'tests/e2e',
	'test/e2e',
]);

const CYPRESS_CONFIG_FILES: readonly string[] = Object.freeze([
	'cypress.config.ts',
	'cypress.config.js',
	'cypress.config.mjs',
	'cypress.config.cjs',
	'cypress.json',
]);

const DESCRIBE_KEYWORDS: readonly string[] = Object.freeze(['describe', 'context', 'suite']);
const TEST_KEYWORDS: readonly string[] = Object.freeze(['it', 'test', 'specify']);
const BEFORE_EACH_KEYWORDS: readonly string[] = Object.freeze(['beforeEach']);
const BEFORE_KEYWORDS: readonly string[] = Object.freeze(['before', 'beforeAll']);

/** Strip an `.only`/`.skip`/`.each` modifier so the keyword can be compared. */
function keywordOf(name: string | null): string | null {
	if (name === null) return null;
	const [head] = name.split('.');
	return head ?? null;
}

/**
 * The Cypress commands that are part of the runner rather than the application.
 *
 * The list exists to separate two unhandled constructs that read the same in a
 * spec and mean very different things: a built-in this reader chose not to
 * replay, and a command the application's own support file defines. The second
 * is where an application's real journey vocabulary lives, so it is named
 * separately and can be counted.
 */
const CYPRESS_BUILTIN_COMMANDS: readonly string[] = Object.freeze([
	'and',
	'as',
	'blur',
	'check',
	'children',
	'clear',
	'clearAllCookies',
	'clearAllLocalStorage',
	'clearAllSessionStorage',
	'clearCookie',
	'clearCookies',
	'clearLocalStorage',
	'click',
	'clock',
	'closest',
	'contains',
	'dblclick',
	'debug',
	'document',
	'each',
	'end',
	'eq',
	'exec',
	'filter',
	'find',
	'first',
	'fixture',
	'focus',
	'focused',
	'get',
	'getAllCookies',
	'getAllLocalStorage',
	'getAllSessionStorage',
	'getCookie',
	'getCookies',
	'go',
	'hash',
	'hover',
	'intercept',
	'invoke',
	'its',
	'last',
	'location',
	'log',
	'next',
	'origin',
	'parent',
	'parents',
	'pause',
	'press',
	'prev',
	'readFile',
	'reload',
	'request',
	'rightclick',
	'root',
	'route',
	'screenshot',
	'scrollIntoView',
	'scrollTo',
	'select',
	'server',
	'session',
	'setCookie',
	'shadow',
	'should',
	'siblings',
	'spread',
	'spy',
	'stub',
	'submit',
	'task',
	'then',
	'tick',
	'title',
	'trigger',
	'type',
	'uncheck',
	'url',
	'viewport',
	'visit',
	'wait',
	'window',
	'within',
	'wrap',
	'writeFile',
]);

/** Testing-library queries, with the selector basis each one establishes. */
const QUERY_COMMANDS: Readonly<Record<string, SelectorBasis>> = Object.freeze({
	findByTestId: 'test-id',
	getByTestId: 'test-id',
	findAllByTestId: 'test-id',
	getAllByTestId: 'test-id',
	findByRole: 'role',
	getByRole: 'role',
	findByText: 'text',
	getByText: 'text',
	findByLabelText: 'label',
	getByLabelText: 'label',
	findByPlaceholderText: 'placeholder',
	getByPlaceholderText: 'placeholder',
});

type Collector = Readonly<{
	steps: SynthesizedStep[];
	unhandled: UnhandledConstruct[];
}>;

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
 * The route a `cy.location('pathname').should('equal', '/x')` chain settles on,
 * which is the only Cypress wait form synthesis admits: it waits on the
 * application's own router rather than on an intercept this reader did not
 * install or on a clock.
 */
function settledRoute(links: readonly ChainLink[]): string | null {
	for (let index = 0; index < links.length - 1; index += 1) {
		const link = links[index] as ChainLink;
		const next = links[index + 1] as ChainLink;
		if (next.name !== 'should') continue;
		const matcher = staticString(next.args[0]);
		const expected = staticString(next.args[1]);
		if (expected === null) continue;
		if (matcher !== 'equal' && matcher !== 'eq' && matcher !== 'include') continue;
		if (link.name === 'location') {
			const key = staticString(link.args[0]);
			if (key === 'pathname' || key === 'href') return expected;
			continue;
		}
		if (link.name === 'url') return expected;
	}
	return null;
}

/**
 * Read one `cy.` chain.
 *
 * The chain is walked left to right with a selector carried along, so the
 * gestures at the end of the chain attach to the element the front of it named.
 */
function readCypressChain(
	chain: CallChain,
	collector: Collector,
	source: string,
	file: string,
	scope: SynthesizedStep['source']['scope'],
): void {
	if (chain.rootIdentifier !== 'cy') return;
	const at = (node: Node) => Object.freeze({ file, line: lineOf(source, node.start), scope });
	const route = settledRoute(chain.links);
	if (route !== null)
		collector.steps.push({ kind: 'assert-route', route, source: at(chain.node) });
	let selector: string | null = null;
	let basis: SelectorBasis = 'css';
	for (const link of chain.links) {
		const { name, args, node } = link;
		if (name === 'visit') {
			const target = staticString(args[0]);
			if (target === null) {
				note(collector, 'cypress-computed-route', node, source, file);
				continue;
			}
			collector.steps.push({ kind: 'visit', route: target, source: at(node) });
			continue;
		}
		if (name === 'get') {
			const value = staticString(args[0]);
			if (value === null) {
				note(collector, 'cypress-computed-selector', node, source, file);
				selector = null;
				continue;
			}
			selector = value;
			basis = selectorBasisOfCss(value);
			continue;
		}
		if (name === 'contains') {
			const value = staticString(args[args.length - 1]);
			if (value === null) {
				note(collector, 'cypress-computed-selector', node, source, file);
				selector = null;
				continue;
			}
			selector = value;
			basis = 'text';
			continue;
		}
		const queryBasis = QUERY_COMMANDS[name];
		if (queryBasis !== undefined) {
			const value = staticString(args[0]);
			if (value === null) {
				note(collector, 'cypress-computed-selector', node, source, file);
				selector = null;
				continue;
			}
			selector = value;
			basis = queryBasis;
			continue;
		}
		if (name === 'click' || name === 'dblclick') {
			if (selector === null) {
				note(collector, 'cypress-gesture-without-a-named-element', node, source, file);
				continue;
			}
			collector.steps.push({
				kind: 'click',
				selector,
				selectorBasis: basis,
				source: at(node),
			});
			continue;
		}
		if (name === 'type') {
			const value = staticString(args[0]);
			if (selector === null || value === null) {
				note(collector, 'cypress-typed-value-not-static', node, source, file);
				continue;
			}
			collector.steps.push({
				kind: 'type',
				selector,
				selectorBasis: basis,
				value,
				source: at(node),
			});
			continue;
		}
		if (name === 'should') {
			if (route !== null) continue;
			if (selector === null) {
				note(collector, 'cypress-assertion-without-a-named-element', node, source, file);
				continue;
			}
			collector.steps.push({
				kind: 'assert-selector',
				selector,
				selectorBasis: basis,
				source: at(node),
			});
			continue;
		}
		if (name === 'intercept' || name === 'route' || name === 'server') {
			note(collector, 'cypress-network-intercept', node, source, file);
			continue;
		}
		if (name === 'request') {
			note(collector, 'cypress-network-request', node, source, file);
			continue;
		}
		if (name === 'task') {
			const task = staticString(args[0]);
			note(
				collector,
				task === null ? 'cypress-task' : `cypress-task:${task}`,
				node,
				source,
				file,
			);
			continue;
		}
		if (name === 'fixture') {
			note(collector, 'cypress-fixture-seeded-state', node, source, file);
			continue;
		}
		if (name === 'wait') {
			const alias = staticString(args[0]);
			note(
				collector,
				alias === null
					? 'cypress-wait-on-timer'
					: alias.startsWith('@')
						? 'cypress-wait-on-network-alias'
						: 'cypress-wait-on-alias',
				node,
				source,
				file,
			);
			continue;
		}
		if (name === 'location' || name === 'url') {
			if (route === null) note(collector, `cypress-command:${name}`, node, source, file);
			continue;
		}
		if (name === 'then' || name === 'each' || name === 'within') {
			// The callback is walked separately by `callChainsBelow`, so the
			// gestures inside it are read; only the sequencing is unexpressed.
			note(collector, `cypress-command:${name}`, node, source, file);
			continue;
		}
		note(
			collector,
			CYPRESS_BUILTIN_COMMANDS.includes(name)
				? `cypress-command:${name}`
				: `cypress-custom-command:${name}`,
			node,
			source,
			file,
		);
	}
}

function collectFrom(
	fn: Node | undefined,
	source: string,
	file: string,
	scope: SynthesizedStep['source']['scope'],
): Collector {
	const collector: Collector = { steps: [], unhandled: [] };
	if (fn === undefined) return collector;
	for (const chain of callChainsBelow(fn))
		readCypressChain(chain, collector, source, file, scope);
	collector.steps.sort((left, right) => left.source.line - right.source.line);
	return collector;
}

/**
 * Read one spec's source into journeys.
 *
 * Exported so a caller can read a spec it has in hand — the operator command
 * reads from disk, the tests read from a fixture written to a temporary
 * directory — without either of them re-implementing the walk.
 */
export function readCypressSpecSource(source: string, file: string): readonly SynthesizedJourney[] {
	let root: Node;
	try {
		root = parseSpec(source, file);
	} catch (error) {
		return Object.freeze([
			Object.freeze({
				name: `${file} (not parsed)`,
				source: 'cypress' as const,
				specFile: file,
				steps: Object.freeze([]),
				routes: Object.freeze([]),
				unhandled: Object.freeze([
					Object.freeze({
						construct: 'cypress-spec-not-parsed',
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
			const keyword = keywordOf(calleeName(call));
			if (keyword === null) continue;
			const args = ((call.arguments ?? []) as Node[]).filter(
				(value): value is Node => value !== undefined,
			);
			if (BEFORE_EACH_KEYWORDS.includes(keyword) || BEFORE_KEYWORDS.includes(keyword)) {
				const scope = BEFORE_EACH_KEYWORDS.includes(keyword) ? 'beforeEach' : 'before';
				const collected = collectFrom(callbackOf(args), source, file, scope);
				hooks.steps.push(...collected.steps);
				hooks.unhandled.push(...collected.unhandled);
			}
		}
		for (const statement of statements) {
			const call = statementCall(statement);
			if (call === null) continue;
			const keyword = keywordOf(calleeName(call));
			if (keyword === null) continue;
			const args = ((call.arguments ?? []) as Node[]).filter(
				(value): value is Node => value !== undefined,
			);
			const title = staticString(args[0]);
			if (DESCRIBE_KEYWORDS.includes(keyword)) {
				visitBlock(
					bodyStatements(callbackOf(args)),
					title === null ? titles : [...titles, title],
					hooks,
				);
				continue;
			}
			if (!TEST_KEYWORDS.includes(keyword)) continue;
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
					source: 'cypress' as const,
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

/** Locate the suite root, preferring what the configuration declares. */
export async function locateCypressRoots(root: string): Promise<readonly LocatedRoot[]> {
	const located: LocatedRoot[] = [];
	for (const configFile of CYPRESS_CONFIG_FILES) {
		const text = await fileText(path.join(root, configFile));
		if (text === null) continue;
		for (const key of ['specPattern', 'integrationFolder', 'e2eFolder', 'testDir']) {
			const declared = staticConfigString(text, key);
			if (declared === null) continue;
			const directory = path.join(root, declared.split('*')[0] ?? declared);
			if (!(await directoryExists(directory))) continue;
			located.push({ directory, basis: `${configFile} declares ${key}: ${declared}` });
		}
	}
	for (const convention of CYPRESS_CONVENTIONS) {
		const directory = path.join(root, convention);
		if (!(await directoryExists(directory))) continue;
		located.push({ directory, basis: `the ${convention} convention` });
	}
	return dedupeRoots(located);
}

/** Read an application's Cypress suite, wherever this reader can find it. */
export async function readCypressJourneys(root: string): Promise<JourneySynthesisReading> {
	const resolved = path.resolve(root);
	const roots = await locateCypressRoots(resolved);
	const specFiles: string[] = [];
	for (const located of roots)
		for (const file of await filesBelow(located.directory, isSpecFileName))
			if (!specFiles.includes(file)) specFiles.push(file);
	const journeys: SynthesizedJourney[] = [];
	for (const file of specFiles) {
		const text = await fileText(file);
		if (text === null) continue;
		journeys.push(...readCypressSpecSource(text, path.relative(resolved, file)));
	}
	return Object.freeze({
		source: 'cypress',
		root: resolved,
		e2eRoots: Object.freeze(roots.map((located) => path.relative(resolved, located.directory))),
		rootBasis: Object.freeze(roots.map((located) => located.basis)),
		specFiles: Object.freeze(specFiles.map((file) => path.relative(resolved, file))),
		journeys: Object.freeze(journeys),
		notEstablished: JOURNEY_SYNTHESIS_NOT_ESTABLISHED,
	});
}
