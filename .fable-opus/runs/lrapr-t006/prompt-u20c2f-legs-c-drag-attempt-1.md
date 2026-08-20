Fable-Opus-Unit: lrapr-t006/u20c2f-legs-c-drag
Fable-Opus-Timeout-Minutes: 35

## Goal

Deliver super-productivity journey legs (c) time-tracking and (b) drag-reorder in /Users/jacksm5pro/dev/open-source/versionless — re-cut 2 of 3 of the journey (commit `0d05149`: AppSpec + legs a/e landed; migrated lane clean at dist-25, 0 page errors). NO leg (d), NO runner/publish. Both legs operate on tasks in the work view, so they share the create-task setup from leg (a).

Calibrated anchors (u20c2a source-reading, re-measure to confirm):

- Leg (c) time-tracking: `main-header .play-btn` dispatches ToggleStart, icon flips `play_arrow`↔`pause` off `taskService.currentTaskId$`; per-task controls `task .start-task-btn` (only when `!isCurrent`) / a sibling pause (only when `isCurrent`); `task .play-icon-indicator` exists only while `isCurrent`; tracked time renders at `task .time-wrapper .time .time-val`. Anchor the settled reaction on the icon flip + play-icon-indicator presence — NEVER a timer/sleep.
- Leg (b) drag: the app has a real dragula surface. Create two tasks, drag-reorder them with real pointer gestures (the jira-clone drag primitive precedent), assert settled order (Akita/ngrx store state or the rendered list order — the settled DOM). On a truthful measured drag, flip `angular-super-productivity` from the schema's explicit drag-REFUSAL into earned `WITNESS_REAL_APP_DRAG_SURFACES` membership (the file is `packages/core/src/receipts/witness-real-app.ts` — in contract this unit; retire the deliberate-absence comment; the schema's drag-refusal constant flips to the earned assertion). Drag stays hard-refused for every other app.

Both legs on BOTH lanes (the migrated lane is dist-25 clean now); per-lane inventories extended for the new surface (pin exactly); schema changes only for the drag-membership flip and any calibration contradiction (recorded per mw1e). Tests per idiom; whole repo gate green. Publish nothing to evidence/.

## File contract

- `packages/cli/src/witness/**`
- `packages/cli/src/fixture/**`
- `packages/cli/test/**`
- `packages/core/src/receipts/witness-real-app.ts`
- `packages/core/src/receipts/witness-angular-super-productivity.ts`
- `packages/core/src/index.ts`
- `packages/core/test/**`
- `fixtures/angular-super-productivity-v2-13-15/**`

## Forbidden moves

- No leg (d); no runner/publish; drag membership ONLY with the measured drag; schema changes only the flip + recorded contradictions; no other packages/core changes; no packages/frameworks/**, packages/cli/src/fixture outside the witness drivers, packages/trust/**, aggregate.json, evidence/**, scripts/**, docs/\*\*.
- No fabricated evidence; truthful reds (a real break is RED first); settled-reaction anchors never timing. No network. Strict TypeScript, magic-regexp, pathe, ufo. No test weakening. Do not commit or stage.

## Verification

```verify
pnpm exec tsc --noEmit
pnpm exec vp lint
pnpm exec vp test --project node
```

## Blocked permission

If drag cannot settle deterministically (bring the measurement — a real break is RED), leg (c)'s settled anchor cannot be found, or the work exceeds this unit, return status "blocked" with specifics in open_questions instead of improvising.
