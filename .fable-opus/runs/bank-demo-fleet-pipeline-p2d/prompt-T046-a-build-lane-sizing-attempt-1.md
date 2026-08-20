Fable-Opus-Unit: bank-demo-fleet-pipeline-p2d/T046-a-build-lane-sizing
Fable-Opus-Timeout-Minutes: 25

## Goal

READ-ONLY sizing of T046: what it takes for `versionless run` to carry an Angular application through its OWN builder at the build stage. T043-b measured the wall: `angular2-hn` at 7/9, `build.configuration-absent` — apply composes no Vite config for the Angular lineage by design, the build stage accepts only a Vite lane, and NO Angular app has ever crossed the run command's build stage (all sealed Angular proofs came via fixture receipts). Every Angular app that clears install lands on this wall, so this seam is what stands between the 13-cell work and the first run-record-proven Angular application.

Produce ONE file: `docs/goals/bank-demo-fleet-pipeline/notes/T046-angular-build-lane.md`, with file:line evidence for every claim (the T010a sizing note is the house standard — match its discipline).

Questions the note must answer:

1. **The build stage contract today.** Where the build stage lives (run.ts stage table names it; find the implementation), exactly what it requires of a lane (the Vite-config check that emits `build.configuration-absent`, its file:line), what it records on success (outputs, digests, into the run record), and what the exit taxonomy is (refusal vs defect at build).
2. **What the applied Angular lane actually contains.** After apply on angular2-hn (its run record and lane are on disk — `evidence/runs/angular2-hn/`, and whatever lane directory the run materialized): the migrated workspace's own build story — `angular.json` builder + configurations, `scripts.build*` post-translation, whether the T009 pigallery2 pattern (`ng build --configuration production`, byte-identical twice) is the honest lane builder for the general Angular lineage.
3. **What witness expects of a built lane.** The witness stage's input contract (dist dir? index.html? served how?) — file:line — and whether an `ng build` output satisfies it as-is or needs the same treatment the T009 witness recipes applied (dist symlink, port, etc.).
4. **Node/toolchain reality.** `ng build` at the 13 cell needs the cell's Node line (16.20.2) and the installed closure's CLI — how the era-cell stage's provisioned runtime is (or is not) available to the build stage today; whether the build stage can execute the lane's own `ng` from `node_modules/.bin` under the provisioned Node without new machinery (the install stage already ran npm there — trace how install invoked its tooling and whether build can reuse that path).
5. **The 16-cell path.** Does the sealed react/Vite build path share code the Angular path would touch? Name what must NOT move (byte-identity, sealed digests) and how the change stays additive (a second lane kind, not a rewrite of the first).
6. **The cut.** Units ≤30 min each, strictly sequenced, with per-unit verify blocks; name which unit produces the first Angular run-record that crosses build (angular2-hn is the candidate — its next wall after build would be witness), and what an honest `build.configuration-absent` successor taxonomy looks like (does the refusal stay for genuinely configless lanes?). Ranked risks, T010a-style.

## File contract

- `docs/goals/bank-demo-fleet-pipeline/notes/T046-angular-build-lane.md`

## Forbidden moves

- Read-only apart from the single note: any other write is a scope violation. Why: sizing precedes movement; the implementation units get their own contracts.
- Do not run `versionless run`/batch or any state-changing pipeline command; reading records, lanes, and source is enough. Why: this unit's product is a map, not new evidence.
- No `git` state commands (stash/checkout/reset/clean).

## Verification

```verify
test -f docs/goals/bank-demo-fleet-pipeline/notes/T046-angular-build-lane.md && wc -l < docs/goals/bank-demo-fleet-pipeline/notes/T046-angular-build-lane.md
git diff --quiet HEAD -- packages evidence && echo NOTHING-TOUCHED
npm run trust:verify -- --offline
```

## Blocked permission

If the lane the angular2-hn run materialized is missing from disk, or if the build stage's architecture makes the sizing questions unanswerable without running the pipeline, return status "blocked" with the question in open_questions instead of improvising.
