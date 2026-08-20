/**
 * The migrated lane of the `angular-super-productivity-v2-13-15` cell: the
 * Angular 16.2 closure installed into the applied tree, and the production
 * build attempted on it.
 *
 * u18 recorded the era lane and composed the changeset. This driver records
 * what happened when that changeset was written into a tree, a closure was
 * installed for it, and `@angular-devkit/build-angular:browser` was asked to
 * build it.
 *
 * The build is red, and the record is the red one. Every demand the resolver,
 * the compiler and the template type-checker made is itemised below by file,
 * symbol, library and the transform that would answer it — not summarised, not
 * counted, not softened. That list is the specification for the next unit; a
 * green lane invented here would have destroyed it.
 *
 * The driver is fixture-scoped: it knows where this fixture's stage tree was
 * materialised and what the run it describes did. Every decision about *what to
 * change* lives in `@versionless/angular`, which knows nothing about this
 * application.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { canonical, sha256 } from './angular-factoriolab-migration-run.ts';
import {
	sealRecord,
	verifySealedRecord,
	type SealedRecord,
} from './angular-factoriolab-build-lanes-run.ts';
import { CONSENT, EVIDENCE_DIRECTORY } from './angular-super-productivity-lanes-run.ts';
import { UNIT } from './angular-super-productivity-apply-run.ts';

export const MIGRATED_LANE_FILE = 'u18b-migrated-lane.json';

/** A demand the lane made, stated so that answering it needs nothing else. */
export type BuildDemand = Readonly<{
	/** Where the demand is, workspace-relative. */
	file: string;
	/** The symbol, specifier or option the lane could not satisfy. */
	symbol: string;
	/** The library or toolchain whose change created the demand. */
	library: string;
	/** The diagnostic, quoted from the log. */
	observed: string;
	/** What would have to change, stated as a transform rather than a fix. */
	neededTransform: string;
}>;

/**
 * The two demands this unit answered, and where the answer lives.
 *
 * Both are cell dispositions — registry readings written into
 * `ANGULAR_16_ECOSYSTEM_PACKAGES` — rather than anything this driver knows. They
 * are recorded here because they were *discovered* by running the resolver, one
 * at a time, on a closure that would not resolve without them.
 */
export const ANSWERED_BEFORE_BUILD: readonly BuildDemand[] = Object.freeze([
	Object.freeze({
		file: 'package.json',
		symbol: 'devDependencies.jasmine-marbles ^0.5.0',
		library: 'jasmine-marbles 0.5.0 → 0.9.2, against rxjs ~7.8.0',
		observed:
			'npm ERR! ERESOLVE unable to resolve dependency tree / Found: rxjs@7.8.2 … Could not resolve dependency: peer rxjs@"^6.4.0" from jasmine-marbles@0.5.0',
		neededTransform:
			'u18 left jasmine-marbles at its era range and reported it unhandled, because it is a test-toolchain package the Angular line does not generate. That reading was true and insufficient: the package declares a peer on rxjs, which *is* a range this cell writes, so an era range is not a neutral choice but an unresolvable closure. The cell now reads it as a community package — 0.9.2 declares peer rxjs ^7.0.0 — and the disposition is in the table, not in this driver.',
	}),
	Object.freeze({
		file: 'package.json',
		symbol: 'devDependencies.chart.js ^2.8.0',
		library: 'chart.js 2.8.0 → 4.5.1, forced by the peer of an already-aligned package',
		observed:
			'peer chart.js "^3.4.0 || ^4.0.0" from ng2-charts@5.0.4, which u18 had already aligned this workspace onto',
		neededTransform:
			"The cell aligned ng2-charts and left chart.js outside its tables, which is a manifest that names two majors of one charting stack. chart.js declares no peers and no engines.node, so the cell's own rule picks its newest line, 4.5.1. This is a version reading and not a source claim: the type surface chart.js 2 published is gone, and the call sites that name it are itemised below rather than rewritten.",
	}),
]);

/**
 * Every demand the Angular 16.2 build made, read from the build log.
 *
 * The diagnostic counts are quoted as the compiler reported them, and the
 * families are stated separately because they are independent of each other.
 * The template-level families (NG8001, NG8002, NG8003, NG8004, NG6002) are
 * downstream of the module-level ones and are not counted as separate work.
 */
export const BUILD_DEMANDS: readonly BuildDemand[] = Object.freeze([
	Object.freeze({
		file: 'src/app/core-ui/side-nav/side-nav.component.ts, src/app/core/language/language.service.ts, src/app/core/snack/snack.service.ts, src/app/core/theme/global-theme.service.ts, src/app/features/task-repeat-cfg/dialog-edit-task-repeat-cfg/dialog-edit-task-repeat-cfg.component.ts, src/app/features/task-repeat-cfg/task-repeat-cfg.service.ts, src/app/pages/config-page/config-page.component.ts, src/app/pages/schedule-page/schedule-page.component.ts, src/app/ui/dialog-fullscreen-markdown/dialog-fullscreen-markdown.component.ts, src/app/ui/inline-markdown/inline-markdown.component.ts, src/app/ui/ui.module.ts — eleven modules name the barrel',
		symbol: "import { … } from '@angular/material' — DateAdapter, MAT_DIALOG_DATA, MatDialog, MatDialogRef, MatIconRegistry, MatSlideToggleChange, MatSnackBar, MatSnackBarRef, SimpleSnackBar and their siblings",
		library: '@angular/material 8.2 → 16.2',
		observed:
			"src/app/core/snack/snack.service.ts:9:9 - error TS2305: Module '\"@angular/material\"' has no exported member 'MatSnackBar'. (17 TS2305 across eleven modules)",
		neededTransform:
			'Angular Material 9 removed the top-level barrel and publishes one secondary entry point per component — `@angular/material/dialog`, `@angular/material/snack-bar`, `@angular/material/core` and their siblings. Each barrel import has to be split into the entry points that own the symbols it names, and the split is a reading of the installed package rather than a table an adapter can carry: the mapping from symbol to entry point is what @angular/material publishes in its own type surface. This is the same demand the tiny-translator lane itemised, on a second application — the cross-proof is that the demand is a property of the library hop and not of either application.',
	}),
	Object.freeze({
		file: 'src/app/ui/ui.module.ts:61, src/app/core/language/language.service.ts:3, src/styles.scss:7',
		symbol: "import { OwlDateTimeModule, OwlNativeDateTimeModule } from 'ng-pick-datetime'; import { DateTimeAdapter } from 'ng-pick-datetime'; @import \"~ng-pick-datetime/assets/style/picker.min.css\"",
		library:
			'ng-pick-datetime 7.0.0 → @danielmoncada/angular-datetime-picker 16.1.0 (successor fork)',
		observed:
			"src/app/ui/ui.module.ts:61:58 - error TS2307: Cannot find module 'ng-pick-datetime' or its corresponding type declarations. (2 TS2307, plus the NG1010 and NG6002 that follow from the module literal that fails to resolve)",
		neededTransform:
			'A `successor-fork` cell disposition, which this cell does not yet carry as a kind: u18 read ng-pick-datetime as `no-successor` and dropped it. The lineage was verified rather than assumed and the reading is recorded in `forkProvenance` below, together with the surface measurement. Given a verifiable fork whose root entry point still exports the three symbols this application names, the source edit is a generic module-specifier rename — the same shape the zone.js and RxJS-5 tables already perform — plus the same rename inside the webpack `~` stylesheet specifier, which the tilde capability already understands. What is missing is the disposition kind that would drive it: an `EcosystemPackage` that removes one package name, writes another, and hands the rename to the source pass.',
	}),
	Object.freeze({
		file: 'src/app/features/metric/metric.module.ts:14, src/app/features/metric/metric.model.ts:2-3, src/app/features/metric/metric.component.ts:2-4, src/app/core/theme/global-theme.service.ts:14 and :163',
		symbol: "ChartsModule, Label, SingleDataSet, Color from 'ng2-charts'; ChartDataSets from 'chart.js'; the ChartOptions object literal passed to the chart theme",
		library: 'ng2-charts 2.3 → 5.0.4 and chart.js 2.8 → 4.5.1',
		observed:
			"src/app/features/metric/metric.module.ts:14:9 - error TS2724: '\"ng2-charts\"' has no exported member named 'ChartsModule'. Did you mean 'NgChartsModule'? / metric.model.ts:3:9 - error TS2724: '\"chart.js\"' has no exported member named 'ChartDataSets'. Did you mean 'ChartDataset'? / metric.model.ts:2:9 - error TS2305: … no exported member 'Label' … 'SingleDataSet' / metric.component.ts:4:9 - error TS2305: … no exported member 'Color' / global-theme.service.ts:163:52 - error TS2345: Argument of type '{ legend: { labels: { fontColor: string; }; }; scales: { xAxes: […]; yAxes: […]; }; }' is not assignable to parameter of type '_DeepPartialObject<CoreChartOptions<…> & …>'",
		neededTransform:
			'Measured before anything was proposed, and the measurement splits the demand in two. Two of the five shapes are renames the compiler itself resolves — `ChartsModule` → `NgChartsModule` and `ChartDataSets` → `ChartDataset`, both quoted above as the successor the installed type surface names — and a renamed-export table entry keyed by (specifier, symbol) is exactly the shape the adapter already carries for `@angular/core/testing`. The other three are not renames and must not be guessed: `Label`, `SingleDataSet` and `Color` were deleted from ng2-charts without successors (a label is `string | string[]`, a single data set is `number[]`, and per-dataset colour moved onto the dataset object in chart.js 3), and the options literal at global-theme.service.ts:163 is a chart.js 2 shape — `legend` moved under `plugins`, and the `scales.xAxes`/`yAxes` arrays became a keyed object. Those are call-site rewrites against a restructured configuration schema, and they are demanded here rather than performed: a speculative major-bump rewrite of a chart configuration is exactly the kind of edit that compiles and then draws the wrong chart.',
	}),
	Object.freeze({
		file: 'src/app/ui/duration/input-duration-formly/input-duration-formly.component.ts:11, src/app/features/config/keyboard-input/keyboard-input.component.ts:11 and :15 and :53, src/app/ui/ui.module.ts:85 and :142',
		symbol: 'class … extends FieldType; this.to; this.formControl',
		library: '@ngx-formly/core 5.2 → 7.1',
		observed:
			"keyboard-input.component.ts:11:45 - error TS2314: Generic type 'FieldType<F>' requires 1 type argument(s). / keyboard-input.component.ts:15:17 - error TS2339: Property 'to' does not exist on type 'KeyboardInputComponent'. / ui.module.ts:85:9 - error TS2740: Type 'typeof InputDurationFormlyComponent' is missing the following properties from type 'Type<FieldType<FormlyFieldConfig<…>>>'",
		neededTransform:
			'Formly 6 made `FieldType` generic in its field configuration and renamed the templateOptions accessor `to` to `props`. The type argument is a mechanical addition — `FieldType<FormlyFieldConfig>` — but it is a *type-position* edit the adapter carries no capability for, and the `to` → `props` move is a member-access rewrite on `this`, not a specifier rewrite. The TS2740 and TS2322 in ui.module.ts are downstream of the unparameterised base class and are not separate work.',
	}),
	Object.freeze({
		file: 'src/app/features/issue/github/github-issue/store/github-issue.reducer.ts:155, src/app/features/issue/jira/jira-issue/store/jira-issue.reducer.ts:153',
		symbol: 'adapter.addAll(…)',
		library: '@ngrx/entity 8.3 → 16.3',
		observed:
			"github-issue.reducer.ts:155:33 - error TS2339: Property 'addAll' does not exist on type 'EntityAdapter<…>'. (2 TS2339)",
		neededTransform:
			"ngrx 8 renamed the whole-collection entity operations in the 9 line: `addAll` became `setAll`, `addMany` kept its name, and `removeAll` stayed. This is a member rename on a value whose type the adapter can resolve — the same binding-resolved shape as the createEffect migration that already ran over this application's twenty effect files — and it is the smallest unanswered demand in this list.",
	}),
	Object.freeze({
		file: 'src/app/features/issue/jira/jira-api.service.ts:22',
		symbol: "import { … } from 'rxjs/internal-compatibility'",
		library: 'rxjs 6.5 → 7.8',
		observed:
			"jira-api.service.ts:22:27 - error TS2307: Cannot find module 'rxjs/internal-compatibility' or its corresponding type declarations.",
		neededTransform:
			"RxJS 7 removed the `rxjs/internal-compatibility` entry point that RxJS 6 shipped as a bridge for RxJS 5 consumers. The adapter's RxJS table collapses the *deep type modules* (`rxjs/Observable` and its siblings) onto the package root, and this specifier is not one of them: what it exported has no single successor, so it is a demand rather than a table entry until the symbols this module names are read.",
	}),
	Object.freeze({
		file: 'src/app/core/snack/snack.module.ts:16, src/app/features/attachment/attachment.module.ts:26, src/app/features/bookmark/bookmark.module.ts:26, src/app/features/google/google.module.ts:25 and fifteen more module literals',
		symbol: 'entryComponents: [ … ] inside an @NgModule literal',
		library: 'Angular 8 → 16 (the property was removed from the NgModule type in 13)',
		observed:
			"snack.module.ts:16:3 - error TS2345: Argument of type '{ imports: …; declarations: …; entryComponents: (typeof SnackCustomComponent)[]; }' is not assignable to parameter of type 'NgModule'. (19 TS2345)",
		neededTransform:
			'This one is not a missing capability. `@versionless/angular` already carries `entry-components-removal`, which drops the property after proving every component it names is reachable from the same literal — and it is exported from the package index but is *not called by* `migrateAngularCliEraWorkspace`, so the composed changeset never ran it. The demand is a wiring demand: compose the existing capability into the era migration pipeline, and let it refuse per literal where the proof fails. Nineteen module literals in this application are waiting on that one edit.',
	}),
	Object.freeze({
		file: 'src/app/features/worklog/worklog-export/worklog-export.component.ts:15, src/app/features/google/google-api.service.ts:143 and :150',
		symbol: "import Clipboard from 'clipboard'; new Promise<…>(resolve => resolve())",
		library: 'TypeScript 3.5 → 5.1',
		observed:
			"worklog-export.component.ts:15:8 - error TS1259: Module '\"…/node_modules/clipboard/src/clipboard\"' can only be default-imported using the 'allowSyntheticDefaultImports' flag / google-api.service.ts:143:9 - error TS2794: Expected 1 arguments, but got 0. Did you forget to include 'void' in your type argument to 'Promise'? (2 TS2794)",
		neededTransform:
			'Two compiler-line demands with different owners. TS1259 is a workspace decision — the tsconfig the cell writes does not set `allowSyntheticDefaultImports`, and the Angular 16 `ng new` tsconfig does not either; whether to set it or to rewrite the import to a namespace import is a call the tsconfig capability has to make explicitly rather than by omission. TS2794 is a TypeScript 4.1 strictness change about resolving a `Promise<T>` with no argument, and the edit is a call-site one at two lines.',
	}),
]);

/**
 * The fork lineage, verified from registry and repository metadata under the
 * run's consent rather than assumed from the package's name.
 */
export const FORK_PROVENANCE = Object.freeze({
	eraPackage: 'ng-pick-datetime',
	eraLatest: '7.0.0, published 2018-10-21, peer @angular/cdk "^7.0.0"',
	eraRepository:
		'git+https://github.com/DanielYKPan/date-time-picker.git, as the era package declares it',
	successorPackage: '@danielmoncada/angular-datetime-picker',
	successorRepository:
		'git+https://github.com/danielmoncada/date-time-picker.git, as the successor package declares it',
	lineage:
		'api.github.com/repos/danielmoncada/date-time-picker reports fork: true with parent and source both DanielYKPan/date-time-picker — the exact repository the era package names. The fork was created 2020-02-10 and the first release under the new name, 9.0.1, was published 2020-02-11. This is a verified continuation of the same source tree, not a same-description coincidence.',
	chosenRange: '^16.1.0',
	rangeReading:
		'16.1.0 declares peer @angular/cdk, @angular/core and @angular/common "^13.0.3 || ^14.0.0 || ^15.0.0 || ^16.0.0" and dependency tslib ^2.3.1, all satisfied by this cell. 16.0.0 stops at ^15, and 17.0.0 declares ^17.0.0 across the three, so 16.1.0 is the newest line this cell can accept.',
	surfaceMeasurement:
		"Measured against the installed package, not assumed. The three symbols this application imports — OwlDateTimeModule, OwlNativeDateTimeModule, DateTimeAdapter — are all exported from the fork's root `public_api.d.ts` at 16.1.0, and the stylesheet the application imports by path, assets/style/picker.min.css, is present at the same path in the published tarball. The rename is therefore generic at the used surface: a module-specifier substitution and the same substitution inside the `~`-prefixed stylesheet specifier.",
	notEstablished:
		'A matching export list is not a behavioural equivalence. Nothing here establishes that the fork renders or behaves as the era package did; the used symbols resolve, and that is the whole claim.',
});

export type LaneInput = Readonly<{
	nodeVersion: string;
	npmVersion: string;
	installedPackages: number;
	manifestSha256: string;
	lockfileSha256: string;
	buildExitStatus: number;
	diagnosticCounts: Readonly<Record<string, number>>;
	artifactsEmitted: number;
}>;

export function buildMigratedLaneRecord(input: LaneInput): SealedRecord {
	return sealRecord({
		schemaVersion: 'versionless.angular-super-productivity-migrated-lane.v1',
		unit: UNIT,
		consentId: CONSENT,
		result: 'closure-resolved-build-red-itemised',
		meaning:
			'The migrated manifest the cell produces resolves and installs on the Angular 16.2 line, once two dispositions this lane discovered by running the resolver are added to the cell. The production build was then run and is recorded as it happened: red, with every demand the compiler and the template type-checker made itemised. No demand was answered by an edit this record does not name, and no artifact was emitted.',
		changeset: 'u18-composed-changeset.json',
		appliedChangeset: 'u18b-source-migration.json',
		eraLane: 'u18-era-baseline.json',
		cell: {
			node: input.nodeVersion,
			architecture: 'darwin-arm64, native — no translation layer',
			npm: input.npmVersion,
			builder: '@angular-devkit/build-angular:browser (Angular 16.2)',
			environment: { NG_CLI_ANALYTICS: 'false' },
			runtimeProvenance:
				'The Node 16.20.2 runtime already materialised in this checkout for the Angular 16 cell at .versionless/cache/angular-jira-clone-runtime. The cell is the same one; the runtime was not re-acquired.',
		},
		tree: {
			stage: '.versionless/stage/angular-super-productivity-v2-13-15-u18b',
			applied: '.versionless/stage/angular-super-productivity-v2-13-15-u18b/app',
			from: '.versionless/cache/angular-super-productivity-v2-13-15-source/verify/extracted',
			commit: '2943c5c4f13c3ce4dece0abf4f9c39739dde4192',
		},
		acquisition: {
			purpose:
				'Install the declared Angular 16.2 dependency closure the migrated manifest asks for.',
			consentId: CONSENT,
			networkMode: 'consented',
			method: 'npm install --no-audit --no-fund --ignore-scripts. The era yarn.lock was removed from the stage tree first: it pins the 2019 Angular 8 closure, npm does not read it, and leaving it beside an Angular 16 manifest would describe a tree that does not exist. Lifecycle scripts are disabled for the same reason the era lane disabled them — the manifest carries node-sass ^4.12.0, whose postinstall fetches or compiles a native binding — and the same non-claim follows: nothing here establishes what a scripted install would do.',
			outcome: 'succeeded',
			exitStatus: 0,
			packagesInstalled: input.installedPackages,
			migratedManifestSha256: input.manifestSha256,
			lockfileSha256: input.lockfileSha256,
			hosts: ['registry.npmjs.org'],
			warningKinds: ['EBADENGINE'],
			firstAttempt:
				"The first install attempt failed. npm reported ERESOLVE on jasmine-marbles@0.5.0 (peer rxjs ^6.4.0) against the rxjs ~7.8.0 the cell writes, and a second conflict — chart.js ^2.8.0 against ng2-charts@5.0.4 (peer chart.js ^3.4.0 || ^4.0.0) — followed it. Both are recorded in `answeredBeforeBuild` and both are answered in the cell's ecosystem table, not here.",
			divergenceFromChangeset:
				"The installed closure additionally named @danielmoncada/angular-datetime-picker ^16.1.0, which the changeset does not write: it was installed so the fork's published surface could be measured against the symbols this application imports. That measurement is in `forkProvenance`. The manifest recorded by digest here is the changeset's own, without that package, and the build below therefore reports ng-pick-datetime as unresolvable — which is the truthful state of the changeset as it stands.",
		},
		registryReads: {
			consentId: CONSENT,
			networkMode: 'consented',
			hosts: ['registry.npmjs.org', 'api.github.com'],
			purpose:
				"Read the published lines and declared peers of jasmine-marbles, chart.js, ng2-charts-schematics, node-sass, sass-loader, style-loader, karma-cli, karma-coverage-istanbul-reporter and @biesbjerg/ngx-translate-extract, and verify the ng-pick-datetime fork lineage from both packages' declared repositories and the GitHub fork relation between them.",
			outcome: 'succeeded',
		},
		build: {
			command:
				'node --max_old_space_size=4096 ./node_modules/@angular/cli/bin/ng.js build --configuration production',
			commandNote:
				"The era lane ran the repository's own `buildFrontend` — the same command with `--aot --prod`. The 16.2 CLI removed `--prod` in favour of the named configuration and AOT is unconditional, so the flag pair is spelled as the modern CLI spells it and nothing else about the invocation changed.",
			exitStatus: input.buildExitStatus,
			artifactsEmitted: input.artifactsEmitted,
			diagnosticCounts: input.diagnosticCounts,
			firstAttempt:
				'The first build attempt did not reach the compiler. `An unhandled exception occurred: Schema validation failed with the following errors: Data path "" must NOT have additional properties(evalSourceMap)` — the 16.2 browser-builder schema rejects the option outright, so one surviving era option is not a warning but the whole build. `evalSourceMap` and its sibling `vendorSourceMap` are now in the workspace migration\'s removed-option table, which is why the second attempt reached the compiler at all.',
		},
		answeredBeforeBuild: ANSWERED_BEFORE_BUILD,
		demands: BUILD_DEMANDS,
		forkProvenance: FORK_PROVENANCE,
		crossProof:
			'The @angular/material root-barrel demand is now measured on two independent applications — tiny-translator (Material 5 → 16) and this one (Material 8 → 16) — with the same shape and the same refusal to carry a symbol-to-entry-point table the library itself publishes. The ngrx createEffect migration went the other way: it was written for a previous application and ran here unprompted over twenty effect files of an application it had never seen, which is the movement this cell was chosen to exercise.',
		notEstablished: [
			'The build is red. No artifact was emitted, nothing was executed, and no parity statement against the era lane is possible or attempted.',
			"The era lane's recorded Sass random() nondeterminism is a property of the application, not of either toolchain, and it is untouched: no source was seeded, neutralised or modified to make any comparison easier. Determinism-modulo that cause is a measurement this lane never reached, because a red build emits nothing to compare.",
			'The diagnostic counts are what the compiler reported in one run of one configuration. They are a census of demands, not an estimate of remaining work: the template-level families are downstream of the module-level ones and answering a module demand removes many of them at once.',
			'`packagesInstalled` counts what npm reported adding with lifecycle scripts disabled. Nothing here establishes that a scripted install of the same manifest succeeds, and node-sass ^4.12.0 in particular is carried into no claim.',
		],
	});
}

export async function main(): Promise<void> {
	const record = verifySealedRecord(
		buildMigratedLaneRecord({
			nodeVersion: 'v16.20.2',
			npmVersion: '8.19.4',
			installedPackages: 2242,
			manifestSha256: MIGRATED_MANIFEST_SHA256,
			lockfileSha256: LOCKFILE_SHA256,
			buildExitStatus: 1,
			diagnosticCounts: DIAGNOSTIC_COUNTS,
			artifactsEmitted: 0,
		}),
	);
	await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
	await writeFile(path.join(EVIDENCE_DIRECTORY, MIGRATED_LANE_FILE), canonical(record));
	process.stdout.write(
		`migrated lane ${String(record['result'])}: ${String(BUILD_DEMANDS.length)} demands itemised, ` +
			`${String(ANSWERED_BEFORE_BUILD.length)} answered before the build; record digest ${sha256(
				canonical(record),
			).slice(0, 12)}\n`,
	);
}

/** Diagnostics the second build attempt reported, counted by code. */
export const DIAGNOSTIC_COUNTS: Readonly<Record<string, number>> = Object.freeze({
	NG1010: 2,
	NG2003: 5,
	NG6001: 3,
	NG6002: 87,
	NG6003: 6,
	NG8001: 31,
	NG8002: 28,
	NG8003: 4,
	NG8004: 29,
	TS1259: 1,
	TS2305: 17,
	TS2307: 3,
	TS2314: 2,
	TS2322: 6,
	TS2339: 10,
	TS2345: 19,
	TS2554: 2,
	TS2724: 2,
	TS2740: 2,
	TS2769: 1,
	TS2794: 2,
});

/**
 * The applied manifest and the lockfile resolved from it, by digest.
 *
 * The lockfile is the one that remains after the extra fork package was pruned
 * by a reinstall against the changeset's own manifest, so the two digests
 * describe the same tree rather than two states of it.
 */
export const MIGRATED_MANIFEST_SHA256 =
	'6da0f9e9f16412c794162c037b4f26f0722de7a170dbfc1ed3698b38c5348bcf';
export const LOCKFILE_SHA256 = '7779e3e73951373d541db5c71c013626b21620257bc2df875add3d76d505f392';

if (process.argv[1]?.endsWith('angular-super-productivity-migrated-lane-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
