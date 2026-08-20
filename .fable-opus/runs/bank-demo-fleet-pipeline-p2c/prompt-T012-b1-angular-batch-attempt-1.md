Fable-Opus-Unit: bank-demo-fleet-pipeline-p2c/T012-b1-angular-batch
Fable-Opus-Timeout-Minutes: 35

## Goal

First unit of T012, the Angular coverage grind: put real Angular applications through the single command against the NEWLY PUBLISHED angular-13.4.0 cell and the existing 16 cell, and record each outcome as newly proven or a NAMED refusal. The 13 cell just became plannable (supersession commit e9a626d; composite 140ce86e); this unit is the first coverage evidence that buys anything with it.

Read first: `docs/goals/bank-demo-fleet-pipeline/goal.md` (T042 verdict + standing forbidden moves), `packages/cli/src/operator/batch.ts` (the T007/T021 batch runner and its --publish ordering), and `notes/T027-react-batch-ruling.md` (the react batch's discipline — mirror it).

What to do:

1. **Enumerate candidates.** Find what the batch infrastructure already knows: batch manifests/config, the acquired corpus under `.versionless/cache/` (consent VL-LEGACY-CORPUS-2026-08-10 for any acquire), and the refusal census's not-admitted rows. List every Angular candidate with its era (AngularJS-era apps are NOT candidates; Angular-CLI-era apps are). Record the enumeration in the note BEFORE running anything.
2. **Run the batch** over the candidates with the batch runner exactly as T021 sequenced it (--publish ordering; the three fleet-wide install policies forwarded as the flame re-run used them: --allow-remote-tarballs --allow-install-scripts --allow-peer-conflicts). Never set VERSIONLESS_NETWORK_MODE=offline on run/batch (standing rule). Where a candidate's era suggests the 13 cell (pre-Ivy era apps), declare `--cell angular-13.4.0`; otherwise let the default 16 path stand. interventionCount must be 0 on every run — if any app needs a human hand, that is a Phase-1 regression: STOP and report it as blocked (card stop_if).
3. **Budget honesty.** You have 35 minutes of wall clock. Order candidates smallest-first if measurable. When the budget nears, finish the app in flight, and record every unstarted candidate as `not-attempted-this-unit` in the note — a later unit continues; nothing is guessed.
4. **Record.** Write `docs/goals/bank-demo-fleet-pipeline/notes/T012-angular-batch.md`: the enumeration, per-app outcome (proven with 9 stages ran / bounded / refused with the EXACT refusal code / defect / not-attempted), the run-record paths, and the coverage delta (proven count before/after from the published coverage report). Every refusal string is coverage backlog, named and countable — that is the product, not noise.
5. **Publish.** If any run produced a new run record, follow the batch --publish ordering so `evidence/trust/current/coverage-report.json` reflects it (build → trust regen → verify, as batch.ts sequences; if you must run it manually: vp pack only if dist stale AND trust must regenerate, then trust:generate offline env, then census/coverage verify). The T028 proven bar binds: proven ONLY if all 9 stages `ran` and interventionCount 0.

GUARDS: react 6/6 must reproduce verbatim; the angular matrix line may only GROW (4/4 baseline); coverage totals may move only by what your run records prove/refuse — state before/after in the note; freeze composite in adapter-freeze.json stays 140ce86e; NO source changes under packages/ (a batch unit runs the pipeline, it does not edit it — if the pipeline is wrong, that is a blocked finding for a properly-cut unit).

## File contract

- `evidence/runs/**`
- `evidence/trust/current/**`
- `docs/goals/bank-demo-fleet-pipeline/notes/T012-angular-batch.md`

## Forbidden moves

- No edits under `packages/**`. Why: coverage evidence must come from the pipeline as shipped; a defect found is a named finding, not a hotfix.
- No `git commit`, no `git stash` / `checkout --` / `reset` / `clean`. Why: PM cuts the tranche commit after review.
- Do not mark any app proven without 9/9 stages `ran` and interventionCount 0 (T028 bar). Why: the coverage report is the oracle surface; one flattered row poisons it.
- Do not delete or rewrite existing evidence under `evidence/runs/` — only add. Why: run records are history.

## Verification

```verify
npm run trust:verify -- --offline
npm run receipt:verify
VERSIONLESS_NETWORK_MODE=offline npm run corpus:verify
node --experimental-strip-types packages/cli/src/cli.ts report:coverage --offline --verify-only
node --experimental-strip-types packages/cli/src/cli.ts refusal-census --verify-only --json 2>/dev/null | node -e "let b='';process.stdin.on('data',d=>b+=d);process.stdin.on('end',()=>{const d=JSON.parse(b);if(!d.matchesPublished)throw new Error('census drifted');console.log('CENSUS-OK sites='+d.census.summary.sites)})"
node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline 2>&1 | grep -q "react: 6 counted of 6" && echo REACT-CELLS-UNCHANGED
node -e "const f=require('./evidence/trust/current/adapter-freeze.json');if(!String(f.freeze.composite).startsWith('140ce86e'))throw new Error('composite moved');console.log('COMPOSITE-STABLE-140ce86e')"
git diff --quiet HEAD -- packages && echo NO-SOURCE-CHANGES-IN-BATCH-TASK
test -f docs/goals/bank-demo-fleet-pipeline/notes/T012-angular-batch.md && echo NOTE-EXISTS
```

## Blocked permission

If any run needs a human intervention (Phase-1 regression per the card), if the batch runner cannot express something this packet assumes (a per-app cell declaration, the publish ordering), if a candidate needs an acquire decision the consent does not obviously cover, or if a pipeline defect blocks a run, return status "blocked" with the question in open_questions instead of improvising.
