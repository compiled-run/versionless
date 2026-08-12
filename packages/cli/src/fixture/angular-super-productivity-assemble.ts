/**
 * `assembleMigratedTree` — the evidence-free entrypoint that materialises the
 * green migrated tree of the `angular-super-productivity-v2-13-15` cell from
 * source and committed transforms alone, writing ZERO evidence records.
 *
 * The green tree was first reproduced only by the u18b→u18j sequence of drivers,
 * each of which wrote an evidence record as a side effect of transforming the
 * tree. That coupling is what this entrypoint removes. Every accommodation those
 * drivers apply now lives in an exported, tree-parameterised function — the
 * composed migration (which itself carries the template-binding-reorder and the
 * entry-components removal), the u18c closure-read round, the u18d style/rename
 * rounds, the u18e base-class and member-rename rounds, the u18f chip-list split
 * and removed-symbol rounds, the u18g interop and void-executor rounds, the u18h
 * `Subject<void>` round, its nineteen manual steps and the electron redirect, the
 * u18i sass/json/url rounds, and the u18j worker-URL round. This module composes
 * them, in the order the sequence ran them, against one tree, and returns a
 * report. It reads the compiler diagnostics the log-driven rounds were scoped by
 * from `fixtures/angular-super-productivity-v2-13-15/diagnostics/`, where they
 * are committed, so the assembly is deterministic from source plus committed
 * inputs and depends on no intermediate build.
 *
 * Nothing here writes to `evidence/` or to any round record. The only side
 * effect is the migrated tree itself, which is the product. Every decision about
 * *what to change* still lives in `@versionless/angular`; this module knows only
 * the order the accommodations compose in.
 */

import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import type { AngularMigration } from '../../../frameworks/angular/src/index.ts';
import { composeMigration, SOURCE_TREE } from './angular-super-productivity-lanes-run.ts';
import { applyMigration, type Application } from './angular-tiny-translator-apply-run.ts';
import { APPLIED_TREE } from './angular-super-productivity-apply-run.ts';
import { applyRound } from './angular-super-productivity-u18c-run.ts';
import { suggestedRenameRound, tildeRound } from './angular-super-productivity-u18d-run.ts';
import { baseClassRound, memberRenameRound } from './angular-super-productivity-u18e-run.ts';
import { splitElementRound, symbolSuccessorRound } from './angular-super-productivity-u18f-run.ts';
import { interopRound, voidExecutorRound } from './angular-super-productivity-u18g-run.ts';
import {
	applyStep,
	electronRedirect,
	MANUAL_STEPS,
	voidSubjectRound,
	type ManualStepOutcome,
} from './angular-super-productivity-u18h-run.ts';
import {
	jsonNamedImportRound,
	sassMixinRound,
	urlRebaseRound,
} from './angular-super-productivity-u18i-run.ts';
import { workerUrlRound } from './angular-super-productivity-u18j-run.ts';

/** Where the committed compiler diagnostics the log-driven rounds read from live. */
export const DIAGNOSTICS_DIRECTORY = path.resolve(
	import.meta.dirname,
	'../../../../fixtures/angular-super-productivity-v2-13-15/diagnostics',
);

/**
 * The committed log each log-driven round is scoped by, named by the round it
 * belongs to. The sequence is progressive: `build-2` is the red state u18c left
 * for u18d to read, `build-3` the state u18d left for u18e, and so on, so the
 * logs are not interchangeable and each round is fed its own.
 */
export const ROUND_DIAGNOSTIC_LOGS: Readonly<Record<string, string>> = Object.freeze({
	u18d: 'build-2.log',
	u18e: 'build-3.log',
	u18f: 'build-4.log',
	u18g: 'build-5.log',
	u18h: 'build-6.log',
});

/**
 * One round's outcome, in the shape every round shares: what it changed, the
 * per-change lines it recorded, and what it refused rather than guessed.
 */
export type StageOutcome = Readonly<{
	capability: string;
	filesChanged: readonly string[];
	changes: readonly string[];
	unhandled: readonly string[];
}>;

/** One stage of the assembly — a driver's worth of rounds, in order. */
export type AssemblyStage = Readonly<{
	round: string;
	outcomes: readonly StageOutcome[];
}>;

/** Everything the assembly did, returned in memory with no record written. */
export type AssembledTree = Readonly<{
	/** The tree the migrated bytes were written into. */
	tree: string;
	/** The composed migration (carrying the reorder and entry-components removal). */
	migration: AngularMigration;
	/** What applying the composed changeset wrote and removed. */
	applied: Application;
	/** The accommodation stages, u18c through u18j, in the order they ran. */
	stages: readonly AssemblyStage[];
	/** The nineteen-plus manual steps of u18h, each applied or accounted for. */
	manualSteps: readonly ManualStepOutcome[];
	/** The electron package's payload copy and every module redirected off it. */
	electron: Readonly<{ payload: string; redirected: readonly string[] }>;
}>;

export type AssembleOptions = Readonly<{
	/** The pinned source tree to migrate. Defaults to this cell's source cache. */
	sourceTree?: string;
	/** The tree to write the assembled bytes into. Defaults to the u18b stage app. */
	tree?: string;
	/** Where the committed round diagnostics live. Defaults to the fixture directory. */
	diagnosticsDirectory?: string;
}>;

/** Keep only the four fields every round reports, so both outcome shapes unify. */
function outcome(value: {
	capability: string;
	filesChanged: readonly string[];
	changes: readonly string[];
	unhandled: readonly string[];
}): StageOutcome {
	return Object.freeze({
		capability: value.capability,
		filesChanged: value.filesChanged,
		changes: value.changes,
		unhandled: value.unhandled,
	});
}

/**
 * Assemble the green migrated tree, evidence-free.
 *
 * The order is the sequence's own: compose and apply first (which is where the
 * template-binding-reorder and the entry-components removal run), then u18c's
 * closure-read round once, then each later driver's own new rounds. The repeated
 * `applyRound` the original drivers each ran at their start is a no-op once the
 * imports it rewrites are already rewritten, so running it a single time here
 * produces the same tree the sequence did.
 */
export async function assembleMigratedTree(options: AssembleOptions = {}): Promise<AssembledTree> {
	const sourceTree = options.sourceTree ?? SOURCE_TREE;
	const tree = options.tree ?? APPLIED_TREE;
	const diagnostics = options.diagnosticsDirectory ?? DIAGNOSTICS_DIRECTORY;
	const logOf = (round: string): Promise<string> =>
		readFile(path.join(diagnostics, ROUND_DIAGNOSTIC_LOGS[round] as string), 'utf8');

	// Stage b: compose and apply the migration itself.
	const migration = await composeMigration(sourceTree);
	const applied = await applyMigration(migration, tree);

	const stages: AssemblyStage[] = [];

	// u18c: successor-fork rename, barrel split and webpack-tilde specifier drop.
	stages.push({
		round: 'u18c',
		outcomes: (await applyRound(tree)).map(outcome),
	});

	// u18d: the exports-map stylesheet round and the compiler-suggested renames.
	const build2 = await logOf('u18d');
	stages.push({
		round: 'u18d',
		outcomes: [outcome(await tildeRound(tree)), outcome(await suggestedRenameRound(build2, tree))],
	});

	// u18e: the generic base-class parameterisation and declared-member renames.
	const build3 = await logOf('u18e');
	stages.push({
		round: 'u18e',
		outcomes: [
			outcome(await baseClassRound(build3, tree)),
			outcome(await memberRenameRound(build3, tree)),
		],
	});

	// u18f: the chip-list split and the removed-entry-point-symbol successors.
	const build4 = await logOf('u18f');
	stages.push({
		round: 'u18f',
		outcomes: [
			outcome(await splitElementRound(build4, tree)),
			outcome(await symbolSuccessorRound(build4, tree)),
		],
	});

	// u18g: the synthetic-default-import interop and the void promise executors.
	const build5 = await logOf('u18g');
	stages.push({
		round: 'u18g',
		outcomes: [outcome(await interopRound(tree)), outcome(await voidExecutorRound(build5, tree))],
	});

	// u18h: the void-subject round, the manual steps and the electron redirect —
	// in the order the u18h driver applied them.
	const build6 = await logOf('u18h');
	const voidSubject = await voidSubjectRound(build6, tree);
	const manualSteps: ManualStepOutcome[] = [];
	for (const step of MANUAL_STEPS) manualSteps.push(await applyStep(step, tree));
	const electron = await electronRedirect(tree);
	stages.push({ round: 'u18h', outcomes: [outcome(voidSubject)] });

	// u18i: the sass-mixin, json-named-import and url-rebase rounds.
	stages.push({
		round: 'u18i',
		outcomes: [
			outcome(await sassMixinRound(tree)),
			outcome(await jsonNamedImportRound(tree)),
			outcome(await urlRebaseRound(tree)),
		],
	});

	// u18j: the web-worker URL specifier round.
	stages.push({ round: 'u18j', outcomes: [outcome(await workerUrlRound(tree))] });

	return Object.freeze({
		tree,
		migration,
		applied,
		stages: Object.freeze(stages),
		manualSteps: Object.freeze(manualSteps),
		electron,
	});
}

export async function main(): Promise<void> {
	const assembled = await assembleMigratedTree();
	const changed = new Set<string>();
	for (const stage of assembled.stages)
		for (const item of stage.outcomes) for (const file of item.filesChanged) changed.add(file);
	for (const step of assembled.manualSteps) if (step.applied) changed.add(step.file);
	for (const file of assembled.electron.redirected) changed.add(file);
	changed.add(assembled.electron.payload);
	process.stdout.write(
		`assembled ${assembled.tree}: ${String(assembled.applied.written.length)} composed files, ` +
			`${String(assembled.stages.length)} accommodation stages, ` +
			`${String(assembled.manualSteps.filter((step) => step.applied).length)} manual steps, ` +
			`${String(assembled.electron.redirected.length)} electron redirects; ` +
			`${String(changed.size)} distinct application files changed by accommodations\n`,
	);
}

if (process.argv[1]?.endsWith('angular-super-productivity-assemble.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
