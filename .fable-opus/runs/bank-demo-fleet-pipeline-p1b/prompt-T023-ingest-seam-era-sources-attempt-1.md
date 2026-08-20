Fable-Opus-Unit: bank-demo-fleet-pipeline-p1b/T023-ingest-seam-era-sources
Fable-Opus-Timeout-Minutes: 30

## Goal

Close both admission walls the Phase 1 gate exposed, **in this order**:

**(1) THE INGEST SEAM — the hard blocker.** `run`'s ingest stage must read the pinned revision from the pipeline's OWN consent-journalled acquisition receipt at `evidence/ingests/<id>/source.json` when the tree carries no `.git`. Today `acquire` (T016) resolves `commitSha` through the consented transaction, verifies parity, and writes it to `source.json` — and then `ingest` refuses with `ingest.revision-not-determined` because `packages/cli/src/operator/ingest.ts:187-207` reads revision only from `.git/HEAD`, `.git/<ref>`, `.git/packed-refs`. `RUN_STAGES` at `packages/cli/src/operator/run.ts:134-144` excludes `acquire`. **Result: every application `acquire` ever fetches refuses at stage 2 of 9.** That blocks the entire coverage grind, and it hides a manual step (`--revision` pre-declared) the intervention counter cannot see. Fix: when `.git` is absent, ingest looks up `evidence/ingests/<id>/source.json` (id inferred as ingest already infers it, or from `--id`), and reads `commitSha` from it — recording the journal path, `consentId`, and parity basis in the EXISTING `commitShaSource` / `readFrom` field — and refuses with a named code when the journal's `result` is not `source-bound`, or when its `normalizedManifestSha256` does not match the tree on disk (recompute it the way ingest already does). Reading the journal is offline. Do NOT add `acquire` to `RUN_STAGES` and do NOT fetch inside `run`.

**(2) ERA-CELL SOURCE WIDENING** — per the T008 honesty ruling, verbatim: precedence `--node`/`--cell` → frozen cell `nodeLine` → `.nvmrc`/`.node-version` → `package.json#volta.node` → `.tool-versions` → `Dockerfile*` `FROM <image>:<numeric-major>` → `.github/workflows/**` `node-version`|`node_version` → `package.json#engines.node`. Conditions: a tag or word carrying no numeric major (`latest`, `lts`, `current`, `lts/gallium`, `latest-browsers`) is unreadable residue, never a cell — the treatment `packages/cli/src/operator/era-cell.ts:306-316` already gives `.nvmrc` words. A source naming MORE than one major (CI matrix `[12.x, 14.x]`) is REFUSED, never picked from. Two sources each naming a different single major is a NEW refusal `era-cell.node-major-sources-disagree` listing every source and its literal text. **NO floor rule for open engines ranges** — `nodeMajorsOfDeclaration` (`era-cell.ts:339-366`) keeps returning null for an open lower bound; the ruling found this very app declares `>=10.0.0` while its own CI ran 12 and 14, so a floor would pick 10 confidently and wrongly. **Every consulted source and its literal reading goes on the record**, not just the winner.

**Expected re-gate outcome, stated in advance so nobody is surprised:** on `.versionless/work/react-ant-design-pro-v5-2-0/baseline`, terminal classification moves OFF `refused:ingest.revision-not-determined` to an **era-cell refusal naming four consulted sources** — `engines.node >=10.0.0` (open), `.github/workflows/ci.yml node_version [12.x, 14.x]` (multiplicity), `Dockerfile FROM circleci/node:latest-browsers` and `Dockerfile.dev FROM node:latest` (residue). Different classification, still a refusal, `interventionCount` still 0. **Do not present this unit as admitting ant-design-pro.** It buys legibility and unblocks the class.

Read first, briefly: `ingest.ts:150-360` (id inference, revision reading, the refusal at :352, `normalizedManifestSha256`), `evidence/ingests/react-ant-design-pro-v5-2-0/source.json` (the shape you read: `result`, `commitSha`, `consentId`, `normalizedManifestSha256`, parity fields), `era-cell.ts:280-400` (current sources, `nodeMajorSource`/`nodeMajorReadFrom`, residue handling, `nodeMajorsOfDeclaration`), and `packages/cli/src/operator/refusal-census.ts` (where new codes register).

Deliver: the two changes above; tests in `operator-ingest.test.ts` (journal read → revision; non-source-bound journal → named refusal; manifest mismatch → named refusal; `.git` present → journal ignored) and `operator-era-cell.test.ts` (each new source in precedence; residue tags refused as unreadable; multiplicity refused; disagreement refusal listing both; open range still null; every consulted source on the record); `operator-run.test.ts` updated for the new mycrypto/ant-design-pro classifications if they change; census regenerated; **trust regenerated** because new refusal codes move the census the coverage report embeds (declare ONE dist rebuild first only if dist is stale vs source — check mtimes; T017 shape) — freeze composite `27741d9c` must not move, sealed matrix numbers must reproduce verbatim, record old (`2b6f6d1d…`) and new trust digest.

Budget: 30 minutes. **Start the verify chain by minute 15.** The verify block is long (two full harness runs); emit your receipt even if a command is reported not re-run — the harness runs the block after a `completed` receipt. If you cannot finish both halves, land half (1) fully with its tests and return `blocked` naming half (2) as remaining — NOT `partial`.

## File contract

- `packages/cli/src/operator/**`
- `packages/cli/src/cli.ts`
- `packages/cli/test/operator-era-cell.test.ts`
- `packages/cli/test/operator-ingest.test.ts`
- `packages/cli/test/operator-run.test.ts`
- `packages/cli/test/operator-refusal-census.test.ts`
- `evidence/runs/operator-flows/**`
- `evidence/trust/current/**`

## Forbidden moves

- Do not write inside `packages/frameworks/react`, `packages/frameworks/angular`, `packages/core/src/migrations`, `packages/core/src/bundlers`, or `packages/core/src/analysis`. Why: sealed under freeze `27741d9c`.
- Do not have ingest trust a journal that lacks a `consentId` or parity basis, or whose `result` is not `source-bound`. Why: a journal without consent and parity is not a reading; refusing it by name is the honest outcome.
- Do not add `acquire` to `RUN_STAGES` or perform any network fetch inside `run`. Why: `run` must stay offline-consistent; sequencing acquisition into it is a PM decision, not a widening.
- Do not pick one major from a source naming several, and do not take the floor of an open engines range. Why: the T008 ruling forbids both as guessing; refuse and name the sources.
- Do not read a floating image tag (`latest`, `lts`, `current`, `latest-browsers`) as a major. Why: it resolves today to something the authors never used.
- Do not hand-edit anything under `evidence/trust/current/` or `evidence/runs/operator-flows/`. Why: regenerated artifacts must be what the tools emit.
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
node -e "const f=require('./evidence/trust/current/adapter-freeze.json');if(!String(f.freeze.composite).startsWith('27741d9c'))throw new Error('freeze composite moved: '+f.freeze.composite);console.log('FREEZE-COMPOSITE-STABLE')"
git diff --quiet HEAD -- packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis && echo FREEZE-INTACT
R="$(mktemp -d)"; VERSIONLESS_NETWORK_MODE=offline node --experimental-strip-types packages/cli/src/cli.ts intervention-count .versionless/work/react-ant-design-pro-v5-2-0/baseline --out "$R/lane" --record "$R/run.json" --json > "$R/ic.json"; node -e "const j=require('$R/ic.json'); if(j.interventionCount!==0) throw new Error('intervention count moved: '+j.interventionCount); if(j.terminalClassification==='refused:ingest.revision-not-determined') throw new Error('terminal classification unchanged - ingest still refuses'); if(String(j.terminalClassification).startsWith('defect')) throw new Error('defect: '+j.terminalClassification); console.log('RE-GATE-ADVANCED '+j.terminalClassification)"
node --experimental-strip-types packages/cli/src/cli.ts supported-matrix --offline
```

`npm test` takes ~150s; green baseline is 2630/2630 (+2 skipped). `npm run trust:verify` WITHOUT `-- --offline` fails by design.

## Blocked permission

If evidence is missing, the contract conflicts with reality, or you need a file outside the contract, return status "blocked" with the question in open_questions instead of improvising. Specifically block, do not improvise, if: reading the journal would require ingest to trust an unconsented or non-parity-gated record; closing the ingest seam would require `acquire` in `RUN_STAGES` or a fetch inside `run`; any inference would need a pick-from-several or a floor; trust cannot be regenerated inside the contract; the re-gate shows `interventionCount > 0` or a `defect:*` classification (Phase 1 regression); or a verify command fails for a cause outside your contract.