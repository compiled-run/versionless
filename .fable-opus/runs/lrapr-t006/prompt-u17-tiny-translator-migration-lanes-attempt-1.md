Fable-Opus-Unit: lrapr-t006/u17-tiny-translator-migration-lanes
Fable-Opus-Timeout-Minutes: 35
Fable-Opus-Effort: high
Effort-Justification: The .angular-cli.json pre-angular.json workspace synthesis is the largest owed Angular capability — a new workspace-format class the adapter has never expressed, spanning a CLI 1.x era whose config semantics differ structurally from every proven cell.

## Goal

Deliver the tiny-translator migration cell's workspace-synthesis capability and both build lanes in /Users/jacksm5pro/dev/open-source/versionless — the Angular 4–6 band cell, and the adapter's first `.angular-cli.json` lift. Commit `c21e7d1` era: ingest evidence at `evidence/ingests/angular-tiny-translator-v0-12-0/` (Angular 5.0.3, CLI 1.5.4, TS 2.4.2, material/cdk 5.0.0-rc.2, `.angular-cli.json`, localStorage-only persistence, six code-backed journeys; zero-deviation baseline in the era cell Node 8.9.3 + yarn 1.3.2; caches at `.versionless/cache/angular-tiny-translator-v0-12-0-{source,baseline,runtime}`).

The accepted target cell for the Angular lane is Angular 16.2 / `@angular-devkit/build-angular:browser` / Node 16.20.2 (the factoriolab/jira-clone precedent — record the reuse). The existing adapter spine (`packages/frameworks/angular`: target-cell/ecosystem/testPackages tables, angular.json migration, tsconfig lift, analyzer-driven source migration, composed changeset) expects an `angular.json` workspace — this cell's entire point is the capability that gets there:

1. **`.angular-cli.json` → `angular.json` workspace synthesis** (new reusable capability per the package idiom): translate the CLI 1.x workspace fields the era actually used (apps[] → project architect targets, environmentSource/environments → fileReplacements, polyfills/styles/scripts/assets mappings, the schema differences) — analyzer/format-driven, app-agnostic, refusing unknown fields by name (the config-planning discipline from the Vite-origin adapter). Then the existing spine runs on the synthesized workspace.
2. An Angular 5→16 lift is ELEVEN majors — expect the ecosystem/source distance to be material (rxjs 5 pipeable operators, HttpModule→HttpClient if used, material 5 RC APIs, TS 2.4→5.1). Extend reusable capabilities as measured reality demands; anything requiring app-specific product code is blocked, not smuggled. A truthfully-red migrated lane with every compiler demand itemized is a COMPLETED outcome for this unit (the mj2 precedent) — the follow-up unit takes the itemized list.
3. Era baseline lane: rebuild ×2 byte-stability truthfully measured from the restored cache (the plain `ng build --prod --aot` variant — record the two-variant fact and which this cell's parity story uses).
4. Migrated lane: apply the composed changeset, consented closure install as needed (VL-LEGACY-CORPUS-2026-08-10, URLs/digests recorded, offline after), production build attempt ×2 with truthful outcome. `applicationFilesChanged` counted honestly with digests.
5. Build-level parity or the honest red record under `evidence/runs/angular-tiny-translator-v0-12-0/`; tests per idiom; overfitting guard extended; whole repo gate green.

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

- No packages/core/src changes (closed enumerations → blocked), no packages/frameworks/react/**, packages/cli/src/witness/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/**.
- No app-name branches in product code; the committed key.pem never enters evidence or fixtures; no fabricated evidence; truthful reds; no test weakening. Network only for consented installs. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/angular-tiny-translator-v0-12-0'
```

## Blocked permission

If the workspace synthesis cannot be generic (name the field), a closed enumeration outside the contract surfaces, or the honest cut line exceeds this unit (state exactly what lands vs what is owed — the synthesis capability alone is a valid cut), return status "blocked" with specifics in open_questions instead of improvising.
