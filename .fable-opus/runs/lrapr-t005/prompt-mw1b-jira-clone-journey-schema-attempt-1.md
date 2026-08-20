Fable-Opus-Unit: lrapr-t005/mw1b-jira-clone-journey-schema
Fable-Opus-Timeout-Minutes: 35

## Goal

Deliver the jira-clone witness journey, core schema, and runner in /Users/jacksm5pro/dev/open-source/versionless — re-cut (1 of 2) of mw1; NO published runs, NO mutation proof, NO canonical receipts (that is mw1c). Commit `927b4f3` landed the mechanisms (real pointer drag, renderedStyles probes, drag-surface closed list, angular-jira-clone in WITNESS_REAL_APP_NAMES) plus mw1's browser-proven facts, which are your journey spec:

- Drag: `#Backlog issue-card:nth-of-type(1)` → `#Selected` moves "Angular Spotify 🎧"; counts settle 3→2 / 2→3; card lands first in Selected; re-opening shows `Status Selected for Development` (Akita state).
- Modal: both lanes render `issue-detail` with real data (`Story-2021`, description text). Title edit round-trips via type + Tab blur → board card text changes. Close: `j-button[icon="times"] button`.
- Style probes: seven rendered-style probes identical across lanes (card/column/header/navbar/sidebar/body — exact values in mw1's receipt).
- Non-loopback seams: GA tag, five cloudinary avatars, one Sentry envelope POST.
- Document never overflows 1280×720 → scrollAbsence. No SW, no localStorage; reload restores seed board.

PM rulings baked in:

1. Description editing DROPPED (Quill rejects synthetic keys): journey (b) asserts the description RENDERS and edits the title only; recorded as a truthful non-claim per the papercups scroll-omission precedent.
2. Sentry envelope POST answered 200 `application/json {}` through the established mocked-transport machinery, recorded as a mocked non-loopback seam; GA/cloudinary mocked per the existing locality idiom; zero SUCCESSFUL non-loopback stays hard; DSN/GA values never appear in evidence.

Deliver:

1. The `angular-jira-clone` AppSpec + journey in `packages/cli/src/witness/real-app-run.ts` (4 journeys: board drag; issue modal title-edit + description-renders; create-issue with form typing and new board row; search/filter narrowing) with hover where meaningful, style probes included, scrollAbsence recorded.
2. Core schema `packages/core/src/receipts/witness-angular-jira-clone.ts` per the factoriolab idiom (drag evidence per the closed drag-surface list, mocked-seam inventory, style-probe evidence, scrollAbsence), barrel-exported.
3. Dedicated runner `packages/cli/src/witness/angular-jira-clone-run.ts` per idiom, with a mutation seam chosen and documented (unique visible string in the migrated bundle) ready for mw1c.
4. Tests per idiom for schema + journey wiring (no browser runs needed in tests beyond the existing harness patterns); whole repo gate green.

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
- No published receipts this unit (mw1c's job); no fabricated evidence; inventories exact; DSN/GA values never in evidence; no app names in reusable surfaces beyond closed lists.
- No network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
```

## Blocked permission

If the journey spec contradicts what a verification browser run shows (you may run the browser to check wiring — just do not publish), a closed enumeration outside the contract surfaces, or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
