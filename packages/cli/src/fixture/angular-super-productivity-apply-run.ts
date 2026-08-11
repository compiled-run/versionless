/**
 * Apply the composed `@versionless/angular` changeset to a stage copy of the
 * pinned `angular-super-productivity-v2-13-15` tree, so a closure can be
 * installed into it and a production build attempted on the bytes the adapter
 * produced.
 *
 * u18 composed the changeset and recorded it; it built nothing. This driver is
 * the owed half's first step: the same composition, written into a tree.
 *
 * The driver is fixture-scoped — it knows where this fixture's stage tree was
 * materialised, and nothing else. Every decision about *what to change* lives
 * in `@versionless/angular`, which knows nothing about this application.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { canonical, sha256 } from './angular-factoriolab-migration-run.ts';
import { sealRecord, verifySealedRecord, type SealedRecord } from './angular-factoriolab-build-lanes-run.ts';
import { applyMigration, type Application } from './angular-tiny-translator-apply-run.ts';
import type { AngularMigration } from '../../../frameworks/angular/src/index.ts';
import { composeMigration, CONSENT, EVIDENCE_DIRECTORY, SOURCE_TREE } from './angular-super-productivity-lanes-run.ts';

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');

export const UNIT = 'lrapr-t006/u18b-super-productivity-migrated-lane';

export const STAGE_DIRECTORY = path.join(
	repositoryRoot,
	'.versionless/stage/angular-super-productivity-v2-13-15-u18b',
);
/** The pinned revision with the changeset written into it; the build tree. */
export const APPLIED_TREE = path.join(STAGE_DIRECTORY, 'app');

export const MIGRATION_RECORD_FILE = 'u18b-source-migration.json';

export { EVIDENCE_DIRECTORY };

/**
 * The applied-changeset record. Digests before and after are the changeset's;
 * what this record adds is that the bytes were written into a named tree.
 */
export function buildApplicationRecord(
	migration: AngularMigration,
	applied: Application,
): SealedRecord {
	return sealRecord({
		schemaVersion: 'versionless.angular-super-productivity-source-migration.v1',
		unit: UNIT,
		consentId: CONSENT,
		cell: migration.cell,
		appliedTo: {
			tree: '.versionless/stage/angular-super-productivity-v2-13-15-u18b/app',
			from: '.versionless/cache/angular-super-productivity-v2-13-15-source/verify/extracted',
			commit: '2943c5c4f13c3ce4dece0abf4f9c39739dde4192',
			excludedFromStage: ['node_modules', '.git'],
			excludedReason:
				'The stage copy carries the repository tree and nothing installed or version-controlled: node_modules is what the install below creates, and .git is not a build input.',
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

if (process.argv[1]?.endsWith('angular-super-productivity-apply-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
