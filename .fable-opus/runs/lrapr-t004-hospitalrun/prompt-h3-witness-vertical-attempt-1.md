Fable-Opus-Unit: lrapr-t004-hospitalrun/h3-witness-vertical
Fable-Opus-Timeout-Minutes: 35

## Goal

Browser-prove the HospitalRun vertical in /Users/jacksm5pro/dev/open-source/versionless (builds are deterministic and committed at ad16db4: era-pinned baseline + Vite 8 target under `.versionless/work/react-hospitalrun/`; rebuild offline via the fixture flow if missing). The papercups vertical (commits 19874ea → 2b7d5ff) is the template for every piece.

Deliver, following the papercups idiom throughout:

1. HospitalRun registration in `WITNESS_REAL_APP_NAMES` (`packages/core/src/receipts/witness-real-app.ts` — narrow allowance as before) and its journey in `packages/cli/src/witness/real-app-run.ts`. Persistence is browser-local PouchDB — no API or socket stub needed; assert what the app actually renders. At least THREE substantive journeys with real interactions and visible state assertions, e.g.: (a) new-patient intake — navigate, type given/family name fields, save, assert the patient appears; (b) patient record edit or clinical sub-tab navigation with distinct visible state; (c) appointment or lab/incident workflow — create and assert its visible presence. Hover where meaningful; measure scrollability and include scroll only if a surface actually scrolls (record truthful omission otherwise, per the papercups precedent). Watch the i18n default locale — assert the strings the app actually renders.
2. Service-worker non-masking, and this app REGISTERS its SW (`src/index.tsx` calls serviceWorker.register()): run browser contexts with Playwright's `serviceWorkers: 'block'` (or the repo's equivalent idiom) so no result can be cache-masked, AND record truthfully in the receipt that the baseline emits+registers a service worker which the target does not — this is a real migration behavioral difference that must be visible, not smoothed over. Zero SW lifecycle events in measured runs; CacheStorage checks per the papercups checkpoints.
3. Baseline 2/2 + migrated 2/2 production-static passes through local link:../witness; zero successful non-loopback; semantic byte-mutation on the migrated bundle (visible string → journey red → byte-identical restore → green rerun).
4. Core witness receipt schema `packages/core/src/receipts/witness-react-hospitalrun.ts` per the papercups schema idiom, barrel-exported; canonical receipts at `evidence/runs/witness-react-hospitalrun/receipt.{json,md}` + artifacts under `evidence/runs/react-hospitalrun/`; redacted, unknowns preserved, self-limiting language; the receipt declares `counted: false` pending Judge audit (papercups precedent).
5. Tests per idiom; whole repo gate green. DO NOT touch aggregate.json, conformance, or trust — that is the next unit.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/witness-react-hospitalrun.ts`
- `packages/core/src/receipts/witness-real-app.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `evidence/runs/react-hospitalrun/**`
- `evidence/runs/witness-react-hospitalrun/**`
- `fixtures/react-hospitalrun/**`

## Forbidden moves

- No other packages/core changes; no packages/frameworks/**, packages/trust/**, evidence/runs/aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/\*\*.
- No fabricated or hand-edited evidence; a red journey is a truthful red; no page-load-only journeys; no SW/cache masking; no app names in reusable surfaces.
- No network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/witness-react-hospitalrun/receipt.json evidence/runs/witness-react-hospitalrun/receipt.md'
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
```

## Blocked permission

If a journey cannot pass truthfully (exact assertion + browser state), PouchDB local persistence doesn't actually work in the production-static build (report what fails), builds cannot rematerialize offline, or the SW non-masking approach conflicts with the repo idiom, return status "blocked" with specifics in open_questions instead of improvising. Partial honest progress with a clear cut line is legitimate.
