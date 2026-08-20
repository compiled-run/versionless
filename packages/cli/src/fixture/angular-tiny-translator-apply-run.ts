/**
 * Apply the composed `@versionless/angular` changeset to a stage copy of the
 * pinned `angular-tiny-translator-v0-12-0` tree, so a closure can be installed
 * into it and a production build attempted on the bytes the adapter produced.
 *
 * u17 composed the changeset and recorded it; it built nothing. This driver is
 * the owed half: the same composition, written into a tree.
 *
 * The driver is fixture-scoped — it knows where this fixture's stage tree was
 * materialised, and nothing else. Every decision about *what to change* lives
 * in `@versionless/angular`, which knows nothing about this application.
 */

import { rm, writeFile, mkdir } from 'node:fs/promises';
import * as path from 'pathe';
import type { AngularMigration } from '../../../frameworks/angular/src/index.ts';
import { canonical, sha256 } from './angular-factoriolab-migration-run.ts';
import {
	sealRecord,
	verifySealedRecord,
	type SealedRecord,
} from './angular-factoriolab-build-lanes-run.ts';
import { CONSENT, composeMigration, SOURCE_TREE } from './angular-tiny-translator-lanes-run.ts';

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');

export const UNIT = 'lrapr-t006/u17b-tiny-translator-migrated-lane';

export const STAGE_DIRECTORY = path.join(
	repositoryRoot,
	'.versionless/stage/angular-tiny-translator-v0-12-0-u17b',
);
/** The pinned revision with the changeset written into it; the build tree. */
export const APPLIED_TREE = path.join(STAGE_DIRECTORY, 'app');

export const EVIDENCE_DIRECTORY = path.join(
	repositoryRoot,
	'evidence/runs/angular-tiny-translator-v0-12-0',
);
export const MIGRATION_RECORD_FILE = 'u17b-source-migration.json';

/**
 * Two files at the root of the pinned tree are never staged: a committed TLS
 * private key and its certificate. They are referenced by nothing in the build,
 * their material is public upstream and must be treated as compromised, and no
 * Versionless artifact copies them.
 */
export const WITHHELD_FROM_STAGE: readonly string[] = Object.freeze(['key.pem', 'cert.pem']);

export type AppliedFile = Readonly<{
	path: string;
	kind: 'application' | 'workspace';
	sha256After: string;
	changes: readonly string[];
}>;

export type Application = Readonly<{
	written: readonly AppliedFile[];
	removed: readonly string[];
}>;

/**
 * Write every file the migration changed into `tree`, and delete every file it
 * decided the tree should no longer carry.
 *
 * A file the migration scanned and left byte-identical is not rewritten: the
 * tree already holds those bytes, and rewriting them would make the applied set
 * indistinguishable from the scanned set.
 */
export async function applyMigration(
	migration: AngularMigration,
	tree: string,
): Promise<Application> {
	const written: AppliedFile[] = [];
	for (const entry of migration.files) {
		if (!entry.changed) continue;
		const target = path.join(tree, entry.path);
		await mkdir(path.dirname(target), { recursive: true });
		await writeFile(target, entry.source);
		written.push({
			path: entry.path,
			kind: entry.kind,
			sha256After: entry.sha256After,
			changes: entry.changes,
		});
	}
	for (const removed of migration.removedFiles)
		await rm(path.join(tree, removed), { force: true });
	return Object.freeze({
		written: Object.freeze(written),
		removed: Object.freeze([...migration.removedFiles]),
	});
}

/**
 * The applied-changeset record. Digests before and after are the changeset's;
 * what this record adds is that the bytes were written into a named tree.
 */
export function buildApplicationRecord(
	migration: AngularMigration,
	applied: Application,
): SealedRecord {
	return sealRecord({
		schemaVersion: 'versionless.angular-tiny-translator-source-migration.v1',
		unit: UNIT,
		consentId: CONSENT,
		cell: migration.cell,
		appliedTo: {
			tree: '.versionless/stage/angular-tiny-translator-v0-12-0-u17b/app',
			from: '.versionless/cache/angular-tiny-translator-v0-12-0-source/verify/extracted',
			commit: '08dcacf6a41d5a6f6dfbc71d858adcdc4c85691a',
			withheld: WITHHELD_FROM_STAGE,
			withheldReason:
				'A committed TLS private key and its certificate, referenced by nothing in the build. The material is public upstream and must be treated as compromised; it was not copied into the stage tree and its contents appear in no artifact of this run.',
		},
		applicationFilesScanned: migration.applicationFilesScanned,
		applicationFilesChanged: migration.applicationFilesChanged,
		workspaceFilesChanged: migration.workspaceFilesChanged,
		filesWritten: applied.written,
		filesRemoved: applied.removed,
		files: migration.files.map((entry) => ({
			path: entry.path,
			kind: entry.kind,
			changed: entry.changed,
			sha256Before: entry.sha256Before,
			sha256After: entry.sha256After,
			changes: entry.changes,
		})),
		declaredDifferences: migration.declaredDifferences,
		unhandled: migration.unhandled,
		notEstablished: [
			'Writing a changeset into a tree is not a build. Nothing here establishes that the applied tree installs, compiles or emits anything; the lane record beside this one states what happened when that was attempted.',
			'`applicationFilesChanged` counts application source a transform rewrote. A file the adapter scanned and left alone is counted as scanned and not as changed.',
		],
	});
}

export async function main(): Promise<void> {
	const migration = await composeMigration(SOURCE_TREE);
	const applied = await applyMigration(migration, APPLIED_TREE);
	const record = verifySealedRecord(buildApplicationRecord(migration, applied));
	await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
	await writeFile(path.join(EVIDENCE_DIRECTORY, MIGRATION_RECORD_FILE), canonical(record));
	process.stdout.write(
		`applied ${String(applied.written.length)} files (${String(
			migration.applicationFilesChanged,
		)}/${String(migration.applicationFilesScanned)} application, ${String(
			migration.workspaceFilesChanged,
		)} workspace), removed ${String(applied.removed.length)}, ` +
			`${String(migration.unhandled.length)} unhandled; record digest ${sha256(
				canonical(record),
			).slice(0, 12)}\n`,
	);
}

if (process.argv[1]?.endsWith('angular-tiny-translator-apply-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
