import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import { matchesIncludePattern } from '../src/fixture/angular-super-productivity-u18j-run.ts';

const RUN = path.join(
	path.dirname(new URL(import.meta.url).pathname),
	'../../../evidence/runs/angular-super-productivity-v2-13-15',
);

const read = async (name: string): Promise<Readonly<Record<string, unknown>>> =>
	JSON.parse(await readFile(path.join(RUN, name), 'utf8')) as Readonly<Record<string, unknown>>;

const record = async (): Promise<Readonly<Record<string, unknown>>> =>
	read('u18j-worker-chunks-parity.json');

const section = (
	value: Readonly<Record<string, unknown>>,
	key: string,
): Readonly<Record<string, unknown>> => value[key] as Readonly<Record<string, unknown>>;

describe('tsconfig include matching', () => {
	it('matches a `**` pattern across any number of segments and no segment at all', () => {
		expect(matchesIncludePattern('src/**/*.worker.ts', 'src/app/core/lz.worker.ts')).toBe(true);
		expect(matchesIncludePattern('src/**/*.worker.ts', 'src/lz.worker.ts')).toBe(true);
		expect(matchesIncludePattern('src/**/*.worker.ts', 'src/app/a/b/c/lz.worker.ts')).toBe(
			true,
		);
	});

	it('refuses a file the pattern does not reach', () => {
		expect(matchesIncludePattern('src/**/*.worker.ts', 'src/app/core/lz.service.ts')).toBe(
			false,
		);
		expect(matchesIncludePattern('src/**/*.worker.ts', 'e2e/app/lz.worker.ts')).toBe(false);
		expect(matchesIncludePattern('src/**/*.worker.ts', 'src/app/core/lz.worker.tsx')).toBe(
			false,
		);
	});

	it('keeps a single `*` inside one segment', () => {
		expect(matchesIncludePattern('src/*.ts', 'src/main.ts')).toBe(true);
		expect(matchesIncludePattern('src/*.ts', 'src/app/main.ts')).toBe(false);
		expect(matchesIncludePattern('src/app?.ts', 'src/app1.ts')).toBe(true);
		expect(matchesIncludePattern('src/app?.ts', 'src/app12.ts')).toBe(false);
	});
});

describe('super-productivity u18j worker-chunk and parity round', () => {
	it('carries the previous round forward by name', async () => {
		expect((await record())['previous']).toBe('u18i-closure-correction-green.json');
		expect((await record())['result']).toBe('green');
	});

	it('emits the four worker artifacts the previous round measured as missing', async () => {
		const previous = section(
			section(await read('u18i-closure-correction-green.json'), 'logicalNameParity'),
			'webWorkers',
		);
		const emitted = section(await record(), 'workerChunks')['emitted'] as readonly string[];
		expect(emitted).toHaveLength((previous['missing'] as readonly string[]).length);
		// The same two workers, emitted; the names differ and the record says why.
		for (const stem of ['lz', 'reminder'])
			expect(emitted.filter((file) => file.startsWith(`${stem}.`))).toHaveLength(2);
		const evidence = section(await record(), 'workerChunks')['evidence'] as readonly string[];
		expect(evidence.length).toBeGreaterThan(2);
		for (const line of evidence) expect(line.length).toBeGreaterThan(40);
	});

	it('accounts for every artifact the build emitted against the era inventory', async () => {
		const parity = section(await record(), 'logicalNameParity');
		const migrated = parity['migratedLogicalNames'] as number;
		const era = parity['eraLogicalNames'] as number;
		const common = parity['common'] as number;
		expect(common + (parity['inMigratedNotInEra'] as readonly string[]).length).toBe(migrated);
		expect(common + (parity['inEraNotInMigrated'] as readonly string[]).length).toBe(era);
		const named = new Set(
			(parity['asymmetries'] as readonly Readonly<Record<string, unknown>>[]).flatMap(
				(entry) => entry['names'] as readonly string[],
			),
		);
		// Every asymmetry, in either direction, is named by one of them.
		for (const name of [
			...(parity['inMigratedNotInEra'] as readonly string[]),
			...(parity['inEraNotInMigrated'] as readonly string[]),
		])
			expect(named.has(name), name).toBe(true);
	});

	it('states each asymmetry as a difference with a reading rather than a gap', async () => {
		const parity = section(await record(), 'logicalNameParity');
		for (const entry of parity['asymmetries'] as readonly Readonly<Record<string, unknown>>[]) {
			expect(String(entry['kind']).length).toBeGreaterThan(3);
			expect(String(entry['reading']).length).toBeGreaterThan(120);
			expect((entry['names'] as readonly string[]).length).toBeGreaterThan(0);
		}
	});

	it('reports the artifact count the emitted census and the logs agree on', async () => {
		const build = section(await record(), 'build');
		const parity = section(await record(), 'logicalNameParity');
		const logs = build['logs'] as readonly Readonly<Record<string, unknown>>[];
		expect(logs.length).toBeGreaterThan(1);
		for (const log of logs) {
			expect(log['exitStatus']).toBe(0);
			expect(log['errors']).toBe(0);
			expect(log['artifactsEmitted']).toBe(parity['migratedLogicalNames']);
		}
		expect(section(await record(), 'determinism')['files']).toBe(
			parity['migratedLogicalNames'],
		);
	});

	it('states determinism as a comparison it made, modulo one named field', async () => {
		const determinism = section(await record(), 'determinism');
		const differing = determinism['differing'] as readonly string[];
		expect((determinism['identical'] as number) + differing.length).toBe(determinism['files']);
		expect(determinism['runs']).toBeGreaterThan(1);
		expect(String(determinism['cause'])).toContain('timestamp');
		expect((determinism['artefactsKept'] as readonly string[]).length).toBeGreaterThan(2);
	});

	it('adds no accommodation and carries the whole inventory forward unchanged', async () => {
		const accommodations = section(await record(), 'accommodations');
		const previous = section(
			await read('u18i-closure-correction-green.json'),
			'accommodations',
		);
		expect(accommodations['addedThisRound']).toBe(0);
		expect(accommodations['carriedForward']).toBe(previous['carriedForward']);
		expect(String(accommodations['inventoryComplete'])).toContain('19');
		expect(String(accommodations['inventoryComplete'])).toContain(
			'fixtures/angular-super-productivity-v2-13-15',
		);
	});

	it('counts the whole tree and splits the round into capability and accommodation', async () => {
		const changed = section(await record(), 'applicationFilesChanged');
		const whole = section(changed, 'wholeTree');
		expect(whole['totalDifferences']).toBe(
			(whole['differingInBoth'] as number) +
				(whole['filesAdded'] as number) +
				(whole['filesRemoved'] as number),
		);
		expect((whole['addedFiles'] as readonly string[]).length).toBe(whole['filesAdded']);
		expect((whole['removedFiles'] as readonly string[]).length).toBe(whole['filesRemoved']);
		expect(whole['appliedFiles']).toBe(
			(whole['pristineFiles'] as number) +
				(whole['filesAdded'] as number) -
				(whole['filesRemoved'] as number),
		);
		expect(
			(whole['differingUnderSrcInBoth'] as number) +
				(whole['differingOutsideSrc'] as readonly string[]).length,
		).toBe(whole['differingInBoth']);
		const unit = section(changed, 'thisUnit');
		expect((unit['capabilityDrivenFiles'] as readonly string[]).length).toBe(
			unit['capabilityDriven'],
		);
		expect(unit['accommodationDriven']).toBe(0);
		expect((unit['accommodationDrivenFiles'] as readonly string[]).length).toBe(0);
		expect((unit['capabilityDriven'] as number) + (unit['accommodationDriven'] as number)).toBe(
			unit['filesWritten'],
		);
		const previous = section(
			await read('u18i-closure-correction-green.json'),
			'applicationFilesChanged',
		);
		expect(changed['previousTotalDifferences']).toBe(
			section(previous, 'wholeTree')['totalDifferences'],
		);
		expect(whole['totalDifferences']).toBe(
			(changed['previousTotalDifferences'] as number) + (unit['newlyDiffering'] as number),
		);
	});

	it('records the capability where a capability lives, with no application branch', async () => {
		const added = (await record())['capabilitiesAdded'] as readonly Readonly<
			Record<string, unknown>
		>[];
		expect(added.length).toBeGreaterThan(0);
		for (const capability of added) {
			expect(capability['appNameBranches']).toBe(0);
			expect(String(capability['file']).startsWith('packages/frameworks/angular/src/')).toBe(
				true,
			);
			expect(String(capability['test']).startsWith('packages/frameworks/angular/test/')).toBe(
				true,
			);
			expect(String(capability['reading']).length).toBeGreaterThan(400);
			expect(
				(capability['refusesRatherThanGuesses'] as readonly string[]).length,
			).toBeGreaterThan(2);
			expect(capability['ruledAccommodation']).toBe(false);
		}
	});

	it('reports the round outcome as files, changes and refusals with a reading behind them', async () => {
		const outcomes = (await record())['capabilityOutcomes'] as readonly Readonly<
			Record<string, unknown>
		>[];
		for (const outcome of outcomes) {
			const files = outcome['filesChanged'] as readonly string[];
			expect((outcome['changes'] as readonly string[]).length).toBe(files.length);
			for (const file of files) expect(file.startsWith('src/')).toBe(true);
			expect((outcome['reading'] as readonly string[]).length).toBeGreaterThan(2);
			expect(String(outcome['driver']).startsWith('packages/cli/src/fixture/')).toBe(true);
		}
		const changed = section(section(await record(), 'applicationFilesChanged'), 'thisUnit');
		expect(
			outcomes.flatMap((outcome) => outcome['filesChanged'] as readonly string[]).sort(),
		).toEqual([...(changed['capabilityDrivenFiles'] as readonly string[])].sort());
	});

	it('does not claim the workers run, only that they are emitted', async () => {
		const open = ((await record())['notEstablished'] as readonly string[]).join(' ');
		expect(open).toContain('Whether the application runs');
		expect(open).toContain('Whether the two web workers work');
		const complete = section(await record(), 'cellBuildStoryComplete');
		expect(String(complete['whatItDoesNotClose']).length).toBeGreaterThan(40);
		expect((complete['what'] as readonly string[]).length).toBeGreaterThan(3);
	});
});
