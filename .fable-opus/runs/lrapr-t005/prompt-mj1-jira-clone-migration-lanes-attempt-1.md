Fable-Opus-Unit: lrapr-t005/mj1-jira-clone-migration-lanes
Fable-Opus-Timeout-Minutes: 35

## Goal

Deliver the jira-clone migration cell's source migration AND both build lanes in /Users/jacksm5pro/dev/open-source/versionless — the Angular adapter's SECOND independent application (cross-proof). The adapter exists (`packages/frameworks/angular`, commits `bd20f81`/`8b01d0b`): target-cell + manifest alignment with testPackages, angular.json migration, tsconfig lift, analyzer-driven source migration, ngrx @Effect()→createEffect, composed changeset. factoriolab (Angular 10, plain builder) is proven; jira-clone is Angular 13.2.4 / CLI 13.2.5 / **`@angular-builders/custom-webpack:browser` with a root `webpack.config.js`** / ng-zorro 13 / Akita 7 / Tailwind 3 / TS 4.5.5.

Context (all committed): ingest evidence `evidence/ingests/angular-jira-clone/` (baseline green on native Node 16.20.2 via the repo's own `npm run build`; the pinned prod config carries an upstream-invalid `extractCss` key recorded as a defect; lockfileVersion 2). Caches RESTORED in this checkout: `.versionless/cache/angular-jira-clone-{source,runtime,baseline}`.

Deliver:

1. Migration to the accepted target cell: Angular 16.2 / `@angular-devkit/build-angular:browser` / Node 16.20.2 (same declared cell as factoriolab — record that reuse honestly). The EXPECTED new reusable capability is custom-webpack absorption: detect what the root `webpack.config.js` actually does (the scout suggests Tailwind wiring — verify against the real file) and migrate to the supported builder path generically (e.g. recognizing configurations the target line supports natively). The upstream-invalid `extractCss` key is part of what the workspace migration must handle honestly (a generic invalid-option policy, not an app-specific patch). If any required transform would have to be jira-clone-specific in product code, that finding is blocked-worthy — do not smuggle it.
2. Truthful `applicationFilesChanged` count via the composed changeset, itemized with before/after digests.
3. Era baseline lane: rebuild ×2 byte-stable from the restored cache (the repo's own green build path, deviations as recorded).
4. Migrated lane: Angular 16.2 closure install (consented acquisition step, consent ID VL-LEGACY-CORPUS-2026-08-10, VERSIONLESS_NETWORK_MODE=consented, every URL/digest recorded; offline after) then production build ×2 deterministic.
5. Build-level parity recorded honestly under `evidence/runs/angular-jira-clone/` (dist inventories with digests, known differences as recorded non-claims; Sentry DSN + GA id in the app are recorded risks — do not reproduce their values in evidence). No witness claims — next unit.
6. New capabilities tested per idiom; overfitting guard green; whole repo gate green.

## File contract

- `packages/frameworks/angular/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `evidence/runs/angular-jira-clone/**`
- `fixtures/angular-jira-clone/**`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`

## Forbidden moves

- No packages/core/src changes (closed enumerations → blocked), no packages/frameworks/react/**, packages/cli/src/witness/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/**.
- No app-name/exact-revision/exact-source-string branches in product code; fixture-scoped accommodations stay in fixtures, recorded as such.
- No fabricated evidence; truthful reds; no test weakening; nothing loosened. Network only for the consented closure acquisition. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/angular-jira-clone'
```

## Blocked permission

If custom-webpack absorption cannot be generic, the migrated lane cannot reach a deterministic green build honestly, a closed enumeration outside the contract surfaces, or the honest cut line exceeds this unit, return status "blocked" with the exact state of both lanes and the cut line in open_questions instead of improvising.
