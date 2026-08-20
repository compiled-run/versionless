Fable-Opus-Unit: lrapr-t006/u20c2p-runner-publish-final
Fable-Opus-Timeout-Minutes: 40

## Goal

Write the dedicated runner and publish the super-productivity witness vertical in /Users/jacksm5pro/dev/open-source/versionless — the final unit of the last Angular cell (commit `c45416f`: producer drives all five legs a/b/c/d/e on both lanes; schema/parser require settings; migrated bound to clean dist-25). Publishing to a green `receipt:verify` is the deliverable.

1. **Dedicated runner** `packages/cli/src/witness/angular-super-productivity-run.ts` per the tiny-translator/factoriolab idiom: publish/verify flow, the assembleMigratedTree/dist-25 migrated binding by file-sha256 (re-verify against served dist-25 bytes), mutation seam chosen and verified UNIQUE in dist-25's served bundle (grep the served .js — one occurrence, one module).
2. **Publish**: baseline 2/2 (dist-run2) + migrated 2/2 (dist-25), all four with pageErrors 0 (the split regression is fixed — a nonzero is RED); one behavior digest across all four (per-lane declared differences — font-family typeface, theme rgb format, the leg-d contrast strings — travel as declared differences, NEVER in the shared digest); mutation red → byte-identical restore → green; confirm navigations=4 and the leg-d before/after contrast shift (dark→light) on both lanes at runtime (RED-first on any real break — u20c2o flagged these as runtime-unconfirmed).
3. Canonical receipts at `evidence/runs/witness-angular-super-productivity-v2-13-15/receipt.{json,md}` + artifacts under `evidence/runs/angular-super-productivity-v2-13-15/`; the receipt.md carries THIS cell's full story: the 19+1 accommodation inventory, assembleMigratedTree reproducibility, the Ivy-input-order regression found→fixed via template-binding-reorder, the three harness self-corrections (NUL bytes, IndexedDB sort, cross-origin cache member), the leg-c/leg-d honest non-claims (ms-to-string, color-input, dark-theme-no-UI). Readiness confirmed against the aggregate; `counted: false`.
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
- No fabricated evidence; truthful reds; per-lane declared differences stay declared, never normalized into the shared digest; no color-input-driven claim. No network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/witness-angular-super-productivity-v2-13-15/receipt.json evidence/runs/witness-angular-super-productivity-v2-13-15/receipt.md'
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
```

## Blocked permission

If a runtime break surfaces on either lane (RED first with the measurement — navigations, the contrast shift, or pageErrors), publishing is nondeterministic beyond the recorded per-lane declared differences (bring the runs), the mutation seam is not unique in dist-25, or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
