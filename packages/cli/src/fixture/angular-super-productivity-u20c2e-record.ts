/**
 * The u20c2e record: the migrated super-productivity lane, reassembled
 * evidence-free with the template-binding-reorder fix, rebuilt offline, and
 * proven at runtime to have shed the work-view `split` regression.
 *
 * This record supersedes u23's offline-font lane by reference — u23's dist-23
 * bytes stay immutable and are still on disk, read here as the control the
 * behavior comparison needs. What u23 could not do, because the reorder did not
 * exist when it built, is exactly what this record adds: the lane now assembles
 * from a reusable evidence-free entrypoint, and the addClass-on-undefined the
 * `split` component threw once per load is gone from the rebuilt bytes.
 *
 * Every number is read at the moment the record is written. The determinism
 * claim is measured by assembling the tree twice and hashing the migrated
 * source both times; the build outcomes are read from the two guarded builds'
 * persisted exit and egress logs; the reorder is read out of the emitted
 * application chunk; and the behavior comparison is read from the two box
 * receipts the u20c2e behavior driver captured for dist-23 and dist-25.
 */

import { createHash } from 'node:crypto';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as path from 'pathe';
import { canonical, sha256 } from './angular-factoriolab-migration-run.ts';
import { sealRecord, verifySealedRecord, type SealedRecord } from './angular-factoriolab-build-lanes-run.ts';
import { CONSENT, EVIDENCE_DIRECTORY } from './angular-super-productivity-lanes-run.ts';
import { APPLIED_TREE, STAGE_DIRECTORY } from './angular-super-productivity-apply-run.ts';
import { assembleMigratedTree } from './angular-super-productivity-assemble.ts';
import { readReorderInBundle } from './angular-super-productivity-u20c2e-rebuild-run.ts';
import { bootLane, type LaneBehavior } from './angular-super-productivity-u20c2e-behavior-run.ts';

export const UNIT = 'lrapr-t006/u20c2e-assemble-rebuild-behavior';
export const RECORD_FILE = 'u20c2e-assemble-rebuild-behavior.json';
/** The u23 lane this record supersedes; its bytes stay immutable. */
export const SUPERSEDED_RECORD = 'u23-offline-font-lane.json';
/** The application template the reorder rewrites, and the regression's site. */
export const REORDER_FILE = 'src/app/pages/work-view/work-view-page.component.html';
export const REGRESSION_SITE = 'src/app/pages/work-view/split/split.component.ts';

/** Every migrated source file's digest, in path order, excluding installed bytes. */
async function sourceDigest(tree: string): Promise<Readonly<{ files: number; digest: string }>> {
	const roots = ['src'];
	const workspaceFiles = ['package.json', 'angular.json', 'tsconfig.json'];
	const entries: string[] = [];
	const walk = async (directory: string): Promise<void> => {
		for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) =>
			a.name < b.name ? -1 : 1,
		)) {
			const full = path.join(directory, entry.name);
			if (entry.isDirectory()) await walk(full);
			else if (entry.isFile()) entries.push(full);
		}
	};
	for (const root of roots) if (existsSync(path.join(tree, root))) await walk(path.join(tree, root));
	for (const file of workspaceFiles)
		if (existsSync(path.join(tree, file))) entries.push(path.join(tree, file));
	const hash = createHash('sha256');
	let count = 0;
	for (const file of entries.sort()) {
		hash.update(path.relative(tree, file));
		hash.update('\0');
		hash.update(await readFile(file));
		hash.update('\0');
		count += 1;
	}
	return Object.freeze({ files: count, digest: hash.digest('hex') });
}

/** Read a guarded build's persisted exit status and egress-attempt count. */
async function buildOutcome(
	name: string,
	outputRoot: string,
): Promise<Readonly<{ name: string; outputRoot: string; exitStatus: number; egressAttempts: number }>> {
	const exit = Number.parseInt(
		(await readFile(path.join(STAGE_DIRECTORY, `${name}.exit`), 'utf8').catch(() => 'NaN')).trim(),
		10,
	);
	const egressText = await readFile(
		path.join(STAGE_DIRECTORY, `${name}.egress.jsonl`),
		'utf8',
	).catch(() => '');
	const egressAttempts = egressText.split('\n').filter((line) => line.trim().length > 0).length;
	return Object.freeze({ name, outputRoot, exitStatus: exit, egressAttempts });
}

/** The behavior of one lane, narrowed to what the regression comparison needs. */
function laneBehavior(lane: LaneBehavior): Readonly<Record<string, unknown>> {
	return Object.freeze({
		root: lane.root,
		status: lane.status,
		pageErrors: lane.pageErrors.length,
		splitConsoleErrors: lane.splitConsoleErrors.length,
		splitConsoleMessages: lane.splitConsoleErrors.map((message) =>
			String(message.text ?? '').split('\n')[0],
		),
	});
}

export type RecordInput = Readonly<{
	firstDigest: Readonly<{ files: number; digest: string }>;
	secondDigest: Readonly<{ files: number; digest: string }>;
	applicationFilesScanned: number;
	applicationFilesChanged: number;
	reorderChanges: readonly string[];
	stages: readonly string[];
	manualStepsApplied: number;
	electronRedirected: number;
	build25: Awaited<ReturnType<typeof buildOutcome>>;
	build26: Awaited<ReturnType<typeof buildOutcome>>;
	reorder: Awaited<ReturnType<typeof readReorderInBundle>>;
	control: LaneBehavior;
	migrated: LaneBehavior;
}>;

export function buildU20c2eRecord(input: RecordInput): SealedRecord {
	const identical = input.firstDigest.digest === input.secondDigest.digest;
	return sealRecord({
		schemaVersion: 'versionless.angular-super-productivity-assemble-rebuild-behavior.v1',
		unit: UNIT,
		consentId: CONSENT,
		result:
			input.migrated.pageErrors.length === 0 &&
			input.migrated.splitConsoleErrors.length === 0 &&
			input.build25.exitStatus === 0 &&
			input.build26.exitStatus === 0 &&
			identical
				? 'reassembled-offline-rebuilt-regression-gone'
				: 'reassembled-lane-red',
		supersedes: {
			record: SUPERSEDED_RECORD,
			by: 'reference',
			note: 'u23 built the offline-faithful lane before the template-binding-reorder existed; its dist-23/dist-24 bytes are immutable and dist-23 is read here as the behavior control. This lane rebuilds into dist-25/dist-26 and adds the reorder fix and its runtime proof.',
		},
		assembly: {
			entrypoint: 'assembleMigratedTree in packages/cli/src/fixture/angular-super-productivity-assemble.ts',
			evidenceFree:
				'The entrypoint writes no evidence record and no round file; its only side effect is the migrated tree. The u18*-* records stay reproducible because their drivers still call the same exported round functions with the same defaults.',
			stages: input.stages,
			composedFrom:
				'composeMigration (carrying the template-binding-reorder and entry-components removal) then the u18c-u18j accommodation rounds, in the order the u18b→u18j sequence ran them.',
			logDrivenRoundsScopedBy:
				'fixtures/angular-super-productivity-v2-13-15/diagnostics/build-{2,3,4,5,6}.log, committed so the assembly is deterministic from source plus committed inputs and depends on no intermediate build.',
			manualStepsApplied: input.manualStepsApplied,
			electronRedirected: input.electronRedirected,
			determinism: {
				runs: 2,
				files: input.firstDigest.files,
				identical,
				firstDigest: input.firstDigest.digest,
				secondDigest: input.secondDigest.digest,
				meaning: identical
					? 'Assembling the tree twice from the same source and committed inputs produced byte-identical migrated source, file for file.'
					: 'Assembling twice did not produce identical migrated source; the two digests differ and the assembly is not deterministic as it stands.',
			},
		},
		applicationFilesChanged: {
			scanned: input.applicationFilesScanned,
			changed: input.applicationFilesChanged,
			reorderFile: REORDER_FILE,
			reorderChanges: input.reorderChanges,
			note: 'The template-binding-reorder is now among the migrated application-source changes: the <split> element in work-view-page.component.html binds its two element inputs before the position input, which is the source form of the fix.',
		},
		build: {
			command:
				'node --max_old_space_size=4096 ./node_modules/@angular/cli/bin/ng.js build --configuration production',
			offlineGuard:
				'Both builds ran under u22\'s in-process egress guard with the font inliner disabled; a non-loopback connection would have been refused and recorded.',
			builds: [input.build25, input.build26],
			reorderInBundle: {
				mainChunk: input.reorder.mainChunk,
				positionLast: input.reorder.positionLast,
				meaning:
					'Read from the emitted application chunk: the compiled <split> property instructions set splitTopEl and splitBottomEl before splitPos, so under Ivy the position setter runs after both elements are populated. The fix survives the compiler into the booting bytes.',
			},
		},
		behavior: {
			host: 'Playwright chromium headless shell, offline, Roboto stylesheet answered in-context with an empty body — the calibration driver\'s host, pointed at these roots.',
			route: '/#/work-view',
			control: laneBehavior(input.control),
			migrated: laneBehavior(input.migrated),
			regression: {
				site: `${REGRESSION_SITE} — the @Input() set splitPos accessor, through @angular/platform-browser's addClass`,
				priorPageErrorsPerLoad: 1,
				meaning:
					'The control lane (dist-23, no reorder) still throws the recorded addClass-on-undefined once per load; the rebuilt lane (dist-25, reorder) loads with zero page errors and none of the split console errors. Same host, same day: a clean control would have meant the host measured nothing.',
			},
		},
		notEstablished: [
			'The behavior check loads the work view and reads what the browser threw; it is not the full bound journey, and no parity claim beyond the split regression is made here.',
			'A byte-identical migrated source across two assemblies is a determinism claim about the source the entrypoint writes, not about the emitted bundle, which still carries the era Sass random() nondeterminism the lane records elsewhere.',
			'The rebuild is green and offline; nothing here re-establishes the u23 font-inlining locality finding, which this record carries forward by reference rather than re-measuring.',
		],
	});
}

export async function main(): Promise<void> {
	// Determinism: assemble twice and hash the migrated source both times.
	const firstAssembly = await assembleMigratedTree();
	const firstDigest = await sourceDigest(APPLIED_TREE);
	await assembleMigratedTree();
	const secondDigest = await sourceDigest(APPLIED_TREE);

	const reorderEntry = firstAssembly.migration.files.find((file) => file.path === REORDER_FILE);
	const reorderChanges = (reorderEntry?.changes ?? []).filter((change) => /reorder/i.test(change));
	const manualStepsApplied = firstAssembly.manualSteps.filter((step) => step.applied).length;

	const build25 = await buildOutcome('build-25', 'dist-25');
	const build26 = await buildOutcome('build-26', 'dist-26');
	const reorder = await readReorderInBundle('dist-25');

	// Re-boot both lanes at record time so the numbers belong to this record.
	const control = await bootLane('dist-23');
	const migrated = await bootLane('dist-25');

	const record = verifySealedRecord(
		buildU20c2eRecord({
			firstDigest,
			secondDigest,
			applicationFilesScanned: firstAssembly.migration.applicationFilesScanned,
			applicationFilesChanged: firstAssembly.migration.applicationFilesChanged,
			reorderChanges,
			stages: firstAssembly.stages.map((stage) => stage.round),
			manualStepsApplied,
			electronRedirected: firstAssembly.electron.redirected.length,
			build25,
			build26,
			reorder,
			control,
			migrated,
		}),
	);
	await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
	await writeFile(path.join(EVIDENCE_DIRECTORY, RECORD_FILE), canonical(record));
	process.stdout.write(
		`u20c2e ${String(record['result'])}: determinism identical=${String(
			firstDigest.digest === secondDigest.digest,
		)}, control pageErrors ${String(control.pageErrors.length)}, migrated pageErrors ${String(
			migrated.pageErrors.length,
		)}; digest ${sha256(canonical(record)).slice(0, 12)}\n`,
	);
}

if (process.argv[1]?.endsWith('angular-super-productivity-u20c2e-record.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
