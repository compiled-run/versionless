Fable-Opus-Unit: lrapr-t021/u2-install-stage-successors
Fable-Opus-Timeout-Minutes: 40
Fable-Opus-Effort: high
Effort-Justification: Fixing dependency-successor knowledge requires deciding honestly between fabricated versions, real successor lines, no-successor readings, and era-parity peer semantics — each choice is a generality claim that must hold beyond this app and not corrupt four green verticals; a wrong policy here silently overclaims support.

## Goal

Close the Angular holdout's three INSTALL-stage gaps (G1–G3 from the T018 diagnosis, commit 0ca6f49) generically in /Users/jacksm5pro/dev/open-source/versionless, so the migrated pigallery2 closure INSTALLS under the repaired engine. AUTHORIZED ANGULAR REOPEN (T021); React subtree must stay at oid `972ca80155bbc2a6eb3779943cd481b71d35e803`.

THE GAPS (study the u3 evidence in `evidence/ingests/angular-pigallery2-v1-7-0/migration/` and the engine's ecosystem/successor table before writing anything):

- G1: the `@angular-devkit/` family-prefix rule writes `^16.2.0` for `@angular-devkit/build-optimizer`, which stops at 0.1302.1 — deprecated and folded into build-angular. A family prefix is a naming convention, not a release train. The honest generic fix: the rule must not fabricate versions for packages that left the version train; for a folded-in package the migrated closure should drop the direct dep (build-angular carries it), recorded as a declared difference.
- G2: `ng2-slim-loading-bar@4.0.0` — latest dist-tag still peers `@angular/core ^2.4.7 || ^4.0.0`: a genuine NO-SUCCESSOR package. Study how the engine's table treats no-successor cases in prior verticals (removal? declared-incompatibility? era-peer semantics?) and apply the established reading; if no established reading exists, design one honestly. CANDIDATE FRAMING to evaluate on merits (not mandated): the app's own era (npm 6 / Node 10) treated peer deps as warnings, so an era-parity install policy for the migrated closure could be a generic capability the same way React's process-global shim reproduced webpack-4's real runtime contract — but only if it is a DECLARED policy with honest limits, never a blanket --force.
- G3: `ngx-toastr@10.0.4` — live successor lines exist (17.0.0–19.1.0 declare `>=16.0.0-0`): add the successor-line knowledge through the table's established mechanism, with the same evidence discipline existing entries carry.

Do:

1. Find the actual table/rule sources (the T018 receipt names `ANGULAR_16_ECOSYSTEM_PACKAGES`; the family-prefix rule lives with it). Understand how existing entries and prior verticals justified their readings.
2. Land the three fixes generically (no app-name/revision branches — the entries are about the PACKAGES, which is the table's established shape).
3. Tests for each: G1 (family-prefix stands down for train-departed packages; folded-in dep dropped as declared difference), G2 (no-successor reading produces its honest outcome), G3 (successor line resolves).
4. Full node suite green; the four green Angular verticals unchanged.
5. RE-RUN the pigallery2 migration + INSTALL (the u3 runner/probe flow, era cell): the migrated closure must now install cleanly (no ETARGET/ERESOLVE). Then attempt the migrated build ONCE and record the resulting compile-stage diagnostics honestly (G4/G5-NG2007/G6/G7 are expected to remain — record their current shape; fixing them is later units). Extend `evidence/ingests/angular-pigallery2-v1-7-0/attempt.json` + migration logs.

## File contract

- `packages/frameworks/angular/**`
- `packages/core/src/migrations/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `evidence/ingests/angular-pigallery2-v1-7-0/**`
- `packages/core/src/receipts/capability-coverage.ts`
- `evidence/trust/current/capability-coverage.json`

## Forbidden moves

- React subtree untouchable (verify oid unchanged). No packages/core/src/{bundlers,analysis}/\*\* unless the table genuinely lives there (then only the table). No app-name/revision/exact-source branches. No app-source hand edits. No blanket --force/--legacy-peer-deps without a declared, tested, honestly-limited policy. No test weakening. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage. Kill any processes; leave no listeners.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'test "$(git rev-parse HEAD:packages/frameworks/react)" = "972ca80155bbc2a6eb3779943cd481b71d35e803" && echo REACT-FROZEN-INTACT'
```

## Blocked permission

If a gap's honest reading cannot be established from the table's own discipline (bring the candidate readings and their tradeoffs), the install still fails after the three fixes (bring the exact new error — a further named gap), a green vertical changes behavior, or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
