/**
 * The call surface of a removed HTTP client, carried to its documented
 * successor as one flow at a time.
 *
 * {@link succeedRemovedSymbolUses} answers the question "what may be written at
 * this position", and for three of `@angular/http`'s symbols it answers
 * *nothing*: `Http`, `Headers` and `Response` have successors that are spelled
 * differently and behave differently, and its own note records the measurement —
 * writing `HttpResponse<any>` into the four type-position sites of the
 * eShopOnContainers WebSPA holdout produced eighteen new `TS2322`/`TS2345`
 * diagnostics where the annotation met the observable the application's own
 * service declares (evidence/ingests/angular-eshop-webspa-netcore2-2/migration/
 * u2a-t024-target-build.log). A name substitution cannot answer them because the
 * thing that changed is not the name.
 *
 * What changed is four things at once, and this capability is written so that a
 * flow either gets all four or gets none:
 *
 * - **The emitted value.** `Http` handed the caller a response object to call
 *   `.json()` on; `HttpClient` hands over the parsed body. So `.json()` is not
 *   renamed, it is *removed*, and the type the flow emits has to be restated at
 *   the same time. The successor states it as a type argument on the call, and
 *   the only honest source for that argument is the application's own declared
 *   return type — read from the function the flow is returned from, never
 *   invented. A flow whose element type the application never declared is
 *   refused rather than typed `any` by this capability's own choice.
 * - **The `body` an era `GET` could carry.** `Http.get(url, { body })` was legal;
 *   `HttpClient` publishes no `body` on `get`. Dropping it silently would drop a
 *   request body the era application sent, so the call is moved to the member
 *   that does publish one — `request(method, url, options)` with the method
 *   written out — and the relocation is proved against the *installed*
 *   declaration of both members rather than against this file's memory of them.
 * - **Header mutation.** `Headers.append` mutated the receiver and returned
 *   nothing; `HttpHeaders.append` returns a new instance and leaves the receiver
 *   alone. A rename compiles and silently stops sending the header, so every
 *   discarded mutator call becomes an assignment back to the receiver — gated on
 *   reading, from the installed successor, that the mutator returns the class.
 * - **The annotation on what the flow emits.** An era `Response` annotation on a
 *   `map` callback parameter names a value the successor does not produce. The
 *   era type system typed the body as `any` — `Response.json(): any` was the
 *   whole of its answer — so the annotation is carried to `any` and the loss of
 *   checking is declared. That is not a repair of the application's typing: it
 *   is the era's own strength, restated where the era's own spelling no longer
 *   resolves.
 *
 * Every gate is a reading of what is installed, and the refusal is per
 * declaration and total for the same reason the sibling capability's is: a
 * module whose `Headers` moved and whose `Http` did not is a module importing
 * from a specifier the tree does not answer.
 */

import { compareStrings } from './angular-target-cell.ts';
import type { RootSurfaceReading } from './removed-entry-point-symbol-successor.ts';
import {
	applySourceEdits,
	forEachNode,
	isFreeRootName,
	lineOf,
	parseModule,
	plainProperties,
	readModuleImports,
	type AstNode,
	type SemanticModule,
	type SourceEdit,
} from './semantic-module.ts';

const CAPABILITY = 'HttpClient call surface';

/** The entry points a `map` operator may be imported through. */
export const RXJS_OPERATOR_SPECIFIERS: readonly string[] = Object.freeze([
	'rxjs/operators',
	'rxjs',
]);

/**
 * One member of an installed successor class, read from its own declaration.
 *
 * `returns` is the declared return type of the first declaration of the member,
 * which is what says whether a mutator mutates or clones. `optionKeys` is every
 * key the member's option-object parameter publishes across its overloads,
 * which is what says whether an option the era call carried survived.
 */
export type SuccessorClassMember = Readonly<{
	member: string;
	returns: string;
	optionKeys: readonly string[];
}>;

/**
 * What one installed successor class publishes. `complete` is false when the
 * class declaration was not found at all, because a reading that found no class
 * proves no member absent and no option absent.
 */
export type SuccessorClassSurfaceReading = Readonly<{
	package: string;
	version: string;
	symbol: string;
	members: readonly SuccessorClassMember[];
	complete: boolean;
}>;

/**
 * The documented claim: which removed symbols make up a client's call surface,
 * what each is replaced by, and the names of the members whose *behaviour* the
 * rules below are about. Nothing here is a version range and nothing here is an
 * application: every one of these names is checked against an installed reading
 * before a byte is written.
 */
export type HttpCallSurfaceClaim = Readonly<{
	/** The specifier the successor is imported from. */
	package: string;
	/** The specifier the application imports through. */
	specifier: string;
	since: string;
	/** The injected client: the removed service, its successor, and the member that carries a body. */
	client: Readonly<{ from: string; to: string; requestMember: string }>;
	/** The header collection: the removed class, its successor, and the members that mutated. */
	headers: Readonly<{ from: string; to: string; mutators: readonly string[] }>;
	/** The response: the removed class, the accessor that parsed the body, and the type it returned. */
	response: Readonly<{ from: string; bodyAccessor: string; bodyType: string }>;
	note: string;
}>;

/** The `@angular/http` claim. */
export const ANGULAR_HTTP_CALL_SURFACE: HttpCallSurfaceClaim = Object.freeze({
	package: '@angular/common/http',
	specifier: '@angular/http',
	since: 'Angular 8 (the package stops at 7.2.16)',
	client: Object.freeze({ from: 'Http', to: 'HttpClient', requestMember: 'request' }),
	headers: Object.freeze({
		from: 'Headers',
		to: 'HttpHeaders',
		mutators: Object.freeze(['append', 'set', 'delete']),
	}),
	response: Object.freeze({ from: 'Response', bodyAccessor: 'json', bodyType: 'any' }),
	note:
		'Angular replaced `Http` with `HttpClient` in `@angular/common/http` and removed the package ' +
		'after 7.2.16. The successor parses the response body itself, publishes no `body` option on ' +
		'`get`, and returns a new `HttpHeaders` from every mutator instead of mutating the receiver.',
});

export type HttpCallSurfaceChange = Readonly<{
	kind:
		| 'http-client-injection'
		| 'http-client-body-accessor-removal'
		| 'http-client-request-relocation'
		| 'http-client-element-type'
		| 'http-headers-immutable-mutation'
		| 'http-response-annotation';
	line: number;
	specifier: string;
	from: string;
	to: string;
	detail: string;
}>;

export type HttpCallSurfaceMigration = Readonly<{
	path: string;
	source: string;
	changed: boolean;
	changes: readonly HttpCallSurfaceChange[];
	declaredDifferences: readonly string[];
	unhandled: readonly string[];
}>;

/**
 * Every identifier node in a module that resolves to `local` and is a *use* of
 * it. The declaration that bound it is not a use: an import specifier is the
 * name arriving, and this capability rewrites the declaration as a whole.
 */
function referencesTo(module: SemanticModule, local: unknown): readonly AstNode[] {
	const found: AstNode[] = [];
	forEachNode(module.ast, (node) => {
		if (node.type !== 'Identifier') return;
		if (module.symbolOf(node) !== local) return;
		if (module.parentOf(node)?.type === 'ImportSpecifier') return;
		found.push(node);
	});
	return Object.freeze(found);
}

/** The member of a successor reading, or null when the reading states none. */
function memberOf(
	reading: SuccessorClassSurfaceReading | undefined,
	member: string,
): SuccessorClassMember | null {
	return reading?.members.find((entry) => entry.member === member) ?? null;
}

/** The annotated declaration a type reference belongs to, walking out one step. */
function annotationOwner(module: SemanticModule, typeReference: AstNode): AstNode | null {
	const annotation = module.parentOf(typeReference);
	if (annotation === null || annotation.type !== 'TSTypeAnnotation') return null;
	return module.parentOf(annotation);
}

/** Whether a node is a parameter of the enclosing function rather than anything else. */
function isParameterOf(module: SemanticModule, node: AstNode): AstNode | null {
	let previous = node;
	let current: AstNode | null = module.parentOf(node);
	while (current !== null) {
		if (
			current.type === 'FunctionExpression' ||
			current.type === 'FunctionDeclaration' ||
			current.type === 'ArrowFunctionExpression'
		)
			return (current.params as readonly AstNode[]).includes(previous) ? current : null;
		if (current.type === 'TSParameterProperty') {
			previous = current;
			current = module.parentOf(current);
			continue;
		}
		return null;
	}
	return null;
}

/** The call this node is the sole argument of, when the callee is the named binding. */
function operatorCallOf(
	module: SemanticModule,
	callback: AstNode,
	operators: ReadonlySet<unknown>,
): AstNode | null {
	const call = module.parentOf(callback);
	if (call === null || call.type !== 'CallExpression') return null;
	if (!(call.arguments as readonly AstNode[]).includes(callback)) return null;
	if (call.callee.type !== 'Identifier') return null;
	if (!operators.has(module.symbolOf(call.callee))) return null;
	return call;
}

/** The `.pipe(...)` call an operator call is an argument of. */
function pipeCallOf(module: SemanticModule, operatorCall: AstNode): AstNode | null {
	const pipe = module.parentOf(operatorCall);
	if (pipe === null || pipe.type !== 'CallExpression') return null;
	const callee = pipe.callee;
	if (callee.type !== 'MemberExpression' || callee.computed) return null;
	if (callee.property.type !== 'Identifier' || callee.property.name !== 'pipe') return null;
	return pipe;
}

/**
 * The single type argument of the `Observable<T>` the enclosing function
 * declares it returns, as the application wrote it.
 *
 * This is the whole of the element-type reading and it is deliberately narrow:
 * the type is read from a declaration the application made about this very
 * flow, never from the value, never from a default, and never from the shape of
 * a consumer somewhere else in the tree.
 */
function declaredElementType(module: SemanticModule, source: string, from: AstNode): string | null {
	let previous = from;
	let current = module.parentOf(from);
	while (current !== null) {
		if (
			current.type === 'FunctionExpression' ||
			current.type === 'FunctionDeclaration' ||
			current.type === 'ArrowFunctionExpression'
		) {
			if ((current.params as readonly AstNode[]).includes(previous)) return null;
			const annotation = current.returnType ?? null;
			if (annotation === null || annotation.type !== 'TSTypeAnnotation') return null;
			const reference = annotation.typeAnnotation;
			if (reference.type !== 'TSTypeReference') return null;
			if (
				reference.typeName.type !== 'Identifier' ||
				reference.typeName.name !== 'Observable'
			)
				return null;
			const supplied = reference.typeArguments ?? null;
			if (supplied === null || supplied.type !== 'TSTypeParameterInstantiation') return null;
			const parameters = supplied.params as readonly AstNode[];
			if (parameters.length !== 1) return null;
			const only = parameters[0] as AstNode;
			return source.slice(only.start, only.end);
		}
		previous = current;
		current = module.parentOf(current);
	}
	return null;
}

/** A receiver this capability can write an assignment back to. */
function receiverKey(node: AstNode): string | null {
	if (node.type === 'Identifier') return node.name;
	if (node.type !== 'MemberExpression' || node.computed || node.optional) return null;
	if (node.object.type !== 'ThisExpression') return null;
	if (node.property.type !== 'Identifier') return null;
	return `this.${node.property.name}`;
}

/** A narrowed call node, so a member this capability reads is a member it can see. */
type CallNode = Extract<AstNode, { type: 'CallExpression' }>;

type ClientCall = Readonly<{
	call: CallNode;
	member: AstNode;
	memberName: string;
}>;

/**
 * Carry one module's uses of a removed HTTP client to the successor's call
 * surface, or refuse the module and say which flow could not be reconciled.
 */
export function migrateHttpClientCallSurface(
	path: string,
	source: string,
	claim: HttpCallSurfaceClaim,
	readings: readonly RootSurfaceReading[],
	classSurfaces: readonly SuccessorClassSurfaceReading[],
): HttpCallSurfaceMigration {
	const unchanged = Object.freeze({
		path,
		source,
		changed: false,
		changes: Object.freeze([]),
		declaredDifferences: Object.freeze([]),
		unhandled: Object.freeze([]),
	});
	if (!source.includes(claim.specifier)) return unchanged;
	const module = parseModule(CAPABILITY, path, source);
	const imports = readModuleImports(module, claim.specifier);
	if (!imports.present || imports.declarations.length === 0) return unchanged;
	const edits: SourceEdit[] = [];
	const changes: HttpCallSurfaceChange[] = [];
	const declaredDifferences: string[] = [];
	const unhandled: string[] = [];
	const declaration = imports.declarations[0];
	if (declaration === undefined || declaration.type !== 'ImportDeclaration') return unchanged;
	const line = lineOf(source, declaration.start);
	const at = `${path} line ${String(line)}`;
	const refuse = (reason: string): HttpCallSurfaceMigration => {
		unhandled.push(
			`${at}: ${claim.specifier} is unreachable and ${reason}. The whole declaration was left ` +
				'as it is: a call surface half carried is a module compiling against a shape the ' +
				'successor will not produce.',
		);
		return Object.freeze({
			path,
			source,
			changed: false,
			changes: Object.freeze([]),
			declaredDifferences: Object.freeze([]),
			unhandled: Object.freeze([...new Set(unhandled)].sort(compareStrings)),
		});
	};
	if (imports.declarations.length !== 1)
		return refuse(
			`the module carries ${String(imports.declarations.length)} declarations of it and this ` +
				'capability rewrites one',
		);
	if (imports.wide)
		return refuse(
			'the declaration carries a default or namespace binding, whose members cannot be resolved ' +
				'to a successor by name',
		);
	const reading = readings.find(
		(entry) => entry.package === claim.package && entry.specifier === claim.specifier,
	);
	if (reading === undefined)
		return refuse(`no successor surface was read for '${claim.package}'`);
	if (!reading.complete)
		return refuse(
			`the surface of '${claim.package}'@${reading.version} is incomplete, so it establishes ` +
				'neither that a successor is published nor that the replaced name is not',
		);
	if (reading.specifierResolves)
		return refuse(
			`'${claim.package}'@${reading.version} still answers it, so the rewrite would be a ` +
				'rewrite of working code',
		);
	const carried: string[] = [];
	const clientSurface = classSurfaces.find(
		(entry) => entry.package === claim.package && entry.symbol === claim.client.to,
	);
	const headerSurface = classSurfaces.find(
		(entry) => entry.package === claim.package && entry.symbol === claim.headers.to,
	);
	/** The names this module imports, each one placed by its own rule below. */
	const named = [...imports.named.entries()];
	for (const [name] of named)
		if (
			name !== claim.client.from &&
			name !== claim.headers.from &&
			name !== claim.response.from
		)
			return refuse(`no rule of this capability is written for ${name}`);

	/* ---------------------------------------------------------------- client */
	const clientBinding = imports.named.get(claim.client.from);
	const clientReceivers = new Set<string>();
	if (clientBinding !== undefined) {
		if (!reading.rootExports.includes(claim.client.to))
			return refuse(
				`'${claim.package}'@${reading.version} does not publish ${claim.client.to}`,
			);
		if (clientSurface === undefined || !clientSurface.complete)
			return refuse(
				`no complete declaration of ${claim.client.to} was read, so neither the members it ` +
					'publishes nor the options they take are established',
			);
		if (!isFreeRootName(module, claim.client.to))
			return refuse(`${claim.client.to} is already bound in this module's root scope`);
		for (const node of referencesTo(module, clientBinding)) {
			const owner = annotationOwner(module, module.parentOf(node) ?? node);
			if (
				(module.parentOf(node)?.type ?? '') !== 'TSTypeReference' ||
				owner === null ||
				owner.type !== 'Identifier' ||
				isParameterOf(module, owner) === null
			)
				return refuse(
					`${claim.client.from} is used at line ${String(lineOf(source, node.start))} other ` +
						'than as the declared type of an injected parameter, and the successor is a ' +
						'different service and not a different spelling',
				);
			const key = receiverKey(owner);
			const property = module.parentOf(owner)?.type === 'TSParameterProperty';
			if (key === null)
				return refuse(`${claim.client.from} annotates a parameter with no name`);
			clientReceivers.add(property ? `this.${key}` : key);
			edits.push({ start: node.start, end: node.end, text: claim.client.to });
			changes.push({
				kind: 'http-client-injection',
				line: lineOf(source, node.start),
				specifier: claim.specifier,
				from: claim.client.from,
				to: claim.client.to,
				detail: `the injected ${key} is declared ${claim.client.to}`,
			});
		}
		carried.push(claim.client.to);
	}

	/* --------------------------------------------------------------- headers */
	const headerBinding = imports.named.get(claim.headers.from);
	const headerReceivers = new Set<string>();
	if (headerBinding !== undefined) {
		if (!reading.rootExports.includes(claim.headers.to))
			return refuse(
				`'${claim.package}'@${reading.version} does not publish ${claim.headers.to}`,
			);
		if (headerSurface === undefined || !headerSurface.complete)
			return refuse(
				`no complete declaration of ${claim.headers.to} was read, so whether its mutators ` +
					'return a new instance is not established',
			);
		if (!isFreeRootName(module, claim.headers.to))
			return refuse(`${claim.headers.to} is already bound in this module's root scope`);
		for (const node of referencesTo(module, headerBinding)) {
			const parent = module.parentOf(node);
			if (parent === null)
				return refuse(`${claim.headers.from} is used in no position at all`);
			if (parent.type === 'NewExpression' && parent.callee === node) {
				edits.push({ start: node.start, end: node.end, text: claim.headers.to });
				const assignment = module.parentOf(parent);
				if (assignment !== null && assignment.type === 'AssignmentExpression') {
					const key = receiverKey(assignment.left);
					if (key !== null) headerReceivers.add(key);
				}
				continue;
			}
			if (parent.type === 'TSTypeReference' && parent.typeName === node) {
				const owner = annotationOwner(module, parent);
				if (owner === null)
					return refuse(
						`${claim.headers.from} annotates something at line ` +
							`${String(lineOf(source, node.start))} this capability does not read`,
					);
				if (owner.type === 'PropertyDefinition' && owner.key.type === 'Identifier')
					headerReceivers.add(`this.${owner.key.name}`);
				else if (owner.type === 'Identifier') {
					const key = receiverKey(owner);
					if (key !== null) headerReceivers.add(key);
				}
				edits.push({ start: node.start, end: node.end, text: claim.headers.to });
				continue;
			}
			return refuse(
				`${claim.headers.from} is used at line ${String(lineOf(source, node.start))} other than ` +
					'as a type or a `new` target',
			);
		}
		carried.push(claim.headers.to);
	}

	/* -------------------------------------------------- header mutation sites */
	if (headerReceivers.size > 0) {
		const immutable = claim.headers.mutators.filter((mutator) => {
			const member = memberOf(headerSurface, mutator);
			return member !== null && member.returns === claim.headers.to;
		});
		let refusal: HttpCallSurfaceMigration | null = null;
		forEachNode(module.ast, (node) => {
			if (refusal !== null) return;
			if (node.type !== 'CallExpression') return;
			const callee = node.callee;
			if (callee.type !== 'MemberExpression' || callee.computed) return;
			if (callee.property.type !== 'Identifier') return;
			const key = receiverKey(callee.object);
			if (key === null || !headerReceivers.has(key)) return;
			const mutator = callee.property.name;
			if (!claim.headers.mutators.includes(mutator)) return;
			if (!immutable.includes(mutator)) {
				refusal = refuse(
					`${claim.headers.to}.${mutator} was not read as returning a new ` +
						`${claim.headers.to}, so whether the era mutation survives a rename is not ` +
						'established',
				);
				return;
			}
			const statement = module.parentOf(node);
			if (statement === null || statement.type !== 'ExpressionStatement') {
				refusal = refuse(
					`the era ${claim.headers.from}.${mutator} at line ` +
						`${String(lineOf(source, node.start))} is not a discarded statement, and its ` +
						'successor returns a value where the era one returned nothing',
				);
				return;
			}
			edits.push({ start: node.start, end: node.start, text: `${key} = ` });
			changes.push({
				kind: 'http-headers-immutable-mutation',
				line: lineOf(source, node.start),
				specifier: claim.specifier,
				from: `${key}.${mutator}(…)`,
				to: `${key} = ${key}.${mutator}(…)`,
				detail: `${claim.headers.to}.${mutator} returns ${claim.headers.to} in '${claim.package}'@${headerSurface?.version ?? 'unread'}`,
			});
		});
		if (refusal !== null) return refusal;
		declaredDifferences.push(
			`${at}: ${claim.headers.from} mutated the receiver and ${claim.headers.to} does not. ` +
				'Every discarded mutator call is now an assignment back to the receiver, so the header ' +
				'set the era application built is the header set the successor sends.',
		);
	}

	/* ----------------------------------------------------------- client calls */
	const clientCalls: ClientCall[] = [];
	if (clientReceivers.size > 0) {
		forEachNode(module.ast, (node) => {
			if (node.type !== 'CallExpression') return;
			const callee = node.callee;
			if (callee.type !== 'MemberExpression' || callee.computed) return;
			if (callee.property.type !== 'Identifier') return;
			const key = receiverKey(callee.object);
			if (key === null || !clientReceivers.has(key)) return;
			clientCalls.push({
				call: node,
				member: callee.property,
				memberName: callee.property.name,
			});
		});
	}
	for (const site of clientCalls) {
		const where = lineOf(source, site.call.start);
		const published = memberOf(clientSurface, site.memberName);
		if (published === null)
			return refuse(
				`${claim.client.to} publishes no ${site.memberName} at line ${String(where)}, so the ` +
					'call has no successor to be carried to',
			);
		/*
		 * The options the era call carried, and whether the successor's member of
		 * the same name still publishes each of them. An option it does not is not
		 * dropped: the call is moved to the member that does.
		 */
		const options = site.call.arguments.find(
			(argument) => argument.type === 'ObjectExpression',
		);
		const properties = options === undefined ? [] : (plainProperties(options) ?? null);
		if (properties === null)
			return refuse(
				`the options of the call at line ${String(where)} are not readable as plain ` +
					'properties, so which of them the successor still publishes cannot be established',
			);
		const departed = properties
			.map((entry) => entry.name)
			.filter((key) => !published.optionKeys.includes(key));
		if (departed.length > 0) {
			const request = memberOf(clientSurface, claim.client.requestMember);
			const unanswered = departed.filter((key) => !(request?.optionKeys ?? []).includes(key));
			if (request === null || unanswered.length > 0)
				return refuse(
					`the call at line ${String(where)} passes ${unanswered.sort(compareStrings).join(', ')} ` +
						`and neither ${claim.client.to}.${site.memberName} nor ` +
						`${claim.client.to}.${claim.client.requestMember} publishes it, so carrying the ` +
						'call would drop what the era request sent',
				);
			edits.push({
				start: site.member.start,
				end: site.member.end,
				text: claim.client.requestMember,
			});
			const first = site.call.arguments[0];
			if (first === undefined)
				return refuse(`the call at line ${String(where)} passes no url to relocate`);
			edits.push({
				start: first.start,
				end: first.start,
				text: `'${site.memberName.toUpperCase()}', `,
			});
			changes.push({
				kind: 'http-client-request-relocation',
				line: where,
				specifier: claim.specifier,
				from: `${claim.client.from}.${site.memberName}(url, { ${departed.sort(compareStrings).join(', ')} })`,
				to: `${claim.client.to}.${claim.client.requestMember}('${site.memberName.toUpperCase()}', url, …)`,
				detail:
					`'${claim.package}'@${clientSurface?.version ?? 'unread'} publishes ` +
					`${departed.sort(compareStrings).join(', ')} on ${claim.client.requestMember} and not ` +
					`on ${site.memberName}`,
			});
			declaredDifferences.push(
				`${at}: the era ${claim.client.from}.${site.memberName} at line ${String(where)} carried ` +
					`${departed.sort(compareStrings).join(', ')}, which ${claim.client.to} publishes only ` +
					`on ${claim.client.requestMember}. The call was moved rather than the option dropped, ` +
					'so the request the era application sent is the request the successor sends.',
			);
		}
		/*
		 * The body accessor, and the type the flow emits. They are one question:
		 * removing `.json()` is only honest if what the observable emits is
		 * restated, and the only thing entitled to state it is the application's
		 * own declared return type.
		 */
		const operators = new Set<unknown>();
		for (const specifier of RXJS_OPERATOR_SPECIFIERS) {
			const binding = readModuleImports(module, specifier).named.get('map');
			if (binding !== undefined) operators.add(binding);
		}
		const pipe = module.parentOf(site.call);
		const accessors: CallNode[] = [];
		let callback: AstNode | null = null;
		if (
			pipe !== null &&
			pipe.type === 'MemberExpression' &&
			pipe.property.type === 'Identifier' &&
			pipe.property.name === 'pipe'
		) {
			const pipeCall = module.parentOf(pipe);
			if (pipeCall !== null && pipeCall.type === 'CallExpression')
				for (const argument of pipeCall.arguments as readonly AstNode[]) {
					if (argument.type !== 'CallExpression') continue;
					if (argument.callee.type !== 'Identifier') continue;
					if (!operators.has(module.symbolOf(argument.callee))) continue;
					const only = (argument.arguments as readonly AstNode[])[0];
					if (only === undefined) continue;
					if (
						only.type !== 'ArrowFunctionExpression' &&
						only.type !== 'FunctionExpression'
					)
						continue;
					callback = only;
				}
		}
		if (callback !== null) {
			const parameter = (callback.params as readonly AstNode[])[0] ?? null;
			const binding = parameter === null ? null : module.symbolOf(parameter);
			if (binding !== null)
				for (const reference of referencesTo(module, binding)) {
					const member = module.parentOf(reference);
					if (member === null || member.type !== 'MemberExpression' || member.computed)
						continue;
					if (member.property.type !== 'Identifier') continue;
					if (member.property.name !== claim.response.bodyAccessor) continue;
					const accessorCall = module.parentOf(member);
					if (accessorCall === null || accessorCall.type !== 'CallExpression') continue;
					if (accessorCall.callee !== member) continue;
					accessors.push(accessorCall);
				}
		}
		if (accessors.length > 0) {
			const element = declaredElementType(module, source, site.call);
			if (element === null)
				return refuse(
					`the flow returned from the call at line ${String(where)} calls ` +
						`.${claim.response.bodyAccessor}() on what the era client emitted, and the ` +
						'application declares no `Observable<T>` return type this capability can read the ' +
						'emitted type from. Removing the accessor without restating the type would leave ' +
						'the flow typed by nothing the application ever wrote',
				);
			for (const accessorCall of accessors) {
				const member = accessorCall.callee;
				if (member.type !== 'MemberExpression') continue;
				edits.push({ start: member.object.end, end: accessorCall.end, text: '' });
				changes.push({
					kind: 'http-client-body-accessor-removal',
					line: lineOf(source, accessorCall.start),
					specifier: claim.specifier,
					from: `.${claim.response.bodyAccessor}()`,
					to: '',
					detail: `${claim.client.to} emits the parsed body, so the accessor has nothing to parse`,
				});
			}
			edits.push({ start: site.member.end, end: site.member.end, text: `<${element}>` });
			changes.push({
				kind: 'http-client-element-type',
				line: where,
				specifier: claim.specifier,
				from: `${claim.client.from}.${site.memberName}(…)`,
				to: `${claim.client.to}.${site.memberName}<${element}>(…)`,
				detail:
					"the emitted type is the application's own declared return type for the flow, read " +
					'from the function the call is returned from',
			});
		}
	}

	/* -------------------------------------------------------------- response */
	const responseBinding = imports.named.get(claim.response.from);
	if (responseBinding !== undefined) {
		const operators = new Set<unknown>();
		for (const specifier of RXJS_OPERATOR_SPECIFIERS) {
			const binding = readModuleImports(module, specifier).named.get('map');
			if (binding !== undefined) operators.add(binding);
		}
		const sites = referencesTo(module, responseBinding);
		for (const node of sites) {
			const parent = module.parentOf(node);
			if (parent === null || parent.type !== 'TSTypeReference' || parent.typeName !== node)
				return refuse(
					`${claim.response.from} is used at line ${String(lineOf(source, node.start))} other ` +
						'than as a type, and the successor emits a parsed body rather than a response',
				);
			const owner = annotationOwner(module, parent);
			const callback = owner === null ? null : isParameterOf(module, owner);
			const operatorCall =
				callback === null ? null : operatorCallOf(module, callback, operators);
			if (operatorCall === null || pipeCallOf(module, operatorCall) === null)
				return refuse(
					`${claim.response.from} annotates something at line ` +
						`${String(lineOf(source, node.start))} that is not the parameter of an operator ` +
						'callback in a pipe, so what the annotation describes is not established',
				);
			edits.push({ start: parent.start, end: parent.end, text: claim.response.bodyType });
			changes.push({
				kind: 'http-response-annotation',
				line: lineOf(source, node.start),
				specifier: claim.specifier,
				from: claim.response.from,
				to: claim.response.bodyType,
				detail:
					`the era ${claim.response.from}.${claim.response.bodyAccessor}() returned ` +
					`${claim.response.bodyType}, and the successor emits that body in place of the response`,
			});
		}
		if (sites.length > 0)
			declaredDifferences.push(
				`${at}: ${claim.response.from} annotated a value the successor does not emit — it emits ` +
					`the parsed body. The annotation was carried to ${claim.response.bodyType}, which is ` +
					`what the era ${claim.response.from}.${claim.response.bodyAccessor}() returned, so the ` +
					'flow keeps exactly the checking strength the era gave it and no more. A member of ' +
					`${claim.response.from} read through one of these parameters is no longer checked ` +
					'against that class, because the value never was one.',
			);
	}

	/* ----------------------------------------------------------- declaration */
	const quote = source.slice(declaration.source.start, declaration.source.start + 1);
	let end = declaration.end;
	if (source[end] === ';') end += 1;
	if (carried.length === 0) {
		if (source[end] === '\r') end += 1;
		if (source[end] === '\n') end += 1;
		edits.push({ start: declaration.start, end, text: '' });
	} else
		edits.push({
			start: declaration.start,
			end,
			text: `import { ${[...carried].sort(compareStrings).join(', ')} } from ${quote}${claim.package}${quote};`,
		});
	const migrated = applySourceEdits(source, edits);
	return Object.freeze({
		path,
		source: migrated,
		changed: migrated !== source,
		changes: Object.freeze(changes),
		declaredDifferences: Object.freeze([...new Set(declaredDifferences)].sort(compareStrings)),
		unhandled: Object.freeze([...new Set(unhandled)].sort(compareStrings)),
	});
}
