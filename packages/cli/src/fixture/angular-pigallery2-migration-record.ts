/**
 * The Angular holdout result: what the frozen `@versionless/angular` adapter did
 * when it was pointed at `pigallery2 1.7.0`, an application it had never seen.
 *
 * The result is RED, and this record is the red one. Every gap the lane hit is
 * itemised below by package, by declaration, by file and by line — not counted,
 * not summarised, not softened — together with what the era toolchain did
 * instead and why. That list is the falsification evidence T018 was run to
 * produce; a green lane invented there would have destroyed it.
 *
 * The record is amended in place as gaps are answered, and an amendment never
 * edits the demand it answers: a closed gap keeps its `observed` diagnostic and
 * its `neededTransform` exactly as the red run wrote them, and gains a
 * `closedBy` naming the unit, the disposition and the evidence. Two units have
 * amended it. `lrapr-t021/u1` composed the capabilities G5 found unreachable.
 * `lrapr-t021/u2` closed the three install-stage gaps with three cell readings,
 * after which the migrated closure installs and the first migrated build this
 * application has ever had was attempted — it refuses at the compiler, with the
 * four compile-stage gaps still where T018 named them.
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
import {
	sealRecord,
	verifySealedRecord,
	type SealedRecord,
} from './angular-factoriolab-build-lanes-run.ts';
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
	/**
	 * What answered the gap, and where the evidence that it did is — present only
	 * on a gap a later unit closed, absent while it is still open.
	 *
	 * The field exists so that a closed gap stays legible as the gap it was: the
	 * demand above is not rewritten when it is met, and the answer is not written
	 * as though it had always been there.
	 */
	closedBy?: string;
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
		subject: "0.801.2 -> ^16.2.0, written by the cell's `@angular-devkit/` family range",
		library:
			'@angular-devkit/build-optimizer, folded into @angular-devkit/build-angular after the Angular 13 line',
		observed:
			'npm ERR! code ETARGET / npm ERR! notarget No matching version found for @angular-devkit/build-optimizer@^16.2.0.',
		whyTheEraToolchainAccepted:
			'The era manifest declares the package explicitly at 0.801.2, the version paired with @angular-devkit/build-angular 0.801.2, and both existed on the Angular 8 line. pigallery2 declares it because its own gulp pipeline drives the builder directly; most applications never name the package at all, which is why the four Angular verticals the adapter was designed against — tiny-translator, super-productivity, jira-clone, factoriolab — declare none of it and this hole was never exercised.',
		whyTheEngineCannotCarryIt:
			'ANGULAR_16_BROWSER_CELL.families writes `"@angular-devkit/": "^16.2.0"` as a blanket prefix rule, and alignAngularPackageManifest applies a family range to every declared package whose name carries the prefix. The rule is a naming assumption, not a reading: it presumes that every package in a family is published on the family\'s own version line. @angular-devkit/build-optimizer stops at 0.1302.1, its `latest` dist-tag, and is deprecated on the registry with "This package has been folded in @angular-devkit/build-angular and should no longer be needed." No 16.x of it was ever published, so the family rule writes a range naming a version that does not exist, and npm refuses the whole tree before any peer is even considered.',
		neededTransform:
			'The adapter already carries the shape that answers this: ANGULAR_16_ECOSYSTEM_PACKAGES holds `@angular/http` as `kind: "no-successor"` for exactly this reason — a package inside a family prefix that the family\'s own version line never published. What is missing is the entry, not the mechanism, and the entry is a registry reading rather than an invention: the package is deprecated in favour of @angular-devkit/build-angular, which this cell already writes at ^16.2.0, so the declaration is dropped rather than pinned. The general form of the demand is larger than one entry, and it is the one worth stating: a family prefix rule needs a per-package published-line check, because a family is a naming convention and not a release train.',
		closedBy:
			'lrapr-t021/u2. `ANGULAR_16_ECOSYSTEM_PACKAGES` now carries @angular-devkit/build-optimizer as `kind: "no-successor"`, so alignAngularPackageManifest drops the declaration and records a declared difference naming @angular-devkit/build-angular ^16.2.0 as what carries the optimizer now. The general demand was answered where it can be answered: the cell observes no registry, so a per-package published-line check *is* the ecosystem table, and `alignedVersionRange` consulting that table before the family prefix is what makes a reading beat a name. `familyPrefixedEcosystemReadings` makes the overriding set enumerable, and the test suite holds every override to writing something other than its family range. The installed closure confirms the reading rather than merely asserting it: @angular-devkit/build-angular 16.2.16 resolved 2278 packages and @angular-devkit/build-optimizer is in none of them, directly or transitively.',
	}),
	Object.freeze({
		id: 'G2',
		stage: 'install',
		site: 'package.json — devDependencies.ng2-slim-loading-bar',
		subject: '4.0.0, left at its era range because the cell reads no line for it',
		library:
			'ng2-slim-loading-bar 4.0.0 — the newest version ever published, and the `latest` dist-tag',
		observed:
			'npm ERR! code ERESOLVE / npm ERR! Found: @angular/core@16.2.12 … Could not resolve dependency: peer @angular/core@"^2.4.7 || ^4.0.0" from ng2-slim-loading-bar@4.0.0',
		whyTheEraToolchainAccepted:
			"The era closure is Angular 8.1.2 installed by npm 6, which reports an unsatisfied peer as a warning rather than an error and installs anyway. The declared peer `^2.4.7 || ^4.0.0` did not match Angular 8 either — the era build was already resolving this package by npm 6's permissiveness, not by agreement — and the library's pre-Ivy metadata was still readable by the Angular 8 ViewEngine compiler.",
		whyTheEngineCannotCarryIt:
			'The package is absent from ANGULAR_16_ECOSYSTEM_PACKAGES, so ecosystemDispositionOf returns nothing and alignAngularPackageManifest leaves the era pin 4.0.0 in place beside @angular/core ^16.2.0. npm 8 treats an unsatisfiable peer as an error, so the tree is refused. The adapter is not wrong about the package — it has read nothing about it at all, and leaving an era pin is the only thing it can do without inventing a version.',
		neededTransform:
			'A `no-successor` cell disposition, of the kind the table already carries for @angular/http, tslint and codelyzer. The registry reading is unambiguous and closes the question: the full published list ends at 4.0.0, that version is the `latest` dist-tag, and it is the exact version the era workspace pinned — the package is dead, not behind. Dropping it makes the closure resolvable and turns the two application imports it serves into source demands the compiler then states by name: `SlimLoadingBarModule` at frontend/app/app.module.ts:31 and `SlimLoadingBarService` at frontend/app/model/network/network.service.ts:4, plus the `<ng2-slim-loading-bar>` element and its `color` and `height` bindings in frontend/app/ui/frame/frame.component.html. Choosing a replacement loading-bar library is a source decision and is demanded here rather than made.',
		closedBy:
			"lrapr-t021/u2, as a `no-successor` disposition — and the alternative was weighed rather than skipped. An era-parity install policy was the candidate: npm 6 warned where npm 8 errors, so a migrated closure could be told to resolve the way the era resolver did. It was refused, and one reading refuses it. Angular 16 no longer runs ngcc — the @angular/compiler-cli 16.2.12 in this very closure ships it as a stub whose own message reads \"As of Angular 16, 'ngcc' is no longer required and not invoked during CLI builds\" — so nothing on this cell converts a ViewEngine library's metadata for the Ivy linker. Forcing the peer would install bytes the compiler cannot consume, and would do it for every unsatisfiable peer in the manifest rather than for the one that was read. The drop is what the migrated build then reports by name, exactly as this gap predicted it would: `Can't resolve 'ng2-slim-loading-bar'` at frontend/app/app.module.ts:38 and frontend/app/model/network/network.service.ts:2, TS2307 at app.module.ts:31:36 and network.service.ts:4:37. Those four are the declared difference speaking, not a new defect, and the source decision they demand is still open.",
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
		closedBy:
			'lrapr-t021/u2, as an `aligned` disposition — at ^17.0.2, and not at the ^19.1.0 this gap named. The correction is the interesting half. This gap read the declared peers, and on the peers alone 19.1.0 is the newest satisfying line; what the peers cannot say is which Angular built it, because 17.0.0 through 19.1.0 declare exactly the same `>=16.0.0-0` across four majors of the library. That is the condition the table\'s own peer-strictness refinement exists for, so the compiled-with stamps were read: 19.1.0 and 19.0.0 carry Angular "18.0.0", 18.0.0 carries "17.0.3", and 17.0.2 carries "16.0.1". Angular 16 does not link a library stamped 17 or 18, so ^19.1.0 would have installed and then refused at the linker — a resolvable closure that is not a compatible one, which is the exact failure mode G4 names one gap below. The second consequence this gap demanded be checked was checked: 17.0.2 still publishes toastr.css at the package root, angular.json\'s `./node_modules/ngx-toastr/toastr.css` styles entry resolves, and the migrated build no longer says the word toastr anywhere — the two TS2307, the two module-not-found and the one stylesheet refusal the probe recorded are all gone.',
	}),
	Object.freeze({
		id: 'G4',
		stage: 'compile',
		site: 'node_modules/ngx-bootstrap/{collapse,datepicker,dropdown,modal,popover,tooltip}/*.module.d.ts, node_modules/@yaga/leaflet-ng2/lib/geojson.directive.d.ts',
		subject:
			'ngx-bootstrap@5.1.0 (peer @angular/core ">=7.0.0"), @yaga/leaflet-ng2@1.0.0 (peer @angular/core ">=2.0.0"), jw-bootstrap-switch-ng2@2.0.5 (peer @angular/core ">=7.0.0 …") — three era libraries an open-ended peer range let through the resolver',
		library: 'Angular 8 -> 16, read through libraries the cell never read',
		observed:
			"node_modules/ngx-bootstrap/collapse/collapse.module.d.ts:3:23 - error TS2314: Generic type 'ModuleWithProviders<T>' requires 1 type argument(s). (7 of the 8 TS2314 in this build are inside ngx-bootstrap's own published declarations) / node_modules/@yaga/leaflet-ng2/lib/geojson.directive.d.ts:197:5 - error TS2416: Property 'addData' in type 'GeoJSONDirective<T>' is not assignable to the same property in base type 'GeoJSON<any, Geometry>'",
		whyTheEraToolchainAccepted:
			'These libraries were published for the Angular 6-to-8 band and their declarations are correct for it: `ModuleWithProviders` took no type argument until Angular 10 made it required, and @yaga/leaflet-ng2 1.0.0 was compiled against the @types/leaflet of 2019. TypeScript 3.4.5 accepted every one of them.',
		whyTheEngineCannotCarryIt:
			'This is the gap that an install-shaped reading hides. All three declare their @angular peer with an open lower bound and no upper bound — ">=7.0.0", ">=2.0.0" — so npm resolves them against Angular 16 without a word, the closure looks healthy, and the refusal arrives one stage later from the TypeScript program, which reads a dependency\'s published .d.ts files as part of its own compilation. The frozen cell has no entry for any of the three, and nothing in the adapter inspects an installed library\'s declarations. An open-ended peer range is a claim the library author made before Angular 10 existed; it is not evidence of compatibility, and treating a resolvable closure as a compatible one is what turns this into a compile-time surprise.',
		neededTransform:
			'Three `aligned` cell dispositions, read the same way every other table entry is read. The general demand behind them is the one worth recording: the cell selects lines from declared peer ranges, and a package whose declared range does not exclude the target is currently indistinguishable from a package that was read and found compatible. A library that declares an unbounded peer needs its own reading — the published-line list, or the Angular version stamped into its partial declarations, which is the discriminator the table already uses for @ngx-formly/core — rather than being passed through on the strength of a range its author could not have meant.',
		closedBy:
			'lrapr-t021/u3, and the three readings did not come out the way this gap predicted. It asked for three `aligned` dispositions; the registry supported one. ngx-bootstrap is aligned to ^11.0.2 — here the declared peers do discriminate exactly (10.x declares @angular/core ^15.0.0, 11.0.0-11.0.2 declare ^16.0.0, 12.0.0 declares ^17.0.0), so the peer rule alone selects the line and the compiled-with stamp was read to confirm rather than to correct it: 11.0.2 carries version "16.1.4" in every ɵɵngDeclare* call and pins its secondary entry points on that exact @angular/core. It publishes `ModuleWithProviders<CollapseModule>` with its argument, and the seven TS2314 are gone. @yaga/leaflet-ng2 and jw-bootstrap-switch-ng2 are `no-successor`. Neither verdict is a shrug: @yaga/leaflet-ng2 stops at 1.1.0 (2021-05-22), whose lib/geojson.directive.d.ts declares `addData(data: GeoJSONFeature<GeometryObject, T>): Layer` exactly as 1.0.0 does — the newest published line does not answer the TS2416 — and 1.1.0 was built against Angular 12 in full compilation mode, emitting ɵɵdefineDirective calls directly with no ɵɵngDeclare* partial declarations for a linker to read; jw-bootstrap-switch-ng2 stops at 2.0.5 (2019-01-29), the `latest` tag and the exact era pin, published as a pre-Ivy ViewEngine package (metadata.json, fesm5/, declarations carrying no ɵmod at all) on a cell whose ngcc is a stub. The generality this gap asked for is the one that was delivered: an open-ended peer range is now treated as the absence of evidence rather than as evidence, and each of the three was read on its own published bytes.',
	}),
	Object.freeze({
		id: 'G5',
		stage: 'compile',
		site: 'frontend/app/app.routing.ts:71, frontend/app/ui/settings/_abstract/abstract.settings.component.ts:14',
		subject:
			'`export const appRoutes: ModuleWithProviders = RouterModule.forRoot(ROUTES);` and `export abstract class SettingsComponent<T, S> implements OnInit, OnDestroy, OnChanges` — an undecorated base class carrying @Input, @Output and @ViewChild members',
		library:
			'Angular 8 -> 16: ModuleWithProviders became generic in 10, and the Ivy compiler requires an explicit decorator on a class using Angular features',
		observed:
			"frontend/app/app.routing.ts:71:25 - error TS2314: Generic type 'ModuleWithProviders<T>' requires 1 type argument(s). / frontend/app/ui/settings/_abstract/abstract.settings.component.ts:14:23 - error NG2007: Class is using Angular features but is not decorated. Please add an explicit Angular decorator.",
		whyTheEraToolchainAccepted:
			'Angular 8 shipped `ModuleWithProviders` with an optional type parameter, and the pre-Ivy ViewEngine compiler inherited decorator metadata down a class hierarchy without demanding a decorator on the base. Both constructs are idiomatic Angular 8, not defects the application should have avoided.',
		whyTheEngineCannotCarryIt:
			'This one is not a missing capability, and that is what makes it the sharpest finding here. `@versionless/angular` carries `module-with-providers-type-argument.ts` and `unparameterised-base-class.ts` — both are exported from packages/frameworks/angular/src/index.ts, and both are imported by nothing inside the package. `migrateAngularCliEraWorkspace` imports thirteen capability modules and neither of these is among them, so the composed changeset can never run them however many applications it is pointed at. The demand is a wiring demand, not a transform demand: the answer is already written and is not called.',
		neededTransform:
			"Compose the two existing capabilities into the era migration pipeline and let each refuse per site where its own proof fails, exactly as `entry-components-removal` was composed after the super-productivity lane recorded the identical defect against it — that capability is in the era migration's import list today and these two are not, which is the same finding recurring on two more capabilities rather than a new one. Nothing about either capability has to be designed for this application; it has to be reached.",
		closedBy:
			"lrapr-t021/u1 for the `ModuleWithProviders` half and lrapr-t021/u4 for the decorator half, and the two halves did not turn out to be the same demand. Composing `module-with-providers-type-argument` answered app.routing.ts:71 exactly as the gap predicted: the capability was written, tested and unreachable, and reaching it was the whole repair. The `NG2007` half was not a wiring defect at all — no capability in the adapter synthesized a class decorator, and `unparameterised-base-class`, which the gap named, fills type arguments in an `extends` clause and would never have touched it. u4 wrote `undecorated-angular-base-class`, whose transform is the one Angular shipped for its own users on this hop: a class that uses Angular features and carries no decorator gets `@Directive()` with no selector, which marks it as an abstract directive the compiler compiles for its metadata and nothing can instantiate from a template. The precondition is the module's own resolved bindings and never a name — a member decorator that resolves to `@angular/core`'s `Input`, `Output`, `ViewChild`, `HostListener` or their siblings, or an `implements` clause resolving to one of its lifecycle interfaces — so a class with a constructor that merely looks injectable is left alone and reported by the compiler for somebody who knows whether it wants `@Injectable()`. The capability stands down entirely on a pre-Ivy cell, because there the inheritance is exactly what the compiler still performs. abstract.settings.component.ts:14 is decorated, the import was extended rather than added, and the `NG2007` is gone from the build.",
	}),
	Object.freeze({
		id: 'G6',
		stage: 'compile',
		site: 'frontend/app/app.module.ts:122',
		subject: 'return require(`raw-loader!../translate/messages.${locale}.xlf`);',
		library:
			'@angular-devkit/build-angular 0.801.2 -> 16.2, and the transitive raw-loader@1.0.0 that came with the first',
		observed:
			"./frontend/app/app.module.ts:146:9-66 - Error: Module not found: Error: Can't resolve 'raw-loader' in '…/frontend/app'",
		whyTheEraToolchainAccepted:
			"A webpack inline loader specifier: everything before the last `!` names loaders to run, not a module to import. The era closure carried raw-loader@1.0.0 in node_modules — installed as a transitive dependency of @angular-devkit/build-angular@0.801.2, and declared by nothing in the application's own manifest — so webpack 4 found it by hoisting and the era build resolved the chain. The application was relying on a package it never declared, and it worked because something else happened to install it.",
		whyTheEngineCannotCarryIt:
			"The adapter carries exactly one capability for this class of hole, `undeclared-runtime-dependency`, and it is wired into the era migration. Its detection domain is the wrong side of the boundary: undeclaredRuntimeDependencies reads *installed packages* — what each package in the closure declares, and what its shipped bundles import — and closes holes in the application manifest on their behalf. An inline loader chain written in the application's own source, inside a `require()` whose argument is a template literal, is seen by nothing: it is not a package import, no source transform in the adapter parses loader syntax, and the specifier is not even statically complete. @angular-devkit/build-angular 16.2 does not depend on raw-loader, so the accidental hoist is gone and the chain has no resolver.",
		neededTransform:
			'Two separable things, and conflating them is how this would get answered wrongly. The first is a declaration demand: raw-loader is an edge this application relies on and does not declare, and closing it needs a reading of application source for inline loader specifiers — a domain the existing capability does not cover and would have to be extended into, since a loader is a build-time package and not a runtime import. The second is that the construct itself is a webpack idiom the Angular 16 builder still supports but that the application uses to load an xlf translation catalogue at module scope, which is the ViewEngine i18n path recorded in `eraFactsTheMigratedWorkspaceDoesNotCarry` below; answering the declaration without answering the i18n path produces a build that resolves the loader and still does not do what the era build did.',
		closedBy:
			"lrapr-t021/u4 answered the declaration half exactly as the gap separated it, and deliberately did not answer the other half. `application-source-dependency` reads the *application's own* source for package names — static imports and re-exports, and webpack inline loader chains inside `require` — and closes the ones the migrated manifest does not declare. The loader half is read as webpack reads it: every `!`-separated segment before the module request names a loader, `!`, `!!` and `-!` are rule-disabling markers rather than segments, a `?options` tail is stripped, and a relative loader path names no package. A template literal is still read, because the loader segments live in the literal's static prefix even when the request they precede is computed — which is what makes `require(`raw-loader!../translate/messages.${locale}.xlf`)` visible at all. The version is the cell's: raw-loader ^4.0.2, the newest published line, whose peer webpack \"^4.0.0 || ^5.0.0\" is satisfied by the webpack the @angular-devkit/build-angular ^16.2.0 this cell writes builds with, declared in `devDependencies` because a loader is a build-time edge. The module-not-found is gone and the chain resolves. What is *not* claimed: the i18n path. The era build passed `--i18n-locale/--i18n-format/--i18n-file` to a ViewEngine compiler that substituted translations into the factories it emitted, and `translationsFactory` fed that compiler its catalogue at module scope. On Angular 16 that pipeline does not exist — the markers compile to `$localize` tagged templates, which `template-i18n-runtime` declares a runtime for and which loads no locale. The two are not composable into one transform: one is a resolver question about a loader package, the other is a question about which of the application's locales the migrated build should produce and by what mechanism, which is a decision about the application. So the loader-chain half is generic and landed; the i18n half stays in `eraFactsTheMigratedWorkspaceDoesNotCarry` as a stated difference rather than being simulated.",
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
			"A compiler-line demand at one call site, on a member access rather than a specifier. The adapter's source transforms rewrite module specifiers and named imports; nothing in it rewrites a property access against a lib declaration that stopped declaring it, and nothing should invent a cast on the application's behalf.",
		neededTransform:
			'This is a source decision that has to be made explicitly rather than mechanically, and the honest options differ in what they claim. A cast preserves the emitted behaviour and asserts nothing about the type; deleting the line changes behaviour on a platform nobody here tested. It is recorded as a demand, at one line, in one file, with the era reason the author wrote beside it.',
		closedBy:
			"lrapr-t021/u4, by the option this gap said preserves the emitted behaviour, made mechanical without being made blind. `departed-dom-lib-member` is positioned by the compiler's own `TS2339` — the same supply-gated seam `unparameterised-base-class` uses, read here out of the previous migrated build's log — and it acts only where two conditions hold together: the compiler resolved the receiver to `CSSStyleDeclaration`, whose entire published surface is string-valued CSS properties, and the member is spelled as a vendor-prefixed CSS property (`ms`, `webkit`, `moz` or `o` followed by a capital), which is the shape of the surface that departed. Where both hold, the receiver — and only the receiver, at that one access — is widened to `CSSStyleDeclaration & Record<string, string>`: the declared type stays in the intersection so every member that is still declared keeps its own type, and the emitted JavaScript is byte for byte what it was. There is no list of departed properties in the capability and no place to put one; the property is the compiler's word. Everything else refuses by name, including a stale position, which is also what makes a second application of the same diagnostics a no-op. overlay.service.ts:27 now reads `(outer.style as CSSStyleDeclaration & Record<string, string>).msOverflowStyle = 'scrollbar';` and the TS2339 is gone. What it does not claim: that the property exists in any browser the application runs in. The type now admits the assignment the era type admitted; whether `-ms-overflow-style` does anything is a platform question this repository has not tested, and the application's own comment — \"needed for WinJS apps\" — is the only claim on record about it.",
	}),
]);

/**
 * The four generic capabilities `lrapr-t021/u4` added or reached, and what each
 * one is gated on.
 *
 * They are listed by what they read rather than by what they fixed, because that
 * is the property that decides whether a capability generalises: a transform
 * gated on a reading fires wherever the reading holds and stands down everywhere
 * else, and none of these four can be reached by naming this application.
 */
export const U4_CAPABILITIES: readonly Readonly<{
	capability: string;
	gate: string;
	answeredHere: string;
}>[] = Object.freeze([
	Object.freeze({
		capability: 'undecorated-angular-base-class (new)',
		gate: "The module's own resolved bindings: a member decorator resolving to `@angular/core`'s Input/Output/ViewChild/ViewChildren/ContentChild/ContentChildren/HostBinding/HostListener, or an `implements` clause resolving to one of its lifecycle interfaces — on a class carrying no decorator, on a cell whose Angular major is 9 or above. A class with only constructor parameters is left alone: that one wants `@Injectable()` or `@Directive()` depending on what it is, and the constructor does not say which.",
		answeredHere:
			'frontend/app/ui/settings/_abstract/abstract.settings.component.ts:14 — NG2007, one site, `@Directive()` synthesized and the existing `@angular/core` import extended.',
	}),
	Object.freeze({
		capability: 'application-source-dependency (new)',
		gate: "A bare package name written in application source — a static import or re-export, or a webpack inline loader chain inside `require` — that the migrated manifest declares nowhere. The range is the cell's; a package the cell read and found no successor for is reported with every site that needs it and nothing is written. The `@types/` companion is declared only when the *era closure* actually carried one, read off the era lane rather than inferred from a name.",
		answeredHere:
			'raw-loader (app.module.ts:146, inline loader chain, devDependencies ^4.0.2) and leaflet (lightbox.map.gallery.component.ts:15, direct import, dependencies ^1.9.4, with @types/leaflet 1.9.20 beside it). Both module-not-found and both TS2307 are gone. The same reading is what states the wall: the three no-successor libraries are reported by name with their import sites.',
	}),
	Object.freeze({
		capability: 'departed-dom-lib-member (new)',
		gate: "A `TS2339` from the target line's own compiler whose receiver resolved to `CSSStyleDeclaration` and whose member is spelled as a vendor-prefixed CSS property. Supply-gated: a caller that has not compiled the tree supplies no diagnostics and gets no transform.",
		answeredHere:
			'frontend/app/ui/gallery/overlay.service.ts:27 — one receiver widened at one access; the emitted JavaScript is unchanged.',
	}),
	Object.freeze({
		capability: 'deep-import-redirection (existing, composed)',
		gate: 'A reading of what an installed package publishes — its `exports` map and the names its declaration files export. Composed through the same supply-gated seam, one reading per package.',
		answeredHere:
			'Nothing, and being reached is the point. The capability now runs against ngx-bootstrap@11.0.2 for both `ngx-bootstrap/modal/bs-modal-ref.service` sites and refuses both by name: the surface reading resolves no entry point that exports `BsModalRef`, and redirecting the symbols that do resolve would delete the one that does not. That is a refusal with a reading behind it, which is a different state from the unreachable capability G5 named — and it is now visible in `unhandled` where before it was invisible everywhere.',
	}),
]);

/**
 * What the migrated lane still refuses after `lrapr-t021/u4`, and the three ways
 * out of it — none of which is this unit's to take.
 *
 * The number that matters is not 257. It is 8: the three libraries the cell read
 * and found no successor for, at six import sites in four application files, plus
 * the two diagnostics that are consequences of those imports inside the same
 * files. Everything else in the log is `app.module.ts` failing to compile and
 * every template that module scopes failing with it, which `downstreamReading`
 * establishes rather than assumes.
 */
export const U4_WALL = Object.freeze({
	unit: 'lrapr-t021/u4-app-source-transform-wall',
	diagnostics: 257,
	before: 260,
	movement:
		'260 -> 257. NG2007 1 -> 0 (decorator synthesized), TS2339 1 -> 0 (receiver widened), TS2307 7 -> 6 and module-not-found 8 -> 6 (raw-loader and leaflet declared and resolving). Nothing regressed and no diagnostic class appeared. The three that left are the three the generic capabilities could reach; the 257 that remain are one cause and its consequences.',
	wall: Object.freeze([
		'@yaga/leaflet-ng2 — imported at frontend/app/app.module.ts:14, frontend/app/ui/gallery/map/map.gallery.component.ts:7 and frontend/app/ui/gallery/map/lightbox/lightbox.map.gallery.component.ts:16. Three TS2307 and three module-not-found. The cell read it: it stops at 1.1.0, built against Angular 12 in full compilation mode with no partial declarations for a linker to read.',
		'ng2-slim-loading-bar — imported at frontend/app/app.module.ts:31 and frontend/app/model/network/network.service.ts:4. Two TS2307 and two module-not-found. The cell read it: it stops at 4.0.0, whose declared peer is @angular/core "^2.4.7 || ^4.0.0".',
		'jw-bootstrap-switch-ng2 — imported at frontend/app/app.module.ts:41. One TS2307 and one module-not-found. The cell read it: it stops at 2.0.5, a pre-Ivy ViewEngine package, on a cell whose ngcc is a stub.',
		"frontend/app/ui/gallery/map/lightbox/lightbox.map.gallery.component.ts:60 — TS7006, `Parameter 'l' implicitly has an 'any' type`. A consequence of the @yaga import above, not an independent gap: the parameter is contextually typed by a symbol that module cannot resolve.",
		'frontend/app/app.module.ts:126 — NG1010, the @NgModule literal is unanalysable because three of the symbols it names do not resolve. The 249 NG8001/NG8002/NG8003/NG8004 are downstream of exactly this, which `downstreamReading` proves from which bindings fail rather than asserting.',
	]),
	options: Object.freeze([
		'A cell-policy decision: declare a target cell that keeps ngcc, and take the era ViewEngine packages with it. Angular 16 ships ngcc as a stub, so this is not a flag — it is a different cell, on the last line that could still consume pre-Ivy bytes (Angular 12 or 13), which changes what every other reading in this record was taken against. It would answer all three libraries at once and it would answer them by not making this hop.',
		"An application-change decision: replace the three wrappers at their six import sites — @yaga/leaflet-ng2 with direct leaflet (now declared, and the two symbols the lightbox already imports from it are typed), ng2-slim-loading-bar and jw-bootstrap-switch-ng2 with maintained equivalents or with the application's own components. That is outside holdout discipline by construction: this lane exists to measure what a frozen adapter does to source it has never seen, and hand-editing the source is the one move that would destroy the measurement.",
		'Honest RED for full parity: record the lane as refusing, with the wall named to the byte and the three libraries named as the reason. This is the state the record is in, and it is the only one of the three that costs nothing and claims nothing.',
	]),
	notEstablished: Object.freeze([
		'No stub, shim, module declaration or type alias was written for any of the three libraries, and no application source was edited by hand in this lane. Every byte that differs from the corpus was written by a capability, and each is itemised in the changeset record by file and by change.',
		'The build was run once. Nothing here establishes reproducibility across runs for this lane; the two-run byte comparison this record owes is still not one that has been taken at this state.',
		'A gap the compiler no longer reports is not a behaviour that has been witnessed. Three refusals left the log; nothing in this record says the application renders, and nothing could until a build emits something.',
	]),
	logs: Object.freeze([
		'migration/t021-u4-lane-install.log',
		'migration/t021-u4-lane-build-run1.log',
	]),
});

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
	"249 of the 264 diagnostics — every NG8001, NG8002, NG8003 and NG8004 — are downstream of frontend/app/app.module.ts failing to compile, and that is checkable rather than asserted. The two TS2307 in that file leave its @NgModule literal unanalysable, so every component it declares loses its module scope at once. The proof is in which bindings fail: the compiler reports `Can't bind to 'ngClass' since it isn't a known property of 'span'`, `Can't bind to 'routerLink' since it isn't a known property of 'a'`, `'router-outlet' is not a known element` and `No directive found with exportAs 'ngForm'` — CommonModule, RouterModule and FormsModule directives, all three of which app.module.ts imports and all three of which the closure installed correctly. Builtin directives cannot go missing for a dependency reason; they can only go missing for a scope reason. The fifteen diagnostics left are the ones the gaps above name.";

/**
 * The T021 repair of G5, and the audit that decided its shape.
 *
 * G5 was named by T018 as a wiring defect: two capabilities exported from the
 * package index and imported by nothing. The audit that opened T021 asked the
 * larger question the finding implies — how many exported modules the era
 * composition never reaches — and the answer is twenty-four of forty-one, which
 * is why the classification below is by *kind* rather than by name. What
 * separates a capability that belongs in the composition from one that does not
 * is what it needs to decide: a transform whose precondition is readable from the
 * module the composition already holds belongs there; one whose precondition is a
 * reading of an installed closure, a registry or a compiler run is reachable only
 * for a caller that has taken that reading, and its seam is an input to the
 * composition rather than a call inside it.
 */
export const G5_WIRING_REPAIR = Object.freeze({
	unit: 'lrapr-t021/u1-g5-wiring-repair',
	finding:
		'T018 named two never-imported capabilities. The audit found twenty-four of the forty-one modules exported from packages/frameworks/angular/src/index.ts are unreachable from `migrateAngularCliEraWorkspace`, directly or transitively. Most of that is not a defect — it is the difference between a transform the composition can gate on its own and a transform that needs a reading the composition never takes.',
	auditMethod:
		'The import graph of packages/frameworks/angular/src was walked transitively from angular-cli-era-migration.ts. Seventeen modules are reached. The twenty-four that are not were classified by the signature of their transform: what the capability has to be handed before it can decide anything.',
	classes: Object.freeze({
		'a-composed':
			"Precondition readable from the module alone — signature (path, source) — so the composition can gate it on the application's own bytes. Three modules: module-with-providers-type-argument, subject-void-type-argument, promise-executor-void-parameter. All three are now called from the per-module sequence.",
		'a-supply-gated':
			'Precondition is a compiler reading the composition cannot take for itself. One module composed here: unparameterised-base-class, which needs the TS2314 positions and the installed declaration reading. It is now reachable through two optional inputs, `baseClassDiagnostics` and `genericBaseClasses`, on the same idiom `installedPackages` and `packageExports` already use: a tree that supplies none has none migrated, which is a different thing from having none to migrate.',
		'b-driver-seam':
			"Sixteen modules whose transform takes a closure reading, a registry reading, a documented successor claim or a build log as an argument — barrel-entry-point-split, declared-type-member-rename, deep-import-redirection, json-module-named-import, node-core-binding-migration, removed-entry-point-symbol-successor, rxjs-prototype-patch-migration, sass-mixin-hyphenation-successor, split-element-successor, stylesheet-url-rebase, successor-fork-package, suggested-export-rename, web-worker-url-specifier, webpack-tilde-style-specifier, widened-union-narrowing, and the closure half of forms-legacy-disabled-state. Each is a deliberate driver-facing API today: the reading is the capability's whole evidence, and a composition that invented one would be guessing. They are candidates for the same supply-gated seam unparameterised-base-class just got, one reading at a time, and none of them was given it here.",
		'b-workspace-declaration':
			'Three modules that return a manifest or a configuration rather than a migrated file — node-core-runtime-globals, synthetic-default-import-interop, template-i18n-runtime. Their seam is the workspace half of the composition, not the per-module loop.',
		'b-reading-api':
			'template-analysis, a pure template reading with no transform. It is reached transitively by template-i18n-runtime and is not a capability the composition would call.',
	}),
	templateI18nRuntime:
		"Called out separately because T018 flagged it and because this application's era build is a ViewEngine i18n gulp build. It is class (a) by precondition — `declareTemplateI18nRuntime` needs a manifest, the templates and the cell, and the composition already holds all three — and it was NOT composed in this unit, deliberately. Declaring the package is only half of what it does: it hands back a polyfill entry point that has to be declared into the builder target through `declarePolyfillEntryPoint`, which is a second seam in the workspace half of the composition. That seam collides with a green vertical: angular-tiny-translator carries i18n markers and declares its localize runtime through a hand-composed lane (angular-tiny-translator-localize-run.ts), so composing this into the era migration would change what that lane produces. That is a real decision about which of the two paths owns the declaration, and it is left open rather than made by a wiring unit.",
	notAWiringGap:
		'T018 named two compile sites under G5 and attributed both to the wiring defect. The audit finds that only one of them is. frontend/app/app.routing.ts:71 is TS2314 on `ModuleWithProviders` and is exactly what module-with-providers-type-argument answers — it is answered now, and the changeset above records the edit. frontend/app/ui/settings/_abstract/abstract.settings.component.ts:14 is NG2007, `Class is using Angular features but is not decorated`, and `unparameterised-base-class` does not answer it: that capability fills a missing *type argument* on a generic base class the compiler reported as TS2314, and nothing in packages/frameworks/angular/src mentions NG2007 or writes an Angular decorator onto an undecorated class. The second half of G5 is therefore a missing capability after all, not a wiring gap, and it is still open.',
	measuredBeforeAndAfter: Object.freeze({
		applicationFilesScannedBefore: 214,
		applicationFilesScannedAfter: 214,
		applicationFilesChangedBefore: 3,
		applicationFilesChangedAfter: 4,
		workspaceFilesChangedBefore: 3,
		workspaceFilesChangedAfter: 3,
		unhandledBefore: 6,
		unhandledAfter: 7,
		declaredDifferencesBefore: 8,
		declaredDifferencesAfter: 8,
		newApplicationChange:
			'frontend/app/app.routing.ts:71 — module-with-providers-type-argument <RouterModule> read from static-call-receiver. The argument was read from the receiver of the static call the annotation is initialised by, which is the only place this source states it.',
		newRefusal:
			'frontend/app/ui/gallery/share.service.ts line 24: the newly composed promise-executor capability refused the executor because `resolve` is referenced at line 28 other than as the callee of a call, so it escapes and what the promise settles with cannot be read there. A named refusal at a named line is the composition behaving as designed: the count of unhandled entries went up because a capability is now looking, not because something broke.',
		otherCapabilitiesComposed:
			'subject-void-type-argument, promise-executor-void-parameter and unparameterised-base-class are now reachable from the composition and each stood down on this application: no `new Subject()` here proves a void settlement, the one promise executor found was refused by name, and no TS2314 base-class diagnostics were supplied to this lane.',
	}),
	gapsWhoseDiagnosticsChange:
		'G5 only, and only its first site. G1, G2 and G3 are install-stage knowledge gaps in the cell and are untouched by a wiring repair — the lane still refuses at the resolver, and the probe still had to narrow the same four packages. G4, G6 and G7 are unchanged: they name a library declaration reading, an inline webpack loader specifier and a lib.dom member, none of which any composed capability reads. The probe build was not re-run in this unit: with the install-stage gaps still open the probe tree is reached the same narrow way, and re-running it would re-measure the same 264 diagnostics minus the one TS2314 the repair now answers before the compiler ever sees it.',
	notEstablished: Object.freeze([
		'Composing a capability is not building an application. Nothing here establishes that pigallery2 compiles, and the six gaps other than G5 are all still open.',
		'The one changed line is a changeset edit, not a compile. That TS2314 is answered is a claim about what the transform wrote and what the diagnostic asked for; no migrated build has read it.',
		'The audit classifies twenty-four modules by the shape of their transform. That a class (b) module is correctly a driver seam today is a reading of its signature and its documentation, not a proof that it should never be composed.',
	]),
});

/**
 * The T021 closure of the install stage, and the first build of the migrated
 * lane itself.
 *
 * Three cell readings answered G1, G2 and G3, and the thing worth saying about
 * them is what kind of thing they are: none of them mentions this application.
 * Each is a fact about a package — what it published, what it declared, what
 * Angular compiled it — written into the table every other reading is written
 * into, and applied to whatever manifest declares that package. What this unit
 * measured is the consequence: a lane whose closure resolves, and a build that
 * refuses for reasons that are now all named.
 */
export const INSTALL_STAGE_CLOSURE = Object.freeze({
	unit: 'lrapr-t021/u2-install-stage-successors',
	readings: Object.freeze({
		'@angular-devkit/build-optimizer':
			'no-successor. Stops at 0.1302.1 (2022-07-21), the `latest` dist-tag; none of its nine dist-tags points above the 13 line and no 16.x exists. Deprecated on the registry with "This package has been folded in @angular-devkit/build-angular and should no longer be needed." Dropped rather than pinned, and the drop is recorded as a declared difference.',
		'ng2-slim-loading-bar':
			'no-successor. Twenty-eight published versions ending at 4.0.0 (2017-04-04), which is the `latest` dist-tag, the only tag, and the exact version the era workspace pins; it declares peer @angular/core "^2.4.7 || ^4.0.0". Dropped, with the ngcc reading recorded as the reason an era-parity install policy was refused rather than adopted.',
		'ngx-toastr':
			'aligned to ^17.0.2, decided by the compiled-with stamp rather than by the peers, which are identical (">=16.0.0-0") across 17.0.0 to 19.1.0. 17.0.2 is stamped Angular "16.0.1"; 18.0.0 is stamped "17.0.3" and 19.0.0/19.1.0 "18.0.0", all above this cell. 20.0.5, the `latest` dist-tag, declares peer ^21.0.0 and is excluded on the peers alone.',
	}),
	whyNotAnEraParityInstallPolicy:
		'The era ran npm 6, which warns where npm 8 errors, so "install the migrated closure the way the era resolver would have" was a real candidate and it was refused on evidence rather than on taste. Three things are wrong with it here. It is a property of a resolver, not a reading of a package: it would admit every unsatisfiable peer in the manifest, including ones nobody has read, which is the opposite of what this table is for. It would claim compatibility the publisher never declared — a peer range is the author saying which framework the library was built for, and overriding it silently asserts they were wrong. And on this cell it would not even work: Angular 16 removed the ngcc step, so a pre-Ivy library installed past its peer has no path to the Ivy linker at all. A policy that produced an installed tree the compiler cannot read would have converted an honest install refusal into a compile-time surprise, which is precisely the trade G4 was named to warn against.',
	familyPrefixGenerality:
		'G1 asked for something larger than an entry: a per-package published-line check behind the family prefix rule. The honest form of that check in a module which observes no registry is the ecosystem table itself, and the ordering in `alignedVersionRange` is what makes it a check rather than a coincidence — exact package, then generated test toolchain, then community reading, then family prefix, with the prefix last because it is the only one of the four that infers from a name instead of reading a package. `familyPrefixedEcosystemReadings` enumerates the packages whose reading overrides their family range, so the two tables can be checked against each other instead of trusted, and the test suite holds every member of that set to writing something other than the family range.',
	laneInstall: Object.freeze({
		command: 'npm install --no-audit --no-fund --ignore-scripts',
		runtime: 'Node v16.20.2 (darwin-arm64, native), npm 8.19.4, CI=1, lane npm cache',
		firstAttempt: Object.freeze({
			exitStatus: 1,
			refusal:
				'npm ERR! code E404 / 404 Not Found - GET https://registry.npmjs.org/@k3rn31p4nic%2fgoogle-translate-api / "@k3rn31p4nic/google-translate-api@1.0.6" is not in this registry.',
			reading:
				'No ETARGET and no ERESOLVE: the three refusals this unit set out to close did not occur, and what the resolver reached instead is the pre-existing registry break the era baseline recorded on the *unmigrated* manifest in the previous unit. It is not a migration gap and it is not counted as one.',
			log: 'migration/t021-lane-install-e404.log',
		}),
		secondAttempt: Object.freeze({
			exitStatus: 0,
			installed: 'added 2278 packages in 12s',
			log: 'migration/t021-lane-install.log',
		}),
		registryClosureBreak: Object.freeze({
			package: 'xlf-google-translate@1.0.0-beta.15',
			whatIsGone:
				'its declared dependency @k3rn31p4nic/google-translate-api@1.0.6; GET https://registry.npmjs.org/@k3rn31p4nic%2fgoogle-translate-api returns 404 for the whole package, re-checked on 2026-08-14 and unchanged since the era baseline unit recorded it',
			whatItGates:
				"the xlf-google-translate CLI, used only by this workspace's gulp translation-authoring tasks; it is named by no build target and imported by no module",
			handling:
				'The same narrowing the era baseline lane performed for the same package, for the duration of the install only: the single devDependency line was removed, npm ran, and the authored manifest was written back. It is not a cell disposition and no version was chosen for the package — the migrated manifest in the lane declares xlf-google-translate@1.0.0-beta.15 exactly as the changeset wrote it.',
			manifestDigests: Object.freeze({
				authoredSha256: '0bf131b8bf934ee468824c7b9c9acd44442fcccd4a2fdbb926c134612dd855f6',
				installTimeSha256:
					'34475a7b171d4f7dd56c0683eaf0f795d9107cb91d6634d6b1b9059cc4a4da2d',
				restoredSha256: '0bf131b8bf934ee468824c7b9c9acd44442fcccd4a2fdbb926c134612dd855f6',
				restoreProof:
					'the restored digest equals the authored digest, so the build below ran against the manifest the changeset produced and not against the narrowed one',
			}),
			openDecision:
				"Whether the cell should read this package at all is left open rather than decided here. The reading exists — 1.0.0-beta.23 and everything after it drop the deleted dependency, and 1.0.4 is the newest published line, declaring no peers and no engines — and under the table's own rule that is the line it would select, in the same way `jira2md` is in the table because an unresolvable declaration is not a closure. It was not written, because it is a fourth disposition on a package outside the three gaps this unit was cut to close, and a table entry is a claim that should be made deliberately.",
		}),
		lockfile:
			'npm wrote package-lock.json v2 into the lane, 2312 entries, pinning @angular/core 16.2.12, @angular-devkit/build-angular 16.2.16 and ngx-toastr 17.0.2. It is the lockfile of the closure npm actually resolved, which is the narrowed one: it carries no xlf-google-translate entry, and that is the one respect in which it differs from the manifest beside it.',
		engineWarning:
			'npm reported EBADENGINE for the root package: pigallery2 declares `engines.node ">= 6.9 <11.0"` and the cell runs Node 16.20.2. It is a warning under npm 8 and nothing was overridden to silence it, but it is a real finding for a later unit — the era manifest\'s own engines range excludes the Node line the target cell is declared against, and nothing in the migration rewrites it.',
	}),
	laneBuild: Object.freeze({
		firstMigratedBuild:
			'This is the first build of the migrated lane that has ever existed for this application. T018 could not attempt one — its closure did not install — and everything it measured about the compiler came from a separate narrowed probe tree.',
		command:
			'node --max_old_space_size=4096 ./node_modules/@angular/cli/bin/ng.js build --configuration production',
		runs: 1,
		runsNote:
			'Run once, deliberately. A two-run byte comparison is a determinism claim about emitted artifacts, and this build emits none; running it twice would have compared two failure logs, which the probe already did in the previous unit.',
		exitStatus: 1,
		artifactsEmitted: 0,
		artifactsNote: 'No dist directory exists after the run.',
		log: 'migration/t021-lane-build-run1.log',
		diagnosticCounts: Object.freeze({
			NG2007: 1,
			NG8001: 45,
			NG8002: 184,
			NG8003: 18,
			NG8004: 2,
			TS2307: 2,
			TS2314: 7,
			TS2339: 1,
			TS2416: 1,
		}),
		moduleNotFound: Object.freeze([
			"./frontend/app/app.module.ts:38 — Can't resolve 'ng2-slim-loading-bar' (the G2 declared difference)",
			"./frontend/app/model/network/network.service.ts:2 — Can't resolve 'ng2-slim-loading-bar' (the G2 declared difference)",
			"./frontend/app/app.module.ts:146 — Can't resolve 'raw-loader' (G6, unchanged)",
		]),
		comparedToTheProbe:
			"The probe's 264 diagnostics and this build's 261 are counts of two different trees, and the comparison is worth making only where the difference is attributable. Three diagnostic classes moved and each moves for a named reason. TS2314 fell from 8 to 7: the one at frontend/app/app.routing.ts:71 is answered by the capability the previous unit composed, and the seven that remain are all inside ngx-bootstrap's own published declarations, which is G4 and nobody else. TS2307 fell from 4 to 2: the two naming ngx-toastr are gone because the package is installed at 17.0.2 rather than narrowed away, and the two naming ng2-slim-loading-bar remain because the cell dropped it. Module-not-found fell from 6 to 3 for the same reason, including the `./node_modules/ngx-toastr/toastr.css` stylesheet refusal G3 warned a disposition would have to be checked against. Nothing else moved: NG8001, NG8002, NG8003, NG8004, TS2339, TS2416 and the single NG2007 are identical in both.",
		whatRemains:
			"Four compile-stage gaps, all of them where T018 left them. G4 is seven TS2314 inside ngx-bootstrap 5.1.0's declarations and one TS2416 inside @yaga/leaflet-ng2 1.0.0 — three era libraries an open-ended peer range let through the resolver, which is the failure mode that makes a resolvable closure look like a compatible one. G5's remaining half is the single NG2007 at frontend/app/ui/settings/_abstract/abstract.settings.component.ts:14, a genuinely missing capability rather than a wiring gap. G6 is the inline `raw-loader!` specifier at frontend/app/app.module.ts:146. G7 is `msOverflowStyle` at frontend/app/ui/gallery/overlay.service.ts:27:19. The 249 template diagnostics are unchanged and are still downstream of app.module.ts failing to compile — the reading below holds, with the two surviving TS2307 in that file now being the ng2-slim-loading-bar imports the declared difference produced.",
	}),
	notEstablished: Object.freeze([
		'An installed closure is not a compatible one. Nothing here establishes that any package this cell aligned behaves as its era version did; it establishes that npm resolved a tree and that the compiler read it.',
		'The migrated build refuses. No artifact was emitted, no parity was measured, no browser opened anything, and no journey was exercised.',
		"The install ran with lifecycle scripts disabled, so nothing here says what a scripted install of this manifest does — this application's own `install` script is `tsc && gulp build-prod`.",
		'The three readings were made against registry.npmjs.org and unpkg.com on 2026-08-14 under consent VL-LEGACY-CORPUS-2026-08-10. A registry reading is a reading of published metadata at a moment; the closure that resolved from it is the check that it was current.',
		'Dropping ng2-slim-loading-bar removes a loading bar from this application. The declared difference says so; choosing a replacement is a source decision no table makes.',
	]),
});

/**
 * The T021 closure of the dependency half of the compile stage, and the second
 * build of the migrated lane.
 *
 * The install stage asked what a resolver would accept. This stage asks the
 * question the resolver cannot: what the compiler can read. Three libraries
 * reached the Angular 16 program on the strength of a peer range with no upper
 * bound, and the readings below are what each of them published rather than what
 * each of them claimed. One had a line for this cell; two had none, and saying so
 * is a declared difference rather than a defect.
 *
 * The fourth reading is not an Angular reading at all, and the fifth is not a
 * reading — it is a capability. Both are here because the same build reported
 * them.
 */
export const COMPILE_STAGE_DEPENDENCY_CLOSURE = Object.freeze({
	unit: 'lrapr-t021/u3-compile-stage-dependency-readings',
	readings: Object.freeze({
		'ngx-bootstrap':
			'aligned to ^11.0.2. This is the one entry of the three whose declared peers discriminate exactly, so the peer rule decided it and the stamp confirmed it rather than correcting it: the 10.x line declares @angular/core, @angular/common, @angular/forms and @angular/animations "^15.0.0", 11.0.0 through 11.0.2 declare "^16.0.0", and 12.0.0 moves to "^17.0.0". 11.0.2 is the newest 11.x published (2023-07-13). Its published partial declarations carry version "16.1.4" in every ɵɵngDeclare* call and its secondary entry points pin peer @angular/core at that exact version. The seven TS2314 the era 5.1.0 produced are gone: 11.0.2 declares `static forRoot(): ModuleWithProviders<CollapseModule>` with its argument. The styles path angular.json names — ./node_modules/ngx-bootstrap/datepicker/bs-datepicker.css — is still published at that path and is named in the package\'s own exports map, so it kept resolving, which is the check the ngx-toastr reading taught this table to make.',
		'@yaga/leaflet-ng2':
			'no-successor. Thirteen published versions ending at 1.1.0 (2021-05-22), the `latest` dist-tag, with nothing after it; every version declares peer @angular/core ">=2.0.0", an unbounded range written before Angular 5 shipped. Two readings had to hold before the drop was honest and both do. The newest line does not fix the declaration the compiler refused: 1.1.0 declares `addData(data: GeoJSONFeature<GeometryObject, T>): Layer` in lib/geojson.directive.d.ts exactly as 1.0.0 does, narrowing the base signature of the @types/leaflet it still depends on at ^1.2.8. And the newest line is not published in a form this cell links: 1.1.0 was built against Angular 12 (its devDependencies pin @angular/* ^12.0.0) in full compilation mode, emitting ɵɵdefineDirective and ɵɵProvidersFeature calls directly into lib/*.js with no ɵɵngDeclare* partial declarations and no ViewEngine metadata.json — the private instruction API of the runtime it was compiled with, and nothing for a linker to re-emit. No verified fork under another name was found, so the successor-fork rule had nothing to act on.',
		'jw-bootstrap-switch-ng2':
			'no-successor. Twenty-five published versions ending at 2.0.5 (2019-01-29), which is the `latest` dist-tag, the only tag, and the exact version the era workspace pins — dead rather than behind, the same shape as ng2-slim-loading-bar. Its peer @angular/core "^6.0.0-rc.0 || ^6.0.0 || >=7.0.0" has an unbounded last alternative, which is why the resolver never objected. What it published is a pre-Ivy ViewEngine library in Angular Package Format v6: jw-bootstrap-switch-ng2.metadata.json beside bundles/*.umd.js, esm5/ and fesm5/, and declarations carrying no ɵmod, ɵfac or ɵcmp — `export declare class JwBootstrapSwitchNg2Module {}` is the whole module declaration. @angular/compiler-cli 16.2.12 ships ngcc as a stub, so nothing on this cell converts it.',
		'xlf-google-translate':
			'aligned to ^1.0.4, and this one is not an Angular reading. It declares no peers and no engines on any line, so neither axis of the cell excludes it; what excluded the era line was the registry itself. 1.0.0-beta.13 through 1.0.0-beta.21 declare a dependency on @k3rn31p4nic/google-translate-api, deleted from the public registry, so a manifest naming one of them reaches E404 before a peer is read. The package dropped that dependency at 1.0.0-beta.22, and 1.0.1 onward declare {xml2js 0.6.2, typeconfig 2.3.1, reflect-metadata 0.2.2}. 1.0.4 is the newest and the `latest` tag. The jira2md precedent governs: an unresolvable declaration is not a closure, and aligning it onto a resolvable registry range is what carries the package into the migrated closure instead of a narrowing performed around it. The bin entry a script names is unchanged — {"xlf-google-translate": "./cli.js"} on both lines.',
	}),
	whyTwoOfThreeAreDrops:
		'This gap predicted three aligned dispositions and the registry supported one, which is the more useful result. An open-ended peer range is the absence of evidence, not evidence: it says nothing about whether a line exists for the target, so each package had to be read on its published bytes rather than on its declared range. For ngx-bootstrap the bytes say a line exists. For the other two the bytes say the newest published version is a pre-Ivy or full-compilation artifact of a dead line, and there is no version to align to. Reporting that as a declared difference is the only honest disposition available; a forced install would have produced bytes the Ivy linker cannot consume, which is exactly what the install stage already refused to do.',
	engineRetargetCapability: Object.freeze({
		module: 'packages/frameworks/angular/src/workspace-engines-retarget.ts',
		entryPoint: 'retargetWorkspaceEngines, composed into migrateAngularCliEraWorkspace',
		shape: "It rewrites one field, to one value, under one condition. One field: engines.node, with a sibling engines.npm or engines.yarn left exactly as written and reported by name, because the cell declares a Node line and states nothing about package managers. One value: the caret range on the cell's own AngularTargetCell.nodeLine, so no version string appears in the capability and a cell declaring a different Node line writes a different range without a line changing there. One condition: the rewrite happens only where the declaration the workspace made *excludes* the cell's Node line — a workspace declaring no engines keeps none, a declaration that already admits the cell is left alone, and a range shape the reader does not understand stands the capability down and is reported. The reading covers >=, >, <=, <, =, ^, ~, a bare version, * and alternatives joined by ||, and refuses hyphen ranges, x-ranges and prereleases.",
		whyNotWider:
			'Adding an engines block to a workspace that declares none would be a constraint the workspace never made, and narrowing a declaration that already admits the cell would overwrite a decision its author took for reasons the cell cannot see. Both were available and both were refused; the third state, `unreadable`, exists so that a declaration this reader cannot evaluate is never rewritten on a guess.',
		observedEffect:
			"The era workspace declared engines.node \">= 6.9 <11.0\" and every npm command under the migrated manifest reported `EBADENGINE ... package: 'pigallery2@1.7.0', required: { node: '>= 6.9 <11.0' }, current: { node: 'v16.20.2' }`. The migrated manifest now declares \"^16.20.2\" and that warning is gone: the three EBADENGINE warnings remaining in the install log name node-releases@2.0.53, figlet@1.11.4 and commander@14.0.3, all third-party transitives declaring a newer Node than this cell runs, and none of them is the workspace.",
		notEstablished:
			'Retargeting a declaration is not a runtime claim. Nothing here establishes that this application runs on Node 16.20.2, only that the manifest now declares the line the cell it installs for was declared against.',
	}),
	laneInstall: Object.freeze({
		command: 'npm install --no-audit --no-fund --ignore-scripts',
		runtime: 'Node v16.20.2 (darwin-arm64, native), npm 8.19.4, CI=1, lane npm cache',
		laneReset:
			"The lane tree was re-cut from the immutable corpus before the changeset was recomposed, so that this measurement is of the whole changeset rather than of an edit applied over the previous one. A fresh cut restores the era package-lock.json, and the lane's established handling of it applies: it is moved out before the install, and the copy retained at .versionless/work/angular-pigallery2/target/logs/era-package-lock.json is byte-identical to the one removed, sha256 c23f860dcc7e2b395d68c0fc5393e0a5656a93f0d0fdf495d107b597fed3e253.",
		attemptsBeforeTheLockfileWasMovedOut: Object.freeze({
			count: 2,
			exitStatus: 1,
			refusal:
				'npm WARN old lockfile / Could not fetch metadata for @k3rn31p4nic/google-translate-api@1.0.6 ... 404, followed by npm ERR! code ERESOLVE naming @angular-devkit/build-angular@0.801.2 as "Found".',
			reading:
				"Not a migration finding and not counted as one. The era package-lock.json is a v1 lockfile of the 2019 Angular 8 closure, and it still pins the registry-deleted @k3rn31p4nic/google-translate-api@1.0.6 whatever the manifest beside it says; npm 8's one-time v1 fix-up fails on that fetch and derails the ideal-tree build into a spurious peer conflict. It is the state the lane's own procedure removes, and these two attempts are recorded because they happened, not because they measure anything.",
		}),
		attempt: Object.freeze({
			exitStatus: 0,
			installed: 'added 2276 packages in 16s',
			log: 'migration/t021-u3-lane-install.log',
			noNarrowing:
				'No package was removed from the manifest for the duration of this install, and none was added. The E404 the previous unit had to narrow around is gone because the cell now reads xlf-google-translate at ^1.0.4 rather than leaving the era beta line in place — the authored migrated manifest is the manifest that installed, which the previous unit could not say.',
		}),
		installedVersions: Object.freeze({
			'ngx-bootstrap': '11.0.2',
			'xlf-google-translate': '1.0.4',
			'ngx-toastr': '17.0.2',
			'@angular/core': '16.2.12',
			typescript: '5.1.6',
		}),
		absentFromTheClosure: Object.freeze([
			'@yaga/leaflet-ng2 (no-successor)',
			'jw-bootstrap-switch-ng2 (no-successor)',
			'ng2-slim-loading-bar (no-successor, T021 u2)',
		]),
		lockfile:
			'npm wrote a fresh package-lock.json v2 into the lane, 2310 entries. It is the lockfile of the closure npm resolved from the authored migrated manifest, with no narrowing standing between them.',
	}),
	laneBuild: Object.freeze({
		command:
			'node --max_old_space_size=4096 ./node_modules/@angular/cli/bin/ng.js build --configuration production',
		runs: 1,
		runsNote:
			'Run once, deliberately, for the same reason the previous unit gave: a two-run comparison is a determinism claim about emitted artifacts, and this build emits none.',
		exitStatus: 1,
		artifactsEmitted: 0,
		artifactsNote: 'No dist directory exists after the run.',
		log: 'migration/t021-u3-lane-build-run1.log',
		diagnosticCounts: Object.freeze({
			NG1010: 1,
			NG2007: 1,
			NG8001: 45,
			NG8002: 184,
			NG8003: 18,
			NG8004: 2,
			TS2307: 7,
			TS2314: 0,
			TS2339: 1,
			TS2416: 0,
			TS7006: 1,
		}),
		totalErrorLines: 260,
		comparedToTheFirstMigratedBuild:
			"261 diagnostics became 260, and the flat total is the least interesting thing about the comparison. TS2314 fell 7 -> 0: every one of the seven was inside ngx-bootstrap 5.1.0's own published *.module.d.ts, and ^11.0.2 publishes the type argument they were missing. TS2416 fell 1 -> 0: the only one was inside @yaga/leaflet-ng2's geojson.directive.d.ts, and the package is dropped. Those two are the whole of G4's original observation and both are closed. Against that, TS2307 rose 2 -> 7 and module-not-found rose 3 -> 8, and every one of the five additions is a declared difference speaking rather than a new defect: @yaga/leaflet-ng2 at app.module.ts:14, map.gallery.component.ts:7 and lightbox.map.gallery.component.ts:16; jw-bootstrap-switch-ng2 at app.module.ts:41; and `leaflet` at lightbox.map.gallery.component.ts:15. Two diagnostics are new in kind and both are downstream: NG1010 at app.module.ts:126 is the @NgModule decorator argument the Ivy compiler can no longer statically evaluate while three of the symbols in its `imports` array are error-typed, and TS7006 at lightbox.map.gallery.component.ts:60 is an implicit `any` on a parameter that used to be typed by @types/leaflet. NG2007, TS2339 and the 249 template diagnostics (NG8001 45, NG8002 184, NG8003 18, NG8004 2) are identical in both builds.",
		newFindingsThisUnitProduced: Object.freeze([
			"`leaflet` is an undeclared edge this application relied on. frontend/app/ui/gallery/map/lightbox/lightbox.map.gallery.component.ts imports 'leaflet' directly and the manifest declares neither leaflet nor @types/leaflet on any line — both arrived transitively as dependencies of @yaga/leaflet-ng2, which declared leaflet ^1.3.2 and @types/leaflet ^1.2.8. Dropping the Angular wrapper removed the runtime library and its types with it. This is the class `undeclared-runtime-dependency` exists for, and it is not reachable as composed: that capability reads the *installed* packages handed to the migration, and this edge only becomes visible after a cell disposition removes the package that was supplying it. The demand is a second reading against the migrated closure, and it is named here rather than answered.",
			"TS7006 at lightbox.map.gallery.component.ts:60:28, `Parameter 'l' implicitly has an 'any' type`, is downstream of the same removal: the parameter was contextually typed by @types/leaflet. It is recorded as a consequence, not as an independent gap.",
			'NG1010 at frontend/app/app.module.ts:126:12 is the @NgModule metadata the compiler cannot statically evaluate while YagaModule, SlimLoadingBarModule and JwBootstrapSwitchNg2Module are unresolved. It will not survive the source decisions those three drops demand, and no capability is proposed for it.',
			"The ngx-bootstrap `exports` map narrowing did *not* produce a diagnostic in this build. 5.1.0 published no exports map and this application reaches past the public surface twice — `import {BsModalRef} from 'ngx-bootstrap/modal/bs-modal-ref.service'` in share.gallery.component.ts:12 and random-query-builder.gallery.component.ts:10 — and 11.0.2 names only its documented entry points in `exports`. Neither the TypeScript program nor the webpack resolver reported the specifier in this run. The reading is recorded because it was made and because the risk is real: the symbol is re-exported from `ngx-bootstrap/modal`, so `deep-import-redirection` is the capability that answers it, and it is one of the modules the composed era migration does not import. Nothing here establishes that the specifier resolves; it establishes that this build did not name it.",
		]),
		whatRemains:
			"Three compile-stage demands and one set of source decisions. G5's remaining half is the single NG2007 at frontend/app/ui/settings/_abstract/abstract.settings.component.ts:14. G6 is the inline `raw-loader!` specifier at frontend/app/app.module.ts:146, and app.module.ts still fails, so the 249 template diagnostics stay downstream of it exactly as the previous reading said. G7 is `msOverflowStyle` at frontend/app/ui/gallery/overlay.service.ts:27:19. Beside them are the source decisions three no-successor dispositions demand — a loading bar, a switch component, an Angular Leaflet wrapper and the `leaflet` declaration it was hiding — none of which a version table makes.",
	}),
	notEstablished: Object.freeze([
		'An installed closure is not a compatible one, and an aligned line is not a behavioural equivalence. Nothing here establishes that ngx-bootstrap 11.0.2 renders what 5.1.0 rendered, or that xlf-google-translate 1.0.4 translates what the beta line translated.',
		'The migrated build refuses. No artifact was emitted, no parity was measured, no browser opened anything.',
		"Dropping @yaga/leaflet-ng2 removes this application's map, and dropping jw-bootstrap-switch-ng2 removes a form control. The declared differences say so by name; choosing replacements is a source decision no table makes.",
		'The readings were made against registry.npmjs.org and the published tarballs of the named versions on 2026-08-14 under consent VL-LEGACY-CORPUS-2026-08-10. A registry reading is a reading of published metadata at a moment; the closure that resolved from it is the check that it was current.',
		'The engines retarget is a declaration, not a runtime verification. No process was run under a different Node line to establish what this workspace needs.',
	]),
});

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
			"The same reason both prior Angular migrated lanes disabled them, and one more this application adds: the manifest carries sqlite3, sharp, bcrypt and the ffmpeg/ffprobe installers, whose install hooks fetch or compile native bindings, and the root package's own `install` script is `tsc && gulp build-prod`, which would have driven a build before anything was measured. Nothing here establishes what a scripted install of this manifest does.",
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
		artifactsNote:
			'No dist directory exists after either run. Nothing was emitted to inventory or compare.',
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
	"The era production build is an i18n build. The repository's gulp task passes `--i18n-locale en --i18n-format=xlf --i18n-file=frontend/translate/messages.en.xlf --i18n-missing-translation warning` to the Angular 8 CLI, and the application loads the same catalogue a second way at module scope through the raw-loader chain of G6. angular.json itself declares no i18n at all, so the workspace migration has nothing to read and nothing to carry: the migrated workspace has no i18n configuration, and the 16.2 CLI does not accept the era flags. `@versionless/angular` does carry a `template-i18n-runtime` capability — and it is one of the twenty-eight modules exported from the package index that the composed era migration never imports, the same wiring gap G5 names.",
	'`extractCss: true` was removed from the production configuration by the workspace migration, as a 16.2 line that always extracts. Recorded as a declared difference by the adapter itself, not discovered here.',
	'Both TSLint targets and tslint.json were dropped, and the pigallery2 lint target was already broken at the pin: it names src/tsconfig.app.json and src/tsconfig.spec.json, paths this tree does not contain, because the sources live under frontend/.',
	'The protractor e2e target was removed with no replacement, and the adapter reported it unhandled.',
	'The era build emitted differential loading output — polyfills.js and polyfills-es5.js with a nomodule script tag. tsconfig target moved es5 -> ES2022, so a migrated build that reached emit would not emit an es5 bundle. No migrated build reached emit, so this is a property of the changeset and not an observation.',
]);

export function buildMigrationBlock(): Readonly<Record<string, unknown>> {
	return {
		unit: UNIT,
		result: "RED — the migrated closure installs from the manifest as authored, and the migrated build refuses at the compiler on demands that are now all source demands rather than dependency demands. T018 measured this application against a frozen adapter and it stopped at the resolver with three install-stage gaps and four compile-stage ones. The three install gaps are closed by three cell readings (T021 u2); G4, the dependency half of the compile stage, is closed by four more (T021 u3) — ngx-bootstrap aligned to ^11.0.2, @yaga/leaflet-ng2 and jw-bootstrap-switch-ng2 dropped as no-successor, xlf-google-translate aligned to ^1.0.4 — and the engines retarget capability removed the EBADENGINE the previous build reported against the workspace itself. The second migrated build ran: exit 1, 260 diagnostics, no artifact. TS2314 7 -> 0 and TS2416 1 -> 0, which is the whole of G4's observation; TS2307 2 -> 7 and module-not-found 3 -> 8, every addition a declared difference speaking by name. G5's NG2007, G6's raw-loader chain and G7's msOverflowStyle are where T018 left them.",
		outcome: 'red-migration-gaps-itemised',
		startedAt: '2026-08-14T01:06:00Z',
		completedAt: '2026-08-14T01:30:00Z',
		completedAtNote:
			"The timestamps above are T018's. This record is amended in place by the units that answer its gaps — lrapr-t021/u1 for the composition wiring, lrapr-t021/u2 for the install stage — and each amendment carries its own unit and its own evidence rather than rewriting the run that found the gap.",
		scope: 'Compose the frozen `@versionless/angular` changeset over the pinned corpus, write it into a migrated lane, install the migrated closure and build it. No adapter edit, no application-source hand edit, no app-name or revision branch anywhere in the engine. The freeze fingerprint 4df7bc961033fc5856b4d58e0bca9f11ad2aa9d43aaaee726956f34d209b37e7 is unchanged, and the Angular subtree oid ca3824d0595d1fa88d37feda6b1785dfd79e72c4 did not move.',
		holdoutMeaning:
			'This is the falsification result the holdout was run to produce. pigallery2 was never ingested, fixtured, adapted or receipted in this repository before T018, and the adapter was frozen before this unit started, so nothing in the engine was shaped by this application. Seven gaps are named below. Two of them — G1 and G5 — are not gaps in what the adapter knows but in how it is composed, which is the more useful half of the result: G1 is a family-prefix rule applied without a published-line check, and G5 is two capabilities that exist, are exported, and are called by nothing.',
		freeze: {
			compositeFingerprint:
				'4df7bc961033fc5856b4d58e0bca9f11ad2aa9d43aaaee726956f34d209b37e7',
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
				"The cell is the adapter's own, unchanged and unforced. `ANGULAR_TARGET_CELLS` carries exactly one entry and the driver names it; no Vite path exists for Angular in this engine and none was reached for. The builder identity is carried across the hop rather than swapped: the era workspace declares `@angular-devkit/build-angular:browser` and so does the migrated one.",
			node: 'v16.20.2 (darwin-arm64, native — no translation layer), npm 8.19.4, from the runtime cell the Angular 16 verticals already materialised at .versionless/cache/angular-jira-clone-runtime. The runtime was not re-acquired.',
		},
		lanes: {
			corpus: `.versionless/cache/angular-pigallery2-v1-7-0-source/corpus/pigallery2-${COMMIT}`,
			migrated: '.versionless/work/angular-pigallery2/target/app',
			probe: '.versionless/work/angular-pigallery2/target-probe/app',
			eraBaseline:
				'.versionless/work/angular-pigallery2/baseline (the previous unit, untouched by this one)',
		},
		changeset: {
			record: 'migration/u3-composed-changeset.json',
			appliedRecord: 'migration/u3-source-migration.json',
			applicationFilesScanned: 214,
			applicationFilesChanged: 6,
			workspaceFilesChanged: 3,
			filesRemoved: ['tslint.json'],
			unhandled: 12,
			declaredDifferences: 16,
			declaredDifferencesNote:
				'Eight at T018, ten after the install-stage readings, thirteen now. The two the install stage added are the removals of @angular-devkit/build-optimizer and ng2-slim-loading-bar. The three the compile-stage readings added are the removals of @yaga/leaflet-ng2 and jw-bootstrap-switch-ng2, and the engines.node retarget from ">= 6.9 <11.0" to "^16.20.2". ngx-bootstrap, ngx-toastr and xlf-google-translate added none between them: an aligned range is a change with a reason, not a difference the migrated workspace has to declare.',
			applicationSourceChanges: [
				'frontend/app/app.routing.ts:71 — module-with-providers-type-argument <RouterModule> read from static-call-receiver',
				'frontend/app/ui/faces/faces.component.ts:6 — module-specifier rxjs/Observable -> rxjs',
				'frontend/app/ui/gallery/overlay.service.ts:27 — departed-dom-lib-member outer.style.msOverflowStyle, receiver widened to CSSStyleDeclaration & Record<string, string>',
				'frontend/app/ui/settings/_abstract/abstract.settings.component.ts:14 — undecorated-base-class @Directive() on SettingsComponent, which uses @Input on simplifiedMode, @Output on hasAvailableSettings, @ViewChild on form, implements OnChanges, OnDestroy, OnInit (existing import extended)',
				'frontend/polyfills.ts:45 — module-specifier zone.js/dist/zone -> zone.js',
				'frontend/test.ts:3 — module-specifier zone.js/dist/long-stack-trace-zone -> zone.js/plugins/long-stack-trace-zone',
			],
			applicationSourceNote:
				'Six application files changed out of 214 scanned, every one of them by a capability and none of them by hand. Three are module-specifier rewrites the adapter made as T018 froze it. The fourth is the T021 u1 wiring repair — `module-with-providers-type-argument` composed, so app.routing.ts:71 is answered where the frozen composition could not reach the capability at all. The last two are u4: `departed-dom-lib-member` widening one receiver at one access, and `undecorated-angular-base-class` synthesizing `@Directive()` on the one class that uses Angular features without carrying a decorator. Two further capabilities changed the manifest rather than a source file — `application-source-dependency` declaring raw-loader, leaflet and @types/leaflet — and one more, `deep-import-redirection`, ran and refused both of its sites by name. No application file was edited by hand in any lane.',
			g5WiringRepair: G5_WIRING_REPAIR,
			compilationUnitNote:
				'This workspace is not src/-rooted: angular.json declares `sourceRoot: "frontend"`, and the frontend modules import across into the sibling common/ directory that the backend also compiles. Both directories were handed to the migration, because both are inside what the browser build\'s TypeScript program reads. Supplying only the declared sourceRoot would have scanned a strict subset of the compilation unit.',
		},
		laneInstall: {
			command: 'npm install --no-audit --no-fund --ignore-scripts',
			exitStatus: 1,
			outcome: 'refused at dependency resolution; nothing was linked',
			firstRefusal: 'ERESOLVE on ng2-slim-loading-bar@4.0.0 (G2)',
			eraLockfileHandling:
				"The era package-lock.json was moved out of the lane before the install and retained at .versionless/work/angular-pigallery2/target/logs/era-package-lock.json. It pins the complete 2019 Angular 8 closure; leaving a v1 lockfile of that closure beside an Angular 16 manifest would have described a tree that does not exist. This mirrors what the super-productivity migrated lane did with that application's era yarn.lock.",
			log: 'migration/lane-install-red.log',
			supersededBy:
				'This is the T018 measurement and it is kept as one. The same lane, installed again after the three cell readings T021 u2 landed, resolves and links 2278 packages; `installStageClosure.laneInstall` records that run, its two attempts and the manifest digests that bound them.',
		},
		installStageClosure: INSTALL_STAGE_CLOSURE,
		compileStageDependencyClosure: COMPILE_STAGE_DEPENDENCY_CLOSURE,
		u4Capabilities: U4_CAPABILITIES,
		u4Wall: U4_WALL,
		targetBuild: {
			produced: false,
			reasonAtT018:
				'A target build requires an installed closure, and the migrated closure did not install. The two-run byte comparison T018 owed is therefore not deferred or estimated — it does not exist, and no substitute for it is offered. The probe build below is a diagnostic and is not that comparison.',
			t021Attempt:
				"The closure installs now and the build was attempted once against the migrated lane itself. It refused: exit 1, 261 diagnostics, three module-not-found, no dist directory. `produced` stays false because nothing was emitted, and there is still no artifact to compare, inventory or serve — what changed is that the refusal is now the compiler's and not the resolver's. `installStageClosure.laneBuild` records it.",
			t021ThirdAttempt:
				'Attempted once more after the four app-source-facing capabilities of u4, against the same lane re-composed from the corpus and re-installed from the authored manifest. It refused again: exit 1, 257 diagnostics, six module-not-found, no dist directory. `produced` stays false. `u4Wall` records what is left and the three ways out of it; the movement is 260 -> 257 with NG2007, TS2339 and two of the resolution failures gone and nothing regressed.',
			t021SecondAttempt:
				'Attempted once more after the compile-stage dependency readings, against a lane re-cut from the corpus and installed from the authored manifest with no narrowing. It refused again: exit 1, 260 diagnostics, eight module-not-found, no dist directory. `produced` stays false. `compileStageDependencyClosure.laneBuild` records it, and the diagnostic movement is itemised there rather than summarised here.',
		},
		gaps: GAPS,
		gapCount: GAPS.length,
		probe: PROBE,
		probeDiagnosticCounts: PROBE_DIAGNOSTIC_COUNTS,
		downstreamReading: DOWNSTREAM_READING,
		eraFactsTheMigratedWorkspaceDoesNotCarry: ERA_FACTS_NOT_CARRIED,
		whatWorked: [
			'The engine ran end to end on an application it had never seen and produced a changeset without crashing, without an application-specific branch, and without being modified: no transform threw, no workspace document was refused, and the CLI 1.x synthesis capability correctly stood down on a modern angular.json without being told which format to expect.',
			"The workspace migration read this application's unusual shape correctly — a non-src sourceRoot, a second e2e project, an already-broken lint target — and reported what it could not carry as unhandled entries and declared differences rather than dropping them silently.",
			'The three application-source rewrites it made are all correct for the hop: rxjs/Observable collapses onto the package root in RxJS 7, and both zone.js deep specifiers moved in 0.11.',
			'Every one of the seven gaps was reported by a toolchain as a named diagnostic at a named line. None of them is a silent wrong answer, which is the failure mode that would have mattered more.',
			'Each install-stage gap was answerable by a reading rather than by an exception: three entries in the table every other community reading lives in, none of them naming this application, and the closure resolved on the first attempt afterwards. The gap list was accurate enough to be closed from — including where it was wrong, since G3 named a line the compiled-with reading then corrected.',
		],
		notEstablished: [
			'The migrated build emits nothing. Nothing here establishes that this application can be carried to Angular 16 at all, and nothing establishes that it cannot: three gaps are answered, four are open demands, and no artifact exists.',
			'No browser opened anything, no server was started, and no journey was exercised, in either lane.',
			'The probe measures a tree that is not the migrated lane. Its 264 diagnostics are a census of what the compiler said about one narrowed tree in one configuration; they are not an estimate of remaining work, because answering a module-level demand removes many template-level ones at once.',
			'The gap list is closed at the install stage and open at the compile stage. The install set was closed by narrowing until the tree resolved; the compile set is what one build of one narrowed tree reported, and answering the seven gaps would let the compiler reach code it has not yet read.',
			'`packagesInstalled` counts what npm reported with lifecycle scripts disabled. Nothing here establishes what a scripted install of either manifest does.',
			'The registry readings quoted for G1, G2 and G3 were made under consent VL-LEGACY-CORPUS-2026-08-10 against registry.npmjs.org on 2026-08-14. They are readings of published metadata, not installations, and no line named in a `neededTransform` was installed or built by T018.',
			"The closure that installed for the install-stage measurement is the migrated manifest minus one devDependency, xlf-google-translate, whose own declared dependency was deleted from the registry before either lane ran. That narrowing is the era baseline's, digest-bounded and restored, and it was not a claim that the authored migrated manifest installs. It is superseded rather than repeated: the compile-stage unit reads xlf-google-translate at ^1.0.4, and `compileStageDependencyClosure.laneInstall` records an install of the authored manifest with no package removed and no flag forced.",
			"Two of this application's libraries are now dropped rather than migrated, and the map and the switch control they served are gone from the migrated workspace. Nothing here establishes that the application is still the application after those removals; the declared differences state them so that a reader is not asked to assume otherwise.",
			'The engines.node retarget is a manifest declaration. No process was run under any Node line other than the 16.20.2 this cell declares, so nothing here establishes what this workspace requires at runtime.',
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
