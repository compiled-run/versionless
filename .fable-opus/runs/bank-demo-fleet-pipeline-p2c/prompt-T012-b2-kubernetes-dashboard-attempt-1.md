Fable-Opus-Unit: bank-demo-fleet-pipeline-p2c/T012-b2-kubernetes-dashboard
Fable-Opus-Timeout-Minutes: 35

## Goal

Second unit of the T012 Angular coverage grind: the run T012-b1 verified but could not afford. `angular-kubernetes-dashboard` (Angular 12.2.9) refused at `ingest.revision-not-determined` (1/9 stages); b1 read revision `e75ebcf688d3b7edff2a050332c8e86ca1e47e12` from the acquisition ledger in the app's own cache directory and VERIFIED it against the staged tree's tarball sha256. Read `docs/goals/bank-demo-fleet-pipeline/notes/T012-angular-batch.md` first — it records the enumeration, the verification, and the exact batch invocation shape b1 used.

What to do:

1. Re-run `angular-kubernetes-dashboard` through the batch runner (batch of one) with `--revision e75ebcf688d3b7edff2a050332c8e86ca1e47e12` declared, the three fleet-wide install policies (--allow-remote-tarballs --allow-install-scripts --allow-peer-conflicts), and the cell declaration b1's enumeration judged era-appropriate for an Angular 12.2.9 app (12 is post-Ivy, pre-13; decide from the era evidence whether the 13 cell is the honest declared target or the default 16 path stands — write ONE sentence in the note justifying the choice from the workspace's own era markers, not preference). Never set VERSIONLESS_NETWORK_MODE=offline on run/batch. This is the heaviest install in the enumeration — start it early; the 35-minute budget exists for exactly this app.
2. interventionCount must be 0. If the run stops, the refusal/defect is the result — record it by name. The T028 proven bar binds: proven ONLY on 9/9 `ran` + count 0.
3. Append the outcome to `notes/T012-angular-batch.md` (do not rewrite b1's sections): stage rows, outcome, refusal code if any, coverage delta before/after.
4. If a new run record landed, publish per the batch --publish ordering so the coverage report reflects it (same chain b1 ran green).

GUARDS: react 6/6 verbatim; angular matrix may only grow from 4/4; composite stays `140ce86e`; census byte-identical (regenerate only if your run legitimately moved it and say so); no source changes under packages/.

## File contract

- `evidence/runs/**`
- `evidence/trust/current/**`
- `docs/goals/bank-demo-fleet-pipeline/notes/T012-angular-batch.md`

## Forbidden moves

- No edits under `packages/**`. Why: coverage evidence comes from the pipeline as shipped; defects are named findings for T043-class units.
- No `git commit`, no `git stash` / `checkout --` / `reset` / `clean`. Why: PM cuts the tranche commit after review.
- Do not delete or rewrite existing evidence — append only. Why: run records and b1's note sections are history.
- Do not mark proven without 9/9 `ran` + interventionCount 0. Why: the coverage report is the oracle surface.

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
grep -q 'T012-b2' docs/goals/bank-demo-fleet-pipeline/notes/T012-angular-batch.md && echo NOTE-APPENDED
```

## Blocked permission

If the batch runner cannot carry the per-batch --revision the way b1's finding described, if the run needs a human hand (Phase-1 regression), or if the install exceeds the budget with the run still honestly progressing (report how far it got and what remains — that is a finding, not a failure), return status "blocked" with the question in open_questions instead of improvising.
