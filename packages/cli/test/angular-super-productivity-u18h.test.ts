import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import { parameteriseVoidSubjects } from '../../frameworks/angular/src/index.ts';
import { MANUAL_STEPS } from '../src/fixture/angular-super-productivity-u18h-run.ts';

const RUN = path.join(
	path.dirname(new URL(import.meta.url).pathname),
	'../../../evidence/runs/angular-super-productivity-v2-13-15',
);

const read = async (name: string): Promise<Readonly<Record<string, unknown>>> =>
	JSON.parse(await readFile(path.join(RUN, name), 'utf8')) as Readonly<Record<string, unknown>>;

const buildOf = (record: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> =>
	record['build'] as Readonly<Record<string, unknown>>;

const migrate = (source: string): ReturnType<typeof parameteriseVoidSubjects> =>
	parameteriseVoidSubjects('src/app/thing.service.ts', source);

describe('subject-void-type-argument', () => {
	it('writes void where a private subject is only ever nexted with nothing', () => {
		const migration = migrate(`import {Subject} from 'rxjs';
export class ConfigService {
  private _onNoCfgLoaded$ = new Subject();
  load(): void {
    this._onNoCfgLoaded$.next();
  }
}
`);
		expect(migration.changed).toBe(true);
		expect(migration.source).toContain('new Subject<void>()');
		expect(migration.changes).toHaveLength(1);
		expect(migration.changes[0]?.binding).toBe('_onNoCfgLoaded$');
		expect(migration.changes[0]?.callSites).toBe(1);
		expect(migration.unhandled).toEqual([]);
	});

	it('passes over reads of the subject, which a void subject still supports', () => {
		const migration = migrate(`import {merge, Subject} from 'rxjs';
export class ConfigService {
  private _signal$ = new Subject();
  readonly loaded$ = merge(this._signal$);
  fire(): void {
    this._signal$.next();
  }
}
`);
		expect(migration.changed).toBe(true);
		expect(migration.changes[0]?.callSites).toBe(1);
	});

	it('refuses a subject that is nexted with a value, and leaves it exactly as it was', () => {
		const source = `import {Subject} from 'rxjs';
export class ConfigService {
  private _signal$ = new Subject();
  fire(): void {
    this._signal$.next();
    this._signal$.next(1);
  }
}
`;
		const migration = migrate(source);
		expect(migration.changed).toBe(false);
		expect(migration.source).toBe(source);
		expect(migration.unhandled.join(' ')).toContain('carries a value');
	});

	it('refuses a subject the module does not keep to itself', () => {
		const migration = migrate(`import {Subject} from 'rxjs';
export class ConfigService {
  onNoCfg$ = new Subject();
  fire(): void {
    this.onNoCfg$.next();
  }
}
`);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('not private to the module');
	});

	it('refuses an exported module-local subject and writes a non-exported one', () => {
		const exported = migrate(`import {Subject} from 'rxjs';
export const signal$ = new Subject();
export function fire(): void { signal$.next(); }
`);
		expect(exported.changed).toBe(false);
		expect(exported.unhandled.join(' ')).toContain('not private to the module');
		const local = migrate(`import {Subject} from 'rxjs';
const signal$ = new Subject();
export function fire(): void { signal$.next(); }
`);
		expect(local.changed).toBe(true);
		expect(local.source).toContain('new Subject<void>()');
	});

	it('says nothing about a subject with no zero-argument next', () => {
		const source = `import {Subject} from 'rxjs';
export class ConfigService {
  private _values$ = new Subject();
  fire(): void { this._values$.next(1); }
}
`;
		const migration = migrate(source);
		expect(migration.changed).toBe(false);
		expect(migration.source).toBe(source);
		// A subject that carries a value raises no TS2554 here, so this is the
		// capability having no business rather than refusing.
		expect(migration.unhandled).toEqual([]);
	});

	it('leaves an explicit type argument alone', () => {
		const source = `import {Subject} from 'rxjs';
export class ConfigService {
  private _signal$ = new Subject<void>();
  fire(): void { this._signal$.next(); }
}
`;
		expect(migrate(source).changed).toBe(false);
		expect(migrate(source).source).toBe(source);
	});

	it('refuses a Subject that is not the rxjs one, by binding rather than by name', () => {
		const migration = migrate(`class Subject { next(): void {} }
export class ConfigService {
  private _signal$ = new Subject();
  fire(): void { this._signal$.next(); }
}
`);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('does not resolve to the rxjs import');
	});

	it('refuses a class that nests another class, where `this` is ambiguous', () => {
		const migration = migrate(`import {Subject} from 'rxjs';
export class ConfigService {
  private _signal$ = new Subject();
  make(): unknown {
    return class Inner { fire(): void { (this as any)._signal$.next(); } };
  }
  fire(): void { this._signal$.next(); }
}
`);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled.join(' ')).toContain('declares another class inside it');
	});

	it('is idempotent: a second pass over its own output changes nothing', () => {
		const once = migrate(`import {Subject} from 'rxjs';
export class ConfigService {
  private _signal$ = new Subject();
  fire(): void { this._signal$.next(); }
}
`);
		const twice = migrate(once.source);
		expect(twice.changed).toBe(false);
		expect(twice.source).toBe(once.source);
	});
});

describe('u18h manual-migration-step table', () => {
	it('gives every step a file, a reason and a family', () => {
		expect(MANUAL_STEPS.length).toBeGreaterThan(0);
		for (const step of MANUAL_STEPS) {
			expect(step.file.startsWith('src/'), step.id).toBe(true);
			expect(step.reason.length, step.id).toBeGreaterThan(60);
			expect(step.family.length, step.id).toBeGreaterThan(3);
		}
	});

	it('gives every step a distinct id and never the same before and after', () => {
		const ids = MANUAL_STEPS.map((step) => step.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const step of MANUAL_STEPS) {
			// The one entry that is not a step — the site a capability answered — is
			// the only one allowed to carry neither a before nor an after.
			if (step.before === '' && step.after === '') continue;
			expect(step.before, step.id).not.toBe(step.after);
		}
	});

	it('records the one site a capability answered as not a step', () => {
		const capability = MANUAL_STEPS.filter(
			(step) => step.before === '' && step.after === '',
		);
		expect(capability).toHaveLength(1);
		expect(capability[0]?.id).toBe('subject-next-argument');
		expect(capability[0]?.reason).toContain('capability');
	});
});

describe('super-productivity u18h accommodation round', () => {
	it('carries the previous round forward as its before column, unaltered', async () => {
		const record = await read('u18h-capability-round.json');
		const previous = await read('u18g-capability-round.json');
		expect(record['previous']).toBe('u18g-capability-round.json');
		expect(buildOf(record)['diagnosticCountsBefore']).toEqual(
			buildOf(previous)['diagnosticCounts'],
		);
		expect(buildOf(record)['diagnosticTotalBefore']).toBe(buildOf(previous)['diagnosticTotal']);
	});

	it('clears the whole source census and still reports the build red', async () => {
		const build = buildOf(await read('u18h-capability-round.json'));
		expect(build['diagnosticTotal']).toBe(0);
		expect(build['diagnosticCounts']).toEqual({});
		// The claim this record is most exposed on: no diagnostics and no artifact.
		expect(build['exitStatus']).toBe(1);
		expect(build['artifactsEmitted']).toBe(0);
	});

	it('accounts for every code the previous census carried', async () => {
		const build = buildOf(await read('u18h-capability-round.json'));
		const before = build['diagnosticCountsBefore'] as Readonly<Record<string, number>>;
		const cleared = build['cleared'] as Readonly<Record<string, string>>;
		expect(Object.keys(cleared).sort()).toEqual(Object.keys(before).sort());
		for (const [code, count] of Object.entries(before))
			expect(cleared[code], code).toBe(`${String(count)} → 0`);
	});

	it('states why it is red without counting bundler failures as diagnostics', async () => {
		const build = buildOf(await read('u18h-capability-round.json'));
		const failures = build['bundlerFailures'] as readonly Readonly<Record<string, unknown>>[];
		expect(failures.length).toBeGreaterThan(0);
		for (const failure of failures) {
			expect(failure['count']).toBeGreaterThan(0);
			expect(String(failure['observed']).length).toBeGreaterThan(20);
			expect(String(failure['cause']).length).toBeGreaterThan(60);
			expect(String(failure['whatItNeeds']).length).toBeGreaterThan(40);
		}
		// They are not TypeScript diagnostics and the census does not pretend they are.
		expect(build['diagnosticCounts']).toEqual({});
	});

	it('states the convergence as the series the previous records recorded', async () => {
		const build = buildOf(await read('u18h-capability-round.json'));
		const series = String(build['convergence'])
			.split('→')
			.map((entry) => Number.parseInt(entry.trim(), 10));
		expect(series.at(-1)).toBe(build['diagnosticTotal']);
		expect(series.at(-2)).toBe(build['diagnosticTotalBefore']);
		for (let index = 1; index < series.length; index += 1)
			expect(series[index]).toBeLessThan(series[index - 1] as number);
	});

	it('itemises every manual step with its file, its before, its after and its reason', async () => {
		const record = await read('u18h-capability-round.json');
		const manual = record['manualMigrationSteps'] as Readonly<Record<string, unknown>>;
		const steps = manual['steps'] as readonly Readonly<Record<string, string>>[];
		expect(steps).toHaveLength(manual['total'] as number);
		for (const step of steps) {
			expect(step['file'].startsWith('src/'), step['id']).toBe(true);
			expect(step['before'].length, step['id']).toBeGreaterThan(0);
			expect(step['after'].length, step['id']).toBeGreaterThan(0);
			expect(step['whyNoCapability'].length, step['id']).toBeGreaterThan(60);
		}
		expect(new Set(steps.map((step) => step['id'])).size).toBe(steps.length);
	});

	it('records the same steps the driver applies, id for id', async () => {
		const manual = (await read('u18h-capability-round.json'))[
			'manualMigrationSteps'
		] as Readonly<Record<string, unknown>>;
		const recorded = (manual['steps'] as readonly Readonly<Record<string, string>>[]).map(
			(step) => step['id'],
		);
		const applied = MANUAL_STEPS.filter(
			(step) => !(step.before === '' && step.after === ''),
		).map((step) => step.id);
		expect([...recorded].sort()).toEqual([...applied].sort());
		for (const step of MANUAL_STEPS) {
			if (step.before === '' && step.after === '') continue;
			const entry = (manual['steps'] as readonly Readonly<Record<string, string>>[]).find(
				(candidate) => candidate['id'] === step.id,
			);
			expect(entry?.['file'], step.id).toBe(step.file);
		}
	});

	it('separates capability-driven edits from steps taken by hand', async () => {
		const changed = (await read('u18h-capability-round.json'))[
			'applicationFilesChanged'
		] as Readonly<Record<string, unknown>>;
		const unit = changed['thisUnit'] as Readonly<Record<string, unknown>>;
		expect((unit['capabilityDrivenFiles'] as readonly string[]).length).toBe(
			unit['capabilityDriven'],
		);
		expect((unit['manualMigrationStepFileList'] as readonly string[]).length).toBe(
			unit['manualMigrationStepFiles'],
		);
		const manual = (await read('u18h-capability-round.json'))[
			'manualMigrationSteps'
		] as Readonly<Record<string, unknown>>;
		const stepFiles = new Set(
			(manual['steps'] as readonly Readonly<Record<string, string>>[]).map(
				(step) => step['file'],
			),
		);
		expect([...stepFiles].sort()).toEqual(unit['manualMigrationStepFileList']);
	});

	it('counts the whole tree, not only the files under src/', async () => {
		const changed = (await read('u18h-capability-round.json'))[
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
		const outside = whole['differingOutsideSrc'] as readonly string[];
		expect((changed['differingUnderSrcInBoth'] as number) + outside.length).toBe(
			whole['differingInBoth'],
		);
		const previous = (await read('u18g-capability-round.json'))[
			'applicationFilesChanged'
		] as Readonly<Record<string, unknown>>;
		expect(changed['previousTotalDifferences']).toBe(
			(previous['wholeTree'] as Readonly<Record<string, unknown>>)['totalDifferences'],
		);
	});

	it('names every module the electron redirect touched', async () => {
		const redirect = (await read('u18h-capability-round.json'))['electronRedirect'] as Readonly<
			Record<string, unknown>
		>;
		const modules = redirect['modules'] as readonly string[];
		expect(modules).toHaveLength(redirect['modulesRedirected'] as number);
		expect([...modules].sort()).toEqual([...modules]);
		for (const module of modules) expect(module.startsWith('src/')).toBe(true);
		expect((redirect['behaviourDifferences'] as readonly string[]).length).toBeGreaterThan(0);
	});

	it('keeps the accommodation payload out of the product surface', async () => {
		const record = await read('u18h-capability-round.json');
		const where = String((record['ruling'] as Readonly<Record<string, string>>)['whereTheyLive']);
		expect(where).toContain('fixtures/angular-super-productivity-v2-13-15');
		expect(where).toContain('packages/cli/src/fixture');
		const changes = record['adapterChanges'] as readonly Readonly<Record<string, unknown>>[];
		for (const change of changes) {
			expect(change['appNameBranches']).toBe(0);
			expect(String(change['file']).startsWith('packages/frameworks/angular/src/')).toBe(true);
		}
	});

	it('states every remaining demand as a transform rather than a fix', async () => {
		const demands = (await read('u18h-capability-round.json'))[
			'remainingDemands'
		] as readonly Readonly<Record<string, string>>[];
		expect(demands.length).toBeGreaterThan(0);
		for (const demand of demands) {
			expect(demand['file']).not.toBe('');
			expect((demand['observed'] ?? '').length).toBeGreaterThan(20);
			expect((demand['neededTransform'] ?? '').length).toBeGreaterThan(60);
		}
	});

	it('does not claim green, determinism or parity it did not measure', async () => {
		const record = await read('u18h-capability-round.json');
		const open = (record['notEstablished'] as readonly string[]).join(' ');
		expect(open).toContain('Whether the application runs');
		expect(open).toContain('determinis');
		expect(open).toContain('parity');
		expect(String(buildOf(record)['determinismNotEstablished']).length).toBeGreaterThan(60);
	});
});
