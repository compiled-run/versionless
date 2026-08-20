/**
 * The `LOCALE_ID` an era build set from the command line and the new one does
 * not set at all.
 *
 * `--i18n-locale <value>` did two things on the pre-Ivy CLI: it told the
 * compiler which message bundle to substitute, and it bound the value into the
 * application's root injector as `LOCALE_ID`. The Angular CLI removed the flag
 * after the 12 line — the 13 browser builder schema declares no `i18nLocale`,
 * so the flag is dropped from the migrated command line by
 * `workspace-script-flags.ts` — and nothing on the new line puts the value back.
 * `LOCALE_ID` then resolves to the framework's own default, `en-US`, and the
 * application is running under a locale it was never built for.
 *
 * **This defect emits nothing at build time.** The measured case is pigallery2:
 * its own module wires
 * `{provide: TRANSLATIONS, useFactory: translationsFactory, deps: [LOCALE_ID]}`
 * and the factory guards on `locale === 'en'` exactly, so with `LOCALE_ID` at
 * `en-US` it fell through to a `require` for a translation file that has never
 * existed and threw `Cannot find module './messages.en-US.xlf'` in the browser,
 * before the gallery mounted. The build that produced it reported zero errors
 * and zero warnings. Every other reader of `LOCALE_ID` — `DatePipe`,
 * `CurrencyPipe`, `DecimalPipe`, `registerLocaleData` lookups — fails more
 * quietly than that: it formats against the wrong locale and says nothing.
 *
 * The fix is the injector, because the injector is the only place the new line
 * offers: `{provide: LOCALE_ID, useValue: '<value>'}` in the root module's
 * providers. That is a *translation of a removed flag*, a sibling of the flag
 * rewriting in `workspace-script-flags.ts`, and it is only that.
 *
 * ## What is read, and what is never invented
 *
 * The locale is **supplied, never derived**. This capability takes an
 * {@link EraLocaleReading} — a value somebody read out of the era build's own
 * argv — and with no reading supplied it stands down and writes nothing. It
 * does not default to `en`, does not read a locale off the cell, does not infer
 * one from the application's translation files, and does not consult the host.
 * A locale nobody measured is a claim about what the application was built for,
 * and the whole defect above is what happens when that claim is wrong.
 *
 * `readEraLocaleFlagValue` is the reading for a script-driven build: it parses
 * `--i18n-locale en` or `--i18n-locale=en` out of the span
 * `workspace-script-flags.ts` already captures for the flag it removed, so the
 * value the migration deleted from the command line is the value it writes into
 * the injector. A build driven by something other than an `ng` script — a gulp
 * task, a shell wrapper — is read by whoever can read it, and hands the value
 * in as an {@link EraLocaleReading} of its own.
 *
 * ## Where it is written
 *
 * - **The module that bootstraps.** `LOCALE_ID` belongs to the root injector,
 *   and the root injector is the one the bootstrapped module configures. The
 *   site is therefore an `@NgModule` literal with a non-empty `bootstrap` array,
 *   resolved through the module's own binding for `NgModule`. A feature module
 *   is not a site: providing a locale there would move the value into a lazy
 *   injector and change which components see it.
 * - **First in the array, deliberately.** Angular resolves a duplicated token to
 *   the *last* provider for it, so a provider written first loses to any
 *   provider the module reaches later — including one inside a spread or a
 *   provider array this reading cannot open. Writing first is what makes the
 *   edit unable to overrule a decision the application already made.
 * - **Once.** A module that already carries a `provide: LOCALE_ID` property
 *   anywhere in the file is left exactly as it is, whatever the provider's value
 *   expression is. The check is detection, not overwrite: a locale somebody
 *   chose outranks a locale this capability read.
 *
 * The token is spelled as the module already spells it — an existing named
 * import is reused under its own local name, a namespace import is written
 * through, and only a module that imports `@angular/core` without `LOCALE_ID`
 * has its existing declaration extended. A second `@angular/core` declaration is
 * a shape the application did not write. In the measured pigallery2 module no
 * import was added at all, because `LOCALE_ID` was already imported as the
 * `deps` of the application's own `TRANSLATIONS` provider.
 *
 * ## Nonclaims
 *
 * - The reading is one module. A `LOCALE_ID` supplied from another file — a
 *   provider array this module imports by name, or a `bootstrapModule`
 *   options object — is not visible here. The first-position rule is what keeps
 *   that from becoming an override; it does not make it visible.
 * - Nothing here loads a translation, registers locale data, or declares
 *   `@angular/localize`. It supplies one value to one token. An application
 *   whose locale needs `registerLocaleData` still needs it, and the `$localize`
 *   runtime is a different capability's question.
 * - The value is data, not vocabulary. No locale tag is validated, ranked or
 *   canonicalised; the only rule applied to it is that it be a single argv token
 *   writable verbatim inside a source string literal, because a value that has
 *   to be escaped to be written is not the value that was read.
 */

import { compareStrings, majorOf, type AngularTargetCell } from './angular-target-cell.ts';
import {
	applySourceEdits,
	denotesExport,
	forEachNode,
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

const CAPABILITY = 'Locale id provider';

/** The package that publishes both symbols this capability resolves against. */
export const LOCALE_ID_PACKAGE = '@angular/core';

/** The token the era flag used to bind, and the decorator that names a module. */
export const LOCALE_ID_TOKEN = 'LOCALE_ID';
const MODULE_DECORATOR = 'NgModule';

/** The module-literal properties this capability reads. */
const BOOTSTRAP_PROPERTY = 'bootstrap';
const PROVIDERS_PROPERTY = 'providers';

/** The removed flag whose value this capability translates into the injector. */
export const ERA_LOCALE_FLAG = '--i18n-locale';

/**
 * The last Angular CLI major that parsed {@link ERA_LOCALE_FLAG}. A cell on that
 * major or below still accepts the flag, so the value still reaches the injector
 * the way it always did and there is nothing here to supply. The number is the
 * same reading `REMOVED_ANGULAR_CLI_FLAGS` carries for the flag, and a test pins
 * the two together rather than leaving them to drift.
 */
export const ERA_LOCALE_FLAG_REMOVED_AFTER_MAJOR = 12;

/** A locale value somebody read out of an era build, and where they read it. */
export type EraLocaleReading = Readonly<{
	/** The value the era build's own argv carried, verbatim. */
	locale: string;
	/** Where the reading was taken, in the reader's own words. */
	readFrom: string;
}>;

export type LocaleIdProviderChange = Readonly<{
	kind: 'locale-id-provider';
	/** The line the `@NgModule` decorator opens on. */
	line: number;
	/** The bootstrapping module the provider was written into. */
	moduleClass: string;
	/** The value written, exactly as it was read. */
	locale: string;
	/** Where the value was read, carried through from the reading. */
	readFrom: string;
	/** The provider, as written into the source. */
	provider: string;
	/** Whether an `@angular/core` import declaration was extended. */
	importExtended: boolean;
	/** Whether the module literal had no `providers` property before this. */
	providersPropertyAdded: boolean;
}>;

export type LocaleIdProviderMigration = Readonly<{
	path: string;
	source: string;
	changed: boolean;
	changes: readonly LocaleIdProviderChange[];
	unhandled: readonly string[];
}>;

/**
 * Whether a value can be written into a single-quoted string literal as itself.
 *
 * This is a rule about writing, not about locales: a quote, a backslash, a line
 * terminator or a control character would have to be escaped, and an escaped
 * value is no longer the value that was read. Whitespace is excluded for the
 * same reason — the reading is one argv token, and a token with a space in it
 * did not come from one.
 */
export function isWritableLocaleValue(value: string): boolean {
	if (value === '') return false;
	for (const character of value) {
		const code = character.codePointAt(0) ?? 0;
		if (code < 0x20 || code === 0x7f) return false;
		if (character === "'" || character === '\\') return false;
		if (/\s/u.test(character)) return false;
	}
	return true;
}

/**
 * The value `--i18n-locale` carried in one captured argv span, or null.
 *
 * Both spellings the CLI accepted are read — `--i18n-locale en` and
 * `--i18n-locale=en` — because `workspace-script-flags.ts` captures the span the
 * era script actually wrote rather than a normalised form of it. Anything else,
 * including the flag with no value after it, is null: a flag whose value cannot
 * be read is not a reading of one.
 */
export function readEraLocaleFlagValue(span: string): string | null {
	const trimmed = span.trim();
	if (!trimmed.startsWith(ERA_LOCALE_FLAG)) return null;
	const rest = trimmed.slice(ERA_LOCALE_FLAG.length);
	if (rest === '') return null;
	const separator = rest[0];
	if (separator !== '=' && !/\s/u.test(separator ?? '')) return null;
	const value = rest.slice(1).trim();
	if (value === '' || /\s/u.test(value)) return null;
	return value;
}

/**
 * The reading a removed-flag change record states, or null when that record is
 * about some other flag.
 *
 * The argument is structural rather than the `ScriptFlagChange` type itself, so
 * that reading a command line and rewriting one stay two separate concerns with
 * no dependency between their modules.
 */
export function eraLocaleReadingOfRemovedFlag(
	change: Readonly<{ script: string; from: string }>,
): EraLocaleReading | null {
	const locale = readEraLocaleFlagValue(change.from);
	if (locale === null) return null;
	return Object.freeze({
		locale,
		readFrom: `the era build script \`${change.script}\` passed \`${change.from.trim()}\``,
	});
}

/** The provider, spelled as the measured migration spelled it. */
export function localeIdProviderSource(token: string, locale: string): string {
	return `{provide: ${token}, useValue: '${locale}'}`;
}

/** The static name of a non-computed property key, or null for anything else. */
function propertyName(key: AstNode): string | null {
	if (key.type === 'Identifier') return key.name;
	if (key.type === 'Literal' && typeof key.value === 'string') return key.value;
	return null;
}

/**
 * Whether this module already provides `LOCALE_ID`, anywhere in the file.
 *
 * The scan is the whole module rather than the one providers array, because a
 * provider list is routinely assembled in a `const` beside the module and spread
 * into it, and a second provider written next to one somebody already wrote is
 * exactly the overwrite this capability refuses. `deps: [LOCALE_ID]` is not a
 * match: reading the token is what makes the missing provider a defect.
 */
export function modulesProvideLocaleId(module: SemanticModule, core: ModuleImports): boolean {
	let provided = false;
	forEachNode(module.ast, (node) => {
		if (provided || node.type !== 'ObjectExpression') return;
		for (const property of node.properties) {
			if (property.type !== 'Property') continue;
			if (property.kind !== 'init' || property.computed) continue;
			if (propertyName(property.key) !== 'provide') continue;
			if (denotesExport(module, property.value, core, LOCALE_ID_TOKEN)) provided = true;
		}
	});
	return provided;
}

/** How this module spells `LOCALE_ID`, and the import edit that makes it true. */
type TokenSpelling = Readonly<{ token: string; edit: SourceEdit | null; extended: boolean }>;

type ImportDeclarationNode = Extract<AstNode, { type: 'ImportDeclaration' }>;

/** Every `@angular/core` import declaration, in source order. */
function coreDeclarations(module: SemanticModule): readonly ImportDeclarationNode[] {
	const declarations: ImportDeclarationNode[] = [];
	for (const node of module.ast.body)
		if (node.type === 'ImportDeclaration' && node.source.value === LOCALE_ID_PACKAGE)
			declarations.push(node);
	return declarations;
}

/**
 * The name the module already binds the token under, or the edit that binds it.
 *
 * An alias is honoured because the binding is what resolves, not the spelling; a
 * namespace import is written through rather than joined by a named one; and a
 * module that imports the package some other way has its first declaration
 * extended. A module whose root scope already binds `LOCALE_ID` to something
 * else gets nothing: introducing a second meaning for a name in one scope is not
 * an edit this capability is entitled to make.
 */
function tokenSpelling(module: SemanticModule, core: ModuleImports): TokenSpelling | null {
	const declarations = coreDeclarations(module);
	for (const declaration of declarations)
		for (const specifier of declaration.specifiers) {
			if (specifier.type !== 'ImportSpecifier') continue;
			const imported = specifier.imported;
			if (imported.type !== 'Identifier' || imported.name !== LOCALE_ID_TOKEN) continue;
			return Object.freeze({ token: specifier.local.name, edit: null, extended: false });
		}
	for (const declaration of declarations)
		for (const specifier of declaration.specifiers) {
			if (specifier.type !== 'ImportNamespaceSpecifier') continue;
			return Object.freeze({
				token: `${specifier.local.name}.${LOCALE_ID_TOKEN}`,
				edit: null,
				extended: false,
			});
		}
	if (core.namespace !== null) return null;
	if (!isFreeRootName(module, LOCALE_ID_TOKEN)) return null;
	for (const declaration of declarations) {
		const last = namedSpecifiersOf(declaration).at(-1);
		if (last === undefined) continue;
		return Object.freeze({
			token: LOCALE_ID_TOKEN,
			edit: { start: last.end, end: last.end, text: `, ${LOCALE_ID_TOKEN}` },
			extended: true,
		});
	}
	return null;
}

/** The indentation of the line `node` starts on, when it starts that line. */
function ownLineIndent(source: string, node: AstNode): string | null {
	const lineStart = source.lastIndexOf('\n', node.start - 1) + 1;
	const before = source.slice(lineStart, node.start);
	return before.trim() === '' ? before : null;
}

/**
 * Write `text` as the first element of an array literal.
 *
 * A literal whose elements own their lines keeps that shape; an inline literal
 * stays inline. Neither form is reflowed: the edit is one provider, and a
 * capability that also reformatted the array around it would report a change
 * larger than the one it made.
 */
function insertFirstElement(
	source: string,
	array: Extract<AstNode, { type: 'ArrayExpression' }>,
	text: string,
): SourceEdit {
	const first = array.elements.find((element) => element !== null && element !== undefined);
	if (first === undefined || first === null)
		return Object.freeze({ start: array.start + 1, end: array.start + 1, text });
	const indent = ownLineIndent(source, first);
	return Object.freeze({
		start: first.start,
		end: first.start,
		text: indent === null ? `${text}, ` : `${text},\n${indent}`,
	});
}

/** Write `text` as the last property of an object literal that has properties. */
function appendProperty(
	source: string,
	properties: readonly PlainProperty[],
	text: string,
): SourceEdit | null {
	const last = properties.at(-1);
	if (last === undefined) return null;
	const indent = ownLineIndent(source, last.node);
	return Object.freeze({
		start: last.node.end,
		end: last.node.end,
		text: indent === null ? `, ${text}` : `,\n${indent}${text}`,
	});
}

/** The name of the class a decorator sits on, for the change record. */
function decoratedClassName(module: SemanticModule, decorator: AstNode): string {
	const owner = module.parentOf(decorator);
	if (owner === null) return '<anonymous>';
	if (owner.type !== 'ClassDeclaration' && owner.type !== 'ClassExpression') return '<anonymous>';
	const id = owner.id;
	if (id === null || id === undefined || id.type !== 'Identifier') return '<anonymous>';
	return id.name;
}

/** One bootstrapping `@NgModule` literal, as read. */
type BootstrapSite = Readonly<{
	decorator: AstNode;
	literal: AstNode;
	properties: readonly PlainProperty[];
}>;

/**
 * Supply the root injector the `LOCALE_ID` the era build's command line used to
 * supply, and only where a reading of that command line says what it was.
 */
export function provideEraLocaleId(
	path: string,
	source: string,
	reading: EraLocaleReading | null,
	cell: AngularTargetCell,
): LocaleIdProviderMigration {
	const unchanged = (unhandled: readonly string[]): LocaleIdProviderMigration =>
		Object.freeze({
			path,
			source,
			changed: false,
			changes: Object.freeze([]),
			unhandled: Object.freeze([...new Set(unhandled)].sort(compareStrings)),
		});
	if (reading === null) return unchanged([]);
	const major = majorOf(cell.angularLine);
	if (major === null || major <= ERA_LOCALE_FLAG_REMOVED_AFTER_MAJOR) return unchanged([]);
	if (!isWritableLocaleValue(reading.locale))
		return unchanged([
			`${path}: the supplied locale reading (${reading.readFrom}) is not a single argv token ` +
				'that can be written into a source string literal as itself, so no provider was ' +
				'written; a locale that has to be escaped to be written is not the locale that was read',
		]);
	const module = parseModule(CAPABILITY, path, source);
	const core = readModuleImports(module, LOCALE_ID_PACKAGE);
	if (!core.present) return unchanged([]);
	if (modulesProvideLocaleId(module, core)) return unchanged([]);
	const sites: BootstrapSite[] = [];
	const unhandled: string[] = [];
	forEachNode(module.ast, (node) => {
		if (node.type !== 'Decorator') return;
		const call = node.expression;
		if (call.type !== 'CallExpression') return;
		if (!denotesExport(module, call.callee, core, MODULE_DECORATOR)) return;
		const literal = call.arguments[0];
		if (literal === undefined || literal.type !== 'ObjectExpression') return;
		const line = lineOf(source, node.start);
		const properties = plainProperties(literal);
		if (properties === null) {
			unhandled.push(
				`${path} line ${String(line)}: the @${MODULE_DECORATOR} literal carries a spread, a ` +
					'computed key or an accessor, so whether it bootstraps and what it already provides ' +
					'cannot be read from it, and it was left exactly as it is',
			);
			return;
		}
		const bootstrap = properties.find((property) => property.name === BOOTSTRAP_PROPERTY);
		if (bootstrap === undefined) return;
		if (bootstrap.value.type !== 'ArrayExpression' || bootstrap.value.elements.length === 0)
			return;
		sites.push(Object.freeze({ decorator: node, literal, properties }));
	});
	if (sites.length === 0) return unchanged(unhandled);
	if (sites.length > 1) {
		const lines = sites.map((site) => String(lineOf(source, site.decorator.start)));
		return unchanged([
			...unhandled,
			`${path}: ${String(sites.length)} @${MODULE_DECORATOR} literals in this module bootstrap a ` +
				`component (lines ${lines.join(', ')}), so which of them configures the root injector ` +
				'this application starts with is not something the module states, and no provider was ' +
				'written into either',
		]);
	}
	const site = sites[0] as BootstrapSite;
	const line = lineOf(source, site.decorator.start);
	const spelling = tokenSpelling(module, core);
	if (spelling === null)
		return unchanged([
			...unhandled,
			`${path} line ${String(line)}: ${LOCALE_ID_TOKEN} is not imported from ` +
				`${LOCALE_ID_PACKAGE} here and this module offers nowhere to write the import that ` +
				'would not either bind a name its own scope already uses or add a second declaration ' +
				`of ${LOCALE_ID_PACKAGE}, so no provider was written`,
		]);
	const provider = localeIdProviderSource(spelling.token, reading.locale);
	const providers = site.properties.find((property) => property.name === PROVIDERS_PROPERTY);
	const edits: SourceEdit[] = [];
	let providersPropertyAdded = false;
	if (providers === undefined) {
		const appended = appendProperty(
			source,
			site.properties,
			`${PROVIDERS_PROPERTY}: [${provider}]`,
		);
		if (appended === null) return unchanged(unhandled);
		edits.push(appended);
		providersPropertyAdded = true;
	} else if (providers.value.type === 'ArrayExpression') {
		edits.push(insertFirstElement(source, providers.value, provider));
	} else {
		return unchanged([
			...unhandled,
			`${path} line ${String(line)}: ${PROVIDERS_PROPERTY} is not an array literal, so there is ` +
				'no position in it this capability can read, and it was left exactly as it is',
		]);
	}
	if (spelling.edit !== null) edits.push(spelling.edit);
	const migrated = applySourceEdits(source, edits);
	return Object.freeze({
		path,
		source: migrated,
		changed: migrated !== source,
		changes: Object.freeze([
			Object.freeze({
				kind: 'locale-id-provider' as const,
				line,
				moduleClass: decoratedClassName(module, site.decorator),
				locale: reading.locale,
				readFrom: reading.readFrom,
				provider,
				importExtended: spelling.extended,
				providersPropertyAdded,
			}),
		]),
		unhandled: Object.freeze([...new Set(unhandled)].sort(compareStrings)),
	});
}
