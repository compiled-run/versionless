/**
 * The era semantics of `ControlValueAccessor.setDisabledState`, restored through
 * the vendor's own switch.
 *
 * Angular's reactive-forms `setUpControl` used to call a value accessor's
 * `setDisabledState` only when the control it was attaching was already
 * disabled. An accessor attached to an *enabled* control never saw the method
 * run. Angular calls that a bug in its own source — "The legacy behavior only
 * calls the CVA's `setDisabledState` if the control is disabled. If the
 * `callSetDisabledState` option is set to `always`, then this bug is fixed and
 * the method is always called." — and from Angular 15 the fix is the default:
 * `setUpControl` calls `setDisabledState(control.disabled)` on every attach.
 *
 * For an accessor whose `setDisabledState` only toggles a flag, the fix is
 * invisible: `this.disabled = false` where the field was already false. For an
 * accessor whose `setDisabledState` does something — rebuilds a `FormGroup`,
 * re-reads a value, touches a subscription — the fix runs application code that
 * has never run before, at attach time, on every control. That is a behavioural
 * change a build cannot see, and it is not the application's mistake to fix: the
 * application's bytes did not change, the framework's attach semantics did.
 *
 * Angular ships the switch for exactly this migration. `CALL_SET_DISABLED_STATE`
 * provided as `'whenDisabledForLegacyCode'` — equivalently
 * `ReactiveFormsModule.withConfig({callSetDisabledState:
 * 'whenDisabledForLegacyCode'})` — restores the era guard byte for byte at the
 * seam that changed. So this capability provides it, and only where the
 * application's own bytes say the seam matters:
 *
 * - **Only when a custom accessor exists.** The accessors are read out of the
 *   `implements` clauses that resolve to `@angular/forms`' own
 *   `ControlValueAccessor`, not out of a name that happens to be spelled that
 *   way.
 * - **Only when one of them does more than toggle a flag.** The body of
 *   `setDisabledState` is classified statement by statement: writing a boolean
 *   field, or plumbing the `disabled` attribute/property onto an element, is a
 *   toggle; anything else is an effect, and it is the effects that make the new
 *   attach-time call observable. An application whose accessors only toggle gets
 *   nothing provided, because a provider nobody needs is a claim about the
 *   application its own source contradicts.
 * - **Only on a line that has the switch.** `callSetDisabledState` arrived in
 *   Angular 15. Below that line the era guard is still the framework's own
 *   behaviour and there is nothing to restore; configuring an option that line
 *   does not publish would not compile.
 *
 * The delivery seam is the root module's own `imports` list: every
 * `@angular/forms` module it names is configured through the `withConfig`
 * factory the package publishes. A bare root provider of the token would be the
 * narrower edit, but on Angular 16.2 `CALL_SET_DISABLED_STATE` is declared in
 * the package's typings and absent from its export surface — measured against
 * the installed closure, where a provider naming it fails to compile — so the
 * factory is what is actually available. Either way it is configuration rather
 * than a rewrite, and no application logic is touched, which is what keeps "the
 * migration changed no application behaviour" an honest sentence rather than a
 * repaired one.
 */

import { compareStrings, majorOf, type AngularTargetCell } from './angular-target-cell.ts';
import { NG_MODULE_DECORATOR, NG_MODULE_PACKAGE } from './entry-components-removal.ts';
import {
	applySourceEdits,
	denotesExport,
	forEachNode,
	lineOf,
	parseModule,
	plainProperties,
	readModuleImports,
	type AstNode,
	type SemanticModule,
	type SourceEdit,
} from './semantic-module.ts';

const CAPABILITY = 'Forms legacy disabled-state compatibility';

/** The package that publishes the accessor contract, the token and the module. */
export const FORMS_PACKAGE = '@angular/forms';

/** The interface a custom value accessor implements. */
export const CONTROL_VALUE_ACCESSOR_TYPE = 'ControlValueAccessor';

/** The method whose call site Angular 15 changed. */
export const SET_DISABLED_STATE_METHOD = 'setDisabledState';

/**
 * The injection token that selects the call-site behaviour.
 *
 * It is named here because it is what the configuration provides and what a
 * reader of the emitted bundle will find, but it is not what this capability
 * writes: on Angular 16.2 the token is declared in `@angular/forms`' typings
 * and is *not* on its published export surface, so a root provider naming it
 * does not compile. That was measured against the installed closure rather than
 * assumed, and the delivery seam below is the one the package actually
 * publishes for it.
 */
export const CALL_SET_DISABLED_STATE_TOKEN = 'CALL_SET_DISABLED_STATE';

/** The published option that provides {@link CALL_SET_DISABLED_STATE_TOKEN}. */
export const CALL_SET_DISABLED_STATE_OPTION = 'callSetDisabledState';

/** The static factory each forms module publishes for that option. */
export const WITH_CONFIG_FACTORY = 'withConfig';

/** The value that restores the pre-15 guard. */
export const LEGACY_CALL_SET_DISABLED_STATE = 'whenDisabledForLegacyCode';

/** The first Angular line that publishes the option and defaults to `always`. */
export const CALL_SET_DISABLED_STATE_ANGULAR_MAJOR = 15;

/**
 * The modules that publish {@link WITH_CONFIG_FACTORY} for this option. Each
 * ships its own copy of the token provider for the directives it declares, so
 * an application importing both is configured on both: which of the two binds a
 * given accessor is the template's business, not this capability's.
 */
export const CONFIGURABLE_FORMS_MODULES: readonly string[] = Object.freeze([
	'FormsModule',
	'ReactiveFormsModule',
]);

/**
 * The names an element's disabled state is plumbed through. A call naming one of
 * these with the `disabled` attribute is the accessor doing exactly what the
 * method is for, in the one shape that does not go through a field.
 */
export const DISABLED_PLUMBING_METHODS: readonly string[] = Object.freeze([
	'setAttribute',
	'removeAttribute',
	'setProperty',
	'setDisabledState',
]);

/** One statement of a `setDisabledState` body that is not a disabled toggle. */
export type SetDisabledStateEffect = Readonly<{
	/** The 1-based line the statement opens on. */
	line: number;
	/** The statement as the application writes it, whitespace collapsed. */
	statement: string;
	/** Why reading it as a toggle was refused. */
	why: string;
}>;

/** One custom value accessor, as its own source describes it. */
export type ControlValueAccessorReading = Readonly<{
	/** The module the class is declared in. */
	path: string;
	/** The 1-based line the class opens on. */
	line: number;
	/** The class name, or null for an anonymous class expression. */
	className: string | null;
	/** Whether the class declares `setDisabledState` at all. */
	declaresSetDisabledState: boolean;
	/** Every statement of that method that is not a disabled toggle. */
	effects: readonly SetDisabledStateEffect[];
	/** Whether this accessor is one the era guard was hiding. */
	legacy: boolean;
}>;

/** The configuration edit written into the root module. */
export type LegacyCallSetDisabledStateChange = Readonly<{
	kind: 'forms-legacy-call-set-disabled-state';
	/** The module the configuration was written into. */
	path: string;
	/** The 1-based line of the `@NgModule` literal it was written into. */
	line: number;
	/** The token the configuration provides. */
	token: typeof CALL_SET_DISABLED_STATE_TOKEN;
	/** The published option written. */
	option: typeof CALL_SET_DISABLED_STATE_OPTION;
	/** The value provided. */
	value: typeof LEGACY_CALL_SET_DISABLED_STATE;
	/** The forms modules configured, in the order the literal names them. */
	configuredModules: readonly string[];
}>;

export type LegacyCallSetDisabledStateDeclaration = Readonly<{
	/** Whether the provider was declared. */
	declared: boolean;
	/** The root module's source, rewritten only when something changed. */
	rootModule: Readonly<{ path: string; source: string }> | null;
	/** The provider written, or null when none was. */
	change: LegacyCallSetDisabledStateChange | null;
	/** Every custom accessor read, refused or not. */
	accessors: readonly ControlValueAccessorReading[];
	/** What providing this changes about the application, stated. */
	declaredDifferences: readonly string[];
	/** Everything refused, by name and with its reason. */
	unhandled: readonly string[];
}>;

/** One module handed to this capability. */
export type AngularModuleSource = Readonly<{ path: string; source: string }>;

function collapse(text: string): string {
	return text.replaceAll(/\s+/gu, ' ').trim();
}

/** Whether a node is `this.<name>` written plainly. */
function thisMember(node: AstNode): string | null {
	if (node.type !== 'MemberExpression' || node.computed || node.optional) return null;
	if (node.object.type !== 'ThisExpression') return null;
	return node.property.type === 'Identifier' ? node.property.name : null;
}

/** The deepest non-computed property name of a member chain, or null. */
function trailingProperty(node: AstNode): string | null {
	if (node.type !== 'MemberExpression' || node.computed) return null;
	return node.property.type === 'Identifier' ? node.property.name : null;
}

/**
 * Whether an expression is a boolean reading of the method's own parameter: the
 * parameter itself, a negation of it, or a boolean literal. Anything richer is
 * an effect, because a capability that guesses at what a call returns is
 * guessing at what the application does.
 */
function isBooleanOf(node: AstNode, parameter: string | null): boolean {
	if (node.type === 'Identifier') return parameter !== null && node.name === parameter;
	if (node.type === 'Literal') return typeof node.value === 'boolean';
	if (node.type === 'UnaryExpression' && node.operator === '!')
		return isBooleanOf(node.argument, parameter);
	return false;
}

/**
 * Whether a call is the accessor plumbing the `disabled` attribute onto an
 * element. `renderer.setProperty(el, 'disabled', isDisabled)` and its siblings
 * are the framework-blessed way to write the method's only real job, and they
 * are indistinguishable from a toggle in every way that matters here: nothing
 * the application owns changes shape.
 */
function isDisabledPlumbing(node: AstNode): boolean {
	if (node.type !== 'CallExpression') return false;
	const method = trailingProperty(node.callee);
	if (method === null || !DISABLED_PLUMBING_METHODS.includes(method)) return false;
	return node.arguments.some(
		(argument) => argument.type === 'Literal' && argument.value === 'disabled',
	);
}

/**
 * Classify one statement of a `setDisabledState` body.
 *
 * Returns null when the statement is a disabled toggle, and the reason it is not
 * otherwise. The classification is deliberately narrow: everything this does not
 * recognise is an effect, so an accessor is never quietly read as harmless.
 */
function effectOf(source: string, statement: AstNode, parameter: string | null): string | null {
	if (statement.type === 'EmptyStatement') return null;
	if (statement.type !== 'ExpressionStatement')
		return `it is a ${statement.type}, not an assignment or a call this capability can read`;
	const expression = statement.expression;
	if (expression.type === 'CallExpression')
		return isDisabledPlumbing(expression)
			? null
			: 'it calls something other than a `disabled` attribute or property write, so the ' +
					'call runs application code at attach time';
	if (expression.type !== 'AssignmentExpression' || expression.operator !== '=')
		return `it is a ${expression.type}, not a plain assignment or a call this capability can read`;
	const field = thisMember(expression.left);
	const property = trailingProperty(expression.left);
	if (field === null && property !== 'disabled')
		return (
			'it assigns to something other than a field of this instance or a `disabled` ' +
			'property of an element'
		);
	if (!isBooleanOf(expression.right, parameter))
		return field === null
			? 'it assigns a value this capability cannot read as a boolean to a `disabled` property'
			: `it assigns something other than the disabled flag to \`this.${field}\`, so attaching ` +
					'a control now rebuilds application state that used to survive the attach';
	return null;
}

/** The parameter name of a method, when it takes exactly one plain identifier. */
function soleParameterName(value: AstNode): string | null {
	if (value.type !== 'FunctionExpression' && value.type !== 'ArrowFunctionExpression')
		return null;
	const first = value.params[0];
	if (first === undefined) return null;
	return first.type === 'Identifier' ? first.name : null;
}

type ClassNode = Extract<AstNode, { type: 'ClassDeclaration' | 'ClassExpression' }>;
type MethodNode = Extract<AstNode, { type: 'MethodDefinition' }>;

/** The class a node sits inside, or null. */
function enclosingClass(module: SemanticModule, node: AstNode): ClassNode | null {
	let current: AstNode | null = node;
	while (current !== null) {
		if (current.type === 'ClassDeclaration' || current.type === 'ClassExpression')
			return current;
		current = module.parentOf(current);
	}
	return null;
}

/**
 * Read every custom `ControlValueAccessor` one module declares, and classify
 * what each one's `setDisabledState` does.
 *
 * The accessors are found through the resolved binding of the `implements`
 * clause: a class implementing some other interface spelled the same way is not
 * one of Angular's, and a class implementing Angular's under an alias is.
 */
export function readControlValueAccessors(
	path: string,
	source: string,
): readonly ControlValueAccessorReading[] {
	const module = parseModule(CAPABILITY, path, source);
	const forms = readModuleImports(module, FORMS_PACKAGE);
	if (!forms.present) return Object.freeze([]);
	const readings: ControlValueAccessorReading[] = [];
	const seen = new Set<AstNode>();
	forEachNode(module.ast, (node) => {
		if (node.type !== 'TSClassImplements') return;
		if (!denotesExport(module, node.expression, forms, CONTROL_VALUE_ACCESSOR_TYPE)) return;
		const declaration = enclosingClass(module, node);
		if (declaration === null || seen.has(declaration)) return;
		seen.add(declaration);
		const className = declaration.id?.type === 'Identifier' ? declaration.id.name : null;
		const method = declaration.body.body.find(
			(member) =>
				member.type === 'MethodDefinition' &&
				!member.computed &&
				member.key.type === 'Identifier' &&
				member.key.name === SET_DISABLED_STATE_METHOD,
		) as MethodNode | undefined;
		const effects: SetDisabledStateEffect[] = [];
		if (method !== undefined) {
			const parameter = soleParameterName(method.value);
			const body = method.value.body;
			if (body === null || body === undefined || body.type !== 'BlockStatement')
				effects.push(
					Object.freeze({
						line: lineOf(source, method.start),
						statement: `${SET_DISABLED_STATE_METHOD}(…)`,
						why: 'the method has no readable statement body, so what it does at attach time cannot be read',
					}),
				);
			else
				for (const statement of body.body) {
					const why = effectOf(source, statement, parameter);
					if (why === null) continue;
					effects.push(
						Object.freeze({
							line: lineOf(source, statement.start),
							statement: collapse(source.slice(statement.start, statement.end)),
							why,
						}),
					);
				}
		}
		readings.push(
			Object.freeze({
				path,
				line: lineOf(source, declaration.start),
				className,
				declaresSetDisabledState: method !== undefined,
				effects: Object.freeze(effects),
				legacy: effects.length > 0,
			}),
		);
	});
	return Object.freeze(readings);
}

/** The `@NgModule` literal that bootstraps the application, in one module. */
function rootModuleLiteral(
	module: SemanticModule,
	source: string,
): Readonly<{ literal: AstNode; line: number }> | null {
	const core = readModuleImports(module, NG_MODULE_PACKAGE);
	if (!core.present) return null;
	let found: Readonly<{ literal: AstNode; line: number }> | null = null;
	forEachNode(module.ast, (node) => {
		if (found !== null || node.type !== 'Decorator') return;
		const call = node.expression;
		if (call.type !== 'CallExpression') return;
		if (!denotesExport(module, call.callee, core, NG_MODULE_DECORATOR)) return;
		const literal = call.arguments[0];
		if (literal === undefined || literal.type !== 'ObjectExpression') return;
		const properties = plainProperties(literal);
		if (properties === null) return;
		if (!properties.some((property) => property.name === 'bootstrap')) return;
		found = Object.freeze({ literal, line: lineOf(source, node.start) });
	});
	return found;
}

function refusal(reasons: readonly string[], accessors: readonly ControlValueAccessorReading[]) {
	return Object.freeze({
		declared: false,
		rootModule: null,
		change: null,
		accessors,
		declaredDifferences: Object.freeze([]),
		unhandled: Object.freeze([...reasons]),
	}) satisfies LegacyCallSetDisabledStateDeclaration;
}

/**
 * Provide the era call-site behaviour for an application that crosses the
 * Angular 15 boundary carrying a value accessor the era guard was hiding.
 *
 * Every module handed in is read for accessors; exactly one of them is expected
 * to carry the bootstrapping `@NgModule`, and the provider is written into that
 * literal's `providers` array. A workspace with no bootstrapping module, or more
 * than one, is refused by name rather than picked between.
 */
export function declareLegacyCallSetDisabledState(input: {
	modules: readonly AngularModuleSource[];
	cell: AngularTargetCell;
}): LegacyCallSetDisabledStateDeclaration {
	const accessors: ControlValueAccessorReading[] = [];
	for (const module of input.modules)
		accessors.push(...readControlValueAccessors(module.path, module.source));
	const frozen = Object.freeze([...accessors]);
	const legacy = frozen.filter((reading) => reading.legacy);
	if (legacy.length === 0)
		return refusal(
			[
				`${CALL_SET_DISABLED_STATE_TOKEN} was not provided: of the ${String(frozen.length)} ` +
					`custom ${CONTROL_VALUE_ACCESSOR_TYPE} implementations read across ` +
					`${String(input.modules.length)} modules, none declares a ` +
					`\`${SET_DISABLED_STATE_METHOD}\` that does anything but toggle its disabled state, ` +
					"so Angular 15's attach-time call is unobservable here and restoring the era guard " +
					'would be a provider answering a question this application does not ask',
			],
			frozen,
		);
	const major = majorOf(input.cell.angularLine);
	if (major === null || major < CALL_SET_DISABLED_STATE_ANGULAR_MAJOR)
		return refusal(
			[
				`${CALL_SET_DISABLED_STATE_TOKEN} was not provided: the declared cell is on Angular ` +
					`${input.cell.angularLine}, which does not publish the token and whose ` +
					'`setUpControl` already applies the legacy guard, so there is nothing here to restore',
			],
			frozen,
		);
	const roots: Array<{
		module: AngularModuleSource;
		parsed: SemanticModule;
		literal: AstNode;
		line: number;
	}> = [];
	for (const module of input.modules) {
		const parsed = parseModule(CAPABILITY, module.path, module.source);
		const root = rootModuleLiteral(parsed, module.source);
		if (root === null) continue;
		roots.push({ module, parsed, literal: root.literal, line: root.line });
	}
	if (roots.length !== 1) {
		const names = roots.map((entry) => entry.module.path).sort(compareStrings);
		return refusal(
			[
				`${CALL_SET_DISABLED_STATE_TOKEN} was not provided: ` +
					(roots.length === 0
						? `none of the ${String(input.modules.length)} modules read carries an ` +
							`@${NG_MODULE_DECORATOR} literal with a \`bootstrap\` property, so this ` +
							"capability cannot say which providers are the application's root providers"
						: `${String(roots.length)} modules carry a bootstrapping @${NG_MODULE_DECORATOR} ` +
							`literal (${names.join(', ')}), and choosing between them is the ` +
							"application's decision rather than this capability's"),
			],
			frozen,
		);
	}
	const root = roots[0]!;
	const { module, parsed, literal, line } = root;
	const source = module.source;
	const properties = plainProperties(literal)!;
	const imports = properties.find((property) => property.name === 'imports');
	if (imports === undefined || imports.value.type !== 'ArrayExpression')
		return refusal(
			[
				`${CALL_SET_DISABLED_STATE_OPTION} was not configured: the bootstrapping ` +
					`@${NG_MODULE_DECORATOR} literal in ${module.path} carries ` +
					(imports === undefined
						? 'no `imports` property'
						: 'an `imports` value that is not a plain array') +
					`, so there is no ${FORMS_PACKAGE} module in it this capability can read as the one ` +
					'whose directives attach the accessors',
			],
			frozen,
		);
	const forms = readModuleImports(parsed, FORMS_PACKAGE);
	const edits: SourceEdit[] = [];
	const configured: string[] = [];
	const quote = source.slice(literal.start, literal.end).includes('"') ? '"' : "'";
	for (const element of imports.value.elements as readonly (AstNode | null)[]) {
		if (element === null) continue;
		const name = CONFIGURABLE_FORMS_MODULES.find((candidate) =>
			denotesExport(parsed, element, forms, candidate),
		);
		if (name === undefined) continue;
		configured.push(name);
		edits.push({
			start: element.end,
			end: element.end,
			text:
				`.${WITH_CONFIG_FACTORY}({${CALL_SET_DISABLED_STATE_OPTION}: ` +
				`${quote}${LEGACY_CALL_SET_DISABLED_STATE}${quote}})`,
		});
	}
	if (configured.length === 0)
		return refusal(
			[
				`${CALL_SET_DISABLED_STATE_OPTION} was not configured: the bootstrapping ` +
					`@${NG_MODULE_DECORATOR} literal in ${module.path} names none of ` +
					`${CONFIGURABLE_FORMS_MODULES.join(' or ')} as a plain \`${FORMS_PACKAGE}\` binding in ` +
					`its \`imports\`, so there is nothing here publishing \`${WITH_CONFIG_FACTORY}\` for ` +
					`this option, and a root provider of \`${CALL_SET_DISABLED_STATE_TOKEN}\` is not ` +
					`available either: the token is declared in \`${FORMS_PACKAGE}\`'s typings and is ` +
					'not on its published export surface',
			],
			frozen,
		);
	const rewritten = applySourceEdits(source, edits);
	const names = legacy
		.map((reading) => `${reading.path}:${reading.className ?? '<anonymous>'}`)
		.sort(compareStrings);
	return Object.freeze({
		declared: true,
		rootModule: Object.freeze({ path: module.path, source: rewritten }),
		change: Object.freeze({
			kind: 'forms-legacy-call-set-disabled-state' as const,
			path: module.path,
			line,
			token: CALL_SET_DISABLED_STATE_TOKEN,
			option: CALL_SET_DISABLED_STATE_OPTION,
			value: LEGACY_CALL_SET_DISABLED_STATE,
			configuredModules: Object.freeze([...configured]),
		}),
		accessors: frozen,
		declaredDifferences: Object.freeze([
			`Angular ${input.cell.angularLine} calls \`${SET_DISABLED_STATE_METHOD}\` on every ` +
				`${CONTROL_VALUE_ACCESSOR_TYPE} as it attaches a control; with ` +
				`${configured.join(' and ')} configured ` +
				`\`${CALL_SET_DISABLED_STATE_OPTION}: ${LEGACY_CALL_SET_DISABLED_STATE}\` — which is how ` +
				`${FORMS_PACKAGE} publishes the \`${CALL_SET_DISABLED_STATE_TOKEN}\` provider — it calls ` +
				'it only for a control that is already disabled, which is what Angular did before 15. ' +
				`${String(legacy.length)} of this application's ${String(frozen.length)} custom accessors ` +
				`(${names.join(', ')}) do more in that method than toggle a flag, so the difference is ` +
				'observable here. Angular names the pre-15 behaviour a bug in its own source and ships ' +
				'this switch to opt back into it for migrated code; no application logic was rewritten, ' +
				'and the accessors keep whatever defects they already had.',
		]),
		unhandled: Object.freeze([]),
	});
}
