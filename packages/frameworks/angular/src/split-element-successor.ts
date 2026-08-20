/**
 * One element a library replaced with several, resolved per call site from the
 * facts the template itself carries.
 *
 * `NG8001: 'mat-chip-list' is not a known element` is the shape a *split* leaves
 * behind, and it is not a rename. Material 16 publishes `mat-chip-grid`,
 * `mat-chip-listbox` and `mat-chip-set` where Material 8 published one
 * `mat-chip-list`, and no reading of the installed package can say which of the
 * three a given call site became: the package declares three components, and the
 * question of which one this list is is a question about the application's
 * template.
 *
 * That is a reading of the application — but a machine-provable one, because the
 * discriminating facts are written in the template and the mapping between them
 * and the three successors is checked against the installed declarations rather
 * than asserted:
 *
 *   - **input-bearing.** The list hosts the library's text-input directive, and
 *     that directive's host binding names *this* list. The successor is not
 *     chosen: it is read off the directive's own declaration, whose host input
 *     is typed to exactly one component. `set chipGrid(value: MatChipGrid)` is
 *     the whole proof, and it is the installed package's, not this file's.
 *   - **selection.** The list carries a binding the selection successor declares
 *     and neither of the others does. A name only one candidate answers is a
 *     name that picks it.
 *   - **general.** Neither. The successor is the one the other two extend — the
 *     unspecialised container, established by following the declared extends
 *     chains, not by preferring a name.
 *
 * A site whose facts match two shapes at once, or whose text input names some
 * other list, matches none of the documented shapes and is refused by name. So
 * is a site carrying a binding the chosen successor does not declare: the
 * replaced component's own surface is gone from the tree, so a binding nothing
 * accounts for might be a foreign directive or might be an input this rewrite
 * would silently drop, and the two are indistinguishable from here.
 *
 * The children are a different question and get a stronger answer. A container's
 * content query is typed — `_chips: QueryList<MatChipRow>` — so the child the
 * successor accepts is declared, not documented; and because that child
 * *extends* the child the application wrote, its input and output surface is a
 * superset by the declaration's own arithmetic. Renaming the child therefore
 * needs no per-binding check, and a child whose component is unrelated to the
 * declared one is refused rather than renamed.
 */

import { parseTemplate, TmplAstElement, type TmplAstNode } from '@angular/compiler';
import {
	charNotIn,
	createRegExp,
	digit,
	exactly,
	maybe,
	oneOrMore,
	whitespace,
} from 'magic-regexp';
import { compareStrings } from './angular-target-cell.ts';
import { applySourceEdits, lineOf, type SourceEdit } from './semantic-module.ts';

const CAPABILITY = 'Split element successor';

/**
 * One component the installed entry point declares, as the template compiler
 * would see it.
 *
 * `extendsChain` is the declared base classes nearest-first, which is what makes
 * a child rename provable without measuring bindings. `contentChildComponent` is
 * the component a container's content query is typed to, and is null for
 * anything that is not a container.
 */
export type ComponentSurfaceReading = Readonly<{
	component: string;
	/** The element-form selectors it matches, e.g. `mat-chip-row`. */
	elements: readonly string[];
	extendsChain: readonly string[];
	inputs: readonly string[];
	outputs: readonly string[];
	contentChildComponent: string | null;
}>;

/**
 * The directive whose presence marks the input-bearing shape, and the component
 * its host binding is declared to accept. The latter is the reading that makes
 * the input-bearing successor a measurement rather than a claim.
 */
export type TextInputDirectiveReading = Readonly<{
	directive: string;
	/** The element part of its selector, e.g. `input` of `input[matChipInputFor]`. */
	element: string;
	/** The template-facing name of the input that names the container. */
	hostBinding: string;
	/** The component class that input's declaration types it to. */
	hostComponent: string;
}>;

export type ElementSplitReading = Readonly<{
	package: string;
	version: string;
	/** The element the application writes, e.g. `mat-chip-list`. */
	replaced: string;
	/** Whether the installed tree still declares `replaced` as an element selector. */
	replacedStillDeclared: boolean;
	components: readonly ComponentSurfaceReading[];
	textInput: TextInputDirectiveReading | null;
	/** The reading's statement about itself; an incomplete one proves nothing absent. */
	complete: boolean;
}>;

/**
 * One split a library documented, as a claim to be checked. Nothing is written
 * on the strength of this record alone: every one of its three names is verified
 * against the installed declarations before a single tag is touched.
 */
export type DocumentedElementSplit = Readonly<{
	package: string;
	replaced: string;
	since: string;
	/** The successor for a list hosting the library's text-input directive. */
	inputBearing: string;
	/** The successor for a list carrying selection bindings. */
	selection: string;
	/** The successor for a list carrying neither — the one the other two extend. */
	general: string;
}>;

/** The splits this adapter has been told about. */
export const DOCUMENTED_ELEMENT_SPLITS: readonly DocumentedElementSplit[] = Object.freeze([
	Object.freeze({
		package: '@angular/material',
		replaced: 'mat-chip-list',
		since: '@angular/material 15 (MDC chips)',
		inputBearing: 'MatChipGrid',
		selection: 'MatChipListbox',
		general: 'MatChipSet',
	}),
]);

export type SplitElementShape = 'input-bearing' | 'selection' | 'general';

export type SplitElementChange = Readonly<{
	kind: 'split-element-successor';
	line: number;
	from: string;
	to: string;
	shape: SplitElementShape;
	component: string;
	/** The child renames the container's content query required, if any. */
	children: readonly string[];
}>;

export type SplitElementMigration = Readonly<{
	path: string;
	source: string;
	changed: boolean;
	changes: readonly SplitElementChange[];
	unhandled: readonly string[];
}>;

/**
 * Attributes every element carries whatever component matches it. A binding
 * outside this set and outside the successor's own surface is a binding this
 * capability cannot account for, and it refuses rather than drop it.
 */
const UNIVERSAL_ATTRIBUTES: readonly string[] = Object.freeze([
	'class',
	'style',
	'id',
	'title',
	'hidden',
	'tabindex',
]);

const UNIVERSAL_PREFIXES: readonly string[] = Object.freeze([
	'data-',
	'aria-',
	'attr.',
	'class.',
	'style.',
]);

function isUniversal(name: string): boolean {
	if (UNIVERSAL_ATTRIBUTES.includes(name)) return true;
	return UNIVERSAL_PREFIXES.some((prefix) => name.startsWith(prefix));
}

/** Every element node of a parsed template, in source order, outermost first. */
function elementsOf(nodes: readonly TmplAstNode[], found: TmplAstElement[]): void {
	for (const node of nodes) {
		if (node instanceof TmplAstElement) found.push(node);
		const children: unknown = (node as { children?: unknown }).children;
		if (Array.isArray(children)) elementsOf(children as readonly TmplAstNode[], found);
	}
}

/** The elements beneath `root`, not including it. */
function descendantsOf(root: TmplAstElement): readonly TmplAstElement[] {
	const found: TmplAstElement[] = [];
	elementsOf(root.children, found);
	return Object.freeze(found);
}

/** Every template-facing binding name written on an element. */
function bindingNamesOf(element: TmplAstElement): readonly string[] {
	return Object.freeze([
		...element.attributes.map((attribute) => attribute.name),
		...element.inputs.map((input) => input.name),
		...element.outputs.map((output) => output.name),
	]);
}

function componentNamed(
	reading: ElementSplitReading,
	name: string,
): ComponentSurfaceReading | null {
	return reading.components.find((entry) => entry.component === name) ?? null;
}

/** A component's own inputs and outputs, plus every one it inherits. */
function surfaceOf(reading: ElementSplitReading, name: string): readonly string[] {
	const component = componentNamed(reading, name);
	if (component === null) return Object.freeze([]);
	const names = new Set<string>([...component.inputs, ...component.outputs]);
	for (const base of component.extendsChain) {
		const declared = componentNamed(reading, base);
		if (declared === null) continue;
		for (const entry of [...declared.inputs, ...declared.outputs]) names.add(entry);
	}
	return Object.freeze([...names].sort(compareStrings));
}

/** The component whose element selectors include `element`, when exactly one does. */
function componentOfElement(
	reading: ElementSplitReading,
	element: string,
): ComponentSurfaceReading | null {
	const matches = reading.components.filter((entry) => entry.elements.includes(element));
	return matches.length === 1 ? (matches[0] as ComponentSurfaceReading) : null;
}

/**
 * Whether the documented split describes the installed tree, and why not when it
 * does not.
 *
 * Five checks, each against a declaration rather than against the claim: the
 * replaced element really is gone; each named successor is declared and carries
 * exactly one element selector; the input-bearing one is the one the text-input
 * directive's host binding is typed to; the general one is a base of both others;
 * and the two specialisations are not bases of each other.
 */
export function checkElementSplit(
	split: DocumentedElementSplit,
	reading: ElementSplitReading,
): readonly string[] {
	const refusals: string[] = [];
	const at = `'${split.package}'@${reading.version}`;
	if (!reading.complete) {
		refusals.push(
			`the reading of ${at} could not be completed, so it establishes neither which successors ` +
				'are declared nor that the replaced element is gone',
		);
		return Object.freeze(refusals);
	}
	if (reading.replacedStillDeclared)
		refusals.push(
			`${at} still declares <${split.replaced}>, so the diagnostic does not describe this closure ` +
				'and a rewrite would be a rewrite of working markup',
		);
	for (const name of [split.inputBearing, split.selection, split.general]) {
		const component = componentNamed(reading, name);
		if (component === null) {
			refusals.push(`${at} declares no component named ${name}`);
			continue;
		}
		if (component.elements.length !== 1)
			refusals.push(
				`${name} in ${at} matches ${String(component.elements.length)} element selectors ` +
					`(${component.elements.join(', ')}), so which one succeeds <${split.replaced}> is not ` +
					'established',
			);
	}
	const textInput = reading.textInput;
	if (textInput === null)
		refusals.push(
			`${at} declares no text-input directive, so the input-bearing shape cannot be told from ` +
				'the others',
		);
	else if (textInput.hostComponent !== split.inputBearing)
		refusals.push(
			`${textInput.directive} in ${at} types its ${textInput.hostBinding} binding to ` +
				`${textInput.hostComponent}, and the split claims the input-bearing successor is ` +
				`${split.inputBearing}`,
		);
	const inputBearing = componentNamed(reading, split.inputBearing);
	const selection = componentNamed(reading, split.selection);
	if (inputBearing !== null && !inputBearing.extendsChain.includes(split.general))
		refusals.push(
			`${split.inputBearing} in ${at} does not extend ${split.general}, so ${split.general} is ` +
				'not the unspecialised container the split claims it is',
		);
	if (selection !== null && !selection.extendsChain.includes(split.general))
		refusals.push(
			`${split.selection} in ${at} does not extend ${split.general}, so ${split.general} is not ` +
				'the unspecialised container the split claims it is',
		);
	if (inputBearing !== null && inputBearing.extendsChain.includes(split.selection))
		refusals.push(
			`${split.inputBearing} in ${at} extends ${split.selection}, so the two shapes the split ` +
				'distinguishes are not distinct successors',
		);
	if (selection !== null && selection.extendsChain.includes(split.inputBearing))
		refusals.push(
			`${split.selection} in ${at} extends ${split.inputBearing}, so the two shapes the split ` +
				'distinguishes are not distinct successors',
		);
	return Object.freeze(refusals);
}

type Resolution =
	| Readonly<{ kind: 'resolved'; shape: SplitElementShape; component: string }>
	| Readonly<{ kind: 'refused'; reason: string }>;

/** Which of the documented shapes this call site's template facts match. */
function resolveShape(
	source: string,
	element: TmplAstElement,
	split: DocumentedElementSplit,
	reading: ElementSplitReading,
): Resolution {
	const textInput = reading.textInput;
	if (textInput === null) return { kind: 'refused', reason: 'no text-input directive was read' };
	const references = element.references.map((reference) => reference.name);
	let hostsTextInput = false;
	let foreign: string | null = null;
	for (const descendant of descendantsOf(element)) {
		if (descendant.name !== textInput.element) continue;
		const binding = descendant.inputs.find((input) => input.name === textInput.hostBinding);
		if (binding === undefined) continue;
		const span = binding.valueSpan;
		const named =
			span === undefined ? '' : source.slice(span.start.offset, span.end.offset).trim();
		if (references.includes(named)) hostsTextInput = true;
		else foreign = named === '' ? '(an expression)' : named;
	}
	if (foreign !== null)
		return {
			kind: 'refused',
			reason:
				`it contains a <${textInput.element}> whose ${textInput.hostBinding} names ${foreign}, ` +
				'which is not a reference this element declares, so which container that input belongs ' +
				'to is not established here',
		};
	const written = bindingNamesOf(element);
	const selectionOnly = surfaceOf(reading, split.selection).filter(
		(name) =>
			!surfaceOf(reading, split.inputBearing).includes(name) &&
			!surfaceOf(reading, split.general).includes(name),
	);
	const discriminating = written.filter((name) => selectionOnly.includes(name));
	if (hostsTextInput && discriminating.length > 0)
		return {
			kind: 'refused',
			reason:
				`it hosts a ${textInput.hostBinding} and also carries ${discriminating.join(', ')}, ` +
				`which only ${split.selection} declares — the facts match two documented shapes at once`,
		};
	if (hostsTextInput)
		return { kind: 'resolved', shape: 'input-bearing', component: split.inputBearing };
	if (discriminating.length > 0)
		return { kind: 'resolved', shape: 'selection', component: split.selection };
	return { kind: 'resolved', shape: 'general', component: split.general };
}

/** The edit that rewrites an element's tag name, open and close. */
function retagEdits(source: string, element: TmplAstElement, to: string): readonly SourceEdit[] {
	const edits: SourceEdit[] = [];
	const open = element.startSourceSpan.start.offset + 1;
	if (source.slice(open, open + element.name.length) !== element.name) return Object.freeze([]);
	edits.push({ start: open, end: open + element.name.length, text: to });
	const closing = element.endSourceSpan;
	if (closing !== null && closing.start.offset !== element.startSourceSpan.start.offset) {
		const close = closing.start.offset + 2;
		if (source.slice(close, close + element.name.length) === element.name)
			edits.push({ start: close, end: close + element.name.length, text: to });
	}
	return Object.freeze(edits);
}

/**
 * Rewrite one template's occurrences of a split element onto the successors the
 * installed declarations and the template's own facts agree on.
 */
export function resolveSplitElementSuccessors(
	path: string,
	source: string,
	split: DocumentedElementSplit,
	reading: ElementSplitReading,
): SplitElementMigration {
	const unchanged = (unhandled: readonly string[]): SplitElementMigration =>
		Object.freeze({
			path,
			source,
			changed: false,
			changes: Object.freeze([]),
			unhandled: Object.freeze([...new Set(unhandled)].sort(compareStrings)),
		});
	if (split.package !== reading.package || split.replaced !== reading.replaced)
		return unchanged([
			`${path}: the reading is of ${reading.package} <${reading.replaced}> and the split ` +
				`describes ${split.package} <${split.replaced}>`,
		]);
	const mismatches = checkElementSplit(split, reading);
	if (mismatches.length > 0)
		return unchanged(
			mismatches.map((reason) => `${path}: ${reason}, so nothing was rewritten`),
		);
	const parsed = parseTemplate(source, path, { preserveWhitespaces: true });
	if (parsed.errors !== null && parsed.errors.length > 0)
		throw new Error(
			`${CAPABILITY}: ${path} does not parse, so it cannot be rewritten and it cannot be ` +
				`honestly counted as unchanged. Diagnostics: ` +
				parsed.errors.map((error) => error.toString()).join('; '),
		);
	const all: TmplAstElement[] = [];
	elementsOf(parsed.nodes, all);
	const edits: SourceEdit[] = [];
	const changes: SplitElementChange[] = [];
	const unhandled: string[] = [];
	for (const element of all) {
		if (element.name !== split.replaced) continue;
		const line = lineOf(source, element.startSourceSpan.start.offset);
		const at = `${path} line ${String(line)}`;
		const resolution = resolveShape(source, element, split, reading);
		if (resolution.kind === 'refused') {
			unhandled.push(
				`${at}: <${split.replaced}> was left as it is because ${resolution.reason}`,
			);
			continue;
		}
		const successor = componentNamed(reading, resolution.component);
		if (successor === null) continue;
		const successorElement = successor.elements[0] as string;
		const carried = surfaceOf(reading, resolution.component);
		const unaccounted = bindingNamesOf(element).filter(
			(name) => !isUniversal(name) && !carried.includes(name),
		);
		if (unaccounted.length > 0) {
			unhandled.push(
				`${at}: <${split.replaced}> carries ${unaccounted.join(', ')}, which ` +
					`${resolution.component} does not declare, and the component this element used to ` +
					'match is not in the installed tree to say whether those are its inputs or another ' +
					"directive's",
			);
			continue;
		}
		const childName = successor.contentChildComponent;
		if (childName === null) {
			unhandled.push(
				`${at}: ${resolution.component} declares no content query, so which child element it ` +
					'accepts is not established',
			);
			continue;
		}
		const child = componentNamed(reading, childName);
		if (child === null) {
			unhandled.push(
				`${at}: ${resolution.component} queries for ${childName}, which the reading does not ` +
					'carry',
			);
			continue;
		}
		const childEdits: SourceEdit[] = [];
		const childChanges: string[] = [];
		let refusedChild: string | null = null;
		for (const descendant of descendantsOf(element)) {
			const written = componentOfElement(reading, descendant.name);
			if (written === null) continue;
			if (written.component === childName) continue;
			if (written.contentChildComponent !== null) continue;
			if (!child.extendsChain.includes(written.component)) {
				refusedChild =
					`<${descendant.name}> resolves to ${written.component}, which ${childName} does not ` +
					`extend, so renaming it onto ${childName} would not be a rename`;
				break;
			}
			const successors = child.elements.filter((entry) => entry.startsWith(descendant.name));
			if (successors.length !== 1) {
				refusedChild =
					`<${descendant.name}> has ${String(successors.length)} candidate successors among ` +
					`${childName}'s element selectors (${child.elements.join(', ')})`;
				break;
			}
			const to = successors[0] as string;
			childEdits.push(...retagEdits(source, descendant, to));
			childChanges.push(`${descendant.name} → ${to}`);
		}
		if (refusedChild !== null) {
			unhandled.push(
				`${at}: <${split.replaced}> was left as it is because ${refusedChild}. Rewriting the ` +
					'container without its children would move the failure rather than answer it.',
			);
			continue;
		}
		const containerEdits = retagEdits(source, element, successorElement);
		if (containerEdits.length === 0) {
			unhandled.push(
				`${at}: the parsed open tag of <${split.replaced}> is not where the source writes it`,
			);
			continue;
		}
		edits.push(...containerEdits, ...childEdits);
		changes.push({
			kind: 'split-element-successor',
			line,
			from: split.replaced,
			to: successorElement,
			shape: resolution.shape,
			component: resolution.component,
			children: Object.freeze([...new Set(childChanges)].sort(compareStrings)),
		});
	}
	const migrated = applySourceEdits(source, edits);
	return Object.freeze({
		path,
		source: migrated,
		changed: migrated !== source,
		changes: Object.freeze(changes),
		unhandled: Object.freeze([...new Set(unhandled)].sort(compareStrings)),
	});
}

/**
 * The `NG8001` lines of a build log, as the templates they name.
 *
 * Only the element and the file are taken. The capability re-reads the template
 * to find every occurrence, because a diagnostic is raised once per unknown
 * element name and a template may write it more than once.
 */
export function readUnknownElements(log: string): ReadonlyMap<string, readonly string[]> {
	const found = new Map<string, Set<string>>();
	for (const raw of log.split('\n')) {
		const line = raw.trim();
		const head = UNKNOWN_ELEMENT_HEAD.exec(line)?.groups;
		const message = UNKNOWN_ELEMENT.exec(line)?.groups;
		if (head === undefined || message === undefined) continue;
		const file = head['file'] as string;
		const element = message['element'] as string;
		const list = found.get(file);
		if (list === undefined) found.set(file, new Set([element]));
		else list.add(element);
	}
	return new Map(
		[...found].map(([file, list]) => [file, Object.freeze([...list].sort(compareStrings))]),
	);
}

/** The position and code the builder prints in front of an unknown-element message. */
const UNKNOWN_ELEMENT_HEAD = createRegExp(
	maybe(exactly('Error:').and(oneOrMore(whitespace)))
		.and(oneOrMore(charNotIn(' \t\n:')).as('file'))
		.and(exactly(':'))
		.and(oneOrMore(digit))
		.and(exactly(':'))
		.and(oneOrMore(digit))
		.and(exactly(' - error NG8001: ')),
);

/** The message body, which names the element the template compiler could not match. */
const UNKNOWN_ELEMENT = createRegExp(
	exactly("'")
		.and(oneOrMore(charNotIn("'")).as('element'))
		.and(exactly("' is not a known element")),
);
