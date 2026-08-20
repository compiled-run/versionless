Fable-Opus-Unit: bank-demo-fleet-pipeline/T014-intervention-count-harness
Fable-Opus-Timeout-Minutes: 30

## Goal

Build the human-intervention-count harness that makes the zero-manual-steps gate objective: an external harness that snapshots, spawns `versionless run` **exactly once**, re-snapshots, and writes a `versionless.intervention-count.v1` record with four mechanically observed counters. The gate passes only when all four are zero — and a zero must be a positive assertion the harness makes, never the absence of evidence.

Why. The owner outcome is one unattended command; the oracle requires "a recorded human-intervention count of zero on an unseen app". `run` exists (T007), the coverage report exists (T015) and already encodes "an app is proven only if its run record carries `interventions.count === 0`" — but nothing emits that count yet. This unit emits it. Rule from the spec: **the gate must not be scored by the thing under test** — the harness is a separate process that wraps `run`; `run` does not count its own interventions.

The specification is `docs/goals/bank-demo-fleet-pipeline/notes/T001-plan-validation.md` §4 (lines 216-270). Read it first and implement it as written. It is quoted here so you can start immediately:

> An **intervention** is any act, between invocation and terminal exit, that (a) changes bytes on disk outside the command's own declared write set, (b) supplies an input the command did not obtain itself, or (c) is required for the command to proceed.
>
> **C1 — Worktree mutation outside the declared write set.** Snapshot sha256 for every tracked path in the checkout, the app root, and the lane parent, before and after. The command declares its write set: `--out <lane>`, `--record <file>`, and the `evidence/**` paths it names. Any changed or created path outside that set counts one intervention and is named. Reuse `sha256` from `packages/core/src/receipts/canonicalize.ts`.
>
> **C2 — Prompt / stdin reads.** Spawn with `stdio: ['ignore', 'pipe', 'pipe']` and `CI=1`. Any stdin read fails by construction. A block with no stdout for longer than the stage budget is a **hang**, which the charter classifies as a defect, not a refusal — score it `defect:hang`, not as an intervention.
>
> **C3 — Invocations.** Exactly one process spawn is permitted; the record carries `invocations: 1`. Any second command — including a retry with different flags — counts one intervention per retry.
>
> **C4 — Authoring-home writes.** Snapshot the eight homes before and after: `fixtures/**`, `packages/cli/src/fixture/**`, `packages/cli/src/witness/**`, `packages/core/src/receipts/witness-*.ts`, `packages/core/src/receipts/capability-coverage.ts`, `packages/core/src/corpus/conformance.ts`, `packages/trust/src/generate.ts`, `packages/cli/src/fixture/legacy-candidate-ingest.ts`, and `.versionless/work/**/*.{mjs,sh}`. Any create or modify counts one intervention per file, named. This is the counter aimed squarely at the silent-manual-residue misfire.
>
> **Record.** Schema `versionless.intervention-count.v1`: `invocations`, `stdinReads`, `mutatedPathsOutsideWriteSet[]`, `authoringPathsTouched[]`, `interventionCount` (the sum), `exitCode`, `terminalClassification` ∈ {`proven`, `refused:<code>`, `defect:<kind>`}. Judge verification = re-run the harness in a clean checkout, compare `interventionCount` and `terminalClassification`.
>
> **Explicitly NOT interventions:** machine time; the command's own writes into its declared lane/record/evidence paths; network fetches under a recorded consent id; a refusal exit.

Read after the spec, briefly: `packages/cli/src/operator/run.ts` (the seam `runStage`, the `versionless.run.v1` record, and how `--record` and `--out` are declared — the write set comes from these), and `packages/core/src/receipts/canonicalize.ts` (`sha256`).

Deliver:

1. **`packages/cli/src/operator/intervention-count.ts`** — the harness. `versionless intervention-count <app-root> --out <lane> [--record <file>] [-- <run flags…>]`: snapshot (C1 over tracked paths + app root + lane parent; C4 over the eight homes), spawn `run` exactly once with `stdio: ['ignore','pipe','pipe']` and `CI=1`, enforce the stage-budget hang → `defect:hang`, re-snapshot, diff, write the record. `terminalClassification` is read from `run`'s own record (`proven` when exit 0 and every stage ran, `refused:<code>` from its refusal, `defect:<kind>` otherwise). Add the record's path to `run`'s coverage-report slot? No — the report reads the count from wherever the record lands; write it beside the run record (`<record>.interventions.json` or a documented sibling) and say where.
2. **Wire the count into the coverage report's rule.** T015 encoded: a run-record application is proven only if `interventions.count === 0`, else `intervention-count-not-asserted`. Make the report read the harness record when present. Touch ONLY the reader side in `packages/trust/src/coverage-report.ts` — do not change the sealed-receipts rows or the rule's wording. If wiring the reader needs anything under `evidence/trust/current/**` regenerated, do NOT regenerate trust in this unit; leave the reader in place and say so — the next trust regeneration picks it up.
3. **Register** in `OPERATOR_COMMANDS`, help text, and the census (any refusal codes you add, e.g. `intervention-count.write-set-not-declared`).
4. **Tests** in `packages/cli/test/operator-intervention-count.test.ts`: (a) a run that writes only inside its declared write set → all four counters zero, `interventionCount: 0` asserted positively; (b) a controlled run whose child process writes one file into `fixtures/` (simulate: a tiny script the harness spawns in place of `run` for the test) → C4 records that path, `interventionCount: 1`; (c) a second spawn attempt → C3 = 1; (d) a child that blocks past the stage budget with no stdout → `defect:hang`, not an intervention; (e) a refusing run (mycrypto: `ingest.revision-not-determined`) → `terminalClassification: 'refused:ingest.revision-not-determined'`, `interventionCount: 0` — a refusal is not an intervention.

Budget: 30 minutes. **Start the verify chain by minute 15.** Emit your receipt even if a command is reported not re-run — the harness runs the block after a `completed` receipt. If you cannot finish, return `blocked` naming what is left, not `partial`.

## File contract

- `packages/cli/src/operator/**`
- `packages/cli/src/cli.ts`
- `packages/trust/src/coverage-report.ts`
- `packages/cli/test/operator-intervention-count.test.ts`
- `packages/cli/test/operator-flows.test.ts`
- `packages/cli/test/operator-refusal-census.test.ts`
- `packages/trust/test/coverage-report.test.ts`
- `evidence/runs/operator-flows/**`

## Forbidden moves

- Do not write inside `packages/frameworks/react`, `packages/frameworks/angular`, `packages/core/src/migrations`, `packages/core/src/bundlers`, or `packages/core/src/analysis`. Why: sealed under freeze `27741d9c`.
- Do not let `run` count its own interventions or self-report a zero. Why: "the gate must not be scored by the thing under test" — a self-reported zero is exactly the number a bad stage would report.
- Do not regenerate trust or write under `evidence/trust/current/**`. Why: outside contract; the trust digest is `b3f616b1` and a regeneration is a separate declared unit.
- Do not run `npm run build` / `pnpm exec vp pack`. Why: gitignored provenance subject.
- Do not run `vp fmt` repo-wide. Why: 249 pre-existing files. Format only files you touched.
- Do not treat a refusal exit as an intervention, or a hang as a refusal. Why: the spec is explicit, and the report tallies refusals as passing terminal states.
- Do not restate a bounded claim more generally. Why: derivation-guarded surfaces.

## Verification

```verify
npm run lint
npm test
npm run receipt:verify
npm run trust:verify -- --offline
node --experimental-strip-types packages/cli/src/cli.ts refusal-census --verify-only --json
R="$(mktemp -d)"; node --experimental-strip-types packages/cli/src/cli.ts intervention-count .versionless/work/react-mycrypto/baseline --out "$R/lane" --record "$R/run.json" --json > "$R/ic.json"; node -e "const j=require('$R/ic.json');if(j.schemaVersion!=='versionless.intervention-count.v1')throw new Error('schema');if(j.interventionCount!==0)throw new Error('count '+j.interventionCount);if(!/^refused:/.test(j.terminalClassification))throw new Error('class '+j.terminalClassification);if(j.invocations!==1)throw new Error('invocations');console.log('IC-ZERO-ON-REFUSAL')"
git diff --quiet HEAD -- packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis && echo FREEZE-INTACT
```

`npm test` takes ~150s; green baseline is 2611/2611 (+2 skipped). `npm run trust:verify` WITHOUT `-- --offline` fails by design.

## Blocked permission

If evidence is missing, the contract conflicts with reality, or you need a file outside the contract, return status "blocked" with the question in open_questions instead of improvising. Specifically block, do not improvise, if: `run`'s write set cannot be determined from its flags and record without changing `run`'s contract; C1 over "every tracked path in the checkout" is too slow to fit the budget and you need a documented scoping decision; wiring the report reader needs a trust regeneration; or a verify command fails for a cause outside your contract.