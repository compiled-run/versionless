Fable-Opus-Unit: lrapr-t004-hospitalrun/h4-aggregate-trust-transition
Fable-Opus-Timeout-Minutes: 35

## Goal

Execute the HospitalRun aggregate state transition in /Users/jacksm5pro/dev/open-source/versionless as ONE coherent change, following the papercups d7 pattern exactly (commit `2b7d5ff` is the template transition; commit `a4b9325` landed the HospitalRun witness vertical with canonical receipts at `evidence/runs/witness-react-hospitalrun/receipt.{json,md}`, digest 275e435c…). Unlike d7, the papercups-era staging does not exist yet for HospitalRun — this unit builds it AND runs the transition:

1. Derived append tool for HospitalRun per the papercups idiom (`packages/cli/src/fixture/react-papercups-aggregate-append.ts` is the template): appends the two HospitalRun members to `evidence/runs/aggregate.json`, derived from the canonical receipts, never hardcoded.
2. `packages/core/src/corpus/conformance.ts`: `analyzeCorpusConformance` emits the HospitalRun vertical row and source application, derived from aggregate members + canonical receipts, keeping the row/summary agreement invariant d7 established. Introduce the `react-hospitalrun-browser-proof` kind (or the repo's established naming for a witness browser proof — follow the papercups kind's exact naming shape).
3. `packages/trust/src/generate.ts` + `verify.ts`: teach the pipeline the new kind — HospitalRun receipt pair joins the trust receipt set, matrix gains the cell derived from the conformance row; the new kind pins its own exact receipt and cell counts measured against reality after the append; existing kinds' assertions untouched, nothing loosened.
4. Run the append tool for real; `deriveCorpusTransactionState` must yield the new kind.
5. Move every pre-append pin to the exact post-append value (pins move, never loosen) across core/cli/trust tests, following the d7 change surface: the papercups witness tests' staged-copy pattern for re-append tests, corpus-conformance counts, fixture counts. Expect roughly aggregate 18→20, verticals 12→13, source apps 5→6, matrix cells 17→18, trust receipts +2 — but derive and pin the ACTUAL values reality produces; report exactly which counts moved with receipt-backed justification.
6. React-lineage readiness stays honest: the HospitalRun receipt declares `counted: false` pending Judge — the matrix cell may appear only if derivation produces it, never forced.
7. Whole repo gate green.

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

- No other packages/core/src changes; no packages/frameworks/**, packages/cli/src/witness/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/**.
- Nothing loosened: every repointed pin asserts the new exact value; conformance rows derive from receipts; no hand-edited evidence; no forced matrix cells; no app names in reusable product surfaces beyond the established closed-list idiom.
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

If any count cannot derive from receipts, any pin would have to loosen rather than move, the transition surfaces a closed enumeration outside this contract, or the papercups idiom genuinely does not transfer, return status "blocked" with specifics in open_questions instead of improvising.
