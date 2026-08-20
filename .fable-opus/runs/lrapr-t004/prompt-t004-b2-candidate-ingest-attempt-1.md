Fable-Opus-Unit: lrapr-t004/t004-b2-candidate-ingest
Fable-Opus-Parallel: yes
Fable-Opus-Timeout-Minutes: 35

## Goal

Admit and immutably ingest ONE new webpack/CRA-era legacy React MIT application for the Versionless production-readiness portfolio (T004). Isolated worktree; bootstrap with `pnpm install --prefer-offline`.

Ranked candidates, PM pre-screened for SPDX this time — slugs must be exactly these literal directory names: 1) `react-mycrypto` — MyCryptoHQ/MyCrypto at tag 2.5.64 (commit 1ff2fef4df5a90bf9ba003070b62a91d6817090f): a prior read-only scout verified the LICENSE at this tag is MIT and the stack is React 17 + raw webpack 4.46 + webpack-cli 3 (hand-rolled config, no CRA) — the most fleet-realistic hard case; known risks: node-polyfill-heavy crypto deps, RPC-coupled journeys, an Electron target sharing the repo. 2) `react-webamp` — captbaritone/webamp (SPDX MIT, active repo): you must pin an OLD tag (~2018–2020) and verify every gate AT that tag, including React 15–17 and webpack ≤4; substantive Winamp-clone media app (journeys: playback controls, playlist management, equalizer, skin switching). 3) `react-mobx-realworld` — gothinkster/react-mobx-realworld-example-app (SPDX MIT, archived): CRA-era Conduit clone (register/login, article CRUD, comments, favorites, profiles); NOTE this is a different repository from the graveyarded react-redux-realworld — do not confuse them.

Admission gates, all verified BEFORE acquisition counts (record evidence): MIT license at the exact pinned revision (quote it); real substantive application; React 15–17; webpack ≤4 or CRA; pin ≥ ~3 years old; ≥3 substantive journeys plausible. Rejections are recorded append-only in the slug's evidence dir and you move on. Hard cap: 2 candidates fully attempted, then blocked.

Network policy: acquisition only, consent ID `VL-LEGACY-CORPUS-2026-08-10`, `VERSIONLESS_NETWORK_MODE=consented`, GET-only, record every URL + digest, fetch the archive twice and require byte-identical results. Offline afterward.

Deliverable for the admitted candidate (document shapes: follow the repo's tier-f ingest evidence, and see the completed example at `evidence/ingests/react-papercups-v1-0-0/` on branch `worktree-agent-aeb089a27a4e00e12` via `git show`): immutable source identity with blob-level tree reconciliation, license/rights evidence, provenance, dependency closure with honest lock state, declared legacy Node/bundler cell, and one truthful baseline install/build attempt (a failing build is a recorded outcome, not a unit failure). Evidence under `evidence/ingests/<slug>/`, plus `fixtures/<slug>/fixture.json`.

Record every acquisition step as ad-hoc shell/node -e invocations logged verbatim into the slug's `transcript.ndjson`. The repo Bash guard refuses compound shell commands — issue each request as a separate plain invocation.

## File contract

- `fixtures/react-mycrypto/**`
- `fixtures/react-webamp/**`
- `fixtures/react-mobx-realworld/**`
- `evidence/ingests/react-mycrypto/**`
- `evidence/ingests/react-webamp/**`
- `evidence/ingests/react-mobx-realworld/**`

## Forbidden moves

- No writes under packages/**, scripts/**, docs/**, evidence/runs/**, evidence/trust/\*\* or outside the contract. Why: parallel-lane disjointness; product work is serial.
- No candidate or slug beyond the three literal directories; substitution = blocked.
- No `.js`/`.mjs`/`.cjs` files created anywhere (strict-TypeScript repo policy).
- No secrets, tokens, usernames, or host-specific absolute paths in evidence; preserve unknown states; no certification language. MyCrypto is a wallet app: its repo may contain example keys/mnemonics — never copy key material into evidence.
- Do not commit or stage anything.

## Verification

```verify
pnpm install --prefer-offline
sh -c 'ls evidence/ingests/*/attempt.json'
sh -c '! find evidence/ingests fixtures -name "*.mjs" -o -name "*.js" -o -name "*.cjs" | grep -q .'
```

No source.json assertion in the fence (a rejected-candidates outcome cannot satisfy it honestly); the receipt's digests, URLs, gate evidence, and build outcome are the review surface.

## Blocked permission

If all attempted candidates fail admission/acquisition, bootstrap fails, or consent/network policy would be violated, return status "blocked" with specifics in open_questions.
