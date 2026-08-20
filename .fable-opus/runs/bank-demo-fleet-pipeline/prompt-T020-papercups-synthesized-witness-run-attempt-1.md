Fable-Opus-Unit: bank-demo-fleet-pipeline/T020-papercups-synthesized-witness-run
Fable-Opus-Timeout-Minutes: 20

## Goal

Run the synthesized witness path once, for real, with Chromium, against the react-papercups-v1-0-0 lane pair on this host — serialized, loopback-only — and publish the record it produces to `evidence/runs/witness-synthesized/react-papercups-v1-0-0/`. Then add the test leg that asserts that record (skipIf the lane pair is absent). Nothing new to design: the previous unit built the whole path and stopped short of driving a browser. This unit drives it.

What already exists (read these first, briefly — you are running them, not redesigning them):

- `packages/cli/src/witness/journey-synthesis/driver.ts` — driver selection with recorded reason. papercups HAS a hand-authored driver, so you must run with `--journeys synthesized` and the record must carry `hand-authored-driver-overridden-by-declaration` and name the displaced driver.
- `packages/cli/src/witness/real-app-run.ts` — `runSynthesizedWitnessRealApp`, composing `executeRun`: one lane at a time, one journey per box, routes reached only by clicking anchors on the current document.
- `packages/core/src/receipts/witness-real-app.ts` — the record shape; `replayabilityRatio` is required and recomputed by the parser; `successfulNonLoopback` checked at record and lane level.
- `packages/cli/src/operator/witness.ts` and the `--witness` migrate stage; the `witness:real-app` CLI path in `cli.ts`.
- `packages/cli/test/witness-real-app-synthesized.test.ts` — tests (a), (b), and the hermetic crawl test exist; test (c)'s browser leg is what you add.

Lane pair, verified on disk before dispatch: `.versionless/work/react-papercups-v1-0-0/baseline/build` and `.versionless/work/react-papercups-v1-0-0/target/build-vite`, both with `node_modules`. Chromium: `~/Library/Caches/ms-playwright/chromium-1194` and `chromium-1200`; `node_modules/.bin/playwright` resolves. papercups has no Cypress/Playwright suite that I know of — confirm; if absent, the path is `synthesized-crawl`, which is a legitimate first case.

Deliver:

1. Execute the run through the real CLI path (`witness:real-app … --journeys synthesized`, or the equivalent programmatic entry the CLI uses — say which). Publish exactly what the machinery emits into `evidence/runs/witness-synthesized/react-papercups-v1-0-0/` (record JSON at minimum; any lane-level artifacts the runner writes). Do NOT hand-edit the published JSON.
2. If the run fails, capture the exact error and return `blocked` naming it. If a **small** fix in the files in your contract makes it run (a path, an option, an off-by-one), make it and say exactly what you changed and why. If it needs more than that, block — that is the previous unit's gap to re-cut, not yours to absorb.
3. Add test (c) to `packages/cli/test/witness-real-app-synthesized.test.ts`: `skipIf` the lane pair is absent; runs the synthesized path against it; asserts `successfulNonLoopback === 0`, `journeySource` is a synthesized value, the override reason is recorded, `replayabilityRatio` is present, and every per-journey outcome string is in the vocabulary. Keep it bounded (a route cap) so it does not blow the suite time.
4. In the receipt, report verbatim: `journeySource`, the override reason, `synthesized.{total,replayable,ran}`, `replayabilityRatio`, `successfulNonLoopback`, and the outcome strings observed.

Budget: 20 minutes. Start the verify chain by minute 12. Emit your receipt even if you must report a command as not re-run — the harness runs the verify block mechanically after a `completed` receipt. If the browser leg cannot be made to run in budget, return `blocked` (not `partial`) with the exact obstacle.

## File contract

- `packages/cli/src/witness/real-app-run.ts`
- `packages/cli/src/witness/journey-synthesis/**`
- `packages/cli/src/operator/witness.ts`
- `packages/cli/test/witness-real-app-synthesized.test.ts`
- `evidence/runs/witness-synthesized/**`

## Forbidden moves

- Do not write inside `packages/frameworks/react`, `packages/frameworks/angular`, `packages/core/src/migrations`, `packages/core/src/bundlers`, or `packages/core/src/analysis`. Why: sealed under freeze `27741d9c`.
- Do not edit `packages/core/src/receipts/witness-real-app.ts`, any `packages/cli/src/witness/*-run.ts` other than `real-app-run.ts`, any per-app receipt module, or any existing `evidence/runs/witness-*` directory. Why: the record shape was just fixed with a parser-recomputed ratio; sealed producers and published records stay put. If the record shape blocks you, that is a `blocked`, not an edit.
- Do not hand-edit anything you publish under `evidence/runs/witness-synthesized/`. Why: the record must be what the machinery emitted, or it is not evidence.
- Do not run journeys in parallel or add a parallel path. Why: witness serializes per host.
- Do not let any journey leave loopback. Why: `successfulNonLoopback: 0` is a gate.
- Do not stub, mock, or fake the browser to make the leg "pass". Why: the point of this unit is a real browser run; a fake one is the misfire.
- Do not run `npm run build` / `pnpm exec vp pack`. Why: gitignored provenance subject; trust is at `c9941f8f`.
- Do not run `vp fmt` repo-wide. Why: 249 pre-existing files. Format only files you touched.

## Verification

```verify
npm run lint
npm test
npm run trust:verify -- --offline
npm run receipt:verify
test -n "$(ls evidence/runs/witness-synthesized/react-papercups-v1-0-0/*.json 2>/dev/null)" && echo WITNESS-SYNTHESIZED-RECORD-PUBLISHED
git diff --quiet HEAD -- packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis && echo FREEZE-INTACT
```

`npm test` takes ~150s; green baseline is 2591/2591. `npm run trust:verify` WITHOUT `-- --offline` fails by design.

## Blocked permission

If evidence is missing, the contract conflicts with reality, or you need a file outside the contract, return status "blocked" with the question in open_questions instead of improvising. Specifically block, do not improvise, if: the lane pair cannot be served or Chromium cannot launch (give the exact error); the path needs more than a small fix inside your contract to run; or the record shape in `witness-real-app.ts` cannot accept what the run produced.