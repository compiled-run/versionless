/**
 * The refusal census: every refusal this repository can emit from the code the
 * migration pipeline is made of, with its exact string, the condition that
 * raises it, and whose decision it is.
 *
 * The census is derived, not written. Each entry is read out of the source by
 * parsing it — the message from the thrown expression, the condition from the
 * guard the throw sits under, the location from the node — so a refusal cannot
 * be added, reworded or deleted in source without the census moving with it.
 * A hand-maintained list would be wrong within a week and would be wrong
 * silently, which is the failure mode this document exists to prevent.
 *
 * Two scopes are deliberate.
 *
 * The pipeline's own refusals are the `refuse()` call sites in
 * `packages/cli/src/operator/**`; those carry their own code, stage and origin,
 * and the census reads them rather than inventing any. A plain `throw` left in
 * those files is recorded as a **defect**, not as a refusal — that distinction
 * is the whole reason the exit codes differ.
 *
 * The frozen subtrees are enumerated read-only. T001 enumerated the 21 throws
 * in the operator flows and said so explicitly; the adapters were never
 * counted. They are counted here. Nothing in this module writes into a frozen
 * path, and the census records the freeze composite it was read at so a later
 * reader can tell whether it is still current.
 */

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { analyze } from 'yuku-analyzer';
import { ADAPTER_FREEZE_COMPOSITE } from '../../../trust/src/freeze.ts';
import type { RefusalOrigin } from './refusals.ts';

export const REFUSAL_CENSUS_SCHEMA = 'versionless.refusal-census.v1';

/** Where the census is published. */
export const REFUSAL_CENSUS_FILE = 'evidence/runs/operator-flows/refusal-census.json';

/**
 * The modules the census reads, with the stage reading each one carries.
 *
 * The stage is a *static* reading: which operator stage composes this module,
 * with the basis for saying so. It is not a claim that every throw inside the
 * module is reachable from that stage — reachability per site was not computed,
 * and the census says as much rather than implying a call graph nobody ran.
 */
export type CensusModule = Readonly<{
	/** Repo-relative path. */
	file: string;
	origin: RefusalOrigin;
	/** `plan`, `build`, `plan-or-build`, `not-reached`, or an operator stage. */
	stage: string;
	stageBasis: string;
}>;

const OPERATOR_MODULE = (file: string, stage: string, basis: string): CensusModule =>
	Object.freeze({
		file: `packages/cli/src/operator/${file}`,
		origin: 'pipeline' as const,
		stage,
		stageBasis: basis,
	});

const REACT = 'packages/frameworks/react/src';
const ANGULAR = 'packages/frameworks/angular/src';

const FROZEN_MODULE = (file: string, stage: string, basis: string): CensusModule =>
	Object.freeze({ file, origin: 'frozen-adapter' as const, stage, stageBasis: basis });

const ERA_MIGRATION_CHAIN =
	'imported by angular-cli-era-migration.ts, which is the entry point planApplication composes for the Angular lineage.';

const ERA_MIGRATION_TRANSITIVE =
	'imported by capability modules that angular-cli-era-migration.ts composes, which is the entry point planApplication composes for the Angular lineage.';

const NOT_COMPOSED_BY_ANY_STAGE =
	'exported from the package barrel but composed by no operator stage: the flows compose craEntryDocument, planViteOriginConfigSource and migrateAngularCliEraWorkspace, and none of them reaches this module.';

export const CENSUS_MODULES: readonly CensusModule[] = Object.freeze([
	OPERATOR_MODULE(
		'acquire.ts',
		'acquire',
		'the acquire stage fetches an application source under consent through this module.',
	),
	OPERATOR_MODULE(
		'analyze.ts',
		'analyze',
		'the analyze stage reads the tree through this module.',
	),
	OPERATOR_MODULE('apply.ts', 'apply', 'the apply stage writes the lane through this module.'),
	OPERATOR_MODULE(
		'batch.ts',
		'batch',
		'the batch flow reads the fleet it was handed here, before any application is invoked.',
	),
	OPERATOR_MODULE(
		'build.ts',
		'build',
		'the build stage runs the lane build through this module.',
	),
	OPERATOR_MODULE(
		'era-cell.ts',
		'era-cell',
		'the era-cell stage determines the toolchain cell and reads what this host can supply here.',
	),
	OPERATOR_MODULE(
		'flows.ts',
		'arguments',
		'the command surface parses and validates arguments here before any stage runs.',
	),
	OPERATOR_MODULE(
		'ingest.ts',
		'ingest',
		'the ingest stage admits an application source through this module.',
	),
	OPERATOR_MODULE(
		'install.ts',
		'install',
		'the install stage resolves the lane closure through this module.',
	),
	OPERATOR_MODULE(
		'license.ts',
		'license-at-pin',
		'the license-at-pin stage reads the licence at the pinned source here; the ingest stage composes the same reading.',
	),
	OPERATOR_MODULE(
		'lane.ts',
		'lane',
		'the lane stage composes the generated build configuration and the manifest rewrite here.',
	),
	OPERATOR_MODULE(
		'matrix.ts',
		'supported-matrix',
		'the supported-matrix flow verifies trust and renders the matrix here.',
	),
	OPERATOR_MODULE(
		'plan.ts',
		'plan',
		'the plan stage composes the changeset through this module.',
	),
	OPERATOR_MODULE(
		'refusal-census.ts',
		'refusal-census',
		'the census flow derives this document here.',
	),
	OPERATOR_MODULE(
		'run.ts',
		'arguments',
		'the run flow composes every stage in order here; what it raises of its own is about the chaining, before any stage decides anything.',
	),
	OPERATOR_MODULE(
		'refusals.ts',
		'arguments',
		'the refusal carrier itself; it raises nothing of its own.',
	),
	OPERATOR_MODULE(
		'verify.ts',
		'verify',
		'the verify flow runs the offline checks through this module.',
	),
	OPERATOR_MODULE(
		'witness.ts',
		'witness',
		'the witness stage replays the derived journeys against the built lane through this module; what it raises of its own is about this host, not about the application.',
	),
	OPERATOR_MODULE(
		'witness-synthesize.ts',
		'witness-synthesize',
		'the witness-synthesize stage reads the application own end-to-end suite and, failing that, crawls its served lane through this module.',
	),
	FROZEN_MODULE(
		`${REACT}/react-cra-vite-adapter.ts`,
		'plan-or-build',
		'carries craEntryDocument, which composeReactPlan calls at plan time, and the create-react-app compatibility plugins, which run inside the lane build.',
	),
	FROZEN_MODULE(
		`${REACT}/react-cra-process-global.ts`,
		'build',
		'carries the create-react-app process-global plugin, which runs inside the lane build.',
	),
	FROZEN_MODULE(
		`${REACT}/react-vite-origin-adapter.ts`,
		'plan-or-build',
		'carries planViteOriginConfigSource, which composeReactPlan calls at plan time for a Vite-origin tree, and the Vite-origin adapter plugins, which run inside a build.',
	),
	FROZEN_MODULE(
		`${REACT}/react-connect-to-hooks.ts`,
		'not-reached',
		'a pinned source-level transform. The plan stage states in its own unhandled findings that it supplies neither the exact source digests nor the maintained package/lock pair these transforms are gated on, so no application module is rewritten by it.',
	),
	FROZEN_MODULE(
		`${REACT}/react-data-flow-connect-to-hooks.ts`,
		'not-reached',
		'a pinned source-level transform, gated on readings the plan stage does not supply.',
	),
	FROZEN_MODULE(
		`${REACT}/react-class-lifecycle-to-hooks.ts`,
		'not-reached',
		'a pinned source-level transform, gated on readings the plan stage does not supply.',
	),
	FROZEN_MODULE(
		`${REACT}/react-composed-migration.ts`,
		'not-reached',
		'composes the pinned source-level transforms, which the plan stage does not supply readings for.',
	),
	FROZEN_MODULE(
		`${REACT}/react-next-static-adapter.ts`,
		'not-reached',
		'the Next.js lineage is refused by planApplication before any adapter is composed.',
	),
	FROZEN_MODULE(`${ANGULAR}/angular-cli-era-migration.ts`, 'plan', ERA_MIGRATION_CHAIN),
	FROZEN_MODULE(`${ANGULAR}/angular-target-cell.ts`, 'plan', ERA_MIGRATION_CHAIN),
	FROZEN_MODULE(`${ANGULAR}/angular-source-migration.ts`, 'plan', ERA_MIGRATION_CHAIN),
	FROZEN_MODULE(`${ANGULAR}/angular-workspace-migration.ts`, 'plan', ERA_MIGRATION_CHAIN),
	FROZEN_MODULE(
		`${ANGULAR}/angular-cli-json-workspace-synthesis.ts`,
		'plan',
		ERA_MIGRATION_CHAIN,
	),
	FROZEN_MODULE(`${ANGULAR}/ngrx-effects-migration.ts`, 'plan', ERA_MIGRATION_CHAIN),
	FROZEN_MODULE(`${ANGULAR}/sentry-v8-migration.ts`, 'plan', ERA_MIGRATION_CHAIN),
	FROZEN_MODULE(`${ANGULAR}/undeclared-runtime-dependency.ts`, 'plan', ERA_MIGRATION_CHAIN),
	FROZEN_MODULE(`${ANGULAR}/application-source-dependency.ts`, 'plan', ERA_MIGRATION_CHAIN),
	FROZEN_MODULE(`${ANGULAR}/semantic-module.ts`, 'plan', ERA_MIGRATION_TRANSITIVE),
	FROZEN_MODULE(
		`${ANGULAR}/split-element-successor.ts`,
		'not-reached',
		NOT_COMPOSED_BY_ANY_STAGE,
	),
	FROZEN_MODULE(
		'packages/core/src/migrations/angular-standalone-component.ts',
		'not-reached',
		NOT_COMPOSED_BY_ANY_STAGE,
	),
	FROZEN_MODULE(
		'packages/core/src/bundlers/vite8-adapter.ts',
		'not-reached',
		'the Vite 8 adapter kernel is composed by fixture drivers for their own evidence; the generated lane configuration composes the create-react-app adapter only.',
	),
	FROZEN_MODULE(
		'packages/core/src/analysis/direct-dom-access.ts',
		'not-reached',
		'composed by the direct-dom-inventory command, which is not an operator migration stage.',
	),
]);

/** The roots scanned for refusal sites, and the origin each carries. */
export const CENSUS_ROOTS: readonly Readonly<{ root: string; origin: RefusalOrigin }>[] =
	Object.freeze([
		Object.freeze({ root: 'packages/cli/src/operator', origin: 'pipeline' as const }),
		Object.freeze({ root: 'packages/frameworks/react', origin: 'frozen-adapter' as const }),
		Object.freeze({ root: 'packages/frameworks/angular', origin: 'frozen-adapter' as const }),
		Object.freeze({ root: 'packages/core/src/migrations', origin: 'frozen-adapter' as const }),
		Object.freeze({ root: 'packages/core/src/bundlers', origin: 'frozen-adapter' as const }),
		Object.freeze({ root: 'packages/core/src/analysis', origin: 'frozen-adapter' as const }),
	]);

export type CensusEntry = Readonly<{
	code: string;
	/** The emitted string. `${...}` marks a value interpolated at runtime. */
	message: string;
	messageForm: 'static' | 'composed';
	/** The literal runs of the message, which a tally can group on. */
	staticSegments: readonly string[];
	/** `refusal` when the site declares itself one, `defect`, or `unclassified`. */
	classification: 'refusal' | 'defect' | 'unclassified';
	/** The guard the site sits under, verbatim from source. */
	condition: string;
	conditionForm: 'if-consequent' | 'if-alternate' | 'unconditional';
	origin: RefusalOrigin;
	stage: string;
	stageBasis: string;
	file: string;
	line: number;
	/** The declaration the site sits in. */
	enclosing: string;
}>;

export type RecordedRefusal = Readonly<{
	/** The local helper the subtree records the refusal through. */
	callee: string;
	/** The reason argument, as the source writes it. */
	message: string;
	messageForm: 'static' | 'composed';
	origin: RefusalOrigin;
	file: string;
	line: number;
	enclosing: string;
}>;

export type RefusalCensus = Readonly<{
	schemaVersion: string;
	generatedBy: string;
	/** The freeze the frozen half of this census was read at. */
	adapterFreezeComposite: string;
	roots: readonly string[];
	filesScanned: number;
	summary: Readonly<{
		sites: number;
		byOrigin: Readonly<Record<string, number>>;
		byClassification: Readonly<Record<string, number>>;
		byStage: Readonly<Record<string, number>>;
		distinctCodes: number;
		/** Refusals a frozen subtree records through a local helper. */
		recordedRefusalSites: number;
	}>;
	entries: readonly CensusEntry[];
	recordedRefusals: readonly RecordedRefusal[];
	notEstablished: readonly string[];
}>;

const CENSUS_NOT_ESTABLISHED: readonly string[] = Object.freeze([
	'This census enumerates refusals expressed as a thrown Error or as a refuse() call in the scanned files. A refusal expressed as a returned value, as a rejected promise built elsewhere, or as a thrown non-Error value is not counted here.',
	'Refusals emitted by tools this pipeline shells out to are not this repository’s strings and are not enumerated. The install stage records the two npm policy conditions it checks the lockfile for; it does not enumerate npm’s own refusal vocabulary.',
	'A `stage` is a static reading of which operator stage composes the module, with its basis recorded. It is not a proof that a particular site is reachable at that stage: no per-site reachability was computed.',
	'`messageForm: composed` means the string is assembled at runtime. The recorded message reproduces the source form with each interpolated expression written as ${...}; it is not a string any run necessarily emitted.',
	'A site in a frozen subtree is recorded as `refusal` only when its own message declares it one by beginning with `Refused:`. Every other frozen site is `unclassified`: the frozen subtrees do not separate a refusal from an assertion in their throw vocabulary, and this census does not impose a separation on them.',
	'`recordedRefusals` are call sites in the frozen subtrees named refuse or refused, where a local helper records a reason rather than throwing one. They carry no code, stage or origin of their own, and this census reads only their reason argument and their location. What each helper does with the reason it was handed is not modelled here.',
	'A count of refusal sites is not a count of refusable applications, and it is not a coverage number.',
]);

type Node = Record<string, unknown> & { type: string; start: number; end: number };

function isNode(value: unknown): value is Node {
	return (
		value !== null &&
		typeof value === 'object' &&
		typeof (value as { type?: unknown }).type === 'string'
	);
}

/** Collapse every whitespace run to one space, so a guard reads on one line. */
export function collapseWhitespace(value: string): string {
	const parts: string[] = [];
	let current = '';
	for (const character of value) {
		const white =
			character === ' ' ||
			character === '\t' ||
			character === '\n' ||
			character === '\r' ||
			character === '\f' ||
			character === '\v';
		if (white) {
			if (current !== '') parts.push(current);
			current = '';
			continue;
		}
		current += character;
	}
	if (current !== '') parts.push(current);
	return parts.join(' ');
}

type Segment = Readonly<{ kind: 'text' | 'expression'; value: string }>;

function messageSegments(node: Node | undefined, source: string): Segment[] {
	if (node === undefined) return [];
	if (node.type === 'Literal' && typeof node.value === 'string')
		return [{ kind: 'text', value: node.value }];
	if (node.type === 'TemplateLiteral') {
		const quasis = (node.quasis ?? []) as Node[];
		const expressions = (node.expressions ?? []) as Node[];
		const segments: Segment[] = [];
		for (let index = 0; index < quasis.length; index += 1) {
			const quasi = quasis[index] as Node | undefined;
			const cooked = (quasi?.value as { cooked?: string } | undefined)?.cooked ?? '';
			if (cooked !== '') segments.push({ kind: 'text', value: cooked });
			const expression = expressions[index];
			if (expression !== undefined)
				segments.push({
					kind: 'expression',
					value: collapseWhitespace(source.slice(expression.start, expression.end)),
				});
		}
		return segments;
	}
	if (node.type === 'BinaryExpression' && node.operator === '+')
		return [
			...messageSegments(node.left as Node | undefined, source),
			...messageSegments(node.right as Node | undefined, source),
		];
	return [{ kind: 'expression', value: collapseWhitespace(source.slice(node.start, node.end)) }];
}

function renderSegments(segments: readonly Segment[]): string {
	return segments
		.map((segment) => (segment.kind === 'text' ? segment.value : `\${${segment.value}}`))
		.join('');
}

function lineOf(source: string, offset: number): number {
	let line = 1;
	for (let index = 0; index < offset && index < source.length; index += 1)
		if (source[index] === '\n') line += 1;
	return line;
}

const FUNCTION_TYPES: readonly string[] = Object.freeze([
	'FunctionDeclaration',
	'FunctionExpression',
	'ArrowFunctionExpression',
]);

function enclosingName(ancestors: readonly Node[]): string {
	for (let index = ancestors.length - 1; index >= 0; index -= 1) {
		const node = ancestors[index] as Node;
		if (node.type === 'FunctionDeclaration') {
			const id = node.id as Node | undefined;
			const name = id === undefined ? null : (id.name as string | undefined);
			if (name !== undefined && name !== null) return name;
		}
		if (node.type === 'VariableDeclarator') {
			const id = node.id as Node | undefined;
			const name = id === undefined ? null : (id.name as string | undefined);
			if (name !== undefined && name !== null) return name;
		}
		if (node.type === 'MethodDefinition' || node.type === 'Property') {
			const key = node.key as Node | undefined;
			const name = key === undefined ? null : (key.name as string | undefined);
			if (name !== undefined && name !== null) return name;
		}
	}
	return 'module scope';
}

function guardOf(
	ancestors: readonly Node[],
	site: Node,
	source: string,
): { condition: string; conditionForm: CensusEntry['conditionForm'] } {
	for (let index = ancestors.length - 1; index >= 0; index -= 1) {
		const node = ancestors[index] as Node;
		if (FUNCTION_TYPES.includes(node.type)) break;
		if (node.type !== 'IfStatement') continue;
		const test = node.test as Node;
		const consequent = node.consequent as Node | undefined;
		const inConsequent =
			consequent !== undefined &&
			site.start >= consequent.start &&
			site.end <= consequent.end;
		return {
			condition: collapseWhitespace(source.slice(test.start, test.end)),
			conditionForm: inConsequent ? 'if-consequent' : 'if-alternate',
		};
	}
	return {
		condition: `unconditional within ${enclosingName(ancestors)}`,
		conditionForm: 'unconditional',
	};
}

const SLUG_LIMIT = 64;

/** A stable, readable identifier derived from the site's own first words. */
export function slugOf(value: string): string {
	let slug = '';
	let pendingSeparator = false;
	for (const character of value.toLowerCase()) {
		const code = character.charCodeAt(0);
		const alphanumeric = (code >= 97 && code <= 122) || (code >= 48 && code <= 57);
		if (!alphanumeric) {
			pendingSeparator = slug !== '';
			continue;
		}
		if (pendingSeparator) {
			if (slug.length >= SLUG_LIMIT) break;
			slug += '-';
			pendingSeparator = false;
		}
		if (slug.length >= SLUG_LIMIT) break;
		slug += character;
	}
	return slug === '' ? 'unnamed' : slug;
}

async function readEntries(directory: string) {
	try {
		return await readdir(directory, { withFileTypes: true });
	} catch {
		return [];
	}
}

async function typeScriptFilesBelow(directory: string): Promise<string[]> {
	const files: string[] = [];
	const entries = await readEntries(directory);
	for (const entry of entries.sort((left, right) => (left.name < right.name ? -1 : 1))) {
		if (
			entry.name === 'node_modules' ||
			entry.name === '.git' ||
			entry.name === 'dist' ||
			entry.name === 'test'
		)
			continue;
		const item = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await typeScriptFilesBelow(item)));
			continue;
		}
		if (entry.isFile() && path.extname(entry.name) === '.ts') files.push(item);
	}
	return files;
}

type Site = Readonly<{
	node: Node;
	ancestors: readonly Node[];
	kind: 'refuse-call' | 'throw-error';
	argument: Node | undefined;
	properties: Readonly<Record<string, Node>>;
}>;

function propertiesOf(node: Node | undefined): Readonly<Record<string, Node>> {
	if (node === undefined || node.type !== 'ObjectExpression') return {};
	const record: Record<string, Node> = {};
	for (const property of (node.properties ?? []) as Node[]) {
		if (property.type !== 'Property') continue;
		const key = property.key as Node | undefined;
		const name = key === undefined ? undefined : (key.name as string | undefined);
		const value = property.value as Node | undefined;
		if (name !== undefined && value !== undefined) record[name] = value;
	}
	return record;
}

type RecordedSite = Readonly<{ node: Node; callee: string; argument: Node | undefined }>;

/**
 * Call sites named `refuse` or `refused` inside a frozen subtree.
 *
 * These are refusals the adapters *record* rather than throw — a local helper
 * appends a reason to a per-file refusal list, and the caller decides what to
 * do with it. They do not carry the pipeline's `{ code, message, stage, origin }`
 * shape, so the census does not pretend to have read one. What it does is count
 * and locate them, so the gap is a number instead of an absence.
 */
const RECORDED_REFUSAL_CALLEES: readonly string[] = Object.freeze(['refuse', 'refused']);

function collectSites(
	root: Node,
	structured: boolean,
): { sites: Site[]; recorded: RecordedSite[] } {
	const sites: Site[] = [];
	const recorded: RecordedSite[] = [];
	const walk = (node: Node, ancestors: Node[]): void => {
		if (node.type === 'ThrowStatement') {
			const argument = node.argument as Node | undefined;
			const callee =
				argument === undefined ? undefined : (argument.callee as Node | undefined);
			if (
				argument?.type === 'NewExpression' &&
				callee?.type === 'Identifier' &&
				callee.name === 'Error'
			)
				sites.push({
					node,
					ancestors: [...ancestors],
					kind: 'throw-error',
					argument: ((argument.arguments ?? []) as Node[])[0],
					properties: {},
				});
		}
		if (node.type === 'CallExpression') {
			const callee = node.callee as Node | undefined;
			const name = callee?.type === 'Identifier' ? (callee.name as string) : null;
			if (name !== null && RECORDED_REFUSAL_CALLEES.includes(name)) {
				const args = (node.arguments ?? []) as Node[];
				if (structured && name === 'refuse')
					sites.push({
						node,
						ancestors: [...ancestors],
						kind: 'refuse-call',
						argument: args[0],
						properties: propertiesOf(args[0]),
					});
				else recorded.push({ node, callee: name, argument: args[args.length - 1] });
			}
		}
		ancestors.push(node);
		for (const key of Object.keys(node)) {
			if (key === 'type' || key === 'start' || key === 'end') continue;
			const value = node[key];
			if (Array.isArray(value)) {
				for (const item of value) if (isNode(item)) walk(item, ancestors);
				continue;
			}
			if (isNode(value)) walk(value, ancestors);
		}
		ancestors.pop();
	};
	walk(root, []);
	return { sites, recorded };
}

function staticStringOf(node: Node | undefined, source: string): string | null {
	const segments = messageSegments(node, source);
	if (segments.length === 0) return null;
	return segments.every((segment) => segment.kind === 'text') ? renderSegments(segments) : null;
}

const compareEntries = (left: CensusEntry, right: CensusEntry): number => {
	if (left.file !== right.file) return left.file < right.file ? -1 : 1;
	return left.line - right.line;
};

/** Derive the census from the checkout. Frozen paths are read, never written. */
export async function buildRefusalCensus(rootDir = '.'): Promise<RefusalCensus> {
	const root = path.resolve(rootDir);
	const modules = new Map(CENSUS_MODULES.map((module) => [module.file, module]));
	const entries: CensusEntry[] = [];
	const recordedRefusals: RecordedRefusal[] = [];
	const usedCodes = new Map<string, number>();
	let filesScanned = 0;
	const unlisted: string[] = [];
	for (const scanned of CENSUS_ROOTS) {
		const scanRoot = path.join(root, scanned.root);
		for (const file of await typeScriptFilesBelow(scanRoot)) {
			const relative = path.relative(root, file);
			const source = await readFile(file, 'utf8');
			filesScanned += 1;
			const collected = collectSites(
				analyze(source, { path: relative }).ast as unknown as Node,
				scanned.origin === 'pipeline',
			);
			for (const site of collected.recorded) {
				const segments = messageSegments(site.argument, source);
				if (segments.length === 0) continue;
				recordedRefusals.push(
					Object.freeze({
						callee: site.callee,
						message: renderSegments(segments),
						messageForm: segments.every((segment) => segment.kind === 'text')
							? ('static' as const)
							: ('composed' as const),
						origin: scanned.origin,
						file: relative,
						line: lineOf(source, site.node.start),
						enclosing: 'recorded through a local helper',
					}),
				);
			}
			const sites = collected.sites;
			if (sites.length === 0) continue;
			const module = modules.get(relative);
			if (module === undefined) {
				unlisted.push(relative);
				continue;
			}
			for (const site of sites) {
				const messageNode =
					site.kind === 'refuse-call' ? site.properties.message : site.argument;
				const segments = messageSegments(messageNode, source);
				const message = renderSegments(segments);
				const staticSegments = segments
					.filter((segment) => segment.kind === 'text')
					.map((segment) => segment.value.trim())
					.filter((segment) => segment !== '');
				const declaredCode =
					site.kind === 'refuse-call'
						? staticStringOf(site.properties.code, source)
						: null;
				const declaredStage =
					site.kind === 'refuse-call'
						? staticStringOf(site.properties.stage, source)
						: null;
				const declaredOrigin =
					site.kind === 'refuse-call'
						? staticStringOf(site.properties.origin, source)
						: null;
				const stem = path.basename(relative, '.ts');
				const fallback = `${module.origin === 'pipeline' ? 'pipeline' : 'frozen'}.${stem}.${slugOf(staticSegments[0] ?? message)}`;
				const baseCode = declaredCode ?? fallback;
				const seen = usedCodes.get(baseCode) ?? 0;
				usedCodes.set(baseCode, seen + 1);
				const code = seen === 0 ? baseCode : `${baseCode}-${String(seen + 1)}`;
				const classification: CensusEntry['classification'] =
					site.kind === 'refuse-call'
						? 'refusal'
						: module.origin === 'pipeline'
							? 'defect'
							: (staticSegments[0] ?? '').startsWith('Refused:')
								? 'refusal'
								: 'unclassified';
				const guard = guardOf(site.ancestors, site.node, source);
				entries.push(
					Object.freeze({
						code,
						message,
						messageForm: segments.every((segment) => segment.kind === 'text')
							? ('static' as const)
							: ('composed' as const),
						staticSegments: Object.freeze(staticSegments),
						classification,
						condition: guard.condition,
						conditionForm: guard.conditionForm,
						origin:
							declaredOrigin === 'frozen-adapter' || declaredOrigin === 'pipeline'
								? declaredOrigin
								: module.origin,
						stage: declaredStage ?? module.stage,
						stageBasis: module.stageBasis,
						file: relative,
						line: lineOf(source, site.node.start),
						enclosing: enclosingName(site.ancestors),
					}),
				);
			}
		}
	}
	if (unlisted.length > 0)
		throw new Error(
			`refusal-census: ${String(unlisted.length)} scanned file(s) raise refusals and are not declared in CENSUS_MODULES: ${unlisted.sort().join(', ')}. Declare the module and the basis for its stage reading rather than let the census drop the sites.`,
		);
	entries.sort(compareEntries);
	recordedRefusals.sort((left, right) =>
		left.file === right.file ? left.line - right.line : left.file < right.file ? -1 : 1,
	);
	const byOrigin: Record<string, number> = {};
	const byClassification: Record<string, number> = {};
	const byStage: Record<string, number> = {};
	for (const entry of entries) {
		byOrigin[entry.origin] = (byOrigin[entry.origin] ?? 0) + 1;
		byClassification[entry.classification] = (byClassification[entry.classification] ?? 0) + 1;
		byStage[entry.stage] = (byStage[entry.stage] ?? 0) + 1;
	}
	const sortedRecord = (record: Record<string, number>): Readonly<Record<string, number>> =>
		Object.freeze(
			Object.fromEntries(
				Object.keys(record)
					.sort((left, right) => (left < right ? -1 : 1))
					.map((key) => [key, record[key] as number]),
			),
		);
	return Object.freeze({
		schemaVersion: REFUSAL_CENSUS_SCHEMA,
		generatedBy: 'versionless refusal-census',
		adapterFreezeComposite: ADAPTER_FREEZE_COMPOSITE,
		roots: Object.freeze(CENSUS_ROOTS.map((scanned) => scanned.root)),
		filesScanned,
		summary: Object.freeze({
			sites: entries.length,
			byOrigin: sortedRecord(byOrigin),
			byClassification: sortedRecord(byClassification),
			byStage: sortedRecord(byStage),
			distinctCodes: new Set(entries.map((entry) => entry.code)).size,
			recordedRefusalSites: recordedRefusals.length,
		}),
		entries: Object.freeze(entries),
		recordedRefusals: Object.freeze(recordedRefusals),
		notEstablished: CENSUS_NOT_ESTABLISHED,
	});
}

/** Write the census where the trust surfaces and the fleet report can read it. */
export async function writeRefusalCensus(
	census: RefusalCensus,
	file = REFUSAL_CENSUS_FILE,
): Promise<string> {
	const target = path.resolve(file);
	await mkdir(path.dirname(target), { recursive: true });
	await writeFile(target, `${JSON.stringify(census, null, '\t')}\n`);
	return file;
}
