Fable-Opus-Unit: lrapr-t006/u12-memos-witness
Fable-Opus-Timeout-Minutes: 35

## Goal

Browser-prove the memos vertical in /Users/jacksm5pro/dev/open-source/versionless — the old-Vite witness cell, completing T006's React witness trio. Commit `a58b591` era: both lanes committed (`fcb7838`), frozen API projection landed (`packages/cli/src/witness/memos-projection.ts`, behavior digest 1672b43f, 18 endpoints, synthetic seed at `fixtures/react-memos-v0-1-3/witness-projection-seed.json`); enumeration facts in `evidence/runs/react-memos-v0-1-3/t006-api-surface.json` (session gate = GET /api/user/me; search/tag/type filters are client-side over the fetched list; editor prefs are localStorage-only).

Deliver:

1. memos in `WITNESS_REAL_APP_NAMES` (closed-list idiom, framework 'react') + journey in `real-app-run.ts` + dedicated runner wiring the frozen projection as the same-origin transport (papercups d4 idiom).
2. Journeys on BOTH lanes, driving the app's real session flow first (projection signup/login → session): (a) compose + save a memo with typed content, assert it renders in the list and the projection ledger recorded the create; (b) search narrowing via typed input + tag filter (client-side — assert visible narrowing and restore, no request expected: assert THAT too, it proves the client-side fact); (c) archive a memo → assert removal from the list → restore via the archive dialog → assert return (the projection's organizer/patch surface); (d) settings dialog account change through PATCH /api/user/me with the ledger assertion; hover where meaningful; measured scroll or absence per surface (dialog-driven app, two routes — route sequence pinned accordingly).
3. Rendered-style probes across lanes (less+tailwind under Vite 2 vs Vite 8 is the style arbitration here); exact inventories; zero successful non-loopback; the projection ledger published per idiom with its behavior digest asserted against the frozen 1672b43f.
4. Baseline 2/2 + migrated 2/2; semantic byte-mutation (visible string → red → byte-identical restore → green).
5. Core schema `packages/core/src/receipts/witness-react-memos.ts` per idiom, barrel-exported; canonical receipts `evidence/runs/witness-react-memos-v0-1-3/receipt.{json,md}` + artifacts under `evidence/runs/react-memos-v0-1-3/`; redacted, unknowns preserved, `counted: false` pending Judge; the era tsc-gate deviation carried in the receipt's build-lane references.
6. Tests per idiom; whole repo gate green. DO NOT touch aggregate/conformance/trust.

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
- The frozen projection digest must not change (a journey needing new projection behavior is blocked, not a drift); synthetic data only; no fabricated evidence; truthful reds; inventories exact.
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

If a journey cannot pass truthfully, the frozen projection lacks behavior a journey genuinely needs (name it — that is an escalation, not a drift license), a closed enumeration outside the contract blocks receipts, or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
