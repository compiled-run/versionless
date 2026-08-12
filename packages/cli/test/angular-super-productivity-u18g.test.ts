import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';

const RUN = path.join(
	path.dirname(new URL(import.meta.url).pathname),
	'../../../evidence/runs/angular-super-productivity-v2-13-15',
);

const read = async (name: string): Promise<Readonly<Record<string, unknown>>> =>
	JSON.parse(await readFile(path.join(RUN, name), 'utf8')) as Readonly<Record<string, unknown>>;

const buildOf = (record: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> =>
	record['build'] as Readonly<Record<string, unknown>>;

const total = (counts: Readonly<Record<string, number>>): number =>
	Object.values(counts).reduce((sum, count) => sum + count, 0);

describe('super-productivity u18g capability round', () => {
	it('carries the previous round forward as its before column, unaltered', async () => {
		const record = await read('u18g-capability-round.json');
		const previous = await read('u18f-capability-round.json');
		expect(record['previous']).toBe('u18f-capability-round.json');
		expect(buildOf(record)['diagnosticCountsBefore']).toEqual(
			buildOf(previous)['diagnosticCounts'],
		);
		expect(buildOf(record)['diagnosticTotalBefore']).toBe(buildOf(previous)['diagnosticTotal']);
	});

	it('records a red build and claims no artifact', async () => {
		const build = buildOf(await read('u18g-capability-round.json'));
		expect(build['exitStatus']).toBe(1);
		expect(build['artifactsEmitted']).toBe(0);
	});

	it('reports a census whose totals are the sums of its own counts', async () => {
		const build = buildOf(await read('u18g-capability-round.json'));
		const before = build['diagnosticCountsBefore'] as Readonly<Record<string, number>>;
		const after = build['diagnosticCounts'] as Readonly<Record<string, number>>;
		expect(build['diagnosticTotalBefore']).toBe(total(before));
		expect(build['diagnosticTotal']).toBe(total(after));
		expect(total(after)).toBeLessThan(total(before));
	});

	it('does not claim a family cleared that the census still counts', async () => {
		const build = buildOf(await read('u18g-capability-round.json'));
		const after = build['diagnosticCounts'] as Readonly<Record<string, number>>;
		const cleared = build['cleared'] as Readonly<Record<string, string>>;
		expect(Object.keys(cleared).length).toBeGreaterThan(0);
		for (const [code, movement] of Object.entries(cleared)) {
			const to = movement.split('→')[1]?.trim().split(' ')[0] ?? '';
			expect(Number.parseInt(to, 10), code).toBe(after[code] ?? 0);
		}
	});

	it('accounts for every code the previous census carried, cleared or unmoved', async () => {
		const build = buildOf(await read('u18g-capability-round.json'));
		const before = build['diagnosticCountsBefore'] as Readonly<Record<string, number>>;
		const after = build['diagnosticCounts'] as Readonly<Record<string, number>>;
		const cleared = build['cleared'] as Readonly<Record<string, string>>;
		const unmoved = build['unmoved'] as string;
		for (const [code, count] of Object.entries(before)) {
			if ((after[code] ?? 0) !== count) expect(Object.keys(cleared), code).toContain(code);
			else expect(unmoved, code).toContain(`${code} ${String(count)}`);
		}
		for (const code of Object.keys(after)) expect(Object.keys(before)).toContain(code);
	});

	it('claims no diagnostic code the round introduced', async () => {
		const build = buildOf(await read('u18g-capability-round.json'));
		const before = build['diagnosticCountsBefore'] as Readonly<Record<string, number>>;
		const after = build['diagnosticCounts'] as Readonly<Record<string, number>>;
		for (const [code, count] of Object.entries(after))
			expect(count, code).toBeLessThanOrEqual(before[code] ?? 0);
	});

	it('states the convergence as the series the previous records recorded', async () => {
		const build = buildOf(await read('u18g-capability-round.json'));
		const series = String(build['convergence'])
			.split('→')
			.map((entry) => Number.parseInt(entry.trim(), 10));
		expect(series.at(-1)).toBe(build['diagnosticTotal']);
		expect(series.at(-2)).toBe(build['diagnosticTotalBefore']);
		for (let index = 1; index < series.length; index += 1)
			expect(series[index]).toBeLessThan(series[index - 1] as number);
	});

	it('counts the whole tree, not only the files under src/', async () => {
		const changed = (await read('u18g-capability-round.json'))[
			'applicationFilesChanged'
		] as Readonly<Record<string, unknown>>;
		const whole = changed['wholeTree'] as Readonly<Record<string, unknown>>;
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
		// Every difference outside src/ is named, and the src/-scoped count is a
		// strict subset of the whole-tree one.
		const outside = whole['differingOutsideSrc'] as readonly string[];
		expect((changed['differingFromPristine'] as number) + outside.length).toBe(
			whole['differingInBoth'],
		);
		expect(outside).toContain('tsconfig.json');
	});

	it('names every application file it changed and counts them the same way twice', async () => {
		const record = await read('u18g-capability-round.json');
		const changed = record['applicationFilesChanged'] as Readonly<Record<string, unknown>>;
		const files = changed['newFiles'] as readonly string[];
		expect(files).toHaveLength(changed['newInThisUnit'] as number);
		expect([...files].sort()).toEqual([...files]);
		for (const file of files) expect(file.startsWith('src/')).toBe(true);
		const previous = (await read('u18f-capability-round.json'))[
			'applicationFilesChanged'
		] as Readonly<Record<string, unknown>>;
		expect(
			(changed['differingFromPristine'] as number) -
				(previous['differingFromPristine'] as number),
		).toBe(changed['newInThisUnit']);
		expect(changed['pristineFilesUnderSrc']).toBe(previous['pristineFilesUnderSrc']);
	});

	it('states every remaining demand as a transform rather than a fix', async () => {
		const demands = (await read('u18g-capability-round.json'))[
			'remainingDemands'
		] as readonly Readonly<Record<string, string>>[];
		expect(demands.length).toBeGreaterThan(0);
		for (const demand of demands) {
			expect(demand['file']).not.toBe('');
			expect((demand['observed'] ?? '').length).toBeGreaterThan(20);
			expect((demand['neededTransform'] ?? '').length).toBeGreaterThan(60);
		}
	});

	it('itemises a remainder no larger than the round it followed', async () => {
		const record = await read('u18g-capability-round.json');
		const previous = await read('u18f-capability-round.json');
		const observed = (record['remainingDemands'] as readonly Readonly<Record<string, string>>[])
			.map((demand) => demand['observed'] ?? '')
			.join(' ');
		const after = buildOf(record)['diagnosticCounts'] as Readonly<Record<string, number>>;
		for (const code of Object.keys(after)) expect(observed, code).toContain(code);
		const previousDemands = previous['remainingDemands'] as readonly unknown[];
		expect(buildOf(record)['diagnosticTotal']).toBeLessThan(
			buildOf(previous)['diagnosticTotal'] as number,
		);
		expect(previousDemands.length).toBeGreaterThan(0);
	});

	it('claims no capability that branches on the application name', async () => {
		const changes = (await read('u18g-capability-round.json'))[
			'adapterChanges'
		] as readonly Readonly<Record<string, unknown>>[];
		expect(changes.length).toBeGreaterThan(0);
		for (const change of changes) {
			expect(change['appNameBranches']).toBe(0);
			expect(String(change['file']).startsWith('packages/frameworks/angular/src/')).toBe(true);
		}
	});

	it('states what it did not establish, including that the build is not green', async () => {
		const record = await read('u18g-capability-round.json');
		const open = record['notEstablished'] as readonly string[];
		expect(open.length).toBeGreaterThan(3);
		expect(open.join(' ')).toContain('Whether the application runs');
	});
});
