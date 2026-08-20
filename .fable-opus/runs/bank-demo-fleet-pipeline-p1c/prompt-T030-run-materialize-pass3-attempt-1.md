Fable-Opus-Unit: bank-demo-fleet-pipeline-p1c/T030-run-materialize-pass3
Fable-Opus-Timeout-Minutes: 30

## Goal

Fix one small T007 defect, add one legibility code, run the third batch pass — the one where unseen apps can finally reach install, build, and witness.

**(a) `run` materializes by default.** `packages/cli/src/operator/run.ts:168` forwards `--materialize` to apply as an _opt-in_ flag, so `run`'s lane is a _composition_ — `index.html`, `package.json`, `vite.config.ts` — while `migrate --materialize` writes the full tree (source, `public/`, lockfile). Install operates on the lane, so through `run` it can never find a lockfile: yesterday's two batch passes refused all six apps `install.lockfile-absent` before any policy was consulted, and three of them ship `package-lock.json`. Make `run` materialize by default using the SAME path `migrate --materialize` uses (do not write a second lane writer); add `--compose-only` as the opt-out; the run record's apply row says which happened. Precedent that a materialized lane installs: `evidence/runs/operator-flows/lane-install-build.json` (T004: papercups, 428 packages, 11 outputs, host Node 24).

**(b) install legibility.** `install.ts:195-215` — when the frontend root ships a lockfile the stage does not read (`yarn.lock`, `pnpm-lock.yaml`, `bun.lockb`), refuse with a NEW code `install.lockfile-foreign` naming the file found and the lockfile kinds this stage reads (`package-lock.json`, `npm-shrinkwrap.json`). Never say `absent` when a lockfile is present. `lockfile-absent` stays verbatim for the truly-absent case.

**(c) Third batch pass**, name `t030-fleet-install-policies`, over `evidence/runs/fleet-batch/t029-react-fleet.json` (six baseline roots), with the three T004 install policies declared ONCE fleet-wide — `--allow-remote-tarballs --allow-install-scripts --allow-peer-conflicts` — NOTHING per app, `--publish`. Read `packages/cli/src/operator/batch.ts` for how flags forward and how `--name` works.

Expected shape, stated in advance so nobody is surprised: **antd-admin, coverview, flame** (ship `package-lock.json`) reach the install policies and then either install → build → witness → maybe `proven`, or refuse/defect at a named install or build code (a 2016–2022 CRA closure at Node 24 may well fail on node-sass or a peer tree — that is a real reading, report it, don't fight it per app); **cra-redux, your_spotify** refuse `install.lockfile-foreign` (yarn.lock); **colorme** refuses `install.lockfile-absent` (none). Report every row verbatim, how many reached build / witness / proven, coverage `totals` before and after, old→new trust digest, and — if anything reaches witness — its synthesized-journey outcome strings verbatim.

Read first: `run.ts:154-170` and `:440-470`; `apply.ts` / `lane.ts` for what `--materialize` writes; `install.ts:195-215`; `batch.ts` flag forwarding.

Budget: 30 minutes. **Land (a)+(b) with tests and start the batch by minute 12; start the verify chain by minute 20.** The batch may take longer than yesterday's (real installs); if pass 3 cannot finish, publish what ran and return `blocked` naming which apps did not complete — not `partial`. Emit your receipt even if a command is reported not re-run — the harness runs the block after a `completed` receipt.

## File contract

- `packages/cli/src/operator/**`
- `packages/cli/src/cli.ts`
- `packages/cli/test/**`
- `evidence/runs/**`
- `evidence/trust/current/**`

## Forbidden moves

- Do not write inside `packages/frameworks/react`, `packages/frameworks/angular`, `packages/core/src/migrations`, `packages/core/src/bundlers`, or `packages/core/src/analysis`. Why: sealed under freeze `27741d9c`. If an app needs the adapter widened, that is a finding.
- **Do not run `git stash`, `git checkout -- <path>`, `git reset`, or `git clean`.** Why: ~50 uncommitted tranche files; T028 stashed/popped them and tripped the scope guard on seven files.
- Do not set `VERSIONLESS_NETWORK_MODE=offline` on the batch or on `run`. Why: install must reach the registry; only publish steps are offline (batch already does that).
- Do not tune any declaration per app, and do not add a per-app declarations slot to the manifest. Why: T027 ruled it per-app tuning by force — the silent manual residue.
- Do not let the coverage report reach `proven` on any run whose stages are not all `ran`. Why: the T028 proven bar (charter standing constraint).
- Do not reword an existing refusal message; do not hand-edit anything under `evidence/`. Why: verbatim strings; emitted artifacts only.
- Do not run `vp pack` except via `--publish` (or once first if dist is stale, declared). Do not run `vp fmt` repo-wide. Why: provenance subject; 249 pre-existing files.
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
R="$(mktemp -d)"; node --experimental-strip-types packages/cli/src/cli.ts run .versionless/work/react-coverview-a1470b01/baseline --out "$R/lane" --json > "$R/run.json"; test -f "$R/lane/package-lock.json" && test -d "$R/lane/src" && echo RUN-MATERIALIZES-BY-DEFAULT
node -e "const f=require('./evidence/runs/fleet-batch/t030-fleet-install-policies/fleet-summary.json');const t=f.totals;if(t.applications!==6)throw new Error('apps');if(t.interventionCount!==0)throw new Error('interventions');const rows=Object.fromEntries(f.applications.map(a=>[a.id,a]));for(const id of ['react-antd-admin-template-v2-0-0','react-coverview-a1470b01','react-flame-v2-4-0']){const a=rows[id];if(a&&a.refusal&&a.refusal.code==='install.lockfile-absent')throw new Error(id+' still lockfile-absent though it ships package-lock.json')}console.log('PASS3 proven='+t.proven+' refusedByCode='+JSON.stringify(t.refusedByCode)+' defects='+t.defects)"
node -e "const r=require('./evidence/trust/current/coverage-report.json');if(r.totals.proven<10)throw new Error('sealed proven fell');for(const row of r.applications){if(row.status!=='proven'||row.provenanceOfStatus!=='run-record')continue;const s=row.stages||[];if(s.length===0||!s.every(x=>x.status==='ran'))throw new Error('proven row with stages not all ran: '+row.id)}console.log('COVERAGE proven='+r.totals.proven+' applications='+r.totals.applications)"
```

`npm test` takes ~150s; green baseline is 2686/2686 (+2 skipped). `npm run trust:verify` WITHOUT `-- --offline` fails by design.

## Blocked permission

If evidence is missing, the contract conflicts with reality, or you need a file outside the contract, return status "blocked" with the question in open_questions instead of improvising. Specifically block, do not improvise, if: materializing under `run` needs the frozen adapter or a second lane writer; the registry is unreachable (add ONE named `install.registry-not-reachable` per T027 and stop); any row shows `interventionCount > 0` (Phase 1 regression — name app and stage); publish moves a sealed number or the freeze composite; or a verify command fails for a cause outside your contract.
