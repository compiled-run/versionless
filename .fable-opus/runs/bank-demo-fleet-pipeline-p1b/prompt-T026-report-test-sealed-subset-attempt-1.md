Fable-Opus-Unit: bank-demo-fleet-pipeline-p1b/T026-report-test-sealed-subset
Fable-Opus-Timeout-Minutes: 15

## Goal

Make one test structural instead of brittle. `packages/trust/test/coverage-report.test.ts:90-100` currently hardcodes `report.totals` as `{ applications: 13, proven: 10, bounded: 2, refused: 0, 'not-admitted': 1 }` and asserts EVERY row's `provenanceOfStatus === 'sealed-receipts'`. Those expectations were written when no run records existed. The batch runner now files run records under `evidence/runs/<id>/run-record.json`, and the report correctly carries them: today it reads 15 rows = 13 sealed-receipts (10 proven, 2 bounded, 1 not-admitted — **unchanged**) + 2 run-record (both `refused`). The report is right; the test breaks on every batch.

Rewrite that one `it(...)` so it: (1) filters `report.applications` to rows with `provenanceOfStatus === 'sealed-receipts'` and asserts over THAT subset exactly `{ applications: 13, proven: 10, bounded: 2, refused: 0, 'not-admitted': 1 }` (derive the counts from the subset; the sealed pin must stay byte-exact — do NOT loosen it); (2) asserts every row in that subset is `sealed-receipts` (trivially true after the filter — keep the assertion so the intent is explicit); (3) asserts the run-record rows separately: each has `provenanceOfStatus === 'run-record'`, and no run-record row is `proven` unless its record carries `interventionCount === 0` AND a `proven` classification (read the row shape from `evidence/trust/current/coverage-report.json` — the fields are `status`, `refusalCode`, `interventionCount`, `provenanceOfStatus`); (4) asserts `report.totals.applications === sealed.length + runRecord.length` so the totals stay derived, not hardcoded. Keep the eShop assertion that follows at :101+ untouched.

Read first: the test file around :60-130 (the `derived()` helper and the eShop assertion), and `evidence/trust/current/coverage-report.json` for the two run-record rows' exact shape.

Budget: 15 minutes. Emit your receipt even if a command is reported not re-run — the harness runs the block after a `completed` receipt.

## File contract

- `packages/trust/test/coverage-report.test.ts`

## Forbidden moves

- Do not touch product code, evidence, or the trust package. Why: the report is correct; only the test's expectations are stale. If you find yourself needing product changes, return `blocked` — that would mean the report, not the test, is wrong.
- Do not loosen the sealed-subset pin (e.g. `toBeGreaterThanOrEqual`). Why: the sealed baseline must stay byte-exact; the point is to pin it against the right subset.
- Do not run `pnpm exec vp pack` or regenerate anything. Why: nothing here changes derivations.
- Do not run `vp fmt` repo-wide. Why: 249 pre-existing files. Format only the one file.

## Verification

```verify
npm run lint
npm test
npm run trust:verify -- --offline
node --experimental-strip-types packages/cli/src/cli.ts report:coverage --offline --verify-only
```

`npm test` takes ~150s; expected green is the full suite (the previous baseline 2654 plus T021a's 18 batch tests, minus the one currently failing, which this unit fixes). `npm run trust:verify` WITHOUT `-- --offline` fails by design.

## Blocked permission

If evidence is missing, the contract conflicts with reality, or you need a file outside the contract, return status "blocked" with the question in open_questions instead of improvising.