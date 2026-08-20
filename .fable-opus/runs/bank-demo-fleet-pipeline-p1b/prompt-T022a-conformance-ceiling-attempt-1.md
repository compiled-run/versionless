Fable-Opus-Unit: bank-demo-fleet-pipeline-p1b/T022a-conformance-ceiling
Fable-Opus-Timeout-Minutes: 30

## Goal

Open the first of three derivation ceilings that make growing coverage a source edit: in `packages/core/src/corpus/conformance.ts`, replace the literal-union types on the summary (`verticals: 10 | … | 20`, `sourceApplications: 3 | … | 12` at :706-707) with derived numbers, and add a **derived** path by which an application admitted through `versionless run` (a run record with `interventions.count === 0` and terminal `proven`) enters the conformance summary — **beside, never instead of, the 18 hand-authored `CorpusTransactionState` members at :717-1010, which are sealed historical assertions and stay byte-identical.** The sealed numbers must reproduce exactly.

Why. T001 found: at 12 source applications the coverage report stops type-checking. Today, proving a 13th app requires editing this file — and if the coverage report is the last stage of `versionless run`, that edit is a human intervention inside the gated run. The oracle's coverage half ("proven-app count strictly above the sealed baseline") is unreachable while this ceiling stands. This unit is types + conformance only; capability-coverage (`provenApps` literals) is T022b and the receipt inventory in `generate.ts` is T022c.

Read first, briefly: `conformance.ts:690-1010` (the `CorpusConformance` interface, `summary`, and how the 18 members are consumed — find the function that builds `applications`/`summary` from them and where `sourceApplications` is computed), then how `packages/trust/src/generate.ts` calls into conformance to write `corpus-conformance.json`, then `evidence/trust/current/corpus-conformance.json` (the sealed output your change must reproduce byte-identically for the current corpus — check `summary` and the applications array), then `packages/trust/src/coverage-report.ts` `readRunRecords` (how a run-record application and its harness count are read; that is the input to your derived path).

Deliver:

1. **Types opened, honestly.** `summary.verticals` and `summary.sourceApplications` become `number`, and a runtime derivation asserts they equal (respectively) the count of verticals and the count of distinct source applications actually present in the arrays below them — so a hand-edited summary fails re-derivation. Keep `designatedPilotsVerified: 0` as-is (read why it is pinned before touching it; if it is a sealed assertion, leave it).
2. **Derived admission path.** A function (name it plainly, e.g. `deriveRunRecordApplications(runRecords)`) that maps run-record applications — `terminalClassification === 'proven'` AND harness `interventionCount === 0` AND every stage `ran` — into the same application-row shape the 18 members produce, with `provenanceOfStatus: 'run-record'` and the run record path + harness record path as basis. It contributes to `sourceApplications` and to `applications`. It does NOT create a `CorpusTransactionState` member and does NOT touch the 18. Where the corpus is built, the derived rows are appended after the sealed rows, deterministically ordered by id.
3. **Regression proof:** with ZERO run-record applications (the current state — no unseen app has reached `proven`), the emitted `corpus-conformance.json` must be BYTE-IDENTICAL to the sealed one apart from nothing. Add a test that builds conformance over the current corpus and compares to `evidence/trust/current/corpus-conformance.json`. Then a second test that feeds one synthetic proven run record (in a temp dir; not on disk in evidence) and asserts `sourceApplications` becomes 11 (or whatever sealed+1 is — read the sealed number) and the new row carries `provenanceOfStatus: 'run-record'`, and that a run record with `interventionCount 1` or a `refused:*` classification does NOT enter.
4. **Regenerate trust** (declare ONE dist rebuild first ONLY if `packages/cli/dist` is stale vs source — it currently is, by mtime, since T018–T023 changed CLI source; T017 shape: `pnpm exec vp pack` once, then `VERSIONLESS_NETWORK_MODE=offline npm run trust:generate -- --offline --policy trust/policy.json --output evidence/trust/current`). Freeze composite `27741d9c` must not move; sealed matrix verbatim (`angular: 4 counted of 4`, `react: 6 counted of 6`, `8 cross-proven of 58`); record old (`8b8f69b1…`) and new trust digest. If regenerating produces ANY diff in `corpus-conformance.json` beyond none, stop — that is a moved sealed number.

Budget: 30 minutes. **Start the verify chain by minute 15.** Emit your receipt even if a command is reported not re-run — the harness runs the block after a `completed` receipt. If you cannot finish, return `blocked` naming what is left, not `partial`.

## File contract

- `packages/core/src/corpus/conformance.ts`
- `packages/core/test/**`
- `packages/trust/src/generate.ts`
- `packages/trust/src/coverage-report.ts`
- `packages/trust/test/**`
- `evidence/trust/current/**`

## Forbidden moves

- Do not write inside `packages/frameworks/react`, `packages/frameworks/angular`, `packages/core/src/migrations`, `packages/core/src/bundlers`, or `packages/core/src/analysis`. Why: sealed under freeze `27741d9c`. (`packages/core/src/corpus` and `packages/core/src/receipts` are NOT frozen — verified against `adapter-freeze.json` `freeze.subtrees`.)
- Do not edit, reorder, or delete any of the 18 `CorpusTransactionState` members or their pinned counts. Why: sealed historical assertions; the derived path lands beside them.
- Do not raise a literal (e.g. `3 | … | 200`). Why: a bigger hardcoded union is the same defect with a later expiry — derive, do not widen.
- Do not touch `packages/core/src/receipts/capability-coverage.ts` or the `PRESERVED_RECEIPTS` inventory in `generate.ts`. Why: those are T022b and T022c under their own gates.
- Do not let a run-record application enter with `interventionCount > 0` or a non-`proven` terminal classification. Why: the coverage report's intervention rule; an unmeasured or non-zero count is not a proof.
- Do not hand-edit anything under `evidence/trust/current/`. Why: regenerated artifacts must be what the tools emit.
- Do not run `vp fmt` repo-wide. Why: 249 pre-existing files. Format only files you touched.
- Do not restate a bounded claim more generally. Why: derivation-guarded surfaces.

## Verification

```verify
npm run lint
npm test
npm run trust:verify -- --offline
npm run receipt:verify
node --experimental-strip-types packages/cli/src/cli.ts report:enterprise --offline --verify-only
node --experimental-strip-types packages/cli/src/cli.ts report:coverage --offline --verify-only
node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline
node -e "const f=require('./evidence/trust/current/adapter-freeze.json');if(!String(f.freeze.composite).startsWith('27741d9c'))throw new Error('freeze composite moved: '+f.freeze.composite);console.log('FREEZE-COMPOSITE-STABLE')"
node -e "const c=require('./evidence/trust/current/corpus-conformance.json');const s=c.summary;if(typeof s.sourceApplications!=='number'||typeof s.verticals!=='number')throw new Error('summary not numeric');console.log('CONFORMANCE-SUMMARY sourceApplications='+s.sourceApplications+' verticals='+s.verticals)"
git diff --quiet HEAD -- packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis && echo FREEZE-INTACT
```

`npm test` takes ~150s; green baseline is 2646/2646 (+2 skipped). `npm run trust:verify` WITHOUT `-- --offline` fails by design.

## Blocked permission

If evidence is missing, the contract conflicts with reality, or you need a file outside the contract, return status "blocked" with the question in open_questions instead of improvising. Specifically block, do not improvise, if: opening the types requires touching a frozen subtree; the derivation cannot reproduce the sealed `corpus-conformance.json` byte-identically for the current corpus; a sealed matrix number or the freeze composite moves on regeneration; or a verify command fails for a cause outside your contract.