Fable-Opus-Unit: lrapr-t006/u19d-tiny-translator-calibrate-publish
Fable-Opus-Timeout-Minutes: 35

## Goal

Calibrate the tiny-translator journey and publish the canonical receipts in /Users/jacksm5pro/dev/open-source/versionless — the final unit of this witness vertical. Commit `8294e4b` era: journey/runner/schema/mechanisms all landed; u19c's four uncalibrated facts are the work: `TINY_TRANSLATOR_JOURNEY_NAVIGATIONS` (guessed 6), the per-lane console-error inventories (the in-context-answered gstatic woff2 in the migrated lane may make Chrome log a font-decode error — pin whatever reality shows, exactly, per lane), the scroll-absence measurement, and the Material 5-vs-16 selector viability (`mat-tooltip-component`, `mat-radio-button[value=…]`, `button:text-is(…)`).

1. Calibration passes (one per lane) to fix the four facts; correct the journey constants and selectors to measured reality (schema amendments only if a measured fact contradicts a schema pin — the mw1e precedent: amend exactly what measurement contradicts, recorded).
2. Publish: baseline 2/2 + migrated 2/2; mutation red → byte-identical restore → green; canonical receipts `evidence/runs/witness-angular-tiny-translator-v0-12-0/receipt.{json,md}` + artifacts under `evidence/runs/angular-tiny-translator-v0-12-0/`; the migrated font seam's exact member pinned from the measured runs (closing u19b's origin-pin note); readiness tallies confirmed against the aggregate at publish time; `counted: false`; the FileReader parity arbitration outcome stated explicitly (a real behavioral break is RED evidence, recorded first).
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
- Schema amendments only where measurement contradicts a pin, each recorded; no fabricated evidence; truthful reds; inventories exact; key.pem nowhere.
- No network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/witness-angular-tiny-translator-v0-12-0/receipt.json evidence/runs/witness-angular-tiny-translator-v0-12-0/receipt.md'
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
```

## Blocked permission

If a journey cannot pass truthfully (a real break across the eleven-major lift is RED evidence — record it first), publishing is nondeterministic (bring the measured runs), or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
