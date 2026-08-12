/**
 * The u18h round of the `angular-super-productivity-v2-13-15` cell: the round
 * that stops pretending every remaining demand has a capability in it.
 *
 * u18c through u18g took the families a capability could reach and cleared them,
 * 269 diagnostics down to 27. What u18g left is a list of five demands and one
 * accounting family, and u18g's own readings say why four of the five cannot be
 * derived: the successor is not written down anywhere the adapter can read it.
 * chart.js 4 turned an array of axis objects into a record keyed by axis id and
 * the key is not in the array element; ng2-charts 5 publishes no successor for
 * `Label`, `SingleDataSet` or `Color` and the compiler offers none; ngx-electron
 * 2.2.0 is a View Engine package and Angular 16 removed the tool that consumed
 * such packages; three call sites belong to three unrelated declarations that
 * each moved differently.
 *
 * The ruling this round is written to is that where a demand has no derivable
 * generic mapping, an explicit source edit is authorised, recorded per edit with
 * its file, its before, its after and the reason no capability can derive it.
 * They are called manual-migration-steps here and they are counted separately
 * from capability-driven edits everywhere in the record, because the honest
 * count of them is the fleet-relevant number: it is exactly where the tool says
 * a human has to decide.
 *
 * The discipline is capabilities first. This round adds one — `Subject<void>`,
 * which is the promise-executor movement one library over and is derivable from
 * the subject's own uses — and takes the rest as recorded accommodations. None of
 * them is in `packages/frameworks`: the payload file lives in the fixture and the
 * edit table lives here, so no application's shape has entered the product.
 *
 * Every accommodation is a literal replacement that has to match exactly once, or
 * this driver fails naming the step. That is what makes the round re-runnable:
 * an applied step no longer matches its `before`, and its `after` is checked to
 * be present instead, so a second run over the same tree changes nothing and
 * still verifies every step landed.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as path from 'pathe';
import { parameteriseVoidSubjects } from '../../../frameworks/angular/src/index.ts';
import { APPLIED_TREE, STAGE_DIRECTORY } from './angular-super-productivity-apply-run.ts';
import { applyRound, type CapabilityOutcome } from './angular-super-productivity-u18c-run.ts';

/** The repository's own fixture directory, where accommodation payloads live. */
const FIXTURE_DIRECTORY = path.resolve(
	path.dirname(new URL(import.meta.url).pathname),
	'../../../../fixtures/angular-super-productivity-v2-13-15',
);

/**
 * One explicit source edit that no capability can derive.
 *
 * `reason` is not a comment. It is the part of the record that says what was
 * looked for and not found, and it is written per step rather than per family so
 * that a reader counting manual steps can see what each one bought.
 */
export type ManualStep = Readonly<{
	id: string;
	family: string;
	file: string;
	before: string;
	after: string;
	reason: string;
}>;

export type ManualStepOutcome = Readonly<{
	id: string;
	family: string;
	file: string;
	applied: boolean;
	alreadyApplied: boolean;
	beforeLine: number | null;
	reason: string;
}>;

const CHART_OPTIONS_REASON =
	'chart.js 4 restructured the options schema. Two of the movements are renames a ' +
	'declaration could in principle carry — `legend` under `plugins`, `gridLines` to `grid`, ' +
	'`ticks.fontColor` to `ticks.color` — but the installed chart.js 4.5.1 declarations carry ' +
	'no deprecated alias, no successor annotation and no trace of the old names at all, so ' +
	'there is nothing in the tree for a capability to read the mapping off; it exists only in ' +
	"chart.js's migration prose. The reshaping is worse: `xAxes`/`yAxes` arrays became a " +
	'record keyed by axis id, and the key is not derivable from the array element. A ' +
	'capability would have to invent `x` and `y`, which is the kind of claim this adapter ' +
	'refuses everywhere else. The whole literal is therefore one manual step per site.';

const NG2_CHARTS_REASON =
	'ng2-charts 5.0.4 publishes five root exports and none of them is a successor for these ' +
	'aliases. The compiler offers none either: these are TS2305, not TS2724, so the ' +
	'suggested-export-rename capability never sees them and there is no name to carry.';

const ELECTRON_REASON =
	'ngx-electron@2.2.0 is a View Engine package — `ngx-electron.metadata.json`, no `ɵmod`, no ' +
	'partial-compilation declaration — and Angular 16 removed ngcc, the tool that used to ' +
	'compile such a package to Ivy. u18g measured this. No rewrite of application source makes ' +
	'an NgModule out of a class that has no module definition, so this is a package decision ' +
	'rather than a capability, and the decision this web lane takes is the one the ingest ' +
	'records: Electron is out of scope for the web lane, and the injectable the application ' +
	'actually uses is re-implemented locally from the installed package’s own bundle.';

/** The accommodation table. Order is the order the steps are applied in. */
export const MANUAL_STEPS: readonly ManualStep[] = Object.freeze([
	{
		id: 'chart-options-pie',
		family: 'chart.js 2 options literals',
		file: 'src/app/features/metric/metric.component.ts',
		before: `  pieChartOptions: ChartOptions = {
    responsive: true,
    legend: {
      position: 'top',
    },
  };`,
		after: `  pieChartOptions: ChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
    },
  };`,
		reason: CHART_OPTIONS_REASON,
	},
	{
		id: 'chart-options-theme',
		family: 'chart.js 2 options literals',
		file: 'src/app/core/theme/global-theme.service.ts',
		before: `      ? {
        legend: {
          labels: {fontColor: 'white'}
        },
        scales: {
          xAxes: [{
            ticks: {fontColor: 'white'},
            gridLines: {color: 'rgba(255,255,255,0.1)'}
          }],
          yAxes: [{
            ticks: {fontColor: 'white'},
            gridLines: {color: 'rgba(255,255,255,0.1)'}
          }]
        }
      }`,
		after: `      ? {
        plugins: {
          legend: {
            labels: {color: 'white'}
          }
        },
        scales: {
          x: {
            ticks: {color: 'white'},
            grid: {color: 'rgba(255,255,255,0.1)'}
          },
          y: {
            ticks: {color: 'white'},
            grid: {color: 'rgba(255,255,255,0.1)'}
          }
        }
      }`,
		reason: `${CHART_OPTIONS_REASON} The axis ids \`x\` and \`y\` written here are chart.js 4's default cartesian ids for a line chart, which is what this application's two charts are; they are a decision, and this is the record of it.`,
	},
	{
		id: 'ng2-charts-label-aliases',
		family: 'ng2-charts symbols with no successor',
		file: 'src/app/features/metric/metric.model.ts',
		before: `import {Label, SingleDataSet} from 'ng2-charts';
import {ChartDataset} from 'chart.js';`,
		after: `import {ChartDataset} from 'chart.js';

// MANUAL MIGRATION STEP (u18h): ng2-charts 5 publishes no successor for \`Label\`
// or \`SingleDataSet\`. Both were aliases in ng2-charts 2 and both are declared
// here at the shape this application actually uses them at: the pie charts pass
// string labels and number data.
export type Label = string | string[];
export type SingleDataSet = number[];`,
		reason: NG2_CHARTS_REASON,
	},
	{
		id: 'ng2-charts-colors-input',
		family: 'ng2-charts symbols with no successor',
		file: 'src/app/features/metric/metric.component.ts',
		before: `import {Color} from 'ng2-charts';
`,
		after: '',
		reason: `${NG2_CHARTS_REASON} \`Color\` is removed rather than replaced because the input it fed is gone: ng2-charts 5's BaseChartDirective declares type, legend, data, options, plugins, labels and datasets, and no \`colors\`. A per-dataset colour in chart.js 4 is a property of the dataset, so the empty array this application passed has no successor binding to be passed to.`,
	},
	{
		id: 'ng2-charts-colors-field',
		family: 'ng2-charts symbols with no successor',
		file: 'src/app/features/metric/metric.component.ts',
		before: `  lineChartColors: Color[] = [];
`,
		after: '',
		reason:
			'The field is removed with the binding that read it. It was initialised empty, so ' +
			'nothing about how these charts are coloured changes.',
	},
	{
		id: 'ng2-charts-colors-binding',
		family: 'ng2-charts symbols with no successor',
		file: 'src/app/features/metric/metric.component.html',
		before: `            <canvas [chartType]="lineChartType"
                    [colors]="lineChartColors"
`,
		after: `            <canvas [type]="lineChartType"
`,
		reason:
			'The template binding for the removed field, and the renamed input in the same tag. ' +
			"ng2-charts 5 renamed `chartType` to `type`; the rename is in the directive's own " +
			'declaration, but a template rewrite is not something this adapter does, so it is ' +
			'recorded here with the rest.',
	},
	{
		id: 'ng2-charts-pie-chart-type-1',
		family: 'ng2-charts symbols with no successor',
		file: 'src/app/features/metric/metric.component.html',
		before: `        <canvas [chartType]="pieChartType"
                [data]="improvementCounts.data"`,
		after: `        <canvas [type]="pieChartType"
                [data]="improvementCounts.data"`,
		reason:
			"The `chartType` → `type` input rename, at the first of the two pie charts. The rename is " +
			"in ng2-charts 5's own directive declaration, so it is derivable in principle — but only " +
			'by a capability that rewrites templates, which this adapter does not have.',
	},
	{
		id: 'ng2-charts-pie-chart-type-2',
		family: 'ng2-charts symbols with no successor',
		file: 'src/app/features/metric/metric.component.html',
		before: `        <canvas [chartType]="pieChartType"
                [data]="obstructionCounts.data"`,
		after: `        <canvas [type]="pieChartType"
                [data]="obstructionCounts.data"`,
		reason:
			'The `chartType` → `type` input rename, at the second of the two pie charts. Same reading ' +
			'as the first, recorded separately because it is a separate line in a separate element.',
	},
	{
		id: 'translate-http-loader-factory',
		family: 'three unrelated call sites',
		file: 'src/app/app.module.ts',
		before: `// NOTE: export required for aot to work
export function createTranslateLoader(http: HttpClient) {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

`,
		after: '',
		reason:
			'@ngx-translate/http-loader 17 declares `constructor()` and takes its HttpClient and ' +
			'its prefix/suffix from the injector, so the three-argument construction the era wrote ' +
			'is `TS2554: Expected 0 arguments, but got 3`. The successor is a provider function the ' +
			'package exports, `provideTranslateHttpLoader`, and no capability can derive that a ' +
			"constructor's parameters became a provider's configuration object — the two " +
			'declarations have no relationship the tree records.',
	},
	{
		id: 'translate-http-loader-import',
		family: 'three unrelated call sites',
		file: 'src/app/app.module.ts',
		before: `import {TranslateLoader, TranslateModule} from '@ngx-translate/core';
import {TranslateHttpLoader} from '@ngx-translate/http-loader';`,
		after: `import {TranslateModule} from '@ngx-translate/core';
import {provideTranslateHttpLoader} from '@ngx-translate/http-loader';`,
		reason:
			'The import surface the removed factory used. `TranslateLoader` was named only by the ' +
			'loader provider entry that goes with it.',
	},
	{
		id: 'translate-http-loader-module',
		family: 'three unrelated call sites',
		file: 'src/app/app.module.ts',
		before: `    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: createTranslateLoader,
        deps: [HttpClient]
      }
    }),`,
		after: '    TranslateModule.forRoot(),',
		reason:
			'The loader is provided by the provider function in the same module rather than by a ' +
			'factory entry in `forRoot`, which is the shape the package documents for 17.',
	},
	{
		id: 'translate-http-loader-provider',
		family: 'three unrelated call sites',
		file: 'src/app/app.module.ts',
		before: `    {provide: HAMMER_GESTURE_CONFIG, useClass: MyHammerConfig},
  ],`,
		after: `    {provide: HAMMER_GESTURE_CONFIG, useClass: MyHammerConfig},
    // MANUAL MIGRATION STEP (u18h): the prefix and suffix the era passed to the
    // loader's constructor, in the place version 17 reads them from.
    provideTranslateHttpLoader({prefix: './assets/i18n/', suffix: '.json'}),
  ],`,
		reason:
			"The two strings the era's constructor call carried. They are not the package's " +
			"defaults — it defaults to `/assets/i18n/`, and this application serves from `./` — so " +
			'dropping them would have changed where the translations are fetched from.',
	},
	{
		id: 'subject-next-argument',
		family: 'three unrelated call sites',
		file: 'src/app/features/config/global-config.service.ts',
		before: '',
		after: '',
		reason:
			'Answered by a capability rather than by a step. Listed here so the family stays ' +
			'countable: `subject-void-type-argument` is derivable and this site is not an ' +
			'accommodation.',
	},
	{
		id: 'selector-props-call',
		family: 'three unrelated call sites',
		file: 'src/app/features/tasks/store/task-internal.effects.ts',
		before: '      this._store$.pipe(select(selectTasksWorkedOnOrDoneFlat)),',
		after: `      // MANUAL MIGRATION STEP (u18h): the era's \`select\` overload accepted a
      // selector-with-props called with no props and passed \`undefined\` for
      // them. @ngrx/store 16 requires the argument. It is passed explicitly here
      // so that the selector receives exactly what it received before — its own
      // first line is \`if (!props) { return null; }\`.
      this._store$.pipe(select(selectTasksWorkedOnOrDoneFlat, undefined as unknown as { day: string })),`,
		reason:
			'`selectTasksWorkedOnOrDoneFlat` is a `MemoizedSelectorWithProps`, and @ngrx/store 16 ' +
			'has no overload of `select` that takes one with no props — TS2769, no overload ' +
			'matches. The mechanical answers are all wrong: making the projector parameter ' +
			'optional does not change the selector type, and passing a real `{day}` here would ' +
			'change what the effect reads. The era passed `undefined`; this passes `undefined`.',
	},
	{
		id: 'create-effect-initial-import',
		family: '@ngrx/effects createEffect result typing',
		file: 'src/app/features/google/store/google-drive-sync.effects.ts',
		before: '  initialImport$: any = createEffect(() => this._actions$.pipe(',
		after:
			'  initialImport$: any = createEffect(() => <Observable<Action>>this._actions$.pipe(',
		reason:
			"The cause is one step further back than the diagnostic: each of these pipelines ends " +
			'in a `concatMap`/`exhaustMap` whose projector is annotated `: any`, and rxjs 7 ' +
			'resolves `ObservedValueOf<any>` to `unknown`, so the pipeline is `Observable<unknown>` ' +
			'and @ngrx/effects 16 requires `Observable<Action>`. Removing the `: any` annotations ' +
			'would be a rewrite of the effect bodies with no way to predict what they infer to; ' +
			'the assertion states what the pipeline emits, which is what the field already ' +
			'declares one line above it — `: any`.',
	},
	{
		id: 'create-effect-change-sync-file',
		family: '@ngrx/effects createEffect result typing',
		file: 'src/app/features/google/store/google-drive-sync.effects.ts',
		before: '  changeSyncFile$: any = createEffect(() => this._actions$.pipe(',
		after:
			'  changeSyncFile$: any = createEffect(() => <Observable<Action>>this._actions$.pipe(',
		reason:
			'The second of the three, same shape and same reason: an `: any`-annotated projector, a ' +
			'pipeline rxjs 7 types as `Observable<unknown>`, and an effect signature that requires ' +
			'`Observable<Action>`. It is a separate step because it is a separate field.',
	},
	{
		id: 'create-effect-save',
		family: '@ngrx/effects createEffect result typing',
		file: 'src/app/features/google/store/google-drive-sync.effects.ts',
		before: '  save$: any = createEffect(() => this._actions$.pipe(',
		after: '  save$: any = createEffect(() => <Observable<Action>>this._actions$.pipe(',
		reason:
			'The third of the three, same shape and same reason. Three steps rather than one, because ' +
			'the count of manual steps is meant to say how many lines a human had to decide about.',
	},
	{
		id: 'create-effect-action-import',
		family: '@ngrx/effects createEffect result typing',
		file: 'src/app/features/google/store/google-drive-sync.effects.ts',
		before: "import {Store} from '@ngrx/store';",
		after: "import {Action, Store} from '@ngrx/store';",
		reason:
			'The type the three assertions name. It is a step rather than a capability for the same ' +
			'reason they are: the import exists only to support an edit nothing in the tree derives.',
	},
	{
		id: 'electron-module-import',
		family: 'ngx-electron is not consumable by this cell',
		file: 'src/app/features/issue/jira/jira.module.ts',
		before: `import {NgxElectronModule} from 'ngx-electron';
`,
		after: '',
		reason: ELECTRON_REASON,
	},
	{
		id: 'electron-module-entry',
		family: 'ngx-electron is not consumable by this cell',
		file: 'src/app/features/issue/jira/jira.module.ts',
		before: `    NgxElectronModule,
`,
		after: '',
		reason:
			'The import list entry the NG6002 is written at. Nothing replaces it: the service the ' +
			'module provided is `providedIn: root` in the local re-implementation, which is where ' +
			'all twenty of its consumers already inject it from.',
	},
]);

/** The relative path, from a module under `src/`, of the local electron service. */
function electronServiceSpecifier(file: string): string {
	const from = path.dirname(file);
	const to = 'src/app/core/electron/electron.service';
	const relative = path.relative(from, to);
	return relative.startsWith('.') ? relative : `./${relative}`;
}

/** Every file below `root` with `extension`, in a stable order. */
async function filesBelow(root: string, extension: string): Promise<readonly string[]> {
	const { readdir } = await import('node:fs/promises');
	const found: string[] = [];
	const walk = async (directory: string): Promise<void> => {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			const absolute = path.join(directory, entry.name);
			if (entry.isDirectory()) await walk(absolute);
			else if (entry.name.endsWith(extension)) found.push(absolute);
		}
	};
	if (existsSync(root)) await walk(root);
	return Object.freeze(found.sort());
}

/**
 * Apply one literal step, or say why it could not be applied.
 *
 * A step whose `before` is absent and whose `after` is present has already been
 * applied and the round is being re-run; that is reported and is not a failure.
 * A step that matches more than once is a failure, because a table of literal
 * edits that matches ambiguously is not a record of anything.
 */
export async function applyStep(
	step: ManualStep,
	tree: string = APPLIED_TREE,
): Promise<ManualStepOutcome> {
	if (step.before === '' && step.after === '')
		return Object.freeze({
			id: step.id,
			family: step.family,
			file: step.file,
			applied: false,
			alreadyApplied: false,
			beforeLine: null,
			reason: step.reason,
		});
	const absolute = path.join(tree, step.file);
	if (!existsSync(absolute))
		throw new Error(`u18h step ${step.id}: the applied tree carries no ${step.file}`);
	const source = await readFile(absolute, 'utf8');
	const occurrences = source.split(step.before).length - 1;
	if (occurrences === 0) {
		// A removal has no text to look for afterwards, so the absence of what it
		// removes is the whole of the evidence that it ran.
		if (step.after === '' || source.includes(step.after))
			return Object.freeze({
				id: step.id,
				family: step.family,
				file: step.file,
				applied: false,
				alreadyApplied: true,
				beforeLine: null,
				reason: step.reason,
			});
		throw new Error(
			`u18h step ${step.id}: ${step.file} carries neither the text this step replaces nor ` +
				'the text it writes, so the tree is not the tree this step was read against',
		);
	}
	if (occurrences > 1)
		throw new Error(
			`u18h step ${step.id}: ${step.file} carries the text this step replaces ` +
				`${String(occurrences)} times, and an ambiguous edit is not a recorded one`,
		);
	const line = source.slice(0, source.indexOf(step.before)).split('\n').length;
	await writeFile(absolute, source.replace(step.before, step.after));
	return Object.freeze({
		id: step.id,
		family: step.family,
		file: step.file,
		applied: true,
		alreadyApplied: false,
		beforeLine: line,
		reason: step.reason,
	});
}

/**
 * The electron accommodation's two mechanical halves: the payload file, copied
 * from the fixture, and the specifier redirect at every module that imported the
 * service from the package.
 *
 * The redirect is deliberately not a step in the table. It is one decision — the
 * package is replaced by a local service — applied at however many modules named
 * it, and listing twenty identical edits would inflate the manual-step count
 * without adding a single decision to it.
 */
export async function electronRedirect(
	tree: string = APPLIED_TREE,
): Promise<Readonly<{ payload: string; redirected: readonly string[] }>> {
	const payload = path.join(tree, 'src/app/core/electron/electron.service.ts');
	await mkdir(path.dirname(payload), { recursive: true });
	await writeFile(
		payload,
		await readFile(path.join(FIXTURE_DIRECTORY, 'accommodations/electron.service.ts'), 'utf8'),
	);
	const redirected: string[] = [];
	for (const absolute of await filesBelow(path.join(tree, 'src'), '.ts')) {
		const file = path.relative(tree, absolute);
		if (file === 'src/app/core/electron/electron.service.ts') continue;
		const source = await readFile(absolute, 'utf8');
		// Only a real import declaration is rewritten. `local-storage.ts` carries a
		// commented-out one, and a comment is not an import.
		const rewritten = source.replace(
			/^(import\s+\{[^}]*\}\s+from\s+')ngx-electron(';)$/gmu,
			`$1${electronServiceSpecifier(file)}$2`,
		);
		if (rewritten === source) continue;
		await writeFile(absolute, rewritten);
		redirected.push(file);
	}
	return Object.freeze({
		payload: 'src/app/core/electron/electron.service.ts',
		redirected: Object.freeze(redirected),
	});
}

/** The `Subject<void>` round, driven by the compiler's own TS2554 lines. */
export async function voidSubjectRound(
	log: string,
	tree: string = APPLIED_TREE,
): Promise<CapabilityOutcome> {
	const wanted = new Set<string>();
	for (const raw of log.split('\n')) {
		const line = raw.trim();
		if (!line.includes(' - error TS2554: ')) continue;
		const head = line.split(' - error TS2554: ')[0] ?? '';
		const parts = head.split(':');
		if (parts.length < 3) continue;
		wanted.add(parts.slice(0, -2).join(':').replace('Error: ', ''));
	}
	const changed: string[] = [];
	const changes: string[] = [];
	const unhandled: string[] = [];
	for (const file of [...wanted].sort()) {
		const absolute = path.join(tree, file);
		if (!existsSync(absolute) || !file.endsWith('.ts')) {
			unhandled.push(`${file}: the diagnostic names a file the applied tree does not carry`);
			continue;
		}
		const source = await readFile(absolute, 'utf8');
		const migration = parameteriseVoidSubjects(file, source);
		unhandled.push(...migration.unhandled);
		if (!migration.changed) continue;
		await writeFile(absolute, migration.source);
		changed.push(file);
		for (const change of migration.changes)
			changes.push(
				`${file} line ${String(change.line)}: new Subject(…) → new Subject<void>(…) ` +
					`(${change.binding}, ${String(change.callSites)} zero-argument next call(s))`,
			);
	}
	return Object.freeze({
		capability: `subject-void-type-argument, against ${String(wanted.size)} module(s) the compiler named`,
		filesChanged: Object.freeze(changed),
		changes: Object.freeze(changes),
		unhandled: Object.freeze(unhandled.sort()),
	});
}

export async function main(): Promise<void> {
	const log = await readFile(path.join(STAGE_DIRECTORY, process.argv[2] ?? 'build-6.log'), 'utf8');
	const outcomes: CapabilityOutcome[] = [...(await applyRound())];
	outcomes.push(await voidSubjectRound(log));

	const steps: ManualStepOutcome[] = [];
	for (const step of MANUAL_STEPS) steps.push(await applyStep(step));
	const electron = await electronRedirect();

	await writeFile(
		path.join(STAGE_DIRECTORY, 'u18h-round.json'),
		`${JSON.stringify({ capabilities: outcomes, manualSteps: steps, electron }, null, '\t')}\n`,
	);
	for (const outcome of outcomes)
		process.stdout.write(
			`${outcome.capability}: ${String(outcome.filesChanged.length)} files changed, ` +
				`${String(outcome.changes.length)} changes, ${String(outcome.unhandled.length)} refused\n`,
		);
	process.stdout.write(
		`manual-migration-steps: ${String(steps.filter((entry) => entry.applied).length)} applied, ` +
			`${String(steps.filter((entry) => entry.alreadyApplied).length)} already applied, ` +
			`${String(steps.filter((entry) => !entry.applied && !entry.alreadyApplied).length)} not a step\n`,
	);
	process.stdout.write(
		`electron redirect: ${String(electron.redirected.length)} module(s) → ${electron.payload}\n`,
	);
}

if (process.argv[1]?.endsWith('angular-super-productivity-u18h-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
