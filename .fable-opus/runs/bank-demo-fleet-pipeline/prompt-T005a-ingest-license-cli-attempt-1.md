Fable-Opus-Unit: bank-demo-fleet-pipeline/T005a-ingest-license-cli
Fable-Opus-Timeout-Minutes: 30

## Goal

Make `ingest` and `license-at-pin` operator stages that admit an application the pipeline has never seen, with no per-app source file, and lift the two hardcoded allowlists that currently gate admission.

Context. The owner outcome is `versionless migrate <app>` running unattended to a coverage report — nobody hand-authors files. Today ingest is one TypeScript module per application: `packages/cli/src/fixture/` holds 34 `*-ingest.ts` files (e.g. `react-papercups-*`, `angular-fuxa-*`), and `packages/cli/src/fixture/legacy-candidate-ingest.ts:63` exports `legacyCandidates` with exactly one entry, while `packages/cli/src/cli.ts:73-81` carries a second hardcoded allowlist. An unseen app cannot be admitted without editing source. That edit is a human intervention inside the run this goal has to prove intervention-free.

Read first, in this order: `docs/goals/bank-demo-fleet-pipeline/notes/T001-plan-validation.md` (the ruling — sections on acquisition and manual steps), then `packages/cli/src/fixture/ingest.ts` (the shared ingest primitives), then three representative per-app ingest modules of your choosing (one React CRA, one Angular, one that binds a source with a license) to extract the generic shape and the per-app delta, then `packages/cli/src/operator/flows.ts` (`OPERATOR_COMMANDS` at :45; the pattern T004 established for `install`/`build` stages, declared policies with refusing defaults, and the `PipelineRefusal` type in `packages/cli/src/operator/refusals.ts`).

Deliver:

1. An `ingest` operator stage in `packages/cli/src/operator/` that takes an application source (local path at minimum; a pinned git ref if the existing ingest primitives already support it) plus the values the 34 modules vary on, as CLI flags or inferred from the tree — and produces the same ingest record shape the per-app modules produce today. Anything the generic stage cannot infer for a given app is a named `PipelineRefusal` (origin `pipeline`, stage `ingest`), never a guessed default.
2. A `license-at-pin` stage, or a license step inside `ingest` if that is the shape the primitives already have, that records the license observed at the pinned source and refuses (named, exit 2) when it cannot be determined — following the declared-policy-with-refusing-default shape T004 set for the three npm policies.
3. `legacyCandidates` and the `cli.ts:73-81` allowlist stop gating admission. Preserve them if existing tests or evidence read them, but admission must not require an entry. Record which existing behaviours still consult them, if any.
4. Both stages exposed through `runOperatorCommand` with `--json`, exit 2 refusal / 1 defect / 0 proceeded, and wired into `migrate` behind the same declared-flag pattern as `--install`/`--build` (T004 made those opt-in so the exit-0 verify path needs no registry; do the same).
5. Tests: `packages/cli/test/operator-ingest.test.ts` proving that at least one application from the existing 34 ingests through the generic stage to a record equivalent to its hand-written module's record, and that an application missing an inferable value refuses with a named code rather than proceeding.

Do NOT rewrite the 34 per-app ingest modules. This unit is the generic path beside them; retiring them is a later decision, and their committed evidence is sealed. Do NOT touch era-cell provisioning; that is the next unit (T005b).

## File contract

- `packages/cli/src/operator/**`
- `packages/cli/src/fixture/legacy-candidate-ingest.ts`
- `packages/cli/src/cli.ts`
- `packages/cli/test/operator-ingest.test.ts`
- `packages/cli/test/operator-flows.test.ts`
- `evidence/runs/operator-flows/**`

## Forbidden moves

- Do not write anywhere inside `packages/frameworks/react`, `packages/frameworks/angular`, `packages/core/src/migrations`, `packages/core/src/bundlers`, or `packages/core/src/analysis`. Why: those are the five sealed subtrees under freeze `27741d9c`; a write there is freeze motion, which this tranche only authorises once, later, on a separate isolated unit.
- Do not edit or delete any of the 34 existing `packages/cli/src/fixture/*-ingest.ts` modules, or `packages/cli/src/fixture/ingest.ts`. Why: their committed evidence under `evidence/ingests/` is sealed and byte-verified; changing a producer invalidates a receipt.
- Do not invent a second refusal vocabulary. Use `PipelineRefusal` from `packages/cli/src/operator/refusals.ts` and add codes to the census producer if the census test requires it. Why: refusals must stay countable through one surface.
- Do not restate a bounded claim more generally in code, output, comments, or evidence. Why: this repo's coverage claims are deliberately bounded and derivation-guarded.
- Do not run `vp fmt` repo-wide or leave its reformatting in the diff. Why: it touches 249 pre-existing files (the format epoch, a separate later unit).

## Verification

```verify
npm run lint
npm test
npm run trust:verify -- --offline
npm run receipt:verify
git diff --quiet HEAD -- packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis && echo FREEZE-INTACT
git diff --quiet HEAD -- packages/cli/src/fixture/ingest.ts && echo INGEST-PRIMITIVES-UNTOUCHED
```

`npm test` takes ~150s; the green baseline after T004 is 2527/2527. `npm run trust:verify` WITHOUT `-- --offline` fails by design.

## Blocked permission

If evidence is missing, the contract conflicts with reality, or you need a file outside the contract, return status "blocked" with the question in open_questions instead of improvising. Specifically block, do not improvise, if: the ingest primitives cannot admit an app without a source edit and closing that gap needs a file outside the contract; a value the 34 modules vary on cannot be inferred and has no honest refusing default; or making this work needs the sealed subtrees.