Fable-Opus-Unit: lrapr-t006/u12b-memos-seed-and-witness
Fable-Opus-Timeout-Minutes: 35

## Goal

Amend the memos projection seed under explicit PM authority, re-freeze it, and browser-prove the memos vertical in /Users/jacksm5pro/dev/open-source/versionless — completing T006's React witness trio. Commit `a58b591` era. u12's zero-write escalation established: the pinned Signin.tsx validates email AND password with `{minLength 4, maxLength 24, noSpace, noChinese}` BEFORE calling api.login; the frozen seed's owner pair (34-char email, 26-char password) is client-refused, signup is closed (seed holds an OWNER so /api/status reports one), profile.mode 'prod' disables the dev prefill, and every required journey sits behind the `GET /api/user/me` gate.

PM RULING (baked in): the seed amendment is AUTHORIZED — the freeze exists to prevent journey-driven drift, not to enshrine a seed the pinned app's own validator rejects. Amend to validator-passing, clearly-fake credentials (e.g. email `owner@evidence.invalid` 22 chars, password `synthetic-pass` 14 chars — final values yours, must pass the exact validator config and stay obviously synthetic). Update the TS seed + `fixtures/react-memos-v0-1-3/witness-projection-seed.json` + the frozen behavior digest constant + the `projection` block of `evidence/runs/react-memos-v0-1-3/t006-api-surface.json` + u11's pinned tests, recording IN the evidence and receipt that the digest moved from 1672b43f under this ruling and why. Nothing else about the projection's behavior changes — the amendment is credentials only; assert that by keeping every non-auth transcript check byte-identical where the data allows.

Then the witness (u12's own verified groundwork): journeys on BOTH lanes behind the real session flow (login via the app's own form with the amended credentials):
(a) compose + save a memo with typed content → renders in list → projection ledger recorded the create;
(b) typed search narrowing + tag filter with restore, asserting NO request fired (the client-side fact);
(c) archive via `.btn.delete-btn` two-click confirm → removal asserted → restore via `.memo-trash-dialog .restore-btn` → return asserted;
(d) settings account change via `.username-label input` + `.confirm-btn` → `PATCH /api/user/me` in the ledger;
hover where meaningful; measured scroll or absence; route sequence pinned (/signin → home per the two-route router).

Plus: rendered-style probes across lanes (less+tailwind arbitration); exact inventories; zero successful non-loopback; projection ledger published with the NEW frozen digest asserted; baseline 2/2 + migrated 2/2; semantic byte-mutation red → byte-identical restore → green; core schema `packages/core/src/receipts/witness-react-memos.ts` barrel-exported; canonical receipts `evidence/runs/witness-react-memos-v0-1-3/receipt.{json,md}` + artifacts; `counted: false`; era tsc-gate deviation carried in build-lane references; tests per idiom; whole repo gate green. DO NOT touch aggregate/conformance/trust.

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
- The seed change is credentials-only under the recorded ruling; any OTHER projection behavior change is blocked, not drifted; synthetic data only; no fabricated evidence; truthful reds; inventories exact.
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

If the amended credentials still cannot open the gate through the app's own flow, a journey cannot pass truthfully, a non-credential projection change proves necessary (name it), a closed enumeration outside the contract blocks receipts, or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
