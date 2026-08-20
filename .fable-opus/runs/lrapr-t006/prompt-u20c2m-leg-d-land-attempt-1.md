Fable-Opus-Unit: lrapr-t006/u20c2m-leg-d-land
Fable-Opus-Timeout-Minutes: 35

## Goal

Land super-productivity journey leg (d) settings-change to measured-green on BOTH lanes in /Users/jacksm5pro/dev/open-source/versionless (commit `b1e3313`; the calibration apparatus + baseline measurements are in `angular-super-productivity-calibrate-run.ts`). Last journey leg; NO runner/publish.

PM-ruled leg (d) shape (measured facts from u20c2l baseline):

- **Project-switch (GREEN, measured)**: side-nav `addProject()` (`section.projects > button[mat-menu-item]`) → `dialog-create-project`, title into `dialog-create-project input:not([type=color])`, `button[type=submit]` grows the list 1→2, switch via `side-nav .project:nth-of-type(2) > button[mat-menu-item]` flips `main-header .current-project-title` to the new project. This is the leg's spine.
- **Theme control — use a CLICK-DRIVEABLE control, not the color input** (u20c2l ruling: the witness PageHandle cannot drive `input[type=color]`, and the save-side palette shift is unprovable): drive the theme form's `huePrimary` mat-select (change the primary hue — a real formly config change) OR the `isAutoContrast` checkbox, whichever provably shifts a MEASURED style var (`--palette-primary-*` or a contrast/background probe). CALIBRATE first to confirm which control shifts which var by a DRIVEN click (open the mat-select, pick a different option; or toggle the checkbox), before/after probe proving the shift is real and driven — on BOTH lanes. Record the dark-theme non-claim (no UI in v2.13.15).
- **Shortcut**: `w` keeps `#/work-view` (measured); assert its measurable effect or record the measured limitation (`b` had no visible toggle in the observed state).

Land the leg-(d) evidence shape in the schema (project-switch + driven-theme-control + measured-style-shift + shortcut) as rule-pins with the measured values; wire it into the producer's journey; per-lane inventories extended; both lanes agree or the difference is a recorded declared difference (Angular 8 vs 16 material-css-vars may differ — if the shifted rgb differs across lanes, that is a declared difference, not a failure). Any real break is RED first. Tests per idiom; whole repo gate green.

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
- Do NOT claim a color-input-driven change (unprovable per u20c2l); settled anchors never timing; no guessed values (measure both lanes); truthful reds. No network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
```

## Blocked permission

If no click-driveable theme control provably shifts a measured style on either lane (bring the measurements — then leg (d) narrows to project-switch + shortcut with the theme-probe recorded as a measured limitation), a real break surfaces, or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
