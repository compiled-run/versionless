Fable-Opus-Unit: bank-demo-fleet-pipeline-p2d/T046-u3-outdirectory-reading
Fable-Opus-Timeout-Minutes: 30

## Goal

Phase C unit u3 of T046, per `docs/goals/bank-demo-fleet-pipeline/notes/T046-angular-build-lane.md` §6.1 (read §1, §5 and §6 first): make the build stage's output directory a READING instead of the `LANE_BUILD_DIRECTORY` constant assumption — deliberately alone, so the react-flame reproduction is proven before any Angular branch lands (the next unit adds the second lane kind).

What the sizing mapped (verify against the file, not the note): `build.ts:70-76` gates on `vite.config.ts` in the lane dir; the build record's `outDirectory` comes from the Vite constant; `run.ts:509` passes only the lane dir. This unit:

1. `BuildPlan`/`BuildRecord` keep the `outDirectory` field and type; the Vite branch keeps RETURNING `LANE_BUILD_DIRECTORY` (imported, not duplicated — the sizing warns `lane.ts:486,505` writes it into generated Vite configs, so the value must stay single-sourced). No new refusal, no new lane kind, no behavior change — this is the seam extraction that makes u4 a pure addition.
2. Tests in `packages/cli/test/operator-install-build.test.ts`: the Vite path's plan carries `outDirectory === LANE_BUILD_DIRECTORY` by reference to the constant; the record round-trips it.
3. THE REPRODUCTION GATE: after your change, a fresh `versionless run` on react-flame must reproduce its sealed row values — `outDirectory: "build-vite"`, `outputFiles: 24` — per the sizing §5.2 (those five build fields are the values this refactor is most tempted to disturb). Run it exactly as the T033/T034 flame re-runs did (the fresh-first-invocation harness with the three fleet-wide policies — `notes/T012-angular-batch.md` and the T034 history in `docs/goals/bank-demo-fleet-pipeline/goal.md` describe the invocation; the existing run record's own provenance names the command). If the re-run would OVERWRITE `evidence/runs/react-flame-v2-4-0/run-record.json` with an identical-in-substance record, that is fine (it has regenerated before, in T033); if any of the five pinned build fields moves, STOP blocked — that is the refactor leaking.
4. `build.ts` is census-line-coupled (four entries name lines 52/63/71/147): regenerate `evidence/runs/operator-flows/refusal-census.json` in this unit and verify byte-identity.
5. If the flame re-run regenerates the run record and the coverage report derives from it, run the publish/trust chain as the T012 units did so every surface agrees.

GUARDS: react 6/6 + angular 4/4 verbatim; composite `140ce86e`; coverage totals `{23,11,2,6,4}` unchanged (flame stays proven 9/9, count 0); full suite green.

## File contract

- `packages/cli/src/operator/build.ts`
- `packages/cli/src/operator/record.ts`
- `packages/cli/test/operator-install-build.test.ts`
- `evidence/runs/react-flame-v2-4-0/**`
- `evidence/runs/operator-flows/refusal-census.json`
- `evidence/trust/current/**`

## Forbidden moves

- No Angular branch, no new lane kind, no new refusal — that is u4. Why: this unit exists so the flame reproduction isolates the refactor; two changes make a moved field ambiguous.
- Do not edit `lane.ts` or duplicate `LANE_BUILD_DIRECTORY`'s value anywhere. Why: single-sourcing is what the sizing §5.1 protects.
- Do not touch `packages/frameworks/**`, `packages/core/**`, `packages/trust/src/**`. Why: T044 is owner-gated; the freeze stands at 140ce86e.
- No `git commit`, no stash/checkout/reset/clean. Never set VERSIONLESS_NETWORK_MODE=offline on the flame run.

## Verification

```verify
pnpm exec vp test --project node
node -e "const r=require('./evidence/runs/react-flame-v2-4-0/run-record.json');const b=(r.stages||[]).find(s=>(s.stage||s.name)==='build');const j=JSON.stringify(b);if(!j.includes('build-vite'))throw new Error('outDirectory moved');const rec=b.record||b;if((rec.outputFiles??rec.record?.outputFiles)!==24 && !j.includes('\"outputFiles\":24'))throw new Error('outputFiles moved');console.log('FLAME-BUILD-ROW-REPRODUCED')"
node --experimental-strip-types packages/cli/src/cli.ts refusal-census --verify-only --json 2>/dev/null | node -e "let b='';process.stdin.on('data',d=>b+=d);process.stdin.on('end',()=>{const d=JSON.parse(b);if(!d.matchesPublished)throw new Error('census drifted');console.log('CENSUS-OK sites='+d.census.summary.sites)})"
npm run trust:verify -- --offline
node --experimental-strip-types packages/cli/src/cli.ts report:coverage --offline --verify-only
node -e "const r=require('./evidence/trust/current/coverage-report.json').totals;if(r.proven!==11||r.applications!==23)throw new Error(JSON.stringify(r));console.log('COVERAGE-TOTALS-UNCHANGED')"
node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline 2>&1 | grep -q "react: 6 counted of 6" && echo REACT-CELLS-UNCHANGED
node -e "const f=require('./evidence/trust/current/adapter-freeze.json');if(!String(f.freeze.composite).startsWith('140ce86e'))throw new Error('composite moved');console.log('COMPOSITE-STABLE')"
git diff --quiet HEAD -- packages/frameworks packages/core packages/trust/src && echo FROZEN-TRUST-CORE-UNTOUCHED
```

## Blocked permission

If the flame re-run moves any of the five pinned build fields, if `outDirectory` cannot become a reading without touching `lane.ts`, or if the run needs anything a fresh first invocation would not have, return status "blocked" with the question in open_questions instead of improvising.
