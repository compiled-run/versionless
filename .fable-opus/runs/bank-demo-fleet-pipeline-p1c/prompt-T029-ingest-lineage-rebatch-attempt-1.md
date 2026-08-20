Fable-Opus-Unit: bank-demo-fleet-pipeline-p1c/T029-ingest-lineage-rebatch
Fable-Opus-Timeout-Minutes: 30

## Goal

Two things, in order. **(3)** Land the last piece of the T027 ruling in `ingest`. **(5)** Re-batch the six unseen React apps **twice** — once with zero declarations, once with the three T004 install policies declared **once for the fleet** — and publish both, so the coverage report and the runbook can say exactly how far an unseen CRA-era React app gets with nothing declared, and how far with the one operator decision a bank makes once.

Why. Yesterday's batch (T013): 6 unseen apps, 0 proven, all refused at ingest or era-cell. T027 ruled three refusal classes over-strict; T028 landed the era-cell and coverage-report halves — colorme now passes era-cell, flame passes ingest but reads its Express **root** manifest at license-at-pin. What's left is ingest: walking up to the acquisition root for sub-directory frontends, reading the frontend root **by lineage**, and reading the id from the journal. Then the re-batch shows whether the number moves.

### (3) ingest — read `packages/cli/src/operator/ingest.ts` :150-260 (id inference, `acquisitionLaneOf` at :220-229 which exact-matches `.versionless/work/<id>/baseline`, revision from the journal — T023's four gates) and :405-426 (frontend root by manifest PRESENCE today), then `docs/goals/bank-demo-fleet-pipeline/notes/T027-react-batch-ruling.md` §3.

- `acquisitionLaneOf` walks UP from the given root to the nearest enclosing `.versionless/work/<id>/baseline`, gated by walking THAT tree and matching the journalled `archiveParity` digest (T023's four gates unchanged: `result === source-bound`, `consentId` present, parity basis present, digest matches).
- Frontend root by **lineage** across the acquisition root and its immediate subdirectories: exactly one manifest declaring react/next/angular is read; zero or several refuse naming every candidate and what each manifest declared. Record `frontendRootBasis`. Never by position.
- Identifier from the journal under the same five gates when `package.json` has no `name`, `idReadFrom` naming it *an operator declaration made at acquire time*. Never a directory name.
- Propagate the frontend root from ingest to analyze, era-cell, plan, apply in `packages/cli/src/operator/run.ts` (`--frontend-root` exists at :154,161) and print both roots in the run record.
- Tests in `operator-ingest.test.ts` (walk-up + gate; lineage read with one/zero/several candidates; id from journal) and `operator-run.test.ts` (both roots printed).

### (5) two-pass re-batch — read `packages/cli/src/operator/batch.ts` (how `--name`, `--apps`, and forwarded flags work; note it forces `VERSIONLESS_NETWORK_MODE=offline` ONLY on the publish steps — do NOT set it on the batch itself, install must reach the registry).

- Write `evidence/runs/fleet-batch/t029-react-fleet.json` naming the six BASELINE roots (`.versionless/work/react-{antd-admin-template-v2-0-0,colorme-2019-06-06,coverview-a1470b01,cra-redux-1a06509b,flame-v2-4-0,your-spotify-1-5-0}/baseline` — NO `/client` suffixes, NO per-app declarations).
- **Pass 1**: `batch --apps evidence/runs/fleet-batch/t029-react-fleet.json --out <tmp> --name t029-undeclared --publish --json`. Expected shape (T027, stated in advance): zero of the four T013 codes; every remaining refusal at plan or later; dominated by `install.*-policy-not-declared`.
- **Pass 2**: same, `--name t029-fleet-install-policies`, plus `--allow-remote-tarballs --allow-install-scripts --allow-peer-conflicts` — the three T004 policies, declared once fleet-wide, NOTHING per app. Report verbatim: `refusedByCode`, how many rows reached `install` / `build` / `witness` / `proven`, `defects`, `interventionCount` (must be 0), the coverage report `totals` before and after, old→new trust digest. An npm install that fails on a real 2016–2022 CRA app at Node 24 (node-sass, deprecated peer trees) is a **named refusal or a defect row per the install stage's own contract** — report which; do not fight it per app.
- If a real app exposes a crash/hang, that row is `defect:*` — record it as a finding; do not hand-fix product code except a clearly small, clearly general bug (say what).

Then regenerate census/trust via the pipeline (`--publish` does it; declared dist pack first only if stale). Freeze composite `27741d9c` stable; sealed matrix verbatim.

Budget: 30 minutes. **Land (3) and start pass 1 by minute 12; start the verify chain by minute 20.** If pass 2 cannot finish, publish pass 1 and return `blocked` naming pass 2 — not `partial`. Emit your receipt even if a command is reported not re-run — the harness runs the block after a `completed` receipt.

## File contract

- `packages/cli/src/operator/**`
- `packages/cli/src/cli.ts`
- `packages/cli/test/**`
- `evidence/runs/**`
- `evidence/ingests/**`
- `evidence/trust/current/**`

## Forbidden moves

- Do not write inside `packages/frameworks/react`, `packages/frameworks/angular`, `packages/core/src/migrations`, `packages/core/src/bundlers`, or `packages/core/src/analysis`. Why: sealed under freeze `27741d9c`. If an app needs the adapter widened, that is a finding.
- **Do not run `git stash`, `git checkout -- <path>`, `git reset`, or `git clean`.** Why: the tree holds ~50 uncommitted files from this tranche; T028 stashed/popped them to check a lint warning and the scope guard flagged seven files. A failed pop destroys the tranche.
- Do not set `VERSIONLESS_NETWORK_MODE=offline` on the batch or on `run`. Why: install must reach the registry; only publish steps are offline (batch already does that).
- Do not choose a frontend root by position, take an id from a directory name, follow a redirect, or tune any declaration per app. Why: T027 ruled these per-app tuning by force — the silent manual residue.
- Do not let the coverage report reach `proven` on any run whose stages are not all `ran`. Why: T028's proven bar (charter standing constraint).
- Do not reword an existing refusal message; do not hand-edit anything under `evidence/`. Why: verbatim strings; emitted artifacts only.
- Do not run `vp pack` except once, first, if dist is stale (or via `--publish`). Do not run `vp fmt` repo-wide. Why: provenance subject; 249 pre-existing files.
- Do not describe any app as proven, admitted, or working unless the report row says `proven`. Why: the report is the arbiter.

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
git diff --quiet HEAD -- packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis && echo FREEZE-INTACT
node -e "const f=require('./evidence/runs/fleet-batch/t029-undeclared/fleet-summary.json');const t=f.totals;if(t.applications!==6)throw new Error('apps '+t.applications);if(t.interventionCount!==0)throw new Error('interventions '+t.interventionCount);const gone=['era-cell.cell-not-declared-for-framework','era-cell.node-major-not-inferable','ingest.revision-not-determined','ingest.identifier-not-determined'];for(const c of gone)if(t.refusedByCode&&t.refusedByCode[c])throw new Error('T013 refusal survived: '+c);const late=new Set(['plan','apply','install','build','witness']);for(const a of f.applications){if(!a.refusal)continue;if(!late.has(a.refusal.stage))throw new Error(a.id+' still refuses at '+a.refusal.stage+' with '+a.refusal.code)}console.log('PASS1 all 6 past era-cell; refusedByCode='+JSON.stringify(t.refusedByCode)+' proven='+t.proven+' defects='+t.defects)"
node -e "const f=require('./evidence/runs/fleet-batch/t029-fleet-install-policies/fleet-summary.json');const t=f.totals;if(t.applications!==6)throw new Error('apps');if(t.interventionCount!==0)throw new Error('interventions');console.log('PASS2 proven='+t.proven+' refusedByCode='+JSON.stringify(t.refusedByCode)+' defects='+t.defects)"
node -e "const r=require('./evidence/trust/current/coverage-report.json');if(r.totals.proven<10)throw new Error('sealed proven fell');for(const row of r.applications){if(row.status!=='proven'||row.provenanceOfStatus!=='run-record')continue;const s=row.stages||[];if(s.length===0||!s.every(x=>x.status==='ran'))throw new Error('proven row with stages not all ran: '+row.id)}console.log('COVERAGE proven='+r.totals.proven+' applications='+r.totals.applications)"
```

`npm test` takes ~150s; green baseline is 2676/2676 (+2 skipped). `npm run trust:verify` WITHOUT `-- --offline` fails by design.

## Blocked permission

If evidence is missing, the contract conflicts with reality, or you need a file outside the contract, return status "blocked" with the question in open_questions instead of improvising. Specifically block, do not improvise, if: any inference T027 forbade would be needed; any row shows `interventionCount > 0` (Phase 1 regression — name app and stage); the registry is unreachable from this host (then a fleet-wide `install.registry-not-reachable` refusal is the honest addition, per T027 — say so and stop); publish moves a sealed number or the freeze composite; or a verify command fails for a cause outside your contract.