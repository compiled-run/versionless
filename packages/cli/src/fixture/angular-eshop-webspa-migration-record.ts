/**
 * The replacement Angular holdout result: what the frozen `@versionless/angular`
 * engine did when it was pointed at the eShopOnContainers `WebSPA`, an
 * application it had never seen, on the longest hop any holdout has been asked
 * for — Angular 6.1.4 to Angular 16.2.
 *
 * The result is RED, and this record is the red one. The lane composed a
 * changeset, wrote it into a migrated tree, and was refused at dependency
 * resolution before a compiler ever read a line. Every gap is itemised below by
 * package, by declaration, by file and by line — not counted, not summarised,
 * not softened — together with what the era toolchain did instead and why. That
 * itemisation is the product of this unit; a green lane invented here would have
 * destroyed it.
 *
 * Nothing under `packages/frameworks/**`, `packages/core/src/migrations/**`,
 * `packages/core/src/bundlers/**` or `packages/core/src/analysis/**` was edited
 * by this unit. The composite fingerprint of those five subtrees is
 * f1a63359210b87c04408b27cf8c40e88e1b47d44bcc7f5a9be20d9478dc71012 before and
 * after. No application source was edited by hand in any lane: every byte that
 * differs from the corpus was written by a frozen engine transform, and each is
 * itemised in `migration/u5-composed-changeset.json` by file and by change.
 *
 * The driver is fixture-scoped. It names this application's paths and quotes
 * this application's diagnostics; it decides nothing about what an engine
 * should do.
 */

import { readFile, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { canonical, sha256 } from './angular-factoriolab-migration-run.ts';
import { sealRecord, verifySealedRecord, type SealedRecord } from './angular-factoriolab-build-lanes-run.ts';
import { CONSENT, COMMIT, UNIT, APPLICATION_SUBPATH } from './angular-eshop-webspa-migration-run.ts';

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');

export const INGEST_DIRECTORY = path.join(
	repositoryRoot,
	'evidence/ingests/angular-eshop-webspa-netcore2-2',
);
export const ATTEMPT_FILE = path.join(INGEST_DIRECTORY, 'attempt.json');

/**
 * Where a gap's evidence comes from. A gap npm or a compiler stated is quoted
 * from a log; a gap that is real but that no tool has yet reached is read off a
 * declaration, and it says so. The distinction is kept because npm refuses at
 * the first conflict it finds, so a lane that stops on one gap has not thereby
 * established that the others are absent — nor that they are present in a log.
 */
export type GapEvidence = 'lane-log' | 'era-closure-declaration' | 'migrated-manifest-reading' | 'seam-refusal';

/**
 * One thing the frozen engine could not carry, stated so that answering it needs
 * nothing else: where it is, what it is, which hop created it, what the
 * toolchain said verbatim, why the era toolchain did not say it, and what would
 * have to change — as a transform, not as a fix.
 */
export type MigrationGap = Readonly<{
	/** Ordinal, so a reader and a reviewer can name the same gap. */
	id: string;
	/** Which stage of the lane the gap belongs to. */
	stage: 'install' | 'source' | 'build';
	/** Where the gap is: a workspace-relative path, or a package name. */
	site: string;
	/** The declaration, specifier, symbol or option that could not be carried. */
	subject: string;
	/** The library or toolchain hop whose change created the demand. */
	library: string;
	/** How this gap is evidenced. */
	evidence: GapEvidence;
	/** The diagnostic or declaration, quoted. */
	observed: string;
	/** Why the era toolchain did not refuse: the fact that made Angular 6 accept it. */
	whyTheEraToolchainAccepted: string;
	/** Why the frozen engine cannot carry it, stated against the frozen code. */
	whyTheEngineCannotCarryIt: string;
	/** What would have to change, stated as a transform rather than a fix. */
	neededTransform: string;
}>;

/**
 * The gaps, in the order the lane met them.
 *
 * G1 is the one that stopped the lane. G2 is behind it and is read off the era
 * closure's own declaration rather than off a log, because npm refuses at the
 * first conflict and never reached it. G3 is the measured question the board set
 * for this application and is evidenced by the seam's own refusals. G4 and G5
 * are readings of the migrated tree the engine produced.
 */
export const GAPS: readonly MigrationGap[] = Object.freeze([
	Object.freeze({
		id: 'G1',
		stage: 'install' as const,
		site: '@ng-bootstrap/ng-bootstrap',
		subject: 'dependencies.@ng-bootstrap/ng-bootstrap "3.1.0", carried through the alignment unchanged and unreported',
		library: '@ng-bootstrap/ng-bootstrap 3.1.0 -> the line that declares an Angular 16 peer',
		evidence: 'lane-log' as const,
		observed:
			'npm ERR! code ERESOLVE / npm ERR! ERESOLVE unable to resolve dependency tree / While resolving: eshopaspnetnetcoredockerspa@0.0.0 / Found: @angular/common@16.2.12 / node_modules/@angular/common / @angular/common@"^16.2.0" from the root project / Could not resolve dependency: / peer @angular/common@"^6.1.0" from @ng-bootstrap/ng-bootstrap@3.1.0 (migration/u5-lane-install-red.log)',
		whyTheEraToolchainAccepted:
			'The era manifest declares Angular 6.1.4, and @ng-bootstrap/ng-bootstrap@3.1.0 declares peer @angular/common ^6.1.0, @angular/core ^6.1.0, @angular/forms ^6.1.0 and rxjs ^6.0.0. Every one is satisfied by the era closure, which is why the baseline lane installed 1271 packages with exit 0 and built twice byte-identically.',
		whyTheEngineCannotCarryIt:
			'`angular-16-browser-builder` carries no reading for @ng-bootstrap/ng-bootstrap in `ANGULAR_16_ECOSYSTEM_PACKAGES`, and the package name matches no family prefix the cell writes. `alignedVersionRange` therefore returns the declaration unchanged, and `alignAngularPackageManifest` leaves it at its era pin. The engine states nothing about it: the package appears in neither `changes`, nor `declaredDifferences`, nor `unhandled`. An unread community package is silently carried at its era version, and an era version with a hard `^6.1.0` peer is the whole of the refusal.',
		neededTransform:
			'A registry reading for @ng-bootstrap/ng-bootstrap in the Angular 16 community layer, chosen by the same rule every other entry there was chosen by. Failing that, the weaker but more general transform: an era-pinned declaration the cell has read no line for is reported as `unhandled` rather than carried silently, so a lane that is about to be refused knows before npm tells it.',
	}),
	Object.freeze({
		id: 'G2',
		stage: 'install' as const,
		site: 'preboot',
		subject: 'dependencies.preboot "6.0.0-beta.5", carried through the alignment unchanged and unreported',
		library: 'preboot 6.0.0-beta.5 -> the line that declares an Angular 16 peer',
		evidence: 'era-closure-declaration' as const,
		observed:
			'.versionless/work/angular-eshop-webspa/baseline/node_modules/preboot/package.json declares peerDependencies {"@angular/common": "^6.0.0", "@angular/core": "^6.0.0"}. npm never reported it: it refuses at the first conflict it resolves, and that was G1.',
		whyTheEraToolchainAccepted:
			'Identical to G1: the declared peer is satisfied by the era Angular 6.1.4 closure.',
		whyTheEngineCannotCarryIt:
			'Identical to G1: preboot has no entry in the cell community layer and no family prefix matches it, so it is carried at its era pin and nothing is said about it. The gate-zero screen already recorded that this application declares preboot and imports it at zero sites, with no main.server.ts and no server module anywhere in the tree — so the declaration is unused, and the engine has no capability that removes an unused declaration.',
		neededTransform:
			'Either the community-layer reading G1 asks for, or a capability that reads a declared-and-never-imported package and drops it as a declared difference. The second is the stronger reading here — nothing in this application uses preboot — but it is a claim about a declaration rather than about a version, and no frozen capability makes it.',
	}),
	Object.freeze({
		id: 'G3',
		stage: 'source' as const,
		site: 'Client/modules/shared/shared.module.ts, Client/modules/shared/services/security.service.ts, Client/modules/basket/basket.service.ts, Client/modules/catalog/catalog.service.ts, Client/modules/campaigns/campaigns.service.ts, Client/modules/orders/orders.service.ts',
		subject: '`@angular/http` imported at 6 sites — HttpModule and JsonpModule in an NgModule `imports` array, Http/Response/Headers in one service, and Response alone in four more',
		library: '@angular/http, removed by Angular after the 7 line',
		evidence: 'seam-refusal' as const,
		observed:
			'8 refusals from `succeedRemovedEntryPointSymbols`, one per symbol per module, all of one shape. Verbatim, for the widest of them: "Client/modules/shared/shared.module.ts line 5: @angular/http is unreachable and HttpModule is used at line 34 other than as the callee of a call, and the successor is written down as a replacement for the call and not for the value. The whole declaration was left as it is: rewriting the symbols that do resolve would leave the ones that do not pointing at a module this tree does not answer." The same shape names Response at basket.service.ts:65, catalog.service.ts:41, campaigns.service.ts:35 and orders.service.ts:30, and Headers at security.service.ts:14 and Http at security.service.ts:20. The eighth is different and is the other half of the answer: "@angular/http is unreachable and no successor is written down for JsonpModule."',
		whyTheEraToolchainAccepted:
			'@angular/http@6.1.4 was installed, published all five symbols, and the Angular 6 compiler read them. The application was already half off the package at the pin — HttpClientModule is in the root NgModule and configuration.service.ts and data.service.ts are on HttpClient — so the era tree carried both HTTP stacks at once, which Angular 6 permitted.',
		whyTheEngineCannotCarryIt:
			'The only public frozen surface that answers "this specifier is gone and the name lives somewhere else now" is `succeedRemovedEntryPointSymbols`, and its claim type `DocumentedSymbolSuccessor` carries an `arity`: the successor is written down as a replacement for a **call** of a stated shape, and the capability refuses every use of the symbol that is not the callee of a call. That gate is not an accident — its own documentation states that half a rewrite is worse than none — and it is exactly wrong for this package. None of @angular/http\'s five symbols is a creation function: `Http` is a constructor-injected service, `Response` is a type written in a type position, `Headers` is constructed with `new`, and `HttpModule`/`JsonpModule` are NgModule values named inside an `imports` array literal. The seam reached its per-symbol gates — the reading is complete, `@angular/http` is confirmed unreachable in the target closure, and `@angular/common/http`@16.2.12 publishes HttpClient, HttpHeaders, HttpResponse and HttpClientModule — and refused on call shape at every site. Beside it, `declareApplicationSourceDependencies` reports the same package from the other direction: the cell dropped the declaration as `no-successor` and the source still names it, so the migrated tree declares a package it imports at six sites.',
		neededTransform:
			'A value-position successor capability: one that carries a symbol whose successor is a **class, type or NgModule value** rather than a call, and that can move it across package boundaries to an entry point of a package the cell already carries. It needs three things the call-shaped seam does not have — a use-position classifier (type reference, `new` target, array element, constructor parameter type), a per-symbol notion of what a successor substitution means in each of those positions, and a refusal for a symbol with no successor at all. `JsonpModule` is that last case and is the reason the capability cannot be a rename table: Angular\'s JSONP successor is `HttpClientJsonpModule`, which requires `HttpClientModule` beside it and changes how a JSONP request is written at the call site.',
	}),
	Object.freeze({
		id: 'G4',
		stage: 'build' as const,
		site: 'package.json scripts.build:prod',
		subject: '"ng build --prod --aot --extract-css", carried through the migration byte-identical',
		library: '@angular/cli 6 -> 16 flag surface',
		evidence: 'migrated-manifest-reading' as const,
		observed:
			'The migrated manifest at .versionless/work/angular-eshop-webspa/target/app/package.json carries the `scripts` block exactly as the era manifest wrote it, and the composed changeset lists 19 changes to package.json, none of them a script. `--prod` was removed from the Angular CLI after the 11 line and `--extract-css` after the 12 line; the workspace migration removed the matching `extractCss: true` option from angular.json, so the workspace and the script that drives it now disagree.',
		whyTheEraToolchainAccepted:
			'CLI 6.1.5 accepted all three flags; the baseline lane ran `npm run build:prod` verbatim, twice, with exit 0.',
		whyTheEngineCannotCarryIt:
			'No capability in the frozen Angular subtree reads `scripts` on a package manifest. The only occurrences of the key are in `angular-cli-json-workspace-synthesis.ts`, where `scripts` names the build option of that name in a CLI 1.x `apps[]` entry — a different thing entirely. The engine migrates the workspace the build is configured by and leaves the command line that invokes it where it was.',
		neededTransform:
			'A script-surface capability that reads the npm scripts naming the workspace\'s own CLI binary and retargets removed flags against the cell\'s CLI line — `--prod` to `--configuration production`, `--extract-css` dropped where the workspace no longer declares it. It has a natural refusal: a script whose command it cannot parse is reported rather than rewritten.',
	}),
	Object.freeze({
		id: 'G5',
		stage: 'install' as const,
		site: 'package-lock.json',
		subject: 'the era lockfile, lockfileVersion 1, 902 top-level entries, left in the tree beside a manifest that now asks for Angular 16',
		library: 'npm 5 lockfile v1 -> npm 8',
		evidence: 'lane-log' as const,
		observed:
			'npm WARN old lockfile ... npm ERR! code ERESOLVE / ERESOLVE could not resolve / Found: @angular-devkit/build-angular@0.7.5 / dev @angular-devkit/build-angular@"^16.2.0" from the root project / Conflicting peer dependency: typescript@5.1.6 (migration/u5-lane-install-attempt1-era-lockfile.log)',
		whyTheEraToolchainAccepted:
			'The lockfile is the era closure\'s own resolution and is exactly what made the baseline install reproducible.',
		whyTheEngineCannotCarryIt:
			'`AngularMigration.removedFiles` names `tslint.json` and nothing else. The engine has a capability that decides a configuration file should no longer exist — `tslintConfigRemovals` — and no capability that decides the era *lockfile* has been superseded by the manifest it just rewrote. The lane applied the established precedent instead (the pigallery2 migrated lane, and the super-productivity lane before it, move the era lockfile out and retain it), and the retained copy is byte-identical to the one removed: sha256 fafdef05d482aba0427d7f1036cbf3b17101783fca0194b61f6d1cbc140816e0, the same digest the baseline unit recorded for the authored lock.',
		neededTransform:
			'A declaration in the changeset that the era lockfile is superseded — either as a removal in `removedFiles` with the reason stated as a declared difference, or as an explicit statement that the migrated manifest is to be installed lock-free. Either way the fact belongs in the changeset rather than in a lane convention, because a changeset that leaves it out describes a tree that cannot be installed.',
	}),
]);

/**
 * What the engine's capability inventory did when it was pointed at this tree —
 * the second measured question. Three answers are possible and all three
 * happened: a capability fired, stood down, or refused.
 *
 * "Stood down" is not the same as "did nothing wrong": a supply-gated capability
 * that was handed no reading stands down because this unit compiled nothing on
 * the target line, and that is a statement about the lane, not the application.
 */
export const CAPABILITY_COMPOSITION = Object.freeze({
	fired: Object.freeze([
		'angular-target-cell / alignAngularPackageManifest — 19 manifest changes: 12 version alignments, 2 ecosystem alignments (ngx-toastr ^9.0.2 -> ^17.0.2 by the peer-strictness refinement, @types/jasmine 2.8.8 -> ~4.3.0 by the test-toolchain table), 3 removals (@angular/http as no-successor, tslint and codelyzer as released by a removed target), and typescript 2.9.2 -> ~5.1.3.',
		'angular-workspace-migration — 8 changes to angular.json: defaultProject removed, polyfills scalar promoted to an array on the build and test targets, an optimization object written on both build and production, extractCss removed from the production configuration, and the WebSPA and WebSPA-e2e lint targets removed.',
		'tslint-toolchain-removal — tslint.json removed from the tree; the only entry in removedFiles.',
		'font-inlining-disable — optimization.fonts.inline false on both the build options and the production configuration, declared as a difference rather than written silently.',
		'angular-workspace-migration / migrateAngularTsConfig — target es5 -> ES2022, module es2015 -> ES2022, useDefineForClassFields false added.',
		'angular-source-migration — 2 zone.js specifier rewrites: Client/polyfills.ts:56 zone.js/dist/zone -> zone.js, Client/test.ts:3 zone.js/dist/long-stack-trace-zone -> zone.js/plugins/long-stack-trace-zone.',
		'module-with-providers-type-argument — 2 insertions, both read from the enclosing class: Client/modules/basket/basket.module.ts:17 <BasketModule>, Client/modules/shared/shared.module.ts:60 <SharedModule>.',
		'subject-void-type-argument — 4 insertions, each proved by a zero-argument next call: basket.service.ts:27, basket.wrapper.service.ts:20, configuration.service.ts:12, signalr.service.ts:12.',
		'application-source-dependency — reported @angular/http by name with all 9 use sites, which is the report half of G3.',
	]),
	stoodDown: Object.freeze([
		'angular-cli-json-workspace-synthesis — correctly. `isAngularCliOneWorkspace` reads the document\'s shape rather than a version number, and this workspace is an angular.json with a projects map. That it is `"version": 1` — the first angular.json generation the CLI ever wrote — did not confuse it, which is the interesting part: v1 here means the first angular.json, not the pre-angular.json .angular-cli.json format the synthesis capability exists for.',
		'workspace-engines-retarget — correctly. The manifest declares no engines field, and the capability refuses to add a constraint the workspace never made.',
		'builder-package-declaration — nothing to declare: the migrated workspace\'s surviving targets name @angular-devkit/build-angular, which the manifest already declares.',
		'unparameterised-base-class and departed-dom-lib-member — both supply-gated on compiler coordinates, and this unit supplied none, because the migrated tree has never been compiled on the target line. A tree that supplies no diagnostics has none transformed.',
		'deep-import-redirection, package-exports-style-imports, template-binding-reorder — offered no readings, so nothing was redirected, resolved or reordered.',
		'entry-components-removal, ngrx-effects-migration, sentry-v8-migration, modal-content-params-migration, promise-executor-void-parameter, undecorated-angular-base-class, custom-webpack-absorption, rxjs-prototype-patch reporting — each read the tree for its own construct and found none. This application declares no entryComponents, no NgRx, no Sentry, no ngx-bootstrap modal, no zero-argument promise executor, no undecorated Angular base class, no custom-webpack builder and no rxjs/add patch import.',
	]),
	refused: Object.freeze([
		'removed-entry-point-symbol-successor — 6 modules offered, 0 changed, 8 refusals. This is G3, and it is the only capability in the inventory that refused rather than standing down: it reached its per-symbol gates with a complete reading and rejected every site on call shape.',
	]),
	generalisation:
		'The T021-hardened capabilities generalise. Every one of them either fired on a construct this application actually has or stood down on a construct it does not, and none of them fired wrongly: no transform in the changeset is an edit this application did not ask for. The three capabilities hardened for the pigallery2 holdout that could apply here — composition wiring, the successor tables, engines-retarget — behaved as their documentation says on a tree none of them was written for. What did not generalise is the *coverage*: the two gaps that stopped this lane are packages the community layer has never read, and the measured question is a symbol shape the successor seam was not built for.',
});

/**
 * The hop-class findings — the third measured question. Angular 6 to 16 is two
 * majors longer than the pigallery2 holdout and one workspace generation older,
 * and this is what that bought.
 */
export const HOP_CLASS_FINDINGS: readonly string[] = Object.freeze([
	'`angular.json` "version": 1 — the first angular.json the CLI ever wrote (CLI 6), a generation older than any workspace a counted Angular vertical covers. It cost nothing: the workspace migration reads shapes rather than a version field, and the synthesis capability that exists for the *pre*-angular.json format correctly stood down. A new gap class was expected here and there is none, which is worth recording as precisely as a failure.',
	'A community layer two majors deeper. The pigallery2 holdout\'s install gaps were packages the cell had read and found no successor for; this application\'s install gaps are packages the cell has never read at all (@ng-bootstrap/ng-bootstrap, preboot). The failure mode is different and worse: a no-successor drop is loud, an unread package is silent, and silence is what put an Angular 6 peer in front of npm.',
	'@angular/http is a hop-length artefact. The package was removed after Angular 7, so a workspace on 8 or later cannot carry it and pigallery2 (8.1.2) only *declared* it — this application declares it and imports it. Anything below the 8 line meets this package as source rather than as a manifest line.',
	'TypeScript 2.9.2 -> ~5.1.3 is three of the four largest TypeScript breaks in one step, and the tsconfig migration wrote ES2022/ES2022/useDefineForClassFields:false without hesitation. Whether the application\'s own constructs survive that is not established by this unit: the lane never reached a compiler, so no TS-construct gap class can be named either way, and none is claimed.',
	'RxJS 6.2.2 -> ~7.8.0. Four `Subject` declarations were parameterised `<void>` on the evidence of their own zero-argument `next` calls, and no `rxjs/add` patch import exists in this application to refuse — so the RxJS 5-shaped gap class the source migration is armed for did not arise. What a 6.2 -> 7.8 hop does to this application\'s operator usage is, again, a compiler question the lane never reached.',
	'The npm-script surface (G4) is the one gap class that is purely a function of hop length: the CLI flags this application\'s own build script writes were removed at the 11 and 12 lines, both of which sit between this application\'s era and the cell.',
]);

/** The migrated install: what was attempted, and what refused. */
export const LANE_INSTALL = Object.freeze({
	cell: 'node v16.20.2 (official darwin-arm64 build, native — no translation), npm 8.19.4, CI=1, lane npm cache at .versionless/cache/angular-eshop-webspa-netcore2-2-target/npm-cache',
	cellPolicy:
		'The Node line is the one `angular-16-browser-builder` declares (`nodeLine: "16.20.2"`). It is the cell\'s own declaration, not a choice this lane made.',
	attempts: Object.freeze([
		Object.freeze({
			attempt: 1,
			command: 'npm install',
			exitStatus: 1,
			refusal: 'ERESOLVE naming @angular-devkit/build-angular@0.7.5 as "Found" — the era lockfile\'s pin, read from the v1 package-lock.json still in the tree',
			reading: 'G5. Recorded as a finding rather than discarded: the changeset does not declare the era lockfile superseded.',
			log: 'migration/u5-lane-install-attempt1-era-lockfile.log',
		}),
		Object.freeze({
			attempt: 2,
			command: 'npm install --no-audit --no-fund --ignore-scripts',
			eraLockfileHandling:
				'moved out of the lane before the install and retained at .versionless/work/angular-eshop-webspa/target/logs/era-package-lock.json, byte-identical to the one removed (sha256 fafdef05d482aba0427d7f1036cbf3b17101783fca0194b61f6d1cbc140816e0). This mirrors what the pigallery2 migrated lane did.',
			exitStatus: 1,
			refusal: 'ERESOLVE on @ng-bootstrap/ng-bootstrap@3.1.0, peer @angular/common "^6.1.0" against the @angular/common@16.2.12 the root project asks for',
			reading: 'G1. Nothing was linked; the lane has no node_modules.',
			log: 'migration/u5-lane-install-red.log',
		}),
	]),
	forcedFlagsUsed: false,
	forcedFlagsNote:
		'npm named --force and --legacy-peer-deps in its own error text. Neither was used. A closure that resolves only because peer resolution was switched off is not the closure the manifest describes, and recording it as an install would have been the paper this unit exists to refuse.',
	narrowingApplied: false,
	narrowingNote:
		'No package was removed from the migrated manifest to make it resolve, and no version was relaxed. The digest-bounded narrowing precedent the pigallery2 baseline established was available and was not used.',
	packagesInstalled: 0,
});

/** The @angular/http seam probe: the measured question, answered. */
export const SEAM_ANSWER = Object.freeze({
	question:
		'Does the frozen engine carry @angular/http to its first-party successor, driven only through public frozen APIs?',
	answer: 'No.',
	seam: 'succeedRemovedEntryPointSymbols (removed-entry-point-symbol-successor)',
	drivenThrough:
		'The public export from @versionless/angular, composed by the fixture driver in the way prior drivers compose driver-seam capabilities: claims written down by the caller, a reading of the installed package surface supplied by the caller, and the migrated bytes the composed changeset produced offered module by module.',
	claimsWrittenDown: 4,
	claimsNotWrittenDown: Object.freeze([
		'JsonpModule — its Angular successor, HttpClientJsonpModule, is not a rename: it requires HttpClientModule beside it and changes how a JSONP request is written. Writing a claim for it would have stated a successor nobody read.',
	]),
	modulesOffered: 6,
	modulesChanged: 0,
	refusals: 8,
	gatesPassed: Object.freeze([
		'a reading was supplied for the pair (@angular/common/http, @angular/http)',
		'the reading is complete — 47 names read from @angular/common@16.2.12\'s http entry-point declaration',
		'@angular/http does not resolve in the target closure, so the diagnostic describes this closure',
		'the declaration at every site carries only named bindings — no default and no namespace import',
		'the successor root publishes HttpClient, HttpHeaders, HttpResponse and HttpClientModule, and publishes none of Http, Headers, Response or HttpModule',
	]),
	gateThatRefused:
		'the call-shape gate. `DocumentedSymbolSuccessor` states an `arity`, and the capability accepts a symbol only where every use is the callee of a call with that many arguments. Every @angular/http symbol this application names is used in a value or type position instead.',
	readingTakenFrom:
		'.versionless/work/angular-eshop-webspa/target/probe — a scratch tree carrying @angular/common@16.2.12, @angular/core and rxjs alone. The lane closure does not exist because the migrated install is refused (G1), and a reading taken there would have been empty, which the seam refuses one gate earlier on `complete: false`. Reading the successor package somewhere else is a fact about the reading and is recorded as one; nothing about the application was read from that tree.',
	notEstablished: Object.freeze([
		'A refusal from this seam is a statement about the seam and the claim, not a statement that this application cannot be migrated off @angular/http.',
		'The seam was never asked to write anything into the lane. Its outcome is recorded in migration/u5-angular-http-seam-probe.json and no byte of it reached the tree.',
	]),
});

/** Era workspace facts this hop did not carry, each one declared out loud. */
export const ERA_FACTS_NOT_CARRIED: readonly string[] = Object.freeze([
	'The TSLint toolchain: two lint targets and tslint.json, removed with the packages that served them (tslint, codelyzer). The era workspace lints and the migrated one does not.',
	'The protractor e2e target on WebSPA-e2e: removed, and no replacement e2e capability was chosen for it. Reported as unhandled rather than as a declared difference, which is the engine saying it dropped something it had no successor for.',
	'`extractCss: true` on the production configuration: removed, because the 16.2 browser builder extracts CSS unconditionally and rejects the key.',
	'`defaultProject`: removed, because the 16.2 CLI no longer reads it. Every `ng` invocation in this workspace must now name WebSPA.',
	'Font inlining is switched off (`optimization.fonts.inline: false`) where the 16.2 line defaults it on, so the migrated build does not fetch remote font stylesheets during the build.',
	'`@angular/http`: dropped from the manifest and still imported at six sites. This is G3 and it is the largest of these — the migrated workspace does not declare a package its own source names.',
]);

export function buildMigrationBlock(): Record<string, unknown> {
	return {
		unit: UNIT,
		boardTask: 'T023',
		stage: 'stage-4 — the FROZEN-ENGINE MIGRATION of the committed Angular holdout',
		outcome: 'red-migration-gaps-itemised',
		result:
			'RED. The frozen engine composed a changeset for an application it had never seen and wrote it into a migrated lane; the migrated closure is refused at dependency resolution by an era-pinned community package the cell has never read, and the measured @angular/http question is answered No with the exact gate that refused it. No compiler ran, no bundle was emitted, and nothing was chased.',
		startedAt: '2026-08-14T05:00:00Z',
		completedAt: '2026-08-14T05:20:00Z',
		scope:
			'Composed changeset from the read-only corpus, applied into a migrated lane, era lockfile moved out and retained, migrated install attempted twice in the cell the target declares, and the @angular/http driver seam probed through public frozen APIs. No target build was reached. No application source was edited by hand. No .NET service, no database and no listener was started; nothing was left running.',
		holdoutPosition:
			'The replacement Angular holdout. This application was never ingested, fixtured, adapted, witnessed or receipted in this repository before T023. The engine subtrees were frozen before this unit began and are frozen after it: composite f1a63359210b87c04408b27cf8c40e88e1b47d44bcc7f5a9be20d9478dc71012.',
		application: {
			repository: 'https://github.com/dotnet-architecture/eShopOnContainers',
			commit: COMMIT,
			subpath: APPLICATION_SUBPATH,
			era: 'Angular 6.1.4, CLI 6.1.5, @angular-devkit/build-angular 0.7.5, TypeScript 2.9.2, RxJS 6.2.2, angular.json version 1',
			target: 'angular-16-browser-builder — Angular 16.2, @angular-devkit/build-angular:browser, Node 16.20.2, TypeScript ~5.1.3',
		},
		composedChangeset: {
			record: 'migration/u5-composed-changeset.json',
			applied: 'migration/u5-source-migration.json',
			applicationFilesScanned: 84,
			applicationFilesChanged: 8,
			workspaceFilesChanged: 3,
			filesWritten: 11,
			filesRemoved: ['tslint.json'],
			unhandled: 3,
			declaredDifferences: 8,
			appliedTo: '.versionless/work/angular-eshop-webspa/target/app',
			handEdits: 0,
		},
		capabilityComposition: CAPABILITY_COMPOSITION,
		hopClassFindings: HOP_CLASS_FINDINGS,
		seamAnswer: SEAM_ANSWER,
		laneInstall: LANE_INSTALL,
		targetBuild: {
			produced: false,
			attempted: false,
			why: 'The migrated closure does not install. A build needs a closure, and there is none: npm linked nothing. Attempting a build against an empty node_modules would have produced a diagnostic about the missing CLI rather than about this application, and recording it as a build finding would have been false.',
			runsCompared: 0,
		},
		gaps: GAPS,
		eraFactsNotCarried: ERA_FACTS_NOT_CARRIED,
		logs: [
			'migration/u5-lane-install-attempt1-era-lockfile.log',
			'migration/u5-lane-install-red.log',
			'migration/u5-successor-surface-probe-install.log',
		],
		notEstablished: [
			'No target build was produced, so there is no parity claim, no determinism claim, no output inventory and no readiness claim. The absence of those blocks is the honest shape of this result.',
			'No compiler read this application on the target line. Every gap stated at the `build` stage is a reading of the migrated tree, not a diagnostic, and each says so in its `evidence` field. No TypeScript-construct, template or RxJS-operator gap class is named, because none was observed.',
			'G2 is read off the era closure\'s own declaration rather than off a log. npm refuses at the first conflict it resolves and never reached preboot; that the log does not name it establishes nothing about whether it would refuse.',
			'The seam reading was taken from a scratch tree carrying the successor package alone, because the lane closure does not exist. It is a reading of what @angular/common@16.2.12 publishes, and nothing more.',
			'`packagesInstalled: 0` is not a statement that this manifest cannot install. It is a statement that this manifest, unforced and unnarrowed, was refused — and that no forced or narrowed variant was attempted in its place.',
			'Nothing in this record establishes that answering G1 and G2 would let the tree compile. The gaps behind an install refusal are unmeasured by definition.',
			'No witness journey was run, in either lane. The gate-zero unknown about whether this SPA can boot without its ASP.NET host is exactly as open as it was.',
		],
	};
}

export function buildMigrationRecord(): SealedRecord {
	return sealRecord({
		schemaVersion: 'versionless.angular-eshop-webspa-migration.v1',
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
			`${String(GAPS.filter((gap) => gap.stage === 'source').length)} source, ` +
			`${String(GAPS.filter((gap) => gap.stage === 'build').length)} build), ` +
			`no target build; record digest ${sha256(canonical(record)).slice(0, 12)}\n`,
	);
}

if (process.argv[1]?.endsWith('angular-eshop-webspa-migration-record.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
