import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import * as path from 'pathe';
import {
	buildEraLaneRecord,
	buildChangesetRecord,
	differingPaths,
	ERA_LANE_FILE,
	ERA_WORKSPACE_FACTS,
	CHANGESET_FILE,
	EVIDENCE_DIRECTORY,
	INSTABILITY,
} from '../src/fixture/angular-super-productivity-lanes-run.ts';
import { ANGULAR_16_BROWSER_CELL } from '../../frameworks/angular/src/index.ts';

async function readRecord(file: string): Promise<Record<string, unknown>> {
	return JSON.parse(await readFile(path.join(EVIDENCE_DIRECTORY, file), 'utf8')) as Record<
		string,
		unknown
	>;
}

const entry = (name: string, digest: string) =>
	({ path: name, sha256: digest, bytes: 1 }) as const;

describe('super-productivity era baseline lane', () => {
	it('calls an unstable pair unstable and never claims byte stability for it', () => {
		const record = buildEraLaneRecord({
			first: [entry('./main.js', 'a'.repeat(64))],
			second: [entry('./main.js', 'b'.repeat(64))],
			firstSeconds: 90,
			nodeVersion: 'v12.14.1',
			instability: INSTABILITY,
		});
		expect(record['result']).toBe('rebuilt-green-not-byte-stable');
		expect(record['byteStable']).toBe(false);
		expect(record['differingPaths']).toEqual(['./main.js']);
	});

	it('would call a stable pair stable, so the unstable verdict is measured and not hardcoded', () => {
		const same = [entry('./main.js', 'a'.repeat(64))];
		const record = buildEraLaneRecord({
			first: same,
			second: [...same],
			firstSeconds: 90,
			nodeVersion: 'v12.14.1',
			instability: [],
		});
		expect(record['result']).toBe('byte-stable');
		expect(record['byteStable']).toBe(true);
		expect(record['differingPaths']).toEqual([]);
	});

	it('names a cause for every differing path, and marks which one is consequential', () => {
		expect(INSTABILITY.length).toBeGreaterThan(0);
		for (const finding of INSTABILITY) {
			expect(finding.path).not.toBe('');
			expect(finding.cause.length).toBeGreaterThan(80);
			expect(finding.observed.length).toBeGreaterThan(40);
		}
		const consequential = INSTABILITY.filter((finding) => finding.consequential);
		expect(consequential).toHaveLength(1);
		expect(consequential[0]?.cause).toContain('random()');
	});

	it('records the measured lane as three green builds that do not agree', async () => {
		const written = await readRecord(ERA_LANE_FILE);
		expect(written['result']).toBe('rebuilt-green-not-byte-stable');
		expect(written['byteStable']).toBe(false);
		const builds = written['builds'] as readonly Record<string, unknown>[];
		for (const build of builds) expect(build['status']).toBe(0);
		expect((written['differingPaths'] as readonly string[]).length).toBeGreaterThan(0);
		expect(String(written['rebuildComparison'])).toContain('Three consecutive rebuilds');
	});

	it('seals both records with digests recomputable from their own bodies', async () => {
		for (const file of [ERA_LANE_FILE, CHANGESET_FILE]) {
			const { digest, ...body } = await readRecord(file);
			expect(createHash('sha256').update(`${JSON.stringify(body, null, 2)}\n`).digest('hex')).toBe(
				digest,
			);
		}
	});
});

describe('super-productivity composed changeset', () => {
	it('counts changed application files rather than scanned ones', async () => {
		const written = await readRecord(CHANGESET_FILE);
		const scanned = Number(written['applicationFilesScanned']);
		const changed = Number(written['applicationFilesChanged']);
		expect(scanned).toBeGreaterThan(400);
		expect(changed).toBeGreaterThan(0);
		expect(changed).toBeLessThan(scanned);
	});

	it('carries a digest before and after for every file it reports', async () => {
		const written = await readRecord(CHANGESET_FILE);
		const files = written['files'] as readonly Record<string, unknown>[];
		expect(files.length).toBeGreaterThan(0);
		for (const file of files) {
			expect(String(file['sha256Before'])).toHaveLength(64);
			expect(String(file['sha256After'])).toHaveLength(64);
			expect(file['changed']).toBe(file['sha256Before'] !== file['sha256After']);
		}
	});

	it('records the era workspace facts a clean changeset would otherwise hide', async () => {
		const written = await readRecord(CHANGESET_FILE);
		const facts = (written['eraWorkspaceFacts'] as readonly string[]).join(' ');
		expect(facts).toContain('ngsw-config.json');
		expect(facts).toContain('webWorkerTsConfig');
		expect(ERA_WORKSPACE_FACTS.length).toBeGreaterThanOrEqual(6);
	});

	it('claims no build, no install and no parity', async () => {
		const written = await readRecord(CHANGESET_FILE);
		expect(written['parity']).toBeUndefined();
		const not = (written['notEstablished'] as readonly string[]).join(' ');
		expect(not).toContain('no install was performed');
		expect(not).toContain('no build was attempted');
	});

	it('builds the changeset record from a migration rather than from a fixture name', () => {
		const record = buildChangesetRecord({
			cell: ANGULAR_16_BROWSER_CELL.id,
			files: [],
			applicationFilesChanged: 0,
			workspaceFilesChanged: 0,
			applicationFilesScanned: 0,
			unhandled: [],
			declaredDifferences: [],
			removedFiles: [],
		});
		expect(record['applicationFilesChanged']).toBe(0);
		expect(record['files']).toEqual([]);
	});

	it('reports differing paths symmetrically, including a path only one side has', () => {
		expect(
			differingPaths([entry('./a', 'a'.repeat(64))], [entry('./b', 'a'.repeat(64))]),
		).toEqual(['./a', './b']);
	});
});

describe('Angular 16 cell dispositions this fixture measured', () => {
	it('aligns the git-protocol dependency onto a resolvable registry range', () => {
		const disposition = ANGULAR_16_BROWSER_CELL.ecosystemPackages['jira2md'];
		expect(disposition?.kind).toBe('aligned');
		expect(disposition?.kind === 'aligned' && disposition.range).toBe('^3.0.1');
		expect(disposition?.fact).toContain('no peerDependencies');
	});

	it('reads both floating-latest declarations rather than carrying "latest" forward', () => {
		const cssVars = ANGULAR_16_BROWSER_CELL.ecosystemPackages['angular-material-css-vars'];
		expect(cssVars?.kind === 'aligned' && cssVars.range).toBe('^5.0.3');
		expect(cssVars?.fact).toContain('>=22');
		const buttons = ANGULAR_16_BROWSER_CELL.ecosystemPackages['angular2-promise-buttons'];
		expect(buttons?.kind === 'aligned' && buttons.range).toBe('^6.0.0');
	});

	it('states a registry fact for every disposition it declares', () => {
		for (const [name, disposition] of Object.entries(
			ANGULAR_16_BROWSER_CELL.ecosystemPackages,
		)) {
			expect(disposition.fact.length, name).toBeGreaterThan(45);
			if (disposition.kind === 'aligned') expect(disposition.range, name).not.toBe('');
		}
	});

	it('drops a package with no line for this cell instead of pinning it beside a v16 framework', () => {
		expect(ANGULAR_16_BROWSER_CELL.ecosystemPackages['ng-pick-datetime']?.kind).toBe(
			'no-successor',
		);
		expect(ANGULAR_16_BROWSER_CELL.ecosystemPackages['rxjs-tslint']?.kind).toBe('no-successor');
	});
});
