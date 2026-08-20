Fable-Opus-Unit: lrapr-t006/u20c2d-rebuild-behavior-check
Fable-Opus-Timeout-Minutes: 40

## Goal

Rebuild the super-productivity migrated lane with the binding-reorder fix and prove the regression is gone in /Users/jacksm5pro/dev/open-source/versionless (commit `cce3417`: the template-binding-reorder capability is landed and wired into the composed changeset; u20c2b's discriminator is the test — migrated lane must produce 0 page errors on load, matching era).

1. Apply the composed changeset (now including the reorder) to the stage tree; rebuild ×2 offline-guarded per the u23 methodology (egress guard preloaded; expect zero attempts; deterministic-modulo the recorded Sass-random files). Confirm the reordered split.component template is in the built output.
2. **Behavior check** (the load-bearing proof): boot the rebuilt migrated dist under the witness host; assert `witnessRecord.pageErrors` is now 0 (was 1/load) and the two split.component console errors are gone — matching the era lane. If ANY page error remains, that is a new finding (RED first, bring it).
3. Superseding build record over u23 (`u20c2d-*` per the supersede-by-reference discipline; u23 bytes immutable); the migrated dist's new census (worker chunks still present, the reordered template's effect on the bundle recorded); truthful `applicationFilesChanged` (the reordered template now among the migrated app-source changes).
4. Whole repo gate green. NO witness journeys/schema/publish (that resumes after this on the clean lane).

## File contract

- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `evidence/runs/angular-super-productivity-v2-13-15/**`
- `fixtures/angular-super-productivity-v2-13-15/**`

## Forbidden moves

- No packages/core/src, packages/frameworks/** (the capability is landed — a failure there is blocked), packages/cli/src/witness/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/**.
- Prior records immutable; no fabricated evidence; the behavior check is real (a remaining error is RED, recorded). Offline-guarded rebuild. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/angular-super-productivity-v2-13-15'
```

## Blocked permission

If a page error remains after the reorder (bring the new error), the rebuild goes red for a new reason, or the reorder did not reach the built template (bring the reading), return status "blocked" with specifics in open_questions instead of improvising.
