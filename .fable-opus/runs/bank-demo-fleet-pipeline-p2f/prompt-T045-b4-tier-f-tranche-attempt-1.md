Fable-Opus-Unit: bank-demo-fleet-pipeline-p2f/T045-b4-tier-f-tranche
Fable-Opus-Timeout-Minutes: 35

## Goal

The T045 grind's tier-F tranche: the five MIT, consent-clean candidates the T045-b2 screen filed (read `docs/goals/bank-demo-fleet-pipeline/notes/T045-candidate-screen.md` — it names each tree/tarball location, size, manifest reading, and predicted wall): `angular-fuxa`, `angular-contacts`, `react-dashboard`, `react-avataaars`, `next-tailwind-starter-blog`. All five are on disk or acquirable under the corpus grant as worded; the pipeline as committed at 59915a2 carries every fix of the day (five install policies, target-runtime semantics, lane tsconfig flattening).

Priorities:
1. **`angular-fuxa` FIRST — it answers a standing strategic question.** The screen read `@angular/core ^14.2.12` at its pin: post-Ivy, so its run takes the DEFAULT 16-cell path, where the frozen polyfills/target rewrites are correct-by-design. It is therefore the cheapest test of whether the Angular build wall is 13-cell-specific or lane-wide — and a potential FIRST Angular application to cross the run command's build stage without waiting on T044. Run it and record exactly where truth stops it (`--frontend-root` per the screen's reading if its layout needs one and the screen justifies it).
2. **`react-dashboard`** — the screen's UNKNOWN: take the missing reading FIRST (does `app/vite.config.*` exist at the pin — read it from the tarball/tree on disk), record it in the note, THEN run only if the reading says the run is meaningful; a predicted `plan.react.no-frozen-adapter-claims-this-tree` refusal is still a countable outcome worth one run.
3. **`react-avataaars`, `next-tailwind-starter-blog`, `angular-contacts`** — smallest-first with the remaining budget; each outcome recorded (angular-contacts is Angular 9 → 13-cell declaration per era → will terminate at the owner-gated frozen defect; that record still grows the T044 case; run it LAST).

Rules: the standing grind discipline — staged/tarball trees may need consented acquire→staging through the shipped path if their current form is not runnable (the screen says which; consent only where the screen marked consent-clean, VERSIONLESS_NETWORK_MODE=consented on acquire only); interventionCount 0 everywhere; T028 bar for proven; u6 preservation on any re-run app; budget honesty with not-attempted rows; §18 appended to `notes/T012-angular-batch.md`; publish per the ordering when records land.

GUARDS: proven floor 14; react 6/6 + angular 4/4 at matrix level (may only grow); composite `140ce86e`; today's proven exhibits untouched; no source changes under packages/.

## File contract

- `evidence/runs/**`
- `evidence/ingests/**`
- `evidence/trust/current/**`
- `docs/goals/bank-demo-fleet-pipeline/notes/T012-angular-batch.md`

## Forbidden moves

- No edits under `packages/**`. Why: coverage evidence from the pipeline as committed; defects are findings.
- No acquire outside the screen's consent-clean markings. Why: owner ruling 3 is pending; the screen is the boundary.
- No deletion/rewrite of evidence; no git commit; no stash/checkout/reset/clean; never offline env on runs.
- Do not mark proven below the bar; do not run more than ONE 13-cell-terminating Angular candidate (angular-contacts) — the frozen wall needs no third measurement.

## Verification

```verify
npm run trust:verify -- --offline
npm run receipt:verify
VERSIONLESS_NETWORK_MODE=offline npm run corpus:verify
node --experimental-strip-types packages/cli/src/cli.ts report:coverage --offline --verify-only
node --experimental-strip-types packages/cli/src/cli.ts refusal-census --verify-only --json 2>/dev/null | node -e "let b='';process.stdin.on('data',d=>b+=d);process.stdin.on('end',()=>{const d=JSON.parse(b);if(!d.matchesPublished)throw new Error('census drifted');console.log('CENSUS-OK sites='+d.census.summary.sites)})"
node -e "const r=require('./evidence/trust/current/coverage-report.json').totals;if(r.proven<14)throw new Error('proven regressed: '+r.proven);console.log('PROVEN-FLOOR-HELD proven='+r.proven+' apps='+r.applications)"
node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline 2>&1 | grep -q "react: 6 counted of 6" && echo REACT-CELLS-BASELINE-HELD
node -e "const f=require('./evidence/trust/current/adapter-freeze.json');if(!String(f.freeze.composite).startsWith('140ce86e'))throw new Error('composite moved');console.log('COMPOSITE-STABLE')"
git diff --quiet HEAD -- packages && echo NO-SOURCE-CHANGES
git diff --quiet HEAD -- evidence/runs/react-flame-v2-4-0 evidence/runs/react-coverview-a1470b01 evidence/runs/react-cra-redux-1a06509b evidence/runs/react-your-spotify-1-5-0 && echo PROVEN-EXHIBITS-UNTOUCHED
grep -q '§18\|## 18' docs/goals/bank-demo-fleet-pipeline/notes/T012-angular-batch.md && echo NOTE-APPENDED
```

## Blocked permission

If any run needs a human hand, if a tier-F tree's staging genuinely requires consent the screen did not establish, or if fuxa's outcome contradicts the screen's post-Ivy reading in a way that questions the screen's method, return status "blocked" with the question in open_questions instead of improvising.