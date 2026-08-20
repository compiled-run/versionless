Fable-Opus-Unit: lrapr-t006/u12c-memos-witness-publish
Fable-Opus-Timeout-Minutes: 35

## Goal

Browser-prove the memos vertical in /Users/jacksm5pro/dev/open-source/versionless — witness-only, the final piece of T006's React trio. Commit `c539dcf` era: lanes committed (`fcb7838`), frozen projection with the AMENDED seed committed (`packages/cli/src/witness/memos-projection.ts`, behavior digest `b17da56bba70249f1d3b25b2837083b80ba0ae8c1c2899f710fc1eaf9b059902`, owner pair `owner@evidence.invalid` / `synthetic-pass` proven to pass the pinned Signin validator); staged lanes at `.versionless/work/react-memos-v0-1-3/{baseline/dist-run1,target/dist-vite-run1}`; u12's verified selector map: `.btn.delete-btn` two-click confirm → ARCHIVED, `.memo-trash-dialog .restore-btn`, `.search-bar-container .text-input`, `.tag-item-container`, `.username-label input` + `.confirm-btn`.

Deliver (the u12b packet's witness half, unchanged):

1. memos in `WITNESS_REAL_APP_NAMES` (framework 'react') + journey in `real-app-run.ts` + dedicated runner `packages/cli/src/witness/react-memos-run.ts` wiring the frozen projection as same-origin transport (papercups d4 idiom), asserting the projection behavior digest equals the frozen `b17da56b…`.
2. Journeys on BOTH lanes behind the real session flow (app's own Signin form with the amended credentials): (a) compose + save memo (typed content → renders in list → ledger create); (b) typed search narrowing + tag filter with restore, asserting NO request fired; (c) archive two-click → removal → restore via trash dialog → return; (d) settings account change → PATCH /api/user/me in the ledger; hover where meaningful; measured scroll or absence; route sequence pinned per the two-route router.
3. Rendered-style probes across lanes; exact inventories; zero successful non-loopback; projection ledger published.
4. Baseline 2/2 + migrated 2/2; semantic byte-mutation red → byte-identical restore → green.
5. Core schema `packages/core/src/receipts/witness-react-memos.ts`, barrel-exported; canonical receipts `evidence/runs/witness-react-memos-v0-1-3/receipt.{json,md}` + artifacts under `evidence/runs/react-memos-v0-1-3/`; `counted: false`; era tsc-gate deviation carried in build-lane references; the seed-amendment record referenced.
6. Tests per idiom; whole repo gate green. DO NOT touch aggregate/conformance/trust; DO NOT change the projection or its digests.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/witness-react-memos.ts`
- `packages/core/src/receipts/witness-real-app.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `evidence/runs/react-memos-v0-1-3/**`
- `evidence/runs/witness-react-memos-v0-1-3/**`
- `fixtures/react-memos-v0-1-3/**`

## Forbidden moves

- No other packages/core changes; no packages/frameworks/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/\*\*.
- The projection and both frozen digests must not change (new-behavior needs = blocked); synthetic data only; no fabricated evidence; truthful reds; inventories exact.
- No network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/witness-react-memos-v0-1-3/receipt.json evidence/runs/witness-react-memos-v0-1-3/receipt.md'
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
```

## Blocked permission

If a journey cannot pass truthfully, the frozen projection lacks genuinely-needed behavior (name it), a closed enumeration outside the contract blocks receipts, or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
