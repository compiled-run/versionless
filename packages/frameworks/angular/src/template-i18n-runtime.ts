/**
 * The runtime `$localize` an application's own templates ask for once the
 * target line's compiler is the one that emits them.
 *
 * An application whose templates carry Angular's i18n markers used to be
 * translated entirely at build time: the pre-Ivy compiler read the marked
 * messages, substituted a locale's translations into the factories it emitted,
 * and shipped a bundle with no message runtime in it at all. From Angular 9 the
 * same markers compile to `$localize` tagged template literals, which are
 * evaluated by the bundle rather than by the compiler — and `$localize` is a
 * global, published as `@angular/localize`, that nothing in the framework's
 * runtime packages binds. A bundle that carries the tags and not the global
 * throws `$localize is not defined` at the first marked message, which for an
 * application whose root template is marked means before anything mounts.
 *
 * That is a hole a migration opens: the templates did not change, the compiler
 * did. So this capability closes it, and only where the application's own bytes
 * say it is open:
 *
 * - **Only when the templates ask.** The marker is read out of the parsed
 *   templates — `i18n` on an element, or `i18n-<attribute>` on one of its
 *   attributes — and an application with no marker anywhere gets no package
 *   declared and no polyfill entry. A polyfill nothing asks for is bundle weight
 *   and a claim about the application that its own templates contradict.
 * - **Only when the target line emits the tags.** `$localize` is an Ivy-era
 *   emission. A cell on a pre-Ivy line compiles the same markers to substituted
 *   factories, so the global is never referenced, and declaring the package
 *   there would answer a question that line does not ask.
 * - **Only at the cell's read range.** The version is the range the declared
 *   target cell already carries for the `@angular/` family; this capability
 *   picks no version of its own, and a cell that says nothing about the family
 *   is refused rather than guessed at.
 *
 * The delivery seam is the builder's own `polyfills` list, through
 * {@link declarePolyfillEntryPoint} — the same seam the node-core runtime
 * globals shim uses, for the same reason: it is where the builder puts a module
 * the document has to evaluate before `main`, and `@angular/localize/init` is
 * the entry point the package itself publishes for exactly that position.
 */

import { alignedVersionRange, majorOf, type AngularTargetCell } from './angular-target-cell.ts';
import { parseStrictJson, serializeJson, objectAt } from './angular-workspace-migration.ts';
import { analyzeAngularTemplates, type AngularTemplateSource } from './template-analysis.ts';

/** The package that publishes the `$localize` runtime. */
export const LOCALIZE_PACKAGE = '@angular/localize' as const;

/** The entry point the package publishes for the pre-`main` position. */
export const LOCALIZE_POLYFILL_ENTRY_POINT = '@angular/localize/init' as const;

/**
 * The first Angular line whose compiler emits `$localize` tagged templates for
 * i18n-marked templates instead of substituting translations at compile time.
 */
export const LOCALIZE_EMITTING_ANGULAR_MAJOR = 9;

/** One i18n marker an application's own template carries. */
export type TemplateI18nMarker = Readonly<{
	/** The template the marker was read from. */
	template: string;
	/** The 1-based line the marked element opens on. */
	line: number;
	/** The element the marker sits on. */
	element: string;
	/** The marker attribute exactly as the template spells it. */
	attribute: string;
}>;

/** What an application's templates say about i18n, as read. */
export type TemplateI18nReading = Readonly<{
	/** Every marker found, template order then line order. */
	markers: readonly TemplateI18nMarker[];
	/** The templates that carry at least one marker. */
	markedTemplates: readonly string[];
	/** Every template read, marked or not. */
	templatesRead: number;
}>;

/** Whether one attribute name is one of Angular's i18n markers. */
export function isI18nMarkerAttribute(name: string): boolean {
	return name === 'i18n' || name.startsWith('i18n-');
}

/**
 * Read every i18n marker an application's templates carry.
 *
 * The reading is the compiler's own parse rather than a text search: `i18n` is
 * an attribute of an element, and an attribute is a thing the template parser
 * knows about while a substring is a thing that can sit inside a comment, a
 * string or an unrelated word.
 */
export function readTemplateI18nMarkers(
	templates: readonly AngularTemplateSource[],
): TemplateI18nReading {
	const markers: TemplateI18nMarker[] = [];
	const marked: string[] = [];
	const analyses = analyzeAngularTemplates(templates);
	for (const analysis of analyses) {
		const before = markers.length;
		for (const marker of analysis.i18nMarkers) {
			if (!isI18nMarkerAttribute(marker.marker)) continue;
			markers.push(
				Object.freeze({
					template: analysis.path,
					line: marker.line,
					element: marker.element,
					attribute: marker.marker,
				}),
			);
		}
		if (markers.length > before) marked.push(analysis.path);
	}
	return Object.freeze({
		markers: Object.freeze(markers),
		markedTemplates: Object.freeze(marked),
		templatesRead: analyses.length,
	});
}

/** One dependency the declaration writes into the application's manifest. */
export type LocalizeDependencyChange = Readonly<{
	field: 'dependencies';
	name: typeof LOCALIZE_PACKAGE;
	from: string | null;
	to: string;
}>;

export type TemplateI18nRuntimeDeclaration = Readonly<{
	/** Whether the package was declared. */
	declared: boolean;
	/** The manifest source, rewritten only when something changed. */
	manifest: string;
	/** The dependency change written, or null when none was. */
	change: LocalizeDependencyChange | null;
	/** The polyfill entry point to declare, or null when nothing is declared. */
	entryPoint: typeof LOCALIZE_POLYFILL_ENTRY_POINT | null;
	/** The reading the decision rests on. */
	reading: TemplateI18nReading;
	/** What declaring this changes about the application, stated. */
	declaredDifferences: readonly string[];
	/** Everything refused, by name and with its reason. */
	unhandled: readonly string[];
}>;

function refusal(
	manifest: string,
	reading: TemplateI18nReading,
	why: string,
): TemplateI18nRuntimeDeclaration {
	return Object.freeze({
		declared: false,
		manifest,
		change: null,
		entryPoint: null,
		reading,
		declaredDifferences: Object.freeze([]),
		unhandled: Object.freeze([why]),
	});
}

/**
 * Declare the `$localize` runtime for an application whose templates ask for it
 * on a line whose compiler emits it.
 *
 * The manifest half is all this returns for the workspace: the entry point is
 * handed back by name for the caller to declare through
 * {@link declarePolyfillEntryPoint}, which is the one place in this package that
 * knows which builder targets take a `polyfills` option and what to do with a
 * target whose option is in the pre-v15 string form.
 */
export function declareTemplateI18nRuntime(input: {
	manifest: string;
	templates: readonly AngularTemplateSource[];
	cell: AngularTargetCell;
}): TemplateI18nRuntimeDeclaration {
	const reading = readTemplateI18nMarkers(input.templates);
	if (reading.markers.length === 0)
		return refusal(
			input.manifest,
			reading,
			`${LOCALIZE_PACKAGE} was not declared: none of the ${String(reading.templatesRead)} ` +
				'templates read carries an `i18n` or `i18n-<attribute>` marker, so this application ' +
				'compiles to no `$localize` tagged template and a runtime for one would be a ' +
				'polyfill nothing in the bundle asks for',
		);
	const major = majorOf(input.cell.angularLine);
	if (major === null || major < LOCALIZE_EMITTING_ANGULAR_MAJOR)
		return refusal(
			input.manifest,
			reading,
			`${LOCALIZE_PACKAGE} was not declared: the declared cell is on Angular ` +
				`${input.cell.angularLine}, whose compiler substitutes translations into the ` +
				'factories it emits rather than emitting `$localize` tagged templates, so the ' +
				'marked templates reference no runtime global on this line',
		);
	const range = alignedVersionRange(LOCALIZE_PACKAGE, input.cell);
	if (range === null)
		return refusal(
			input.manifest,
			reading,
			`${LOCALIZE_PACKAGE} was not declared: the declared cell ${input.cell.id} carries no ` +
				'range for it and none for the `@angular/` family, and picking a version for a ' +
				'framework package is the cell\'s decision rather than this capability\'s',
		);
	const parsed = parseStrictJson(input.manifest, 'template i18n runtime');
	const dependencies = objectAt(parsed['dependencies']);
	if (dependencies === null)
		return refusal(
			input.manifest,
			reading,
			`${LOCALIZE_PACKAGE} was not declared: the application manifest carries no ` +
				'`dependencies` object, so there is nothing here this capability can read as the ' +
				'declared closure it would be adding to',
		);
	const current = dependencies[LOCALIZE_PACKAGE];
	if (current !== undefined && typeof current !== 'string')
		return refusal(
			input.manifest,
			reading,
			`${LOCALIZE_PACKAGE} was not declared: the manifest already carries it as something ` +
				'other than a version range, and overwriting a declaration this capability cannot ' +
				'read would discard a decision somebody else made',
		);
	const declaredDifferences = [
		`globalThis.$localize exists in this application's browser context where it did not ` +
			`before. ${LOCALIZE_PACKAGE} is declared at ${range} and its published ` +
			`\`${LOCALIZE_POLYFILL_ENTRY_POINT}\` entry point installs the runtime before \`main\`, ` +
			`because ${String(reading.markers.length)} i18n markers across ` +
			`${String(reading.markedTemplates.length)} of this application's ` +
			`${String(reading.templatesRead)} templates compile to \`$localize\` tagged templates ` +
			`on Angular ${input.cell.angularLine}. With no translations loaded the runtime ` +
			'evaluates each tag to its source message, which is the text the template already ' +
			'carries — the application renders its own strings, not translated ones, and this ' +
			'capability loads no locale.',
	];
	if (current === range)
		return Object.freeze({
			declared: true,
			manifest: input.manifest,
			change: null,
			entryPoint: LOCALIZE_POLYFILL_ENTRY_POINT,
			reading,
			declaredDifferences: Object.freeze(declaredDifferences),
			unhandled: Object.freeze([]),
		});
	const next: Record<string, string> = {};
	for (const name of [...Object.keys(dependencies), LOCALIZE_PACKAGE].sort()) {
		if (name === LOCALIZE_PACKAGE) {
			next[name] = range;
			continue;
		}
		const value = dependencies[name];
		if (typeof value !== 'string')
			return refusal(
				input.manifest,
				reading,
				`${LOCALIZE_PACKAGE} was not declared: \`dependencies.${name}\` is not a version ` +
					'range, so rewriting this manifest would rewrite a declaration this capability ' +
					'cannot read',
			);
		next[name] = value;
	}
	return Object.freeze({
		declared: true,
		manifest: serializeJson({ ...parsed, dependencies: next }),
		change: Object.freeze({
			field: 'dependencies',
			name: LOCALIZE_PACKAGE,
			from: current ?? null,
			to: range,
		}),
		entryPoint: LOCALIZE_POLYFILL_ENTRY_POINT,
		reading,
		declaredDifferences: Object.freeze(declaredDifferences),
		unhandled: Object.freeze([]),
	});
}
