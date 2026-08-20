Fable-Opus-Unit: bank-demo-fleet-pipeline-p1c/T031-trust-run-record-source
Fable-Opus-Timeout-Minutes: 30

## Goal

Let the trust package carry the first run-record-provenanced application, honestly, and restore `trust:verify` to green.

What happened. Pass 3 of the React coverage batch produced the tranche's first unseen app to traverse all nine stages unattended: `react-flame-v2-4-0` (pawelmalak/flame v2.4.0, MIT, CRA in `client/`) — install ran (117 packages), build ran (24 outputs), witness ran (synthesized-crawl), harness `interventionCount 0`, terminal `proven`. Corpus conformance already carries it as source application **13** with `provenanceOfStatus: 'run-record'` (T022a's derived admission path). But `trust:generate` then threw:

```
Error: Invalid corpus application source
  at asRecord (packages/trust/src/schema.ts:63:9)
  at sourcesAndRights (packages/trust/src/enterprise.ts:543:22)
```

A run-record row carries `basis.runRecord` and no `source` block; `sourcesAndRights` requires `source` on every row. So **`trust:verify` is RED right now** — `evidence/trust/current/` is half-regenerated (corpus-conformance, matrix, provenance, manifest, report.md written before the throw; enterprise-report and coverage-report stale). The published coverage report still says `proven: 10` and lists flame as `refused`. A successful `trust:generate` settles all of it.

Fix it **honestly**, in `packages/core/src/corpus/conformance.ts` `deriveRunRecordApplications` (T022a): derive a `source` block for a run-record row **from readings the pipeline recorded in the run record** — repository, ref, `commitSha` from the ingest stage record (which read them from the consent-journalled `evidence/ingests/<id>/source.json`; flame's is `069b6690d9fa7a24a6e7727386ab85148c89b90e`), the licence identifier and licence artifact digest from the license-at-pin stage record — and mark the source's basis as `run-record` naming the run record path. **If any field is absent from the run record, refuse the row with a named `statusReason`; never fabricate a source from the lane path or the id.** Also fix: the derived row's `id` is currently the lane PATH (`.versionless/work/react-flame-v2-4-0/baseline`) — it must be the application id `react-flame-v2-4-0` (read it from the ingest stage record's id, which ingest inferred or read from the journal). If `sourcesAndRights` still needs to accept the run-record basis after that, adjust it minimally in `enterprise.ts` and say exactly what changed.

Then regenerate: `pnpm exec vp pack` ONCE first only if `packages/cli/dist` is stale vs source (mtime; declare it), then `VERSIONLESS_NETWORK_MODE=offline npm run trust:generate -- --offline --policy trust/policy.json --output evidence/trust/current`, then verify. Expected, stated in advance: coverage report `totals.proven` **11** = sealed 10 + run-record 1; flame row `status proven`, `provenanceOfStatus run-record`, `stages` all nine `ran`, `interventionCount 0`, `id react-flame-v2-4-0`; the sealed subset unchanged (10 proven / 2 bounded / 1 not-admitted); the Judge-counted supported-matrix cells UNCHANGED (`react: 6 counted of 6`, `angular: 4 counted of 4`) — a run-record proof is a pipeline proof, not a Judge-counted cell, and the coverage report must STATE that distinction (in `notEstablished` or a named field — read the existing `notEstablished` lines in `packages/trust/src/coverage-report.ts` and add one in the same voice). Freeze composite `27741d9c` stable. Record old (`443f8243…`) → new trust digest.

Read first: `evidence/runs/react-flame-v2-4-0/run-record.json` (the ingest and license-at-pin stage records — every field you need is there or the row must be refused), `conformance.ts` `deriveRunRecordApplications`, `enterprise.ts:520-560`, `schema.ts:55-70`, `coverage-report.ts` (the run-record row shape and `notEstablished`).

Budget: 30 minutes. **Start the verify chain by minute 15.** Emit your receipt even if a command is reported not re-run — the harness runs the block after a `completed` receipt. If you cannot finish, return `blocked` naming what is left — not `partial`.

## File contract

- `packages/core/src/corpus/conformance.ts`
- `packages/trust/src/enterprise.ts`
- `packages/trust/src/coverage-report.ts`
- `packages/trust/src/generate.ts`
- `packages/trust/src/schema.ts`
- `packages/core/test/**`
- `packages/trust/test/**`
- `evidence/trust/current/**`

## Forbidden moves

- Do not write inside `packages/frameworks/react`, `packages/frameworks/angular`, `packages/core/src/migrations`, `packages/core/src/bundlers`, or `packages/core/src/analysis`. Why: sealed under freeze `27741d9c`. (`packages/core/src/corpus` is not frozen.)
- Do not fabricate any source field. Why: the source block is a claim about where the code came from; every value must be a reading the pipeline recorded, or the row is refused by name.
- Do not touch the 18 sealed `CorpusTransactionState` members or move any sealed number (sealed proven 10, react 6/6, angular 4/4). Why: sealed assertions.
- Do not let the flame row be proven unless its nine stages all `ran` and the harness count is 0. Why: the T028 proven bar.
- **Do not run `git stash`, `git checkout -- <path>`, `git reset`, or `git clean`.** Why: ~60 uncommitted tranche files; T028 tripped the guard doing this.
- Do not hand-edit anything under `evidence/trust/current/`. Why: emitted artifacts only; the point is that `trust:generate` produces it.
- Do not run `vp pack` except once, first, if stale (declared). Do not run `vp fmt` repo-wide. Why: provenance subject; 249 files.
- Do not restate a bounded claim more generally. Why: derivation-guarded surfaces.

## Verification

```verify
npm run lint
npm test
npm run trust:verify -- --offline
npm run receipt:verify
node --experimental-strip-types packages/cli/src/cli.ts refusal-census --verify-only --json
node --experimental-strip-types packages/cli/src/cli.ts report:enterprise --offline --verify-only
node --experimental-strip-types packages/cli/src/cli.ts report:coverage --offline --verify-only
node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline
node -e "const f=require('./evidence/trust/current/adapter-freeze.json');if(!String(f.freeze.composite).startsWith('27741d9c'))throw new Error('freeze composite moved: '+f.freeze.composite);console.log('FREEZE-COMPOSITE-STABLE')"
git diff --quiet HEAD -- packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis && echo FREEZE-INTACT
node -e "const r=require('./evidence/trust/current/coverage-report.json');const t=r.totals;if(t.proven!==11)throw new Error('proven is '+t.proven+', expected 11');const f=r.applications.find(a=>a.id==='react-flame-v2-4-0');if(!f)throw new Error('flame row absent or id is not the application id');if(f.status!=='proven'||f.provenanceOfStatus!=='run-record')throw new Error('flame row '+JSON.stringify(f).slice(0,200));const st=f.stages||[];if(st.length!==9||!st.every(x=>x.status==='ran'))throw new Error('flame stages not all ran');if(f.interventionCount!==0)throw new Error('flame interventionCount '+f.interventionCount);const sealed=r.applications.filter(a=>a.provenanceOfStatus==='sealed-receipts');const sp=sealed.filter(a=>a.status==='proven').length;if(sp!==10)throw new Error('sealed proven moved: '+sp);console.log('COVERAGE proven=11 (sealed 10 + run-record 1: react-flame-v2-4-0) applications='+t.applications)"
node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline 2>&1 | grep -q "react: 6 counted of 6" && node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline 2>&1 | grep -q "angular: 4 counted of 4" && echo MATRIX-CELLS-UNCHANGED-6-6-4-4
node -e "const c=require('./evidence/trust/current/corpus-conformance.json');if(c.summary.sourceApplications!==13)throw new Error('sourceApplications '+c.summary.sourceApplications);const f=(c.applications||[]).find(a=>a.id==='react-flame-v2-4-0');if(!f)throw new Error('conformance flame row id must be the application id, not a path');console.log('CONFORMANCE-13-WITH-FLAME-ID')"
```

`npm test` takes ~150s; green baseline is 2686/2686 (+2 skipped) plus whatever T030 added (its `npm test` was not harness-run; treat the full suite as required green). `npm run trust:verify` WITHOUT `-- --offline` fails by design.

## Blocked permission

If evidence is missing, the contract conflicts with reality, or you need a file outside the contract, return status "blocked" with the question in open_questions instead of improvising. Specifically block, do not improvise, if: the flame run record lacks a field the source block needs (name it — the row is then refused, and say so); a sealed number or the freeze composite moves on regeneration; the fix would need the five frozen subtrees; or a verify command fails for a cause outside your contract.