# SPIKE A — Angular 12/13 ngcc-bearing cell feasibility

**Measured 2026-08-14. Registry reads and tarball fetches under consent `VL-LEGACY-CORPUS-2026-08-10`; offline after the fetches.**

## The question

The sealed pigallery2 holdout RED (`evidence/runs/holdout-angular-pigallery2/receipt.json`, canonical digest `39a133ff…`) names three no-successor pre-Ivy libraries at six import sites and declares them unsupported at the Angular 16 cell, because Angular 16 removed ngcc. The boundary's own non-claim says an ngcc-bearing 12/13 cell *would* consume those bytes — but says so as an expectation, not a measurement.

This spike measures it. It builds no cell, migrates no application, and touches no frozen subtree.

## The answer

**Yes — at both Angular 12.2.17 and Angular 13.4.0.** An AOT probe that imports all three library NgModules and binds one element from each in a template compiles with **exit 0 and zero diagnostics** at both lines.

| Library | Shipped as | ngcc at 12 | ngcc at 13 | Consumable |
|---|---|---|---|---|
| `@yaga/leaflet-ng2@1.1.0` | CommonJS tree, **already Ivy**, no `.metadata.json` | no-op (correctly) | no-op (correctly) | yes, unconditionally |
| `jw-bootstrap-switch-ng2@2.0.5` | ViewEngine ng-packagr (umd/esm5/esm2015/fesm5/fesm2015 + metadata) | clean back-compile | clean back-compile | yes, no flags |
| `ng2-slim-loading-bar@4.0.0` | ViewEngine esm5 + metadata; `main` is a **webpack** bundle | needs `-p module main` | needs `-p module main` **and rxjs 6** | yes, conditionally |

None of the three carries a deprecation marker in the registry. All three are terminal: 1.1.0 (2021), 2.0.5 (2019), 4.0.0 (2017).

## The three things worth knowing

**1. `@yaga/leaflet-ng2` was never an ngcc problem.** It is already Ivy — full-compilation mode against Angular 12 — and ships no `.metadata.json`, which is exactly how ngcc decides whether a package is its business (`entry_point.js:94`). ngcc looks at it and does nothing, at both lines, and it is right to. The Angular 12 and 13 compilers read its Ivy typings directly. The sealed receipt's reading is unchanged and correct; what it describes only bites at a major with no ngcc and no linker input.

**2. An ngcc exit code of 0 is not a verdict.** `ng2-slim-loading-bar` exits 0 under ngcc's default property order and still emits a broken typing, because ngcc gave typings processing to `main`, which is a webpack bundle it cannot reflect. The application compiler then raises `NG6005` on `forRoot(): ModuleWithProviders` with no generic, the `@NgModule` literal becomes unanalysable, and five `NG8001`/`NG8002` template diagnostics fall out downstream — including a *"not a known element"* for `bSwitch`, a library ngcc had back-compiled perfectly. **That is the sealed pigallery2 downstream shape reproduced in miniature, and it is checkable rather than asserted.** Re-running ngcc as `-p module main` rewrites the typing to `ModuleWithProviders<SlimLoadingBarModule>` with the Ivy statics beside it, and all six diagnostics disappear at once.

**3. The Angular 13 failure is rxjs, not Angular.** ngcc 13 refuses `ng2-slim-loading-bar` outright — `has missing dependencies: rxjs/Subject, rxjs/Observable` — because rxjs 7 stopped shipping those paths. The control closure (identical `@angular/compiler-cli@13.4.0`, rxjs 6.6.7 instead of 7.5.7 — legal under Angular 13's own peer range `^6.5.3 || ^7.4.0`) turns the hard error back into the same benign warning Angular 12 emits, and both formats compile.

## Honest cell: **Angular 13.4.0**, Node 16.20.2

Angular 13 keeps a real ngcc (`bundles/ngcc/main-ngcc.js`) and announces its work as *"Processing legacy \"View Engine\" libraries"*. ngcc survives as a real entry point through 15.2.10; only 16.2.12 degrades to the stub the sealed record already names. 13 also costs *less* ngcc than 12, because 13 publishes Angular's own packages Ivy-native — at 12 a targeted run leaves `@angular/platform-browser` unprocessed and the compiler raises `NG6002` on `BrowserModule`, so a 12 cell must run ngcc closure-wide every time.

**The cell implies no new Node era.** Both lines admit Node 16, and 16.20.2 is already materialised under `.versionless/cache` from the Angular 16 verticals. Angular 12 stays green as the fallback if the rxjs 6 pin proves impossible, at the cost of TypeScript 4.3.5 and closure-wide ngcc.

## T001 estimate: holds, tightens at the risk end

T001 priced the cell at **~25–40 units / 2–4 focused days**. Nothing here moves it outside that band, but the band's shape changes: the dominant unknown — whether the cell could consume these bytes at all — is answered green with executed runs, so read it as **~25–35 units with the dead-end risk removed from the mechanism**. Two small unnamed costs appear (plumbing the ngcc properties override into a builder, ~1–2u; era-pinning floating transitive `@types`, ~1u — `@types/leaflet ^1.2.8` floats to syntax TypeScript 4.3/4.6 cannot parse, and that generalises past pigallery2). The expensive part is untouched: the sealed record says a new cell invalidates every Angular 16 cell reading, so this is a re-freeze epoch and a claims regeneration, not an additive publish.

**What the spike does not de-risk is the proving app.** Three of pigallery2's seven gaps are these libraries. Four remain, and the receipt is explicit that clearing gaps lets the compiler reach code it has not yet read. A green on the libraries is a green on the boundary, not a green on the application.

## What this does not change

- **The pigallery2 RED stands**, unretried and unweakened, as permanent falsification evidence at the Angular 16 cell.
- **The boundary `angular-16-pre-ivy-only-dependency` stands exactly as published.** This spike measures a *different* cell — which is what the boundary's own non-claim anticipated. That non-claim now rests on executed runs instead of expectation.
- **Freeze `27741d9c…` is intact.** No `packages/**` file was written; the scratch closures live under `.versionless/work/spike-ngcc-1213/` and nothing there is committed.

## Files

| File | What it holds |
|---|---|
| `registry-metadata.json` | every URL read, published version lists, dist-tags, deprecation state, declared peers/engines, shipped format properties, tarball digests, and the ngcc-bin map across `@angular/compiler-cli` 11→16 |
| `ngcc-runs.json` | the three closures, eleven ngcc invocations and four AOT probes with **verbatim** output (host paths and PIDs redacted), plus the emitted typing that decides the `ng2-slim-loading-bar` verdict |
| `verdict.json` | per-library verdicts with mechanisms and conditions; the D1 overall verdict, honest cell, Node era, T001 estimate reading, and four open questions |
