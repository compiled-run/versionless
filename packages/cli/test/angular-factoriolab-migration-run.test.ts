import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	FACTORIOLAB_ARCHIVE_SHA256,
	MIGRATION_RECORD_FILE,
	buildMigrationRecord,
	verifyMigrationRecord,
	type MigrationRecord,
} from '../src/fixture/angular-factoriolab-migration-run.ts';

const recordPath = path.join(
	import.meta.dirname,
	'../../../evidence/runs/angular-factoriolab',
	MIGRATION_RECORD_FILE,
);

describe('Angular factoriolab source migration record', () => {
	it('seals its own digest and rejects tampering', () => {
		const record = buildMigrationRecord(
			{
				cell: 'angular-16-browser-builder',
				files: [
					{
						path: 'src/polyfills.ts',
						kind: 'application',
						changed: true,
						sha256Before: 'a'.repeat(64),
						sha256After: 'b'.repeat(64),
						source: "import 'zone.js';\n",
						changes: ['line 1: module-specifier zone.js/dist/zone -> zone.js'],
					},
				],
				applicationFilesChanged: 1,
				workspaceFilesChanged: 0,
				applicationFilesScanned: 1,
				unhandled: [],
				declaredDifferences: [],
				removedFiles: [],
			},
			'lrapr-t005/m1-factoriolab-migration',
			'VL-LEGACY-CORPUS-2026-08-10',
		);
		expect(verifyMigrationRecord(record)).toEqual(record);
		const tampered = {
			...structuredClone(record),
			migration: { ...record.migration, applicationFilesChanged: 7 },
		} as unknown as MigrationRecord;
		expect(() => verifyMigrationRecord(tampered)).toThrow('differs');
	});

	it('records only files whose bytes actually changed', () => {
		const record = buildMigrationRecord(
			{
				cell: 'angular-16-browser-builder',
				files: [
					{
						path: 'src/app/app.component.ts',
						kind: 'application',
						changed: false,
						sha256Before: 'c'.repeat(64),
						sha256After: 'c'.repeat(64),
						source: 'export class AppComponent {}\n',
						changes: [],
					},
				],
				applicationFilesChanged: 0,
				workspaceFilesChanged: 0,
				applicationFilesScanned: 1,
				unhandled: [],
				declaredDifferences: [],
				removedFiles: [],
			},
			'lrapr-t005/m1-factoriolab-migration',
			'VL-LEGACY-CORPUS-2026-08-10',
		);
		expect(record.migration.files).toEqual([]);
		expect(record.migration.applicationFilesScanned).toBe(1);
	});

	it('the published record verifies, pins the acquired archive and separates itself from the build', async () => {
		const published = JSON.parse(await readFile(recordPath, 'utf8')) as MigrationRecord;
		expect(verifyMigrationRecord(published)).toEqual(published);
		expect(published.source.archiveSha256).toBe(FACTORIOLAB_ARCHIVE_SHA256);
		expect(published.migration.applicationFilesChanged).toBeGreaterThan(0);
		expect(published.notEstablished.join(' ')).toContain('recorded separately');
		expect(published.notEstablished.join(' ')).toContain('No browser behaviour');
		expect(published.result).toBe('source-migration-recorded');
		expect(published.nonclaims.join(' ')).toContain('no certification');
	});

	it('records the count the build lanes grew, and what it superseded to get there', async () => {
		const published = JSON.parse(await readFile(recordPath, 'utf8')) as MigrationRecord;
		expect(published.migration.applicationFilesChanged).toBe(3);
		expect(published.migration.applicationFilesScanned).toBe(157);
		expect(published.migration.workspaceFilesChanged).toBe(3);
		expect(published.supersedes.join(' ')).toContain('applicationFilesChanged: 2');
		expect(published.supersedes.join(' ')).toContain('Effect decorator');
		const effects = published.migration.files.find((file) =>
			file.path.endsWith('datasets.effects.ts'),
		);
		expect(effects?.kind).toBe('application');
		expect(effects?.changes.join(' ')).toContain('ngrx-effect-decorator');
	});
});
