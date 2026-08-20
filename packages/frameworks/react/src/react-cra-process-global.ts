import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createRegExp, exactly, maybe, whitespace } from 'magic-regexp';
import * as path from 'pathe';
import { analyze, type NodeOfType } from 'yuku-analyzer';

/**
 * The runtime `process` global a create-react-app / webpack 4 browser bundle is
 * authored against, reproduced as an adapter-emitted parity shim.
 *
 * webpack 4 — the bundler create-react-app 3 and 4 pin — injected a functional
 * `process` into every module it bundled for the browser (`node.process`
 * defaults to `true` on that line) sourced from `process/browser`, and inlined
 * `process.env.NODE_ENV` through DefinePlugin. The application and its
 * dependencies genuinely depend on that runtime contract: a bundle reaches for
 * `process.nextTick`, reads `process.browser`, calls `process.cwd`, and tests
 * `process.version`. Vite emits ECMAScript modules and injects no such global,
 * so the first module that dereferences a bare `process` throws
 * `ReferenceError: process is not defined` before the application can mount.
 *
 * Reproducing that global is parity; leaving it out is the divergence. This
 * capability supplies it, and it is disciplined the same way the read-only
 * node-core evaluation shim is — derived from the bytes, only what evaluation
 * reaches, honest leaves, and no branch on which application is being built —
 * with one deliberate difference stated up front:
 *
 * - **Functional, not read-only.** The evaluation shim for a browser-loaded
 *   Node core module refuses a global that is *called*, because an object graph
 *   is not a function. This global is different: the bundle calls
 *   `process.nextTick` and `process.cwd`, and the baseline bundler answered
 *   those calls with real functions from `process/browser`. Parity therefore
 *   means supplying those functions, not refusing them.
 * - **Only what the bundle reaches.** The members supplied are read from the
 *   bundle's own `process.<member>` usage, member by member. A member the bundle
 *   never touches is never supplied — `process.platform`, for instance, is not
 *   emitted unless a read of it is found, exactly as `process/browser` itself
 *   binds nothing there.
 * - **Honest leaves.** `process/browser` defines a bounded surface. A member the
 *   bundle reaches that `process/browser` leaves undefined (`process.stdout`,
 *   `process.pid`) is left undefined here too: the read yields `undefined`,
 *   which is what the baseline bundle honestly had. Nothing is invented to fill
 *   a leaf the baseline did not fill.
 *
 * The surface reproduced is the one `process@0.11.10/browser.js` defines, the
 * exact file webpack 4's `node-libs-browser` table maps a bare `process` import
 * to. It is a stable, documented runtime contract, not an application fact.
 *
 * The shim is delivered through the builder's own seam: an ordinary classic
 * script the adapter injects into the emitted entry document, ahead of the
 * application entry module. A classic script runs at parse time, before any
 * deferred module script, so `globalThis.process` exists before the first
 * application module evaluates. Nothing here edits an application source file.
 */

const CAPABILITY = 'CRA process global parity';

function compareStrings(left: string, right: string): number {
	if (left === right) return 0;
	return left < right ? -1 : 1;
}

/**
 * The extensions this capability analyses. These are the JavaScript and
 * TypeScript module sources a create-react-app bundle is built from; a bare
 * `process` reference can only originate in one of them.
 */
const analyzableModuleExtensions: ReadonlySet<string> = new Set([
	'.cjs',
	'.js',
	'.jsx',
	'.mjs',
	'.ts',
	'.tsx',
]);

function pathWithoutQuery(id: string): string {
	const index = id.indexOf('?');
	return index === -1 ? id : id.slice(0, index);
}

/** True when a module id is an on-disk JavaScript/TypeScript source to analyse. */
export function craModuleIsProcessAnalyzable(id: string): boolean {
	if (id.startsWith('\0')) return false;
	return analyzableModuleExtensions.has(path.extname(pathWithoutQuery(id)));
}

/** One dereference of the `process` global a module performs. */
export type ProcessGlobalReference = Readonly<{
	/** The module the reference was read in. */
	file: string;
	/** The 1-based line the reference sits on. */
	line: number;
	/** Whether the member is invoked (`process.nextTick(...)`) rather than read. */
	called: boolean;
}>;

/** One first-hop member the bundle reaches off `process`, with its references. */
export type ProcessMemberUsage = Readonly<{
	/** The member name, e.g. `nextTick`. */
	member: string;
	/** True when at least one reference invokes the member. */
	called: boolean;
	references: readonly ProcessGlobalReference[];
}>;

/** What a module's (or a bundle's) evaluation asks of the `process` global. */
export type ProcessGlobalReading = Readonly<{
	/** True when `process` is referenced at all, member access or bare value. */
	referenced: boolean;
	/** The first-hop members reached, sorted by name. */
	members: readonly ProcessMemberUsage[];
	/** References to `process` with no member read (`typeof process`, a value). */
	bareReferences: readonly ProcessGlobalReference[];
}>;

const EMPTY_READING: ProcessGlobalReading = Object.freeze({
	referenced: false,
	members: Object.freeze([]),
	bareReferences: Object.freeze([]),
});

type MemberExpressionNode = NodeOfType<'MemberExpression'>;
type CallLikeNode = NodeOfType<'CallExpression'> | NodeOfType<'NewExpression'>;

type AnalyzableLang = 'js' | 'ts' | 'jsx' | 'tsx';

/**
 * Parse a module for analysis, tolerating both ECMAScript modules and the
 * sloppy CommonJS scripts a dependency ships. A module parse is tried first;
 * when it produces errors — a top-level `return`, a CommonJS-only construct —
 * a script parse is tried, because webpack fed those through its script
 * wrapper. A source that parses as neither is refused rather than guessed at.
 */
function parseAnalyzableModule(
	code: string,
	file: string,
	lang: AnalyzableLang,
): ReturnType<typeof analyze> | null {
	for (const sourceType of ['module', 'script'] as const) {
		let module: ReturnType<typeof analyze>;
		try {
			module = analyze(code, {
				path: file,
				lang,
				sourceType,
				allowReturnOutsideFunction: true,
			});
		} catch {
			continue;
		}
		if (!module.diagnostics.some((entry) => entry.severity === 'error')) return module;
	}
	return null;
}

function lineOf(source: string, offset: number): number {
	let line = 1;
	for (let index = 0; index < offset && index < source.length; index += 1)
		if (source.charCodeAt(index) === 10) line += 1;
	return line;
}

/**
 * Read every `process` dereference one module source performs.
 *
 * The unit is the reference: every unresolved `process` identifier is followed
 * one non-computed member hop, and the member it names is recorded together
 * with whether that member is the callee of a call or construction. A `process`
 * identifier that reads no member — `typeof process`, `process` passed as a
 * value — is recorded as a bare reference, because the global still has to exist
 * for it not to throw, even though it names no member to supply.
 */
export function readProcessGlobalUsage(code: string, id = 'input.js'): ProcessGlobalReading {
	const file = pathWithoutQuery(id);
	const lang = file.endsWith('.tsx')
		? 'tsx'
		: file.endsWith('.ts')
			? 'ts'
			: file.endsWith('.jsx')
				? 'jsx'
				: 'js';
	const module = parseAnalyzableModule(code, file, lang);
	if (module === null) return EMPTY_READING;

	const members = new Map<string, { called: boolean; references: ProcessGlobalReference[] }>();
	const bareReferences: ProcessGlobalReference[] = [];
	let referenced = false;

	for (const reference of module.unresolvedReferences) {
		if (reference.name !== 'process') continue;
		if (reference.inTypePosition) continue;
		referenced = true;
		const node = reference.node;
		const line = lineOf(code, node.start);
		const parent = module.parentOf(node);
		if (
			parent === null ||
			parent.type !== 'MemberExpression' ||
			(parent as MemberExpressionNode).object !== node
		) {
			bareReferences.push(Object.freeze({ file, line, called: false }));
			continue;
		}
		const memberExpression = parent as MemberExpressionNode;
		if (memberExpression.computed) {
			// `process[expr]` names no member this reading can state; the global
			// still exists, so it is recorded as a bare reference rather than a
			// member supply.
			bareReferences.push(Object.freeze({ file, line, called: false }));
			continue;
		}
		const property = memberExpression.property;
		if (property.type !== 'Identifier') {
			bareReferences.push(Object.freeze({ file, line, called: false }));
			continue;
		}
		const grandparent = module.parentOf(memberExpression);
		const called =
			grandparent !== null &&
			(grandparent.type === 'CallExpression' || grandparent.type === 'NewExpression') &&
			(grandparent as CallLikeNode).callee === memberExpression;
		const entry = members.get(property.name) ?? { called: false, references: [] };
		entry.called = entry.called || called;
		entry.references.push(Object.freeze({ file, line, called }));
		members.set(property.name, entry);
	}

	if (!referenced) return EMPTY_READING;
	return Object.freeze({
		referenced,
		members: Object.freeze(
			[...members.keys()].sort(compareStrings).map((member) => {
				const entry = members.get(member) as {
					called: boolean;
					references: ProcessGlobalReference[];
				};
				return Object.freeze({
					member,
					called: entry.called,
					references: Object.freeze(
						[...entry.references].sort((left, right) => left.line - right.line),
					),
				});
			}),
		),
		bareReferences: Object.freeze(
			[...bareReferences].sort((left, right) => left.line - right.line),
		),
	});
}

/**
 * Merge a set of per-module readings into one bundle-wide reading. A member
 * supplied by any module is supplied once, its call flag the disjunction of the
 * modules', and its references concatenated in file-then-line order.
 */
export function mergeProcessGlobalReadings(
	readings: readonly ProcessGlobalReading[],
): ProcessGlobalReading {
	const members = new Map<string, { called: boolean; references: ProcessGlobalReference[] }>();
	const bareReferences: ProcessGlobalReference[] = [];
	let referenced = false;
	for (const reading of readings) {
		if (reading.referenced) referenced = true;
		bareReferences.push(...reading.bareReferences);
		for (const usage of reading.members) {
			const entry = members.get(usage.member) ?? { called: false, references: [] };
			entry.called = entry.called || usage.called;
			entry.references.push(...usage.references);
			members.set(usage.member, entry);
		}
	}
	if (!referenced) return EMPTY_READING;
	const referenceOrder = (left: ProcessGlobalReference, right: ProcessGlobalReference): number =>
		compareStrings(left.file, right.file) || left.line - right.line;
	return Object.freeze({
		referenced,
		members: Object.freeze(
			[...members.keys()].sort(compareStrings).map((member) => {
				const entry = members.get(member) as {
					called: boolean;
					references: ProcessGlobalReference[];
				};
				return Object.freeze({
					member,
					called: entry.called,
					references: Object.freeze([...entry.references].sort(referenceOrder)),
				});
			}),
		),
		bareReferences: Object.freeze([...bareReferences].sort(referenceOrder)),
	});
}

/**
 * How `process/browser@0.11.10` supplies one member. `value` members are data,
 * `function` members are callable. A member absent from this table is one
 * `process/browser` leaves undefined — an honest leaf, never invented here.
 */
type ProcessBrowserMember = Readonly<{ kind: 'value' | 'function'; expression: string }>;

/**
 * The `process/browser@0.11.10` surface, member by member, verbatim from the
 * file webpack 4 resolved a bare `process` to. The event-emitter members are
 * the no-ops it installs; `listeners` returns an empty array; `binding` and
 * `chdir` throw the "not supported" errors it throws; `cwd` returns `'/'` and
 * `umask` returns `0`. `nextTick` is special — it needs a scheduler — and is
 * emitted from {@link PROCESS_NEXT_TICK_SOURCE} rather than an expression.
 */
const PROCESS_BROWSER_SURFACE: Readonly<Record<string, ProcessBrowserMember>> = Object.freeze({
	title: { kind: 'value', expression: "'browser'" },
	browser: { kind: 'value', expression: 'true' },
	env: { kind: 'value', expression: '{}' },
	argv: { kind: 'value', expression: '[]' },
	version: { kind: 'value', expression: "''" },
	versions: { kind: 'value', expression: '{}' },
	on: { kind: 'function', expression: 'noop' },
	addListener: { kind: 'function', expression: 'noop' },
	once: { kind: 'function', expression: 'noop' },
	off: { kind: 'function', expression: 'noop' },
	removeListener: { kind: 'function', expression: 'noop' },
	removeAllListeners: { kind: 'function', expression: 'noop' },
	emit: { kind: 'function', expression: 'noop' },
	prependListener: { kind: 'function', expression: 'noop' },
	prependOnceListener: { kind: 'function', expression: 'noop' },
	listeners: { kind: 'function', expression: 'function () { return []; }' },
	binding: {
		kind: 'function',
		expression: "function () { throw new Error('process.binding is not supported'); }",
	},
	cwd: { kind: 'function', expression: "function () { return '/'; }" },
	chdir: {
		kind: 'function',
		expression: "function () { throw new Error('process.chdir is not supported'); }",
	},
	umask: { kind: 'function', expression: 'function () { return 0; }' },
});

/** The member `process/browser` implements with a scheduler rather than a literal. */
const PROCESS_NEXT_TICK = 'nextTick';

/**
 * A faithful `process.nextTick`: a FIFO queue drained on a macrotask, exactly
 * the scheduling `process/browser` uses (`setTimeout(drain, 0)`). Callbacks
 * queued while the queue drains run in the same drain, and the trailing
 * arguments are forwarded to the callback, both as `process/browser` does.
 */
const PROCESS_NEXT_TICK_SOURCE = [
	'var nextTickQueue = [];',
	'var nextTickDraining = false;',
	'function drainNextTick() {',
	'\twhile (nextTickQueue.length) {',
	'\t\tvar tasks = nextTickQueue;',
	'\t\tnextTickQueue = [];',
	'\t\tfor (var i = 0; i < tasks.length; i++) tasks[i]();',
	'\t}',
	'\tnextTickDraining = false;',
	'}',
	'function nextTick(fn) {',
	"\tif (typeof fn !== 'function') throw new TypeError('process.nextTick callback must be a function');",
	'\tvar args = Array.prototype.slice.call(arguments, 1);',
	'\tnextTickQueue.push(function () { fn.apply(null, args); });',
	'\tif (!nextTickDraining) { nextTickDraining = true; setTimeout(drainNextTick, 0); }',
	'}',
].join('\n');

/** One member the shim supplies or deliberately leaves undefined. */
export type ProcessShimMember = Readonly<{
	member: string;
	/** `'function'` / `'value'` when supplied from the parity surface, `'leaf'` when left undefined. */
	kind: 'function' | 'value' | 'leaf';
	called: boolean;
}>;

export type ProcessGlobalShim = Readonly<{
	/** The classic-script source that installs the global, or null when nothing is reached. */
	source: string | null;
	/** Every member the shim supplies, and every reached member left honestly undefined. */
	members: readonly ProcessShimMember[];
	/**
	 * Members the bundle *calls* that `process/browser` leaves undefined. Supplying
	 * them would invent a function the baseline never had; calling them would have
	 * thrown under the baseline too. They are surfaced rather than papered over.
	 */
	unsupportedCalls: readonly string[];
	/** What installing this global changes about the application, declared. */
	declaredDifferences: readonly string[];
}>;

const noReadingShim: ProcessGlobalShim = Object.freeze({
	source: null,
	members: Object.freeze([]),
	unsupportedCalls: Object.freeze([]),
	declaredDifferences: Object.freeze([]),
});

/**
 * Build the `process` global shim a reading proves the bundle needs. Only the
 * members the reading reached are supplied, each from the `process/browser`
 * surface; a reached member that surface leaves undefined is left undefined
 * here too. A reading that reached nothing yields no shim, so a bundle that
 * never mentions `process` is served a byte-identical document.
 */
export function craProcessGlobalShim(reading: ProcessGlobalReading): ProcessGlobalShim {
	if (!reading.referenced) return noReadingShim;
	const members: ProcessShimMember[] = [];
	const unsupportedCalls: string[] = [];
	const assignments: string[] = [];
	let needsNextTick = false;
	let needsNoop = false;

	for (const usage of reading.members) {
		if (usage.member === PROCESS_NEXT_TICK) {
			needsNextTick = true;
			members.push(
				Object.freeze({ member: usage.member, kind: 'function', called: usage.called }),
			);
			assignments.push("\tif (typeof p.nextTick !== 'function') p.nextTick = nextTick;");
			continue;
		}
		const supplied = PROCESS_BROWSER_SURFACE[usage.member];
		if (supplied === undefined) {
			// An honest leaf: `process/browser` binds nothing here, so neither does
			// the shim. Reading it yields `undefined`, the baseline's own value.
			members.push(
				Object.freeze({ member: usage.member, kind: 'leaf', called: usage.called }),
			);
			if (usage.called) unsupportedCalls.push(usage.member);
			continue;
		}
		members.push(
			Object.freeze({ member: usage.member, kind: supplied.kind, called: usage.called }),
		);
		if (supplied.expression === 'noop') needsNoop = true;
		const key = JSON.stringify(usage.member);
		assignments.push(`\tif (!(${key} in p)) p[${key}] = ${supplied.expression};`);
	}

	const body: string[] = [
		'/* versionless-cra-process-global-shim: create-react-app / webpack 4 process parity.',
		' * Reproduces the process/browser@0.11.10 surface the bundle actually reaches.',
		" * Supplied members are derived from the bundle's own process.<member> usage;",
		' * members process/browser leaves undefined are left undefined here too. */',
		'(function () {',
		'\tvar p = (globalThis.process = globalThis.process || {});',
	];
	if (needsNoop) body.push('\tfunction noop() {}');
	if (needsNextTick)
		body.push(...PROCESS_NEXT_TICK_SOURCE.split('\n').map((line) => `\t${line}`));
	body.push(...assignments, '})();');
	const source = body.join('\n');

	const suppliedMembers = members
		.filter((entry) => entry.kind !== 'leaf')
		.map((entry) => entry.member);
	const leafMembers = members
		.filter((entry) => entry.kind === 'leaf')
		.map((entry) => entry.member);
	const declaredDifferences: string[] = [
		`globalThis.process exists in this application's browser context where it did not before, ` +
			`installed before the application entry as the webpack 4 / process-browser parity object. ` +
			(suppliedMembers.length === 0
				? 'It exposes no member, only its bare existence.'
				: `It exposes ${suppliedMembers.join(', ')}, the members the bundle reaches, each with its ` +
					'process/browser value; every other property is undefined.'),
	];
	if (leafMembers.length > 0)
		declaredDifferences.push(
			`process.${leafMembers.join(', process.')} ${leafMembers.length === 1 ? 'is' : 'are'} reached ` +
				'by the bundle and left undefined, because process/browser binds nothing there — the read ' +
				'yields undefined, which is what the baseline bundle honestly had.',
		);
	if (unsupportedCalls.length > 0)
		declaredDifferences.push(
			`process.${unsupportedCalls.join(', process.')} ${unsupportedCalls.length === 1 ? 'is' : 'are'} ` +
				'called by the bundle but left undefined, because process/browser supplies no function there; ' +
				'the same call would have thrown under the baseline bundler.',
		);

	return Object.freeze({
		source,
		members: Object.freeze(members),
		unsupportedCalls: Object.freeze(unsupportedCalls),
		declaredDifferences: Object.freeze(declaredDifferences),
	});
}

const entryModuleScript = createRegExp(
	exactly('<script')
		.and(maybe(whitespace).times.any())
		.and('type=')
		.and(exactly('"').or("'"))
		.and('module'),
);

const headClose = createRegExp(exactly('</head>'));

/**
 * Inject the shim as a classic script into an entry document, ahead of the
 * application entry. A classic script executes at parse time, before every
 * deferred module script, so the global is installed before the first
 * application module — regardless of where in the head it is placed. It is put
 * before the first module script when there is one, else before `</head>`, else
 * at the very start of the document.
 */
export function injectProcessGlobalShim(html: string, shimSource: string): string {
	const script = `<script>\n${shimSource}\n</script>\n`;
	const moduleMatch = entryModuleScript.exec(html);
	if (moduleMatch !== null) {
		const lineStart = html.lastIndexOf('\n', moduleMatch.index) + 1;
		const indent = html.slice(lineStart, moduleMatch.index);
		return `${html.slice(0, lineStart)}${indent}${script}${indent}${html.slice(moduleMatch.index)}`;
	}
	const headMatch = headClose.exec(html);
	if (headMatch !== null)
		return `${html.slice(0, headMatch.index)}${script}${html.slice(headMatch.index)}`;
	return `${script}${html}`;
}

/** One module the plugin observed reaching for `process`. */
export type CraProcessGlobalRecord = Readonly<{
	members: readonly ProcessShimMember[];
	unsupportedCalls: readonly string[];
}>;

export type CraProcessGlobalOptions = Readonly<{
	observe?: (record: CraProcessGlobalRecord) => void;
}>;

export type CraProcessGlobalResolvedConfig = Readonly<{ build: Readonly<{ outDir: string }> }>;

export type CraProcessGlobalPlugin = Readonly<{
	name: string;
	enforce: 'pre';
	configResolved(config: CraProcessGlobalResolvedConfig): void;
	transform(code: string, id: string): null;
	closeBundle: Readonly<{ order: 'post'; sequential: true; handler(): Promise<void> }>;
}>;

const entryDocumentName = 'index.html';

async function documentsBelow(directory: string): Promise<string[]> {
	const documents: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const item = path.join(directory, entry.name);
		if (entry.isDirectory()) documents.push(...(await documentsBelow(item)));
		else if (entry.isFile() && path.basename(item) === entryDocumentName) documents.push(item);
	}
	return documents.sort(compareStrings);
}

/**
 * Supply the create-react-app / webpack 4 `process` global to a Vite build.
 *
 * The plugin reads every module as it passes through `transform` — the app's
 * own modules and every dependency the bundle pulls in — and accumulates the
 * `process` members the bundle reaches. Nothing is transformed: the hook always
 * returns null. After the bundle is written, `closeBundle` builds the shim from
 * the accumulated reading and injects it into the emitted entry document ahead
 * of the application entry.
 *
 * A build whose modules never mention `process` accumulates nothing, and the
 * entry document is left exactly as Vite wrote it — so a bundle that does not
 * need the global pays nothing and is not changed.
 */
export function createCraProcessGlobalPlugin(
	options: CraProcessGlobalOptions = {},
): CraProcessGlobalPlugin {
	const readings: ProcessGlobalReading[] = [];
	let outputDirectory = '';
	return {
		name: 'versionless-cra-process-global',
		enforce: 'pre',
		configResolved(config) {
			outputDirectory = path.resolve(config.build.outDir);
		},
		transform(code, id) {
			if (!craModuleIsProcessAnalyzable(id)) return null;
			if (!code.includes('process')) return null;
			const reading = readProcessGlobalUsage(code, id);
			if (reading.referenced) readings.push(reading);
			return null;
		},
		closeBundle: {
			order: 'post',
			sequential: true,
			async handler() {
				if (!outputDirectory) throw new Error(`${CAPABILITY}: build outDir is unresolved`);
				const shim = craProcessGlobalShim(mergeProcessGlobalReadings(readings));
				if (shim.source === null) return;
				options.observe?.({
					members: shim.members,
					unsupportedCalls: shim.unsupportedCalls,
				});
				for (const document of await documentsBelow(outputDirectory)) {
					const html = await readFile(document, 'utf8');
					if (html.includes('versionless-cra-process-global-shim')) continue;
					await writeFile(document, injectProcessGlobalShim(html, shim.source));
				}
			},
		},
	};
}
