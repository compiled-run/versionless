Fable-Opus-Unit: bank-demo-fleet-pipeline-p2e/T046-u5b-runtime-on-defect-rows
Fable-Opus-Timeout-Minutes: 30

## Goal

Close the gap T046-u6 measured (commit f670f79): the u5 runtime block is recorded on install/build rows ONLY on the success path — `runLaneBuild` composes its `BuildRecord` (including `runtime: await readLaneRuntime(...)`) after the child exits 0; a non-zero build throws, and `runStage` (`run.ts:302-360`) pushes a defect row carrying only name/status/reason/startedAt/endedAt. So the exact runs where the runtime matters MOST for diagnosis — failing builds, the sizing §4.2 trap where a Node-mismatch failure names neither Node nor the cell — are the runs that lose it. angular2-hn's build defect row (`evidence/runs/angular2-hn/run-record.json`) is the measured example: its install row carries the full provisioned block, its build row carries nothing.

What to build:

1. The runtime reading must reach the record even when the stage's command fails. Look at how `runLaneBuild`/`runLaneInstall` throw and what `runStage` catches: the honest shape is that the failure object (or the stage runner's catch path) carries the already-planned runtime so the defect row records `runtime` alongside its five fields — the same `LaneRuntime` shape as success rows, measured the same way (`readLaneRuntime` through the child's environment; if measuring after a failed child is unreliable, record the PLAN's fields — source/cellSupplier/cellVersion/pathPrefix — with `resolvedVersion: null` and a field or claim string saying the measurement did not complete; never fabricate a resolved version). Install and build both get this; apply the same treatment to any other stage that took the runtime plan.
2. Tests: a failing build under a provisioned runtime produces a defect row WITH the runtime block (shim-node approach from u5's tests); a failing build under host runtime records host; success rows unchanged.
3. Census: relines only expected (no new refusal). If counts move, trust regen with the u10 ordering.
4. Do NOT re-run angular2-hn — its current record is the sealed T044 exhibit and the re-run belongs to the post-authorization world. The flame reproduction gate is also NOT required here (this unit adds fields to failure paths only; the success path must be byte-identical by construction — the tests prove it instead: assert the success-path BuildRecord composition is untouched).

GUARDS: full suite; census byte-identity; trust valid; coverage totals `{23,11,2,5,5}` unchanged; composite `140ce86e`; frozen subtrees untouched; the angular2-hn and flame records on disk UNTOUCHED by this unit.

## File contract

- `packages/cli/src/operator/run.ts`
- `packages/cli/src/operator/build.ts`
- `packages/cli/src/operator/install.ts`
- `packages/cli/test/operator-install-build.test.ts`
- `packages/cli/test/operator-flows.test.ts`
- `evidence/runs/operator-flows/refusal-census.json`
- `evidence/trust/current/**`

## Forbidden moves

- Do not touch any run record under `evidence/runs/<app>/`. Why: u6's record is the T044 exhibit as-measured; this unit changes what FUTURE records carry.
- Do not change success-path record composition. Why: flame's sealed row shape is the ground truth every operator change is measured against.
- Do not touch `packages/frameworks/**`, `packages/core/**`, `packages/trust/src/**`. No git commit, no stash/checkout/reset/clean.

## Verification

```verify
pnpm exec vp test --project node
node --experimental-strip-types packages/cli/src/cli.ts refusal-census --verify-only --json 2>/dev/null | node -e "let b='';process.stdin.on('data',d=>b+=d);process.stdin.on('end',()=>{const d=JSON.parse(b);if(!d.matchesPublished)throw new Error('census drifted');console.log('CENSUS-OK sites='+d.census.summary.sites)})"
npm run trust:verify -- --offline
node -e "const r=require('./evidence/trust/current/coverage-report.json').totals;if(r.proven!==11||r.applications!==23)throw new Error(JSON.stringify(r));console.log('COVERAGE-TOTALS-UNCHANGED')"
git diff --quiet HEAD -- evidence/runs/angular2-hn evidence/runs/react-flame-v2-4-0 && echo EXHIBIT-RECORDS-UNTOUCHED
node -e "const f=require('./evidence/trust/current/adapter-freeze.json');if(!String(f.freeze.composite).startsWith('140ce86e'))throw new Error('composite moved');console.log('COMPOSITE-STABLE')"
git diff --quiet HEAD -- packages/frameworks packages/core packages/trust/src && echo FROZEN-TRUST-CORE-UNTOUCHED
```

## Blocked permission

If the throw/catch shape cannot carry the runtime without redesigning the stage runner's error taxonomy, or if any stage's failure path cannot distinguish measured-vs-planned runtime honestly, return status "blocked" with the question in open_questions instead of improvising.
