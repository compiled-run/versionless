/**
 * A web worker constructed from a string specifier, which the era's bundler
 * detected and the modern one does not.
 *
 * The Angular CLI's webpack 4 line carried a worker plugin that treated
 * `new Worker('./x.worker', {type: 'module'})` as a worker request: it compiled
 * the named module against the workspace's `webWorkerTsConfig` and emitted it as
 * its own chunk. Webpack 5 dropped that plugin and replaced it with a rule
 * written into the module graph itself, and that rule recognises exactly one
 * spelling — `new Worker(new URL('./x.worker', import.meta.url), …)`. A plain
 * string is an ordinary argument to it: nothing is parsed, nothing is compiled,
 * nothing is emitted, and — this is what makes the family worth a capability —
 * nothing is reported. The build stays green and the worker 404s at runtime,
 * which is the one class of failure a green build cannot tell anyone about.
 *
 * The successor shape is not a choice: `new URL(specifier, import.meta.url)` is
 * the only construction webpack 5 resolves, the specifier inside it is the one
 * already written, and the options object is untouched. What has to be proven is
 * that this construction is a worker request at all, and that is three readings,
 * every one of them of the tree rather than of a name:
 *
 *  - the workspace declares web-worker support, so a worker chunk is something
 *    this build is configured to emit;
 *  - the string specifier resolves to a worker source the tree carries, so the
 *    chunk the rewrite asks for has something to compile;
 *  - the construction's own shape matches — the global `Worker`, a string
 *    literal first argument, and an options object already declaring
 *    `type: 'module'`, which is what the emitted chunk's format has to be.
 *
 * Anything else is refused by name: a computed specifier this reader cannot
 * resolve, a specifier naming no worker source, a construction with no options
 * or a `type` other than `module`, a module whose own root scope binds the name
 * `Worker`. A construction already written in the URL form is passed over in
 * silence, because there is nothing there to answer.
 */

import {
	forEachNode,
	isFreeRootName,
	lineOf,
	parseModule,
	plainProperties,
	applySourceEdits,
	type AstNode,
	type SourceEdit,
} from './semantic-module.ts';

const CAPABILITY = 'web-worker-url-specifier';

/** The questions this capability asks of the workspace and the tree. */
export type WorkerTreeReading = Readonly<{
	/**
	 * Does the workspace declare web-worker support — a `webWorkerTsConfig` on the
	 * build target whose tsconfig the tree carries. False means the build emits no
	 * worker chunk whatever the source says, so rewriting a construction into a
	 * request for one would ask for something this workspace has not declared.
	 */
	declaresWorkerSupport: boolean;
	/**
	 * The worker source in the tree this specifier names, expressed from the tree
	 * root, or null when the specifier resolves to nothing the workspace would
	 * compile as a worker.
	 */
	workerSourceFor: (specifier: string) => string | null;
}>;

export type WorkerUrlChange = Readonly<{
	kind: 'web-worker-url-specifier';
	line: number;
	/** The specifier, unchanged by the rewrite — it moves inside the URL and nothing else. */
	specifier: string;
	/** The worker source in the tree the specifier resolves to. */
	resolved: string;
}>;

export type WorkerUrlMigration = Readonly<{
	path: string;
	source: string;
	changed: boolean;
	changes: readonly WorkerUrlChange[];
	unhandled: readonly string[];
}>;

/** The string a `Literal` node carries, or null when the node is not a string literal. */
export function stringLiteralOf(node: AstNode | undefined): string | null {
	if (node === undefined || node.type !== 'Literal') return null;
	return typeof node.value === 'string' ? node.value : null;
}

/**
 * Is this argument already the URL form — `new URL(…, import.meta.url)` — which
 * is what the rewrite writes and therefore what a second pass must recognise.
 */
export function isUrlConstruction(node: AstNode | undefined): boolean {
	if (node === undefined || node.type !== 'NewExpression') return false;
	const callee: AstNode | null = node.callee;
	return callee !== null && callee.type === 'Identifier' && callee.name === 'URL';
}

/**
 * The `type` an options literal declares as a plain string, or null when the
 * literal declares no readable `type`. A literal this reader cannot read whole —
 * a spread, a computed key, a method — returns null too, because a capability
 * that decides what an object does *not* contain cannot do it over a shape whose
 * membership is not static.
 */
export function declaredWorkerType(options: AstNode | undefined): string | null {
	if (options === undefined) return null;
	const properties = plainProperties(options);
	if (properties === null) return null;
	for (const property of properties)
		if (property.name === 'type') return stringLiteralOf(property.value);
	return null;
}

/**
 * Rewrite every era-form worker construction this reading proves is a worker
 * request into the URL form webpack 5 detects.
 */
export function rewriteWorkerUrlSpecifiers(
	path: string,
	source: string,
	reading: WorkerTreeReading,
): WorkerUrlMigration {
	const module = parseModule(CAPABILITY, path, source);
	const workerIsFree = isFreeRootName(module, 'Worker');
	const edits: SourceEdit[] = [];
	const changes: WorkerUrlChange[] = [];
	const unhandled: string[] = [];

	forEachNode(module.ast, (node) => {
		if (node.type !== 'NewExpression') return;
		const callee: AstNode | null = node.callee;
		if (callee === null || callee.type !== 'Identifier' || callee.name !== 'Worker') return;
		const args: readonly AstNode[] = node.arguments;
		const specifierNode = args[0];
		// Already the form the bundler detects. There is nothing here to answer,
		// which is also what makes a second pass over this capability's own output
		// a no-op rather than a double rewrite.
		if (isUrlConstruction(specifierNode)) return;
		const line = lineOf(source, node.start);
		const at = `${path} line ${String(line)}`;

		if (!workerIsFree) {
			unhandled.push(
				`${at}: this module's root scope binds the name Worker, so \`new Worker\` does not name ` +
					'the global constructor the bundler rule is written about, and rewriting it would ' +
					'change a call to something else.',
			);
			return;
		}
		const specifier = stringLiteralOf(specifierNode);
		if (specifier === null) {
			unhandled.push(
				`${at}: the first argument is not a string literal, so this reader cannot say which ` +
					'module the worker is, and a URL built from an expression is not something the ' +
					'bundler resolves at build time either.',
			);
			return;
		}
		if (!reading.declaresWorkerSupport) {
			unhandled.push(
				`${at}: the workspace declares no web-worker support — no webWorkerTsConfig this build ` +
					`target would compile '${specifier}' under — so the URL form would ask for a chunk ` +
					'this workspace has not declared, and nothing was written.',
			);
			return;
		}
		const resolved = reading.workerSourceFor(specifier);
		if (resolved === null) {
			unhandled.push(
				`${at}: '${specifier}' resolves to no worker source the tree carries under the ` +
					"workspace's worker tsconfig, so the chunk the URL form asks for would have nothing " +
					'to compile.',
			);
			return;
		}
		const workerType = declaredWorkerType(args[1]);
		if (workerType !== 'module') {
			unhandled.push(
				`${at}: the construction of '${specifier}' declares ` +
					`${workerType === null ? 'no readable options `type`' : `type: '${workerType}'`}, and ` +
					'this capability writes the URL form only where the options already say the worker is ' +
					"a module. Deciding the emitted chunk's format is the application's call, not this " +
					"rewrite's.",
			);
			return;
		}
		if (specifierNode === undefined) return;
		edits.push({
			start: specifierNode.start,
			end: specifierNode.end,
			text: `new URL(${source.slice(specifierNode.start, specifierNode.end)}, import.meta.url)`,
		});
		changes.push({
			kind: 'web-worker-url-specifier',
			line,
			specifier,
			resolved,
		});
	});

	const migrated = applySourceEdits(source, edits);
	return Object.freeze({
		path,
		source: migrated,
		changed: migrated !== source,
		changes: Object.freeze(changes),
		unhandled: Object.freeze(unhandled),
	});
}
