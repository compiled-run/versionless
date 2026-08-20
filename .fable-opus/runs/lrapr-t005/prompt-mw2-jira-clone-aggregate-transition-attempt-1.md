Fable-Opus-Unit: lrapr-t005/mw2-jira-clone-aggregate-transition
Fable-Opus-Timeout-Minutes: 35

## Goal

Execute the jira-clone aggregate state transition in /Users/jacksm5pro/dev/open-source/versionless as ONE coherent change — the fourth application of the established pattern (h4b for HospitalRun `b6ad5cf`, m4 for factoriolab `9228514` are the templates; commit `5ef2306` landed the jira-clone witness vertical, receipt digest 4642564e, canonical receipts at `evidence/runs/witness-angular-jira-clone/receipt.{json,md}`). Angular-lineage precedent: factoriolab entered as ONE member with build receipts sealed inside the witness receipt — jira-clone follows that same single-member idiom (its four mj3c build receipts are bound by digest inside the witness receipt).

1. Derived append tool `packages/cli/src/fixture/angular-jira-clone-aggregate-append.ts` per the factoriolab template; run the append for real.
2. `packages/core/src/corpus/conformance.ts`: derived vertical row + source application; new kind per the factoriolab naming idiom (`angular-jira-clone-browser-proof` or the repo's exact shape).
3. `packages/trust/src/generate.ts` + `verify.ts`: new kind wired; matrix cell derived from the conformance row; counts MEASURED post-append (expect roughly 21→22 receipts, 14→15 verticals, 7→8 apps, 19→20 cells — but pin what reality yields and report if it disagrees); existing kinds untouched, nothing loosened. jira-clone's revision `059455b9933a236456524925065bce2c295e2d9a` — if any sensitive-scan finding trips, that is blocked, never an in-contract workaround.
4. Move every pre-append pin to exact measured values across the established change surface (papercups/hospitalrun/factoriolab staged-copy re-append tests, corpus-conformance counts, fixture closed lists).
5. Angular-lineage readiness stays honest: counted:false pending Judge; report exactly which counts moved with receipt-backed justification.
6. Whole repo gate green.

## File contract

- `packages/core/src/corpus/conformance.ts`
- `packages/core/test/**`
- `packages/trust/src/**`
- `packages/trust/test/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `evidence/runs/aggregate.json`
- `evidence/trust/current/**`

## Forbidden moves

- No other packages/core/src changes (incl. payment-signals.ts — a new scan trip is blocked); no packages/frameworks/**, packages/cli/src/witness/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/**.
- Nothing loosened: every repointed pin asserts the new exact measured value; rows derive from receipts; no hand-edited evidence; no forced cells.
- No network. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp pack
pnpm exec vp test --project node
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run corpus:verify
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run trust:verify
```

## Blocked permission

If any count cannot derive from receipts, any pin would have to loosen, a sensitive-scan finding trips, or a closed enumeration outside this contract surfaces, return status "blocked" with specifics in open_questions instead of improvising.
