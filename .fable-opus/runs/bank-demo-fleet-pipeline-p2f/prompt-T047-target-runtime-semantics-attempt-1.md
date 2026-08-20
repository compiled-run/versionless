Fable-Opus-Unit: bank-demo-fleet-pipeline-p2f/T047-target-runtime-semantics
Fable-Opus-Timeout-Minutes: 35

## Goal

Fix the runtime-threading contradiction T045-b3 measured (commit 8f79c30; read `notes/T012-angular-batch.md` §15.2 first): the migrated lane's install and build must run under the runtime the TARGET requires, not the runtime the SOURCE tree's era declares. Measured facts: your-spotify's era-cell read `client/Dockerfile` `FROM node:16-alpine`, provisioned Node 16.20.2, and u5's threading handed that to a migrated Vite 8.0.16 lane requiring Node 20.19+ → `ReferenceError: CustomEvent is not defined`, an unnamed defect. cra-redux, identical adapter and Vite version but no era sources, built at host v24 and went proven. Meanwhile the Angular case is CORRECT today by coincidence of values: the 13 target cell's `nodeLine` 16.20.2 happens to equal what era-cell provisions — but it is correct because the TARGET wants it, not because the source declared it.

The semantic to implement (PM-ruled):
1. The runtime plan threaded into `runLaneInstall`/`runLaneBuild` derives from the TARGET of the composed plan: for an Angular plan, the resolved `AngularTargetCell`'s `nodeLine` (provision it via the same machinery era-cell uses — the provisioned-runtime cache is lineage-agnostic bytes; its `angular-13-cell-runtime` cache-dir NAME is a historical label, note it, don't rename it); for the react/Vite lane, the target toolchain's requirement — Vite 8 needs Node >= 20.19; if the host satisfies it, host (the flame/cra-redux path, unchanged); if the host does NOT satisfy the target requirement, that is the NAMED refusal `build.host-runtime-below-target-requirement` (or the convention-consistent name), never a silent attempt.
2. The SOURCE era runtime keeps its honest uses: the era-cell RECORD still reads and reports the source era (that reading is true and stays); baseline/era lane work (the T009-style recipes) still uses it. What changes is only which runtime the MIGRATED lane's install/build receive.
3. When target-runtime and era-runtime differ, the run record must SAY so: the install/build runtime blocks (u5's) already record source/cellSupplier/versions — add the era-declared runtime beside the target-chosen one on the row (e.g. `eraDeclared: {source: dockerfile, version: 16}` vs the chosen target runtime), so the divergence your-spotify measured is legible instead of invisible.
4. Tests: the your-spotify shape (era says 16, target Vite 8, host modern → build under host, divergence recorded); the angular2-hn shape (target cell nodeLine 16 → provisioned 16, agreeing with era, recorded); the cra-redux shape (no era → host, unchanged rows byte-compatible); host-below-target → named refusal. Shim-based, no network.
5. THE REPRODUCTION GATES: fresh flame re-run (host cell — rows must be substantively unchanged, 9/9, count 0, pinned fields); your-spotify re-run — expected to now cross build under host Node and reach witness or an honest witness-stage outcome; if it goes 9/9 count 0, proven moves 13→14 and the publish chain runs. angular2-hn is NOT re-run (its wall is the owner-gated frozen defect; unchanged).
6. Census: new refusal site → regen + u10 ordering. Coverage/matrix/composite guards bind as always (proven floor 13).

## File contract

- `packages/cli/src/operator/run.ts`
- `packages/cli/src/operator/install.ts`
- `packages/cli/src/operator/build.ts`
- `packages/cli/src/operator/era-cell.ts`
- `packages/cli/test/**`
- `evidence/runs/**`
- `evidence/trust/current/**`
- `evidence/runs/operator-flows/refusal-census.json`
- `docs/goals/bank-demo-fleet-pipeline/notes/T012-angular-batch.md`

## Forbidden moves

- Do not change what the era-cell stage READS or RECORDS about the source (its record stays true history); only what the migrated-lane stages RECEIVE. Why: the reading is honest; the threading was the bug.
- Do not touch `packages/frameworks/**`, `packages/core/**`, `packages/trust/src/**`. Why: the target-cell nodeLine is already published data; consuming it is operator work.
- Do not re-run angular2-hn. Do not delete/rewrite evidence (u6 preservation pattern for any re-run app). No git commit, no stash/checkout/reset/clean, never offline env on runs.

## Verification

```verify
pnpm exec vp test --project node
node -e "const r=require('./evidence/runs/react-flame-v2-4-0/run-record.json');const ran=(r.stages||[]).filter(s=>s.status==='ran').length;if(ran!==9)throw new Error('flame '+ran);const i=require('./evidence/runs/react-flame-v2-4-0/run-record.json.interventions.json');if((i.interventionCount??i.count)!==0)throw new Error('flame count');console.log('FLAME-GATE-HELD')"
node -e "const r=require('./evidence/runs/react-your-spotify-1-5-0/run-record.json');const rows=(r.stages||[]);const b=rows.find(s=>(s.stage||s.name)==='build');console.log('YOUR-SPOTIFY build status='+b.status+' ran='+rows.filter(s=>s.status==='ran').length+'/9')"
node --experimental-strip-types packages/cli/src/cli.ts refusal-census --verify-only --json 2>/dev/null | node -e "let b='';process.stdin.on('data',d=>b+=d);process.stdin.on('end',()=>{const d=JSON.parse(b);if(!d.matchesPublished)throw new Error('census drifted');console.log('CENSUS-OK sites='+d.census.summary.sites)})"
npm run trust:verify -- --offline
node -e "const r=require('./evidence/trust/current/coverage-report.json').totals;if(r.proven<13)throw new Error('proven regressed: '+r.proven);console.log('PROVEN-FLOOR-HELD proven='+r.proven)"
node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline 2>&1 | grep -q "angular: 4 counted of 4" && echo ANGULAR-CELLS-STABLE
node -e "const f=require('./evidence/trust/current/adapter-freeze.json');if(!String(f.freeze.composite).startsWith('140ce86e'))throw new Error('composite moved');console.log('COMPOSITE-STABLE')"
git diff --quiet HEAD -- packages/frameworks packages/core packages/trust/src && echo FROZEN-TRUST-CORE-UNTOUCHED
git diff --quiet HEAD -- evidence/runs/angular2-hn && echo ANGULAR2HN-UNTOUCHED
```

## Blocked permission

If the target-runtime derivation for the react lane cannot be expressed without inventing a requirement table this packet's Vite-8 fact does not justify, if the Angular provisioning path cannot reuse era-cell's machinery without touching frozen files, or if the your-spotify re-run reaches a witness outcome with no honest named home, return status "blocked" with the question in open_questions instead of improvising.