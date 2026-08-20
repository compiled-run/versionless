Fable-Opus-Unit: lrapr-t008/hx2-migration-under-freeze
Fable-Opus-Timeout-Minutes: 35

## Goal

Run the React holdout through the FROZEN adapters in /Users/jacksm5pro/dev/open-source/versionless and record the truthful outcome — the falsification test the whole tranche builds to. Commit `71b621b` landed the ingest (cypress-realworld-app v1.0.18 @ f6b5cf3a, React 17.0.2 / react-scripts 4.0.3 / webpack 4.44.2, baseline green in Node 14.16.1, caches at `.versionless/cache/react-cypress-rwa-{source,baseline,runtime}`).

FREEZE DISCIPLINE (absolute): verify FIRST that the composite adapter fingerprint recomputes to `d9f75ef677cb850f664cc188abf77b8ebfd24e84cb58d147b74e9bbaa143eb77` (the verify fence does this too). The five frozen subtrees must not change by one byte. The generic CRA→Vite adapter (`packages/frameworks/react`, cross-proven on papercups + HospitalRun) is applied AS IS through a new cli fixture driver (the established `*-migration-run.ts` / `*-build-lanes-run.ts` idiom — drivers live in `packages/cli/src/fixture/`, which is outside the freeze). If the adapter cannot handle something in this app, that is THE FINDING: record it exactly (file, construct, missing capability) and let the outcome be red — proposing or making adapter changes is prohibited, and a red holdout is a valid, recordable result the Judge explicitly sanctioned.

Deliver:

1. Era baseline lane: rebuild ×2 byte-stable from the restored caches in the declared Node 14.16.1 cell (re-install from the committed frozen lockfile if node_modules is not cached — consent VL-LEGACY-CORPUS-2026-08-10, VERSIONLESS_NETWORK_MODE=consented for that step, every URL/digest recorded; offline after).
2. Migrated lane: apply the frozen CRA adapter composition to the pinned tree exactly as papercups/HospitalRun did (generic capabilities only, zero holdout-specific configuration beyond the fixture-declared facts every app provides: entry, public dir, env prefix mapping REACT*APP* per the adapter's existing generic handling). Install the Vite 8 target closure (consented, recorded). Production build attempt ×2: green → deterministic evidence; red → the exact compiler/build demands itemized as the falsification finding. Truthful either way.
3. Build-level parity records under `evidence/runs/react-cypress-rwa/` per the established idiom (dist inventories, declared differences, non-claims; the app's own SW/registration state recorded).
4. `applicationFilesChanged` truthfully counted (papercups/HospitalRun precedent is ZERO src edits — record what this app measures).
5. Tests for the new fixture drivers per idiom; whole repo gate green.

## File contract

- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `evidence/runs/react-cypress-rwa/**`
- `fixtures/react-cypress-rwa/**`

## Forbidden moves

- ZERO byte changes under the five frozen subtrees; ZERO changes anywhere else in packages/** outside the two cli contract dirs; no packages/core/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/**.
- No holdout-specific branches in any reusable surface; no adapter-change proposals executed; a red build is recorded, never patched around.
- No fabricated evidence; truthful reds; no test weakening. Network only for the consented install steps. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage.

## Verification

```verify
sh -c 'for p in packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis; do echo "$p $(git rev-parse HEAD:$p)"; done | shasum -a 256 | grep -q d9f75ef677cb850f664cc188abf77b8ebfd24e84cb58d147b74e9bbaa143eb77'
sh -c 'git diff --name-only -- packages/frameworks packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis | wc -l | grep -qx "0"'
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/react-cypress-rwa'
```

## Blocked permission

If the freeze fingerprint does not recompute, the baseline cannot rebuild in its declared cell, or the honest cut line exceeds this unit (state exactly what lands vs what is owed), return status "blocked" with specifics in open_questions instead of improvising. A red migrated build is NOT blocked — it is a completed truthful outcome.
