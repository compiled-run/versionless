Fable-Opus-Unit: lrapr-t006/u20c2r-publish
Fable-Opus-Timeout-Minutes: 40

## Goal

Publish the super-productivity witness vertical in /Users/jacksm5pro/dev/open-source/versionless — the final unit of the last Angular cell (commit `9947260`: the five-leg asserting journey drives GREEN on both lanes, shared behaviorDigest a38d983e, all pins measured-true, migrated bound to clean dist-25, mutation seam `dialog-create-project` verified unique). The deliverable is published canonical receipts with a green `receipt:verify`.

1. Write/finish the dedicated runner `packages/cli/src/witness/angular-super-productivity-run.ts` (the scaffolding + `SUPER_PRODUCTIVITY_MUTATION_SEAM` are in `real-app-run.ts`) per the tiny-translator idiom: publish/verify flow producing baseline 2/2 (dist-run2) + migrated 2/2 (dist-25), the mutation red → byte-identical restore → green cycle against dist-25, the file-sha256 migrated binding.
2. **Publish** canonical receipts at `evidence/runs/witness-angular-super-productivity-v2-13-15/receipt.{json,md}` + artifacts under `evidence/runs/angular-super-productivity-v2-13-15/`: one behavior digest across all four runs (a38d983e — the per-lane declared differences: typeface, theme rgb format, pre-MDC/MDC geometry, stay OUT of the shared digest as already designed); `counted: false`; readiness confirmed against the aggregate. The receipt.md carries THIS cell's full story: the 19+1 accommodation inventory, assembleMigratedTree reproducibility, the Ivy-input-order regression found→fixed via template-binding-reorder, the three harness self-corrections (NUL bytes, IndexedDB sort, cross-origin cache member), the five asserting-pin corrections, and the honest non-claims (ms-to-string time, color-input undriveable, dark-theme-no-UI).
3. Whole repo gate green (`receipt:verify` green is the load-bearing check).

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
- No fabricated evidence; the journey is already green — publish what it produces; per-lane declared differences stay declared; no color-input claim. No network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/witness-angular-super-productivity-v2-13-15/receipt.json evidence/runs/witness-angular-super-productivity-v2-13-15/receipt.md'
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
```

## Blocked permission

If publishing is nondeterministic beyond the recorded per-lane declared differences (bring the runs), the mutation cycle does not restore byte-identically, or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
