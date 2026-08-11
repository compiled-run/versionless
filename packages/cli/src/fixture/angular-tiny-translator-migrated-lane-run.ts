/**
 * The migrated lane of the `angular-tiny-translator-v0-12-0` cell: the Angular
 * 16.2 closure installed into the applied tree, and the production build
 * attempted on it.
 *
 * u17 recorded the era lane and composed the changeset. This driver records
 * what happened when that changeset was written into a tree, a closure was
 * installed for it, and `@angular-devkit/build-angular:browser` was asked to
 * build it.
 *
 * The build is red, and the record is the red one. Every demand the compiler
 * and the bundler made is itemised below by file, symbol, library and the
 * transform that would answer it — not summarised, not counted, not softened.
 * That list is the specification for the next unit; a green lane invented here
 * would have destroyed it.
 *
 * The driver is fixture-scoped: it knows where this fixture's stage tree was
 * materialised and what the run it describes did. Every decision about *what to
 * change* lives in `@versionless/angular`, which knows nothing about this
 * application.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { canonical, sha256 } from './angular-factoriolab-migration-run.ts';
import { sealRecord, verifySealedRecord, type SealedRecord } from './angular-factoriolab-build-lanes-run.ts';
import { CONSENT } from './angular-tiny-translator-lanes-run.ts';
import {
	APPLIED_TREE,
	EVIDENCE_DIRECTORY,
	MIGRATION_RECORD_FILE,
	STAGE_DIRECTORY,
	UNIT,
} from './angular-tiny-translator-apply-run.ts';

export const MIGRATED_LANE_FILE = 'u17b-migrated-lane.json';

/** A demand the build made, stated so that answering it needs nothing else. */
export type BuildDemand = Readonly<{
	/** Where the demand is, workspace-relative. */
	file: string;
	/** The symbol or specifier the build could not satisfy. */
	symbol: string;
	/** The library whose change created the demand. */
	library: string;
	/** The diagnostic, quoted from the build log. */
	observed: string;
	/** What would have to change, stated as a transform rather than a fix. */
	neededTransform: string;
}>;

/**
 * Every demand the Angular 16.2 build made, read from the build log.
 *
 * Three families, and they are independent of each other: a package that
 * stopped publishing a barrel, a bundler that stopped supplying Node's core
 * modules to browser code, and an RxJS release that removed prototype patching.
 * None of them is answered here.
 */
export const BUILD_DEMANDS: readonly BuildDemand[] = Object.freeze([
	{
		file: 'src/app/app-material.module.ts, src/app/app.component.ts, src/app/translate-unit-list/translate-unit-list.component.ts, src/app/translate-unit-warning-confirm-dialog/translate-unit-warning-confirm-dialog.component.ts, src/app/translate-unit/translate-unit.component.ts, src/app/update-available/update-available.component.ts',
		symbol: "import { … } from '@angular/material' — MAT_DIALOG_DATA, MatButtonModule, MatCardModule, MatCheckboxModule, MatDialog, MatDialogModule, MatDialogRef, MatIconModule, MatInputModule, MatListModule, MatMenuModule, MatProgressSpinnerModule, MatRadioChange, MatRadioModule, MatSlideToggleModule, MatSnackBar, MatSnackBarModule, MatSnackBarRef, MatToolbarModule, MatTooltipModule",
		library: '@angular/material 5.0.0-rc.2 → 16.2',
		observed:
			"src/app/app-material.module.ts:3:3 - error TS2305: Module '\"@angular/material\"' has no exported member 'MatButtonModule'. (21 TS2305 diagnostics across six modules) / ./src/app/app-material.module.ts:18:12-27 - Error: export 'MatButtonModule' (imported as 'MatButtonModule') was not found in '@angular/material' (possible exports: ɵɵtsModuleIndicatorApiExtractorWorkaround)",
		neededTransform:
			'Angular Material 9 removed the top-level barrel and publishes one secondary entry point per component — `@angular/material/button`, `@angular/material/dialog`, `@angular/material/snack-bar` and their siblings. The 16.2 root entry point still exists and exports one symbol, a build marker, which is why the diagnostic reads "possible exports" and lists it. Each barrel import has to be split into the entry points that own the symbols it names, and the split is a reading of the installed package rather than a table an adapter can carry: the mapping from symbol to entry point is what @angular/material publishes in its own type surface. Twenty symbols across six modules are affected, and two more modules name the same barrel from spec files that this lane does not compile.',
	},
	{
		file: 'src/app/app.component.ts, src/app/auto-translate-summary-page/auto-translate-summary-page.component.ts, src/app/common/abbreviate.pipe.ts, src/app/model/auto-translate-google.service.ts, src/app/model/auto-translate-summary-report.ts, src/app/model/filters/translation-unit-filter-autotranslated.ts, src/app/model/filters/translation-unit-filter-substring.ts, src/app/model/normalized-message.ts, src/app/model/tiny-translator.service.ts, src/app/model/translation-file.ts, src/app/model/translation-project.ts, src/app/model/translation-unit.ts, src/app/normalized-message-input/normalized-message-input.component.ts, src/app/project-editor/project-editor.component.ts, src/app/project-starter/project-starter.component.ts, src/app/translate-unit/translate-unit.component.ts',
		symbol: "import { format } from 'util'",
		library: "Node's `util` core module, reached from browser code",
		observed:
			"./src/app/model/normalized-message.ts:1:0-41 - Error: Module not found: Error: Can't resolve 'util' in '…/src/app/model' (the same error at sixteen application modules, and at node_modules/ngx-i18nsupport-lib/dist/src/api and /impl)",
		neededTransform:
			"webpack 3, which the era Angular CLI 1.5.4 carried, resolved a Node core module in browser code to a bundled shim automatically. webpack 5, which the Angular 16 builder carries, resolves nothing and reports the specifier as unresolvable. Two separate decisions follow, and they are not the same decision: the sixteen application modules import exactly one binding, `format`, and a call-site transform onto a browser-safe formatter would answer them; the two hits inside ngx-i18nsupport-lib 1.10.2 are a published library's own imports, which no application transform reaches and which only a declared browser shim in the workspace's resolution can answer. Neither is guessed here.",
	},
	{
		file: 'src/app/rxjs-operators.ts (the patch imports) and 37 call sites in src/app/configure-auto-translate-page/configure-auto-translate-page.component.ts, src/app/model/auto-translate-google.service.ts, src/app/model/auto-translate-service-api.ts, src/app/model/normalized-message.ts, src/app/model/tiny-translator.service.ts, src/app/model/translation-file.ts, src/app/normalized-message-input/normalized-message-input.component.ts, src/app/translate-unit-list/translate-unit-list.component.ts, src/app/translate-unit/translate-unit.component.ts',
		symbol:
			"import 'rxjs/add/operator/map' and its eighteen siblings; the .map(), .catch(), .debounceTime() … call sites they enabled",
		library: 'rxjs 5.5.2 → 7.8',
		observed:
			"src/app/translate-unit/translate-unit.component.ts:393:64 - error TS2339: Property 'map' does not exist on type 'Observable<boolean>'. (37 TS2339 diagnostics: 25 map, and catch, debounceTime, delay, filter, pairwise and their siblings)",
		neededTransform:
			'RxJS 6 removed both the `rxjs/add/**` patch modules and the prototype patching they performed. The adapter refuses this one deliberately rather than half-applying it: deleting the patch imports is a specifier edit, but the operators they installed are method calls on an observable, and moving them is a `pipe` rewrite at every call site, with the operator imported by name from `rxjs/operators`. A source transform that did the first without the second would produce a tree that compiles nowhere and hides why. The transform owed is a call-site one — chained observable methods to `pipe(…)` — and it is the largest single piece of work this cell has left.',
	},
	{
		file: 'src/app/update-available/update-available.component.ts:11, src/app/translate-unit-warning-confirm-dialog/translate-unit-warning-confirm-dialog.component.ts, src/app/translate-unit/translate-unit.component.ts',
		symbol: 'constructor parameters typed by symbols the barrel no longer exports',
		library: '@angular/material 5.0.0-rc.2 → 16.2 (a consequence of the first demand)',
		observed:
			"src/app/update-available/update-available.component.ts:11:23 - error NG2003: No suitable injection token for parameter 'snackBarRef' of class 'UpdateAvailableComponent'. … This type does not have a value, so it cannot be used as injection token. (4 NG2003, 4 NG6001, 1 NG6002, 1 NG1010)",
		neededTransform:
			'These are not independent demands. A constructor parameter whose type failed to resolve has no injection token, and a module whose declarations failed to resolve is not an NgModule the compiler can read. Answering the barrel demand answers these; they are itemised so that a reader counting diagnostics is not told there are four problems where there is one.',
	},
]);

export type LaneInput = Readonly<{
	nodeVersion: string;
	npmVersion: string;
	firstInstallPackages: number;
	builderInstallPackages: number;
	lockfilePackages: number;
	manifestSha256: string;
	lockfileSha256: string;
	buildExitStatus: number;
	typescriptDiagnostics: number;
	moduleResolutionErrors: number;
	artifactsEmitted: number;
}>;

export function buildMigratedLaneRecord(input: LaneInput): SealedRecord {
	return sealRecord({
		schemaVersion: 'versionless.angular-tiny-translator-migrated-lane.v1',
		unit: UNIT,
		consentId: CONSENT,
		result: 'closure-resolved-build-red-itemised',
		meaning:
			'The migrated manifest the cell produces resolves and installs on the Angular 16.2 line. The production build was then run and is recorded as it happened: red, with every demand the compiler and the bundler made itemised. No demand was answered by an edit this record does not name, and no artifact was emitted.',
		changeset: MIGRATION_RECORD_FILE,
		eraLane: 'u17-era-baseline.json',
		supersedes: {
			record: 'u17-composed-changeset.json',
			unit: 'lrapr-t006/u17-tiny-translator-migration-lanes',
			why: 'u17 composed the changeset over the pinned tree and recorded it truthfully as 2 of 58 application files changed, because the adapter then carried no source transform for anything else this application asked for. The same composition now carries three more capabilities — the RxJS 5 deep-entry-point collapse, the builder-package declaration a synthesized workspace needs, and two ecosystem dispositions the Angular 16 cell had no reading for — and changes 13 of 58. Every u17 change is still in this changeset; the difference is additive.',
		},
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
			stage: '.versionless/stage/angular-tiny-translator-v0-12-0-u17b',
			applied: '.versionless/stage/angular-tiny-translator-v0-12-0-u17b/app',
			from: '.versionless/cache/angular-tiny-translator-v0-12-0-source/verify/extracted',
			commit: '08dcacf6a41d5a6f6dfbc71d858adcdc4c85691a',
		},
		acquisition: {
			purpose:
				'Install the declared Angular 16.2 dependency closure the migrated manifest asks for.',
			consentId: CONSENT,
			networkMode: 'consented',
			method:
				'npm install --no-audit --no-fund, run twice. The era yarn.lock was not carried: it pins the Angular 5 closure, and npm does not read it. The first run installed the manifest as the changeset first wrote it; the second run installed the builder package that the builder-package-declaration capability then added, and is the closure the build ran against.',
			outcome: 'succeeded',
			exitStatus: 0,
			firstInstallPackagesAdded: input.firstInstallPackages,
			builderInstallPackagesAdded: input.builderInstallPackages,
			lockfilePackages: input.lockfilePackages,
			migratedManifestSha256: input.manifestSha256,
			lockfileSha256: input.lockfileSha256,
			hosts: ['registry.npmjs.org'],
			warningKinds: ['EBADENGINE', 'deprecated'],
			warningNote:
				'The install emitted engine and deprecation warnings only. Two packages declare a Node line this cell does not meet — karma-cli@1.0.1 and node-releases@2.0.53 — and npm was not run with engine-strict, so each was installed with a warning rather than refused. karma-cli is an era range the cell\'s test table does not reach; node-releases is a transitive dependency this cell does not name.',
			registryReadings: [
				'@angular/http: latest 7.2.16, deprecated on the registry with "Package no longer supported. Use @angular/common instead". No 8.x and no 16.x line exists, so the @angular/ family range this cell writes named a version that was never published. Recorded in the cell as no-successor and dropped from the manifest; nothing in this application imported it.',
				'@angular/flex-layout: latest 15.0.0-beta.42, the newest version on any line and the `latest` dist-tag, deprecated on the registry. Its peers — @angular/core, @angular/common and @angular/platform-browser ">=15.0.2", @angular/cdk ">=15.0.0", rxjs "^6.5.3 || ^7.4.0" — are all satisfied by this cell, and it declares no engines.node, so the cell\'s mechanical rule selects it and the manifest carries ^15.0.0-beta.42 rather than a 16.x that does not exist.',
				'@angular/material and @angular/cdk: the 5.0.0-rc.2 release candidates the era manifest carried are inside the @angular/ family, and 16.2.x is published for both, so the family rule alone answered them. The RC-era *API* did not survive the eleven majors, and that is the first demand below rather than a closure problem.',
			],
		},
		buildAttempt: {
			command: 'npx ng build --configuration production',
			runs: 1,
			exitStatus: input.buildExitStatus,
			outcome: 'red',
			artifactsEmitted: input.artifactsEmitted,
			typescriptDiagnostics: input.typescriptDiagnostics,
			moduleResolutionErrors: input.moduleResolutionErrors,
			reachedCompilation:
				'The build resolved its builder, read the synthesized workspace, ran the SCSS pipeline and reached the Angular compiler and the bundler. Every diagnostic below is a demand of the application source on the 16.2 line, not a workspace or toolchain failure.',
			demands: BUILD_DEMANDS,
			log: 'Retained at .versionless/stage/angular-tiny-translator-v0-12-0-u17b/build-1.stderr.log; it is a build log, not evidence, and is not copied into this tree.',
		},
		parity: null,
		parityNote:
			'No parity is recorded and none is claimed. A build-level parity statement compares two artifacts, and this lane emitted none. The era lane\'s inventory stands on its own in u17-era-baseline.json.',
		notEstablished: [
			'The build is red. Nothing here establishes that this application can be carried to Angular 16, only what it would take to find out.',
			'A resolved closure is not a working one: 1405 packages resolved and installed, and nothing here observes any of them running.',
			'No browser opened anything in this lane. No journey was driven and no behaviour was observed.',
			'The demand list is what this build asked for, not what a green build would ask for. Answering every demand below may reveal further ones that only a build that gets past these can see.',
			'The spec files this application carries were not compiled: the production build does not read them. Two of them import the same @angular/material barrel as the modules that failed, so the barrel demand is at least as large as the count above.',
		],
		recordedRisks: [
			'A TLS private key (key.pem) and its certificate (cert.pem) are committed at the root of the pinned tree. Neither was copied into the stage tree, and neither appears in any artifact of this run.',
			'The application requests https://fonts.googleapis.com/icon?family=Material+Icons unconditionally at runtime. No lane here loaded a page, so nothing is established about that request.',
			'@angular/flex-layout is carried at a deprecated beta release because it is the newest line the package ever published. That is a recorded fact about the closure, not an endorsement of the library.',
		],
	});
}

async function readText(file: string): Promise<string> {
	return await readFile(file, 'utf8');
}

async function countPackagesAdded(log: string): Promise<number> {
	const match = /added (\d+) packages?/.exec(await readText(log));
	if (match === null) throw new Error(`no "added N packages" line in ${log}`);
	return Number.parseInt(match[1] as string, 10);
}

async function countMatches(file: string, pattern: RegExp): Promise<number> {
	return (await readText(file)).match(pattern)?.length ?? 0;
}

export async function main(): Promise<void> {
	const lock: unknown = JSON.parse(await readText(path.join(APPLIED_TREE, 'package-lock.json')));
	const packages =
		typeof lock === 'object' && lock !== null && 'packages' in lock
			? Object.keys((lock as { packages: Record<string, unknown> }).packages).length
			: 0;
	const record = verifySealedRecord(
		buildMigratedLaneRecord({
			nodeVersion: 'v16.20.2',
			npmVersion: '8.19.4 (bundled with the runtime)',
			firstInstallPackages: await countPackagesAdded(
				path.join(STAGE_DIRECTORY, 'install.stdout.log'),
			),
			builderInstallPackages: await countPackagesAdded(
				path.join(STAGE_DIRECTORY, 'install-2.stdout.log'),
			),
			lockfilePackages: packages,
			manifestSha256: sha256(await readText(path.join(APPLIED_TREE, 'package.json'))),
			lockfileSha256: sha256(await readText(path.join(APPLIED_TREE, 'package-lock.json'))),
			buildExitStatus: Number.parseInt(
				(await readText(path.join(STAGE_DIRECTORY, 'build-1.exit'))).trim(),
				10,
			),
			typescriptDiagnostics: await countMatches(
				path.join(STAGE_DIRECTORY, 'build-1.stderr.log'),
				/error (?:TS|NG)\d+/g,
			),
			moduleResolutionErrors: await countMatches(
				path.join(STAGE_DIRECTORY, 'build-1.stderr.log'),
				/Module not found: Error: Can't resolve/g,
			),
			artifactsEmitted: 0,
		}),
	);
	await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
	await writeFile(path.join(EVIDENCE_DIRECTORY, MIGRATED_LANE_FILE), canonical(record));
	process.stdout.write(
		`migrated lane ${String(record['result'])}: ${String(BUILD_DEMANDS.length)} demands itemised, ` +
			`record digest ${sha256(canonical(record)).slice(0, 12)}\n`,
	);
}

if (process.argv[1]?.endsWith('angular-tiny-translator-migrated-lane-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
