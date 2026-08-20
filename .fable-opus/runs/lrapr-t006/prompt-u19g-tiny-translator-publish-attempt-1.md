Fable-Opus-Unit: lrapr-t006/u19g-tiny-translator-publish
Fable-Opus-Timeout-Minutes: 35

## Goal

Calibrate and publish the tiny-translator witness vertical in /Users/jacksm5pro/dev/open-source/versionless — the final unit of this cell (commit `eaa0e7f`: migrated lane MOUNTS at dist-11, schema re-pinned to the u19f build record, era SW-attempt schema-bound, journey/runner/mechanisms all landed).

1. Calibration passes (one per lane under the Witness harness): pin the measured per-lane console-error inventories (era: the SW-attempt's expected entries; migrated: whatever reality shows under the answered font seam), `TINY_TRANSLATOR_JOURNEY_NAVIGATIONS`, scroll absence, and the Material 5-vs-16 selector viability from u19c's list. Correct journey constants/selectors to measured reality; schema amendments only where measurement contradicts a pin (each recorded — the mw1e precedent).
2. Publish: baseline 2/2 + migrated 2/2; mutation red → byte-identical restore → green (seam verified against dist-11's actual bytes — the u19c seam was chosen against an older dist; re-verify uniqueness); canonical receipts at `evidence/runs/witness-angular-tiny-translator-v0-12-0/receipt.{json,md}` + artifacts under `evidence/runs/angular-tiny-translator-v0-12-0/`; the migrated font seam's exact member pinned from measured runs; the FileReader parity arbitration outcome stated explicitly (a real break is RED evidence first); readiness tallies confirmed against the aggregate; `counted: false`.
3. Tests updated for calibrated facts; whole repo gate green.

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
- Schema amendments only where measurement contradicts, recorded; no fabricated evidence; truthful reds; inventories exact; key.pem nowhere. No network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/witness-angular-tiny-translator-v0-12-0/receipt.json evidence/runs/witness-angular-tiny-translator-v0-12-0/receipt.md'
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
```

## Blocked permission

If a journey cannot pass truthfully (a real behavioral break is RED evidence — record it first), publishing is nondeterministic (bring the measured runs), or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
