Fable-Opus-Unit: lrapr-t023/u4-eshop-webspa-baseline
Fable-Opus-Timeout-Minutes: 45

## Goal

Era BASELINE for the committed Angular holdout eShopOnContainers WebSPA in /Users/jacksm5pro/dev/open-source/versionless (T023; acquisition done in u3 — `evidence/ingests/angular-eshop-webspa-netcore2-2/`, archive sha256 `e2b1ee45…`, pin `a387f210…`, app subpath `src/Web/WebSPA`, Angular 6.1.4 / CLI ^6.1.5 / build-angular ~0.7.0, npm lockfile v1, Dockerfile node:8.11 build-image fact, no engines). Produce a verified reproducible baseline production build in the app's own era toolchain. NO migration, NO witness (later units). Freeze f1a63359 intact (React 972ca801 / Angular 1f63f32c — verify, touch nothing under packages/frameworks/\*\*).

Do (mirror the pigallery2/T018-u2 baseline discipline):

1. Verify archive sha256 matches before use; extract immutable corpus copy + mutable baseline work lane under the established `.versionless/` conventions for `angular-eshop-webspa` — the WebSPA containment means the LANE is the WebSPA subpath (its package.json/angular.json root), extracted from the full pinned tree with the containment recorded.
2. ERA CELL: select and record by policy — the app declares no engines; the repo's own Dockerfile builds with node:8.11, the strongest era evidence. Use a Node 8 line darwin-x64 cell (Rosetta recorded as host fact) unless it genuinely cannot run on this host; nearest-era fallback recorded honestly if so (do not silently jump modern).
3. BASELINE INSTALL in the era cell: npm install per its lockfile v1. Record registry-closure findings honestly (deleted/unpublished packages at pin are findings, handled by the established digest-bounded narrowing precedent ONLY if they block install and only for branches provably outside the build path — record everything).
4. BASELINE PRODUCTION BUILD ×2 via the app's own toolchain (`ng build --prod` per its own package.json scripts / angular.json v1 browser builder; never substitute) into separate outputs; byte-compare; name any differing files (timestamped/hashed names are findings to record).
5. Record everything in `evidence/ingests/angular-eshop-webspa-netcore2-2/attempt.json` (extend: `baseline` block) + logs under `.../baseline/`. Unknowns preserved, failures visible.

## File contract

- `evidence/ingests/angular-eshop-webspa-netcore2-2/**`
- `fixtures/angular-eshop-webspa/**`

## Forbidden moves

- No packages/\*\* edits. No migration/witness work. Corpus copy immutable; lane sources stay as authored. Never force a non-era toolchain for the baseline. No credentials/PII/host-absolute-paths in evidence. Do not commit or stage. Kill any processes; leave no listeners.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
sh -c 'node -e "const a=require(\"./evidence/ingests/angular-eshop-webspa-netcore2-2/attempt.json\"); const b=a.baseline; if(!b) throw new Error(\"no baseline record\"); console.log(\"baseline recorded:\", JSON.stringify(Object.keys(b)).slice(0,200))"'
sh -c 'test "$(git rev-parse HEAD:packages/frameworks/react)" = "972ca80155bbc2a6eb3779943cd481b71d35e803" && test "$(git rev-parse HEAD:packages/frameworks/angular)" = "1f63f32c9f4eb327e2c85f63e69544f1eeb99428" && echo FREEZE-INTACT'
```

## Blocked permission

If the era cell cannot execute on this host (exact error), the baseline build fails in the era cell (full failing tail — a support-matrix finding), the archive hash mismatches, or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
