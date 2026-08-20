import { analyze, langFromPath, sourceTypeFromPath } from 'yuku-analyzer';

/**
 * Reusable capabilities for lifting a statically-exported Next.js pages/ router
 * application onto a plain React build.
 *
 * The migration this addresses is narrower than "migrate Next.js", and the
 * narrowness is the whole point. A Next application that emits its route set as
 * static documents — `next build && next export` — is not using the framework as
 * a server. It is using it as a bundler, a build-time data hook, and a small
 * client component library. Everything the framework contributes at runtime to
 * such an application is a handful of components whose semantics are fully
 * described by the framework's own documentation, and every one of them has a
 * plain-React reading.
 *
 * What is deliberately NOT addressed here, and is refused rather than
 * approximated:
 *
 * - Server rendering of any kind. Nothing below pre-renders a document.
 * - More than one authored route. There is no router in this adapter, so an
 *   application whose navigation is client-side across routes is out of scope.
 * - API routes, middleware, and the whole `next/server` surface.
 * - Every framework module outside the small lift table below.
 *
 * A capability that met one of those would have to invent behaviour, and an
 * invented behaviour that happens to build is exactly the failure a migration
 * receipt is supposed to catch. So each is a named refusal.
 *
 * Every export here is application agnostic. The shapes handled are the ones
 * Next.js itself defines — its framework module specifiers, its data-fetching
 * export names, its `pages/_app` contract, its `#__next` mount element, and its
 * `next/babel` preset options — and no capability branches on an application
 * name, revision, or source string.
 */

/** Local to this module: the CRA adapter exports the same ordering under its own name. */
function compareUtf16CodeUnits(left: string, right: string): number {
	if (left === right) return 0;
	return left < right ? -1 : 1;
}

type EstreeNode = Readonly<Record<string, unknown>>;

function span(node: EstreeNode): Readonly<{ start: number; end: number }> | null {
	const start = node['start'];
	const end = node['end'];
	if (typeof start === 'number' && typeof end === 'number') return { start, end };
	const range = node['range'];
	if (Array.isArray(range) && typeof range[0] === 'number' && typeof range[1] === 'number')
		return { start: range[0], end: range[1] };
	return null;
}

/* -------------------------------------------------------------------------- */
/* The framework surface table                                                 */
/* -------------------------------------------------------------------------- */

/** The module id the lifted `next/head` component is served from. */
export const nextStaticHeadModuleId = 'virtual:versionless-next-static-head';

/** The module id the lifted `next/link` component is served from. */
export const nextStaticLinkModuleId = 'virtual:versionless-next-static-link';

/** The module id the synthesised client entry is served from. */
export const nextStaticEntryModuleId = 'virtual:versionless-next-static-entry';

/**
 * What happens to one Next framework module specifier.
 *
 * - `component`: the framework component is replaced by a lifted implementation
 *   whose semantics are stated in that implementation's own source.
 * - `type-only`: the specifier contributes nothing at runtime, and the import is
 *   erased — but only after the analyzer has proved that every binding it
 *   introduces is referenced from type positions alone. A value reference to one
 *   of these turns the erasure into a refusal, because erasing a live binding
 *   would produce a bundle that builds and then throws.
 */
export type NextStaticLiftKind = 'component' | 'type-only';

export type NextStaticLift = Readonly<{
	kind: NextStaticLiftKind;
	/** The module the specifier is rewritten to, or null for an erasure. */
	module: string | null;
	note: string;
}>;

/**
 * The Next framework specifiers this adapter lifts, and nothing else.
 *
 * The table is short on purpose. It was built by reading which framework modules
 * a statically-exported pages/ application actually reaches for, and each entry
 * exists because a lift for it could be written from Next's own documented
 * semantics rather than guessed from behaviour.
 */
export const nextStaticFrameworkLifts: Readonly<Record<string, NextStaticLift>> = Object.freeze({
	next: Object.freeze({
		kind: 'type-only',
		module: null,
		note:
			"The framework's root module exports the data-fetching and page type aliases " +
			'(`GetStaticProps`, `NextPage`, and friends). They are erased at compile time, so an ' +
			'import of them contributes nothing to a bundle — provided every binding really is ' +
			'used as a type, which is proved rather than assumed.',
	}),
	'next/app': Object.freeze({
		kind: 'type-only',
		module: null,
		note:
			'`AppProps` is the only thing a `pages/_app` module takes from here. The default ' +
			'export of `next/app` — the `App` class component — is a server-side surface a static ' +
			'export never reaches; a value import of it is refused rather than erased.',
	}),
	'next/head': Object.freeze({
		kind: 'component',
		module: nextStaticHeadModuleId,
		note:
			'`Head` collects element children and applies them to the document head. The lift ' +
			'below performs the same application through a React portal.',
	}),
	'next/link': Object.freeze({
		kind: 'component',
		module: nextStaticLinkModuleId,
		note:
			"`Link` in Next 12's legacy behaviour decorates its single child element with an " +
			'`href` and, when a router is present, intercepts the click. The lift below performs ' +
			'the decoration and leaves the navigation to the browser, which is what a statically ' +
			'exported single-route application already did.',
	}),
});

/**
 * Next framework modules this adapter knows about and refuses, with the reason.
 *
 * A specifier absent from both tables is refused too, by the generic path. These
 * entries exist so the common cases fail with a diagnostic that names the actual
 * obstacle instead of "unknown module".
 */
export const nextStaticUnsupportedSpecifiers: Readonly<Record<string, string>> = Object.freeze({
	'next/amp': 'AMP is a separate rendering pipeline with no plain-React reading.',
	'next/config':
		'Runtime configuration is read from a server the static export does not have; the ' +
		'`publicRuntimeConfig` half would need a build-time channel this adapter does not define.',
	'next/document':
		'The custom document is a server-rendering hook. A statically exported application that ' +
		'defines one is shaping markup this adapter does not produce, so its document would be ' +
		'silently dropped.',
	'next/dynamic':
		'Dynamic import with a loading state and optional SSR opt-out. The code-splitting half ' +
		'has a plain reading, the SSR half does not, and splitting them apart silently would ' +
		'change which chunks exist.',
	'next/error':
		'The framework error page is reached through the framework router, which this adapter ' +
		'does not provide.',
	'next/head-manager-context': 'A framework-internal context with no documented contract.',
	'next/image':
		'The image component depends on the framework image optimiser, a server. Rendering it as ' +
		'a bare `<img>` would drop the sizing, loading and srcset behaviour the markup relies on.',
	'next/router':
		'The client router. An application that reads it has navigation state, which a ' +
		'single-document static lift cannot reproduce.',
	'next/script':
		'The script component schedules loading against framework lifecycle strategies that only ' +
		'exist inside the framework runtime.',
	'next/server':
		'Middleware and edge runtime surface. There is no server in a static export at all.',
});

/**
 * The build-time data-fetching export this adapter can lift, and the ones it
 * refuses.
 *
 * `getStaticProps` is liftable because it is a pure build-time function of no
 * request: the static export calls it once, serialises the result, and hands it
 * to the page. The lift below calls the very same function from the client entry
 * and hands the result to the very same page, so the props the page receives are
 * produced by the application's own code rather than by a re-implementation of
 * it.
 *
 * The rest are refused. `getServerSideProps` is per-request by definition;
 * `getStaticPaths` describes a route set this adapter has no router for;
 * `getInitialProps` runs on both sides of a boundary that does not exist here.
 */
export const nextStaticLiftableDataFetchingExport = 'getStaticProps';

export const nextStaticUnsupportedDataFetchingExports: Readonly<Record<string, string>> =
	Object.freeze({
		config:
			'The page config export selects framework rendering modes (AMP, runtime, ' +
			'`unstable_runtimeJS`) that a plain React build has no reading for.',
		getInitialProps:
			'It runs on the server for the first request and on the client afterwards. A static ' +
			'lift has only one of those halves and would silently pick it.',
		getServerSideProps:
			'It is a per-request function. A static export cannot call it at all, so an ' +
			'application that has one was never statically exportable in the first place.',
		getStaticPaths:
			'It enumerates a dynamic route set. This adapter emits one document and has no ' +
			'router, so every path but one would vanish without a diagnostic.',
	});

const nextSpecifierPrefix = 'next/';

/** True when an import specifier names the Next framework rather than a file. */
export function isNextFrameworkSpecifier(specifier: string): boolean {
	return specifier === 'next' || specifier.startsWith(nextSpecifierPrefix);
}

/** The lift for a framework specifier, or null when this adapter has no reading for it. */
export function nextStaticFrameworkLift(specifier: string): NextStaticLift | null {
	return Object.hasOwn(nextStaticFrameworkLifts, specifier)
		? (nextStaticFrameworkLifts[specifier] as NextStaticLift)
		: null;
}

/* -------------------------------------------------------------------------- */
/* The analyzer-driven scan                                                    */
/* -------------------------------------------------------------------------- */

export type NextStaticImportUse = Readonly<{
	specifier: string;
	kind: NextStaticLiftKind;
	/** Local binding names introduced by the declaration, sorted. */
	bindings: readonly string[];
}>;

export type NextStaticRewrite = Readonly<{ start: number; end: number; replacement: string }>;

export type NextStaticSurfaceScan = Readonly<{
	/** Framework imports that were understood, in source order. */
	imports: readonly NextStaticImportUse[];
	/** Data-fetching export names the module declares, sorted. */
	dataFetchingExports: readonly string[];
	rewrites: readonly NextStaticRewrite[];
	diagnostics: readonly string[];
}>;

const assetModuleExtension = '.svg';

function importDeclarationBindings(node: EstreeNode): readonly EstreeNode[] {
	const specifiers = node['specifiers'];
	if (!Array.isArray(specifiers)) return [];
	const locals: EstreeNode[] = [];
	for (const entry of specifiers) {
		if (typeof entry !== 'object' || entry === null) continue;
		const local = (entry as EstreeNode)['local'];
		if (typeof local === 'object' && local !== null) locals.push(local as EstreeNode);
	}
	return locals;
}

function declarationIsTypeOnly(node: EstreeNode): boolean {
	return node['importKind'] === 'type';
}

function specifierIsTypeOnly(node: EstreeNode): boolean {
	return node['importKind'] === 'type';
}

/**
 * Scan one application module for the Next framework surface it uses and
 * compute the edits that lift it.
 *
 * The scan rides a real parse and a real scope resolution. A framework
 * specifier is recognised from the import declaration's source string, never
 * from a substring search, so a `next/head` inside a comment or a string
 * literal is invisible to it. A type-only erasure is decided from the resolved
 * reference table: the declaration is erased only when every binding it
 * introduces is either declared `import type` or referenced exclusively from
 * type positions, so erasing a binding some expression still evaluates is not
 * possible by construction.
 */
export function scanNextStaticSurface(code: string, id = 'module.tsx'): NextStaticSurfaceScan {
	const module = analyze(code, {
		path: id,
		lang: langFromPath(id),
		sourceType: sourceTypeFromPath(id),
	});
	const errors = module.diagnostics.filter((entry) => entry.severity === 'error');
	if (errors.length > 0)
		return Object.freeze({
			imports: [],
			dataFetchingExports: [],
			rewrites: [],
			diagnostics: errors.map((entry) => entry.message),
		});

	const imports: NextStaticImportUse[] = [];
	const rewrites: NextStaticRewrite[] = [];
	const diagnostics: string[] = [];

	for (const declaration of module.findAll('ImportDeclaration')) {
		const node = declaration as unknown as EstreeNode;
		const source = node['source'];
		if (typeof source !== 'object' || source === null) continue;
		const value = (source as EstreeNode)['value'];
		if (typeof value !== 'string') continue;
		if (value.endsWith(assetModuleExtension)) {
			diagnostics.push(
				`${value} is imported as a module. The legacy build resolved that through an SVG ` +
					`loader configured in next.config.js, and this adapter reproduces no loader ` +
					`configuration, so the import would resolve to a different value after the lift`,
			);
			continue;
		}
		if (!isNextFrameworkSpecifier(value)) continue;

		const lift = nextStaticFrameworkLift(value);
		if (lift === null) {
			const known = Object.hasOwn(nextStaticUnsupportedSpecifiers, value)
				? (nextStaticUnsupportedSpecifiers[value] as string)
				: 'This adapter has never been taught this framework module.';
			diagnostics.push(`${value} has no lift: ${known}`);
			continue;
		}

		const locals = importDeclarationBindings(node);
		const bindings = locals
			.map((local) => local['name'])
			.filter((name): name is string => typeof name === 'string')
			.sort(compareUtf16CodeUnits);

		if (lift.kind === 'component') {
			const sourceSpan = span(source as EstreeNode);
			if (sourceSpan === null) {
				diagnostics.push(`the import of ${value} has no readable span`);
				continue;
			}
			rewrites.push({
				start: sourceSpan.start,
				end: sourceSpan.end,
				replacement: JSON.stringify(lift.module),
			});
			imports.push({ specifier: value, kind: lift.kind, bindings });
			continue;
		}

		// A type-only lift. Every binding has to be proved dead at runtime before
		// the declaration may be erased.
		const live: string[] = [];
		const declarationTypeOnly = declarationIsTypeOnly(node);
		const specifiers = Array.isArray(node['specifiers']) ? node['specifiers'] : [];
		for (const entry of specifiers) {
			if (typeof entry !== 'object' || entry === null) continue;
			const specifierNode = entry as EstreeNode;
			if (declarationTypeOnly || specifierIsTypeOnly(specifierNode)) continue;
			const local = specifierNode['local'];
			if (typeof local !== 'object' || local === null) continue;
			const symbol = module.symbolOf(local as never);
			const name = (local as EstreeNode)['name'];
			if (symbol === null) {
				if (typeof name === 'string') live.push(name);
				continue;
			}
			const valueReferences = symbol.references.filter(
				(reference) => !reference.inTypePosition,
			);
			if (valueReferences.length > 0 && typeof symbol.name === 'string')
				live.push(symbol.name);
		}
		if (live.length > 0) {
			diagnostics.push(
				`${value} contributes only compile-time types to a static lift, but ` +
					`${live.sort(compareUtf16CodeUnits).join(', ')} ` +
					`${live.length === 1 ? 'is' : 'are'} referenced from a value position, so erasing ` +
					`the import would leave the bundle to fail at evaluation`,
			);
			continue;
		}
		const declarationSpan = span(node);
		if (declarationSpan === null) {
			diagnostics.push(`the import of ${value} has no readable span`);
			continue;
		}
		rewrites.push({ start: declarationSpan.start, end: declarationSpan.end, replacement: '' });
		imports.push({ specifier: value, kind: lift.kind, bindings });
	}

	const dataFetchingExports = new Set<string>();
	for (const record of module.exports) {
		const name = record.name;
		if (name === null || record.typeOnly) continue;
		if (name === nextStaticLiftableDataFetchingExport) {
			dataFetchingExports.add(name);
			continue;
		}
		if (Object.hasOwn(nextStaticUnsupportedDataFetchingExports, name)) {
			dataFetchingExports.add(name);
			diagnostics.push(
				`the module exports ${name}, which this adapter refuses: ` +
					`${nextStaticUnsupportedDataFetchingExports[name] as string}`,
			);
		}
	}

	return Object.freeze({
		imports: Object.freeze(imports),
		dataFetchingExports: Object.freeze([...dataFetchingExports].sort(compareUtf16CodeUnits)),
		rewrites: Object.freeze(rewrites),
		diagnostics: Object.freeze(diagnostics),
	});
}

/**
 * The module source with its Next framework imports lifted. A module that names
 * no framework specifier is returned byte-identical, and a module whose surface
 * this adapter cannot lift raises rather than emitting a partial edit — a
 * half-lifted module is the one outcome worse than a refusal, because it builds.
 */
export function liftNextStaticModule(code: string, id = 'module.tsx'): string {
	const scan = scanNextStaticSurface(code, id);
	if (scan.diagnostics.length > 0)
		throw new Error(
			`Next static migration: ${id} uses a Next.js surface this adapter does not lift. ` +
				`Nothing in this module was rewritten, because a partially lifted module would ` +
				`build and then differ from the application it replaced. ` +
				`Diagnostics: ${scan.diagnostics.join('; ')}`,
		);
	if (scan.rewrites.length === 0) return code;
	const ordered = [...scan.rewrites].sort((left, right) => right.start - left.start);
	let output = code;
	for (const rewrite of ordered)
		output = `${output.slice(0, rewrite.start)}${rewrite.replacement}${output.slice(rewrite.end)}`;
	return output;
}

/* -------------------------------------------------------------------------- */
/* The lifted framework components                                             */
/* -------------------------------------------------------------------------- */

/**
 * The lifted `next/head`.
 *
 * Next's own client-side head manager collects the element children of every
 * mounted `Head`, deduplicates them, and applies the result to `document.head`.
 * A React portal performs the same application: the children are rendered as
 * real elements into the live document head, they are removed when the owning
 * component unmounts, and they update when their props do. What the portal does
 * not reproduce is Next's deduplication across several simultaneously-mounted
 * `Head` elements and its `next-head-count` bookkeeping; both exist to let a
 * server-rendered head be reconciled by the client, and neither has any subject
 * to act on in a build that renders the head on the client only.
 *
 * The consequence is stated rather than hidden: in a statically exported build
 * the head elements are present in the delivered document, and after this lift
 * they are installed when the application mounts. Anything that reads the
 * document without evaluating its scripts therefore sees a different head. That
 * is a real difference in kind and belongs in a migration's recorded
 * differences, not in a footnote.
 */
export function nextStaticHeadModuleSource(): string {
	return [
		"import { createPortal } from 'react-dom';",
		'',
		'export default function Head({ children }) {',
		"\tif (typeof document === 'undefined') return null;",
		'\treturn createPortal(children, document.head);',
		'}',
		'',
	].join('\n');
}

/**
 * The lifted `next/link`, in Next 12's legacy child-decorating behaviour.
 *
 * Next 12's `Link` renders no element of its own. It takes exactly one child
 * element and clones it with an `href` — always when `passHref` is set, and
 * otherwise only when the child is an anchor that does not already carry one —
 * and it installs a click handler that asks the framework router to navigate
 * without a document load. The clone is reproduced here exactly. The click
 * handler is not, and is not approximated: there is no router in this adapter,
 * so the anchor's own navigation is what happens. In a statically exported
 * application whose route set is a single document, the two coincide in effect;
 * across several routes they do not, which is precisely why multi-route
 * applications are outside this adapter's stated scope.
 *
 * The framework's navigation-shaping props are accepted and dropped, because
 * dropping them is what having no router means. They are named individually so
 * that a prop nobody has considered is passed through to the child and shows up
 * as an unexpected DOM attribute rather than disappearing.
 */
export function nextStaticLinkModuleSource(): string {
	return [
		"import { Children, cloneElement, isValidElement } from 'react';",
		'',
		'export default function Link(props) {',
		'\tconst {',
		'\t\tchildren,',
		'\t\thref,',
		'\t\tas: alias,',
		'\t\tpassHref,',
		'\t\treplace,',
		'\t\tscroll,',
		'\t\tshallow,',
		'\t\tprefetch,',
		'\t\tlocale,',
		'\t\tlegacyBehavior,',
		'\t\t...rest',
		'\t} = props;',
		'\tconst target = alias === undefined ? href : alias;',
		"\tif (typeof target !== 'string')",
		'\t\tthrow new Error(',
		"\t\t\t'Next static migration: this lift of next/link resolves string hrefs only. A URL " +
			"object href describes a route this build has no router to format.',",
		'\t\t);',
		'\tconst child = Children.only(children);',
		'\tif (!isValidElement(child))',
		'\t\tthrow new Error(',
		"\t\t\t'Next static migration: this lift of next/link decorates a single child element, " +
			"which is what next/link 12 required of its legacy behaviour.',",
		'\t\t);',
		"\tconst decorate = passHref === true || (child.type === 'a' && child.props.href === undefined);",
		'\treturn cloneElement(child, decorate ? { ...rest, href: target } : rest);',
		'}',
		'',
	].join('\n');
}

/* -------------------------------------------------------------------------- */
/* Entry and document synthesis                                                */
/* -------------------------------------------------------------------------- */

/**
 * How the lifted entry hands its tree to the DOM. `legacy` is `ReactDOM.render`,
 * the only client API React 17 — the React line the pages/ router era shipped
 * against — offers. `root` is the React 18 client root. The choice belongs to
 * whichever React the migrated closure actually contains and is therefore stated
 * by the caller, never sniffed.
 */
export type NextStaticMountApi = 'legacy' | 'root';

/** The element id Next mounts a pages/ router application into. */
export const nextStaticRootElementId = '__next';

export type NextStaticEntryOptions = Readonly<{
	/** The module specifier of the application's `pages/_app`, or null when it has none. */
	appModule: string | null;
	/** The module specifier of the page being lifted. */
	pageModule: string;
	/** Whether the page module exports `getStaticProps`. */
	hasStaticProps: boolean;
	mountApi?: NextStaticMountApi;
	rootElementId?: string;
}>;

/**
 * The client entry a lifted static page is mounted by.
 *
 * The shape reproduces what the framework's own client runtime does for a
 * statically exported page, minus everything that needs a router: it imports
 * the page, imports `pages/_app` when the application defines one, obtains the
 * page's props, and renders `<App Component={Page} pageProps={props} />`. That
 * composition is the framework's documented `pages/_app` contract, so an
 * application's own `_app` keeps receiving what it was written to receive.
 *
 * Props come from calling the application's own `getStaticProps`. In the export
 * this replaces, the framework called that same function at build time and
 * serialised the result into the document; here it is called once as the
 * application starts. The function is the application's, not a copy of it, so
 * whatever it computes is unchanged — but *when* it runs moves from build time
 * to load time, and a `getStaticProps` that reads the build host's filesystem or
 * environment would not survive the move. That is a real limit of this lift and
 * a reason an application is measured after it rather than assumed.
 *
 * `notFound` and `redirect` results are refused loudly at runtime: both are
 * routing outcomes, and a build with no router that silently rendered the page
 * anyway would be showing something the framework would not have shown.
 */
export function nextStaticEntryModuleSource(options: NextStaticEntryOptions): string {
	const mountApi = options.mountApi ?? 'legacy';
	const rootElementId = options.rootElementId ?? nextStaticRootElementId;
	const page = JSON.stringify(options.pageModule);
	const lines: string[] = ["import { createElement } from 'react';"];
	if (mountApi === 'legacy') lines.push("import { render } from 'react-dom';");
	else lines.push("import { createRoot } from 'react-dom/client';");
	if (options.appModule !== null)
		lines.push(`import App from ${JSON.stringify(options.appModule)};`);
	lines.push(
		options.hasStaticProps
			? `import Page, { ${nextStaticLiftableDataFetchingExport} } from ${page};`
			: `import Page from ${page};`,
		'',
		`const container = document.getElementById(${JSON.stringify(rootElementId)});`,
		'if (container === null)',
		'\tthrow new Error(',
		`\t\t'Next static migration: the entry document has no #${rootElementId} element to mount into.',`,
		'\t);',
		'',
		'function mount(pageProps) {',
		options.appModule === null
			? '\tconst tree = createElement(Page, pageProps);'
			: '\tconst tree = createElement(App, { Component: Page, pageProps });',
		mountApi === 'legacy'
			? '\trender(tree, container);'
			: '\tcreateRoot(container).render(tree);',
		'}',
		'',
	);
	if (options.hasStaticProps)
		lines.push(
			`Promise.resolve(${nextStaticLiftableDataFetchingExport}({ params: {} })).then((result) => {`,
			"\tif (result === null || typeof result !== 'object')",
			'\t\tthrow new Error(',
			`\t\t\t'Next static migration: ${nextStaticLiftableDataFetchingExport} returned no result object.',`,
			'\t\t);',
			"\tif ('notFound' in result || 'redirect' in result)",
			'\t\tthrow new Error(',
			`\t\t\t'Next static migration: ${nextStaticLiftableDataFetchingExport} asked for a routing outcome (notFound or redirect), which a build with no router cannot honour.',`,
			'\t\t);',
			"\tmount('props' in result ? result.props : {});",
			'});',
			'',
		);
	else lines.push('mount({});', '');
	return lines.join('\n');
}

export type NextStaticDocumentOptions = Readonly<{
	entryModule: string;
	rootElementId?: string;
	/** The `lang` attribute a custom document would have set, when there is one. */
	lang?: string;
}>;

/**
 * The entry document a lifted static page is served from.
 *
 * It is deliberately the smallest document that can host the application: the
 * mount element the framework's own export emits, and the module script. Every
 * other element the exported document carried — the head contents, the
 * stylesheet links, the preloads — was produced by the framework from the
 * application's own source, and after the lift they are produced from that same
 * source by the bundler and by the lifted `Head`. Writing them here as well
 * would be this adapter asserting markup it did not derive.
 */
export function nextStaticEntryDocument(options: NextStaticDocumentOptions): string {
	const rootElementId = options.rootElementId ?? nextStaticRootElementId;
	const html = options.lang === undefined ? '<html>' : `<html lang="${options.lang}">`;
	return [
		'<!DOCTYPE html>',
		html,
		'\t<head>',
		'\t\t<meta charSet="utf-8" />',
		'\t</head>',
		'\t<body>',
		`\t\t<div id="${rootElementId}"></div>`,
		`\t\t<script type="module" src="${options.entryModule}"></script>`,
		'\t</body>',
		'</html>',
		'',
	].join('\n');
}

/* -------------------------------------------------------------------------- */
/* Compile-time environment                                                    */
/* -------------------------------------------------------------------------- */

export type NextEnvironment = Readonly<Record<string, string>>;

/**
 * The compile-time `process.env` replacements a Next build performs.
 *
 * Next inlines `process.env.NODE_ENV` into every bundled module, and it inlines
 * one entry per key of the `env` object a `next.config.js` declares. Both are
 * literal source substitutions, exactly like the ones a Vite `define` map
 * performs, so the translation is a table rather than a behaviour.
 *
 * The whole `process.env` object is defined as well, for the same reason the
 * create-react-app adapter defines it: a module that reads the object
 * dynamically finds an object rather than an undefined global.
 */
export function nextProcessEnvironmentDefines(
	environment: NextEnvironment,
): Readonly<Record<string, string>> {
	const keys = Object.keys(environment).sort(compareUtf16CodeUnits);
	const sorted = Object.fromEntries(keys.map((key) => [key, environment[key] as string]));
	return Object.freeze({
		...Object.fromEntries(
			keys.map((key) => [`process.env.${key}`, JSON.stringify(environment[key])]),
		),
		'process.env': JSON.stringify(sorted),
	});
}

/* -------------------------------------------------------------------------- */
/* The next/babel preset translation                                           */
/* -------------------------------------------------------------------------- */

export type NextJsxTranslation = Readonly<{
	runtime: 'automatic' | 'classic';
	importSource: string | null;
}>;

export type NextBabelPresetPlan = Readonly<{
	jsx: NextJsxTranslation;
	/** Babel plugins the file declares that this translation does not reproduce. */
	omittedPlugins: readonly string[];
	notes: readonly string[];
}>;

/** The default JSX reading of `next/babel` with no `preset-react` options. */
const nextBabelDefaultJsx: NextJsxTranslation = Object.freeze({
	runtime: 'automatic',
	importSource: null,
});

/**
 * The Babel plugins a `next/babel` configuration may carry that this translation
 * knowingly does not reproduce, and what is lost with each.
 *
 * The entries are not "safe to drop" — they are "dropped, and here is what that
 * costs". A plugin absent from this table refuses the plan, because a Babel
 * plugin nobody has read is a transform of unknown effect on the emitted code.
 */
export const nextBabelOmittedPlugins: Readonly<Record<string, string>> = Object.freeze({
	'@emotion/babel-plugin':
		'It adds component labels, source maps and style minification to the styles the Emotion ' +
		'JSX runtime already produces. The runtime — selected by the JSX importSource this plan ' +
		'carries — is what makes the css prop work at all; the plugin is developer ergonomics on ' +
		'top of it. Dropping it changes generated class names, which is visible in emitted CSS ' +
		'and is therefore a recorded difference, not an invisible one.',
});

const nextBabelPresetName = 'next/babel';

function presetName(entry: unknown): string | null {
	if (typeof entry === 'string') return entry;
	if (Array.isArray(entry) && typeof entry[0] === 'string') return entry[0];
	return null;
}

function presetOptions(entry: unknown): Record<string, unknown> {
	if (Array.isArray(entry) && typeof entry[1] === 'object' && entry[1] !== null)
		return entry[1] as Record<string, unknown>;
	return {};
}

/**
 * Translate a `.babelrc` that configures `next/babel` into the JSX settings a
 * plain bundler needs, or refuse.
 *
 * This is the one piece of a legacy Next build that a bundler swap genuinely
 * cannot infer. `next/babel` is a meta-preset: it decides the JSX runtime and,
 * through its `preset-react` options, which library's JSX factory every element
 * in the application compiles to. An application that points that at a
 * CSS-in-JS library's runtime is compiling every element through that library,
 * and a migrated build that silently used the default React runtime instead
 * would compile, render, and lose every style.
 *
 * A configuration naming any preset other than `next/babel`, or carrying a
 * plugin outside the table above, is refused rather than partially read.
 */
export function planNextBabelPreset(
	configuration: unknown,
	origin = '.babelrc',
): NextBabelPresetPlan {
	if (typeof configuration !== 'object' || configuration === null)
		throw new Error(`Next static migration: ${origin} is not a Babel configuration object.`);
	const record = configuration as Record<string, unknown>;
	const presets = Array.isArray(record['presets']) ? record['presets'] : [];
	const plugins = Array.isArray(record['plugins']) ? record['plugins'] : [];

	const foreign = presets
		.map((entry) => presetName(entry))
		.filter((name): name is string => name !== null && name !== nextBabelPresetName)
		.sort(compareUtf16CodeUnits);
	if (foreign.length > 0)
		throw new Error(
			`Next static migration: ${origin} declares the Babel preset(s) ${foreign.join(', ')} ` +
				`alongside ${nextBabelPresetName}. This translation reads ${nextBabelPresetName} ` +
				`only, and a preset it has not read may transform the emitted code in ways the ` +
				`migrated build would not reproduce.`,
		);

	const unknownPlugins = plugins
		.map((entry) => presetName(entry))
		.filter(
			(name): name is string =>
				name !== null && !Object.hasOwn(nextBabelOmittedPlugins, name),
		)
		.sort(compareUtf16CodeUnits);
	if (unknownPlugins.length > 0)
		throw new Error(
			`Next static migration: ${origin} declares the Babel plugin(s) ` +
				`${unknownPlugins.join(', ')}, which this translation has no reading for. A Babel ` +
				`plugin nobody has read transforms the emitted code by an unknown amount, so the ` +
				`plan refuses rather than dropping it.`,
		);

	const next = presets.find((entry) => presetName(entry) === nextBabelPresetName);
	const react = presetOptions(next)['preset-react'];
	const reactOptions =
		typeof react === 'object' && react !== null ? (react as Record<string, unknown>) : {};
	const runtime = reactOptions['runtime'];
	const importSource = reactOptions['importSource'];
	const jsx: NextJsxTranslation =
		next === undefined
			? nextBabelDefaultJsx
			: Object.freeze({
					runtime: runtime === 'classic' ? 'classic' : 'automatic',
					importSource: typeof importSource === 'string' ? importSource : null,
				});

	const omittedPlugins = plugins
		.map((entry) => presetName(entry))
		.filter((name): name is string => name !== null)
		.sort(compareUtf16CodeUnits);

	return Object.freeze({
		jsx,
		omittedPlugins: Object.freeze(omittedPlugins),
		notes: Object.freeze(
			omittedPlugins.map((name) => `${name}: ${nextBabelOmittedPlugins[name] as string}`),
		),
	});
}

/** Parse and translate a `.babelrc` document. */
export function planNextBabelPresetSource(
	source: string,
	origin = '.babelrc',
): NextBabelPresetPlan {
	let parsed: unknown;
	try {
		parsed = JSON.parse(source);
	} catch (error) {
		throw new Error(
			`Next static migration: ${origin} is not readable as JSON: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	}
	return planNextBabelPreset(parsed, origin);
}

/* -------------------------------------------------------------------------- */
/* The plugin set                                                              */
/* -------------------------------------------------------------------------- */

function pathWithoutQuery(id: string): string {
	const index = id.indexOf('?');
	return index === -1 ? id : id.slice(0, index);
}

const liftableExtensions: ReadonlySet<string> = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs']);
const dependencyDirectorySegment = 'node_modules';

function extensionOf(file: string): string {
	const index = file.lastIndexOf('.');
	const slash = file.lastIndexOf('/');
	return index > slash && index !== -1 ? file.slice(index) : '';
}

export type NextStaticLiftRecord = Readonly<{
	id: string;
	imports: readonly NextStaticImportUse[];
	dataFetchingExports: readonly string[];
}>;

export type NextStaticTransformResult = Readonly<{ code: string; map: null }>;
export type NextStaticTransformPlugin = Readonly<{
	name: string;
	enforce: 'pre';
	transform(code: string, id: string): NextStaticTransformResult | null;
}>;

export type NextStaticVirtualPlugin = Readonly<{
	name: string;
	enforce: 'pre';
	resolveId(source: string): string | null;
	load(id: string): string | null;
}>;

export type NextStaticLiftOptions = Readonly<{
	observe?: (record: NextStaticLiftRecord) => void;
}>;

/**
 * Lift the Next framework surface out of every first-party module the build
 * reaches.
 *
 * The dependency closure is excluded, and that exclusion is load bearing: a
 * dependency that imports from `next` is a dependency written for the framework
 * runtime, and rewriting its imports would be this adapter claiming to have
 * migrated a package it has never read. Such a package reaching the graph is a
 * refusal — it simply arrives as an unresolved `next` import instead of a
 * silently rewritten one.
 */
export function createNextStaticLiftPlugin(
	options: NextStaticLiftOptions = {},
): NextStaticTransformPlugin {
	return {
		name: 'versionless-next-static-lift',
		enforce: 'pre',
		transform(code, id) {
			if (id.startsWith('\0')) return null;
			const file = pathWithoutQuery(id);
			if (file.split('/').includes(dependencyDirectorySegment)) return null;
			if (!liftableExtensions.has(extensionOf(file))) return null;
			const scan = scanNextStaticSurface(code, file);
			if (scan.diagnostics.length > 0) {
				// A parse failure is not this capability's business: Vite's own
				// pipeline reports it with far better provenance. Only a genuine
				// framework-surface refusal is raised here.
				if (
					scan.imports.length === 0 &&
					scan.rewrites.length === 0 &&
					!code.includes('next')
				)
					return null;
				throw new Error(
					`Next static migration: ${file} uses a Next.js surface this adapter does not ` +
						`lift. Diagnostics: ${scan.diagnostics.join('; ')}`,
				);
			}
			if (scan.imports.length > 0 || scan.dataFetchingExports.length > 0)
				options.observe?.({
					id: file,
					imports: scan.imports,
					dataFetchingExports: scan.dataFetchingExports,
				});
			if (scan.rewrites.length === 0) return null;
			const ordered = [...scan.rewrites].sort((left, right) => right.start - left.start);
			let output = code;
			for (const rewrite of ordered)
				output = `${output.slice(0, rewrite.start)}${rewrite.replacement}${output.slice(
					rewrite.end,
				)}`;
			return { code: output, map: null };
		},
	};
}

export type NextStaticVirtualOptions = Readonly<{
	entry?: NextStaticEntryOptions;
}>;

/** Serve the lifted framework components, and the synthesised entry when one is asked for. */
export function createNextStaticVirtualModulePlugin(
	options: NextStaticVirtualOptions = {},
): NextStaticVirtualPlugin {
	const sources = new Map<string, () => string>([
		[nextStaticHeadModuleId, nextStaticHeadModuleSource],
		[nextStaticLinkModuleId, nextStaticLinkModuleSource],
	]);
	if (options.entry !== undefined) {
		const entry = options.entry;
		sources.set(nextStaticEntryModuleId, () => nextStaticEntryModuleSource(entry));
	}
	return {
		name: 'versionless-next-static-virtual-modules',
		enforce: 'pre',
		resolveId(source) {
			return sources.has(source) ? `\0${source}` : null;
		},
		load(id) {
			if (!id.startsWith('\0')) return null;
			const source = sources.get(id.slice(1));
			return source === undefined ? null : source();
		},
	};
}

export type NextStaticAdapterPlugins = readonly [
	NextStaticTransformPlugin,
	NextStaticVirtualPlugin,
];

export type NextStaticAdapterOptions = NextStaticLiftOptions & NextStaticVirtualOptions;

/**
 * The Next static-export compatibility plugin set: the framework-surface lift
 * and the lifted components it rewrites to.
 *
 * The lift leads, because a module has to have its framework imports resolved
 * to the lifted modules before anything can be asked to load them.
 */
export function createNextStaticAdapter(
	options: NextStaticAdapterOptions = {},
): NextStaticAdapterPlugins {
	return [
		createNextStaticLiftPlugin(
			options.observe === undefined ? {} : { observe: options.observe },
		),
		createNextStaticVirtualModulePlugin(
			options.entry === undefined ? {} : { entry: options.entry },
		),
	];
}
