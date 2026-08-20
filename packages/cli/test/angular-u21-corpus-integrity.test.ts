import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	correctInventory,
	defectExplainsEveryMove,
	readFontLocality,
	sourceFontLinks,
	type CorrectedValue,
	type ValueCorrection,
} from '../src/fixture/angular-u21-corpus-integrity-run.ts';
import {
	verifySealedRecord,
	type DistEntry,
	type SealedRecord,
} from '../src/fixture/angular-factoriolab-build-lanes-run.ts';

const repositoryRoot = path.resolve(import.meta.dirname, '../../..');

const read = async (relative: string): Promise<SealedRecord> =>
	JSON.parse(await readFile(path.join(repositoryRoot, relative), 'utf8')) as SealedRecord;

const entry = (file: string, sha: string, bytes: number): DistEntry => ({
	path: file,
	sha256: sha,
	bytes,
});

describe('recomputing a published inventory against its retained tree', () => {
	it('separates the digests that moved from the ones that were right by coincidence', () => {
		const correction = correctInventory(
			[entry('high.js', 'a'.repeat(64), 10), entry('ascii.txt', 'b'.repeat(64), 5)],
			[entry('high.js', 'c'.repeat(64), 10), entry('ascii.txt', 'b'.repeat(64), 5)],
			'.versionless/tree',
			'inventory[].sha256',
			new Set(['high.js']),
		);
		expect(correction.valuesTotal).toBe(2);
		expect(correction.valuesCorrected).toBe(1);
		expect(correction.valuesAlreadyCorrect).toBe(1);
		expect(correction.alreadyCorrect).toEqual(['ascii.txt']);
		expect(correction.corrected[0]).toEqual({
			path: 'high.js',
			bytes: 10,
			published: 'a'.repeat(64),
			corrected: 'c'.repeat(64),
			carriesHighBytes: true,
		});
		expect(correction.basis).toBe('recomputed-from-retained-tree');
	});

	it('refuses a tree that is not the one the record was taken from', () => {
		expect(() =>
			correctInventory(
				[entry('gone.js', 'a'.repeat(64), 10)],
				[],
				'.versionless/tree',
				'inventory[].sha256',
				new Set(),
			),
		).toThrow('absent from the retained tree');
		expect(() =>
			correctInventory(
				[entry('a.js', 'a'.repeat(64), 10)],
				[entry('a.js', 'c'.repeat(64), 11)],
				'.versionless/tree',
				'inventory[].sha256',
				new Set(),
			),
		).toThrow('no digest was corrected');
	});

	it('rejects a correction the latin1 defect does not explain', () => {
		const moved = (carriesHighBytes: boolean): ValueCorrection => ({
			at: 'inventory[].sha256',
			recomputedFrom: '.versionless/tree',
			basis: 'recomputed-from-retained-tree',
			valuesTotal: 1,
			valuesCorrected: 1,
			valuesAlreadyCorrect: 0,
			corrected: [
				{
					path: 'a.js',
					bytes: 1,
					published: 'a'.repeat(64),
					corrected: 'b'.repeat(64),
					carriesHighBytes,
				} satisfies CorrectedValue,
			],
			alreadyCorrect: [],
		});
		expect(defectExplainsEveryMove(moved(true))).toBe(true);
		/**
		 * A file made only of bytes below 0x80 hashes the same either way, so a
		 * digest that moved for one has some other cause and must not be filed
		 * under this correction.
		 */
		expect(defectExplainsEveryMove(moved(false))).toBe(false);
	});
});

describe('reading a document for the build-time font inliner', () => {
	it('does not mistake the application’s own link element for an inlined fetch', () => {
		const era =
			'<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">';
		const reading = readFontLocality(era);
		expect(reading.hosts).toEqual(['fonts.googleapis.com']);
		expect(reading.inlinedFontFaceRules).toBe(0);
		expect(reading.inlined).toBe(false);
	});

	it('recognises the inliner by CSS the build put there and no input contains', () => {
		const migrated =
			"<style>@font-face{font-family:'Material Icons';src:url(https://fonts.gstatic.com/s/x.woff2)}</style>";
		const reading = readFontLocality(migrated);
		expect(reading.hosts).toEqual(['fonts.gstatic.com']);
		expect(reading.inlinedFontFaceRules).toBe(1);
		expect(reading.inlined).toBe(true);
	});

	it('reads the source links verbatim and deduplicates them', () => {
		expect(
			sourceFontLinks(
				'<link href="https://fonts.googleapis.com/css?family=Roboto:300&display=swap">' +
					'<link href="https://fonts.googleapis.com/css?family=Roboto:300&display=swap">' +
					'<script src="https://use.typekit.net/abc.js"></script>',
			),
		).toEqual([
			'https://fonts.googleapis.com/css?family=Roboto:300&display=swap',
			'https://use.typekit.net/abc.js',
		]);
		expect(sourceFontLinks('<title>no fonts here</title>')).toEqual([]);
	});
});

describe('the published u21 digest corrections', () => {
	const corrections = [
		'evidence/runs/angular-super-productivity-v2-13-15/u21-era-baseline-digest-correction.json',
		'evidence/runs/angular-factoriolab/u21-m2-era-baseline-digest-correction.json',
		'evidence/runs/angular-factoriolab/u21-m2-migrated-build-digest-correction.json',
		'evidence/runs/angular-factoriolab/u21-m2-build-parity-digest-correction.json',
	];

	it('each one seals, names its defect and states its basis', async () => {
		for (const relative of corrections) {
			const record = await read(relative);
			expect(verifySealedRecord(record)).toEqual(record);
			expect(record['unit']).toBe('lrapr-t006/u21-corpus-integrity-corrections');
			expect(String(record['defect'])).toContain("bytes.toString('binary')");
			expect(String(record['basis'])).toContain('injective');
			expect(String(record['fixedAt'])).toContain('inventoryOf');
			expect(JSON.stringify(record['notEstablished'])).toContain('Nothing was rebuilt');
		}
	});

	it('supersedes the original by reference, and the original still verifies untouched', async () => {
		const { createHash } = await import('node:crypto');
		for (const relative of corrections) {
			const record = await read(relative);
			const superseded = record['supersedes'] as Record<string, string>;
			const originalBytes = await readFile(
				path.join(repositoryRoot, superseded['path'] ?? ''),
			);
			/**
			 * The whole point of superseding by reference is that the original is
			 * not edited. If either binding stopped matching, this unit mutated a
			 * published record and the correction is void.
			 */
			expect(createHash('sha256').update(originalBytes).digest('hex')).toBe(
				superseded['sha256'],
			);
			const original = JSON.parse(originalBytes.toString('utf8')) as SealedRecord;
			expect(original['digest']).toBe(superseded['digest']);
			expect(verifySealedRecord(original)).toEqual(original);
			expect(String(record['immutability'])).toContain('does not re-publish');
		}
	});

	it('every corrected value moved because the file carries a high byte', async () => {
		for (const relative of corrections) {
			const record = await read(relative);
			const list = record['corrections'] as readonly ValueCorrection[];
			expect(list.length).toBeGreaterThan(0);
			for (const correction of list) {
				expect(correction.basis).toBe('recomputed-from-retained-tree');
				expect(correction.valuesCorrected + correction.valuesAlreadyCorrect).toBe(
					correction.valuesTotal,
				);
				expect(correction.valuesCorrected).toBeGreaterThan(0);
				expect(defectExplainsEveryMove(correction)).toBe(true);
				for (const value of correction.corrected)
					expect(value.published).not.toBe(value.corrected);
			}
		}
	});

	it('the parity correction rechecks its own conclusion rather than asserting it', async () => {
		const record = await read(
			'evidence/runs/angular-factoriolab/u21-m2-build-parity-digest-correction.json',
		);
		const recheck = record['conclusionRecheck'] as Record<string, unknown>;
		expect(recheck['agrees']).toBe(true);
		expect(recheck['publishedCount']).toBe(recheck['recomputedCount']);
		const original = await read('evidence/runs/angular-factoriolab/m2-build-parity.json');
		expect(recheck['publishedCount']).toBe(
			(original['identicalPayloads'] as readonly string[]).length,
		);
	});

	it('records what the factoriolab witness receipt actually bound, on every record it binds', async () => {
		/**
		 * The receipt binds all three factoriolab build-lane records, so the
		 * finding belongs on all three: a Judge opening any one of them should
		 * find it there rather than have to know which record carries it.
		 */
		for (const relative of corrections.filter((file) => file.includes('angular-factoriolab'))) {
			const binding = String((await read(relative))['witnessBinding']);
			expect(binding).toContain('does *not* bind any artifact digest');
			expect(binding).toContain('deliberately not re-published');
			expect(binding).toContain('binds bytes that contain affected values');
		}
		/** The super-productivity record is bound by no witness receipt and says nothing. */
		const superProductivity = await read(
			'evidence/runs/angular-super-productivity-v2-13-15/u21-era-baseline-digest-correction.json',
		);
		expect(superProductivity['witnessBinding']).toBeUndefined();
	});
});

describe('the published u21 font-inlining locality findings', () => {
	const lanes = [
		'angular-tiny-translator-v0-12-0',
		'angular-super-productivity-v2-13-15',
		'angular-factoriolab',
		'angular-jira-clone',
	];

	it('covers every Angular 16 lane and seals', async () => {
		for (const lane of lanes) {
			const record = await read(`evidence/runs/${lane}/u21-font-inline-locality.json`);
			expect(verifySealedRecord(record)).toEqual(record);
			expect(record['lane']).toBe(lane);
			expect(String(record['method'])).toContain('appears in no source file');
			expect(JSON.stringify(record['notEstablished'])).toContain('Nothing is rebuilt');
		}
	});

	it('names the two lanes that fetched and the two that had nothing to fetch', async () => {
		const affected: string[] = [];
		const unaffected: string[] = [];
		for (const lane of lanes) {
			const record = await read(`evidence/runs/${lane}/u21-font-inline-locality.json`);
			(record['fetchedAtBuildTime'] === true ? affected : unaffected).push(lane);
			/** A lane needs a rebuild exactly when its build made the request. */
			expect(record['rebuildRequired']).toBe(record['fetchedAtBuildTime']);
		}
		expect(affected).toEqual([
			'angular-tiny-translator-v0-12-0',
			'angular-super-productivity-v2-13-15',
		]);
		expect(unaffected).toEqual(['angular-factoriolab', 'angular-jira-clone']);
	});

	it('grounds each verdict in the two documents it was read from', async () => {
		const inlined = await read(
			'evidence/runs/angular-tiny-translator-v0-12-0/u21-font-inline-locality.json',
		);
		const reading = inlined['reading'] as Record<string, unknown>;
		expect(reading['sourceFontLinks']).toEqual([
			'https://fonts.googleapis.com/icon?family=Material+Icons',
		]);
		expect(reading['inlinedFontFaceRules']).toBe(1);
		expect(reading['emittedFontHosts']).toEqual(['fonts.gstatic.com']);
		/**
		 * The inlined stylesheet still points at the font host, so the runtime
		 * request survived and only the stylesheet request moved into the build.
		 * That is why the emitted hosts list is gstatic and not googleapis.
		 */
		expect(String(inlined['finding'])).toContain('appear in no');

		const clean = await read('evidence/runs/angular-jira-clone/u21-font-inline-locality.json');
		const cleanReading = clean['reading'] as Record<string, unknown>;
		expect(cleanReading['sourceFontLinks']).toEqual([]);
		expect(cleanReading['inlinedFontFaceRules']).toBe(0);
		expect(String(clean['finding'])).toContain('nothing to fetch');
		expect(clean['publishedRecordsAffected']).toBe('none');
	});
});
