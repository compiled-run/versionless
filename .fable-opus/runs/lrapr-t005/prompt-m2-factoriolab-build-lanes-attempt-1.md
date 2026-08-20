Fable-Opus-Unit: lrapr-t005/m2-factoriolab-build-lanes
Fable-Opus-Timeout-Minutes: 35

## Goal

Complete the factoriolab migration cell's BUILD LANES in /Users/jacksm5pro/dev/open-source/versionless. Unit m1 delivered the adapter architecture (`packages/frameworks/angular`: target-cell alignment, angular.json migration, tsconfig lift, analyzer-driven source migration, composed changeset — all uncommitted in this working tree, 941-test suite green) but no builds ran. PM answers to m1's open questions, baked in here:

1. The era caches are RESTORED: `.versionless/cache/angular-factoriolab-source` and `.versionless/cache/angular-factoriolab-baseline` (recovered from the a1 worktree — the baseline that built 42 dist files under Rosetta x64 Node 12.14.1 with LFS payloads materialized).
2. Consent VL-LEGACY-CORPUS-2026-08-10 covers BOTH dependency-closure acquisitions (era closure if the restored cache needs re-install, and the Angular 16 target closure) and any re-fetch of already-admitted digest-pinned artifacts. Use `VERSIONLESS_NETWORK_MODE=consented` only for those steps; record every URL/digest; offline after.
3. The declared target cell is ACCEPTED: Angular 16.2 / `@angular-devkit/build-angular:browser` / Node 16.20.2, with m1's recorded rationale. Do not re-declare.
4. Both lanes in ONE unit (this one).

Deliver:

1. Era baseline lane: rebuild ×2 from the restored cache, byte-stable, truthful outcome (if the restored cache cannot rebuild deterministically, record exactly why — that is evidence, not failure).
2. Migrated lane: apply the m1 composed changeset to the pinned tree, install the declared Angular 16.2 closure, and reach a deterministic ×2 production build through the official browser builder. REALITY CHECK EXPECTED: m1's `applicationFilesChanged: 2` was measured without building; an Angular 10→16 lift will almost certainly demand more (TypeScript 5.x strictness, RxJS 7, ngrx 10→16 API moves, builder option migrations). Extend the adapter's REUSABLE capabilities as reality demands — analyzer-driven, app-agnostic, each honest about its coverage, tests per capability, overfitting guard stays green. Update the migration record's truthful `applicationFilesChanged` count as it grows. If a required transform would have to be factoriolab-specific to work, that exact finding is a blocked-worthy discovery — do not smuggle it into product code.
3. Build-level parity recorded honestly under `evidence/runs/angular-factoriolab/` (dist inventories with digests, entry shapes, size deltas, known differences as recorded non-claims; no browser claims — witness is the next unit).
4. Whole repo gate green.

## File contract

- `packages/frameworks/angular/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `evidence/runs/angular-factoriolab/**`
- `fixtures/angular-factoriolab/**`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`

## Forbidden moves

- No packages/core/src changes (closed enumerations → blocked), no packages/frameworks/react/**, packages/cli/src/witness/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/**.
- No app-name/exact-revision/exact-source-string branches in product code; fixture-scoped accommodations stay in fixtures, recorded as such.
- No fabricated evidence; truthful reds; no test weakening; nothing loosened. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/angular-factoriolab'
```

## Blocked permission

If the migrated lane cannot reach a deterministic green build without app-specific product transforms, a closed enumeration outside the contract surfaces, or the honest cut line exceeds this unit, return status "blocked" with the exact state of both lanes and the cut line in open_questions instead of improvising.
