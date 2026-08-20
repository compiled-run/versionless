Fable-Opus-Unit: lrapr-t006/u18h-super-productivity-green-close
Fable-Opus-Timeout-Minutes: 35

## Goal

Close the super-productivity migrated lane to GREEN in /Users/jacksm5pro/dev/open-source/versionless (commit `0a989e1`; ledger `evidence/runs/angular-super-productivity-v2-13-15/u18g-capability-round.json`; 27 diagnostics, of which 14 of 16 NG6002/NG6003 are downstream accounting; stage at `.versionless/stage/angular-super-productivity-v2-13-15-u18b/app`).

PM RULING — the accommodation boundary (charter-grounded, baked in): where a demand has NO derivable generic mapping, a **fixture-scoped manual-migration accommodation** is authorized — an explicit source edit recorded per-edit in the evidence as a `manual-migration-step` with file, before/after, and the reason no capability can derive it. The charter permits fixture-scoped accommodations outside exported product APIs; the receipt will carry the honest count of manual steps, which is fleet-relevant truth (the tool itemizes exactly where human judgment is required). Discipline: capabilities FIRST wherever provable; accommodations are the recorded remainder, never the shortcut; zero app-name product code; every accommodation lives in the fixture flow (`fixtures/angular-super-productivity-v2-13-15/` + the cli fixture runner), never in packages/frameworks.

Apply to the remaining families:

1. **chart.js options literal**: the derivable renames (`legend`→`plugins.legend`, ticks/grid renames a declaration carries) go through a capability or existing machinery if provable; the `xAxes`/`yAxes` arrays→record restructure (no derivable key) is a ruled manual-migration-step accommodation.
2. **ngx-electron** (ViewEngine-only, no ngcc): ecosystem `no-successor` disposition; measure how the app actually uses it (IS_ELECTRON-guarded service?) — the web lane's honest shape is the accommodation that keeps the web build green (conditional import removal or a typed local stub in the fixture flow), recorded as a manual step with the Electron-out-of-scope rationale from the ingest.
3. The remaining TS2322/TS2305/TS2554/TS2345/TS2769 sites: capabilities where the surfaces prove them; ruled accommodations otherwise, each itemized.
4. GREEN target: build ×2 deterministic-modulo the recorded Sass-random files; logical-name parity vs the era lane; truthful whole-tree applicationFilesChanged separating capability-driven edits from manual-migration-steps; the u18h record closing the cell's build story with the complete accommodation inventory.
5. Tests per idiom for any new capability; overfitting guard green; whole repo gate green. If green is still unreachable, the smaller remainder with the accommodation inventory so far — but the expectation is green.

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
- Accommodations never enter packages/frameworks (product surface); no app-name branches in product code; no fabricated evidence; truthful reds; no test weakening. Network only for consented reads (recorded). Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/angular-super-productivity-v2-13-15'
```

## Blocked permission

If an accommodation would have to change behavior beyond what the migration story records (name it), determinism-modulo fails beyond the recorded cause, or a closed enumeration outside the contract surfaces, return status "blocked" with specifics in open_questions instead of improvising.
