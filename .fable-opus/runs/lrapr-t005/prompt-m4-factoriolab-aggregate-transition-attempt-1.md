Fable-Opus-Unit: lrapr-t005/m4-factoriolab-aggregate-transition
Fable-Opus-Timeout-Minutes: 35

## Goal

Execute the factoriolab aggregate state transition in /Users/jacksm5pro/dev/open-source/versionless as ONE coherent change, following the HospitalRun h4b pattern exactly (commit `b6ad5cf` is the template transition; commit `8b01d0b` landed the factoriolab witness vertical with canonical receipts at `evidence/runs/witness-angular-factoriolab/receipt.{json,md}`). This is the first ANGULAR entry into the aggregate — expect and record the lineage difference honestly (framework `'angular'`, first angular-lineage matrix cell).

1. Derived append tool for factoriolab per the established idiom (`packages/cli/src/fixture/react-hospitalrun-aggregate-append.ts` is the template): appends the factoriolab members to `evidence/runs/aggregate.json`, derived from the canonical receipts, never hardcoded.
2. `packages/core/src/corpus/conformance.ts`: emit the factoriolab vertical row and source application, derived from aggregate members + canonical receipts, keeping the row/summary agreement invariant. New kind per the established naming shape (`angular-factoriolab-browser-proof` or the repo's exact idiom — follow it).
3. `packages/trust/src/generate.ts` + `verify.ts`: teach the pipeline the new kind; matrix gains the cell derived from the conformance row; the new kind pins its own exact receipt and cell counts MEASURED against reality after the append; existing kinds' assertions untouched, nothing loosened. Note: the payment-signals revision admission from h4b is already generic for corpus provenance revision keys — factoriolab's revision `5f54abbdcac518d8ebf7e136c4348384d9b1a2bb` should pass through it; if any NEW sensitive-scan finding trips, that is a blocked-worthy discovery, never an in-contract workaround.
4. Run the append for real; move every pre-append pin to the exact measured post-append value (pins move, never loosen) across the d7/h4b change surface (papercups/hospitalrun staged-copy re-append tests, corpus-conformance counts, fixture counts).
5. Angular-lineage readiness stays honest: the factoriolab receipt declares `counted: false` pending Judge — cells appear only if derivation produces them, never forced. Report exactly which counts moved with receipt-backed justification.
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

- No other packages/core/src changes (incl. payment-signals.ts — a new sensitive-scan trip is blocked, not worked around); no packages/frameworks/**, packages/cli/src/witness/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/**.
- Nothing loosened: every repointed pin asserts the new exact measured value; conformance rows derive from receipts; no hand-edited evidence; no forced matrix cells; no app names in reusable surfaces beyond the closed-list idiom.
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

If any count cannot derive from receipts, any pin would have to loosen rather than move, a sensitive-scan finding trips outside the contract, or the transition surfaces a closed enumeration outside this contract, return status "blocked" with specifics in open_questions instead of improvising.
