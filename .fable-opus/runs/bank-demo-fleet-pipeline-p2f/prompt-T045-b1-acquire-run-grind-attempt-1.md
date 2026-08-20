Fable-Opus-Unit: bank-demo-fleet-pipeline-p2f/T045-b1-acquire-run-grind
Fable-Opus-Timeout-Minutes: 35

## Goal

First unit of board task T045, the acquire→run coverage grind — now running the SHIPPED one-command path end to end: consented acquire through `acquire.ts` (consent VL-LEGACY-CORPUS-2026-08-10, VERSIONLESS_NETWORK_MODE=consented for acquire only), then the single run command with all five install policies available. Two things changed since the last grind: acquire-journaled apps adopt their revision automatically through the four gates (T043-a finding — no --revision hand-carry), and the old walls are now named policies/refusals (foreign-lockfile, git-dependencies, registry-unreachable, allowScripts made true).

Priorities, in order — REACT FIRST because react candidates can reach PROVEN today (the full chain works for the Vite lane; flame is the template), while every Angular candidate stops at the owner-gated frozen build defect:
1. **The staged react apps T043-a enumerated as gate-blocked** (`react-verdaccio-stage-t682`, `react-jaeger-ui-stage-t680`, `react-saleor-dashboard-t670-stage`, `react-appsmith-stage-t685`, `react-strapi-stage-t687` — read `notes/T012-angular-batch.md` §enumeration and T043-a's ledger analysis): re-enter each through consented acquire (their sources are known to the old-goal journals; read `evidence/ingests/<app>/` for the source identity), then run. Smallest-first.
2. **The old six-app react batch's named-refusal apps** (coverview → git-dependencies policy now exists; antd-admin → registry-unreachable is now a named refusal that will simply record honestly): re-acquire + run coverview WITH `--allow-git-dependencies` declared alongside the other policies.
3. If budget remains: one fresh Angular CLI-era candidate acquire→run (it will stop at the frozen build defect — that record still grows the T044 case).

Rules:
- Every run: interventionCount 0 or the run's stop is the finding (Phase-1 regression per the standing card rule → blocked, name the stage).
- T028 proven bar: proven ONLY on 9/9 ran + count 0. Refusals are countable backlog; record every code.
- Acquire failures (source gone, consent mismatch, parity failure) are named outcomes too — record and move to the next candidate. Budget honesty: order smallest-first, finish the app in flight when the clock nears, record the rest as not-attempted-this-unit.
- Append §14 to `notes/T012-angular-batch.md` (the grind's running log despite its name): enumeration, per-app outcome, coverage delta before/after, publish state.
- Publish per the batch ordering when records land (census only if sites move; trust:generate offline; verify).

GUARDS: react 6/6 may only GROW at the matrix level; angular 4/4 verbatim; composite `140ce86e`; proven may only grow (11 is the floor); flame + angular2-hn records untouched; no source changes under packages/.

## File contract

- `evidence/runs/**`
- `evidence/ingests/**`
- `evidence/trust/current/**`
- `docs/goals/bank-demo-fleet-pipeline/notes/T012-angular-batch.md`

## Forbidden moves

- No edits under `packages/**`. Why: coverage evidence comes from the pipeline as committed at d31a906; defects are findings.
- Do not delete or rewrite existing evidence — append/add only; new run records for apps that have them go beside as the current record only if the app genuinely re-ran (rename the old to a dated history name first, the u6 pattern).
- VERSIONLESS_NETWORK_MODE=consented ONLY on acquire; never offline on run/batch; no git commit; no stash/checkout/reset/clean.
- Do not mark proven below the bar. Do not batch Angular candidates beyond one — their wall is owner-gated and one record suffices.

## Verification

```verify
npm run trust:verify -- --offline
npm run receipt:verify
VERSIONLESS_NETWORK_MODE=offline npm run corpus:verify
node --experimental-strip-types packages/cli/src/cli.ts report:coverage --offline --verify-only
node --experimental-strip-types packages/cli/src/cli.ts refusal-census --verify-only --json 2>/dev/null | node -e "let b='';process.stdin.on('data',d=>b+=d);process.stdin.on('end',()=>{const d=JSON.parse(b);if(!d.matchesPublished)throw new Error('census drifted');console.log('CENSUS-OK sites='+d.census.summary.sites)})"
node -e "const r=require('./evidence/trust/current/coverage-report.json').totals;if(r.proven<11)throw new Error('proven regressed: '+r.proven);console.log('PROVEN-FLOOR-HELD proven='+r.proven+' apps='+r.applications)"
node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline 2>&1 | grep -q "angular: 4 counted of 4" && echo ANGULAR-CELLS-STABLE
node -e "const f=require('./evidence/trust/current/adapter-freeze.json');if(!String(f.freeze.composite).startsWith('140ce86e'))throw new Error('composite moved');console.log('COMPOSITE-STABLE')"
git diff --quiet HEAD -- packages && echo NO-SOURCE-CHANGES
git diff --quiet HEAD -- evidence/runs/react-flame-v2-4-0 && echo FLAME-UNTOUCHED
grep -q '§14\|## 14' docs/goals/bank-demo-fleet-pipeline/notes/T012-angular-batch.md && echo NOTE-APPENDED
```

## Blocked permission

If any run needs a human hand, if a source's consent coverage is genuinely unclear (do NOT acquire on an uncertain consent), or if the acquire path itself has a defect the shipped pipeline cannot route around, return status "blocked" with the question in open_questions instead of improvising.