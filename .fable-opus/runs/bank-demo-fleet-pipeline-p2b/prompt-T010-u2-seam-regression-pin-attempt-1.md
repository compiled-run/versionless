Fable-Opus-Unit: bank-demo-fleet-pipeline-p2b/T010-u2-seam-regression-pin

## Goal

Pin the `--cell` seam closed with regression tests that will SURVIVE the rest of T010. This is Phase A unit u2 per `docs/goals/bank-demo-fleet-pipeline/notes/T010a-supersession-sizing.md` §5. Unit u1 just landed (commit f032aec): `plan.ts` now exports `resolveAngularTargetCell()`, `--cell` threads from plan/migrate/run into the plan stage, and an id no adapter publishes refuses with `plan.angular.declared-cell-not-published` (stage plan, exit 2). u1 added 7 tests to `operator-flows.test.ts` covering the basic three cases.

What u2 adds — the pins u1 did NOT write:

1. **The vocabulary split, pinned by name.** `era-cell.ts` describes cells (`DESCRIBED_CELLS`, including the unpublished `NGCC_ANGULAR_13_CELL` with id `angular-13.4.0`); `plan.ts` resolves only cells adapters PUBLISH (`ANGULAR_TARGET_CELLS`). Today `angular-13.4.0` is describable but not plannable. Write a test in `operator-era-cell.test.ts` that pins the split itself: for every id in `DESCRIBED_CELLS` that is NOT in `ANGULAR_TARGET_CELLS`, `resolveAngularTargetCell(id)` must refuse; for every id that IS published, it must resolve to that cell. Write it as a DERIVED assertion over the two lists — not a hardcoded claim that `angular-13.4.0` refuses — because unit u3 will publish an `angular-13.4.0` target cell and this test must then pass without edits, with the membership flipped. That is the point: the test pins the RULE (describable ≠ plannable; only published resolves), not today's membership.

2. **The never-published id.** One test with an id that will never exist (e.g. `angular-0.0.0-never-published`): refusal, exit-2 semantics, and the refusal message names both the declared id and the published ids. This one is immune to u3.

3. **The end-to-end trap regression.** The original defect (sizing §1.2): an operator declares `--cell` on the era-cell stage, gets a green era-cell record, and the plan stage silently aligns to Angular 16. Pin at the flow level in `operator-flows.test.ts`: a plan/run invocation declaring an unpublished cell id must terminate with the plan-stage refusal — it must NOT produce a plan whose cell is `ANGULAR_16_BROWSER_CELL`. Follow the invocation style of the existing flow tests in that file (they already drive `runOperatorFlow`/plan flows in-process).

4. **The explicit-16 identity.** Declaring the 16 cell's own id explicitly must plan identically to declaring nothing (same resolved cell object). This pins that declaration is resolution, not a second code path.

Read u1's diff first (`git show f032aec -- packages/cli/src/operator/plan.ts packages/cli/test/operator-flows.test.ts`) so you extend rather than duplicate its tests.

## File contract

- `packages/cli/test/operator-flows.test.ts`
- `packages/cli/test/operator-era-cell.test.ts`

## Forbidden moves

- Tests only — do not touch any `src/` file. Why: u1 is reviewed and committed; if a pin cannot be written without a src change, that is a finding to report as blocked, not a change to make.
- Do not touch `packages/frameworks/**`, `packages/core/src/{migrations,bundlers,analysis}/**`, `packages/trust/**`, or `evidence/**`. Why: frozen subtrees under composite 27741d9c; evidence regenerates only in sequenced units.
- Do not hardcode that `angular-13.4.0` refuses (see Goal item 1). Why: unit u3 publishes it; a membership-hardcoded test would make u3's diff dishonestly include test deletions.
- No `git stash` / `git checkout --` / `git reset` / `git clean`. Why: standing goal rule.

## Verification

```verify
pnpm exec vp test --project node packages/cli/test/operator-flows.test.ts packages/cli/test/operator-era-cell.test.ts packages/cli/test/operator-refusal-census.test.ts
npm run trust:verify -- --offline
git diff --quiet HEAD -- packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis && echo FREEZE-INTACT
git diff --name-only HEAD | grep -v '^packages/cli/test/' | grep -v '^.fable-opus/' | wc -l | grep -qx '0' && echo TESTS-ONLY
```

The census test is in the verify set because new TEST files must not add refusal sites — it proves the census stays byte-identical. TESTS-ONLY proves the diff touched nothing but the two test files.

## Blocked permission

If a pin cannot be expressed without changing src, if the flow-level test cannot reach the plan refusal through the existing in-process drivers, or if the two-list derived assertion is impossible because one list is not exported, return status "blocked" with the question in open_questions instead of improvising.
