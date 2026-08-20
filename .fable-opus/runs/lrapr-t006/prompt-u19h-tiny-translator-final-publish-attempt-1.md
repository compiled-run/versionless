Fable-Opus-Unit: lrapr-t006/u19h-tiny-translator-final-publish
Fable-Opus-Timeout-Minutes: 35

## Goal

Finish and publish the tiny-translator witness vertical in /Users/jacksm5pro/dev/open-source/versionless (commit `a686882`). The remaining scope is small and precisely known from u19g's measurements:

1. **Journey corrections from measurement**: the post-mark assertion is already corrected to the measured filter semantics (`33 % translated`, view advances, unit leaves the Untranslated filter); MEASURE the reviewer half the same way — `mark as reviewed` requires reviewMode + the unit re-selected through the `Review needed` filter — and correct its assertions to what the app actually does (one calibration pass per lane if needed).
2. **Core schema amendments** (each recorded per the mw1e precedent): `observerFinalization.workerEvents`, the `refusedServiceWorker` shape, the recorded-amendment list, and the core receipt test updates u19g named.
3. **Publish**: baseline 2/2 + migrated 2/2; mutation red → byte-identical restore → green (seam pinned at dist-11 offset 1055648, re-verified); canonical receipts at `evidence/runs/witness-angular-tiny-translator-v0-12-0/receipt.{json,md}` + artifacts under `evidence/runs/angular-tiny-translator-v0-12-0/`; the FileReader parity arbitration outcome stated explicitly; readiness tallies confirmed against the aggregate; `counted: false`.
4. Whole repo gate green.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/witness-angular-tiny-translator.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `evidence/runs/angular-tiny-translator-v0-12-0/**`
- `evidence/runs/witness-angular-tiny-translator-v0-12-0/**`
- `fixtures/angular-tiny-translator-v0-12-0/**`

## Forbidden moves

- No other packages/core changes; no packages/frameworks/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/\*\*.
- Schema amendments only where measurement contradicts, recorded; no fabricated evidence; truthful reds; inventories exact. No network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/witness-angular-tiny-translator-v0-12-0/receipt.json evidence/runs/witness-angular-tiny-translator-v0-12-0/receipt.md'
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
```

## Blocked permission

If the reviewer half reveals a real behavioral break (RED evidence — record it first), publishing is nondeterministic (bring the measured runs), or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
