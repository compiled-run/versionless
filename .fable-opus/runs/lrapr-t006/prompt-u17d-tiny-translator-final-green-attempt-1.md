Fable-Opus-Unit: lrapr-t006/u17d-tiny-translator-final-green
Fable-Opus-Timeout-Minutes: 35

## Goal

Close the tiny-translator migrated lane's final four demand families and land the deterministic green build + parity in /Users/jacksm5pro/dev/open-source/versionless. Commit `9c5f5a4` era: the lane sits at 4 diagnostics / 0 unresolvable, deterministic, itemized in `evidence/runs/angular-tiny-translator-v0-12-0/u17c-green-lane.json`; staged closure at `.versionless/stage/angular-tiny-translator-v0-12-0-u17b/app`.

The four families (from the record; generic shapes expected — extend reusable capabilities per the established idiom, binding-resolved, refusal over half-edits, tests + overfitting guard each):

1. `@angular/service-worker/src/low_level` deep import with `UpdateAvailableEvent` having no successor symbol — the successor idiom is version-events (`VersionReadyEvent` / `VersionEvent` filtering); this is an API-migration transform keyed on the installed package's surface (the barrel-split reader is your precedent), refusing shapes the surface cannot express.
2. `entryComponents` in the `@NgModule` literal — removed in Ivy; the transform drops the property ONLY when its referenced components are otherwise reachable (declared/bootstrapped/dynamically created via supported APIs) — analyzer-proven, refusal otherwise.
3. Bare `ModuleWithProviders` → `ModuleWithProviders<T>` with the analyzer resolving T from the returning static's module.
4. `FileReader.result` widened to `string | ArrayBuffer | null` — a narrowing transform at the measured usage sites the analyzer can prove (e.g. typeof/instanceof guards or an as-assertion recorded as a declared difference; prefer the provable guard).
5. Then: production build ×2 deterministic; build-level parity vs the era lane per the established idiom; truthful final `applicationFilesChanged`; residual demands itemized honestly if anything new surfaces (still a completed outcome).
6. Tests per idiom; whole repo gate green.

## File contract

- `packages/frameworks/angular/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `evidence/runs/angular-tiny-translator-v0-12-0/**`
- `fixtures/angular-tiny-translator-v0-12-0/**`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`

## Forbidden moves

- No packages/core/src changes, no packages/frameworks/react/**, packages/cli/src/witness/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/**.
- No app-name branches in product code; key.pem never in evidence/fixtures; no fabricated evidence; truthful reds; no test weakening. Network only for genuinely-needed consented installs (record). Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/angular-tiny-translator-v0-12-0'
```

## Blocked permission

If any of the four cannot be generic (name the construct), determinism fails, a closed enumeration outside the contract surfaces, or the honest cut line exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
