Fable-Opus-Unit: bank-demo-fleet-pipeline-p1c/T033-run-record-self-sufficient
Fable-Opus-Timeout-Minutes: 30

## Goal

Make the run record self-sufficient, re-run flame once, and let the trust package carry the first run-record application — honestly, from the run record alone. This supersedes T031, which correctly blocked on a false premise: the flame run record's ingest pin carries `commitSha` (adopted from the consent journal under four gates) but `repository: null, ref: null` — those two live only in the journal. Fix the record, not the derivation.

Five steps, in order:

**(1) INGEST adopts all three from the journal.** `packages/cli/src/operator/ingest.ts:683-721` reads `evidence/ingests/<id>/source.json` under four gates (`result === source-bound`, `consentId` present, parity basis present, journalled digest matches the walked tree) and adopts `commitSha` with `commitShaReadFrom`. At `:784` the pin takes `repository` from `declarations.repository` only. Change: when the journal reading succeeds, ALSO adopt `repository` (journal `repository.fullName` — flame's is `pawelmalak/flame`) and `ref` (journal `revision.ref` — `refs/tags/v2.4.0`) from the SAME reading, recorded in the pin with the same basis (add `pin.repositoryReadFrom` / `pin.refReadFrom`, or generalise `commitShaReadFrom` into a `pinReadFrom` naming all three — say which). Declared `--repository` / `--ref` still win when given. Do not weaken a gate. Test: journal-adopted pin carries all three with basis; declared flags override; a journal failing a gate adopts none.

**(2) RE-RUN FLAME ONCE**, a fresh first invocation with the same three fleet-wide install policies and nothing else:

```
R="$(mktemp -d)"; node --experimental-strip-types packages/cli/src/cli.ts intervention-count .versionless/work/react-flame-v2-4-0/baseline --out "$R/lane" --record evidence/runs/react-flame-v2-4-0/run-record.json --json -- --allow-remote-tarballs --allow-install-scripts --allow-peer-conflicts
```

(Read `intervention-count`'s help for the exact way run flags are forwarded — the `--` separator or otherwise.) It must again read nine stages `ran`, `interventionCount 0`, terminal `proven`, and now `pin.repository pawelmalak/flame`, `pin.ref refs/tags/v2.4.0`, `pin.commitSha 069b6690…`. If it does not come back proven, STOP and report exactly which stage changed — do not tune, do not retry with different flags (that would count).

**(3) CONFORMANCE.** `packages/core/src/corpus/conformance.ts` `deriveRunRecordApplications` (T022a): the row `id` must be the APPLICATION ID (`CorpusRunRecordReading.id`, which `packages/trust/src/coverage-report.ts` ~:636 already sets to the run-record directory name and publishes) — not `record.application` (the lane path); T031 found it is a one-line swap. Derive a `source` block FROM THE RUN RECORD ONLY: `repository`, `ref`, `commitSha` from the ingest pin; licence identifier and licence artifact digest from the license-at-pin stage record; `basis: 'run-record'` naming the run record path. Any missing field → refuse the row with a named `statusReason`; never fabricate. Test both directions.

**(4) ENTERPRISE.** If `sourcesAndRights` (`packages/trust/src/enterprise.ts:520-560`) still cannot accept the run-record source after (3), adjust it minimally and say exactly what changed.

**(5) REGENERATE.** `pnpm exec vp pack` ONCE first only if `packages/cli/dist` is stale by mtime (declare it), then `VERSIONLESS_NETWORK_MODE=offline npm run trust:generate -- --offline --policy trust/policy.json --output evidence/trust/current`. `evidence/trust/current/` is currently HALF-regenerated (T030's publish died at this throw) and `trust:verify` is RED — a successful generate settles it. Expected, stated in advance: coverage report `totals.proven` **11** = sealed 10 + run-record 1; flame row `id react-flame-v2-4-0`, `status proven`, `provenanceOfStatus run-record`, nine `stages` all `ran`, `interventionCount 0`, and its stale `refusalCode install.lockfile-absent` gone; sealed subset unchanged (10/2/1); supported-matrix cells UNCHANGED (`react: 6 counted of 6`, `angular: 4 counted of 4`) — and the coverage report STATES, in one new `notEstablished` line in the existing voice, that a run-record proof is a pipeline proof (the command ran unattended and every stage read `ran`) and not a Judge-counted matrix cell. Freeze composite `27741d9c` stable. Record old (`443f8243…`) → new trust digest.

Read first: `evidence/ingests/react-flame-v2-4-0/source.json` (the fields), `ingest.ts:100-125, 683-721, 784-790`, `conformance.ts` `deriveRunRecordApplications`, `coverage-report.ts` `readRunRecords` and `notEstablished`, `enterprise.ts:520-560`, `schema.ts:55-70`.

Budget: 30 minutes. **Do (1)+(2) by minute 10, (3)+(4) by minute 17, start the verify chain by minute 20.** Emit your receipt even if a command is reported not re-run — the harness runs the block after a `completed` receipt. If you cannot finish, return `blocked` naming what is left — not `partial`.

## File contract

- `packages/cli/src/operator/ingest.ts`
- `packages/cli/src/operator/run.ts`
- `packages/cli/test/operator-ingest.test.ts`
- `packages/cli/test/operator-run.test.ts`
- `packages/core/src/corpus/conformance.ts`
- `packages/trust/src/enterprise.ts`
- `packages/trust/src/coverage-report.ts`
- `packages/trust/src/generate.ts`
- `packages/trust/src/schema.ts`
- `packages/core/test/**`
- `packages/trust/test/**`
- `evidence/runs/react-flame-v2-4-0/**`
- `evidence/runs/operator-flows/**`
- `evidence/trust/current/**`

## Forbidden moves

- Do not write inside `packages/frameworks/react`, `packages/frameworks/angular`, `packages/core/src/migrations`, `packages/core/src/bundlers`, or `packages/core/src/analysis`. Why: sealed under freeze `27741d9c`.
- Do not weaken any of T023's four journal gates. Why: the gates are the honesty; adopting two more fields under them adds nothing the reading did not already establish.
- Do not fabricate any source field, and do not read the journal at derivation time. Why: the run record must be the sole basis; the pin says where every field came from.
- Do not retry flame with different flags if the re-run is not proven. Why: a retry with different declarations is an intervention by the counter's own definition — report and stop.
- Do not touch the 18 sealed `CorpusTransactionState` members or move a sealed number. Why: sealed assertions.
- **Do not run `git stash`, `git checkout -- <path>`, `git reset`, or `git clean`.** Why: ~60 uncommitted tranche files.
- Do not set `VERSIONLESS_NETWORK_MODE=offline` on the flame re-run (install must reach the registry). Why: it would refuse at install and be a false reading.
- Do not hand-edit anything under `evidence/`. Do not run `vp pack` except once, first, if stale (declared). Do not run `vp fmt` repo-wide. Why: emitted artifacts; provenance subject; 249 files.
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
node -e "const r=require('./evidence/runs/react-flame-v2-4-0/run-record.json');const ing=r.stages.find(s=>s.name==='ingest');const pin=ing&&ing.record&&ing.record.pin||{};if(pin.repository!=='pawelmalak/flame'||pin.ref!=='refs/tags/v2.4.0'||!/^069b6690/.test(pin.commitSha||''))throw new Error('pin incomplete: '+JSON.stringify(pin).slice(0,300));if(!r.stages.every(s=>s.status==='ran'))throw new Error('stages not all ran');const ic=require('./evidence/runs/react-flame-v2-4-0/run-record.json.interventions.json');if(ic.interventionCount!==0||ic.terminalClassification!=='proven')throw new Error('harness '+ic.interventionCount+' '+ic.terminalClassification);console.log('FLAME-RUN-RECORD-SELF-SUFFICIENT repo/ref/sha present, 9 ran, count 0, proven')"
node -e "const r=require('./evidence/trust/current/coverage-report.json');const t=r.totals;if(t.proven!==11)throw new Error('proven is '+t.proven+', expected 11');const f=r.applications.find(a=>a.id==='react-flame-v2-4-0');if(!f)throw new Error('flame row absent or id is not the application id');if(f.status!=='proven'||f.provenanceOfStatus!=='run-record')throw new Error('flame row '+JSON.stringify(f).slice(0,200));const st=f.stages||[];if(st.length!==9||!st.every(x=>x.status==='ran'))throw new Error('flame stages not all ran');if(f.interventionCount!==0)throw new Error('flame interventionCount '+f.interventionCount);const sealed=r.applications.filter(a=>a.provenanceOfStatus==='sealed-receipts');if(sealed.filter(a=>a.status==='proven').length!==10)throw new Error('sealed proven moved');console.log('COVERAGE proven=11 (sealed 10 + run-record 1: react-flame-v2-4-0) applications='+t.applications)"
node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline 2>&1 | grep -q "react: 6 counted of 6" && node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline 2>&1 | grep -q "angular: 4 counted of 4" && echo MATRIX-CELLS-UNCHANGED-6-6-4-4
node -e "const c=require('./evidence/trust/current/corpus-conformance.json');if(c.summary.sourceApplications!==13)throw new Error('sourceApplications '+c.summary.sourceApplications);const f=(c.applications||[]).find(a=>a.id==='react-flame-v2-4-0');if(!f)throw new Error('conformance flame row id must be the application id');if(!f.source||!f.source.repository)throw new Error('conformance flame row has no derived source block');console.log('CONFORMANCE-13-FLAME-WITH-SOURCE')"
```

`npm test` takes ~150s; the full suite must be green (last known 2686 + T030's additions). `npm run trust:verify` WITHOUT `-- --offline` fails by design.

## Blocked permission

If evidence is missing, the contract conflicts with reality, or you need a file outside the contract, return status "blocked" with the question in open_questions instead of improvising. Specifically block, do not improvise, if: adopting repository/ref would need a gate weakened; the flame re-run is not proven (name the stage); the run record still lacks a field the source block needs after (1)+(2) (name it — the row is then refused); a sealed number or the freeze composite moves; or a verify command fails for a cause outside your contract.
