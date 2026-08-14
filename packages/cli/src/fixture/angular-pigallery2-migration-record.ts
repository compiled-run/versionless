/**
 * The Angular holdout result: what the frozen `@versionless/angular` adapter did
 * when it was pointed at `pigallery2 1.7.0`, an application it had never seen.
 *
 * The result is RED, and this record is the red one. The migrated lane's closure
 * does not install, so no target build exists and none is claimed. Every gap the
 * lane hit is itemised below by package, by declaration, by file and by line —
 * not counted, not summarised, not softened — together with what the era
 * toolchain did instead and why. That list is the falsification evidence this
 * unit was run to produce; a green lane invented here would have destroyed it.
 *
 * Nothing under `packages/frameworks/**`, `packages/core/src/migrations/**`,
 * `packages/core/src/bundlers/**` or `packages/core/src/analysis/**` was edited
 * by this unit. The composite fingerprint of those five subtrees is
 * 4df7bc961033fc5856b4d58e0bca9f11ad2aa9d43aaaee726956f34d209b37e7 before and
 * after, and the Angular subtree oid is ca3824d0595d1fa88d37feda6b1785dfd79e72c4.
 *
 * The driver is fixture-scoped. It names this application's paths and quotes
 * this application's diagnostics; it decides nothing about what an adapter
 * should do.
 */

import { readFile, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { canonical, sha256 } from './angular-factoriolab-migration-run.ts';
import { sealRecord, verifySealedRecord, type SealedRecord } from './angular-factoriolab-build-lanes-run.ts';
import { CONSENT, COMMIT, UNIT } from './angular-pigallery2-migration-run.ts';

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');

export const INGEST_DIRECTORY = path.join(
	repositoryRoot,
	'evidence/ingests/angular-pigallery2-v1-7-0',
);
export const ATTEMPT_FILE = path.join(INGEST_DIRECTORY, 'attempt.json');

/**
 * One thing the frozen engine could not carry, stated so that answering it needs
 * nothing else: where it is, what it is, which hop created it, what the toolchain
 * said verbatim, why the era toolchain did not say it, and what would have to
 * change — as a transform, not as a fix.
 */
export type MigrationGap = Readonly<{
	/** Ordinal, so a reader and a reviewer can name the same gap. */
	id: string;
	/** Which stage of the lane refused: `install` or `compile`. */
	stage: 'install' | 'compile';
	/** Where the gap is: a workspace-relative path, or a package name. */
	site: string;
	/** The declaration, specifier, symbol or option that could not be carried. */
	subject: string;
	/** The library or toolchain hop whose change created the demand. */
	library: string;
	/** The diagnostic, quoted from the log. */
	observed: string;
	/** Why the era toolchain did not refuse: the fact that made Angular 8 accept it. */
	whyTheEraToolchainAccepted: string;
	/** Why the frozen engine cannot carry it, stated against the frozen code. */
	whyTheEngineCannotCarryIt: string;
	/** What would have to change, stated as a transform rather than a fix. */
	neededTransform: string;
}>;

/**
 * The three declarations that stop `npm install` of the migrated manifest, and
 * the four independent things the compiler then refuses once they are set aside
 * in a probe tree.
 *
 * The install set is closed, not sampled: npm reports one conflict per run, so
 * the manifest was narrowed one package at a time in a scratch directory outside
 * both lanes until it resolved, and the packages that had to be narrowed are
 * exactly these three plus one pre-existing registry break the era baseline
 * already recorded. That probe is described in `probe` below.
 */
export const GAPS: readonly MigrationGap[] = Object.freeze([
	Object.freeze({
		id: 'G1',
		stage: 'install',
		site: 'package.json — devDependencies.@angular-devkit/build-optimizer',
		subject: '0.801.2 -> ^16.2.0, written by the cell\'s `@angular-devkit/` family range',
		library: '@angular-devkit/build-optimizer, folded into @angular-devkit/build-angular after the Angular 13 line',
		observed:
			'npm ERR! code ETARGET / npm ERR! notarget No matching version found for @angular-devkit/build-optimizer@^16.2.0.',
		whyTheEraToolchainAccepted:
			'The era manifest declares the package explicitly at 0.801.2, the version paired with @angular-devkit/build-angular 0.801.2, and both existed on the Angular 8 line. pigallery2 declares it because its own gulp pipeline drives the builder directly; most applications never name the package at all, which is why the four Angular verticals the adapter was designed against — tiny-translator, super-productivity, jira-clone, factoriolab — declare none of it and this hole was never exercised.',
		whyTheEngineCannotCarryIt:
			'ANGULAR_16_BROWSER_CELL.families writes `"@angular-devkit/": "^16.2.0"` as a blanket prefix rule, and alignAngularPackageManifest applies a family range to every declared package whose name carries the prefix. The rule is a naming assumption, not a reading: it presumes that every package in a family is published on the family\'s own version line. @angular-devkit/build-optimizer stops at 0.1302.1, its `latest` dist-tag, and is deprecated on the registry with "This package has been folded in @angular-devkit/build-angular and should no longer be needed." No 16.x of it was ever published, so the family rule writes a range naming a version that does not exist, and npm refuses the whole tree before any peer is even considered.',
		neededTransform:
			'The adapter already carries the shape that answers this: ANGULAR_16_ECOSYSTEM_PACKAGES holds `@angular/http` as `kind: "no-successor"` for exactly this reason — a package inside a family prefix that the family\'s own version line never published. What is missing is the entry, not the mechanism, and the entry is a registry reading rather than an invention: the package is deprecated in favour of @angular-devkit/build-angular, which this cell already writes at ^16.2.0, so the declaration is dropped rather than pinned. The general form of the demand is larger than one entry, and it is the one worth stating: a family prefix rule needs a per-package published-line check, because a family is a naming convention and not a release train.',
	}),
	Object.freeze({
		id: 'G2',
		stage: 'install',
		site: 'package.json — devDependencies.ng2-slim-loading-bar',
		subject: '4.0.0, left at its era range because the cell reads no line for it',
		library: 'ng2-slim-loading-bar 4.0.0 — the newest version ever published, and the `latest` dist-tag',
		observed:
			'npm ERR! code ERESOLVE / npm ERR! Found: @angular/core@16.2.12 … Could not resolve dependency: peer @angular/core@"^2.4.7 || ^4.0.0" from ng2-slim-loading-bar@4.0.0',
		whyTheEraToolchainAccepted:
			'The era closure is Angular 8.1.2 installed by npm 6, which reports an unsatisfied peer as a warning rather than an error and installs anyway. The declared peer `^2.4.7 || ^4.0.0` did not match Angular 8 either — the era build was already resolving this package by npm 6\'s permissiveness, not by agreement — and the library\'s pre-Ivy metadata was still readable by the Angular 8 ViewEngine compiler.',
		whyTheEngineCannotCarryIt:
			'The package is absent from ANGULAR_16_ECOSYSTEM_PACKAGES, so ecosystemDispositionOf returns nothing and alignAngularPackageManifest leaves the era pin 4.0.0 in place beside @angular/core ^16.2.0. npm 8 treats an unsatisfiable peer as an error, so the tree is refused. The adapter is not wrong about the package — it has read nothing about it at all, and leaving an era pin is the only thing it can do without inventing a version.',
		neededTransform:
			'A `no-successor` cell disposition, of the kind the table already carries for @angular/http, tslint and codelyzer. The registry reading is unambiguous and closes the question: the full published list ends at 4.0.0, that version is the `latest` dist-tag, and it is the exact version the era workspace pinned — the package is dead, not behind. Dropping it makes the closure resolvable and turns the two application imports it serves into source demands the compiler then states by name: `SlimLoadingBarModule` at frontend/app/app.module.ts:31 and `SlimLoadingBarService` at frontend/app/model/network/network.service.ts:4, plus the `<ng2-slim-loading-bar>` element and its `color` and `height` bindings in frontend/app/ui/frame/frame.component.html. Choosing a replacement loading-bar library is a source decision and is demanded here rather than made.',
	}),
	Object.freeze({
		id: 'G3',
		stage: 'install',
		site: 'package.json — devDependencies.ngx-toastr',
		subject: '10.0.4, left at its era range because the cell reads no line for it',
		library: 'ngx-toastr 10.0.4 -> a maintained line that does admit Angular 16',
		observed:
			'npm ERR! code ERESOLVE / npm ERR! Found: @angular/common@16.2.12 … Could not resolve dependency: peer @angular/common@">=6.0.0 <9.0.0" from ngx-toastr@10.0.4',
		whyTheEraToolchainAccepted:
			'The era peer range `>=6.0.0 <9.0.0` is bounded, and Angular 8.1.2 falls inside it — this is the one era peer in this manifest that was actually satisfied at the pin. It is the hop that breaks it, not the era.',
		whyTheEngineCannotCarryIt:
			'The package is absent from ANGULAR_16_ECOSYSTEM_PACKAGES, so its era pin survives the alignment and its bounded upper edge `<9.0.0` collides with the ^16.2.0 the cell writes for @angular/common, @angular/core and @angular/platform-browser. Its fourth peer, `rxjs "^6.1.0"`, collides independently with the ~7.8.0 the same cell writes — one package, two unrelated conflicts, either of which is fatal to the tree.',
		neededTransform:
			'An `aligned` cell disposition, chosen by the same newest-satisfying-line rule every other entry in the table was chosen by. The reading is available and discriminating: 20.0.5, the newest release and the `latest` dist-tag, declares peer @angular/core and @angular/common "^21.0.0" and is excluded; 17.0.0 through 19.1.0 all declare @angular/core, @angular/common and @angular/platform-browser ">=16.0.0-0", which this cell satisfies, so 19.1.0 is the newest line it can accept. The disposition has a second consequence the workspace has to carry with it, and it is why this gap is not purely a manifest edit: angular.json names `./node_modules/ngx-toastr/toastr.css` in its `styles` array, so the build refuses with `Can\'t resolve \'./node_modules/ngx-toastr/toastr.css\'` as soon as the package is absent, and a disposition that moves the package has to be checked against the stylesheet path the new line publishes.',
	}),
	Object.freeze({
		id: 'G4',
		stage: 'compile',
		site: 'node_modules/ngx-bootstrap/{collapse,datepicker,dropdown,modal,popover,tooltip}/*.module.d.ts, node_modules/@yaga/leaflet-ng2/lib/geojson.directive.d.ts',
		subject:
			'ngx-bootstrap@5.1.0 (peer @angular/core ">=7.0.0"), @yaga/leaflet-ng2@1.0.0 (peer @angular/core ">=2.0.0"), jw-bootstrap-switch-ng2@2.0.5 (peer @angular/core ">=7.0.0 …") — three era libraries an open-ended peer range let through the resolver',
		library: 'Angular 8 -> 16, read through libraries the cell never read',
		observed:
			'node_modules/ngx-bootstrap/collapse/collapse.module.d.ts:3:23 - error TS2314: Generic type \'ModuleWithProviders<T>\' requires 1 type argument(s). (7 of the 8 TS2314 in this build are inside ngx-bootstrap\'s own published declarations) / node_modules/@yaga/leaflet-ng2/lib/geojson.directive.d.ts:197:5 - error TS2416: Property \'addData\' in type \'GeoJSONDirective<T>\' is not assignable to the same property in base type \'GeoJSON<any, Geometry>\'',
		whyTheEraToolchainAccepted:
			'These libraries were published for the Angular 6-to-8 band and their declarations are correct for it: `ModuleWithProviders` took no type argument until Angular 10 made it required, and @yaga/leaflet-ng2 1.0.0 was compiled against the @types/leaflet of 2019. TypeScript 3.4.5 accepted every one of them.',
		whyTheEngineCannotCarryIt:
			'This is the gap that an install-shaped reading hides. All three declare their @angular peer with an open lower bound and no upper bound — ">=7.0.0", ">=2.0.0" — so npm resolves them against Angular 16 without a word, the closure looks healthy, and the refusal arrives one stage later from the TypeScript program, which reads a dependency\'s published .d.ts files as part of its own compilation. The frozen cell has no entry for any of the three, and nothing in the adapter inspects an installed library\'s declarations. An open-ended peer range is a claim the library author made before Angular 10 existed; it is not evidence of compatibility, and treating a resolvable closure as a compatible one is what turns this into a compile-time surprise.',
		neededTransform:
			'Three `aligned` cell dispositions, read the same way every other table entry is read. The general demand behind them is the one worth recording: the cell selects lines from declared peer ranges, and a package whose declared range does not exclude the target is currently indistinguishable from a package that was read and found compatible. A library that declares an unbounded peer needs its own reading — the published-line list, or the Angular version stamped into its partial declarations, which is the discriminator the table already uses for @ngx-formly/core — rather than being passed through on the strength of a range its author could not have meant.',
	}),
	Object.freeze({
		id: 'G5',
		stage: 'compile',
		site: 'frontend/app/app.routing.ts:71, frontend/app/ui/settings/_abstract/abstract.settings.component.ts:14',
		subject:
			'`export const appRoutes: ModuleWithProviders = RouterModule.forRoot(ROUTES);` and `export abstract class SettingsComponent<T, S> implements OnInit, OnDestroy, OnChanges` — an undecorated base class carrying @Input, @Output and @ViewChild members',
		library: 'Angular 8 -> 16: ModuleWithProviders became generic in 10, and the Ivy compiler requires an explicit decorator on a class using Angular features',
		observed:
			'frontend/app/app.routing.ts:71:25 - error TS2314: Generic type \'ModuleWithProviders<T>\' requires 1 type argument(s). / frontend/app/ui/settings/_abstract/abstract.settings.component.ts:14:23 - error NG2007: Class is using Angular features but is not decorated. Please add an explicit Angular decorator.',
		whyTheEraToolchainAccepted:
			'Angular 8 shipped `ModuleWithProviders` with an optional type parameter, and the pre-Ivy ViewEngine compiler inherited decorator metadata down a class hierarchy without demanding a decorator on the base. Both constructs are idiomatic Angular 8, not defects the application should have avoided.',
		whyTheEngineCannotCarryIt:
			'This one is not a missing capability, and that is what makes it the sharpest finding here. `@versionless/angular` carries `module-with-providers-type-argument.ts` and `unparameterised-base-class.ts` — both are exported from packages/frameworks/angular/src/index.ts, and both are imported by nothing inside the package. `migrateAngularCliEraWorkspace` imports thirteen capability modules and neither of these is among them, so the composed changeset can never run them however many applications it is pointed at. The demand is a wiring demand, not a transform demand: the answer is already written and is not called.',
		neededTransform:
			'Compose the two existing capabilities into the era migration pipeline and let each refuse per site where its own proof fails, exactly as `entry-components-removal` was composed after the super-productivity lane recorded the identical defect against it — that capability is in the era migration\'s import list today and these two are not, which is the same finding recurring on two more capabilities rather than a new one. Nothing about either capability has to be designed for this application; it has to be reached.',
	}),
	Object.freeze({
		id: 'G6',
		stage: 'compile',
		site: 'frontend/app/app.module.ts:122',
		subject: 'return require(`raw-loader!../translate/messages.${locale}.xlf`);',
		library: '@angular-devkit/build-angular 0.801.2 -> 16.2, and the transitive raw-loader@1.0.0 that came with the first',
		observed:
			"./frontend/app/app.module.ts:146:9-66 - Error: Module not found: Error: Can't resolve 'raw-loader' in '…/frontend/app'",
		whyTheEraToolchainAccepted:
			'A webpack inline loader specifier: everything before the last `!` names loaders to run, not a module to import. The era closure carried raw-loader@1.0.0 in node_modules — installed as a transitive dependency of @angular-devkit/build-angular@0.801.2, and declared by nothing in the application\'s own manifest — so webpack 4 found it by hoisting and the era build resolved the chain. The application was relying on a package it never declared, and it worked because something else happened to install it.',
		whyTheEngineCannotCarryIt:
			'The adapter carries exactly one capability for this class of hole, `undeclared-runtime-dependency`, and it is wired into the era migration. Its detection domain is the wrong side of the boundary: undeclaredRuntimeDependencies reads *installed packages* — what each package in the closure declares, and what its shipped bundles import — and closes holes in the application manifest on their behalf. An inline loader chain written in the application\'s own source, inside a `require()` whose argument is a template literal, is seen by nothing: it is not a package import, no source transform in the adapter parses loader syntax, and the specifier is not even statically complete. @angular-devkit/build-angular 16.2 does not depend on raw-loader, so the accidental hoist is gone and the chain has no resolver.',
		neededTransform:
			'Two separable things, and conflating them is how this would get answered wrongly. The first is a declaration demand: raw-loader is an edge this application relies on and does not declare, and closing it needs a reading of application source for inline loader specifiers — a domain the existing capability does not cover and would have to be extended into, since a loader is a build-time package and not a runtime import. The second is that the construct itself is a webpack idiom the Angular 16 builder still supports but that the application uses to load an xlf translation catalogue at module scope, which is the ViewEngine i18n path recorded in `eraFactsTheMigratedWorkspaceDoesNotCarry` below; answering the declaration without answering the i18n path produces a build that resolves the loader and still does not do what the era build did.',
	}),
	Object.freeze({
		id: 'G7',
		stage: 'compile',
		site: 'frontend/app/ui/gallery/overlay.service.ts:27',
		subject: "outer.style.msOverflowStyle = 'scrollbar'; // needed for WinJS apps",
		library: 'TypeScript 3.4.5 -> 5.1.3, via the lib.dom.d.ts each ships',
		observed:
			"frontend/app/ui/gallery/overlay.service.ts:27:19 - error TS2339: Property 'msOverflowStyle' does not exist on type 'CSSStyleDeclaration'.",
		whyTheEraToolchainAccepted:
			"TypeScript 3.4.5's lib.dom.d.ts declared the vendor-prefixed Microsoft CSS properties on CSSStyleDeclaration, `msOverflowStyle` among them. The declaration was removed from later lib.dom releases with the rest of the ms-prefixed surface. The property still exists at runtime in the browsers that ever implemented it; what moved is the type declaration, not the platform.",
		whyTheEngineCannotCarryIt:
			'A compiler-line demand at one call site, on a member access rather than a specifier. The adapter\'s source transforms rewrite module specifiers and named imports; nothing in it rewrites a property access against a lib declaration that stopped declaring it, and nothing should invent a cast on the application\'s behalf.',
		neededTransform:
			'This is a source decision that has to be made explicitly rather than mechanically, and the honest options differ in what they claim. A cast preserves the emitted behaviour and asserts nothing about the type; deleting the line changes behaviour on a platform nobody here tested. It is recorded as a demand, at one line, in one file, with the era reason the author wrote beside it.',
	}),
]);

/**
 * The diagnostics the probe build reported, counted by code, identical across two
 * consecutive runs.
 *
 * The template-level families are downstream of the module-level ones and are not
 * separate work; `downstreamReading` states how that is known rather than assumed.
 */
export const PROBE_DIAGNOSTIC_COUNTS: Readonly<Record<string, number>> = Object.freeze({
	NG2007: 1,
	NG8001: 45,
	NG8002: 184,
	NG8003: 18,
	NG8004: 2,
	TS2307: 4,
	TS2314: 8,
	TS2339: 1,
	TS2416: 1,
});

export const DOWNSTREAM_READING =
	'249 of the 264 diagnostics — every NG8001, NG8002, NG8003 and NG8004 — are downstream of frontend/app/app.module.ts failing to compile, and that is checkable rather than asserted. The two TS2307 in that file leave its @NgModule literal unanalysable, so every component it declares loses its module scope at once. The proof is in which bindings fail: the compiler reports `Can\'t bind to \'ngClass\' since it isn\'t a known property of \'span\'`, `Can\'t bind to \'routerLink\' since it isn\'t a known property of \'a\'`, `\'router-outlet\' is not a known element` and `No directive found with exportAs \'ngForm\'` — CommonModule, RouterModule and FormsModule directives, all three of which app.module.ts imports and all three of which the closure installed correctly. Builtin directives cannot go missing for a dependency reason; they can only go missing for a scope reason. The fifteen diagnostics left are the ones the gaps above name.';

export const PROBE = Object.freeze({
	purpose:
		'The lane stops at the resolver, which reports one conflict per run and therefore cannot say how many there are. The probe exists to close the install set and to reach the compiler, so that the gaps behind the first one are named in this unit instead of being discovered one unit at a time.',
	whatItIsNot:
		'Not a migration, not a lane, and not a fallback. The probe tree is a separate directory, .versionless/work/angular-pigallery2/target-probe, and nothing measured in it is claimed as a migration result. The migrated lane at .versionless/work/angular-pigallery2/target/app is left exactly as the frozen adapter wrote it, with its red install log beside it.',
	closingTheInstallSet:
		'A scratch directory outside both lanes was given a copy of the migrated manifest and `npm install --dry-run` was run repeatedly, each run removing the single package npm named, until the tree resolved. Four packages had to be removed and the fifth run resolved 2310 packages. Three of the four are the gaps G1, G2 and G3. The fourth is xlf-google-translate@1.0.0-beta.15, which is not a migration gap at all: its transitive @k3rn31p4nic/google-translate-api@1.0.6 was deleted from the public registry, the era baseline unit hit the identical E404 on the unmigrated manifest, and it is a property of the registry in 2026 rather than of this hop.',
	tree: '.versionless/work/angular-pigallery2/target-probe/app',
	narrowedFromLaneManifest: Object.freeze([
		'@angular-devkit/build-optimizer (G1)',
		'ng2-slim-loading-bar (G2)',
		'ngx-toastr (G3)',
		'xlf-google-translate (the pre-existing registry break the era baseline already recorded)',
	]),
	narrowingIsNotADisposition:
		'Removing a package to reach the compiler is not the same as reading a line for it. The probe does not claim that dropping ng2-slim-loading-bar or ngx-toastr is the right disposition — G2 argues that for the first and argues the opposite for the second — and the TS2307 and Module-not-found diagnostics the removals produce are attributed to the removals, not counted as independent findings.',
	install: Object.freeze({
		command: 'npm install --no-audit --no-fund --ignore-scripts',
		exitStatus: 0,
		packagesInstalled: 2277,
		scriptsDisabledReason:
			'The same reason both prior Angular migrated lanes disabled them, and one more this application adds: the manifest carries sqlite3, sharp, bcrypt and the ffmpeg/ffprobe installers, whose install hooks fetch or compile native bindings, and the root package\'s own `install` script is `tsc && gulp build-prod`, which would have driven a build before anything was measured. Nothing here establishes what a scripted install of this manifest does.',
		log: 'migration/probe-install.log',
	}),
	build: Object.freeze({
		command:
			'node --max_old_space_size=4096 ./node_modules/@angular/cli/bin/ng.js build --configuration production',
		commandNote:
			"The era lane ran the repository's own gulp task, which emits `ng build --aot --prod --no-extract-licenses --output-path=./dist --no-progress --no-progress --i18n-locale en --i18n-format=xlf --i18n-file=frontend/translate/messages.en.xlf --i18n-missing-translation warning`. The 16.2 CLI removed `--prod` in favour of the named configuration, AOT is unconditional, and the four i18n flags are ViewEngine flags the 16.2 CLI no longer accepts — so the probe invocation is the modern spelling of the build and is deliberately *not* the era build's equivalent. What that costs is stated in `eraFactsTheMigratedWorkspaceDoesNotCarry`.",
		runs: 2,
		exitStatus: 1,
		artifactsEmitted: 0,
		artifactsNote: 'No dist directory exists after either run. Nothing was emitted to inventory or compare.',
		logsByteIdentical: true,
		logsByteIdenticalNote:
			'probe-build-run1.log and probe-build-run2.log are byte-identical, sha256 340ba5e714aa4c3cfe38dce945c359359d4aa195bb58bc2f5c337c453b8966a4. Two consecutive runs of the same tree produced the same 264 diagnostics in the same order. The red is reproducible on this host; that is a statement about the measurement, not about the application.',
		logs: ['migration/probe-build-run1.log', 'migration/probe-build-run2.log'],
	}),
});

/**
 * Era facts the migrated workspace does not carry, named because a changeset that
 * silently loses one of them would still look clean.
 */
export const ERA_FACTS_NOT_CARRIED: readonly string[] = Object.freeze([
	'The era production build is an i18n build. The repository\'s gulp task passes `--i18n-locale en --i18n-format=xlf --i18n-file=frontend/translate/messages.en.xlf --i18n-missing-translation warning` to the Angular 8 CLI, and the application loads the same catalogue a second way at module scope through the raw-loader chain of G6. angular.json itself declares no i18n at all, so the workspace migration has nothing to read and nothing to carry: the migrated workspace has no i18n configuration, and the 16.2 CLI does not accept the era flags. `@versionless/angular` does carry a `template-i18n-runtime` capability — and it is one of the twenty-eight modules exported from the package index that the composed era migration never imports, the same wiring gap G5 names.',
	'`extractCss: true` was removed from the production configuration by the workspace migration, as a 16.2 line that always extracts. Recorded as a declared difference by the adapter itself, not discovered here.',
	'Both TSLint targets and tslint.json were dropped, and the pigallery2 lint target was already broken at the pin: it names src/tsconfig.app.json and src/tsconfig.spec.json, paths this tree does not contain, because the sources live under frontend/.',
	'The protractor e2e target was removed with no replacement, and the adapter reported it unhandled.',
	'The era build emitted differential loading output — polyfills.js and polyfills-es5.js with a nomodule script tag. tsconfig target moved es5 -> ES2022, so a migrated build that reached emit would not emit an es5 bundle. No migrated build reached emit, so this is a property of the changeset and not an observation.',
]);

export function buildMigrationBlock(): Readonly<Record<string, unknown>> {
	return {
		unit: UNIT,
		result: 'RED — the frozen adapter composes a changeset for this application and the migrated closure does not install; no target build exists',
		outcome: 'red-migration-gaps-itemised',
		startedAt: '2026-08-14T01:06:00Z',
		completedAt: '2026-08-14T01:30:00Z',
		scope:
			'Compose the frozen `@versionless/angular` changeset over the pinned corpus, write it into a migrated lane, install the migrated closure and build it. No adapter edit, no application-source hand edit, no app-name or revision branch anywhere in the engine. The freeze fingerprint 4df7bc961033fc5856b4d58e0bca9f11ad2aa9d43aaaee726956f34d209b37e7 is unchanged, and the Angular subtree oid ca3824d0595d1fa88d37feda6b1785dfd79e72c4 did not move.',
		holdoutMeaning:
			'This is the falsification result the holdout was run to produce. pigallery2 was never ingested, fixtured, adapted or receipted in this repository before T018, and the adapter was frozen before this unit started, so nothing in the engine was shaped by this application. Seven gaps are named below. Two of them — G1 and G5 — are not gaps in what the adapter knows but in how it is composed, which is the more useful half of the result: G1 is a family-prefix rule applied without a published-line check, and G5 is two capabilities that exist, are exported, and are called by nothing.',
		freeze: {
			compositeFingerprint: '4df7bc961033fc5856b4d58e0bca9f11ad2aa9d43aaaee726956f34d209b37e7',
			angularSubtreeOid: 'ca3824d0595d1fa88d37feda6b1785dfd79e72c4',
			verifiedBeforeAndAfter: true,
			subtrees: [
				'packages/frameworks/react',
				'packages/frameworks/angular',
				'packages/core/src/migrations',
				'packages/core/src/bundlers',
				'packages/core/src/analysis',
			],
		},
		cell: {
			id: 'angular-16-browser-builder',
			angularLine: '16.2',
			builder: '@angular-devkit/build-angular:browser',
			selection:
				'The cell is the adapter\'s own, unchanged and unforced. `ANGULAR_TARGET_CELLS` carries exactly one entry and the driver names it; no Vite path exists for Angular in this engine and none was reached for. The builder identity is carried across the hop rather than swapped: the era workspace declares `@angular-devkit/build-angular:browser` and so does the migrated one.',
			node: 'v16.20.2 (darwin-arm64, native — no translation layer), npm 8.19.4, from the runtime cell the Angular 16 verticals already materialised at .versionless/cache/angular-jira-clone-runtime. The runtime was not re-acquired.',
		},
		lanes: {
			corpus: `.versionless/cache/angular-pigallery2-v1-7-0-source/corpus/pigallery2-${COMMIT}`,
			migrated: '.versionless/work/angular-pigallery2/target/app',
			probe: '.versionless/work/angular-pigallery2/target-probe/app',
			eraBaseline: '.versionless/work/angular-pigallery2/baseline (the previous unit, untouched by this one)',
		},
		changeset: {
			record: 'migration/u3-composed-changeset.json',
			appliedRecord: 'migration/u3-source-migration.json',
			applicationFilesScanned: 214,
			applicationFilesChanged: 3,
			workspaceFilesChanged: 3,
			filesRemoved: ['tslint.json'],
			unhandled: 6,
			declaredDifferences: 8,
			applicationSourceChanges: [
				'frontend/app/ui/faces/faces.component.ts:6 — module-specifier rxjs/Observable -> rxjs',
				'frontend/polyfills.ts:45 — module-specifier zone.js/dist/zone -> zone.js',
				'frontend/test.ts:3 — module-specifier zone.js/dist/long-stack-trace-zone -> zone.js/plugins/long-stack-trace-zone',
			],
			applicationSourceNote:
				'Three application files changed out of 214 scanned, all module-specifier rewrites, all made by frozen transforms. No application file was edited by hand in either lane.',
			compilationUnitNote:
				'This workspace is not src/-rooted: angular.json declares `sourceRoot: "frontend"`, and the frontend modules import across into the sibling common/ directory that the backend also compiles. Both directories were handed to the migration, because both are inside what the browser build\'s TypeScript program reads. Supplying only the declared sourceRoot would have scanned a strict subset of the compilation unit.',
		},
		laneInstall: {
			command: 'npm install --no-audit --no-fund --ignore-scripts',
			exitStatus: 1,
			outcome: 'refused at dependency resolution; nothing was linked',
			firstRefusal: 'ERESOLVE on ng2-slim-loading-bar@4.0.0 (G2)',
			eraLockfileHandling:
				'The era package-lock.json was moved out of the lane before the install and retained at .versionless/work/angular-pigallery2/target/logs/era-package-lock.json. It pins the complete 2019 Angular 8 closure; leaving a v1 lockfile of that closure beside an Angular 16 manifest would have described a tree that does not exist. This mirrors what the super-productivity migrated lane did with that application\'s era yarn.lock.',
			log: 'migration/lane-install-red.log',
		},
		targetBuild: {
			produced: false,
			reason:
				'A target build requires an installed closure, and the migrated closure does not install. The two-run byte comparison this unit owed is therefore not deferred or estimated — it does not exist, and no substitute for it is offered. The probe build below is a diagnostic and is not that comparison.',
		},
		gaps: GAPS,
		gapCount: GAPS.length,
		probe: PROBE,
		probeDiagnosticCounts: PROBE_DIAGNOSTIC_COUNTS,
		downstreamReading: DOWNSTREAM_READING,
		eraFactsTheMigratedWorkspaceDoesNotCarry: ERA_FACTS_NOT_CARRIED,
		whatWorked: [
			'The engine ran end to end on an application it had never seen and produced a changeset without crashing, without an application-specific branch, and without being modified: no transform threw, no workspace document was refused, and the CLI 1.x synthesis capability correctly stood down on a modern angular.json without being told which format to expect.',
			'The workspace migration read this application\'s unusual shape correctly — a non-src sourceRoot, a second e2e project, an already-broken lint target — and reported what it could not carry as unhandled entries and declared differences rather than dropping them silently.',
			'The three application-source rewrites it made are all correct for the hop: rxjs/Observable collapses onto the package root in RxJS 7, and both zone.js deep specifiers moved in 0.11.',
			'Every one of the seven gaps was reported by a toolchain as a named diagnostic at a named line. None of them is a silent wrong answer, which is the failure mode that would have mattered more.',
		],
		notEstablished: [
			'No migrated build exists. Nothing here establishes that this application can be carried to Angular 16 at all, and nothing establishes that it cannot: the gaps are demands, and none of them was answered.',
			'No browser opened anything, no server was started, and no journey was exercised, in either lane.',
			'The probe measures a tree that is not the migrated lane. Its 264 diagnostics are a census of what the compiler said about one narrowed tree in one configuration; they are not an estimate of remaining work, because answering a module-level demand removes many template-level ones at once.',
			'The gap list is closed at the install stage and open at the compile stage. The install set was closed by narrowing until the tree resolved; the compile set is what one build of one narrowed tree reported, and answering the seven gaps would let the compiler reach code it has not yet read.',
			'`packagesInstalled` counts what npm reported with lifecycle scripts disabled. Nothing here establishes what a scripted install of either manifest does.',
			'The registry readings quoted for G1, G2 and G3 were made under consent VL-LEGACY-CORPUS-2026-08-10 against registry.npmjs.org on 2026-08-14. They are readings of published metadata, not installations, and no line named in a `neededTransform` was installed or built by this unit.',
		],
	};
}

export function buildMigrationRecord(): SealedRecord {
	return sealRecord({
		schemaVersion: 'versionless.angular-pigallery2-migration.v1',
		unit: UNIT,
		consentId: CONSENT,
		commit: COMMIT,
		...buildMigrationBlock(),
	});
}

export async function main(): Promise<void> {
	const record = verifySealedRecord(buildMigrationRecord());
	const attempt = JSON.parse(await readFile(ATTEMPT_FILE, 'utf8')) as Record<string, unknown>;
	attempt['migration'] = record;
	await writeFile(ATTEMPT_FILE, `${JSON.stringify(attempt, null, 2)}\n`);
	process.stdout.write(
		`migration recorded ${String(record['outcome'])}: ${String(GAPS.length)} gaps itemised (` +
			`${String(GAPS.filter((gap) => gap.stage === 'install').length)} install, ` +
			`${String(GAPS.filter((gap) => gap.stage === 'compile').length)} compile), ` +
			`no target build; record digest ${sha256(canonical(record)).slice(0, 12)}\n`,
	);
}

if (process.argv[1]?.endsWith('angular-pigallery2-migration-record.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
