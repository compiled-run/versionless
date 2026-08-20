Fable-Opus-Unit: bank-demo-fleet-pipeline-p2/T009b-pigallery2-lane-pair
Fable-Opus-Timeout-Minutes: 30

## Goal

Build the pigallery2 **lane pair** at the Angular 13 cell — the same proof shape every sealed Angular vertical carries: a **baseline** production build at the app's own era, and a **migrated** production build at the target cell, both double-built for byte-comparison, with the readings published as evidence. This is the step between T009a (the app compiles at the cell) and the witness (browser parity), and it feeds T010's freeze supersession with measured facts.

What you inherit — read first:

- `evidence/runs/angular-13cell/pigallery2-compile.json` + `README.md` (T009a): the cell verbatim (`angular 13.4.0 / node v16.20.2 / rxjs 6.6.7 / CLI 13.3.11`), the three diagnostic-named source edits, the four ngcc-processed/Ivy-native libraries, the work-area recipe at `.versionless/work/angular-pigallery2/13cell/`.
- `.versionless/work/angular-pigallery2/{baseline,target,target-probe}` — the existing pigallery2 work areas; `baseline` is pigallery2 1.7.0 at its own era (Angular 8; the runtime cache `angular-pigallery2-v1-7-0-runtime` holds node-v10.24.1 — the era runtime).
- The sealed verticals' lane-pair shape: look at one published record under `evidence/runs/angular-tiny-translator-v0-12-0/` or `evidence/runs/angular-jira-clone/` for what a lane-pair/build record carries (double-build byte comparison, build commands verbatim, output inventories, machine times). Match the spirit; the schema here is new (`versionless.angular-13cell-lanes.v1`) because this cell is not yet an adapter target.

Deliver:

1. **Baseline lane:** production build of pigallery2 1.7.0's frontend at its own era — Angular 8 toolchain, node-v10.24.1 from the existing runtime cache, `ng build --prod` or the app's own build script (read `package.json`). Build TWICE into separate out dirs; byte-compare (sorted sha256 inventory; name any files that differ and classify — timestamps/hashes in filenames are the known non-determinism class). If the era build cannot run on this arm64 host (node-sass class — check the closure first), record the named blocker verbatim and proceed with the migrated lane only; a missing baseline bounds the later parity claim and the record must say so.
2. **Migrated lane:** production build at the 13 cell (`ng build` prod config, CLI 13.3.11, Node 16.20.2) from the 13cell work area with the three source edits applied. Build TWICE; byte-compare. Record ngcc's involvement (first build processes, second should hit its cache).
3. **Publish** `evidence/runs/angular-13cell/pigallery2-lanes.json` (schema `versionless.angular-13cell-lanes.v1`): per lane — toolchain verbatim, build command verbatim, exit codes, output file count + total bytes, double-build comparison result (identical | differing files named+classified), machine times; the three source edits restated as the migration delta so far (files, one-line each, diagnostic that named it); `notEstablished` (this proves both lanes BUILD reproducibly; it does not prove runtime behaviour, parity, or witness — those are the next unit); integrity sha256. Update the README beside it.
4. No package code, no test files — evidence unit, verify checks the record shape.

Budget: 30 minutes. Era installs at Node 10 can be slow and may fail honestly — **timebox the baseline to minute 12**; if it is still installing, record `baseline: not-built-in-budget` with what happened and move to the migrated lane. **Start the verify chain by minute 24.** If the migrated lane cannot double-build in budget, publish what ran and return `blocked` naming the remainder — not `partial`.

## File contract

- `.versionless/work/angular-pigallery2/**`
- `.versionless/cache/**`
- `evidence/runs/angular-13cell/**`

## Forbidden moves

- Do not write inside `packages/**`. Why: the pipeline learns this cell in T010 with the freeze supersession; this unit is measurements.
- Do not touch sealed evidence (`evidence/runs/angular-tiny-translator*/`, etc.) or the trust package. Why: new evidence beside, never edits.
- Do not move the pins: rxjs stays 6.x, Angular stays 13.4.0, CLI stays 13.3.11. Why: the honest cell is the claim.
- Do not "fix" a failing era baseline by upgrading its toolchain. Why: the baseline's value is that it IS the era; a baseline that cannot build on this host is a named finding (x64/Rosetta class), not a thing to modernize.
- Consented fetches only (`VERSIONLESS_NETWORK_MODE=consented VERSIONLESS_CONSENT_ID=VL-LEGACY-CORPUS-2026-08-10`), and say what was fetched. Why: audited posture.
- **No git stash / checkout -- / reset / clean.** Why: standing rule.

## Verification

```verify
node -e "const r=require('./evidence/runs/angular-13cell/pigallery2-lanes.json');if(r.schemaVersion!=='versionless.angular-13cell-lanes.v1')throw new Error('schema');if(!r.lanes||!r.lanes.migrated)throw new Error('migrated lane missing');const m=r.lanes.migrated;if(m.builds!==2||typeof m.doubleBuildIdentical!=='boolean')throw new Error('migrated double-build');if(!r.lanes.baseline||!(r.lanes.baseline.builds===2||typeof r.lanes.baseline.notBuilt==='string'))throw new Error('baseline neither built twice nor named-not-built');if(!Array.isArray(r.migrationDeltaSoFar)||r.migrationDeltaSoFar.length<3)throw new Error('migration delta');if(!Array.isArray(r.notEstablished)||!r.notEstablished.length)throw new Error('notEstablished');if(!r.integrity||!r.integrity.sha256)throw new Error('integrity');console.log('13CELL-LANES ok: migrated identical='+m.doubleBuildIdentical+' baseline='+(r.lanes.baseline.builds===2?('identical='+r.lanes.baseline.doubleBuildIdentical):('not-built: '+String(r.lanes.baseline.notBuilt).slice(0,60))))"
test -f evidence/runs/angular-13cell/README.md && echo RECIPE-README-PRESENT
git diff --quiet HEAD -- packages/ && echo NO-PACKAGE-CODE-TOUCHED
git diff --quiet HEAD -- packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis && echo FREEZE-INTACT
npm run trust:verify -- --offline
```

## Blocked permission

If evidence is missing, the contract conflicts with reality, or you need a file outside the contract, return status "blocked" with the question in open_questions instead of improvising. Specifically block, do not improvise, if: the migrated production build fails for a cause the T009a compile did not predict (name the first diagnostics verbatim — that re-prices the cell); Node 10 cannot run on this host at all AND the baseline blocker is not one of the named classes; or a fetch would be needed outside the consent posture.
