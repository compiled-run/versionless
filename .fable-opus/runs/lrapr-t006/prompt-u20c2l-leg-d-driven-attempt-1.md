Fable-Opus-Unit: lrapr-t006/u20c2l-leg-d-driven
Fable-Opus-Timeout-Minutes: 35

## Goal

Drive super-productivity journey leg (d) settings-change to measured-green on BOTH lanes in /Users/jacksm5pro/dev/open-source/versionless (commit `d8274be`: legs a/b/c/e landed; migrated dist-25 clean; calibration apparatus in `angular-super-productivity-calibrate-run.ts`). This is the last journey leg; NO runner/publish (final unit).

PM-ruled leg (d) shape (Option a — the app has NO dark-theme UI, so drive the real controls it does have):

1. Create a second project via the side-nav `addProject()` dialog; switch to it (`switchProject`); assert the switch (active project name in the shell).
2. Change the project's PRIMARY (or accent) color through the `/project-settings` formly config-section save — the 2nd `.config-section` (collapsible theme form), an `input[type=color]` for `primary`, then `.submit-button`. Prove it with a before/after rendered-style probe on `--palette-primary-500` (or `--palette-accent-500`) resolved on `body` (u20c2j confirmed these resolve to rgb). This is a genuine formly config save shifting a measurable style.
3. Exercise one keyboard shortcut (`w` goToWorkView or `b` toggleBacklog) with its visible effect asserted (measure which effect is observable in this DOM state — u20c2j noted no backlog/split group was present in one state; pick the shortcut whose effect you can measure, or record the measured limitation).
   Record that dark-theme is NOT journeyed because v2.13.15 exposes no UI control for it (truthful non-claim).

Add the leg-(d) evidence shape to the schema (project-switch + formly-color-save + rendered-style shift + shortcut) as rule-pins; extend the producer's journey (after leg b, before the reload, or wherever the calibration shows it settles cleanly); calibrate every selector/count against the live DOM on BOTH lanes; pin measured values; per-lane inventories extended. Any real break is RED first. Tests per idiom; whole repo gate green.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/witness-angular-super-productivity.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `fixtures/angular-super-productivity-v2-13-15/**`

## Forbidden moves

- No runner/publish; no other packages/core changes; no packages/frameworks/**, packages/trust/**, aggregate.json, evidence/**, scripts/**, docs/\*\*.
- Settled anchors never timing; no guessed values (measure first on both lanes); truthful reds; dark-theme non-claim recorded truthfully. No network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
```

## Blocked permission

If leg (d) reveals a real break on either lane (RED first with the measurement — this cell has surfaced three already), the formly color save does not shift a measurable style, the addProject/switch flow cannot settle deterministically, or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
