Fable-Opus-Unit: lrapr-t006/u18-super-productivity-migration-lanes
Fable-Opus-Timeout-Minutes: 35

## Goal

Deliver the super-productivity migration cell's both build lanes in /Users/jacksm5pro/dev/open-source/versionless — the Angular 8 pre-Ivy cell, and the fourth independent application over the Angular adapter spine. Commit `5edf6d8` era: ingest evidence at `evidence/ingests/angular-super-productivity-v2-13-15/` (Angular 8.2.6/CLI 8.3.4, ViewEngine, ngrx 8, TS 3.5.3, angular.json, ngsw + two web workers, Electron sidecar out of scope, git dependency jira2md recorded, zero-deviation baseline; caches at `.versionless/cache/angular-super-productivity-v2-13-15-{source,baseline}`).

The capability inventory is now deep (workspace migration, target-cell/ecosystem/testPackages tables, source migration incl. rxjs collapse/patch-migration, barrel split, deep-import redirection, entryComponents removal, ModuleWithProviders inference, union narrowing, tilde specifiers, builder declaration, TSLint removal, custom-webpack absorption, Sentry v8, NZ_MODAL_DATA). Angular 8→16.2 should ride mostly on it — measure what this app actually demands:

1. Era baseline lane: rebuild ×2 byte-stability truthfully measured from the restored cache (Node-cell per the ingest's declaration; the yarn-walks-up defect is recorded — reuse its fix).
2. Composed changeset over the pinned tree; consented Angular 16.2 closure install (VL-LEGACY-CORPUS-2026-08-10; the git dependency and both floating-latest deps get their cell dispositions recorded — jira2md's Angular-major independence should make it alignable-or-carried, read the registry/tarball facts); production build attempt ×2. RED with itemized demands is a completed outcome; extend reusable capabilities only as measured (ngrx 8→16 will exercise the createEffect migration's second app — record cross-proof movement; the ngsw config and web workers are era facts the workspace migration must carry or record).
3. Build-level parity or the honest red record under `evidence/runs/angular-super-productivity-v2-13-15/`; truthful `applicationFilesChanged` with digests; tests; overfitting guard extended; whole repo gate green.

## File contract

- `packages/frameworks/angular/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `evidence/runs/angular-super-productivity-v2-13-15/**`
- `fixtures/angular-super-productivity-v2-13-15/**`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`

## Forbidden moves

- No packages/core/src changes, no packages/frameworks/react/**, packages/cli/src/witness/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/**.
- No app-name branches in product code; no fabricated evidence; truthful reds; no test weakening. Network only for consented installs (recorded). Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/angular-super-productivity-v2-13-15'
```

## Blocked permission

If a demand cannot be generic (name the construct), the closure cannot resolve with recorded dispositions, or the honest cut line exceeds this unit (state exactly what lands vs what is owed), return status "blocked" with specifics in open_questions instead of improvising.
