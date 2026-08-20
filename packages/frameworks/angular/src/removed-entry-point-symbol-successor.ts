/**
 * A symbol reached through an entry point the package no longer publishes, whose
 * successor on the root is spelled differently.
 *
 * `TS2307: Cannot find module 'rxjs/internal-compatibility'` looks like the
 * unreachable-subpath shape {@link redirectUnreachableImports} answers, and it is
 * not. That capability moves a name between entry points of the same package,
 * and it can only do so because the name is still published somewhere: the
 * reading finds it and the import follows it. Here the entry point is gone *and*
 * the name is gone. `rxjs@7` publishes no `fromPromise` from anywhere, so a
 * collapse onto the root would import a name the package does not have and move
 * the failure from TS2307 to TS2305.
 *
 * The successor is therefore a written-down claim, exactly as
 * {@link renameDeclaredTypeMembers}'s is — someone read a release note, not a
 * declaration. This file states that plainly because it is the whole of the risk.
 * What the tree can still do is refuse the claim, and it is asked to three times
 * before anything is written: the removed specifier really has to be unreachable,
 * the root really has to publish the successor, and the root really has to *not*
 * publish the replaced name. A tree that still answers the specifier is a tree
 * where the diagnostic means something else; a root that already publishes the
 * old name is one where the claim describes some other release.
 *
 * The call shape is the fourth refusal and the one that keeps the claim narrow.
 * `fromPromise` was a single-argument creation function and `from` is an overload
 * set; the claim is stated for one arity, and a site that uses the symbol at any
 * other arity — or that does not call it at all, passing it as a value, reading a
 * member off it, aliasing it away — is refused with the whole declaration. Half a
 * rewrite is worse than none: it would leave a binding pointing at a module that
 * does not resolve while claiming the file was migrated.
 */

import { compareStrings } from './angular-target-cell.ts';
import {
	applySourceEdits,
	forEachNode,
	isFreeRootName,
	lineOf,
	parseModule,
	type AstNode,
	type SourceEdit,
} from './semantic-module.ts';

const CAPABILITY = 'Removed entry point symbol successor';

/**
 * One removed-entry-point symbol and its successor on the package root, as a
 * claim to be checked. `arity` is the call shape the claim is stated for, and it
 * is part of the claim rather than a convenience: a successor that is right for
 * one shape of call is not thereby right for another.
 */
export type DocumentedSymbolSuccessor = Readonly<{
	package: string;
	/** The specifier the application imports through, e.g. `rxjs/internal-compatibility`. */
	specifier: string;
	from: string;
	to: string;
	arity: number;
	/** The release that made the change, for the record and the refusal messages. */
	since: string;
}>;

/**
 * What the installed package answers. `specifierResolves` is the reading that
 * makes the diagnostic this capability's business; `rootExports` is the two-sided
 * check on the claim.
 */
export type RootSurfaceReading = Readonly<{
	package: string;
	version: string;
	specifier: string;
	specifierResolves: boolean;
	rootExports: readonly string[];
	/** An incomplete reading proves no name absent, and the claim is refused on it. */
	complete: boolean;
}>;

export type SymbolSuccessorChange = Readonly<{
	kind: 'removed-entry-point-symbol-successor';
	line: number;
	specifier: string;
	root: string;
	from: string;
	to: string;
	callSites: number;
}>;

export type SymbolSuccessorMigration = Readonly<{
	path: string;
	source: string;
	changed: boolean;
	changes: readonly SymbolSuccessorChange[];
	unhandled: readonly string[];
}>;

/** The successors this adapter has been told about. */
export const DOCUMENTED_SYMBOL_SUCCESSORS: readonly DocumentedSymbolSuccessor[] = Object.freeze([
	Object.freeze({
		package: 'rxjs',
		specifier: 'rxjs/internal-compatibility',
		from: 'fromPromise',
		to: 'from',
		arity: 1,
		since: 'rxjs 7',
	}),
]);

/** Every identifier node in a module that resolves to `symbol`. */
function referencesTo(module: ReturnType<typeof parseModule>, local: unknown): readonly AstNode[] {
	const found: AstNode[] = [];
	forEachNode(module.ast, (node) => {
		if (node.type !== 'Identifier') return;
		if (module.symbolOf(node) !== local) return;
		found.push(node);
	});
	return Object.freeze(found);
}

/**
 * Rewrite one module's imports of a removed entry point onto the package root,
 * where the installed root proves the successor and every use is the call shape
 * the claim was stated for.
 */
export function succeedRemovedEntryPointSymbols(
	path: string,
	source: string,
	claims: readonly DocumentedSymbolSuccessor[],
	readings: readonly RootSurfaceReading[],
): SymbolSuccessorMigration {
	const module = parseModule(CAPABILITY, path, source);
	const edits: SourceEdit[] = [];
	const changes: SymbolSuccessorChange[] = [];
	const unhandled: string[] = [];
	for (const declaration of module.ast.body) {
		if (declaration.type !== 'ImportDeclaration') continue;
		const specifier: unknown = declaration.source.value;
		if (typeof specifier !== 'string') continue;
		const applicable = claims.filter((claim) => claim.specifier === specifier);
		if (applicable.length === 0) continue;
		const line = lineOf(source, declaration.start);
		const at = `${path} line ${String(line)}`;
		const refuse = (reason: string): void => {
			unhandled.push(`${at}: ${reason}`);
		};
		const root = (applicable[0] as DocumentedSymbolSuccessor).package;
		const reading = readings.find(
			(entry) => entry.package === root && entry.specifier === specifier,
		);
		if (reading === undefined) {
			refuse(`no root surface was read for '${root}', so ${specifier} was left as it is`);
			continue;
		}
		if (!reading.complete) {
			refuse(
				`the root surface of '${root}'@${reading.version} is incomplete, so it establishes ` +
					'neither that a successor is published nor that the replaced name is not',
			);
			continue;
		}
		if (reading.specifierResolves) {
			refuse(
				`'${root}'@${reading.version} still answers ${specifier}, so the diagnostic does not ` +
					'describe this closure and the rewrite would be a rewrite of working code',
			);
			continue;
		}
		let wide = false;
		const named: { name: string; localName: string; local: unknown; node: AstNode }[] = [];
		for (const imported of declaration.specifiers) {
			if (
				imported.type !== 'ImportSpecifier' ||
				imported.imported.type !== 'Identifier' ||
				imported.local.type !== 'Identifier'
			) {
				wide = true;
				continue;
			}
			named.push({
				name: imported.imported.name,
				localName: imported.local.name,
				local: module.symbolOf(imported.local),
				node: imported.local,
			});
		}
		if (wide) {
			refuse(
				`${specifier} is unreachable and the declaration carries a default or namespace ` +
					'binding, whose members cannot be resolved to a successor by name',
			);
			continue;
		}
		if (named.length === 0) {
			refuse(
				`${specifier} is unreachable and the declaration names no symbol — it is imported for ` +
					'its side effect, and nothing about the published surface says which entry point runs ' +
					'the same one',
			);
			continue;
		}
		const resolved: { claim: DocumentedSymbolSuccessor; callees: readonly AstNode[] }[] = [];
		const refusals: string[] = [];
		for (const entry of named) {
			const claim = applicable.find((candidate) => candidate.from === entry.name);
			if (claim === undefined) {
				refusals.push(`no successor is written down for ${entry.name}`);
				continue;
			}
			if (!reading.rootExports.includes(claim.to)) {
				refusals.push(
					`${claim.since} is said to have replaced ${claim.from} with ${claim.to}, and the root ` +
						`of '${root}'@${reading.version} does not publish ${claim.to}`,
				);
				continue;
			}
			if (reading.rootExports.includes(claim.from)) {
				refusals.push(
					`the root of '${root}'@${reading.version} publishes ${claim.from}, so the name did ` +
						'not go away and the specifier is the only thing that did',
				);
				continue;
			}
			if (entry.localName !== entry.name) {
				refusals.push(
					`${entry.name} is imported as ${entry.localName}, and a successor written through an ` +
						'alias would rename the binding as well as the import',
				);
				continue;
			}
			if (!isFreeRootName(module, claim.to)) {
				refusals.push(
					`${claim.to} is already bound in this module's root scope, so importing the successor ` +
						'under its own name would shadow or collide with it',
				);
				continue;
			}
			const uses = referencesTo(module, entry.local).filter((node) => node !== entry.node);
			const callees: AstNode[] = [];
			let bad: string | null = null;
			for (const use of uses) {
				const parent = module.parentOf(use);
				if (parent === null || parent.type !== 'CallExpression' || parent.callee !== use) {
					bad =
						`${entry.name} is used at line ${String(lineOf(source, use.start))} other than as ` +
						'the callee of a call, and the successor is written down as a replacement for the ' +
						'call and not for the value';
					break;
				}
				if (parent.arguments.length !== claim.arity) {
					bad =
						`${entry.name} is called at line ${String(lineOf(source, use.start))} with ` +
						`${String(parent.arguments.length)} argument(s), and the successor is written down ` +
						`for the ${String(claim.arity)}-argument form only`;
					break;
				}
				callees.push(use);
			}
			if (bad !== null) {
				refusals.push(bad);
				continue;
			}
			resolved.push({ claim, callees: Object.freeze(callees) });
		}
		if (refusals.length > 0) {
			for (const reason of refusals)
				refuse(
					`${specifier} is unreachable and ${reason}. The whole declaration was left as it is: ` +
						'rewriting the symbols that do resolve would leave the ones that do not pointing at ' +
						'a module this tree does not answer.',
				);
			continue;
		}
		const quote = source.slice(declaration.source.start, declaration.source.start + 1);
		const inner = resolved
			.map((entry) => entry.claim.to)
			.sort(compareStrings)
			.join(', ');
		let end = declaration.end;
		if (source[end] === ';') end += 1;
		edits.push({
			start: declaration.start,
			end,
			text: `import {${inner}} from ${quote}${root}${quote};`,
		});
		for (const entry of resolved) {
			for (const callee of entry.callees)
				edits.push({ start: callee.start, end: callee.end, text: entry.claim.to });
			changes.push({
				kind: 'removed-entry-point-symbol-successor',
				line,
				specifier,
				root,
				from: entry.claim.from,
				to: entry.claim.to,
				callSites: entry.callees.length,
			});
		}
	}
	const migrated = applySourceEdits(source, edits);
	return Object.freeze({
		path,
		source: migrated,
		changed: migrated !== source,
		changes: Object.freeze(changes),
		unhandled: Object.freeze([...new Set(unhandled)].sort(compareStrings)),
	});
}
