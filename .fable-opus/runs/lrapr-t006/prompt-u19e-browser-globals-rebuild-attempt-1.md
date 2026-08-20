Fable-Opus-Unit: lrapr-t006/u19e-browser-globals-rebuild
Fable-Opus-Timeout-Minutes: 35

## Goal

Fix the tiny-translator migrated lane's boot failure with a generic capability and re-land the build in /Users/jacksm5pro/dev/open-source/versionless (commit `778e29b`; red record at `evidence/runs/angular-tiny-translator-v0-12-0/u19d-witness-calibration-red.json`: `process is not defined` at module evaluation — `util@0.12.5`'s top-level `NODE_DEBUG` read, byte-located at main offset 1614357; stage at `.versionless/stage/angular-tiny-translator-v0-12-0-u17b/app`).

PM ruling baked in — **node-core runtime-globals coherence capability** in `packages/frameworks/angular`: when the composed changeset declares a node-core-module dependency for a browser bundle (u17c's `util` declaration is the live case), the capability must supply the runtime globals that module's browser evaluation requires, coherently and measurably — read the installed module's actual top-level global references (the analyzer can find `process.env` reads) and provide the narrowest shim the builder supports (the Angular builder's define/polyfills seam; the React side's node-core precedent is the discipline model, not the mechanism). Refuse globals the reading cannot prove needed. No blanket node polyfill sets.

1. Implement + tests (positive: the util/NODE_DEBUG case; negatives: a node-core module with no global reads gets no shim; an unproven global refused by name).
2. Apply to the stage; rebuild the migrated lane; **verify boot in a browser this time** (a minimal page-evaluation check that Angular bootstraps and renders the home surface is in-contract via the existing witness host — no journeys, just the boot fact that killed u19d); build ×2 deterministic; new build record superseding u17d's by reference (immutable original untouched), digests re-pinned in the schema per the amend-what-measurement-contradicts discipline (the schema's bound-receipt digests move to the new build — recorded).
3. Also correct the schema's receipt-path constant to `witness-angular-tiny-translator-v0-12-0` (the ruled path) and encode the era lane's SW-attempting admission (exact 400 + two console errors as the baseline inventory; the zero-SW policy pin becomes the SW-ATTEMPT record per the mw1e precedent; the contradicted nonclaim replaced with the truthful era-defect statement).
4. Whole repo gate green.

## File contract

- `packages/frameworks/angular/**`
- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/witness-angular-tiny-translator.ts`
- `packages/core/test/**`
- `evidence/runs/angular-tiny-translator-v0-12-0/**`
- `fixtures/angular-tiny-translator-v0-12-0/**`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`

## Forbidden moves

- No other packages/core changes; no packages/frameworks/react/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/\*\*.
- The u17d record is immutable — supersede by reference only; no blanket polyfills; no app-name branches; no fabricated evidence; truthful reds. No network unless a consented install is genuinely needed (record). Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/angular-tiny-translator-v0-12-0'
```

## Blocked permission

If the builder exposes no seam for a proven-needed global (bring the builder reading), boot still fails after the shim (bring the new page error), or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
