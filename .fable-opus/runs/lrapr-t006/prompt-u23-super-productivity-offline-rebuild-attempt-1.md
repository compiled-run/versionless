Fable-Opus-Unit: lrapr-t006/u23-super-productivity-offline-rebuild
Fable-Opus-Timeout-Minutes: 35

## Goal

Rebuild the super-productivity migrated lane offline-faithful in /Users/jacksm5pro/dev/open-source/versionless (commit `a33a013`; locality finding at `evidence/runs/angular-super-productivity-v2-13-15/u21-font-inline-locality.json`: 45 inlined Roboto rules fetched at build time; the u22 methodology is the template — egress-guarded control + rebuilds).

1. Egress-guarded control build (workspace as u18j left it) — expect red on the fonts fetch; then apply the landed font-inlining-disable capability; rebuild ×2 with the guard: zero egress attempts, deterministic-modulo the recorded Sass-random files (this cell's known nondeterminism — the guard proves locality, the modulo rule stays). The emitted index.html should return to the era-faithful runtime font link (era carries `fonts.googleapis.com/css?family=Roboto...` — verify).
2. New superseding build record over u18j (immutable chain); the worker chunks and the 62-artifact census re-verified in the rebuilt dist.
3. NO witness work this unit — the u20 series (schema/journey/publish) resumes on the corrected lane next; this unit's deliverable is the clean lane + record.
4. Whole repo gate green.

## File contract

- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/test/**`
- `evidence/runs/angular-super-productivity-v2-13-15/**`
- `fixtures/angular-super-productivity-v2-13-15/**`

## Forbidden moves

- Originals immutable; no packages/core/src, packages/frameworks/** (capability landed — a failure there is blocked), packages/cli/src/witness/**, packages/trust/**, aggregate.json, evidence/trust/**, evidence/ingests/**, other evidence/runs/** dirs, scripts/**, docs/**.
- No fabricated evidence; the control build's red IS evidence — record it exactly. NO network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
sh -c 'ls evidence/runs/angular-super-productivity-v2-13-15'
```

## Blocked permission

If the capability fails on this workspace (bring the reading), the offline build goes red for a NEW reason (bring it), or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
