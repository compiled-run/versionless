Fable-Opus-Unit: lrapr-t006/u3-ingest-memos
Fable-Opus-Parallel: yes
Fable-Opus-Timeout-Minutes: 35

## Goal

Admit and immutably ingest the OLD-VITE React candidate for the Versionless portfolio (board task T006). You work in an isolated worktree; bootstrap it first with `pnpm install --prefer-offline`.

Your single candidate (scout-verified 2026-08-11, unit lrapr-t006/u2, license blob bytes read at pin): **usememos/memos @ tag `v0.1.3` = commit `565fe0cc567c02deb59fc04830df707ea7476d52`** (2022-07-01). Scout facts to re-verify at ingest, not trust: MIT LICENSE at repo root (blob `8b929a44…`, 1062 B, "Copyright (c) 2022 Memos"); the React app lives under `web/` (vite ^2.9.0, @vitejs/plugin-react ^1.0.0, react ^18.1.0, TS ^4.3.2, tailwind 3, less; build = `tsc && vite build`); no engines, no packageManager, `web/yarn.lock` yarn v1 (111,922 B); Go backend in the repo root (OUT of the ingest's build scope — the cell is the web app; record the backend's presence and the same-origin `/api/*` surface it implies: status, auth/login, auth/logout, auth/signup, user, user/me, memo, tag, shortcut, resource). No `.gitattributes` → verify zero LFS anyway (the factoriolab lesson).

Slug: EXACTLY `react-memos-v0-1-3` — literal directories only.

Admission gates, all verified BEFORE acquisition counts: MIT LICENSE file text bytes at the exact pinned revision; real substantive application (140 files under web/src per scout); genuine Vite 2 era (this is the required old-Vite-origin shape — the migration story is old-Vite→Vite 8); pinned revision date era-coherent; browser UI plausibly supporting ≥3 substantive journeys (compose/save memo, search + tag filter, archive/restore, settings toggle, shortcuts). Gate failure → record append-only, return blocked (no substitution).

Network policy: acquisition only, consent `VL-LEGACY-CORPUS-2026-08-10`, `VERSIONLESS_NETWORK_MODE=consented`; archive double-fetch byte-identical with SHA-256; every URL/digest recorded; offline after.

Deliverable per the established evidence shape (evidence JSON/ndjson + `fixtures/react-memos-v0-1-3/fixture.json`): immutable source identity, license/rights evidence (root LICENSE covering the web/ subtree — record the monorepo-scoping fact explicitly), provenance, dependency closure with honest lock state, declared legacy Node/bundler cell (era policy: Vite 2.9 era ≈ Node 14/16; host has native arm64 Node 16.20.2 — declare and justify), and one baseline install + `yarn build` attempt in `web/` with truthful outcome. Driver scripts are working tools inside your contract; PM merges only evidence records + fixture.json.

## File contract

- `fixtures/react-memos-v0-1-3/**`
- `evidence/ingests/react-memos-v0-1-3/**`

## Forbidden moves

- No writes under packages/**, scripts/**, docs/**, evidence/runs/**, evidence/trust/\*\* or any path outside the contract; zero core enum edits (serialization point owned by the serial phase).
- No candidate substitution; no secrets/usernames/host paths in evidence; preserve unknown states; no certification language.
- Do not commit or stage anything.

## Verification

```verify
pnpm install --prefer-offline
sh -c 'ls evidence/ingests/react-memos-v0-1-3/source.json'
sh -c 'ls evidence/ingests/react-memos-v0-1-3/attempt.json'
```

## Blocked permission

If any admission gate fails against the scout's claims, the web/-scoped build cannot run without the Go backend, pnpm install cannot bootstrap the worktree, or consent/network policy would be violated, return status "blocked" with specifics in open_questions instead of improvising.
