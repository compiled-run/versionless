Fable-Opus-Unit: lrapr-t006/u17b-tiny-translator-migrated-lane
Fable-Opus-Timeout-Minutes: 35

## Goal

Deliver the tiny-translator MIGRATED lane in /Users/jacksm5pro/dev/open-source/versionless — the owed half of the Angular 5→16 cell (u17's re-cut; commit `55ff004` landed the workspace synthesis + era lane + composed changeset, recorded at `evidence/runs/angular-tiny-translator-v0-12-0/u17-composed-changeset.json`).

1. Apply the composed changeset to a stage tree (the established `.versionless/stage/` idiom; source cache at `.versionless/cache/angular-tiny-translator-v0-12-0-source`).
2. Consented Angular 16.2 target closure install (VL-LEGACY-CORPUS-2026-08-10, VERSIONLESS_NETWORK_MODE=consented, every URL/digest recorded; offline after). The ecosystem table's mechanical rule covers @angular/material 5.0.0-rc.2 → the 16 line if the table reads one; an RC-era Material app across eleven majors may hit the no-successor/API-moves wall — dispositions recorded, never guessed.
3. Production build attempt through `@angular-devkit/build-angular:browser`. EXPECTED REALITY: Angular 5 source (rxjs 5 patterns, HttpModule-era APIs if present, Material 5 RC APIs, TS 2.4 idioms) will likely demand real source transforms. Extend reusable analyzer-driven capabilities as measured demands appear (the ngrx/Sentry/modal idiom: binding-resolved, refusal over half-edits, tests + overfitting guard per capability). A truthfully-RED build with every remaining compiler demand itemized exactly (file, symbol, library, needed transform) is a COMPLETED outcome — the itemized list is the next unit's spec (the mj2 precedent).
4. If green: build ×2 deterministic + build-level parity per the established idiom. If red: the honest red record with the demand list, era-lane references intact, no parity fabricated.
5. Truthful `applicationFilesChanged` update with digests; tests; whole repo gate green.

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
- No app-name branches in product code; key.pem never enters evidence/fixtures; no fabricated evidence; truthful reds; no test weakening. Network only for the consented install. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/angular-tiny-translator-v0-12-0'
```

## Blocked permission

If a required transform cannot be generic (name the construct), the closure cannot resolve even with recorded dispositions, or the honest cut line exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
