Fable-Opus-Unit: bank-demo-fleet-pipeline/T018-era-cell-stage
Fable-Opus-Timeout-Minutes: 30

## Goal

Add an `era-cell` operator stage: the Node/toolchain cell an application needs is inferred from analyze readings or declared by flag, provisioned by the pipeline when the host can provide it, and refused with a named `PipelineRefusal` (origin `pipeline`, stage `era-cell`) when it cannot — including the x64/Rosetta requirement for node-sass-bearing applications on arm64 hosts. This is the last of the three admission parameters (ingest, license-at-pin, era-cell) that today live in per-app fixture code; after this unit an unseen app's admission requires no hand-authored file.

Context you must read first, in this order:

1. `packages/cli/src/operator/analyze.ts` — there is already cell vocabulary: `cell: string | null` at :58, `AngularTargetCell` with default `ANGULAR_16_BROWSER_CELL` at :232 and :291, and an honesty line at :82 that says verbatim "Detection reads declarations. Nothing here establishes that this application installs, compiles, builds, or behaves as it did on its era toolchain." **Extend this vocabulary; do not invent a parallel one.** Read what analyze already reads about engines, lockfile toolchain pins, and framework versions.
2. `packages/cli/src/operator/ingest.ts` and `packages/cli/src/operator/license.ts` — the two stages the previous unit landed. Match their shape exactly: opt-in flag on `migrate`, `runOperatorCommand` entry, `--json`, exit 2 refusal / 1 defect / 0 proceeded, refusals via `PipelineRefusal` from `refusals.ts`, codes added to the census producer in `refusal-census.ts`.
3. `packages/cli/src/operator/install.ts` and `build.ts` — declared policies with refusing defaults (three npm policies). Host-cell policy follows the same pattern.
4. `evidence/spikes/thin-wrapper-cost/verdict.json` — the `host` block records `platform: darwin-arm64`, `nodeEraCellsInstalled: ["v24.15.0"]`, and elsewhere the finding that node-sass has no arm64 binding at any Node with "no remedy available on this host". That is the canonical refusal condition this stage must name.
5. `evidence/spikes/ngcc-1213-feasibility/verdict.json` — the honest Angular 13 cell is Angular 13.4.0 / Node 16 with real ngcc and rxjs 6. The stage must be able to DESCRIBE that cell as a target even though provisioning it is a later unit (T009); today it may refuse with a named "cell not installed on host" code.

Deliver:

1. `packages/cli/src/operator/era-cell.ts`: reads analyze output plus lockfile/engines to determine the required cell (Node major at minimum; architecture requirement when a native dependency with no arm64 binding is present — node-sass is the known case, read the lockfile for it rather than hardcoding a single name if the primitives allow a list). `--node`, `--arch`, `--cell` declare what cannot be inferred. Emits a record `versionless.era-cell.v1` with: required cell, how it was determined (inferred fields vs declared), host readings (platform, arch, installed Node versions if discoverable — read what spike C's `host` block read), and outcome `provisioned | already-present | refused`.
2. Provisioning: when the required Node is present on the host, record it and proceed. If a version manager is discoverable and can supply it without network, use it and say which. If it cannot be provided, refuse — do NOT document a manual install step. Named refusals at minimum: `era-cell.node-major-not-inferable`, `era-cell.required-node-not-installed`, `era-cell.arch-not-available` (the node-sass-on-arm64 case), `era-cell.cell-not-declared-for-framework`. Use the exact codes or better ones in the same style; every code goes in the census.
3. Wired into `OPERATOR_COMMANDS`, `PIPELINE_STAGES`, and `migrate` behind opt-in `--era-cell`, ordered BEFORE install (install runs inside the cell). Keep the migrate exit-0 verify path registry-free and cell-agnostic: with no `--era-cell` flag the stage records "not run: not declared" the way install/build do.
4. Census regenerated (`refusal-census` command) with the new stage; `refusal-census --verify-only` must match.
5. Tests in `packages/cli/test/operator-era-cell.test.ts`: (a) an app whose lockfile pins node-sass on an arm64 host refuses with `era-cell.arch-not-available` and exit 2 — simulate the host reading, do not depend on the CI machine's arch; (b) an app whose required Node major equals the running Node proceeds with `already-present`; (c) an app with no inferable Node major and no `--node` refuses by name.

Do NOT provision the Angular 13 / Node 16 cell itself — that is T009. Do NOT touch witness. Do NOT change any file under the five frozen subtrees.

## File contract

- `packages/cli/src/operator/**`
- `packages/cli/src/cli.ts`
- `packages/cli/test/operator-era-cell.test.ts`
- `packages/cli/test/operator-flows.test.ts`
- `packages/cli/test/operator-refusal-census.test.ts`
- `evidence/runs/operator-flows/**`

## Forbidden moves

- Do not write inside `packages/frameworks/react`, `packages/frameworks/angular`, `packages/core/src/migrations`, `packages/core/src/bundlers`, or `packages/core/src/analysis`. Why: sealed under freeze `27741d9c`; a write there is freeze motion, authorised once later on a separate isolated unit.
- Do not run `npm run build` or `pnpm exec vp pack`. Why: `packages/cli/dist/**` is gitignored AND a provenance subject; a rebuild silently turns `trust:verify --offline` red and makes `supported-matrix` refuse to render — a state `git status` cannot show. Trust was regenerated minutes ago at digest `c9941f8f`; leave dist alone.
- Do not run `vp fmt` repo-wide. Why: 249 pre-existing files reformat (the format epoch, a later unit). Format only the files you touched.
- Do not invent a second refusal vocabulary or a second cell vocabulary. Why: refusals must stay countable through one census, and analyze already carries `cell`.
- Do not describe a manual step as a workaround anywhere in code, output, or evidence. Why: the owner outcome is zero manual steps; a documented manual step is a refusal that lied about its status.
- Do not restate any bounded claim more generally. Why: coverage claims are derivation-guarded.

## Verification

```verify
npm run lint
npm test
npm run trust:verify -- --offline
npm run receipt:verify
node --experimental-strip-types packages/cli/src/cli.ts refusal-census --verify-only --json
git diff --quiet HEAD -- packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis && echo FREEZE-INTACT
```

`npm test` takes ~150s; green baseline is 2545/2545. `npm run trust:verify` WITHOUT `-- --offline` fails by design.

## Blocked permission

If evidence is missing, the contract conflicts with reality, or you need a file outside the contract, return status "blocked" with the question in open_questions instead of improvising. Specifically block, do not improvise, if: analyze does not surface enough to infer a Node major and adding that reading needs a file under `packages/core/src/analysis` (frozen); provisioning a cell requires host changes outside the pipeline's control and you are tempted to document a manual step; or a verify command fails for a cause outside your contract.