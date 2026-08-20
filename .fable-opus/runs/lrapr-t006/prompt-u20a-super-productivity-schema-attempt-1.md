Fable-Opus-Unit: lrapr-t006/u20a-super-productivity-schema
Fable-Opus-Timeout-Minutes: 35

## Goal

Land the super-productivity witness core schema and wiring in /Users/jacksm5pro/dev/open-source/versionless — split 1 of 3 per u20's reconnaissance (commit `286476d`). NO journeys, NO publish, NO drag-surface membership (earned in u20b by a measured drag).

1. **Core schema** `packages/core/src/receipts/witness-angular-super-productivity.ts` per the tiny-translator idiom: pinned source identity; bound build receipts (era 64-file dist, migrated 62-file u18j dist, each with its determinism-modulo record — the Sass-random files identified with their cause); the 19-steps/8-decisions/5-families + 1-payload accommodation inventory; PER-LANE font-seam categories (era: the single fonts.googleapis.com CSS link; migrated: the gstatic preconnect + direct woff/woff2 members) with a `fontSeamDifference` record per the tiny-translator precedent; ngsw-in-both-lanes SW evidence shape (real registrations under the non-masking discipline — telemetry checkpoints per lane, whatever reality shows pinned exactly at publish); IndexedDB persistence evidence (localforage; storage keys recorded as measured); rendered-style probes; scroll; route shape; mutation slot; parser/renderer/verifier/aggregate member; barrel export.
2. **Wiring**: `angular-super-productivity` into `WITNESS_REAL_APP_NAMES` (framework 'angular'); NOT into the drag-surface list.
3. **The font-inlining locality probe** (read-only, recorded): determine from the u18 build records/logs/env when the migrated lane's inlined font CSS was fetched (Angular's inliner fetches at build time). Record the finding honestly in a note within the schema's evidence expectations or as an evidence record under `evidence/runs/angular-super-productivity-v2-13-15/` — if a build-time fetch occurred outside a consented window, that is a locality finding the receipt must carry for the Judge, stated plainly.
4. Tests per idiom (schema round-trip + rejections); whole repo gate green.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/witness-angular-super-productivity.ts`
- `packages/core/src/receipts/witness-real-app.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `evidence/runs/angular-super-productivity-v2-13-15/**`
- `fixtures/angular-super-productivity-v2-13-15/**`

## Forbidden moves

- No other packages/core changes; no packages/frameworks/**, packages/cli/src/fixture/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/**.
- No drag-surface membership; additive-only to pinned surfaces; no fabricated evidence; no app names in reusable surfaces beyond closed lists. No network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
```

## Blocked permission

If the schema cannot express a ruled fact, the font-inlining probe finds something that changes the cell's locality story (bring it — that is a finding, possibly blocked-worthy), or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
