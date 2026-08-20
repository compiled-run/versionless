Fable-Opus-Unit: lrapr-t006/u5-ingest-linkfree
Fable-Opus-Parallel: yes
Fable-Opus-Timeout-Minutes: 35

## Goal

Admit and immutably ingest the third-slot React candidate for the Versionless portfolio (board task T006). You work in an isolated worktree; bootstrap it first with `pnpm install --prefer-offline`.

Your single candidate (scout-verified 2026-08-11, unit lrapr-t006/u2, license blob bytes read at pin): **EddieHubCommunity/LinkFree (repo since renamed BioDrop, archived) @ commit `367d77297b5753644e11ecd22cf80e59c87b0dc8` = v0.72.0** (2022-08-31). Scout facts to re-verify at ingest, not trust: MIT LICENSE blob `3df71e6b…`, 1075 B, "Copyright (c) 2021 - 2022 Eddie Jaoude"; react ^17.0.2, react-scripts ^5.0.1 (webpack 5 — the portfolio's first CRA 5 cell), react-router-dom ^5.3.0, PrimeReact 6, purgecss postbuild, a `generate.js` prebuild codegen step; no engines, no packageManager, `package-lock.json` lockfileVersion 2 (~1.5 MB — the first npm-lock cell); 653 blobs; profile data fully local (`public/data/*.json` → generate.js → `public/list.json`); avatars resolve to GitHub image URLs (image-only egress, blockable). No `.gitattributes` claimed → verify zero LFS byte-scanned anyway.

Slug: EXACTLY `react-linkfree-v0-72-0` — literal directories only.

Admission gates, all verified BEFORE acquisition counts: MIT LICENSE text bytes at pin; real substantive application (not template); CRA 5/webpack 5 era; era-coherent date; ≥3 substantive journeys plausible (upstream cypress features: homepage, search, user profile routing, 404; multi-route react-router). Gate failure → record append-only, return blocked (no substitution).

Network policy: acquisition only, consent `VL-LEGACY-CORPUS-2026-08-10`, `VERSIONLESS_NETWORK_MODE=consented`; archive double-fetch byte-identical with SHA-256; every URL/digest recorded; offline after.

Deliverable per the established evidence shape (evidence JSON/ndjson + `fixtures/react-linkfree-v0-72-0/fixture.json`): immutable source identity, license evidence, provenance, dependency closure with honest lock state (npm lockfileVersion 2 recorded as found), declared legacy Node/bundler cell (react-scripts 5 era ≈ Node 14/16; declare and justify), and one baseline `npm ci` + production build attempt (including the generate.js prebuild and purgecss postbuild — record each step's truthful outcome) with truthful outcome. Driver scripts are working tools inside your contract; PM merges only evidence records + fixture.json.

## File contract

- `fixtures/react-linkfree-v0-72-0/**`
- `evidence/ingests/react-linkfree-v0-72-0/**`

## Forbidden moves

- No writes under packages/**, scripts/**, docs/**, evidence/runs/**, evidence/trust/\*\* or any path outside the contract; zero core enum edits.
- No candidate substitution; no secrets/usernames/host paths in evidence (profile data files contain real usernames of project contributors — treat the data files as app content addressed by digest, and do NOT quote individual usernames into your evidence records); preserve unknown states; no certification language.
- Do not commit or stage anything.

## Verification

```verify
pnpm install --prefer-offline
sh -c 'ls evidence/ingests/react-linkfree-v0-72-0/source.json'
sh -c 'ls evidence/ingests/react-linkfree-v0-72-0/attempt.json'
```

## Blocked permission

If any admission gate fails against the scout's claims, the prebuild/postbuild steps require network beyond the consented acquisition, pnpm install cannot bootstrap the worktree, or consent/network policy would be violated, return status "blocked" with specifics in open_questions instead of improvising.
