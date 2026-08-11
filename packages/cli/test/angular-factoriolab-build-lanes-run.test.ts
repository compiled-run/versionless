import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	compareInventories,
	emissionPointOf,
	isByteStable,
	sealRecord,
	verifySealedRecord,
	type DistEntry,
	type SealedRecord,
} from '../src/fixture/angular-factoriolab-build-lanes-run.ts';

const evidence = path.join(import.meta.dirname, '../../../evidence/runs/angular-factoriolab');

const read = async (name: string): Promise<SealedRecord> =>
	JSON.parse(await readFile(path.join(evidence, name), 'utf8')) as SealedRecord;

const entry = (file: string, sha: string, bytes: number): DistEntry => ({
	path: file,
	sha256: sha,
	bytes,
});

describe('Angular factoriolab build-lane parity', () => {
	it('strips the builder content hash and the differential-loading suffix', () => {
		expect(emissionPointOf('main-es2015.eea9ba8efe962b30a458.js')).toBe('main.js');
		expect(emissionPointOf('main.67d430ecd5f9b9bf.js')).toBe('main.js');
		expect(emissionPointOf('data/0.16/data.json')).toBe('data/0.16/data.json');
		expect(emissionPointOf('index.html')).toBe('index.html');
	});

	it('recognises a byte-identical payload the two builders named differently', () => {
		const parity = compareInventories(
			[entry('styles.aaaaaaaaaaaaaaaa.css', 'a'.repeat(64), 10)],
			[entry('styles.bbbbbbbbbbbbbbbb.css', 'a'.repeat(64), 10)],
		);
		expect(parity.identicalPayloads).toEqual(['styles.css']);
		expect(parity.entries[0]?.byteDelta).toBe(0);
		expect(parity.onlyInEra).toEqual([]);
		expect(parity.onlyInMigrated).toEqual([]);
	});

	it('folds a lane’s two differential-loading copies onto one emission point', () => {
		const parity = compareInventories(
			[
				entry('main-es2015.aaaaaaaaaaaaaaaa.js', 'a'.repeat(64), 100),
				entry('main-es5.aaaaaaaaaaaaaaaa.js', 'b'.repeat(64), 150),
			],
			[entry('main.cccccccccccccccc.js', 'c'.repeat(64), 90)],
		);
		expect(parity.entries).toHaveLength(1);
		expect(parity.entries[0]?.byteDelta).toBe(-160);
		expect(parity.entries[0]?.bytesIdentical).toBe(false);
	});

	it('names an emission point present in only one lane instead of hiding it in a total', () => {
		const parity = compareInventories(
			[entry('gone.aaaaaaaaaaaaaaaa.js', 'a'.repeat(64), 1)],
			[entry('new.bbbbbbbbbbbbbbbb.js', 'b'.repeat(64), 1)],
		);
		expect(parity.onlyInEra).toEqual(['gone.js']);
		expect(parity.onlyInMigrated).toEqual(['new.js']);
	});

	it('treats one build as no evidence of determinism and two equal ones as evidence', () => {
		const first = [entry('a.js', 'a'.repeat(64), 1)];
		expect(isByteStable(first, [entry('a.js', 'a'.repeat(64), 1)])).toBe(true);
		expect(isByteStable(first, [entry('a.js', 'b'.repeat(64), 1)])).toBe(false);
	});

	it('seals a record and rejects a tampered one', () => {
		const record = sealRecord({ result: 'byte-stable', files: 42 });
		expect(verifySealedRecord(record)).toEqual(record);
		expect(() => verifySealedRecord({ ...record, files: 41 })).toThrow('differs');
	});
});

describe('the published build-lane records', () => {
	it('the era baseline record seals, is byte-stable and reproduces the ingest build', async () => {
		const record = await read('m2-era-baseline.json');
		expect(verifySealedRecord(record)).toEqual(record);
		expect(record['byteStable']).toBe(true);
		expect(record['reproducesIngestBuild']).toBe(true);
		expect((record['inventory'] as readonly DistEntry[]).length).toBe(42);
		expect(JSON.stringify(record['notEstablished'])).toContain('No browser');
	});

	it('the migrated build record seals, is byte-stable and records both failed attempts', async () => {
		const record = await read('m2-migrated-build.json');
		expect(verifySealedRecord(record)).toEqual(record);
		expect(record['byteStable']).toBe(true);
		expect((record['inventory'] as readonly DistEntry[]).length).toBe(39);
		expect(JSON.stringify(record['firstAttempt'])).toContain('jasmine-core');
		expect(JSON.stringify(record['secondAttempt'])).toContain('@ngrx/effects');
		const acquisition = record['acquisition'] as Record<string, unknown>;
		expect(acquisition['hosts']).toEqual(['registry.npmjs.org']);
		expect(acquisition['packagesWithIntegrityDigest']).toBe(acquisition['packagesLocked']);
		expect(acquisition['packagesWithResolvedUrl']).toBe(acquisition['packagesLocked']);
	});

	it('the parity record seals, orphans nothing and claims no browser behaviour', async () => {
		const record = await read('m2-build-parity.json');
		expect(verifySealedRecord(record)).toEqual(record);
		expect(record['onlyInEra']).toEqual([]);
		expect(record['onlyInMigrated']).toEqual([]);
		expect(record['eraFileCount']).toBe(42);
		expect(record['migratedFileCount']).toBe(39);
		expect(JSON.stringify(record['knownDifferences'])).toContain('ES5');
		expect(JSON.stringify(record['nonclaims'])).toContain('general Angular support claim');
		expect(JSON.stringify(record['nonclaims'])).toContain('build-level parity only');
	});
});
