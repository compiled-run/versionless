Fable-Opus-Unit: lrapr-t005/mw1d-journey-runner-tests
Fable-Opus-Timeout-Minutes: 35

## Goal

Deliver the jira-clone AppSpec/journey, dedicated runner, and tests in /Users/jacksm5pro/dev/open-source/versionless — re-cut (2 of 3); publishing is the NEXT unit. Commit `3dbe60c` landed the schema (`witness-angular-jira-clone.ts`) and all generic wiring (mocked-seam inventory, query-free non-loopback policy, extended cancelled-duplicate category, renderedStyles/applicationJourney slots, drag primitive, drag-surface closed list).

The journey spec is mw1b's browser-verified record (quoted in the mw1b receipt and the unit log), including its three corrections:

1. Board drag: `#Backlog issue-card:nth-of-type(1)` → `#Selected`; "Angular Spotify 🎧"; counts 3→2 / 2→3; card first in Selected; re-open shows `Status Selected for Development`.
2. Issue modal: open first Backlog card → `Story-2021` + description text renders (description EDITING dropped as truthful non-claim — Quill rejects synthetic keys); title edit via `End` + type + `Tab` → board card text changes; close `j-button[icon="times"] button`.
3. Create-issue: navbar item **:nth-of-type(3)** (`aside.navbarLeft .item:nth-of-type(3) .itemIcon`) — item (2) is the search drawer whose overlay hangs journeys, do not touch it; surface `add-issue-modal`; title scoped `add-issue-modal input.form-input`; submit `add-issue-modal .form-action j-button:nth-of-type(1) button`; new row lands LAST in Backlog, count 3→4.
4. Filter: type "Witness" in `board-filter input.form-input` → 1/0/0/0; widen via FULL clear (select-all + Backspace) → counts restored.
5. Hover `#Backlog issue-card j-avatar` → tooltip `Assignee: Trung Vo`. Routes `/` → `/project/board`, modal never changes route. scrollAbsence at 1280×720 every stage. Reload restores seed board (no persistence). No SW, no localStorage.
6. Seven rendered-style probes — use mw1b's exact probe set (card `#Backlog issue-card .issue`, column `.board-dnd-list`, header `.board-dnd-list div.uppercase`, filter input `board-filter input.form-input`, navbar `aside.navbarLeft`, sidebar `.sidebar`, body) with the measured properties from the mw1b receipt; the schema enforces count + cross-lane identity.
7. Mocked seams: GA tag, six distinct cloudinary paths, Sentry envelope POST answered 200 `application/json {}`; the reload-aborted envelope flows through the cancelled-duplicate category (query-free).

Deliver:

1. `angular-jira-clone` AppSpec + journey in `packages/cli/src/witness/real-app-run.ts` using the landed slots (mockedNonLoopbackSeams, renderedStyleProbes, drag gesture, applicationJourney evidence).
2. Dedicated runner `packages/cli/src/witness/angular-jira-clone-run.ts` per the factoriolab idiom, publish/verify flow wired to the schema, mutation seam chosen and documented (unique visible string in the migrated bundle — verify uniqueness against the real dist).
3. Tests per idiom (journey wiring, runner structure, seam/probe definitions against the schema's enforcement); you may run the browser to verify wiring (both lanes are regenerable offline via the committed fixture flows) but publish nothing to evidence/.
4. Whole repo gate green.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `fixtures/angular-jira-clone/**`

## Forbidden moves

- No packages/core/src changes (the schema is landed — if it cannot express something, that is blocked, not a schema edit); no packages/frameworks/**, packages/trust/**, aggregate.json, evidence/**, scripts/**, docs/\*\*.
- No published receipts; no fabricated evidence; DSN/GA values nowhere; no app names in reusable surfaces beyond closed lists.
- No network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
```

## Blocked permission

If the landed schema cannot express a journey fact, a verification browser run contradicts the mw1b spec, or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
