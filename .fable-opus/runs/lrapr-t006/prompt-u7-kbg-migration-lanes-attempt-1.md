Fable-Opus-Unit: lrapr-t006/u7-kbg-migration-lanes
Fable-Opus-Timeout-Minutes: 35

## Goal

Deliver the killedbygoogle migration cell's adapter capability and both build lanes in /Users/jacksm5pro/dev/open-source/versionless — the portfolio's first LEGACY-NEXT migration. Commit `fcb7838` era: ingest evidence at `evidence/ingests/next-killedbygoogle-v3-0-0/` (Next ^12.0.10 pages/ router, React ^17.0.2, react-select 5.2.2, TS ^4.5.5, custom .babelrc disabling SWC, zero backend, data local graveyard.json 91KB; baseline fully green incl. `next export` writing 2 static documents — the static-export path IS this cell's migration story; caches at `.versionless/cache/next-killedbygoogle-v3-0-0-{source,baseline}`; Node 16.20.2 in-lane, yarn v1 frozen lockfile).

Migration thesis to prove or falsify honestly: a single-route, zero-API, statically-exported Next 12 pages/ app is semantically a React SPA whose framework surface (next/head, next/image, next/dynamic, pages/\_app, pages/\_document, data-fetching exports if any) can be lifted by REUSABLE transforms to a Vite 8 build producing equivalent static output. The single-route limitation is already a published non-claim — nothing here generalizes to multi-route/SSR/API-route Next apps, and the capability docs must say so.

Deliver:

1. Reusable LEGACY-NEXT adapter capability in `packages/frameworks/react` (new module per the package idiom, e.g. `react-next-static-adapter.ts`): analyzer-driven lifts for exactly the Next surfaces this app actually uses (verify from the pinned tree first — read what pages/, \_app, \_document, components actually import from 'next/\*'; every transform binding-resolved and app-agnostic; anything outside the verified surface is out of scope, stated as a non-claim, never speculatively implemented). Entry/document synthesis per the CRA adapter's established pattern where applicable. Refusal over half-edits; overfitting guard extended.
2. Era baseline lane: rebuild ×2 byte-stable from the restored cache (next build + next export, Babel path).
3. Migrated lane: apply transforms, Vite 8 production build ×2 deterministic (consented closure install only if genuinely needed — the memos precedent showed a lift may ride the era lockfile; record either way). Truthful `applicationFilesChanged` with digests (Next-surface imports WILL move — count honestly).
4. Build-level parity vs the era static export under `evidence/runs/next-killedbygoogle-v3-0-0/` (document inventories, the ad-li/carbonads and third-party script facts carried as recorded differences where the static output differs, non-claims; no browser claims — witness later).
5. Tests per idiom; whole repo gate green.

## File contract

- `packages/frameworks/react/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `evidence/runs/next-killedbygoogle-v3-0-0/**`
- `fixtures/next-killedbygoogle-v3-0-0/**`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`

## Forbidden moves

- No packages/core/src changes (closed enumerations → blocked), no packages/frameworks/angular/**, packages/cli/src/witness/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/**.
- No app-name branches in product code; fixture-scoped accommodations stay in fixtures, recorded.
- No fabricated evidence; truthful reds; no test weakening. Network only for a genuinely-needed consented closure install (VL-LEGACY-CORPUS-2026-08-10). Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/next-killedbygoogle-v3-0-0'
```

## Blocked permission

If the Next surface this app uses cannot be lifted by generic transforms (name the exact construct), the migrated lane cannot reach a deterministic green build honestly, a closed enumeration outside the contract surfaces, or the honest cut line exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
