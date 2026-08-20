Fable-Opus-Unit: bank-demo-fleet-pipeline/T019-synthesized-witness-default
Fable-Opus-Timeout-Minutes: 30

## Goal

Make synthesized journeys the default witness path when no hand-authored driver exists for an application: `witness:real-app` consumes the journeys T006 synthesizes, runs them **serialized** against a real baseline/migrated lane pair on this host, and records bounded outcomes through the generic receipt module — with the replayability ratio stated as a first-class field, never hidden.

Why. Witness authoring was ~48% of the last big tranche. T006 (unit `T006a-journey-synthesis-core`, done minutes ago) built the synthesizer: `packages/cli/src/witness/journey-synthesis/{types,ast,files,selectors,vocabulary,cypress,playwright,crawl,emit}.ts` and the `witness-synthesize` operator command in `packages/cli/src/operator/witness-synthesize.ts`. It emits `JourneyEvidence`-shaped journeys (now `export`ed from `packages/cli/src/witness/real-app-run.ts`) with a closed vocabulary that rejects verdict words by construction. Nothing runs them yet. This unit runs them.

Read first, in this order:

1. `packages/cli/src/witness/journey-synthesis/emit.ts` and `types.ts` — what a synthesized journey looks like and what it claims to measure.
2. `packages/cli/src/witness/journey-synthesis/vocabulary.ts` — the CLOSED outcome set and its rejection patterns. Every outcome you record must come from here; if you need a new bounded string, add it here AND to the honesty test in `packages/cli/test/witness-journey-synthesis.test.ts`.
3. `packages/cli/src/witness/real-app-run.ts` — the generic runner: how it selects a per-app driver today, how it serves lanes, how it serializes passes, how the locality gate (`successfulNonLoopback: 0`) is enforced, what `runWitnessRealApps` / `verifyWitnessRealApps` do.
4. `packages/core/src/receipts/witness-real-app.ts` — the generic receipt module; where a `journeySource: 'hand-authored' | 'synthesized-e2e' | 'synthesized-crawl'` and a replayability ratio would live.
5. `packages/cli/src/witness/react-papercups-run.ts` (hand-authored driver, if present under that or a similar name) — because papercups is your primary target and HAS a hand-authored path; your record must say which path was taken and why.

Target lane pair, verified on disk before dispatch: `.versionless/work/react-papercups-v1-0-0/baseline/build` and `.versionless/work/react-papercups-v1-0-0/target/build-vite`, both with `node_modules` present. Papercups has NO Cypress/Playwright suite that I know of — verify; if absent, the crawl fallback is the path, and that is a legitimate and interesting first case. If budget remains, second target `.versionless/work/react-cypress-rwa/target/build-vite` (its own Cypress suite yields 82 journeys / 9 replayable per T006) — but its baseline has no build on disk, so witness it single-lane only if the runner supports that honestly, otherwise skip and say so.

Deliver:

1. **Driver selection with a stated reason.** In `real-app-run.ts` (or an adjacent module in `journey-synthesis/`), when `witness:real-app` is asked to witness an app: if a hand-authored driver is registered for it, use it and record `journeySource: 'hand-authored'`; otherwise call the synthesizer (e2e readers first, crawl fallback) and record `journeySource: 'synthesized-e2e' | 'synthesized-crawl'`. Add a flag `--journeys synthesized` to FORCE the synthesized path even when a hand-authored driver exists (so papercups can be a controlled comparison) — the record must say the driver was overridden.
2. **Serialized execution.** Run synthesized journeys against the lane pair through the runner's existing serve/measure machinery — one lane pair at a time, one journey at a time. Do not introduce parallel witness. Reuse the runner's playwright host and locality gate; do not fork them.
3. **Record.** Extend `witness-real-app.ts` (generic module ONLY) with: `journeySource`, `synthesized: { total, replayable, ran, unhandledByKind: {...} }`, per-journey bounded outcome string from the vocabulary, and locality (`successfulNonLoopback` must be 0). Write the run to `evidence/runs/witness-synthesized/<app>/…` (new evidence dir; do not write into any sealed per-app evidence dir).
4. **`--witness` stage on `migrate`**, opt-in like `--install/--build/--ingest/--era-cell`, ordered after build; no flag records not-run. It invokes the same path as `witness:real-app`.
5. **Tests** in `packages/cli/test/witness-real-app-synthesized.test.ts`: (a) driver selection picks hand-authored when registered and synthesized otherwise, and `--journeys synthesized` overrides with the override recorded; (b) the record type carries the ratio and it is asserted non-optional; (c) `skipIf` the papercups lane pair is absent: run the synthesized path against it end to end on this host and assert `successfulNonLoopback === 0`, `journeySource` is a synthesized value, and every outcome string is in the vocabulary. Include a hermetic variant that serves two static HTML pages on loopback and witnesses a crawl-synthesized 2-route journey unconditionally.

Do NOT rewrite any hand-authored `*-run.ts` driver or per-app `witness-*.ts` receipt module. Do NOT weaken the vocabulary or the honesty test.

## File contract

- `packages/cli/src/witness/real-app-run.ts`
- `packages/cli/src/witness/journey-synthesis/**`
- `packages/cli/src/operator/**`
- `packages/cli/src/cli.ts`
- `packages/core/src/receipts/witness-real-app.ts`
- `packages/cli/test/witness-journey-synthesis.test.ts`
- `packages/cli/test/witness-real-app-synthesized.test.ts`
- `packages/cli/test/operator-flows.test.ts`
- `packages/cli/test/operator-refusal-census.test.ts`
- `evidence/runs/operator-flows/**`
- `evidence/runs/witness-synthesized/**`

## Forbidden moves

- Do not write inside `packages/frameworks/react`, `packages/frameworks/angular`, `packages/core/src/migrations`, `packages/core/src/bundlers`, or `packages/core/src/analysis`. Why: sealed under freeze `27741d9c`.
- Do not edit any `packages/cli/src/witness/*-run.ts` other than `real-app-run.ts`, or any `packages/core/src/receipts/witness-*.ts` other than `witness-real-app.ts`, or any file under an existing `evidence/runs/witness-*` directory. Why: sealed evidence producers and their published records.
- Do not run two witness passes concurrently, and do not add a parallel path. Why: determinism-under-load finding — witness must serialize per host.
- Do not let any journey leave loopback. Why: `successfulNonLoopback: 0` is a gate; a synthesized journey that would leave loopback is recorded unhandled, not run.
- Do not add an outcome string outside `vocabulary.ts`, and do not touch `packages/trust/src/enterprise.ts`. Why: the closed vocabulary and the honesty guard are the only mechanical protection against automated overclaim.
- Do not run `npm run build` / `pnpm exec vp pack`. Why: gitignored provenance subject; trust is at `c9941f8f`.
- Do not run `vp fmt` repo-wide. Why: 249 pre-existing files. Format only files you touched.
- Do not restate a bounded claim more generally. Why: derivation-guarded.

## Verification

```verify
npm run lint
npm test
npm run trust:verify -- --offline
npm run receipt:verify
node --experimental-strip-types packages/cli/src/cli.ts refusal-census --verify-only --json
git diff --quiet HEAD -- packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis && echo FREEZE-INTACT
```

`npm test` takes ~150s; green baseline is 2580/2580. `npm run trust:verify` WITHOUT `-- --offline` fails by design. Budget note: two prior units reached a turn boundary near 20 minutes during verification. Start your verify chain by minute 18 at the latest, and emit your receipt even if you must report a command as not re-run — the harness runs all six mechanically after your receipt regardless.

## Blocked permission

If evidence is missing, the contract conflicts with reality, or you need a file outside the contract, return status "blocked" with the question in open_questions instead of improvising. Specifically block, do not improvise, if: the runner cannot serve the papercups lane pair on this host without a change outside your contract; the generic receipt module cannot carry the ratio without touching a sealed per-app module; no synthesized journey can run without leaving loopback; or a verify command fails for a cause outside your contract.