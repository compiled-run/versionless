Fable-Opus-Unit: lrapr-t004-hospitalrun/h3d-witness-journeys
Fable-Opus-Timeout-Minutes: 35

## Goal

Browser-prove the HospitalRun vertical in /Users/jacksm5pro/dev/open-source/versionless. Both lanes boot deterministically (commit 9ed9985; work trees under `.versionless/work/react-hospitalrun/`; rebuild offline via the fixture flow if missing). A prior probe (unit h3-witness-vertical receipt) established the journey surface; papercups (real-app-run.ts, react-papercups-run.ts, witness-react-papercups schema) is the template.

Deliver:

1. HospitalRun in `WITNESS_REAL_APP_NAMES` (narrow core allowance) and its journey in `packages/cli/src/witness/real-app-run.ts`. Browser-local PouchDB — no stubs. Journeys per the probe: (a) new-patient intake — `#givenNameTextInput`/`#familyNameTextInput`, save, assert success toast and the patient row on `/patients`; (b) clinical navigation — patient record sub-tabs and `/labs`, `/incidents`, `/imaging` with their distinct visible headers; (c) appointment workflow on `/appointments` including REAL scroll (probe measured scrollHeight 1028 vs clientHeight 720 there; every other route is 720/720 — assert scroll effect truthfully). Hover where meaningful. i18n resolves to `en` — assert the English strings the app renders.
2. SW non-masking with a pinned console-error inventory (PM ruling): run contexts with Playwright `serviceWorkers: 'block'` (or repo-equivalent); the baseline's own `serviceWorker.register()` then emits exactly 2 known console errors per load — extend the witness clean-page mechanism with an app-scoped EXACT expected-console-error inventory (exact messages, exact counts, recorded in the receipt); any error outside the inventory still fails. The target build emits/registers no SW and its console must be fully silent. The baseline-registers/target-does-not difference is recorded as a real behavioral migration difference. CacheStorage/lifecycle checkpoints per the papercups idiom.
3. Baseline 2/2 + migrated 2/2 through local link:../witness; zero successful non-loopback; semantic byte-mutation on the migrated bundle (visible string → journey red → byte-identical restore → green rerun).
4. Core schema `packages/core/src/receipts/witness-react-hospitalrun.ts` per the papercups idiom, barrel-exported; canonical receipts at `evidence/runs/witness-react-hospitalrun/receipt.{json,md}` + artifacts under `evidence/runs/react-hospitalrun/`; redacted, unknowns preserved, self-limiting, `counted: false` pending Judge.
5. Tests per idiom; whole repo gate green. DO NOT touch aggregate.json, conformance, or trust — next unit.

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

- No other packages/core changes; no packages/frameworks/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/\*\*.
- No fabricated evidence; truthful reds; no page-load-only journeys; the console inventory is exact, never a blanket allowance; no app names in reusable surfaces.
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

If evidence is missing, the contract conflicts with reality, or you need a file outside the contract, return status "blocked" with the question in open_questions instead of improvising.

## Previous attempt failed

The previous attempt was stopped by the cockpit before it finished: VSCode crash killed the host session mid-unit; worker died with no receipt, no verify run. Partial writes remain uncommitted in the working tree.
No receipt was validated and no verify command ran for that attempt. Work in smaller steps and report honestly.
Fix the problem and complete the task.
