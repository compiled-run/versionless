Fable-Opus-Unit: lrapr-t005/m3-factoriolab-witness
Fable-Opus-Timeout-Minutes: 35

## Goal

Browser-prove the factoriolab vertical in /Users/jacksm5pro/dev/open-source/versionless — the goal's first Angular witness cell. Both lanes are committed and deterministic (commit `bd20f81`): era baseline (Angular 10, 42 dist files, cache `.versionless/cache/angular-factoriolab-baseline`) and migrated Angular 16.2 browser-builder build (39 dist files; regenerate offline via `packages/cli/src/fixture/angular-factoriolab-build-lanes-run.ts` if working trees are missing). No journey probe unit ran — probe the surface yourself first, then implement; the scout's sketch (unit a0) says: item picker dialog with autocomplete, quantity edits recomputing the production table, settings panel with persisted belt/machine/fuel selects, dataset/mod switch with URL-encoded state routing, columns/precision options modal. All data is local (LFS payloads materialized in the baseline cache); zero backend, zero stubs expected.

The template is the HospitalRun witness vertical (h3d, commit `a4b9325`): `packages/cli/src/witness/react-hospitalrun-run.ts`, `real-app-run.ts`, `witness-react-hospitalrun.ts` schema — including its now-generic exact-inventory mechanisms (console errors, failed requests, measured scroll, context-level SW policy).

Deliver:

1. factoriolab in `WITNESS_REAL_APP_NAMES` (narrow core allowance, follow the closed-list naming idiom; framework `'angular'`) and its journey in `packages/cli/src/witness/real-app-run.ts` plus a dedicated `packages/cli/src/witness/angular-factoriolab-run.ts` per the established per-app runner idiom.
2. At least three substantive journeys per the probe, exercised on BOTH lanes with real interactions (click, type into the autocomplete, keyboard, hover where meaningful, scroll ONLY where a route genuinely overflows — measure with the generic scroll-surface mechanism and claim truthfully; the a0 scout flagged compute-heavy recalculation, so anchor assertions on settled visible state, never timing).
3. Exact non-masking inventories per the h3d idiom for any console errors and failed requests each lane emits (empty inventories if genuinely silent — never a blanket allowance). Record SW state truthfully (none is expected in either lane — verify and record).
4. Baseline 2/2 + migrated 2/2 through local link:../witness; zero successful non-loopback; semantic byte-mutation on the migrated bundle (visible string → journey red → byte-identical restore → green rerun).
5. Core schema `packages/core/src/receipts/witness-angular-factoriolab.ts` per the established idiom, barrel-exported; canonical receipts at `evidence/runs/witness-angular-factoriolab/receipt.{json,md}` + artifacts under `evidence/runs/angular-factoriolab/`; redacted, unknowns preserved, self-limiting, `counted: false` pending Judge.
6. Tests per idiom; whole repo gate green. DO NOT touch aggregate.json, conformance, or trust — next unit.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/witness-angular-factoriolab.ts`
- `packages/core/src/receipts/witness-real-app.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `evidence/runs/angular-factoriolab/**`
- `evidence/runs/witness-angular-factoriolab/**`
- `fixtures/angular-factoriolab/**`

## Forbidden moves

- No other packages/core changes; no packages/frameworks/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/\*\*.
- No fabricated evidence; truthful reds; no page-load-only journeys; inventories are exact, never blanket; no app names in reusable surfaces beyond the closed-list idiom.
- No network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/witness-angular-factoriolab/receipt.json evidence/runs/witness-angular-factoriolab/receipt.md'
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
```

## Blocked permission

If a journey cannot pass truthfully (exact assertion + settled state), the compute-heavy recalculation makes an assertion genuinely non-deterministic, a closed enumeration outside the contract blocks receipts, or the work exceeds this unit (clear cut line), return status "blocked" with specifics in open_questions instead of improvising.
