Fable-Opus-Unit: lrapr-t006/u20c2g-rebind-dist25
Fable-Opus-Timeout-Minutes: 35

## Goal

Rebind the super-productivity migrated lane from dist-23 to the clean dist-25 in /Users/jacksm5pro/dev/open-source/versionless (commit `0d05149`; u20c2e proved dist-25 loads with 0 page errors — the split regression fixed — but wrote only a BEHAVIOR record; the schema canonicalReceipts and the AppSpec `sources.migrated` still bind dist-23, which throws pageErrors=1, so no clean migrated journey can pass). This unit makes the clean lane the bound lane; NO journeys, NO legs.

1. Produce a proper dist-25 **build-lane** evidence record satisfying `assertAngularSuperProductivityBoundBuildReceipt` (the fields it checks: canonicalRoot=dist-25, determinism-modulo the recorded Sass-random files, inventory, inventorySha256 — recompute from the dist-25 tree u20c2e built; if the dist-25 tree must be re-assembled, use the committed `assembleMigratedTree` entrypoint + offline-guarded rebuild, deterministic ×2). Supersede u23's build-lane binding by reference (u23 and u20c2e records immutable). The record carries the regression-gone fact (0 pageErrors, bound to the u20c2e behavior proof).
2. Rebind the schema's `WITNESS_ANGULAR_SUPER_PRODUCTIVITY_CANONICAL_RECEIPTS` migrated entry and the AppSpec `sources.migrated` to dist-25 / the new record (recorded as a supersede per mw1e). Any other pin the rebind touches (census, applicationFilesChanged now including the reorder) moves to the measured dist-25 values.
3. Whole repo gate green — the existing schema/AppSpec tests re-point to dist-25; no journey runs yet.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/witness-angular-super-productivity.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `evidence/runs/angular-super-productivity-v2-13-15/**`
- `fixtures/angular-super-productivity-v2-13-15/**`

## Forbidden moves

- No journeys/legs/drag; no other packages/core changes; no packages/frameworks/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/\*\*.
- Prior records immutable (supersede by reference); no fabricated evidence; the dist-25 tree is the u20c2e-assembled one (offline-guarded if rebuilt); truthful values. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/angular-super-productivity-v2-13-15'
```

## Blocked permission

If the dist-25 tree cannot be reproduced for the inventory (bring the reading), the bound-build-receipt shape needs a field the behavior record cannot supply and a rebuild is infeasible in-unit, or the rebind surfaces a closed enumeration outside the contract, return status "blocked" with specifics in open_questions instead of improvising.
