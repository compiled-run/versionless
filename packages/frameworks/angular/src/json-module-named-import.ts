/**
 * A named import of a JSON module, which TypeScript accepts and the bundler
 * refuses.
 *
 * `resolveJsonModule` types a `.json` file as an object literal type and lets
 * every top-level key be imported by name, so `import {version} from './package.json'`
 * type-checks. What the type checker permits, the module graph does not:
 * webpack 5 treats a JSON module as having one export — the default — and
 * reports `Should not import the named export 'version' … from default-exporting
 * module` at the module-graph layer, after the program has compiled. The two
 * layers disagree, and the era's builder never surfaced the disagreement because
 * its loader synthesised the named bindings.
 *
 * The successor shape is not a choice. A JSON module has exactly one export
 * shape, so the named binding is a property of the default export and nothing
 * else: take the default, then bind the same names off it. The rewrite therefore
 * touches the import declaration and adds one destructuring statement beside it,
 * and every use site in the file keeps the identifier it already had.
 *
 * Every binding is checked against the resolved JSON before anything is written.
 * The caller supplies the parsed module — the one reading this capability cannot
 * make for itself — so a name the JSON does not carry is refused by name rather
 * than rewritten into a property read of `undefined`.
 */

import { charIn, charNotIn, createRegExp, exactly, global, maybe, oneOrMore } from 'magic-regexp';
import { applySourceEdits, lineOf, type SourceEdit } from './semantic-module.ts';

/** One `{name}` or `{name as local}` in the import clause. */
export type JsonNamedBinding = Readonly<{ exported: string; local: string }>;

export type JsonNamedImportChange = Readonly<{
	kind: 'json-module-named-import';
	line: number;
	specifier: string;
	/** The local the default export was bound to. */
	defaultLocal: string;
	bindings: readonly JsonNamedBinding[];
}>;

export type JsonNamedImportMigration = Readonly<{
	path: string;
	source: string;
	changed: boolean;
	changes: readonly JsonNamedImportChange[];
	unhandled: readonly string[];
}>;

/**
 * The question this capability asks of the closure: what does this specifier's
 * JSON module actually declare at its top level, or null when the caller could
 * not resolve or parse it.
 */
export type JsonModuleReading = (specifier: string) => Readonly<Record<string, unknown>> | null;

const JSON_NAMED_IMPORT = createRegExp(
	exactly('import')
		.and(oneOrMore(charIn(' \t\n')))
		.and(exactly('{'))
		.and(oneOrMore(charNotIn('}')).as('clause'))
		.and(exactly('}'))
		.and(oneOrMore(charIn(' \t\n')))
		.and(exactly('from'))
		.and(oneOrMore(charIn(' \t\n')))
		.and(charIn('\'"'))
		.and(oneOrMore(charNotIn('\'"\n')).as('specifier'))
		.and(charIn('\'"'))
		.and(maybe(exactly(';'))),
	[global],
);

/** Parse an import clause's bindings, or null when it carries something else. */
export function readNamedBindings(clause: string): readonly JsonNamedBinding[] | null {
	const bindings: JsonNamedBinding[] = [];
	for (const raw of clause.split(',')) {
		const part = raw.trim();
		if (part === '') continue;
		const words = part.split(/\s+/u);
		if (words.length === 1) {
			const only = words[0] ?? '';
			if (!/^[A-Za-z_$][\w$]*$/u.test(only)) return null;
			bindings.push(Object.freeze({ exported: only, local: only }));
			continue;
		}
		if (words.length === 3 && words[1] === 'as') {
			const exported = words[0] ?? '';
			const local = words[2] ?? '';
			if (!/^[A-Za-z_$][\w$]*$/u.test(exported) || !/^[A-Za-z_$][\w$]*$/u.test(local)) return null;
			bindings.push(Object.freeze({ exported, local }));
			continue;
		}
		return null;
	}
	return bindings.length === 0 ? null : Object.freeze(bindings);
}

/** Is `specifier` a request for a JSON module, by the only thing that says so — its extension. */
export function isJsonSpecifier(specifier: string): boolean {
	return specifier.endsWith('.json');
}

/**
 * The local name to bind the default export to: the module's own file name in
 * camel case, suffixed until it collides with nothing the file already writes.
 *
 * The extension is folded into the name rather than stripped, which is what
 * makes `package.json` read as `packageJson`. That is also the safe choice:
 * `package` on its own is a reserved word in strict mode, and a stem that
 * happens to be one is not a binding a module can declare.
 */
export function defaultLocalFor(specifier: string, taken: ReadonlySet<string>): string {
	const stem = specifier.split('/').pop() ?? 'json';
	const camel = stem
		.split(/[^A-Za-z0-9]+/u)
		.filter((part) => part !== '')
		.map((part, index) => (index === 0 ? part : `${part.charAt(0).toUpperCase()}${part.slice(1)}`))
		.join('');
	const base = /^[A-Za-z_$]/u.test(camel) ? camel : `json${camel}`;
	let candidate = base;
	let suffix = 2;
	while (taken.has(candidate)) {
		candidate = `${base}${String(suffix)}`;
		suffix += 1;
	}
	return candidate;
}

/** Every identifier-shaped word in a module, which is a superset of its bindings. */
function wordsIn(source: string): Set<string> {
	return new Set(source.match(/[A-Za-z_$][\w$]*/gu) ?? []);
}

/**
 * Rewrite each named import of a JSON module into a default import and a
 * destructuring of it.
 *
 * A declaration is rewritten only when the specifier names a `.json` module, the
 * caller's reading resolves and parses it, the clause carries nothing but plain
 * named bindings, and every one of those names is a top-level key of the parsed
 * JSON. Anything else is refused by name: a type-only clause, a default or
 * namespace binding beside the names, a key the JSON does not carry.
 */
export function rewriteJsonNamedImports(
	path: string,
	source: string,
	reading: JsonModuleReading,
): JsonNamedImportMigration {
	const taken = wordsIn(source);
	const edits: SourceEdit[] = [];
	const changes: JsonNamedImportChange[] = [];
	const unhandled: string[] = [];
	for (const match of source.matchAll(JSON_NAMED_IMPORT)) {
		const clause = match.groups?.['clause'];
		const specifier = match.groups?.['specifier'];
		const offset = match.index;
		if (clause === undefined || specifier === undefined || offset === undefined) continue;
		if (!isJsonSpecifier(specifier)) continue;
		const line = lineOf(source, offset);
		if (clause.includes('type ')) {
			unhandled.push(
				`${path} line ${String(line)}: the clause importing '${specifier}' carries a type-only ` +
					'binding. A type-only import is erased before the module graph sees it, so the bundler ' +
					'never objected to it and there is nothing here to answer.',
			);
			continue;
		}
		const bindings = readNamedBindings(clause);
		if (bindings === null) {
			unhandled.push(
				`${path} line ${String(line)}: the clause importing '${specifier}' is not a list of plain ` +
					'named bindings, so this reader did not measure what it binds and nothing was written.',
			);
			continue;
		}
		const parsed = reading(specifier);
		if (parsed === null) {
			unhandled.push(
				`${path} line ${String(line)}: '${specifier}' did not resolve to a JSON module this reading ` +
					'could parse. The successor shape depends on what the module declares, so nothing was written.',
			);
			continue;
		}
		const missing = bindings.filter((binding) => !Object.hasOwn(parsed, binding.exported));
		if (missing.length > 0) {
			unhandled.push(
				`${path} line ${String(line)}: '${specifier}' declares no top-level ` +
					`${missing.map((binding) => `'${binding.exported}'`).join(', ')}. Binding a key the JSON ` +
					'does not carry off the default export would read undefined, so nothing was written.',
			);
			continue;
		}
		const defaultLocal = defaultLocalFor(specifier, taken);
		taken.add(defaultLocal);
		const declaration = match[0] ?? '';
		const quote = declaration.includes(`'${specifier}'`) ? "'" : '"';
		const clauseText = bindings
			.map((binding) =>
				binding.exported === binding.local ? binding.local : `${binding.exported}: ${binding.local}`,
			)
			.join(', ');
		edits.push({
			start: offset,
			end: offset + declaration.length,
			text:
				`import ${defaultLocal} from ${quote}${specifier}${quote};\n` +
				`const { ${clauseText} } = ${defaultLocal};`,
		});
		changes.push({
			kind: 'json-module-named-import',
			line,
			specifier,
			defaultLocal,
			bindings,
		});
	}
	const migrated = applySourceEdits(source, edits);
	return Object.freeze({
		path,
		source: migrated,
		changed: migrated !== source,
		changes: Object.freeze(changes),
		unhandled: Object.freeze(unhandled),
	});
}
