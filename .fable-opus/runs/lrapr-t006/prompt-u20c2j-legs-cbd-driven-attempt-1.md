Fable-Opus-Unit: lrapr-t006/u20c2j-legs-cbd-driven
Fable-Opus-Timeout-Minutes: 35

## Goal

Drive super-productivity journey legs (c) time-tracking, (b) drag-reorder, and (d) settings-change to measured-green on BOTH lanes in /Users/jacksm5pro/dev/open-source/versionless (commit `3d56981`: journey-type shapes + drag membership landed, migrated lane clean at dist-25, calibration apparatus in `angular-super-productivity-calibrate-run.ts` with the dist-25 rebind + c/b probes). NO publish (final unit).

PM rulings from u20c2i's findings, baked in:

- **Leg (b) selector**: initiate the drag on `task .drag-handle.handle-par` (container `.task-list-inner`, dragula group `PARENT`) — the `moves` callback restricts drag-start to the handle; the jira-clone card-grab will NOT start it.
- **Journey ORDER**: drive all mutations BEFORE the single leg-(e) reload — create tasks → (c) → (b) → (d) → then the reload persistence check. This sidesteps the after-reload add-task-bar hang; if that hang reproduces on the clean pre-reload path it is a RED to record with the measurement.
- **Leg (d) re-specified (Option a)**: v2.13.15 has NO dark-theme UI control (isDarkMode formly field commented out), so drive the REAL control the app has: create a second project via the side-nav `addProject()` dialog, switch to it, then change the project's PRIMARY (or accent) color through the `/project-settings` formly config-section save — a genuine formly config save that shifts rendered styles via `--palette-*` custom properties, proven by a before/after rendered-style probe — plus one keyboard shortcut (`w` goToWorkView or `b` toggleBacklog). Record that dark-theme is not journeyed because the app exposes no UI for it (truthful non-claim). Add the leg-(d) evidence shape to the schema (project-switch + formly-color-save + rendered-style shift + shortcut) as rule-pins.

Extend the journey producer in `real-app-run.ts` for legs (c)/(b)/(d), calibrate every selector/count/anchor against the live DOM (settled-reaction anchors, never timing), retire the stale "no drag driven" producer comment/assertion, pin the measured values into `WITNESS_ANGULAR_SUPER_PRODUCTIVITY_JOURNEY` and per-lane inventories (both lanes pageErrors 0 — any real break is RED first). Schema changes: the leg-(d) shape + any calibration-contradicted rule-pin (recorded). Tests per idiom; whole repo gate green.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/witness-angular-super-productivity.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `fixtures/angular-super-productivity-v2-13-15/**`

## Forbidden moves

- No publish/runner; no other packages/core changes; no packages/frameworks/**, packages/trust/**, aggregate.json, evidence/**, scripts/**, docs/\*\*.
- Settled anchors never timing; no fabricated/guessed leg values (measure first — the u19/u20 discipline); truthful reds. No network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
```

## Blocked permission

If a leg cannot pass truthfully on either lane (RED first with the measurement), drag cannot settle on the handle, the formly color save does not shift a measurable style, or the work exceeds this unit (cut: c+b land, d re-cut), return status "blocked" with specifics in open_questions instead of improvising.
