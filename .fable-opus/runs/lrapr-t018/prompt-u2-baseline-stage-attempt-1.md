Fable-Opus-Unit: lrapr-t018/u2-baseline-stage
Fable-Opus-Timeout-Minutes: 45

## Goal

Baseline stage for the Angular holdout pigallery2 1.7.0 in /Users/jacksm5pro/dev/open-source/versionless (T018; gate zero passed in u1 — ingest evidence at `evidence/ingests/angular-pigallery2-v1-7-0/`, archive at `.../archive/archive-1.tar.gz`, sha256 `ca55f920…`, pinned commit `6d44c22d…`). Produce a verified, reproducible BASELINE production build of the frontend in the app's own era toolchain. NO migration, NO witness journeys (later units).

Do:

1. CORPUS + WORK LANES (mirror the established `.versionless/` convention used by react-cypress-rwa and the Angular verticals — inspect how prior apps laid out `.versionless/cache/<app>-*` and `.versionless/work/<app>/baseline`): verify the archive sha256 matches the recorded `ca55f920…` before use, then extract an immutable corpus copy and a separate mutable baseline work lane for `angular-pigallery2`.
2. ERA RUNTIME CELL: the app declares engines `>=6.9 <11.0`, Docker `node:10-stretch`, Travis 10/11. Select and RECORD the era target by policy (Node 10 line matches the app's own Docker/engines; use a darwin-x64 Node 10 binary in a cached runtime cell like the existing `node-v14.16.1-darwin-x64` cell — Rosetta execution on this host is acceptable and must be recorded as a host fact, not hidden). If the Node 10 cell genuinely cannot run on this host, record why and fall back to the nearest era line that satisfies engines (`<11.0` is a hard ceiling from the app; do not silently jump to a modern Node).
3. BASELINE INSTALL: npm install in the work lane with the era cell (the app's install script runs `tsc && gulp build-prod` — let it, or run install with scripts and then the explicit build; record exactly what ran). NATIVE DEPS: `sqlite3@4.0.9` is required — if its native binding cannot be obtained for the era cell on this host (prebuilt missing + source build fails), that is a measured finding: record the exact failure; check whether the FRONTEND build path actually needs sqlite3 at all (it is a backend dep — the frontend build may succeed without backend natives; `sharp`/`gm`/`bcrypt` are optional). A frontend-only baseline build with backend natives honestly recorded as unavailable-on-host is acceptable for THIS unit if the frontend build is complete; say so plainly.
4. BASELINE PRODUCTION BUILD ×2: run the app's own production frontend build (Angular 8 CLI `:browser` builder via its own `@angular/cli@8.1.2` / `build-angular@0.801.2` — the `build-prod` gulp task drives it; never substitute a different builder) twice into separate output dirs and byte-compare. Record: exact commands, output file inventory + hashes, whether the two builds are byte-identical (if not, name the differing files — timestamps/hashes in filenames are a finding to record, not to hide).
5. RECORD in `evidence/ingests/angular-pigallery2-v1-7-0/attempt.json` (extend it): era cell chosen + why, install/build commands, native-dep outcomes, build determinism result, output inventory summary. Unknowns stay unknown; failures stay visible.

## File contract

- `evidence/ingests/angular-pigallery2-v1-7-0/**`
- `fixtures/angular-pigallery2/**`

## Forbidden moves

- No migration work, no adapter/frozen-subtree changes, no witness journeys. Never force Vite or any non-Angular builder on the baseline — the baseline is the app's own toolchain. No application-source hand edits EXCEPT none at all in the corpus copy (immutable); the work lane is where install/build artifacts land, its sources stay as authored. No modern-Node silent substitution beyond the app's engines ceiling. No credentials/PII/host-absolute-paths in recorded evidence (host facts like Rosetta go in as neutral statements). Do not commit or stage. Kill any processes you spawn.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
sh -c 'node -e "const a=require(\"./evidence/ingests/angular-pigallery2-v1-7-0/attempt.json\"); const b=a.baseline||a.baselineStage; if(!b) throw new Error(\"no baseline record\"); console.log(\"baseline recorded:\", JSON.stringify(Object.keys(b)))"'
```

## Blocked permission

If the era runtime cell cannot execute on this host at all (bring the exact error), the frontend production build fails in the era cell (bring the full failing output tail — that is a real finding about the support matrix), the archive hash does not match the recorded identity, or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
