Fable-Opus-Unit: lrapr-t005/m3b-cancelled-duplicate-inventory-and-publish
Fable-Opus-Timeout-Minutes: 35

## Goal

Finish the factoriolab witness vertical in /Users/jacksm5pro/dev/open-source/versionless. Unit m3 delivered the full vertical verified-green in this working tree (schema `witness-angular-factoriolab.ts`, AppSpec 7-stage journey, dedicated runner with the 'Select Columns' mutation seam, `WitnessMeasuredScrollAbsence`, closed-list name; both lanes driven end-to-end with identical solver outputs and route sequences, zero console errors) but could not publish canonical receipts: `GET /assets/transparent.gif → net::ERR_ABORTED` fires nondeterministically (~1 in 3) during bootstrap — the browser cancelling its own duplicate refetch (origin sends `cache-control: no-store`; every `lab-icon` uses the same 1×1 gif; Angular re-renders icons when the dataset resolves).

PM RULING (baked in, mechanism (a) from m3's receipt): extend the generic witness non-masking machinery with a new EXACT inventory category — **browser-cancelled duplicate fetch of an asset the same page also fetched successfully** — with this precise discipline:

- Pinned by origin-relative path + method + browser reason (net::ERR_ABORTED), never by count.
- Valid ONLY when the ledger corroborates at least one SUCCESSFUL fetch of the same path by the same page — a cancelled fetch with no successful sibling is still a hard failure.
- Every other failed request still fails exactly as today; this is a category, not an allowance. The category, its corroboration rule, and each observed instance are recorded in the receipt.
- Generic surface (types in `packages/core/src/receipts/witness-real-app.ts` per the failed-request-inventory idiom; mechanism in the witness host/runner machinery), no app names outside closed lists. The pinned react-hospitalrun and react-papercups evidence must remain untouched and their verifiers still green — this mechanism must be additive.

Then deliver the rest of what m3 owed:

1. Publish canonical receipts deterministically: baseline 2/2 + migrated 2/2, byte-mutation red → byte-identical restore → green, receipts at `evidence/runs/witness-angular-factoriolab/receipt.{json,md}`, artifacts under `evidence/runs/angular-factoriolab/`, `counted: false` pending Judge. If the new category still cannot make publishing deterministic, that is a blocked-worthy finding with the measured evidence.
2. The owed tests: `packages/cli/test` + `packages/core/test` cases for the new schema and the new inventory category (positive: corroborated cancelled duplicate admitted and recorded; negatives: uncorroborated cancelled fetch fails, non-matching path fails, any other failure reason fails).
3. Whole repo gate green.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/witness-angular-factoriolab.ts`
- `packages/core/src/receipts/witness-real-app.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `evidence/runs/angular-factoriolab/**`
- `evidence/runs/witness-angular-factoriolab/**`
- `fixtures/angular-factoriolab/**`

## Forbidden moves

- No other packages/core changes; no packages/frameworks/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/\*\*.
- The pinned react-hospitalrun/react-papercups receipts and their verifying tests must not change — the new category is additive only.
- No fabricated evidence; truthful reds; inventories exact; no blanket allowances; no app names in reusable surfaces.
- No network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/witness-angular-factoriolab/receipt.json evidence/runs/witness-angular-factoriolab/receipt.md'
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
```

## Blocked permission

If the corroboration rule cannot be implemented without touching pinned evidence, publishing remains nondeterministic even with the category (bring the measured runs), or a closed enumeration outside the contract surfaces, return status "blocked" with specifics in open_questions instead of improvising.
