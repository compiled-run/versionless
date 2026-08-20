Fable-Opus-Unit: lrapr-t004/t004-d6-papercups-trust-aggregate
Fable-Opus-Timeout-Minutes: 35

## Goal

Land the final step of the papercups v1.0.0 vertical in /Users/jacksm5pro/dev/open-source/versionless: aggregate membership plus trust-pipeline awareness. Everything else is committed at ac09953. PM rulings baked in:

1. `packages/trust/src/generate.ts` and `packages/trust/src/verify.ts` (allowance granted): teach the trust pipeline the `react-papercups-browser-proof` transaction kind — the papercups receipt pair (canonical run receipt + witness receipt) joins the trust receipt set, and the matrix gains the papercups cell. STRENGTHENING ONLY: the new kind must pin its own exact receipt count and matrix-cell count at least as strictly as `react-zero-sw-reconciliation` pins the current 18/… — the existing kind's assertions stay untouched. Counts must derive from receipts, never forced.
2. `packages/core/src/index.ts` (allowance granted): add the barrel export for the witness-react-papercups schema module.
3. Append the two papercups members to `evidence/runs/aggregate.json` via the existing appendAggregate flow (no hand edits) so `deriveCorpusTransactionState` yields `react-papercups-browser-proof` (12 verticals / 5 source applications / 18 receipts).
4. Regenerate `evidence/trust/current` via the canonical offline command (`VERSIONLESS_NETWORK_MODE=offline NPM_CONFIG_OFFLINE=true pnpm run trust:generate -- --offline --policy trust/policy.json --output evidence/trust/current`). Counts move only as receipts justify — expect the React-lineage readiness distribution to reflect the papercups cell only if the canonical derivation produces it; report exactly what moved and why.
5. Tests for the new trust kind (positive + at least one negative asserting a wrong receipt count fails); whole repo gate green.

## File contract

- `packages/trust/src/**`
- `packages/trust/test/**`
- `packages/core/src/index.ts`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `evidence/runs/aggregate.json`
- `evidence/trust/current/**`

## Forbidden moves

- No changes to packages/core/** beyond the single barrel-export line; no packages/frameworks/**, evidence/ingests/**, evidence/runs/** dirs other than aggregate.json, scripts/**, docs/**.
- No loosened assertion anywhere; no hand-edited evidence or forced counts.
- No network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

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

If the trust extension cannot be written without loosening an existing assertion, if regeneration moves counts receipts do not justify, or if the aggregate append surfaces any further closed enumeration, return status "blocked" with specifics in open_questions instead of improvising.
