Fable-Opus-Unit: bank-demo-fleet-pipeline-p1b/T021a-batch-runner-ordering
Fable-Opus-Timeout-Minutes: 30

## Goal

Fleet operation on top of `run`: (1) a `batch` operator command that takes a list of application roots (argument or manifest file — **never from source**), invokes the intervention-count harness on each **serially**, files each result where the coverage report reads it, and emits an honesty-guarded fleet summary; and (2) the **ordering** that makes the coverage report readable on every run — build → `trust:generate` → verify → report — as an explicit `--publish` step, so a batch ends in a fresh, verified `coverage-report.{json,md}`.

Why. Phase 1 built the pieces: `run` (T007), the coverage report (T015), the out-of-band harness (T014), generic admission (T004/T005/T018/T016/T023), and the count ceiling opened (T022). Nothing yet runs many apps and folds them into the report. Spike B measured ~0.8 ms/app of machine time — the fleet is cheap; what's missing is the loop, the filing, and the ordering. The committed prototype `packages/cli/src/fixture/fleet-batch-spike-run.ts` is the named misfire in two ways: it hardcodes a 12-app `FLEET` at :81 (a batch that lists its fleet in source is not a fleet tool), and it detects refusals by _catching_ (`:275,306,342`) — refusals are now returned outcomes with `exitCode 2`. Do not carry either forward.

Read first, briefly:

1. `packages/cli/src/operator/intervention-count.ts` — the harness you invoke per app; its record shape `versionless.intervention-count.v1`; how `--record` names the run record and where `<record>.interventions.json` lands.
2. `packages/trust/src/coverage-report.ts:48-70` and `readRunRecords` at :580 — `RUN_RECORD_ROOT = 'evidence/runs'`, `RUN_RECORD_FILE = 'run-record.json'`, and the `.interventions.json` sibling: **this is where the batch must file each app's records** (`evidence/runs/<app-id>/run-record.json` + `.interventions.json`) for the report to see them.
3. `packages/cli/src/operator/matrix.ts:42-51` and `packages/trust/src/enterprise.ts:935-975` — `assertEnterpriseSurfaceHonesty`, which the fleet summary must terminate in.
4. `evidence/spikes/fleet-batch-dryrun/fleet-summary.json` — the honesty-guarded summary shape spike B prototyped (`totals`, per-app rows, `notEstablished`); reuse its spirit, not its schema id.
5. `packages/cli/src/cli.ts:413-441` — how `trust:generate` and `report:coverage` are invoked, so `--publish` composes them rather than re-implementing.

Deliver:

1. **`versionless batch --apps <file>|<root>... --out <lane-root> [--publish] [--json]`** in `packages/cli/src/operator/batch.ts`, registered in `OPERATOR_COMMANDS`/help/dispatch. For each app root, in list order, **serially** (witness must never run in parallel — determinism-under-load finding; operator stages may fan out later, not in this unit): invoke the harness exactly as `intervention-count <root> --out <lane-root>/<id> --record evidence/runs/<id>/run-record.json --json` (id inferred as ingest infers it, or from the manifest), capture its record. Per-app row: id, framework if known, `terminalClassification` verbatim, `interventionCount`, refusal code + message verbatim when refused, elapsed ms, and the record paths. A harness crash/hang for one app is a `defect:*` row, not a batch abort. Forward per-stage flags uniformly (`--node`, `--allow-*`, `--journeys`, …) — the same declared-policy shape.
2. **Fleet summary** `versionless.fleet-batch.v1` at `evidence/runs/fleet-batch/<timestamp-or-name>/fleet-summary.json` (+ `.md`): totals (apps, proven, refused-by-code, defects, interventionCount sum — which must be 0 for the batch to be called unattended), per-app rows, machine time, `notEstablished` (verbatim from spike B where still true: "A count of refusal sites is not a count of refusable applications…" style honesty), and it MUST pass `assertEnterpriseSurfaceHonesty` — no aggregate restates a bounded per-app claim more generally, no pass verbs, refused apps carry their named strings.
3. **`--publish`**: after the loop, run in this order and record each step's outcome in the summary: (a) `pnpm exec vp pack` ONLY IF `packages/cli/dist` is stale vs source (mtime check; say in the summary whether it rebuilt); (b) `VERSIONLESS_NETWORK_MODE=offline npm run trust:generate -- --offline --policy trust/policy.json --output evidence/trust/current`; (c) `npm run trust:verify -- --offline`; (d) `report:coverage --offline --verify-only`. The batch exit code: 0 if every step succeeded and every app's harness ran (refusals are fine); 1 if any defect or publish step failed. Without `--publish`, the summary says `publish: not-declared` and the report is unchanged. **The freeze composite `27741d9c` must not move on publish; the sealed matrix must reproduce verbatim.**
4. **Prove it once, small**: run `batch` on TWO apps — `.versionless/work/react-mycrypto/baseline` (refuses at ingest: journal-does-not-match-the-tree) and `.versionless/work/react-ant-design-pro-v5-2-0/baseline` (refuses at era-cell) — WITHOUT `--publish` first (files run records under `evidence/runs/<id>/`), then once WITH `--publish`. Report verbatim: both rows, totals, whether dist rebuilt, old→new trust digest, and confirm `coverage-report.json` now lists both apps as `not-admitted` / refused with codes (NOT proven — count is 0 but classification is refused, so the intervention rule and the proven rule both hold). If publish moves any sealed number, stop and report.
5. **Tests** in `packages/cli/test/operator-batch.test.ts`: list from a manifest file, never from source; serial order preserved; a defect row does not abort; summary honesty (every string through the guard); `--publish` ordering (mock the four steps and assert order and that a failing step sets exit 1 and stops the chain); no `--publish` → report byte-unchanged.

Prune-after-receipt and the parallel operator-stage scheduler are T021b — do NOT build them here.

Budget: 30 minutes. **Start the verify chain by minute 15.** Emit your receipt even if a command is reported not re-run — the harness runs the block after a `completed` receipt. If you cannot finish, land the batch loop + summary and return `blocked` naming `--publish` as remaining — not `partial`.

## File contract

- `packages/cli/src/operator/**`
- `packages/cli/src/cli.ts`
- `packages/cli/test/operator-batch.test.ts`
- `packages/cli/test/operator-flows.test.ts`
- `packages/cli/test/operator-refusal-census.test.ts`
- `evidence/runs/operator-flows/**`
- `evidence/runs/fleet-batch/**`
- `evidence/runs/react-mycrypto/run-record.json`
- `evidence/runs/react-mycrypto/run-record.json.interventions.json`
- `evidence/runs/react-ant-design-pro-v5-2-0/**`
- `evidence/trust/current/**`

## Forbidden moves

- Do not write inside `packages/frameworks/react`, `packages/frameworks/angular`, `packages/core/src/migrations`, `packages/core/src/bundlers`, or `packages/core/src/analysis`. Why: sealed under freeze `27741d9c`.
- Do not take the fleet list from source, and do not import or reuse `fleet-batch-spike-run.ts`'s `FLEET` or its catch-based refusal detection. Why: a fleet in source is the named misfire; refusals are returned outcomes now.
- Do not run two harness invocations concurrently. Why: witness serializes per host.
- Do not write under `evidence/runs/<any-sealed-app>/` other than the two files named for `react-mycrypto` above (its sealed receipts live elsewhere in that dir — read `ls evidence/runs/react-mycrypto/` first and touch only the two new files). Why: sealed evidence.
- Do not let a batch with any `interventionCount > 0` or `defect:*` row exit 0 or describe itself as unattended. Why: the honesty of the fleet summary is the product.
- Do not run `pnpm exec vp pack` except inside `--publish` step (a) when dist is stale, and say so. Why: gitignored provenance subject.
- Do not hand-edit anything under `evidence/trust/current/` or the run/summary records. Why: emitted artifacts only.
- Do not run `vp fmt` repo-wide. Why: 249 pre-existing files. Format only files you touched.
- Do not restate a bounded claim more generally, and do not emit any summary string with an inflected pass verb. Why: derivation-guarded surfaces; the summary terminates in the honesty guard.

## Verification

```verify
npm run lint
npm test
npm run trust:verify -- --offline
npm run receipt:verify
node --experimental-strip-types packages/cli/src/cli.ts refusal-census --verify-only --json
node --experimental-strip-types packages/cli/src/cli.ts report:coverage --offline --verify-only
node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline
node -e "const f=require('./evidence/trust/current/adapter-freeze.json');if(!String(f.freeze.composite).startsWith('27741d9c'))throw new Error('freeze composite moved: '+f.freeze.composite);console.log('FREEZE-COMPOSITE-STABLE')"
test -n "$(ls evidence/runs/fleet-batch/*/fleet-summary.json 2>/dev/null)" && node -e "const g=require('glob');" 2>/dev/null; node -e "const fs=require('fs');const d=fs.readdirSync('evidence/runs/fleet-batch');const f=JSON.parse(fs.readFileSync('evidence/runs/fleet-batch/'+d[d.length-1]+'/fleet-summary.json','utf8'));if(f.schemaVersion!=='versionless.fleet-batch.v1')throw new Error('schema');if(!f.totals||f.totals.applications<2)throw new Error('apps');if(f.totals.interventionCount!==0)throw new Error('interventions '+f.totals.interventionCount);console.log('FLEET-SUMMARY apps='+f.totals.applications+' refused='+JSON.stringify(f.totals.refused||f.totals.refusedByCode).slice(0,120))"
node -e "const c=require('./evidence/trust/current/coverage-report.json');const ids=(c.applications||[]).map(a=>a.id);for(const id of ['react-ant-design-pro-v5-2-0','react-mycrypto']){const row=(c.applications||[]).find(a=>a.id===id||a.application===id);if(!row)throw new Error('report lacks '+id);if(row.status==='proven')throw new Error(id+' wrongly proven')}console.log('REPORT-LISTS-BOTH-NOT-PROVEN')"
git diff --quiet HEAD -- packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis && echo FREEZE-INTACT
```

`npm test` takes ~150s; green baseline is 2654/2654 (+2 skipped). `npm run trust:verify` WITHOUT `-- --offline` fails by design.

## Blocked permission

If evidence is missing, the contract conflicts with reality, or you need a file outside the contract, return status "blocked" with the question in open_questions instead of improvising. Specifically block, do not improvise, if: filing under `evidence/runs/<id>/` would collide with sealed receipts you cannot read around; the coverage report cannot list a refused run-record app without a change outside your contract; publish moves a sealed number or the freeze composite; or a verify command fails for a cause outside your contract.
