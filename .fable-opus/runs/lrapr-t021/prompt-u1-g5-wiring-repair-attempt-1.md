Fable-Opus-Unit: lrapr-t021/u1-g5-wiring-repair
Fable-Opus-Timeout-Minutes: 40
Fable-Opus-Effort: high
Effort-Justification: Repairing the migration engine's capability-composition wiring — deciding for each never-imported exported capability whether and where it belongs in migrateAngularCliEraWorkspace, with per-composition precondition tests and no behavior regression across four already-green Angular verticals — is high-judgment engine surgery where a wrong composition silently corrupts prior proofs.

## Goal

Repair the G5 WIRING DEFECT found by the Angular holdout (T018 diagnosis, commit 0ca6f49) in /Users/jacksm5pro/dev/open-source/versionless. AUTHORIZED ANGULAR ADAPTER REOPEN (T021): the 4df7bc96 freeze is lifted for the Angular subtree only — the React subtree MUST stay at oid `972ca80155bbc2a6eb3779943cd481b71d35e803` (verify before and after).

THE DEFECT: `packages/frameworks/angular/src/module-with-providers-type-argument.ts` and `unparameterised-base-class.ts` are exported from the package index but imported by NOTHING — `migrateAngularCliEraWorkspace` imports 13 capability modules and neither is among them, so the composed migration can never run them for any application. The T018 evidence shows they would answer pigallery2's `app.routing.ts:71` (TS2314 ModuleWithProviders) and `abstract.settings.component.ts:14` (NG2007 undecorated base class) exactly. This is the third occurrence of the class (entry-components-removal was composed in after super-productivity found it).

Do:

1. AUDIT FIRST (read-only): enumerate every module exported from `packages/frameworks/angular/src/index.ts`, mark which are imported by the era migration composition (directly or transitively), and classify each never-imported one: (a) capability that belongs in the composition (has a real precondition detector and transform), (b) deliberately standalone API (justify from its docs/usage), (c) dead export. Record the audit table in the evidence. Pay special attention to `template-i18n-runtime` (the T018 receipt flags it as never-imported, and pigallery2's era build is a ViewEngine i18n gulp build).
2. COMPOSE class-(a) capabilities into `migrateAngularCliEraWorkspace` where their preconditions match — minimally `module-with-providers-type-argument` and `unparameterised-base-class`, plus any other clear class-(a) member (decide honestly from the audit, not maximally). Composition follows the existing 13-module pattern (detector gates the transform; no unconditional rewriting).
3. PROTECT each new composition with tests (frameworks/angular/test/\*\*): precondition-positive (transform applies), precondition-negative (stands down), and idempotence if the existing pattern tests it.
4. NO-REGRESSION PROOF: the four green Angular verticals must stay green at the unit level — run the full node suite; any existing-fixture behavioral change is a defect in your composition, not a test to update. Do not weaken tests.
5. RE-MEASURE THE HOLDOUT (evidence only): re-run the pigallery2 migration probe flow (the u3 fixture runner `packages/cli/src/fixture/angular-pigallery2-migration-run.ts` / probe path) with the repaired engine and record which of the seven gaps' diagnostics change (expect G5's two compile sites to clear IF install-stage gaps G1-G3 are bypassed the same narrow way the u3 probe did; the G1-G3 engine fixes are the NEXT unit — do not fix them here). Record before/after diagnostic counts in `evidence/ingests/angular-pigallery2-v1-7-0/migration/` + extend attempt.json.

## File contract

- `packages/frameworks/angular/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `evidence/ingests/angular-pigallery2-v1-7-0/**`
- `packages/core/src/receipts/capability-coverage.ts`
- `evidence/trust/current/capability-coverage.json`

## Forbidden moves

- React subtree untouchable: `git rev-parse HEAD:packages/frameworks/react` must equal `972ca80155bbc2a6eb3779943cd481b71d35e803` throughout (you change nothing under packages/frameworks/react/**). No packages/core/src/{migrations,bundlers,analysis}/** changes in THIS unit (the G1-G3 install-stage knowledge fixes are next; if the wiring repair genuinely requires a core change, that is a blocked question, not an edit). No app-name/revision/exact-source branches. No app-source hand edits. No test weakening. Strict TypeScript, magic-regexp, pathe, ufo. Do not commit or stage. Kill any processes you spawn.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'test "$(git rev-parse HEAD:packages/frameworks/react)" = "972ca80155bbc2a6eb3779943cd481b71d35e803" && echo REACT-FROZEN-INTACT'
```

## Blocked permission

If a never-imported capability cannot be classified honestly (bring the ambiguity), composing one changes an existing green vertical's behavior (bring the diff — that is a real regression finding), the wiring repair requires a core-subtree change, or the work exceeds this unit (say which compositions landed), return status "blocked" with specifics in open_questions instead of improvising.
