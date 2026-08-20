Fable-Opus-Unit: lrapr-t005/mj2-ecosystem-cell-closure
Fable-Opus-Timeout-Minutes: 35

## Goal

Resolve the jira-clone migrated closure in /Users/jacksm5pro/dev/open-source/versionless via a new generic ecosystem capability (mj1's cut line, commit `14272d6`; its evidence names the exact conflict layer). PM rulings baked in:

1. **`ecosystemPackages` cell table** in the Angular target cell (`packages/frameworks/angular/src/angular-target-cell.ts`), same generic shape as the existing `testPackages` idiom: keyed by package name, applied to any manifest, naming the version each community library publishes for the target Angular major. Populate it ONLY from registry-verified facts: consented metadata reads (consent ID VL-LEGACY-CORPUS-2026-08-10, VERSIONLESS_NETWORK_MODE=consented; record every URL/fact consulted; metadata only until install). The mj1 layer to cover: ng-zorro-antd, @ant-design/icons-angular, @datorama/akita + akita-ng-entity-service + akita-ng-router-store + akita-ngdevtools, @ngneat/content-loader, @ngneat/until-destroy, @ngneat/tailwind, @sentry/angular, ngx-quill, @storybook/angular + its four addons. Where a library publishes no Angular-16-compatible line, that package needs an explicit recorded disposition (see ruling 2), never a silent pin.
2. **TSLint-line drop is PRE-RULED**: codelyzer and nz-tslint-rules have no Angular 16 successor; the migrated cell drops the TSLint lint toolchain as a DECLARED migration difference (recorded in the cell and the evidence — the era baseline keeps it; this is the m2-owed tslint-target-removal capability, implement it generically: removal of TSLint-based targets/configs when the target line has no TSLint support, recorded per removal).
3. Apply the extended cell through the composed changeset; the migrated closure must then RESOLVE: `npm install` under consent completes green (record every acquired URL/digest per the ingest idiom; offline after).
4. **Recorded build attempt**: run the Angular 16.2 production build once. GREEN → record it. RED → itemize every compiler demand exactly (file, symbol, library, needed transform) in the evidence — that itemized list is mj3's packet input and a COMPLETED outcome for this unit. Do not begin source transforms here; the unit completes on (table + declared dispositions + resolved closure + recorded attempt).
5. Update `applicationFilesChanged`/workspace counts truthfully; evidence under `evidence/runs/angular-jira-clone/` (mj2-\* records, supersedes trail where applicable). Tests for the new capability per idiom (positive: table applies to any manifest; negatives: unlisted package untouched, no-successor package requires explicit disposition); overfitting guard green; whole repo gate green.

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
- Registry facts only for the table — no guessed versions; a version you could not verify is a disposition, not a pin.
- No app-name branches in product code; no fabricated evidence; truthful reds; no test weakening. Network only for consented metadata reads + the closure install. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/angular-jira-clone'
```

## Blocked permission

If a listed library's registry facts are ambiguous (no clear Angular-16 line and no defensible disposition), the closure still cannot resolve after the table applies, or the honest cut line exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
