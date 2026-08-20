Fable-Opus-Unit: lrapr-t024/u2-value-position-successor-and-compile-wall
Fable-Opus-Timeout-Minutes: 45
Fable-Opus-Effort: high
Effort-Justification: The value-position cross-package successor is the chase's hardest transform — a use-position classifier over type references, new targets, constructor params, and NgModule imports members with per-position substitution rules, where overreach silently rewrites app semantics and underreach leaves the holdout red; plus three more measured compile classes to close generically without app-identity branches.

## Goal

Close the eShop holdout's COMPILE wall generically in /Users/jacksm5pro/dev/open-source/versionless (T024, run lrapr-t024; AUTHORIZED ANGULAR REOPEN; React subtree `972ca80155bbc2a6eb3779943cd481b71d35e803` untouchable). After u1 (commit 82f48ab) the migrated install is GREEN; one build attempt shows: G3's six `@angular/http` sites (6×TS2307 + 2 webpack MNF), `NgbModule.forRoot()` gone at the aligned ng-bootstrap 15 line, `Observable.throw` ×3, and the tilde-sass wiring gap. Close all four:

1. G3 — VALUE-POSITION CROSS-PACKAGE SUCCESSOR (the u5 spec): extend/companion the `removed-entry-point-symbol-successor` seam family with a use-position classifier (type reference / `new` target / constructor param type / NgModule imports array member / call position with arity) and per-position substitution rules, driven by documented successor claims (registry deprecation + successor's published Ivy bytes — the @angular/http -> @angular/common/http case: Http->HttpClient, Response->HttpResponse<T> shape honestly handled, Headers->HttpHeaders, HttpModule->HttpClientModule; JsonpModule -> no-successor refusal, HttpClientJsonpModule is not a rename — if the app uses JsonpModule that refusal is a declared difference or a named RED, measure it). Type-position `Response` uses need the honest generic-parameter answer, not a blind rename. Tests per position class.
2. NgbModule.forRoot REMOVAL: ng-bootstrap 15 dropped `forRoot()` (the module is import-direct since v4). Generic capability: a documented removed-static-module-method reading (from the aligned line's published bytes — the method absent from the .d.ts) rewriting `X.forRoot()` in NgModule imports to `X` where the aligned line documents no replacement arguments. No app-name branch; supply-gated on the aligned reading.
3. Observable.throw ×3: the T021 audit named `rxjs-prototype-patch-migration` as an exported driver seam — compose or drive it (whichever the established pattern supports through public APIs) so RxJS 5-era prototype-patch usage (`Observable.throw`, and whatever else the app's bytes actually use — measure) migrates to the rxjs 7 equivalents (`throwError`). Only measured usages.
4. TILDE-SASS WIRING: give `migrateWebpackTildeStyleSpecifiers` its closure reading in the composition (the same G5-class wiring repair as T021 u1 — detector-gated).
5. Full node suite green; five green verticals' changesets unchanged (supply-gated only). Coverage entries stay experimental.
6. RE-RUN migration + install + build on the eShop lane; iterate within THIS unit's scope only (a new gap outside these four classes is named, not chased). If the build goes GREEN: run it TWICE and byte-compare; record honestly. Extend attempt.json + migration logs.

## File contract

- `packages/frameworks/angular/**`
- `packages/core/src/migrations/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `packages/core/src/receipts/capability-coverage.ts`
- `evidence/trust/current/capability-coverage.json`
- `evidence/ingests/angular-eshop-webspa-netcore2-2/**`

## Forbidden moves

- React subtree untouchable. No app-name/revision/exact-source branches; no app-source hand edits; no test weakening; no blind renames where the successor shape differs (Response generics). Network only for packument/tarball reads of named packages under consent VL-LEGACY-CORPUS-2026-08-10. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage. Kill processes.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'test "$(git rev-parse HEAD:packages/frameworks/react)" = "972ca80155bbc2a6eb3779943cd481b71d35e803" && echo REACT-INTACT'
```

## Blocked permission

If a position class cannot be substituted honestly (bring the site + why), the ng-bootstrap or rxjs reading contradicts the plan (bring the bytes), a NEW gap class outside these four appears (name it — do not chase), or the work exceeds this unit (say which classes closed and the current build state), return status "blocked" with specifics in open_questions instead of improvising.
