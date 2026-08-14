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

/** The unit that answered G1, G2, G4 and G5 and re-ran the lane. */
export const RERUN_UNIT = 'lrapr-t024/u1-silence-defect-and-declarations';

/**
 * What each T023 gap looks like after the transforms this re-run added.
 *
 * A gap is `closed` only where a capability now states the thing the gap said
 * nobody stated, and `open` where it does not — G3 is untouched by design and is
 * recorded as open, at the same six sites, because a unit that renamed its own
 * scope would be the paper this record exists to refuse.
 */
export const GAP_DISPOSITIONS = Object.freeze([
	Object.freeze({
		id: 'G1',
		state: 'closed' as const,
		by: 'the general transform, and then the reading',
		what: 'alignAngularPackageManifest now reports every era-pinned declaration the cell has read no line for, naming the field, the package, the era pin and why silence is refused. The eShop manifest surfaces 21 such declarations where it previously surfaced none. Beside it the cell read @ng-bootstrap/ng-bootstrap and aligned it to ^15.1.2, so the package that stopped the lane is no longer merely reported — it is carried.',
	}),
	Object.freeze({
		id: 'G2',
		state: 'closed' as const,
		by: 'a community-layer reading of the published bytes',
		what: 'preboot is read as no-successor. Its peers do not exclude it — 8.0.0 declares @angular/common and @angular/core ">=11.0.0" — but its published tarball is a pre-Ivy ViewEngine library (preboot.metadata.json, PrebootModule.decorators, no ɵɵngDeclare* anywhere) and Angular 16 ships ngcc only as a stub, so this cell has no line to link. The declaration is dropped as a declared difference; this application imported it at zero sites, so nothing in its source changes.',
	}),
	Object.freeze({
		id: 'G3',
		state: 'open' as const,
		by: 'nothing — deliberately out of this unit\'s scope',
		what: 'The value-position successor capability is not written. The migrated build now reaches the compiler and states the gap in its own words: six TS2307 "Cannot find module \'@angular/http\'" and two webpack "Can\'t resolve \'@angular/http\'", at exactly the six sites the T023 seam probe named. The gap is unchanged and is now evidenced by a compiler rather than by a seam probe.',
	}),
	Object.freeze({
		id: 'G4',
		state: 'closed' as const,
		by: 'a detector-gated script-surface capability',
		what: 'retargetWorkspaceScripts rewrote scripts.build:prod from "ng build --prod --aot --extract-css" to "ng build --configuration production --aot". `--extract-css` was dropped because this workspace migration removed the matching builder option at projects.WebSPA.architect.build.configurations.production.extractCss, and `--prod` was retargeted because the cell is past the CLI line that removed it and the migrated workspace declares a production configuration. `--aot` is still a flag the 16.2 CLI parses and was left alone. The build script ran, which is how the build below was reached at all.',
	}),
	Object.freeze({
		id: 'G5',
		state: 'closed' as const,
		by: 'a changeset declaration, not a lane convention',
		what: 'supersedeEraLockfiles read the era package-lock.json and found declarations it contradicts — @angular-devkit/build-angular locked at 0.7.5 and now declared ^16.2.0, @angular/animations locked at 6.1.4, and further ones — and removed it. `removedFiles` is now ["tslint.json", "package-lock.json"] and the reason is a declared difference. The lane moved no file by hand: the changeset took it out.',
	}),
]);

/**
 * The re-run: the same frozen-except-for-this-unit engine, pointed at the same
 * pinned tree, with the four transforms above in it.
 */
export const RERUN = Object.freeze({
	changeset: Object.freeze({
		record: 'migration/u1-t024-composed-changeset.json',
		applied: 'migration/u1-t024-source-migration.json',
		recordNote:
			'The runner writes its output under the u5 names; those two files were restored to the bytes T023 sealed and the re-run\'s own are kept beside them under u1-t024 names, so the red record still points at the red changeset it describes.',
		filesWritten: 11,
		applicationFilesChanged: 8,
		applicationFilesScanned: 84,
		workspaceFilesChanged: 3,
		filesRemoved: Object.freeze(['tslint.json', 'package-lock.json']),
		unhandled: 24,
		declaredDifferences: 10,
		handEdits: 0,
		note: 'T023 recorded 3 unhandled and 8 declared differences on this tree. The unhandled count is 24 because 21 previously silent declarations now speak; the declared differences are 10 because preboot and the era lockfile are now declarations the changeset makes.',
	}),
	install: Object.freeze({
		cell: 'node v16.20.2 (official darwin-arm64 build, native), npm 8.19.4, CI=1, lane npm cache at .versionless/cache/angular-eshop-webspa-netcore2-2-target/npm-cache',
		command: 'npm install --no-audit --no-fund --ignore-scripts',
		exitStatus: 0,
		packagesInstalled: 1689,
		forcedFlagsUsed: false,
		narrowingApplied: false,
		eraLockfileHandling:
			'none — the era lockfile was restored into the lane before the run precisely so the changeset would be the thing that removed it, and it was. No file was moved by the lane.',
		log: 'migration/u1-t024-lane-install.log',
		reading:
			'The install wall is cleared. G1 and G5 are what cleared it: the ERESOLVE that stopped T023 was @ng-bootstrap/ng-bootstrap@3.1.0\'s ^6.1.0 peer, and the attempt before it was the era lockfile. The closure npm resolved agrees with the readings that chose it — @ng-bootstrap/ng-bootstrap 15.1.2, @angular/common 16.2.12, typescript 5.1.6 — and npm auto-installed the two peers the reading said it would supply, @angular/localize 16.2.12 and @popperjs/core 2.11.8, the latter beside the era popper.js 1.16.1 the workspace still declares under its old name.',
	}),
	build: Object.freeze({
		command: 'npm run build:prod',
		attempts: 1,
		exitStatus: 1,
		artifactsEmitted: 0,
		log: 'migration/u1-t024-target-build.log',
		diagnostics: Object.freeze({
			'error NG6002': 9,
			'error TS2339': 6,
			'error TS2307': 6,
			'error NG8002': 3,
			'error NG1010': 1,
			'webpack Module not found': 2,
			'sass Can\'t find stylesheet to import': 2,
		}),
		constructClassesBehindTheWall: Object.freeze([
			'G3 itself, stated by the compiler for the first time: TS2307 "Cannot find module \'@angular/http\' or its corresponding type declarations" at shared.module.ts:5, security.service.ts:2, basket.service.ts:2, catalog.service.ts:2, campaigns.service.ts:2 and orders.service.ts:2, plus two webpack "Can\'t resolve \'@angular/http\'" module-not-found errors. Every NG6002 and NG8002 below is downstream of the one NG1010 this produces on SharedModule.',
			'A community-library *surface* class the version reading cannot answer: "Property \'forRoot\' does not exist on type \'typeof NgbModule\'" at shared.module.ts:32. @ng-bootstrap/ng-bootstrap dropped the NgbModule.forRoot() static after the era 3.x line, so aligning the package — which is what makes the tree installable — turns a call site into a source demand. This is a new construct class for this application and it is named rather than fixed here.',
			'An RxJS 5-shaped static this hop removes: "Property \'throw\' does not exist on type \'typeof Observable\'" at orders.component.ts:49, orders-new.component.ts:57 and catalog.component.ts:117. The source-migration capability rewrites patch *imports*; a static call on the Observable namespace is a different construct and no capability reads it.',
			'A webpack tilde stylesheet specifier the composition never offered to the capability that exists for it: Client/globals.scss:2 `@import "~bootstrap/scss/bootstrap"` fails with "Can\'t find stylesheet to import". migrateWebpackTildeStyleSpecifiers is exported from the adapter and is not wired into migrateAngularCliEraWorkspace, and it is closure-gated, so the composition would have to hand it a reading of the installed tree. That is a wiring gap rather than a missing capability, and it is recorded as one.',
			'One TS2339 that is a consequence rather than a class: "Property \'json\' does not exist on type \'unknown\'" at security.service.ts:229, which is what the era @angular/http Response type used to answer.',
		]),
		notEstablished: Object.freeze([
			'One build was attempted and one is recorded. There is no second run, so no determinism or byte-stability claim is made.',
			'No artifact was emitted, so there is no output inventory, no parity claim and no witness journey. The gate-zero unknown about whether this SPA boots without its ASP.NET host is exactly as open as it was.',
			'The diagnostic counts are counts of what this one build printed. A build that stops does not enumerate what a later stage would have refused, so nothing here says these are all the demands this application carries.',
		]),
	}),
	greenVerticalSurfacing:
		'No counted vertical\'s changeset shifted. The silence fix adds `unhandled` lines and changes no edit, and the two new capabilities are supply-gated: a driver that hands over no lockfile bytes has no lockfile removed, and a workspace migration that removed no builder option has no script flag dropped. The full node suite is green before and after (2336 tests before, 2358 after, the difference being this unit\'s own tests), and the one recorded expectation that moved is the adapter unit test for an unread `pako` declaration, which now asserts the surfacing instead of the silence.',
});

export function buildRerunBlock(): Record<string, unknown> {
	return {
		unit: RERUN_UNIT,
		boardTask: 'T024',
		stage: 'stage-1 — close G1/G2/G4/G5 generically and re-run the holdout lane',
		outcome: 'install-green-build-red-itemised',
		result:
			'The install wall is cleared without a forced flag, a relaxed peer or a narrowed manifest: 1689 packages, exit 0. The first build this application has ever been given on the target line was attempted once and is RED, and its diagnostics are itemised below. G1, G2, G4 and G5 are closed by transforms that read the workspace rather than this application; G3 is untouched and is now stated by a compiler instead of by a probe.',
		authorization:
			'An authorized reopen of the frozen adapter subtrees for this unit only. The React subtree is untouched at 972ca80155bbc2a6eb3779943cd481b71d35e803.',
		consentId: CONSENT,
		commit: COMMIT,
		subpath: APPLICATION_SUBPATH,
		registryReadings: [
			'https://registry.npmjs.org/@ng-bootstrap/ng-bootstrap — 161 versions; the 15.x line declares peer @angular/core, @angular/common, @angular/forms and @angular/localize "^16.0.0", 14.2.0 declares "^15.0.0" and 16.0.0 declares "^17.0.0". 15.1.2 is the newest 15.x. The `latest` dist-tag is 21.0.0, which declares "^22.0.0".',
			'https://unpkg.com/@ng-bootstrap/ng-bootstrap@15.1.2/fesm2022/ng-bootstrap.mjs — 433 ɵɵngDeclare* calls, every one carrying version "16.0.6".',
			'https://unpkg.com/@ng-bootstrap/ng-bootstrap@16.0.0/fesm2022/ng-bootstrap.mjs — 421 partial declarations carrying version "17.0.0", which this cell\'s linker refuses.',
			'https://registry.npmjs.org/preboot — 94 versions; 8.0.0 (2021-01-18) is `latest` and the only tag, declares peer @angular/common and @angular/core ">=11.0.0" and dependency tslib ^2.0.0, and every version carries the deprecation "This package is no longer maintained and is unnecessary with the recent versions of Angular."',
			'https://registry.npmjs.org/preboot/-/preboot-8.0.0.tgz — ships preboot.metadata.json beside bundles/, esm2015/ and fesm2015/; fesm2015/preboot.js declares its module as `PrebootModule.decorators = [{ type: NgModule, ... }]`; no ɵɵngDeclare* and no ɵɵdefineNgModule anywhere in the tarball; module.d.ts publishes `export declare class PrebootModule` with no ɵmod, ɵfac or ɵinj.',
		],
		gapDispositions: GAP_DISPOSITIONS,
		rerun: RERUN,
		logs: [
			'migration/u1-t024-lane-install.log',
			'migration/u1-t024-target-build.log',
			'migration/u1-t024-composed-changeset.json',
			'migration/u1-t024-source-migration.json',
		],
		notEstablished: [
			'Closing four gaps is not a green migration. This application does not build, and the record above says so with the compiler\'s own words.',
			'A registry reading is a reading of published bytes, not a behavioural claim. Nothing establishes that @ng-bootstrap/ng-bootstrap 15.1.2 renders what 3.1.0 rendered, and the NgbModule.forRoot() refusal is direct evidence that its surface moved.',
			'Dropping preboot is a declared difference, not a repair. An application that imported it would meet the drop as a source demand; this one does not import it.',
			'The two new capabilities are proven by one application each. They are recorded experimental in the capability-coverage map for exactly that reason.',
			'`packagesInstalled: 1689` is a statement about this closure on this host on this date. It is not a claim that the closure is reproducible: the era lockfile was removed by the changeset and no new lockfile digest is recorded here.',
		],
	};
}

/**
 * The third re-run: G6, the call surface itself.
 *
 * u2 narrowed this application's wall to one class and named it rather than
 * chasing it. This block is what happened when it was chased. It is not a green
 * build and it does not claim one: every `@angular/http` diagnostic the compiler
 * stated is gone and one class remains, which belongs to a different capability
 * and is named here in the compiler's own words rather than fixed in passing.
 */
export const U3_UNIT = 'lrapr-t024/u3-httpclient-call-surface';

export function buildCallSurfaceBlock(): Record<string, unknown> {
	return {
		unit: U3_UNIT,
		boardTask: 'T024',
		stage: 'stage-3 — close G6, the HttpClient call surface, and re-run the holdout lane',
		outcome: 'install-green-build-red-one-remaining-class-beyond-g6',
		result:
			'G6 is closed by one capability that carries a removed HTTP client’s call surface as a whole flow: every one of the seven diagnostics u2 recorded — five TS2307, one webpack module-not-found and the TS2339 on `.json` — is gone, and the compiler states no new one. `@angular/http` is no longer named anywhere in the migrated tree. The build is still RED, on one class that is not G6 and was already in u2’s own build log: a stylesheet subpath an exports map no longer publishes under the spelling the era application imported. It is named below and was not chased.',
		authorization:
			'An authorized reopen of the frozen adapter subtrees for this unit only. The React subtree is untouched at 972ca80155bbc2a6eb3779943cd481b71d35e803.',
		consentId: CONSENT,
		commit: COMMIT,
		subpath: APPLICATION_SUBPATH,
		networkAccess:
			'none. Every reading this unit took is a reading of the lane’s own installed closure or of a previous pass’s own build log; no packument and no tarball was fetched.',
		capabilityAdded: {
			name: 'http-client-call-surface',
			entryPoints: ['migrateHttpClientCallSurface', 'readSuccessorClassSurface (driver-side reading)'],
			shape:
				'A whole-flow carriage of a removed HTTP client, composed into migrateAngularCliEraWorkspace after the use-position carriage whose refusals it answers, and supply-gated twice over: on the successor package’s installed root surface, and on the installed declarations of the successor classes themselves — read member by member for the type each returns and the option keys each takes. Refusal is per declaration and total.',
			subRules: [
				'The injected service. `Http` is carried to `HttpClient` only where every reference to it is the declared type of an injected parameter, and the binding it declares is what the call rules below then ride.',
				'The body accessor and the emitted type, as one edit. `.json()` is removed because the successor emits the parsed body, and the type the flow emits is restated in the same changeset from the application’s own declared `Observable<T>` return type, read from the function the call is returned from. A flow the application never typed is refused, not typed `any` by the capability’s own choice.',
				'The `body` an era `GET` carried. The call is moved to `request(method, url, options)` — the member the installed declaration says publishes `body` — rather than having the option dropped. An option no member of the successor publishes refuses the module instead.',
				'Header mutation. Every discarded `Headers.append` becomes an assignment back to its receiver, gated on reading from the installed successor that the mutator returns the class. A mutator call whose value the era code did not discard is refused, because the era member returned nothing and the successor returns a value.',
				'The response annotation. A `Response` annotating an operator callback parameter in a pipe is carried to `any` — the type the era `Response.json()` returned — and the loss of checking is declared. Any other position refuses the module.',
			],
			appliedHere:
				'Client/modules/shared/services/security.service.ts: Http -> HttpClient, Headers -> HttpHeaders, five discarded appends reassigned, `get(url, { headers, body: \'\' })` -> `request<string[]>(\'GET\', url, { headers, body: \'\' })`, `.json()` removed. Client/modules/{basket,campaigns,catalog,orders}.service.ts: ten `Response` annotations carried to `any` and four now-empty declarations removed.',
		},
		whyAnyAndNotAType: {
			question:
				'The four consumer services declare `Observable<ICatalog>`, `Observable<IBasket>` and so on. Why is the annotation on what they receive carried to `any` rather than to the type they declare?',
			measured:
				'Three answers were considered against what the compiler accepts, with no strictness weakened anywhere: (1) let `Response` resolve to the DOM global — reproduces the withdrawn u2a experiment exactly, because `Observable<Response>` is not assignable to `Observable<ICatalog>`; (2) carry the annotation to the enclosing declared element type — type-checks for the seven identity callbacks and is impossible for the three in basket.service.ts, where one callback reads `response.status` (a member `IBasket` does not have) and two return a `boolean` the parameter is not; (3) carry it to `any`, which is what the era `@angular/http` `Response.json()` returned and therefore the strength the era flow actually had. (3) is what is written, uniformly, because a rule that spelled two different types into one syntactic position would be two claims and the second of them would refuse basket.service.ts and leave its declaration unresolved.',
			whatIsNotClaimed:
				'This is a loss of checking and it is declared as one. What it is not is a behaviour change: this application’s own DataService was already on HttpClient at the pin, so the value these parameters received was already the parsed body and `response.status` was already undefined at the era. The producer’s own `Observable<Response>` annotation in data.service.ts — against the DOM `Response`, on a body-observing HttpClient call — is the application’s own stale typing, it is not an import of the removed package, and it is left exactly as the application wrote it. It is consistent with the retyped consumers rather than contradicting them, which is why the flow reconciles; naming it is not the same as having rewritten it.',
		},
		laneInstall: {
			command: 'npm install --no-audit --no-fund --ignore-scripts',
			cell: 'node v16.20.2 (official darwin-arm64 build, native), npm 8.19.4, CI=1',
			exitStatus: 0,
			forcedFlagsUsed: false,
			narrowingApplied: false,
			log: 'migration/u3-t024-lane-install.log',
		},
		targetBuild: {
			command: 'npm run build:prod (ng build --configuration production --aot)',
			attempted: true,
			produced: false,
			exitStatus: 1,
			runs: 1,
			runsNote:
				'A second run and a byte comparison were not performed and are not claimed: the build does not complete, so there is nothing to compare.',
			log: 'migration/u3-t024-target-build.log',
			g6DiagnosticsClosed: [
				'Client/modules/basket/basket.service.ts:2 TS2307 Cannot find module \'@angular/http\'.',
				'Client/modules/campaigns/campaigns.service.ts:2 TS2307.',
				'Client/modules/catalog/catalog.service.ts:2 TS2307.',
				'Client/modules/orders/orders.service.ts:2 TS2307.',
				'Client/modules/shared/services/security.service.ts:2 TS2307.',
				'./Client/modules/shared/services/security.service.ts:1:0-46 webpack Module not found: Can\'t resolve \'@angular/http\'.',
				'Client/modules/shared/services/security.service.ts:229 TS2339 Property \'json\' does not exist on type \'unknown\'.',
			],
			newTypeDiagnostics: 'none. The compiler stated no diagnostic in any file this capability edited.',
			remainingDiagnostics: [
				'./Client/globals.scss - Error: Module build failed (sass-loader): Can\'t find stylesheet to import. @import "ngx-toastr/toastr-bs4-alert.scss" (Client/globals.scss 3:9).',
				'./Client/globals.scss?ngGlobalStyle - the mini-css-extract sibling of the same failure.',
			],
		},
		classNamedNotChased: {
			id: 'G7',
			name: 'Exports-map stylesheet subpath spelling',
			site: 'Client/globals.scss:3',
			statement:
				'ngx-toastr@17.0.2 publishes an `exports` map whose keys are extensionless — `"./toastr-bs4-alert": { "default": "./toastr-bs4-alert.scss" }` — so the file exists on disk at node_modules/ngx-toastr/toastr-bs4-alert.scss and the specifier the era application wrote, with its `.scss` extension, is not a subpath the map answers. The sibling `@import "bootstrap/scss/bootstrap"` resolves because bootstrap 4.1.3 publishes no exports map at all. The adapter already carries the capability for this — migratePackageStyleImports, which rewrites a style specifier onto a subpath a package’s exports map does publish — and this driver supplies it no `packageExports` reading, so it stands down. That is a wiring gap in the driver rather than a missing capability, and it is not G6: it was already present in u2’s own build log at lines 41-56, where u2’s remaining-diagnostics list did not record it.',
			notChasedBecause: 'The unit was scoped to the call surface. Naming a class in the compiler’s words and leaving it is what keeps the next unit’s question honest.',
		},
		greenVerticals:
			'No counted vertical’s changeset shifted. The capability is supply-gated on readings no other lane supplies — a successor-class surface reading no other driver takes — and it edits nothing in a module that never imported the removed specifier.',
		artifacts: {
			composedChangeset: 'migration/u3-t024-composed-changeset.json',
			sourceMigration: 'migration/u3-t024-source-migration.json',
			seamProbe: 'migration/u3-t024-angular-http-seam-probe.json',
			laneInstallLog: 'migration/u3-t024-lane-install.log',
			targetBuildLog: 'migration/u3-t024-target-build.log',
			withdrawnRuleBuildLog: 'migration/u2a-t024-target-build.log',
			priorRedRecordsNote:
				'The runner writes its output under the u5 names. Those three files were restored to the bytes T023 sealed after this re-run, byte for byte, and this pass’s own are kept beside them under u3-t024 names.',
		},
		changesetCounts: {
			applicationFilesScanned: 84,
			applicationFilesChanged: 17,
			workspaceFilesChanged: 3,
			filesWritten: 20,
			filesRemoved: ['tslint.json', 'package-lock.json'],
			unhandled: 31,
			declaredDifferences: 17,
			handEdits: 0,
			note: 'u2 recorded 12 application files changed, 24 unhandled and 13 declared differences on this tree. The five service modules this unit carries are the difference in the first count; the seam probe is now offered zero modules because no migrated file names @angular/http.',
		},
		notEstablished: [
			'The build does not complete, so nothing here establishes determinism, byte stability, an output inventory, parity or any browser behaviour for this application.',
			'The capability is proven on one application and is recorded experimental in the capability-coverage map. It is not claimed general.',
			'Carrying a `Response` annotation to `any` keeps the era’s checking strength; it does not add any. A member read through one of those parameters is unchecked, and the record above says so.',
			'That the compiler states no new diagnostic is a statement about this compilation. It is not a statement that the migrated services behave as the era ones did: no test and no journey has run against either.',
		],
	};
}

/**
 * The fourth re-run: G7, and the first production build of this application on
 * the target line that completes.
 *
 * u3 left one class standing and named it in the compiler's own words: a
 * stylesheet subpath an `exports` map does not answer under the spelling the era
 * application wrote. This block is what happened when the reading that class was
 * gated on was supplied. The outcome is a green build, built twice into separate
 * outputs and compared byte for byte, and the whole of the comparison is
 * recorded rather than summarised — including that the two runs' hashed
 * filenames are the same, which is the part a determinism claim actually rests
 * on.
 */
export const U4_UNIT = 'lrapr-t024/u4-exports-map-wiring-green-attempt';

/**
 * The output inventory, stated file by file against the era baseline's own.
 *
 * Every path is matched with its content hash elided, because a hashed filename
 * is the builder's function of the bytes and comparing the literal names across
 * two different Angular majors would say nothing. What the comparison does say
 * is that the same twenty-five files come out, that every asset the application
 * ships is carried across byte for byte, and that exactly four artefacts — the
 * three emitted bundles and the extracted stylesheet — differ, which is what a
 * changed framework and a changed builder are.
 */
export const OUTPUT_INVENTORY = Object.freeze({
	files: 25,
	totalBytes: 1_524_958,
	baselineFiles: 25,
	baselineTotalBytes: 1_660_416,
	carriedByteIdentical: [
		'assets/images/arrow-down.png',
		'assets/images/arrow-right.svg',
		'assets/images/brand.png',
		'assets/images/brand_dark.png',
		'assets/images/cart.png',
		'assets/images/logout.png',
		'assets/images/main_banner.png',
		'assets/images/main_banner_text.png',
		'assets/images/main_footer_text.png',
		'assets/images/my_orders.png',
		'favicon.ico',
		'Montserrat-Bold.<hash>.eot',
		'Montserrat-Bold.<hash>.svg',
		'Montserrat-Bold.<hash>.ttf',
		'Montserrat-Bold.<hash>.woff',
		'Montserrat-Regular.<hash>.eot',
		'Montserrat-Regular.<hash>.svg',
		'Montserrat-Regular.<hash>.ttf',
		'Montserrat-Regular.<hash>.woff',
	],
	differingFromBaseline: [
		'main.<hash>.js — 649045 bytes at the era, 503114 here.',
		'polyfills.<hash>.js — 64314 at the era, 58970 here.',
		'runtime.<hash>.js — 1440 at the era, 1062 here.',
		'styles.<hash>.css — 134172 at the era, 133394 here.',
		'index.html — 707 at the era, 3073 here; the Angular 16 builder inlines critical CSS the CLI 6 builder linked.',
		'3rdpartylicenses.txt — 2179 at the era, 16786 here; a different closure has different licences in it.',
	],
	onlyInEra: [],
	onlyInMigrated: [],
	note: 'No file appears in one lane and not the other. The four emitted artefacts and the two generated text files differ, and every image, font and icon the application ships is carried across byte for byte.',
});

export function buildExportsMapBlock(): Record<string, unknown> {
	return {
		unit: U4_UNIT,
		boardTask: 'T024',
		stage: 'stage-4 — close G7 and attempt the holdout build',
		outcome: 'green-build-twice-byte-identical',
		result:
			'G7 is closed and the migrated lane builds. `npm run build:prod` exits 0, emits twenty-five files into `wwwroot`, and a second run of the same command into a separate output is byte-identical to the first — same file names, same digests, no exceptions. The emitted stylesheet carries the toastr rules the blocked import was for, so the repair is a repair and not a silently dropped import. This is the first production build of the eShopOnContainers WebSPA on Angular 16.2 in this repository, and it was reached without one hand edit to application source, one application-name branch, or one weakened check.',
		authorization:
			'An authorized reopen of the frozen adapter subtrees for this unit only. The React subtree is untouched at 972ca80155bbc2a6eb3779943cd481b71d35e803.',
		consentId: CONSENT,
		commit: COMMIT,
		subpath: APPLICATION_SUBPATH,
		networkAccess:
			'none. The lane install reported `up to date` against the closure u3 already installed, every reading this unit took is a reading of that closure or of a previous pass\'s own build log, and no packument and no tarball was fetched.',
		wiringDecision: {
			question:
				'The `packageExports` reading G7 was open on: does it belong in the composition, where every application would get it, or in this lane\'s driver?',
			answer: 'driver',
			reasoning:
				'The T021-u1 wiring-repair precedent puts a precondition in the composition when it is supply-complete there — derivable from bytes the composition already holds — and in the driver when it needs the lane\'s installed closure. This one needs the closure: an `exports` field is a fact about the package version a lane resolved, and the composition is handed application bytes, not a `node_modules`. It is therefore taken driver-side, by `readPackageExports`, exactly where the T024-u2 successor-class surface reading and the u3 call-surface readings are taken — as the fifth member of this driver\'s `LaneReadings`, from the same tree, under the same gate: a lane with no closure supplies none and the capability stands down.',
			genericity:
				'The reading names no package. It enumerates the runtime dependencies the lane\'s own migrated manifest declares, reads each installed `package.json`, and keeps the ones that publish an `exports` field at all. A package that publishes none contributes no reading, which is a fact about that package rather than an exception written for it.',
		},
		capabilityExtended: {
			name: 'package-exports-style-imports',
			entryPoints: ['migratePackageStyleImports', 'republishedSubpath', 'readPackageExports (driver-side reading)'],
			whyExtensionAndNotWiringAlone:
				'The wiring alone would not have closed G7, and saying so is the finding. Once the reading was supplied the capability did reach this stylesheet and did refuse it, by name: ngx-toastr@17.0.2 publishes no root aggregate `./ngx-toastr.scss`, so the one rule the capability had — substitute the package\'s whole stylesheet for a blocked granular import — had nothing to substitute. The rule it needed is narrower than the one it had, not wider.',
			rule: 'republished subpath — the exact successor',
			shape:
				'A blocked specifier whose file the exports map still publishes under a different key is rewritten onto that key. The candidate is found by running the map\'s own resolution backwards over its literal keys and keeping those that resolve to exactly the file the blocked import named; pattern keys are not considered, because a pattern that resolved that file would have resolved the blocked subpath itself and nothing would be blocked. Where several literal keys name the one file the first in sort order is taken — they are the same bytes by construction, and taking a stated one keeps the rewrite deterministic.',
			whyItDeclaresNothing:
				'The new specifier resolves to the same file the old one named, so not one byte of payload changes and there is nothing to declare. That is what distinguishes it from the aggregate substitution beside it, which does change the payload and says so in bytes.',
			whyAllOrNothing:
				'The repair is taken only when every blocked import of the package in that stylesheet has one. A stylesheet where some blocked imports were repaired and the rest replaced by the package aggregate would import the same rules twice, so a stylesheet that cannot be wholly repaired falls through to the aggregate rule unchanged.',
			appliedHere:
				'Client/globals.scss line 3: `~ngx-toastr/toastr-bs4-alert.scss` -> `ngx-toastr/toastr-bs4-alert`. ngx-toastr@17.0.2 publishes `"./toastr-bs4-alert": { "default": "./toastr-bs4-alert.scss" }`, so the file the era application named is exported one key away, extensionless.',
		},
		laneInstall: {
			command: 'npm install --no-audit --no-fund --ignore-scripts',
			cell: 'node v16.20.2 (official darwin-arm64 build, native), npm 8.19.4, CI=1',
			exitStatus: 0,
			forcedFlagsUsed: false,
			narrowingApplied: false,
			log: 'migration/u4-t024-lane-install.log',
			note: 'The manifest this changeset writes is byte-identical to the one u3 wrote, so npm reported the closure up to date. The install was re-run rather than assumed.',
		},
		targetBuild: {
			command: 'npm run build:prod (ng build --configuration production --aot)',
			attempted: true,
			produced: true,
			exitStatus: 0,
			runs: 2,
			runsNote:
				'Two full runs from a removed `wwwroot`, each copied out before the next began, then compared file by file by path, size and digest. Every path matches, every digest matches, and the hashed filenames are the same in both runs — which is the part the determinism claim rests on, and it is stated rather than implied.',
			byteIdenticalAcrossRuns: true,
			log: 'migration/u4-t024-target-build.log',
			secondRunLog: 'migration/u4-t024-target-build-run2.log',
			inventory: 'migration/u4-t024-build-inventory-run1-vs-run2.json',
			g7DiagnosticsClosed: [
				'./Client/globals.scss - Error: Module build failed (sass-loader): Can\'t find stylesheet to import. @import "ngx-toastr/toastr-bs4-alert.scss" (Client/globals.scss 3:9).',
				'./Client/globals.scss?ngGlobalStyle - the mini-css-extract sibling of the same failure.',
			],
			remainingDiagnostics: [],
			remainingWarnings: [
				'Four dart-sass deprecation warnings for `/` used as division outside `calc()`, in Client/modules/campaigns/campaigns.component.scss, Client/modules/catalog/catalog.component.scss and Client/modules/shared/components/pager/pager.scss. They are the application\'s own SCSS as it was written at the pin and no capability was invented to rewrite it.',
				'One warning that Client/modules/shared/services/notification.service.ts is part of the TypeScript compilation but unused. It is the application\'s own tsconfig `include` reaching a module nothing imports, and it is left as the application wrote it.',
			],
			emittedProof:
				'The extracted stylesheet carries eighteen distinct `.toast-*` rule selectors, so the repaired import was read and compiled rather than resolving to nothing.',
		},
		outputInventory: OUTPUT_INVENTORY,
		classClosed: {
			id: 'G7',
			name: 'Exports-map stylesheet subpath spelling',
			site: 'Client/globals.scss:3',
			closedBy:
				'A `packageExports` reading of the lane\'s installed closure, taken driver-side, plus the republished-subpath rule the reading then made reachable. Nothing about this application is named in either.',
			newClassesFound: 'none. No diagnostic remains and no new class was reached.',
		},
		greenVerticals:
			'No counted vertical\'s changeset shifted. The stylesheet capability is gated on a `packageExports` reading no other Angular driver supplies, and the rule added inside it fires only on a blocked import whose file the map republishes — a case no other lane\'s stylesheets contain. The full node suite is green.',
		artifacts: {
			composedChangeset: 'migration/u4-t024-composed-changeset.json',
			sourceMigration: 'migration/u4-t024-source-migration.json',
			seamProbe: 'migration/u4-t024-angular-http-seam-probe.json',
			laneInstallLog: 'migration/u4-t024-lane-install.log',
			targetBuildLog: 'migration/u4-t024-target-build.log',
			secondBuildLog: 'migration/u4-t024-target-build-run2.log',
			buildInventory: 'migration/u4-t024-build-inventory-run1-vs-run2.json',
			priorRedRecordsNote:
				'The runner writes its output under the u5 names. Those three files were restored to the bytes T023 sealed after this re-run, byte for byte — digests 9867c18e, c90438ca and 5709ccd9 — and this pass\'s own are kept beside them under u4-t024 names. Every earlier red record, u1 through u3, is untouched.',
		},
		changesetCounts: {
			applicationFilesScanned: 84,
			applicationFilesChanged: 20,
			workspaceFilesChanged: 3,
			filesWritten: 20,
			filesRemoved: ['tslint.json', 'package-lock.json'],
			unhandled: 31,
			declaredDifferences: 17,
			handEdits: 0,
			note: 'Exactly one file\'s bytes differ from u3\'s changeset: Client/globals.scss, whose line 3 the new rule rewrote. The counts are otherwise u3\'s, because globals.scss was already counted as changed there — the tilde capability had already dropped the `~` from its sibling bootstrap import. The unhandled and declared-difference totals do not move: this rule declares nothing and refuses nothing.',
		},
		notEstablished: [
			'A build that completes and repeats is not a build that behaves. No test, no journey and no witness has run against this application in either lane, so nothing here establishes parity, rendering or any browser behaviour.',
			'Determinism is established for two runs in one cell on one machine. It is not a claim about another machine, another Node build, or a cold npm cache.',
			'The output inventory compares the migrated lane against the era baseline by path with content hashes elided. Two files bearing the same elided name are not thereby claimed to have the same content — the four emitted artefacts are named as differing precisely because they do.',
			'The capability is proven on one application. The republished-subpath rule fired on one import of one package, and nothing here claims it general.',
			'Every declared difference u3 recorded still stands. Closing the build did not retire the loss of checking the `Response` annotations were carried with.',
		],
	};
}

export function buildExportsMapRecord(): SealedRecord {
	return sealRecord({
		schemaVersion: 'versionless.angular-eshop-webspa-t024-rerun.v1',
		...buildExportsMapBlock(),
	});
}

export function buildCallSurfaceRecord(): SealedRecord {
	return sealRecord({
		schemaVersion: 'versionless.angular-eshop-webspa-t024-rerun.v1',
		...buildCallSurfaceBlock(),
	});
}

export function buildRerunRecord(): SealedRecord {
	return sealRecord({
		schemaVersion: 'versionless.angular-eshop-webspa-t024-rerun.v1',
		...buildRerunBlock(),
	});
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
	const rerun = verifySealedRecord(buildRerunRecord());
	const attempt = JSON.parse(await readFile(ATTEMPT_FILE, 'utf8')) as Record<string, unknown>;
	attempt['migration'] = record;
	/**
	 * The T023 red is left exactly where it was. The re-run is a second block
	 * beside it, because a record that overwrote the red would delete the only
	 * evidence of what the silence cost.
	 */
	attempt['t024Rerun'] = rerun;
	/**
	 * The u2 block is left where it was for the same reason: it is the record of
	 * the measured withdrawal, and a unit that overwrote it would delete the
	 * evidence its own rule was chosen against.
	 */
	attempt['t024U3Rerun'] = verifySealedRecord(buildCallSurfaceRecord());
	/**
	 * And the u3 block is left where it was for the third time. The reds are the
	 * measurement this green is only meaningful against: a record that collapsed
	 * four passes into one green block would delete the evidence of what each wall
	 * actually was.
	 */
	attempt['t024U4Rerun'] = verifySealedRecord(buildExportsMapRecord());
	await writeFile(ATTEMPT_FILE, `${JSON.stringify(attempt, null, 2)}\n`);
	process.stdout.write(
		`re-run recorded ${String(rerun['outcome'])}: ` +
			`${String(GAP_DISPOSITIONS.filter((gap) => gap.state === 'closed').length)}/` +
			`${String(GAP_DISPOSITIONS.length)} gaps closed, install exit ` +
			`${String(RERUN.install.exitStatus)} (${String(RERUN.install.packagesInstalled)} packages), ` +
			`build exit ${String(RERUN.build.exitStatus)}\n`,
	);
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
