/**
 * The `migrate` flow: write a composed changeset into a separate output lane.
 *
 * Two properties are structural rather than advisory. The flow never writes
 * into the application it read — an output lane inside the application root, or
 * an application root inside the output lane, is refused before anything is
 * written — and it never writes into a lane that already carries files, because
 * a half-overwritten lane is indistinguishable from a migrated one.
 *
 * The bytes written are the bytes the frozen adapter composed. Nothing in this
 * module edits a file's content.
 */

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { directoryExists } from './analyze.ts';
import type { OperatorPlan } from './plan.ts';
import { refuse } from './refusals.ts';

const sha256 = (value: Buffer | string): string => createHash('sha256').update(value).digest('hex');

export type AppliedFile = Readonly<{
	path: string;
	kind: 'application' | 'workspace';
	sha256After: string;
	changes: readonly string[];
}>;

export type AppliedChangeset = Readonly<{
	mode: 'changeset-lane' | 'materialized';
	written: readonly AppliedFile[];
	removed: readonly string[];
	/** Files copied into the lane before the changeset was applied. */
	copied: number;
	notEstablished: readonly string[];
}>;

const APPLY_NOT_ESTABLISHED: readonly string[] = Object.freeze([
	'Writing a changeset into a lane is not a build. Nothing here establishes that the lane installs, compiles, or emits anything.',
	'Every byte written differs from the application only where a frozen adapter transform decided it should; each is itemised by file and by change.',
	'In changeset-lane mode the lane carries only the files the changeset rewrites. `removed` is then what the changeset says the tree should no longer carry, not a deletion this run performed.',
]);

/** Refuse an output lane that would write into, or over, the application. */
export function assertSeparateLane(appRoot: string, out: string): void {
	const application = path.resolve(appRoot);
	const lane = path.resolve(out);
	if (application === lane)
		refuse({
			code: 'apply.lane-is-the-application-root',
			message: 'migrate: --out must not be the application root.',
			stage: 'apply',
			origin: 'pipeline',
		});
	const laneInside = path.relative(application, lane);
	if (laneInside !== '' && !laneInside.startsWith('..') && !path.isAbsolute(laneInside))
		refuse({
			code: 'apply.lane-inside-the-application',
			message: `migrate: --out is inside the application root (${laneInside}). The flow never writes into the tree it read.`,
			stage: 'apply',
			origin: 'pipeline',
		});
	const applicationInside = path.relative(lane, application);
	if (
		applicationInside !== '' &&
		!applicationInside.startsWith('..') &&
		!path.isAbsolute(applicationInside)
	)
		refuse({
			code: 'apply.application-inside-the-lane',
			message:
				'migrate: the application root is inside --out. The flow never writes into the tree it read.',
			stage: 'apply',
			origin: 'pipeline',
		});
}

/** Refuse an output lane that already carries files. */
export async function assertEmptyLane(out: string): Promise<void> {
	if (!(await directoryExists(out))) return;
	const entries = await readdir(out);
	if (entries.length > 0)
		refuse({
			code: 'apply.lane-already-carries-files',
			message: `migrate: --out already carries ${String(entries.length)} entr${entries.length === 1 ? 'y' : 'ies'}. Point it at a new directory rather than have this flow overwrite one.`,
			stage: 'apply',
			origin: 'pipeline',
		});
}

async function copyTree(from: string, to: string): Promise<number> {
	let copied = 0;
	for (const entry of (await readdir(from, { withFileTypes: true })).sort((left, right) =>
		left.name < right.name ? -1 : 1,
	)) {
		if (entry.name === 'node_modules' || entry.name === '.git') continue;
		const source = path.join(from, entry.name);
		const target = path.join(to, entry.name);
		if (entry.isDirectory()) {
			await mkdir(target, { recursive: true });
			copied += await copyTree(source, target);
			continue;
		}
		if (!entry.isFile()) continue;
		await mkdir(path.dirname(target), { recursive: true });
		await writeFile(target, await readFile(source));
		copied += 1;
	}
	return copied;
}

export type ApplyOptions = Readonly<{
	appRoot: string;
	out: string;
	/**
	 * Copy the application into the lane before applying, so the lane is a whole
	 * tree rather than the changeset alone. Off by default: the changeset lane is
	 * the cheap artifact an operator reviews, and copying a corpus tree is a
	 * separate, much larger decision.
	 */
	materialize?: boolean;
}>;

/** Write the plan's changed files into the lane, and record what was written. */
export async function applyPlan(
	plan: OperatorPlan,
	options: ApplyOptions,
): Promise<AppliedChangeset> {
	assertSeparateLane(options.appRoot, options.out);
	await assertEmptyLane(options.out);
	await mkdir(options.out, { recursive: true });
	const copied = options.materialize === true ? await copyTree(options.appRoot, options.out) : 0;
	const written: AppliedFile[] = [];
	for (const entry of plan.files) {
		if (!entry.changed) continue;
		const target = path.join(options.out, entry.path);
		await mkdir(path.dirname(target), { recursive: true });
		await writeFile(target, entry.source);
		/**
		 * Deliberately not a refusal. A composed file whose bytes do not hash to
		 * the digest the plan recorded means the plan and the write disagree,
		 * which is a defect in this flow rather than a named reason an
		 * application was declined. It exits 1, not 2.
		 */
		if (sha256(entry.source) !== entry.sha256After)
			throw new Error(`migrate: composed digest mismatch for ${entry.path}`);
		written.push({
			path: entry.path,
			kind: entry.kind,
			sha256After: entry.sha256After,
			changes: entry.changes,
		});
	}
	for (const removed of plan.removedFiles)
		if (options.materialize === true)
			await rm(path.join(options.out, removed), { force: true });
	return Object.freeze({
		mode: options.materialize === true ? 'materialized' : 'changeset-lane',
		written: Object.freeze(written),
		removed: plan.removedFiles,
		copied,
		notEstablished: APPLY_NOT_ESTABLISHED,
	});
}
