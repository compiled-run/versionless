Fable-Opus-Unit: lrapr-t006/u18f-super-productivity-chips-round
Fable-Opus-Timeout-Minutes: 35

## Goal

Continue the super-productivity convergence in /Users/jacksm5pro/dev/open-source/versionless (commit `f097d55`; ledger `evidence/runs/angular-super-productivity-v2-13-15/u18e-capability-round.json`; 33 diagnostics; stage at `.versionless/stage/angular-super-productivity-v2-13-15-u18b/app`). Green or a smaller itemized remainder are both COMPLETED outcomes.

PM ruling on the chip-list refusal (u18e's reading, now ruled): Material 16 split `mat-chip-list` into three successors, and which one applies IS an application reading — but a machine-provable one. Material's own migration semantics: a chip list hosting `matChipInput` becomes `mat-chip-grid` (input-bearing); listbox is for selection surfaces; set for static display. A capability keyed on the TEMPLATE FACTS the analyzer can prove (presence/absence of matChipInput, selection bindings) implementing exactly that documented mapping is generic — the refusal condition is any chip list whose template facts match none of the documented shapes. Both call sites here host matChipInput → mat-chip-grid, with the companion element/attribute renames the installed chips module's surface proves (mat-chip → mat-chip-row inside a grid, etc. — read the installed module).

Also this round, per the u18e ledger:

1. `rxjs/internal-compatibility` (TS2307): rxjs root publishes no `fromPromise` — the v7 idiom is `from`. A surface-verified rewrite `fromPromise(x)` → `from(x)` is provable IF the installed root exports `from` and the call shape is the single-argument promise form; refuse others. (This is a written-down-successor claim like addAll→setAll — state it plainly in the record.)
2. The remaining TS2322/NG6002 and call-site families as the census reports them after the above: existing capabilities where they fire; narrow provable transforms; itemize the rest.
3. If green: build ×2 deterministic-modulo the recorded Sass-random files, logical-name parity per the standing ruling, truthful final applicationFilesChanged, the u18f record. If red: smaller remainder itemized with before/after counts.

Tests per idiom; overfitting guard green; whole repo gate green.

## File contract

- `packages/frameworks/angular/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `evidence/runs/angular-super-productivity-v2-13-15/**`
- `fixtures/angular-super-productivity-v2-13-15/**`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`

## Forbidden moves

- No packages/core/src changes, no packages/frameworks/react/**, packages/cli/src/witness/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/**.
- No app-name branches in product code; no fabricated evidence; truthful reds; no test weakening. Network only for consented reads (recorded). Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/angular-super-productivity-v2-13-15'
```

## Blocked permission

If a template mapping cannot be proven from analyzer-readable facts (name the site), a transform cannot stay generic, or the honest cut line exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
