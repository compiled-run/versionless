/**
 * Disable the modern browser builder's font inliner in the migrated workspace.
 *
 * The Angular CLI grew a build-time font optimiser after the era lines this
 * corpus migrates from. On a modern line the browser builder's `optimization`
 * option defaults to `true`, and inside that option `fonts` defaults to `true`
 * as well, so an optimized production build — a build nobody configured to do
 * anything of the sort — reaches out to `fonts.googleapis.com` for every Google
 * Fonts stylesheet the application's `index.html` links, and to
 * `use.typekit.net` for every Adobe Fonts one, and pastes the answer into the
 * emitted document. The devkit's own schema says so in as many words: "This
 * option requires internet access."
 *
 * Three separate things are wrong with letting that stand in a migration cell.
 *
 * It is a build-time network fetch that no cell declared. A migration lane that
 * silently contacts a third-party host during `ng build` is not a lane whose
 * output can be attributed to the inputs it declares, and it is not a lane that
 * can be run where that host is unreachable — the build simply emits different
 * bytes, or the era document, depending on whether the request happened to
 * succeed.
 *
 * It is not behaviour-faithful. The era build emitted the application's own
 * `<link rel="stylesheet" href="https://fonts.googleapis.com/…">` untouched and
 * the *browser* fetched it at runtime. Inlining moves that fetch to build time
 * and freezes whatever Google served on the build host into the document, so
 * the migrated document carries font revisions and `unicode-range` sets that
 * are a property of the build day rather than of the application.
 *
 * It is not even the fetch it appears to be. Inlining the *stylesheet* does not
 * inline the *fonts*: the pasted CSS still points at `fonts.gstatic.com`, so
 * the runtime request survives and only the stylesheet request was traded for a
 * build-time one.
 *
 * So the migrated cell turns it off, and records the difference rather than
 * hiding it. What the migrated lane then does is what the era lane did: ship the
 * application's own link element and let the browser fetch the stylesheet at
 * runtime, exactly as the era browser did. That is the faithful behaviour and
 * the offline-buildable one at the same time.
 *
 * Nothing here branches on an application, a project name or a font host. The
 * only inputs are the builder name — a fact about the devkit's schemas, since
 * `:server` carries an `optimization` option with no `fonts` member at all and
 * would *reject* the key — and the shape of whatever `optimization` value the
 * workspace declares.
 */

import type { AngularTargetCell } from './angular-target-cell.ts';

/**
 * The official builders whose `optimization` option carries a `fonts` member.
 *
 * Read off the devkit's shipped schemas rather than assumed. `:browser`,
 * `:browser-esbuild` and `:application` each declare `optimization` with
 * `fonts` defaulting to `true`. `:server` declares `optimization` *without* a
 * `fonts` member and with `additionalProperties: false`, so writing the key
 * there would fail schema validation before the compiler ran; it renders on the
 * server and inlines no fonts, so it needs nothing. `:dev-server`, `:karma`,
 * `:extract-i18n`, `:ng-packagr` and `:app-shell` declare no `optimization`
 * option at all.
 */
export const FONT_INLINING_BUILDERS: readonly string[] = Object.freeze([
	'@angular-devkit/build-angular:application',
	'@angular-devkit/build-angular:browser',
	'@angular-devkit/build-angular:browser-esbuild',
]);

/** True for a builder whose `optimization` option carries a `fonts` member. */
export function builderInlinesFonts(builder: string): boolean {
	return FONT_INLINING_BUILDERS.includes(builder);
}

/**
 * The `fonts` value that disables inlining, written in the object form rather
 * than as the bare `false` the schema also accepts.
 *
 * `fonts: false` and `fonts: { inline: false }` mean the same thing today
 * because `inline` is the only member `fonts` has. The object form is written
 * because it says which capability was turned off, and because a later devkit
 * that adds a second font optimisation would leave the object form disabling
 * exactly the one this cell decided about and the bare `false` disabling
 * something nobody here read.
 */
export const FONTS_NOT_INLINED: Readonly<{ inline: false }> = Object.freeze({ inline: false });

/**
 * The `optimization` value the migrated workspace should carry, given the one
 * it declares.
 *
 * The rules follow the schema's own semantics, and the whole point of them is
 * that turning font inlining off must not turn anything else on or off.
 *
 * - A declared `false` is left alone. The optimiser is off, so the inliner is
 *   off, and rewriting it to an object would switch optimisation *on* for a
 *   configuration that asked for it off — the development configuration, in
 *   nearly every workspace.
 * - A declared `true` becomes `{ scripts: true, styles: true, fonts: {inline:
 *   false} }`. Those are the schema's own defaults for `scripts` and `styles`,
 *   written out so the only change is the font one.
 * - A declared object keeps every member it declared and gains, or has
 *   replaced, its `fonts` member.
 * - An *absent* option is written as the same explicit object as a declared
 *   `true`, because absent means `true`: the schema's default for
 *   `optimization` is `true`, so a target that declares nothing is a target
 *   that inlines fonts. Leaving it absent would leave the fetch in place, which
 *   is the whole defect.
 *
 * Returns null when nothing needs to change, so a caller can tell "already
 * correct" from "corrected" without comparing values.
 */
export function fontInliningDisabled(declared: unknown): unknown | null {
	if (declared === false) return null;
	if (declared === undefined || declared === true)
		return Object.freeze({ scripts: true, styles: true, fonts: FONTS_NOT_INLINED });
	if (typeof declared !== 'object' || declared === null || Array.isArray(declared)) return null;
	const object = declared as Readonly<Record<string, unknown>>;
	const fonts = object['fonts'];
	if (fonts === false) return null;
	if (typeof fonts === 'object' && fonts !== null && !Array.isArray(fonts))
		if ((fonts as Record<string, unknown>)['inline'] === false) return null;
	return Object.freeze({ ...object, fonts: FONTS_NOT_INLINED });
}

/**
 * The declared-difference line for one target or configuration whose font
 * inlining this capability turned off.
 *
 * Written per site rather than once per workspace, because a reader auditing a
 * particular build configuration should find the difference recorded against
 * that configuration and not have to infer it from a workspace-level note.
 */
export function fontInliningDifference(at: string, cell: AngularTargetCell): string {
	return (
		`${at} builds with font inlining disabled (\`optimization.fonts.inline: false\`). On the ` +
		`${cell.angularLine} line that option defaults to on, and it makes the build itself fetch ` +
		'every Google Fonts and Adobe Fonts stylesheet the application links and paste the answer ' +
		'into the emitted index.html. The era build did no such thing: it emitted the ' +
		"application's own link element and the browser fetched the stylesheet at runtime. This " +
		'cell keeps that behaviour — the migrated document ships the same link and the same runtime ' +
		'fetch — rather than moving a third-party request into the build, where it would make the ' +
		'emitted bytes depend on what a font host served on the build day and on whether the build ' +
		'host could reach it at all. Inlining would not have removed the runtime request in any ' +
		'case: the inlined stylesheet still points at the font host for the font files themselves.'
	);
}
