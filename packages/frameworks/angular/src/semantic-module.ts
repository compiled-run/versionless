/**
 * The parsed-module vocabulary the source capabilities share.
 *
 * Every capability in this adapter that rewrites application source rides a
 * resolved binding rather than a name: the question is never "is there an
 * identifier spelled `Input` here", it is "does this identifier resolve to the
 * symbol `@angular/core` exported as `Input`". The helpers here are the small
 * set of operations that question decomposes into, kept in one place so that
 * two capabilities cannot disagree about what an import surface is.
 *
 * Nothing here is Angular specific and nothing here is application specific.
 */

import { analyze } from 'yuku-analyzer';

export type SemanticModule = ReturnType<typeof analyze>;
export type AstNode = NonNullable<ReturnType<SemanticModule['parentOf']>>;
export type ImportRecord = SemanticModule['imports'][number];
export type BindingSymbol = NonNullable<ImportRecord['local']>;

/** A replacement of one source span. Spans handed to {@link applySourceEdits} must not overlap. */
export type SourceEdit = Readonly<{ start: number; end: number; text: string }>;

/**
 * Parse one module, or fail naming the file.
 *
 * A module that does not parse is never skipped. A skipped file is counted as
 * unchanged, and the whole value of a changeset is that a file reported
 * unchanged really was unchanged.
 */
export function parseModule(capability: string, path: string, source: string): SemanticModule {
	const module = analyze(source, { path, lang: path.endsWith('.ts') ? 'ts' : 'js' });
	const errors = module.diagnostics.filter((entry) => entry.severity === 'error');
	if (errors.length > 0)
		throw new Error(
			`${capability}: ${path} does not parse, so it cannot be rewritten and it cannot be ` +
				`honestly counted as unchanged. Diagnostics: ` +
				errors.map((entry) => entry.message).join('; '),
		);
	return module;
}

/** The 1-based line `offset` sits on. */
export function lineOf(source: string, offset: number): number {
	return source.slice(0, offset).split('\n').length;
}

/** Apply non-overlapping edits to a string, rightmost first. */
export function applySourceEdits(text: string, edits: readonly SourceEdit[]): string {
	let result = text;
	for (const edit of [...edits].sort((left, right) => right.start - left.start))
		result = `${result.slice(0, edit.start)}${edit.text}${result.slice(edit.end)}`;
	return result;
}

/**
 * One module's import surface for a single package specifier: the namespace
 * binding if it has one, the named bindings by exported name, and the
 * declarations they came from. A default binding is recorded only as `wide`,
 * because a member reached through one cannot be resolved by name.
 */
export type ModuleImports = Readonly<{
	present: boolean;
	namespace: BindingSymbol | null;
	named: ReadonlyMap<string, BindingSymbol>;
	declarations: readonly AstNode[];
	wide: boolean;
}>;

export function readModuleImports(module: SemanticModule, specifier: string): ModuleImports {
	const named = new Map<string, BindingSymbol>();
	const declarations: AstNode[] = [];
	let namespace: BindingSymbol | null = null;
	let present = false;
	let wide = false;
	for (const record of module.imports) {
		if (record.specifier !== specifier) continue;
		present = true;
		const declaration = importDeclarationOf(module, record.node);
		if (declaration !== null && !declarations.includes(declaration))
			declarations.push(declaration);
		const local = record.local;
		if (local === null) continue;
		if (record.isNamespace) {
			namespace ??= local;
			wide = true;
			continue;
		}
		if (record.name === null || record.name === 'default') {
			wide = true;
			continue;
		}
		if (!named.has(record.name)) named.set(record.name, local);
	}
	return Object.freeze({
		present,
		namespace,
		named,
		declarations: Object.freeze(declarations),
		wide,
	});
}

export function importDeclarationOf(module: SemanticModule, node: AstNode): AstNode | null {
	let current: AstNode | null = node;
	while (current !== null) {
		if (current.type === 'ImportDeclaration') return current;
		current = module.parentOf(current);
	}
	return null;
}

export function namedSpecifiersOf(declaration: AstNode): readonly AstNode[] {
	if (declaration.type !== 'ImportDeclaration') return [];
	return declaration.specifiers.filter((specifier) => specifier.type === 'ImportSpecifier');
}

/** Whether the module's root scope leaves `name` free for a capability to bind. */
export function isFreeRootName(module: SemanticModule, name: string): boolean {
	return module.rootScope.find(name) === null;
}

/**
 * Visit every node of a parsed subtree, once each.
 *
 * The estree shapes the analyzer produces are plain objects whose children are
 * nodes or arrays of nodes, so a structural walk reaches all of them without
 * enumerating the grammar. `parent` links are skipped so the walk terminates on
 * a graph the analyzer may have made cyclic, and a node is visited once even if
 * two fields reference it.
 */
export function forEachNode(root: unknown, visit: (node: AstNode) => void): void {
	const seen = new Set<object>();
	const step = (value: unknown): void => {
		if (Array.isArray(value)) {
			for (const entry of value as readonly unknown[]) step(entry);
			return;
		}
		if (typeof value !== 'object' || value === null) return;
		const record = value as Record<string, unknown>;
		if (typeof record['type'] !== 'string') return;
		if (seen.has(record)) return;
		seen.add(record);
		visit(record as unknown as AstNode);
		for (const key of Object.keys(record)) {
			if (key === 'parent' || key === 'loc' || key === 'range') continue;
			step(record[key]);
		}
	};
	step(root);
}

/** The 0-based offset of a 1-based line and column, as a compiler reports them. */
export function offsetOfPosition(source: string, line: number, column: number): number | null {
	const lines = source.split('\n');
	if (line < 1 || line > lines.length) return null;
	let offset = 0;
	for (let index = 0; index < line - 1; index += 1) offset += (lines[index]?.length ?? 0) + 1;
	const text = lines[line - 1] ?? '';
	if (column < 1 || column > text.length + 1) return null;
	return offset + column - 1;
}

export type PlainProperty = Readonly<{ node: AstNode; name: string; value: AstNode }>;

/**
 * The properties of an object literal, when every one of them is a plain,
 * statically named, non-computed data property. A literal carrying a spread, a
 * computed key, a method, or an accessor returns null: a capability that reads
 * one of these decides both what the literal contains and what it does not
 * contain, and neither question can be answered over a shape like that.
 */
export function plainProperties(object: AstNode): readonly PlainProperty[] | null {
	if (object.type !== 'ObjectExpression') return null;
	const properties: PlainProperty[] = [];
	for (const property of object.properties) {
		if (property.type !== 'Property') return null;
		if (property.kind !== 'init' || property.computed || property.method) return null;
		const key = property.key;
		const name =
			key.type === 'Identifier'
				? key.name
				: key.type === 'Literal' && typeof key.value === 'string'
					? key.value
					: null;
		if (name === null) return null;
		properties.push(Object.freeze({ node: property, name, value: property.value }));
	}
	return Object.freeze(properties);
}

/**
 * Whether `node` denotes `exportName` of `imports`: either the local of a named
 * import of it, or a static member of its namespace binding. Any other
 * expression — a member of some other object, a computed access, a locally
 * defined value of the same name — is not, and the caller refuses rather than
 * guesses.
 */
export function denotesExport(
	module: SemanticModule,
	node: AstNode,
	imports: ModuleImports,
	exportName: string,
): boolean {
	if (node.type === 'Identifier') {
		const expected = imports.named.get(exportName);
		return expected !== undefined && module.symbolOf(node) === expected;
	}
	if (node.type !== 'MemberExpression' || node.computed || node.optional) return false;
	const { object, property } = node;
	if (property.type !== 'Identifier' || property.name !== exportName) return false;
	if (object.type !== 'Identifier' || imports.namespace === null) return false;
	return module.symbolOf(object) === imports.namespace;
}
