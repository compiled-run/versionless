Fable-Opus-Unit: bank-demo-fleet-pipeline-p2d/T046-u6-first-angular-crossing
Fable-Opus-Timeout-Minutes: 35

## Goal

Phase D unit u6 of T046: `versionless run` on angular2-hn end to end — the first Angular application ever to reach the run command's build stage with a plan instead of a refusal. Per `docs/goals/bank-demo-fleet-pipeline/notes/T046-angular-build-lane.md` §6.1 u6 and §6.3, with one PM correction to the sizing's expectation: T044 (the frozen-defect fixes) is still owner-gated, so the EXPECTED honest outcome today is a build-stage DEFECT at schema validation (`Data path "/polyfills" must be string` — u1 measured it), executed under the NOW-ENFORCED provisioned Node 16.20.2 (u5). That record — Angular lane planned by its own workspace, run under the cell's own runtime, failing on the exact frozen defect the T044 brief names — is the final exhibit for the owner decision, and it is valuable red.

What to do:

1. Preserve history: rename `evidence/runs/angular2-hn/run-record.json` → `evidence/runs/angular2-hn/run-record-t043c.json` (and its `.interventions.json` sibling likewise) so the T043-b record survives as history — CHECK FIRST whether `readRunRecords`/coverage derivation would still pick the renamed file up (grep how run records are discovered); if the renamed file would still be read as a second record for the same app, put it under `evidence/runs/angular2-hn/history/` instead — the coverage report must see exactly ONE current record per application.
2. Run angular2-hn through the batch runner exactly as T043-b did (`notes/T012-angular-batch.md` §12 has the invocation): `--cell angular-13.4.0`, all four install policies (including `--allow-foreign-lockfile`), fresh first invocation, no offline env. interventionCount must be 0.
3. Expected stage trajectory: analyze→ingest→license→era-cell→plan→apply→install all `ran`; build now PLANS (the u4 Angular branch reads outputPath) and EXECUTES `npm run build` under the provisioned runtime (u5 — the build row's runtime block must show `source: "provisioned"`, `cellVersion: "16.20.2"`-class, and the measured resolvedVersion agreeing); the build command then fails at schema validation → the record's terminal is a build defect. If ANYTHING ELSE happens — an earlier stop, a different diagnostic, or (unexpectedly) a green build — record it exactly; every divergence from this prediction is a finding.
4. Append §13 to `notes/T012-angular-batch.md`: the stage rows, the build row's runtime block verbatim (this is the first provisioned-runtime execution in a run record), the defect diagnostic verbatim, the coverage delta, and one sentence naming what now stands between this app and proven: T044's two cell-gates (build) and then witness.
5. Publish per the batch ordering; if the census or coverage surfaces move (the app's refusal code changes from `build.configuration-absent` to the build defect), run the u10-measured ordering: census first if needed, then `VERSIONLESS_NETWORK_MODE=offline npm run trust:generate -- --offline --policy trust/policy.json --output evidence/trust/current`, then verify.

GUARDS: react 6/6 + angular 4/4; composite `140ce86e`; proven stays 11 (this record is honest red); flame's record untouched by this unit; frozen subtrees untouched; no source changes under packages/.

## File contract

- `evidence/runs/**`
- `evidence/trust/current/**`
- `docs/goals/bank-demo-fleet-pipeline/notes/T012-angular-batch.md`

## Forbidden moves

- No edits under `packages/**`. Why: the pipeline as shipped is what this record measures; T044 is owner-gated.
- Do not delete the T043-b record — relocate per step 1. Why: run records are history; the wall's movement across units IS the goal's evidence trail.
- Do not mark anything proven (9/9 + count 0 or nothing). No stash/checkout/reset/clean. No offline env on the run itself.

## Verification

```verify
node -e "const r=require('./evidence/runs/angular2-hn/run-record.json');const rows=r.stages||[];const b=rows.find(s=>(s.stage||s.name)==='build');if(!b)throw new Error('no build row');const j=JSON.stringify(b);if(!j.includes('runtime'))throw new Error('no runtime block on build row');if(!j.includes('provisioned'))throw new Error('runtime not provisioned');console.log('BUILD-ROW-PROVISIONED-RUNTIME status='+b.status)"
node -e "const r=require('./evidence/runs/angular2-hn/run-record.json');const ran=(r.stages||[]).filter(s=>s.status==='ran').length;console.log('STAGES-RAN '+ran+'/9');if(ran<7)throw new Error('regressed below T043-b: '+ran)"
node -e "const i=require('./evidence/runs/angular2-hn/run-record.json.interventions.json');const c=i.interventionCount??i.count;if(c!==0)throw new Error('interventions '+c);console.log('INTERVENTIONS-0')"
npm run trust:verify -- --offline
node --experimental-strip-types packages/cli/src/cli.ts report:coverage --offline --verify-only
node --experimental-strip-types packages/cli/src/cli.ts refusal-census --verify-only --json 2>/dev/null | node -e "let b='';process.stdin.on('data',d=>b+=d);process.stdin.on('end',()=>{const d=JSON.parse(b);if(!d.matchesPublished)throw new Error('census drifted');console.log('CENSUS-OK sites='+d.census.summary.sites)})"
node -e "const r=require('./evidence/trust/current/coverage-report.json').totals;if(r.proven!==11)throw new Error('proven moved: '+r.proven);console.log('PROVEN-HONESTLY-11')"
node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline 2>&1 | grep -q "react: 6 counted of 6" && echo REACT-CELLS-UNCHANGED
node -e "const f=require('./evidence/trust/current/adapter-freeze.json');if(!String(f.freeze.composite).startsWith('140ce86e'))throw new Error('composite moved');console.log('COMPOSITE-STABLE')"
git diff --quiet HEAD -- packages && echo NO-SOURCE-CHANGES
grep -q 'T046-u6\|§13\|## 13' docs/goals/bank-demo-fleet-pipeline/notes/T012-angular-batch.md && echo NOTE-APPENDED
```

## Blocked permission

If the record-discovery mechanism cannot keep the historical record without double-counting, if the run needs a human hand, or if the build row cannot honestly carry the provisioned runtime block, return status "blocked" with the question in open_questions instead of improvising.
