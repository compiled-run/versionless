Fable-Opus-Unit: bank-demo-fleet-pipeline-p2f/T048-lane-tsconfig-composition
Fable-Opus-Timeout-Minutes: 35

## Goal

Board task T048 (read its card in `docs/goals/bank-demo-fleet-pipeline/state.yaml` and `notes/T012-angular-batch.md` §15-16 first): the lane-composition wall T047 named on your-spotify. Measured: with the runtime fixed, the app installed and built at host v24 until Vite failed inside `builtin:vite-transform` with `Tsconfig not found <lane-parent>/tsconfig.json` — Vite resolving the app's TypeScript config one directory ABOVE the lane root. Map before moving: where the react lane composition places the app tree relative to the lane root (`lane.ts` — outside the freeze — and the operator's lane materialization), what the SOURCE tree's tsconfig layout is (your-spotify is a client/server split; the client's tsconfig may extend or sit above), and where Vite's transform resolves tsconfig from. Then make the honest fix: a TypeScript CRA app's tsconfig must TRAVEL WITH the lane the composition builds — whether that means the composition copies/rewrites the tsconfig into the lane root, or the generated Vite config points Vite at the right tsconfig, follow which one the existing composition's design implies (the generated-config approach must not break the single-sourcing rules the T046 sizing protected; read how `composeLaneViteConfig` works before choosing).

Then:
1. Tests: a lane composed from a fixture with the your-spotify tsconfig shape (config above the app dir / extends chain) builds without the Tsconfig-not-found failure; a tsconfig-less JS app's lane unchanged; flame's shape unchanged.
2. THE REPRODUCTION GATES: fresh flame re-run (9/9, count 0, pinned build fields — the sealed shape must not move); your-spotify re-run (u6 preservation pattern on priors). Expected: crosses build; then witness runs — whatever witness honestly returns is the result. If 9/9 + count 0: proven 13→14, publish chain runs, and §17 in the note records the third derivation-proven app of the day.
3. Census: only if a refusal site changed; trust regen offline per the u10 ordering when evidence moved.

GUARDS: proven floor 13; react 6/6 + angular 4/4; composite `140ce86e`; frozen subtrees + trust/src untouched; angular2-hn + coverview + cra-redux records untouched.

## File contract

- `packages/cli/src/**`
- `packages/cli/test/**`
- `evidence/runs/**`
- `evidence/trust/current/**`
- `evidence/runs/operator-flows/refusal-census.json`
- `docs/goals/bank-demo-fleet-pipeline/notes/T012-angular-batch.md`

## Forbidden moves

- Do not touch `packages/frameworks/**`, `packages/core/**`, `packages/trust/src/**`. Why: the lane composition lives in cli; if the fix genuinely needs frozen bytes, stop blocked — it joins T044.
- Do not weaken or special-case the flame path: the fix must be a general composition rule, not an app hack. Why: the next TypeScript CRA app must benefit without a source edit.
- u6 preservation on any re-run; no deletion of evidence; no git commit; no stash/checkout/reset/clean; never offline env on runs.

## Verification

```verify
pnpm exec vp test --project node
node -e "const r=require('./evidence/runs/react-flame-v2-4-0/run-record.json');const ran=(r.stages||[]).filter(s=>s.status==='ran').length;if(ran!==9)throw new Error('flame '+ran);const i=require('./evidence/runs/react-flame-v2-4-0/run-record.json.interventions.json');if((i.interventionCount??i.count)!==0)throw new Error('flame count');const b=(r.stages||[]).find(s=>(s.stage||s.name)==='build');if(!JSON.stringify(b).includes('build-vite'))throw new Error('pinned field moved');console.log('FLAME-GATE-HELD')"
node -e "const r=require('./evidence/runs/react-your-spotify-1-5-0/run-record.json');const rows=r.stages||[];console.log('YOUR-SPOTIFY ran='+rows.filter(s=>s.status==='ran').length+'/9 outcome='+(r.refusal?r.refusal.code:r.outcome))"
npm run trust:verify -- --offline
node --experimental-strip-types packages/cli/src/cli.ts report:coverage --offline --verify-only
node --experimental-strip-types packages/cli/src/cli.ts refusal-census --verify-only --json 2>/dev/null | node -e "let b='';process.stdin.on('data',d=>b+=d);process.stdin.on('end',()=>{const d=JSON.parse(b);if(!d.matchesPublished)throw new Error('census drifted');console.log('CENSUS-OK sites='+d.census.summary.sites)})"
node -e "const r=require('./evidence/trust/current/coverage-report.json').totals;if(r.proven<13)throw new Error('proven regressed: '+r.proven);console.log('PROVEN-FLOOR-HELD proven='+r.proven)"
node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline 2>&1 | grep -q "angular: 4 counted of 4" && echo ANGULAR-CELLS-STABLE
node -e "const f=require('./evidence/trust/current/adapter-freeze.json');if(!String(f.freeze.composite).startsWith('140ce86e'))throw new Error('composite moved');console.log('COMPOSITE-STABLE')"
git diff --quiet HEAD -- packages/frameworks packages/core packages/trust/src && echo FROZEN-TRUST-CORE-UNTOUCHED
git diff --quiet HEAD -- evidence/runs/angular2-hn evidence/runs/react-coverview-a1470b01 evidence/runs/react-cra-redux-1a06509b && echo OTHER-EXHIBITS-UNTOUCHED
```

## Blocked permission

If the tsconfig fix cannot be a general rule without frozen bytes, if Vite's resolution behavior contradicts the mapping this packet assumes, or if the witness stage returns something with no honest named home, return status "blocked" with the question in open_questions instead of improvising.