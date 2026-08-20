Fable-Opus-Unit: bank-demo-fleet-pipeline-p1b/T013a-react-coverage-batch
Fable-Opus-Timeout-Minutes: 30

## Goal

The coverage grind, React batch: acquire **6–8 React applications the pipeline has never handled**, run them through `versionless batch --publish` **twice** — first with **zero** per-app declarations (each app's own era as read), then, only if `era-cell.node-major-not-inferable` dominates the first summary, once more with **one fleet-wide `--node <major>`** — and publish both fleet summaries. Every non-admitted app leaves its named refusal code. Every app that reaches `proven` moves the coverage report's proven-app count above the sealed 10 **by derivation, not by hand** — that is the whole tranche's oracle, and this unit is where it can first move.

Why this shape. The owner will run this on a bank's repo live. The runbook needs to say honestly: "N of 8 admitted with nothing declared; M of 8 with one fleet-wide declaration; the rest refused, by these codes." Two summaries give exactly that sentence.

Everything you need exists; you are operating it, not building it:
- `versionless acquire <owner/repo> --ref <tag> --id <id> --consent VL-LEGACY-CORPUS-2026-08-10 --json` (T016) — the ONLY fetch path; writes `.versionless/work/<id>/baseline` and `evidence/ingests/<id>/source.json`.
- `versionless batch --apps <manifest.json|roots…> --out <lane-root> --publish --json` (T021) — serial per app, harness per app, files `evidence/runs/<id>/run-record.json` + `.interventions.json`, writes `evidence/runs/fleet-batch/<name>/fleet-summary.{json,md}`, and `--publish` runs pack-if-stale → trust:generate → trust:verify → report:coverage. Read `packages/cli/src/operator/batch.ts` for how `--name` (or equivalent) sets the summary dir and how per-stage flags (`--node`, `--allow-peer-conflicts`, `--allow-remote-tarballs`, `--allow-install-scripts`, `--journeys`) are forwarded uniformly.
- Prior scouts left verified candidate menus: read the FULL JSON of `.fable-opus/state/outcome-u2-react-candidate-scout.json` and `outcome-t007-s1-holdout-scout.json`; if the outcome files carry only summaries, the shortlists are in the corresponding transcripts under `.fable-opus/runs/*/` — grep for the unit ids. You may also pick well-known public CRA-era React apps yourself if the menus are exhausted; the bar is: `react-scripts` declared in package.json (the frozen adapter admits CRA→Vite; ejected/umi/webpack trees refuse at plan), an OSI licence file at the pin, a pinned tag, small enough to install and build in budget, and ideally a single-major Node declaration (`.nvmrc` or `engines.node: "16.x"`) so era-cell reads it.

**EXCLUSION LIST — none of these**: any id under `evidence/ingests/` (56 today: `ls evidence/ingests`), any dir under `.versionless/work/`, any module under `packages/cli/src/fixture/` or `packages/cli/src/witness/`, anything in `legacy-candidate-ingest.ts`. Show the check for each chosen app in the receipt.

Do, in order:
1. Choose 6–8 candidates; for each record repo, tag, why chosen, and the exclusion check.
2. `acquire` each. A candidate whose acquisition refuses (licence absent, parity fail, ref unresolvable) is recorded with its code and replaced if you have spares; do not fight it.
3. Write a manifest of the acquired baselines; run `batch --publish` with the name `t013a-undeclared` and NO per-app flags. Read the summary: totals, per-app terminal classification and refusal code, `interventionCount` (must be 0 across the batch).
4. If `era-cell.node-major-not-inferable` is the modal refusal, run once more with the name `t013a-fleet-node` and a single fleet-wide `--node <major>` — choose the major most of the apps' own sources name (read their `.nvmrc`/CI/engines; say why) — and, if install then refuses on `install.peer-resolution-policy-not-declared`, you may add ONE fleet-wide `--allow-peer-conflicts` (a declared policy the summary records). Do NOT tune per app. If era-cell is not the modal refusal, skip the second run and say so.
5. Report VERBATIM: both summaries' totals; each app's row (id, classification, refusal code, interventionCount, elapsed); which stage each refused at; how many reached `proven`; the coverage report's proven-app count before and after publish (read `evidence/trust/current/coverage-report.json` `totals`); old→new trust digest; whether dist rebuilt; and — this matters — the exact stage-by-stage table for at least one app that got furthest, so the runbook can show what "proceeded" looks like.
6. If a real app exposes a **defect** (crash, hang, non-installable lane where the stage said it proceeded), that row is `defect:*` — record it as a finding with the app and stage; do NOT hand-fix product code unless it is a clearly small, clearly general bug (say what you changed). Refusals are not defects.

**Do NOT** run witness in parallel, tune flags per app, hand-edit any emitted record or trust artifact, run `vp pack` outside `--publish`, or touch the five frozen subtrees.

Budget: 30 minutes. Acquisition and install are the long poles: **have the first batch running by minute 12 and start the verify chain by minute 20.** If time is short, 6 apps and one summary beats 8 apps and none. Emit your receipt even if a command is reported not re-run — the harness runs the block after a `completed` receipt. If the batch cannot complete, return `blocked` naming what did and did not run — not `partial`.

## File contract

- `packages/cli/src/operator/**`
- `packages/cli/src/cli.ts`
- `packages/cli/test/**`
- `evidence/ingests/**`
- `evidence/runs/**`
- `evidence/trust/current/**`

## Forbidden moves

- Do not write inside `packages/frameworks/react`, `packages/frameworks/angular`, `packages/core/src/migrations`, `packages/core/src/bundlers`, or `packages/core/src/analysis`. Why: sealed under freeze `27741d9c`. If an app needs the adapter widened, that is a finding, not an edit.
- Do not fetch by any path other than `acquire` with the consent id, and do not acquire anything on the exclusion list. Why: consent/parity posture is audited; a handled app is the named misfire.
- Do not tune declarations per application. Why: per-app tuning is the manual authoring this tranche exists to remove; one fleet-wide declaration is a policy the summary records, per-app tuning is a hidden intervention.
- Do not edit any existing `evidence/ingests/<existing-id>/**`, any sealed `evidence/runs/<sealed-app>/**` receipt, or any per-app fixture/witness module. Why: sealed evidence.
- Do not hand-edit fleet summaries, run records, or anything under `evidence/trust/current/`. Why: emitted artifacts only.
- Do not run `vp fmt` repo-wide. Why: 249 pre-existing files.
- Do not describe any app as proven, admitted, or working unless the report row says `proven`. Why: bounded claims stay bounded; the report is the arbiter.

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
node -e "const fs=require('fs');const ds=fs.readdirSync('evidence/runs/fleet-batch').filter(d=>/undeclared/.test(d));if(!ds.length)throw new Error('no undeclared batch');const f=JSON.parse(fs.readFileSync('evidence/runs/fleet-batch/'+ds[ds.length-1]+'/fleet-summary.json','utf8'));if(f.totals.applications<6)throw new Error('fewer than 6 apps: '+f.totals.applications);if(f.totals.interventionCount!==0)throw new Error('interventions '+f.totals.interventionCount);console.log('REACT-BATCH apps='+f.totals.applications+' proven='+f.totals.proven+' refused='+f.totals.refused+' defects='+f.totals.defects)"
git diff --quiet HEAD -- packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis && echo FREEZE-INTACT
```

`npm test` takes ~150s; green baseline is 2672/2672 (+2 skipped). `npm run trust:verify` WITHOUT `-- --offline` fails by design.

## Blocked permission

If evidence is missing, the contract conflicts with reality, or you need a file outside the contract, return status "blocked" with the question in open_questions instead of improvising. Specifically block, do not improvise, if: fewer than 6 unseen CRA-era candidates can be found (name how many and which); the network or consent path refuses; any row shows `interventionCount > 0` (Phase 1 regression — stop and report exactly which app and stage); publish moves a sealed number or the freeze composite; or a verify command fails for a cause outside your contract.