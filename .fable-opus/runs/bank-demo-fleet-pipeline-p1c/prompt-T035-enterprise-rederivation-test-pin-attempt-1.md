Fable-Opus-Unit: bank-demo-fleet-pipeline-p1c/T035-enterprise-rederivation-test-pin
Fable-Opus-Timeout-Minutes: 15

## Goal

Two one-line fixes so the whole verify chain is green and the coverage report — which already reads and verifies `proven: 11` — is confirmed by every surface.

1. `packages/cli/src/enterprise/enterprise-report-run.ts:64` calls `analyzeCorpusConformance({ rootDir: root })` **without** run records — the third and last such site. It re-derives 12 source applications against a published enterprise report built from 13, so `report:enterprise --offline --verify-only` throws `enterprise-report.json does not match independent re-derivation`. Pass `runRecords: await readRunRecords(root)` exactly as `packages/trust/src/verify.ts:254` and `generate.ts:1925` do, plus the import from `../../trust/src/coverage-report.ts` (mirror the path style verify.ts uses). No new read path.

2. `packages/cli/test/corpus-conformance.test.ts:23` pins `sourceApplications: 12` for `corpus:verify`, which now correctly reports **13** (sealed 12 + the run-record application `react-flame-v2-4-0`). Update the expectation to 13 and say so in the assertion (a comment naming "12 sealed + 1 run-record") rather than a bare number.

Then run the chain. Do not regenerate trust (the package is right; `trust:verify --offline` is already green at digest `e8769266`). Do not run `vp pack`.

Budget: 15 minutes. Emit your receipt even if a command is reported not re-run — the harness runs the block after a `completed` receipt.

## File contract

- `packages/cli/src/enterprise/enterprise-report-run.ts`
- `packages/cli/test/corpus-conformance.test.ts`

## Forbidden moves

- Do not touch any file outside the two named. Why: everything else is verified green; this unit is two lines.
- Do not write inside `packages/frameworks/react`, `packages/frameworks/angular`, `packages/core/src/migrations`, `packages/core/src/bundlers`, or `packages/core/src/analysis`. Why: sealed under freeze `27741d9c`.
- **Do not run `git stash`, `git checkout -- <path>`, `git reset`, or `git clean`.** Why: ~60 uncommitted tranche files.
- Do not regenerate trust or run `vp pack`. Why: the emitted package is right; the last re-derivation site is what is wrong.

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
node -e "const r=require('./evidence/trust/current/coverage-report.json');const t=r.totals;if(t.proven!==11)throw new Error('proven '+t.proven);const f=r.applications.find(a=>a.id==='react-flame-v2-4-0');if(!f||f.status!=='proven'||f.provenanceOfStatus!=='run-record')throw new Error('flame row');const st=f.stages||[];if(st.length!==9||!st.every(x=>x.status==='ran'))throw new Error('stages');if(f.interventionCount!==0)throw new Error('count');const sealed=r.applications.filter(a=>a.provenanceOfStatus==='sealed-receipts');if(sealed.filter(a=>a.status==='proven').length!==10)throw new Error('sealed moved');console.log('COVERAGE proven=11 VERIFIED')"
node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline 2>&1 | grep -q "react: 6 counted of 6" && node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline 2>&1 | grep -q "angular: 4 counted of 4" && echo MATRIX-CELLS-UNCHANGED-6-6-4-4
```

`npm test` takes ~150s; expected 2708/2708 (+2 skipped) once the pin is updated. `npm run trust:verify` WITHOUT `-- --offline` fails by design.

## Blocked permission

If evidence is missing, the contract conflicts with reality, or you need a file outside the contract, return status "blocked" with the question in open_questions instead of improvising. Specifically block if: the fix needs anything beyond the two named lines; or a verify command fails for a cause outside your contract (name it).