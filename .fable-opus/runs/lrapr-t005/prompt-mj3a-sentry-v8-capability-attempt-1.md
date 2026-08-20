Fable-Opus-Unit: lrapr-t005/mj3a-sentry-v8-capability
Fable-Opus-Timeout-Minutes: 35

## Goal

Deliver the generic Sentry-v8 migration capability in /Users/jacksm5pro/dev/open-source/versionless (`packages/frameworks/angular`, following the ngrx Effect-migration idiom: analyzer-driven, binding-resolved, refuses unsafe rewrites, leaves what it cannot rewrite whole). This is re-cut (a) of mj3; the mj3 receipt and `evidence/runs/angular-jira-clone/mj2-migrated-closure.json` carry the verified facts; the staged closure at `.versionless/stage/angular-jira-clone-mj2/app` (node_modules installed) is available READ-ONLY for fact-checking against real `@sentry/angular@8.55.2` types.

Capability spec (PM-ruled from mj3's verified findings):

1. `@sentry/tracing` imports (package folded into the SDK in v8): migrate the `Integrations` usage to the SDK's own exports — `@sentry/angular` 8 exports its Angular-flavoured `browserTracingIntegration`; the transform rewrites the import and the integration construction, binding-resolved (an `Integrations` from any other module is untouched).
2. `Sentry.routingInstrumentation` (removed in v8): folded into the same `browserTracingIntegration` construction per the v8 idiom.
3. `tracingOrigins` (no v8 counterpart on the integration): RELOCATE to `tracePropagationTargets` in the enclosing `Sentry.init` options literal. Refuse (leave whole, report) when the init call cannot be binding-resolved to the same Sentry module or when the target literal already declares `tracePropagationTargets`. Never drop silently.
4. All rewrites all-or-nothing per file region: a construction the analyzer cannot fully resolve is left whole and reported, never half-edited.
5. Tests per idiom: positives against the real jira-clone `src/main.ts` shape (fixture-scoped copy is fine); negatives — foreign `Integrations` binding untouched, unresolvable init refuses, existing `tracePropagationTargets` refuses, aliased Sentry import followed. Overfitting guard green (no app names in product surface).
6. Whole repo gate green. Do NOT apply to the staged closure or run builds — that is mj3c. No evidence/runs writes this unit unless recording capability-level facts (optional mj3a note allowed).

## File contract

- `packages/frameworks/angular/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `evidence/runs/angular-jira-clone/**`
- `fixtures/angular-jira-clone/**`

## Forbidden moves

- No packages/core/src, packages/frameworks/react/**, packages/cli/src/** (fixture drivers come in mj3c), packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/**, scripts/**, docs/**.
- The staged closure is read-only. No network. No app-name branches in product code. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
```

## Blocked permission

If the v8 idiom cannot be expressed as a generic binding-resolved transform, the refusal conditions are insufficient (name a concrete unsafe case), or the staged closure's real types contradict this spec, return status "blocked" with specifics in open_questions instead of improvising.
