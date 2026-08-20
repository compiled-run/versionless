/**
 * The order Angular applies a directive's `@Input()` setters in, restored to
 * the one the era ran — for the one shape where that order is load-bearing.
 *
 * View Engine set a directive's inputs in the order the directive *declared*
 * them: an `@Input()` field written before an `@Input() set` accessor was
 * populated before the accessor ran, whatever order the call site wrote its
 * bindings in. Ivy sets them in the order the *template* binds them. For almost
 * every directive the difference is invisible — a setter that reads no other
 * input cannot tell which ran first. For a setter that dereferences another of
 * the directive's inputs, it is the difference between a populated field and
 * `undefined`, and when the dereference feeds a DOM operation that undefined is
 * a thrown `TypeError` on every load.
 *
 * A splitter directive is a canonical instance of the shape. Its
 * `@Input() set position` runs `this.renderer.addClass(this.topElement, …)`,
 * and `topElement` is another `@Input()` of the same directive. A call site
 * binding `[position]` before `[topElement]` runs the setter, under Ivy, while
 * `this.topElement` is still `undefined`, and `Renderer2.addClass(undefined, …)`
 * reaches for `undefined.classList`. View Engine never hit it because the
 * field's declaration preceded the accessor's. Angular ships a switch for the
 * `setDisabledState` timing change; it ships none for input-application order,
 * so the era ordering can only be restored where it was authored — in the
 * template's binding order.
 *
 * This capability restores it, and only where the application's own source
 * proves the ordering matters:
 *
 * - **The dependency is read, not assumed.** A setter is a dependency of
 *   another input only when its body dereferences `this.<dep>` in a position
 *   that throws on `undefined`: passed as the element argument to a
 *   `Renderer2` element method (`addClass`, `removeClass`, `setStyle`, …) whose
 *   receiver is a member this class holds a `Renderer2` in, or read as
 *   `this.<dep>.classList`. A setter that merely stores `this.<dep>`, or reads
 *   it through an optional chain, throws on neither order and is no dependency.
 * - **The dependency is on another input of the same directive.** `<dep>` is
 *   resolved to an `@Input()` the same class declares — a field, or another
 *   accessor. A dereference of a plain field, an injected service, or a
 *   `@ViewChild` is not an input-ordering dependency and is left alone: no
 *   binding order could have populated it.
 * - **Both ends are bound at the call site.** An input a call site does not
 *   bind is never set, so no reordering could populate it; only bindings the
 *   template actually writes are moved.
 * - **The move is the minimum a topological order requires.** The call site's
 *   directive-input bindings are reordered so every dependency precedes its
 *   dependent, preserving the authored order everywhere the dependencies do not
 *   force a swap. A call site already in a safe order is left byte-for-byte as
 *   it is. Binding *values* never move; only the source order of the whole
 *   `[name]="value"` tokens does.
 * - **A cycle is refused.** Two inputs that each dereference the other cannot
 *   both precede the other; there is no order that satisfies both, so the site
 *   is reported and left unchanged rather than rewritten into one arbitrary
 *   half of an unsatisfiable constraint.
 */

import { BindingType, parseTemplate, TmplAstElement, type TmplAstNode } from '@angular/compiler';
import { compareStrings } from './angular-target-cell.ts';
import {
	applySourceEdits,
	denotesExport,
	forEachNode,
	lineOf,
	parseModule,
	readModuleImports,
	type AstNode,
	type SemanticModule,
	type SourceEdit,
} from './semantic-module.ts';

const CAPABILITY = 'Template binding reorder';

/** The package that publishes the decorators and the renderer this reads. */
const ANGULAR_CORE_MODULE = '@angular/core';
const INPUT_DECORATOR = 'Input';
const COMPONENT_DECORATOR = 'Component';
const DIRECTIVE_DECORATOR = 'Directive';
const INJECT_FUNCTION = 'inject';
/** The type a member has to be declared as for its element methods to be read. */
const RENDERER_TYPE = 'Renderer2';

/**
 * The `Renderer2` element methods whose first argument is the element and which
 * throw when it is `undefined`. Each dereferences `element.classList` (or an
 * equivalent DOM slot) synchronously, so passing an unpopulated input to one is
 * the throw this capability restores the order to avoid.
 */
const RENDERER_ELEMENT_METHODS: readonly string[] = Object.freeze([
	'addClass',
	'removeClass',
	'setStyle',
	'removeStyle',
	'setProperty',
	'setAttribute',
	'removeAttribute',
]);

/** A DOM property read directly on an input that throws when it is `undefined`. */
const DOM_ELEMENT_PROPERTY = 'classList';

/**
 * One `@Input() set` accessor that depends on other inputs of its directive.
 * `input` and `dependsOn` are template-facing names — the alias when the
 * `@Input()` carries one, the member name otherwise — because that is what a
 * call site binds and what this capability reorders.
 */
export type SetterInputDependency = Readonly<{
	input: string;
	dependsOn: readonly string[];
}>;

/**
 * One directive, read from its own class: the selector it matches elements by,
 * every template-facing input name it declares, and the setter dependencies
 * that make binding order observable. A directive with no such setter is still
 * returned — its empty `setterDependencies` is the proof that its call sites
 * need no reordering, not the absence of a reading.
 */
export type DirectiveBindingReading = Readonly<{
	component: string;
	selector: string;
	inputs: readonly string[];
	setterDependencies: readonly SetterInputDependency[];
}>;

export type BindingReorderChange = Readonly<{
	kind: 'template-binding-reorder';
	line: number;
	element: string;
	directive: string;
	/** The directive-input binding names in their authored order. */
	before: readonly string[];
	/** The same names after the topological reorder. */
	after: readonly string[];
	/** The dependency edges that forced the reorder, as `dep -> dependent`. */
	edges: readonly string[];
}>;

export type TemplateReorderMigration = Readonly<{
	path: string;
	source: string;
	changed: boolean;
	changes: readonly BindingReorderChange[];
	unhandled: readonly string[];
}>;

type ClassNode = Extract<AstNode, { type: 'ClassDeclaration' | 'ClassExpression' }>;

/** Whether a node is `this.<name>` written plainly, and the name if so. */
function thisMemberName(node: AstNode): string | null {
	if (node.type !== 'MemberExpression' || node.computed || node.optional) return null;
	if (node.object.type !== 'ThisExpression') return null;
	return node.property.type === 'Identifier' ? node.property.name : null;
}

/** The plain type-reference name a declaration is annotated with, or null. */
function annotatedTypeName(node: AstNode): AstNode | null {
	const annotation = (node as { typeAnnotation?: AstNode }).typeAnnotation;
	if (annotation === undefined || annotation === null || annotation.type !== 'TSTypeAnnotation')
		return null;
	const reference = annotation.typeAnnotation;
	if (reference.type !== 'TSTypeReference') return null;
	return reference.typeName.type === 'Identifier' ? reference.typeName : null;
}

/**
 * The `@Input()` decorator on a class member, resolved to `@angular/core`'s
 * `Input`. Returns the template-facing name the decorator establishes — its
 * string alias when it carries one, `null` when it is `@Input()` with no alias
 * (the caller falls back to the member name) — and `undefined` when the member
 * carries no such decorator.
 */
function inputAliasOf(
	module: SemanticModule,
	member: AstNode,
	core: ReturnType<typeof readModuleImports>,
): string | null | undefined {
	const decorators = (member as { decorators?: readonly AstNode[] }).decorators ?? [];
	for (const decorator of decorators) {
		if (decorator.type !== 'Decorator') continue;
		const expression = decorator.expression;
		const callee = expression.type === 'CallExpression' ? expression.callee : expression;
		if (!denotesExport(module, callee, core, INPUT_DECORATOR)) continue;
		if (expression.type === 'CallExpression') {
			const first = expression.arguments[0];
			if (first !== undefined && first.type === 'Literal' && typeof first.value === 'string')
				return first.value;
		}
		return null;
	}
	return undefined;
}

/** The identifier name of a non-computed class-member key, or null. */
function memberName(member: AstNode): string | null {
	const key = (member as { key?: AstNode; computed?: boolean }).key;
	if (key === undefined || (member as { computed?: boolean }).computed === true) return null;
	return key.type === 'Identifier' ? key.name : null;
}

/** The selector string a `@Component`/`@Directive` decorator declares, or null. */
function selectorOf(
	module: SemanticModule,
	declaration: ClassNode,
	core: ReturnType<typeof readModuleImports>,
): string | null {
	const decorators = (declaration as { decorators?: readonly AstNode[] }).decorators ?? [];
	for (const decorator of decorators) {
		if (decorator.type !== 'Decorator') continue;
		const expression = decorator.expression;
		if (expression.type !== 'CallExpression') continue;
		const isComponentLike =
			denotesExport(module, expression.callee, core, COMPONENT_DECORATOR) ||
			denotesExport(module, expression.callee, core, DIRECTIVE_DECORATOR);
		if (!isComponentLike) continue;
		const literal = expression.arguments[0];
		if (literal === undefined || literal.type !== 'ObjectExpression') continue;
		for (const property of literal.properties) {
			if (property.type !== 'Property' || property.computed) continue;
			const name =
				property.key.type === 'Identifier'
					? property.key.name
					: property.key.type === 'Literal' && typeof property.key.value === 'string'
						? property.key.value
						: null;
			if (name !== 'selector') continue;
			if (property.value.type === 'Literal' && typeof property.value.value === 'string')
				return property.value.value;
		}
	}
	return null;
}

/** The member names this class holds a `Renderer2` in, however it obtains one. */
function rendererMembersOf(
	module: SemanticModule,
	declaration: ClassNode,
	core: ReturnType<typeof readModuleImports>,
): ReadonlySet<string> {
	const members = new Set<string>();
	const isRendererType = (node: AstNode): boolean => {
		const typeName = annotatedTypeName(node);
		return typeName !== null && denotesExport(module, typeName, core, RENDERER_TYPE);
	};
	const isRendererInject = (value: AstNode | null | undefined): boolean => {
		if (value === undefined || value === null || value.type !== 'CallExpression') return false;
		if (!denotesExport(module, value.callee, core, INJECT_FUNCTION)) return false;
		const first = value.arguments[0];
		return first !== undefined && denotesExport(module, first, core, RENDERER_TYPE);
	};
	for (const member of declaration.body.body) {
		if (member.type === 'PropertyDefinition') {
			const name = memberName(member);
			if (name === null) continue;
			if (isRendererType(member) || isRendererInject(member.value)) members.add(name);
			continue;
		}
		if (member.type !== 'MethodDefinition' || member.kind !== 'constructor') continue;
		for (const parameter of member.value.params) {
			if (parameter.type !== 'TSParameterProperty') continue;
			const inner = parameter.parameter;
			const identifier = inner.type === 'AssignmentPattern' ? inner.left : inner;
			if (identifier.type !== 'Identifier') continue;
			if (isRendererType(identifier)) members.add(identifier.name);
		}
	}
	return members;
}

/**
 * The member names one setter body dereferences in a position that throws when
 * the member is `undefined`: the element argument of a `Renderer2` element
 * method whose receiver is one of `renderers`, or the object of a `.classList`
 * read. These are member (not template) names; the caller maps them to inputs.
 */
function throwingDerefsOf(body: AstNode, renderers: ReadonlySet<string>): ReadonlySet<string> {
	const derefs = new Set<string>();
	forEachNode(body, (node) => {
		if (node.type === 'CallExpression') {
			const callee = node.callee;
			if (
				callee.type === 'MemberExpression' &&
				!callee.computed &&
				callee.property.type === 'Identifier' &&
				RENDERER_ELEMENT_METHODS.includes(callee.property.name)
			) {
				const receiver = thisMemberName(callee.object);
				if (receiver !== null && renderers.has(receiver)) {
					const element = node.arguments[0];
					if (element !== undefined) {
						const derefed = thisMemberName(element);
						if (derefed !== null) derefs.add(derefed);
					}
				}
			}
		}
		if (
			node.type === 'MemberExpression' &&
			!node.computed &&
			node.property.type === 'Identifier' &&
			node.property.name === DOM_ELEMENT_PROPERTY
		) {
			const derefed = thisMemberName(node.object);
			if (derefed !== null) derefs.add(derefed);
		}
	});
	return derefs;
}

/**
 * Read every directive one module declares, and the setter-dependency edges its
 * inputs carry. A module that imports nothing from `@angular/core` declares no
 * directive this capability can resolve and returns nothing.
 */
export function readDirectiveBindingDependencies(
	path: string,
	source: string,
): readonly DirectiveBindingReading[] {
	const module = parseModule(CAPABILITY, path, source);
	const core = readModuleImports(module, ANGULAR_CORE_MODULE);
	if (!core.present) return Object.freeze([]);
	const readings: DirectiveBindingReading[] = [];
	const seen = new Set<AstNode>();
	forEachNode(module.ast, (node) => {
		if (node.type !== 'ClassDeclaration' && node.type !== 'ClassExpression') return;
		if (seen.has(node)) return;
		seen.add(node);
		const declaration = node;
		const selector = selectorOf(module, declaration, core);
		if (selector === null) return;
		const component =
			declaration.id?.type === 'Identifier' ? declaration.id.name : '(anonymous)';
		const renderers = rendererMembersOf(module, declaration, core);
		/** member name -> template-facing input name, for every `@Input()` member. */
		const inputByMember = new Map<string, string>();
		const setters: Readonly<{ member: string; input: string; body: AstNode }>[] = [];
		for (const member of declaration.body.body) {
			if (member.type !== 'PropertyDefinition' && member.type !== 'MethodDefinition')
				continue;
			const name = memberName(member);
			if (name === null) continue;
			const alias = inputAliasOf(module, member, core);
			if (alias === undefined) continue;
			const templateName = alias ?? name;
			inputByMember.set(name, templateName);
			if (member.type === 'MethodDefinition' && member.kind === 'set') {
				const body = member.value.body;
				if (body !== null && body !== undefined && body.type === 'BlockStatement')
					setters.push(Object.freeze({ member: name, input: templateName, body }));
			}
		}
		const setterDependencies: SetterInputDependency[] = [];
		for (const setter of setters) {
			const derefs = throwingDerefsOf(setter.body, renderers);
			const dependsOn = [...derefs]
				.filter((derefed) => derefed !== setter.member && inputByMember.has(derefed))
				.map((derefed) => inputByMember.get(derefed) as string);
			const unique = [...new Set(dependsOn)].sort(compareStrings);
			if (unique.length > 0)
				setterDependencies.push(
					Object.freeze({ input: setter.input, dependsOn: Object.freeze(unique) }),
				);
		}
		readings.push(
			Object.freeze({
				component,
				selector,
				inputs: Object.freeze([...new Set(inputByMember.values())].sort(compareStrings)),
				setterDependencies: Object.freeze(setterDependencies),
			}),
		);
	});
	return Object.freeze(readings);
}

/** One term of a comma-separated selector, reduced to the parts this can match. */
type SelectorTerm = Readonly<{ element: string | null; attributes: readonly string[] }>;

/**
 * Parse a selector into element/attribute terms, or null when it carries a
 * shape this capability does not match (a class, a pseudo-class, `:not`, a
 * descendant combinator). Refusing to parse is refusing to match, which is the
 * safe direction: an element wrongly matched would be reordered against a
 * dependency graph that is not its directive's.
 */
function parseSelector(selector: string): readonly SelectorTerm[] | null {
	const terms: SelectorTerm[] = [];
	for (const raw of selector.split(',')) {
		const part = raw.trim();
		if (part === '') continue;
		let element: string | null = null;
		const attributes: string[] = [];
		let rest = part;
		const elementMatch = /^[a-zA-Z][\w-]*/u.exec(rest);
		if (elementMatch !== null) {
			element = elementMatch[0];
			rest = rest.slice(elementMatch[0].length);
		}
		while (rest.length > 0) {
			const attributeMatch = /^\[([\w-]+)(?:[~^$*|]?=(?:"[^"]*"|'[^']*'|[^\]]*))?\]/u.exec(
				rest,
			);
			if (attributeMatch === null) return null;
			attributes.push(attributeMatch[1] as string);
			rest = rest.slice(attributeMatch[0].length);
		}
		if (element === null && attributes.length === 0) return null;
		terms.push(Object.freeze({ element, attributes: Object.freeze(attributes) }));
	}
	return terms.length === 0 ? null : Object.freeze(terms);
}

/** The names an element carries as attributes, inputs or outputs. */
function elementBindingNames(element: TmplAstElement): ReadonlySet<string> {
	const names = new Set<string>();
	for (const attribute of element.attributes) names.add(attribute.name);
	for (const input of element.inputs) names.add(input.name);
	for (const output of element.outputs) names.add(output.name);
	return names;
}

/** Whether an element matches one of a selector's terms. */
function elementMatchesSelector(element: TmplAstElement, terms: readonly SelectorTerm[]): boolean {
	const names = elementBindingNames(element);
	return terms.some(
		(term) =>
			(term.element === null || term.element === element.name) &&
			term.attributes.every((attribute) => names.has(attribute)),
	);
}

/** Every element node of a parsed template, in source order, outermost first. */
function elementsOf(nodes: readonly TmplAstNode[], found: TmplAstElement[]): void {
	for (const node of nodes) {
		if (node instanceof TmplAstElement) found.push(node);
		const children: unknown = (node as { children?: unknown }).children;
		if (Array.isArray(children)) elementsOf(children as readonly TmplAstNode[], found);
	}
}

type Slot = Readonly<{ name: string; start: number; end: number; text: string }>;

/**
 * A topological order of `slots` that satisfies every `dep -> dependent` edge
 * and, among the orders that do, keeps every slot as close to its authored
 * position as possible (a stable Kahn's algorithm on the authored index).
 * Returns null when the edges contain a cycle.
 */
function topologicalOrder(
	slots: readonly Slot[],
	edges: readonly Readonly<{ from: number; to: number }>[],
): readonly number[] | null {
	const indegree = slots.map(() => 0);
	const successors: number[][] = slots.map(() => []);
	for (const edge of edges) {
		successors[edge.from]?.push(edge.to);
		indegree[edge.to] = (indegree[edge.to] ?? 0) + 1;
	}
	const order: number[] = [];
	const emitted = slots.map(() => false);
	while (order.length < slots.length) {
		let next = -1;
		for (let index = 0; index < slots.length; index += 1)
			if (!emitted[index] && indegree[index] === 0) {
				next = index;
				break;
			}
		if (next === -1) return null;
		emitted[next] = true;
		order.push(next);
		for (const successor of successors[next] ?? [])
			indegree[successor] = (indegree[successor] ?? 0) - 1;
	}
	return order;
}

/**
 * Reorder one template's directive-input bindings so every setter dependency
 * precedes its dependent, wherever the directives the readings describe are
 * bound. Values are never touched; only the source order of whole
 * `[name]="value"` tokens changes, and only when the authored order is unsafe.
 */
export function reorderTemplateBindings(
	path: string,
	source: string,
	readings: readonly DirectiveBindingReading[],
): TemplateReorderMigration {
	const relevant = readings.filter((reading) => reading.setterDependencies.length > 0);
	const unchanged = (unhandled: readonly string[]): TemplateReorderMigration =>
		Object.freeze({
			path,
			source,
			changed: false,
			changes: Object.freeze([]),
			unhandled: Object.freeze([...new Set(unhandled)].sort(compareStrings)),
		});
	if (relevant.length === 0) return unchanged([]);
	const parsed = parseTemplate(source, path, { preserveWhitespaces: true });
	if (parsed.errors !== null && parsed.errors.length > 0)
		return unchanged([
			`${path}: the template does not parse, so its binding order cannot be read and it cannot be ` +
				`honestly counted as unchanged. Errors: ${parsed.errors.map((error) => error.msg).join('; ')}`,
		]);
	const parsedSelectors = new Map<DirectiveBindingReading, readonly SelectorTerm[]>();
	const unhandled: string[] = [];
	for (const reading of relevant) {
		const terms = parseSelector(reading.selector);
		if (terms === null)
			unhandled.push(
				`${path}: ${reading.component}'s selector \`${reading.selector}\` is a shape this capability ` +
					'cannot match to an element, so its call sites were left in their authored order',
			);
		else parsedSelectors.set(reading, terms);
	}
	const elements: TmplAstElement[] = [];
	elementsOf(parsed.nodes, elements);
	const edits: SourceEdit[] = [];
	const changes: BindingReorderChange[] = [];
	for (const element of elements) {
		const matched = relevant.filter((reading) => {
			const terms = parsedSelectors.get(reading);
			return terms !== undefined && elementMatchesSelector(element, terms);
		});
		if (matched.length === 0) continue;
		const directiveInputs = new Set<string>();
		for (const reading of matched)
			for (const input of reading.inputs) directiveInputs.add(input);
		const slots: Slot[] = [];
		let ambiguous = false;
		for (const input of element.inputs) {
			if (input.type !== BindingType.Property) continue;
			if (!directiveInputs.has(input.name)) continue;
			if (slots.some((slot) => slot.name === input.name)) {
				ambiguous = true;
				break;
			}
			const start = input.sourceSpan.start.offset;
			const end = input.sourceSpan.end.offset;
			slots.push(
				Object.freeze({ name: input.name, start, end, text: source.slice(start, end) }),
			);
		}
		if (ambiguous || slots.length < 2) continue;
		const indexByName = new Map(slots.map((slot, index) => [slot.name, index]));
		const edges: Readonly<{ from: number; to: number }>[] = [];
		const edgeLabels: string[] = [];
		for (const reading of matched)
			for (const dependency of reading.setterDependencies) {
				const to = indexByName.get(dependency.input);
				if (to === undefined) continue;
				for (const dependencyName of dependency.dependsOn) {
					const from = indexByName.get(dependencyName);
					if (from === undefined) continue;
					edges.push(Object.freeze({ from, to }));
					edgeLabels.push(`${dependencyName} -> ${dependency.input}`);
				}
			}
		if (edges.length === 0) continue;
		const line = lineOf(source, element.startSourceSpan.start.offset);
		const order = topologicalOrder(slots, edges);
		if (order === null) {
			unhandled.push(
				`${path} line ${String(line)}: <${element.name}> binds ${slots
					.map((slot) => slot.name)
					.join(', ')} whose setter dependencies (${[...new Set(edgeLabels)]
					.sort(compareStrings)
					.join(
						'; ',
					)}) form a cycle; no binding order satisfies them all, so the site was left unchanged`,
			);
			continue;
		}
		const alreadySafe = order.every((slotIndex, position) => slotIndex === position);
		if (alreadySafe) continue;
		for (let position = 0; position < slots.length; position += 1) {
			const target = slots[position] as Slot;
			const chosen = slots[order[position] as number] as Slot;
			if (chosen.text !== target.text)
				edits.push({ start: target.start, end: target.end, text: chosen.text });
		}
		changes.push(
			Object.freeze({
				kind: 'template-binding-reorder',
				line,
				element: element.name,
				directive: matched
					.map((reading) => reading.component)
					.sort(compareStrings)
					.join(', '),
				before: Object.freeze(slots.map((slot) => slot.name)),
				after: Object.freeze(order.map((slotIndex) => (slots[slotIndex] as Slot).name)),
				edges: Object.freeze([...new Set(edgeLabels)].sort(compareStrings)),
			}),
		);
	}
	if (edits.length === 0)
		return Object.freeze({
			path,
			source,
			changed: false,
			changes: Object.freeze([]),
			unhandled: Object.freeze([...new Set(unhandled)].sort(compareStrings)),
		});
	const migrated = applySourceEdits(source, edits);
	return Object.freeze({
		path,
		source: migrated,
		changed: migrated !== source,
		changes: Object.freeze(changes),
		unhandled: Object.freeze([...new Set(unhandled)].sort(compareStrings)),
	});
}
