Fable-Opus-Unit: lrapr-t006/u8-linkfree-migration-lanes
Fable-Opus-Timeout-Minutes: 35

## Goal

Deliver the LinkFree migration cell's build lanes in /Users/jacksm5pro/dev/open-source/versionless — the portfolio's first CRA 5/webpack 5 cell, and the third independent application over the generic CRA→Vite adapter (papercups CRA 3, HospitalRun CRA 3, holdout CRA 4 are its history; this is the react-scripts 5 era proof). Commit `a6de411` era: ingest evidence at `evidence/ingests/react-linkfree-v0-72-0/` (React ^17.0.2, react-scripts ^5.0.1/webpack 5.73.0, react-router-dom ^5.3.0, PrimeReact 6, generate.js codegen prebuild, purgecss postbuild with two recorded upstream defects; npm lockfileVersion 2, 1825 sha512 entries; baseline fully green on Node 16; caches at `.versionless/cache/react-linkfree-v0-72-0-{source,baseline}`).

Standing rulings you inherit: the witness phase will use a SYNTHETIC profile corpus (real contributor data never renders into evidence) — this unit's build lanes may build with the real in-tree data (it is part of the pinned archive) but must not quote usernames into evidence records (the ingest's aggregate-digest redaction pattern); the non-UTF-8 decoding capability now leads the CRA adapter (commit `6f90ed7`) — if this closure carries any non-UTF-8 module, that is the capability's second live app, record it.

Deliver:

1. Apply the EXISTING generic CRA→Vite adapter composition to the pinned tree. Expected reality: react-scripts 5 differs from 3/4 (webpack 5 semantics, different env handling, possibly ESM-stricter deps). Extend the adapter's reusable capabilities ONLY as measured reality demands (analyzer-driven, app-agnostic, tests per capability, overfitting guard green — 'linkfree' joins the guard list). The build pipeline facts matter: generate.js codegen must run as the app's own prebuild (record how the migrated lane runs it), and the purgecss postbuild question is a design decision — the migrated lane may declare purgecss out of the Vite build's scope IF recorded as a declared difference with measured CSS sizes both ways, or absorb it generically; choose by what is honest and reusable, record the reasoning.
2. Era baseline lane: rebuild ×2 from the restored cache, byte-stability truthfully measured (CRA 5 may or may not be byte-stable — publish what reality shows, the kbg build-id precedent applies).
3. Migrated lane: Vite 8 production build ×2 deterministic (consented closure install only if genuinely needed; record either way). Truthful `applicationFilesChanged` with digests.
4. Build-level parity under `evidence/runs/react-linkfree-v0-72-0/` per the established idiom; the avatar/dicebear egress cascade recorded as witness-phase facts.
5. Tests per idiom; whole repo gate green.

## File contract

- `packages/frameworks/react/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `evidence/runs/react-linkfree-v0-72-0/**`
- `fixtures/react-linkfree-v0-72-0/**`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`

## Forbidden moves

- No packages/core/src changes (closed enumerations → blocked), no packages/frameworks/angular/**, packages/cli/src/witness/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/**.
- No app-name branches in product code; no usernames in evidence records; no fabricated evidence; truthful reds; no test weakening. Network only for a genuinely-needed consented install. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/react-linkfree-v0-72-0'
```

## Blocked permission

If react-scripts 5 demands a capability that cannot be generic (name the construct), the migrated lane cannot reach a deterministic green build honestly, a closed enumeration outside the contract surfaces, or the honest cut line exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
