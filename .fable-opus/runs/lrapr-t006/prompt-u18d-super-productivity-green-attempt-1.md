Fable-Opus-Unit: lrapr-t006/u18d-super-productivity-green
Fable-Opus-Timeout-Minutes: 35

## Goal

Close the super-productivity migrated lane's remaining eight demand families toward green in /Users/jacksm5pro/dev/open-source/versionless (commit `50d48e9`; demand ledger at `evidence/runs/angular-super-productivity-v2-13-15/u18c-capability-round.json`; stage at `.versionless/stage/angular-super-productivity-v2-13-15-u18b/app`, fork installed). A still-red build with a SMALLER itemized remainder is a COMPLETED outcome; so is green.

The eight families, with expected shapes (extend reusable capabilities per idiom — binding/surface-resolved, refusal over half-edits, tests + guard each):

1. ng2-charts/chart.js: apply the two compiler-resolved renames (NgChartsModule, ChartDataset) generically; the three no-successor symbols and the chart.js-2 options literal are measured demands — if the app's option usage maps to chart.js-4 equivalents the analyzer can prove per-property, transform; else itemize per property.
2. @ngx-formly `to`→`props` + FieldType genericity: analyzer-shaped renames if the installed formly surface proves them.
3. @ngrx/entity `addAll`→`setAll`: surface-verified rename (createEffect cross-proof territory — record any movement).
4. `rxjs/internal-compatibility`: ride the existing deep-specifier collapse if the installed surface maps the symbols; else itemize.
5. Five `~angular-material-css-vars/...` at-rules whose subpaths the installed 5.0.3 no longer carries: read the installed package's actual sass layout and remap generically if an equivalent exists; else itemize per at-rule.
   6-8. The three call-site families from the u18b ledger as the compiler now reports them: apply existing capabilities where they fire; new narrow transforms only where provable; itemize the rest.

Then: if green — build ×2 deterministic-modulo the recorded Sass-random files, logical-name parity per the standing ruling, truthful final `applicationFilesChanged`, the u18d record. If still red — the smaller remainder itemized with before/after diagnostic counts, no parity fabricated.

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
- No app-name branches in product code; no fabricated evidence; truthful reds; no test weakening. Network only for consented reads/installs (recorded). Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/angular-super-productivity-v2-13-15'
```

## Blocked permission

If a transform cannot stay generic (name the construct), determinism-modulo fails beyond the recorded cause, or a closed enumeration outside the contract surfaces, return status "blocked" with specifics in open_questions instead of improvising.
