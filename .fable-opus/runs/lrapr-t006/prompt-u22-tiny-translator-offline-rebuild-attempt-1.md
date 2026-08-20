Fable-Opus-Unit: lrapr-t006/u22-tiny-translator-offline-rebuild
Fable-Opus-Timeout-Minutes: 35

## Goal

Rebuild the tiny-translator migrated lane offline-faithful and republish its witness receipt in /Users/jacksm5pro/dev/open-source/versionless (commit `aba822f`; locality finding at `evidence/runs/angular-tiny-translator-v0-12-0/u21-font-inline-locality.json`: dist-13 inlined Material Icons v145 fetched from Google at build time; the font-inlining-disable capability is landed).

1. Apply the font-inlining-disable capability to the stage workspace; rebuild ×2. Expect the migrated index.html to now carry the era-faithful runtime font link instead of inlined CSS — verify NO network egress occurs during the build (the proof the capability exists for: build under the offline mode and confirm green — a build that needs the fetch fails offline). Deterministic ×2.
2. New superseding build record (dist-13 chain extended; originals immutable); schema re-pins (canonical roots, seam categories — the migrated lane's font seam RETURNS to the era shape: the runtime googleapis CSS link, blocked at witness time exactly like the baseline; the fontSeamDifference record updates to the measured post-fix reality; the mat-icon degradation assertions re-measured — both lanes should now degrade identically, record what reality shows).
3. Re-run the witness publish against the rebuilt lane: baseline 2/2 + migrated 2/2, mutation red → byte-identical restore → green (re-verify the seam against the new dist), canonical receipts REPUBLISHED at `evidence/runs/witness-angular-tiny-translator-v0-12-0/receipt.{json,md}` superseding receipt 0812a963 by reference in the lane chain (the receipt's story gains the locality finding + the offline-faithful rebuild as its final chapter).
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

- Originals immutable (supersede chains only); no other packages/core changes; no packages/frameworks/** (the capability is landed — if it fails on this workspace that is blocked, not an inline fix); no packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/\*\*.
- No fabricated evidence; truthful reds; inventories exact. NO network (that is the point). Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/witness-angular-tiny-translator-v0-12-0/receipt.json evidence/runs/witness-angular-tiny-translator-v0-12-0/receipt.md'
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
```

## Blocked permission

If the capability fails on this workspace (bring the reading), the offline build goes red for a NEW reason (bring it), a journey regresses against the rebuilt lane (RED first), or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
