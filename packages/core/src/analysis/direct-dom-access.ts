import { createHash } from 'node:crypto';
import { basename, dirname, extname, isAbsolute, join, normalize, parse } from 'pathe';
import {
	Analyzer,
	type Module,
	type NodeOfType,
	type NodeType,
	type Symbol as YukuSymbol,
} from 'yuku-analyzer';
import { canonicalize } from '../receipts/canonicalize.ts';

export type DirectDomCategory =
	| 'document-selector'
	| 'reactdom-find-dom-node'
	| 'html-write'
	| 'imperative-node-call'
	| 'layout-read'
	| 'unresolved-jquery';
export type DirectDomOrigin = 'production' | 'test' | 'generated-template' | 'bundled-vendor';
export type DirectDomPhase = 'render' | 'effect' | 'lifecycle' | 'event' | 'module' | 'unknown';

export interface DirectDomInputFile {
	path: string;
	source: string;
	origin?: DirectDomOriginFact;
}

export interface DirectDomOriginFact {
	status: 'known';
	kind: DirectDomOrigin;
	evidence: string;
}

export interface DirectDomContextFact {
	status: 'known' | 'unknown';
	value: string | null;
	evidence: string;
}

export interface DirectDomSite {
	category: DirectDomCategory;
	member: string;
	path: string;
	location: { line: number; column: number; start: number; end: number };
	origin: DirectDomOriginFact;
	ownership: DirectDomContextFact;
	containingFunction: DirectDomContextFact;
	component: DirectDomContextFact;
	phase: DirectDomContextFact & { value: DirectDomPhase };
}

export interface WindowGlobalSite {
	name: 'window';
	path: string;
	location: { line: number; column: number; start: number; end: number };
	origin: DirectDomOriginFact;
	context: ReturnType<typeof contextFor>;
}

interface DirectDomContext {
	ownership: DirectDomContextFact;
	containingFunction: DirectDomContextFact;
	component: DirectDomContextFact;
	phase: DirectDomSite['phase'];
}

interface ComponentFact {
	name: DirectDomContextFact;
	kind: 'function-component' | 'react-class-method';
	evidence: string;
}

interface SemanticContextModel {
	components: Map<FunctionNode, ComponentFact>;
	effects: Set<FunctionNode>;
	events: Map<FunctionNode, ComponentFact | null>;
}

export interface DirectDomInventory {
	schemaVersion: 'versionless.direct-dom-inventory.v1';
	id: string;
	root: '.';
	semanticEngine: {
		parser: 'yuku-parser@0.7.0';
		analyzer: 'yuku-analyzer@0.7.0';
		files: number;
		diagnostics: 0;
	};
	sites: DirectDomSite[];
	windowGlobals: WindowGlobalSite[];
	counts: {
		total: number;
		byCategory: Record<DirectDomCategory, number>;
		byOrigin: Record<DirectDomOrigin, number>;
		byPhase: Record<DirectDomPhase, number>;
		windowGlobals: number;
		unknownOwnership: number;
		unknownComponents: number;
		unknownPhases: number;
	};
	diagnostics: [];
	locality: { offline: true; networkAttempts: 0; filesChanged: 0 };
	nonclaims: string[];
	integrity: { algorithm: 'sha256'; canonicalDigest: string; authenticity: 'not-established' };
}

export class DirectDomAnalysisError extends Error {
	readonly diagnostics: ReadonlyArray<unknown>;

	constructor(message: string, diagnostics: ReadonlyArray<unknown>) {
		super(message);
		this.name = 'DirectDomAnalysisError';
		this.diagnostics = diagnostics;
	}
}

const categories: DirectDomCategory[] = [
	'document-selector',
	'reactdom-find-dom-node',
	'html-write',
	'imperative-node-call',
	'layout-read',
	'unresolved-jquery',
];
const origins: DirectDomOrigin[] = ['production', 'test', 'generated-template', 'bundled-vendor'];
const phases: DirectDomPhase[] = ['render', 'effect', 'lifecycle', 'event', 'module', 'unknown'];
const documentSelectors = new Set([
	'querySelector',
	'querySelectorAll',
	'getElementById',
	'getElementsByClassName',
]);
const htmlWrites = new Set(['innerHTML', 'outerHTML']);
const imperativeCalls = new Set(['focus', 'scrollIntoView']);
const layoutMembers = new Set(['offsetWidth', 'offsetHeight']);
const lifecycleNames = new Set([
	'componentDidMount',
	'componentDidUpdate',
	'componentWillMount',
	'componentWillReceiveProps',
	'componentWillUnmount',
	'componentWillUpdate',
	'getSnapshotBeforeUpdate',
]);
const yukuResolveExtensions = ['.tsx', '.ts', '.jsx', '.js'] as const;

type AnyNode = NodeOfType<NodeType>;
type ExpressionNode = NodeOfType<NodeType>;
type FunctionNode =
	| NodeOfType<'FunctionDeclaration'>
	| NodeOfType<'FunctionExpression'>
	| NodeOfType<'ArrowFunctionExpression'>
	| NodeOfType<'TSDeclareFunction'>
	| NodeOfType<'TSEmptyBodyFunctionExpression'>;
type MemberNode = NodeOfType<'MemberExpression'>;

function yukuLanguage(path: string): 'js' | 'jsx' | 'ts' | 'tsx' {
	const extension = extname(path);
	if (extension === '.js' || extension === '.jsx') return 'jsx';
	return extension === '.tsx' ? 'tsx' : 'ts';
}

function isCommonJsExportTarget(module: Module, node: ExpressionNode): boolean {
	let value = unwrapExpression(node);
	while (value.type === 'MemberExpression') {
		const object = unwrapExpression(value.object);
		if (unresolved(module, object, 'exports')) return true;
		if (memberName(value) === 'exports' && unresolved(module, object, 'module')) return true;
		value = object;
	}
	return false;
}

function hasCommonJsExports(module: Module): boolean {
	let found = false;
	module.walk({
		AssignmentExpression(node) {
			if (isCommonJsExportTarget(module, node.left)) found = true;
		},
	});
	return found;
}

function yukuResolver(
	modulePaths: ReadonlySet<string>,
	commonJsPaths: ReadonlySet<string>,
): (specifier: string, importerPath: string) => string | null {
	return (specifier, importerPath) => {
		if (!specifier.startsWith('.')) return null;
		const base = normalize(join(dirname(importerPath), specifier));
		const directory = dirname(base);
		const name = basename(base);
		const candidates = [
			base,
			...yukuResolveExtensions.map((extension) => join(directory, `${name}${extension}`)),
			...yukuResolveExtensions.map((extension) => join(base, `index${extension}`)),
		];
		return (
			candidates.find(
				(candidate) => modulePaths.has(candidate) && !commonJsPaths.has(candidate),
			) ?? null
		);
	};
}

function portablePath(path: string): string {
	const normalized = normalize(path);
	if (isAbsolute(normalized) || normalized === '..' || normalized.startsWith('../'))
		throw new Error(`Direct DOM input path must be relative and contained: ${path}`);
	return normalized.startsWith('./') ? normalized.slice(2) : normalized;
}

export function classifyDirectDomOrigin(path: string): DirectDomOriginFact {
	const portable = portablePath(path);
	const parts = portable.split('/');
	const filename = parts.at(-1) ?? portable;
	const stem = parse(filename).name;
	if (
		parts.includes('node_modules') ||
		parts.includes('vendor') ||
		parts.includes('vendors') ||
		stem.endsWith('.min')
	)
		return { status: 'known', kind: 'bundled-vendor', evidence: 'portable-path-vendor-rule' };
	if (
		parts.includes('__tests__') ||
		parts.includes('test') ||
		parts.includes('tests') ||
		stem.endsWith('.test') ||
		stem.endsWith('.spec')
	)
		return { status: 'known', kind: 'test', evidence: 'portable-path-test-rule' };
	if (parts.includes('generated') || parts.includes('templates') || stem.includes('.generated'))
		return {
			status: 'known',
			kind: 'generated-template',
			evidence: 'portable-path-generated-template-rule',
		};
	return {
		status: 'known',
		kind: 'production',
		evidence: 'portable-path-default-production-rule',
	};
}

function unwrapExpression(node: ExpressionNode): ExpressionNode {
	let current = node;
	while (
		current.type === 'ParenthesizedExpression' ||
		current.type === 'TSAsExpression' ||
		current.type === 'TSSatisfiesExpression' ||
		current.type === 'TSTypeAssertion' ||
		current.type === 'TSNonNullExpression'
	)
		current = current.expression;
	return current;
}

function memberName(node: MemberNode): string | null {
	if (!node.computed && node.property.type === 'Identifier') return node.property.name;
	if (
		node.computed &&
		node.property.type === 'Literal' &&
		typeof node.property.value === 'string'
	)
		return node.property.value;
	return null;
}

function unresolved(module: Module, node: ExpressionNode, name: string): boolean {
	const value = unwrapExpression(node);
	if (value.type !== 'Identifier' || value.name !== name) return false;
	const reference = module.referenceOf(value);
	return reference !== null && reference.symbol === null;
}

function imported(module: Module, symbol: YukuSymbol, specifier: string, name?: string): boolean {
	return module.imports.some(
		(record) =>
			record.local === symbol &&
			record.specifier === specifier &&
			(name === undefined || record.name === name),
	);
}

function initializerOf(symbol: YukuSymbol): ExpressionNode | null {
	for (const declaration of symbol.declarations) {
		if (declaration.type === 'VariableDeclarator' && declaration.init !== null)
			return declaration.init;
		const parent = symbol.module.parentOf(declaration);
		if (
			parent?.type === 'VariableDeclarator' &&
			parent.id === declaration &&
			parent.init !== null
		)
			return parent.init;
	}
	return null;
}

function valueMatches(
	module: Module,
	node: ExpressionNode,
	globalName: string,
	importTest: (owner: Module, symbol: YukuSymbol) => boolean,
	seen = new Set<string>(),
): boolean {
	const value = unwrapExpression(node);
	if (unresolved(module, value, globalName)) return true;
	if (value.type !== 'Identifier') return false;
	const symbol = module.referenceOf(value)?.symbol ?? module.symbolOf(value);
	if (symbol === null) return false;
	const key = `${symbol.module.path}:${symbol.id}`;
	if (seen.has(key)) return false;
	seen.add(key);
	if (importTest(symbol.module, symbol)) return true;
	const definition = module.analyzer.definitionOf(symbol);
	if (definition?.symbol && definition.symbol !== symbol) {
		if (importTest(definition.module, definition.symbol)) return true;
		const definitionInitializer = initializerOf(definition.symbol);
		if (
			definitionInitializer &&
			valueMatches(definition.module, definitionInitializer, globalName, importTest, seen)
		)
			return true;
	}
	const initializer = initializerOf(symbol);
	return initializer === null
		? false
		: valueMatches(symbol.module, initializer, globalName, importTest, seen);
}

function isDocument(module: Module, node: ExpressionNode): boolean {
	return valueMatches(module, node, 'document', () => false);
}

function isReactDom(module: Module, node: ExpressionNode): boolean {
	return valueMatches(module, node, 'ReactDOM', (owner, symbol) =>
		imported(owner, symbol, 'react-dom'),
	);
}

function isNamedReactDomFind(module: Module, node: ExpressionNode): boolean {
	const value = unwrapExpression(node);
	if (value.type !== 'Identifier') return false;
	const symbol = module.referenceOf(value)?.symbol;
	if (!symbol) return false;
	if (imported(module, symbol, 'react-dom', 'findDOMNode')) return true;
	const definition = module.analyzer.definitionOf(symbol);
	return definition?.symbol
		? imported(definition.module, definition.symbol, 'react-dom', 'findDOMNode')
		: false;
}

function isReactHook(module: Module, node: ExpressionNode, names: ReadonlySet<string>): boolean {
	const value = unwrapExpression(node);
	if (value.type === 'Identifier') {
		const symbol = module.referenceOf(value)?.symbol;
		return symbol ? [...names].some((name) => imported(module, symbol, 'react', name)) : false;
	}
	if (value.type !== 'MemberExpression') return false;
	const name = memberName(value);
	return name !== null && names.has(name) && isReactValue(module, value.object as ExpressionNode);
}

function isReactValue(module: Module, node: ExpressionNode): boolean {
	return valueMatches(module, node, 'React', (owner, symbol) => imported(owner, symbol, 'react'));
}

function isNamedReactImport(
	module: Module,
	node: ExpressionNode,
	names: ReadonlySet<string>,
): boolean {
	const value = unwrapExpression(node);
	if (value.type !== 'Identifier') return false;
	const symbol = module.referenceOf(value)?.symbol;
	if (!symbol) return false;
	if ([...names].some((name) => imported(module, symbol, 'react', name))) return true;
	const definition = module.analyzer.definitionOf(symbol);
	return Boolean(
		definition?.symbol &&
		[...names].some((name) => imported(definition.module, definition.symbol!, 'react', name)),
	);
}

function location(source: string, start: number, end: number) {
	let line = 1;
	let column = 1;
	for (let index = 0; index < start; index += 1) {
		if (source.charCodeAt(index) === 10) {
			line += 1;
			column = 1;
		} else column += 1;
	}
	return { line, column, start, end };
}

function propertyKeyName(node: NodeOfType<'Property'>['key']): string | null {
	if (node.type === 'Identifier' || node.type === 'PrivateIdentifier') return node.name;
	return node.type === 'Literal' && typeof node.value === 'string' ? node.value : null;
}

function functionName(module: Module, node: FunctionNode): DirectDomContextFact {
	if ('id' in node && node.id?.type === 'Identifier')
		return { status: 'known', value: node.id.name, evidence: 'function-identifier' };
	const parent = module.parentOf(node);
	if (parent?.type === 'VariableDeclarator' && parent.id.type === 'Identifier')
		return { status: 'known', value: parent.id.name, evidence: 'variable-declarator' };
	if (parent?.type === 'MethodDefinition' || parent?.type === 'TSAbstractMethodDefinition') {
		const name = propertyKeyName(parent.key);
		if (name) return { status: 'known', value: name, evidence: 'method-key' };
	}
	if (parent?.type === 'Property') {
		const name = propertyKeyName(parent.key);
		if (name) return { status: 'known', value: name, evidence: 'property-key' };
	}
	return { status: 'unknown', value: null, evidence: 'anonymous-function' };
}

function nearestFunction(module: Module, node: AnyNode): FunctionNode | null {
	let current = module.parentOf(node);
	while (current !== null) {
		if (
			current.type === 'FunctionDeclaration' ||
			current.type === 'FunctionExpression' ||
			current.type === 'ArrowFunctionExpression' ||
			current.type === 'TSDeclareFunction' ||
			current.type === 'TSEmptyBodyFunctionExpression'
		)
			return current;
		current = module.parentOf(current);
	}
	return null;
}

function outerFunction(module: Module, node: FunctionNode): FunctionNode | null {
	return nearestFunction(module, node);
}

function functionForSymbol(symbol: YukuSymbol, seen = new Set<string>()): FunctionNode | null {
	const key = `${symbol.module.path}:${symbol.id}`;
	if (seen.has(key)) return null;
	seen.add(key);
	const definition = symbol.module.analyzer.definitionOf(symbol);
	if (definition?.symbol && definition.symbol !== symbol) {
		const resolved = functionForSymbol(definition.symbol, seen);
		if (resolved) return resolved;
	}
	for (const declaration of symbol.declarations) {
		if (declaration.type === 'FunctionDeclaration' || declaration.type === 'FunctionExpression')
			return declaration;
		const parent = symbol.module.parentOf(declaration);
		if (
			(parent?.type === 'FunctionDeclaration' || parent?.type === 'FunctionExpression') &&
			parent.id === declaration
		)
			return parent;
		if (parent?.type === 'VariableDeclarator' && parent.id === declaration && parent.init) {
			const initializer = unwrapExpression(parent.init);
			if (
				initializer.type === 'ArrowFunctionExpression' ||
				initializer.type === 'FunctionExpression'
			)
				return initializer;
		}
	}
	return null;
}

function functionForReference(
	module: Module,
	node: ExpressionNode,
	requireUnique: boolean,
	seen = new Set<string>(),
): FunctionNode | null {
	const value = unwrapExpression(node);
	if (value.type === 'ArrowFunctionExpression' || value.type === 'FunctionExpression')
		return value;
	if (value.type !== 'Identifier') return null;
	const symbol = module.referenceOf(value)?.symbol;
	if (!symbol) return null;
	const key = `${symbol.module.path}:${symbol.id}`;
	if (seen.has(key)) return null;
	seen.add(key);
	if (requireUnique && symbol.module.analyzer.referencesOf(symbol).length !== 1) return null;
	const direct = functionForSymbol(symbol);
	if (direct) return direct;
	const initializer = initializerOf(symbol);
	return initializer
		? functionForReference(symbol.module, initializer, requireUnique, seen)
		: null;
}

function componentNameFromClass(
	module: Module,
	node: NodeOfType<'ClassDeclaration'> | NodeOfType<'ClassExpression'>,
): DirectDomContextFact {
	if (node.id)
		return { status: 'known', value: node.id.name, evidence: 'resolved-react-class-symbol' };
	const parent = module.parentOf(node);
	return parent?.type === 'VariableDeclarator' && parent.id.type === 'Identifier'
		? { status: 'known', value: parent.id.name, evidence: 'resolved-react-class-variable' }
		: { status: 'unknown', value: null, evidence: 'anonymous-react-class' };
}

function isReactComponentClass(
	module: Module,
	node: NodeOfType<'ClassDeclaration'> | NodeOfType<'ClassExpression'>,
): boolean {
	if (!node.superClass) return false;
	const parent = unwrapExpression(node.superClass);
	if (parent.type === 'MemberExpression') {
		const name = memberName(parent);
		return (
			(name === 'Component' || name === 'PureComponent') &&
			isReactValue(module, parent.object as ExpressionNode)
		);
	}
	return isNamedReactImport(module, parent, new Set(['Component', 'PureComponent']));
}

function enclosingComponent(
	module: Module,
	node: AnyNode,
	components: Map<FunctionNode, ComponentFact>,
): ComponentFact | null {
	let fn = nearestFunction(module, node);
	while (fn) {
		const component = components.get(fn);
		if (component) return component;
		fn = outerFunction(module, fn);
	}
	return null;
}

function buildSemanticContextModel(modules: Module[]): SemanticContextModel {
	const components = new Map<FunctionNode, ComponentFact>();
	for (const module of modules) {
		module.walk({
			enter(node) {
				if (
					(node.type !== 'ClassDeclaration' && node.type !== 'ClassExpression') ||
					!isReactComponentClass(module, node)
				)
					return;
				const name = componentNameFromClass(module, node);
				for (const element of node.body.body)
					if (
						(element.type === 'MethodDefinition' ||
							element.type === 'TSAbstractMethodDefinition') &&
						(element.value.type === 'FunctionExpression' ||
							element.value.type === 'TSEmptyBodyFunctionExpression')
					)
						components.set(element.value, {
							name,
							kind: 'react-class-method',
							evidence: 'resolved-react-component-superclass',
						});
			},
			JSXOpeningElement(node) {
				if (node.name.type !== 'JSXIdentifier') return;
				const reference = module.referenceOf(node.name);
				if (!reference?.symbol) return;
				const fn = functionForSymbol(reference.symbol);
				if (!fn) return;
				components.set(fn, {
					name: {
						status: 'known',
						value: reference.symbol.name,
						evidence: 'resolved-jsx-component-reference',
					},
					kind: 'function-component',
					evidence: 'resolved-jsx-component-reference',
				});
			},
		});
	}
	const effects = new Set<FunctionNode>();
	const events = new Map<FunctionNode, ComponentFact | null>();
	for (const module of modules) {
		module.walk({
			CallExpression(node) {
				if (
					!isReactHook(
						module,
						node.callee as ExpressionNode,
						new Set(['useEffect', 'useLayoutEffect']),
					)
				)
					return;
				for (const argument of node.arguments)
					if (
						argument.type === 'ArrowFunctionExpression' ||
						argument.type === 'FunctionExpression'
					)
						effects.add(argument);
			},
			JSXAttribute(node) {
				if (
					node.name.type !== 'JSXIdentifier' ||
					!node.name.name.startsWith('on') ||
					node.value?.type !== 'JSXExpressionContainer' ||
					node.value.expression.type === 'JSXEmptyExpression'
				)
					return;
				const fn = functionForReference(
					module,
					node.value.expression as ExpressionNode,
					true,
				);
				if (!fn) return;
				const owner = enclosingComponent(module, node, components);
				if (events.has(fn)) events.set(fn, null);
				else events.set(fn, owner);
			},
		});
	}
	return { components, effects, events };
}

function contextFor(module: Module, node: AnyNode, model: SemanticContextModel): DirectDomContext {
	const fn = nearestFunction(module, node);
	if (fn === null) {
		return {
			ownership: { status: 'unknown', value: null, evidence: 'dom-target-not-established' },
			containingFunction: { status: 'unknown', value: null, evidence: 'module-scope' },
			component: { status: 'unknown', value: null, evidence: 'no-component-owner' },
			phase: {
				status: 'known',
				value: 'module' as const,
				evidence: 'no-containing-function',
			},
		};
	}
	const containingFunction = functionName(module, fn);
	let componentFact = model.components.get(fn) ?? null;
	let outer = outerFunction(module, fn);
	while (!componentFact && outer) {
		componentFact = model.components.get(outer) ?? null;
		outer = outerFunction(module, outer);
	}
	const eventOwner = model.events.get(fn);
	if (eventOwner) componentFact = eventOwner;
	const component = componentFact?.name ?? {
		status: 'unknown' as const,
		value: null,
		evidence: 'component-owner-not-established',
	};
	let phase: DirectDomSite['phase'];
	const ownComponent = model.components.get(fn);
	if (model.effects.has(fn))
		phase = { status: 'known', value: 'effect', evidence: 'resolved-react-effect-callback' };
	else if (model.events.has(fn) && model.events.get(fn) !== null)
		phase = { status: 'known', value: 'event', evidence: 'unique-resolved-jsx-event-handler' };
	else if (ownComponent?.kind === 'react-class-method' && containingFunction.value === 'render')
		phase = { status: 'known', value: 'render', evidence: 'render-method' };
	else if (
		ownComponent?.kind === 'react-class-method' &&
		containingFunction.value &&
		lifecycleNames.has(containingFunction.value)
	)
		phase = { status: 'known', value: 'lifecycle', evidence: 'react-lifecycle-method' };
	else if (ownComponent?.kind === 'function-component')
		phase = { status: 'known', value: 'render', evidence: 'resolved-jsx-function-component' };
	else phase = { status: 'unknown', value: 'unknown', evidence: 'phase-not-established' };
	return {
		ownership: { status: 'unknown', value: null, evidence: 'dom-target-not-established' },
		containingFunction,
		component,
		phase,
	};
}

function reactRefOwnership(
	module: Module,
	target: ExpressionNode | null,
	model: SemanticContextModel,
): DirectDomContextFact {
	if (!target) return { status: 'unknown', value: null, evidence: 'dom-target-not-established' };
	const value = unwrapExpression(target);
	if (value.type !== 'MemberExpression' || memberName(value) !== 'current')
		return { status: 'unknown', value: null, evidence: 'dom-target-not-established' };
	const object = unwrapExpression(value.object as ExpressionNode);
	if (object.type !== 'Identifier')
		return { status: 'unknown', value: null, evidence: 'dom-target-not-established' };
	const symbol = module.referenceOf(object)?.symbol;
	const initializer = symbol ? initializerOf(symbol) : null;
	if (!symbol || !initializer)
		return { status: 'unknown', value: null, evidence: 'dom-target-not-established' };
	const call = unwrapExpression(initializer);
	if (call.type !== 'CallExpression')
		return { status: 'unknown', value: null, evidence: 'dom-target-not-established' };
	const callee = unwrapExpression(call.callee as ExpressionNode);
	const resolvedRefFactory =
		isReactHook(symbol.module, callee, new Set(['useRef'])) ||
		(callee.type === 'MemberExpression' &&
			memberName(callee) === 'createRef' &&
			isReactValue(symbol.module, callee.object as ExpressionNode));
	if (!resolvedRefFactory)
		return { status: 'unknown', value: null, evidence: 'dom-target-not-established' };
	const owner = symbol.declarations
		.map((declaration) => nearestFunction(symbol.module, declaration))
		.find((candidate) => candidate !== null);
	return owner && model.components.has(owner)
		? { status: 'known', value: 'component-react-ref', evidence: 'resolved-react-ref-dataflow' }
		: { status: 'unknown', value: null, evidence: 'ref-component-owner-not-established' };
}

function isAssignmentWrite(module: Module, node: MemberNode): boolean {
	const parent = module.parentOf(node);
	return parent?.type === 'AssignmentExpression' && parent.left === node;
}

function compareSites(left: DirectDomSite, right: DirectDomSite): number {
	return (
		left.path.localeCompare(right.path) ||
		left.location.start - right.location.start ||
		left.category.localeCompare(right.category) ||
		left.member.localeCompare(right.member)
	);
}

function emptyCount<T extends string>(values: T[]): Record<T, number> {
	return Object.fromEntries(values.map((value) => [value, 0])) as Record<T, number>;
}

export function directDomInventoryDigest(inventory: DirectDomInventory): string {
	const copy = structuredClone(inventory);
	copy.integrity.canonicalDigest = '';
	return createHash('sha256').update(canonicalize(copy)).digest('hex');
}

export function analyzeDirectDomAccess(input: {
	id: string;
	files: ReadonlyArray<DirectDomInputFile>;
}): DirectDomInventory {
	if (!input.id) throw new Error('Direct DOM inventory id is required');
	const files = input.files
		.map((file) => ({ ...file, path: portablePath(file.path) }))
		.sort((left, right) => left.path.localeCompare(right.path));
	if (new Set(files.map((file) => file.path)).size !== files.length)
		throw new Error('Direct DOM inventory paths must be unique');
	for (const file of files) {
		if (!['.js', '.jsx', '.ts', '.tsx'].includes(extname(file.path)))
			throw new Error(`Unsupported direct DOM source extension: ${file.path}`);
	}
	const modulePaths = new Set(files.map((file) => file.path));
	const commonJsPaths = new Set<string>();
	const analyzer = new Analyzer({ resolve: yukuResolver(modulePaths, commonJsPaths) });
	const modules = files.map((file) =>
		analyzer.addFile(file.path, file.source, { lang: yukuLanguage(file.path) }),
	);
	for (const module of modules) {
		if (hasCommonJsExports(module)) commonJsPaths.add(module.path);
	}
	analyzer.link();
	const diagnostics = [
		...modules.flatMap((module) =>
			module.diagnostics.map((diagnostic) => ({ path: module.path, diagnostic })),
		),
		...analyzer.diagnostics,
	];
	if (diagnostics.length)
		throw new DirectDomAnalysisError('Refused: Yuku parser or link diagnostics', diagnostics);

	const sites: DirectDomSite[] = [];
	const windowGlobals: WindowGlobalSite[] = [];
	const contextModel = buildSemanticContextModel(modules);
	for (const [index, module] of modules.entries()) {
		const file = files[index]!;
		const origin = file.origin ?? classifyDirectDomOrigin(file.path);
		const add = (
			category: DirectDomCategory,
			member: string,
			node: AnyNode,
			ownership: DirectDomContextFact = {
				status: 'unknown',
				value: null,
				evidence: 'dom-target-not-established',
			},
		) => {
			const context = contextFor(module, node, contextModel);
			sites.push({
				category,
				member,
				path: file.path,
				location: location(module.source, node.start, node.end),
				origin,
				...context,
				ownership,
			});
		};
		module.walk({
			CallExpression(node) {
				const callee = unwrapExpression(node.callee as ExpressionNode);
				if (callee.type === 'MemberExpression') {
					const name = memberName(callee);
					if (
						name &&
						documentSelectors.has(name) &&
						isDocument(module, callee.object as ExpressionNode)
					)
						add('document-selector', name, node, {
							status: 'known',
							value: 'external-global-document',
							evidence: 'yuku-unresolved-global-document',
						});
					else if (
						name === 'findDOMNode' &&
						isReactDom(module, callee.object as ExpressionNode)
					)
						add(
							'reactdom-find-dom-node',
							name,
							node,
							reactRefOwnership(
								module,
								node.arguments[0]?.type === 'SpreadElement'
									? null
									: ((node.arguments[0] as ExpressionNode | undefined) ?? null),
								contextModel,
							),
						);
					else if (name && imperativeCalls.has(name))
						add(
							'imperative-node-call',
							name,
							node,
							reactRefOwnership(
								module,
								callee.object as ExpressionNode,
								contextModel,
							),
						);
					else if (name === 'getBoundingClientRect')
						add(
							'layout-read',
							name,
							node,
							reactRefOwnership(
								module,
								callee.object as ExpressionNode,
								contextModel,
							),
						);
				} else if (isNamedReactDomFind(module, callee))
					add(
						'reactdom-find-dom-node',
						'findDOMNode',
						node,
						reactRefOwnership(
							module,
							node.arguments[0]?.type === 'SpreadElement'
								? null
								: ((node.arguments[0] as ExpressionNode | undefined) ?? null),
							contextModel,
						),
					);
				else if (unresolved(module, callee, 'getComputedStyle'))
					add(
						'layout-read',
						'getComputedStyle',
						node,
						reactRefOwnership(
							module,
							node.arguments[0]?.type === 'SpreadElement'
								? null
								: ((node.arguments[0] as ExpressionNode | undefined) ?? null),
							contextModel,
						),
					);
			},
			MemberExpression(node) {
				const name = memberName(node);
				if (name && htmlWrites.has(name) && isAssignmentWrite(module, node))
					add(
						'html-write',
						name,
						node,
						reactRefOwnership(module, node.object as ExpressionNode, contextModel),
					);
				else if (name && layoutMembers.has(name))
					add(
						'layout-read',
						name,
						node,
						reactRefOwnership(module, node.object as ExpressionNode, contextModel),
					);
			},
		});
		for (const reference of module.unresolvedReferences) {
			if (reference.name === '$' || reference.name === 'jQuery')
				add('unresolved-jquery', reference.name, reference.node);
			if (reference.name === 'window') {
				windowGlobals.push({
					name: 'window',
					path: file.path,
					location: location(module.source, reference.node.start, reference.node.end),
					origin,
					context: contextFor(module, reference.node, contextModel),
				});
			}
		}
	}
	sites.sort(compareSites);
	windowGlobals.sort(
		(left, right) =>
			left.path.localeCompare(right.path) || left.location.start - right.location.start,
	);
	const byCategory = emptyCount(categories);
	const byOrigin = emptyCount(origins);
	const byPhase = emptyCount(phases);
	for (const site of sites) {
		byCategory[site.category] += 1;
		byOrigin[site.origin.kind] += 1;
		byPhase[site.phase.value] += 1;
	}
	const inventory: DirectDomInventory = {
		schemaVersion: 'versionless.direct-dom-inventory.v1',
		id: input.id,
		root: '.',
		semanticEngine: {
			parser: 'yuku-parser@0.7.0',
			analyzer: 'yuku-analyzer@0.7.0',
			files: files.length,
			diagnostics: 0,
		},
		sites,
		windowGlobals,
		counts: {
			total: sites.length,
			byCategory,
			byOrigin,
			byPhase,
			windowGlobals: windowGlobals.length,
			unknownOwnership: sites.filter((site) => site.ownership.status === 'unknown').length,
			unknownComponents: sites.filter((site) => site.component.status === 'unknown').length,
			unknownPhases: sites.filter((site) => site.phase.status === 'unknown').length,
		},
		diagnostics: [],
		locality: { offline: true, networkAttempts: 0, filesChanged: 0 },
		nonclaims: [
			'This inventory is one hidden-logic signal family, not exhaustive hack detection.',
			'Bundled-vendor counts are separated and are not component migration risk.',
			'Window globals are adjacent integration inventory, not direct-DOM violations.',
			'Unknown ownership or phase is preserved rather than inferred.',
			'Inventory does not establish migration success, support, compliance, or authenticity.',
		],
		integrity: { algorithm: 'sha256', canonicalDigest: '', authenticity: 'not-established' },
	};
	inventory.integrity.canonicalDigest = directDomInventoryDigest(inventory);
	return inventory;
}
