Fable-Opus-Unit: lrapr-t005/mw1-jira-clone-witness
Fable-Opus-Timeout-Minutes: 35

## Goal

Browser-prove the jira-clone vertical in /Users/jacksm5pro/dev/open-source/versionless — the second Angular witness cell, and the corpus's first meaningful DRAG coverage. Both lanes are committed and deterministic (commit `60dc364`): era baseline (Angular 13, 24 dist files) and migrated Angular 16.2 build (24 files); regenerate offline via `packages/cli/src/fixture/angular-jira-clone-{apply,parity}-run.ts` flows and the caches/stage under `.versionless/`.

Templates: factoriolab (m3/m3b — `angular-factoriolab-run.ts`, `witness-angular-factoriolab.ts`, the corroborated-cancelled-duplicate category, `WitnessMeasuredScrollAbsence`) and hospitalrun (h3d idiom). App facts: seed data fetched same-origin (`src/assets/data/project.json` + `auth.json`), Akita stores, no backend, no SW expected (verify and record); Sentry DSN + GA id fire at bootstrap — handle at witness level truthfully: their non-loopback requests must be blocked/mocked by the existing locality machinery and inventoried exactly (zero SUCCESSFUL non-loopback stays hard).

Deliver:

1. jira-clone in `WITNESS_REAL_APP_NAMES` (closed-list idiom, framework `'angular'`), journey in `real-app-run.ts`, dedicated `angular-jira-clone-run.ts` runner.
2. Journeys on BOTH lanes: (a) **board drag-and-drop** — drag an issue card between columns with real pointer gestures, assert the moved card's new column and persisted Akita state (this is the charter's "drag where meaningful" — the corpus's first; make the assertion exact and settled); (b) issue detail modal — open, edit title/description, assert persisted change (this arbitrates the NZ_MODAL_DATA cross-module rewrite: the migrated modal must actually receive its data — if the content component renders empty, that is a REAL migration failure, record it red and stop); (c) create-issue flow with form typing and the new row on the board; (d) search/filter with typed input narrowing visible cards. Hover where meaningful; scroll only where measured (use the scroll-surface/absence mechanisms).
3. Exact inventories per the established idioms (console errors, failed requests incl. the blocked Sentry/GA non-loopback attempts pinned exactly, corroborated-cancelled-duplicate category if it fires); the declared 550KB style-aggregate difference gets behavioral arbitration — visible styling assertions in the journeys, with any rendered difference between lanes recorded truthfully.
4. Baseline 2/2 + migrated 2/2; zero successful non-loopback; semantic byte-mutation on the migrated bundle (visible string → journey red → byte-identical restore → green rerun).
5. Core schema `packages/core/src/receipts/witness-angular-jira-clone.ts` per idiom, barrel-exported; canonical receipts `evidence/runs/witness-angular-jira-clone/receipt.{json,md}` + artifacts under `evidence/runs/angular-jira-clone/`; redacted (DSN/GA values never reproduced), unknowns preserved, `counted: false` pending Judge.
6. Tests per idiom; whole repo gate green. DO NOT touch aggregate.json, conformance, or trust — next unit.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/witness-angular-jira-clone.ts`
- `packages/core/src/receipts/witness-real-app.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `evidence/runs/angular-jira-clone/**`
- `evidence/runs/witness-angular-jira-clone/**`
- `fixtures/angular-jira-clone/**`

## Forbidden moves

- No other packages/core changes; no packages/frameworks/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/\*\*.
- No fabricated evidence; truthful reds (a drag that cannot assert settled state is a red, not a page-load claim); inventories exact; no app names in reusable surfaces beyond closed lists; DSN/GA values never in evidence.
- No network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/witness-angular-jira-clone/receipt.json evidence/runs/witness-angular-jira-clone/receipt.md'
env npm_config_offline=true VERSIONLESS_NETWORK_MODE=offline pnpm run receipt:verify
```

## Blocked permission

If a journey cannot pass truthfully (exact assertion + settled state), the modal arbitration reveals a real migration failure (record it red first — that is evidence), drag cannot settle deterministically, or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
