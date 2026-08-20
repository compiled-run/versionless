Fable-Opus-Unit: lrapr-t018/u3-frozen-adapter-migration
Fable-Opus-Timeout-Minutes: 45
Fable-Opus-Effort: high
Effort-Justification: This is the Angular frozen-adapter holdout event — running a never-adapter-seen Angular 8 app through the frozen migration engine where any gap must be diagnosed precisely as RED falsification evidence (named to the byte, like the React holdout's process-global and missing-export gaps) rather than papered; the diagnosis quality determines whether the goal's generality claim is honest.

## Goal

THE ANGULAR HOLDOUT EVENT: migrate pigallery2 1.7.0 under the FROZEN adapters in /Users/jacksm5pro/dev/open-source/versionless (T018; baseline done in u2 — work lane `.versionless/work/angular-pigallery2/baseline`, era cell Node 10.24.1, triple byte-identical baseline build). Apply the frozen migration engine AS-IS to produce a migrated workspace + target production build via the Angular framework-supported browser builder. A migration gap is a RED FINDING (the falsification result), never something to fix here.

FREEZE DISCIPLINE (absolute):

- Composite fingerprint MUST equal `4df7bc961033fc5856b4d58e0bca9f11ad2aa9d43aaaee726956f34d209b37e7` before AND after (recompute: SHA-256 over newline-terminated `<path> <tree-oid>` lines for packages/frameworks/react, packages/frameworks/angular, packages/core/src/migrations, packages/core/src/bundlers, packages/core/src/analysis via `git rev-parse HEAD:<path>`). The Angular subtree oid is `ca3824d0595d1fa88d37feda6b1785dfd79e72c4` and must not move.
- Zero frozen-subtree edits. Zero application-source hand edits (app source stays as authored). Zero app-name/revision/exact-source branches anywhere.

Do:

1. STUDY the established Angular vertical flow first: how tiny-translator and super-productivity were migrated (their runners/fixtures under packages/cli/src/fixture/ and packages/cli/src/witness/, their evidence records, the Angular adapter's public API in packages/frameworks/angular — READ-ONLY). Mirror that flow for pigallery2; do not invent a new migration path.
2. MIGRATE: run the frozen engine (analyze → plan → migrate, whatever the established flow is) against a fresh migrated lane for the pigallery2 FRONTEND (`.versionless/work/angular-pigallery2/target` or the convention's equivalent), from the same corpus input. The app is Angular 8.1.2, angular.json v1, `:browser` builder, TS 3.4.5. The engine decides the target Angular version/builder per its frozen policy (never force Vite; Angular follows the framework-supported builder).
3. TARGET BUILD ×2: if migration completes, produce the migrated production build twice and byte-compare (differing files named). Record exact commands + output inventory in the evidence.
4. IF A GAP APPEARS (transform crash, unsupported construct, build failure in the migrated lane): diagnose it TO THE BYTE like the React holdout gaps (which module, which construct, why the engine cannot carry it, why webpack/Angular-8 tolerated it) and record it as a RED finding in the evidence + a blocked receipt. Multiple gaps: name each. Do NOT patch the adapter, the app, or the output.
5. RECORD everything in `evidence/ingests/angular-pigallery2-v1-7-0/attempt.json` (extend: `migration` block) + logs under `evidence/ingests/angular-pigallery2-v1-7-0/migration/`. If a runner driver file is needed (like react-cypress-rwa-calibrate-run.ts was for React), it goes in `packages/cli/src/fixture/` and drives ONLY via public frozen APIs.

## File contract

- `evidence/ingests/angular-pigallery2-v1-7-0/**`
- `fixtures/angular-pigallery2/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`

## Forbidden moves

- NO edits under packages/frameworks/**, packages/core/src/migrations/**, packages/core/src/bundlers/**, packages/core/src/analysis/** (frozen), packages/core/src/receipts/**, packages/cli/src/witness/**, packages/trust/**, evidence/trust/**, other evidence/runs/\*\*. No app-source hand edits in any lane. No app-name/revision/exact-source branch in anything that could ship (the fixture driver may name the app's PATHS as fixture config the way react-cypress-rwa-calibrate-run.ts does — that is fixture-scoped setup, not product code). No witness journeys yet (next unit). No test weakening. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage. Kill any processes you spawn.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
sh -c 'for p in packages/frameworks/react packages/frameworks/angular packages/core/src/migrations packages/core/src/bundlers packages/core/src/analysis; do echo "$p $(git rev-parse HEAD:$p)"; done | shasum -a 256 | grep -q 4df7bc961033fc5856b4d58e0bca9f11ad2aa9d43aaaee726956f34d209b37e7 && echo FREEZE-INTACT'
sh -c 'node -e "const a=require(\"./evidence/ingests/angular-pigallery2-v1-7-0/attempt.json\"); if(!a.migration) throw new Error(\"no migration record\"); console.log(\"migration recorded:\", a.migration.outcome||JSON.stringify(Object.keys(a.migration)))"'
```

## Blocked permission

If the frozen engine cannot carry the app (RED — bring the to-the-byte diagnosis; that is the falsification result, a valid holdout outcome), the established Angular flow cannot be identified from the prior verticals, the migrated build fails (RED with the full failing tail), or the work exceeds this unit (say what is done), return status "blocked" with specifics in open_questions instead of improvising.
