Fable-Opus-Unit: lrapr-t006/u11-memos-api-projection
Fable-Opus-Timeout-Minutes: 35

## Goal

Build the frozen same-origin API projection for the memos witness cell in /Users/jacksm5pro/dev/open-source/versionless — the stub layer only, per the papercups d3 precedent (frozen API projection unit before the journey unit; d2's over-scope taught this split). Commit `e893bcf` era: memos lanes are committed (`fcb7838`, ingest `49735bc`); the app is session-gated with a ~20-endpoint same-origin `/api` surface (status, auth/login, auth/logout, auth/signup, user, user/me, memo, tag, shortcut, resource — verify the real surface from the pinned tree's `web/src` axios calls, not from this list).

The papercups template: `packages/cli/src/witness/` carries its frozen-projection idiom (read the papercups socket-stub/projection modules first) — a deterministic, in-witness-process, loopback-served projection of exactly the endpoints the journeys will touch, with every request/response ledgered, no real backend, and the projection's behavior FROZEN by digest so journeys cannot drift it silently.

Deliver:

1. Read the pinned `web/src` tree (source cache) and enumerate the ACTUAL API surface the UI reaches: method, path, request shape, response shape the UI consumes, session/auth semantics (`Home.tsx` redirects to /signin without a session — the projection must support a deterministic signup/login flow that yields a working session for journey purposes). Record this enumeration as evidence.
2. Implement the generic-idiom frozen projection in `packages/cli/src/witness/` (per-app module like the papercups one): deterministic state machine over an in-memory store seeded with synthetic fixture data (`fixtures/react-memos-v0-1-3/`), supporting the journey surface: signup/login → session, memo create/save, memo list, search/tag filter data, archive/restore, settings persistence, shortcut create — whatever the enumeration shows the UI actually needs. Every transport decision ledgered per the established idiom; behavior digest over the projection's responses.
3. Tests per idiom (projection determinism ×2, session flow, each endpoint family positive + an unenumerated-endpoint refusal negative).
4. NO journeys, NO published receipts, NO WITNESS_REAL_APP_NAMES entry this unit — the journey unit follows. Whole repo gate green.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `evidence/runs/react-memos-v0-1-3/**`
- `fixtures/react-memos-v0-1-3/**`

## Forbidden moves

- No packages/core/src changes at all this unit; no packages/frameworks/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/\*\*.
- The projection is synthetic-data-only; no real-looking credentials (clearly-fake values); no fabricated evidence; no test weakening.
- No network. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/react-memos-v0-1-3'
```

## Blocked permission

If the UI's real API surface exceeds what a deterministic projection can honestly support (name the exact interaction), the session gate cannot be satisfied without app modification, or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
