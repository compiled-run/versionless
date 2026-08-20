import { readFile, readdir } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	BUNDLE_DIRECTORIES,
	BUNDLE_EXTENSION,
	KNOWN_RESIDUE,
	MIGRATION_RECORD_FILE,
	buildAppliedMigrationRecord,
	moduleResolutionOf,
	verifyAppliedMigrationRecord,
	type MigrationRecord,
} from '../src/fixture/angular-jira-clone-apply-run.ts';
import {
	ERA_RECORD_FILE,
	MIGRATED_RECORD_FILE,
	PARITY_RECORD_FILE,
	acquisitionDelta,
	buildRecords,
} from '../src/fixture/angular-jira-clone-parity-run.ts';
import { MIGRATION_RECORD_FILE as MJ2_MIGRATION_RECORD_FILE } from '../src/fixture/angular-jira-clone-migration-run.ts';
import {
	ERA_LANE_FILE,
	MIGRATED_LANE_FILE,
} from '../src/fixture/angular-jira-clone-build-lanes-run.ts';
import { CLOSURE_RECORD_FILE } from '../src/fixture/angular-jira-clone-closure-run.ts';

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

const emptyMigration = {
	cell: 'angular-16-browser-builder',
	files: [],
	applicationFilesChanged: 0,
	workspaceFilesChanged: 0,
	applicationFilesScanned: 0,
	unhandled: [],
	declaredDifferences: [],
	removedFiles: [],
} as const;

const emptyClosure = {
	installedPackages: [],
	packageExports: [],
	absentFromClosure: [],
	bundlesRead: [],
} as const;

const inventory = [{ path: 'main.js', sha256: 'a'.repeat(64), bytes: 10 }];

function records(overrides: Partial<Parameters<typeof buildRecords>[0]> = {}) {
	return buildRecords({
		eraFirst: inventory,
		eraRerun: inventory,
		eraIngest: inventory,
		migratedFirst: inventory,
		migratedSecond: inventory,
		delta: {
			added: [],
			changed: [],
			removed: [],
			hosts: [],
			totalAfter: 1,
			totalBefore: 1,
		},
		lockfileSha256: 'b'.repeat(64),
		manifestSha256: 'c'.repeat(64),
		installExitStatus: 0,
		buildExitStatuses: [0, 0],
		...overrides,
	});
}

describe('Angular jira-clone applied changeset', () => {
	it('seals its own digest and rejects tampering', () => {
		const record = buildAppliedMigrationRecord({
			migration: emptyMigration,
			closure: emptyClosure,
			unit: 'unit',
			consentId: 'consent',
			appliedTo: 'nowhere',
		});
		expect(verifyAppliedMigrationRecord(record)).toBe(record);
		expect(() =>
			verifyAppliedMigrationRecord({
				...record,
				unit: 'other',
			} as unknown as MigrationRecord),
		).toThrow(/digest differs/);
	});

	it('reads path aliases out of a tsconfig that carries comments and trailing spaces', () => {
		const resolution = moduleResolutionOf(`{
			// the workspace's own aliases
			"compilerOptions": {
				"baseUrl": "./",
				/* two of them */
				"paths": {
					"@trungk18/*": ["src/app/*"],
					"@trungk18/interface/*": ["src/app/interface/*"]
				}
			}
		}`);
		expect(resolution.baseUrl).toBe('./');
		expect(resolution.paths['@trungk18/*']).toEqual(['src/app/*']);
	});

	it('does not mistake a url inside a tsconfig string for a comment', () => {
		const resolution = moduleResolutionOf('{"compilerOptions":{"baseUrl":"https://x/y"}}');
		expect(resolution.baseUrl).toBe('https://x/y');
	});

	it('reports no aliases rather than throwing when the tsconfig declares none', () => {
		expect(moduleResolutionOf('{}')).toEqual({ baseUrl: '', paths: {} });
	});

	it('states the bundle-selection rule in the record rather than leaving it in the driver', () => {
		const record = buildAppliedMigrationRecord({
			migration: emptyMigration,
			closure: emptyClosure,
			unit: 'unit',
			consentId: 'consent',
			appliedTo: 'nowhere',
		});
		const reading = record['closureReading'] as Record<string, string>;
		for (const directory of BUNDLE_DIRECTORIES)
			expect(reading['bundleRule']).toContain(directory);
		expect(reading['bundleRule']).toContain(BUNDLE_EXTENSION);
		expect(reading['selectionRule']).toContain('runtime dependencies');
	});

	it('records the count as measured, with a before and after digest on every changed file', async () => {
		const record = await readRecord(MIGRATION_RECORD_FILE);
		const migration = record['migration'] as Record<string, unknown>;
		const files = migration['files'] as readonly Record<string, unknown>[];
		expect(migration['applicationFilesChanged']).toBe(
			files.filter((entry) => entry['kind'] === 'application').length,
		);
		expect(migration['workspaceFilesChanged']).toBe(
			files.filter((entry) => entry['kind'] === 'workspace').length,
		);
		expect(migration['applicationFilesChanged']).toBeGreaterThan(0);
		for (const entry of files) {
			expect(entry['sha256Before']).toMatch(/^[0-9a-f]{64}$/);
			expect(entry['sha256After']).toMatch(/^[0-9a-f]{64}$/);
			expect(entry['sha256Before']).not.toBe(entry['sha256After']);
		}
	});

	it('names every capability’s declared difference, with the aggregate measured in bytes', async () => {
		const record = await readRecord(MIGRATION_RECORD_FILE);
		const declared = (record['migration'] as Record<string, readonly string[]>)[
			'declaredDifferences'
		] as readonly string[];
		expect(
			declared.some((line) => /ships 550342 bytes of stylesheet where it/.test(line)),
		).toBe(true);
		expect(
			declared.some((line) => line.includes('dependencies.@ctrl/tinycolor was added')),
		).toBe(true);
		for (const name of ['tslint', 'codelyzer', 'nz-tslint-rules', '@sentry/tracing'])
			expect(declared.some((line) => line.includes(`.${name} was removed`))).toBe(true);
		for (const line of declared) expect(line.length).toBeGreaterThan(80);
	});

	it('carries the peer holes it did not close as unhandled rather than as silence', async () => {
		const record = await readRecord(MIGRATION_RECORD_FILE);
		const unhandled = record['unhandled'] as readonly string[];
		for (const name of ['cron-parser', 'd3-zoom', 'dagre-compound', 'ng-antd-color-picker'])
			expect(unhandled.some((line) => line.startsWith(`${name} is imported`))).toBe(true);
	});

	it('records the import residue the modal migration leaves rather than hand-patching it', async () => {
		const record = await readRecord(MIGRATION_RECORD_FILE);
		expect(record['knownResidue']).toEqual(KNOWN_RESIDUE);
		expect(KNOWN_RESIDUE.join(' ')).toContain('Input');
	});

	it('supersedes the mj2 changeset by name rather than replacing it silently', async () => {
		const record = await readRecord(MIGRATION_RECORD_FILE);
		expect((record['supersedes'] as Record<string, string>)['record']).toBe(
			MJ2_MIGRATION_RECORD_FILE,
		);
		expect(await readdir(evidenceDirectory)).toContain(MJ2_MIGRATION_RECORD_FILE);
	});
});

describe('Angular jira-clone acquisition delta', () => {
	const before = [
		{
			path: 'node_modules/a',
			url: 'https://registry.npmjs.org/a/-/a-1.0.0.tgz',
			integrity: 'sha512-a',
		},
		{
			path: 'node_modules/b',
			url: 'https://registry.npmjs.org/b/-/b-1.0.0.tgz',
			integrity: 'sha512-b',
		},
	];

	it('reports an added entry, a moved one and a dropped one apart from each other', () => {
		const delta = acquisitionDelta(before, [
			{
				path: 'node_modules/a',
				url: 'https://registry.npmjs.org/a/-/a-2.0.0.tgz',
				integrity: 'sha512-a2',
			},
			{
				path: 'node_modules/c',
				url: 'https://registry.npmjs.org/c/-/c-1.0.0.tgz',
				integrity: 'sha512-c',
			},
		]);
		expect(delta.added.map((entry) => entry.path)).toEqual(['node_modules/c']);
		expect(delta.changed).toEqual([
			{
				path: 'node_modules/a',
				from: 'https://registry.npmjs.org/a/-/a-1.0.0.tgz',
				to: 'https://registry.npmjs.org/a/-/a-2.0.0.tgz',
				url: 'https://registry.npmjs.org/a/-/a-2.0.0.tgz',
			},
		]);
		expect(delta.removed).toEqual(['node_modules/b']);
		expect(delta.hosts).toEqual(['registry.npmjs.org']);
	});

	it('reports nothing at all when the closure did not move', () => {
		const delta = acquisitionDelta(before, before);
		expect(delta.added).toEqual([]);
		expect(delta.changed).toEqual([]);
		expect(delta.removed).toEqual([]);
		expect(delta.totalBefore).toBe(delta.totalAfter);
	});
});

describe('Angular jira-clone mj3c lane records', () => {
	it('calls the migrated lane unstable when its two builds differ', () => {
		const built = records({
			migratedSecond: [{ ...inventory[0]!, sha256: 'd'.repeat(64) }],
		});
		expect(built.migrated['result']).toBe('green-unstable');
		expect(built.migrated['byteStable']).toBe(false);
	});

	it('calls the era lane diverged when the rerun does not reproduce the committed state', () => {
		const built = records({ eraRerun: [{ ...inventory[0]!, sha256: 'e'.repeat(64) }] });
		expect(built.era['result']).toBe('diverged-from-committed-state');
		expect(built.era['reproducesCommittedState']).toBe(false);
	});

	it('records the era lane as reproducing the state mj1 committed', async () => {
		const record = await readRecord(ERA_RECORD_FILE);
		expect(record['result']).toBe('reproduces-committed-state');
		expect(record['reproducesCommittedState']).toBe(true);
		expect(record['reproducesIngestBuild']).toBe(true);
		expect((record['inventory'] as readonly unknown[]).length).toBe(24);
		expect((record['supersedes'] as Record<string, string>)['record']).toBe(ERA_LANE_FILE);
	});

	it('records the migrated lane as green, byte-stable and offline at build time', async () => {
		const record = await readRecord(MIGRATED_RECORD_FILE);
		expect(record['result']).toBe('green-byte-stable');
		expect(record['byteStable']).toBe(true);
		for (const build of record['builds'] as readonly Record<string, number>[])
			expect(build['status']).toBe(0);
		const acquisition = record['acquisition'] as Record<string, unknown>;
		expect(acquisition['consentId']).toBe('VL-LEGACY-CORPUS-2026-08-10');
		expect(acquisition['networkMode']).toBe('consented');
		expect(acquisition['hosts']).toEqual(['registry.npmjs.org']);
		expect(String(acquisition['offlineAfter'])).toContain('offline');
	});

	it('carries a url and an integrity digest for the package the peer hole asked for', async () => {
		const record = await readRecord(MIGRATED_RECORD_FILE);
		const acquisition = record['acquisition'] as Record<string, unknown>;
		const added = acquisition['added'] as readonly Record<string, string>[];
		const tinycolor = added.find((entry) => entry['path'] === 'node_modules/@ctrl/tinycolor');
		expect(tinycolor?.['url']).toBe(
			'https://registry.npmjs.org/@ctrl/tinycolor/-/tinycolor-4.2.0.tgz',
		);
		expect(tinycolor?.['integrity']).toMatch(/^sha(256|512)-/);
		for (const entry of added) {
			expect(entry['url']).toMatch(/^https:\/\/registry\.npmjs\.org\//);
			expect(entry['integrity']).toMatch(/^sha(256|512)-/);
		}
	});

	it('records the resolver rearrangement it did not ask for', async () => {
		const record = await readRecord(MIGRATED_RECORD_FILE);
		const acquisition = record['acquisition'] as Record<string, unknown>;
		const changed = acquisition['changed'] as readonly Record<string, string>[];
		expect(changed.length).toBeGreaterThan(0);
		expect(String(acquisition['deltaMeaning'])).toContain('more than that');
	});

	it('supersedes both records that described a lane which no longer holds', async () => {
		const record = await readRecord(MIGRATED_RECORD_FILE);
		const supersedes = record['supersedes'] as readonly Record<string, string>[];
		expect(supersedes.map((entry) => entry['record'])).toEqual([
			MIGRATED_LANE_FILE,
			CLOSURE_RECORD_FILE,
		]);
		for (const entry of supersedes) expect(entry['why']?.length ?? 0).toBeGreaterThan(80);
	});
});

describe('Angular jira-clone build-level parity', () => {
	it('lines both lanes up and states what it does not establish', async () => {
		const record = await readRecord(PARITY_RECORD_FILE);
		expect(record['result']).toBe('build-level-parity-recorded');
		expect(record['eraFileCount']).toBe(24);
		expect(record['migratedFileCount']).toBe(24);
		const entries = record['entries'] as readonly Record<string, unknown>[];
		expect(entries.length).toBeGreaterThan(0);
		for (const entry of entries) {
			const era = entry['era'] as readonly Record<string, number>[];
			const migrated = entry['migrated'] as readonly Record<string, number>[];
			const delta =
				migrated.reduce((total, file) => total + file['bytes']!, 0) -
				era.reduce((total, file) => total + file['bytes']!, 0);
			expect(entry['byteDelta']).toBe(delta);
		}
		expect((record['nonclaims'] as readonly string[]).join(' ')).toContain('not a measure of');
	});

	it('names the stylesheet substitution, the lint drop and the Sentry surface as differences', async () => {
		const record = await readRecord(PARITY_RECORD_FILE);
		const known = record['knownDifferences'] as readonly string[];
		expect(known.some((line) => line.includes('550,342-byte aggregate'))).toBe(true);
		expect(known.some((line) => line.includes('no lint target'))).toBe(true);
		expect(known.some((line) => line.includes('Sentry v8 SDK'))).toBe(true);
		for (const line of known) expect(line.length).toBeGreaterThan(80);
	});

	it('reports every emission point present in one lane only, by name', async () => {
		const record = await readRecord(PARITY_RECORD_FILE);
		const entries = record['entries'] as readonly Record<string, readonly unknown[]>[];
		const onlyInEra = record['onlyInEra'] as readonly string[];
		const onlyInMigrated = record['onlyInMigrated'] as readonly string[];
		for (const entry of entries) {
			const point = entry['emissionPoint'] as unknown as string;
			if (entry['migrated']!.length === 0) expect(onlyInEra).toContain(point);
			if (entry['era']!.length === 0) expect(onlyInMigrated).toContain(point);
		}
		expect(onlyInEra.length).toBe(onlyInMigrated.length);
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
