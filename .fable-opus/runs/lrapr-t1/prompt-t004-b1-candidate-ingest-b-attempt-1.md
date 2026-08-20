Fable-Opus-Unit: lrapr-t1/t004-b1-candidate-ingest-b
Fable-Opus-Parallel: yes
Fable-Opus-Timeout-Minutes: 35

## Goal

Admit and immutably ingest ONE new webpack/CRA-era legacy React MIT application for the Versionless production-readiness portfolio (T004, tranche one). You work in an isolated worktree; bootstrap it first with `pnpm install --prefer-offline`.

Your candidate list, in ranked order — the ingest slug MUST be exactly the literal directory name given: 1) `react-sound-redux` — andrewngu/sound-redux (React+Redux webpack SoundCloud client, 2015–2018 era); 2) `react-winds` — GetStream/Winds 2.x (CRA-era RSS/podcast app, ~2018–2019); 3) `react-phoenix-trello` — bigardone/phoenix-trello React/webpack frontend. These are UNVERIFIED suggestions: your admission gate decides.

Admission gates, all verified BEFORE acquisition counts (record evidence for each): MIT license at the exact pinned revision; a real substantive application, not a template/demo/library; React 15–17; webpack ≤4 or create-react-app; pinned tag or commit at least ~3 years old; a browser UI plausibly supporting ≥3 substantive user journeys. A candidate failing any gate is recorded (append-only, inside your contract dirs) and you move to the next.

Network policy: acquisition only, under purpose-bound consent ID `VL-LEGACY-CORPUS-2026-08-10` with `VERSIONLESS_NETWORK_MODE=consented`; GET-only, record every remote URL and byte digest touched, fetch the source archive twice and require byte-identical results. After acquisition, everything is offline.

Deliverable for the one admitted candidate: immutable source archive identity (SHA-256, exact revision, blob-level reconciliation against the git tree), license/rights evidence, provenance record, dependency closure with honest lock state (record what is found — do not upgrade), declared legacy Node/bundler cell, and one baseline install/build attempt with truthful outcome (a failing build is a truthful recorded outcome, not a unit failure — report it). Evidence lives under `evidence/ingests/<slug>/` and `fixtures/<slug>/fixture.json`, following the document shapes already present in the repo's tier-f ingest evidence.

IMPORTANT — known machinery gap, PM-ruled: the CLI `fixture:ingest` allowlist and the tier-f `FixtureId` union are closed lists; do NOT edit packages/\*\* to extend them, and do NOT leave hand-written `.js`/`.mjs`/`.cjs` driver files anywhere — the repo's strict-TypeScript policy gate greps for exactly that. Perform acquisition steps with ad-hoc shell/node -e invocations whose exact commands are recorded in the evidence documents (a reproducibility transcript in the evidence JSON/ndjson is required; standalone executable driver files are not allowed). Lane A made this mistake; do not repeat it.

Anti-carousel cap (hard): at most 2 candidates fully attempted. Two failures → blocked with both terminal records.

## File contract

- `fixtures/react-sound-redux/**`
- `fixtures/react-winds/**`
- `fixtures/react-phoenix-trello/**`
- `evidence/ingests/react-sound-redux/**`
- `evidence/ingests/react-winds/**`
- `evidence/ingests/react-phoenix-trello/**`

## Forbidden moves

- No writes under packages/**, scripts/**, docs/**, evidence/runs/**, evidence/trust/\*\* or any path outside the contract. Why: parallel lanes must stay disjoint; product/adapter work is a later serial phase.
- No candidate or slug outside the three literal directories above — substitution means blocked, not improvisation.
- No `.js`/`.mjs`/`.cjs` files created anywhere. Why: strict-TypeScript repo policy; the baseline gate rejects them.
- Never recycle graveyard candidates (netlify-cms, redux-realworld, shlink, flagsmith, jira-clone, sqlpad, taskcafe, parse-dashboard, graphql-playground, graphiql, calculator, avataaars, dashboard, tetris, takenote, excalidraw, openchakra, shopping-cart, actual-budget, quiz-app, dejavu, saleor, appsmith, strapi, unleash, verdaccio, jaeger, kafka-ui, mattermost, apisix, kubernetes-dashboard).
- No secrets, tokens, usernames, or host-specific absolute paths in evidence; preserve unknown states; no certification language.
- Do not commit or stage anything (the harness commits your worktree at stop).

## Verification

```verify
pnpm install --prefer-offline
sh -c 'ls evidence/ingests/*/source.json'
sh -c 'ls evidence/ingests/*/attempt.json'
sh -c '! find evidence/ingests fixtures -name "*.mjs" -o -name "*.js" -o -name "*.cjs" | grep -q .'
```

The fence is intentionally thin (ingest evidence is candidate-shaped); the receipt must carry digests, URLs, gate evidence, and the build-attempt outcome — that is the real verification surface, reviewed by the PM.

## Blocked permission

If both attempted candidates fail admission/acquisition, pnpm install cannot bootstrap the worktree, consent/network policy would be violated, or the no-driver-files rule makes some acquisition step impossible to record reproducibly, return status "blocked" with specifics in open_questions instead of improvising.
