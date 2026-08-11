import { readFile, readdir } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	JIRA_CLONE_ARCHIVE_SHA256,
	MIGRATION_RECORD_FILE,
	buildMigrationRecord,
	verifyMigrationRecord,
	type MigrationRecord,
} from '../src/fixture/angular-jira-clone-migration-run.ts';
import {
	ERA_LANE_FILE,
	MIGRATED_LANE_FILE,
	buildLaneRecords,
} from '../src/fixture/angular-jira-clone-build-lanes-run.ts';

const evidenceDirectory = path.join(
	import.meta.dirname,
	'../../../evidence/runs/angular-jira-clone',
);

async function readRecord(name: string): Promise<Record<string, unknown>> {
	return JSON.parse(await readFile(path.join(evidenceDirectory, name), 'utf8')) as Record<
		string,
		unknown
	>;
}

describe('Angular jira-clone source migration record', () => {
	it('seals its own digest and rejects tampering', () => {
		const record = buildMigrationRecord(
			{
				cell: 'angular-16-browser-builder',
				files: [
					{
						path: 'angular.json',
						kind: 'workspace',
						changed: true,
						sha256Before: 'a',
						sha256After: 'b',
						source: '{}',
						changes: ['builder swapped'],
					},
				],
				applicationFilesChanged: 0,
				workspaceFilesChanged: 1,
				applicationFilesScanned: 116,
				unhandled: [],
			},
			'unit',
			'consent',
		);
		expect(verifyMigrationRecord(record)).toBe(record);
		expect(() =>
			verifyMigrationRecord({ ...record, unit: 'other' } as unknown as MigrationRecord),
		).toThrow(/digest differs/);
	});

	it('records the archive it migrated from', async () => {
		const record = await readRecord(MIGRATION_RECORD_FILE);
		const source = record['source'] as Record<string, unknown>;
		expect(source['archiveSha256']).toBe(JIRA_CLONE_ARCHIVE_SHA256);
	});

	it('states the count as measured, not as hoped', async () => {
		const record = await readRecord(MIGRATION_RECORD_FILE);
		const migration = record['migration'] as Record<string, unknown>;
		const files = migration['files'] as readonly Record<string, unknown>[];
		expect(migration['applicationFilesChanged']).toBe(
			files.filter((entry) => entry['kind'] === 'application').length,
		);
		expect(migration['workspaceFilesChanged']).toBe(
			files.filter((entry) => entry['kind'] === 'workspace').length,
		);
		for (const entry of files) {
			expect(entry['sha256Before']).toMatch(/^[0-9a-f]{64}$/);
			expect(entry['sha256After']).toMatch(/^[0-9a-f]{64}$/);
			expect(entry['sha256Before']).not.toBe(entry['sha256After']);
		}
	});

	it('says out loud that the cell is the one factoriolab already declared', async () => {
		const record = await readRecord(MIGRATION_RECORD_FILE);
		const cell = record['cell'] as Record<string, unknown>;
		expect((cell['reuse'] as readonly string[]).join(' ')).toContain('factoriolab');
	});
});

describe('Angular jira-clone build lanes', () => {
	const inventory = [{ path: 'main.js', sha256: 'a'.repeat(64), bytes: 10 }];

	it('calls a lane unstable when its two builds differ', () => {
		const records = buildLaneRecords({
			eraFirst: inventory,
			eraSecond: [{ ...inventory[0]!, sha256: 'b'.repeat(64) }],
			eraIngest: inventory,
			migratedInstallStderrTail: 'npm ERR! code ERESOLVE',
			migratedManifestSha256: 'c'.repeat(64),
		});
		expect(records.era['result']).toBe('unstable');
		expect(records.era['byteStable']).toBe(false);
	});

	it('calls a lane byte-stable only when both builds agree', () => {
		const records = buildLaneRecords({
			eraFirst: inventory,
			eraSecond: inventory,
			eraIngest: inventory,
			migratedInstallStderrTail: 'npm ERR! code ERESOLVE',
			migratedManifestSha256: 'c'.repeat(64),
		});
		expect(records.era['result']).toBe('byte-stable');
		expect(records.migrated['result']).toBe('red-at-closure-install');
	});

	it('records the era lane as byte-stable and as reproducing the ingest build', async () => {
		const record = await readRecord(ERA_LANE_FILE);
		expect(record['result']).toBe('byte-stable');
		expect(record['byteStable']).toBe(true);
		expect(record['reproducesIngestBuild']).toBe(true);
		expect((record['inventory'] as readonly unknown[]).length).toBe(24);
		expect(JSON.stringify(record['source'])).toContain('extractCss');
	});

	it('records the migrated lane as red without an inventory it does not have', async () => {
		const record = await readRecord(MIGRATED_LANE_FILE);
		expect(record['result']).toBe('red-at-closure-install');
		expect(record).not.toHaveProperty('inventory');
		expect(record).not.toHaveProperty('byteStable');
		const acquisition = record['acquisition'] as Record<string, unknown>;
		expect(acquisition['urlsAcquired']).toEqual([]);
		expect(acquisition['consentId']).toBe('VL-LEGACY-CORPUS-2026-08-10');
	});

	it('records no build-level parity, because only one lane emitted anything', async () => {
		const names = await readdir(evidenceDirectory);
		expect(names.some((name) => name.includes('parity'))).toBe(false);
	});

	it('never reproduces the application’s Sentry DSN or analytics id', async () => {
		for (const name of await readdir(evidenceDirectory)) {
			const text = await readFile(path.join(evidenceDirectory, name), 'utf8');
			expect(text).not.toMatch(/https:\/\/[0-9a-f]{16,}@[\w.]*sentry\.io/i);
			expect(text).not.toMatch(/\bUA-\d{4,}-\d+\b/);
			expect(text).not.toMatch(/\bG-[A-Z0-9]{8,}\b/);
		}
	});
});
