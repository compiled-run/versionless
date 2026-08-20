Fable-Opus-Unit: lrapr-t004/t004-d7-papercups-aggregate-transition
Fable-Opus-Timeout-Minutes: 35

## Goal

Execute the papercups aggregate state transition in /Users/jacksm5pro/dev/open-source/versionless as ONE coherent change. Prior units left everything staged for this: the receipts and conformance kind exist (commit ac09953), the derived append tool exists (`packages/cli/src/fixture/react-papercups-aggregate-append.ts`, commit 4602435), and a prior unit measured the exact blast radius. PM rulings baked in:

1. `packages/core/src/corpus/conformance.ts`: `analyzeCorpusConformance` must EMIT the papercups vertical row into `conformance.verticals` and the papercups source application into `conformance.applications`, derived from the aggregate members and canonical receipts (never hardcoded values) — so summary counts (12/5) and listed rows agree, and the trust matrix cell derives from conformance rather than being forced.
2. `packages/trust/src/generate.ts` + `verify.ts`: teach the pipeline the `react-papercups-browser-proof` kind — papercups receipt pair joins the trust receipt set, matrix gains the papercups cell derived from the conformance row; the new kind pins its own exact receipt count (20 post-append per the prior unit's measurement — verify against reality) and cell count; existing kinds' assertions untouched, nothing loosened.
3. Run the append tool for real so `evidence/runs/aggregate.json` gains the two papercups members and `deriveCorpusTransactionState` yields `react-papercups-browser-proof`.
4. Repoint the tests that pin the pre-append state to the exact post-append values (pins move, never loosen): `packages/core/test/witness-react-papercups.test.ts` (5 — note the one that re-appends against the live aggregate must use a pre-append staged copy so it still derives 18), `packages/core/test/corpus-conformance.test.ts` (3), `packages/cli/test/angular-realworld-v15-to-v16-integrate.test.ts` (16→18 fixtures), `packages/cli/test/corpus-conformance.test.ts` (11/4→12/5). Add positive coverage for the emitted papercups conformance rows.
5. Regenerate `evidence/trust/current` via the canonical offline command. Report exactly which counts moved and the receipt-backed justification (expect: verticals 11→12, source apps 4→5, trust receipts 16→20-ish per reality, React-lineage readiness gaining the papercups cell if and only if derivation produces it).
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

- No other packages/core/src changes; no packages/frameworks/**, packages/cli/src/witness/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/**.
- Nothing loosened: every repointed pin asserts the new exact value; conformance rows derive from receipts; no hand-edited evidence; no forced matrix cells.
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

If any count cannot derive from receipts, any pin would have to loosen rather than move, or the transition surfaces yet another closed enumeration outside this contract, return status "blocked" with specifics in open_questions instead of improvising.
