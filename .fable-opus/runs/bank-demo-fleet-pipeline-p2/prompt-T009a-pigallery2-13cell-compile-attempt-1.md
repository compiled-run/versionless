Fable-Opus-Unit: bank-demo-fleet-pipeline-p2/T009a-pigallery2-13cell-compile
Fable-Opus-Timeout-Minutes: 30

## Goal

Answer, with pipeline-driven evidence, the two spike-A open questions that gate the whole Angular 13 cell: **(1)** where the ngcc properties override lives in a real cell (the spike applied `-p module main` at the command line; the Angular CLI drives ngcc itself during a build), and **(2)** whether **pigallery2's own source compiles (AOT) at Angular 13.4.0 / Node 16 / rxjs 6** — the spike proved the three dead libraries consumable but never compiled the app. Publish the readings as evidence so T009's later units (full migration, witness) and T010 (the freeze supersession) stand on measurements, not the spike's extrapolation.

Facts you inherit (verbatim from `evidence/spikes/ngcc-1213-feasibility/verdict.json` — read it first):

- Honest cell `angular-13.4.0`, Node runtime v16.20.2 (13's declared range `^12.20.0 || ^14.15.0 || >=16.10.0`); `@angular/compiler-cli 13.4.0` still ships a real ngcc bin at `bundles/ngcc/main-ngcc.js`.
- 13 costs strictly less ngcc than 12: Angular 13's own packages are Ivy-native, so only the two ViewEngine libraries need back-compiling; a 12 cell must ngcc the whole closure (NG6002 on BrowserModule otherwise).
- The three no-successor libraries: `@yaga/leaflet-ng2@1.1.0` (CommonJS under lib/, needs `-p module main` — the exit-0-with-broken-typing trap is documented: a zero exit is NOT proof, check the emitted typings), `jw-bootstrap-switch-ng2@2.0.5` (classic ViewEngine ng-packagr layout), `ng2-slim-loading-bar@4.0.0` (esm5 + metadata.json).
- rxjs pinned 6.x (pigallery2 1.7.0 is an Angular 8 app already on rxjs 6).
- Spike work areas on disk: `.versionless/work/spike-ngcc-1213/{a12,a13,a13rx6}` (a13rx6 has node_modules, package-lock.json, src, tsconfig.probe.json, out-probe). Pigallery2 itself: `.versionless/work/angular-pigallery2/{baseline,target,target-probe}`. Node runtimes materialize under `.versionless/cache/<id>-runtime/` (existing pattern: `angular-pigallery2-v1-7-0-runtime` currently holds node-v10; the tiny-translator/jira-clone runtime caches show the shape).

Deliver:

1. **Node 16.20.2 runtime materialized** the way the existing Angular verticals do it (`.versionless/cache/angular-13-cell-runtime/node-v16.20.2-darwin-<arch>/…` — follow the existing cache pattern; consented download only if the tarball is not already cached somewhere reusable — check the other runtime caches first; record how it was obtained).
2. **A 13-cell work area** (extend `.versionless/work/spike-ngcc-1213/a13rx6` or build a sibling `13cell/` beside pigallery2's baseline — say which): pigallery2 1.7.0's own `src/` against Angular 13.4.0, rxjs 6.x, the three dead libraries, dependencies installed at Node 16.
3. **ngcc driven the real way:** answer open question (1) by running the build the way the Angular CLI would — let the CLI's own ngcc invocation process the closure, and determine where the `-p module main` override for `@yaga/leaflet-ng2` must live in a real cell (ngcc.config.js at the project root? package-level config? document what actually worked, with the file committed as part of the work area recipe). The exit-0-with-broken-typing trap: after ngcc, CHECK the emitted `__ivy_ngcc__` typings for leaflet-ng2, do not trust exit 0.
4. **AOT-compile pigallery2's own source** at the cell (`ngc`/`ng build` equivalent — the spike's probe tsconfig is a starting point but the target is the APP's real modules, not a 3-import probe). Record: exit code, diagnostic count, and — if it does not compile — the first 20 diagnostics verbatim, classified (app-source issue vs library issue vs cell issue). A non-compiling app is a legitimate finding that re-prices T009; report it, do not fight it beyond mechanical fixes the diagnostics themselves name (e.g. a tsconfig lib target).
5. **Publish** `evidence/runs/angular-13cell/pigallery2-compile.json`: schema `versionless.angular-13cell-compile.v1`, carrying the cell (angular 13.4.0 / node v16.20.2 / rxjs 6.x verbatim from the lockfile), the ngcc invocation + per-library outcome (incl. the typings check), the AOT result, machine times, `notEstablished` (this proves compile-at-cell, NOT migration, NOT runtime behaviour, NOT the witness), and an integrity sha256. Also a small `README.md` beside it naming the recipe files.
6. A test is NOT required for this unit (it is an evidence-producing probe, like the spikes); the verify block checks the published record's shape instead. Say so in the receipt.

Do NOT touch the five frozen subtrees, the operator pipeline code, or any sealed evidence. This unit is measurements + work area + published record only. Budget: 30 minutes — installs at Node 16 may be slow; **start step 4 by minute 15 and the verify chain by minute 22**; if the AOT compile cannot finish in budget, publish what ran and return `blocked` naming the remaining step, not `partial`.

## File contract

- `.versionless/work/spike-ngcc-1213/**`
- `.versionless/work/angular-pigallery2/**`
- `.versionless/cache/**`
- `evidence/runs/angular-13cell/**`

## Forbidden moves

- Do not write inside `packages/**` at all. Why: this unit is a measurement; the pipeline code changes (cell registry, adapter) come later with their own gates, and T010 owns the freeze motion.
- Do not touch sealed evidence or the trust package. Why: nothing here changes a claim; the record is new evidence beside the spike's.
- Do not trust ngcc exit 0 for leaflet-ng2. Why: the spike documented exit-0-with-broken-typing; the typings check is the proof.
- Do not upgrade rxjs past 6.x or Angular past 13.4.0 to make something compile. Why: the honest cell is the claim being tested; a different cell is a different claim (report it as a finding instead).
- Do not fetch without consent vars (`VERSIONLESS_NETWORK_MODE=consented VERSIONLESS_CONSENT_ID=VL-LEGACY-CORPUS-2026-08-10` for app deps; say what you fetched). Why: consent posture is audited.
- **No git stash / checkout -- / reset / clean.** Why: standing rule.

## Verification

```verify
node -e "const r=require('./evidence/runs/angular-13cell/pigallery2-compile.json');if(r.schemaVersion!=='versionless.angular-13cell-compile.v1')throw new Error('schema');if(!r.cell||!/13\.4\.0/.test(r.cell.angular)||!/16\.20\.2/.test(r.cell.node))throw new Error('cell '+JSON.stringify(r.cell));if(!r.ngcc||!Array.isArray(r.ngcc.libraries)||r.ngcc.libraries.length<2)throw new Error('ngcc libraries');const y=r.ngcc.libraries.find(l=>/leaflet/.test(l.name));if(!y||typeof y.typingsChecked!=='boolean')throw new Error('leaflet typings check missing');if(!r.aot||typeof r.aot.exitCode!=='number')throw new Error('aot');if(!Array.isArray(r.notEstablished)||!r.notEstablished.length)throw new Error('notEstablished');if(!r.integrity||!r.integrity.sha256)throw new Error('integrity');console.log('13CELL-RECORD ok: aot exit '+r.aot.exitCode+' diagnostics '+(r.aot.diagnosticCount??'?')+' ngcc libs '+r.ngcc.libraries.length)"
test -f evidence/runs/angular-13cell/README.md && echo RECIPE-README-PRESENT
git diff --quiet HEAD -- packages/ && echo NO-PACKAGE-CODE-TOUCHED
git diff --quiet HEAD -- packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis && echo FREEZE-INTACT
npm run trust:verify -- --offline
```

`npm run trust:verify` WITHOUT `-- --offline` fails by design; it must still be valid (this unit changes no trust input).

## Blocked permission

If evidence is missing, the contract conflicts with reality, or you need a file outside the contract, return status "blocked" with the question in open_questions instead of improvising. Specifically block, do not improvise, if: Node 16.20.2 cannot be materialized on this host (name what is missing); a dependency of pigallery2 cannot be installed at the cell without violating the rxjs-6/Angular-13.4.0 pins (name it — that finding re-prices the cell); or the AOT compile needs an app-source change beyond what a diagnostic names mechanically.
