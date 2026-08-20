Fable-Opus-Unit: lrapr-t006/u19k-tiny-translator-publish-close
Fable-Opus-Timeout-Minutes: 35

## Goal

Publish the tiny-translator witness vertical in /Users/jacksm5pro/dev/open-source/versionless — the closing unit; every prerequisite is landed (commit `6ed3c7d`: lane repaired at dist-13/dist-14, discriminator flipped, journey fully calibrated except one assertion). The remaining list, exactly:

1. Superseding build record over u19f (immutable chain preserved) with `dist-13` as the new canonical migrated root; `ANGULAR_TINY_TRANSLATOR_CANONICAL_RECEIPTS` / spec bindings re-pinned; the CVA repair recorded in the build story (1 workspace file, capability-driven).
2. The `All units` 3-vs-2 baseline divergence: one stage-labelled probe pass, correct the assertion to measured reality on BOTH lanes.
3. The deferred core schema amendments (recorded-amendment list + receipt test updates that travel with observerFinalization.workerEvents / refusedServiceWorker, already landed).
4. Publish: baseline 2/2 + migrated 2/2; mutation red → byte-identical restore → green (seam re-verified against dist-13); canonical receipts at `evidence/runs/witness-angular-tiny-translator-v0-12-0/receipt.{json,md}` + artifacts; the FileReader arbitration outcome stated; **the receipt carries the cell's full story**: the two boot regressions found and repaired (process global, $localize), the silent-data-loss finding → mechanical root cause (app-latent, both rivals refuted) → vendor-switch repair → discriminator flip; readiness tallies confirmed; `counted: false`.
5. Whole repo gate green.

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
- All prior records immutable; schema amendments only where measurement contradicts, recorded; no fabricated evidence; truthful reds; inventories exact. No network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/witness-angular-tiny-translator-v0-12-0/receipt.json evidence/runs/witness-angular-tiny-translator-v0-12-0/receipt.md'
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
```

## Blocked permission

If a journey cannot pass truthfully (RED first), publishing is nondeterministic (bring the runs), or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
