Fable-Opus-Unit: lrapr-t006/u20c2o-probe-and-legd-producer
Fable-Opus-Timeout-Minutes: 35

## Goal

Complete the super-productivity journey producer so it drives ALL FIVE legs, and add the two-phase style-probe primitive leg (d) needs, in /Users/jacksm5pro/dev/open-source/versionless (commit `03388f8`; u20c2n's analysis: the producer at `real-app-run.ts` ~5280-5569 drives a/c/b/e but not d; leg d needs a within-journey before/after read of `--palette-primary-contrast-50` on body; the calibrated leg-d gestures are in `angular-super-productivity-theme-calibrate-run.ts`). NO runner, NO publish.

1. **Two-phase / ad-hoc style-probe primitive** on the generic `JourneyLifecycle` (`real-app-run.ts`): `host.renderedStyles([...])` already accepts arbitrary probes; expose a lifecycle method to read a caller-specified probe list at a chosen point mid-journey (custom CSS properties like `--palette-primary-contrast-50` on a selector). Additive — must not disturb the fixed end-of-journey `renderedStyles()` other verticals use (regression proof: full suite green). Test.
2. **Drive leg d in the producer** (`executeAngularSuperProductivityWitnessRun` / the super-productivity journey): port the calibrated leg-d gestures — create a second project via `addProject()` dialog, before-read `--palette-primary-contrast-50`, drive the `huePrimary` mat-select (after unchecking `isAutoContrast`) to a non-default hue, after-read proving the dark→light shift, switch project (title flip), the `w` shortcut. Populate `applicationJourney.settings`. PM-ruled ORDERING: leg (d) goes LAST, after the leg-(e) reload + persistence-order read (project-switch changes the current project, so persistence must be read first): create→c→b→reload→read-order→d. Scroll on `/project-settings`: record whichever the union allows (surface or measured-absence) as measured.
3. Both lanes (baseline dist-run2, migrated dist-25) — drive leg d on both, agree or declared-difference (theme rgb format already ruled a declared difference). Any real break RED first. `assertSettings` already requires settings — the producer now satisfies it. Tests per idiom; whole repo gate green. Publish nothing.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/witness-angular-super-productivity.ts`
- `packages/core/test/**`
- `fixtures/angular-super-productivity-v2-13-15/**`

## Forbidden moves

- No runner/publish; no other packages/core changes; no packages/frameworks/**, packages/trust/**, aggregate.json, evidence/**, scripts/**, docs/\*\*.
- The two-phase probe is additive (existing verticals' renderedStyles untouched); settled anchors never timing; no color-input-driven claim; no fabricated values (drive both lanes); truthful reds. No network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
```

## Blocked permission

If driving leg d in the producer reveals a real break on either lane (RED first with the measurement), the two-phase probe cannot stay additive (name the conflict), the /project-settings scroll/persistence ordering breaks a leg, or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
