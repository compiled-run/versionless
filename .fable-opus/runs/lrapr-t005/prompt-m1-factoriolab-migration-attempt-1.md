Fable-Opus-Unit: lrapr-t005/m1-factoriolab-migration
Fable-Opus-Timeout-Minutes: 35
Fable-Opus-Effort: high
Effort-Justification: First Angular migration capability built from zero — no Angular adapter exists in packages/frameworks; this unit establishes the reusable transform architecture the entire Angular tranche depends on, against a real Angular 10 app.

## Goal

Deliver the goal's FIRST genuine Angular migration cell in /Users/jacksm5pro/dev/open-source/versionless: migrate the era-pinned factoriolab baseline to a declared modern supported Angular target with REUSABLE adapter capability and `applicationFilesChanged > 0`, truthfully counted. The Angular RealWorld version-bump precedent explicitly does NOT count — this must be real code migration performed by reusable product transforms.

Context (all committed): `angular-factoriolab` ingest evidence at `evidence/ingests/angular-factoriolab/` (Angular 10.1.5, CLI 10.1.4, build-angular:browser, webpack 4, Ivy, ngrx 10, TS 4.0.3; LFS payloads materialized; era baseline green under Rosetta x64 Node 12.14.1 in `.versionless/cache/angular-factoriolab-baseline`); `fixtures/angular-factoriolab/fixture.json`. The React lane's precedent is `packages/frameworks/react` (read its shape: app-agnostic capabilities, fixture-side regression setup, overfitting guard grepping product surface for app names — mirror the discipline, not the specifics; Angular follows a SUPPORTED ANGULAR BUILDER target per charter, never forced Vite).

Deliver:

1. `packages/frameworks/angular` adapter package (created if absent, following the react package's structural idiom): reusable migration capabilities that lift an Angular-CLI-era application toward a declared modern supported Angular cell. Architecture is yours, but every exported transform must be app-agnostic (no factoriolab branches in product surfaces — extend the overfitting guard pattern to the angular package) and each capability must be honest about what it does and does not handle.
2. Migration target: the newest Angular line you can reach HONESTLY in this unit with the official builder path (`@angular-devkit/build-angular` browser or application builder as appropriate to the target version), declared as an exact cell (Angular version + builder + target Node line chosen by policy, recorded — the host has native arm64 Node 16.20.2/22.x lines and Rosetta x64 Node 12.14.1). A well-evidenced intermediate target (e.g. a supported LTS several majors up) with a clear recorded rationale beats an overreached latest-version claim. Version-hop mechanics (what ng update would do) may be reproduced by your transforms; the point is that the TRANSFORMS are the reusable product, not hand-edits.
3. `applicationFilesChanged > 0`: real source changes produced by the adapter transforms, counted and itemized truthfully in the migration record.
4. Both lanes deterministic: era baseline rebuild ×2 byte-stable (existing cache/fixture flow) and migrated production build ×2 byte-stable, offline after the one consented dependency acquisition for the target cell (record every URL/digest if new dependencies must be fetched, consent ID VL-LEGACY-CORPUS-2026-08-10, VERSIONLESS_NETWORK_MODE=consented for that step only).
5. Build-level parity recorded honestly (dist inventory, entry shapes, known differences as recorded non-claims); browser witness parity is the NEXT unit — do not touch witness machinery.
6. Migration evidence under `evidence/runs/angular-factoriolab/` (attempt/plan/changes/build records, redacted, unknowns preserved, no certification language). Tests per repo idiom for every exported capability; whole repo gate green.

## File contract

- `packages/frameworks/angular/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `evidence/runs/angular-factoriolab/**`
- `fixtures/angular-factoriolab/**`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `vite.config.ts`

## Forbidden moves

- No packages/core/src changes (closed enumerations surface → blocked, next unit), no packages/frameworks/react/**, packages/cli/src/witness/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/**.
- No app-name/exact-revision/exact-source-string branches in product code; fixture-scoped accommodations stay in fixtures and are recorded as such.
- No fabricated evidence; a truthfully failing migration attempt is a recorded outcome, not a unit failure; no test weakening; nothing loosened.
- Network only for the one consented target-cell dependency acquisition step. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/angular-factoriolab'
```

## Blocked permission

If the honest migration cut line exceeds this unit (state exactly where the cut is and what lands vs. what is owed), a closed enumeration outside the contract blocks progress, the target cell cannot build deterministically, or dependency acquisition would exceed the consent purpose, return status "blocked" with specifics in open_questions instead of improvising.
