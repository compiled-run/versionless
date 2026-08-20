Fable-Opus-Unit: lrapr-t006/u24b-super-productivity-transition
Fable-Opus-Timeout-Minutes: 35

## Goal

Execute the super-productivity aggregate/conformance/trust transition in /Users/jacksm5pro/dev/open-source/versionless as ONE coherent change — the final portfolio cell into the matrix (u24 reconnaissance + u24a's just-landed tiny-translator transition are the template; commit `3d6a146`). Witness receipt at `evidence/runs/witness-angular-super-productivity-v2-13-15/` (digest 5d8ed797, single-member sealing its build receipts).

Turnkey map (from u24 reconnaissance):

- **Predecessor state**: `angular-tiny-translator-browser-proof` (current tip via `deriveCorpusTransactionState`). New kind: `angular-super-productivity-browser-proof`.
- **Append fixture** `packages/cli/src/fixture/angular-super-productivity-aggregate-append.ts`: mirror `angular-tiny-translator-aggregate-append.ts` (u24a's, the freshest template) — single Witness member = `witnessAngularSuperProductivityAggregateMember(verifyWitnessAngularSuperProductivityEvidence().digest)`, digest 5d8ed797; refuse anything but the exact predecessor OR already-appended kind; atomic `.t006b.tmp` staging. Run `--append` for real.
- **conformance rows**: adapt to super-productivity's REAL fields (distinct from tiny-translator) — `receipt.scroll` (union WitnessScrollSurface|WitnessMeasuredScrollAbsence), `receipt.serviceWorker` (the constant object, real registration — NOT serviceWorkerAttempt), `receipt.persistence` (localforage/IndexedDB), `receipt.determinism`, `receipt.readiness.angularLineage{ready:1,total:4,counted:false}`, plus the per-lane declared differences (typeface, theme rgb, pre-MDC/MDC geometry) recorded as the vertical's declared-differences.
- **trust**: `ANGULAR_SUPER_PRODUCTIVITY_TRUST_RECEIPTS=27`, `_MATRIX_CELLS=25`; wire dispatch + flag + receipts[] + matrix-cell disjunction arm + verify cell block + generate matrix-cell block + render flag + prose (angularLineage stays 2/4, visible-but-uncounted).
- **MEASURED targets**: 27 receipts / 20 verticals / 12 apps / 25 matrix cells, resolvedDependencies 40 (pin what reality yields, report if different).
- **Include the per-cell append test** `packages/cli/test/angular-super-productivity-aggregate-append.test.ts` (u24a skipped its equivalent as a coverage note — land it here: predecessor-guard, wrong-kind refusal, idempotent re-append against a staged pre-append copy).
- **Order**: (1) all source, (2) tsc/lint, (3) --append for real, (4) vp pack, (5) trust:generate, (6) 7-gate, (7) move pins to measured values across the test files + both integrate fixtures' known-kind allowlists (do NOT forget the integrate allowlists — that was u24a's stall point).

super-productivity revision `2943c5c4…` passes the existing generic admission — no payment-signals change, no scan trip (a trip is blocked, not worked around).

## File contract

- `packages/core/src/corpus/conformance.ts`
- `packages/core/test/**`
- `packages/trust/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `evidence/runs/aggregate.json`
- `evidence/trust/current/**`

## Forbidden moves

- No other packages/core/src changes (incl. payment-signals.ts); no packages/frameworks/**, packages/cli/src/witness/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/**.
- Nothing loosened; rows derive from receipts; no hand-edited evidence; no forced cells; counted flags untouched. No network. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage.

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

If any count cannot derive, any pin would loosen, a scan trips, or a closed enumeration outside the contract surfaces, return status "blocked" with specifics in open_questions instead of improvising.
