Fable-Opus-Unit: lrapr-t024/u4-exports-map-wiring-green-attempt
Fable-Opus-Timeout-Minutes: 40

## Goal

Close G7 and attempt the eShop holdout's GREEN build in /Users/jacksm5pro/dev/open-source/versionless (T024, run lrapr-t024; AUTHORIZED ANGULAR REOPEN; React subtree `972ca80155bbc2a6eb3779943cd481b71d35e803` untouchable). After u3 (commit 8c6a8da) the ONLY remaining build failure is: `./Client/globals.scss - Can't find stylesheet to import. @import "ngx-toastr/toastr-bs4-alert.scss"` — ngx-toastr@17.0.2's exports map keys are extensionless, and `migratePackageStyleImports` (already exported) stands down because the eShop driver supplies no `packageExports` reading.

1. G7 WIRING: give the composition/driver its `packageExports` reading the established way (study how other drivers supply readings — the reading should be derived from the installed package's own package.json exports map, generic, not hardcoded). If the right place is the composition (so every app gets it) vs the driver (per-lane closure reading), decide from the existing pattern (the T021-u1 wiring-repair precedent: composition where preconditions are supply-complete, driver where the reading needs the lane's installed closure — this one needs the installed closure, so likely driver-side like the T024-u2 successor-class reading; record the reasoning).
2. RE-RUN migration + install + build. If further stylesheet/exports-map sites surface, they are the SAME class — let the capability answer them. A genuinely NEW class is named, not chased.
3. If the build goes GREEN: run it TWICE into separate outputs and byte-compare (name any differing files — hashed filenames etc. are findings). Record the full inventory.
4. Extend attempt.json (`t024U4Rerun` block) + migration logs; prior red records stay byte-identical (append-only discipline).
5. Tests for the wiring/reading; suite green; five green verticals unchanged.

## File contract

- `packages/frameworks/angular/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `packages/core/src/receipts/capability-coverage.ts`
- `evidence/trust/current/capability-coverage.json`
- `evidence/ingests/angular-eshop-webspa-netcore2-2/**`

## Forbidden moves

- React subtree untouchable. No app-name/revision/exact-source branches; no app-source hand edits; no test weakening; no strictness weakening. Offline (the installed closure carries everything this unit needs). Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage. Kill processes.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'test "$(git rev-parse HEAD:packages/frameworks/react)" = "972ca80155bbc2a6eb3779943cd481b71d35e803" && echo REACT-INTACT'
sh -c 'node -e "const a=require(\"./evidence/ingests/angular-eshop-webspa-netcore2-2/attempt.json\"); const r=a.t024U4Rerun; if(!r) throw new Error(\"no u4 rerun record\"); console.log(\"u4 rerun outcome:\", r.outcome||JSON.stringify(Object.keys(r)))"'
```

## Blocked permission

If the wiring cannot be placed without an app-name branch, a genuinely new class appears (name it), the twice-build byte-compare fails (bring the differing files), or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
