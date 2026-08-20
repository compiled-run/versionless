Fable-Opus-Unit: lrapr-t006/u2-react-candidate-scout
Fable-Opus-Timeout-Minutes: 30

## Goal

Produce the ranked candidate shortlist for the three remaining React cells of /Users/jacksm5pro/dev/open-source/versionless (board task T006). The portfolio-level gate requires the React six to include at least one **old-Vite-origin** app and at least one **legacy Next.js** app; the third slot is open (prefer fleet-shaped webpack/CRA-era). Counted so far: react-boilerplate (webpack 4), papercups (CRA 3), hospitalrun (CRA 3). The holdout cypress-realworld-app (CRA 4) is reserved and cannot be a portfolio cell. killedbygoogle exists in the corpus as a not-claimed legacy-Next artifact from the retired goal — assess honestly whether its existing evidence can seed a real vertical or whether a fresh legacy-Next candidate is stronger.

MANDATORY PRE-SCREEN (T007/T999 hard rule — two prior scout license claims were proven wrong): verify the LICENSE FILE TEXT BYTES at the exact pinned revision via authenticated API reads before a candidate enters the shortlist. MIT only. Record blob sha + copyright line per candidate. A candidate without LICENSE-file-at-pin is out (the angular-realworld precedent), regardless of package.json claims.

Work from, in order:

1. Local evidence: the retired spine board `docs/goals/react-angular-migration-spine/state.yaml` (grep surgically — react candidate/rejection records), `evidence/ingests/` residue, `notes/t011-codex-run-audit.md` graveyard, `notes/t004-unit-log.md` React graveyard list (netlify-cms, redux-realworld, shlink, flagsmith, jira-clone[react], sqlpad, taskcafe, parse-dashboard, graphql-playground, graphiql, calculator, avataaars, dashboard, tetris, takenote, excalidraw, openchakra, shopping-cart, actual-budget, quiz-app, dejavu, saleor, appsmith, strapi, unleash, verdaccio, jaeger, kafka-ui, mattermost, apisix, kubernetes-dashboard — never recycle).
2. Public metadata research (read-only, consent VL-LEGACY-CORPUS-2026-08-10): license bytes, tags, version facts. No downloads, no clones.

Per-candidate requirements: pinned immutable revision with era-coherent date; framework/bundler facts (old-Vite: a real app whose pinned era used Vite 2/3 — the migration story is old-Vite→Vite 8; legacy-Next: Next 9-12 era with pages/ router); declared Node/package-manager/lockfile state; LFS check flagged for ingest; journey surface sketch (≥3 substantive journeys, local-first or stub-cheap — same-origin API stubs are the papercups-precedent price ceiling); admission risks. SPDX MIT with LICENSE bytes verified.

Deliver in the receipt: ranked shortlist of 4-6 (covering both required shapes plus alternates), reject list with one-line reasons, killedbygoogle seed-vs-fresh assessment, and a recommended 3-cell cut with ingest order and lane parallelization guidance (literal-directory slugs).

## File contract

- none

## Forbidden moves

- Read-only: no file writes, no downloads, no installs, no clones.
- No graveyard recycling; cypress-realworld-app stays reserved as holdout.
- Network is metadata-only under the consent ID.

## Verification

```verify

```

Read-only unit: the receipt's evidence (license blob shas, pins, version facts) is the verification surface, PM-checked before packets are composed.

## Blocked permission

If fewer than the required shapes exist under the pre-screens, the killedbygoogle assessment is ambiguous, or local evidence contradicts public metadata, return status "blocked" with specifics in open_questions instead of padding the shortlist.
