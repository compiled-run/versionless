Fable-Opus-Unit: lrapr-t006/u20c2n-runner-publish
Fable-Opus-Timeout-Minutes: 40

## Goal

Complete and publish the super-productivity witness vertical in /Users/jacksm5pro/dev/open-source/versionless — the final unit of the last Angular cell (commit `03388f8`: all five journey legs (a/b/c/d/e) measured-green on both lanes; schema shapes landed; migrated bound to the clean dist-25; calibration drivers hold the gestures).

1. **Confirm the producer drives all five legs.** `executeAngularSuperProductivityWitnessRun` in `real-app-run.ts` must actually execute legs a (create), c (time-track), b (drag), d (project-switch + huePrimary mat-select theme shift + `w` shortcut), e (reload persistence) — porting the calibrated gestures from the calibrate drivers where the producer does not yet drive a leg. For a PUBLISHED super-productivity run, `settings` (leg d) evidence must be REQUIRED, not optional — tighten the parser so a published run without leg-d evidence fails (the type may stay optional only for the generic run shape; the vertical's own verifier requires it).
2. **Dedicated runner** `packages/cli/src/witness/angular-super-productivity-run.ts` per the tiny-translator idiom: publish/verify flow, mutation seam chosen and verified UNIQUE against dist-25's bundle (re-verify against the current served bytes), the assembleMigratedTree/dist-25 lane bound.
3. **Publish**: baseline 2/2 + migrated 2/2 (both lanes pageErrors 0 — the split regression is fixed); one behavior digest across all four (the per-lane declared differences — font-family, theme rgb format — travel as declared, not in the shared digest); mutation red → byte-identical restore → green; canonical receipts at `evidence/runs/witness-angular-super-productivity-v2-13-15/receipt.{json,md}` + artifacts; the receipt carries THIS cell's full story (the 19+1 accommodation inventory, the assembleMigratedTree reproducibility, the Ivy-input-order regression found→fixed via template-binding-reorder, the three harness self-corrections, the leg-c/leg-d honest non-claims); readiness tallies confirmed against the aggregate; `counted: false`.
4. Whole repo gate green.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/witness-angular-super-productivity.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `evidence/runs/angular-super-productivity-v2-13-15/**`
- `evidence/runs/witness-angular-super-productivity-v2-13-15/**`
- `fixtures/angular-super-productivity-v2-13-15/**`

## Forbidden moves

- No other packages/core changes; no packages/frameworks/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/\*\*.
- No fabricated evidence; truthful reds (a real break is RED first); the per-lane declared differences stay declared, never normalized into the shared digest; no color-input-driven claim. No network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/witness-angular-super-productivity-v2-13-15/receipt.json evidence/runs/witness-angular-super-productivity-v2-13-15/receipt.md'
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
```

## Blocked permission

If a leg the producer must drive reveals a real break (RED first with the measurement), publishing is nondeterministic beyond the recorded per-lane declared differences (bring the runs), the mutation seam is not unique in dist-25, or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
