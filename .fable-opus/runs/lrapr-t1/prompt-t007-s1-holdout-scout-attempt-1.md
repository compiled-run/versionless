Fable-Opus-Unit: lrapr-t1/t007-s1-holdout-scout
Fable-Opus-Parallel: yes
Fable-Opus-Timeout-Minutes: 20

## Goal

Read-only research unit: identify 4–6 candidate applications suitable as the tranche-one FROZEN-ADAPTER HOLDOUT for the Versionless React production-readiness matrix (T007 input). A holdout must be a webpack/CRA-era legacy React application under MIT license that was NOT used to design any adapter — so it must NOT be: react-boilerplate, anything in the active T004 lanes (papercups, focalboard, posthog, sound-redux, winds, phoenix-trello), nor any graveyard candidate (netlify-cms, redux-realworld, shlink, flagsmith, jira-clone, sqlpad, taskcafe, parse-dashboard, graphql-playground, graphiql, calculator, avataaars, dashboard, tetris, takenote, excalidraw, openchakra, shopping-cart, actual-budget, quiz-app, dejavu, saleor, appsmith, strapi, unleash, verdaccio, jaeger, kafka-ui, mattermost, apisix, kubernetes-dashboard).

For each candidate report: repo + exact suggested tag/revision, license verified at that revision (quote the LICENSE header), React major, bundler + version evidence (webpack config / react-scripts in package.json at that revision), approximate age, application substance (what it does, why ≥3 substantive browser journeys are plausible — name the journeys), known risks (service workers, backend coupling, monorepo extraction difficulty, asset licensing), and a 1–5 holdout-fitness score with one-line rationale. Use public web/GitHub metadata reads only — no source archives downloaded, no acquisition.

Everything goes in your receipt text; you write NO files.

## File contract

- none

## Forbidden moves

- No file writes anywhere, no acquisition/downloads of source archives, no cloning. Why: read-only research; acquisition is consent-bound and belongs to an ingest lane.
- Do not rank a candidate you could not verify the license for at the pinned revision — mark it unverified instead.

## Verification

```verify

```

Empty on purpose: a read-only research unit has no mechanical artifact; the receipt's cited evidence (URLs, quoted license lines, package.json excerpts) is the verification surface.

## Blocked permission

If public metadata is unreachable (network failure) or every viable candidate fails the exclusion filters, return status "blocked" with what you tried in open_questions.
