Fable-Opus-Unit: lrapr-t006/u20c2e-assemble-rebuild-behavior
Fable-Opus-Timeout-Minutes: 40

## Goal

Build a reusable evidence-free migrated-tree assembly entrypoint for super-productivity, use it to restore and rebuild the lane with the reorder fix, and prove the regression gone in /Users/jacksm5pro/dev/open-source/versionless (commit `cce3417`; u20c2d's finding: the green tree is reproducible only by the u18b→u18j sequence which writes immutable evidence — no evidence-free assembly path exists; the gitignored stage source tree is currently reverted to composeMigration-only; dist-23/24 and all evidence records are intact).

1. **Evidence-free assembly entrypoint** `assembleMigratedTree(...)` in a cli fixture module: composes the migration (now including the template-binding-reorder) AND applies every accommodation round the green tree depends on (the u18c apply, u18f chip-list-input split, u18g interop, u18h ng-pick-datetime→@danielmoncada rename + translate-loader provider + electron redirect + the 19 manual-migration-steps, u18i json/sass/url rounds, u18j workerUrl) as PURE tree transforms — reading the accommodation definitions from where they already live (extract the manual-step table and round applies into reusable exported functions where they are currently inline in main()s; the mains keep working, the logic is now callable without writing evidence). ZERO evidence records written by the assembly path. This is the T010-reusable capability: a cell's migrated tree assembled deterministically from source + committed transforms, no side effects.
2. Assemble the stage tree via the new entrypoint; add font-inlining-disable; rebuild ×2 offline-guarded (egress guard, zero attempts, deterministic-modulo Sass-random). Verify the reordered split.component template is in the built output.
3. **Behavior check**: boot the rebuilt migrated dist under the witness host; `witnessRecord.pageErrors` is 0 (was 1/load), the two split console errors gone, matching era. A remaining error is RED (bring it).
4. Superseding build record over u23 (`u20c2e-*`, supersede-by-reference; u23 bytes immutable); truthful applicationFilesChanged (reorder now among the migrated app-source changes); the assembly entrypoint's determinism recorded (assemble twice → identical tree).
5. Whole repo gate green; assembly-entrypoint tests (assembles the known tree; the reorder file present; idempotent).

## File contract

- `packages/frameworks/angular/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `evidence/runs/angular-super-productivity-v2-13-15/**`
- `fixtures/angular-super-productivity-v2-13-15/**`

## Forbidden moves

- No packages/core/src, packages/cli/src/witness/**, packages/frameworks/react/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/**.
- The assembly path writes NO evidence records (that is its point); refactoring inline round-applies into exported functions must not change what they produce (the existing u18*-* records stay reproducible); prior records immutable; no fabricated evidence; truthful reds. Offline-guarded rebuild. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/angular-super-productivity-v2-13-15'
```

## Blocked permission

If extracting an accommodation round into a pure function would change its output (name it), a page error remains after the rebuild (bring it), or the assembly cannot be made evidence-free within the unit, return status "blocked" with specifics in open_questions instead of improvising.
