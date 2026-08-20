Fable-Opus-Unit: lrapr-t006/u10-linkfree-witness
Fable-Opus-Timeout-Minutes: 35

## Goal

Browser-prove the LinkFree vertical in /Users/jacksm5pro/dev/open-source/versionless — the first CRA 5 witness cell, under the standing SYNTHETIC-CORPUS ruling. Both lanes are committed and deterministic (commit `6d7672d`; regenerate offline via `packages/cli/src/fixture/react-linkfree-v0-72-0-vite8-run.ts`; caches under `.versionless/`).

STANDING RULING (absolute): real contributor profile data never renders into evidence. The app's `generate.js` is corpus-agnostic — the witness lanes build/serve with a fixture-scoped SYNTHETIC profile corpus (invented names/profiles under `fixtures/react-linkfree-v0-72-0/`, generated deterministically, clearly-fake values), run through the app's own generate.js pipeline. Both lanes use the SAME synthetic corpus so parity is apples-to-apples. Record in the receipt that the corpus is synthetic, why (the MIT-code-grant/personal-data ruling), and that journeys therefore prove the application's behavior, not its shipped dataset. The pinned archive's real data stays untouched in the caches; the aggregate-digest redaction discipline continues.

App facts (re-verify): multi-route react-router 5 (homepage list, /search, /:username profile, 404), PrimeReact 6 UI, avatar imgs resolve to GitHub URLs with a dicebear onerror cascade — BOTH hosts must be answered/blocked in-context (mocked-seam inventory, query-free), with the synthetic corpus pointing avatars at same-origin or mocked URLs as the honest cheap path (record which). Upstream cypress features (homepage, search, user, 404) are journey documentation only — never run cypress.

Deliver:

1. LinkFree in `WITNESS_REAL_APP_NAMES` (closed-list idiom, framework 'react') + journey in `real-app-run.ts` + dedicated runner.
2. Journeys on BOTH lanes: (a) homepage list renders the synthetic corpus with typed search narrowing and full-clear restore; (b) navigate to a synthetic user's profile (real react-router navigation — this cell HAS routes, assert the route sequence) and assert profile content + link list; (c) 404 route for a nonexistent user with its visible state; (d) hover where meaningful; measured scroll or absence per route.
3. Rendered-style probes across lanes; exact inventories (console, failed requests, cancelled-duplicate category if it fires); zero successful non-loopback.
4. Baseline 2/2 + migrated 2/2; semantic byte-mutation (visible string → red → byte-identical restore → green).
5. Core schema `packages/core/src/receipts/witness-react-linkfree.ts` per idiom, barrel-exported; canonical receipts `evidence/runs/witness-react-linkfree-v0-72-0/receipt.{json,md}` + artifacts under `evidence/runs/react-linkfree-v0-72-0/`; redacted (no real usernames anywhere — test-enforced), unknowns preserved, `counted: false` pending Judge.
6. Tests per idiom; whole repo gate green. DO NOT touch aggregate/conformance/trust.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/witness-react-linkfree.ts`
- `packages/core/src/receipts/witness-real-app.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `evidence/runs/react-linkfree-v0-72-0/**`
- `evidence/runs/witness-react-linkfree-v0-72-0/**`
- `fixtures/react-linkfree-v0-72-0/**`

## Forbidden moves

- No other packages/core changes; no packages/frameworks/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/\*\*.
- Real contributor data never renders, never appears in evidence, never in test fixtures — synthetic only, test-enforced.
- No fabricated evidence; truthful reds; inventories exact; no app names in reusable surfaces beyond closed lists.
- No network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/witness-react-linkfree-v0-72-0/receipt.json evidence/runs/witness-react-linkfree-v0-72-0/receipt.md'
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
```

## Blocked permission

If the synthetic corpus cannot flow through generate.js without app modifications (name the exact seam), a journey cannot pass truthfully, a closed enumeration outside the contract blocks receipts, or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
