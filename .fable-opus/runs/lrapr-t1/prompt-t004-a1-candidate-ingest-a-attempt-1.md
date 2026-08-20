Fable-Opus-Unit: lrapr-t1/t004-a1-candidate-ingest-a
Fable-Opus-Parallel: yes
Fable-Opus-Timeout-Minutes: 35

## Goal

Admit and immutably ingest ONE new webpack/CRA-era legacy React MIT application for the Versionless production-readiness portfolio (T004, tranche one). You work in an isolated worktree; bootstrap it first with `pnpm install --prefer-offline`.

Your candidate list, in ranked order (slugs must start with the listed prefix so they stay inside your file contract): 1) `react-papercups*` — papercups-io/papercups React/TS frontend (assets dir), pick a 2020–2021 tag; 2) `react-focalboard*` — mattermost/focalboard webapp; 3) `react-posthog*` — PostHog/posthog frontend at an old (~2020–2021) tag. These are UNVERIFIED suggestions: your admission gate decides.

Admission gates, all verified BEFORE acquisition counts (record evidence for each): MIT license at the exact pinned revision; a real substantive application, not a template/demo/library; React 15–17; webpack ≤4 or create-react-app; pinned tag or commit at least ~3 years old; a browser UI plausibly supporting ≥3 substantive user journeys. A candidate failing any gate is recorded (append-only, inside your contract dirs) and you move to the next.

Network policy: acquisition only, under purpose-bound consent ID `VL-LEGACY-CORPUS-2026-08-10` with `VERSIONLESS_NETWORK_MODE=consented`; record every remote URL and byte digest touched. After acquisition, everything is offline.

Deliverable for the one admitted candidate, using the EXISTING generic ingest machinery (`packages/cli/src/fixture/ingest.ts`, `tier-f-ingest.ts`, CLI/`pnpm run fixture:ingest` — read them first): immutable source archive identity (SHA-256, exact revision), license/rights evidence, provenance record, dependency closure with honest lock state, declared legacy Node/bundler cell, and one baseline install/build attempt with truthful outcome (a failing build is a truthful recorded outcome, not a unit failure — report it). Writing new per-app modules under packages/\*\* is OUT of contract; if the generic machinery cannot express this ingest, return blocked stating exactly what is missing.

Anti-carousel cap (hard): at most 2 candidates fully attempted. Two failures → blocked with both terminal records.

## File contract

- `fixtures/react-papercups*/**`
- `fixtures/react-focalboard*/**`
- `fixtures/react-posthog*/**`
- `evidence/ingests/react-papercups*/**`
- `evidence/ingests/react-focalboard*/**`
- `evidence/ingests/react-posthog*/**`

## Forbidden moves

- No writes under packages/**, scripts/**, docs/**, evidence/runs/**, evidence/trust/\*\* or any path outside the contract. Why: parallel lanes must stay disjoint; product/adapter work is a later serial phase.
- No candidate outside your three prefixes — substitution means blocked, not improvisation. Why: the contract is the parallel-safety boundary.
- Never recycle graveyard candidates (netlify-cms, redux-realworld, shlink, flagsmith, jira-clone, sqlpad, taskcafe, parse-dashboard, graphql-playground, graphiql, calculator, avataaars, dashboard, tetris, takenote, excalidraw, openchakra, shopping-cart, actual-budget, quiz-app, dejavu, saleor, appsmith, strapi, unleash, verdaccio, jaeger, kafka-ui, mattermost, apisix, kubernetes-dashboard).
- No secrets, tokens, usernames, or host-specific absolute paths in evidence; preserve unknown states; no certification language.
- Do not commit or stage anything (the harness commits your worktree at stop).

## Verification

```verify
pnpm install --prefer-offline
sh -c 'ls evidence/ingests/*/source.json'
sh -c 'ls evidence/ingests/*/attempt.json'
```

The fence is intentionally thin (ingest evidence is candidate-shaped); the receipt must carry digests, URLs, gate evidence, and the build-attempt outcome — that is the real verification surface, reviewed by the PM.

## Blocked permission

If the generic ingest machinery cannot express this flow, both attempted candidates fail admission/acquisition, pnpm install cannot bootstrap the worktree, or consent/network policy would be violated, return status "blocked" with specifics in open_questions instead of improvising.
