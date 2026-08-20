Fable-Opus-Unit: nts-t004/spike-a-ngcc-1213-feasibility
Fable-Opus-Timeout-Minutes: 40
Fable-Opus-Effort: high
Effort-Justification: This spike prices the strategy board's biggest unknown — whether the declared tranche-two ngcc-bearing Angular 12/13 cell can actually consume the pre-Ivy libraries that block ~125 of ~150 fleet Angular apps — and a wrong verdict misprices the owner's next-tranche decision; the ngcc runs must be measured honestly in a scratch closure without touching any frozen subtree.

## Goal

SPIKE A (T003 Judge package) in /Users/jacksm5pro/dev/open-source/versionless: price the Angular 12/13 ngcc-bearing cell WITHOUT building a cell. The pigallery2 holdout RED (receipt evidence/runs/holdout-angular-pigallery2/receipt.json, digest 39a133ff) names three no-successor pre-Ivy libraries at six import sites: `@yaga/leaflet-ng2`, `jw-bootstrap-switch-ng2`, `ng2-slim-loading-bar`. The question: would an ngcc-bearing cell (Angular 12 or 13) actually consume them?

Do:

1. REGISTRY METADATA (network authorized only for these reads + fetches, consent VL-LEGACY-CORPUS-2026-08-10, every URL recorded): for each of the three libraries — published versions, module formats shipped (ViewEngine metadata.json presence, fesm/umd shapes), declared peer ranges, deprecation state. Also record @angular/compiler-cli 12.x and 13.x availability and their ngcc entry points, and the Node-era constraints those lines declare.
2. SCRATCH NGCC RUNS: under `.versionless/work/spike-ngcc-1213/` (scratch, unversioned), create a minimal closure per Angular line tested (12 final line; 13 final line — note Angular 13 removed ViewEngine support for libraries progressively, so 12 may be the honest cell; measure, don't assume): install the three libraries + the matching @angular/core/common/compiler-cli, run ngcc over each library, and record per-library verdicts: does ngcc produce Ivy-compatible output (check for ngcc back-compiled markers), errors verbatim if not.
3. FEASIBILITY VERDICT: per-library (consumable at 12? at 13?) + overall D1 verdict: is a pigallery2 retry winnable at an ngcc-bearing cell, which Angular line is the honest cell choice, what Node era the cell implies, and whether the T001 estimate (~25-40 units for cell + one proving app + refreeze + claims regen) holds, tightens, or grows — with the reasoning.
4. EVIDENCE to `evidence/spikes/ngcc-1213-feasibility/` (registry-metadata.json, ngcc-runs.json with verbatim outputs, verdict.json, README.md summary). No host paths/credentials in evidence. Offline after the fetches.

## File contract

- `evidence/spikes/ngcc-1213-feasibility/**`
- `docs/goals/next-tranche-strategy/**`

## Forbidden moves

- ZERO frozen-subtree edits (packages/frameworks/**, packages/core/src/{migrations,bundlers,analysis}/**) — verify by plain-shell freeze recompute == 27741d9c8bfac1b6bb0b330423b1cf258fcde722f548ecb9cf8b389cc98e4234 before and after. No packages/\*\* edits at all. No cell-building, no adapter work, no tranche execution — this is a measurement. Scratch work stays under .versionless/work/spike-ngcc-1213/. Do not commit or stage. Kill processes.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
sh -c 'node -e "const v=require(\"./evidence/spikes/ngcc-1213-feasibility/verdict.json\"); if(!v.perLibrary||!v.overall) throw new Error(\"incomplete verdict\"); console.log(\"D1 verdict:\", v.overall.feasible, \"cell:\", v.overall.honestCell)"'
sh -c 'for p in packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis; do echo "$p $(git rev-parse HEAD:$p)"; done | shasum -a 256 | grep -q 27741d9c && echo FREEZE-INTACT'
```

## Blocked permission

If registry state contradicts the boundary record (bring the bytes), ngcc cannot run on this host's available Node eras (exact error), a library's verdict is genuinely ambiguous (bring both readings), or the 3h budget approaches with runs incomplete (record partials — partial evidence is still pricing), return status "blocked" with specifics in open_questions instead of improvising.
