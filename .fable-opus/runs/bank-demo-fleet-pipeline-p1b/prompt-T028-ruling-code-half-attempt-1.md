Fable-Opus-Unit: bank-demo-fleet-pipeline-p1b/T028-ruling-code-half
Fable-Opus-Timeout-Minutes: 30

## Goal

Land the T027 Judge ruling, code half, in this order — **(0) first, and prove it before anything else**:

**(0) ANTI-LAUNDERING.** `packages/trust/src/coverage-report.ts` `applyInterventionRule` (:183-219) reaches `proven` on `outcome === 'proceeded'` + harness count 0 and **never reads the stages** — weaker than `intervention-count.ts:324-336` (`defect:stages-not-all-run` unless every stage `ran`) and `conformance.ts:749-753` (same). Tighten it: `proven` ONLY when the run record's stages ALL read `ran` AND the harness count is 0; a proceeded run with not-run stages becomes `not-admitted` with a named `statusReason` (e.g. `stages-not-all-ran`). This is a tightening — it cannot create a proven row — and all current run-record rows are refused, so the regenerated report totals must stay exactly `{applications 21, proven 10, bounded 2, refused 8, 'not-admitted' 1}`. Add a test that a synthetic proceeded-but-partial run is not proven. Prove totals unchanged before continuing.

**(1) era-cell — the over-reach.** The stage conflates two questions: *which era were the authors on* (unanswerable when nothing is declared) and *which runtime will the lane this pipeline composes be installed and built in* (determinate — this process's runtime; precedented by `evidence/runs/operator-flows/lane-install-build.json`: papercups lane, 428 packages, 11 outputs, host `v24.15.0`, zero hand-authored files — the sealed React cells were proven with the migrated lane at host Node). Split `RequiredCell` into `runtime { major, version, source, readFrom, basis, claim }` and `era { outcome: 'read' | 'not-read', declared, readFrom, consultedSources, claim }`. When the lineage publishes no target-cell registry and no era is read, **proceed** on the runtime the install/build stages will use, `runtime.basis` quoting `lane-install-build.json`, `era.outcome: 'not-read'`, `era.claim` stating that nothing establishes the authored era. `readNodeMajorSources` must report **every** consulted source including absent ones as `{ source, text: null, majors: null, present: false }` — today "nothing declared" is indistinguishable from "did not look". Add the `notEstablished` lines from `docs/goals/bank-demo-fleet-pipeline/notes/T027-react-batch-ruling.md` §1 verbatim. Keep `era-cell.cell-not-declared-for-framework` with its string **verbatim**, narrowed to lineages with no lane runtime either.

**(2) Range satisfaction — a reading, not a floor.** Add a declared-range SATISFACTION check populating ONLY `runtime.satisfiedByDeclaredRange: boolean` (`24 ∈ [10,∞)` → true). No number ever leaves a range into an era field; `nodeMajorsOfDeclaration` (`era-cell.ts:339-366`) is **untouched**. New refusal `era-cell.declared-range-excludes-the-lane-runtime` when the range does not contain the runtime major. Add §2's `notEstablished` lines verbatim.

**(3) ingest — walk up, read by lineage.** `acquisitionLaneOf` (`ingest.ts:220-229`) exact-matches `.versionless/work/<id>/baseline`; make it walk UP to the nearest enclosing acquisition root, gated by walking THAT tree and matching the journalled `archiveParity` digest (the four existing gates unchanged). Read the frontend root **by lineage** across the root and its immediate subdirectories (`ingest.ts:405-426` reads by manifest presence today): exactly one manifest declaring react/next/angular is read; zero or several refuse naming all candidates and each manifest's reading; record `frontendRootBasis`. Read the identifier from the journal under the same five gates when `package.json` has no `name`, with `idReadFrom` naming it *an operator declaration made at acquire time* (never a directory name). Propagate the frontend root from ingest to analyze, era-cell, plan, apply in `run.ts` and print both roots in the run record.

Then regenerate census and trust in-unit (declared dist rebuild first ONLY if stale by mtime; T017 shape). Freeze composite `27741d9c` stable; sealed matrix verbatim (`react: 6 counted of 6`, `angular: 4 counted of 4`, `8 cross-proven of 58`). No re-batch here — that is T029.

Read first: `notes/T027-react-batch-ruling.md` §0–§3 (record fields, codes, notEstablished lines are specified there — use them verbatim), then the exact line ranges named above.

Verify targets you must satisfy: `.versionless/work/react-colorme-2019-06-06/baseline` (declares no era anywhere) must get PAST era-cell (its terminal classification must no longer be either era-cell code); `.versionless/work/react-flame-v2-4-0/baseline` (Express root manifest, CRA app in `client/`) must get PAST ingest (no longer `revision-not-determined` / `identifier-not-determined`). Wherever they refuse next is fine and expected — report it verbatim.

Budget: 30 minutes. **Start the verify chain by minute 15.** If time runs short, land (0)+(1)+(2) fully with tests and return `blocked` naming (3) as remaining — NOT `partial`. Emit your receipt even if a command is reported not re-run — the harness runs the block after a `completed` receipt.

## File contract

- `packages/cli/src/operator/**`
- `packages/cli/src/acquisition/**`
- `packages/core/src/acquisition/**`
- `packages/trust/src/coverage-report.ts`
- `packages/cli/src/cli.ts`
- `packages/cli/test/**`
- `packages/trust/test/**`
- `evidence/runs/**`
- `evidence/ingests/**`
- `evidence/trust/current/**`

## Forbidden moves

- Do not write inside `packages/frameworks/react`, `packages/frameworks/angular`, `packages/core/src/migrations`, `packages/core/src/bundlers`, or `packages/core/src/analysis`. Why: sealed under freeze `27741d9c`.
- Do not take a Node major out of an engines range into any era field, and do not alter `nodeMajorsOfDeclaration` (`era-cell.ts:339-366`). Why: T008 and T027 both drew this line — a satisfaction boolean is a reading, a floor is a guess.
- Do not choose a frontend root by position, take an identifier from a directory name, or add a fleet-wide `--frontend-root` / per-app declarations slot. Why: T027 ruled these per-app tuning by force — the silent manual residue.
- Do not let the coverage report reach `proven` on any run whose stages are not all `ran`. Why: the proven bar; the report must not be the weakest of the three surfaces.
- Do not reword an existing refusal message. Why: T004 rule — reproduce verbatim.
- Do not run `pnpm exec vp pack` except once, first, if dist is stale — and declare it. Why: gitignored provenance subject.
- Do not hand-edit anything under `evidence/trust/current/` or `evidence/runs/`. Why: emitted artifacts only.
- Do not run `vp fmt` repo-wide. Why: 249 pre-existing files. Format only files you touched.
- Do not restate a bounded claim more generally. Why: derivation-guarded surfaces.

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
node -e "const r=require('./evidence/trust/current/coverage-report.json');if(JSON.stringify(r.totals)!==JSON.stringify({applications:21,proven:10,bounded:2,refused:8,'not-admitted':1}))throw new Error('totals moved: '+JSON.stringify(r.totals));for(const row of r.applications){if(row.status!=='proven'||row.provenanceOfStatus!=='run-record')continue;const s=row.stages||[];if(s.length===0||!s.every(x=>x.status==='ran'))throw new Error('proven row with stages not all ran: '+row.id)}console.log('PROVEN-BAR-TIGHTENED totals unchanged')"
R="$(mktemp -d)"; VERSIONLESS_NETWORK_MODE=offline node --experimental-strip-types packages/cli/src/cli.ts intervention-count .versionless/work/react-colorme-2019-06-06/baseline --out "$R/lane" --record "$R/run.json" --json > "$R/ic.json"; node -e "const j=require('$R/ic.json');if(j.interventionCount!==0)throw new Error('interventions');if(/era-cell\.cell-not-declared-for-framework|era-cell\.node-major-not-inferable/.test(j.terminalClassification))throw new Error('era-cell still refuses: '+j.terminalClassification);console.log('COLORME-PAST-ERA-CELL '+j.terminalClassification)"
R="$(mktemp -d)"; VERSIONLESS_NETWORK_MODE=offline node --experimental-strip-types packages/cli/src/cli.ts intervention-count .versionless/work/react-flame-v2-4-0/baseline --out "$R/lane" --record "$R/run.json" --json > "$R/ic.json"; node -e "const j=require('$R/ic.json');if(j.interventionCount!==0)throw new Error('interventions');if(/ingest\.revision-not-determined|ingest\.identifier-not-determined/.test(j.terminalClassification))throw new Error('ingest still refuses: '+j.terminalClassification);console.log('FLAME-PAST-INGEST '+j.terminalClassification)"
```

`npm test` takes ~150s; green baseline is 2672/2672 (+2 skipped). `npm run trust:verify` WITHOUT `-- --offline` fails by design.

## Blocked permission

If evidence is missing, the contract conflicts with reality, or you need a file outside the contract, return status "blocked" with the question in open_questions instead of improvising. Specifically block, do not improvise, if: (0) cannot be tightened without moving a current total; any of the rulings would require an inference T027 forbade; the freeze composite or a sealed matrix number moves; a harness run shows `interventionCount > 0`; or a verify command fails for a cause outside your contract.