/**
 * Runtime globals a declared Node core module needs when a browser evaluates it.
 *
 * Declaring a node-core module for a browser bundle — the mechanism
 * {@link declareUndeclaredRuntimeDependencies} and its siblings use when a
 * published library's own code reaches for `util`, `path` or their kin — closes
 * the *resolution* hole. It does not close the *evaluation* hole. The published
 * browser implementation of a core module is still a module written against
 * Node's runtime surface, and the parts of that surface it touches while it is
 * being evaluated have to exist before the first byte of it runs. `util@0.12.5`
 * reads `process.env.NODE_DEBUG` at its top level; in a browser, with nothing
 * named `process`, that read is a `ReferenceError` and the bundle throws before
 * the application's own code is reached.
 *
 * A bundler that shimmed every Node global would close that hole and a hundred
 * holes nobody has, and would ship the closure of `process`, `Buffer`, `timers`
 * and their transitive dependencies into a browser bundle to answer a single
 * property read. This capability refuses that trade. What it supplies is
 * derived from the installed module's own bytes and nothing else:
 *
 * - **Only what evaluation reaches.** A reference that sits inside a function
 *   body is not evaluated when the module is evaluated, and a reference under
 *   `typeof` cannot throw. Neither proves a need, so neither earns a shim, and
 *   the global is refused by name with that reason.
 * - **Only the shape the reading spells.** The shim materialises exactly the
 *   objects a proven dereference path walks through — `process` and
 *   `process.env` for `process.env.NODE_DEBUG`, and nothing else. The leaf is
 *   never invented: reading it yields `undefined`, which is what a browser
 *   process-less environment honestly has.
 * - **Only reads.** A global reached at evaluation time in a way an object
 *   graph cannot satisfy — called, constructed, assigned to, or reached through
 *   a computed member whose key is not in the source — is refused by name
 *   rather than half-supplied. An empty object standing where a function is
 *   called is a different crash, not a fix.
 *
 * The names every conforming ECMAScript host binds, and the names a CommonJS
 * module wrapper binds, are not candidates at all: they are already there, in
 * every browser and in every bundle, and shimming them would be a claim about
 * the host rather than a reading of the module.
 *
 * The seam the shim is delivered through is the builder's own: the Angular
 * workspace's `polyfills` entry points, which the browser builder emits into a
 * bundle the document loads before `main`. Nothing here writes a bundler alias,
 * a `define` substitution or a global variable injection plugin; the shim is an
 * ordinary module of the application, visible in the workspace and in the
 * emitted output like any other.
 */

import { compareStrings } from './angular-target-cell.ts';
import {
	objectAt,
	parseStrictJson,
	serializeJson,
	type ConfigChange,
	type JsonObject,
} from './angular-workspace-migration.ts';
import { lineOf, parseModule, type AstNode } from './semantic-module.ts';
import type { InstalledFile } from './undeclared-runtime-dependency.ts';

const CAPABILITY = 'Node core runtime globals';

/**
 * The value properties of the ECMAScript global object.
 *
 * Definitional rather than curated: every conforming host binds these, which is
 * what "conforming" means, so a reference to one says nothing about a global the
 * browser is missing.
 */
export const ECMASCRIPT_GLOBAL_NAMES: readonly string[] = Object.freeze(
	[
		'AggregateError',
		'Array',
		'ArrayBuffer',
		'BigInt',
		'BigInt64Array',
		'BigUint64Array',
		'Boolean',
		'DataView',
		'Date',
		'Error',
		'EvalError',
		'FinalizationRegistry',
		'Float32Array',
		'Float64Array',
		'Function',
		'Infinity',
		'Int16Array',
		'Int32Array',
		'Int8Array',
		'Intl',
		'JSON',
		'Map',
		'Math',
		'NaN',
		'Number',
		'Object',
		'Promise',
		'Proxy',
		'RangeError',
		'ReferenceError',
		'Reflect',
		'RegExp',
		'Set',
		'SharedArrayBuffer',
		'String',
		'Symbol',
		'SyntaxError',
		'TypeError',
		'URIError',
		'Uint16Array',
		'Uint32Array',
		'Uint8Array',
		'Uint8ClampedArray',
		'WeakMap',
		'WeakRef',
		'WeakSet',
		'decodeURI',
		'decodeURIComponent',
		'encodeURI',
		'encodeURIComponent',
		'eval',
		'globalThis',
		'isFinite',
		'isNaN',
		'parseFloat',
		'parseInt',
		'undefined',
	].sort(compareStrings),
);

/**
 * Names outside ECMAScript that a browser binds anyway.
 *
 * Every entry is a global the HTML standard or a WHATWG standard obliges a
 * browsing context to have, and which Node also binds — which is why a module
 * written for Node reaches for one. Supplying any of these would be a claim
 * about the browser, not a reading of the module, so they are excluded from
 * candidacy instead. The list is deliberately confined to the names a Node core
 * module's browser implementation plausibly touches; a name outside it is not
 * assumed absent either, it is refused by name and reported, which is a
 * diagnosable outcome rather than a silent one.
 */
export const WEB_PLATFORM_GLOBAL_NAMES: readonly string[] = Object.freeze(
	[
		'AbortController',
		'AbortSignal',
		'Blob',
		'ByteLengthQueuingStrategy',
		'CompressionStream',
		'CountQueuingStrategy',
		'DecompressionStream',
		'DOMException',
		'Event',
		'EventTarget',
		'Headers',
		'MessageChannel',
		'MessageEvent',
		'MessagePort',
		'ReadableStream',
		'Request',
		'Response',
		'TextDecoder',
		'TextEncoder',
		'TransformStream',
		'URL',
		'URLSearchParams',
		'WebAssembly',
		'WritableStream',
		'atob',
		'btoa',
		'clearInterval',
		'clearTimeout',
		'console',
		'crypto',
		'fetch',
		'performance',
		'queueMicrotask',
		'setInterval',
		'setTimeout',
		'structuredClone',
	].sort(compareStrings),
);

/**
 * The names a CommonJS module wrapper binds around a module's body, plus
 * `arguments`, which every non-arrow function binds.
 *
 * A bundler that resolved `require('util')` at all is a bundler that supplies
 * these, because otherwise the module it just resolved could not export
 * anything.
 */
export const COMMONJS_WRAPPER_NAMES: readonly string[] = Object.freeze([
	'__dirname',
	'__filename',
	'arguments',
	'exports',
	'module',
	'require',
]);

/**
 * Every name a reference to which proves nothing about a missing runtime
 * global, and so is never a candidate for a shim.
 */
export const HOST_PROVIDED_GLOBAL_NAMES: readonly string[] = Object.freeze(
	[...ECMASCRIPT_GLOBAL_NAMES, ...WEB_PLATFORM_GLOBAL_NAMES, ...COMMONJS_WRAPPER_NAMES].sort(
		compareStrings,
	),
);

const HOST_PROVIDED: ReadonlySet<string> = new Set(HOST_PROVIDED_GLOBAL_NAMES);

/** Scope kinds whose body is not evaluated when the module is evaluated. */
const DEFERRED_SCOPE_KINDS: ReadonlySet<string> = new Set([
	'class',
	'function',
	'functionBody',
	'staticBlock',
]);

/** One dereference of a runtime global the module performs while it is evaluated. */
export type RuntimeGlobalDereference = Readonly<{
	/** The installed file the read was found in. */
	file: string;
	/** The 1-based line the read sits on. */
	line: number;
	/** The property names walked off the global, outermost first. */
	path: readonly string[];
}>;

/** A runtime global the reading proves the module dereferences at evaluation. */
export type ProvenRuntimeGlobal = Readonly<{
	name: string;
	/**
	 * The dotted paths the shim has to materialise as objects, shortest first:
	 * the global itself, and every intermediate a proven path walks through.
	 */
	containers: readonly string[];
	dereferences: readonly RuntimeGlobalDereference[];
}>;

/** What one installed module's evaluation asks of the runtime, as read. */
export type RuntimeGlobalReading = Readonly<{
	proven: readonly ProvenRuntimeGlobal[];
	/** Globals the reading found and refused, one sentence each, named. */
	refused: readonly string[];
}>;

/** The installed node-core module a browser bundle declares, as read from disk. */
export type NodeCoreModuleDeclaration = Readonly<{
	/** The declared package name, e.g. `util`. */
	module: string;
	/** The installed version, for the record rather than for a decision. */
	version: string;
	/** The declared range in the application manifest, for the record. */
	range: string;
	/** The files a browser evaluates when it resolves the module. */
	files: readonly InstalledFile[];
}>;

export type NodeCoreRuntimeGlobals = Readonly<{
	module: string;
	version: string;
	/** The globals supplied, in the order the shim writes them. */
	globals: readonly ProvenRuntimeGlobal[];
	/** The shim module's source, or null when the reading proved nothing. */
	shim: string | null;
	/** One line per assignment the shim makes. */
	changes: readonly string[];
	/** What supplying these globals changes about the application, declared. */
	declaredDifferences: readonly string[];
	/** Globals refused by name, and why. */
	unhandled: readonly string[];
}>;

function scopeIsEvaluatedAtLoad(scope: { kind: string; parent: unknown } | null): boolean {
	let current = scope;
	while (current !== null) {
		if (DEFERRED_SCOPE_KINDS.has(current.kind)) return false;
		current = (current as { parent: { kind: string; parent: unknown } | null }).parent;
	}
	return true;
}

type ChainReading =
	| Readonly<{ kind: 'path'; path: readonly string[] }>
	| Readonly<{ kind: 'refused'; why: string }>;

/**
 * The property path a reference walks off its global, or the reason no object
 * graph can stand in for it.
 *
 * The walk is deliberately syntactic and deliberately shallow: it follows
 * non-computed member accesses upwards from the identifier and stops at the
 * first thing that is not one. What it stops at decides the answer — a
 * `CallExpression` whose callee is the chain means a function was wanted, a
 * `NewExpression` means a constructor was, an assignment target means the
 * module writes through the global, and a computed member means the key is not
 * in the source to be read.
 */
function readDereferenceChain(module: ReturnType<typeof parseModule>, node: AstNode): ChainReading {
	const path: string[] = [];
	let current = node;
	for (;;) {
		const parent = module.parentOf(current);
		if (parent === null)
			return { kind: 'refused', why: 'it is evaluated as a bare value with no member read' };
		if (parent.type === 'MemberExpression' && parent.object === current) {
			if (parent.computed === true)
				return {
					kind: 'refused',
					why: 'it is reached through a computed member, whose key the source does not state',
				};
			const property = parent.property as AstNode;
			if (property.type !== 'Identifier')
				return {
					kind: 'refused',
					why: 'it is reached through a member this reading cannot name',
				};
			path.push(property.name as string);
			current = parent;
			continue;
		}
		if (
			(parent.type === 'CallExpression' || parent.type === 'NewExpression') &&
			parent.callee === current
		)
			return {
				kind: 'refused',
				why:
					path.length === 0
						? 'it is called at module evaluation, and an object graph is not a function'
						: `its member ${path.join('.')} is called at module evaluation, and an object ` +
							'graph supplies no function to call',
			};
		if (parent.type === 'AssignmentExpression' && parent.left === current)
			return { kind: 'refused', why: 'the module assigns through it at evaluation' };
		if (parent.type === 'UpdateExpression' && parent.argument === current)
			return { kind: 'refused', why: 'the module updates through it at evaluation' };
		if (path.length === 0)
			return { kind: 'refused', why: 'it is evaluated as a bare value with no member read' };
		return { kind: 'path', path: Object.freeze([...path]) };
	}
}

/** Whether a reference sits directly under `typeof`, where nothing can throw. */
function isTypeofOperand(module: ReturnType<typeof parseModule>, node: AstNode): boolean {
	const parent = module.parentOf(node);
	return parent !== null && parent.type === 'UnaryExpression' && parent.operator === 'typeof';
}

/**
 * Read every runtime global one installed module's evaluation requires.
 *
 * The unit of proof is the reference, and every reference of every candidate
 * name is classified: proven when the module dereferences it at load with a
 * member path an object graph can satisfy, refused otherwise. A name with even
 * one refused evaluation-time reach is refused entirely, because a shim that
 * answers the read and not the call would move the crash rather than remove it.
 */
export function readRuntimeGlobalReferences(files: readonly InstalledFile[]): RuntimeGlobalReading {
	const dereferences = new Map<string, RuntimeGlobalDereference[]>();
	const deferred = new Set<string>();
	const hardRefusals = new Map<string, string>();
	for (const file of files) {
		const module = parseModule(CAPABILITY, file.path, file.source);
		for (const reference of module.unresolvedReferences) {
			const name = reference.name;
			if (HOST_PROVIDED.has(name)) continue;
			if (reference.inTypePosition) continue;
			const node = reference.node as unknown as AstNode;
			if (isTypeofOperand(module, node)) {
				deferred.add(name);
				continue;
			}
			if (
				!scopeIsEvaluatedAtLoad(
					reference.scope as unknown as { kind: string; parent: unknown },
				)
			) {
				deferred.add(name);
				continue;
			}
			if (reference.isWrite) {
				if (!hardRefusals.has(name))
					hardRefusals.set(name, 'the module assigns to it at evaluation');
				continue;
			}
			const chain = readDereferenceChain(module, node);
			if (chain.kind === 'refused') {
				if (!hardRefusals.has(name)) hardRefusals.set(name, chain.why);
				continue;
			}
			const list = dereferences.get(name) ?? [];
			list.push(
				Object.freeze({
					file: file.path,
					line: lineOf(file.source, node.start),
					path: chain.path,
				}),
			);
			dereferences.set(name, list);
		}
	}
	const proven: ProvenRuntimeGlobal[] = [];
	const refused: string[] = [];
	for (const name of [...dereferences.keys()].sort(compareStrings)) {
		const reads = dereferences.get(name) ?? [];
		const hard = hardRefusals.get(name);
		if (hard !== undefined) {
			refused.push(
				`${name} is dereferenced at module evaluation, but ${hard}, so no shim this ` +
					'capability can write would answer it and none was written',
			);
			continue;
		}
		const containers = new Set<string>([name]);
		for (const read of reads)
			for (let depth = 1; depth < read.path.length; depth += 1)
				containers.add([name, ...read.path.slice(0, depth)].join('.'));
		proven.push(
			Object.freeze({
				name,
				containers: Object.freeze(
					[...containers].sort(
						(left, right) =>
							left.split('.').length - right.split('.').length ||
							compareStrings(left, right),
					),
				),
				dereferences: Object.freeze(
					[...reads].sort(
						(left, right) =>
							compareStrings(left.file, right.file) || left.line - right.line,
					),
				),
			}),
		);
	}
	for (const name of [...hardRefusals.keys()].sort(compareStrings))
		if (!dereferences.has(name))
			refused.push(
				`${name} is reached at module evaluation, but ${hardRefusals.get(name) ?? ''}, so no ` +
					'shim this capability can write would answer it and none was written',
			);
	for (const name of [...deferred].sort(compareStrings)) {
		if (dereferences.has(name) || hardRefusals.has(name)) continue;
		refused.push(
			`${name} is referenced by this module, but every reference to it is inside a function ` +
				'body or under `typeof`, neither of which runs — or can throw — when the module is ' +
				'evaluated. The reading does not prove it is needed, so it is not supplied',
		);
	}
	return Object.freeze({ proven: Object.freeze(proven), refused: Object.freeze(refused) });
}

/** The TypeScript expression that reaches one container path off `globalThis`. */
function containerAccess(path: string): string {
	const segments = path.split('.');
	let expression = 'runtimeGlobals';
	for (const segment of segments.slice(0, -1))
		expression = `(${expression}[${JSON.stringify(segment)}] as RuntimeGlobalObject)`;
	return `${expression}[${JSON.stringify(segments[segments.length - 1] as string)}]`;
}

/**
 * Supply the runtime globals one declared node-core module's browser evaluation
 * requires, as an ordinary polyfill module of the application.
 *
 * Nothing is supplied that the reading did not prove, and nothing proven is
 * supplied more widely than the reading spells. A declaration whose module
 * dereferences no runtime global at evaluation gets no shim at all and no
 * entry point — which is the common case, and the case a blanket polyfill set
 * would have paid for anyway.
 */
export function supplyNodeCoreRuntimeGlobals(
	declaration: NodeCoreModuleDeclaration,
): NodeCoreRuntimeGlobals {
	const reading = readRuntimeGlobalReferences(declaration.files);
	const label = `${declaration.module}@${declaration.version}`;
	if (reading.proven.length === 0)
		return Object.freeze({
			module: declaration.module,
			version: declaration.version,
			globals: Object.freeze([]),
			shim: null,
			changes: Object.freeze([]),
			declaredDifferences: Object.freeze([]),
			unhandled: Object.freeze([...reading.refused]),
		});
	const changes: string[] = [];
	const lines: string[] = [
		'/**',
		` * Runtime globals ${label} dereferences while a browser evaluates it.`,
		' *',
		` * Declared for this application because ${declaration.module} is in its declared`,
		` * closure at ${declaration.range} as the browser implementation of a Node core`,
		' * module, and a browser binds none of the names below. Every assignment here is a',
		" * read of the installed module's own bytes, cited by file and line; nothing is",
		' * supplied that no line asks for, and every leaf is left undefined rather than',
		' * invented.',
		' *',
		' * Generated by @versionless/angular (node-core-runtime-globals).',
		' */',
		'',
		'type RuntimeGlobalObject = Record<string, unknown>;',
		'',
		'const runtimeGlobals = globalThis as unknown as RuntimeGlobalObject;',
		'',
	];
	for (const global of reading.proven) {
		for (const read of global.dereferences)
			lines.push(
				`// ${global.name}.${read.path.join('.')} — ${read.file} line ${String(read.line)}`,
			);
		for (const container of global.containers) {
			lines.push(`${containerAccess(container)} ??= {};`);
			changes.push(
				`${container} supplied as an empty object when the host binds nothing there`,
			);
		}
		lines.push('');
	}
	lines.push('export {};', '');
	const declaredDifferences = reading.proven.map(
		(global) =>
			`globalThis.${global.name} exists in this application's browser context where it did ` +
			`not before, as ${global.containers.length === 1 ? 'an empty object' : `the object graph ${global.containers.join(', ')}`}. ` +
			`It is supplied for ${label}, whose evaluation reads ` +
			`${global.dereferences.map((read) => `${global.name}.${read.path.join('.')}`).join(', ')}, ` +
			'and any other code in the bundle that tests for it will now find it. Every leaf is ' +
			'undefined, so a reader of one gets what a browser honestly has rather than a value ' +
			'this capability made up.',
	);
	return Object.freeze({
		module: declaration.module,
		version: declaration.version,
		globals: reading.proven,
		shim: lines.join('\n'),
		changes: Object.freeze(changes),
		declaredDifferences: Object.freeze(declaredDifferences),
		unhandled: Object.freeze([...reading.refused]),
	});
}

export type PolyfillEntryPointDeclaration = Readonly<{
	config: string;
	changes: readonly ConfigChange[];
	unhandled: readonly string[];
}>;

/**
 * Declare one polyfill entry point in every builder target that takes them.
 *
 * The `polyfills` option is the builder's own seam for a module that has to be
 * evaluated before the application: the browser builder emits those entry
 * points into a bundle the generated document loads ahead of `main`. The entry
 * point goes first, because a runtime global a later polyfill reads has to
 * already be there.
 *
 * A target carrying the option in its pre-v15 string form is refused by name
 * rather than rewritten — converting it is the workspace migration's decision,
 * already made there, and making it twice in two places is how two capabilities
 * come to disagree. A workspace where no target takes the option is refused
 * whole: there is nowhere to put the shim, and pretending otherwise would emit
 * a file nothing loads.
 */
export function declarePolyfillEntryPoint(
	config: string,
	entryPoint: string,
): PolyfillEntryPointDeclaration {
	const workspace = parseStrictJson(config, 'polyfill entry point');
	const changes: ConfigChange[] = [];
	const unhandled: string[] = [];
	const projects = objectAt(workspace['projects']);
	if (projects === null)
		return Object.freeze({
			config,
			changes: Object.freeze([]),
			unhandled: Object.freeze([
				`${entryPoint} was not declared: the workspace carries no projects map, so it names ` +
					'no builder target that could evaluate it',
			]),
		});
	let targets = 0;
	const next: JsonObject = { ...workspace };
	const migratedProjects: JsonObject = {};
	for (const [projectName, projectValue] of Object.entries(projects)) {
		const project = objectAt(projectValue);
		if (project === null) {
			migratedProjects[projectName] = projectValue;
			continue;
		}
		const architectKey = objectAt(project['architect']) === null ? 'targets' : 'architect';
		const architect = objectAt(project[architectKey]);
		if (architect === null) {
			migratedProjects[projectName] = projectValue;
			continue;
		}
		const migratedTargets: JsonObject = {};
		for (const [targetName, targetValue] of Object.entries(architect)) {
			const target = objectAt(targetValue);
			const options = target === null ? null : objectAt(target['options']);
			const current = options === null ? undefined : options['polyfills'];
			const at = `projects.${projectName}.${architectKey}.${targetName}.options.polyfills`;
			if (options === null || current === undefined) {
				migratedTargets[targetName] = targetValue;
				continue;
			}
			if (typeof current === 'string') {
				unhandled.push(
					`${at} is a string, the form the modern builder schema replaced with an array. ` +
						`${entryPoint} was not declared there, because converting the option is the ` +
						"workspace migration's decision and this capability does not make it a second time",
				);
				migratedTargets[targetName] = targetValue;
				continue;
			}
			if (!Array.isArray(current) || current.some((entry) => typeof entry !== 'string')) {
				unhandled.push(
					`${at} is neither a string nor an array of strings, so this capability cannot read ` +
						`what it already declares and ${entryPoint} was not added to it`,
				);
				migratedTargets[targetName] = targetValue;
				continue;
			}
			targets += 1;
			if (current.includes(entryPoint)) {
				migratedTargets[targetName] = targetValue;
				continue;
			}
			const updated = [entryPoint, ...(current as readonly string[])];
			changes.push({ path: at, from: JSON.stringify(current), to: JSON.stringify(updated) });
			migratedTargets[targetName] = {
				...(target as JsonObject),
				options: { ...options, polyfills: updated },
			};
		}
		migratedProjects[projectName] = { ...project, [architectKey]: migratedTargets };
	}
	if (targets === 0)
		return Object.freeze({
			config,
			changes: Object.freeze([]),
			unhandled: Object.freeze([
				...unhandled.sort(compareStrings),
				`${entryPoint} was not declared: no builder target in this workspace takes a ` +
					'`polyfills` option, so there is no seam that would evaluate it before the ' +
					'application',
			]),
		});
	next['projects'] = migratedProjects;
	return Object.freeze({
		config: changes.length === 0 ? config : serializeJson(next),
		changes: Object.freeze(changes),
		unhandled: Object.freeze(unhandled.sort(compareStrings)),
	});
}
