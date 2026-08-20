Fable-Opus-Unit: lrapr-t1/t003-u4-curation-cleanup
Fable-Opus-Timeout-Minutes: 35

## Goal

Curate the active production surface of /Users/jacksm5pro/dev/open-source/versionless by removing dead per-app code for terminally failed migration candidates. Every byte you remove is already preserved: tracked files are recoverable from git history, and all currently-dirty/untracked bytes are captured in recovery ref `refs/versionless/recovery/legacy-react-angular-production-readiness-pre-goal-20260810-2` (52-entry manifest, restoration proven). Do NOT touch that ref.

Removal targets (from the owner-approved T011 audit, `docs/goals/legacy-react-angular-production-readiness/notes/t011-codex-run-audit.md` §5):

1. The 12 dead per-app React migration modules in `packages/frameworks/react/src/`: react-tetris-migration.ts, react-takenote-migration.ts, react-excalidraw-v011-migration.ts, react-sqlpad-v5-5-0-migration.ts, react-openchakra-migration.ts, react-shopping-cart-migration.ts, react-calculator-migration.ts, react-graphiql-migration.ts, react-dejavu-migration.ts, react-avataaars-react18-migration.ts, react-actual-budget-v22-12-9-migration.ts, react-dashboard-migration.ts — plus their barrel exports and any test files or cli fixture runners that exist SOLELY to exercise these dead modules.
2. `packages/frameworks/angular/src/angular-contacts-9-to-16.ts` and `packages/frameworks/angular/src/fuxa-angular14-to16.ts` (both apps have terminal dependency evidence), same treatment.
3. The 6 untracked excluded-candidate ingest modules and their 5 untracked tests: packages/cli/src/fixture/react-{flagsmith,jira-clone,netlify-cms,redux-realworld,shlink-web-client,shlink-web-client-t714}-ingest.ts and packages/cli/test/react-{flagsmith,netlify-cms,redux-realworld,shlink-web-client,shlink-web-client-t714}-ingest.test.ts.

Method matters: before deleting anything, trace imports/references (grep for each module name across packages/, vite.config.ts, scripts/). A module with a live consumer outside the removal set is NOT removed in this unit — list it in the receipt instead. Deleting a dead module's dedicated test is correct curation; deleting or weakening any other test is forbidden.

STRICT KEEP LIST — do not remove or modify these beyond mechanical barrel-export adjustments: everything for react-boilerplate (all variants), angular-realworld, angular-phonecat, killedbygoogle/next (protected by charter), the generic React transforms (react-class-lifecycle-to-hooks, react-connect-to-hooks, react-data-flow-connect-to-hooks, react-composed-migration), template-analysis.ts, all of packages/core, packages/trust, packages/experiments, packages/node-guard, and every file under evidence/ and fixtures/ (terminal/negative evidence is append-only and stays).

## File contract

- `packages/frameworks/react/**`
- `packages/frameworks/angular/**`
- `packages/cli/src/**`
- `packages/cli/test/**`
- `vite.config.ts`

## Forbidden moves

- Do not delete or edit anything under evidence/**, fixtures/**, docs/**, scripts/**, packages/core/**, packages/trust/**. Why: evidence is append-only; core/trust are the keep-list spine; curation is scoped to dead adapter/fixture code.
- Do not weaken, delete, or skip any test except a dead target module's own dedicated tests. Why: the gate's meaning must survive curation; only dead-code tests leave with their dead code.
- Do not touch the recovery refs or git history; do not commit or stage anything. Why: T003 has a single-commit boundary at task end, owned by the PM.
- Obey repo policy: strict TypeScript, magic-regexp, pathe, ufo.
- Do not touch the network.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp pack
pnpm exec vp test --project node
env npm_config_offline=true pnpm run receipt:verify
env npm_config_offline=true pnpm run corpus:verify
env npm_config_offline=true pnpm run trust:verify
```

## Blocked permission

If a listed removal target has a live consumer that would force changes outside the contract, if removing a target makes the suite red for a reason you cannot fix by removing more of that same dead target's dedicated code, or if anything on the keep list would have to change more than a barrel export, return status "blocked" with the specifics in open_questions instead of improvising.
