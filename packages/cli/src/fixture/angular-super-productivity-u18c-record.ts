/**
 * The u18c record of the `angular-super-productivity-v2-13-15` cell: what the
 * two owed adapter items and the closure-read capabilities moved, and what the
 * production build still demands.
 *
 * The build is still red, and this record is the red one. Every number here was
 * read from a run — the diagnostic census before is u18b's, the census after is
 * this unit's, and the difference between them is not an estimate. Every demand
 * the compiler still makes is itemised by file, symbol and library, exactly as
 * u18b itemised the list this unit worked from.
 *
 * The driver is fixture-scoped: it knows where this fixture's stage tree was
 * materialised and what the run it describes did.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { canonical, sha256 } from './angular-factoriolab-migration-run.ts';
import { sealRecord, verifySealedRecord, type SealedRecord } from './angular-factoriolab-build-lanes-run.ts';
import { CONSENT, EVIDENCE_DIRECTORY } from './angular-super-productivity-lanes-run.ts';
import { DIAGNOSTIC_COUNTS as U18B_DIAGNOSTIC_COUNTS, type BuildDemand } from './angular-super-productivity-migrated-lane-run.ts';

export const UNIT = 'lrapr-t006/u18c-fork-kind-wiring-attempt';
export const RECORD_FILE = 'u18c-capability-round.json';

/** Diagnostics this unit's build reported, counted by code from the log. */
export const DIAGNOSTIC_COUNTS: Readonly<Record<string, number>> = Object.freeze({
	NG1010: 1,
	NG6002: 21,
	NG6003: 1,
	NG8001: 11,
	NG8002: 14,
	NG8003: 3,
	NG8004: 18,
	TS1259: 1,
	TS2305: 3,
	TS2307: 1,
	TS2314: 2,
	TS2322: 7,
	TS2339: 17,
	TS2345: 1,
	TS2554: 2,
	TS2724: 2,
	TS2740: 2,
	TS2769: 1,
	TS2794: 2,
});

/** The applied manifest and the lockfile resolved from it, by digest. */
export const MIGRATED_MANIFEST_SHA256 =
	'192b9fbdea9b0cc8e95d2fc8c3acf3e6b6a45fa45561032be14f19215b477cd4';
export const LOCKFILE_SHA256 = 'b204583d165c9b3f8476181dcf8bbb9c5d23e97b90fc59de748b49b3344dfc1c';

/** What this unit added to the adapter, stated as capability rather than as fix. */
export const ADAPTER_CHANGES: readonly string[] = Object.freeze([
	'A `successor-fork` EcosystemPackage kind. It removes one package name from the manifest, writes another at the range the cell read, and hands the pair of names to the source layer as a rename. It is admitted only when the lineage verifies: the forge has to report the successor repository as a fork, of the repository the era package itself declares, read from the successor repository’s own endpoint. A disposition failing any of the three leaves the package at its era range and is reported by name — the manifest is not rewritten onto a package whose lineage the cell cannot establish.',
	'A `successor-fork-package` source capability. It renames a module specifier onto the verified successor only after measuring the successor’s published root surface against the names the declaration actually imports, and refuses per declaration and in full: a declaration naming five symbols of which four are published is left exactly as it is. A surface reading that could not be completed, a namespace or default binding, and a subpath import are three further refusals, each for the same reason — a name that was never measured is not a name that was found.',
	'The webpack tilde stylesheet capability now carries package renames. A renamed specifier is un-prefixed only when the installed closure answers the *renamed* path, which is the check the capability already performed, asked of the name that will actually be written.',
	'`entry-components-removal` is now composed into `migrateAngularCliEraWorkspace`, after the other per-module capabilities so that it reads the literal as they left it. It was written, exported and tested three units ago and never called by the era pipeline; nothing about the capability changed.',
]);

/** What the round fired, and what each capability moved in this application. */
export const CAPABILITY_OUTCOMES: readonly Readonly<Record<string, unknown>>[] = Object.freeze([
	Object.freeze({
		capability: 'entry-components-removal, composed into the era pipeline',
		firedOn: '19 @NgModule literals across 19 modules',
		filesChanged: 19,
		refused: 0,
		clearedDiagnostics:
			'TS2345 fell from 19 to 1. The one that remains is a chart options literal and is a different demand entirely.',
	}),
	Object.freeze({
		capability: 'successor-fork-package (ng-pick-datetime → @danielmoncada/angular-datetime-picker@16.1.0)',
		firedOn:
			'2 modules. The successor’s root declaration was read by following its whole-module re-exports: 35 names, complete. All three symbols this application imports — DateTimeAdapter, OwlDateTimeModule, OwlNativeDateTimeModule — are on it.',
		filesChanged: 2,
		refused: 0,
		clearedDiagnostics:
			'TS2307 fell from 3 to 1, and the NG1010 that followed the module literal that failed to resolve fell from 2 to 1.',
	}),
	Object.freeze({
		capability: 'barrel-entry-point-split (@angular/material@16.2.14)',
		firedOn:
			'10 modules, splitting the root barrel into @angular/material/dialog, /snack-bar, /core, /icon and /slide-toggle as the installed package’s own exports map and declaration files name them.',
		filesChanged: 10,
		refused: 0,
		clearedDiagnostics:
			'TS2305 fell from 17 to 3. The three that remain are ng2-charts symbols with no successor and are a different demand.',
		crossProof:
			'This capability was written for tiny-translator (Material 5 → 16) and ran here unprompted on Material 8 → 16, over an application it had never seen, with no table extended and nothing refused.',
	}),
	Object.freeze({
		capability: 'webpack-tilde-style-specifier, carrying the fork rename',
		firedOn: '1 stylesheet: the ~-prefixed picker stylesheet, renamed and un-prefixed in one edit against the path the closure carries.',
		filesChanged: 1,
		refused: 5,
		refusalsAre:
			'Five at-rules naming angular-material-css-vars/public-util and /main. The installed 5.0.3 line carries neither path, so the prefix was left on rather than moved to a different failure; the demand is itemised below.',
	}),
]);

/** Every demand the build still makes, by file, symbol and library. */
export const REMAINING_DEMANDS: readonly BuildDemand[] = Object.freeze([
	Object.freeze({
		file: 'src/app/features/metric/metric.module.ts:14, src/app/features/metric/metric.model.ts:2-3, src/app/features/metric/metric.component.ts:2-4, src/app/core/theme/global-theme.service.ts:14 and :163',
		symbol: 'ChartsModule, Label, SingleDataSet, Color from ng2-charts; ChartDataSets from chart.js; the ChartOptions literal',
		library: 'ng2-charts 2.3 → 5.0.4 and chart.js 2.8 → 4.5.1',
		observed:
			"metric.module.ts:14:9 - error TS2724: '\"ng2-charts\"' has no exported member named 'ChartsModule'. Did you mean 'NgChartsModule'? (2 TS2724, 3 TS2305, 1 TS2345)",
		neededTransform:
			'Unchanged from u18b and unattempted here. Two of the five shapes are renames the installed type surface itself names; the other three are deletions without successors and a restructured chart configuration schema, which are call-site rewrites rather than renames. The whole NG6002/NG8001/NG8002/NG8003/NG8004 template census below is downstream of this one module failing to compile: the metric module is unresolvable, so every component it declares loses its directives and pipes.',
	}),
	Object.freeze({
		file: 'src/app/ui/duration/input-duration-formly/input-duration-formly.component.ts:11, src/app/features/config/keyboard-input/keyboard-input.component.ts:11, :15, :53 and its template',
		symbol: 'class … extends FieldType; this.to; this.formControl; this.field; this.id',
		library: '@ngx-formly/core 5.2 → 7.1',
		observed:
			"keyboard-input.component.ts:11:45 - error TS2314: Generic type 'FieldType<F>' requires 1 type argument(s). (2 TS2314, 2 TS2740, 5 template TS2339)",
		neededTransform:
			'Unchanged from u18b and unattempted here. A type-position edit (the missing type argument) and a member rename on `this` (to → props), neither of which is a specifier rewrite. The five template TS2339 are new to this census only because the template type-checker now reaches this component at all; they are the same demand.',
	}),
	Object.freeze({
		file: 'src/app/features/issue/github/github-issue/store/github-issue.reducer.ts:155, src/app/features/issue/jira/jira-issue/store/jira-issue.reducer.ts:153',
		symbol: 'adapter.addAll(…)',
		library: '@ngrx/entity 8.3 → 16.3',
		observed:
			"github-issue.reducer.ts:155:33 - error TS2339: Property 'addAll' does not exist on type 'EntityAdapter<…>'. (2 TS2339)",
		neededTransform:
			'Unchanged from u18b and unattempted here, for budget rather than for tractability: it is a member rename on a value whose type the adapter can resolve, and it remains the smallest unanswered demand in this list.',
	}),
	Object.freeze({
		file: 'src/app/features/issue/jira/jira-api.service.ts:22',
		symbol: "import { … } from 'rxjs/internal-compatibility'",
		library: 'rxjs 6.5 → 7.8',
		observed: "jira-api.service.ts:22:27 - error TS2307: Cannot find module 'rxjs/internal-compatibility'.",
		neededTransform:
			'Unchanged from u18b and unattempted here. The RxJS table collapses the deep *type* modules onto the package root; this entry point is not one of them, and what it exported has no single successor until the symbols this module names are read against the installed root surface.',
	}),
	Object.freeze({
		file: 'src/_variables.scss:2, src/styles/themes.scss:1 and :2, src/app/features/tasks/task/task.component.scss:2, src/app/pages/work-view/backlog/backlog.component.scss:2',
		symbol: "@import '~angular-material-css-vars/public-util' and '~angular-material-css-vars/main'",
		library: 'angular-material-css-vars 2.x → 5.0.3',
		observed:
			'Refused by the tilde capability: the installed closure carries no file sass would resolve angular-material-css-vars/public-util to. No build diagnostic — the sass compiler was never reached, because the TypeScript program failed first.',
		neededTransform:
			'The package restructured its published sass entry points between the era line and 5.0.3. This is the same shape as the Material barrel split one layer down — a subpath the installed package publishes under a different path — and the answer is a reading of what the installed package carries, not a table. It is discovered here rather than guessed: the capability refused, by name, five times.',
	}),
	Object.freeze({
		file: 'src/app/features/google/store/google-drive-sync.effects.ts:84, :116, :223',
		symbol: 'createEffect(() => …, { dispatch: false })',
		library: '@ngrx/effects 8.3 → 16.3',
		observed:
			"google-drive-sync.effects.ts:84:44 - error TS2322: Type 'Observable<unknown>' is not assignable to type 'EffectResult<…>'. (3 TS2322)",
		neededTransform:
			'Downstream of the createEffect migration that already ran over this application’s twenty effect files: the wrapper is correct and the effect body’s inferred type is not. Whether the cause is the body or the surrounding module’s other failures is not established here, and a rewrite that guessed would be a rewrite of application logic.',
	}),
	Object.freeze({
		file: 'src/app/app.module.ts:41, src/app/features/config/global-config.service.ts:88, src/app/features/issue/jira/jira.module.ts:16',
		symbol: 'a three-argument call the module now declares as taking none; a zero-argument call that now takes one; NgxElectronModule',
		library: 'Angular 8 → 16 across three unrelated declarations',
		observed:
			"app.module.ts:41:34 - error TS2554: Expected 0 arguments, but got 3. / global-config.service.ts:88:28 - error TS2554: Expected 1 arguments, but got 0. / jira.module.ts:16:5 - error NG6002: 'NgxElectronModule' does not appear to be an NgModule class.",
		neededTransform:
			'Three separate call-site demands, unattempted. The NgxElectronModule one is a reading this unit did not take: ngx-electron 2.2.0 is the line the cell aligned, and whether it publishes an Ivy-compatible module at that line is a measurement, not a guess.',
	}),
	Object.freeze({
		file: 'src/app/features/worklog/worklog-export/worklog-export.component.ts:15, src/app/features/google/google-api.service.ts:143 and :150',
		symbol: "import Clipboard from 'clipboard'; new Promise<…>(resolve => resolve())",
		library: 'TypeScript 3.5 → 5.1',
		observed:
			"worklog-export.component.ts:15:8 - error TS1259 … can only be default-imported using the 'allowSyntheticDefaultImports' flag / google-api.service.ts:143:9 - error TS2794 (2 TS2794)",
		neededTransform:
			'Unchanged from u18b and unattempted here: a tsconfig decision the workspace capability has to make explicitly, and a two-line call-site edit.',
	}),
]);

export function buildRecord(): SealedRecord {
	const before = Object.values(U18B_DIAGNOSTIC_COUNTS).reduce((sum, count) => sum + count, 0);
	const after = Object.values(DIAGNOSTIC_COUNTS).reduce((sum, count) => sum + count, 0);
	return sealRecord({
		schemaVersion: 'versionless.angular-super-productivity-capability-round.v1',
		unit: UNIT,
		consentId: CONSENT,
		result: 'capabilities-fired-build-red-itemised',
		meaning:
			'The two adapter items u18b owed exist and fired, two closure-read capabilities fired beside them, and the production build was run again on the result. It is still red, and this record is the red one: every diagnostic family that cleared is named with its before and after count, and every demand that remains is itemised. No demand was answered by an edit this record does not name, and no artifact was emitted.',
		previous: 'u18b-migrated-lane.json',
		changeset: 'u18-composed-changeset.json',
		tree: {
			stage: '.versionless/stage/angular-super-productivity-v2-13-15-u18b',
			applied: '.versionless/stage/angular-super-productivity-v2-13-15-u18b/app',
			from: '.versionless/cache/angular-super-productivity-v2-13-15-source/verify/extracted',
			commit: '2943c5c4f13c3ce4dece0abf4f9c39739dde4192',
			reuse:
				'The stage tree u18b staged was reused rather than re-materialised, and the recomposed changeset was written over it from the pinned source. Every file the changeset changes is rewritten from the pristine tree on each application, so the bytes here are the composition’s and not a residue of the previous attempt.',
		},
		cell: {
			node: 'v16.20.2',
			architecture: 'darwin-arm64, native — no translation layer',
			npm: '8.19.4',
			builder: '@angular-devkit/build-angular:browser (Angular 16.2)',
			environment: { NG_CLI_ANALYTICS: 'false' },
		},
		acquisition: {
			purpose:
				'Install the one package the updated manifest newly names: the successor fork the cell now writes in place of ng-pick-datetime.',
			consentId: CONSENT,
			networkMode: 'consented',
			method: 'npm install --no-audit --no-fund --ignore-scripts, into the closure u18b already resolved.',
			outcome: 'succeeded',
			exitStatus: 0,
			packagesAdded: 1,
			hosts: ['registry.npmjs.org'],
			warningKinds: ['EBADENGINE'],
			migratedManifestSha256: MIGRATED_MANIFEST_SHA256,
			lockfileSha256: LOCKFILE_SHA256,
		},
		adapterChanges: ADAPTER_CHANGES,
		capabilityOutcomes: CAPABILITY_OUTCOMES,
		applicationFilesChanged: {
			composedChangeset: 40,
			composedChangesetScanned: 494,
			capabilityRound: 12,
			union: 51,
			meaning:
				'The composed changeset rewrote 40 of the 494 application files it scanned, against 20 in u18b; the difference is the entry-components wiring. The capability round then rewrote 12 files, 11 of which the changeset had already touched — 51 distinct application files carry an edit from this unit. Every count is of files a transform rewrote, not of files that were scanned.',
		},
		build: {
			command:
				'node --max_old_space_size=4096 ./node_modules/@angular/cli/bin/ng.js build --configuration production',
			exitStatus: 1,
			artifactsEmitted: 0,
			diagnosticCountsBefore: U18B_DIAGNOSTIC_COUNTS,
			diagnosticCounts: DIAGNOSTIC_COUNTS,
			diagnosticTotalBefore: before,
			diagnosticTotal: after,
			cleared: {
				TS2345: '19 → 1 (entry components)',
				TS2305: '17 → 3 (Material barrel split)',
				TS2307: '3 → 1 (successor fork)',
				NG1010: '2 → 1',
				NG6001: '3 → 0',
				NG6002: '87 → 21',
				NG2003: '5 → 0',
				NG8001: '31 → 11',
				NG8002: '28 → 14',
				NG8004: '29 → 18',
			},
			rose: {
				TS2339:
					'10 → 17, and the rise is not a regression. The template type-checker now reaches the formly component whose base class is unparameterised, so five member accesses that were previously behind an unresolvable module are now diagnosed by name. The demand is the same one u18b itemised; more of it is visible.',
				TS2322: '6 → 7, for the same reason: an effects module the compiler now reaches.',
			},
		},
		remainingDemands: REMAINING_DEMANDS,
		notEstablished: [
			'The build is red. No artifact was emitted, nothing was executed, and no parity or determinism statement against the era lane is possible or attempted.',
			'A diagnostic census is not a measure of remaining work. The template families are downstream of a single unresolvable module and will move together when it resolves; a total that fell from ' +
				`${String(before)} to ${String(after)} says what the compiler reported twice, and nothing more.`,
			'The successor fork’s used surface resolves and its stylesheet path exists. Nothing here establishes that the fork renders or behaves as the era package did, and no browser opened anything.',
			'The five refused tilde at-rules are a demand this unit discovered and did not answer. Nothing establishes what the installed angular-material-css-vars publishes in place of the paths the application names.',
			'The era lane’s recorded Sass random() nondeterminism is untouched. No source was seeded, neutralised or modified to make any comparison easier.',
		],
	});
}

export async function main(): Promise<void> {
	const record = verifySealedRecord(buildRecord());
	await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
	await writeFile(path.join(EVIDENCE_DIRECTORY, RECORD_FILE), canonical(record));
	process.stdout.write(
		`u18c ${String(record['result'])}: ${String(REMAINING_DEMANDS.length)} demands remain; ` +
			`record digest ${sha256(canonical(record)).slice(0, 12)}\n`,
	);
}

if (process.argv[1]?.endsWith('angular-super-productivity-u18c-record.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
