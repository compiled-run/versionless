Fable-Opus-Unit: bank-demo-fleet-pipeline-p1b/T016-acquire-unseen-app
Fable-Opus-Timeout-Minutes: 30

## Goal

Two things, both required: (1) an `acquire` operator stage — a consented, pinned, recorded fetch of an application source into `.versionless/work/<id>/baseline` that the generic `ingest` stage (T005) can consume without a per-app file; and (2) run it ONCE to acquire an application the pipeline has **genuinely never handled**, so the zero-intervention gate (T008) has a real unseen input.

Why. Every stage of `versionless run` is now generic — lane, install, build, ingest, license, era-cell, witness, report, intervention count. But acquiring an application still happens through per-app fixture modules (`packages/cli/src/fixture/*-ingest.ts`, 34 of them), and the one-entry `legacyCandidates` allowlist. The bank's repo will arrive as a path or a URL; the pipeline must take it from there.

Read first, briefly:

1. `packages/cli/src/acquisition/https-transaction.ts` — the consented HTTPS transaction (`consentId`, the `x-versionless-consent-id` header at :86). This is the ONLY way this repo fetches; use it, do not add a second fetch path.
2. One per-app ingest module that binds a source — e.g. `packages/cli/src/fixture/react-papercups-v1-0-0-ingest.ts` or whichever wrote `evidence/ingests/react-papercups-v1-0-0/source.json` — to see how a pinned archive is fetched, verified (`archiveParity`, `revision`, `normalizedManifestSha256`), and where it lands (`.versionless/cache/<id>-source/verify/extracted/…`, then `.versionless/work/<id>/baseline`).
3. `packages/cli/src/operator/ingest.ts` — what it needs from the tree (`--revision`, `--repository`, `--ref` when Git metadata is absent) so your acquisition record supplies them.
4. The candidate menus already scouted with verified pins: `.fable-opus/state/outcome-t007-s1-holdout-scout.json` (6 MIT holdout candidates at pinned tags — cypress-rwa was used, five remain), `.fable-opus/state/outcome-u2-react-candidate-scout.json`, `.fable-opus/state/outcome-a0-angular-candidate-scout.json`, `.fable-opus/state/outcome-u14-angular-cohort-two-scout.json`.

**Exclusion list — the app must be NONE of these** (T008 disqualifies anything the pipeline has handled): any id under `evidence/ingests/` (55 records), any directory under `.versionless/work/` (including the spike ones: `spikec-shlink-*` means shlink-web-client is handled, `spike-ngcc-1213` means pigallery2 is handled), any app with a module under `packages/cli/src/fixture/` or `packages/cli/src/witness/`, and anything in `packages/cli/src/fixture/legacy-candidate-ingest.ts`. Prefer a React CRA-era or an Angular 12–16 application with an OSI licence, a pinned tag, and (ideally) its own Cypress/Playwright suite so witness synthesis has something to read. Record why you chose it.

Deliver:

1. **`packages/cli/src/operator/acquire.ts`** — `versionless acquire <repository> --ref <tag-or-sha> --id <id> [--consent <id>] [--json]`: resolves the ref to a commit via the consented transaction, fetches the archive at that commit, verifies parity the way the existing ingests do, extracts to `.versionless/cache/<id>-source/…`, materializes `.versionless/work/<id>/baseline`, and writes `evidence/ingests/<id>/source.json` in the SAME shape the existing 15 source-bound records use (read one; match it). Named `PipelineRefusal`s (stage `acquire`, origin `pipeline`) for: no consent id, ref not resolvable, archive parity failure, licence file absent at pin. **Census coupling:** new refusal codes move the census, which the coverage report embeds, which `trust:verify` re-derives — so EITHER add codes AND regenerate trust (declare one dist rebuild first, T017 shape; `evidence/trust/current/**` is in your contract for exactly this) OR reuse existing codes where honest. Say which you did.
2. **Wire** into `OPERATOR_COMMANDS`, help, and (if codes were added) the census.
3. **Acquire one unseen application** with it, for real, from the menu above. Record in the receipt: repository, tag, resolved SHA, licence identifier and its blob sha, why chosen, and that it is absent from every exclusion list (show the checks).
4. **Prove it is consumable**: run `versionless ingest .versionless/work/<id>/baseline --json` (supplying `--revision/--repository/--ref` from your source.json if Git metadata is absent) → exit 0. Then run `versionless run .versionless/work/<id>/baseline --out <tmp> --json` ONCE and report its exit code and, if it refused, the refusal code verbatim — do NOT try to make it proceed; whatever it does on this app is the honest first reading T008 needs.
5. **Tests** in `packages/cli/test/operator-acquire.test.ts`: refusal on missing consent (no network); parity-failure refusal on a corrupted archive fixture; the source.json shape matches an existing record's keys. The live acquisition itself is `skipIf` no network / no consent — do not make CI fetch.

Budget: 30 minutes. **Start the verify chain by minute 15.** Emit your receipt even if a command is reported not re-run — the harness runs the block after a `completed` receipt. If you cannot finish, return `blocked` naming what is left, not `partial`.

## File contract

- `packages/cli/src/operator/**`
- `packages/cli/src/acquisition/**`
- `packages/cli/src/cli.ts`
- `packages/cli/test/operator-acquire.test.ts`
- `packages/cli/test/operator-flows.test.ts`
- `packages/cli/test/operator-refusal-census.test.ts`
- `evidence/runs/operator-flows/**`
- `evidence/ingests/**`
- `evidence/trust/current/**`

## Forbidden moves

- Do not write inside `packages/frameworks/react`, `packages/frameworks/angular`, `packages/core/src/migrations`, `packages/core/src/bundlers`, or `packages/core/src/analysis`. Why: sealed under freeze `27741d9c`.
- Do not fetch by any path other than the consented HTTPS transaction, and do not fetch without a recorded consent id. Why: locality/consent posture is gated and audited; an unconsented fetch is a defect the report cannot tally.
- Do not acquire anything on the exclusion list. Why: T008 must run on an app the pipeline has never handled; a handled app is the named misfire.
- Do not edit or delete any existing `evidence/ingests/<existing-id>/**` or any per-app fixture/witness module. Why: sealed producers and records.
- Do not modify `legacy-candidate-ingest.ts` to add the new app. Why: the whole point is that admission needs no allowlist entry.
- Do not run `npm run build` / `pnpm exec vp pack` EXCEPT once, first, if and only if you regenerate trust because you added refusal codes — and declare it. Why: gitignored provenance subject.
- Do not run `vp fmt` repo-wide. Why: 249 pre-existing files. Format only files you touched.
- Do not restate a bounded claim more generally. Why: derivation-guarded surfaces.

## Verification

```verify
npm run lint
npm test
npm run trust:verify -- --offline
npm run receipt:verify
node --experimental-strip-types packages/cli/src/cli.ts refusal-census --verify-only --json
test -n "$(ls -d .versionless/work/*/baseline 2>/dev/null | wc -l)" && test -n "$(ls evidence/ingests/*/source.json | wc -l)" && echo ACQUISITION-SURFACES-PRESENT
git diff --quiet HEAD -- packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis && echo FREEZE-INTACT
```

`npm test` takes ~150s; green baseline is 2621/2621 (+2 skipped). `npm run trust:verify` WITHOUT `-- --offline` fails by design. (The ACQUISITION-SURFACES-PRESENT check is deliberately weak because the new id is your choice; the receipt names it and the PM will verify the specific paths.)

## Blocked permission

If evidence is missing, the contract conflicts with reality, or you need a file outside the contract, return status "blocked" with the question in open_questions instead of improvising. Specifically block, do not improvise, if: no consent mechanism can be exercised without an owner-supplied consent id (name exactly what is needed); every candidate on the menus is on an exclusion list; the network refuses; or a verify command fails for a cause outside your contract.