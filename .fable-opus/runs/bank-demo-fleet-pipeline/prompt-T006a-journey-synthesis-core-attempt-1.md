Fable-Opus-Unit: bank-demo-fleet-pipeline/T006a-journey-synthesis-core
Fable-Opus-Timeout-Minutes: 30

## Goal

Build the journey-synthesis core: read an application's OWN e2e suite (Cypress and Playwright specs) and emit witness journey definitions in the generic real-app schema, with a crawl-based fallback when no suite exists — and with the honesty guard built in, so a synthesized journey can never produce a bare pass verb.

Why. Witness journeys and calibration were ~48% of the largest tranche's units, hand-authored per application: `packages/cli/src/witness/` carries 18 per-app `*-run.ts` drivers and `packages/core/src/receipts/` carries 16 per-app `witness-*.ts` receipt modules. An unseen bank application cannot have a hand-authored journey. The pipeline must derive journeys from what the app already ships.

Read first, in this order:

1. `packages/cli/src/witness/real-app-run.ts` — the generic runner behind `witness:real-app`. `JourneyEvidence` at :259, `applicationJourney?: WitnessApplicationJourneyEvidence` at :366, and the placeholder/declaration types at :35-39. This is the schema your output must fit. Note the doc comment around :340-366 on what a journey supplies vs what is measured.
2. `packages/core/src/receipts/witness-real-app.ts` — the generic receipt module.
3. `packages/core/src/receipts/witness-react-cypress-rwa.ts` and `packages/cli/src/fixture/react-cypress-rwa-calibrate-run.ts` — the precedent: cypress-realworld-app has its own Cypress suite; read how its journeys were shaped and what the calibration lanes asserted. Then look at the app's actual specs at `.versionless/work/react-cypress-rwa/baseline/cypress/` (its own e2e directory, on disk).
4. `packages/trust/src/enterprise.ts:935-975` — `assertEnterpriseSurfaceHonesty`. :948-962 strips the eShop bounded string `witness-passed-on-bounded-anonymous-catalog-surface` and then rejects any surviving inflected pass verb. Your outcome vocabulary must survive this guard by construction.
5. One or two of the hand-authored drivers (pick `react-linkfree-run.ts` or `angular-realworld-run.ts`) to see what a journey step looks like when a human wrote it: routes visited, selectors, measured pins, bounded outcomes.

Deliver, under `packages/cli/src/witness/journey-synthesis/`:

1. **Spec readers.** `cypress.ts` and `playwright.ts`: locate the app's e2e directory by convention (`cypress/e2e`, `cypress/integration`, `e2e/`, `tests/e2e`, `*.cy.{js,ts}`, `*.spec.{js,ts}` under an e2e root, playwright config `testDir`), parse specs into an intermediate `SynthesizedJourney` — visits (`cy.visit`, `page.goto`), navigations, and the interactions that can be replayed without app-specific fixtures (clicks by data-test/data-cy/testid/role/text selectors, typed input, waits on route). Anything a reader cannot express (custom commands, network intercepts, fixture-seeded state) is recorded per journey as a named `unhandled` note, never silently dropped.
2. **Crawl fallback.** `crawl.ts`: given a served lane URL, produce journeys by breadth-first traversal of same-origin anchors and router links up to a bounded depth/route count, recording each reached route as a step. Loopback only. Emit as the same `SynthesizedJourney` shape with `source: 'crawl'`.
3. **Emitter.** `emit.ts`: map `SynthesizedJourney` → the real-app schema (`WitnessApplicationJourneyEvidence` / whatever real-app-run consumes) with **measured-pins vocabulary**: a synthesized journey states what it will measure (route reached, selector present, no-overflow, etc.), and its outcome vocabulary is a closed set of bounded strings that you define, e.g. `journey-synthesized-from-e2e-suite-reached-<n>-of-<m>-routes`, `journey-synthesized-by-crawl-bounded-depth-<d>`, `journey-surface-not-reachable-<reason>`. **No string in this set may contain an inflected pass verb** (passed, passing, passes, succeeded, etc.). Add a test that runs every vocabulary string through `assertEnterpriseSurfaceHonesty` (or its inner check) and proves it survives.
4. **`witness:synthesize` operator command** (`packages/cli/src/operator/witness-synthesize.ts` or similar): input a source tree (and optionally a lane URL for crawl), output the synthesized journeys as JSON plus a summary — count from e2e, count from crawl, unhandled notes, and a `PipelineRefusal` (stage `witness-synthesize`, origin `pipeline`) when neither reader nor crawl yields a journey. Wire into `OPERATOR_COMMANDS` and the census. Do NOT wire it into `migrate` yet and do NOT run witness end-to-end — that is T006b.
5. **Tests** in `packages/cli/test/witness-journey-synthesis.test.ts`: (a) the Cypress reader against `.versionless/work/react-cypress-rwa/baseline/cypress/` yields ≥1 journey with ≥1 visit and records unhandled constructs by name (if that directory is absent on the CI host, use a small committed fixture spec under the test's own directory — say which you did); (b) the emitter output type-checks against the real-app schema; (c) the honesty test in (3); (d) crawl on a static local server over two linked HTML pages yields a 2-route journey and never leaves loopback.

Do NOT rewrite or delete the 18 per-app drivers or the 16 receipt modules; their evidence is sealed. Do NOT touch `real-app-run.ts` beyond adding an import/type export if the emitter needs one — say if you did.

## File contract

- `packages/cli/src/witness/journey-synthesis/**`
- `packages/cli/src/witness/real-app-run.ts`
- `packages/cli/src/operator/**`
- `packages/cli/src/cli.ts`
- `packages/core/src/receipts/witness-real-app.ts`
- `packages/cli/test/witness-journey-synthesis.test.ts`
- `packages/cli/test/operator-flows.test.ts`
- `packages/cli/test/operator-refusal-census.test.ts`
- `evidence/runs/operator-flows/**`

## Forbidden moves

- Do not write inside `packages/frameworks/react`, `packages/frameworks/angular`, `packages/core/src/migrations`, `packages/core/src/bundlers`, or `packages/core/src/analysis`. Why: sealed under freeze `27741d9c`.
- Do not weaken, bypass, or special-case `assertEnterpriseSurfaceHonesty` in `packages/trust/src/enterprise.ts` (it is outside your contract anyway). Why: that guard is the only mechanical thing standing between automation and overclaim. If a string cannot survive it, change the string.
- Do not emit any outcome string containing an inflected pass verb, or restate the sealed bounded strings more generally. Why: same reason; and `witness-passed-on-bounded-anonymous-catalog-surface` is part of a sealed claim, not a template.
- Do not run `npm run build` / `pnpm exec vp pack`. Why: `packages/cli/dist/**` is a gitignored provenance subject; a rebuild silently turns `trust:verify --offline` red. Trust is at digest `c9941f8f`; leave dist alone.
- Do not make any network request except to loopback in the crawl test. Why: witness locality is gated (`successfulNonLoopback: 0`).
- Do not run `vp fmt` repo-wide. Why: 249 pre-existing files reformat. Format only files you touched.
- Do not edit or delete existing `packages/cli/src/witness/*-run.ts` or `packages/core/src/receipts/witness-*.ts` other than `witness-real-app.ts`. Why: sealed evidence producers.

## Verification

```verify
npm run lint
npm test
npm run trust:verify -- --offline
npm run receipt:verify
node --experimental-strip-types packages/cli/src/cli.ts refusal-census --verify-only --json
git diff --quiet HEAD -- packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis && echo FREEZE-INTACT
```

`npm test` takes ~150s; green baseline is 2562/2562. `npm run trust:verify` WITHOUT `-- --offline` fails by design.

## Blocked permission

If evidence is missing, the contract conflicts with reality, or you need a file outside the contract, return status "blocked" with the question in open_questions instead of improvising. Specifically block, do not improvise, if: the real-app schema cannot accept a synthesized journey without changing a sealed receipt module; a bounded outcome string cannot be made to survive the honesty guard without weakening it; or the crawl cannot be kept loopback-only.
