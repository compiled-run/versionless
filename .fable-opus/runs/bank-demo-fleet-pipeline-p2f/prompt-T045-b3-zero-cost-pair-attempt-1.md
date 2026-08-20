Fable-Opus-Unit: bank-demo-fleet-pipeline-p2f/T045-b3-zero-cost-pair
Fable-Opus-Timeout-Minutes: 35

## Goal

Run the two zero-cost RUNNABLE-NOW candidates the T045-b2 screen ranked (read `docs/goals/bank-demo-fleet-pipeline/notes/T045-candidate-screen.md` first — it names trees, sizes, deps, and predicted walls): `react-cra-redux-1a06509b` (440K, smallest first) and `react-your-spotify-1-5-0`. Both carry published `refused: install.lockfile-foreign` rows recorded three days BEFORE `--allow-foreign-lockfile` shipped — their trees are already on disk, consent-clean, no socket needed. Both are clean CRA trees the frozen react adapter claims; the screen's predicted terminal is witness. Each is a live shot at proven 13 and 14.

Per app, smallest first:
1. Run the single command exactly as T045-b1 ran coverview (fresh lane, ALL FIVE install policies declared — foreign-lockfile is the one that matters here — no offline env, `--record` to the app's run-record path). The screen notes your-spotify's client reads without `--frontend-root`; if the run refuses on frontend-root anyway, that divergence from the screen is a finding — record it, do not improvise a declaration that the screen did not justify.
2. T028 bar: proven ONLY on 9/9 ran + count 0. A witness-stage stop is the screen's own predicted risk — record its code verbatim; a named witness refusal is still forward progress (the wall moved from install to witness across three sessions of evidence).
3. Preserve the prior records under the u6/b1 pattern (rename to a dated/tagged history name, keep both).
4. Append §15 to `notes/T012-angular-batch.md`: per-app stage tables, outcomes, coverage delta before/after, and one line on whether the screen's predictions held.
5. Publish per the ordering (census only if sites move; trust:generate offline env with --policy/--output; verify chain).

GUARDS: proven floor 12 (may only grow); react 6/6 at matrix level may only grow; angular 4/4 verbatim; composite `140ce86e`; flame/coverview/angular2-hn records untouched; no source changes under packages/.

## File contract

- `evidence/runs/**`
- `evidence/trust/current/**`
- `docs/goals/bank-demo-fleet-pipeline/notes/T012-angular-batch.md`

## Forbidden moves

- No edits under `packages/**`; no network (both trees are on disk — an unexpected network reach during install beyond the allowed remote-tarball policy path is a finding to record).
- Do not delete or rewrite existing evidence — the u6 preservation pattern binds.
- Do not mark proven below the bar; no stash/checkout/reset/clean; no git commit; never offline env on the runs.

## Verification

```verify
npm run trust:verify -- --offline
npm run receipt:verify
VERSIONLESS_NETWORK_MODE=offline npm run corpus:verify
node --experimental-strip-types packages/cli/src/cli.ts report:coverage --offline --verify-only
node --experimental-strip-types packages/cli/src/cli.ts refusal-census --verify-only --json 2>/dev/null | node -e "let b='';process.stdin.on('data',d=>b+=d);process.stdin.on('end',()=>{const d=JSON.parse(b);if(!d.matchesPublished)throw new Error('census drifted');console.log('CENSUS-OK sites='+d.census.summary.sites)})"
node -e "const r=require('./evidence/trust/current/coverage-report.json').totals;if(r.proven<12)throw new Error('proven regressed: '+r.proven);console.log('PROVEN-FLOOR-HELD proven='+r.proven+' apps='+r.applications)"
node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline 2>&1 | grep -q "angular: 4 counted of 4" && echo ANGULAR-CELLS-STABLE
node -e "const f=require('./evidence/trust/current/adapter-freeze.json');if(!String(f.freeze.composite).startsWith('140ce86e'))throw new Error('composite moved');console.log('COMPOSITE-STABLE')"
git diff --quiet HEAD -- packages && echo NO-SOURCE-CHANGES
git diff --quiet HEAD -- evidence/runs/react-flame-v2-4-0 evidence/runs/react-coverview-a1470b01 evidence/runs/angular2-hn && echo EXHIBITS-UNTOUCHED
grep -q '§15\|## 15' docs/goals/bank-demo-fleet-pipeline/notes/T012-angular-batch.md && echo NOTE-APPENDED
```

## Blocked permission

If either run needs a human hand, if a run's behavior diverges from the screen in a way that suggests the screen's reading method is wrong (not just one app's surprise), or if the witness stage hits something with no honest named home, return status "blocked" with the question in open_questions instead of improvising.