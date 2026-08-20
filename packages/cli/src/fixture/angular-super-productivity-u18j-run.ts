/**
 * The u18j round of the `angular-super-productivity-v2-13-15` cell: the round
 * that closes the family a green build could not report.
 *
 * u18i left the lane green at 58 emitted artifacts and named one thing the
 * green did not cover: both of the application's web workers are constructed
 * from a string specifier, which webpack 4's worker plugin treated as a worker
 * request and webpack 5's module-graph rule does not. No chunk is emitted, no
 * error is raised, and the workers would 404 at runtime.
 *
 * This driver makes the three readings the `web-worker-url-specifier`
 * capability requires, all of them from the tree:
 *
 *  - the build target's `webWorkerTsConfig`, and the tsconfig file it names;
 *  - that tsconfig's own `include` patterns, which are what decides whether a
 *    file in this tree is a worker source at all;
 *  - for each string specifier, the file it resolves to from the module that
 *    writes it, checked against those patterns and against the tree.
 *
 * The capability decides the rest. Nothing here knows an application name, a
 * worker name or a directory layout.
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as path from 'pathe';
import {
	rewriteWorkerUrlSpecifiers,
	type WorkerTreeReading,
	type WorkerUrlChange,
} from '../../../frameworks/angular/src/index.ts';
import { APPLIED_TREE, STAGE_DIRECTORY } from './angular-super-productivity-apply-run.ts';

/** The source root the candidate modules are walked from. */
export const SOURCE_ROOT = 'src';

/** The extensions a TypeScript module in this tree is written with. */
const MODULE_EXTENSIONS: readonly string[] = Object.freeze(['.ts']);

/**
 * Does `candidate` — a tree-relative path — match a tsconfig `include` pattern.
 *
 * The three constructs tsconfig's globs carry are `**` (any number of path
 * segments), `*` (any run of characters inside one segment) and `?` (one
 * character inside one segment). The match is written segment by segment so
 * that no pattern has to be turned into a regular expression, which is also
 * what keeps `**` from matching across a segment boundary by accident.
 */
export function matchesIncludePattern(pattern: string, candidate: string): boolean {
	const patternSegments = pattern.split('/').filter((segment) => segment !== '');
	const candidateSegments = candidate.split('/').filter((segment) => segment !== '');
	const matchSegment = (glob: string, text: string): boolean => {
		const walk = (globIndex: number, textIndex: number): boolean => {
			if (globIndex === glob.length) return textIndex === text.length;
			const character = glob[globIndex];
			if (character === '*') {
				for (let skip = textIndex; skip <= text.length; skip += 1)
					if (walk(globIndex + 1, skip)) return true;
				return false;
			}
			if (textIndex === text.length) return false;
			if (character === '?' || character === text[textIndex])
				return walk(globIndex + 1, textIndex + 1);
			return false;
		};
		return walk(0, 0);
	};
	const walk = (patternIndex: number, candidateIndex: number): boolean => {
		if (patternIndex === patternSegments.length)
			return candidateIndex === candidateSegments.length;
		const segment = patternSegments[patternIndex];
		if (segment === undefined) return false;
		if (segment === '**') {
			for (let skip = candidateIndex; skip <= candidateSegments.length; skip += 1)
				if (walk(patternIndex + 1, skip)) return true;
			return false;
		}
		const text = candidateSegments[candidateIndex];
		if (text === undefined) return false;
		return matchSegment(segment, text) && walk(patternIndex + 1, candidateIndex + 1);
	};
	return walk(0, 0);
}

export type WorkspaceWorkerReading = Readonly<{
	/** The `webWorkerTsConfig` values the workspace's build targets declare. */
	declared: readonly string[];
	/** Those of them the tree carries. */
	present: readonly string[];
	/** The `include` patterns those tsconfigs carry, expressed from the tree root. */
	includes: readonly string[];
}>;

/** What the workspace file and the tsconfigs it names say about worker sources. */
export async function readWorkspaceWorkerSupport(tree: string): Promise<WorkspaceWorkerReading> {
	const workspace: unknown = JSON.parse(await readFile(path.join(tree, 'angular.json'), 'utf8'));
	const declared = new Set<string>();
	const projects = (workspace as { projects?: Record<string, unknown> }).projects ?? {};
	for (const project of Object.values(projects)) {
		const targets = (project as { architect?: Record<string, unknown> }).architect ?? {};
		for (const target of Object.values(targets)) {
			const value = (target as { options?: { webWorkerTsConfig?: unknown } }).options
				?.webWorkerTsConfig;
			if (typeof value === 'string') declared.add(value);
		}
	}
	const present: string[] = [];
	const includes = new Set<string>();
	for (const config of [...declared].sort()) {
		const absolute = path.join(tree, config);
		if (!existsSync(absolute)) continue;
		present.push(config);
		const parsed: unknown = JSON.parse(await readFile(absolute, 'utf8'));
		const include = (parsed as { include?: unknown }).include;
		if (!Array.isArray(include)) continue;
		for (const pattern of include)
			if (typeof pattern === 'string')
				includes.add(path.normalize(path.join(path.dirname(config), pattern)));
	}
	return Object.freeze({
		declared: Object.freeze([...declared].sort()),
		present: Object.freeze(present),
		includes: Object.freeze([...includes].sort()),
	});
}

/** Every module under `root` in the tree, tree-relative and sorted. */
export async function modulesUnder(tree: string, root: string): Promise<readonly string[]> {
	const found: string[] = [];
	const walk = async (directory: string): Promise<void> => {
		const absolute = path.join(tree, directory);
		if (!existsSync(absolute)) return;
		for (const entry of await readdir(absolute, { withFileTypes: true })) {
			const child = path.join(directory, entry.name);
			if (entry.isDirectory()) {
				await walk(child);
				continue;
			}
			if (MODULE_EXTENSIONS.some((extension) => entry.name.endsWith(extension)))
				found.push(child);
		}
	};
	await walk(root);
	return Object.freeze(found.sort());
}

/**
 * The worker source a specifier written in `module` names, or null.
 *
 * The candidates are the ones a bundler would try for an extensionless relative
 * request, and the answer counts only when the tree carries the file *and* the
 * workspace's own worker tsconfig includes it. A file the tree carries that no
 * `include` pattern reaches is not a worker source in this workspace, whatever
 * it is named.
 */
export function workerSourceIn(
	tree: string,
	module: string,
	specifier: string,
	includes: readonly string[],
): string | null {
	if (!specifier.startsWith('.')) return null;
	const base = path.normalize(path.join(path.dirname(module), specifier));
	for (const candidate of [base, `${base}.ts`, path.join(base, 'index.ts')]) {
		if (!existsSync(path.join(tree, candidate))) continue;
		if (!candidate.endsWith('.ts')) continue;
		if (!includes.some((pattern) => matchesIncludePattern(pattern, candidate))) continue;
		return candidate;
	}
	return null;
}

export type RoundOutcome = Readonly<{
	capability: string;
	filesChanged: readonly string[];
	changes: readonly string[];
	unhandled: readonly string[];
	reading: readonly string[];
}>;

/** The worker-URL round, read off the workspace's own worker declaration. */
export async function workerUrlRound(tree: string = APPLIED_TREE): Promise<RoundOutcome> {
	const workspace = await readWorkspaceWorkerSupport(tree);
	const modules = await modulesUnder(tree, SOURCE_ROOT);
	const changed: string[] = [];
	const changes: string[] = [];
	const unhandled: string[] = [];
	let considered = 0;
	for (const module of modules) {
		const absolute = path.join(tree, module);
		const source = await readFile(absolute, 'utf8');
		// A module that never writes the identifier cannot construct a worker, and
		// parsing it would say the same thing more slowly.
		if (!source.includes('Worker')) continue;
		considered += 1;
		const reading: WorkerTreeReading = Object.freeze({
			declaresWorkerSupport: workspace.present.length > 0 && workspace.includes.length > 0,
			workerSourceFor: (specifier: string): string | null =>
				workerSourceIn(tree, module, specifier, workspace.includes),
		});
		const migration = rewriteWorkerUrlSpecifiers(module, source, reading);
		unhandled.push(...migration.unhandled);
		if (!migration.changed) continue;
		await writeFile(absolute, migration.source);
		changed.push(module);
		for (const change of migration.changes as readonly WorkerUrlChange[])
			changes.push(
				`${module} line ${String(change.line)}: new Worker('${change.specifier}', …) → ` +
					`new Worker(new URL('${change.specifier}', import.meta.url), …) ` +
					`(the specifier names ${change.resolved}, which the workspace's worker tsconfig includes)`,
			);
	}
	return Object.freeze({
		capability: 'web-worker-url-specifier',
		filesChanged: Object.freeze(changed),
		changes: Object.freeze(changes),
		unhandled: Object.freeze(unhandled),
		reading: Object.freeze([
			`${String(workspace.declared.length)} webWorkerTsConfig declaration(s) in angular.json: ` +
				workspace.declared.join(', '),
			`${String(workspace.present.length)} of them present in the tree: ${workspace.present.join(', ')}`,
			`${String(workspace.includes.length)} include pattern(s) from those tsconfigs: ` +
				workspace.includes.join(', '),
			`${String(modules.length)} module(s) under ${SOURCE_ROOT}/, ${String(considered)} of which ` +
				'write the identifier Worker and were handed to the capability',
		]),
	});
}

export async function main(): Promise<void> {
	const outcomes: readonly RoundOutcome[] = Object.freeze([await workerUrlRound()]);
	await writeFile(
		path.join(STAGE_DIRECTORY, 'u18j-round.json'),
		`${JSON.stringify({ capabilities: outcomes }, null, '\t')}\n`,
	);
	for (const outcome of outcomes) {
		process.stdout.write(
			`${outcome.capability}: ${String(outcome.filesChanged.length)} files changed, ` +
				`${String(outcome.changes.length)} changes, ${String(outcome.unhandled.length)} refused\n`,
		);
		for (const line of outcome.reading) process.stdout.write(`  reading: ${line}\n`);
		for (const line of outcome.changes) process.stdout.write(`  change: ${line}\n`);
		for (const line of outcome.unhandled) process.stdout.write(`  refused: ${line}\n`);
	}
}

if (process.argv[1]?.endsWith('angular-super-productivity-u18j-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
