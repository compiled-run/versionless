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
import {
	ACQUISITION_RECORD_FILE,
	CLOSURE_RECORD_FILE,
} from '../src/fixture/angular-jira-clone-closure-run.ts';

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
				declaredDifferences: [],
				removedFiles: [],
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

	it('keeps the mj1 and mj2 records that describe lanes which no longer hold', async () => {
		const names = await readdir(evidenceDirectory);
		for (const name of [MIGRATED_LANE_FILE, CLOSURE_RECORD_FILE]) expect(names).toContain(name);
	});

	it('records the migrated closure as resolved, and the build as red and itemised', async () => {
		const record = await readRecord(CLOSURE_RECORD_FILE);
		expect(record['result']).toBe('closure-resolved-build-red-itemised');
		const acquisition = record['acquisition'] as Record<string, unknown>;
		expect(acquisition['exitStatus']).toBe(0);
		expect(acquisition['consentId']).toBe('VL-LEGACY-CORPUS-2026-08-10');
		expect(acquisition['hosts']).toEqual(['registry.npmjs.org']);
		expect(acquisition['artifactsAcquired']).toBeGreaterThan(0);
		const attempt = record['buildAttempt'] as Record<string, unknown>;
		expect(attempt['outcome']).toBe('red');
		expect(attempt['artifactsEmitted']).toBe(0);
		expect((attempt['demands'] as readonly unknown[]).length).toBeGreaterThan(0);
		for (const demand of attempt['demands'] as readonly Record<string, string>[])
			for (const field of ['file', 'symbol', 'library', 'observed', 'neededTransform'])
				expect(demand[field]?.length ?? 0).toBeGreaterThan(0);
	});

	it('carries a URL and an integrity digest for every artifact it acquired', async () => {
		const record = await readRecord(ACQUISITION_RECORD_FILE);
		const artifacts = record['artifacts'] as readonly Record<string, string>[];
		expect(artifacts.length).toBe(record['count']);
		expect(artifacts.length).toBeGreaterThan(0);
		for (const artifact of artifacts) {
			expect(artifact['url']).toMatch(/^https:\/\/registry\.npmjs\.org\//);
			expect(artifact['integrity']).toMatch(/^sha(256|512)-/);
		}
	});

	it('supersedes the mj1 records by name rather than replacing them silently', async () => {
		const closure = await readRecord(CLOSURE_RECORD_FILE);
		const migration = await readRecord(MIGRATION_RECORD_FILE);
		expect((closure['supersedes'] as Record<string, string>)['record']).toBe(MIGRATED_LANE_FILE);
		expect((migration['supersedes'] as Record<string, string>)['record']).toBe(
			'mj1-source-migration.json',
		);
		const names = await readdir(evidenceDirectory);
		expect(names).toContain(MIGRATED_LANE_FILE);
		expect(names).toContain('mj1-source-migration.json');
	});

	it('records every dropped package as a declared difference, never as a silent pin', async () => {
		const migration = await readRecord(MIGRATION_RECORD_FILE);
		const declared = (migration['migration'] as Record<string, readonly string[]>)[
			'declaredDifferences'
		] as readonly string[];
		for (const name of ['tslint', 'codelyzer', 'nz-tslint-rules', '@sentry/tracing'])
			expect(declared.some((line) => line.includes(`.${name} was removed`))).toBe(true);
		for (const line of declared) expect(line.length).toBeGreaterThan(80);
	});

	it('never reproduces the application’s Sentry DSN or analytics id', async () => {
		// Recursive on purpose: the witness vertical writes its journey and
		// mutation artifacts into a subdirectory of this same evidence directory,
		// and a redaction scan that only read the top level would stop covering
		// exactly the records that carry the most observed request detail.
		for (const entry of await readdir(evidenceDirectory, {
			recursive: true,
			withFileTypes: true,
		})) {
			if (!entry.isFile()) continue;
			const text = await readFile(path.join(entry.parentPath, entry.name), 'utf8');
			expect(text).not.toMatch(/https:\/\/[0-9a-f]{16,}@[\w.]*sentry\.io/i);
			expect(text).not.toMatch(/\bUA-\d{4,}-\d+\b/);
			expect(text).not.toMatch(/\bG-[A-Z0-9]{8,}\b/);
		}
	});
});
