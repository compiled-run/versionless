Fable-Opus-Unit: lrapr-t006/u6-memos-migration-lanes
Fable-Opus-Timeout-Minutes: 35

## Goal

Deliver the memos migration cell's adapter capability and both build lanes in /Users/jacksm5pro/dev/open-source/versionless — the portfolio's first OLD-VITE-ORIGIN migration (Vite 2.9.5 → Vite 8), a new bundler-origin class beside the proven CRA path. Commit `49735bc` era: ingest evidence at `evidence/ingests/react-memos-v0-1-3/` (React 18.1, vite 2.9.5, @vitejs/plugin-react 1.x, TS 4.6.3, tailwind 3 + less, app under `web/`; caches at `.versionless/cache/react-memos-v0-1-3-{source,baseline}`). The adapter surface is open this tranche (post-d9f75ef6 per the T999 audit).

Era-lane truth you inherit (record, never repair): the pin's own declared `yarn build` (`tsc && vite build`) FAILS in its tsc gate — the lockfile pins two `@types/react` copies under `skipLibCheck: false`, a property of the pinned revision. The ingest's labeled deviation showed `vite build` alone is green (898 modules). The era baseline lane is therefore the deviation path, carried forward with its label — the honest era story is "the pin's own typecheck gate was broken at release; the bundler built".

Deliver:

1. Reusable VITE-ORIGIN adapter capability in `packages/frameworks/react` (new module per the package's idiom, e.g. `react-vite-origin-adapter.ts`): lifts a Vite-2-era workspace to the Vite 8 target — config translation (plugin-react 1.x → the current plugin idiom, less/tailwind wiring, alias/env handling as the era config actually uses them), analyzer-driven and app-agnostic, each capability honest about coverage, overfitting guard extended. Architecture yours; mirror the CRA adapter's discipline (app-agnostic, closed-list-free, refusal over half-edits).
2. Era baseline lane: rebuild ×2 byte-stable from the restored cache (Node 16.20.2 arm64, yarn frozen lockfile, the labeled deviation carried).
3. Migrated lane: apply the adapter, install the Vite 8 target closure (consented: VL-LEGACY-CORPUS-2026-08-10, VERSIONLESS_NETWORK_MODE=consented, URLs/digests recorded; offline after), production build ×2 deterministic. Truthful `applicationFilesChanged` with before/after digests (Vite→Vite may be near-zero src changes — count honestly; React 18.1 under Vite 8's plugin-react may need real moves — record what reality demands, extending reusable capabilities only).
4. Build-level parity under `evidence/runs/react-memos-v0-1-3/` per the established idiom (dist inventories, declared differences, non-claims; no browser claims — witness later; the session-gated /api surface is a witness-phase fact, not this unit's).
5. Tests per idiom; whole repo gate green.

## File contract

- `packages/frameworks/react/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `evidence/runs/react-memos-v0-1-3/**`
- `fixtures/react-memos-v0-1-3/**`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`

## Forbidden moves

- No packages/core/src changes (closed enumerations → blocked, serial phase owns them), no packages/frameworks/angular/**, packages/cli/src/witness/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/**.
- No app-name branches in product code; fixture-scoped accommodations stay in fixtures, recorded.
- No fabricated evidence; truthful reds; no test weakening. Network only for the consented closure install. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/react-memos-v0-1-3'
```

## Blocked permission

If the Vite-origin lift cannot be generic, the migrated lane cannot reach a deterministic green build honestly, a closed enumeration outside the contract surfaces, or the honest cut line exceeds this unit (state exactly what lands vs what is owed), return status "blocked" with specifics in open_questions instead of improvising.
