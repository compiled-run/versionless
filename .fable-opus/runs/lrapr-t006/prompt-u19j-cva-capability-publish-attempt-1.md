Fable-Opus-Unit: lrapr-t006/u19j-cva-capability-publish
Fable-Opus-Timeout-Minutes: 35

## Goal

Land the ruled forms era-compatibility capability, rebuild, and publish the tiny-translator witness vertical in /Users/jacksm5pro/dev/open-source/versionless (commit `f0ad5c4`; cause record `evidence/runs/angular-tiny-translator-v0-12-0/u19i-data-loss-cause.json`).

PM ruling baked in — **forms legacy-CVA compatibility capability** in `packages/frameworks/angular`: when an app crossing the v15 forms boundary has a custom ControlValueAccessor whose `setDisabledState` does more than toggle a flag (analyzer-detectable: the method's body writes anything beyond a boolean field / disabled-attribute plumbing — the u19i case rebuilds a FormGroup), provide `CALL_SET_DISABLED_STATE` as `'whenDisabledForLegacyCode'` via the app's root providers (the vendor's own switch for exactly this migration; provider-level, zero app-logic changes). Refuse when no such CVA exists (no speculative provider). Tests: positive on the u19i shape; negative on a toggle-only CVA.

Then:

1. Apply; rebuild ×2 deterministic; **behavior check**: the u19h discriminator must flip — the undo control loses `disabled` within the debounce window on the migrated lane (the settled-reaction anchor that caught the loss now proves the fix). New superseding build record; schema re-pin (the established supersede-by-reference discipline).
2. Calibrate the remaining baseline divergence (u19h: `All units` expected 3 / observed 2 after the reviewer commit — one stage-labelled probe pass; correct the assertion to measured reality on BOTH lanes).
3. Complete the deferred core schema amendments (observerFinalization.workerEvents, refusedServiceWorker shape already landed — the recorded-amendment list and receipt test updates that travel with them).
4. **Publish**: baseline 2/2 + migrated 2/2; mutation red → byte-identical restore → green; canonical receipts at `evidence/runs/witness-angular-tiny-translator-v0-12-0/receipt.{json,md}`; the FileReader arbitration outcome stated; the data-loss finding + root cause + capability repair recorded IN the receipt (this cell's story is the pitch story — the receipt carries it); readiness tallies confirmed; `counted: false`.
5. Whole repo gate green.

## File contract

- `packages/frameworks/angular/**`
- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/witness-angular-tiny-translator.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `evidence/runs/angular-tiny-translator-v0-12-0/**`
- `evidence/runs/witness-angular-tiny-translator-v0-12-0/**`
- `fixtures/angular-tiny-translator-v0-12-0/**`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`

## Forbidden moves

- No other packages/core changes; no packages/frameworks/react/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/\*\*.
- The u19i cause record and all superseded records stay immutable; no fabricated evidence; truthful reds; inventories exact. No network unless a consented install is genuinely needed (record). Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/witness-angular-tiny-translator-v0-12-0/receipt.json evidence/runs/witness-angular-tiny-translator-v0-12-0/receipt.md'
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
```

## Blocked permission

If the discriminator does not flip after the capability (bring the measurement), a new break surfaces (RED first), publishing is nondeterministic (bring the runs), or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
