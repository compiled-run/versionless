Fable-Opus-Unit: lrapr-t005/mj3c-apply-builds-parity
Fable-Opus-Timeout-Minutes: 35

## Goal

Land the jira-clone migrated build and parity in /Users/jacksm5pro/dev/open-source/versionless — the final lane of the second genuine Angular code-migration cell. Everything is staged: the full capability chain is committed (`d53e86d`: Sentry v8, peer-hole declaration, exports-map style aggregate rewrite, cross-module NZ_MODAL_DATA migration, ecosystem table, TSLint drop, custom-webpack absorption); the resolved closure is installed at `.versionless/stage/angular-jira-clone-mj2/app`; caches at `.versionless/cache/angular-jira-clone-*`.

Handoff facts from mj3b: `readInstalledPackage` THROWS on unparseable bundles — choose which files you hand it (ng-zorro's 76 fesm2022 bundles all parse); the modal migration leaves a now-unused `Input` import specifier in content modules (visible diff residue, harmless to the build — record it as known residue, do not hand-patch it).

Deliver:

1. Apply the full composed changeset to the pinned tree; report the truthful final `applicationFilesChanged` count with before/after digests and the complete `declaredDifferences` inventory (style aggregate rewrite with measured bytes, TSLint drop, peer-hole declaration reason, Sentry relocations).
2. `@ctrl/tinycolor@^4.2.0` acquisition into the closure if not present (consented: VL-LEGACY-CORPUS-2026-08-10, VERSIONLESS_NETWORK_MODE=consented, URL+digest recorded; offline after).
3. Migrated lane: Angular 16.2 production build ×2 deterministic through the official browser builder. If red, itemize every remaining compiler demand exactly (that is a truthful recorded outcome — but with all five mj2 demands transformed, green is expected; investigate honestly either way).
4. Era lane: confirm the committed byte-stable state still reproduces (single rerun, truthful outcome).
5. Build-level parity under `evidence/runs/angular-jira-clone/` per the factoriolab m2 idiom (dist inventories with digests, size deltas, known differences as recorded non-claims: the 550KB style aggregate, TSLint-drop, ES-era differences, Sentry API surface). Sentry DSN/GA id never reproduced — keep the existing directory-wide assertion test green.
6. mj3c evidence records with supersedes trail over mj1/mj2 lane records where applicable. Whole repo gate green.

## File contract

- `packages/frameworks/angular/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `evidence/runs/angular-jira-clone/**`
- `fixtures/angular-jira-clone/**`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`

## Forbidden moves

- No packages/core/src changes, no packages/frameworks/react/**, packages/cli/src/witness/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/**.
- Adapter capability changes only if the build reveals a genuine generic gap (record it as such); no app-specific patches; no hand-edits to the migrated tree outside the changeset.
- No fabricated evidence; truthful reds; no test weakening. Network only for the consented tinycolor acquisition. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/angular-jira-clone'
```

## Blocked permission

If the build stays red after the full chain (bring the exact demand list), determinism fails, a genuine generic gap needs a capability outside this contract, or the honest cut line exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
