Fable-Opus-Unit: bank-demo-fleet-pipeline-p1c/T034-verify-rederivation-tests
Fable-Opus-Timeout-Minutes: 25

## Goal

Close the last seam and let the moved number verify.

The trust package on disk is already correct: `trust:generate` succeeded, the coverage report reads `proven: 11` (sealed 10 + `react-flame-v2-4-0`, the first run-record application), corpus conformance reads `sourceApplications: 13` with a run-record-derived source block. But `trust:verify` throws `Corpus conformance does not match independent re-derivation`, because **`packages/trust/src/verify.ts:241`** calls `analyzeCorpusConformance({ rootDir: root })` **without** run records, while `packages/trust/src/generate.ts:1925` passes `runRecords: await readRunRecords(root)`. Flame is the first run-record row, so emitted and re-derived now differ by one row. `packages/cli/src/cli.ts:268` (`corpus:verify`) has the same asymmetry — `analyzeCorpusConformance()` with no `rootDir` and no `runRecords`.

Do:

**(a)** `verify.ts:241` — pass `runRecords` exactly as `generate.ts:1925` does (`await readRunRecords(root)`; add the import from `./coverage-report.ts` mirroring generate's). `cli.ts:268` — same, with `rootDir` and `runRecords`. One line + one import each. Do not invent a second read path.

**(b)** Write the tests T033 ran out of budget for:

- `packages/cli/test/operator-ingest.test.ts`: a journal-adopted pin carries `repository`, `ref`, `commitSha` with per-field basis (`repositoryReadFrom` / `refReadFrom` / `commitShaReadFrom`); declared `--repository`/`--ref` override the journal; a journal failing any of the four gates adopts none of the three.
- `packages/core/test/**` or `packages/trust/test/**`: `runRecordSource()` derives `{repository, ref, revision, license, licenseSha256, basis, basisPath}` from a run record alone, and refuses by named field (`run-record-states-no-source:<field>`) when one is missing; and a run-record row round-trips `generate → verify` (emitted conformance equals re-derived when both are given the same run records).

**(c)** Do NOT regenerate trust unless a verify command proves it necessary — the emitted package is right; the re-derivation was wrong. If you must (say why), `vp pack` once first only if dist is stale by mtime, declared.

Read first: `verify.ts:235-245`, `generate.ts:1920-1930` and its imports, `cli.ts:262-272`, `coverage-report.ts` `readRunRecords` and `runRecordSource`, `ingest.ts` `revisionOfAcquisitionJournal` (T033's return shape).

Budget: 25 minutes. (a) by minute 5; tests by minute 15; verify chain from minute 15. Emit your receipt even if a command is reported not re-run — the harness runs the block after a `completed` receipt. If you cannot finish the tests, land (a) and return `blocked` naming which tests remain — not `partial`.

## File contract

- `packages/trust/src/verify.ts`
- `packages/cli/src/cli.ts`
- `packages/cli/test/operator-ingest.test.ts`
- `packages/core/test/**`
- `packages/trust/test/**`
- `evidence/trust/current/**`

## Forbidden moves

- Do not write inside `packages/frameworks/react`, `packages/frameworks/angular`, `packages/core/src/migrations`, `packages/core/src/bundlers`, or `packages/core/src/analysis`. Why: sealed under freeze `27741d9c`.
- Do not change anything about how conformance, the source block, or the coverage report are DERIVED — only how verify re-derives. Why: T033 landed the derivation; this unit makes verify read the same inputs.
- **Do not run `git stash`, `git checkout -- <path>`, `git reset`, or `git clean`.** Why: ~60 uncommitted tranche files.
- Do not hand-edit anything under `evidence/`. Do not run `vp fmt` repo-wide. Why: emitted artifacts; 249 files.
- Do not move a sealed number or the freeze composite. Why: sealed assertions.

## Verification

```verify
npm run lint
npm test
npm run trust:verify -- --offline
npm run receipt:verify
npm run corpus:verify
node --experimental-strip-types packages/cli/src/cli.ts refusal-census --verify-only --json
node --experimental-strip-types packages/cli/src/cli.ts report:enterprise --offline --verify-only
node --experimental-strip-types packages/cli/src/cli.ts report:coverage --offline --verify-only
node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline
node -e "const f=require('./evidence/trust/current/adapter-freeze.json');if(!String(f.freeze.composite).startsWith('27741d9c'))throw new Error('freeze composite moved: '+f.freeze.composite);console.log('FREEZE-COMPOSITE-STABLE')"
git diff --quiet HEAD -- packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis && echo FREEZE-INTACT
node -e "const r=require('./evidence/trust/current/coverage-report.json');const t=r.totals;if(t.proven!==11)throw new Error('proven is '+t.proven+', expected 11');const f=r.applications.find(a=>a.id==='react-flame-v2-4-0');if(!f)throw new Error('flame row absent');if(f.status!=='proven'||f.provenanceOfStatus!=='run-record')throw new Error('flame row '+JSON.stringify(f).slice(0,200));const st=f.stages||[];if(st.length!==9||!st.every(x=>x.status==='ran'))throw new Error('flame stages not all ran');if(f.interventionCount!==0)throw new Error('flame interventionCount '+f.interventionCount);const sealed=r.applications.filter(a=>a.provenanceOfStatus==='sealed-receipts');if(sealed.filter(a=>a.status==='proven').length!==10)throw new Error('sealed proven moved');console.log('COVERAGE proven=11 (sealed 10 + run-record 1: react-flame-v2-4-0) applications='+t.applications)"
node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline 2>&1 | grep -q "react: 6 counted of 6" && node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline 2>&1 | grep -q "angular: 4 counted of 4" && echo MATRIX-CELLS-UNCHANGED-6-6-4-4
node -e "const c=require('./evidence/trust/current/corpus-conformance.json');if(c.summary.sourceApplications!==13)throw new Error('sourceApplications '+c.summary.sourceApplications);const f=(c.applications||[]).find(a=>a.id==='react-flame-v2-4-0');if(!f||!f.source||!f.source.repository)throw new Error('conformance flame row / source');console.log('CONFORMANCE-13-FLAME-WITH-SOURCE')"
```

`npm test` takes ~150s; the full suite must be green (T030/T033 additions included). `npm run trust:verify` WITHOUT `-- --offline` fails by design.

## Blocked permission

If evidence is missing, the contract conflicts with reality, or you need a file outside the contract, return status "blocked" with the question in open_questions instead of improvising. Specifically block, do not improvise, if: the fix needs anything beyond passing `runRecords` to the two call sites (name it); a sealed number or the freeze composite moves; `npm test` reveals a failure outside your contract (name it); or a verify command fails for a cause outside your contract.
