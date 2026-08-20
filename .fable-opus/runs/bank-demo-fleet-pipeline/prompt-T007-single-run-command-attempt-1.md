Fable-Opus-Unit: bank-demo-fleet-pipeline/T007-single-run-command
Fable-Opus-Timeout-Minutes: 30

## Goal

Land THE SINGLE COMMAND: `versionless run <app-root> --out <dir>` chains every stage by default — analyze → ingest → license-at-pin → era-cell → plan → apply/materialize → install → build → witness — with one exit code, one `--json` record, and every stage's declared policies surfaced as flags with the same refusing defaults they have today. This is the owner's "it should be as easy as `versionless migrate`" made literal.

Why. Every stage now exists and is individually proven — T004 (lane, install, build, refusals), T005 (ingest, license-at-pin), T018 (era-cell), T006/T019/T020 (witness synthesis and replay). But `migrate` runs them only when each is opted in (`packages/cli/src/operator/flows.ts:150-154`: `--ingest --era-cell --install --build --witness`), and that is deliberate — the exit-0 verify path must not need a registry. So: **leave `migrate` exactly as it is** and add `run` as the default-everything entry beside it.

Read first, briefly:

1. `packages/cli/src/operator/flows.ts` — `OPERATOR_COMMANDS`, `runOperatorCommand`, the migrate branch (:367-410 help text explains why each stage is opt-in and how not-run is recorded), `EXIT_REFUSAL / EXIT_PROCEEDED`, `exitCode` on outcomes (:664), and how a `PipelineRefusal` is returned (not thrown).
2. `packages/cli/src/operator/refusals.ts` and one stage module (`install.ts` is a good model) — declared policies with refusing defaults, the record each stage emits.
3. `packages/cli/src/operator/refusal-census.ts` — the census producer; any new refusal code you add must land there.

Deliver:

1. **`run` operator command** in `packages/cli/src/operator/run.ts`, registered in `OPERATOR_COMMANDS` and reachable via `cli.ts` with help text in the existing style. It composes the existing stage functions in order; it does not reimplement any stage. Stage order: analyze → ingest → license-at-pin → era-cell → plan → apply (materialize into `--out`) → install → build → witness. Each stage's flags are accepted by `run` and forwarded (`--allow-remote-tarballs`, `--allow-install-scripts`, `--allow-peer-conflicts`, `--node/--arch/--cell`, `--license`, `--journeys`, `--source-root`, etc. — enumerate from the stage modules; do not invent new ones). Defaults are the stages' own refusing defaults.
2. **One exit code.** The FIRST refusing stage decides: exit 2 with that stage's `PipelineRefusal` verbatim; later stages are recorded `not-run-because: <earlier stage> refused`. A defect (exception) anywhere is exit 1 with the stage named. All stages proceeded → exit 0.
3. **One record**, schema `versionless.run.v1`, in `--json`: `stages: [{ name, status: 'ran' | 'not-run' | 'refused' | 'defect', reason?, refusal?, record? , startedAt, endedAt }]`, the terminal `exitCode`, and `report: { status: 'not-yet-emitted', slot: 'evidence/trust/current/coverage-report.json' }` — the coverage report is a later unit's (T015); leave the slot honestly rather than faking a report. `--record <file>` writes the same JSON.
4. **A clear stage seam.** One function (e.g. `runStage(name, fn)`) is the only place a stage begins and ends — timestamps, status, and refusal capture live there. A later unit (T014, the human-intervention counter) will instrument exactly this seam; do not scatter stage boundaries.
5. **`--dry-run`**: prints the stage plan and forwarded flags without executing — cheap to test and useful on stage.
6. **Tests** in `packages/cli/test/operator-run.test.ts`: (a) `run` on `.versionless/work/react-mycrypto/baseline` (a known frozen-adapter refusal at plan) exits 2 with the refusal verbatim, `stages` shows analyze/ingest/license-at-pin/era-cell as ran-or-refused and plan as refused and everything after as not-run; (b) `--dry-run` lists the nine stages in order with no side effects; (c) the seam records startedAt ≤ endedAt for every ran stage; (d) `run` on `.versionless/work/react-papercups-v1-0-0/baseline` WITHOUT install/build policies declared exits 2 at install with `install.*-policy-not-declared` (proves refusing defaults survive the chain), and WITH `--allow-peer-conflicts` (and whatever else T004's lane needed) proceeds past install/build — mark that leg `skipIf` the lane needs the registry on this host, and say so.

Do NOT change any stage's flags, refusal codes, or record shape — compose them. Do NOT touch `migrate`'s defaults. Do NOT bring in `packages/cli/src/fixture/fleet-batch-spike-run.ts` or its catch-based refusal detection — batch is a later unit.

Budget: 30 minutes. Start the verify chain by minute 18. Emit your receipt even if you must report a command as not re-run; the harness runs the block mechanically after a `completed` receipt. If you cannot finish, return `blocked` naming what is left — not `partial`.

## File contract

- `packages/cli/src/operator/**`
- `packages/cli/src/cli.ts`
- `packages/cli/test/operator-run.test.ts`
- `packages/cli/test/operator-flows.test.ts`
- `packages/cli/test/operator-refusal-census.test.ts`
- `evidence/runs/operator-flows/**`

## Forbidden moves

- Do not write inside `packages/frameworks/react`, `packages/frameworks/angular`, `packages/core/src/migrations`, `packages/core/src/bundlers`, or `packages/core/src/analysis`. Why: sealed under freeze `27741d9c`.
- Do not change a proven stage's contract (flags, codes, record) to make chaining easier. Why: each stage's tests are its spec, and the census counts its codes; changing them re-opens finished work.
- Do not make `run` swallow a refusal to keep going. Why: the first refusing stage must decide the exit code, or the bank sees a green run over a refused migration.
- Do not run `npm run build` / `pnpm exec vp pack`. Why: gitignored provenance subject; trust is at `c9941f8f`.
- Do not run `vp fmt` repo-wide. Why: 249 pre-existing files. Format only files you touched.
- Do not restate a bounded claim more generally, and do not emit any run-level string with an inflected pass verb. Why: derivation-guarded surfaces; `run` is what the owner will read aloud.

## Verification

```verify
npm run lint
npm test
npm run trust:verify -- --offline
npm run receipt:verify
node --experimental-strip-types packages/cli/src/cli.ts refusal-census --verify-only --json
R="$(mktemp -d)"; node --experimental-strip-types packages/cli/src/cli.ts run .versionless/work/react-mycrypto/baseline --out "$R/lane" --json > "$R/run.json"; test $? -eq 2 && node -e "const j=require('$R/run.json');if(!j.stages||!j.refusal||!j.refusal.code)throw new Error('run record lacks stages/refusal');console.log('RUN-REFUSES-WITH-STAGE-TABLE')"
git diff --quiet HEAD -- packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis && echo FREEZE-INTACT
```

`npm test` takes ~150s; green baseline is 2593/2593. `npm run trust:verify` WITHOUT `-- --offline` fails by design.

## Blocked permission

If evidence is missing, the contract conflicts with reality, or you need a file outside the contract, return status "blocked" with the question in open_questions instead of improvising. Specifically block, do not improvise, if: a stage cannot be composed without changing its contract; a stage still requires human input none of the earlier units parameterized (name it — that is their gap, not something to hide behind a flag); or a verify command fails for a cause outside your contract.
