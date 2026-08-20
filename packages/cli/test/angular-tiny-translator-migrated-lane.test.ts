import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import * as path from 'pathe';
import {
	BUILD_DEMANDS,
	buildMigratedLaneRecord,
	MIGRATED_LANE_FILE,
} from '../src/fixture/angular-tiny-translator-migrated-lane-run.ts';
import {
	buildApplicationRecord,
	EVIDENCE_DIRECTORY,
	MIGRATION_RECORD_FILE,
	WITHHELD_FROM_STAGE,
} from '../src/fixture/angular-tiny-translator-apply-run.ts';
import { ANGULAR_16_BROWSER_CELL } from '../../frameworks/angular/src/index.ts';

const laneInput = {
	nodeVersion: 'v16.20.2',
	npmVersion: '8.19.4 (bundled with the runtime)',
	firstInstallPackages: 770,
	builderInstallPackages: 501,
	lockfilePackages: 1405,
	manifestSha256: 'a'.repeat(64),
	lockfileSha256: 'b'.repeat(64),
	buildExitStatus: 1,
	typescriptDiagnostics: 72,
	moduleResolutionErrors: 29,
	artifactsEmitted: 0,
} as const;

async function readRecord(file: string): Promise<Record<string, unknown>> {
	return JSON.parse(await readFile(path.join(EVIDENCE_DIRECTORY, file), 'utf8')) as Record<
		string,
		unknown
	>;
}

describe('tiny-translator migrated lane', () => {
	it('records a red build as red, with no parity claimed', () => {
		const record = buildMigratedLaneRecord(laneInput);
		expect(record['result']).toBe('closure-resolved-build-red-itemised');
		const build = record['buildAttempt'] as Record<string, unknown>;
		expect(build['outcome']).toBe('red');
		expect(build['exitStatus']).toBe(1);
		expect(build['artifactsEmitted']).toBe(0);
		expect(record['parity']).toBe(null);
	});

	it('itemises every demand by file, symbol, library, diagnostic and transform', () => {
		expect(BUILD_DEMANDS.length).toBeGreaterThan(0);
		for (const demand of BUILD_DEMANDS) {
			expect(demand.file).not.toBe('');
			expect(demand.symbol).not.toBe('');
			expect(demand.library).not.toBe('');
			expect(demand.observed).not.toBe('');
			expect(demand.neededTransform.length).toBeGreaterThan(80);
		}
	});

	it('never claims a green build, byte stability or an emitted artifact', () => {
		const record = buildMigratedLaneRecord(laneInput);
		const text = JSON.stringify(record);
		expect(text).not.toContain('byte-stable');
		const build = record['buildAttempt'] as Record<string, unknown>;
		expect(build['outcome']).not.toBe('succeeded');
		/** The install did succeed, and saying so is the only "succeeded" allowed. */
		expect((record['acquisition'] as Record<string, unknown>)['outcome']).toBe('succeeded');
		expect(text.match(/succeeded/g)).toHaveLength(1);
	});

	it('seals with a digest recomputable from its own body', async () => {
		const written = await readRecord(MIGRATED_LANE_FILE);
		const { digest, ...body } = written;
		const { createHash } = await import('node:crypto');
		expect(
			createHash('sha256')
				.update(`${JSON.stringify(body, null, 2)}\n`)
				.digest('hex'),
		).toBe(digest);
	});

	it('reports the same counts the retained build log carries', async () => {
		const written = await readRecord(MIGRATED_LANE_FILE);
		const build = written['buildAttempt'] as Record<string, unknown>;
		expect(build['exitStatus']).toBe(1);
		expect(build['runs']).toBe(1);
		expect(Number(build['typescriptDiagnostics'])).toBeGreaterThan(0);
		expect(Number(build['moduleResolutionErrors'])).toBeGreaterThan(0);
	});

	it('withholds the committed key material from the stage tree and says so', async () => {
		expect(WITHHELD_FROM_STAGE).toContain('key.pem');
		const written = await readRecord(MIGRATION_RECORD_FILE);
		const appliedTo = written['appliedTo'] as Record<string, unknown>;
		expect(appliedTo['withheld']).toEqual(['key.pem', 'cert.pem']);
		expect(JSON.stringify(written)).not.toContain('PRIVATE KEY');
	});

	it('counts changed application files rather than scanned ones', async () => {
		const written = await readRecord(MIGRATION_RECORD_FILE);
		expect(written['applicationFilesScanned']).toBe(58);
		expect(Number(written['applicationFilesChanged'])).toBeLessThan(58);
		expect(Number(written['applicationFilesChanged'])).toBeGreaterThan(
			Number(written['workspaceFilesChanged']) - 3,
		);
	});

	it('reports the RxJS patch imports it refused instead of half-removing them', async () => {
		const written = await readRecord(MIGRATION_RECORD_FILE);
		const unhandled = (written['unhandled'] as readonly string[]).join(' ');
		expect(unhandled).toContain('rxjs/add/operator/map');
		expect(unhandled).toContain('pipe');
	});

	it('carries registry readings for both dispositions the cell learned', () => {
		const record = buildMigratedLaneRecord(laneInput);
		const readings = (record['acquisition'] as Record<string, unknown>)[
			'registryReadings'
		] as readonly string[];
		expect(readings.join(' ')).toContain('@angular/http');
		expect(readings.join(' ')).toContain('@angular/flex-layout');
		expect(ANGULAR_16_BROWSER_CELL.ecosystemPackages['@angular/http']?.kind).toBe(
			'no-successor',
		);
		expect(ANGULAR_16_BROWSER_CELL.ecosystemPackages['@angular/flex-layout']).toEqual({
			kind: 'aligned',
			range: '^15.0.0-beta.42',
			fact: expect.stringContaining('15.0.0-beta.42'),
		});
	});

	it('builds the applied-changeset record from a migration rather than from a fixture name', () => {
		const record = buildApplicationRecord(
			{
				cell: ANGULAR_16_BROWSER_CELL.id,
				files: [],
				applicationFilesChanged: 0,
				workspaceFilesChanged: 0,
				applicationFilesScanned: 0,
				unhandled: [],
				declaredDifferences: [],
				removedFiles: [],
			},
			{ written: [], removed: [] },
		);
		expect(record['applicationFilesChanged']).toBe(0);
		expect(record['filesWritten']).toEqual([]);
	});
});
