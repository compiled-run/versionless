import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	assembleMigratedTree,
	DIAGNOSTICS_DIRECTORY,
	ROUND_DIAGNOSTIC_LOGS,
} from '../src/fixture/angular-super-productivity-assemble.ts';
import { applyRound } from '../src/fixture/angular-super-productivity-u18c-run.ts';
import {
	suggestedRenameRound,
	tildeRound,
} from '../src/fixture/angular-super-productivity-u18d-run.ts';
import {
	baseClassRound,
	memberRenameRound,
} from '../src/fixture/angular-super-productivity-u18e-run.ts';
import {
	splitElementRound,
	symbolSuccessorRound,
} from '../src/fixture/angular-super-productivity-u18f-run.ts';
import {
	interopRound,
	voidExecutorRound,
} from '../src/fixture/angular-super-productivity-u18g-run.ts';
import {
	applyStep,
	electronRedirect,
	voidSubjectRound,
} from '../src/fixture/angular-super-productivity-u18h-run.ts';
import {
	jsonNamedImportRound,
	sassMixinRound,
	urlRebaseRound,
} from '../src/fixture/angular-super-productivity-u18i-run.ts';
import { workerUrlRound } from '../src/fixture/angular-super-productivity-u18j-run.ts';

const RUN = path.join(
	path.dirname(new URL(import.meta.url).pathname),
	'../../../evidence/runs/angular-super-productivity-v2-13-15',
);

const read = async (name: string): Promise<Readonly<Record<string, unknown>>> =>
	JSON.parse(await readFile(path.join(RUN, name), 'utf8')) as Readonly<Record<string, unknown>>;

const section = (
	value: Readonly<Record<string, unknown>>,
	key: string,
): Readonly<Record<string, unknown>> => value[key] as Readonly<Record<string, unknown>>;

const record = async (): Promise<Readonly<Record<string, unknown>>> =>
	read('u20c2e-assemble-rebuild-behavior.json');

describe('the assembly entrypoint is evidence-free and callable', () => {
	it('exposes every accommodation round as a tree-parameterised function', () => {
		// The extraction landed: each round the u18 mains used to run inline is now
		// an exported function the assembly can call without writing any evidence.
		for (const round of [
			applyRound,
			tildeRound,
			suggestedRenameRound,
			baseClassRound,
			memberRenameRound,
			splitElementRound,
			symbolSuccessorRound,
			interopRound,
			voidExecutorRound,
			voidSubjectRound,
			applyStep,
			electronRedirect,
			sassMixinRound,
			jsonNamedImportRound,
			urlRebaseRound,
			workerUrlRound,
		])
			expect(typeof round).toBe('function');
		expect(typeof assembleMigratedTree).toBe('function');
	});
});

describe('assembles the known tree from source and committed transforms', () => {
	it('scopes the five log-driven rounds by committed, progressive diagnostics', () => {
		// The sequence is progressive: each log is the red state the previous round
		// left for the next, so the rounds are not interchangeable.
		expect(ROUND_DIAGNOSTIC_LOGS).toEqual({
			u18d: 'build-2.log',
			u18e: 'build-3.log',
			u18f: 'build-4.log',
			u18g: 'build-5.log',
			u18h: 'build-6.log',
		});
	});

	it('carries those diagnostics as committed fixtures, each with its own family', () => {
		const familyOf: Readonly<Record<string, string>> = {
			'build-2.log': ' - error TS2724: ',
			'build-3.log': ' - error TS2314: ',
			'build-4.log': ' - error NG8001: ',
			'build-5.log': ' - error TS2794: ',
			'build-6.log': ' - error TS2554: ',
		};
		for (const [log, marker] of Object.entries(familyOf)) {
			const file = path.join(DIAGNOSTICS_DIRECTORY, log);
			expect(existsSync(file), file).toBe(true);
			expect(readFileSync(file, 'utf8')).toContain(marker);
		}
	});

	it('records the eight accommodation stages, u18c through u18j, in order', async () => {
		const stages = section(await record(), 'assembly')['stages'] as readonly string[];
		expect(stages).toEqual(['u18c', 'u18d', 'u18e', 'u18f', 'u18g', 'u18h', 'u18i', 'u18j']);
	});
});

describe('the reorder fix is present in the assembled and built lane', () => {
	it('names the reordered split template among the migrated application changes', async () => {
		const changed = section(await record(), 'applicationFilesChanged');
		expect(changed['reorderFile']).toBe('src/app/pages/work-view/work-view-page.component.html');
		expect((changed['reorderChanges'] as readonly string[]).length).toBeGreaterThan(0);
		expect((changed['reorderChanges'] as readonly string[]).join(' ')).toContain('splitPos');
	});

	it('reads the position input as bound last in the emitted application chunk', async () => {
		const inBundle = section(section(await record(), 'build'), 'reorderInBundle');
		expect(inBundle['positionLast']).toBe(true);
		expect(String(inBundle['mainChunk'])).toMatch(/^main\..*\.js$/u);
	});
});

describe('the entrypoint is deterministic — assemble twice, identical tree', () => {
	it('hashed the migrated source twice and got the same digest', async () => {
		const determinism = section(section(await record(), 'assembly'), 'determinism');
		expect(determinism['runs']).toBe(2);
		expect(determinism['identical']).toBe(true);
		expect(determinism['files']).toBeGreaterThan(0);
		expect(determinism['firstDigest']).toBe(determinism['secondDigest']);
	});
});

describe('the regression is proven gone against an immutable control', () => {
	it('supersedes u23 by reference, leaving its bytes immutable', async () => {
		const supersedes = section(await record(), 'supersedes');
		expect(supersedes['record']).toBe('u23-offline-font-lane.json');
		expect(supersedes['by']).toBe('reference');
		// u23's own record is untouched and still on disk.
		expect(existsSync(path.join(RUN, 'u23-offline-font-lane.json'))).toBe(true);
	});

	it('rebuilt offline twice with zero egress and exit zero', async () => {
		const builds = section(await record(), 'build')['builds'] as readonly Readonly<
			Record<string, unknown>
		>[];
		expect(builds).toHaveLength(2);
		for (const build of builds) {
			expect(build['exitStatus']).toBe(0);
			expect(build['egressAttempts']).toBe(0);
		}
	});

	it('measured the split regression on the control and its absence on the fix', async () => {
		const behavior = section(await record(), 'behavior');
		const control = section(behavior, 'control');
		const migrated = section(behavior, 'migrated');
		// The control (dist-23, no reorder) still throws; a clean control would
		// mean the host measured nothing.
		expect(control['pageErrors']).toBe(1);
		expect((control['splitConsoleErrors'] as number) > 0).toBe(true);
		// The rebuilt lane (dist-25, reorder) loads clean.
		expect(migrated['pageErrors']).toBe(0);
		expect(migrated['splitConsoleErrors']).toBe(0);
	});

	it('states the run as the green, regression-gone outcome', async () => {
		expect((await record())['result']).toBe('reassembled-offline-rebuilt-regression-gone');
	});
});
