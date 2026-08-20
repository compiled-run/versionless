/**
 * The u20c2e rebuild lane: assemble the migrated tree evidence-free, disable the
 * Angular 16 font inliner, and rebuild the lane twice under the offline egress
 * guard — the same guard and font capability u23 ran, over a tree now carrying
 * the template-binding-reorder fix.
 *
 * This driver measures rather than asserts. It builds into new output roots
 * (dist-25, dist-26) so u23's dist-23/dist-24 bytes stay immutable, and it reads
 * the reordered `<split>` binding order back out of the emitted application
 * chunk — the fix has to survive the compiler and land in the bytes that boot,
 * not merely in the source.
 *
 * The assembly is `assembleMigratedTree`, which writes no evidence; the guarded
 * build and the font capability are u23's and u22's, run against this lane's
 * tree. No sealed record is written here — this is the build lane the u20c2e
 * record reads from.
 */

import { readdir, readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { APPLIED_TREE, STAGE_DIRECTORY } from './angular-super-productivity-apply-run.ts';
import { applyFontInliningDisable } from './angular-tiny-translator-u22-font-run.ts';
import { guardedBuild, type FontRound } from './angular-super-productivity-u23-font-run.ts';
import { assembleMigratedTree } from './angular-super-productivity-assemble.ts';

/** The output roots this lane emits; u23's dist-23/dist-24 are left untouched. */
export const CANONICAL_ROOT = 'dist-25';
export const REPEATED_ROOT = 'dist-26';

/**
 * Where in the emitted main chunk each `<split>` input's compiled property
 * instruction appears.
 *
 * The reorder is a template-order fact, and under Ivy the template order is the
 * order the compiler emits the chained `ɵɵproperty` calls in — `("splitPos",…)`
 * as a property *call*, not the `splitPos:"splitPos"` inputs metadata, which is
 * declared in a fixed order the reorder never touches. Reading the call form is
 * what makes this a measurement of the fix rather than of the class shape.
 */
export type ReorderReading = Readonly<{
	mainChunk: string | null;
	splitTopEl: number;
	splitBottomEl: number;
	splitPos: number;
	/** True when the position input's property call follows both element ones. */
	positionLast: boolean;
}>;

/** Read the reordered `<split>` property-instruction order out of a dist root. */
export async function readReorderInBundle(outputRoot: string): Promise<ReorderReading> {
	const dir = path.join(STAGE_DIRECTORY, outputRoot);
	const files = await readdir(dir).catch(() => [] as string[]);
	const mainChunk = files.find((file) => /^main\..*\.js$/u.test(file)) ?? null;
	if (mainChunk === null)
		return Object.freeze({
			mainChunk: null,
			splitTopEl: -1,
			splitBottomEl: -1,
			splitPos: -1,
			positionLast: false,
		});
	const js = await readFile(path.join(dir, mainChunk), 'utf8');
	const splitTopEl = js.indexOf('("splitTopEl"');
	const splitBottomEl = js.indexOf('("splitBottomEl"');
	const splitPos = js.indexOf('("splitPos"');
	return Object.freeze({
		mainChunk,
		splitTopEl,
		splitBottomEl,
		splitPos,
		positionLast:
			splitTopEl >= 0 &&
			splitBottomEl >= 0 &&
			splitPos >= 0 &&
			splitPos > splitTopEl &&
			splitPos > splitBottomEl,
	});
}

export async function runRebuild(): Promise<
	Readonly<{
		round: FontRound['application'];
		builds: FontRound['builds'];
		reorder: ReorderReading;
	}>
> {
	await assembleMigratedTree();
	const application = await applyFontInliningDisable(APPLIED_TREE);
	const first = await guardedBuild('build-25', CANONICAL_ROOT);
	const second = await guardedBuild('build-26', REPEATED_ROOT);
	const reorder = await readReorderInBundle(CANONICAL_ROOT);
	return Object.freeze({ round: application, builds: Object.freeze([first, second]), reorder });
}

export async function main(): Promise<void> {
	const result = await runRebuild();
	for (const site of result.round.sites) process.stdout.write(`font-disable: ${site.at}\n`);
	for (const build of result.builds)
		process.stdout.write(
			`${build.name} exit ${String(build.exitStatus)}, ${String(build.egressAttempts.length)} egress attempt(s), failure ${String(build.failure)}\n`,
		);
	process.stdout.write(
		`reorder-in-bundle: main=${String(result.reorder.mainChunk)} positionLast=${String(result.reorder.positionLast)} ` +
			`(splitTopEl=${String(result.reorder.splitTopEl)}, splitBottomEl=${String(result.reorder.splitBottomEl)}, splitPos=${String(result.reorder.splitPos)})\n`,
	);
}

if (process.argv[1]?.endsWith('angular-super-productivity-u20c2e-rebuild-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
