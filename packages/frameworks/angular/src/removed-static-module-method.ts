/**
 * A static configuration method an NgModule used to publish, and the aligned
 * line no longer declares.
 *
 * `NgbModule.forRoot()` is the shape. ng-bootstrap published a `forRoot()`
 * static on its root module for as long as an Angular application had to name
 * one, and dropped it in its 4.0 release: the module became import-direct, and
 * every release since publishes the class without the method. An application
 * pinned at the 3.x line therefore writes `NgbModule.forRoot()` inside an
 * NgModule `imports` array, and against the line the manifest alignment selected
 * that is `TS2339: Property 'forRoot' does not exist on type 'typeof NgbModule'`
 * — a compile error in a workspace whose dependency resolution is otherwise
 * clean.
 *
 * The rewrite is a deletion of the call and nothing else, and everything
 * interesting is in front of it:
 *
 * - The method really has to be gone. What the *installed* declaration publishes
 *   is a reading of the closure the alignment produced, and a line that still
 *   declares the method is a line where this diagnostic means something else.
 * - The call really has to take no arguments. `forRoot(config)` carried a
 *   configuration the module registered as providers; deleting that call throws
 *   away the configuration, so a call with arguments is refused by name and left
 *   for a caller who can say where the configuration went.
 * - The call really has to be an NgModule `imports` member. The same expression
 *   in a variable, a spread, or a route definition is the same five characters
 *   and a different question about what the value is for.
 *
 * Nothing here is specific to ng-bootstrap: the claim names a package, a symbol
 * and a method, and the reading is of whatever declaration the closure installs.
 */

import { compareStrings } from './angular-target-cell.ts';
import {
	applySourceEdits,
	denotesExport,
	forEachNode,
	lineOf,
	parseModule,
	plainProperties,
	readModuleImports,
	type AstNode,
	type SemanticModule,
	type SourceEdit,
} from './semantic-module.ts';
import { NG_MODULE_DECORATOR_NAME, NG_MODULE_DECORATOR_PACKAGE } from './use-position-symbol-successor.ts';

const CAPABILITY = 'Removed static module method';

/** A call expression, narrowed out of the node union once so the reads below are typed. */
type CallNode = Extract<AstNode, { type: 'CallExpression' }>;

/** One `X.method(…)` site: the call, and the expression that named the class. */
type StaticCall = Readonly<{ call: CallNode; receiver: AstNode }>;

/**
 * One static method a module used to publish and the line that dropped it,
 * written down as a claim to be checked against the installed declaration.
 */
export type DocumentedStaticModuleMethodRemoval = Readonly<{
	package: string;
	symbol: string;
	method: string;
	/** The release that dropped it, for the record and the refusal messages. */
	since: string;
	reason: string;
}>;

/**
 * What the installed declaration publishes on one exported class. `statics` is
 * the two-sided check on the claim, and an incomplete reading proves no member
 * absent: the claim is refused on it.
 */
export type ModuleClassSurfaceReading = Readonly<{
	package: string;
	version: string;
	symbol: string;
	statics: readonly string[];
	complete: boolean;
}>;

export type StaticModuleMethodChange = Readonly<{
	kind: 'removed-static-module-method';
	line: number;
	package: string;
	symbol: string;
	method: string;
	from: string;
	to: string;
}>;

export type StaticModuleMethodMigration = Readonly<{
	path: string;
	source: string;
	changed: boolean;
	changes: readonly StaticModuleMethodChange[];
	unhandled: readonly string[];
}>;

/** The claims this adapter has been told about. */
export const DOCUMENTED_STATIC_MODULE_METHOD_REMOVALS: readonly DocumentedStaticModuleMethodRemoval[] =
	Object.freeze([
		Object.freeze({
			package: '@ng-bootstrap/ng-bootstrap',
			symbol: 'NgbModule',
			method: 'forRoot',
			since: '@ng-bootstrap/ng-bootstrap 4.0.0',
			reason:
				'ng-bootstrap made its root module import-direct in 4.0: `NgbModule` registers its own ' +
				'providers and publishes no `forRoot`. The zero-argument call therefore has no replacement ' +
				'arguments to carry — the module itself is what the `imports` array now names — and every ' +
				'release from 4.0 to the line this workspace aligns to declares the class without the method.',
		}),
	]);

/**
 * Whether a call sits directly in the `imports` array of an `NgModule`
 * decorator's object literal. Any other position is refused: this capability
 * deletes a call, and a call it did not read is a call it must not delete.
 */
function inNgModuleImports(module: SemanticModule, call: CallNode): boolean {
	const decorator = readModuleImports(module, NG_MODULE_DECORATOR_PACKAGE);
	const array = module.parentOf(call);
	if (array === null || array.type !== 'ArrayExpression') return false;
	const property = module.parentOf(array);
	if (property === null || property.type !== 'Property') return false;
	const object = module.parentOf(property);
	if (object === null || object.type !== 'ObjectExpression') return false;
	const decoratorCall = module.parentOf(object);
	if (decoratorCall === null || decoratorCall.type !== 'CallExpression') return false;
	if (decoratorCall.callee.type !== 'Identifier') return false;
	const expected = decorator.named.get(NG_MODULE_DECORATOR_NAME);
	if (expected === undefined || module.symbolOf(decoratorCall.callee) !== expected) return false;
	const properties = plainProperties(object);
	if (properties === null) return false;
	return properties.find((entry) => entry.value === array)?.name === 'imports';
}

/**
 * Drop every `X.method()` an installed declaration no longer publishes, where
 * the call names no arguments and stands as an NgModule `imports` member.
 */
export function removeRemovedStaticModuleMethods(
	path: string,
	source: string,
	claims: readonly DocumentedStaticModuleMethodRemoval[],
	readings: readonly ModuleClassSurfaceReading[],
): StaticModuleMethodMigration {
	const module = parseModule(CAPABILITY, path, source);
	const edits: SourceEdit[] = [];
	const changes: StaticModuleMethodChange[] = [];
	const unhandled: string[] = [];
	for (const claim of claims) {
		const imports = readModuleImports(module, claim.package);
		if (!imports.present) continue;
		const reading = readings.find(
			(entry) => entry.package === claim.package && entry.symbol === claim.symbol,
		);
		const calls: StaticCall[] = [];
		forEachNode(module.ast, (node) => {
			if (node.type !== 'CallExpression') return;
			const callee = node.callee;
			if (callee.type !== 'MemberExpression' || callee.computed || callee.optional) return;
			if (callee.property.type !== 'Identifier' || callee.property.name !== claim.method) return;
			if (!denotesExport(module, callee.object, imports, claim.symbol)) return;
			calls.push(Object.freeze({ call: node, receiver: callee.object }));
		});
		if (calls.length === 0) continue;
		const at = (site: StaticCall): string =>
			`${path} line ${String(lineOf(source, site.call.start))}`;
		if (reading === undefined) {
			for (const site of calls)
				unhandled.push(
					`${at(site)}: no declaration of ${claim.symbol} was read from '${claim.package}', so ` +
						`whether the installed line still publishes ${claim.method} is unknown and the call ` +
						'was left exactly as it is',
				);
			continue;
		}
		if (!reading.complete) {
			for (const site of calls)
				unhandled.push(
					`${at(site)}: the declaration of ${claim.symbol} read from '${claim.package}'@` +
						`${reading.version} is incomplete, and an incomplete reading proves no member absent`,
				);
			continue;
		}
		if (reading.statics.includes(claim.method)) {
			for (const site of calls)
				unhandled.push(
					`${at(site)}: '${claim.package}'@${reading.version} still declares ` +
						`${claim.symbol}.${claim.method}, so the diagnostic does not describe this closure ` +
						'and deleting the call would delete working configuration',
				);
			continue;
		}
		for (const site of calls) {
			const call = site.call;
			if (call.arguments.length > 0) {
				unhandled.push(
					`${at(site)}: ${claim.symbol}.${claim.method} is called with ` +
						`${String(call.arguments.length)} argument(s), and ${claim.since} documents no ` +
						'replacement for them — deleting the call would drop the configuration it carried',
				);
				continue;
			}
			if (!inNgModuleImports(module, call)) {
				unhandled.push(
					`${at(site)}: ${claim.symbol}.${claim.method}() is not a member of an NgModule ` +
						'`imports` array, and what the value is for at that position is not read here',
				);
				continue;
			}
			const text = source.slice(site.receiver.start, site.receiver.end);
			edits.push({ start: call.start, end: call.end, text });
			changes.push({
				kind: 'removed-static-module-method',
				line: lineOf(source, call.start),
				package: claim.package,
				symbol: claim.symbol,
				method: claim.method,
				from: `${text}.${claim.method}()`,
				to: text,
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
