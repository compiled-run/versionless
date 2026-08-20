Fable-Opus-Unit: lrapr-t005/mj3-source-transforms-parity
Fable-Opus-Timeout-Minutes: 35

## Goal

Complete the jira-clone migration cell in /Users/jacksm5pro/dev/open-source/versionless: reusable source transforms for mj2's five itemized compiler demands (commit `dbcc49e`; the demand list is in `evidence/runs/angular-jira-clone/mj2-migrated-closure.json` and the mj2 receipt), a deterministic ×2 Angular 16.2 production build, and build-level parity. This makes jira-clone the goal's second genuine `applicationFilesChanged > 0` Angular code migration.

The five demands and the capability shape each needs (every transform analyzer-driven and generic — keyed on ecosystem facts, never on this app):

1. `@sentry/tracing` Integrations import (package folded into the SDK in v8) — a Sentry-v8 API migration capability.
2. `Sentry.routingInstrumentation` removed in `@sentry/angular` 8 — same capability, the v8 replacement API (browserTracingIntegration idiom), binding-resolved like the ngrx Effect migration.
3. Nine `ng-zorro-antd/*/style/index.min.css` imports blocked by the 16 exports map — an exports-map-aware style-import migration (resolve what the package's exports actually expose for the style condition and rewrite generically).
4. `ng-zorro-antd@16.2.2` imports `@ctrl/tinycolor` without declaring it — a CELL-level undeclared-runtime-dependency capability: detect the hole from the installed closure's own facts and declare the dependency explicitly with a recorded reason (registry-verified version under consent if a fetch is needed; this is the generic peer-hole discipline, not an app patch).
5. `nzComponentParams` removed from `ModalOptions` (three call sites) — an ng-zorro modal-options migration to the v16 content-params idiom, binding-resolved, refusing unsafe rewrites like the Effect migration does.

Then: 6. Apply through the composed changeset; report the truthful `applicationFilesChanged` count with before/after digests (it should move off 0 — that movement is the numerator claim, count it honestly). 7. Migrated lane: production build ×2 deterministic (offline; the closure is installed — record any additional consented acquisition demand 4 requires). 8. Era lane: confirm the committed byte-stable state still reproduces (cheap rerun; truthful outcome). 9. Build-level parity under `evidence/runs/angular-jira-clone/` per the m2 factoriolab idiom (dist inventories with digests, known differences as recorded non-claims incl. the declared TSLint drop; Sentry DSN/GA id never reproduced in evidence — keep the existing test asserting that). No witness claims — next unit. 10. Tests per idiom for every new capability (positive + refusal negatives); overfitting guard green; whole repo gate green.

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
- No app-name/exact-revision/exact-source-string branches in product code; a transform that cannot be generic is a blocked-worthy finding.
- No fabricated evidence; truthful reds; no test weakening; nothing loosened. Network only under consent for demand 4 if required. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/angular-jira-clone'
```

## Blocked permission

If any of the five demands cannot be met by a generic transform, the build remains red after all five land (bring the new demand list), determinism fails, or the honest cut line exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
