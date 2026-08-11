/**
 * Application source migration for an Angular CLI era workspace.
 *
 * Two shapes are handled, both of them defined by Angular and its runtime
 * dependencies rather than by any application:
 *
 * - Deep `zone.js/dist/*` specifiers. zone.js 0.11 replaced the `dist`
 *   directory layout the Angular CLI's generated `polyfills.ts` and `test.ts`
 *   import from with package entry points, so a workspace generated before it
 *   names files that no longer exist on a modern line and fails to resolve.
 * - Testing symbols `@angular/core/testing` renamed and then removed, of which
 *   `async` — renamed to `waitForAsync` because it collided with the
 *   ECMAScript keyword — is the one this table carries.
 *
 * Every rewrite rides the parsed module rather than the text: only the source
 * literal of an `import`/`export … from` declaration is edited, so a matching
 * string inside a comment, a template, or an ordinary expression is left
 * exactly where it is. A commented-out `import 'zone.js/dist/zone-error'` — a
 * line the Angular CLI itself generates into `src/environments/environment.ts`
 * — is therefore not touched, which a textual substitution would get wrong.
 */

import { analyze } from 'yuku-analyzer';
import { compareStrings } from './angular-target-cell.ts';

/**
 * zone.js's package entry points, keyed by the `dist` path they replaced. The
 * bundle files under `dist` were the public surface before 0.11; afterwards the
 * same code is reachable only through these specifiers.
 */
export const ZONE_JS_SPECIFIER_REPLACEMENTS: Readonly<Record<string, string>> = Object.freeze({
	'zone.js/dist/long-stack-trace-zone': 'zone.js/plugins/long-stack-trace-zone',
	'zone.js/dist/task-tracking': 'zone.js/plugins/task-tracking',
	'zone.js/dist/webapis-media-query': 'zone.js/plugins/webapis-media-query',
	'zone.js/dist/zone': 'zone.js',
	'zone.js/dist/zone-error': 'zone.js/plugins/zone-error',
	'zone.js/dist/zone-patch-rxjs': 'zone.js/plugins/zone-patch-rxjs',
	'zone.js/dist/zone-testing': 'zone.js/testing',
});

/**
 * Renamed exports, keyed by module specifier and then by the removed export
 * name. The rewrite keeps the local binding name the module already uses
 * (`import { waitForAsync as async }`), so no call site changes and no scope
 * analysis is required to be correct. It does not modernise call-site naming:
 * a module that used `async(...)` still reads `async(...)` afterwards, and this
 * capability claims nothing more than that the removed export is no longer
 * requested.
 */
export const RENAMED_MODULE_EXPORTS: Readonly<Record<string, Readonly<Record<string, string>>>> =
	Object.freeze({
		'@angular/core/testing': Object.freeze({ async: 'waitForAsync' }),
	});

/**
 * RxJS's own package restructure, keyed by the RxJS 5 deep entry point it
 * replaced. RxJS 5 published one module per exported type at the package root
 * — `rxjs/Observable`, `rxjs/Subject` and their siblings — and RxJS 6 collapsed
 * every one of them into the package's own root export. The deep paths were not
 * moved: they no longer exist, so a module that imports one does not resolve on
 * any line at or beyond 6.
 *
 * Every entry here is a name RxJS re-exports from the package root, checked
 * against the `rxjs` 7.8 type surface rather than remembered: the rewrite is
 * only correct if the binding the module already names is reachable from
 * `'rxjs'`, and a type whose deep module went away *without* a root export
 * would be a removal for a caller to answer, not a specifier to rewrite.
 */
export const RXJS_SIX_SPECIFIER_REPLACEMENTS: Readonly<Record<string, string>> = Object.freeze({
	'rxjs/AsyncSubject': 'rxjs',
	'rxjs/BehaviorSubject': 'rxjs',
	'rxjs/ConnectableObservable': 'rxjs',
	'rxjs/Notification': 'rxjs',
	'rxjs/Observable': 'rxjs',
	'rxjs/Observer': 'rxjs',
	'rxjs/Operator': 'rxjs',
	'rxjs/ReplaySubject': 'rxjs',
	'rxjs/Scheduler': 'rxjs',
	'rxjs/Subject': 'rxjs',
	'rxjs/Subscriber': 'rxjs',
	'rxjs/Subscription': 'rxjs',
});

/**
 * The RxJS 5 patch-import prefix. `import 'rxjs/add/operator/map'` installed an
 * operator onto `Observable.prototype` as a side effect, and RxJS 6 removed
 * both the module and the prototype patching it performed.
 *
 * This capability does not rewrite these imports, and the refusal is the point.
 * Deleting the import is only half the edit: the `.map(…)` and `.catch(…)`
 * call sites it enabled are method calls on an observable, and turning them
 * into `.pipe(map(…), catchError(…))` is a call-site rewrite across every
 * module that inherited the patched prototype — not a specifier substitution.
 * A half-applied patch removal produces a tree that compiles nowhere and hides
 * why, so each patch import is reported by name instead.
 */
export const RXJS_PATCH_IMPORT_PREFIX = 'rxjs/add/';

/** Era module specifiers this capability rewrites, from every table it carries. */
export const ERA_SPECIFIER_REPLACEMENTS: Readonly<Record<string, string>> = Object.freeze({
	...ZONE_JS_SPECIFIER_REPLACEMENTS,
	...RXJS_SIX_SPECIFIER_REPLACEMENTS,
});

export type SourceChange = Readonly<{
	kind: 'module-specifier' | 'renamed-export';
	line: number;
	from: string;
	to: string;
}>;

export type SourceMigration = Readonly<{
	path: string;
	source: string;
	changed: boolean;
	changes: readonly SourceChange[];
	unhandled: readonly string[];
}>;

type Edit = Readonly<{ start: number; end: number; text: string; change: SourceChange }>;

type SourceSpan = readonly [number, number];

type SourceLiteral = Readonly<{ value: string; span: SourceSpan }>;

type ImportSpecifierNode = Readonly<{
	type: string;
	imported?: Readonly<{ type: string; name?: string }>;
	local?: Readonly<{ name: string }>;
}>;

/**
 * The half-open source span of a node. The parser reports `start`/`end`; the
 * ESTree `range` pair is accepted as well so the capability does not depend on
 * which of the two spellings a parser build emits.
 */
function spanOf(node: unknown): SourceSpan | null {
	if (typeof node !== 'object' || node === null) return null;
	const candidate = node as { start?: unknown; end?: unknown; range?: unknown };
	if (typeof candidate.start === 'number' && typeof candidate.end === 'number')
		return [candidate.start, candidate.end];
	const range = candidate.range;
	if (!Array.isArray(range) || range.length < 2) return null;
	const [start, end] = range as readonly unknown[];
	return typeof start === 'number' && typeof end === 'number' ? [start, end] : null;
}

type DeclarationNode = Readonly<{
	type: string;
	source?: unknown;
	specifiers?: readonly unknown[];
	importKind?: string;
}>;

function sourceLiteral(node: unknown): SourceLiteral | null {
	if (typeof node !== 'object' || node === null) return null;
	const candidate = node as { value?: unknown };
	if (typeof candidate.value !== 'string') return null;
	const span = spanOf(node);
	return span === null ? null : { value: candidate.value, span };
}

function importSpecifier(node: unknown): ImportSpecifierNode | null {
	if (typeof node !== 'object' || node === null) return null;
	const candidate = node as ImportSpecifierNode;
	return typeof candidate.type === 'string' ? candidate : null;
}

/**
 * Requote a replacement specifier the way the original literal was written, so
 * a rewritten import keeps the file's quote style and the diff stays confined
 * to the specifier itself. An unrecognised opening quote falls back to a JSON
 * string, which is always valid.
 */
function quoteLike(original: string, replacement: string): string {
	const quote = original.slice(0, 1);
	if (
		(quote !== "'" && quote !== '"') ||
		replacement.includes(quote) ||
		replacement.includes('\\')
	)
		return JSON.stringify(replacement);
	return `${quote}${replacement}${quote}`;
}

function lineOf(source: string, offset: number): number {
	return source.slice(0, offset).split('\n').length;
}

/**
 * Rewrite one module's era specifiers and renamed imports. A module with
 * nothing to rewrite is returned byte-identical, with `changed` false.
 *
 * A module that does not parse is a hard failure naming the file and the
 * diagnostics, never a silent skip: a skipped file would be counted as
 * unchanged, and an uncounted file is exactly the defect a migration record
 * exists to rule out.
 */
export function migrateAngularSourceModule(path: string, source: string): SourceMigration {
	const analyzed = analyze(source, { path, lang: path.endsWith('.ts') ? 'ts' : 'js' });
	const errors = analyzed.diagnostics.filter((entry) => entry.severity === 'error');
	if (errors.length > 0)
		throw new Error(
			`Angular source migration: ${path} does not parse, so its era shapes cannot be ` +
				`rewritten and it cannot be honestly counted as unchanged. Diagnostics: ` +
				errors.map((entry) => entry.message).join('; '),
		);
	const edits: Edit[] = [];
	const unhandled: string[] = [];
	for (const statement of analyzed.ast.body as readonly unknown[]) {
		const declaration = statement as DeclarationNode;
		if (
			declaration.type !== 'ImportDeclaration' &&
			declaration.type !== 'ExportNamedDeclaration' &&
			declaration.type !== 'ExportAllDeclaration'
		)
			continue;
		const literal = sourceLiteral(declaration.source);
		if (literal === null) continue;
		if (literal.value.startsWith(RXJS_PATCH_IMPORT_PREFIX)) {
			unhandled.push(
				`${path} imports ${literal.value}, an RxJS 5 patch module that RxJS 6 removed along ` +
					`with the prototype patching it performed. Removing the import alone would leave ` +
					`the operator call sites it enabled calling a method that no longer exists, so it ` +
					`is reported rather than rewritten: the call sites have to move to \`pipe\` first.`,
			);
			continue;
		}
		const replacement = ERA_SPECIFIER_REPLACEMENTS[literal.value];
		if (replacement !== undefined)
			edits.push({
				start: literal.span[0],
				end: literal.span[1],
				text: quoteLike(source.slice(literal.span[0], literal.span[1]), replacement),
				change: {
					kind: 'module-specifier',
					line: lineOf(source, literal.span[0]),
					from: literal.value,
					to: replacement,
				},
			});
		const renames = RENAMED_MODULE_EXPORTS[literal.value];
		if (renames === undefined) continue;
		for (const node of declaration.specifiers ?? []) {
			const specifier = importSpecifier(node);
			if (specifier === null || specifier.type !== 'ImportSpecifier') continue;
			const imported = specifier.imported;
			if (imported === undefined || imported.type !== 'Identifier') continue;
			const name = imported.name;
			if (name === undefined) continue;
			const renamed = renames[name];
			if (renamed === undefined) continue;
			const local = specifier.local?.name ?? name;
			const span = spanOf(node);
			if (span === null) continue;
			edits.push({
				start: span[0],
				end: span[1],
				text: `${renamed} as ${local}`,
				change: {
					kind: 'renamed-export',
					line: lineOf(source, span[0]),
					from: `${name} as ${local}`,
					to: `${renamed} as ${local}`,
				},
			});
		}
	}
	for (const [specifier] of Object.entries(ZONE_JS_SPECIFIER_REPLACEMENTS))
		if (source.includes(`import(`) && source.includes(specifier))
			unhandled.push(
				`${path} may reach ${specifier} through a dynamic import, which this capability does not rewrite`,
			);
	const ordered = [...edits].sort((left, right) => right.start - left.start);
	let migrated = source;
	for (const edit of ordered)
		migrated = `${migrated.slice(0, edit.start)}${edit.text}${migrated.slice(edit.end)}`;
	const changes = [...edits]
		.sort((left, right) => left.start - right.start)
		.map((edit) => edit.change);
	return Object.freeze({
		path,
		source: migrated,
		changed: migrated !== source,
		changes: Object.freeze(changes),
		unhandled: Object.freeze([...new Set(unhandled)].sort(compareStrings)),
	});
}
