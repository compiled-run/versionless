Fable-Opus-Unit: bank-demo-fleet-pipeline-p2d/T046-u4-angular-lane-kind
Fable-Opus-Timeout-Minutes: 35

## Goal

Phase C unit u4 of T046, per `docs/goals/bank-demo-fleet-pipeline/notes/T046-angular-build-lane.md` §6.1-§6.2 (read §1, §5, §6.2 first; u3 just landed at commit 916b6d5 — read its `viteLaneOutDirectory` extraction in `build.ts` before designing): the SECOND lane kind. `planLaneBuild` gains an Angular branch so the build stage can plan an Angular lane's build honestly instead of refusing every non-Vite lane as `build.configuration-absent`.

What to build:

1. **Lane-kind dispatch.** `planLaneBuild` (or the honest seam above it — follow how `record.ts`'s `composeLane` dispatches `react` vs `angular` per sizing §5.1) recognizes an Angular lane: `angular.json` present at the lane root. The Vite branch (u3's `viteLaneOutDirectory`) is UNTOUCHED on the Vite path.
2. **The Angular branch**: read `angular.json`, resolve the project's `build` target (single-project workspaces are today's population — if multiple projects declare `build` targets, that is a named refusal, not a guess), take `options.outputPath` as the `outDirectory` reading, and keep `npm run <script>` as the command exactly as the Vite branch does (the sizing §3/§6.1: the honest builder is the application's own script — find the script that invokes `ng build`, per the green eshop precedent; if no package.json script invokes ng build, named refusal).
3. **Successor taxonomy per sizing §6.2**: `build.configuration-absent` SURVIVES, narrowed to the Vite lane (its message may say so); genuinely unrecognizable lanes (neither vite.config.ts nor angular.json) get the new honest refusal (the sizing proposes `build.lane-kind-unrecognised` — verify that name against §6.2 and use the note's exact taxonomy). New refusals for the Angular branch's own failure modes (no build target, ambiguous project, no ng-invoking script, outputPath absent) — each named, each following the house refusal conventions in the operator.
4. **Tests** (`operator-install-build.test.ts`): Angular lane fixture planned (outputPath read, script command); Vite path unchanged (u3's tests keep passing unedited); each new refusal; the unrecognizable-lane refusal.
5. **Census**: `build.ts` sites shift and NEW sites appear (`byStage.build` grows from 5 by your new refusal count) — regenerate `evidence/runs/operator-flows/refusal-census.json` in this unit; the u4 verify asserts the new declared value.
6. NO runtime threading (u5) and NO end-to-end Angular run (u6) — planning and unit tests only. The angular2-hn lane on disk may be used READ-ONLY as a fixture source if helpful, but the run itself is u6's.

GUARDS: flame's sealed row must be untouched by construction (Vite path unedited) — the verify re-asserts the record on disk rather than re-running; coverage totals `{23,11,2,6,4}`; composite `140ce86e`; react 6/6 + angular 4/4; frozen subtrees untouched.

## File contract

- `packages/cli/src/operator/build.ts`
- `packages/cli/src/operator/record.ts`
- `packages/cli/test/operator-install-build.test.ts`
- `evidence/runs/operator-flows/refusal-census.json`

## Forbidden moves

- Do not edit `lane.ts`, u3's Vite branch behavior, or any refusal string on the Vite path (narrowing `build.configuration-absent`'s message to name the Vite lane is the ONE permitted message change, only if §6.2 says so). Why: the sealed flame row and u3's reproduction proof are the ground the Angular branch stands on.
- Do not touch `packages/frameworks/**`, `packages/core/**`, `packages/trust/src/**`, or any `evidence/runs/<app>/` record. Why: T044 is owner-gated; run records are u6's.
- No `git commit`, no stash/checkout/reset/clean, no VERSIONLESS_NETWORK_MODE.

## Verification

```verify
pnpm exec vp test --project node
node --experimental-strip-types packages/cli/src/cli.ts refusal-census --verify-only --json 2>/dev/null | node -e "let b='';process.stdin.on('data',d=>b+=d);process.stdin.on('end',()=>{const d=JSON.parse(b);if(!d.matchesPublished)throw new Error('census drifted');console.log('CENSUS-OK sites='+d.census.summary.sites+' build='+d.census.summary.byStage.build)})"
node -e "const r=require('./evidence/runs/react-flame-v2-4-0/run-record.json');const b=(r.stages||[]).find(s=>(s.stage||s.name)==='build');if(!JSON.stringify(b).includes('build-vite'))throw new Error('flame row disturbed');console.log('FLAME-ROW-UNTOUCHED')"
npm run trust:verify -- --offline
node -e "const r=require('./evidence/trust/current/coverage-report.json').totals;if(r.proven!==11||r.applications!==23)throw new Error(JSON.stringify(r));console.log('COVERAGE-TOTALS-UNCHANGED')"
node -e "const f=require('./evidence/trust/current/adapter-freeze.json');if(!String(f.freeze.composite).startsWith('140ce86e'))throw new Error('composite moved');console.log('COMPOSITE-STABLE')"
git diff --quiet HEAD -- packages/frameworks packages/core packages/trust/src && echo FROZEN-TRUST-CORE-UNTOUCHED
```

## Blocked permission

If the lane-kind dispatch cannot live in build.ts/record.ts without touching lane.ts, if the note's §6.2 taxonomy conflicts with what the code allows, or if the Angular branch needs a reading (workspace shape, script discovery) whose honest source is ambiguous, return status "blocked" with the question in open_questions instead of improvising.
