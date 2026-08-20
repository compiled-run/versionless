Fable-Opus-Unit: lrapr-t006/u20c2k-legs-cb-land
Fable-Opus-Timeout-Minutes: 35

## Goal

Land super-productivity journey legs (c) time-tracking and (b) drag-reorder to measured-green on BOTH lanes in `real-app-run.ts` in /Users/jacksm5pro/dev/open-source/versionless (commit `9078953`: calibration measured; the apparatus with the driving logic is in `angular-super-productivity-calibrate-run.ts`). NO leg (d) (its own unit), NO publish.

PM-ruled measured facts (from u20c2j calibration — port them from the calibrate driver into the real journey producer):

- **Leg (b) up-drag**: drag task 2's `task .drag-handle.handle-par` UP onto `task-list:first-of-type task:nth-of-type(1)`; settles the real permutation `["…task two","…task"]`; assert the settled order is a real permutation AND the IndexedDB store read agrees. (The down-drag does not reorder — do not use it.)
- **Leg (c) re-anchored** (the pinned digit-time/play-indicator sub-rules are contradicted by the app — `ms-to-string` hides sub-minute so `.time-val` is `-`, and `.play-icon-indicator`/`.start-task-btn` don't reliably render/click): anchor leg (c) on `main-header .play-btn mat-icon` flipping `play_arrow`→`pause` on start (current-task-set) and back on stop. Revise `WITNESS_ANGULAR_SUPER_PRODUCTIVITY_TIME_TRACKING`: drop the `trackedTimeValue`-carries-a-digit and `playIndicatorPresent` sub-rules, keep the icon-flip + current-task anchor; record the `ms-to-string` sub-minute behavior and the hover-gated start-btn as truthful non-claims (this is the calibration-contradicted schema revision, recorded per mw1e).
- **Journey order**: create tasks → (c) → (b), all before the leg-(e) reload (already ordered in the apparatus).

Drive both legs on BOTH lanes (migrated dist-25, baseline — measure baseline too, the apparatus only ran migrated); pin the measured values into `WITNESS_ANGULAR_SUPER_PRODUCTIVITY_JOURNEY`; per-lane inventories extended exactly; retire the stale "no drag driven" producer comment/assertion (the earned drag now lands here). Any real break on either lane is RED evidence first. Tests per idiom; whole repo gate green.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/witness-angular-super-productivity.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `fixtures/angular-super-productivity-v2-13-15/**`

## Forbidden moves

- No leg (d); no publish/runner; no other packages/core changes; no packages/frameworks/**, packages/trust/**, aggregate.json, evidence/**, scripts/**, docs/\*\*.
- Settled anchors never timing; no guessed values (the calibration measured them — port, re-confirm on both lanes); truthful reds. No network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
```

## Blocked permission

If leg (c) or (b) cannot pass truthfully on the BASELINE lane (RED first with the measurement — the migrated is measured, baseline is the risk), or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
