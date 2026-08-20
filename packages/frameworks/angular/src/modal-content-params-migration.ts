/**
 * The ng-zorro modal content-parameters migration.
 *
 * Version 16 of ng-zorro removed `nzComponentParams` from `ModalOptions` and
 * replaced it with `nzData`. The two names are not two spellings of one
 * mechanism, and that is the whole difficulty of this migration:
 *
 * - `nzComponentParams` was *assigned onto the content component instance*, so
 *   a content component received its parameters as ordinary (usually `@Input()`)
 *   fields and did nothing to ask for them.
 * - `nzData` is *provided to the content component's injector*, as
 *   `{ provide: NZ_MODAL_DATA, useValue: config.nzData }`. Nothing is ever
 *   assigned to the instance. A content component that does not inject the
 *   token receives nothing at all.
 *
 * A call-site-only rename therefore compiles clean and silently empties every
 * field the modal used to supply — the worst possible outcome, because the
 * type checker and the build both stay green while the feature stops working.
 * So this capability is deliberately cross-module: it rewrites the call site
 * *and* the content component together, or it rewrites neither.
 *
 * ```ts
 * modal.create({                          modal.create({
 *   nzContent: Content,                     nzContent: Content,
 *   nzComponentParams: { issue$: x }  ->    nzData: { issue$: x }
 * });                                     });
 *
 * class Content {                         class Content {
 *   ⁠@Input() issue$: Observable<J>;  ->     issue$: Observable<J> = inject(NZ_MODAL_DATA).issue$;
 * }                                       }
 * ```
 *
 * Everything rides resolved bindings. The modal service is found by resolving
 * the receiver's declared type to the class `ng-zorro-antd/modal` exports; the
 * content component is found by resolving the `nzContent` identifier to the
 * import it came from and then to the module that declares it; `@Input()` is
 * removed only when it resolves to `@angular/core`'s.
 *
 * Every refusal is all-or-nothing per modal call. If the content class, one of
 * its fields, or the injection rewrite cannot be fully resolved, the entire
 * call site is left whole and reported — including the case where the same
 * content class is also opened by a call that supplies no parameters at all,
 * because injecting a token that call never provides would trade a silent
 * emptying for a runtime throw.
 */

import { compareStrings } from './angular-target-cell.ts';
import {
	applySourceEdits,
	denotesExport,
	isFreeRootName,
	lineOf,
	namedSpecifiersOf,
	parseModule,
	plainProperties,
	readModuleImports,
	type AstNode,
	type ModuleImports,
	type PlainProperty,
	type SemanticModule,
	type SourceEdit,
} from './semantic-module.ts';

/** The package subpath the modal surface is published under. */
export const NG_ZORRO_MODAL_MODULE = 'ng-zorro-antd/modal';

/** The service whose options literal carries the removed option. */
export const MODAL_SERVICE_CLASS = 'NzModalService';

/** The methods of that service that take a `ModalOptions` literal. */
export const MODAL_OPTION_METHODS: readonly string[] = Object.freeze(['create', 'confirm']);

/** The removed option, and the option that replaced it. */
export const REMOVED_COMPONENT_PARAMS_OPTION = 'nzComponentParams';
export const MODAL_DATA_OPTION = 'nzData';

/** The option naming the content component, and the token v16 provides the data on. */
export const MODAL_CONTENT_OPTION = 'nzContent';
export const MODAL_DATA_TOKEN = 'NZ_MODAL_DATA';

export const ANGULAR_CORE_MODULE = '@angular/core';
export const ANGULAR_INJECT = 'inject';
export const ANGULAR_INPUT = 'Input';

export type ModuleFile = Readonly<{ path: string; source: string }>;

export type ModalContentParamsChange = Readonly<{
	kind: 'modal-content-params-option' | 'modal-content-data-injection';
	path: string;
	line: number;
	from: string;
	to: string;
}>;

export type MigratedModalModule = Readonly<{
	path: string;
	source: string;
	changed: boolean;
	changes: readonly ModalContentParamsChange[];
}>;

export type ModalContentParamsMigration = Readonly<{
	files: readonly MigratedModalModule[];
	unhandled: readonly string[];
}>;

/** How a module specifier written in application source reaches another module. */
export type ModuleResolution = Readonly<{
	/** tsconfig-style path aliases; targets are written against {@link baseUrl}. */
	paths?: Readonly<Record<string, readonly string[]>>;
	/** The directory the aliases are relative to, as the workspace writes it. */
	baseUrl?: string;
}>;

const MODULE_EXTENSIONS: readonly string[] = Object.freeze(['.ts', '.tsx', '.mts', '.js', '.mjs']);

function withoutExtension(path: string): string {
	for (const extension of MODULE_EXTENSIONS)
		if (path.endsWith(extension)) return path.slice(0, -extension.length);
	return path;
}

function normalizePath(path: string): string {
	const segments: string[] = [];
	for (const segment of path.split('/')) {
		if (segment === '' || segment === '.') continue;
		if (segment === '..') {
			segments.pop();
			continue;
		}
		segments.push(segment);
	}
	return segments.join('/');
}

function directoryOf(path: string): string {
	const slash = path.lastIndexOf('/');
	return slash < 0 ? '' : path.slice(0, slash);
}

/**
 * Resolve module specifiers written in application source to the modules the
 * migration was handed. Relative specifiers are resolved against the importing
 * file; everything else goes through the workspace's declared path aliases,
 * because a specifier this capability cannot place is a content component it
 * must not rewrite.
 */
function createResolver(
	modules: readonly ModuleFile[],
	resolution: ModuleResolution,
): (specifier: string, fromPath: string) => string | null {
	const index = new Map<string, string>();
	for (const module of modules) {
		const path = normalizePath(module.path);
		const stem = withoutExtension(path);
		if (!index.has(stem)) index.set(stem, module.path);
		if (stem.endsWith('/index')) {
			const directory = stem.slice(0, -'/index'.length);
			if (!index.has(directory)) index.set(directory, module.path);
		}
	}
	const base = normalizePath(resolution.baseUrl ?? '');
	const aliases = Object.entries(resolution.paths ?? {});
	return (specifier, fromPath) => {
		const candidates: string[] = [];
		if (specifier.startsWith('.'))
			candidates.push(normalizePath(`${directoryOf(normalizePath(fromPath))}/${specifier}`));
		else
			for (const [pattern, targets] of aliases) {
				const starIndex = pattern.indexOf('*');
				if (starIndex < 0) {
					if (pattern !== specifier) continue;
					for (const target of targets)
						candidates.push(normalizePath(`${base}/${target}`));
					continue;
				}
				const prefix = pattern.slice(0, starIndex);
				const suffix = pattern.slice(starIndex + 1);
				if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) continue;
				if (specifier.length < prefix.length + suffix.length) continue;
				const star = specifier.slice(prefix.length, specifier.length - suffix.length);
				for (const target of targets)
					candidates.push(normalizePath(`${base}/${target.split('*').join(star)}`));
			}
		for (const candidate of candidates) {
			const found = index.get(withoutExtension(candidate));
			if (found !== undefined) return found;
		}
		return null;
	};
}

function walkNodes(root: unknown, visit: (node: AstNode) => void): void {
	const seen = new Set<unknown>();
	const step = (value: unknown): void => {
		if (Array.isArray(value)) {
			for (const item of value as readonly unknown[]) step(item);
			return;
		}
		if (typeof value !== 'object' || value === null) return;
		if (seen.has(value)) return;
		seen.add(value);
		const record = value as Record<string, unknown>;
		if (typeof record['type'] === 'string') visit(value as AstNode);
		for (const [key, child] of Object.entries(record)) {
			if (key === 'parent') continue;
			step(child);
		}
	};
	step(root);
}

function enclosingClassBody(module: SemanticModule, node: AstNode): AstNode | null {
	let current: AstNode | null = module.parentOf(node);
	while (current !== null) {
		if (current.type === 'ClassBody') return current;
		current = module.parentOf(current);
	}
	return null;
}

/** The type reference an annotated declaration carries, when it has a plain one. */
function annotatedTypeName(node: AstNode): AstNode | null {
	const annotation = (node as { typeAnnotation?: AstNode }).typeAnnotation;
	if (annotation === undefined || annotation === null) return null;
	if (annotation.type !== 'TSTypeAnnotation') return null;
	const reference = annotation.typeAnnotation;
	if (reference.type !== 'TSTypeReference') return null;
	return reference.typeName.type === 'Identifier' ? reference.typeName : null;
}

/**
 * Whether a class member named `name` is declared to hold the modal service:
 * either through a type annotation naming the imported class, on a property or
 * on a constructor parameter property, or through an `inject()` initialiser
 * taking it.
 */
function classHoldsModalService(
	module: SemanticModule,
	classBody: AstNode,
	name: string,
	modal: ModuleImports,
	core: ModuleImports,
): boolean {
	if (classBody.type !== 'ClassBody') return false;
	const matchesType = (node: AstNode): boolean => {
		const typeName = annotatedTypeName(node);
		return typeName !== null && denotesExport(module, typeName, modal, MODAL_SERVICE_CLASS);
	};
	const matchesInject = (value: AstNode | null | undefined): boolean => {
		if (value === undefined || value === null || value.type !== 'CallExpression') return false;
		if (!denotesExport(module, value.callee, core, ANGULAR_INJECT)) return false;
		const first = value.arguments[0];
		return first !== undefined && denotesExport(module, first, modal, MODAL_SERVICE_CLASS);
	};
	for (const member of classBody.body) {
		if (member.type === 'PropertyDefinition') {
			if (member.computed || member.key.type !== 'Identifier' || member.key.name !== name)
				continue;
			if (matchesType(member) || matchesInject(member.value)) return true;
			continue;
		}
		if (member.type !== 'MethodDefinition' || member.kind !== 'constructor') continue;
		for (const parameter of member.value.params) {
			if (parameter.type !== 'TSParameterProperty') continue;
			const inner = parameter.parameter;
			if (inner.type !== 'Identifier' || inner.name !== name) continue;
			if (matchesType(inner)) return true;
		}
	}
	return false;
}

type CallSite = Readonly<{
	path: string;
	line: number;
	optionsLiteral: AstNode;
	properties: readonly PlainProperty[];
	content: PlainProperty;
	params: PlainProperty | null;
}>;

type ResolvedCall = Readonly<{
	site: CallSite;
	contentPath: string;
	contentClass: string;
	fields: readonly string[];
	params: PlainProperty;
}>;

/**
 * Every `NzModalService` call in one module whose options literal names a
 * content component. Calls that cannot be attributed to the service — a
 * receiver whose declared type this capability cannot resolve, an options
 * argument that is not a plain object literal — are reported rather than
 * guessed at, because a `nzComponentParams` left unrewritten is a build error
 * and a `nzComponentParams` rewritten on the wrong call is a silent one.
 */
function modalCallSites(
	path: string,
	source: string,
	module: SemanticModule,
	unhandled: string[],
): readonly CallSite[] {
	const modal = readModuleImports(module, NG_ZORRO_MODAL_MODULE);
	if (!modal.present) return Object.freeze([]);
	const core = readModuleImports(module, ANGULAR_CORE_MODULE);
	const sites: CallSite[] = [];
	walkNodes(module.ast, (node) => {
		if (node.type !== 'CallExpression') return;
		const callee = node.callee;
		if (callee.type !== 'MemberExpression' || callee.computed || callee.optional) return;
		if (callee.property.type !== 'Identifier') return;
		if (!MODAL_OPTION_METHODS.includes(callee.property.name)) return;
		const argument = node.arguments[0];
		if (argument === undefined) return;
		const properties = plainProperties(argument);
		if (properties === null) return;
		const content = properties.find((entry) => entry.name === MODAL_CONTENT_OPTION);
		const params = properties.find((entry) => entry.name === REMOVED_COMPONENT_PARAMS_OPTION);
		if (content === undefined && params === undefined) return;
		const line = lineOf(source, node.start);
		if (content === undefined) {
			unhandled.push(
				`${path} line ${line}: a call sets ${REMOVED_COMPONENT_PARAMS_OPTION} without naming a ` +
					`${MODAL_CONTENT_OPTION} component, so the component that received those ` +
					'parameters cannot be resolved; the call was left exactly as it is',
			);
			return;
		}
		const receiver = callee.object;
		const held =
			receiver.type === 'MemberExpression' &&
			!receiver.computed &&
			receiver.object.type === 'ThisExpression' &&
			receiver.property.type === 'Identifier'
				? (() => {
						const classBody = enclosingClassBody(module, node);
						return (
							classBody !== null &&
							receiver.property.type === 'Identifier' &&
							classHoldsModalService(
								module,
								classBody,
								receiver.property.name,
								modal,
								core,
							)
						);
					})()
				: false;
		if (!held) {
			if (params !== undefined)
				unhandled.push(
					`${path} line ${line}: a call setting ${REMOVED_COMPONENT_PARAMS_OPTION} has a ` +
						`receiver this capability cannot resolve to ${NG_ZORRO_MODAL_MODULE}'s ` +
						`${MODAL_SERVICE_CLASS}; the call was left exactly as it is`,
				);
			return;
		}
		sites.push(
			Object.freeze({
				path,
				line,
				optionsLiteral: argument,
				properties,
				content,
				params: params ?? null,
			}),
		);
	});
	return Object.freeze(sites);
}

type ContentPlan = Readonly<{ path: string; className: string; fields: readonly string[] }>;

function planKey(path: string, className: string): string {
	return `${path}#${className}`;
}

/** The class declaration `name` names at the top level of a module. */
function exportedClass(module: SemanticModule, name: string): AstNode | null {
	for (const statement of module.ast.body as readonly AstNode[]) {
		const declaration =
			statement.type === 'ExportNamedDeclaration' ||
			statement.type === 'ExportDefaultDeclaration'
				? statement.declaration
				: statement;
		if (declaration === null || declaration === undefined) continue;
		if (declaration.type !== 'ClassDeclaration') continue;
		if (
			declaration.id !== null &&
			declaration.id.type === 'Identifier' &&
			declaration.id.name === name
		)
			return declaration;
	}
	return null;
}

type NameBinding = Readonly<{ reference: string; edits: readonly SourceEdit[] }>;

/**
 * How a module will name an import it may not already have. An existing named
 * import is reused; a module that already binds the name to something else
 * yields null and the caller refuses, because shadowing a name the application
 * chose is not a migration.
 */
function bindImport(
	module: SemanticModule,
	source: string,
	imports: ModuleImports,
	specifier: string,
	exportName: string,
): NameBinding | null {
	const existing = imports.named.get(exportName);
	if (existing !== undefined) return Object.freeze({ reference: existing.name, edits: [] });
	if (!isFreeRootName(module, exportName)) return null;
	for (const declaration of imports.declarations) {
		const specifiers = namedSpecifiersOf(declaration);
		const last = specifiers[specifiers.length - 1];
		if (last === undefined) continue;
		return Object.freeze({
			reference: exportName,
			edits: Object.freeze([{ start: last.end, end: last.end, text: `, ${exportName}` }]),
		});
	}
	let insertAt = 0;
	for (const statement of module.ast.body as readonly AstNode[])
		if (statement.type === 'ImportDeclaration') insertAt = statement.end;
	if (insertAt === 0) return null;
	while (source[insertAt] === ' ' || source[insertAt] === '\t') insertAt += 1;
	if (source[insertAt] === '\r') insertAt += 1;
	if (source[insertAt] === '\n') insertAt += 1;
	return Object.freeze({
		reference: exportName,
		edits: Object.freeze([
			{
				start: insertAt,
				end: insertAt,
				text: `import { ${exportName} } from '${specifier}';\n`,
			},
		]),
	});
}

type ContentRewrite = Readonly<{
	edits: readonly SourceEdit[];
	changes: readonly ModalContentParamsChange[];
}>;

/**
 * Rewrite one content component to inject exactly the fields the modal
 * supplied. Returns null, with the reason appended, when any part of it cannot
 * be resolved; the caller then leaves every call site that named this component
 * whole.
 */
function rewriteContentComponent(
	plan: ContentPlan,
	source: string,
	module: SemanticModule,
	refuse: (reason: string) => void,
): ContentRewrite | null {
	const classNode = exportedClass(module, plan.className);
	if (classNode === null || classNode.type !== 'ClassDeclaration') {
		refuse(`${plan.path} declares no class ${plan.className} this capability can rewrite`);
		return null;
	}
	const core = readModuleImports(module, ANGULAR_CORE_MODULE);
	const modal = readModuleImports(module, NG_ZORRO_MODAL_MODULE);
	const injectBinding = bindImport(module, source, core, ANGULAR_CORE_MODULE, ANGULAR_INJECT);
	if (injectBinding === null) {
		refuse(
			`${plan.path} cannot name ${ANGULAR_CORE_MODULE}'s ${ANGULAR_INJECT}: the name is already ` +
				'bound to something else, or the module declares no imports to add it to',
		);
		return null;
	}
	const tokenBinding = bindImport(module, source, modal, NG_ZORRO_MODAL_MODULE, MODAL_DATA_TOKEN);
	if (tokenBinding === null) {
		refuse(
			`${plan.path} cannot name ${NG_ZORRO_MODAL_MODULE}'s ${MODAL_DATA_TOKEN}: the name is ` +
				'already bound to something else, or the module declares no imports to add it to',
		);
		return null;
	}
	const edits: SourceEdit[] = [];
	const changes: ModalContentParamsChange[] = [];
	for (const field of plan.fields) {
		let member: AstNode | null = null;
		for (const entry of classNode.body.body) {
			if (entry.type !== 'PropertyDefinition' || entry.computed) continue;
			if (entry.key.type !== 'Identifier' || entry.key.name !== field) continue;
			member = entry;
		}
		if (member === null || member.type !== 'PropertyDefinition') {
			refuse(
				`${plan.path}: ${plan.className} declares no field ${field}, which a modal supplied ` +
					`through ${REMOVED_COMPONENT_PARAMS_OPTION}`,
			);
			return null;
		}
		if (member.static) {
			refuse(
				`${plan.path}: ${plan.className}.${field} is static, so a modal cannot supply it`,
			);
			return null;
		}
		for (const decorator of member.decorators ?? []) {
			const expression = decorator.expression;
			const callee = expression.type === 'CallExpression' ? expression.callee : expression;
			if (denotesExport(module, callee, core, ANGULAR_INPUT)) continue;
			refuse(
				`${plan.path}: ${plan.className}.${field} carries a decorator other than ` +
					`${ANGULAR_CORE_MODULE}'s ${ANGULAR_INPUT}, whose meaning under injector-provided ` +
					'data this capability cannot establish',
			);
			return null;
		}
		const injection = `${injectBinding.reference}(${tokenBinding.reference}).${field}`;
		const decorators = member.decorators ?? [];
		const firstDecorator = decorators[0];
		if (firstDecorator !== undefined)
			edits.push({ start: firstDecorator.start, end: member.key.start, text: '' });
		if (member.value !== null && member.value !== undefined)
			edits.push({ start: member.value.start, end: member.value.end, text: injection });
		else {
			const annotation = (member as { typeAnnotation?: AstNode }).typeAnnotation;
			const at =
				annotation === undefined || annotation === null ? member.key.end : annotation.end;
			edits.push({ start: at, end: at, text: ` = ${injection}` });
		}
		changes.push({
			kind: 'modal-content-data-injection',
			path: plan.path,
			line: lineOf(source, firstDecorator?.start ?? member.start),
			from: `${decorators.length > 0 ? `@${ANGULAR_INPUT}() ` : ''}${field}`,
			to: `${field} = ${injection}`,
		});
	}
	edits.push(...injectBinding.edits, ...tokenBinding.edits);
	return Object.freeze({ edits: Object.freeze(edits), changes: Object.freeze(changes) });
}

/**
 * Migrate every modal content-parameter call in a tree, together with the
 * content components those calls supplied.
 *
 * A tree with no `nzComponentParams` is returned byte-identical. A module that
 * does not parse is a hard failure naming the file, never a silent skip.
 */
export function migrateModalContentParams(
	modules: readonly ModuleFile[],
	resolution: ModuleResolution = {},
): ModalContentParamsMigration {
	const relevant = modules.filter((module) => module.source.includes(MODAL_CONTENT_OPTION));
	if (relevant.length === 0)
		return Object.freeze({
			files: Object.freeze(
				modules.map((module) =>
					Object.freeze({
						path: module.path,
						source: module.source,
						changed: false,
						changes: Object.freeze([]),
					}),
				),
			),
			unhandled: Object.freeze([]),
		});
	const unhandled: string[] = [];
	const parsed = new Map<string, SemanticModule>();
	const sourceOf = new Map<string, string>();
	for (const module of modules) sourceOf.set(module.path, module.source);
	const moduleOf = (path: string): SemanticModule | null => {
		const cached = parsed.get(path);
		if (cached !== undefined) return cached;
		const source = sourceOf.get(path);
		if (source === undefined) return null;
		const analyzed = parseModule('Modal content-params migration', path, source);
		parsed.set(path, analyzed);
		return analyzed;
	};
	const resolve = createResolver(modules, resolution);
	const sites: CallSite[] = [];
	for (const module of relevant) {
		const analyzed = moduleOf(module.path);
		if (analyzed === null) continue;
		sites.push(...modalCallSites(module.path, module.source, analyzed, unhandled));
	}
	/**
	 * Every content class the tree opens, and whether any call opens it without
	 * supplying parameters. A class opened both ways cannot be rewritten: the
	 * paramless call provides no `nzData`, so an injected field would resolve to
	 * a read of `undefined` at runtime.
	 */
	const paramlessClasses = new Set<string>();
	const resolvedCalls: ResolvedCall[] = [];
	for (const site of sites) {
		const analyzed = moduleOf(site.path);
		if (analyzed === null) continue;
		const contentValue = site.content.value;
		const refuseSite = (reason: string): void => {
			unhandled.push(
				`${site.path} line ${site.line}: ${reason}; the whole modal call was left exactly as it is`,
			);
		};
		if (contentValue.type !== 'Identifier') {
			if (site.params !== null)
				refuseSite(
					`its ${MODAL_CONTENT_OPTION} is not a component identifier, so the class that ` +
						`received ${REMOVED_COMPONENT_PARAMS_OPTION} cannot be resolved`,
				);
			continue;
		}
		const symbol = analyzed.symbolOf(contentValue);
		const record = analyzed.imports.find((entry) => entry.local === symbol);
		if (symbol === null || record === undefined) {
			if (site.params !== null)
				refuseSite(
					`its ${MODAL_CONTENT_OPTION} component ${contentValue.name} is not an imported ` +
						'binding, so its declaring file cannot be resolved',
				);
			continue;
		}
		const contentPath = resolve(record.specifier, site.path);
		if (contentPath === null) {
			if (site.params !== null)
				refuseSite(
					`its ${MODAL_CONTENT_OPTION} component ${contentValue.name} is imported from ` +
						`${record.specifier}, which does not resolve to a module this migration was handed`,
				);
			continue;
		}
		const contentClass = record.name ?? contentValue.name;
		if (site.params === null) {
			paramlessClasses.add(planKey(contentPath, contentClass));
			continue;
		}
		if (site.properties.some((entry) => entry.name === MODAL_DATA_OPTION)) {
			refuseSite(
				`it already declares ${MODAL_DATA_OPTION} beside ${REMOVED_COMPONENT_PARAMS_OPTION}, ` +
					'and this capability will not overwrite a value the application chose',
			);
			continue;
		}
		const fields = plainProperties(site.params.value);
		if (fields === null) {
			refuseSite(
				`its ${REMOVED_COMPONENT_PARAMS_OPTION} is not a plain object literal, so which fields ` +
					'it supplies cannot be established',
			);
			continue;
		}
		resolvedCalls.push(
			Object.freeze({
				site,
				contentPath,
				contentClass,
				fields: Object.freeze(fields.map((entry) => entry.name).sort(compareStrings)),
				params: site.params,
			}),
		);
	}
	/**
	 * Two calls supplying different field sets to one content class cannot both
	 * be honoured: the component would inject a field one of them never supplies.
	 * Both are refused and left whole.
	 */
	const byClass = new Map<string, ResolvedCall[]>();
	for (const call of resolvedCalls) {
		const key = planKey(call.contentPath, call.contentClass);
		byClass.set(key, [...(byClass.get(key) ?? []), call]);
	}
	const accepted: ResolvedCall[] = [];
	const plans = new Map<string, ContentPlan>();
	for (const [key, calls] of byClass) {
		const first = calls[0] as ResolvedCall;
		const signature = first.fields.join(',');
		if (calls.some((call) => call.fields.join(',') !== signature)) {
			for (const call of calls)
				unhandled.push(
					`${call.site.path} line ${call.site.line}: ${call.contentClass} is opened by calls ` +
						`supplying different ${REMOVED_COMPONENT_PARAMS_OPTION} field sets, and one ` +
						`component cannot inject fields every call does not provide; every one of those ` +
						'calls was left exactly as it is',
				);
			continue;
		}
		if (paramlessClasses.has(key)) {
			for (const call of calls)
				unhandled.push(
					`${call.site.path} line ${call.site.line}: ${call.contentClass} is also opened by a ` +
						`call supplying no ${REMOVED_COMPONENT_PARAMS_OPTION}, which would provide no ` +
						`${MODAL_DATA_TOKEN} for the injected fields to read; the call was left exactly ` +
						'as it is',
				);
			continue;
		}
		plans.set(
			key,
			Object.freeze({
				path: first.contentPath,
				className: first.contentClass,
				fields: first.fields,
			}),
		);
		accepted.push(...calls);
	}
	const editsByPath = new Map<string, SourceEdit[]>();
	const changesByPath = new Map<string, ModalContentParamsChange[]>();
	const push = (
		path: string,
		edits: readonly SourceEdit[],
		changes: readonly ModalContentParamsChange[],
	): void => {
		editsByPath.set(path, [...(editsByPath.get(path) ?? []), ...edits]);
		changesByPath.set(path, [...(changesByPath.get(path) ?? []), ...changes]);
	};
	const rewritten = new Set<string>();
	for (const [key, plan] of plans) {
		const analyzed = moduleOf(plan.path);
		const source = sourceOf.get(plan.path);
		if (analyzed === null || source === undefined) continue;
		const refused: string[] = [];
		const rewrite = rewriteContentComponent(plan, source, analyzed, (reason) =>
			refused.push(reason),
		);
		if (rewrite === null) {
			for (const call of accepted.filter(
				(entry) => planKey(entry.contentPath, entry.contentClass) === key,
			))
				for (const reason of refused)
					unhandled.push(
						`${call.site.path} line ${call.site.line}: ${reason}; the whole modal call was ` +
							'left exactly as it is',
					);
			continue;
		}
		rewritten.add(key);
		push(plan.path, rewrite.edits, rewrite.changes);
	}
	for (const call of accepted) {
		if (!rewritten.has(planKey(call.contentPath, call.contentClass))) continue;
		const property = call.params.node;
		if (property.type !== 'Property') continue;
		const key = property.key;
		push(
			call.site.path,
			[{ start: key.start, end: key.end, text: MODAL_DATA_OPTION }],
			[
				{
					kind: 'modal-content-params-option',
					path: call.site.path,
					line: lineOf(sourceOf.get(call.site.path) ?? '', key.start),
					from: `${REMOVED_COMPONENT_PARAMS_OPTION}: { ${call.fields.join(', ')} }`,
					to: `${MODAL_DATA_OPTION}: { ${call.fields.join(', ')} }`,
				},
			],
		);
	}
	const files = modules.map((module) => {
		const edits = editsByPath.get(module.path) ?? [];
		const migrated =
			edits.length === 0 ? module.source : applySourceEdits(module.source, edits);
		const changes = [...(changesByPath.get(module.path) ?? [])].sort(
			(left, right) => left.line - right.line || compareStrings(left.from, right.from),
		);
		return Object.freeze({
			path: module.path,
			source: migrated,
			changed: migrated !== module.source,
			changes: Object.freeze(changes),
		});
	});
	return Object.freeze({
		files: Object.freeze(files),
		unhandled: Object.freeze([...new Set(unhandled)].sort(compareStrings)),
	});
}
