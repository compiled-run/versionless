Fable-Opus-Unit: lrapr-t006/u18e-super-productivity-convergence
Fable-Opus-Timeout-Minutes: 35

## Goal

Continue the super-productivity migrated lane's convergence in /Users/jacksm5pro/dev/open-source/versionless (commit `eeef8ce`; ledger at `evidence/runs/angular-super-productivity-v2-13-15/u18d-capability-round.json`; 57 diagnostics; stage at `.versionless/stage/angular-super-productivity-v2-13-15-u18b/app`). Green, or a smaller itemized remainder, are both COMPLETED outcomes.

The six remaining families by current census, with expected shapes:

1. **@ngx-formly (largest: 2 TS2314, 2 TS2740, 3 TS2322, 10 TS2339 — all downstream of one unparameterised base class)**: the `to`→`props` rename and the FieldType<FieldTypeConfig> parameterisation are documented v6 migration shapes — implement analyzer-driven against the installed formly surface (verify `props` exists, verify the type parameter's shape), refusing what the surface cannot prove.
2. **@ngrx/entity `addAll`→`setAll` (3 sites)**: TS2339 with no compiler suggestion — a surface-verified rename capability keyed on the installed @ngrx/entity adapter surface (setAll present, addAll absent), binding-resolved to the adapter instance.
3. **`rxjs/internal-compatibility`**: map through the installed rxjs surface via the existing deep-specifier collapse if the symbols exist at root; else itemize.
   4-6. The call-site families incl. the newly visible `mat-chip-list` NG8001 (Material 16 renamed the chip surface — read the installed @angular/material chips module for the successor selector idiom; template renames only where the analyzer proves the mapping) and the remaining TS2339/TS2322 sites per the ledger.

Then: build attempt; if green — ×2 deterministic-modulo the recorded Sass-random files, logical-name parity per the standing ruling, truthful final applicationFilesChanged, the u18e record. If red — smaller remainder itemized with before/after counts. Tests per idiom; overfitting guard green; whole repo gate green.

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
- No app-name branches in product code; no fabricated evidence; truthful reds; no test weakening. Network only for consented reads/installs (recorded). Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/angular-super-productivity-v2-13-15'
```

## Blocked permission

If a transform cannot stay generic (name the construct), a closed enumeration outside the contract surfaces, or the honest cut line exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
